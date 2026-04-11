// ──────────────────────────────────────────────────────────────
// Benfitcoach - Interview guide templates
// Used by the "Guide d'entretien" side panel on a client's file.
// Each template is a list of steps with questions Benoit asks live.
// Step IDs must be stable (used as localStorage / Supabase keys for
// per-step notes and per-question "asked" state).
// ──────────────────────────────────────────────────────────────

// ─── Weight loss + GLP-1 (EN) — exact wording from spec ───
const WEIGHT_LOSS_GLP1_EN = {
  id: 'weight-loss-glp1-en',
  name: 'Perte de poids + GLP-1 (EN)',
  steps: [
    { id: 'opening', title: 'STEP 1 — OPENING', questions: [
      "Before we start, I just want to understand your situation and see how we can build something sustainable.",
    ]},
    { id: 'goal', title: 'STEP 2 — GOAL', questions: [
      "What brings you here today?",
      "Why now?",
      "Why 20 kilos?",
    ]},
    { id: 'history', title: 'STEP 3 — HISTORY', questions: [
      "Have you tried to lose weight before?",
      "What worked, and what didn't last?",
      "Have you regained weight before?",
    ]},
    { id: 'glp1', title: 'STEP 4 — GLP-1', questions: [
      "You mentioned you're going to see a doctor about a treatment.",
      "What are you expecting from it exactly?",
      "How do you think it will help you?",
    ]},
    { id: 'reframe', title: 'STEP 5 — REFRAME', questions: [
      "It can help reduce hunger.",
      "But it doesn't replace habits.",
      "My role is to make sure you lose weight, and more importantly, that you don't regain it.",
    ]},
    { id: 'lifestyle', title: 'STEP 6 — LIFESTYLE', questions: [
      "What does a typical day of eating look like for you?",
      "Do you eat more out of hunger or cravings?",
      "Are you currently exercising?",
      "What feels difficult for you right now?",
    ]},
    { id: 'glp1-risks', title: 'STEP 7 — GLP-1 RISKS', questions: [
      "I prefer to be transparent with you.",
      "Some people end up eating too little and lose muscle.",
      "There can be some fatigue at the beginning.",
      "And without structure, weight regain often happens.",
    ]},
    { id: 'projection', title: 'STEP 8 — PROJECTION', questions: [
      "Losing 20 kilos is doable.",
      "But the most important thing is being able to maintain it.",
    ]},
    { id: 'engagement', title: 'STEP 9 — ENGAGEMENT', questions: [
      "On a scale of 1 to 10, where is your motivation?",
      "What would you need to be at 10?",
    ]},
    { id: 'coaching', title: 'STEP 10 — YOUR COACHING', questions: [
      "I focus on three things:",
      "Nutrition, training, and habits.",
      "The treatment can help, but the result depends on what we put in place.",
    ]},
    { id: 'framing', title: 'STEP 11 — FRAMING', questions: [
      "If you're looking for something quick without changing your habits, I'm not the right person.",
      "But if you want a real, lasting change, we can do great work together.",
    ]},
    { id: 'closing', title: 'STEP 12 — CLOSING', questions: [
      "Does that resonate with you?",
      "Do you see yourself committing to this?",
    ]},
  ],
};

// ─── Weight loss + GLP-1 (FR) — exact wording from spec ───
const WEIGHT_LOSS_GLP1_FR = {
  id: 'weight-loss-glp1-fr',
  name: 'Perte de poids + GLP-1 (FR)',
  steps: [
    { id: 'opening', title: 'ÉTAPE 1 — OUVERTURE', questions: [
      "Avant de commencer, je veux juste comprendre ta situation et voir comment on peut construire quelque chose de durable.",
    ]},
    { id: 'goal', title: 'ÉTAPE 2 — OBJECTIF', questions: [
      "Qu'est-ce qui t'amène aujourd'hui ?",
      "Pourquoi maintenant ?",
      "Pourquoi 20 kilos ?",
    ]},
    { id: 'history', title: 'ÉTAPE 3 — HISTORIQUE', questions: [
      "Tu as déjà essayé de perdre du poids avant ?",
      "Qu'est-ce qui a marché, et qu'est-ce qui n'a pas tenu ?",
      "Tu as déjà repris du poids après ?",
    ]},
    { id: 'glp1', title: 'ÉTAPE 4 — GLP-1', questions: [
      "Tu m'as dit que tu allais voir un médecin pour un traitement.",
      "Tu en attends quoi exactement ?",
      "Pour toi, ça va t'aider comment ?",
    ]},
    { id: 'reframe', title: 'ÉTAPE 5 — RECADRAGE', questions: [
      "Ça peut aider à réduire la faim.",
      "Mais ça ne remplace pas les habitudes.",
      "Mon rôle, c'est de faire en sorte que tu perdes du poids, et surtout que tu ne le reprennes pas.",
    ]},
    { id: 'lifestyle', title: 'ÉTAPE 6 — MODE DE VIE', questions: [
      "Une journée type, ça ressemble à quoi pour toi niveau alimentation ?",
      "Tu manges plus par faim ou par envie ?",
      "Tu fais du sport actuellement ?",
      "Qu'est-ce qui est difficile pour toi en ce moment ?",
    ]},
    { id: 'glp1-risks', title: 'ÉTAPE 7 — RISQUES GLP-1', questions: [
      "Je préfère être transparent avec toi.",
      "Certaines personnes mangent trop peu et perdent du muscle.",
      "Il peut y avoir de la fatigue au début.",
      "Et sans structure, il y a souvent une reprise derrière.",
    ]},
    { id: 'projection', title: 'ÉTAPE 8 — PROJECTION', questions: [
      "Perdre 20 kilos, c'est faisable.",
      "Mais le plus important, c'est de pouvoir les maintenir.",
    ]},
    { id: 'engagement', title: 'ÉTAPE 9 — ENGAGEMENT', questions: [
      "Sur 10, tu te situes où en motivation ?",
      "Qu'est-ce qui te manque pour être à 10 ?",
    ]},
    { id: 'coaching', title: 'ÉTAPE 10 — TON ACCOMPAGNEMENT', questions: [
      "Moi, je travaille sur trois choses :",
      "L'alimentation, l'entraînement, et les habitudes.",
      "Le traitement peut aider, mais le résultat dépend de ce qu'on met en place.",
    ]},
    { id: 'framing', title: 'ÉTAPE 11 — CADRAGE', questions: [
      "Si tu cherches quelque chose de rapide sans changer tes habitudes, je ne suis pas la bonne personne.",
      "Par contre, si tu veux un vrai changement durable, on peut faire un super travail.",
    ]},
    { id: 'closing', title: 'ÉTAPE 12 — CLOSING', questions: [
      "Est-ce que ça te parle ?",
      "Tu te vois t'engager là-dedans ?",
    ]},
  ],
};

// ─── Weight loss (EN) — exact wording from spec ───
const WEIGHT_LOSS_EN = {
  id: 'weight-loss-en',
  name: 'Perte de poids (EN)',
  steps: [
    { id: 'opening', title: 'STEP 1 — OPENING', questions: [
      "Before we start, I want to understand your situation and what you're looking for.",
    ]},
    { id: 'goal', title: 'STEP 2 — GOAL', questions: [
      "What brings you here today?",
      "What is your main goal?",
      "What would achieving this goal change in your daily life?",
    ]},
    { id: 'history', title: 'STEP 3 — HISTORY', questions: [
      "Have you tried to lose weight before?",
      "What worked, and what didn't last?",
      "Have you followed any specific diets or programs?",
    ]},
    { id: 'lifestyle', title: 'STEP 4 — CURRENT LIFESTYLE', questions: [
      "What does a typical day of eating look like for you?",
      "Do you eat more out of hunger or cravings?",
      "How many meals do you have per day?",
      "Do you cook or eat out mostly?",
    ]},
    { id: 'exercise', title: 'STEP 5 — EXERCISE', questions: [
      "Are you currently exercising?",
      "What type of activity do you enjoy?",
      "How many times per week can you realistically train?",
      "Do you have any injuries or physical limitations?",
    ]},
    { id: 'sleep-stress', title: 'STEP 6 — SLEEP & STRESS', questions: [
      "How is your sleep quality?",
      "What is your stress level on a scale of 1 to 10?",
      "Do you eat differently when you're stressed?",
    ]},
    { id: 'motivation', title: 'STEP 7 — MOTIVATION', questions: [
      "On a scale of 1 to 10, where is your motivation?",
      "What would you need to be at 10?",
      "What has prevented you from reaching your goals before?",
    ]},
    { id: 'approach', title: 'STEP 8 — MY APPROACH', questions: [
      "I focus on three things: nutrition, training, and daily habits.",
      "We build a program around YOUR life, not the other way around.",
      "My wife Anissa is a nutritionist — if needed, we can include a blood panel and a personalized nutrition plan.",
    ]},
    { id: 'expectations', title: 'STEP 9 — EXPECTATIONS', questions: [
      "Healthy weight loss is 0.5 to 1kg per week.",
      "The first results you'll notice are energy and sleep — within 2 weeks.",
      "Weight changes come between week 4 and 8.",
    ]},
    { id: 'closing', title: 'STEP 10 — CLOSING', questions: [
      "Does this approach make sense to you?",
      "Do you see yourself committing to this?",
      "Any questions before we get started?",
    ]},
  ],
};

// ─── Weight loss (FR) — mirror of the EN version ───
const WEIGHT_LOSS_FR = {
  id: 'weight-loss-fr',
  name: 'Perte de poids (FR)',
  steps: [
    { id: 'opening', title: 'ÉTAPE 1 — OUVERTURE', questions: [
      "Avant de commencer, je veux comprendre ta situation et ce que tu recherches.",
    ]},
    { id: 'goal', title: 'ÉTAPE 2 — OBJECTIF', questions: [
      "Qu'est-ce qui t'amène aujourd'hui ?",
      "Quel est ton objectif principal ?",
      "Qu'est-ce que ça changerait dans ton quotidien d'atteindre cet objectif ?",
    ]},
    { id: 'history', title: 'ÉTAPE 3 — HISTORIQUE', questions: [
      "Tu as déjà essayé de perdre du poids avant ?",
      "Qu'est-ce qui a marché, et qu'est-ce qui n'a pas tenu ?",
      "Tu as suivi des régimes ou des programmes particuliers ?",
    ]},
    { id: 'lifestyle', title: 'ÉTAPE 4 — MODE DE VIE ACTUEL', questions: [
      "Une journée type niveau alimentation, ça ressemble à quoi ?",
      "Tu manges plus par faim ou par envie ?",
      "Combien de repas par jour ?",
      "Tu cuisines ou tu manges plutôt à l'extérieur ?",
    ]},
    { id: 'exercise', title: 'ÉTAPE 5 — ACTIVITÉ PHYSIQUE', questions: [
      "Tu fais du sport actuellement ?",
      "Quel type d'activité tu aimes ?",
      "Combien de fois par semaine tu peux t'entraîner de façon réaliste ?",
      "Tu as des blessures ou des limitations physiques ?",
    ]},
    { id: 'sleep-stress', title: 'ÉTAPE 6 — SOMMEIL & STRESS', questions: [
      "Comment est la qualité de ton sommeil ?",
      "Ton niveau de stress sur 10, tu dirais quoi ?",
      "Tu manges différemment quand tu es stressé(e) ?",
    ]},
    { id: 'motivation', title: 'ÉTAPE 7 — MOTIVATION', questions: [
      "Sur 10, tu te situes où en motivation ?",
      "Qu'est-ce qui te manque pour être à 10 ?",
      "Qu'est-ce qui t'a empêché d'atteindre tes objectifs jusqu'ici ?",
    ]},
    { id: 'approach', title: 'ÉTAPE 8 — MON APPROCHE', questions: [
      "Je travaille sur trois choses : l'alimentation, l'entraînement et les habitudes.",
      "On construit un programme autour de TA vie, pas l'inverse.",
      "Ma femme Anissa est nutritionniste — si besoin, on peut inclure un bilan sanguin et un plan nutrition personnalisé.",
    ]},
    { id: 'expectations', title: 'ÉTAPE 9 — ATTENTES', questions: [
      "Une perte de poids saine, c'est 0.5 à 1 kg par semaine.",
      "Les premiers résultats que tu ressentiras, c'est l'énergie et le sommeil — sous 2 semaines.",
      "Les changements de poids arrivent entre la semaine 4 et la semaine 8.",
    ]},
    { id: 'closing', title: 'ÉTAPE 10 — CLOSING', questions: [
      "Est-ce que cette approche te parle ?",
      "Tu te vois t'engager là-dedans ?",
      "Tu as des questions avant qu'on démarre ?",
    ]},
  ],
};

// ─── Getting back in shape (FR) ───
const FITNESS_COMEBACK_FR = {
  id: 'fitness-comeback-fr',
  name: 'Remise en forme (FR)',
  steps: [
    { id: 'opening', title: 'ÉTAPE 1 — OUVERTURE', questions: [
      "Avant de commencer, je veux comprendre où tu en es aujourd'hui et où tu veux aller.",
    ]},
    { id: 'goal', title: 'ÉTAPE 2 — OBJECTIF', questions: [
      "Qu'est-ce qui t'amène aujourd'hui ?",
      "Tu cherches à reprendre le sport, à retrouver de l'énergie, les deux ?",
      "Qu'est-ce que tu aimerais sentir dans 3 mois ?",
    ]},
    { id: 'history', title: 'ÉTAPE 3 — HISTORIQUE SPORTIF', questions: [
      "Tu as déjà fait du sport régulièrement ?",
      "Quand as-tu arrêté, et pourquoi ?",
      "Quel niveau tu avais à l'époque ?",
    ]},
    { id: 'lifestyle', title: 'ÉTAPE 4 — MODE DE VIE ACTUEL', questions: [
      "Tu as un travail plutôt sédentaire ou actif ?",
      "Tu bouges combien dans la journée (marche, escaliers) ?",
      "Comment tu dors en ce moment ?",
    ]},
    { id: 'health', title: 'ÉTAPE 5 — SANTÉ', questions: [
      "Tu as des douleurs actuelles, articulations, dos ?",
      "Des blessures anciennes qui te limitent ?",
      "Tu prends des médicaments ou tu as une pathologie à signaler ?",
    ]},
    { id: 'availability', title: 'ÉTAPE 6 — DISPONIBILITÉ', questions: [
      "Combien de fois par semaine tu peux t'entraîner ?",
      "Tu préfères en salle, à la maison, ou en extérieur ?",
      "Combien de temps tu peux y consacrer par séance ?",
    ]},
    { id: 'approach', title: 'ÉTAPE 7 — MON APPROCHE', questions: [
      "Je reprends toujours en douceur, jamais dans la douleur.",
      "On commence par retrouver les bases : mobilité, gainage, cardio léger.",
      "On augmente progressivement, à ton rythme.",
    ]},
    { id: 'engagement', title: 'ÉTAPE 8 — ENGAGEMENT', questions: [
      "Sur 10, tu te situes où en motivation ?",
      "Qu'est-ce qui pourrait te freiner ?",
    ]},
    { id: 'closing', title: 'ÉTAPE 9 — CLOSING', questions: [
      "Est-ce que cette approche te parle ?",
      "Tu te vois démarrer cette semaine ?",
    ]},
  ],
};

// ─── Getting back in shape (EN) ───
const FITNESS_COMEBACK_EN = {
  id: 'fitness-comeback-en',
  name: 'Remise en forme (EN)',
  steps: [
    { id: 'opening', title: 'STEP 1 — OPENING', questions: [
      "Before we start, I want to understand where you are today and where you want to go.",
    ]},
    { id: 'goal', title: 'STEP 2 — GOAL', questions: [
      "What brings you here today?",
      "Are you looking to get back into sports, regain energy, or both?",
      "What would you like to feel in 3 months?",
    ]},
    { id: 'history', title: 'STEP 3 — SPORTS HISTORY', questions: [
      "Have you trained regularly in the past?",
      "When did you stop, and why?",
      "What level were you at back then?",
    ]},
    { id: 'lifestyle', title: 'STEP 4 — CURRENT LIFESTYLE', questions: [
      "Is your job sedentary or active?",
      "How much do you move during a typical day?",
      "How are you sleeping right now?",
    ]},
    { id: 'health', title: 'STEP 5 — HEALTH', questions: [
      "Any current pain — joints, back?",
      "Old injuries that still limit you?",
      "Any medications or health conditions I should know about?",
    ]},
    { id: 'availability', title: 'STEP 6 — AVAILABILITY', questions: [
      "How many times per week can you train?",
      "Do you prefer the gym, home, or outdoor?",
      "How long can you commit per session?",
    ]},
    { id: 'approach', title: 'STEP 7 — MY APPROACH', questions: [
      "I always start gently — never in pain.",
      "We rebuild the basics first: mobility, core, light cardio.",
      "We progress gradually, at your own pace.",
    ]},
    { id: 'engagement', title: 'STEP 8 — ENGAGEMENT', questions: [
      "On a scale of 1 to 10, where is your motivation?",
      "What might hold you back?",
    ]},
    { id: 'closing', title: 'STEP 9 — CLOSING', questions: [
      "Does this approach make sense to you?",
      "Do you see yourself starting this week?",
    ]},
  ],
};

// ─── Muscle building (FR) ───
const MUSCLE_FR = {
  id: 'muscle-fr',
  name: 'Renforcement musculaire (FR)',
  steps: [
    { id: 'opening', title: 'ÉTAPE 1 — OUVERTURE', questions: [
      "Avant de commencer, je veux bien comprendre ton objectif et ton niveau actuel.",
    ]},
    { id: 'goal', title: 'ÉTAPE 2 — OBJECTIF', questions: [
      "Tu vises quoi : prise de masse, force, esthétique ?",
      "Tu as un objectif chiffré ou visuel en tête ?",
      "Sur quelle échéance ?",
    ]},
    { id: 'history', title: 'ÉTAPE 3 — HISTORIQUE ENTRAÎNEMENT', questions: [
      "Tu t'entraînes depuis combien de temps ?",
      "Quels programmes tu as suivis récemment ?",
      "Quels sont tes records actuels (squat, développé, soulevé) ?",
    ]},
    { id: 'nutrition', title: 'ÉTAPE 4 — NUTRITION ACTUELLE', questions: [
      "Combien de repas par jour ?",
      "Tu suis tes apports (protéines, calories) ou pas ?",
      "Tu cuisines ou tu commandes ?",
    ]},
    { id: 'recovery', title: 'ÉTAPE 5 — RÉCUPÉRATION', questions: [
      "Combien d'heures de sommeil par nuit ?",
      "Ton niveau de stress ?",
      "Tu prends des suppléments ? Lesquels ?",
    ]},
    { id: 'setup', title: 'ÉTAPE 6 — ÉQUIPEMENT & LIEU', questions: [
      "Tu t'entraînes où ? Salle, box, maison ?",
      "Quel équipement tu as à disposition ?",
      "Combien de séances tu peux tenir par semaine ?",
    ]},
    { id: 'approach', title: 'ÉTAPE 7 — MON APPROCHE', questions: [
      "Je travaille avec de la périodisation — intensité, volume, récupération.",
      "La nutrition est calibrée à tes besoins, pas un copié-collé.",
      "On mesure la progression chaque semaine pour ajuster.",
    ]},
    { id: 'engagement', title: 'ÉTAPE 8 — ENGAGEMENT', questions: [
      "Sur 10, où est ta motivation ?",
      "Qu'est-ce qui pourrait te freiner sur la durée ?",
    ]},
    { id: 'closing', title: 'ÉTAPE 9 — CLOSING', questions: [
      "Cette approche te parle ?",
      "Tu te vois t'engager sur au moins 3 mois ?",
    ]},
  ],
};

// ─── Muscle building (EN) ───
const MUSCLE_EN = {
  id: 'muscle-en',
  name: 'Renforcement musculaire (EN)',
  steps: [
    { id: 'opening', title: 'STEP 1 — OPENING', questions: [
      "Before we start, I want to understand your goal and your current level.",
    ]},
    { id: 'goal', title: 'STEP 2 — GOAL', questions: [
      "Are you going for muscle gain, strength, or physique?",
      "Do you have a specific target in mind (numbers, look)?",
      "On what timeline?",
    ]},
    { id: 'history', title: 'STEP 3 — TRAINING HISTORY', questions: [
      "How long have you been training?",
      "What programs have you followed recently?",
      "What are your current PRs (squat, bench, deadlift)?",
    ]},
    { id: 'nutrition', title: 'STEP 4 — CURRENT NUTRITION', questions: [
      "How many meals per day?",
      "Are you tracking intake (protein, calories)?",
      "Do you cook or order out?",
    ]},
    { id: 'recovery', title: 'STEP 5 — RECOVERY', questions: [
      "How many hours of sleep per night?",
      "What's your stress level?",
      "Any supplements? Which ones?",
    ]},
    { id: 'setup', title: 'STEP 6 — SETUP & LOCATION', questions: [
      "Where do you train — gym, box, home?",
      "What equipment do you have?",
      "How many sessions can you realistically commit to per week?",
    ]},
    { id: 'approach', title: 'STEP 7 — MY APPROACH', questions: [
      "I use periodization — intensity, volume, recovery.",
      "Nutrition is calibrated to your needs, not copy-paste.",
      "We measure progress weekly to adjust.",
    ]},
    { id: 'engagement', title: 'STEP 8 — ENGAGEMENT', questions: [
      "On a scale of 1 to 10, where is your motivation?",
      "What might hold you back over time?",
    ]},
    { id: 'closing', title: 'STEP 9 — CLOSING', questions: [
      "Does this approach make sense to you?",
      "Can you commit to at least 3 months?",
    ]},
  ],
};

// ─── Post-injury / Rehab (FR) ───
const REHAB_FR = {
  id: 'rehab-fr',
  name: 'Post-blessure / Rééducation (FR)',
  steps: [
    { id: 'opening', title: 'ÉTAPE 1 — OUVERTURE', questions: [
      "Avant de commencer, je veux bien comprendre ta blessure et ce que tes professionnels de santé t'ont dit.",
    ]},
    { id: 'injury', title: 'ÉTAPE 2 — NATURE DE LA BLESSURE', questions: [
      "Quelle est la blessure exactement ?",
      "Quand est-ce arrivé ?",
      "Comment ça s'est passé ?",
    ]},
    { id: 'treatment', title: 'ÉTAPE 3 — TRAITEMENT EN COURS', questions: [
      "Tu es suivi par un kiné, un ostéo, un médecin ?",
      "Qu'est-ce qu'ils t'ont dit concernant l'activité physique ?",
      "Tu as une prescription ou un protocole à respecter ?",
    ]},
    { id: 'limitations', title: 'ÉTAPE 4 — LIMITATIONS ACTUELLES', questions: [
      "Quels mouvements tu dois éviter ?",
      "Qu'est-ce qui déclenche la douleur ?",
      "À quel niveau de douleur tu es au quotidien (0-10) ?",
    ]},
    { id: 'goal', title: 'ÉTAPE 5 — OBJECTIF', questions: [
      "Ton objectif principal : récupération, retour au sport, réduction de la douleur ?",
      "Qu'est-ce que tu faisais avant que tu voudrais refaire ?",
      "Sur quelle échéance ?",
    ]},
    { id: 'fear', title: 'ÉTAPE 6 — PEUR & APPRÉHENSION', questions: [
      "Tu as peur de certains mouvements ?",
      "Tu fais confiance à ton corps en ce moment ?",
      "Qu'est-ce qui t'inquiète le plus ?",
    ]},
    { id: 'approach', title: 'ÉTAPE 7 — MON APPROCHE', questions: [
      "On travaille en coordination avec ton kiné et ton médecin.",
      "On avance progressivement — mobilité, stabilité, puis renforcement.",
      "Jamais dans la douleur, jamais en force brute.",
      "On reconstruit la confiance au même rythme que le corps.",
    ]},
    { id: 'engagement', title: 'ÉTAPE 8 — ENGAGEMENT', questions: [
      "Sur 10, où est ta motivation ?",
      "Tu es prêt(e) à avancer étape par étape, même si c'est lent ?",
    ]},
    { id: 'closing', title: 'ÉTAPE 9 — CLOSING', questions: [
      "Cette approche te rassure ?",
      "Tu te vois démarrer avec moi ?",
    ]},
  ],
};

// ─── Post-injury / Rehab (EN) ───
const REHAB_EN = {
  id: 'rehab-en',
  name: 'Post-blessure / Rééducation (EN)',
  steps: [
    { id: 'opening', title: 'STEP 1 — OPENING', questions: [
      "Before we start, I want to understand your injury and what your medical team has told you.",
    ]},
    { id: 'injury', title: 'STEP 2 — NATURE OF THE INJURY', questions: [
      "What exactly is the injury?",
      "When did it happen?",
      "How did it happen?",
    ]},
    { id: 'treatment', title: 'STEP 3 — CURRENT TREATMENT', questions: [
      "Are you seeing a physio, osteo, or doctor?",
      "What have they said about physical activity?",
      "Do you have a protocol or prescription to follow?",
    ]},
    { id: 'limitations', title: 'STEP 4 — CURRENT LIMITATIONS', questions: [
      "What movements do you need to avoid?",
      "What triggers pain?",
      "What's your pain level day to day (0-10)?",
    ]},
    { id: 'goal', title: 'STEP 5 — GOAL', questions: [
      "Is your main goal recovery, return to sport, or pain reduction?",
      "What did you do before that you'd like to do again?",
      "On what timeline?",
    ]},
    { id: 'fear', title: 'STEP 6 — FEAR & HESITATION', questions: [
      "Are you afraid of certain movements?",
      "Do you trust your body right now?",
      "What worries you the most?",
    ]},
    { id: 'approach', title: 'STEP 7 — MY APPROACH', questions: [
      "We work in coordination with your physio and doctor.",
      "We progress gradually — mobility, stability, then strength.",
      "Never in pain, never by force.",
      "We rebuild confidence at the same pace as the body.",
    ]},
    { id: 'engagement', title: 'STEP 8 — ENGAGEMENT', questions: [
      "On a scale of 1 to 10, where is your motivation?",
      "Are you ready to move forward step by step, even if it's slow?",
    ]},
    { id: 'closing', title: 'STEP 9 — CLOSING', questions: [
      "Does this approach reassure you?",
      "Can you see yourself starting with me?",
    ]},
  ],
};

// ─── Senior / Mobility (FR) ───
const SENIOR_FR = {
  id: 'senior-fr',
  name: 'Senior / Mobilité (FR)',
  steps: [
    { id: 'opening', title: 'ÉTAPE 1 — OUVERTURE', questions: [
      "Avant de commencer, je veux comprendre ce que tu recherches et où tu en es physiquement.",
    ]},
    { id: 'goal', title: 'ÉTAPE 2 — OBJECTIF', questions: [
      "Tu cherches plutôt de la mobilité, de l'équilibre, de l'autonomie, ou de l'énergie ?",
      "Qu'est-ce que tu aimerais pouvoir refaire facilement au quotidien ?",
      "Qu'est-ce qui t'amène maintenant plutôt que l'an dernier ?",
    ]},
    { id: 'health', title: 'ÉTAPE 3 — HISTORIQUE SANTÉ', questions: [
      "Tu as des pathologies que je dois connaître ?",
      "Tu prends des médicaments régulièrement ?",
      "Tu as eu des opérations récentes ou anciennes qui comptent ?",
    ]},
    { id: 'mobility', title: 'ÉTAPE 4 — MOBILITÉ ACTUELLE', questions: [
      "Tu marches combien par jour ?",
      "Les escaliers, ça va ?",
      "Tu as des douleurs articulaires ou musculaires ?",
    ]},
    { id: 'lifestyle', title: 'ÉTAPE 5 — MODE DE VIE', questions: [
      "Tu as une activité régulière (jardin, marche, ménage) ?",
      "Comment tu manges au quotidien ?",
      "Tu vis seul(e) ou accompagné(e) ?",
    ]},
    { id: 'fear', title: 'ÉTAPE 6 — APPRÉHENSION', questions: [
      "Tu as peur de te blesser ou de forcer ?",
      "Qu'est-ce qui t'inquiète le plus ?",
      "Tu as déjà fait du coaching avant ?",
    ]},
    { id: 'approach', title: 'ÉTAPE 7 — MON APPROCHE', questions: [
      "Tout est doux, progressif, adapté à ton corps.",
      "On travaille la mobilité, l'équilibre, et un peu de renforcement.",
      "Jamais dans la douleur. Jamais d'exercices que tu ne sens pas.",
      "L'objectif, c'est que tu te sentes mieux dans ton corps au quotidien.",
    ]},
    { id: 'engagement', title: 'ÉTAPE 8 — ENGAGEMENT', questions: [
      "Tu te sens prêt(e) à venir une à deux fois par semaine ?",
      "Qu'est-ce qui pourrait te freiner ?",
    ]},
    { id: 'closing', title: 'ÉTAPE 9 — CLOSING', questions: [
      "Cette approche te rassure ?",
      "Tu te vois démarrer avec moi ?",
    ]},
  ],
};

// ─── Senior / Mobility (EN) ───
const SENIOR_EN = {
  id: 'senior-en',
  name: 'Senior / Mobilité (EN)',
  steps: [
    { id: 'opening', title: 'STEP 1 — OPENING', questions: [
      "Before we start, I want to understand what you're looking for and where you are physically.",
    ]},
    { id: 'goal', title: 'STEP 2 — GOAL', questions: [
      "Are you looking for mobility, balance, independence, or energy?",
      "What would you like to do easily again in your daily life?",
      "What brings you here now rather than last year?",
    ]},
    { id: 'health', title: 'STEP 3 — HEALTH HISTORY', questions: [
      "Any conditions I should know about?",
      "Are you taking any regular medications?",
      "Any past or recent surgeries that matter?",
    ]},
    { id: 'mobility', title: 'STEP 4 — CURRENT MOBILITY', questions: [
      "How much do you walk per day?",
      "How are stairs for you?",
      "Any joint or muscle pain?",
    ]},
    { id: 'lifestyle', title: 'STEP 5 — LIFESTYLE', questions: [
      "Do you have regular activity (gardening, walking, housework)?",
      "How do you eat day to day?",
      "Do you live alone or with someone?",
    ]},
    { id: 'fear', title: 'STEP 6 — HESITATION', questions: [
      "Are you afraid of hurting yourself or overdoing it?",
      "What worries you the most?",
      "Have you done coaching before?",
    ]},
    { id: 'approach', title: 'STEP 7 — MY APPROACH', questions: [
      "Everything is gentle, progressive, adapted to your body.",
      "We work on mobility, balance, and a bit of strength.",
      "Never in pain. Never exercises you don't feel good about.",
      "The goal is for you to feel better in your body day to day.",
    ]},
    { id: 'engagement', title: 'STEP 8 — ENGAGEMENT', questions: [
      "Can you see yourself coming once or twice a week?",
      "What might hold you back?",
    ]},
    { id: 'closing', title: 'STEP 9 — CLOSING', questions: [
      "Does this approach reassure you?",
      "Can you see yourself starting with me?",
    ]},
  ],
};

// ─── Empty / custom ───
export const EMPTY_TEMPLATE = {
  id: 'empty',
  name: 'Vide (personnalisé)',
  steps: [],
};

// ─── Master list (order matters → dropdown order) ───
export const BUILTIN_TEMPLATES = [
  WEIGHT_LOSS_FR,
  WEIGHT_LOSS_EN,
  WEIGHT_LOSS_GLP1_FR,
  WEIGHT_LOSS_GLP1_EN,
  FITNESS_COMEBACK_FR,
  FITNESS_COMEBACK_EN,
  MUSCLE_FR,
  MUSCLE_EN,
  REHAB_FR,
  REHAB_EN,
  SENIOR_FR,
  SENIOR_EN,
  EMPTY_TEMPLATE,
];

export function getBuiltinTemplate(id) {
  return BUILTIN_TEMPLATES.find((t) => t.id === id) || null;
}

// ─── Custom template storage (localStorage) ─────────────────
// Custom templates are shared across all clients and live only locally.
// (We don't sync them to Supabase — small scope, private to Benoit's device.)
const CUSTOM_KEY = 'bfc_custom_interview_templates';

export function getCustomTemplates() {
  try {
    return JSON.parse(localStorage.getItem(CUSTOM_KEY) || '[]');
  } catch {
    return [];
  }
}

export function saveCustomTemplate(template) {
  const list = getCustomTemplates();
  const idx = list.findIndex((t) => t.id === template.id);
  const entry = {
    id: template.id || `custom-${Date.now()}`,
    name: template.name || 'Sans titre',
    steps: template.steps || [],
    custom: true,
  };
  if (idx >= 0) list[idx] = entry;
  else list.push(entry);
  localStorage.setItem(CUSTOM_KEY, JSON.stringify(list));
  return entry;
}

export function deleteCustomTemplate(id) {
  const list = getCustomTemplates().filter((t) => t.id !== id);
  localStorage.setItem(CUSTOM_KEY, JSON.stringify(list));
}

export function getAllTemplates() {
  // Custom templates go before EMPTY_TEMPLATE (which stays last).
  const builtinBeforeEmpty = BUILTIN_TEMPLATES.filter((t) => t.id !== 'empty');
  return [...builtinBeforeEmpty, ...getCustomTemplates(), EMPTY_TEMPLATE];
}

export function resolveTemplate(id) {
  const builtin = getBuiltinTemplate(id);
  if (builtin) return builtin;
  const custom = getCustomTemplates().find((t) => t.id === id);
  return custom || null;
}

// ──────────────────────────────────────────────────────────────
// Interview → Client form mapping
// ──────────────────────────────────────────────────────────────
// Each entry maps a template step id to a list of client form fields that
// should receive the step's notes. notesCoach is NOT listed here because
// all notes are concatenated into notesCoach as a full summary anyway.
//
// Field names must match INITIAL_FORM / PRESENTIEL_INITIAL_FORM keys in
// formSteps.js. Unknown field names are simply ignored at apply time.
// ──────────────────────────────────────────────────────────────

// Shared mappings (FR and EN variants map identically — step ids match).
const WEIGHT_LOSS_GLP1_MAP = {
  goal: ['objectifPrincipal'],
  history: ['historique'],
  lifestyle: ['preferencesAlimentaires', 'historique'],
  engagement: ['motivationProfonde'],
  // reframe / glp1-risks / framing / closing → only summary → notesCoach
};

const WEIGHT_LOSS_MAP = {
  goal: ['objectifPrincipal'],
  history: ['historique'],
  lifestyle: ['preferencesAlimentaires'],
  exercise: ['historique', 'frequence', 'blessures'],
  'sleep-stress': ['sommeil', 'stress'],
  motivation: ['motivationProfonde'],
  // closing → only summary
};

const FITNESS_COMEBACK_MAP = {
  goal: ['objectifPrincipal'],
  history: ['historique'],
  lifestyle: ['travail'],
  health: ['blessures', 'problemesSante', 'medicaments'],
  availability: ['frequence', 'lieu', 'duree'],
  engagement: ['motivationProfonde'],
};

const MUSCLE_MAP = {
  goal: ['objectifPrincipal'],
  history: ['historique'],
  nutrition: ['preferencesAlimentaires'],
  recovery: ['sommeil', 'stress', 'medicaments'],
  setup: ['lieu', 'equipement', 'frequence'],
  engagement: ['motivationProfonde'],
};

const REHAB_MAP = {
  injury: ['blessures'],
  treatment: ['medicaments', 'problemesSante'],
  limitations: ['blessures'],
  goal: ['objectifPrincipal'],
  engagement: ['motivationProfonde'],
};

const SENIOR_MAP = {
  goal: ['objectifPrincipal'],
  health: ['problemesSante', 'medicaments'],
  mobility: ['blessures'],
  lifestyle: ['preferencesAlimentaires'],
  engagement: ['motivationProfonde'],
};

export const TEMPLATE_MAPPINGS = {
  'weight-loss-glp1-en': WEIGHT_LOSS_GLP1_MAP,
  'weight-loss-glp1-fr': WEIGHT_LOSS_GLP1_MAP,
  'weight-loss-en': WEIGHT_LOSS_MAP,
  'weight-loss-fr': WEIGHT_LOSS_MAP,
  'fitness-comeback-fr': FITNESS_COMEBACK_MAP,
  'fitness-comeback-en': FITNESS_COMEBACK_MAP,
  'muscle-fr': MUSCLE_MAP,
  'muscle-en': MUSCLE_MAP,
  'rehab-fr': REHAB_MAP,
  'rehab-en': REHAB_MAP,
  'senior-fr': SENIOR_MAP,
  'senior-en': SENIOR_MAP,
};

// Fallback keyword → field list for custom templates or unmapped steps.
// First match wins — ordered by specificity.
const KEYWORD_FALLBACK = [
  { re: /blessure|injury|douleur|pain|rehab/i, fields: ['blessures'] },
  { re: /médicam|medic|treatment|traitement/i, fields: ['medicaments'] },
  { re: /sommeil|sleep/i, fields: ['sommeil'] },
  { re: /stress/i, fields: ['stress'] },
  { re: /aliment|nutrition|eating|diet|repas|food/i, fields: ['preferencesAlimentaires'] },
  { re: /sport|exercise|entrain|training|activit/i, fields: ['historique'] },
  { re: /motivat|engage/i, fields: ['motivationProfonde'] },
  { re: /objectif|goal|target/i, fields: ['objectifPrincipal'] },
  { re: /historique|history/i, fields: ['historique'] },
];

const SEPARATOR = '--- Notes entretien ---';

function getStepNotes(interviewNotes, templateId, stepId) {
  return (interviewNotes?.byTemplate?.[templateId]?.steps?.[stepId]?.notes || '').trim();
}

// Applies a completed interview's notes to a client form.
// Returns a NEW form object. Existing content in each target field is
// preserved — notes are appended after a separator if the field already
// has content.
export function applyInterviewNotesToForm(form, interviewNotes, templateId, dateStr) {
  const template = resolveTemplate(templateId);
  if (!template || !template.steps || template.steps.length === 0) return form;

  const date = dateStr || new Date().toISOString().slice(0, 10);
  const mapping = TEMPLATE_MAPPINGS[templateId] || {};
  const newForm = { ...form };

  // Group all mapped text by target field so a single entretien produces at
  // most ONE separator per field (not one per step).
  const perField = {};
  const addToField = (field, text) => {
    if (!field || !text) return;
    if (!(field in newForm)) return; // ignore unknown fields
    if (!perField[field]) perField[field] = [];
    perField[field].push(text);
  };

  for (const step of template.steps) {
    const notes = getStepNotes(interviewNotes, templateId, step.id);
    if (!notes) continue;

    const explicit = mapping[step.id];
    if (explicit && explicit.length) {
      for (const field of explicit) addToField(field, notes);
      continue;
    }
    // Fallback: match against step title + id
    const haystack = `${step.title || ''} ${step.id || ''}`.toLowerCase();
    for (const { re, fields } of KEYWORD_FALLBACK) {
      if (re.test(haystack)) {
        for (const field of fields) addToField(field, notes);
        break;
      }
    }
    // Unmatched steps still get captured in the notesCoach summary below.
  }

  // Apply per-field collected notes with a single separator per field.
  for (const [field, texts] of Object.entries(perField)) {
    if (field === 'notesCoach') continue; // handled by summary block
    const appended = texts.join('\n');
    const existing = (newForm[field] || '').trim();
    newForm[field] = existing
      ? `${existing}\n\n${SEPARATOR}\n${appended}`
      : appended;
  }

  // Build a full summary for notesCoach covering ALL non-empty steps.
  const summaryLines = [];
  for (const step of template.steps) {
    const notes = getStepNotes(interviewNotes, templateId, step.id);
    if (!notes) continue;
    summaryLines.push(`[${step.title}]`);
    summaryLines.push(notes);
    summaryLines.push('');
  }

  if (summaryLines.length > 0) {
    const header = `${SEPARATOR} ${date} (${template.name}) ---`;
    const block = `${header}\n${summaryLines.join('\n').trim()}`;
    const existing = (newForm.notesCoach || '').trim();
    newForm.notesCoach = existing ? `${existing}\n\n${block}` : block;
  }

  return newForm;
}

// Convenience: tells callers whether a template's notes contain anything
// worth injecting — used to disable the "Terminer l'entretien" button.
export function hasAnyInterviewNotes(interviewNotes, templateId) {
  const byTemplate = interviewNotes?.byTemplate?.[templateId]?.steps;
  if (!byTemplate) return false;
  for (const step of Object.values(byTemplate)) {
    if (step && typeof step.notes === 'string' && step.notes.trim()) return true;
  }
  return false;
}
