import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, tables } from '@/db';
import { getMyShop } from '@/lib/auth';
import { getTierConfig } from '@/lib/tier-config';
import { isTierKey, effectiveTier, BILLING_CYCLE_DAYS } from '@/lib/subscriptions';
import { paystackInitialize } from '@/lib/paystack';

/**
 * Start a subscription payment (brief: vendor tiers).
 *
 * Reference prefix PRS- so settlement can route it, the same way PRD- and PRR- already work.
 * The shop's tier is NOT changed here — only when Paystack confirms. A printer who abandons
 * the payment page must not end up on a tier they have not paid for.
 */
export async function POST(req: Request) {
  const shop = await getMyShop();
  if (!shop) return NextResponse.json({ error: 'Not your shop.' }, { status: 401 });

  const { tier } = (await req.json().catch(() => ({}))) as { tier?: string };
  if (!isTierKey(tier) || tier === 'free') {
    return NextResponse.json({ error: 'Choose a paid plan.' }, { status: 400 });
  }

  const config = await getTierConfig();
  const chosen = config[tier];
  if (chosen.priceKobo <= 0) return NextResponse.json({ error: 'That plan is not for sale.' }, { status: 400 });

  const [owner] = await db().select({ email: tables.users.email }).from(tables.users)
    .where(eq(tables.users.id, shop.userId)).limit(1);
  if (!owner?.email) return NextResponse.json({ error: 'No email on your account.' }, { status: 400 });

  const reference = `PRS-${Math.floor(100000 + Math.random() * 899999)}`;

  // Extending an unexpired plan adds to the end of it rather than restarting from today, so a
  // printer who renews early is not quietly charged for days they already owned.
  const current = effectiveTier(shop);
  const base = current !== 'free' && shop.subscriptionEndsAt && shop.subscriptionEndsAt > new Date()
    ? shop.subscriptionEndsAt
    : new Date();
  const periodEnd = new Date(base.getTime() + BILLING_CYCLE_DAYS * 86_400_000);

  await db().insert(tables.subscriptionPayments).values({
    shopId: shop.id,
    tier,
    reference,
    amountKobo: chosen.priceKobo,
    periodStart: base,
    periodEnd,
  });

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;
  try {
    const init = await paystackInitialize({
      email: owner.email,
      amountKobo: chosen.priceKobo,
      reference,
      callbackUrl: `${origin}/checkout/callback`,
      metadata: { kind: 'subscription', shopId: shop.id, tier },
    });
    return NextResponse.json({ ok: true, authorizationUrl: init.authorization_url });
  } catch {
    return NextResponse.json({ error: 'Could not start payment. Try again.' }, { status: 502 });
  }
}
