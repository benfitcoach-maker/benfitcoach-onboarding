export const CATEGORIES = {
  online: { nom: 'Coaching Online', icon: '🌐', color: '#c4a050', bgColor: 'rgba(196,160,80,.12)' },
  presentiel: { nom: 'Coaching Présentiel', icon: '📍', color: '#2a9d5c', bgColor: 'rgba(42,157,92,.12)' },
  massage: { nom: 'Massothérapie', icon: '🤲', color: '#4a90d9', bgColor: 'rgba(74,144,217,.12)' },
  nutrition: { nom: 'Nutrition', icon: '🥗', color: '#7c5cbf', bgColor: 'rgba(124,92,191,.12)' },
};

export const NUTRITION_INITIAL_FORM = {
  // Etape 1 - Identite
  prenom: '',
  nom: '',
  age: '',
  genre: '',
  profession: '',
  poids: '',
  taille: '',
  tourTaille: '',
  tourHanche: '',
  tourPoitrine: '',
  tourBras: '',
  tourCuisse: '',
  masseGrasse: '',
  masseMusculaire: '',
  telephone: '',
  email: '',
  // Etape 2 - Antecedents medicaux
  antecedentsFamiliaux: '',
  pathologies: '',
  traitements: '',
  operations: '',
  allergies: '',
  // Etape 3 - Alimentation
  nbRepas: '',
  alimentsEvites: '',
  hydratation: '',
  mastication: '',
  regimesSuivis: '',
  // Etape 4 - Sante
  blessures: '',
  douleursActuelles: '',
  contraception: '',
  cycleDuree: '',
  spm: '',
  douleursMenstruelles: '',
  projetGrossesse: '',
  // Etape 5 - Sport & Performance
  typeSport: '',
  frequenceSport: '',
  objectifSport: '',
  recuperation: '',
  supplements: '',
  digestifEffort: '',
  // Etape 6 - Metabolisme & Energie
  energieJournee: '',
  fringalesSucre: '',
  variationsGlycemie: '',
  reactionGlucides: '',
  // Etape 7 - Digestion & Microbiote
  frequenceBallonnements: '',
  transitType: '',
  alimentsProblematiques: '',
  consommationReguliere: [],
  // Etape 8 - Inflammation & Immunite
  douleursInflammations: '',
  frequenceMaladies: '',
  troublesPeau: '',
  // Etape 9 - Stress & Systeme nerveux
  niveauStressActuel: '5',
  difficultesEndormissement: '',
  reveilsNocturnes: '',
  etatReveil: '',
  // Etape 10 - Mode de vie & Biohacking
  tempsExterieur: '',
  heuresSommeil: '',
  expositionEcransSoir: '',
  professionType: '',
  alcool: '',
  tabac: '',
  // Etape 11 - Genetique & Donnees
  analysesBiologiques: '',
  testADN: '',
  testsGenetiques: '',
  pretAnalysesAvancees: '',
  // Etape 12 - Objectifs & Engagement
  objectifPrincipalNutrition: '',
  dureeProbleme: '',
  dejaEssaye: '',
  pretProtocole: '',
  // Etape 13 - Notes nutritionniste
  observationsGenerales: '',
  planAction: '',
  examensPrevoir: '',
};

export const SYMPTOMES_OBJECTIFS_OPTIONS = [
  'Fertilite', 'Digestif', 'Sport', 'Fatigue', 'Poids', 'Hormonaux', 'Immunite', 'Autre',
];

export const STEPS = [
  { id: 1, label: 'Identite', title: 'Identite du client' },
  { id: 2, label: 'Objectifs', title: 'Objectifs' },
  { id: 3, label: 'Sport', title: 'Activite sportive' },
  { id: 4, label: 'Sante', title: 'Sante' },
  { id: 5, label: 'Nutrition', title: 'Nutrition' },
  { id: 6, label: 'Lifestyle', title: 'Mode de vie' },
  { id: 7, label: 'Contexte', title: 'Contexte coaching' },
  { id: 8, label: 'Mes notes', title: 'Notes du coach' },
];

export const PRESENTIEL_STEPS = [
  { id: 1, label: 'Identite', title: 'Identite du client' },
  { id: 2, label: 'Objectifs', title: 'Objectifs' },
  { id: 3, label: 'Sport', title: 'Activite sportive' },
  { id: 4, label: 'Sante', title: 'Sante' },
  { id: 5, label: 'Nutrition', title: 'Nutrition' },
  { id: 6, label: 'Lifestyle', title: 'Mode de vie' },
  { id: 7, label: 'Mes notes', title: 'Notes du coach' },
];

export const MASSAGE_STEPS = [
  { id: 1, label: 'Identite', title: 'Identite' },
  { id: 2, label: 'Douleurs', title: 'Motif et douleurs' },
  { id: 3, label: 'Sante', title: 'Sante' },
  { id: 4, label: 'Preferences', title: 'Preferences' },
  { id: 5, label: 'Notes', title: 'Notes du therapeute' },
];

export const INITIAL_FORM = {
  prenom: '',
  langue: 'FR',
  formule: 'suivi',
  customRate: '',
  age: '',
  genre: '',
  poids: '',
  taille: '',
  tourTaille: '',
  tourHanche: '',
  tourCou: '',
  tourPoitrine: '',
  tourBrasDroit: '',
  tourBrasGauche: '',
  tourCuisseDroite: '',
  tourCuisseGauche: '',
  tourMollet: '',
  objectifPrincipal: '',
  objectifSecondaire: '',
  deadline: '',
  motivationProfonde: '',
  niveau: '',
  frequence: '',
  duree: '',
  lieu: '',
  equipement: '',
  historique: '',
  exercicesAimes: '',
  exercicesEvites: '',
  blessures: '',
  problemesSante: '',
  medicaments: '',
  objectifNutrition: '',
  allergies: '',
  preferencesAlimentaires: '',
  frequenceRestaurant: '',
  niveauCuisine: '',
  sommeil: '',
  stress: '',
  travail: '',
  alcool: '',
  hydratation: '',
  dejaCoach: '',
  appsFitness: '',
  pasMarche: '',
  attentes: '',
  notesCoach: '',
};

export const PRESENTIEL_INITIAL_FORM = {
  prenom: '',
  langue: 'FR',
  pack: 'pack10',
  age: '',
  genre: '',
  poids: '',
  taille: '',
  tourTaille: '',
  tourHanche: '',
  tourCou: '',
  tourPoitrine: '',
  tourBrasDroit: '',
  tourBrasGauche: '',
  tourCuisseDroite: '',
  tourCuisseGauche: '',
  tourMollet: '',
  objectifPrincipal: '',
  objectifSecondaire: '',
  deadline: '',
  motivationProfonde: '',
  niveau: '',
  frequence: '',
  duree: '',
  lieu: '',
  equipement: '',
  historique: '',
  exercicesAimes: '',
  exercicesEvites: '',
  blessures: '',
  problemesSante: '',
  medicaments: '',
  objectifNutrition: '',
  allergies: '',
  preferencesAlimentaires: '',
  frequenceRestaurant: '',
  niveauCuisine: '',
  sommeil: '',
  stress: '',
  travail: '',
  alcool: '',
  hydratation: '',
  notesCoach: '',
};

export const MASSAGE_INITIAL_FORM = {
  prenom: '',
  nom: '',
  age: '',
  genre: '',
  telephone: '',
  customRate: '120',
  email: '',
  motifConsultation: '',
  zonesDouloureuses: [],
  typeDouleur: '',
  intensiteDouleur: '',
  dureeDouleur: '',
  traitementsEnCours: '',
  medicaments: '',
  operationsRecentes: '',
  contreIndications: [],
  allergiesMassage: '',
  pressionPreferee: '',
  zonesAEviter: '',
  dejaMassage: '',
  frequenceSouhaitee: '',
  objectifMassage: [],
  notesCoach: '',
};

export const PRESENTIEL_PACKS = {
  pack10: { nom: 'Pack 10 séances', prix: '750 CHF' },
  pack20: { nom: 'Pack 20 séances', prix: '1400 CHF' },
  pack30: { nom: 'Pack 30 séances', prix: '1950 CHF' },
};

export const FORMULES = {
  autonome: { nom: 'Autonome', prix: '150 CHF/mois', montant: 150 },
  suivi: { nom: 'Suivi Complet', prix: '350 CHF/mois', montant: 350 },
  intensif: { nom: 'Intensif', prix: '600 CHF/mois', montant: 600 },
  pack10: { nom: 'Pack 10 Seances', prix: "1'200 CHF", montant: 1200 },
  pack20: { nom: 'Pack 20 Seances', prix: "2'200 CHF", montant: 2200 },
  pack30: { nom: 'Pack 30 Seances', prix: "3'000 CHF", montant: 3000 },
  massage: { nom: 'Massotherapie', prix: '120 CHF/h', montant: 120 },
  custom: { nom: 'Tarif personnalise', prix: 'Personnalise', montant: 0 },
};

export const FORMULE_OPTIONS_FR = [
  { value: 'autonome', label: 'Autonome - 150 CHF/mois' },
  { value: 'suivi', label: 'Suivi Complet - 350 CHF/mois' },
  { value: 'intensif', label: 'Intensif - 600 CHF/mois (3 mois)' },
  { value: 'pack10', label: "Pack 10 Seances - 1'200 CHF" },
  { value: 'pack20', label: "Pack 20 Seances - 2'200 CHF" },
  { value: 'pack30', label: "Pack 30 Seances - 3'000 CHF" },
  { value: 'massage', label: 'Massotherapie - 120 CHF/h' },
  { value: 'custom', label: 'Tarif personnalise' },
];

export const FORMULE_OPTIONS_EN = [
  { value: 'autonome', label: 'Autonome - 150 CHF/month' },
  { value: 'suivi', label: 'Full Support - 350 CHF/month' },
  { value: 'intensif', label: 'Intensive - 600 CHF/month (3 months)' },
  { value: 'pack10', label: "Pack 10 Sessions - 1'200 CHF" },
  { value: 'pack20', label: "Pack 20 Sessions - 2'200 CHF" },
  { value: 'pack30', label: "Pack 30 Sessions - 3'000 CHF" },
  { value: 'massage', label: 'Massage Therapy - 120 CHF/h' },
  { value: 'custom', label: 'Custom Rate' },
];

export function getFormuleOptions(langue) {
  return langue === 'EN' ? FORMULE_OPTIONS_EN : FORMULE_OPTIONS_FR;
}

export const ZONES_DOULOUREUSES_OPTIONS = [
  'Cou', 'Epaules', 'Dos haut', 'Dos bas', 'Lombaires',
  'Hanches', 'Jambes', 'Bras', 'Tete', 'Autre',
];

export const CONTRE_INDICATIONS_OPTIONS = [
  'Phlebite', 'Inflammation aigue', 'Fievre', 'Blessure recente',
  'Grossesse', 'Problemes de peau', 'Cancer',
];

export const OBJECTIF_MASSAGE_OPTIONS = [
  'Detente', 'Recuperation sportive', 'Soulagement douleur', 'Mobilite',
];
