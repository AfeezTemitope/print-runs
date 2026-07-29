import type { Metadata } from 'next';
import { getMyShop } from '@/lib/auth';
import { SettingsForm } from './SettingsForm';

export const metadata: Metadata = { title: 'Shop settings' };

/** Screen 7 (spec §4): business name, images, location, hours, bio. */
export default async function SettingsPage() {
  const shop = (await getMyShop())!;
  return (
    <div>
      <h1 className="mb-6 font-display text-3xl font-extrabold tracking-tight text-black">Shop settings</h1>
      <SettingsForm initial={{
        businessName: shop.businessName,
        bio: shop.bio ?? '',
        addressLine1: shop.addressLine1 ?? '',
        addressLine2: shop.addressLine2 ?? '',
        addressCity: shop.addressCity ?? '',
        addressState: shop.addressState ?? '',
        openingHours: shop.openingHours ?? '',
        logoUrl: shop.logoUrl ?? '',
        bannerUrl: shop.bannerUrl ?? '',
        hasLocation: shop.lat != null,
      }} />
    </div>
  );
}
