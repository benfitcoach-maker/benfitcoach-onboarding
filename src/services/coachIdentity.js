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

import { PRACTITIONER_LEGAL_PROFILE } from './practitionerProfile';

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
  /** Sous-titre / spécialisation pour signatures.
   *  P3.2 sécurité clinique — consomme le titre légal SoT (practitionerProfile)
   *  au lieu d'une sur-revendication "longévité et génétique". Toute mention
   *  affichée à la cliente doit refléter le titre défendable juridiquement. */
  subtitle: PRACTITIONER_LEGAL_PROFILE.title,
  /** Ville du cabinet de consultation (V97.15+ : a confirmer) */
  city: 'Nyon',
  /** Email de contact officiel pour la cliente */
  email: 'anissa.nutri@gmail.com',
  /** Numero de telephone officiel */
  phone: '076 621 02 05',
  /** Site web public */
  website: 'www.anissanutrition.ch',
};

/**
 * Adresse du SIÈGE SOCIAL de la société (registre du commerce).
 *
 * ⚠️ Réservé aux documents LÉGAUX / FACTURES uniquement. Ce n'est PAS
 * l'adresse à afficher sur les documents cliente (plan, fiche médecin,
 * couverture, pack) : utiliser PRACTICE_IDENTITY (cabinet) pour ceux-là.
 * (Décision Benoit 2026-06-10 : siège St-Cergue ≠ cabinet Nyon.)
 * Aucune facture PDF n'existe encore → cette constante est en réserve.
 */
export const COMPANY_IDENTITY = {
  /** Raison sociale : "AB Coaching Sàrl" */
  name: 'AB Coaching Sàrl',
  /** Rue + numero du siege social */
  street: 'Chemin du Vieux-Château 2a',
  /** Code postal du siege */
  postalCode: '1264',
  /** Ville du siege social */
  city: 'St-Cergue',
  /** Adresse complete sur une ligne (documents légaux / factures) */
  get addressLine() {
    return `${this.name} · ${this.street}, ${this.postalCode} ${this.city}`;
  },
};

/**
 * Adresse du CABINET (lieu d'exploitation / accueil clientes).
 *
 * C'est l'adresse pertinente pour la cliente → à afficher sur TOUS les
 * documents cliente et la fiche médecin (plan, couverture, pack,
 * MedicalSummary). Données dérivées du profil légal SoT (pas de
 * duplication) : Rue de Rive 28, 1260 Nyon.
 */
export const PRACTICE_IDENTITY = {
  /** Entité d'exploitation (même Sàrl que le siège) */
  name: PRACTITIONER_LEGAL_PROFILE.company,
  /** Rue + numero du cabinet */
  street: PRACTITIONER_LEGAL_PROFILE.address.street,
  /** Code postal du cabinet */
  postalCode: PRACTITIONER_LEGAL_PROFILE.address.postalCode,
  /** Ville du cabinet */
  city: PRACTITIONER_LEGAL_PROFILE.address.city,
  /** Adresse complete sur une ligne (documents cliente) */
  get addressLine() {
    return `${this.name} · ${this.street}, ${this.postalCode} ${this.city}`;
  },
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

/** Signature pied de page PDF (line 2 du footer FR).
 *  P3.2 — titre légal SoT au lieu de "nutritionniste specialisee". */
export function pdfFooterClosingFr() {
  return `par ${COACH_IDENTITY.name}, ${COACH_IDENTITY.subtitle}`;
}

/** Signature pied de page PDF (line 2 du footer EN).
 *  P3.2 — formulation neutre parallèle (pas de sur-revendication). */
export function pdfFooterClosingEn() {
  return `by ${COACH_IDENTITY.name}, practitioner in nutrition`;
}
