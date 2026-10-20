import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { and, eq, ne } from 'drizzle-orm';
import { db, tables } from '@/db';
import { settlePayment } from '@/lib/settle';
import { notifyPaid } from '@/lib/payouts';

/** Paystack webhook — HMAC-SHA512 signature check on the raw body, then idempotent settle. */
export async function POST(req: Request) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) return NextResponse.json({ error: 'Not configured' }, { status: 501 });

  const raw = await req.text();
  const signature = req.headers.get('x-paystack-signature') ?? '';
  const expected = crypto.createHmac('sha512', secret).update(raw).digest('hex');

  // Constant-time compare. A plain !== leaks how many leading characters matched, which over
  // enough attempts is enough to forge a signature and mint free paid orders.
  const a = Buffer.from(signature, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const event = JSON.parse(raw) as {
    event: string;
    data?: { reference?: string; reason?: string; gateway_response?: string };
  };

  if (event.event === 'charge.success' && event.data?.reference) {
    await settlePayment(event.data.reference);
  }

  /**
   * Transfer outcomes (Round 3b). A payout is only 'paid' once Paystack says the money
   * actually arrived — the transfer request succeeding means it was accepted, not delivered.
   * A reversal sends it back to 'failed' so it shows up for an admin to retry, rather than
   * sitting as paid while the printer never received it.
   */
  const ref = event.data?.reference;
  if (ref && ref.startsWith('PRP-')) {
    if (event.event === 'transfer.success') {
      // Only notify on the transition INTO paid, so a webhook Paystack retries cannot send the
      // printer a second "you've been paid".
      const updated = await db().update(tables.payouts)
        .set({ state: 'paid', paidBy: 'auto', paidAt: new Date(), failureReason: null })
        .where(and(eq(tables.payouts.reference, ref), ne(tables.payouts.state, 'paid')))
        .returning({ id: tables.payouts.id });
      if (updated[0]) await notifyPaid(updated[0].id);
    } else if (event.event === 'transfer.failed' || event.event === 'transfer.reversed') {
      await db().update(tables.payouts)
        .set({
          state: 'failed',
          failureReason: event.data?.reason ?? event.data?.gateway_response
            ?? (event.event === 'transfer.reversed' ? 'Transfer reversed by the bank.' : 'Transfer failed.'),
        })
        .where(eq(tables.payouts.reference, ref));
    }
  }

  return NextResponse.json({ received: true });
}
