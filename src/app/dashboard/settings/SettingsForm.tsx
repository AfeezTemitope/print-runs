'use client';

import { useState, useTransition } from 'react';
import { LocateFixed } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { saveSettings } from './actions';

type Initial = {
  businessName: string; bio: string; openingHours: string;
  addressLine1: string; addressLine2: string; addressCity: string; addressState: string;
  logoUrl: string; bannerUrl: string; hasLocation: boolean;
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
      {/* V2: address split into 4 fields (Batch 1 foundation). */}
      <Field label="Address line 1"><Input value={form.addressLine1} onChange={set('addressLine1')} placeholder="e.g. 12 Bode Thomas Street" /></Field>
      <Field label="Address line 2" hint="Optional — landmark, floor, unit."><Input value={form.addressLine2} onChange={set('addressLine2')} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="City"><Input value={form.addressCity} onChange={set('addressCity')} placeholder="e.g. Surulere" /></Field>
        <Field label="State"><Input value={form.addressState} onChange={set('addressState')} placeholder="e.g. Lagos" /></Field>
      </div>
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
      {/* V2: the delivery/pickup toggles are gone. Every order is delivered using your own
          dispatch arrangements. Where a customer declines the delivery fee, PrintRuns may
          arrange collection with you directly — it is never a customer-facing option. */}
      <p className="rounded-2xl border border-black/12 bg-pale/25 p-4 text-[13px] leading-relaxed text-navy">
        <span className="font-bold">Delivery:</span> all orders are delivered using your own
        dispatch rider. PrintRuns confirms the delivery fee with the customer after payment. If a
        customer arranges their own rider instead, PrintRuns will confirm who is authorised to
        collect before you release the job.
      </p>
      {msg && <p className={`text-sm ${msg === 'Saved.' ? 'text-success' : 'text-red'}`}>{msg}</p>}
      <Button onClick={save} disabled={pending}>{pending ? 'Saving…' : 'Save settings'}</Button>
    </div>
  );
}
