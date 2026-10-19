CREATE TYPE "public"."payout_kind" AS ENUM('settlement', 'advance');--> statement-breakpoint
CREATE TYPE "public"."payout_state" AS ENUM('due', 'processing', 'paid', 'failed');--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"kind" "payout_kind" NOT NULL,
	"amount_kobo" integer NOT NULL,
	"state" "payout_state" DEFAULT 'due' NOT NULL,
	"reference" text NOT NULL,
	"transfer_code" text,
	"failure_reason" text,
	"paid_by" text,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

ALTER TABLE "payouts" ADD CONSTRAINT "payouts_shop_id_shops_id_fk"
  FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE restrict;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_order_id_orders_id_fk"
  FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict;--> statement-breakpoint

-- The guarantee that no order is ever paid out twice for the same thing, however many times
-- the cron runs or an admin clicks.
CREATE UNIQUE INDEX IF NOT EXISTS "payout_order_kind_uq" ON "payouts" ("order_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payout_reference_uq" ON "payouts" ("reference");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payout_state_idx" ON "payouts" ("state","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payout_shop_idx" ON "payouts" ("shop_id","created_at");--> statement-breakpoint

ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "bank_code" text;--> statement-breakpoint
ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "bank_name" text;--> statement-breakpoint
ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "account_number" text;--> statement-breakpoint
ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "account_name" text;--> statement-breakpoint
ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "bank_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "paystack_recipient_code" text;
