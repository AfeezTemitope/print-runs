#!/usr/bin/env bash
set -euo pipefail
# Printer dashboard: overview, queue, products, orders, earnings, reviews, settings

mkdir -p 'src/app/dashboard' 'src/app/dashboard/earnings' 'src/app/dashboard/orders' 'src/app/dashboard/products' 'src/app/dashboard/products/[id]' 'src/app/dashboard/products/new' 'src/app/dashboard/queue' 'src/app/dashboard/reviews' 'src/app/dashboard/settings'

cat > 'src/app/dashboard/DashboardNav.tsx' << '__PRV1__'
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, ListOrdered, Package, ReceiptText, Wallet, Star, Settings,
} from 'lucide-react';

const LINKS = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/queue', label: 'Job queue', icon: ListOrdered },
  { href: '/dashboard/products', label: 'Products', icon: Package },
  { href: '/dashboard/orders', label: 'Orders', icon: ReceiptText },
  { href: '/dashboard/earnings', label: 'Earnings', icon: Wallet },
  { href: '/dashboard/reviews', label: 'Reviews', icon: Star },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];

const MOBILE = LINKS.slice(0, 5); // Overview · Queue · Products · Orders · Earnings

export function DashboardNav({ variant }: { variant: 'side' | 'bottom' }) {
  const pathname = usePathname();
  const isActive = (href: string, exact?: boolean) => (exact ? pathname === href : pathname.startsWith(href));

  if (variant === 'side') {
    return (
      <nav className="space-y-1" aria-label="Dashboard">
        {LINKS.map(({ href, label, icon: Icon, exact }) => (
          <Link
            key={href}
            href={href}
            aria-current={isActive(href, exact) ? 'page' : undefined}
            className={`flex items-center gap-2.5 rounded-pill px-4 py-2.5 font-display text-sm font-bold transition-colors ${
              isActive(href, exact) ? 'bg-blue text-white' : 'text-navy hover:bg-black/5'
            }`}
          >
            <Icon className="size-4" /> {label}
          </Link>
        ))}
      </nav>
    );
  }

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-black/10 bg-white/95 backdrop-blur md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Dashboard navigation"
    >
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {MOBILE.map(({ href, label, icon: Icon, exact }) => {
          const active = isActive(href, exact);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-16 flex-col items-center justify-center gap-1 ${active ? 'text-blue' : 'text-navy/50'}`}
              >
                <Icon className="size-[22px]" strokeWidth={active ? 2.4 : 2} />
                <span className="text-[10px] font-bold">{label.split(' ')[0]}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
__PRV1__
echo '  + src/app/dashboard/DashboardNav.tsx'

cat > 'src/app/dashboard/earnings/page.tsx' << '__PRV1__'
import type { Metadata } from 'next';
import Link from 'next/link';
import { and, desc, eq, sum, count } from 'drizzle-orm';
import { db, tables } from '@/db';
import { getMyShop } from '@/lib/auth';
import { getCategory } from '@/lib/categories';
import { naira, shortDate } from '@/lib/format';
import { EmptyState } from '@/components/ui/EmptyState';

export const metadata: Metadata = { title: 'Earnings' };

/** Screen 6 (spec §4): pricing quick-edit + payment history. Payouts proper come with Multi-Split. */
export default async function EarningsPage() {
  const shop = (await getMyShop())!;

  const [totals, paid, prods] = await Promise.all([
    db().select({ s: sum(tables.orders.priceKobo), c: count() }).from(tables.orders).where(and(
      eq(tables.orders.shopId, shop.id),
      eq(tables.orders.paymentStatus, 'paid'),
    )),
    db().select().from(tables.orders).where(and(
      eq(tables.orders.shopId, shop.id),
      eq(tables.orders.paymentStatus, 'paid'),
    )).orderBy(desc(tables.orders.createdAt)).limit(30),
    db().select().from(tables.products).where(eq(tables.products.shopId, shop.id)),
  ]);

  return (
    <div>
      <h1 className="font-display text-3xl font-extrabold tracking-tight text-black">Earnings</h1>

      <div className="mt-6 grid grid-cols-2 gap-3.5">
        <div className="rounded-2xl bg-navy p-5 text-white">
          <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-white/55">Total collected</p>
          <p className="mt-1.5 font-display text-2xl font-extrabold text-pale">{naira(Number(totals[0].s ?? 0))}</p>
        </div>
        <div className="rounded-2xl border border-black/12 bg-white p-5">
          <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-black/45">Paid orders</p>
          <p className="mt-1.5 font-display text-2xl font-extrabold text-navy">{totals[0].c}</p>
        </div>
      </div>
      <p className="mt-2.5 text-xs text-black/45">
        Automatic payouts (Paystack split) are on the roadmap — for now this shows what customers have paid.
      </p>

      <h2 className="mt-8 font-display text-lg font-extrabold text-navy">Your prices</h2>
      <ul className="mt-3 divide-y divide-dashed divide-black/15 rounded-2xl border border-black/12 bg-white">
        {prods.map((p) => (
          <li key={p.id} className="flex items-center justify-between px-5 py-3">
            <span className="font-display text-sm font-bold text-navy">{p.name}</span>
            <Link href={`/dashboard/products/${p.id}`} className="font-display text-sm font-bold text-blue">Edit pricing →</Link>
          </li>
        ))}
        {prods.length === 0 && <li className="px-5 py-4 text-sm text-black/50">No products yet.</li>}
      </ul>

      <h2 className="mt-8 font-display text-lg font-extrabold text-navy">Payment history</h2>
      {paid.length === 0 ? (
        <div className="mt-3"><EmptyState title="No payments yet" hint="Paid orders will list here." /></div>
      ) : (
        <ul className="mt-3 divide-y divide-dashed divide-black/15 rounded-2xl border border-black/12 bg-white">
          {paid.map((o) => (
            <li key={o.id} className="flex items-center justify-between px-5 py-3">
              <span className="text-sm text-black/60">
                <span className="font-mono font-bold text-navy">{o.code}</span> · {getCategory(o.spec.category)?.name} · {shortDate(o.createdAt)}
              </span>
              <span className="font-display text-sm font-extrabold text-success">+{naira(o.priceKobo)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
__PRV1__
echo '  + src/app/dashboard/earnings/page.tsx'

cat > 'src/app/dashboard/layout.tsx' << '__PRV1__'
import { redirect } from 'next/navigation';
import { getMyShop } from '@/lib/auth';
import { DashboardNav } from './DashboardNav';
import { CodeBadge } from '@/components/ui/CodeBadge';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const shop = await getMyShop();
  if (!shop) redirect('/login?as=printer&next=/dashboard');

  return (
    <div className="mx-auto flex max-w-6xl gap-8 px-4 py-8 sm:px-6">
      <aside className="hidden w-52 shrink-0 md:block">
        <div className="mb-5">
          <p className="font-display text-lg font-extrabold leading-tight text-navy">{shop.businessName}</p>
          <div className="mt-1.5"><CodeBadge code={shop.code} /></div>
        </div>
        <DashboardNav variant="side" />
      </aside>
      <div className="min-w-0 flex-1 pb-24 md:pb-0">{children}</div>
      {/* Mobile: the dashboard gets its own bottom tab bar */}
      <DashboardNav variant="bottom" />
    </div>
  );
}
__PRV1__
echo '  + src/app/dashboard/layout.tsx'

cat > 'src/app/dashboard/orders/page.tsx' << '__PRV1__'
import type { Metadata } from 'next';
import Link from 'next/link';
import { and, desc, eq } from 'drizzle-orm';
import { db, tables } from '@/db';
import { getMyShop } from '@/lib/auth';
import { getCategory } from '@/lib/categories';
import { naira, shortDate } from '@/lib/format';
import { EmptyState } from '@/components/ui/EmptyState';

export const metadata: Metadata = { title: 'Orders' };

const FILTERS = ['all', 'placed', 'printing', 'ready', 'completed', 'cancelled'] as const;

/** Screen 5 (spec §4): the full order list, filterable by status. */
export default async function ShopOrdersPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const shop = (await getMyShop())!;
  const { status } = await searchParams;
  const filter = FILTERS.includes(status as (typeof FILTERS)[number]) ? status : 'all';

  const rows = await db().select().from(tables.orders)
    .where(filter === 'all'
      ? eq(tables.orders.shopId, shop.id)
      : and(eq(tables.orders.shopId, shop.id), eq(tables.orders.status, filter as 'placed')))
    .orderBy(desc(tables.orders.createdAt))
    .limit(100);

  return (
    <div>
      <h1 className="font-display text-3xl font-extrabold tracking-tight text-black">Orders</h1>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <Link
            key={f}
            href={f === 'all' ? '/dashboard/orders' : `/dashboard/orders?status=${f}`}
            className={`rounded-pill px-3.5 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider ${
              filter === f ? 'bg-navy text-white' : 'border border-black/20 text-navy hover:border-black/45'
            }`}
          >
            {f}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="mt-6"><EmptyState title="Nothing here" hint={filter === 'all' ? 'Orders show up as customers buy.' : `No ${filter} orders right now.`} /></div>
      ) : (
        <ul className="mt-6 divide-y divide-dashed divide-black/15 rounded-2xl border border-black/12 bg-white">
          {rows.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-4">
              <div>
                <p className="font-display text-sm font-extrabold text-navy">
                  {getCategory(o.spec.category)?.name ?? o.spec.category}
                  <span className="ml-2 font-mono text-xs font-bold text-black/40">{o.code}</span>
                  {o.isQuote && o.paymentStatus === 'unpaid' && (
                    <span className="ml-2 rounded-pill bg-pale px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-navy">quote request</span>
                  )}
                </p>
                <p className="text-xs text-black/50">{shortDate(o.createdAt)} · {o.fulfillmentMethod} · payment {o.paymentStatus}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-navy/60">{o.status}</span>
                <span className="font-display text-sm font-extrabold text-navy">{naira(o.priceKobo)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
__PRV1__
echo '  + src/app/dashboard/orders/page.tsx'

cat > 'src/app/dashboard/page.tsx' << '__PRV1__'
import type { Metadata } from 'next';
import Link from 'next/link';
import { and, count, desc, eq, gte, inArray, sum } from 'drizzle-orm';
import { db, tables } from '@/db';
import { getMyShop } from '@/lib/auth';
import { getCategory } from '@/lib/categories';
import { naira, shortDate } from '@/lib/format';
import { ButtonLink } from '@/components/ui/Button';

export const metadata: Metadata = { title: 'Dashboard' };

/** Screen 2 (spec §4): stat cards + recent orders. */
export default async function DashboardPage() {
  const shop = (await getMyShop())!;
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);

  const [pending, week, listings, recent] = await Promise.all([
    db().select({ c: count() }).from(tables.orders).where(and(
      eq(tables.orders.shopId, shop.id),
      inArray(tables.orders.status, ['printing', 'ready']),
    )),
    db().select({ s: sum(tables.orders.priceKobo) }).from(tables.orders).where(and(
      eq(tables.orders.shopId, shop.id),
      eq(tables.orders.paymentStatus, 'paid'),
      gte(tables.orders.createdAt, weekAgo),
    )),
    db().select({ c: count() }).from(tables.products).where(and(
      eq(tables.products.shopId, shop.id),
      eq(tables.products.isActive, true),
    )),
    db().select().from(tables.orders)
      .where(eq(tables.orders.shopId, shop.id))
      .orderBy(desc(tables.orders.createdAt)).limit(6),
  ]);

  const stats = [
    { label: 'Pending jobs', value: String(pending[0].c) },
    { label: 'This week', value: naira(Number(week[0].s ?? 0)) },
    { label: 'Rating', value: shop.ratingCount ? `${shop.ratingAvg.toFixed(1)} ★` : '—' },
    { label: 'Active listings', value: String(listings[0].c) },
  ];

  return (
    <div>
      <h1 className="font-display text-3xl font-extrabold tracking-tight text-black">Overview</h1>

      <dl className="mt-6 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-black/12 bg-white p-5">
            <dt className="font-mono text-[10px] font-bold uppercase tracking-widest text-black/45">{s.label}</dt>
            <dd className="mt-1.5 font-display text-2xl font-extrabold text-navy">{s.value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-8 flex items-center justify-between">
        <h2 className="font-display text-lg font-extrabold text-navy">Recent orders</h2>
        <Link href="/dashboard/orders" className="font-display text-sm font-bold text-blue">See all →</Link>
      </div>
      {recent.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-black/20 p-8 text-center">
          <p className="font-display font-bold text-navy">No orders yet</p>
          <p className="mt-1 text-sm text-black/55">List your products so customers nearby can find you.</p>
          <ButtonLink href="/dashboard/products/new" size="sm" className="mt-4">Add a product</ButtonLink>
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-dashed divide-black/15 rounded-2xl border border-black/12 bg-white">
          {recent.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5">
              <div>
                <p className="font-display text-sm font-extrabold text-navy">
                  {getCategory(o.spec.category)?.name ?? o.spec.category}
                  <span className="ml-2 font-mono text-xs font-bold text-black/40">{o.code}</span>
                </p>
                <p className="text-xs text-black/50">{shortDate(o.createdAt)} · {o.fulfillmentMethod}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-navy/60">
                  {o.isQuote && o.paymentStatus === 'unpaid' ? 'quote' : o.status}
                </span>
                <span className="font-display text-sm font-extrabold text-navy">{naira(o.priceKobo)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
__PRV1__
echo '  + src/app/dashboard/page.tsx'

cat > 'src/app/dashboard/products/ProductForm.tsx' << '__PRV1__'
'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import { CATEGORIES, getCategory } from '@/lib/categories';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/Field';
import { saveProduct, type ProductPayload } from './actions';

/**
 * Screen 3 + §4.2 (spec): the form changes shape with the pricing mode.
 *  Per ft/sq.ft — rate (+ min charge)
 *  Quantity tier — repeatable qty/price/label rows
 *  Request quote — nothing to price
 * Plus per_sheet (business card Print-only), fixed sizes (frames) and the
 * jotter matrix. Add-ons are one shared component priced per option (§6).
 */

type TierRow = { qty: string; price: string; label: string };
type MatrixRow = { cover: string; size: string; sheets: string; price: string };
type AddonRow = { kind: string; label: string; basis: string; price: string };

export type InitialProduct = {
  id?: string;
  categorySlug: string;
  name: string;
  pricingMode: string;
  areaUnit: string | null;
  ratePerUnit: string;   // naira strings in the form; kobo in the DB
  minCharge: string;
  perSheet: string;
  cardsPerSheet: string;
  turnaroundHours: string;
  photoUrl: string;
  tiers: TierRow[];
  matrix: MatrixRow[];
  addons: AddonRow[];
};

const MODES_BY_CATEGORY: Record<string, { value: string; label: string; hint: string }[]> = {
  sticker: [
    { value: 'per_area', label: 'Per sq.ft / sq.in', hint: 'Large single stickers — size × rate' },
    { value: 'tier', label: 'Quantity tier', hint: 'Bulk small stickers — flat price per batch' },
    { value: 'quote', label: 'Request quote', hint: 'No price shown — customers send a request' },
  ],
  banner: [
    { value: 'per_area', label: 'Per sq.ft', hint: 'Width × height auto-calculates the price' },
    { value: 'quote', label: 'Request quote', hint: 'No price shown' },
  ],
  flyer: [
    { value: 'tier', label: 'Quantity tier', hint: 'e.g. 100pcs = ₦X' },
    { value: 'quote', label: 'Request quote', hint: 'No price shown' },
  ],
  business_card: [
    { value: 'tier', label: 'Print + Cut — quantity tiers', hint: 'Finished cards' },
    { value: 'per_sheet', label: 'Print only — per A4 sheet', hint: 'Customer cuts the cards themselves' },
    { value: 'quote', label: 'Request quote', hint: 'No price shown' },
  ],
  nylon: [
    { value: 'tier', label: 'Quantity tier', hint: 'Per batch' },
    { value: 'quote', label: 'Request quote', hint: 'No price shown' },
  ],
  jotter: [
    { value: 'matrix', label: 'Price matrix', hint: 'Cover × size × sheet count' },
    { value: 'quote', label: 'Request quote', hint: 'No price shown' },
  ],
  frame: [
    { value: 'fixed_size', label: 'Price per size', hint: 'A4 / A3 / A2 — closed list' },
    { value: 'quote', label: 'Request quote', hint: 'No price shown' },
  ],
};

const BASIS_LABEL: Record<string, string> = { per_piece: 'per piece', per_sheet: 'per sheet', flat: 'flat' };

export function ProductForm({ initial }: { initial: InitialProduct }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [category, setCategory] = useState(initial.categorySlug);
  const modes = MODES_BY_CATEGORY[category] ?? [{ value: 'quote', label: 'Request quote', hint: '' }];
  const [mode, setMode] = useState(initial.pricingMode || modes[0].value);
  const [name, setName] = useState(initial.name);
  const [areaUnit, setAreaUnit] = useState(initial.areaUnit ?? 'sqft');
  const [rate, setRate] = useState(initial.ratePerUnit);
  const [minCharge, setMinCharge] = useState(initial.minCharge);
  const [perSheet, setPerSheet] = useState(initial.perSheet);
  const [cardsPerSheet, setCardsPerSheet] = useState(initial.cardsPerSheet || '10');
  const [turnaround, setTurnaround] = useState(initial.turnaroundHours || '24');
  const [photoUrl, setPhotoUrl] = useState(initial.photoUrl);
  const [tiers, setTiers] = useState<TierRow[]>(initial.tiers.length ? initial.tiers : [{ qty: '100', price: '', label: '' }]);
  const [matrix, setMatrix] = useState<MatrixRow[]>(initial.matrix.length ? initial.matrix : [{ cover: 'Soft cover', size: 'A5', sheets: '40', price: '' }]);
  const [addons, setAddons] = useState<AddonRow[]>(initial.addons);

  const cat = getCategory(category);
  const validMode = modes.some((m) => m.value === mode) ? mode : modes[0].value;
  const fixedSizes = cat?.fixedSizes ?? [];
  const jotter = cat?.jotter;

  const addonKinds = useMemo(() => {
    const axes = cat?.addonAxes ?? [];
    return axes.map((a) => ({
      kind: a.kind,
      // paid options only — the first option of every axis is the free default
      options: a.options.slice(1),
    })).filter((a) => a.options.length);
  }, [cat]);

  function submit() {
    setError(null);
    const payload: ProductPayload = {
      id: initial.id,
      categorySlug: category,
      name: name.trim() || `${cat?.name ?? category}`,
      pricingMode: validMode,
      areaUnit: validMode === 'per_area' ? areaUnit : null,
      ratePerUnit: rate,
      minCharge,
      perSheet,
      cardsPerSheet,
      turnaroundHours: turnaround,
      photoUrl: photoUrl.trim(),
      tiers: validMode === 'tier'
        ? tiers
        : validMode === 'fixed_size'
          ? fixedSizes.map((s) => ({ qty: '1', price: tiers.find((t) => t.label === s)?.price ?? '', label: s }))
          : [],
      matrix: validMode === 'matrix' ? matrix : [],
      addons,
    };
    start(async () => {
      const res = await saveProduct(payload);
      if (res?.error) { setError(res.error); return; }
      router.push('/dashboard/products');
      router.refresh();
    });
  }

  const priceInput = (v: string, set: (s: string) => void, ph = '0') => (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-black/40">₦</span>
      <Input inputMode="numeric" value={v} onChange={(e) => set(e.target.value.replace(/[^\d]/g, ''))} placeholder={ph} className="!pl-7" />
    </div>
  );

  return (
    <div className="max-w-2xl space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Category">
          <Select value={category} onChange={(e) => { setCategory(e.target.value); setMode(MODES_BY_CATEGORY[e.target.value]?.[0].value ?? 'quote'); }}>
            {CATEGORIES.filter((c) => c.live).map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="Product name">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={`e.g. ${cat?.name ?? 'Product'}`} />
        </Field>
      </div>

      <div>
        <span className="mb-2.5 block font-display text-[13px] font-bold text-navy">Pricing mode</span>
        <div className="space-y-2" role="radiogroup" aria-label="Pricing mode">
          {modes.map((m) => (
            <button
              key={m.value}
              role="radio"
              aria-checked={validMode === m.value}
              onClick={() => setMode(m.value)}
              className={`flex w-full items-baseline justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition-colors ${
                validMode === m.value ? 'border-blue bg-blue text-white' : 'border-black/15 text-navy hover:border-black/35'
              }`}
            >
              <span className="font-display text-sm font-extrabold">{m.label}</span>
              <span className={`text-xs ${validMode === m.value ? 'text-white/75' : 'text-black/45'}`}>{m.hint}</span>
            </button>
          ))}
        </div>
      </div>

      {validMode === 'per_area' && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Rate">{priceInput(rate, setRate, '1800')}</Field>
          <Field label="Per">
            <Select value={areaUnit} onChange={(e) => setAreaUnit(e.target.value)}>
              <option value="sqft">sq.ft</option><option value="sqin">sq.inch</option>
            </Select>
          </Field>
          <Field label="Minimum charge" hint="Optional floor per piece">{priceInput(minCharge, setMinCharge)}</Field>
        </div>
      )}

      {validMode === 'per_sheet' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Price per A4 sheet">{priceInput(perSheet, setPerSheet, '1500')}</Field>
          <Field label="Cards per sheet" hint="Used to auto-calculate sheets from quantity">
            <Input inputMode="numeric" value={cardsPerSheet} onChange={(e) => setCardsPerSheet(e.target.value.replace(/\D/g, ''))} />
          </Field>
        </div>
      )}

      {validMode === 'tier' && (
        <div>
          <span className="mb-2.5 block font-display text-[13px] font-bold text-navy">Quantity tiers</span>
          <div className="space-y-2">
            {tiers.map((t, i) => (
              <div key={i} className="grid grid-cols-[90px_1fr_1fr_36px] items-center gap-2">
                <Input inputMode="numeric" aria-label="Quantity" value={t.qty}
                  onChange={(e) => setTiers(tiers.map((x, j) => (j === i ? { ...x, qty: e.target.value.replace(/\D/g, '') } : x)))} placeholder="100" />
                {priceInput(t.price, (v) => setTiers(tiers.map((x, j) => (j === i ? { ...x, price: v } : x))), '20000')}
                <Input aria-label="Variant label (optional)" value={t.label}
                  onChange={(e) => setTiers(tiers.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} placeholder="e.g. matte, single side" />
                <button aria-label="Remove tier" onClick={() => setTiers(tiers.filter((_, j) => j !== i))} className="text-black/35 hover:text-red" disabled={tiers.length === 1}>
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
          <Button variant="tertiary" size="sm" className="mt-2.5" onClick={() => setTiers([...tiers, { qty: '', price: '', label: '' }])}>
            <Plus className="size-4" /> Add tier
          </Button>
        </div>
      )}

      {validMode === 'fixed_size' && (
        <div>
          <span className="mb-2.5 block font-display text-[13px] font-bold text-navy">Price per size</span>
          <div className="space-y-2">
            {fixedSizes.map((s) => (
              <div key={s} className="grid grid-cols-[70px_1fr] items-center gap-3">
                <span className="font-mono text-sm font-bold text-navy">{s}</span>
                {priceInput(
                  tiers.find((t) => t.label === s)?.price ?? '',
                  (v) => setTiers((prev) => {
                    const others = prev.filter((t) => t.label !== s);
                    return [...others, { qty: '1', price: v, label: s }];
                  }),
                )}
              </div>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-black/45">Leave a size empty to not offer it — those requests fall back to quote.</p>
        </div>
      )}

      {validMode === 'matrix' && jotter && (
        <div>
          <span className="mb-2.5 block font-display text-[13px] font-bold text-navy">Price matrix (per piece)</span>
          <div className="space-y-2">
            {matrix.map((r, i) => (
              <div key={i} className="grid grid-cols-[1fr_80px_100px_1fr_36px] items-center gap-2">
                <Select aria-label="Cover" value={r.cover} onChange={(e) => setMatrix(matrix.map((x, j) => (j === i ? { ...x, cover: e.target.value } : x)))}>
                  {jotter.covers.map((c) => <option key={c}>{c}</option>)}
                </Select>
                <Select aria-label="Size" value={r.size} onChange={(e) => setMatrix(matrix.map((x, j) => (j === i ? { ...x, size: e.target.value } : x)))}>
                  {jotter.sizes.map((c) => <option key={c}>{c}</option>)}
                </Select>
                <Select aria-label="Sheets" value={r.sheets} onChange={(e) => setMatrix(matrix.map((x, j) => (j === i ? { ...x, sheets: e.target.value } : x)))}>
                  {jotter.sheets.map((c) => <option key={c} value={String(c)}>{c} sh</option>)}
                </Select>
                {priceInput(r.price, (v) => setMatrix(matrix.map((x, j) => (j === i ? { ...x, price: v } : x))))}
                <button aria-label="Remove row" onClick={() => setMatrix(matrix.filter((_, j) => j !== i))} className="text-black/35 hover:text-red" disabled={matrix.length === 1}>
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
          <Button variant="tertiary" size="sm" className="mt-2.5" onClick={() => setMatrix([...matrix, { cover: jotter.covers[0], size: jotter.sizes[0], sheets: String(jotter.sheets[0]), price: '' }])}>
            <Plus className="size-4" /> Add row
          </Button>
        </div>
      )}

      {validMode !== 'quote' && addonKinds.length > 0 && (
        <div>
          <span className="mb-1 block font-display text-[13px] font-bold text-navy">Add-on pricing</span>
          <p className="mb-2.5 text-xs text-black/45">
            Price the options you offer. Any option a customer picks that you haven&apos;t priced falls back to Request Quote.
          </p>
          <div className="space-y-2">
            {addons.map((a, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_110px_36px] items-center gap-2">
                <Select aria-label="Option" value={`${a.kind}::${a.label}`}
                  onChange={(e) => {
                    const [kind, label] = e.target.value.split('::');
                    setAddons(addons.map((x, j) => (j === i ? { ...x, kind, label } : x)));
                  }}>
                  {addonKinds.flatMap((k) => k.options.map((o) => (
                    <option key={`${k.kind}::${o}`} value={`${k.kind}::${o}`}>{o}</option>
                  )))}
                </Select>
                {priceInput(a.price, (v) => setAddons(addons.map((x, j) => (j === i ? { ...x, price: v } : x))), '500')}
                <Select aria-label="Basis" value={a.basis} onChange={(e) => setAddons(addons.map((x, j) => (j === i ? { ...x, basis: e.target.value } : x)))}>
                  {Object.entries(BASIS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </Select>
                <button aria-label="Remove add-on" onClick={() => setAddons(addons.filter((_, j) => j !== i))} className="text-black/35 hover:text-red">
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
          <Button variant="tertiary" size="sm" className="mt-2.5"
            onClick={() => setAddons([...addons, { kind: addonKinds[0].kind, label: addonKinds[0].options[0], basis: validMode === 'per_sheet' ? 'per_sheet' : 'per_piece', price: '' }])}>
            <Plus className="size-4" /> Price an add-on
          </Button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Turnaround (hours)">
          <Input inputMode="numeric" value={turnaround} onChange={(e) => setTurnaround(e.target.value.replace(/\D/g, ''))} />
        </Field>
        <Field label="Photo URL (optional)" hint="Real photos of your work build trust — icons are the fallback.">
          <Input value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} placeholder="https://…" />
        </Field>
      </div>

      {error && <p className="rounded-xl border border-red/30 bg-red/5 px-3.5 py-2.5 text-sm text-red">{error}</p>}

      <Button onClick={submit} disabled={pending} className="w-full sm:w-auto">
        {pending ? 'Saving…' : initial.id ? 'Save changes' : 'Publish product'} <span aria-hidden>→</span>
      </Button>
    </div>
  );
}
__PRV1__
echo '  + src/app/dashboard/products/ProductForm.tsx'

cat > 'src/app/dashboard/products/ToggleActive.tsx' << '__PRV1__'
'use client';

import { useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { toggleProduct } from './actions';

export function ToggleActive({ productId, isActive }: { productId: string; isActive: boolean }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant={isActive ? 'secondary' : 'tertiary'}
      size="sm"
      disabled={pending}
      onClick={() => start(async () => { await toggleProduct(productId); })}
    >
      {isActive ? 'Live' : 'Hidden'}
    </Button>
  );
}
__PRV1__
echo '  + src/app/dashboard/products/ToggleActive.tsx'

cat > 'src/app/dashboard/products/[id]/page.tsx' << '__PRV1__'
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { db, tables } from '@/db';
import { getMyShop } from '@/lib/auth';
import { ProductForm } from '../ProductForm';

export const metadata: Metadata = { title: 'Edit product' };

const fromKobo = (k: number | null) => (k ? String(k / 100) : '');

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const shop = (await getMyShop())!;

  const [p] = await db().select().from(tables.products)
    .where(and(eq(tables.products.id, id), eq(tables.products.shopId, shop.id))).limit(1);
  if (!p) notFound();

  const [variants, addons] = await Promise.all([
    db().select().from(tables.productVariants).where(eq(tables.productVariants.productId, p.id)),
    db().select().from(tables.productAddons).where(eq(tables.productAddons.productId, p.id)),
  ]);

  return (
    <div>
      <h1 className="mb-6 font-display text-3xl font-extrabold tracking-tight text-black">Edit product</h1>
      <ProductForm initial={{
        id: p.id,
        categorySlug: p.categorySlug,
        name: p.name,
        pricingMode: p.pricingMode,
        areaUnit: p.areaUnit,
        ratePerUnit: fromKobo(p.ratePerUnitKobo),
        minCharge: fromKobo(p.minChargeKobo),
        perSheet: fromKobo(p.perSheetKobo),
        cardsPerSheet: p.cardsPerSheet ? String(p.cardsPerSheet) : '10',
        turnaroundHours: String(p.turnaroundHours),
        photoUrl: p.photoUrl ?? '',
        tiers: p.pricingMode === 'matrix' ? [] : variants.map((v) => ({
          qty: v.qty ? String(v.qty) : '1',
          price: fromKobo(v.priceKobo),
          label: v.label ?? '',
        })),
        matrix: p.pricingMode === 'matrix' ? variants.map((v) => ({
          cover: String(v.meta?.cover ?? 'Soft cover'),
          size: String(v.meta?.size ?? 'A5'),
          sheets: String(v.meta?.sheets ?? 40),
          price: fromKobo(v.priceKobo),
        })) : [],
        addons: addons.map((a) => ({ kind: a.kind, label: a.label, basis: a.basis, price: fromKobo(a.priceKobo) })),
      }} />
    </div>
  );
}
__PRV1__
echo '  + src/app/dashboard/products/[id]/page.tsx'

cat > 'src/app/dashboard/products/actions.ts' << '__PRV1__'
'use server';

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { db, tables } from '@/db';
import { getMyShop } from '@/lib/auth';
import { getCategory } from '@/lib/categories';

export type ProductPayload = {
  id?: string;
  categorySlug: string;
  name: string;
  pricingMode: string;
  areaUnit: string | null;
  ratePerUnit: string;
  minCharge: string;
  perSheet: string;
  cardsPerSheet: string;
  turnaroundHours: string;
  photoUrl: string;
  tiers: { qty: string; price: string; label: string }[];
  matrix: { cover: string; size: string; sheets: string; price: string }[];
  addons: { kind: string; label: string; basis: string; price: string }[];
};

const toKobo = (naira: string) => Math.round(Number(naira || 0) * 100);
const MODES = ['per_area', 'per_sheet', 'tier', 'fixed_size', 'matrix', 'quote'] as const;
const KINDS = ['lamination', 'gsm', 'corner', 'sides'] as const;
const BASES = ['per_sheet', 'per_piece', 'flat'] as const;

export async function saveProduct(p: ProductPayload) {
  const shop = await getMyShop();
  if (!shop) return { error: 'Not your shop.' };

  const cat = getCategory(p.categorySlug);
  if (!cat?.live) return { error: 'Unknown category.' };
  const mode = MODES.includes(p.pricingMode as (typeof MODES)[number]) ? p.pricingMode as (typeof MODES)[number] : 'quote';

  if (mode === 'per_area' && toKobo(p.ratePerUnit) <= 0) return { error: 'Set a rate for per-area pricing.' };
  if (mode === 'per_sheet' && (toKobo(p.perSheet) <= 0 || Number(p.cardsPerSheet) <= 0)) {
    return { error: 'Set the sheet price and cards-per-sheet.' };
  }

  const tiers = p.tiers
    .filter((t) => Number(t.qty) > 0 && toKobo(t.price) > 0)
    .map((t) => ({ qty: Number(t.qty), priceKobo: toKobo(t.price), label: t.label.trim() || null }));
  if (mode === 'tier' && !tiers.length) return { error: 'Add at least one quantity tier with a price.' };

  const sizes = p.tiers
    .filter((t) => t.label && toKobo(t.price) > 0)
    .map((t) => ({ qty: 1, priceKobo: toKobo(t.price), label: t.label }));
  if (mode === 'fixed_size' && !sizes.length) return { error: 'Price at least one size.' };

  const matrix = p.matrix
    .filter((r) => toKobo(r.price) > 0)
    .map((r) => ({
      qty: null,
      priceKobo: toKobo(r.price),
      label: `${r.cover} / ${r.size} / ${r.sheets}`,
      meta: { cover: r.cover, size: r.size, sheets: Number(r.sheets) },
    }));
  if (mode === 'matrix' && !matrix.length) return { error: 'Add at least one priced matrix row.' };

  const addons = p.addons
    .filter((a) => toKobo(a.price) > 0 && KINDS.includes(a.kind as (typeof KINDS)[number]) && BASES.includes(a.basis as (typeof BASES)[number]))
    .map((a) => ({
      kind: a.kind as (typeof KINDS)[number],
      label: a.label,
      basis: a.basis as (typeof BASES)[number],
      priceKobo: toKobo(a.price),
    }));

  const values = {
    shopId: shop.id,
    categorySlug: p.categorySlug,
    name: p.name.slice(0, 120),
    pricingMode: mode,
    areaUnit: mode === 'per_area' ? (p.areaUnit === 'sqin' ? 'sqin' as const : 'sqft' as const) : null,
    ratePerUnitKobo: mode === 'per_area' ? toKobo(p.ratePerUnit) : null,
    minChargeKobo: mode === 'per_area' && toKobo(p.minCharge) > 0 ? toKobo(p.minCharge) : null,
    perSheetKobo: mode === 'per_sheet' ? toKobo(p.perSheet) : null,
    cardsPerSheet: mode === 'per_sheet' ? Number(p.cardsPerSheet) : null,
    turnaroundHours: Math.max(1, Number(p.turnaroundHours) || 24),
    photoUrl: p.photoUrl || null,
  };

  let productId = p.id ?? null;
  if (productId) {
    const res = await db().update(tables.products).set(values)
      .where(and(eq(tables.products.id, productId), eq(tables.products.shopId, shop.id)))
      .returning({ id: tables.products.id });
    if (!res.length) return { error: 'Product not found.' };
    // Replace variant + addon rows wholesale — simplest correct thing at this scale.
    await db().delete(tables.productVariants).where(eq(tables.productVariants.productId, productId));
    await db().delete(tables.productAddons).where(eq(tables.productAddons.productId, productId));
  } else {
    const [row] = await db().insert(tables.products).values(values).returning({ id: tables.products.id });
    productId = row.id;
  }

  const variantRows = mode === 'tier' ? tiers : mode === 'fixed_size' ? sizes : mode === 'matrix' ? matrix : [];
  if (variantRows.length) {
    await db().insert(tables.productVariants).values(variantRows.map((v) => ({ ...v, productId: productId! })));
  }
  if (addons.length && mode !== 'quote') {
    await db().insert(tables.productAddons).values(addons.map((a) => ({ ...a, productId: productId! })));
  }

  revalidatePath('/dashboard/products');
  return { ok: true } as const;
}

export async function toggleProduct(productId: string) {
  const shop = await getMyShop();
  if (!shop) return { error: 'Not your shop.' };
  const [row] = await db().select().from(tables.products)
    .where(and(eq(tables.products.id, productId), eq(tables.products.shopId, shop.id))).limit(1);
  if (!row) return { error: 'Not found.' };
  await db().update(tables.products).set({ isActive: !row.isActive }).where(eq(tables.products.id, productId));
  revalidatePath('/dashboard/products');
  return { ok: true } as const;
}
__PRV1__
echo '  + src/app/dashboard/products/actions.ts'

cat > 'src/app/dashboard/products/new/page.tsx' << '__PRV1__'
import type { Metadata } from 'next';
import { ProductForm } from '../ProductForm';

export const metadata: Metadata = { title: 'Add product' };

export default function NewProductPage() {
  return (
    <div>
      <h1 className="mb-6 font-display text-3xl font-extrabold tracking-tight text-black">Add product</h1>
      <ProductForm initial={{
        categorySlug: 'sticker', name: '', pricingMode: 'per_area',
        areaUnit: 'sqft', ratePerUnit: '', minCharge: '', perSheet: '', cardsPerSheet: '10',
        turnaroundHours: '24', photoUrl: '', tiers: [], matrix: [], addons: [],
      }} />
    </div>
  );
}
__PRV1__
echo '  + src/app/dashboard/products/new/page.tsx'

cat > 'src/app/dashboard/products/page.tsx' << '__PRV1__'
import type { Metadata } from 'next';
import Link from 'next/link';
import { desc, eq } from 'drizzle-orm';
import { db, tables } from '@/db';
import { getMyShop } from '@/lib/auth';
import { getCategory } from '@/lib/categories';
import { Glyph } from '@/components/ui/Glyph';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ToggleActive } from './ToggleActive';

export const metadata: Metadata = { title: 'Products' };

const MODE_LABEL: Record<string, string> = {
  per_area: 'Per sq.ft / sq.in',
  per_sheet: 'Per A4 sheet',
  tier: 'Quantity tiers',
  fixed_size: 'Fixed sizes',
  matrix: 'Price matrix',
  quote: 'Request quote',
};

export default async function ShopProductsPage() {
  const shop = (await getMyShop())!;
  const rows = await db().select().from(tables.products)
    .where(eq(tables.products.shopId, shop.id))
    .orderBy(desc(tables.products.createdAt));

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-black">Products</h1>
        <ButtonLink href="/dashboard/products/new" size="sm">+ Add product</ButtonLink>
      </div>

      {rows.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="No listings yet"
            hint="Customers only see printers with a product in the category they're configuring."
            action={<ButtonLink href="/dashboard/products/new">Add your first product</ButtonLink>}
          />
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {rows.map((p) => {
            const cat = getCategory(p.categorySlug);
            return (
              <li key={p.id} className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white p-4 ${p.isActive ? 'border-black/12' : 'border-dashed border-black/25 opacity-70'}`}>
                <div className="flex items-center gap-3.5">
                  {cat && <Glyph kind={cat.glyph} color={cat.hue} className="size-10" />}
                  <div>
                    <p className="font-display font-extrabold text-navy">{p.name}</p>
                    <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-black/45">
                      {cat?.name} · {MODE_LABEL[p.pricingMode]} · ~{p.turnaroundHours}hrs
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <ToggleActive productId={p.id} isActive={p.isActive} />
                  <ButtonLink href={`/dashboard/products/${p.id}`} variant="tertiary" size="sm">Edit</ButtonLink>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
__PRV1__
echo '  + src/app/dashboard/products/page.tsx'

cat > 'src/app/dashboard/queue/QueueActions.tsx' << '__PRV1__'
'use client';

import { useState, useTransition } from 'react';
import { Download, CheckCircle2, Bike, BellRing, Lock } from 'lucide-react';
import { Button, ButtonLink } from '@/components/ui/Button';
import { markPrintingDone, completeJob } from './actions';

/**
 * The three-button logic, exactly as specced (§4.1):
 *  1 Download file — always available once the job is in the queue
 *  2 Mark printing done — flips status, turns solid green once pressed
 *  3 Dispatch Rider / Notify for Pickup — same slot, adapts to the order's
 *    fulfillment_method, LOCKED until Button 2 has been pressed
 */
export function QueueActions({
  orderId, status, method, fileUrl,
}: { orderId: string; status: string; method: 'delivery' | 'pickup'; fileUrl: string | null }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const done = status === 'ready';

  function run(action: (id: string) => Promise<{ error?: string } | undefined>) {
    setError(null);
    start(async () => {
      const res = await action(orderId);
      if (res?.error) setError(res.error);
    });
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2.5">
        {fileUrl ? (
          <ButtonLink href={fileUrl} target="_blank" variant="tertiary" size="sm">
            <Download className="size-4" /> Download file
          </ButtonLink>
        ) : (
          <Button variant="tertiary" size="sm" disabled title="Customer didn't attach a file">
            <Download className="size-4" /> No file attached
          </Button>
        )}

        <Button
          size="sm"
          onClick={() => run(markPrintingDone)}
          disabled={done || pending}
          className={done ? '!border-success !bg-success !text-white !opacity-100' : ''}
        >
          <CheckCircle2 className="size-4" /> {done ? 'Printing done ✓' : 'Mark printing done'}
        </Button>

        <Button
          size="sm"
          variant="secondary"
          onClick={() => run(completeJob)}
          disabled={!done || pending}
          title={done ? undefined : 'Finish printing first'}
        >
          {done ? (
            method === 'delivery' ? <Bike className="size-4" /> : <BellRing className="size-4" />
          ) : (
            <Lock className="size-4" />
          )}
          {method === 'delivery' ? 'Dispatch rider' : 'Notify customer for pickup'}
        </Button>
      </div>
      {error && <p className="mt-2 text-sm text-red">{error}</p>}
    </div>
  );
}
__PRV1__
echo '  + src/app/dashboard/queue/QueueActions.tsx'

cat > 'src/app/dashboard/queue/actions.ts' << '__PRV1__'
'use server';

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { db, tables } from '@/db';
import { getMyShop } from '@/lib/auth';

/** Button 2 — flips the printed status: printing → ready. */
export async function markPrintingDone(orderId: string) {
  const shop = await getMyShop();
  if (!shop) return { error: 'Not your shop.' };

  const res = await db().update(tables.orders)
    .set({ status: 'ready', readyAt: new Date(), updatedAt: new Date() })
    .where(and(
      eq(tables.orders.id, orderId),
      eq(tables.orders.shopId, shop.id),
      eq(tables.orders.status, 'printing'), // valid transition only
    ))
    .returning({ id: tables.orders.id });
  if (!res.length) return { error: 'This job is not in a printable state.' };

  revalidatePath('/dashboard/queue');
  return { ok: true } as const;
}

/**
 * Button 3 — Dispatch Rider / Notify for Pickup. Guarded server-side too:
 * nothing dispatches or notifies before printing is done (spec §4.1).
 * V1 notification = this status flip, which the customer's tracker reads.
 */
export async function completeJob(orderId: string) {
  const shop = await getMyShop();
  if (!shop) return { error: 'Not your shop.' };

  const res = await db().update(tables.orders)
    .set({ status: 'completed', completedAt: new Date(), updatedAt: new Date() })
    .where(and(
      eq(tables.orders.id, orderId),
      eq(tables.orders.shopId, shop.id),
      eq(tables.orders.status, 'ready'), // locked until Button 2 was pressed
    ))
    .returning({ id: tables.orders.id });
  if (!res.length) return { error: 'Finish printing first — this job is not marked done.' };

  revalidatePath('/dashboard/queue');
  return { ok: true } as const;
}
__PRV1__
echo '  + src/app/dashboard/queue/actions.ts'

cat > 'src/app/dashboard/queue/page.tsx' << '__PRV1__'
import type { Metadata } from 'next';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { db, tables } from '@/db';
import { getMyShop } from '@/lib/auth';
import { getCategory } from '@/lib/categories';
import { specSummary } from '@/lib/spec';
import { naira } from '@/lib/format';
import { EmptyState } from '@/components/ui/EmptyState';
import { QueueActions } from './QueueActions';

export const metadata: Metadata = { title: 'Job queue' };

/**
 * Screen 4 + §4.1 (spec): numbered jobs, three buttons.
 * Paid orders arrive here as 'printing'; Button 2 flips to 'ready';
 * Button 3 (Dispatch / Notify — adapts to fulfillment_method) completes,
 * and stays locked until Button 2 has been pressed.
 */
export default async function QueuePage() {
  const shop = (await getMyShop())!;
  const jobs = await db().select().from(tables.orders).where(and(
    eq(tables.orders.shopId, shop.id),
    inArray(tables.orders.status, ['printing', 'ready']),
  )).orderBy(asc(tables.orders.createdAt));

  return (
    <div>
      <h1 className="font-display text-3xl font-extrabold tracking-tight text-black">Job queue</h1>
      <p className="mt-1.5 text-sm text-black/55">Oldest first. Completing a job updates the customer&apos;s tracker instantly.</p>

      {jobs.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="Queue is clear" hint="Paid jobs land here automatically, numbered and ready to print." />
        </div>
      ) : (
        <ol className="mt-6 space-y-4">
          {jobs.map((job, i) => (
            <li key={job.id} className="rounded-2xl border border-black/12 bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex gap-3.5">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-navy font-mono text-sm font-bold text-pale">
                    {i + 1}
                  </span>
                  <div>
                    <p className="font-display font-extrabold text-navy">
                      {getCategory(job.spec.category)?.name ?? job.spec.category}
                      <span className="ml-2 font-mono text-xs font-bold text-black/40">{job.code}</span>
                    </p>
                    <p className="mt-0.5 font-mono text-xs text-black/55">{specSummary(job.spec).join(' · ')}</p>
                    {job.printNote && (
                      <p className="mt-1.5 rounded-lg bg-pale/40 px-2.5 py-1.5 text-xs text-navy">
                        <span className="font-bold">Note:</span> {job.printNote}
                      </p>
                    )}
                    <p className="mt-1.5 text-xs text-black/50">
                      {job.fulfillmentMethod === 'pickup' ? 'Self-pickup' : `Deliver to: ${job.deliveryAddress}`}
                    </p>
                  </div>
                </div>
                <span className="font-display font-extrabold text-navy">{naira(job.priceKobo)}</span>
              </div>
              <div className="mt-4 border-t border-dashed border-black/25 pt-4">
                <QueueActions
                  orderId={job.id}
                  status={job.status}
                  method={job.fulfillmentMethod}
                  fileUrl={job.designFileUrl}
                />
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
__PRV1__
echo '  + src/app/dashboard/queue/page.tsx'

cat > 'src/app/dashboard/reviews/page.tsx' << '__PRV1__'
import type { Metadata } from 'next';
import { desc, eq } from 'drizzle-orm';
import { Star } from 'lucide-react';
import { db, tables } from '@/db';
import { getMyShop } from '@/lib/auth';
import { shortDate } from '@/lib/format';
import { EmptyState } from '@/components/ui/EmptyState';

export const metadata: Metadata = { title: 'Reviews' };

export default async function ReviewsPage() {
  const shop = (await getMyShop())!;
  const rows = await db().select({
    review: tables.reviews,
    firstName: tables.users.firstName,
  })
    .from(tables.reviews)
    .innerJoin(tables.users, eq(tables.reviews.customerId, tables.users.id))
    .where(eq(tables.reviews.shopId, shop.id))
    .orderBy(desc(tables.reviews.createdAt))
    .limit(50);

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-black">Reviews</h1>
        {shop.ratingCount > 0 && (
          <p className="font-display font-extrabold text-navy">{shop.ratingAvg.toFixed(1)} ★ <span className="text-sm font-bold text-black/45">({shop.ratingCount})</span></p>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="mt-6"><EmptyState title="No reviews yet" hint="Customers can rate each completed order." /></div>
      ) : (
        <ul className="mt-6 space-y-3">
          {rows.map(({ review, firstName }) => (
            <li key={review.id} className="rounded-2xl border border-black/12 bg-white p-5">
              <div className="flex items-center justify-between">
                <span className="flex gap-0.5" aria-label={`${review.rating} out of 5`}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star key={n} className={`size-4 ${n <= review.rating ? 'fill-pale text-navy' : 'text-black/20'}`} />
                  ))}
                </span>
                <span className="text-xs text-black/45">{firstName} · {shortDate(review.createdAt)}</span>
              </div>
              {review.comment && <p className="mt-2.5 text-sm leading-relaxed text-black/70">{review.comment}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
__PRV1__
echo '  + src/app/dashboard/reviews/page.tsx'

cat > 'src/app/dashboard/settings/SettingsForm.tsx' << '__PRV1__'
'use client';

import { useState, useTransition } from 'react';
import { LocateFixed } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { saveSettings } from './actions';

type Initial = {
  businessName: string; bio: string; addressText: string; openingHours: string;
  logoUrl: string; bannerUrl: string; supportsPickup: boolean; supportsDelivery: boolean; hasLocation: boolean;
};

export function SettingsForm({ initial }: { initial: Initial }) {
  const [form, setForm] = useState(initial);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const set = (k: keyof Initial) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  function locate() {
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => { setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }); setLocating(false); },
      () => setLocating(false),
      { timeout: 8000 },
    );
  }

  function save() {
    setMsg(null);
    start(async () => {
      const res = await saveSettings({ ...form, ...(coords ?? {}) });
      setMsg(res?.error ?? 'Saved.');
    });
  }

  return (
    <div className="max-w-xl space-y-4">
      <Field label="Business name"><Input value={form.businessName} onChange={set('businessName')} /></Field>
      <Field label="Bio"><Textarea rows={3} value={form.bio} onChange={set('bio')} placeholder="What you print best, since when…" /></Field>
      <Field label="Address"><Input value={form.addressText} onChange={set('addressText')} /></Field>
      <div className="flex items-center gap-3">
        <Button type="button" variant="tertiary" size="sm" onClick={locate} disabled={locating}>
          <LocateFixed className="size-4" />
          {coords ? 'Location updated ✓' : locating ? 'Locating…' : initial.hasLocation ? 'Update pin to my location' : 'Set my location'}
        </Button>
        {!initial.hasLocation && !coords && (
          <span className="text-xs text-red">No location set — customers can&apos;t find you by distance.</span>
        )}
      </div>
      <Field label="Opening hours"><Input value={form.openingHours} onChange={set('openingHours')} placeholder="e.g. Mon–Sat, 8am–7pm" /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Logo URL"><Input value={form.logoUrl} onChange={set('logoUrl')} placeholder="https://…" /></Field>
        <Field label="Banner URL"><Input value={form.bannerUrl} onChange={set('bannerUrl')} placeholder="https://…" /></Field>
      </div>
      <div className="flex flex-wrap gap-5 rounded-2xl border border-black/12 bg-pale/25 p-4">
        <label className="inline-flex items-center gap-2 font-display text-[13px] font-bold text-navy">
          <input type="checkbox" className="size-4 accent-blue" checked={form.supportsDelivery}
            onChange={(e) => setForm((f) => ({ ...f, supportsDelivery: e.target.checked }))} />
          I deliver (riders)
        </label>
        <label className="inline-flex items-center gap-2 font-display text-[13px] font-bold text-navy">
          <input type="checkbox" className="size-4 accent-blue" checked={form.supportsPickup}
            onChange={(e) => setForm((f) => ({ ...f, supportsPickup: e.target.checked }))} />
          Customers can self-pickup
        </label>
      </div>
      {msg && <p className={`text-sm ${msg === 'Saved.' ? 'text-success' : 'text-red'}`}>{msg}</p>}
      <Button onClick={save} disabled={pending}>{pending ? 'Saving…' : 'Save settings'}</Button>
    </div>
  );
}
__PRV1__
echo '  + src/app/dashboard/settings/SettingsForm.tsx'

cat > 'src/app/dashboard/settings/actions.ts' << '__PRV1__'
'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db, tables } from '@/db';
import { getMyShop } from '@/lib/auth';

export async function saveSettings(input: {
  businessName: string; bio: string; addressText: string; openingHours: string;
  logoUrl: string; bannerUrl: string; supportsPickup: boolean; supportsDelivery: boolean;
  lat?: number; lng?: number;
}) {
  const shop = await getMyShop();
  if (!shop) return { error: 'Not your shop.' };
  if (!input.businessName.trim()) return { error: 'Business name is required.' };
  if (!input.supportsDelivery && !input.supportsPickup) {
    return { error: 'Enable delivery or pickup — customers need at least one way to get their order.' };
  }

  await db().update(tables.shops).set({
    businessName: input.businessName.trim().slice(0, 120),
    bio: input.bio.trim().slice(0, 400) || null,
    addressText: input.addressText.trim().slice(0, 240) || null,
    openingHours: input.openingHours.trim().slice(0, 120) || null,
    logoUrl: input.logoUrl.trim() || null,
    bannerUrl: input.bannerUrl.trim() || null,
    supportsPickup: input.supportsPickup,
    supportsDelivery: input.supportsDelivery,
    ...(input.lat != null && input.lng != null ? { lat: input.lat, lng: input.lng } : {}),
  }).where(eq(tables.shops.id, shop.id));

  revalidatePath('/dashboard/settings');
  return { ok: true } as const;
}
__PRV1__
echo '  + src/app/dashboard/settings/actions.ts'

cat > 'src/app/dashboard/settings/page.tsx' << '__PRV1__'
import type { Metadata } from 'next';
import { getMyShop } from '@/lib/auth';
import { SettingsForm } from './SettingsForm';

export const metadata: Metadata = { title: 'Shop settings' };

/** Screen 7 (spec §4): business name, images, location, hours, bio. */
export default async function SettingsPage() {
  const shop = (await getMyShop())!;
  return (
    <div>
      <h1 className="mb-6 font-display text-3xl font-extrabold tracking-tight text-black">Shop settings</h1>
      <SettingsForm initial={{
        businessName: shop.businessName,
        bio: shop.bio ?? '',
        addressText: shop.addressText ?? '',
        openingHours: shop.openingHours ?? '',
        logoUrl: shop.logoUrl ?? '',
        bannerUrl: shop.bannerUrl ?? '',
        supportsPickup: shop.supportsPickup,
        supportsDelivery: shop.supportsDelivery,
        hasLocation: shop.lat != null,
      }} />
    </div>
  );
}
__PRV1__
echo '  + src/app/dashboard/settings/page.tsx'

