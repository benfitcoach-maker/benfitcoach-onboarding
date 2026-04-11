import { useState, useEffect, useRef } from 'react';

// ─── KEYWORD DATABASE ───

const KEYWORDS = [
  // DOULEURS / PATHOLOGIES
  { patterns: ['genou', 'genoux'], hint: 'Genoux : verifiez l\'apport en collagene, omega-3 et curcuma. Reduire les aliments pro-inflammatoires. Coordination avec Benoit pour adapter l\'activite physique.' },
  { patterns: ['dos', 'lombaire', 'lombalgie'], hint: 'Dos/Lombaires : magnesium et anti-inflammatoires naturels (curcuma, gingembre). Verifiez la vitamine D. Posture et renforcement musculaire a coordonner avec Benoit.' },
  { patterns: ['migraine', 'cephalee', 'mal de tete', 'maux de tete'], hint: 'Migraines : explorez les carences en magnesium et B2. Verifiez la consommation de tyramine (fromage vieilli, chocolat, vin rouge). L\'hydratation est souvent insuffisante.' },
  { patterns: ['tendinite', 'tendon'], hint: 'Tendinite : collagene hydrolyse, vitamine C, silicium. Reduire les aliments acides. Coordination Benoit pour la recuperation.' },
  { patterns: ['arthrose', 'arthrite'], hint: 'Arthrose/Arthrite : protocole anti-inflammatoire strict. Omega-3 haute dose, curcuma + piperine, collagene type II. Reduire sucres, gluten et laitiers.' },

  // PATHOLOGIES MEDICALES
  { patterns: ['diabete', 'diabetique', 'glycemie'], hint: 'Diabete : coordination medecin traitant indispensable. Index glycemique bas a chaque repas, fibres solubles, chrome picolinate, cannelle de Ceylan. Surveiller les portions de glucides.' },
  { patterns: ['thyroide', 'hypothyroidie', 'hyperthyroidie', 'hashimoto'], hint: 'Thyroide : verifiez iode, selenium et zinc. Limitez les cruciferes crus si hypothyroidie. Attention au gluten si Hashimoto. Coordination endocrinologue.' },
  { patterns: ['cholesterol'], hint: 'Cholesterol : omega-3, fibres solubles (avoine, psyllium), ail, sterols vegetaux. Reduire les graisses saturees et trans. Verifiez le ratio HDL/LDL.' },
  { patterns: ['hypertension', 'tension arterielle'], hint: 'Hypertension : reduire le sodium, augmenter le potassium (banane, avocat, epinards). Magnesium, CoQ10, ail. Coordination medecin.' },
  { patterns: ['cancer'], hint: 'Antecedent cancer : approche anti-inflammatoire et antioxydante. Cruciferes, curcuma, the vert, baies. Coordination oncologue obligatoire pour toute supplementation.' },

  // TROUBLES DIGESTIFS
  { patterns: ['reflux', 'brulure', 'acidite'], hint: 'Reflux : eviter les repas tardifs, reduire cafe/tomate/agrumes/menthe. Manger lentement, bien mastiquer. Aloe vera et reglisse DGL peuvent aider.' },
  { patterns: ['sibo', 'candidose', 'candida'], hint: 'SIBO/Candidose : regime specifique en 3 phases (elimination, traitement, reintroduction). Probiotiques cibles apres traitement. Reduire sucres et levures.' },
  { patterns: ['colon irritable', 'sci', 'sii', 'intestin irritable'], hint: 'Syndrome intestin irritable : approche low FODMAP en phase d\'elimination. Probiotiques Lactobacillus/Bifidobacterium. Gestion du stress essentielle.' },
  { patterns: ['intoler', 'lactose', 'gluten'], hint: 'Intolerance detectee : test d\'eviction 2-3 semaines recommande pour confirmer. Alternatives nutritionnelles a prevoir pour maintenir les apports.' },

  // FEMMES
  { patterns: ['menopause', 'bouffees'], hint: 'Menopause : phytoestrogenes (soja, lin, trefle rouge). Calcium + vitamine D + K2. Omega-3 pour les bouffees. Magnesium pour le sommeil.' },
  { patterns: ['endometriose'], hint: 'Endometriose : anti-inflammatoire strict. Omega-3 haute dose, curcuma, reduire viande rouge et produits laitiers. NAC et magnesium. Coordination gynecologue.' },
  { patterns: ['sopk', 'ovaires polykystiques'], hint: 'SOPK : index glycemique bas prioritaire, inositol (myo-inositol + D-chiro), chrome, omega-3. Reduire les sucres raffines. Le poids est un facteur cle.' },
  { patterns: ['enceinte', 'grossesse', 'allaitement'], hint: 'Grossesse/Allaitement : folates (forme methylee), fer, DHA, iode. Eviter certains supplements (vitamine A haute dose). Coordination sage-femme/gynecologue.' },

  // SOMMEIL / MENTAL
  { patterns: ['insomnie', 'sommeil'], hint: 'Sommeil perturbe : tryptophane au diner (graines de courge, dinde), magnesium bisglycinate 300mg au coucher, tisane passiflore/camomille. Pas de cafeine apres 14h.' },
  { patterns: ['anxiete', 'angoisse'], hint: 'Anxiete : magnesium, L-theanine, ashwagandha (si pas de contre-indication thyroidienne). Omega-3 EPA. Reduire le cafe. Coherence cardiaque.' },
  { patterns: ['depression', 'depressif'], hint: 'Humeur : verifiez vitamine D, omega-3 EPA, B9 et B12 (formes methylees). Le lien intestin-cerveau est cle — microbiote a explorer. Coordination psy recommandee.' },
  { patterns: ['burnout', 'epuisement'], hint: 'Epuisement : probablement surrenalien. Vitamines B complexe, magnesium, vitamine C haute dose, ashwagandha. Repos et sommeil prioritaires avant tout ajustement nutritionnel.' },

  // PEAU
  { patterns: ['acne', 'bouton'], hint: 'Acne : lien intestin-peau. Explorez produits laitiers et index glycemique eleve. Zinc 30mg/jour, omega-3, probiotiques specifiques peau.' },
  { patterns: ['eczema', 'dermatite'], hint: 'Eczema : souvent lie a l\'intestin et aux intolerances. Test eviction laitiers/gluten/oeufs. Omega-3, vitamine D, probiotiques. GLA (huile d\'onagre).' },
  { patterns: ['psoriasis'], hint: 'Psoriasis : composante auto-immune. Anti-inflammatoire strict, vitamine D haute dose (sous controle medical), omega-3, curcuma. Reduire alcool et gluten.' },

  // SPORT / PERFORMANCE
  { patterns: ['musculation', 'masse musculaire'], hint: 'Musculation : proteines 1.6-2g/kg, creatine 3-5g/jour, timing proteique post-training. HMB si objectif prise de masse. Coordination Benoit pour le programme.' },
  { patterns: ['endurance', 'course', 'marathon'], hint: 'Endurance : glucides periodises, fer (surtout femmes), magnesium, antioxydants. Hydratation avec electrolytes pendant l\'effort. Beta-alanine et bicarbonate.' },
  { patterns: ['recuperation'], hint: 'Recuperation : proteines + glucides dans les 30min post-effort, tart cherry (cerise acide), magnesium, omega-3. Sommeil = recuperation #1.' },

  // CARENCES ET MICRONUTRIMENTS
  { patterns: ['fer', 'anemie', 'ferritine'], hint: 'Carence en fer frequente, surtout chez les femmes. Sources : boudin noir, lentilles, epinards + vitamine C pour absorption. Verifiez la ferritine dans le bilan sanguin. Attention : ne pas supplementer sans analyse.' },
  { patterns: ['vitamine d', 'vit d'], hint: '80% de la population suisse est carencee en vitamine D. Exposition soleil 15-20 min/jour bras decouverts. Supplementation D3+K2 souvent necessaire octobre-avril. Verifiez le taux sanguin (objectif >60 nmol/L).' },
  { patterns: ['b12', 'vegetarien', 'vegan'], hint: 'Carence B12 quasi systematique chez les vegetariens/vegans. Forme methylcobalamine recommandee. Verifiez aussi fer, zinc, omega-3, iode. Sources : levure nutritionnelle enrichie.' },
  { patterns: ['magnesium', 'crampes', 'spasmes'], hint: 'Magnesium : 70% de la population est carencee. Formes bisglycinate ou citrate preferees. Sources : amandes, chocolat noir 85%, graines de courge, epinards. 300-400mg/jour.' },
  { patterns: ['zinc'], hint: 'Zinc essentiel pour immunite, peau, fertilite, cicatrisation. Sources : huitres, graines de courge, boeuf, lentilles. 15-30mg/jour si carence. Attention : ne pas prendre avec le fer.' },
  { patterns: ['omega', 'dha', 'epa'], hint: 'Ratio omega-6/omega-3 ideal : 3:1 (moyenne occidentale : 15:1). Sources omega-3 : sardines, maquereau, graines de lin, noix. Si peu de poisson : supplementation EPA/DHA recommandee.' },
  { patterns: ['iode'], hint: 'Iode essentiel pour la thyroide. Sources : algues, poisson de mer, sel iode, produits laitiers. Carence frequente en Suisse malgre le sel iode.' },
  { patterns: ['selenium'], hint: 'Selenium : antioxydant puissant, essentiel pour la thyroide. 2-3 noix du Bresil/jour = apport quotidien. Attention au surdosage.' },
  { patterns: ['calcium'], hint: 'Calcium : pas que les produits laitiers. Sources : sardines en boite, amandes, brocoli, chou kale, eaux minerales calciques. Toujours associer vitamine D pour absorption.' },

  // HORMONES ET SYSTEME ENDOCRINIEN
  { patterns: ['cortisol', 'surrenales', 'adrenal'], hint: 'Cortisol eleve chronique : prise de poids abdominale, insomnie, fatigue. Ashwagandha, phosphatidylserine, magnesium. Reduire cafeine, sucre, stress. Rythme circadien a restaurer.' },
  { patterns: ['insuline', 'resistance a l\'insuline'], hint: 'Resistance a l\'insuline : precurseur du diabete type 2. Index glycemique bas, chrome, cannelle, berberine. Jeune intermittent 16:8 peut aider. Activite physique essentielle.' },
  { patterns: ['testosterone'], hint: 'Testosterone (homme/femme) : zinc, vitamine D, magnesium, graisses saines, sommeil 7-9h. Reduire alcool, plastiques (perturbateurs endocriniens), stress chronique.' },
  { patterns: ['oestrogene', 'estrogene', 'dominance'], hint: 'Dominance oestrogenique : cruciferes (DIM), graines de lin, reduire xenoestrogenes (plastiques, cosmetiques). Soutien hepatique : chardon-marie, NAC. Fibres pour elimination.' },
  { patterns: ['progesterone'], hint: 'Progesterone basse : magnesium, vitamine B6, vitex (gattilier), gestion du stress. Souvent lie au stress chronique et a la dominance oestrogenique.' },
  { patterns: ['melatonine', 'rythme circadien'], hint: 'Melatonine : lumiere bleue le soir = production perturbee. Lumiere naturelle le matin, lunettes anti-lumiere bleue apres 20h, tryptophane au diner. Supplementation 0.5-1mg en dernier recours.' },

  // SYSTEME DIGESTIF AVANCE
  { patterns: ['leaky gut', 'permeabilite intestinale', 'intestin permeable'], hint: 'Permeabilite intestinale : L-glutamine 5g/jour, bouillon d\'os, zinc carnosine, probiotiques. Eliminer gluten, laitiers, alcool, AINS pendant 4-8 semaines.' },
  { patterns: ['fodmap'], hint: 'Regime low FODMAP : phase d\'elimination 2-6 semaines, puis reintroduction methodique. Application Monash University recommandee. Ne pas rester en elimination longtemps.' },
  { patterns: ['helicobacter', 'h. pylori', 'h pylori'], hint: 'H. pylori : traitement medical necessaire. Support naturel : huile de nigelle, miel de Manuka, probiotiques Lactobacillus reuteri. Mastic de Chios. Coordination gastro-enterologue.' },
  { patterns: ['bile', 'vesicule'], hint: 'Bile/Vesicule : si vesicule retiree, support digestif avec enzymes biliaires, taurine, chardon-marie. Petits repas frequents, reduire les graisses en une fois.' },
  { patterns: ['foie', 'detox', 'hepatique'], hint: 'Soutien hepatique : chardon-marie, NAC, artichaut, curcuma. Reduire alcool, sucre, medicaments non essentiels. Cruciferes pour les voies de detoxification phase 1 et 2.' },
  { patterns: ['enzyme', 'enzymes digestives'], hint: 'Enzymes digestives : utiles si ballonnements post-repas, aliments non digeres dans les selles. Bromelaine, papaine, lipase. Prendre au debut du repas.' },

  // NUTRITION SPORTIVE AVANCEE
  { patterns: ['creatine'], hint: 'Creatine monohydrate : 3-5g/jour, pas besoin de phase de charge. Benefices : force, masse musculaire, cognition. Hydrater davantage. Sur et bien etudie.' },
  { patterns: ['proteine', 'whey', 'proteines'], hint: 'Besoins proteiques : 1.2g/kg sedentaire, 1.6-2g/kg sportif, 2-2.4g/kg musculation intense. Repartir sur 3-4 prises/jour. Sources completes prioritaires.' },
  { patterns: ['bcaa', 'acides amines'], hint: 'BCAAs : pas necessaires si apport proteique suffisant. Utiles en jeune intermittent + entrainement. Leucine = signal mTOR pour synthese musculaire.' },
  { patterns: ['pre-workout', 'pre workout', 'cafeine'], hint: 'Cafeine : 3-6mg/kg 30-60min avant effort. Pas apres 14h si troubles du sommeil. Tolerance variable (gene CYP1A2). Alternatives : the vert, matcha, beta-alanine.' },
  { patterns: ['electrolytes', 'sodium'], hint: 'Electrolytes : sodium, potassium, magnesium essentiels pendant l\'effort >60min. Eau + pincee de sel + citron pour les efforts moderes. Formules commerciales pour efforts intenses.' },
  { patterns: ['collagene'], hint: 'Collagene : 10-15g/jour avec vitamine C pour tendons, articulations, peau. Type I/III pour peau et tendons, type II pour cartilage. Prendre 30-60min avant l\'entrainement pour benefice articulaire.' },

  // AUTO-IMMUNITE ET MALADIES CHRONIQUES
  { patterns: ['auto-immun', 'auto immune', 'autoimmun'], hint: 'Maladie auto-immune : protocole AIP (Autoimmune Protocol) a considerer. Eliminer gluten, laitiers, cereales, legumineuses, solanacees pendant 30-60 jours. Reintroduction progressive. Vitamine D cruciale.' },
  { patterns: ['fibromyalgie'], hint: 'Fibromyalgie : magnesium haute dose, CoQ10, D-ribose, omega-3. Reduire glutamate, aspartame, sucres. Anti-inflammatoire strict. Coordination rhumatologue.' },
  { patterns: ['crohn', 'colite', 'rch', 'mici'], hint: 'MICI (Crohn/Colite) : regime specifique en phase active vs remission. Curcuma, omega-3, probiotiques cibles (Saccharomyces boulardii). Coordination gastro-enterologue obligatoire.' },
  { patterns: ['lyme', 'borreliose'], hint: 'Maladie de Lyme : soutien immunitaire et anti-inflammatoire. NAC, glutathion, vitamine C haute dose, probiotiques. Reduire sucre et alcool. Coordination infectiologue.' },
  { patterns: ['sclerose'], hint: 'Sclerose en plaques : vitamine D haute dose (sous controle medical), omega-3 EPA/DHA, protocole Wahls a explorer. Reduire laitiers et gluten. Coordination neurologue.' },

  // SANTE MENTALE ET COGNITIVE
  { patterns: ['tdah', 'attention', 'concentration'], hint: 'TDAH/Concentration : omega-3 EPA, magnesium, zinc, fer (verifier ferritine). Reduire sucres, colorants, additifs. Proteines au petit-dejeuner. L-theanine pour focus sans agitation.' },
  { patterns: ['memoire', 'cognitif'], hint: 'Sante cognitive : omega-3 DHA, phosphatidylserine, lion\'s mane, curcuma. Bleuets quotidiens. Exercice physique = meilleur neuroprotecteur. Sommeil 7-9h non negociable.' },
  { patterns: ['brouillard mental', 'brain fog'], hint: 'Brouillard mental : souvent lie a inflammation, dysbiose, carences (B12, fer, D), ou intolerance alimentaire. Test d\'eviction gluten/laitiers 3 semaines. Omega-3, magnesium.' },

  // LONGEVITE ET BIOHACKING
  { patterns: ['jeune', 'intermittent', 'fasting'], hint: 'Jeune intermittent : 16:8 le plus accessible. Commencer par 12:12 pendant 1 semaine. Contre-indique si : diabete type 1, troubles alimentaires, grossesse, <18 ans. Hydratation essentielle pendant le jeune.' },
  { patterns: ['autophagie'], hint: 'Autophagie : activee apres 16-24h de jeune. Benefices : renouvellement cellulaire, anti-age. Aussi stimulee par exercice intense, restriction calorique, polyphenols (resveratrol, curcuma).' },
  { patterns: ['sirtuines', 'nad', 'nmn', 'resveratrol'], hint: 'Activation des sirtuines/NAD+ : resveratrol, NMN/NR, jeune, exercice. Aliments riches en polyphenols : raisin, cacao, the vert, oignon rouge. Domaine en pleine recherche.' },
  { patterns: ['telomere', 'vieillissement', 'anti-age', 'longevite'], hint: 'Longevite nutritionnelle : antioxydants (baies, the vert), omega-3, vitamine D, magnesium. Reduire sucre et ultra-transformes. Zones bleues : legumineuses, legumes, vie sociale, mouvement naturel.' },
  { patterns: ['oxydatif', 'radicaux libres', 'antioxydant'], hint: 'Stress oxydatif : glutathion (NAC precurseur), vitamine C, vitamine E, selenium, CoQ10. Aliments ORAC eleve : baies, cacao, epices. Reduire : alcool, tabac, aliments frits, stress.' },

  // POIDS ET METABOLISME
  { patterns: ['plateau', 'stagnation'], hint: 'Plateau de perte de poids : revoir les portions (meme aliments sains), augmenter les proteines, varier l\'entrainement, verifier le sommeil et le stress. Parfois : augmenter temporairement les calories (reverse diet).' },
  { patterns: ['metabolisme lent'], hint: 'Metabolisme lent : souvent lie a restriction calorique prolongee, thyroide, ou manque de masse musculaire. Ne pas descendre sous 1200 kcal femme / 1500 kcal homme. Musculation = meilleur booster metabolique.' },
  { patterns: ['retention d\'eau', 'retention', 'gonfle'], hint: 'Retention d\'eau : reduire le sodium, augmenter le potassium (banane, avocat), boire plus d\'eau (paradoxalement), magnesium. Verifier fonction renale et thyroide.' },
  { patterns: ['compulsion', 'boulimie', 'tca', 'trouble alimentaire'], hint: 'Trouble du comportement alimentaire : approche bienveillante, pas de restriction. Coordination psychologue/psychiatre indispensable. Tryptophane, magnesium, chrome pour reduire les compulsions. Ne jamais juger.' },
  { patterns: ['poids', 'maigrir', 'mincir', 'perdre du poids'], hint: 'Perte de poids durable : deficit calorique modere (300-500 kcal), proteines elevees, fibres, sommeil, gestion du stress. Pas de regime restrictif. Objectif : 0.5-1kg/semaine maximum.' },

  // ALLERGIES ET INTOLERANCES DETAILLEES
  { patterns: ['histamine', 'intolerance histamine'], hint: 'Intolerance a l\'histamine : eviter fromages vieillis, charcuterie, vin, poisson non frais, tomates, epinards, avocat, chocolat. DAO enzyme peut aider. Souvent lie a dysbiose.' },
  { patterns: ['oxalate', 'calculs renaux'], hint: 'Oxalates eleves : reduire epinards, rhubarbe, betterave, amandes, chocolat. Augmenter calcium au repas (lie les oxalates), bien s\'hydrater, citrate de magnesium.' },
  { patterns: ['lectine', 'lectines'], hint: 'Lectines : proteines vegetales potentiellement irritantes. Cuisson, trempage et fermentation les reduisent. Personnes sensibles : eviter tomates crues, poivrons, aubergines, legumineuses non trempees.' },
  { patterns: ['caseine', 'lait', 'laitier'], hint: 'Intolerance laitiers : differenciez lactose (sucre du lait) vs caseine (proteine). Lactose : yaourt et fromage souvent toleres. Caseine : eviter tous les produits laitiers. Test d\'eviction 3 semaines.' },
  { patterns: ['coeliaque', 'celiac', 'maladie coeliaque'], hint: 'Maladie coeliaque : elimination stricte et definitive du gluten (ble, orge, seigle). Attention aux contaminations croisees. Verifier les carences : fer, B12, folates, calcium, vitamine D.' },
  { patterns: ['fructose'], hint: 'Malabsorption du fructose : reduire fruits riches en fructose (pomme, poire, mangue), miel, sirop d\'agave. Fruits mieux toleres : banane, myrtilles, fraises. Test respiratoire pour confirmer.' },

  // SANTE CARDIOVASCULAIRE
  { patterns: ['triglycerides'], hint: 'Triglycerides eleves : reduire sucres raffines et alcool (principal facteur). Omega-3 haute dose, fibres solubles, exercice regulier. Coordination cardiologue si tres eleves.' },
  { patterns: ['arythmie', 'palpitation'], hint: 'Palpitations : verifier magnesium, potassium, fer, thyroide. Reduire cafeine, alcool, sucre. Omega-3 EPA. Si frequent : bilan cardiaque recommande.' },

  // GROSSESSE ET FERTILITE
  { patterns: ['fertilite', 'conception', 'pma'], hint: 'Fertilite : folates forme methylee (pas acide folique), CoQ10, vitamine D, zinc, omega-3. Antioxydants pour les deux partenaires. Reduire perturbateurs endocriniens. 3-6 mois de preparation.' },
  { patterns: ['post-partum'], hint: 'Post-partum : risque de depletion nutritionnelle. Priorites : fer, omega-3 DHA, vitamine D, magnesium, B-complexe. Proteines elevees si allaitement. Soutien psychologique si besoin.' },
  { patterns: ['allaitement'], hint: 'Allaitement : +500 kcal/jour, hydratation ++, omega-3 DHA, vitamine D, iode. Eviter : alcool, exces cafeine. Galactogenes naturels : fenugrec, fenouil, avoine.' },

  // RESPIRATOIRE ET ORL
  { patterns: ['asthme'], hint: 'Asthme : omega-3 anti-inflammatoires, magnesium (bronchodilatateur naturel), vitamine D. Reduire laitiers si mucus excessif. Curcuma. Coordination pneumologue.' },
  { patterns: ['sinusite', 'rhinite', 'allergie saisonniere'], hint: 'Allergies/Sinusite : quercetine (antihistaminique naturel), vitamine C, probiotiques, NAC (fluidifie le mucus). Reduire laitiers. Rincage nasal eau salee.' },

  // MEDICAMENTS ET INTERACTIONS NUTRITIONNELLES
  { patterns: ['metformine', 'glucophage'], hint: 'Metformine deplete la vitamine B12 et le folate. Controle B12 annuel recommande. Supplementation B12 methylcobalamine souvent necessaire. Aussi impact sur le magnesium.' },
  { patterns: ['levothyrox', 'levothyroxine', 'euthyrox', 'synthroid'], hint: 'Levothyroxine : prendre a jeun, 30-60 min avant le petit-dejeuner. Le calcium, fer, soja et cafe reduisent l\'absorption. Espacement minimum 4h avec ces nutriments.' },
  { patterns: ['omeprazole', 'pantoprazole', 'lansoprazole', 'ipp', 'inhibiteur pompe'], hint: 'IPP (anti-acides) : depletion magnesium, B12, calcium, fer, zinc sur le long terme. Risque osteoporose. Verifier ces niveaux si prise >3 mois. Envisager sevrage progressif avec support digestif.' },
  { patterns: ['statine', 'atorvastatine', 'rosuvastatine', 'simvastatine', 'crestor', 'lipitor'], hint: 'Statines depletent le CoQ10 systematiquement. Supplementation CoQ10 100-200mg/jour recommandee. Aussi impact sur la vitamine D et la vitamine K2.' },
  { patterns: ['antidepresseur', 'isrs', 'sertraline', 'escitalopram', 'fluoxetine', 'prozac', 'zoloft'], hint: 'Antidepresseurs ISRS : peuvent affecter l\'appetit et le poids. Verifier magnesium, omega-3, vitamine D, B12 et folates. Le millepertuis est CONTRE-INDIQUE avec les ISRS.' },
  { patterns: ['pilule', 'contraceptif', 'contraception orale'], hint: 'Contraception orale deplete : B6, B12, folates, magnesium, zinc, vitamine C, vitamine E. Supplementation B-complexe methyle recommandee. Attention folates si arret pour projet grossesse.' },
  { patterns: ['cortisone', 'prednisone', 'prednisolone', 'corticoide'], hint: 'Corticoides : depletion calcium, vitamine D, potassium, magnesium. Risque osteoporose et prise de poids. Renforcer apports calcium+D3+K2. Reduire sucres et sodium.' },
  { patterns: ['antibiotique', 'amoxicilline', 'augmentin', 'azithromycine'], hint: 'Antibiotiques detruisent le microbiote. Probiotiques multi-souches 2h apres chaque prise d\'antibiotique. Continuer 4-8 semaines apres la fin du traitement. Kefir, choucroute, kombucha en soutien.' },
  { patterns: ['ibuprofene', 'ains', 'voltarene', 'diclofenac'], hint: 'AINS : irritants pour la muqueuse intestinale. Risque permeabilite intestinale. Toujours prendre pendant un repas. L-glutamine et zinc carnosine pour proteger la muqueuse. Envisager alternatives naturelles (curcuma, omega-3).' },
  { patterns: ['aspirine', 'kardegic'], hint: 'Aspirine : peut reduire l\'absorption de vitamine C et augmenter les besoins en fer (micro-saignements). Prendre avec vitamine C. Attention interactions avec omega-3 haute dose (effet anticoagulant cumule).' },
  { patterns: ['anticoagulant', 'warfarine', 'coumadine', 'xarelto', 'eliquis'], hint: 'Anticoagulants : maintenir un apport CONSTANT en vitamine K (pas l\'eliminer, la stabiliser). Attention omega-3 haute dose, ail, gingembre, curcuma a doses elevees (effet anticoagulant). Coordination medecin obligatoire.' },
  { patterns: ['laxatif'], hint: 'Usage regulier de laxatifs : risque malabsorption des nutriments, depletion potassium et magnesium. Chercher la cause (hydratation, fibres, stress). Transition vers fibres naturelles : psyllium, graines de lin, pruneaux.' },
  { patterns: ['somnifere', 'benzodiazepine', 'stilnox', 'zolpidem', 'temesta'], hint: 'Somniferes : explorer les causes du sommeil perturbe avant de supplementer. Magnesium glycinate, L-theanine, melatonine faible dose en alternative. Coordination medecin pour sevrage eventuel.' },
  { patterns: ['antithyroidien', 'neomercazole'], hint: 'Traitement thyroidien : le selenium, zinc et iode sont essentiels. Attention aux goitrogenes crus (cruciferes, soja) si hypothyroidie. Cuisson reduit l\'effet goitrogene.' },
  { patterns: ['chimiotherapie', 'chimio', 'immunotherapie'], hint: 'Pendant/apres chimio : AUCUNE supplementation antioxydante sans accord de l\'oncologue (peut interferer). Focus : proteines elevees, hydratation, aliments doux, gingembre pour nausees. Coordination oncologue OBLIGATOIRE.' },
  { patterns: ['biotherapie', 'humira', 'enbrel'], hint: 'Biotherapie : immunosuppresseur — vigilance sur les infections. Renforcer l\'alimentation anti-inflammatoire. Pas de supplements stimulant l\'immunite (echinacee, astragale) sans accord medical.' },
  { patterns: ['tardyferon', 'ferograd'], hint: 'Supplementation en fer : prendre avec vitamine C a jeun pour absorption. Eviter the, cafe, calcium, zinc en meme temps. Forme bisglycinate mieux toleree. Verifier ferritine avant de supplementer.' },
  { patterns: ['antiacide', 'gaviscon', 'maalox', 'rennie'], hint: 'Antiacides reduisent l\'absorption de fer, B12, calcium, magnesium, zinc. Usage ponctuel OK, mais si chronique : chercher la cause (H. pylori, alimentation, stress).' },
  { patterns: ['diuretique', 'lasix', 'furosemide'], hint: 'Diuretiques : depletion potassium, magnesium, zinc, vitamines B. Renforcer les apports : banane, avocat, graines de courge, legumineuses. Surveillance electrolytes reguliere.' },

  // ALLERGIES ALIMENTAIRES
  { patterns: ['arachide', 'cacahuete', 'cacahuette'], hint: 'Allergie arachides : attention aux traces dans chocolat, patisseries, sauces asiatiques, cereales. Alternatives proteiques : graines de tournesol, graines de courge. Toujours verifier les etiquettes.' },
  { patterns: ['noix', 'fruits a coque', 'noisette', 'amande', 'cajou', 'pistache', 'noix de pecan'], hint: 'Allergie fruits a coque : eliminer toutes les noix ou uniquement celles identifiees (allergie croisee frequente). Sources alternatives d\'omega-3 : graines de lin, graines de chia, poisson gras. Alternatives collations : graines de tournesol, graines de courge.' },
  { patterns: ['oeuf', 'oeufs'], hint: 'Allergie oeufs : attention aux preparations contenant des oeufs caches (pates, patisseries, mayonnaise, panures). Sources alternatives de proteines et choline : poisson, viande, legumineuses. Levure nutritionnelle pour la B12.' },
  { patterns: ['poisson', 'crustace', 'crevette', 'fruits de mer', 'mollusque'], hint: 'Allergie poisson/fruits de mer : alternatives omega-3 essentielles — graines de lin moulues, graines de chia, huile d\'algues (DHA vegetal). Supplementation omega-3 d\'origine algale recommandee.' },
  { patterns: ['soja'], hint: 'Allergie soja : attention au soja cache (lecithine de soja, huile de soja, proteines de soja dans produits transformes). Alternatives : lait d\'avoine, lait d\'amande, tempeh de pois chiches. Verifier les etiquettes.' },
  { patterns: ['ble', 'froment'], hint: 'Allergie au ble (different de la maladie coeliaque) : eviter ble, epeautre, kamut. Alternatives : riz, sarrasin, quinoa, mais, avoine certifiee sans gluten, millet. Attention aux sauces et produits transformes contenant du ble.' },
  { patterns: ['sesame'], hint: 'Allergie sesame : attention au tahini, houmous, pains, bagels, huile de sesame, cuisine asiatique et moyen-orientale. Alternative pour le calcium : graines de chia, amandes (si tolerees), brocoli.' },
  { patterns: ['sulfite', 'sulfites'], hint: 'Sensibilite aux sulfites : presents dans vin, fruits secs, vinaigre, charcuterie, crevettes. Privilegier les aliments frais et non transformes. Vin nature sans sulfites ajoutes. La molybdene aide au metabolisme des sulfites.' },
  { patterns: ['nickel'], hint: 'Allergie au nickel alimentaire : limiter cacao, legumineuses, noix, avoine, tomate en conserve, epinards. Cuire dans des ustensiles en inox ou verre. Vitamine C au repas reduit l\'absorption du nickel.' },
  { patterns: ['aplv', 'proteine de lait', 'proteines de lait'], hint: 'Allergie aux proteines de lait de vache : elimination stricte de tous les produits laitiers y compris traces. Alternatives : lait de coco, lait d\'avoine enrichi calcium. Surveiller calcium, vitamine D, iode, B12.' },
  { patterns: ['kiwi', 'latex'], hint: 'Syndrome latex-fruits : allergie croisee frequente entre latex, kiwi, banane, avocat, chataigne. Si allergie a l\'un, surveiller la tolerance aux autres. Alternatives fruits : baies, pomme, poire.' },
  { patterns: ['celeri', 'moutarde'], hint: 'Allergie celeri/moutarde : allergenes souvent caches dans bouillons, soupes, sauces, melanges d\'epices, plats prepares. Toujours verifier les etiquettes. Allergie croisee possible avec le pollen de bouleau.' },

  // ANTECEDENTS FAMILIAUX
  { patterns: ['antecedent diabete', 'famille diabete', 'parent diabetique', 'mere diabete', 'pere diabete'], hint: 'Antecedent familial diabete : risque accru de resistance a l\'insuline. Prevention : index glycemique bas, fibres a chaque repas, chrome, cannelle, activite physique reguliere. Suivi glycemique recommande des 35 ans.' },
  { patterns: ['antecedent cancer', 'famille cancer', 'tumeur'], hint: 'Antecedent familial cancer : renforcer la prevention nutritionnelle. Cruciferes quotidiens (brocoli, chou), curcuma, the vert, baies. Reduire viande rouge, sucres raffines, alcool, ultra-transformes. Antioxydants naturels prioritaires.' },
  { patterns: ['cardiovasculaire', 'infarctus', 'avc', 'cardiaque'], hint: 'Antecedent familial cardiovasculaire : omega-3 prioritaires, fibres solubles, ail, reduire sodium et graisses saturees. Coenzyme Q10, magnesium. Bilan lipidique et inflammatoire regulier recommande.' },
  { patterns: ['alzheimer', 'demence', 'parkinson'], hint: 'Antecedent familial neurodegeneratif : neuroprotection prioritaire. Omega-3 DHA, curcuma, myrtilles quotidiennes, vitamine E naturelle. Regime mediterraneen. Exercice physique = meilleur protecteur cerebral. Reduire aluminium et metaux lourds.' },
  { patterns: ['osteoporose', 'fracture'], hint: 'Antecedent familial osteoporose : calcium + vitamine D3 + K2 des maintenant. Sources calcium : sardines, amandes, brocoli, eaux calciques. Exercice en charge. Reduire cafe, sel, proteines animales excessives.' },
  { patterns: ['lupus', 'polyarthrite'], hint: 'Antecedent familial auto-immun : terrain genetique a surveiller. Protocole preventif : vitamine D optimale (>75 nmol/L), omega-3, reduire gluten et laitiers, soutenir le microbiote. Permeabilite intestinale a verifier.' },
  { patterns: ['obesite', 'surpoids'], hint: 'Antecedent familial obesite : composante genetique (genes FTO, MC4R) mais l\'epigenetique est modifiable. Proteines elevees pour la satiete, fibres, chrononutrition, activite physique. Gestion du stress et du sommeil essentiels.' },
  { patterns: ['bipolaire', 'psychiatrique'], hint: 'Antecedent familial troubles de l\'humeur : nutrition neuroprotectrice. Omega-3 EPA, magnesium, B9 et B12 (formes methylees), vitamine D. Axe intestin-cerveau : microbiote a soutenir. Tryptophane le soir.' },
  { patterns: ['atopique'], hint: 'Terrain atopique familial : risque allergique accru. Diversification alimentaire variee, omega-3 des le jeune age, probiotiques specifiques (L. rhamnosus). Reduire les irritants alimentaires. Vitamine D importante.' },
  { patterns: ['renal', 'insuffisance renale', 'dialyse'], hint: 'Antecedent familial renal : hydratation optimale, reduire exces proteines animales et sodium. Eviter exces d\'oxalates (epinards, rhubarbe). Surveiller la tension arterielle. Bilan renal regulier.' },
  { patterns: ['cirrhose'], hint: 'Antecedent familial hepatique : soutien hepatique preventif. Chardon-marie, NAC, curcuma, artichaut. Reduire alcool, sucres, fructose en exces. Cruciferes pour les voies de detoxification.' },
  { patterns: ['thalassemie', 'drepanocytose'], hint: 'Antecedent familial anemie genetique : bilan hematologique recommande. Ne pas supplementer en fer sans analyse. Verifier ferritine, B12, folates. Coordination hematologue si composante genetique confirmee.' },
  { patterns: ['goutte', 'acide urique'], hint: 'Antecedent familial goutte : prevention par hydratation ++, reduire purines (abats, charcuterie, biere, fruits de mer). Vitamine C aide a l\'excretion. Cerises et quercetine anti-inflammatoires.' },
  { patterns: ['gyneco', 'endometriose familial'], hint: 'Antecedent familial gynecologique : terrain hormonal a surveiller. Equilibre oestrogene/progesterone, DIM (cruciferes), graines de lin, omega-3. Reduire perturbateurs endocriniens (plastiques, cosmetiques).' },

  // OPERATIONS CHIRURGICALES
  { patterns: ['cholecystectomie'], hint: 'Vesicule retiree : le corps ne stocke plus la bile. Difficultes a digerer les graisses. Enzymes biliaires (taurine, ox bile) au repas. Petits repas frequents, eviter gros repas gras. Chardon-marie pour soutien hepatique.' },
  { patterns: ['bypass', 'sleeve', 'bariatrique', 'anneau gastrique'], hint: 'Chirurgie bariatrique : risque majeur de carences a vie. Suivi obligatoire : B12, fer, calcium, vitamine D, zinc, folates, proteines. Supplementation multivitamines specifique bariatrique. Petits repas fractionnes. Coordination medecin nutritionniste.' },
  { patterns: ['thyroidectomie'], hint: 'Thyroidectomie : traitement hormonal substitutif a vie. Iode, selenium et zinc restent importants. Attention aux interactions levothyroxine-aliments (calcium, fer, cafe, soja). Prise a jeun 30-60 min avant petit-dejeuner.' },
  { patterns: ['appendicite', 'appendice'], hint: 'Appendicectomie : impact possible sur le microbiote (l\'appendice est un reservoir de bonnes bacteries). Probiotiques multi-souches recommandes. Fibres prebiotiques pour restaurer la flore.' },
  { patterns: ['hernie discale', 'hernie hiatale'], hint: 'Hernie hiatale : reflux frequent post-operation. Petits repas, ne pas se coucher apres manger, surelever la tete du lit. Eviter cafe, tomate, agrumes, alcool, menthe. Aloe vera et reglisse DGL en soutien.' },
  { patterns: ['cesarienne'], hint: 'Cesarienne : le bebe n\'a pas recu le microbiote vaginal. Si allaitement : probiotiques pour la mere transmis au bebe. Recuperation abdominale : proteines, zinc, vitamine C pour cicatrisation.' },
  { patterns: ['hysterectomie', 'uterus'], hint: 'Hysterectomie : risque osteoporose accru si ovaires retires. Calcium + D3 + K2 essentiels. Phytoestrogenes si menopause chirurgicale. Magnesium, omega-3 pour l\'humeur.' },
  { patterns: ['prothese', 'arthroplastie'], hint: 'Prothese articulaire : collagene type II, vitamine C, silicium pour les tissus. Omega-3 et curcuma anti-inflammatoires. Proteines pour la recuperation musculaire. Calcium + D3 pour l\'os.' },
  { patterns: ['ligament', 'lca', 'menisque', 'croise'], hint: 'Chirurgie ligamentaire/menisque : collagene hydrolyse 10-15g + vitamine C 30-60 min avant la reeducation. Omega-3, curcuma, bromelaine pour reduire l\'inflammation. Proteines 1.6-2g/kg pour la reconstruction.' },
  { patterns: ['colectomie', 'resection'], hint: 'Resection intestinale : risque de malabsorption selon la zone retiree. Ileon = B12 et sels biliaires. Colon = eau et electrolytes. Supplementation adaptee obligatoire. Probiotiques. Coordination gastro-enterologue.' },
  { patterns: ['gastrectomie'], hint: 'Gastrectomie : malabsorption B12, fer, calcium quasi certaine. Fractionnement des repas (6-8 petits repas/jour). Dumping syndrome possible si sucres rapides. Supplementation multivitamines injectable ou sublinguale.' },
  { patterns: ['nephrectomie'], hint: 'Nephrectomie : un seul rein restant, le proteger. Hydratation optimale, eviter exces proteines et sodium. Reduire oxalates si antecedent de calculs. Surveillance tension arterielle. Coordination nephrologue.' },
  { patterns: ['splenectomie'], hint: 'Rate retiree : immunite affaiblie a vie. Zinc, vitamine C, vitamine D essentiels. Probiotiques pour soutien immunitaire. Vaccination a jour. Vigilance infections.' },
  { patterns: ['pontage', 'stent'], hint: 'Chirurgie cardiaque : omega-3 EPA/DHA, CoQ10, magnesium. Reduire sodium, graisses saturees. Regime mediterraneen recommande. Attention interactions anticoagulants avec vitamine K, omega-3 haute dose, ail.' },
  { patterns: ['radiotherapie'], hint: 'Post-radiotherapie : focus proteines, microbiote, anti-inflammatoire. Alimentation riche en cruciferes, curcuma, the vert. Ne pas supplementer en antioxydants sans accord oncologue.' },

  // ACCIDENTS ET TRAUMATISMES
  { patterns: ['accident', 'trauma', 'traumatisme'], hint: 'Post-traumatisme : la recuperation necessite plus de proteines, zinc, vitamine C, vitamine A pour la cicatrisation. Omega-3 anti-inflammatoires. Magnesium pour le stress post-traumatique.' },
  { patterns: ['commotion', 'traumatisme cranien', 'tcc'], hint: 'Traumatisme cranien : omega-3 DHA haute dose pour la neuroprotection. Magnesium, curcuma, vitamines B. Reduire sucres et ultra-transformes. Repos cognitif + sommeil prioritaires.' },
  { patterns: ['brulure'], hint: 'Brulure grave : besoins proteiques tres eleves (2-2.5g/kg). Zinc, vitamine C, vitamine A pour la cicatrisation. Hydratation renforcee. Calories augmentees 30-50% selon gravite.' },
  { patterns: ['whiplash', 'coup du lapin', 'cervical'], hint: 'Traumatisme cervical : magnesium pour les tensions musculaires, omega-3 anti-inflammatoires, collagene pour les tissus. Curcuma + bromelaine. Coordination avec Benoit pour la reeducation.' },

  // PATHOLOGIES METABOLIQUES
  { patterns: ['diabete type 1', 'dt1'], hint: 'Diabete type 1 : coordination endocrinologue indispensable. Ajuster les glucides au traitement insulinique. Fibres solubles a chaque repas, chrome, index glycemique bas. Surveillance hypoglycemies si changement alimentaire.' },
  { patterns: ['diabete type 2', 'dt2'], hint: 'Diabete type 2 : resistance a l\'insuline comme cause. Index glycemique bas, berberine, chrome, cannelle de Ceylan. Jeune intermittent 16:8 possible sous surveillance. Perte de poids = amelioration significative.' },
  { patterns: ['prediabete', 'pre-diabete', 'intolerance glucose'], hint: 'Prediabete : fenetre d\'action pour inverser la tendance. Index glycemique bas strict, chrome 200mcg, cannelle, fibres 35g/jour. Activite physique quotidienne. Controle HbA1c tous les 3 mois.' },
  { patterns: ['syndrome metabolique'], hint: 'Syndrome metabolique : approche globale necessaire. Reduire sucres et glucides raffines, omega-3, magnesium. Perte de 5-10% du poids = amelioration significative de tous les marqueurs. Activite physique reguliere.' },
  { patterns: ['hyperuricemie'], hint: 'Goutte/Hyperuricemie : reduire purines (abats, charcuterie, biere, fruits de mer). Hydratation 2.5L/jour. Vitamine C 500mg aide l\'excretion. Cerises et quercetine anti-inflammatoires. Eviter le fructose en exces.' },
  { patterns: ['hypoglycemie', 'hypoglycemies reactionnelles'], hint: 'Hypoglycemies : fractionner les repas (5-6 petits repas), proteines + fibres a chaque prise, eviter sucres rapides isoles. Chrome, magnesium. Toujours avoir une collation d\'urgence.' },

  // PATHOLOGIES THYROIDIENNES
  { patterns: ['hypothyroidie'], hint: 'Hypothyroidie : verifier iode, selenium (2 noix du Bresil/jour), zinc, fer, vitamine D. Limiter cruciferes crus et soja. Cuisson reduit les goitrogenes. Si Hashimoto : explorer le gluten.' },
  { patterns: ['hyperthyroidie', 'basedow'], hint: 'Hyperthyroidie : besoins caloriques augmentes, risque de perte musculaire. Proteines elevees, calcium + D3 (risque osteoporose). Reduire cafeine et stimulants. Selenium peut aider. Coordination endocrinologue.' },
  { patterns: ['nodule thyroidien', 'nodules'], hint: 'Nodules thyroidiens : iode ni trop ni trop peu. Selenium, zinc, myo-inositol. Cruciferes en quantite moderee et cuits. Surveillance echographique reguliere. Coordination endocrinologue.' },

  // PATHOLOGIES DIGESTIVES
  { patterns: ['maladie de crohn'], hint: 'Crohn : alimentation anti-inflammatoire stricte en poussee (regime pauvre en residus). En remission : reintroduction progressive. Curcuma, omega-3, L-glutamine, probiotiques Saccharomyces boulardii. Coordination gastro-enterologue.' },
  { patterns: ['colite ulcereuse', 'rectocolite'], hint: 'Rectocolite : en poussee = alimentation douce sans fibres insolubles. En remission = anti-inflammatoire, omega-3, curcuma, probiotiques VSL#3. Fer et B12 a surveiller. Coordination gastro-enterologue.' },
  { patterns: ['rgo'], hint: 'RGO : ne pas se coucher 3h apres le repas, surelever tete du lit. Eviter : cafe, tomate, agrumes, menthe, alcool, chocolat. Petits repas frequents. Reglisse DGL, aloe vera, zinc carnosine.' },
  { patterns: ['gastrite'], hint: 'Gastrite : aliments doux, bien cuits, tiedes. Eviter epices fortes, cafe, alcool, AINS. Miel de Manuka, reglisse DGL, L-glutamine. Verifier H. pylori si chronique.' },
  { patterns: ['diverticulose', 'diverticules'], hint: 'Diverticulose : fibres progressives (objectif 30-35g/jour), hydratation 2L minimum. Eviter graines et noix entieres en phase aigue uniquement (mythe ancien). Probiotiques, L-glutamine.' },
  { patterns: ['steatose', 'foie gras', 'nash', 'nafld'], hint: 'Steatose hepatique : le fructose est l\'ennemi #1 (sodas, jus, sirop d\'agave). Reduire sucres et glucides raffines. Chardon-marie, NAC, choline, vitamine E. Perte de 7-10% du poids = regression. Exercice regulier.' },
  { patterns: ['hepatite'], hint: 'Hepatite : soutien hepatique doux. Chardon-marie, NAC, artichaut. Eviter alcool absolument. Proteines moderees, antioxydants. Coordination hepatologue.' },

  // PATHOLOGIES CARDIOVASCULAIRES
  { patterns: ['hta'], hint: 'Hypertension : regime DASH, sodium <5g/jour. Potassium (banane, avocat, patate douce), magnesium 400mg, CoQ10 100-200mg, omega-3, ail noir. Reduire alcool, cafe excessif. Exercice regulier.' },
  { patterns: ['hypercholesterolemie', 'dyslipidemie'], hint: 'Cholesterol : fibres solubles (avoine, psyllium 10g/jour), sterols vegetaux 2g/jour, omega-3, ail, noix 30g/jour. Reduire graisses saturees et trans. Si statines : CoQ10 200mg/jour obligatoire.' },
  { patterns: ['fibrillation', 'tachycardie'], hint: 'Arythmie : magnesium prioritaire (glycinate 400mg), potassium, omega-3 EPA. Reduire cafeine, alcool, sucre. Verifier thyroide, fer, electrolytes. Coordination cardiologue.' },
  { patterns: ['insuffisance cardiaque'], hint: 'Insuffisance cardiaque : sodium strict <2g/jour, fluides parfois limites. CoQ10 200-300mg, taurine, magnesium, omega-3. Petits repas frequents. Surveillance poids quotidienne. Coordination cardiologue.' },
  { patterns: ['accident vasculaire'], hint: 'Post-AVC : omega-3 EPA/DHA, antioxydants, regime mediterraneen. Reduire sodium et graisses saturees. DHA pour neuroprotection. Reeducation + nutrition = combo essentiel. Coordination neurologue.' },

  // PATHOLOGIES RESPIRATOIRES
  { patterns: ['bpco', 'bronchite chronique', 'emphyseme'], hint: 'BPCO : besoins caloriques souvent augmentes. Proteines elevees pour maintenir la masse musculaire. Antioxydants (vitamine C, E, NAC 600mg). Petits repas frequents pour ne pas comprimer le diaphragme.' },
  { patterns: ['apnee du sommeil', 'apnee'], hint: 'Apnee du sommeil : la perte de poids est le traitement nutritionnel #1. Reduire inflammation : omega-3, curcuma. Eviter alcool le soir. Magnesium pour la qualite du sommeil. Coordination ORL/pneumologue.' },

  // PATHOLOGIES RENALES
  { patterns: ['calculs renaux', 'lithiase', 'colique nephretique'], hint: 'Calculs renaux : hydratation 2.5-3L/jour essentielle. Si oxalate de calcium : reduire epinards, rhubarbe, betterave, amandes. Calcium AU repas (lie les oxalates). Citrate de magnesium, jus de citron.' },
  { patterns: ['irc'], hint: 'Insuffisance renale : adapter les proteines selon le stade (pas trop, pas trop peu). Reduire sodium, potassium et phosphore selon le stade. Pas de supplements sans accord nephrologue. Surveillance biologique rapprochee.' },

  // PATHOLOGIES NEUROLOGIQUES
  { patterns: ['epilepsie'], hint: 'Epilepsie : regime cetogene peut reduire les crises (protocole medical strict). Magnesium, taurine, omega-3 DHA. Attention aux interactions avec antiepileptiques. Coordination neurologue obligatoire.' },
  { patterns: ['neuropathie'], hint: 'Neuropathie : B12 methylcobalamine, acide alpha-lipoique 600mg, magnesium, B6 (attention surdosage). Omega-3 pour la gaine de myeline. Controle glycemique si diabetique.' },
  { patterns: ['migraine chronique'], hint: 'Migraines chroniques : magnesium 400-600mg, riboflavine B2 400mg, CoQ10 150mg, feverfew. Identifier triggers : tyramine, histamine, glutamate, aspartame, alcool, cafeine, deshydratation. Tenir un journal alimentaire.' },
  { patterns: ['sep', 'sclerose en plaques'], hint: 'SEP : vitamine D haute dose (sous controle medical, objectif >100 nmol/L). Omega-3, protocole Wahls (9 tasses legumes/jour). Reduire gluten et laitiers. Coordination neurologue.' },

  // PATHOLOGIES AUTO-IMMUNES
  { patterns: ['polyarthrite rhumatoide', 'pr'], hint: 'Polyarthrite rhumatoide : regime anti-inflammatoire strict. Omega-3 3-4g/jour, curcuma + piperine, vitamine D. Eliminer gluten et laitiers pendant 3 mois pour evaluer. Coordination rhumatologue.' },
  { patterns: ['spondylarthrite'], hint: 'Spondylarthrite : recherche lien avec amidon et Klebsiella (regime Ebringer/London AS Diet). Reduire amidons, omega-3 haute dose, curcuma, vitamine D. Coordination rhumatologue.' },
  { patterns: ['vitiligo'], hint: 'Vitiligo : antioxydants (vitamine C, E, acide alpha-lipoique), B12, folates, cuivre, zinc. Ginkgo biloba peut aider la repigmentation. Vitamine D. Reduire le stress oxydatif.' },

  // PATHOLOGIES GYNECOLOGIQUES
  { patterns: ['fibromes', 'myomes'], hint: 'Fibromes : lien avec exces d\'oestrogenes. DIM, calcium-D-glucarate, cruciferes. Reduire viande rouge, xenoestrogenes (plastiques). Vitamine D (carence frequente chez les femmes avec fibromes). Fer si saignements abondants.' },
  { patterns: ['adenomyose'], hint: 'Adenomyose : approche similaire a l\'endometriose. Anti-inflammatoire strict, omega-3, curcuma, magnesium pour les crampes. Fer si regles abondantes. Coordination gynecologue.' },

  // PATHOLOGIES OSSEUSES ET ARTICULAIRES
  { patterns: ['osteopenie'], hint: 'Osteopenie/Osteoporose : calcium 1000-1200mg/jour (alimentaire prioritaire), vitamine D3 2000-4000UI, vitamine K2 MK-7 200mcg. Magnesium, bore, silicium. Proteines suffisantes. Exercice en charge. Reduire cafe, sel, alcool.' },
  { patterns: ['msm', 'glucosamine', 'chondroitine'], hint: 'Arthrose : collagene type II 40mg, curcuma + piperine 1000mg, omega-3, MSM 1500mg. Glucosamine + chondroitine si stade precoce. Perte de poids si surpoids (chaque kg en moins = 4kg de pression en moins sur le genou).' },
  { patterns: ['scoliose'], hint: 'Scoliose : magnesium pour les tensions musculaires, omega-3 anti-inflammatoires, vitamine D + K2 pour la densite osseuse. Coordination Benoit pour renforcement musculaire adapte.' },

  // PATHOLOGIES DERMATOLOGIQUES
  { patterns: ['rosacee', 'couperose'], hint: 'Rosacee : souvent liee au SIBO ou H. pylori. Traiter la cause intestinale. Eviter epices, alcool, cafe, histamine. Omega-3, zinc, probiotiques Lactobacillus. Aloe vera en externe.' },
  { patterns: ['urticaire', 'urticaire chronique'], hint: 'Urticaire chronique : souvent lie a l\'histamine. Regime pauvre en histamine 2-4 semaines. DAO enzyme, vitamine C, quercetine. Verifier thyroide auto-immune (frequemment associe). Probiotiques.' },
  { patterns: ['alopecie', 'perte de cheveux', 'cheveux'], hint: 'Perte de cheveux : verifier fer (ferritine >70), zinc, biotine, vitamine D, thyroide. Proteines suffisantes (keratine = proteine). MSM, silicium, collagene. Si SOPK/hormonal : voir approche hormonale.' },

  // SANTE MENTALE
  { patterns: ['anxiete generalisee', 'tag'], hint: 'Anxiete generalisee : magnesium glycinate 400mg, L-theanine 200mg, ashwagandha 600mg. Omega-3 EPA. Reduire cafeine, sucres raffines. Probiotiques (Lactobacillus helveticus + Bifidobacterium longum). Coherence cardiaque.' },
  { patterns: ['toc'], hint: 'TOC : inositol haute dose (12-18g/jour) montre efficace dans les etudes. NAC 2400mg/jour. Omega-3 EPA. Magnesium. Coordination psychiatre pour ajustement avec traitement medicamenteux.' },
  { patterns: ['trouble bipolaire'], hint: 'Trouble bipolaire : omega-3 haute dose (EPA 1-2g), NAC, magnesium. Attention au millepertuis (peut declencher manie). Lithium trace (si pas sous lithium medicamenteux). Coordination psychiatre obligatoire.' },

  // ALIMENTS EVITES ET REGIMES
  { patterns: ['seigle', 'orge', 'epeautre'], hint: 'Eviction gluten : alternatives — riz, quinoa, sarrasin, millet, amarante, mais, avoine certifiee sans gluten. Attention gluten cache : sauces soja, bouillons cubes, biere, charcuterie. Verifiez B12, fer et folates si eviction longue.' },
  { patterns: ['fromage', 'yaourt', 'creme', 'beurre'], hint: 'Eviction laitiers : alternatives calcium — sardines en boite, amandes, brocoli, chou kale, eaux calciques (Hepar, Contrex). Attention a l\'iode et la vitamine D. Differenciez lactose vs caseine pour savoir ce qui est tolere.' },
  { patterns: ['viande', 'porc', 'boeuf', 'viande rouge'], hint: 'Eviction viande : verifier apports en fer heminique, B12, zinc, creatine. Sources alternatives : poisson, oeufs, legumineuses + cereales, tofu, tempeh. Supplementation B12 si pas de produits animaux.' },
  { patterns: ['tofu', 'tempeh', 'edamame'], hint: 'Eviction soja : alternatives proteines vegetales — pois chiches, lentilles, haricots, chanvre, graines de courge. Attention : soja cache dans lecithine, huile, proteines texturees, sauces.' },
  { patterns: ['sucre', 'glucose'], hint: 'Reduction sucre : alternatives naturelles — stevia, erythritol, sirop de yacon (prebiotique), cannelle pour la saveur sucree. Attention aux sucres caches : sauces, pain industriel, cereales petit-dej, yaourts aromatises.' },
  { patterns: ['alcool', 'vin', 'biere'], hint: 'Eviction alcool : benefique pour le foie, le sommeil, le poids et l\'inflammation. Alternatives sociales : kombucha, eau gazeuse + citron, mocktails. Si consommation occasionnelle : vin rouge bio en petite quantite.' },
  { patterns: ['cafe', 'the'], hint: 'Reduction cafeine : sevrage progressif sur 2 semaines pour eviter les maux de tete. Alternatives : matcha (L-theanine = energie sans nervosite), chicoree, roibos, tisanes. Metabolisme cafeine variable selon le gene CYP1A2.' },
  { patterns: ['sel'], hint: 'Reduction sel : cuisiner avec herbes, epices, citron, vinaigre. Attention sel cache : pain, charcuterie, fromage, conserves, sauces. Gomasio (sesame + sel) comme alternative de transition.' },
  { patterns: ['friture', 'huile raffine'], hint: 'Attention a ne pas eliminer tous les gras — les bons lipides sont essentiels. Privilegier : huile olive, avocat, noix, poisson gras. Eliminer : huiles raffinees, margarines hydrogenees, fritures. Cuisson douce preferable.' },
  { patterns: ['vegetalien', 'vegan'], hint: 'Regime vegan : supplementation B12 obligatoire, verifier fer, zinc, omega-3 DHA (huile d\'algues), iode, calcium, vitamine D. Combiner legumineuses + cereales pour proteines completes. Fer non-heminique + vitamine C pour absorption.' },
  { patterns: ['cetogene', 'keto', 'low carb'], hint: 'Regime cetogene/low carb : surveiller electrolytes (sodium, potassium, magnesium), fibres (souvent insuffisantes), et sante thyroidienne a long terme. Attention aux carences en vitamine C et prebiotiques.' },
  { patterns: ['paleo'], hint: 'Regime paleo : bonnes bases (pas d\'ultra-transforme) mais attention a l\'exces de viande et au manque de calcium (pas de laitiers). Compenser avec sardines, legumes verts, eaux calciques.' },
  { patterns: ['sans residu', 'sans fibre'], hint: 'Regime sans residu : temporaire uniquement (pre-coloscopie, poussee MICI). Ne pas maintenir longtemps — risque d\'appauvrir le microbiote. Reintroduction progressive des fibres des que possible.' },
  { patterns: ['anti-histamine', 'sans histamine'], hint: 'Regime pauvre en histamine : eviter fromages vieillis, charcuterie, vin, poisson non frais, tomate, epinards, avocat, chocolat, fraise. Privilegier aliments frais. Congelation reduit l\'histamine. Enzyme DAO en complement.' },
  { patterns: ['glutamate', 'msg', 'e621'], hint: 'Sensibilite au glutamate : present dans bouillons cubes, chips, plats asiatiques, proteines hydrolysees, levure autolysee. Cuisiner maison avec des ingredients frais. Peut declencher migraines, palpitations.' },
  { patterns: ['aspartame', 'edulcorant', 'sucralose'], hint: 'Edulcorants artificiels : controverses sur le microbiote et la reponse insulinique. Alternatives naturelles : stevia, erythritol, monk fruit. Mieux : se deshabituer du gout sucre progressivement.' },
  { patterns: ['conservateur', 'additif'], hint: 'Sensibilite aux additifs : cuisiner maison avec des ingredients bruts est la meilleure solution. Lire les etiquettes : moins de 5 ingredients, tous reconnaissables. Marches locaux et bio si possible.' },
  { patterns: ['pesticide', 'bio', 'organique'], hint: 'Eviter les pesticides : les 12 fruits/legumes les plus contamines (Dirty Dozen) a acheter bio en priorite — fraises, epinards, chou kale, peches, pommes, raisin. Les 15 moins contamines (Clean Fifteen) OK en conventionnel.' },
  { patterns: ['cru', 'raw'], hint: 'Alimentation crue : certains nutriments augmentent a la cuisson (lycopene tomate, beta-carotene carotte). Cruciferes crus = goitrogenes si thyroide fragile. Risque bacterien pour les immunodeprimes. Mixer/blender peut aider.' },
  { patterns: ['epice', 'piment', 'piquant'], hint: 'Eviction epice : souvent lie a reflux, gastrite ou SII. Alternatives pour relever les plats : herbes fraiches, gingembre doux, curcuma, citron, zestes. Reintroduction possible apres guerison muqueuse.' },

  // REGIMES SUIVIS
  { patterns: ['dukan', 'hyperproteine'], hint: 'Regime Dukan/hyperproteine : souvent efficace a court terme mais risque de carence en fibres, vitamines C, magnesium. Rebond de poids frequent a l\'arret. Verifiez la sante renale et hepatique. Reintroduction progressive des glucides complexes necessaire.' },
  { patterns: ['ketogenic'], hint: 'Regime cetogene : peut avoir deregle la flexibilite metabolique. Verifiez thyroide, electrolytes, fibres, microbiote. Reintroduction des glucides par paliers de 10g/semaine. Attention au cortisol si cetogene prolonge.' },
  { patterns: ['weight watchers', 'ww'], hint: 'Weight Watchers : systeme de points qui ne tient pas compte de la qualite nutritionnelle. Le client a l\'habitude de compter — transition vers l\'ecoute des signaux de faim/satiete a travailler.' },
  { patterns: ['5:2', 'omad'], hint: 'Jeune intermittent passe : verifiez la relation avec la nourriture (pas de TCA induit). Si bien vecu, peut etre reintegre. Attention si stress eleve, problemes thyroidiens ou antecedent TCA.' },
  { patterns: ['detox', 'jus', 'juice'], hint: 'Cure detox/jus : aucune base scientifique pour les cures detox. Le foie et les reins font le travail. Si le client y croit, orienter vers une alimentation anti-inflammatoire et riche en cruciferes plutot que des cures ponctuelles.' },
  { patterns: ['soupe au chou'], hint: 'Regime soupe : tres restrictif, carence en proteines et lipides. Perte de masse musculaire probable. Verifiez la masse musculaire actuelle. Reconstruire avec proteines adequates (1.2-1.6g/kg).' },
  { patterns: ['atkins', 'bas en glucides'], hint: 'Low carb/Atkins passe : le metabolisme peut etre adapte aux lipides. Reintroduction progressive des glucides complexes. Verifiez la tolerance glycemique actuelle. Le microbiote a besoin de fibres prebiotiques.' },
  { patterns: ['sans gluten'], hint: 'Regime sans gluten passe : si arrete sans raison medicale, la reintroduction peut causer des ballonnements temporaires (le microbiote s\'est adapte). Reintroduction progressive. Si coeliaque : ne jamais reintroduire.' },
  { patterns: ['sans lactose', 'sans laitier'], hint: 'Regime sans laitiers passe : la lactase peut diminuer sans exposition. Reintroduction par les yaourts et fromages affines (moins de lactose). Si caseine = le probleme, les laitiers restent a eviter.' },
  { patterns: ['restriction', '1200', '1000', '800'], hint: 'Restriction calorique passee : risque de metabolisme ralenti (adaptive thermogenesis). NE PAS descendre sous 1200 kcal femme / 1500 kcal homme. Reverse diet progressif : augmenter de 100 kcal/semaine. Verifiez thyroide et cortisol.' },
  { patterns: ['yo-yo', 'yoyo', 'effet yoyo'], hint: 'Historique yo-yo : le metabolisme a ete malmene. Priorite absolue : stabiliser le poids AVANT toute perte. Pas de deficit agressif. Proteines elevees, musculation, sommeil. Travailler la relation a la nourriture.' },
  { patterns: ['cohen', 'thonon', 'natman', 'starter'], hint: 'Regimes express (Cohen, Thonon, Natman) : tres restrictifs, carences multiples, perte musculaire. Rebond quasi systematique. Le client a besoin d\'une approche durable, pas d\'un enieme regime. Reconstruire la confiance avec l\'alimentation.' },
  { patterns: ['chrononutrition', 'delabos'], hint: 'Chrononutrition : certains principes valables (timing des repas). Le fromage le matin et le sucre l\'apres-midi ont une base chronobiologique. Integrer les bons aspects dans un plan personnalise.' },
  { patterns: ['macrobiotique', 'ayurveda', 'ayurvedique'], hint: 'Approche macrobiotique/ayurvedique : principes interessants (alimentation locale, saisonniere, epices). Verifiez que ce n\'est pas trop restrictif. Adapter les principes utiles au contexte suisse et au profil du client.' },
  { patterns: ['carnivore', 'all meat'], hint: 'Regime carnivore passe : risque de depletion en fibres, vitamine C, polyphenols, prebiotiques. Microbiote tres appauvri. Reintroduction TRES progressive des vegetaux (commencer par legumes cuits faciles : courgette, carotte).' },
  { patterns: ['mediterraneen', 'cretois'], hint: 'Regime mediterraneen : excellent choix, le plus etudie scientifiquement. Si le client l\'a deja suivi avec succes, s\'en inspirer comme base du nouveau plan. Huile olive, poisson, legumes, legumineuses, noix.' },
  { patterns: ['dash'], hint: 'Regime DASH : concu pour l\'hypertension mais excellent pour la sante globale. Riche en potassium, magnesium, fibres. Si le client l\'a apprecie, l\'integrer comme base.' },
  { patterns: ['anti-inflammatoire'], hint: 'Regime anti-inflammatoire passe : si bien vecu et efficace, reprendre les memes principes. Omega-3, curcuma, baies, cruciferes, elimination ultra-transformes et sucres.' },
  { patterns: ['herbalife', 'juice plus', 'forever', 'substitut', 'shake', 'poudre'], hint: 'Substituts de repas (Herbalife, Juice Plus, etc.) : ne remplacent pas une vraie alimentation. Le client a besoin d\'apprendre a manger des vrais aliments. Transition vers des repas complets, simples et rapides.' },
  { patterns: ['comptage', 'myfitnesspal', 'yazio', 'tracker'], hint: 'Comptage de calories passe : peut induire une relation obsessionnelle avec la nourriture. Evaluer si le client a une relation saine avec le tracking. Certains beneficient du suivi, d\'autres ont besoin de lacher prise.' },
  { patterns: ['anorexie'], hint: 'ATTENTION : antecedent de trouble alimentaire. Approche ULTRA bienveillante, aucune restriction, aucun comptage. Coordination psychologue/psychiatre OBLIGATOIRE. Objectif : relation saine avec la nourriture, pas de perte de poids.' },

  // MASTICATION
  { patterns: ['vite', 'rapide', 'rapidement', 'pas le temps'], hint: 'Manger vite = mauvaise mastication = digestion compromise. La digestion commence dans la bouche (amylase salivaire). Recommandez : poser la fourchette entre chaque bouchee, macher 20-30 fois, repas minimum 20 minutes. Ameliore satiete, digestion et absorption.' },
  { patterns: ['mastication', 'mache', 'macher'], hint: 'La mastication est le premier acte digestif. Mauvaise mastication = ballonnements, reflux, mauvaise absorption. Exercice : chronometrer un repas et viser 20 min minimum. Les smoothies et soupes ne remplacent pas la mastication.' },
  { patterns: ['debout', 'devant ecran', 'devant la tele', 'en marchant'], hint: 'Manger dans de mauvaises conditions (debout, devant ecran, stresse) active le systeme nerveux sympathique et reduit les enzymes digestives. Recommandez : manger assis, au calme, sans ecran, en pleine conscience.' },

  // GRIGNOTAGE
  { patterns: ['grignotage', 'grignote', 'entre les repas'], hint: 'Grignotage frequent : souvent signe de repas principaux insuffisants en proteines ou en fibres. Verifiez la composition du petit-dejeuner et du dejeuner. Si besoin d\'une collation : la structurer (proteine + fibre + bon gras) plutot que grignoter au hasard.' },
  { patterns: ['toujours faim', 'jamais rassasie'], hint: 'Faim constante : verifiez les proteines (minimum 25-30g par repas), les fibres (legumes a chaque repas), et les bons lipides (avocat, noix, huile olive). Aussi : sommeil insuffisant augmente la ghreline (hormone de la faim).' },
  { patterns: ['nocturne', 'frigo la nuit', 'mange la nuit'], hint: 'Grignotage nocturne : souvent lie au stress, a l\'ennui ou a un diner insuffisant. Verifiez : proteines et fibres au diner, heure du diner (pas trop tot), gestion du stress. Tisane ou collation proteinee legere si vraie faim.' },
  { patterns: ['coup de barre', '16h'], hint: 'Grignotage d\'apres-midi : souvent cause par un dejeuner trop riche en glucides simples ou pauvre en proteines. Solution : ajouter proteines au dejeuner, collation planifiee a 16h (pomme + amandes, yaourt grec + baies).' },

  // COMPULSIONS SUCREES
  { patterns: ['envie de sucre', 'addiction au sucre', 'besoin de sucre'], hint: 'Compulsions sucrees : souvent liees a une dysbiose intestinale (Candida), un desequilibre glycemique, une carence en chrome/magnesium, ou le stress (cortisol). Approche en 4 etapes : stabiliser la glycemie, nourrir le microbiote, supplementer chrome + magnesium, gerer le stress.' },
  { patterns: ['chocolat'], hint: 'Envie irrepressible de chocolat : souvent signe de carence en magnesium. Chocolat noir 85%+ est OK (riche en magnesium et polyphenols, faible en sucre). Limiter chocolat au lait/blanc. Supplementation magnesium bisglycinate 300mg si craving persistant.' },
  { patterns: ['biscuit', 'gateau', 'patisserie', 'viennoiserie'], hint: 'Compulsions patisseries : pic glycemique puis crash puis nouveau craving. Cercle vicieux. Rompre le cycle : proteines au petit-dejeuner, jamais de sucre seul (toujours avec proteine/fibre), chrome picolinate 200mcg, cannelle.' },
  { patterns: ['soda', 'coca', 'boisson sucree', 'jus de fruits'], hint: 'Boissons sucrees : source majeure de sucre cache (1 verre de jus = 25g de sucre sans les fibres du fruit). Transition progressive : diluer avec eau gazeuse, puis eau + citron, puis eau plate. Les jus de fruits ne sont PAS des fruits.' },
  { patterns: ['bonbon', 'confiserie', 'haribo'], hint: 'Confiseries : sucre pur + additifs + colorants. Aucun interet nutritionnel. Alternatives de transition : fruits secs (en petite quantite), chocolat noir, dattes Medjool. L\'objectif est de reduire le seuil de tolerance au sucre progressivement.' },
  { patterns: ['glace', 'creme glacee', 'dessert'], hint: 'Desserts quotidiens : habitude souvent ancree depuis l\'enfance. Alternatives : yaourt grec + baies + cannelle, banane glacee mixee, mousse de chocolat a l\'avocat. Garder un vrai dessert plaisir 1-2 fois/semaine sans culpabilite.' },
  { patterns: ['compulsif', 'incontrolable', 'craque', 'craquage'], hint: 'Compulsions alimentaires incontrolables : ne pas culpabiliser le client. Souvent liees a la restriction (plus on interdit, plus on craque). Approche bienveillante : pas d\'aliments interdits, mais des choix conscients. Si TCA suspecte : orientation psychologue.' },
  { patterns: ['frustration', 'privation', 'interdit'], hint: 'Sentiment de privation = risque de compulsion. Approche 80/20 recommandee : 80% d\'alimentation saine, 20% de plaisir sans culpabilite. Aucun aliment ne devrait etre totalement interdit (sauf allergie/intolerance medicale).' },

  // HYDRATATION
  { patterns: ['boit pas', 'pas assez', 'deshydrate'], hint: 'Hydratation insuffisante : souvent confondue avec la faim. 2L/jour minimum, plus si sport ou chaleur. Astuce : 1 verre au reveil, 1 avant chaque repas, gourde toujours visible. Eau plate de preference, les tisanes comptent.' },
  { patterns: ['expresso', 'nespresso'], hint: 'Exces de cafe : stimule le cortisol, perturbe le sommeil si apres 14h, reduit l\'absorption du fer. Maximum 2-3 cafes/jour, toujours apres un repas (pas a jeun). Alternative : matcha (L-theanine = focus sans nervosite).' },
  { patterns: ['apero'], hint: 'Alcool : calories vides, perturbe le sommeil, inflammatoire, toxique pour le foie, augmente l\'appetit. Pas d\'alcool quotidien. Si consommation sociale : vin rouge bio en petite quantite, toujours avec un repas, jamais a jeun.' },

  // BLESSURES ARTICULAIRES
  { patterns: ['rotule'], hint: 'Genou : collagene hydrolyse 10-15g/jour + vitamine C. Omega-3 anti-inflammatoires, curcuma + piperine. Reduire les aliments pro-inflammatoires (sucre, gluten, alcool). Coordination Benoit pour adapter l\'activite. Si opere : proteines elevees 1.6-2g/kg pour reconstruction.' },
  { patterns: ['epaule', 'coiffe', 'rotateur'], hint: 'Epaule/Coiffe des rotateurs : collagene type I, vitamine C, magnesium. Omega-3 et curcuma pour l\'inflammation. Bromelaine (ananas) peut aider. Coordination Benoit pour la reeducation et les mouvements a eviter.' },
  { patterns: ['labrum'], hint: 'Hanche : collagene, glucosamine, chondroitine. Omega-3 anti-inflammatoires. Vitamine D + K2 pour la sante osseuse. Si prothese : proteines elevees et calcium. Coordination Benoit pour mobilite.' },
  { patterns: ['cheville', 'entorse'], hint: 'Cheville/Entorse : bromelaine et curcuma pour reduire l\'oedeme. Collagene + vitamine C pour les ligaments. Zinc pour la cicatrisation. Proteines suffisantes pour la reparation tissulaire.' },
  { patterns: ['poignet', 'canal carpien'], hint: 'Poignet/Canal carpien : vitamine B6 (forme P5P), magnesium, curcuma anti-inflammatoire. Omega-3. Verifier thyroide (hypothyroidie = facteur de risque). Reduire retention d\'eau (sodium, hydratation).' },

  // BLESSURES DORSALES
  { patterns: ['lumbago'], hint: 'Dos/Lombaires : magnesium bisglycinate 300-400mg/jour pour decontraction musculaire. Omega-3, curcuma, gingembre anti-inflammatoires. Vitamine D souvent deficiente. Hydratation pour les disques intervertebraux. Coordination Benoit pour renforcement.' },
  { patterns: ['protrusion'], hint: 'Hernie discale : anti-inflammatoire nutritionnel strict (omega-3, curcuma, boswellia). Collagene pour les tissus. Magnesium. Eviter exces de poids qui aggrave la compression. Coordination Benoit pour reeducation.' },
  { patterns: ['sciatique', 'nerf sciatique'], hint: 'Sciatique : magnesium pour le nerf, vitamines B (B1, B6, B12) pour la gaine de myeline. Curcuma, omega-3 anti-inflammatoires. Eviter position assise prolongee. Coordination Benoit.' },
  { patterns: ['nuque', 'torticolis'], hint: 'Cervicales : magnesium pour les tensions, omega-3 anti-inflammatoires. Verifier la posture (ecrans, oreiller). Collagene pour les disques. Coordination Benoit pour exercices de mobilite cervicale.' },

  // BLESSURES MUSCULAIRES ET TENDINEUSES
  { patterns: ['tendinopathie'], hint: 'Tendinite : collagene hydrolyse 10-15g + vitamine C 30-60 min AVANT l\'entrainement. Omega-3, curcuma. Reduire sucres (glycation du collagene). Repos relatif essentiel. Coordination Benoit pour charge progressive.' },
  { patterns: ['dechirure', 'claquage', 'elongation'], hint: 'Dechirure/Claquage : proteines elevees 2g/kg pour la reconstruction. Collagene + vitamine C. Zinc et vitamine A pour la cicatrisation. Omega-3 anti-inflammatoires. Hydratation renforcee. Repos et coordination Benoit pour reprise.' },
  { patterns: ['crampe'], hint: 'Crampes recurrentes : magnesium (bisglycinate 300-400mg), potassium (banane, avocat), sodium si transpiration importante. Verifier hydratation. Aussi : calcium, vitamine D. Si nocturnes : magnesium au coucher.' },
  { patterns: ['contracture', 'tension musculaire', 'noeud'], hint: 'Contractures/Tensions : magnesium en priorite (bisglycinate au coucher). Hydratation. Potassium. Omega-3. Bains de sel d\'Epsom. Si chronique : verifier stress, posture, carence en magnesium. Massage recommande.' },
  { patterns: ['fascia', 'aponevrose', 'fasciite plantaire', 'epine calcaneenne'], hint: 'Fasciite plantaire : collagene + vitamine C, magnesium. Omega-3 et curcuma anti-inflammatoires. Perte de poids si surpoids (reduit la pression). Coordination Benoit pour etirements du mollet et de la voute plantaire.' },

  // BLESSURES OSSEUSES
  { patterns: ['casse', 'felure'], hint: 'Fracture : calcium 1000-1200mg/jour + vitamine D3 + K2 pour consolidation. Magnesium, silicium, bore. Collagene type I. Proteines elevees 1.5-2g/kg. Vitamine C pour le collagene. Eviter alcool et tabac. Duree consolidation : 6-12 semaines selon l\'os.' },
  { patterns: ['densite osseuse'], hint: 'Osteoporose/Osteopenie : calcium (sardines, amandes, brocoli, eaux calciques) + D3 2000-4000 UI + K2 100mcg. Magnesium. Exercice en charge essentiel (coordination Benoit). Reduire cafe, sel, proteines animales excessives. Verifier thyroide et hormones.' },
  { patterns: ['fracture de fatigue', 'stress fracture'], hint: 'Fracture de fatigue : surcharge + carence nutritionnelle. Verifier calcium, vitamine D, fer, apport calorique (RED-S chez les sportifs). Augmenter les calories si deficit. Coordination Benoit pour adaptation charge d\'entrainement.' },

  // DOULEURS CHRONIQUES
  { patterns: ['douleur chronique', 'douleur generalisee'], hint: 'Fibromyalgie/Douleur chronique : magnesium haute dose, CoQ10, D-ribose, omega-3. Vitamine D souvent tres basse. Reduire glutamate, aspartame, sucres. Anti-inflammatoire strict. Sommeil prioritaire. Coordination avec medecin.' },
  { patterns: ['inflammation', 'inflammatoire'], hint: 'Inflammation chronique : protocole anti-inflammatoire complet — omega-3 EPA 2-3g/jour, curcuma + piperine, gingembre, baies, the vert. Eliminer : sucres raffines, huiles raffinees, ultra-transformes, exces alcool. Verifier CRP et omega-3 index dans le bilan sanguin.' },
  { patterns: ['rhumatisme'], hint: 'Arthrose/Arthrite : omega-3 haute dose, curcuma + piperine, collagene type II pour le cartilage, boswellia. Reduire sucres, gluten, laitiers (souvent pro-inflammatoires). MSM + glucosamine en complement. Poids optimal essentiel.' },

  // POST-OPERATOIRE
  { patterns: ['operation', 'chirurgie', 'opere'], hint: 'Post-chirurgie : besoins nutritionnels augmentes. Proteines 1.5-2g/kg pour cicatrisation. Zinc 30mg, vitamine C 500mg, vitamine A. Collagene. Probiotiques si antibiotiques recus. Fer si perte de sang. Hydratation renforcee.' },
  { patterns: ['cicatrice', 'cicatrisation'], hint: 'Cicatrisation : vitamine C (kiwi, poivron, agrumes), zinc (graines de courge, huitres), vitamine A (patate douce, carotte), silicium, collagene hydrolyse. Proteines suffisantes. Eviter alcool et tabac qui ralentissent la guerison.' },
  { patterns: ['platre', 'immobilisation', 'attelle'], hint: 'Immobilisation : risque de perte musculaire rapide. Proteines 2g/kg minimum, leucine 3g/repas. Creatine 5g/jour aide a preserver la masse musculaire. Calcium + D3 pour l\'os. Omega-3 anti-inflammatoires. Coordination Benoit pour la reprise.' },

  // BLESSURES SPECIFIQUES AU SPORT
  { patterns: ['shin splint', 'periostite'], hint: 'Periostite tibiale : calcium, vitamine D, magnesium. Verifier chaussures et surface d\'entrainement. Reduire l\'impact. Omega-3 et curcuma. Coordination Benoit pour modification du volume d\'entrainement.' },
  { patterns: ['pubalgie', 'adducteur', 'aine'], hint: 'Pubalgie/Adducteurs : proteines elevees, collagene + vitamine C. Anti-inflammatoires naturels. Repos relatif essentiel. Coordination Benoit pour reeducation et renforcement du core.' },
  { patterns: ['tennis elbow', 'epicondylite', 'golf elbow', 'coude'], hint: 'Epicondylite : collagene + vitamine C, omega-3. Curcuma et boswellia anti-inflammatoires. Repos de l\'articulation. Si chronique : verifier technique sportive avec Benoit.' },
  { patterns: ['syndrome rotulien', 'femoro-patellaire'], hint: 'Syndrome femoro-patellaire : poids optimal pour reduire la pression. Collagene, omega-3. Renforcement du quadriceps et du moyen fessier — coordination Benoit. Anti-inflammatoires naturels.' },

  // POLYMORPHISMES GENETIQUES
  { patterns: ['mthfr', 'methylation'], hint: 'MTHFR (C677T/A1298C) : capacite de methylation reduite. Folates sous forme METHYLFOLATE uniquement (pas d\'acide folique synthetique). B12 sous forme methylcobalamine. Eviter acide folique des aliments enrichis. Impact : homocysteine elevee, risque cardiovasculaire, depression, fertilite.' },
  { patterns: ['apoe', 'apolipoproteine'], hint: 'APOE : variant e4 = risque accru Alzheimer et cardiovasculaire. Regime mediterraneen strict, omega-3 DHA prioritaire, reduire graisses saturees. Antioxydants (curcuma, baies, the vert). Exercice physique regulier = meilleur neuroprotecteur.' },
  { patterns: ['comt', 'catechol'], hint: 'COMT (Val158Met) : COMT lent = sensibilite au stress, a la cafeine et aux catechols. Reduire cafe, the vert en exces, chocolat. Magnesium prioritaire. COMT rapide = besoin accru de catechols, cafe mieux tolere.' },
  { patterns: ['dio2', 'deiodinase'], hint: 'DIO2 (Thr92Ala) : conversion T4→T3 reduite, hypothyroidie fonctionnelle meme avec TSH normale. Selenium essentiel (2-3 noix du Bresil/jour). Zinc, iode. Parfois T3 en complement du T4 — coordination endocrinologue.' },
  { patterns: ['fto', 'gene obesite'], hint: 'FTO (rs9939609) : predisposition a la prise de poids et a la faim accrue. NE PAS culpabiliser le client. Proteines elevees pour la satiete. Activite physique reguliere attenue l\'effet du gene. Chronobiologie : pas de grignotage nocturne.' },
  { patterns: ['vdr', 'recepteur vitamine d'], hint: 'VDR (BsmI, TaqI, FokI) : absorption et utilisation de la vitamine D alterees. Doses de vitamine D3 souvent superieures aux recommandations standard. Verifier le taux sanguin regulierement. Objectif 75-100 nmol/L. K2 toujours en association.' },
  { patterns: ['cyp1a2', 'metaboliseur cafeine'], hint: 'CYP1A2 : metaboliseur lent = la cafeine reste longtemps dans le corps, risque cardiovasculaire accru avec >2 cafes/jour. Metaboliseur rapide = cafeine eliminee vite, cafe bien tolere. Adapter la recommandation cafeine au profil genetique.' },
  { patterns: ['apoa2'], hint: 'APOA2 : variant CC = sensibilite accrue aux graisses saturees, prise de poids plus rapide avec beurre, fromage, viande grasse. Privilegier huile olive, avocat, noix. Graisses insaturees en priorite.' },
  { patterns: ['tcf7l2', 'risque diabete'], hint: 'TCF7L2 : variant a risque = predisposition diabete type 2. Index glycemique bas a chaque repas, fibres solubles, chrome, magnesium. Surveillance glycemique recommandee. Activite physique quotidienne reduit significativement le risque.' },
  { patterns: ['fads1', 'fads2', 'conversion omega'], hint: 'FADS1/FADS2 : conversion ALA→EPA/DHA reduite. Les sources vegetales d\'omega-3 (lin, chia, noix) sont insuffisantes. Supplementation directe EPA/DHA (huile de poisson ou d\'algues) necessaire.' },
  { patterns: ['hfe', 'hemochromatose'], hint: 'HFE (C282Y, H63D) : risque de surcharge en fer. NE PAS supplementer en fer sans analyse. Reduire viande rouge, eviter vitamine C avec repas riches en fer. Donner du sang regulierement peut aider. Surveillance ferritine obligatoire.' },
  { patterns: ['cbs', 'sulfuration'], hint: 'CBS (C699T) : voie de sulfuration acceleree, accumulation de sulfites/ammoniac. Reduire les aliments riches en soufre si upregulation : ail, oignon, cruciferes, oeufs (en exces). Molybdene pour metaboliser les sulfites.' },
  { patterns: ['sod2', 'superoxyde dismutase', 'mnsod'], hint: 'SOD2 (Ala16Val) : defense antioxydante mitochondriale reduite. Augmenter les antioxydants : vitamines C et E, selenium, manganese, CoQ10. Reduire stress oxydatif : pas de tabac, alcool modere, aliments frits limites.' },
  { patterns: ['pemt', 'choline'], hint: 'PEMT : besoin accru en choline, surtout chez les femmes. Sources : oeufs (jaune), foie, soja, boeuf. Carence frequente en cas de regime vegetalien. Impact sur le foie, le cerveau et la grossesse.' },
  { patterns: ['mao', 'monoamine oxydase'], hint: 'MAO-A : variant lent = accumulation serotonine/dopamine, tendance anxiete. Eviter exces de tyramine (fromage vieilli, vin, charcuterie). Magnesium, B6. MAO-A rapide = depletion rapide, risque depression. Tryptophane, 5-HTP avec precaution.' },
  { patterns: ['nos', 'oxyde nitrique', 'enos'], hint: 'NOS3/eNOS : production d\'oxyde nitrique reduite = sante vasculaire compromise. Aliments riches en nitrates : betterave, roquette, epinards. L-arginine, L-citrulline. CoQ10. Exercice physique augmente la production de NO.' },
  { patterns: ['ace', 'enzyme conversion angiotensine'], hint: 'ACE (I/D) : variant DD = risque hypertension et sensibilite au sel accrue. Reduire sodium, augmenter potassium. Omega-3, CoQ10, magnesium. Exercice d\'endurance particulierement benefique.' },
  { patterns: ['bcmo1', 'beta-carotene'], hint: 'BCMO1 : conversion beta-carotene → vitamine A reduite. Les carottes et patates douces ne suffisent pas comme source de vitamine A. Privilegier retinol preforme : foie, jaune d\'oeuf, beurre. Ou supplementation vitamine A directe.' },
  { patterns: ['slc30a8', 'zinc transporteur'], hint: 'SLC30A8 : transport du zinc altere. Besoins en zinc possiblement augmentes. Sources : huitres, graines de courge, boeuf. Verifier le zinc serique. Impact sur l\'immunite et la fonction insulinique.' },
  { patterns: ['lct', 'persistance lactase'], hint: 'LCT : non-persistance de la lactase = intolerance au lactose genetique. Les produits laitiers fermentes (yaourt, kefir) et fromages affines sont souvent toleres. Alternatives calcium indispensables si eviction totale.' },
  { patterns: ['hla-dq2', 'hla-dq8'], hint: 'HLA-DQ2/DQ8 : predisposition genetique a la maladie coeliaque. Le gene seul ne suffit pas (30% de la population le porte). Si symptomes digestifs : anticorps anti-transglutaminase a verifier. Si positif : eviction gluten stricte et definitive.' },
  { patterns: ['gstt1', 'gstm1', 'glutathion', 'detoxification'], hint: 'GSTT1/GSTM1 : deletion = capacite de detoxification phase 2 reduite. Augmenter cruciferes (sulforaphane), NAC (precurseur glutathion), selenium. Reduire exposition toxiques : pesticides, plastiques, alcool. Alimentation bio prioritaire.' },
  { patterns: ['mtr', 'mtrr', 'methionine synthase'], hint: 'MTR/MTRR : recyclage de la B12 altere. Besoins accrus en B12 methylcobalamine et methylfolate. Verifier homocysteine. Souvent associe a MTHFR — traiter ensemble. Impact sur neurologie, humeur, energie.' },
  { patterns: ['gad', 'gaba'], hint: 'GAD1 : conversion glutamate→GABA alteree. Possible exces de glutamate (excitateur) et deficit GABA (calmant). Eviter MSG, aspartame. Magnesium, taurine, L-theanine pour soutenir le GABA. Peut expliquer anxiete, insomnie, sensibilite au stress.' },
  { patterns: ['pon1', 'paraoxonase'], hint: 'PON1 : protection reduite contre le stress oxydatif des lipides. Augmenter polyphenols (grenade, huile olive extra vierge, curcuma). Omega-3. Reduire les huiles raffinees et aliments frits. Impact cardiovasculaire.' },
  { patterns: ['il6', 'tnf', 'interleukine', 'cytokine'], hint: 'IL6/TNF-alpha : variantes pro-inflammatoires = terrain inflammatoire chronique genetique. Protocole anti-inflammatoire strict : omega-3 haute dose, curcuma, resveratrol. Reduire sucre, alcool, ultra-transformes. Exercice modere (pas excessif).' },

  // PANELS GENETIQUES COMMERCIAUX
  { patterns: ['23andme', '23 and me'], hint: '23andMe : donnees brutes exploitables via des plateformes d\'analyse comme Genetic Genie, Promethease, ou Nutrahacker pour les SNPs nutritionnels. Demandez au client d\'exporter ses donnees brutes pour une analyse nutrigenomique personnalisee.' },
  { patterns: ['myheritage'], hint: 'MyHeritage : principalement oriente genealogie mais les donnees ADN brutes peuvent etre analysees sur des plateformes tierces pour les SNPs nutritionnels. Export des donnees brutes necessaire.' },
  { patterns: ['dnafit', 'dna fit'], hint: 'DNAfit : panel oriente sport et nutrition. Resultats directement exploitables pour la personnalisation du plan. Demandez le rapport complet au client.' },
  { patterns: ['dante labs', 'wgs', 'whole genome'], hint: 'Sequencage complet (WGS) : donnees les plus completes disponibles. Exploitable pour tous les SNPs nutritionnels. Necessite une plateforme d\'interpretation specialisee.' },
  { patterns: ['nutrigenomix', 'nutrigenomique', 'nutrigenetique'], hint: 'Test nutrigenomique : directement concu pour la personnalisation nutritionnelle. Couvre les genes cles (MTHFR, APOE, FTO, CYP1A2, VDR, etc.). Resultats directement actionnables pour le plan nutrition.' },
];

// ─── NORMALIZE TEXT (remove accents, lowercase) ───

function normalize(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

// ─── DETECT KEYWORDS IN TEXT ───

function detectKeywords(text) {
  if (!text || text.length < 3) return [];
  const norm = normalize(text);
  const matches = [];

  for (const kw of KEYWORDS) {
    for (const pattern of kw.patterns) {
      if (norm.includes(normalize(pattern))) {
        matches.push({ keyword: pattern, hint: kw.hint });
        break; // one match per keyword group is enough
      }
    }
    if (matches.length >= 3) break;
  }
  return matches;
}

// ─── HINT BUBBLES COMPONENT ───

export function KeywordBubbles({ text }) {
  const [hints, setHints] = useState([]);
  const [dismissed, setDismissed] = useState([]);
  const timerRef = useRef(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const detected = detectKeywords(text);
      setHints(detected);
    }, 500);
    return () => clearTimeout(timerRef.current);
  }, [text]);

  const visible = hints.filter(h => !dismissed.includes(h.keyword)).slice(0, 3);
  if (visible.length === 0) return null;

  return (
    <div className="kw-bubbles">
      {visible.map(h => (
        <div key={h.keyword} className="kw-bubble">
          <button className="kw-close" onClick={() => setDismissed(prev => [...prev, h.keyword])}>&times;</button>
          <div className="kw-text">{h.hint}</div>
        </div>
      ))}
    </div>
  );
}

// ─── SMART TEXTAREA: textarea + keyword hints ───

export function SmartTextarea({ value, onChange, placeholder, rows, field }) {
  return (
    <>
      <textarea value={value} onChange={onChange} placeholder={placeholder} rows={rows} />
      <KeywordBubbles text={value} />
    </>
  );
}
