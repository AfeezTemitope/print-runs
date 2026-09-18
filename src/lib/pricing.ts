import type { products } from '@/db/schema';

/**
 * Commercial pricing: the layer PrintRuns adds on top of whatever a printer charges.
 *
 * The V1 grid engine that used to live here went with the storefront rebuild — listing
 * pricing is now src/lib/listing-pricing.ts. What remains is the margin and the platform
 * fee, which are unchanged by that rebuild because they were never the printer's to set.
 */
type Product = typeof products.$inferSelect;

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
