import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

// ─── Config ESLint CI (roadmap 1.5) ──────────────────────────────────────
// Ne bloque QUE sur les deux regles qui ont reellement casse la prod en V97.34 :
//   - no-undef            : variable/fonction non definie (crash runtime)
//   - rules-of-hooks      : hook appele conditionnellement (page noire React)
//
// La dette lint restante (no-unused-vars, react-compiler memoization, etc.)
// reste NON bloquante pour ne pas figer le sprint. Le `npm run lint` complet
// continue de la signaler en local.
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    // react-refresh enregistre (sans regle active) pour que les commentaires
    // `eslint-disable react-refresh/...` du code ne provoquent pas "rule not found".
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    // On ignore les directives eslint-disable orphelines (no-console non active
    // ici) : ce sont des warnings de bruit, pas l'objet du garde-fou CI.
    linterOptions: { reportUnusedDisableDirectives: 'off' },
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        ...globals.browser,
        __APP_VERSION__: 'readonly',
        __BUILD_HASH__: 'readonly',
        __BUILD_DATE__: 'readonly',
      },
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-undef': 'error',
      'react-hooks/rules-of-hooks': 'error',
    },
  },
  {
    files: ['api/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: globals.node,
    },
    rules: {
      'no-undef': 'error',
    },
  },
])
