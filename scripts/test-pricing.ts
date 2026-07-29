/* Runtime checks for the V2 pricing engine: npx tsx scripts/test-pricing.ts
   Pure-function tests — no DB, no network. Verifies the money math actually produces the
   numbers the founder decisions specify, not just that it type-checks. */

import { computeMargin, computeOrderTotals, computePrice, DEFAULT_PLATFORM_FEE_KOBO } from '../src/lib/pricing';

let pass = 0;
let fail = 0;

function eq(label: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) { pass++; console.log(`  ok   ${label}`); }
  else { fail++; console.log(`  FAIL ${label}\n         expected ${e}\n         actual   ${a}`); }
}

const N = (naira: number) => naira * 100; // kobo helper

console.log('\nMargin math');
// Decision 16: ID Card margin is ₦200 fixed PER PIECE.
eq('ID Card ₦200 fixed × 1',
  computeMargin(N(1000), 1, { marginType: 'fixed', marginFixedKobo: N(200), marginPercentBps: 0 }),
  N(200));
eq('ID Card ₦200 fixed × 50 scales per piece',
  computeMargin(N(50000), 50, { marginType: 'fixed', marginFixedKobo: N(200), marginPercentBps: 0 }),
  N(10000));

// Decision 23: Business Card keeps a 7% percentage margin (700 bps) on the printer base price.
eq('Business Card 7% of ₦10,000',
  computeMargin(N(10000), 100, { marginType: 'percent', marginFixedKobo: 0, marginPercentBps: 700 }),
  N(700));
eq('Business Card 7% rounds to whole kobo (₦1,999 base)',
  computeMargin(199900, 100, { marginType: 'percent', marginFixedKobo: 0, marginPercentBps: 700 }),
  13993);
eq('percent margin ignores qty (already in base)',
  computeMargin(N(10000), 1, { marginType: 'percent', marginFixedKobo: 0, marginPercentBps: 700 }),
  computeMargin(N(10000), 500, { marginType: 'percent', marginFixedKobo: 0, marginPercentBps: 700 }));

// Default schema state: margin 0 until an admin sets it (Batch 3).
eq('unset margin adds nothing',
  computeMargin(N(5000), 10, { marginType: 'fixed', marginFixedKobo: 0, marginPercentBps: 0 }),
  0);

console.log('\n3-layer order totals (decision 1)');
const t = computeOrderTotals(N(3000), 1,
  { marginType: 'fixed', marginFixedKobo: N(50), marginPercentBps: 0 }, DEFAULT_PLATFORM_FEE_KOBO);
eq('printer base preserved', t.printerBaseKobo, N(3000));
eq('margin applied', t.marginKobo, N(50));
eq('selling price = base + margin', t.sellingPriceKobo, N(3050));
eq('platform fee is ₦500', t.platformFeeKobo, N(500));
eq('amount paid = selling + fee', t.amountPaidKobo, N(3550));

// The delivery fee must NOT be inside the checkout charge (decision 13/B1).
eq('amount paid excludes any delivery fee', t.amountPaidKobo, t.sellingPriceKobo + t.platformFeeKobo);

// Admin-editable fee (decision 2) — a changed fee must flow straight through.
const t2 = computeOrderTotals(N(3000), 1,
  { marginType: 'fixed', marginFixedKobo: 0, marginPercentBps: 0 }, N(750));
eq('edited platform fee flows through', t2.amountPaidKobo, N(3750));

console.log('\nBusiness Card end-to-end (the silent-price-move risk, C2)');
const bcBase = N(20000);
const bc = computeOrderTotals(bcBase, 500,
  { marginType: 'percent', marginFixedKobo: 0, marginPercentBps: 700 }, DEFAULT_PLATFORM_FEE_KOBO);
eq('7% of ₦20,000 = ₦1,400', bc.marginKobo, N(1400));
eq('selling price ₦21,400', bc.sellingPriceKobo, N(21400));
eq('customer pays ₦21,900', bc.amountPaidKobo, N(21900));
// One basis point of drift moves the customer price — this is exactly why the admin UI
// must show the resulting selling price live next to the field.
const bcDrift = computeOrderTotals(bcBase, 500,
  { marginType: 'percent', marginFixedKobo: 0, marginPercentBps: 800 }, DEFAULT_PLATFORM_FEE_KOBO);
eq('7%→8% moves customer price by ₦200', bcDrift.amountPaidKobo - bc.amountPaidKobo, N(200));

console.log('\nRetired per_sheet mode (decision 8)');
const productBase = {
  id: 'p', shopId: 's', categorySlug: 'business_card', name: 'BC', description: null,
  photoUrl: null, areaUnit: null, ratePerUnitKobo: null, minChargeKobo: null,
  marginType: 'fixed' as const, marginFixedKobo: 0, marginPercentBps: 0,
  turnaroundHours: 24, isActive: true, createdAt: new Date(),
};
const tierProduct = { ...productBase, pricingMode: 'tier' as const };
const variants = [{ id: 'v', productId: 'p', label: null, qty: 100, priceKobo: N(8000), meta: null }];
const tierResult = computePrice({ category: 'business_card', qty: 100 }, tierProduct, variants, []);
eq('tier pricing still works', tierResult.ok && tierResult.totalKobo, N(8000));

const quoteResult = computePrice({ category: 'business_card', qty: 999 }, tierProduct, variants, []);
eq('unpriced qty falls back to quote', quoteResult.ok, false);

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
