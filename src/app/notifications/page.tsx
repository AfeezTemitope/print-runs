import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { recentNotifications } from '@/lib/inbox';
import { EmptyState } from '@/components/ui/EmptyState';
import { NotificationList, type Item } from './NotificationList';

export const metadata: Metadata = { title: 'Notifications' };

/** "2h ago" reads better than a timestamp for something you check every day. */
function ago(d: Date): string {
  const mins = Math.floor((Date.now() - d.getTime()) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', timeZone: 'Africa/Lagos' });
}

export default async function NotificationsPage() {
  const session = await getSession();
  if (!session) redirect('/login?next=/notifications');

  const rows = await recentNotifications(session.uid);
  const items: Item[] = rows.map((n) => ({
    id: n.id, title: n.title, body: n.body, href: n.href,
    read: n.readAt !== null, when: ago(n.createdAt),
  }));

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl font-extrabold tracking-tight text-black">Notifications</h1>
      {!items.length ? (
        <div className="mt-6"><EmptyState title="Nothing yet" hint="Order updates, file checks and payouts show up here." /></div>
      ) : (
        <NotificationList items={items} />
      )}
    </div>
  );
}
