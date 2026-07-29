import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCategory, getVariant, LIVE_CATEGORIES } from '@/lib/categories';
import { Configurator } from './Configurator';

export function generateStaticParams() {
  return LIVE_CATEGORIES.map((c) => ({ category: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ category: string }> }): Promise<Metadata> {
  const cat = getCategory((await params).category);
  if (!cat) return {};
  return {
    title: `Print ${cat.name} in Lagos`,
    description: `Configure your ${cat.name.toLowerCase()} — size, quantity and finish — then compare prices from nearby Lagos printers.`,
  };
}

export default async function ConfigurePage({
  params, searchParams,
}: {
  params: Promise<{ category: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const cat = getCategory((await params).category);
  if (!cat || !cat.live) notFound();

  // Landing cards deep-link a variant (e.g. /configure/sticker?variant=large_format), so the
  // customer lands on the exact thing they clicked rather than the category default.
  const sp = await searchParams;
  const raw = Array.isArray(sp.variant) ? sp.variant[0] : sp.variant;
  const initialVariant = getVariant(cat, raw)?.slug ?? cat.variants?.[0]?.slug;

  return <Configurator category={cat} initialVariant={initialVariant} />;
}
