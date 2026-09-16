ALTER TABLE "orders" ALTER COLUMN "product_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "listing_id" uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "quoted_price_kobo" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "quoted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "quote_note" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "quote_declined_at" timestamp with time zone;