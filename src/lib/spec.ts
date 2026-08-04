import type { CustomerSpec } from '@/lib/pricing';

/**
 * The configured spec travels in the URL — refresh-safe, deep-linkable,
 * and the server always re-derives price from it (never trusts a client total).
 *
 * QA rebuild: `variant` became `listing`, and option-axis choices travel as o_<key>.
 * The old `variant` key is still read back so links already in the wild keep resolving.
 */
export function specToParams(spec: CustomerSpec, extra: Record<string, string> = {}): URLSearchParams {
  const p = new URLSearchParams();
  p.set('category', spec.category);
  if (spec.listing) p.set('listing', spec.listing);
  if (spec.qty) p.set('qty', String(spec.qty));
  if (spec.width) p.set('w', String(spec.width));
  if (spec.height) p.set('h', String(spec.height));
  if (spec.unit) p.set('unit', spec.unit);
  if (spec.sizeLabel) p.set('size', spec.sizeLabel);
  if (spec.sheets) p.set('sheets', String(spec.sheets));
  for (const [key, label] of Object.entries(spec.options ?? {})) if (label) p.set(`o_${key}`, label);
  for (const [kind, label] of Object.entries(spec.addons ?? {})) if (label) p.set(`a_${kind}`, label);
  for (const [k, v] of Object.entries(extra)) if (v) p.set(k, v);
  return p;
}

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export function specFromParams(sp: Params): CustomerSpec | null {
  const category = one(sp.category);
  if (!category) return null;
  const options: Record<string, string> = {};
  const addons: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) {
    const val = one(v);
    if (!val) continue;
    if (k.startsWith('o_')) options[k.slice(2)] = val;
    if (k.startsWith('a_')) addons[k.slice(2)] = val;
  }
  const num = (k: string) => (one(sp[k]) ? Number(one(sp[k])) : undefined);
  return {
    category,
    listing: one(sp.listing) ?? one(sp.variant),
    qty: num('qty'),
    width: num('w'),
    height: num('h'),
    unit: one(sp.unit) as CustomerSpec['unit'],
    sizeLabel: one(sp.size),
    sheets: num('sheets'),
    options: Object.keys(options).length ? options : undefined,
    addons: Object.keys(addons).length ? addons : undefined,
  };
}

type SummarySpec = {
  listing?: string;
  width?: number; height?: number; unit?: string;
  sizeLabel?: string; sheets?: number;
  qty?: number;
  options?: Record<string, string>;
  addons?: Record<string, string>;
};

export function specSummary(spec: SummarySpec, listingLabel?: string): string[] {
  const out: string[] = [];
  // Prefer a human label where the caller has the category to hand; fall back to the slug.
  if (listingLabel) out.push(listingLabel);
  else if (spec.listing) out.push(spec.listing.replace(/_/g, ' '));
  if (spec.width && spec.height) out.push(`${spec.width} × ${spec.height} ${spec.unit}`);
  if (spec.sizeLabel) out.push(spec.sizeLabel);
  if (spec.sheets) out.push(`${spec.sheets} sheets`);
  if (spec.qty) out.push(`${spec.qty} pcs`);
  for (const label of Object.values(spec.options ?? {})) if (label && label !== 'None') out.push(label);
  for (const label of Object.values(spec.addons ?? {})) if (label && label !== 'None') out.push(label);
  return out;
}
