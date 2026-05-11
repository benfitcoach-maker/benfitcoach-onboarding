// ─────────────────────────────────────────────────────────────────
// Compliance — Profil légal du praticien (source unique de vérité)
// Date : 2026-05-11
//
// Toutes les mentions affichées dans :
//   - PDF / Word exportés (livret postal cliente)
//   - App cliente (bannière "Validé par...")
//   - Mails envoyés depuis le SaaS
//   - En-têtes de documents officiels
// doivent provenir d'ici. Pas de duplication ailleurs.
//
// ⚠️ TODO Benoit : remplir les champs marqués "À COMPLÉTER" avec les
// informations professionnelles exactes d'Anissa avant publication.
// Sans ça, la compliance layer est techniquement en place mais
// juridiquement floue (cf. discussion 2026-05-11).
// ─────────────────────────────────────────────────────────────────

export const PRACTITIONER_LEGAL_PROFILE = {
  // Identité affichée publiquement
  name: 'Anissa Deroubaix',

  // Titre professionnel reconnu (Suisse).
  // ⚠️ TODO : confirmer le titre exact d'Anissa.
  // Options vraisemblables :
  //   - 'Diététicienne ASDD' (titre protégé, Association Suisse des Diététiciens)
  //   - 'Diététicienne diplômée ES' (titre fédéral)
  //   - 'Nutritionniste fonctionnelle' (descriptif, pas un titre protégé)
  title: 'À COMPLÉTER — titre exact reconnu Suisse',

  // Numéro GLN (Global Location Number, registre santé Suisse).
  // ⚠️ TODO : à demander à Anissa si elle est enregistrée GLN.
  // Format : 7601000000000 (13 chiffres)
  gLNumber: 'À COMPLÉTER',

  // Numéro RCC (Registre des Codes-Créanciers).
  // ⚠️ TODO : optionnel, dépend du statut professionnel.
  rccNumber: '',

  // Entité juridique facturante
  company: 'AB Coaching Sàrl',

  // Coordonnées professionnelles
  // ⚠️ TODO : adresse de pratique exacte (cabinet ou siège société)
  address: {
    street: 'À COMPLÉTER',
    postalCode: 'À COMPLÉTER',
    city: 'À COMPLÉTER',
    country: 'Suisse',
  },
  email: 'À COMPLÉTER',
  phone: 'À COMPLÉTER',
  website: 'https://anissanutrition.ch',

  // Disclaimer juridique standard (apparait sur tous les documents
  // exportés et dans la bannière de l'app cliente).
  // Formulation prudente conforme au positionnement "accompagnement
  // nutritionnel fonctionnel supervisé" — pas dispositif médical.
  disclaimer:
    'Document de conseils nutritionnels personnalisés dans le cadre d\'un accompagnement bien-être et nutritionnel. Ne se substitue pas à un avis médical. En cas de symptômes persistants, de pathologie connue, de grossesse, d\'allaitement ou de traitement médical en cours, veuillez consulter votre médecin traitant.',

  // Disclaimer court (footer compact, app cliente)
  disclaimerShort:
    'Conseils nutritionnels — ne remplace pas un avis médical.',

  // Texte de validation affiché sur les documents et plans
  // (template, le SaaS injecte la date dynamique)
  validationLabel: 'Validé par',
};

/**
 * Construit la ligne de signature pour le pied de page d'un document.
 * Ex: "Anissa Deroubaix · Diététicienne ASDD · GLN 7601234567890"
 */
export function getPractitionerSignatureLine() {
  const p = PRACTITIONER_LEGAL_PROFILE;
  const parts = [p.name];
  if (p.title && !p.title.startsWith('À COMPLÉTER')) parts.push(p.title);
  if (p.gLNumber && !p.gLNumber.startsWith('À COMPLÉTER')) parts.push(`GLN ${p.gLNumber}`);
  return parts.join(' · ');
}

/**
 * Construit la bannière "Validé par X le DATE" pour app cliente.
 * @param {Date | string} validatedAt - date de validation du plan
 */
export function getValidationBanner(validatedAt) {
  const p = PRACTITIONER_LEGAL_PROFILE;
  const date = validatedAt instanceof Date ? validatedAt : new Date(validatedAt);
  const dateStr = date.toLocaleDateString('fr-CH', { day: '2-digit', month: 'long', year: 'numeric' });
  const titlePart = p.title.startsWith('À COMPLÉTER') ? '' : `, ${p.title}`;
  return `${p.validationLabel} ${p.name}${titlePart} · le ${dateStr}`;
}

/**
 * Vérifie si le profil est complet (utile en dev pour warning).
 * Retourne la liste des champs manquants.
 */
export function getMissingProfileFields() {
  const p = PRACTITIONER_LEGAL_PROFILE;
  const missing = [];
  if (p.title.startsWith('À COMPLÉTER')) missing.push('title');
  if (p.gLNumber.startsWith('À COMPLÉTER')) missing.push('gLNumber');
  if (p.address.street.startsWith('À COMPLÉTER')) missing.push('address.street');
  if (p.email.startsWith('À COMPLÉTER')) missing.push('email');
  if (p.phone.startsWith('À COMPLÉTER')) missing.push('phone');
  return missing;
}
