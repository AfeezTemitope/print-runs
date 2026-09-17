import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getMyShop } from '@/lib/auth';
import { latestVerification, lostDisputeCount, standingFor } from '@/lib/trust';
import { VerifyClient } from './VerifyClient';

export const metadata: Metadata = { title: 'Get Verified' };

export default async function VerifyPage() {
  const shop = await getMyShop();
  if (!shop) redirect('/dashboard');

  const [submission, lost] = await Promise.all([
    latestVerification(shop.id),
    lostDisputeCount(shop.id),
  ]);
  const standing = standingFor(lost);

  return (
    <div>
      <h1 className="font-display text-3xl font-extrabold tracking-tight text-black">Get Verified</h1>
      <p className="mt-2 max-w-2xl text-black/60">
        Your storefront is already live. Verification adds a badge that tells customers PrintRuns
        has confirmed you&apos;re a real, identifiable business — it says nothing about your work
        quality, which is what your ratings are for.
      </p>

      <VerifyClient
        tier={shop.verificationTier}
        submission={submission ? {
          status: submission.status,
          note: submission.reviewNote,
          submittedAt: submission.submittedAt.toISOString(),
        } : null}
      />

      {standing.level !== 'clear' && (
        <div className="mt-8 rounded-2xl border border-black/12 bg-white p-5">
          <p className="font-display text-[15px] font-extrabold text-navy">Account standing</p>
          <p className="mt-1 text-[14px] text-black/70">{standing.message}</p>
        </div>
      )}
    </div>
  );
}
