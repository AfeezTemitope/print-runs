/** Illustration fallback until real photography lands at public/hero.jpg (spec §7.5). */
export function HeroArt() {
  return (
    <svg viewBox="0 0 520 420" className="w-full" aria-hidden="true">
      <rect x="24" y="20" width="472" height="380" rx="24" fill="#FFFBB5" opacity="0.55" />
      <g transform="rotate(-4 210 210)">
        <rect x="70" y="80" width="220" height="290" rx="8" fill="#fff" stroke="#00000A" strokeWidth="2.5" />
        <rect x="90" y="100" width="180" height="110" rx="4" fill="#0000FF" />
        <rect x="90" y="226" width="120" height="9" rx="4" fill="#00000A" />
        <rect x="90" y="244" width="160" height="6" rx="3" fill="#00000A" opacity="0.45" />
        <rect x="90" y="258" width="140" height="6" rx="3" fill="#00000A" opacity="0.45" />
        <rect x="90" y="320" width="92" height="26" rx="13" fill="#00000A" />
        <rect x="98" y="329" width="60" height="8" rx="4" fill="#FFFBB5" />
      </g>
      <g transform="rotate(6 360 250)">
        <rect x="250" y="170" width="230" height="150" rx="10" fill="#fff" stroke="#00000A" strokeWidth="2.5" />
        <rect x="270" y="190" width="110" height="9" rx="4" fill="#0000FF" />
        <rect x="270" y="208" width="150" height="6" rx="3" fill="#00000A" opacity="0.4" />
        <rect x="270" y="222" width="130" height="6" rx="3" fill="#00000A" opacity="0.4" />
        <line x1="270" y1="278" x2="460" y2="278" stroke="#00000A" strokeWidth="2" strokeDasharray="6 6" opacity="0.5" />
        <rect x="270" y="290" width="86" height="18" rx="9" fill="#0000FF" />
        <circle cx="440" cy="240" r="20" fill="#FFFBB5" stroke="#00000A" strokeWidth="2.5" />
        <path d="M432 240l6 6 11-13" stroke="#00000A" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <g transform="rotate(-10 120 330)">
        <circle cx="120" cy="330" r="46" fill="#0000FF" stroke="#00000A" strokeWidth="2.5" />
        <circle cx="120" cy="330" r="30" fill="#fff" stroke="#00000A" strokeWidth="2" />
        <text x="120" y="327" textAnchor="middle" fontFamily="system-ui" fontWeight="800" fontStyle="italic" fontSize="11" fill="#00000A">PRINT</text>
        <text x="120" y="341" textAnchor="middle" fontFamily="system-ui" fontWeight="800" fontStyle="italic" fontSize="11" fill="#0000FF">RUNS</text>
      </g>
    </svg>
  );
}
