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

async function main() {
  const { db, tables } = await import('../src/db');
  const k = (naira: number) => naira * 100; // money in kobo

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

    // Banner — per sq.ft (all four shops, slightly different rates)
    await db().insert(tables.products).values({
      shopId: shop.id, categorySlug: 'banner', name: 'Vinyl Flex Banner',
      pricingMode: 'per_area', areaUnit: 'sqft',
      ratePerUnitKobo: k(1600 + i * 150), minChargeKobo: k(3500), turnaroundHours: 24,
    });

    // Sticker — per sq.in
    await db().insert(tables.products).values({
      shopId: shop.id, categorySlug: 'sticker', name: 'Custom Cut Stickers',
      pricingMode: 'per_area', areaUnit: 'sqin',
      ratePerUnitKobo: k(40 + i * 5), minChargeKobo: k(150), turnaroundHours: 24,
    });

    // Flyer — qty tiers matching the configurator presets, + addons
    const [flyer] = await db().insert(tables.products).values({
      shopId: shop.id, categorySlug: 'flyer', name: 'A5 Flyers',
      pricingMode: 'tier', turnaroundHours: 24,
    }).returning();
    await db().insert(tables.productVariants).values([
      { productId: flyer.id, qty: 50, priceKobo: k(9000 + i * 500), label: 'A5, 130gsm' },
      { productId: flyer.id, qty: 100, priceKobo: k(15000 + i * 800), label: 'A5, 130gsm' },
      { productId: flyer.id, qty: 250, priceKobo: k(32000 + i * 1500), label: 'A5, 130gsm' },
      { productId: flyer.id, qty: 500, priceKobo: k(55000 + i * 2500), label: 'A5, 130gsm' },
      { productId: flyer.id, qty: 1000, priceKobo: k(95000 + i * 4000), label: 'A5, 130gsm' },
    ]);
    await db().insert(tables.productAddons).values([
      { productId: flyer.id, kind: 'sides', label: 'Front and back', basis: 'per_piece', priceKobo: k(30) },
      { productId: flyer.id, kind: 'lamination', label: 'Matte', basis: 'per_piece', priceKobo: k(20) },
      { productId: flyer.id, kind: 'lamination', label: 'Gloss', basis: 'per_piece', priceKobo: k(20) },
    ]);

    // Business cards:
    if (i === 2) {
      // Surulere: quote-only for business cards — demos the dashed Request Quote card
      await db().insert(tables.products).values({
        shopId: shop.id, categorySlug: 'business_card', name: 'Business Cards (custom jobs)',
        pricingMode: 'quote', turnaroundHours: 48,
      });
    } else {
      // Print + Cut tiers
      // Decision 23: Business Card carries a 7% percentage margin (700 bps), unlike every
      // other category, which uses a fixed naira amount.
      const [bc] = await db().insert(tables.products).values({
        shopId: shop.id, categorySlug: 'business_card', name: 'Business Cards',
        pricingMode: 'tier', turnaroundHours: 24,
        marginType: 'percent', marginPercentBps: 700,
      }).returning();
      await db().insert(tables.productVariants).values([
        { productId: bc.id, qty: 100, priceKobo: k(15000 + i * 1000), label: '350gsm matte' },
        { productId: bc.id, qty: 250, priceKobo: k(30000 + i * 1500), label: '350gsm matte' },
        { productId: bc.id, qty: 500, priceKobo: k(52000 + i * 2000), label: '350gsm matte' },
        { productId: bc.id, qty: 1000, priceKobo: k(90000 + i * 3000), label: '350gsm matte' },
      ]);
      await db().insert(tables.productAddons).values([
        { productId: bc.id, kind: 'gsm', label: '300gsm', basis: 'per_piece', priceKobo: k(5) },
        { productId: bc.id, kind: 'gsm', label: '350gsm', basis: 'per_piece', priceKobo: k(10) },
        { productId: bc.id, kind: 'corner', label: 'Rounded', basis: 'per_piece', priceKobo: k(8) },
        { productId: bc.id, kind: 'lamination', label: 'Matte', basis: 'per_piece', priceKobo: k(12) },
        { productId: bc.id, kind: 'lamination', label: 'Gloss', basis: 'per_piece', priceKobo: k(12) },
        { productId: bc.id, kind: 'sides', label: 'Front and back', basis: 'per_piece', priceKobo: k(10) },
      ]);

    }

    // Two shops get frames (fixed sizes)
    if (i % 2 === 0) {
      const [frame] = await db().insert(tables.products).values({
        // Frame is locked/hidden in V2 (founder decisions) — seeded inactive so the data
        // shape is still exercised without the product reaching a customer.
        shopId: shop.id, categorySlug: 'frame', name: 'Framed Prints', isActive: false,
        pricingMode: 'fixed_size', turnaroundHours: 48,
      }).returning();
      await db().insert(tables.productVariants).values([
        { productId: frame.id, qty: 1, priceKobo: k(9500 + i * 500), label: 'A4' },
        { productId: frame.id, qty: 1, priceKobo: k(14500 + i * 500), label: 'A3' },
        { productId: frame.id, qty: 1, priceKobo: k(22000 + i * 500), label: 'A2' },
      ]);
    }

    // Two shops get jotters (matrix)
    if (i === 1 || i === 3) {
      const [jotter] = await db().insert(tables.products).values({
        shopId: shop.id, categorySlug: 'jotter', name: 'Custom Jotters',
        pricingMode: 'matrix', turnaroundHours: 96,
      }).returning();
      const rows: { cover: string; size: string; sheets: number; price: number }[] = [];
      for (const cover of ['Soft cover', 'Hard cover']) {
        for (const size of ['A6', 'A5']) {
          for (const sheets of [50, 75, 100]) {
            const base = cover === 'Hard cover' ? 900 : 550;
            const sizeAdd = size === 'A5' ? 200 : 0;
            rows.push({ cover, size, sheets, price: base + sizeAdd + sheets * 5 + i * 50 });
          }
        }
      }
      await db().insert(tables.productVariants).values(rows.map((r) => ({
        productId: jotter.id, qty: null, priceKobo: k(r.price),
        label: `${r.cover} / ${r.size} / ${r.sheets}`,
        meta: { cover: r.cover, size: r.size, sheets: r.sheets },
      })));
    }

    // Thank You Card — new in V2. Fixed naira margin like most categories.
    const [tyc] = await db().insert(tables.products).values({
      shopId: shop.id, categorySlug: 'thank_you_card', name: 'Thank You Cards',
      pricingMode: 'tier', turnaroundHours: 24,
      marginType: 'fixed', marginFixedKobo: k(15),
    }).returning();
    await db().insert(tables.productVariants).values([
      { productId: tyc.id, qty: 50, priceKobo: k(7000 + i * 400), label: '300gsm' },
      { productId: tyc.id, qty: 100, priceKobo: k(12000 + i * 700), label: '300gsm' },
      { productId: tyc.id, qty: 250, priceKobo: k(26000 + i * 1200), label: '300gsm' },
      { productId: tyc.id, qty: 500, priceKobo: k(46000 + i * 2000), label: '300gsm' },
      { productId: tyc.id, qty: 1000, priceKobo: k(82000 + i * 3500), label: '300gsm' },
    ]);
    await db().insert(tables.productAddons).values([
      { productId: tyc.id, kind: 'lamination', label: 'Matte', basis: 'per_piece', priceKobo: k(10) },
      { productId: tyc.id, kind: 'lamination', label: 'Gloss', basis: 'per_piece', priceKobo: k(10) },
      { productId: tyc.id, kind: 'sides', label: 'Front and back', basis: 'per_piece', priceKobo: k(15) },
    ]);

    // ID Card — new in V2. Decision 16: 200 naira FIXED margin per piece, the big outlier
    // against every other category's 10-50 naira. Confirmed intentional, not a typo for 25.
    const [idc] = await db().insert(tables.products).values({
      shopId: shop.id, categorySlug: 'id_card', name: 'ID Cards',
      pricingMode: 'tier', turnaroundHours: 48,
      marginType: 'fixed', marginFixedKobo: k(200),
    }).returning();
    await db().insert(tables.productVariants).values([
      { productId: idc.id, qty: 10, priceKobo: k(6000 + i * 300), label: 'PVC' },
      { productId: idc.id, qty: 25, priceKobo: k(13000 + i * 600), label: 'PVC' },
      { productId: idc.id, qty: 50, priceKobo: k(24000 + i * 1000), label: 'PVC' },
      { productId: idc.id, qty: 100, priceKobo: k(45000 + i * 1800), label: 'PVC' },
      { productId: idc.id, qty: 250, priceKobo: k(105000 + i * 4000), label: 'PVC' },
    ]);

    // One shop gets nylon tiers
    if (i === 3) {
      const [nylon] = await db().insert(tables.products).values({
        shopId: shop.id, categorySlug: 'nylon', name: 'Branded Nylon Bags',
        pricingMode: 'tier', turnaroundHours: 48,
      }).returning();
      await db().insert(tables.productVariants).values([
        { productId: nylon.id, qty: 50, priceKobo: k(18000), label: 'Medium' },
        { productId: nylon.id, qty: 100, priceKobo: k(32000), label: 'Medium' },
        { productId: nylon.id, qty: 250, priceKobo: k(70000), label: 'Medium' },
        { productId: nylon.id, qty: 500, priceKobo: k(125000), label: 'Medium' },
      ]);
      await db().insert(tables.productAddons).values([
        { productId: nylon.id, kind: 'sides', label: 'Front and back', basis: 'per_piece', priceKobo: k(40) },
      ]);
    }
  }

  console.log('\nDone. Logins (password for all: password123):');
  console.log('  Customer:  demo@printruns.ng');
  for (const p of printers) console.log(`  Printer:   ${p.email}  (${p.name})`);
  if (!customer) console.log('  (customer already existed)');
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
