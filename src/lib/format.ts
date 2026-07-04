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

export function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}
