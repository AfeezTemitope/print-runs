'use client';

import { useState, useTransition } from 'react';
import Image from 'next/image';
import { Plus, Trash2 } from 'lucide-react';
import { naira } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { PhotoUpload } from '@/components/ui/PhotoUpload';
import { CodeBadge } from '@/components/ui/CodeBadge';
import { saveStudio, addWork, removeWork, saveService, removeService, submitForReview } from './actions';

export type StudioData = {
  id: string; code: string; slug: string;
  displayName: string; tagline: string; bio: string;
  avatarUrl: string; bannerUrl: string;
  verification: 'pending' | 'verified' | 'rejected';
  verificationNote: string | null;
  submitted: boolean;
} | null;

export type Work = { id: string; imageUrl: string; caption: string | null };
export type Service = {
  id: string; title: string; description: string | null; priceKobo: number;
  revisionsIncluded: number; extraRevisionKobo: number; turnaroundHours: number; isActive: boolean;
};

function useAction() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<{ error?: string } | void>, after?: () => void) => {
    setError(null);
    start(async () => {
      const res = await fn();
      if (res && 'error' in res && res.error) setError(res.error);
      else after?.();
    });
  };
  return { pending, error, run, setError };
}

function ServiceRow({ service, onDone }: { service: Service | null; onDone: () => void }) {
  const [title, setTitle] = useState(service?.title ?? '');
  const [description, setDescription] = useState(service?.description ?? '');
  const [price, setPrice] = useState(service ? String(service.priceKobo / 100) : '');
  const [revisions, setRevisions] = useState(String(service?.revisionsIncluded ?? 2));
  const [extra, setExtra] = useState(service ? String(service.extraRevisionKobo / 100) : '0');
  const [turnaround, setTurnaround] = useState(String(service?.turnaroundHours ?? 48));
  const { pending, error, run } = useAction();

  return (
    <li className="rounded-2xl border border-black/12 bg-white p-4">
      <div className="grid gap-3">
        <Field label="Service"><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Logo design" /></Field>
        <Field label="What's included"><Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Price (₦)"><Input inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ''))} /></Field>
          <Field label="Revisions included"><Input inputMode="numeric" value={revisions} onChange={(e) => setRevisions(e.target.value.replace(/\D/g, ''))} /></Field>
          <Field label="Extra revision (₦)"><Input inputMode="numeric" value={extra} onChange={(e) => setExtra(e.target.value.replace(/\D/g, ''))} /></Field>
          <Field label="Turnaround (hrs)"><Input inputMode="numeric" value={turnaround} onChange={(e) => setTurnaround(e.target.value.replace(/\D/g, ''))} /></Field>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" disabled={pending} onClick={() => run(() => saveService({
            id: service?.id, title, description, price,
            revisionsIncluded: revisions, extraRevision: extra, turnaround,
            isActive: service?.isActive ?? true,
          }), onDone)}>
            {pending ? 'Saving…' : service ? 'Save' : 'Add service'}
          </Button>
          {service && (
            <button aria-label="Remove service" className="ml-auto text-black/35 hover:text-red"
              onClick={() => run(() => removeService(service.id))}>
              <Trash2 className="size-4" />
            </button>
          )}
        </div>
        {error && <p className="text-sm text-red">{error}</p>}
      </div>
    </li>
  );
}

export function StudioClient({ studio, works, services }: { studio: StudioData; works: Work[]; services: Service[] }) {
  const [displayName, setDisplayName] = useState(studio?.displayName ?? '');
  const [tagline, setTagline] = useState(studio?.tagline ?? '');
  const [bio, setBio] = useState(studio?.bio ?? '');
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(studio?.avatarUrl || undefined);
  const [bannerUrl, setBannerUrl] = useState<string | undefined>(studio?.bannerUrl || undefined);
  const [caption, setCaption] = useState('');
  const [addingService, setAddingService] = useState(false);
  const { pending, error, run } = useAction();

  const canSubmit = works.length >= 3 && services.length >= 1;

  return (
    <div className="space-y-8">
      {studio && (
        <div className={`rounded-2xl border p-4 ${
          studio.verification === 'verified' ? 'border-success/40 bg-success/5'
            : studio.verification === 'rejected' ? 'border-red/30 bg-red/5' : 'border-black/12'
        }`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-display font-extrabold text-navy">
                {studio.verification === 'verified' ? 'Your studio is live'
                  : studio.verification === 'rejected' ? 'Not approved yet'
                  : studio.submitted ? 'Under review' : 'Not submitted yet'}
              </p>
              <p className="mt-0.5 text-[13px] text-black/60">
                {studio.verification === 'verified'
                  ? `Customers can find you at /designers/${studio.slug}`
                  : studio.verification === 'rejected'
                  ? studio.verificationNote ?? 'Update your portfolio and submit again.'
                  : canSubmit
                  ? 'Your profile is only visible to customers once approved.'
                  : 'Add at least 3 portfolio pieces and 1 service, then submit.'}
              </p>
            </div>
            <CodeBadge code={studio.code} tone="light" />
          </div>
          {studio.verification !== 'verified' && (
            <Button size="sm" className="mt-3" disabled={pending || !canSubmit} onClick={() => run(submitForReview)}>
              Submit for review
            </Button>
          )}
        </div>
      )}

      <section>
        <h2 className="mb-3 font-display text-xl font-extrabold text-navy">Your studio</h2>
        <div className="grid gap-4 rounded-2xl border border-black/12 bg-white p-5">
          <Field label="Studio name"><Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Ada Creative" /></Field>
          <Field label="Tagline" hint="One line customers see on your card."><Input value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="Brand identity for small businesses" /></Field>
          <Field label="About"><Textarea rows={4} value={bio} onChange={(e) => setBio(e.target.value)} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Profile photo"><PhotoUpload kind="products" label="Profile" url={avatarUrl} onChange={setAvatarUrl} aspect="aspect-square" /></Field>
            <Field label="Banner"><PhotoUpload kind="products" label="Banner" url={bannerUrl} onChange={setBannerUrl} aspect="aspect-[3/1]" /></Field>
          </div>
          <div>
            <Button size="sm" disabled={pending} onClick={() => run(() => saveStudio({
              displayName, tagline, bio, avatarUrl: avatarUrl ?? '', bannerUrl: bannerUrl ?? '',
            }))}>
              {pending ? 'Saving…' : 'Save studio'}
            </Button>
          </div>
          {error && <p className="text-sm text-red">{error}</p>}
        </div>
      </section>

      {studio && (
        <>
          <section>
            <h2 className="mb-1 font-display text-xl font-extrabold text-navy">Portfolio</h2>
            <p className="mb-3 text-[13px] text-black/55">{works.length} of 24 · this is what customers judge you on.</p>
            <div className="grid gap-3 sm:grid-cols-3">
              {works.map((w) => (
                <div key={w.id} className="relative aspect-square overflow-hidden rounded-xl border border-black/12">
                  <Image src={w.imageUrl} alt={w.caption ?? 'Portfolio piece'} fill sizes="240px" className="object-cover" />
                  <button aria-label="Remove piece" onClick={() => run(() => removeWork(w.id))}
                    className="absolute right-2 top-2 grid size-7 place-items-center rounded-pill bg-black/60 text-white hover:bg-red">
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
              {works.length < 24 && (
                <div className="rounded-xl border border-dashed border-black/25 p-3">
                  <PhotoUpload kind="products" label="Portfolio piece" aspect="aspect-square"
                    onChange={(url) => { if (url) run(() => addWork(url, caption), () => setCaption('')); }} />
                  <Input className="mt-2" value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Caption (optional)" />
                </div>
              )}
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-xl font-extrabold text-navy">Services &amp; prices</h2>
              <Button size="sm" variant="tertiary" onClick={() => setAddingService((a) => !a)}>
                <Plus className="size-4" /> {addingService ? 'Cancel' : 'New service'}
              </Button>
            </div>
            <ul className="space-y-3">
              {addingService && <ServiceRow service={null} onDone={() => setAddingService(false)} />}
              {services.map((s) => <ServiceRow key={s.id} service={s} onDone={() => {}} />)}
            </ul>
            {!services.length && !addingService && (
              <p className="text-black/55">
                No services yet. Customers can&apos;t book you until you list at least one — most designers
                start with a logo package around {naira(1500000)}.
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
