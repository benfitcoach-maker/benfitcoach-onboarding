# Validation clinique — Socle V1

**Date :** 2026-06-10
**Autorité clinique :** Anissa Deroubaix (nutritionniste)
**Rôle Benoit / IA :** mise en œuvre technique. Aucune décision clinique n'est
prise par le développeur ou l'IA. Les classifications, seuils et plafonds de ce
document sont les décisions d'Anissa ; le code ne fait que les appliquer.

Ce document est la **source de vérité** de ce qui est figé en V1 et de ce qui
reste en attente. Toute ligne « validé Anissa » dans le code renvoie ici.

---

## Liste 1 — Classification des interactions complément ↔ traitement

**Statut : FIGÉE (validée Anissa le 2026-06-10).**
Fichier : `src/services/clinicalInteractions.js`.

Principe : une substance peut être **bloquante** (contre-indication, blocage à
l'export/publication avec override conscient), **avertissement** (advisory,
mention non bloquante), ou **conditionnelle** (avertissement en population
générale, bloquante uniquement si un traitement précis est actif).

### Bloquant (inconditionnel)

| Substance | Classification | Raison |
|---|---|---|
| Millepertuis | BLOQUANT | Inducteur enzymatique (CYP3A4/P-gp) — réduit l'efficacité de nombreux traitements. |
| Pamplemousse | BLOQUANT | Inhibe le CYP3A4 — surdosage des statines. |
| Vitamine K2 **forte dose** | BLOQUANT | Antagonise les AVK. |

### Conditionnel (avertissement → bloquant si traitement actif)

| Substance | Par défaut | Devient bloquant si | Raison |
|---|---|---|---|
| Oméga-3 **forte dose** (>3 g/j) | AVERTISSEMENT | AVK ou AOD actif | Risque hémorragique majoré sous anticoagulant à dose élevée. |
| Berbérine | AVERTISSEMENT | Insuline ou metformine active | Potentialise l'hypoglycémie sous antidiabétique. |

> Détection des traitements actifs : `anamneseAnalyzer.detectTreatments(form)`
> (clés `avk`, `doac`, `insuline`, `metformine`). La conditionnalité est portée
> par une **donnée déclarative** (liste de clés de traitement), pas par du code
> de décision.

> **Note de portée (validée Anissa le 2026-06-10) :** Décision partiellement
> implémentée en V1 : la sécurité critique est active via blocage conditionnel
> chez les clientes sous traitement à risque. L'avertissement population
> générale sans traitement déclencheur n'est pas implémenté dans le chemin
> *treatment-driven* actuel et est reporté en V2/D2. Report accepté pour la V1
> par Anissa.
>
> En clair :
> - **Blocage conditionnel ACTIF** quand le traitement à risque est détecté
>   (AVK/AOD pour l'oméga-3, insuline/antidiabétique pour la berbérine).
> - **Avertissement population générale** (sans traitement détecté) **NON actif
>   en V1**.
> - Reporté au **backlog V2** via le scan population-générale / D2.
> - **Report accepté pour la V1.**

### Avertissement (inconditionnel)

| Substance | Raison |
|---|---|
| Vitamine K2 **dose normale** | Mention, pas contre-indication (la forte dose seule bloque). |
| Chrome | Avertissement uniquement — **pas** d'escalade bloquante sous insuline. |
| Calcium | Espacement d'absorption, pas une contre-indication. |
| Fer | Espacement d'absorption, pas une contre-indication. |
| Soja | Espacement d'absorption (lévothyrox), pas une contre-indication. |
| Vitamine B12 | Surveillance biologique, pas une contre-indication. |
| IPP / AINS / Tramadol | Médicaments — non recommandés par un plan nutrition. |
| Vinaigre (de cidre) | Aliment courant. |
| Hydratation | Consigne générale, pas une substance. |

### Fail-closed

Toute substance **non listée** retombe en `needs_review` (signalée pour revue),
jamais en advisory silencieux. Dans le doute, on sur-signale.

---

## Liste 2 — Plafonds de plausibilité des biomarqueurs

**Statut : 16 plafonds sanguins FIGÉS (validé Anissa le 2026-06-11, unités SI).
HbA1c basculée en mmol/mol (IFCC) et FIGÉE — cf. §2 ci-dessous.**
Fichier : `src/services/clinical/catalog/markers.js` (`MARKER_PLAUSIBLE_MAX`).

Les 15 plafonds validés tels qu'ils figurent dans le fichier : crp_us 1000,
ferritine 5000, fibrinogene 50, homocysteine 500, cortisol_matin 5000, tsh 300,
t3_libre 100, t4_libre 200, insuline 2000, vit_d_25oh 1000, vit_b12 20000,
transferrine_saturation 150, omega_3_index 100, glycemie_jeun 100,
calprotectine 100000. À ne pas modifier sans nouvelle validation clinique.

Nature : ce sont des **garde-fous anti-faute-de-saisie** (plafond de
plausibilité), **pas** des seuils diagnostiques. Aucune interprétation, aucune
correction automatique : la donnée absente n'est jamais interprétée.

**Ce qui est validé :** les **unités** sont conformes aux laboratoires suisses
(unités SI : glycémie et cholestérol en mmol/L, ferritine en µg/L, B12 en pmol/L,
vitamine D en nmol/L, créatinine en µmol/L, TSH en mU/L).

**Source unique = Ortho-Analytic (sang), en unités SI.** MGD ne rend pas de
biomarqueurs sanguins dans le périmètre actuel (MGD = volet génétique). Il n'y a
donc **pas de seconde source** de biomarqueurs sanguins → pas de risque de
mélange d'unités, pas de double support, pas de sélecteur.

**Ce qui reste en attente d'Anissa (ne pas figer) :**
1. Relecture des **16 plafonds** sur les valeurs réelles du fichier (le tableau
   de référence antérieur était périmé/incomplet — il ne correspondait pas aux
   chiffres du fichier et omettait fibrinogène, homocystéine, cortisol, insuline,
   calprotectine). La validation portait sur ce tableau périmé, pas sur le
   fichier réel.

**Ce qui est FIGÉ (validé Anissa le 2026-06-11) :**
2. **HbA1c — basculée % (DCCT) → mmol/mol (IFCC), source Ortho-Analytic.**
   Unité unique, pas de double support. Bornes validées par Anissa, alignées ADA :
   - **Normale : 20–38 mmol/mol** (< 39 ; ≈ 4,0–5,6 %)
   - **Prédiabète : 39–47 mmol/mol** (≈ 5,7–6,45 %)
   - **Diabète : ≥ 48 mmol/mol** (≈ ≥ 6,5 % = seuil ADA)
   - **Plafond de plausibilité : 200 mmol/mol**

   Conversion : `mmol/mol = (% − 2,15) × 10,929`. Ancre diabète : 6,5 % → ≈ 47,5
   → arrondi ≥ 48 (ADA exact). Choix clinique de la frontière 39 (et non 42) :
   repérer le prédiabète précoce 39–47 où la nutrition peut encore inverser la
   trajectoire (longévité).

   **Source de vérité unique :** `src/services/clinical/catalog/hba1cReference.js`
   (`HBA1C_REF`). `markers.js` (`unit`, `ref_range`, `MARKER_PLAUSIBLE_MAX`) ET
   `labInterpretationEngine.js` (bandes d'interprétation) **dérivent** de ce
   module — ne jamais redéfinir les bornes HbA1c ailleurs. Les divergences
   historiques (markers 4 % vs moteur 4,8 %) sont supprimées : une seule table.

   Convention moteur `[min, max)` : 39 (`prediabete.min`) et 48 (`diabete.min`)
   sont des bornes hautes **exclues** → une valeur de 39 tombe en prédiabète, 48
   en diabète. Vérifié runtime : 38→normale, 39→prédiabète, 47→prédiabète,
   48→diabète, 200→diabète. Les sous-bandes descriptives basses (low/
   low_borderline) restent locales au moteur (aucun signal clinique).

**Étanchéité sang ↔ ADN — confirmée par construction (2026-06-11).**
`MARKER_PLAUSIBLE_MAX` / `validateMarkerValue` / `labInterpretationEngine`
n'opèrent que sur des **codes de biomarqueurs sanguins** ; les génotypes vivent
dans `GENE_CATALOG` (`geneticInterpretation.js`) en menus d'allèles, jamais
numériques. La plausibilité étant un **lookup par clé**, un génotype sur un code
génétique retombe en `assessed:false` (no-op) — aucune fuite possible dans un
sens ou l'autre. Anissa valide donc les 16 plafonds en sachant qu'ils ne
touchent **que** le sang.

→ `MARKER_PLAUSIBLE_MAX` n'est **pas modifié** en V1. Mention conservée :
« à valider Anissa — plafonds en relecture ».

---

## Liste 3 — Seuil de suggestion de transition de phase

**Statut : FIGÉE (validée Anissa le 2026-06-10).**
Fichier : `src/components/SuiviCockpitTimeline.jsx` (`POSITIVE_PATTERN_THRESHOLD`).

| Paramètre | Valeur |
|---|---|
| Seuil | **3 ressentis positifs** |
| Fenêtre | **7 jours** |
| Nature | **Suggestion uniquement — jamais de progression automatique.** |

La fenêtre de 7 jours est déjà celle de `feedbackSampleDepth.js`
(`DEFAULT_WINDOW_DAYS = 7`). Seul le seuil passe de 2 à 3.

---

## Module 1 — Profils à risque

**Statut : DÉCISION FIGÉE (validée Anissa le 2026-06-12). Audit fait le 2026-06-12.
Implémentation à venir (flag manuel + câblage des contraintes dans le bloc sécurité
toujours actif).**

### Décision d'Anissa — 13 profils, 2 comportements

**A. Validation obligatoire** (plan bloqué tant qu'Anissa n'a pas validé) — 7 profils :
enfant/adolescent < 18 ans, diabète T1, insuffisance rénale, insuffisance hépatique,
cancer actif, TCA suspecté ou déclaré, immunosuppresseurs.

**B. Flag + contraintes** (le plan est généré, mais sous contraintes injectées) — 6 profils :
grossesse, allaitement, diabète T2, maladie inflammatoire sévère, traitement
anticoagulant, chirurgie récente < 3 mois.

Contraintes par profil (validées Anissa) :
- **Grossesse :** pas de jeûne prolongé ; vigilance vit. A / iode ; validation renforcée des suppléments.
- **Allaitement :** pas de restriction calorique agressive ; vigilance supplémentation.
- **TCA :** **aucune** restriction calorique ni stratégie de perte de poids automatique ; validation obligatoire.
- **Diabète (T1/T2) :** surveillance glucidique ; vigilance jeûne.
- **Insuffisance rénale :** validation des apports protéiques + de la supplémentation.

### 🔴 TROU DE SÉCURITÉ DU PRODUIT DÉPLOYÉ — à corriger AVANT mise en service

**Constat (audit 2026-06-12) :** sur le chemin de génération **réellement actif par
défaut**, AUCUNE contrainte de profil n'est injectée. Les règles existent dans le code
(`profiles/grossesse.fr.js` : « JAMAIS de jeûne intermittent », « Ne JAMAIS imposer un
régime hypocalorique »…) mais elles ne s'injectent **que si le composer est activé**
(`composerBeta`, toggle localStorage `bfc_composer_beta_fr`, **défaut `false`**). Le
chemin legacy (`buildSystemPromptFr`) n'injecte que le bloc sécurité allergies /
intolérances / traitements (`buildSafetyBlockFr`) — **pas les contraintes de profil**.
De plus, l'analyse riche `formatAnamneseForPrompt` (qui porte le red flag grossesse)
n'est branchée **que** sur la Fiche Médecin (`aiMedicalSummary.js`), **pas** sur la
génération du plan.

**Conséquence :** par défaut, le plan d'une femme enceinte peut contenir du jeûne ;
celui d'une personne avec TCA peut proposer une restriction calorique. C'est la **même
maladie** que les médicaments absents du contexte, corrigée au socle : *la protection
existe dans le code mais n'atteint pas le point de décision.*

**Gravité : défaut de sécurité du produit déployé.** **Non exploité** car le système
n'est pas encore en usage avec de vraies clientes (Anissa a ~2 mois) → pas d'urgence
d'action, mais **priorité 1 du Module 1**, traité comme une correction de sécurité, pas
une feature V2.

**Remède retenu (non négociable) — option (a) :** câbler les contraintes de profil dans
le **bloc sécurité legacy toujours actif**, exactement comme allergènes et médicaments.
**Jamais en OPT-IN.** L'option (b) (forcer `composerBeta=true`) est **rejetée** : elle
embarquerait tout le composer (décision de fonctionnalité) au lieu de la seule sécurité.
Principe gravé au socle : **la sécurité passe par le canal toujours actif.**

### Mapping des 13 profils contre le code existant

Légende couverture : **structuré** = champ dédié fiable ; **regex libre** = détecté par
mots-clés dans du texte libre (fragile : raté si la cliente n'écrit pas le mot) ;
**absent** = rien ne le détecte.

| # | Profil Anissa | Comportement | Couvert aujourd'hui ? | Par quoi | Manque |
|---|---|---|---|---|---|
| 1 | Enfant/ado < 18 ans | Validation obl. | Donnée OUI, comportement NON | `dateNaissance` (structuré) → `resolveAge`/`ageFromDob` ; mais aucun tag profil, `femmeCycle` exige âge ≥ 18 → < 18 tombe en `tag:null` | Flag dérivé déterministe âge<18 → validation obl. (pas de flag manuel requis) |
| 2 | Diabète T1 | Validation obl. | Détecté | `detectPathologies.diabete_t1` (**regex libre** sur pathologies+traitements) ; tag detector `diabete` (ne distingue pas T1/T2) | Comportement « validation obl. » non câblé |
| 3 | Insuffisance rénale | Validation obl. | Partiel | tag `nephropathie` (**regex libre**) ; analyzer = uniquement comme complication du diabète (`diabete_t1.complications.nephropathie`) | Pas de pathologie autonome ; texte libre seulement ; comportement non câblé |
| 4 | Insuffisance hépatique | Validation obl. | **Absent** | rien | Détection + flag manuel + comportement |
| 5 | Cancer actif | Validation obl. | **Absent** | rien | **Flag manuel** + comportement |
| 6 | **TCA suspecté/déclaré** | Validation obl. | **Absent** | rien (aucun tag TCA dans les 20) | **Flag manuel indispensable** (« suspecté » = jugement clinique, non détectable de façon fiable) + comportement « aucune restriction calorique » |
| 7 | Immunosuppresseurs | Validation obl. | Partiel | `detectTreatments.biotherapie` + `.corticoides` (**regex libre** sur traitements) | Pas de concept unifié « immunosuppresseurs » ; comportement non câblé |
| 8 | Grossesse | Flag + contraintes | **Mieux couvert** | `grossesseActuelle` (**structuré** QuestionnaireClient+cockpit) ; tag `grossesse` ; analyzer `grossesseEnCours` + red flag ; module `grossesse.fr.js` | ⚠️ contraintes **composer-OPT-IN** → trou de sécurité ci-dessus |
| 9 | Allaitement | Flag + contraintes | Couvert | `allaitement` (**structuré**) ; tag `allaitement` ; module `allaitement.fr.js` | Même trou OPT-IN |
| 10 | Diabète T2 | Flag + contraintes | Détecté | `detectPathologies.diabete_t2` (**regex libre**) ; tag `diabete` | Contraintes (surveillance glucidique, vigilance jeûne) non câblées par défaut |
| 11 | Maladie inflammatoire sévère | Flag + contraintes | Partiel | tag `digestifChronique` capte MICI/Crohn/RCH (**regex libre**) ; pas de notion « sévère » | Pas de tag dédié ; gravité non capturée |
| 12 | Traitement anticoagulant | Flag + contraintes | Détecté | `detectTreatments.avk` + `.doac` (**regex libre**) ; déjà consommé par la clairance (interactions) | Couvert côté interactions (Liste 1), pas comme contrainte de profil |
| 13 | Chirurgie récente < 3 mois | Flag + contraintes | **Absent** | rien | Champ structuré (date) ou flag manuel + comportement |

**Synthèse mapping :**
- **Bien couverts (structuré) :** grossesse, allaitement — mais contraintes composer-gated (trou).
- **Détectés par regex libre (fragile) :** diabète T1, diabète T2, insuffisance rénale, immunosuppresseurs (biothérapie/corticoïdes), maladie inflammatoire (digestifChronique partiel), anticoagulant (avk/doac).
- **Déterministe non câblé :** enfant < 18 (calculable depuis `dateNaissance`, aucun comportement).
- **Absents (rien ne les détecte) → flag manuel / champ structuré requis :** insuffisance hépatique, cancer actif, **TCA**, chirurgie récente < 3 mois.

### Réponses aux 4 questions de l'audit

1. **Info dans l'anamnèse, structuré ou libre ?** Voir tableau. 2 profils structurés
   (grossesse, allaitement) + 1 déterministe (âge<18 via `dateNaissance`) ; 6 en regex
   libre fragile ; 4 absents. `detectPathologies`/`detectTreatments` couvrent (en regex
   libre) : diabète T1/T2, néphropathie (comme complication), biothérapie, corticoïdes,
   avk/doac — soit ~7 des 13, jamais de façon structurée.
2. **Flag manuel par Anissa ?** **N'existe pas.** Aucun mécanisme `profileOverride` /
   `manualProfile` / `riskFlag`. Indispensable pour TCA (suspecté), cancer actif,
   insuffisance hépatique, chirurgie récente. → **Prérequis confirmé.**
3. **« Validation obligatoire » (plan bloqué) :** mécanisme **réutilisable, existe déjà**
   — la clairance des 4 portes (`assertPlanClinicallyCleared` / `assertExportCleared` +
   gate publication). Rien à créer côté gate, juste brancher un type de violation
   « profil à risque non validé ». (Note : le champ `blocked` du detector est **dormant**
   — `detectPrimaryFemaleProfile` renvoie toujours `blocked:false` — et composer-only.)
4. **Injection des contraintes :** aujourd'hui via les modules profil du composer
   (`getProfileModuleFr`), **OPT-IN seulement** → trou de sécurité. Remède = option (a),
   câblage dans `buildSafetyBlockFr` (toujours actif). Les contraintes deviennent une
   **donnée déclarative éditable par Anissa** (même pattern que `clinicalInteractions.js`),
   pas du code de décision.

---

## Module 2 — Interactions à 4 niveaux

**Statut : REPORTÉ (décision Anissa le 2026-06-12).**

Anissa : la classification **binaire** actuelle (bloquant / avertissement, + conditionnel)
suffit en V1. **Aucune interaction ne nécessite aujourd'hui** un niveau intermédiaire
« majeure ». Réévaluation **quand un besoin clinique concret apparaîtra** — pas avant.
La V1 figée reste celle de la **Liste 1** (classification interactions).

---

## Module 8 — Exclusions alimentaires (religieuses / éthiques / culturelles)

**Statut : DÉCISION FIGÉE (validée Anissa le 2026-06-12). Implémentation à venir
(prérequis champ « Restrictions alimentaires »).**

### Décision d'Anissa — 2 comportements

**Bloquant :** halal, casher, végétarien, végan, allergènes. Un plan qui viole l'une de
ces exclusions est bloqué (clairance, override conscient).

**Flag + contraintes :** Ramadan → adapte les horaires de repas / collations / fenêtre
alimentaire, **sans modifier les apports énergétiques**. (Flag temporel, pas une
restriction d'aliments.)

### Couvert aujourd'hui ?

- **Allergènes : OUI** — `buildSafetyBlockFr` (toujours actif) + clairance allergènes
  (`assertPlanClinicallyCleared`, type `allergen`, HIGH). `form.allergies` (structuré
  texte). `foodRestrictionsParser` extrait aussi les aliments interdits pour Fiche
  Frigo / Word / app cliente.
- **Halal / casher / végétarien / végan / Ramadan : ABSENT en structuré.** Aucun champ
  dédié. Au mieux, du texte libre dans `regimesSuivis` (formSteps cockpit) ou
  `alimentsEvites` — non fiable, non consommé comme exclusion bloquante.

### Prérequis — champ anamnèse « Restrictions alimentaires »

Champ structuré (cases : religieuses / éthiques / culturelles / personnelles) **+ texte
libre**. Sans lui, les exclusions religieuses/éthiques ne peuvent pas devenir bloquantes
(elles restent du texte libre invisible au gate). Le Ramadan, étant un flag temporel,
peut nécessiter une fenêtre de dates.

---

## Module 3 — Contrôle des compléments (cumul / UL)

**Statut : DÉCISION + 8 UL FIGÉES (validées Anissa le 2026-06-12). Implémentation
à venir (prérequis anamnèse « Compléments actuellement pris » + moteur de
co-occurrence).**

### Décision d'Anissa (2026-06-12) — Option B : détection + alerte, pas de calcul

Le système **ne calcule pas** un cumul en mg pour le comparer à une UL. Il
**détecte une co-occurrence à risque** (un même micronutriment surveillé présent
dans plusieurs sources) et **signale à Anissa**, qui juge.

> Justification d'Anissa : *« ne pas bloquer sur la base d'une composition non
> vérifiée »*. Fail-safe au bon niveau — mieux vaut signaler et laisser juger que
> calculer faux (sur des compositions incertaines) et bloquer à tort. Là où le
> calcul est incertain, la clinicienne garde la main.

Conséquence directe de l'audit (cf. ci-dessous) : la composition quantifiée des
compléments **n'existe pas** dans le système, et les dosages sont du texte libre.
L'option B évite précisément de prétendre additionner ce qu'on ne sait pas chiffrer.

### Les 8 UL validées par Anissa (2026-06-12)

| Micronutriment | UL / jour | Niveau d'alerte |
|---|---|---|
| Vitamine A (rétinol) | 3000 µg | **Bloquant** si dépassement |
| Vitamine D | 100 µg (4000 UI) | **Bloquant** si dépassement |
| Sélénium | 300 µg | **Bloquant** si dépassement |
| Vitamine B6 | 25 mg | **Bloquant** si dépassement prolongé ou cumul élevé |
| Fer | 45 mg | Avertissement obligatoire |
| Zinc | 25 mg | Avertissement obligatoire |
| Magnésium (**suppléments uniquement**) | 250 mg | Avertissement obligatoire |
| Iode | 600 µg | Avertissement obligatoire |

### Règles d'application (validées Anissa)

- **Additionner les sources** d'un même micronutriment (plan ↔ compléments déjà pris).
- **Distinguer alimentaire vs suppléments.** Le magnésium UL = **suppléments seulement**
  (le magnésium alimentaire n'entre pas dans le cumul).
- **Jamais de correction automatique.** Le système alerte Anissa ; elle juge.
- **Validation manuelle sur avertissement**, **blocage sur substance bloquante**
  (override conscient possible, même esprit que la clairance allergènes/guardrails).

### Cas particuliers (vigilance renforcée)

- **Grossesse / allaitement :** vit. A, iode, sélénium, B6 (recoupe les contraintes
  de profil du Module 1).
- **Troubles thyroïdiens :** iode, sélénium.
- **Anticoagulants / antidiabétiques : hors périmètre Module 3** — déjà couverts par
  le module interactions (Liste 1). Pas de doublon ici.

### Prérequis — section anamnèse « Compléments actuellement pris »

Sans cette section, le moteur ne voit que les doublons **internes au plan**, jamais
le vrai risque (ce que la cliente prend **déjà** + ce qu'on ajoute). Champ
**semi-structuré** : une liste où chaque entrée porte au minimum **nom** et **dose**
en champs séparés (+ fréquence + commentaire libre), pour permettre la détection
par nom de nutriment sans retomber sur du parsing de texte libre.

### Approche moteur (déclaratif, signale sans calculer)

Détection de **co-occurrence sur les nutriments à risque** (vit. A, sélénium, fer,
zinc, B6…) : un nutriment surveillé apparaît dans ≥2 sources (plan ↔ compléments
actuels déclarés) → alerte « vérifier le cumul, Anissa ». **Pas** un calcul de mg.
Override conscient (même esprit que la clairance allergènes/guardrails). Table des
nutriments surveillés + UL = **donnée déclarative éditable par Anissa** (même
pattern que `clinicalInteractions.js`, promouvable en table Supabase studio-éditable
comme `clinical_guardrails`).

---

## Synthèse transversale — besoins anamnèse (Modules 1 + 3 + 8)

**But :** c'est le **plan de la fondation anamnèse unique.** Il liste les champs
structurés que les 3 modules exigent, pour concevoir **une seule passe** de
réconciliation (schéma unique → rendu cohérent dans les 3 vues → remontée au contexte
IA → suppression des divergences). Aucun module n'est développé ici ; on dresse la liste.

### État actuel des 3 vues de saisie (divergences déjà cartographiées)

| Vue | Fichier | A `supplements` ? | A `grossesse/allaitement` ? | A restrictions religieuses ? |
|---|---|---|---|---|
| Cockpit Anissa | `formSteps.js` | OUI (`supplements`, libre) + `regimesSuivis` (libre) | non structuré | non |
| Questionnaire FR cliente | `QuestionnaireClient.jsx` | **NON** | **OUI** (`grossesseActuelle`, `grossesseTrimestre`, `allaitement`, `allaitementMois`, `postPartum` — structuré) | non |
| Anamnèse EN cliente | `AnamneseClientEn.jsx` | OUI (`supplements`, libre) | non structuré | non |

→ Trois schémas divergents. La fondation doit les unifier sans perte.

### Champs requis par module (cible de la fondation)

| Champ cible | Type | Module(s) | Existe ? | Action fondation |
|---|---|---|---|---|
| `dateNaissance` | date (structuré) | M1 (enfant<18) | OUI (utilisé par detector) | Garantir présence + dériver flag âge<18 |
| `flagsProfilRisque[]` | **flag manuel** multi-select Anissa | M1 (TCA, cancer, insuff. hépatique, chirurgie<3 mois, +tous) | **NON** | **Créer** — case cochable par Anissa, le pivot du Module 1 |
| `grossesseActuelle` / `grossesseTrimestre` | structuré | M1 + M3 (vigilance UL) | OUI (FR cliente only) | Propager aux 3 vues |
| `allaitement` / `allaitementMois` | structuré | M1 + M3 | OUI (FR cliente only) | Propager aux 3 vues |
| `chirurgieRecente` | date / booléen | M1 | **NON** | Créer (ou couvrir via flag manuel) |
| `pathologies` | texte libre | M1 (regex) | OUI | Conserver, mais **doubler de flags structurés** (regex trop fragile) |
| `traitements` / `medicaments` | texte libre | M1 + Liste 1 (interactions) | OUI | Conserver (déjà consommé par analyzer + clairance) |
| `complementsActuels[]` | **semi-structuré** (nom + dose séparés + fréquence + commentaire) | M3 | **NON** | **Créer** — pivot du Module 3 (détection par nom de nutriment) |
| `allergies` | texte libre | M8 (bloquant) + sécurité | OUI (FR cliente + EN + cockpit) | Conserver (déjà câblé sécurité + clairance + parser) |
| `alimentsEvites` | texte libre | M8 (avertissement) | OUI | Conserver |
| `restrictionsAlimentaires` | **structuré** (halal/casher/végé/végan/Ramadan) + libre | M8 (bloquant + flag Ramadan) | **NON** (au mieux `regimesSuivis` libre) | **Créer** — pivot du Module 8 |

### Ce que la fondation devra câbler côté contexte IA (le point commun aux 3)

Les 3 modules butent sur le **même** constat : les données existent parfois, mais
**n'atteignent pas le point de décision** (génération + clairance). La passe de
réconciliation doit donc, en une fois :
1. **Unifier** les 3 schémas en une source (sans perte des anamnèses déjà remplies).
2. **Rendre cohérent** dans les 3 vues (un champ ajouté apparaît partout).
3. **Remonter au contexte IA toujours actif** (`buildSafetyBlockFr`), pas en OPT-IN —
   contraintes profil (M1), nutriments surveillés (M3), exclusions (M8).
4. **Brancher la clairance** (4 portes) sur les nouveaux signaux bloquants (profil non
   validé, exclusion violée, substance UL bloquante).

> ⚠️ **Point de vigilance pour la phase de conception (PAS cet audit) :** la
> réconciliation touche un formulaire que de **vraies clientes ont déjà rempli** (données
> en base). Unifier trois schémas sans perdre de données déjà saisies est l'enjeu
> délicat — toute migration sera regardée avec un soin particulier **avant** d'être
> appliquée. Signalé ici pour mémoire ; à traiter à la conception, pas maintenant.

---

## Gouvernance

**L'IA propose. Anissa décide.** Le système ne pose pas de diagnostic, ne
modifie pas de traitement, ne prescrit pas. Aucune transmission au client sans
validation humaine préalable.

---

## Backlog V2 (hors périmètre V1)

- **D2 — Avertissements population générale sans traitement actif :** aujourd'hui
  la clairance est *treatment-driven* (elle n'évalue que les interactions des
  traitements actifs). Signaler une substance à risque même en l'absence de
  traitement déclaré nécessiterait un nouveau parcours de scan des substances —
  reporté en V2.
- **Liste 2 :** ✅ HbA1c basculée en mmol/mol et figée (cf. Liste 2 §2). Reste à
  intégrer la relecture des 16 plafonds par Anissa sur le fichier réel, puis figer.
- **Héritage « MGD » post-bascule (non bloquant lancement) :** l'étiquette MGD
  survit dans `mgdAnalysisMatrix.js` (en-tête « analyses biologiques *et*
  génétiques » — mélange sang + ADN) et `geneticInterpretation.js` (provenance
  « panel MGD »). **Au-delà du renommage**, vérifier que la matrice de
  recommandation de tests oriente vers la **bonne répartition actuelle des labos**
  — Ortho pour le sanguin, MGD/génétique pour le reste — pour qu'aucune
  prescription suggérée ne pointe vers un labo qui ne fait plus cet examen.
  À traiter quand la bascule Ortho sera finalisée. N'impacte pas l'étanchéité.
- **Unités américaines résiduelles :** audit du glucose en `mg/dL`
  (`labInterpretationEngine.js:387`) — devrait être en mmol/L (SI suisse).
