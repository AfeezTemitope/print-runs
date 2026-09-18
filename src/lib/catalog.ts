/**
 * V2 category system (Module 1, Section 2).
 *
 * PrintRuns owns the top-level categories — they exist for search and discovery, and a printer
 * can neither rename nor remove them. Everything below that line belongs to the printer:
 * sub-categories (suggestions plus their own), listing names, photos, descriptions and prices.
 *
 * This replaces the fixed eight-product catalogue, where the platform defined the product and
 * every printer filled in the same matrix.
 */

export type Category = {
  slug: string;
  name: string;
  blurb: string;
  glyph: string;
  hue: string;
  /** Suggested sub-categories. A printer may use these, rename them, or add their own. */
  suggested: string[];
  /**
   * Founder decision, Sept 2026: Apparel & Merch ships as Coming Soon (no printer is onboarded
   * for it), and Frames & Photo stays hidden until the reason it was originally pulled is
   * resolved. Both stay in the category system so neither needs adding back later.
   */
  status: 'live' | 'coming_soon' | 'hidden';
};

export const CATEGORIES: Category[] = [
  {
    slug: 'banners-signage',
    name: 'Banners & Signage',
    blurb: 'Roll-ups, backdrops, outdoor banners and vehicle branding.',
    glyph: 'banner', hue: '#2D2AE8', status: 'live',
    suggested: ['Roll-up/Pull-up Banner', 'Custom Banner/Backdrop', 'Outdoor Banner', 'Vehicle Branding/Wrap'],
  },
  {
    slug: 'stickers-labels',
    name: 'Stickers & Labels',
    blurb: 'Brand stickers, large format, clear vinyl and packaging labels.',
    glyph: 'sticker', hue: '#F5E642', status: 'live',
    suggested: ['Brand Sticker', 'Large Format/Custom Sticker', 'Clear/Transparent Sticker', 'Product/Packaging Labels'],
  },
  {
    slug: 'cards-stationery',
    name: 'Cards & Stationery',
    blurb: 'Business cards, complimentary cards, invitations and thank you cards.',
    glyph: 'card', hue: '#0B1D4D', status: 'live',
    suggested: ['Business Cards', 'Complimentary Cards', 'Invitation Cards', 'Thank You Cards'],
  },
  {
    slug: 'books-booklets',
    name: 'Books & Booklets',
    blurb: 'Jotters, notebooks, receipt books and invoice booklets.',
    glyph: 'jotter', hue: '#2D2AE8', status: 'live',
    suggested: ['Jotters/Notebooks', 'Receipt Books/Invoice Booklets'],
  },
  {
    slug: 'flyers-handbills',
    name: 'Flyers & Handbills',
    blurb: 'Standard and square flyers, handbills and inserts.',
    glyph: 'flyer', hue: '#F5E642', status: 'live',
    suggested: ['Standard Flyer', 'Modern/Square Flyer'],
  },
  {
    slug: 'packaging',
    name: 'Packaging',
    blurb: 'Branded nylon, paper bags and custom boxes.',
    glyph: 'nylon', hue: '#0B1D4D', status: 'live',
    suggested: ['Branded Nylon/Polybags', 'Paper Bags', 'Custom Boxes'],
  },
  {
    slug: 'id-access',
    name: 'ID & Access',
    blurb: 'ID cards, lanyards and event wristbands.',
    glyph: 'idcard', hue: '#2D2AE8', status: 'live',
    suggested: ['ID Cards', 'Lanyards/Wristbands'],
  },
  {
    slug: 'apparel-merch',
    name: 'Apparel & Merch',
    blurb: 'T-shirt and cap branding, mugs and bottles.',
    glyph: 'apparel', hue: '#F5E642', status: 'coming_soon',
    suggested: ['T-Shirt/Polo Branding', 'Cap Branding', 'Mug/Bottle Printing'],
  },
  {
    slug: 'frames-photo',
    name: 'Frames & Photo',
    blurb: 'Frame printing, photo and canvas printing.',
    glyph: 'frame', hue: '#0B1D4D', status: 'hidden',
    suggested: ['Frame Printing', 'Photo/Canvas Printing'],
  },
];

/** Categories a printer may list under, and a customer may search. */
export const LIVE_CATEGORIES = CATEGORIES.filter((c) => c.status === 'live');

/** Shown to customers but not orderable — Apparel & Merch at launch. */
export const BROWSABLE_CATEGORIES = CATEGORIES.filter((c) => c.status !== 'hidden');

export function getCategory(slug: string | undefined): Category | undefined {
  return slug ? CATEGORIES.find((c) => c.slug === slug) : undefined;
}

export function isLive(slug: string | undefined): boolean {
  return getCategory(slug)?.status === 'live';
}

/* ------------------------------------------------------------------ */
/* Pricing modes (Module 1, Section 5)                                 */
/* ------------------------------------------------------------------ */

export type PricingMode = 'tier' | 'piece' | 'area';

/**
 * All three modes are selectable on every listing. The platform may hint at what is common for
 * a category but must never restrict — a roll-up banner is genuinely better priced per piece
 * than per sq.ft, which is exactly why the old per-category lock was wrong.
 */
export const PRICING_MODES: { value: PricingMode; label: string; hint: string }[] = [
  { value: 'tier', label: 'Quantity tiers', hint: 'Set up to 3 quantity/price pairs' },
  { value: 'piece', label: 'Per piece', hint: 'One rate, customer enters any quantity' },
  { value: 'area', label: 'Per sq.ft / sq.in', hint: 'Rate by area, customer enters width and height' },
];

/** Soft suggestion only — never enforced. */
export const SUGGESTED_MODE: Record<string, PricingMode> = {
  'banners-signage': 'area',
  'stickers-labels': 'tier',
  'cards-stationery': 'tier',
  'books-booklets': 'tier',
  'flyers-handbills': 'tier',
  'packaging': 'tier',
  'id-access': 'piece',
  'apparel-merch': 'piece',
  'frames-photo': 'area',
};

/**
 * Max quantity tiers per listing. The spec caps this at 3 for launch but requires it to be
 * configurable rather than hardcoded, so it can be raised for specific printers later.
 */
export const MAX_TIERS = 3;

/**
 * Custom sub-categories a printer may create beyond the platform suggestions. The spec leaves
 * the threshold as a business decision; this is the starting value and is meant to be raised
 * from admin rather than in code.
 */
export const MAX_CUSTOM_SUBCATEGORIES = 5;

/* ------------------------------------------------------------------ */
/* Reserved storefront slugs                                           */
/* ------------------------------------------------------------------ */

/**
 * Printers get printruns.ng/[slug], which shares a namespace with every top-level route. A
 * printer called "Products" would otherwise take over the products page. Signup rejects these
 * and suggests a variant, the same way it already handles a duplicate slug.
 */
export const RESERVED_SLUGS = new Set([
  'admin', 'api', 'checkout', 'configure', 'dashboard', 'data', 'design', 'designers',
  'faq', 'fonts', 'legal', 'login', 'logout', 'manifest', 'marketplace', 'orders',
  'preflight', 'printers', 'products', 'register', 'robots', 'sitemap', 'studio',
  'support', 'track', 'about', 'contact', 'help', 'settings', 'account', 'new', 'search',
  'me', 'us', 'www', 'static', 'public', 'assets', 'images', 'img', 'favicon',
]);

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug.toLowerCase());
}

/* ------------------------------------------------------------------ */
/* Legacy compatibility                                                */
/* ------------------------------------------------------------------ */

/**
 * Orders placed before V2 carry the old fixed-catalogue slugs. They still have to render a
 * sensible name on an order screen years later, so the mapping lives here rather than keeping
 * the whole retired categories module alive for eight strings.
 */
const LEGACY_NAMES: Record<string, string> = {
  banner: 'Flex / Banner',
  jotter: 'Jotter',
  flyer: 'Flyer',
  business_card: 'Business Card',
  sticker: 'Sticker',
  nylon: 'Brand Nylon',
  thank_you_card: 'Thank You Card',
  id_card: 'ID Card',
  frame: 'Frame',
  paper_bag: 'Paper Bag',
};

/** Display name for any category slug, V2 or legacy. Never throws on an unknown slug. */
export function categoryName(slug: string | undefined | null): string {
  if (!slug) return '';
  return getCategory(slug)?.name ?? LEGACY_NAMES[slug] ?? slug.replace(/[_-]/g, ' ');
}

/**
 * Which V2 category a legacy slug became, for anything still keyed on the old values —
 * principally the commercial margins seeded before the storefront rebuild.
 */
export const LEGACY_TO_V2: Record<string, string> = {
  banner: 'banners-signage',
  jotter: 'books-booklets',
  flyer: 'flyers-handbills',
  business_card: 'cards-stationery',
  thank_you_card: 'cards-stationery',
  sticker: 'stickers-labels',
  nylon: 'packaging',
  id_card: 'id-access',
  frame: 'frames-photo',
};
