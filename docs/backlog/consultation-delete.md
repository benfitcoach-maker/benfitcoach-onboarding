# Backlog — Suppression d'une consultation (soft delete)

**Statut :** BACKLOG — à ne PAS implémenter pendant la phase de stabilisation. À rouvrir après clôture QA 3 profils.

**Date de dépôt :** 2026-04-20
**Proposé par :** Benoit
**Décision métier déjà posée :** soft delete uniquement. Pas de hard delete par défaut.

---

## 1. Contexte & besoin

Aujourd'hui une consultation créée dans l'app ne peut pas être supprimée. Si Anissa :
- crée une consultation par erreur (mauvaise cliente, doublon)
- veut annuler une consultation de test
- veut masquer une consultation obsolète (ex: une version remplacée par une nouvelle)

…elle doit vivre avec dans l'historique.

**Besoin :** pouvoir "supprimer" côté UX, sans perdre la donnée côté base. Le soft delete est la bonne approche pour ne pas risquer de perte irréversible.

---

## 2. Décision métier

### ✅ Soft delete — retenu
- `is_deleted: true`
- `deleted_at: timestamp`
- `deleted_by: user_id` (ou email Anissa)
- Donnée conservée physiquement en base
- Masquée dans toutes les listes UI par défaut
- Restaurable par un utilisateur admin (Benoit)

### ❌ Hard delete — refusé pour V1
- Trop risqué (suppression définitive)
- Impact potentiel sur les historiques de progression, les suivis des clientes
- Pourra être ajouté plus tard comme "purge admin" avec double confirmation

---

## 3. Structure de données

### Colonnes à ajouter à la table `consultations` (Supabase)

```sql
ALTER TABLE consultations
  ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE,
  ADD COLUMN deleted_at TIMESTAMPTZ,
  ADD COLUMN deleted_by TEXT;  -- email ou user_id selon convention existante

CREATE INDEX idx_consultations_is_deleted ON consultations(is_deleted) WHERE is_deleted = FALSE;
```

**Note :** l'index partiel `WHERE is_deleted = FALSE` accélère les lectures "non supprimées" (cas 99% du temps) sans alourdir les écritures.

### Options alternatives (à évaluer)
- **Status enum** `status: 'active' | 'deleted' | 'archived'` au lieu d'un booléen — plus extensible si un jour on veut distinguer "archivé" de "supprimé".
- **Table séparée** `consultations_deleted` — plus lourde à gérer, non retenue pour V1.

---

## 4. UX attendue

### Bouton "Supprimer"
- Emplacement : dans l'éditeur de consultation, section "Outils avancés" (pas trop visible pour éviter clic accidentel).
- Icône poubelle + label "Supprimer cette consultation".
- Couleur rouge discrète (déjà utilisée dans l'app pour `handleResetAll`).

### Confirmation obligatoire
- Modal : "Cette consultation sera masquée. Tu pourras la restaurer depuis les archives si besoin. Confirmer la suppression ?"
- Boutons : **Annuler** / **Supprimer**
- **Pas de delete direct au clic** — toujours passer par la modal.

### Après suppression
- Toast : "Consultation supprimée. Voir les archives pour restaurer."
- Redirection vers la liste des consultations de la cliente.
- La consultation disparaît de la liste.

### Liste "Archives" (optionnelle V1, recommandée V2)
- Vue filtrée `is_deleted = true`.
- Accessible uniquement par admin Benoit (via toggle "Afficher archivées" dans les paramètres ou une page dédiée).
- Chaque ligne : titre, date, cliente, date de suppression, bouton **Restaurer**.

### Restauration
- Bouton **Restaurer** dans la liste archives.
- Modal de confirmation.
- Set `is_deleted = false`, `deleted_at = NULL`, `deleted_by = NULL`.
- Toast : "Consultation restaurée."

---

## 5. Comportements attendus

### Par défaut (mode normal)
- Toutes les listes (dashboard Anissa, historique cliente, stats) filtrent `is_deleted = false`.
- Les exports PDF de consultations supprimées doivent être bloqués (ou afficher un warning "Consultation archivée").
- Les stats / chiffres (dashboard Anissa) excluent les consultations supprimées.

### Mode admin (Benoit)
- Toggle "Afficher archivées" disponible.
- Peut voir + restaurer.
- Pas de hard delete exposé dans l'UI V1.

### Reads directs en base
- Toujours ajouter `WHERE is_deleted = false` dans les requêtes "normales".
- ⚠️ Risque principal : oublier ce filtre dans une nouvelle requête → consultation supprimée réapparaît quelque part.

---

## 6. Impacts potentiels

### Code applicatif à auditer
Toutes les requêtes Supabase qui lisent la table `consultations` doivent être revues pour ajouter `.eq('is_deleted', false)` (ou équivalent) :

- `AnissaDashboard.jsx` — liste des consultations du jour
- `NutritionHistory.jsx` — historique par cliente
- `ProgressionPanel.jsx` — courbes de progression (exclure consultations supprimées ?)
- `AnissaChiffres.jsx` — statistiques business (exclure des revenus ?)
- `BusinessDashboard.jsx` — idem
- `CycleReviewPanel.jsx`, `MassageSessionPanel.jsx` — consultations liées massage/cycle
- `services/aiClient.js` — recherche de consultations précédentes pour contextualiser l'IA

### Filtres et exports
- Les exports "dossier client complet" doivent-ils inclure les consultations supprimées ? Probablement non.
- Les messages template aux clientes ("derniere consultation du...") doivent ignorer les supprimées.

### Progression / historique
- Si une consultation supprimée est référencée par une followup (via `_prevPoids`, `_prevTourTaille` etc. dans `followupData`), la restauration doit "réactiver" la chaîne.
- ⚠️ Risque : supprimer une consultation sur laquelle une autre s'appuie casse la continuité. Faut-il bloquer la suppression dans ce cas ou l'autoriser avec warning ?

---

## 7. Risques techniques

| Risque | Mitigation |
|---|---|
| Oubli d'un filtre `is_deleted = false` dans une requête → donnée supprimée réapparaît | Audit exhaustif du code (grep `from('consultations')`) + tests de non-régression. Potentiellement : créer une vue `consultations_active` qui filtre automatiquement, et pointer tout le code dessus. |
| RLS Supabase — les policies actuelles doivent être mises à jour pour prendre en compte `is_deleted` | Mettre à jour chaque policy SELECT avec `AND is_deleted = false` sauf pour admin. Documenter dans le SQL schema. |
| Une consultation supprimée référencée par une followup plus récente casse le calcul de progression | Soit : bloquer la suppression si référencée. Soit : au soft delete, nullifier les `_prevXxx` de la followup concernée. À décider. |
| `scorePlanQuality` apprentissage ML (`getLearningInsights`) peut inclure des consultations supprimées dans son historique | Filtrer `is_deleted = false` à la source. |
| Anissa supprime par erreur une consultation importante | Confirmation obligatoire + bouton restaurer accessible. Pas de suppression silencieuse. |

---

## 8. Architecture probable

### Backend
```sql
-- Migration Supabase
ALTER TABLE consultations
  ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE NOT NULL,
  ADD COLUMN deleted_at TIMESTAMPTZ,
  ADD COLUMN deleted_by TEXT;

CREATE INDEX idx_consultations_is_deleted ON consultations(is_deleted) WHERE is_deleted = FALSE;

-- Mettre à jour les RLS policies (exemple)
DROP POLICY IF EXISTS "users_read_own_consultations" ON consultations;
CREATE POLICY "users_read_own_consultations" ON consultations
  FOR SELECT USING (user_id = auth.uid() AND is_deleted = FALSE);

-- Policy admin pour voir les supprimées
CREATE POLICY "admin_read_all_consultations" ON consultations
  FOR SELECT USING (is_admin(auth.uid()));
```

### Frontend
- Helper `softDeleteConsultation(id)` dans `store.js` ou `services/supabaseClient.js` :
  ```js
  async function softDeleteConsultation(id) {
    return supabase
      .from('consultations')
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
        deleted_by: currentUser.email,
      })
      .eq('id', id);
  }
  ```
- Helper `restoreConsultation(id)` symétrique.
- Bouton "Supprimer" dans `NutritionConsultation.jsx` (section outils avancés) ou dans la liste du dashboard.
- Vue archives dans `AnissaDashboard.jsx` avec toggle.

### Store / cache React
- Au succès d'un soft delete, retirer la consultation de la liste locale (setConsultations(prev => prev.filter(c => c.id !== id))).
- Au succès d'une restauration, la réinjecter ou forcer un refetch.

---

## 9. Checklist d'implémentation

Ordonnée par dépendance.

### Migration DB (étape bloquante)
- [ ] Écrire la migration SQL (colonnes + index + policies).
- [ ] La tester sur un env staging Supabase avant prod.
- [ ] Appliquer en prod, vérifier que les requêtes existantes continuent de fonctionner (colonne default = false).

### Backend helpers
- [ ] Ajouter `softDeleteConsultation(id)` et `restoreConsultation(id)` dans le store.
- [ ] Ajouter `listDeletedConsultations()` pour la vue archives.

### Audit des requêtes existantes
- [ ] Grep `from('consultations')` et ajouter `.eq('is_deleted', false)` partout (ou créer une vue SQL et migrer).
- [ ] Lister les écrans impactés (voir section 6).
- [ ] Tester chacun après modification.

### UX — suppression
- [ ] Bouton "Supprimer cette consultation" dans l'éditeur (section outils avancés).
- [ ] Modal de confirmation.
- [ ] Toast de succès + redirection.

### UX — restauration (V2 mais peut être ajouté en V1 si rapide)
- [ ] Toggle "Afficher archivées" dans le dashboard (réservé admin).
- [ ] Bouton "Restaurer" sur chaque ligne archivée.
- [ ] Modal de confirmation.

### Tests
- [ ] Soft delete d'une consultation → elle disparaît de toutes les listes.
- [ ] Consultation soft-deleted → pas d'impact sur les autres consultations de la cliente.
- [ ] Consultation soft-deleted référencée par une followup → vérifier le comportement (warning ou blocage).
- [ ] Restauration → tout revient à la normale.
- [ ] Stats business excluent bien les supprimées.

---

## 10. Décisions en suspens

1. **Booléen vs enum status** — `is_deleted` booléen suffit pour V1, ou partir direct sur `status: 'active'|'deleted'|'archived'` pour être future-proof ?
2. **Qui peut supprimer ?** — seulement Anissa (propriétaire) ? Benoit admin aussi ? Les deux ? Par défaut : seulement Anissa pour les siennes, Benoit pour tout.
3. **Que faire si une followup référence la consultation supprimée ?**
   - Option A : bloquer la suppression avec warning ("Cette consultation est référencée par la consultation de suivi du 12/03/2026. Impossible de supprimer.")
   - Option B : autoriser la suppression, nullifier les `_prevXxx` de la followup, warning côté UI.
   - Option C : "cascade soft delete" — supprimer aussi les followups qui en dépendent (dangereux).
4. **Restauration en V1 ou V2 ?** — si V1, scope +30min. Si V2, Benoit devra restaurer en SQL direct en attendant.
5. **Durée de rétention des supprimées** — conservées indéfiniment ? Purge auto après 12 mois ?
6. **Hard delete admin** — à prévoir dans la roadmap ultérieure ou pas besoin ?

---

## 11. Résultat attendu

Le workflow idéal après V1 :

```
Anissa crée une consultation par erreur
 └─> Ouvre la consultation
     └─> Outils avancés → Supprimer
         └─> Modal "Confirmer ?"
             └─> Clic Supprimer
                 └─> Toast succès + retour liste
                     └─> Consultation absente de toutes les vues
                         └─> Si besoin plus tard : Benoit restaure en admin
```

Gain : plus de peur de "faire une bêtise irréversible", tout est récupérable.

---

*Fin du backlog. À rouvrir après clôture de la phase de stabilisation.*
