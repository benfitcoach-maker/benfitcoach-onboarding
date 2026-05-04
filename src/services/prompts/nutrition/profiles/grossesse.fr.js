// V96.17 — Profile module : grossesse (T1, T2, T3 — tous trimestres confondus).
//
// PRIORITE ABSOLUE — module SECURITAIRE.
// La nutrition pendant la grossesse engage 2 personnes. Toute approximation
// peut avoir des consequences (toxoplasmose, listeriose, mercure, deficit
// folates → spina bifida, etc.). Le suivi gynecologue/sage-femme reste
// obligatoire et NON substituable.
//
// DRAFT — regles directionnelles a valider avec Anissa avant activation.
// Anissa peut adapter selon le trimestre, les pathologies associees
// (diabete gestationnel, HTA gravidique, anemie), et le contexte personnel.

export const GROSSESSE_MODULE_FR = `
ADAPTATION GROSSESSE (priorite ABSOLUE — securite mere + bebe) :

CADRAGE CLINIQUE OBLIGATOIRE — A POSER EN INTRO DU PLAN :
"Ce plan vient en SOUTIEN du suivi gynecologique / sage-femme, jamais en
remplacement. Toute decision medicale, prise de complement, exclusion
alimentaire majeure ou modification calorique doit etre validee par le
professionnel qui te suit."

⛔ INTERDICTIONS ABSOLUES (le plan SERA REJETE s'il propose ces aliments) :

LISTERIA (exclusions strictes) :
- Fromages au lait CRU (camembert, brie, roquefort, feta, mozzarella au lait cru)
- Croute des fromages a pate molle (meme si pasteurise)
- Charcuterie crue (jambon cru, saucisson, rillettes, foie gras)
- Poissons fumes / marines (saumon fume, truite fumee)
- Coquillages crus, sushi, sashimi, tartare
- Lait cru et produits derives non pasteurises
- Graines germees crues

TOXOPLASMOSE (sauf si serologie positive prealable) :
- Viandes crues ou peu cuites (carpaccio, tartare, saignante, fumee)
- Legumes/fruits mal laves (toujours brosser + rincer abondamment)

MERCURE (poissons predateurs - LIMITER STRICTEMENT) :
- Espadon, marlin, requin, lamproie : INTERDIT total
- Thon (frais, en boite) : 1x/semaine MAXIMUM
- Lotte, anguille, brochet, daurade : limiter

VITAMINE A (risque malformatif au T1) :
- Foie animal (veau, agneau, volaille) : EVITER pendant toute la grossesse
- Pates de foie, mousses au foie : interdit
- Supplements de retinol haute dose : interdit (sauf prescription medicale)

ALCOOL : ZERO ABSOLU pendant toute la grossesse (effet teratogene).

CAFEINE : 200 mg/jour MAXIMUM (= 2 cafes ou 4 thes ou 5 chocolats chauds).
- Inclure tisanes : eviter sauge, genevrier, persil concentre, cannelle
  forte dose, reglisse (HTA), ginseng. Tisanes safe : verveine, melisse,
  fenouil (apres T1), gingembre (anti-nausees T1, dose moderee).

⚠️ MUST INCLUDE DANS LE PLAN (sinon plan incomplet) :

1. FOLATES (B9) — 400 a 600 mcg/jour. Format obligatoire :
"Folates par les legumes verts a feuille (epinards, mache, roquette, choux)
chaque jour, plus legumineuses 3-4x/semaine. Le supplement de B9 prescrit
par ton suivi reste indispensable jusqu'a au moins le 3e mois."

2. FER — besoins augmentes au T2/T3. Format :
"Fer biodisponible : viande maigre, oeufs, lentilles + vit C en parallele
(persil, kiwi, agrumes) pour booster l'absorption. The/cafe a distance
des repas (2h min)."

3. IODE — 250 mcg/jour. Format :
"Iode pour le developpement cerebral du bebe : poisson blanc 2x/semaine,
oeufs, sel iode (pas plus de 5g/jour), petits legumes de mer si bien
toleres."

4. OMEGA-3 DHA — developpement cerebral et oculaire bebe. Format :
"Omega-3 DHA pour le cerveau et la retine du bebe : poisson gras non
predateur 2-3x/semaine (sardines, maquereau, anchois), huile de colza,
noix. Le supplement DHA peut etre discute avec ton suivi."

5. CALCIUM + VITAMINE D. Format :
"Calcium par laitages pasteurises, amandes, sardines avec aretes, choux,
eau mineralisee calcique. Vitamine D : exposition soleil + supplement
souvent prescrit en hiver."

6. HYDRATATION : 2 a 2,5 L/jour, repartie en petites prises pour limiter
les nausees au T1.

ENERGIE / CALORIES :
- T1 : pas d'augmentation calorique necessaire (bebe minuscule)
- T2 : +340 kcal/jour environ
- T3 : +450 kcal/jour environ
- Ne JAMAIS imposer un regime hypocalorique a une femme enceinte, meme
  en cas de prise de poids "rapide". L'evaluation est medicale.
- JAMAIS de jeune intermittent en grossesse.

GESTION SYMPTOMES FREQUENTS :
- Nausees T1 : repas fractionnes, eviter jeune le matin, gingembre frais
  modere, cracker au reveil avant de se lever.
- Reflux T3 : repas legers le soir, ne pas s'allonger immediatement,
  surelever la tete du lit.
- Constipation : fibres progressives, hydratation, marche quotidienne,
  pas de laxatifs sans avis medical.
- Diabete gestationnel (si declare) : sequence repas fibres → proteines
  → glucides, IG bas, fractionnement. Suivi diabeto specifique.

INTERDIT ABSOLU :
- Promettre une "grossesse sans risque" via la nutrition.
- Recommander un complement specifique (multivitamine, fer, calcium) sans
  validation du suivi medical (interactions et doses sont prescrites).
- Imposer une exclusion alimentaire majeure sans bilan (ex : vegan strict
  sans suivi, eviction gluten/lait sans diagnostic).
- Negliger les signaux d'alerte : saignements, pertes anormales, douleurs
  abdominales, baisse violente d'energie, oedemes brutaux, cephalees
  intenses, troubles visuels → URGENCE, contacter immediatement la
  maternite/sage-femme.

NOTES POUR LE PLAN :
- Toujours preciser le trimestre estime (T1/T2/T3) si donne, sinon adapter
  pour T2 (le plus stable).
- Mentionner explicitement que les complements et le suivi medical
  prevalent sur la nutrition.
- Donner une liste claire d'aliments INTERDITS dans la fiche frigo.
`;
