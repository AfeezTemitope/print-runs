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
