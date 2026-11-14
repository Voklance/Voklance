import { useEffect, useState } from 'react';

type ApiStatus = 'checking' | 'online' | 'offline';

interface HealthResponse {
  status: string;
}

const starterCards = [
  { icon: '✳', label: 'Make it yours', text: 'Shape this space around the way you work.' },
  { icon: '↗', label: 'Build something', text: 'Your React app is ready for its first feature.' },
  { icon: '⌘', label: 'Connect the dots', text: 'Your Express API is waiting when you need it.' }
];

function Brand() {
  return (
    <a className="brand" href="#home" aria-label="Voklance home">
      <span className="brand-mark" aria-hidden="true">V</span>
      <span>Voklance</span>
    </a>
  );
}

export default function App() {
  const [apiStatus, setApiStatus] = useState<ApiStatus>('checking');

  useEffect(() => {
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api';

    fetch(`${apiBaseUrl}/health`)
      .then((response) => {
        if (!response.ok) throw new Error('API unavailable');
        return response.json();
      })
      .then((data: HealthResponse) => setApiStatus(data.status === 'ok' ? 'online' : 'offline'))
      .catch(() => setApiStatus('offline'));
  }, []);

  return (
    <div className="app-shell" id="home">
      <header className="topbar">
        <Brand />
        <div className="topbar-right">
          <span className={`api-indicator ${apiStatus}`}>
            <span className="status-dot" />
            API {apiStatus}
          </span>
          <button className="avatar" aria-label="Your profile">V</button>
        </div>
      </header>

      <main className="main-content">
        <div className="eyebrow"><span className="eyebrow-line" /> YOUR NEW SPACE</div>
        <section className="welcome-section">
          <div className="welcome-copy">
            <p className="greeting">A fresh start looks good on you.</p>
            <h1>Make room for<br /><span>what’s next.</span></h1>
            <p className="intro">Welcome to Voklance. Your project is set up and ready to become something great.</p>
            <a className="primary-button" href="#starter">Explore your workspace <span aria-hidden="true">↗</span></a>
          </div>
          <div className="orbital-art" aria-hidden="true">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="orbit orbit-three" />
            <div className="orb-core"><span>V</span></div>
            <span className="spark spark-one">✦</span>
            <span className="spark spark-two">✧</span>
            <span className="spark spark-three">·</span>
          </div>
        </section>

        <section className="starter-section" id="starter">
          <div className="section-heading">
            <div>
              <p className="section-kicker">THE STARTING LINE</p>
              <h2>Everything begins somewhere.</h2>
            </div>
            <span className="section-count">01 <span>/ 03</span></span>
          </div>
          <div className="starter-grid">
            {starterCards.map((card, index) => (
              <article className="starter-card" key={card.label}>
                <div className="card-topline"><span className="card-icon">{card.icon}</span><span className="card-number">0{index + 1}</span></div>
                <h3>{card.label}</h3>
                <p>{card.text}</p>
                <span className="card-arrow" aria-hidden="true">↗</span>
              </article>
            ))}
          </div>
        </section>

        <footer className="footer"><Brand /><span>Built for your next chapter.</span></footer>
      </main>
    </div>
  );
}
