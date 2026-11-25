import { afterAll, beforeAll, expect, test } from "bun:test";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { LLMock } from "@copilotkit/aimock";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { HeadlessToolSuspension } from "@openbot/toolkit/headless-tools";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { PERSON_INITIATOR } from "../src/audit";
import { DEV_ACTOR } from "../src/auth/dev-actor";
import {
  agents,
  approvalRequests,
  channels,
  credentials,
  localThreads,
  mcpServers,
  workItems,
} from "../src/db/schema";
import { createStandalone } from "../src/standalone/bootstrap";
import { testDatabaseUrl } from "./support/database";

const llm = new LLMock();
const oldBase = process.env.OPENAI_BASE_URL;
const realFetch = globalThis.fetch;
const address = `https://standalone-mcp.example.test/mcp/${crypto.randomUUID()}`;
const origin = "http://127.0.0.1:3039";
const token = "synthetic-mcp-token";
const writes: string[] = [];
let toolName = "";
let scriptTool = "";
let deployment: Awaited<ReturnType<typeof createStandalone>>;
let server: ReturnType<typeof Bun.serve>;
let serverId: string;
let credentialId: string | null;
let botId: string;
let channelId: string;
let threadId: string;
const approvals: string[] = [];
let preferences: {
  enabled: boolean;
  autoReview: boolean;
  hostCommands: "ask" | "allow" | "never";
};
const request = (path: string, body?: unknown) =>
  deployment.app.request(`${origin}${path}`, {
    method: body ? "POST" : "GET",
    headers: { origin, "content-type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

beforeAll(async () => {
  process.env.COPILOTKIT_TELEMETRY_DISABLED = "true";
  server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      if (request.headers.get("authorization") !== `Bearer ${token}`)
        return new Response("A key is required", { status: 401 });
      const mcp = new McpServer({
        name: "standalone-fixture",
        version: "1.0.0",
      });
      mcp.registerTool(
        "read_note",
        {
          description: "Read a note",
          inputSchema: {},
          annotations: { readOnlyHint: true, destructiveHint: false },
        },
        async () => ({ content: [{ type: "text", text: "Local MCP note" }] }),
      );
      mcp.registerTool(
        "write_note",
        {
          description: "Write a note",
          inputSchema: { text: z.string() },
          annotations: { readOnlyHint: false, destructiveHint: false },
        },
        async ({ text }) => {
          writes.push(text);
          return { content: [{ type: "text", text: "Note written" }] };
        },
      );
      const transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      });
      await mcp.connect(transport);
      return transport.handleRequest(request);
    },
  });
  globalThis.fetch = Object.assign(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url === address) {
        const local = `http://127.0.0.1:${server.port}/mcp`;
        return input instanceof Request
          ? realFetch(new Request(local, input), init)
          : realFetch(local, init);
      }
      return realFetch(input, init);
    },
    { preconnect: realFetch.preconnect },
  );
  process.env.OPENAI_BASE_URL = await llm.start();
  llm.on({ predicate: () => true }, (input) => {
    const lastUser = input.messages.findLastIndex((m) => m.role === "user");
    const answered = input.messages
      .slice(lastUser + 1)
      .some((m) => m.role === "tool");
    return scriptTool && !answered
      ? {
          toolCalls: [
            {
              name: scriptTool,
              arguments:
                scriptTool === toolName
                  ? '{"text":"Approved fixture note"}'
                  : "{}",
            },
          ],
        }
      : { content: "MCP turn completed." };
  });
  deployment = await createStandalone({
    DATABASE_URL: testDatabaseUrl(),
    KEY_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
    OPENBOT_SINGLE_USER: "true",
    OPENBOT_PUBLIC_URL: origin,
    OPENBOT_APP_URL: origin,
    TENANT_PACKAGE_DIR: resolve(import.meta.dir, "../../examples/fintech"),
    BOT_PROVIDER: "openai",
    BOT_MODEL: "gpt-4.1-mini",
    OPENAI_API_KEY: "synthetic-key",
  });
  preferences = await deployment.approvals.store.policy!.preferences(
    DEV_ACTOR.id,
  );
  await deployment.approvals.setPreferences(DEV_ACTOR.id, {
    enabled: true,
    autoReview: false,
  });
  const created = await request("/api/agents", {
    name: `MCP ${crypto.randomUUID()}`,
    title: "MCP fixture",
    roleDescription: "Call the requested tool then reply briefly.",
    visibility: "private",
  });
  botId = (await created.json()).agent.id;
  const conversation = await request("/api/channels", { agentIds: [botId] });
  const channel = (await conversation.json()).channel;
  channelId = channel.id;
  threadId = channel.threadId;
});

afterAll(async () => {
  if (deployment) {
    if (approvals.length)
      await deployment.database
        .delete(approvalRequests)
        .where(inArray(approvalRequests.id, approvals));
    await deployment.database
      .delete(workItems)
      .where(
        inArray(
          sql<string>`${workItems.payload}->>'approvalId'`,
          approvals.length ? approvals : [""],
        ),
      );
    if (serverId) {
      const [row] = await deployment.database
        .select()
        .from(mcpServers)
        .where(eq(mcpServers.id, serverId));
      credentialId = row?.credentialId ?? null;
      await deployment.database
        .delete(mcpServers)
        .where(eq(mcpServers.id, serverId));
      if (credentialId)
        await deployment.database
          .delete(credentials)
          .where(eq(credentials.id, credentialId));
    }
    if (threadId)
      await deployment.database
        .delete(localThreads)
        .where(eq(localThreads.id, threadId));
    if (channelId)
      await deployment.database
        .delete(channels)
        .where(eq(channels.id, channelId));
    if (botId)
      await deployment.database.delete(agents).where(eq(agents.id, botId));
    await deployment.approvals.setPreferences(DEV_ACTOR.id, preferences);
    await deployment.close();
  }
  globalThis.fetch = realFetch;
  await server?.stop(true);
  await llm.stop();
  if (oldBase === undefined) delete process.env.OPENAI_BASE_URL;
  else process.env.OPENAI_BASE_URL = oldBase;
});

test("custom MCP registration keeps its token in the vault and reads only granted tools", async () => {
  const added = await request("/api/plugins/servers/by-url", {
    title: `Fixture ${crypto.randomUUID()}`,
    url: address,
    token,
  });
  expect(added.status).toBe(200);
  const body = await added.json();
  expect(JSON.stringify(body)).not.toContain(token);
  serverId = body.server.id;
  for (const name of ["read_note", "write_note"]) {
    const granted = await request("/api/plugins/grants", {
      kind: "mcp",
      ref: `${serverId}/${name}`,
      agentId: botId,
    });
    expect(granted.status).toBe(200);
  }
  const page = await (await request("/api/plugins")).json();
  expect(page).toMatchObject({
    builtInTools: true,
    botsMayCallBack: false,
    composioConfigured: false,
  });
  const held = await deployment.plugins.listForAgent(botId);
  toolName = held.tools.find(
    (t) => t.ref === `${serverId}/write_note`,
  )!.toolName;
  scriptTool = held.tools.find(
    (t) => t.ref === `${serverId}/read_note`,
  )!.toolName;
  await deployment.approvals.setPreferences(DEV_ACTOR.id, { enabled: false });
  const result = await deployment.runTurn({
    ownerUserId: DEV_ACTOR.id,
    routineId: "mcp-test",
    agentId: botId,
    threadId,
    instruction: "Read the note",
    initiator: PERSON_INITIATOR,
  });
  await deployment.approvals.setPreferences(DEV_ACTOR.id, { enabled: true });
  expect(result.replyText).toBe("MCP turn completed.");
  expect(writes).toHaveLength(0);
  expect((await request("/api/plugins/composio/apps")).status).toBe(404);
});

test("unsafe MCP addresses are rejected and unadvertised tools cannot be offered or called", async () => {
  expect(
    (
      await request("/api/plugins/servers/by-url", {
        title: "Unsafe",
        url: "http://127.0.0.1:1/mcp",
      })
    ).status,
  ).toBe(400);
  expect(
    (
      await request("/api/plugins/grants", {
        kind: "mcp",
        ref: `${serverId}/missing`,
        agentId: botId,
      })
    ).status,
  ).toBe(200);
  // Administrators may retain grants for withdrawn tools; the listing and call boundary still refuse them.
  expect(
    (await deployment.plugins.listForAgent(botId)).tools.some(
      (tool) => tool.ref === `${serverId}/missing`,
    ),
  ).toBe(false);
  await expect(
    deployment.plugins.callTool({
      ref: `${serverId}/missing`,
      botId,
      actorId: DEV_ACTOR.id,
      args: {},
      initiator: PERSON_INITIATOR,
    }),
  ).rejects.toThrow();
});

test("a write waits for approval and allowing once executes it exactly once then resumes durable history", async () => {
  scriptTool = toolName;
  await expect(
    deployment.runTurn({
      ownerUserId: DEV_ACTOR.id,
      routineId: "mcp-test",
      agentId: botId,
      threadId,
      instruction: "Write the fixture note",
      initiator: PERSON_INITIATOR,
    }),
  ).rejects.toBeInstanceOf(HeadlessToolSuspension);
  expect(writes).toHaveLength(0);
  const pending = await deployment.database
    .select()
    .from(approvalRequests)
    .where(
      and(
        eq(approvalRequests.ownerUserId, DEV_ACTOR.id),
        eq(approvalRequests.action, sql`${approvalRequests.action}`),
        sql`${approvalRequests.action}->>'botId' = ${botId}`,
        eq(approvalRequests.status, "pending"),
      ),
    );
  const approval = pending[0]!;
  approvals.push(approval.id);
  expect(approval.action.threadId).toBe(threadId);
  expect(
    (
      await request(`/api/approvals/${approval.id}/decision`, {
        decision: "allow_once",
      })
    ).status,
  ).toBe(200);
  await deployment.resumeApprovals();
  expect(writes).toEqual(["Approved fixture note"]);
  expect(
    (await deployment.approvals.store.get(DEV_ACTOR.id, approval.id)).status,
  ).toBe("completed");
  await deployment.resumeApprovals();
  expect(writes).toHaveLength(1);
  const history = await (
    await request(`/api/copilotkit/threads/${threadId}/messages`)
  ).json();
  expect(
    history.messages.some(
      (m: { id: string }) => m.id === `approval:${approval.id}`,
    ),
  ).toBe(true);
});

async function requestWrite(instruction: string) {
  scriptTool = toolName;
  await expect(
    deployment.runTurn({
      ownerUserId: DEV_ACTOR.id,
      routineId: "mcp-test",
      agentId: botId,
      threadId,
      instruction,
      initiator: PERSON_INITIATOR,
    }),
  ).rejects.toBeInstanceOf(HeadlessToolSuspension);
  const [pending] = await deployment.database
    .select()
    .from(approvalRequests)
    .where(
      and(
        eq(approvalRequests.ownerUserId, DEV_ACTOR.id),
        sql`${approvalRequests.action}->>'botId' = ${botId}`,
        eq(approvalRequests.status, "pending"),
      ),
    );
  expect(pending).toBeDefined();
  approvals.push(pending!.id);
  return pending!;
}

test("denying an MCP change resumes the conversation without executing the vendor", async () => {
  const approval = await requestWrite(
    "Ask again for a new note, then obey my decision.",
  );
  expect(
    (
      await request(`/api/approvals/${approval.id}/decision`, {
        decision: "deny",
      })
    ).status,
  ).toBe(200);
  await deployment.resumeApprovals();
  expect(writes).toHaveLength(1);
  expect(
    (await deployment.approvals.store.get(DEV_ACTOR.id, approval.id)).status,
  ).toBe("completed");
  await expect(
    deployment.approvals.store.get("foreign-user", approval.id),
  ).rejects.toThrow();
});

test("revoking a tool after approval was requested prevents its later execution", async () => {
  const approval = await requestWrite(
    "Try a new note with my renewed instruction.",
  );
  await deployment.plugins.revoke(
    "mcp",
    `${serverId}/write_note`,
    botId,
    DEV_ACTOR.id,
  );
  expect(
    (
      await request(`/api/approvals/${approval.id}/decision`, {
        decision: "allow_once",
      })
    ).status,
  ).toBe(200);
  await deployment.resumeApprovals();
  expect(writes).toHaveLength(1);
  const result = await deployment.approvals.store.get(
    DEV_ACTOR.id,
    approval.id,
  );
  expect(result.status).toBe("completed");
  expect(result.result?.error).toBeDefined();
});

test("pausing a Bot before a decision is consumed prevents the approved MCP change", async () => {
  await deployment.plugins.grant(
    "mcp",
    `${serverId}/write_note`,
    botId,
    DEV_ACTOR.id,
  );
  const approval = await requestWrite(
    "Request another note before I pause this Bot.",
  );
  expect((await request(`/api/bots/${botId}/pause`, {})).status).toBe(200);
  expect(
    (
      await request(`/api/approvals/${approval.id}/decision`, {
        decision: "allow_once",
      })
    ).status,
  ).toBe(200);
  await deployment.resumeApprovals();
  expect(writes).toHaveLength(1);
  const result = await deployment.approvals.store.get(
    DEV_ACTOR.id,
    approval.id,
  );
  expect(result.status).toBe("completed");
  expect(result.result?.error).toContain("paused");
  expect((await request(`/api/bots/${botId}/resume`, {})).status).toBe(200);
});
