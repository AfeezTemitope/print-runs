/**
 * Vendor subscription tiers (September brief).
 *
 * Three tiers, billed every two months. The values here are DEFAULTS only — every one of them
 * is overridable from platform_settings, because the brief is explicit that nothing may be
 * hardcoded. Changing a price or a cap must be a settings change, not a deploy.
 */

export type TierKey = 'free' | 'growth' | 'pro';

export type TierConfig = {
  key: TierKey;
  name: string;
  priceKobo: number;            // per 2-month cycle
  orderCapKobo: number | null;  // null = unlimited
  fileRetentionDays: number;
  searchPriority: number;       // higher sorts first
  materialAdvance: boolean;
  dedicatedSupport: boolean;
};

export const BILLING_CYCLE_DAYS = 60;
/** The brief requires 7 days' notice before an auto-renewal. */
export const RENEWAL_NOTICE_DAYS = 7;

export const DEFAULT_TIERS: Record<TierKey, TierConfig> = {
  free: {
    key: 'free', name: 'Free', priceKobo: 0,
    orderCapKobo: 2_000_000,       // ₦20,000
    fileRetentionDays: 2,
    searchPriority: 0,
    materialAdvance: false,
    dedicatedSupport: false,
  },
  growth: {
    key: 'growth', name: 'Growth', priceKobo: 750_000,   // ₦7,500
    orderCapKobo: 15_000_000,      // ₦150,000
    fileRetentionDays: 30,
    searchPriority: 1,
    materialAdvance: false,
    dedicatedSupport: false,
  },
  pro: {
    key: 'pro', name: 'Pro', priceKobo: 1_250_000,       // ₦12,500
    orderCapKobo: null,            // unlimited
    fileRetentionDays: 90,
    searchPriority: 2,
    materialAdvance: true,
    dedicatedSupport: true,
  },
};

export const TIER_ORDER: TierKey[] = ['free', 'growth', 'pro'];

/** Features every tier gets at launch, listed so the comparison table is honest about it. */
export const INCLUDED_EVERYWHERE = [
  'Verified badge eligible',
  'Invoice generator',
  'Storefront QR code',
];

export function isTierKey(value: string | null | undefined): value is TierKey {
  return value === 'free' || value === 'growth' || value === 'pro';
}

/**
 * A subscription that has run past its end date falls back to Free rather than being cut off.
 * A printer whose card failed should lose their higher cap, not their shop.
 */
export function effectiveTier(
  shop: { subscriptionTier: string | null; subscriptionEndsAt: Date | null },
  now: Date = new Date(),
): TierKey {
  if (!isTierKey(shop.subscriptionTier)) return 'free';
  if (shop.subscriptionTier === 'free') return 'free';
  if (!shop.subscriptionEndsAt || shop.subscriptionEndsAt < now) return 'free';
  return shop.subscriptionTier;
}

/**
 * Whether an order of this value may be placed with this printer.
 *
 * Checked against the PRINTER'S price, not the customer's total — the cap is about the size of
 * job a printer is cleared to take on, and PrintRuns' own margin should not push them over it.
 */
export function withinOrderCap(tier: TierConfig, printerBaseKobo: number): boolean {
  if (tier.orderCapKobo === null) return true;
  return printerBaseKobo <= tier.orderCapKobo;
}

/** Days until renewal, for the notice the brief requires. */
export function daysUntil(endsAt: Date | null, now: Date = new Date()): number | null {
  if (!endsAt) return null;
  return Math.ceil((endsAt.getTime() - now.getTime()) / 86_400_000);
}

export function needsRenewalNotice(endsAt: Date | null, now: Date = new Date()): boolean {
  const days = daysUntil(endsAt, now);
  return days !== null && days > 0 && days <= RENEWAL_NOTICE_DAYS;
}

/** The smallest tier that could take an order of this size — used to suggest an upgrade. */
export function tierNeededFor(printerBaseKobo: number, tiers: Record<TierKey, TierConfig>): TierKey {
  for (const key of TIER_ORDER) {
    if (withinOrderCap(tiers[key], printerBaseKobo)) return key;
  }
  return 'pro';
}
