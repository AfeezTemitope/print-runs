import type { Metadata } from 'next';
import { getMyShop } from '@/lib/auth';
import { LIVE_CATEGORIES } from '@/lib/categories';
import { verificationsForShop } from '@/lib/verification';
import { VerificationList, type CatRow } from './VerificationList';

export const metadata: Metadata = { title: 'Verification' };

export default async function VerificationPage() {
  const shop = (await getMyShop())!;
  const rows = await verificationsForShop(shop.id);
  const byCategory = new Map(rows.map((r) => [r.categorySlug, r.status]));

  const cats: CatRow[] = LIVE_CATEGORIES.map((c) => ({
    slug: c.slug,
    name: c.name,
    code: c.code,
    status: (byCategory.get(c.slug) ?? 'none') as CatRow['status'],
  }));

  const verifiedCount = cats.filter((c) => c.status === 'verified').length;

  return (
    <div>
      <h1 className="font-display text-3xl font-extrabold tracking-tight text-black">Verification</h1>
      <p className="mt-2 max-w-2xl text-black/60">
        Customers only see you for categories you&apos;ve been verified for. Upload your work permit for
        each one you print — review is done online, there&apos;s no site visit.
      </p>
      {verifiedCount === 0 && (
        <p className="mt-3 max-w-2xl rounded-xl border border-blue/30 bg-blue/5 px-4 py-3 text-[13px] text-navy">
          You aren&apos;t verified for any category yet, so customers can&apos;t see your products.
          You can still set your prices in the meantime — they go live the moment you&apos;re approved.
        </p>
      )}
      <VerificationList rows={cats} />
    </div>
  );
}
