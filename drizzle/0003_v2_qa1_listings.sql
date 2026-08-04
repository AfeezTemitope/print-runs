ALTER TABLE "products" ADD COLUMN "listing_slug" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "offers_hylet" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "products_cat_listing_idx" ON "products" USING btree ("category_slug","listing_slug","is_active");
--> statement-breakpoint
-- Backfill: single-listing categories map straight onto their one listing slug.
UPDATE "products" SET "listing_slug" = "category_slug"
  WHERE "listing_slug" IS NULL AND "category_slug" IN ('banner', 'flyer', 'thank_you_card', 'id_card');--> statement-breakpoint
UPDATE "products" SET "listing_slug" = 'polybag'
  WHERE "listing_slug" IS NULL AND "category_slug" = 'nylon';--> statement-breakpoint

-- QA 3.1: the minimum-charge floor is gone platform-wide. The column stays so nothing is
-- destroyed, but no row may keep an active floor.
UPDATE "products" SET "min_charge_kobo" = NULL;--> statement-breakpoint

-- Anything left unmapped belongs to a category that now has several listings (Jotter,
-- Sticker, Business Card): there is no honest way to guess which listing an old row meant, so
-- it is deactivated rather than left live and silently quoting every request. Same for the
-- retired 'tier' and 'fixed_size' shapes. Printers re-publish these from the new grid form.
UPDATE "products" SET "is_active" = false
  WHERE "listing_slug" IS NULL OR "pricing_mode" IN ('tier', 'fixed_size');
