'use server';

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { db, tables } from '@/db';
import { getMyShop } from '@/lib/auth';
import { getCategory } from '@/lib/categories';

/**
 * A printer applies for one category at a time and attaches a work permit. Online-only review
 * with the permit is sufficient (locked decision) — no site visit.
 *
 * Re-applying after a rejection is allowed and resets the row to pending, because a rejection
 * is usually a bad scan rather than a bad printer.
 */
export async function requestVerification(categorySlug: string, workPermitUrl: string) {
  const shop = await getMyShop();
  if (!shop) return { error: 'Not your shop.' };
  if (!getCategory(categorySlug)?.live) return { error: 'Unknown category.' };
  if (!/^https:\/\/res\.cloudinary\.com\//.test(workPermitUrl)) {
    return { error: 'Upload your work permit before applying.' };
  }

  const [existing] = await db().select().from(tables.shopCategoryVerifications)
    .where(and(
      eq(tables.shopCategoryVerifications.shopId, shop.id),
      eq(tables.shopCategoryVerifications.categorySlug, categorySlug),
    )).limit(1);

  if (existing?.status === 'verified') return { error: 'You are already verified for this category.' };

  if (existing) {
    await db().update(tables.shopCategoryVerifications)
      .set({ status: 'pending', workPermitUrl, reviewedAt: null })
      .where(eq(tables.shopCategoryVerifications.id, existing.id));
  } else {
    await db().insert(tables.shopCategoryVerifications)
      .values({ shopId: shop.id, categorySlug, status: 'pending', workPermitUrl });
  }

  revalidatePath('/dashboard/verification');
  revalidatePath('/admin/verification');
  return { ok: true } as const;
}
