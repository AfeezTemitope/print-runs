'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db, tables } from '@/db';
import { getSession } from '@/lib/auth';
import { executePayout, runSettlement } from '@/lib/payouts';
import { transfersEnabled } from '@/lib/paystack';

async function assertAdmin() {
  const session = await getSession();
  return session && session.role === 'admin' ? session : null;
}

function touched() {
  revalidatePath('/admin/payouts');
  revalidatePath('/dashboard/payouts');
}

/**
 * Release a due payout — the brief's "manual release button", used for the Pro advance and,
 * while transfers are off, for every settlement.
 *
 * With transfers ON it sends through Paystack. With them OFF it records that the admin has
 * paid by bank transfer themselves, so the ledger stays true either way.
 */
export async function releasePayout(payoutId: string) {
  if (!(await assertAdmin())) return { error: 'Not allowed.' };

  const [payout] = await db().select().from(tables.payouts).where(eq(tables.payouts.id, payoutId)).limit(1);
  if (!payout) return { error: 'Payout not found.' };
  if (payout.state === 'paid') return { error: 'Already paid.' };
  if (payout.state === 'processing') return { error: 'Already sending — wait for Paystack to confirm.' };

  if (transfersEnabled()) {
    const res = await executePayout(payout.id);
    touched();
    return res.ok ? { ok: true as const } : { error: res.message };
  }

  await db().update(tables.payouts)
    .set({ state: 'paid', paidBy: 'manual', paidAt: new Date(), failureReason: null })
    .where(eq(tables.payouts.id, payout.id));
  touched();
  return { ok: true as const };
}

/** Put a failed payout back in the queue. Uses the same reference, so it cannot double-pay. */
export async function retryPayout(payoutId: string) {
  if (!(await assertAdmin())) return { error: 'Not allowed.' };
  await db().update(tables.payouts)
    .set({ state: 'due', failureReason: null })
    .where(eq(tables.payouts.id, payoutId));
  touched();
  return { ok: true as const };
}

/** Run settlement now rather than waiting for the morning cron. Safe to press repeatedly. */
export async function settleNow() {
  if (!(await assertAdmin())) return { error: 'Not allowed.' };
  const res = await runSettlement();
  touched();
  return { ok: true as const, ...res };
}
