// ─────────────────────────────────────────────────────────────────
// AZ.1 — Helper d'envoi du questionnaire pré-RDV à une cliente
// Date : 2026-05-11
//
// Ouvre Gmail dans un nouvel onglet avec un mail pré-rempli :
// - destinataire : email de la cliente
// - sujet : "Questionnaire pré-RDV — Anissa Nutrition" (FR/EN)
// - corps : lien personnalisé /questionnaire/:clientId (FR) ou
//           /anamnese/:clientId (EN, anamnèse complète)
//
// Utilisé à 2 endroits :
//   - Dashboard Anissa : bouton dans menu Plus (legacy, à migrer)
//   - Parcours cliente : étape 1 Anamnèse (logique : on envoie le
//     questionnaire avant le RDV de l'anamnèse)
// ─────────────────────────────────────────────────────────────────

import { getClientNutritionLocale } from './nutritionLocale';
import { emailSubjectQuestionnaire } from './coachIdentity';

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
