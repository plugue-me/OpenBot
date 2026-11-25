import type { BaseEvent, Message } from "@ag-ui/client";
import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { jsonb } from "./json";

export type LocalSnapshot = {
  messages: Message[];
  state: Record<string, unknown>;
};
export type LocalRunStatus =
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "interrupted";

// Owner and agent ids are immutable. No server/anonymous fallback is accepted by the store.
// A thread's lifetime is independent of a Bot being removed: its audit history must survive.
export const localThreads = pgTable(
  "local_threads",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    agentId: text("agent_id").notNull(),
    snapshot: jsonb("snapshot").$type<LocalSnapshot>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("local_threads_owner_idx").on(t.ownerId, t.updatedAt)],
);

export const localRuns = pgTable(
  "local_runs",
  {
    threadId: text("thread_id")
      .notNull()
      .references(() => localThreads.id, { onDelete: "cascade" }),
    id: text("id").notNull(),
    status: text("status").$type<LocalRunStatus>().notNull(),
    leaseUntil: timestamp("lease_until", { withTimezone: true }).notNull(),
    nextSequence: integer("next_sequence").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [
    primaryKey({ columns: [t.threadId, t.id] }),
    index("local_runs_active_idx")
      .on(t.threadId)
      .where(sql`${t.status} = 'running'`),
    check(
      "local_runs_status_check",
      sql`${t.status} IN ('running', 'completed', 'failed', 'cancelled', 'interrupted')`,
    ),
  ],
);

export const localEvents = pgTable(
  "local_events",
  {
    threadId: text("thread_id")
      .notNull()
      .references(() => localThreads.id, { onDelete: "cascade" }),
    runId: text("run_id").notNull(),
    sequence: integer("sequence").notNull(),
    payload: jsonb("payload").$type<BaseEvent>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.threadId, t.runId, t.sequence] })],
);
