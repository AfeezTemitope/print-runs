'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db, tables } from '@/db';
import { getSession } from '@/lib/auth';

export async function reviewStudio(id: string, decision: 'verified' | 'rejected', note: string) {
  const session = await getSession();
  if (!session || session.role !== 'admin') return { error: 'Not allowed.' };
  // A rejection without a reason just gets resubmitted unchanged, so it is required here.
  if (decision === 'rejected' && note.trim().length < 5) {
    return { error: 'Say what needs fixing — a bare rejection just comes back unchanged.' };
  }

  await db().update(tables.designerStudios)
    .set({ verification: decision, verificationNote: note.trim() || null, reviewedAt: new Date() })
    .where(eq(tables.designerStudios.id, id));

  revalidatePath('/admin/designers');
  revalidatePath('/designers');
  revalidatePath('/studio');
  return { ok: true } as const;
}
