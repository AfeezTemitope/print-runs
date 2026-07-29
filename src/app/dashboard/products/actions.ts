'use server';

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { db, tables } from '@/db';
import { getMyShop } from '@/lib/auth';
import { getCategory } from '@/lib/categories';

export type ProductPayload = {
  id?: string;
  categorySlug: string;
  name: string;
  pricingMode: string;
  areaUnit: string | null;
  ratePerUnit: string;
  minCharge: string;
  turnaroundHours: string;
  photoUrl: string;
  tiers: { qty: string; price: string; label: string }[];
  matrix: { cover: string; size: string; sheets: string; price: string }[];
  addons: { kind: string; label: string; basis: string; price: string }[];
};

const toKobo = (naira: string) => Math.round(Number(naira || 0) * 100);
// V2: 'per_sheet' (Business Card Print-Only) removed entirely — decision 8.
const MODES = ['per_area', 'tier', 'fixed_size', 'matrix', 'quote'] as const;
const KINDS = ['lamination', 'gsm', 'corner', 'sides'] as const;
const BASES = ['per_sheet', 'per_piece', 'flat'] as const;

export async function saveProduct(p: ProductPayload) {
  const shop = await getMyShop();
  if (!shop) return { error: 'Not your shop.' };

  const cat = getCategory(p.categorySlug);
  if (!cat?.live) return { error: 'Unknown category.' };
  const mode = MODES.includes(p.pricingMode as (typeof MODES)[number]) ? p.pricingMode as (typeof MODES)[number] : 'quote';

  if (mode === 'per_area' && toKobo(p.ratePerUnit) <= 0) return { error: 'Set a rate for per-area pricing.' };

  const tiers = p.tiers
    .filter((t) => Number(t.qty) > 0 && toKobo(t.price) > 0)
    .map((t) => ({ qty: Number(t.qty), priceKobo: toKobo(t.price), label: t.label.trim() || null }));
  if (mode === 'tier' && !tiers.length) return { error: 'Add at least one quantity tier with a price.' };

  const sizes = p.tiers
    .filter((t) => t.label && toKobo(t.price) > 0)
    .map((t) => ({ qty: 1, priceKobo: toKobo(t.price), label: t.label }));
  if (mode === 'fixed_size' && !sizes.length) return { error: 'Price at least one size.' };

  const matrix = p.matrix
    .filter((r) => toKobo(r.price) > 0)
    .map((r) => ({
      qty: null,
      priceKobo: toKobo(r.price),
      label: `${r.cover} / ${r.size} / ${r.sheets}`,
      meta: { cover: r.cover, size: r.size, sheets: Number(r.sheets) },
    }));
  if (mode === 'matrix' && !matrix.length) return { error: 'Add at least one priced matrix row.' };

  const addons = p.addons
    .filter((a) => toKobo(a.price) > 0 && KINDS.includes(a.kind as (typeof KINDS)[number]) && BASES.includes(a.basis as (typeof BASES)[number]))
    .map((a) => ({
      kind: a.kind as (typeof KINDS)[number],
      label: a.label,
      basis: a.basis as (typeof BASES)[number],
      priceKobo: toKobo(a.price),
    }));

  const values = {
    shopId: shop.id,
    categorySlug: p.categorySlug,
    name: p.name.slice(0, 120),
    pricingMode: mode,
    areaUnit: mode === 'per_area' ? (p.areaUnit === 'sqin' ? 'sqin' as const : 'sqft' as const) : null,
    ratePerUnitKobo: mode === 'per_area' ? toKobo(p.ratePerUnit) : null,
    minChargeKobo: mode === 'per_area' && toKobo(p.minCharge) > 0 ? toKobo(p.minCharge) : null,
    turnaroundHours: Math.max(1, Number(p.turnaroundHours) || 24),
    photoUrl: p.photoUrl || null,
  };

  let productId = p.id ?? null;
  if (productId) {
    const res = await db().update(tables.products).set(values)
      .where(and(eq(tables.products.id, productId), eq(tables.products.shopId, shop.id)))
      .returning({ id: tables.products.id });
    if (!res.length) return { error: 'Product not found.' };
    // Replace variant + addon rows wholesale — simplest correct thing at this scale.
    await db().delete(tables.productVariants).where(eq(tables.productVariants.productId, productId));
    await db().delete(tables.productAddons).where(eq(tables.productAddons.productId, productId));
  } else {
    const [row] = await db().insert(tables.products).values(values).returning({ id: tables.products.id });
    productId = row.id;
  }

  const variantRows = mode === 'tier' ? tiers : mode === 'fixed_size' ? sizes : mode === 'matrix' ? matrix : [];
  if (variantRows.length) {
    await db().insert(tables.productVariants).values(variantRows.map((v) => ({ ...v, productId: productId! })));
  }
  if (addons.length && mode !== 'quote') {
    await db().insert(tables.productAddons).values(addons.map((a) => ({ ...a, productId: productId! })));
  }

  revalidatePath('/dashboard/products');
  return { ok: true } as const;
}

export async function toggleProduct(productId: string) {
  const shop = await getMyShop();
  if (!shop) return { error: 'Not your shop.' };
  const [row] = await db().select().from(tables.products)
    .where(and(eq(tables.products.id, productId), eq(tables.products.shopId, shop.id))).limit(1);
  if (!row) return { error: 'Not found.' };
  await db().update(tables.products).set({ isActive: !row.isActive }).where(eq(tables.products.id, productId));
  revalidatePath('/dashboard/products');
  return { ok: true } as const;
}
