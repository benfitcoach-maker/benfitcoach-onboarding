// V46 — Tests génétiques nutrigénétiques
// Source: panel MGD (MTHFRgenes, ELIPSEgenes, DIO2genes, FUT2genes, COELIACgenes, etc.)
// Alimente le prompt Anissa avec des recommandations ultra-ciblées selon les variants.

// ─── GENE CATALOG ───
// Chaque gène a : id, label, description courte, options (alleles/phénotypes)
export const GENE_CATALOG = [
  {
    id: 'mthfr_c677t',
    label: 'MTHFR C677T',
    description: 'Méthylation folates → choix formes vitaminiques',
    options: [
      { value: '', label: '— non testé' },
      { value: 'CC', label: 'CC (sauvage, normal)' },
      { value: 'CT', label: 'CT (hétérozygote, ~30% réduit)' },
      { value: 'TT', label: 'TT (homozygote, ~70% réduit)' },
    ],
  },
  {
    id: 'mthfr_a1298c',
    label: 'MTHFR A1298C',
    description: 'Méthylation folates (variant secondaire)',
    options: [
      { value: '', label: '— non testé' },
      { value: 'AA', label: 'AA (sauvage)' },
      { value: 'AC', label: 'AC (hétérozygote)' },
      { value: 'CC', label: 'CC (homozygote, activité réduite)' },
    ],
  },
  {
    id: 'apoe',
    label: 'APOE',
    description: 'Métabolisme lipidique, risque cardiovasculaire, cognition',
    options: [
      { value: '', label: '— non testé' },
      { value: 'E2E2', label: 'E2/E2 (très protecteur, rare)' },
      { value: 'E2E3', label: 'E2/E3 (protecteur)' },
      { value: 'E3E3', label: 'E3/E3 (neutre, majorité)' },
      { value: 'E2E4', label: 'E2/E4 (mixte)' },
      { value: 'E3E4', label: 'E3/E4 (risque modéré)' },
      { value: 'E4E4', label: 'E4/E4 (risque élevé)' },
    ],
  },
  {
    id: 'comt',
    label: 'COMT Val158Met',
    description: 'Dégradation dopamine, caféine, œstrogènes',
    options: [
      { value: '', label: '— non testé' },
      { value: 'ValVal', label: 'Val/Val (rapide — warrior)' },
      { value: 'ValMet', label: 'Val/Met (intermédiaire)' },
      { value: 'MetMet', label: 'Met/Met (lent — worrier)' },
    ],
  },
  {
    id: 'dio2',
    label: 'DIO2',
    description: 'Conversion T4 → T3 (thyroïde active)',
    options: [
      { value: '', label: '— non testé' },
      { value: 'TT', label: 'TT (conversion normale)' },
      { value: 'CT', label: 'CT (légèrement réduite)' },
      { value: 'CC', label: 'CC (réduite — hypothyroïdie tissulaire)' },
    ],
  },
  {
    id: 'fut2',
    label: 'FUT2',
    description: 'Sécrétion antigènes intestinaux, composition microbiote',
    options: [
      { value: '', label: '— non testé' },
      { value: 'secreteur', label: 'Sécréteur (normal)' },
      { value: 'non_secreteur', label: 'Non-sécréteur (~20% pop., microbiote différent)' },
    ],
  },
  {
    id: 'gstm1',
    label: 'GSTM1',
    description: 'Détoxification hépatique phase II',
    options: [
      { value: '', label: '— non testé' },
      { value: 'present', label: 'Présent (détox normale)' },
      { value: 'null', label: 'Null (détox réduite — ~50% pop.)' },
    ],
  },
  {
    id: 'gstt1',
    label: 'GSTT1',
    description: 'Détoxification (glutathion-transférase T1)',
    options: [
      { value: '', label: '— non testé' },
      { value: 'present', label: 'Présent' },
      { value: 'null', label: 'Null (détox réduite)' },
    ],
  },
  {
    id: 'hla_coeliac',
    label: 'HLA-DQ2/DQ8 (cœliaque)',
    description: 'Prédisposition maladie cœliaque',
    options: [
      { value: '', label: '— non testé' },
      { value: 'negatif', label: 'Négatif (très faible risque)' },
      { value: 'DQ2', label: 'DQ2 positif' },
      { value: 'DQ8', label: 'DQ8 positif' },
      { value: 'DQ2_DQ8', label: 'DQ2 + DQ8 positifs' },
    ],
  },
  {
    id: 'dao_haplotype',
    label: 'DAO / HNMT (histamine)',
    description: 'Dégradation histamine (intolérance possible)',
    options: [
      { value: '', label: '— non testé' },
      { value: 'normal', label: 'Activité normale' },
      { value: 'reduit', label: 'Activité réduite (intolérance probable)' },
    ],
  },
];

// ─── ADJUSTMENTS PAR VARIANT ───
// Chaque (geneId, variant) → directive nutritionnelle concrète
const GENETIC_ADJUSTMENTS = {
  // MTHFR — méthylation
  'mthfr_c677t:CT': {
    label: 'MTHFR C677T hétérozygote',
    note: 'Activité enzymatique réduite ~30%. Privilégier folates actifs.',
    recos: [
      'Préférer 5-MTHF (folates méthylés) à l\'acide folique',
      'B12 sous forme méthylcobalamine',
      'Surveiller homocystéine',
    ],
  },
  'mthfr_c677t:TT': {
    label: 'MTHFR C677T homozygote',
    note: 'Activité enzymatique réduite ~70%. Supplémentation obligatoire en formes méthylées.',
    recos: [
      '5-MTHF (folates méthylés) 400-800 µg obligatoire — JAMAIS acide folique',
      'B12 méthylcobalamine 1000 µg/jour',
      'B6 P-5-P 25 mg',
      'Monitorer homocystéine (cible <8 µmol/L)',
      'Bétaïne (TMG) 500 mg si homocystéine persistante',
    ],
  },
  'mthfr_a1298c:CC': {
    label: 'MTHFR A1298C homozygote',
    note: 'Activité réduite, impact sur recyclage BH4 (neurotransmetteurs).',
    recos: [
      '5-MTHF + B12 méthylée',
      'Attention équilibre neurotransmetteurs (B6, magnésium)',
    ],
  },

  // APOE — lipides
  'apoe:E3E4': {
    label: 'APOE E3/E4',
    note: 'Réponse aux graisses saturées accentuée. Risque cardiovasculaire modéré.',
    recos: [
      'Réduire fortement graisses saturées (<7% apports)',
      'Privilégier oméga-3 (poissons gras 3x/sem, huile de colza, noix)',
      'Limiter alcool',
      'Restreindre glucides raffinés (meilleur marqueur lipidique si APOE4)',
    ],
  },
  'apoe:E4E4': {
    label: 'APOE E4/E4',
    note: 'Risque cardiovasculaire et neurodégénératif élevé. Diète très ciblée.',
    recos: [
      'Diète méditerranéenne stricte',
      'Réduction agressive graisses saturées (<7%)',
      'Oméga-3 EPA/DHA 2-3 g/jour impératif',
      'Limiter alcool à usage exceptionnel',
      'Cétose non recommandée (peut aggraver risque cognitif chez E4)',
      'Antioxydants renforcés : polyphénols, curcuma, fruits rouges',
    ],
  },
  'apoe:E2E2': {
    label: 'APOE E2/E2',
    note: 'Protection cardiovasculaire mais vigilance triglycérides.',
    recos: [
      'Surveiller triglycérides (tendance à l\'élévation)',
      'Modérer alcool et sucres rapides',
    ],
  },

  // COMT — dopamine/caféine/œstrogènes
  'comt:ValVal': {
    label: 'COMT Val/Val (warrior — métabolisme rapide)',
    note: 'Dégradation rapide dopamine/œstrogènes. Tolérance caféine élevée.',
    recos: [
      'Soutien dopamine : tyrosine dans protéines animales, œufs',
      'Caféine généralement bien tolérée',
    ],
  },
  'comt:MetMet': {
    label: 'COMT Met/Met (worrier — métabolisme lent)',
    note: 'Accumulation dopamine, sensibilité stress, caféine mal tolérée.',
    recos: [
      'Limiter caféine (max 1 café matin, si toléré)',
      'Magnésium glycinate et B6 actifs comme soutien',
      'Méthylation prudente (MTHFR + COMT Met/Met = prudence sur 5-MTHF fortes doses)',
      'Priorité réduction stress, adaptogènes (ashwagandha si pertinent)',
      'Soutien œstrogènes (phase 2 détox) : brassicacées, DIM, sulforaphane',
    ],
  },

  // DIO2 — conversion thyroïdienne
  'dio2:CC': {
    label: 'DIO2 CC (conversion T4→T3 réduite)',
    note: 'Hypothyroïdie tissulaire possible même avec TSH normale.',
    recos: [
      'Apport Sélénium optimal (2-3 noix du Brésil/jour)',
      'Zinc adequate (viandes, graines de courge)',
      'Fer et ferritine > 80 ng/mL idéal pour la conversion',
      'Réduction stress chronique (cortisol freine conversion)',
      'Iode suffisant mais pas excessif',
      'Si symptômes hypothyroïdiens : discuter T3 avec médecin',
    ],
  },
  'dio2:CT': {
    label: 'DIO2 CT (conversion légèrement réduite)',
    note: 'Vigilance cofacteurs de conversion.',
    recos: [
      'Sélénium (noix du Brésil 1-2/jour)',
      'Zinc + ferritine adéquats',
    ],
  },

  // FUT2 — microbiote
  'fut2:non_secreteur': {
    label: 'FUT2 non-sécréteur',
    note: 'Microbiote différent, bifidobactéries souvent réduites, risque accru de dysbiose.',
    recos: [
      'Probiotiques ciblés bifidobactéries (B. longum, B. infantis)',
      'Prébiotiques HMO (human milk oligosaccharides) si disponibles',
      'Fibres solubles fermentescibles adaptées (inuline, psyllium)',
      'Attention infections digestives (surveillance accrue)',
      'Vitamine B12 : augmenter les apports (absorption possiblement réduite)',
    ],
  },

  // GSTM1/GSTT1 — détox
  'gstm1:null': {
    label: 'GSTM1 null (détox phase II réduite)',
    note: 'Capacité de détoxification des xénobiotiques réduite.',
    recos: [
      'Augmenter brassicacées (brocoli, chou kale, chou-fleur) — sulforaphane stimule GST',
      'Curcuma + piperine',
      'Réduire exposition toxiques (cosmétiques, pesticides, plastiques chauffés)',
      'Soutien glutathion : NAC 600 mg/jour à discuter',
      'Bio pertinent si possible',
    ],
  },
  'gstt1:null': {
    label: 'GSTT1 null',
    note: 'Détox phase II partiellement réduite.',
    recos: [
      'Même approche que GSTM1 null (brassicacées, curcuma, NAC)',
      'Vigilance alcool et tabac',
    ],
  },

  // HLA — cœliaque
  'hla_coeliac:DQ2': {
    label: 'HLA-DQ2 positif',
    note: 'Prédisposition maladie cœliaque. Symptômes à investiguer.',
    recos: [
      'Si symptômes digestifs/inflammatoires : test cœliaque (Ac anti-transglutaminase) avant retrait gluten',
      'Gluten à évaluer cliniquement',
    ],
  },
  'hla_coeliac:DQ8': {
    label: 'HLA-DQ8 positif',
    note: 'Prédisposition cœliaque (risque plus faible que DQ2 isolé).',
    recos: [
      'Même approche DQ2 : investiguer avant retrait gluten',
    ],
  },
  'hla_coeliac:DQ2_DQ8': {
    label: 'HLA-DQ2 + DQ8 positifs',
    note: 'Risque cœliaque plus élevé.',
    recos: [
      'Sérologie cœliaque recommandée (Ac anti-transglutaminase, anti-gliadine désamidée)',
      'Si négative mais symptômes : essai éviction gluten 3 mois',
    ],
  },

  // DAO — histamine
  'dao_haplotype:reduit': {
    label: 'DAO activité réduite',
    note: 'Intolérance histamine probable.',
    recos: [
      'Éviter aliments riches en histamine : fromages affinés, charcuterie, poisson non frais, vin, fermentés',
      'Éviter libérateurs d\'histamine : tomates, fraises, chocolat, agrumes en excès',
      'Cofacteurs DAO : vitamine B6 P-5-P, cuivre, vit C',
      'Quercétine 500 mg midi comme stabilisateur mastocytaire',
    ],
  },
};

// ─── BUILD PROMPT SECTION ───
export function buildGeneticSectionForPrompt(geneticResults) {
  if (!geneticResults || Object.keys(geneticResults).length === 0) return null;

  const active = [];
  for (const [geneId, variant] of Object.entries(geneticResults)) {
    if (!variant) continue;
    const key = `${geneId}:${variant}`;
    const adj = GENETIC_ADJUSTMENTS[key];
    if (adj) {
      active.push(adj);
    } else {
      // Pas d'ajustement spécifique pour ce variant (ex: CC neutre, E3E3, etc.)
      // On note quand même le résultat brut pour contexte
      const gene = GENE_CATALOG.find(g => g.id === geneId);
      if (gene) {
        const opt = gene.options.find(o => o.value === variant);
        if (opt && variant !== '') {
          active.push({
            label: `${gene.label} : ${opt.label}`,
            note: '(résultat neutre ou sans impact nutritionnel significatif)',
            recos: [],
          });
        }
      }
    }
  }

  if (active.length === 0) return null;

  const lines = ['', '--- TESTS GÉNÉTIQUES (NUTRIGÉNÉTIQUE) ---', ''];
  for (const adj of active) {
    lines.push(`• ${adj.label}`);
    if (adj.note) lines.push(`  ${adj.note}`);
    if (adj.recos && adj.recos.length > 0) {
      for (const reco of adj.recos) {
        lines.push(`  → ${reco}`);
      }
    }
    lines.push('');
  }
  lines.push('Intégrer ces recommandations dans le plan en respectant la priorisation clinique globale.');
  return lines.join('\n');
}

// Helper pour UI : retourne les ajustements actifs (pour aperçu live)
export function getActiveGeneticAdjustments(geneticResults) {
  if (!geneticResults) return [];
  const active = [];
  for (const [geneId, variant] of Object.entries(geneticResults)) {
    if (!variant) continue;
    const key = `${geneId}:${variant}`;
    const adj = GENETIC_ADJUSTMENTS[key];
    if (adj) active.push({ geneId, variant, ...adj });
  }
  return active;
}
