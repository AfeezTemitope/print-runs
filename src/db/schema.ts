import {
  pgTable, pgEnum, uuid, text, integer, boolean, doublePrecision,
  timestamp, jsonb, uniqueIndex, index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

/* ------------------------------------------------------------------ */
/* Enums                                                               */
/* ------------------------------------------------------------------ */

// 'admin' reserved now so no enum migration later.
export const userRole = pgEnum('user_role', ['customer', 'printer', 'designer', 'admin']);

export const pricingMode = pgEnum('pricing_mode', [
  'per_area',   // banners, large stickers — rate × w × h
  'per_sheet',  // business card "Print only" — price per A4 sheet
  'tier',       // qty tiers — bulk stickers, flyers, Print+Cut cards, nylon
  'fixed_size', // frames — closed size list (A2, A3...)
  'matrix',     // jotters — cover × size × sheet-count rows
  'quote',      // no price shown; universal fallback
]);

export const areaUnit = pgEnum('area_unit', ['sqft', 'sqin']);

export const addonKind = pgEnum('addon_kind', ['lamination', 'gsm', 'corner', 'sides']);
export const addonBasis = pgEnum('addon_basis', ['per_sheet', 'per_piece', 'flat']);

// Payment success moves order straight to 'printing' (it enters the queue).
// Button 2 (Mark printing done) => 'ready'. Button 3 (Dispatch/Notify) => 'completed'.
export const orderStatus = pgEnum('order_status', ['placed', 'printing', 'ready', 'completed', 'cancelled']);
export const paymentStatus = pgEnum('payment_status', ['unpaid', 'paid', 'refunded']);
export const fulfillmentMethod = pgEnum('fulfillment_method', ['delivery', 'pickup']);

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

export const shops = pgTable('shops', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  code: text('code').notNull(),               // vendor code, e.g. LB-014 (spec 7.4)
  businessName: text('business_name').notNull(),
  slug: text('slug').notNull(),
  bio: text('bio'),
  logoUrl: text('logo_url'),
  bannerUrl: text('banner_url'),
  addressText: text('address_text'),
  lat: doublePrecision('lat'),
  lng: doublePrecision('lng'),
  supportsDelivery: boolean('supports_delivery').notNull().default(true),
  supportsPickup: boolean('supports_pickup').notNull().default(false),
  openingHours: text('opening_hours'),
  ratingAvg: doublePrecision('rating_avg').notNull().default(0),
  ratingCount: integer('rating_count').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('shops_user_uq').on(t.userId),
  uniqueIndex('shops_slug_uq').on(t.slug),
  uniqueIndex('shops_code_uq').on(t.code),
  // Bounding-box prefilter for "printers near me"; haversine refines in app code.
  index('shops_geo_idx').on(t.lat, t.lng),
]);

/* ------------------------------------------------------------------ */
/* Products (each printer lists + prices their own)                    */
/* ------------------------------------------------------------------ */

export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  shopId: uuid('shop_id').notNull().references(() => shops.id, { onDelete: 'cascade' }),
  categorySlug: text('category_slug').notNull(), // sticker | banner | flyer | nylon | jotter | business_card | frame | paper_bag
  name: text('name').notNull(),
  description: text('description'),
  photoUrl: text('photo_url'),                   // real photography preferred (spec 7.5); glyph fallback
  pricingMode: pricingMode('pricing_mode').notNull(),
  // per_area
  areaUnit: areaUnit('area_unit'),
  ratePerUnitKobo: integer('rate_per_unit_kobo'),
  minChargeKobo: integer('min_charge_kobo'),
  // per_sheet (business card Print-only)
  perSheetKobo: integer('per_sheet_kobo'),
  cardsPerSheet: integer('cards_per_sheet'),
  turnaroundHours: integer('turnaround_hours').notNull().default(24),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('products_shop_idx').on(t.shopId),
  index('products_cat_active_idx').on(t.categorySlug, t.isActive),
]);

/* ------------------------------------------------------------------ */
/* Variants — one table, three uses:                                   */
/*   tier:       qty + price (+ label)                                 */
/*   fixed_size: label = size name (A2/A3), qty = 1                    */
/*   matrix:     meta = { cover, size, sheets } + price                */
/* ------------------------------------------------------------------ */

export const productVariants = pgTable('product_variants', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  label: text('label'),
  qty: integer('qty'),
  priceKobo: integer('price_kobo').notNull(),
  meta: jsonb('meta').$type<Record<string, string | number>>(),
}, (t) => [
  index('variants_product_idx').on(t.productId),
]);

/* ------------------------------------------------------------------ */
/* Add-ons — shared reusable component (spec §6): a printer prices     */
/* each option they offer; basis decides how it multiplies.            */
/* ------------------------------------------------------------------ */

export const productAddons = pgTable('product_addons', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  kind: addonKind('kind').notNull(),
  label: text('label').notNull(),          // must match the option label the customer picks
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
  qty?: number;
  width?: number;
  height?: number;
  unit?: string;            // ft | in | cm
  sizeLabel?: string;       // frames / presets
  serviceType?: string;     // business_card: print_only | print_cut
  cover?: string;           // jotter
  jSize?: string;           // jotter size
  sheets?: number;          // jotter
  addons?: Record<string, string>; // kind -> chosen label
  printNote?: string;
  breakdown?: { label: string; amountKobo: number }[];
};

export const orders = pgTable('orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull(),            // PR-2026-000123 — customer-facing + Paystack reference
  customerId: uuid('customer_id').notNull().references(() => users.id),
  shopId: uuid('shop_id').notNull().references(() => shops.id),
  productId: uuid('product_id').notNull().references(() => products.id),
  spec: jsonb('spec').$type<OrderSpec>().notNull(),
  isQuote: boolean('is_quote').notNull().default(false),
  priceKobo: integer('price_kobo'),        // null while a quote is unpriced
  fulfillmentMethod: fulfillmentMethod('fulfillment_method').notNull(),
  deliveryAddress: text('delivery_address'),
  status: orderStatus('status').notNull().default('placed'),
  paymentStatus: paymentStatus('payment_status').notNull().default('unpaid'),
  designFileUrl: text('design_file_url'),
  designFileName: text('design_file_name'),
  printNote: text('print_note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  readyAt: timestamp('ready_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
}, (t) => [
  uniqueIndex('orders_code_uq').on(t.code),
  index('orders_shop_status_idx').on(t.shopId, t.status),        // job queue + dashboard filters
  index('orders_customer_created_idx').on(t.customerId, t.createdAt), // order history
]);

/* ------------------------------------------------------------------ */
/* Payments ledger (reconciliation-friendly)                           */
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

export const ordersRelations = relations(orders, ({ one }) => ({
  customer: one(users, { fields: [orders.customerId], references: [users.id] }),
  shop: one(shops, { fields: [orders.shopId], references: [shops.id] }),
  product: one(products, { fields: [orders.productId], references: [products.id] }),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
  shop: one(shops, { fields: [reviews.shopId], references: [shops.id] }),
  order: one(orders, { fields: [reviews.orderId], references: [orders.id] }),
  customer: one(users, { fields: [reviews.customerId], references: [users.id] }),
}));
