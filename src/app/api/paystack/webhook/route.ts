import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { settlePayment } from '@/lib/settle';

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

  const event = JSON.parse(raw) as { event: string; data?: { reference?: string } };
  if (event.event === 'charge.success' && event.data?.reference) {
    await settlePayment(event.data.reference);
  }
  return NextResponse.json({ received: true });
}
