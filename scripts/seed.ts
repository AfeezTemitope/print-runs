/* Seed demo data: npm run seed
   Creates 1 customer + 4 printers around Lagos with products across every
   pricing mode, matching the configurator's standard presets/options so the
   printer-selection screen shows real prices (and one Request Quote card). */

import { readFileSync, existsSync } from 'node:fs';
import bcrypt from 'bcryptjs';

// tsx doesn't autoload .env
if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

// Per-category commercial margin (decisions 16 + 23): ID Card is a flat 200 naira per piece
// and Business Card is the only percentage margin on the platform, at 7%.
const MARGINS: Record<string, { marginType: 'fixed' | 'percent'; marginFixedKobo: number; marginPercentBps: number }> = {
  id_card: { marginType: 'fixed', marginFixedKobo: 20000, marginPercentBps: 0 },
  business_card: { marginType: 'percent', marginFixedKobo: 0, marginPercentBps: 700 },
  banner: { marginType: 'fixed', marginFixedKobo: 5000, marginPercentBps: 0 },
  jotter: { marginType: 'fixed', marginFixedKobo: 5000, marginPercentBps: 0 },
  thank_you_card: { marginType: 'fixed', marginFixedKobo: 1500, marginPercentBps: 0 },
};

const AREA_RATE: Record<string, number> = { banner: 1800, sticker: 2400 };
const TURNAROUND: Record<string, number> = { jotter: 96, nylon: 48, id_card: 48, banner: 24 };

/** Rough naira-per-piece starting points, only ever used to make demo data look plausible. */
const PER_PIECE: Record<string, number> = {
  jotter: 900, flyer: 45, business_card: 70, sticker: 90,
  nylon: 260, thank_you_card: 55, id_card: 700,
};

async function main() {
  const { db, tables } = await import('../src/db');
  const { liveListings, gridCells } = await import('../src/lib/categories');
  const k = (naira: number) => naira * 100; // money in kobo

  type Grid = NonNullable<Awaited<ReturnType<typeof liveListings>>[number]['listing']['pricingGrid']>;

  /**
   * A plausible price for one grid cell. Flat-batch grids get the whole batch total; per-piece
   * grids get the rate for a single piece. Bigger sizes, heavier stock and double-sided cost
   * more; bigger batches get a per-piece discount, which is why printers offer tiers at all.
   */
  function seedCellKobo(categorySlug: string, grid: Grid, coords: Record<string, string | number>, shopIndex: number): number {
    let perPiece = (PER_PIECE[categorySlug] ?? 100) * (1 + shopIndex * 0.06);
    let batchQty = 1;

    for (const axis of grid.axes) {
      const raw = coords[axis.key];
      const idx = axis.values.findIndex((v) => String(v) === String(raw));
      if (axis.source === 'qty') {
        batchQty = Number(raw);
        perPiece *= 1 - Math.min(0.3, idx * 0.08);        // volume discount
      } else if (axis.source === 'qty_range') {
        perPiece *= 1 - Math.min(0.3, idx * 0.12);
      } else if (axis.key === 'sides') {
        if (String(raw) === 'Front and back') perPiece *= 1.55;
      } else if (axis.source === 'sheets') {
        perPiece *= 1 + (Number(raw) - Number(axis.values[0])) / 120;
      } else {
        perPiece *= 1 + idx * 0.28;                        // size / weight step-ups
      }
    }

    const naira = grid.priceType === 'flat_batch' ? perPiece * batchQty : perPiece;
    return Math.round(naira) * 100;
  }

  const hash = await bcrypt.hash('password123', 10);

  console.log('Seeding users…');
  const [customer] = await db().insert(tables.users).values({
    role: 'customer', firstName: 'Demo', surname: 'Customer',
    email: 'demo@printruns.ng', phone: '08030000000', passwordHash: hash,
  }).onConflictDoNothing().returning();

  const printers = [
    { email: 'printer1@printruns.ng', name: 'Yaba Press Works', code: 'LB-014', lat: 6.5095, lng: 3.3711, addr: '23 Herbert Macaulay Way', city: 'Yaba' },
    { email: 'printer2@printruns.ng', name: 'Lekki Prints Hub', code: 'LB-027', lat: 6.4478, lng: 3.4723, addr: '14 Admiralty Way', city: 'Lekki Phase 1' },
    { email: 'printer3@printruns.ng', name: 'Surulere Print Shop', code: 'LB-033', lat: 6.4926, lng: 3.3565, addr: '8 Bode Thomas St', city: 'Surulere' },
    { email: 'printer4@printruns.ng', name: 'Ikeja Giant Prints', code: 'LB-041', lat: 6.6018, lng: 3.3515, addr: '112 Awolowo Way', city: 'Ikeja' },
  ];

  for (const [i, p] of printers.entries()) {
    const [user] = await db().insert(tables.users).values({
      role: 'printer', firstName: p.name.split(' ')[0], surname: 'Prints',
      email: p.email, phone: `0803000000${i + 1}`, passwordHash: hash,
    }).onConflictDoNothing().returning();
    if (!user) { console.log(`  ${p.email} already exists — skipping`); continue; }

    const [shop] = await db().insert(tables.shops).values({
      userId: user.id, code: p.code, businessName: p.name,
      slug: p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      addressLine1: p.addr, addressCity: p.city, addressState: 'Lagos',
      lat: p.lat, lng: p.lng,
      bio: 'Quality prints, honest turnaround.',
    }).returning();

    console.log(`Seeding products for ${p.name}…`);

    // Products are generated FROM the category config rather than hand-listed, so the seed can
    // never drift out of sync with the grids the printer form and pricing engine agree on.
    for (const { category, listing } of liveListings()) {
      // Shop 4 leaves Thank You Card unpriced so the Request Quote path stays visible in demo
      // data, and nobody assumes every printer prices everything.
      const quoteOnly = i === 3 && category.slug === 'thank_you_card';

      const margin = MARGINS[category.slug] ?? { marginType: 'fixed' as const, marginFixedKobo: k(25), marginPercentBps: 0 };
      const mode = quoteOnly ? 'quote' : listing.perAreaRate ? 'per_area' : listing.pricingGrid ? 'matrix' : 'quote';

      const [prod] = await db().insert(tables.products).values({
        shopId: shop.id,
        categorySlug: category.slug,
        listingSlug: listing.slug,
        name: category.listings.length > 1 ? `${category.name} — ${listing.label}` : category.name,
        pricingMode: mode,
        areaUnit: mode === 'per_area' ? ('sqft' as const) : null,
        ratePerUnitKobo: mode === 'per_area' ? k(AREA_RATE[category.slug] ?? 1800) + k(i * 120) : null,
        offersHylet: mode === 'per_area' && category.slug === 'banner' ? i !== 2 : false,
        turnaroundHours: TURNAROUND[category.slug] ?? 24,
        ...margin,
      }).returning();

      if (mode === 'matrix' && listing.pricingGrid) {
        const grid = listing.pricingGrid;
        const rows = gridCells(grid).map((coords) => ({
          productId: prod.id,
          qty: null,
          priceKobo: seedCellKobo(category.slug, grid, coords, i),
          label: grid.axes.map((a) => String(coords[a.key])).join(' / '),
          meta: coords,
        }));
        // Shop 3 skips the priciest combination of each grid — a real gap, so the "falls back
        // to Request Quote" behaviour is exercised by the demo data rather than only by tests.
        const kept = i === 2 ? rows.slice(0, -1) : rows;
        if (kept.length) await db().insert(tables.productVariants).values(kept);
      }

      if (mode !== 'quote' && listing.fixedAddons?.length) {
        await db().insert(tables.productAddons).values(listing.fixedAddons.map((a) => ({
          productId: prod.id,
          kind: a.kind as 'lamination' | 'gsm' | 'corner' | 'sides',
          basis: a.basis,
          label: a.label,
          priceKobo: k(a.label === 'Front and back' ? 15 : 10),
        })));
      }
    }
  }

  console.log('\nDone. Logins (password for all: password123):');
  console.log('  Customer:  demo@printruns.ng');
  for (const p of printers) console.log(`  Printer:   ${p.email}  (${p.name})`);
  if (!customer) console.log('  (customer already existed)');
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
