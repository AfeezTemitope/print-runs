'use server';

import { revalidatePath } from 'next/cache';
import { and, desc, eq } from 'drizzle-orm';
import { db, tables } from '@/db';
import { getSession } from '@/lib/auth';
import { canApprove, canRequestRevision, freeRevisionsLeft, unconsumedPaidRevisions } from '@/lib/design-orders';
import { designApproved, revisionRequested } from '@/lib/notify';

async function myOrder(orderId: string) {
  const session = await getSession();
  if (!session) return null;
  const [order] = await db().select().from(tables.designOrders)
    .where(and(eq(tables.designOrders.id, orderId), eq(tables.designOrders.customerId, session.uid))).limit(1);
  return order ?? null;
}

async function latestProof(designOrderId: string) {
  const [proof] = await db().select().from(tables.designProofs)
    .where(eq(tables.designProofs.designOrderId, designOrderId))
    .orderBy(desc(tables.designProofs.round)).limit(1);
  return proof ?? null;
}

/**
 * Approval is the moment Terms section 9 shifts liability for anything visible in the proof
 * onto the customer, so it is stamped against the exact proof they were looking at — not
 * merely flagged on the order — and it is what completes the job for settlement.
 */
export async function approveProof(orderId: string) {
  const order = await myOrder(orderId);
  if (!order) return { error: 'Order not found.' };
  if (!canApprove(order)) return { error: 'There is nothing waiting on your approval.' };

  const proof = await latestProof(order.id);
  if (!proof) return { error: 'No proof to approve.' };

  const now = new Date();
  await db().update(tables.designProofs).set({ approvedAt: now }).where(eq(tables.designProofs.id, proof.id));
  await db().update(tables.designOrders).set({
    status: 'approved', finalFileUrl: proof.fileUrl, approvedAt: now, updatedAt: now,
  }).where(eq(tables.designOrders.id, order.id));

  const [studio] = await db().select().from(tables.designerStudios)
    .where(eq(tables.designerStudios.id, order.studioId)).limit(1);
  if (studio) {
    const [owner] = await db().select().from(tables.users).where(eq(tables.users.id, studio.userId)).limit(1);
    if (owner) await designApproved({ userId: owner.id, email: owner.email }, { code: order.code });
  }

  revalidatePath(`/orders/design/${order.code}`);
  revalidatePath('/studio/jobs');
  return { ok: true } as const;
}

/**
 * Ask for changes. Spends a free revision if one remains; otherwise spends an extra the
 * customer has already paid for. It can never silently create a debt — if neither is
 * available the UI sends them to pay first.
 */
export async function requestRevision(orderId: string, note: string) {
  const order = await myOrder(orderId);
  if (!order) return { error: 'Order not found.' };
  if (note.trim().length < 5) return { error: 'Tell the designer what to change.' };

  const paid = await unconsumedPaidRevisions(order.id);
  if (!canRequestRevision(order, paid.length)) {
    return { error: 'You have used your included revisions — pay for an extra to continue.' };
  }

  const proof = await latestProof(order.id);
  const usesFree = freeRevisionsLeft(order) > 0;

  if (!usesFree) {
    await db().update(tables.designRevisionCharges)
      .set({ consumedAt: new Date() })
      .where(eq(tables.designRevisionCharges.id, paid[0].id));
  }

  if (proof) {
    await db().update(tables.designProofs)
      .set({ revisionNote: note.trim() })
      .where(eq(tables.designProofs.id, proof.id));
  }

  await db().update(tables.designOrders).set({
    status: 'revision_requested',
    // Only a free revision moves this counter. Paid extras are tracked by their own rows,
    // so the "2 included" promise stays honest however many extras are bought.
    revisionsUsed: usesFree ? order.revisionsUsed + 1 : order.revisionsUsed,
    updatedAt: new Date(),
  }).where(eq(tables.designOrders.id, order.id));

  const [studio] = await db().select().from(tables.designerStudios)
    .where(eq(tables.designerStudios.id, order.studioId)).limit(1);
  if (studio) {
    const [owner] = await db().select().from(tables.users).where(eq(tables.users.id, studio.userId)).limit(1);
    if (owner) await revisionRequested({ userId: owner.id, email: owner.email }, { code: order.code, note: note.trim() });
  }

  revalidatePath(`/orders/design/${order.code}`);
  revalidatePath('/studio/jobs');
  return { ok: true } as const;
}
