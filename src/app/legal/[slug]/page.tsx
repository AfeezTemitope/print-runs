import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  LEGAL_DOCS, LEGAL_VERSION, LEGAL_EFFECTIVE,
  getLegalDoc, readLegalDoc, parseLegal, inlineSegments,
} from '@/lib/legal';

export function generateStaticParams() {
  return LEGAL_DOCS.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const doc = getLegalDoc((await params).slug);
  if (!doc) return {};
  return {
    title: doc.title,
    description: `${doc.title} for PrintRuns — version ${LEGAL_VERSION}, effective ${LEGAL_EFFECTIVE}.`,
  };
}

function Inline({ text }: { text: string }) {
  return (
    <>
      {inlineSegments(text).map((s, i) =>
        s.bold ? <strong key={i} className="font-semibold text-navy">{s.text}</strong> : <span key={i}>{s.text}</span>,
      )}
    </>
  );
}

export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const doc = getLegalDoc((await params).slug);
  if (!doc) notFound();

  const blocks = parseLegal(readLegalDoc(doc.file));

  return (
    <article className="pb-10">
      {blocks.map((b, i) => {
        switch (b.type) {
          case 'h1':
            return (
              <header key={i} className="mb-7">
                <h1 className="font-display text-4xl font-extrabold tracking-tight text-black">{b.text}</h1>
                <p className="mt-1.5 font-mono text-[11px] font-bold uppercase tracking-widest text-black/45">
                  Version {LEGAL_VERSION} · Effective {LEGAL_EFFECTIVE}
                </p>
              </header>
            );
          case 'h2':
            return (
              <h2 key={i} className="mt-8 mb-2.5 font-display text-xl font-extrabold tracking-tight text-blue">
                {b.text}
              </h2>
            );
          case 'h3':
            return (
              <h3 key={i} className="mt-5 mb-2 font-display text-[15px] font-extrabold text-navy">{b.text}</h3>
            );
          case 'ul':
            return (
              <ul key={i} className="mb-3.5 ml-1 space-y-1.5">
                {b.items.map((it, j) => (
                  <li key={j} className="flex gap-2.5 text-[15px] leading-relaxed text-black/75">
                    <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-pill bg-blue" />
                    <span><Inline text={it} /></span>
                  </li>
                ))}
              </ul>
            );
          case 'ol':
            return (
              <ol key={i} className="mb-3.5 ml-1 space-y-1.5">
                {b.items.map((it, j) => (
                  <li key={j} className="flex gap-2.5 text-[15px] leading-relaxed text-black/75">
                    <span aria-hidden className="font-mono text-[13px] font-bold text-blue">{j + 1}.</span>
                    <span><Inline text={it} /></span>
                  </li>
                ))}
              </ol>
            );
          default:
            return (
              <p key={i} className="mb-3.5 text-[15px] leading-relaxed text-black/75"><Inline text={b.text} /></p>
            );
        }
      })}
    </article>
  );
}
