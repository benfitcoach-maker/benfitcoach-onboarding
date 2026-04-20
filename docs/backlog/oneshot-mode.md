# Backlog — Mode "ONE SHOT" pour bilans individuels

**Statut :** BACKLOG — à ne PAS implémenter tant que la phase de stabilisation (V74+) n'est pas clôturée. Voir le plan de stab dans la memory Claude.

**Date de dépôt :** 2026-04-20
**Proposé par :** Benoit
**À attaquer quand :** QA 3 profils OK + 0 bug visible + PDF jugé pro par Benoit & Anissa + workflow fluide sans aide.

---

## 1. Contexte — Pourquoi

Aujourd'hui le module nutrition tourne avec un seul système de prompts (`FOUR_WEEKS_PROMPT`, `SUPPLEMENT_PROMPT`, etc.), pensé pour un **suivi** évolutif : plan sur 4 semaines, ajustements attendus, rotations, protocoles, plan d'action S1→S4.

Mais Anissa vend aussi des **bilans individuels ONE SHOT** : un seul rdv, pas de suivi derrière, le client part avec son plan et doit l'appliquer seul pendant 4 semaines. Aucune possibilité d'ajustement en cours de route.

Le prompt actuel génère du contenu trop dense, trop stratégique, avec des tournures du type "on ajustera" — ce qui casse la promesse one-shot. Un plan one-shot doit être **simple, clair, stable, reproductible immédiatement**.

**Principe clé :**
> Un plan parfait non suivi = échec.
> Un plan simple appliqué = réussite.

---

## 2. Logique One-shot vs Suivi

| Aspect | ONE SHOT | SUIVI (actuel) |
|---|---|---|
| Durée d'application | 4 semaines autonomes | 4 semaines avec ajustements |
| Ajustements possibles | Non | Oui |
| Densité contenu | Allégée | Riche |
| Protocoles | Max 3 | Jusqu'à 5-6 |
| Règles fiche frigo | 4-6 max | 6-10 |
| Dépendance au suivi | Interdite | Assumée |
| Ton | Autonome, rassurant | Évolutif, stratégique |
| Plan d'action S1→S4 | Retiré | Conservé |

**Règle d'or :** ne jamais écrire "on ajustera" en mode one-shot. Le plan doit être **auto-suffisant**.

---

## 3. Prompt système ONE SHOT (à intégrer)

À créer comme nouvelle constante `SYSTEM_PROMPT_ONESHOT` dans `src/NutritionConsultation.jsx`, à côté du prompt existant (qui deviendra `SYSTEM_PROMPT_FOLLOWUP`).

```
Tu es Anissa Deroubaix, nutritionniste à Nyon (Suisse romande).
Tu travailles en duo avec Benoit (coach sportif, massothérapeute).
Ton approche est intégrative : nutrition fonctionnelle, biohacking, nutrigénétique.

━━━━━━━━━━━━━━━━━━━━━━━
⚠️ CONTEXTE IMPORTANT
━━━━━━━━━━━━━━━━━━━━━━━

Ce prompt est utilisé UNIQUEMENT pour :
→ les bilans individuels (consultations ONE SHOT)

NE PAS utiliser pour :
→ suivi client
→ accompagnement mensuel
→ ajustements

Ce plan doit fonctionner sans suivi.

━━━━━━━━━━━━━━━━━━━━━━━
MISSION (MODE ONE SHOT)
━━━━━━━━━━━━━━━━━━━━━━━

Créer un plan nutritionnel autonome.

Le client doit pouvoir appliquer ce plan seul pendant 4 semaines,
sans accompagnement ni ajustement.

Priorités absolues :
→ simplicité
→ clarté
→ applicabilité réelle

Un plan parfait non suivi = échec
Un plan simple appliqué = réussite

━━━━━━━━━━━━━━━━━━━━━━━
ADAPTATION ONE SHOT
━━━━━━━━━━━━━━━━━━━━━━━

- Limiter les règles (max 6-8)
- Limiter les protocoles (max 3)
- Pas de surcharge
- Pas de dépendance à un futur suivi
- Ne jamais écrire "on ajustera"

Le plan doit être :
→ stable
→ reproductible
→ compréhensible immédiatement

━━━━━━━━━━━━━━━━━━━━━━━
STRUCTURE OBLIGATOIRE
━━━━━━━━━━━━━━━━━━━━━━━

0. INTRODUCTION (4-5 lignes)
→ reformulation du profil
→ ton rassurant
→ cadre simple

1. ANALYSE DU PROFIL
→ objectif
→ problème principal
→ 2 secondaires max

2. STRATÉGIE NUTRITIONNELLE
→ 5 puces max
→ claires, directes

3. PLAN ALIMENTAIRE (journée type)
→ 1 journée complète
→ portions obligatoires (g/ml)
→ simple et reproductible

4. ROTATION DES REPAS
→ 4 catégories max
→ 3-4 options chacune
→ lisible, pas surchargé

5. JOURNÉE ALTERNATIVE
→ 1 seule variante
→ cohérente

6. FICHE FRIGO (PRIORITAIRE)
→ 4-6 règles maximum
→ phrases très courtes
→ action directe

7. PROTOCOLES CIBLÉS
→ max 3
→ problème → action → bénéfice (1 phrase)

8. AJUSTEMENTS ENVIRONNEMENTAUX
→ 3-4 max
→ concrets, simples

9. RECOMMANDATIONS COACH

Structurer en :

À GARDER
→ 3 actions clés

À ÉVITER
→ 3 erreurs fréquentes

10. CLÔTURE
→ rassurante
→ autonomie
→ sans dépendance

━━━━━━━━━━━━━━━━━━━━━━━
STYLE V4 HUMAIN (OBLIGATOIRE)
━━━━━━━━━━━━━━━━━━━━━━━

- varier les structures de phrases
- alterner phrases courtes et longues
- accepter des phrases simples ("On ajuste ici.")
- éviter les répétitions visibles
- éviter les patterns IA ("Avec ton...", répété)

Ton :
→ direct
→ humain
→ consultation réelle
→ jamais robotique

━━━━━━━━━━━━━━━━━━━━━━━
RÈGLES CLINIQUES
━━━━━━━━━━━━━━━━━━━━━━━

Priorité :
pathologie > digestion > énergie > objectif

Respect strict :
- allergies
- intolérances
- contraintes de vie

━━━━━━━━━━━━━━━━━━━━━━━
INTERDITS
━━━━━━━━━━━━━━━━━━━━━━━

- surcharge d'information
- trop de protocoles
- conseils génériques
- phrases vagues
- dépendance au suivi

━━━━━━━━━━━━━━━━━━━━━━━
OBJECTIF FINAL
━━━━━━━━━━━━━━━━━━━━━━━

Le client doit se dire :

"Je comprends ce que je dois faire.
Je peux le faire seul.
Je peux commencer demain."
```

---

## 4. Structure des 10 sections (récapitulatif)

| # | Section | Contraintes one-shot |
|---|---|---|
| 0 | INTRODUCTION | 4-5 lignes, reformulation profil, ton rassurant, cadre simple |
| 1 | ANALYSE DU PROFIL | Objectif + problème principal + 2 secondaires max |
| 2 | STRATÉGIE NUTRITIONNELLE | 5 puces max, directes |
| 3 | PLAN ALIMENTAIRE | 1 journée type complète, portions en g/ml |
| 4 | ROTATION DES REPAS | 4 catégories max × 3-4 options |
| 5 | JOURNÉE ALTERNATIVE | 1 variante, cohérente |
| 6 | FICHE FRIGO | **PRIORITAIRE** — 4-6 règles, phrases courtes action directe |
| 7 | PROTOCOLES CIBLÉS | Max 3 — format `problème → action → bénéfice` en 1 phrase |
| 8 | AJUSTEMENTS ENVIRONNEMENTAUX | 3-4 max, concrets |
| 9 | RECOMMANDATIONS COACH | Bloc "À GARDER" (3) + bloc "À ÉVITER" (3) |
| 10 | CLÔTURE | Rassurante, autonomie, pas de dépendance |

**Différences notables vs. mode suivi :**
- **Pas de Plan d'Action S1→S4** (la timeline implique un suivi)
- **Pas de section "Ajustements pendant le plan"** (pas d'ajustement prévu)
- **Fiche frigo allégée** (4-6 lignes au lieu de 6-10)
- **Protocoles limités à 3** (au lieu de 5-6)

---

## 5. Fiche Frigo ONE SHOT — format cible

### Objectif
Créer une **mini-boussole quotidienne** que le client peut lire en 10 secondes sur son frigo.

### Format idéal (exemple)

```
FICHE FRIGO

• 3 repas fixes par jour — pas de saut de repas
• Protéines à chaque prise alimentaire
• Glucides toujours associés (jamais seuls)
• Collation à 16h si fringales ou stress
• Hydratation : minimum 1.5L (avant 18h)
• Dîner léger et digestible
```

### Règles strictes
- **4 à 6 lignes MAX** (pas 7, pas 10)
- Chaque ligne = **une action** concrète
- **Aucun blabla** explicatif
- Doit être **lisible en 10 secondes**
- Pas de jargon

### Astuce importante
👉 **La fiche frigo est LA section la plus importante en one-shot.**
C'est elle que le client va vraiment consulter au quotidien. Toutes les autres sections risquent d'être lues une fois puis oubliées. Elle mérite un soin particulier dans le prompt et dans le rendu PDF.

---

## 6. Règle de switch selon le mode client

### Côté code — logique cible

```js
// Dans NutritionConsultation.jsx (ou aiClient.js)
const SYSTEM_PROMPT = mode === 'oneshot'
  ? SYSTEM_PROMPT_ONESHOT
  : SYSTEM_PROMPT_FOLLOWUP;
```

### Où déterminer `mode` ?

Options à évaluer au moment de l'implémentation :

1. **Flag sur le profil client** (`client.subscription_type === 'oneshot' | 'followup'`)
2. **Case à cocher dans le formulaire de consultation** — Anissa choisit explicitement
3. **Détection auto** depuis l'existence de consultations antérieures (si c'est la 1ère et la dernière pour ce client → one-shot)
4. **Hybride** : flag par défaut sur le client, override manuel possible par Anissa

**Recommandation :** option 2 (checkbox explicite) pour la première version — Anissa garde le contrôle, pas de magie.

### Contrainte absolue
👉 **Ne jamais mélanger les deux prompts dans une même génération.**
Le système doit router vers UN SEUL prompt selon le mode. Pas de concaténation, pas de fallback croisé.

---

## 7. Points de vigilance UX / PDF

### UX
- **Indicateur visible** dans l'éditeur du mode actif (`ONE SHOT` ou `SUIVI`) pour qu'Anissa ne confonde pas
- Switch de mode **bloque la régénération** si un plan existe déjà (pour ne pas écraser un plan suivi avec un prompt one-shot)
- Dans le formulaire client, la checkbox oneshot doit être **claire** : "Bilan one-shot — pas de suivi prévu"

### PDF
- **Supprimer les sections inutilisées** en mode one-shot : pas de "Plan S1→S4", pas de "Ajustements pendant le plan"
- Le dispatcher `detectSectionType` n'a rien à changer (les sections présentes dans le plan sont les mêmes types, juste moins nombreuses)
- **Cover PDF** : pourrait afficher un petit badge "Bilan ONE SHOT" ou "Suivi 4 semaines" pour éviter toute confusion côté client
- **Fiche frigo** : rendu visuel déjà prêt (V68 premium), parfait pour le format 4-6 lignes condensé

### Risques à anticiper
- **Validation `validatePlanForPDF`** : elle exige actuellement certaines sections (probablement rotation, protocoles, etc.). En mode one-shot avec moins de contenu, il faut relâcher les règles pour ne pas bloquer l'export.
- **Scoring `scorePlanQuality`** : idem, ajuster les seuils pour one-shot ou bypasser.
- **`structurePlanSections`** : devrait fonctionner tel quel (parse le markdown généré), à vérifier avec un plan one-shot réel.

---

## 8. Checklist d'implémentation (quand on repartira)

Rangée par ordre de dépendance :

- [ ] **Ajouter le flag `mode` au client** (`oneshot` / `followup`) — schema Supabase + formulaire d'inscription
- [ ] **Créer `SYSTEM_PROMPT_ONESHOT`** dans `NutritionConsultation.jsx` à côté du prompt existant (renommer l'actuel en `SYSTEM_PROMPT_FOLLOWUP`)
- [ ] **Créer `ONESHOT_SUPPLEMENT_PROMPT`** (version allégée de `SUPPLEMENT_PROMPT`)
- [ ] **Router dans la génération** : `const prompt = mode === 'oneshot' ? SYSTEM_PROMPT_ONESHOT : SYSTEM_PROMPT_FOLLOWUP`
- [ ] **Adapter `validatePlanForPDF`** pour tolérer les sections manquantes en mode one-shot
- [ ] **Adapter `scorePlanQuality`** pour ne pas pénaliser l'absence de "Plan S1→S4" en one-shot
- [ ] **Afficher le mode dans l'éditeur** (badge en haut, ex: `ONE SHOT` doré / `SUIVI` vert)
- [ ] **Tester sur 3 profils one-shot** : le plan doit être lisible, la fiche frigo doit faire 4-6 lignes, aucune mention "on ajustera", autonomie complète.
- [ ] **Test PDF one-shot** : cover porte le bon badge, pas de section vide, format pro.
- [ ] **Documenter côté Anissa** : quand utiliser l'un, quand utiliser l'autre.

---

## 9. Décisions restant à prendre avec Benoit (avant implémentation)

1. **Checkbox explicite OU flag client OU hybride ?** (voir section 6)
2. **Badge "ONE SHOT" sur le PDF cover** — oui ou non ?
3. **Génération d'une fiche frigo PDF dédiée** en one-shot (une page séparée ultra-lisible imprimable) — ou est-ce que la fiche frigo du plan suffit ?
4. **Que faire si un client one-shot revient pour un suivi** — nouveau profil ? conversion du mode ?

---

## 10. Résultat attendu

| Mode | Livrable client |
|---|---|
| **ONE SHOT** | Plan simple, clair, autonome — le client comprend, le client peut, le client commence demain |
| **SUIVI** | Plan évolutif, stratégique, ajustable — le client progresse en collaboration avec Anissa |

---

*Fin du backlog. À rouvrir après clôture de la phase de stabilisation.*
