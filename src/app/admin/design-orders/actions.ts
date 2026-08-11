'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db, tables } from '@/db';
import { getSession } from '@/lib/auth';
import { paystackRefund } from '@/lib/paystack';

async function assertAdmin() {
  const session = await getSession();
  return session && session.role === 'admin' ? session : null;
}

function touched() {
  revalidatePath('/admin/design-orders');
  revalidatePath('/studio/jobs');
  revalidatePath('/studio/earnings');
}

/**
 * Marks a designer as paid. Deliberately manual and one order at a time: payouts leave the
 * platform by bank transfer, so this records what has actually been sent rather than
 * pretending to move money itself.
 */
export async function settleDesigner(orderId: string) {
  if (!(await assertAdmin())) return { error: 'Not allowed.' };

  const [order] = await db().select().from(tables.designOrders)
    .where(eq(tables.designOrders.id, orderId)).limit(1);
  if (!order) return { error: 'Order not found.' };
  if (order.status !== 'approved') return { error: 'Only approved jobs can be settled.' };
  if (order.settlementStatus === 'settled') return { error: 'Already settled.' };

  await db().update(tables.designOrders)
    .set({ settlementStatus: 'settled', updatedAt: new Date() })
    .where(eq(tables.designOrders.id, orderId));

  touched();
  return { ok: true } as const;
}

/**
 * Cancel and refund a design order. Mirrors the print side: the refund is submitted to
 * Paystack for real, but a failure still cancels the order and says so loudly, because
 * leaving a customer with neither design nor money is the worse outcome.
 */
export async function cancelDesignOrder(orderId: string, reason: string, refundNaira?: string) {
  if (!(await assertAdmin())) return { error: 'Not allowed.' };
  if (reason.trim().length < 3) return { error: 'Give a reason — this is the audit trail.' };

  const [order] = await db().select().from(tables.designOrders)
    .where(eq(tables.designOrders.id, orderId)).limit(1);
  if (!order) return { error: 'Order not found.' };
  if (order.status === 'cancelled') return { error: 'Already cancelled.' };

  const paid = order.amountPaidKobo ?? 0;
  const requested = refundNaira ? Math.round(Number(refundNaira) * 100) : paid;
  if (!Number.isFinite(requested) || requested < 0) return { error: 'Enter a valid refund amount.' };
  if (requested > paid) return { error: 'The refund cannot exceed what the customer paid.' };

  const sent = requested > 0
    ? await paystackRefund(order.code, requested >= paid ? undefined : requested)
    : ({ ok: true } as const);

  await db().update(tables.designOrders).set({
    status: 'cancelled',
    refundStatus: requested >= paid ? 'full' : requested > 0 ? 'partial' : 'none',
    refundAmountKobo: requested,
    refundReason: sent.ok
      ? reason.trim()
      : `${reason.trim()} — REFUND NOT SENT (${sent.message}); issue it manually in Paystack.`,
    settlementStatus: 'withheld',
    updatedAt: new Date(),
  }).where(eq(tables.designOrders.id, orderId));

  touched();
  return sent.ok
    ? ({ ok: true } as const)
    : ({ ok: true, warning: `Cancelled, but Paystack refused the refund: ${sent.message}. Issue it manually.` } as const);
}

export async function saveDesignOpsNote(orderId: string, note: string) {
  if (!(await assertAdmin())) return { error: 'Not allowed.' };
  await db().update(tables.designOrders)
    .set({ opsNote: note.slice(0, 2000), updatedAt: new Date() })
    .where(eq(tables.designOrders.id, orderId));
  touched();
  return { ok: true } as const;
}
