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

  // Titre professionnel exact, factuel et défendable juridiquement.
  // Source : Diplôme Nutrition (200h, 150h présence + 50h étude perso),
  // École TCMA Genève (Thérapie Complémentaire et Médecine Alternative),
  // décerné le 1er juillet 2024.
  // Cadre légal : loi genevoise sur la santé K 1 03 + règlement K 3 02.03
  // (pratiques complémentaires).
  //
  // ⚠️ Choix juridique validé 2026-05-12 (cf. discussion strategique) :
  // - PAS "diététicienne" (titre fédéral protégé, non détenu)
  // - PAS "nutrition clinique" (sous-entend qualification médicale)
  // - PAS "thérapeute" / "diagnostic"
  // - PAS "nutritionniste fonctionnelle" seule (sur-vente potentielle si audit)
  //
  // Cette formulation est :
  //   - factuelle (correspond au diplôme)
  //   - traçable (l'école est nommée)
  //   - non médicale (pas de revendication réglementée)
  //   - compatible avec positionnement "copilote clinique supervisé"
  //
  // Variante branding marketing (PAS pour mentions légales PDF) :
  //   "Praticienne en nutrition · Approche fonctionnelle & bien-être"
  title: 'Praticienne en nutrition, École TCMA Genève',

  // Numéro GLN (Global Location Number, registre santé Suisse).
  gLNumber: '7601009595035',

  // Numéro RCC (Registre des Codes-Créanciers).
  // Optionnel, dépend du statut professionnel.
  rccNumber: '',

  // Entité juridique facturante
  company: 'AB Coaching Sàrl',

  // Coordonnées professionnelles (siège société / cabinet)
  address: {
    street: 'Rue de Rive 28',
    postalCode: '1260',
    city: 'Nyon',
    country: 'Suisse',
  },
  email: 'anissa.nutri@gmail.com',
  phone: '+41 76 621 02 05',
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
  if (!p.title || p.title.startsWith('À COMPLÉTER')) missing.push('title');
  if (!p.gLNumber || p.gLNumber.startsWith('À COMPLÉTER')) missing.push('gLNumber');
  if (!p.address?.street || p.address.street.startsWith('À COMPLÉTER')) missing.push('address.street');
  if (!p.email || p.email.startsWith('À COMPLÉTER')) missing.push('email');
  if (!p.phone || p.phone.startsWith('À COMPLÉTER')) missing.push('phone');
  return missing;
}
