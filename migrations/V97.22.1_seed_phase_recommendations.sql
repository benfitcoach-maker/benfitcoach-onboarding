-- ============================================================
-- V97.22.1 — seed phase_recommendations : 5 phases microbiote
-- ============================================================
-- Prerequisite : V97.22 (table phase_recommendations cree).
-- Cf source canonique : src/services/protocolPhases.js (TEMPLATE_MICROBIOTE_5).
--
-- Idempotent via ON CONFLICT (template_key, phase_id) DO UPDATE.
-- Safe a re-executer apres modification du JS source pour resync.
--
-- Pour V1, on seed UNIQUEMENT le template microbiote_5_phases (le plus
-- utilise et le seul ayant des recommendations completes dans le JS).
-- microbiote_3_phases et nutrition_simple_2_phases n'ont pas de recos
-- dans le JS → seront ajoutees plus tard par Anissa via UI cockpit.
--
-- ⚠️ APPLIQUER VIA SUPABASE DASHBOARD → SQL Editor → Run.
-- ============================================================

-- ─── PHASE 1 : Apaisement digestif (Eradication) ─────────────────────────
INSERT INTO phase_recommendations (
  template_key, phase_id, phase_order, client_name, clinical_name,
  foods_favor, foods_limit, cooking, cooking_avoid, supplements,
  clinical_notes, enabled
) VALUES (
  'microbiote_5_phases', 'p1', 1, 'Apaisement digestif', 'Eradication',
  ARRAY[
    'Cuissons douces (vapeur, mijoté, bouilli)',
    'Légumes pelés et bien cuits',
    'Bouillons d''os',
    'Volailles maigres',
    'Riz blanc, sarrasin',
    'Bananes mûres',
    'Tisanes digestives (gingembre, fenouil)'
  ]::text[],
  ARRAY[
    'Crudités et fibres dures (chou cru, légumineuses)',
    'Gluten',
    'Lait de vache et fromages affinés',
    'Sucres rapides',
    'Alcool',
    'Aliments industriels et émulsifiants'
  ]::text[],
  ARRAY['Vapeur', 'Mijoté lent', 'Bouillon']::text[],
  ARRAY['Friture', 'Cru en grande quantité', 'Grillé fort']::text[],
  '[
    {"name": "L-glutamine", "dose": "5 g", "timing": "matin à jeun"},
    {"name": "Probiotique multi-souches", "dose": "1 gélule", "timing": "avant petit-déjeuner"},
    {"name": "Bouillon d''os", "dose": "1 bol", "timing": "soir avant repas"}
  ]'::jsonb,
  'Phase d''apaisement : éviter tout ce qui irrite la muqueuse. Cuissons douces, fibres modérées. La L-glutamine soutient la barrière intestinale. Probiotique doux pour amorcer la diversité.',
  true
)
ON CONFLICT (template_key, phase_id) DO UPDATE SET
  phase_order = EXCLUDED.phase_order,
  client_name = EXCLUDED.client_name,
  clinical_name = EXCLUDED.clinical_name,
  foods_favor = EXCLUDED.foods_favor,
  foods_limit = EXCLUDED.foods_limit,
  cooking = EXCLUDED.cooking,
  cooking_avoid = EXCLUDED.cooking_avoid,
  supplements = EXCLUDED.supplements,
  clinical_notes = EXCLUDED.clinical_notes,
  enabled = EXCLUDED.enabled,
  updated_at = now();

-- ─── PHASE 2 : Rééquilibrage intestinal (Restitution) ────────────────────
INSERT INTO phase_recommendations (
  template_key, phase_id, phase_order, client_name, clinical_name,
  foods_favor, foods_limit, cooking, cooking_avoid, supplements,
  clinical_notes, enabled
) VALUES (
  'microbiote_5_phases', 'p2', 2, 'Rééquilibrage intestinal', 'Restitution',
  ARRAY[
    'Légumes cuits diversifiés (carottes, courgettes, fenouil, panais)',
    'Légumineuses bien cuites en petites quantités (lentilles corail)',
    'Fruits cuits (compote pommes, poires)',
    'Poissons gras (sardine, maquereau)',
    'Œufs bio',
    'Huile d''olive vierge extra',
    'Yaourt brebis ou chèvre (si toléré)'
  ]::text[],
  ARRAY[
    'Crudités en grandes quantités',
    'Fromages industriels',
    'Charcuteries',
    'Boissons sucrées',
    'Gluten (maintenu en pause)'
  ]::text[],
  ARRAY['Vapeur', 'Étuvée', 'Court bouillon']::text[],
  ARRAY['Grillé fort', 'Friture']::text[],
  '[
    {"name": "Prébiotiques doux (PHGG, inuline)", "dose": "5 g", "timing": "matin avec le petit-déjeuner"},
    {"name": "Probiotique multi-souches", "dose": "1 gélule", "timing": "à jeun matin"},
    {"name": "L-glutamine", "dose": "5 g", "timing": "continuer le matin à jeun"},
    {"name": "Magnésium bisglycinate", "dose": "300 mg", "timing": "soir"}
  ]'::jsonb,
  'Réintroduction progressive de la diversité alimentaire. Prébiotiques doux pour nourrir la flore. Maintenir la pause gluten encore 4 semaines. Surveiller la tolérance des légumineuses et fibres.',
  true
)
ON CONFLICT (template_key, phase_id) DO UPDATE SET
  phase_order = EXCLUDED.phase_order,
  client_name = EXCLUDED.client_name,
  clinical_name = EXCLUDED.clinical_name,
  foods_favor = EXCLUDED.foods_favor,
  foods_limit = EXCLUDED.foods_limit,
  cooking = EXCLUDED.cooking,
  cooking_avoid = EXCLUDED.cooking_avoid,
  supplements = EXCLUDED.supplements,
  clinical_notes = EXCLUDED.clinical_notes,
  enabled = EXCLUDED.enabled,
  updated_at = now();

-- ─── PHASE 3 : Réparation profonde (Leaky Gut) ───────────────────────────
INSERT INTO phase_recommendations (
  template_key, phase_id, phase_order, client_name, clinical_name,
  foods_favor, foods_limit, cooking, cooking_avoid, supplements,
  clinical_notes, enabled
) VALUES (
  'microbiote_5_phases', 'p3', 3, 'Réparation profonde', 'Leaky Gut',
  ARRAY[
    'Poissons gras 2-3×/semaine (saumon sauvage, sardines)',
    'Œufs bio',
    'Foie de volaille (1×/semaine, source vitamine A naturelle)',
    'Légumes verts à feuilles (épinards, blettes, kale cuit)',
    'Avocat',
    'Graines de chia et lin (moulues, en petites quantités)',
    'Bouillon d''os enrichi en collagène',
    'Curcuma + poivre noir dans les plats'
  ]::text[],
  ARRAY[
    'Sucres ajoutés (même naturels en excès)',
    'Aliments ultra-transformés',
    'Alcool',
    'Café fort (1 max le matin)'
  ]::text[],
  ARRAY['Vapeur', 'Mijoté', 'Cuissons douces avec curcuma']::text[],
  ARRAY['Cuissons hautes températures', 'Carbonisation']::text[],
  '[
    {"name": "Zinc bisglycinate", "dose": "15 mg", "timing": "soir avec repas"},
    {"name": "Vitamine A naturelle (huile de foie de morue)", "dose": "1 cuillère café", "timing": "matin"},
    {"name": "Oméga-3 EPA/DHA", "dose": "2 g", "timing": "midi avec repas gras"},
    {"name": "L-glutamine", "dose": "10 g", "timing": "matin et soir à jeun"},
    {"name": "Vitamine D3 + K2", "dose": "2000 UI", "timing": "matin avec repas gras"}
  ]'::jsonb,
  'Phase clé de réparation de la barrière intestinale. Combinaison zinc + vitamine A + oméga 3 + L-glutamine à dose thérapeutique. Anti-inflammatoires naturels (curcuma). Diminuer charge inflammatoire (sucre, alcool).',
  true
)
ON CONFLICT (template_key, phase_id) DO UPDATE SET
  phase_order = EXCLUDED.phase_order,
  client_name = EXCLUDED.client_name,
  clinical_name = EXCLUDED.clinical_name,
  foods_favor = EXCLUDED.foods_favor,
  foods_limit = EXCLUDED.foods_limit,
  cooking = EXCLUDED.cooking,
  cooking_avoid = EXCLUDED.cooking_avoid,
  supplements = EXCLUDED.supplements,
  clinical_notes = EXCLUDED.clinical_notes,
  enabled = EXCLUDED.enabled,
  updated_at = now();

-- ─── PHASE 4 : Consolidation (Reinoculation) ─────────────────────────────
INSERT INTO phase_recommendations (
  template_key, phase_id, phase_order, client_name, clinical_name,
  foods_favor, foods_limit, cooking, cooking_avoid, supplements,
  clinical_notes, enabled
) VALUES (
  'microbiote_5_phases', 'p4', 4, 'Consolidation', 'Reinoculation',
  ARRAY[
    'Aliments fermentés natuels (choucroute crue, kéfir d''eau, miso non pasteurisé)',
    'Diversité maximale de légumes (30 variétés/semaine, défi microbiote)',
    'Fibres prébiotiques (oignon cuit, ail cuit, poireau, artichaut)',
    'Réintroduction progressive gluten (pain au levain, épeautre)',
    'Fruits frais variés (selon saison)',
    'Noix et amandes (poignée/jour, trempées si mieux tolérées)',
    'Légumineuses 2×/semaine'
  ]::text[],
  ARRAY[
    'Restrictions levées sauf intolérances individuelles confirmées',
    'Garder vigilance sur ultra-transformés'
  ]::text[],
  ARRAY['Toutes méthodes', 'Variété encouragée']::text[],
  ARRAY['Carbonisation systématique']::text[],
  '[
    {"name": "Probiotique multi-souches", "dose": "1 gélule", "timing": "matin à jeun"},
    {"name": "Oméga-3", "dose": "1 g", "timing": "midi"},
    {"name": "Vitamine D3 + K2", "dose": "2000 UI", "timing": "matin"},
    {"name": "L-glutamine", "dose": "5 g", "timing": "maintien matin si confort digestif maintenu"}
  ]'::jsonb,
  'Consolidation du terrain restauré. Introduction des fermentés naturels pour ensemencer la flore. Défi des 30 légumes/semaine (Tim Spector) pour maximiser la diversité. Diminution progressive des suppléments thérapeutiques.',
  true
)
ON CONFLICT (template_key, phase_id) DO UPDATE SET
  phase_order = EXCLUDED.phase_order,
  client_name = EXCLUDED.client_name,
  clinical_name = EXCLUDED.clinical_name,
  foods_favor = EXCLUDED.foods_favor,
  foods_limit = EXCLUDED.foods_limit,
  cooking = EXCLUDED.cooking,
  cooking_avoid = EXCLUDED.cooking_avoid,
  supplements = EXCLUDED.supplements,
  clinical_notes = EXCLUDED.clinical_notes,
  enabled = EXCLUDED.enabled,
  updated_at = now();

-- ─── PHASE 5 : Stabilisation long terme ──────────────────────────────────
INSERT INTO phase_recommendations (
  template_key, phase_id, phase_order, client_name, clinical_name,
  foods_favor, foods_limit, cooking, cooking_avoid, supplements,
  clinical_notes, enabled
) VALUES (
  'microbiote_5_phases', 'p5', 5, 'Stabilisation long terme', 'Stabilisation',
  ARRAY[
    'Régime méditerranéen flexitarien',
    'Diversité maximale (30+ variétés végétales/semaine)',
    'Poissons 2-3×/semaine',
    'Cuissons douces majoritaires',
    'Fermentés réguliers',
    'Saisonnalité et localité privilégiées',
    'Plaisir et convivialité conservés'
  ]::text[],
  ARRAY[
    'Pas de restriction stricte',
    'Écouter signaux individuels'
  ]::text[],
  ARRAY['Toutes méthodes', 'Plaisir et variété']::text[],
  ARRAY[]::text[],
  '[
    {"name": "Oméga-3", "dose": "1 g", "timing": "midi (entretien)"},
    {"name": "Vitamine D3 + K2", "dose": "1000-2000 UI", "timing": "matin (modulé selon dosage sanguin)"},
    {"name": "Probiotique", "dose": "1 gélule", "timing": "cure de 4 semaines tous les 3 mois"}
  ]'::jsonb,
  'Phase de croisière. Plus de restrictions thérapeutiques. Maintien des bons réflexes acquis. Bilan biologique annuel recommandé pour ajuster D3 et oméga 3. Réactiver une phase plus intensive si signaux de rechute (fatigue chronique, ballonnements récurrents).',
  true
)
ON CONFLICT (template_key, phase_id) DO UPDATE SET
  phase_order = EXCLUDED.phase_order,
  client_name = EXCLUDED.client_name,
  clinical_name = EXCLUDED.clinical_name,
  foods_favor = EXCLUDED.foods_favor,
  foods_limit = EXCLUDED.foods_limit,
  cooking = EXCLUDED.cooking,
  cooking_avoid = EXCLUDED.cooking_avoid,
  supplements = EXCLUDED.supplements,
  clinical_notes = EXCLUDED.clinical_notes,
  enabled = EXCLUDED.enabled,
  updated_at = now();

-- ============================================================
-- VERIFICATION
-- ============================================================
-- SELECT template_key, phase_id, phase_order, client_name, clinical_name,
--        array_length(foods_favor, 1) AS nb_favor,
--        array_length(foods_limit, 1) AS nb_limit,
--        jsonb_array_length(supplements) AS nb_supp
--   FROM phase_recommendations
--  WHERE template_key = 'microbiote_5_phases'
--  ORDER BY phase_order;
--
-- Attendu : 5 lignes
--   p1 Apaisement digestif       (7 favor, 6 limit, 3 supp)
--   p2 Rééquilibrage intestinal  (7 favor, 5 limit, 4 supp)
--   p3 Réparation profonde       (8 favor, 4 limit, 5 supp)
--   p4 Consolidation             (7 favor, 2 limit, 4 supp)
--   p5 Stabilisation long terme  (7 favor, 2 limit, 3 supp)
-- ============================================================
