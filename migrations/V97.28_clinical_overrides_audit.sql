-- ============================================================
-- V97.28 — clinical_overrides_audit : traçabilité des overrides cliniques
-- ============================================================
-- Lot 2 du chantier clairance clinique (clinicalClearance.js).
--
-- Contexte : les 4 portes de sortie d'un plan (Adopter / export Word /
-- Fiche frigo / publication app) sont gardées par assertPlanClinicallyCleared.
-- Sur une violation HIGH (allergène déclaré, phrase interdite, interaction
-- bloquante, cliente mineure), Anissa peut forcer la porte via un override
-- conscient (window.confirm). Jusqu'ici cet override ne laissait AUCUNE trace.
--
-- Cette table journalise QUI a forcé, QUAND, par QUELLE porte, et SUR QUEL
-- verdict (snapshot complet des violations vues au moment du confirm).
--
-- Append-only par design : SELECT + INSERT pour authenticated, jamais
-- UPDATE/DELETE (même logique que clinical_guardrails_audit, V97.18/V97.19.1).
--
-- ⚠️ OPÉRATION PUREMENT ADDITIVE : CREATE TABLE IF NOT EXISTS, idempotente,
--    aucun ALTER/DROP/UPDATE sur une table existante, aucune donnée touchée.
--    Rollback trivial : DROP TABLE IF EXISTS clinical_overrides_audit;
--
-- ⚠️ APPLIQUER VIA SUPABASE DASHBOARD → SQL Editor → Run.
-- Sur projet : Benfitcoach (SaaS prod).
-- ============================================================

-- 1. Création table (idempotent — IF NOT EXISTS)
CREATE TABLE IF NOT EXISTS clinical_overrides_audit (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       uuid,                       -- nullable, PAS de FK (cf. note ci-dessous)
  consultation_id uuid,                       -- nullable (Adopter brouillon non persisté, export synthétique)
  door            text NOT NULL CHECK (door IN ('adopt', 'export_word', 'fiche_frigo', 'publish_app')),
  severity        text,                       -- 'high' (un override ne survient que sur bloquant)
  violation_types text[],                     -- ex. ['minor','allergen'] — extrait de verdict.violations[].type
  verdict         jsonb,                      -- snapshot complet { violations, warnings } vu par Anissa
  overridden_by   text,                       -- email || id de getCurrentUser() (null si auth indisponible)
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Note FK volontairement absente sur client_id / consultation_id :
-- un log clinique ne doit JAMAIS échouer pour une raison d'intégrité
-- relationnelle (consultation supprimée, brouillon non encore persisté…).
-- On stocke l'UUID brut. Tracer ne doit jamais bloquer Anissa.

-- 2. RLS — append-only pour authenticated
ALTER TABLE clinical_overrides_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS overrides_audit_read_authenticated ON clinical_overrides_audit;
CREATE POLICY overrides_audit_read_authenticated
  ON clinical_overrides_audit FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS overrides_audit_insert_authenticated ON clinical_overrides_audit;
CREATE POLICY overrides_audit_insert_authenticated
  ON clinical_overrides_audit FOR INSERT TO authenticated WITH CHECK (true);

-- Pas de policy UPDATE/DELETE : append-only log par design.

-- ── Rollback (si jamais) ────────────────────────────────────
-- DROP TABLE IF EXISTS clinical_overrides_audit;
