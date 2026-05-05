import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './themes/anissa.css' // V98.0 Phase A — overrides via [data-theme="anissa"]
import App from './App.jsx'

// V98.0 — Active le thème Anissa si flag localStorage présent.
// Activation : localStorage.setItem('theme', 'anissa') puis reload.
// Désactivation : localStorage.removeItem('theme') puis reload.
// (Auto-detect par utilisateur connecté = Phase ultérieure.)
try {
  const theme = localStorage.getItem('theme');
  if (theme === 'anissa') {
    document.body.dataset.theme = 'anissa';
  }
} catch {
  // localStorage indispo (privacy mode strict) → on ignore, fallback Benfitcoach
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
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
