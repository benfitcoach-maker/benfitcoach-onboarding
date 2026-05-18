-- ============================================================
-- V97.18 — clinical_guardrails : matrice de garde-fous cliniques
-- ============================================================
-- Cf spec : spec-composer-v97-clinical-antislop.md
-- Trigger : audit plan Hawazen (grossesse T2 + TDAH) avec 2 phrases
-- medicales a risque ("eviter tes injections", "plus efficace que les
-- comprimes").
--
-- Architecture : table seed (pas par cliente). Anissa peut editer les
-- regles via Supabase studio dans un premier temps. UI cockpit en V97.19+.
--
-- Etat actuel : module JS hardcode dans services/prompts/nutrition/
-- _clinicalGuardrails.fr.js (Phase 1+2 du chantier). Cette migration
-- prepare la table sans la peupler — le code continue de lire depuis le
-- module JS jusqu'a ce qu'Anissa valide la migration vers DB.
--
-- Apres acceptation Anissa des regles JS :
--   1. Appliquer cette migration
--   2. Seed la table depuis le module JS (script seed dedie)
--   3. Migrer _clinicalGuardrails.fr.js pour lire depuis Supabase
--
-- ⚠️ APPLIQUER VIA SUPABASE DASHBOARD → SQL Editor → Run.
-- Sur projet : Benfitcoach (SaaS prod).
-- ============================================================

-- 1. Creation table (idempotent — IF NOT EXISTS)
CREATE TABLE IF NOT EXISTS clinical_guardrails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_key text UNIQUE NOT NULL,
  display_name text NOT NULL,
  detection_rule jsonb NOT NULL DEFAULT '{}'::jsonb,
  forbidden_phrases text[] NOT NULL DEFAULT '{}',
  required_phrases text[] NOT NULL DEFAULT '{}',
  micronutrients text[] NOT NULL DEFAULT '{}',
  evictions text[] NOT NULL DEFAULT '{}',
  precaution_vocab jsonb NOT NULL DEFAULT '{}'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. RLS : tous les praticiens authentifies peuvent lire (cote app),
-- ecriture admin (seed manuel Anissa via studio).
ALTER TABLE clinical_guardrails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS guardrails_read_all_authenticated ON clinical_guardrails;
CREATE POLICY guardrails_read_all_authenticated
  ON clinical_guardrails
  FOR SELECT
  TO authenticated
  USING (true);

-- Pas de policy INSERT/UPDATE/DELETE par defaut → seul le service_role
-- (admin Supabase studio) peut ecrire. Anissa edite via studio.

-- 3. Audit log : tracer les changements de guardrails (debug + compliance).
CREATE TABLE IF NOT EXISTS clinical_guardrails_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guardrail_id uuid REFERENCES clinical_guardrails(id) ON DELETE SET NULL,
  profile_key text NOT NULL,
  action text NOT NULL CHECK (action IN ('insert', 'update', 'delete')),
  changed_by text,
  diff jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE clinical_guardrails_audit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS guardrails_audit_read_admin ON clinical_guardrails_audit;
CREATE POLICY guardrails_audit_read_admin
  ON clinical_guardrails_audit
  FOR SELECT
  TO authenticated
  USING (true);

-- 4. Index utiles pour future query par profile_key
CREATE INDEX IF NOT EXISTS clinical_guardrails_profile_key_idx
  ON clinical_guardrails (profile_key)
  WHERE enabled = true;

-- ============================================================
-- VERIFICATION post-migration
-- ============================================================
-- SELECT column_name, data_type FROM information_schema.columns
--  WHERE table_name = 'clinical_guardrails' ORDER BY ordinal_position;
--
-- Doit retourner :
--   id, profile_key, display_name, detection_rule, forbidden_phrases,
--   required_phrases, micronutrients, evictions, precaution_vocab,
--   enabled, created_at, updated_at
--
-- SELECT count(*) FROM clinical_guardrails;
-- Resultat attendu : 0 (table vide tant que seed pas execute)
-- ============================================================
