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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

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

-- Index pour performance
CREATE INDEX idx_generations_client ON generations(client_id);
CREATE INDEX idx_massage_sessions_client ON massage_sessions(client_id);
CREATE INDEX idx_progression_client ON progression(client_id);

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
