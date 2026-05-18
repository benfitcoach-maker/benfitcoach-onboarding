-- ============================================================
-- V97.22 — phase_recommendations : recommandations editables par phase
-- ============================================================
-- Cf chantier : V97.18 hybride templates par phase (Phase A : data model).
-- Cf source canonique JS : src/services/protocolPhases.js (TEMPLATE_*).
-- Cf memory : strategy_v97_18_hybride_phase_templates.md (2026-05-16 soir).
--
-- Architecture similaire a clinical_guardrails :
--   - 1 row par (template_key, phase_id) → cle composite UNIQUE pour
--     INSERT idempotent ON CONFLICT.
--   - Recommendations editables par Anissa (foods_favor, supplements, etc.).
--   - JS hardcode reste source of truth tant que migration JS → DB pas faite.
--
-- ⚠️ APPLIQUER VIA SUPABASE DASHBOARD → SQL Editor → Run.
-- ============================================================

-- 1. Table principale
CREATE TABLE IF NOT EXISTS phase_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identifiants composites
  template_key text NOT NULL,    -- 'microbiote_5_phases' | 'microbiote_3_phases' | etc.
  phase_id text NOT NULL,         -- 'p1' | 'p2' | etc.
  phase_order integer NOT NULL,   -- 1..N pour ordre d'affichage

  -- Identite affichee
  client_name text NOT NULL,      -- 'Apaisement digestif' (vu par cliente)
  clinical_name text NOT NULL,    -- 'Eradication' (interne pratiien)

  -- Recommandations (tableaux + jsonb pour structure riche)
  foods_favor text[] NOT NULL DEFAULT '{}',
  foods_limit text[] NOT NULL DEFAULT '{}',
  cooking text[] NOT NULL DEFAULT '{}',
  cooking_avoid text[] NOT NULL DEFAULT '{}',
  -- supplements : [{ name, dose, timing }, ...]
  supplements jsonb NOT NULL DEFAULT '[]'::jsonb,
  clinical_notes text NOT NULL DEFAULT '',

  -- Toggle d'activation par phase (utile si Anissa veut desactiver une phase)
  enabled boolean NOT NULL DEFAULT true,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE(template_key, phase_id)
);

-- 2. RLS : authenticated SELECT + INSERT + UPDATE.
-- Pattern identique aux clinical_guardrails (Anissa edite via UI cockpit).
ALTER TABLE phase_recommendations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS phase_reco_read_authenticated ON phase_recommendations;
CREATE POLICY phase_reco_read_authenticated
  ON phase_recommendations
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS phase_reco_update_authenticated ON phase_recommendations;
CREATE POLICY phase_reco_update_authenticated
  ON phase_recommendations
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS phase_reco_insert_authenticated ON phase_recommendations;
CREATE POLICY phase_reco_insert_authenticated
  ON phase_recommendations
  FOR INSERT TO authenticated WITH CHECK (true);

-- Pas de DELETE policy : pour "supprimer" une phase, Anissa toggle enabled=false.

-- 3. Audit log (analogue clinical_guardrails_audit)
CREATE TABLE IF NOT EXISTS phase_recommendations_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id uuid REFERENCES phase_recommendations(id) ON DELETE SET NULL,
  template_key text NOT NULL,
  phase_id text NOT NULL,
  action text NOT NULL CHECK (action IN ('insert', 'update', 'delete')),
  changed_by text,
  diff jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE phase_recommendations_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS phase_reco_audit_read_authenticated ON phase_recommendations_audit;
CREATE POLICY phase_reco_audit_read_authenticated
  ON phase_recommendations_audit
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS phase_reco_audit_insert_authenticated ON phase_recommendations_audit;
CREATE POLICY phase_reco_audit_insert_authenticated
  ON phase_recommendations_audit
  FOR INSERT TO authenticated WITH CHECK (true);

-- 4. Index pour queries futures
CREATE INDEX IF NOT EXISTS phase_reco_template_idx
  ON phase_recommendations (template_key, phase_order)
  WHERE enabled = true;

-- ============================================================
-- VERIFICATION post-migration
-- ============================================================
-- SELECT column_name, data_type FROM information_schema.columns
--  WHERE table_name = 'phase_recommendations' ORDER BY ordinal_position;
--
-- SELECT count(*) FROM phase_recommendations;
-- → 0 tant que seed V97.22.1 pas execute
-- ============================================================
