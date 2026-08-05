-- Data-only migration. Verification is now ENFORCED on the storefront: a shop is shown to
-- customers for a category only if it has a 'verified' row here. Before this batch nothing
-- read that table, so every existing printer would vanish the moment it deployed.
--
-- Grandfather them: any shop that already has an active product in a category is treated as
-- verified for it. They were listed and selling under the old rules, and silently delisting a
-- working printer is a far worse failure than reviewing them a little late.
INSERT INTO "shop_category_verifications" ("shop_id", "category_slug", "status", "reviewed_at")
-- The cast is required: Postgres infers enum types from a VALUES list but not through a
-- SELECT, so a bare 'verified' arrives as text and the insert is rejected.
SELECT DISTINCT p."shop_id", p."category_slug", 'verified'::verification_status, now()
FROM "products" p
WHERE p."is_active" = true
ON CONFLICT ("shop_id", "category_slug") DO NOTHING;--> statement-breakpoint

-- Anything already applied for and still pending keeps its place in the queue rather than
-- being auto-approved by the statement above.
UPDATE "shop_category_verifications" SET "status" = 'pending'::verification_status, "reviewed_at" = NULL
WHERE "work_permit_url" IS NOT NULL AND "reviewed_at" IS NULL;
