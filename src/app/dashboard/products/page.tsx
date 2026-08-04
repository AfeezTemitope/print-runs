import type { Metadata } from 'next';
import Link from 'next/link';
import { desc, eq } from 'drizzle-orm';
import { db, tables } from '@/db';
import { getMyShop } from '@/lib/auth';
import { getCategory } from '@/lib/categories';
import { Glyph } from '@/components/ui/Glyph';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ToggleActive } from './ToggleActive';

export const metadata: Metadata = { title: 'Products' };

const MODE_LABEL: Record<string, string> = {
  per_area: 'Per sq.ft',
  matrix: 'Price grid',
  quote: 'Request quote',
  // Retired shapes — old rows are deactivated by the QA migration and re-published from the
  // new grid form, but the label stays so the list never renders a blank.
  per_sheet: 'Retired — republish',
  tier: 'Retired — republish',
  fixed_size: 'Retired — republish',
};

export default async function ShopProductsPage() {
  const shop = (await getMyShop())!;
  const rows = await db().select().from(tables.products)
    .where(eq(tables.products.shopId, shop.id))
    .orderBy(desc(tables.products.createdAt));

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-black">Products</h1>
        <ButtonLink href="/dashboard/products/new" size="sm">+ Add product</ButtonLink>
      </div>

      {rows.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="No listings yet"
            hint="Customers only see printers with a product in the category they're configuring."
            action={<ButtonLink href="/dashboard/products/new">Add your first product</ButtonLink>}
          />
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {rows.map((p) => {
            const cat = getCategory(p.categorySlug);
            return (
              <li key={p.id} className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white p-4 ${p.isActive ? 'border-black/12' : 'border-dashed border-black/25 opacity-70'}`}>
                <div className="flex items-center gap-3.5">
                  {cat && <Glyph kind={cat.glyph} color={cat.hue} className="size-10" />}
                  <div>
                    <p className="font-display font-extrabold text-navy">{p.name}</p>
                    <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-black/45">
                      {cat?.name} · {MODE_LABEL[p.pricingMode]} · ~{p.turnaroundHours}hrs
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <ToggleActive productId={p.id} isActive={p.isActive} />
                  <ButtonLink href={`/dashboard/products/${p.id}`} variant="tertiary" size="sm">Edit</ButtonLink>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
