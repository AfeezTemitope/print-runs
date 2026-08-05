import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { db, tables } from '@/db';
import { getSession } from '@/lib/auth';
import { getCategory, listingLabel } from '@/lib/categories';
import { specSummary } from '@/lib/spec';
import { StatusTracker } from '@/components/ui/StatusTracker';
import { CodeBadge } from '@/components/ui/CodeBadge';
import { naira, shortDate } from '@/lib/format';
import { ReviewForm } from './ReviewForm';

export const metadata: Metadata = { title: 'Order' };
export const dynamic = 'force-dynamic';

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = (await getSession())!;

  const [row] = await db().select({
    order: tables.orders,
    shopName: tables.shops.businessName,
    shopCode: tables.shops.code,
  })
    .from(tables.orders)
    .innerJoin(tables.shops, eq(tables.orders.shopId, tables.shops.id))
    .where(and(eq(tables.orders.id, id), eq(tables.orders.customerId, session.uid)))
    .limit(1);
  if (!row) notFound();
  const { order, shopName, shopCode } = row;

  const [existingReview] = await db().select().from(tables.reviews).where(eq(tables.reviews.orderId, order.id)).limit(1);
  const cat = getCategory(order.spec.category);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-center gap-2.5">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-black">{cat?.name}</h1>
        <span className="font-mono text-sm font-bold text-black/45">{order.code}</span>
      </div>
      <p className="mt-1.5 flex items-center gap-2 text-sm text-black/55">
        {shopName} <CodeBadge code={shopCode} tone="light" /> · {shortDate(order.createdAt)}
      </p>

      <section className="mt-7 rounded-2xl border border-black/12 bg-white p-5 sm:p-6">
        {order.isQuote && order.paymentStatus === 'unpaid' ? (
          <p className="rounded-xl bg-pale/40 px-4 py-3 font-mono text-[11px] font-bold uppercase tracking-widest text-navy">
            Quote requested — the printer will respond with a price
          </p>
        ) : (
          <StatusTracker status={order.status} method={order.fulfillmentMethod} />
        )}
      </section>

      <section className="mt-5 rounded-2xl border border-black/12 bg-white p-5 sm:p-6">
        <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-navy">Spec</h2>
        <dl className="mt-3 font-mono text-sm">
          {specSummary(order.spec, listingLabel(order.spec.category, order.spec.listing)).map((line, i) => (
            <div key={i} className="border-b border-dashed border-black/15 py-2 text-navy">{line}</div>
          ))}
          {order.printNote && (
            <div className="border-b border-dashed border-black/15 py-2 text-black/60">Note: {order.printNote}</div>
          )}
          <div className="py-2 text-black/60">
            {order.fulfillmentMethod === 'collection'
              ? 'You are arranging collection'
              : `Delivery: ${order.deliveryAddress ?? '—'}`}
          </div>
        </dl>

        {/* V2 3-layer pricing (decision 1). The customer sees the selling price and the
            platform fee separately; the commercial margin inside the selling price is
            deliberately not broken out. Delivery is NOT part of this total. */}
        <dl className="font-mono text-sm">
          {order.sellingPriceKobo != null && (
            <div className="flex justify-between border-b border-dashed border-black/15 py-2">
              <dt className="text-black/55">Product price</dt>
              <dd className="font-bold text-navy">{naira(order.sellingPriceKobo)}</dd>
            </div>
          )}
          {order.platformFeeKobo != null && (
            <div className="flex justify-between border-b border-dashed border-black/15 py-2">
              <dt className="text-black/55">Platform service fee</dt>
              <dd className="font-bold text-navy">{naira(order.platformFeeKobo)}</dd>
            </div>
          )}
        </dl>
        <div className="flex justify-between border-t border-dashed border-black/25 pt-3.5">
          <span className="font-display font-extrabold text-navy">Paid at checkout</span>
          <span className="font-display text-lg font-extrabold text-navy">{naira(order.amountPaidKobo)}</span>
        </div>
        {order.fulfillmentMethod === 'delivery' && order.deliveryFeeKobo == null && !order.isQuote && (
          <p className="mt-3 rounded-xl bg-pale/40 px-4 py-3 text-[13px] leading-relaxed text-navy">
            A PrintRuns representative will contact you to confirm your delivery details and the
            delivery fee, which is charged separately from the amount above.
          </p>
        )}
        {order.deliveryFeeKobo != null && (
          <div className="mt-3 rounded-xl bg-pale/40 px-4 py-3 text-[13px] text-navy">
            <div className="flex justify-between">
              <span>Delivery fee — paid in cash to the rider</span>
              <span className="font-display font-extrabold">{naira(order.deliveryFeeKobo)}</span>
            </div>
            <p className="mt-1 text-xs text-black/60">
              {order.deliveryFeeStatus === 'accepted'
                ? 'Have this ready for the rider when they arrive. It is not charged to your card.'
                : 'A PrintRuns representative will call to confirm this before your order is dispatched.'}
            </p>
          </div>
        )}
        {order.fulfillmentMethod === 'collection' && order.collectionAuthorizedName && (
          <p className="mt-3 rounded-xl bg-pale/40 px-4 py-3 text-[13px] leading-relaxed text-navy">
            Your order is being collected by <strong>{order.collectionAuthorizedName}</strong>
            {' '}({order.collectionAuthorizedPhone}). The printer will only release it to them.
          </p>
        )}
        {order.refundStatus !== 'none' && (
          <p className="mt-3 rounded-xl border border-red/30 bg-red/5 px-4 py-3 text-[13px] leading-relaxed text-red">
            {order.refundStatus === 'requested'
              ? 'A refund is being processed for this order. PrintRuns support will be in touch.'
              : `Refund ${order.refundStatus}: ${naira(order.refundAmountKobo)}`}
          </p>
        )}
      </section>

      {order.status === 'delivered' && !existingReview && (
        <section className="mt-5 rounded-2xl border border-black/12 bg-white p-5 sm:p-6">
          <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-navy">Rate this printer</h2>
          <ReviewForm orderId={order.id} />
        </section>
      )}
      {existingReview && (
        <p className="mt-5 text-center font-mono text-[11px] uppercase tracking-widest text-black/45">
          You rated this order {existingReview.rating}/5 — thanks!
        </p>
      )}
    </div>
  );
}
