CREATE TYPE "public"."listing_area_unit" AS ENUM('sqft', 'sqin');--> statement-breakpoint
CREATE TYPE "public"."listing_pricing_mode" AS ENUM('tier', 'piece', 'area', 'quote');--> statement-breakpoint
CREATE TABLE "listing_tiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"price_kobo" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"subcategory_id" uuid,
	"category_slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"photos" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"pricing_mode" "listing_pricing_mode" DEFAULT 'quote' NOT NULL,
	"rate_per_piece_kobo" integer,
	"rate_per_area_kobo" integer,
	"area_unit" "listing_area_unit",
	"min_charge_kobo" integer,
	"minimum_order" integer,
	"turnaround_hours" integer DEFAULT 24 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subcategories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"category_slug" text NOT NULL,
	"name" text NOT NULL,
	"is_custom" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "shops" ADD COLUMN "whatsapp" text;--> statement-breakpoint
ALTER TABLE "listing_tiers" ADD CONSTRAINT "listing_tiers_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_subcategory_id_subcategories_id_fk" FOREIGN KEY ("subcategory_id") REFERENCES "public"."subcategories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subcategories" ADD CONSTRAINT "subcategories_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "listing_tier_qty_uq" ON "listing_tiers" USING btree ("listing_id","quantity");--> statement-breakpoint
CREATE INDEX "listings_shop_idx" ON "listings" USING btree ("shop_id","is_active");--> statement-breakpoint
CREATE INDEX "listings_category_idx" ON "listings" USING btree ("category_slug","is_active");--> statement-breakpoint
CREATE INDEX "listings_subcat_idx" ON "listings" USING btree ("subcategory_id");--> statement-breakpoint
CREATE INDEX "subcat_shop_idx" ON "subcategories" USING btree ("shop_id","category_slug");--> statement-breakpoint
CREATE UNIQUE INDEX "subcat_shop_name_uq" ON "subcategories" USING btree ("shop_id","category_slug","name");
--> statement-breakpoint
-- Founder decision, Sept 2026: all printer products and pricing under the old fixed-catalogue
-- model are test data and are wiped rather than migrated. The V2 model is not compatible with
-- them — categories, product identity and pricing shape all changed — and a half-mapped
-- listing is worse than none. Printers rebuild from the new Products screen.
--
-- Deliberately NOT touched: user accounts and roles, shops themselves (the storefront identity
-- carries over), orders already placed, and the entire Designer Marketplace.
DELETE FROM "product_addons";--> statement-breakpoint
DELETE FROM "product_variants";--> statement-breakpoint
DELETE FROM "products";--> statement-breakpoint

-- Per-category verification is retired: verification is now a property of the business
-- (Tier 1 auto-approved, Tier 2 admin-reviewed for the badge), not of each category.
-- Rows are cleared here; the table itself is dropped in Module 4 once the two-tier model lands.
DELETE FROM "shop_category_verifications";
