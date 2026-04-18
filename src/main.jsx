import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

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
