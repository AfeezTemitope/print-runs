-- Item #12b: the printer's WhatsApp number stops being public. The column stays — ops still
-- needs it to arrange delivery — but a public Instagram handle takes its place on the
-- storefront, so printers can still show more of their work without inviting customers to
-- take the conversation, and the payment, off the platform.
ALTER TABLE "shops" ADD COLUMN IF NOT EXISTS "instagram" text;
