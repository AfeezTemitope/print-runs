import type { Metadata } from 'next';
import { desc, eq } from 'drizzle-orm';
import { db, tables } from '@/db';
import { naira, shortDate } from '@/lib/format';
import { statusLabel } from '@/lib/status';
import { categoryName } from '@/lib/catalog';
import { specSummary } from '@/lib/spec';
import { CodeBadge } from '@/components/ui/CodeBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { OrderOps, type OpsOrder } from './OrderOps';

export const metadata: Metadata = { title: 'Orders' };

export default async function AdminOrdersPage() {
  const rows = await db()
    .select({ order: tables.orders, shop: tables.shops })
    .from(tables.orders)
    .leftJoin(tables.shops, eq(tables.orders.shopId, tables.shops.id))
    .orderBy(desc(tables.orders.createdAt))
    .limit(100);

  // Anything waiting on a phone call floats to the top — that is the whole job of this screen.
  const needsCall = (r: (typeof rows)[number]) =>
    r.order.fulfillmentMethod === 'delivery' && r.order.deliveryFeeStatus === 'quoted';
  const needsCollector = (r: (typeof rows)[number]) =>
    r.order.fulfillmentMethod === 'collection'
    && !r.order.collectionAuthorizedName
    && r.order.status !== 'delivered'
    && r.order.status !== 'cancelled';

  const sorted = [...rows].sort((a, b) => {
    const score = (r: (typeof rows)[number]) => (needsCall(r) ? 2 : needsCollector(r) ? 1 : 0);
    return score(b) - score(a);
  });
  const waiting = rows.filter((r) => needsCall(r) || needsCollector(r)).length;

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-black">Orders</h1>
        <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-black/45">
          {waiting > 0 ? `${waiting} waiting on you` : 'nothing waiting'}
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="No orders yet" hint="Orders appear here the moment a customer pays." />
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {sorted.map(({ order, shop }) => (
            <li
              key={order.id}
              className={`rounded-2xl border bg-white p-4 ${
                needsCall({ order, shop }) ? 'border-blue' : 'border-black/12'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <CodeBadge code={order.code} tone="light" />
                    <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-black/45">
                      {shortDate(order.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1 font-display font-extrabold text-navy">
                    {specSummary(order.spec).join(' · ')}
                  </p>
                  <p className="mt-0.5 text-xs text-black/55">
                    {shop?.businessName ?? 'Unassigned'} · {statusLabel(order.status, order.fulfillmentMethod)}
                    {order.fulfillmentMethod === 'collection' ? ' · Collection' : ''}
                  </p>
                  {order.deliveryAddress && (
                    <p className="mt-0.5 text-xs text-black/45">{order.deliveryAddress}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="font-display font-extrabold text-navy">{naira(order.amountPaidKobo)}</p>
                  <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-black/45">
                    {order.paymentStatus}
                    {order.refundAmountKobo ? ` · refund ${naira(order.refundAmountKobo)}` : ''}
                  </p>
                </div>
              </div>

              <OrderOps
                order={{
                  ...order,
                  shopName: shop?.businessName ?? 'The printer',
                } as OpsOrder}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
