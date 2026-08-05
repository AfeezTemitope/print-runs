import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';

/**
 * Admin gate for server components. Middleware already blocks /admin at the edge; this is the
 * second check, so a page can never render admin data if it is ever reached another way.
 */
export async function requireAdmin() {
  const session = await getSession();
  if (!session) redirect('/login?next=/admin');
  if (session.role !== 'admin') redirect('/');
  return session;
}
