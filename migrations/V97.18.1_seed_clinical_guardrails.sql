-- ============================================================
-- V97.18.1 — seed clinical_guardrails : 7 profils cliniques
-- ============================================================
-- Prerequisite : V97.18_clinical_guardrails.sql appliquee (tables creees).
-- Cf source canonique : src/services/prompts/nutrition/_clinicalGuardrails.fr.js
--
-- Idempotent : ON CONFLICT (profile_key) DO UPDATE remplace les valeurs
-- existantes. Safe a re-executer si la matrice JS est mise a jour.
--
-- ⚠️ APPLIQUER VIA SUPABASE DASHBOARD → SQL Editor → Run.
-- Sur projet : Benfitcoach (SaaS prod).
--
-- NOTE : le module JS `_clinicalGuardrails.fr.js` reste la source de
-- verite pour le code applicatif tant que la migration de lecture
-- (JS → Supabase) n'est pas faite. Cette seed sert :
--   1. de backup versionne dans la DB
--   2. de point d'edition pour Anissa via Studio (Phase 5 future)
-- ============================================================

-- 1. GROSSESSE
INSERT INTO clinical_guardrails (
  profile_key, display_name, forbidden_phrases, required_phrases,
  micronutrients, evictions, precaution_vocab, enabled
) VALUES (
  'grossesse',
  'Grossesse',
  ARRAY[
    'éviter tes injections', 'éviter les injections', 'éviter ton injection',
    'évite tes injections', 'éviter les injections annuelles',
    'remplacer tes injections', 'remplace tes injections',
    'à la place du fer prescrit',
    'plus efficace que les comprimés', 'plus efficace que tes comprimés',
    'plus efficace que ta supplémentation', 'remplace tes comprimés',
    'remplacer tes comprimés', 'à la place de tes comprimés',
    'à la place de ta supplémentation',
    'à la place du médecin', 'à la place de ton médecin',
    'remplacer le médecin', 'remplace ton médecin',
    'tu n''as pas besoin de médecin', 'sans avis médical',
    'arrête ton traitement', 'arrête tes médicaments',
    'guérir', 'guérit', 'soigner ta', 'soigner ton',
    'traiter ta', 'traiter ton', 'diagnostiquer',
    'régime restrictif', 'perte de poids', 'déficit calorique'
  ]::text[],
  ARRAY['éviter listeria', 'éviter toxoplasmose', 'éviter mercure', 'éviter alcool']::text[],
  ARRAY['acide folique', 'B9', 'iode', 'B12', 'vitamine D', 'fer', 'oméga-3']::text[],
  ARRAY[
    'listeria', 'toxoplasmose', 'alcool', 'mercure (gros poissons)',
    'foie', 'fromages au lait cru', 'charcuterie crue', 'sushi crus'
  ]::text[],
  '{"à la place de": "en complément de", "remplace": "complète", "au lieu de prendre": "en plus de prendre"}'::jsonb,
  true
)
ON CONFLICT (profile_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  forbidden_phrases = EXCLUDED.forbidden_phrases,
  required_phrases = EXCLUDED.required_phrases,
  micronutrients = EXCLUDED.micronutrients,
  evictions = EXCLUDED.evictions,
  precaution_vocab = EXCLUDED.precaution_vocab,
  enabled = EXCLUDED.enabled,
  updated_at = now();

-- 2. ALLAITEMENT
INSERT INTO clinical_guardrails (
  profile_key, display_name, forbidden_phrases, required_phrases,
  micronutrients, evictions, precaution_vocab, enabled
) VALUES (
  'allaitement',
  'Allaitement',
  ARRAY[
    'guérir', 'guérit', 'soigner ta', 'soigner ton',
    'traiter ta', 'traiter ton', 'diagnostiquer',
    'à la place du médecin', 'à la place de ton médecin',
    'remplacer le médecin', 'remplace ton médecin',
    'tu n''as pas besoin de médecin', 'sans avis médical',
    'arrête ton traitement', 'arrête tes médicaments',
    'régime restrictif', 'perte de poids rapide', 'déficit calorique',
    'jeûne intermittent', 'cure détox'
  ]::text[],
  ARRAY['hydratation suffisante', 'éviter alcool']::text[],
  ARRAY['iode', 'B12', 'vitamine D', 'oméga-3', 'fer', 'calcium']::text[],
  ARRAY[
    'alcool', 'caféine en excès (>200mg/j)',
    'sauge (inhibe lactation)', 'menthe poivrée à forte dose',
    'persil à forte dose'
  ]::text[],
  '{"à la place de": "en complément de", "remplace": "complète", "au lieu de prendre": "en plus de prendre"}'::jsonb,
  true
)
ON CONFLICT (profile_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  forbidden_phrases = EXCLUDED.forbidden_phrases,
  required_phrases = EXCLUDED.required_phrases,
  micronutrients = EXCLUDED.micronutrients,
  evictions = EXCLUDED.evictions,
  precaution_vocab = EXCLUDED.precaution_vocab,
  enabled = EXCLUDED.enabled,
  updated_at = now();

-- 3. POST-PARTUM
INSERT INTO clinical_guardrails (
  profile_key, display_name, forbidden_phrases, required_phrases,
  micronutrients, evictions, precaution_vocab, enabled
) VALUES (
  'postPartum',
  'Post-partum',
  ARRAY[
    'guérir', 'guérit', 'soigner ta', 'soigner ton',
    'traiter ta', 'traiter ton', 'diagnostiquer',
    'à la place du médecin', 'à la place de ton médecin',
    'remplacer le médecin', 'remplace ton médecin',
    'tu n''as pas besoin de médecin', 'sans avis médical',
    'arrête ton traitement', 'arrête tes médicaments',
    'retrouver ta ligne', 'perdre les kilos de la grossesse',
    'régime restrictif', 'avant la grossesse'
  ]::text[],
  ARRAY['récupération progressive']::text[],
  ARRAY['fer', 'vitamine D', 'B12', 'oméga-3']::text[],
  ARRAY[]::text[],
  '{"à la place de": "en complément de", "remplace": "complète", "au lieu de prendre": "en plus de prendre"}'::jsonb,
  true
)
ON CONFLICT (profile_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  forbidden_phrases = EXCLUDED.forbidden_phrases,
  required_phrases = EXCLUDED.required_phrases,
  micronutrients = EXCLUDED.micronutrients,
  evictions = EXCLUDED.evictions,
  precaution_vocab = EXCLUDED.precaution_vocab,
  enabled = EXCLUDED.enabled,
  updated_at = now();

-- 4. ADOLESCENTE (<18 ans)
INSERT INTO clinical_guardrails (
  profile_key, display_name, forbidden_phrases, required_phrases,
  micronutrients, evictions, precaution_vocab, enabled
) VALUES (
  'adolescente',
  'Adolescente (<18 ans)',
  ARRAY[
    'guérir', 'guérit', 'soigner ta', 'soigner ton',
    'traiter ta', 'traiter ton', 'diagnostiquer',
    'à la place du médecin', 'à la place de ton médecin',
    'remplacer le médecin', 'remplace ton médecin',
    'tu n''as pas besoin de médecin', 'sans avis médical',
    'arrête ton traitement', 'arrête tes médicaments',
    'déficit calorique', 'compter les calories', 'restriction',
    'régime', 'perdre du poids', 'mincir', 'sauter un repas', 'jeûne'
  ]::text[],
  ARRAY[]::text[],
  ARRAY['calcium', 'fer', 'zinc', 'vitamine D']::text[],
  ARRAY[]::text[],
  '{"à la place de": "en complément de", "remplace": "complète", "au lieu de prendre": "en plus de prendre", "régime": "rééquilibrage alimentaire", "restriction": "choix conscient"}'::jsonb,
  true
)
ON CONFLICT (profile_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  forbidden_phrases = EXCLUDED.forbidden_phrases,
  required_phrases = EXCLUDED.required_phrases,
  micronutrients = EXCLUDED.micronutrients,
  evictions = EXCLUDED.evictions,
  precaution_vocab = EXCLUDED.precaution_vocab,
  enabled = EXCLUDED.enabled,
  updated_at = now();

-- 5. MENOPAUSE (peri / post)
INSERT INTO clinical_guardrails (
  profile_key, display_name, forbidden_phrases, required_phrases,
  micronutrients, evictions, precaution_vocab, enabled
) VALUES (
  'menopause',
  'Ménopause',
  ARRAY[
    'guérir', 'guérit', 'soigner ta', 'soigner ton',
    'traiter ta', 'traiter ton', 'diagnostiquer',
    'à la place du médecin', 'à la place de ton médecin',
    'remplacer le médecin', 'remplace ton médecin',
    'tu n''as pas besoin de médecin', 'sans avis médical',
    'arrête ton traitement', 'arrête tes médicaments',
    'plus efficace que les comprimés', 'plus efficace que tes comprimés',
    'plus efficace que ta supplémentation', 'remplace tes comprimés',
    'remplacer tes comprimés', 'à la place de tes comprimés',
    'à la place de ta supplémentation',
    'œstrogènes naturels', 'remplace ton traitement hormonal',
    'guérir les bouffées'
  ]::text[],
  ARRAY[]::text[],
  ARRAY['calcium', 'vitamine D', 'magnésium', 'oméga-3']::text[],
  ARRAY[]::text[],
  '{"à la place de": "en complément de", "remplace": "complète", "au lieu de prendre": "en plus de prendre"}'::jsonb,
  true
)
ON CONFLICT (profile_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  forbidden_phrases = EXCLUDED.forbidden_phrases,
  required_phrases = EXCLUDED.required_phrases,
  micronutrients = EXCLUDED.micronutrients,
  evictions = EXCLUDED.evictions,
  precaution_vocab = EXCLUDED.precaution_vocab,
  enabled = EXCLUDED.enabled,
  updated_at = now();

-- 6. DIABETE (T1 et T2)
INSERT INTO clinical_guardrails (
  profile_key, display_name, forbidden_phrases, required_phrases,
  micronutrients, evictions, precaution_vocab, enabled
) VALUES (
  'diabete',
  'Diabète',
  ARRAY[
    'guérir', 'guérit', 'soigner ta', 'soigner ton',
    'traiter ta', 'traiter ton', 'diagnostiquer',
    'à la place du médecin', 'à la place de ton médecin',
    'remplacer le médecin', 'remplace ton médecin',
    'tu n''as pas besoin de médecin', 'sans avis médical',
    'arrête ton traitement', 'arrête tes médicaments',
    'plus efficace que les comprimés', 'plus efficace que tes comprimés',
    'plus efficace que ta supplémentation', 'remplace tes comprimés',
    'remplacer tes comprimés', 'à la place de tes comprimés',
    'à la place de ta supplémentation',
    'éviter tes injections', 'remplace ton insuline', 'arrête ta metformine',
    'guérir le diabète', 'inverser le diabète sans suivi médical'
  ]::text[],
  ARRAY['en coordination avec ton médecin']::text[],
  ARRAY['magnésium', 'chrome', 'vitamine D', 'oméga-3']::text[],
  ARRAY['sucres rapides en excès']::text[],
  '{"à la place de": "en complément de", "remplace": "complète", "au lieu de prendre": "en plus de prendre"}'::jsonb,
  true
)
ON CONFLICT (profile_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  forbidden_phrases = EXCLUDED.forbidden_phrases,
  required_phrases = EXCLUDED.required_phrases,
  micronutrients = EXCLUDED.micronutrients,
  evictions = EXCLUDED.evictions,
  precaution_vocab = EXCLUDED.precaution_vocab,
  enabled = EXCLUDED.enabled,
  updated_at = now();

-- 7. PATHOLOGIE CRITIQUE (fallback generique)
INSERT INTO clinical_guardrails (
  profile_key, display_name, forbidden_phrases, required_phrases,
  micronutrients, evictions, precaution_vocab, enabled
) VALUES (
  'pathologieCritique',
  'Pathologie chronique critique',
  ARRAY[
    'guérir', 'guérit', 'soigner ta', 'soigner ton',
    'traiter ta', 'traiter ton', 'diagnostiquer',
    'à la place du médecin', 'à la place de ton médecin',
    'remplacer le médecin', 'remplace ton médecin',
    'tu n''as pas besoin de médecin', 'sans avis médical',
    'arrête ton traitement', 'arrête tes médicaments',
    'plus efficace que les comprimés', 'plus efficace que tes comprimés',
    'plus efficace que ta supplémentation', 'remplace tes comprimés',
    'remplacer tes comprimés', 'à la place de tes comprimés',
    'à la place de ta supplémentation'
  ]::text[],
  ARRAY['en complément du suivi médical']::text[],
  ARRAY[]::text[],
  ARRAY[]::text[],
  '{"à la place de": "en complément de", "remplace": "complète", "au lieu de prendre": "en plus de prendre"}'::jsonb,
  true
)
ON CONFLICT (profile_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  forbidden_phrases = EXCLUDED.forbidden_phrases,
  required_phrases = EXCLUDED.required_phrases,
  micronutrients = EXCLUDED.micronutrients,
  evictions = EXCLUDED.evictions,
  precaution_vocab = EXCLUDED.precaution_vocab,
  enabled = EXCLUDED.enabled,
  updated_at = now();

-- ============================================================
-- VERIFICATION post-seed
-- ============================================================
-- SELECT profile_key, display_name,
--        array_length(forbidden_phrases, 1) AS nb_forbidden,
--        array_length(micronutrients, 1) AS nb_micro,
--        array_length(evictions, 1) AS nb_evic
--   FROM clinical_guardrails
--  ORDER BY profile_key;
--
-- Resultat attendu : 7 lignes
--   adolescente          (22 forbidden, 4 micro, 0 evic)
--   allaitement          (20 forbidden, 6 micro, 5 evic)
--   diabete              (31 forbidden, 4 micro, 1 evic)
--   grossesse            (33 forbidden, 7 micro, 8 evic)
--   menopause            (25 forbidden, 4 micro, 0 evic)
--   pathologieCritique   (22 forbidden, 0 micro, 0 evic)
--   postPartum           (19 forbidden, 4 micro, 0 evic)
-- ============================================================
