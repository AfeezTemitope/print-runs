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
        addressText: shop.addressText ?? '',
        openingHours: shop.openingHours ?? '',
        logoUrl: shop.logoUrl ?? '',
        bannerUrl: shop.bannerUrl ?? '',
        supportsPickup: shop.supportsPickup,
        supportsDelivery: shop.supportsDelivery,
        hasLocation: shop.lat != null,
      }} />
    </div>
  );
}
