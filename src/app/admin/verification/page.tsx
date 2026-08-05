import type { Metadata } from 'next';
import { desc, eq } from 'drizzle-orm';
import { db, tables } from '@/db';
import { getCategory } from '@/lib/categories';
import { shortDate } from '@/lib/format';
import { CodeBadge } from '@/components/ui/CodeBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ReviewButtons } from './ReviewButtons';

export const metadata: Metadata = { title: 'Verification' };

export default async function AdminVerificationPage() {
  const rows = await db()
    .select({ v: tables.shopCategoryVerifications, shop: tables.shops })
    .from(tables.shopCategoryVerifications)
    .leftJoin(tables.shops, eq(tables.shopCategoryVerifications.shopId, tables.shops.id))
    .orderBy(desc(tables.shopCategoryVerifications.createdAt))
    .limit(200);

  const pending = rows.filter((r) => r.v.status === 'pending');
  const reviewed = rows.filter((r) => r.v.status !== 'pending');

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-black">Verification</h1>
        <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-black/45">
          {pending.length > 0 ? `${pending.length} awaiting review` : 'nothing awaiting review'}
        </p>
      </div>
      <p className="mt-2 max-w-2xl text-black/60">
        Approving a category makes that printer visible to customers for it immediately.
      </p>

      {rows.length === 0 ? (
        <div className="mt-6"><EmptyState title="No applications yet" hint="Printers apply from their own dashboard." /></div>
      ) : (
        <>
          <ul className="mt-6 space-y-3">
            {pending.map(({ v, shop }) => (
              <li key={v.id} className="rounded-2xl border border-blue bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-display font-extrabold text-navy">{shop?.businessName ?? 'Unknown shop'}</p>
                    <p className="mt-0.5 text-[13px] text-black/55">
                      {getCategory(v.categorySlug)?.name ?? v.categorySlug} · applied {shortDate(v.createdAt)}
                    </p>
                    {v.workPermitUrl ? (
                      <a href={v.workPermitUrl} target="_blank" rel="noreferrer"
                        className="mt-1 inline-block font-display text-[13px] font-bold text-blue underline">
                        Open work permit →
                      </a>
                    ) : (
                      <p className="mt-1 text-xs text-red">No permit attached — reject and ask them to re-apply.</p>
                    )}
                  </div>
                  {shop && <CodeBadge code={shop.code} tone="light" />}
                </div>
                <div className="mt-3 border-t border-dashed border-black/20 pt-3">
                  <ReviewButtons id={v.id} />
                </div>
              </li>
            ))}
          </ul>

          {reviewed.length > 0 && (
            <>
              <h2 className="mt-8 font-display text-lg font-extrabold text-navy">Reviewed</h2>
              <ul className="mt-3 space-y-2">
                {reviewed.map(({ v, shop }) => (
                  <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/12 bg-white px-4 py-3">
                    <span className="text-[13px] text-navy">
                      <strong className="font-display font-extrabold">{shop?.businessName ?? 'Unknown'}</strong>
                      {' · '}{getCategory(v.categorySlug)?.name ?? v.categorySlug}
                    </span>
                    <span className={`font-mono text-[10px] font-bold uppercase tracking-widest ${
                      v.status === 'verified' ? 'text-success' : 'text-red'
                    }`}>
                      {v.status}
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
