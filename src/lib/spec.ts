import type { OrderSpec } from '@/db/schema';

/**
 * Human-readable summary of an order's frozen spec, for order lists and the printer queue.
 *
 * V2 orders carry the printer's own listing name and a price detail line; legacy orders carry
 * the old fixed-catalogue fields. Both still have to render years later, so this handles
 * either shape rather than assuming the current one.
 */
export function specSummary(spec: Partial<OrderSpec> | null | undefined): string[] {
  if (!spec) return [];
  const out: string[] = [];

  if (spec.listingName) out.push(spec.listingName);
  else if (spec.listing) out.push(String(spec.listing).replace(/_/g, ' '));

  if (spec.width && spec.height) out.push(`${spec.width} × ${spec.height} ${spec.unit ?? ''}`.trim());
  if (spec.sizeLabel) out.push(spec.sizeLabel);
  if (spec.sheets) out.push(`${spec.sheets} sheets`);
  if (spec.qty) out.push(`${spec.qty.toLocaleString()} pcs`);

  for (const label of Object.values(spec.options ?? {})) if (label && label !== 'None') out.push(label);
  for (const label of Object.values(spec.addons ?? {})) if (label && label !== 'None') out.push(label);

  return out;
}
