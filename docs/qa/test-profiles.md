# QA V74 — 3 profils de test pour valider la phase de stabilisation

**Objectif :** valider sur 3 profils variés que les fixes V67–V74 sont effectifs :
- V67 : doublon suppléments retiré
- V71 : "1/2 avocat" reste atomique en rotation
- V72 : plus aucun tableau horaire vide
- V74 : plus de superposition cover + progression en followup

Après saisie de chaque profil, **régénérer le plan** puis suivre la checklist QA en bas du doc.

---

## Comment créer les profils

1. Dashboard Anissa → **+ Nouveau client**
2. Remplir **étape par étape** les champs ci-dessous
3. À la fin → **Sauvegarder** (pas "Sauvegarder et envoyer questionnaire" — on bypass le questionnaire, tout est déjà dans la fiche)
4. Ouvrir la fiche → **Nouvelle consultation** → **Générer avec l'IA**

> Les valeurs ci-dessous sont fictives mais cohérentes médicalement. Tu peux adapter prenom/email pour éviter la confusion avec de vraies clientes.

---

## ━━━━━━━━━━━━━━━━━━━━━━━
## 👤 Profil 1 — QA-Digestion (digestion / stress)
## ━━━━━━━━━━━━━━━━━━━━━━━

**Cas métier :** cliente 35 ans, travail stressant, digestion chronique difficile, énergie en dents de scie. Cas typique qui exige plan doux + fiche frigo très appliquée + protocoles ciblés.

### Étape 1 — Identité
| Champ | Valeur |
|---|---|
| prenom | Claire |
| nom | Dubois |
| age | 35 |
| genre | Femme |
| profession | Cheffe de projet marketing |
| poids | 64 |
| taille | 168 |
| tourTaille | 78 |
| tourHanche | 98 |
| tourPoitrine | 90 |
| tourBras | 28 |
| tourCuisse | 56 |
| masseGrasse | 26 |
| masseMusculaire | |
| telephone | +41 79 000 00 01 |
| email | qa-digestion@test.ch |

### Étape 2 — Antécédents médicaux
| Champ | Valeur |
|---|---|
| antecedentsFamiliaux | Mère colon irritable, père hypertension |
| pathologies | Colon irritable diagnostiqué il y a 6 ans, reflux gastrique occasionnel |
| traitements | Aucun traitement chronique. Spasfon ponctuel lors des crises. |
| operations | Appendicectomie à 12 ans |
| allergies | Aucune allergie alimentaire. Intolérance suspectée au lactose (non testée). |

### Étape 3 — Alimentation
| Champ | Valeur |
|---|---|
| nbRepas | 3 repas + 1 collation |
| alimentsEvites | Choux, légumineuses mal cuites, lait de vache |
| hydratation | 1.2L/j, surtout café (3/j) et tisanes |
| mastication | Rapide, souvent devant écran |
| regimesSuivis | Test FODMAP il y a 2 ans, abandonné. Pas végétarienne. |

### Étape 4 — Santé / Cycle
| Champ | Valeur |
|---|---|
| blessures | Aucune |
| douleursActuelles | Ballonnements en fin de journée, crampes abdominales 2-3×/semaine |
| contraception | Stérilet cuivre |
| cycleDuree | 28 jours |
| spm | SPM modéré (3 jours avant règles : irritabilité, fringales sucrées) |
| douleursMenstruelles | Modérées, 1er jour |
| projetGrossesse | Non, pas dans l'immédiat |

### Étape 5 — Sport
| Champ | Valeur |
|---|---|
| typeSport | Yoga + marche rapide |
| frequenceSport | 2-3×/semaine |
| objectifSport | Retrouver de l'énergie, gérer le stress |
| recuperation | Correcte |
| supplements | Magnésium ponctuellement |
| digestifEffort | Pas de trouble à l'effort |

### Étape 6 — Métabolisme & Énergie
| Champ | Valeur |
|---|---|
| energieJournee | Chute vers 15-16h, coup de pompe post-déjeuner |
| fringalesSucre | Oui, fin de journée surtout, lors des périodes stressantes |
| variationsGlycemie | Oui, confirmé par épisodes de faim intense + irritabilité |
| reactionGlucides | `["coup_de_pompe_post_repas", "fringales_sucre"]` (cocher ces 2 cases) |

### Étape 7 — Digestion & Microbiote
| Champ | Valeur |
|---|---|
| frequenceBallonnements | Quotidien, pire en soirée |
| transitType | Alternance diarrhée / constipation, tendance SII-mixte |
| alimentsProblematiques | Choux, oignon cru, pain blanc, lait |
| consommationReguliere | `["cafe", "produits_transformes"]` (cocher) |

### Étape 8 — Inflammation & Immunité
| Champ | Valeur |
|---|---|
| douleursInflammations | Aucune douleur articulaire |
| frequenceMaladies | 2-3 rhumes par an |
| troublesPeau | Peau réactive, petites rougeurs occasionnelles |

### Étape 9 — Stress & Sommeil
| Champ | Valeur |
|---|---|
| niveauStressActuel | 8 |
| difficultesEndormissement | Oui, parfois jusqu'à 1h du matin |
| reveilsNocturnes | 1-2× par nuit |
| etatReveil | Fatiguée, besoin de 2 cafés pour démarrer |

### Étape 10 — Mode de vie
| Champ | Valeur |
|---|---|
| tempsExterieur | Moins de 30 min/j |
| heuresSommeil | 6h en moyenne |
| expositionEcransSoir | Oui, jusqu'à l'endormissement |
| professionType | Télétravail assis |
| alcool | Vin 2-3 verres/semaine |
| tabac | Non |

### Étape 11 — Génétique & Analyses
| Champ | Valeur |
|---|---|
| analysesBiologiques | NFS dernier bilan OK, ferritine basse (28 ng/mL) |
| testADN | Non |
| testsGenetiques | Non |
| pretAnalysesAvancees | Oui, ouverte à MGD si utile |

### Étape 12 — Objectifs
| Champ | Valeur |
|---|---|
| objectifPrincipalNutrition | Retrouver une digestion stable et une énergie constante dans la journée |
| dureeProbleme | 6 ans (colon irritable diagnostiqué) |
| dejaEssaye | FODMAP 6 mois (arrêté — trop contraignant), probiotiques 2 mois (sans effet net) |
| pretProtocole | Oui |

### Étape 13 — Notes nutritionniste
| Champ | Valeur |
|---|---|
| observationsGenerales | Profil digestif-stress classique. Priorité : stabilisation glycémique + réparation intestinale douce + gestion stress. Éviter de surcharger en suppléments. |
| planAction | Phase 1 (2-3 sem) : retirer lactose strict, 3 repas structurés, fin de grignotage. Phase 2 : introduction lente FODMAP tolérés, ajout de mag glycinate soir. |
| examensPrevoir | Ferritine de contrôle à 3 mois. Éventuel MGD si pas d'amélioration à 6 sem. |

---

## ━━━━━━━━━━━━━━━━━━━━━━━
## 👤 Profil 2 — QA-SOPK (hormonal / SOPK)
## ━━━━━━━━━━━━━━━━━━━━━━━

**Cas métier :** cliente 29 ans, SOPK confirmé, projet grossesse à moyen terme, prise de poids récente, cycles irréguliers. Cas qui exige rotation hormonale + protocoles ciblés (glycémie + insuline) + suppléments hormonaux (Myo-inositol, D3, Oméga-3).

### Étape 1 — Identité
| Champ | Valeur |
|---|---|
| prenom | Sophie |
| nom | Martin |
| age | 29 |
| genre | Femme |
| profession | Infirmière (horaires variables) |
| poids | 72 |
| taille | 165 |
| tourTaille | 88 |
| tourHanche | 104 |
| tourPoitrine | 94 |
| tourBras | 31 |
| tourCuisse | 62 |
| masseGrasse | 32 |
| masseMusculaire | |
| telephone | +41 79 000 00 02 |
| email | qa-sopk@test.ch |

### Étape 2 — Antécédents
| Champ | Valeur |
|---|---|
| antecedentsFamiliaux | Mère diabète type 2, tante SOPK |
| pathologies | SOPK diagnostiqué à 25 ans (échographie + bilan hormonal). Acné adulte. |
| traitements | Aucun traitement hormonal actuel. Pilule stoppée il y a 18 mois. |
| operations | Aucune |
| allergies | Aucune |

### Étape 3 — Alimentation
| Champ | Valeur |
|---|---|
| nbRepas | 3 repas très variables selon horaires de garde |
| alimentsEvites | Aucun aliment évité |
| hydratation | 1.5L/j |
| mastication | Correcte quand elle a le temps, rapide en garde |
| regimesSuivis | Weight Watchers il y a 3 ans (perte 5kg puis reprise) |

### Étape 4 — Santé / Cycle
| Champ | Valeur |
|---|---|
| blessures | Aucune |
| douleursActuelles | Acné dos et mâchoire, fringales sucrées pré-règles importantes |
| contraception | Aucune (projet grossesse) |
| cycleDuree | Variable, entre 35 et 60 jours |
| spm | Important (5-7 jours avant) : gonflements, fringales, irritabilité |
| douleursMenstruelles | Modérées |
| projetGrossesse | Oui, dans les 12-18 prochains mois |

### Étape 5 — Sport
| Champ | Valeur |
|---|---|
| typeSport | Course à pied + cours collectifs (fitness) |
| frequenceSport | 2×/semaine irrégulier |
| objectifSport | Perdre 5-7 kg, améliorer composition corporelle, préparer grossesse |
| recuperation | Longue après séance intense |
| supplements | Rien de régulier |
| digestifEffort | Pas de trouble |

### Étape 6 — Métabolisme & Énergie
| Champ | Valeur |
|---|---|
| energieJournee | Énergie basse le matin, pics et chutes après les repas sucrés |
| fringalesSucre | Oui, quotidiennes, surtout en 2e partie de journée |
| variationsGlycemie | Marquées — irritabilité entre repas, besoin de collation sucrée |
| reactionGlucides | `["coup_de_pompe_post_repas", "fringales_sucre", "prise_de_poids_abdominale"]` |

### Étape 7 — Digestion & Microbiote
| Champ | Valeur |
|---|---|
| frequenceBallonnements | 2-3×/semaine, surtout en phase lutéale |
| transitType | Normal, parfois constipation en pré-règles |
| alimentsProblematiques | Aucun identifié clairement |
| consommationReguliere | `["laitages", "cafe", "produits_transformes"]` |

### Étape 8 — Inflammation & Immunité
| Champ | Valeur |
|---|---|
| douleursInflammations | Aucune |
| frequenceMaladies | 1-2 rhumes/an |
| troublesPeau | Acné hormonale dos + mâchoire (aggravée en 2e moitié de cycle) |

### Étape 9 — Stress & Sommeil
| Champ | Valeur |
|---|---|
| niveauStressActuel | 6 |
| difficultesEndormissement | Occasionnelles, surtout après gardes de nuit |
| reveilsNocturnes | Rares hors gardes |
| etatReveil | Variable selon horaires |

### Étape 10 — Mode de vie
| Champ | Valeur |
|---|---|
| tempsExterieur | 30-60 min/j |
| heuresSommeil | 7h en moyenne mais très fragmenté |
| expositionEcransSoir | Modérée |
| professionType | Debout, gardes de nuit 1-2×/mois |
| alcool | Rare, 1-2 verres/mois |
| tabac | Non |

### Étape 11 — Analyses
| Champ | Valeur |
|---|---|
| analysesBiologiques | HOMA-IR 2.8 (insulino-résistance modérée). Testostérone totale 0.8 ng/mL (haute). LH/FSH 2.5. Vit D 18 ng/mL (basse). Ferritine 42. |
| testADN | Non |
| testsGenetiques | Non |
| pretAnalysesAvancees | Oui, demande explicitement un MGD |

### Étape 12 — Objectifs
| Champ | Valeur |
|---|---|
| objectifPrincipalNutrition | Régulariser les cycles, perdre 5-7 kg et préparer un terrain favorable à une grossesse |
| dureeProbleme | 4 ans (SOPK diagnostiqué il y a 4 ans) |
| dejaEssaye | Pilule (arrêtée), metformine 3 mois (arrêtée — digestif difficile), myo-inositol 2 mois (abandonné par oubli) |
| pretProtocole | Oui, très motivée |

### Étape 13 — Notes
| Champ | Valeur |
|---|---|
| observationsGenerales | SOPK classique avec insulino-résistance modérée. Priorité absolue : stabilisation glycémique + sensibilisation insulinique. Projet grossesse à moyen terme → cadrage doux, pas restrictif. Associations Myo-inositol + D3 + Oméga-3 indispensables. |
| planAction | Phase 1 (4 sem) : 3 repas fixes protéinés, élimination sucre raffiné, myo-inositol 4g/j. Phase 2 : réintroduction progressive glucides complexes selon tolérance. |
| examensPrevoir | HOMA-IR contrôle 3 mois. AMH + bilan hormonal annuel. |

---

## ━━━━━━━━━━━━━━━━━━━━━━━
## 👤 Profil 3 — QA-PerteDePoids (perte de poids simple)
## ━━━━━━━━━━━━━━━━━━━━━━━

**Cas métier :** homme 42 ans, sédentaire, prise de poids progressive depuis 10 ans, pas de pathologie majeure. Cas "simple" qui doit produire un plan efficace mais pas surchargé. La fiche frigo doit être LA référence quotidienne.

### Étape 1 — Identité
| Champ | Valeur |
|---|---|
| prenom | Marc |
| nom | Rossi |
| age | 42 |
| genre | Homme |
| profession | Cadre financier |
| poids | 98 |
| taille | 182 |
| tourTaille | 108 |
| tourHanche | 110 |
| tourPoitrine | 115 |
| tourBras | 36 |
| tourCuisse | 62 |
| masseGrasse | 28 |
| masseMusculaire | |
| telephone | +41 79 000 00 03 |
| email | qa-pertepoids@test.ch |

### Étape 2 — Antécédents
| Champ | Valeur |
|---|---|
| antecedentsFamiliaux | Père diabète type 2, mère hypertension et cholestérol |
| pathologies | Hypertension légère (135/85 non traitée). Cholestérol légèrement haut (LDL 3.6 mmol/L). |
| traitements | Aucun traitement médicamenteux |
| operations | Aucune |
| allergies | Aucune |

### Étape 3 — Alimentation
| Champ | Valeur |
|---|---|
| nbRepas | 3 repas + grignotage apéro quasi-quotidien (biscuits salés, vin) |
| alimentsEvites | Rien |
| hydratation | 1L/j |
| mastication | Rapide |
| regimesSuivis | Aucun régime suivi, déjà tenté de faire "attention" sans cadre précis |

### Étape 4 — Santé
| Champ | Valeur |
|---|---|
| blessures | Aucune |
| douleursActuelles | Genoux un peu sensibles à la montée d'escaliers |
| contraception | — |
| cycleDuree | — |
| spm | — |
| douleursMenstruelles | — |
| projetGrossesse | — |

### Étape 5 — Sport
| Champ | Valeur |
|---|---|
| typeSport | Vélo balade week-end, marche occasionnelle |
| frequenceSport | 1×/semaine |
| objectifSport | Perdre 10-12 kg, retrouver condition physique, pouvoir jouer au foot avec son fils |
| recuperation | OK |
| supplements | Aucun |
| digestifEffort | Pas de trouble |

### Étape 6 — Métabolisme
| Champ | Valeur |
|---|---|
| energieJournee | Somnolence après déjeuner, regain en fin d'après-midi |
| fringalesSucre | Plus du salé/gras en fin de journée (apéro) |
| variationsGlycemie | Non marquées |
| reactionGlucides | `["prise_de_poids_abdominale"]` |

### Étape 7 — Digestion
| Champ | Valeur |
|---|---|
| frequenceBallonnements | Occasionnels après repas copieux |
| transitType | Régulier |
| alimentsProblematiques | Aucun |
| consommationReguliere | `["cafe", "produits_transformes", "alcool"]` |

### Étape 8 — Inflammation
| Champ | Valeur |
|---|---|
| douleursInflammations | Genoux ponctuels |
| frequenceMaladies | Rare |
| troublesPeau | Aucun |

### Étape 9 — Stress & Sommeil
| Champ | Valeur |
|---|---|
| niveauStressActuel | 5 |
| difficultesEndormissement | Non |
| reveilsNocturnes | 1× pour uriner |
| etatReveil | Correct |

### Étape 10 — Mode de vie
| Champ | Valeur |
|---|---|
| tempsExterieur | 30 min/j |
| heuresSommeil | 7h |
| expositionEcransSoir | Oui, TV jusqu'à 23h |
| professionType | Assis bureau, déplacements occasionnels |
| alcool | 3-4 verres de vin/semaine + apéro week-end |
| tabac | Non |

### Étape 11 — Analyses
| Champ | Valeur |
|---|---|
| analysesBiologiques | Glycémie à jeun 5.6 mmol/L. HbA1c 5.8%. Triglycérides 1.9 mmol/L. |
| testADN | Non |
| testsGenetiques | Non |
| pretAnalysesAvancees | Pas pour l'instant, veut un cadre simple |

### Étape 12 — Objectifs
| Champ | Valeur |
|---|---|
| objectifPrincipalNutrition | Perdre 10-12 kg de façon durable et retrouver de la condition physique |
| dureeProbleme | 10 ans de prise progressive (+15 kg depuis 30 ans) |
| dejaEssaye | Périodes "je fais gaffe" sans cadre, abandonnées en 2-3 sem |
| pretProtocole | Oui, mais veut du simple et du faisable — pas un plan contraignant |

### Étape 13 — Notes
| Champ | Valeur |
|---|---|
| observationsGenerales | Cas classique prise de poids progressive + syndrome métabolique débutant. Pas besoin de complexifier. Priorité fiche frigo ultra-claire pour appliquer au quotidien. Réduction alcool + apéro = levier n°1. |
| planAction | Phase 1 (2 sem) : 3 repas cadrés, suppression grignotage apéro en semaine, 1.5L eau. Phase 2 : intro marche 30min/j + alcool max 2 verres/sem. |
| examensPrevoir | Bilan lipidique + glycémie à jeun + TA à 3 mois. |

---

## ━━━━━━━━━━━━━━━━━━━━━━━
## 🧪 Checklist QA par profil
## ━━━━━━━━━━━━━━━━━━━━━━━

Après chaque génération, vérifier dans l'éditeur ET dans le PDF (Aperçu puis Télécharger) :

### Bugs régressions à zéro
- [ ] Badge `V74` visible bottom-right → CSS/JS à jour
- [ ] **V67** — section `SUPPLÉMENTS RECOMMANDÉS` apparaît UNE seule fois (pas de doublon)
- [ ] **V71** — dans `ROTATION DES REPAS`, "1/2 avocat", "1/4 courge", etc. restent sur une seule ligne, pas splittés en "1" + "2 avocat"
- [ ] **V72** — aucune section `TABLEAU HORAIRE PERSONNALISÉ` vide ni en plan ni en PDF
- [ ] **V74** — PDF followup : le tableau de progression NE chevauche PLUS la cover (si profil 2 régénéré en followup)

### Rendu premium attendu
- [ ] `INTRODUCTION` → card cream avec label "LE MOT D'ANISSA" doré
- [ ] `ANALYSE DU PROFIL` → InfoBlockList (labels dorés micro + valeurs sombres)
- [ ] `SEMAINE 1 — STRUCTURE ALIMENTAIRE` → **meal cards blanches** (fix V69)
- [ ] `ROTATION DES REPAS` → 2 colonnes soulignées doré
- [ ] `FICHE FRIGO` → card avec border gauche dorée, bloc "À RETENIR"
- [ ] `PLAN D'ACTION` → timeline verticale avec dots dorés S1→S4
- [ ] `SUPPLÉMENTS` → cards beige avec border gauche dorée
- [ ] `CLÔTURE` → card cream avec label "POUR LA SUITE" doré

### Contenu cohérent
- [ ] Allergies / intolérances respectées (Claire = pas de lactose, etc.)
- [ ] Portions présentes (grammes / ml), pas de "quantité suffisante"
- [ ] Ton humain, tutoiement, direct
- [ ] Pas de répétitions visibles ("Avec ton...", "N'oublie pas de...")
- [ ] Pas de mention de tableaux markdown avec pipes

### Aperçu PDF (V70 modal)
- [ ] Bouton `👁 Aperçu PDF` ouvre la modale large
- [ ] 3 tabs : PDF complet / Fiche frigo / Cover
- [ ] Bouton `⬇ Télécharger` dans le header modal fonctionne
- [ ] Clic sur "Ouvrir l'éditeur complet (3 vues)" → Aperçu se ferme + FicheFrigoPreview s'ouvre au-dessus (V73)
- [ ] Clic sur "Personnaliser la cover" → Aperçu se ferme + CoverForm s'ouvre au-dessus (V73)

---

## Procédure si bug détecté

1. Noter : profil concerné + section + symptôme + screenshot
2. Récupérer le contenu brut de la section (clic sur la card → copier le textarea)
3. Me transmettre pour diagnostic ciblé (freeze respecté — je regarde mais je ne touche au code que si c'est un bug de stabilisation, pas une feature)

---

## Après les 3 profils

Si les 3 passent propre → **clôture de la phase de stabilisation**. On ouvre alors un des 3 backlogs :
- `oneshot-mode.md`
- `ai-plan-copilot.md`
- `consultation-delete.md`
