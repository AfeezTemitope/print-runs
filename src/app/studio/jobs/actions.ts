'use server';

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { db, tables } from '@/db';
import { getMyStudio } from '@/lib/designers';
import { proofsFor } from '@/lib/design-orders';
import { proofReady } from '@/lib/email';

async function myOrder(orderId: string) {
  const studio = await getMyStudio();
  if (!studio) return null;
  const [order] = await db().select().from(tables.designOrders)
    .where(and(eq(tables.designOrders.id, orderId), eq(tables.designOrders.studioId, studio.id))).limit(1);
  return order ? { studio, order } : null;
}

export async function startWork(orderId: string) {
  const found = await myOrder(orderId);
  if (!found) return { error: 'Not your job.' };
  if (found.order.status !== 'brief_received') return { error: 'Already under way.' };

  await db().update(tables.designOrders)
    .set({ status: 'in_progress', updatedAt: new Date() })
    .where(eq(tables.designOrders.id, orderId));
  revalidatePath('/studio/jobs');
  return { ok: true } as const;
}

/**
 * Send a proof. Each one is its own numbered round rather than overwriting the last, because
 * Terms section 9 hangs liability on the specific version the customer approved — so the
 * history has to survive.
 *
 * On a direct-to-print order there is no review gate: the file the designer sends IS the
 * final, and the job completes immediately. That is precisely what the customer chose.
 */
export async function submitProof(orderId: string, fileUrl: string, note: string) {
  const found = await myOrder(orderId);
  if (!found) return { error: 'Not your job.' };
  const { order, studio } = found;

  if (!/^https:\/\/res\.cloudinary\.com\//.test(fileUrl)) return { error: 'Upload the file rather than pasting a link.' };
  if (!['brief_received', 'in_progress', 'revision_requested'].includes(order.status)) {
    return { error: 'This job is not waiting on a proof.' };
  }

  const existing = await proofsFor(order.id);
  const round = existing.length + 1;

  await db().insert(tables.designProofs).values({
    designOrderId: order.id, round, fileUrl, note: note.trim() || null,
  });

  if (order.reviewMode === 'direct') {
    await db().update(tables.designOrders).set({
      status: 'approved',
      finalFileUrl: fileUrl,
      approvedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(tables.designOrders.id, order.id));
  } else {
    await db().update(tables.designOrders)
      .set({ status: 'proof_ready', updatedAt: new Date() })
      .where(eq(tables.designOrders.id, order.id));
    if (order.contactEmail) {
      await proofReady(order.contactEmail, { code: order.code, round, studio: studio.displayName });
    }
  }

  revalidatePath('/studio/jobs');
  revalidatePath(`/orders/design/${order.code}`);
  return { ok: true } as const;
}
