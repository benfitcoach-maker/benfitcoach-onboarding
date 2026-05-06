-- ============================================================
-- V97.2 — Soft-delete clients pour propagation cross-device
-- ============================================================
-- Bug : delete cliente depuis PC → row supprimee Supabase OK MAIS
-- tel/Mac ont encore la cliente en localStorage. Au prochain
-- pullFromCloud, "local-only client" detecte → cloudSyncClient
-- re-cree la row dans Supabase. La cliente revient sur tous les devices.
--
-- Fix : soft-delete via column is_deleted. Le tombstone cloud
-- est lu par tous les devices, qui l'ajoutent a leurs deletedIds
-- locaux et nettoient leur localStorage.
--
-- ⚠️ APPLIQUER VIA SUPABASE DASHBOARD → SQL Editor → Run.
-- Sur projet : anwfvgzldnfspcmwqxwy (SaaS prod).
-- ============================================================

-- 1. Ajout colonnes soft-delete (idempotent — IF NOT EXISTS)
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- 2. Index pour filtre rapide (la majorite des queries filtrent les non-supprimes)
CREATE INDEX IF NOT EXISTS clients_is_deleted_idx
  ON clients (is_deleted)
  WHERE is_deleted = false;

-- ============================================================
-- VERIFICATION post-migration
-- ============================================================
-- SELECT column_name, data_type, is_nullable, column_default
--   FROM information_schema.columns
--  WHERE table_name = 'clients'
--    AND column_name IN ('is_deleted', 'deleted_at');
--
-- Attendu :
--  is_deleted | boolean   | NO  | false
--  deleted_at | timestamp | YES | NULL
-- ============================================================
