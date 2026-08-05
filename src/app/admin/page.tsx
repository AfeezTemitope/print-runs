import type { Metadata } from 'next';
import Link from 'next/link';
import { LIVE_CATEGORIES, liveListings } from '@/lib/categories';
import { getCatalogPhotos, photoKey } from '@/lib/photos';

export const metadata: Metadata = { title: 'Overview' };

export default async function AdminHome() {
  const photos = await getCatalogPhotos();
  const slots = LIVE_CATEGORIES.length + liveListings().filter(({ category }) => category.listings.length > 1).length;
  const filled = LIVE_CATEGORIES.filter((c) => photos[photoKey(c.slug)]).length
    + liveListings().filter(({ category, listing }) => category.listings.length > 1 && photos[photoKey(category.slug, listing.slug)]).length;

  return (
    <div>
      <h1 className="font-display text-3xl font-extrabold tracking-tight text-black">Overview</h1>
      <p className="mt-2 text-black/60">Platform settings that would otherwise need a deploy to change.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Link href="/admin/photos" className="rounded-2xl border border-black/12 bg-white p-5 transition-colors hover:border-blue">
          <p className="font-display text-lg font-extrabold text-navy">Product photos</p>
          <p className="mt-1 text-[13px] text-black/55">
            {filled} of {slots} have a photo. The rest fall back to the placeholder icons.
          </p>
        </Link>
        <div className="rounded-2xl border border-dashed border-black/20 bg-white/60 p-5 opacity-70">
          <p className="font-display text-lg font-extrabold text-navy/60">Margins, verification, earnings</p>
          <p className="mt-1 font-mono text-[10px] font-bold uppercase tracking-widest text-navy/45">Next batch</p>
        </div>
      </div>
    </div>
  );
}
