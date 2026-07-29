import type { Metadata } from 'next';
import { and, desc, eq, ne } from 'drizzle-orm';
import { db, tables } from '@/db';
import { getSession } from '@/lib/auth';
import { getCategory } from '@/lib/categories';
import { StatusTracker } from '@/components/ui/StatusTracker';
import { CodeBadge } from '@/components/ui/CodeBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ButtonLink } from '@/components/ui/Button';
import { naira, shortDate } from '@/lib/format';

export const metadata: Metadata = { title: 'Track order' };
export const dynamic = 'force-dynamic';

/**
 * Screen 7 (spec §3): reads the exact status field the printer's queue
 * buttons write — built once, displayed twice (here and in history).
 */
export default async function TrackPage() {
  const session = (await getSession())!; // middleware guarantees it
  const active = await db().select({
    order: tables.orders,
    shopName: tables.shops.businessName,
    shopCode: tables.shops.code,
  })
    .from(tables.orders)
    .innerJoin(tables.shops, eq(tables.orders.shopId, tables.shops.id))
    .where(and(
      eq(tables.orders.customerId, session.uid),
      ne(tables.orders.status, 'delivered'),
      ne(tables.orders.status, 'cancelled'),
    ))
    .orderBy(desc(tables.orders.createdAt));

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-4xl font-extrabold tracking-tight text-black">
        Track <span className="text-blue">order</span>
      </h1>
      <p className="mt-2 text-black/60">Live status straight from the printer&apos;s bench.</p>

      {active.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="Nothing in production right now"
            hint="Start a print job and it shows up here the moment it's paid."
            action={<ButtonLink href="/products">Start printing</ButtonLink>}
          />
        </div>
      ) : (
        <ul className="mt-8 space-y-4">
          {active.map(({ order, shopName, shopCode }) => (
            <li key={order.id} className="rounded-2xl border border-black/12 bg-white p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-xs font-bold text-navy">{order.code}</span>
                  <CodeBadge code={shopCode} tone="light" />
                </div>
                <span className="text-[13px] text-black/50">
                  {getCategory(order.spec.category)?.name} · {shopName} · {shortDate(order.createdAt)}
                </span>
              </div>
              {order.isQuote && order.paymentStatus === 'unpaid' ? (
                <p className="mt-4 rounded-xl bg-pale/40 px-4 py-3 font-mono text-[11px] font-bold uppercase tracking-widest text-navy">
                  Quote requested — waiting on the printer
                </p>
              ) : (
                <div className="mt-5"><StatusTracker status={order.status} method={order.fulfillmentMethod} /></div>
              )}
              {order.fulfillmentMethod === 'delivery' && order.deliveryFeeKobo == null && !order.isQuote && (
                <p className="mt-4 rounded-xl bg-pale/40 px-4 py-3 text-[13px] leading-relaxed text-navy">
                  A PrintRuns representative will contact you to confirm your delivery details.
                  The delivery fee is charged separately from the amount above.
                </p>
              )}
              {order.deliveryFeeKobo != null && (
                <p className="mt-4 flex items-center justify-between rounded-xl bg-pale/40 px-4 py-3 text-[13px] text-navy">
                  <span>Delivery fee (paid separately)</span>
                  <span className="font-display font-extrabold">{naira(order.deliveryFeeKobo)}</span>
                </p>
              )}
              <div className="mt-4 flex items-center justify-between border-t border-dashed border-black/25 pt-3.5 text-sm">
                <span className="text-black/55">
                  {order.fulfillmentMethod === 'collection' ? 'You are collecting' : 'Delivery'}
                </span>
                <span className="font-display font-extrabold text-navy">{naira(order.amountPaidKobo)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
