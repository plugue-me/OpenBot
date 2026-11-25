import { afterAll, expect, test } from "bun:test";
import {
  AbstractAgent,
  type BaseEvent,
  EventType,
  type RunAgentInput,
} from "@ag-ui/client";
import { eq } from "drizzle-orm";
import { lastValueFrom, Observable, toArray } from "rxjs";
import { createDatabase } from "../src/db/client";
import { localThreads } from "../src/db/schema/standalone";
import { LocalAgentRunner } from "../src/standalone/runner";
import {
  createLocalConversationStore,
  LocalRunBusy,
  LocalThreadDenied,
} from "../src/standalone/store";
import { createLocalTurnRunner } from "../src/standalone/turn";
import { testDatabaseUrl } from "./support/database";

const database = createDatabase(testDatabaseUrl(), { max: 4 });
const store = createLocalConversationStore(database);
const ownerUserId = `headless-${crypto.randomUUID()}`;
const runner = new LocalAgentRunner(store, 5);
afterAll(async () => {
  await database
    .delete(localThreads)
    .where(eq(localThreads.ownerId, ownerUserId));
  await database.$client.close();
});

class Reply extends AbstractAgent {
  received?: RunAgentInput;
  ready!: () => void;
  readonly started = new Promise<void>((resolve) => {
    this.ready = resolve;
  });
  release!: () => void;
  readonly gate = new Promise<void>((resolve) => {
    this.release = resolve;
  });
  constructor(
    readonly text: string,
    blocked = false,
  ) {
    super({ agentId: "headless-bot" });
    if (!blocked) this.release();
  }
  run(input: RunAgentInput) {
    this.received = input;
    this.ready();
    return new Observable<BaseEvent>((observer) => {
      observer.next({
        type: EventType.RUN_STARTED,
        threadId: input.threadId,
        runId: input.runId,
      });
      void this.gate.then(() => {
        const messageId = `${input.runId}:reply`;
        observer.next({
          type: EventType.TEXT_MESSAGE_START,
          messageId,
          role: "assistant",
        });
        observer.next({
          type: EventType.TEXT_MESSAGE_CONTENT,
          messageId,
          delta: this.text,
        });
        observer.next({ type: EventType.TEXT_MESSAGE_END, messageId });
        observer.next({
          type: EventType.RUN_FINISHED,
          threadId: input.threadId,
          runId: input.runId,
        });
        observer.complete();
      });
    });
  }
  override abortRun() {
    this.release();
    super.abortRun();
  }
}
const host = () => ({
  ownerUserId,
  agentId: "headless-bot",
  routineId: "routine",
  threadId: crypto.randomUUID(),
  instruction: "Summarize briefly",
});
const turn = (agent: Reply, timeoutMs = 1000) =>
  createLocalTurnRunner({
    runner,
    store,
    admission: async ({ signal }) => signal ?? new AbortController().signal,
    buildAgentFor: async () => agent,
    turnTimeoutMs: timeoutMs,
    abortGraceMs: 1000,
  });

test("headless output is durable chat history and a later turn returns only its own reply", async () => {
  const h = host();
  const first = new Reply("First summary");
  expect((await turn(first)(h)).replyText).toBe("First summary");
  const second = new Reply("Second summary");
  expect((await turn(second)(h)).replyText).toBe("Second summary");
  expect(
    second.received?.messages.some(
      (m) => m.role === "assistant" && m.content === "First summary",
    ),
  ).toBe(true);
  const saved = await store.read({
    ownerId: ownerUserId,
    agentId: h.agentId,
    threadId: h.threadId,
  });
  expect(saved.runs.map((r) => r.status)).toEqual(["completed", "completed"]);
  expect(
    saved.thread.snapshot.messages.filter((m) => m.role === "assistant"),
  ).toHaveLength(2);
  const replay = await lastValueFrom(
    new LocalAgentRunner(store, 5)
      .connect({ ownerId: ownerUserId, threadId: h.threadId })
      .pipe(toArray()),
  );
  expect(replay.filter((e) => e.type === EventType.RUN_STARTED)).toHaveLength(
    2,
  );
});

test("chat and headless turns share admission and foreign owners cannot adopt history", async () => {
  const h = host();
  const agent = new Reply("Done", true);
  const running = turn(agent)(h);
  await agent.started;
  try {
    await expect(turn(new Reply("Rival"))(h)).rejects.toBeInstanceOf(
      LocalRunBusy,
    );
  } finally {
    agent.release();
    await running;
  }
  await expect(
    turn(new Reply("Foreign"))({ ...h, ownerUserId: "other" }),
  ).rejects.toBeInstanceOf(LocalThreadDenied);
});

test("cancellation during execution persists a cancelled run and releases the thread", async () => {
  const h = host();
  const controller = new AbortController();
  const agent = new Reply("Partial", true);
  const running = turn(agent)({ ...h, signal: controller.signal });
  await agent.started;
  controller.abort();
  await expect(running).rejects.toThrow();
  expect(
    (
      await store.read({
        ownerId: ownerUserId,
        agentId: h.agentId,
        threadId: h.threadId,
      })
    ).runs[0]?.status,
  ).toBe("cancelled");
  expect((await turn(new Reply("Recovered"))(h)).replyText).toBe("Recovered");
});

test("timeout stops the execution rather than just its observer", async () => {
  const h = host();
  await expect(turn(new Reply("Partial", true), 50)(h)).rejects.toThrow();
  expect(
    (
      await store.read({
        ownerId: ownerUserId,
        agentId: h.agentId,
        threadId: h.threadId,
      })
    ).runs[0]?.status,
  ).toBe("cancelled");
});

test("shutdown cancels provider work and commits its outcome before database closure", async () => {
  const ownRunner = new LocalAgentRunner(store, 5);
  const agent = new Reply("Partial", true);
  const h = host();
  const execute = createLocalTurnRunner({
    runner: ownRunner,
    store,
    admission: async ({ signal }) => signal ?? new AbortController().signal,
    buildAgentFor: async () => agent,
    turnTimeoutMs: 1000,
  });
  const work = execute(h);
  // Observe rejection immediately: shutdown is deliberately an unsuccessful turn.
  const outcome = work.then(
    () => false,
    () => true,
  );
  await agent.started;
  await ownRunner.close();
  expect(await outcome).toBe(true);
  expect(
    (
      await store.read({
        ownerId: ownerUserId,
        agentId: h.agentId,
        threadId: h.threadId,
      })
    ).runs[0]?.status,
  ).toBe("cancelled");
  await expect(
    execute({ ...h, threadId: crypto.randomUUID() }),
  ).rejects.toThrow("shutting down");
});
