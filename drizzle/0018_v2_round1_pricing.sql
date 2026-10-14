-- Correct the commercial margins seeded in 0017.
--
-- Those rows were written as 'fixed ₦500', and computeMargin multiplied a fixed margin by
-- quantity — a carry-over from V1, where the platform defined the product and a unit meant one
-- card. Under V2 a printer's quantity tier is a BATCH total, so 50 bags priced at ₦12,000 by
-- the printer were shown to the customer at ₦37,500. computeMargin no longer multiplies; these
-- values are restated so the intent is readable rather than implied by code that changed.
--
-- A fixed margin is now per ORDER. ₦500 on a small job is roughly what it was before; on a
-- large one it is far less, which is what the banded platform fee below is for.
UPDATE "category_margins" SET "margin_fixed_kobo" = 50000
  WHERE "margin_type" = 'fixed';--> statement-breakpoint

-- Banded platform service fee (brief item #10): ₦500 below ₦50,000, ₦1,000 at or above it.
-- Stored as settings so they are editable from admin rather than hardcoded.
INSERT INTO "platform_settings" ("key", "value_kobo") VALUES
  ('platform_fee_low_kobo', 50000),
  ('platform_fee_high_kobo', 100000),
  ('platform_fee_threshold_kobo', 5000000)
ON CONFLICT ("key") DO NOTHING;
