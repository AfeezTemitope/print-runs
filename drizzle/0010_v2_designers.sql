CREATE TABLE "designer_services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"studio_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"price_kobo" integer NOT NULL,
	"revisions_included" integer DEFAULT 2 NOT NULL,
	"extra_revision_kobo" integer DEFAULT 0 NOT NULL,
	"turnaround_hours" integer DEFAULT 48 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "designer_studios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"code" text NOT NULL,
	"display_name" text NOT NULL,
	"slug" text NOT NULL,
	"tagline" text,
	"bio" text,
	"avatar_url" text,
	"banner_url" text,
	"verification" "verification_status" DEFAULT 'pending' NOT NULL,
	"verification_note" text,
	"reviewed_at" timestamp with time zone,
	"rating_avg" double precision DEFAULT 0 NOT NULL,
	"rating_count" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "designer_works" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"studio_id" uuid NOT NULL,
	"image_url" text NOT NULL,
	"caption" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "designer_services" ADD CONSTRAINT "designer_services_studio_id_designer_studios_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."designer_studios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "designer_studios" ADD CONSTRAINT "designer_studios_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "designer_works" ADD CONSTRAINT "designer_works_studio_id_designer_studios_id_fk" FOREIGN KEY ("studio_id") REFERENCES "public"."designer_studios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "designer_services_studio_idx" ON "designer_services" USING btree ("studio_id","is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "designer_user_uq" ON "designer_studios" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "designer_slug_uq" ON "designer_studios" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "designer_code_uq" ON "designer_studios" USING btree ("code");--> statement-breakpoint
CREATE INDEX "designer_verified_idx" ON "designer_studios" USING btree ("verification","is_active");--> statement-breakpoint
CREATE INDEX "designer_works_studio_idx" ON "designer_works" USING btree ("studio_id","sort_order");