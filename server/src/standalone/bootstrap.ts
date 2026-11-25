import { resolve } from "node:path";
import { CopilotRuntime } from "@copilotkit/runtime/v2";
import { createCopilotHonoHandler } from "@copilotkit/runtime/v2/hono";
import { TURN_LIMITS } from "@openbot/toolkit/limits";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { createActivityStore } from "../activity/activity";
import { createActorAgentResolver } from "../agents/agent-resolver";
import { createAgentFetch } from "../agents/endpoint";
import {
  configureBotLifecycle,
  createBotLifecycleStore,
} from "../agents/lifecycle";
import { createBotReset } from "../agents/lifecycle-reset";
import { createBotLifecycleRoutes } from "../agents/lifecycle-routes";
import { createAgentProfileStore } from "../agents/profile-store";
import type { AgentActor } from "../agents/profile-types";
import { createRuntimeAgentLoader } from "../agents/runtime-agents";
import { serverTurnAdmission } from "../agents/turn-admission";
import { createWakeUpStore } from "../agents/wake-up";
import { createApp } from "../app";
import { createAuditReader, createAuditStore } from "../audit";
import { createAuth } from "../auth";
import {
  createDevRequireUser,
  DEV_ACTOR,
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
import { users } from "../db/schema";
import { setEdition } from "../edition";
import { startHttpServer } from "../http-server";
import { quoteMemoryContext } from "../memory/ingestion";
import { createMemoryRoutes } from "../memory/routes";
import { createMemoryStore } from "../memory/store";
import { createPeopleStore } from "../people/store";
import { createRequestActor } from "../request-actor";
import { corsOrigin } from "../request-trust";
import { createRoutineRoutes } from "../routines/routes";
import { createRoutineRunner } from "../routines/runner";
import { createRoutineStore } from "../routines/store";
import { dispatchClaimedRoutines, offerDueRoutines } from "../routines/sweep";
import { createTaskRoutes } from "../tasks/routes";
import { createTaskRunner } from "../tasks/runner";
import { createTaskStore } from "../tasks/store";
import { createTaskTurn } from "../tasks/turn";
import {
  createPackageStatusReader,
  deploymentNameOf,
  loadTenantPackage,
  synchronizeTenantPackage,
} from "../tenant-package";
import { repeatAfterEach } from "../work/loop";
import { createWorkQueue } from "../work/queue";
import { LocalAgentRunner } from "./runner";
import { createLocalConversationStore } from "./store";
import { createLocalTurnRunner } from "./turn";

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
  // Reuse the local MIT store. No Intelligence client or broker is constructed.
  const memory = createMemoryStore(database);
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
    loadPersonalMemoryForActor: (owner) => (bot) =>
      memory
        .retrieve(owner, [], "", { botId: bot, heldServerIds: new Set() })
        .then(quoteMemoryContext),
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
  const actorFor = async (id: string): Promise<AgentActor> => {
    if (config.singleUser && id === DEV_ACTOR.id) return DEV_ACTOR;
    const [user] = await database
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    if (!user || (await people.isRevoked(user.email)))
      throw new Error("The owner is no longer authorized.");
    const assigned = await roles.rolesForUser(id);
    if (!assigned.includes("admin") && !assigned.includes("user"))
      throw new Error("The owner is no longer authorized.");
    return { id, role: assigned.includes("admin") ? "admin" : "user" };
  };
  const runTurn = createLocalTurnRunner({
    runner,
    store,
    admission: serverTurnAdmission,
    buildAgentFor: async ({ ownerUserId, agentId, initiator, depth }) => {
      const actor = await actorFor(ownerUserId);
      const profile = await profiles.get(actor, agentId);
      if (!profile || profile.endpoint)
        throw new Error(
          "Headless turns currently require an available built-in Bot.",
        );
      return resolver.resolveAgentForActor(actor, agentId, {
        initiator,
        depth,
      });
    },
  });
  const routines = createRoutineStore(database);
  const tasks = createTaskStore(database);
  const taskRunner = createTaskRunner({
    database,
    store: tasks,
    channels,
    actorFor,
    queue: createWorkQueue(database),
    owner: `standalone-tasks:${crypto.randomUUID()}`,
    scopeFor: async (ownerUserId, channelId, agentId) => {
      const actor = await actorFor(ownerUserId);
      const channel = await channels.get(actor, channelId);
      const profile = await profiles.get(actor, agentId);
      if (!channel || !profile || !channel.agentIds.includes(agentId))
        return null;
      return { ownerUserId, channelId, agentId, threadId: channel.threadId };
    },
    runTask: createTaskTurn({ channels, actorFor, runTurn }),
  });
  const background = new Set<Promise<unknown>>();
  const track = <T>(work: Promise<T>): Promise<T> => {
    background.add(work);
    void work.then(
      () => background.delete(work),
      () => background.delete(work),
    );
    return work;
  };
  const routineExecutor = createRoutineRunner({
    routineStore: routines,
    channelStore: channels,
    runTurn,
  });
  const routineRunner = { run: (id: string) => track(routineExecutor.run(id)) };
  const routineSweep = {
    routineStore: routines,
    queue: createWorkQueue(database),
    owner: `standalone:${crypto.randomUUID()}`,
    // Completion is awaited: the queue lease and routine outcome stay tied to the actual turn.
    dispatch: (id: string) => routineRunner.run(id),
    limit: 1,
    leaseMs: TURN_LIMITS.turnTimeoutMs + TURN_LIMITS.abortGraceMs + 60_000,
  };
  const sweep = () =>
    track(
      (async () => {
        await taskRunner.sweep();
        await offerDueRoutines(routineSweep);
        return dispatchClaimedRoutines(routineSweep);
      })(),
    );
  const close = async () => {
    await runner.close();
    await taskRunner.idle();
    while (background.size) await Promise.allSettled([...background]);
    await database.$client.close();
  };
  const runtime = new CopilotRuntime({
    identifyUser: actors.identifyUser,
    agents: createRequestAgents(actors.identifyActor, resolver) as never,
    runner,
    forwardHeaders: { deny: ["authorization"], denyPrefixes: ["x-"] },
  });
  const handler = new Hono<{ Variables: AppVariables }>();
  handler.route(
    "/api/bots",
    createBotLifecycleRoutes(
      {
        lifecycle: createBotLifecycleStore(database),
        reset: createBotReset({
          database,
          softDeleteChannel: (actor, id) => channels.softDelete(actor, id),
        }),
        activity: createActivityStore(database),
        wakeUps: createWakeUpStore(database, { auditStore: audit }),
        profiles,
        tasks: taskRunner,
        auditStore: audit,
      },
      requireUser,
    ),
  );
  handler.route("/api/tasks", createTaskRoutes(tasks, taskRunner, requireUser));
  handler.route(
    "/api/routines",
    createRoutineRoutes(routines, requireUser, {
      runner: routineRunner,
      auditStore: audit,
    }),
  );
  handler.route(
    "/api/memory",
    createMemoryRoutes(memory, undefined, requireUser),
  );
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
  return {
    app,
    config,
    database,
    profiles,
    actors,
    runner,
    store,
    memory,
    routines,
    routineRunner,
    runTurn,
    sweep,
    tasks,
    taskRunner,
    close,
  };
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
  const schedule = repeatAfterEach(async () => {
    try {
      await deployment.sweep();
    } catch (error) {
      console.error(
        JSON.stringify({
          type: "standalone-sweep-error",
          error: error instanceof Error ? error.name : "UnknownError",
        }),
      );
    }
  }, 30_000);
  console.info(
    JSON.stringify({
      type: "standalone-ready",
      port: deployment.config.port,
      mode: "standalone",
      unavailable: [
        "automatic-learning",
        "recorder",
        "computer",
        "integrations",
      ],
    }),
  );
  const close = async () => {
    schedule.stop();
    await server.stop(true);
    await deployment.close();
    process.exit(0);
  };
  process.once("SIGINT", () => void close());
  process.once("SIGTERM", () => void close());
}
