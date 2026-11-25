/** Opt-in LIVE HTTP validation; synthetic key, dedicated test DB, no model call or paid API. */
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { and, eq, gte } from "drizzle-orm";
import { createExecutorHandler } from "../../services/integration-executor/src/server";
import { DEV_ACTOR } from "../src/auth/dev-actor";
import {
  agents,
  auditEvents,
  credentials,
  mcpServers,
  mcpUserCredentials,
} from "../src/db/schema";

import { testDatabaseUrl } from "../tests/support/database";

if (process.env.PLUGUEME_LIVE_REST_TEST !== "1")
  throw new Error(
    "Set PLUGUEME_LIVE_REST_TEST=1 to permit the public test request",
  );
process.env.COPILOTKIT_TELEMETRY_DISABLED = "true";
const { createStandalone } = await import("../src/standalone/bootstrap");
const db = testDatabaseUrl();
if (!new URL(db).pathname.endsWith("_test"))
  throw new Error("A dedicated _test database is required");
const startedAt = new Date();
const secret = randomBytes(32).toString("hex");
const token = randomBytes(24).toString("hex");
process.env.PLUGUEME_INTEGRATION_SECRET = secret;
const executor = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  fetch: createExecutorHandler({
    PLUGUEME_INTEGRATION_SECRET: secret,
    PLUGUEME_REST_BASE_URL: "https://httpbin.org",
  }),
});
process.env.PLUGUEME_INTEGRATION_URL = `http://127.0.0.1:${executor.port}`;
const origin = "http://127.0.0.1:3039";
const deployment = await createStandalone({
  DATABASE_URL: db,
  KEY_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
  OPENBOT_SINGLE_USER: "true",
  OPENBOT_PUBLIC_URL: origin,
  OPENBOT_APP_URL: origin,
  TENANT_PACKAGE_DIR: resolve(import.meta.dir, "../../examples/fintech"),
  BOT_PROVIDER: "openai",
  BOT_MODEL: "gpt-4.1-mini",
  OPENAI_API_KEY: "synthetic-unused-model-key",
});
let addedConnector = false;
let botId = "";
let credentialId = "";
const request = (path: string, body?: unknown, method = "POST") =>
  deployment.app.request(`${origin}${path}`, {
    method,
    headers: { origin, "content-type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};
try {
  const existing = await deployment.database
    .select()
    .from(mcpServers)
    .where(eq(mcpServers.id, "integration-rest"));
  assert(existing.length === 0, "Use an empty integration test database");
  const created = await request("/api/agents", {
    name: "REST live validation",
    title: "Test only",
    roleDescription: "Test REST permissions",
    visibility: "private",
  });
  assert(created.status === 201, "Could not create test Bot");
  botId = (await created.json()).agent.id;
  const added = await request("/api/plugins/servers", {
    key: "integration-rest",
  });
  assert(added.status === 200, "Could not add REST connector");
  addedConnector = true;
  const connected = await request(
    "/api/plugins/servers/integration-rest/api-key",
    { key: token },
  );
  assert(
    connected.status === 200 && !(await connected.text()).includes(token),
    "Could not save key safely",
  );
  const [held] = await deployment.database
    .select()
    .from(mcpUserCredentials)
    .where(eq(mcpUserCredentials.serverId, "integration-rest"));
  credentialId = held.credentialId;
  const [encrypted] = await deployment.database
    .select()
    .from(credentials)
    .where(eq(credentials.id, credentialId));
  assert(
    encrypted.encryptedValue !== token &&
      !encrypted.encryptedValue.includes(token),
    "Key was not encrypted",
  );
  let blocked = false;
  try {
    await deployment.plugins.callTool({
      ref: "integration-rest/get",
      botId,
      actorId: DEV_ACTOR.id,
      args: { path: "/bearer" },
    });
  } catch {
    blocked = true;
  }
  assert(blocked, "An ungranted call was allowed");
  const granted = await request("/api/plugins/grants", {
    kind: "mcp",
    ref: "integration-rest/get",
    agentId: botId,
  });
  assert(granted.status === 200, "Could not grant read tool");
  // The REST GET is reviewed and read-only; no approval bypass is needed.
  const result = await deployment.plugins.callTool({
    ref: "integration-rest/get",
    botId,
    actorId: DEV_ACTOR.id,
    args: { path: "/bearer" },
  });
  assert(!result.isError, "REST endpoint failed");
  const response = JSON.parse(result.text);
  assert(
    response.authenticated === true && !result.text.includes(token),
    "Remote bearer authentication or redaction failed",
  );
  await request(
    "/api/plugins/servers/integration-rest/api-key",
    undefined,
    "DELETE",
  );
  blocked = false;
  try {
    await deployment.plugins.callTool({
      ref: "integration-rest/get",
      botId,
      actorId: DEV_ACTOR.id,
      args: { path: "/bearer" },
    });
  } catch {
    blocked = true;
  }
  assert(blocked, "Removed key was still usable");
  const audit = await deployment.database
    .select()
    .from(auditEvents)
    .where(
      and(
        eq(auditEvents.targetId, "integration-rest/get"),
        gte(auditEvents.createdAt, startedAt),
      ),
    );
  assert(
    audit.some((event) => event.eventType === "mcp.call_succeeded"),
    "Successful call audit was not recorded",
  );
  assert(
    audit.some((event) => event.eventType === "mcp.call_rejected"),
    "Rejected call audit was not recorded",
  );
  assert(!JSON.stringify(audit).includes(token), "Audit leaked key");
  console.info(
    JSON.stringify({
      type: "live-rest-validation",
      status: "passed",
      vendor: "httpbin.org",
      vault: true,
      grants: true,
      bearerAuthenticated: true,
      redacted: true,
      revoked: true,
      modelCalls: 0,
    }),
  );
} finally {
  if (addedConnector)
    await deployment.database
      .delete(mcpServers)
      .where(eq(mcpServers.id, "integration-rest"));
  if (credentialId)
    await deployment.database
      .delete(credentials)
      .where(eq(credentials.id, credentialId));
  if (botId)
    await deployment.database.delete(agents).where(eq(agents.id, botId));
  await deployment.close();
  await executor.stop(true);
}
