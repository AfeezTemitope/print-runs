export type Product = {
  name: string;
  turn: string;
  moq: string | null;
  hue: string;
  glyph: GlyphKind;
};

export type GlyphKind =
  | 'sticker' | 'banner' | 'flyer' | 'nylon'
  | 'jotter' | 'card' | 'bag' | 'frame';

export const PRODUCTS: Product[] = [
  { name: 'Sticker',       turn: '24hrs',  moq: null,  hue: '#FF4D2E', glyph: 'sticker' },
  { name: 'Flex / Banner', turn: '24hrs',  moq: null,  hue: '#1B1BFF', glyph: 'banner'  },
  { name: 'Flyer',         turn: '24hrs',  moq: '50',  hue: '#0A0A23', glyph: 'flyer'   },
  { name: 'Brand Nylon',   turn: '2 Days', moq: '50',  hue: '#FFC93C', glyph: 'nylon'   },
  { name: 'Jotter',        turn: '4 Days', moq: '100', hue: '#1B1BFF', glyph: 'jotter'  },
  { name: 'Business Card', turn: '24hrs',  moq: '50',  hue: '#0A0A23', glyph: 'card'    },
  { name: 'Paper Bag',     turn: '3 Days', moq: '20',  hue: '#FFC93C', glyph: 'bag'     },
  { name: 'Frame',         turn: '2 Days', moq: null,  hue: '#FF4D2E', glyph: 'frame'   },
];

export type Stat = { num: string; label: string };
export const STATS: Stat[] = [
  { num: '1,240+', label: 'Orders delivered' },
  { num: '24h',    label: 'Avg. turnaround' },
  { num: '98%',    label: 'On-time rate' },
  { num: 'Lagos',  label: 'Island & Mainland' },
];

export type Step = { n: string; t: string; d: string };
export const STEPS: Step[] = [
  { n: '01', t: 'Pick & Upload',  d: 'Choose what to print, drop your file or request our designer.' },
  { n: '02', t: 'We Print',       d: 'Production starts the same day. Quality-checked before dispatch.' },
  { n: '03', t: 'Delivered',      d: 'Riders cover Island & Mainland. Track your order live.' },
];

export type AuthKind = 'login' | 'register' | null;
