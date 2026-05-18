-- ============================================================
-- V97.23 — plan_drafts_pending_review : brouillons IA en attente validation
-- ============================================================
-- Cf chantier : V97.18 hybride templates par phase (Phase E).
-- Cf strategy : strategy_v97_18_hybride_phase_templates.md (2026-05-16 soir).
--
-- Use case principal : a chaque transition de phase, le SaaS lance
-- automatiquement une generation IA (Sonnet) avec le contexte de la
-- nouvelle phase active. Le brouillon est stocke ici, en attente que
-- Anissa le valide (accept → devient une consultation) ou le refuse
-- (status = 'refused', pas push a la cliente).
--
-- Permet aussi des declenchements manuels (Anissa click "Generer brouillon
-- pour cette phase" dans le cockpit).
--
-- ⚠️ APPLIQUER VIA SUPABASE DASHBOARD → SQL Editor → Run.
-- ============================================================

CREATE TABLE IF NOT EXISTS plan_drafts_pending_review (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Liens
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  source_consultation_id uuid,   -- consultation qui a declenche la transition

  -- Contenu du draft
  draft_text text NOT NULL,
  draft_length_chars integer,

  -- Metadata de generation (pour diff + replay)
  source text NOT NULL CHECK (source IN ('auto_phase_transition', 'manual', 'other')),
  trigger_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- shape attendue : { from_phase_id?, to_phase_id?, template_key?, generation_duration_ms?, model? }

  -- Workflow
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'refused', 'expired')),
  reviewed_at timestamptz,
  reviewed_by text,
  review_note text,   -- raison du refuse / commentaire accept (optionnel)

  -- Audit
  generated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE plan_drafts_pending_review ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS drafts_read_authenticated ON plan_drafts_pending_review;
CREATE POLICY drafts_read_authenticated
  ON plan_drafts_pending_review
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS drafts_insert_authenticated ON plan_drafts_pending_review;
CREATE POLICY drafts_insert_authenticated
  ON plan_drafts_pending_review
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS drafts_update_authenticated ON plan_drafts_pending_review;
CREATE POLICY drafts_update_authenticated
  ON plan_drafts_pending_review
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Pas de DELETE policy : un draft accept devient une consultation, un draft
-- refused reste pour audit/history. Eventuellement un cron expire les
-- pending > 30 jours en status = 'expired'.

-- Index pour queries futures
CREATE INDEX IF NOT EXISTS drafts_client_status_idx
  ON plan_drafts_pending_review (client_id, status, generated_at DESC);
CREATE INDEX IF NOT EXISTS drafts_pending_idx
  ON plan_drafts_pending_review (status, generated_at DESC)
  WHERE status = 'pending';

-- ============================================================
-- VERIFICATION
-- ============================================================
-- SELECT column_name, data_type FROM information_schema.columns
--  WHERE table_name = 'plan_drafts_pending_review' ORDER BY ordinal_position;
--
-- SELECT count(*) FROM plan_drafts_pending_review WHERE status = 'pending';
-- → drafts a valider par Anissa
--
-- Query analyse :
-- SELECT source, status, count(*) FROM plan_drafts_pending_review
--  GROUP BY source, status ORDER BY source, status;
-- ============================================================
