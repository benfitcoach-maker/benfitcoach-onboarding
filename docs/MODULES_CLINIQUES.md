# 🧪 Composer beta — Cheatsheet Anissa (V96.26)

Guide rapide des **20 modules cliniques** que le composer peut injecter dans le prompt nutrition. À consulter avant un test ou pour comprendre un résultat.

---

## 🎯 Comment ça marche en 30 secondes

1. **Cocher 🧪 Composer beta** à côté du bouton "Régénérer" sur l'éditeur consultation.
2. Le détecteur **lit l'anamnèse** (date naissance, pathologies, objectif, commentaires...) et identifie automatiquement les modules pertinents.
3. Le badge orange affiche les modules détectés (ex : `femmeCycle + diabete + complicationsDiabete + saos`).
4. Claude génère le plan en **respectant les MUST INCLUDE** de chaque module détecté.
5. Le bouton **🔁 Re-analyser IA** vérifie que les MUST INCLUDE sont bien dans le plan.

> 💬 **Directives IA** (bouton bleu) : champ libre par cliente pour les cas complexes (refus aliment, contexte spécifique). Override prioritaire.

---

## 🗂 Carte d'ensemble des 20 modules

| Catégorie | Modules |
|---|---|
| 🌸 **Hormonal / maternel** (8) | femmeCycle · perimenopause · menopause · grossesse · allaitement · postPartum · spm · sopk |
| 🩸 **Métabolique** (4) | diabete · complicationsDiabete · nephropathie · thyroide |
| 🌀 **Digestif** (2) | digestifChronique · clostridiumDifficile |
| 🧠 **Vie / stress** (3) | burnoutCortisol · saos · tdah |
| 🏃 **Performance / fertilité** (3) | performanceSportif · preConceptionFertilite · endometriose |

**Cap composer** : max 8 modules injectés simultanément (1 primary + 7 pathologies). `clostridiumDifficile` toujours en priorité absolue.

---

## 🌸 Hormonal / maternel

### `femmeCycle` — femme en âge de procréer (défaut)
- **Triggers** : femme 18-50 ans (calcul auto via dateNaissance)
- **MUST INCLUDE** : adaptation phase lutéale (J15-J28) si cycle renseigné · fer + vit C parallèle si règles abondantes
- **Garde-fous** : pas de protocole hormonal sans avis médical

### `perimenopause` — 40-55 ans avec signes
- **Triggers** : flag explicite OU age 40-55 + 2+ signes (chaleurs, sueurs, cycle irrégulier, troubles sommeil)
- **MUST INCLUDE** : stabilité glycémique · masse maigre (1.2 g/kg) · densité osseuse (Ca + D + K2)
- **Garde-fous** : pas de THM ni phyto sans validation médicale

### `menopause` — confirmée
- **Triggers** : flag oui OU age ≥ 52 + cycle absent ≥ 12 mois
- **MUST INCLUDE** : protéines hautes anti-sarcopénie · Ca + D + K2 · sport résistance mentionné
- **Garde-fous** : pas de prescription hormonale

### `grossesse` — T1 / T2 / T3
- **Triggers** : `grossesseActuelle = "Oui"` OU mention "enceinte / trimestre" dans textes
- **MUST INCLUDE** : folates B9 · iode 150-200 µg · ferritine 50-80 · oméga-3 DHA · liste INTERDITS (listeria, toxoplasmose, mercure, foie animal)
- **Garde-fous** : alcool zéro absolu · jamais hypocalorique · jamais jeûne · pas de médicament ni complément non prescrit

### `allaitement`
- **Triggers** : `allaitement = "Oui"` OU mots-clés (allaite, tétée, lactation)
- **MUST INCLUDE** : +500 kcal/jour · hydratation 2,5-3L · DHA · iode 250-290 µg · Ca + D · fer/B12
- **Garde-fous** : pas de régime restrictif · pas d'éviction préventive sans symptômes bébé · alcool zéro

### `postPartum` — hors allaitement
- **Triggers** : `postPartum = "Oui"` OU "post-partum / accouchement / sevrage"
- **MUST INCLUDE** : restauration fer · protéines 1,2 g/kg · DHA prévention baby blues · vit D + B12 + B9
- **Garde-fous** : pas de régime restrictif les 6 premiers mois · pas de bruleurs/détox

### `spm` — syndrome prémenstruel marqué
- **Triggers** : `spm = "oui"` OU douleurs menstruelles fortes
- **MUST INCLUDE** : magnésium + B6 (couple anti-SPM) · oméga-3 EPA anti-prostaglandines · adaptation lutéale · fer si règles abondantes
- **Garde-fous** : pas de protocole hormonal sans gynéco

### `sopk` — Syndrome des Ovaires Poly-Kystiques
- **Triggers** : "SOPK / PCOS / hyperandrogénie / ovaires polykystiques"
- **MUST INCLUDE** : IG bas systématique · inositol myo + d-chiro · cannelle quotidienne · oméga-3 EPA + thé vert · test éviction lait industriel 8 sem
- **Garde-fous** : pas de plante hormonale sans avis · pas de keto strict prolongé

---

## 🩸 Métabolique

### `diabete` — T1, T2, prédiabète
- **Triggers** : "diabete / T1 / T2 / insulinoresistance / prediabete" OU "glycemie / insuline" dans objectif
- **MUST INCLUDE** : séquence repas fibres → protéines → glucides · IG bas · vinaigre cidre · marche post-prandiale · pas de glucides isolés
- **🛡 GARDE-FOU CRITIQUE** : ❌ JAMAIS d'ajustement de dose insuline (T1) — périmètre endocrinologue uniquement

### `complicationsDiabete` — additif si diabète + complications
- **Triggers** : diabete déjà détecté + "rétinopathie / cataracte / neuropathie / mal perforant / calcifications"
- **MUST INCLUDE** : ⛔ format LITTERAL pour 4 règles
  1. Mention "**lutéine**" pour rétinopathie (épinards, kale 3x/sem)
  2. Mention "**vitamine K2**" pour calcifications (jaunes œuf + fromages affinés)
  3. Si neuropathie : "**alpha-lipoïque**" + magnésium
  4. Phrase liaison : "stabiliser glycémie = levier numéro 1 contre progression"

### `nephropathie` — fonction rénale fragilisée
- **Triggers** : "nephropath / IRC / microalbumin / eGFR / dialyse" OU heuristique T1 ancien (>20 ans) OU T1 + complications microvasculaires
- **MUST INCLUDE** : ⛔ format LITTERAL
  1. "Protéines plafonnées à **0,8 g/kg/jour**" (avec calcul g concret pour le poids)
  2. "Sodium **< 5 g de sel/jour**" (4 g si HTA)
  3. Eau "**faiblement minéralisée**" (Mont Roucous, Volvic, Evian)
- **Garde-fous** : pas de régime hyperprotéiné · pas de supplément K/P sans bilan · pas de tisanes néphrotoxiques

### `thyroide` — Hashimoto, hypo, hyper
- **Triggers** : "thyroide / hashimoto / Levothyrox / basedow / hypothyr / hyperthyr"
- **MUST INCLUDE** : sélénium + zinc (cofacteurs T4→T3) · iode prudent (PAS de supplément si Hashimoto) · timing Levothyrox à jeun + 30-60 min · éviction gluten 8 sem si Hashimoto
- **Garde-fous** : pas de modification Levothyrox · pas d'iode haute dose

---

## 🌀 Digestif

### `digestifChronique` — SII, MICI, RGO, dysbiose
- **Triggers** : "SII / Crohn / RCH / MICI / RGO / reflux / dysbiose / colopathie" OU ballonnements ≤ 2/5
- **MUST INCLUDE** : mastication 20-30x/bouchée · légumes cuits 2-3 sem · eau hors repas (30 min avant / 1h après) · tisanes digestives
- **Garde-fous** : pas de FODMAPs bas à vie · signaux d'alerte (sang, perte poids) → médecin

### `clostridiumDifficile` — CDI active ou récidive
- **Triggers** : "clostridium difficile / C. diff / CDI" → **PRIORITÉ MAX en tête de liste**
- **MUST INCLUDE** : nutrition en SUPPORT du traitement (vancomycine/fidaxomicine) · phase aigue (hydratation, aliments digestes) · phase reconstruction (prébiotiques + fermentés progressifs)
- **Garde-fous** : pas de probiotique sans avis gastro · pas de promesse "guérison" · signaux mégacolon → urgence

---

## 🧠 Vie / stress

### `burnoutCortisol` — surmenage chronique
- **Triggers** : "burn-out / surmenage / épuisement professionnel" OU stress ≥ 8/10
- **MUST INCLUDE** : stabilité glycémique stricte · magnésium (oléagineux, cacao cru, légumes verts) · oméga-3 EPA/DHA · stop caféine après 12h-13h + alcool zéro soir
- **Garde-fous** : pas de fasting / keto agressif en aigu · ne pas négliger signaux psy

### `saos` — apnée du sommeil
- **Triggers** : "apnée / SAOS / SAHOS / IAH / PPC / CPAP" OU IAH ≥ 5
- **MUST INCLUDE** : ⛔ format LITTERAL pour 3 axes
  1. Dîner avant **19h** ou **19h30** + "léger / allégé"
  2. "**Lumière naturelle**" 10-15 min au **réveil**
  3. "Stop **caféine** après 14h" + "**alcool** zéro le soir"

### `tdah` — adulte ou enfant
- **Triggers** : "TDAH / TDA / attention déficit / hyperactivité"
- **MUST INCLUDE** : stabilité glycémique stricte · oméga-3 EPA + DHA · protéines petit-déj (précurseur dopamine) · éviter additifs E102, E110, E122, E124, E129, benzoate
- **Garde-fous** : pas de sevrage Methylphénidate · enfant : pas de régime restrictif préventif

---

## 🏃 Performance / fertilité

### `performanceSportif`
- **Triggers** : objectif "performance" OU sport intense (musculation, marathon, triathlon, crossfit)
- **MUST INCLUDE** : protéines 1,4-2,2 g/kg selon discipline · timing péri-effort (30-60 min avant + 30 min après) · hydratation 500-800 ml/h + électrolytes
- **Garde-fous** : RED-S femme sportive · pas d'hypocalorique en charge · pas de pre-workout chargé

### `preConceptionFertilite`
- **Triggers** : `projetGrossesse = "Oui"` OU "pré-conception / fertilité / PMA / FIV / IAC"
- **MUST INCLUDE** : folates B9 (légumes verts + supplément médical) · iode 150-200 µg · ferritine 50-80 · oméga-3 DHA · perturbateurs endocriniens à limiter
- **Garde-fous** : pas de keto strict (perturbe ovulation) · pas de plante stimulante ovulation sans avis

### `endometriose`
- **Triggers** : "endométriose / adénomyose"
- **MUST INCLUDE** : oméga-3 EPA 3-4x/sem (anti-douleur) · brassicacées cuites (détox œstrogènes) · perturbateurs endocriniens · test éviction gluten + lait 8 sem
- **Garde-fous** : pas de "guérison" promise · pas de plante hormonale sans gynéco

---

## 🛡 Garde-fous transversaux (audit IA composer-aware)

L'audit IA refuse maintenant ces suggestions, peu importe le contexte :

- ❌ Aucun ajustement de dose insuline (T1 = endocrinologue)
- ❌ Aucun régime restrictif sur grossesse / allaitement
- ❌ Aucun phytoestrogène / THM en supplément sans avis médical
- ❌ Aucun probiotique haute dose chez immunodéprimé
- ❌ Aucune modification de médicament en cours
- ❌ Aucune suggestion qui contredit les **directives Anissa** spécifiques à la cliente

---

## 🔄 Workflow recommandé

1. **Anamnèse complète** (date naissance + champs maternels + pathologies) → cockpit étape 1 ✓
2. **Cocher 🧪 Composer beta** → vérifier badge profils détectés
3. (Optionnel) **💬 Directives IA** pour les cas complexes
4. **Générer le plan**
5. **Re-analyser IA** → checklist MUST INCLUDE par module
6. **Affiner** : appliquer les corrections "→ Insérer"
7. **Export Word** + peaufinage + PDF natif → envoi cliente

---

## 📞 Si un module manque ou est mal détecté

Anissa peut **toujours** :
- Compléter l'anamnèse (mention dans pathologies / commentaires) → re-générer
- Utiliser les **Directives IA** pour ajouter du contexte spécifique
- Désactiver le composer (toggle 🧪 OFF) pour revenir au comportement classique

---

*V96.26 · 20 modules cliniques · Composer beta OPT-IN · 2026-05-03*
