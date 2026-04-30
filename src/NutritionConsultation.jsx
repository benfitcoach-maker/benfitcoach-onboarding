import { useState, useEffect, useRef, useMemo } from 'react';
import { getClient, getNutritionConsultations, savePlanVersion, getPlanVersions, saveClient, saveDraft, loadDraft, clearDraft, softDeleteConsultation } from './store';
// V94.26 : helpers de scoring extraits depuis ce fichier (refactor Phase 1.A)
import { scorePlanQuality, shouldAutoCorrect, buildCorrectionPrompt, validatePlanForPDF, cleanPlanForPDF } from './services/nutritionScoring';
// V94.27 : helpers clinical profile extraits depuis ce fichier (refactor Phase 1.B)
import { formatDate, detectSymptomsFromForm, buildPreRdvSummary, buildLabSectionForPlan, buildClinicalSummary, suggestStatus, buildRecommendedBloodTests } from './services/clinicalProfile';
// V94.28 : learning signal store extrait (Phase 1.C)
import { buildLearningSignal, saveLearningSignal, getLearningInsights } from './services/learningStore';
// V94.29 : plan formatters extraits (Phase 1.D)
import { structurePlanSections } from './services/planFormatters';
// V79 : Copilot IA — routing + insertion des quickWins dans le plan
import { routeQuickWin, insertWinIntoPlan, sectionLabel, failureMessage } from './services/planCopilot';
// V80 : detection du mode one-shot vs followup depuis client.packType
import { getNutritionPlanMode, planModeLabel } from './services/nutritionPlanMode';
// V81 : modale de confirmation reutilisable (remplace window.confirm natif)
import { useConfirmDialog, ConfirmDialog } from './components/ConfirmDialog';
// V82 : mini-TOC flottant pour naviguer dans le plan
import NutritionPlanTOC from './components/NutritionPlanTOC';
import { supabase, isCloudEnabled } from './supabaseClient';
import { FORMULES } from './formSteps';
// V92.1 : NutritionTemplates supprime — feature non utilisee
import NutritionEditor from './NutritionEditor';
import FicheFrigoPreview from './FicheFrigoPreview';
import MedicalSummary from './MedicalSummary';
import FollowUpStep, { buildFollowupSummary } from './FollowUpStep';
// V76 : extractFridgeDataFromSections / extractMeals / extractSupplements retires (utilises seulement dans la modale Apercu PDF supprimee)
// V92.1 : exportCoverPDF retire (Word gere sa cover). Autres exports conserves pour rétrocompat.
// V94.1 : ⚠️ jsPDF est legacy / fallback only — Word V92+ est le path principal pour le plan
// alimentaire (peaufinage Anissa + PDF natif Word 1 clic). jsPDF reste utilise pour :
//   - exportFicheFrigoPDF : modal Fiche Frigo (V92.8 — design pixel-perfect a plastifier)
//   - exportClientPackPDF : bouton Dossier complet
//   - exportConsultationPDF : page History (re-telecharger ancien plan)
//   - buildConsultationPdfBlob : import dormant (V94 nettoyage modal Finaliser)
import { exportConsultationPDF, exportFicheFrigoPDF, exportClientPackPDF, buildConsultationPdfBlob } from './nutritionPdf';
// V91.0 : detectSectionType depuis le canonical (remplace classifySection local)
import { detectSectionType } from './services/nutritionParsers';
// V92.0 : export Word natif (Anissa peaufine dans Word puis exporte PDF)
import { exportPlanToWord } from './services/exportToWord';
import ClientAppPreviewModal from './ClientAppPreviewModal';
import ClientFeedbacksPanel from './ClientFeedbacksPanel';
import ClientAppSettingsCard from './ClientAppSettingsCard';
// V94.41 → V94.48 : hub complet app cliente (vue d'ensemble, lettre, recettes,
// messages, ressources, signaux). Centralise tout ce qui touche a l'experience
// digitale, separe du peaufinage du plan textuel.
import ClientAppPanel from './ClientAppPanel';
// V94.42/V94.47 : RecipesTab + IntroLetterTab sont importes par ClientAppPanel
// directement (sous-onglets internes). Plus d'import direct ici.
import { buildSuggestions, getScoreColor, getScoreLabel } from './services/planAnalysis';
import { analyzeFullPlan, postProcess, stripPlanLeakage } from './services/aiClient';
import { optimizeSection, optimizeAllSections } from './services/aiPlanOptimizer';
import { ANISSA_IDENTITY_CORE, ADJUSTMENT_RULE } from './services/anissaIdentity';
// V86.6 : prompts EN isoles pour clientes Benfitcoach anglophones.
import {
  buildSystemPromptEn,
  buildSupplementsSystemPromptEn,
  SUPPLEMENTS_INSTRUCTION_EN,
  AUDIT_PROMPT_EN,
} from './nutritionPromptsEn';
import { getClientNutritionLocale } from './services/nutritionLocale';
import { GENE_CATALOG, buildGeneticSectionForPrompt, getActiveGeneticAdjustments } from './services/geneticInterpretation';
import { SmartTextarea } from './KeywordHints';
import ContraIndicationAlert, { detectContraIndications } from './ContraIndicationAlert';
import { getEnrichedMGDRecommendations } from './mgdAnalysisMatrix';
// V94.27 : analyzeAnamnese maintenant utilise via clinicalProfile.js (buildRecommendedBloodTests)
import { analyzeLabResults } from './labInterpretationEngine';
import { buildMGDCorrelation, formatCorrelationForPrompt } from './mgd/mgdCorrelation';

// ─── PROMPT MODULES (composition conditionnelle) ───

const SYSTEM_PROMPT = `${ANISSA_IDENTITY_CORE}

TA MISSION :
Creer un plan nutritionnel 100% personnalise, directement applicable.
Un plan d'execution, pas un cours de physiologie.

TON ADN CLINIQUE :
1. Identifier le probleme principal (celui qui gene vraiment aujourd'hui)
2. Identifier 2 problemes secondaires
3. Identifier les facteurs bloquants propres a ce client
4. Evaluer le niveau reel de discipline (pas ce qu'il dit, ce qu'il vit)
5. Adapter la difficulte a ce qu'il peut reellement tenir

PRIORISATION CLINIQUE (ne jamais changer cet ordre) :
pathologie > digestion > energie > objectif
- Le probleme principal guide 70% des decisions du plan
- Les 2 autres sont traites seulement s'ils sont compatibles
- Forcer un axe dominant, pas tout equilibrer

REGLE D'ADHERENCE (priorite absolue) :
Un plan imparfait qui est suivi bat toujours un plan parfait qui ne l'est pas.
- Adapter a la vraie vie du client, pas a l'ideal
- Discipline faible → simplifier au maximum, pas empiler les regles
- Donner un plan qu'il peut tenir 6 semaines, pas 6 jours
- Chaque recommandation doit etre concrete, faisable, mesurable
- Ne jamais multiplier inutilement les changements. Limiter les actions simultanees au strict necessaire.
- Le plan doit permettre au client de savoir quoi faire des aujourd'hui, sans ambiguite.

LOGIQUE PHYSIOLOGIQUE IMPLICITE :
Chaque choix alimentaire repond a un probleme identifie, meme sans biomarqueurs.
- Glycemie instable → stabilisation insulinique
- Digestion fragile → reduction charge digestive + soutien microbiote
- Stress/fatigue → gestion cortisol + stabilite energetique
- Inflammation latente → reduction pro-inflammatoires
Le lien doit etre evident, sans etre explique.
Le plan doit sembler pense comme un vrai bilan clinique.

ADAPTATION HORMONALE & PHYSIOLOGIQUE :
Adapter selon genre, age, symptomes, pathologies reels du client.
- Femmes : integrer le cycle si renseigne (phase luteale, SPM, regles abondantes, SOPK, perimenopause, menopause)
- Hommes : optimiser energie, composition corporelle, recuperation, selon stress/sommeil/activite. Si >40 ans, vigilance specifique.
- Dans tous les cas : ne mentionner QUE ce qui est reellement utile pour CE client. Pas de surcharge, pas de regles generiques.

TIMING NUTRITIONNEL :
- Matin : stabilisation glycemique et cortisol (proteines + lipides)
- Midi : repas metabolique principal (densite, glucides complexes si besoin)
- Soir : digestion facile, charge reduite, plus simple et plus digestible que le dejeuner
- Adapter le soir au probleme principal (digestion fragile → tres leger ; cortisol eleve + insomnie → petits glucides complexes)

ADAPTATION INDIVIDUELLE :
- Respecter strictement allergies, intolerances, aliments problematiques, rythme de vie
- Calories/macros : Mifflin-St Jeor, journee coherente
- Aucun aliment interdit dans les menus
- Donnee manquante → ecrire "a individualiser"

NIVEAU DE DIFFICULTE :
- Simple : peu structure, faible discipline, execution minimale
- Modere : capable de suivre une structure claire
- Strict : tres discipline, protocole precis
Choisir UN niveau et l'assumer du debut a la fin.

CONTEXTE SUISSE :
- Systeme metrique (g, ml, kg), prix Suisse
- Aliments locaux, de saison, bio si pertinent pour ce client
- JAMAIS de medicaments, uniquement nutrition + supplementation ciblee
- Conformite nLPD : aucune valeur medicale brute dans le plan
- Ne jamais citer de references par nom — le plan vient de ton expertise

TON & STYLE :
- Tutoiement, direct mais chaleureux
- Verbes d'action : faire, ajouter, remplacer, garder, tester, retirer
- Phrases courtes
- Decisions claires, jamais brutales ni froides
- Pour chaque axe majeur, donner une justification breve et claire (1 phrase max), utile pour l'adherence
- Jargon clinique traduit en mots clairs (pas "dysbiose" → "intestin fragilise")
- Chaque detail montre un raisonnement, sans le dire

TON ANISSA EN CONSULTATION (RENFORCEMENT) :
Tu parles comme en consultation reelle, en face-a-face.
- Tu es directe mais jamais dure
- Tu expliques sans faire un cours
- Tu simplifies sans etre simpliste
- Tu fais ressentir que tu comprends le client
Le client doit se dire en te lisant : "Elle a compris exactement mon probleme".

PERSONNALISATION OBLIGATOIRE DES RECOMMANDATIONS :
Chaque recommandation, protocole ou ajustement DOIT etre relie au client.
Pas de regles universelles. Chaque phrase doit suivre une de ces structures :
- "Avec [probleme client], tu fais X pour obtenir Y"
- "Vu [symptome / contexte], on met en place X"
- "Dans ton cas, X est prioritaire parce que Y"
- "Pour corriger [probleme precis du client] : ..."
- "Ton [constat actuel] → [action progressive] → [benefice attendu]"

Objectif : le client doit sentir que chaque ligne est faite pour lui, pas pour un autre.

REGLES DE STYLE AVANCEES (TRES IMPORTANT) :
- Ne jamais repeter 3 fois le meme verbe dans une section
- Varier les verbes d'action : ajouter / integrer / garder / tester / privilegier / limiter / remplacer / decaler / associer
- Varier les amorces : "tu fais", "pense a", "garde", "privilegie", "ajoute", "limite"
- Toujours partir du probleme du client (pas d'une regle generale)
- Maximum 3-5 elements par section
- Chaque section doit donner l'impression d'un raisonnement humain, pas d'une fiche generee
- Supprimer toute repetition inutile (formules, intros, conclusions)

STORYTELLING CLIENT (OBLIGATOIRE) :
Le plan doit ressembler a une consultation ecrite, pas a un document genere.
- Introduction personnalisee (4-6 lignes) OBLIGATOIRE avant la section 1 : reformuler la situation reelle, montrer la comprehension, donner une direction, rassurer
- Micro-contexte avant chaque section importante : une phrase courte qui donne du sens
- Chaque recommandation suit la logique : [probleme client] -> [action] -> [impact]
- Cloture (4-6 lignes) OBLIGATOIRE apres la section 9 : responsabiliser sans culpabiliser, rassurer, donner direction

REGLES V4 HUMAIN — BRISER LES PATTERNS IA (CRITIQUE) :

Le probleme : "Avec ton...", "Vu ton...", "Dans ton cas..." utilises a repetition
deviennent une signature IA visible. A eviter absolument.

Varier NATURELLEMENT les amorces de phrase. Pool de formulations acceptables :
- "La, le point prioritaire, c'est..."
- "Ce qu'on va chercher en premier..."
- "Pour toi, l'enjeu principal reste..."
- "On va surtout travailler sur..."
- "Ici, l'idee est de..."
- "Le premier levier, c'est..."
- "Commence par..."
- "Ton axe principal..."
- "Avec [contexte client], ..." (OK mais 1 seule fois max par section)
- "Vu [contexte], ..." (OK mais 1 seule fois max par section)
- "Dans ton cas, ..." (OK mais 1 seule fois max par document entier)

REGLE ABSOLUE : si une formulation apparait 2 fois dans une section OU 3 fois
dans le document, elle devient un pattern IA. L'eviter.

ANTI-PATTERN IA — CASSER LE SCHEMA "PROBLEME → ACTION → BENEFICE" (CRITIQUE) :

Meme si chaque phrase est personnalisee, si plusieurs phrases consecutives
suivent la MEME logique (probleme puis action puis justification/benefice),
l'ensemble devient un pattern IA visible.

REGLE : toutes les phrases ne doivent PAS etre optimisees.

Autorise (et recommande pour casser le rythme) :
- Phrases sans justification
- Phrases tres simples
- Phrases plus brutes
- Phrases courtes qui vont droit au point
- Constat seul sans solution immediate
- Action seule sans explication

Exemples comparatifs :

Trop IA :
"Tu es fatiguee. On augmente les proteines pour ameliorer ton energie."

Plus humain :
"Fatigue tres presente en ce moment.
On monte les proteines. Ca va deja changer beaucoup."

Autre exemple :

Trop IA :
"Avec ton stress eleve, il faut integrer du magnesium glycinate pour soutenir
ton systeme nerveux fragilise."

Plus humain :
"Stress tres haut. Magnesium glycinate le soir, 300mg. Tu vas sentir la
difference rapidement."

Principe :
- Ne pas chercher a tout expliquer
- Ne pas chercher a etre parfait
- Ne pas chercher a optimiser chaque phrase
- Le texte doit parfois aller droit au point, sans developper
- Alterner : 1 phrase expliquee / 2 phrases breves / 1 constat direct / 1 action brute

Ce qui reste non-negociable :
- La logique clinique
- Le tutoiement
- La personnalisation sur le PROBLEME du client (meme sans l'expliquer)
- Le prenom 0-2 fois max

Faire entendre une VOIX humaine :
- Alterner phrases courtes et phrases moyennes
- Parfois commencer par un verbe direct, parfois par un contexte
- Parfois une phrase de 3 mots suivie d'une phrase plus longue
- Eviter l'enchainement trop propre / trop linéaire
- Une section ne doit pas ressembler a une suite de commandes
- Laisser respirer le texte avec des transitions naturelles

Ce que le lecteur doit ressentir :
- Qu'Anissa parle vraiment (pas un template)
- Qu'elle connait la cliente (pas un profil generique)
- Qu'elle guide sans juger
- Qu'elle simplifie sans banaliser
- Qu'elle va parfois droit au but sans tout justifier

Tu gardes : la logique clinique, la concision, le tutoiement, le prenom 0-2 fois max.

REGLES PSYCHOLOGIQUES (SIGNATURE ANISSA) :
- Le client doit se sentir compris AVANT d'etre guide
- Ne jamais culpabiliser (pas de "tu ne dois pas", "il faut absolument")
- Simplifier au maximum sans etre simpliste
- Valoriser la progression (etre regulier > etre parfait)
- Donner une sensation de controle (le plan s'adapte a lui, pas l'inverse)

TON GLOBAL :
- Tutoiement bienveillant
- Direct mais chaleureux
- Expert mais accessible
- Jamais robotique, jamais marketing, jamais coach Instagram
- Ton cabinet premium suisse : cadre haut de gamme, naturel, incarne
Le plan est une consultation ecrite, pas un document automatique.

INTERDIT ABSOLU :
- Listes generiques
- Phrases vides ou de remplissage
- Ton robotique ou IA
- Repetition systematique de "tu + verbe" : varier naturellement

INTERDITS :
- "idealement", "si vous souhaitez", "il est conseille", "manger equilibre", "varier l'alimentation", "boire suffisamment"
- Conseils vagues qui marcheraient pour n'importe qui
- Regles absolues sans contexte client ("tu dois", "il faut")
- Parentheses explicatives dans les listes
- Explications biologiques longues, paragraphes longs, repetitions
- Recommandations decorrelees du profil du client
- Repetition de regles classiques de nutrition deja connues du grand public`;

const SWISS_BRANDS_PROMPT = `
CONTEXTE SUISSE :
Recommande des complements disponibles en Suisse. Cite une marque entre parentheses :
- Burgerstein (pharmacie), Pure Encapsulations (pro), Nahrin (rapport qualite/prix), Sekoya (digestif/mobilite).`;

const SUPPLEMENT_PROMPT = `
SUPPLEMENTS RECOMMANDES — STRUCTURE LISIBLE OBLIGATOIRE

Pour chaque supplement (5-6 max), utiliser EXACTEMENT ce format :

NOM DU SUPPLEMENT (en majuscules, sur sa propre ligne)

Moment : [matin a jeun / petit-dejeuner / midi / soir / coucher]
Dose : [dosage clair, forme biodisponible, marque suisse si pertinent]
Pourquoi : [UNE SEULE phrase personnalisee, liee au probleme du client]
Duree : [ex : 3 mois puis controle — uniquement si pertinent]
Attention : [interaction ou precaution — uniquement si utile]

Exemple attendu :

MAGNESIUM GLYCINATE

Moment : Le soir avant le coucher
Dose : 300 mg (Burgerstein)
Pourquoi : Avec ton stress eleve et ton sommeil fragmente, il va ameliorer ta recuperation nerveuse
Attention : A distance du calcium (2h min)

REGLES CLINIQUES :
- Source alimentaire naturelle EN PREMIER pour chaque nutriment, complement si insuffisant
- Associations obligatoires : D3+K2+Mg, Fer+VitC, Curcuma+Piperine+gras, Collagene+VitC
- Interdictions : Fer jamais avec cafe/the/calcium (2h min). Pas de CoQ10/B12/Rhodiola le soir.
  Zinc >8 sem → ajouter Cuivre.
- Marques suisses : Burgerstein, Pure Encapsulations, Nahrin, Sekoya

INTERDIT :
- Paragraphes longs ou repetitifs
- Tableau markdown avec pipes | |
- Justifications generiques non liees au profil du client`;

// V80 — Prompt one-shot (bilan individuel, sans suivi)
// Plan plus simple, autonome, applicable seul pendant 4 semaines.
// MEMES TITRES DE SECTIONS que FOUR_WEEKS_PROMPT (compatibilite parser + PDF),
// mais contenu plus leger et pas de "Plan d'action S1-S4" (pas de suivi prevu).
const ONESHOT_PLAN_PROMPT = `
Tu produis un plan nutritionnel ONE-SHOT (bilan individuel).

REGLE ABSOLUE :
Le client NE reviendra PAS pour un ajustement. Le plan doit etre APPLICABLE SEUL pendant 4 semaines.
Ne jamais ecrire "on ajustera ensemble", "on verra au prochain rdv", "je reviendrai sur ce point".
Le plan doit etre AUTOSUFFISANT.

PRIORITE : simplicite > exhaustivite.
Un plan simple applique = reussite.
Un plan parfait non applique = echec.

Produis le plan strictement avec les sections suivantes, dans cet ordre, sans rien ajouter avant ou apres.
1200 a 1500 mots maximum pour l'ensemble.

## 0. INTRODUCTION PERSONNALISEE
4 a 5 lignes. Ton humain, direct, rassurant. Reformulation de la situation + cadre simple.
Ne pas mentionner de suivi. Poser le cadre : 4 semaines en autonomie.

## 1. ANALYSE DU PROFIL
Format label : valeur (5 lignes max) :
- Objectif principal
- Probleme principal
- 2 problemes secondaires max
- Facteurs bloquants
- Niveau du plan (modere / exigeant)

## 2. STRATEGIE NUTRITIONNELLE
5 puces maximum, claires et directes.
Chaque puce = un levier action concret (pas de generalite).
Format label : valeur (Axe principal / Structure imposee / Timing / Aliments refuges / Exclusions).

## 3. SEMAINE 1 — STRUCTURE ALIMENTAIRE
Une journee type complete, calibree selon poids/sexe/objectif du client.
Format obligatoire :
Petit-dejeuner : [contenu + portions en grammes/ml]
Dejeuner : [idem]
Collation : [idem, seulement si pertinent]
Diner : [idem]

PORTIONS PRECISES OBLIGATOIRES (grammages ou mesures).
Pas de "selon appetit", pas de "quantite raisonnable".

## 4. ROTATION DES REPAS
4 categories maximum, 3-4 options chacune.
Format : chaque categorie sur une ligne "Categorie : option1 / option2 / option3".
Categories : Proteines, Feculents, Legumes, Matieres grasses.
IMPORTANT : separer les options par " / " (avec espaces) — jamais "1/2 avocat" sans espaces.

## 5. JOURNEE TYPE ALTERNATIVE
UNE seule variante, meme format que SEMAINE 1.
Cohérente avec les aliments de la rotation.

## 6. FICHE FRIGO (PRIORITAIRE)
Cette section est LA boussole quotidienne du client.
4 a 6 regles MAXIMUM — pas 7, pas 10.
Format bullet, phrases courtes, action directe.
Lisible en 10 secondes sur le frigo.
Pas de jargon, pas d'explications.

## 7. PROTOCOLES CIBLES
MAX 3 protocoles. Pas plus.
Chacun au format : "problem → action → benefice attendu" en UNE phrase.

## 8. AJUSTEMENTS ENVIRONNEMENTAUX
MAX 3-4 conseils concrets.
Hydratation, sommeil, mouvement, stress.
Formulations breves, actionnables.

## 9. RECOMMANDATIONS COACH
Structure en 2 blocs :
A GARDER : 3 actions cles a maintenir
A EVITER : 3 erreurs frequentes a ne pas reproduire

## 10. CLOTURE DU PLAN
Ton rassurant, autonome.
Le client doit se dire "je comprends, je peux, je commence demain".
PAS de reference a un futur suivi.
PAS de "reviens me voir".

STYLE OBLIGATOIRE :
- ton humain, direct, tutoiement
- varier structures de phrases (pas de pattern repetitif)
- phrases courtes acceptees
- pas de marketing, pas d'emoji
- pas de markdown cassé (pas de tableaux avec pipes)

INTERDITS ABSOLUS :
- mentionner un suivi, un futur rdv, un ajustement a venir
- surcharger en protocoles (max 3)
- proposer plus de 6 regles sur la fiche frigo
- donner des conseils generiques non lies au profil
- utiliser des phrases vagues ou non actionnables
`;

const FOUR_WEEKS_PROMPT = `
Produis le plan strictement avec les sections suivantes, dans cet ordre, sans rien ajouter avant ou apres.
1400 a 1800 mots maximum pour l'ensemble (intro + cloture compris).

## 0. INTRODUCTION PERSONNALISEE (OBLIGATOIRE)
4 a 6 lignes maximum. Entree en matiere naturelle, comme tu commencerais
une consultation ecrite. Ton humain, direct, sans marketing.

Contenu a integrer (dans l'ordre qui sonne le plus naturel) :
- Reformuler la situation reelle avec tes mots (pas coller le dossier)
- Montrer brievement que tu as compris ce qui gene aujourd'hui
- Poser la direction du plan (comment on va s'y prendre)
- Rassurer sans infantiliser

Tu peux demarrer par :
- Le prenom suivi d'une virgule (pas systematique, seulement si naturel)
- Un constat direct ("Ta situation melange plusieurs axes...")
- Une reformulation ("Tu arrives avec...")
- Une mise en perspective ("Ce que je retiens de ta situation...")

Exemple cible :

"Melissa,

Ta situation mele plusieurs axes : un diabete T1 a stabiliser, une digestion
fragile et un stress tres haut qui ronge ton energie. Ces trois couches se
parlent entre elles, et c'est cette dynamique qu'on va d'abord calmer.

L'objectif n'est pas de tout refaire d'un coup. On pose un cadre simple, on
ancre les premieres habitudes, puis on ajuste selon ce que ton corps
te renvoie."

INTERDIT :
- Phrases marketing ("felicitations", "ton engagement est une belle demarche")
- Style documentaire froid ("ce document vise a...")
- Promesses chiffrees ou irreellistes
- Pavé long (plus de 6 lignes)
- Formule type "Avec [probleme] + [probleme], ton corps est en desequilibre"
  si deja utilisee par ailleurs (varier naturellement)

## 1. ANALYSE DU PROFIL
Format tres court. Inclure uniquement :
- Objectif principal
- Probleme principal
- 2 problemes secondaires
- Facteurs bloquants
- Niveau de difficulte du plan
Maximum 5 lignes.

## 2. STRATEGIE NUTRITIONNELLE
Donner UNE strategie centrale unique. Inclure :
- Axe principal
- Structure alimentaire imposee
- Priorites d'action
- Ajustements cles
Maximum 5 puces.

## 3. SEMAINE 1 — STRUCTURE ALIMENTAIRE

- Donner UNE journee complete structuree (petit-dejeuner, dejeuner, collation, diner)
- Chaque repas : aliments concrets + portions (grammes ou unites familieres)
- Format simple, lisible, directement applicable
- NE PAS donner plusieurs jours complets — une seule journee type

Format attendu :
Petit-dejeuner : 2 oeufs brouilles + 1 tranche pain complet (40g) + 1/2 avocat + tisane
Dejeuner : 120g saumon + 80g quinoa cuit + legumes vapeur + 1 c.s. huile olive
Collation : 1 yaourt grec + 30g amandes
Diner : 100g blanc de poulet + 150g courgettes + 1 petite patate douce

Regles portions :
- Proteines : grammage obligatoire (ex : 120g saumon, 2 oeufs, 100g poulet)
- Feculents : grammage obligatoire (ex : 80g quinoa cuit, 1 tranche 40g)
- Legumes : portion indicative (ex : 150g, 1 bol, "volonte")
- Lipides : unite pratique (ex : 1 c.s. huile olive, 1/2 avocat, 30g amandes)
- 1 ligne maximum par repas

Portions absentes UNIQUEMENT dans : aliments autorises, aliments limites/interdits,
recommandations coach, protocoles (ces sections n'ont pas besoin de grammage).

## 4. ROTATION DES REPAS

Objectif : permettre au client de varier ses repas sans changer la structure.

- Donner des groupes d'aliments interchangeables
- Organiser par categories : proteines / feculents / legumes / matieres grasses
- Donner 3 a 5 options par categorie
- Inclure quelques exemples de substitutions concretes
- Le client doit comprendre comment construire ses repas seul

Format attendu :

Proteines (3-5 options) : 120g saumon / 100g poulet / 2 oeufs + 1 blanc / 130g tofu ferme / 100g dinde
Feculents (3-5 options) : 80g quinoa cuit / 80g riz complet / 150g patate douce / 1 tranche pain complet 40g / 80g sarrasin cuit
Legumes (3-5 options) : courgettes vapeur / haricots verts / brocolis / epinards / poelee ratatouille
Matieres grasses (3-5 options) : 1 c.s. huile olive / 1/2 avocat / 30g amandes / 30g noix / 1 c.s. tahini

Exemples de substitutions :
- Saumon du midi → tofu ferme ou dinde (meme grammage)
- Quinoa → riz complet ou sarrasin (meme grammage)
- Amandes → noix ou graines de courge (meme grammage)

## 5. JOURNEE TYPE ALTERNATIVE

- Donner UNE journee complete differente de la Semaine 1
- Meme structure (4 moments : petit-dejeuner / dejeuner / collation / diner)
- Aliments differents de la Semaine 1
- Toujours coherent avec les objectifs et contraintes du client
- Pas de repetition des memes repas qu'en Semaine 1
- Portions visibles (memes regles qu'en Semaine 1)

Format attendu :
Petit-dejeuner : porridge 40g flocons avoine + 1 c.s. beurre amande + 100g fruits rouges + tisane
Dejeuner : 130g tofu ferme + 80g sarrasin cuit + poelee ratatouille + 1 c.s. huile olive
Collation : 30g noix + 1 pomme
Diner : 100g dinde + 150g haricots verts + 1/2 patate douce

## 6. FICHE FRIGO

Objectif : donner des regles simples a retenir au quotidien.

- 4 a 6 regles maximum
- Format tres court (1 ligne par regle)
- Actionnable immediatement
- Directement lie aux problemes du client
- Pas de generalites nutritionnelles

Format attendu (exemple pour cliente T1 + stress + digestion) :
- Toujours proteines + fibres AVANT les glucides a chaque repas
- Jamais de fruit seul : l'associer a proteines ou oleagineux
- Legumes vapeur 2 semaines, on reintroduira le cru apres
- Tisane fenouil ou gingembre apres le diner
- Pas de diner apres 20h, sinon collation proteinee
- Eau filtree loin des repas (30 min avant / 1h apres)

## 7. PROTOCOLES CIBLES

Toujours partir du probleme reel du client. Ne jamais faire une liste generique.

Format : une phrase contexte + 3 a 5 actions.

La phrase contexte doit varier naturellement. Pool de formulations :
- "Pour stabiliser ta glycemie..."
- "Ce qu'on vise ici, c'est..."
- "La, le levier principal c'est..."
- "Ton axe prioritaire sur cet aspect..."
- "On va surtout travailler sur..."
- "Ici, l'idee est de..."
- "Pour corriger [probleme]..."

REGLE : ne pas utiliser deux fois la meme amorce dans le document.
Si "Pour stabiliser..." est utilisee pour la glycemie, utiliser une autre
formulation pour la digestion.

Actions :
- Concrete, applicable immediatement
- Mini logique implicite (sans expliquer la physiologie)
- Varier les verbes : associe, ajoute, integre, garde, remplace, teste,
  privilegie, limite, decale, commence par, pense a

Exemple attendu :

"Pour stabiliser ta glycemie avec ton diabete T1 :
- Associe toujours proteines + fibres des qu'il y a des glucides
- Ajoute un filet de vinaigre de cidre avant le repas du midi
- Garde une collation proteinee l'apres-midi pour eviter les chutes

Ce qu'on vise cote digestion :
- Commence chaque repas par les legumes puis les proteines
- Remplace les cruditoes par des legumes vapeur 2 semaines
- Teste une tisane fenouil apres le diner"

Maximum 3 protocoles. Uniquement si justifies par le profil.

INTERDIT :
- Liste brute sans phrase contexte
- Plus de 5 actions par protocole
- Repeter la meme amorce ("Pour corriger..." ou "Avec ton...") 2+ fois
- Phrases generiques sans lien au profil
- Repeter le meme verbe 3+ fois dans la meme section

## 8. AJUSTEMENTS ENVIRONNEMENTAUX
4-5 ajustements maximum, adaptes aux contraintes reelles du client.

Chaque ajustement = 2 a 3 phrases qui enchainent naturellement :
constat → action → (benefice).

Le constat NE DOIT PAS toujours commencer par "Ton [X] est..." qui devient
un pattern IA visible. Varier :
- "Ton [X] est actuellement..."
- "Cote [X], tu es a..."
- "Sur [l'axe], la situation aujourd'hui..."
- "[X] actuel :..." (puis phrase d'apres)
- Ou commencer directement par une observation ("Tu dors 6h fragmentees...")

Action : verbes varies (on monte, decale, integre, coupe, ajoute, remonte,
remplace, teste).

Benefice (optionnel, selon ce qui est pertinent) : formuler comme un
effet attendu, pas comme un objectif scolaire.

Exemples attendus (variete) :

"Hydratation actuelle autour d'1L. On monte progressivement a 1,5L cette
semaine, puis 2L. Cote concret, moins de fringales en milieu d'apres-midi
et une digestion plus facile.

Tu dors 6h fragmentees. Decale le diner a 19h max et coupe les ecrans une
heure avant le coucher pour laisser la melatonine remonter.

Cote stress, 10/10 aujourd'hui. On integre 3 minutes de respiration carree
avant le petit-dejeuner et apres le diner — c'est court mais ca casse
vraiment le cortisol du matin."

INTERDIT :
- Amorce "Ton [X] est actuellement..." repetee a chaque ajustement
- Phrases courtes type bullet sans logique ("Hydratation : 2L")
- Conseils generiques ("boire plus", "mieux dormir", "gerer le stress")
- Regles universelles sans contexte client

## 9. RECOMMANDATIONS COACH
3 regles directes + 3 erreurs a eviter + 1 focus prioritaire.

Chaque phrase reliee au client, sans pattern d'amorce repete.

Pool de formulations (alterner, ne pas repeter 2x la meme) :
- "Avec [probleme], tu..."
- "Vu [symptome], ..."
- "Pour toi, l'enjeu c'est..."
- "La, le point prioritaire..."
- "Ce qu'il faut tenir..."
- "[Contexte client] — donc..."
- Commencer directement par le verbe d'action ("Garde 3 repas fixes parce que
  sauter un repas avec ton diabete aggrave les desequilibres")

Exemple attendu (pour cliente diabete T1) — 3 regles directes avec variete :

"Regles a tenir :
- Avec ton diabete et tes variations glycemiques, sauter un repas aggrave
  les desequilibres. Tu gardes 3 prises alimentaires fixes chaque jour.
- Garde une source de proteines a chaque repas : c'est ce qui va vraiment
  ralentir les pics apres manger.
- Le soir, allege la charge pour ne pas charger ta digestion avant le coucher.

A eviter :
- Les glucides isoles (jus, pain blanc) : ils te mettent dans le mur en 30 min
- Sauter le petit-dejeuner sous pretexte de ne pas avoir faim
- Le grignotage stress de l'apres-midi — on l'anticipe avec une vraie collation

Focus pour les 2 prochaines semaines : poser les 3 repas fixes et installer
la collation proteinee de l'apres-midi. Le reste viendra."

Interdit :
- Amorce "Avec ton..." / "Vu ton..." repetee 2+ fois dans la section
- Phrases generiques applicables a tout le monde
- Regles absolues sans contexte ("tu dois", "il faut")
- Conseils vagues ("manger equilibre", "bien dormir")
- Repetition de regles classiques de nutrition deja connues

Objectif : le client doit sentir qu'Anissa parle vraiment et que chaque
ligne est faite pour lui, pas pour un autre.

## 10. PLAN D'ACTION (4 SEMAINES)

Objectif : donner une progression claire sans refaire 4 semaines completes.

- Structurer par semaine (S1 a S4)
- 1 a 2 objectifs MAXIMUM par semaine
- Progression logique obligatoire :
  S1 = mise en place (installer les bases, supprimer les blocages)
  S2 = stabilisation (ancrer les habitudes, ajuster)
  S3 = optimisation (affiner timing, quantites, protocoles)
  S4 = automatisation (autonome, preparer la suite)
- Format court, lisible
- NE PAS repeter les menus (la Semaine 1 et la Journee alternative suffisent)
- Chaque semaine doit refleter une progression sur le probleme principal

Format attendu :
S1 — Mise en place : poser les 3 repas fixes + installer la collation proteinee 16h
S2 — Stabilisation : ancrer les portions + tester la tisane fenouil post-diner
S3 — Optimisation : affiner timing dinner (avant 20h) + respiration carree matin/soir
S4 — Automatisation : repas construits en autonomie via la rotation + bilan avant RDV

Interdit :
- Progression generique ou interchangeable
- Plus de 2 actions par semaine
- Reprendre les menus dans chaque semaine

## 11. CLOTURE DU PLAN (OBLIGATOIRE)
4 a 6 lignes maximum. Vraie fin de consultation ecrite : rassurante, simple,
engageante, orientee progression.

Tu peux demarrer par (varier selon ce qui sonne juste) :
- "Ce plan te donne un cadre simple pour..."
- "Prends ce plan comme une base..."
- "Pour les prochaines semaines..."
- "Garde en tete que..."
- Une phrase qui reprend subtilement l'objectif ("Stabiliser ta glycemie
  passe d'abord par la regularite...")

Contenu a integrer (dans un ordre qui coule) :
- Poser le cap des prochaines semaines
- Relativiser la perfection (regularite > perfection)
- Valoriser les premiers effets attendus (concrets, pas "tu vas aller mieux")
- Ouvrir sur le suivi/l'ajustement (elle n'est pas seule)

Exemple cible :

"Prends ce plan comme une base, pas comme une contrainte. On cherche de la
regularite, pas de la perfection.

Les premiers jours, tu devrais deja sentir une glycemie plus stable et
moins de fringales l'apres-midi.

Les semaines suivantes, on ajuste ensemble selon ce que tu observes. Tu n'es
pas seule la-dedans."

INTERDIT :
- Ton froid ou impersonnel ("bonne continuation", "bon courage")
- Phrases generiques sans substance
- Jargon clinique
- Promesses chiffrees ("tu perdras 3 kg")
- Style coach Instagram ("tu vas tout dechirer")

REGLES DE SORTIE :
- Aucune section bonus, aucune annexe, aucun resume supplementaire
- Aucun tableau de supplements (gere separement)
- Aucun commentaire de wordcount
- Stop strict apres la section 10`;

const AUDIT_PROMPT = `Tu es un auditeur nutrition. Analyse ce plan nutritionnel et verifie :

1. ALLERGIES/INTOLERANCES : aucun aliment interdit ne doit apparaitre dans les menus
2. COHERENCE MACROS : les macros de chaque repas doivent etre coherents avec le total calcule
3. CONTRADICTIONS : aucune recommandation ne doit contredire une autre section
4. SUPPLEMENTS : si presents, verifier timing correct et pas de combinaisons interdites
5. COMPLETUDE : toutes les sections attendues sont presentes

Pour chaque probleme trouve :
- Decris le probleme
- Indique la correction exacte

Si aucun probleme : reponds "AUDIT OK — aucune incoherence detectee."
Si problemes : liste-les et fournis le texte corrige pour chaque section concernee.`;

// Helper: build the system prompt with conditional modules
// fullPlan: true = plan 4 semaines (premiere consultation), false = ajustements (suivi)
// V86.6 : nouveau param `client` (optionnel, backward compatible). Si
// getClientNutritionLocale(client) === 'EN', on short-circuit vers les prompts EN
// dedies — aucune modification du chemin FR en dehors de ce garde en tete.
function buildSystemPrompt(form, opts = {}, client = null) {
  if (client && getClientNutritionLocale(client) === 'EN') {
    return buildSystemPromptEn(form, opts);
  }
  const { isFollowup = false, clientFormule = '', followupWeek = 0, planMode = 'followup' } = opts;
  const parts = [SYSTEM_PROMPT, SWISS_BRANDS_PROMPT];

  // Supplements: include if client is open to them (Oui or Peut-etre)
  const pretProtocole = form?.pretProtocole || '';
  if (pretProtocole === 'Oui' || pretProtocole === 'Peut-etre') {
    parts.push(SUPPLEMENT_PROMPT);
  }

  if (isFollowup && followupWeek > 0) {
    // Followup: progressive adjustment prompt based on week number
    parts.push(buildFollowupPrompt(followupWeek));
  } else if (planMode === 'oneshot') {
    // V80 : bilan individuel one-shot — plan autonome, pas de suivi
    parts.push(ONESHOT_PLAN_PROMPT);
  } else {
    // 4-week plan: include for formules with ongoing nutritional follow-up
    const recurrentFormules = ['suivi', 'intensif', 'autonome', 'nutrition', 'custom'];
    const normalizedFormule = (clientFormule || '').trim().toLowerCase();
    const isFullPlanFormule = recurrentFormules.includes(normalizedFormule);
    if (isFullPlanFormule) {
      parts.push(FOUR_WEEKS_PROMPT);
    }
  }

  return parts.join('\n\n');
}

// V55 : System prompt dedie aux supplements - STRICT (ne regenere JAMAIS de plan)
// Retire SYSTEM_PROMPT qui contenait "TA MISSION : creer un plan" (cause de duplication)
// Garde seulement l'identite + regles supplements + contexte suisse
function buildSupplementsSystemPrompt() {
  return `${ANISSA_IDENTITY_CORE}

${SWISS_BRANDS_PROMPT}

${SUPPLEMENT_PROMPT}

TA MISSION : Rediger UNIQUEMENT la section SUPPLEMENTS RECOMMANDES.
INTERDICTIONS STRICTES :
- NE PAS rediger de plan nutritionnel (pas de semaines, pas de menus, pas de strategie)
- NE PAS rediger de synthese clinique, regles de base, ou journees types
- NE PAS inclure les sections "PLAN NUTRITIONNEL PERSONNALISE", "ANALYSE DU PROFIL", etc.
- Demarrer directement par "SUPPLEMENTS RECOMMANDES" puis la liste des supplements
- Format : texte brut, pas de markdown (pas de **gras**, pas de # titres)
- Pas d'emojis (pas de 🥑, 💧, ✓, etc.)
- Pas de tableau ASCII avec pipes | | (utiliser format texte simple)`;
}

// ─── FOLLOWUP WEEKLY PROMPTS ───

const INITIAL_WEEKLY_FEEDBACK = {
  energy: '',
  digestion: '',
  hunger: '',
  adherence: '',
  performance: '',
  cravings: '',
  notes: '',
};

const FOLLOWUP_WEEK_INSTRUCTIONS = {
  1: `SEMAINE 1 — TOLERANCE & ADHERENCE :
- Objectif : evaluer la tolerance au plan initial et l'adherence du client.
- Ajustements autorises : MINIMES (digestion, portions, horaires repas).
- Ne PAS modifier les macros ni la structure globale.
- Si adherence faible : simplifier, pas complexifier.
- Si troubles digestifs : reduire fibres/fermentes, revenir a des aliments neutres.
- Maximum 2-3 ajustements concrets.`,

  2: `SEMAINE 2 — PREMIERS AJUSTEMENTS :
- Objectif : ajuster energie, faim et digestion selon le feedback.
- Ajustements autorises : portions, repartition glucides, timing collations, hydratation.
- Si faim excessive : augmenter proteines ou ajouter collation.
- Si energie basse : verifier glucides pre-entrainement et sommeil.
- Si digestion ok : introduction progressive d'aliments plus varies.
- Maximum 3-4 ajustements concrets.`,

  3: `SEMAINE 3 — OPTIMISATION :
- Objectif : optimiser portions, timing, recuperation et performance.
- Ajustements autorises : macros fins, timing peri-entrainement, supplements si pertinent.
- Si performance stagne : ajuster glucides autour de l'effort.
- Si cravings persistantes : verifier deficits (magnesium, chrome, sommeil).
- Commencer a preparer l'autonomie du client.
- Maximum 3-4 ajustements concrets.`,

  4: `SEMAINE 4 — CONSOLIDATION & AUTONOMIE :
- Objectif : consolider les acquis, preparer le client a etre autonome.
- Proposer des substitutions pour varier sans perdre l'equilibre.
- Valider les habitudes installees, identifier celles a renforcer.
- Fournir un mini-guide d'autonomie : quoi faire si voyage, restaurant, fatigue.
- Ajustements uniquement si necessaire — stabiliser.
- Maximum 2-3 ajustements concrets.`,
};

function buildFollowupPrompt(weekNum) {
  const week = Math.min(Math.max(weekNum || 1, 1), 4);
  return `
CONTEXTE : Tu fais un suivi hebdomadaire, pas un nouveau plan.
Objectif : analyser ce qui fonctionne et ajuster avec un minimum de changements.

${ADJUSTMENT_RULE}

CONSULTATION DE SUIVI — SEMAINE ${week}/4

Tu generes un AJUSTEMENT du plan existant, PAS un nouveau plan complet.
Le client suit deja un protocole nutritionnel. Tu dois :
1. Analyser le feedback hebdomadaire du client
2. Comparer avec les objectifs initiaux
3. Proposer des ajustements cibles et progressifs

PRIORITE CLINIQUE DU SUIVI (TOUJOURS respecter cet ordre) :
digestion > adherence > energie > faim/cravings > performance > objectif
Si digestion ou adherence sont mauvaises → simplifier le plan avant toute optimisation.
Ne jamais optimiser timing/portions/performance si la base (digestion + adherence) n'est pas stable.

REGLES DE SUIVI :
- Maximum 2-4 ajustements par semaine
- Ne pas casser la structure existante
- Garder ce qui fonctionne, modifier seulement ce qui bloque

${FOLLOWUP_WEEK_INSTRUCTIONS[week]}

FORMAT DE SORTIE :
- BILAN DE LA SEMAINE : resume factuel du feedback (3-5 lignes)
- AJUSTEMENTS PROPOSES : liste numerotee, chaque ajustement = 1 action concrete
- PLAN MIS A JOUR : uniquement les repas/jours modifies (pas tout le plan)
- PROCHAINE ETAPE : ce que le client doit observer pour la semaine suivante`;
}

// V55 : instruction renforcee - STRICT pour eviter generation plan
const SUPPLEMENTS_INSTRUCTION = `TACHE EXCLUSIVE : redige UNIQUEMENT la section des supplements recommandes.

NE PAS rediger de plan nutritionnel, menus, journees types, strategie, synthese clinique,
regles de base, rotations, fiche frigo, ou ajustements environnementaux.
Demarre DIRECTEMENT par "SUPPLEMENTS RECOMMANDES" et rien avant.

Format pour chaque supplement (5-6 max) :
Nom du supplement (en majuscules)
- Sources alimentaires : aliments + quantites
- Complement si insuffisant : dosage, moment, forme, marque suisse
- Justification : 1 phrase liee au profil
- Interactions : 1 ligne si pertinent
- Duree : X semaines / mois

REGLES :
- Pas d'emojis (pas de 🥑💧✓ etc.)
- Pas de markdown (**gras**, # titres, tableaux | |)
- Texte brut lisible
- Tutoiement`;

// ─── PLAN QUALITY SCORING ───

// V94.26 : scorePlanQuality extraite vers services/nutritionScoring.js

// V53 : Score display unifie — UX simplifiee (1 seul bloc)
// Affiche un resume (OK / a ameliorer) avec details on-demand + audit IA integre
function PlanQualityScore({ score, autoCorrected, aiAnalysis, analyzing, aiAnalysisError, onAnalyze, planSignatureCurrent, analysesError, onInsertQuickWin, onRevisitWin, insertedWinsMap }) {
  // Hooks must be unconditional — move them before the early return
  const [showDetails, setShowDetails] = useState(false);
  if (!score) return null;

  const getColor = (val, max = 10) => {
    const pct = val / max;
    if (pct >= 0.8) return '#2a9d5c';
    if (pct >= 0.6) return '#e8a040';
    return '#d45c4c';
  };

  // Compter les problemes a afficher
  const issuesCount = (score.hardFails?.length || 0) + (score.penalties?.length || 0);
  const isHealthy = !score.hasHardFail && score.normalized >= 8;
  const isWarning = !score.hasHardFail && score.normalized >= 6 && score.normalized < 8;

  const axes = [
    { key: 'coherence', label: 'Coherence', desc: 'Allergies, macros, contradictions, ton' },
    { key: 'simplicity', label: 'Simplicite', desc: 'Mots, lignes, nb supplements' },
    { key: 'applicability', label: 'Applicabilite', desc: 'Quantites, structure, sections, fiche frigo' },
    { key: 'constraints', label: 'Contraintes', desc: 'Pathologies, sport, profil client' },
  ];

  // Stale detection pour audit IA
  const isStale = aiAnalysis?.planSignature && aiAnalysis.planSignature !== planSignatureCurrent;

  // Couleur du bandeau principal
  const bannerColor = isHealthy
    ? { bg: 'rgba(42,157,92,.08)', border: 'rgba(42,157,92,.3)', text: '#5fbd82' }
    : isWarning
    ? { bg: 'rgba(232,160,64,.08)', border: 'rgba(232,160,64,.3)', text: '#e8a040' }
    : { bg: 'rgba(212,92,76,.08)', border: 'rgba(212,92,76,.3)', text: '#e57c6c' };

  return (
    <div style={{
      background: bannerColor.bg,
      border: `1px solid ${bannerColor.border}`,
      borderRadius: 12, padding: '12px 16px', marginBottom: 16,
    }}>
      {/* BANDEAU RESUME */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 10, flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '1.1rem' }}>
            {isHealthy ? '✅' : isWarning ? '⚠️' : '🚫'}
          </span>
          <div>
            <div style={{ fontSize: '.85rem', fontWeight: 700, color: bannerColor.text }}>
              {isHealthy ? 'Plan pret a envoyer'
                : score.hasHardFail ? 'Echec critique — revoir le plan'
                : `Plan a ameliorer — ${issuesCount} point${issuesCount > 1 ? 's' : ''} a corriger`}
            </div>
            <div style={{ fontSize: '.7rem', color: 'rgba(255,255,255,.4)', marginTop: 2 }}>
              {autoCorrected && '✨ Auto-corrige · '}
              Qualite {score.normalized}/10
              {aiAnalysis?.analyzedAt && !isStale && ` · Audit IA : ${aiAnalysis.score}/100`}
              {aiAnalysis && isStale && ' · ⚠ Audit IA obsolete'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          {!isHealthy && (
            <button
              type="button"
              onClick={() => setShowDetails(s => !s)}
              style={{
                padding: '5px 12px', borderRadius: 7,
                border: '1px solid rgba(255,255,255,.15)',
                background: 'rgba(255,255,255,.04)',
                color: 'rgba(255,255,255,.65)', cursor: 'pointer',
                fontSize: '.72rem', fontWeight: 600,
              }}
            >
              {showDetails ? 'Masquer' : 'Voir details'}
            </button>
          )}
          <button
            type="button"
            disabled={analyzing}
            onClick={onAnalyze}
            style={{
              padding: '5px 12px', borderRadius: 7,
              border: '1px solid rgba(124,92,191,.35)',
              background: 'rgba(124,92,191,.12)',
              color: '#b89ef0', cursor: analyzing ? 'wait' : 'pointer',
              fontSize: '.72rem', fontWeight: 600,
              opacity: analyzing ? 0.6 : 1, whiteSpace: 'nowrap',
            }}
          >
            {analyzing ? '✨ Analyse...' : aiAnalysis ? '🔁 Re-analyser IA' : '🔬 Analyser avec IA'}
          </button>
        </div>
      </div>

      {/* DETAILS RULES-BASED (toggle) */}
      {showDetails && !isHealthy && (
        <div style={{
          marginTop: 12, paddingTop: 12,
          borderTop: '1px solid rgba(255,255,255,.08)',
        }}>
          <div style={{ fontSize: '.7rem', fontWeight: 700, color: '#e8a040', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.3px' }}>
            🔧 Ajustements necessaires
          </div>

          {score.hasHardFail && (
            <div style={{ marginBottom: 10, padding: '8px 10px', background: 'rgba(212,92,76,.08)', border: '1px solid rgba(212,92,76,.2)', borderRadius: 7, fontSize: '.75rem', color: '#e57c6c' }}>
              <strong>Echec critique :</strong> {score.hardFails.join(' · ')}
            </div>
          )}

          {score.penalties.length > 0 && (
            <div style={{ fontSize: '.75rem', color: 'rgba(255,255,255,.6)', lineHeight: 1.5, marginBottom: 10 }}>
              {score.penalties.map((p, i) => (
                <div key={i}>• {p}</div>
              ))}
            </div>
          )}

          {/* Mini-grid des 4 axes */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 6, marginTop: 8 }}>
            {axes.map(({ key, label }) => (
              <div key={key} style={{
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', fontSize: '.7rem',
                padding: '4px 8px', borderRadius: 5,
                background: 'rgba(255,255,255,.03)',
              }}>
                <span style={{ color: 'rgba(255,255,255,.6)' }}>{label}</span>
                <span style={{ color: getColor(score[key]), fontWeight: 700 }}>{score[key]}/10</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AUDIT IA (affiche si analyse disponible) */}
      {aiAnalysisError && !aiAnalysis && (
        <div style={{
          marginTop: 12, padding: '8px 12px',
          background: 'rgba(248,113,113,.08)',
          border: '1px solid rgba(248,113,113,.25)',
          borderRadius: 7, fontSize: '.75rem', color: '#f87171',
        }}>
          ⚠️ {aiAnalysisError}
        </div>
      )}

      {aiAnalysis && (
        <div style={{
          marginTop: 12, paddingTop: 12,
          borderTop: '1px solid rgba(255,255,255,.08)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: '.7rem', fontWeight: 700, color: '#b89ef0', textTransform: 'uppercase', letterSpacing: '.3px' }}>
              🔬 Audit IA
            </span>
            <span style={{
              fontSize: '.82rem', fontWeight: 700,
              color: aiAnalysis.score >= 80 ? '#5fbd82' : aiAnalysis.score >= 60 ? '#e8a040' : '#e57c6c',
            }}>
              {aiAnalysis.score}/100
            </span>
            {isStale && (
              <span style={{
                fontSize: '.6rem', fontWeight: 700,
                padding: '2px 7px', borderRadius: 10,
                background: 'rgba(232,160,64,.18)',
                color: '#e8a040',
              }}>
                ⚠ OBSOLETE
              </span>
            )}
          </div>

          {aiAnalysis.verdict && (
            <div style={{ fontSize: '.75rem', fontStyle: 'italic', color: 'rgba(255,255,255,.6)', marginBottom: 8 }}>
              « {aiAnalysis.verdict} »
            </div>
          )}

          {aiAnalysis.strengths?.length > 0 && (
            <div style={{ marginBottom: 6 }}>
              <div style={{ fontSize: '.65rem', fontWeight: 700, color: '#5fbd82', marginBottom: 2 }}>✔ POINTS FORTS</div>
              {aiAnalysis.strengths.slice(0, 3).map((s, i) => (
                <div key={i} style={{ fontSize: '.72rem', color: 'rgba(255,255,255,.55)', marginLeft: 8, lineHeight: 1.35 }}>• {s}</div>
              ))}
            </div>
          )}

          {aiAnalysis.issues?.length > 0 && (
            <div style={{ marginBottom: 6 }}>
              <div style={{ fontSize: '.65rem', fontWeight: 700, color: '#e8a040', marginBottom: 2 }}>⚠ A AMELIORER</div>
              {aiAnalysis.issues.slice(0, 4).map((issue, i) => (
                <div key={i} style={{ fontSize: '.72rem', color: 'rgba(255,255,255,.55)', marginLeft: 8, lineHeight: 1.35 }}>• {issue}</div>
              ))}
            </div>
          )}

          {aiAnalysis.quickWins?.length > 0 && (
            <div>
              <div style={{ fontSize: '.65rem', fontWeight: 700, color: '#b89ef0', marginBottom: 4 }}>💡 CORRECTIONS RAPIDES</div>
              {aiAnalysis.quickWins.slice(0, 5).map((win, i) => {
                const routed = routeQuickWin(win);
                const target = routed ? sectionLabel(routed) : null;
                const inserted = insertedWinsMap && insertedWinsMap[win]; // V79.3
                return (
                  <div
                    key={i}
                    style={{
                      display: 'flex', gap: 8, alignItems: 'flex-start',
                      fontSize: '.72rem', color: 'rgba(255,255,255,.65)',
                      marginLeft: 4, marginBottom: 6, lineHeight: 1.4,
                    }}
                  >
                    <span style={{ flex: 1 }}>
                      • {win}
                      {target && (
                        <span style={{
                          fontSize: '.62rem', color: inserted ? '#5fbd82' : '#b89ef0',
                          marginLeft: 6, letterSpacing: '.5px',
                          background: inserted ? 'rgba(95,189,130,.12)' : 'rgba(184,158,240,.1)',
                          padding: '1px 6px', borderRadius: 4,
                          whiteSpace: 'nowrap',
                        }}>
                          → {target}
                        </span>
                      )}
                    </span>
                    {inserted && onRevisitWin ? (
                      <button
                        type="button"
                        onClick={() => onRevisitWin(win)}
                        title={`Voir dans ${sectionLabel(inserted)}`}
                        style={{
                          flexShrink: 0,
                          padding: '3px 10px', borderRadius: 6,
                          border: '1px solid rgba(95,189,130,.4)',
                          background: 'rgba(95,189,130,.12)',
                          color: '#5fbd82',
                          fontSize: '.68rem', fontWeight: 600,
                          cursor: 'pointer', transition: 'all .15s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(95,189,130,.22)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(95,189,130,.12)'}
                      >
                        ✓ Revoir
                      </button>
                    ) : onInsertQuickWin && (
                      <button
                        type="button"
                        onClick={() => onInsertQuickWin(win)}
                        disabled={!routed}
                        title={routed ? `Insérer dans ${target}` : 'Aucune section cible détectée'}
                        style={{
                          flexShrink: 0,
                          padding: '3px 10px', borderRadius: 6,
                          border: '1px solid ' + (routed ? 'rgba(184,158,240,.4)' : 'rgba(255,255,255,.1)'),
                          background: routed ? 'rgba(184,158,240,.12)' : 'rgba(255,255,255,.03)',
                          color: routed ? '#c4aff2' : 'rgba(255,255,255,.25)',
                          fontSize: '.68rem', fontWeight: 600,
                          cursor: routed ? 'pointer' : 'not-allowed',
                          transition: 'all .15s',
                        }}
                        onMouseEnter={e => { if (routed) e.currentTarget.style.background = 'rgba(184,158,240,.22)'; }}
                        onMouseLeave={e => { if (routed) e.currentTarget.style.background = 'rgba(184,158,240,.12)'; }}
                      >
                        ↳ Insérer
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// V94.26 : shouldAutoCorrect + buildCorrectionPrompt extraits vers services/nutritionScoring.js

// V94.28 : LEARNING_LOG_KEY + buildLearningSignal + saveLearningSignal + getLearningInsights extraits vers services/learningStore.js

// V94.26 : validatePlanForPDF + cleanPlanForPDF extraites vers services/nutritionScoring.js

// V94.29 : SUPPLEMENT_NAME_RE + isLikelySupplementName + structurePlanSections extraits vers services/planFormatters.js

// V91.0 : classifySection (FR-style, 16 types) supprimee.
// detectSectionType (canonical, services/nutritionParsers.js) prend le relais.
// Le PDF switch attend les types EN-style (profile/protocol/coach/...) et tombait
// auparavant en default sur les types FR (analyse/principes/protocoles/...).
// Resultat : sections desormais correctement typees → rendu specialise au lieu
// du fallback generique.

// V76 : NutritionPdfBody + renderSectionContent + renderLine supprimes.
// Ces helpers rendaient l'apercu HTML du PDF dans la modale Apercu PDF (retiree).
// L'editeur premium (NutritionEditor + nutritionEditorParsers) remplit deja ce role.

// ─── QUALITY DASHBOARD ───

function NutritionQualityDashboard() {
  const insights = getLearningInsights();
  if (!insights || insights.total === 0) {
    return (
      <div style={{ background: '#F5F2EC', borderRadius: 10, padding: '16px 20px', marginTop: 12, fontSize: '.82rem', color: '#4A4A42' }}>
        Aucune donnee de generation disponible.
      </div>
    );
  }

  const { total, avgScoreInitial, avgScoreFinal, autoCorrectionRate, initialHardFailRate, finalHardFailRate, topPenalties, profilePatterns } = insights;

  const getColor = (val, good, bad) => val >= good ? '#2a9d5c' : val >= bad ? '#e8a040' : '#d45c4c';

  const MetricCard = ({ label, value, suffix, good, bad }) => (
    <div style={{ background: '#fff', borderRadius: 8, padding: '10px 14px', textAlign: 'center' }}>
      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: good != null ? getColor(typeof value === 'number' ? value : 0, good, bad) : '#1A2E1F' }}>
        {value}{suffix || ''}
      </div>
      <div style={{ fontSize: '.7rem', color: '#8a8a7a', marginTop: 2 }}>{label}</div>
    </div>
  );

  return (
    <div style={{ background: '#F5F2EC', borderRadius: 10, padding: '20px 24px', marginTop: 12, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <strong style={{ fontSize: '.9rem', color: '#1A2E1F' }}>Historique qualite IA (toutes generations)</strong>
        <span style={{ fontSize: '.7rem', color: '#8a8a7a' }}>{total} generation{total > 1 ? 's' : ''}</span>
      </div>

      {/* Metrics grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
        <MetricCard label="Score initial moyen" value={avgScoreInitial} suffix="/10" good={7} bad={5} />
        <MetricCard label="Score final moyen" value={avgScoreFinal} suffix="/10" good={7} bad={5} />
        <MetricCard label="Taux auto-correction" value={autoCorrectionRate} suffix="%" good={80} bad={100} />
        <MetricCard label="Hard fail initial" value={initialHardFailRate} suffix="%" good={0} bad={10} />
      </div>

      {/* Hard fail resolution */}
      {initialHardFailRate > 0 && (
        <div style={{ background: '#fff', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: '.78rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ color: '#4A4A42' }}>Hard fails resolus par auto-correction</span>
            <span style={{ fontWeight: 700, color: finalHardFailRate < initialHardFailRate ? '#2a9d5c' : '#d45c4c' }}>
              {initialHardFailRate}% → {finalHardFailRate}%
            </span>
          </div>
          <div style={{ height: 4, background: 'rgba(26,46,31,.08)', borderRadius: 4 }}>
            <div style={{ height: '100%', width: `${100 - finalHardFailRate}%`, background: '#2a9d5c', borderRadius: 4 }} />
          </div>
        </div>
      )}

      {/* Top penalties */}
      {topPenalties.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: '.78rem', fontWeight: 600, color: '#1A2E1F', marginBottom: 6 }}>Top problemes detectes</div>
          {topPenalties.map((p, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid rgba(26,46,31,.06)', fontSize: '.76rem' }}>
              <span style={{ color: '#4A4A42', flex: 1 }}>{p.penalty}</span>
              <span style={{ color: '#8a8a7a', marginLeft: 8, flexShrink: 0 }}>{p.count}x ({p.pct}%)</span>
            </div>
          ))}
        </div>
      )}

      {/* Profile patterns */}
      {Object.keys(profilePatterns).length > 0 && (
        <div>
          <div style={{ fontSize: '.78rem', fontWeight: 600, color: '#1A2E1F', marginBottom: 6 }}>Profils les plus corriges</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {Object.entries(profilePatterns).sort((a, b) => b[1] - a[1]).map(([key, count]) => (
              <span key={key} style={{ background: '#fff', border: '1px solid rgba(26,46,31,.1)', borderRadius: 100, padding: '4px 12px', fontSize: '.72rem', color: '#4A4A42' }}>
                {key} ({count})
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MGD ANALYSIS PDF ───

// Map form fields to MGD symptom keys
// V94.27 : detectSymptomsFromForm + buildPreRdvSummary extraits vers services/clinicalProfile.js

function validateAnalysesPDF(symptoms, recommendations) {
  const errors = [];
  if (!symptoms || symptoms.length === 0) {
    errors.push('Aucun symptome detecte — impossible de recommander des analyses');
  }
  if (!recommendations || (recommendations.essential.length === 0 && recommendations.relevant.length === 0)) {
    errors.push('Aucune analyse recommandee');
  }
  return { valid: errors.length === 0, errors };
}

async function exportAnalysesPDF(recommendations, symptoms, clientName, dateStr) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pw = doc.internal.pageSize.getWidth();
  const margin = 22;
  const cw = pw - margin * 2;
  let y = 20;

  // Background
  doc.setFillColor(245, 242, 236);
  doc.rect(0, 0, pw, 297, 'F');

  // Header
  doc.setFontSize(8);
  doc.setTextColor(138, 138, 122);
  doc.text(clientName, margin, y);
  doc.text('Analyses biologiques recommandees', pw / 2, y, { align: 'center' });
  doc.text(dateStr, pw - margin, y, { align: 'right' });
  y += 4;
  doc.setDrawColor(26, 46, 31);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pw - margin, y);
  y += 10;

  // Intro
  doc.setFontSize(9);
  doc.setTextColor(74, 74, 66);
  const introLines = doc.splitTextToSize('Ces analyses permettent d\'objectiver certains desequilibres potentiels et de mieux personnaliser votre accompagnement nutritionnel. A discuter et valider avec votre medecin ou professionnel de sante.', cw);
  for (const line of introLines) { doc.text(line, margin, y); y += 4.5; }
  y += 6;

  // Context
  if (symptoms.length > 0) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(26, 46, 31);
    doc.text('Contexte : ', margin, y);
    const ctxX = margin + doc.getTextWidth('Contexte : ');
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(74, 74, 66);
    doc.text(symptoms.map(s => s.replace(/_/g, ' ')).join(', '), ctxX, y);
    y += 8;
  }

  // Render section
  const renderSection = (title, items, dotColor) => {
    if (!items || items.length === 0) return;

    // Check page break
    if (y > 255) { doc.addPage(); doc.setFillColor(245, 242, 236); doc.rect(0, 0, pw, 297, 'F'); y = 20; }

    // Title
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(26, 46, 31);
    doc.setFillColor(...dotColor);
    doc.circle(margin + 2, y - 1.5, 1.5, 'F');
    doc.text(title.toUpperCase(), margin + 7, y);
    y += 2;
    doc.setDrawColor(26, 46, 31);
    doc.setLineWidth(0.5);
    doc.line(margin + 7, y, margin + 7 + doc.getTextWidth(title.toUpperCase()), y);
    y += 6;

    // Items
    for (const item of items) {
      if (y > 270) { doc.addPage(); doc.setFillColor(245, 242, 236); doc.rect(0, 0, pw, 297, 'F'); y = 20; }

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(26, 46, 31);
      doc.text(item.label, margin + 4, y);

      // Category tag
      if (item.category && item.category !== 'Analyse fonctionnelle') {
        const labelW = doc.getTextWidth(item.label);
        doc.setFontSize(6.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(138, 138, 122);
        doc.text(item.category, margin + 4 + labelW + 4, y);
      }
      y += 4;

      // Rationale
      if (item.rationale.length > 0) {
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(138, 138, 122);
        doc.text(item.rationale.slice(0, 3).join(', '), margin + 4, y);
        y += 4;
      }
      y += 1;
    }
    y += 4;
  };

  renderSection('Analyses essentielles', recommendations.essential, [26, 46, 31]);
  renderSection('Analyses pertinentes', recommendations.relevant, [232, 160, 64]);
  renderSection('Analyses optionnelles', recommendations.optional, [138, 138, 122]);

  // Practical tips
  if (y > 250) { doc.addPage(); doc.setFillColor(245, 242, 236); doc.rect(0, 0, pw, 297, 'F'); y = 20; }
  doc.setDrawColor(26, 46, 31);
  doc.setLineWidth(0.8);
  doc.line(margin, y, margin, y + 22);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(26, 46, 31);
  doc.text('Conseils pratiques', margin + 4, y + 4);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(74, 74, 66);
  const tips = [
    'A jeun pour les prises de sang (12h si bilan lipidique)',
    'Eviter le sport intense la veille',
    'Apporter cette liste au laboratoire ou a votre medecin',
    'Certains examens dependent du contexte — a individualiser',
  ];
  tips.forEach((tip, i) => { doc.text('- ' + tip, margin + 4, y + 9 + i * 4); });

  // Footer
  const ph = doc.internal.pageSize.getHeight();
  doc.setFontSize(7);
  doc.setTextColor(138, 138, 122);
  const totalAnalyses = recommendations.essential.length + recommendations.relevant.length + recommendations.optional.length;
  doc.text('Anissa Deroubaix Nutrition', margin, ph - 10);
  doc.text(`${totalAnalyses} analyses recommandees`, pw - margin, ph - 10, { align: 'right' });

  doc.save(`analyses-${clientName.toLowerCase().replace(/\s+/g, '-')}-${dateStr.replace(/\//g, '-')}.pdf`);
}

function AnalysisPdfBody({ recommendations, symptoms, clientName, date }) {
  if (!recommendations) return null;

  const { essential, relevant, optional } = recommendations;
  const hasContent = essential.length > 0 || relevant.length > 0;
  if (!hasContent) return null;

  const pageHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(26,46,31,.12)', paddingBottom: 8, marginBottom: 16, fontSize: '.7rem', color: '#8a8a7a' };
  const sectionTitle = { color: '#1A2E1F', fontSize: '.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', borderBottom: '2px solid #1A2E1F', paddingBottom: 5, marginBottom: 10 };

  const AnalysisItem = ({ item }) => (
    <div style={{ padding: '6px 0', borderBottom: '1px solid rgba(26,46,31,.05)' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
        <span style={{ color: '#1A2E1F', fontWeight: 600 }}>{item.label}</span>
        {item.category && item.category !== 'Analyse fonctionnelle' && (
          <span style={{ fontSize: '.68rem', color: '#fff', background: 'rgba(26,46,31,.55)', borderRadius: 100, padding: '1px 8px', flexShrink: 0 }}>{item.category}</span>
        )}
      </div>
      {item.rationale.length > 0 && (
        <div style={{ fontSize: '.75rem', color: '#8a8a7a', marginTop: 2 }}>{item.rationale.slice(0, 3).join(', ')}</div>
      )}
    </div>
  );

  const SectionBlock = ({ title, items, color }) => {
    if (!items || items.length === 0) return null;
    return (
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
          <h4 style={sectionTitle}>{title}</h4>
        </div>
        <div style={{ background: '#fff', borderRadius: 8, padding: '8px 14px' }}>
          {items.map((item, i) => <AnalysisItem key={i} item={item} />)}
        </div>
      </div>
    );
  };

  return (
    <div style={{ background: '#F5F2EC', color: '#1A2E1F', borderRadius: 10, padding: '24px 28px', marginTop: 12, fontSize: '.83rem', lineHeight: 1.65, fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Header */}
      <div style={pageHeader}>
        <span>{clientName}</span>
        <span>Analyses biologiques recommandees</span>
        <span>{date}</span>
      </div>

      {/* Intro */}
      <div style={{ background: '#fff', borderRadius: 8, padding: '12px 16px', marginBottom: 18, fontSize: '.8rem', color: '#4A4A42', lineHeight: 1.6 }}>
        <p style={{ margin: 0 }}>Ces analyses permettent d'objectiver certains desequilibres potentiels et de mieux personnaliser votre accompagnement nutritionnel.</p>
        <p style={{ margin: '6px 0 0', fontStyle: 'italic', fontSize: '.76rem', color: '#8a8a7a' }}>A discuter et valider avec votre medecin ou professionnel de sante.</p>
      </div>

      {/* Context */}
      {symptoms.length > 0 && (
        <div style={{ marginBottom: 16, fontSize: '.78rem', color: '#4A4A42' }}>
          <strong style={{ color: '#1A2E1F' }}>Contexte : </strong>
          {symptoms.map(s => s.replace(/_/g, ' ')).join(', ')}
        </div>
      )}

      {/* Sections */}
      <SectionBlock title="Analyses essentielles" items={essential} color="#1A2E1F" />
      <SectionBlock title="Analyses pertinentes" items={relevant} color="#e8a040" />
      <SectionBlock title="Analyses optionnelles" items={optional} color="#8a8a7a" />

      {/* Practical tips */}
      <div style={{ background: '#fff', borderLeft: '3px solid #1A2E1F', borderRadius: '0 8px 8px 0', padding: '10px 16px', marginTop: 18, fontSize: '.78rem', color: '#4A4A42' }}>
        <strong style={{ display: 'block', marginBottom: 4, color: '#1A2E1F', fontSize: '.8rem' }}>Conseils pratiques</strong>
        <div style={{ display: 'flex', gap: 4, marginBottom: 2 }}><span style={{ color: '#2a9d5c' }}>-</span> A jeun pour les prises de sang (12h si bilan lipidique)</div>
        <div style={{ display: 'flex', gap: 4, marginBottom: 2 }}><span style={{ color: '#2a9d5c' }}>-</span> Eviter le sport intense la veille</div>
        <div style={{ display: 'flex', gap: 4, marginBottom: 2 }}><span style={{ color: '#2a9d5c' }}>-</span> Apporter cette liste au laboratoire ou a votre medecin</div>
        <div style={{ display: 'flex', gap: 4 }}><span style={{ color: '#2a9d5c' }}>-</span> Certains examens dependent du contexte — a individualiser</div>
      </div>

      {/* Footer */}
      <div style={{ borderTop: '1px solid rgba(26,46,31,.1)', paddingTop: 8, marginTop: 16, display: 'flex', justifyContent: 'space-between', fontSize: '.68rem', color: '#8a8a7a' }}>
        <span>Apercu analyses recommandees</span>
        <span>{essential.length + relevant.length + optional.length} analyse{essential.length + relevant.length + optional.length > 1 ? 's' : ''}</span>
      </div>
    </div>
  );
}

// V47 : Unités SI suisses (mmol/L, µmol/L, nmol/L) — format des labos MGD/Unilabs/Synlab
const LAB_MARKERS_UI = [
  // ─── BASE ───
  { key: 'ferritine', label: 'Ferritine', unit: 'µg/L', group: 'fer' },
  { key: 'fer_serique', label: 'Fer serique', unit: 'µmol/L', group: 'fer' },
  { key: 'vitamine_d', label: 'Vitamine D (25-OH)', unit: 'nmol/L', group: 'vitamines' },
  { key: 'vitamine_b12', label: 'Vitamine B12', unit: 'pmol/L', group: 'vitamines' },
  { key: 'folates', label: 'Folates (B9)', unit: 'nmol/L', group: 'vitamines' },
  { key: 'glucose_jeun', label: 'Glucose a jeun', unit: 'mmol/L', group: 'glycemie' },
  { key: 'insuline_jeun', label: 'Insuline a jeun', unit: 'mU/L', group: 'glycemie' },
  { key: 'hba1c', label: 'HbA1c', unit: '%', group: 'glycemie' },
  { key: 'tsh', label: 'TSH', unit: 'mUI/L', group: 'thyroide' },
  { key: 't3_libre', label: 'T3 libre', unit: 'pmol/L', group: 'thyroide' },
  { key: 't4_libre', label: 'T4 libre', unit: 'pmol/L', group: 'thyroide' },
  { key: 'crp_us', label: 'CRP ultrasensible', unit: 'mg/L', group: 'inflammation' },
  { key: 'magnesium', label: 'Magnesium serique', unit: 'mmol/L', group: 'mineraux' },
  { key: 'zinc', label: 'Zinc', unit: 'µmol/L', group: 'mineraux' },
  // ─── V45 : MARQUEURS ETENDUS ───
  { key: 'cholesterol_total', label: 'Cholesterol total', unit: 'mmol/L', group: 'lipides' },
  { key: 'hdl', label: 'HDL', unit: 'mmol/L', group: 'lipides' },
  { key: 'ldl', label: 'LDL', unit: 'mmol/L', group: 'lipides' },
  { key: 'triglycerides', label: 'Triglycerides', unit: 'mmol/L', group: 'lipides' },
  { key: 'homocysteine', label: 'Homocysteine', unit: 'µmol/L', group: 'inflammation' },
  { key: 'hemoglobine', label: 'Hemoglobine', unit: 'g/L', group: 'hemogramme' },
  { key: 'hematocrite', label: 'Hematocrite', unit: '%', group: 'hemogramme' },
  { key: 't3_reverse', label: 'T3 reverse', unit: 'pmol/L', group: 'thyroide' },
  { key: 'anti_tpo', label: 'Anti-TPO', unit: 'UI/mL', group: 'thyroide' },
  { key: 'anti_tg', label: 'Anti-Tg', unit: 'UI/mL', group: 'thyroide' },
  { key: 'iode_urinaire', label: 'Iode urinaire', unit: 'µg/L', group: 'thyroide' },
  { key: 'cuivre', label: 'Cuivre', unit: 'µmol/L', group: 'mineraux' },
  { key: 'selenium', label: 'Selenium', unit: 'µmol/L', group: 'mineraux' },
  { key: 'magnesium_erythro', label: 'Mg erythrocytaire', unit: 'mmol/L', group: 'mineraux' },
  { key: 'zonuline', label: 'Zonuline', unit: 'ng/mL', group: 'intestinal' },
  { key: 'calprotectine', label: 'Calprotectine', unit: 'µg/g', group: 'intestinal' },
];

// ─── V45 : QUICK FILLS (bilans pre-configures) ───
// Chaque bilan = shortlist des marqueurs attendus. Cliquer sur un bilan filtre l'UI
// pour n'afficher QUE ces marqueurs (le reste reste accessible via "Tout afficher").
const LAB_QUICK_FILLS = [
  {
    id: 'thyroide',
    label: 'Thyroide complet',
    icon: '🦋',
    markers: ['tsh', 't3_libre', 't4_libre', 't3_reverse', 'anti_tpo', 'anti_tg', 'iode_urinaire', 'selenium', 'zinc', 'vitamine_d', 'ferritine'],
  },
  {
    id: 'sopk',
    label: 'SOPK / insulinoresistance',
    icon: '🍩',
    markers: ['glucose_jeun', 'insuline_jeun', 'hba1c', 'tsh', 'vitamine_d', 'ferritine', 'crp_us'],
  },
  {
    id: 'surpoids',
    label: 'Surpoids / metabolique',
    icon: '⚖️',
    markers: ['glucose_jeun', 'insuline_jeun', 'hba1c', 'cholesterol_total', 'hdl', 'ldl', 'triglycerides', 'tsh', 'crp_us', 'ferritine'],
  },
  {
    id: 'hormonal_femme',
    label: 'Hormonal femme',
    icon: '🌸',
    markers: ['tsh', 't3_libre', 't4_libre', 'ferritine', 'vitamine_d', 'magnesium', 'crp_us'],
  },
  {
    id: 'stress_oxydant',
    label: 'Stress oxydant / nutrition',
    icon: '🧘',
    markers: ['vitamine_d', 'vitamine_b12', 'folates', 'magnesium_erythro', 'zinc', 'selenium', 'cuivre', 'homocysteine', 'crp_us'],
  },
  {
    id: 'intestinal',
    label: 'Intestinal',
    icon: '🌱',
    markers: ['zonuline', 'calprotectine', 'crp_us', 'vitamine_d', 'ferritine', 'vitamine_b12'],
  },
];

// V94.27 : buildLabSectionForPlan extrait vers services/clinicalProfile.js

// ─── CLINICAL SUMMARY ───

// V94.27 : buildClinicalSummary extrait vers services/clinicalProfile.js

// ─── CLIENT PIPELINE STATUSES ───

const PIPELINE_STATUSES = [
  { key: 'questionnaire_envoye', label: 'Questionnaire envoye', color: '#94a3b8' },
  { key: 'questionnaire_recu', label: 'Questionnaire recu', color: '#60a5fa' },
  { key: 'rdv_effectue', label: 'RDV effectue', color: '#a78bfa' },
  { key: 'attente_analyses', label: 'Attente analyses', color: '#fbbf24' },
  { key: 'dossier_complet', label: 'Dossier complet', color: '#4ade80' },
  { key: 'plan_en_cours', label: 'Plan en cours', color: '#f97316' },
  { key: 'a_valider', label: 'A valider', color: '#f87171' },
  { key: 'envoye', label: 'Envoye', color: '#22d3ee' },
];

// V94.27 : suggestStatus extrait vers services/clinicalProfile.js

const INITIAL_CONSULTATION = {
  observations: '',
  blood_test_done: false,
  dna_test_done: false,
  mgd_recommendation: 'none',
  mgd_recommended_tests_text: '',
  nutritional_observations: '',
  nutrition_plan: '',
  supplements: '',
  recipes: '',
  notes_for_coach: '',
  private_notes: '',
  fiche_frigo_json: null,
  lab_results: {},
  genetic_results: {},
  status: 'questionnaire_recu',
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

// V94.27 : formatDate + buildRecommendedBloodTests extraits vers services/clinicalProfile.js

export default function NutritionConsultation({ clientId, apiKey, onSave, onCancel, initialConsultation }) {
  const [client, setClient] = useState(() => getClient(clientId));
  const form = client?.form || {};
  const formule = FORMULES[client?.formule] || {};

  // Fetch latest client data from Supabase on mount (questionnaire may have been filled since local cache)
  useEffect(() => {
    if (!isCloudEnabled || !clientId) return;
    supabase
      .from('clients')
      .select('form, prenom, updated_at')
      .eq('id', clientId)
      .single()
      .then(({ data, error }) => {
        if (error || !data?.form) return;
        const local = getClient(clientId);
        const cloudDate = new Date(data.updated_at || 0);
        const localDate = new Date(local?.updatedAt || 0);
        // Only update if cloud is newer (questionnaire was submitted after local creation)
        if (cloudDate > localDate) {
          const merged = { ...local, form: { ...(local?.form || {}), ...data.form }, updatedAt: data.updated_at };
          saveClient(merged);
          setClient(merged);
        }
      });
  }, [clientId]);

  // Detect returning client
  const existingConsultations = getNutritionConsultations(clientId);
  const isFollowup = !initialConsultation && existingConsultations.length > 0;
  const previousConsultation = isFollowup ? existingConsultations[0] : null;
  // Week number: prefer persisted value, fallback to nutrition followup count
  const followupWeek = (() => {
    if (initialConsultation?.followupWeek) return initialConsultation.followupWeek;
    if (!isFollowup) return 0;
    // Count only followup consultations (exclude the initial plan)
    const followupCount = existingConsultations.filter(c => c.isFollowup).length;
    // Current consultation is the next followup (+1), capped at 4
    return Math.min(followupCount + 1, 4);
  })();

  // Steps differ based on followup status
  const stepLabels = isFollowup
    ? ['Resume client', 'Suivi & Progression', 'Plan nutrition', 'Notes internes']
    : ['Resume client', 'Plan nutrition', 'Notes internes'];

  const totalSteps = stepLabels.length;

  // Le cockpit (step "plan") est le point d'entree par defaut — les autres
  // steps (resume client, suivi, notes) restent accessibles via les pills en haut.
  const [step, setStep] = useState(() => (isFollowup ? 3 : 2));
  const [consultation, setConsultation] = useState(() => {
    if (initialConsultation) {
      return {
        observations: initialConsultation.observations || '',
        blood_test_done: initialConsultation.bloodTestDone || initialConsultation.blood_test_done || false,
        dna_test_done: initialConsultation.dnaTestDone || initialConsultation.dna_test_done || false,
        mgd_recommendation: initialConsultation.mgdRecommendation
          || initialConsultation.mgd_recommendation
          || (initialConsultation.bloodTestDone || initialConsultation.blood_test_done
              ? (initialConsultation.dnaTestDone || initialConsultation.dna_test_done
                  ? 'advanced' : 'blood')
              : 'none'),
        mgd_recommended_tests_text: initialConsultation.mgdRecommendedTestsText
          || initialConsultation.mgd_recommended_tests_text || '',
        nutritional_observations: initialConsultation.nutritionalObservations || initialConsultation.nutritional_observations || '',
        nutrition_plan: initialConsultation.nutritionPlan || initialConsultation.nutrition_plan || '',
        supplements: initialConsultation.supplements || '',
        recipes: initialConsultation.recipes || '',
        notes_for_coach: initialConsultation.notesForCoach || initialConsultation.notes_for_coach || '',
        private_notes: initialConsultation.privateNotes || initialConsultation.private_notes || '',
        fiche_frigo_json: initialConsultation.ficheFrigoJson || initialConsultation.fiche_frigo_json || null,
        lab_results: initialConsultation.labResults || initialConsultation.lab_results || {},
        genetic_results: initialConsultation.geneticResults || initialConsultation.genetic_results || {},
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
  const [weeklyFeedback, setWeeklyFeedback] = useState(() => {
    if (initialConsultation?.weeklyFeedback) return { ...INITIAL_WEEKLY_FEEDBACK, ...initialConsultation.weeklyFeedback };
    return { ...INITIAL_WEEKLY_FEEDBACK };
  });
  const [consultationId] = useState(initialConsultation?.id || null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState('');
  const [autoCorrected, setAutoCorrected] = useState(false);
  const [pdfError, setPdfError] = useState('');
  // V76 : showPdfPreview retire avec la modale Apercu PDF
  const [showAnalysesPreview, setShowAnalysesPreview] = useState(false);
  const [analysesError, setAnalysesError] = useState('');
  // V92.1 : showTemplates supprime — feature Templates retiree
  const [showPdfMenu, setShowPdfMenu] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [mgdOpen, setMgdOpen] = useState(false);
  // V78 : soft delete consultation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  // V79 : copilot — backup du plan avant derniere insertion pour undo
  const [lastInsertBackup, setLastInsertBackup] = useState(null);
  // { prevPlan, prevSupplements, prevRecipes, win, type, expiresAt }
  // V79.1 : type de section a faire flasher (persistent sur re-render via React state)
  const [flashSectionType, setFlashSectionType] = useState(null);
  // V81 : modale de confirmation reutilisable
  const confirmDialog = useConfirmDialog();
  // V83 : mode relecture — l'editeur passe en read-only pour simuler la lecture du PDF
  const [isReviewMode, setIsReviewMode] = useState(false);
  // V88 / V92.2 / V94 : couche finalisation humaine (rollback safety net).
  // finalText = version editee manuellement par Anissa, stockee separement du plan IA.
  // Le PDF prime finalText si isFinal=true. Modal Finaliser supprimee V92.3 et code
  // orphelin (handlers, effects, ~210 lignes) nettoye V94. Anissa peaufine maintenant
  // directement dans Word apres export. Ces states restent dormants pour ne pas casser
  // les anciennes consultations finalisees + rollback rapide si revert necessaire.
  const [finalText, setFinalText] = useState('');
  const [isFinal, setIsFinal] = useState(false);
  const [finalVersions, setFinalVersions] = useState(
    Array.isArray(initialConsultation?.finalVersions) ? initialConsultation.finalVersions : []
  );
  // V79.3 : map { winText: sectionType } des quickWins deja inserees
  // → permet de re-afficher "✓ Revoir" au lieu de "Inserer" et d'eviter les doublons.
  const [insertedWinsMap, setInsertedWinsMap] = useState({});

  // Memoize MGD correlation computations (expensive, re-run only when lab data or form changes)
  const hasLabData = useMemo(() => {
    const labData = consultation.lab_results || {};
    return Object.values(labData).some(v => v !== '' && v != null);
  }, [consultation.lab_results]);

  const labAnalysisMemo = useMemo(
    () => hasLabData ? analyzeLabResults(consultation.lab_results || {}) : null,
    [consultation.lab_results, hasLabData]
  );

  // V79 : auto-hide du banner undo apres la fenetre de 20s
  useEffect(() => {
    if (!lastInsertBackup) return;
    const msLeft = Math.max(0, lastInsertBackup.expiresAt - Date.now());
    const timer = setTimeout(() => setLastInsertBackup(null), msLeft);
    return () => clearTimeout(timer);
  }, [lastInsertBackup]);

  // V79.1 : auto-clear du flash Copilot apres 2.5s
  useEffect(() => {
    if (!flashSectionType) return;
    const t = setTimeout(() => setFlashSectionType(null), 2500);
    return () => clearTimeout(t);
  }, [flashSectionType]);

  const mgdCorrelationMemo = useMemo(() => {
    if (!hasLabData || !labAnalysisMemo?.signals?.length) return null;
    const symptoms = detectSymptomsFromForm(form);
    return buildMGDCorrelation(symptoms, labAnalysisMemo.signals);
  }, [consultation.lab_results, form, hasLabData, labAnalysisMemo]);

  const [pendingAlerts, setPendingAlerts] = useState(null);
  const editorGetDataRef = useRef(null);
  const [planVersions, setPlanVersions] = useState(() => getPlanVersions(clientId));
  const [showVersions, setShowVersions] = useState(false);
  // V45 : Quick fill actif (id du bilan selectionne, ou null pour "tout afficher")
  const [activeLabQuickFill, setActiveLabQuickFill] = useState(null);

  // ─── Cockpit (single editor view) ───
  // V76 : previewTab supprime — Apercu PDF modal retiree, l'editeur est l'apercu.
  const [editorTab, setEditorTab] = useState('plan'); // 'plan' | 'frigo' | 's1s4' | 'supp' | 'app' (V94.48 — Lettre & Recettes deplaces dans 'app' comme sous-onglets)
  const [showFrigoModal, setShowFrigoModal] = useState(false);
  const [showMedicalSummary, setShowMedicalSummary] = useState(false);
  // V92.1 : showCoverForm + coverFields supprimes — Word V92.0 prime
  const [showClientAppPreview, setShowClientAppPreview] = useState(false);
  // ─── Draft state (source de verite unique cote parent) ──────────────
  // L'editeur est controle via un reseed explicite (editorSeed) et pousse
  // ses modifications en continu via onDraftChange (debounced cote editeur).
  // L'apercu lit directement ces drafts → re-renders React natifs, pas de ref polling.
  const initialPlan = initialConsultation?.nutritionPlan || initialConsultation?.nutrition_plan || '';
  const initialSupp = initialConsultation?.supplements || '';
  const initialRec = initialConsultation?.recipes || '';
  const [planDraft, setPlanDraft] = useState(initialPlan);
  const [supplementsDraft, setSupplementsDraft] = useState(initialSupp);
  const [recipesDraft, setRecipesDraft] = useState(initialRec);
  // editorSeed : incremente UNIQUEMENT pour forcer un remount de NutritionEditor
  // (apres generation IA, template, ou restauration de version). Jamais en reponse
  // a une edition utilisateur — c'est ce qui evitait la perte de texte.
  const [editorSeed, setEditorSeed] = useState(0);

  const [saveToast, setSaveToast] = useState('');
  const [liveScore, setLiveScore] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const scoreDebounceRef = useRef(null);
  // V51 : aiAnalysis persiste dans la consultation (survivre nav + reload)
  const [aiAnalysis, setAiAnalysis] = useState(() => {
    return initialConsultation?.aiAnalysis || initialConsultation?.ai_analysis || null;
  });
  const [analyzingPlan, setAnalyzingPlan] = useState(false);
  const [aiAnalysisError, setAiAnalysisError] = useState('');
  const [improvingAll, setImprovingAll] = useState(false);
  const [globalProposal, setGlobalProposal] = useState(null);
  const [expertMode, setExpertMode] = useState(false);
  const [sectionResults, setSectionResults] = useState([]);
  const [currentOptimizingIdx, setCurrentOptimizingIdx] = useState(0);
  const [acceptedSections, setAcceptedSections] = useState({});
  const [autoSaveStatus, setAutoSaveStatus] = useState('saved');
  // 'saved' | 'unsaved' | 'saving'
  const autoSaveTimerRef = useRef(null);
  const isDirtyRef = useRef(false);
  // V76 : previewBodyRef retire avec la modale Apercu PDF

  // Restore draft on mount if newer than saved consultation
  useEffect(() => {
    const draft = loadDraft(clientId, consultationId);
    if (!draft) return;
    const consultationDate = new Date(initialConsultation?.createdAt || 0).getTime();
    if (draft.savedAt > consultationDate) {
      reseedEditor(draft.plan, draft.supplements, draft.recipes);
      setAutoSaveStatus('unsaved');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Reseed : remplace les drafts + remount l'editeur. A appeler APRES toute
  // ecriture "autoritaire" du plan (AI gen, template, restore version).
  const reseedEditor = (plan, supplements, recipes) => {
    setPlanDraft(plan || '');
    setSupplementsDraft(supplements || '');
    setRecipesDraft(recipes || '');
    setEditorSeed(s => s + 1);
  };

  // Callback push-based depuis NutritionEditor — maintient les drafts a jour.
  const handleDraftChange = (plan, supplements, recipes) => {
    setPlanDraft(plan);
    setSupplementsDraft(supplements);
    setRecipesDraft(recipes);
    isDirtyRef.current = true;
    setAutoSaveStatus('unsaved');
    // Debounce 1s
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      setAutoSaveStatus('saving');
      saveDraft(clientId, consultationId, { plan, supplements, recipes });
      setAutoSaveStatus('unsaved');
    }, 1000);
  };

  // Flush draft to localStorage on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      if (isDirtyRef.current) {
        const edited = editorGetDataRef.current ? editorGetDataRef.current() : null;
        saveDraft(clientId, consultationId, {
          plan: edited?.plan ?? planDraft,
          supplements: edited?.supplements ?? supplementsDraft,
          recipes: edited?.recipes ?? recipesDraft,
        });
      }
    };
  }, [clientId, consultationId, planDraft, supplementsDraft, recipesDraft]);

  // Warning before page unload if unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isDirtyRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // Close dropdown menus on outside click
  useEffect(() => {
    const close = () => { setShowPdfMenu(false); setShowMoreMenu(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  // Flush des drafts -> etat persiste consultation.*
  // Ne provoque PAS de reseed de l'editeur (drafts === consultation apres ca).
  const flushEditorDraft = () => {
    setConsultation(prev => {
      if (prev.nutrition_plan === planDraft && prev.supplements === supplementsDraft && prev.recipes === recipesDraft) {
        return prev;
      }
      return {
        ...prev,
        nutrition_plan: planDraft,
        supplements: supplementsDraft,
        recipes: recipesDraft,
      };
    });
    return true;
  };

  const showSaveToast = (msg) => {
    setSaveToast(msg);
    setTimeout(() => setSaveToast(''), 1800);
  };

  // Live score + suggestions (debounced)
  useEffect(() => {
    if (!planDraft && !supplementsDraft) return;
    if (scoreDebounceRef.current) clearTimeout(scoreDebounceRef.current);
    scoreDebounceRef.current = setTimeout(() => {
      const score = scorePlanQuality(
        planDraft,
        supplementsDraft,
        { ...form, _weeklyFeedback: weeklyFeedback },
        { isFollowup, followupWeek }
      );
      setLiveScore(score);
      setSuggestions(buildSuggestions(score, null));
    }, 1500);
    return () => clearTimeout(scoreDebounceRef.current);
  }, [planDraft, supplementsDraft, form, isFollowup, followupWeek, weeklyFeedback]);

  const handleImproveFromAnalysis = async (instruction, targetHint) => {
    setAiAnalysis(null);
    await new Promise(r => setTimeout(r, 150));
    showSaveToast(`\u2728 IA en cours \u2014 ${instruction}`);
    try {
      const { improveSection } = await import('./services/aiClient');
      const result = await improveSection(
        form,
        targetHint || 'Plan complet',
        planDraft,
        'adapt'
      );
      if (result) {
        setGlobalProposal({ text: result, instruction });
      }
    } catch (err) {
      showSaveToast('Erreur IA \u2014 r\u00e9essayez');
    }
  };

  const handleImproveAll = async () => {
    setImprovingAll(true);
    setAiAnalysis(null);
    try {
      const { improveSection } = await import('./services/aiClient');
      const result = await improveSection(
        form,
        'Plan nutritionnel complet',
        planDraft,
        'improve'
      );
      if (result) setGlobalProposal({ text: result, instruction: 'Plan am\u00e9lior\u00e9' });
    } catch (err) {
      showSaveToast('Erreur IA \u2014 r\u00e9essayez');
    } finally {
      setImprovingAll(false);
    }
  };

  const handleExpertMode = async () => {
    const edited = editorGetDataRef.current ? editorGetDataRef.current() : null;
    const currentPlan = edited?.plan ?? planDraft;
    if (!currentPlan?.trim()) {
      showSaveToast('Aucun plan \u00e0 optimiser');
      return;
    }
    setExpertMode('loading');
    setAcceptedSections({});
    setSectionResults([]);

    const sections = structurePlanSections(currentPlan, supplementsDraft, { isFollowup, locale: getClientNutritionLocale(client) });

    const results = [];
    for (let i = 0; i < sections.length; i++) {
      setCurrentOptimizingIdx(i);
      const section = sections[i];
      if (!section.content?.trim()) {
        results.push({ id: section.id || `s_${i}`, title: section.title,
          original: '', improved: '', changes: [], skip: true });
        continue;
      }
      try {
        // V88.15 : locale propagee pour que Mode Expert sorte en EN sur les plans anglais
        const { improvedContent, changes } = await optimizeSection(
          form, section.title, section.content, [], { locale: getClientNutritionLocale(client) }
        );
        results.push({
          id: section.id || `s_${i}`,
          title: section.title,
          original: section.content,
          improved: improvedContent,
          changes,
          skip: false,
        });
      } catch {
        results.push({ id: section.id || `s_${i}`, title: section.title,
          original: section.content, improved: section.content,
          changes: [], skip: true });
      }
      setSectionResults([...results]);
    }
    setExpertMode('review');
  };

  const handleApplyExpertMode = () => {
    // V88.16 : les sections type 'supplements' sont routees vers supplementsDraft
    // (pas re-injectees dans planDraft) pour eviter un doublon visible dans l'editeur
    // (filter FR-only de parsePlanToSections ne matche pas les titres EN).
    let newSupps = supplementsDraft;
    const newPlanParts = [];
    for (const r of sectionResults) {
      const accepted = acceptedSections[r.id] !== false;
      const content = accepted ? r.improved : r.original;
      if (!content?.trim()) continue;
      if (detectSectionType(r.title) === 'supplements') {
        if (accepted) newSupps = content;
        continue;
      }
      newPlanParts.push(`${r.title.toUpperCase()}\n${content}`);
    }

    const newPlan = newPlanParts.join('\n\n');
    reseedEditor(newPlan, newSupps, recipesDraft);
    setExpertMode(false);
    setSectionResults([]);
    setAcceptedSections({});
    showSaveToast('\u2705 Plan optimis\u00e9 appliqu\u00e9');
  };

  const updateField = (field, value) => {
    setConsultation(prev => ({ ...prev, [field]: value }));
  };

  // V88.3 : renvoie le texte qui ira REELLEMENT dans le PDF.
  // Meme logique que doExportPdf : prime finalText si la finalisation est active.
  const getEffectivePlanText = () => {
    if (isFinal && finalText && finalText.trim()) return finalText.trim();
    if (planDraft && planDraft.trim()) return planDraft.trim();
    return consultation?.nutrition_plan || '';
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
      `- Reaction apres repas riche en glucides : ${Array.isArray(form.reactionGlucides) ? (form.reactionGlucides.length ? form.reactionGlucides.join(', ') : nr) : (form.reactionGlucides || nr)}`,
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
      parts.push(`--- SUIVI SEMAINE ${followupWeek}/4 ---`);
      parts.push(buildFollowupSummary(followupData, previousConsultation, form));

      // Weekly feedback (structured)
      const wf = weeklyFeedback;
      const feedbackLines = [
        wf.energy && `Energie : ${wf.energy}`,
        wf.digestion && `Digestion : ${wf.digestion}`,
        wf.hunger && `Faim/Satiete : ${wf.hunger}`,
        wf.adherence && `Adherence : ${wf.adherence}`,
        wf.performance && `Performance : ${wf.performance}`,
        wf.cravings && `Fringales/Envies : ${wf.cravings}`,
        wf.notes && `Notes : ${wf.notes}`,
      ].filter(Boolean);
      if (feedbackLines.length > 0) {
        parts.push('');
        parts.push('--- FEEDBACK HEBDOMADAIRE CLIENT ---');
        parts.push(feedbackLines.join('\n'));
      }

      // Add previous plan summary
      if (previousConsultation.nutritionPlan) {
        const planLines = previousConsultation.nutritionPlan.split('\n').slice(0, 30);
        parts.push('');
        parts.push('--- PLAN INITIAL A AJUSTER ---');
        parts.push(planLines.join('\n'));
        parts.push('...(plan complet non inclus pour brievete)');
      }
      if (previousConsultation.supplements) {
        parts.push('');
        parts.push('--- SUPPLEMENTS PRECEDEMMENT RECOMMANDES ---');
        parts.push(previousConsultation.supplements.split('\n').slice(0, 15).join('\n'));
      }
    }

    // Add lab results interpretation if available
    const labData = consultation.lab_results || {};
    const hasLabData = Object.values(labData).some(v => v !== '' && v != null);
    const labAnalysis = hasLabData ? analyzeLabResults(labData) : null;
    if (hasLabData) {
      const labSection = buildLabSectionForPlan(labData);
      if (labSection) parts.push(labSection);
    }

    // Inject MGD recommended tests text if present
    const mgdTestsText = consultation.mgd_recommended_tests_text?.trim();
    if (mgdTestsText) {
      parts.push('');
      parts.push('--- ANALYSES RECOMMANDÉES (MGD) ---');
      parts.push(mgdTestsText);
    }

    // Inject MGD correlations if lab data exists
    if (hasLabData && labAnalysis?.signals?.length > 0) {
      const mgdSymptomsForCorr = detectSymptomsFromForm(form);
      const correlation = buildMGDCorrelation(mgdSymptomsForCorr, labAnalysis.signals);
      const corrText = formatCorrelationForPrompt(correlation);
      if (corrText) {
        parts.push('');
        parts.push(corrText);
      }
    }

    // V46 : Inject genetic tests (nutrigenetics) if any variant is recorded
    const geneticSection = buildGeneticSectionForPrompt(consultation.genetic_results);
    if (geneticSection) {
      parts.push(geneticSection);
    }

    // Inject emotional shock context if present
    if (form.emotional_shock === 'Oui') {
      parts.push('');
      parts.push('CONTEXTE ÉMOTIONNEL : Choc émotionnel déclaré.');
      if (form.emotional_shock_details?.trim()) {
        parts.push(`Détails : ${form.emotional_shock_details.trim()}`);
      }
      parts.push('Tenir compte de l\'axe stress/cortisol dans le plan. Privilégier aliments adaptogènes et anti-inflammatoires.');
    }

    // Pre-RDV summary (priorities + axes, also shown in UI)
    const preRdv = buildPreRdvSummary(form);
    if (preRdv.hasData) {
      parts.push('');
      parts.push('--- SYNTHESE PRE-RDV (priorites detectees) ---');
      if (preRdv.objectif) parts.push(`Objectif : ${preRdv.objectif}`);
      if (preRdv.priorities.length > 0) parts.push(`Priorites : ${preRdv.priorities.join(' > ')}`);
      if (preRdv.axes.length > 0) parts.push(`Axes de travail : ${preRdv.axes.join(', ')}`);
      if (preRdv.vigilance.length > 0) parts.push(`Vigilance : ${preRdv.vigilance.join(', ')}`);
    }

    // Clinical summary (orientation for AI)
    const mgdSymptoms = detectSymptomsFromForm(form);
    const mgdRec = consultation.mgd_recommendation || 'none';
    const mgdRecLabel = mgdRec === 'advanced'
      ? 'Bilan avancé recommandé (sanguin + ADN)'
      : mgdRec === 'blood'
      ? 'Bilan sanguin recommandé'
      : 'Aucun test biologique recommandé';
    parts.push('');
    parts.push(buildClinicalSummary(form, {
      mgdSymptoms,
      labAnalysis: labAnalysis?.signals?.length > 0 ? labAnalysis : null,
      isFollowup,
      followupWeek,
    }));
    parts.push(`Recommandation biologique Anissa : ${mgdRecLabel}`);

    parts.push('');
    parts.push(`Genere un plan nutrition personnalise COURT et PREMIUM. Format compact : synthese, regles, 2 trames de journees types (semaine 1), rotations et substitutions (semaines 2-4), fiche frigo, ajustements entrainement, suivi. PAS de menus detailles jour par jour. Lisible en 3 minutes.`);
    if (hasLabData) {
      parts.push('IMPORTANT : Intégrer impérativement les adaptations biologiques dans le plan :');
      parts.push('- Adapter les aliments aux signaux détectés');
      parts.push('- Inclure les suppléments pertinents avec dosages');
      parts.push('- Mentionner les priorités nutritionnelles issues des résultats');
    }

    return parts.join('\n');
  };

  const handleGenerate = async () => {
    // Validation des champs critiques (securite client)
    const missing = [];
    if (!form.allergies || !form.allergies.toString().trim()) missing.push('allergies / intolerances');
    const hasMeds = (form.traitements && form.traitements.toString().trim()) || (form.medicaments && form.medicaments.toString().trim());
    const hasPath = form.pathologies && form.pathologies.toString().trim();
    if (!hasMeds && !hasPath) missing.push('medicaments / pathologies');
    if (missing.length > 0) {
      // V81 : modale propre au lieu de window.confirm
      const ok = await confirmDialog.ask({
        title: 'Champs critiques manquants',
        message: `Champs non renseignés : ${missing.join(' et ')}.\n\nGénérer sans ces informations peut être dangereux (interactions, contre-indications).\n\nContinuer quand même ?`,
        danger: true,
        confirmLabel: 'Générer quand même',
      });
      if (!ok) return;
    }

    if (consultation.nutrition_plan) {
      // V81 : regeneration = destructif (ecrase le plan + modifications non sauvegardees)
      const ok = await confirmDialog.ask({
        title: 'Régénérer le plan ?',
        message: 'Le plan actuel sera remplacé. Les modifications non sauvegardées seront perdues.',
        danger: true,
        confirmLabel: 'Régénérer',
      });
      if (!ok) return;
    }

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
          system: buildSystemPrompt(form, {
            isFollowup,
            clientFormule: client?.formule || '',
            followupWeek,
            planMode: getNutritionPlanMode(client), // V80 : oneshot vs followup
          }, client), // V86.6 : 3e param pour le branchement EN (getClientNutritionLocale)
          messages: [{ role: 'user', content: userMessage + '\n\nGenere le plan nutrition personnalise complet (sections 1 a 7) avec menus varies, listes de courses par semaine, et alternatives naturelles. Ne genere PAS la section supplements separement.' }],
        }),
      });

      if (!planResponse.ok) {
        const err = await planResponse.json().catch(() => ({}));
        throw new Error(err.error?.message || `Erreur API: ${planResponse.status}`);
      }

      const planData = await planResponse.json();
      // V55 : postProcess nettoie emojis, letter-spacing, markdown tables, arrows cassees
      let planText = postProcess(planData.content?.[0]?.text || '');

      // Appel 2 : Supplements (conditionnel — seulement si client ouvert aux complements)
      // V86.9 : pour les clientes Benfitcoach EN, on utilise les prompts supplements EN
      // dedies (buildSupplementsSystemPromptEn + SUPPLEMENTS_INSTRUCTION_EN). Sinon, FR.
      const consultationLocale = getClientNutritionLocale(client);
      let suppText = '';
      const wantsSupplements = form.pretProtocole === 'Oui' || form.pretProtocole === 'Peut-etre';
      if (wantsSupplements) {
        const suppSystemPrompt = consultationLocale === 'EN'
          ? buildSupplementsSystemPromptEn()
          : buildSupplementsSystemPrompt();
        const suppInstruction = consultationLocale === 'EN'
          ? SUPPLEMENTS_INSTRUCTION_EN
          : SUPPLEMENTS_INSTRUCTION;
        const suppResponse = await fetch('/api/claude', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-fallback-key': apiKey.trim(),
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 4000,
            // V48/V55 : system prompt dedie STRICT (sans mission "creer un plan")
            system: suppSystemPrompt,
            messages: [{ role: 'user', content: userMessage + '\n\n' + suppInstruction }],
          }),
        });

        if (suppResponse.ok) {
          const suppData = await suppResponse.json();
          // V55 : double securite - strip leakage + postProcess
          suppText = postProcess(stripPlanLeakage(suppData.content?.[0]?.text || ''));
        }
      }
      updateField('supplements', suppText);
      setAutoCorrected(false);

      // Appel 3 : Audit de coherence (appel separe)
      let finalPlan = planText;
      let auditResult = '';
      const auditClientProfile = `PROFIL CLIENT :\n- Allergies : ${form.allergies || 'Aucune'}\n- Intolerances : ${form.alimentsEvites || 'Aucune'}\n- Pathologies : ${form.pathologies || 'Aucune'}\n- Traitements : ${form.traitements || 'Aucun'}`;
      const scoreFormData = { ...form, _weeklyFeedback: weeklyFeedback };

      // Helper: run audit on a plan
      const runAudit = async (planToAudit) => {
        try {
          const resp = await fetch('/api/claude', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-fallback-key': apiKey.trim() },
            body: JSON.stringify({
              model: 'claude-sonnet-4-20250514',
              max_tokens: 4000,
              // V86.9 : audit en EN pour clientes Benfitcoach EN
              system: consultationLocale === 'EN' ? AUDIT_PROMPT_EN : AUDIT_PROMPT,
              messages: [{ role: 'user', content: `${auditClientProfile}\n\nPLAN GENERE :\n${planToAudit}\n\nSUPPLEMENTS :\n${suppText || 'Aucun'}` }],
            }),
          });
          if (resp.ok) {
            const data = await resp.json();
            return data.content?.[0]?.text || '';
          }
        } catch { /* silent */ }
        return '';
      };

      // V49 : Audit garde en INTERNE uniquement — jamais dans le plan client (PDF)
      // Initial audit — utilise pour scoring et correction, mais pas injecte dans finalPlan
      auditResult = await runAudit(planText);

      // Score the plan (sans audit injecte — on score uniquement le plan)
      const initialScore = scorePlanQuality(planText, suppText, scoreFormData, { isFollowup, followupWeek });

      // Auto-correction: single attempt if score is too low or hard fail
      if (shouldAutoCorrect(initialScore)) {
        try {
          const correctionResponse = await fetch('/api/claude', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-fallback-key': apiKey.trim() },
            body: JSON.stringify({
              model: 'claude-sonnet-4-20250514',
              max_tokens: 16000,
              // V49 : passer planText (sans audit injecte) pour eviter que Claude reprenne le texte d'audit
              system: buildCorrectionPrompt(planText, initialScore, form, auditResult),
              messages: [{ role: 'user', content: 'Corrige le plan ci-dessus selon les problemes detectes. Renvoie UNIQUEMENT le plan corrige, sans mentionner les problemes identifies, sans section "AUDIT", sans commentaires meta. Garde le meme format et la meme structure que l\'original.' }],
            }),
          });

          if (correctionResponse.ok) {
            const correctionData = await correctionResponse.json();
            // V62 : appliquer postProcess aussi au plan corrige (nettoyage emojis, fleches, letter-spacing)
            const correctedPlan = postProcess(correctionData.content?.[0]?.text || '');

            if (correctedPlan) {
              // Re-audit the corrected version (pour scoring uniquement)
              const correctedAuditResult = await runAudit(correctedPlan);
              const correctedFinal = correctedPlan; // V49 : pas d'injection audit

              // Re-score the corrected version
              const correctedScore = scorePlanQuality(correctedFinal, suppText, scoreFormData, { isFollowup, followupWeek });

              // Strict selection: never accept if new hard fail introduced
              if (!correctedScore.hasHardFail) {
                const fixedHardFail = initialScore.hasHardFail;
                const improvedWithoutRegression =
                  correctedScore.normalized > initialScore.normalized &&
                  correctedScore.coherence >= initialScore.coherence &&
                  correctedScore.constraints >= initialScore.constraints;

                if (fixedHardFail || improvedWithoutRegression) {
                  finalPlan = correctedFinal;
                  setAutoCorrected(true);
                }
              }
            }
          }
        } catch { /* correction failed silently — keep initial */ }
      }

      updateField('nutrition_plan', finalPlan);
      // Reseed l'editeur avec le nouveau plan genere (remount propre).
      reseedEditor(finalPlan, suppText, consultation.recipes);

      // Learning signal: log quality data for prompt improvement
      const wasAutoCorrected = finalPlan !== planText;
      const finalScore = scorePlanQuality(finalPlan, suppText, scoreFormData, { isFollowup, followupWeek });
      saveLearningSignal(buildLearningSignal(
        { ...form, _clientFormule: client?.formule || '' },
        { isFollowup, followupWeek, initialScore, finalScore, autoCorrected: wasAutoCorrected }
      ));

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
        showSaveToast('Fiche frigo non générée — le plan est sauvegardé sans elle');
      }

    } catch (err) {
      setGenError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  // V92.1 : handleTemplateSelect supprime (feature Templates retiree)

  // V94.57 : ref vers le dernier handleSave (resout closure stale dans
  // les setTimeout/callbacks qui declenchent la persistance globale).
  const handleSaveRef = useRef(null);

  const handleSave = () => {
    if (!consultation.mgd_recommendation) {
      showSaveToast('Sélectionnez une recommandation biologique avant de sauvegarder');
      return;
    }

    // Safety : lire le DOM via ref au cas ou un keystroke est passe apres
    // le dernier debounce. Sinon, utiliser les drafts React (source habituelle).
    const edited = editorGetDataRef.current ? editorGetDataRef.current() : null;
    const planToSave = edited?.plan ?? planDraft;
    const suppToSave = edited?.supplements ?? supplementsDraft;
    const recipesToSave = edited?.recipes ?? recipesDraft;

    const mgdRec = consultation.mgd_recommendation || 'none';
    const bloodTestDone = mgdRec === 'blood' || mgdRec === 'advanced';
    const dnaTestDone = mgdRec === 'advanced';

    setConsultation(prev => ({
      ...prev,
      nutrition_plan: planToSave,
      supplements: suppToSave,
      recipes: recipesToSave,
    }));
    onSave({
      id: consultationId || undefined,
      clientId,
      consultantName: 'Anissa',
      date: initialConsultation?.date || new Date().toISOString(),
      observations: consultation.observations,
      bloodTestDone,
      dnaTestDone,
      mgdRecommendation: mgdRec,
      mgdRecommendedTestsText: consultation.mgd_recommended_tests_text || '',
      nutritionalObservations: consultation.nutritional_observations,
      nutritionPlan: planToSave,
      supplements: suppToSave,
      recipes: recipesToSave,
      notesForCoach: consultation.notes_for_coach,
      privateNotes: consultation.private_notes,
      ficheFrigoJson: consultation.fiche_frigo_json || null,
      labResults: consultation.lab_results || {},
      geneticResults: consultation.genetic_results || {},
      aiAnalysis: aiAnalysis || null,
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
      weeklyFeedback: isFollowup ? weeklyFeedback : null,
      followupWeek: isFollowup ? followupWeek : null,
      previousConsultationId: previousConsultation?.id || null,
      // V87.5 : tracabilite locale. Permet de filtrer les consultations EN
      // en prod (debug, support client, audit, stats usage).
      // Stocke dans le champ JSON followupData pour eviter de toucher au
      // schema DB. Accessible ensuite via consultation.followupData?._planLocale.
      planLocale: getClientNutritionLocale(client),
      // V88 : couche finalisation humaine. Propage au store.
      finalText: finalText || null,
      isFinal: isFinal,
      finalUpdatedAt: isFinal ? (consultation.finalUpdatedAt || new Date().toISOString()) : null,
      // V88.12 : historique versions finales
      finalVersions: finalVersions,
      // V94.57 : composantes app cliente persistees aussi (sinon perdues
      // au reload). Lettre d'intro IA + recettes detaillees IA + tone_*
      // ne sont pas dans le NutritionEditor mais doivent voyager avec
      // la consultation.
      intro_letter: consultation.intro_letter || null,
      meal_recipes: consultation.meal_recipes || null,
    });
    clearDraft(clientId, consultationId);
    isDirtyRef.current = false;
    setAutoSaveStatus('saved');
  };
  // V94.57 : sync le ref a chaque render pour pointer vers le handleSave
  // courant (qui ferme sur le state actuel de consultation).
  handleSaveRef.current = handleSave;

  return (
    <div className="nutrition-consultation">
      {/* V92.1 : modale NutritionTemplates supprimee — feature non utilisee en pratique */}

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
            <div style={{
              fontSize: '.7rem', color: 'rgba(255,255,255,.3)',
              fontStyle: 'italic', marginBottom: 8,
            }}>
              Sauvegardées localement · Non synchronisées entre appareils
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
                      onClick={async () => {
                        if (consultation.nutrition_plan) {
                          // V81 : modale propre (restauration = destructif)
                          const ok = await confirmDialog.ask({
                            title: 'Restaurer cette version ?',
                            message: 'Le plan actuel sera remplacé par cette version archivée. Le plan actuel sera sauvegardé avant restauration.',
                            danger: true,
                            confirmLabel: 'Restaurer',
                          });
                          if (!ok) return;
                          // Sauver l'actuel avant de restaurer
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
                        reseedEditor(v.nutritionPlan || '', v.supplements || '', v.recipes || '');
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

      {/* V84 : Header unifié (client + mode + statut + stepper) en 2 lignes compactes.
          Remplace nutrition-header + pipeline status bar + nutrition-steps — meme logique metier. */}
      {(() => {
        const current = consultation.status || 'questionnaire_recu';
        const statusInfo = PIPELINE_STATUSES.find(s => s.key === current) || PIPELINE_STATUSES[0];
        const suggested = suggestStatus(consultation);
        const suggestedInfo = suggested && suggested !== current ? PIPELINE_STATUSES.find(s => s.key === suggested) : null;
        const planMode = getNutritionPlanMode(client);
        const isOneShot = planMode === 'oneshot';
        return (
          <div className="nutrition-header-v2">
            {/* Ligne 1 : nom client + badges + statut */}
            <div className="nutrition-header-v2__top">
              <h2 className="nutrition-header-v2__client-name">{form.prenom || 'Client'}</h2>
              <div className="nutrition-header-v2__badges">
                <span
                  className="nhv2-badge"
                  data-variant={isOneShot ? 'gold' : 'green'}
                  title={isOneShot
                    ? 'Consultation unique — plan autonome pour 4 semaines'
                    : 'Accompagnement continu — plan évolutif'}
                >
                  {isOneShot ? 'Bilan individuel' : 'Suivi'}
                </span>
                {autoSaveStatus === 'unsaved' && (
                  <span className="nhv2-badge" data-variant="warn" title="Des modifications n'ont pas encore été enregistrées">
                    <span className="nhv2-dot" /> Non sauvegardé
                  </span>
                )}
                {autoSaveStatus === 'saving' && (
                  <span className="nhv2-badge" data-variant="warn-soft">⟳ Sauvegarde…</span>
                )}
              </div>
              <div className="nutrition-header-v2__spacer" />
              <div className="nutrition-header-v2__status">
                <span className="nhv2-status-label">Statut</span>
                <select
                  value={current}
                  onChange={(e) => updateField('status', e.target.value)}
                  style={{
                    background: statusInfo.color + '22',
                    border: `1px solid ${statusInfo.color}55`,
                    color: statusInfo.color,
                  }}
                  className="nhv2-status-select"
                >
                  {PIPELINE_STATUSES.map(s => (
                    <option key={s.key} value={s.key}>{s.label}</option>
                  ))}
                </select>
                {suggestedInfo && (
                  <button
                    type="button"
                    onClick={() => updateField('status', suggested)}
                    className="nhv2-status-suggest"
                    style={{
                      background: suggestedInfo.color + '18',
                      border: `1px solid ${suggestedInfo.color}44`,
                      color: suggestedInfo.color,
                    }}
                  >
                    → {suggestedInfo.label}
                  </button>
                )}
              </div>
            </div>

            {/* Ligne 2 : stepper compact pills */}
            <div className="nutrition-header-v2__stepper">
              {stepLabels.map((label, i) => {
                const n = i + 1;
                const isActive = step === n;
                const isDone = step > n;
                return (
                  <button
                    key={i}
                    type="button"
                    className={`nutrition-step-pill${isActive ? ' nutrition-step-pill--active' : ''}${isDone ? ' nutrition-step-pill--done' : ''}`}
                    onClick={() => setStep(n)}
                  >
                    <span className="nutrition-step-pill__num">{n}</span>
                    <span className="nutrition-step-pill__label">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Followup banner (sous le header V84) */}
      {isFollowup && previousConsultation && (
        <div className="followup-banner">
          Consultation de suivi — Semaine {followupWeek}/4 — Derniere consultation : {formatDate(previousConsultation.date)}
        </div>
      )}

      {/* Step: Client summary (read-only) */}
      {currentStepType === 'summary' && (
        <div className="nutrition-form-section">
          {/* Pre-RDV clinical summary */}
          {(() => {
            const summary = buildPreRdvSummary(form);
            if (!summary.hasData) return null;
            return (
              <div style={{ background: 'rgba(26,46,31,.15)', border: '1px solid rgba(74,222,128,.2)', borderRadius: 10, padding: '16px 20px', marginBottom: 20 }}>
                <h4 style={{ fontSize: '.85rem', fontWeight: 700, color: '#4ade80', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 12 }}>Synthese pre-RDV</h4>
                {summary.objectif && (
                  <div style={{ marginBottom: 8 }}>
                    <span style={{ fontSize: '.75rem', color: '#8a8a7a', textTransform: 'uppercase', letterSpacing: '.3px' }}>Objectif</span>
                    <div style={{ fontSize: '.88rem', color: '#f0f0e8', fontWeight: 600, marginTop: 2 }}>{summary.objectif}</div>
                  </div>
                )}
                {summary.priorities.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <span style={{ fontSize: '.75rem', color: '#8a8a7a', textTransform: 'uppercase', letterSpacing: '.3px' }}>Priorites detectees</span>
                    <div style={{ marginTop: 4 }}>
                      {summary.priorities.map((p, i) => (
                        <div key={i} style={{ fontSize: '.83rem', color: '#f87171', display: 'flex', gap: 6, marginBottom: 2 }}>
                          <span style={{ color: '#f87171', fontWeight: 700 }}>{i + 1}.</span> {p}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {summary.vigilance.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <span style={{ fontSize: '.75rem', color: '#8a8a7a', textTransform: 'uppercase', letterSpacing: '.3px' }}>Points de vigilance</span>
                    <div style={{ marginTop: 4 }}>
                      {summary.vigilance.map((v, i) => (
                        <div key={i} style={{ fontSize: '.83rem', color: '#fbbf24', display: 'flex', gap: 6, marginBottom: 2 }}>
                          <span>&#9888;</span> {v}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {summary.axes.length > 0 && (
                  <div>
                    <span style={{ fontSize: '.75rem', color: '#8a8a7a', textTransform: 'uppercase', letterSpacing: '.3px' }}>Axes de travail</span>
                    <div style={{ marginTop: 4 }}>
                      {summary.axes.map((a, i) => (
                        <div key={i} style={{ fontSize: '.83rem', color: '#4ade80', display: 'flex', gap: 6, marginBottom: 2 }}>
                          <span>&#8594;</span> {a}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

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

          <div style={{
            marginTop: 20,
            border: '1px solid rgba(197,176,122,.2)',
            borderRadius: 12,
            overflow: 'hidden',
          }}>
            <button
              type="button"
              onClick={() => setMgdOpen(o => !o)}
              style={{
                width: '100%', padding: '14px 16px',
                background: mgdOpen
                  ? 'rgba(197,176,122,.1)' : 'rgba(197,176,122,.04)',
                border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', gap: 10,
                transition: 'background .2s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '.85rem', fontWeight: 700, color: '#c5b07a' }}>
                  🧬 Analyse biologique (MGD)
                </span>
                {consultation.mgd_recommendation && consultation.mgd_recommendation !== 'none' && (
                  <span style={{
                    fontSize: '.68rem', padding: '2px 7px', borderRadius: 10,
                    background: 'rgba(197,176,122,.15)',
                    color: '#c5b07a', border: '1px solid rgba(197,176,122,.3)',
                  }}>
                    {consultation.mgd_recommendation === 'advanced' ? 'Bilan avancé' : 'Bilan sanguin'}
                  </span>
                )}
              </div>
              <span style={{ color: '#c5b07a', fontSize: '.8rem', transition: 'transform .2s',
                transform: mgdOpen ? 'rotate(180deg)' : 'rotate(0deg)', display: 'inline-block' }}>
                ▾
              </span>
            </button>

            {mgdOpen && (
              <div style={{ padding: '16px', borderTop: '1px solid rgba(197,176,122,.1)' }}>
          {(() => {
            const symp = detectSymptomsFromForm(form);
            if (!symp.length) return null;
            const sympLabels = {
              fatigue: 'Fatigue', digestion: 'Digestion', bloating: 'Ballonnements',
              stress: 'Stress', sleep: 'Sommeil', cravings: 'Fringales sucre',
              inflammation: 'Inflammation', skin_hair: 'Peau / Cheveux',
              weight_gain: 'Surpoids', metabolic: 'Métabolisme',
              female_hormones: 'Hormones féminines', pms_cycle: 'SPM / Cycle',
              thyroid: 'Thyroïde', performance: 'Performance',
            };
            return (
              <div style={{
                marginTop: 20,
                padding: '12px 16px',
                background: 'rgba(106,191,138,.06)',
                border: '1px solid rgba(106,191,138,.2)',
                borderLeft: '3px solid rgba(106,191,138,.5)',
                borderRadius: 10,
              }}>
                <div style={{
                  fontSize: '.68rem', fontWeight: 700,
                  color: 'rgba(106,191,138,.6)',
                  textTransform: 'uppercase', letterSpacing: '.4px',
                  marginBottom: 8,
                }}>
                  Symptômes détectés — suggestions automatiques
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {symp.map(s => (
                    <span key={s} style={{
                      padding: '2px 8px', borderRadius: 20,
                      background: 'rgba(106,191,138,.1)',
                      border: '1px solid rgba(106,191,138,.2)',
                      fontSize: '.72rem', color: '#8abf9a',
                    }}>
                      {sympLabels[s] || s}
                    </span>
                  ))}
                </div>
                <div style={{ fontSize: '.7rem', color: 'rgba(255,255,255,.25)', marginTop: 6 }}>
                  Ces suggestions sont basées sur le profil client. La décision finale reste la vôtre.
                </div>
              </div>
            );
          })()}

          <div style={{
            marginTop: 12,
            padding: '16px',
            background: 'rgba(255,255,255,.04)',
            border: '1px solid rgba(255,255,255,.1)',
            borderRadius: 12,
          }}>
            <div style={{
              fontSize: '.75rem', fontWeight: 700,
              color: '#c5b07a',
              textTransform: 'uppercase', letterSpacing: '.5px',
              marginBottom: 14,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              ⚕️ Recommandation bilan MGD
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                {
                  value: 'none',
                  label: 'Aucun test pour le moment',
                  desc: '',
                  color: 'rgba(255,255,255,.3)',
                },
                {
                  value: 'blood',
                  label: 'Bilan sanguin recommandé',
                  desc: 'Oméga-3 · Glycémie / Insuline · CRP · Vitamine D',
                  color: '#8abf9a',
                },
                {
                  value: 'advanced',
                  label: 'Bilan avancé recommandé',
                  desc: 'Bilan sanguin complet + Test ADN nutritionnel',
                  color: '#c5b07a',
                },
              ].map(opt => {
                const selected = consultation.mgd_recommendation === opt.value;
                return (
                  <label
                    key={opt.value}
                    onClick={() => updateField('mgd_recommendation', opt.value)}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 10,
                      padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                      background: selected ? 'rgba(255,255,255,.05)' : 'none',
                      border: selected
                        ? `1px solid ${opt.color}`
                        : '1px solid rgba(255,255,255,.05)',
                      transition: 'all .15s',
                    }}
                  >
                    {/* Radio visuel */}
                    <div style={{
                      width: 16, height: 16, borderRadius: '50%',
                      border: `2px solid ${selected ? opt.color : 'rgba(255,255,255,.2)'}`,
                      background: selected ? opt.color : 'none',
                      flexShrink: 0, marginTop: 2,
                      transition: 'all .15s',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {selected && (
                        <div style={{
                          width: 6, height: 6, borderRadius: '50%',
                          background: '#1a2e1f',
                        }} />
                      )}
                    </div>
                    <div>
                      <div style={{
                        fontSize: '.83rem', fontWeight: 600,
                        color: selected ? opt.color : 'rgba(255,255,255,.5)',
                        transition: 'color .15s',
                      }}>
                        {opt.label}
                      </div>
                      {opt.desc && (
                        <div style={{
                          fontSize: '.72rem',
                          color: selected ? 'rgba(255,255,255,.4)' : 'rgba(255,255,255,.2)',
                          marginTop: 2,
                        }}>
                          {opt.desc}
                        </div>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Lab results input (shown when blood test is done) */}
          {(consultation.mgd_recommendation === 'blood' || consultation.mgd_recommendation === 'advanced') && (
            <div style={{
              marginTop: 16,
              padding: '16px',
              background: 'rgba(255,255,255,.03)',
              border: '1px solid rgba(255,255,255,.08)',
              borderRadius: 12,
            }}>
              <div style={{
                fontSize: '.75rem', fontWeight: 700,
                color: '#c5b07a',
                textTransform: 'uppercase', letterSpacing: '.5px',
                marginBottom: 12,
              }}>
                🔬 Résultats biologiques
              </div>
              <p style={{ fontSize: '.75rem', color: '#6b5f48', marginBottom: 10 }}>
                Saisissez les valeurs disponibles. Les champs vides sont ignorés.
              </p>

              {/* V45 : Quick Fills — bilans pre-configures */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: '.7rem', color: '#6b5f48', marginRight: 4 }}>
                    Bilan type :
                  </span>
                  {LAB_QUICK_FILLS.map(qf => {
                    const isActive = activeLabQuickFill === qf.id;
                    return (
                      <button
                        key={qf.id}
                        type="button"
                        onClick={() => setActiveLabQuickFill(isActive ? null : qf.id)}
                        style={{
                          padding: '6px 10px',
                          fontSize: '.72rem',
                          fontWeight: isActive ? 700 : 500,
                          borderRadius: 20,
                          border: `1px solid ${isActive ? 'rgba(197,176,122,.5)' : 'rgba(255,255,255,.12)'}`,
                          background: isActive ? 'rgba(197,176,122,.14)' : 'rgba(255,255,255,.03)',
                          color: isActive ? '#d4c9a8' : 'rgba(255,255,255,.65)',
                          cursor: 'pointer',
                          transition: 'all .15s',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {qf.icon} {qf.label}
                      </button>
                    );
                  })}
                  {activeLabQuickFill && (
                    <button
                      type="button"
                      onClick={() => setActiveLabQuickFill(null)}
                      style={{
                        padding: '6px 10px',
                        fontSize: '.7rem',
                        fontWeight: 500,
                        borderRadius: 20,
                        border: '1px solid rgba(255,255,255,.12)',
                        background: 'transparent',
                        color: 'rgba(255,255,255,.45)',
                        cursor: 'pointer',
                        marginLeft: 4,
                      }}
                    >
                      ✕ Tout afficher
                    </button>
                  )}
                </div>
                {activeLabQuickFill && (() => {
                  const qf = LAB_QUICK_FILLS.find(q => q.id === activeLabQuickFill);
                  return (
                    <div style={{ marginTop: 8, fontSize: '.68rem', color: '#6b5f48' }}>
                      {qf.markers.length} marqueurs attendus pour ce bilan. Les autres restent disponibles via "Tout afficher".
                    </div>
                  );
                })()}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                {(activeLabQuickFill
                  ? LAB_MARKERS_UI.filter(m => LAB_QUICK_FILLS.find(q => q.id === activeLabQuickFill)?.markers.includes(m.key))
                  : LAB_MARKERS_UI
                ).map(({ key, label, unit }) => (
                  <div key={key} className="field" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: '.72rem' }}>
                      {label} <span style={{ textTransform: 'none' }}>({unit})</span>
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={consultation.lab_results?.[key] || ''}
                      onChange={e => {
                        const val = e.target.value;
                        setConsultation(prev => ({
                          ...prev,
                          lab_results: { ...prev.lab_results, [key]: val === '' ? '' : Number(val) },
                        }));
                      }}
                      placeholder="-"
                      style={{ fontSize: '.8rem', padding: '6px 8px' }}
                    />
                  </div>
                ))}
              </div>

              {/* Live interpretation preview */}
              {(() => {
                if (!hasLabData) return null;
                const analysis = labAnalysisMemo;
                if (!analysis || analysis.signals.length === 0) return (
                  <div style={{ marginTop: 10, fontSize: '.78rem', color: '#2a9d5c' }}>Tous les marqueurs saisis sont dans les normes fonctionnelles.</div>
                );
                return (
                  <div style={{ marginTop: 10, background: 'rgba(124,92,191,.06)', borderRadius: 8, padding: '10px 14px', fontSize: '.78rem' }}>
                    <strong style={{ display: 'block', marginBottom: 6, color: '#d4c9a8' }}>Signaux detectes ({analysis.signals.length})</strong>
                    {analysis.adjustments.slice(0, 6).map((adj, i) => (
                      <div key={i} style={{ marginBottom: 6 }}>
                        <span style={{ color: '#d4c9a8', fontWeight: 600 }}>{adj.label}</span>
                        <span style={{ color: '#6b5f48', marginLeft: 6 }}>— {adj.dietary[0]}</span>
                        {adj.caution && <div style={{ color: '#d45c4c', fontSize: '.72rem', marginTop: 2 }}>{adj.caution}</div>}
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* Corrélations symptômes ↔ biologie */}
              {(() => {
                const correlation = mgdCorrelationMemo;
                if (!correlation) return null;
                if (!correlation.hasCorrelations && !correlation.uncorrelatedSignals.length) return null;

                return (
                  <div style={{
                    marginTop: 12,
                    padding: '12px 14px',
                    background: correlation.hasCritical
                      ? 'rgba(248,113,113,.06)' : 'rgba(197,176,122,.05)',
                    border: `1px solid ${correlation.hasCritical
                      ? 'rgba(248,113,113,.2)' : 'rgba(197,176,122,.15)'}`,
                    borderRadius: 10,
                  }}>
                    <div style={{
                      fontSize: '.72rem', fontWeight: 700,
                      color: correlation.hasCritical ? '#f87171' : '#c5b07a',
                      textTransform: 'uppercase', letterSpacing: '.4px',
                      marginBottom: 10,
                    }}>
                      🔗 Corrélations symptômes ↔ biologie
                    </div>

                    {/* Résumé clinique — en haut, lecture rapide */}
                    {correlation.clinicalSummary && (
                      <div style={{
                        marginBottom: 12, padding: '10px 12px',
                        background: correlation.hasCritical
                          ? 'rgba(248,113,113,.1)' : 'rgba(197,176,122,.08)',
                        borderRadius: 8,
                        borderLeft: `3px solid ${correlation.hasCritical ? '#f87171' : '#c5b07a'}`,
                      }}>
                        <div style={{ fontSize: '.8rem', fontWeight: 700, color: '#f0f0e8', marginBottom: 3 }}>
                          {correlation.hasCritical ? '⚠️' : '📋'} {correlation.clinicalSummary.mainIssue}
                        </div>
                        <div style={{ fontSize: '.75rem', color: 'rgba(255,255,255,.5)' }}>
                          Confirmé par : {correlation.clinicalSummary.confirmedBy}
                        </div>
                        {correlation.clinicalSummary.topAction && (
                          <div style={{ fontSize: '.75rem', color: '#8abf9a', marginTop: 4, fontStyle: 'italic' }}>
                            → {correlation.clinicalSummary.topAction.slice(0, 80)}
                            {correlation.clinicalSummary.topAction.length > 80 ? '...' : ''}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Corrélations priorisées */}
                    {correlation.correlations.map((c, i) => {
                      const priorityColors = {
                        high:   { bg: 'rgba(248,113,113,.06)', border: 'rgba(248,113,113,.3)', badge: '#f87171', label: 'Priorité haute' },
                        medium: { bg: 'rgba(251,191,36,.05)',  border: 'rgba(251,191,36,.25)', badge: '#fbbf24', label: 'Priorité moyenne' },
                        watch:  { bg: 'rgba(255,255,255,.03)', border: 'rgba(255,255,255,.08)', badge: '#94a3b8', label: 'Surveillance' },
                      };
                      const pc = priorityColors[c.priority] || priorityColors.watch;
                      return (
                        <div key={i} style={{
                          marginBottom: 6, padding: '7px 10px',
                          background: pc.bg, borderRadius: 7,
                          border: `1px solid ${pc.border}`,
                          display: 'flex', alignItems: 'flex-start', gap: 8,
                        }}>
                          <span style={{
                            fontSize: '.6rem', fontWeight: 700, padding: '2px 6px',
                            borderRadius: 10, background: pc.border, color: pc.badge,
                            whiteSpace: 'nowrap', flexShrink: 0, marginTop: 1,
                          }}>
                            {pc.label}
                          </span>
                          <div>
                            <div style={{ fontSize: '.8rem', fontWeight: 600, color: '#e0d8c0' }}>
                              {c.symptomLabel}
                            </div>
                            <div style={{ fontSize: '.7rem', color: 'rgba(255,255,255,.35)', marginTop: 1 }}>
                              {c.confirmedBy.map(b => b.label).join(' · ')}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {/* Actions prioritaires */}
                    {correlation.alerts.length > 0 && (
                      <div style={{ marginTop: 10, paddingTop: 10,
                        borderTop: '1px solid rgba(255,255,255,.06)' }}>
                        <div style={{ fontSize: '.68rem', fontWeight: 700,
                          color: '#f87171', textTransform: 'uppercase',
                          letterSpacing: '.3px', marginBottom: 8 }}>
                          ⚡ Actions prioritaires
                        </div>
                        {correlation.alerts.slice(0, 3).map((a, i) => (
                          <div key={i} style={{
                            fontSize: '.75rem', color: '#b0c4a8',
                            paddingLeft: 10,
                            borderLeft: '2px solid rgba(248,113,113,.3)',
                            marginBottom: 6, lineHeight: 1.5,
                          }}>
                            <strong style={{ color: '#f87171' }}>{a.label}</strong>
                            <span style={{ color: 'rgba(255,255,255,.35)', marginLeft: 6 }}>
                              — {a.action}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* CTA — Régénérer avec MGD */}
                    {correlation.hasCorrelations && (
                      <button
                        type="button"
                        onClick={() => {
                          setStep(2);
                          setTimeout(() => {
                            handleGenerate();
                          }, 150);
                        }}
                        style={{
                          width: '100%', marginTop: 12, padding: '9px',
                          borderRadius: 8, border: '1px solid rgba(106,191,138,.25)',
                          background: 'rgba(106,191,138,.08)', color: '#8abf9a',
                          cursor: 'pointer', fontSize: '.8rem', fontWeight: 600,
                          transition: 'all .15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background='rgba(106,191,138,.18)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background='rgba(106,191,138,.08)'; }}
                      >
                        ✨ Régénérer le plan avec les priorités MGD
                      </button>
                    )}

                    {/* Signaux sans symptôme déclaré */}
                    {correlation.uncorrelatedSignals.length > 0 && (
                      <div style={{
                        marginTop: 8, fontSize: '.7rem',
                        color: 'rgba(255,255,255,.25)', fontStyle: 'italic',
                      }}>
                        Signaux détectés sans symptôme déclaré — à explorer au prochain RDV.
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Analyses recommandées MGD */}
              <div style={{
                marginTop: 16,
                padding: '16px',
                background: 'rgba(255,255,255,.03)',
                border: '1px solid rgba(255,255,255,.08)',
                borderRadius: 12,
              }}>
                <div style={{
                  fontSize: '.75rem', fontWeight: 700,
                  color: '#c5b07a', textTransform: 'uppercase',
                  letterSpacing: '.5px', marginBottom: 12,
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'space-between',
                }}>
                  <span>📝 Analyses recommandées (MGD)</span>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => {
                        const generated = buildRecommendedBloodTests(form);
                        setConsultation(prev => ({
                          ...prev,
                          mgd_recommended_tests_text: generated,
                        }));
                      }}
                      style={{
                        padding: '3px 10px', borderRadius: 6,
                        border: '1px solid rgba(197,176,122,.3)',
                        background: 'rgba(197,176,122,.1)',
                        color: '#c5b07a', cursor: 'pointer',
                        fontSize: '.72rem', fontWeight: 600,
                      }}
                    >
                      ✨ Générer
                    </button>
                    {/* V50 : Export PDF directement dans la section MGD */}
                    <button
                      type="button"
                      onClick={() => {
                        setAnalysesError('');
                        const symp = detectSymptomsFromForm(form);
                        const recs = getEnrichedMGDRecommendations(symp);
                        const val = validateAnalysesPDF(symp, recs);
                        if (!val.valid) {
                          setAnalysesError('Export bloque : ' + val.errors.join(' | '));
                          return;
                        }
                        exportAnalysesPDF(recs, symp, clientName, formatDate(today));
                      }}
                      style={{
                        padding: '3px 10px', borderRadius: 6,
                        border: '1px solid rgba(106,191,138,.3)',
                        background: 'rgba(106,191,138,.1)',
                        color: '#8abf9a', cursor: 'pointer',
                        fontSize: '.72rem', fontWeight: 600,
                      }}
                    >
                      📄 Export prescription labo
                    </button>
                    <button
                      type="button"
                      onClick={() => setConsultation(prev => ({
                        ...prev,
                        mgd_recommended_tests_text: '',
                      }))}
                      style={{
                        padding: '3px 10px', borderRadius: 6,
                        border: '1px solid rgba(255,255,255,.08)',
                        background: 'none',
                        color: 'rgba(255,255,255,.3)', cursor: 'pointer',
                        fontSize: '.72rem',
                      }}
                    >
                      Reset
                    </button>
                  </div>
                </div>
                {analysesError && (
                  <div style={{ marginTop: 8, padding: '8px 12px', background: 'rgba(248,113,113,.1)', border: '1px solid rgba(248,113,113,.3)', borderRadius: 6, color: '#f87171', fontSize: '.75rem' }}>
                    {analysesError}
                  </div>
                )}
                <textarea
                  value={consultation.mgd_recommended_tests_text || ''}
                  onChange={e => setConsultation(prev => ({
                    ...prev,
                    mgd_recommended_tests_text: e.target.value,
                  }))}
                  placeholder="Cliquez sur Générer pour obtenir les analyses recommandées, ou saisissez manuellement..."
                  style={{
                    width: '100%', minHeight: 100,
                    background: 'rgba(0,0,0,.2)',
                    border: '1px solid rgba(255,255,255,.08)',
                    borderRadius: 8, padding: '10px 12px',
                    color: '#d4c9a8', fontSize: '.82rem',
                    lineHeight: 1.7, fontFamily: 'inherit',
                    resize: 'vertical', outline: 'none',
                  }}
                  onFocus={e => { e.target.style.borderColor = 'rgba(197,176,122,.4)'; }}
                  onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,.08)'; }}
                />
                <div style={{
                  fontSize: '.7rem', color: 'rgba(255,255,255,.2)',
                  marginTop: 6,
                }}>
                  Basé sur le profil client. Modifiable librement.
                </div>
              </div>
            </div>
          )}

          {/* V46 : Tests génétiques (ADN) — visible si dna_test_done ou advanced */}
          {(consultation.dna_test_done || consultation.mgd_recommendation === 'advanced') && (
            <div style={{
              marginTop: 16,
              padding: '16px',
              background: 'rgba(255,255,255,.03)',
              border: '1px solid rgba(255,255,255,.08)',
              borderRadius: 12,
            }}>
              <div style={{
                fontSize: '.75rem', fontWeight: 700,
                color: '#c5b07a',
                textTransform: 'uppercase', letterSpacing: '.5px',
                marginBottom: 12,
              }}>
                🧬 Tests génétiques (ADN)
              </div>
              <p style={{ fontSize: '.75rem', color: '#6b5f48', marginBottom: 12 }}>
                Renseignez les variants disponibles. Les tests non renseignés sont ignorés.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {GENE_CATALOG.map(gene => (
                  <div key={gene.id} className="field" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: '.72rem', display: 'block' }}>
                      {gene.label}
                      <span style={{ color: '#6b5f48', fontWeight: 400, fontSize: '.65rem', marginLeft: 6 }}>
                        — {gene.description}
                      </span>
                    </label>
                    <select
                      value={consultation.genetic_results?.[gene.id] || ''}
                      onChange={e => {
                        const val = e.target.value;
                        setConsultation(prev => ({
                          ...prev,
                          genetic_results: { ...(prev.genetic_results || {}), [gene.id]: val },
                        }));
                      }}
                      style={{ fontSize: '.8rem', padding: '6px 8px', width: '100%' }}
                    >
                      {gene.options.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              {/* Live preview des ajustements actifs */}
              {(() => {
                const active = getActiveGeneticAdjustments(consultation.genetic_results);
                if (active.length === 0) return (
                  <div style={{ marginTop: 12, fontSize: '.75rem', color: '#6b5f48', fontStyle: 'italic' }}>
                    Aucun variant significatif renseigné pour le moment.
                  </div>
                );
                return (
                  <div style={{ marginTop: 12, background: 'rgba(124,92,191,.06)', borderRadius: 8, padding: '10px 14px', fontSize: '.78rem' }}>
                    <strong style={{ display: 'block', marginBottom: 6, color: '#d4c9a8' }}>
                      🧬 Variants actifs ({active.length}) — seront intégrés au plan
                    </strong>
                    {active.map((adj, i) => (
                      <div key={i} style={{ marginBottom: 8 }}>
                        <div style={{ color: '#d4c9a8', fontWeight: 600, fontSize: '.75rem' }}>{adj.label}</div>
                        {adj.note && (
                          <div style={{ color: '#6b5f48', fontSize: '.7rem', marginTop: 2 }}>{adj.note}</div>
                        )}
                        {adj.recos && adj.recos.length > 0 && (
                          <div style={{ color: 'rgba(255,255,255,.55)', fontSize: '.7rem', marginTop: 3 }}>
                            → {adj.recos[0]}
                            {adj.recos.length > 1 && <span style={{ color: '#6b5f48' }}> (+{adj.recos.length - 1} autres)</span>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step: Follow-up (only for returning clients) */}
      {currentStepType === 'followup' && (
        <>
          <div className="nutrition-form-section" style={{ marginBottom: 16 }}>
            <h3>Suivi semaine {followupWeek}/4</h3>
            <p style={{ fontSize: '.85rem', color: '#8a8a7a', marginBottom: 12 }}>
              {followupWeek === 1 && 'Evaluation de la tolerance et de l\'adherence au plan initial.'}
              {followupWeek === 2 && 'Premiers ajustements energie, faim et digestion.'}
              {followupWeek === 3 && 'Optimisation des portions, timing et recuperation.'}
              {followupWeek === 4 && 'Consolidation des acquis et preparation a l\'autonomie.'}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { key: 'energy', label: 'Energie' },
                { key: 'digestion', label: 'Digestion' },
                { key: 'hunger', label: 'Faim / Satiete' },
                { key: 'adherence', label: 'Adherence au plan' },
                { key: 'performance', label: 'Performance' },
                { key: 'cravings', label: 'Fringales / Envies' },
              ].map(({ key, label }) => (
                <div key={key} className="field">
                  <label>{label}</label>
                  <select
                    value={weeklyFeedback[key]}
                    onChange={e => setWeeklyFeedback(prev => ({ ...prev, [key]: e.target.value }))}
                  >
                    <option value="">--</option>
                    <option value="Nettement ameliore">Nettement ameliore</option>
                    <option value="Legerement ameliore">Legerement ameliore</option>
                    <option value="Identique">Identique</option>
                    <option value="Degrade">Degrade</option>
                  </select>
                </div>
              ))}
            </div>
            <div className="field full-width" style={{ marginTop: 10 }}>
              <label>Notes client cette semaine</label>
              <textarea
                value={weeklyFeedback.notes}
                onChange={e => setWeeklyFeedback(prev => ({ ...prev, notes: e.target.value }))}
                rows={2}
                placeholder="Observations, difficultes, questions..."
              />
            </div>
          </div>
          <FollowUpStep
            followupData={followupData}
            onChange={setFollowupData}
            previousConsultation={previousConsultation}
            clientForm={form}
          />
        </>
      )}

      {/* Observations step removed — data auto-populated from client questionnaire and used in AI prompt */}

      {/* Step: Nutrition Plan — cockpit clinique SaaS */}
      {currentStepType === 'plan' && (() => {
        const hasPlan = !!(planDraft || consultation.nutrition_plan);
        const clientName = form.prenom || client?.prenom || 'Client';
        const today = new Date().toISOString();

        // Source de verite unique : les drafts React (push-based depuis l'editeur).
        // Pour les exports, on fait une lecture ref finale en cas de keystroke non debounced.
        const readEdited = () => {
          const edited = editorGetDataRef.current ? editorGetDataRef.current() : null;
          return {
            plan: edited?.plan ?? planDraft,
            supplements: edited?.supplements ?? supplementsDraft,
            recipes: edited?.recipes ?? recipesDraft,
          };
        };

        const doExportPdf = async () => {
          console.log('[PDF] doExportPdf CALLED');
          setPdfError('');
          const edited = readEdited();
          // V88 : prime finalText si present (couche humaine au-dessus du plan IA).
          // Sinon, fallback sur le plan IA edite par l'utilisateur.
          const plan = (isFinal && finalText) ? finalText : edited.plan;
          const supplements = edited.supplements;
          const recipes = edited.recipes;
          if (isFinal && finalText) {
            console.log('[PDF] using FINAL version (length:', finalText.length, ')');
          }
          console.log('[PDF] plan length:', plan?.length, 'supplements length:', supplements?.length);
          const currentScore = scorePlanQuality(plan, supplements, { ...form, _weeklyFeedback: weeklyFeedback }, { isFollowup, followupWeek });
          const fullText = (plan || '') + '\n' + (supplements || '');
          const validation = validatePlanForPDF(fullText, currentScore, { isFollowup });
          console.log('[PDF] validation:', validation);
          if (!validation.valid) {
            console.log('[PDF] BLOCKED by validation:', validation.errors);
            setPdfError('Export bloque : ' + validation.errors.join(' | '));
            return;
          }
          const sections = structurePlanSections(plan, supplements, { isFollowup, locale: getClientNutritionLocale(client) });
          console.log('[PDF DEBUG] sections:', sections.length, sections.map(s => ({ title: s.title, type: s.type, contentLen: s.content?.length })));
          try {
            await exportConsultationPDF({
              observations: consultation.observations,
              nutritionalObservations: consultation.nutritional_observations,
              bloodTestDone: consultation.blood_test_done,
              dnaTestDone: consultation.dna_test_done,
              nutritionPlan: cleanPlanForPDF(plan),
              supplements: cleanPlanForPDF(supplements),
              recipes,
              notesForCoach: consultation.notes_for_coach,
              date: new Date().toISOString(),
              isFollowup,
              followupData: isFollowup ? followupData : null,
              sections,
            }, client);
            showSaveToast('PDF exporte');
          } catch (err) {
            console.error('PDF export failed', err);
            setPdfError('Export PDF echoue : ' + (err?.message || 'erreur inconnue'));
          }
        };

        const doExportPack = async () => {
          setPdfError('');
          const edited = readEdited();
          // V88 : prime finalText si version finale active
          const plan = (isFinal && finalText) ? finalText : edited.plan;
          const supplements = edited.supplements;
          const recipes = edited.recipes;
          const currentScore = scorePlanQuality(plan, supplements, { ...form, _weeklyFeedback: weeklyFeedback }, { isFollowup, followupWeek });
          const fullText = (plan || '') + '\n' + (supplements || '');
          const validation = validatePlanForPDF(fullText, currentScore, { isFollowup });
          if (!validation.valid) {
            setPdfError('Export dossier bloque : ' + validation.errors.join(' | '));
            return;
          }
          const sections = structurePlanSections(plan, supplements, { isFollowup, locale: getClientNutritionLocale(client) });
          const labDataForPdf = consultation.lab_results || {};
          const hasLabForPdf = Object.values(labDataForPdf).some(v => v !== '' && v != null);
          const correlationForPdf = hasLabForPdf
            ? buildMGDCorrelation(
                detectSymptomsFromForm(form),
                analyzeLabResults(labDataForPdf).signals || []
              )
            : null;
          try {
            await exportClientPackPDF({
              nutritionPlan: cleanPlanForPDF(plan),
              supplements: cleanPlanForPDF(supplements),
              recipes,
              date: new Date().toISOString(),
              isFollowup,
              sections,
              mgdRecommendation: consultation.mgd_recommendation || 'none',
              bloodTestDone: consultation.mgd_recommendation === 'blood' || consultation.mgd_recommendation === 'advanced',
              dnaTestDone: consultation.mgd_recommendation === 'advanced',
            }, client, {
              sections,
              coverFields: {
                prenom: form.prenom || client?.prenom || '',
                objectif: form.objectifPrincipalNutrition || form.objectifPrincipal || '',
              }, // V92.1 : forme inline preservee pour exportClientPackPDF (compat)
              mgdCorrelation: correlationForPdf,
            });
            showSaveToast('Dossier client exporte');
          } catch (err) {
            console.error('Pack export failed', err);
            setPdfError('Export dossier echoue : ' + (err?.message || 'erreur inconnue'));
          }
        };

        // V92.1 : doExportCover supprime — Word V92.0 gere sa propre cover

        const renderEditorTab = () => {
          if (editorTab === 'plan') {
            if (hasPlan) {
              return (
                <>
                  {/* Ressenti 7 jours de la cliente — lecture seule. Visible
                      en haut pour qu'Anissa l'ait sous les yeux avant de
                      modifier le plan. Auto-collapse si pas de feedbacks. */}
                  <ClientFeedbacksPanel client={client} consultation={consultation} />

                  {/* V94.49 : ClientAppSettingsCard deplace dans l'onglet
                      'App cliente' > 'Vue d'ensemble' pour eliminer le doublon
                      visuel ('📱 App cliente' + '⚙ Reglages app cliente'
                      coexistaient sur l'onglet 'plan'). */}

                  <NutritionEditor
                    key={`editor-${editorSeed}`}
                    planText={planDraft}
                    supplementsText={supplementsDraft}
                    recipesText={recipesDraft}
                    form={form}
                    client={client}
                    getEditedDataRef={editorGetDataRef}
                    onDraftChange={handleDraftChange}
                    hideActions
                    flashSectionType={flashSectionType}
                    readOnly={isReviewMode}
                    onSave={(plan, supplements, recipes) => {
                      setConsultation(prev => ({ ...prev, nutrition_plan: plan, supplements, recipes }));
                      setPlanDraft(plan);
                      setSupplementsDraft(supplements);
                      setRecipesDraft(recipes);
                    }}
                    onExportPDF={() => doExportPdf()}
                    onExportPack={() => doExportPack()}
                  />
                </>
              );
            }
            return (
              <div style={{ padding: 24, textAlign: 'center', color: '#8a8a7a', background: 'rgba(255,255,255,.02)', border: '1px dashed rgba(255,255,255,.1)', borderRadius: 12 }}>
                <p style={{ marginBottom: 12, fontSize: '.9rem' }}>Aucun plan genere pour l'instant.</p>
                <p style={{ fontSize: '.8rem' }}>Utilise le bouton <strong>Regenerer</strong> en haut, ou un template, pour creer le plan initial.</p>
              </div>
            );
          }
          if (editorTab === 'frigo') {
            const fj = consultation.fiche_frigo_json;
            return (
              <div style={{ padding: 16 }}>
                <p style={{ fontSize: '.82rem', color: '#8a8a7a', marginBottom: 12 }}>
                  Edite et reorganise la fiche frigo (3 vues : apercu, edition, vue client).
                </p>
                <button
                  type="button"
                  className="btn btn-anissa-primary"
                  onClick={() => setShowFrigoModal(true)}
                  disabled={!hasPlan}
                  style={{ padding: '10px 18px', borderRadius: 10 }}
                >
                  Ouvrir l'editeur fiche frigo
                </button>
                {fj ? (
                  <div style={{ marginTop: 16, background: 'rgba(255,255,255,.03)', borderRadius: 10, padding: '10px 12px', fontSize: '.78rem', color: '#c0b890', lineHeight: 1.55 }}>
                    <strong style={{ display: 'block', marginBottom: 6, color: '#d4c9a8' }}>Fiche structuree disponible</strong>
                    <div>Petit-dej : {(fj.repas?.petit_dejeuner || []).length} option(s)</div>
                    <div>Dejeuner : {(fj.repas?.dejeuner || []).length} option(s)</div>
                    <div>Diner : {(fj.repas?.diner || []).length} option(s)</div>
                    <div>A privilegier : {(fj.a_privilegier || []).length} / A limiter : {(fj.a_limiter || []).length}</div>
                  </div>
                ) : hasPlan ? (
                  <div style={{ marginTop: 12, fontSize: '.78rem', color: '#8a7a5a' }}>
                    Pas de JSON structure — la fiche frigo sera construite depuis le plan texte.
                  </div>
                ) : null}
              </div>
            );
          }
          if (editorTab === 's1s4') {
            const sections = hasPlan ? structurePlanSections(consultation.nutrition_plan, consultation.supplements, { isFollowup, locale: getClientNutritionLocale(client) }) : [];
            const weekly = sections.filter(s => /semaine\s*[1-4]|rotation|plan\s*d[ae]?\s*action/i.test(s.title));
            if (!hasPlan) {
              return <div style={{ padding: 24, textAlign: 'center', color: '#8a8a7a' }}>Genere d'abord un plan pour visualiser la progression S1-S4.</div>;
            }
            if (weekly.length === 0) {
              return <div style={{ padding: 16, color: '#8a8a7a', fontSize: '.85rem' }}>Aucune section hebdomadaire detectee dans le plan.</div>;
            }
            return (
              <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {weekly.map((s, i) => (
                  <div key={i} style={{ border: '1px solid rgba(255,255,255,.08)', borderRadius: 10, padding: '10px 14px', background: 'rgba(255,255,255,.02)' }}>
                    <div style={{ fontSize: '.78rem', fontWeight: 700, color: '#8abf9a', letterSpacing: '.04em', marginBottom: 6, textTransform: 'uppercase' }}>{s.title}</div>
                    <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '.82rem', color: '#d4c9a8', margin: 0, lineHeight: 1.55 }}>{s.content}</pre>
                  </div>
                ))}
              </div>
            );
          }
          if (editorTab === 'supp') {
            return (
              <div style={{ padding: 12 }}>
                <label style={{ display: 'block', fontSize: '.75rem', color: '#8a8a7a', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 6 }}>
                  Supplements recommandes
                </label>
                <textarea
                  value={consultation.supplements || ''}
                  onChange={(e) => updateField('supplements', e.target.value)}
                  placeholder="Protocole supplements + tableau horaire..."
                  rows={18}
                  style={{ width: '100%', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, padding: '10px 12px', color: '#d4c9a8', fontSize: '.85rem', fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.55 }}
                />
                <label style={{ display: 'block', fontSize: '.75rem', color: '#8a8a7a', textTransform: 'uppercase', letterSpacing: '.4px', marginTop: 14, marginBottom: 6 }}>
                  Recettes recommandees
                </label>
                <textarea
                  value={consultation.recipes || ''}
                  onChange={(e) => updateField('recipes', e.target.value)}
                  placeholder="Recettes specifiques..."
                  rows={8}
                  style={{ width: '100%', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, padding: '10px 12px', color: '#d4c9a8', fontSize: '.85rem', fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.55 }}
                />
              </div>
            );
          }
          // V94.41 → V94.48 : Hub app cliente complet — vue d'ensemble + Lettre IA
          // + Recettes IA + Messages + Ressources + Signaux. Separe du peaufinage
          // plan textuel pour clarifier les 2 mindsets (plan vs publication digitale).
          if (editorTab === 'app') {
            return (
              <div style={{ padding: 12 }}>
                <ClientAppPanel
                  client={client}
                  consultation={consultation}
                  form={form}
                  hasPlan={hasPlan}
                  onUpdateConsultation={(patch) => {
                    setConsultation((prev) => ({ ...prev, ...patch }));
                  }}
                  onOpenPreview={() => setShowClientAppPreview(true)}
                  // V94.57 : permet aux sous-onglets (Lettre/Recettes) de
                  // declencher la persistance globale apres save local.
                  // setTimeout + handleSaveRef.current : on attend le re-render
                  // post-setState, puis on appelle la version la plus recente
                  // de handleSave (avec le state mis a jour).
                  onPersistGlobally={() => {
                    setTimeout(() => handleSaveRef.current?.(), 0);
                  }}
                />
              </div>
            );
          }
          return null;
        };

        // V76 : renderPreviewTab retire — l'editeur est deja un apercu premium fidele.

        const Tab = ({ active, onClick, children }) => (
          <button
            type="button"
            onClick={onClick}
            className="nc-tab"
            style={{
              background: active ? 'rgba(106,191,138,.18)' : 'transparent',
              border: `1px solid ${active ? 'rgba(106,191,138,.4)' : 'rgba(255,255,255,.08)'}`,
              color: active ? '#9dd4b0' : '#8a8a7a',
              fontSize: '.78rem',
              fontWeight: 600,
              letterSpacing: '.02em',
              padding: '7px 14px',
              borderRadius: 999,
              cursor: 'pointer',
              transition: 'all .15s',
              whiteSpace: 'nowrap',
            }}
          >{children}</button>
        );

        return (
          <div className="nc-cockpit" style={{ display: 'flex', flexDirection: 'column', gap: 16, height: 'auto', minHeight: '100vh', overflowY: 'auto', overflowX: 'hidden' }}>
            {/* ─── HEADER ACTIONS ─── */}
            <div className="nc-cockpit-header" style={{ position: 'sticky', top: 0, zIndex: 5, background: 'rgba(12,18,15,.92)', backdropFilter: 'blur(10px)', border: '1px solid rgba(106,191,138,.15)', borderRadius: 14, padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Meta line */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {/* V83.1 : mini logo Anissa dans le cockpit sticky — reste visible au scroll */}
                  <img
                    src="/logo-anissa.png"
                    alt="Anissa Nutrition"
                    style={{ height: 28, width: 'auto', flexShrink: 0, opacity: .9 }}
                    onError={e => { e.currentTarget.style.display = 'none'; }}
                  />
                  <span style={{ fontSize: '.72rem', color: '#8abf9a', textTransform: 'uppercase', letterSpacing: '.2em', fontWeight: 600 }}>Plan nutrition</span>
                  <span style={{ fontSize: '.82rem', color: '#d4c9a8', fontWeight: 500 }}>{clientName}</span>
                  {/* V80 : badge mode (one-shot vs suivi) — discret, lu depuis client.packType */}
                  {(() => {
                    const planMode = getNutritionPlanMode(client);
                    const isOneShot = planMode === 'oneshot';
                    return (
                      <span
                        title={isOneShot
                          ? 'Consultation unique — plan autonome pour 4 semaines'
                          : 'Accompagnement continu — plan évolutif'}
                        style={{
                          fontSize: '.7rem',
                          background: isOneShot ? 'rgba(196,160,80,.16)' : 'rgba(106,191,138,.16)',
                          color: isOneShot ? '#d4b568' : '#8abf9a',
                          padding: '2px 8px', borderRadius: 999, fontWeight: 600,
                        }}
                      >
                        {isOneShot ? 'Bilan individuel' : 'Suivi'}
                      </span>
                    );
                  })()}
                  {isFollowup && <span style={{ fontSize: '.7rem', background: 'rgba(124,92,191,.18)', color: '#b49ce0', padding: '2px 8px', borderRadius: 999, fontWeight: 600 }}>Suivi S{followupWeek}/4</span>}
                  {/* V88 : badge Version finale visible si la consultation a une couche finalisation active */}
                  {isFinal && (
                    <span
                      title={consultation.finalUpdatedAt ? `Finalisee le ${new Date(consultation.finalUpdatedAt).toLocaleString('fr-CH')}` : 'Version finale active \u2014 le PDF utilise la version editee'}
                      style={{
                        fontSize: '.7rem',
                        background: 'rgba(196,160,80,.22)',
                        color: '#e0cda0',
                        padding: '2px 8px',
                        borderRadius: 999,
                        fontWeight: 700,
                        border: '1px solid rgba(196,160,80,.45)',
                      }}
                    >
                      {'\u270d\ufe0f'} Version finale
                    </span>
                  )}
                  {autoCorrected && <span style={{ fontSize: '.7rem', background: 'rgba(255,200,60,.15)', color: '#e8c560', padding: '2px 8px', borderRadius: 999 }}>Auto-corrige</span>}
                  {/* V81 : indicateur dirty state visible dans le header (remplace le petit texte bas droit) */}
                  {autoSaveStatus === 'unsaved' && (
                    <span
                      title="Des modifications n'ont pas encore été enregistrées"
                      style={{
                        fontSize: '.7rem',
                        background: 'rgba(232,160,64,.18)',
                        color: '#e8a040',
                        padding: '2px 8px',
                        borderRadius: 999,
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                      }}
                    >
                      <span style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: '#e8a040',
                        animation: 'ncDirtyPulse 1.8s ease-in-out infinite',
                      }} />
                      Non sauvegardé
                    </span>
                  )}
                  {autoSaveStatus === 'saving' && (
                    <span style={{
                      fontSize: '.7rem', background: 'rgba(232,160,64,.1)',
                      color: '#c5a048', padding: '2px 8px', borderRadius: 999, fontWeight: 600,
                    }}>
                      ⟳ Sauvegarde…
                    </span>
                  )}
                </div>
                {/* V83 : bloc qualite/AI analysis masque en mode relecture pour lisibilite */}
                {hasPlan && !isReviewMode && (
                  <div style={{ width: '100%' }}>
                    <PlanQualityScore
                      score={liveScore || scorePlanQuality(
                        planDraft,
                        supplementsDraft,
                        { ...form, _weeklyFeedback: weeklyFeedback },
                        { isFollowup, followupWeek }
                      )}
                      autoCorrected={autoCorrected}
                      aiAnalysis={aiAnalysis}
                      analyzing={analyzingPlan}
                      aiAnalysisError={aiAnalysisError}
                      planSignatureCurrent={(planDraft || '').length + '|' + (planDraft || '').slice(0, 200)}
                      insertedWinsMap={insertedWinsMap}
                      onRevisitWin={(win) => {
                        // V79.3 : Re-clic sur une quickWin deja inseree → on re-scroll + flash.
                        const type = insertedWinsMap[win];
                        if (!type) return;
                        setFlashSectionType(type);
                        requestAnimationFrame(() => {
                          requestAnimationFrame(() => {
                            const sel = `.ne-section[data-section-type="${type}"]`;
                            const el = document.querySelector(sel);
                            if (el) {
                              try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
                              catch { el.scrollIntoView(); }
                            }
                          });
                        });
                      }}
                      onInsertQuickWin={(win) => {
                        // V79 : Copilot — insertion ciblee dans la section detectee
                        const result = insertWinIntoPlan(planDraft, win);
                        if (!result.ok) {
                          showSaveToast('⚠ ' + failureMessage(result.reason));
                          return;
                        }
                        // Backup pour undo
                        setLastInsertBackup({
                          prevPlan: planDraft,
                          prevSupplements: supplementsDraft,
                          prevRecipes: recipesDraft,
                          win,
                          type: result.type,
                          expiresAt: Date.now() + 20000, // fenetre undo : 20s
                        });
                        // V79.3 : marquer la win comme inseree
                        setInsertedWinsMap(prev => ({ ...prev, [win]: result.type }));
                        // Reseed editor avec le nouveau plan
                        reseedEditor(result.newPlan, supplementsDraft, recipesDraft);
                        showSaveToast(`✨ Inséré dans ${sectionLabel(result.type)}`);

                        // V79.1 : scroll vers la section + flash via React state (robuste aux re-renders)
                        setFlashSectionType(result.type);
                        // Scroll : attendre le remount (editorSeed++) avant de chercher le DOM
                        requestAnimationFrame(() => {
                          requestAnimationFrame(() => {
                            setTimeout(() => {
                              const sel = `.ne-section[data-section-type="${result.type}"]`;
                              const el = document.querySelector(sel);
                              if (!el) return;
                              try {
                                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                              } catch {
                                el.scrollIntoView();
                              }
                            }, 50);
                          });
                        });
                      }}
                      onAnalyze={async () => {
                        setAnalyzingPlan(true);
                        setAiAnalysisError('');
                        try {
                          // V88.14 : passer la locale pour que l'audit et les quickWins
                          // sortent dans la bonne langue (FR par defaut / EN pour Benfitcoach EN)
                          const result = await analyzeFullPlan(form, planDraft, supplementsDraft, {
                            locale: getClientNutritionLocale(client),
                          });
                          if (result) {
                            result.planSignature = (planDraft || '').length + '|' + (planDraft || '').slice(0, 200);
                            result.analyzedAt = new Date().toISOString();
                            setAiAnalysis(result);
                          } else {
                            setAiAnalysisError('L\'IA n\'a pas pu produire une analyse structuree. Relance ou verifie ta cle API.');
                          }
                        } catch (err) {
                          console.error('[AI analysis]', err.message);
                          setAiAnalysisError('Erreur reseau : ' + (err.message || 'inconnue'));
                        } finally {
                          setAnalyzingPlan(false);
                        }
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Suggestions panel — V83 : masque en mode relecture */}
              {!isReviewMode && suggestions.length > 0 && (
                <div style={{
                  marginTop: 10,
                  padding: '10px 14px',
                  background: 'rgba(255,255,255,.02)',
                  border: '1px solid rgba(255,255,255,.06)',
                  borderRadius: 10,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}>
                  <div style={{
                    fontSize: '.68rem', fontWeight: 700, color: 'rgba(255,255,255,.3)',
                    textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 2,
                  }}>
                    Suggestions
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {suggestions.map(s => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          showSaveToast(`Ouvre la section concern\u00e9e et clique \u2728 IA \u2192 ${
                            s.action === 'actionnable' ? 'Rendre actionnable' :
                            s.action === 'rewrite' ? 'Reformuler pro' :
                            s.action === 'simplify' ? 'Simplifier' :
                            s.action === 'adapt' ? 'Adapter au client' : 'Am\u00e9liorer'
                          }`);
                        }}
                        style={{
                          padding: '5px 12px', borderRadius: 20, fontSize: '.75rem',
                          background: 'rgba(255,255,255,.04)',
                          border: '1px solid rgba(255,255,255,.1)',
                          color: '#b0c4a8', cursor: 'pointer', transition: 'all .15s',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background = 'rgba(106,191,138,.1)';
                          e.currentTarget.style.borderColor = 'rgba(106,191,138,.3)';
                          e.currentTarget.style.color = '#8abf9a';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = 'rgba(255,255,255,.04)';
                          e.currentTarget.style.borderColor = 'rgba(255,255,255,.1)';
                          e.currentTarget.style.color = '#b0c4a8';
                        }}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Row 1 : Actions principales */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  type="button"
                  className={`btn btn-anissa-primary ${generating ? 'loading-pulse' : ''}`}
                  onClick={handleGenerate}
                  disabled={generating}
                  style={{ padding: '10px 18px', borderRadius: 10, fontSize: '.85rem', fontWeight: 600 }}
                >
                  {generating ? 'Generation...' : (hasPlan ? 'Regenerer' : 'Generer avec l\'IA')}
                </button>

                {/* V92.1 : bouton Templates supprime — feature non utilisee en pratique */}
                {planVersions.length > 0 && (
                  <button
                    type="button"
                    className="btn btn-anissa-secondary"
                    onClick={() => setShowVersions(true)}
                    style={{ padding: '10px 12px', borderRadius: 10, fontSize: '.78rem' }}
                    title="Historique des versions"
                  >
                    Versions ({planVersions.length})
                  </button>
                )}

                {/* Plus dropdown */}
                <div style={{ position: 'relative', display: 'inline-block' }} onMouseDown={e => e.stopPropagation()}>
                  <button
                    type="button"
                    className="btn btn-anissa-secondary"
                    onClick={() => setShowMoreMenu(m => !m)}
                    style={{ padding: '10px 14px', borderRadius: 10, fontSize: '.78rem' }}
                  >
                    Plus &#9662;
                  </button>
                  {showMoreMenu && (
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, zIndex: 50,
                      background: 'var(--bg-card)', border: '1px solid var(--border)',
                      borderRadius: 8, overflow: 'hidden', minWidth: 200, marginTop: 4,
                      boxShadow: '0 8px 24px rgba(0,0,0,.3)'
                    }}>
                      <button
                        onClick={() => { setShowMoreMenu(false); handleExpertMode(); }}
                        disabled={!planDraft?.trim() || expertMode === 'loading'}
                        style={{
                          display: 'block', width: '100%', textAlign: 'left',
                          padding: '10px 16px', background: 'none', border: 'none',
                          borderBottom: '1px solid rgba(255,255,255,.06)',
                          color: !planDraft?.trim() ? 'rgba(255,255,255,.2)' : '#8abf9a',
                          cursor: !planDraft?.trim() ? 'not-allowed' : 'pointer',
                          fontSize: '.85rem', fontWeight: 600,
                        }}
                        onMouseEnter={e => { if (planDraft?.trim()) e.currentTarget.style.background = 'rgba(106,191,138,.08)'; }}
                        onMouseLeave={e => e.currentTarget.style.background = 'none'}
                      >
                        {'\u2728'} Mode Expert {'\u2014'} Optimiser le plan
                      </button>
                      <button className="btn btn-anissa-secondary" style={{ width: '100%', textAlign: 'left', padding: '10px 14px', borderRadius: 0, border: 'none' }}
                        onClick={() => { setShowMedicalSummary(true); setShowMoreMenu(false); }}
                        disabled={!hasPlan}>
                        Resume medecin
                      </button>
                      {/* V50 : "PDF analyses" déplacé vers la section MGD (section Analyses recommandées) */}
                      {/* V50 : "Analyse IA complète" déplacé vers bloc dédié après l'éditeur */}

                      {/* V78 : Soft delete consultation (visible seulement si deja sauvegardee = id existant) */}
                      {initialConsultation?.id && (
                        <button
                          type="button"
                          onClick={() => { setShowMoreMenu(false); setShowDeleteConfirm(true); }}
                          style={{
                            display: 'block', width: '100%', textAlign: 'left',
                            padding: '10px 16px', background: 'none', border: 'none',
                            borderTop: '1px solid rgba(255,255,255,.06)',
                            color: '#d4806c', cursor: 'pointer',
                            fontSize: '.85rem', fontWeight: 500,
                            transition: 'background .15s',
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(212,92,76,.08)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'none'}
                        >
                          🗑 Supprimer la consultation
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Row 2 : Save actions */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', paddingTop: 2 }}>
                <button type="button" className="btn btn-secondary" onClick={onCancel} style={{ padding: '7px 14px', borderRadius: 10, fontSize: '.78rem' }}>Fermer</button>
                <button type="button" className="btn btn-primary" onClick={handleSave} style={{ padding: '7px 14px', borderRadius: 10, fontSize: '.78rem' }}>Sauvegarder</button>
                <span style={{
                  fontSize: '0.75rem',
                  color: autoSaveStatus === 'saved' ? '#22c55e'
                       : autoSaveStatus === 'saving' ? '#f59e0b'
                       : '#94a3b8',
                  marginLeft: '0.5rem',
                  transition: 'color 0.3s',
                }}>
                  {autoSaveStatus === 'saved' && '\u2713 Sauvegard\u00e9'}
                  {autoSaveStatus === 'saving' && '\u27f3 Auto-save...'}
                  {autoSaveStatus === 'unsaved' && '\u25cf Non sauvegard\u00e9'}
                </span>
              </div>

              {genError && <div className="error-msg" style={{ marginTop: 4 }}>{genError}</div>}
              {pdfError && <div className="error-msg" style={{ marginTop: 4, background: 'rgba(212,92,76,.08)', padding: '8px 12px', borderRadius: 8, fontSize: '.78rem' }}>{pdfError}</div>}
              {analysesError && <div className="error-msg" style={{ marginTop: 4, background: 'rgba(212,92,76,.08)', padding: '8px 12px', borderRadius: 8, fontSize: '.78rem' }}>{analysesError}</div>}
            </div>

            {/* Expert Mode — Loading */}
            {expertMode === 'loading' && (
              <div style={{
                margin:'8px 0', padding:'16px 18px',
                background:'rgba(26,46,31,.5)',
                border:'1px solid rgba(106,191,138,.2)',
                borderRadius:12,
                display:'flex', alignItems:'center', gap:12,
              }}>
                <span style={{ fontSize:'1.2rem', animation:'neSpin .8s linear infinite',
                  display:'inline-block' }}>{'\u2728'}</span>
                <div>
                  <div style={{ fontSize:'.85rem', fontWeight:600, color:'#8abf9a' }}>
                    Mode Expert {'\u2014'} Optimisation en cours...
                  </div>
                  <div style={{ fontSize:'.75rem', color:'rgba(255,255,255,.4)', marginTop:3 }}>
                    Section {currentOptimizingIdx + 1} / {sectionResults.length > 0
                      ? sectionResults.length : '...'}
                    {sectionResults[currentOptimizingIdx]?.title
                      ? ` \u2014 ${sectionResults[currentOptimizingIdx].title}` : ''}
                  </div>
                </div>
                <button
                  onClick={() => setExpertMode(false)}
                  style={{ marginLeft:'auto', background:'none', border:'none',
                    color:'rgba(255,255,255,.3)', cursor:'pointer', fontSize:'.8rem' }}>
                  Annuler
                </button>
              </div>
            )}

            {/* Expert Mode — Review */}
            {expertMode === 'review' && sectionResults.length > 0 && (
              <div style={{
                margin:'8px 0',
                background:'rgba(12,20,15,.8)',
                border:'1px solid rgba(106,191,138,.25)',
                borderRadius:12,
                overflow:'hidden',
                animation:'neSlideIn .2s ease',
                display:'flex',
                flexDirection:'column',
                maxHeight:'calc(100vh - 320px)',
              }}>
                <div style={{
                  padding:'14px 18px',
                  background:'rgba(26,46,31,.5)',
                  borderBottom:'1px solid rgba(106,191,138,.15)',
                  display:'flex', alignItems:'center', gap:10,
                }}>
                  <span style={{ fontSize:'.88rem', fontWeight:700, color:'#8abf9a', flex:1 }}>
                    {'\u2728'} Mode Expert {'\u2014'} {sectionResults.filter(r => !r.skip).length} sections optimis{'\u00e9'}es
                  </span>
                  <button onClick={() => setExpertMode(false)}
                    style={{ background:'none', border:'none', color:'rgba(255,255,255,.3)',
                      cursor:'pointer', fontSize:'.85rem' }}>
                    {'\u2715'} Fermer
                  </button>
                </div>

                <div style={{ flex:1, overflowY:'auto', minHeight:0, padding:'10px 0' }}>
                  {sectionResults.map((r) => {
                    if (r.skip) return null;
                    const accepted = acceptedSections[r.id] !== false;
                    return (
                      <div key={r.id} style={{
                        padding:'10px 18px',
                        borderBottom:'1px solid rgba(255,255,255,.04)',
                        background: accepted ? 'rgba(106,191,138,.04)' : 'rgba(255,255,255,.02)',
                      }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                          <button
                            onClick={() => setAcceptedSections(prev => ({
                              ...prev, [r.id]: !accepted
                            }))}
                            style={{
                              width:20, height:20, borderRadius:4, border:'none',
                              background: accepted ? 'rgba(106,191,138,.3)' : 'rgba(255,255,255,.08)',
                              color: accepted ? '#4ade80' : 'rgba(255,255,255,.3)',
                              cursor:'pointer', fontSize:'.75rem', display:'flex',
                              alignItems:'center', justifyContent:'center', flexShrink:0,
                              transition:'all .15s',
                            }}>
                            {accepted ? '\u2713' : '\u25cb'}
                          </button>
                          <span style={{ fontSize:'.78rem', fontWeight:700,
                            color: accepted ? '#8abf9a' : 'rgba(255,255,255,.35)',
                            textTransform:'uppercase', letterSpacing:'.3px', flex:1 }}>
                            {r.title}
                          </span>
                          {r.changes?.length > 0 && (
                            <span style={{ fontSize:'.68rem', color:'rgba(106,191,138,.5)',
                              background:'rgba(106,191,138,.08)', padding:'2px 7px',
                              borderRadius:10, whiteSpace:'nowrap' }}>
                              {r.changes.length} am{'\u00e9'}lioration{r.changes.length > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                        {r.changes?.length > 0 && accepted && (
                          <div style={{ marginLeft:28, marginBottom:6 }}>
                            {r.changes.map((c, ci) => (
                              <div key={ci} style={{ fontSize:'.74rem',
                                color:'rgba(106,191,138,.6)', marginBottom:2 }}>
                                + {c}
                              </div>
                            ))}
                          </div>
                        )}
                        {accepted && r.improved !== r.original && (
                          <div style={{
                            marginLeft:28, fontSize:'.75rem', color:'rgba(255,255,255,.3)',
                            whiteSpace:'pre-wrap', maxHeight:60, overflow:'hidden',
                            lineHeight:1.4,
                          }}>
                            {r.improved.slice(0, 120)}{r.improved.length > 120 ? '...' : ''}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div style={{
                  padding:'12px 18px',
                  borderTop:'1px solid rgba(106,191,138,.1)',
                  display:'flex', gap:10, alignItems:'center',
                  flexShrink:0,
                }}>
                  <button onClick={handleApplyExpertMode} style={{
                    padding:'8px 20px', borderRadius:8, border:'none',
                    background:'rgba(106,191,138,.2)', color:'#8abf9a',
                    cursor:'pointer', fontSize:'.83rem', fontWeight:700,
                    transition:'all .2s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background='rgba(106,191,138,.35)'}
                  onMouseLeave={e => e.currentTarget.style.background='rgba(106,191,138,.2)'}
                  >
                    {'\u2705'} Appliquer les sections coch{'\u00e9'}es
                  </button>
                  <span style={{ fontSize:'.75rem', color:'rgba(255,255,255,.25)' }}>
                    {Object.values(acceptedSections).filter(v => v === false).length} section(s) ignor{'\u00e9'}e(s)
                  </span>
                  <button onClick={() => setExpertMode(false)}
                    style={{ marginLeft:'auto', padding:'8px 16px', borderRadius:8,
                      border:'1px solid rgba(255,255,255,.08)', background:'none',
                      color:'rgba(255,255,255,.35)', cursor:'pointer', fontSize:'.8rem' }}>
                    {'\u274c'} Annuler tout
                  </button>
                </div>
              </div>
            )}

            {/* Global AI proposal panel */}
            {globalProposal && (
              <div style={{
                margin: '8px 0',
                padding: '14px 18px',
                background: 'rgba(26,58,42,.4)',
                border: '1px solid rgba(106,191,138,.25)',
                borderRadius: 12,
                animation: 'neSlideIn .2s ease',
              }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                  <span style={{ fontSize:'.72rem', fontWeight:700, color:'rgba(106,191,138,.7)',
                    textTransform:'uppercase', letterSpacing:'.4px' }}>
                    {'\u2728'} Proposition IA {'\u2014'} {globalProposal.instruction}
                  </span>
                  <span style={{ fontSize:'.7rem', color:'rgba(255,255,255,.3)', marginLeft:'auto' }}>
                    Pr{'\u00e9'}visualisation {'\u2014'} non appliqu{'\u00e9'}
                  </span>
                </div>
                <div style={{
                  background:'rgba(0,0,0,.25)', borderRadius:8, padding:'12px 14px',
                  fontSize:'.8rem', lineHeight:1.65, color:'#d4c9a8',
                  whiteSpace:'pre-wrap', maxHeight:200, overflowY:'auto',
                  border:'1px solid rgba(255,255,255,.06)',
                }}>
                  {globalProposal.text.slice(0, 600)}{globalProposal.text.length > 600 ? '...' : ''}
                </div>
                <div style={{ display:'flex', gap:8, marginTop:10 }}>
                  <button
                    onClick={() => {
                      reseedEditor(globalProposal.text, supplementsDraft, recipesDraft);
                      setGlobalProposal(null);
                      showSaveToast('Plan mis \u00e0 jour');
                    }}
                    style={{
                      padding:'6px 16px', borderRadius:8, border:'none',
                      background:'rgba(106,191,138,.2)', color:'#8abf9a',
                      cursor:'pointer', fontSize:'.8rem', fontWeight:600,
                    }}>
                    {'\u2705'} Appliquer au plan
                  </button>
                  <button
                    onClick={() => setGlobalProposal(null)}
                    style={{
                      padding:'6px 16px', borderRadius:8,
                      border:'1px solid rgba(255,255,255,.08)',
                      background:'none', color:'rgba(255,255,255,.35)',
                      cursor:'pointer', fontSize:'.8rem',
                    }}>
                    {'\u274c'} Ignorer
                  </button>
                </div>
              </div>
            )}

            {/* V50 : Modale aiAnalysis remplacee par un bloc inline juste apres l'editeur */}

            {/* V82 : Mini-TOC flottant — visible uniquement quand il y a un plan, et desktop ≥ 1200px.
                Scanne les sections rendues par NutritionEditor via data-section-* attributes. */}
            {hasPlan && editorTab === 'plan' && (
              <NutritionPlanTOC refreshKey={editorSeed} />
            )}

            {/* ─── V70 : SINGLE EDITOR (plus de split view) — apercu PDF a la demande via modal ─── */}
            <div className="nc-cockpit-single" style={{ display: 'flex', flexDirection: 'column', flex: 'none', overflow: 'visible', minHeight: 600, padding: '12px 16px 16px' }}>
              <section className="nc-panel nc-panel--editor">
                <header className="nc-panel__header" style={{ flexWrap: 'wrap', gap: 6 }}>
                  <span className="nc-panel__label">Editeur</span>
                  <Tab active={editorTab === 'plan'} onClick={() => setEditorTab('plan')}>Plan complet</Tab>
                  <Tab active={editorTab === 'frigo'} onClick={() => setEditorTab('frigo')}>Fiche frigo</Tab>
                  <Tab active={editorTab === 's1s4'} onClick={() => setEditorTab('s1s4')}>Plan S1-S4</Tab>
                  <Tab active={editorTab === 'supp'} onClick={() => setEditorTab('supp')}>Supplements</Tab>
                  {/* V94.48 : Lettre + Recettes deplacees dans 'App cliente' comme
                      sous-onglets, pour separer mindset 'peaufinage plan textuel'
                      et 'contenu app digital'. Onglets racines = plan textuel pur. */}
                  <Tab active={editorTab === 'app'} onClick={() => setEditorTab('app')}>📱 App cliente</Tab>
                  <span style={{ flex: 1 }} />
                  {/* V76 : Apercu PDF retire — l'editeur est deja un apercu premium.
                      Cover accessible directement via un bouton dedie. */}
                  {/* V88.5 → V94.50 : bouton 'Apercu JSON' supprime du header.
                      Le bouton 'Publier dans l'app' est maintenant dans
                      l'onglet App cliente (Vue d'ensemble) avec un nom clair
                      qui parle a Anissa. */}
                  {/* V83 : bouton Mode relecture — transforme toggle selon l'etat. */}
                  <button
                    type="button"
                    className="btn btn-anissa-secondary"
                    disabled={!hasPlan}
                    onClick={() => setIsReviewMode(m => !m)}
                    style={{
                      padding: '5px 12px', borderRadius: 8, fontSize: '.75rem',
                      opacity: hasPlan ? 1 : 0.4,
                      background: isReviewMode ? 'rgba(196,160,80,.22)' : undefined,
                      borderColor: isReviewMode ? 'rgba(196,160,80,.55)' : undefined,
                      color: isReviewMode ? '#e0cda0' : undefined,
                    }}
                    title={isReviewMode ? 'Revenir en mode édition' : 'Voir le plan en mode relecture (lecture seule, plein écran)'}
                  >
                    {isReviewMode ? '← Édition' : '👁 Relecture'}
                  </button>
                  {/* V92.2 : bouton Finaliser supprime — Anissa peaufine directement
                      dans Word apres export V92.0. Le code de la modal et des states
                      finalText/isFinal reste dormant pour rollback rapide si besoin. */}
                  {/* V92.1 : Preview PDF + Cover supprimes — Word V92.0 prime, plus de jsPDF specifique */}
                  {/* V92.0 : export Word — Anissa peaufine puis exporte PDF natif Word */}
                  <button
                    type="button"
                    className="btn btn-anissa-secondary"
                    disabled={!hasPlan}
                    onClick={async () => {
                      try {
                        // V92.2 : source = planDraft direct (Anissa peaufine dans Word, pas dans Finaliser)
                        const planSource = planDraft || consultation.nutrition_plan || '';
                        await exportPlanToWord(client, consultation, planSource);
                      } catch (e) {
                        // eslint-disable-next-line no-console
                        console.error('[exportPlanToWord]', e);
                        alert("Erreur lors de l'export Word : " + (e?.message || e));
                      }
                    }}
                    style={{ padding: '5px 12px', borderRadius: 8, fontSize: '.75rem', opacity: hasPlan ? 1 : 0.4 }}
                    title="Exporter en Word (.docx) — peaufine puis exporte PDF natif Word"
                  >
                    📄 Word
                  </button>
                  {/* V94.1 : bouton "Telecharger" PDF jsPDF supprime du header editeur.
                      Word V92+ est le path principal — Anissa peaufine dans Word puis
                      "Enregistrer sous PDF natif" en 1 clic. jsPDF reste utilise pour
                      Fiche Frigo (V92.8 modal), Pack client et Historique. */}
                </header>
                <div className="nc-panel__body">
                  {generating && (
                    <div className="loading" style={{ padding: '30px 20px' }}>
                      <div className="loading-spinner" />
                      <p>Claude analyse le profil et genere le plan nutrition...</p>
                    </div>
                  )}
                  {!generating && renderEditorTab()}
                </div>
              </section>
            </div>

            {/* V76 : Modale Apercu PDF retiree — l'editeur est deja un apercu premium fidele.
                Cover accessible directement via le bouton "🎨 Cover" du header editeur. */}

            {/* V53 : Audit IA maintenant integré dans PlanQualityScore (bloc unique en haut du cockpit) */}

            {/* Analyses preview (below split, full width) */}
            {showAnalysesPreview && (() => {
              const symp = detectSymptomsFromForm(form);
              const recs = getEnrichedMGDRecommendations(symp);
              return (
                <AnalysisPdfBody
                  recommendations={recs}
                  symptoms={symp}
                  clientName={clientName}
                  date={formatDate(today)}
                />
              );
            })()}

            {/* ─── Modales (remontees depuis l'editeur) ─── */}
            {showClientAppPreview && (() => {
              const { plan, supplements, recipes } = readEdited();
              const liveConsultation = {
                ...consultation,
                nutrition_plan: plan,
                supplements,
                recipes,
              };
              return (
                <ClientAppPreviewModal
                  client={client}
                  consultation={liveConsultation}
                  onClose={() => setShowClientAppPreview(false)}
                />
              );
            })()}

            {showFrigoModal && (() => {
              const { plan, supplements, recipes } = readEdited();
              return (
                <FicheFrigoPreview
                  consultation={{
                    nutritionPlan: plan,
                    supplements,
                    ficheFrigoJson: consultation.fiche_frigo_json || null,
                    date: today,
                  }}
                  sections={structurePlanSections(plan, supplements, { isFollowup, locale: getClientNutritionLocale(client) })}
                  client={client}
                  onClose={() => setShowFrigoModal(false)}
                />
              );
            })()}

            {showMedicalSummary && (() => {
              const { plan, supplements, recipes } = readEdited();
              return (
                <MedicalSummary
                  form={form}
                  consultation={{
                    plan, supplements, recipes,
                    bloodTestDone: consultation.blood_test_done,
                    dnaTestDone: consultation.dna_test_done,
                    nutritionPlan: plan,
                    nutritional_observations: consultation.nutritional_observations,
                    lab_results: consultation.lab_results,
                  }}
                  onClose={() => setShowMedicalSummary(false)}
                  // V94.22 : sauvegarde des edits dans la consultation pour persistance
                  savedData={consultation.medical_summary || null}
                  onSave={(data) => {
                    setConsultation(prev => ({
                      ...prev,
                      medical_summary: data,
                      medical_summary_updated_at: new Date().toISOString(),
                    }));
                    isDirtyRef.current = true;
                    setAutoSaveStatus('unsaved');
                    showSaveToast('Fiche médecin sauvegardée');
                  }}
                />
              );
            })()}

            {/* V92.1 : modale Cover supprimee — Word V92.0 gere sa propre cover */}

            {/* V78 : modale confirmation soft delete consultation */}
            {showDeleteConfirm && (
              <div
                onClick={() => setShowDeleteConfirm(false)}
                role="dialog"
                aria-modal="true"
                style={{
                  position: 'fixed', inset: 0, zIndex: 1000,
                  background: 'rgba(0,0,0,.65)', backdropFilter: 'blur(3px)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: 20,
                }}
              >
                <div
                  onClick={e => e.stopPropagation()}
                  style={{
                    width: '100%', maxWidth: 440,
                    background: '#1e241f',
                    border: '1px solid rgba(212,92,76,.3)',
                    borderRadius: 14,
                    boxShadow: '0 20px 60px rgba(0,0,0,.5)',
                    overflow: 'hidden',
                  }}
                >
                  <header style={{ padding: '18px 22px 14px', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
                    <h3 style={{ margin: 0, color: '#d4806c', fontSize: '1rem', fontWeight: 700 }}>
                      🗑 Supprimer cette consultation ?
                    </h3>
                  </header>
                  <div style={{ padding: '18px 22px', fontSize: '.85rem', color: '#d4c9a8', lineHeight: 1.55 }}>
                    Cette action est réversible mais la consultation ne sera plus visible.
                  </div>
                  <footer style={{
                    padding: '14px 22px 18px',
                    borderTop: '1px solid rgba(255,255,255,.06)',
                    display: 'flex', justifyContent: 'flex-end', gap: 8,
                  }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setShowDeleteConfirm(false)}
                      style={{ padding: '8px 16px', borderRadius: 10, fontSize: '.82rem' }}
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const consultationId = initialConsultation?.id;
                        if (!consultationId) {
                          showSaveToast('ID de consultation invalide');
                          setShowDeleteConfirm(false);
                          return;
                        }
                        const ok = softDeleteConsultation(consultationId);
                        setShowDeleteConfirm(false);
                        if (ok) {
                          showSaveToast('Consultation supprimée');
                          // Redirection immediate vers la liste
                          setTimeout(() => { onCancel?.(); }, 700);
                        } else {
                          showSaveToast('Suppression échouée');
                        }
                      }}
                      style={{
                        padding: '8px 16px', borderRadius: 10, fontSize: '.82rem',
                        border: '1px solid rgba(212,92,76,.5)',
                        background: 'rgba(212,92,76,.15)', color: '#d4806c',
                        cursor: 'pointer', fontWeight: 600,
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(212,92,76,.25)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'rgba(212,92,76,.15)'}
                    >
                      Supprimer
                    </button>
                  </footer>
                </div>
              </div>
            )}

            {/* V81 : modale de confirmation generique (regeneration / restore version / champs critiques) */}
            <ConfirmDialog state={confirmDialog.state} onClose={confirmDialog.close} />

            {saveToast && <div className="nc-save-toast">{saveToast}</div>}

            {/* V79 : banner undo apres insertion Copilot (fenetre de 20s) */}
            {lastInsertBackup && lastInsertBackup.expiresAt > Date.now() && (
              <div style={{
                position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
                zIndex: 900,
                background: 'rgba(26,46,31,.96)',
                border: '1px solid rgba(184,158,240,.35)',
                borderRadius: 10,
                padding: '10px 14px',
                display: 'flex', alignItems: 'center', gap: 12,
                boxShadow: '0 8px 28px rgba(0,0,0,.5)',
                fontSize: '.78rem',
                animation: 'fadeIn .2s ease',
              }}>
                <span style={{ color: '#c4aff2' }}>
                  ✨ Inséré dans <strong>{sectionLabel(lastInsertBackup.type)}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (!lastInsertBackup) return;
                    reseedEditor(
                      lastInsertBackup.prevPlan,
                      lastInsertBackup.prevSupplements,
                      lastInsertBackup.prevRecipes
                    );
                    // V79.3 : retirer la win du map → le bouton redevient "Inserer"
                    const undoneWin = lastInsertBackup.win;
                    if (undoneWin) {
                      setInsertedWinsMap(prev => {
                        const next = { ...prev };
                        delete next[undoneWin];
                        return next;
                      });
                    }
                    setLastInsertBackup(null);
                    showSaveToast('↩ Insertion annulée');
                  }}
                  style={{
                    padding: '4px 12px', borderRadius: 6,
                    border: '1px solid rgba(184,158,240,.45)',
                    background: 'rgba(184,158,240,.15)',
                    color: '#c4aff2', cursor: 'pointer',
                    fontSize: '.74rem', fontWeight: 600,
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(184,158,240,.25)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(184,158,240,.15)'}
                >
                  ↩ Annuler
                </button>
                <button
                  type="button"
                  onClick={() => setLastInsertBackup(null)}
                  title="Fermer"
                  style={{
                    background: 'none', border: 'none',
                    color: 'rgba(255,255,255,.4)', cursor: 'pointer',
                    fontSize: '1rem', padding: 0, lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </div>
            )}
          </div>
        );
      })()}


      {/* Step: Notes for Benoit + Private notes */}
      {currentStepType === 'notes' && (
        <div className="nutrition-form-section">
          <h3>Notes internes</h3>
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

      {/* Bottom nav retiree — actions remontees dans le cockpit header (step plan)
          et dans la barre d'etapes en haut (autres steps) */}
      {currentStepType !== 'plan' && (
        <div className="nav-buttons" style={{ justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn btn-secondary" onClick={onCancel}>Fermer</button>
          <button className="btn btn-primary" onClick={handleSave}>Sauvegarder la consultation</button>
          <span style={{
            fontSize: '0.75rem',
            color: autoSaveStatus === 'saved' ? '#22c55e'
                 : autoSaveStatus === 'saving' ? '#f59e0b'
                 : '#94a3b8',
            marginLeft: '0.5rem',
            transition: 'color 0.3s',
          }}>
            {autoSaveStatus === 'saved' && '\u2713 Sauvegard\u00e9'}
            {autoSaveStatus === 'saving' && '\u27f3 Auto-save...'}
            {autoSaveStatus === 'unsaved' && '\u25cf Non sauvegard\u00e9'}
          </span>
        </div>
      )}

      {/* V85.3 : FAB Sauvegarder flottant — visible sur l'etape plan quand il y a
          des modifications non sauvees. Evite de remonter en haut de page.
          V88.0.2 : masque en mode Finaliser (les boutons Enregistrer/Supprimer
          version finale sont deja presents en bas du textarea, evite le chevauchement). */}
      {currentStepType === 'plan' && autoSaveStatus === 'unsaved' && (
        <button
          type="button"
          onClick={handleSave}
          title="Sauvegarder maintenant (Ctrl+S)"
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 900,
            padding: '12px 18px',
            borderRadius: 999,
            background: 'linear-gradient(135deg, #c4a050, #a88740)',
            color: '#1a2e1f',
            border: 'none',
            fontSize: '.82rem',
            fontWeight: 700,
            letterSpacing: '.04em',
            cursor: 'pointer',
            boxShadow: '0 8px 24px rgba(196,160,80,.35), 0 2px 6px rgba(0,0,0,.25)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontFamily: 'inherit',
            transition: 'transform .15s, box-shadow .15s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 12px 28px rgba(196,160,80,.45), 0 4px 10px rgba(0,0,0,.3)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 8px 24px rgba(196,160,80,.35), 0 2px 6px rgba(0,0,0,.25)';
          }}
        >
          Sauvegarder
        </button>
      )}


      {/* V92.3 : modale Finaliser supprimee (~579 lignes) — Word V92.0 + Anissa peaufine dans Word */}
      {/* V92.1 : modale Preview PDF supprimee — Word V92.0 prime, plus de jsPDF specifique */}
    </div>
  );
}
