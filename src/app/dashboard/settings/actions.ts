'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db, tables } from '@/db';
import { getMyShop } from '@/lib/auth';

export async function saveSettings(input: {
  businessName: string; bio: string; openingHours: string;
  addressLine1: string; addressLine2: string; addressCity: string; addressState: string;
  logoUrl: string; bannerUrl: string;
  lat?: number; lng?: number;
}) {
  const shop = await getMyShop();
  if (!shop) return { error: 'Not your shop.' };
  if (!input.businessName.trim()) return { error: 'Business name is required.' };
  // V2: no delivery/pickup capability flags — every order is delivered, and Collection is
  // arranged per-order by PrintRuns rather than advertised by a shop (28 Jul decision).
  if (!input.addressLine1.trim() || !input.addressCity.trim() || !input.addressState.trim()) {
    return { error: 'Address line 1, city and state are required.' };
  }

  await db().update(tables.shops).set({
    businessName: input.businessName.trim().slice(0, 120),
    bio: input.bio.trim().slice(0, 400) || null,
    addressLine1: input.addressLine1.trim().slice(0, 160),
    addressLine2: input.addressLine2.trim().slice(0, 160) || null,
    addressCity: input.addressCity.trim().slice(0, 80),
    addressState: input.addressState.trim().slice(0, 80),
    openingHours: input.openingHours.trim().slice(0, 120) || null,
    logoUrl: input.logoUrl.trim() || null,
    bannerUrl: input.bannerUrl.trim() || null,
    ...(input.lat != null && input.lng != null ? { lat: input.lat, lng: input.lng } : {}),
  }).where(eq(tables.shops.id, shop.id));

  revalidatePath('/dashboard/settings');
  return { ok: true } as const;
}
