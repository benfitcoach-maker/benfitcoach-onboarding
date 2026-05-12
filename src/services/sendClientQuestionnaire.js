// ─────────────────────────────────────────────────────────────────
// AZ.1 + BA — Helpers d'envoi du questionnaire pré-RDV
// Date : 2026-05-11
//
// 2 modes d'envoi possibles :
//
//   1. Mode 'lien direct' (openClientQuestionnaireMail) :
//      Mail Gmail avec sujet 'Questionnaire pré-RDV' + lien
//      /questionnaire/:clientId (FR) ou /anamnese/:clientId (EN)
//      → La cliente ouvre le lien, remplit le formulaire web, c'est fait.
//      → Utilisable pour TOUTES les clientes.
//
//   2. Mode 'app cliente' (openClientWelcomeAppMail, V97.6) :
//      Mail Gmail Bienvenue + lien /login de l'app cliente
//      → La cliente s'authentifie via code email 8 chiffres
//      → Elle accède au parcours timeline avec CTA 'Remplir le questionnaire'
//      → Acceptable uniquement si client.app_enabled === true
//      → Plus premium : ancre la cliente dans l'écosystème app
// ─────────────────────────────────────────────────────────────────

import { getClientNutritionLocale } from './nutritionLocale';
import { emailSubjectQuestionnaire, emailSubjectWelcomeApp, COACH_IDENTITY } from './coachIdentity';
import { getClientAppUrl } from './clientAppUrl';

/** Mode 1 : lien direct vers le formulaire web /questionnaire ou /anamnese. */
export function openClientQuestionnaireMail(client) {
  if (!client?.id) return false;
  const locale = getClientNutritionLocale(client);
  const clientId = client.id;
  const clientEmail = client.form?.email || client.email || '';
  const clientPrenom = client.prenom || client.form?.prenom || '';

  let url, subject, body;
  if (locale === 'EN') {
    url = `${window.location.origin}/anamnese/${clientId}`;
    subject = emailSubjectQuestionnaire('en');
    body =
      `Hello ${clientPrenom},\n\n` +
      `Ahead of our consultation, please take 10-15 minutes to complete your personalized health assessment:\n\n` +
      `➜ ${url}\n\n` +
      `All information is strictly confidential and used only to prepare your nutrition plan.`;
  } else {
    url = `${window.location.origin}/questionnaire/${clientId}`;
    subject = emailSubjectQuestionnaire('fr');
    body =
      `Bonjour ${clientPrenom},\n\n` +
      `Avant notre consultation, merci de remplir ce court questionnaire (5 minutes) :\n\n` +
      `➜ ${url}\n\n` +
      `Ce questionnaire est strictement confidentiel.`;
  }
  const gmailUrl = `https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(clientEmail)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.open(gmailUrl, '_blank');
  return true;
}

/** Mode 2 : mail Bienvenue avec lien /login de l'app cliente (V97.6).
 *  À utiliser uniquement si client.app_enabled === true. */
export function openClientWelcomeAppMail(client) {
  if (!client?.id) return false;
  // V97.4 fix : avant 2026-05-12 le fallback pointait sur le SaaS au lieu
  // de l'app cliente. Source unique : ./clientAppUrl.js
  const APP_URL = getClientAppUrl();
  const clientEmail = client.form?.email || client.email || '';
  const clientPrenom = client.prenom || client.form?.prenom || '';
  const subject = emailSubjectWelcomeApp('fr');
  const body =
    `Bonjour ${clientPrenom},\n\n` +
    `Bienvenue chez ${COACH_IDENTITY.brand}. Votre espace personnel est prêt :\n\n` +
    `➜ ${APP_URL}/login\n\n` +
    `Comment vous connecter :\n` +
    `1. Ouvrez le lien ci-dessus\n` +
    `2. Entrez votre email (${clientEmail || 'celui-ci'})\n` +
    `3. Vous recevrez un code à 8 chiffres par email\n` +
    `4. Une fois connectée, vous verrez votre parcours en 7 étapes,\n` +
    `   en commençant par le pré-questionnaire à remplir avant notre RDV.\n\n` +
    `Astuce : installez l'app sur votre écran d'accueil pour un accès rapide :\n` +
    `• iPhone (Safari) : Partager → "Sur l'écran d'accueil"\n` +
    `• Android (Chrome) : un bouton "Installer" apparaîtra\n\n` +
    `À très bientôt,\n${COACH_IDENTITY.shortName}`;
  const gmailUrl = `https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(clientEmail)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.open(gmailUrl, '_blank');
  return true;
}
