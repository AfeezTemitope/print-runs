/**
 * The PrintRuns platform service fee (brief item #10).
 *
 * Charged once per order, never multiplied by quantity. Two bands rather than a flat rate, so
 * a large order carries a little more without the fee scaling away on big jobs — it is capped
 * at the upper band deliberately.
 *
 * The thresholds live in platform_settings and are editable from admin, so changing them is a
 * settings change rather than a deploy. These are only the fallbacks.
 */
export const FEE_LOW_KOBO = 50_000;        // ₦500
export const FEE_HIGH_KOBO = 100_000;      // ₦1,000
export const FEE_THRESHOLD_KOBO = 5_000_000; // ₦50,000 order value

export type FeeBands = {
  lowKobo: number;
  highKobo: number;
  thresholdKobo: number;
};

export const DEFAULT_FEE_BANDS: FeeBands = {
  lowKobo: FEE_LOW_KOBO,
  highKobo: FEE_HIGH_KOBO,
  thresholdKobo: FEE_THRESHOLD_KOBO,
};

/**
 * Which band an order falls in.
 *
 * Tested against the PRINTER'S price, not the customer's total. The printer's price is the
 * figure both sides actually agreed on; testing the total would mean PrintRuns' own margin
 * could tip an order into the higher fee band, which would be charging a fee on a fee.
 */
export function platformFeeFor(printerBaseKobo: number, bands: FeeBands = DEFAULT_FEE_BANDS): number {
  return printerBaseKobo >= bands.thresholdKobo ? bands.highKobo : bands.lowKobo;
}
