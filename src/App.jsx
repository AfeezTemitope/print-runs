import { useState } from 'react'
import './App.css'
import heroImg from './assets/hero.png'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <section className="banner">
        <div className="banner-content">
          <img src={heroImg} className="hero-img" alt="Hero" />
          <h1 className="headline">
            Welcome to <span className="brand">PRINT RUNS</span>
          </h1>
          <p className="subtext">
            Fast, bold, and reliable printing solutions — built for you.
          </p>
          <button
            className="cta-button"
            onClick={() => setCount((count) => count + 1)}
          >
            Count is {count}
          </button>
        </div>
      </section>
    </>
  )
}

export default App
