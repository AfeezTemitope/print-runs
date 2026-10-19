import type { Metadata } from 'next';
import { count, eq } from 'drizzle-orm';
import { db, tables } from '@/db';
import { getTierConfig } from '@/lib/tier-config';
import { TIER_ORDER } from '@/lib/subscriptions';
import { PlanEditor, type EditableTier } from './PlanEditor';

export const metadata: Metadata = { title: 'Plans' };

export default async function AdminPlansPage() {
  const config = await getTierConfig();

  const counts = await Promise.all(
    TIER_ORDER.map(async (key) => {
      const [row] = await db().select({ c: count() }).from(tables.shops)
        .where(eq(tables.shops.subscriptionTier, key));
      return Number(row.c);
    }),
  );

  const tiers: EditableTier[] = TIER_ORDER.map((key, i) => {
    const t = config[key];
    return {
      key,
      name: t.name,
      price: String(t.priceKobo / 100),
      cap: t.orderCapKobo === null ? 'unlimited' : String(t.orderCapKobo / 100),
      retention: String(t.fileRetentionDays),
      shops: counts[i],
    };
  });

  return (
    <div>
      <h1 className="font-display text-3xl font-extrabold tracking-tight text-black">Plans</h1>
      <p className="mt-2 max-w-2xl text-black/60">
        Prices, order caps and file retention for each vendor tier. Changes take effect on the
        next page load — existing paid subscriptions keep the dates they were sold on, so
        raising a price never retroactively charges anyone.
      </p>
      <PlanEditor tiers={tiers} />
    </div>
  );
}
