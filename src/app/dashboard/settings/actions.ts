'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db, tables } from '@/db';
import { getMyShop } from '@/lib/auth';

export async function saveSettings(input: {
  businessName: string; bio: string; addressText: string; openingHours: string;
  logoUrl: string; bannerUrl: string; supportsPickup: boolean; supportsDelivery: boolean;
  lat?: number; lng?: number;
}) {
  const shop = await getMyShop();
  if (!shop) return { error: 'Not your shop.' };
  if (!input.businessName.trim()) return { error: 'Business name is required.' };
  if (!input.supportsDelivery && !input.supportsPickup) {
    return { error: 'Enable delivery or pickup — customers need at least one way to get their order.' };
  }

  await db().update(tables.shops).set({
    businessName: input.businessName.trim().slice(0, 120),
    bio: input.bio.trim().slice(0, 400) || null,
    addressText: input.addressText.trim().slice(0, 240) || null,
    openingHours: input.openingHours.trim().slice(0, 120) || null,
    logoUrl: input.logoUrl.trim() || null,
    bannerUrl: input.bannerUrl.trim() || null,
    supportsPickup: input.supportsPickup,
    supportsDelivery: input.supportsDelivery,
    ...(input.lat != null && input.lng != null ? { lat: input.lat, lng: input.lng } : {}),
  }).where(eq(tables.shops.id, shop.id));

  revalidatePath('/dashboard/settings');
  return { ok: true } as const;
}
