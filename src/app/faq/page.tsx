import type { Metadata } from 'next';
import Link from 'next/link';
import { and, asc, eq } from 'drizzle-orm';
import { db, tables } from '@/db';

export const metadata: Metadata = {
  title: 'Frequently asked questions',
  description: 'How ordering, pricing, delivery and refunds work on PrintRuns.',
};

export default async function FaqPage() {
  let rows: { id: string; question: string; answer: string }[] = [];
  try {
    rows = await db().select({
      id: tables.faqEntries.id,
      question: tables.faqEntries.question,
      answer: tables.faqEntries.answer,
    })
      .from(tables.faqEntries)
      .where(eq(tables.faqEntries.isPublished, true))
      .orderBy(asc(tables.faqEntries.sortOrder));
  } catch {
    rows = [];
  }

  // FAQPage structured data — this is the one page type where it reliably earns richer
  // search results, and it costs nothing to emit alongside the visible answers.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: rows.map((r) => ({
      '@type': 'Question',
      name: r.question,
      acceptedAnswer: { '@type': 'Answer', text: r.answer },
    })),
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 md:py-14">
      {rows.length > 0 && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      )}

      <h1 className="font-display text-4xl font-extrabold tracking-tight text-black sm:text-5xl">
        Frequently asked <span className="text-blue">questions</span>
      </h1>

      {rows.length === 0 ? (
        <p className="mt-4 text-black/60">
          Nothing here yet. Email{' '}
          <a href="mailto:support@printruns.ng" className="font-semibold text-blue underline">support@printruns.ng</a>
          {' '}and we&apos;ll answer directly.
        </p>
      ) : (
        <ul className="mt-8 space-y-1">
          {rows.map((r) => (
            <li key={r.id}>
              <details className="group border-b border-dashed border-black/20 py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display text-[17px] font-extrabold text-navy">
                  {r.question}
                  <span aria-hidden className="text-blue transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-2.5 whitespace-pre-line text-[15px] leading-relaxed text-black/70">{r.answer}</p>
              </details>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-10 border-t border-dashed border-black/20 pt-5 text-[15px] text-black/60">
        Still stuck? Email{' '}
        <a href="mailto:support@printruns.ng" className="font-semibold text-blue underline">support@printruns.ng</a>
        {' '}or read the{' '}
        <Link href="/legal/refunds" className="font-semibold text-blue underline">Refund &amp; Cancellation Policy</Link>.
      </p>
    </div>
  );
}
