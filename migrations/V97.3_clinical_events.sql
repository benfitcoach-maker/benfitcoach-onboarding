-- ============================================================
-- V97.3 — Couche observabilité clinique (clinical_events)
-- ============================================================
-- Date : 2026-05-12
--
-- Append-only log des événements métier qui se produisent dans le
-- parcours clinique d'Anissa. Capture le raisonnement réel :
-- - transitions d'étapes (où le temps passe)
-- - générations IA (coût, durée, prompts)
-- - modifications du plan (source : ai|practitioner|hybrid + reason)
--
-- Architecture :
-- - append-only (jamais d'UPDATE, jamais de DELETE)
-- - timestamp obligatoire (created_at)
-- - payload jsonb pour flexibilité (chaque event_type a son schema en JS)
-- - RLS auth-only (cohérent V96.36 hardening)
--
-- Pas de PostHog / Mixpanel. Table Supabase directe. Le but n'est pas
-- d'analyser les clics — c'est de capturer la logique clinique réelle
-- d'Anissa pour pouvoir l'apprendre plus tard.
--
-- ⚠️ APPLIQUER VIA SUPABASE DASHBOARD → SQL Editor → Run.
-- Sur projet : anwfvgzldnfspcmwqxwy (SaaS prod).
-- ============================================================

-- 1. Table principale
CREATE TABLE IF NOT EXISTS clinical_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Qui (toujours Anissa pour l'instant — auth.uid())
  practitioner_id uuid NOT NULL REFERENCES auth.users(id),

  -- Quoi (free-form string géré côté JS via EVENT_TYPES)
  -- Ex: 'step_transition', 'plan_generated', 'plan_modification'
  event_type text NOT NULL,

  -- Sur qui / quoi (nullable car certains events sont globaux)
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  consultation_id uuid,  -- pas de FK car nutrition_consultations
                         -- peut être supprimée mais on garde l'event

  -- Données spécifiques au type d'event (validation côté JS)
  -- Ex pour step_transition : { from_step, to_step, duration_ms_in_previous }
  -- Ex pour plan_generated : { duration_ms, tokens, model, composer_beta }
  -- Ex pour plan_modification : { section, source, reason_code, before_len, after_len }
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Timestamp serveur (jamais client — sinon faussable)
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Index pour les queries les plus probables
-- (filtre par praticien + tri chrono)
CREATE INDEX IF NOT EXISTS clinical_events_practitioner_idx
  ON clinical_events (practitioner_id, created_at DESC);

-- Filtre par cliente (timeline d'une cliente)
CREATE INDEX IF NOT EXISTS clinical_events_client_idx
  ON clinical_events (client_id, created_at DESC)
  WHERE client_id IS NOT NULL;

-- Filtre par type (analytics agrégées)
CREATE INDEX IF NOT EXISTS clinical_events_type_idx
  ON clinical_events (event_type, created_at DESC);

-- 3. RLS — aligné sur V96.36 hardening (auth-only).
-- Le praticien voit uniquement ses propres events.
-- Aucune anon n'a accès.
ALTER TABLE clinical_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS clinical_events_select_own ON clinical_events;
CREATE POLICY clinical_events_select_own ON clinical_events
  FOR SELECT TO authenticated
  USING (practitioner_id = auth.uid());

DROP POLICY IF EXISTS clinical_events_insert_own ON clinical_events;
CREATE POLICY clinical_events_insert_own ON clinical_events
  FOR INSERT TO authenticated
  WITH CHECK (practitioner_id = auth.uid());

-- ⚠️ PAS DE POLICY UPDATE NI DELETE (append-only par design).

-- ============================================================
-- VERIFICATION post-migration
-- ============================================================
-- SELECT column_name, data_type, is_nullable, column_default
--   FROM information_schema.columns
--  WHERE table_name = 'clinical_events';
--
-- Attendu : 6 colonnes (id, practitioner_id, event_type, client_id,
--                       consultation_id, payload, created_at)
--
-- SELECT policyname, cmd, qual FROM pg_policies
--  WHERE tablename = 'clinical_events';
--
-- Attendu : 2 policies (clinical_events_select_own, clinical_events_insert_own).
-- ============================================================
