import { and, desc, eq, gte, isNotNull } from 'drizzle-orm';
import { db, tables } from '@/db';

/**
 * Trust layer (Module 4): verification, reviews, disputes and the consequences of losing them.
 */

/** §4.1: a customer has 48 hours after delivery to raise a dispute. */
export const DISPUTE_WINDOW_HOURS = 48;
/** §3.1: the review window stays open for 7 days after delivery. */
export const REVIEW_WINDOW_DAYS = 7;
/** §4.3: the printer gets 24 hours to put their side before an admin decides. */
export const PRINTER_RESPONSE_HOURS = 24;
/** §5.2: lost disputes count against a printer for 90 days, then stop. */
export const REPUTATION_WINDOW_DAYS = 90;
/** §1.4: nudge a printer toward Tier 2 two weeks after going live. */
export const TIER2_NUDGE_DAYS = 14;

const hoursSince = (d: Date) => (Date.now() - d.getTime()) / 3_600_000;

/**
 * Whether a dispute may still be raised. After the window closes the order is considered
 * accepted and settlement is released — which is exactly why the deadline must be computed
 * from the delivery timestamp rather than from when someone happens to look.
 */
export function canRaiseDispute(order: { status: string; deliveredAt: Date | null; disputedAt: Date | null }): boolean {
  if (order.status !== 'delivered' || !order.deliveredAt) return false;
  if (order.disputedAt) return false;
  return hoursSince(order.deliveredAt) <= DISPUTE_WINDOW_HOURS;
}

export function disputeHoursLeft(deliveredAt: Date | null): number {
  if (!deliveredAt) return 0;
  return Math.max(0, Math.ceil(DISPUTE_WINDOW_HOURS - hoursSince(deliveredAt)));
}

/** §3.1: reviews are optional and the window is longer than the dispute window. */
export function canReview(order: { status: string; deliveredAt: Date | null }, alreadyReviewed: boolean): boolean {
  if (alreadyReviewed) return false;
  if (order.status !== 'delivered' || !order.deliveredAt) return false;
  return hoursSince(order.deliveredAt) <= REVIEW_WINDOW_DAYS * 24;
}

/**
 * Settlement is withheld while a dispute is open, and until the dispute window has closed
 * (§2.1). Paying out at delivery would make the 48-hour window meaningless — there would be
 * nothing left to hold.
 */
export function settlementEligible(order: {
  status: string; deliveredAt: Date | null; disputedAt: Date | null; settlementStatus: string;
}): boolean {
  if (order.settlementStatus !== 'pending') return false;
  if (order.disputedAt) return false;
  if (order.status !== 'delivered' || !order.deliveredAt) return false;
  return hoursSince(order.deliveredAt) > DISPUTE_WINDOW_HOURS;
}

/** Disputes this shop lost inside the reputation window. */
export async function lostDisputeCount(shopId: string): Promise<number> {
  const since = new Date(Date.now() - REPUTATION_WINDOW_DAYS * 86_400_000);
  const rows = await db().select({ id: tables.disputes.id }).from(tables.disputes)
    .where(and(
      eq(tables.disputes.shopId, shopId),
      eq(tables.disputes.state, 'resolved_customer'),
      gte(tables.disputes.decidedAt, since),
    ));
  return rows.length;
}

/**
 * The warning ladder (§5.1). Returned as data rather than acted on automatically: suspension
 * is an admin decision after a manual review, not something a counter should do by itself.
 */
export type ReputationStanding = {
  lost: number;
  level: 'clear' | 'noted' | 'warned' | 'suspend_review';
  message: string;
};

export function standingFor(lost: number): ReputationStanding {
  if (lost === 0) return { lost, level: 'clear', message: 'No disputes lost in the last 90 days.' };
  if (lost === 1) {
    return { lost, level: 'noted', message: 'One dispute lost in the last 90 days. Noted on the account; no action taken.' };
  }
  if (lost === 2) {
    return { lost, level: 'warned', message: 'Two disputes lost in 90 days — formal warning, account monitored, visibility reduced.' };
  }
  return { lost, level: 'suspend_review', message: 'Three or more disputes lost in 90 days — suspend pending manual review.' };
}

/**
 * §5.2: a silent ranking penalty, never shown to the printer as a label. Two or more lost
 * disputes in 90 days pushes them down the list regardless of distance.
 */
export function visibilityPenalty(lost: number): number {
  return lost >= 2 ? 1 : 0;
}

/** §5.1: a low rating flags for admin review, but only once there is enough data to mean it. */
export function ratingNeedsReview(ratingAvg: number, ratingCount: number): boolean {
  return ratingCount >= 10 && ratingAvg < 3.0;
}

export async function latestVerification(shopId: string) {
  const [row] = await db().select().from(tables.verificationSubmissions)
    .where(eq(tables.verificationSubmissions.shopId, shopId))
    .orderBy(desc(tables.verificationSubmissions.submittedAt)).limit(1);
  return row ?? null;
}

/** §1.4: show the Get Verified nudge once a Tier 1 printer has been live a fortnight. */
export function shouldNudgeTier2(shop: { verificationTier: number; createdAt: Date }, hasPending: boolean): boolean {
  if (shop.verificationTier >= 2 || hasPending) return false;
  return (Date.now() - shop.createdAt.getTime()) / 86_400_000 >= TIER2_NUDGE_DAYS;
}

export async function openDisputes() {
  return db()
    .select({ dispute: tables.disputes, order: tables.orders, shop: tables.shops })
    .from(tables.disputes)
    .innerJoin(tables.orders, eq(tables.disputes.orderId, tables.orders.id))
    .leftJoin(tables.shops, eq(tables.disputes.shopId, tables.shops.id))
    .where(isNotNull(tables.disputes.id))
    .orderBy(desc(tables.disputes.createdAt));
}
