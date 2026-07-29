import type { CustomerSpec } from '@/lib/pricing';

/**
 * The configured spec travels in the URL — refresh-safe, deep-linkable,
 * and the server always re-derives price from it (never trusts a client total).
 */
export function specToParams(spec: CustomerSpec, extra: Record<string, string> = {}): URLSearchParams {
  const p = new URLSearchParams();
  p.set('category', spec.category);
  if (spec.variant) p.set('variant', spec.variant);
  if (spec.qty) p.set('qty', String(spec.qty));
  if (spec.width) p.set('w', String(spec.width));
  if (spec.height) p.set('h', String(spec.height));
  if (spec.unit) p.set('unit', spec.unit);
  if (spec.sizeLabel) p.set('size', spec.sizeLabel);
  if (spec.serviceType) p.set('service', spec.serviceType);
  if (spec.cover) p.set('cover', spec.cover);
  if (spec.jSize) p.set('jsize', spec.jSize);
  if (spec.sheets) p.set('sheets', String(spec.sheets));
  for (const [kind, label] of Object.entries(spec.addons ?? {})) p.set(`a_${kind}`, label);
  for (const [k, v] of Object.entries(extra)) if (v) p.set(k, v);
  return p;
}

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export function specFromParams(sp: Params): CustomerSpec | null {
  const category = one(sp.category);
  if (!category) return null;
  const addons: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) {
    if (k.startsWith('a_') && one(v)) addons[k.slice(2)] = one(v)!;
  }
  const num = (k: string) => (one(sp[k]) ? Number(one(sp[k])) : undefined);
  return {
    category,
    variant: one(sp.variant),
    qty: num('qty'),
    width: num('w'),
    height: num('h'),
    unit: one(sp.unit) as CustomerSpec['unit'],
    sizeLabel: one(sp.size),
    serviceType: one(sp.service) as CustomerSpec['serviceType'],
    cover: one(sp.cover),
    jSize: one(sp.jsize),
    sheets: num('sheets'),
    addons: Object.keys(addons).length ? addons : undefined,
  };
}

type SummarySpec = {
  variant?: string;
  serviceType?: string; width?: number; height?: number; unit?: string;
  sizeLabel?: string; cover?: string; jSize?: string; sheets?: number;
  qty?: number; addons?: Record<string, string>;
};

export function specSummary(spec: SummarySpec, variantLabel?: string): string[] {
  const out: string[] = [];
  // Prefer a human label where the caller has the category to hand; fall back to the slug.
  if (variantLabel) out.push(variantLabel);
  else if (spec.variant) out.push(spec.variant.replace(/_/g, ' '));
  if (spec.width && spec.height) out.push(`${spec.width} × ${spec.height} ${spec.unit}`);
  if (spec.sizeLabel) out.push(spec.sizeLabel);
  if (spec.cover) out.push(`${spec.cover}, ${spec.jSize}, ${spec.sheets} sheets`);
  if (spec.qty) out.push(`${spec.qty} pcs`);
  for (const [kind, label] of Object.entries(spec.addons ?? {})) {
    if (label && label !== 'None') out.push(`${kind === 'sides' ? '' : ''}${label}`);
  }
  return out;
}
