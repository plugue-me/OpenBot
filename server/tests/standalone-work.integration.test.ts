import { afterAll, beforeAll, expect, test } from "bun:test";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { LLMock } from "@copilotkit/aimock";
import { eq, inArray, sql } from "drizzle-orm";
import { DEV_ACTOR } from "../src/auth/dev-actor";
import {
  agents,
  channels,
  intelligenceChannelMappings,
  localThreads,
  proactiveSettings,
  proactiveSuggestions,
  routines,
  workItems,
} from "../src/db/schema";
import { createStandalone } from "../src/standalone/bootstrap";
import { createWorkQueue } from "../src/work/queue";
import { testDatabaseUrl } from "./support/database";

// Exercise the production composition with the real built-in Bot; only the LLM is local/fake.
const llm = new LLMock();
const originalBase = process.env.OPENAI_BASE_URL;
let deployment: Awaited<ReturnType<typeof createStandalone>>;
let agentId: string;
let channelId: string;
let routineId: string;
let taskId: string;
const taskIds: string[] = [];
const channelIds: string[] = [];
const origin = "http://127.0.0.1:3039";
const request = (
  path: string,
  body?: unknown,
  method = body ? "POST" : "GET",
) =>
  deployment.app.request(`${origin}${path}`, {
    method,
    headers: { origin, "content-type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

beforeAll(async () => {
  process.env.COPILOTKIT_TELEMETRY_DISABLED = "true";
  process.env.OPENAI_BASE_URL = await llm.start();
  llm.onMessage(/.*/, { content: "Standalone work completed." });
  deployment = await createStandalone({
    DATABASE_URL: testDatabaseUrl(),
    KEY_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
    OPENBOT_SINGLE_USER: "true",
    OPENBOT_PUBLIC_URL: origin,
    OPENBOT_APP_URL: origin,
    TENANT_PACKAGE_DIR: resolve(import.meta.dir, "../../examples/fintech"),
    BOT_PROVIDER: "openai",
    BOT_MODEL: "gpt-4.1-mini",
    OPENAI_API_KEY: "synthetic-local-key",
  });
  const created = await request("/api/agents", {
    name: `Work ${crypto.randomUUID()}`,
    title: "Standalone work",
    roleDescription: "Reply briefly.",
    visibility: "private",
  });
  expect(created.status).toBe(201);
  agentId = (await created.json()).agent.id;
  const response = await request("/api/channels", { agentIds: [agentId] });
  expect(response.status).toBe(201);
  channelId = (await response.json()).channel.id;
  channelIds.push(channelId);
});

afterAll(async () => {
  if (deployment) {
    await deployment.taskRunner.idle();
    if (routineId)
      await deployment.database
        .delete(routines)
        .where(eq(routines.id, routineId));
    await deployment.database
      .delete(workItems)
      .where(
        sql`${inArray(sql<string>`${workItems.payload}->>'taskId'`, taskIds.length ? taskIds : [""])} or ${workItems.payload}->>'routineId' = ${routineId ?? ""}`,
      );
    if (channelIds.length) {
      const rows = await deployment.database
        .select({ threadId: intelligenceChannelMappings.threadId })
        .from(intelligenceChannelMappings)
        .where(inArray(intelligenceChannelMappings.channelId, channelIds));
      if (rows.length)
        await deployment.database.delete(localThreads).where(
          inArray(
            localThreads.id,
            rows.map((r) => r.threadId),
          ),
        );
      await deployment.database
        .delete(channels)
        .where(inArray(channels.id, channelIds));
    }
    if (agentId)
      await deployment.database.delete(agents).where(eq(agents.id, agentId));
    await deployment.database.$client.close();
  }
  await llm.stop();
  if (originalBase === undefined) delete process.env.OPENAI_BASE_URL;
  else process.env.OPENAI_BASE_URL = originalBase;
});

test("a due cron executes without a browser and its answer is available through chat history", async () => {
  const created = await request("/api/routines", {
    agentId,
    channelId,
    instruction: "Produce the scheduled summary.",
    cron: "0 9 * * *",
    timezone: "America/Sao_Paulo",
  });
  expect(created.status).toBe(201);
  routineId = (await created.json()).routine.id;
  await deployment.database
    .update(routines)
    .set({ nextRunAt: sql`now() - interval '1 minute'` })
    .where(eq(routines.id, routineId));
  const result = await deployment.sweep();
  expect(result.fired).toHaveLength(1);
  const runs = await (await request(`/api/routines/${routineId}/runs`)).json();
  expect(runs.runs[0]?.status).toBe("succeeded");
  const [channel] = await deployment.database
    .select()
    .from(channels)
    .where(eq(channels.id, channelId));
  const history = await (
    await request(
      `/api/copilotkit/threads/${(await (await request(`/api/channels/${channelId}`)).json()).channel.threadId}/messages`,
    )
  ).json();
  expect(
    history.messages.some(
      (m: { content?: string }) => m.content === "Standalone work completed.",
    ),
  ).toBe(true);
  expect(channel?.lastMessage).toBe("Standalone work completed.");
  await deployment.routines.setEnabled(DEV_ACTOR.id, routineId, false);
  const paused = await request(`/api/routines/${routineId}/run`, {});
  expect(paused.status).toBe(400);
}, 20_000);

test("a started task uses the same local executor and supports resolve/reopen", async () => {
  const settingId = crypto.randomUUID();
  await deployment.database.insert(proactiveSettings).values({
    id: settingId,
    ownerUserId: DEV_ACTOR.id,
    agentId,
    channelId,
    threadId: crypto.randomUUID(),
  });
  const [item] = await deployment.database
    .insert(proactiveSuggestions)
    .values({
      id: crypto.randomUUID(),
      ownerUserId: DEV_ACTOR.id,
      agentId,
      settingId,
      runId: crypto.randomUUID(),
      title: "Prepare a draft",
      detail: "Write a short draft.",
    })
    .returning();
  const opened = await deployment.taskRunner.startFromItem({
    ownerUserId: DEV_ACTOR.id,
    item: item!,
  });
  taskId = opened.id;
  taskIds.push(taskId);
  channelIds.push(opened.channelId);
  await deployment.taskRunner.idle();
  const response = await request(`/api/tasks/${taskId}`);
  expect(response.status).toBe(200);
  const { task } = await response.json();
  expect(task.status).toBe("ready_for_review");
  const history = await (
    await request(`/api/copilotkit/threads/${task.threadId}/messages`)
  ).json();
  expect(
    history.messages.some(
      (m: { content?: string }) => m.content === "Standalone work completed.",
    ),
  ).toBe(true);
  expect(
    (await (await request(`/api/tasks/${taskId}/resolve`, {})).json()).task
      .status,
  ).toBe("resolved");
  expect(
    (await (await request(`/api/tasks/${taskId}/reopen`, {})).json()).task
      .status,
  ).toBe("ready_for_review");
}, 20_000);

test("manual task submission commits once under concurrent retries and rejects changed request contents", async () => {
  const input = {
    requestId: crypto.randomUUID(),
    agentId,
    title: "Manual draft",
    instruction: "Prepare a concise draft.",
  };
  const responses = await Promise.all([
    request("/api/tasks", input),
    request("/api/tasks", input),
  ]);
  expect(responses.map((r) => r.status)).toEqual([201, 201]);
  const tasks = await Promise.all(responses.map((r) => r.json()));
  expect(tasks[0].task.id).toBe(tasks[1].task.id);
  const created = tasks[0].task;
  taskIds.push(created.id);
  channelIds.push(created.channelId);
  expect(created.origin).toBe("manual");
  await deployment.taskRunner.idle();
  expect(
    (await (await request(`/api/tasks/${created.id}`)).json()).task.status,
  ).toBe("ready_for_review");
  const queued = await deployment.database
    .select()
    .from(workItems)
    .where(sql`${workItems.payload}->>'taskId' = ${created.id}`);
  expect(queued).toHaveLength(1);
  expect(queued[0]?.attempts).toBe(1);
  expect(
    (await request("/api/tasks", { ...input, instruction: "Changed request" }))
      .status,
  ).toBe(409);
  expect(
    (await request("/api/tasks", { ...input, ownerUserId: "spoofed" })).status,
  ).toBe(400);
});

test("a queue offer within a rolled-back task transaction leaves no runnable work", async () => {
  const key = `rollback-${crypto.randomUUID()}`;
  await expect(
    deployment.database.transaction(async (transaction) => {
      await createWorkQueue(deployment.database).offer(
        { kind: "proactive.task", key, payload: {} },
        transaction,
      );
      throw new Error("Rollback fixture");
    }),
  ).rejects.toThrow("Rollback fixture");
  const queued = await deployment.database
    .select()
    .from(workItems)
    .where(eq(workItems.key, key));
  expect(queued).toHaveLength(0);
});
