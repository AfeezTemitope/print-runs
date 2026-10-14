import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db, tables } from '@/db';
import { getSession } from '@/lib/auth';
import { getFeeBands } from '@/lib/pricing';
import { platformFeeFor } from '@/lib/platform-fee';
import { getCategoryMargins, marginFor } from '@/lib/margins';
import { computeMargin } from '@/lib/pricing';
import { paystackInitialize } from '@/lib/paystack';

/**
 * Pay an accepted quote (Module 2 §7.3).
 *
 * The quote row already exists, so unlike a normal order there is nothing to create on
 * settlement — only to mark paid. That is why the reference is the order's own code: the
 * existing settlePayment path finds it and updates it in place.
 *
 * The margin and platform fee are applied HERE rather than being quoted by the printer. A
 * printer quotes their own price; what PrintRuns adds on top is never theirs to set.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Log in first.' }, { status: 401 });

  const { orderId } = (await req.json().catch(() => ({}))) as { orderId?: string };

  const [order] = await db().select().from(tables.orders)
    .where(and(eq(tables.orders.id, orderId ?? ''), eq(tables.orders.customerId, session.uid))).limit(1);
  if (!order) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
  if (order.paymentStatus === 'paid') return NextResponse.json({ error: 'Already paid.' }, { status: 400 });
  if (!order.quotedPriceKobo) return NextResponse.json({ error: 'No quote to pay yet.' }, { status: 400 });
  if (order.status === 'cancelled') return NextResponse.json({ error: 'That order was cancelled.' }, { status: 400 });

  const [margins, feeBands] = await Promise.all([
    getCategoryMargins(),
    getFeeBands((key) =>
      db().select().from(tables.platformSettings).where(eq(tables.platformSettings.key, key)).limit(1)
        .then((rows) => rows[0])),
  ]);

  const margin = marginFor(margins, order.spec?.category ?? '', {
    marginType: 'fixed', marginFixedKobo: 0, marginPercentBps: 0,
  });
  const qty = order.spec?.qty ?? 1;
  const platformFeeKobo = platformFeeFor(order.quotedPriceKobo, feeBands);
  const marginKobo = computeMargin(order.quotedPriceKobo, qty, margin);
  const amountPaidKobo = order.quotedPriceKobo + marginKobo + platformFeeKobo;

  // Frozen onto the order now so settlement has the same numbers the customer just agreed to.
  await db().update(tables.orders).set({
    printerBaseKobo: order.quotedPriceKobo,
    marginKobo,
    sellingPriceKobo: order.quotedPriceKobo + marginKobo,
    platformFeeKobo,
    amountPaidKobo,
    updatedAt: new Date(),
  }).where(eq(tables.orders.id, order.id));

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;
  try {
    const init = await paystackInitialize({
      email: order.contactEmail ?? '',
      amountKobo: amountPaidKobo,
      reference: order.code,
      callbackUrl: `${origin}/checkout/callback`,
      metadata: { kind: 'quote', orderId: order.id },
    });
    return NextResponse.json({ ok: true, authorizationUrl: init.authorization_url });
  } catch {
    return NextResponse.json({ error: 'Could not start payment. Try again.' }, { status: 502 });
  }
}
