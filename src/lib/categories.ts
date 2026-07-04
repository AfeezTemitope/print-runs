import type { GlyphKind } from '@/components/ui/Glyph';

/**
 * Category config drives the configurator UI and the pricing engine.
 * Printers price against these same standard option labels, so a customer
 * pick either matches a printer's rate/tier/add-on row — or falls back to
 * Request Quote. One rule, applied everywhere (spec §5).
 */

export type SizePreset = { label: string; width: number; height: number; unit: 'ft' | 'in' | 'cm' };

export type AddonAxis = {
  kind: 'lamination' | 'gsm' | 'corner' | 'sides';
  label: string;
  options: string[]; // first option = default = free
};

export type Category = {
  slug: string;
  name: string;
  glyph: GlyphKind;
  hue: string;               // glyph accent only
  blurb: string;
  turnaround: string;
  moq: number | null;
  live: boolean;             // paper bag is V2 (spec §8)
  size?: { presets: SizePreset[]; allowCustom: boolean; defaultUnit: 'ft' | 'in' | 'cm' };
  fixedSizes?: string[];     // frames
  qty?: { presets: number[]; min: number };
  jotter?: { covers: string[]; sizes: string[]; sheets: number[] };
  businessCard?: true;       // dual path (spec §6)
  addonAxes?: AddonAxis[];
};

export const QTY_PRESETS = [50, 100, 250, 500, 1000];

export const CATEGORIES: Category[] = [
  {
    slug: 'sticker', name: 'Sticker', glyph: 'sticker', hue: '#0000FF',
    blurb: 'Cut or sheet stickers, any size.', turnaround: '24hrs', moq: null, live: true,
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
    blurb: 'Print-only sheets or finished cards.', turnaround: '24hrs', moq: 50, live: true,
    businessCard: true,
    qty: { presets: [100, 250, 500, 1000], min: 50 },
    addonAxes: [
      { kind: 'gsm', label: 'Paper weight', options: ['250gsm', '300gsm', '350gsm'] },
      { kind: 'corner', label: 'Corners', options: ['Straight', 'Rounded'] },
      { kind: 'lamination', label: 'Lamination', options: ['None', 'Matte', 'Gloss'] },
      { kind: 'sides', label: 'Lamination sides', options: ['Front only', 'Front and back'] },
    ],
  },
  {
    slug: 'nylon', name: 'Brand Nylon', glyph: 'nylon', hue: '#0000FF',
    blurb: 'Branded nylon bags.', turnaround: '2 days', moq: 50, live: true,
    qty: { presets: [50, 100, 250, 500], min: 50 },
    addonAxes: [
      { kind: 'sides', label: 'Print sides', options: ['Front only', 'Front and back'] },
    ],
  },
  {
    slug: 'jotter', name: 'Jotter', glyph: 'jotter', hue: '#00000A',
    blurb: 'Custom notebooks.', turnaround: '4 days', moq: 100, live: true,
    qty: { presets: [100, 250, 500], min: 100 },
    jotter: { covers: ['Soft cover', 'Hard cover'], sizes: ['A6', 'A5', 'B5'], sheets: [40, 60, 80] },
  },
  {
    slug: 'frame', name: 'Frame', glyph: 'frame', hue: '#0000FF',
    blurb: 'Framed prints and canvas.', turnaround: '2 days', moq: null, live: true,
    fixedSizes: ['A4', 'A3', 'A2'],
    qty: { presets: [1, 2, 5], min: 1 },
  },
  {
    slug: 'paper_bag', name: 'Paper Bag', glyph: 'bag', hue: '#00000A',
    blurb: 'Coming soon.', turnaround: '3 days', moq: 20, live: false, // V2 — pricing model TBD (spec §8)
  },
];

export function getCategory(slug: string): Category | undefined {
  return CATEGORIES.find((c) => c.slug === slug);
}

export function productCode(slug: string): string {
  const i = CATEGORIES.findIndex((c) => c.slug === slug);
  return `PR-${String(i + 1).padStart(3, '0')}`;
}
