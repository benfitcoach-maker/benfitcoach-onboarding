# Backlog — Copilote IA : "Appliquer les corrections" dans le plan

**Statut :** BACKLOG — à ne PAS implémenter pendant la phase de stabilisation. À rouvrir après clôture QA 3 profils.

**Date de dépôt :** 2026-04-20
**Proposé par :** Benoit
**Dépendance :** aucune (la logique d'audit IA existe déjà, reste à câbler l'action d'application).

---

## 1. Contexte

L'app contient déjà :
- Un **audit IA** (dans `NutritionConsultation.jsx` via `scorePlanQuality` + analyse Claude) qui détecte les faiblesses du plan généré : sections trop génériques, portions manquantes, ton robotique, incohérences, etc.
- Un **copilote par section** (`improveSection` dans `services/aiClient.js`) qui propose des réécritures d'une section ponctuelle via bouton `✨ IA` dans l'éditeur.

Ce qui manque : **appliquer les suggestions de l'audit global** sans que Anissa doive copier-coller à la main dans la bonne section. Aujourd'hui l'audit dit "la section X manque de portions" mais c'est à elle de retrouver la section et d'éditer.

## 2. Valeur métier

### Pour Anissa
- Gain de temps considérable après chaque génération (l'audit + fix boucle passe de 10-15 min à ~2 min).
- Moins de friction entre "voir un problème" et "le corriger".
- Possibilité de traiter plusieurs suggestions d'un coup (batch).
- Garde le contrôle final (rien ne s'applique sans son clic).

### Pour le client final
- Plan de meilleure qualité plus rapidement → meilleure expérience de consultation.
- Moins de risque qu'Anissa oublie une suggestion d'audit (parce qu'elle l'a reportée à plus tard).

---

## 3. Exemples d'usage concrets

### Cas 1 — Portions manquantes
> Audit IA : "Section SEMAINE 1 — le déjeuner ne précise pas les grammages du saumon et du quinoa."
>
> Anissa clique **✨ Insérer** → le copilote réécrit la ligne déjeuner avec des grammages cohérents (`120g saumon + 80g quinoa cuit + ...`) et remplace la ligne originale.

### Cas 2 — Ton trop générique
> Audit IA : "Section CLÔTURE DU PLAN — ton robotique, manque de personnalisation."
>
> Anissa clique **✨ Insérer** → la clôture est réécrite avec référence à l'objectif client et le ton Anissa (rassurant, tutoiement, direct).

### Cas 3 — Incohérence transversale
> Audit IA : "Supplément Magnésium Glycinate recommandé le soir, mais la section SUPPLÉMENTS ne le mentionne pas dans le moment de prise."
>
> Anissa clique **✨ Insérer** → ajout automatique de la ligne `Moment : Le soir avant le coucher` dans la fiche supplément concernée.

### Cas 4 — Batch de suggestions
> Audit IA affiche 7 suggestions.
>
> Anissa coche 4 qu'elle veut appliquer, laisse 3 de côté, clique **⚡ Appliquer la sélection (4)** → les 4 modifications sont injectées dans les bonnes sections en une passe.

---

## 4. Granularité et niveaux d'implémentation

### Niveau 1 — MVP (1-2h de dev)
- Chaque suggestion d'audit a un bouton **"✨ Insérer"** individuel.
- Clic = le copilote IA génère la nouvelle version de la section concernée avec la correction intégrée.
- Ouverture d'un panel `aiProposal` (infrastructure existante dans `NutritionEditor.jsx`) où Anissa voit la proposition avec 3 options : **Remplacer** / **Ajouter à la suite** / **Annuler**.
- **Pas** de sélection multiple.

### Niveau 2 — Sélection multiple (3-4h de dev)
- Checkbox devant chaque suggestion d'audit.
- Bouton global **"⚡ Appliquer les (N) corrections choisies"**.
- Les modifications s'appliquent séquentiellement dans l'ordre (car certaines peuvent dépendre d'autres).
- Anissa voit un résumé après application : "4 sections modifiées, 2 ignorées".

### Niveau 3 — Diff visuel + undo (1-2 jours de dev)
- Avant validation : **preview diff** (rouge = supprimé / vert = ajouté) pour chaque section impactée.
- Bouton **"Annuler la dernière correction IA"** disponible tant qu'Anissa n'a pas sauvegardé.
- Historique local des applications IA (optionnel — déjà couvert en partie par le NutritionHistory existant).

---

## 5. Contraintes produit

### Règles d'or
1. **Jamais réécrire tout le plan d'un coup** — risque trop élevé de perdre la touche Anissa sur les sections non concernées.
2. **Préserver le ton Anissa** — le prompt copilote doit explicitement conserver le style (tutoiement, direct, humain).
3. **Validation humaine obligatoire** — aucune modification sans clic Anissa. Pas d'auto-apply.
4. **Granularité section par section** — l'unité de modification = une section (pas le plan entier, pas un mot isolé).
5. **Fallback gracieux** — si le copilote échoue sur une suggestion (timeout, erreur API), afficher le problème et continuer les autres.

### Règles techniques
- Réutiliser `improveSection` de `services/aiClient.js` (déjà câblé).
- Réutiliser le panel `aiProposal` de `SectionBlock` (déjà là, évite un nouveau composant).
- Ne PAS toucher à la logique de génération initiale du plan.

---

## 6. Risques techniques

| Risque | Mitigation |
|---|---|
| La correction IA casse la structure markdown de la section (titre, portions, ponctuation) | Post-process : valider que le résultat commence bien par le même type de bloc que l'original. Si KO → afficher warning + proposer "Ajouter à la suite" au lieu de "Remplacer" |
| La correction IA supprime une info clé (ex: mention d'une allergie) | Prompt copilote doit inclure le profil client complet + mention explicite "NE PAS supprimer les allergies, intolérances, contraintes médicales" |
| Batch de corrections séquentielles — la 3ème dépend de la 1ère qui n'a pas encore été appliquée | Appliquer en séquence, pas en parallèle. Entre chaque application, re-lire la section à jour depuis le state. |
| Corrections qui se chevauchent (2 suggestions sur la même section) | Fusionner côté UI : une seule card combinée "2 corrections sur STRATÉGIE NUTRITIONNELLE" avec un seul bouton Appliquer. |
| API Claude down / timeout | Retry x2 avec backoff. Si échec final, désactiver le bouton avec tooltip d'erreur. |
| Anissa applique par erreur et perd sa version | Auto-sauvegarder un draft avant chaque application IA (peut utiliser le `NutritionHistory` existant). |

---

## 7. Architecture probable

### Composants touchés
- `NutritionConsultation.jsx` — le panel d'audit existant → ajouter les boutons "Insérer" et la checkbox multi-select.
- `services/aiClient.js` — étendre `improveSection` pour accepter un **contexte de correction** (suggestion d'audit à intégrer) en plus du simple "action" actuel.
- `NutritionEditor.jsx` — déjà équipé du panel `aiProposal` + handlers `onAcceptProposal`/`onAppendProposal`/`onRejectProposal`. Pas de refonte.

### Flow technique MVP (niveau 1)
```
1. Anissa voit l'audit dans le cockpit (existant)
2. Chaque suggestion a un bouton "✨ Insérer"
3. Clic → setImprovingId(sectionId) + callback improveSection(form, sectionTitle, currentContent, { auditSuggestion })
4. Retour IA → setProposals({ [sectionId]: newContent })
5. Scroll auto vers la section concernée dans l'éditeur
6. Panel aiProposal s'affiche avec Remplacer / Ajouter / Annuler
7. Anissa clique Remplacer → section updated, proposal cleared
```

### Prompt copilote (à ajuster)
```
Tu es le copilote nutrition d'Anissa. Tu vas modifier UNIQUEMENT la section suivante
pour appliquer cette correction : {auditSuggestion}.

Contraintes absolues :
- Garder le ton Anissa : direct, tutoiement, humain, jamais robotique
- Ne pas supprimer les allergies, intolérances, contraintes médicales
- Ne pas changer la structure markdown (titres, puces, labels conservés)
- Ne pas ajouter de disclaimer, ne pas expliquer ce que tu fais
- Retourner uniquement le NOUVEAU contenu de la section, sans préambule

Section actuelle :
{currentContent}

Profil client (pour contexte) :
{formSummary}
```

---

## 8. Checklist d'implémentation

Ordonnée par dépendance, à reprendre quand la phase de stab est clôturée.

### MVP (niveau 1)
- [ ] Vérifier que l'audit IA actuel renvoie bien une structure exploitable (`{ sectionTitle, issue, suggestion }[]`). Si non, ajuster le prompt d'audit.
- [ ] Étendre `improveSection` dans `services/aiClient.js` pour accepter un paramètre optionnel `{ auditSuggestion: string }`.
- [ ] Dans le cockpit d'audit (`NutritionConsultation.jsx`), ajouter un bouton "✨ Insérer" par suggestion.
- [ ] Câbler le bouton → trouver la `section.id` correspondante dans `sections[]` → appeler `handleImprove(id, 'auditFix', { auditSuggestion })`.
- [ ] Scroll auto vers la section dans l'éditeur au moment de l'appel.
- [ ] Tester sur une vraie consultation (idéalement une où l'audit a déjà remonté 3+ suggestions).
- [ ] Vérifier que le panel `aiProposal` s'ouvre correctement + que Remplacer/Ajouter/Annuler fonctionnent comme attendu.

### Niveau 2 — Multi-select
- [ ] Ajouter une checkbox devant chaque suggestion.
- [ ] State `selectedSuggestions: Set<id>`.
- [ ] Bouton global "⚡ Appliquer les (N) corrections" — actif si >= 1 suggestion cochée.
- [ ] Clic → boucle séquentielle `for each suggestion: await improveSection(...) ; await applyProposal()`.
- [ ] Toast de résumé à la fin ("4 sections modifiées").

### Niveau 3 — Diff + undo
- [ ] Intégrer une lib de diff (`diff-match-patch` ou `jsdiff`, ~15 kB).
- [ ] Panel `aiProposal` affiche le diff coloré en plus du texte brut.
- [ ] Bouton "Annuler la dernière correction IA" — utilise `originalContent` (déjà stocké dans chaque section).
- [ ] Historique minimal côté UI (session-only, pas besoin de persister).

---

## 9. Décisions en suspens

1. **Scope de l'audit** — doit-il inclure TOUT le plan ou seulement les sections modifiées depuis la dernière sauvegarde ?
2. **Déclencheur** — l'audit se relance-t-il automatiquement après chaque application de correction ? Ou manuel ?
3. **Undo** — limité à la session navigateur, ou persistant en base ?
4. **Copilote multi-section en un appel** — faisable techniquement (un prompt qui reçoit 4 corrections et renvoie les 4 sections modifiées en un coup) mais plus risqué. Rester en mode séquentiel pour la V1.
5. **Indicateur visuel** — faut-il un badge "✨ Modifié par IA" sur la section après application ? Utile pour l'audit humain final.

---

## 10. Résultat attendu

Le workflow idéal après implémentation complète :

```
Anissa génère un plan
 └─> Audit IA affiche 5 suggestions
     └─> Anissa coche 3 suggestions qu'elle veut
         └─> Clic "⚡ Appliquer (3)"
             └─> 3 sections modifiées en 10s
                 └─> Anissa relit, ajuste 1 phrase manuellement
                     └─> Export PDF
                         └─> Fin — plan prêt, ton Anissa préservé
```

Gain estimé : **~10 min par consultation** sur un workflow qui en prenait 15.

---

*Fin du backlog. À rouvrir après clôture de la phase de stabilisation.*
