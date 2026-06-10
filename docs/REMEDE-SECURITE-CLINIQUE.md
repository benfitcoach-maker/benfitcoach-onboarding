# Remède sécurité clinique — prompt d'exécution

> **Document destiné à Claude Code (exécution).** Issu d'une review module par module
> du SaaS `benfitcoach-onboarding`. Pour la version lisible (Benoit / Anissa),
> voir `RAPPORT-REVIEW-SECURITE-CLINIQUE.md`.

---

## AVERTISSEMENT — à lire avant toute modification

**Chaque modification décrite ci-dessous touche la sécurité clinique de patientes
réelles.** Ce code génère des recommandations nutritionnelles et des compléments pour
des personnes qui les suivront. Une erreur ici n'est pas un bug d'affichage : c'est un
aliment allergène dans une assiette, ou un complément qui interagit avec un traitement.

En conséquence :

- **En cas de doute sur un remède, demander avant d'agir. Ne jamais deviner.**
- Ne pas élargir le périmètre d'un palier pour « faire propre » : un palier = un
  objectif, vérifié, déployé, validé humainement, puis le suivant.
- **Fail-closed sur le processus lui-même** : si un palier ne peut pas être prouvé
  vert (test + lint), on ne le déploie pas et on remonte le blocage. Une réparation
  non vérifiée est une promesse, pas une garantie.

---

## Grille de lecture — la taxonomie A / B / C

Toute la review se résume à une seule maladie sous trois angles : **la connaissance
existe quelque part dans le système, mais elle n'atteint pas le point de décision.**

- **Type B — « ne sait même pas ».** L'information n'entre pas dans le contexte. Le
  capteur est absent. *Un gate qui audite un plan généré sans cette information dira
  « dégagé » en toute bonne foi — un détecteur de fumée dans une pièce sans capteur.*
- **Type A — « sait mais ne bloque pas ».** L'information est détectée, affichée, mais
  laissée passer. Le gate est absent.
- **Type C — « sait mais ne le dit pas ».** L'information est connue du code mais n'est
  pas propagée à l'écran de décision — souvent en mentant positivement (« cliente vient
  de démarrer » alors que c'est une panne réseau).

**L'ordre de remède découle de la taxonomie et n'est PAS négociable :** on répare les
capteurs (B) AVANT les gates (A), car un gate sans capteur ment. Puis la propagation
(C). Puis la cosmétique.

---

## Le fil rouge (philosophie du remède)

> **Gate clinique par défaut, override conscient quand un humain est là, refus sûr quand
> il ne l'est pas, fail-closed sur la vérification elle-même.**

Une seule philosophie, déclinée à chaque porte.

---

## INVARIANT D'ARCHITECTURE — la règle de contrat (à appliquer partout)

> **Toute information de sécurité clinique** — allergènes, intolérances,
> médicaments / interactions, contre-indications pathologiques, grossesse / allaitement,
> restrictions éthiques ou religieuses — **DOIT vivre dans le contexte clinique partagé**
> (`buildClinicalContext` → bloc system), donc être héritée mécaniquement par TOUT chemin
> de génération (manuel, auto, recettes, et tout futur point d'entrée).
>
> **Le message user ne porte QUE le spécifique-à-l'appel** : la consigne de tâche, les
> directives ponctuelles d'Anissa, le focus de la phase.
>
> **Une donnée de sécurité ne doit jamais dépendre du canal choisi par l'appelant** —
> sinon ajouter un point d'entrée = créer un trou de sécurité silencieux. C'est
> exactement la cause racine du chemin auto aveugle aux allergènes aujourd'hui.

Ce n'est pas un patch, c'est la règle qui empêche la classe de bug de se rejouer. Tout
remède P0 doit la respecter : on porte la sécurité dans le canal partagé, pas dans un
canal user dupliqué.

---

## INVARIANT ANTI-SUR-BLOCAGE — à répéter à chaque gate

> **Un garde-fou qui se déclenche trop souvent est un garde-fou mort.** Le sur-blocage
> tue la protection aussi sûrement que le sous-blocage, juste plus lentement : il entraîne
> l'humain à ignorer l'alerte. Si Anissa voit l'alerte crier tout le temps, elle l'éteint
> — et on aura dégradé la sécurité en croyant l'augmenter.

Décliné :

- **Labo** : valider l'**implausible**, jamais l'**anormal**. Bornes physiologiques
  larges (≈ 10× au-delà du normal / plafonds biologiquement impossibles), pas les bornes
  de référence. Une ferritine à 8 est anormale-mais-réelle (Anissa DOIT la voir) ; à 8000
  c'est une faute de frappe.
- **Guardrails** : gate dur **uniquement** sur sévérité haute (allergènes, interactions,
  contre-indications pathologiques). Avertissement non bloquant pour le reste (préférences,
  vocabulaire).
- **Échantillon** : transparence, pas verrouillage. On affiche « suggéré sur la base de
  2 ressentis cette semaine », on ne remonte pas le seuil. Anissa décide en voyant sur
  quoi elle décide.

**Granularité de sévérité — à fixer une fois, pour que chaque capteur P0 ait son gate P1 :**

- Allergènes déclarés + interactions médicament↔complément = **sévérité haute → gate dur**.
- Intolérances / aliments évités déclarés (`form.alimentsEvites`) = **avertissement non
  bloquant** (préférence/confort, pas danger vital), sauf mention contraire d'Anissa.
- **Règle de complétude :** toute donnée portée dans le contexte en P0 DOIT recevoir l'une
  de ces deux classes en P1. Un capteur sans classe de gate est un bug de processus (capteur
  posé, gate manquant) ; un gate dur sur du non-grave est un sur-blocage. Les deux sont
  interdits.

---

## DISCIPLINE DE DÉPLOIEMENT

Ce lot touche le cœur clinique. Il ne se déploie pas d'un bloc.

1. **Un palier = un commit** (ou un petit groupe cohérent), jamais le lot entier.
2. **Suite de tests complète VERTE + lint propre à chaque palier.** Pas de palier suivant
   tant que le précédent n'est pas vert.
3. **MUR APRÈS P0.** Tu livres les quatre capteurs P0, tu lances la suite de tests
   complète, tu t'**arrêtes net**. Tu ne commences **AUCUN** travail P1 — pas une ligne,
   pas un fichier — **dans la même session**, tant qu'un humain n'a pas explicitement validé
   P0. Ce n'est pas un jalon recommandé : c'est une barrière. Si tu te demandes si tu peux
   enchaîner P1, la réponse est non. On ne construit pas de gate sur un capteur non validé.
4. Chaque constat ci-dessous porte un champ **« Vérifier »** : le test qui prouve que la
   réparation marche. Aucun palier n'est « fait » sans son test vert.

---

# P0 — LES CAPTEURS (type B) — à faire et valider AVANT tout gate

> Tant que ces capteurs ne sont pas en place, **tous** les gates qu'on construira en P1
> mentiront : ils audineront des plans générés sans l'information de sécurité.

> **⚠️ CORRECTION DU 2026-06-10 — diagnostic initial faux sur l'architecture.** En vérifiant
> la prémisse contre le code réel (mur P0), on a constaté que **`buildClinicalContext`
> n'est PAS un contexte partagé universel**. Il existe **trois constructions de prompt
> divergentes** et **une seule** consomme `buildClinicalContext` :
> 1. **Composer** (`composeSystemPromptFr`) — consomme `clinicalContext` (chemin auto + JPE
>    composer). ✅ seul chemin conforme.
> 2. **Classique** (`buildSystemPromptFr`, `fr.js:870`) — défaut pour les clientes créées
>    avant 2026-05-12. **Ne reçoit aucun `clinicalContext`** ; ne lit du form que
>    `pretProtocole`. Les allergènes n'y arrivent QUE via `buildMinimalUserMessage:1366` ;
>    les traitements **nulle part**.
> 3. **Legacy** `NutritionConsultation.jsx` — appelle `buildSystemPromptFrV2` **sans**
>    `clinicalContext` (`:104`) ; sécurité bricolée dans ses propres user messages.
>
> L'invariant « contexte partagé hérité par chaque chemin » **n'a jamais existé** dans
> l'archi. Conséquence : appliquer P0.2 à la lettre (retirer `:1366`) **supprimerait le
> seul canal d'allergènes du chemin par défaut** — une régression de sécurité. P0 est donc
> reformulé en **additif strict, fail-closed** :
> - Porter le bloc sécurité (allergènes + intolérances + traitements/médicaments) dans une
>   **source unique** (`buildSafetyBlockFr`, dérivé de `form`).
> - Le **câbler sur les trois chemins** : composer + classique `buildSystemPromptFr` +
>   legacy. Oui, ça touche la signature de `buildSystemPromptFr` et le chemin 3 que ce
>   document n'avait pas nommé — parce que le diagnostic s'était trompé sur l'archi, **pas**
>   par scope creep. Fermer la cécité aux médicaments sur le chemin par défaut EST le
>   périmètre de P0 (constat n°1).
> - **Ne retirer AUCUN canal user-message existant.** La redondance transitoire sur de la
>   sécurité est une vertu, pas une dette. Le retrait des doublons est **P1**, fait
>   seulement une fois le nouveau canal prouvé sur les trois chemins.
> - Discipline conservée : un seul commit cohérent (bloc partagé + câblage triple = une
>   seule idée), zéro retrait, zéro déploiement (le mur tient).

> **NOTE D'EXÉCUTION — P0.1 et P0.2 sont UNE seule tâche, un seul commit, un seul bloc de
> code.** Le remède commun est l'ajout d'**un seul** bloc « Sécurité — traitements,
> allergènes, intolérances », rendu par une source unique (`buildSafetyBlockFr`) et câblé
> sur les **trois** builders (cf. correction ci-dessus). Porter médicaments ET allergènes en
> deux endroits de code distincts recréerait **exactement la divergence de canaux qu'on
> soigne**. Deux cas de **validation** (médicament + allergène), un seul morceau de code, un
> seul commit.

### P0.1 — Médicaments / traitements absents de la génération de plan *(constat n°1 du lot)*

**Type B. Gravité maximale.** `form.traitements` / `form.medicaments` sont affichés dans
le cockpit et envoyés au médecin (`aiMedicalSummary.js:368`) mais n'entrent dans **aucun**
canal de la génération de plan — ni system partagé, ni user manuel
(`buildMinimalUserMessage` `JourneyPlanEditor.jsx:1354-1413` ne les pousse pas), ni auto
(`autoGeneratePlanForPhaseTransition.js:83`). L'IA peut donc recommander un complément
interagissant avec un traitement en cours (millepertuis ↔ antidépresseurs, vitamine K ↔
anticoagulants, pamplemousse ↔ statines) **sans jamais voir le traitement, génération
manuelle comprise**. Chez une nutritionniste dont les clientes prennent volontiers des
compléments, c'est le quotidien, pas un cas tordu.

**Remède** : porter `form.traitements` / `form.medicaments` dans `buildClinicalContext`
(`buildClinicalContext.js`) → rendu dans `buildClinicalContextBlockFr`
(`_clinicalContext.fr.js`), dans une section « Sécurité — traitements en cours » du system
prompt, héritée par les deux chemins. Respecter l'invariant de contrat : canal partagé,
pas user. Ne PAS recopier dans le user message.

**Vérifier** : cas de test avec une cliente portant un traitement connu (ex.
`form.traitements = "Sintrom (anticoagulant)"`) → assert que la chaîne de traitement
apparaît dans le contexte clinique transmis à l'IA, **dans les deux chemins** (manuel
`JourneyPlanEditor` et auto `autoGeneratePlanForPhaseTransition`). Test rouge avant
remède, vert après.

### P0.2 — Allergènes / intolérances absents du chemin auto

**Type B.** `form.allergies` transite uniquement par le user message manuel
(`JourneyPlanEditor.jsx:1366`), **non partagé**. Le chemin auto a un user message codé en
dur (`autoGeneratePlanForPhaseTransition.js:83`) qui ne porte rien, et le contexte partagé
ne porte pas les allergènes (`_clinicalContext.fr.js` → 0 occurrence d'`allergies`). Le
plan auto est donc généré aveugle aux allergènes. Le manuel est **fragile** : le jour où
quelqu'un touche `buildMinimalUserMessage`, le seul canal portant les allergènes saute
sans signal.

**Remède** : **même bloc que P0.1, ajouté dans le même commit** (ne pas créer un second
site de portage) — porter `form.allergies` + `form.alimentsEvites` (intolérances) dans
`buildClinicalContext` / bloc clinique partagé. Retirer leur dépendance au user message.
Source unique.

**Vérifier** : cliente avec `form.allergies = "arachide"` → assert présence d'« arachide »
dans le contexte transmis à l'IA pour **les deux chemins**. Test croisé manuel + auto.

### P0.3 — Détection de troncature IA *(le constat qui unifie tout)*

**Type B produisant un type C.** Aucune détection de réponse tronquée nulle part.
`stop_reason` n'est lu à aucun endroit (`grep stop_reason` → 0 dans `src`) ; les seules
occurrences de `max_tokens` / `truncat` sont la config de requête (`anthropic.js:131`) et un
troncateur d'affichage de notes sans rapport (`Dashboard.jsx:242`). `callClaude` lit
`data.content[0].text` (`anthropic.js:164`) sans inspecter `data.stop_reason`. Un plan
coupé à `stop_reason: 'max_tokens'` est rendu comme un plan entier — affiché tel quel en
manuel (`JourneyPlanEditor.jsx:831`) et **stocké comme brouillon valide** en auto
(`autoGeneratePlanForPhaseTransition.js:91` ne teste que le vide). Or la coupure tombe
souvent en fin de plan — précisément là où arrivent les évictions allergènes et les
précautions médicamenteuses. **Un plan tronqué est un plan dont la partie sécurité est la
plus susceptible d'avoir disparu.**

**Remède** : dans `callClaude` (`anthropic.js`), inspecter `data.stop_reason`. Si
`=== 'max_tokens'` (ou réponse manifestement coupée), **lever une erreur honnête** (ou
retourner un flag de troncature explicite que les appelants doivent traiter), jamais
retourner le texte coupé comme un succès. Les appelants de plan (`JourneyPlanEditor:831`,
`autoGeneratePlanForPhaseTransition:91`) doivent afficher / journaliser « génération
tronquée, recommencer » et **refuser d'afficher ou de stocker** le brouillon coupé.
Fail-closed.

**Vérifier** : forcer `max_tokens` bas sur un appel de génération de plan → assert qu'un
avertissement de troncature est levé et qu'**aucun** plan coupé n'est affiché (manuel) ni
écrit dans `plan_drafts_pending_review` (auto). Test de troncature simulée.

### P0.4 — Unifier `safeParseJson` (contrats opposés sous le même nom)

**Type C / piège.** Deux fonctions homonymes : socle `anthropic.js:56` renvoie `null` en
silence (fail-open) ; médical `aiMedicalSummary.js:437` throw (fail-closed). Le générateur
de recettes hérite du fail-open et crashe avec un message technique opaque
(`aiRecipeGenerator` `callIaForBatch:161-163`, `parsed.recipes` sur `null`).

**Remède** : un seul `safeParseJson` au contrat **fail-closed** (throw avec message clair
« réponse IA invalide / incomplète »), réutilisé partout. Supprimer le doublon fail-open.
Les appelants catchent et affichent une erreur honnête.

**Vérifier** : feeder un JSON tronqué au générateur de recettes → assert message d'erreur
honnête (« génération incomplète »), pas un `TypeError` opaque ni un résultat partiel.

> ⛔ **MUR P0 — STOP. Tu t'arrêtes ici.** Tu ne génères aucun code P1 dans cette session.
> Tu rends la main pour validation humaine de P0. Reprise de P1 uniquement après accord
> humain explicite.

---

# P1 — LES GATES CLINIQUES + FAIL-CLOSED (type A)

> Maintenant que les capteurs portent l'information de sécurité, les gates peuvent
> l'auditer pour de vrai.

### P1.1 — Anamnèse vide → génération à l'aveugle

**Type A. Priorité clinique forte.** Quand le pré-questionnaire est sauté (`form = {}`),
`analyzeAnamnese` (`anamneseAnalyzer.js:526`) renvoie des structures vides (redFlags vides,
pathologies toutes inactives) et `buildUserMessage` (`aiMedicalSummary.js:344-420`) injecte
du vide / des « ? » dans le prompt — sans aucun avertissement. Le bouton « ✨ Générer avec
IA » (`MedicalSummary.jsx:499-514`, `handleAIGenerate:407`) est toujours cliquable. C'est
un mensonge d'interface : un résumé médical d'apparence sérieuse bâti sur rien.

**Remède** : **blocage par défaut avec porte de sortie explicite consciente** — pas un
`confirm()` doux.
- Source unique de vérité `isAnamneseFilled(form)`, utilisée partout où la complétude est
  jugée (remplace les détections divergentes legacy vs V97.8.1).
- Si non remplie : bannière rouge + bouton « Générer » désactivé + case à cocher « Je
  génère quand même volontairement » qui seule réarme le bouton (override conscient,
  humain présent).

**Vérifier** : cliente `form = {}` → assert bouton désactivé et bannière présente ; cocher
la case → bouton réarmé. Cliente anamnèse remplie → bouton actif d'emblée.

### P1.2 — Guardrails détectés mais non bloquants à la sortie

**Type A.** `auditPlanForGuardrails` (`_clinicalGuardrails.fr.js:548`) détecte les
violations mais retourne `{profile_key, phrase, snippet}` **sans sévérité** ; la table
`clinical_guardrails` (migration V97.18) n'a **pas de colonne severity**. Le bloc guardrails
n'est qu'injecté en SOFT dans le prompt (`composer.fr.js:84-92`). Et le plan sort par
**quatre portes** dont une seule est même conseillée : « Adopter » (`JourneyPlanEditor`,
bouton `:1011` jamais désactivé), export Word (`:252-322`), export PDF Fiche Frigo
(`FicheFrigoPreview.jsx:173`), publication app cliente. La bannière d'audit
(`GuardrailsAuditBanner.jsx`) est cosmétique (« régénération recommandée » = conseil).

**Remède** :
1. Ajouter une **sévérité** aux violations de guardrails (colonne `severity` sur
   `clinical_guardrails` + propagée par `auditPlanForGuardrails`), alignée sur le modèle
   des red flags qui ont déjà `severity: 'critical'|'high'` (`anamneseAnalyzer.js:475+`).
2. **Clairance unique** `assertPlanClinicallyCleared(planText, clinicalContext)` consultée
   par les **quatre** portes — le gate vit dans la clairance, pas sur un bouton (sinon
   trois backdoors le contournent).
3. **Gate dur uniquement sur sévérité haute** (cf. invariant anti-sur-blocage) — override
   conscient possible aux portes manuelles. Avertissement non bloquant pour le reste.
4. **Fail-closed sur la clairance** : audit qui ne tourne pas = pas de clairance = traité
   comme violation bloquante, jamais feu vert. *(C'est le réflexe inverse de celui d'un dev
   par défaut — l'écrire explicitement.)*

**Vérifier** : plan contenant un aliment contre-indiqué sévérité haute → assert que les
QUATRE portes le bloquent (override conscient requis). Plan recommandant un complément
interagissant avec un traitement présent dans le contexte (ex. millepertuis alors que
`form.traitements` contient un antidépresseur) → assert blocage sévérité haute aux quatre
portes. Intolérance déclarée (`form.alimentsEvites`) enfreinte → **avertissement non
bloquant**, pas blocage. Plan propre → les quatre passent. Simuler un audit qui throw →
assert blocage (fail-closed), pas passage.

### P1.3 — Porte automatique (transition de phase) : clic humain aveugle

**Type A / C.** La génération auto crée un brouillon `plan_drafts_pending_review`
status:'pending' (`autoGeneratePlanForPhaseTransition.js:94-110`) — rien ne part seul, il y
a un clic humain obligatoire (`PendingDraftsPanel handleAccept/handleAcceptAndPublish`).
Mais ce clic est **aveugle** : aucun audit clinique affiché, `auditPlanForGuardrails` jamais
appelé dans ce chemin (metadata `guardrails_applied:107` = injectés, pas respectés). Anissa
valide sur texte brut.

**Remède** :
1. Lancer l'audit (`assertPlanClinicallyCleared`) **immédiatement après génération** dans
   `autoGeneratePlanForPhaseTransition.js` et stocker verdict + sévérité dans le brouillon.
2. `PendingDraftsPanel` **affiche le verdict** et **bloque `handleAcceptAndPublish` sur
   sévérité haute** (override conscient, Anissa est là).
3. **Refuse-and-notify en seconde barrière** : si jamais un brouillon high parvenait à la
   publication sans passage panel (régression future), refus + notification revue clinique.
   *Défense en profondeur — on ne s'appuie pas sur le clic humain comme barrière unique.*

**Vérifier** : transition de phase générant un brouillon avec violation high → assert
verdict stocké, affiché dans le panel, et publication bloquée jusqu'à override. Brouillon
propre → acceptable normalement.

### P1.4 — Saisie labo : valeurs implausibles non validées

**Type A.** L'input des biomarqueurs est `type="text"` sans validation
(`ClientJourneyPage.jsx:2501-2507`) ; `updateTestMarker` (`:1923-1949`) stocke brut. Le
catalogue a pourtant des `ref_range` (`markers.js` : glycémie `:228 {3.9,5.5}`, ferritine
`:56 {15,150}`, TSH `:110 {0.4,4.0}`) utilisés en affichage seul, jamais en validation.
Une glycémie tapée 1000 part telle quelle dans le contexte IA.

**Remède** : `validateMarkerValue(markerId, value)` qui compare à des **bornes
physiologiques larges** (≈ 10× au-delà du normal / plafonds biologiquement impossibles),
**PAS** aux `ref_range` normales (cf. invariant : implausible, pas anormal). Sur
implausible → avertissement doux non bloquant invitant à vérifier la saisie. Anissa garde
la main (elle peut confirmer une vraie valeur extrême).

**Vérifier** : ferritine = 8 → aucun avertissement (anormal mais réel) ; ferritine = 8000 →
avertissement de saisie. Glycémie 1000 → avertissement.

---

# P2 — PROPAGATION (type C) — « sait mais ne le dit pas »

### P2.1 — `syncError` enfermé dans un badge → 6 signaux mentent positivement

**Type C, le plus large.** La panne réseau est correctement détectée (`syncError=true`,
`ClientJourneyPage.jsx:4018-4020`, distingue `list.ok===false` d'un vide réussi) mais le
catch écrit `feedbacks=[]` / `weightEntries=[]` (`:4040-4045`) et le flag n'est affiché que
dans un badge du hero (`:4392-4420`). Les composants de signal reçoivent les tableaux vidés,
jamais le flag → affirmations cliniques fausses : « Aucun ressenti reçu sur 14 jours —
cliente vient de démarrer » (`:4688`), « En attente des premières pesées » (`:5193`). Pire :
`ClinicalAlertBanner` rend `null` en cas de panne (`ClinicalAlertBanner.jsx:119`) — **une
alerte préoccupante s'évapore en silence.** C'est le pire cas de propagation, parce que
c'est une information préoccupante qui disparaît, pas une neutre.

**Remède** : propager `syncError` à tous les composants de signal (heroSignal ressenti,
action prioritaire, Bloc 4 ressentis, `ClinicalAlertBanner`, `FeedbacksTrendChart`,
`WeightTrackingSection`). En cas de panne, afficher un état « données indisponibles —
synchro échouée » **distinct** de l'absence réelle de donnée. Ne jamais afficher d'assertion
factuelle sur la cliente (« vient de démarrer », « en attente ») quand la cause est
technique. `ClinicalAlertBanner` ne doit pas rendre `null` silencieusement sur panne — il
doit signaler qu'il n'a pas pu évaluer.

**Vérifier** : simuler un fetch en échec → assert que chaque signal affiche un état panne
distinct, et qu'aucune phrase « cliente vient de démarrer / en attente » n'apparaît.

### P2.2 — Brouillon auto tronqué présenté comme entier

Couvert par P0.3 (détection troncature) + P1.3 (audit au panel). **Vérifier** ici que le
panel n'affiche jamais un brouillon marqué tronqué comme acceptable.

### P2.3 — Tendances affichées sans leur profondeur d'échantillon

**Type C.** Flèches de tendance sur 2 points sans le dire : `FeedbacksTrendChart`
(`:98-102`, flèche = 2 derniers points), `ClientPulseSummary` (`:55-60`, latest vs
previous). Surtout, la **suggestion de transition de phase** se déclenche dès 2 ressentis
positifs sur 7 jours (`SuiviCockpitTimeline.jsx:28-39`, `ClinicalAlertBanner.jsx:104-108`) —
une recommandation d'**avancer le protocole** poussée sur échantillon minimal, sans signaler
la base.

**Remède (transparence, PAS verrouillage — cf. invariant)** : ne PAS remonter le seuil.
Rendre la base visible : « suggéré sur la base de 2 ressentis cette semaine » plutôt que
« suggéré ». Idem afficher le nombre de points sous chaque flèche de tendance. Anissa décide
en voyant sur quoi elle décide.

**Vérifier** : suggestion de transition sur 2 ressentis → assert que le texte affiche « sur
la base de 2 ressentis ». Tendance sur 3 points → profondeur visible.

---

# P3 — COSMÉTIQUE CLINIQUE (à traiter sans pitié, petit périmètre)

### P3.1 — Faux « +18% Énergie » codé en dur

**Type C.** Valeur statique inventée dans le mockup téléphone (`ClientJourneyPage.jsx:3540`,
chiffre `+18%` sous le label « Énergie · 7 jours », mockup tagué « Jour 1 · semaine 1 »
l.3532). Un chiffre clinique inventé dans un
outil de santé, même décoratif, qu'un acheteur attentif ou une cliente méfiante prendrait
pour un vrai résultat. **Zéro chiffre inventé dans un outil de santé, même en décoration.**

**Remède** : supprimer le chiffre ou le marquer sans ambiguïté comme illustratif
(« exemple »).

**Vérifier** : grep du cockpit → aucun pourcentage clinique codé en dur non marqué
« exemple ».

### P3.2 — Titre légal non appliqué aux sorties PDF

**Type A/C.** Le sanitizer de conformité est centralisé (`complianceVocabulary.js` via
`callClaude` `anthropic.js:30,105-107`) et le titre légal validé est « Praticienne en
nutrition » (`practitionerProfile.js:43`). Mais les PDF cliente affichent « Nutritionniste …
longévité & biomarqueurs » (`nutritionPdf.js:3266`) et le vocabulaire d'identité
« longévité / nutrigénétique » est réimplémenté hors sanitizer dans ≥ 6 sites
(`identity.fr.js:7`, `aiClient.js:400,485`, `coachIdentity.js:28`, `formSteps.js:88`).

**Remède** : faire consommer `practitionerProfile` + le vocabulaire centralisé par les
sorties PDF et les fichiers d'identité, de sorte qu'un changement de titre/terme se propage
partout. Source unique.

**Vérifier** : changer le titre dans `practitionerProfile.js` → assert qu'il se reflète dans
le PDF généré. Grep « longévité / nutritionniste » hors sources centralisées → 0.

---

## RÉCAPITULATIF DES PALIERS

| Palier | Contenu | Type | Dépendance |
| --- | --- | --- | --- |
| **P0** | Capteurs : médicaments + allergènes dans contexte partagé, détection troncature, unif. parse JSON | B | aucune — **fait en premier ; MUR : stop net, zéro P1 même session avant validation humaine explicite** |
| **P1** | Gates : anamnèse vide, clairance guardrails sévérité, porte auto, validation labo | A | exige P0 (sinon gates aveugles) |
| **P2** | Propagation : syncError → signaux, transparence d'échantillon | C | exige P1 |
| **P3** | Cosmétique : faux +18%, titre PDF | A/C | indépendant, en dernier |

**Règle de progression** : un palier par commit, suite verte + lint à chaque palier, **mur
infranchissable après P0** — stop net, aucun travail P1 entamé tant qu'un humain n'a pas
validé P0 explicitement. En cas de doute sur un remède : demander.
