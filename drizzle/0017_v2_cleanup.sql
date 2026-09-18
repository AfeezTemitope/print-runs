-- Re-key commercial margins onto the V2 category slugs.
--
-- Migration 0006 seeded category_margins with the old fixed-catalogue slugs ('id_card',
-- 'business_card'). V2 orders look up 'id-access' and 'cards-stationery', so nothing matched
-- and every V2 order fell back to a zero margin — PrintRuns was earning nothing on them.
UPDATE "category_margins" SET "category_slug" = 'id-access'        WHERE "category_slug" = 'id_card';--> statement-breakpoint
UPDATE "category_margins" SET "category_slug" = 'cards-stationery' WHERE "category_slug" = 'business_card';--> statement-breakpoint
UPDATE "category_margins" SET "category_slug" = 'banners-signage'  WHERE "category_slug" = 'banner';--> statement-breakpoint
UPDATE "category_margins" SET "category_slug" = 'books-booklets'   WHERE "category_slug" = 'jotter';--> statement-breakpoint
UPDATE "category_margins" SET "category_slug" = 'flyers-handbills' WHERE "category_slug" = 'flyer';--> statement-breakpoint
UPDATE "category_margins" SET "category_slug" = 'stickers-labels'  WHERE "category_slug" = 'sticker';--> statement-breakpoint
UPDATE "category_margins" SET "category_slug" = 'packaging'        WHERE "category_slug" = 'nylon';--> statement-breakpoint
-- Thank You Card merged into Cards & Stationery, which already has a row from Business Card.
DELETE FROM "category_margins" WHERE "category_slug" = 'thank_you_card';--> statement-breakpoint

-- Every live V2 category needs a margin row, or PrintRuns earns nothing on it. Default is the
-- flat 500 naira per piece used elsewhere; change any of them at /admin/margins.
INSERT INTO "category_margins" ("category_slug", "margin_type", "margin_fixed_kobo", "margin_percent_bps")
VALUES
  ('banners-signage', 'fixed', 50000, 0),
  ('stickers-labels', 'fixed', 50000, 0),
  ('cards-stationery', 'percent', 0, 700),
  ('books-booklets', 'fixed', 50000, 0),
  ('flyers-handbills', 'fixed', 50000, 0),
  ('packaging', 'fixed', 50000, 0),
  ('id-access', 'fixed', 20000, 0)
ON CONFLICT ("category_slug") DO NOTHING;--> statement-breakpoint

-- Catalog photos were keyed by the old slugs too, and by 'category:listing' for sub-types
-- that no longer exist. Re-key what maps cleanly; drop the rest rather than leave dead rows.
UPDATE "catalog_photos" SET "key" = 'banners-signage'  WHERE "key" = 'banner';--> statement-breakpoint
UPDATE "catalog_photos" SET "key" = 'books-booklets'   WHERE "key" = 'jotter';--> statement-breakpoint
UPDATE "catalog_photos" SET "key" = 'flyers-handbills' WHERE "key" = 'flyer';--> statement-breakpoint
UPDATE "catalog_photos" SET "key" = 'cards-stationery' WHERE "key" = 'business_card';--> statement-breakpoint
UPDATE "catalog_photos" SET "key" = 'stickers-labels'  WHERE "key" = 'sticker';--> statement-breakpoint
UPDATE "catalog_photos" SET "key" = 'packaging'        WHERE "key" = 'nylon';--> statement-breakpoint
UPDATE "catalog_photos" SET "key" = 'id-access'        WHERE "key" = 'id_card';--> statement-breakpoint
DELETE FROM "catalog_photos" WHERE "key" LIKE '%:%';--> statement-breakpoint
DELETE FROM "catalog_photos" WHERE "key" IN ('thank_you_card', 'frame', 'paper_bag');--> statement-breakpoint

-- The per-category verification table is retired: verification is now a property of the
-- business (shops.verification_tier), reviewed through verification_submissions.
DROP TABLE IF EXISTS "shop_category_verifications";
