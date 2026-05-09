import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

// V94.25 : versioning automatique au build
// - APP_VERSION : 'V' + version du package.json (ex: 'V94.25')
// - BUILD_HASH : hash court du dernier commit git (ex: 'a1b2c3d')
// - BUILD_DATE : date YYYY-MM-DD du build
// Plus besoin de bump APP_VERSION manuellement dans App.jsx
// → bump uniquement la "version" dans package.json (npm version patch/minor)
function readBuildMeta() {
  let pkgVersion = '0.0.0'
  try {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8'))
    pkgVersion = pkg.version || '0.0.0'
  } catch { /* fallback */ }

  let gitHash = 'dev'
  try {
    gitHash = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().trim() || 'dev'
  } catch { /* hors git */ }

  const buildDate = new Date().toISOString().slice(0, 10)
  return { pkgVersion, gitHash, buildDate }
}

// https://vite.dev/config/
// V44 : base conditionnelle
// - mode 'capacitor' → './' (chemins relatifs pour WebView natif iOS/Android)
// - mode par defaut → '/' (chemins absolus pour routes web sub-paths comme /questionnaire/:id)
export default defineConfig(({ mode }) => {
  const { pkgVersion, gitHash, buildDate } = readBuildMeta()

  // eslint-disable-next-line no-console
  console.log(`[vite] Build V${pkgVersion} · ${gitHash} · ${buildDate}`)

  return {
    plugins: [react()],
    base: mode === 'capacitor' ? './' : '/',
    define: {
      __APP_VERSION__: JSON.stringify(`V${pkgVersion}`),
      __BUILD_HASH__: JSON.stringify(gitHash),
      __BUILD_DATE__: JSON.stringify(buildDate),
    },
    // Phase B.1.b (2026-05-09) : proxy /api/* vers la prod pour permettre
    // d'utiliser les Vercel functions (api/claude, api/client-app-proxy)
    // pendant le dev local (npm run dev). Vite ne sert pas les serverless
    // functions par defaut. Alternative plus lourde : `vercel dev`.
    server: {
      proxy: {
        '/api': {
          target: 'https://app.anissanutrition.ch',
          changeOrigin: true,
          secure: true,
        },
      },
    },
    // V94.68 : sourcemap prod pour stack traces lisibles. Le SaaS est admin-only
    // (login Anissa/Benoit), pas un site public — exposer le source nous permet
    // de diagnostiquer en 30s au lieu de bisecter manuellement les 77 .split du
    // mapper. Cout : +200 KB de .map files servies cote client uniquement quand
    // DevTools est ouvert.
    build: {
      sourcemap: true,
    },
  }
})
