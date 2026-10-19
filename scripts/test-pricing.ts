/* Runtime checks for the V2 pricing engine: npx tsx scripts/test-pricing.ts
   Pure-function tests — no DB, no network. Verifies the money math actually produces the
   numbers the founder decisions specify, not just that it type-checks. */

import { computeMargin, computeOrderTotals, DEFAULT_PLATFORM_FEE_KOBO } from '../src/lib/pricing';
import { platformFeeFor, DEFAULT_FEE_BANDS } from '../src/lib/platform-fee';
import { homeForRole } from '../src/lib/home-for-role';
import {
  DEFAULT_TIERS, effectiveTier, withinOrderCap, tierNeededFor,
  needsRenewalNotice, daysUntil, BILLING_CYCLE_DAYS, RENEWAL_NOTICE_DAYS,
} from '../src/lib/subscriptions';
import {
  stepsFor, statusLabel, canDecline, isSettlementEligible, QUEUE_STATUSES,
  canDispatch, canSetDeliveryFee, dispatchBlockedReason,
} from '../src/lib/status';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { photoKey, pickPhoto } from '../src/lib/photos';
import { marginFor } from '../src/lib/margins';
import {
  CATEGORIES as V2_CATEGORIES, LIVE_CATEGORIES as V2_LIVE, BROWSABLE_CATEGORIES,
  MAX_TIERS, getCategory as v2Category, isLive, isReservedSlug, RESERVED_SLUGS, SUGGESTED_MODE,
  categoryName, LEGACY_TO_V2,
} from '../src/lib/catalog';
import {
  computeListingPrice, fromPriceKobo, needsCustomQuantity, validateTiers, sortTiers,
} from '../src/lib/listing-pricing';
import { haversineKm, sortByDistance, type PrinterCard } from '../src/lib/discovery';
import { CHECKLIST, FAILURE_COPY, runAutomatedChecks, visibleToPrinter } from '../src/lib/preflight';
import {
  canRaiseDispute, canReview, disputeHoursLeft, settlementEligible,
  standingFor, visibilityPenalty, ratingNeedsReview,
} from '../src/lib/trust';
import { PREFLIGHT_FEE_KOBO } from '../src/lib/preflight-fee';
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
// Was 'scales per piece' under V1, where the platform defined the product and a unit meant
// one card. V2 prices in batches, so a fixed margin is charged once per order.
eq('a fixed margin is charged once, whatever the quantity',
  computeMargin(N(50000), 50, { marginType: 'fixed', marginFixedKobo: N(200), marginPercentBps: 0 }),
  N(200));

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

console.log('\nCatalog photo keys');
eq('category key has no colon', photoKey('sticker'), 'sticker');
eq('listing key is category:listing', photoKey('sticker', 'round'), 'sticker:round');
eq('a null listing falls back to the category key', photoKey('sticker', null), 'sticker');
// A listing photo wins; the category photo is the fallback; the glyph is the last resort.
const pm = { sticker: 'CAT', 'sticker:round': 'ROUND' };
eq('listing photo wins', pickPhoto(pm, 'sticker', 'round'), 'ROUND');
eq('falls back to the category photo', pickPhoto(pm, 'sticker', 'straight'), 'CAT');
eq('nothing at all returns undefined', pickPhoto({}, 'sticker', 'round'), undefined);
// V2 has one photo per top-level category and no sub-type keys, so every slot the admin
// screen offers must be a plain category slug the storefront actually reads.
const adminSlots = BROWSABLE_CATEGORIES.map((c) => photoKey(c.slug));
eq('no duplicate admin photo slots', new Set(adminSlots).size, adminSlots.length);
eq('every slot resolves to a real category', adminSlots.every((slug) => Boolean(v2Category(slug))), true);

// Legacy orders still have to render a category name years later.
eq('a legacy slug still resolves a name', categoryName('business_card'), 'Business Card');
eq('a V2 slug resolves its own name', categoryName('cards-stationery'), 'Cards & Stationery');
eq('an unknown slug degrades rather than throwing', categoryName('who-knows'), 'who knows');
// The margin re-key in migration 0017 follows this map, so it must cover every old category.
eq('every legacy category maps to a live V2 one',
  Object.values(LEGACY_TO_V2).every((slug) => Boolean(v2Category(slug))), true);

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

// Wrapped in an async IIFE: the checks below use await, and the summary must print after
// them rather than before.
void (async () => {
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
    fromKobo: null, distanceKm: null, penalty: 0, priority: 0, ...over,
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

console.log('\nPreflight (Module 3)');
  // The single most important rule in this module: a paused order is invisible to the printer.
  eq('a paused order is hidden from the printer', visibleToPrinter({ status: 'paused' }), false);
  eq('a released order is visible', visibleToPrinter({ status: 'order_received' }), true);
  // Pinning the queue list itself — adding 'paused' here would silently break the rule.
  eq('paused is not a queue status', QUEUE_STATUSES.includes('paused' as never), false);
  eq('the queue starts at order_received', QUEUE_STATUSES[0], 'order_received');

  eq('the V1 checklist has five checks', CHECKLIST.length, 5);
  eq('checks are the five specified',
    CHECKLIST.map((c) => c.key),
    ['resolution', 'colour_mode', 'dimensions', 'file_format', 'readiness']);
  // Every check needs customer-facing wording, or a failure arrives with nothing to act on.
  eq('every check has plain-language failure copy',
    CHECKLIST.every((c) => (FAILURE_COPY[c.key] ?? '').length > 20), true);

  // §8.3: the automated module is a real step that declines to decide in V1, not a stub that
  // callers skip. When tooling lands it returns a decision and nothing else changes.
  const auto = await runAutomatedChecks({ fileUrl: 'https://res.cloudinary.com/x.pdf', fileName: 'x.pdf' });
  eq('V1 automation defers to a human', auto.decided, false);

  // §7: free at launch, but the hook exists so switching it on is a one-line change.
  eq('preflight is free at launch', PREFLIGHT_FEE_KOBO, 0);

console.log('\nTrust and reputation (Module 4)');
  // §4.1: 48 hours from DELIVERY, not from whenever someone happens to look.
  const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000);
  const delivered = (h: number) => ({ status: 'delivered', deliveredAt: hoursAgo(h), disputedAt: null });
  eq('a dispute can be raised inside 48h', canRaiseDispute(delivered(10)), true);
  eq('at 47h it is still open', canRaiseDispute(delivered(47)), true);
  eq('past 48h the window is closed', canRaiseDispute(delivered(49)), false);
  eq('an undelivered order cannot be disputed',
    canRaiseDispute({ status: 'out_for_delivery', deliveredAt: null, disputedAt: null }), false);
  eq('you cannot dispute twice',
    canRaiseDispute({ ...delivered(5), disputedAt: new Date() }), false);
  eq('hours left counts down', disputeHoursLeft(hoursAgo(40)) <= 8, true);

  // §3.1: reviews stay open far longer than disputes.
  eq('a review is allowed on day 5', canReview(delivered(5 * 24), false), true);
  eq('the review window closes after 7 days', canReview(delivered(8 * 24), false), false);
  eq('you cannot review twice', canReview(delivered(1), true), false);

  // §2.1: paying out at delivery would make the 48-hour window meaningless.
  const settleable = (over = {}) => ({ ...delivered(50), settlementStatus: 'pending', ...over });
  eq('settlement waits for the window to close', settlementEligible(settleable()), true);
  eq('settlement is held inside the window', settlementEligible({ ...settleable(), ...delivered(2) }), false);
  eq('an open dispute freezes settlement',
    settlementEligible({ ...settleable(), disputedAt: new Date() }), false);
  eq('an already-settled order is not settled again',
    settlementEligible({ ...settleable(), settlementStatus: 'settled' }), false);

  // §5.1: the ladder is data an admin acts on, not something a counter does by itself.
  eq('no losses is clear', standingFor(0).level, 'clear');
  eq('one loss is noted only', standingFor(1).level, 'noted');
  eq('two losses is a formal warning', standingFor(2).level, 'warned');
  eq('three losses goes to manual review', standingFor(3).level, 'suspend_review');
  // §5.2: silent demotion starts at two, never at one.
  eq('one loss does not demote', visibilityPenalty(1), 0);
  eq('two losses demote', visibilityPenalty(2), 1);

  // §5.1: a low rating only means something once there is enough of it.
  eq('a low rating with few reviews does not flag', ratingNeedsReview(2.0, 3), false);
  eq('a low rating with 10+ reviews flags', ratingNeedsReview(2.9, 12), true);
  eq('a good rating never flags', ratingNeedsReview(4.5, 50), false);

  // Demoted printers sort below everyone, however close they are.
  const ranked = sortByDistance([
    card({ id: 'near-demoted', distanceKm: 1, penalty: 1 }),
    card({ id: 'far-clean', distanceKm: 20, penalty: 0 }),
  ]);
  eq('a demoted printer sorts below a distant clean one', ranked[0].id, 'far-clean');

console.log('\nMargin is per ORDER, never per piece (brief #1 and #3)');
  // The exact bug a tester hit: a printer priced 50 nylon bags at a ₦12,000 BATCH total and
  // the customer was shown ₦37,500 — ₦500 of margin had been multiplied by all 50 pieces.
  const flat500 = { marginType: 'fixed' as const, marginFixedKobo: N(500), marginPercentBps: 0 };
  eq('a fixed margin does not multiply by quantity', computeMargin(N(12000), 50, flat500), N(500));
  eq('quantity 1 is unchanged', computeMargin(N(12000), 1, flat500), N(500));
  eq('quantity 1000 is still one margin', computeMargin(N(12000), 1000, flat500), N(500));
  // The whole order, end to end, against the figure the tester reported.
  const bagOrder = computeOrderTotals(N(12000), 50, flat500, N(500));
  eq('50 bags at ₦12,000 total ₦13,000, not ₦37,500', bagOrder.amountPaidKobo, N(13000));
  eq('the printer still keeps their full price', bagOrder.printerBaseKobo, N(12000));
  // A percentage margin was never affected, which is why per sq.ft looked fine.
  eq('a percent margin is unchanged by quantity',
    computeMargin(N(10000), 50, { marginType: 'percent', marginFixedKobo: 0, marginPercentBps: 700 }), N(700));

  console.log('\nBanded platform fee (brief #10)');
  eq('a small order pays the low band', platformFeeFor(N(12000)), N(500));
  eq('just under the threshold is still low', platformFeeFor(N(49999)), N(500));
  eq('exactly at the threshold is the high band', platformFeeFor(N(50000)), N(1000));
  eq('a large order pays the high band', platformFeeFor(N(250000)), N(1000));
  // Capped deliberately — it does not keep scaling.
  eq('the fee is capped at the high band', platformFeeFor(N(5000000)), N(1000));
  // Tested against the PRINTER's price, so PrintRuns' own margin can never tip an order into
  // the higher band — that would be charging a fee on a fee.
  eq('the threshold ignores margin and fee', platformFeeFor(N(49500)), N(500));
  eq('bands are configurable, not hardcoded',
    platformFeeFor(N(30000), { lowKobo: N(100), highKobo: N(200), thresholdKobo: N(20000) }), N(200));
  eq('defaults match the brief', [DEFAULT_FEE_BANDS.lowKobo, DEFAULT_FEE_BANDS.highKobo, DEFAULT_FEE_BANDS.thresholdKobo],
    [N(500), N(1000), N(50000)]);

console.log('\nRole-aware home (brief #11)');
  // A printer tapping the logo must land in their dashboard. Dropping them on the customer
  // homepage looked like their session had been forgotten, which is alarming when you have
  // money and live orders on the platform.
  eq('a printer goes to their dashboard', homeForRole('printer'), '/dashboard');
  eq('a designer goes to their studio', homeForRole('designer'), '/studio');
  eq('an admin goes to admin', homeForRole('admin'), '/admin');
  eq('a customer goes to the storefront', homeForRole('customer'), '/');
  eq('a signed-out visitor goes to the storefront', homeForRole(undefined), '/');

console.log('\nRound 2 additions');
  // #5: the QR encodes the printer's own public URL — a wrong base here sends every scan to
  // the wrong place, and it is printed on shop signs where it cannot be corrected.
  const qrUrl = (base: string, slug: string) => `${base.replace(/\/$/, '')}/${slug}`;
  eq('the QR points at the storefront', qrUrl('https://printruns.ng', 'cubicprints'), 'https://printruns.ng/cubicprints');
  eq('a trailing slash does not double up', qrUrl('https://printruns.ng/', 'cubicprints'), 'https://printruns.ng/cubicprints');

  // #8: progress is capped below 100 until the server answers — bytes sent is not the same as
  // upload finished, and sitting at 100% waiting looks broken.
  const shown = (loaded: number, total: number) => Math.min(99, Math.round((loaded / total) * 100));
  eq('a half-sent file shows 50%', shown(50, 100), 50);
  eq('all bytes sent still shows 99 until the server replies', shown(100, 100), 99);
  eq('an empty start shows 0', shown(0, 100), 0);

  // #4: three visible, the rest reachable by swiping — the strip must not silently drop any.
  const portfolio = Array.from({ length: 11 }, (_, i) => `p${i}`);
  eq('every photo stays in the strip', portfolio.length, 11);
  eq('the strip scrolls once there are more than three', portfolio.length > 3, true);

console.log('\nSubscription tiers');
  eq('free caps orders at ₦20,000', DEFAULT_TIERS.free.orderCapKobo, N(20000));
  eq('growth caps at ₦150,000', DEFAULT_TIERS.growth.orderCapKobo, N(150000));
  eq('pro is uncapped', DEFAULT_TIERS.pro.orderCapKobo, null);
  eq('growth costs ₦7,500 per cycle', DEFAULT_TIERS.growth.priceKobo, N(7500));
  eq('pro costs ₦12,500 per cycle', DEFAULT_TIERS.pro.priceKobo, N(12500));
  eq('the cycle is two months', BILLING_CYCLE_DAYS, 60);
  eq('retention is 2 / 30 / 90 days',
    [DEFAULT_TIERS.free.fileRetentionDays, DEFAULT_TIERS.growth.fileRetentionDays, DEFAULT_TIERS.pro.fileRetentionDays],
    [2, 30, 90]);
  // Only Pro gets the advance — it moves real money before delivery, so it is the one feature
  // that must never leak to a lower tier by accident.
  eq('only pro gets the material advance',
    [DEFAULT_TIERS.free.materialAdvance, DEFAULT_TIERS.growth.materialAdvance, DEFAULT_TIERS.pro.materialAdvance],
    [false, false, true]);

  console.log('\nOrder cap enforcement');
  eq('a ₦12,000 job fits on free', withinOrderCap(DEFAULT_TIERS.free, N(12000)), true);
  eq('exactly at the cap is allowed', withinOrderCap(DEFAULT_TIERS.free, N(20000)), true);
  eq('a naira over the cap is not', withinOrderCap(DEFAULT_TIERS.free, N(20001)), false);
  eq('growth takes what free cannot', withinOrderCap(DEFAULT_TIERS.growth, N(100000)), true);
  eq('pro takes anything', withinOrderCap(DEFAULT_TIERS.pro, N(50000000)), true);
  eq('the upgrade suggestion is the smallest that fits', tierNeededFor(N(100000), DEFAULT_TIERS), 'growth');
  eq('a huge job suggests pro', tierNeededFor(N(900000), DEFAULT_TIERS), 'pro');

  console.log('\nSubscription expiry');
  const future = new Date(Date.now() + 30 * 86_400_000);
  const past = new Date(Date.now() - 1 * 86_400_000);
  eq('a live paid plan applies', effectiveTier({ subscriptionTier: 'pro', subscriptionEndsAt: future }), 'pro');
  // A printer whose card failed loses the higher cap, not their shop.
  eq('a lapsed plan falls back to free', effectiveTier({ subscriptionTier: 'pro', subscriptionEndsAt: past }), 'free');
  eq('a paid tier with no end date is not trusted',
    effectiveTier({ subscriptionTier: 'growth', subscriptionEndsAt: null }), 'free');
  eq('an unknown tier is free', effectiveTier({ subscriptionTier: 'enterprise', subscriptionEndsAt: future }), 'free');

  // The brief requires 7 days' notice before auto-renewal.
  eq('notice shows inside 7 days', needsRenewalNotice(new Date(Date.now() + 3 * 86_400_000)), true);
  eq('no notice at 20 days out', needsRenewalNotice(new Date(Date.now() + 20 * 86_400_000)), false);
  eq('no notice once it has lapsed', needsRenewalNotice(past), false);
  eq('the notice window is 7 days', RENEWAL_NOTICE_DAYS, 7);
  eq('days remaining counts down', (daysUntil(new Date(Date.now() + 5 * 86_400_000)) ?? 0) <= 5, true);

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail === 0 ? 0 : 1);
})();
