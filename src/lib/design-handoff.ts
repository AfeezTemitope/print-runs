import { and, eq } from 'drizzle-orm';
import { db, tables } from '@/db';
import { getSession } from '@/lib/auth';

/**
 * Resolve ?design=PRD-123456 into the approved artwork, so a customer who just paid a designer
 * can print it without downloading and re-uploading the same file.
 *
 * Ownership and approval are both checked server-side: a design code in a URL must never
 * expose another customer's artwork, and an unapproved proof must never reach a printer.
 */
export async function approvedDesignFor(
  code: string | undefined,
): Promise<{ url: string; name: string; designCode: string } | undefined> {
  if (!code) return undefined;
  const session = await getSession();
  if (!session) return undefined;

  const [order] = await db().select().from(tables.designOrders)
    .where(and(
      eq(tables.designOrders.code, code),
      eq(tables.designOrders.customerId, session.uid),
      eq(tables.designOrders.status, 'approved'),
    )).limit(1);

  if (!order?.finalFileUrl) return undefined;
  return { url: order.finalFileUrl, name: `${order.serviceTitle} (${order.code})`, designCode: order.code };
}
