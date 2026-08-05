import type { Metadata } from 'next';
import { LIVE_CATEGORIES } from '@/lib/categories';
import { getCategoryMargins } from '@/lib/margins';
import { MarginEditor, type MarginRow } from './MarginEditor';

export const metadata: Metadata = { title: 'Margins' };

// A representative job per category, purely so the preview shows a number that feels real.
const SAMPLE: Record<string, { baseKobo: number; qty: number }> = {
  banner: { baseKobo: 1_620_000, qty: 1 },
  jotter: { baseKobo: 5_400_000, qty: 50 },
  flyer: { baseKobo: 2_250_000, qty: 500 },
  business_card: { baseKobo: 1_400_000, qty: 100 },
  sticker: { baseKobo: 900_000, qty: 100 },
  nylon: { baseKobo: 1_300_000, qty: 50 },
  thank_you_card: { baseKobo: 550_000, qty: 100 },
  id_card: { baseKobo: 700_000, qty: 10 },
};

export default async function AdminMarginsPage() {
  const margins = await getCategoryMargins();

  const rows: MarginRow[] = LIVE_CATEGORIES.map((c) => {
    const m = margins[c.slug];
    const sample = SAMPLE[c.slug] ?? { baseKobo: 1_000_000, qty: 100 };
    return {
      categorySlug: c.slug,
      name: c.name,
      code: c.code,
      marginType: m?.marginType ?? 'fixed',
      value: m
        ? String(m.marginType === 'percent' ? m.marginPercentBps / 100 : m.marginFixedKobo / 100)
        : '',
      configured: Boolean(m),
      sampleBaseKobo: sample.baseKobo,
      sampleQty: sample.qty,
    };
  });

  return (
    <div>
      <h1 className="font-display text-3xl font-extrabold tracking-tight text-black">Margins</h1>
      <p className="mt-2 max-w-2xl text-black/60">
        What PrintRuns adds on top of the printer&apos;s own price. Printers never see this and never
        set it. Changing a margin moves what customers are quoted from the next page load, so each
        one shows the resulting price before you save.
      </p>
      <p className="mt-2 max-w-2xl text-[13px] text-black/50">
        Anything left blank keeps using the margin stored on each product. Existing orders are
        unaffected — their prices were frozen at checkout.
      </p>
      <MarginEditor rows={rows} />
    </div>
  );
}
