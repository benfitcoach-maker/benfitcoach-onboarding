-- ============================================================
-- V97.25 — RPC increment atomique pour plan_generation_observability
-- ============================================================
-- Cf audit HIGH-3 (architect SaaS + code-reviewer) : recordSlopAction
-- faisait read-modify-write en JS, deux accept Haiku quasi-simultanes
-- pouvaient perdre un increment (deux SELECT voient 0, deux UPDATE
-- ecrivent 1, compteur final = 1 au lieu de 2).
--
-- Solution : fonction PostgreSQL atomique avec UPDATE inline. Appelee
-- depuis JS via supabase.rpc('obs_increment_field', { ... }).
--
-- Whitelist stricte des fields autorises pour eviter SQL injection
-- via le parametre p_field (meme avec RLS).
--
-- ⚠️ APPLIQUER VIA SUPABASE DASHBOARD → SQL Editor → Run.
-- ============================================================

CREATE OR REPLACE FUNCTION obs_increment_field(
  p_id uuid,
  p_field text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER  -- Respecte les RLS du caller (authenticated UPDATE deja en place V97.20)
AS $$
DECLARE
  v_new_count integer;
BEGIN
  -- Whitelist stricte
  IF p_field NOT IN (
    'slop_rewrites_requested_count',
    'slop_rewrites_accepted_count',
    'slop_rewrites_refused_count'
  ) THEN
    RAISE EXCEPTION 'Field non autorise : %', p_field;
  END IF;

  -- Update atomique : col = col + 1 dans une seule expression
  EXECUTE format(
    'UPDATE plan_generation_observability SET %I = COALESCE(%I, 0) + 1 WHERE id = $1 RETURNING %I',
    p_field, p_field, p_field
  ) INTO v_new_count USING p_id;

  IF v_new_count IS NULL THEN
    RAISE EXCEPTION 'Row introuvable : %', p_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'field', p_field, 'new_count', v_new_count);
END;
$$;

GRANT EXECUTE ON FUNCTION obs_increment_field(uuid, text) TO authenticated;

-- ============================================================
-- VERIFICATION
-- ============================================================
-- SELECT proname, prosecdef FROM pg_proc WHERE proname = 'obs_increment_field';
-- → 1 ligne, prosecdef = false (SECURITY INVOKER comme attendu)
--
-- Test :
-- SELECT obs_increment_field(
--   (SELECT id FROM plan_generation_observability LIMIT 1),
--   'slop_rewrites_accepted_count'
-- );
-- → {"ok": true, "field": "slop_rewrites_accepted_count", "new_count": 1}
-- ============================================================
