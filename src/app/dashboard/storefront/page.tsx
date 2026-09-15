import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getMyShop } from '@/lib/auth';
import { listingsFor } from '@/lib/storefront';
import { StorefrontClient, type StorefrontData } from './StorefrontClient';

export const metadata: Metadata = { title: 'Storefront' };

export default async function StorefrontPage() {
  const shop = await getMyShop();
  if (!shop) redirect('/dashboard');

  const listings = await listingsFor(shop.id, true);

  const data: StorefrontData = {
    businessName: shop.businessName,
    slug: shop.slug,
    bio: shop.bio ?? '',
    logoUrl: shop.logoUrl ?? '',
    bannerUrl: shop.bannerUrl ?? '',
    addressLine1: shop.addressLine1 ?? '',
    addressCity: shop.addressCity ?? '',
    addressState: shop.addressState ?? '',
    whatsapp: shop.whatsapp ?? '',
    listingCount: listings.length,
  };

  return (
    <div>
      <h1 className="font-display text-3xl font-extrabold tracking-tight text-black">Storefront</h1>
      <p className="mt-2 max-w-2xl text-black/60">
        Your professional home on PrintRuns. Everything here is editable any time and goes live
        immediately.
      </p>
      <div className="mt-7">
        <StorefrontClient data={data} siteUrl={process.env.NEXT_PUBLIC_APP_URL ?? 'https://printruns.ng'} />
      </div>
    </div>
  );
}
