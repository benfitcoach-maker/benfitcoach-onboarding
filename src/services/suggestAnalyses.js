// ─────────────────────────────────────────────────────────────────
// Phase B.1.a — Service IA suggestion d'analyses Ortho/MGD
// Date : 2026-05-09
//
// Role : a partir d'une anamnese pseudonymisee + pack achete + catalogue
// lab_tests, propose une liste de 3-5 analyses pertinentes avec
// justification clinique courte et score de pertinence.
//
// L'IA PROPOSE, Anissa DECIDE. Anissa coche/decoche dans la modale,
// puis valide pour creer un analysis_plan en BDD.
//
// Contraintes :
// - Pseudonymisation systematique avant envoi a Claude (jamais nom/email/phone)
// - Output JSON strict, valide via safeParseJson
// - Garde-fous prompt : pas de diagnostic, pas de medicament, pas plus de
//   50% du budget pack en analyses sauf justifie cliniquement
// ─────────────────────────────────────────────────────────────────

import { callClaude, safeParseJson, ClaudeApiError } from './anthropic';
import { PACK_DEFINITIONS } from './packSystem';

const MODEL = 'claude-sonnet-4-6';  // Sonnet pour qualite raisonnement clinique
const MAX_TOKENS = 2000;

/**
 * Pseudonymise une anamnese cliente pour l'envoi a Claude.
 * Retire toutes les donnees identifiantes (nom, email, phone, date de
 * naissance complete, adresse). Conserve le contenu clinique pertinent.
 */
export function pseudonymizeAnamnesis(client) {
  const form = client?.form || {};

  // Age range (privacy-preserving, 5-year bucket).
  // V97.11.9 : fallback sur form.age si dateNaissance manquante (le pre-q
  // V97.8.1 ne demande que l'age, pas la date de naissance complete).
  // Sinon l'algo voit age_range=null + anamnese.age="38" et signale une
  // incoherence injustifiee.
  const ageRange = (() => {
    const naissance = form.dateNaissance || form.date_naissance || null;
    let ageNow = null;
    if (naissance) {
      const birth = new Date(naissance);
      if (!isNaN(birth)) ageNow = new Date().getFullYear() - birth.getFullYear();
    }
    if (ageNow === null && form.age) {
      const n = parseInt(form.age, 10);
      if (!isNaN(n) && n > 0 && n < 130) ageNow = n;
    }
    if (ageNow === null) return null;
    const lo = Math.floor(ageNow / 5) * 5;
    return `${lo}-${lo + 4}`;
  })();

  // V97.11.8 : avant ce fix, on avait un mapping hardcode de 14 champs avec
  // des noms qui ne matchaient pas la vraie forme (sexe vs genre, digestion vs
  // ressentiDigestion, niveau_stress vs niveauStressActuel, etc.) — la plupart
  // des champs sortaient null. En plus, "form.grossesseActuelle = 'Non'" etait
  // truthy donc on construisait "trimestre undefined", d'ou l'alerte algo
  // "renseignes comme 'undefined'".
  //
  // Nouvelle approche : on envoie TOUT le form (filtre PII strict + filtre
  // valeurs vides) a l'IA. Aucun mapping a maintenir, robuste a tout nouveau
  // champ ajoute au formulaire SaaS.
  const PII_FIELDS = new Set([
    'prenom', 'nom', 'email', 'telephone', 'adresse',
    'dateNaissance', 'date_naissance', 'medecinTraitant',
  ]);

  const pseudoForm = {};
  for (const [key, value] of Object.entries(form)) {
    if (PII_FIELDS.has(key)) continue;
    if (value === '' || value === null || value === undefined) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    pseudoForm[key] = value;
  }

  return {
    client_pseudo_id: client?.id ? String(client.id).slice(0, 8) : 'C-anon',
    age_range: ageRange,
    anamnese: pseudoForm,
  };
}

/**
 * Build le system prompt pour l'IA suggestion d'analyses.
 */
function buildSystemPrompt() {
  return `Tu es l'assistant clinique d'Anissa Deroubaix, nutritionniste fonctionnelle a Nyon (Suisse).

Ta mission : analyser une anamnese pseudonymisee et proposer 0 a 3 analyses biologiques pertinentes parmi le catalogue Ortho-Analytic + MGD fourni.

Tu PROPOSES, Anissa DECIDE. Tu ne prescris jamais directement.

REGLE DE FOND : la pertinence prime sur le volume. Si l'anamnese ne justifie pas
d'analyse particuliere, propose-en aucune et explique pourquoi dans client_summary.
Mieux vaut 1 analyse vraiment pertinente que 5 qui ressemblent a un catalogue.

NOMBRE D'ANALYSES :
- 0 si l'anamnese ne justifie pas (rare, mais possible : profil clair, symptomes mineurs)
- 1-2 si terrain bien identifie avec axe clair
- 3 maximum si profil complexe avec plusieurs axes a explorer en parallele
- JAMAIS plus de 3, meme si pack premium

Pour chaque analyse proposee :
- Justification clinique courte (1 phrase, ancree dans l'anamnese)
- pertinence_score : 1-10 (mapping affichage cote UI : >=10 "Pertinence elevee",
  7-9 "Pertinence moderee", <=6 "Pertinence exploratoire")
- recommended_default : true pour les 2 plus prioritaires, false sinon

VOCABULAIRE OBLIGATOIRE (ton prudent juridiquement) :
- "compatible avec un terrain..."
- "tendance evoquant..."
- "contexte coherent avec..."
- "axe a explorer..."
- "hypothese fonctionnelle a investiguer..."
- "piste a creuser..."

VOCABULAIRE INTERDIT (impression diagnostique) :
- "detecte / indique / confirme / presence de"
- "suggere fortement une pathologie"
- "la cliente a [maladie]"
- "souffre de"
- nom de pathologie suivi de "diagnostique" ou "probable"

INTERDITS GENERAUX :
- Ne JAMAIS poser de diagnostic
- Ne JAMAIS recommander un medicament
- Ne JAMAIS inclure d'identifiant cliente dans la sortie
- Ne JAMAIS suggerer plus de 50% du budget pack en analyses sauf justifie cliniquement

CONTEXTE PACKS :
- Consultation Initiale (220 CHF) : aucune analyse incluse, juste recommandations pour eventuel suivi
- Suivi 3 mois (990 CHF) : 1 analyse incluse au choix
- Suivi 6 mois (1990 CHF) : bilan complet incluant sang + microbiome + metaux + ADN si pertinent

OUTPUT (JSON strict, AUCUN texte autour) :
{
  "client_summary": "Resume clinique en 1 phrase, vocabulaire prudent (ex: 'profil compatible avec terrain digestif fragilise, contexte coherent avec dysbiose post-antibiotique')",
  "suggestions": [
    {
      "lab_test_code": "ortho_mikroernaehrung",
      "justification": "Antecedent de carence ferrique + 6 ans pilule progestative -> axe carentiel a explorer",
      "pertinence_score": 9,
      "recommended_default": true
    }
  ],
  "alerts_anissa": [
    "Champs grossesse/allaitement renseignes 'undefined' -> a clarifier en consultation"
  ]
}`;
}

/**
 * Build le user prompt avec anamnese pseudonymisee + pack + catalogue.
 */
function buildUserPrompt({ anamnesisPseudo, packType, catalog }) {
  const pack = PACK_DEFINITIONS[packType];
  const packLabel = pack ? `${pack.label} (${pack.price} CHF)` : packType;

  const catalogText = catalog
    .filter(t => t.is_active !== false)
    .map(t => `- ${t.code} | ${t.display_name} | ${t.cost_anissa_chf} CHF | ${t.category} | ${t.description || ''}`)
    .join('\n');

  return `PACK ACHETE : ${packLabel}

ANAMNESE PSEUDONYMISEE (aucune donnee identifiante) :
${JSON.stringify(anamnesisPseudo, null, 2)}

CATALOGUE DISPONIBLE :
${catalogText}

Propose 0 a 3 analyses pertinentes parmi le catalogue ci-dessus, en JSON strict comme specifie dans le system prompt. Privilegie la pertinence au volume.`;
}

/**
 * Appelle Claude pour obtenir des suggestions d'analyses.
 *
 * @param {object} opts
 * @param {object} opts.client    - cliente (avec .form anamnese)
 * @param {string} opts.packType  - code pack (ex: 'suivi_3m_990')
 * @param {Array}  opts.catalog   - tableau de lab_tests depuis Supabase
 * @returns {Promise<object|null>} { client_summary, suggestions, alerts_anissa } ou null
 * @throws {ClaudeApiError} sur erreur HTTP/reseau
 */
export async function suggestAnalyses({ client, packType, catalog }) {
  if (!client) throw new Error('client requis');
  if (!packType) throw new Error('packType requis');
  if (!Array.isArray(catalog) || catalog.length === 0) {
    throw new Error('catalog vide ou invalide');
  }

  const anamnesisPseudo = pseudonymizeAnamnesis(client);
  const system = buildSystemPrompt();
  const user = buildUserPrompt({ anamnesisPseudo, packType, catalog });

  const result = await callClaude({
    system,
    user,
    model: MODEL,
    maxTokens: MAX_TOKENS,
    parseJson: true,
  });

  // Validation minimale du shape
  if (!result || !Array.isArray(result.suggestions)) {
    return null;
  }

  return result;
}

/**
 * Helper : enrichit les suggestions IA avec les details du catalogue
 * (display_name, cost_anissa_chf, category) pour affichage UI direct.
 *
 * Returns : tableau d'items prets pour la modale
 *   [{ code, display_name, cost_anissa_chf, category, justification, pertinence_score, recommended_default }, ...]
 */
export function enrichSuggestionsWithCatalog(suggestions, catalog) {
  if (!Array.isArray(suggestions)) return [];
  return suggestions
    .map(s => {
      const test = catalog.find(t => t.code === s.lab_test_code);
      if (!test) return null;
      return {
        code: test.code,
        display_name: test.display_name,
        cost_anissa_chf: test.cost_anissa_chf,
        category: test.category,
        source_lab: test.source_lab,
        justification: s.justification || '',
        pertinence_score: s.pertinence_score || 0,
        recommended_default: !!s.recommended_default,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.pertinence_score - a.pertinence_score);
}
