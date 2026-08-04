import type { products, productVariants, productAddons } from '@/db/schema';
import { getCategory, getListing, matchQtyRange } from '@/lib/categories';
import type { PricingGrid } from '@/lib/categories';

type Product = typeof products.$inferSelect;
type Variant = typeof productVariants.$inferSelect;
type Addon = typeof productAddons.$inferSelect;

/**
 * QA Round 1 rebuild. `listing` replaces the old `variant` field: a listing is a customer-
 * visible type within a category (Sticker → Round Cut) and, where a category has more than
 * one, it is its OWN product row with its OWN pricing grid (QA 3.4).
 *
 * `options` carries every option-axis choice — paper weight, sides, feel, nylon colour, hylet.
 * Some of those axes are grid coordinates and some are cosmetic; the category config decides
 * which, so the configurator does not need to know the difference.
 */
export type CustomerSpec = {
  category: string;
  listing?: string;
  qty?: number;
  width?: number;
  height?: number;
  unit?: 'ft' | 'in' | 'cm';
  sizeLabel?: string;                 // chosen size-preset label — the grid's 'size' axis
  sheets?: number;                    // jotter
  options?: Record<string, string>;   // option axes (grid coordinates + cosmetic choices)
  addons?: Record<string, string>;    // separately-priced add-ons — Flyer only after QA 3.4
};

export type PriceLine = { label: string; amountKobo: number };
export type PriceResult =
  | { ok: true; totalKobo: number; lines: PriceLine[] }
  | { ok: false; reason: string }; // renders as the "Request quote" state

const FREE_LABELS = new Set(['None', 'Front only']);

function toUnit(value: number, from: string, to: 'sqft' | 'sqin'): number {
  // value is a length; convert to feet or inches
  const inFeet = from === 'ft' ? value : from === 'in' ? value / 12 : value / 30.48;
  return to === 'sqft' ? inFeet : inFeet * 12;
}

function addonCost(
  addons: Addon[],
  picked: Record<string, string> | undefined,
  multipliers: { per_piece: number; per_sheet: number },
): { lines: PriceLine[]; missing: string | null } {
  const lines: PriceLine[] = [];
  if (!picked) return { lines, missing: null };

  for (const [kind, label] of Object.entries(picked)) {
    if (!label || FREE_LABELS.has(label)) continue;
    const row = addons.find((a) => a.kind === kind && a.label === label);
    if (!row) return { lines, missing: `${label}` }; // printer hasn't priced this option → quote
    const mult = row.basis === 'per_piece' ? multipliers.per_piece
      : row.basis === 'per_sheet' ? multipliers.per_sheet
      : 1;
    lines.push({ label: `${row.label} (${row.basis.replace('_', ' ')})`, amountKobo: row.priceKobo * mult });
  }
  return { lines, missing: null };
}

/**
 * Turn the customer's spec into one coordinate per grid axis.
 *
 * Returns null the moment any axis cannot be resolved. That is the whole quantity rule from
 * QA 3.5: an exact-tier axis matches only the listed values, so 300 stickers do NOT round up
 * to the 500 cell — they route to Request Quote. Only Flyer uses banded ranges (QA 3.3).
 */
function gridCoords(grid: PricingGrid, spec: CustomerSpec, qty: number): Record<string, string> | null {
  const coords: Record<string, string> = {};
  for (const axis of grid.axes) {
    let raw: string | number | undefined;
    switch (axis.source) {
      case 'size':      raw = spec.sizeLabel; break;
      case 'sheets':    raw = spec.sheets; break;
      case 'option':    raw = spec.options?.[axis.key]; break;
      case 'qty':       raw = axis.values.some((v) => Number(v) === qty) ? qty : undefined; break;
      case 'qty_range': raw = matchQtyRange(axis.values, qty) ?? undefined; break;
      default:          raw = spec.options?.[axis.key];
    }
    if (raw === undefined || raw === '') return null;
    coords[axis.key] = String(raw);
  }
  return coords;
}

/** The printer's saved row for this exact cell, or undefined when they left it blank. */
function findCell(grid: PricingGrid, variants: Variant[], coords: Record<string, string>): Variant | undefined {
  return variants.find((v) =>
    grid.axes.every((a) => String(v.meta?.[a.key] ?? '') === coords[a.key]),
  );
}

/**
 * The one rule from the spec: anything outside a printer's defined
 * rates/tiers/sizes falls back to Request Quote — never a special case.
 */
export function computePrice(spec: CustomerSpec, product: Product, variants: Variant[], addons: Addon[]): PriceResult {
  const qty = Math.max(1, spec.qty ?? 1);

  switch (product.pricingMode) {
    case 'quote':
      return { ok: false, reason: 'Priced on request' };

    case 'per_area': {
      // Banner and Large Format Sticker. QA 3.1 removed the minimum-charge floor entirely —
      // the printer's Reject / Can't Fulfil button is the safety net for underpriced customs.
      if (!product.ratePerUnitKobo || !product.areaUnit) return { ok: false, reason: 'No rate set' };
      if (!spec.width || !spec.height || !spec.unit) return { ok: false, reason: 'Custom size' };
      const w = toUnit(spec.width, spec.unit, product.areaUnit);
      const h = toUnit(spec.height, spec.unit, product.areaUnit);
      const unitPrice = Math.round(w * h * product.ratePerUnitKobo);
      const base = unitPrice * qty;
      const lines: PriceLine[] = [{
        label: `${spec.width} × ${spec.height} ${spec.unit} × ${qty}`,
        amountKobo: base,
      }];
      const extra = addonCost(addons, spec.addons, { per_piece: qty, per_sheet: qty });
      if (extra.missing) return { ok: false, reason: `${extra.missing} not priced` };
      lines.push(...extra.lines);
      return { ok: true, totalKobo: lines.reduce((s, l) => s + l.amountKobo, 0), lines };
    }

    case 'matrix': {
      // Generic pricing grid (QA 1.5). 'matrix' is kept as the enum value rather than adding
      // a new one, so no enum migration is needed and Jotter — the first grid — keeps working.
      const cat = getCategory(spec.category);
      const listing = cat ? getListing(cat, spec.listing) : undefined;
      const grid = listing?.pricingGrid;
      if (!grid) return { ok: false, reason: 'Not priced' };

      const coords = gridCoords(grid, spec, qty);
      if (!coords) return { ok: false, reason: 'Not a priced combination' };

      const cell = findCell(grid, variants, coords);
      if (!cell) return { ok: false, reason: 'Combo not priced' };

      // flat_batch — the cell price IS the total for the batch. per_piece — multiply by qty.
      // Explicit per listing: Thank You Card has no qty axis yet is per piece, and Flyer has
      // one yet is also per piece, so the axes alone never imply the answer.
      const amountKobo = grid.priceType === 'per_piece' ? cell.priceKobo * qty : cell.priceKobo;
      const label = grid.axes.map((a) => coords[a.key]).join(', ')
        + (grid.priceType === 'per_piece' ? ` × ${qty}` : '');

      const lines: PriceLine[] = [{ label, amountKobo }];
      const extra = addonCost(addons, spec.addons, { per_piece: qty, per_sheet: qty });
      if (extra.missing) return { ok: false, reason: `${extra.missing} not priced` };
      lines.push(...extra.lines);
      return { ok: true, totalKobo: lines.reduce((s, l) => s + l.amountKobo, 0), lines };
    }

    default:
      // 'tier' and 'fixed_size' are legacy V1 shapes. Every live category is now either
      // per_area, a grid, or quote — old rows simply fall back to Request Quote.
      return { ok: false, reason: 'Priced on request' };
  }
}

/**
 * A printer's product only answers a spec when it is the same category AND the same listing
 * (QA 3.4): Standard and Rounded business cards are separate products with separate grids,
 * so one can never price the other. Legacy rows saved before listings existed carry a null
 * listingSlug and still answer for single-listing categories.
 */
export function productMatchesSpec(spec: CustomerSpec, product: Product): boolean {
  if (product.categorySlug !== spec.category) return false;
  if (!spec.listing) return true;
  if (!product.listingSlug) {
    const cat = getCategory(spec.category);
    return (cat?.listings.length ?? 0) <= 1;
  }
  return product.listingSlug === spec.listing;
}

/**
 * V2 pricing engine (decision 1): Printer Base Price + Commercial Margin = Selling Price;
 * then + Platform Service Fee = amount the customer pays at checkout. Delivery is NOT part
 * of this — it's quoted manually after payment (decision 13/B1).
 *
 * computePrice() above still does exactly one job: work out the Printer Base Price from a
 * printer's own rates/tiers/add-ons. Everything below layers on top of that result and never
 * touches printer pricing data — this is deliberate, so a printer's own numbers are never
 * mixed with PrintRuns' commercial margin in one place.
 */

export type MarginableProduct = Pick<Product, 'marginType' | 'marginFixedKobo' | 'marginPercentBps'>;

/**
 * 'fixed' margins are per unit (decision 16: ID Card is ₦200/piece; other fixed-margin
 * categories are ₦10–50/piece), so they scale with qty. 'percent' (Business Card only,
 * decision 23: 7%) applies to the whole Printer Base Price for the line — scaling by qty
 * happens automatically since printerBaseKobo already reflects the full line total.
 */
export function computeMargin(printerBaseKobo: number, qty: number, product: MarginableProduct): number {
  if (product.marginType === 'percent') {
    return Math.round((printerBaseKobo * product.marginPercentBps) / 10000);
  }
  return product.marginFixedKobo * Math.max(1, qty);
}

export type OrderTotals = {
  printerBaseKobo: number;
  marginKobo: number;
  sellingPriceKobo: number;   // shown to the customer as the product price
  platformFeeKobo: number;    // shown to the customer, separately, at checkout
  amountPaidKobo: number;     // sellingPriceKobo + platformFeeKobo — the checkout charge
};

/** Pure and synchronous by design — callers fetch platformFeeKobo from platform_settings first. */
export function computeOrderTotals(
  printerBaseKobo: number,
  qty: number,
  product: MarginableProduct,
  platformFeeKobo: number,
): OrderTotals {
  const marginKobo = computeMargin(printerBaseKobo, qty, product);
  const sellingPriceKobo = printerBaseKobo + marginKobo;
  return {
    printerBaseKobo,
    marginKobo,
    sellingPriceKobo,
    platformFeeKobo,
    amountPaidKobo: sellingPriceKobo + platformFeeKobo,
  };
}

// Fallback only — the real value lives in platform_settings (decision 2: admin-editable,
// no code change). This is what a fresh DB should be seeded with; see getPlatformFeeKobo().
export const DEFAULT_PLATFORM_FEE_KOBO = 50000; // ₦500

/**
 * Reads the live platform service fee. Takes a plain db-query function rather than importing
 * '@/db' directly, so pricing.ts stays free of DB wiring and stays easy to unit test.
 */
export async function getPlatformFeeKobo(
  lookup: (key: string) => Promise<{ valueKobo: number } | undefined>,
): Promise<number> {
  const row = await lookup('platform_service_fee_kobo');
  return row?.valueKobo ?? DEFAULT_PLATFORM_FEE_KOBO;
}
