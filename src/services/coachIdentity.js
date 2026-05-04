// V97.13 — Identité du coach et du partenaire centralisée.
//
// Avant V97.13, "Anissa Deroubaix" / "Anissa Nutrition" / "Benoit" étaient
// hardcodés dans 7+ fichiers (subjects emails, PDF footer, dashboard,
// MedicalSummary, etc.). Si Anissa rachète l'app à Benoit ou si on
// ajoute un autre coach plus tard, il faudrait modifier ces 7 fichiers
// en risquant des oublis.
//
// Ce service centralise l'identité. Pour multi-coach futur, on pourra
// résoudre dynamiquement selon `getCurrentUser()` ou un context provider.
//
// Usage :
//   import { COACH_IDENTITY, PARTNER_IDENTITY, emailSubjectQuestionnaire } from './services/coachIdentity';
//   doc.text(COACH_IDENTITY.brand, ...);
//   const subject = emailSubjectQuestionnaire('fr');

/** Identité du coach principal de l'app (Anissa). */
export const COACH_IDENTITY = {
  /** Nom complet : "Anissa Deroubaix" */
  name: 'Anissa Deroubaix',
  /** Prénom seul : "Anissa" — utilisé dans les CTAs informels */
  shortName: 'Anissa',
  /** Marque produit : "Anissa Nutrition" — sur logos, headers */
  brand: 'Anissa Nutrition',
  /** Marque longue : "Anissa Deroubaix Nutrition" — pied PDF, marketing */
  brandFull: 'Anissa Deroubaix Nutrition',
  /** Sous-titre / spécialisation pour signatures */
  subtitle: 'Nutritionniste spécialisée en longévité et génétique',
  /** Ville (utilisée dans la signature pied de page) */
  city: 'Nyon',
};

/**
 * Identité du partenaire (Benoit côté SaaS — coach sport/massage qui partage
 * certaines clientes avec Anissa). Sera redéfinie ou retirée le jour où
 * Anissa rachète l'app et utilise le SaaS sans Benoit.
 */
export const PARTNER_IDENTITY = {
  /** Prénom : "Benoit" */
  name: 'Benoit',
  /** Label générique en cas de besoin "neutre" : "Coach partenaire" */
  label: 'Coach partenaire',
};

// ─── Helpers wording (subjects email, signatures, etc.) ──────────────────

/** Subject email questionnaire pré-consultation. */
export function emailSubjectQuestionnaire(locale = 'fr') {
  if (locale === 'en') return `Your pre-consultation health assessment — ${COACH_IDENTITY.name}`;
  return `Votre questionnaire pré-consultation — ${COACH_IDENTITY.name}`;
}

/** Subject email "Bienvenue sur l'espace app cliente". */
export function emailSubjectWelcomeApp(locale = 'fr') {
  if (locale === 'en') return `Your ${COACH_IDENTITY.brand} space is ready`;
  return `Votre espace ${COACH_IDENTITY.brand} est prêt`;
}

/** Subject email bilan 4 semaines (followup). */
export function emailSubjectFollowupReview(locale = 'fr') {
  if (locale === 'en') return `Your 4-week review — ${COACH_IDENTITY.name}`;
  return `Ton bilan 4 semaines — ${COACH_IDENTITY.name}`;
}

/** Signature pied de page PDF (line 2 du footer FR). */
export function pdfFooterClosingFr() {
  return `par ${COACH_IDENTITY.name}, nutritionniste specialisee`;
}

/** Signature pied de page PDF (line 2 du footer EN). */
export function pdfFooterClosingEn() {
  return `by ${COACH_IDENTITY.name}, nutritionist specialized`;
}
