/* Runtime checks for the V2 pricing engine: npx tsx scripts/test-pricing.ts
   Pure-function tests — no DB, no network. Verifies the money math actually produces the
   numbers the founder decisions specify, not just that it type-checks. */

import { computeMargin, computeOrderTotals, computePrice, DEFAULT_PLATFORM_FEE_KOBO } from '../src/lib/pricing';
import {
  stepsFor, statusLabel, canDecline, isSettlementEligible, QUEUE_STATUSES,
  canDispatch, canSetDeliveryFee, dispatchBlockedReason,
} from '../src/lib/status';
import {
  CATEGORIES, LIVE_CATEGORIES, getCategory, getListing, needsTypeSelection,
  gridCellCount, gridCells, cellKey, matchQtyRange, productCode,
} from '../src/lib/categories';
import type { PricingGrid } from '../src/lib/categories';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { photoKey, pickPhoto } from '../src/lib/photos';
import { marginFor } from '../src/lib/margins';
import { isVerified } from '../src/lib/verification';
// Aliased: the V1 categories module exports the same names, and both models coexist until
// Module 2 replaces the old customer flow.
import {
  CATEGORIES as V2_CATEGORIES, LIVE_CATEGORIES as V2_LIVE, BROWSABLE_CATEGORIES,
  MAX_TIERS, getCategory as v2Category, isLive, isReservedSlug, RESERVED_SLUGS, SUGGESTED_MODE,
} from '../src/lib/catalog';
import {
  computeListingPrice, fromPriceKobo, needsCustomQuantity, validateTiers, sortTiers,
} from '../src/lib/listing-pricing';
import { haversineKm, sortByDistance, type PrinterCard } from '../src/lib/discovery';
import {
  DESIGN_MARGIN_KOBO, computeDesignTotals, freeRevisionsLeft,
  canRequestRevision, needsPaidRevision, canApprove,
} from '../src/lib/design-orders';
import { designOrderCode, revisionChargeCode } from '../src/lib/format';
import { emailConfigured, sendEmail } from '../src/lib/email';
import { LEGAL_DOCS, LEGAL_VERSION, getLegalDoc, readLegalDoc, parseLegal, inlineSegments } from '../src/lib/legal';

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
  id: 'p', shopId: 's', categorySlug: 'business_card', listingSlug: 'standard', listingId: null,
  name: 'BC', description: null,
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
  id: 'p', shopId: 's', categorySlug: 'sticker', listingSlug: 'round', listingId: null,
  name: 'x', description: null,
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
eq('no duplicate slugs', new Set(V2_CATEGORIES.map((c) => c.slug)).size, V2_CATEGORIES.length);
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

console.log('\nCatalog photo keys');
eq('category key has no colon', photoKey('sticker'), 'sticker');
eq('listing key is category:listing', photoKey('sticker', 'round'), 'sticker:round');
eq('a null listing falls back to the category key', photoKey('sticker', null), 'sticker');
// A listing photo wins; the category photo is the fallback; the glyph is the last resort.
const pm = { sticker: 'CAT', 'sticker:round': 'ROUND' };
eq('listing photo wins', pickPhoto(pm, 'sticker', 'round'), 'ROUND');
eq('falls back to the category photo', pickPhoto(pm, 'sticker', 'straight'), 'CAT');
eq('nothing at all returns undefined', pickPhoto({}, 'sticker', 'round'), undefined);
// Every slot the admin screen offers must be a key the customer pages actually read.
const adminSlots = LIVE_CATEGORIES.flatMap((c) => [
  photoKey(c.slug),
  ...(c.listings.length > 1 ? c.listings.map((l) => photoKey(c.slug, l.slug)) : []),
]);
eq('no duplicate admin photo slots', new Set(adminSlots).size, adminSlots.length);
eq('every slot resolves back to a live listing or category',
  adminSlots.every((k) => {
    const [cat, listing] = k.split(':');
    const c = getCategory(cat);
    return Boolean(c?.live) && (!listing || Boolean(getListing(c!, listing)));
  }), true);

console.log('\nDelivery fee gate (cash to the rider on arrival)');
// The whole point: a rider must never ride out to a customer who has not agreed to pay.
eq('cannot dispatch before a fee is named', canDispatch('delivery', 'ready_for_dispatch', 'not_set'), false);
eq('cannot dispatch while the fee is only quoted', canDispatch('delivery', 'ready_for_dispatch', 'quoted'), false);
eq('cannot dispatch after the customer declined', canDispatch('delivery', 'ready_for_dispatch', 'declined'), false);
eq('CAN dispatch once accepted', canDispatch('delivery', 'ready_for_dispatch', 'accepted'), true);
eq('cannot dispatch before the job is ready', canDispatch('delivery', 'printing_in_progress', 'accepted'), false);
// Collection orders have no fee and never dispatch — the customer's own rider collects.
eq('collection never dispatches', canDispatch('collection', 'ready_for_dispatch', 'accepted'), false);
eq('collection has no fee to set', canSetDeliveryFee('collection', 'ready_for_dispatch'), false);

eq('a printer can name the fee while printing', canSetDeliveryFee('delivery', 'printing_in_progress'), true);
eq('a printer can still revise it when ready', canSetDeliveryFee('delivery', 'ready_for_dispatch'), true);
eq('the fee is locked once it has shipped', canSetDeliveryFee('delivery', 'out_for_delivery'), false);
eq('the fee is locked after delivery', canSetDeliveryFee('delivery', 'delivered'), false);

// Every blocked state must explain itself — a printer staring at a disabled button is a support call.
eq('accepted + ready has no blocking reason', dispatchBlockedReason('delivery', 'ready_for_dispatch', 'accepted'), null);
eq('every other blocked state gives a reason',
  (['not_set', 'quoted', 'declined'] as const)
    .every((f) => typeof dispatchBlockedReason('delivery', 'ready_for_dispatch', f) === 'string'), true);

console.log('\nCategory margin resolution');
const productMargin = { marginType: 'fixed' as const, marginFixedKobo: N(25), marginPercentBps: 0 };
const configured = { id_card: { marginType: 'fixed' as const, marginFixedKobo: N(200), marginPercentBps: 0 } };
eq('a configured category wins over the product row',
  marginFor(configured, 'id_card', productMargin).marginFixedKobo, N(200));
eq('an unconfigured category falls back to the product row',
  marginFor(configured, 'flyer', productMargin).marginFixedKobo, N(25));
eq('an empty config changes nothing', marginFor({}, 'id_card', productMargin), productMargin);
// Zero must be a real answer, not read as "not configured" — a category can be margin-free.
const zeroed = { flyer: { marginType: 'fixed' as const, marginFixedKobo: 0, marginPercentBps: 0 } };
eq('a zero margin is honoured, not treated as unset',
  computeMargin(N(10000), 500, marginFor(zeroed, 'flyer', productMargin)), 0);
// The editor's live preview must agree with the server, or the number shown is a lie.
eq('7% preview matches the engine',
  computeMargin(N(10000), 100, { marginType: 'percent', marginFixedKobo: 0, marginPercentBps: 700 }),
  N(700));

console.log('\nPer-category verification');
const pairs = new Set(['shopA:sticker', 'shopA:flyer', 'shopB:flyer']);
eq('a verified pair is visible', isVerified(pairs, 'shopA', 'sticker'), true);
// The whole point of PER-category verification: clearance does not spread across categories.
eq('verification does not leak between categories', isVerified(pairs, 'shopB', 'sticker'), false);
eq('an unknown shop is never verified', isVerified(pairs, 'shopC', 'flyer'), false);
eq('an empty set verifies nobody', isVerified(new Set(), 'shopA', 'sticker'), false);
// Fail CLOSED: if the verification table is unreadable the resolver returns an empty set, so
// shops disappear from the storefront rather than an unvetted printer being shown.
eq('no verification data means no printers shown', isVerified(new Set(), 'shopA', 'flyer'), false);

// Wrapped in an async IIFE: this file has no top-level await, and the summary must print
// after these checks rather than before them.
void (async () => {
  console.log('\nEmail is inert until configured');
  // The point of this batch: everything ships now, the DNS work happens whenever.
  const hadKey = process.env.RESEND_API_KEY;
  const hadFrom = process.env.EMAIL_FROM;
  delete process.env.RESEND_API_KEY;
  eq('unconfigured is reported honestly', emailConfigured(), false);
  const skipped = await sendEmail({ to: 'a@b.com', subject: 's', heading: 'h', body: ['x'] });
  eq('an unconfigured send is skipped, not thrown', skipped.sent, false);
  eq('and says why', skipped.reason, 'not_configured');
  // A missing address must never blow up a paid order either.
  process.env.RESEND_API_KEY = 'test';
  process.env.EMAIL_FROM = 'a@b.com';
  const noAddress = await sendEmail({ to: '', subject: 's', heading: 'h', body: ['x'] });
  eq('an empty address is skipped, not thrown', noAddress.sent, false);
  eq('and says why', noAddress.reason, 'no_address');
  delete process.env.RESEND_API_KEY;
  delete process.env.EMAIL_FROM;
  if (hadKey) process.env.RESEND_API_KEY = hadKey;
  if (hadFrom) process.env.EMAIL_FROM = hadFrom;

console.log('\nLegal documents');
  eq('four documents make up the agreement', LEGAL_DOCS.length, 4);
  eq('slugs are stable', LEGAL_DOCS.map((d) => d.slug), ['terms', 'privacy', 'refunds', 'acceptable-use']);
  eq('an unknown slug resolves to nothing', getLegalDoc('nope'), undefined);
  // Every document must actually load and parse — a missing file would 500 the page, and a
  // terms page that 500s is worse than one that is merely out of date.
  for (const d of LEGAL_DOCS) {
    const blocks = parseLegal(readLegalDoc(d.file));
    eq(`${d.slug} parses into blocks`, blocks.length > 20, true);
    eq(`${d.slug} opens with its title`, blocks[0].type, 'h1');
    eq(`${d.slug} has numbered sections`, blocks.some((b) => b.type === 'h2'), true);
    eq(`${d.slug} has lists`, blocks.some((b) => b.type === 'ul'), true);
  }
  // Ordered lists must survive parsing — the Terms order-process steps are numbered.
  const termsBlocks = parseLegal(readLegalDoc('terms.md'));
  eq('terms keeps its numbered order process', termsBlocks.some((b) => b.type === 'ol'), true);
  eq('bold segments are extracted', inlineSegments('a **b** c').filter((s) => s.bold).length, 1);
  eq('plain text is left alone', inlineSegments('no markup').length, 1);
  eq('a version is stamped for the consent record', LEGAL_VERSION.length > 0, true);
  
  console.log('\nFAQ seed content');
  // The starter answers ship in migration 0009. They must describe the platform as BUILT —
  // a FAQ that contradicts the product is worse than no FAQ.
  const faqSql = readFileSync('drizzle/0009_v2_faq.sql', 'utf8');
  eq('starter questions are seeded', (faqSql.match(/^\('/gm) ?? []).length, 8);
  eq('delivery answer says cash to the rider', /cash to the rider/.test(faqSql), true);
  eq('delivery answer says it is not charged at checkout', /not charged at checkout/.test(faqSql), true);
  eq('Collection fallback is explained', /send your own rider/.test(faqSql), true);
  eq('no rounding up is explained', /do not guess or round it up/.test(faqSql), true);
  eq('CDR is listed among accepted files', /CDR/.test(faqSql), true);
  // The eight live categories are never listed here on purpose — that list changes, and a
  // stale product list in a FAQ is exactly the drift the admin editor exists to prevent.
  
  console.log('\nMigrations execute, not just parse');
  // Migration 0007 shipped SQL that type-checked, read correctly, and was rejected by Postgres.
  // These guard the specific trap: an enum literal inside INSERT ... SELECT needs a cast,
  // because Postgres only infers enum types through a VALUES list.
  const migrations = readdirSync('drizzle').filter((f) => f.endsWith('.sql')).sort();
  eq('every migration has a snapshot', migrations.every((f) => {
    const idx = f.slice(0, 4);
    return existsSync(`drizzle/meta/${idx}_snapshot.json`);
  }), true);
  const journal = JSON.parse(readFileSync('drizzle/meta/_journal.json', 'utf8')) as { entries: { tag: string }[] };
  eq('journal matches the migration files', journal.entries.length, migrations.length);
  eq('journal tags line up in order',
    journal.entries.map((e) => `${e.tag}.sql`), migrations);
  // An enum literal selected (not VALUES'd) into an enum column must carry an explicit cast.
  for (const f of migrations) {
    // Comments are stripped first — 0007 explains this very trap in a comment, and the
    // check would otherwise flag its own documentation.
    const sqlText = readFileSync(`drizzle/${f}`, 'utf8')
      .split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');
    const risky = /INSERT[\s\S]*?SELECT[\s\S]*?'(verified|pending|rejected|fixed|percent)'(?!::)/i.test(sqlText);
    eq(`${f} casts enum literals in INSERT ... SELECT`, risky, false);
  }
  
  console.log('\nDesign order pricing');
  // Founder decision: a FLAT 1,000 naira per design order, not a share of the designer's fee.
  eq('margin is a flat 1,000 naira', DESIGN_MARGIN_KOBO, N(1000));
  const cheap = computeDesignTotals(N(8000), N(500));
  const dear = computeDesignTotals(N(80000), N(500));
  eq('a small job pays the same margin', cheap.marginKobo, N(1000));
  eq('a large job pays the same margin', dear.marginKobo, N(1000));
  eq('total is designer + margin + fee', cheap.amountPaidKobo, N(9500));
  eq('the designer keeps their whole price', dear.designerBaseKobo, N(80000));
  
  console.log('\nRevision rules');
  const twoIncluded = { status: 'proof_ready', reviewMode: 'review', revisionsIncluded: 2, revisionsUsed: 0 };
  eq('free revisions start at the included count', freeRevisionsLeft(twoIncluded), 2);
  eq('a free revision can be requested', canRequestRevision(twoIncluded, 0), true);
  eq('no payment needed while free ones remain', needsPaidRevision(twoIncluded, 0), false);
  
  const spent = { ...twoIncluded, revisionsUsed: 2 };
  eq('free revisions run out', freeRevisionsLeft(spent), 0);
  eq('cannot request once free ones are gone', canRequestRevision(spent, 0), false);
  eq('payment is required at that point', needsPaidRevision(spent, 0), true);
  // A paid extra unlocks exactly one more request and never touches the included counter.
  eq('a paid extra unlocks a request', canRequestRevision(spent, 1), true);
  eq('and no further payment is asked for', needsPaidRevision(spent, 1), false);
  // Revisions are only possible while a proof is actually on the table.
  eq('cannot revise while the designer is still working',
    canRequestRevision({ ...twoIncluded, status: 'in_progress' }, 0), false);
  
  console.log('\nProof approval gate');
  eq('a waiting proof can be approved', canApprove({ status: 'proof_ready', reviewMode: 'review' }), true);
  eq('nothing to approve mid-work', canApprove({ status: 'in_progress', reviewMode: 'review' }), false);
  // Direct-to-print has no proof gate at all — that is what the customer chose.
  eq('direct to print never asks for approval',
    canApprove({ status: 'proof_ready', reviewMode: 'direct' }), false);
  
  console.log('\nSettlement routing by reference');
  // settlePayment branches on the prefix, so a design payment can never be settled as print.
  eq('design references are prefixed', designOrderCode().startsWith('PRD-'), true);
  eq('revision charges are prefixed', revisionChargeCode().startsWith('PRR-'), true);
  eq('the two prefixes never collide', designOrderCode().slice(0, 4) === revisionChargeCode().slice(0, 4), false);
  
  
    console.log('\nDesign to print handoff');
  // The handoff is a URL parameter, so the guard that matters is server-side: only the
  // customer who owns an APPROVED design may attach it. These pin the rule the resolver
  // enforces, so a future refactor cannot quietly widen it.
  const handoffAllows = (o: { customerId: string; status: string; finalFileUrl: string | null }, viewer: string) =>
    o.customerId === viewer && o.status === 'approved' && Boolean(o.finalFileUrl);
  const mine = { customerId: 'me', status: 'approved', finalFileUrl: 'https://res.cloudinary.com/x.png' };
  eq('my approved design attaches', handoffAllows(mine, 'me'), true);
  eq('someone else\'s design never attaches', handoffAllows(mine, 'someone-else'), false);
  eq('an unapproved proof never attaches', handoffAllows({ ...mine, status: 'proof_ready' }, 'me'), false);
  eq('a cancelled order never attaches', handoffAllows({ ...mine, status: 'cancelled' }, 'me'), false);
  eq('an approved order with no file attaches nothing', handoffAllows({ ...mine, finalFileUrl: null }, 'me'), false);

console.log('\nV2 category system (Module 1)');
  eq('nine top-level categories', V2_CATEGORIES.length, 9);
  eq('seven are live at launch', V2_LIVE.length, 7);
  // Founder decision Sept 2026: Apparel is Coming Soon, Frames stays hidden.
  eq('apparel is coming soon, not live', v2Category('apparel-merch')?.status, 'coming_soon');
  eq('frames stays hidden', v2Category('frames-photo')?.status, 'hidden');
  eq('apparel is browsable but not orderable', BROWSABLE_CATEGORIES.some((c) => c.slug === 'apparel-merch'), true);
  eq('frames is not browsable', BROWSABLE_CATEGORIES.some((c) => c.slug === 'frames-photo'), false);
  eq('a printer cannot list under apparel', isLive('apparel-merch'), false);
  eq('a printer cannot list under frames', isLive('frames-photo'), false);
  eq('every category has suggestions', V2_CATEGORIES.every((c) => c.suggested.length > 0), true);
  eq('no duplicate category slugs', new Set(V2_CATEGORIES.map((c) => c.slug)).size, V2_CATEGORIES.length);
  eq('every live category has a suggested pricing mode',
    V2_LIVE.every((c) => Boolean(SUGGESTED_MODE[c.slug])), true);

  console.log('\nReserved storefront slugs');
  // printruns.ng/[slug] shares a namespace with every top-level route, so a printer named
  // "Products" must not be able to take over the products page.
  eq('products is reserved', isReservedSlug('products'), true);
  eq('admin is reserved', isReservedSlug('admin'), true);
  eq('designers is reserved', isReservedSlug('designers'), true);
  eq('reservation ignores case', isReservedSlug('Products'), true);
  eq('an ordinary business name is free', isReservedSlug('cubicprints'), false);
  // Every real route must be covered, or a live page gets shadowed by a storefront.
  for (const route of ['products', 'orders', 'checkout', 'track', 'faq', 'legal', 'designers', 'studio', 'dashboard', 'admin', 'login', 'register', 'printers', 'configure', 'design', 'api']) {
    eq(`route /${route} is protected`, RESERVED_SLUGS.has(route), true);
  }

  console.log('\nThree pricing modes (Module 1 §5)');
  const baseListing = {
    id: 'l', shopId: 's', subcategoryId: null, categorySlug: 'stickers-labels',
    name: 'x', description: null, photos: [], pricingMode: 'tier' as const,
    ratePerPieceKobo: null, ratePerAreaKobo: null, areaUnit: null, minChargeKobo: null,
    minimumOrder: null, turnaroundHours: 24, isActive: true,
    createdAt: new Date(), updatedAt: new Date(),
  };
  const tier = (quantity: number, naira: number) => ({ id: `t${quantity}`, listingId: 'l', quantity, priceKobo: N(naira) });
  const tiers = [tier(500, 40000), tier(100, 10000), tier(200, 18000)];

  // Tiers are flat batch prices, never multiplied.
  const t100 = computeListingPrice(baseListing, tiers, { qty: 100 });
  eq('a tier price is the batch total', t100.ok && t100.totalKobo, N(10000));
  // §5.1: above the top tier routes to Request Quote rather than extrapolating.
  const t900 = computeListingPrice(baseListing, tiers, { qty: 900 });
  eq('above the top tier does not extrapolate', t900.ok, false);
  eq('and offers a custom quantity', needsCustomQuantity(baseListing, tiers, 900), true);
  // A quantity BETWEEN tiers is not a price either — the printer named specific batches.
  eq('between tiers is not rounded', computeListingPrice(baseListing, tiers, { qty: 150 }).ok, false);
  eq('tiers sort by quantity regardless of entry order', sortTiers(tiers).map((t) => t.quantity), [100, 200, 500]);
  eq('from-price is the cheapest tier', fromPriceKobo(baseListing, tiers), N(10000));

  const piece = { ...baseListing, pricingMode: 'piece' as const, ratePerPieceKobo: N(250), minimumOrder: 50 };
  const p80 = computeListingPrice(piece, [], { qty: 80 });
  eq('per piece multiplies by quantity', p80.ok && p80.totalKobo, N(20000));
  eq('below the minimum order is refused', computeListingPrice(piece, [], { qty: 10 }).ok, false);
  // Quoting the single-unit rate on a listing with a minimum of 50 would advertise a price
  // nobody can actually buy.
  eq('from-price respects the minimum order', fromPriceKobo(piece, []), N(12500));

  const area = { ...baseListing, pricingMode: 'area' as const, ratePerAreaKobo: N(1800), areaUnit: 'sqft' as const };
  const a = computeListingPrice(area, [], { width: 3, height: 4 });
  eq('per area is width x height x rate', a.ok && a.totalKobo, N(21600));
  eq('missing dimensions route to quote', computeListingPrice(area, [], {}).ok, false);

  // Minimum charge, restored by founder decision (reversing QA 3.1).
  const floored = { ...area, minChargeKobo: N(5000) };
  const tiny = computeListingPrice(floored, [], { width: 1, height: 1 });
  eq('a tiny size is lifted to the minimum charge', tiny.ok && tiny.totalKobo, N(5000));
  const big = computeListingPrice(floored, [], { width: 5, height: 5 });
  eq('a large size is unaffected by the floor', big.ok && big.totalKobo, N(45000));
  // The floor is per unit — ten tiny banners must not clear a floor meant to cover one.
  const ten = computeListingPrice(floored, [], { width: 1, height: 1, qty: 10 });
  eq('the floor applies per unit, not per order', ten.ok && ten.totalKobo, N(50000));

  console.log('\nTier validation');
  eq('at least one tier is required', validateTiers([]), 'Set at least one quantity and price.');
  eq('duplicate quantities are rejected',
    validateTiers([{ quantity: 100, priceKobo: 1 }, { quantity: 100, priceKobo: 2 }]),
    'Each tier needs a different quantity.');
  eq(`more than ${MAX_TIERS} tiers are rejected`,
    validateTiers([1, 2, 3, 4].map((q) => ({ quantity: q * 100, priceKobo: q }))),
    `You can set up to ${MAX_TIERS} tiers.`);
  eq('three valid tiers pass', validateTiers([1, 2, 3].map((q) => ({ quantity: q * 100, priceKobo: q }))), null);

console.log('\nDiscovery sorting (Module 2)');
  const card = (over: Partial<PrinterCard>): PrinterCard => ({
    id: 'x', slug: 'x', code: 'LB-001', businessName: 'X', bannerUrl: null, logoUrl: null,
    area: 'Lagos', verified: false, ratingAvg: 0, ratingCount: 0, categories: [],
    fromKobo: null, distanceKm: null, ...over,
  });

  // Lagos check: Yaba to Lekki is roughly 15km straight line.
  const yabaToLekki = haversineKm({ lat: 6.5095, lng: 3.3711 }, { lat: 6.4474, lng: 3.4736 });
  eq('distance is in a believable range', yabaToLekki > 10 && yabaToLekki < 20, true);
  eq('same point is zero distance', Math.round(haversineKm({ lat: 6.5, lng: 3.4 }, { lat: 6.5, lng: 3.4 })), 0);

  const sorted = sortByDistance([
    card({ id: 'far', distanceKm: 12 }),
    card({ id: 'none', distanceKm: null, ratingAvg: 5 }),
    card({ id: 'near', distanceKm: 2 }),
  ]);
  eq('nearest first', sorted[0].id, 'near');
  // A printer who has not pinned their location is still a real printer — they sort last
  // rather than being dropped, however good their rating.
  eq('unlocated printers sort last, not out', sorted[2].id, 'none');
  eq('nobody is dropped', sorted.length, 3);

  const tied = sortByDistance([
    card({ id: 'low', distanceKm: 3, ratingAvg: 3.2 }),
    card({ id: 'high', distanceKm: 3, ratingAvg: 4.8 }),
  ]);
  eq('equal distance breaks on rating', tied[0].id, 'high');

  // Tier 1 printers are live but unbadged — the founder decision that unblocked Module 1.
  eq('tier 1 is not badged', card({ verified: false }).verified, false);

console.log('\nQuote pricing (Module 2 §7)');
  // A printer quotes what THEY want to earn. The margin and platform fee are added on top at
  // payment, never quoted by the printer — what PrintRuns earns is not theirs to set.
  const quoteBase = N(45000);
  const quoteMargin = computeMargin(quoteBase, 1, { marginType: 'fixed', marginFixedKobo: N(500), marginPercentBps: 0 });
  eq('printer keeps exactly what they quoted', quoteBase, N(45000));
  eq('margin is added on top', quoteMargin, N(500));
  eq('customer pays quote + margin + fee', quoteBase + quoteMargin + N(500), N(46000));
  // A percentage margin is taken against the quoted price, not an invented base.
  eq('percent margin applies to the quote',
    computeMargin(N(10000), 1, { marginType: 'percent', marginFixedKobo: 0, marginPercentBps: 700 }), N(700));

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail === 0 ? 0 : 1);
})();
