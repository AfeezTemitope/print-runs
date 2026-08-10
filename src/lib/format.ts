/** All money is stored as integer kobo. Format for display only. */
export function naira(kobo: number | null | undefined): string {
  if (kobo == null) return '—';
  const n = kobo / 100;
  return '₦' + n.toLocaleString('en-NG', { maximumFractionDigits: n % 1 === 0 ? 0 : 2 });
}

export function shortDate(d: Date | string): string {
  return new Date(d).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function orderCode(): string {
  const y = new Date().getFullYear();
  const n = Math.floor(100000 + Math.random() * 900000);
  return `PR-${y}-${n}`;
}

export function vendorCode(): string {
  const n = Math.floor(10 + Math.random() * 989);
  return `LB-${String(n).padStart(3, '0')}`;
}

/**
 * Design orders carry their own prefix. The code doubles as the Paystack reference, so
 * a glance at a transaction tells you whether it was a print job or a design job.
 */
export function designOrderCode(): string {
  const n = Math.floor(100000 + Math.random() * 899999);
  return `PRD-${n}`;
}

/** A paid extra revision is its own transaction, so it needs its own reference. */
export function revisionChargeCode(): string {
  const n = Math.floor(100000 + Math.random() * 899999);
  return `PRR-${n}`;
}

/** Designer studios get their own prefix so a code alone tells you which side it belongs to. */
export function studioCode(): string {
  const n = Math.floor(10 + Math.random() * 989);
  return `DS-${String(n).padStart(3, '0')}`;
}

export function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}
