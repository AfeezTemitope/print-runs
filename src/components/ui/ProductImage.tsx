import Image from 'next/image';
import { Glyph } from '@/components/ui/Glyph';
import type { GlyphKind } from '@/components/ui/Glyph';

/**
 * A real photo when the catalog has one, the brand glyph when it doesn't. Every product
 * surface renders through this, so photography can land product by product without any
 * page needing to change (QA 1.8).
 */
export function ProductImage({
  url, glyph, hue, className = '', glyphClassName = 'size-12', alt,
}: {
  url?: string;
  glyph: GlyphKind;
  hue: string;
  className?: string;
  glyphClassName?: string;
  alt: string;
}) {
  if (!url) {
    return (
      <div className={`grid place-items-center ${className}`}>
        <Glyph kind={glyph} color={hue} className={glyphClassName} />
      </div>
    );
  }
  return (
    <div className={`relative overflow-hidden ${className}`}>
      <Image src={url} alt={alt} fill sizes="(max-width: 640px) 50vw, 320px" className="object-cover" />
    </div>
  );
}
