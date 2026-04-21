-- ============================================================
-- Benfitcoach Onboarding - Supabase Schema
-- Execute ce SQL dans l'editeur SQL de ton dashboard Supabase
-- ============================================================

-- Table principale des clients
CREATE TABLE clients (
  id UUID PRIMARY KEY,
  categorie TEXT DEFAULT 'online',
  prenom TEXT,
  formule TEXT,
  langue TEXT DEFAULT 'FR',
  status TEXT DEFAULT 'nouveau',
  form JSONB DEFAULT '{}',
  latest_sections JSONB,
  created_by TEXT DEFAULT 'benoit',
  custom_rate NUMERIC DEFAULT NULL,
  waist_cm NUMERIC DEFAULT NULL,
  hip_cm NUMERIC DEFAULT NULL,
  neck_cm NUMERIC DEFAULT NULL,
  chest_cm NUMERIC DEFAULT NULL,
  arm_right_cm NUMERIC DEFAULT NULL,
  arm_left_cm NUMERIC DEFAULT NULL,
  thigh_right_cm NUMERIC DEFAULT NULL,
  thigh_left_cm NUMERIC DEFAULT NULL,
  calf_cm NUMERIC DEFAULT NULL,
  body_fat_percent NUMERIC DEFAULT NULL,
  lean_mass_kg NUMERIC DEFAULT NULL,
  bmr_kcal NUMERIC DEFAULT NULL,
  interview_notes JSONB DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ALTER TABLE clients ADD COLUMN custom_rate NUMERIC DEFAULT NULL;
-- Body metrics columns (run if table already exists) :
-- ALTER TABLE clients ADD COLUMN waist_cm NUMERIC DEFAULT NULL;
-- ALTER TABLE clients ADD COLUMN hip_cm NUMERIC DEFAULT NULL;
-- ALTER TABLE clients ADD COLUMN neck_cm NUMERIC DEFAULT NULL;
-- ALTER TABLE clients ADD COLUMN body_fat_percent NUMERIC DEFAULT NULL;
-- ALTER TABLE clients ADD COLUMN lean_mass_kg NUMERIC DEFAULT NULL;
-- ALTER TABLE clients ADD COLUMN bmr_kcal NUMERIC DEFAULT NULL;
-- Optional measurements columns :
-- ALTER TABLE clients ADD COLUMN chest_cm NUMERIC DEFAULT NULL;
-- ALTER TABLE clients ADD COLUMN arm_right_cm NUMERIC DEFAULT NULL;
-- ALTER TABLE clients ADD COLUMN arm_left_cm NUMERIC DEFAULT NULL;
-- ALTER TABLE clients ADD COLUMN thigh_right_cm NUMERIC DEFAULT NULL;
-- ALTER TABLE clients ADD COLUMN thigh_left_cm NUMERIC DEFAULT NULL;
-- ALTER TABLE clients ADD COLUMN calf_cm NUMERIC DEFAULT NULL;
-- Interview notes column (template + per-step notes and "asked" state) :
-- ALTER TABLE clients ADD COLUMN interview_notes JSONB DEFAULT NULL;

-- Historique des generations IA
CREATE TABLE generations (
  id UUID PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  date TIMESTAMPTZ DEFAULT NOW(),
  sections JSONB
);

-- Notes de seance massage
CREATE TABLE massage_sessions (
  id UUID PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  date DATE DEFAULT CURRENT_DATE,
  zones_traitees TEXT DEFAULT '',
  techniques TEXT DEFAULT '',
  observations TEXT DEFAULT '',
  recommandations TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Suivi progression (poids/metriques)
CREATE TABLE progression (
  id UUID PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  date DATE DEFAULT CURRENT_DATE,
  poids NUMERIC,
  comment TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Configuration app (mot de passe hash, etc.)
CREATE TABLE app_config (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- Consultations nutrition (Anissa)
CREATE TABLE nutrition_consultations (
  id UUID PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  consultant_name TEXT DEFAULT 'Anissa',
  date TIMESTAMPTZ DEFAULT NOW(),
  observations TEXT DEFAULT '',
  blood_test_done BOOLEAN DEFAULT FALSE,
  dna_test_done BOOLEAN DEFAULT FALSE,
  nutritional_observations TEXT DEFAULT '',
  nutrition_plan TEXT DEFAULT '',
  supplements TEXT DEFAULT '',
  recipes TEXT DEFAULT '',
  notes_for_coach TEXT DEFAULT '',
  private_notes TEXT DEFAULT '',
  is_followup BOOLEAN DEFAULT FALSE,
  followup_data JSONB DEFAULT NULL,
  previous_consultation_id UUID DEFAULT NULL,
  -- V78 : soft delete
  is_deleted BOOLEAN DEFAULT FALSE NOT NULL,
  deleted_at TIMESTAMPTZ,
  deleted_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Revenus manuels (hors app)
CREATE TABLE manual_revenues (
  id UUID PRIMARY KEY,
  client_name TEXT DEFAULT '',
  amount NUMERIC NOT NULL DEFAULT 0,
  type TEXT DEFAULT 'oneshot',
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  note TEXT DEFAULT '',
  created_by TEXT DEFAULT 'benoit',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Followup tracking columns for nutrition consultations
-- Run this ALTER if table already exists:
-- ALTER TABLE nutrition_consultations ADD COLUMN is_followup BOOLEAN DEFAULT FALSE;
-- ALTER TABLE nutrition_consultations ADD COLUMN followup_data JSONB DEFAULT NULL;
-- ALTER TABLE nutrition_consultations ADD COLUMN previous_consultation_id UUID DEFAULT NULL;

-- Index pour performance
CREATE INDEX idx_generations_client ON generations(client_id);
CREATE INDEX idx_massage_sessions_client ON massage_sessions(client_id);
CREATE INDEX idx_progression_client ON progression(client_id);
CREATE INDEX idx_nutrition_consultations_client ON nutrition_consultations(client_id);

-- RLS : politiques permissives (acces via anon key)
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_clients" ON clients FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE generations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_generations" ON generations FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE massage_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_massage" ON massage_sessions FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE progression ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_progression" ON progression FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_config" ON app_config FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE nutrition_consultations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_nutrition" ON nutrition_consultations FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE manual_revenues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_manual_revenues" ON manual_revenues FOR ALL USING (true) WITH CHECK (true);
