// V96.14 — Profile module : nephropathie (insuffisance renale debutante a
// moderee, nephropathie diabetique, eGFR diminue, microalbuminurie, dialyse
// pre-dialytique).
//
// DRAFT — regles directionnelles a valider avec Anissa avant activation.
// La nephropathie avancee (stade 4-5) doit imperativement etre suivie par un
// nephrologue + dieteticienne specialisee renale. La nutrition Anissa intervient
// surtout en stade 1-3 ou en complement du suivi medical.

export const NEPHROPATHIE_MODULE_FR = `
ADAPTATION NEPHROPATHIE / FONCTION RENALE FRAGILISEE (priorite tres haute) :

CADRAGE CLINIQUE — A POSER SI L'ETAT RENAL EST AVANCE :
La nutrition vient en SUPPORT du suivi nephrologique. Tout ajustement majeur
des proteines, du potassium, du phosphore ou du sodium doit etre coordonne
avec le medecin et idealement une dieteticienne renale.

OBJECTIFS DE LA NUTRITION :
1. Reduire la charge de filtration glomerulaire (proteines doses, sodium,
   acidose metabolique).
2. Prevenir la denutrition (paradoxe renal : moins de proteines mais densite
   nutritionnelle preservee).
3. Surveiller potassium et phosphore selon le stade.
4. Soutenir la fonction cardiovasculaire (souvent associee a l'IRC).

⛔ LE PLAN SERA REJETE s'il ne contient pas LITTERALEMENT ces 3 elements :

REGLE 1 — Plafond proteique chiffre. Format obligatoire :
"Proteines plafonnees a 0,8 g/kg/jour (= environ XX g pour ton poids actuel),
reparties sur les 3 repas. Pas plus, meme avec sensation de faim."
(Calculer le chiffre concret en grammes selon le poids du client.)

REGLE 2 — Limitation sodium chiffree. Format obligatoire :
"Sodium reduit : moins de 5 g de sel par jour (plus strict si HTA associee :
4 g max). Eviter pain industriel, charcuteries, conserves, plats prepares,
bouillons cubes, sauces du commerce, fromages sales. Cuisiner maison, sel
ajoute en fin de cuisson seulement, herbes et epices pour le gout."

REGLE 3 — Mention de l'eau faiblement mineralisee :
"Hydratation 1,5 a 2 L/jour avec eau plate faiblement mineralisee
(Mont Roucous, Volvic, Evian) en stade 1-2. Stade avance : la cible
hydrique est decidee par le nephrologue."

VERIFIER avant de cloturer le plan : les mots "0,8 g/kg" (ou equivalent
chiffre), "sodium" (ou "sel" avec chiffre), et "faiblement mineralisee"
sont TOUS presents dans le texte final. Si l'un manque, le plan est invalide.

PLAFOND PROTEIQUE :
- En l'absence de bilan precis : viser 0,8 g/kg/jour de proteines,
  reparties sur les 3 repas. JAMAIS plus de 1 g/kg sans avis medical.
- Privilegier les proteines de haute valeur biologique : oeuf, poisson,
  volaille, laitages selon tolerance phosphore.
- Limiter les sources tres riches en phosphore organique (charcuteries,
  fromages affines, conserves industrielles, sodas cola).

SODIUM :
- Plafond < 2 g de sodium par jour (= 5 g de sel) en base. Plus strict si
  HTA associee : 1,5 g sodium / 4 g sel.
- Eviter : pain industriel, charcuteries, conserves, plats prepares,
  bouillons cubes, sauces du commerce, fromages sales.
- Cuisiner maison, sel ajoute en fin de cuisson seulement, herbes et
  epices pour le gout.

POTASSIUM (vigilance si stade 3+ ou kaliemie >5 mmol/L) :
- Limiter les aliments tres riches en potassium SI la kaliemie le justifie :
  banane, pomme de terre non bouillie, abricot sec, tomate concentree,
  legumineuses non rincees, chocolat noir, fruits secs.
- Astuce double cuisson pour les pommes de terre et legumineuses (couper
  petit + bouillir + jeter eau + nouvelle cuisson) reduit fortement le K.

PHOSPHORE :
- Eviter les sources industrielles ajoutees (additifs E338-E343, E450-E452,
  charcuteries, sodas cola, fromages a tartiner).
- Sources alimentaires naturelles (laitages, oleagineux, legumineuses)
  acceptables tant que kaliemie et phosphoremie restent dans les normes.

HYDRATATION :
- Adapter selon le stade et la diurese. En stade 1-2 sans restriction
  particuliere : viser 1,5 a 2 L/jour eau plate, faiblement mineralisee
  (Mont Roucous, Volvic, Evian).
- Stade avance : la restriction hydrique est decidee par le nephrologue,
  ne JAMAIS imposer une cible elevee dans un plan sans bilan precis.

ACIDOSE METABOLIQUE / EQUILIBRE ACIDO-BASIQUE :
- Plus de fruits et legumes alcalinisants (courgette, courge, concombre,
  poire, melon), moins de viande rouge, charcuteries et fromages affines.

INTERDIT ABSOLU :
- Recommander un regime hyperproteine (paleo strict, keto agressif) sans
  bilan renal recent.
- Supplements en proteines (whey, BCAA) sans avis du nephrologue.
- Supplements de potassium ou de phosphore sans bilan biologique.
- Tisanes a base de plantes nephrotoxiques (cassis a forte dose, prele
  prolongee, aristoloche). En cas de doute, ne pas recommander.

NOTES POUR LE PLAN :
- Toujours preciser dans la section coach : "ces ajustements supposent un
  suivi nephrologique a jour, signaler tout changement dans le bilan
  (creatinine, eGFR, kaliemie, phosphoremie)".
- Pour les diabetiques avec nephropathie : la combinaison "stabilite
  glycemique + plafond proteique + sodium reduit" est l'axe central.
`;
