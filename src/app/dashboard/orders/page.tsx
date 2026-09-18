import type { Metadata } from 'next';
import Link from 'next/link';
import { and, desc, eq } from 'drizzle-orm';
import { db, tables } from '@/db';
import { getMyShop } from '@/lib/auth';
import { categoryName } from '@/lib/catalog';
import { naira, shortDate } from '@/lib/format';
import { EmptyState } from '@/components/ui/EmptyState';
import type { OrderStatus } from '@/lib/status';
import { statusLabel } from '@/lib/status';

export const metadata: Metadata = { title: 'Orders' };

// V2: 7 stages (decision 18). 'all' plus each real status.
const FILTERS = [
  'all',
  'order_received',
  'printer_assigned',
  'printing_in_progress',
  'printing_completed',
  'ready_for_dispatch',
  'out_for_delivery',
  'delivered',
  'cancelled',
] as const;

const FILTER_LABEL: Record<string, string> = {
  all: 'all',
  order_received: 'received',
  printer_assigned: 'assigned',
  printing_in_progress: 'printing',
  printing_completed: 'printed',
  ready_for_dispatch: 'ready',
  out_for_delivery: 'out',
  delivered: 'delivered',
  cancelled: 'cancelled',
};

/** Screen 5 (spec §4): the full order list, filterable by status. */
export default async function ShopOrdersPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const shop = (await getMyShop())!;
  const { status } = await searchParams;
  const filter = FILTERS.includes(status as (typeof FILTERS)[number]) ? status : 'all';

  const rows = await db().select().from(tables.orders)
    .where(filter === 'all'
      ? eq(tables.orders.shopId, shop.id)
      : and(eq(tables.orders.shopId, shop.id), eq(tables.orders.status, filter as OrderStatus)))
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
            {FILTER_LABEL[f]}
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
                  {categoryName(o.spec.category) ?? o.spec.category}
                  <span className="ml-2 font-mono text-xs font-bold text-black/40">{o.code}</span>
                  {o.isQuote && o.paymentStatus === 'unpaid' && (
                    <span className="ml-2 rounded-pill bg-pale px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-navy">quote request</span>
                  )}
                </p>
                <p className="text-xs text-black/50">
                  {shortDate(o.createdAt)} · {o.fulfillmentMethod === 'collection' ? 'collection' : 'delivery'} · payment {o.paymentStatus}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-navy/60">
                  {statusLabel(o.status, o.fulfillmentMethod)}
                </span>
                <span className="font-display text-sm font-extrabold text-navy">{naira(o.printerBaseKobo)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
