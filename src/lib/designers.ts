import { and, desc, eq } from 'drizzle-orm';
import { db, tables } from '@/db';
import { getSession } from '@/lib/auth';

/** The signed-in user's studio, or null. Mirrors getMyShop on the printer side. */
export async function getMyStudio() {
  const session = await getSession();
  if (!session) return null;
  const [studio] = await db().select().from(tables.designerStudios)
    .where(eq(tables.designerStudios.userId, session.uid)).limit(1);
  return studio ?? null;
}

/**
 * Only verified, active studios are ever shown to customers — the same rule that governs
 * printers. An unverified designer can build their whole profile first; it simply is not
 * public until reviewed, so onboarding never sits blocked waiting on admin.
 */
export async function listPublicStudios() {
  return db().select().from(tables.designerStudios)
    .where(and(
      eq(tables.designerStudios.verification, 'verified'),
      eq(tables.designerStudios.isActive, true),
    ))
    .orderBy(desc(tables.designerStudios.ratingAvg));
}

export async function getPublicStudio(slug: string) {
  const [studio] = await db().select().from(tables.designerStudios)
    .where(and(
      eq(tables.designerStudios.slug, slug),
      eq(tables.designerStudios.verification, 'verified'),
      eq(tables.designerStudios.isActive, true),
    )).limit(1);
  return studio ?? null;
}

export async function studioWorks(studioId: string) {
  return db().select().from(tables.designerWorks)
    .where(eq(tables.designerWorks.studioId, studioId))
    .orderBy(tables.designerWorks.sortOrder);
}

export async function studioServices(studioId: string, publicOnly = true) {
  const where = publicOnly
    ? and(eq(tables.designerServices.studioId, studioId), eq(tables.designerServices.isActive, true))
    : eq(tables.designerServices.studioId, studioId);
  return db().select().from(tables.designerServices).where(where);
}

/**
 * A studio is ready to be reviewed only once it can actually be judged and bought from.
 * Reviewing an empty profile wastes an admin's time and guarantees a rejection.
 */
export function readyForReview(works: unknown[], services: unknown[]): boolean {
  return works.length >= 3 && services.length >= 1;
}
