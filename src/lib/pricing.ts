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
  serviceType?: 'print_only' | 'print_cut'; // business cards
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

    case 'per_sheet': {
      // Business card "Print only": customer cuts. sheets = ceil(qty / cardsPerSheet). (spec §6)
      if (!product.perSheetKobo || !product.cardsPerSheet) return { ok: false, reason: 'No sheet rate set' };
      const sheets = Math.ceil(qty / product.cardsPerSheet);
      const lines: PriceLine[] = [{
        label: `${qty} cards → ${sheets} A4 sheet${sheets > 1 ? 's' : ''}`,
        amountKobo: sheets * product.perSheetKobo,
      }];
      // Lamination priced per sheet here; ignore per-piece-only axes (corners are a cut concern).
      const picked = spec.addons ? { lamination: spec.addons.lamination ?? 'None' } : undefined;
      const extra = addonCost(addons, picked, { per_piece: qty, per_sheet: sheets });
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

/** Business cards run two paths (spec §6): match products to the chosen path. */
export function productMatchesSpec(spec: CustomerSpec, product: Product): boolean {
  if (product.categorySlug !== spec.category) return false;
  if (spec.category === 'business_card') {
    if (spec.serviceType === 'print_only') return product.pricingMode === 'per_sheet' || product.pricingMode === 'quote';
    if (spec.serviceType === 'print_cut') return product.pricingMode === 'tier' || product.pricingMode === 'quote';
  }
  return true;
}
