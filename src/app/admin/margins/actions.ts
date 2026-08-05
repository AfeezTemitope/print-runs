'use server';

import { revalidatePath } from 'next/cache';
import { db, tables } from '@/db';
import { getSession } from '@/lib/auth';
import { getCategory } from '@/lib/categories';

export async function saveCategoryMargin(
  categorySlug: string,
  marginType: 'fixed' | 'percent',
  value: string,
) {
  const session = await getSession();
  if (!session || session.role !== 'admin') return { error: 'Not allowed.' };
  if (!getCategory(categorySlug)?.live) return { error: 'Unknown category.' };

  const n = Number(value || 0);
  if (!Number.isFinite(n) || n < 0) return { error: 'Enter a number.' };

  // Guard rails, not policy: these catch a slipped decimal point, which on a percentage
  // margin would move every customer's price at once.
  if (marginType === 'percent' && n > 50) return { error: 'A margin over 50% is almost certainly a typo.' };
  if (marginType === 'fixed' && n > 100_000) return { error: 'That fixed margin looks like a typo.' };

  const row = {
    categorySlug,
    marginType,
    marginFixedKobo: marginType === 'fixed' ? Math.round(n * 100) : 0,
    marginPercentBps: marginType === 'percent' ? Math.round(n * 100) : 0,
    updatedAt: new Date(),
  };

  await db().insert(tables.categoryMargins).values(row)
    .onConflictDoUpdate({ target: tables.categoryMargins.categorySlug, set: row });

  // Margins move customer-facing prices, so every surface that shows one is invalidated.
  revalidatePath('/admin/margins');
  revalidatePath('/printers');
  revalidatePath('/checkout');
  return { ok: true } as const;
}
