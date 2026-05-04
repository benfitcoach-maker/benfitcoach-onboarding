// V96.14 — Profile module : complications du diabete (retinopathie,
// cataracte diabetique, neuropathie, mal perforant, atteintes cardiovasculaires
// et calcifications arterielles).
//
// DRAFT — regles directionnelles a valider avec Anissa avant activation.
// Module ADDITIF a `diabete.fr.js` : detecte specifiquement les complications
// declarees, ne se substitue PAS au module diabete principal.

export const COMPLICATIONS_DIABETE_MODULE_FR = `
ADAPTATION COMPLICATIONS DU DIABETE (priorite tres haute) :

CADRAGE CLINIQUE :
Les complications du diabete (retinopathie, neuropathie, mal perforant,
atherosclerose) signalent un terrain inflammatoire systemique installe et
des annees de variations glycemiques. La nutrition vient en SUPPORT du
suivi specialise (ophtalmologue, cardiologue, podologue), avec un objectif
double : ralentir la progression et reduire l'inflammation chronique.

⛔ LE PLAN SERA REJETE s'il ne contient pas LITTERALEMENT ces 4 elements
(ce sont des regles de COMPLIANCE, pas des suggestions) :

REGLE 1 — Mention LITTERALE du mot "lutiine" (ou "lutéine") associee a la
retinopathie. Format obligatoire (adapter le ton mais garder le mot) :
"Avec ta retinopathie : epinards/chou kale 3x/semaine pour la lutiine
qui protege ta retine."

REGLE 2 — Mention LITTERALE des mots "vitamine K2" (ou "vit K2")
associee aux calcifications arterielles. Format obligatoire :
"Pour tes calcifications arterielles : vitamine K2 par les jaunes
d'oeuf et fromages affines moderes (redirige le calcium vers les os
plutot que les arteres)."

REGLE 3 — Si neuropathie OU mal perforant declare : mention LITTERALE
de "acide alpha-lipoique" (alimentaire, pas en supplement) ET de
"magnesium". Format : "Tes nerfs : acide alpha-lipoique via brocoli +
epinards quotidiens, magnesium par oleagineux et cacao cru."

REGLE 4 — UNE phrase qui RELIE explicitement la stabilite glycemique a
la protection des complications. Format : "Stabiliser ta glycemie reste
le levier numero 1 pour freiner la progression de ta retinopathie /
neuropathie / calcifications."

VERIFIER avant de cloturer le plan : les mots "lutiine", "vitamine K2",
"alpha-lipoique" (si neuropathie), et la phrase de liaison glycemie sont
TOUS presents dans le texte final. Si l'un manque, le plan est invalide.

PRIORITE STABILITE GLYCEMIQUE :
- Reprend toutes les regles du module diabete (sequence repas, IG bas,
  fractionnement). C'est le levier numero 1 pour ralentir la progression
  des complications.

INFLAMMATION & STRESS OXYDATIF :
- Polyphenols a chaque repas : fruits rouges, the vert, cacao non sucre,
  huile d'olive vierge, epices anti-inflammatoires (curcuma + poivre,
  gingembre, cannelle).
- Omega-3 (poisson gras 3x/semaine, huile de colza, noix) : reduisent
  l'inflammation vasculaire et soutiennent la sante retinienne.

RETINOPATHIE / SANTE OCULAIRE :
- Lutiine et zeaxanthine alimentaires : epinards, chou kale, brocoli,
  jaune d'oeuf, mais (en quantite limitee si IG eleve), petits pois.
- Anthocyanes : myrtilles, cassis, mures, grenade — protecteurs des
  capillaires retiniens.
- Zinc : huitres, viande rouge avec moderation, oleagineux, legumineuses.
- Vitamine C (kiwi, agrumes, poivron, persil) et vitamine E (huile d'olive,
  amandes, avocat) en synergie antioxydante.
- Pression intra-oculaire : hydratation reguliere, eviter les pics de
  cafeine concentrees, limiter les sucres rapides qui aggravent l'oedeme
  retinien.

NEUROPATHIE PERIPHERIQUE :
- Vitamines du groupe B (B1, B6, B9, B12) par l'alimentation : oeufs,
  poisson, viande maigre, legumes verts, legumineuses, oleagineux.
- Acide alpha-lipoique alimentaire (epinards, brocoli, levure de biere) :
  soutient la regeneration nerveuse.
- Magnesium en base (oleagineux, cacao cru, legumes verts, eaux
  mineralisees magnesium).
- Eviter excs alcool qui aggrave la neuropathie.

ATHEROSCLEROSE / CALCIFICATIONS ARTERIELLES :
- Modele alimentaire mediterraneen renforce : huile d'olive vierge,
  legumes verts a chaque repas, poisson gras 2-3x/semaine, oleagineux,
  legumineuses.
- Vitamine K2 (fromages affines moderation, oeufs jaune, legumes
  fermentes) : redirige le calcium vers les os plutot que les arteres.
- Reduire fortement les graisses trans et les sucres ajoutes.
- Sodium reduit (vise < 5 g sel/jour, < 4 g si HTA associee).

MAL PERFORANT / PIED DIABETIQUE :
- Renforcer cicatrisation : proteines (selon plafond renal eventuel),
  vitamine C, zinc, vitamine A (carotte, courge, patate douce), proline
  (gelatine, bouillon d'os).
- Hydratation pour la microcirculation.
- Eviter sucres rapides qui ralentissent la cicatrisation.

INTERDIT :
- Promettre une "regression" des complications (irreversibles dans la
  plupart des cas).
- Recommander des supplements antioxydants a haute dose (vit E, beta-carotene)
  sans avis medical : peuvent etre pro-oxydants chez certains patients.
- Negliger les signaux d'alerte : baisse brutale de vision, douleur
  oculaire intense, plaie qui ne cicatrise pas, douleur thoracique →
  URGENCE, consultation immediate.

NOTES POUR LE PLAN :
- Toujours mentionner que ces ajustements completent le suivi medical
  specialise (ophtalmo annuel, cardiologue, podologue).
- Articuler les leviers comme un soutien global ralentissant la progression,
  jamais comme un traitement curatif.
`;
