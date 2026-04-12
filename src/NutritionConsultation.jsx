import { useState } from 'react';
import { getClient, getNutritionConsultations, savePlanVersion, getPlanVersions } from './store';
import { FORMULES } from './formSteps';
import NutritionTemplates from './NutritionTemplates';
import NutritionEditor from './NutritionEditor';
import FollowUpStep, { buildFollowupSummary } from './FollowUpStep';
import { exportConsultationPDF, exportFicheFrigoPDF, exportCoverPDF } from './nutritionPdf';
import { SmartTextarea } from './KeywordHints';
import ContraIndicationAlert, { detectContraIndications } from './ContraIndicationAlert';

const NUTRITION_SYSTEM_PROMPT = `Tu es un expert en nutrition clinique, nutrigenomique et medecine fonctionnelle. Tu assistes Anissa Deroubaix, nutritionniste specialisee en biohacking et genetique chez Benfitcoach a Nyon, Suisse.

TES REFERENCES SCIENTIFIQUES ET PHILOSOPHIQUES (INTERNES UNIQUEMENT) :
- Medecine fonctionnelle : alimentation vivante, anti-inflammatoire, respect du terrain biologique
- Microbiote intestinal : protection de la barriere intestinale, reduction des lectines, polyphenols, alimentation favorable au microbiome
- Genetique et nutrigenomique : nutrition basee sur le profil genetique individuel, polymorphismes, methylation, detoxification hepatique
- Protection de la peau et anti-age : nutrition anti-oxydante, collagene, protection contre le vieillissement cutane
- Biohacking et optimisation : optimisation des performances via la nutrition, supplementation ciblee basee sur les genes MTHFR, detox, energie cellulaire

MARQUES DE COMPLEMENTS SUISSES DE CONFIANCE (REFERENCES INTERNES) :
- Burgerstein : LA reference suisse en pharmacie. Magnesium, omega-3, fer, vitamines, probiotiques. Disponible en pharmacie.
- Pure Encapsulations : Qualite professionnelle, sans additifs. Pour les clients premium.
- Nahrin : Fabrication suisse, bon rapport qualite/prix. Multivitamines, omega-3, curcuma.
- Sekoya : Marque suisse naturopathie. Specialisee sante digestive et mobilite.
Quand tu recommandes un complement, mentionne le dosage precis et la marque recommandee entre parentheses. Exemple : "Magnesium bisglycinate 300mg au coucher (disponible en pharmacie, ex: Burgerstein ou Pure Encapsulations)"

BIBLIOTHEQUE DES COMPLEMENTS — REGLES ABSOLUES POUR LES RECOMMANDATIONS :
Tu dois IMPERATIVEMENT respecter les regles suivantes quand tu recommandes des supplements. Ces regles viennent de la bibliotheque de complements Benfitcoach et garantissent l'efficacite et la securite.

1. MOMENT DE PRISE EXACT — Tu DOIS indiquer le moment precis pour chaque supplement :
   - Fer (bisglycinate) : MATIN A JEUN (30 min avant petit-dej), avec vitamine C
   - Probiotiques : MATIN A JEUN (20-30 min avant petit-dej), JAMAIS avec boissons chaudes
   - L-Glutamine, NAC : MATIN A JEUN
   - Vitamine D3 + K2 : MATIN avec petit-dej contenant du gras
   - Complexe B, B12, Folates : MATIN avec petit-dej (JAMAIS le soir — stimulant)
   - Selenium, Iode : MATIN avec petit-dej
   - CoQ10 : MATIN ou MIDI avec repas gras (JAMAIS le soir — stimulant)
   - Rhodiola : MATIN (JAMAIS le soir — insomnie)
   - Resveratrol, Collagene : MATIN
   - Omega-3 : MIDI ou SOIR avec repas le plus gras (absorption x3)
   - Curcuma + Piperine : MIDI avec repas gras
   - Chrome : MIDI avec repas contenant glucides
   - GLA, Enzymes digestives : Au DEBUT de chaque repas principal
   - Zinc : SOIR avec repas proteine
   - Calcium : fractionner MIDI + SOIR avec repas
   - Magnesium (bisglycinate) : COUCHER (effet relaxant)
   - Ashwagandha : COUCHER (effet relaxant)
   - Melatonine : 30-60 min AVANT coucher
   - L-Theanine : SOIR (ou journee si focus calme)
   - Psyllium : COUCHER (transit) ou 30 min avant repas (satiete)

2. BONNES COMBINAISONS — Tu DOIS toujours les associer si applicable :
   - Vitamine D3 + K2 + Magnesium (LE TRIO D'OR — jamais D3 seule)
   - Fer + Vitamine C (absorption x6)
   - Curcuma + Piperine + repas gras (absorption x2000)
   - Collagene + Vitamine C (synthese collagene)
   - Calcium + D3 + K2 (TOUJOURS — D3 absorbe, K2 dirige vers os)
   - Probiotiques a JEUN (survie bacterienne)
   - B12 + Folates (methylation)
   - Zinc + proteines (absorption)
   - Omega-3 + repas gras (absorption x3)

3. MAUVAISES COMBINAISONS — JAMAIS dans tes recommandations :
   - JAMAIS Fer avec Cafe, The, Calcium, Magnesium, Zinc (espacement 2h MINIMUM)
   - JAMAIS Fer avec produits laitiers ou IPP
   - JAMAIS Fer sans analyse de ferritine prealable
   - JAMAIS Calcium et Magnesium en meme temps (espacement 2h)
   - JAMAIS Zinc longue duree (>8 sem, >30mg/j) sans ajout de Cuivre 1-2mg
   - JAMAIS Levothyroxine avec Calcium, Fer, Cafe, Soja (espacement 4h)
   - JAMAIS Probiotiques avec boissons chaudes (destruction des bacteries)
   - JAMAIS Probiotiques en meme temps que des antibiotiques (ecart 2h)
   - JAMAIS CoQ10 le soir (stimulant — trouble du sommeil)
   - JAMAIS Complexe B ni B12 le soir (stimulant)
   - JAMAIS Rhodiola le soir (insomnie)
   - JAMAIS Vitamine C haute dose en meme temps que B12 (degradation)
   - JAMAIS Curcuma, Omega-3 haute dose, GLA, Resveratrol avec anticoagulants sans avis medecin
   - JAMAIS Ashwagandha si hyperthyroidie, grossesse, maladie auto-immune thyroidienne
   - JAMAIS Melatonine > 8 semaines en continu

4. TABLEAU HORAIRE PERSONNALISE OBLIGATOIRE :
A la fin de la section SUPPLEMENTS, tu DOIS generer un tableau horaire personnalise pour le client, au format :

TABLEAU HORAIRE PERSONNALISE
- MATIN A JEUN : [liste des supplements a prendre a jeun pour ce client]
- MATIN AVEC PETIT-DEJ : [liste]
- MIDI AVEC REPAS : [liste]
- SOIR AVEC REPAS : [liste]
- COUCHER : [liste]

5. MARQUES SUISSES — Tu DOIS toujours citer au moins une marque suisse entre parentheses :
   - Burgerstein (reference pharmacie)
   - Pure Encapsulations (qualite pro)
   - Nahrin (suisse, rapport qualite/prix)
   - Sekoya (naturopathie suisse, digestif/mobilite)

6. ALTERNATIVE NATURELLE EN PREMIER — TOUJOURS :
   Pour CHAQUE supplement recommande, tu DOIS d'abord proposer la source alimentaire naturelle (aliments + quantites), PUIS le complement en option si l'apport alimentaire est insuffisant. Ne jamais imposer le complement.

REGLE ABSOLUE — ALTERNATIVES NATURELLES EN PREMIER :
Tu dois TOUJOURS proposer d'abord l'alternative naturelle alimentaire, PUIS le complement en option :
- "Privilegiez les sources naturelles : graines de courge, amandes, chocolat noir 85% pour le magnesium"
- "Si l'apport alimentaire est insuffisant, un complement peut etre envisage : Magnesium bisglycinate 300mg (Burgerstein)"
- Ne jamais imposer les complements — toujours les presenter comme une option complementaire.

TON ROLE : Generer un plan nutrition personnalise base sur les observations d'Anissa. Tu ne poses pas de questions — tu generes directement le plan a partir des donnees fournies.

STRUCTURE DU PLAN NUTRITION A GENERER :

1. ANALYSE DU PROFIL
- Resume des besoins caloriques estimes (formule Mifflin-St Jeor ajustee)
- Repartition macronutriments recommandee (proteines, glucides, lipides en g et %)
- Ajustements bases sur les observations genetiques si disponibles
- Points d'attention microbiote intestinal
- Prise en compte du metabolisme, du stress, du sommeil et du mode de vie

2. PRINCIPES NUTRITIONNELS PERSONNALISES
- Approche anti-inflammatoire adaptee au profil
- Aliments a privilegier pour le microbiote
- Ajustements genetiques si ADN effectue
- Nutriments cles pour la peau et le vieillissement
- Optimisations biohacking si pertinent
- Ajustements selon le profil metabolique (glycemie, energie, fringales)

3. PLAN ALIMENTAIRE SUR 4 SEMAINES
Le plan doit couvrir 4 semaines avec variete pour eviter la lassitude :

SEMAINE 1 — Phase d'adaptation :
- Repas simples, introduction progressive des changements
- Menus du lundi au dimanche (petit-dejeuner, dejeuner, diner + collations si necessaire)
- Focus sur les aliments vivants, non transformes, riches en enzymes
- Liste de courses semaine 1

SEMAINE 2 — Rotation des recettes :
- Nouvelles recettes, variete des proteines et legumes
- Menus du lundi au dimanche
- Liste de courses semaine 2

SEMAINE 3 — Progression :
- Ajustement des portions, introduction d'aliments plus specifiques
- Menus du lundi au dimanche
- Liste de courses semaine 3

SEMAINE 4 — Consolidation :
- Repas optimises, routine installee
- Menus du lundi au dimanche
- Liste de courses semaine 4

Chaque repas inclut : aliments, quantites approximatives, macros estimes.

4. AJUSTEMENTS JOURS D'ENTRAINEMENT vs REPOS
- Jour d'entrainement : augmentation glucides pre/post workout
- Jour de repos : reduction glucides, maintien proteines, focus recuperation

5. OPTIMISATION BASEE SUR LES OBSERVATIONS
- Si carences identifiees : aliments riches en nutriments manquants
- Si sensibilite glucides : alternatives low-glycemic index
- Si problemes intestinaux : protocole microbiote
- Si profil MTHFR identifie : folates methyles, B12 methylcobalamine
- Si vieillissement cutane : antioxydants, vitamine C, collagene
- Si stress eleve : aliments riches en magnesium, adaptogenes naturels
- Si troubles du sommeil : aliments favorisant la melatonine, routine du soir

6. CONSEILS PRATIQUES
- Timing des repas par rapport aux entrainements
- Hydratation quotidienne recommandee
- Astuces meal prep pour la semaine
- Aliments a privilegier et a limiter
- Fenetre alimentaire si pertinent (jeune intermittent)

7. NOTES POUR LE COACH (Benoit)
- Points d'attention pour le programme sportif
- Aliments a eviter avant/apres l'entrainement
- Signes a surveiller chez le client
- Ajustements sport recommandes en lien avec la nutrition

REGLES :
- Systeme metrique (grammes, ml, kg)
- Prix et disponibilite adaptes a la Suisse
- Privilegie les aliments de saison, locaux, biologiques
- Respecte TOUJOURS les allergies et intolerances
- Ne prescris JAMAIS de medicaments — uniquement des supplements nutritionnels
- Si les donnees sont insuffisantes, genere un plan basique et indique ce qui manque
- Langue : francais, ton professionnel mais accessible
- Ne mentionne AUCUNE valeur medicale brute (conformite nLPD Suisse)
- Ne JAMAIS citer ni mentionner les noms des references dans le plan genere. Utilise leurs approches et methodologies sans les nommer. Le plan doit sembler venir de l'expertise d'Anissa, pas d'une compilation de sources.`;

const SUPPLEMENTS_INSTRUCTION = `Genere SEPAREMENT la section SUPPLEMENTS RECOMMANDES en respectant IMPERATIVEMENT la bibliotheque de complements Benfitcoach :

SUPPLEMENTS RECOMMANDES

REGLE ABSOLUE 1 — ALTERNATIVE NATURELLE EN PREMIER : Pour chaque nutriment, propose TOUJOURS en premier les sources alimentaires naturelles, PUIS le complement en option.

REGLE ABSOLUE 2 — MOMENT DE PRISE EXACT : Pour chaque supplement, tu DOIS indiquer le moment precis (matin a jeun, matin avec petit-dej, midi, soir, coucher) en suivant la bibliotheque.

REGLE ABSOLUE 3 — BONNES COMBINAISONS : Respecte les associations obligatoires :
- Vitamine D3 + K2 + Magnesium (trio d'or)
- Fer + Vitamine C
- Curcuma + Piperine + repas gras
- Collagene + Vitamine C
- Calcium + D3 + K2
- Probiotiques a jeun

REGLE ABSOLUE 4 — MAUVAISES COMBINAISONS INTERDITES :
- JAMAIS Fer avec Cafe/The/Calcium/Magnesium/Zinc (espacement 2h min)
- JAMAIS Calcium + Magnesium en meme temps (espacement 2h)
- JAMAIS Zinc longue duree sans Cuivre
- JAMAIS Levothyroxine avec Calcium/Fer/Cafe/Soja (espacement 4h)
- JAMAIS Probiotiques avec boissons chaudes
- JAMAIS CoQ10, B-Complexe, B12, Rhodiola le soir

Pour chaque supplement, inclus :
1. Source naturelle alimentaire a privilegier (aliments, quantites)
2. Si l'apport alimentaire est insuffisant : complement recommande avec dosage precis, MOMENT DE PRISE, forme biodisponible, et marque suisse entre parentheses
3. Justification basee sur les observations du client
4. Interactions a eviter si pertinentes

Marques suisses a recommander :
- Burgerstein (pharmacie, reference suisse)
- Pure Encapsulations (qualite professionnelle, sans additifs)
- Nahrin (fabrication suisse, bon rapport qualite/prix)
- Sekoya (naturopathie suisse, digestif et mobilite)

Format exemple :
"MAGNESIUM
- Sources naturelles : graines de courge (150g = 260mg), amandes, chocolat noir 85%, epinards
- Si insuffisant : Magnesium bisglycinate 300mg AU COUCHER avec un peu d'eau (Burgerstein ou Pure Encapsulations). Forme bisglycinate = mieux absorbee et non laxative.
- Attention : ne pas prendre en meme temps que calcium, fer ou zinc (espacement 2h)."

TABLEAU HORAIRE PERSONNALISE (OBLIGATOIRE a la fin de la section) :
Apres avoir liste tous les supplements, termine IMPERATIVEMENT par un tableau horaire personnalise au format exact :

TABLEAU HORAIRE PERSONNALISE
- MATIN A JEUN : [liste des supplements a prendre a jeun]
- MATIN AVEC PETIT-DEJ : [liste]
- MIDI AVEC REPAS : [liste]
- SOIR AVEC REPAS : [liste]
- COUCHER : [liste]

Ecris uniquement cette section, sans prefixe ni marqueur.`;

const INITIAL_CONSULTATION = {
  observations: '',
  blood_test_done: false,
  dna_test_done: false,
  nutritional_observations: '',
  nutrition_plan: '',
  supplements: '',
  recipes: '',
  notes_for_coach: '',
  private_notes: '',
  fiche_frigo_json: null,
};

const INITIAL_FOLLOWUP = {
  etat_global: '',
  energie: '',
  sommeil: '',
  digestion: '',
  stress: '',
  douleurs: '',
  adherence_plan: '',
  changements_succes: '',
  difficultes: '',
  supplements_pris: '',
  supplements_raison: '',
  poids_actuel: '',
  tour_taille: '',
  tour_hanche: '',
  tour_bras: '',
  tour_cuisse: '',
  masse_grasse: '',
  nouveau_bilan: '',
  nouveau_adn: '',
  observations_progression: '',
  points_ameliorer: '',
  objectifs_prochains: '',
};

function formatDate(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function NutritionConsultation({ clientId, apiKey, onSave, onCancel, initialConsultation }) {
  const client = getClient(clientId);
  const form = client?.form || {};
  const formule = FORMULES[client?.formule] || {};

  // Detect returning client
  const existingConsultations = getNutritionConsultations(clientId);
  const isFollowup = !initialConsultation && existingConsultations.length > 0;
  const previousConsultation = isFollowup ? existingConsultations[0] : null;

  // Steps differ based on followup status
  const stepLabels = isFollowup
    ? ['Resume client', 'Suivi & Progression', 'Plan nutrition', 'Notes pour Benoit']
    : ['Resume client', 'Plan nutrition', 'Notes pour Benoit'];

  const totalSteps = stepLabels.length;

  const [step, setStep] = useState(() => {
    if (initialConsultation?.nutrition_plan) return isFollowup ? 3 : 2;
    return 1;
  });
  const [consultation, setConsultation] = useState(() => {
    if (initialConsultation) {
      return {
        observations: initialConsultation.observations || '',
        blood_test_done: initialConsultation.bloodTestDone || initialConsultation.blood_test_done || false,
        dna_test_done: initialConsultation.dnaTestDone || initialConsultation.dna_test_done || false,
        nutritional_observations: initialConsultation.nutritionalObservations || initialConsultation.nutritional_observations || '',
        nutrition_plan: initialConsultation.nutritionPlan || initialConsultation.nutrition_plan || '',
        supplements: initialConsultation.supplements || '',
        recipes: initialConsultation.recipes || '',
        notes_for_coach: initialConsultation.notesForCoach || initialConsultation.notes_for_coach || '',
        private_notes: initialConsultation.privateNotes || initialConsultation.private_notes || '',
        fiche_frigo_json: initialConsultation.ficheFrigoJson || initialConsultation.fiche_frigo_json || null,
      };
    }
    // Pre-fill observations from questionnaire data
    const c = { ...INITIAL_CONSULTATION };
    const f = client?.form || {};

    // Build observations from profile data
    const profileParts = [
      f.genre && `Genre : ${f.genre}`,
      f.age && `Age : ${f.age} ans`,
      f.poids && `Poids : ${f.poids} kg`,
      f.taille && `Taille : ${f.taille} cm`,
      f.profession && `Profession : ${f.profession}`,
      f.heuresSommeil && `Sommeil : ${f.heuresSommeil}/5`,
      f.niveauStressActuel && `Stress : ${f.niveauStressActuel}/5`,
      f.energieJournee && `Energie : ${f.energieJournee}/5`,
    ].filter(Boolean);
    if (profileParts.length > 0) c.observations = profileParts.join('\n');

    // Build nutritional observations from diet/health data
    const nutriParts = [
      f.nbRepas && `Repas/jour : ${f.nbRepas}`,
      f.hydratation && `Hydratation : ${f.hydratation}`,
      f.alimentsEvites && `Aliments evites : ${f.alimentsEvites}`,
      f.frequenceBallonnements && `Digestion : ${f.frequenceBallonnements}/5`,
      f.pathologies && `Pathologies : ${f.pathologies}`,
      f.traitements && `Traitements : ${f.traitements}`,
      f.allergies && `Allergies : ${f.allergies}`,
    ].filter(Boolean);
    if (nutriParts.length > 0) c.nutritional_observations = nutriParts.join('\n');

    return c;
  });
  const [followupData, setFollowupData] = useState(() => {
    if (initialConsultation?.followupData) return { ...INITIAL_FOLLOWUP, ...initialConsultation.followupData };
    return { ...INITIAL_FOLLOWUP };
  });
  const [consultationId] = useState(initialConsultation?.id || null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);
  const [pendingAlerts, setPendingAlerts] = useState(null);
  const [planVersions, setPlanVersions] = useState(() => getPlanVersions(clientId));
  const [showVersions, setShowVersions] = useState(false);

  const updateField = (field, value) => {
    setConsultation(prev => ({ ...prev, [field]: value }));
  };

  // Map step index to content type based on followup
  const getStepType = (s) => {
    if (isFollowup) {
      const map = { 1: 'summary', 2: 'followup', 3: 'plan', 4: 'notes' };
      return map[s];
    }
    const map = { 1: 'summary', 2: 'plan', 3: 'notes' };
    return map[s];
  };

  const currentStepType = getStepType(step);

  const buildUserMessage = () => {
    const nr = 'Non renseigne';

    const parts = [
      `Voici les donnees completes du client (13 etapes d'anamnese) :`,
      ``,
      `--- ETAPE 1 : IDENTITE ---`,
      `- Nom : ${[form.prenom, form.nom].filter(Boolean).join(' ') || nr}`,
      `- Age : ${form.age ? `${form.age} ans` : nr}`,
      `- Genre : ${form.genre || nr}`,
      `- Poids : ${form.poids ? `${form.poids} kg` : nr}`,
      `- Taille : ${form.taille ? `${form.taille} cm` : nr}`,
      form.tourTaille ? `- Tour de taille : ${form.tourTaille} cm` : '',
      form.tourHanche ? `- Tour de hanche : ${form.tourHanche} cm` : '',
      form.tourPoitrine ? `- Tour de poitrine : ${form.tourPoitrine} cm` : '',
      form.tourBras ? `- Tour de bras : ${form.tourBras} cm` : '',
      form.tourCuisse ? `- Tour de cuisse : ${form.tourCuisse} cm` : '',
      form.masseGrasse ? `- Masse grasse : ${form.masseGrasse} %` : '',
      form.masseMusculaire ? `- Masse musculaire : ${form.masseMusculaire} %` : '',
      `- Profession : ${form.profession || nr}`,
      `- Email : ${form.email || nr}`,
      `- Telephone : ${form.telephone || nr}`,
      `- Formule : ${formule.nom || (client?.categorie === 'nutrition' ? 'Client nutrition' : nr)}`,
      ``,
      `--- ETAPE 2 : ANTECEDENTS MEDICAUX ---`,
      `- Pathologies : ${form.pathologies || nr}`,
      `- Operations : ${form.operations || nr}`,
      `- Traitements / medicaments : ${form.traitements || nr}`,
      `- Antecedents familiaux : ${form.antecedentsFamiliaux || nr}`,
      `- Allergies : ${form.allergies || 'Aucune'}`,
      ``,
      `--- ETAPE 3 : ALIMENTATION ---`,
      `- Nombre de repas/jour : ${form.nbRepas || nr}`,
      `- Hydratation : ${form.hydratation || nr}`,
      `- Aliments evites / intolerances : ${form.alimentsEvites || nr}`,
      `- Regimes suivis : ${form.regimesSuivis || nr}`,
      `- Mastication / grignotages : ${form.mastication || nr}`,
      ``,
      `--- ETAPE 4 : SANTE ---`,
      `- Blessures : ${form.blessures || 'Aucune'}`,
      `- Douleurs actuelles : ${form.douleursActuelles || nr}`,
      `- Contraception : ${form.contraception || nr}`,
      `- Cycle : ${form.cycleDuree || nr}`,
      `- SPM : ${form.spm || nr}`,
      `- Douleurs menstruelles : ${form.douleursMenstruelles || nr}`,
      `- Projet grossesse : ${form.projetGrossesse || nr}`,
      ``,
      `--- ETAPE 5 : SPORT & PERFORMANCE ---`,
      `- Type de sport : ${form.typeSport || nr}`,
      `- Frequence : ${form.frequenceSport || nr}`,
      `- Objectif sportif : ${form.objectifSport || nr}`,
      `- Recuperation : ${form.recuperation || nr}`,
      `- Supplements actuels : ${form.supplements || nr}`,
      `- Digestif a l'effort : ${form.digestifEffort || nr}`,
      ``,
      `--- ETAPE 6 : METABOLISME & ENERGIE ---`,
      `- Energie au cours de la journee : ${form.energieJournee || nr}`,
      `- Fringales / envies de sucre : ${form.fringalesSucre || nr}`,
      `- Variations de glycemie : ${form.variationsGlycemie || nr}`,
      `- Reaction apres repas riche en glucides : ${form.reactionGlucides || nr}`,
      ``,
      `--- ETAPE 7 : DIGESTION & MICROBIOTE ---`,
      `- Frequence ballonnements : ${form.frequenceBallonnements || nr}`,
      `- Type de transit : ${form.transitType || nr}`,
      `- Aliments problematiques : ${form.alimentsProblematiques || nr}`,
      `- Consommation reguliere : ${(form.consommationReguliere || []).length > 0 ? form.consommationReguliere.join(', ') : nr}`,
      ``,
      `--- ETAPE 8 : INFLAMMATION & IMMUNITE ---`,
      `- Douleurs articulaires / inflammations : ${form.douleursInflammations || nr}`,
      `- Frequence maladies : ${form.frequenceMaladies || nr}`,
      `- Troubles de peau : ${form.troublesPeau || nr}`,
      ``,
      `--- ETAPE 9 : STRESS & SYSTEME NERVEUX ---`,
      `- Niveau de stress actuel : ${form.niveauStressActuel ? `${form.niveauStressActuel}/10` : nr}`,
      `- Difficultes d'endormissement : ${form.difficultesEndormissement || nr}`,
      `- Reveils nocturnes : ${form.reveilsNocturnes || nr}`,
      `- Etat au reveil : ${form.etatReveil || nr}`,
      ``,
      `--- ETAPE 10 : MODE DE VIE & BIOHACKING ---`,
      `- Temps a l'exterieur (lumiere naturelle) : ${form.tempsExterieur || nr}`,
      `- Heures de sommeil en moyenne : ${form.heuresSommeil ? `${form.heuresSommeil}h` : nr}`,
      `- Exposition ecrans le soir : ${form.expositionEcransSoir || nr}`,
      `- Type de profession : ${form.professionType || nr}`,
      `- Alcool : ${form.alcool || nr}`,
      `- Tabac : ${form.tabac || nr}`,
      ``,
      `--- ETAPE 11 : GENETIQUE & DONNEES ---`,
      `- Analyses biologiques recentes : ${form.analysesBiologiques || nr}`,
      `- Test ADN nutrigenetique : ${form.testADN || nr}`,
      `- Tests genetiques connus (MTHFR, APOE, etc.) : ${form.testsGenetiques || nr}`,
      `- Pret pour analyses avancees : ${form.pretAnalysesAvancees || nr}`,
      ``,
      `--- ETAPE 12 : OBJECTIFS & ENGAGEMENT ---`,
      `- Objectif principal : ${form.objectifPrincipalNutrition || nr}`,
      `- Duree du probleme : ${form.dureeProbleme || nr}`,
      `- Deja essaye : ${form.dejaEssaye || nr}`,
      `- Pret pour protocole personnalise : ${form.pretProtocole || nr}`,
      ``,
      `--- OBSERVATIONS DE LA NUTRITIONNISTE ---`,
      `- Observations generales : ${consultation.observations || nr}`,
      `- Bilan sanguin effectue : ${consultation.blood_test_done ? 'Oui' : 'Non'}`,
      `- Analyse ADN effectuee : ${consultation.dna_test_done ? 'Oui' : 'Non'}`,
      `- Observations nutritionnelles : ${consultation.nutritional_observations || nr}`,
    ];

    // Add followup data for returning clients
    if (isFollowup && previousConsultation) {
      parts.push('');
      parts.push(buildFollowupSummary(followupData, previousConsultation, form));

      // Add previous plan summary
      if (previousConsultation.nutritionPlan) {
        const planLines = previousConsultation.nutritionPlan.split('\n').slice(0, 30);
        parts.push('');
        parts.push('--- RESUME DU PLAN PRECEDENT ---');
        parts.push(planLines.join('\n'));
        parts.push('...(plan complet non inclus pour brievete)');
      }
      if (previousConsultation.supplements) {
        parts.push('');
        parts.push('--- SUPPLEMENTS PRECEDEMMENT RECOMMANDES ---');
        parts.push(previousConsultation.supplements.split('\n').slice(0, 15).join('\n'));
      }

      parts.push('');
      parts.push(`INSTRUCTION IMPORTANTE : Le client revient pour un suivi. Adapte le plan en tenant compte de sa progression, de ce qui a fonctionne et de ce qui n'a pas fonctionne. Ajuste les recommandations en consequence. Si le client a perdu du poids, adapte les calories. Si le sommeil s'est ameliore, maintiens les recommandations. Si la digestion est degradee, renforce le protocole digestif. Renforce ce qui marche, corrige ce qui ne marche pas, et adapte les objectifs.`);
    }

    parts.push('');
    parts.push(`Genere un plan nutrition personnalise complet sur 4 semaines avec variete, listes de courses, et alternatives naturelles avant les complements.`);

    return parts.join('\n');
  };

  const handleGenerate = async () => {
    if (!apiKey?.trim()) {
      setGenError('Cle API Anthropic requise.');
      return;
    }

    // Validation des champs critiques (securite client)
    const missing = [];
    if (!form.allergies || !form.allergies.toString().trim()) missing.push('allergies / intolerances');
    const hasMeds = (form.traitements && form.traitements.toString().trim()) || (form.medicaments && form.medicaments.toString().trim());
    const hasPath = form.pathologies && form.pathologies.toString().trim();
    if (!hasMeds && !hasPath) missing.push('medicaments / pathologies');
    if (missing.length > 0) {
      const msg = `Champs critiques non renseignes : ${missing.join(' et ')}.\n\nGenerer sans ces informations peut etre dangereux (interactions, contre-indications).\n\nContinuer quand meme ?`;
      if (!confirm(msg)) return;
    }

    if (consultation.nutrition_plan && !confirm('Cela remplacera le plan actuel. Continuer ?')) return;

    // Detection des contre-indications avant generation
    const alerts = detectContraIndications({
      ...form,
      observations: consultation.observations,
      nutritional_observations: consultation.nutritional_observations,
    });
    if (alerts.length > 0) {
      setPendingAlerts(alerts);
      return;
    }

    await doGenerate();
  };

  const doGenerate = async () => {
    setPendingAlerts(null);
    setGenerating(true);
    setGenError('');

    // Versioning : sauvegarder l'ancien plan avant de le remplacer
    if (consultation.nutrition_plan) {
      savePlanVersion(clientId, {
        nutritionPlan: consultation.nutrition_plan,
        supplements: consultation.supplements,
        recipes: consultation.recipes,
        ficheFrigoJson: consultation.fiche_frigo_json || null,
        label: 'Avant regeneration',
      });
      setPlanVersions(getPlanVersions(clientId));
    }

    try {
      const userMessage = buildUserMessage();

      const planResponse = await fetch('/api/claude', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-fallback-key': apiKey.trim(),
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 16000,
          system: NUTRITION_SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userMessage + '\n\nGenere le plan nutrition personnalise complet sur 4 semaines (sections 1 a 7) avec menus varies, listes de courses par semaine, et alternatives naturelles. Ne genere PAS la section supplements separement.' }],
        }),
      });

      if (!planResponse.ok) {
        const err = await planResponse.json().catch(() => ({}));
        throw new Error(err.error?.message || `Erreur API: ${planResponse.status}`);
      }

      const planData = await planResponse.json();
      updateField('nutrition_plan', planData.content?.[0]?.text || '');

      const suppResponse = await fetch('/api/claude', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-fallback-key': apiKey.trim(),
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4000,
          system: NUTRITION_SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userMessage + '\n\n' + SUPPLEMENTS_INSTRUCTION }],
        }),
      });

      if (!suppResponse.ok) {
        const err = await suppResponse.json().catch(() => ({}));
        throw new Error(err.error?.message || `Erreur API: ${suppResponse.status}`);
      }

      const suppData = await suppResponse.json();
      const suppText = suppData.content?.[0]?.text || '';
      updateField('supplements', suppText);

      // 3eme appel : Fiche Frigo structuree (JSON)
      try {
        const ficheInstruction = `A partir du plan nutrition et des supplements ci-dessous, genere UNIQUEMENT un objet JSON valide (sans texte autour, sans bloc markdown) avec cette structure exacte :

{
  "repas": {
    "petit_dejeuner": ["option 1", "option 2", "option 3"],
    "dejeuner": ["option 1", "option 2", "option 3"],
    "diner": ["option 1", "option 2", "option 3"],
    "collation": "suggestion de collation"
  },
  "a_privilegier": ["aliment 1", "aliment 2", "aliment 3"],
  "a_limiter": ["aliment 1", "aliment 2"],
  "hydratation": "ex: 2L/jour + tisanes",
  "supplements": {
    "matin_a_jeun": ["Fer 30mg + Vit C 500mg"],
    "petit_dejeuner": ["Vitamine D3 2000UI + K2"],
    "midi": ["Omega-3 2g"],
    "soir": ["Zinc 30mg"],
    "coucher": ["Magnesium 300mg"]
  }
}

Respecte EXACTEMENT ces noms de cles (snake_case). Chaque liste peut etre vide mais doit exister. Les options de repas doivent etre courtes et concretes (1-2 lignes max). Reponds UNIQUEMENT avec le JSON, sans backticks, sans texte autour.

--- PLAN NUTRITION ---
${planData.content?.[0]?.text || ''}

--- SUPPLEMENTS ---
${suppText}`;

        const ficheResponse = await fetch('/api/claude', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-fallback-key': apiKey.trim(),
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 3000,
            system: 'Tu es un assistant qui structure des donnees nutritionnelles au format JSON strict.',
            messages: [{ role: 'user', content: ficheInstruction }],
          }),
        });

        if (ficheResponse.ok) {
          const ficheData = await ficheResponse.json();
          let raw = (ficheData.content?.[0]?.text || '').trim();
          // Strip ```json ... ``` fences si presents
          raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
          // Extraire le premier objet JSON si du texte parasite
          const firstBrace = raw.indexOf('{');
          const lastBrace = raw.lastIndexOf('}');
          if (firstBrace !== -1 && lastBrace > firstBrace) {
            raw = raw.slice(firstBrace, lastBrace + 1);
          }
          try {
            const parsed = JSON.parse(raw);
            updateField('fiche_frigo_json', parsed);
          } catch (e) {
            console.warn('Fiche frigo JSON invalide, fallback regex active', e);
          }
        }
      } catch (ficheErr) {
        console.warn('Fiche frigo generation echouee (non bloquant)', ficheErr);
      }

    } catch (err) {
      setGenError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleTemplateSelect = (plan, supp) => {
    setConsultation(prev => ({ ...prev, nutrition_plan: plan, supplements: supp }));
    setShowTemplates(false);
  };

  const handleSave = () => {
    onSave({
      id: consultationId || undefined,
      clientId,
      consultantName: 'Anissa',
      date: initialConsultation?.date || new Date().toISOString(),
      observations: consultation.observations,
      bloodTestDone: consultation.blood_test_done,
      dnaTestDone: consultation.dna_test_done,
      nutritionalObservations: consultation.nutritional_observations,
      nutritionPlan: consultation.nutrition_plan,
      supplements: consultation.supplements,
      recipes: consultation.recipes,
      notesForCoach: consultation.notes_for_coach,
      privateNotes: consultation.private_notes,
      ficheFrigoJson: consultation.fiche_frigo_json || null,
      isFollowup,
      followupData: isFollowup ? {
        ...followupData,
        // Store previous values for PDF comparison
        _prevPoids: previousConsultation?.followupData?.poids_actuel || form.poids || null,
        _prevTourTaille: previousConsultation?.followupData?.tour_taille || form.tourTaille || null,
        _prevTourHanche: previousConsultation?.followupData?.tour_hanche || form.tourHanche || null,
        _prevTourBras: previousConsultation?.followupData?.tour_bras || form.tourBras || null,
        _prevTourCuisse: previousConsultation?.followupData?.tour_cuisse || form.tourCuisse || null,
        _prevMasseGrasse: previousConsultation?.followupData?.masse_grasse || form.masseGrasse || null,
      } : null,
      previousConsultationId: previousConsultation?.id || null,
    });
  };

  return (
    <div className="nutrition-consultation">
      {showTemplates && (
        <NutritionTemplates
          onSelect={handleTemplateSelect}
          onClose={() => setShowTemplates(false)}
        />
      )}

      {pendingAlerts && (
        <ContraIndicationAlert
          alerts={pendingAlerts}
          onCancel={() => setPendingAlerts(null)}
          onConfirm={() => { doGenerate(); }}
        />
      )}

      {showVersions && (
        <div className="ci-backdrop" role="dialog" aria-modal="true">
          <div className="ci-modal" style={{ borderTopColor: '#7c5cbf' }}>
            <div className="ci-header">
              <span className="ci-icon">🕐</span>
              <h3>Historique des versions du plan</h3>
            </div>
            <p className="ci-intro">
              {planVersions.length} version{planVersions.length > 1 ? 's' : ''} sauvegardee{planVersions.length > 1 ? 's' : ''} localement
              (max {3}). Tu peux restaurer une ancienne version en cas de besoin.
            </p>
            <ul className="ci-list">
              {planVersions.map((v) => (
                <li key={v.id}>
                  <strong>{v.label || 'Version sauvegardee'}</strong>
                  <div className="ci-desc">
                    {formatDate(v.savedAt)} · {(v.nutritionPlan || '').length} car.
                    {v.supplements ? ` · ${(v.supplements || '').length} car. supp.` : ''}
                  </div>
                  <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                    <button
                      className="btn btn-primary"
                      style={{ padding: '6px 12px', fontSize: '.8rem' }}
                      onClick={() => {
                        if (consultation.nutrition_plan && !confirm('Remplacer le plan actuel par cette version ?')) return;
                        // Sauver l'actuel avant de restaurer
                        if (consultation.nutrition_plan) {
                          savePlanVersion(clientId, {
                            nutritionPlan: consultation.nutrition_plan,
                            supplements: consultation.supplements,
                            recipes: consultation.recipes,
                            ficheFrigoJson: consultation.fiche_frigo_json || null,
                            label: 'Avant restauration',
                          });
                        }
                        setConsultation(prev => ({
                          ...prev,
                          nutrition_plan: v.nutritionPlan || '',
                          supplements: v.supplements || '',
                          recipes: v.recipes || '',
                          fiche_frigo_json: v.ficheFrigoJson || null,
                        }));
                        setPlanVersions(getPlanVersions(clientId));
                        setShowVersions(false);
                      }}
                    >
                      Restaurer
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <div className="ci-actions">
              <button className="btn btn-secondary" onClick={() => setShowVersions(false)}>Fermer</button>
            </div>
          </div>
        </div>
      )}

      <div className="nutrition-header">
        <h2>Consultation nutrition</h2>
        <span className="nutrition-client-name">{form.prenom || 'Client'}</span>
      </div>

      {/* Followup banner */}
      {isFollowup && previousConsultation && (
        <div className="followup-banner">
          Consultation de suivi — Derniere consultation : {formatDate(previousConsultation.date)}
        </div>
      )}

      {/* Step progress */}
      <div className="nutrition-steps">
        {stepLabels.map((label, i) => (
          <button
            key={i}
            className={`nutrition-step ${step === i + 1 ? 'active' : ''} ${step > i + 1 ? 'completed' : ''}`}
            onClick={() => setStep(i + 1)}
          >
            <span className="nutrition-step-num">{i + 1}</span>
            <span className="nutrition-step-label">{label}</span>
          </button>
        ))}
      </div>

      {/* Step: Client summary (read-only) */}
      {currentStepType === 'summary' && (
        <div className="nutrition-form-section">
          <h3>Resume du client</h3>
          <p className="nutrition-readonly-notice">Donnees du profil (lecture seule)</p>
          <div className="nutrition-summary-grid">
            <div className="nutrition-summary-item">
              <label>Prenom</label>
              <div>{form.prenom || 'Non renseigne'}</div>
            </div>
            <div className="nutrition-summary-item">
              <label>Nom</label>
              <div>{form.nom || 'Non renseigne'}</div>
            </div>
            <div className="nutrition-summary-item">
              <label>Age</label>
              <div>{form.age ? `${form.age} ans` : 'Non renseigne'}</div>
            </div>
            <div className="nutrition-summary-item">
              <label>Genre</label>
              <div>{form.genre || 'Non renseigne'}</div>
            </div>
            <div className="nutrition-summary-item">
              <label>Poids</label>
              <div>{form.poids ? `${form.poids} kg` : 'Non renseigne'}</div>
            </div>
            <div className="nutrition-summary-item">
              <label>Taille</label>
              <div>{form.taille ? `${form.taille} cm` : 'Non renseigne'}</div>
            </div>
            {(form.tourTaille || form.tourHanche || form.masseGrasse) && (
              <div className="nutrition-summary-item full">
                <label>Mesures corporelles</label>
                <div>{
                  [
                    form.tourTaille ? `Taille: ${form.tourTaille}cm` : '',
                    form.tourHanche ? `Hanche: ${form.tourHanche}cm` : '',
                    form.tourPoitrine ? `Poitrine: ${form.tourPoitrine}cm` : '',
                    form.tourBras ? `Bras: ${form.tourBras}cm` : '',
                    form.tourCuisse ? `Cuisse: ${form.tourCuisse}cm` : '',
                    form.masseGrasse ? `MG: ${form.masseGrasse}%` : '',
                    form.masseMusculaire ? `MM: ${form.masseMusculaire}%` : '',
                  ].filter(Boolean).join(' | ')
                }</div>
              </div>
            )}
            <div className="nutrition-summary-item">
              <label>Formule</label>
              <div>{formule.nom || (client?.categorie === 'nutrition' ? 'Client nutrition' : 'Non renseigne')}</div>
            </div>
            <div className="nutrition-summary-item">
              <label>Email</label>
              <div>{form.email || 'Non renseigne'}</div>
            </div>
            <div className="nutrition-summary-item">
              <label>Telephone</label>
              <div>{form.telephone || 'Non renseigne'}</div>
            </div>
            <div className="nutrition-summary-item full">
              <label>Objectifs</label>
              <textarea
                className="nutrition-summary-textarea"
                value={consultation.objectifs_display || [
                  form.objectifPrincipalNutrition,
                  form.objectifPrincipal,
                  form.objectifSecondaire,
                  form.objectif,
                  (form.symptomesObjectifs || []).join(', '),
                  form.motivationProfonde ? `Motivation : ${form.motivationProfonde}` : '',
                  form.pourquoiMaintenant ? `Pourquoi maintenant : ${form.pourquoiMaintenant}` : '',
                ].filter(Boolean).join(' | ') || ''}
                onChange={(e) => updateField('objectifs_display', e.target.value)}
                placeholder="Objectifs du client..."
                rows={2}
                style={{ width: '100%', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, padding: '8px 10px', color: '#d4c9a8', fontSize: '.85rem', fontFamily: 'inherit', resize: 'vertical' }}
              />
            </div>
            <div className="nutrition-summary-item full">
              <label>Habitudes alimentaires</label>
              <div>{
                [
                  form.objectifNutrition ? `Objectif : ${form.objectifNutrition}` : '',
                  form.preferencesAlimentaires ? `Preferences : ${form.preferencesAlimentaires}` : '',
                  form.nbRepas ? `${form.nbRepas} repas/jour` : '',
                  form.niveauCuisine ? `Cuisine : ${form.niveauCuisine}` : '',
                  form.frequenceRestaurant ? `Restaurant : ${form.frequenceRestaurant}` : '',
                  form.hydratation ? `Hydratation : ${form.hydratation}` : '',
                  form.digestion ? `Digestion : ${form.digestion}` : '',
                  form.alimentsEvites ? `Aliments evites : ${form.alimentsEvites}` : '',
                ].filter(Boolean).join(' | ') || 'Non renseigne'
              }</div>
            </div>
            <div className="nutrition-summary-item full">
              <label>Allergies / Intolerances</label>
              <div>{form.allergies || form.alimentsEvites || 'Aucune'}</div>
            </div>
            <div className="nutrition-summary-item full">
              <label>Activite sportive</label>
              <div>{
                [
                  form.niveau ? `Niveau : ${form.niveau}` : '',
                  form.frequence ? `${form.frequence}x/sem` : '',
                  form.duree || '',
                  form.lieu || '',
                  form.typeSport || '',
                  form.frequenceSport ? `${form.frequenceSport}x/sem` : '',
                  form.activitePhysique || '',
                ].filter(Boolean).join(' | ') || 'Non renseigne'
              }</div>
            </div>
          </div>

          <div className="nutrition-checkboxes" style={{ marginTop: 16 }}>
            <label className="nutrition-checkbox">
              <input type="checkbox" checked={consultation.blood_test_done} onChange={(e) => updateField('blood_test_done', e.target.checked)} />
              <span>Bilan sanguin effectue</span>
            </label>
            <label className="nutrition-checkbox">
              <input type="checkbox" checked={consultation.dna_test_done} onChange={(e) => updateField('dna_test_done', e.target.checked)} />
              <span>Analyse ADN effectuee</span>
            </label>
          </div>
        </div>
      )}

      {/* Step: Follow-up (only for returning clients) */}
      {currentStepType === 'followup' && (
        <FollowUpStep
          followupData={followupData}
          onChange={setFollowupData}
          previousConsultation={previousConsultation}
          clientForm={form}
        />
      )}

      {/* Observations step removed — data auto-populated from client questionnaire and used in AI prompt */}

      {/* Step: Nutrition Plan */}
      {currentStepType === 'plan' && (
        <div className="nutrition-form-section">
          <h3>Plan nutrition</h3>

          {/* Recap observations */}
          <div className="nutrition-observations-recap" style={{ background: 'rgba(124,92,191,.08)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: '.85rem', lineHeight: 1.5 }}>
            <strong style={{ display: 'block', marginBottom: 6 }}>Recap observations :</strong>
            <div>Observations : {consultation.observations || 'Non renseigne'}</div>
            <div>Bilan sanguin : {consultation.blood_test_done ? 'Oui' : 'Non'} | ADN : {consultation.dna_test_done ? 'Oui' : 'Non'}</div>
            {consultation.nutritional_observations && <div>Observations nutritionnelles : {consultation.nutritional_observations}</div>}
            {isFollowup && followupData.etat_global && (
              <div style={{ marginTop: 8, borderTop: '1px solid rgba(124,92,191,.15)', paddingTop: 8 }}>
                <strong>Suivi :</strong> {followupData.etat_global} | Adherence : {followupData.adherence_plan || '-'} | Poids : {followupData.poids_actuel ? `${followupData.poids_actuel} kg` : '-'}
              </div>
            )}
          </div>

          <div className="nutrition-plan-actions">
            <button
              className={`btn btn-generate-nutrition ${generating ? 'loading-pulse' : ''}`}
              onClick={handleGenerate}
              disabled={generating}
              style={{ flex: 1 }}
            >
              {generating ? 'Generation en cours...' : 'Generer avec l\'IA'}
            </button>
            <button
              className="btn btn-anissa-secondary"
              onClick={() => setShowTemplates(true)}
              style={{ padding: '14px 24px', fontSize: '.85rem' }}
            >
              Templates
            </button>
            {planVersions.length > 0 && (
              <button
                className="btn btn-anissa-secondary"
                onClick={() => setShowVersions(true)}
                style={{ padding: '14px 20px', fontSize: '.85rem' }}
                title="Historique des versions"
              >
                🕐 {planVersions.length}
              </button>
            )}
          </div>

          {genError && <div className="error-msg" style={{ marginTop: 12 }}>{genError}</div>}

          {generating && (
            <div className="loading" style={{ padding: '30px 20px' }}>
              <div className="loading-spinner" />
              <p>Claude analyse le profil et genere le plan nutrition...</p>
            </div>
          )}

          {consultation.nutrition_plan ? (
            <NutritionEditor
              planText={consultation.nutrition_plan}
              supplementsText={consultation.supplements}
              recipesText={consultation.recipes}
              form={form}
              client={client}
              onSave={(plan, supplements, recipes) => {
                setConsultation(prev => ({
                  ...prev,
                  nutrition_plan: plan,
                  supplements,
                  recipes,
                }));
              }}
              onExportPDF={(plan, supplements, recipes) => {
                exportConsultationPDF({
                  observations: consultation.observations,
                  nutritionalObservations: consultation.nutritional_observations,
                  bloodTestDone: consultation.blood_test_done,
                  dnaTestDone: consultation.dna_test_done,
                  nutritionPlan: plan,
                  supplements,
                  recipes,
                  notesForCoach: consultation.notes_for_coach,
                  date: new Date().toISOString(),
                }, client);
              }}
              onExportCover={() => {
                exportCoverPDF({
                  blood_test_done: consultation.blood_test_done,
                  dna_test_done: consultation.dna_test_done,
                  date: new Date().toISOString(),
                }, client);
              }}
            />
          ) : (
            <>
              <div className="field full-width" style={{ marginTop: 16 }}>
                <label>Plan nutrition personnalise</label>
                <textarea
                  value={consultation.nutrition_plan}
                  onChange={(e) => updateField('nutrition_plan', e.target.value)}
                  placeholder="Le plan sera genere par l'IA, pre-rempli via un template, ou saisi manuellement..."
                  rows={16}
                />
              </div>
              <div className="field full-width" style={{ marginTop: 16 }}>
                <label>Supplements recommandes</label>
                <textarea
                  value={consultation.supplements}
                  onChange={(e) => updateField('supplements', e.target.value)}
                  placeholder="Les supplements seront generes par l'IA ou saisissez-les manuellement..."
                  rows={8}
                />
              </div>
              <div className="field full-width" style={{ marginTop: 16 }}>
                <label>Recettes recommandees</label>
                <textarea
                  value={consultation.recipes}
                  onChange={(e) => updateField('recipes', e.target.value)}
                  placeholder="Recettes specifiques a recommander au client..."
                  rows={6}
                />
              </div>
            </>
          )}
        </div>
      )}

      {/* Step: Notes for Benoit + Private notes */}
      {currentStepType === 'notes' && (
        <div className="nutrition-form-section">
          <h3>Notes pour Benoit</h3>
          <div className="field full-width">
            <label>Recommandations a transmettre au coach</label>
            <SmartTextarea
              value={consultation.notes_for_coach}
              onChange={(e) => updateField('notes_for_coach', e.target.value)}
              placeholder="Points d'attention pour le programme sportif, aliments a eviter avant/apres l'entrainement, signes a surveiller..."
              rows={8}
            />
          </div>

          <div className="field full-width private-field" style={{ marginTop: 24 }}>
            <label>
              <span className="private-lock">🔒</span> Notes privees
              <span className="private-badge">Visible uniquement par vous</span>
            </label>
            <SmartTextarea
              value={consultation.private_notes}
              onChange={(e) => updateField('private_notes', e.target.value)}
              placeholder="Notes confidentielles — visibles uniquement par Anissa..."
              rows={5}
            />
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="nav-buttons">
        {step > 1 ? (
          <button className="btn btn-secondary" onClick={() => setStep(step - 1)}>Precedent</button>
        ) : (
          <button className="btn btn-secondary" onClick={onCancel}>Annuler</button>
        )}
        {step < totalSteps ? (
          <button className="btn btn-primary" onClick={() => setStep(step + 1)}>Suivant</button>
        ) : (
          <button className="btn btn-primary" onClick={handleSave}>Sauvegarder la consultation</button>
        )}
      </div>
    </div>
  );
}
