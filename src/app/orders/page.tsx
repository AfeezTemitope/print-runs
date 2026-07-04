import type { Metadata } from 'next';
import Link from 'next/link';
import { desc, eq } from 'drizzle-orm';
import { db, tables } from '@/db';
import { getSession } from '@/lib/auth';
import { getCategory } from '@/lib/categories';
import { EmptyState } from '@/components/ui/EmptyState';
import { ButtonLink } from '@/components/ui/Button';
import { naira, shortDate } from '@/lib/format';

export const metadata: Metadata = { title: 'My orders' };
export const dynamic = 'force-dynamic';

const BADGE: Record<string, string> = {
  placed: 'bg-pale text-navy',
  printing: 'bg-blue text-white',
  ready: 'bg-navy text-pale',
  completed: 'bg-success/15 text-success',
  cancelled: 'bg-red/10 text-red',
};

/** Screen 8 (spec §3): same status data as Track Order, different view. */
export default async function OrdersPage() {
  const session = (await getSession())!;
  const rows = await db().select({
    order: tables.orders,
    shopName: tables.shops.businessName,
  })
    .from(tables.orders)
    .innerJoin(tables.shops, eq(tables.orders.shopId, tables.shops.id))
    .where(eq(tables.orders.customerId, session.uid))
    .orderBy(desc(tables.orders.createdAt));

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-4xl font-extrabold tracking-tight text-black">
        My <span className="text-blue">orders</span>
      </h1>

      {rows.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="No orders yet"
            hint="Your past and active print jobs will live here."
            action={<ButtonLink href="/products">Start printing</ButtonLink>}
          />
        </div>
      ) : (
        <ul className="mt-8 divide-y divide-dashed divide-black/15 rounded-2xl border border-black/12 bg-white">
          {rows.map(({ order, shopName }) => {
            const label = order.isQuote && order.paymentStatus === 'unpaid'
              ? 'Quote requested'
              : order.status === 'completed'
                ? (order.fulfillmentMethod === 'pickup' ? 'Picked up' : 'Delivered')
                : order.status;
            return (
              <li key={order.id}>
                <Link href={`/orders/${order.id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-pale/20">
                  <div>
                    <p className="font-display font-extrabold text-navy">
                      {getCategory(order.spec.category)?.name ?? order.spec.category}
                      <span className="ml-2 font-mono text-xs font-bold text-black/45">{order.code}</span>
                    </p>
                    <p className="mt-0.5 text-[13px] text-black/50">{shopName} · {shortDate(order.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`rounded-pill px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-widest ${BADGE[order.isQuote && order.paymentStatus === 'unpaid' ? 'placed' : order.status]}`}>
                      {label}
                    </span>
                    <span className="font-display font-extrabold text-navy">{naira(order.priceKobo)}</span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
