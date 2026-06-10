import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { Sentry, sentryEnabled } from './sentry'

// En prod (DSN present), on enveloppe l'app dans l'ErrorBoundary Sentry pour
// remonter les crashs top-level. En dev, on rend App directement → overlay
// d'erreur Vite preserve, comportement inchange (strictement additif).
// NB : le CockpitErrorBoundary interne (ClientJourneyPage) reste intact ; ce
// boundary-ci est un filet global au-dessus, il ne le remplace pas.
const tree = sentryEnabled ? (
  <Sentry.ErrorBoundary
    fallback={
      <div style={{ padding: 24, fontFamily: 'system-ui, sans-serif', textAlign: 'center' }}>
        <p>Une erreur inattendue est survenue.</p>
        <button type="button" onClick={() => window.location.reload()}>
          Recharger
        </button>
      </div>
    }
  >
    <App />
  </Sentry.ErrorBoundary>
) : (
  <App />
)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {tree}
  </StrictMode>,
)

// V30/V40 : enregistre le service worker PWA en prod web uniquement
// — Capacitor (app native iOS/Android) n'a pas besoin du SW et le path ./sw.js
// n'est pas résolvable dans la WebView → on skip.
const isNativeCapacitor = typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.();
if ('serviceWorker' in navigator && import.meta.env.PROD && !isNativeCapacitor) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.warn('[SW] registration failed:', err?.message);
    });
  });
}
