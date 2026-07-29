-- V2 Batch 2 — product layer migration.
--
-- Two data changes, both against existing printer-entered pricing rows. Neither deletes a
-- printer's prices: a jotter row keeps its price and simply moves to the nearest new sheet
-- count, and retired business-card rows are deactivated rather than dropped so a printer can
-- see what happened and re-price.

-- 1. Jotter sheet counts move 40/60/80 -> 50/75/100 (Batch 2 migrations list).
--    Matrix variants store their spec in `meta` as { cover, size, sheets } and repeat the
--    same values in `label`, so both have to move together or the configurator's lookup
--    (which matches on meta) silently stops finding a printer's price.
--
--    Prices are intentionally NOT scaled. A 40-sheet price becoming a 50-sheet price means
--    the printer is now selling slightly more paper for the same money. That is deliberate:
--    guessing a scaled price on a printer's behalf would silently change what they charge.
--    Printers should review jotter pricing after this migration.
UPDATE "product_variants"
SET "meta" = jsonb_set("meta", '{sheets}', '50'::jsonb)
WHERE "meta" ->> 'sheets' = '40';--> statement-breakpoint

UPDATE "product_variants"
SET "meta" = jsonb_set("meta", '{sheets}', '75'::jsonb)
WHERE "meta" ->> 'sheets' = '60';--> statement-breakpoint

UPDATE "product_variants"
SET "meta" = jsonb_set("meta", '{sheets}', '100'::jsonb)
WHERE "meta" ->> 'sheets' = '80';--> statement-breakpoint

-- Rebuild the human label from the (now updated) meta so the printer's dashboard and the
-- matching logic agree. Only touches rows that actually carry a matrix meta payload.
UPDATE "product_variants"
SET "label" = ("meta" ->> 'cover') || ' / ' || ("meta" ->> 'size') || ' / ' || ("meta" ->> 'sheets')
WHERE "meta" ? 'cover' AND "meta" ? 'size' AND "meta" ? 'sheets';--> statement-breakpoint

-- 2. Retire any lingering Business Card "Print Only" listings (decision 8). The pricing_mode
--    enum value was already removed in 0001; this catches rows identified by name that were
--    remapped to 'quote' there, so they stop appearing as live listings.
UPDATE "products"
SET "is_active" = false
WHERE "category_slug" = 'business_card'
  AND ("name" ILIKE '%print only%' OR "name" ILIKE '%print-only%');--> statement-breakpoint

-- 3. Frame is hidden from the customer view (founder decisions). Deactivate frame listings so
--    they cannot be reached or priced against, without deleting a printer's data.
UPDATE "products" SET "is_active" = false WHERE "category_slug" = 'frame';--> statement-breakpoint

-- 4. Business Card margin is a 7% percentage (decision 23); every other category uses a fixed
--    naira margin. 0001 set this for rows that existed then — repeat it so any product created
--    between the two migrations is consistent.
UPDATE "products"
SET "margin_type" = 'percent', "margin_percent_bps" = 700
WHERE "category_slug" = 'business_card' AND "margin_type" = 'fixed' AND "margin_fixed_kobo" = 0;--> statement-breakpoint

-- 5. ID Card margin is 200 naira fixed per piece (decision 16).
UPDATE "products"
SET "margin_type" = 'fixed', "margin_fixed_kobo" = 20000
WHERE "category_slug" = 'id_card' AND "margin_fixed_kobo" = 0;
