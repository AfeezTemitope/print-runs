import { ButtonLink } from '@/components/ui/Button';

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-6 py-28 text-center">
      <p className="font-mono text-xs font-bold uppercase tracking-widest text-blue">404</p>
      <h1 className="mt-2 font-display text-4xl font-extrabold text-navy">Page not found</h1>
      <p className="mt-3 text-black/60">That page hasn&apos;t been printed yet.</p>
      <ButtonLink href="/" className="mt-8">Back home</ButtonLink>
    </div>
  );
}
