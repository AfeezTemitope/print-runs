import type { Metadata } from 'next';
import Link from 'next/link';
import { and, desc, eq } from 'drizzle-orm';
import { db, tables } from '@/db';
import { getMyShop } from '@/lib/auth';
import { getCategory } from '@/lib/categories';
import { naira, shortDate } from '@/lib/format';
import { EmptyState } from '@/components/ui/EmptyState';

export const metadata: Metadata = { title: 'Orders' };

const FILTERS = ['all', 'placed', 'printing', 'ready', 'completed', 'cancelled'] as const;

/** Screen 5 (spec §4): the full order list, filterable by status. */
export default async function ShopOrdersPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const shop = (await getMyShop())!;
  const { status } = await searchParams;
  const filter = FILTERS.includes(status as (typeof FILTERS)[number]) ? status : 'all';

  const rows = await db().select().from(tables.orders)
    .where(filter === 'all'
      ? eq(tables.orders.shopId, shop.id)
      : and(eq(tables.orders.shopId, shop.id), eq(tables.orders.status, filter as 'placed')))
    .orderBy(desc(tables.orders.createdAt))
    .limit(100);

  return (
    <div>
      <h1 className="font-display text-3xl font-extrabold tracking-tight text-black">Orders</h1>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <Link
            key={f}
            href={f === 'all' ? '/dashboard/orders' : `/dashboard/orders?status=${f}`}
            className={`rounded-pill px-3.5 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider ${
              filter === f ? 'bg-navy text-white' : 'border border-black/20 text-navy hover:border-black/45'
            }`}
          >
            {f}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="mt-6"><EmptyState title="Nothing here" hint={filter === 'all' ? 'Orders show up as customers buy.' : `No ${filter} orders right now.`} /></div>
      ) : (
        <ul className="mt-6 divide-y divide-dashed divide-black/15 rounded-2xl border border-black/12 bg-white">
          {rows.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-4">
              <div>
                <p className="font-display text-sm font-extrabold text-navy">
                  {getCategory(o.spec.category)?.name ?? o.spec.category}
                  <span className="ml-2 font-mono text-xs font-bold text-black/40">{o.code}</span>
                  {o.isQuote && o.paymentStatus === 'unpaid' && (
                    <span className="ml-2 rounded-pill bg-pale px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-navy">quote request</span>
                  )}
                </p>
                <p className="text-xs text-black/50">{shortDate(o.createdAt)} · {o.fulfillmentMethod} · payment {o.paymentStatus}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-navy/60">{o.status}</span>
                <span className="font-display text-sm font-extrabold text-navy">{naira(o.priceKobo)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
