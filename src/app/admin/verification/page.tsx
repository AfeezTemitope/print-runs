import type { Metadata } from 'next';
import Link from 'next/link';
import { desc, eq } from 'drizzle-orm';
import { db, tables } from '@/db';
import { shortDate } from '@/lib/format';
import { CodeBadge } from '@/components/ui/CodeBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ReviewSubmission } from './ReviewSubmission';

export const metadata: Metadata = { title: 'Verification' };

/**
 * Tier 2 review (Module 4 §1.2).
 *
 * This replaces the per-category verification screen, which was retired when verification
 * became a property of the business rather than of each category. Tier 1 needs no screen —
 * it is auto-approved at signup and never reaches a queue.
 */
export default async function AdminVerificationPage() {
  const rows = await db()
    .select({ sub: tables.verificationSubmissions, shop: tables.shops })
    .from(tables.verificationSubmissions)
    .leftJoin(tables.shops, eq(tables.verificationSubmissions.shopId, tables.shops.id))
    .orderBy(desc(tables.verificationSubmissions.submittedAt))
    .limit(100);

  const pending = rows.filter((r) => r.sub.status === 'pending');
  const reviewed = rows.filter((r) => r.sub.status !== 'pending');

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-black">Verification</h1>
        <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-black/45">
          {pending.length > 0 ? `${pending.length} awaiting review` : 'nothing awaiting review'}
        </p>
      </div>
      <p className="mt-2 max-w-2xl text-black/60">
        Tier 2 upgrades. You&apos;re confirming this is a real, identifiable business — not judging
        their work. Approving shows the badge on their storefront, every listing and every
        search result immediately.
      </p>

      {!rows.length ? (
        <div className="mt-6">
          <EmptyState title="No submissions yet" hint="Printers apply from Get Verified in their dashboard." />
        </div>
      ) : (
        <>
          <ul className="mt-6 space-y-3">
            {pending.map(({ sub, shop }) => (
              <li key={sub.id} className="rounded-2xl border border-blue bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-display font-extrabold text-navy">{shop?.businessName ?? 'Unknown shop'}</p>
                    <p className="mt-0.5 text-[13px] text-black/55">
                      {sub.documentType} · submitted {shortDate(sub.submittedAt)}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-3">
                      <a href={sub.documentUrl} target="_blank" rel="noreferrer"
                        className="font-display text-[13px] font-bold text-blue underline">
                        Open document →
                      </a>
                      {sub.socialUrl && (
                        <a href={sub.socialUrl.startsWith('http') ? sub.socialUrl : `https://${sub.socialUrl}`}
                          target="_blank" rel="noreferrer"
                          className="font-display text-[13px] font-bold text-blue underline">
                          Check their social →
                        </a>
                      )}
                      {shop && (
                        <Link href={`/${shop.slug}`} target="_blank"
                          className="font-display text-[13px] font-bold text-blue underline">
                          View storefront →
                        </Link>
                      )}
                    </div>
                  </div>
                  {shop && <CodeBadge code={shop.code} tone="light" />}
                </div>
                <ReviewSubmission id={sub.id} />
              </li>
            ))}
          </ul>

          {reviewed.length > 0 && (
            <>
              <h2 className="mt-8 font-display text-lg font-extrabold text-navy">Reviewed</h2>
              <ul className="mt-3 space-y-2">
                {reviewed.map(({ sub, shop }) => (
                  <li key={sub.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/12 bg-white px-4 py-3">
                    <span className="text-[13px] text-navy">
                      <strong className="font-display font-extrabold">{shop?.businessName ?? 'Unknown'}</strong>
                      {sub.reviewNote ? ` · ${sub.reviewNote}` : ''}
                    </span>
                    <span className={`font-mono text-[10px] font-bold uppercase tracking-widest ${
                      sub.status === 'verified' ? 'text-success' : 'text-red'
                    }`}>
                      {sub.status}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  );
}
