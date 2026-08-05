'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db, tables } from '@/db';
import { getSession } from '@/lib/auth';

async function assertAdmin() {
  const session = await getSession();
  return session && session.role === 'admin' ? session : null;
}

function touched() {
  revalidatePath('/admin/faq');
  revalidatePath('/faq');
}

export async function saveFaq(input: {
  id?: string;
  question: string;
  answer: string;
  sortOrder: number;
  isPublished: boolean;
}) {
  if (!(await assertAdmin())) return { error: 'Not allowed.' };
  const question = input.question.trim();
  const answer = input.answer.trim();
  if (question.length < 5) return { error: 'Write the question out in full.' };
  if (answer.length < 5) return { error: 'The answer is empty.' };

  const values = {
    question,
    answer,
    sortOrder: Number.isFinite(input.sortOrder) ? input.sortOrder : 0,
    isPublished: input.isPublished,
    updatedAt: new Date(),
  };

  if (input.id) {
    await db().update(tables.faqEntries).set(values).where(eq(tables.faqEntries.id, input.id));
  } else {
    await db().insert(tables.faqEntries).values(values);
  }
  touched();
  return { ok: true } as const;
}

export async function deleteFaq(id: string) {
  if (!(await assertAdmin())) return { error: 'Not allowed.' };
  await db().delete(tables.faqEntries).where(eq(tables.faqEntries.id, id));
  touched();
  return { ok: true } as const;
}

/**
 * Unpublishing beats deleting for a question that is temporarily wrong — the wording is kept
 * so it can come back once operations settle, rather than being retyped from memory.
 */
export async function toggleFaq(id: string, isPublished: boolean) {
  if (!(await assertAdmin())) return { error: 'Not allowed.' };
  await db().update(tables.faqEntries)
    .set({ isPublished, updatedAt: new Date() })
    .where(eq(tables.faqEntries.id, id));
  touched();
  return { ok: true } as const;
}
