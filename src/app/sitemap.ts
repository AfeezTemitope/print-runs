import type { MetadataRoute } from 'next';
import { CATEGORIES } from '@/lib/categories';

const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: base, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/products`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    ...CATEGORIES.filter((c) => c.live).map((c) => ({
      url: `${base}/configure/${c.slug}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
    { url: `${base}/login`, lastModified: now, priority: 0.3 },
    { url: `${base}/register`, lastModified: now, priority: 0.3 },
  ];
}
