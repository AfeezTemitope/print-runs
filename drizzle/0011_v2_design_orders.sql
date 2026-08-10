CREATE TYPE "public"."design_review_mode" AS ENUM('review', 'direct');--> statement-breakpoint
CREATE TYPE "public"."design_status" AS ENUM('brief_received', 'in_progress', 'proof_ready', 'revision_requested', 'approved', 'cancelled');--> statement-breakpoint
CREATE TABLE "design_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"customer_id" uuid NOT NULL,
	"studio_id" uuid NOT NULL,
	"service_id" uuid,
	"service_title" text NOT NULL,
	"review_mode" "design_review_mode" DEFAULT 'review' NOT NULL,
	"status" "design_status" DEFAULT 'brief_received' NOT NULL,
	"brief" text NOT NULL,
	"brief_file_url" text,
	"contact_email" text NOT NULL,
	"contact_phone" text NOT NULL,
	"designer_base_kobo" integer NOT NULL,
	"margin_kobo" integer NOT NULL,
	"platform_fee_kobo" integer NOT NULL,
	"amount_paid_kobo" integer NOT NULL,
	"revisions_included" integer DEFAULT 0 NOT NULL,
	"revisions_used" integer DEFAULT 0 NOT NULL,
	"extra_revision_kobo" integer DEFAULT 0 NOT NULL,
	"payment_status" "payment_status" DEFAULT 'unpaid' NOT NULL,
	"settlement_status" "settlement_status" DEFAULT 'pending' NOT NULL,
	"refund_status" "refund_status" DEFAULT 'none' NOT NULL,
	"refund_amount_kobo" integer,
	"refund_reason" text,
	"final_file_url" text,
	"approved_at" timestamp with time zone,
	"legal_version_accepted" text,
	"ops_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "design_proofs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"design_order_id" uuid NOT NULL,
	"round" integer NOT NULL,
	"file_url" text NOT NULL,
	"note" text,
	"approved_at" timestamp with time zone,
	"revision_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "design_revision_charges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"design_order_id" uuid NOT NULL,
	"reference" text NOT NULL,
	"amount_kobo" integer NOT NULL,
	"payment_status" "payment_status" DEFAULT 'unpaid' NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "design_orders" ADD CONSTRAINT "design_orders_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_orders" ADD CONSTRAINT "design_orders_studio_id_designer_studios_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."designer_studios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_orders" ADD CONSTRAINT "design_orders_service_id_designer_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."designer_services"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_proofs" ADD CONSTRAINT "design_proofs_design_order_id_design_orders_id_fk" FOREIGN KEY ("design_order_id") REFERENCES "public"."design_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_revision_charges" ADD CONSTRAINT "design_revision_charges_design_order_id_design_orders_id_fk" FOREIGN KEY ("design_order_id") REFERENCES "public"."design_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "design_orders_code_uq" ON "design_orders" USING btree ("code");--> statement-breakpoint
CREATE INDEX "design_orders_studio_idx" ON "design_orders" USING btree ("studio_id","status");--> statement-breakpoint
CREATE INDEX "design_orders_customer_idx" ON "design_orders" USING btree ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "design_proof_round_uq" ON "design_proofs" USING btree ("design_order_id","round");--> statement-breakpoint
CREATE UNIQUE INDEX "design_revision_ref_uq" ON "design_revision_charges" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "design_revision_order_idx" ON "design_revision_charges" USING btree ("design_order_id","payment_status");