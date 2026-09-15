import { and, asc, eq, inArray } from 'drizzle-orm';
import { db, tables } from '@/db';
import { slugify } from '@/lib/format';
import { isReservedSlug } from '@/lib/catalog';

/**
 * Pick a free public slug for printruns.ng/[slug].
 *
 * Two things can collide: another printer, and the platform's own routes. A printer called
 * "Products" must not take over the products page, so reserved words are treated exactly like
 * a taken name — suggest a variant rather than block signup (Module 1, Section 3).
 */
export async function allocateSlug(businessName: string): Promise<string> {
  const base = slugify(businessName) || 'printer';

  const taken = async (candidate: string) => {
    if (isReservedSlug(candidate)) return true;
    const [shop] = await db().select({ id: tables.shops.id }).from(tables.shops)
      .where(eq(tables.shops.slug, candidate)).limit(1);
    if (shop) return true;
    // Designer studios share the same public namespace.
    const [studio] = await db().select({ id: tables.designerStudios.id }).from(tables.designerStudios)
      .where(eq(tables.designerStudios.slug, candidate)).limit(1);
    return Boolean(studio);
  };

  if (!(await taken(base))) return base;
  for (let n = 2; n <= 20; n += 1) {
    const candidate = `${base}${n}`;
    if (!(await taken(candidate))) return candidate;
  }
  return `${base}-${Math.floor(1000 + Math.random() * 8999)}`;
}

/** Every sub-category a shop has, grouped by top-level category. */
export async function subcategoriesFor(shopId: string) {
  return db().select().from(tables.subcategories)
    .where(eq(tables.subcategories.shopId, shopId))
    .orderBy(asc(tables.subcategories.sortOrder), asc(tables.subcategories.name));
}

export async function listingsFor(shopId: string, publicOnly = false) {
  const where = publicOnly
    ? and(eq(tables.listings.shopId, shopId), eq(tables.listings.isActive, true))
    : eq(tables.listings.shopId, shopId);
  return db().select().from(tables.listings).where(where).orderBy(asc(tables.listings.createdAt));
}

/** Tiers for many listings in one query, keyed by listing id. */
export async function tiersForListings(listingIds: string[]) {
  if (!listingIds.length) return new Map<string, (typeof tables.listingTiers.$inferSelect)[]>();
  const rows = await db().select().from(tables.listingTiers)
    .where(inArray(tables.listingTiers.listingId, listingIds));
  const map = new Map<string, typeof rows>();
  for (const row of rows) {
    const list = map.get(row.listingId) ?? [];
    list.push(row);
    map.set(row.listingId, list);
  }
  return map;
}

/**
 * A storefront is publishable once it can actually be shopped: identity filled in and at
 * least one active listing. The wizard publishes without PrintRuns approval (Section 3), but
 * publishing an empty shop into search helps nobody.
 */
export function canPublish(shop: { businessName: string; addressCity: string | null }, listingCount: number): boolean {
  return Boolean(shop.businessName && shop.addressCity) && listingCount > 0;
}

/** The categories a shop actually sells in, derived from its active listings. */
export async function activeCategorySlugs(shopId: string): Promise<string[]> {
  const rows = await db().select({ slug: tables.listings.categorySlug }).from(tables.listings)
    .where(and(eq(tables.listings.shopId, shopId), eq(tables.listings.isActive, true)));
  return [...new Set(rows.map((r) => r.slug))];
}
