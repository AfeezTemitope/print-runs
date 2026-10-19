import type { Metadata } from 'next';
import { desc, eq } from 'drizzle-orm';
import { db, tables } from '@/db';
import { naira, shortDate } from '@/lib/format';
import { transfersEnabled } from '@/lib/paystack';
import { CodeBadge } from '@/components/ui/CodeBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ReleaseButton, SettleNowButton } from './PayoutActions';

export const metadata: Metadata = { title: 'Payouts' };

export default async function AdminPayoutsPage() {
  const auto = transfersEnabled();

  const rows = await db()
    .select({ payout: tables.payouts, order: tables.orders, shop: tables.shops })
    .from(tables.payouts)
    .innerJoin(tables.orders, eq(tables.payouts.orderId, tables.orders.id))
    .innerJoin(tables.shops, eq(tables.payouts.shopId, tables.shops.id))
    .orderBy(desc(tables.payouts.createdAt))
    .limit(200);

  // Advances first — a Pro printer is waiting on materials money to start the job.
  const rank = (state: string, kind: string) =>
    state === 'failed' ? 0 : state === 'due' && kind === 'advance' ? 1 : state === 'due' ? 2 : state === 'processing' ? 3 : 4;
  const sorted = [...rows].sort((a, b) => rank(a.payout.state, a.payout.kind) - rank(b.payout.state, b.payout.kind));

  const dueKobo = rows.filter((r) => r.payout.state === 'due').reduce((t, r) => t + r.payout.amountKobo, 0);
  const failed = rows.filter((r) => r.payout.state === 'failed').length;

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-black">Payouts</h1>
        <SettleNowButton />
      </div>

      <div className={`mt-4 rounded-2xl border px-4 py-3 text-[13px] ${auto ? 'border-success/40 bg-success/5' : 'border-blue/30 bg-blue/5'} text-navy`}>
        {auto ? (
          <>
            <strong>Automatic transfers are ON.</strong> Settlements go to printers through Paystack
            each morning. A payout is only marked paid once Paystack confirms the money arrived.
          </>
        ) : (
          <>
            <strong>Automatic transfers are OFF.</strong> Settlements are worked out for you each
            morning, but you send the money yourself and mark each one paid here. Set
            <code className="mx-1 rounded bg-white px-1">PAYSTACK_TRANSFERS_ENABLED=true</code>
            once Paystack Transfers is approved on your account.
          </>
        )}
      </div>

      <div className="mt-4 grid max-w-xl gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-black/12 bg-white p-5">
          <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-black/45">Owed to printers</p>
          <p className="mt-1 font-display text-2xl font-extrabold text-navy">{naira(dueKobo)}</p>
        </div>
        <div className={`rounded-2xl border p-5 ${failed > 0 ? 'border-red bg-red/5' : 'border-black/12 bg-white'}`}>
          <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-black/45">Failed</p>
          <p className={`mt-1 font-display text-2xl font-extrabold ${failed > 0 ? 'text-red' : 'text-navy'}`}>{failed}</p>
        </div>
      </div>

      {!rows.length ? (
        <div className="mt-6"><EmptyState title="No payouts yet" hint="They're created 48 hours after each delivery." /></div>
      ) : (
        <ul className="mt-6 space-y-2">
          {sorted.map(({ payout, order, shop }) => (
            <li key={payout.id} className={`rounded-xl border bg-white px-4 py-3 ${
              payout.state === 'failed' ? 'border-red' : payout.kind === 'advance' && payout.state === 'due' ? 'border-blue' : 'border-black/12'
            }`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <CodeBadge code={order.code} tone="light" />
                    <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-black/45">
                      {payout.kind === 'advance' ? '50% advance' : 'Settlement'} · {shortDate(payout.createdAt)}
                    </span>
                  </div>
                  <p className="mt-0.5 font-display text-[14px] font-extrabold text-navy">{shop.businessName}</p>
                  <p className="text-xs text-black/50">
                    {shop.bankVerifiedAt
                      ? `${shop.accountName} · ${shop.bankName} · ${shop.accountNumber}`
                      : 'No verified bank account yet'}
                  </p>
                  {payout.failureReason && <p className="mt-1 text-xs font-semibold text-red">{payout.failureReason}</p>}
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-display font-extrabold text-navy">{naira(payout.amountKobo)}</p>
                    <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-black/45">
                      {payout.state}{payout.paidBy ? ` · ${payout.paidBy}` : ''}
                    </p>
                  </div>
                  <ReleaseButton id={payout.id} state={payout.state} auto={auto} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
