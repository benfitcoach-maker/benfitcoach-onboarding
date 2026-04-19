import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// V44 : base conditionnelle
// - mode 'capacitor' → './' (chemins relatifs pour WebView natif iOS/Android)
// - mode par defaut → '/' (chemins absolus pour routes web sub-paths comme /questionnaire/:id)
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === 'capacitor' ? './' : '/',
}))
