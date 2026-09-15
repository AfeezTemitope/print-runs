'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { PhotoUpload } from '@/components/ui/PhotoUpload';
import { saveStorefront } from './actions';

export type StorefrontData = {
  businessName: string; slug: string; bio: string;
  logoUrl: string; bannerUrl: string;
  addressLine1: string; addressCity: string; addressState: string;
  whatsapp: string;
  listingCount: number;
};

export function StorefrontClient({ data, siteUrl }: { data: StorefrontData; siteUrl: string }) {
  const [businessName, setBusinessName] = useState(data.businessName);
  const [bio, setBio] = useState(data.bio);
  const [logoUrl, setLogoUrl] = useState<string | undefined>(data.logoUrl || undefined);
  const [bannerUrl, setBannerUrl] = useState<string | undefined>(data.bannerUrl || undefined);
  const [addressLine1, setAddressLine1] = useState(data.addressLine1);
  const [addressCity, setAddressCity] = useState(data.addressCity);
  const [addressState, setAddressState] = useState(data.addressState);
  const [whatsapp, setWhatsapp] = useState(data.whatsapp);

  const [slug, setSlug] = useState(data.slug);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const publicUrl = `${siteUrl.replace(/^https?:\/\//, '')}/${slug}`;

  return (
    <div className="space-y-6">
      {data.listingCount === 0 && (
        <p className="rounded-2xl border border-blue/30 bg-blue/5 px-4 py-3 text-[13px] text-navy">
          Your storefront is set up, but customers can&apos;t find you in search until you add at
          least one product. <Link href="/dashboard/listings" className="font-semibold text-blue underline">Add a product →</Link>
        </p>
      )}

      <div className="rounded-2xl border border-black/12 bg-white p-5">
        <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-black/45">Your public link</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span className="font-display text-lg font-extrabold text-navy">{publicUrl}</span>
          <a href={`/${slug}`} target="_blank" rel="noreferrer"
            className="flex items-center gap-1 font-display text-[13px] font-bold text-blue hover:underline">
            View <ExternalLink className="size-3.5" />
          </a>
        </div>
        <p className="mt-1.5 text-xs text-black/50">
          Share this on Instagram or WhatsApp status. It stays the same even if you rename your
          business, so links you&apos;ve already shared keep working.
        </p>
      </div>

      <div className="space-y-5 rounded-2xl border border-black/12 bg-white p-5">
        <Field label="Business name">
          <Input value={businessName} onChange={(e) => { setBusinessName(e.target.value); setSaved(false); }} />
        </Field>

        <Field label="About" hint="Two or three sentences, in your own words.">
          <Textarea rows={3} value={bio} onChange={(e) => { setBio(e.target.value); setSaved(false); }}
            placeholder="Quality prints, honest turnaround. We specialise in stickers and packaging." />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Logo"><PhotoUpload kind="products" label="Logo" aspect="aspect-square" url={logoUrl} onChange={(u) => { setLogoUrl(u); setSaved(false); }} /></Field>
          <Field label="Cover photo"><PhotoUpload kind="products" label="Cover" aspect="aspect-[3/1]" url={bannerUrl} onChange={(u) => { setBannerUrl(u); setSaved(false); }} /></Field>
        </div>

        <Field label="Street address (optional)">
          <Input value={addressLine1} onChange={(e) => { setAddressLine1(e.target.value); setSaved(false); }} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Area" hint="Shown to customers, e.g. Lekki Phase 1.">
            <Input value={addressCity} onChange={(e) => { setAddressCity(e.target.value); setSaved(false); }} placeholder="Lekki Phase 1" />
          </Field>
          <Field label="State">
            <Input value={addressState} onChange={(e) => { setAddressState(e.target.value); setSaved(false); }} placeholder="Lagos" />
          </Field>
        </div>

        <Field label="WhatsApp number (optional)" hint="Shown publicly — it's how most customers will reach you.">
          <Input value={whatsapp} onChange={(e) => { setWhatsapp(e.target.value); setSaved(false); }} placeholder="0803 000 0000" />
        </Field>

        {error && <p className="rounded-xl border border-red/30 bg-red/5 px-3.5 py-2.5 text-sm text-red">{error}</p>}

        <Button size="sm" disabled={pending} onClick={() => {
          setError(null);
          start(async () => {
            const res = await saveStorefront({
              businessName, bio,
              logoUrl: logoUrl ?? '', bannerUrl: bannerUrl ?? '',
              addressLine1, addressCity, addressState, whatsapp,
            });
            if (res?.error) setError(res.error);
            else { setSaved(true); if (res && 'slug' in res && res.slug) setSlug(res.slug); }
          });
        }}>
          {pending ? 'Saving…' : saved ? 'Saved' : 'Save storefront'}
        </Button>
      </div>
    </div>
  );
}
