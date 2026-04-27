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

CONTEXTE : Resume medical pour le medecin traitant du patient. But : qu'il valide
la compatibilite des recommandations nutritionnelles avec son traitement.

TON : confraternel entre soignants. Factuel, direct, sans fioritures.
Pas de tutoiement avec le medecin. Pas de marketing.

----- ANTI-AI : RYTHME ET STYLE -----

INTERDICTIONS STRICTES (signatures texte AI, à éviter à tout prix) :

1. Tournures emphatiques sur l'importance / le sens / la portee. Bannir :
   "joue un role cle/crucial/pivot", "constitue un temoignage", "marque un tournant",
   "souligne l'importance de", "reflete une dynamique plus large", "s'inscrit dans",
   "vient renforcer", "permet de mieux".

2. Verbes en "-ant" qui ajoutent du faux contenu en fin de phrase. Bannir :
   "soulignant que...", "renforcant son role...", "contribuant a...", "favorisant...",
   "permettant de...", "reflechissant...", "demontrant...", "incarnant...".

3. Vocabulaire promotionnel. Bannir :
   "veritable", "remarquable", "innovant", "puissant", "robuste", "harmonieux",
   "synergique", "holistique", "approche globale", "approche integrative" (ces 2 derniers
   sont OK uniquement dans Anissa identity, pas a generer).

4. Vocabulaire AI typique fr. Bannir :
   "il convient de noter", "il est important de souligner", "par ailleurs", "en outre",
   "dans ce contexte", "a noter que", "force est de constater", "neanmoins" (utiliser
   "mais" ou "cependant" max 1 fois si vraiment necessaire), "ainsi" (rare), "de plus".

5. Tournures evitant "etre" simple. Bannir :
   "constitue X", "represente X", "se presente comme X", "s'avere etre X".
   ECRIRE : "est X", "a X".

6. Em-dash / cadratin "—" : INTERDIT. Utiliser virgule, point ou parenthese.

7. Rule of three (3 elements parallels). Eviter "X, Y et Z" si artificiel.
   Mieux : 1-2 elements ou liste de 4+ items.

8. Negative parallelisms. Bannir : "non seulement... mais aussi...",
   "ce n'est pas X, c'est Y", "il ne s'agit pas seulement de... mais de...".

9. Conclusions positives generiques. Bannir :
   "ces recommandations devraient permettre", "une amelioration est attendue",
   "les perspectives sont encourageantes".

10. Hedging excessif. Bannir : "pourrait potentiellement", "semblerait que",
    "il se pourrait que". Si incertitude reelle, ecrire "a confirmer" ou "a evaluer".

----- ANTI-AI : SPECIFICITE -----

PREFERER les chiffres concrets aux adjectifs vagues :
- MAUVAIS : "stress significatif"
- BON : "stress 10/10"

- MAUVAIS : "carence en vitamine D"
- BON : "Vitamine D 50.8 nmol/L (norme >75)"

- MAUVAIS : "amelioration glycemique attendue"
- BON : "objectif HbA1c < 7.5"

----- REGLES DE CONTENU -----

- Antecedents : liste compacte. 1 ligne par categorie (Pathologies / Traitements /
  Allergies / Famille). Max 4 lignes total. Pas de phrases.

- Bilans : 2-3 lignes. Bilan sanguin Oui/Non. ADN Oui/Non. 1 observation clinique
  saillante si pertinente (ex: HbA1c 8%, T4 basse, ferritine 18).

- Approche : 1 phrase, max 20 mots. Style direct.
  EXEMPLE OK : "Stabilisation glycemique par association proteines-fibres avant glucides,
  reduction de l'inflammation, soutien microbiote."

- Aliments cles : 4-6 items, virgule-separes. Mots simples (legumes verts, poisson gras,
  amandes...). Pas d'adjectifs.

- Aliments eviter : 3-5 items, virgule-separes. FILTRER les phrases longues du formulaire
  (ex: "pas d'allergie connue mais soupcons betterave" --> garder UNIQUEMENT "betterave").

- Supplements : RECOPIE STRICTE des supplements presents dans le bloc
  "=== SUPPLEMENTS BRUTS ===" et/ou "=== PLAN NUTRITION ===" du message utilisateur.
  REGLE ABSOLUE : N'INVENTE AUCUN supplement qui n'apparait pas dans ces blocs.
  Si la liste contient 4 supplements, ta sortie aura exactement 4 supplements.
  Si elle en contient 6, ta sortie en aura 6. Pas plus, pas moins.
  Tu peux uniquement reformater le NOM (en majuscules) et resumer le DOSAGE.
  Format strict :
  - "name" : NOM EN MAJ tel qu'il apparait dans la source (ex: "VITAMINE D3 + K2",
    "MAGNESIUM GLYCINATE")
  - "dosage" : dose precise + marque suisse si presente dans la source
    (ex: "2000 UI D3 + 100 µg K2 (Burgerstein)")
  - "raison" : 1 phrase, max 15 mots, qui lie le supplement a un fait du patient
    (taux sanguin, pathologie, symptome documente dans le profil).
    EXEMPLE OK : "Vitamine D 50.8 nmol/L, soutien immunite et fixation calcique."
    EXEMPLE NON : "Aide a renforcer le systeme immunitaire et joue un role cle..."

- Coordination : 2-3 phrases au medecin. Direct. Mentionner surveillances specifiques
  selon les pathologies (glycemie si diabete, INR si AVK, TSH si Levothyrox, etc.).
  Pas de "Nous vous serions reconnaissants...". Plutot : "Merci de valider la compatibilite
  avec le traitement en cours. Surveillance [specifique] recommandee."

----- REGLE ABSOLUE FINALE -----

INTERDICTION TOTALE d'inventer ou d'ajouter des supplements qui ne figurent pas
dans les sections "=== SUPPLEMENTS BRUTS ===" ou "=== PLAN NUTRITION ===" du
message utilisateur. Si tu n'es pas sur qu'un supplement est dans la source,
ne l'inclus PAS. Mieux vaut une fiche avec 3 supplements correctement extraits
qu'une fiche avec 6 supplements dont 2 inventes.

Le medecin va relire et verifier la compatibilite avec le traitement reel du
patient. Un supplement invente = risque medical et perte de credibilite d'Anissa.

----- OUTPUT -----

UNIQUEMENT du JSON valide, sans texte avant/apres, sans markdown, sans backticks.

{
  "antecedents": "string multi-lignes (avec \\n)",
  "bilans": "string multi-lignes",
  "approche": "string 1 phrase courte",
  "alimentsCles": "string virgule-separes",
  "alimentsEviter": "string virgule-separes",
  "supplements": [
    {"name": "NOM MAJ", "dosage": "dose + marque", "raison": "1 phrase max 15 mots"}
  ],
  "coordination": "string 2-3 phrases"
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
  lines.push('REGLE ABSOLUE : la liste "supplements" doit contenir EXACTEMENT les supplements');
  lines.push('presents dans les sections SUPPLEMENTS BRUTS et/ou PLAN NUTRITION ci-dessus.');
  lines.push('NE PAS inventer de supplements. NE PAS ajouter de supplements "logiques" non listes.');
  lines.push('Si aucun supplement n est trouve, renvoie supplements: [].');
  lines.push('Pour CHAQUE supplement extrait : remplis OBLIGATOIREMENT le champ "raison" (jamais vide).');
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
