import type { Metadata } from 'next';
import Link from 'next/link';
import { and, count, desc, eq, gte, inArray, isNotNull, isNull, sum } from 'drizzle-orm';
import { db, tables } from '@/db';
import { naira, shortDate } from '@/lib/format';
import { BROWSABLE_CATEGORIES } from '@/lib/catalog';
import { getCatalogPhotos, photoKey } from '@/lib/photos';
import { CodeBadge } from '@/components/ui/CodeBadge';

export const metadata: Metadata = { title: 'Dashboard' };

const startOf = (days: number) => new Date(Date.now() - days * 86_400_000);

/**
 * Admin home (brief item #13).
 *
 * Previously this showed platform settings, and an admin logging in landed on the customer
 * homepage — so there was nowhere to see how the business was actually doing. This is the
 * operational picture: what came in, what is stuck, and what is waiting on a human.
 */
export default async function AdminHome() {
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const [
    ordersToday, ordersWeek, ordersMonth,
    byStatus, printersTotal, printersVerified, printersActive,
    customers, feeMonth, preflightQueue, openDisputes, quotesWaiting, recentOrders, photos,
  ] = await Promise.all([
    db().select({ c: count() }).from(tables.orders).where(gte(tables.orders.createdAt, today)),
    db().select({ c: count() }).from(tables.orders).where(gte(tables.orders.createdAt, startOf(7))),
    db().select({ c: count() }).from(tables.orders).where(gte(tables.orders.createdAt, startOf(30))),
    db().select({ status: tables.orders.status, c: count() }).from(tables.orders).groupBy(tables.orders.status),
    db().select({ c: count() }).from(tables.shops),
    db().select({ c: count() }).from(tables.shops).where(eq(tables.shops.verificationTier, 2)),
    db().select({ c: count() }).from(tables.listings).where(eq(tables.listings.isActive, true)),
    db().select({ c: count() }).from(tables.users).where(eq(tables.users.role, 'customer')),
    // Revenue = what PrintRuns actually keeps: the platform fee plus the commercial margin,
    // on paid orders only. An unpaid quote request is not revenue.
    db().select({ fee: sum(tables.orders.platformFeeKobo), margin: sum(tables.orders.marginKobo) })
      .from(tables.orders)
      .where(and(eq(tables.orders.paymentStatus, 'paid'), gte(tables.orders.createdAt, startOf(30)))),
    db().select({ c: count() }).from(tables.preflightReviews).where(eq(tables.preflightReviews.status, 'pending')),
    db().select({ c: count() }).from(tables.disputes).where(isNull(tables.disputes.decidedAt)),
    db().select({ c: count() }).from(tables.orders)
      .where(and(eq(tables.orders.paymentStatus, 'unpaid'), isNull(tables.orders.quotedAt), isNotNull(tables.orders.listingId))),
    db().select({ order: tables.orders, shop: tables.shops })
      .from(tables.orders)
      .leftJoin(tables.shops, eq(tables.orders.shopId, tables.shops.id))
      .orderBy(desc(tables.orders.createdAt)).limit(6),
    getCatalogPhotos(),
  ]);

  const statusCount = (keys: string[]) =>
    byStatus.filter((r) => keys.includes(r.status)).reduce((t, r) => t + Number(r.c), 0);

  const revenueKobo = Number(feeMonth[0]?.fee ?? 0) + Number(feeMonth[0]?.margin ?? 0);
  const photosFilled = BROWSABLE_CATEGORIES.filter((c) => photos[photoKey(c.slug)]).length;

  const STATS = [
    { label: 'Orders today', value: String(ordersToday[0].c) },
    { label: 'This week', value: String(ordersWeek[0].c) },
    { label: 'This month', value: String(ordersMonth[0].c) },
    { label: 'Revenue this month', value: naira(revenueKobo), hint: 'platform fees + margin, paid orders' },
  ];

  const PIPELINE = [
    { label: 'Awaiting file review', value: statusCount(['paused']) },
    { label: 'In production', value: statusCount(['order_received', 'printer_assigned', 'printing_in_progress', 'printing_completed']) },
    { label: 'Out for delivery', value: statusCount(['ready_for_dispatch', 'out_for_delivery']) },
    { label: 'Delivered', value: statusCount(['delivered']) },
    { label: 'Cancelled', value: statusCount(['cancelled']) },
  ];

  // Anything with a number against it is waiting on a person, not on the system.
  const ACTIONS = [
    { label: 'Files to review', value: Number(preflightQueue[0].c), href: '/admin/preflight' },
    { label: 'Open disputes', value: Number(openDisputes[0].c), href: '/admin/disputes' },
    { label: 'Quotes not yet priced', value: Number(quotesWaiting[0].c), href: '/admin/orders' },
    { label: 'Categories without a photo', value: BROWSABLE_CATEGORIES.length - photosFilled, href: '/admin/photos' },
  ];

  return (
    <div>
      <h1 className="font-display text-3xl font-extrabold tracking-tight text-black">Dashboard</h1>
      <p className="mt-2 text-black/60">How PrintRuns is running right now.</p>

      <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {STATS.map((s) => (
          <li key={s.label} className="rounded-2xl border border-black/12 bg-white p-5">
            <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-black/45">{s.label}</p>
            <p className="mt-1 font-display text-2xl font-extrabold text-navy">{s.value}</p>
            {s.hint && <p className="mt-0.5 text-[11px] text-black/45">{s.hint}</p>}
          </li>
        ))}
      </ul>

      <h2 className="mt-8 font-display text-lg font-extrabold text-navy">Needs you</h2>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {ACTIONS.map((a) => (
          <li key={a.label}>
            <Link href={a.href}
              className={`block rounded-2xl border p-5 transition-colors ${
                a.value > 0 ? 'border-blue bg-blue/5 hover:border-navy' : 'border-black/12 bg-white hover:border-blue'
              }`}>
              <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-black/45">{a.label}</p>
              <p className={`mt-1 font-display text-2xl font-extrabold ${a.value > 0 ? 'text-blue' : 'text-navy/40'}`}>
                {a.value}
              </p>
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="font-display text-lg font-extrabold text-navy">Orders by stage</h2>
          <ul className="mt-3 overflow-hidden rounded-2xl border border-black/12 bg-white">
            {PIPELINE.map((p) => (
              <li key={p.label} className="flex items-center justify-between border-b border-black/8 px-4 py-3 last:border-0">
                <span className="text-[14px] text-navy">{p.label}</span>
                <span className="font-display font-extrabold text-navy">{p.value}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="font-display text-lg font-extrabold text-navy">People</h2>
          <ul className="mt-3 overflow-hidden rounded-2xl border border-black/12 bg-white">
            {[
              ['Printers registered', String(printersTotal[0].c)],
              ['Printers verified', String(printersVerified[0].c)],
              ['Live listings', String(printersActive[0].c)],
              ['Customers registered', String(customers[0].c)],
            ].map(([label, value]) => (
              <li key={label} className="flex items-center justify-between border-b border-black/8 px-4 py-3 last:border-0">
                <span className="text-[14px] text-navy">{label}</span>
                <span className="font-display font-extrabold text-navy">{value}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <h2 className="mt-8 font-display text-lg font-extrabold text-navy">Latest orders</h2>
      {!recentOrders.length ? (
        <p className="mt-3 rounded-2xl border border-dashed border-black/20 bg-white/60 px-5 py-8 text-center text-black/55">
          No orders yet.
        </p>
      ) : (
        <ul className="mt-3 overflow-hidden rounded-2xl border border-black/12 bg-white">
          {recentOrders.map(({ order, shop }) => (
            <li key={order.id}>
              <Link href="/admin/orders" className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-pale/20">
                <div className="flex items-center gap-2.5">
                  <CodeBadge code={order.code} tone="light" />
                  <span className="text-[14px] text-navy">{order.spec?.listingName ?? 'Order'}</span>
                  <span className="text-xs text-black/45">{shop?.businessName ?? '—'}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-black/45">
                    {shortDate(order.createdAt)}
                  </span>
                  <span className="font-display font-extrabold text-navy">{naira(order.amountPaidKobo)}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
