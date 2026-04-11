import { useState, useMemo } from 'react';

const SUPPLEMENTS = [
  // === VITAMINES ===
  {
    category: 'Vitamines',
    name: 'Vitamine D3',
    description: 'Vitamine liposoluble essentielle pour l\'immunite, les os et l\'humeur.',
    dosage: '1000-4000 UI/jour selon statut sanguin',
    moment: 'Matin ou midi, avec un repas contenant du gras',
    momentTag: 'matin',
    takeWith: 'Vitamine K2 (100-200mcg), magnesium (ameliore l\'activation)',
    avoidWith: 'Rien de particulier',
    brands: 'Burgerstein Vitamin D3, Pure Encapsulations D3',
    natural: 'Exposition soleil 15-20 min bras decouverts, poissons gras, jaune d\'oeuf',
  },
  {
    category: 'Vitamines',
    name: 'Vitamine K2',
    description: 'Dirige le calcium vers les os et evite la calcification arterielle.',
    dosage: '100-200 mcg/jour (forme MK-7 preferee)',
    moment: 'Avec le repas contenant du gras (matin ou midi)',
    momentTag: 'matin',
    takeWith: 'Vitamine D3 (synergie), calcium',
    avoidWith: 'Anticoagulants (warfarine) — coordination medecin OBLIGATOIRE',
    brands: 'Burgerstein K2, Pure Encapsulations K2',
    natural: 'Natto, fromages affines, jaune d\'oeuf',
  },
  {
    category: 'Vitamines',
    name: 'Vitamine C',
    description: 'Antioxydant puissant, soutien immunitaire, synthese du collagene.',
    dosage: '500-1000 mg/jour (fractionner en 2 prises si >500mg)',
    moment: 'Matin et/ou midi (peut perturber le sommeil le soir)',
    momentTag: 'matin',
    takeWith: 'Fer (ameliore l\'absorption du fer x6)',
    avoidWith: 'Cuivre en meme temps (competition absorption)',
    brands: 'Burgerstein Vitamin C, Nahrin Acerola',
    natural: 'Kiwi, poivron rouge, cassis, persil, brocoli',
  },
  {
    category: 'Vitamines',
    name: 'Complexe B',
    description: 'Groupe de vitamines indispensables a l\'energie et au systeme nerveux.',
    dosage: '1 gelule/jour (forme methylee si MTHFR)',
    moment: 'Matin avec le petit-dejeuner (les B stimulent l\'energie)',
    momentTag: 'matin',
    takeWith: 'Magnesium (synergie B6 + Mg)',
    avoidWith: 'Le soir (peut perturber le sommeil, surtout B6 et B12)',
    brands: 'Burgerstein B-Complex, Pure Encapsulations B-Complex Plus',
    natural: 'Levure nutritionnelle, foie, oeufs, legumineuses',
  },
  {
    category: 'Vitamines',
    name: 'Vitamine B12',
    description: 'Indispensable a la formation des globules rouges et au systeme nerveux.',
    dosage: '500-1000 mcg/jour (forme methylcobalamine)',
    moment: 'Matin, sous la langue (sublingual = meilleure absorption)',
    momentTag: 'matin',
    takeWith: 'Folates (B9) pour la synergie methylation',
    avoidWith: 'Le soir (peut stimuler), vitamine C haute dose en meme temps (peut degrader la B12)',
    brands: 'Burgerstein B12, Pure Encapsulations B12',
    natural: 'Foie, viande rouge, sardines, oeufs (IMPOSSIBLE pour les vegans — supplementation obligatoire)',
  },
  {
    category: 'Vitamines',
    name: 'Folates (B9)',
    description: 'Essentiels pour la methylation et la production d\'ADN.',
    dosage: '400-800 mcg/jour (forme methylfolate, PAS acide folique si MTHFR)',
    moment: 'Matin',
    momentTag: 'matin',
    takeWith: 'B12 (synergie methylation)',
    avoidWith: 'Acide folique synthetique si MTHFR (forme non utilisable)',
    brands: 'Pure Encapsulations Folate, Burgerstein Acide Folique',
    natural: 'Epinards, brocoli, asperges, lentilles, foie',
  },

  // === MINERAUX ===
  {
    category: 'Mineraux',
    name: 'Magnesium',
    description: 'Relaxation musculaire et nerveuse, sommeil, energie cellulaire.',
    dosage: '300-400 mg/jour (forme bisglycinate ou citrate)',
    moment: 'SOIR / COUCHER (effet relaxant, ameliore le sommeil)',
    momentTag: 'coucher',
    takeWith: 'Vitamine B6 (ameliore l\'absorption), vitamine D3',
    avoidWith: 'Fer (en meme temps — espacement 2h minimum), calcium (en meme temps — competition absorption), zinc (en meme temps — espacement 2h)',
    brands: 'Burgerstein Magnesium, Pure Encapsulations Magnesium Glycinate',
    natural: 'Amandes, graines de courge, chocolat noir 85%, epinards, eaux minerales (Hepar)',
  },
  {
    category: 'Mineraux',
    name: 'Fer',
    description: 'Transport de l\'oxygene, energie, formation des globules rouges.',
    dosage: '14-30 mg/jour selon carence (forme bisglycinate = mieux toleree)',
    moment: 'MATIN A JEUN (30 min avant le petit-dejeuner) pour absorption maximale',
    momentTag: 'matin-jeun',
    takeWith: 'Vitamine C (ameliore absorption x6), sur estomac vide',
    avoidWith: 'Cafe, the, calcium, magnesium, zinc (attendre 2h minimum). Produits laitiers. IPP (omeprazole). Ne JAMAIS supplementer sans analyse de ferritine.',
    brands: 'Burgerstein Fer, Pure Encapsulations Iron',
    natural: 'Boudin noir, lentilles, epinards cuits + citron, viande rouge, graines de courge',
  },
  {
    category: 'Mineraux',
    name: 'Zinc',
    description: 'Immunite, cicatrisation, hormones, peau et cheveux.',
    dosage: '15-30 mg/jour (forme picolinate ou bisglycinate)',
    moment: 'Soir, avec un repas (peut causer nausees a jeun)',
    momentTag: 'soir',
    takeWith: 'Un repas proteine (ameliore absorption)',
    avoidWith: 'Fer (en meme temps — competition), calcium (en meme temps), cuivre longue duree (le zinc deplete le cuivre — ajouter 1-2mg cuivre si >30mg zinc/jour pendant >8 semaines)',
    brands: 'Burgerstein Zinc, Pure Encapsulations Zinc',
    natural: 'Huitres, graines de courge, boeuf, lentilles',
  },
  {
    category: 'Mineraux',
    name: 'Calcium',
    description: 'Sante osseuse, contraction musculaire, coagulation.',
    dosage: '500-1000 mg/jour (fractionner en 2 prises de 500mg max)',
    moment: 'Avec les repas (midi et soir)',
    momentTag: 'midi',
    takeWith: 'Vitamine D3 + K2 (TOUJOURS — le D3 ameliore absorption, le K2 dirige vers les os)',
    avoidWith: 'Fer (espacement 2h), magnesium (espacement 2h), zinc (espacement 2h), levothyroxine (espacement 4h), antibiotiques quinolones',
    brands: 'Burgerstein Calcium, Nahrin Calcium',
    natural: 'Sardines en boite (avec aretes), amandes, brocoli, chou kale, eaux calciques (Hepar, Contrex)',
  },
  {
    category: 'Mineraux',
    name: 'Selenium',
    description: 'Antioxydant puissant, fonction thyroidienne, immunite.',
    dosage: '100-200 mcg/jour (ATTENTION au surdosage)',
    moment: 'Matin avec le petit-dejeuner',
    momentTag: 'matin',
    takeWith: 'Vitamine E (synergie antioxydante)',
    avoidWith: 'Vitamine C haute dose en meme temps (peut reduire absorption)',
    brands: 'Burgerstein Selenium, Pure Encapsulations Selenium',
    natural: '2-3 noix du Bresil/jour = apport quotidien complet (attention pas plus, risque surdosage)',
  },
  {
    category: 'Mineraux',
    name: 'Iode',
    description: 'Synthese des hormones thyroidiennes, metabolisme.',
    dosage: '150-300 mcg/jour',
    moment: 'Matin',
    momentTag: 'matin',
    takeWith: 'Selenium (synergie thyroidienne)',
    avoidWith: 'Exces de soja cru, cruciferes crus en grande quantite (goitrogenes)',
    brands: 'Burgerstein Iode, Nahrin',
    natural: 'Algues (wakame, nori), poisson de mer, sel iode, produits laitiers',
  },
  {
    category: 'Mineraux',
    name: 'Chrome',
    description: 'Sensibilite a l\'insuline, regulation de la glycemie.',
    dosage: '200-400 mcg/jour (forme picolinate)',
    moment: 'Avec le dejeuner',
    momentTag: 'midi',
    takeWith: 'Un repas contenant des glucides (ameliore la sensibilite a l\'insuline)',
    avoidWith: 'Fer (peut interferer), antidiabetiques sans avis medecin',
    brands: 'Burgerstein Chrome, Pure Encapsulations Chromium',
    natural: 'Brocoli, haricots verts, levure de biere, champignons',
  },

  // === ACIDES GRAS ===
  {
    category: 'Acides gras',
    name: 'Omega-3 (EPA/DHA)',
    description: 'Anti-inflammatoire, sante cardiovasculaire, cerveau.',
    dosage: '1-3g EPA+DHA/jour (ratio EPA>DHA pour inflammation, DHA>EPA pour cerveau)',
    moment: 'Avec le repas le plus gras (midi ou soir)',
    momentTag: 'midi',
    takeWith: 'Un repas contenant du gras (absorption x3)',
    avoidWith: 'Anticoagulants haute dose (effet anticoagulant cumule — coordination medecin si >3g/jour), aspirine haute dose',
    brands: 'Burgerstein Omega-3, Pure Encapsulations EPA/DHA',
    natural: 'Sardines, maquereau, saumon sauvage (3 portions/semaine), graines de lin moulues, noix',
  },
  {
    category: 'Acides gras',
    name: 'GLA (huile d\'onagre)',
    description: 'Acide gras omega-6 anti-inflammatoire, peau et hormones.',
    dosage: '500-1500 mg/jour',
    moment: 'Avec un repas',
    momentTag: 'midi',
    takeWith: 'Omega-3 (synergie anti-inflammatoire)',
    avoidWith: 'Anticoagulants (effet cumule)',
    brands: 'Burgerstein Huile d\'Onagre',
    natural: 'Huile de bourrache, graines de chanvre',
  },

  // === ACIDES AMINES ===
  {
    category: 'Acides amines',
    name: 'L-Glutamine',
    description: 'Sante intestinale, recuperation musculaire, immunite.',
    dosage: '5-10g/jour',
    moment: 'A jeun le matin ou avant le coucher',
    momentTag: 'matin-jeun',
    takeWith: 'Sur estomac vide pour meilleure absorption',
    avoidWith: 'Rien de particulier',
    brands: 'Pure Encapsulations L-Glutamine, Burgerstein',
    natural: 'Bouillon d\'os, viande, poisson, chou, epinards',
  },
  {
    category: 'Acides amines',
    name: 'Collagene',
    description: 'Sante des articulations, peau, cheveux, tendons.',
    dosage: '10-15g/jour (hydrolyse)',
    moment: '30-60 min AVANT l\'entrainement (si sportif), sinon le matin',
    momentTag: 'matin',
    takeWith: 'Vitamine C (essentielle pour la synthese du collagene)',
    avoidWith: 'Rien de particulier',
    brands: 'Burgerstein Collagen, Pure Encapsulations',
    natural: 'Bouillon d\'os, peau de poulet, sardines entieres',
  },

  // === PROBIOTIQUES ET DIGESTIF ===
  {
    category: 'Probiotiques & digestif',
    name: 'Probiotiques',
    description: 'Equilibre du microbiote, immunite, digestion.',
    dosage: '10-50 milliards UFC/jour (multi-souches : Lactobacillus + Bifidobacterium)',
    moment: 'MATIN A JEUN (20-30 min avant le petit-dejeuner)',
    momentTag: 'matin-jeun',
    takeWith: 'Sur estomac vide, loin des antibiotiques (2h minimum d\'ecart)',
    avoidWith: 'Boissons chaudes (detruisent les bacteries), antibiotiques en meme temps',
    brands: 'Burgerstein Biotics, Pure Encapsulations Probiotic',
    natural: 'Kefir, choucroute, kimchi, kombucha, yaourt nature, miso',
  },
  {
    category: 'Probiotiques & digestif',
    name: 'Enzymes digestives',
    description: 'Amelioration de la digestion des proteines, gras et glucides.',
    dosage: '1-2 gelules par repas',
    moment: 'Au DEBUT de chaque repas principal',
    momentTag: 'midi',
    takeWith: 'Les premiers bouchees du repas',
    avoidWith: 'A jeun (inutile sans nourriture)',
    brands: 'Pure Encapsulations Digestive Enzymes',
    natural: 'Ananas frais (bromelaine), papaye (papaine), vinaigre de cidre dilue avant repas',
  },
  {
    category: 'Probiotiques & digestif',
    name: 'Psyllium',
    description: 'Fibre soluble pour le transit et la satiete.',
    dosage: '5-10g/jour dans 250ml d\'eau',
    moment: '30 min avant un repas (coupe-faim) ou au coucher (transit)',
    momentTag: 'coucher',
    takeWith: 'BEAUCOUP d\'eau (minimum 250ml, sinon risque obstruction)',
    avoidWith: 'Medicaments (espacement 2h — le psyllium peut reduire l\'absorption)',
    brands: 'Disponible en pharmacie (marque generique OK)',
    natural: 'Graines de lin moulues (1-2 c.s./jour avec eau), graines de chia',
  },

  // === ANTIOXYDANTS / ANTI-INFLAMMATOIRES ===
  {
    category: 'Antioxydants & anti-inflammatoires',
    name: 'Curcuma + Piperine',
    description: 'Puissant anti-inflammatoire naturel.',
    dosage: '500-1500 mg curcumine/jour avec 5-10mg piperine',
    moment: 'Avec un repas contenant du gras (midi ou soir)',
    momentTag: 'midi',
    takeWith: 'Poivre noir (piperine augmente absorption x2000), gras (absorption)',
    avoidWith: 'Anticoagulants (effet anticoagulant), antidiabetiques (peut baisser la glycemie), chimiotherapie (demander a l\'oncologue)',
    brands: 'Burgerstein Curcuma, Pure Encapsulations Curcumin',
    natural: 'Curcuma frais rape + poivre noir + huile d\'olive dans les plats, golden milk',
  },
  {
    category: 'Antioxydants & anti-inflammatoires',
    name: 'CoQ10 (Coenzyme Q10)',
    description: 'Energie mitochondriale, sante cardiovasculaire.',
    dosage: '100-300 mg/jour (forme ubiquinol si >40 ans)',
    moment: 'Avec un repas contenant du gras (matin ou midi)',
    momentTag: 'matin',
    takeWith: 'Gras (ameliore absorption), vitamine E (synergie)',
    avoidWith: 'Le soir (peut stimuler l\'energie), statines (INDISPENSABLE avec les statines — elles depletent le CoQ10)',
    brands: 'Burgerstein Coenzyme Q10, Pure Encapsulations CoQ10',
    natural: 'Sardines, boeuf, cacahuetes, epinards, brocoli',
  },
  {
    category: 'Antioxydants & anti-inflammatoires',
    name: 'NAC (N-Acetyl Cysteine)',
    description: 'Precurseur du glutathion, detox, anti-oxydant.',
    dosage: '600-1200 mg/jour',
    moment: 'A jeun (meilleure absorption)',
    momentTag: 'matin-jeun',
    takeWith: 'Vitamine C (synergie antioxydante)',
    avoidWith: 'Nitroglycerine, charbon actif. Attention si asthme (peut causer bronchospasme rare)',
    brands: 'Pure Encapsulations NAC',
    natural: 'Ail, oignon, cruciferes, oeufs (riches en cysteine, precurseur du glutathion)',
  },
  {
    category: 'Antioxydants & anti-inflammatoires',
    name: 'Resveratrol',
    description: 'Anti-age, polyphenol antioxydant, sante cardiovasculaire.',
    dosage: '150-500 mg/jour (trans-resveratrol)',
    moment: 'Matin avec le petit-dejeuner',
    momentTag: 'matin',
    takeWith: 'Quercetine (synergie), gras',
    avoidWith: 'Anticoagulants (effet anticoagulant leger)',
    brands: 'Pure Encapsulations Resveratrol',
    natural: 'Raisin rouge, myrtilles, chocolat noir, vin rouge (en tres petite quantite)',
  },

  // === ADAPTOGENES ET STRESS ===
  {
    category: 'Adaptogenes & stress',
    name: 'Ashwagandha',
    description: 'Adaptogene anti-stress, soutien surrenalien et hormonal.',
    dosage: '300-600 mg/jour (extrait KSM-66 ou Sensoril)',
    moment: 'Soir / coucher (effet relaxant) ou matin si besoin d\'energie',
    momentTag: 'coucher',
    takeWith: 'Un repas',
    avoidWith: 'Sedatifs, benzodiazepines (effet cumule). Contre-indique si hyperthyroidie, grossesse, maladies auto-immunes thyroidiennes',
    brands: 'Pure Encapsulations Ashwagandha',
    natural: 'Rhodiola, basilic sacre (tulsi), passiflore',
  },
  {
    category: 'Adaptogenes & stress',
    name: 'Rhodiola',
    description: 'Adaptogene stimulant, energie mentale, resistance au stress.',
    dosage: '200-400 mg/jour (extrait standardise 3% rosavines)',
    moment: 'MATIN (stimulant — eviter le soir)',
    momentTag: 'matin',
    takeWith: 'A jeun ou avec petit-dejeuner leger',
    avoidWith: 'Antidepresseurs ISRS (risque syndrome serotoninergique), le soir (insomnie)',
    brands: 'Pure Encapsulations Rhodiola',
    natural: 'Ginseng, eleutherocoque, maca',
  },

  // === SOMMEIL ===
  {
    category: 'Sommeil',
    name: 'Melatonine',
    description: 'Hormone du sommeil, aide a l\'endormissement.',
    dosage: '0.5-3 mg (commencer par 0.5mg, dose minimale efficace)',
    moment: '30-60 min AVANT le coucher, dans l\'obscurite',
    momentTag: 'coucher',
    takeWith: 'Magnesium (synergie sommeil)',
    avoidWith: 'Sedatifs, benzodiazepines, alcool, anticoagulants. Usage court terme preferable (<8 semaines)',
    brands: 'Disponible en pharmacie',
    natural: 'Lumiere naturelle le matin, pas d\'ecran 1h avant coucher, tryptophane (graines de courge, dinde), tisane camomille + passiflore',
  },
  {
    category: 'Sommeil',
    name: 'L-Theanine',
    description: 'Acide amine relaxant sans sedation, focus calme.',
    dosage: '100-200 mg',
    moment: 'Le soir pour le sommeil, ou dans la journee pour le focus sans nervosite',
    momentTag: 'coucher',
    takeWith: 'Magnesium (synergie relaxation), ou cafe (focus sans jitters)',
    avoidWith: 'Rien de problematique (tres sur)',
    brands: 'Pure Encapsulations L-Theanine',
    natural: 'The vert (matcha), the gyokuro',
  },

  // === SANTE INTESTINALE ===
  {
    category: 'Sante intestinale',
    name: 'Zinc Carnosine',
    description: 'Reparation de la muqueuse gastrique et intestinale.',
    dosage: '75 mg 2x/jour',
    moment: 'Entre les repas (estomac vide)',
    momentTag: 'matin-jeun',
    takeWith: 'L-Glutamine (synergie muqueuse intestinale)',
    avoidWith: 'Fer, calcium en meme temps (competition absorption)',
    brands: 'Pure Encapsulations Zinc Carnosine',
    natural: 'Bouillon d\'os + zinc alimentaire (graines de courge)',
  },
  {
    category: 'Sante intestinale',
    name: 'Acide butyrique',
    description: 'Carburant des colonocytes, sante de la paroi intestinale.',
    dosage: '300-600 mg/jour',
    moment: 'Avec un repas',
    momentTag: 'midi',
    takeWith: 'Probiotiques (synergie microbiote)',
    avoidWith: 'Rien de particulier',
    brands: 'BodyBio Butyrate',
    natural: 'Beurre, ghee, fibres solubles (produisent du butyrate via fermentation)',
  },
  {
    category: 'Sante intestinale',
    name: 'Saccharomyces Boulardii',
    description: 'Levure probiotique protectrice du microbiote.',
    dosage: '250-500 mg/jour',
    moment: 'Matin ou soir avec un repas',
    momentTag: 'matin',
    takeWith: 'Compatible avec antibiotiques (levure, pas une bacterie)',
    avoidWith: 'Antifongiques (detruisent cette levure)',
    brands: 'Pure Encapsulations Saccharomyces',
    natural: 'Kefir, kombucha (contiennent des levures benefiques)',
  },

  // === HORMONES & THYROIDE ===
  {
    category: 'Hormones & thyroide',
    name: 'Inositol (Myo + D-Chiro)',
    description: 'Soutien hormonal feminin, SOPK, sensibilite a l\'insuline.',
    dosage: '4000 mg myo-inositol + 100 mg D-chiro-inositol/jour (ratio 40:1)',
    moment: 'Matin et soir (fractionner en 2 prises)',
    momentTag: 'matin',
    takeWith: 'Folates (synergie SOPK)',
    avoidWith: 'Rien de particulier',
    brands: 'Pure Encapsulations Inositol',
    natural: 'Agrumes, haricots, noix, graines, cereales completes',
  },
  {
    category: 'Hormones & thyroide',
    name: 'DIM (Diindolylmethane)',
    description: 'Metabolisme des oestrogenes, equilibre hormonal.',
    dosage: '100-200 mg/jour',
    moment: 'Avec un repas contenant du gras',
    momentTag: 'midi',
    takeWith: 'Calcium D-Glucarate (synergie metabolisme oestrogenes)',
    avoidWith: 'Contraception hormonale (peut modifier l\'efficacite — demander au medecin)',
    brands: 'Pure Encapsulations DIM',
    natural: 'Brocoli, chou-fleur, chou kale, choux de Bruxelles (100-200g/jour)',
  },
  {
    category: 'Hormones & thyroide',
    name: 'Vitex (Gattilier)',
    description: 'Plante pour le cycle feminin, soutien progesterone.',
    dosage: '20-40 mg extrait standardise/jour',
    moment: 'Matin a jeun',
    momentTag: 'matin-jeun',
    takeWith: 'Seul, loin des repas',
    avoidWith: 'Contraception hormonale, traitement FIV, antipsychotiques dopaminergiques. Contre-indique si SOPK avec LH elevee',
    brands: 'Pure Encapsulations Vitex',
    natural: 'Pas d\'equivalent naturel direct',
  },

  // === DETOXIFICATION & FOIE ===
  {
    category: 'Detoxification & foie',
    name: 'Chardon-Marie (Silymarine)',
    description: 'Protection et regeneration hepatique.',
    dosage: '200-400 mg silymarine/jour',
    moment: 'Avant les repas (20 min)',
    momentTag: 'midi',
    takeWith: 'Curcuma (synergie hepatique)',
    avoidWith: 'Medicaments metabolises par le foie (CYP450) — peut modifier leur efficacite. Verifier avec le medecin',
    brands: 'Burgerstein Chardon-Marie, Sekoya',
    natural: 'Artichaut, radis noir, pissenlit, citron dans l\'eau tiede le matin',
  },
  {
    category: 'Detoxification & foie',
    name: 'Glutathion liposomal',
    description: 'Maitre antioxydant, detox hepatique cellulaire.',
    dosage: '250-500 mg/jour (forme liposomale)',
    moment: 'A jeun ou avec un repas leger',
    momentTag: 'matin-jeun',
    takeWith: 'Vitamine C (synergie antioxydante), selenium, NAC (precurseur)',
    avoidWith: 'Chimiotherapie sans avis oncologue',
    brands: 'Pure Encapsulations Glutathione, Quicksilver',
    natural: 'Ail, oignon, cruciferes, avocat, asperges, noix',
  },
  {
    category: 'Detoxification & foie',
    name: 'Acide alpha-lipoique (ALA)',
    description: 'Antioxydant universel, regeneration des autres antioxydants.',
    dosage: '300-600 mg/jour',
    moment: 'A jeun (30 min avant repas)',
    momentTag: 'matin-jeun',
    takeWith: 'Biotine (l\'ALA peut reduire la biotine — supplementer si longue duree)',
    avoidWith: 'Insuline ou antidiabetiques sans avis medecin (peut baisser la glycemie)',
    brands: 'Pure Encapsulations Alpha-Lipoic Acid',
    natural: 'Epinards, brocoli, levure, abats (en tres petites quantites)',
  },

  // === CERVEAU & COGNITION ===
  {
    category: 'Cerveau & cognition',
    name: 'Phosphatidylserine',
    description: 'Phospholipide cerebral, memoire, gestion du cortisol.',
    dosage: '100-300 mg/jour',
    moment: 'Avec un repas (midi ou soir)',
    momentTag: 'midi',
    takeWith: 'Omega-3 DHA (synergie cerebrale)',
    avoidWith: 'Anticoagulants (peut avoir un leger effet anticoagulant)',
    brands: 'Pure Encapsulations PS',
    natural: 'Soja, hareng, maquereau, abats',
  },
  {
    category: 'Cerveau & cognition',
    name: 'Lion\'s Mane (Hericium)',
    description: 'Champignon neurotrophique, soutien du NGF et de la cognition.',
    dosage: '500-3000 mg/jour',
    moment: 'Matin ou midi (peut stimuler)',
    momentTag: 'matin',
    takeWith: 'Repas',
    avoidWith: 'Anticoagulants (prudence). Contre-indique si allergie aux champignons',
    brands: 'Disponible en magasins bio suisses',
    natural: 'Champignons shiitake, maitake, reishi (effets similaires mais moins puissants)',
  },

  // === ARTICULATIONS & TISSUS ===
  {
    category: 'Articulations & tissus',
    name: 'Glucosamine + Chondroitine',
    description: 'Soutien cartilage, arthrose, mobilite articulaire.',
    dosage: '1500 mg glucosamine + 1200 mg chondroitine/jour',
    moment: 'Avec un repas (fractionner en 2-3 prises)',
    momentTag: 'midi',
    takeWith: 'Vitamine C, MSM (synergie articulaire)',
    avoidWith: 'Anticoagulants (warfarine — la glucosamine peut potentialiser l\'effet)',
    brands: 'Burgerstein Glucosamine',
    natural: 'Bouillon d\'os, cartilage de poulet, coquilles de crustaces',
  },
  {
    category: 'Articulations & tissus',
    name: 'MSM (Methylsulfonylmethane)',
    description: 'Source de soufre biodisponible, anti-inflammatoire articulaire.',
    dosage: '1000-3000 mg/jour',
    moment: 'Avec un repas (fractionner si >1500mg)',
    momentTag: 'midi',
    takeWith: 'Vitamine C (synergie collagene), glucosamine',
    avoidWith: 'Anticoagulants (prudence)',
    brands: 'Pure Encapsulations MSM',
    natural: 'Oignon, ail, cruciferes, oeufs (contiennent du soufre)',
  },
  {
    category: 'Articulations & tissus',
    name: 'Boswellia',
    description: 'Resine anti-inflammatoire naturelle, douleurs articulaires.',
    dosage: '300-500 mg extrait standardise (65% acides boswelliques) 3x/jour',
    moment: 'Avec les repas',
    momentTag: 'midi',
    takeWith: 'Curcuma (synergie anti-inflammatoire)',
    avoidWith: 'AINS (effet cumule — prudence), immunosuppresseurs',
    brands: 'Pure Encapsulations Boswellia',
    natural: 'Pas d\'equivalent direct — curcuma + gingembre en approche combinee',
  },
  {
    category: 'Articulations & tissus',
    name: 'Silicium',
    description: 'Mineral des tissus conjonctifs, peau, cheveux, os.',
    dosage: '5-10 mg silicium element/jour',
    moment: 'A jeun ou entre les repas',
    momentTag: 'matin-jeun',
    takeWith: 'Vitamine C, collagene (synergie tissus conjonctifs)',
    avoidWith: 'Rien de particulier',
    brands: 'Sekoya Silicium',
    natural: 'Bambou, prele, ortie, avoine, eau de source riche en silice',
  },

  // === ENERGIE & MITOCHONDRIES ===
  {
    category: 'Energie & mitochondries',
    name: 'D-Ribose',
    description: 'Sucre precurseur de l\'ATP, energie mitochondriale.',
    dosage: '5 g 2-3x/jour',
    moment: 'Avant et apres l\'effort, ou matin et soir',
    momentTag: 'matin',
    takeWith: 'CoQ10, magnesium (synergie energetique mitochondriale)',
    avoidWith: 'Insuline (peut baisser la glycemie)',
    brands: 'Pure Encapsulations Ribose',
    natural: 'Pas d\'equivalent alimentaire significatif',
  },
  {
    category: 'Energie & mitochondries',
    name: 'PQQ (Pyrroloquinoline Quinone)',
    description: 'Biogenese mitochondriale, protection neuronale.',
    dosage: '10-20 mg/jour',
    moment: 'Matin avec petit-dejeuner',
    momentTag: 'matin',
    takeWith: 'CoQ10 (synergie mitochondriale)',
    avoidWith: 'Rien de particulier connu',
    brands: 'Pure Encapsulations PQQ',
    natural: 'Natto, persil, the vert, papaye, kiwi (en tres petites quantites)',
  },
  {
    category: 'Energie & mitochondries',
    name: 'Creatine Monohydrate',
    description: 'Energie musculaire, force, cognition, recuperation.',
    dosage: '3-5 g/jour (pas besoin de phase de charge)',
    moment: 'N\'importe quand (post-entrainement si sportif)',
    momentTag: 'midi',
    takeWith: 'Glucides (ameliore absorption), eau en quantite',
    avoidWith: 'Cafeine haute dose (peut reduire l\'efficacite selon certaines etudes). Prudence si problemes renaux — verifier avec medecin',
    brands: 'Disponible en magasins sport suisses (CreaPure = label qualite)',
    natural: 'Viande rouge, poisson (5g creatine = ~1kg de boeuf — supplementation quasi obligatoire)',
  },

  // === IMMUNITE ===
  {
    category: 'Immunite',
    name: 'Beta-Glucanes',
    description: 'Modulation et soutien du systeme immunitaire.',
    dosage: '250-500 mg/jour',
    moment: 'A jeun le matin',
    momentTag: 'matin-jeun',
    takeWith: 'Vitamine C (synergie immunite)',
    avoidWith: 'Immunosuppresseurs (stimule le systeme immunitaire — contre-indication)',
    brands: 'Pure Encapsulations Beta-Glucan',
    natural: 'Champignons shiitake, maitake, reishi, avoine, levure de biere',
  },
  {
    category: 'Immunite',
    name: 'Quercetine',
    description: 'Flavonoide anti-histamine, anti-inflammatoire, immunite.',
    dosage: '500-1000 mg/jour',
    moment: 'Avec un repas',
    momentTag: 'midi',
    takeWith: 'Vitamine C (ameliore absorption), resveratrol (synergie)',
    avoidWith: 'Antibiotiques quinolones (interaction possible), ciclosporine',
    brands: 'Pure Encapsulations Quercetin',
    natural: 'Oignon rouge, pomme, baies, capres, the vert, vin rouge',
  },
  {
    category: 'Immunite',
    name: 'Sureau',
    description: 'Anti-viral naturel, soutien hivernal.',
    dosage: '300-600 mg extrait/jour (en periode hivernale)',
    moment: 'Matin avec petit-dejeuner',
    momentTag: 'matin',
    takeWith: 'Vitamine C, zinc (synergie anti-rhume)',
    avoidWith: 'Immunosuppresseurs, diuretiques',
    brands: 'Disponible en pharmacie suisse',
    natural: 'Baies de sureau fraiches ou sirop maison (cuisson obligatoire — toxique cru)',
  },

  // === PEAU, CHEVEUX, ONGLES ===
  {
    category: 'Peau, cheveux, ongles',
    name: 'Biotine (B7)',
    description: 'Vitamine des phaneres : peau, cheveux, ongles.',
    dosage: '2500-5000 mcg/jour',
    moment: 'Avec un repas',
    momentTag: 'matin',
    takeWith: 'Zinc, silicium (synergie peau/cheveux/ongles)',
    avoidWith: 'ATTENTION : la biotine FAUSSE certains tests sanguins (thyroide, troponine). Arreter 48h avant une prise de sang',
    brands: 'Burgerstein Biotine',
    natural: 'Jaune d\'oeuf, foie, noix, legumineuses, champignons',
  },
  {
    category: 'Peau, cheveux, ongles',
    name: 'Acide hyaluronique',
    description: 'Hydratation cutanee et articulaire.',
    dosage: '120-240 mg/jour',
    moment: 'Avec un repas',
    momentTag: 'midi',
    takeWith: 'Vitamine C, collagene (synergie peau)',
    avoidWith: 'Rien de particulier',
    brands: 'Pure Encapsulations Hyaluronic Acid',
    natural: 'Bouillon d\'os, patate douce, soja, agrumes (stimulent la production naturelle)',
  },

  // === LONGEVITE & BIOHACKING ===
  {
    category: 'Longevite & biohacking',
    name: 'NMN (Nicotinamide Mononucleotide)',
    description: 'Precurseur du NAD+, longevite cellulaire.',
    dosage: '250-500 mg/jour',
    moment: 'Matin (active le metabolisme)',
    momentTag: 'matin',
    takeWith: 'Resveratrol, TMG (trimethylglycine) pour soutenir la methylation',
    avoidWith: 'Le soir (peut perturber le sommeil). Recherche encore limitee — prudence',
    brands: 'Disponible en ligne (verifier certificats d\'analyse)',
    natural: 'Brocoli, avocat, edamame (en infimes quantites — supplementation necessaire si voulu)',
  },
  {
    category: 'Longevite & biohacking',
    name: 'Spermidine',
    description: 'Active l\'autophagie cellulaire, longevite.',
    dosage: '1-5 mg/jour',
    moment: 'Matin',
    momentTag: 'matin',
    takeWith: 'Repas',
    avoidWith: 'Rien de particulier connu',
    brands: 'Disponible en ligne (recherche emergente)',
    natural: 'Germe de ble (meilleure source), fromage affine, champignons, soja, pois',
  },

  // === ELECTROLYTES & HYDRATATION ===
  {
    category: 'Electrolytes & hydratation',
    name: 'Electrolytes (Mg + K + Na)',
    description: 'Hydratation optimale, performance sportive, recuperation.',
    dosage: 'Ex: 300mg Mg + 200mg K + 500mg Na par litre d\'eau d\'effort',
    moment: 'Pendant l\'effort >60 min ou en cas de transpiration importante',
    momentTag: 'midi',
    takeWith: 'Eau en quantite, glucose si effort intense',
    avoidWith: 'Diuretiques sans avis medecin',
    brands: 'Disponible en pharmacie et magasins sport',
    natural: 'Eau + pincee de sel + jus de citron + miel pour les efforts moderes. Eau de coco.',
  },
];

const CATEGORIES = [
  'Vitamines',
  'Mineraux',
  'Acides gras',
  'Acides amines',
  'Probiotiques & digestif',
  'Sante intestinale',
  'Hormones & thyroide',
  'Detoxification & foie',
  'Antioxydants & anti-inflammatoires',
  'Cerveau & cognition',
  'Articulations & tissus',
  'Energie & mitochondries',
  'Immunite',
  'Peau, cheveux, ongles',
  'Longevite & biohacking',
  'Electrolytes & hydratation',
  'Adaptogenes & stress',
  'Sommeil',
];

const GOOD_COMBOS = [
  'Vitamine D3 + K2 + Magnesium (le trio d\'or)',
  'Fer + Vitamine C (absorption x6)',
  'Curcuma + Piperine + Gras (absorption x2000)',
  'Omega-3 + Repas gras (absorption x3)',
  'Probiotiques + A jeun (survie bacterienne)',
  'Collagene + Vitamine C (synthese collagene)',
  'Zinc + Proteines (absorption)',
  'B12 + Folates (methylation)',
  'NAC + Vitamine C + Selenium (trio antioxydant)',
  'Glucosamine + Chondroitine + MSM + Vitamine C (protocole articulaire)',
  'Inositol + Folates (SOPK)',
  'DIM + Calcium D-Glucarate (metabolisme oestrogenes)',
  'Lion\'s Mane + Omega-3 DHA (neuroprotection)',
  'D-Ribose + CoQ10 + Magnesium (energie mitochondriale)',
  'NMN + Resveratrol + TMG (longevite)',
  'Quercetine + Vitamine C (immunite et anti-histamine)',
  'L-Glutamine + Zinc Carnosine + Probiotiques (reparation intestinale)',
];

const BAD_COMBOS = [
  'Fer + Cafe/The (absorption reduite 60-90%)',
  'Fer + Calcium (competition absorption)',
  'Fer + Magnesium (competition absorption)',
  'Fer + Zinc (competition absorption)',
  'Calcium + Magnesium en meme temps (competition)',
  'Zinc longue duree sans Cuivre (depletion cuivre)',
  'Vitamine C haute dose + B12 (degradation B12)',
  'Probiotiques + Boissons chaudes (destruction bacteries)',
  'Levothyroxine + Calcium/Fer/Cafe/Soja (absorption reduite)',
  'Biotine + Prise de sang (fausse les resultats — arreter 48h avant)',
  'NAC + Nitroglycerine (interaction dangereuse)',
  'Vitex + Contraception hormonale (modifie l\'efficacite)',
  'DIM + Contraception hormonale (verifier avec medecin)',
  'Beta-glucanes + Immunosuppresseurs (contre-indication)',
  'ALA + Insuline sans suivi (risque hypoglycemie)',
  'Chardon-marie + Medicaments CYP450 (modifie le metabolisme)',
];

const SCHEDULE = [
  { label: 'MATIN A JEUN', items: 'Fer (+ vit C), Probiotiques, L-Glutamine, NAC, ALA, Vitex, Beta-glucanes, Zinc Carnosine, Glutathion, Silicium' },
  { label: 'MATIN AVEC PETIT-DEJ', items: 'Vit D3 + K2, Complexe B, B12, Folates, Selenium, Iode, CoQ10, Rhodiola, NMN, Resveratrol, Lion\'s Mane, PQQ, Biotine, Inositol, Sureau, Spermidine, D-Ribose, Saccharomyces, Collagene' },
  { label: 'MIDI AVEC REPAS', items: 'Omega-3, Chrome, Curcuma + Piperine, GLA, Enzymes digestives, Boswellia, Phosphatidylserine, Quercetine, DIM, Acide hyaluronique, Glucosamine + Chondroitine, MSM, Creatine, Electrolytes, Acide butyrique, Chardon-marie' },
  { label: 'SOIR AVEC REPAS', items: 'Zinc, Calcium (2e prise), Enzymes digestives, Inositol (2e prise)' },
  { label: 'COUCHER', items: 'Magnesium, Ashwagandha, Melatonine, L-Theanine, Psyllium, L-Glutamine (2e prise optionnelle)' },
];

function MomentBadge({ tag }) {
  const labels = {
    'matin-jeun': 'Matin a jeun',
    matin: 'Matin',
    midi: 'Midi',
    soir: 'Soir',
    coucher: 'Coucher',
  };
  return <span className={`supp-moment-badge supp-moment-${tag}`}>{labels[tag] || tag}</span>;
}

function SupplementCard({ supp }) {
  return (
    <div className="supp-card">
      <div className="supp-card-header">
        <h4 className="supp-card-name">{supp.name}</h4>
        <MomentBadge tag={supp.momentTag} />
      </div>
      <p className="supp-card-desc">{supp.description}</p>

      <div className="supp-field">
        <span className="supp-field-label">Dosage</span>
        <span className="supp-field-value supp-dosage">{supp.dosage}</span>
      </div>

      <div className="supp-field">
        <span className="supp-field-label">Moment de prise</span>
        <span className="supp-field-value">{supp.moment}</span>
      </div>

      <div className="supp-field">
        <span className="supp-field-label">Prendre avec</span>
        <span className="supp-field-value supp-take-with">{supp.takeWith}</span>
      </div>

      <div className="supp-field supp-avoid">
        <span className="supp-field-label">NE PAS combiner avec</span>
        <span className="supp-field-value supp-avoid-text">{supp.avoidWith}</span>
      </div>

      <div className="supp-field">
        <span className="supp-field-label">Marques suisses</span>
        <span className="supp-field-value supp-brands">{supp.brands}</span>
      </div>

      <div className="supp-field">
        <span className="supp-field-label">Alternative naturelle</span>
        <span className="supp-field-value supp-natural">{supp.natural}</span>
      </div>
    </div>
  );
}

export default function SupplementsLibrary() {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return SUPPLEMENTS.filter(s => {
      if (activeCategory !== 'all' && s.category !== activeCategory) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.natural.toLowerCase().includes(q)
      );
    });
  }, [search, activeCategory]);

  // Group by category
  const grouped = useMemo(() => {
    const map = {};
    for (const s of filtered) {
      if (!map[s.category]) map[s.category] = [];
      map[s.category].push(s);
    }
    return map;
  }, [filtered]);

  return (
    <div className="supplements-library">
      <div className="supp-header">
        <h2>Bibliotheque de complements</h2>
        <p className="supp-subtitle">
          {SUPPLEMENTS.length} complements referencies. Recherchez, filtrez et consultez les bonnes associations.
        </p>
      </div>

      <div className="supp-search-bar">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher un complement (ex: magnesium, vitamine D, omega...)"
          className="supp-search-input"
        />
      </div>

      <div className="supp-category-tabs">
        <button
          className={`supp-cat-tab ${activeCategory === 'all' ? 'active' : ''}`}
          onClick={() => setActiveCategory('all')}
        >
          Tous ({SUPPLEMENTS.length})
        </button>
        {CATEGORIES.map(cat => {
          const count = SUPPLEMENTS.filter(s => s.category === cat).length;
          return (
            <button
              key={cat}
              className={`supp-cat-tab ${activeCategory === cat ? 'active' : ''}`}
              onClick={() => setActiveCategory(cat)}
            >
              {cat} ({count})
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="supp-empty">Aucun complement ne correspond a la recherche.</div>
      ) : (
        Object.keys(grouped).map(cat => (
          <div key={cat} className="supp-section">
            <h3 className="supp-section-title">{cat}</h3>
            <div className="supp-grid">
              {grouped[cat].map(s => (
                <SupplementCard key={s.name} supp={s} />
              ))}
            </div>
          </div>
        ))
      )}

      {/* Interactions table */}
      <div className="supp-interactions">
        <h3 className="supp-section-title">Tableau des interactions</h3>

        <div className="supp-combos-grid">
          <div className="supp-combo-box supp-combo-good">
            <h4>Bonnes combinaisons</h4>
            <ul>
              {GOOD_COMBOS.map(c => (<li key={c}>{c}</li>))}
            </ul>
          </div>
          <div className="supp-combo-box supp-combo-bad">
            <h4>Mauvaises combinaisons</h4>
            <ul>
              {BAD_COMBOS.map(c => (<li key={c}>{c}</li>))}
            </ul>
          </div>
        </div>

        <div className="supp-schedule">
          <h4>Tableau horaire optimal</h4>
          <div className="supp-schedule-rows">
            {SCHEDULE.map(row => (
              <div key={row.label} className="supp-schedule-row">
                <span className="supp-schedule-label">{row.label}</span>
                <span className="supp-schedule-items">{row.items}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
