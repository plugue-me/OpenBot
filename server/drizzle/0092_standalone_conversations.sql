CREATE TABLE "local_events" (
	"thread_id" text NOT NULL,
	"run_id" text NOT NULL,
	"sequence" integer NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "local_events_thread_id_run_id_sequence_pk" PRIMARY KEY("thread_id","run_id","sequence")
);
--> statement-breakpoint
CREATE TABLE "local_runs" (
	"thread_id" text NOT NULL,
	"id" text NOT NULL,
	"status" text NOT NULL,
	"lease_until" timestamp with time zone NOT NULL,
	"next_sequence" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	CONSTRAINT "local_runs_thread_id_id_pk" PRIMARY KEY("thread_id","id"),
	CONSTRAINT "local_runs_status_check" CHECK ("local_runs"."status" IN ('running', 'completed', 'failed', 'cancelled', 'interrupted'))
);
--> statement-breakpoint
CREATE TABLE "local_threads" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"agent_id" text NOT NULL,
	"snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "local_events" ADD CONSTRAINT "local_events_thread_id_local_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."local_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "local_runs" ADD CONSTRAINT "local_runs_thread_id_local_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."local_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "local_runs_active_idx" ON "local_runs" USING btree ("thread_id") WHERE "local_runs"."status" = 'running';--> statement-breakpoint
CREATE INDEX "local_threads_owner_idx" ON "local_threads" USING btree ("owner_id","updated_at");