import type { listings, listingTiers } from '@/db/schema';
import { MAX_TIERS } from '@/lib/catalog';

type Listing = typeof listings.$inferSelect;
type Tier = typeof listingTiers.$inferSelect;

/**
 * V2 pricing engine (Module 1, Section 5). Three modes, chosen by the printer per listing.
 *
 * Every mode must produce a total the moment the customer touches a control — no submit, no
 * reload. That is why this is a pure function with no I/O: the same code runs on the server
 * for the authoritative price and in the browser for the live display, so the number the
 * customer watches update is the number they are charged.
 */

export type LineSpec = {
  qty?: number;
  width?: number;
  height?: number;
};

export type ListingPrice =
  | { ok: true; totalKobo: number; detail: string }
  | { ok: false; reason: string; quote: true };

const QUOTE = (reason: string): ListingPrice => ({ ok: false, reason, quote: true });

/** Tiers, lowest quantity first — the order the customer sees them in. */
export function sortTiers(tiers: Tier[]): Tier[] {
  return [...tiers].sort((a, b) => a.quantity - b.quantity);
}

export function computeListingPrice(listing: Listing, tiers: Tier[], spec: LineSpec): ListingPrice {
  switch (listing.pricingMode) {
    case 'tier': {
      const sorted = sortTiers(tiers);
      if (!sorted.length) return QUOTE('No prices set');
      if (!spec.qty) return QUOTE('Choose a quantity');

      const match = sorted.find((t) => t.quantity === spec.qty);
      // Section 5.1: above the highest tier routes to Request Quote rather than extrapolating.
      // A quantity between tiers is not a price either — the printer named specific batches.
      if (!match) return QUOTE('Request a custom quantity');
      return { ok: true, totalKobo: match.priceKobo, detail: `${match.quantity} pcs` };
    }

    case 'piece': {
      if (!listing.ratePerPieceKobo) return QUOTE('No rate set');
      const qty = spec.qty ?? 0;
      if (qty <= 0) return QUOTE('Enter a quantity');
      if (listing.minimumOrder && qty < listing.minimumOrder) {
        return QUOTE(`Minimum order is ${listing.minimumOrder}`);
      }
      return {
        ok: true,
        totalKobo: listing.ratePerPieceKobo * qty,
        detail: `${qty} × ${fmt(listing.ratePerPieceKobo)}`,
      };
    }

    case 'area': {
      if (!listing.ratePerAreaKobo || !listing.areaUnit) return QUOTE('No rate set');
      const { width, height } = spec;
      if (!width || !height || width <= 0 || height <= 0) return QUOTE('Enter width and height');

      const area = width * height;
      const qty = Math.max(1, spec.qty ?? 1);
      const raw = Math.round(area * listing.ratePerAreaKobo) * qty;

      // Restored by founder decision: the floor applies per unit, not to the whole order —
      // otherwise ten tiny banners would clear a floor meant to cover one.
      const floor = (listing.minChargeKobo ?? 0) * qty;
      const totalKobo = Math.max(raw, floor);

      const unit = listing.areaUnit === 'sqft' ? 'sq.ft' : 'sq.in';
      return {
        ok: true,
        totalKobo,
        detail: totalKobo > raw
          ? `${width} × ${height} — minimum charge applies`
          : `${width} × ${height} ${unit}${qty > 1 ? ` × ${qty}` : ''}`,
      };
    }

    default:
      return QUOTE('Priced on request');
  }
}

function fmt(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString('en-NG')}`;
}

/**
 * The lowest price a listing can produce, for "From ₦X" on cards. Per-piece uses the minimum
 * order where one is set, because quoting the single-unit rate on a listing with a minimum of
 * 50 would advertise a price nobody can actually buy.
 */
export function fromPriceKobo(listing: Listing, tiers: Tier[]): number | null {
  switch (listing.pricingMode) {
    case 'tier': {
      const sorted = sortTiers(tiers);
      return sorted.length ? sorted[0].priceKobo : null;
    }
    case 'piece':
      return listing.ratePerPieceKobo
        ? listing.ratePerPieceKobo * (listing.minimumOrder ?? 1)
        : null;
    case 'area':
      return listing.minChargeKobo ?? listing.ratePerAreaKobo ?? null;
    default:
      return null;
  }
}

/** Whether a quantity above the top tier should offer the Request Quote route. */
export function needsCustomQuantity(listing: Listing, tiers: Tier[], qty: number): boolean {
  if (listing.pricingMode !== 'tier') return false;
  const sorted = sortTiers(tiers);
  if (!sorted.length) return true;
  return qty > sorted[sorted.length - 1].quantity;
}

/** Validation shared by the printer form and the server action. */
export function validateTiers(rows: { quantity: number; priceKobo: number }[]): string | null {
  const valid = rows.filter((r) => r.quantity > 0 && r.priceKobo > 0);
  if (!valid.length) return 'Set at least one quantity and price.';
  if (valid.length > MAX_TIERS) return `You can set up to ${MAX_TIERS} tiers.`;
  const qtys = valid.map((r) => r.quantity);
  if (new Set(qtys).size !== qtys.length) return 'Each tier needs a different quantity.';
  return null;
}
