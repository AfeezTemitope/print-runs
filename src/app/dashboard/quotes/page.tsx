import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { db, tables } from '@/db';
import { getMyShop } from '@/lib/auth';
import { EmptyState } from '@/components/ui/EmptyState';
import { QuoteCard, type QuoteJob } from './QuoteCard';

export const metadata: Metadata = { title: 'Quote requests' };

export default async function QuotesPage() {
  const shop = await getMyShop();
  if (!shop) redirect('/dashboard');

  // Quote requests are unpaid orders: a real order that has no price yet.
  const rows = await db().select().from(tables.orders)
    .where(and(
      eq(tables.orders.shopId, shop.id),
      eq(tables.orders.paymentStatus, 'unpaid'),
      isNull(tables.orders.productId),
    ))
    .orderBy(desc(tables.orders.createdAt))
    .limit(100);

  const jobs: QuoteJob[] = rows.map((o) => ({
    id: o.id,
    code: o.code,
    createdAt: o.createdAt.toISOString(),
    listingName: o.spec?.listingName ?? 'Custom job',
    specLine: o.spec?.width && o.spec?.height
      ? `${o.spec.width} × ${o.spec.height} ${o.spec.unit ?? ''} × ${o.spec.qty ?? 1}`
      : `${(o.spec?.qty ?? 1).toLocaleString()} pcs`,
    note: o.spec?.printNote ?? null,
    contactEmail: o.contactEmail ?? '',
    contactPhone: o.contactPhonePrimary ?? '',
    designFileUrl: o.designFileUrl,
    quotedPriceKobo: o.quotedPriceKobo,
    quotedAt: o.quotedAt ? o.quotedAt.toISOString() : null,
    declined: Boolean(o.quoteDeclinedAt) || o.status === 'cancelled',
  }));

  const waiting = jobs.filter((j) => !j.quotedAt && !j.declined).length;

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-black">Quote requests</h1>
        <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-black/45">
          {waiting > 0 ? `${waiting} needing a price` : 'nothing waiting'}
        </p>
      </div>
      <p className="mt-2 max-w-2xl text-black/60">
        Custom jobs customers asked you to price — quantities above your tiers, odd sizes, anything
        your listings don&apos;t cover.
      </p>

      {!jobs.length ? (
        <div className="mt-6"><EmptyState title="No quote requests" hint="They appear here when a customer asks for a custom price." /></div>
      ) : (
        <ul className="mt-6 space-y-3">{jobs.map((j) => <QuoteCard key={j.id} job={j} />)}</ul>
      )}
    </div>
  );
}
