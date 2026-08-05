CREATE TABLE "faq_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_published" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "faq_published_idx" ON "faq_entries" USING btree ("is_published","sort_order");
--> statement-breakpoint
-- Starter questions describing how the platform ACTUALLY works today: delivery quoted after
-- payment and paid in cash, the fixed platform fee, Collection as the fallback, and Request
-- Quote for anything a printer has not priced. Edit or unpublish any of them at /admin/faq.
INSERT INTO "faq_entries" ("question", "answer", "sort_order", "is_published") VALUES
('How does pricing work?',
 'Each printer sets their own prices, so what you pay depends on which printer you choose. The price you see on the printer comparison screen is the full price for your job. A fixed platform service fee is added at checkout and shown separately. Delivery is not included — see the next question.',
 10, true),
('Why does my quantity say "Request quote"?',
 'Printers set prices for specific sizes and quantities. If you have chosen a combination a particular printer has not priced, we do not guess or round it up — we ask them for a quote instead. Choosing one of the listed quantities usually gives you an instant price.',
 20, true),
('How is delivery handled, and what does it cost?',
 'Every order is delivered by default. The delivery fee is not charged at checkout, because it depends on where you are and is confirmed with your printer once your job is under way. A PrintRuns representative will call you to confirm the amount before anything is dispatched. You pay that amount in cash to the rider when they arrive — it is never charged to your card.',
 30, true),
('What if I do not want to pay the delivery fee?',
 'You can send your own rider instead. Tell the representative when they call, and we will switch your order to Collection. We will take the name and phone number of the person collecting, and the printer will only release your job to them.',
 40, true),
('When will my order be ready?',
 'Each printer sets their own turnaround time, shown on their card before you choose them. You can follow your order through every stage on the tracking page, and we will email you when it is ready and again when it is on the way.',
 50, true),
('Can I cancel or get a refund?',
 'You can cancel before production begins and receive a full refund, less any payment processing charges. Once printing has started, cancellation is usually not possible because materials and labour have already been committed. Refunds are considered where the wrong product was produced, there is a confirmed defect, or the printer cannot fulfil the order. Our Refund and Cancellation Policy sets out the full rules.',
 60, true),
('What file should I upload?',
 'PDF, AI, CDR, PNG or JPG. CMYK is preferred for accurate colour. Check your spelling, sizes and image quality before you order — printers print what they are given, and we cannot refund errors that were in the file you supplied.',
 70, true),
('Who actually prints my job?',
 'PrintRuns is a marketplace. Printing is done by independent Lagos printers we verify for each product category they offer. You choose which one prints your job, and we handle payment, tracking and support throughout.',
 80, true);
