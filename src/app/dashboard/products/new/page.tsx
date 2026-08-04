import type { Metadata } from 'next';
import { LIVE_CATEGORIES } from '@/lib/categories';
import { ProductForm } from '../ProductForm';

export const metadata: Metadata = { title: 'Add product' };

export default function NewProductPage() {
  const first = LIVE_CATEGORIES[0];
  return (
    <div>
      <h1 className="mb-6 font-display text-3xl font-extrabold tracking-tight text-black">Add product</h1>
      <ProductForm initial={{
        categorySlug: first.slug,
        listingSlug: first.listings[0]?.slug ?? '',
        pricingMode: '',
        ratePerUnit: '',
        offersHylet: false,
        turnaroundHours: '24',
        photoUrl: '',
        cellPrices: {},
        addonPrices: {},
      }} />
    </div>
  );
}
