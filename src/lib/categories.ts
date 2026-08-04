import type { GlyphKind } from '@/components/ui/Glyph';

/**
 * V2 category config — revised against Build QA Round 1 (August 2026).
 *
 * Data model: Product Category → Listing (type) → Specifications → Printer Pricing.
 *
 * NAVIGATION (QA 1.1): the Products grid shows ONE card per category. Categories with more
 * than one listing route to a photo-led type-selection page first, and only then to the
 * configurator. `listings` below drives that middle page.
 *
 * Each listing carries its own `code` (QA 1.2) so orders can be told apart in admin — the
 * three sticker types are PR-005-A/B/C, not three things all called PR-005.
 */

export type SizePreset = { label: string; width: number; height: number; unit: 'ft' | 'in' | 'cm'; note?: string };

export type OptionAxis = {
  key: string;
  label: string;
  options: string[];
  /** No "None" choice and no price difference — the customer must pick one (e.g. TYC Feel). */
  required?: boolean;
  /** Cosmetic only: shown to the customer, never priced (e.g. Business Card lamination). */
  cosmetic?: boolean;
  hint?: string;
};

/**
 * Pricing-grid axis.
 *
 * `qty`       — exact quantity tiers. A quantity that is not one of the listed values routes
 *               to Request Quote (QA 3.5: "Custom is a Request Quote routing, not a fourth
 *               priced tier"). It does NOT round up to the next tier.
 * `qty_range` — banded tiers, e.g. '1-500' | '501-1000' | '1000+'. Any quantity inside a band
 *               matches that band. Only Flyer uses this (QA 3.3).
 */
export type GridAxis = {
  key: string;
  label: string;
  source: 'option' | 'size' | 'qty' | 'qty_range' | 'cover' | 'sheets';
  values: (string | number)[];
};

export type PricingGrid = {
  axes: GridAxis[];
  /**
   * flat_batch — the cell price is the total for that whole batch.
   * per_piece   — the cell price is multiplied by the quantity ordered.
   * Explicit rather than inferred: Thank You Card has no quantity axis yet is per piece, and
   * Flyer has a quantity axis yet is also per piece, so presence of a qty axis proves nothing.
   */
  priceType: 'flat_batch' | 'per_piece';
};

export function gridCellCount(grid: PricingGrid): number {
  return grid.axes.reduce((n, a) => n * a.values.length, 1);
}

/** Fixed add-on rows pre-populated for the printer rather than added by hand (QA 3.3). */
export type FixedAddon = { kind: string; label: string; basis: 'per_piece' | 'flat' };

/**
 * A listing is a customer-visible type within a category. Where a category has more than one,
 * each listing is its OWN product row with its OWN pricing grid (QA 3.4: "each corner type is
 * its own full product with its own 24-cell matrix").
 */
export type Listing = {
  slug: string;
  label: string;
  blurb: string;
  code: string;
  size?: { presets: SizePreset[]; allowCustom: boolean; customOnly?: boolean; defaultUnit: 'ft' | 'in' | 'cm' };
  qty?: { presets: number[]; min: number; allowCustom: boolean; freeInput?: boolean };
  pricingGrid?: PricingGrid;
  perAreaRate?: boolean;
  optionAxes?: OptionAxis[];
  fixedAddons?: FixedAddon[];
};

export type Category = {
  slug: string;
  name: string;
  code: string;
  glyph: GlyphKind;
  hue: string;
  blurb: string;
  turnaround: string;
  live: boolean;
  listings: Listing[];
};

/* ------------------------------------------------------------------ */
/* Shared option sets                                                  */
/* ------------------------------------------------------------------ */

const SIDES: OptionAxis = {
  key: 'sides', label: 'Print sides', options: ['Front only', 'Front and back'], required: true,
};

/** QA 2.4: stays on the customer side, cosmetic only — price does not change with it. */
const BC_LAMINATION: OptionAxis = {
  key: 'lamination', label: 'Lamination', options: ['Matte', 'Gloss'],
  required: true, cosmetic: true, hint: 'Finish only — this does not change the price.',
};

/** Business Card: identical 24-cell matrix for each corner type (QA 3.4). */
const BC_GRID: PricingGrid = {
  priceType: 'flat_batch',
  axes: [
    { key: 'sides', label: 'Print sides', source: 'option', values: ['Front only', 'Front and back'] },
    { key: 'weight', label: 'Paper weight', source: 'option', values: ['300gsm', '600gsm', '900gsm'] },
    { key: 'qty', label: 'Quantity', source: 'qty', values: [100, 200, 500, 1000] },
  ],
};

const BC_WEIGHT: OptionAxis = {
  key: 'weight', label: 'Paper weight',
  options: ['300gsm (Thick)', '600gsm (Doubled thick)', '900gsm (Extra thick)'],
  required: true,
};

/**
 * Jotter size. Cover is chosen on the type-selection page (QA 2.2 removed the inner cover
 * dropdown), so size is the only dropdown left inside the Jotter configurator.
 * Founder-confirmed 04 Aug 2026: A6 and A5 only.
 */
const JOTTER_SIZE: OptionAxis = {
  key: 'size', label: 'Size', options: ['A6', 'A5'], required: true,
};

/** Sticker Round and Straight share a shape: 3 sizes × 3 quantity tiers (QA 3.5). */
const stickerGrid = (sizes: string[]): PricingGrid => ({
  priceType: 'flat_batch',
  axes: [
    { key: 'size', label: 'Size', source: 'size', values: sizes },
    { key: 'qty', label: 'Quantity', source: 'qty', values: [50, 100, 200] },
  ],
});

/* ------------------------------------------------------------------ */
/* Categories                                                          */
/* ------------------------------------------------------------------ */

export const CATEGORIES: Category[] = [
  {
    slug: 'banner', name: 'Flex / Banner', code: 'PR-001', glyph: 'banner', hue: '#00000A',
    blurb: 'Vinyl flex, any dimension.', turnaround: '24hrs', live: true,
    listings: [{
      slug: 'banner', label: 'Flex / Banner', blurb: 'Vinyl flex, any dimension.', code: 'PR-001',
      // QA 2.1: corrected preset set.
      size: {
        presets: [
          { label: '3 × 3 ft', width: 3, height: 3, unit: 'ft' },
          { label: '5 × 5 ft', width: 5, height: 5, unit: 'ft' },
          { label: '8 × 6 ft', width: 8, height: 6, unit: 'ft' },
          { label: '12 × 8 ft', width: 12, height: 8, unit: 'ft' },
        ],
        allowCustom: true, defaultUnit: 'ft',
      },
      // QA 2.1: priced per sq.ft, so quantity is 1 or a custom number — not batch presets.
      qty: { presets: [1], min: 1, allowCustom: true },
      perAreaRate: true,
      optionAxes: [{
        key: 'hylet', label: 'Hylet', options: ['4 corners', 'Top only'],
        required: false, cosmetic: true,
        hint: 'Free. Reinforced eyelets for hanging — choose where you want them.',
      }],
    }],
  },

  {
    slug: 'jotter', name: 'Jotter', code: 'PR-002', glyph: 'jotter', hue: '#00000A',
    blurb: 'Custom notebooks, soft or hard cover.', turnaround: '4 days', live: true,
    // QA 2.2: cover is chosen here, on the type-selection page — NOT again inside the configurator.
    listings: [
      {
        slug: 'soft_cover', label: 'Soft Cover', blurb: 'Flexible card cover.', code: 'PR-002-A',
        qty: { presets: [50, 100, 200], min: 50, allowCustom: true },
        optionAxes: [JOTTER_SIZE],
        pricingGrid: {
          priceType: 'flat_batch',
          axes: [
            // Founder-confirmed 04 Aug 2026: two sizes, A6 and A5. B5 is retired.
            // 2 covers (as separate listings) x 2 sizes x 3 sheet counts = 12 cells.
            { key: 'size', label: 'Size', source: 'option', values: ['A6', 'A5'] },
            { key: 'sheets', label: 'Sheets', source: 'sheets', values: [50, 75, 100] },
          ],
        },
      },
      {
        slug: 'hard_cover', label: 'Hard Cover', blurb: 'Rigid board cover.', code: 'PR-002-B',
        qty: { presets: [50, 100, 200], min: 50, allowCustom: true },
        optionAxes: [JOTTER_SIZE],
        pricingGrid: {
          priceType: 'flat_batch',
          axes: [
            { key: 'size', label: 'Size', source: 'option', values: ['A6', 'A5'] },
            { key: 'sheets', label: 'Sheets', source: 'sheets', values: [50, 75, 100] },
          ],
        },
      },
    ],
  },

  {
    slug: 'flyer', name: 'Flyer', code: 'PR-003', glyph: 'flyer', hue: '#0000FF',
    // QA 2.3: A6 never existed on this product.
    blurb: 'A5 flyers, standard or square format.', turnaround: '24hrs', live: true,
    listings: [{
      slug: 'flyer', label: 'Flyer', blurb: 'A5 flyers, standard or square format.', code: 'PR-003',
      qty: { presets: [50, 100, 200], min: 50, allowCustom: true },
      optionAxes: [{
        key: 'size', label: 'Size',
        options: ['A5 (Standard)', '5 × 5in Square (Modern)'], required: true,
      }],
      // QA 3.3: banded tiers, per-piece rate.
      pricingGrid: {
        priceType: 'per_piece',
        axes: [
          { key: 'size', label: 'Size', source: 'option', values: ['A5 (Standard)', '5 × 5in Square (Modern)'] },
          { key: 'qty', label: 'Quantity', source: 'qty_range', values: ['1-500', '501-1000', '1000+'] },
        ],
      },
      // QA 3.3: pre-populated rather than added by hand.
      fixedAddons: [
        { kind: 'sides', label: 'Front and back', basis: 'per_piece' },
        { kind: 'lamination', label: 'Matte', basis: 'per_piece' },
        { kind: 'lamination', label: 'Gloss', basis: 'per_piece' },
      ],
    }],
  },

  {
    slug: 'business_card', name: 'Business Card', code: 'PR-004', glyph: 'card', hue: '#00000A',
    blurb: 'Finished cards, straight or rounded corners.', turnaround: '24hrs', live: true,
    // QA 3.4: each corner type is its own product with its own 24-cell matrix, no add-ons.
    listings: [
      {
        slug: 'standard', label: 'Standard', blurb: 'Straight corners, classic finish.', code: 'PR-004-A',
        // Founder answer 04 Aug 2026: customer presets stay as they were (100/250/500/1000).
        // NOTE: the printer grid tiers are 100/200/500/1000, so a customer choosing 250 has no
        // matching cell and always routes to Request Quote. Deliberate, per that answer.
        qty: { presets: [100, 250, 500, 1000], min: 50, allowCustom: true },
        optionAxes: [BC_WEIGHT, SIDES, BC_LAMINATION],
        pricingGrid: BC_GRID,
      },
      {
        slug: 'rounded', label: 'Rounded', blurb: 'Rounded corners, softer look.', code: 'PR-004-B',
        qty: { presets: [100, 250, 500, 1000], min: 50, allowCustom: true },
        optionAxes: [BC_WEIGHT, SIDES, BC_LAMINATION],
        pricingGrid: BC_GRID,
      },
    ],
  },

  {
    slug: 'sticker', name: 'Sticker', code: 'PR-005', glyph: 'sticker', hue: '#0000FF',
    blurb: 'Round, straight cut or large format.', turnaround: '24hrs', live: true,
    // QA 2.5 / 2.6: no lamination on any sticker type.
    listings: [
      {
        slug: 'round', label: 'Round Cut', blurb: 'Circular die-cut stickers.', code: 'PR-005-A',
        size: {
          presets: [
            { label: '2.5 × 2.5 in', width: 2.5, height: 2.5, unit: 'in' },
            { label: '3 × 3 in', width: 3, height: 3, unit: 'in' },
            { label: '3.5 × 3.5 in', width: 3.5, height: 3.5, unit: 'in' },
          ],
          allowCustom: true, defaultUnit: 'in',
        },
        // QA 2.5: 50 is a hard minimum, not a suggestion.
        qty: { presets: [50, 100, 200], min: 50, allowCustom: true },
        pricingGrid: stickerGrid(['2.5 × 2.5 in', '3 × 3 in', '3.5 × 3.5 in']),
      },
      {
        slug: 'straight', label: 'Straight Cut', blurb: 'Square or rectangular cut.', code: 'PR-005-B',
        size: {
          presets: [
            { label: '2 × 2 in', width: 2, height: 2, unit: 'in' },
            { label: '3 × 2 in', width: 3, height: 2, unit: 'in' },
            { label: '3 × 5 in', width: 3, height: 5, unit: 'in' },
          ],
          allowCustom: true, defaultUnit: 'in',
        },
        qty: { presets: [50, 100, 200], min: 50, allowCustom: true },
        pricingGrid: stickerGrid(['2 × 2 in', '3 × 2 in', '3 × 5 in']),
      },
      {
        slug: 'large_format', label: 'Large Format', blurb: 'Big-format vinyl stickers.', code: 'PR-005-C',
        // QA 2.6: custom size only, in feet — same behaviour as Banner. No presets at all.
        size: { presets: [], allowCustom: true, customOnly: true, defaultUnit: 'ft' },
        qty: { presets: [1], min: 1, allowCustom: true },
        perAreaRate: true,
      },
    ],
  },

  {
    slug: 'nylon', name: 'Brand Nylon', code: 'PR-006', glyph: 'nylon', hue: '#0000FF',
    blurb: 'Branded polybags.', turnaround: '2 days', live: true,
    listings: [{
      slug: 'polybag', label: 'Polybag', blurb: 'Standard branded polybag.', code: 'PR-006',
      qty: { presets: [50, 100, 200], min: 50, allowCustom: true },
      // QA 2.7: sizes with usage notes, nylon colour and ink colour. No print-sides choice —
      // Brand Nylon is one-sided only.
      optionAxes: [
        {
          key: 'size', label: 'Size', required: true,
          options: ['A5 Mini', 'A4 Small', 'A3 Medium', 'A2 Large'],
          hint: 'A5 Mini for accessories · A4 Small for shirts · A3 Medium for multiple items · A2 Large for bulky orders',
        },
        { key: 'nylon_colour', label: 'Nylon colour', options: ['White', 'Custom'], required: true },
        { key: 'ink_colour', label: 'Ink colour', options: ['Black', 'Red', 'Custom'], required: true },
      ],
      pricingGrid: {
        priceType: 'flat_batch',
        axes: [
          { key: 'size', label: 'Size', source: 'option', values: ['A5 Mini', 'A4 Small', 'A3 Medium', 'A2 Large'] },
          { key: 'qty', label: 'Quantity', source: 'qty', values: [50, 100, 200] },
        ],
      },
    }],
  },

  {
    slug: 'thank_you_card', name: 'Thank You Card', code: 'PR-007', glyph: 'card', hue: '#FF0504',
    blurb: 'Insert cards for orders and gifts.', turnaround: '24hrs', live: true,
    listings: [{
      slug: 'thank_you_card', label: 'Thank You Card', blurb: 'Insert cards for orders and gifts.', code: 'PR-007',
      // QA 2.8: free number field with a hard minimum of 50 — no preset buttons.
      qty: { presets: [], min: 50, allowCustom: true, freeInput: true },
      optionAxes: [
        {
          key: 'size', label: 'Size', required: true,
          options: ['Normal (2.7 × 3.7in)', 'Big (5.5 × 4in)'],
        },
        // QA 2.8: replaces lamination. Required, no "None", no price difference.
        {
          key: 'feel', label: 'Feel', options: ['Matte', 'Gloss'],
          required: true, cosmetic: true, hint: 'Finish only — both cost the same.',
        },
        SIDES,
      ],
      pricingGrid: {
        priceType: 'per_piece',
        axes: [
          { key: 'size', label: 'Size', source: 'option', values: ['Normal (2.7 × 3.7in)', 'Big (5.5 × 4in)'] },
          { key: 'sides', label: 'Print sides', source: 'option', values: ['Front only', 'Front and back'] },
        ],
      },
    }],
  },

  {
    slug: 'id_card', name: 'ID Card', code: 'PR-008', glyph: 'card', hue: '#0000FF',
    blurb: 'Staff and event ID cards.', turnaround: '2 days', live: true,
    // QA 2.9: the floor is 1, not 10.
    listings: [{
      slug: 'id_card', label: 'ID Card', blurb: 'Staff and event ID cards.', code: 'PR-008',
      qty: { presets: [1, 10], min: 1, allowCustom: true },
      optionAxes: [SIDES],
      // QA 3.9: the simplest matrix on the platform.
      pricingGrid: {
        priceType: 'per_piece',
        axes: [
          { key: 'sides', label: 'Print sides', source: 'option', values: ['Front only', 'Front and back'] },
        ],
      },
    }],
  },

  /* --- Not live: kept defined so codes and existing rows stay stable --- */
  {
    slug: 'frame', name: 'Frame', code: 'PR-009', glyph: 'frame', hue: '#0000FF',
    blurb: 'Framed prints and canvas.', turnaround: '2 days', live: false, listings: [],
  },
  {
    slug: 'paper_bag', name: 'Paper Bag', code: 'PR-010', glyph: 'bag', hue: '#00000A',
    blurb: 'Coming soon.', turnaround: '3 days', live: false, listings: [],
  },
];

export const LIVE_CATEGORIES = CATEGORIES.filter((c) => c.live);

export function getCategory(slug: string): Category | undefined {
  return CATEGORIES.find((c) => c.slug === slug);
}

export function getListing(category: Category, slug: string | undefined): Listing | undefined {
  if (!slug) return category.listings.length === 1 ? category.listings[0] : undefined;
  return category.listings.find((l) => l.slug === slug);
}

/** True when the category needs the intermediate photo-led type-selection page (QA 1.1). */
export function needsTypeSelection(category: Category): boolean {
  return category.listings.length > 1;
}

export function productCode(slug: string, listingSlug?: string): string {
  const cat = getCategory(slug);
  if (!cat) return 'PR-000';
  if (listingSlug) return getListing(cat, listingSlug)?.code ?? cat.code;
  return cat.code;
}

/** Which quantity-range band a quantity falls into, or null when it falls outside them all. */
export function matchQtyRange(bands: (string | number)[], qty: number): string | null {
  for (const raw of bands) {
    const band = String(raw);
    if (band.endsWith('+')) {
      if (qty >= Number(band.slice(0, -1))) return band;
      continue;
    }
    const [lo, hi] = band.split('-').map(Number);
    if (qty >= lo && qty <= hi) return band;
  }
  return null;
}

/**
 * Every combination of the grid's axes, in stable order (QA 1.5): the printer is shown the
 * whole matrix pre-built and fills in prices, rather than adding one row at a time. Rows left
 * blank or deleted simply never reach the DB, and the missing combination falls back to
 * Request Quote — the same rule that already governs every other gap in a printer's pricing.
 */
export function gridCells(grid: PricingGrid): Record<string, string | number>[] {
  let rows: Record<string, string | number>[] = [{}];
  for (const axis of grid.axes) {
    const next: Record<string, string | number>[] = [];
    for (const row of rows) for (const v of axis.values) next.push({ ...row, [axis.key]: v });
    rows = next;
  }
  return rows;
}

/** Stable key for a grid cell, used to match a saved variant row to its coordinate. */
export function cellKey(grid: PricingGrid, cell: Record<string, string | number>): string {
  return grid.axes.map((a) => `${a.key}=${cell[a.key] ?? ''}`).join('|');
}

/** All live listings flattened, for sitemaps and printer product pickers. */
export function liveListings(): { category: Category; listing: Listing }[] {
  return LIVE_CATEGORIES.flatMap((category) => category.listings.map((listing) => ({ category, listing })));
}

/** Customer-facing URL for a listing. Single-listing categories skip the type page. */
export function listingHref(category: Category, listing?: Listing): string {
  if (!listing || category.listings.length <= 1) return `/configure/${category.slug}`;
  return `/configure/${category.slug}/${listing.slug}`;
}

/**
 * Lowest minimum order across a category's listings — the honest "MOQ" to show on a card
 * when the listings disagree (ID Card's floor is 1, Thank You Card's is 50).
 */
export function categoryMoq(category: Category): number | undefined {
  const mins = category.listings.map((l) => l.qty?.min).filter((n): n is number => typeof n === 'number');
  return mins.length ? Math.min(...mins) : undefined;
}

/** Human label for a stored listing slug — order screens should never show a raw slug. */
export function listingLabel(categorySlug: string, listingSlug?: string): string | undefined {
  const cat = getCategory(categorySlug);
  if (!cat) return undefined;
  return getListing(cat, listingSlug)?.label;
}
