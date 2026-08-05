'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { UploadCloud, FileCheck2, X, Info } from 'lucide-react';
import type { Category, Listing } from '@/lib/categories';
import type { CustomerSpec } from '@/lib/pricing';
import { specToParams, specSummary } from '@/lib/spec';
import { Glyph } from '@/components/ui/Glyph';
import { CodeBadge } from '@/components/ui/CodeBadge';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';

/**
 * Product-first flow (spec §2): define the exact spec here, see printer prices on the next
 * screen. After QA Round 1 the configurator is per LISTING, not per category — the type was
 * already chosen on the page before this one, so there is no type switcher in here.
 */
export function Configurator({
  category, listing, photoUrl,
}: { category: Category; listing: Listing; photoUrl?: string }) {
  const router = useRouter();

  const sizeCfg = listing.size;
  const customOnly = Boolean(sizeCfg?.customOnly);
  const qtyCfg = listing.qty;
  const freeQty = Boolean(qtyCfg?.freeInput);
  const qtyPresets = qtyCfg?.presets ?? [];
  const sheetsAxis = listing.pricingGrid?.axes.find((a) => a.source === 'sheets');

  const [sizeMode, setSizeMode] = useState<'preset' | 'custom'>(customOnly ? 'custom' : 'preset');
  const [preset, setPreset] = useState(0);
  const [w, setW] = useState('');
  const [h, setH] = useState('');
  const [unit, setUnit] = useState<'ft' | 'in' | 'cm'>(sizeCfg?.defaultUnit ?? 'in');
  const [qty, setQty] = useState<number>(qtyPresets[0] ?? qtyCfg?.min ?? 1);
  const [customQty, setCustomQty] = useState(freeQty ? String(qtyCfg?.min ?? 1) : '');
  const [sheets, setSheets] = useState<number>(Number(sheetsAxis?.values[0] ?? 0));
  const [options, setOptions] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      (listing.optionAxes ?? []).filter((a) => a.required !== false).map((a) => [a.key, a.options[0]]),
    ),
  );
  const [note, setNote] = useState('');
  const [file, setFile] = useState<{ url: string; name: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);

  const effQty = customQty ? Number(customQty) : qty;

  const spec: CustomerSpec = useMemo(() => {
    const s: CustomerSpec = { category: category.slug, listing: listing.slug, qty: effQty || undefined };
    if (sizeCfg) {
      if (sizeMode === 'preset' && sizeCfg.presets.length) {
        const p = sizeCfg.presets[Math.min(preset, sizeCfg.presets.length - 1)];
        s.width = p.width; s.height = p.height; s.unit = p.unit; s.sizeLabel = p.label;
      } else {
        s.width = Number(w) || undefined; s.height = Number(h) || undefined; s.unit = unit;
      }
    }
    if (sheetsAxis) s.sheets = sheets;
    if (Object.keys(options).length) s.options = options;
    return s;
  }, [category, listing, sizeCfg, sizeMode, preset, w, h, unit, effQty, sheetsAxis, sheets, options]);

  const sizeOk = !sizeCfg || sizeMode === 'preset' || (Number(w) > 0 && Number(h) > 0);
  const qtyOk = !qtyCfg || effQty >= qtyCfg.min;
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

  const showTypeCrumb = category.listings.length > 1;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-blue">Configuring</p>
      <h1 className="mt-1 font-display text-4xl font-extrabold tracking-tight text-black">
        {category.name}{showTypeCrumb && <span className="text-black/45"> — {listing.label}</span>}
      </h1>

      <div className="mt-7 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6 rounded-2xl border border-black/12 bg-white p-5 sm:p-7">
          {sizeCfg && (
            <div>
              <div className="mb-2.5 flex items-center justify-between">
                <span className="font-display text-[13px] font-bold text-navy">Size</span>
                {!customOnly && (
                  <div className="flex gap-1 rounded-pill bg-black/5 p-0.5">
                    {(['preset', 'custom'] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => setSizeMode(m)}
                        disabled={m === 'custom' && !sizeCfg.allowCustom}
                        className={`rounded-pill px-3.5 py-1.5 font-display text-xs font-bold capitalize ${sizeMode === m ? 'bg-navy text-white' : 'text-navy'}`}
                      >
                        {m === 'preset' ? 'Presets' : 'Custom size'}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {sizeMode === 'preset' && !customOnly ? (
                <div className="flex flex-wrap gap-2">
                  {sizeCfg.presets.map((p, i) => (
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
                <>
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
                  {customOnly && (
                    <p className="mt-1.5 text-xs text-black/50">
                      This type is custom size only — enter any dimension, decimals allowed.
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {sheetsAxis && (
            <Field label="Sheets">
              <Select value={sheets} onChange={(e) => setSheets(Number(e.target.value))}>
                {sheetsAxis.values.map((s) => <option key={String(s)} value={String(s)}>{s} sheets</option>)}
              </Select>
            </Field>
          )}

          {(listing.optionAxes ?? []).map((axis) => (
            axis.required === false ? (
              // Optional axis (Hylet): a free toggle, with the choice appearing once it is on.
              <div key={axis.key}>
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5 font-display text-[13px] font-bold text-navy">
                    {axis.label}
                    {axis.hint && (
                      <span title={axis.hint} aria-label={axis.hint}>
                        <Info className="size-3.5 text-black/35" />
                      </span>
                    )}
                    <span className="rounded-pill bg-success/10 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-success">Free</span>
                  </span>
                  <button
                    role="switch"
                    aria-checked={Boolean(options[axis.key])}
                    aria-label={axis.label}
                    onClick={() => setOptions((o) => {
                      const next = { ...o };
                      if (next[axis.key]) delete next[axis.key];
                      else next[axis.key] = axis.options[0];
                      return next;
                    })}
                    className={`h-6 w-11 rounded-pill border transition-colors ${
                      options[axis.key] ? 'border-blue bg-blue' : 'border-black/20 bg-black/10'
                    }`}
                  >
                    <span className={`block size-5 rounded-pill bg-white transition-transform ${options[axis.key] ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
                {axis.hint && <p className="mt-1 text-xs text-black/50">{axis.hint}</p>}
                {options[axis.key] && (
                  <Select
                    className="mt-2"
                    aria-label={`${axis.label} placement`}
                    value={options[axis.key]}
                    onChange={(e) => setOptions((o) => ({ ...o, [axis.key]: e.target.value }))}
                  >
                    {axis.options.map((o) => <option key={o}>{o}</option>)}
                  </Select>
                )}
              </div>
            ) : (
              <Field key={axis.key} label={axis.label} hint={axis.hint}>
                <Select
                  value={options[axis.key] ?? axis.options[0]}
                  onChange={(e) => setOptions((o) => ({ ...o, [axis.key]: e.target.value }))}
                >
                  {axis.options.map((o) => <option key={o}>{o}</option>)}
                </Select>
              </Field>
            )
          ))}

          {qtyCfg && (
            <div>
              <span className="mb-2.5 block font-display text-[13px] font-bold text-navy">Quantity</span>
              {freeQty ? (
                <Input
                  inputMode="numeric"
                  value={customQty}
                  onChange={(e) => setCustomQty(e.target.value.replace(/\D/g, ''))}
                  placeholder={String(qtyCfg.min)}
                  className="!w-40"
                  aria-label="Quantity"
                />
              ) : (
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
                  {qtyCfg.allowCustom && (
                    <Input
                      inputMode="numeric"
                      value={customQty}
                      onChange={(e) => setCustomQty(e.target.value.replace(/\D/g, ''))}
                      placeholder="Custom"
                      className="!w-28"
                      aria-label="Custom quantity"
                    />
                  )}
                </div>
              )}
              {!qtyOk && <p className="mt-1.5 text-xs text-red">Minimum order is {qtyCfg.min}.</p>}
              {qtyOk && customQty !== '' && !qtyPresets.includes(effQty) && (
                <p className="mt-1.5 text-xs text-black/50">
                  Quantities outside a printer&apos;s tiers show as Request Quote for that printer.
                </p>
              )}
            </div>
          )}

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
                {/* QA 1.6: CDR added platform-wide. */}
                <input type="file" hidden accept=".pdf,.ai,.cdr,.png,.jpg,.jpeg" onChange={(e) => onFile(e.target.files?.[0])} />
                <UploadCloud className="size-6 text-navy" />
                <span className="font-display text-sm font-bold text-navy">
                  {uploading ? 'Uploading…' : 'Drop your file or tap to browse'}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-widest text-black/45">PDF, AI, CDR, PNG, JPG · CMYK preferred</span>
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
            <CodeBadge code={listing.code} tone="light" />
          </div>
          {photoUrl ? (
            <div className="relative mt-4 aspect-[4/3] overflow-hidden rounded-xl border border-white/20">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoUrl} alt={`${category.name} — ${listing.label}`} className="size-full object-cover" />
            </div>
          ) : (
            <div className="mt-4 grid place-items-center rounded-xl border border-white/20 bg-white/5 py-8">
              <Glyph kind={category.glyph} color="#FFFBB5" className="size-20" />
            </div>
          )}
          <dl className="mt-4 space-y-0 font-mono text-[13px]">
            <div className="flex justify-between border-b border-dashed border-white/20 py-2.5">
              <dt className="text-white/55">Item</dt>
              <dd className="font-bold">{showTypeCrumb ? `${category.name} — ${listing.label}` : category.name}</dd>
            </div>
            {specSummary({ ...spec, listing: undefined }).map((line, i) => (
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
