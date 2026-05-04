// V96.12 — Profile module : infection a Clostridioides difficile (CDI),
// active ou en post-traitement / surveillance recidive.
//
// DRAFT — regles directionnelles a valider avec Anissa avant activation
// production. La CDI est une pathologie infectieuse SEVERE : suivi
// gastroenterologue obligatoire (vancomycine, fidaxomicine, parfois
// transplantation fecale). La nutrition est un SUPPORT, jamais un
// traitement de premiere ligne.

export const CLOSTRIDIUM_DIFFICILE_MODULE_FR = `
ADAPTATION CLOSTRIDIOIDES DIFFICILE (priorite tres haute) :

CADRAGE CLINIQUE — A POSER EN INTRO DU PLAN :
La nutrition vient en SUPPORT du traitement medical (suivi gastroenterologue
obligatoire, antibiotique cible deja en cours). Le plan ne remplace ni la
vancomycine, ni la fidaxomicine, ni une eventuelle transplantation fecale.

OBJECTIFS DE LA NUTRITION :
1. Reconstruire un microbiote diversifie pour reduire le risque de recidive
2. Securiser hydratation et electrolytes en phase symptomatique
3. Reduire la charge digestive sans appauvrir le microbiote
4. Eviter les declencheurs de poussee (sucres rapides, ultra-transformes)

PHASE AIGUE (diarrhee active, sous antibio) :
- Hydratation prioritaire : 2 a 2,5 L/jour, soluton de rehydratation orale
  (SRO en pharmacie) si pertes severes. Bouillons clairs, eau de riz,
  tisanes douces (camomille, fenouil).
- Aliments tres digestes : riz blanc bien cuit, banane mure, pomme cuite,
  carotte cuite, courge, poulet vapeur, oeuf coque, poisson blanc.
- Eviter en aigu : laitages fermentes, fibres insolubles brutes (cruditees,
  son, legumineuses entieres), graisses lourdes, fritures, alcool, cafe,
  sucres rapides, sodas, edulcorants (sorbitol, mannitol, maltitol).
- Repas FRACTIONNES : 5 a 6 petites prises plutot que 3 grandes.
- Probiotique : la litterature soutient Saccharomyces boulardii (CNCM I-745)
  comme adjuvant, mais NE PAS prescrire sans avis du gastroenterologue,
  surtout si immunodepression (risque rare de fungemie).

PHASE DE RECONSTRUCTION (apres resolution des symptomes) :
- Reintroduction PROGRESSIVE des fibres prebiotiques : commencer par les
  cuites bien tolerees (poireau cuit, courgette, courge, banane peu mure,
  patate douce), puis crues si bien digere.
- Reintroduction des fermentes en TRES petite quantite (yaourt nature, kefir,
  miso non pasteurise, choucroute crue) : 1 a 2 cuilleres a soupe au
  depart, augmenter selon tolerance.
- Diversite alimentaire : viser 25 a 30 vegetaux differents par semaine
  pour resemer un microbiote varie (objectif anti-recidive cle).
- Polyphenols : fruits rouges, the vert, cacao non sucre, huile d'olive
  vierge, epices anti-inflammatoires (curcuma + poivre, gingembre).
- Lipides de qualite : oméga-3 (poisson gras 2-3x/semaine), huile d'olive
  vierge, oleagineux trempes si bien tolerees.
- Proteines : maintenir l'apport (viande maigre, poisson, oeufs, tofu),
  legumineuses reintroduites en bouillies tres cuites puis entieres.

PREVENTION DES RECIDIVES (vigilance permanente, surtout 8 premieres semaines
apres l'episode) :
- TOUTE nouvelle prescription d'antibiotique doit etre signalee au medecin
  qui suit la CDI : preferer un antibiotique a spectre etroit si possible.
- Probiotique adjuvant systematique pendant et 1-2 semaines apres tout
  traitement antibiotique (avis medical).
- Limiter au maximum les inhibiteurs de la pompe a protons (IPP / omeprazole)
  qui augmentent le risque de recidive — c'est une discussion avec le
  medecin, pas une recommandation directe a la cliente.
- Hygiene des mains rigoureuse (les sporulations resistent aux gels
  hydroalcooliques : lavage savon + eau).

INTERDIT ABSOLU :
- Promettre une "guerison definitive" : la CDI recidive chez 15-25% des
  patients meme bien traites.
- Prescrire un probiotique specifique sans validation du gastroenterologue
  (risque rare mais reel de fungemie a S. boulardii chez immunodeprimes,
  porteurs de catheter central, patients en soins intensifs).
- Recommander un regime tres restrictif sur la duree (>4 semaines de phase
  aigue), qui appauvrirait encore le microbiote.
- Negliger les signaux d'alerte : fievre, sang dans les selles, douleurs
  abdominales severes, distension abdominale majeure, alteration de l'etat
  general → URGENCE, consultation immediate (risque de megacolon toxique).

NOTES POUR LE PLAN :
- Cadrer en intro le perimetre nutrition vs perimetre medical
- Donner une fiche frigo speciale "phase aigue" et une "phase reconstruction"
- Ajouter une section "signaux d'alerte" claire que la cliente peut afficher
- Suivre l'evolution de pres : un point chaque 2 semaines pendant 8 semaines
`;
