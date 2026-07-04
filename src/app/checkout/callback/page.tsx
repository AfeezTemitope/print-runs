import type { Metadata } from 'next';
import Link from 'next/link';
import { CircleCheck, CircleX } from 'lucide-react';
import { settlePayment } from '@/lib/settle';
import { ButtonLink } from '@/components/ui/Button';

export const metadata: Metadata = { title: 'Payment' };
export const dynamic = 'force-dynamic';

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function CallbackPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const reference = one(sp.reference) ?? one(sp.trxref);
  const result = reference ? await settlePayment(reference) : { ok: false as const, message: 'No payment reference.' };

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
      {result.ok ? (
        <>
          <CircleCheck className="size-14 text-success" strokeWidth={1.6} />
          <h1 className="mt-4 font-display text-3xl font-extrabold text-navy">Payment confirmed</h1>
          <p className="mt-2 text-sm leading-relaxed text-black/60">
            Your job is in the printer&apos;s queue — production starts now.
            Order <span className="font-mono font-bold text-navy">{reference}</span>.
          </p>
          <ButtonLink href="/track" className="mt-7">Track this order <span aria-hidden>→</span></ButtonLink>
          <Link href="/orders" className="mt-3 font-display text-sm font-bold text-blue">See all orders</Link>
        </>
      ) : (
        <>
          <CircleX className="size-14 text-red" strokeWidth={1.6} />
          <h1 className="mt-4 font-display text-3xl font-extrabold text-navy">Payment not confirmed</h1>
          <p className="mt-2 text-sm text-black/60">{result.message}</p>
          <ButtonLink href="/orders" variant="secondary" className="mt-7">Check my orders</ButtonLink>
        </>
      )}
    </div>
  );
}
