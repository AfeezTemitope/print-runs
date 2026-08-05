import type { Metadata } from 'next';
import { LIVE_CATEGORIES } from '@/lib/categories';
import { getCatalogPhotos, photoKey } from '@/lib/photos';
import { PhotoManager, type PhotoSlot } from './PhotoManager';

export const metadata: Metadata = { title: 'Photos' };

export default async function AdminPhotosPage() {
  const photos = await getCatalogPhotos();

  // One slot per card a customer can actually see: the Products grid card for every category,
  // plus a card per type on the categories that have a type-selection page.
  const slots: PhotoSlot[] = LIVE_CATEGORIES.flatMap((c) => {
    const categorySlot: PhotoSlot = {
      key: photoKey(c.slug),
      title: c.name,
      code: c.code,
      sub: c.listings.length > 1 ? 'Products grid card' : 'Products grid + configurator',
    };
    if (c.listings.length <= 1) return [categorySlot];
    return [
      categorySlot,
      ...c.listings.map((l) => ({
        key: photoKey(c.slug, l.slug),
        title: `${c.name} — ${l.label}`,
        code: l.code,
        sub: 'Type-selection card',
      })),
    ];
  });

  return (
    <div>
      <h1 className="font-display text-3xl font-extrabold tracking-tight text-black">Product photos</h1>
      <p className="mt-2 max-w-2xl text-black/60">
        These are the platform&apos;s own photos — every printer&apos;s Round Cut sticker shows the same one.
        Anything without a photo falls back to its placeholder icon, so you can add them one at a time.
      </p>
      <div className="mt-7">
        <PhotoManager slots={slots} initial={photos} />
      </div>
    </div>
  );
}
