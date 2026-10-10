ALTER TYPE "public"."role" ADD VALUE 'warehouse';--> statement-breakpoint
CREATE TABLE "warehouse_stock" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"unit" text DEFAULT 'cái' NOT NULL,
	"stock" integer DEFAULT 0 NOT NULL,
	"min_stock" integer DEFAULT 5 NOT NULL,
	"location" text DEFAULT 'Kho trung tâm' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "warehouse_stock_code_unique" UNIQUE("code")
);
