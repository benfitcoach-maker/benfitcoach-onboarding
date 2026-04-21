-- ═══════════════════════════════════════════════════════════════════════
-- QA — Fix enum values sur les 3 profils de test
--
-- Les radios du formulaire (pretProtocole, frequenceBallonnements,
-- transitType, etc.) exigent des valeurs EXACTES. Mes INSERTs initiaux
-- contenaient du texte libre qui ne matchait pas — ce qui bloque la
-- génération des suppléments (condition stricte :
-- form.pretProtocole === 'Oui' || 'Peut-etre').
--
-- Ce script patch les champs enum critiques pour que les 3 profils
-- puissent régénérer plan + suppléments correctement.
-- ═══════════════════════════════════════════════════════════════════════

-- Claire (digestion) — pretProtocole était déjà "Oui" ✓
-- mais on corrige les autres enums
UPDATE clients
SET form = form
  || '{"pretProtocole": "Oui"}'::jsonb
  || '{"frequenceBallonnements": "Quotidiennement"}'::jsonb
  || '{"transitType": "Irregulier"}'::jsonb
  || '{"fringalesSucre": "Quotidiennement"}'::jsonb
  || '{"variationsGlycemie": "Oui apres les repas"}'::jsonb
  || '{"energieJournee": "Gros coup de fatigue l''apres-midi"}'::jsonb
  || '{"difficultesEndormissement": "Frequentes"}'::jsonb
  || '{"reveilsNocturnes": "Plusieurs fois"}'::jsonb
  || '{"etatReveil": "Fatigue"}'::jsonb
  || '{"tempsExterieur": "Non"}'::jsonb
  || '{"expositionEcransSoir": "Beaucoup"}'::jsonb
  || '{"analysesBiologiques": "Oui"}'::jsonb
  || '{"pretAnalysesAvancees": "Oui"}'::jsonb
  || '{"projetGrossesse": "Non"}'::jsonb
  || '{"douleursInflammations": "Non"}'::jsonb
  || '{"troublesPeau": "Oui occasionnel"}'::jsonb
  || '{"frequenceMaladies": "1-2 fois par an"}'::jsonb
  || '{"reactionGlucides": ["Somnolence", "Faim rapide"]}'::jsonb
WHERE (form->>'email') = 'qa-digestion@test.ch';

-- Sophie (SOPK) — le fix critique : pretProtocole = "Oui" exact
UPDATE clients
SET form = form
  || '{"pretProtocole": "Oui"}'::jsonb
  || '{"frequenceBallonnements": "Frequemment"}'::jsonb
  || '{"transitType": "Regulier"}'::jsonb
  || '{"fringalesSucre": "Quotidiennement"}'::jsonb
  || '{"variationsGlycemie": "Oui apres les repas"}'::jsonb
  || '{"energieJournee": "Fatigue apres les repas"}'::jsonb
  || '{"difficultesEndormissement": "Occasionnelles"}'::jsonb
  || '{"reveilsNocturnes": "Non"}'::jsonb
  || '{"etatReveil": "Fatigue"}'::jsonb
  || '{"tempsExterieur": "Oui"}'::jsonb
  || '{"expositionEcransSoir": "Moderement"}'::jsonb
  || '{"analysesBiologiques": "Oui"}'::jsonb
  || '{"pretAnalysesAvancees": "Oui"}'::jsonb
  || '{"projetGrossesse": "Oui"}'::jsonb
  || '{"douleursInflammations": "Non"}'::jsonb
  || '{"troublesPeau": "Oui chronique"}'::jsonb
  || '{"frequenceMaladies": "1-2 fois par an"}'::jsonb
  || '{"reactionGlucides": ["Somnolence", "Ballonnements", "Faim rapide"]}'::jsonb
WHERE (form->>'email') = 'qa-sopk@test.ch';

-- Marc (perte poids) — idem, fix pretProtocole
UPDATE clients
SET form = form
  || '{"pretProtocole": "Oui"}'::jsonb
  || '{"frequenceBallonnements": "Occasionnellement"}'::jsonb
  || '{"transitType": "Regulier"}'::jsonb
  || '{"fringalesSucre": "Occasionnellement"}'::jsonb
  || '{"variationsGlycemie": "Non"}'::jsonb
  || '{"energieJournee": "Fatigue apres les repas"}'::jsonb
  || '{"difficultesEndormissement": "Non"}'::jsonb
  || '{"reveilsNocturnes": "1 fois"}'::jsonb
  || '{"etatReveil": "En forme"}'::jsonb
  || '{"tempsExterieur": "Oui"}'::jsonb
  || '{"expositionEcransSoir": "Beaucoup"}'::jsonb
  || '{"analysesBiologiques": "Oui"}'::jsonb
  || '{"pretAnalysesAvancees": "Peut-etre"}'::jsonb
  || '{"douleursInflammations": "Occasionnelles"}'::jsonb
  || '{"troublesPeau": "Non"}'::jsonb
  || '{"frequenceMaladies": "Rarement"}'::jsonb
  || '{"reactionGlucides": ["Somnolence"]}'::jsonb
WHERE (form->>'email') = 'qa-pertepoids@test.ch';

-- Vérification : les valeurs critiques sont bien à "Oui"/"Peut-etre"
SELECT
  prenom,
  (form->>'pretProtocole') AS pret_protocole,
  (form->>'frequenceBallonnements') AS ballonnements,
  (form->>'transitType') AS transit,
  (form->>'projetGrossesse') AS grossesse
FROM clients
WHERE (form->>'email') IN ('qa-digestion@test.ch', 'qa-sopk@test.ch', 'qa-pertepoids@test.ch')
ORDER BY prenom;
