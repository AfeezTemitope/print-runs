'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { ImageUp, Loader2, X } from 'lucide-react';
import { uploadWithProgress, ProgressBar } from '@/components/ui/UploadProgress';

/**
 * Shared image picker for the two places photos get set: a printer's own product shot and
 * the admin catalog. It uploads immediately and hands back a Cloudinary URL — nothing is
 * stored until the surrounding form saves.
 */
export function PhotoUpload({
  url, onChange, kind, label, aspect = 'aspect-[4/3]',
}: {
  url?: string;
  onChange: (url: string | undefined) => void;
  kind: 'catalog' | 'products' | 'permit';
  label: string;
  aspect?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [percent, setPercent] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function send(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setPercent(0);
    setError(null);
    try {
      const res = await uploadWithProgress(file, '/api/upload/image', { kind }, setPercent);
      onChange(res.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  return (
    <div>
      <input
        ref={input}
        type="file"
        hidden
        accept={kind === 'permit' ? '.pdf,image/png,image/jpeg' : 'image/png,image/jpeg,image/webp'}
        onChange={(e) => send(e.target.files?.[0])}
      />
      {url ? (
        <div className={`relative overflow-hidden rounded-xl border border-black/12 ${aspect}`}>
          <Image src={url} alt={label} fill sizes="320px" className="object-cover" />
          <button
            onClick={() => onChange(undefined)}
            aria-label={`Remove ${label} photo`}
            className="absolute right-2 top-2 grid size-7 place-items-center rounded-pill bg-black/60 text-white hover:bg-red"
          >
            <X className="size-4" />
          </button>
          <button
            onClick={() => input.current?.click()}
            disabled={busy}
            className="absolute bottom-2 right-2 rounded-pill bg-white/90 px-3 py-1 font-display text-[11px] font-bold text-navy"
          >
            {busy ? 'Uploading…' : 'Replace'}
          </button>
        </div>
      ) : (
        <button
          onClick={() => input.current?.click()}
          disabled={busy}
          className={`flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-black/30 bg-pale/25 transition-colors hover:bg-pale/50 ${aspect}`}
        >
          {busy ? <Loader2 className="size-5 animate-spin text-navy" /> : <ImageUp className="size-6 text-navy" />}
          <span className="font-display text-[13px] font-bold text-navy">
            {busy ? 'Uploading…' : 'Add photo'}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-widest text-black/45">PNG, JPG or WEBP · max 8MB</span>
        </button>
      )}
      {busy && <ProgressBar percent={percent} />}
      {error && <p className="mt-1.5 text-xs text-red">{error}</p>}
    </div>
  );
}
