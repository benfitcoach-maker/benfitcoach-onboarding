-- ═══════════════════════════════════════════════════════════════════════
-- QA V74 — 3 profils de test (digestion / SOPK / perte poids)
--
-- USAGE :
--   1. Coller ce fichier dans Supabase → SQL Editor → RUN
--   2. Hard reload app.anissanutrition.ch → les 3 clientes apparaissent
--      dans le dashboard d'Anissa (prenom: Claire, Sophie, Marc)
--   3. Pour chacune, ouvrir la fiche → Nouvelle consultation → Générer IA
--   4. Suivre la checklist QA dans docs/qa/test-profiles.md
--
-- V2 : utilise JSONB literals au lieu de jsonb_build_object (limite 100 args)
--
-- NETTOYAGE après QA — dernier bloc du fichier (commenté, à décommenter
-- pour supprimer les 3 profils test + leurs consultations).
-- ═══════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────
-- Profil 1 — QA-Digestion (Claire Dubois, 35 ans, colon irritable)
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO clients (
  id, owner_id, categorie, prenom, formule, langue, status,
  form, created_by, pack_type, pack_started_at,
  pack_schedule, pack_started_at_confirmed,
  waist_cm, hip_cm, chest_cm
) VALUES (
  gen_random_uuid(),
  (SELECT id FROM auth.users WHERE email = 'anissa.nutri@gmail.com' LIMIT 1),
  'nutrition', 'Claire', 'nutrition', 'FR', 'questionnaire_envoye',
  $json${
    "prenom": "Claire",
    "nom": "Dubois",
    "age": "35",
    "genre": "Femme",
    "profession": "Cheffe de projet marketing",
    "poids": "64",
    "taille": "168",
    "tourTaille": "78",
    "tourHanche": "98",
    "tourPoitrine": "90",
    "tourBras": "28",
    "tourCuisse": "56",
    "masseGrasse": "26",
    "masseMusculaire": "",
    "telephone": "+41 79 000 00 01",
    "email": "qa-digestion@test.ch",
    "antecedentsFamiliaux": "Mère colon irritable, père hypertension",
    "pathologies": "Colon irritable diagnostiqué il y a 6 ans, reflux gastrique occasionnel",
    "traitements": "Aucun traitement chronique. Spasfon ponctuel lors des crises.",
    "operations": "Appendicectomie à 12 ans",
    "allergies": "Aucune allergie alimentaire. Intolérance suspectée au lactose (non testée).",
    "nbRepas": "3 repas + 1 collation",
    "alimentsEvites": "Choux, légumineuses mal cuites, lait de vache",
    "hydratation": "1.2L/j, surtout café (3/j) et tisanes",
    "mastication": "Rapide, souvent devant écran",
    "regimesSuivis": "Test FODMAP il y a 2 ans, abandonné. Pas végétarienne.",
    "blessures": "Aucune",
    "douleursActuelles": "Ballonnements en fin de journée, crampes abdominales 2-3×/semaine",
    "contraception": "Stérilet cuivre",
    "cycleDuree": "28 jours",
    "spm": "SPM modéré (3 jours avant règles : irritabilité, fringales sucrées)",
    "douleursMenstruelles": "Modérées, 1er jour",
    "projetGrossesse": "Non, pas dans l'immédiat",
    "typeSport": "Yoga + marche rapide",
    "frequenceSport": "2-3×/semaine",
    "objectifSport": "Retrouver de l'énergie, gérer le stress",
    "recuperation": "Correcte",
    "supplements": "Magnésium ponctuellement",
    "digestifEffort": "Pas de trouble à l'effort",
    "energieJournee": "Chute vers 15-16h, coup de pompe post-déjeuner",
    "fringalesSucre": "Oui, fin de journée surtout, lors des périodes stressantes",
    "variationsGlycemie": "Oui, confirmé par épisodes de faim intense + irritabilité",
    "reactionGlucides": ["coup_de_pompe_post_repas", "fringales_sucre"],
    "frequenceBallonnements": "Quotidien, pire en soirée",
    "transitType": "Alternance diarrhée / constipation, tendance SII-mixte",
    "alimentsProblematiques": "Choux, oignon cru, pain blanc, lait",
    "consommationReguliere": ["cafe", "produits_transformes"],
    "douleursInflammations": "Aucune douleur articulaire",
    "frequenceMaladies": "2-3 rhumes par an",
    "troublesPeau": "Peau réactive, petites rougeurs occasionnelles",
    "niveauStressActuel": "8",
    "difficultesEndormissement": "Oui, parfois jusqu'à 1h du matin",
    "reveilsNocturnes": "1-2× par nuit",
    "etatReveil": "Fatiguée, besoin de 2 cafés pour démarrer",
    "tempsExterieur": "Moins de 30 min/j",
    "heuresSommeil": "6h en moyenne",
    "expositionEcransSoir": "Oui, jusqu'à l'endormissement",
    "professionType": "Télétravail assis",
    "alcool": "Vin 2-3 verres/semaine",
    "tabac": "Non",
    "analysesBiologiques": "NFS dernier bilan OK, ferritine basse (28 ng/mL)",
    "testADN": "Non",
    "testsGenetiques": "Non",
    "pretAnalysesAvancees": "Oui, ouverte à MGD si utile",
    "objectifPrincipalNutrition": "Retrouver une digestion stable et une énergie constante dans la journée",
    "dureeProbleme": "6 ans (colon irritable diagnostiqué)",
    "dejaEssaye": "FODMAP 6 mois (arrêté — trop contraignant), probiotiques 2 mois (sans effet net)",
    "pretProtocole": "Oui",
    "observationsGenerales": "Profil digestif-stress classique. Priorité : stabilisation glycémique + réparation intestinale douce + gestion stress. Éviter de surcharger en suppléments.",
    "planAction": "Phase 1 (2-3 sem) : retirer lactose strict, 3 repas structurés, fin de grignotage. Phase 2 : introduction lente FODMAP tolérés, ajout de mag glycinate soir.",
    "examensPrevoir": "Ferritine de contrôle à 3 mois. Éventuel MGD si pas d'amélioration à 6 sem."
  }$json$::jsonb,
  'anissa', 'oneshot_180', NOW(),
  '[]'::jsonb, false,
  78, 98, 90
);

-- ─────────────────────────────────────────────────────────────────────
-- Profil 2 — QA-SOPK (Sophie Martin, 29 ans, SOPK + projet grossesse)
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO clients (
  id, owner_id, categorie, prenom, formule, langue, status,
  form, created_by, pack_type, pack_started_at,
  pack_schedule, pack_started_at_confirmed,
  waist_cm, hip_cm, chest_cm
) VALUES (
  gen_random_uuid(),
  (SELECT id FROM auth.users WHERE email = 'anissa.nutri@gmail.com' LIMIT 1),
  'nutrition', 'Sophie', 'nutrition', 'FR', 'questionnaire_envoye',
  $json${
    "prenom": "Sophie",
    "nom": "Martin",
    "age": "29",
    "genre": "Femme",
    "profession": "Infirmière (horaires variables)",
    "poids": "72",
    "taille": "165",
    "tourTaille": "88",
    "tourHanche": "104",
    "tourPoitrine": "94",
    "tourBras": "31",
    "tourCuisse": "62",
    "masseGrasse": "32",
    "masseMusculaire": "",
    "telephone": "+41 79 000 00 02",
    "email": "qa-sopk@test.ch",
    "antecedentsFamiliaux": "Mère diabète type 2, tante SOPK",
    "pathologies": "SOPK diagnostiqué à 25 ans (échographie + bilan hormonal). Acné adulte.",
    "traitements": "Aucun traitement hormonal actuel. Pilule stoppée il y a 18 mois.",
    "operations": "Aucune",
    "allergies": "Aucune",
    "nbRepas": "3 repas très variables selon horaires de garde",
    "alimentsEvites": "Aucun aliment évité",
    "hydratation": "1.5L/j",
    "mastication": "Correcte quand elle a le temps, rapide en garde",
    "regimesSuivis": "Weight Watchers il y a 3 ans (perte 5kg puis reprise)",
    "blessures": "Aucune",
    "douleursActuelles": "Acné dos et mâchoire, fringales sucrées pré-règles importantes",
    "contraception": "Aucune (projet grossesse)",
    "cycleDuree": "Variable, entre 35 et 60 jours",
    "spm": "Important (5-7 jours avant) : gonflements, fringales, irritabilité",
    "douleursMenstruelles": "Modérées",
    "projetGrossesse": "Oui, dans les 12-18 prochains mois",
    "typeSport": "Course à pied + cours collectifs (fitness)",
    "frequenceSport": "2×/semaine irrégulier",
    "objectifSport": "Perdre 5-7 kg, améliorer composition corporelle, préparer grossesse",
    "recuperation": "Longue après séance intense",
    "supplements": "Rien de régulier",
    "digestifEffort": "Pas de trouble",
    "energieJournee": "Énergie basse le matin, pics et chutes après les repas sucrés",
    "fringalesSucre": "Oui, quotidiennes, surtout en 2e partie de journée",
    "variationsGlycemie": "Marquées — irritabilité entre repas, besoin de collation sucrée",
    "reactionGlucides": ["coup_de_pompe_post_repas", "fringales_sucre", "prise_de_poids_abdominale"],
    "frequenceBallonnements": "2-3×/semaine, surtout en phase lutéale",
    "transitType": "Normal, parfois constipation en pré-règles",
    "alimentsProblematiques": "Aucun identifié clairement",
    "consommationReguliere": ["laitages", "cafe", "produits_transformes"],
    "douleursInflammations": "Aucune",
    "frequenceMaladies": "1-2 rhumes/an",
    "troublesPeau": "Acné hormonale dos + mâchoire (aggravée en 2e moitié de cycle)",
    "niveauStressActuel": "6",
    "difficultesEndormissement": "Occasionnelles, surtout après gardes de nuit",
    "reveilsNocturnes": "Rares hors gardes",
    "etatReveil": "Variable selon horaires",
    "tempsExterieur": "30-60 min/j",
    "heuresSommeil": "7h en moyenne mais très fragmenté",
    "expositionEcransSoir": "Modérée",
    "professionType": "Debout, gardes de nuit 1-2×/mois",
    "alcool": "Rare, 1-2 verres/mois",
    "tabac": "Non",
    "analysesBiologiques": "HOMA-IR 2.8 (insulino-résistance modérée). Testostérone totale 0.8 ng/mL (haute). LH/FSH 2.5. Vit D 18 ng/mL (basse). Ferritine 42.",
    "testADN": "Non",
    "testsGenetiques": "Non",
    "pretAnalysesAvancees": "Oui, demande explicitement un MGD",
    "objectifPrincipalNutrition": "Régulariser les cycles, perdre 5-7 kg et préparer un terrain favorable à une grossesse",
    "dureeProbleme": "4 ans (SOPK diagnostiqué il y a 4 ans)",
    "dejaEssaye": "Pilule (arrêtée), metformine 3 mois (arrêtée — digestif difficile), myo-inositol 2 mois (abandonné par oubli)",
    "pretProtocole": "Oui, très motivée",
    "observationsGenerales": "SOPK classique avec insulino-résistance modérée. Priorité absolue : stabilisation glycémique + sensibilisation insulinique. Projet grossesse à moyen terme → cadrage doux, pas restrictif. Associations Myo-inositol + D3 + Oméga-3 indispensables.",
    "planAction": "Phase 1 (4 sem) : 3 repas fixes protéinés, élimination sucre raffiné, myo-inositol 4g/j. Phase 2 : réintroduction progressive glucides complexes selon tolérance.",
    "examensPrevoir": "HOMA-IR contrôle 3 mois. AMH + bilan hormonal annuel."
  }$json$::jsonb,
  'anissa', 'oneshot_180', NOW(),
  '[]'::jsonb, false,
  88, 104, 94
);

-- ─────────────────────────────────────────────────────────────────────
-- Profil 3 — QA-PertePoids (Marc Rossi, 42 ans, sédentaire)
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO clients (
  id, owner_id, categorie, prenom, formule, langue, status,
  form, created_by, pack_type, pack_started_at,
  pack_schedule, pack_started_at_confirmed,
  waist_cm, hip_cm, chest_cm
) VALUES (
  gen_random_uuid(),
  (SELECT id FROM auth.users WHERE email = 'anissa.nutri@gmail.com' LIMIT 1),
  'nutrition', 'Marc', 'nutrition', 'FR', 'questionnaire_envoye',
  $json${
    "prenom": "Marc",
    "nom": "Rossi",
    "age": "42",
    "genre": "Homme",
    "profession": "Cadre financier",
    "poids": "98",
    "taille": "182",
    "tourTaille": "108",
    "tourHanche": "110",
    "tourPoitrine": "115",
    "tourBras": "36",
    "tourCuisse": "62",
    "masseGrasse": "28",
    "masseMusculaire": "",
    "telephone": "+41 79 000 00 03",
    "email": "qa-pertepoids@test.ch",
    "antecedentsFamiliaux": "Père diabète type 2, mère hypertension et cholestérol",
    "pathologies": "Hypertension légère (135/85 non traitée). Cholestérol légèrement haut (LDL 3.6 mmol/L).",
    "traitements": "Aucun traitement médicamenteux",
    "operations": "Aucune",
    "allergies": "Aucune",
    "nbRepas": "3 repas + grignotage apéro quasi-quotidien (biscuits salés, vin)",
    "alimentsEvites": "Rien",
    "hydratation": "1L/j",
    "mastication": "Rapide",
    "regimesSuivis": "Aucun régime suivi, déjà tenté de faire attention sans cadre précis",
    "blessures": "Aucune",
    "douleursActuelles": "Genoux un peu sensibles à la montée d'escaliers",
    "contraception": "",
    "cycleDuree": "",
    "spm": "",
    "douleursMenstruelles": "",
    "projetGrossesse": "",
    "typeSport": "Vélo balade week-end, marche occasionnelle",
    "frequenceSport": "1×/semaine",
    "objectifSport": "Perdre 10-12 kg, retrouver condition physique, pouvoir jouer au foot avec son fils",
    "recuperation": "OK",
    "supplements": "Aucun",
    "digestifEffort": "Pas de trouble",
    "energieJournee": "Somnolence après déjeuner, regain en fin d'après-midi",
    "fringalesSucre": "Plus du salé/gras en fin de journée (apéro)",
    "variationsGlycemie": "Non marquées",
    "reactionGlucides": ["prise_de_poids_abdominale"],
    "frequenceBallonnements": "Occasionnels après repas copieux",
    "transitType": "Régulier",
    "alimentsProblematiques": "Aucun",
    "consommationReguliere": ["cafe", "produits_transformes", "alcool"],
    "douleursInflammations": "Genoux ponctuels",
    "frequenceMaladies": "Rare",
    "troublesPeau": "Aucun",
    "niveauStressActuel": "5",
    "difficultesEndormissement": "Non",
    "reveilsNocturnes": "1× pour uriner",
    "etatReveil": "Correct",
    "tempsExterieur": "30 min/j",
    "heuresSommeil": "7h",
    "expositionEcransSoir": "Oui, TV jusqu'à 23h",
    "professionType": "Assis bureau, déplacements occasionnels",
    "alcool": "3-4 verres de vin/semaine + apéro week-end",
    "tabac": "Non",
    "analysesBiologiques": "Glycémie à jeun 5.6 mmol/L. HbA1c 5.8%. Triglycérides 1.9 mmol/L.",
    "testADN": "Non",
    "testsGenetiques": "Non",
    "pretAnalysesAvancees": "Pas pour l'instant, veut un cadre simple",
    "objectifPrincipalNutrition": "Perdre 10-12 kg de façon durable et retrouver de la condition physique",
    "dureeProbleme": "10 ans de prise progressive (+15 kg depuis 30 ans)",
    "dejaEssaye": "Périodes je fais gaffe sans cadre, abandonnées en 2-3 sem",
    "pretProtocole": "Oui, mais veut du simple et du faisable — pas un plan contraignant",
    "observationsGenerales": "Cas classique prise de poids progressive + syndrome métabolique débutant. Pas besoin de complexifier. Priorité fiche frigo ultra-claire pour appliquer au quotidien. Réduction alcool + apéro = levier n°1.",
    "planAction": "Phase 1 (2 sem) : 3 repas cadrés, suppression grignotage apéro en semaine, 1.5L eau. Phase 2 : intro marche 30min/j + alcool max 2 verres/sem.",
    "examensPrevoir": "Bilan lipidique + glycémie à jeun + TA à 3 mois."
  }$json$::jsonb,
  'anissa', 'oneshot_180', NOW(),
  '[]'::jsonb, false,
  108, 110, 115
);

-- Vérification : les 3 clientes viennent d'être insérées
SELECT id, prenom, (form->>'nom') AS nom, (form->>'email') AS email, created_by, pack_type, created_at
FROM clients
WHERE (form->>'email') IN ('qa-digestion@test.ch', 'qa-sopk@test.ch', 'qa-pertepoids@test.ch')
ORDER BY created_at DESC;


-- ═══════════════════════════════════════════════════════════════════════
-- NETTOYAGE — À EXÉCUTER APRÈS LA QA
-- Décommenter le bloc suivant et exécuter pour supprimer les 3 profils
-- (supprime aussi en cascade les consultations / générations / progression
-- liées grâce aux FK ON DELETE CASCADE déjà définies dans le schema).
-- ═══════════════════════════════════════════════════════════════════════

-- DELETE FROM clients
-- WHERE (form->>'email') IN (
--   'qa-digestion@test.ch',
--   'qa-sopk@test.ch',
--   'qa-pertepoids@test.ch'
-- );
