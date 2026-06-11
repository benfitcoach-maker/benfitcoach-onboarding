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

**Statut : 15 plafonds sanguins FIGÉS (validé Anissa le 2026-06-11, unités SI).
EXCEPTION HbA1c NON figée — plafond mmol/mol en attente d'Anissa.**
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
2. **HbA1c — unité tranchée : mmol/mol (IFCC), source Ortho-Analytic.**
   Décision : unité unique, pas de double support. Le code actuel suppose des %
   à 9 endroits qui doivent basculer **ensemble** (sinon incohérence) :
   - `markers.js:238` `unit: '%'` → `'mmol/mol'`
   - `markers.js:240` `ref_range { low:'4', high:'5.6' }` → ~`{ low:20, high:42 }`
   - `markers.js:395` `MARKER_PLAUSIBLE_MAX.hba1c: 25` → ~`200` (⚠ 25 = valeur
     normale-basse en mmol/mol : le plafond actuel bloquerait des saisies réelles)
   - `labInterpretationEngine.js:60` `unit: '%'` → `'mmol/mol'`
   - `labInterpretationEngine.js:61` `ranges` (toutes bornes en %) → reconverties
   - `labInterpretationEngine.js:387` caution `'HbA1c >6.4%'` → seuil mmol/mol
   - `NutritionConsultation.jsx:766` label de saisie `unit: '%'` → `'mmol/mol'`
   - `aiIntroLetter.js:162` exemple IA « HbA1c à 8% » → exemple en mmol/mol
   - `aiMedicalSummary.js:174` exemple IA « HbA1c 8% » → exemple en mmol/mol

   Cibles à **confirmer par Anissa** avec les autres plafonds : normale ~20–42,
   pré-diabète ~42–47, diabète ≥48, plafond plausibilité ~200 (valeur exacte à
   trancher). Idéalement réaligner sur **une seule** table (markers.js et
   labInterpretationEngine divergent déjà aujourd'hui : 4 vs 4.8 en borne basse).

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
- **Liste 2 :** intégrer les 16 plafonds relus par Anissa + basculer l'HbA1c en
  mmol/mol (9 emplacements, cf. Liste 2 §2), puis figer.
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
