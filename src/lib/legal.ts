import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The four documents that together form the agreement with every user. Each one is a markdown
 * file under src/content/legal, so updating the text is a content edit rather than a code
 * change — and the version stamped here is what gets recorded against each order.
 */
export const LEGAL_VERSION = '1.0';
export const LEGAL_EFFECTIVE = '12 July 2026';

export const LEGAL_DOCS = [
  { slug: 'terms', file: 'terms.md', title: 'Terms & Conditions', short: 'Terms' },
  { slug: 'privacy', file: 'privacy.md', title: 'Privacy Policy', short: 'Privacy' },
  { slug: 'refunds', file: 'refunds.md', title: 'Refund & Cancellation Policy', short: 'Refunds' },
  { slug: 'acceptable-use', file: 'acceptable-use.md', title: 'Acceptable Use Policy', short: 'Acceptable use' },
] as const;

export type LegalSlug = (typeof LEGAL_DOCS)[number]['slug'];

export function getLegalDoc(slug: string) {
  return LEGAL_DOCS.find((d) => d.slug === slug);
}

export function readLegalDoc(file: string): string {
  return readFileSync(join(process.cwd(), 'src/content/legal', file), 'utf8');
}

/* ------------------------------------------------------------------ */
/* Minimal markdown rendering                                          */
/* ------------------------------------------------------------------ */

export type Block =
  | { type: 'h1' | 'h2' | 'h3' | 'p'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] };

/**
 * Deliberately tiny: these documents only ever use headings, paragraphs and lists, so pulling
 * in a markdown library would add a dependency and a parsing surface for no benefit.
 */
export function parseLegal(md: string): Block[] {
  const blocks: Block[] = [];
  let list: string[] | null = null;
  let listType: 'ul' | 'ol' = 'ul';

  const flush = () => {
    if (list?.length) blocks.push({ type: listType, items: list });
    list = null;
  };

  for (const raw of md.split('\n')) {
    const line = raw.trim();
    if (!line) { flush(); continue; }

    const bullet = line.match(/^-\s+(.*)$/);
    const numbered = line.match(/^\d+\.\s+(.*)$/);

    if (bullet || numbered) {
      const nextType = bullet ? 'ul' : 'ol';
      if (list && listType !== nextType) flush();
      listType = nextType;
      list ??= [];
      list.push((bullet ?? numbered)![1]);
      continue;
    }

    flush();
    if (line.startsWith('### ')) blocks.push({ type: 'h3', text: line.slice(4) });
    else if (line.startsWith('## ')) blocks.push({ type: 'h2', text: line.slice(3) });
    else if (line.startsWith('# ')) blocks.push({ type: 'h1', text: line.slice(2) });
    else blocks.push({ type: 'p', text: line });
  }
  flush();
  return blocks;
}

/** Only **bold** is used in these documents, so that is all that is supported. */
export function inlineSegments(text: string): { bold: boolean; text: string }[] {
  return text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part) =>
    part.startsWith('**') && part.endsWith('**')
      ? { bold: true, text: part.slice(2, -2) }
      : { bold: false, text: part },
  );
}
