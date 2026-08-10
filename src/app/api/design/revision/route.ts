import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db, tables } from '@/db';
import { getSession } from '@/lib/auth';
import { paystackInitialize } from '@/lib/paystack';
import { revisionChargeCode } from '@/lib/format';
import { freeRevisionsLeft, unconsumedPaidRevisions } from '@/lib/design-orders';

/**
 * Start payment for one extra revision beyond the included allowance. Charged as its own
 * transaction so the customer authorises each extra explicitly (the founder's decision), and
 * refused while a free revision or an already-paid unused one is still available — nobody
 * should be able to pay twice for something they already have.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Log in to continue.' }, { status: 401 });

  const { orderId } = (await req.json()) as { orderId?: string };

  const [order] = await db().select().from(tables.designOrders)
    .where(and(
      eq(tables.designOrders.id, orderId ?? ''),
      eq(tables.designOrders.customerId, session.uid),
    )).limit(1);
  if (!order) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
  if (order.status !== 'proof_ready') {
    return NextResponse.json({ error: 'There is no proof waiting on your review.' }, { status: 400 });
  }
  if (order.extraRevisionKobo <= 0) {
    return NextResponse.json({ error: 'This designer does not offer extra revisions.' }, { status: 400 });
  }
  if (freeRevisionsLeft(order) > 0) {
    return NextResponse.json({ error: 'You still have a free revision left — no payment needed.' }, { status: 400 });
  }
  const alreadyPaid = await unconsumedPaidRevisions(order.id);
  if (alreadyPaid.length > 0) {
    return NextResponse.json({ error: 'You have already paid for a revision that has not been used.' }, { status: 400 });
  }

  const reference = revisionChargeCode();
  await db().insert(tables.designRevisionCharges).values({
    designOrderId: order.id,
    reference,
    amountKobo: order.extraRevisionKobo,
  });

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;
  try {
    const init = await paystackInitialize({
      email: order.contactEmail,
      amountKobo: order.extraRevisionKobo,
      reference,
      callbackUrl: `${origin}/checkout/callback`,
      metadata: { kind: 'revision', designOrderId: order.id },
    });
    return NextResponse.json({ ok: true, authorizationUrl: init.authorization_url });
  } catch {
    return NextResponse.json({ error: 'Could not start payment. Try again.' }, { status: 502 });
  }
}
