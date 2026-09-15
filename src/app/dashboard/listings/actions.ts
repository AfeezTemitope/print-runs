'use server';

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { db, tables } from '@/db';
import { getMyShop } from '@/lib/auth';
import { isLive, MAX_CUSTOM_SUBCATEGORIES, MAX_TIERS, type PricingMode } from '@/lib/catalog';
import { validateTiers } from '@/lib/listing-pricing';
import { subcategoriesFor } from '@/lib/storefront';

const toKobo = (naira: string) => Math.round(Number(naira || 0) * 100);
const CLOUDINARY = /^https:\/\/res\.cloudinary\.com\//;

function touched() {
  revalidatePath('/dashboard/listings');
  revalidatePath('/dashboard/storefront');
}

/* ------------------------------------------------------------------ */
/* Sub-categories                                                      */
/* ------------------------------------------------------------------ */

/**
 * Add a sub-category — either one of the platform's suggestions or the printer's own. Custom
 * names are capped (Section 2.2) and flagged so admin can spot names worth promoting to
 * platform-wide suggestions when several printers invent the same one.
 */
export async function addSubcategory(categorySlug: string, name: string, isCustom: boolean) {
  const shop = await getMyShop();
  if (!shop) return { error: 'Not your shop.' };
  if (!isLive(categorySlug)) return { error: 'That category is not available yet.' };

  const clean = name.trim().replace(/\s+/g, ' ');
  if (clean.length < 2) return { error: 'Give the sub-category a name.' };
  if (clean.length > 60) return { error: 'That name is too long.' };

  const existing = await subcategoriesFor(shop.id);
  if (existing.some((s) => s.categorySlug === categorySlug && s.name.toLowerCase() === clean.toLowerCase())) {
    return { error: 'You already have that sub-category.' };
  }
  if (isCustom && existing.filter((s) => s.isCustom).length >= MAX_CUSTOM_SUBCATEGORIES) {
    return { error: `You can create up to ${MAX_CUSTOM_SUBCATEGORIES} custom sub-categories.` };
  }

  await db().insert(tables.subcategories).values({
    shopId: shop.id,
    categorySlug,
    name: clean,
    isCustom,
    sortOrder: existing.length,
  });

  touched();
  return { ok: true } as const;
}

export async function renameSubcategory(id: string, name: string) {
  const shop = await getMyShop();
  if (!shop) return { error: 'Not your shop.' };
  const clean = name.trim().replace(/\s+/g, ' ');
  if (clean.length < 2) return { error: 'Give the sub-category a name.' };

  await db().update(tables.subcategories).set({ name: clean })
    .where(and(eq(tables.subcategories.id, id), eq(tables.subcategories.shopId, shop.id)));
  touched();
  return { ok: true } as const;
}

/**
 * Deleting a sub-category does NOT delete the listings under it — they keep their category and
 * simply become unfiled. Losing a priced listing because a tab was tidied away would be a
 * genuinely destructive surprise.
 */
export async function deleteSubcategory(id: string) {
  const shop = await getMyShop();
  if (!shop) return { error: 'Not your shop.' };
  await db().delete(tables.subcategories)
    .where(and(eq(tables.subcategories.id, id), eq(tables.subcategories.shopId, shop.id)));
  touched();
  return { ok: true } as const;
}

/* ------------------------------------------------------------------ */
/* Listings                                                            */
/* ------------------------------------------------------------------ */

export type ListingInput = {
  id?: string;
  categorySlug: string;
  subcategoryId: string;
  name: string;
  description: string;
  photos: string[];
  pricingMode: PricingMode;
  tiers: { quantity: string; price: string }[];
  ratePerPiece: string;
  ratePerArea: string;
  areaUnit: 'sqft' | 'sqin';
  minCharge: string;
  minimumOrder: string;
  turnaround: string;
  isActive: boolean;
};

export async function saveListing(input: ListingInput) {
  const shop = await getMyShop();
  if (!shop) return { error: 'Not your shop.' };
  if (!isLive(input.categorySlug)) return { error: 'That category is not available yet.' };

  const name = input.name.trim();
  if (name.length < 3) return { error: 'Name this product.' };
  // Section 4.1: up to 3 photos per listing.
  const photos = input.photos.filter((p) => CLOUDINARY.test(p)).slice(0, 3);

  // The sub-category must belong to this shop — otherwise a posted id could file a listing
  // under someone else's tab.
  let subcategoryId: string | null = null;
  if (input.subcategoryId) {
    const [sub] = await db().select().from(tables.subcategories)
      .where(and(
        eq(tables.subcategories.id, input.subcategoryId),
        eq(tables.subcategories.shopId, shop.id),
      )).limit(1);
    if (!sub) return { error: 'Pick a sub-category.' };
    if (sub.categorySlug !== input.categorySlug) return { error: 'That sub-category is in a different category.' };
    subcategoryId = sub.id;
  }

  const tierRows = input.tiers
    .map((t) => ({ quantity: Number(t.quantity) || 0, priceKobo: toKobo(t.price) }))
    .filter((t) => t.quantity > 0 && t.priceKobo > 0)
    .slice(0, MAX_TIERS);

  if (input.pricingMode === 'tier') {
    const problem = validateTiers(tierRows);
    if (problem) return { error: problem };
  }
  if (input.pricingMode === 'piece' && toKobo(input.ratePerPiece) <= 0) {
    return { error: 'Set your rate per piece.' };
  }
  if (input.pricingMode === 'area' && toKobo(input.ratePerArea) <= 0) {
    return { error: 'Set your rate per sq.ft or sq.in.' };
  }

  const values = {
    shopId: shop.id,
    subcategoryId,
    categorySlug: input.categorySlug,
    name,
    description: input.description.trim() || null,
    photos,
    pricingMode: input.pricingMode,
    ratePerPieceKobo: input.pricingMode === 'piece' ? toKobo(input.ratePerPiece) : null,
    ratePerAreaKobo: input.pricingMode === 'area' ? toKobo(input.ratePerArea) : null,
    areaUnit: input.pricingMode === 'area' ? input.areaUnit : null,
    // Only meaningful on area pricing — the floor exists to protect against a tiny custom size.
    minChargeKobo: input.pricingMode === 'area' && toKobo(input.minCharge) > 0 ? toKobo(input.minCharge) : null,
    minimumOrder: Number(input.minimumOrder) > 0 ? Number(input.minimumOrder) : null,
    turnaroundHours: Math.max(1, Number(input.turnaround) || 24),
    isActive: input.isActive,
    updatedAt: new Date(),
  };

  let listingId = input.id ?? null;
  if (listingId) {
    const res = await db().update(tables.listings).set(values)
      .where(and(eq(tables.listings.id, listingId), eq(tables.listings.shopId, shop.id)))
      .returning({ id: tables.listings.id });
    if (!res.length) return { error: 'Listing not found.' };
    await db().delete(tables.listingTiers).where(eq(tables.listingTiers.listingId, listingId));
  } else {
    const [row] = await db().insert(tables.listings).values(values).returning({ id: tables.listings.id });
    listingId = row.id;
  }

  if (input.pricingMode === 'tier' && tierRows.length) {
    await db().insert(tables.listingTiers)
      .values(tierRows.map((t) => ({ ...t, listingId: listingId! })));
  }

  touched();
  return { ok: true } as const;
}

export async function toggleListing(id: string, isActive: boolean) {
  const shop = await getMyShop();
  if (!shop) return { error: 'Not your shop.' };
  await db().update(tables.listings).set({ isActive, updatedAt: new Date() })
    .where(and(eq(tables.listings.id, id), eq(tables.listings.shopId, shop.id)));
  touched();
  return { ok: true } as const;
}

export async function deleteListing(id: string) {
  const shop = await getMyShop();
  if (!shop) return { error: 'Not your shop.' };
  await db().delete(tables.listings)
    .where(and(eq(tables.listings.id, id), eq(tables.listings.shopId, shop.id)));
  touched();
  return { ok: true } as const;
}
