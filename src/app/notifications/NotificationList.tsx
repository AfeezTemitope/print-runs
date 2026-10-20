'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { markAllRead, markRead } from './actions';

export type Item = {
  id: string; title: string; body: string | null; href: string | null;
  read: boolean; when: string;
};

export function NotificationList({ items }: { items: Item[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const unread = items.filter((i) => !i.read).length;

  function open(item: Item) {
    start(async () => {
      if (!item.read) await markRead(item.id);
      if (item.href) router.push(item.href);
      else router.refresh();
    });
  }

  return (
    <>
      {unread > 0 && (
        <div className="mt-4 flex justify-end">
          <Button size="sm" variant="tertiary" disabled={pending}
            onClick={() => start(async () => { await markAllRead(); router.refresh(); })}>
            Mark all as read
          </Button>
        </div>
      )}
      <ul className="mt-3 overflow-hidden rounded-2xl border border-black/12 bg-white">
        {items.map((item) => (
          <li key={item.id} className="border-b border-black/8 last:border-0">
            <button onClick={() => open(item)} disabled={pending}
              className={`flex w-full gap-3 px-4 py-3.5 text-left transition-colors hover:bg-pale/20 ${item.read ? '' : 'bg-blue/5'}`}>
              <span aria-hidden className={`mt-1.5 size-2 shrink-0 rounded-pill ${item.read ? 'bg-transparent' : 'bg-blue'}`} />
              <span className="min-w-0 flex-1">
                <span className={`block text-[14px] ${item.read ? 'text-navy' : 'font-display font-extrabold text-navy'}`}>
                  {item.title}
                </span>
                {item.body && <span className="mt-0.5 block text-[13px] text-black/60">{item.body}</span>}
                <span className="mt-1 block font-mono text-[10px] uppercase tracking-widest text-black/40">{item.when}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
