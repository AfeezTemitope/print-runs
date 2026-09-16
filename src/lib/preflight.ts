import { and, asc, desc, eq } from 'drizzle-orm';
import { db, tables } from '@/db';

/**
 * PrintRuns Preflight (Module 3).
 *
 * The question is narrow and deliberately not aesthetic: "is this file technically suitable
 * for production?" Built as a pipeline from the start (§8.3) so automated checks can be
 * dropped in later without touching the order flow:
 *
 *     upload → [automated checks] → [human review] → pass/fail → notify → status
 */

export type CheckKey = 'resolution' | 'colour_mode' | 'dimensions' | 'file_format' | 'readiness';

/** The V1 checklist (§4). All five are reviewed on every file, whatever the product. */
export const CHECKLIST: { key: CheckKey; label: string; reviews: string; examples: string }[] = [
  {
    key: 'resolution',
    label: 'Resolution / DPI',
    reviews: 'Is the file high enough resolution for the ordered print size?',
    examples: 'A 72 DPI screen image sent for a large banner; a compressed JPEG that has lost detail.',
  },
  {
    key: 'colour_mode',
    label: 'Colour mode',
    reviews: 'Is the file in CMYK rather than RGB?',
    examples: 'Designed in Canva or Photoshop in RGB; PNG exports from web tools are almost always RGB.',
  },
  {
    key: 'dimensions',
    label: 'File dimensions',
    reviews: 'Do the dimensions match the ordered size, within a reasonable tolerance?',
    examples: 'A 3×3in file for a 5×5in sticker order; a portrait file for a landscape banner.',
  },
  {
    key: 'file_format',
    label: 'File format',
    reviews: 'Is it a supported format (PDF, AI, CDR, PNG, JPG)?',
    examples: 'A DOCX or PPTX sent as a print file; a HEIC photo straight off an iPhone.',
  },
  {
    key: 'readiness',
    label: 'General print readiness',
    reviews: 'Is the file complete, uncorrupted and free of obvious technical errors?',
    examples: 'A blank or half-rendered file; a password-protected PDF; a file that will not open.',
  },
];

/**
 * Plain-language wording for a failed check, so the customer message does not depend on
 * whoever happened to review it. The reviewer's own note is appended where they add one.
 */
export const FAILURE_COPY: Record<CheckKey, string> = {
  resolution: 'Your file resolution is too low for the size you ordered — printed, it would look soft or pixelated.',
  colour_mode: 'Your file is in RGB colour mode. Print files need to be CMYK, or the colours will shift when printed.',
  dimensions: "Your file's dimensions don't match the size you ordered, so it would be stretched or cropped.",
  file_format: 'That file type cannot be printed from. Please send a PDF, AI, CDR, PNG or JPG.',
  readiness: 'We could not open or fully read your file — it may be corrupt, incomplete or password-protected.',
};

export type AutoResult =
  | { decided: false }
  | { decided: true; status: 'passed' | 'failed'; findings: { check: string; note: string }[] };

/**
 * The automated checks module (§8.3). Intentionally empty in V1: it always declines to decide,
 * so every file goes to a human. When real tooling lands it returns a decision here and the
 * rest of the pipeline is unchanged — a clear pass can then skip human review entirely.
 */
export async function runAutomatedChecks(_input: {
  fileUrl: string;
  fileName: string | null;
  widthIn?: number;
  heightIn?: number;
}): Promise<AutoResult> {
  return { decided: false };
}

/** Open a review round. Round numbers continue across resubmissions (§6.3). */
export async function submitForReview(orderId: string, fileUrl: string, fileName: string | null) {
  const prior = await db().select().from(tables.preflightReviews)
    .where(eq(tables.preflightReviews.orderId, orderId));

  const auto = await runAutomatedChecks({ fileUrl, fileName });

  const [row] = await db().insert(tables.preflightReviews).values({
    orderId,
    round: prior.length + 1,
    fileUrl,
    fileName,
    status: auto.decided ? auto.status : 'pending',
    findings: auto.decided ? auto.findings : [],
    decidedBy: auto.decided ? 'auto' : null,
    decidedAt: auto.decided ? new Date() : null,
  }).returning();

  return row;
}

export async function latestReview(orderId: string) {
  const [row] = await db().select().from(tables.preflightReviews)
    .where(eq(tables.preflightReviews.orderId, orderId))
    .orderBy(desc(tables.preflightReviews.round)).limit(1);
  return row ?? null;
}

export async function reviewsFor(orderId: string) {
  return db().select().from(tables.preflightReviews)
    .where(eq(tables.preflightReviews.orderId, orderId))
    .orderBy(asc(tables.preflightReviews.round));
}

export async function pendingQueue() {
  return db()
    .select({ review: tables.preflightReviews, order: tables.orders, shop: tables.shops })
    .from(tables.preflightReviews)
    .innerJoin(tables.orders, eq(tables.preflightReviews.orderId, tables.orders.id))
    .leftJoin(tables.shops, eq(tables.orders.shopId, tables.shops.id))
    .where(eq(tables.preflightReviews.status, 'pending'))
    .orderBy(asc(tables.preflightReviews.submittedAt));
}

/**
 * A paused order is invisible to its printer. Enforced in the query that builds the printer's
 * queue AND asserted here, so the rule has one name rather than being an easily-dropped
 * where-clause somewhere in a page component.
 */
export function visibleToPrinter(order: { status: string }): boolean {
  return order.status !== 'paused';
}
