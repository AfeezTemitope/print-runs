CREATE TYPE "public"."margin_type" AS ENUM('fixed', 'percent');--> statement-breakpoint
CREATE TYPE "public"."reassignment_resolution" AS ENUM('same_price', 'price_increase', 'price_decrease', 'no_replacement');--> statement-breakpoint
CREATE TYPE "public"."refund_status" AS ENUM('none', 'requested', 'partial', 'full');--> statement-breakpoint
CREATE TYPE "public"."settlement_status" AS ENUM('pending', 'settled', 'withheld');--> statement-breakpoint
CREATE TYPE "public"."verification_status" AS ENUM('pending', 'verified', 'rejected');--> statement-breakpoint
CREATE TABLE "order_reassignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"from_shop_id" uuid NOT NULL,
	"to_shop_id" uuid,
	"old_selling_price_kobo" integer NOT NULL,
	"new_selling_price_kobo" integer,
	"diff_kobo" integer,
	"resolution" "reassignment_resolution" NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "platform_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value_kobo" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- V2 seed — decision 1: fixed ₦500 platform service fee. Lives here, not hardcoded, so
-- Batch 3's admin dashboard can edit it with no code change.
INSERT INTO "platform_settings" ("key", "value_kobo") VALUES ('platform_service_fee_kobo', 50000)
ON CONFLICT ("key") DO NOTHING;--> statement-breakpoint
CREATE TABLE "shop_category_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"category_slug" text NOT NULL,
	"status" "verification_status" DEFAULT 'pending' NOT NULL,
	"work_permit_url" text,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "fulfillment_method" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "fulfillment_method" SET DEFAULT 'delivery'::text;--> statement-breakpoint
DROP TYPE "public"."fulfillment_method";--> statement-breakpoint
CREATE TYPE "public"."fulfillment_method" AS ENUM('delivery', 'collection');--> statement-breakpoint
-- V2 DATA MIGRATION — fulfillment_method: 'pickup' has no equivalent in the new enum.
-- Existing self-pickup orders are remapped to 'collection', the closest surviving concept,
-- so the cast below does not fail against live order rows.
UPDATE "orders" SET "fulfillment_method" = 'collection' WHERE "fulfillment_method" = 'pickup';--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "fulfillment_method" SET DEFAULT 'delivery'::"public"."fulfillment_method";--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "fulfillment_method" SET DATA TYPE "public"."fulfillment_method" USING "fulfillment_method"::"public"."fulfillment_method";--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'order_received'::text;--> statement-breakpoint
DROP TYPE "public"."order_status";--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('order_received', 'printer_assigned', 'printing_in_progress', 'printing_completed', 'ready_for_dispatch', 'out_for_delivery', 'delivered', 'cancelled');--> statement-breakpoint
-- V2 DATA MIGRATION — status: the old 5-stage enum shares no members with the new 7-stage one
-- except 'cancelled'. Map every existing order onto its nearest new stage so the cast below
-- does not fail, and so historic orders still show a sensible status afterwards.
UPDATE "orders" SET "status" = CASE "status"
  WHEN 'placed'    THEN 'order_received'
  WHEN 'printing'  THEN 'printing_in_progress'
  WHEN 'ready'      THEN 'ready_for_dispatch'
  WHEN 'completed'  THEN 'delivered'
  ELSE "status"
END;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'order_received'::"public"."order_status";--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "status" SET DATA TYPE "public"."order_status" USING "status"::"public"."order_status";--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "pricing_mode" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."pricing_mode";--> statement-breakpoint
CREATE TYPE "public"."pricing_mode" AS ENUM('per_area', 'tier', 'fixed_size', 'matrix', 'quote');--> statement-breakpoint
-- V2 DATA MIGRATION — pricing_mode: 'per_sheet' (Business Card Print-Only) is removed per
-- decision 8. Any existing product still using it is deactivated first (so it stops appearing
-- to customers) and then remapped to 'quote' as a safe, non-crashing fallback. Afeez should
-- review any product this touches before Batch 2 ships the new Business Card configurator.
UPDATE "products" SET "is_active" = false WHERE "pricing_mode" = 'per_sheet';--> statement-breakpoint
UPDATE "products" SET "pricing_mode" = 'quote' WHERE "pricing_mode" = 'per_sheet';--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "pricing_mode" SET DATA TYPE "public"."pricing_mode" USING "pricing_mode"::"public"."pricing_mode";--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "printer_base_kobo" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "margin_kobo" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "selling_price_kobo" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "platform_fee_kobo" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "amount_paid_kobo" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivery_fee_kobo" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "collection_authorized_name" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "collection_authorized_phone" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "contact_email" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "contact_phone_primary" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "contact_phone_secondary" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "settlement_status" "settlement_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "settled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "refund_status" "refund_status" DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "refund_amount_kobo" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "refund_reason" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "handover_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "margin_type" "margin_type" DEFAULT 'fixed' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "margin_fixed_kobo" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "margin_percent_bps" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "shops" ADD COLUMN "address_line_1" text;--> statement-breakpoint
ALTER TABLE "shops" ADD COLUMN "address_line_2" text;--> statement-breakpoint
ALTER TABLE "shops" ADD COLUMN "address_city" text;--> statement-breakpoint
ALTER TABLE "shops" ADD COLUMN "address_state" text;--> statement-breakpoint
ALTER TABLE "order_reassignments" ADD CONSTRAINT "order_reassignments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_reassignments" ADD CONSTRAINT "order_reassignments_from_shop_id_shops_id_fk" FOREIGN KEY ("from_shop_id") REFERENCES "public"."shops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_reassignments" ADD CONSTRAINT "order_reassignments_to_shop_id_shops_id_fk" FOREIGN KEY ("to_shop_id") REFERENCES "public"."shops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_category_verifications" ADD CONSTRAINT "shop_category_verifications_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reassignments_order_idx" ON "order_reassignments" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "shop_cat_verif_uq" ON "shop_category_verifications" USING btree ("shop_id","category_slug");--> statement-breakpoint
CREATE INDEX "shop_cat_verif_status_idx" ON "shop_category_verifications" USING btree ("category_slug","status");--> statement-breakpoint
-- V2 DATA MIGRATION — preserve financial and timestamp history before the old columns go away.
-- price_kobo was the full V1 amount charged at checkout; it becomes the historic amount_paid_kobo.
-- V1 had no 3-layer breakdown, so printer_base_kobo/margin_kobo/selling_price_kobo/platform_fee_kobo
-- stay null for these legacy orders rather than guessing a split that was never actually charged.
UPDATE "orders" SET "amount_paid_kobo" = "price_kobo" WHERE "price_kobo" IS NOT NULL;--> statement-breakpoint
-- completed_at was V1's single "order done" timestamp — closest match to the new handover_at.
UPDATE "orders" SET "handover_at" = "completed_at" WHERE "completed_at" IS NOT NULL;--> statement-breakpoint
-- Best-effort contact backfill so historic orders aren't blank in the new dashboard fields —
-- pulled from the customer's account record, since V1 orders never captured per-order contacts.
UPDATE "orders" o SET
  "contact_email" = u.email,
  "contact_phone_primary" = u.phone
FROM "users" u
WHERE o."customer_id" = u.id AND o."contact_email" IS NULL;--> statement-breakpoint
-- shops.address_text -> address_line_1 is a best-effort carry-over. Printers still need to fill
-- in address_line_2 / city / state themselves; this just avoids a blank line 1 on day one.
UPDATE "shops" SET "address_line_1" = "address_text" WHERE "address_text" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" DROP COLUMN "price_kobo";--> statement-breakpoint
ALTER TABLE "orders" DROP COLUMN "completed_at";--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "per_sheet_kobo";--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "cards_per_sheet";--> statement-breakpoint
ALTER TABLE "shops" DROP COLUMN "address_text";--> statement-breakpoint
ALTER TABLE "shops" DROP COLUMN "supports_delivery";--> statement-breakpoint
ALTER TABLE "shops" DROP COLUMN "supports_pickup";--> statement-breakpoint
-- V2 data quality — apply the two per-category margins already decided (rest stay at the
-- schema default of fixed/₦0 until Afeez sets them in the Batch 3 admin dashboard).
-- Decision 16: ID Card margin is ₦200 fixed per piece (resolves the earlier ₦250 outlier query).
UPDATE "products" SET "margin_type" = 'fixed', "margin_fixed_kobo" = 20000 WHERE "category_slug" = 'id_card';--> statement-breakpoint
-- Decision 23: Business Card keeps a 7% percentage margin (700 basis points) rather than moving
-- to a fixed amount. The admin UI must show the resulting selling price live next to this field.
UPDATE "products" SET "margin_type" = 'percent', "margin_percent_bps" = 700 WHERE "category_slug" = 'business_card';
