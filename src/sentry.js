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

// RGPD — borne de troncature des messages d'erreur envoyés à Sentry.
// Filet : même si un message d'erreur embarquait par accident un fragment de
// donnée cliente (anamnèse, plan, sortie IA), on n'en laisse partir qu'un
// extrait court côté Sentry. Le vrai blocage reste la suppression des
// breadcrumbs console ci-dessous.
const SENTRY_MSG_MAX = 300;

function truncate(value) {
  if (typeof value !== 'string') return value;
  return value.length > SENTRY_MSG_MAX
    ? `${value.slice(0, SENTRY_MSG_MAX)}… [tronqué RGPD]`
    : value;
}

if (sentryEnabled) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0,
    // RGPD : ne jamais attacher d'IP, cookies, headers ou body de requête.
    sendDefaultPii: false,
    beforeSend(event) {
      // 1. Couper TOUS les breadcrumbs console : c'est le canal par lequel un
      //    console.log de donnée santé partirait chez Sentry. On le ferme.
      if (Array.isArray(event.breadcrumbs)) {
        event.breadcrumbs = event.breadcrumbs.filter(
          (b) => b?.category !== 'console',
        );
      }
      // 2. Tronquer le message top-level et les valeurs d'exception.
      if (event.message) event.message = truncate(event.message);
      if (event.exception?.values) {
        event.exception.values = event.exception.values.map((v) => ({
          ...v,
          value: truncate(v.value),
        }));
      }
      return event;
    },
  });
}

export { Sentry };
