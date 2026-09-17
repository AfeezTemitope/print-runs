CREATE TYPE "public"."dispute_reason" AS ENUM('not_delivered', 'wrong_product', 'quality', 'damaged', 'other');--> statement-breakpoint
CREATE TYPE "public"."dispute_state" AS ENUM('open', 'printer_responded', 'resolved_customer', 'resolved_printer');--> statement-breakpoint
CREATE TABLE "disputes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"shop_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"reason" "dispute_reason" NOT NULL,
	"detail" text,
	"evidence_urls" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"state" "dispute_state" DEFAULT 'open' NOT NULL,
	"printer_response" text,
	"printer_responded_at" timestamp with time zone,
	"outcome" text,
	"decision_note" text,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"document_url" text NOT NULL,
	"document_type" text NOT NULL,
	"social_url" text,
	"status" "verification_status" DEFAULT 'pending' NOT NULL,
	"review_note" text,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "disputed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivered_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "flagged_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "flag_reason" text;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "removed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "removed_reason" text;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_submissions" ADD CONSTRAINT "verification_submissions_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "dispute_order_uq" ON "disputes" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "dispute_state_idx" ON "disputes" USING btree ("state","created_at");--> statement-breakpoint
CREATE INDEX "dispute_shop_idx" ON "disputes" USING btree ("shop_id","decided_at");--> statement-breakpoint
CREATE INDEX "verification_status_idx" ON "verification_submissions" USING btree ("status","submitted_at");--> statement-breakpoint
CREATE INDEX "verification_shop_idx" ON "verification_submissions" USING btree ("shop_id");
--> statement-breakpoint
-- Existing delivered orders have no deliveredAt, which would leave their dispute and review
-- windows permanently open. Backfill from handover_at where we have it, updated_at otherwise —
-- both are past the window already, so this closes them rather than reopening anything.
UPDATE "orders" SET "delivered_at" = COALESCE("handover_at", "updated_at")
WHERE "status" = 'delivered' AND "delivered_at" IS NULL;
