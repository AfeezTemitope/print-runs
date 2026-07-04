import type { Metadata } from 'next';
import Link from 'next/link';
import { and, desc, eq, sum, count } from 'drizzle-orm';
import { db, tables } from '@/db';
import { getMyShop } from '@/lib/auth';
import { getCategory } from '@/lib/categories';
import { naira, shortDate } from '@/lib/format';
import { EmptyState } from '@/components/ui/EmptyState';

export const metadata: Metadata = { title: 'Earnings' };

/** Screen 6 (spec §4): pricing quick-edit + payment history. Payouts proper come with Multi-Split. */
export default async function EarningsPage() {
  const shop = (await getMyShop())!;

  const [totals, paid, prods] = await Promise.all([
    db().select({ s: sum(tables.orders.priceKobo), c: count() }).from(tables.orders).where(and(
      eq(tables.orders.shopId, shop.id),
      eq(tables.orders.paymentStatus, 'paid'),
    )),
    db().select().from(tables.orders).where(and(
      eq(tables.orders.shopId, shop.id),
      eq(tables.orders.paymentStatus, 'paid'),
    )).orderBy(desc(tables.orders.createdAt)).limit(30),
    db().select().from(tables.products).where(eq(tables.products.shopId, shop.id)),
  ]);

  return (
    <div>
      <h1 className="font-display text-3xl font-extrabold tracking-tight text-black">Earnings</h1>

      <div className="mt-6 grid grid-cols-2 gap-3.5">
        <div className="rounded-2xl bg-navy p-5 text-white">
          <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-white/55">Total collected</p>
          <p className="mt-1.5 font-display text-2xl font-extrabold text-pale">{naira(Number(totals[0].s ?? 0))}</p>
        </div>
        <div className="rounded-2xl border border-black/12 bg-white p-5">
          <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-black/45">Paid orders</p>
          <p className="mt-1.5 font-display text-2xl font-extrabold text-navy">{totals[0].c}</p>
        </div>
      </div>
      <p className="mt-2.5 text-xs text-black/45">
        Automatic payouts (Paystack split) are on the roadmap — for now this shows what customers have paid.
      </p>

      <h2 className="mt-8 font-display text-lg font-extrabold text-navy">Your prices</h2>
      <ul className="mt-3 divide-y divide-dashed divide-black/15 rounded-2xl border border-black/12 bg-white">
        {prods.map((p) => (
          <li key={p.id} className="flex items-center justify-between px-5 py-3">
            <span className="font-display text-sm font-bold text-navy">{p.name}</span>
            <Link href={`/dashboard/products/${p.id}`} className="font-display text-sm font-bold text-blue">Edit pricing →</Link>
          </li>
        ))}
        {prods.length === 0 && <li className="px-5 py-4 text-sm text-black/50">No products yet.</li>}
      </ul>

      <h2 className="mt-8 font-display text-lg font-extrabold text-navy">Payment history</h2>
      {paid.length === 0 ? (
        <div className="mt-3"><EmptyState title="No payments yet" hint="Paid orders will list here." /></div>
      ) : (
        <ul className="mt-3 divide-y divide-dashed divide-black/15 rounded-2xl border border-black/12 bg-white">
          {paid.map((o) => (
            <li key={o.id} className="flex items-center justify-between px-5 py-3">
              <span className="text-sm text-black/60">
                <span className="font-mono font-bold text-navy">{o.code}</span> · {getCategory(o.spec.category)?.name} · {shortDate(o.createdAt)}
              </span>
              <span className="font-display text-sm font-extrabold text-success">+{naira(o.priceKobo)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
