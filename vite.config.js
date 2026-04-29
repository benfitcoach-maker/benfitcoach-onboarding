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
  }
})
