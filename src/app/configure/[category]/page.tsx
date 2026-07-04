import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCategory, CATEGORIES } from '@/lib/categories';
import { Configurator } from './Configurator';

export function generateStaticParams() {
  return CATEGORIES.filter((c) => c.live).map((c) => ({ category: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ category: string }> }): Promise<Metadata> {
  const cat = getCategory((await params).category);
  if (!cat) return {};
  return {
    title: `Print ${cat.name} in Lagos`,
    description: `Configure your ${cat.name.toLowerCase()} — size, quantity and finish — then compare prices from nearby Lagos printers.`,
  };
}

export default async function ConfigurePage({ params }: { params: Promise<{ category: string }> }) {
  const cat = getCategory((await params).category);
  if (!cat || !cat.live) notFound();
  return <Configurator category={cat} />;
}
