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
