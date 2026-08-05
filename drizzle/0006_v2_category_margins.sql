CREATE TABLE "category_margins" (
	"category_slug" text PRIMARY KEY NOT NULL,
	"margin_type" "margin_type" DEFAULT 'fixed' NOT NULL,
	"margin_fixed_kobo" integer DEFAULT 0 NOT NULL,
	"margin_percent_bps" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

--> statement-breakpoint
-- Seed the two margins that are already founder decisions, so the platform behaves on day one
-- exactly as it did when they were hardcoded: ID Card is a flat 200 naira PER PIECE
-- (decision 16), Business Card is the only percentage margin at 7% (decision 23).
INSERT INTO "category_margins" ("category_slug", "margin_type", "margin_fixed_kobo", "margin_percent_bps")
VALUES
  ('id_card', 'fixed', 20000, 0),
  ('business_card', 'percent', 0, 700)
ON CONFLICT ("category_slug") DO NOTHING;
