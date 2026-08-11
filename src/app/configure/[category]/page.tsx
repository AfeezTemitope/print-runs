import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCategory, LIVE_CATEGORIES, needsTypeSelection } from '@/lib/categories';
import { getCatalogPhotos, pickPhoto } from '@/lib/photos';
import { approvedDesignFor } from '@/lib/design-handoff';

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
import { Configurator } from './Configurator';
import { TypeSelect } from './TypeSelect';

export function generateStaticParams() {
  return LIVE_CATEGORIES.map((c) => ({ category: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ category: string }> }): Promise<Metadata> {
  const cat = getCategory((await params).category);
  if (!cat) return {};
  const choosing = needsTypeSelection(cat);
  return {
    title: choosing ? `${cat.name} — choose a type` : `Print ${cat.name} in Lagos`,
    description: choosing
      ? `Pick the ${cat.name.toLowerCase()} type you need, then configure it and compare prices from nearby Lagos printers.`
      : `Configure your ${cat.name.toLowerCase()} — size, quantity and finish — then compare prices from nearby Lagos printers.`,
  };
}

export default async function ConfigurePage({
  params, searchParams,
}: {
  params: Promise<{ category: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const cat = getCategory((await params).category);
  if (!cat || !cat.live || !cat.listings.length) notFound();

  // QA 1.1: more than one type → the photo-led type-selection page comes first. A single-type
  // category has nothing to choose, so it goes straight to the configurator.
  const photos = await getCatalogPhotos();
  const design = one((await searchParams).design);

  if (needsTypeSelection(cat)) {
    return (
      <TypeSelect
        category={cat}
        photos={photos}
        carry={design ? `?design=${encodeURIComponent(design)}` : ''}
      />
    );
  }

  return (
    <Configurator
      category={cat}
      listing={cat.listings[0]}
      photoUrl={pickPhoto(photos, cat.slug, cat.listings[0].slug)}
      prefillFile={await approvedDesignFor(design)}
    />
  );
}
