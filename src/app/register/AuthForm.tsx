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
  const asParam = params.get('as');
  const [tab, setTab] = useState<Tab>(
    asParam === 'printer' ? 'printer' : asParam === 'designer' ? 'designer' : 'customer',
  );
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
          addressLine1: f.get('addressLine1') || undefined,
          addressLine2: f.get('addressLine2') || undefined,
          addressCity: f.get('addressCity') || undefined,
          addressState: f.get('addressState') || undefined,
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
    // Each role lands where it has something to do: printers in their queue, designers in
    // the studio they still have to build, everyone else in the catalogue.
    const home = json.role === 'printer' ? '/dashboard'
      : json.role === 'designer' ? '/studio'
      : json.role === 'admin' ? '/admin'
      : '/products';
    router.push(next ?? home);
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

      {/* V2 fix: the tab selector only appears when creating an account. On login, the
          account's role is authoritative — V1 showed these tabs during login too, but the
          submit handler ignored `tab` entirely, so a printer account could "log in via the
          Individual tab" and land in the wrong place with no actual check ever happening. */}
      {mode === 'register' && (
        <div className="mt-6 flex gap-1.5 rounded-pill bg-black/5 p-1" role="tablist" aria-label="Account type">
          {(['customer', 'printer', 'designer'] as Tab[]).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`flex-1 rounded-pill px-3 py-2 font-display text-[13px] font-bold capitalize transition-colors ${
                tab === t ? 'bg-navy text-white' : 'text-navy disabled:opacity-35'
              }`}
            >
              {t === 'customer' ? 'Individual' : t}
            </button>
          ))}
        </div>
      )}

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
            <Field label="Address line 1"><Input name="addressLine1" required placeholder="e.g. 12 Bode Thomas Street" /></Field>
            <Field label="Address line 2" hint="Optional — landmark, floor, unit."><Input name="addressLine2" placeholder="e.g. 2nd floor, opposite the bank" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="City"><Input name="addressCity" required placeholder="e.g. Surulere" /></Field>
              <Field label="State"><Input name="addressState" required placeholder="e.g. Lagos" /></Field>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" variant="tertiary" size="sm" onClick={locate} disabled={locating}>
                <LocateFixed className="size-4" /> {coords ? 'Location captured ✓' : locating ? 'Locating…' : 'Use my current location'}
              </Button>
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
