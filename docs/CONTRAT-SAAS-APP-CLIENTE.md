# Contrat SaaS ↔ App cliente

> Document vivant. Décrit les invariants et limites connues du contrat entre le
> SaaS praticienne (`benfitcoach-onboarding`) et l'app cliente (`anissa-client-app`).
> Roadmap v1.0 « niveau éditeur » — tâche 1.3.

## Identité cliente : matching email + client_id (roadmap 1.2)

### Principe

Une cliente peut s'authentifier sur l'app cliente via Apple/Google avec un email
masqué (*hide-my-email*) différent de celui saisi dans le SaaS. L'email seul est
donc un matcher fragile. Le matcher robuste est **`client_id`** = l'id de la
ligne `clients` côté app cliente (stocké SaaS-side dans `staging_client_id`,
exposé en JS sous `client.stagingClientId`), connu une fois l'app activée.

Helper unique : `src/services/clientIdentity.js`
- `resolveClientIdentity(client)` → `{ email, clientId }`
- `clientIdentityFields(client)` → `{ email?, client_id? }` (n'ajoute que les
  clés connues, jamais de null) — à étaler dans chaque payload/query admin
- `hasClientIdentity(client)` → bool

### Contrat de déploiement (rétrocompatibilité)

Les deux repos ne sont jamais déployés à la même seconde. Le contrat rend
l'ordre des déploiements **indolore** :

1. **Le SaaS envoie TOUJOURS `email` ET `client_id`** quand les deux sont connus
   (jamais l'un *à la place* de l'autre).
2. **L'app cliente matche `client_id` en priorité, fallback `email`** — exactement
   le pattern déjà en place sur `/api/admin/clients-status`.
3. Tant que l'app cliente n'est **pas encore** mise à jour, elle ignore le champ
   `client_id` supplémentaire et continue de matcher par `email` → rien ne casse.
4. Une fois l'app cliente mise à jour, les clientes hide-my-email (email SaaS ≠
   email compte) deviennent matchables via `client_id`.

### Endpoints app cliente à adapter (repo `anissa-client-app`)

Tous suivent le même pattern que `clients-status` : **`client_id` prioritaire,
fallback `email`**. Le SaaS envoie déjà les deux champs depuis V97.40.

| Endpoint | Méthode | Champs identité reçus | Matching attendu |
| --- | --- | --- | --- |
| `/api/admin/client-feedbacks` | GET (query) | `email`, `client_id` | `client_id` → `clients.id`, sinon `email` |
| `/api/admin/client-config` | GET (query) | `email`, `client_id` | idem |
| `/api/admin/client-config` | POST (body) | `email`, `client_id` | idem |
| `/api/admin/client-signals` | POST (body) | `email`, `client_id` | idem |
| `/api/admin/client-journey-status` | POST (body) | `email`, `client_id` | idem |
| `/api/admin/push/send` | POST (body) | `email`, `client_id` | déjà supporté (V94.66) — vérifier que `email` reste un fallback valide |

Note : `/api/admin/clients-status` est **déjà** au bon pattern (référence), ne
rien y changer.

---

## Pipeline `pending_protocol_phases` (roadmap 1.1)

### Principe

Une cliente peut atteindre la page Suivi **sans aucune `nutrition_consultation`**
(ex. pack Bilan Nutritionnel, 0/1 consultation). Si Anissa accepte un parcours de
phases dans ce contexte, il n'existe aucune consultation hôte pour porter
`protocol_phases`. Les phases sont alors stockées **en attente** dans
`journey_state.pending_protocol_phases` (JSONB, aucune migration SQL requise —
`updateJourneyState` préserve les clés arbitraires).

Dès qu'une consultation hôte apparaît (n'importe quel chemin de création :
éditeur de plan, « Créer la suite », import…), les phases en attente sont
**greffées** sur cette consultation puis le champ pending est nettoyé.

### Invariants

1. **Le store ne peut pas héberger le transfert.** `store.js` est synchrone,
   localStorage-first, et n'a aucun accès à `journey_state` (Supabase-only, async).
   Le transfert est donc centralisé côté composant via un helper pur
   `bakePendingProtocolPhases()` (`src/services/protocolPhases.js`) appelé depuis
   un unique effet « bake » dans `StepFollowup`.

2. **Idempotence — jamais d'écrasement.** Double garde :
   - `bakePendingProtocolPhases` retourne `{ baked: false }` si la consultation
     porte déjà `protocol_phases` (la consultation hôte gagne toujours).
   - L'effet bake early-return si `activeConsult.protocol_phases` est déjà défini.

   Re-bake après échec partiel du nettoyage : si `clearPendingProtocolPhases`
   échoue, la consultation porte déjà les phases (persistées avant la tentative de
   clear) → la garde bloque toute ré-application. Le champ pending résiduel est
   inerte. Au pire, le même `pendingPhases` est ré-appliqué à l'identique.

3. **Pas de push de transition à la greffe.** La greffe est une *initialisation*
   du parcours (aucune phase précédente côté cliente), pas une transition de
   phase. Le push notif cliente ne se déclenche que dans `handleSavePhases` lors
   d'une vraie transition (deux `active_phase_id` non-null différents).

### Limite connue : bake au montage de `StepFollowup`

L'effet de greffe vit dans le composant `StepFollowup` (page Suivi). **La greffe
ne se produit donc que lorsque Anissa ouvre/affiche la page Suivi** de la cliente
concernée, pas au moment exact où la consultation est créée si la création a lieu
ailleurs (ex. éditeur de plan sur une autre vue).

Conséquence pratique : entre la création de la consultation et la prochaine visite
de la page Suivi, `pending_protocol_phases` reste posé et `protocol_phases` n'est
pas encore sur la consultation. C'est **sans impact fonctionnel** :
- la carte parcours lit `consultation?.protocol_phases || pendingPhases`, donc
  l'affichage reste correct des deux côtés de la greffe ;
- la greffe est convergente et idempotente — elle s'exécutera au plus tard à la
  prochaine ouverture de la page Suivi.

Si un jour la création de consultation doit déclencher la greffe *immédiatement*
quel que soit le point d'entrée, il faudra remonter l'effet bake plus haut dans
l'arbre (ou le déclencher depuis le store via un mécanisme async dédié), au prix
de la simplicité actuelle. Décision reportée tant qu'aucun besoin réel ne l'exige.
