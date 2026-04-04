export const CATEGORIES = {
  online: { nom: 'Coaching Online', icon: '🌐', color: '#c4a050', bgColor: 'rgba(196,160,80,.12)' },
  presentiel: { nom: 'Coaching Présentiel', icon: '📍', color: '#2a9d5c', bgColor: 'rgba(42,157,92,.12)' },
  massage: { nom: 'Massothérapie', icon: '🤲', color: '#4a90d9', bgColor: 'rgba(74,144,217,.12)' },
};

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
  age: '',
  genre: '',
  poids: '',
  taille: '',
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
  autonome: { nom: 'Autonome', prix: '150 CHF/mois' },
  suivi: { nom: 'Suivi Complet', prix: '350 CHF/mois' },
  intensif: { nom: 'Intensif', prix: '600 CHF/mois' },
  essentials: { nom: 'Essentials', prix: '99 CHF/mois' },
  premium: { nom: 'Premium', prix: '249 CHF/mois' },
  ultimate: { nom: 'Ultimate', prix: '499 CHF/mois' },
  presentiel: { nom: 'Presentiel', prix: '800 CHF/mois' },
  inperson: { nom: 'In-Person', prix: '900 CHF/mois' },
};

export const FORMULE_OPTIONS = [
  { value: 'essentials', label: 'Essentials - 99 CHF/mois' },
  { value: 'autonome', label: 'Autonome - 150 CHF/mois' },
  { value: 'premium', label: 'Premium - 249 CHF/mois' },
  { value: 'suivi', label: 'Suivi Complet - 350 CHF/mois' },
  { value: 'ultimate', label: 'Ultimate - 499 CHF/mois' },
  { value: 'intensif', label: 'Intensif - 600 CHF/mois' },
  { value: 'presentiel', label: 'Presentiel - 800 CHF/mois' },
  { value: 'inperson', label: 'In-Person - 900 CHF/mois' },
];

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
