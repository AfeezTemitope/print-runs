/* Runtime checks for the V2 pricing engine: npx tsx scripts/test-pricing.ts
   Pure-function tests — no DB, no network. Verifies the money math actually produces the
   numbers the founder decisions specify, not just that it type-checks. */

import { computeMargin, computeOrderTotals, computePrice, DEFAULT_PLATFORM_FEE_KOBO } from '../src/lib/pricing';
import { stepsFor, statusLabel, canDecline, isSettlementEligible, QUEUE_STATUSES } from '../src/lib/status';
import { CATEGORIES, LIVE_CATEGORIES, getCategory, getVariant, sizeConfigFor } from '../src/lib/categories';

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

console.log('\nOrder lifecycle (decision 18)');
eq('delivery path has 7 stages', stepsFor('delivery').length, 7);
// Collection skips out_for_delivery — PrintRuns isn't the one delivering it.
eq('collection path has 6 stages', stepsFor('collection').length, 6);
eq('collection path excludes out_for_delivery', stepsFor('collection').includes('out_for_delivery'), false);
eq('collection final stage reads Collected', statusLabel('delivered', 'collection'), 'Collected');
eq('delivery final stage reads Delivered', statusLabel('delivered', 'delivery'), 'Delivered');
eq('collection ready stage is explicit', statusLabel('ready_for_dispatch', 'collection'), 'Ready for collection');

console.log('\nPrinter decline window (decision 10)');
eq('can decline before work starts', canDecline('order_received'), true);
eq('can decline once assigned', canDecline('printer_assigned'), true);
// Once materials are committed the Refund Policy treats it as non-cancellable.
eq('cannot decline mid-print', canDecline('printing_in_progress'), false);
eq('cannot decline once printed', canDecline('printing_completed'), false);
eq('terminal states are not in the live queue', QUEUE_STATUSES.includes('delivered'), false);
eq('cancelled is not in the live queue', QUEUE_STATUSES.includes('cancelled'), false);

console.log('\nSettlement entitlement (decision 20)');
// The whole point: a slow-to-collect customer must not hold a printer's money.
eq('collection settles once ready + notified', isSettlementEligible('ready_for_dispatch', 'collection'), true);
eq('delivery does NOT settle merely on ready', isSettlementEligible('ready_for_dispatch', 'delivery'), false);
eq('delivery settles on delivered', isSettlementEligible('delivered', 'delivery'), true);
eq('nothing settles mid-print', isSettlementEligible('printing_in_progress', 'delivery'), false);

console.log('\nCategories and variants (Batch 2)');
eq('exactly 8 live categories', LIVE_CATEGORIES.length, 8);
eq('live slugs are the agreed eight', LIVE_CATEGORIES.map((c) => c.slug), [
  'banner', 'jotter', 'flyer', 'business_card', 'sticker', 'nylon', 'thank_you_card', 'id_card',
]);
// Frame is locked and Paper Bag is unspecced — neither may reach a customer.
eq('frame is not live', getCategory('frame')?.live, false);
eq('paper_bag is not live', getCategory('paper_bag')?.live, false);
eq('frame absent from live list', LIVE_CATEGORIES.some((c) => c.slug === 'frame'), false);

// Sticker is THREE variants — the Master Build Spec, not the founder doc's two (28 Jul).
eq('sticker has 3 variants', getCategory('sticker')?.variants?.length, 3);
eq('sticker variants', getCategory('sticker')?.variants?.map((v) => v.slug), ['round', 'straight', 'large_format']);
eq('business card has 2 listings', getCategory('business_card')?.variants?.length, 2);
eq('nylon is polybag only', getCategory('nylon')?.variants?.map((v) => v.slug), ['polybag']);
eq('jotter has soft + hard cover', getCategory('jotter')?.variants?.length, 2);
eq('id card has 2 variants', getCategory('id_card')?.variants?.length, 2);

// Jotter sheet counts migrated 40/60/80 -> 50/75/100.
eq('jotter sheets are the new values', getCategory('jotter')?.jotter?.sheets, [50, 75, 100]);

// Large Format stickers override the category's inch presets with foot-scale ones.
const sticker = getCategory('sticker')!;
eq('default sticker sizes are inches', sizeConfigFor(sticker, 'round')?.defaultUnit, 'in');
eq('large format overrides to feet', sizeConfigFor(sticker, 'large_format')?.defaultUnit, 'ft');
eq('unknown variant falls back to category', sizeConfigFor(sticker, 'nonsense')?.defaultUnit, 'in');
eq('getVariant rejects unknown slugs', getVariant(sticker, 'nonsense'), undefined);

// Every live category must be reachable and priceable.
eq('all live categories have a name', LIVE_CATEGORIES.every((c) => c.name.length > 0), true);
eq('no duplicate slugs', new Set(CATEGORIES.map((c) => c.slug)).size, CATEGORIES.length);

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
