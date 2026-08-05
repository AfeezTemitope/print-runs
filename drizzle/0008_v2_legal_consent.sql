ALTER TABLE "orders" ADD COLUMN "legal_version_accepted" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "legal_accepted_at" timestamp with time zone;