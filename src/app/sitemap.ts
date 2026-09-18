import type { MetadataRoute } from 'next';
import { LIVE_CATEGORIES } from '@/lib/catalog';
import { LEGAL_DOCS } from '@/lib/legal';

const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: base, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/products`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${base}/designers`, lastModified: now, changeFrequency: 'weekly' as const, priority: 0.6 },
    { url: `${base}/designers`, lastModified: now, changeFrequency: 'weekly' as const, priority: 0.7 },
    { url: `${base}/faq`, lastModified: now, changeFrequency: 'monthly' as const, priority: 0.5 },
    ...LEGAL_DOCS.map((d) => ({
      url: `${base}/legal/${d.slug}`,
      lastModified: now,
      changeFrequency: 'yearly' as const,
      priority: 0.3,
    })),
    { url: `${base}/marketplace`, lastModified: now, changeFrequency: 'daily' as const, priority: 0.9 },
    ...LIVE_CATEGORIES.map((c) => ({
      url: `${base}/printers?category=${c.slug}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
    { url: `${base}/login`, lastModified: now, priority: 0.3 },
    { url: `${base}/register`, lastModified: now, priority: 0.3 },
  ];
}
