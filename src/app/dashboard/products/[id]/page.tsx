import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { db, tables } from '@/db';
import { getMyShop } from '@/lib/auth';
import { getCategory, getListing, cellKey } from '@/lib/categories';
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

  const cat = getCategory(p.categorySlug);
  const listing = cat ? getListing(cat, p.listingSlug ?? undefined) ?? cat.listings[0] : undefined;
  const grid = listing?.pricingGrid;

  // Saved rows are keyed back onto the grid by their coordinates, so a printer's existing
  // prices land in the right cells even though the grid is now generated rather than stored.
  const cellPrices: Record<string, string> = {};
  if (grid) {
    for (const v of variants) {
      const coords = Object.fromEntries(grid.axes.map((a) => [a.key, String(v.meta?.[a.key] ?? '')]));
      cellPrices[cellKey(grid, coords)] = fromKobo(v.priceKobo);
    }
  }

  return (
    <div>
      <h1 className="mb-6 font-display text-3xl font-extrabold tracking-tight text-black">Edit product</h1>
      <ProductForm initial={{
        id: p.id,
        categorySlug: p.categorySlug,
        listingSlug: listing?.slug ?? '',
        pricingMode: p.pricingMode,
        ratePerUnit: fromKobo(p.ratePerUnitKobo),
        offersHylet: p.offersHylet,
        turnaroundHours: String(p.turnaroundHours),
        photoUrl: p.photoUrl ?? '',
        cellPrices,
        addonPrices: Object.fromEntries(addons.map((a) => [`${a.kind}::${a.label}`, fromKobo(a.priceKobo)])),
      }} />
    </div>
  );
}
