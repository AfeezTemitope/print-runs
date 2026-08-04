'use server';

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { db, tables } from '@/db';
import { getMyShop } from '@/lib/auth';
import { getCategory, getListing, cellKey, gridCells } from '@/lib/categories';

export type ProductPayload = {
  id?: string;
  categorySlug: string;
  listingSlug: string;
  pricingMode: string;
  ratePerUnit: string;
  offersHylet: boolean;
  turnaroundHours: string;
  photoUrl: string;
  cells: { coords: Record<string, string | number>; price: string }[];
  addons: { kind: string; label: string; basis: string; price: string }[];
};

const toKobo = (naira: string) => Math.round(Number(naira || 0) * 100);
// 'tier' and 'fixed_size' are legacy V1 shapes and can no longer be saved. 'matrix' is the
// generic pricing grid — kept as the enum value so no enum migration is needed (QA 1.5).
const MODES = ['per_area', 'matrix', 'quote'] as const;
const KINDS = ['lamination', 'gsm', 'corner', 'sides'] as const;
const BASES = ['per_sheet', 'per_piece', 'flat'] as const;

export async function saveProduct(p: ProductPayload) {
  const shop = await getMyShop();
  if (!shop) return { error: 'Not your shop.' };

  const cat = getCategory(p.categorySlug);
  if (!cat?.live) return { error: 'Unknown category.' };
  const listing = getListing(cat, p.listingSlug);
  if (!listing) return { error: 'Pick a product type.' };

  const mode = MODES.includes(p.pricingMode as (typeof MODES)[number])
    ? (p.pricingMode as (typeof MODES)[number])
    : 'quote';

  if (mode === 'per_area') {
    if (!listing.perAreaRate) return { error: 'This product is not priced by area.' };
    if (toKobo(p.ratePerUnit) <= 0) return { error: 'Set a rate per sq.ft.' };
  }

  // Grid rows are validated against the platform's own grid definition, so a tampered payload
  // can never invent a cell the customer side would not ask for.
  const grid = listing.pricingGrid;
  let cellRows: { qty: null; priceKobo: number; label: string; meta: Record<string, string | number> }[] = [];
  if (mode === 'matrix') {
    if (!grid) return { error: 'This product has no price grid.' };
    const allowed = new Set(gridCells(grid).map((c) => cellKey(grid, c)));
    cellRows = p.cells
      .filter((c) => toKobo(c.price) > 0 && allowed.has(cellKey(grid, c.coords)))
      .map((c) => ({
        qty: null,
        priceKobo: toKobo(c.price),
        label: grid.axes.map((a) => String(c.coords[a.key])).join(' / '),
        meta: Object.fromEntries(grid.axes.map((a) => [a.key, c.coords[a.key]])) as Record<string, string | number>,
      }));
    if (!cellRows.length) return { error: 'Price at least one combination, or switch to Request quote.' };
  }

  // Only the add-ons this listing actually defines can be saved (QA 3.4: Business Card,
  // Sticker and Brand Nylon have none at all, so nothing can be attached to them).
  const allowedAddons = new Set((listing.fixedAddons ?? []).map((a) => `${a.kind}::${a.label}`));
  const addons = p.addons
    .filter((a) =>
      toKobo(a.price) > 0
      && allowedAddons.has(`${a.kind}::${a.label}`)
      && KINDS.includes(a.kind as (typeof KINDS)[number])
      && BASES.includes(a.basis as (typeof BASES)[number]))
    .map((a) => ({
      kind: a.kind as (typeof KINDS)[number],
      label: a.label,
      basis: a.basis as (typeof BASES)[number],
      priceKobo: toKobo(a.price),
    }));

  // QA 1.3: the printer no longer types a name — it is derived, so listings stay consistent
  // across every shop and admin can tell PR-004-A from PR-004-B at a glance.
  const name = cat.listings.length > 1 ? `${cat.name} — ${listing.label}` : cat.name;

  const values = {
    shopId: shop.id,
    categorySlug: cat.slug,
    listingSlug: listing.slug,
    name,
    pricingMode: mode,
    // QA 3.1: sq.ft is the only unit on the platform now.
    areaUnit: mode === 'per_area' ? ('sqft' as const) : null,
    ratePerUnitKobo: mode === 'per_area' ? toKobo(p.ratePerUnit) : null,
    // QA 3.1: the minimum-charge field is gone; never write it again.
    minChargeKobo: null,
    offersHylet: mode === 'per_area' ? Boolean(p.offersHylet) : false,
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

  if (cellRows.length) {
    await db().insert(tables.productVariants).values(cellRows.map((v) => ({ ...v, productId: productId! })));
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
