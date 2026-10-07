CREATE TYPE "public"."dept" AS ENUM('ve_sinh', 'ky_thuat', 'bql');--> statement-breakpoint
CREATE TYPE "public"."place" AS ENUM('floor', 'lobby', 'lift', 'common');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('resident', 'reception', 'management', 'cleaning', 'technical');--> statement-breakpoint
CREATE TABLE "history" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticket_id" integer NOT NULL,
	"label" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"actor_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "keywords" (
	"id" serial PRIMARY KEY NOT NULL,
	"dept" "dept" NOT NULL,
	"word" text NOT NULL,
	CONSTRAINT "keywords_dept_word_uq" UNIQUE("dept","word")
);
--> statement-breakpoint
CREATE TABLE "materials" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticket_id" integer NOT NULL,
	"item" text NOT NULL,
	"requested_by" integer NOT NULL,
	"staff_id" integer,
	"received" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notices" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "photos" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticket_id" integer NOT NULL,
	"name" text NOT NULL,
	"mime" text NOT NULL,
	"size" integer NOT NULL,
	"data" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ratings" (
	"ticket_id" integer PRIMARY KEY NOT NULL,
	"stars" smallint NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"comment" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ratings_stars_ck" CHECK ("ratings"."stars" between 1 and 5)
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff" (
	"id" serial PRIMARY KEY NOT NULL,
	"dept" "dept" NOT NULL,
	"name" text NOT NULL,
	"skill" text,
	"area" text,
	"capacity" integer,
	CONSTRAINT "staff_dept_name_uq" UNIQUE("dept","name")
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" serial PRIMARY KEY NOT NULL,
	"resident_id" integer NOT NULL,
	"description" text NOT NULL,
	"location" text NOT NULL,
	"place" "place" NOT NULL,
	"place_detail" text,
	"urgent" boolean DEFAULT false NOT NULL,
	"ai_dept" "dept",
	"ai_confidence" integer DEFAULT 0 NOT NULL,
	"ai_keywords" text[] DEFAULT '{}'::text[] NOT NULL,
	"dept" "dept",
	"assignee_id" integer,
	"stage" smallint DEFAULT 1 NOT NULL,
	"need_info" boolean DEFAULT false NOT NULL,
	"paused" boolean DEFAULT false NOT NULL,
	"paused_until" timestamp with time zone,
	"cancelled" boolean DEFAULT false NOT NULL,
	"merged_into" integer,
	"merged_from" integer[] DEFAULT '{}'::integer[] NOT NULL,
	"extras" text[] DEFAULT '{}'::text[] NOT NULL,
	"done_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tickets_stage_ck" CHECK ("tickets"."stage" between 1 and 6)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text NOT NULL,
	"role" "role" NOT NULL,
	"tower" text,
	"floor" text,
	"apartment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "history" ADD CONSTRAINT "history_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "history" ADD CONSTRAINT "history_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "materials" ADD CONSTRAINT "materials_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "materials" ADD CONSTRAINT "materials_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "materials" ADD CONSTRAINT "materials_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_resident_id_users_id_fk" FOREIGN KEY ("resident_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_assignee_id_staff_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_merged_into_tickets_id_fk" FOREIGN KEY ("merged_into") REFERENCES "public"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "history_ticket_idx" ON "history" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "tickets_resident_idx" ON "tickets" USING btree ("resident_id");--> statement-breakpoint
CREATE INDEX "tickets_dept_stage_idx" ON "tickets" USING btree ("dept","stage");--> statement-breakpoint
CREATE INDEX "tickets_stage_idx" ON "tickets" USING btree ("stage");