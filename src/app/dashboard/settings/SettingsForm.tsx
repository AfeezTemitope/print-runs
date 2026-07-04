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
