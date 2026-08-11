import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCategory, getListing, liveListings } from '@/lib/categories';
import { getCatalogPhotos, pickPhoto } from '@/lib/photos';
import { approvedDesignFor } from '@/lib/design-handoff';

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
import { Configurator } from '../Configurator';

export function generateStaticParams() {
  return liveListings().map(({ category, listing }) => ({ category: category.slug, listing: listing.slug }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ category: string; listing: string }> },
): Promise<Metadata> {
  const { category, listing } = await params;
  const cat = getCategory(category);
  const l = cat ? getListing(cat, listing) : undefined;
  if (!cat || !l) return {};
  return {
    title: `Print ${cat.name} — ${l.label} in Lagos`,
    description: `Configure your ${l.label.toLowerCase()} ${cat.name.toLowerCase()} — size, quantity and finish — then compare prices from nearby Lagos printers.`,
  };
}

export default async function ConfigureListingPage(
  { params, searchParams }: {
    params: Promise<{ category: string; listing: string }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
  },
) {
  const { category, listing } = await params;
  const cat = getCategory(category);
  if (!cat || !cat.live) notFound();
  const l = getListing(cat, listing);
  if (!l) notFound();

  const photos = await getCatalogPhotos();
  const design = one((await searchParams).design);
  return (
    <Configurator
      category={cat}
      listing={l}
      photoUrl={pickPhoto(photos, cat.slug, l.slug)}
      prefillFile={await approvedDesignFor(design)}
    />
  );
}
