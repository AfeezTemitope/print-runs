import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db, tables } from '@/db';
import { getSession } from '@/lib/auth';
import { getPlatformFeeKobo } from '@/lib/pricing';
import { computeDesignTotals } from '@/lib/design-orders';
import { BookClient } from './BookClient';

export const metadata: Metadata = { title: 'Book a designer' };

export default async function BookPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { service } = await searchParams;
  if (!service) notFound();

  const session = await getSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(`/design/book?service=${service}`)}`);

  const [row] = await db().select().from(tables.designerServices)
    .where(eq(tables.designerServices.id, service)).limit(1);
  if (!row?.isActive) notFound();

  const [studio] = await db().select().from(tables.designerStudios)
    .where(eq(tables.designerStudios.id, row.studioId)).limit(1);
  if (!studio || studio.verification !== 'verified' || !studio.isActive) notFound();

  const platformFeeKobo = await getPlatformFeeKobo((key) =>
    db().select().from(tables.platformSettings).where(eq(tables.platformSettings.key, key)).limit(1)
      .then((rows) => rows[0]),
  );
  const totals = computeDesignTotals(row.priceKobo, platformFeeKobo);
  // Prefill the email from the account so the customer isn't retyping it at the last step.
  const [account] = await db().select({ email: tables.users.email }).from(tables.users)
    .where(eq(tables.users.id, session.uid)).limit(1);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="mb-1 font-display text-3xl font-extrabold tracking-tight text-black">Book {studio.displayName}</h1>
      <p className="mb-7 text-black/60">Tell them what you need, then pay to start the job.</p>
      <BookClient
        serviceId={row.id}
        studioName={studio.displayName}
        serviceTitle={row.title}
        priceKobo={totals.designerBaseKobo}
        marginKobo={totals.marginKobo}
        platformFeeKobo={totals.platformFeeKobo}
        totalKobo={totals.amountPaidKobo}
        revisionsIncluded={row.revisionsIncluded}
        extraRevisionKobo={row.extraRevisionKobo}
        turnaroundHours={row.turnaroundHours}
        defaultEmail={account?.email ?? ''}
      />
    </div>
  );
}
