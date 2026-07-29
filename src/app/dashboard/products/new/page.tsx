import type { Metadata } from 'next';
import { ProductForm } from '../ProductForm';

export const metadata: Metadata = { title: 'Add product' };

export default function NewProductPage() {
  return (
    <div>
      <h1 className="mb-6 font-display text-3xl font-extrabold tracking-tight text-black">Add product</h1>
      <ProductForm initial={{
        categorySlug: 'sticker', name: '', pricingMode: 'per_area',
        areaUnit: 'sqft', ratePerUnit: '', minCharge: '',
        turnaroundHours: '24', photoUrl: '', tiers: [], matrix: [], addons: [],
      }} />
    </div>
  );
}
