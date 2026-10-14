'use client';

import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/Button';

/**
 * Storefront QR code (brief item #5).
 *
 * Generated in the browser from the printer's own URL — no external service, so no third party
 * sees the link and nothing breaks if an API disappears. Rendered at 1024px so it survives
 * being printed on a shop sign or a receipt, where a screen-sized QR falls apart.
 */
export function QrCard({ url, businessName, slug }: { url: string; businessName: string; slug: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canvas.current) return;
    QRCode.toCanvas(canvas.current, url, {
      width: 1024,
      margin: 2,
      // High error correction: a QR on a shop front gets scuffed, taped over and rained on,
      // and still has to scan.
      errorCorrectionLevel: 'H',
      color: { dark: '#0B1D4DFF', light: '#FFFFFFFF' },
    })
      .then(() => setReady(true))
      .catch(() => setError('Could not generate the QR code.'));
  }, [url]);

  function download() {
    const el = canvas.current;
    if (!el) return;
    const link = document.createElement('a');
    link.download = `printruns-${slug}-qr.png`;
    link.href = el.toDataURL('image/png');
    link.click();
  }

  return (
    <div className="rounded-2xl border border-black/12 bg-white p-5">
      <div className="mx-auto max-w-[260px]">
        {/* Displayed small, generated large — the download is the full 1024px image. */}
        <canvas ref={canvas} className="h-auto w-full rounded-xl" />
      </div>

      <p className="mt-3 text-center font-display text-[15px] font-extrabold text-navy">{businessName}</p>
      <p className="text-center font-mono text-[12px] text-black/50">{url.replace(/^https?:\/\//, '')}</p>

      {error && <p className="mt-2 text-center text-sm text-red">{error}</p>}

      <Button className="mt-4 w-full" disabled={!ready} onClick={download}>
        <Download className="size-4" /> Download PNG
      </Button>
    </div>
  );
}
