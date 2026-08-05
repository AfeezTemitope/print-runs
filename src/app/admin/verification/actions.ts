'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db, tables } from '@/db';
import { getSession } from '@/lib/auth';

export async function reviewVerification(id: string, decision: 'verified' | 'rejected') {
  const session = await getSession();
  if (!session || session.role !== 'admin') return { error: 'Not allowed.' };

  await db().update(tables.shopCategoryVerifications)
    .set({ status: decision, reviewedAt: new Date() })
    .where(eq(tables.shopCategoryVerifications.id, id));

  // Approving a category makes that shop visible to customers immediately, so every
  // customer-facing surface that filters on verification is invalidated.
  revalidatePath('/admin/verification');
  revalidatePath('/dashboard/verification');
  revalidatePath('/printers');
  return { ok: true } as const;
}
