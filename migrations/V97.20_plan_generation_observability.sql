-- ============================================================
-- V97.20 — plan_generation_observability : tracking des générations
-- ============================================================
-- Cf chantier : OBS-1 (pre-requis avant V97.18 templates par phase).
--
-- Objectif : mesurer si la matrice clinical_guardrails aide vraiment
-- (% violations en baisse), si l'audit anti-slop est utilise par Anissa
-- (combien d'accept/refuse Haiku), et identifier les profils sous-couverts.
--
-- 1 row par generation de plan. Updates en cours de session pour les
-- compteurs slop_rewrites_accepted/refused (Anissa interagit apres
-- l'affichage initial).
--
-- ⚠️ APPLIQUER VIA SUPABASE DASHBOARD → SQL Editor → Run.
-- ============================================================

-- 1. Table principale
CREATE TABLE IF NOT EXISTS plan_generation_observability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Liens (consultation_id nullable car generation hors-conso possible)
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  consultation_id uuid,

  -- Horodatage + duree (timer Phase B observability V97.3)
  generated_at timestamptz NOT NULL DEFAULT now(),
  generation_duration_ms integer,

  -- Contexte LLM
  model text,
  composer_beta boolean NOT NULL DEFAULT false,

  -- Profil detecte (output detectClientProfile)
  detected_profile_tags text[] NOT NULL DEFAULT '{}',

  -- Garde-fous V97.x Phase 2
  guardrails_applied text[] NOT NULL DEFAULT '{}',
  violations_count integer NOT NULL DEFAULT 0,
  violations jsonb NOT NULL DEFAULT '[]'::jsonb,
  missing_micronutrients_count integer NOT NULL DEFAULT 0,
  missing_evictions_count integer NOT NULL DEFAULT 0,
  missing_required_count integer NOT NULL DEFAULT 0,

  -- Anti-slop V97.x Phase 3
  slop_flags_count integer NOT NULL DEFAULT 0,
  slop_flags_by_category jsonb NOT NULL DEFAULT '{}'::jsonb,
  slop_flags_by_severity jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Reformulation Haiku V97.x Phase 4 (updated en cours de session)
  slop_rewrites_requested_count integer NOT NULL DEFAULT 0,
  slop_rewrites_accepted_count integer NOT NULL DEFAULT 0,
  slop_rewrites_refused_count integer NOT NULL DEFAULT 0,

  -- Taille plan
  plan_length_chars integer
);

-- 2. RLS : authenticated peut lire et inserer/updater ses observations.
-- Lecture ouverte = Anissa peut voir l'historique de toutes les generations.
-- Insert/update ouverts = chaque cliente authentifiee (en pratique le SaaS
-- est utilise uniquement par Anissa, donc OK).
ALTER TABLE plan_generation_observability ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS obs_read_authenticated ON plan_generation_observability;
CREATE POLICY obs_read_authenticated
  ON plan_generation_observability
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS obs_insert_authenticated ON plan_generation_observability;
CREATE POLICY obs_insert_authenticated
  ON plan_generation_observability
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS obs_update_authenticated ON plan_generation_observability;
CREATE POLICY obs_update_authenticated
  ON plan_generation_observability
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- 3. Index utiles pour les queries aggregees futures
CREATE INDEX IF NOT EXISTS obs_client_idx
  ON plan_generation_observability (client_id);
CREATE INDEX IF NOT EXISTS obs_generated_at_idx
  ON plan_generation_observability (generated_at DESC);
CREATE INDEX IF NOT EXISTS obs_composer_beta_idx
  ON plan_generation_observability (composer_beta)
  WHERE composer_beta = true;

-- ============================================================
-- VERIFICATION
-- ============================================================
-- SELECT column_name, data_type FROM information_schema.columns
--  WHERE table_name = 'plan_generation_observability'
--  ORDER BY ordinal_position;
--
-- → 17 colonnes
--
-- SELECT count(*) FROM plan_generation_observability;
-- → 0 (table vide tant que pas de generation)
--
-- Queries d'analyse futures (a copier dans Studio pour mesurer) :
--
-- -- Volume mensuel + qualite generation
-- SELECT date_trunc('week', generated_at) AS week,
--        count(*) AS generations,
--        avg(violations_count) AS avg_violations,
--        avg(slop_flags_count) AS avg_slop_flags,
--        sum(slop_rewrites_accepted_count) AS haiku_accepts
--   FROM plan_generation_observability
--  GROUP BY week ORDER BY week DESC;
--
-- -- Top profils sous-couverts
-- SELECT g.profile_key, count(*) AS gen_with_missing
--   FROM plan_generation_observability o, unnest(o.guardrails_applied) AS g(profile_key)
--  WHERE o.missing_micronutrients_count + o.missing_evictions_count > 0
--  GROUP BY g.profile_key ORDER BY gen_with_missing DESC;
-- ============================================================
