import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCategory, getListing, liveListings } from '@/lib/categories';
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
  { params }: { params: Promise<{ category: string; listing: string }> },
) {
  const { category, listing } = await params;
  const cat = getCategory(category);
  if (!cat || !cat.live) notFound();
  const l = getListing(cat, listing);
  if (!l) notFound();

  return <Configurator category={cat} listing={l} />;
}
