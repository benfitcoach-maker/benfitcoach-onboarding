-- ═══════════════════════════════════════════════════════════════════════
-- V78 — Soft delete des consultations nutrition
--
-- USAGE :
--   1. Coller ce fichier dans Supabase SQL Editor → RUN
--   2. Déployer V78 côté frontend (commit c'est déjà poussé, Vercel auto-deploy)
--   3. Vérification : voir la requête SELECT en fin de fichier
--
-- ROLLBACK :
--   Voir le bloc commenté tout en bas (à décommenter uniquement si besoin
--   de retirer la feature).
-- ═══════════════════════════════════════════════════════════════════════

-- Colonnes soft delete
ALTER TABLE nutrition_consultations
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE NOT NULL,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by TEXT;

-- Index partiel sur is_deleted = FALSE (accélère les reads "normaux",
-- qui représentent 99% du trafic, sans alourdir les écritures).
CREATE INDEX IF NOT EXISTS idx_nutrition_consultations_not_deleted
  ON nutrition_consultations(client_id)
  WHERE is_deleted = FALSE;

-- Vérification : devrait renvoyer toutes les consultations existantes avec is_deleted = false
SELECT
  COUNT(*) AS total_consultations,
  COUNT(*) FILTER (WHERE is_deleted = FALSE) AS actives,
  COUNT(*) FILTER (WHERE is_deleted = TRUE)  AS supprimees
FROM nutrition_consultations;


-- ═══════════════════════════════════════════════════════════════════════
-- ROLLBACK (à exécuter uniquement si besoin de retirer la feature)
-- ═══════════════════════════════════════════════════════════════════════
-- DROP INDEX IF EXISTS idx_nutrition_consultations_not_deleted;
-- ALTER TABLE nutrition_consultations
--   DROP COLUMN IF EXISTS is_deleted,
--   DROP COLUMN IF EXISTS deleted_at,
--   DROP COLUMN IF EXISTS deleted_by;
