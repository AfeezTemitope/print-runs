export type GlyphKind =
  | 'sticker' | 'banner' | 'flyer' | 'nylon'
  | 'jotter' | 'card' | 'bag' | 'frame';

/**
 * Flat two-tone category icons (spec §7.4). Used for fast browsing and as the
 * clean fallback wherever a shop hasn't uploaded real photography yet (§7.5).
 */
export function Glyph({ kind, color = '#0000FF', className }: { kind: GlyphKind; color?: string; className?: string }) {
  const ink = '#00000A';
  const common = { className, viewBox: '0 0 64 64', fill: 'none', 'aria-hidden': true } as const;

  switch (kind) {
    case 'sticker':
      return (
        <svg {...common}>
          <path d="M14 10h30l10 10v34H14z" fill={color} opacity="0.14" />
          <path d="M14 10h30l10 10v34H14z" stroke={ink} strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M44 10v10h10" stroke={ink} strokeWidth="2.5" strokeLinejoin="round" fill="#fff" />
          <circle cx="30" cy="36" r="9" stroke={color} strokeWidth="2.5" />
        </svg>
      );
    case 'banner':
      return (
        <svg {...common}>
          <rect x="8" y="16" width="48" height="26" rx="2" fill={color} opacity="0.14" />
          <rect x="8" y="16" width="48" height="26" rx="2" stroke={ink} strokeWidth="2.5" />
          <path d="M14 12v8M50 12v8M14 42v10M50 42v10" stroke={ink} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M16 30h20" stroke={color} strokeWidth="3" strokeLinecap="round" />
          <path d="M16 36h12" stroke={ink} strokeWidth="2.5" strokeLinecap="round" opacity="0.5" />
        </svg>
      );
    case 'flyer':
      return (
        <svg {...common}>
          <rect x="16" y="8" width="32" height="46" rx="2" fill={color} opacity="0.14" />
          <rect x="16" y="8" width="32" height="46" rx="2" stroke={ink} strokeWidth="2.5" />
          <rect x="22" y="15" width="20" height="12" rx="1" fill={color} />
          <path d="M22 33h20M22 39h14M22 45h17" stroke={ink} strokeWidth="2.5" strokeLinecap="round" opacity="0.55" />
        </svg>
      );
    case 'nylon':
      return (
        <svg {...common}>
          <path d="M14 22h36l-3 32H17z" fill={color} opacity="0.14" />
          <path d="M14 22h36l-3 32H17z" stroke={ink} strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M24 22v-4a8 8 0 0 1 16 0v4" stroke={ink} strokeWidth="2.5" />
          <circle cx="32" cy="38" r="7" stroke={color} strokeWidth="2.5" />
        </svg>
      );
    case 'jotter':
      return (
        <svg {...common}>
          <rect x="16" y="10" width="34" height="44" rx="3" fill={color} opacity="0.14" />
          <rect x="16" y="10" width="34" height="44" rx="3" stroke={ink} strokeWidth="2.5" />
          <path d="M22 10v44" stroke={ink} strokeWidth="2.5" />
          <path d="M29 22h14M29 29h14M29 36h9" stroke={ink} strokeWidth="2.5" strokeLinecap="round" opacity="0.55" />
          <path d="M29 46h8" stroke={color} strokeWidth="3" strokeLinecap="round" />
        </svg>
      );
    case 'card':
      return (
        <svg {...common}>
          <rect x="8" y="18" width="48" height="28" rx="3" fill={color} opacity="0.14" />
          <rect x="8" y="18" width="48" height="28" rx="3" stroke={ink} strokeWidth="2.5" />
          <circle cx="20" cy="32" r="5" fill={color} />
          <path d="M31 28h17M31 34h12" stroke={ink} strokeWidth="2.5" strokeLinecap="round" opacity="0.55" />
        </svg>
      );
    case 'bag':
      return (
        <svg {...common}>
          <path d="M16 20h32v34H16z" fill={color} opacity="0.14" />
          <path d="M16 20h32v34H16z" stroke={ink} strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M24 26v-6a8 8 0 0 1 16 0v6" stroke={ink} strokeWidth="2.5" />
          <path d="M24 40h16" stroke={color} strokeWidth="3" strokeLinecap="round" />
        </svg>
      );
    case 'frame':
      return (
        <svg {...common}>
          <rect x="12" y="10" width="40" height="44" rx="2" stroke={ink} strokeWidth="2.5" />
          <rect x="19" y="17" width="26" height="30" fill={color} opacity="0.14" stroke={ink} strokeWidth="2" />
          <path d="M22 40l7-9 5 5 6-8 5 12z" fill={color} />
        </svg>
      );
  }
}
