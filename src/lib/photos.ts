import { cache } from 'react';
import { db, tables } from '@/db';

/** 'sticker' for the category card, 'sticker:round' for one type's card. */
export function photoKey(categorySlug: string, listingSlug?: string | null): string {
  return listingSlug ? `${categorySlug}:${listingSlug}` : categorySlug;
}

export type PhotoMap = Record<string, string>;

/**
 * The whole catalog photo table in one query — it has at most one row per listing, so about
 * twenty rows forever. Cached per request so a page rendering ten cards still hits the DB once.
 */
export const getCatalogPhotos = cache(async (): Promise<PhotoMap> => {
  try {
    const rows = await db().select().from(tables.catalogPhotos);
    return Object.fromEntries(rows.map((r) => [r.key, r.url]));
  } catch {
    // A missing table or an unreachable DB must never take down the storefront — every
    // consumer falls back to the glyph when a photo is absent.
    return {};
  }
});

/** Listing photo first, then the category's own, then nothing (caller shows the glyph). */
export function pickPhoto(photos: PhotoMap, categorySlug: string, listingSlug?: string | null): string | undefined {
  return photos[photoKey(categorySlug, listingSlug)] ?? photos[photoKey(categorySlug)];
}
