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

**Statut : NON FIGÉE — plafonds en relecture par Anissa sur les valeurs réelles.**
Fichier : `src/services/clinical/catalog/markers.js` (`MARKER_PLAUSIBLE_MAX`).

Nature : ce sont des **garde-fous anti-faute-de-saisie** (plafond de
plausibilité), **pas** des seuils diagnostiques. Aucune interprétation, aucune
correction automatique : la donnée absente n'est jamais interprétée.

**Ce qui est validé :** les **unités** sont conformes aux laboratoires suisses
(unités SI : glycémie et cholestérol en mmol/L, ferritine en µg/L, B12 en pmol/L,
vitamine D en nmol/L, créatinine en µmol/L, TSH en mU/L).

**Ce qui reste en attente d'Anissa (ne pas figer) :**
1. Relecture des **16 plafonds** sur les valeurs réelles du fichier (le tableau
   de référence antérieur était périmé/incomplet — il ne correspondait pas aux
   chiffres du fichier et omettait fibrinogène, homocystéine, cortisol, insuline,
   calprotectine). La validation portait sur ce tableau périmé, pas sur le
   fichier réel.
2. **HbA1c** : confirmer l'unité (% DCCT vs mmol/mol IFCC) auprès de
   MGD / Genesupport. Le plafond actuel (25) n'est valable qu'en %.

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
- **Liste 2 :** intégrer les 16 plafonds relus par Anissa + l'unité HbA1c
  confirmée, puis figer.
