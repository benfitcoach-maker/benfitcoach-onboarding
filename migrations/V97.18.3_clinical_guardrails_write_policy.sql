-- ============================================================
-- V97.18.3 — clinical_guardrails : policy UPDATE pour authenticated
-- ============================================================
-- Prerequisite : V97.18 + V97.18.1 appliquees.
-- Cf spec : spec-composer-v97-clinical-antislop.md (Phase 5 UI cockpit).
--
-- Contexte : V97.18 a cree une RLS read-only pour authenticated.
-- L'edition se faisait uniquement via service_role (Anissa via Studio).
-- V97.18.3 ouvre l'UPDATE aux praticiens authentifies pour que le
-- nouveau cockpit UI dans le SaaS puisse modifier les regles sans
-- passer par Studio.
--
-- SECURITE : Le SaaS n'expose le panel qu'a Anissa (auth-gated).
-- Si jamais d'autres praticiens utilisent le SaaS, l'edition partagee
-- est OK car la table est un seed metier global (pas par cliente).
--
-- ⚠️ APPLIQUER VIA SUPABASE DASHBOARD → SQL Editor → Run.
-- ============================================================

-- Drop si existe (idempotent)
DROP POLICY IF EXISTS guardrails_update_authenticated ON clinical_guardrails;

-- Allow UPDATE for any authenticated user
CREATE POLICY guardrails_update_authenticated
  ON clinical_guardrails
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Note : on n'ouvre PAS INSERT/DELETE.
-- Les 7 profils sont seedes (V97.18.1) et la liste est figee cote code
-- (detectClinicalGuardrails dans _clinicalGuardrails.fr.js connait
-- explicitement les 7 cles). Ajouter un 8e profil = changement code +
-- migration + seed, pas une simple INSERT runtime.
-- Pour "supprimer" un profil, Anissa toggle enabled = false dans l'UI.

-- ============================================================
-- VERIFICATION
-- ============================================================
-- SELECT polname, polcmd, polroles::regrole[]
--   FROM pg_policy
--  WHERE polrelid = 'clinical_guardrails'::regclass;
--
-- Attendu :
--   guardrails_read_all_authenticated   | r (SELECT) | {authenticated}
--   guardrails_update_authenticated     | w (UPDATE) | {authenticated}
-- ============================================================
