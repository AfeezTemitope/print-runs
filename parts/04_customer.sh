#!/usr/bin/env bash
set -euo pipefail
# Customer flow: picker, configurator, printer selection, checkout, Paystack, track, orders

mkdir -p 'src/app/api/checkout' 'src/app/api/paystack/webhook' 'src/app/api/upload' 'src/app/checkout' 'src/app/checkout/callback' 'src/app/configure/[category]' 'src/app/orders' 'src/app/orders/[id]' 'src/app/printers' 'src/app/products' 'src/app/track'

cat > 'src/app/api/checkout/route.ts' << '__PRV1__'
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, tables } from '@/db';
import { getSession } from '@/lib/auth';
import { getCategory } from '@/lib/categories';
import { computePrice } from '@/lib/pricing';
import { specFromParams } from '@/lib/spec';
import { paystackInitialize } from '@/lib/paystack';
import { orderCode } from '@/lib/format';

/**
 * Creates the order and (for priced orders) hands off to Paystack.
 * Price is recomputed server-side from the spec — the client sends no amount.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Log in to place an order.' }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, string> | null;
  if (!body) return NextResponse.json({ error: 'Bad request.' }, { status: 400 });

  const spec = specFromParams(body);
  const shopId = body.shop;
  const productId = body.product;
  const method = body.fulfillmentMethod === 'pickup' ? 'pickup' : 'delivery';

  if (!spec || !shopId || !productId || !getCategory(spec.category)) {
    return NextResponse.json({ error: 'Order details are incomplete.' }, { status: 400 });
  }

  const [shop] = await db().select().from(tables.shops).where(eq(tables.shops.id, shopId)).limit(1);
  const [product] = await db().select().from(tables.products).where(eq(tables.products.id, productId)).limit(1);
  if (!shop || !product || product.shopId !== shop.id || !product.isActive) {
    return NextResponse.json({ error: 'That printer or product is no longer available.' }, { status: 404 });
  }
  if (method === 'pickup' && !shop.supportsPickup) {
    return NextResponse.json({ error: 'This printer does not offer self-pickup.' }, { status: 400 });
  }
  if (method === 'delivery' && (body.deliveryAddress ?? '').trim().length < 6) {
    return NextResponse.json({ error: 'Enter a delivery address.' }, { status: 400 });
  }

  const [variants, addons] = await Promise.all([
    db().select().from(tables.productVariants).where(eq(tables.productVariants.productId, product.id)),
    db().select().from(tables.productAddons).where(eq(tables.productAddons.productId, product.id)),
  ]);
  const price = computePrice(spec, product, variants, addons);
  const isQuote = !price.ok;

  const [user] = await db().select().from(tables.users).where(eq(tables.users.id, session.uid)).limit(1);
  if (!user) return NextResponse.json({ error: 'Session expired — log in again.' }, { status: 401 });

  const code = orderCode();
  const [order] = await db().insert(tables.orders).values({
    code,
    customerId: user.id,
    shopId: shop.id,
    productId: product.id,
    spec: { ...spec, breakdown: price.ok ? price.lines : undefined },
    isQuote,
    priceKobo: price.ok ? price.totalKobo : null,
    fulfillmentMethod: method,
    deliveryAddress: method === 'delivery' ? body.deliveryAddress.trim() : null,
    status: 'placed',
    paymentStatus: 'unpaid',
    designFileUrl: body.file || null,
    designFileName: body.fileName || null,
    printNote: body.note?.trim() || null,
  }).returning({ id: tables.orders.id });

  if (isQuote) return NextResponse.json({ ok: true, quote: true, orderId: order.id });

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;
  try {
    const init = await paystackInitialize({
      email: user.email,
      amountKobo: price.ok ? price.totalKobo : 0,
      reference: code,
      callbackUrl: `${origin}/checkout/callback`,
      metadata: { orderId: order.id, shop: shop.businessName },
    });
    return NextResponse.json({ ok: true, authorizationUrl: init.authorization_url });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Paystack is unreachable — try again shortly.' },
      { status: 502 },
    );
  }
}
__PRV1__
echo '  + src/app/api/checkout/route.ts'

cat > 'src/app/api/paystack/webhook/route.ts' << '__PRV1__'
import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { settlePayment } from '@/lib/settle';

/** Paystack webhook — HMAC-SHA512 signature check on the raw body, then idempotent settle. */
export async function POST(req: Request) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) return NextResponse.json({ error: 'Not configured' }, { status: 501 });

  const raw = await req.text();
  const signature = req.headers.get('x-paystack-signature') ?? '';
  const expected = crypto.createHmac('sha512', secret).update(raw).digest('hex');
  if (signature !== expected) return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });

  const event = JSON.parse(raw) as { event: string; data?: { reference?: string } };
  if (event.event === 'charge.success' && event.data?.reference) {
    await settlePayment(event.data.reference);
  }
  return NextResponse.json({ received: true });
}
__PRV1__
echo '  + src/app/api/paystack/webhook/route.ts'

cat > 'src/app/api/upload/route.ts' << '__PRV1__'
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { cloudinaryConfigured, uploadDesignFile } from '@/lib/cloudinary';

const MAX_BYTES = 20 * 1024 * 1024;
const OK_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'application/postscript', 'application/illustrator'];

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Log in to upload a file.' }, { status: 401 });

  if (!cloudinaryConfigured()) {
    return NextResponse.json(
      { error: 'File uploads are not configured yet. You can still place the order — send the file to the printer after.' },
      { status: 501 },
    );
  }

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'No file received.' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'File is over 20MB.' }, { status: 413 });
  if (file.type && !OK_TYPES.includes(file.type) && !file.name.toLowerCase().endsWith('.ai')) {
    return NextResponse.json({ error: 'Use PDF, AI, PNG or JPG.' }, { status: 415 });
  }

  try {
    const { url, name } = await uploadDesignFile(file);
    return NextResponse.json({ ok: true, url, name });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Upload failed.' }, { status: 502 });
  }
}
__PRV1__
echo '  + src/app/api/upload/route.ts'

cat > 'src/app/checkout/CheckoutClient.tsx' << '__PRV1__'
'use client';

import { useState } from 'react';
import { Bike, Store } from 'lucide-react';
import { naira } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { CodeBadge } from '@/components/ui/CodeBadge';

type Props = {
  shop: { id: string; name: string; code: string; supportsPickup: boolean; supportsDelivery: boolean };
  categoryName: string;
  isQuote: boolean;
  lines: { label: string; amountKobo: number }[];
  totalKobo: number | null;
  query: Record<string, string>;
};

export function CheckoutClient({ shop, categoryName, isQuote, lines, totalKobo, query }: Props) {
  const [method, setMethod] = useState<'delivery' | 'pickup'>(shop.supportsDelivery ? 'delivery' : 'pickup');
  const [address, setAddress] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsAddress = method === 'delivery';
  const ready = !needsAddress || address.trim().length > 5;

  async function pay() {
    setBusy(true);
    setError(null);
    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...query, shop: shop.id, fulfillmentMethod: method, deliveryAddress: address }),
    });
    const json = await res.json();
    if (!res.ok) { setBusy(false); setError(json.error ?? 'Could not start checkout.'); return; }
    if (json.quote) { window.location.href = '/orders?quote=1'; return; }
    window.location.href = json.authorizationUrl; // → Paystack
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-blue">Step 3 of 3</p>
      <h1 className="mt-1 font-display text-4xl font-extrabold tracking-tight text-black">
        {isQuote ? <>Request a <span className="text-blue">quote</span></> : <>Pay & <span className="text-blue">print</span></>}
      </h1>
      <p className="mt-2 flex items-center gap-2 text-sm text-black/55">
        {categoryName} · {shop.name} <CodeBadge code={shop.code} tone="light" />
      </p>

      <section className="mt-7 rounded-2xl border border-black/12 bg-white p-5 sm:p-6">
        <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-navy">How do you want it?</h2>
        <div className="mt-3 grid gap-2.5 sm:grid-cols-2" role="radiogroup" aria-label="Fulfillment">
          <button
            role="radio"
            aria-checked={method === 'delivery'}
            disabled={!shop.supportsDelivery}
            onClick={() => setMethod('delivery')}
            className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition-colors disabled:opacity-40 ${
              method === 'delivery' ? 'border-blue bg-blue text-white' : 'border-black/15 text-navy hover:border-black/35'
            }`}
          >
            <Bike className="mt-0.5 size-5 shrink-0" />
            <span>
              <span className="block font-display text-[15px] font-extrabold">Delivery</span>
              <span className={`text-xs ${method === 'delivery' ? 'text-white/80' : 'text-black/50'}`}>Rider brings it — Island & Mainland</span>
            </span>
          </button>
          {/* Pickup renders only when this printer supports it (spec §3 screen 5). */}
          {shop.supportsPickup && (
            <button
              role="radio"
              aria-checked={method === 'pickup'}
              onClick={() => setMethod('pickup')}
              className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition-colors ${
                method === 'pickup' ? 'border-blue bg-blue text-white' : 'border-black/15 text-navy hover:border-black/35'
              }`}
            >
              <Store className="mt-0.5 size-5 shrink-0" />
              <span>
                <span className="block font-display text-[15px] font-extrabold">Self-pickup</span>
                <span className={`text-xs ${method === 'pickup' ? 'text-white/80' : 'text-black/50'}`}>Collect it from the shop yourself</span>
              </span>
            </button>
          )}
        </div>

        {needsAddress && (
          <div className="mt-4">
            <Field label="Delivery address">
              <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="e.g. 24 Admiralty Way, Lekki Phase 1" autoComplete="street-address" />
            </Field>
          </div>
        )}
      </section>

      <section className="mt-5 rounded-2xl border border-black/12 bg-white p-5 sm:p-6">
        <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-navy">
          {isQuote ? 'What happens next' : 'Price breakdown'}
        </h2>
        {isQuote ? (
          <p className="mt-3 text-sm leading-relaxed text-black/60">
            {shop.name} hasn&apos;t set a fixed price for this exact spec. Send the request and it lands with
            them directly — you&apos;ll see it in your orders, and you only pay once a price is agreed.
          </p>
        ) : (
          <dl className="mt-3 font-mono text-sm">
            {lines.map((l, i) => (
              <div key={i} className="flex justify-between border-b border-dashed border-black/20 py-2.5">
                <dt className="text-black/55">{l.label}</dt>
                <dd className="font-bold text-navy">{naira(l.amountKobo)}</dd>
              </div>
            ))}
            <div className="flex justify-between pt-3">
              <dt className="font-display font-extrabold text-navy">Total</dt>
              <dd className="font-display text-xl font-extrabold text-navy">{naira(totalKobo)}</dd>
            </div>
          </dl>
        )}
      </section>

      {error && <p className="mt-4 rounded-xl border border-red/30 bg-red/5 px-3.5 py-2.5 text-sm text-red">{error}</p>}

      <Button onClick={pay} disabled={!ready || busy} className="mt-6 w-full">
        {busy ? 'One moment…' : isQuote ? 'Send quote request' : `Pay ${naira(totalKobo)} with Paystack`} <span aria-hidden>→</span>
      </Button>
      <p className="mt-2.5 text-center font-mono text-[10px] uppercase tracking-widest text-black/40">
        {isQuote ? 'No payment yet' : 'Secured by Paystack · NGN'}
      </p>
    </div>
  );
}
__PRV1__
echo '  + src/app/checkout/CheckoutClient.tsx'

cat > 'src/app/checkout/callback/page.tsx' << '__PRV1__'
import type { Metadata } from 'next';
import Link from 'next/link';
import { CircleCheck, CircleX } from 'lucide-react';
import { settlePayment } from '@/lib/settle';
import { ButtonLink } from '@/components/ui/Button';

export const metadata: Metadata = { title: 'Payment' };
export const dynamic = 'force-dynamic';

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function CallbackPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const reference = one(sp.reference) ?? one(sp.trxref);
  const result = reference ? await settlePayment(reference) : { ok: false as const, message: 'No payment reference.' };

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
      {result.ok ? (
        <>
          <CircleCheck className="size-14 text-success" strokeWidth={1.6} />
          <h1 className="mt-4 font-display text-3xl font-extrabold text-navy">Payment confirmed</h1>
          <p className="mt-2 text-sm leading-relaxed text-black/60">
            Your job is in the printer&apos;s queue — production starts now.
            Order <span className="font-mono font-bold text-navy">{reference}</span>.
          </p>
          <ButtonLink href="/track" className="mt-7">Track this order <span aria-hidden>→</span></ButtonLink>
          <Link href="/orders" className="mt-3 font-display text-sm font-bold text-blue">See all orders</Link>
        </>
      ) : (
        <>
          <CircleX className="size-14 text-red" strokeWidth={1.6} />
          <h1 className="mt-4 font-display text-3xl font-extrabold text-navy">Payment not confirmed</h1>
          <p className="mt-2 text-sm text-black/60">{result.message}</p>
          <ButtonLink href="/orders" variant="secondary" className="mt-7">Check my orders</ButtonLink>
        </>
      )}
    </div>
  );
}
__PRV1__
echo '  + src/app/checkout/callback/page.tsx'

cat > 'src/app/checkout/page.tsx' << '__PRV1__'
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db, tables } from '@/db';
import { getCategory } from '@/lib/categories';
import { computePrice } from '@/lib/pricing';
import { specFromParams } from '@/lib/spec';
import { CheckoutClient } from './CheckoutClient';

export const metadata: Metadata = { title: 'Checkout' };
export const dynamic = 'force-dynamic';

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Screens 5–6 (spec §3): fulfillment choice (pickup only if the printer supports it), then pay. */
export default async function CheckoutPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const spec = specFromParams(sp);
  const shopId = one(sp.shop);
  const productId = one(sp.product);
  if (!spec || !shopId || !productId || !getCategory(spec.category)) notFound();

  const [shop] = await db().select().from(tables.shops).where(eq(tables.shops.id, shopId)).limit(1);
  const [product] = await db().select().from(tables.products).where(eq(tables.products.id, productId)).limit(1);
  if (!shop || !product || product.shopId !== shop.id) notFound();

  const [variants, addons] = await Promise.all([
    db().select().from(tables.productVariants).where(eq(tables.productVariants.productId, product.id)),
    db().select().from(tables.productAddons).where(eq(tables.productAddons.productId, product.id)),
  ]);

  // Server-side price — the client never supplies a total.
  const price = computePrice(spec, product, variants, addons);
  const isQuote = one(sp.quote) === '1' || !price.ok;

  return (
    <CheckoutClient
      shop={{
        id: shop.id, name: shop.businessName, code: shop.code,
        supportsPickup: shop.supportsPickup, supportsDelivery: shop.supportsDelivery,
      }}
      categoryName={getCategory(spec.category)!.name}
      isQuote={isQuote}
      lines={price.ok ? price.lines : []}
      totalKobo={price.ok ? price.totalKobo : null}
      query={Object.fromEntries(Object.entries(sp).flatMap(([k, v]) => (one(v) ? [[k, one(v)!]] : [])))}
    />
  );
}
__PRV1__
echo '  + src/app/checkout/page.tsx'

cat > 'src/app/configure/[category]/Configurator.tsx' << '__PRV1__'
'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { UploadCloud, FileCheck2, X } from 'lucide-react';
import type { Category } from '@/lib/categories';
import type { CustomerSpec } from '@/lib/pricing';
import { specToParams, specSummary } from '@/lib/spec';
import { Glyph } from '@/components/ui/Glyph';
import { CodeBadge } from '@/components/ui/CodeBadge';
import { productCode } from '@/lib/categories';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';

/**
 * Product-first flow (spec §2): define the exact spec here, see printer
 * prices on the next screen. The panel mirrors the spec live; final prices
 * are per printer, so none is promised here.
 */
export function Configurator({ category }: { category: Category }) {
  const router = useRouter();
  const qtyPresets = category.qty?.presets ?? [1];

  const [service, setService] = useState<'print_only' | 'print_cut'>('print_cut');
  const [sizeMode, setSizeMode] = useState<'preset' | 'custom'>('preset');
  const [preset, setPreset] = useState(0);
  const [w, setW] = useState('');
  const [h, setH] = useState('');
  const [unit, setUnit] = useState<'ft' | 'in' | 'cm'>(category.size?.defaultUnit ?? 'in');
  const [fixedSize, setFixedSize] = useState(category.fixedSizes?.[0] ?? '');
  const [qty, setQty] = useState<number>(qtyPresets[0]);
  const [customQty, setCustomQty] = useState('');
  const [cover, setCover] = useState(category.jotter?.covers[0] ?? '');
  const [jSize, setJSize] = useState(category.jotter?.sizes[0] ?? '');
  const [sheets, setSheets] = useState(category.jotter?.sheets[0] ?? 0);
  const [addons, setAddons] = useState<Record<string, string>>(() =>
    Object.fromEntries((category.addonAxes ?? []).map((a) => [a.kind, a.options[0]])),
  );
  const [note, setNote] = useState('');
  const [file, setFile] = useState<{ url: string; name: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);

  const isBC = Boolean(category.businessCard);
  const showSize = Boolean(category.size) && !isBC;
  const effQty = customQty ? Number(customQty) : qty;

  const spec: CustomerSpec = useMemo(() => {
    const s: CustomerSpec = { category: category.slug, qty: effQty || undefined };
    if (isBC) s.serviceType = service;
    if (showSize) {
      if (sizeMode === 'preset' && category.size) {
        const p = category.size.presets[preset];
        s.width = p.width; s.height = p.height; s.unit = p.unit;
      } else {
        s.width = Number(w) || undefined; s.height = Number(h) || undefined; s.unit = unit;
      }
    }
    if (category.fixedSizes) s.sizeLabel = fixedSize;
    if (category.jotter) { s.cover = cover; s.jSize = jSize; s.sheets = sheets; }
    // Print-only cards: corners/gsm are cut-side concerns — only lamination applies (spec §6).
    const axes = (category.addonAxes ?? []).filter((a) =>
      !(isBC && service === 'print_only' && a.kind !== 'lamination'),
    );
    const picked: Record<string, string> = {};
    for (const a of axes) picked[a.kind] = addons[a.kind] ?? a.options[0];
    if (Object.keys(picked).length) s.addons = picked;
    return s;
  }, [category, isBC, service, showSize, sizeMode, preset, w, h, unit, fixedSize, effQty, cover, jSize, sheets, addons]);

  const sizeOk = !showSize || sizeMode === 'preset' || (Number(w) > 0 && Number(h) > 0);
  const qtyOk = !category.qty || (effQty >= category.qty.min);
  const ready = sizeOk && qtyOk;

  async function onFile(f: File | undefined) {
    if (!f) return;
    setUploading(true);
    setUploadMsg(null);
    const fd = new FormData();
    fd.append('file', f);
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    const json = await res.json();
    setUploading(false);
    if (res.status === 401) { setUploadMsg('Log in first to attach a file — or continue and add it later.'); return; }
    if (!res.ok) { setUploadMsg(json.error ?? 'Upload failed.'); return; }
    setFile({ url: json.url, name: json.name });
  }

  function seePrinters() {
    const p = specToParams(spec, {
      note: note.trim(),
      file: file?.url ?? '',
      fileName: file?.name ?? '',
    });
    router.push(`/printers?${p.toString()}`);
  }

  const axesToShow = (category.addonAxes ?? []).filter((a) =>
    !(isBC && service === 'print_only' && a.kind !== 'lamination'),
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-blue">Configuring</p>
      <h1 className="mt-1 font-display text-4xl font-extrabold tracking-tight text-black">{category.name}</h1>

      <div className="mt-7 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6 rounded-2xl border border-black/12 bg-white p-5 sm:p-7">
          {isBC && (
            <div className="grid grid-cols-2 gap-2.5" role="radiogroup" aria-label="Service type">
              {([
                { v: 'print_cut', t: 'Print + Cut', d: 'Finished cards, ready to hand out' },
                { v: 'print_only', t: 'Print only', d: 'A4 sheets — you cut them yourself' },
              ] as const).map((o) => (
                <button
                  key={o.v}
                  role="radio"
                  aria-checked={service === o.v}
                  onClick={() => setService(o.v)}
                  className={`rounded-2xl border p-4 text-left transition-colors ${
                    service === o.v ? 'border-blue bg-blue text-white' : 'border-black/15 bg-white text-navy hover:border-black/35'
                  }`}
                >
                  <span className="block font-display text-[15px] font-extrabold">{o.t}</span>
                  <span className={`mt-0.5 block text-xs ${service === o.v ? 'text-white/80' : 'text-black/50'}`}>{o.d}</span>
                </button>
              ))}
            </div>
          )}

          {showSize && category.size && (
            <div>
              <div className="mb-2.5 flex items-center justify-between">
                <span className="font-display text-[13px] font-bold text-navy">Size</span>
                <div className="flex gap-1 rounded-pill bg-black/5 p-0.5">
                  {(['preset', 'custom'] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setSizeMode(m)}
                      disabled={m === 'custom' && !category.size!.allowCustom}
                      className={`rounded-pill px-3.5 py-1.5 font-display text-xs font-bold capitalize ${sizeMode === m ? 'bg-navy text-white' : 'text-navy'}`}
                    >
                      {m === 'preset' ? 'Presets' : 'Custom size'}
                    </button>
                  ))}
                </div>
              </div>
              {sizeMode === 'preset' ? (
                <div className="flex flex-wrap gap-2">
                  {category.size.presets.map((p, i) => (
                    <button
                      key={p.label}
                      onClick={() => setPreset(i)}
                      className={`rounded-pill border px-4 py-2 font-mono text-[13px] font-bold ${
                        preset === i ? 'border-blue bg-blue text-white' : 'border-black/20 text-navy hover:border-black/45'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-[1fr_auto_1fr_88px] items-end gap-2.5">
                  <Field label="Width"><Input inputMode="decimal" value={w} onChange={(e) => setW(e.target.value)} placeholder="0" /></Field>
                  <span className="pb-3 font-display text-lg font-extrabold text-navy" aria-hidden>×</span>
                  <Field label="Height"><Input inputMode="decimal" value={h} onChange={(e) => setH(e.target.value)} placeholder="0" /></Field>
                  <Field label="Unit">
                    <Select value={unit} onChange={(e) => setUnit(e.target.value as typeof unit)}>
                      <option value="ft">FT</option><option value="in">IN</option><option value="cm">CM</option>
                    </Select>
                  </Field>
                </div>
              )}
            </div>
          )}

          {category.fixedSizes && (
            <Field label="Size">
              <Select value={fixedSize} onChange={(e) => setFixedSize(e.target.value)}>
                {category.fixedSizes.map((s) => <option key={s}>{s}</option>)}
              </Select>
            </Field>
          )}

          {category.jotter && (
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Cover">
                <Select value={cover} onChange={(e) => setCover(e.target.value)}>
                  {category.jotter.covers.map((c) => <option key={c}>{c}</option>)}
                </Select>
              </Field>
              <Field label="Size">
                <Select value={jSize} onChange={(e) => setJSize(e.target.value)}>
                  {category.jotter.sizes.map((s) => <option key={s}>{s}</option>)}
                </Select>
              </Field>
              <Field label="Sheets">
                <Select value={sheets} onChange={(e) => setSheets(Number(e.target.value))}>
                  {category.jotter.sheets.map((s) => <option key={s} value={s}>{s} sheets</option>)}
                </Select>
              </Field>
            </div>
          )}

          {category.qty && (
            <div>
              <span className="mb-2.5 block font-display text-[13px] font-bold text-navy">Quantity</span>
              <div className="flex flex-wrap items-center gap-2">
                {qtyPresets.map((q) => (
                  <button
                    key={q}
                    onClick={() => { setQty(q); setCustomQty(''); }}
                    className={`rounded-pill border px-4 py-2 font-mono text-[13px] font-bold ${
                      !customQty && qty === q ? 'border-blue bg-blue text-white' : 'border-black/20 text-navy hover:border-black/45'
                    }`}
                  >
                    {q.toLocaleString()}
                  </button>
                ))}
                <Input
                  inputMode="numeric"
                  value={customQty}
                  onChange={(e) => setCustomQty(e.target.value.replace(/\D/g, ''))}
                  placeholder="Custom"
                  className="!w-28"
                  aria-label="Custom quantity"
                />
              </div>
              {!qtyOk && <p className="mt-1.5 text-xs text-red">Minimum order is {category.qty.min}.</p>}
              {customQty !== '' && (
                <p className="mt-1.5 text-xs text-black/50">
                  Odd quantities may not match a printer&apos;s tiers — those printers will show as Request Quote.
                </p>
              )}
            </div>
          )}

          {axesToShow.map((axis) => (
            <Field key={axis.kind} label={axis.label}>
              <Select
                value={addons[axis.kind] ?? axis.options[0]}
                onChange={(e) => setAddons((a) => ({ ...a, [axis.kind]: e.target.value }))}
              >
                {axis.options.map((o) => <option key={o}>{o}</option>)}
              </Select>
            </Field>
          ))}

          <div>
            <span className="mb-2 block font-display text-[13px] font-bold text-navy">Design file</span>
            {file ? (
              <div className="flex items-center justify-between rounded-xl border border-success/40 bg-success/5 px-4 py-3">
                <span className="flex items-center gap-2 text-sm font-semibold text-navy">
                  <FileCheck2 className="size-4 text-success" /> {file.name}
                </span>
                <button onClick={() => setFile(null)} aria-label="Remove file" className="text-black/40 hover:text-red">
                  <X className="size-4" />
                </button>
              </div>
            ) : (
              <label className="flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border border-dashed border-black/30 bg-pale/25 px-4 py-7 text-center transition-colors hover:bg-pale/50">
                <input type="file" hidden accept=".pdf,.ai,.png,.jpg,.jpeg" onChange={(e) => onFile(e.target.files?.[0])} />
                <UploadCloud className="size-6 text-navy" />
                <span className="font-display text-sm font-bold text-navy">
                  {uploading ? 'Uploading…' : 'Drop your file or tap to browse'}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-widest text-black/45">PDF, AI, PNG, JPG · CMYK preferred</span>
              </label>
            )}
            {uploadMsg && <p className="mt-1.5 text-xs text-black/55">{uploadMsg}</p>}
          </div>

          <Field label="Print note (optional)" hint="Read by the printer — it never changes the price automatically.">
            <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything the printer should know…" />
          </Field>
        </div>

        <aside className="h-fit rounded-2xl bg-navy p-6 text-white lg:sticky lg:top-20">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-pale">Your spec</p>
            <CodeBadge code={productCode(category.slug)} tone="light" />
          </div>
          <div className="mt-4 grid place-items-center rounded-xl border border-white/20 bg-white/5 py-8">
            <Glyph kind={category.glyph} color="#FFFBB5" className="size-20" />
          </div>
          <dl className="mt-4 space-y-0 font-mono text-[13px]">
            <div className="flex justify-between border-b border-dashed border-white/20 py-2.5">
              <dt className="text-white/55">Item</dt><dd className="font-bold">{category.name}</dd>
            </div>
            {specSummary(spec).map((line, i) => (
              <div key={i} className="flex justify-between border-b border-dashed border-white/20 py-2.5">
                <dt className="text-white/55">{i === 0 ? 'Spec' : ''}</dt><dd className="font-bold">{line}</dd>
              </div>
            ))}
            <div className="flex justify-between py-2.5">
              <dt className="text-white/55">File</dt><dd className="font-bold">{file ? '✓ attached' : '—'}</dd>
            </div>
          </dl>
          <p className="mt-2 text-xs leading-relaxed text-white/55">
            Prices are set per printer — you&apos;ll compare them on the next screen, sorted by distance.
          </p>
          <Button onClick={seePrinters} disabled={!ready} variant="secondary" className="mt-5 w-full">
            See printer prices <span aria-hidden>→</span>
          </Button>
        </aside>
      </div>
    </div>
  );
}
__PRV1__
echo '  + src/app/configure/[category]/Configurator.tsx'

cat > 'src/app/configure/[category]/page.tsx' << '__PRV1__'
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCategory, CATEGORIES } from '@/lib/categories';
import { Configurator } from './Configurator';

export function generateStaticParams() {
  return CATEGORIES.filter((c) => c.live).map((c) => ({ category: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ category: string }> }): Promise<Metadata> {
  const cat = getCategory((await params).category);
  if (!cat) return {};
  return {
    title: `Print ${cat.name} in Lagos`,
    description: `Configure your ${cat.name.toLowerCase()} — size, quantity and finish — then compare prices from nearby Lagos printers.`,
  };
}

export default async function ConfigurePage({ params }: { params: Promise<{ category: string }> }) {
  const cat = getCategory((await params).category);
  if (!cat || !cat.live) notFound();
  return <Configurator category={cat} />;
}
__PRV1__
echo '  + src/app/configure/[category]/page.tsx'

cat > 'src/app/orders/[id]/ReviewForm.tsx' << '__PRV1__'
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Star } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Field';
import { submitReview } from './actions';

export function ReviewForm({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setBusy(true);
    const res = await submitReview({ orderId, rating, comment: comment.trim() });
    setBusy(false);
    if (res?.error) { setError(res.error); return; }
    router.refresh();
  }

  return (
    <div className="mt-3">
      <div className="flex gap-1" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} role="radio" aria-checked={rating === n} onClick={() => setRating(n)} aria-label={`${n} star${n > 1 ? 's' : ''}`}>
            <Star className={`size-7 ${n <= rating ? 'fill-pale text-navy' : 'text-black/25'}`} />
          </button>
        ))}
      </div>
      <Textarea className="mt-3" rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="How did it go? (optional)" />
      {error && <p className="mt-2 text-sm text-red">{error}</p>}
      <Button size="sm" className="mt-3" onClick={send} disabled={rating === 0 || busy}>
        {busy ? 'Sending…' : 'Submit rating'}
      </Button>
    </div>
  );
}
__PRV1__
echo '  + src/app/orders/[id]/ReviewForm.tsx'

cat > 'src/app/orders/[id]/actions.ts' << '__PRV1__'
'use server';

import { and, avg, count, eq } from 'drizzle-orm';
import { db, tables } from '@/db';
import { getSession } from '@/lib/auth';

export async function submitReview(input: { orderId: string; rating: number; comment: string }) {
  const session = await getSession();
  if (!session) return { error: 'Log in first.' };
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) return { error: 'Pick 1–5 stars.' };

  const [order] = await db().select().from(tables.orders).where(and(
    eq(tables.orders.id, input.orderId),
    eq(tables.orders.customerId, session.uid),
    eq(tables.orders.status, 'completed'),
  )).limit(1);
  if (!order) return { error: 'Only completed orders can be rated.' };

  await db().insert(tables.reviews).values({
    orderId: order.id,
    shopId: order.shopId,
    customerId: session.uid,
    rating: input.rating,
    comment: input.comment.slice(0, 500) || null,
  }).onConflictDoNothing();

  // Denormalised rating on the shop keeps the printer-selection query cheap.
  const [agg] = await db().select({ a: avg(tables.reviews.rating), c: count() })
    .from(tables.reviews).where(eq(tables.reviews.shopId, order.shopId));
  await db().update(tables.shops)
    .set({ ratingAvg: Number(agg.a ?? 0), ratingCount: agg.c })
    .where(eq(tables.shops.id, order.shopId));

  return { ok: true };
}
__PRV1__
echo '  + src/app/orders/[id]/actions.ts'

cat > 'src/app/orders/[id]/page.tsx' << '__PRV1__'
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { db, tables } from '@/db';
import { getSession } from '@/lib/auth';
import { getCategory } from '@/lib/categories';
import { specSummary } from '@/lib/spec';
import { StatusTracker } from '@/components/ui/StatusTracker';
import { CodeBadge } from '@/components/ui/CodeBadge';
import { naira, shortDate } from '@/lib/format';
import { ReviewForm } from './ReviewForm';

export const metadata: Metadata = { title: 'Order' };
export const dynamic = 'force-dynamic';

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = (await getSession())!;

  const [row] = await db().select({
    order: tables.orders,
    shopName: tables.shops.businessName,
    shopCode: tables.shops.code,
  })
    .from(tables.orders)
    .innerJoin(tables.shops, eq(tables.orders.shopId, tables.shops.id))
    .where(and(eq(tables.orders.id, id), eq(tables.orders.customerId, session.uid)))
    .limit(1);
  if (!row) notFound();
  const { order, shopName, shopCode } = row;

  const [existingReview] = await db().select().from(tables.reviews).where(eq(tables.reviews.orderId, order.id)).limit(1);
  const cat = getCategory(order.spec.category);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-center gap-2.5">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-black">{cat?.name}</h1>
        <span className="font-mono text-sm font-bold text-black/45">{order.code}</span>
      </div>
      <p className="mt-1.5 flex items-center gap-2 text-sm text-black/55">
        {shopName} <CodeBadge code={shopCode} tone="light" /> · {shortDate(order.createdAt)}
      </p>

      <section className="mt-7 rounded-2xl border border-black/12 bg-white p-5 sm:p-6">
        {order.isQuote && order.paymentStatus === 'unpaid' ? (
          <p className="rounded-xl bg-pale/40 px-4 py-3 font-mono text-[11px] font-bold uppercase tracking-widest text-navy">
            Quote requested — the printer will respond with a price
          </p>
        ) : (
          <StatusTracker status={order.status} method={order.fulfillmentMethod} />
        )}
      </section>

      <section className="mt-5 rounded-2xl border border-black/12 bg-white p-5 sm:p-6">
        <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-navy">Spec</h2>
        <dl className="mt-3 font-mono text-sm">
          {specSummary(order.spec).map((line, i) => (
            <div key={i} className="border-b border-dashed border-black/15 py-2 text-navy">{line}</div>
          ))}
          {order.printNote && (
            <div className="border-b border-dashed border-black/15 py-2 text-black/60">Note: {order.printNote}</div>
          )}
          <div className="py-2 text-black/60">
            {order.fulfillmentMethod === 'pickup' ? 'Self-pickup from shop' : `Delivery: ${order.deliveryAddress}`}
          </div>
        </dl>
        <div className="flex justify-between border-t border-dashed border-black/25 pt-3.5">
          <span className="font-display font-extrabold text-navy">Total</span>
          <span className="font-display text-lg font-extrabold text-navy">{naira(order.priceKobo)}</span>
        </div>
      </section>

      {order.status === 'completed' && !existingReview && (
        <section className="mt-5 rounded-2xl border border-black/12 bg-white p-5 sm:p-6">
          <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-navy">Rate this printer</h2>
          <ReviewForm orderId={order.id} />
        </section>
      )}
      {existingReview && (
        <p className="mt-5 text-center font-mono text-[11px] uppercase tracking-widest text-black/45">
          You rated this order {existingReview.rating}/5 — thanks!
        </p>
      )}
    </div>
  );
}
__PRV1__
echo '  + src/app/orders/[id]/page.tsx'

cat > 'src/app/orders/page.tsx' << '__PRV1__'
import type { Metadata } from 'next';
import Link from 'next/link';
import { desc, eq } from 'drizzle-orm';
import { db, tables } from '@/db';
import { getSession } from '@/lib/auth';
import { getCategory } from '@/lib/categories';
import { EmptyState } from '@/components/ui/EmptyState';
import { ButtonLink } from '@/components/ui/Button';
import { naira, shortDate } from '@/lib/format';

export const metadata: Metadata = { title: 'My orders' };
export const dynamic = 'force-dynamic';

const BADGE: Record<string, string> = {
  placed: 'bg-pale text-navy',
  printing: 'bg-blue text-white',
  ready: 'bg-navy text-pale',
  completed: 'bg-success/15 text-success',
  cancelled: 'bg-red/10 text-red',
};

/** Screen 8 (spec §3): same status data as Track Order, different view. */
export default async function OrdersPage() {
  const session = (await getSession())!;
  const rows = await db().select({
    order: tables.orders,
    shopName: tables.shops.businessName,
  })
    .from(tables.orders)
    .innerJoin(tables.shops, eq(tables.orders.shopId, tables.shops.id))
    .where(eq(tables.orders.customerId, session.uid))
    .orderBy(desc(tables.orders.createdAt));

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-4xl font-extrabold tracking-tight text-black">
        My <span className="text-blue">orders</span>
      </h1>

      {rows.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="No orders yet"
            hint="Your past and active print jobs will live here."
            action={<ButtonLink href="/products">Start printing</ButtonLink>}
          />
        </div>
      ) : (
        <ul className="mt-8 divide-y divide-dashed divide-black/15 rounded-2xl border border-black/12 bg-white">
          {rows.map(({ order, shopName }) => {
            const label = order.isQuote && order.paymentStatus === 'unpaid'
              ? 'Quote requested'
              : order.status === 'completed'
                ? (order.fulfillmentMethod === 'pickup' ? 'Picked up' : 'Delivered')
                : order.status;
            return (
              <li key={order.id}>
                <Link href={`/orders/${order.id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-pale/20">
                  <div>
                    <p className="font-display font-extrabold text-navy">
                      {getCategory(order.spec.category)?.name ?? order.spec.category}
                      <span className="ml-2 font-mono text-xs font-bold text-black/45">{order.code}</span>
                    </p>
                    <p className="mt-0.5 text-[13px] text-black/50">{shopName} · {shortDate(order.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`rounded-pill px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-widest ${BADGE[order.isQuote && order.paymentStatus === 'unpaid' ? 'placed' : order.status]}`}>
                      {label}
                    </span>
                    <span className="font-display font-extrabold text-navy">{naira(order.priceKobo)}</span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
__PRV1__
echo '  + src/app/orders/page.tsx'

cat > 'src/app/printers/LocateGate.tsx' << '__PRV1__'
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { MapPin } from 'lucide-react';
import { LAGOS } from '@/lib/geo';
import { Button } from '@/components/ui/Button';

/** Auto-detect the customer's location (spec §3 screen 4), with a graceful Lagos-wide fallback. */
export function LocateGate() {
  const router = useRouter();
  const params = useSearchParams();
  const [denied, setDenied] = useState(false);

  function go(lat: number, lng: number) {
    const p = new URLSearchParams(params.toString());
    p.set('lat', lat.toFixed(5));
    p.set('lng', lng.toFixed(5));
    router.replace(`/printers?${p.toString()}`);
  }

  useEffect(() => {
    if (!('geolocation' in navigator)) { go(LAGOS.lat, LAGOS.lng); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => go(pos.coords.latitude, pos.coords.longitude),
      () => setDenied(true),
      { timeout: 8000, maximumAge: 300000 },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-pale">
        <MapPin className="size-6 text-navy" />
      </span>
      <h1 className="mt-5 font-display text-2xl font-extrabold text-navy">
        {denied ? 'Location not shared' : 'Finding printers near you…'}
      </h1>
      <p className="mt-2 text-sm text-black/55">
        {denied
          ? 'No wahala — we can show all Lagos printers instead, just without distance sorting from your exact spot.'
          : 'We use your location once, to sort printers by distance. Nothing is stored.'}
      </p>
      {denied && (
        <Button className="mt-6" onClick={() => go(LAGOS.lat, LAGOS.lng)}>
          Show Lagos printers <span aria-hidden>→</span>
        </Button>
      )}
    </div>
  );
}
__PRV1__
echo '  + src/app/printers/LocateGate.tsx'

cat > 'src/app/printers/page.tsx' << '__PRV1__'
import type { Metadata } from 'next';
import Link from 'next/link';
import { and, eq, gte, lte, inArray } from 'drizzle-orm';
import { MapPin, Star, Clock } from 'lucide-react';
import { db, tables } from '@/db';
import { getCategory } from '@/lib/categories';
import { computePrice, productMatchesSpec } from '@/lib/pricing';
import { specFromParams } from '@/lib/spec';
import { distanceKm, bbox, LAGOS } from '@/lib/geo';
import { naira } from '@/lib/format';
import { CodeBadge } from '@/components/ui/CodeBadge';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { LocateGate } from './LocateGate';

export const metadata: Metadata = { title: 'Choose a printer' };
export const dynamic = 'force-dynamic';

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/**
 * Screen 4 (spec §3): auto-detect location → nearby printers who can fulfil
 * this exact spec, sorted by distance. Fixed price, or the dashed
 * "Request quote" state when a printer hasn't priced this spec.
 */
export default async function PrintersPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const spec = specFromParams(sp);
  const cat = spec ? getCategory(spec.category) : undefined;

  if (!spec || !cat) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <EmptyState
          title="No spec to match yet"
          hint="Configure a product first, then we’ll find printers for it."
          action={<ButtonLink href="/products">Pick a product</ButtonLink>}
        />
      </div>
    );
  }

  const lat = one(sp.lat) ? Number(one(sp.lat)) : null;
  const lng = one(sp.lng) ? Number(one(sp.lng)) : null;
  if (lat == null || lng == null) return <LocateGate />;

  // Indexed bounding-box prefilter; haversine refines and sorts below.
  const box = bbox(lat, lng);
  const shops = await db().select().from(tables.shops).where(and(
    eq(tables.shops.isActive, true),
    gte(tables.shops.lat, box.minLat), lte(tables.shops.lat, box.maxLat),
    gte(tables.shops.lng, box.minLng), lte(tables.shops.lng, box.maxLng),
  ));

  const shopIds = shops.map((s) => s.id);
  const prods = shopIds.length
    ? await db().select().from(tables.products).where(and(
        inArray(tables.products.shopId, shopIds),
        eq(tables.products.categorySlug, spec.category),
        eq(tables.products.isActive, true),
      ))
    : [];
  const prodIds = prods.map((p) => p.id);
  const [variants, addons] = prodIds.length
    ? await Promise.all([
        db().select().from(tables.productVariants).where(inArray(tables.productVariants.productId, prodIds)),
        db().select().from(tables.productAddons).where(inArray(tables.productAddons.productId, prodIds)),
      ])
    : [[], []];

  const cards = shops.flatMap((shop) => {
    const candidates = prods.filter((p) => p.shopId === shop.id && productMatchesSpec(spec, p));
    if (!candidates.length) return [];
    // Best quotable price wins; otherwise the shop shows as Request Quote.
    let best: { productId: string; totalKobo: number; turnaround: number } | null = null;
    let quoteProduct = candidates[0];
    for (const p of candidates) {
      const r = computePrice(spec, p, variants.filter((v) => v.productId === p.id), addons.filter((a) => a.productId === p.id));
      if (r.ok && (!best || r.totalKobo < best.totalKobo)) {
        best = { productId: p.id, totalKobo: r.totalKobo, turnaround: p.turnaroundHours };
      }
      if (p.pricingMode === 'quote') quoteProduct = p;
    }
    const km = shop.lat != null && shop.lng != null ? distanceKm(lat, lng, shop.lat, shop.lng) : null;
    return [{ shop, best, quoteProductId: quoteProduct.id, km }];
  }).sort((a, b) => (a.km ?? 1e9) - (b.km ?? 1e9));

  const query = new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (one(v) ? [[k, one(v)!]] : []))).toString();
  const usingFallback = Math.abs(lat - LAGOS.lat) < 0.0001 && Math.abs(lng - LAGOS.lng) < 0.0001;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-blue">Step 2 of 3</p>
      <h1 className="mt-1 font-display text-4xl font-extrabold tracking-tight text-black">
        Printers <span className="text-blue">near you</span>
      </h1>
      <p className="mt-2 flex items-center gap-1.5 text-sm text-black/55">
        <MapPin className="size-4" />
        {usingFallback ? 'Showing Lagos-wide (location not shared)' : 'Sorted by distance from your location'}
        · {cat.name}
      </p>

      {cards.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="No printers for this spec yet"
            hint="Try a different size or quantity — or check back soon, new printers join weekly."
            action={<ButtonLink href={`/configure/${cat.slug}`} variant="secondary">Adjust spec</ButtonLink>}
          />
        </div>
      ) : (
        <ul className="mt-8 space-y-4">
          {cards.map(({ shop, best, quoteProductId, km }) => {
            const href = `/checkout?${query}&shop=${shop.id}&product=${best ? best.productId : quoteProductId}${best ? '' : '&quote=1'}`;
            return (
              <li
                key={shop.id}
                className={`rounded-2xl bg-white p-5 sm:p-6 ${best ? 'border border-black/12' : 'border border-dashed border-black/30'}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h2 className="font-display text-xl font-extrabold tracking-tight text-navy">{shop.businessName}</h2>
                      <CodeBadge code={shop.code} />
                    </div>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-black/55">
                      {km != null && <span className="flex items-center gap-1"><MapPin className="size-3.5" />{km.toFixed(1)} km away</span>}
                      {shop.ratingCount > 0 ? (
                        <span className="flex items-center gap-1"><Star className="size-3.5 fill-pale text-navy" />{shop.ratingAvg.toFixed(1)} ({shop.ratingCount})</span>
                      ) : (
                        <span className="font-mono text-[10px] uppercase tracking-widest">New printer</span>
                      )}
                      {best && <span className="flex items-center gap-1"><Clock className="size-3.5" />~{best.turnaround}hrs</span>}
                      {shop.supportsPickup && <span className="rounded-pill bg-pale px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-navy">Pickup available</span>}
                    </p>
                  </div>
                  <div className="text-right">
                    {best ? (
                      <>
                        <p className="font-display text-2xl font-extrabold text-navy">{naira(best.totalKobo)}</p>
                        <p className="font-mono text-[10px] uppercase tracking-widest text-black/45">for this spec</p>
                      </>
                    ) : (
                      <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-navy/60">No fixed price<br />for this spec</p>
                    )}
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-dashed border-black/25 pt-4">
                  <Link href={href} className="font-display text-sm font-bold text-blue">
                    {best ? 'View breakdown' : 'What happens next?'}
                  </Link>
                  <ButtonLink href={href} size="sm" variant={best ? 'primary' : 'secondary'}>
                    {best ? 'Select' : 'Request quote'} <span aria-hidden>→</span>
                  </ButtonLink>
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
echo '  + src/app/printers/page.tsx'

cat > 'src/app/products/page.tsx' << '__PRV1__'
import type { Metadata } from 'next';
import Link from 'next/link';
import { CATEGORIES, productCode } from '@/lib/categories';
import { Glyph } from '@/components/ui/Glyph';
import { CodeBadge } from '@/components/ui/CodeBadge';

export const metadata: Metadata = {
  title: 'Products',
  description: 'Stickers, banners, flyers, business cards, jotters, frames and more — printed by Lagos printers near you.',
};

export default function ProductsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 md:py-14">
      <h1 className="font-display text-4xl font-extrabold tracking-tight text-black sm:text-5xl">
        What are you <span className="text-blue">printing</span> today?
      </h1>
      <p className="mt-2 text-black/60">Pick a product, set your spec, then compare nearby printers.</p>

      <ul className="mt-8 grid grid-cols-2 gap-3.5 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
        {CATEGORIES.map((c) => (
          <li key={c.slug}>
            {c.live ? (
              <Link
                href={`/configure/${c.slug}`}
                className="group flex h-full flex-col gap-3 rounded-2xl border border-black/12 bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-blue"
              >
                <div className="flex items-start justify-between">
                  <Glyph kind={c.glyph} color={c.hue} className="size-12" />
                  <CodeBadge code={productCode(c.slug)} tone="light" />
                </div>
                <div>
                  <h2 className="font-display text-lg font-extrabold tracking-tight text-navy">{c.name}</h2>
                  <p className="mt-0.5 text-[13px] text-black/55">{c.blurb}</p>
                </div>
                <span className="mt-auto border-t border-dashed border-black/25 pt-2.5 font-display text-[13px] font-bold text-navy transition-colors group-hover:text-blue">
                  Configure <span aria-hidden>→</span>
                </span>
              </Link>
            ) : (
              <div className="flex h-full flex-col gap-3 rounded-2xl border border-dashed border-black/20 bg-white/60 p-5 opacity-70">
                <div className="flex items-start justify-between">
                  <Glyph kind={c.glyph} color={c.hue} className="size-12 opacity-50" />
                  <CodeBadge code={productCode(c.slug)} tone="light" />
                </div>
                <div>
                  <h2 className="font-display text-lg font-extrabold tracking-tight text-navy/60">{c.name}</h2>
                  <p className="mt-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-navy/45">Coming soon</p>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
__PRV1__
echo '  + src/app/products/page.tsx'

cat > 'src/app/track/page.tsx' << '__PRV1__'
import type { Metadata } from 'next';
import { and, desc, eq, ne } from 'drizzle-orm';
import { db, tables } from '@/db';
import { getSession } from '@/lib/auth';
import { getCategory } from '@/lib/categories';
import { StatusTracker } from '@/components/ui/StatusTracker';
import { CodeBadge } from '@/components/ui/CodeBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ButtonLink } from '@/components/ui/Button';
import { naira, shortDate } from '@/lib/format';

export const metadata: Metadata = { title: 'Track order' };
export const dynamic = 'force-dynamic';

/**
 * Screen 7 (spec §3): reads the exact status field the printer's queue
 * buttons write — built once, displayed twice (here and in history).
 */
export default async function TrackPage() {
  const session = (await getSession())!; // middleware guarantees it
  const active = await db().select({
    order: tables.orders,
    shopName: tables.shops.businessName,
    shopCode: tables.shops.code,
  })
    .from(tables.orders)
    .innerJoin(tables.shops, eq(tables.orders.shopId, tables.shops.id))
    .where(and(
      eq(tables.orders.customerId, session.uid),
      ne(tables.orders.status, 'completed'),
      ne(tables.orders.status, 'cancelled'),
    ))
    .orderBy(desc(tables.orders.createdAt));

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-4xl font-extrabold tracking-tight text-black">
        Track <span className="text-blue">order</span>
      </h1>
      <p className="mt-2 text-black/60">Live status straight from the printer&apos;s bench.</p>

      {active.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="Nothing in production right now"
            hint="Start a print job and it shows up here the moment it's paid."
            action={<ButtonLink href="/products">Start printing</ButtonLink>}
          />
        </div>
      ) : (
        <ul className="mt-8 space-y-4">
          {active.map(({ order, shopName, shopCode }) => (
            <li key={order.id} className="rounded-2xl border border-black/12 bg-white p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-xs font-bold text-navy">{order.code}</span>
                  <CodeBadge code={shopCode} tone="light" />
                </div>
                <span className="text-[13px] text-black/50">
                  {getCategory(order.spec.category)?.name} · {shopName} · {shortDate(order.createdAt)}
                </span>
              </div>
              {order.isQuote && order.paymentStatus === 'unpaid' ? (
                <p className="mt-4 rounded-xl bg-pale/40 px-4 py-3 font-mono text-[11px] font-bold uppercase tracking-widest text-navy">
                  Quote requested — waiting on the printer
                </p>
              ) : (
                <div className="mt-5"><StatusTracker status={order.status} method={order.fulfillmentMethod} /></div>
              )}
              <div className="mt-4 flex items-center justify-between border-t border-dashed border-black/25 pt-3.5 text-sm">
                <span className="text-black/55">{order.fulfillmentMethod === 'pickup' ? 'Self-pickup' : 'Delivery'}</span>
                <span className="font-display font-extrabold text-navy">{naira(order.priceKobo)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
__PRV1__
echo '  + src/app/track/page.tsx'

