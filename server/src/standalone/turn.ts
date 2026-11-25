import type { AbstractAgent } from "@ag-ui/client";
import { EventType } from "@ag-ui/client";
import {
  HeadlessToolSuspension,
  HeadlessToolsMiddleware,
  type HeadlessWaiting,
} from "@openbot/toolkit/headless-tools";
import { TURN_LIMITS } from "@openbot/toolkit/limits";
import type { TurnAdmission } from "@openbot/toolkit/ports";
import {
  concludeTurn,
  frameFiring,
  settle,
  type TurnRunner,
  turnInput,
} from "@openbot/toolkit/run-turn";
import type { AuditInitiator } from "../audit";
import type { LocalAgentRunner } from "./runner";
import type { createLocalConversationStore } from "./store";

/** Headless turns share the chat's PostgreSQL admission, history, leases and cancellation. */
export function createLocalTurnRunner(options: {
  runner: LocalAgentRunner;
  store: ReturnType<typeof createLocalConversationStore>;
  admission: TurnAdmission;
  buildAgentFor(input: {
    ownerUserId: string;
    agentId: string;
    initiator: AuditInitiator;
    depth?: number;
  }): Promise<AbstractAgent>;
  turnTimeoutMs?: number;
  abortGraceMs?: number;
}): TurnRunner {
  return async (host) => {
    // Resuming approvals needs the governed continuation service, not an invented answer.
    if (host.continuation)
      throw new Error("Standalone approval continuation is not available yet.");
    host.signal?.throwIfAborted();
    const admitted = await options.admission(host);
    admitted?.throwIfAborted();
    const initiator = host.initiator ?? {
      kind: "routine" as const,
      id: host.routineId,
    };
    const agent = await options.buildAgentFor({ ...host, initiator });
    // The HTTP runtime sets the registry id; a direct headless invocation must do the same.
    agent.agentId = host.agentId;
    const runId = host.runId ?? crypto.randomUUID();
    if (!runId.trim()) throw new Error("A non-empty run id is required.");
    const scope = await options.store.scopeFor(host.threadId, host.ownerUserId);
    const historic = scope
      ? (await options.store.read(scope)).thread.snapshot.messages
      : [];
    const before = new Set(historic.map((message) => message.id));
    const input = turnInput({
      threadId: host.threadId,
      runId,
      messages: [
        host.userMessage ?? {
          id: `${runId}:ask`,
          role: "user",
          content: frameFiring(host.instruction),
        },
      ],
      state: {},
      tools: [],
      skill: host.skill,
    });
    agent.use(new HeadlessToolsMiddleware([], initiator));
    const controller = new AbortController();
    const signal = admitted
      ? AbortSignal.any([admitted, controller.signal])
      : controller.signal;
    const timeoutMs = options.turnTimeoutMs ?? TURN_LIMITS.turnTimeoutMs;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    timeout.unref?.();
    let backstop: ReturnType<typeof setTimeout> | undefined;
    let waiting: HeadlessToolSuspension | undefined;
    let failed: { error: unknown } | undefined;
    const chunks: string[] = [];
    const stream = options.runner.run({
      threadId: host.threadId,
      ownerId: host.ownerUserId,
      agent,
      input,
      signal,
    });
    let subscription: { unsubscribe(): void } | undefined;
    try {
      await new Promise<void>((resolve, reject) => {
        backstop = setTimeout(
          () =>
            reject(
              new Error(
                "The headless turn could not be stopped within its deadline.",
              ),
            ),
          timeoutMs + (options.abortGraceMs ?? TURN_LIMITS.abortGraceMs),
        );
        backstop.unref?.();
        subscription = stream.subscribe({
          next: (event) => {
            if (
              event.type === EventType.TEXT_MESSAGE_CONTENT &&
              typeof event.delta === "string"
            ) {
              chunks.push(event.delta);
              host.onText?.(chunks.join(""));
            }
            if (event.type === EventType.RUN_ERROR)
              failed = { error: new Error("The agent execution failed.") };
            if (
              event.type === EventType.CUSTOM &&
              event.name === "openbot.headless.waiting"
            ) {
              const value = event.value as HeadlessWaiting & {
                message?: string;
              };
              if (value && typeof value.kind === "string")
                waiting = new HeadlessToolSuspension(
                  value.message ?? "Waiting for human input.",
                  value,
                );
            }
          },
          error: reject,
          complete: resolve,
        });
      });
      admitted?.throwIfAborted();
      const persisted = await options.store.read({
        ownerId: host.ownerUserId,
        agentId: host.agentId,
        threadId: host.threadId,
      });
      if (
        persisted.runs.find((run) => run.id === runId)?.status !== "completed"
      )
        throw new Error("The headless execution did not complete.");
      return await concludeTurn(
        settle({
          failed,
          stopped: controller.signal.aborted,
          waiting,
          added: agent.messages.filter((message) => !before.has(message.id)),
          chunks,
          pendingInterrupts: agent.pendingInterrupts,
          componentNames: new Set(),
        }),
        undefined,
        timeoutMs,
      );
    } finally {
      clearTimeout(timeout);
      clearTimeout(backstop);
      subscription?.unsubscribe();
    }
  };
}
