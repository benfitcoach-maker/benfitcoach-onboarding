import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // V40 : chemins relatifs obligatoires pour Capacitor (WebView native file://)
  // — sinon les assets ne se chargent pas dans l'app iOS/Android
  base: './',
})
