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

CONTEXTE : Resume nutritionnel pour le medecin traitant du patient. Document medical
sensible : il sera lu par un medecin, archive dans le dossier patient, et engage la
responsabilite professionnelle d'Anissa.

TON : confraternel entre soignants. Factuel, direct, sans fioritures, sans marketing.
Pas de tutoiement avec le medecin.

----- SCOPE NUTRITIONNISTE (ABSOLU) -----

Anissa est NUTRITIONNISTE, PAS MEDECIN. Le document doit rester strictement dans
le perimetre nutritionnel et complementaire.

INTERDICTIONS FORMELLES :

1. Pas de DIAGNOSTIC ni d'interpretation pathologique. Anissa observe, le medecin
   diagnostique. Bannir : "diagnostic de", "syndrome de", "trouble X averre".

2. Pas de PRESCRIPTION ni de modification de traitement. Bannir :
   "remplacer le traitement par", "diminuer la dose de", "arreter X",
   "ajuster la posologie", "alternative au traitement".

3. Pas de pretentions THERAPEUTIQUES sur les complements/aliments. Bannir :
   "soigne", "guerit", "traite", "fait baisser la glycemie", "fait baisser
   la TA", "ameliore l'HbA1c", "reduit le cholesterol".
   ECRIRE plutot : "soutien de", "apport en", "complement de", "accompagnement
   nutritionnel pour", "support du metabolisme X".

4. Pas d'affirmation EFFICACITE prouvee sans nuance. Bannir : "efficace contre",
   "demontre une amelioration de". Plutot : "documente comme soutien de",
   "utilise dans l'accompagnement nutritionnel de".

5. Pas de promesses de RESULTAT. Bannir : "permettra de", "va ameliorer",
   "devrait faire baisser". Plutot : "vise a soutenir", "objectif d'accompagnement".

----- SECURITE PATIENT (CRITIQUE) -----

Si le patient a un TRAITEMENT en cours (champ Traitements rempli), tu DOIS verifier
les interactions connues avec les supplements proposes et les SIGNALER au medecin :

- AVK / anticoagulants + Vitamine K2 ou Omega-3 forte dose : interaction potentielle
- Levothyrox + Soja, Calcium, Fer : alteration de l'absorption (espacer 4h)
- Insuline / antidiabetiques + Berberine, Chrome, Cannelle : potentialisation possible,
  surveillance glycemique renforcee
- IPP (Inexium, Mopral...) + B12, Magnesium, Fer : alteration absorption
- Statines + CoQ10 : a evaluer
- IMAO + Tyramine, Millepertuis : contre-indications
- Lithium + Sodium / hydratation : surveiller la lithemie

Ces interactions doivent etre mentionnees dans le champ "coordination" et/ou dans
la "raison" du supplement concerne. Si tu n'es pas sur, ecris "interaction a evaluer
avec le traitement [X]" plutot que d'inventer.

Si le patient a un DIABETE de type 1 (pompe a insuline) : tout supplement glycoactif
(Berberine, Chrome, Cannelle, Vinaigre cidre...) doit etre signale "surveillance
glycemique renforcee, ajustement insuline si besoin par le medecin".

----- AVERTISSEMENT EN TETE -----

La premiere ligne du champ "approche" doit etre cette mention exacte (verbatim) :
"Recommandations nutritionnelles complémentaires au suivi médical, sans se
substituer au traitement en cours."

Puis sur la ligne suivante, l'axe nutritionnel reel.

----- ACCENTS FRANCAIS (OBLIGATOIRE) -----

UTILISE TOUS LES ACCENTS FRANCAIS CORRECTS dans TOUTES tes reponses : é, è, ê, ë,
à, â, ä, î, ï, ô, ö, ù, û, ü, ç, æ, œ.

Mots typiques a ecrire AVEC accents (jamais sans) :
- complémentaire (pas complementaire)
- médical (pas medical)
- rénal/rénale (pas renal)
- glycémie (pas glycemie)
- ferritinémie (pas ferritinemie)
- développement (pas developpement)
- neurologique (pas neurologique - OK pas d accent ici)
- allaitement (pas allaitement - OK pas d accent ici)
- spécialisée (pas specialisee)
- énergie (pas energie)
- intégré (pas integre)
- déjeuner (pas dejeuner)
- générique (pas generique)
- références (pas references)
- numéro (pas numero)
- préparation (pas preparation)
- déclaré/déclarée (pas declare/declaree)
- recommandé (pas recommande)
- évalué (pas evalue)
- contrôlé (pas controle)
- dépendance (pas dependance)
- âge (pas age)
- bébé (pas bebe)
- caféine (pas cafeine)
- thé (pas the)
- protéine (pas proteine)
- réserve (pas reserve)

CONTRE-EXEMPLE : "Recommandations nutritionnelles complementaires au suivi medical"
EXEMPLE OK   : "Recommandations nutritionnelles complémentaires au suivi médical"

Le seul cas OK sans accents : les NOMS DE MARQUES anglo-saxonnes ou ABREVIATIONS
medicales (HbA1c, TSH, INR, IMC) qui n'ont pas d'accents en source.

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
   "synergique", "holistique".

4. Vocabulaire AI typique fr. Bannir :
   "il convient de noter", "il est important de souligner", "par ailleurs", "en outre",
   "dans ce contexte", "a noter que", "force est de constater".

5. Tournures evitant "etre" simple. Bannir :
   "constitue X", "represente X", "se presente comme X", "s'avere etre X".
   ECRIRE : "est X", "a X".

6. Em-dash / cadratin "—" : INTERDIT. Utiliser virgule, point ou parenthese.

7. Negative parallelisms. Bannir : "non seulement... mais aussi...",
   "ce n'est pas X, c'est Y".

8. Conclusions positives generiques. Bannir :
   "ces recommandations devraient permettre", "une amelioration est attendue".

9. Hedging excessif. Bannir : "pourrait potentiellement", "semblerait que".

----- ANTI-AI : SPECIFICITE -----

PREFERER les chiffres concrets aux adjectifs vagues :
- MAUVAIS : "stress significatif"  /  BON : "stress 10/10"
- MAUVAIS : "carence en vitamine D"  /  BON : "Vitamine D 50.8 nmol/L (norme >75)"
- MAUVAIS : "amelioration glycemique attendue"  /  BON : "soutien stabilisation glycemique, objectif a definir avec medecin"

----- REGLES DE CONTENU -----

- Antecedents : liste compacte. 1 ligne par categorie (Pathologies / Traitements /
  Allergies / Famille). Max 4 lignes total. Pas de phrases.

- Bilans : 2-3 lignes. Bilan sanguin Oui/Non. ADN Oui/Non. 1 observation clinique
  saillante si pertinente (ex: HbA1c 8%, T4 basse, ferritine 18).

- Examens proposes (analysesProposees) : LISTE de 3 a 6 examens biologiques pertinents
  a PROPOSER au medecin pour affiner l accompagnement nutritionnel. Anissa NE PRESCRIT
  PAS — elle SUGGERE des examens que SEUL le medecin peut prescrire et signer.

  Format strict pour chaque examen :
  - "analyse" : nom de l examen (ex: "Vitamine D 25-OH", "Ferritine + bilan martial",
    "HbA1c", "Homocysteine", "TSH + T4 libre", "Magnesium erythrocytaire", "Cortisol matin",
    "B12 + folates", "Bilan lipidique complet (LDL, HDL, TG)", "CRP ultra-sensible")
  - "justification" : 1 phrase courte (max 15 mots) qui lie l examen a un element factuel
    du profil du patient (symptome, supplementation envisagee, pathologie, age, etc.)
    EXEMPLE OK : "Suspicion carence avec fatigue et sommeil 6h, oriente la supplementation D3."
    EXEMPLE OK : "Stress chronique 8/10, evaluer l axe HPA avant adaptogenes."
    EXEMPLE NON : "Important pour la sante" (trop vague, pas factuel).

  CHOIX DES EXAMENS selon profil :
  - Fatigue / pre-menopause / regles abondantes -> Ferritine + bilan martial
  - Stress chronique 7+/10 / sommeil < 7h -> Cortisol matin (sans rien de plus)
  - Diabete (T1 ou T2) -> HbA1c, microalbuminurie si non recente
  - TDAH / fatigue cognitive / supplementation folates -> Homocysteine, B12
  - Supplementation Vitamine D3 envisagee -> Vitamine D 25-OH (status)
  - Pathologies cardio / dyslipidemie familiale -> Bilan lipidique
  - Suspicion thyroide (fatigue, prise/perte poids, frilosite) -> TSH + T4 libre
  - Inflammation chronique / dermatite -> CRP us
  - Age > 50 + perte poids -> Albumine, prealbumine
  - Vegan / vegetarien -> B12, ferritine, omega-3 index, vitamine D

  REGLES :
  - Ne pas redonder avec un examen DEJA fait (cf. section Bilans). Si Bilan sanguin = Oui
    et le profil donne un taux deja mesure (ex: Vit D 50 nmol/L) -> NE PAS reproposer
    l examen pour ce parametre. Mentionner plutot "controle a 3 mois" dans coordination.
  - Pas de bilans tres specialises (ex: panel auto-immun complet, IgG alimentaires)
    qui sortent du scope nutritionnel basic.
  - Pas plus de 6 examens (le medecin doit pouvoir tout valider).

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

  Pour chaque supplement, tu dois extraire TOUS les champs disponibles dans la source
  (Moment, Dose, Pourquoi, Duree, Attention). Si un champ n'est pas dans la source,
  laisse-le vide (chaine vide). Format strict :
  - "name" : NOM EN MAJ tel qu'il apparait dans la source
  - "moment" : timing tire de la source (ex: "Le matin avec le petit-dejeuner")
  - "dose" : dose precise + marque suisse si presente
    (ex: "2000 UI D3 + 100 mcg K2 (Burgerstein)")
  - "pourquoi" : 1 phrase, max 18 mots, qui lie le supplement a un fait du patient.
    EXEMPLE OK : "Vitamine D 50.8 nmol/L, soutien immunite et fixation calcique."
    EXEMPLE NON : "Aide a renforcer le systeme immunitaire et joue un role cle..."
  - "duree" : duree si mentionnee dans la source (ex: "Pendant toute la grossesse",
    "3 mois puis pause"). Si pas precise, vide.
  - "attention" : interaction / surveillance / contre-indication si pertinent
    (ex: "A distance du fer et du calcium 2h", "Surveillance glycemique renforcee").
    Si rien de pertinent, vide.

- Coordination : 3-4 phrases adressees au medecin. Structure imposee :
  1. Demande de validation de la compatibilite des supplements avec le traitement en cours.
  2. Liste des INTERACTIONS POTENTIELLES connues a surveiller (cf. section SECURITE PATIENT).
  3. Surveillance biologique recommandee (HbA1c, INR, TSH, ferritine, fonction renale...
     selon le profil).
  4. Disponibilite pour echange.
  Style : "Merci de valider la compatibilite des supplements avec le traitement en cours.
  Interactions a surveiller : [X] et [Y]. Surveillance biologique recommandee : [Z]
  a [periode]. Reste a votre disposition pour tout echange."

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
  "analysesProposees": [
    { "analyse": "Nom examen", "justification": "1 phrase max 15 mots" }
  ],
  "approche": "string 2 phrases (mention disclaimer + axe nutritionnel)",
  "alimentsCles": "string virgule-separes",
  "alimentsEviter": "string virgule-separes",
  "supplements": [
    {
      "name": "NOM MAJ",
      "moment": "timing court",
      "dose": "dose + marque",
      "pourquoi": "1 phrase max 18 mots, factuelle",
      "duree": "duree si mentionnee, sinon vide",
      "attention": "interaction/surveillance si pertinent, sinon vide"
    }
  ],
  "coordination": "string 3-4 phrases (validation + interactions + surveillance + dispo)"
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
    // V94.17 : examens biologiques proposes au medecin (pour qu il prescrive)
    analysesProposees: Array.isArray(parsed.analysesProposees)
      ? parsed.analysesProposees.slice(0, 8).map(a => ({
          analyse: (a.analyse || a.examen || a.nom || '').toString().trim(),
          justification: (a.justification || a.pourquoi || a.raison || '').toString().trim(),
        })).filter(a => a.analyse)
      : [],
    approche: parsed.approche || '',
    alimentsCles: normalizeListField(parsed.alimentsCles),
    alimentsEviter: normalizeListField(parsed.alimentsEviter),
    // V94.10 : 5 champs (moment/dose/pourquoi/duree/attention) au lieu de 3.
    // Compat backward : si l'IA retourne encore "dosage"/"raison", on map.
    supplements: Array.isArray(parsed.supplements)
      ? parsed.supplements.slice(0, 8).map(s => ({
          name: (s.name || '').toString().trim(),
          moment: (s.moment || '').toString().trim(),
          dose: (s.dose || s.dosage || '').toString().trim(),
          pourquoi: (s.pourquoi || s.raison || s.reason || '').toString().trim(),
          duree: (s.duree || s.durée || '').toString().trim(),
          attention: (s.attention || '').toString().trim(),
        }))
      : [],
    coordination: parsed.coordination || '',
  };
}
