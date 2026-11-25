import { resolve } from "node:path";
import { CopilotRuntime } from "@copilotkit/runtime/v2";
import { createCopilotHonoHandler } from "@copilotkit/runtime/v2/hono";
import { Hono } from "hono";
import { createActorAgentResolver } from "../agents/agent-resolver";
import { createAgentFetch } from "../agents/endpoint";
import { configureBotLifecycle } from "../agents/lifecycle";
import { createAgentProfileStore } from "../agents/profile-store";
import { createRuntimeAgentLoader } from "../agents/runtime-agents";
import { createApp } from "../app";
import { createAuditReader, createAuditStore } from "../audit";
import { createAuth } from "../auth";
import {
  createDevRequireUser,
  initializeDevActorUser,
} from "../auth/dev-actor";
import {
  type AppVariables,
  createRequireUser,
  createRoleRepository,
} from "../auth/guards";
import { createChannelEventHub } from "../channels/events";
import { createChannelStore } from "../channels/routes";
import { createThreadIdentity } from "../channels/thread-identity";
import { createThreadRoutes } from "../channels/thread-routes";
import { createComponentStore } from "../components/store";
import { loadConfig } from "../config";
import {
  createRequestAgents,
  markAskedRun,
  normalizeModelBaseUrls,
  runtimeModelForEnvironment,
} from "../copilot";
import {
  createCredentialAdminService,
  createCredentialStore,
  resolveModelApiKey,
} from "../credentials";
import { createDatabase } from "../db/client";
import { setEdition } from "../edition";
import { startHttpServer } from "../http-server";
import { createPeopleStore } from "../people/store";
import { createRequestActor } from "../request-actor";
import { corsOrigin } from "../request-trust";
import {
  createPackageStatusReader,
  deploymentNameOf,
  loadTenantPackage,
  synchronizeTenantPackage,
} from "../tenant-package";
import { LocalAgentRunner } from "./runner";
import { createLocalConversationStore } from "./store";

/** A deliberately small composition root; it reuses OpenBot's original stores, guards and UI. */
export async function createStandalone(
  environment: Record<string, string | undefined> = process.env,
) {
  const config = loadConfig(environment, {
    mode: "standalone",
    durableHistory: true,
  });
  setEdition(config.edition);
  const database = createDatabase(config.databaseUrl);
  configureBotLifecycle({ database });
  const audit = createAuditStore(database);
  const credentials = createCredentialStore(database);
  const vault = {
    store: credentials,
    reader: credentials,
    encryptionKey: config.keyEncryptionKey,
  };
  const profiles = createAgentProfileStore(database, undefined, vault);
  const roles = createRoleRepository(database);
  const people = createPeopleStore(
    database,
    config.auth?.initialAdminEmails ?? [],
  );
  const auth = config.auth
    ? createAuth(config, database, (email) => people.isRevoked(email), audit)
    : undefined;
  if (config.organizationAuthUrl)
    throw new Error(
      "Organization authority is not wired in this standalone milestone. Configure native authentication instead.",
    );
  await initializeDevActorUser(database, config.singleUser);
  const actors = createRequestActor({
    singleUser: config.singleUser,
    getSession: async (headers) =>
      (await auth?.api.getSession({ headers })) ?? null,
    rolesForUser: roles.rolesForUser,
  });
  const requireUser = config.singleUser
    ? createDevRequireUser(config.singleUserAccess)
    : auth
      ? createRequireUser(auth, roles)
      : (() => {
          throw new Error("Authentication is required.");
        })();
  const pkg = await loadTenantPackage(config.tenantPackageDirectory);
  await synchronizeTenantPackage(database, pkg);
  const identity = createThreadIdentity(
    config.deploymentId ?? (await deploymentNameOf(database, pkg)),
  );
  const channels = createChannelStore(database, profiles, identity);
  normalizeModelBaseUrls();
  const maxOutputTokens = Number(
    environment.STANDALONE_MAX_OUTPUT_TOKENS ?? "256",
  );
  if (
    !Number.isInteger(maxOutputTokens) ||
    maxOutputTokens < 1 ||
    maxOutputTokens > 8192
  )
    throw new Error("STANDALONE_MAX_OUTPUT_TOKENS must be between 1 and 8192.");
  const model = {
    ...runtimeModelForEnvironment(pkg.model, environment),
    maxOutputTokens,
  };
  const resolver = createActorAgentResolver({
    agentFetch: createAgentFetch({
      allowedHosts: config.agentEndpointAllowedHosts,
    }),
    loadAgents: createRuntimeAgentLoader(database, vault),
    model,
    resolveModelApiKey: () =>
      resolveModelApiKey({
        encryptionKey: config.keyEncryptionKey,
        reader: credentials,
        provider: model.provider,
        keyId: pkg.model.credentialSecretRef,
        environment,
      }),
  });
  const store = createLocalConversationStore(database);
  const runner = new LocalAgentRunner(store);
  const runtime = new CopilotRuntime({
    identifyUser: actors.identifyUser,
    agents: createRequestAgents(actors.identifyActor, resolver) as never,
    runner,
    forwardHeaders: { deny: ["authorization"], denyPrefixes: ["x-"] },
  });
  const handler = new Hono<{ Variables: AppVariables }>();
  handler.route(
    "/api/threads",
    createThreadRoutes(identity, requireUser, async (id, owner) =>
      (await store.scopeFor(id, owner)) ? "known" : "unknown",
    ),
  );
  // The SDK's local endpoint interface is synchronous. These routes read PostgreSQL directly.
  handler.get(
    "/api/copilotkit/threads/:threadId/messages",
    requireUser,
    async (c) => {
      const scope = await store.scopeFor(
        c.req.param("threadId"),
        c.var.actor.id,
      );
      if (!scope) return c.json({ messages: [] });
      const { thread } = await store.read(scope);
      return c.json({ messages: thread.snapshot.messages });
    },
  );
  handler.get(
    "/api/copilotkit/threads/:threadId/state",
    requireUser,
    async (c) => {
      const scope = await store.scopeFor(
        c.req.param("threadId"),
        c.var.actor.id,
      );
      return c.json({
        state: scope ? (await store.read(scope)).thread.snapshot.state : null,
      });
    },
  );
  handler.route(
    "/",
    createCopilotHonoHandler({
      runtime,
      basePath: "/api/copilotkit",
      cors: { origin: corsOrigin(config) },
      hooks: {
        onBeforeHandler: ({ request, route }) => markAskedRun(request, route),
      },
    }),
  );
  const app = createApp(
    config,
    auth,
    roles,
    createAuditReader(database),
    createCredentialAdminService(config.keyEncryptionKey, credentials, audit, {
      provider: model.provider,
      keyId: pkg.model.credentialSecretRef,
    }),
    createPackageStatusReader(database),
    new Hono().route("/", handler),
    undefined,
    undefined,
    profiles,
    channels,
    createChannelEventHub(),
    audit,
    createComponentStore(database),
    undefined,
    undefined,
    undefined,
    people,
  );
  return { app, config, database, profiles, actors, runner, store };
}

export async function startStandalone() {
  const deployment = await createStandalone({
    ...process.env,
    TENANT_PACKAGE_DIR:
      process.env.TENANT_PACKAGE_DIR ??
      resolve(import.meta.dir, "../../../examples/fintech"),
  });
  const server = startHttpServer({
    port: deployment.config.port,
    config: deployment.config,
    resolveRequestActor: deployment.actors.resolveRequestActor,
    agentProfileStore: deployment.profiles,
    computerGateway: undefined,
    app: deployment.app,
  });
  console.info(
    JSON.stringify({
      type: "standalone-ready",
      port: deployment.config.port,
      mode: "standalone",
      unavailable: [
        "automatic-learning",
        "recorder",
        "tasks",
        "routines",
        "computer",
        "integrations",
      ],
    }),
  );
  const close = async () => {
    await server.stop(true);
    await deployment.database.$client.close();
    process.exit(0);
  };
  process.once("SIGINT", () => void close());
  process.once("SIGTERM", () => void close());
}
