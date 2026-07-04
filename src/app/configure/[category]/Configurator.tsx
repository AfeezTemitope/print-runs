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
