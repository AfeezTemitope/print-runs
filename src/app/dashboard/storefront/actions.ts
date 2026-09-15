'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db, tables } from '@/db';
import { getMyShop } from '@/lib/auth';
import { allocateSlug } from '@/lib/storefront';

const CLOUDINARY = /^https:\/\/res\.cloudinary\.com\//;

/**
 * Storefront identity. Everything here stays editable after launch and goes live immediately —
 * no re-approval (Module 1, Section 3).
 *
 * The public slug is allocated once and never changes with the business name: a printer shares
 * printruns.ng/cubicprints on Instagram, and that link must keep working after a rename.
 */
export async function saveStorefront(input: {
  businessName: string;
  bio: string;
  logoUrl: string;
  bannerUrl: string;
  addressLine1: string;
  addressCity: string;
  addressState: string;
  whatsapp: string;
}) {
  const shop = await getMyShop();
  if (!shop) return { error: 'Not your shop.' };

  const businessName = input.businessName.trim();
  if (businessName.length < 2) return { error: 'Your business needs a name.' };
  if (!input.addressCity.trim()) return { error: 'Add your area so customers nearby can find you.' };

  const digits = input.whatsapp.replace(/\D/g, '');
  if (input.whatsapp.trim() && digits.length < 10) return { error: 'That WhatsApp number looks incomplete.' };

  // Only allocate on first save, when the shop has no usable slug yet.
  const slug = shop.slug && shop.slug.length > 1 ? shop.slug : await allocateSlug(businessName);

  await db().update(tables.shops).set({
    businessName,
    slug,
    bio: input.bio.trim() || null,
    logoUrl: CLOUDINARY.test(input.logoUrl) ? input.logoUrl : shop.logoUrl,
    bannerUrl: CLOUDINARY.test(input.bannerUrl) ? input.bannerUrl : shop.bannerUrl,
    addressLine1: input.addressLine1.trim() || null,
    addressCity: input.addressCity.trim(),
    addressState: input.addressState.trim() || null,
    whatsapp: input.whatsapp.trim() || null,
  }).where(eq(tables.shops.id, shop.id));

  revalidatePath('/dashboard/storefront');
  revalidatePath(`/${slug}`);
  return { ok: true, slug } as const;
}

/** Clearing a photo needs its own path — saveStorefront keeps the existing one when blank. */
export async function clearStorefrontPhoto(which: 'logo' | 'banner') {
  const shop = await getMyShop();
  if (!shop) return { error: 'Not your shop.' };
  await db().update(tables.shops)
    .set(which === 'logo' ? { logoUrl: null } : { bannerUrl: null })
    .where(eq(tables.shops.id, shop.id));
  revalidatePath('/dashboard/storefront');
  return { ok: true } as const;
}
