import type { BaseEvent } from "@ag-ui/client";
import { and, asc, eq, gt, sql } from "drizzle-orm";
import type { Database } from "../db/client";
import {
  type LocalRunStatus,
  type LocalSnapshot,
  localEvents,
  localRuns,
  localThreads,
} from "../db/schema/standalone";

export class LocalThreadDenied extends Error {
  readonly code = "THREAD_ACCESS_DENIED";
  constructor() {
    super("This conversation is not available to this owner and agent.");
  }
}
export class LocalRunBusy extends Error {
  readonly code = "THREAD_ALREADY_RUNNING";
  constructor() {
    super("This conversation already has an active run.");
  }
}
export class LocalRunLost extends Error {
  constructor() {
    super("This run no longer owns the conversation lease.");
  }
}
export class LocalRunExists extends Error {
  constructor() {
    super(
      "This run id was already used. Reconnect instead of running it again.",
    );
  }
}

export type LocalThreadScope = {
  threadId: string;
  ownerId: string;
  agentId: string;
};
export type LocalRunScope = LocalThreadScope & { runId: string };

/**
 * Durable storage only; it does not grant Bot access. The host must resolve the authenticated
 * actor's Bot before calling claim. Every read and write additionally checks immutable ownership.
 * All mutations lock the thread row, including across pools and server processes.
 */
export function createLocalConversationStore(database: Database) {
  type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
  const valid = (scope: LocalThreadScope) => {
    if (
      [scope.threadId, scope.ownerId, scope.agentId].some(
        (v) => !v.trim() || v.includes("\0"),
      )
    )
      throw new LocalThreadDenied();
  };
  const lease = (seconds: number) => {
    if (!Number.isInteger(seconds) || seconds < 1 || seconds > 3600)
      throw new TypeError(
        "Lease duration must be an integer between 1 and 3600 seconds.",
      );
    return sql`now() + ${seconds} * interval '1 second'`;
  };
  const owned = async (tx: Transaction, scope: LocalThreadScope) => {
    valid(scope);
    const [thread] = await tx
      .select()
      .from(localThreads)
      .where(eq(localThreads.id, scope.threadId))
      .for("update");
    if (
      !thread ||
      thread.ownerId !== scope.ownerId ||
      thread.agentId !== scope.agentId
    )
      throw new LocalThreadDenied();
    return thread;
  };
  const active = async (tx: Transaction, scope: LocalRunScope) => {
    await owned(tx, scope);
    const [run] = await tx
      .select()
      .from(localRuns)
      .where(
        and(
          eq(localRuns.threadId, scope.threadId),
          eq(localRuns.id, scope.runId),
          eq(localRuns.status, "running"),
          gt(localRuns.leaseUntil, sql`now()`),
        ),
      );
    if (!run) throw new LocalRunLost();
    return run;
  };
  const event = async (
    tx: Transaction,
    scope: LocalRunScope,
    sequence: number,
    payload: BaseEvent,
  ) => {
    await tx.insert(localEvents).values({
      threadId: scope.threadId,
      runId: scope.runId,
      sequence,
      payload,
    });
  };

  return {
    async exists(threadId: string) {
      const [thread] = await database
        .select({ id: localThreads.id })
        .from(localThreads)
        .where(eq(localThreads.id, threadId));
      return thread !== undefined;
    },
    /** Resolve a thread without disclosing its existence to another owner. */
    async scopeFor(
      threadId: string,
      ownerId: string,
    ): Promise<LocalThreadScope | undefined> {
      const [thread] = await database
        .select({ agentId: localThreads.agentId })
        .from(localThreads)
        .where(
          and(eq(localThreads.id, threadId), eq(localThreads.ownerId, ownerId)),
        );
      return thread
        ? { threadId, ownerId, agentId: thread.agentId }
        : undefined;
    },
    async claim(scope: LocalRunScope, seconds = 60) {
      valid(scope);
      if (!scope.runId.trim()) throw new TypeError("A run id is required.");
      const until = lease(seconds);
      return database.transaction(async (tx) => {
        await tx
          .insert(localThreads)
          .values({
            id: scope.threadId,
            ownerId: scope.ownerId,
            agentId: scope.agentId,
            snapshot: { messages: [], state: {} },
          })
          .onConflictDoNothing();
        const thread = await owned(tx, scope);
        const [existing] = await tx
          .select()
          .from(localRuns)
          .where(
            and(
              eq(localRuns.threadId, scope.threadId),
              eq(localRuns.id, scope.runId),
            ),
          );
        if (existing) throw new LocalRunExists();
        const running = await tx
          .select({
            id: localRuns.id,
            nextSequence: localRuns.nextSequence,
            live: sql<boolean>`${localRuns.leaseUntil} > now()`,
          })
          .from(localRuns)
          .where(
            and(
              eq(localRuns.threadId, scope.threadId),
              eq(localRuns.status, "running"),
            ),
          );
        if (running.some((run) => run.live)) throw new LocalRunBusy();
        // A dead worker is recorded as interrupted. No automatic replay of tool side effects.
        for (const run of running) {
          await event(tx, { ...scope, runId: run.id }, run.nextSequence, {
            type: "RUN_ERROR",
            code: "LOCAL_RUN_INTERRUPTED",
            message:
              "The execution lease expired. Review tool outcomes before retrying.",
          } as BaseEvent);
          await tx
            .update(localRuns)
            .set({
              status: "interrupted",
              finishedAt: sql`now()`,
              nextSequence: run.nextSequence + 1,
            })
            .where(
              and(
                eq(localRuns.threadId, scope.threadId),
                eq(localRuns.id, run.id),
              ),
            );
        }
        await tx.insert(localRuns).values({
          threadId: scope.threadId,
          id: scope.runId,
          status: "running",
          leaseUntil: until,
        });
        return thread.snapshot;
      });
    },

    async renew(scope: LocalRunScope, seconds = 60) {
      const until = lease(seconds);
      await database.transaction(async (tx) => {
        await active(tx, scope);
        await tx
          .update(localRuns)
          .set({ leaseUntil: until })
          .where(
            and(
              eq(localRuns.threadId, scope.threadId),
              eq(localRuns.id, scope.runId),
            ),
          );
      });
    },

    async append(
      scope: LocalRunScope,
      payload: BaseEvent,
      snapshot?: LocalSnapshot,
    ) {
      return database.transaction(async (tx) => {
        const run = await active(tx, scope);
        await event(tx, scope, run.nextSequence, payload);
        await tx
          .update(localRuns)
          .set({ nextSequence: run.nextSequence + 1 })
          .where(
            and(
              eq(localRuns.threadId, scope.threadId),
              eq(localRuns.id, scope.runId),
            ),
          );
        await tx
          .update(localThreads)
          .set({ ...(snapshot ? { snapshot } : {}), updatedAt: sql`now()` })
          .where(eq(localThreads.id, scope.threadId));
        return run.nextSequence;
      });
    },

    async finish(
      scope: LocalRunScope,
      status: Exclude<LocalRunStatus, "running" | "interrupted">,
      snapshot: LocalSnapshot,
    ) {
      await database.transaction(async (tx) => {
        await active(tx, scope);
        await tx
          .update(localRuns)
          .set({ status, finishedAt: sql`now()` })
          .where(
            and(
              eq(localRuns.threadId, scope.threadId),
              eq(localRuns.id, scope.runId),
            ),
          );
        await tx
          .update(localThreads)
          .set({ snapshot, updatedAt: sql`now()` })
          .where(eq(localThreads.id, scope.threadId));
      });
    },

    async read(scope: LocalThreadScope) {
      return database.transaction(async (tx) => {
        const thread = await owned(tx, scope);
        const runs = await tx
          .select()
          .from(localRuns)
          .where(eq(localRuns.threadId, scope.threadId))
          .orderBy(asc(localRuns.createdAt), asc(localRuns.id));
        return { thread, runs };
      });
    },

    async events(scope: LocalRunScope, afterSequence = -1, limit = 500) {
      if (
        !Number.isInteger(afterSequence) ||
        afterSequence < -1 ||
        !Number.isInteger(limit) ||
        limit < 1 ||
        limit > 1000
      )
        throw new TypeError("Invalid event cursor or page size.");
      return database.transaction(async (tx) => {
        await owned(tx, scope);
        return tx
          .select()
          .from(localEvents)
          .where(
            and(
              eq(localEvents.threadId, scope.threadId),
              eq(localEvents.runId, scope.runId),
              gt(localEvents.sequence, afterSequence),
            ),
          )
          .orderBy(asc(localEvents.sequence))
          .limit(limit);
      });
    },
  };
}
