import { resolve } from "node:path";
import { CopilotRuntime } from "@copilotkit/runtime/v2";
import { createCopilotHonoHandler } from "@copilotkit/runtime/v2/hono";
import { TURN_LIMITS } from "@openbot/toolkit/limits";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { createActivityStore } from "../activity/activity";
import { headlessTurnRefusal } from "../admin/controls";
import { createActorAgentResolver } from "../agents/agent-resolver";
import { createAgentFetch } from "../agents/endpoint";
import {
  BOT_PAUSED_REASON,
  configureBotLifecycle,
  createBotLifecycleStore,
  isBotPaused,
} from "../agents/lifecycle";
import { createBotReset } from "../agents/lifecycle-reset";
import { createBotLifecycleRoutes } from "../agents/lifecycle-routes";
import { createAgentProfileStore } from "../agents/profile-store";
import type { AgentActor } from "../agents/profile-types";
import { createRuntimeAgentLoader } from "../agents/runtime-agents";
import { serverTurnAdmission } from "../agents/turn-admission";
import { createWakeUpStore } from "../agents/wake-up";
import { createApp } from "../app";
import { createApprovedActionExecutor } from "../approvals/execute";
import { createApprovalResumeTick } from "../approvals/resume-sweep";
import { createApprovalRoutes } from "../approvals/routes";
import { createApprovalService } from "../approvals/service";
import { createApprovalStore } from "../approvals/store";
import { ApprovalRefusedError } from "../approvals/types";
import {
  createAuditReader,
  createAuditStore,
  PERSON_INITIATOR,
} from "../audit";
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
import {
  createChannelEventHub,
  startChannelActivityListener,
} from "../channels/events";
import { createChannelStore } from "../channels/routes";
import { createThreadIdentity } from "../channels/thread-identity";
import { createThreadRoutes } from "../channels/thread-routes";
import { createComponentStore } from "../components/store";
import {
  createPolicyStore,
  DEFAULT_ACTION_POLICY,
} from "../computer/policy-store";
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
import {
  brokeredConnections,
  intelligenceChannelMappings,
  users,
} from "../db/schema";
import { setEdition } from "../edition";
import { startHttpServer } from "../http-server";
import { createMemoryIngestion } from "../memory/ingestion";
import { createMemoryRoutes } from "../memory/routes";
import { createMemoryStore } from "../memory/store";
import { createPeopleStore } from "../people/store";
import { redirectUriFor } from "../plugins/oauth";
import { storedProvider } from "../plugins/provider-wiring";
import { createPluginRoutes } from "../plugins/routes";
import { createPluginStore } from "../plugins/store";
import { grantedTools, REFUSAL_MARKER, vendorAnswer } from "../plugins/tools";
import {
  createPrivateShareCheck,
  PRIVATE_SHARE_TOOL_REF,
} from "../proactive/private-share";
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
  const channelEvents = createChannelEventHub();
  // Reuse the local MIT store. No Intelligence client or broker is constructed.
  const memory = createMemoryStore(database);
  const approvals = createApprovalService(createApprovalStore(database));
  const policy = createPolicyStore(
    config.computer?.policy ?? DEFAULT_ACTION_POLICY,
    database,
  );
  await policy.load();
  // No broker is activated. The name below only identifies existing broker-owned rows.
  const brokerProvider = storedProvider(
    { kind: "unconfigured" },
    (
      await database
        .selectDistinct({ provider: brokeredConnections.provider })
        .from(brokeredConnections)
    ).map((row) => row.provider),
  );
  const nativePlugins = createPluginStore({
    database,
    auditStore: audit,
    credentials,
    encryptionKey: config.keyEncryptionKey,
    brokerProvider,
    policy: policy.get,
    approvalGate: approvals.gate,
    privateShareCheck: createPrivateShareCheck({ approvals: approvals.store }),
    redirectUri: config.publicUrl
      ? redirectUriFor(config.publicUrl)
      : undefined,
  });
  const plugins = {
    ...nativePlugins,
    callTool: async (...args: Parameters<typeof nativePlugins.callTool>) => {
      // Current policy is authoritative on every call; a failed read prevents vendor execution.
      await policy.refresh();
      return nativePlugins.callTool(...args);
    },
  };
  const memoryIngestion = createMemoryIngestion({
    store: memory,
    plugins,
    canUseBot: async (owner, bot) =>
      (await profiles.get(await actorFor(owner), bot)) !== null,
  });
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
    loadToolsForActor:
      (actorId, initiator = PERSON_INITIATOR) =>
      async (botId) =>
        grantedTools({ store: plugins, actorId, botId, initiator }),
    loadPersonalMemoryForActor: (owner) => (bot) =>
      memoryIngestion.contextFor(owner, bot),
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
  const sourceFor = async (run: {
    actorId: string;
    botId: string;
    threadId: string;
  }) => {
    if (await isBotPaused(run.actorId, run.botId)) return null;
    const actor = await actorFor(run.actorId);
    const [mapping] = await database
      .select()
      .from(intelligenceChannelMappings)
      .where(
        and(
          eq(intelligenceChannelMappings.userId, run.actorId),
          eq(intelligenceChannelMappings.threadId, run.threadId),
        ),
      )
      .limit(1);
    if (!mapping) return null;
    const channel = await channels.get(actor, mapping.channelId);
    const profile = await profiles.get(actor, run.botId);
    return channel?.agentIds.includes(run.botId) && profile
      ? { channelId: channel.id, botId: run.botId }
      : null;
  };
  const executeApprovedAction = createApprovedActionExecutor({
    sourceFor,
    gate: approvals.gate,
    callTool: async (input) => {
      if (
        !(await sourceFor({
          actorId: input.actorId,
          botId: input.botId,
          threadId: input.threadId ?? "",
        }))
      )
        throw new ApprovalRefusedError(
          "This conversation is no longer available.",
        );
      return plugins.callTool(input);
    },
    credentialActorFor: async (actorId) => actorId,
    answer: vendorAnswer,
    privateShareToolRef: PRIVATE_SHARE_TOOL_REF,
    refusalMarker: REFUSAL_MARKER,
    personInitiator: PERSON_INITIATOR,
  });
  const resumeApprovalTick = createApprovalResumeTick({
    approvalQueue: createWorkQueue(database),
    approvalOwner: `standalone-approvals:${crypto.randomUUID()}`,
    approvalService: approvals,
    executeApprovedAction,
    refusal: async (action) =>
      (await isBotPaused(action.actorId, action.botId))
        ? BOT_PAUSED_REASON
        : headlessTurnRefusal({
            ownerUserId: action.actorId,
            agentId: action.botId,
            threadId: action.threadId,
          }),
    database,
    approvalContinuationRunner: runTurn,
    channelStore: channels,
    actorFor,
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
  const resumeApprovals = () => track(resumeApprovalTick());
  const syncMemory = () => track(memoryIngestion.syncDue());
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
  handler.route("/api/approvals", createApprovalRoutes(approvals, requireUser));
  handler.route(
    "/api/plugins",
    createPluginRoutes(
      plugins,
      requireUser,
      async (actor, botId) => (await profiles.get(actor, botId)) !== null,
      {
        encryptionKey: config.keyEncryptionKey,
        publicUrl: config.publicUrl,
        builtInTools: true,
        appUrl: config.appUrl,
        personHasAccess: async (id) => {
          try {
            await actorFor(id);
            return true;
          } catch {
            return false;
          }
        },
      },
    ),
  );
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
    createMemoryRoutes(memory, memoryIngestion, requireUser),
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
    channelEvents,
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
    plugins,
    approvals,
    resumeApprovals,
    syncMemory,
    channelEvents,
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
  const activityListener = await startChannelActivityListener(
    deployment.config.databaseUrl,
    deployment.channelEvents,
  );
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
  // Approval decisions must not wait behind a long-running task or scheduled turn.
  const approvalSchedule = repeatAfterEach(
    () => deployment.resumeApprovals(),
    2_000,
  );
  const memorySchedule = repeatAfterEach(() => deployment.syncMemory(), 60_000);
  console.info(
    JSON.stringify({
      type: "standalone-ready",
      port: deployment.config.port,
      mode: "standalone",
      unavailable: ["automatic-learning", "recorder", "computer"],
    }),
  );
  const close = async () => {
    schedule.stop();
    approvalSchedule.stop();
    memorySchedule.stop();
    await server.stop(true);
    await activityListener.stop();
    await deployment.close();
    process.exit(0);
  };
  process.once("SIGINT", () => void close());
  process.once("SIGTERM", () => void close());
}
