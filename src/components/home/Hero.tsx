import Image from 'next/image';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ButtonLink } from '@/components/ui/Button';
import { HeroArt } from './HeroArt';

/**
 * White → pale-yellow vertical gradient (spec §7.2). Headline follows the
 * one-line-in-blue pattern. Real photography preferred (§7.5): drop a photo of
 * the team/prints at public/hero.jpg and it replaces the illustration.
 */
export function Hero() {
  const hasPhoto = existsSync(join(process.cwd(), 'public', 'hero.jpg'));

  return (
    <section className="bg-fade-pale">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.05fr_0.95fr] md:py-20">
        <div>
          <p className="inline-flex items-center gap-2 rounded-pill border border-black/10 bg-white px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-widest text-navy">
            <span className="size-2 rounded-full bg-blue" aria-hidden />
            Lagos · Print on demand · Same-day production
          </p>
          <h1 className="mt-6 font-display text-5xl font-extrabold leading-[0.98] tracking-tight text-black text-balance-pretty sm:text-6xl lg:text-7xl">
            Print Without<br />
            <span className="text-blue">Leaving Home.</span>
          </h1>
          <p className="mt-5 max-w-md text-[17px] leading-relaxed text-black/65">
            Configure your job, compare nearby printers with live prices, pay securely
            and track it to your door — Island and Mainland.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            {/*
              Module 2 §1: two entry points, side by side. Start Printing is for a customer who
              knows what they want to print; Marketplace is for one who wants to browse printers.
              Both converge on the same listing detail and the same order flow.

              Request Designer used to sit here. It moves to the design-file step of the order
              flow, which is where a customer discovers they don't have artwork.
            */}
            <ButtonLink href="/products">Start Printing <span aria-hidden>→</span></ButtonLink>
            <ButtonLink href="/marketplace" variant="secondary">Marketplace</ButtonLink>
          </div>
        </div>

        <div className="relative">
          {hasPhoto ? (
            <Image
              src="/hero.jpg"
              alt="Freshly printed work from Lagos printers on the Print Runs marketplace"
              width={880}
              height={660}
              priority
              className="w-full rounded-3xl border border-black/10 object-cover"
            />
          ) : (
            <HeroArt />
          )}
        </div>
      </div>
    </section>
  );
}
