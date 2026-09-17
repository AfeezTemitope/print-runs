'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db, tables } from '@/db';
import { getSession } from '@/lib/auth';
import { recomputeRating } from '@/app/orders/trust/actions';

async function assertAdmin() {
  const session = await getSession();
  return session && session.role === 'admin' ? session : null;
}

/**
 * §4.3: the admin decides. No automated resolution in V1.
 *
 * In the customer's favour, settlement stays withheld — a reprint or refund is arranged
 * outside this action, and releasing money to a printer who just lost a dispute would defeat
 * the freeze. In the printer's favour, settlement is released.
 */
export async function decideDispute(
  disputeId: string,
  decision: 'customer' | 'printer',
  outcome: 'reprint' | 'refund' | 'none',
  note: string,
) {
  if (!(await assertAdmin())) return { error: 'Not allowed.' };
  if (note.trim().length < 5) return { error: 'Record why — this is the audit trail.' };

  const [dispute] = await db().select().from(tables.disputes)
    .where(eq(tables.disputes.id, disputeId)).limit(1);
  if (!dispute) return { error: 'Dispute not found.' };
  if (dispute.decidedAt) return { error: 'Already decided.' };

  await db().update(tables.disputes).set({
    state: decision === 'customer' ? 'resolved_customer' : 'resolved_printer',
    outcome,
    decisionNote: note.trim(),
    decidedAt: new Date(),
  }).where(eq(tables.disputes.id, disputeId));

  await db().update(tables.orders).set({
    // The dispute flag is cleared either way — it is resolved. What differs is the money.
    disputedAt: null,
    settlementStatus: decision === 'printer' ? 'pending' : 'withheld',
    updatedAt: new Date(),
  }).where(eq(tables.orders.id, dispute.orderId));

  revalidatePath('/admin/disputes');
  revalidatePath('/orders');
  revalidatePath('/dashboard/queue');
  return { ok: true } as const;
}

/**
 * §3.4: only an admin removes a review, and only for abuse, personal information or
 * demonstrable fakery. Disagreeing with it is not a reason.
 */
export async function removeReview(reviewId: string, reason: string) {
  if (!(await assertAdmin())) return { error: 'Not allowed.' };
  if (reason.trim().length < 5) return { error: 'Record why this review was removed.' };

  const [review] = await db().select().from(tables.reviews)
    .where(eq(tables.reviews.id, reviewId)).limit(1);
  if (!review) return { error: 'Review not found.' };

  await db().update(tables.reviews)
    .set({ removedAt: new Date(), removedReason: reason.trim() })
    .where(eq(tables.reviews.id, reviewId));

  // Removing a review must correct the printer's average, not leave it skewed by a review
  // nobody can see any more.
  await recomputeRating(review.shopId);

  revalidatePath('/admin/disputes');
  revalidatePath('/dashboard/reviews');
  return { ok: true } as const;
}

/** §1.2: approve or reject a Tier 2 submission. A rejection must say what to fix. */
export async function reviewVerificationSubmission(
  submissionId: string,
  decision: 'verified' | 'rejected',
  note: string,
) {
  if (!(await assertAdmin())) return { error: 'Not allowed.' };
  if (decision === 'rejected' && note.trim().length < 5) {
    return { error: 'Say what needs fixing — a bare rejection just comes back unchanged.' };
  }

  const [submission] = await db().select().from(tables.verificationSubmissions)
    .where(eq(tables.verificationSubmissions.id, submissionId)).limit(1);
  if (!submission) return { error: 'Submission not found.' };

  await db().update(tables.verificationSubmissions).set({
    status: decision, reviewNote: note.trim() || null, reviewedAt: new Date(),
  }).where(eq(tables.verificationSubmissions.id, submissionId));

  if (decision === 'verified') {
    await db().update(tables.shops)
      .set({ verificationTier: 2 })
      .where(eq(tables.shops.id, submission.shopId));
  }

  revalidatePath('/admin/verification');
  revalidatePath('/dashboard/verify');
  revalidatePath('/marketplace');
  return { ok: true } as const;
}
