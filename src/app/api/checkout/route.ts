import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, tables } from '@/db';
import { getSession } from '@/lib/auth';
import { getCategory } from '@/lib/categories';
import { computePrice } from '@/lib/pricing';
import { specFromParams } from '@/lib/spec';
import { paystackInitialize } from '@/lib/paystack';
import { orderCode } from '@/lib/format';

/**
 * Creates the order and (for priced orders) hands off to Paystack.
 * Price is recomputed server-side from the spec — the client sends no amount.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Log in to place an order.' }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, string> | null;
  if (!body) return NextResponse.json({ error: 'Bad request.' }, { status: 400 });

  const spec = specFromParams(body);
  const shopId = body.shop;
  const productId = body.product;
  const method = body.fulfillmentMethod === 'pickup' ? 'pickup' : 'delivery';

  if (!spec || !shopId || !productId || !getCategory(spec.category)) {
    return NextResponse.json({ error: 'Order details are incomplete.' }, { status: 400 });
  }

  const [shop] = await db().select().from(tables.shops).where(eq(tables.shops.id, shopId)).limit(1);
  const [product] = await db().select().from(tables.products).where(eq(tables.products.id, productId)).limit(1);
  if (!shop || !product || product.shopId !== shop.id || !product.isActive) {
    return NextResponse.json({ error: 'That printer or product is no longer available.' }, { status: 404 });
  }
  if (method === 'pickup' && !shop.supportsPickup) {
    return NextResponse.json({ error: 'This printer does not offer self-pickup.' }, { status: 400 });
  }
  if (method === 'delivery' && (body.deliveryAddress ?? '').trim().length < 6) {
    return NextResponse.json({ error: 'Enter a delivery address.' }, { status: 400 });
  }

  const [variants, addons] = await Promise.all([
    db().select().from(tables.productVariants).where(eq(tables.productVariants.productId, product.id)),
    db().select().from(tables.productAddons).where(eq(tables.productAddons.productId, product.id)),
  ]);
  const price = computePrice(spec, product, variants, addons);
  const isQuote = !price.ok;

  const [user] = await db().select().from(tables.users).where(eq(tables.users.id, session.uid)).limit(1);
  if (!user) return NextResponse.json({ error: 'Session expired — log in again.' }, { status: 401 });

  const code = orderCode();
  const [order] = await db().insert(tables.orders).values({
    code,
    customerId: user.id,
    shopId: shop.id,
    productId: product.id,
    spec: { ...spec, breakdown: price.ok ? price.lines : undefined },
    isQuote,
    priceKobo: price.ok ? price.totalKobo : null,
    fulfillmentMethod: method,
    deliveryAddress: method === 'delivery' ? body.deliveryAddress.trim() : null,
    status: 'placed',
    paymentStatus: 'unpaid',
    designFileUrl: body.file || null,
    designFileName: body.fileName || null,
    printNote: body.note?.trim() || null,
  }).returning({ id: tables.orders.id });

  if (isQuote) return NextResponse.json({ ok: true, quote: true, orderId: order.id });

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;
  try {
    const init = await paystackInitialize({
      email: user.email,
      amountKobo: price.ok ? price.totalKobo : 0,
      reference: code,
      callbackUrl: `${origin}/checkout/callback`,
      metadata: { orderId: order.id, shop: shop.businessName },
    });
    return NextResponse.json({ ok: true, authorizationUrl: init.authorization_url });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Paystack is unreachable — try again shortly.' },
      { status: 502 },
    );
  }
}
