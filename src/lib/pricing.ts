import type { products } from '@/db/schema';
import { DEFAULT_FEE_BANDS, type FeeBands } from '@/lib/platform-fee';

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
/**
 * PrintRuns' commercial margin on one ORDER.
 *
 * A fixed margin is per order, never per piece. Under V1 it multiplied by quantity, because
 * the platform defined the product and knew a unit meant one card. Under V2 a printer's own
 * quantity tier is a BATCH total — "50 bags for ₦12,000" — so multiplying per piece turned a
 * ₦12,000 job into ₦37,000 and made every quantity-priced listing unusable.
 *
 * qty is kept in the signature so existing callers need no change, and so a per-piece variant
 * can be reintroduced deliberately rather than by accident.
 */
export function computeMargin(printerBaseKobo: number, _qty: number, product: MarginableProduct): number {
  if (product.marginType === 'percent') {
    return Math.round((printerBaseKobo * product.marginPercentBps) / 10000);
  }
  return product.marginFixedKobo;
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

/**
 * The banded fee (brief item #10). Reads all three values from platform_settings so they are
 * editable from admin, falling back to the defaults when a row is missing.
 */
export async function getFeeBands(
  lookup: (key: string) => Promise<{ valueKobo: number } | undefined>,
): Promise<FeeBands> {
  const [low, high, threshold] = await Promise.all([
    lookup('platform_fee_low_kobo'),
    lookup('platform_fee_high_kobo'),
    lookup('platform_fee_threshold_kobo'),
  ]);
  return {
    lowKobo: low?.valueKobo ?? DEFAULT_FEE_BANDS.lowKobo,
    highKobo: high?.valueKobo ?? DEFAULT_FEE_BANDS.highKobo,
    thresholdKobo: threshold?.valueKobo ?? DEFAULT_FEE_BANDS.thresholdKobo,
  };
}
