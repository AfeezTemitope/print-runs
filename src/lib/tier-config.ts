import { cache } from 'react';
import { db, tables } from '@/db';
import { DEFAULT_TIERS, TIER_ORDER, type TierConfig, type TierKey } from '@/lib/subscriptions';

/**
 * Live tier configuration, read from platform_settings so every value is editable from admin
 * (the brief: "All tier values are configurable from the admin dashboard. Do not hardcode.").
 *
 * Settings keys are flat — tier_growth_price_kobo, tier_free_cap_kobo and so on — rather than
 * a JSON blob, so a single value can be changed without rewriting the whole object and
 * without risking a malformed edit taking all three tiers down.
 */
export const settingKey = (tier: TierKey, field: string) => `tier_${tier}_${field}`;

export const getTierConfig = cache(async (): Promise<Record<TierKey, TierConfig>> => {
  const out = {
    free: { ...DEFAULT_TIERS.free },
    growth: { ...DEFAULT_TIERS.growth },
    pro: { ...DEFAULT_TIERS.pro },
  };

  try {
    const rows = await db().select().from(tables.platformSettings);
    const map = new Map(rows.map((r) => [r.key, r.valueKobo]));

    for (const tier of TIER_ORDER) {
      const price = map.get(settingKey(tier, 'price_kobo'));
      if (price !== undefined) out[tier].priceKobo = price;

      const cap = map.get(settingKey(tier, 'cap_kobo'));
      // -1 is how "unlimited" is stored, since the settings table holds integers only.
      if (cap !== undefined) out[tier].orderCapKobo = cap < 0 ? null : cap;

      const retention = map.get(settingKey(tier, 'retention_days'));
      if (retention !== undefined) out[tier].fileRetentionDays = retention;
    }
  } catch {
    // A missing settings table must never take pricing down — defaults stand.
  }

  return out;
});
