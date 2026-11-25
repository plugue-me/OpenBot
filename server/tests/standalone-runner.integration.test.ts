import { afterAll, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import {
  AbstractAgent,
  type BaseEvent,
  EventType,
  type RunAgentInput,
} from "@ag-ui/client";
import { eq } from "drizzle-orm";
import {
  filter,
  firstValueFrom,
  lastValueFrom,
  Observable,
  toArray,
} from "rxjs";
import { createDatabase } from "../src/db/client";
import { localThreads } from "../src/db/schema/standalone";
import { LocalAgentRunner } from "../src/standalone/runner";
import {
  createLocalConversationStore,
  LocalRunBusy,
  LocalThreadDenied,
} from "../src/standalone/store";
import { testDatabaseUrl } from "./support/database";

const database = createDatabase(testDatabaseUrl(), { max: 4 });
const store = createLocalConversationStore(database);
const ownerId = `runner-test-${randomUUID()}`;
afterAll(async () => {
  await database.delete(localThreads).where(eq(localThreads.ownerId, ownerId));
  await database.$client.close();
});

class TestAgent extends AbstractAgent {
  calls = 0;
  received?: RunAgentInput;
  release!: () => void;
  private readonly gate = new Promise<void>((resolve) => {
    this.release = resolve;
  });
  run(input: RunAgentInput) {
    this.calls++;
    this.received = input;
    return new Observable<BaseEvent>((observer) => {
      observer.next({
        type: EventType.RUN_STARTED,
        threadId: input.threadId,
        runId: input.runId,
      });
      observer.next({ type: EventType.CUSTOM, name: "ready", value: true });
      void this.gate.then(() => {
        observer.next({
          type: EventType.TEXT_MESSAGE_START,
          messageId: "answer",
          role: "assistant",
        });
        observer.next({
          type: EventType.TEXT_MESSAGE_CONTENT,
          messageId: "answer",
          delta: "Local answer",
        });
        observer.next({
          type: EventType.TEXT_MESSAGE_END,
          messageId: "answer",
        });
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
const request = () => ({
  ownerId,
  threadId: randomUUID(),
  agent: new TestAgent({ agentId: "local-bot" }),
  input: {
    threadId: "",
    runId: randomUUID(),
    messages: [{ id: "question", role: "user" as const, content: "Hello" }],
    state: {},
    tools: [],
    context: [],
    forwardedProps: {},
  },
});
const started = (stream: Observable<BaseEvent>) =>
  firstValueFrom(
    stream.pipe(
      filter(
        (e) => e.type === EventType.CUSTOM && "name" in e && e.name === "ready",
      ),
    ),
  );

test("opening a conversation before its first run returns an empty replay", async () => {
  const runner = new LocalAgentRunner(store, 5);
  expect(
    await lastValueFrom(
      runner.connect({ ownerId, threadId: randomUUID() }).pipe(toArray()),
    ),
  ).toEqual([]);
});

test("disconnecting does not stop work; a fresh runner replays the persisted answer without executing again", async () => {
  const r = request();
  r.input.threadId = r.threadId;
  const runner = new LocalAgentRunner(store, 5);
  // firstValueFrom unsubscribes when the ready event is seen, like a disconnected browser.
  await started(runner.run(r));
  expect(await runner.isRunning(r)).toBe(true);
  r.agent.release();
  const reopened = new LocalAgentRunner(store, 5);
  const events = await lastValueFrom(
    reopened.connect({ ownerId, threadId: r.threadId }).pipe(toArray()),
  );
  expect(events.filter((e) => e.type === EventType.RUN_STARTED)).toHaveLength(
    1,
  );
  expect(
    events.some(
      (e) =>
        e.type === EventType.TEXT_MESSAGE_CONTENT &&
        "delta" in e &&
        e.delta === "Local answer",
    ),
  ).toBe(true);
  expect(events.at(-1)?.type).toBe(EventType.RUN_FINISHED);
  expect(r.agent.calls).toBe(1);
  const saved = await store.read({
    ownerId,
    agentId: "local-bot",
    threadId: r.threadId,
  });
  expect(saved.thread.snapshot.messages.some((m) => m.id === "answer")).toBe(
    true,
  );
  expect(saved.runs[0]?.status).toBe("completed");
});

test("concurrent execution and foreign reconnect/stop are refused", async () => {
  const r = request();
  r.input.threadId = r.threadId;
  const runner = new LocalAgentRunner(store, 5);
  await started(runner.run(r));
  const rival = new TestAgent({ agentId: "local-bot" });
  await expect(
    lastValueFrom(
      runner
        .run({ ...r, agent: rival, input: { ...r.input, runId: randomUUID() } })
        .pipe(toArray()),
    ),
  ).rejects.toBeInstanceOf(LocalRunBusy);
  expect(rival.calls).toBe(0);
  await expect(
    lastValueFrom(
      runner
        .connect({ ownerId: "other-user", threadId: r.threadId })
        .pipe(toArray()),
    ),
  ).rejects.toBeInstanceOf(LocalThreadDenied);
  expect(
    await runner.stop({ ownerId: "other-user", threadId: r.threadId }),
  ).toBe(false);
  expect(
    await runner.stop({ ownerId, threadId: r.threadId, runId: "stale-run-id" }),
  ).toBe(false);
  expect(
    await runner.isRunning({ ownerId: "other-user", threadId: r.threadId }),
  ).toBe(false);
  expect(
    await runner.stop({ ownerId, threadId: r.threadId, runId: r.input.runId }),
  ).toBe(true);
  await lastValueFrom(
    runner.connect({ ownerId, threadId: r.threadId }).pipe(toArray()),
  );
  expect(
    (await store.read({ ownerId, threadId: r.threadId, agentId: "local-bot" }))
      .runs[0]?.status,
  ).toBe("cancelled");
});

test("a later turn restores context from PostgreSQL", async () => {
  const r = request();
  r.input.threadId = r.threadId;
  const runner = new LocalAgentRunner(store, 5);
  r.agent.release();
  await lastValueFrom(runner.run(r).pipe(toArray()));
  const next = new TestAgent({ agentId: "local-bot" });
  next.release();
  await lastValueFrom(
    new LocalAgentRunner(store, 5)
      .run({
        ...r,
        agent: next,
        input: {
          ...r.input,
          runId: randomUUID(),
          messages: [{ id: "followup", role: "user", content: "Continue" }],
        },
      })
      .pipe(toArray()),
  );
  expect(next.received?.messages.map((m) => m.id)).toContain("answer");
  expect(next.received?.messages.map((m) => m.id)).toContain("question");
  expect(next.received?.messages.map((m) => m.id)).toContain("followup");
});
