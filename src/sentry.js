// ─── Sentry — monitoring d'erreurs (roadmap 1.5) ───────────────────────
// Objectif : savoir AVANT Anissa quand quelque chose casse en prod.
//
// Choix volontaires :
//   - Erreurs uniquement : pas de tracing (tracesSampleRate: 0), pas de
//     session replay. On ne veut pas grignoter le quota ni envoyer de data
//     de session.
//   - PRODUCTION uniquement (import.meta.env.PROD) : les erreurs du dev local
//     ne doivent pas polluer le quota (5 000 evenements).
//   - DSN via env VITE_SENTRY_DSN. Le DSN est PUBLIC par design : il ne permet
//     que d'ENVOYER des erreurs vers le projet, jamais de les lire. Il peut
//     donc vivre dans le bundle navigateur (contrairement au secret admin app
//     cliente qui, lui, est server-side only).
//
// Strictement additif : aucun comportement existant modifie. En dev (ou si le
// DSN est absent), sentryEnabled = false et l'app se rend exactement comme
// avant (overlay d'erreur Vite preserve, CockpitErrorBoundary intact).
import * as Sentry from '@sentry/react';

const dsn = import.meta.env.VITE_SENTRY_DSN;

export const sentryEnabled = !!(import.meta.env.PROD && dsn);

if (sentryEnabled) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0,
  });
}

export { Sentry };
