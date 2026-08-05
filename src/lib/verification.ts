import { cache } from 'react';
import { and, eq } from 'drizzle-orm';
import { db, tables } from '@/db';

export type VerificationStatus = 'pending' | 'verified' | 'rejected';

/**
 * Per-category printer verification (locked decision: online-only, work permit sufficient).
 * A shop may prepare products in any category, but customers only ever see the ones it has
 * been verified for — so an unverified printer can never take an order it isn't cleared for.
 */
export const getVerifiedPairs = cache(async (): Promise<Set<string>> => {
  try {
    const rows = await db().select().from(tables.shopCategoryVerifications)
      .where(eq(tables.shopCategoryVerifications.status, 'verified'));
    return new Set(rows.map((r) => `${r.shopId}:${r.categorySlug}`));
  } catch {
    return new Set();
  }
});

export function isVerified(pairs: Set<string>, shopId: string, categorySlug: string): boolean {
  return pairs.has(`${shopId}:${categorySlug}`);
}

/** Every verification row for one shop, for its own dashboard. */
export async function verificationsForShop(shopId: string) {
  return db().select().from(tables.shopCategoryVerifications)
    .where(eq(tables.shopCategoryVerifications.shopId, shopId));
}

export async function verificationFor(shopId: string, categorySlug: string) {
  const [row] = await db().select().from(tables.shopCategoryVerifications)
    .where(and(
      eq(tables.shopCategoryVerifications.shopId, shopId),
      eq(tables.shopCategoryVerifications.categorySlug, categorySlug),
    )).limit(1);
  return row ?? null;
}
