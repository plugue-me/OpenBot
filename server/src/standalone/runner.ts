import { type BaseEvent, EventType } from "@ag-ui/client";
import {
  AgentRunner,
  type AgentRunnerConnectRequest,
  type AgentRunnerIsRunningRequest,
  type AgentRunnerRunRequest,
  type AgentRunnerStopRequest,
  type LocalThreadEndpointScope,
} from "@copilotkit/runtime/v2";
import { finalizeRunEvents } from "@copilotkit/shared";
import { Observable } from "rxjs";
import type { LocalSnapshot } from "../db/schema/standalone";
import {
  type createLocalConversationStore,
  type LocalRunScope,
  LocalThreadDenied,
} from "./store";

type Store = ReturnType<typeof createLocalConversationStore>;
type Active = {
  scope: LocalRunScope;
  agent: AgentRunnerRunRequest["agent"];
  cancelled: boolean;
};

/**
 * Single-server executor. PostgreSQL owns history and admission; no Intelligence or gateway.
 * Observers only read persisted events. Closing an observer never aborts the agent.
 * The host resolves Bot access before run(); ownerId must be the authenticated identity.
 */
export class LocalAgentRunner extends AgentRunner {
  private readonly active = new Map<string, Active>();
  private readonly executions = new Set<Promise<void>>();
  private closing = false;
  constructor(
    private readonly store: Store,
    private readonly pollMs = 100,
  ) {
    super();
    if (!Number.isInteger(pollMs) || pollMs < 1)
      throw new TypeError("Invalid polling interval.");
  }

  async isThreadAccessible(threadId: string, scope: LocalThreadEndpointScope) {
    const owned = await this.store.scopeFor(threadId, scope.ownerId);
    return owned !== undefined || !(await this.store.exists(threadId));
  }

  run(
    request: AgentRunnerRunRequest & { signal?: AbortSignal },
  ): Observable<BaseEvent> {
    if (this.closing)
      throw new Error("The standalone executor is shutting down.");
    const ownerId = request.ownerId;
    const agentId = request.agent.agentId;
    if (!ownerId || !agentId) throw new LocalThreadDenied();
    const scope = {
      ownerId,
      agentId,
      threadId: request.threadId,
      runId: request.input.runId,
    };
    let admit!: () => void;
    let refuse!: (reason: unknown) => void;
    const ready = new Promise<void>((resolve, reject) => {
      admit = resolve;
      refuse = reject;
    });
    // Start now, independently of whether an HTTP observer stays subscribed.
    const execution = this.execute(request, scope, admit).catch(refuse);
    this.executions.add(execution);
    void execution.finally(() => this.executions.delete(execution));
    // Handle rejection even when the caller never subscribes.
    void ready.catch(() => {});
    return new Observable((subscriber) => {
      let subscription: { unsubscribe(): void } | undefined;
      let closed = false;
      void ready.then(
        () => {
          if (!closed)
            subscription = this.watch(scope, [scope.runId]).subscribe(
              subscriber,
            );
        },
        (error) => subscriber.error(error),
      );
      return () => {
        closed = true;
        subscription?.unsubscribe();
      };
    });
  }

  /** Stop provider execution and wait for durability writes before closing PostgreSQL. */
  async close() {
    this.closing = true;
    for (const running of this.active.values()) {
      running.cancelled = true;
      running.agent.abortRun();
    }
    await Promise.allSettled([...this.executions]);
  }

  connect(request: AgentRunnerConnectRequest): Observable<BaseEvent> {
    return new Observable((subscriber) => {
      let closed = false;
      let subscription: { unsubscribe(): void } | undefined;
      void (async () => {
        if (!request.ownerId) throw new LocalThreadDenied();
        const scope = await this.store.scopeFor(
          request.threadId,
          request.ownerId,
        );
        if (!scope && !(await this.store.exists(request.threadId))) {
          subscriber.complete();
          return;
        }
        if (!scope || (request.agentId && request.agentId !== scope.agentId))
          throw new LocalThreadDenied();
        const { runs } = await this.store.read(scope);
        if (!closed)
          subscription = this.watch(
            scope,
            runs.map((run) => run.id),
          ).subscribe(subscriber);
      })().catch((error) => subscriber.error(error));
      return () => {
        closed = true;
        subscription?.unsubscribe();
      };
    });
  }

  async isRunning(request: AgentRunnerIsRunningRequest) {
    if (!request.ownerId) return false;
    const scope = await this.store.scopeFor(request.threadId, request.ownerId);
    return scope
      ? (await this.store.read(scope)).runs.some(
          (r) => r.status === "running" && r.leaseUntil > new Date(),
        )
      : false;
  }

  async stop(request: AgentRunnerStopRequest) {
    const running = this.active.get(request.threadId);
    if (
      !running ||
      running.scope.ownerId !== request.ownerId ||
      (request.runId && request.runId !== running.scope.runId)
    )
      return false;
    running.cancelled = true;
    running.agent.abortRun();
    return true;
  }

  private watch(
    scope: Omit<LocalRunScope, "runId">,
    runIds: string[],
  ): Observable<BaseEvent> {
    return new Observable((subscriber) => {
      let closed = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      let wake: (() => void) | undefined;
      void (async () => {
        for (const runId of runIds) {
          let cursor = -1;
          for (;;) {
            if (closed) return;
            const page = await this.store.events({ ...scope, runId }, cursor);
            for (const row of page) {
              if (closed) return;
              subscriber.next(row.payload);
              cursor = row.sequence;
            }
            if (page.length === 500) continue;
            const run = (await this.store.read(scope)).runs.find(
              (r) => r.id === runId,
            );
            if (run?.status !== "running") {
              // finish may commit between the page and status reads. Drain again before completing.
              const tail = await this.store.events({ ...scope, runId }, cursor);
              if (tail.length) {
                for (const row of tail) {
                  subscriber.next(row.payload);
                  cursor = row.sequence;
                }
                continue;
              }
              break;
            }
            if (run.leaseUntil <= new Date()) {
              subscriber.next({
                type: EventType.RUN_ERROR,
                code: "LOCAL_RUN_INTERRUPTED",
                message: "The execution lease expired.",
              } as BaseEvent);
              break;
            }
            await new Promise<void>((resolve) => {
              wake = resolve;
              timer = setTimeout(resolve, this.pollMs);
            });
          }
        }
        subscriber.complete();
      })().catch((error) => subscriber.error(error));
      return () => {
        closed = true;
        clearTimeout(timer);
        wake?.();
      };
    });
  }

  private async execute(
    request: AgentRunnerRunRequest & { signal?: AbortSignal },
    scope: LocalRunScope,
    admitted: () => void,
  ) {
    const restored = await this.store.claim(scope);
    const running: Active = { scope, agent: request.agent, cancelled: false };
    this.active.set(scope.threadId, running);
    const cancel = () => {
      running.cancelled = true;
      request.agent.abortRun();
    };
    request.signal?.addEventListener("abort", cancel, { once: true });
    if (request.signal?.aborted || this.closing) cancel();
    admitted();
    const events: BaseEvent[] = [];
    let leaseLost = false;
    let renewal = Promise.resolve();
    const timer = setInterval(() => {
      renewal = renewal
        .then(() => this.store.renew(scope))
        .catch(() => {
          leaseLost = true;
          request.agent.abortRun();
        });
    }, 20_000);
    timer.unref?.();
    const snapshot = (): LocalSnapshot =>
      structuredClone({
        messages: request.agent.messages,
        state: request.agent.state,
      });
    let failed = false;
    try {
      const messages = new Map(restored.messages.map((m) => [m.id, m]));
      for (const message of request.input.messages)
        messages.set(message.id, message);
      const input = {
        ...request.input,
        messages: [...messages.values()],
        state: { ...restored.state, ...request.input.state },
      };
      // AbstractAgent prepares RunAgentInput from its own messages/state and ignores those
      // fields in runAgent's parameter. Seed both before invoking it (as the headless path does).
      request.agent.messages = structuredClone(input.messages);
      request.agent.state = structuredClone(input.state);
      const started = {
        type: EventType.RUN_STARTED,
        threadId: scope.threadId,
        runId: scope.runId,
        input,
      };
      await this.store.append(scope, started, {
        messages: input.messages,
        state: input.state,
      });
      events.push(started);
      if (running.cancelled) throw new Error("The execution was cancelled.");
      await request.agent.runAgent(input, {
        onEvent: async ({ event }) => {
          if (leaseLost) throw new Error("Execution lease lost.");
          if (event.type === EventType.RUN_STARTED) return;
          if (event.type === EventType.RUN_ERROR) failed = true;
          try {
            await this.store.append(scope, event, snapshot());
          } catch (error) {
            // AG-UI reports subscriber exceptions and continues. Abort explicitly so a failed
            // durability write cannot silently let later tools execute as if it succeeded.
            leaseLost = true;
            request.agent.abortRun();
            throw error;
          }
          events.push(event);
        },
      });
    } catch {
      failed = true;
      // Provider exceptions can contain credentials or full requests. Persist a safe boundary error.
    } finally {
      clearInterval(timer);
      request.signal?.removeEventListener("abort", cancel);
      await renewal;
      try {
        if (!leaseLost) {
          const terminal = finalizeRunEvents(events, {
            stopRequested: running.cancelled,
            protocolVersion: request.input.protocolVersion,
            ...(failed
              ? { interruptionMessage: "The agent execution failed." }
              : {}),
          });
          for (const event of terminal)
            await this.store.append(scope, event, snapshot());
          await this.store.finish(
            scope,
            running.cancelled ? "cancelled" : failed ? "failed" : "completed",
            snapshot(),
          );
        }
      } finally {
        if (this.active.get(scope.threadId) === running)
          this.active.delete(scope.threadId);
      }
    }
  }
}
