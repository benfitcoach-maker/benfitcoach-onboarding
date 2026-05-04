# Composer FR — guide de branchement

Procédure courte pour activer le composer profil-aware, ajouter un nouveau
module, et faire un test A/B en local avant production.

---

## 1. État actuel (V96.11)

- Le composer existe (`composer.fr.js`) avec 5 modules pilotes (`profiles/`).
- Il est **NON branché** dans `NutritionConsultation.jsx`.
- La génération en prod utilise toujours `buildSystemPromptFr` (path legacy).
- Aucune cliente d'Anissa n'est exposée tant que le branchement n'est pas fait.

## 2. Activer le composer (1 changement)

Dans `src/NutritionConsultation.jsx`, remplacer l'appel actuel à
`buildSystemPrompt(form, opts, client)` par une version qui passe l'option
`useComposer` :

```js
// AVANT (V96.11) :
system: buildSystemPrompt(form, {
  isFollowup, clientFormule, followupWeek, planMode,
}, client),

// APRÈS (activation composer FR) :
const promptResult = client && getClientNutritionLocale(client) === 'EN'
  ? { prompt: buildSystemPromptEn(form, opts), profile: null, blocked: false }
  : buildSystemPromptFrV2(form, {
      isFollowup, clientFormule, followupWeek, planMode,
    }, { useComposer: true });

if (promptResult.blocked) {
  // Cliente enceinte / allaitante sans module dédié → on stoppe net
  setError(`Profil "${promptResult.profile.blockReason}" non encore supporté. Génération bloquée par sécurité.`);
  return;
}

// puis utiliser promptResult.prompt à la place du system: actuel
```

⚠️ **Avant de brancher**, tester en local que toutes les clientes existantes
d'Anissa génèrent bien sans erreur. Faire un A/B sur 2-3 profils types.

## 3. Ajouter un nouveau module profil

### 3.a — créer le fichier
Dans `profiles/`, créer `<nomProfil>.fr.js` :

```js
// V96.X — Profile module : <nom du profil>.
// DRAFT — règles à valider avec Anissa.

export const <NOM_PROFIL>_MODULE_FR = `
ADAPTATION <NOM PROFIL> (priorite haute) :

<directives cliniques courtes, conservatrices, sans dosages chiffrés non
validés>

INTERDIT :
<garde-fous spécifiques au profil>
`;
```

### 3.b — enregistrer dans le registry
Dans `profiles/index.fr.js` :

```js
import { NOUVEAU_MODULE_FR } from './nouveauModule.fr';

export const PROFILE_MODULES_FR = {
  ...,
  nouveauModule: NOUVEAU_MODULE_FR,
};
```

### 3.c — câbler la détection
Dans `profiles/_detector.fr.js`, ajouter la règle qui retourne le tag dans
`primary` (si profil principal) ou `pathologies` (si comorbidité).

### 3.d — tester
Générer un plan pour une cliente correspondant au nouveau profil, vérifier
que le tag apparaît dans `profile.all`, et que le module est bien injecté
dans le prompt envoyé à Claude.

## 4. Garde-fous critiques (à NE PAS retirer)

- `detectClientProfile` peut retourner `blocked: true` (grossesse, allaitement
  tant qu'on n'a pas de modules dédiés). Le caller DOIT vérifier ce flag avant
  d'appeler Claude. Sinon, plan générique envoyé à une cliente à risque.
- Le module `diabete` interdit explicitement à l'IA de toucher aux dosages
  d'insuline. Ne JAMAIS retirer ce garde-fou — c'est le périmètre médecin.
- Les modules `menopause` / `perimenopause` interdisent toute prescription
  hormonale ou phytoestrogène en supplément sans avis médical.

## 5. Workflow A/B recommandé pour validation Anissa

1. Anissa choisit 3 clientes représentatives (ex : femme cycle SOPK, péri-ménopause
   stress, diabète T2).
2. Pour chacune, générer le plan **avec et sans** composer (changer le flag
   `useComposer` entre les 2 runs).
3. Comparer côte à côte. Anissa juge :
   - Le module-profil ajoute-t-il quelque chose de pertinent ?
   - Le ton reste-t-il « Anissa » ?
   - Les directives sont-elles cliniquement justes ?
4. Itérer sur le contenu des modules en fonction des feedbacks.
5. Quand 3 clientes/profils donnent satisfaction → activer en prod.

## 6. Fichiers concernés (lecture rapide)

| Fichier | Rôle |
|---|---|
| `composer.fr.js` | Assemble le prompt final |
| `profiles/_detector.fr.js` | Détecte les profils depuis `form` |
| `profiles/index.fr.js` | Registry des modules |
| `profiles/<nom>.fr.js` | Contenu d'un module |
| `fr.js` | Builders FR + `buildSystemPromptFrV2` (entry-point opt-in) |
| `NutritionConsultation.jsx` | Caller (à modifier pour brancher) |
