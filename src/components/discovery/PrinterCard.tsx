import Link from 'next/link';
import Image from 'next/image';
import { BadgeCheck, MapPin, Star } from 'lucide-react';
import { naira } from '@/lib/format';
import type { PrinterCard as Card } from '@/lib/discovery';

/**
 * One printer, as a customer sees them. Identical in both entry points (§4.2) so a customer
 * who switches between Start Printing and Marketplace is comparing like with like.
 *
 * `href` differs: from a category search it deep-links into that category's listings; from the
 * Marketplace it opens the full storefront, since the customer has expressed no product intent.
 */
export function PrinterCard({ card, href }: { card: Card; href: string }) {
  return (
    <Link href={href}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-black/12 bg-white transition-all hover:-translate-y-0.5 hover:border-blue">
      <div className="relative aspect-[5/2] bg-pale/40">
        {card.bannerUrl && <Image src={card.bannerUrl} alt="" fill sizes="400px" className="object-cover" />}
        {card.verified && (
          <span className="absolute right-2.5 top-2.5 flex items-center gap-1 rounded-pill bg-white/95 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-success">
            <BadgeCheck className="size-3.5" /> Verified
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-[17px] font-extrabold leading-tight tracking-tight text-navy">
            {card.businessName}
          </h3>
          {card.ratingCount > 0 && (
            <span className="flex shrink-0 items-center gap-1 font-mono text-[11px] font-bold text-navy">
              <Star className="size-3.5 fill-current text-blue" />
              {card.ratingAvg.toFixed(1)}
              <span className="text-black/40">({card.ratingCount})</span>
            </span>
          )}
        </div>

        {card.area && (
          <p className="flex items-center gap-1 text-[13px] text-black/55">
            <MapPin className="size-3.5 shrink-0 text-black/35" />
            {card.area}
            {card.distanceKm !== null && (
              <span className="font-mono text-[11px] text-black/40">· {card.distanceKm.toFixed(1)}km</span>
            )}
          </p>
        )}

        {card.categories.length > 0 && (
          <p className="text-[13px] text-black/50">{card.categories.join(' · ')}</p>
        )}

        <div className="mt-auto flex items-baseline justify-between gap-2 border-t border-dashed border-black/20 pt-2.5">
          <span className="font-display text-sm font-extrabold text-navy">
            {card.fromKobo !== null ? `from ${naira(card.fromKobo)}` : 'Request quote'}
          </span>
          <span className="font-display text-[13px] font-bold text-navy transition-colors group-hover:text-blue">
            View printer <span aria-hidden>→</span>
          </span>
        </div>
      </div>
    </Link>
  );
}
