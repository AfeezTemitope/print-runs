import { cache } from 'react';
import { db, tables } from '@/db';
import type { MarginableProduct } from '@/lib/pricing';

export type CategoryMargin = MarginableProduct & { categorySlug: string };

/**
 * All configured margins in one query — one row per category, so a dozen rows forever.
 * Cached per request, since a printer-comparison page resolves this once per printer.
 */
export const getCategoryMargins = cache(async (): Promise<Record<string, MarginableProduct>> => {
  try {
    const rows = await db().select().from(tables.categoryMargins);
    return Object.fromEntries(rows.map((r) => [r.categorySlug, {
      marginType: r.marginType,
      marginFixedKobo: r.marginFixedKobo,
      marginPercentBps: r.marginPercentBps,
    }]));
  } catch {
    // Never take pricing down over a config table: every caller falls back to the product row.
    return {};
  }
});

/**
 * The margin that actually applies. Category config wins; the product's own stored margin is
 * the fallback, which keeps existing rows pricing exactly as they did before this table
 * existed. A category configured to zero is a real answer, not a missing one.
 */
export function marginFor(
  margins: Record<string, MarginableProduct>,
  categorySlug: string,
  product: MarginableProduct,
): MarginableProduct {
  return margins[categorySlug] ?? product;
}
