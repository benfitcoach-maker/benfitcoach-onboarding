-- ============================================================
-- V97.19.1 — clinical_guardrails_audit : policy INSERT authenticated
-- ============================================================
-- Prerequisite : V97.18 (table audit creee) + V97.18.3 (update policy).
-- Cf spec : spec-composer-v97-clinical-antislop.md (Phase 5 polish).
--
-- Contexte : V97.18 a cree clinical_guardrails_audit avec uniquement
-- une RLS read-only authenticated. Le cockpit UI V97.19 fait des
-- UPDATE sur la table principale mais ne loggait rien.
-- V97.19.1 ouvre l'INSERT aux authentifies pour que l'app puisse
-- ecrire l'historique des modifs (qui a change quoi, quand, diff).
--
-- ⚠️ APPLIQUER VIA SUPABASE DASHBOARD → SQL Editor → Run.
-- ============================================================

DROP POLICY IF EXISTS guardrails_audit_insert_authenticated ON clinical_guardrails_audit;

CREATE POLICY guardrails_audit_insert_authenticated
  ON clinical_guardrails_audit
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Note : pas d'UPDATE/DELETE sur l'audit (append-only log par design).

-- ============================================================
-- VERIFICATION
-- ============================================================
-- SELECT polname, polcmd, polroles::regrole[]
--   FROM pg_policy
--  WHERE polrelid = 'clinical_guardrails_audit'::regclass;
--
-- Attendu :
--   guardrails_audit_read_admin             | r (SELECT) | {authenticated}
--   guardrails_audit_insert_authenticated   | a (INSERT) | {authenticated}
-- ============================================================
