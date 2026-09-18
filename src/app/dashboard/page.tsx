import type { Metadata } from 'next';
import Link from 'next/link';
import { and, count, desc, eq, gte, inArray, sum } from 'drizzle-orm';
import { db, tables } from '@/db';
import { getMyShop } from '@/lib/auth';
import { categoryName } from '@/lib/catalog';
import { naira, shortDate } from '@/lib/format';
import { ButtonLink } from '@/components/ui/Button';
import { QUEUE_STATUSES, statusLabel } from '@/lib/status';
import { latestVerification, shouldNudgeTier2 } from '@/lib/trust';

export const metadata: Metadata = { title: 'Dashboard' };

/** Screen 2 (spec §4): stat cards + recent orders. */
export default async function DashboardPage() {
  const shop = (await getMyShop())!;
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);

  const [pending, week, listings, recent] = await Promise.all([
    db().select({ c: count() }).from(tables.orders).where(and(
      eq(tables.orders.shopId, shop.id),
      inArray(tables.orders.status, QUEUE_STATUSES),
    )),
    // A printer's earnings are their OWN base price — never the customer's selling price,
    // which carries PrintRuns' commercial margin on top (decision 1).
    db().select({ s: sum(tables.orders.printerBaseKobo) }).from(tables.orders).where(and(
      eq(tables.orders.shopId, shop.id),
      eq(tables.orders.paymentStatus, 'paid'),
      gte(tables.orders.createdAt, weekAgo),
    )),
    db().select({ c: count() }).from(tables.products).where(and(
      eq(tables.products.shopId, shop.id),
      eq(tables.products.isActive, true),
    )),
    db().select().from(tables.orders)
      .where(eq(tables.orders.shopId, shop.id))
      .orderBy(desc(tables.orders.createdAt)).limit(6),
  ]);

  const stats = [
    { label: 'Pending jobs', value: String(pending[0].c) },
    { label: 'This week', value: naira(Number(week[0].s ?? 0)) },
    { label: 'Rating', value: shop.ratingCount ? `${shop.ratingAvg.toFixed(1)} ★` : '—' },
    { label: 'Active listings', value: String(listings[0].c) },
  ];

  // §1.4: nudge toward Tier 2 without making it mandatory — persistent but not intrusive,
  // and only once they have been live long enough to have something to verify.
  const verification = await latestVerification(shop.id);
  const nudge = shouldNudgeTier2(shop, verification?.status === 'pending');

  return (
    <div>
      <h1 className="font-display text-3xl font-extrabold tracking-tight text-black">Overview</h1>

      {nudge && (
        <Link href="/dashboard/verify"
          className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue/30 bg-blue/5 px-5 py-4 transition-colors hover:border-blue">
          <div>
            <p className="font-display text-[15px] font-extrabold text-navy">
              Get Verified — earn more customer trust
            </p>
            <p className="mt-0.5 text-[13px] text-black/60">
              Verified printers stand out in search. Takes a couple of minutes.
            </p>
          </div>
          <span className="font-display text-[13px] font-bold text-blue">Start →</span>
        </Link>
      )}

      <dl className="mt-6 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-black/12 bg-white p-5">
            <dt className="font-mono text-[10px] font-bold uppercase tracking-widest text-black/45">{s.label}</dt>
            <dd className="mt-1.5 font-display text-2xl font-extrabold text-navy">{s.value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-8 flex items-center justify-between">
        <h2 className="font-display text-lg font-extrabold text-navy">Recent orders</h2>
        <Link href="/dashboard/orders" className="font-display text-sm font-bold text-blue">See all →</Link>
      </div>
      {recent.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-black/20 p-8 text-center">
          <p className="font-display font-bold text-navy">No orders yet</p>
          <p className="mt-1 text-sm text-black/55">List your products so customers nearby can find you.</p>
          <ButtonLink href="/dashboard/products/new" size="sm" className="mt-4">Add a product</ButtonLink>
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-dashed divide-black/15 rounded-2xl border border-black/12 bg-white">
          {recent.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5">
              <div>
                <p className="font-display text-sm font-extrabold text-navy">
                  {categoryName(o.spec.category) ?? o.spec.category}
                  <span className="ml-2 font-mono text-xs font-bold text-black/40">{o.code}</span>
                </p>
                <p className="text-xs text-black/50">
                  {shortDate(o.createdAt)} · {o.fulfillmentMethod === 'collection' ? 'collection' : 'delivery'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-navy/60">
                  {o.isQuote && o.paymentStatus === 'unpaid' ? 'quote' : statusLabel(o.status, o.fulfillmentMethod)}
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
