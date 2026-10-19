import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { desc, eq } from 'drizzle-orm';
import { db, tables } from '@/db';
import { getMyShop } from '@/lib/auth';
import { naira, shortDate } from '@/lib/format';
import { CodeBadge } from '@/components/ui/CodeBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { BankForm } from './BankForm';

export const metadata: Metadata = { title: 'Payouts' };

const STATE_LABEL: Record<string, { text: string; cls: string }> = {
  due: { text: 'On its way', cls: 'text-navy/60' },
  processing: { text: 'Sending', cls: 'text-blue' },
  paid: { text: 'Paid', cls: 'text-success' },
  failed: { text: 'Delayed — we\u2019re on it', cls: 'text-red' },
};

export default async function PayoutsPage() {
  const shop = await getMyShop();
  if (!shop) redirect('/dashboard');

  const rows = await db()
    .select({ payout: tables.payouts, order: tables.orders })
    .from(tables.payouts)
    .innerJoin(tables.orders, eq(tables.payouts.orderId, tables.orders.id))
    .where(eq(tables.payouts.shopId, shop.id))
    .orderBy(desc(tables.payouts.createdAt))
    .limit(100);

  const paidKobo = rows.filter((r) => r.payout.state === 'paid').reduce((t, r) => t + r.payout.amountKobo, 0);
  const pendingKobo = rows.filter((r) => r.payout.state !== 'paid').reduce((t, r) => t + r.payout.amountKobo, 0);

  return (
    <div>
      <h1 className="font-display text-3xl font-extrabold tracking-tight text-black">Payouts</h1>
      <p className="mt-2 max-w-2xl text-black/60">
        You&apos;re paid your full price for every job. The customer has 48 hours after delivery to
        report a problem; once that passes, your money is released to the account below.
      </p>

      <h2 className="mt-7 font-display text-lg font-extrabold text-navy">Where we pay you</h2>
      <div className="mt-3 max-w-xl">
        <BankForm current={shop.accountNumber && shop.bankVerifiedAt ? {
          bankName: shop.bankName ?? '',
          accountNumber: shop.accountNumber,
          accountName: shop.accountName ?? '',
        } : null} />
      </div>
      {!shop.bankVerifiedAt && (
        <p className="mt-2 max-w-xl text-[13px] text-red">
          Add your account — completed jobs can&apos;t be paid out until you do.
        </p>
      )}

      <div className="mt-7 grid max-w-xl gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-black/12 bg-white p-5">
          <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-black/45">Paid to you</p>
          <p className="mt-1 font-display text-2xl font-extrabold text-navy">{naira(paidKobo)}</p>
        </div>
        <div className="rounded-2xl border border-black/12 bg-white p-5">
          <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-black/45">On its way</p>
          <p className="mt-1 font-display text-2xl font-extrabold text-navy">{naira(pendingKobo)}</p>
        </div>
      </div>

      <h2 className="mt-7 font-display text-lg font-extrabold text-navy">History</h2>
      {!rows.length ? (
        <div className="mt-3"><EmptyState title="No payouts yet" hint="They appear here 48 hours after each job is delivered." /></div>
      ) : (
        <ul className="mt-3 space-y-2">
          {rows.map(({ payout, order }) => {
            const label = STATE_LABEL[payout.state];
            return (
              <li key={payout.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/12 bg-white px-4 py-3">
                <div>
                  <div className="flex items-center gap-2">
                    <CodeBadge code={order.code} tone="light" />
                    <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-black/45">
                      {payout.kind === 'advance' ? 'Material advance' : 'Settlement'} · {shortDate(payout.createdAt)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[13px] text-navy">{order.spec?.listingName ?? 'Order'}</p>
                </div>
                <div className="text-right">
                  <p className="font-display font-extrabold text-navy">{naira(payout.amountKobo)}</p>
                  <p className={`font-mono text-[10px] font-bold uppercase tracking-widest ${label.cls}`}>{label.text}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
