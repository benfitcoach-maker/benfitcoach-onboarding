// ──────────────────────────────────────────────────────────────
// Benfitcoach - i18n for the Benoit-side client form (Online / Presentiel)
// Anissa's nutrition interface stays in French — not translated here.
//
// Stored form values remain canonical French (e.g. genre = "Homme") so
// existing data keeps working when switching language. Only the DISPLAY
// labels and option texts are translated.
// ──────────────────────────────────────────────────────────────

export const T = {
  FR: {
    // ── Step titles (shown as <h2> in StepForm) ──
    'title.identite': 'Identite du client',
    'title.objectifs': 'Objectifs',
    'title.sport': 'Activite sportive',
    'title.sante': 'Sante',
    'title.nutrition': 'Nutrition',
    'title.lifestyle': 'Mode de vie',
    'title.contexte': 'Contexte coaching',
    'title.mesNotes': 'Notes du coach',

    // ── Step navigator short labels ──
    'steplabel.identite': 'Identite',
    'steplabel.objectifs': 'Objectifs',
    'steplabel.sport': 'Sport',
    'steplabel.sante': 'Sante',
    'steplabel.nutrition': 'Nutrition',
    'steplabel.lifestyle': 'Lifestyle',
    'steplabel.contexte': 'Contexte',
    'steplabel.mesNotes': 'Mes notes',

    // ── Step 1 — Identity ──
    'field.prenom': 'Prenom',
    'field.langue': 'Langue',
    'field.formule': 'Formule',
    'field.pack': 'Pack',
    'field.customRate': 'Tarif reel (CHF)',
    'field.age': 'Age',
    'field.genre': 'Genre',
    'field.poids': 'Poids (kg)',
    'field.taille': 'Taille (cm)',
    'field.tourTaille': 'Tour de taille (cm)',
    'field.tourHanche': 'Tour de hanche (cm)',
    'field.tourCou': 'Tour de cou (cm)',
    'field.tourPoitrine': 'Tour de poitrine (cm)',
    'field.tourBrasDroit': 'Tour de bras droit (cm)',
    'field.tourBrasGauche': 'Tour de bras gauche (cm)',
    'field.tourCuisseDroite': 'Tour de cuisse droite (cm)',
    'field.tourCuisseGauche': 'Tour de cuisse gauche (cm)',
    'field.tourMollet': 'Tour de mollet (cm)',

    'select.placeholder': 'Selectionner...',
    'lang.fr': 'Francais',
    'lang.en': 'English',
    'genre.homme': 'Homme',
    'genre.femme': 'Femme',
    'genre.autre': 'Autre',

    'pack.pack10': "Pack 10 seances - 1'200 CHF",
    'pack.pack20': "Pack 20 seances - 2'200 CHF",
    'pack.pack30': "Pack 30 seances - 3'000 CHF",
    'pack.custom': 'Pack sur mesure',
    'field.packCustomSessions': 'Nombre de seances',
    'field.packCustomPrice': 'Prix du pack (CHF)',

    // ── Step 2 — Goals ──
    'field.objectifPrincipal': 'Objectif principal',
    'field.objectifSecondaire': 'Objectif secondaire',
    'field.deadline': 'Deadline / Echeance',
    'field.motivationProfonde': 'Motivation profonde (le vrai pourquoi)',

    // ── Step 3 — Sport ──
    'field.niveau': 'Niveau sportif',
    'niveau.debutant': 'Debutant',
    'niveau.intermediaire': 'Intermediaire',
    'niveau.avance': 'Avance',
    'niveau.athlete': 'Athlete',
    'field.frequence': 'Frequence souhaitee (seances/sem)',
    'field.duree': 'Duree par seance',
    'field.lieu': "Lieu d'entrainement",
    'lieu.salle': 'Salle de sport',
    'lieu.domicile': 'Domicile',
    'lieu.exterieur': 'Exterieur',
    'lieu.mixte': 'Mixte',
    'field.equipement': 'Equipement disponible',
    'field.historique': 'Historique sportif',
    'field.exercicesAimes': 'Exercices aimes',
    'field.exercicesEvites': 'Exercices evites / detestes',

    // ── Step 4 — Health ──
    'field.blessures': 'Blessures / Limitations physiques',
    'field.problemesSante': 'Problemes de sante',
    'field.medicaments': 'Medicaments / Supplements',

    // ── Step 5 — Nutrition ──
    'field.objectifNutrition': 'Objectif nutritionnel',
    'nutri.perte': 'Perte de poids',
    'nutri.prise': 'Prise de masse',
    'nutri.recomp': 'Recomposition corporelle',
    'nutri.maintien': 'Maintien',
    'nutri.perf': 'Performance sportive',
    'nutri.sante': 'Sante generale',
    'field.niveauCuisine': 'Niveau en cuisine',
    'cuisine.debutant': 'Debutant',
    'cuisine.basique': 'Basique',
    'cuisine.intermediaire': 'Intermediaire',
    'cuisine.bon': 'Bon cuisinier',
    'field.allergies': 'Allergies / Intolerances',
    'field.preferencesAlimentaires': 'Preferences alimentaires (vegan, halal, etc.)',
    'field.frequenceRestaurant': 'Frequence restaurant / takeaway',
    'resto.rarement': 'Rarement',
    'resto.1-2': '1-2x par semaine',
    'resto.3-4': '3-4x par semaine',
    'resto.quotidien': 'Quasi quotidien',

    // ── Step 6 — Lifestyle ──
    'field.sommeil': 'Sommeil (heures/nuit, qualite)',
    'field.stress': 'Niveau de stress (1-10)',
    'field.travail': 'Type de travail',
    'travail.sedentaire': 'Sedentaire (bureau)',
    'travail.mixte': 'Mixte',
    'travail.actif': 'Actif / debout',
    'travail.physique': 'Physique / manuel',
    'field.alcool': "Consommation d'alcool",
    'alcool.jamais': 'Jamais',
    'alcool.occasionnel': 'Occasionnel (1-2x/mois)',
    'alcool.regulier': 'Regulier (1-2x/sem)',
    'alcool.frequent': 'Frequent (3x+/sem)',
    'field.hydratation': 'Hydratation quotidienne',
    'hydra.lt1': 'Moins de 1L',
    'hydra.1-1.5': '1 - 1.5L',
    'hydra.1.5-2': '1.5 - 2L',
    'hydra.2-3': '2 - 3L',
    'hydra.gt3': 'Plus de 3L',

    // ── Step 7 — Coaching context (online) ──
    'field.dejaCoach': 'Deja eu un coach sportif ?',
    'coach.non': 'Non, jamais',
    'coach.salle': 'Oui, en salle',
    'coach.online': 'Oui, en ligne',
    'coach.deux': 'Oui, les deux',
    'field.appsFitness': 'Apps fitness utilisees',
    'field.pasMarche': "Ce qui n'a pas marche avant",
    'field.attentes': 'Attentes envers Benfitcoach',

    // ── Step 8 — Notes ──
    'field.notesCoach': 'Notes personnelles du coach Benoit',

    // ── Buttons ──
    'btn.prev': 'Precedent',
    'btn.next': 'Suivant',
    'btn.save': 'Sauvegarder',
    'btn.generate': "Generer le dossier d'onboarding",
    'btn.regenerate': 'Regenerer le dossier complet',
    'btn.generating': 'Generation en cours...',

    // ── Metrics panel ──
    'metrics.title': 'Analyse corporelle',
    'metrics.evolution': 'Evolution',
    'metrics.bmi': 'IMC',
    'metrics.bodyFat': 'Masse grasse',
    'metrics.leanMass': 'Masse maigre',
    'metrics.bmr': 'Metabolisme de base',
    'metrics.bmrFormula': 'Katch-McArdle',
    'metrics.genderRequired': 'Genre requis',
    'metrics.missing': 'Manque',
    'metrics.hint': 'Renseignez tour de taille et tour de cou pour le calcul',
    'metrics.col.measurement': 'Mesure',
    'metrics.col.previous': 'Precedent',
    'metrics.col.today': "Aujourd'hui",
    'metrics.col.change': 'Evolution',
    'metrics.label.weight': 'Poids',
    'metrics.label.waist': 'Tour de taille',
    'metrics.label.hip': 'Tour de hanche',
    'metrics.label.neck': 'Tour de cou',
    'metrics.label.chest': 'Tour de poitrine',
    'metrics.label.rightArm': 'Tour de bras droit',
    'metrics.label.leftArm': 'Tour de bras gauche',
    'metrics.label.rightThigh': 'Tour de cuisse droite',
    'metrics.label.leftThigh': 'Tour de cuisse gauche',
    'metrics.label.calf': 'Tour de mollet',
    'metrics.label.bmiShort': 'IMC',
    'metrics.label.bfShort': 'Masse grasse',
    'metrics.label.leanShort': 'Masse maigre',
    'metrics.label.bmrShort': 'Metabolisme',

    // BMI interpretations
    'bmi.underweight': 'Sous-poids',
    'bmi.normal': 'Normal',
    'bmi.overweight': 'Surpoids',
    'bmi.obesity': 'Obesite',

    // Body fat interpretations
    'bf.athletic': 'Athletique',
    'bf.fitness': 'Fitness',
    'bf.average': 'Moyen',
    'bf.high': 'Eleve',

    // Optional measurements panel
    'optional.title': 'Mesures complementaires',
  },

  EN: {
    // ── Step titles ──
    'title.identite': 'Client identity',
    'title.objectifs': 'Goals',
    'title.sport': 'Sports activity',
    'title.sante': 'Health',
    'title.nutrition': 'Nutrition',
    'title.lifestyle': 'Lifestyle',
    'title.contexte': 'Coaching context',
    'title.mesNotes': 'Coach notes',

    // ── Step navigator short labels ──
    'steplabel.identite': 'Identity',
    'steplabel.objectifs': 'Goals',
    'steplabel.sport': 'Sport',
    'steplabel.sante': 'Health',
    'steplabel.nutrition': 'Nutrition',
    'steplabel.lifestyle': 'Lifestyle',
    'steplabel.contexte': 'Context',
    'steplabel.mesNotes': 'My notes',

    // ── Step 1 — Identity ──
    'field.prenom': 'First name',
    'field.langue': 'Language',
    'field.formule': 'Plan',
    'field.pack': 'Pack',
    'field.customRate': 'Actual rate (CHF)',
    'field.age': 'Age',
    'field.genre': 'Gender',
    'field.poids': 'Weight (kg)',
    'field.taille': 'Height (cm)',
    'field.tourTaille': 'Waist (cm)',
    'field.tourHanche': 'Hip (cm)',
    'field.tourCou': 'Neck (cm)',
    'field.tourPoitrine': 'Chest (cm)',
    'field.tourBrasDroit': 'Right arm (cm)',
    'field.tourBrasGauche': 'Left arm (cm)',
    'field.tourCuisseDroite': 'Right thigh (cm)',
    'field.tourCuisseGauche': 'Left thigh (cm)',
    'field.tourMollet': 'Calf (cm)',

    'select.placeholder': 'Select...',
    'lang.fr': 'French',
    'lang.en': 'English',
    'genre.homme': 'Male',
    'genre.femme': 'Female',
    'genre.autre': 'Other',

    'pack.pack10': "10-session pack - 1'200 CHF",
    'pack.pack20': "20-session pack - 2'200 CHF",
    'pack.pack30': "30-session pack - 3'000 CHF",
    'pack.custom': 'Custom pack',
    'field.packCustomSessions': 'Number of sessions',
    'field.packCustomPrice': 'Pack price (CHF)',

    // ── Step 2 — Goals ──
    'field.objectifPrincipal': 'Main goal',
    'field.objectifSecondaire': 'Secondary goal',
    'field.deadline': 'Deadline',
    'field.motivationProfonde': 'Deep motivation (the real why)',

    // ── Step 3 — Sport ──
    'field.niveau': 'Fitness level',
    'niveau.debutant': 'Beginner',
    'niveau.intermediaire': 'Intermediate',
    'niveau.avance': 'Advanced',
    'niveau.athlete': 'Athlete',
    'field.frequence': 'Desired frequency (sessions/wk)',
    'field.duree': 'Session duration',
    'field.lieu': 'Training location',
    'lieu.salle': 'Gym',
    'lieu.domicile': 'Home',
    'lieu.exterieur': 'Outdoor',
    'lieu.mixte': 'Mixed',
    'field.equipement': 'Available equipment',
    'field.historique': 'Sports history',
    'field.exercicesAimes': 'Favorite exercises',
    'field.exercicesEvites': 'Exercises to avoid / dislike',

    // ── Step 4 — Health ──
    'field.blessures': 'Injuries / Physical limitations',
    'field.problemesSante': 'Health issues',
    'field.medicaments': 'Medications / Supplements',

    // ── Step 5 — Nutrition ──
    'field.objectifNutrition': 'Nutrition goal',
    'nutri.perte': 'Weight loss',
    'nutri.prise': 'Muscle gain',
    'nutri.recomp': 'Body recomposition',
    'nutri.maintien': 'Maintenance',
    'nutri.perf': 'Sports performance',
    'nutri.sante': 'General health',
    'field.niveauCuisine': 'Cooking skills',
    'cuisine.debutant': 'Beginner',
    'cuisine.basique': 'Basic',
    'cuisine.intermediaire': 'Intermediate',
    'cuisine.bon': 'Skilled cook',
    'field.allergies': 'Allergies / Intolerances',
    'field.preferencesAlimentaires': 'Dietary preferences (vegan, halal, etc.)',
    'field.frequenceRestaurant': 'Restaurant / takeaway frequency',
    'resto.rarement': 'Rarely',
    'resto.1-2': '1-2x per week',
    'resto.3-4': '3-4x per week',
    'resto.quotidien': 'Almost daily',

    // ── Step 6 — Lifestyle ──
    'field.sommeil': 'Sleep (hours/night, quality)',
    'field.stress': 'Stress level (1-10)',
    'field.travail': 'Job type',
    'travail.sedentaire': 'Sedentary (office)',
    'travail.mixte': 'Mixed',
    'travail.actif': 'Active / standing',
    'travail.physique': 'Physical / manual',
    'field.alcool': 'Alcohol consumption',
    'alcool.jamais': 'Never',
    'alcool.occasionnel': 'Occasional (1-2x/month)',
    'alcool.regulier': 'Regular (1-2x/wk)',
    'alcool.frequent': 'Frequent (3x+/wk)',
    'field.hydratation': 'Daily hydration',
    'hydra.lt1': 'Less than 1L',
    'hydra.1-1.5': '1 - 1.5L',
    'hydra.1.5-2': '1.5 - 2L',
    'hydra.2-3': '2 - 3L',
    'hydra.gt3': 'More than 3L',

    // ── Step 7 — Coaching context ──
    'field.dejaCoach': 'Ever had a personal trainer?',
    'coach.non': 'No, never',
    'coach.salle': 'Yes, at the gym',
    'coach.online': 'Yes, online',
    'coach.deux': 'Yes, both',
    'field.appsFitness': 'Fitness apps used',
    'field.pasMarche': "What didn't work before",
    'field.attentes': 'Expectations from Benfitcoach',

    // ── Step 8 — Notes ──
    'field.notesCoach': 'Personal notes from coach Benoit',

    // ── Buttons ──
    'btn.prev': 'Previous',
    'btn.next': 'Next',
    'btn.save': 'Save',
    'btn.generate': 'Generate onboarding file',
    'btn.regenerate': 'Regenerate full file',
    'btn.generating': 'Generating...',

    // ── Metrics panel ──
    'metrics.title': 'Body analysis',
    'metrics.evolution': 'Progress',
    'metrics.bmi': 'BMI',
    'metrics.bodyFat': 'Body fat',
    'metrics.leanMass': 'Lean mass',
    'metrics.bmr': 'Basal metabolism',
    'metrics.bmrFormula': 'Katch-McArdle',
    'metrics.genderRequired': 'Gender required',
    'metrics.missing': 'Missing',
    'metrics.hint': 'Enter waist and neck measurements to calculate',
    'metrics.col.measurement': 'Measurement',
    'metrics.col.previous': 'Previous',
    'metrics.col.today': 'Today',
    'metrics.col.change': 'Change',
    'metrics.label.weight': 'Weight',
    'metrics.label.waist': 'Waist',
    'metrics.label.hip': 'Hip',
    'metrics.label.neck': 'Neck',
    'metrics.label.chest': 'Chest',
    'metrics.label.rightArm': 'Right arm',
    'metrics.label.leftArm': 'Left arm',
    'metrics.label.rightThigh': 'Right thigh',
    'metrics.label.leftThigh': 'Left thigh',
    'metrics.label.calf': 'Calf',
    'metrics.label.bmiShort': 'BMI',
    'metrics.label.bfShort': 'Body fat',
    'metrics.label.leanShort': 'Lean mass',
    'metrics.label.bmrShort': 'Metabolism',

    // BMI interpretations
    'bmi.underweight': 'Underweight',
    'bmi.normal': 'Normal',
    'bmi.overweight': 'Overweight',
    'bmi.obesity': 'Obesity',

    // Body fat interpretations
    'bf.athletic': 'Athletic',
    'bf.fitness': 'Fitness',
    'bf.average': 'Average',
    'bf.high': 'High',

    // Optional measurements panel
    'optional.title': 'Additional measurements',
  },
};

// Returns a translator function closed over the chosen language.
// Usage : const t = getT(form.langue); t('field.prenom') // → "Prenom" or "First name"
export function getT(langue) {
  const dict = T[langue] || T.FR;
  const fallback = T.FR;
  return (key) => {
    if (dict[key] !== undefined) return dict[key];
    if (fallback[key] !== undefined) return fallback[key];
    return key;
  };
}
