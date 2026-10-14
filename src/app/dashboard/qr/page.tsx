import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getMyShop } from '@/lib/auth';
import { listingsFor } from '@/lib/storefront';
import { QrCard } from './QrCard';

export const metadata: Metadata = { title: 'Your QR code' };

export default async function QrPage() {
  const shop = await getMyShop();
  if (!shop) redirect('/dashboard');

  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://printruns.ng';
  const url = `${base.replace(/\/$/, '')}/${shop.slug}`;
  const listings = await listingsFor(shop.id, true);

  return (
    <div>
      <h1 className="font-display text-3xl font-extrabold tracking-tight text-black">Your QR code</h1>
      <p className="mt-2 max-w-2xl text-black/60">
        Anyone who scans this lands on your storefront and can order straight away. Print it on
        your shop sign, your packaging, your receipts and your cards — it turns every walk-in
        and every delivered job into a customer who can find you again.
      </p>

      {listings.length === 0 && (
        <p className="mt-4 max-w-2xl rounded-2xl border border-blue/30 bg-blue/5 px-4 py-3 text-[13px] text-navy">
          Add at least one product first — a scan that lands on an empty shop is a wasted one.
        </p>
      )}

      <div className="mt-6 grid gap-6 sm:grid-cols-[320px_1fr]">
        <QrCard url={url} businessName={shop.businessName} slug={shop.slug} />

        <div className="space-y-4">
          <div className="rounded-2xl border border-black/12 bg-white p-5">
            <p className="font-display text-[15px] font-extrabold text-navy">Where to put it</p>
            <ul className="mt-2 space-y-1.5 text-[14px] text-black/70">
              <li>• On your shop door or window, at eye level</li>
              <li>• On every receipt and invoice you hand out</li>
              <li>• On the packaging a finished job goes home in</li>
              <li>• On your own business cards</li>
              <li>• As your WhatsApp or Instagram profile picture backdrop</li>
            </ul>
          </div>

          <div className="rounded-2xl border border-black/12 bg-white p-5">
            <p className="font-display text-[15px] font-extrabold text-navy">Printing it</p>
            <p className="mt-1.5 text-[14px] leading-relaxed text-black/70">
              The download is 1024 pixels square, which is large enough for anything up to A4
              without going soft. Keep it at least 3cm across on paper, and leave the white
              border — a QR with no quiet zone around it often will not scan.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
