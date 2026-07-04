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
