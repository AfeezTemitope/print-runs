import Link from 'next/link';
import { LEGAL_DOCS, LEGAL_VERSION, LEGAL_EFFECTIVE } from '@/lib/legal';

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <nav className="mb-8 flex flex-wrap gap-1.5 border-b border-dashed border-black/20 pb-4">
        {LEGAL_DOCS.map((d) => (
          <Link
            key={d.slug}
            href={`/legal/${d.slug}`}
            className="rounded-pill px-3.5 py-1.5 font-display text-[13px] font-bold text-navy hover:bg-black/5"
          >
            {d.short}
          </Link>
        ))}
        <span className="ml-auto self-center font-mono text-[10px] font-bold uppercase tracking-widest text-black/40">
          v{LEGAL_VERSION} · {LEGAL_EFFECTIVE}
        </span>
      </nav>
      {children}
    </div>
  );
}
