import { Hero } from '@/components/home/Hero';
import { Marquee } from '@/components/home/Marquee';
import { HotProducts } from '@/components/home/HotProducts';
import { ValueStrip } from '@/components/home/ValueStrip';
import { Steps } from '@/components/home/Steps';
import { Footer } from '@/components/home/Footer';

// Fully server-rendered marketing page — zero client JS beyond the nav.
export default function HomePage() {
  return (
    <>
      <Hero />
      <Marquee />
      <HotProducts />
      <ValueStrip />
      <Steps />
      <Footer />
    </>
  );
}
