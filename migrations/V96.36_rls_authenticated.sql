-- ============================================================
-- V96.36 — Hardening RLS Supabase (réécrite après inspection live)
-- ============================================================
-- État découvert : 25 policies sur 7 tables (vs 7 dans schema file).
-- Problème : couches multiples — `allow_all_*` (qual=true) bypassait
-- les `*_select/insert/update` owner-scoped via le OR de PostgreSQL.
-- → anon avec juste l'anon key Vite avait full access en pratique.
--
-- Solution : table rase + 1 policy clean par table en `TO authenticated`.
-- Mono-tenant pour l'instant (Anissa + Benoit) → pas de scoping owner_id
-- nécessaire. Si multi-coach un jour, ajouter `USING (owner_id = auth.uid())`.
--
-- ⚠️ APPLIQUER VIA SUPABASE DASHBOARD → SQL Editor → Run.
-- ============================================================

-- 1. Drop TOUTES les policies existantes sur les 7 tables.
--    Plus simple que de patcher individuellement (25 policies
--    avec naming + qual variables).
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT tablename, policyname FROM pg_policies
     WHERE tablename IN (
       'clients','generations','massage_sessions','progression',
       'app_config','nutrition_consultations','manual_revenues'
     )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
                   pol.policyname, 'public', pol.tablename);
  END LOOP;
END $$;

-- 2. Une policy clean par table : authenticated only, full access.
CREATE POLICY "auth_only_clients"
  ON clients FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "auth_only_generations"
  ON generations FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "auth_only_massage"
  ON massage_sessions FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "auth_only_progression"
  ON progression FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "auth_only_config"
  ON app_config FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "auth_only_nutrition"
  ON nutrition_consultations FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "auth_only_manual_revenues"
  ON manual_revenues FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- ============================================================
-- VÉRIFICATION post-migration : exécute cette query en suivant.
-- ============================================================
-- SELECT tablename, policyname, cmd, roles
--   FROM pg_policies
--  WHERE tablename IN (
--    'clients','generations','massage_sessions','progression',
--    'app_config','nutrition_consultations','manual_revenues'
--  )
--  ORDER BY tablename;
--
-- Attendu : exactement 7 lignes, toutes :
--  - policyname commence par 'auth_only_'
--  - cmd = ALL
--  - roles = {authenticated}
--
-- Test fonctionnel : ouvre app.anissanutrition.ch connectée
--                    → tes clientes doivent s'afficher normalement.
-- ============================================================

-- ============================================================
-- ROLLBACK rapide si pépin (à NE PAS run sauf urgence)
-- ============================================================
-- DROP POLICY IF EXISTS "auth_only_clients" ON clients;
-- CREATE POLICY "allow_all_clients" ON clients FOR ALL USING (true) WITH CHECK (true);
-- (idem pour les 6 autres tables)
