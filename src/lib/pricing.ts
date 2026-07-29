import type { products, productVariants, productAddons } from '@/db/schema';

type Product = typeof products.$inferSelect;
type Variant = typeof productVariants.$inferSelect;
type Addon = typeof productAddons.$inferSelect;

export type CustomerSpec = {
  category: string;
  qty?: number;
  width?: number;
  height?: number;
  unit?: 'ft' | 'in' | 'cm';
  sizeLabel?: string;                 // frames
  serviceType?: string;               // reserved — Business Card's dual print_only/print_cut path is retired (decision 8)
  cover?: string;                     // jotter
  jSize?: string;                     // jotter size
  sheets?: number;                    // jotter
  addons?: Record<string, string>;    // kind -> chosen label ('None' etc. = skip)
};

export type PriceLine = { label: string; amountKobo: number };
export type PriceResult =
  | { ok: true; totalKobo: number; lines: PriceLine[] }
  | { ok: false; reason: string }; // renders as the "Request quote" state

const FREE_LABELS = new Set(['None', 'Front only', 'Straight', '250gsm']);

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
 * The one rule from the spec: anything outside a printer's defined
 * rates/tiers/sizes falls back to Request Quote — never a special case.
 */
export function computePrice(spec: CustomerSpec, product: Product, variants: Variant[], addons: Addon[]): PriceResult {
  const qty = Math.max(1, spec.qty ?? 1);

  switch (product.pricingMode) {
    case 'quote':
      return { ok: false, reason: 'Priced on request' };

    case 'per_area': {
      if (!product.ratePerUnitKobo || !product.areaUnit) return { ok: false, reason: 'No rate set' };
      if (!spec.width || !spec.height || !spec.unit) return { ok: false, reason: 'Custom size' };
      const w = toUnit(spec.width, spec.unit, product.areaUnit);
      const h = toUnit(spec.height, spec.unit, product.areaUnit);
      const area = w * h;
      let unitPrice = Math.round(area * product.ratePerUnitKobo);
      if (product.minChargeKobo && unitPrice < product.minChargeKobo) unitPrice = product.minChargeKobo;
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

    case 'tier': {
      const tier = variants.find((v) => v.qty === qty);
      if (!tier) return { ok: false, reason: `No ${qty}pc tier` };
      const lines: PriceLine[] = [{
        label: tier.label ? `${qty}pcs — ${tier.label}` : `${qty}pcs`,
        amountKobo: tier.priceKobo,
      }];
      const extra = addonCost(addons, spec.addons, { per_piece: qty, per_sheet: qty });
      if (extra.missing) return { ok: false, reason: `${extra.missing} not priced` };
      lines.push(...extra.lines);
      return { ok: true, totalKobo: lines.reduce((s, l) => s + l.amountKobo, 0), lines };
    }

    case 'fixed_size': {
      if (!spec.sizeLabel) return { ok: false, reason: 'Pick a size' };
      const v = variants.find((x) => x.label === spec.sizeLabel);
      if (!v) return { ok: false, reason: `${spec.sizeLabel} not offered` };
      return {
        ok: true,
        totalKobo: v.priceKobo * qty,
        lines: [{ label: `${spec.sizeLabel} × ${qty}`, amountKobo: v.priceKobo * qty }],
      };
    }

    case 'matrix': {
      // Jotter: cover × size × sheet-count rows. Colour pricing explicitly out of V1 (spec §8).
      const v = variants.find((x) =>
        x.meta?.cover === spec.cover && x.meta?.size === spec.jSize && Number(x.meta?.sheets) === spec.sheets,
      );
      if (!v) return { ok: false, reason: 'Combo not priced' };
      return {
        ok: true,
        totalKobo: v.priceKobo * qty,
        lines: [{ label: `${spec.cover}, ${spec.jSize}, ${spec.sheets} sheets × ${qty}`, amountKobo: v.priceKobo * qty }],
      };
    }
  }
}

/**
 * V2: Business Card's Print-Only / Print+Cut dual path is retired (decision 8) — every
 * Business Card product is priced the same way now, so this only checks category anymore.
 * Kept as a named function since Batch 2's per-listing (Standard/Rounded) matching will
 * likely extend it again.
 */
export function productMatchesSpec(spec: CustomerSpec, product: Product): boolean {
  return product.categorySlug === spec.category;
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
