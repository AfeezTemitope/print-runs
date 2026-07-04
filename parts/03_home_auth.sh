#!/usr/bin/env bash
set -euo pipefail
# Homepage sections + auth pages and API

mkdir -p 'src/app' 'src/app/api/auth/login' 'src/app/api/auth/logout' 'src/app/api/auth/register' 'src/app/login' 'src/app/register' 'src/components/home'

cat > 'src/app/api/auth/login/route.ts' << '__PRV1__'
import { NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db, tables } from '@/db';
import { createSession } from '@/lib/auth';

const schema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Enter your email and password.' }, { status: 400 });
  }

  const rows = await db().select().from(tables.users).where(eq(tables.users.email, parsed.data.email)).limit(1);
  const user = rows[0];
  const ok = user && (await bcrypt.compare(parsed.data.password, user.passwordHash));
  if (!ok) {
    return NextResponse.json({ error: 'Email or password is incorrect.' }, { status: 401 });
  }

  await createSession({ uid: user.id, role: user.role });
  return NextResponse.json({ ok: true, role: user.role });
}
__PRV1__
echo '  + src/app/api/auth/login/route.ts'

cat > 'src/app/api/auth/logout/route.ts' << '__PRV1__'
import { NextResponse } from 'next/server';
import { destroySession } from '@/lib/auth';

export async function POST() {
  await destroySession();
  return NextResponse.json({ ok: true });
}
__PRV1__
echo '  + src/app/api/auth/logout/route.ts'

cat > 'src/app/api/auth/register/route.ts' << '__PRV1__'
import { NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db, tables } from '@/db';
import { createSession } from '@/lib/auth';
import { slugify, vendorCode } from '@/lib/format';

const schema = z.object({
  role: z.enum(['customer', 'printer']), // designer registration is V2 (spec §8)
  firstName: z.string().min(1).max(80),
  surname: z.string().min(1).max(80),
  email: z.string().email().toLowerCase(),
  phone: z.string().min(7).max(20),
  password: z.string().min(8).max(100),
  // printer-only
  businessName: z.string().max(120).optional(),
  addressText: z.string().max(240).optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  supportsPickup: z.boolean().optional(),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Check the form — some fields are invalid.' }, { status: 400 });
  }
  const d = parsed.data;
  if (d.role === 'printer' && !d.businessName) {
    return NextResponse.json({ error: 'Business name is required for a printer account.' }, { status: 400 });
  }

  const existing = await db().select({ id: tables.users.id }).from(tables.users).where(eq(tables.users.email, d.email)).limit(1);
  if (existing.length) {
    return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(d.password, 10);
  const [user] = await db().insert(tables.users).values({
    role: d.role,
    firstName: d.firstName,
    surname: d.surname,
    email: d.email,
    phone: d.phone,
    passwordHash,
  }).returning({ id: tables.users.id, role: tables.users.role });

  if (d.role === 'printer') {
    const base = slugify(d.businessName!);
    await db().insert(tables.shops).values({
      userId: user.id,
      code: vendorCode(),
      businessName: d.businessName!,
      slug: `${base}-${user.id.slice(0, 6)}`,
      addressText: d.addressText,
      lat: d.lat,
      lng: d.lng,
      supportsPickup: d.supportsPickup ?? false,
    });
  }

  await createSession({ uid: user.id, role: user.role });
  return NextResponse.json({ ok: true, role: user.role });
}
__PRV1__
echo '  + src/app/api/auth/register/route.ts'

cat > 'src/app/login/page.tsx' << '__PRV1__'
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthForm } from '../register/AuthForm';

export const metadata: Metadata = { title: 'Login' };

export default function LoginPage() {
  return (
    <Suspense>
      <AuthForm mode="login" />
    </Suspense>
  );
}
__PRV1__
echo '  + src/app/login/page.tsx'

cat > 'src/app/page.tsx' << '__PRV1__'
import { Hero } from '@/components/home/Hero';
import { Marquee } from '@/components/home/Marquee';
import { HotProducts } from '@/components/home/HotProducts';
import { ValueStrip } from '@/components/home/ValueStrip';
import { Steps } from '@/components/home/Steps';
import { Footer } from '@/components/home/Footer';

// Fully server-rendered marketing page — zero client JS beyond the nav.
export default function HomePage() {
  return (
    <>
      <Hero />
      <Marquee />
      <HotProducts />
      <ValueStrip />
      <Steps />
      <Footer />
    </>
  );
}
__PRV1__
echo '  + src/app/page.tsx'

cat > 'src/app/register/AuthForm.tsx' << '__PRV1__'
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { LocateFixed } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';

type Tab = 'customer' | 'printer' | 'designer';

/** Separate customer and printer auth (spec §4 screen 1). Designer is V2 — visible, disabled. */
export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const router = useRouter();
  const params = useSearchParams();
  const [tab, setTab] = useState<Tab>(params.get('as') === 'printer' ? 'printer' : 'customer');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);

  function locate() {
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => { setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }); setLocating(false); },
      () => setLocating(false),
      { timeout: 8000 },
    );
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const f = new FormData(e.currentTarget);

    const payload = mode === 'login'
      ? { email: f.get('email'), password: f.get('password') }
      : {
          role: tab,
          firstName: f.get('firstName'),
          surname: f.get('surname'),
          email: f.get('email'),
          phone: f.get('phone'),
          password: f.get('password'),
          businessName: f.get('businessName') || undefined,
          addressText: f.get('addressText') || undefined,
          supportsPickup: f.get('supportsPickup') === 'on',
          ...(coords ?? {}),
        };

    const res = await fetch(`/api/auth/${mode}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) { setError(json.error ?? 'Something went wrong.'); return; }

    const next = params.get('next');
    router.push(next ?? (json.role === 'printer' ? '/dashboard' : '/products'));
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12 sm:px-6">
      <h1 className="font-display text-3xl font-extrabold tracking-tight text-black">
        {mode === 'login' ? 'Welcome back' : 'Create account'}
      </h1>
      <p className="mt-1.5 text-sm text-black/55">
        {mode === 'login' ? 'Log in to print, track and manage orders.' : 'One account to print — or to sell your printing.'}
      </p>

      <div className="mt-6 flex gap-1.5 rounded-pill bg-black/5 p-1" role="tablist" aria-label="Account type">
        {(['customer', 'printer', 'designer'] as Tab[]).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            disabled={t === 'designer'}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-pill px-3 py-2 font-display text-[13px] font-bold capitalize transition-colors ${
              tab === t ? 'bg-navy text-white' : 'text-navy disabled:opacity-35'
            }`}
          >
            {t === 'customer' ? 'Individual' : t}
            {t === 'designer' && <span className="ml-1 font-mono text-[9px] uppercase opacity-70">soon</span>}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="mt-6 space-y-4">
        {mode === 'register' && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="First name"><Input name="firstName" required autoComplete="given-name" /></Field>
            <Field label="Surname"><Input name="surname" required autoComplete="family-name" /></Field>
          </div>
        )}
        <Field label="Email"><Input name="email" type="email" required autoComplete="email" /></Field>
        {mode === 'register' && (
          <Field label="Phone"><Input name="phone" type="tel" required placeholder="0803 000 0000" autoComplete="tel" /></Field>
        )}
        <Field label="Password">
          <Input name="password" type="password" required minLength={mode === 'register' ? 8 : 1} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
        </Field>

        {mode === 'register' && tab === 'printer' && (
          <div className="space-y-4 rounded-2xl border border-black/12 bg-pale/30 p-4">
            <Field label="Business name"><Input name="businessName" required placeholder="e.g. Lekki Prints Hub" /></Field>
            <Field label="Shop address" hint="Customers see printers sorted by distance — set your location.">
              <Input name="addressText" required placeholder="e.g. 12 Bode Thomas, Surulere" />
            </Field>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" variant="tertiary" size="sm" onClick={locate} disabled={locating}>
                <LocateFixed className="size-4" /> {coords ? 'Location captured ✓' : locating ? 'Locating…' : 'Use my current location'}
              </Button>
              <label className="inline-flex items-center gap-2 font-display text-[13px] font-bold text-navy">
                <input type="checkbox" name="supportsPickup" className="size-4 accent-blue" />
                Customers can self-pickup
              </label>
            </div>
          </div>
        )}

        {error && <p className="rounded-xl border border-red/30 bg-red/5 px-3.5 py-2.5 text-sm text-red">{error}</p>}

        <Button type="submit" disabled={busy} className="w-full">
          {busy ? 'One moment…' : mode === 'login' ? 'Login' : 'Create account'} <span aria-hidden>→</span>
        </Button>
      </form>

      <p className="mt-5 text-center text-sm text-black/55">
        {mode === 'login' ? (
          <>New here? <Link href="/register" className="font-bold text-blue">Create account</Link></>
        ) : (
          <>Already registered? <Link href="/login" className="font-bold text-blue">Login</Link></>
        )}
      </p>
    </div>
  );
}
__PRV1__
echo '  + src/app/register/AuthForm.tsx'

cat > 'src/app/register/page.tsx' << '__PRV1__'
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthForm } from './AuthForm';

export const metadata: Metadata = { title: 'Create account' };

export default function RegisterPage() {
  return (
    <Suspense>
      <AuthForm mode="register" />
    </Suspense>
  );
}
__PRV1__
echo '  + src/app/register/page.tsx'

cat > 'src/components/home/Footer.tsx' << '__PRV1__'
import Link from 'next/link';
import { Logo } from '@/components/ui/Logo';

const COLS = [
  {
    h: 'Shop',
    links: [
      { label: 'Stickers', href: '/configure/sticker' },
      { label: 'Banners', href: '/configure/banner' },
      { label: 'Business Cards', href: '/configure/business_card' },
      { label: 'Frames', href: '/configure/frame' },
    ],
  },
  {
    h: 'Service',
    links: [
      { label: 'Track Order', href: '/track' },
      { label: 'All Products', href: '/products' },
      { label: 'My Orders', href: '/orders' },
      { label: 'Sell on Print Runs', href: '/register?as=printer' },
    ],
  },
  {
    h: 'Account',
    links: [
      { label: 'Login', href: '/login' },
      { label: 'Register', href: '/register' },
      { label: 'Printer Dashboard', href: '/dashboard' },
    ],
  },
];

export function Footer() {
  return (
    <footer className="mt-16 bg-navy text-white">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="flex flex-col justify-between gap-6 border-b border-white/10 pb-9 sm:flex-row sm:items-end">
          <Logo size="lg" />
          <p className="max-w-xs text-white/65">Print without leaving home. Lagos-wide delivery and pickup.</p>
        </div>
        <div className="grid grid-cols-2 gap-8 py-9 sm:grid-cols-3">
          {COLS.map((c) => (
            <nav key={c.h} aria-label={c.h}>
              <h4 className="mb-3.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-pale">{c.h}</h4>
              {c.links.map((l) => (
                <Link key={l.label} href={l.href} className="block py-1.5 text-sm text-white/70 transition-colors hover:text-pale">
                  {l.label}
                </Link>
              ))}
            </nav>
          ))}
        </div>
        <div className="flex flex-wrap justify-between gap-2 border-t border-white/10 pt-5 font-mono text-[11px] text-white/45">
          <span>© {new Date().getFullYear()} Print Runs · Lagos, NG</span>
          <span>Made for makers</span>
        </div>
      </div>
    </footer>
  );
}
__PRV1__
echo '  + src/components/home/Footer.tsx'

cat > 'src/components/home/Hero.tsx' << '__PRV1__'
import Image from 'next/image';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ButtonLink } from '@/components/ui/Button';
import { HeroArt } from './HeroArt';

/**
 * White → pale-yellow vertical gradient (spec §7.2). Headline follows the
 * one-line-in-blue pattern. Real photography preferred (§7.5): drop a photo of
 * the team/prints at public/hero.jpg and it replaces the illustration.
 */
export function Hero() {
  const hasPhoto = existsSync(join(process.cwd(), 'public', 'hero.jpg'));

  return (
    <section className="bg-fade-pale">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.05fr_0.95fr] md:py-20">
        <div>
          <p className="inline-flex items-center gap-2 rounded-pill border border-black/10 bg-white px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-widest text-navy">
            <span className="size-2 rounded-full bg-blue" aria-hidden />
            Lagos · Print on demand · Same-day production
          </p>
          <h1 className="mt-6 font-display text-5xl font-extrabold leading-[0.98] tracking-tight text-black text-balance-pretty sm:text-6xl lg:text-7xl">
            Print Without<br />
            <span className="text-blue">Leaving Home.</span>
          </h1>
          <p className="mt-5 max-w-md text-[17px] leading-relaxed text-black/65">
            Configure your job, compare nearby printers with live prices, pay securely
            and track it to your door — Island and Mainland.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <ButtonLink href="/products">Start Printing <span aria-hidden>→</span></ButtonLink>
            {/* Request Designer is paused for V1 — visible but disabled so the layout holds (spec §8). */}
            <span className="relative inline-flex">
              <ButtonLink href="#" variant="secondary" aria-disabled className="pointer-events-none opacity-60">
                Request Designer
              </ButtonLink>
              <span className="absolute -right-2 -top-2 rounded-pill bg-navy px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest text-pale">
                Soon
              </span>
            </span>
          </div>
        </div>

        <div className="relative">
          {hasPhoto ? (
            <Image
              src="/hero.jpg"
              alt="Freshly printed work from Lagos printers on the Print Runs marketplace"
              width={880}
              height={660}
              priority
              className="w-full rounded-3xl border border-black/10 object-cover"
            />
          ) : (
            <HeroArt />
          )}
        </div>
      </div>
    </section>
  );
}
__PRV1__
echo '  + src/components/home/Hero.tsx'

cat > 'src/components/home/HeroArt.tsx' << '__PRV1__'
/** Illustration fallback until real photography lands at public/hero.jpg (spec §7.5). */
export function HeroArt() {
  return (
    <svg viewBox="0 0 520 420" className="w-full" aria-hidden="true">
      <rect x="24" y="20" width="472" height="380" rx="24" fill="#FFFBB5" opacity="0.55" />
      <g transform="rotate(-4 210 210)">
        <rect x="70" y="80" width="220" height="290" rx="8" fill="#fff" stroke="#00000A" strokeWidth="2.5" />
        <rect x="90" y="100" width="180" height="110" rx="4" fill="#0000FF" />
        <rect x="90" y="226" width="120" height="9" rx="4" fill="#00000A" />
        <rect x="90" y="244" width="160" height="6" rx="3" fill="#00000A" opacity="0.45" />
        <rect x="90" y="258" width="140" height="6" rx="3" fill="#00000A" opacity="0.45" />
        <rect x="90" y="320" width="92" height="26" rx="13" fill="#00000A" />
        <rect x="98" y="329" width="60" height="8" rx="4" fill="#FFFBB5" />
      </g>
      <g transform="rotate(6 360 250)">
        <rect x="250" y="170" width="230" height="150" rx="10" fill="#fff" stroke="#00000A" strokeWidth="2.5" />
        <rect x="270" y="190" width="110" height="9" rx="4" fill="#0000FF" />
        <rect x="270" y="208" width="150" height="6" rx="3" fill="#00000A" opacity="0.4" />
        <rect x="270" y="222" width="130" height="6" rx="3" fill="#00000A" opacity="0.4" />
        <line x1="270" y1="278" x2="460" y2="278" stroke="#00000A" strokeWidth="2" strokeDasharray="6 6" opacity="0.5" />
        <rect x="270" y="290" width="86" height="18" rx="9" fill="#0000FF" />
        <circle cx="440" cy="240" r="20" fill="#FFFBB5" stroke="#00000A" strokeWidth="2.5" />
        <path d="M432 240l6 6 11-13" stroke="#00000A" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <g transform="rotate(-10 120 330)">
        <circle cx="120" cy="330" r="46" fill="#0000FF" stroke="#00000A" strokeWidth="2.5" />
        <circle cx="120" cy="330" r="30" fill="#fff" stroke="#00000A" strokeWidth="2" />
        <text x="120" y="327" textAnchor="middle" fontFamily="system-ui" fontWeight="800" fontStyle="italic" fontSize="11" fill="#00000A">PRINT</text>
        <text x="120" y="341" textAnchor="middle" fontFamily="system-ui" fontWeight="800" fontStyle="italic" fontSize="11" fill="#0000FF">RUNS</text>
      </g>
    </svg>
  );
}
__PRV1__
echo '  + src/components/home/HeroArt.tsx'

cat > 'src/components/home/HotProducts.tsx' << '__PRV1__'
import Link from 'next/link';
import { CATEGORIES, productCode } from '@/lib/categories';
import { Glyph } from '@/components/ui/Glyph';
import { CodeBadge } from '@/components/ui/CodeBadge';

/** "HOT" stays red — the one sanctioned accent-word use (spec §7.2). */
export function HotProducts() {
  return (
    <section id="products" className="bg-fade-pale">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
        <div className="mb-8">
          <h2 className="font-display text-4xl font-extrabold tracking-tight text-black sm:text-5xl">
            <span className="text-red">Hot</span> Products
          </h2>
          <p className="mt-2 text-black/60">Most-printed this week. Tap one to start a job.</p>
        </div>

        <ul className="grid grid-cols-2 gap-3.5 sm:gap-5 lg:grid-cols-4">
          {CATEGORIES.map((c) => (
            <li key={c.slug}>
              {c.live ? (
                <Link
                  href={`/configure/${c.slug}`}
                  className="group flex h-full flex-col overflow-hidden rounded-2xl border border-black/12 bg-white transition-all hover:-translate-y-0.5 hover:border-blue hover:shadow-[0_10px_30px_-12px_rgba(0,0,255,0.25)]"
                >
                  <div className="relative grid aspect-[1.25/1] place-items-center border-b border-black/10 bg-white p-5">
                    <Glyph kind={c.glyph} color={c.hue} className="size-16 sm:size-20" />
                    <span className="absolute right-2.5 top-2.5"><CodeBadge code={productCode(c.slug)} /></span>
                  </div>
                  <div className="flex flex-1 flex-col gap-2.5 p-4">
                    <h3 className="font-display text-lg font-extrabold tracking-tight text-navy">{c.name}</h3>
                    <div className="flex flex-wrap gap-1.5">
                      <span className="rounded-pill bg-blue px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-wider text-white">
                        Ready in {c.turnaround}
                      </span>
                      {c.moq && (
                        <span className="rounded-pill border border-black/20 px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-wider text-navy">
                          MOQ {c.moq}
                        </span>
                      )}
                    </div>
                    <span className="mt-auto border-t border-dashed border-black/25 pt-2.5 font-display text-[13px] font-bold text-navy transition-colors group-hover:text-blue">
                      Print now <span aria-hidden>→</span>
                    </span>
                  </div>
                </Link>
              ) : (
                <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-dashed border-black/20 bg-white/60">
                  <div className="relative grid aspect-[1.25/1] place-items-center border-b border-dashed border-black/15 p-5 opacity-45">
                    <Glyph kind={c.glyph} color={c.hue} className="size-16 sm:size-20" />
                    <span className="absolute right-2.5 top-2.5"><CodeBadge code={productCode(c.slug)} tone="light" /></span>
                  </div>
                  <div className="flex flex-1 flex-col gap-2.5 p-4">
                    <h3 className="font-display text-lg font-extrabold tracking-tight text-navy/60">{c.name}</h3>
                    <span className="mt-auto border-t border-dashed border-black/20 pt-2.5 font-mono text-[10px] font-bold uppercase tracking-widest text-navy/50">
                      Coming soon
                    </span>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
__PRV1__
echo '  + src/components/home/HotProducts.tsx'

cat > 'src/components/home/Marquee.tsx' << '__PRV1__'
const ITEMS = ['PRINT RUNS', '24HR TURNAROUND', 'ISLAND + MAINLAND', 'CMYK READY', 'PAY WITH PAYSTACK', 'TRACK LIVE'];

export function Marquee() {
  // Exactly two identical groups + translateX(-50%) = a seamless loop.
  const group = (key: string) => (
    <span key={key} className="inline-flex">
      {ITEMS.map((t) => (
        <span key={t} className="inline-flex items-center gap-3 pr-8 font-mono text-[12px] font-bold uppercase tracking-[0.14em] text-navy">
          {t} <span className="text-blue" aria-hidden>✦</span>
        </span>
      ))}
    </span>
  );
  return (
    <div className="overflow-hidden border-y border-black/10 bg-pale py-2.5" aria-hidden="true">
      <div className="marquee-track">{group('a')}{group('b')}</div>
    </div>
  );
}
__PRV1__
echo '  + src/components/home/Marquee.tsx'

cat > 'src/components/home/Steps.tsx' << '__PRV1__'
const STEPS = [
  { n: '01', t: 'Pick & configure', d: 'Choose what to print, set your exact size, quantity and finish, drop your file.' },
  { n: '02', t: 'Compare printers', d: 'See nearby printers who can do that exact spec, sorted by distance, with live prices.' },
  { n: '03', t: 'Pay & track', d: 'Pay with Paystack. Delivery riders or self-pickup — track every status change live.' },
];

export function Steps() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
      <div className="mb-8">
        <h2 className="font-display text-4xl font-extrabold tracking-tight text-black sm:text-5xl">
          From file to <span className="text-blue">doorstep</span>
        </h2>
        <p className="mt-2 text-black/60">Three steps. No back-and-forth.</p>
      </div>
      <ol className="grid gap-4 md:grid-cols-3">
        {STEPS.map((s) => (
          <li key={s.n} className="rounded-2xl border border-black/12 bg-white p-7">
            <span className="font-mono text-xs font-bold tracking-widest text-blue">{s.n}</span>
            <h3 className="mt-2 font-display text-2xl font-extrabold tracking-tight text-navy">{s.t}</h3>
            <p className="mt-2 leading-relaxed text-black/60">{s.d}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
__PRV1__
echo '  + src/components/home/Steps.tsx'

cat > 'src/components/home/ValueStrip.tsx' << '__PRV1__'
/** Replaces the old fabricated stats band — honest value props, no invented numbers. */
const ITEMS = [
  { k: 'Same-day', v: 'production on most jobs' },
  { k: 'Island + Mainland', v: 'delivery or self-pickup' },
  { k: 'Paystack', v: 'secure checkout in Naira' },
  { k: 'Live tracking', v: 'from press to doorstep' },
];

export function ValueStrip() {
  return (
    <section className="mx-auto max-w-6xl px-4 sm:px-6">
      <div className="grid grid-cols-2 overflow-hidden rounded-2xl bg-navy text-white lg:grid-cols-4">
        {ITEMS.map((s) => (
          <div key={s.k} className="border-b border-r border-white/10 px-6 py-7 last:border-r-0 lg:border-b-0 [&:nth-child(2)]:border-r-0 lg:[&:nth-child(2)]:border-r">
            <p className="font-display text-xl font-extrabold text-pale">{s.k}</p>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-white/60">{s.v}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
__PRV1__
echo '  + src/components/home/ValueStrip.tsx'

