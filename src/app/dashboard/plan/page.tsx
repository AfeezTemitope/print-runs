import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getMyShop } from '@/lib/auth';
import { naira, shortDate } from '@/lib/format';
import { getTierConfig } from '@/lib/tier-config';
import {
  effectiveTier, needsRenewalNotice, daysUntil, TIER_ORDER, INCLUDED_EVERYWHERE,
} from '@/lib/subscriptions';
import { PlanClient, type PlanRow } from './PlanClient';

export const metadata: Metadata = { title: 'Your plan' };

const PRIORITY_LABEL = ['Standard', 'Raised', 'Highest'];

export default async function PlanPage() {
  const shop = await getMyShop();
  if (!shop) redirect('/dashboard');

  const config = await getTierConfig();
  const current = effectiveTier(shop);
  const left = daysUntil(shop.subscriptionEndsAt);

  const plans: PlanRow[] = TIER_ORDER.map((key) => {
    const t = config[key];
    return {
      key,
      name: t.name,
      priceKobo: t.priceKobo,
      capLabel: t.orderCapKobo === null ? 'Unlimited' : naira(t.orderCapKobo),
      retentionLabel: `${t.fileRetentionDays} days`,
      priority: PRIORITY_LABEL[t.searchPriority] ?? 'Standard',
      materialAdvance: t.materialAdvance,
      dedicatedSupport: t.dedicatedSupport,
    };
  });

  return (
    <div>
      <h1 className="font-display text-3xl font-extrabold tracking-tight text-black">Your plan</h1>
      <p className="mt-2 max-w-2xl text-black/60">
        Every plan lets you sell, get verified and take orders. What changes is the size of job
        you can take through PrintRuns, how long we keep your files, and where you sit in search.
      </p>

      {/* The brief requires 7 days' notice before an auto-renewal. */}
      {needsRenewalNotice(shop.subscriptionEndsAt) && (
        <p className="mt-4 rounded-2xl border border-blue/30 bg-blue/5 px-4 py-3 text-[13px] text-navy">
          Your {config[current].name} plan renews in {left} day{left === 1 ? '' : 's'}
          {shop.subscriptionEndsAt ? ` on ${shortDate(shop.subscriptionEndsAt)}` : ''}.
          {shop.subscriptionAutoRenew ? ' It will renew automatically.' : ' Auto-renewal is off.'}
        </p>
      )}

      {current === 'free' && (
        <p className="mt-4 max-w-2xl rounded-2xl border border-black/12 bg-white px-4 py-3 text-[13px] text-black/70">
          You&apos;re on Free. You can take orders up to {naira(config.free.orderCapKobo ?? 0)} each —
          anything larger, a customer is asked to request a quote instead.
        </p>
      )}

      <PlanClient
        plans={plans}
        current={current}
        endsAt={shop.subscriptionEndsAt ? shortDate(shop.subscriptionEndsAt) : null}
        included={[...INCLUDED_EVERYWHERE]}
      />
    </div>
  );
}
