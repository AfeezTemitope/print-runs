import type { Metadata } from 'next';
import { BROWSABLE_CATEGORIES } from '@/lib/catalog';
import { getCatalogPhotos, photoKey } from '@/lib/photos';
import { PhotoManager, type PhotoSlot } from './PhotoManager';

export const metadata: Metadata = { title: 'Photos' };

export default async function AdminPhotosPage() {
  const photos = await getCatalogPhotos();

  /**
   * One photo per top-level category, and nothing below that. V2 has no platform-defined
   * sub-types — the per-product photography now belongs to the printer, on their own listings,
   * which is the whole point of the storefront model.
   */
  const slots: PhotoSlot[] = BROWSABLE_CATEGORIES.map((c) => ({
    key: photoKey(c.slug),
    title: c.name,
    code: '',
    sub: c.status === 'live' ? 'Products grid card' : 'Coming soon — still shown',
  }));

  return (
    <div>
      <h1 className="font-display text-3xl font-extrabold tracking-tight text-black">Photos</h1>
      <p className="mt-2 max-w-2xl text-black/60">
        The category images customers see on the Products grid. Anything without a photo falls
        back to its placeholder icon, so you can add them one at a time.
      </p>
      <div className="mt-7">
        <PhotoManager slots={slots} initial={photos} />
      </div>
    </div>
  );
}
