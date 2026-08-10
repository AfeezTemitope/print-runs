import { db, tables } from '@/db';
import { and, desc, eq } from 'drizzle-orm';

/**
 * PrintRuns' commercial margin on design work: a flat 1,000 naira per order, regardless of
 * what the designer charges. Unlike print, this is not a share of the partner's price — a
 * designer charging 80,000 for a brand identity does not subsidise the platform more than
 * one charging 8,000, because the platform's work on the job is the same either way.
 */
export const DESIGN_MARGIN_KOBO = 100_000;

export type DesignTotals = {
  designerBaseKobo: number;
  marginKobo: number;
  platformFeeKobo: number;
  amountPaidKobo: number;
};

export function computeDesignTotals(designerBaseKobo: number, platformFeeKobo: number): DesignTotals {
  return {
    designerBaseKobo,
    marginKobo: DESIGN_MARGIN_KOBO,
    platformFeeKobo,
    amountPaidKobo: designerBaseKobo + DESIGN_MARGIN_KOBO + platformFeeKobo,
  };
}

/** Free revisions left. Paid extras are counted separately and never come out of this. */
export function freeRevisionsLeft(o: { revisionsIncluded: number; revisionsUsed: number }): number {
  return Math.max(0, o.revisionsIncluded - o.revisionsUsed);
}

/**
 * A revision may be requested when the customer is looking at a proof and either has a free
 * one left or has already paid for an extra that has not been spent.
 */
export function canRequestRevision(
  o: { status: string; revisionsIncluded: number; revisionsUsed: number },
  paidUnconsumed: number,
): boolean {
  if (o.status !== 'proof_ready') return false;
  return freeRevisionsLeft(o) > 0 || paidUnconsumed > 0;
}

/** Whether the customer must pay before their next revision can be requested. */
export function needsPaidRevision(
  o: { revisionsIncluded: number; revisionsUsed: number },
  paidUnconsumed: number,
): boolean {
  return freeRevisionsLeft(o) === 0 && paidUnconsumed === 0;
}

/**
 * Approval is only meaningful where there is something to approve. Direct-to-print orders
 * skip the gate entirely, which is exactly what the customer chose when they picked it.
 */
export function canApprove(o: { status: string; reviewMode: string }): boolean {
  if (o.reviewMode === 'direct') return false;
  return o.status === 'proof_ready';
}

export async function getDesignOrder(id: string) {
  const [row] = await db().select().from(tables.designOrders)
    .where(eq(tables.designOrders.id, id)).limit(1);
  return row ?? null;
}

export async function proofsFor(designOrderId: string) {
  return db().select().from(tables.designProofs)
    .where(eq(tables.designProofs.designOrderId, designOrderId))
    .orderBy(desc(tables.designProofs.round));
}

/** Extra revisions paid for but not yet spent. */
export async function unconsumedPaidRevisions(designOrderId: string) {
  const rows = await db().select().from(tables.designRevisionCharges)
    .where(and(
      eq(tables.designRevisionCharges.designOrderId, designOrderId),
      eq(tables.designRevisionCharges.paymentStatus, 'paid'),
    ));
  return rows.filter((r) => r.consumedAt === null);
}
