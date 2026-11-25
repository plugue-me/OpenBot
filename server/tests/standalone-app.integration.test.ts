import { afterAll, expect, test } from "bun:test";
import { randomBytes, randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { eq } from "drizzle-orm";
import {
  agents,
  credentials,
  localThreads,
  personalMemories,
} from "../src/db/schema";
import { startHttpServer } from "../src/http-server";
import { createStandalone } from "../src/standalone/bootstrap";
import { testDatabaseUrl } from "./support/database";

// Real Hono/Bun HTTP, real PostgreSQL, simulated AG-UI model endpoint. Test preload blocks egress.
process.env.COPILOTKIT_TELEMETRY_DISABLED = "true";
const address = testDatabaseUrl();
const key = randomBytes(32).toString("base64");
let calls = 0;
let history: { id: string; content?: string }[] = [];
const remote = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  async fetch(request) {
    calls++;
    const input = (await request.json()) as {
      threadId: string;
      runId: string;
      messages: { id: string; content?: string }[];
    };
    history = input.messages;
    const id = `answer-${input.runId}`;
    const events = [
      { type: "RUN_STARTED", threadId: input.threadId, runId: input.runId },
      { type: "TEXT_MESSAGE_START", messageId: id, role: "assistant" },
      {
        type: "TEXT_MESSAGE_CONTENT",
        messageId: id,
        delta: "Simulated standalone response",
      },
      { type: "TEXT_MESSAGE_END", messageId: id },
      { type: "RUN_FINISHED", threadId: input.threadId, runId: input.runId },
    ];
    return new Response(
      events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join(""),
      { headers: { "content-type": "text/event-stream" } },
    );
  },
});
const probe = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  fetch: () => new Response(),
});
const port = probe.port!;
await probe.stop(true);
const origin = `http://127.0.0.1:${port}`;
const environment = {
  DATABASE_URL: address,
  KEY_ENCRYPTION_KEY: key,
  OPENBOT_SINGLE_USER: "true",
  OPENBOT_PUBLIC_URL: origin,
  OPENBOT_APP_URL: origin,
  PORT: String(port),
  TENANT_PACKAGE_DIR: resolve(import.meta.dir, "../../examples/fintech"),
  AGENT_ENDPOINT_ALLOWED_HOSTS: `127.0.0.1:${remote.port}`,
  BOT_PROVIDER: "openai",
  BOT_MODEL: "gpt-4.1-mini",
};
let deployment = await createStandalone(environment);
const serve = () =>
  startHttpServer({
    config: deployment.config,
    port,
    app: deployment.app,
    resolveRequestActor: deployment.actors.resolveRequestActor,
    agentProfileStore: deployment.profiles,
    computerGateway: undefined,
  });
let server = serve();
let agentId: string | undefined;
let credentialId: string | undefined;
let memoryId: string | undefined;
const threadId = randomUUID();
const request = (path: string, body?: unknown) =>
  fetch(`${origin}${path}`, {
    method: body ? "POST" : "GET",
    headers: { origin, "content-type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

afterAll(async () => {
  await server.stop(true);
  await remote.stop(true);
  await deployment.database
    .delete(localThreads)
    .where(eq(localThreads.id, threadId));
  if (agentId)
    await deployment.database.delete(agents).where(eq(agents.id, agentId));
  if (credentialId)
    await deployment.database
      .delete(credentials)
      .where(eq(credentials.id, credentialId));
  if (memoryId)
    await deployment.database
      .delete(personalMemories)
      .where(eq(personalMemories.id, memoryId));
  await deployment.database.$client.close();
});

test("standalone boots without Intelligence or licence and preserves original APIs and durable SSE", async () => {
  expect((await request("/health")).status).toBe(200);
  const excluded = await request("/api/voice/sessions");
  expect(excluded.status).toBe(404);
  expect(await excluded.json()).toMatchObject({
    feature: "voice",
    state: "out_of_scope",
  });
  const pending = await request("/api/computers");
  expect(pending.status).toBe(503);
  expect(await pending.json()).toMatchObject({
    feature: "computer",
    state: "in_development",
  });
  expect(await (await request("/api/capabilities")).json()).toMatchObject({
    mode: "standalone",
    durableHistory: true,
  });
  const info = await (await request("/api/copilotkit/info")).json();
  expect(info.mode).toBe("sse");
  expect(info.telemetryDisabled).toBe(true);
  expect(info).not.toHaveProperty("licenseStatus");
  const savedKey = await request("/api/admin/credentials", {
    kind: "model",
    provider: "openai",
    keyId: `test-${randomUUID()}`,
    plaintext: "synthetic-test-key",
    metadata: {},
  });
  expect(savedKey.status).toBe(201);
  const keyBody = await savedKey.json();
  credentialId = keyBody.credential.id;
  expect(JSON.stringify(keyBody)).not.toContain("synthetic-test-key");
  const created = await request("/api/agents", {
    name: `Local ${randomUUID()}`,
    title: "Test agent",
    roleDescription: "Reply briefly",
    visibility: "private",
    endpoint: `http://127.0.0.1:${remote.port}`,
  });
  expect(created.status).toBe(201);
  agentId = (await created.json()).agent.id;
  const remembered = await request("/api/memory", {
    content: "Standalone memory validation: prefers concise replies.",
    provenance: "Explicit user preference",
  });
  expect(remembered.status).toBe(201);
  memoryId = (await remembered.json()).memory.id;
  const input = {
    threadId,
    runId: randomUUID(),
    messages: [{ id: "first-question", role: "user", content: "Hello" }],
    state: {},
    tools: [],
    context: [],
    forwardedProps: {},
  };
  const streamed = await request(`/api/copilotkit/agent/${agentId}/run`, input);
  expect(streamed.status).toBe(200);
  expect(streamed.headers.get("content-type")).toContain("text/event-stream");
  const events = await streamed.text();
  expect(events).toContain("Simulated standalone response");
  expect(events).toContain("RUN_FINISHED");
  expect(calls).toBe(1);
  expect(
    history.find((m) => m.id === "openbot:personal-memory")?.content,
  ).toContain("prefers concise replies");
  expect(
    history.find((m) => m.id === "openbot:personal-memory")?.content,
  ).toContain("untrusted data");
  const saved = await (
    await request(`/api/copilotkit/threads/${threadId}/messages`)
  ).json();
  expect(
    saved.messages.some(
      (m: { content: string }) => m.content === "Simulated standalone response",
    ),
  ).toBe(true);
  expect(await (await request(`/api/threads/${threadId}`)).json()).toEqual({
    known: true,
  });

  await server.stop(true);
  await deployment.database.$client.close();
  deployment = await createStandalone(environment);
  server = serve();
  const memories = await (await request("/api/memory")).json();
  expect(memories.memories.some((m: { id: string }) => m.id === memoryId)).toBe(
    true,
  );
  const replay = await request(
    `/api/copilotkit/agent/${agentId}/connect`,
    input,
  );
  expect(await replay.text()).toContain("Simulated standalone response");
  expect(calls).toBe(1);
  const disabled = await fetch(`${origin}/api/memory/${memoryId}`, {
    method: "PATCH",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify({ enabled: false }),
  });
  expect(disabled.status).toBe(200);
  const next = await request(`/api/copilotkit/agent/${agentId}/run`, {
    ...input,
    runId: randomUUID(),
    messages: [{ id: "follow-up", role: "user", content: "Continue" }],
  });
  expect(await next.text()).toContain("RUN_FINISHED");
  expect(history.some((m) => m.id === "first-question")).toBe(true);
  expect(history.some((m) => m.id === "follow-up")).toBe(true);
  expect(calls).toBe(2);
  expect(history.some((m) => m.id === "openbot:personal-memory")).toBe(false);
}, 20_000);
