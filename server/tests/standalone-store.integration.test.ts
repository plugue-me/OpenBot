import { afterAll, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { EventType } from "@ag-ui/client";
import { and, eq, sql } from "drizzle-orm";
import { createDatabase } from "../src/db/client";
import { localRuns, localThreads } from "../src/db/schema/standalone";
import {
  createLocalConversationStore,
  LocalRunBusy,
  LocalRunExists,
  LocalRunLost,
  LocalThreadDenied,
} from "../src/standalone/store";
import { testDatabaseUrl } from "./support/database";

const address = testDatabaseUrl();
const first = createDatabase(address, { max: 2 });
const second = createDatabase(address, { max: 2 });
const store = createLocalConversationStore(first);
const otherProcess = createLocalConversationStore(second);
const ownerId = `standalone-test-${randomUUID()}`;
const scope = () => ({
  ownerId,
  agentId: "test-bot",
  threadId: randomUUID(),
  runId: randomUUID(),
});

afterAll(async () => {
  await first.delete(localThreads).where(eq(localThreads.ownerId, ownerId));
  await Promise.all([first.$client.close(), second.$client.close()]);
});

test("conversation snapshots and tool events survive opening a new database pool", async () => {
  const s = scope();
  await store.claim(s);
  const snapshot = {
    messages: [{ id: "message", role: "user" as const, content: "hello" }],
    state: { step: 2 },
  };
  await store.append(
    s,
    {
      type: EventType.TOOL_CALL_RESULT,
      messageId: "tool-result",
      toolCallId: "tool",
      content: "done",
      role: "tool",
    },
    snapshot,
  );
  await store.finish(s, "completed", snapshot);
  const reopened = await otherProcess.read(s);
  expect(reopened.thread.snapshot).toEqual(snapshot);
  expect(reopened.runs[0]?.status).toBe("completed");
  expect((await otherProcess.events(s))[0]?.payload).toMatchObject({
    toolCallId: "tool",
    content: "done",
  });
  const [shape] = await first
    .select({ kind: sql<string>`jsonb_typeof(${localThreads.snapshot})` })
    .from(localThreads)
    .where(eq(localThreads.id, s.threadId));
  expect(shape?.kind).toBe("object");
});

test("only one process can claim a thread concurrently", async () => {
  const s = scope();
  const results = await Promise.allSettled([
    store.claim(s),
    otherProcess.claim({ ...s, runId: randomUUID() }),
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  const refused = results.find(
    (r) => r.status === "rejected",
  ) as PromiseRejectedResult;
  expect(refused.reason).toBeInstanceOf(LocalRunBusy);
});

test("concurrent appends have unique ordered cursors and pagination has no gaps", async () => {
  const s = scope();
  await store.claim(s);
  const cursors = await Promise.all(
    Array.from({ length: 12 }, (_, i) =>
      (i % 2 ? store : otherProcess).append(s, {
        type: EventType.CUSTOM,
        name: "progress",
        value: i,
      }),
    ),
  );
  expect(cursors.sort((a, b) => a - b)).toEqual(
    Array.from({ length: 12 }, (_, i) => i),
  );
  expect((await store.events(s, 4, 3)).map((e) => e.sequence)).toEqual([
    5, 6, 7,
  ]);
});

test("another user or Bot cannot read, append, renew, finish or claim the thread", async () => {
  const s = scope();
  await store.claim(s);
  for (const denied of [
    { ...s, ownerId: "other-person" },
    { ...s, agentId: "other-bot" },
  ]) {
    await expect(store.read(denied)).rejects.toBeInstanceOf(LocalThreadDenied);
    await expect(store.events(denied)).rejects.toBeInstanceOf(
      LocalThreadDenied,
    );
    await expect(
      store.append(denied, {
        type: EventType.CUSTOM,
        name: "secret",
        value: 1,
      }),
    ).rejects.toBeInstanceOf(LocalThreadDenied);
    await expect(store.renew(denied)).rejects.toBeInstanceOf(LocalThreadDenied);
    await expect(
      store.finish(denied, "completed", { messages: [], state: {} }),
    ).rejects.toBeInstanceOf(LocalThreadDenied);
    await expect(
      store.claim({ ...denied, runId: randomUUID() }),
    ).rejects.toBeInstanceOf(LocalThreadDenied);
  }
});

test("an expired worker is fenced out and its run is marked interrupted without retrying tools", async () => {
  const s = scope();
  await store.claim(s);
  await store.append(s, {
    type: EventType.CUSTOM,
    name: "tool-dispatched",
    value: "external-side-effect",
  });
  await first
    .update(localRuns)
    .set({ leaseUntil: sql`now() - interval '1 second'` })
    .where(and(eq(localRuns.threadId, s.threadId), eq(localRuns.id, s.runId)));
  await expect(store.renew(s)).rejects.toBeInstanceOf(LocalRunLost);
  await otherProcess.claim({ ...s, runId: randomUUID() });
  await expect(
    store.append(s, { type: EventType.CUSTOM, name: "stale", value: 1 }),
  ).rejects.toBeInstanceOf(LocalRunLost);
  await expect(
    store.finish(s, "completed", { messages: [], state: {} }),
  ).rejects.toBeInstanceOf(LocalRunLost);
  expect((await store.read(s)).runs.find((r) => r.id === s.runId)?.status).toBe(
    "interrupted",
  );
  expect((await store.events(s)).map((e) => e.payload.type)).toEqual([
    EventType.CUSTOM,
    EventType.RUN_ERROR,
  ]);
});

test("a used run id cannot execute again, including after completion", async () => {
  const s = scope();
  await store.claim(s);
  await expect(otherProcess.claim(s)).rejects.toBeInstanceOf(LocalRunExists);
  await store.finish(s, "cancelled", { messages: [], state: {} });
  await expect(otherProcess.claim(s)).rejects.toBeInstanceOf(LocalRunExists);
  await expect(
    store.append(s, { type: EventType.CUSTOM, name: "late", value: 1 }),
  ).rejects.toBeInstanceOf(LocalRunLost);
  await otherProcess.claim({ ...s, runId: randomUUID() });
});

test("lease renewal preserves ownership and rejects invalid durations and cursors", async () => {
  const s = scope();
  await expect(store.claim(s, 0)).rejects.toBeInstanceOf(TypeError);
  await store.claim(s, 1);
  await otherProcess.renew(s, 120);
  const run = (await store.read(s)).runs[0];
  expect(run!.leaseUntil.getTime()).toBeGreaterThan(Date.now() + 100_000);
  await expect(store.events(s, -2)).rejects.toBeInstanceOf(TypeError);
  await expect(store.events(s, -1, 1001)).rejects.toBeInstanceOf(TypeError);
  await expect(store.claim({ ...scope(), ownerId: "" })).rejects.toBeInstanceOf(
    LocalThreadDenied,
  );
});
