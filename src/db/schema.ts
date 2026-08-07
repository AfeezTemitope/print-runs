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
  listing?: string;         // QA: the customer-visible type within the category
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
  productId: uuid('product_id').notNull().references(() => products.id),
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
