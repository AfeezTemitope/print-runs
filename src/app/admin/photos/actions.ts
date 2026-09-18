'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db, tables } from '@/db';
import { getSession } from '@/lib/auth';
import { CATEGORIES, getCategory } from '@/lib/catalog';
import { photoKey } from '@/lib/photos';

/** Every key the catalog can legally hold — anything else is rejected outright. */
function validKey(key: string): boolean {
  // V2 keys are a bare category slug — there are no platform sub-types to qualify them with.
  return Boolean(getCategory(key));
}

async function assertAdmin() {
  const session = await getSession();
  if (!session || session.role !== 'admin') return null;
  return session;
}

export async function saveCatalogPhoto(key: string, url: string) {
  if (!(await assertAdmin())) return { error: 'Not allowed.' };
  if (!validKey(key)) return { error: 'Unknown product.' };
  // Only our own Cloudinary assets — this field ends up in an <img> on the storefront.
  if (!/^https:\/\/res\.cloudinary\.com\//.test(url)) return { error: 'Upload the image rather than pasting a link.' };

  await db().insert(tables.catalogPhotos)
    .values({ key, url, updatedAt: new Date() })
    .onConflictDoUpdate({ target: tables.catalogPhotos.key, set: { url, updatedAt: new Date() } });

  revalidatePath('/products');
  revalidatePath('/admin/photos', 'layout');
  for (const c of CATEGORIES) revalidatePath(`/configure/${c.slug}`, 'layout');
  return { ok: true } as const;
}

export async function removeCatalogPhoto(key: string) {
  if (!(await assertAdmin())) return { error: 'Not allowed.' };
  await db().delete(tables.catalogPhotos).where(eq(tables.catalogPhotos.key, key));
  revalidatePath('/products');
  revalidatePath('/admin/photos', 'layout');
  for (const c of CATEGORIES) revalidatePath(`/configure/${c.slug}`, 'layout');
  return { ok: true } as const;
}

export { photoKey };
