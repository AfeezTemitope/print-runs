import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db, tables } from '@/db';
import { getCategory } from '@/lib/categories';
import { computePrice } from '@/lib/pricing';
import { specFromParams } from '@/lib/spec';
import { CheckoutClient } from './CheckoutClient';

export const metadata: Metadata = { title: 'Checkout' };
export const dynamic = 'force-dynamic';

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Screens 5–6 (spec §3): fulfillment choice (pickup only if the printer supports it), then pay. */
export default async function CheckoutPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const spec = specFromParams(sp);
  const shopId = one(sp.shop);
  const productId = one(sp.product);
  if (!spec || !shopId || !productId || !getCategory(spec.category)) notFound();

  const [shop] = await db().select().from(tables.shops).where(eq(tables.shops.id, shopId)).limit(1);
  const [product] = await db().select().from(tables.products).where(eq(tables.products.id, productId)).limit(1);
  if (!shop || !product || product.shopId !== shop.id) notFound();

  const [variants, addons] = await Promise.all([
    db().select().from(tables.productVariants).where(eq(tables.productVariants.productId, product.id)),
    db().select().from(tables.productAddons).where(eq(tables.productAddons.productId, product.id)),
  ]);

  // Server-side price — the client never supplies a total.
  const price = computePrice(spec, product, variants, addons);
  const isQuote = one(sp.quote) === '1' || !price.ok;

  return (
    <CheckoutClient
      shop={{
        id: shop.id, name: shop.businessName, code: shop.code,
        supportsPickup: shop.supportsPickup, supportsDelivery: shop.supportsDelivery,
      }}
      categoryName={getCategory(spec.category)!.name}
      isQuote={isQuote}
      lines={price.ok ? price.lines : []}
      totalKobo={price.ok ? price.totalKobo : null}
      query={Object.fromEntries(Object.entries(sp).flatMap(([k, v]) => (one(v) ? [[k, one(v)!]] : [])))}
    />
  );
}
