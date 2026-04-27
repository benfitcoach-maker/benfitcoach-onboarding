// V94.5 : génération IA de la Fiche Médecin (résumé pour le médecin traitant).
// Pré-remplit antécédents, bilans, approche, aliments clés/éviter, suppléments
// avec raisons médicales personnalisées, et message de coordination ciblé.
//
// Le prompt est conçu pour produire un JSON strict directement utilisable par
// la modal MedicalSummary. L'IA génère des "raisons" courtes liant chaque
// supplément à la pathologie/situation du patient (au lieu des champs vides
// actuels causés par l'extraction regex bugguée).

import { ANISSA_IDENTITY_CORE } from './anissaIdentity';

const SYSTEM_PROMPT = `${ANISSA_IDENTITY_CORE}

CONTEXTE SPECIAL : Tu prepares un RESUME MEDICAL pour le medecin traitant du patient.
Le but : qu'il valide la compatibilite des recommandations nutritionnelles avec son traitement
(insuline, anticoagulants, levothyrox, etc.).

REGLES DE STYLE :
- Ton professionnel, factuel, concis (pas de tutoiement avec le medecin).
- Phrases courtes, pas de marketing, pas de tournures emotionnelles.
- Vocabulaire medical correct (HbA1c, dyslipidemie, etc.).
- Les "raisons" pour chaque supplement doivent etre 1 phrase courte (max 15 mots)
  liant le supplement au profil du patient (taux sanguin, pathologie, symptome).

REGLES DE CONTENU :
- Antecedents : factuel, liste des pathologies/traitements/allergies dans un format
  compact (3-4 lignes max). Pas de phrases longues.
- Bilans : mentionner si Bilan sanguin / Analyse ADN ont ete faits, plus 1-2 observations
  cliniques majeures si pertinentes.
- Approche : 1 phrase courte sur l'axe principal (ex: "Stabilisation glycemique par
  association proteines + fibres + reduction de l'inflammation systemique").
- Aliments cles : 4-6 items courts (mots/groupes de mots), pas de phrases.
- Aliments eviter : 3-5 items courts, FILTRER les phrases entieres du formulaire
  (ex: "pas d'allergie connue mais soupcons betterave" -> garder uniquement "betterave").
- Supplements : 5-6 max, format strict { name, dosage, raison }.
- Coordination : 2-3 phrases adressees au medecin, mentionnant les surveillances
  specifiques requises selon les pathologies (ex: glycemie post-repas si diabete).

OUTPUT : UNIQUEMENT du JSON valide, sans texte avant/apres, sans markdown, sans backticks.
Format strict :
{
  "antecedents": "string multi-lignes",
  "bilans": "string multi-lignes",
  "approche": "string 1 phrase",
  "alimentsCles": "string virgule-separes",
  "alimentsEviter": "string virgule-separes",
  "supplements": [
    {"name": "NOM EN MAJUSCULES", "dosage": "dose + marque si dispo", "raison": "1 phrase courte medicale"}
  ],
  "coordination": "string 2-3 phrases au medecin"
}`;

function buildUserMessage(form, consultation) {
  const lines = [];
  lines.push('=== PROFIL PATIENT ===');
  lines.push(`Prenom : ${form.prenom || '?'}`);
  if (form.nom) lines.push(`Nom : ${form.nom}`);
  if (form.age) lines.push(`Age : ${form.age} ans`);
  if (form.genre) lines.push(`Genre : ${form.genre}`);
  if (form.poids) lines.push(`Poids : ${form.poids} kg`);
  if (form.taille) lines.push(`Taille : ${form.taille} cm`);
  if (form.objectifPrincipalNutrition) lines.push(`Objectif : ${form.objectifPrincipalNutrition}`);

  lines.push('\n=== ANTECEDENTS ===');
  if (form.pathologies) lines.push(`Pathologies : ${form.pathologies}`);
  if (form.traitements) lines.push(`Traitements : ${form.traitements}`);
  if (form.allergies) lines.push(`Allergies : ${form.allergies}`);
  if (form.alimentsEvites) lines.push(`Aliments evites (declares) : ${form.alimentsEvites}`);
  if (form.antecedentsFamiliaux) lines.push(`Antecedents familiaux : ${form.antecedentsFamiliaux}`);

  lines.push('\n=== BILANS ===');
  lines.push(`Bilan sanguin fait : ${consultation.bloodTestDone || consultation.blood_test_done ? 'Oui' : 'Non'}`);
  lines.push(`Analyse ADN faite : ${consultation.dnaTestDone || consultation.dna_test_done ? 'Oui' : 'Non'}`);
  const obs = consultation.nutritionalObservations || consultation.nutritional_observations;
  if (obs) lines.push(`Observations : ${obs.substring(0, 500)}`);

  // Lab results si disponibles
  const lab = consultation.lab_results || consultation.labResults || {};
  const labEntries = Object.entries(lab).filter(([, v]) => v !== '' && v != null);
  if (labEntries.length) {
    lines.push('\n=== LAB RESULTS ===');
    for (const [k, v] of labEntries.slice(0, 30)) {
      lines.push(`${k} : ${v}`);
    }
  }

  lines.push('\n=== PLAN NUTRITION (extrait) ===');
  const plan = consultation.nutritionPlan || consultation.nutrition_plan || '';
  lines.push(plan.substring(0, 4000)); // limite pour rester sous le token budget

  lines.push('\n=== SUPPLEMENTS BRUTS ===');
  const supp = consultation.supplements || '';
  lines.push(supp.substring(0, 2000));

  lines.push('\n=== TACHE ===');
  lines.push('Genere le resume medical en JSON strict selon le format specifie.');
  lines.push('Pour CHAQUE supplement extrait du plan : remplis OBLIGATOIREMENT le champ "raison" (jamais vide).');
  lines.push('La raison doit lier le supplement a un element factuel du profil du patient.');

  return lines.join('\n');
}

function safeParseJson(text) {
  if (!text) throw new Error('Reponse IA vide');
  // Strip markdown fences si presentes
  let t = text.trim();
  t = t.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  // Tenter extraction du premier { ... } englobant
  const firstBrace = t.indexOf('{');
  const lastBrace = t.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    t = t.substring(firstBrace, lastBrace + 1);
  }
  try {
    return JSON.parse(t);
  } catch (e) {
    throw new Error(`JSON IA invalide : ${e.message}`);
  }
}

/**
 * Genere un resume medical via IA Claude Haiku.
 * @param {object} form - Donnees du formulaire client
 * @param {object} consultation - Donnees de la consultation (plan, supplements, lab, observations)
 * @returns {Promise<object>} - { antecedents, bilans, approche, alimentsCles, alimentsEviter, supplements[], coordination }
 */
export async function generateMedicalSummary(form, consultation) {
  const apiKey = localStorage.getItem('bfc_api_key') || '';
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers['x-fallback-key'] = apiKey;

  const userMessage = buildUserMessage(form || {}, consultation || {});

  const response = await fetch('/api/claude', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Erreur API : ${response.status}`);
  }

  const data = await response.json();
  const rawText = data.content?.[0]?.text?.trim() || '';
  const parsed = safeParseJson(rawText);

  // Normaliser : transformer arrays alimentsCles/Eviter en string si l'IA renvoie un array
  const normalizeListField = (val) => {
    if (Array.isArray(val)) return val.filter(Boolean).join(', ');
    return val || '';
  };

  return {
    antecedents: parsed.antecedents || '',
    bilans: parsed.bilans || '',
    approche: parsed.approche || '',
    alimentsCles: normalizeListField(parsed.alimentsCles),
    alimentsEviter: normalizeListField(parsed.alimentsEviter),
    supplements: Array.isArray(parsed.supplements)
      ? parsed.supplements.slice(0, 8).map(s => ({
          name: (s.name || '').toString().trim(),
          dosage: (s.dosage || '').toString().trim(),
          reason: (s.raison || s.reason || '').toString().trim(),
        }))
      : [],
    coordination: parsed.coordination || '',
  };
}
