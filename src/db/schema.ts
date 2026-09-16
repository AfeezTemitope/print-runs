import {
  pgTable, pgEnum, uuid, text, integer, boolean, doublePrecision,
  timestamp, jsonb, uniqueIndex, index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

/* ------------------------------------------------------------------ */
/* Enums                                                               */
/* ------------------------------------------------------------------ */

export const userRole = pgEnum('user_role', ['customer', 'printer', 'designer', 'admin']);

// V2: 'per_sheet' (Business Card Print-Only) removed — decision 8.
export const pricingMode = pgEnum('pricing_mode', [
  'per_area',
  'tier',
  'fixed_size',
  'matrix',
  'quote',
]);

export const areaUnit = pgEnum('area_unit', ['sqft', 'sqin']);

export const addonKind = pgEnum('addon_kind', ['lamination', 'gsm', 'corner', 'sides']);
export const addonBasis = pgEnum('addon_basis', ['per_sheet', 'per_piece', 'flat']);

// V2 pricing engine (decision 1 + 23): 'fixed' adds a flat kobo amount; 'percent' applies
// basis points (700 = 7.00%) to the Printer Base Price. Only Business Card uses 'percent'.
export const marginType = pgEnum('margin_type', ['fixed', 'percent']);

// V2 order lifecycle (decision 18): 7 customer-facing stages + cancelled.
// 'ready_for_dispatch' = completed & available for handover, for BOTH delivery and Collection.
// Collection orders skip 'out_for_delivery' and go straight to 'delivered' on confirmed handover.
export const orderStatus = pgEnum('order_status', [
  /**
   * Module 3. The order is paid but held for file review and is COMPLETELY invisible to the
   * printer. It leaves this state only on a preflight pass or a customer override.
   */
  'paused',
  'order_received',
  'printer_assigned',
  'printing_in_progress',
  'printing_completed',
  'ready_for_dispatch',
  'out_for_delivery',
  'delivered',
  'cancelled',
]);

export const paymentStatus = pgEnum('payment_status', ['unpaid', 'paid', 'refunded']);

// V2 (28 Jul decision): 'collection' replaces customer-facing self-pickup. It is an
// ops-initiated fallback arranged AFTER payment, never chosen by the customer at checkout.
export const fulfillmentMethod = pgEnum('fulfillment_method', ['delivery', 'collection']);

// Settlement triggers on confirmed Handover, not delivery specifically (decision 20).
export const settlementStatus = pgEnum('settlement_status', ['pending', 'settled', 'withheld']);

// Refund tracking for the ops cancel/refund actions this batch adds.
export const refundStatus = pgEnum('refund_status', ['none', 'requested', 'partial', 'full']);

/**
 * The delivery fee conversation, which happens OUTSIDE the system: the printer names a fee,
 * a PrintRuns rep relays it to the customer by phone, and the customer pays the rider in cash
 * on arrival. Nothing here moves money — it records where that conversation got to, so an
 * order can never be dispatched to someone who has not agreed to pay on the doorstep.
 */
export const deliveryFeeStatus = pgEnum('delivery_fee_status', ['not_set', 'quoted', 'accepted', 'declined']);

export const reassignmentResolution = pgEnum('reassignment_resolution', [
  'same_price',
  'price_increase',
  'price_decrease',
  'no_replacement',
]);

export const verificationStatus = pgEnum('verification_status', ['pending', 'verified', 'rejected']);

/* ------------------------------------------------------------------ */
/* Users                                                               */
/* ------------------------------------------------------------------ */

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  role: userRole('role').notNull().default('customer'),
  firstName: text('first_name').notNull(),
  surname: text('surname').notNull(),
  email: text('email').notNull(),
  phone: text('phone'),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('users_email_uq').on(t.email),
]);

/* ------------------------------------------------------------------ */
/* Shops (one per printer user)                                        */
/* ------------------------------------------------------------------ */

// V2: supportsPickup removed. Collection is arranged per-order by ops, not a shop capability.
export const shops = pgTable('shops', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  code: text('code').notNull(),
  businessName: text('business_name').notNull(),
  slug: text('slug').notNull(),
  bio: text('bio'),
  logoUrl: text('logo_url'),
  bannerUrl: text('banner_url'),
  // V2: address split 1 field -> 4 (Batch 1 foundation list).
  addressLine1: text('address_line_1'),
  addressLine2: text('address_line_2'),
  addressCity: text('address_city'),
  addressState: text('address_state'),
  lat: doublePrecision('lat'),
  lng: doublePrecision('lng'),
  openingHours: text('opening_hours'),
  // Shown publicly on the storefront (Module 1, Section 3 step 2) — optional but recommended,
  // because it is how Lagos customers actually expect to reach a printer.
  whatsapp: text('whatsapp'),
  /**
   * Two-tier verification (Module 4 §1, brought forward because discovery needs it).
   * 1 = Basic, auto-approved on signup, live but no badge.
   * 2 = Verified, admin-approved against CAC or a work permit — this is what shows the badge.
   */
  verificationTier: integer('verification_tier').notNull().default(1),
  ratingAvg: doublePrecision('rating_avg').notNull().default(0),
  ratingCount: integer('rating_count').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('shops_user_uq').on(t.userId),
  uniqueIndex('shops_slug_uq').on(t.slug),
  uniqueIndex('shops_code_uq').on(t.code),
  index('shops_geo_idx').on(t.lat, t.lng),
]);

/* ------------------------------------------------------------------ */
/* Per-category printer verification (decision 9). Table only in       */
/* Batch 1 — the verification queue UI itself is Batch 3.              */
/* ------------------------------------------------------------------ */

export const shopCategoryVerifications = pgTable('shop_category_verifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  shopId: uuid('shop_id').notNull().references(() => shops.id, { onDelete: 'cascade' }),
  categorySlug: text('category_slug').notNull(),
  status: verificationStatus('status').notNull().default('pending'),
  workPermitUrl: text('work_permit_url'),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('shop_cat_verif_uq').on(t.shopId, t.categorySlug),
  index('shop_cat_verif_status_idx').on(t.categorySlug, t.status),
]);

/* ------------------------------------------------------------------ */
/* Platform-wide settings (decision 2: admin-editable, no code change). */
/* Batch 1 seeds the ₦500 platform service fee here so it is never      */
/* hardcoded.                                                           */
/* ------------------------------------------------------------------ */

export const platformSettings = pgTable('platform_settings', {
  key: text('key').primaryKey(),
  valueKobo: integer('value_kobo').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/* ------------------------------------------------------------------ */
/* V2 storefront model (Module 1)                                      */
/* ------------------------------------------------------------------ */

/**
 * Module 1 replaces the fixed eight-product catalogue with printer-controlled storefronts.
 * PrintRuns owns the top-level categories (in code, src/lib/catalog.ts — they are not editable
 * by anyone, so they need no table). Everything below belongs to the printer.
 */

/** Quantity tiers / Per piece / Per sq.ft — chosen per listing, never per category. */
export const listingPricingMode = pgEnum('listing_pricing_mode', ['tier', 'piece', 'area', 'quote']);
export const areaUnitEnum = pgEnum('listing_area_unit', ['sqft', 'sqin']);

/**
 * A printer's own sub-category. Platform suggestions are copied in as rows when a printer
 * picks them, so a printer can rename "Brand Sticker" to whatever their customers call it
 * without affecting anyone else. isCustom records whether they typed it themselves, which is
 * what admin reviews to spot names worth promoting to platform-wide suggestions.
 */
export const subcategories = pgTable('subcategories', {
  id: uuid('id').primaryKey().defaultRandom(),
  shopId: uuid('shop_id').notNull().references(() => shops.id, { onDelete: 'cascade' }),
  categorySlug: text('category_slug').notNull(),
  name: text('name').notNull(),
  isCustom: boolean('is_custom').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('subcat_shop_idx').on(t.shopId, t.categorySlug),
  uniqueIndex('subcat_shop_name_uq').on(t.shopId, t.categorySlug, t.name),
]);

/**
 * One product a printer sells, in their own words. This is where V2's flexibility lives: the
 * printer names it, describes it, photographs it and prices it however they think about it.
 */
export const listings = pgTable('listings', {
  id: uuid('id').primaryKey().defaultRandom(),
  shopId: uuid('shop_id').notNull().references(() => shops.id, { onDelete: 'cascade' }),
  subcategoryId: uuid('subcategory_id').references(() => subcategories.id, { onDelete: 'set null' }),
  // Denormalised so category search does not need to join through subcategories.
  categorySlug: text('category_slug').notNull(),

  name: text('name').notNull(),
  description: text('description'),
  photos: jsonb('photos').$type<string[]>().notNull().default([]), // max 3, enforced in the action

  pricingMode: listingPricingMode('pricing_mode').notNull().default('quote'),
  // piece mode
  ratePerPieceKobo: integer('rate_per_piece_kobo'),
  // area mode
  ratePerAreaKobo: integer('rate_per_area_kobo'),
  areaUnit: areaUnitEnum('area_unit'),
  /**
   * Restored by founder decision Sept 2026, reversing QA 3.1. Protects a printer against a
   * very small custom size calculating out below their base cost.
   */
  minChargeKobo: integer('min_charge_kobo'),

  minimumOrder: integer('minimum_order'),
  turnaroundHours: integer('turnaround_hours').notNull().default(24),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('listings_shop_idx').on(t.shopId, t.isActive),
  index('listings_category_idx').on(t.categorySlug, t.isActive),
  index('listings_subcat_idx').on(t.subcategoryId),
]);

/** Up to MAX_TIERS rows per listing where pricingMode = 'tier'. */
export const listingTiers = pgTable('listing_tiers', {
  id: uuid('id').primaryKey().defaultRandom(),
  listingId: uuid('listing_id').notNull().references(() => listings.id, { onDelete: 'cascade' }),
  quantity: integer('quantity').notNull(),
  priceKobo: integer('price_kobo').notNull(),
}, (t) => [
  uniqueIndex('listing_tier_qty_uq').on(t.listingId, t.quantity),
]);

/* ------------------------------------------------------------------ */
/* Designers (Batch 4)                                                 */
/* ------------------------------------------------------------------ */

/**
 * A designer's public storefront. Deliberately shaped like `shops`: designers set their own
 * prices and customers pick them from a portfolio, exactly as with printers — so the same
 * verification, settlement and rating machinery applies rather than a parallel set of rules.
 *
 * No location fields. Design is delivered as a file, so proximity is irrelevant and the
 * distance sorting that governs printer choice has no meaning here.
 */
export const designerStudios = pgTable('designer_studios', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  code: text('code').notNull(),
  displayName: text('display_name').notNull(),
  slug: text('slug').notNull(),
  tagline: text('tagline'),
  bio: text('bio'),
  avatarUrl: text('avatar_url'),
  bannerUrl: text('banner_url'),
  // The portfolio IS the application — there is no work permit to check for design.
  verification: verificationStatus('verification').notNull().default('pending'),
  verificationNote: text('verification_note'),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  ratingAvg: doublePrecision('rating_avg').notNull().default(0),
  ratingCount: integer('rating_count').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('designer_user_uq').on(t.userId),
  uniqueIndex('designer_slug_uq').on(t.slug),
  uniqueIndex('designer_code_uq').on(t.code),
  index('designer_verified_idx').on(t.verification, t.isActive),
]);

/** Portfolio images. What a customer actually judges a designer on. */
export const designerWorks = pgTable('designer_works', {
  id: uuid('id').primaryKey().defaultRandom(),
  studioId: uuid('studio_id').notNull().references(() => designerStudios.id, { onDelete: 'cascade' }),
  imageUrl: text('image_url').notNull(),
  caption: text('caption'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('designer_works_studio_idx').on(t.studioId, t.sortOrder),
]);

/**
 * What a designer sells. Revisions are priced explicitly because T&C section 10 promises a
 * set number included and charges for the rest — a number the customer must see up front,
 * not discover mid-job.
 */
export const designerServices = pgTable('designer_services', {
  id: uuid('id').primaryKey().defaultRandom(),
  studioId: uuid('studio_id').notNull().references(() => designerStudios.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  priceKobo: integer('price_kobo').notNull(),
  revisionsIncluded: integer('revisions_included').notNull().default(2),
  extraRevisionKobo: integer('extra_revision_kobo').notNull().default(0),
  turnaroundHours: integer('turnaround_hours').notNull().default(48),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('designer_services_studio_idx').on(t.studioId, t.isActive),
]);

/**
 * A design job's lifecycle. Two shapes share it, because Refund section 10 gives the customer
 * the choice up front:
 *   review  — brief_received -> in_progress -> proof_ready -> (revision_requested ->
 *             in_progress -> proof_ready)* -> approved
 *   direct  — brief_received -> in_progress -> approved   (no proof gate at all)
 */
export const designStatus = pgEnum('design_status', [
  'brief_received', 'in_progress', 'proof_ready', 'revision_requested', 'approved', 'cancelled',
]);

/** Refund section 10: Option A reviews before printing, Option B goes straight to print. */
export const designReviewMode = pgEnum('design_review_mode', ['review', 'direct']);

export const designOrders = pgTable('design_orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull(),
  customerId: uuid('customer_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  studioId: uuid('studio_id').notNull().references(() => designerStudios.id, { onDelete: 'restrict' }),
  serviceId: uuid('service_id').references(() => designerServices.id, { onDelete: 'set null' }),

  serviceTitle: text('service_title').notNull(), // frozen: the service may be edited later
  reviewMode: designReviewMode('review_mode').notNull().default('review'),
  status: designStatus('status').notNull().default('brief_received'),

  brief: text('brief').notNull(),
  briefFileUrl: text('brief_file_url'),
  contactEmail: text('contact_email').notNull(),
  contactPhone: text('contact_phone').notNull(),

  // Money, all in kobo. The margin is a flat platform amount, not a share of the designer's fee.
  designerBaseKobo: integer('designer_base_kobo').notNull(),
  marginKobo: integer('margin_kobo').notNull(),
  platformFeeKobo: integer('platform_fee_kobo').notNull(),
  amountPaidKobo: integer('amount_paid_kobo').notNull(),

  // Snapshot at purchase: editing the service later must not change what was already sold.
  revisionsIncluded: integer('revisions_included').notNull().default(0),
  revisionsUsed: integer('revisions_used').notNull().default(0),
  extraRevisionKobo: integer('extra_revision_kobo').notNull().default(0),

  paymentStatus: paymentStatus('payment_status').notNull().default('unpaid'),
  settlementStatus: settlementStatus('settlement_status').notNull().default('pending'),
  refundStatus: refundStatus('refund_status').notNull().default('none'),
  refundAmountKobo: integer('refund_amount_kobo'),
  refundReason: text('refund_reason'),

  finalFileUrl: text('final_file_url'),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  legalVersionAccepted: text('legal_version_accepted'),
  opsNote: text('ops_note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('design_orders_code_uq').on(t.code),
  index('design_orders_studio_idx').on(t.studioId, t.status),
  index('design_orders_customer_idx').on(t.customerId),
]);

/** Every proof the designer has sent, kept as a numbered history rather than overwritten. */
export const designProofs = pgTable('design_proofs', {
  id: uuid('id').primaryKey().defaultRandom(),
  designOrderId: uuid('design_order_id').notNull().references(() => designOrders.id, { onDelete: 'cascade' }),
  round: integer('round').notNull(),
  fileUrl: text('file_url').notNull(),
  note: text('note'),
  /**
   * Approving a proof is what shifts liability to the customer under Terms section 9, so it
   * is recorded against the exact proof they saw — not just as a flag on the order.
   */
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  revisionNote: text('revision_note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('design_proof_round_uq').on(t.designOrderId, t.round),
]);

/**
 * A paid revision beyond the included allowance. Charged as its own Paystack transaction, so
 * the customer authorises each extra explicitly rather than finding a larger bill later.
 */
export const designRevisionCharges = pgTable('design_revision_charges', {
  id: uuid('id').primaryKey().defaultRandom(),
  designOrderId: uuid('design_order_id').notNull().references(() => designOrders.id, { onDelete: 'cascade' }),
  reference: text('reference').notNull(),
  amountKobo: integer('amount_kobo').notNull(),
  paymentStatus: paymentStatus('payment_status').notNull().default('unpaid'),
  consumedAt: timestamp('consumed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('design_revision_ref_uq').on(t.reference),
  index('design_revision_order_idx').on(t.designOrderId, t.paymentStatus),
]);

/* ------------------------------------------------------------------ */
/* Preflight (Module 3)                                                */
/* ------------------------------------------------------------------ */

export const preflightStatus = pgEnum('preflight_status', ['pending', 'passed', 'failed']);

/**
 * One review round. A resubmission creates a NEW row rather than overwriting, so the history
 * of what was checked and what was found survives into any later dispute.
 */
export const preflightReviews = pgTable('preflight_reviews', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  round: integer('round').notNull(),
  fileUrl: text('file_url').notNull(),
  fileName: text('file_name'),
  status: preflightStatus('status').notNull().default('pending'),
  /**
   * Findings, one per failed check. Written by the automated module where it can decide, and
   * by the human reviewer otherwise — the shape is the same either way, which is what lets
   * automation be added later without touching this table (§8.3).
   */
  findings: jsonb('findings').$type<{ check: string; note: string }[]>().notNull().default([]),
  /** 'auto' once the automated module can clear a file on its own; 'human' in V1. */
  decidedBy: text('decided_by'),
  reviewerNote: text('reviewer_note'),
  submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
  decidedAt: timestamp('decided_at', { withTimezone: true }),
}, (t) => [
  uniqueIndex('preflight_round_uq').on(t.orderId, t.round),
  index('preflight_status_idx').on(t.status, t.submittedAt),
]);

/* ------------------------------------------------------------------ */
/* FAQ (admin-managed)                                                 */
/* ------------------------------------------------------------------ */

/**
 * Customer-facing questions, editable from /admin/faq. The answers change as operations
 * change — delivery, fees, turnaround — and none of that should need a deploy.
 */
export const faqEntries = pgTable('faq_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  question: text('question').notNull(),
  answer: text('answer').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  isPublished: boolean('is_published').notNull().default(true),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('faq_published_idx').on(t.isPublished, t.sortOrder),
]);

/* ------------------------------------------------------------------ */
/* Commercial margins (admin-managed, platform-wide)                   */
/* ------------------------------------------------------------------ */

/**
 * The margin is PrintRuns' own commercial layer, not the printer's — a printer never sees it
 * and never sets it. It therefore belongs to the platform, per category, and must be editable
 * without a deploy (decision 2's principle, applied to decisions 16 and 23).
 *
 * products.margin* stays as the per-row fallback for anything not configured here.
 */
export const categoryMargins = pgTable('category_margins', {
  categorySlug: text('category_slug').primaryKey(),
  marginType: marginType('margin_type').notNull().default('fixed'),
  marginFixedKobo: integer('margin_fixed_kobo').notNull().default(0),
  marginPercentBps: integer('margin_percent_bps').notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/* ------------------------------------------------------------------ */
/* Catalog photography (admin-managed, platform-wide)                  */
/* ------------------------------------------------------------------ */

/**
 * The photos on the Products grid and the type-selection page belong to the PLATFORM, not to
 * any one printer — every shop's Round Cut sticker shows the same picture. Keyed by
 * 'category' or 'category:listing' so one small table covers both levels.
 */
export const catalogPhotos = pgTable('catalog_photos', {
  key: text('key').primaryKey(),
  url: text('url').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/* ------------------------------------------------------------------ */
/* Products (each printer lists + prices their own)                    */
/* ------------------------------------------------------------------ */

export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  shopId: uuid('shop_id').notNull().references(() => shops.id, { onDelete: 'cascade' }),
  categorySlug: text('category_slug').notNull(),
  /**
   * QA 3.4: where a category has more than one listing (Sticker → Round Cut, Business Card →
   * Rounded), each listing is its OWN product row with its OWN pricing grid. Null on legacy
   * rows created before listings existed.
   */
  listingSlug: text('listing_slug'),
  name: text('name').notNull(),
  description: text('description'),
  photoUrl: text('photo_url'),
  pricingMode: pricingMode('pricing_mode').notNull(),
  areaUnit: areaUnit('area_unit'),
  ratePerUnitKobo: integer('rate_per_unit_kobo'),
  // QA 3.1 removed the minimum-charge field from the printer UI. The column stays so old rows
  // are not destroyed, but nothing writes it and the pricing engine no longer reads it.
  minChargeKobo: integer('min_charge_kobo'),
  // QA 3.1: Banner only — does this printer offer hylet? Always free, so there is no price.
  offersHylet: boolean('offers_hylet').notNull().default(false),
  // V2 margin (decision 1, 2, 16, 23)
  marginType: marginType('margin_type').notNull().default('fixed'),
  marginFixedKobo: integer('margin_fixed_kobo').notNull().default(0),
  marginPercentBps: integer('margin_percent_bps').notNull().default(0),
  turnaroundHours: integer('turnaround_hours').notNull().default(24),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('products_shop_idx').on(t.shopId),
  index('products_cat_active_idx').on(t.categorySlug, t.isActive),
  index('products_cat_listing_idx').on(t.categorySlug, t.listingSlug, t.isActive),
]);

/* ------------------------------------------------------------------ */
/* Variants                                                            */
/* ------------------------------------------------------------------ */

export const productVariants = pgTable('product_variants', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  label: text('label'),
  qty: integer('qty'),
  priceKobo: integer('price_kobo').notNull(), // Printer Base Price for this row
  meta: jsonb('meta').$type<Record<string, string | number>>(),
}, (t) => [
  index('variants_product_idx').on(t.productId),
]);

/* ------------------------------------------------------------------ */
/* Add-ons                                                             */
/* ------------------------------------------------------------------ */

export const productAddons = pgTable('product_addons', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  kind: addonKind('kind').notNull(),
  label: text('label').notNull(),
  basis: addonBasis('basis').notNull(),
  priceKobo: integer('price_kobo').notNull(),
}, (t) => [
  index('addons_product_idx').on(t.productId),
]);

/* ------------------------------------------------------------------ */
/* Orders                                                              */
/* ------------------------------------------------------------------ */

export type OrderSpec = {
  category: string;
  listing?: string;         // legacy: the customer-visible type within the old fixed catalogue

  /**
   * V2 (Module 2). An order now points at a printer's own listing, and freezes what that
   * listing said at the moment of purchase. The printer may rename or reprice it afterwards —
   * the order must still describe what was actually bought.
   */
  listingId?: string;
  listingName?: string;
  pricingMode?: 'tier' | 'piece' | 'area' | 'quote';
  priceDetail?: string;
  qty?: number;
  width?: number;
  height?: number;
  unit?: string;
  sizeLabel?: string;
  sheets?: number;
  options?: Record<string, string>;
  addons?: Record<string, string>;
  printNote?: string;
  breakdown?: { label: string; amountKobo: number }[];
};

export const orders = pgTable('orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull(),
  customerId: uuid('customer_id').notNull().references(() => users.id),
  shopId: uuid('shop_id').notNull().references(() => shops.id),
  /**
   * Legacy pointer into the retired fixed-catalogue products table. Nullable since V2: an
   * order now points at listingId instead, and products has been emptied. Kept so historic
   * orders still resolve rather than being rewritten.
   */
  productId: uuid('product_id').references(() => products.id),
  /** V2: the printer's own listing this order came from. Null on legacy orders. */
  listingId: uuid('listing_id'),
  /**
   * Request Quote (Module 2 §7). The printer names a price through the platform; the customer
   * accepts and pays, or declines. Kept on the order rather than in a side table because a
   * quote IS the order — it just has no price yet.
   */
  quotedPriceKobo: integer('quoted_price_kobo'),
  quotedAt: timestamp('quoted_at', { withTimezone: true }),
  quoteNote: text('quote_note'),
  quoteDeclinedAt: timestamp('quote_declined_at', { withTimezone: true }),

  /**
   * Preflight (Module 3). The override flag is permanent by design: if the customer later
   * raises a quality complaint, it is the evidence that they were warned and accepted
   * responsibility (§6.4). It is never cleared, even by a later passing resubmission.
   */
  preflightRequested: boolean('preflight_requested').notNull().default(false),
  preflightOverriddenAt: timestamp('preflight_overridden_at', { withTimezone: true }),
  // Charged at order placement when the paid tier is switched on. Zero at launch, but the
  // column exists now so turning it on is a settings change rather than a flow change (§7).
  preflightFeeKobo: integer('preflight_fee_kobo').notNull().default(0),
  spec: jsonb('spec').$type<OrderSpec>().notNull(),
  isQuote: boolean('is_quote').notNull().default(false),

  /* V2 3-layer pricing snapshot (decision 1). Kobo amounts are frozen at order time
     even if the product's margin or the platform fee changes later. */
  printerBaseKobo: integer('printer_base_kobo'),
  marginKobo: integer('margin_kobo'),
  sellingPriceKobo: integer('selling_price_kobo'),
  platformFeeKobo: integer('platform_fee_kobo'),
  amountPaidKobo: integer('amount_paid_kobo'),
  deliveryFeeKobo: integer('delivery_fee_kobo'), // null until the printer names it post-payment (B1)
  deliveryFeeStatus: deliveryFeeStatus('delivery_fee_status').notNull().default('not_set'),
  deliveryFeeQuotedAt: timestamp('delivery_fee_quoted_at', { withTimezone: true }),
  deliveryFeeRespondedAt: timestamp('delivery_fee_responded_at', { withTimezone: true }),
  opsNote: text('ops_note'), // free-text log for the rep handling this order
  /**
   * Which version of the Terms, Privacy Policy, Refund Policy and Acceptable Use Policy the
   * customer accepted at checkout. Recorded per order rather than per account, because the
   * documents change over time and a dispute is always about one specific order.
   */
  legalVersionAccepted: text('legal_version_accepted'),
  legalAcceptedAt: timestamp('legal_accepted_at', { withTimezone: true }),

  /* V2 fulfilment: never a customer checkout choice (decision 19, 28 Jul). */
  fulfillmentMethod: fulfillmentMethod('fulfillment_method').notNull().default('delivery'),
  deliveryAddress: text('delivery_address'),
  collectionAuthorizedName: text('collection_authorized_name'),
  collectionAuthorizedPhone: text('collection_authorized_phone'),

  /* V2 required checkout contact fields (decision 21). */
  contactEmail: text('contact_email'),
  contactPhonePrimary: text('contact_phone_primary'),
  contactPhoneSecondary: text('contact_phone_secondary'),

  status: orderStatus('status').notNull().default('order_received'),
  paymentStatus: paymentStatus('payment_status').notNull().default('unpaid'),

  /* V2 settlement (decision 20): trigger is confirmed handover, not delivery specifically. */
  settlementStatus: settlementStatus('settlement_status').notNull().default('pending'),
  settledAt: timestamp('settled_at', { withTimezone: true }),

  refundStatus: refundStatus('refund_status').notNull().default('none'),
  refundAmountKobo: integer('refund_amount_kobo'),
  refundReason: text('refund_reason'),

  designFileUrl: text('design_file_url'),
  designFileName: text('design_file_name'),
  printNote: text('print_note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  readyAt: timestamp('ready_at', { withTimezone: true }),
  handoverAt: timestamp('handover_at', { withTimezone: true }),
}, (t) => [
  uniqueIndex('orders_code_uq').on(t.code),
  index('orders_shop_status_idx').on(t.shopId, t.status),
  index('orders_customer_created_idx').on(t.customerId, t.createdAt),
]);

/* ------------------------------------------------------------------ */
/* Order reassignments (decision 15/B4)                                 */
/* ------------------------------------------------------------------ */

export const orderReassignments = pgTable('order_reassignments', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  fromShopId: uuid('from_shop_id').notNull().references(() => shops.id),
  toShopId: uuid('to_shop_id').references(() => shops.id),
  oldSellingPriceKobo: integer('old_selling_price_kobo').notNull(),
  newSellingPriceKobo: integer('new_selling_price_kobo'),
  diffKobo: integer('diff_kobo'),
  resolution: reassignmentResolution('resolution').notNull(),
  reason: text('reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
}, (t) => [
  index('reassignments_order_idx').on(t.orderId),
]);

/* ------------------------------------------------------------------ */
/* Payments ledger                                                      */
/* ------------------------------------------------------------------ */

export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  reference: text('reference').notNull(),
  amountKobo: integer('amount_kobo').notNull(),
  channel: text('channel'),
  status: text('status').notNull(),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  raw: jsonb('raw'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('payments_ref_uq').on(t.reference),
  index('payments_order_idx').on(t.orderId),
]);

/* ------------------------------------------------------------------ */
/* Reviews                                                             */
/* ------------------------------------------------------------------ */

export const reviews = pgTable('reviews', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  shopId: uuid('shop_id').notNull().references(() => shops.id, { onDelete: 'cascade' }),
  customerId: uuid('customer_id').notNull().references(() => users.id),
  rating: integer('rating').notNull(),
  comment: text('comment'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('reviews_order_uq').on(t.orderId),
  index('reviews_shop_created_idx').on(t.shopId, t.createdAt),
]);

/* ------------------------------------------------------------------ */
/* Relations                                                           */
/* ------------------------------------------------------------------ */

export const usersRelations = relations(users, ({ one, many }) => ({
  shop: one(shops, { fields: [users.id], references: [shops.userId] }),
  orders: many(orders),
}));

export const shopsRelations = relations(shops, ({ one, many }) => ({
  owner: one(users, { fields: [shops.userId], references: [users.id] }),
  products: many(products),
  orders: many(orders),
  reviews: many(reviews),
  categoryVerifications: many(shopCategoryVerifications),
}));

export const shopCategoryVerificationsRelations = relations(shopCategoryVerifications, ({ one }) => ({
  shop: one(shops, { fields: [shopCategoryVerifications.shopId], references: [shops.id] }),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  shop: one(shops, { fields: [products.shopId], references: [shops.id] }),
  variants: many(productVariants),
  addons: many(productAddons),
}));

export const productVariantsRelations = relations(productVariants, ({ one }) => ({
  product: one(products, { fields: [productVariants.productId], references: [products.id] }),
}));

export const productAddonsRelations = relations(productAddons, ({ one }) => ({
  product: one(products, { fields: [productAddons.productId], references: [products.id] }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  customer: one(users, { fields: [orders.customerId], references: [users.id] }),
  shop: one(shops, { fields: [orders.shopId], references: [shops.id] }),
  product: one(products, { fields: [orders.productId], references: [products.id] }),
  reassignments: many(orderReassignments),
}));

export const orderReassignmentsRelations = relations(orderReassignments, ({ one }) => ({
  order: one(orders, { fields: [orderReassignments.orderId], references: [orders.id] }),
  fromShop: one(shops, { fields: [orderReassignments.fromShopId], references: [shops.id] }),
  toShop: one(shops, { fields: [orderReassignments.toShopId], references: [shops.id] }),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
  shop: one(shops, { fields: [reviews.shopId], references: [shops.id] }),
  order: one(orders, { fields: [reviews.orderId], references: [orders.id] }),
  customer: one(users, { fields: [reviews.customerId], references: [users.id] }),
}));
