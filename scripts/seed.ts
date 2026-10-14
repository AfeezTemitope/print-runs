/* Seed demo data: npm run seed
   One customer and four Lagos printers with V2 storefronts — sub-categories, listings across
   all three pricing modes, and a mix of verification tiers so both badge states are visible. */

import { readFileSync, existsSync } from 'node:fs';
import bcrypt from 'bcryptjs';

// tsx doesn't autoload .env
if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const k = (naira: number) => naira * 100;

/**
 * What each printer sells. Deliberately varied rather than uniform: the point of V2 is that
 * printers price the same category differently, so the demo has to show that or the
 * comparison screens all look identical.
 */
const CATALOGUE: Record<string, {
  category: string;
  sub: string;
  name: string;
  description: string;
  mode: 'tier' | 'piece' | 'area';
  tiers?: [number, number][];
  rate?: number;
  areaUnit?: 'sqft' | 'sqin';
  minCharge?: number;
  min?: number;
  turnaround: number;
}[]> = {
  'LB-014': [
    {
      category: 'stickers-labels', sub: 'Brand Sticker', name: '3×3 Brand Circle Sticker',
      description: 'Waterproof vinyl, clean die-cut finish. Good for product branding.',
      mode: 'tier', tiers: [[100, 8000], [200, 14000], [500, 30000]], min: 50, turnaround: 24,
    },
    {
      category: 'cards-stationery', sub: 'Business Cards', name: 'Matte Business Cards, 600gsm',
      description: 'Thick 600gsm stock with a soft matte finish.',
      mode: 'tier', tiers: [[100, 12000], [500, 45000], [1000, 80000]], min: 100, turnaround: 48,
    },
  ],
  'LB-027': [
    {
      category: 'banners-signage', sub: 'Custom Banner/Backdrop', name: 'Flex Banner — any size',
      description: 'Outdoor-grade flex, eyelets included. Priced by the square foot.',
      mode: 'area', rate: 1800, areaUnit: 'sqft', minCharge: 5000, turnaround: 24,
    },
    {
      category: 'banners-signage', sub: 'Roll-up/Pull-up Banner', name: 'Roll-up Banner with stand',
      description: 'Standard 800×2000mm pull-up, stand and carry bag included.',
      mode: 'piece', rate: 28000, turnaround: 48,
    },
    {
      category: 'stickers-labels', sub: 'Large Format/Custom Sticker', name: 'Large Format Vinyl Sticker',
      description: 'Any size, cut to shape. Priced per square foot.',
      mode: 'area', rate: 2400, areaUnit: 'sqft', minCharge: 4000, turnaround: 24,
    },
  ],
  'LB-033': [
    {
      category: 'flyers-handbills', sub: 'Standard Flyer', name: 'A5 Flyers, full colour',
      description: 'Double-sided A5 on 130gsm gloss.',
      mode: 'tier', tiers: [[500, 22500], [1000, 40000]], min: 500, turnaround: 48,
    },
    {
      category: 'books-booklets', sub: 'Jotters/Notebooks', name: 'A5 Soft Cover Jotter, 100 sheets',
      description: 'Perfect-bound A5 jotter, branded cover.',
      mode: 'tier', tiers: [[50, 54000], [100, 100000]], min: 50, turnaround: 96,
    },
  ],
  'LB-041': [
    {
      category: 'id-access', sub: 'ID Cards', name: 'PVC ID Card, double sided',
      description: 'Standard CR80 PVC card, printed both sides.',
      mode: 'piece', rate: 700, min: 10, turnaround: 48,
    },
    {
      category: 'packaging', sub: 'Branded Nylon/Polybags', name: 'Branded Nylon Bag, A4',
      description: 'Single-colour print on white nylon.',
      mode: 'tier', tiers: [[50, 13000], [100, 24000], [200, 44000]], min: 50, turnaround: 48,
    },
  ],
};

async function main() {
  const { db, tables } = await import('../src/db');
  const hash = await bcrypt.hash('password123', 10);

  console.log('Seeding users…');
  await db().insert(tables.users).values({
    role: 'customer', firstName: 'Demo', surname: 'Customer',
    email: 'demo@printruns.ng', phone: '08030000000', passwordHash: hash,
  }).onConflictDoNothing();

  const printers = [
    { email: 'printer1@printruns.ng', name: 'Yaba Press Works', code: 'LB-014', slug: 'yabapress', lat: 6.5095, lng: 3.3711, addr: '23 Herbert Macaulay Way', city: 'Yaba', tier: 2 },
    { email: 'printer2@printruns.ng', name: 'Lekki Prints Hub', code: 'LB-027', slug: 'lekkiprints', lat: 6.4478, lng: 3.4723, addr: '14 Admiralty Way', city: 'Lekki Phase 1', tier: 2 },
    { email: 'printer3@printruns.ng', name: 'Surulere Print Shop', code: 'LB-033', slug: 'surulereprint', lat: 6.4926, lng: 3.3565, addr: '8 Bode Thomas St', city: 'Surulere', tier: 1 },
    { email: 'printer4@printruns.ng', name: 'Ikeja Giant Prints', code: 'LB-041', slug: 'ikejagiant', lat: 6.6018, lng: 3.3515, addr: '112 Awolowo Way', city: 'Ikeja', tier: 1 },
  ];

  for (const [i, p] of printers.entries()) {
    const [user] = await db().insert(tables.users).values({
      role: 'printer', firstName: p.name.split(' ')[0], surname: 'Prints',
      email: p.email, phone: `0803000000${i + 1}`, passwordHash: hash,
    }).onConflictDoNothing().returning();
    if (!user) { console.log(`  ${p.email} already exists — skipping`); continue; }

    const [shop] = await db().insert(tables.shops).values({
      userId: user.id, code: p.code, businessName: p.name, slug: p.slug,
      addressLine1: p.addr, addressCity: p.city, addressState: 'Lagos',
      lat: p.lat, lng: p.lng,
      whatsapp: `0803 000 000${i + 1}`,
      instagram: `@${p.slug}`,
      bio: 'Quality prints, honest turnaround.',
      // Two verified, two on Tier 1 — so both badge states show in search, which is the
      // founder decision that Tier 1 stays visible without a badge.
      verificationTier: p.tier,
    }).returning();

    console.log(`Seeding storefront for ${p.name}…`);

    const items = CATALOGUE[p.code] ?? [];
    const subIds = new Map<string, string>();

    for (const item of items) {
      const subKey = `${item.category}:${item.sub}`;
      if (!subIds.has(subKey)) {
        const [sub] = await db().insert(tables.subcategories).values({
          shopId: shop.id, categorySlug: item.category, name: item.sub, isCustom: false,
          sortOrder: subIds.size,
        }).returning();
        subIds.set(subKey, sub.id);
      }

      const [listing] = await db().insert(tables.listings).values({
        shopId: shop.id,
        subcategoryId: subIds.get(subKey)!,
        categorySlug: item.category,
        name: item.name,
        description: item.description,
        photos: [],
        pricingMode: item.mode,
        ratePerPieceKobo: item.mode === 'piece' ? k(item.rate!) : null,
        ratePerAreaKobo: item.mode === 'area' ? k(item.rate!) : null,
        areaUnit: item.mode === 'area' ? (item.areaUnit ?? 'sqft') : null,
        minChargeKobo: item.minCharge ? k(item.minCharge) : null,
        minimumOrder: item.min ?? null,
        turnaroundHours: item.turnaround,
      }).returning();

      if (item.mode === 'tier' && item.tiers) {
        await db().insert(tables.listingTiers).values(
          item.tiers.map(([quantity, naira]) => ({
            listingId: listing.id, quantity, priceKobo: k(naira),
          })),
        );
      }
    }
  }

  console.log('\nDone. Logins use password123:');
  console.log('  demo@printruns.ng              customer');
  console.log('  printer1..4@printruns.ng       printers');
  console.log('\nStorefronts: /yabapress /lekkiprints /surulereprint /ikejagiant\n');
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
