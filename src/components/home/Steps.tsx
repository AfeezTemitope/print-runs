const STEPS = [
  { n: '01', t: 'Pick & configure', d: 'Choose what to print, set your exact size, quantity and finish, drop your file.' },
  { n: '02', t: 'Compare printers', d: 'See nearby printers who can do that exact spec, sorted by distance, with live prices.' },
  { n: '03', t: 'Pay & track', d: 'Pay with Paystack. Delivery riders or self-pickup — track every status change live.' },
];

export function Steps() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
      <div className="mb-8">
        <h2 className="font-display text-4xl font-extrabold tracking-tight text-black sm:text-5xl">
          From file to <span className="text-blue">doorstep</span>
        </h2>
        <p className="mt-2 text-black/60">Three steps. No back-and-forth.</p>
      </div>
      <ol className="grid gap-4 md:grid-cols-3">
        {STEPS.map((s) => (
          <li key={s.n} className="rounded-2xl border border-black/12 bg-white p-7">
            <span className="font-mono text-xs font-bold tracking-widest text-blue">{s.n}</span>
            <h3 className="mt-2 font-display text-2xl font-extrabold tracking-tight text-navy">{s.t}</h3>
            <p className="mt-2 leading-relaxed text-black/60">{s.d}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
