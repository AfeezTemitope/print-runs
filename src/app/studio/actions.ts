'use server';

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { db, tables } from '@/db';
import { getSession } from '@/lib/auth';
import { getMyStudio, studioWorks, studioServices, readyForReview } from '@/lib/designers';
import { slugify, studioCode } from '@/lib/format';

const toKobo = (naira: string) => Math.round(Number(naira || 0) * 100);

/** Creates the studio on first save, so a new designer never faces an empty broken page. */
export async function saveStudio(input: {
  displayName: string; tagline: string; bio: string; avatarUrl: string; bannerUrl: string;
}) {
  const session = await getSession();
  if (!session || (session.role !== 'designer' && session.role !== 'admin')) return { error: 'Not allowed.' };

  const displayName = input.displayName.trim();
  if (displayName.length < 2) return { error: 'Give your studio a name.' };

  const existing = await getMyStudio();
  const values = {
    displayName,
    tagline: input.tagline.trim() || null,
    bio: input.bio.trim() || null,
    avatarUrl: input.avatarUrl || null,
    bannerUrl: input.bannerUrl || null,
  };

  if (existing) {
    await db().update(tables.designerStudios).set(values)
      .where(eq(tables.designerStudios.id, existing.id));
  } else {
    // The slug is fixed at creation. Changing it later would break any link a customer has
    // already shared, so the name can change freely but the URL does not follow it.
    let slug = slugify(displayName);
    const [clash] = await db().select().from(tables.designerStudios)
      .where(eq(tables.designerStudios.slug, slug)).limit(1);
    if (clash) slug = `${slug}-${Math.floor(100 + Math.random() * 899)}`;

    await db().insert(tables.designerStudios).values({
      ...values, userId: session.uid, slug, code: studioCode(),
    });
  }

  revalidatePath('/studio');
  return { ok: true } as const;
}

export async function addWork(imageUrl: string, caption: string) {
  const studio = await getMyStudio();
  if (!studio) return { error: 'Set up your studio first.' };
  if (!/^https:\/\/res\.cloudinary\.com\//.test(imageUrl)) return { error: 'Upload the image rather than pasting a link.' };

  const works = await studioWorks(studio.id);
  if (works.length >= 24) return { error: 'Portfolio is full — remove a piece first.' };

  await db().insert(tables.designerWorks).values({
    studioId: studio.id, imageUrl, caption: caption.trim() || null, sortOrder: works.length,
  });
  revalidatePath('/studio');
  return { ok: true } as const;
}

export async function removeWork(id: string) {
  const studio = await getMyStudio();
  if (!studio) return { error: 'Not your studio.' };
  await db().delete(tables.designerWorks)
    .where(and(eq(tables.designerWorks.id, id), eq(tables.designerWorks.studioId, studio.id)));
  revalidatePath('/studio');
  return { ok: true } as const;
}

export async function saveService(input: {
  id?: string; title: string; description: string; price: string;
  revisionsIncluded: string; extraRevision: string; turnaround: string; isActive: boolean;
}) {
  const studio = await getMyStudio();
  if (!studio) return { error: 'Set up your studio first.' };

  const title = input.title.trim();
  if (title.length < 3) return { error: 'Name the service.' };
  const priceKobo = toKobo(input.price);
  if (priceKobo <= 0) return { error: 'Set a price.' };

  const values = {
    title,
    description: input.description.trim() || null,
    priceKobo,
    revisionsIncluded: Math.max(0, Number(input.revisionsIncluded) || 0),
    extraRevisionKobo: toKobo(input.extraRevision),
    turnaroundHours: Math.max(1, Number(input.turnaround) || 48),
    isActive: input.isActive,
  };

  if (input.id) {
    await db().update(tables.designerServices).set(values)
      .where(and(eq(tables.designerServices.id, input.id), eq(tables.designerServices.studioId, studio.id)));
  } else {
    await db().insert(tables.designerServices).values({ ...values, studioId: studio.id });
  }
  revalidatePath('/studio');
  return { ok: true } as const;
}

export async function removeService(id: string) {
  const studio = await getMyStudio();
  if (!studio) return { error: 'Not your studio.' };
  await db().delete(tables.designerServices)
    .where(and(eq(tables.designerServices.id, id), eq(tables.designerServices.studioId, studio.id)));
  revalidatePath('/studio');
  return { ok: true } as const;
}

/**
 * Submitting for review is explicit rather than automatic: a designer decides when their
 * portfolio represents them, instead of admin seeing every half-finished profile.
 */
export async function submitForReview() {
  const studio = await getMyStudio();
  if (!studio) return { error: 'Set up your studio first.' };
  if (studio.verification === 'verified') return { error: 'You are already verified.' };

  const [works, services] = await Promise.all([studioWorks(studio.id), studioServices(studio.id, false)]);
  if (!readyForReview(works, services)) {
    return { error: 'Add at least 3 portfolio pieces and 1 service before submitting.' };
  }

  await db().update(tables.designerStudios)
    .set({ verification: 'pending', verificationNote: null, reviewedAt: null })
    .where(eq(tables.designerStudios.id, studio.id));

  revalidatePath('/studio');
  revalidatePath('/admin/designers');
  return { ok: true } as const;
}
