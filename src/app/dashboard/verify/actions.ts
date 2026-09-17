'use server';

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { db, tables } from '@/db';
import { getMyShop } from '@/lib/auth';
import { latestVerification } from '@/lib/trust';

const CLOUDINARY = /^https:\/\/res\.cloudinary\.com\//;

/** §1.2: a printer upgrades to Tier 2 by submitting identity or business documents. */
export async function submitVerification(documentUrl: string, documentType: string, socialUrl: string) {
  const shop = await getMyShop();
  if (!shop) return { error: 'Not your shop.' };
  if (shop.verificationTier >= 2) return { error: 'You are already verified.' };
  if (!CLOUDINARY.test(documentUrl)) return { error: 'Upload your document rather than pasting a link.' };
  if (!documentType) return { error: 'Tell us which document this is.' };

  const existing = await latestVerification(shop.id);
  if (existing?.status === 'pending') return { error: 'Your documents are already under review.' };

  await db().insert(tables.verificationSubmissions).values({
    shopId: shop.id,
    documentUrl,
    documentType,
    socialUrl: socialUrl.trim() || null,
  });

  revalidatePath('/dashboard/verify');
  revalidatePath('/admin/verification');
  return { ok: true } as const;
}

/**
 * §3.4: a printer may flag a review for admin attention. This does NOT hide it — reviews are
 * public and permanent, and only an admin can remove one.
 */
export async function flagReview(reviewId: string, reason: string) {
  const shop = await getMyShop();
  if (!shop) return { error: 'Not your shop.' };
  if (reason.trim().length < 5) return { error: 'Tell us why you think this review is unfair.' };

  await db().update(tables.reviews)
    .set({ flaggedAt: new Date(), flagReason: reason.trim() })
    .where(and(eq(tables.reviews.id, reviewId), eq(tables.reviews.shopId, shop.id)));

  revalidatePath('/dashboard/reviews');
  revalidatePath('/admin/disputes');
  return { ok: true } as const;
}

/** §4.3: the printer gets 24 hours to put their side before an admin decides. */
export async function respondToDispute(disputeId: string, response: string) {
  const shop = await getMyShop();
  if (!shop) return { error: 'Not your shop.' };
  if (response.trim().length < 10) return { error: 'Give us enough detail to weigh against the complaint.' };

  const [dispute] = await db().select().from(tables.disputes)
    .where(and(eq(tables.disputes.id, disputeId), eq(tables.disputes.shopId, shop.id))).limit(1);
  if (!dispute) return { error: 'Not your dispute.' };
  if (dispute.decidedAt) return { error: 'This dispute has already been decided.' };

  await db().update(tables.disputes).set({
    printerResponse: response.trim(),
    printerRespondedAt: new Date(),
    state: 'printer_responded',
  }).where(eq(tables.disputes.id, disputeId));

  revalidatePath('/dashboard/queue');
  revalidatePath('/admin/disputes');
  return { ok: true } as const;
}
