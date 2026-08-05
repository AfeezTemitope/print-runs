import type { Metadata } from 'next';
import { asc } from 'drizzle-orm';
import { db, tables } from '@/db';
import { FaqEditor, type FaqRow } from './FaqEditor';

export const metadata: Metadata = { title: 'FAQ' };

export default async function AdminFaqPage() {
  const rows = await db().select().from(tables.faqEntries).orderBy(asc(tables.faqEntries.sortOrder));

  return (
    <div>
      <h1 className="font-display text-3xl font-extrabold tracking-tight text-black">FAQ</h1>
      <p className="mt-2 max-w-2xl text-black/60">
        Shown at /faq and answered in the customer&apos;s own words. Unpublish a question rather than
        deleting it if the answer is only temporarily wrong.
      </p>
      <FaqEditor rows={rows as FaqRow[]} />
    </div>
  );
}
