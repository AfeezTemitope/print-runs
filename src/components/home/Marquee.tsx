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
