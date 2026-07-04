import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { db, tables } from '@/db';
import { getMyShop } from '@/lib/auth';
import { ProductForm } from '../ProductForm';

export const metadata: Metadata = { title: 'Edit product' };

const fromKobo = (k: number | null) => (k ? String(k / 100) : '');

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const shop = (await getMyShop())!;

  const [p] = await db().select().from(tables.products)
    .where(and(eq(tables.products.id, id), eq(tables.products.shopId, shop.id))).limit(1);
  if (!p) notFound();

  const [variants, addons] = await Promise.all([
    db().select().from(tables.productVariants).where(eq(tables.productVariants.productId, p.id)),
    db().select().from(tables.productAddons).where(eq(tables.productAddons.productId, p.id)),
  ]);

  return (
    <div>
      <h1 className="mb-6 font-display text-3xl font-extrabold tracking-tight text-black">Edit product</h1>
      <ProductForm initial={{
        id: p.id,
        categorySlug: p.categorySlug,
        name: p.name,
        pricingMode: p.pricingMode,
        areaUnit: p.areaUnit,
        ratePerUnit: fromKobo(p.ratePerUnitKobo),
        minCharge: fromKobo(p.minChargeKobo),
        perSheet: fromKobo(p.perSheetKobo),
        cardsPerSheet: p.cardsPerSheet ? String(p.cardsPerSheet) : '10',
        turnaroundHours: String(p.turnaroundHours),
        photoUrl: p.photoUrl ?? '',
        tiers: p.pricingMode === 'matrix' ? [] : variants.map((v) => ({
          qty: v.qty ? String(v.qty) : '1',
          price: fromKobo(v.priceKobo),
          label: v.label ?? '',
        })),
        matrix: p.pricingMode === 'matrix' ? variants.map((v) => ({
          cover: String(v.meta?.cover ?? 'Soft cover'),
          size: String(v.meta?.size ?? 'A5'),
          sheets: String(v.meta?.sheets ?? 40),
          price: fromKobo(v.priceKobo),
        })) : [],
        addons: addons.map((a) => ({ kind: a.kind, label: a.label, basis: a.basis, price: fromKobo(a.priceKobo) })),
      }} />
    </div>
  );
}
