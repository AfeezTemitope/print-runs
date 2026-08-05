CREATE TYPE "public"."delivery_fee_status" AS ENUM('not_set', 'quoted', 'accepted', 'declined');--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivery_fee_status" "delivery_fee_status" DEFAULT 'not_set' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivery_fee_quoted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivery_fee_responded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "ops_note" text;