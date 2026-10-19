'use server';

import { revalidatePath } from 'next/cache';
import { db, tables } from '@/db';
import { getSession } from '@/lib/auth';
import { isTierKey, type TierKey } from '@/lib/subscriptions';
import { settingKey } from '@/lib/tier-config';

/**
 * Edit a tier's price, order cap or file retention (the brief: all tier values configurable,
 * nothing hardcoded). Each value is its own settings row, so one bad edit cannot take the
 * whole tier structure down.
 */
export async function saveTierSetting(tier: string, field: 'price_kobo' | 'cap_kobo' | 'retention_days', raw: string) {
  const session = await getSession();
  if (!session || session.role !== 'admin') return { error: 'Not allowed.' };
  if (!isTierKey(tier)) return { error: 'Unknown tier.' };

  const trimmed = raw.trim().toLowerCase();
  let value: number;

  if (field === 'cap_kobo' && (trimmed === '' || trimmed === 'unlimited')) {
    // The settings table stores integers only, so unlimited is -1 rather than null.
    value = -1;
  } else {
    const n = Number(trimmed);
    if (!Number.isFinite(n) || n < 0) return { error: 'Enter a number.' };
    // Prices and caps are entered in naira; retention is a plain day count.
    value = field === 'retention_days' ? Math.round(n) : Math.round(n * 100);
  }

  // Guard rails against a slipped decimal, which on a price would charge every printer wrongly.
  if (field === 'price_kobo' && value > 50_000_00) return { error: 'That price looks like a typo.' };
  if (field === 'retention_days' && value > 3650) return { error: 'That retention period looks like a typo.' };

  const row = { key: settingKey(tier as TierKey, field), valueKobo: value };
  await db().insert(tables.platformSettings).values(row)
    .onConflictDoUpdate({ target: tables.platformSettings.key, set: { valueKobo: value } });

  revalidatePath('/admin/plans');
  revalidatePath('/dashboard/plan');
  return { ok: true } as const;
}
