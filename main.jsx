import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// ── Stubs for cloud persistence (implement when ready) ──
const hydrateFromCloud = async () => {};
const installPersistBridge = () => {};

// ── Error Boundary ──
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }
  componentDidCatch(error, info) {
    this.setState({ error, info });
    console.error('[LifeOS1 ErrorBoundary]', error, info);
  }
  render() {
    if (this.state.error) {
      const msg = String(this.state.error);
      const stack = this.state.info?.componentStack;
      return (
        <div style={{
          minHeight: '100vh', background: '#07080f', color: '#f0ede8',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'monospace', padding: 40,
        }}>
          <div style={{ maxWidth: 800, width: '100%' }}>
            <div style={{ color: '#ff4f5e', fontSize: 18, fontWeight: 900, marginBottom: 16 }}>
              LifeOS1 — Runtime Error
            </div>
            <div style={{ background: '#12131f', borderRadius: 8, padding: 20, marginBottom: 16, border: '1px solid rgba(255,79,94,0.3)' }}>
              <div style={{ color: '#ff8c42', fontWeight: 700, marginBottom: 8 }}>{msg}</div>
              <div style={{ color: '#6aaedd', fontSize: 11, whiteSpace: 'pre-wrap', overflow: 'auto', maxHeight: 400 }}>
                {stack}
              </div>
            </div>
            <button
              onClick={() => { this.setState({ error: null, info: null }); window.location.reload(); }}
              style={{ background: '#9b72cf', border: 'none', color: '#fff', padding: '10px 24px', borderRadius: 6, cursor: 'pointer', fontWeight: 700 }}>
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Single mount — ErrorBoundary wraps everything ──
const root = createRoot(document.getElementById('root'));

async function start() {
  try {
    await Promise.race([
      hydrateFromCloud(),
      new Promise((r) => setTimeout(r, 1500)),
    ]);
  } catch (e) { console.error('[persistBridge] hydrate error:', e); }
  try { installPersistBridge(); } catch (e) { console.error('[persistBridge] install error:', e); }

  root.render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}

start();