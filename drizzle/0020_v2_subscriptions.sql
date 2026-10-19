CREATE TABLE IF NOT EXISTS "subscription_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"tier" text NOT NULL,
	"reference" text NOT NULL,
	"amount_kobo" integer NOT NULL,
	"payment_status" "payment_status" DEFAULT 'unpaid' NOT NULL,
	"period_start" timestamp with time zone,
	"period_end" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

ALTER TABLE "subscription_payments"
  ADD CONSTRAINT "subscription_payments_shop_id_shops_id_fk"
  FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade;--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "subscription_ref_uq" ON "subscription_payments" ("reference");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscription_shop_idx" ON "subscription_payments" ("shop_id","created_at");--> statement-breakpoint

-- Every printer starts on Free. Nothing is backdated: existing shops simply become Free, which
-- is what they have effectively been all along.
ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "subscription_tier" text DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "subscription_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "subscription_ends_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "subscription_auto_renew" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "subscription_ref" text;--> statement-breakpoint

-- Tier values as settings, so admin can change any of them without a deploy. -1 means
-- unlimited, since this table holds integers only.
INSERT INTO "platform_settings" ("key", "value_kobo") VALUES
  ('tier_free_price_kobo', 0),
  ('tier_free_cap_kobo', 2000000),
  ('tier_free_retention_days', 2),
  ('tier_growth_price_kobo', 750000),
  ('tier_growth_cap_kobo', 15000000),
  ('tier_growth_retention_days', 30),
  ('tier_pro_price_kobo', 1250000),
  ('tier_pro_cap_kobo', -1),
  ('tier_pro_retention_days', 90)
ON CONFLICT ("key") DO NOTHING;
