#!/usr/bin/env bash
# PRINT RUNS — single-command rebuild. Run this from your project root.
# It overwrites: index.html, src/main.jsx, src/index.css, src/App.jsx, src/App.css
# Keeps: package.json, vite.config.js, eslint config — so `vercel` redeploys cleanly.

set -e

# ---------- index.html ----------
cat > index.html << 'EOF'
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#0A0A23" />
    <meta name="description" content="Print Runs — upload your design or request a designer. We handle printing and delivery across Lagos." />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,800&family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;1,9..144,400&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet" />
    <title>Print Runs — Print Without Leaving Home</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
EOF

# ---------- src/main.jsx ----------
cat > src/main.jsx << 'EOF'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
EOF

# ---------- src/index.css ----------
cat > src/index.css << 'EOF'
*, *::before, *::after { box-sizing: border-box; }
html, body, #root { margin: 0; padding: 0; min-height: 100%; }
body {
  font-family: 'Bricolage Grotesque', system-ui, sans-serif;
  background: #FFFBEA;
  color: #0A0A23;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
  overflow-x: hidden;
}
button { font-family: inherit; }
a { color: inherit; text-decoration: none; }
img, svg { display: block; max-width: 100%; }
EOF

# ---------- src/App.jsx ----------
cat > src/App.jsx << 'EOF'
import { useState, useEffect } from 'react'
import './App.css'

const PRODUCTS = [
  { name: 'Sticker',       turn: '24hrs',  moq: null,  hue: '#FF4D2E', glyph: 'sticker' },
  { name: 'Flex / Banner', turn: '24hrs',  moq: null,  hue: '#1B1BFF', glyph: 'banner'  },
  { name: 'Flyer',         turn: '24hrs',  moq: '50',  hue: '#0A0A23', glyph: 'flyer'   },
  { name: 'Brand Nylon',   turn: '2 Days', moq: '50',  hue: '#FFC93C', glyph: 'nylon'   },
  { name: 'Jotter',        turn: '4 Days', moq: '100', hue: '#1B1BFF', glyph: 'jotter'  },
  { name: 'Business Card', turn: '24hrs',  moq: '50',  hue: '#0A0A23', glyph: 'card'    },
  { name: 'Paper Bag',     turn: '3 Days', moq: '20',  hue: '#FFC93C', glyph: 'bag'     },
  { name: 'Frame',         turn: '2 Days', moq: null,  hue: '#FF4D2E', glyph: 'frame'   },
]

const STATS = [
  { num: '1,240+', label: 'Orders delivered' },
  { num: '24h',    label: 'Avg. turnaround' },
  { num: '98%',    label: 'On-time rate' },
  { num: 'Lagos',  label: 'Island & Mainland' },
]

const STEPS = [
  { n: '01', t: 'Pick & Upload',  d: 'Choose what to print, drop your file or request our designer.' },
  { n: '02', t: 'We Print',       d: 'Production starts the same day. Quality-checked before dispatch.' },
  { n: '03', t: 'Delivered',      d: 'Riders cover Island & Mainland. Track your order live.' },
]

/* --- Tiny SVG glyphs for product cards (no external images needed) --- */
function ProductGlyph({ kind, color }) {
  const c = color
  const stroke = '#0A0A23'
  switch (kind) {
    case 'sticker':
      return (
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <circle cx="60" cy="60" r="44" fill={c} stroke={stroke} strokeWidth="3" />
          <circle cx="60" cy="60" r="28" fill="#FFFBEA" stroke={stroke} strokeWidth="3" />
          <text x="60" y="66" textAnchor="middle" fontFamily="Bricolage Grotesque" fontWeight="800" fontSize="14" fill={stroke}>FRESH</text>
          <path d="M88 88 L106 106" stroke={stroke} strokeWidth="3" strokeLinecap="round" />
        </svg>
      )
    case 'banner':
      return (
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <rect x="14" y="34" width="92" height="52" rx="4" fill={c} stroke={stroke} strokeWidth="3" />
          <line x1="22" y1="48" x2="98" y2="48" stroke="#FFFBEA" strokeWidth="3" />
          <line x1="22" y1="60" x2="80" y2="60" stroke="#FFFBEA" strokeWidth="3" />
          <line x1="22" y1="72" x2="92" y2="72" stroke="#FFFBEA" strokeWidth="3" />
          <line x1="20" y1="34" x2="20" y2="100" stroke={stroke} strokeWidth="3" />
          <line x1="100" y1="34" x2="100" y2="100" stroke={stroke} strokeWidth="3" />
        </svg>
      )
    case 'flyer':
      return (
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <rect x="30" y="18" width="60" height="84" rx="3" fill="#FFFBEA" stroke={stroke} strokeWidth="3" />
          <rect x="36" y="24" width="48" height="28" fill={c} />
          <rect x="36" y="58" width="48" height="4" fill={stroke} />
          <rect x="36" y="66" width="36" height="4" fill={stroke} />
          <rect x="36" y="74" width="42" height="4" fill={stroke} />
          <rect x="36" y="86" width="20" height="8" fill={c} />
        </svg>
      )
    case 'nylon':
      return (
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <path d="M30 30 L90 30 L94 100 L26 100 Z" fill={c} stroke={stroke} strokeWidth="3" />
          <path d="M44 30 Q44 18 60 18 Q76 18 76 30" fill="none" stroke={stroke} strokeWidth="3" />
          <circle cx="60" cy="60" r="14" fill="#FFFBEA" stroke={stroke} strokeWidth="3" />
          <text x="60" y="65" textAnchor="middle" fontFamily="Bricolage Grotesque" fontWeight="800" fontSize="10" fill={stroke}>BRAND</text>
        </svg>
      )
    case 'jotter':
      return (
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <rect x="26" y="18" width="68" height="86" rx="3" fill={c} stroke={stroke} strokeWidth="3" />
          <line x1="40" y1="14" x2="40" y2="108" stroke={stroke} strokeWidth="3" />
          <circle cx="34" cy="30" r="2" fill="#FFFBEA" />
          <circle cx="34" cy="50" r="2" fill="#FFFBEA" />
          <circle cx="34" cy="70" r="2" fill="#FFFBEA" />
          <circle cx="34" cy="90" r="2" fill="#FFFBEA" />
          <line x1="52" y1="36" x2="86" y2="36" stroke="#FFFBEA" strokeWidth="2" />
          <line x1="52" y1="48" x2="80" y2="48" stroke="#FFFBEA" strokeWidth="2" />
          <line x1="52" y1="60" x2="84" y2="60" stroke="#FFFBEA" strokeWidth="2" />
        </svg>
      )
    case 'card':
      return (
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <rect x="14" y="44" width="92" height="56" rx="4" fill={c} stroke={stroke} strokeWidth="3" />
          <rect x="22" y="54" width="36" height="4" fill="#FFFBEA" />
          <rect x="22" y="64" width="28" height="3" fill="#FFFBEA" />
          <rect x="22" y="72" width="24" height="3" fill="#FFFBEA" />
          <circle cx="86" cy="72" r="14" fill="#FFFBEA" stroke="#FFFBEA" strokeWidth="2" />
          <path d="M80 72 L84 76 L92 68" stroke={c} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'bag':
      return (
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <path d="M28 38 L92 38 L92 102 L28 102 Z" fill={c} stroke={stroke} strokeWidth="3" />
          <path d="M44 38 Q44 22 60 22 Q76 22 76 38" fill="none" stroke={stroke} strokeWidth="3" />
          <rect x="42" y="58" width="36" height="28" fill="#FFFBEA" stroke={stroke} strokeWidth="2" />
          <text x="60" y="76" textAnchor="middle" fontFamily="Bricolage Grotesque" fontWeight="800" fontSize="9" fill={stroke}>PRINT RUNS</text>
        </svg>
      )
    case 'frame':
      return (
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <rect x="18" y="22" width="84" height="76" fill={stroke} />
          <rect x="26" y="30" width="68" height="60" fill={c} />
          <path d="M34 76 L52 56 L66 70 L80 50 L86 60 L86 84 L34 84 Z" fill="#0A0A23" opacity="0.85" />
          <circle cx="74" cy="44" r="5" fill="#FFFBEA" />
        </svg>
      )
    default: return null
  }
}

/* --- Hero illustration — layered SVG print scene --- */
function HeroArt() {
  return (
    <svg viewBox="0 0 520 520" className="hero-art" aria-hidden="true">
      <defs>
        <pattern id="dots" width="10" height="10" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.4" fill="#0A0A23" />
        </pattern>
        <pattern id="dotsY" width="10" height="10" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.4" fill="#FFC93C" />
        </pattern>
      </defs>
      {/* halftone backdrop */}
      <rect x="40" y="40" width="440" height="440" rx="16" fill="url(#dots)" opacity="0.18" />
      {/* yellow paper */}
      <g transform="rotate(-6 260 260)">
        <rect x="80" y="120" width="240" height="320" rx="6" fill="#FFC93C" stroke="#0A0A23" strokeWidth="4" />
        <rect x="100" y="140" width="200" height="120" fill="#1B1BFF" />
        <rect x="100" y="270" width="120" height="10" fill="#0A0A23" />
        <rect x="100" y="288" width="180" height="6" fill="#0A0A23" />
        <rect x="100" y="302" width="160" height="6" fill="#0A0A23" />
        <rect x="100" y="316" width="140" height="6" fill="#0A0A23" />
        <rect x="100" y="400" width="80" height="22" fill="#FF4D2E" />
      </g>
      {/* blue card on top */}
      <g transform="rotate(8 320 300)">
        <rect x="220" y="200" width="240" height="160" rx="8" fill="#1B1BFF" stroke="#0A0A23" strokeWidth="4" />
        <rect x="240" y="220" width="120" height="8" fill="#FFFBEA" />
        <rect x="240" y="236" width="84" height="6" fill="#FFFBEA" opacity="0.8" />
        <rect x="240" y="248" width="100" height="6" fill="#FFFBEA" opacity="0.8" />
        <circle cx="420" cy="320" r="22" fill="#FFC93C" stroke="#0A0A23" strokeWidth="4" />
        <path d="M412 320 L418 326 L430 312" stroke="#0A0A23" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      {/* sticker */}
      <g transform="rotate(-14 130 410)">
        <circle cx="120" cy="410" r="56" fill="#FF4D2E" stroke="#0A0A23" strokeWidth="4" />
        <circle cx="120" cy="410" r="36" fill="#FFFBEA" stroke="#0A0A23" strokeWidth="3" />
        <text x="120" y="406" textAnchor="middle" fontFamily="Bricolage Grotesque" fontWeight="800" fontSize="11" fill="#0A0A23">PRINT</text>
        <text x="120" y="422" textAnchor="middle" fontFamily="Bricolage Grotesque" fontWeight="800" fontSize="11" fill="#0A0A23">RUNS</text>
      </g>
      {/* CMYK marks */}
      <g>
        <circle cx="470" cy="80" r="10" fill="#1B1BFF" opacity="0.85" />
        <circle cx="486" cy="80" r="10" fill="#FF4D2E" opacity="0.85" />
        <circle cx="478" cy="92" r="10" fill="#FFC93C" opacity="0.85" />
        <circle cx="478" cy="74" r="10" fill="#0A0A23" opacity="0.85" />
      </g>
    </svg>
  )
}

function Marquee() {
  const items = ['PRINT • RUNS', '24HR TURNAROUND', 'DELIVERED IN LAGOS', 'CMYK READY', 'ISLAND + MAINLAND', 'TRACK LIVE']
  const row = [...items, ...items, ...items]
  return (
    <div className="marquee" aria-hidden="true">
      <div className="marquee-track">
        {row.map((t, i) => (<span key={i} className="marquee-item">{t} <span className="marquee-dot">✦</span></span>))}
      </div>
    </div>
  )
}

function Navbar({ onNav }) {
  const [open, setOpen] = useState(false)
  return (
    <header className="nav">
      <a href="#home" className="brand-mark" onClick={() => setOpen(false)}>
        <span className="brand-print">PRINT</span>
        <span className="brand-runs">RUNS</span>
      </a>
      <nav className={`nav-links ${open ? 'open' : ''}`}>
        <a href="#home"        onClick={() => setOpen(false)}>Home</a>
        <a href="#products"    onClick={() => setOpen(false)}>Products</a>
        <a href="#marketplace" onClick={() => setOpen(false)}>Marketplace</a>
        <a href="#track"       onClick={() => setOpen(false)}>Track Order</a>
        <div className="nav-cta-mobile">
          <button className="btn btn-yellow" onClick={() => onNav('login')}>Login</button>
          <button className="btn btn-ghost"  onClick={() => onNav('register')}>Register</button>
        </div>
      </nav>
      <div className="nav-cta">
        <button className="btn btn-yellow" onClick={() => onNav('login')}>Login</button>
        <button className="btn btn-ghost"  onClick={() => onNav('register')}>Register</button>
      </div>
      <button className={`hamburger ${open ? 'open' : ''}`} onClick={() => setOpen(o => !o)} aria-label="Menu">
        <span /><span /><span />
      </button>
    </header>
  )
}

function Hero({ onStart }) {
  return (
    <section id="home" className="hero">
      <div className="hero-copy">
        <div className="hero-eyebrow">
          <span className="dot dot-blue" /> Lagos &middot; Print on Demand &middot; Same-Day Production
        </div>
        <h1 className="hero-title">
          Print Without<br />
          <span className="hero-title-blue">Leaving Home<span className="hero-period">.</span></span>
        </h1>
        <p className="hero-sub">
          Upload your design or request one. We handle printing, quality-checking
          and delivery across Lagos &mdash; Island and Mainland.
        </p>
        <div className="hero-ctas">
          <button className="btn btn-dark" onClick={onStart}>
            Start Printing <span className="arr">▾</span>
          </button>
          <button className="btn btn-outline">
            Request Designer <span className="arr">→</span>
          </button>
        </div>
        <div className="hero-trust">
          <div className="avatars">
            <span style={{ background: '#1B1BFF' }}>A</span>
            <span style={{ background: '#FF4D2E' }}>B</span>
            <span style={{ background: '#FFC93C', color: '#0A0A23' }}>C</span>
          </div>
          <div>
            <strong>1,240+</strong> Lagos brands<br />
            <small>printed with us this quarter</small>
          </div>
        </div>
      </div>
      <div className="hero-visual">
        <HeroArt />
      </div>
    </section>
  )
}

function HotProducts({ onPick }) {
  return (
    <section id="products" className="products">
      <div className="section-head">
        <h2>
          <span className="hot">Hot</span> Products
        </h2>
        <p>Most-printed this week. Tap one to start a job.</p>
      </div>
      <div className="product-grid">
        {PRODUCTS.map((p, i) => (
          <button key={p.name} className="product-card" onClick={() => onPick(p)} style={{ '--accent': p.hue, '--delay': `${i * 60}ms` }}>
            <div className="product-art">
              <ProductGlyph kind={p.glyph} color={p.hue} />
              <span className="product-spec">PR-{(i + 1).toString().padStart(3, '0')}</span>
            </div>
            <div className="product-meta">
              <h3>{p.name}</h3>
              <div className="product-row">
                <span className="pill pill-blue">Ready in {p.turn}</span>
                {p.moq && <span className="pill pill-ghost">MOQ {p.moq}</span>}
              </div>
              <span className="product-cta">Print now <span className="arr">→</span></span>
            </div>
          </button>
        ))}
      </div>
    </section>
  )
}

function PrintingPicker({ onPick }) {
  return (
    <section className="picker">
      <h2>What are you <em>Printing</em> Today?</h2>
      <div className="picker-grid">
        {PRODUCTS.map(p => (
          <button key={p.name} className="picker-pill" onClick={() => onPick(p)}>
            <span className="picker-glyph"><ProductGlyph kind={p.glyph} color={p.hue} /></span>
            <span>{p.name}</span>
          </button>
        ))}
      </div>
    </section>
  )
}

function ConfigForm({ product, onClose }) {
  const [mode, setMode] = useState('upload')
  const [w, setW] = useState('')
  const [h, setH] = useState('')
  const [unit, setUnit] = useState('FEET')
  const [printCut, setPrintCut] = useState(true)
  const [address, setAddress] = useState('')
  const [c1, setC1] = useState(false)
  const [c2, setC2] = useState(false)
  const [c3, setC3] = useState(false)
  const ready = c1 && c2 && c3 && (mode === 'request' || (w && h))

  return (
    <section id="configure" className="config">
      <div className="config-inner">
        <div className="config-form">
          <div className="config-tag">Configuring</div>
          <h2>{product.name}</h2>

          <div className="mode-toggle">
            <button className={`mode-btn ${mode === 'upload' ? 'active' : ''}`} onClick={() => setMode('upload')}>
              <strong>Upload Design</strong>
              <span>I have my design</span>
            </button>
            <button className={`mode-btn ${mode === 'request' ? 'active' : ''}`} onClick={() => setMode('request')}>
              <strong>Request Designer</strong>
              <span>I need a designer</span>
            </button>
          </div>

          {mode === 'upload' && (
            <label className="dropzone">
              <input type="file" hidden />
              <div className="dz-icon">↑</div>
              <div><strong>Drop your file</strong> or click to browse</div>
              <small>PDF, AI, PNG, JPG &middot; CMYK preferred</small>
            </label>
          )}
          {mode === 'request' && (
            <div className="brief">
              <label>Brief for the designer
                <textarea rows="3" placeholder="Tell us colors, vibe, content to include…" />
              </label>
            </div>
          )}

          <div className="field-row">
            <label className="field">Width
              <input type="number" value={w} onChange={e => setW(e.target.value)} placeholder="0" />
            </label>
            <span className="by">×</span>
            <label className="field">Height
              <input type="number" value={h} onChange={e => setH(e.target.value)} placeholder="0" />
            </label>
            <label className="field">Unit
              <select value={unit} onChange={e => setUnit(e.target.value)}>
                <option>FEET</option><option>INCH</option><option>CM</option>
              </select>
            </label>
          </div>

          <label className="check inline">
            <input type="checkbox" checked={printCut} onChange={e => setPrintCut(e.target.checked)} />
            <span>Print &amp; Cut</span>
          </label>

          <label className="field block">Delivery Address
            <input type="text" value={address} onChange={e => setAddress(e.target.value)} placeholder="e.g. 24 Admiralty Way, Lekki Phase 1" />
          </label>

          <ul className="confirm-list">
            <li><label className="check"><input type="checkbox" checked={c1} onChange={e => setC1(e.target.checked)} /><span>I confirm my design is accurate.</span></label></li>
            <li><label className="check"><input type="checkbox" checked={c2} onChange={e => setC2(e.target.checked)} /><span>I confirm my design color is CMYK.</span></label></li>
            <li><label className="check"><input type="checkbox" checked={c3} onChange={e => setC3(e.target.checked)} /><span>I confirm my location is correct.</span></label></li>
          </ul>

          <div className="config-actions">
            <button className="btn btn-ghost" onClick={onClose}>Back</button>
            <button className={`btn btn-dark ${ready ? '' : 'disabled'}`} disabled={!ready}>
              Next <span className="arr">→</span>
            </button>
          </div>
        </div>

        <aside className="config-preview">
          <div className="preview-tag">Preview</div>
          <div className="preview-frame" style={{ background: product.hue }}>
            <ProductGlyph kind={product.glyph} color="#FFFBEA" />
          </div>
          <dl className="preview-spec">
            <div><dt>Item</dt><dd>{product.name}</dd></div>
            <div><dt>Turnaround</dt><dd>{product.turn}</dd></div>
            <div><dt>Size</dt><dd>{w && h ? `${w} × ${h} ${unit.toLowerCase()}` : '—'}</dd></div>
            <div><dt>Mode</dt><dd>{mode === 'upload' ? 'Self-upload' : 'Designer'}</dd></div>
            <div><dt>Address</dt><dd>{address || '—'}</dd></div>
          </dl>
        </aside>
      </div>
    </section>
  )
}

function Steps() {
  return (
    <section className="steps">
      <div className="section-head">
        <h2>From file to <span className="hot">doorstep</span></h2>
        <p>Three steps. No back-and-forth.</p>
      </div>
      <div className="steps-grid">
        {STEPS.map(s => (
          <div className="step-card" key={s.n}>
            <span className="step-num">{s.n}</span>
            <h3>{s.t}</h3>
            <p>{s.d}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function Stats() {
  return (
    <section className="stats">
      {STATS.map(s => (
        <div className="stat" key={s.label}>
          <div className="stat-num">{s.num}</div>
          <div className="stat-label">{s.label}</div>
        </div>
      ))}
    </section>
  )
}

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-top">
        <div className="brand-mark big">
          <span className="brand-print">PRINT</span>
          <span className="brand-runs">RUNS</span>
        </div>
        <p>Print without leaving home. Lagos-wide delivery.</p>
      </div>
      <div className="footer-cols">
        <div><h4>Shop</h4><a>Stickers</a><a>Banners</a><a>Business Cards</a><a>Frames</a></div>
        <div><h4>Service</h4><a>Track Order</a><a>Marketplace</a><a>Request Designer</a><a>Bulk Pricing</a></div>
        <div><h4>Studio</h4><a>About</a><a>Careers</a><a>Press</a><a>Contact</a></div>
      </div>
      <div className="footer-bot">
        <small>© {new Date().getFullYear()} Print Runs · Lagos, NG</small>
        <small>Made for makers</small>
      </div>
    </footer>
  )
}

function Modal({ open, onClose, children }) {
  useEffect(() => {
    if (!open) return
    const k = e => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', k)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', k); document.body.style.overflow = '' }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <button className="modal-x" onClick={onClose} aria-label="Close">×</button>
        {children}
      </div>
    </div>
  )
}

function AuthForm({ kind }) {
  const [tab, setTab] = useState('Individual')
  return (
    <div className="auth">
      <h3>{kind === 'login' ? 'Welcome back' : 'Create account'}</h3>
      <div className="auth-tabs">
        {['Individual', 'Designer', 'Printer'].map(t => (
          <button key={t} className={`auth-tab ${tab === t ? 'on' : ''}`} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>
      {kind === 'register' ? (
        <div className="auth-grid">
          <input placeholder="First name" />
          <input placeholder="Surname" />
          <input placeholder="Email" type="email" />
          <input placeholder="Phone" type="tel" />
          <input placeholder="Password" type="password" />
          <input placeholder="Confirm password" type="password" />
        </div>
      ) : (
        <div className="auth-grid one">
          <input placeholder="Username or email" />
          <input placeholder="Password" type="password" />
        </div>
      )}
      <button className="btn btn-dark wide">{kind === 'login' ? 'Login' : 'Register'} <span className="arr">→</span></button>
      <small className="auth-foot">By continuing you agree to our terms.</small>
    </div>
  )
}

export default function App() {
  const [active, setActive] = useState(PRODUCTS[0])
  const [showConfig, setShowConfig] = useState(false)
  const [auth, setAuth] = useState(null)

  const pick = (p) => {
    setActive(p)
    setShowConfig(true)
    requestAnimationFrame(() => {
      document.getElementById('configure')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  return (
    <div className="page">
      <Navbar onNav={setAuth} />
      <Marquee />
      <main>
        <Hero onStart={() => pick(PRODUCTS[0])} />
        <HotProducts onPick={pick} />
        <Stats />
        <PrintingPicker onPick={pick} />
        {showConfig && <ConfigForm product={active} onClose={() => setShowConfig(false)} />}
        <Steps />
      </main>
      <Footer />
      <Modal open={!!auth} onClose={() => setAuth(null)}>
        <AuthForm kind={auth} />
      </Modal>
    </div>
  )
}
EOF

# ---------- src/App.css ----------
cat > src/App.css << 'EOF'
:root {
  --ink:    #0A0A23;
  --paper:  #FFFBEA;
  --blue:   #1B1BFF;
  --yellow: #FFC93C;
  --orange: #FF4D2E;
  --line:   #0A0A23;
  --shadow: 6px 6px 0 #0A0A23;
  --shadow-sm: 4px 4px 0 #0A0A23;
  --radius: 14px;
  --display: 'Bricolage Grotesque', system-ui, sans-serif;
  --serif:   'Fraunces', Georgia, serif;
  --mono:    'JetBrains Mono', ui-monospace, monospace;
}

.page { min-height: 100vh; display: flex; flex-direction: column; }

/* ---------- NAV ---------- */
.nav {
  position: sticky; top: 0; z-index: 50;
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 24px;
  background: var(--ink);
  color: var(--paper);
  border-bottom: 3px solid var(--ink);
}
.brand-mark {
  display: inline-flex; align-items: baseline; gap: 6px;
  font-family: var(--display); font-weight: 800; font-style: italic;
  font-size: 22px; letter-spacing: -0.02em;
  transform: skew(-6deg);
}
.brand-print { color: var(--paper); }
.brand-runs  { color: var(--yellow); }
.brand-mark.big { font-size: 48px; }

.nav-links {
  display: flex; gap: 28px; align-items: center;
  font-family: var(--display); font-weight: 600; font-size: 15px;
}
.nav-links a { position: relative; padding: 6px 2px; color: var(--paper); }
.nav-links a::after {
  content: ''; position: absolute; left: 0; right: 0; bottom: -4px; height: 2px;
  background: var(--yellow); transform: scaleX(0); transform-origin: left;
  transition: transform .25s ease;
}
.nav-links a:hover::after { transform: scaleX(1); }

.nav-cta { display: flex; gap: 10px; }
.nav-cta-mobile { display: none; }

.btn {
  font-family: var(--display); font-weight: 700;
  border: 2.5px solid var(--ink);
  padding: 10px 18px; border-radius: 999px;
  cursor: pointer; transition: transform .15s ease, box-shadow .15s ease, background .15s;
  display: inline-flex; align-items: center; gap: 8px;
  font-size: 14px; letter-spacing: 0.02em;
}
.btn:hover { transform: translate(-2px, -2px); box-shadow: var(--shadow-sm); }
.btn:active { transform: translate(0,0); box-shadow: none; }
.btn-yellow  { background: var(--yellow); color: var(--ink); }
.btn-ghost   { background: var(--paper);  color: var(--ink); }
.btn-dark    { background: var(--ink);    color: var(--paper); border-color: var(--ink); padding: 14px 22px; font-size: 15px; }
.btn-outline { background: transparent;   color: var(--ink); padding: 14px 22px; font-size: 15px; }
.btn .arr { font-weight: 900; }
.btn.wide { width: 100%; justify-content: center; }
.btn.disabled { opacity: 0.45; cursor: not-allowed; }

.hamburger {
  display: none; flex-direction: column; gap: 5px;
  width: 38px; height: 38px; padding: 8px; background: transparent; border: 0; cursor: pointer;
}
.hamburger span { display: block; height: 3px; background: var(--paper); transition: transform .25s, opacity .25s; }
.hamburger.open span:nth-child(1) { transform: translateY(8px) rotate(45deg); }
.hamburger.open span:nth-child(2) { opacity: 0; }
.hamburger.open span:nth-child(3) { transform: translateY(-8px) rotate(-45deg); }

/* ---------- MARQUEE ---------- */
.marquee {
  background: var(--yellow); color: var(--ink);
  border-bottom: 3px solid var(--ink);
  overflow: hidden; padding: 10px 0;
  font-family: var(--mono); font-weight: 700; letter-spacing: 0.08em; font-size: 13px;
}
.marquee-track {
  display: inline-flex; white-space: nowrap; gap: 28px;
  animation: roll 32s linear infinite;
}
.marquee-item { display: inline-flex; align-items: center; gap: 12px; }
.marquee-dot { color: var(--orange); }
@keyframes roll { from { transform: translateX(0); } to { transform: translateX(-50%); } }

/* ---------- HERO ---------- */
.hero {
  display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 40px;
  align-items: center;
  padding: 64px 48px;
  position: relative;
  background:
    radial-gradient(800px 400px at 90% 0%, rgba(27,27,255,0.08), transparent 60%),
    radial-gradient(700px 350px at 0% 100%, rgba(255,77,46,0.08), transparent 60%),
    var(--paper);
}
.hero::before {
  content: ''; position: absolute; inset: 0;
  background-image: radial-gradient(rgba(10,10,35,0.06) 1px, transparent 1px);
  background-size: 14px 14px; pointer-events: none;
}
.hero-copy { position: relative; z-index: 1; animation: rise .8s cubic-bezier(.2,.7,.2,1) both; }
.hero-eyebrow {
  display: inline-flex; align-items: center; gap: 10px;
  font-family: var(--mono); font-size: 12px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.1em;
  background: var(--ink); color: var(--paper);
  padding: 8px 14px; border-radius: 999px;
  margin-bottom: 22px;
}
.dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
.dot-blue { background: var(--blue); box-shadow: 0 0 0 3px rgba(27,27,255,0.25); animation: pulse 1.6s infinite; }
@keyframes pulse { 50% { box-shadow: 0 0 0 6px rgba(27,27,255,0); } }

.hero-title {
  font-family: var(--display); font-weight: 800;
  font-size: clamp(48px, 7vw, 96px);
  line-height: 0.95; letter-spacing: -0.035em;
  margin: 0 0 20px; color: var(--ink);
}
.hero-title-blue { color: var(--blue); font-style: italic; }
.hero-period { color: var(--orange); }

.hero-sub {
  font-family: var(--serif); font-size: clamp(16px, 1.4vw, 19px);
  line-height: 1.55; max-width: 520px; margin: 0 0 28px; color: #2c2c4a;
}
.hero-ctas { display: flex; gap: 14px; flex-wrap: wrap; margin-bottom: 36px; }
.hero-trust { display: flex; align-items: center; gap: 16px; font-family: var(--display); font-size: 13px; color: #2c2c4a; }
.hero-trust strong { color: var(--ink); font-size: 16px; }
.avatars { display: inline-flex; }
.avatars span {
  width: 36px; height: 36px; border-radius: 50%; border: 2.5px solid var(--ink);
  display: grid; place-items: center; color: #fff; font-weight: 800; font-family: var(--display);
  margin-right: -10px;
}

.hero-visual { position: relative; z-index: 1; animation: rise .9s .1s cubic-bezier(.2,.7,.2,1) both; }
.hero-art { width: 100%; height: auto; filter: drop-shadow(8px 8px 0 rgba(10,10,35,0.18)); }

@keyframes rise { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }

/* ---------- SECTION HEADS ---------- */
.section-head { padding: 0 48px; margin-bottom: 28px; }
.section-head h2 {
  font-family: var(--display); font-size: clamp(34px, 4.5vw, 56px);
  font-weight: 800; letter-spacing: -0.03em; margin: 0 0 8px;
}
.section-head .hot { color: var(--orange); }
.section-head p { font-family: var(--serif); font-size: 17px; color: #3b3b5c; margin: 0; }

/* ---------- HOT PRODUCTS ---------- */
.products { padding: 80px 0 40px; background: var(--paper); }
.product-grid {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 18px;
  padding: 0 48px;
}
.product-card {
  background: var(--paper); border: 2.5px solid var(--ink); border-radius: var(--radius);
  text-align: left; cursor: pointer; padding: 0; overflow: hidden;
  display: flex; flex-direction: column;
  transition: transform .2s ease, box-shadow .2s ease;
  font-family: inherit;
  animation: rise .5s var(--delay, 0ms) both;
}
.product-card:hover { transform: translate(-4px, -4px); box-shadow: var(--shadow); }
.product-art {
  background: linear-gradient(135deg, var(--paper) 0%, color-mix(in srgb, var(--accent) 14%, var(--paper)) 100%);
  padding: 20px; position: relative; aspect-ratio: 1.2 / 1;
  display: grid; place-items: center; border-bottom: 2.5px solid var(--ink);
}
.product-art svg { width: 70%; max-height: 75%; }
.product-spec {
  position: absolute; top: 10px; right: 10px;
  font-family: var(--mono); font-size: 10px; font-weight: 700;
  background: var(--ink); color: var(--paper); padding: 3px 8px; border-radius: 999px;
}
.product-meta { padding: 16px 18px 18px; display: flex; flex-direction: column; gap: 10px; }
.product-meta h3 {
  margin: 0; font-family: var(--display); font-size: 22px; font-weight: 800; letter-spacing: -0.02em;
}
.product-row { display: flex; gap: 6px; flex-wrap: wrap; }
.pill {
  font-family: var(--mono); font-size: 10px; font-weight: 700;
  padding: 5px 9px; border-radius: 999px; letter-spacing: 0.04em; text-transform: uppercase;
}
.pill-blue  { background: var(--blue); color: var(--paper); }
.pill-ghost { background: var(--paper); color: var(--ink); border: 1.5px solid var(--ink); }
.product-cta {
  font-family: var(--display); font-weight: 700; font-size: 13px; color: var(--ink);
  display: inline-flex; align-items: center; gap: 6px;
  border-top: 1.5px dashed var(--ink); padding-top: 10px; margin-top: 4px;
}
.product-card:hover .product-cta { color: var(--blue); }

/* ---------- STATS ---------- */
.stats {
  display: grid; grid-template-columns: repeat(4, 1fr);
  background: var(--ink); color: var(--paper);
  margin: 48px 48px; border-radius: var(--radius);
  border: 2.5px solid var(--ink);
  overflow: hidden;
}
.stat { padding: 28px 24px; border-right: 1.5px solid rgba(255,251,234,0.12); text-align: center; }
.stat:last-child { border-right: 0; }
.stat-num { font-family: var(--display); font-weight: 800; font-size: clamp(28px, 3.6vw, 44px); color: var(--yellow); }
.stat-label { font-family: var(--mono); font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; opacity: 0.7; margin-top: 4px; }

/* ---------- PICKER ---------- */
.picker { padding: 80px 48px 40px; text-align: center; }
.picker h2 {
  font-family: var(--display); font-weight: 800;
  font-size: clamp(36px, 5vw, 64px); letter-spacing: -0.03em;
  margin: 0 0 28px;
}
.picker h2 em { font-family: var(--serif); font-style: italic; color: var(--blue); font-weight: 600; }
.picker-grid {
  display: grid; grid-template-columns: repeat(4, 1fr);
  gap: 14px; max-width: 1100px; margin: 0 auto;
}
.picker-pill {
  display: flex; align-items: center; gap: 12px;
  padding: 14px 18px; border-radius: 999px;
  background: var(--ink); color: var(--paper); border: 2.5px solid var(--ink);
  font-family: var(--display); font-weight: 700; font-size: 16px;
  cursor: pointer; transition: transform .15s, box-shadow .15s;
}
.picker-pill:hover { transform: translate(-3px, -3px); box-shadow: var(--shadow-sm); background: var(--blue); }
.picker-glyph { width: 36px; height: 36px; background: var(--paper); border-radius: 50%; display: grid; place-items: center; padding: 4px; }
.picker-glyph svg { width: 100%; height: 100%; }

/* ---------- CONFIG FORM ---------- */
.config { padding: 60px 48px; background: linear-gradient(180deg, var(--paper) 0%, color-mix(in srgb, var(--blue) 6%, var(--paper)) 100%); }
.config-inner {
  display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 24px;
  background: var(--paper);
  border: 2.5px solid var(--ink); border-radius: var(--radius);
  box-shadow: var(--shadow); overflow: hidden;
}
.config-form { padding: 32px; }
.config-tag {
  font-family: var(--mono); font-size: 11px; font-weight: 700;
  letter-spacing: 0.12em; text-transform: uppercase; color: var(--blue); margin-bottom: 6px;
}
.config-form h2 { font-family: var(--display); font-size: 40px; font-weight: 800; letter-spacing: -0.03em; margin: 0 0 20px; }

.mode-toggle { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 18px; }
.mode-btn {
  text-align: left; padding: 14px 16px; border-radius: 12px;
  border: 2.5px solid var(--ink); background: var(--paper); cursor: pointer;
  display: flex; flex-direction: column; gap: 2px;
  font-family: var(--display); transition: background .15s, color .15s, transform .15s, box-shadow .15s;
}
.mode-btn strong { font-size: 15px; font-weight: 800; }
.mode-btn span  { font-size: 12px; opacity: 0.7; }
.mode-btn:hover { transform: translate(-2px,-2px); box-shadow: var(--shadow-sm); }
.mode-btn.active { background: var(--blue); color: var(--paper); }
.mode-btn.active span { opacity: 0.85; }

.dropzone {
  display: block; padding: 26px; border: 2.5px dashed var(--ink); border-radius: 12px;
  text-align: center; cursor: pointer; background: color-mix(in srgb, var(--yellow) 15%, var(--paper));
  margin-bottom: 18px; font-family: var(--display);
}
.dropzone:hover { background: color-mix(in srgb, var(--yellow) 30%, var(--paper)); }
.dz-icon { font-size: 28px; font-weight: 800; margin-bottom: 6px; }
.dropzone small { display: block; margin-top: 4px; font-family: var(--mono); font-size: 11px; opacity: 0.7; }

.brief textarea {
  width: 100%; padding: 12px; border: 2.5px solid var(--ink); border-radius: 10px;
  font-family: inherit; resize: vertical; background: var(--paper); margin-top: 6px;
}

.field-row { display: grid; grid-template-columns: 1fr auto 1fr 1fr; gap: 10px; align-items: end; margin-bottom: 14px; }
.field { display: flex; flex-direction: column; gap: 6px; font-family: var(--display); font-weight: 700; font-size: 13px; }
.field input, .field select {
  padding: 10px 12px; border: 2.5px solid var(--ink); border-radius: 8px;
  font-family: var(--mono); font-size: 14px; background: var(--paper);
}
.field input:focus, .field select:focus { outline: 0; box-shadow: 0 0 0 3px var(--yellow); }
.by { font-family: var(--display); font-weight: 800; font-size: 22px; padding-bottom: 8px; }
.field.block { display: block; }
.field.block input { width: 100%; margin-top: 6px; }

.check { display: inline-flex; align-items: center; gap: 10px; font-family: var(--display); font-size: 14px; cursor: pointer; }
.check.inline { margin: 6px 0 18px; }
.check input { appearance: none; width: 18px; height: 18px; border: 2.5px solid var(--ink); border-radius: 4px; cursor: pointer; position: relative; background: var(--paper); }
.check input:checked { background: var(--ink); }
.check input:checked::after { content: '✓'; position: absolute; inset: 0; display: grid; place-items: center; color: var(--yellow); font-weight: 900; font-size: 12px; }
.confirm-list { list-style: none; padding: 0; margin: 0 0 24px; display: flex; flex-direction: column; gap: 10px; }

.config-actions { display: flex; gap: 12px; justify-content: flex-end; }

.config-preview {
  background: var(--ink); color: var(--paper); padding: 28px;
  display: flex; flex-direction: column; gap: 20px;
}
.preview-tag { font-family: var(--mono); font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--yellow); }
.preview-frame {
  border: 2.5px solid var(--paper); border-radius: 12px; aspect-ratio: 1.2 / 1;
  display: grid; place-items: center; padding: 24px;
}
.preview-frame svg { width: 65%; }
.preview-spec { font-family: var(--mono); font-size: 13px; }
.preview-spec > div { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dashed rgba(255,251,234,0.2); }
.preview-spec dt { opacity: 0.6; }
.preview-spec dd { margin: 0; font-weight: 700; }

/* ---------- STEPS ---------- */
.steps { padding: 80px 48px; }
.steps-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
.step-card {
  background: var(--paper); border: 2.5px solid var(--ink); border-radius: var(--radius);
  padding: 28px; transition: transform .2s, box-shadow .2s;
}
.step-card:nth-child(1) { background: color-mix(in srgb, var(--yellow) 35%, var(--paper)); }
.step-card:nth-child(2) { background: color-mix(in srgb, var(--blue) 12%, var(--paper)); }
.step-card:nth-child(3) { background: color-mix(in srgb, var(--orange) 14%, var(--paper)); }
.step-card:hover { transform: translate(-3px,-3px); box-shadow: var(--shadow); }
.step-num { font-family: var(--mono); font-size: 13px; font-weight: 700; color: var(--blue); }
.step-card h3 { font-family: var(--display); font-size: 26px; font-weight: 800; letter-spacing: -0.02em; margin: 8px 0 10px; }
.step-card p { font-family: var(--serif); font-size: 16px; line-height: 1.5; margin: 0; color: #2c2c4a; }

/* ---------- FOOTER ---------- */
.footer {
  background: var(--ink); color: var(--paper);
  padding: 60px 48px 24px; margin-top: 60px;
}
.footer-top { display: flex; align-items: baseline; justify-content: space-between; gap: 24px; flex-wrap: wrap; padding-bottom: 30px; border-bottom: 1px solid rgba(255,251,234,0.15); }
.footer-top p { font-family: var(--serif); font-size: 18px; max-width: 360px; margin: 0; opacity: 0.8; }
.footer-cols { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; padding: 30px 0; }
.footer-cols h4 { font-family: var(--display); font-size: 14px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: var(--yellow); margin: 0 0 14px; }
.footer-cols a { display: block; font-family: var(--display); font-size: 14px; padding: 5px 0; opacity: 0.8; cursor: pointer; }
.footer-cols a:hover { opacity: 1; color: var(--yellow); }
.footer-bot { display: flex; justify-content: space-between; padding-top: 18px; border-top: 1px solid rgba(255,251,234,0.15); font-family: var(--mono); font-size: 12px; opacity: 0.6; }

/* ---------- MODAL ---------- */
.modal { position: fixed; inset: 0; background: rgba(10,10,35,0.6); backdrop-filter: blur(4px); display: grid; place-items: center; z-index: 100; padding: 20px; animation: fade .2s ease both; }
@keyframes fade { from { opacity: 0; } to { opacity: 1; } }
.modal-card { background: var(--paper); border: 2.5px solid var(--ink); border-radius: var(--radius); box-shadow: var(--shadow); padding: 28px; width: 100%; max-width: 460px; position: relative; animation: rise .25s ease both; }
.modal-x { position: absolute; top: 12px; right: 14px; background: transparent; border: 0; font-size: 28px; cursor: pointer; color: var(--ink); }
.auth h3 { font-family: var(--display); font-size: 26px; font-weight: 800; margin: 0 0 14px; letter-spacing: -0.02em; }
.auth-tabs { display: flex; gap: 6px; padding: 4px; background: color-mix(in srgb, var(--ink) 10%, var(--paper)); border-radius: 999px; margin-bottom: 18px; }
.auth-tab { flex: 1; border: 0; padding: 8px 10px; border-radius: 999px; cursor: pointer; font-family: var(--display); font-weight: 700; font-size: 13px; background: transparent; color: var(--ink); }
.auth-tab.on { background: var(--ink); color: var(--paper); }
.auth-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px; }
.auth-grid.one { grid-template-columns: 1fr; }
.auth-grid input { padding: 11px 12px; border: 2.5px solid var(--ink); border-radius: 8px; font-family: var(--mono); font-size: 14px; background: var(--paper); }
.auth-grid input:focus { outline: 0; box-shadow: 0 0 0 3px var(--yellow); }
.auth-foot { display: block; text-align: center; margin-top: 12px; font-family: var(--mono); font-size: 11px; opacity: 0.6; }

/* ---------- RESPONSIVE ---------- */
@media (max-width: 980px) {
  .hero { grid-template-columns: 1fr; padding: 40px 24px; gap: 30px; }
  .hero-visual { order: -1; max-width: 360px; margin: 0 auto; }
  .product-grid { grid-template-columns: repeat(2, 1fr); padding: 0 24px; }
  .picker-grid  { grid-template-columns: repeat(2, 1fr); }
  .stats { grid-template-columns: repeat(2, 1fr); margin: 36px 24px; }
  .stat:nth-child(2) { border-right: 0; }
  .stat:nth-child(1), .stat:nth-child(2) { border-bottom: 1.5px solid rgba(255,251,234,0.12); }
  .config-inner { grid-template-columns: 1fr; }
  .config { padding: 40px 24px; }
  .steps-grid { grid-template-columns: 1fr; }
  .steps, .picker, .products, .footer { padding-left: 24px; padding-right: 24px; }
  .section-head { padding: 0 24px; }
}

@media (max-width: 720px) {
  .nav { padding: 12px 18px; }
  .nav-cta { display: none; }
  .hamburger { display: flex; }
  .nav-links {
    position: absolute; top: 100%; left: 0; right: 0;
    flex-direction: column; gap: 0; padding: 0;
    background: var(--ink);
    max-height: 0; overflow: hidden;
    border-bottom: 0;
    transition: max-height .3s ease, border-bottom .3s ease;
  }
  .nav-links.open { max-height: 480px; border-bottom: 3px solid var(--ink); }
  .nav-links a { padding: 16px 24px; width: 100%; border-bottom: 1px solid rgba(255,251,234,0.1); }
  .nav-links a::after { display: none; }
  .nav-cta-mobile { display: flex; gap: 10px; padding: 16px 24px; }
  .field-row { grid-template-columns: 1fr 1fr; }
  .field-row .by { display: none; }
  .field-row .field:nth-child(4) { grid-column: 1 / -1; }
  .footer-top { flex-direction: column; align-items: flex-start; }
  .brand-mark.big { font-size: 36px; }
  .footer-cols { grid-template-columns: 1fr 1fr; }
}

@media (max-width: 460px) {
  .product-grid { grid-template-columns: 1fr; }
  .picker-grid  { grid-template-columns: 1fr; }
  .stats { grid-template-columns: 1fr; }
  .stat { border-right: 0 !important; border-bottom: 1.5px solid rgba(255,251,234,0.12); }
  .stat:last-child { border-bottom: 0; }
  .auth-grid { grid-template-columns: 1fr; }
  .footer-cols { grid-template-columns: 1fr; }
  .hero-ctas .btn { flex: 1; justify-content: center; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.001ms !important; transition-duration: 0.001ms !important; }
}
EOF

echo ""
echo "✅ Print Runs rebuilt. Now run:"
echo "   npm install   # only if you haven't already"
echo "   npm run dev   # to preview locally"
echo "   git add -A && git commit -m 'redesign' && git push   # Vercel auto-deploys"
