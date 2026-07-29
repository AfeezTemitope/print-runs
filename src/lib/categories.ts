import type { GlyphKind } from '@/components/ui/Glyph';

/**
 * V2 category config (Batch 2). Drives the configurator UI, the landing cards and the
 * pricing engine. Printers price against these same standard option labels, so a customer's
 * pick either matches a printer's rate/tier/add-on row — or falls back to Request Quote.
 *
 * The V2 data model is: Product Category → Product Variant → Specifications → Printer Pricing
 * (founder decisions doc). Variants live UNDER a category and are never separate categories —
 * that is why Sticker's three cuts and Business Card's two finishes are `variants` here rather
 * than eight and nine top-level entries.
 */

export type SizePreset = { label: string; width: number; height: number; unit: 'ft' | 'in' | 'cm' };

export type AddonAxis = {
  kind: 'lamination' | 'gsm' | 'corner' | 'sides';
  label: string;
  options: string[]; // first option = default = free
};

/**
 * A variant is a customer-visible choice within a category. It gets its own landing card
 * (Batch 2: "per-variant photo cards for Sticker×3, Business Card×2"), but shares the
 * category's configurator and the printer's pricing grid for that category.
 */
export type Variant = {
  slug: string;
  label: string;
  blurb: string;
  /** Some variants restrict the size presets — e.g. Large Format stickers start much bigger. */
  size?: { presets: SizePreset[]; allowCustom: boolean; defaultUnit: 'ft' | 'in' | 'cm' };
};

export type Category = {
  slug: string;
  name: string;
  glyph: GlyphKind;
  hue: string;               // glyph accent only
  blurb: string;
  turnaround: string;
  moq: number | null;
  /** false = hidden from the customer entirely (Frame is locked, Paper Bag is unspecced). */
  live: boolean;
  variants?: Variant[];
  size?: { presets: SizePreset[]; allowCustom: boolean; defaultUnit: 'ft' | 'in' | 'cm' };
  fixedSizes?: string[];
  qty?: { presets: number[]; min: number };
  jotter?: { covers: string[]; sizes: string[]; sheets: number[] };
  addonAxes?: AddonAxis[];
};

export const QTY_PRESETS = [50, 100, 250, 500, 1000];

/**
 * The eight live categories (founder decisions: "8 product categories, FINAL").
 * Frame and Paper Bag remain defined but not live, so existing data and codes stay stable.
 */
export const CATEGORIES: Category[] = [
  {
    slug: 'banner', name: 'Flex / Banner', glyph: 'banner', hue: '#00000A',
    blurb: 'Vinyl flex, any dimension.', turnaround: '24hrs', moq: null, live: true,
    size: {
      presets: [
        { label: '3 × 6 ft', width: 3, height: 6, unit: 'ft' },
        { label: '4 × 8 ft', width: 4, height: 8, unit: 'ft' },
        { label: '6 × 10 ft', width: 6, height: 10, unit: 'ft' },
      ],
      allowCustom: true, defaultUnit: 'ft',
    },
    qty: { presets: [1, 2, 5, 10], min: 1 },
  },
  {
    slug: 'jotter', name: 'Jotter', glyph: 'jotter', hue: '#00000A',
    blurb: 'Custom notebooks, soft or hard cover.', turnaround: '4 days', moq: 100, live: true,
    variants: [
      { slug: 'soft_cover', label: 'Soft Cover', blurb: 'Flexible card cover.' },
      { slug: 'hard_cover', label: 'Hard Cover', blurb: 'Rigid board cover.' },
    ],
    qty: { presets: [100, 250, 500], min: 100 },
    // V2 migration: sheet counts move 40/60/80 → 50/75/100 (Batch 2 migrations list).
    jotter: { covers: ['Soft cover', 'Hard cover'], sizes: ['A6', 'A5', 'B5'], sheets: [50, 75, 100] },
  },
  {
    slug: 'flyer', name: 'Flyer', glyph: 'flyer', hue: '#0000FF',
    blurb: 'A5 / A6 handbills.', turnaround: '24hrs', moq: 50, live: true,
    qty: { presets: QTY_PRESETS, min: 50 },
    addonAxes: [
      { kind: 'sides', label: 'Sides', options: ['Front only', 'Front and back'] },
      { kind: 'lamination', label: 'Lamination', options: ['None', 'Matte', 'Gloss'] },
    ],
  },
  {
    slug: 'business_card', name: 'Business Card', glyph: 'card', hue: '#00000A',
    blurb: 'Finished cards, straight or rounded corners.', turnaround: '24hrs', moq: 50, live: true,
    // Two listings, ONE product (founder decisions). Print-Only / per-A4-sheet is retired.
    variants: [
      { slug: 'standard', label: 'Standard', blurb: 'Straight corners, classic finish.' },
      { slug: 'rounded', label: 'Rounded', blurb: 'Rounded corners, softer look.' },
    ],
    qty: { presets: [100, 250, 500, 1000], min: 50 },
    addonAxes: [
      { kind: 'gsm', label: 'Paper weight', options: ['250gsm', '300gsm', '350gsm'] },
      { kind: 'lamination', label: 'Lamination', options: ['None', 'Matte', 'Gloss'] },
      { kind: 'sides', label: 'Print sides', options: ['Front only', 'Front and back'] },
    ],
  },
  {
    slug: 'sticker', name: 'Sticker', glyph: 'sticker', hue: '#0000FF',
    blurb: 'Round, straight cut or large format.', turnaround: '24hrs', moq: null, live: true,
    // THREE variants — the Master Build Spec wins over the founder doc's two (confirmed 28 Jul).
    variants: [
      { slug: 'round', label: 'Round Cut', blurb: 'Circular die-cut stickers.' },
      { slug: 'straight', label: 'Straight Cut', blurb: 'Square or rectangular cut.' },
      {
        slug: 'large_format', label: 'Large Format', blurb: 'Big-format vinyl stickers.',
        size: {
          presets: [
            { label: '1 × 1 ft', width: 1, height: 1, unit: 'ft' },
            { label: '2 × 2 ft', width: 2, height: 2, unit: 'ft' },
            { label: '3 × 3 ft', width: 3, height: 3, unit: 'ft' },
          ],
          allowCustom: true, defaultUnit: 'ft',
        },
      },
    ],
    size: {
      presets: [
        { label: '2 × 2 in', width: 2, height: 2, unit: 'in' },
        { label: '3 × 3 in', width: 3, height: 3, unit: 'in' },
        { label: '4 × 6 in', width: 4, height: 6, unit: 'in' },
      ],
      allowCustom: true, defaultUnit: 'in',
    },
    qty: { presets: QTY_PRESETS, min: 1 },
    addonAxes: [
      { kind: 'lamination', label: 'Lamination', options: ['None', 'Matte', 'Gloss'] },
    ],
  },
  {
    slug: 'nylon', name: 'Brand Nylon', glyph: 'nylon', hue: '#0000FF',
    blurb: 'Branded polybags.', turnaround: '2 days', moq: 50, live: true,
    // Polybag only. Drawstring and Mailer are parked pending market research.
    variants: [
      { slug: 'polybag', label: 'Polybag', blurb: 'Standard branded polybag.' },
    ],
    qty: { presets: [50, 100, 250, 500], min: 50 },
    addonAxes: [
      { kind: 'sides', label: 'Print sides', options: ['Front only', 'Front and back'] },
    ],
  },
  {
    slug: 'thank_you_card', name: 'Thank You Card', glyph: 'card', hue: '#FF0504',
    blurb: 'Insert cards for orders and gifts.', turnaround: '24hrs', moq: 50, live: true,
    qty: { presets: [50, 100, 250, 500, 1000], min: 50 },
    addonAxes: [
      { kind: 'gsm', label: 'Paper weight', options: ['250gsm', '300gsm', '350gsm'] },
      { kind: 'lamination', label: 'Lamination', options: ['None', 'Matte', 'Gloss'] },
      { kind: 'sides', label: 'Print sides', options: ['Front only', 'Front and back'] },
    ],
  },
  {
    slug: 'id_card', name: 'ID Card', glyph: 'card', hue: '#0000FF',
    blurb: 'Staff and event ID cards.', turnaround: '2 days', moq: 10, live: true,
    variants: [
      { slug: 'front_only', label: 'Front Only', blurb: 'Printed on one side.' },
      { slug: 'front_and_back', label: 'Front & Back', blurb: 'Printed both sides.' },
    ],
    qty: { presets: [10, 25, 50, 100, 250], min: 10 },
  },

  /* --- Not live: kept defined so product codes and existing rows stay stable --- */
  {
    slug: 'frame', name: 'Frame', glyph: 'frame', hue: '#0000FF',
    blurb: 'Framed prints and canvas.', turnaround: '2 days', moq: null,
    live: false, // hidden/locked from the customer view (founder decisions)
    fixedSizes: ['A4', 'A3', 'A2'],
    qty: { presets: [1, 2, 5], min: 1 },
  },
  {
    slug: 'paper_bag', name: 'Paper Bag', glyph: 'bag', hue: '#00000A',
    blurb: 'Coming soon.', turnaround: '3 days', moq: 20, live: false, // unspecced
  },
];

/** Only what a customer may configure. Frame and Paper Bag are excluded. */
export const LIVE_CATEGORIES = CATEGORIES.filter((c) => c.live);

export function getCategory(slug: string): Category | undefined {
  return CATEGORIES.find((c) => c.slug === slug);
}

export function getVariant(category: Category, slug: string | undefined): Variant | undefined {
  if (!slug) return undefined;
  return category.variants?.find((v) => v.slug === slug);
}

/**
 * Size options can be narrowed by the chosen variant (Large Format stickers being the case
 * that motivated it) — fall back to the category's own presets otherwise.
 */
export function sizeConfigFor(category: Category, variantSlug?: string) {
  return getVariant(category, variantSlug)?.size ?? category.size;
}

export function productCode(slug: string): string {
  const i = CATEGORIES.findIndex((c) => c.slug === slug);
  return `PR-${String(i + 1).padStart(3, '0')}`;
}
