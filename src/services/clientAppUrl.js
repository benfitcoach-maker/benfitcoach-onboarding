// V97.4 — URL de l'app cliente (espace personnel Anissa).
// Date : 2026-05-12
//
// Source unique pour l'URL `/login` envoyée aux clientes dans les mails
// d'activation et de bienvenue.
//
// Hiérarchie de résolution :
//   1. import.meta.env.VITE_CLIENT_APP_URL (configurable sur Vercel)
//   2. fallback hardcodé sur https://anissa-client-app.vercel.app
//
// ⚠️ AVANT V97.4 : le fallback pointait par erreur sur
// https://app.anissanutrition.ch (= SaaS Anissa, pas l'app cliente).
// Les clientes recevaient un lien vers l'onboarding admin au lieu de
// leur espace personnel — corrigé 2026-05-12 par Benoit.
//
// Bonne pratique : configurer VITE_CLIENT_APP_URL sur Vercel
// (project benfitcoach-onboarding) pour pouvoir basculer staging/prod
// sans recompiler le bundle.

const FALLBACK_CLIENT_APP_URL = 'https://anissa-client-app.vercel.app';

/**
 * Retourne l'URL de base de l'app cliente (sans trailing slash).
 * @returns {string}
 */
export function getClientAppUrl() {
  if (typeof import.meta !== 'undefined' && import.meta?.env?.VITE_CLIENT_APP_URL) {
    return String(import.meta.env.VITE_CLIENT_APP_URL).replace(/\/+$/, '');
  }
  return FALLBACK_CLIENT_APP_URL;
}

/**
 * Retourne l'URL de login complète : `{APP_URL}/login`.
 * @returns {string}
 */
export function getClientAppLoginUrl() {
  return `${getClientAppUrl()}/login`;
}
