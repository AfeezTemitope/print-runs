'use client';

import { useState, useTransition } from 'react';
import { PhotoUpload } from '@/components/ui/PhotoUpload';
import { CodeBadge } from '@/components/ui/CodeBadge';
import { saveCatalogPhoto, removeCatalogPhoto } from './actions';

export type PhotoSlot = { key: string; title: string; code: string; sub: string };

export function PhotoManager({ slots, initial }: { slots: PhotoSlot[]; initial: Record<string, string> }) {
  const [photos, setPhotos] = useState<Record<string, string>>(initial);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function set(key: string, url: string | undefined) {
    // Optimistic: the picture appears immediately, and rolls back if the write is rejected.
    const previous = photos[key];
    setPhotos((p) => {
      const next = { ...p };
      if (url) next[key] = url; else delete next[key];
      return next;
    });
    setError(null);
    start(async () => {
      const res = url ? await saveCatalogPhoto(key, url) : await removeCatalogPhoto(key);
      if (res?.error) {
        setError(res.error);
        setPhotos((p) => {
          const next = { ...p };
          if (previous) next[key] = previous; else delete next[key];
          return next;
        });
      }
    });
  }

  return (
    <>
      {error && <p className="mb-4 rounded-xl border border-red/30 bg-red/5 px-3.5 py-2.5 text-sm text-red">{error}</p>}
      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {slots.map((s) => (
          <li key={s.key} className="rounded-2xl border border-black/12 bg-white p-4">
            <div className="mb-2.5 flex items-start justify-between gap-2">
              <div>
                <p className="font-display text-[15px] font-extrabold text-navy">{s.title}</p>
                <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-black/45">{s.sub}</p>
              </div>
              <CodeBadge code={s.code} tone="light" />
            </div>
            <PhotoUpload
              kind="catalog"
              label={s.title}
              url={photos[s.key]}
              onChange={(url) => set(s.key, url)}
            />
          </li>
        ))}
      </ul>
      {pending && <p className="mt-4 font-mono text-[11px] uppercase tracking-widest text-black/45">Saving…</p>}
    </>
  );
}
