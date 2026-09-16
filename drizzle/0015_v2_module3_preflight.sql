CREATE TYPE "public"."preflight_status" AS ENUM('pending', 'passed', 'failed');--> statement-breakpoint
ALTER TYPE "public"."order_status" ADD VALUE 'paused' BEFORE 'order_received';--> statement-breakpoint
CREATE TABLE "preflight_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"round" integer NOT NULL,
	"file_url" text NOT NULL,
	"file_name" text,
	"status" "preflight_status" DEFAULT 'pending' NOT NULL,
	"findings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"decided_by" text,
	"reviewer_note" text,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "preflight_requested" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "preflight_overridden_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "preflight_fee_kobo" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "preflight_reviews" ADD CONSTRAINT "preflight_reviews_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "preflight_round_uq" ON "preflight_reviews" USING btree ("order_id","round");--> statement-breakpoint
CREATE INDEX "preflight_status_idx" ON "preflight_reviews" USING btree ("status","submitted_at");