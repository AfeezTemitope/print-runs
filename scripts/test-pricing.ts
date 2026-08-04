/* Runtime checks for the V2 pricing engine: npx tsx scripts/test-pricing.ts
   Pure-function tests — no DB, no network. Verifies the money math actually produces the
   numbers the founder decisions specify, not just that it type-checks. */

import { computeMargin, computeOrderTotals, computePrice, DEFAULT_PLATFORM_FEE_KOBO } from '../src/lib/pricing';
import { stepsFor, statusLabel, canDecline, isSettlementEligible, QUEUE_STATUSES } from '../src/lib/status';
import {
  CATEGORIES, LIVE_CATEGORIES, getCategory, getListing, needsTypeSelection,
  gridCellCount, gridCells, cellKey, matchQtyRange, productCode,
} from '../src/lib/categories';
import type { PricingGrid } from '../src/lib/categories';

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

console.log('\nRetired pricing modes');
const productBase = {
  id: 'p', shopId: 's', categorySlug: 'business_card', listingSlug: 'standard', name: 'BC', description: null,
  photoUrl: null, areaUnit: null, ratePerUnitKobo: null, minChargeKobo: null, offersHylet: false,
  marginType: 'fixed' as const, marginFixedKobo: 0, marginPercentBps: 0,
  turnaroundHours: 24, isActive: true, createdAt: new Date(),
};
// 'per_sheet' went with decision 8. 'tier' and 'fixed_size' went with QA 1.5 — every product
// with more than one price variable is now a grid, so legacy rows fall back to quote rather
// than pricing off a shape the customer side can no longer produce.
const tierProduct = { ...productBase, pricingMode: 'tier' as const };
const legacyRows = [{ id: 'v', productId: 'p', label: null, qty: 100, priceKobo: N(8000), meta: null }];
const legacy = computePrice({ category: 'business_card', listing: 'standard', qty: 100 }, tierProduct, legacyRows, []);
eq('legacy tier rows fall back to quote', legacy.ok, false);

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

console.log('\nCategories and listings (QA Round 1)');
eq('exactly 8 live categories', LIVE_CATEGORIES.length, 8);
eq('live slugs are the agreed eight', LIVE_CATEGORIES.map((c) => c.slug), [
  'banner', 'jotter', 'flyer', 'business_card', 'sticker', 'nylon', 'thank_you_card', 'id_card',
]);
// Frame is locked and Paper Bag is unspecced — neither may reach a customer.
eq('frame is not live', getCategory('frame')?.live, false);
eq('paper_bag is not live', getCategory('paper_bag')?.live, false);
eq('frame absent from live list', LIVE_CATEGORIES.some((c) => c.slug === 'frame'), false);

// QA 1.1: the Products grid shows one card per CATEGORY; multi-listing ones route via the
// type-selection page first.
eq('sticker needs a type page', needsTypeSelection(getCategory('sticker')!), true);
eq('jotter needs a type page', needsTypeSelection(getCategory('jotter')!), true);
eq('business card needs a type page', needsTypeSelection(getCategory('business_card')!), true);
eq('flyer goes straight to the configurator', needsTypeSelection(getCategory('flyer')!), false);
eq('nylon goes straight to the configurator', needsTypeSelection(getCategory('nylon')!), false);
eq('id card goes straight to the configurator', needsTypeSelection(getCategory('id_card')!), false);

eq('sticker has 3 listings', getCategory('sticker')?.listings.map((l) => l.slug), ['round', 'straight', 'large_format']);
eq('business card has 2 listings', getCategory('business_card')?.listings.length, 2);
eq('jotter has soft + hard cover', getCategory('jotter')?.listings.map((l) => l.slug), ['soft_cover', 'hard_cover']);
eq('id card is a single listing', getCategory('id_card')?.listings.length, 1);

// QA 1.2: every listing carries its OWN reference number.
const allCodes = LIVE_CATEGORIES.flatMap((c) => c.listings.map((l) => l.code));
eq('no duplicate listing codes', new Set(allCodes).size, allCodes.length);
eq('sticker codes are distinct', getCategory('sticker')?.listings.map((l) => l.code), ['PR-005-A', 'PR-005-B', 'PR-005-C']);
eq('productCode resolves a listing', productCode('business_card', 'rounded'), 'PR-004-B');

console.log('\nMatrix reference table (QA §4)');
const cellsFor = (cat: string, listing?: string) => {
  const g = getListing(getCategory(cat)!, listing)?.pricingGrid;
  return g ? gridCellCount(g) : 0;
};
// The QA table counts Jotter as 2 covers x 2 sizes x 3 sheets = 12. Cover is now a separate
// LISTING rather than a grid axis, so that 12 is split as 6 cells in each of the two covers.
eq('Jotter soft cover = 6 cells', cellsFor('jotter', 'soft_cover'), 6);
eq('Jotter hard cover = 6 cells', cellsFor('jotter', 'hard_cover'), 6);
eq('Jotter totals 12 cells across both covers', cellsFor('jotter', 'soft_cover') + cellsFor('jotter', 'hard_cover'), 12);
eq('Jotter sizes are A6 + A5', getListing(getCategory('jotter')!, 'soft_cover')?.pricingGrid?.axes[0].values, ['A6', 'A5']);
eq('Jotter has no inner cover dropdown',
  (getListing(getCategory('jotter')!, 'soft_cover')?.optionAxes ?? []).some((a) => a.key === 'cover'), false);
eq('Jotter sheets are 50/75/100', getListing(getCategory('jotter')!, 'soft_cover')?.pricingGrid?.axes[1].values, [50, 75, 100]);
eq('Flyer = 6 cells', cellsFor('flyer'), 6);
eq('Flyer has exactly 3 fixed add-ons', getListing(getCategory('flyer')!, 'flyer')?.fixedAddons?.length, 3);
eq('Business Card Standard = 24 cells', cellsFor('business_card', 'standard'), 24);
eq('Business Card Rounded = 24 cells', cellsFor('business_card', 'rounded'), 24);
eq('Business Card has NO add-ons', getListing(getCategory('business_card')!, 'standard')?.fixedAddons, undefined);
eq('Sticker Round = 9 cells', cellsFor('sticker', 'round'), 9);
eq('Sticker Straight = 9 cells', cellsFor('sticker', 'straight'), 9);
eq('Sticker Large Format has no grid', cellsFor('sticker', 'large_format'), 0);
eq('Sticker Large Format is per-area', getListing(getCategory('sticker')!, 'large_format')?.perAreaRate, true);
eq('Brand Nylon = 12 cells', cellsFor('nylon'), 12);
eq('Thank You Card = 4 cells', cellsFor('thank_you_card'), 4);
eq('ID Card = 2 cells', cellsFor('id_card'), 2);
eq('Banner is per-area, no grid', cellsFor('banner'), 0);

console.log('\nCustomer-side corrections');
eq('Banner presets are the corrected set',
  getListing(getCategory('banner')!, 'banner')?.size?.presets.map((p) => p.label),
  ['3 × 3 ft', '5 × 5 ft', '8 × 6 ft', '12 × 8 ft']);
eq('Banner quantity is 1 + custom only', getListing(getCategory('banner')!, 'banner')?.qty?.presets, [1]);
eq('Banner has the free hylet axis', getListing(getCategory('banner')!, 'banner')?.optionAxes?.[0].key, 'hylet');
eq('Large Format is custom size only', getListing(getCategory('sticker')!, 'large_format')?.size?.customOnly, true);
eq('Large Format has no size presets', getListing(getCategory('sticker')!, 'large_format')?.size?.presets.length, 0);
eq('Round Cut presets corrected',
  getListing(getCategory('sticker')!, 'round')?.size?.presets.map((p) => p.label),
  ['2.5 × 2.5 in', '3 × 3 in', '3.5 × 3.5 in']);
eq('Straight Cut presets corrected',
  getListing(getCategory('sticker')!, 'straight')?.size?.presets.map((p) => p.label),
  ['2 × 2 in', '3 × 2 in', '3 × 5 in']);
eq('Sticker minimum is a hard 50', getListing(getCategory('sticker')!, 'round')?.qty?.min, 50);
// QA 2.5 / 2.6: no lamination anywhere on Sticker.
eq('no sticker listing offers lamination',
  getCategory('sticker')!.listings.some((l) => (l.optionAxes ?? []).some((a) => a.key === 'lamination')), false);
eq('Business Card weights corrected',
  getListing(getCategory('business_card')!, 'standard')?.optionAxes?.find((a) => a.key === 'weight')?.options,
  ['300gsm (Thick)', '600gsm (Doubled thick)', '900gsm (Extra thick)']);
eq('Business Card lamination is cosmetic only',
  getListing(getCategory('business_card')!, 'standard')?.optionAxes?.find((a) => a.key === 'lamination')?.cosmetic, true);
eq('Nylon has no print-sides choice',
  (getListing(getCategory('nylon')!, 'polybag')?.optionAxes ?? []).some((a) => a.key === 'sides'), false);
eq('Nylon colour axes present',
  (getListing(getCategory('nylon')!, 'polybag')?.optionAxes ?? []).map((a) => a.key),
  ['size', 'nylon_colour', 'ink_colour']);
eq('Thank You Card uses a free quantity field', getListing(getCategory('thank_you_card')!, 'thank_you_card')?.qty?.freeInput, true);
eq('Thank You Card minimum is 50', getListing(getCategory('thank_you_card')!, 'thank_you_card')?.qty?.min, 50);
eq('Thank You Card Feel replaces lamination',
  (getListing(getCategory('thank_you_card')!, 'thank_you_card')?.optionAxes ?? []).map((a) => a.key),
  ['size', 'feel', 'sides']);
eq('Thank You Card Feel has no None option',
  getListing(getCategory('thank_you_card')!, 'thank_you_card')?.optionAxes?.find((a) => a.key === 'feel')?.options,
  ['Matte', 'Gloss']);
eq('ID Card floor is 1', getListing(getCategory('id_card')!, 'id_card')?.qty?.min, 1);
eq('ID Card presets are 1/10', getListing(getCategory('id_card')!, 'id_card')?.qty?.presets, [1, 10]);
eq('Flyer copy no longer mentions A6', getCategory('flyer')?.blurb.includes('A6'), false);

console.log('\nQuantity band matching (QA 3.3 — Flyer only)');
const bands = ['1-500', '501-1000', '1000+'];
eq('1 lands in the first band', matchQtyRange(bands, 1), '1-500');
eq('500 is the top of the first band', matchQtyRange(bands, 500), '1-500');
eq('501 crosses into the second', matchQtyRange(bands, 501), '501-1000');
eq('1000 is still the second band', matchQtyRange(bands, 1000), '501-1000');
eq('1001 falls in the open-ended band', matchQtyRange(bands, 1001), '1000+');
eq('50000 still matches the open band', matchQtyRange(bands, 50000), '1000+');

console.log('\nGrid expansion (QA 1.5 — auto-generated, not hand-added)');
const bcGrid = getListing(getCategory('business_card')!, 'standard')!.pricingGrid!;
const bcCells = gridCells(bcGrid);
eq('expansion produces every combination', bcCells.length, 24);
eq('every expanded cell is unique', new Set(bcCells.map((c) => cellKey(bcGrid, c))).size, 24);
eq('first cell is the first value of every axis', bcCells[0], { sides: 'Front only', weight: '300gsm', qty: 100 });

console.log('\nPricing engine — grid resolution');
type AnyProduct = Parameters<typeof computePrice>[1];
const product = (over: Partial<AnyProduct> = {}) => ({
  id: 'p', shopId: 's', categorySlug: 'sticker', listingSlug: 'round', name: 'x', description: null,
  photoUrl: null, pricingMode: 'matrix', areaUnit: null, ratePerUnitKobo: null, minChargeKobo: null,
  offersHylet: false, marginType: 'fixed', marginFixedKobo: 0, marginPercentBps: 0,
  turnaroundHours: 24, isActive: true, createdAt: new Date(), ...over,
} as AnyProduct);

type AnyVariant = Parameters<typeof computePrice>[2][number];
const cell = (meta: Record<string, string | number>, naira: number) => ({
  id: 'v', productId: 'p', label: null, qty: null, priceKobo: N(naira), meta,
} as AnyVariant);

// Sticker Round Cut: 3 sizes x 3 tiers, FLAT BATCH price.
const stickerVariants = [
  cell({ size: '3 × 3 in', qty: 50 }, 12000),
  cell({ size: '3 × 3 in', qty: 100 }, 20000),
  cell({ size: '3 × 3 in', qty: 200 }, 35000),
];
const stickerSpec = { category: 'sticker', listing: 'round', sizeLabel: '3 × 3 in', qty: 100 };
const r1 = computePrice(stickerSpec, product(), stickerVariants, []);
eq('flat batch price is NOT multiplied by qty', r1.ok && r1.totalKobo, N(20000));

// QA 3.5: Custom is a Request Quote routing, not a fourth priced tier — no rounding up.
const r2 = computePrice({ ...stickerSpec, qty: 300 }, product(), stickerVariants, []);
eq('300 does NOT round up to the 200 cell', r2.ok, false);
eq('off-tier quantity routes to quote', !r2.ok && r2.reason, 'Not a priced combination');

// An unpriced size is a gap in the printer's own grid, not a platform rule.
const r3 = computePrice({ ...stickerSpec, sizeLabel: '2.5 × 2.5 in' }, product(), stickerVariants, []);
eq('unpriced size routes to quote', r3.ok, false);

// Thank You Card: no quantity axis at all, yet priced PER PIECE.
const tycVariants = [cell({ size: 'Big (5.5 × 4in)', sides: 'Front and back' }, 120)];
const tyc = computePrice(
  { category: 'thank_you_card', listing: 'thank_you_card', qty: 250, options: { size: 'Big (5.5 × 4in)', sides: 'Front and back' } },
  product({ categorySlug: 'thank_you_card', listingSlug: 'thank_you_card' }), tycVariants, []);
eq('per-piece grid multiplies by quantity', tyc.ok && tyc.totalKobo, N(30000));

// Flyer: banded quantity axis, per-piece rate.
const flyerVariants = [cell({ size: 'A5 (Standard)', qty: '501-1000' }, 90)];
const flyer = computePrice(
  { category: 'flyer', listing: 'flyer', qty: 750, options: { size: 'A5 (Standard)' } },
  product({ categorySlug: 'flyer', listingSlug: 'flyer' }), flyerVariants, []);
eq('a quantity inside a band matches that band', flyer.ok && flyer.totalKobo, N(67500));

// QA 3.4: Standard and Rounded are separate products and can never price each other.
eq('a Rounded product does not answer a Standard spec',
  computePrice(
    { category: 'business_card', listing: 'standard', qty: 100 },
    product({ categorySlug: 'business_card', listingSlug: 'rounded' }), [], []).ok,
  false);

// QA 3.1: Banner's minimum-charge floor is gone — a tiny custom size prices honestly low.
const banner = computePrice(
  { category: 'banner', listing: 'banner', qty: 1, width: 1, height: 1, unit: 'ft' },
  product({ categorySlug: 'banner', listingSlug: 'banner', pricingMode: 'per_area', areaUnit: 'sqft', ratePerUnitKobo: N(1800), minChargeKobo: N(5000) }),
  [], []);
eq('no minimum-charge floor is applied', banner.ok && banner.totalKobo, N(1800));

console.log('\nIntegrity');
eq('all live categories have a name', LIVE_CATEGORIES.every((c) => c.name.length > 0), true);
eq('no duplicate slugs', new Set(CATEGORIES.map((c) => c.slug)).size, CATEGORIES.length);
eq('every live category has at least one listing', LIVE_CATEGORIES.every((c) => c.listings.length > 0), true);
// Every grid axis must be resolvable from something the configurator can actually collect.
const RESOLVABLE = new Set(['size', 'qty', 'qty_range', 'sheets', 'option']);
eq('every grid axis has a resolvable source',
  LIVE_CATEGORIES.every((c) => c.listings.every((l) =>
    (l.pricingGrid?.axes ?? []).every((a) => RESOLVABLE.has(a.source)))), true);
// An 'option'-sourced axis must have a matching option axis the customer is actually shown.
eq('every option-sourced axis is offered to the customer',
  LIVE_CATEGORIES.every((c) => c.listings.every((l) =>
    (l.pricingGrid?.axes ?? []).filter((a) => a.source === 'option')
      .every((a) => (l.optionAxes ?? []).some((o) => o.key === a.key)))), true);
// A 'size'-sourced axis must line up with the size presets, or nothing can ever be priced.
eq('every size-sourced axis matches its presets',
  LIVE_CATEGORIES.every((c) => c.listings.every((l) => {
    const axis = (l.pricingGrid?.axes ?? []).find((a) => a.source === 'size');
    if (!axis) return true;
    if (!l.size) return false; // a size axis with no size presets can never be priced
    return axis.values.every((v) => l.size!.presets.some((p) => p.label === String(v)));
  })), true);
// Every priced quantity tier must be reachable from the customer's own presets — otherwise a
// printer prices a cell no customer can ever land on. Business Card is the one known exception
// (see below), so it is excluded here rather than silently weakening the rule.
const qtyCovered = (l: { pricingGrid?: PricingGrid; qty?: { presets: number[] } }) => {
  const axis = (l.pricingGrid?.axes ?? []).find((a) => a.source === 'qty');
  if (!axis) return true;
  return axis.values.every((v) => (l.qty?.presets ?? []).includes(Number(v)));
};
eq('every exact qty tier is offered to the customer',
  LIVE_CATEGORIES.filter((c) => c.slug !== 'business_card').every((c) => c.listings.every(qtyCovered)), true);

// KNOWN GAP, founder-confirmed 04 Aug 2026: the printer grid uses 100/200/500/1000 while the
// customer presets stayed 100/250/500/1000. A customer picking 250 has no matching cell and
// always routes to Request Quote, and the 200 cell is never reachable from a preset. This test
// pins that gap so it cannot be forgotten — flip both sides to the same four numbers to close it.
eq('Business Card qty tiers deliberately do NOT line up',
  getCategory('business_card')!.listings.every(qtyCovered), false);

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
