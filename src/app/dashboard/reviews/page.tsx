import type { Metadata } from 'next';
import { desc, eq } from 'drizzle-orm';
import { FlagReview } from './FlagReview';
import { Star } from 'lucide-react';
import { db, tables } from '@/db';
import { getMyShop } from '@/lib/auth';
import { shortDate } from '@/lib/format';
import { EmptyState } from '@/components/ui/EmptyState';

export const metadata: Metadata = { title: 'Reviews' };

export default async function ReviewsPage() {
  const shop = (await getMyShop())!;
  const rows = await db().select({
    review: tables.reviews,
    firstName: tables.users.firstName,
  })
    .from(tables.reviews)
    .innerJoin(tables.users, eq(tables.reviews.customerId, tables.users.id))
    .where(eq(tables.reviews.shopId, shop.id))
    .orderBy(desc(tables.reviews.createdAt))
    .limit(50);

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-black">Reviews</h1>
        {shop.ratingCount > 0 && (
          <p className="font-display font-extrabold text-navy">{shop.ratingAvg.toFixed(1)} ★ <span className="text-sm font-bold text-black/45">({shop.ratingCount})</span></p>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="mt-6"><EmptyState title="No reviews yet" hint="Customers can rate each completed order." /></div>
      ) : (
        <ul className="mt-6 space-y-3">
          {rows.map(({ review, firstName }) => (
            <li key={review.id} className="rounded-2xl border border-black/12 bg-white p-5">
              <div className="flex items-center justify-between">
                <span className="flex gap-0.5" aria-label={`${review.rating} out of 5`}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star key={n} className={`size-4 ${n <= review.rating ? 'fill-pale text-navy' : 'text-black/20'}`} />
                  ))}
                </span>
                <span className="text-xs text-black/45">{firstName} · {shortDate(review.createdAt)}</span>
              </div>
              {review.comment && <p className="mt-2.5 text-sm leading-relaxed text-black/70">{review.comment}</p>}
              {review.removedAt ? (
                <p className="mt-1.5 font-mono text-[10px] font-bold uppercase tracking-widest text-red">
                  Removed by PrintRuns
                </p>
              ) : (
                <FlagReview reviewId={review.id} flagged={Boolean(review.flaggedAt)} />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
