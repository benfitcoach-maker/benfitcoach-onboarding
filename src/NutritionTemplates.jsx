import { useState } from 'react';

const TEMPLATES = [
  {
    id: 'perte-poids',
    name: 'Perte de poids — Anti-inflammatoire',
    icon: '🔥',
    color: '#e8a040',
    plan: `1. PRINCIPES
- Deficit calorique modere de 300-400 kcal/jour
- Alimentation anti-inflammatoire : elimination sucres raffines, huiles vegetales industrielles, aliments ultra-transformes
- Ratio macros : 30% proteines, 35% lipides sains, 35% glucides complexes
- Privilegier les aliments a index glycemique bas

2. PLAN ALIMENTAIRE TYPE
Petit-dejeuner : Smoothie vert (epinards, avocat, myrtilles, graines de chia, lait d'amande) OU oeufs brouilles + legumes + pain au levain complet
Dejeuner : Salade composee avec proteine (poulet/poisson/tofu), quinoa, legumes colores, huile d'olive + vinaigre de cidre
Collation : Poignee de noix + 1 fruit de saison
Diner : Proteine maigre + legumes vapeur + patate douce OU riz basmati complet

3. ALIMENTS ANTI-INFLAMMATOIRES A PRIVILEGIER
- Curcuma + poivre noir, gingembre, cannelle
- Baies (myrtilles, framboises), cerises
- Poissons gras (saumon, sardines, maquereau) 3x/semaine
- Legumes cruciferes (brocoli, chou-fleur, chou kale)
- Huile d'olive extra vierge, avocats
- The vert, tisanes (romarin, ortie)

4. A LIMITER / EVITER
- Sucres raffines, sirop de glucose-fructose
- Pain blanc, pates blanches, riz blanc
- Alcool (max 1 verre/semaine)
- Produits laitiers conventionnels (preferer chevre/brebis)
- Charcuteries, viandes transformees`,
    supplements: `- Omega-3 EPA/DHA : 2000mg/jour (anti-inflammatoire)
- Curcumine liposomale : 500mg/jour
- Probiotiques multi-souches : 10 milliards UFC/jour
- Magnesium bisglycinate : 300mg le soir
- Vitamine D3 + K2 : 2000 UI/jour (si carence verifiee)`,
  },
  {
    id: 'prise-masse',
    name: 'Prise de masse — Sportif',
    icon: '💪',
    color: '#4a90d9',
    plan: `1. PRINCIPES
- Surplus calorique controle de 200-400 kcal/jour
- Proteines elevees : 1.8-2.2g/kg de poids corporel
- Ratio macros : 30% proteines, 25% lipides, 45% glucides
- Timing nutriments : glucides concentres autour des entrainements

2. PLAN ALIMENTAIRE TYPE
Petit-dejeuner : Porridge d'avoine + whey + banane + beurre d'amande + graines de courge
Pre-entrainement (-2h) : Riz basmati + poulet + legumes + huile d'olive
Post-entrainement (+30min) : Shake proteines (whey/vegetal) + banane + miel
Dejeuner : Pates completes ou riz + proteine (boeuf/poulet/poisson) + legumes + avocat
Collation : Yaourt grec + granola maison + fruits rouges
Diner : Proteine + patate douce ou quinoa + legumes + huile de coco

3. FOCUS PERFORMANCE
- Creatine monohydrate : 5g/jour tous les jours
- Glucides rapides post-workout : miel, banane, riz blanc
- Repas riche en proteines toutes les 3-4h
- Hydratation : min 40ml/kg de poids + 500ml par heure d'entrainement

4. JOURS DE REPOS
- Reduire glucides de 20-30%
- Maintenir proteines et lipides
- Focus aliments anti-inflammatoires pour la recuperation
- Sommeil 8h minimum`,
    supplements: `- Whey proteine isolat : 30g post-entrainement
- Creatine monohydrate : 5g/jour
- BCAA 2:1:1 : 10g intra-entrainement (si entrainement > 1h)
- Magnesium bisglycinate : 400mg le soir
- Zinc picolinate : 25mg/jour
- Vitamine D3 : 3000 UI/jour en hiver
- Omega-3 : 2000mg EPA/DHA/jour`,
  },
  {
    id: 'microbiote',
    name: 'Sante intestinale — Microbiote',
    icon: '🦠',
    color: '#2a9d5c',
    plan: `1. PRINCIPES
- Restauration de la barriere intestinale
- Reduction des aliments irritants : lectines, gluten, produits laitiers A1
- Augmentation des polyphenols et fibres prebiotiques
- Rotation alimentaire pour reduire les intolerances

2. PLAN ALIMENTAIRE TYPE
Petit-dejeuner : Bouillon d'os + legumes cuits + oeuf poché OU smoothie (kefir de coco, banane verte, epinards, collagene)
Dejeuner : Poisson sauvage + legumes cuits vapeur + riz basmati + sauce tahini
Collation : Compote de pommes maison + cannelle OU legumes crus + houmous
Diner : Soupe de legumes maison + proteine + patate douce

3. ALIMENTS POUR LE MICROBIOTE
- Prebiotiques : asperges, artichaut, poireau, oignon, ail, banane verte
- Probiotiques naturels : choucroute crue, kefir, kimchi, kombucha
- Polyphenols : myrtilles, grenade, cacao cru, the vert
- Fibres solubles : psyllium, graines de lin, avoine
- Bouillon d'os : collagene et L-glutamine naturels
- Aliments riches en butyrate : beurre ghee, fromage fermente

4. A EVITER
- Gluten (ble, seigle, orge) — test elimination 3 semaines
- Lectines concentrees : tomates crues, poivrons, aubergines, haricots mal cuits
- Edulcorants artificiels (perturbent le microbiome)
- Alcool, cafe en exces (max 1/jour)
- Antibiotiques inutiles, AINS au long cours`,
    supplements: `- L-Glutamine : 5g/jour a jeun (reparation muqueuse)
- Probiotiques specifiques : Lactobacillus rhamnosus + Saccharomyces boulardii
- Enzymes digestives : 1 capsule avant chaque repas
- Zinc carnosine : 75mg 2x/jour (protection muqueuse)
- Collagene hydrolyse : 10g/jour
- Curcumine : 500mg/jour (anti-inflammatoire intestinal)
- Omega-3 : 1500mg/jour`,
  },
  {
    id: 'hormonal',
    name: 'Equilibre hormonal — Femme',
    icon: '🌸',
    color: '#d97ab5',
    plan: `1. PRINCIPES
- Soutien des phases du cycle menstruel par l'alimentation
- Gestion du cortisol et de l'axe HPA
- Optimisation de la detoxification des estrogenes
- Glycemie stable pour equilibre hormonal

2. PLAN PAR PHASE DU CYCLE
Phase folliculaire (J1-14) : Aliments riches en fer (lentilles, viande rouge), legumes cruciferes pour detox estrogenes, graines de lin
Phase ovulatoire (J12-16) : Fibres ++, legumes verts, aliments riches en glutathion
Phase luteale (J15-28) : Augmenter calories de 100-200 kcal, magnésium ++, aliments riches en B6, patate douce

3. ALIMENTS CLES
- Phytoestrogenes : graines de lin moulues (1-2 c.a.s/jour), graines de sesame
- Cruciferes : brocoli, chou kale, chou-fleur (DIM naturel)
- Zinc : graines de courge, huitres, viande rouge
- Magnesium : cacao cru, amandes, epinards
- Vitamine B6 : poulet, banane, pistaches
- Omega-3 : poissons gras, graines de chia

4. GESTION DU CORTISOL
- Petit-dejeuner proteique dans l'heure qui suit le lever
- Eviter le cafe a jeun — le prendre apres le petit-dejeuner
- Collation proteique a 16h pour eviter le pic de cortisol
- Diner leger 3h avant le coucher
- Tisanes : melisse, passiflore, ashwagandha`,
    supplements: `- Magnesium bisglycinate : 300-400mg/jour (soir)
- Vitex (gattilier) : 400mg/jour en phase luteale (si SPM)
- DIM (diindolylmethane) : 100-200mg/jour (detox estrogenes)
- Vitamine B6 P5P : 50mg/jour
- Zinc picolinate : 15-25mg/jour
- Omega-3 EPA : 1500mg/jour
- Fer bisglycinate : si carence verifiee (avec vitamine C)
- Ashwagandha KSM-66 : 300mg 2x/jour (cortisol)`,
  },
  {
    id: 'detox',
    name: 'Detox & Energie',
    icon: '⚡',
    color: '#7c5cbf',
    plan: `1. PRINCIPES
- Soutien des phases I et II de detoxification hepatique
- Reduction de la charge toxique alimentaire et environnementale
- Optimisation de l'energie cellulaire (mitochondries)
- Hydratation et drainage lymphatique

2. PLAN ALIMENTAIRE TYPE
Au reveil : Eau tiede + jus de citron + 1 pincee de sel de l'Himalaya
Petit-dejeuner : Smoothie detox (epinards, coriandre, pomme verte, gingembre, chlorelle) + oeufs
Dejeuner : Grande salade avec cruciferes, betteraves, roquette + proteine bio + vinaigrette citron-olive
Collation : Jus de celeri frais OU the vert matcha
Diner : Soupe detox (artichaut, poireau, curcuma) + poisson vapeur + riz complet

3. ALIMENTS DETOX
- Phase I hepatique : cruciferes, ail, agrumes, curcuma
- Phase II hepatique : soufre (oignon, ail, oeufs), glycine (bouillon d'os), taurine
- Antioxydants : baies, grenade, cacao cru, the vert
- Chelateurs naturels : coriandre, chlorelle, spiruline
- Drainage : artichaut, radis noir, pissenlit

4. REDUCTION CHARGE TOXIQUE
- Alimentation 100% biologique pendant la cure
- Filtrer l'eau de boisson
- Eviter plastiques (contenants en verre/inox)
- Privilegier cosmetiques naturels
- Sudation : sauna, sport, bain chaud`,
    supplements: `- NAC (N-acetyl cysteine) : 600mg 2x/jour (glutathion)
- Chardon-marie (silymarine) : 300mg/jour
- Chlorelle : 3g/jour (chelation)
- Vitamine C liposomale : 1000mg/jour
- CoQ10 ubiquinol : 100mg/jour (energie mitochondriale)
- Alpha-lipoique : 300mg/jour (antioxydant universel)
- Magnesium : 300mg/jour`,
  },
  {
    id: 'anti-age',
    name: 'Anti-age & Peau',
    icon: '✨',
    color: '#c4a050',
    plan: `1. PRINCIPES
- Nutrition anti-oxydante pour proteger contre le stress oxydatif
- Soutien de la production naturelle de collagene
- Protection contre la glycation (vieillissement lie au sucre)
- Omega-3 pour la souplesse cutanee et l'hydratation

2. PLAN ALIMENTAIRE TYPE
Petit-dejeuner : Pudding de chia (lait de coco, myrtilles, noix, cacao cru) + collagene
Dejeuner : Saumon sauvage + salade coloree (betteraves, carottes, avocat) + huile d'olive + graines de grenade
Collation : The vert matcha + poignee d'amandes + baies de goji
Diner : Bouillon d'os + legumes vapeur colores + oeuf mollet + patate douce

3. ALIMENTS ANTI-AGE
- Vitamine C : poivrons, kiwi, agrumes, acerola (synthese collagene)
- Vitamine E : amandes, noisettes, huile de germe de ble
- Beta-carotene : patate douce, carottes, courge, abricots
- Astaxanthine : saumon sauvage, crevettes
- Polyphenols : raisin, myrtilles, cacao, the vert
- Silicium : ortie, prele, avoine, concombre
- Soufre : oignon, ail, oeufs, cruciferes (formation keratine)

4. A EVITER
- Sucres raffines (accelerent la glycation et le vieillissement)
- Fritures et huiles chauffees (radicaux libres)
- Alcool en exces (deshydratation, stress oxidatif)
- Exposition solaire sans protection
- Tabac (detruit la vitamine C et le collagene)`,
    supplements: `- Collagene marin hydrolyse : 10g/jour
- Vitamine C liposomale : 1000mg/jour
- Astaxanthine : 8-12mg/jour (photoprotection)
- Acide hyaluronique : 200mg/jour
- Omega-3 EPA/DHA : 2000mg/jour
- CoQ10 ubiquinol : 100mg/jour
- Zinc : 15mg/jour
- Silicium organique : selon produit`,
  },
];

export default function NutritionTemplates({ onSelect, onClose }) {
  return (
    <div className="templates-overlay">
      <div className="templates-modal">
        <div className="templates-modal-header">
          <h2>Templates nutrition</h2>
          <button className="btn btn-sm btn-secondary" onClick={onClose}>Fermer</button>
        </div>
        <p className="templates-modal-subtitle">Selectionnez un template pour pre-remplir le plan nutrition. Vous pourrez le modifier ensuite.</p>
        <div className="templates-grid">
          {TEMPLATES.map(t => (
            <button
              key={t.id}
              className="template-card-btn"
              onClick={() => onSelect(t.plan, t.supplements)}
              style={{ borderColor: t.color + '33' }}
            >
              <span className="template-card-icon">{t.icon}</span>
              <span className="template-card-name" style={{ color: t.color }}>{t.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export { TEMPLATES };
