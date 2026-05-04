import { FORMULES } from './formSteps';
import { computeMetrics, round1, round0 } from './bodyMetrics';
// V97.0 : centralisation des appels Claude (model sonnet ici, override default)
import { callClaude } from './services/anthropic';

function fmtOrNR(v, suffix = '') {
  return v != null ? `${v}${suffix}` : 'Non renseigne';
}

export function buildSystemPrompt(form) {
  const formule = FORMULES[form.formule] || FORMULES.suivi;
  const lang = form.langue === 'EN' ? 'English' : 'French';
  const metrics = computeMetrics(form);
  const bmiStr = metrics.bmi != null
    ? `${round1(metrics.bmi)}${metrics.bmiInfo ? ` (${metrics.bmiInfo.label})` : ''}`
    : 'Non renseigne';
  const bfStr = metrics.bodyFat != null
    ? `${round1(metrics.bodyFat)}%${metrics.bodyFatInfo ? ` (${metrics.bodyFatInfo.label})` : ''}`
    : 'Non calculable';
  const leanStr = metrics.leanMass != null ? `${round1(metrics.leanMass)} kg` : 'Non calculable';
  const bmrStr = metrics.bmr != null ? `${round0(metrics.bmr)} kcal/jour (Katch-McArdle)` : 'Non calculable';

  // Mesures complementaires (optionnelles) : on les liste seulement si au moins une est renseignee
  const optional = [
    { label: 'Tour de poitrine', value: form.tourPoitrine },
    { label: 'Tour de bras droit', value: form.tourBrasDroit },
    { label: 'Tour de bras gauche', value: form.tourBrasGauche },
    { label: 'Tour de cuisse droite', value: form.tourCuisseDroite },
    { label: 'Tour de cuisse gauche', value: form.tourCuisseGauche },
    { label: 'Tour de mollet', value: form.tourMollet },
  ].filter((m) => m.value !== '' && m.value != null);
  const optionalBlock = optional.length
    ? `\nMESURES COMPLEMENTAIRES :\n${optional.map((m) => `- ${m.label} : ${m.value} cm`).join('\n')}`
    : '';

  return `Tu es l'assistant IA de Benoit Deroubaix, coach sportif et massotherapeute chez Benfitcoach a Nyon, Suisse. 12+ ans d'experience, ancien athlete d'aviron haut niveau. Tu generes des programmes d'entrainement personnalises et des plans d'accompagnement complets pour ses clients.

CONTEXTE BENFITCOACH :
- Entreprise : AB Coaching Sarl, Rue de Rive 28, 1260 Nyon
- Duo d'experts : Benoit (sport + massage) et Anissa Deroubaix (nutrition, longevite, genetique)
- App : PT Distinction (programmes, messagerie, check-ins, habitudes)
- Zones : Nyon, Prangins, Founex, Coppet, Geneve + coaching en ligne mondial

FORMULES EN LIGNE :
- Autonome (150 CHF/mois) : Programme sport personnalise, app Benfitcoach, check-ins hebdo, messagerie coach 24h, scanner barcode/IA repas
- Suivi Complet (350 CHF/mois) : Tout Autonome + bilan sanguin vitamines/mineraux inclus + 1 consultation nutrition 1h avec Anissa + plan nutrition base sur resultats + 2 visio coaching/mois
- Intensif (600 CHF/mois, engagement 3 mois) : Tout Suivi Complet + analyse ADN complete incluse + nutrition genetique personnalisee + 4 visio/mois + reponse coach 12h

PACKS PRESENTIEL :
- Pack 10 (1'200 CHF) : 10 seances + app Benfitcoach
- Pack 20 (2'200 CHF) : 20 seances + bilan sanguin + consultation Anissa + 1 massage therapeutique + app
- Pack 30 (3'000 CHF) : 30 seances + bilan sanguin + consultation Anissa + 2 massages + app + option ADN (+450 CHF)

MASSOTHERAPIE :
- 120 CHF/h (public) / 90 CHF/h (clients coaching, -25%)
- Forme a l'Ecole TCMA de Geneve
- Au local Rue de Rive 28, Nyon

REFERENCES D'INSPIRATION POUR LES PROGRAMMES (INTERNES UNIQUEMENT) :
- Approche Essan NFC (methode NFC) : intensification progressive des efforts, personnalisation extreme des programmes, construction musculaire basee sur des lois physiologiques, focus sur les sensations et la connexion musculaire, approche holistique de la transformation physique
- Approche Training Therapie : programmation evidence-based basee sur la recherche scientifique, prevention des blessures, mobilite fonctionnelle, proprioception, reathletisation progressive, gestion intelligente de la charge d'entrainement, recuperation active
- Ne JAMAIS citer ni mentionner ces references dans les programmes generes. Utiliser leurs approches et methodologies sans les nommer. Les programmes doivent sembler venir de l'expertise de Benoit.

REGLES DE GENERATION :
- Langue : francais, ton professionnel mais chaleureux et motivant
- Tutoiement avec le client (style Benfitcoach)
- Systeme metrique (kg, cm, minutes)
- Adapter le vocabulaire au niveau du client (debutant = simple, avance = technique)
- Ne jamais promettre de resultats precis (pas de "tu vas perdre 5kg en 1 mois")
- Toujours inclure un disclaimer : "Ce programme sera ajuste en fonction de ta progression et de tes retours"
- Les services complementaires (massage, nutrition, bilan sanguin, ADN) sont presentes comme des avantages inclus ou disponibles, jamais comme des obligations
- Mentionner le "Lundi Bien-etre" au local de Nyon (consultation Anissa + massage Benoit) pour les clients presentiel
- Si le client est en Suivi Complet ou Intensif, mentionner qu'Anissa va le contacter pour sa consultation nutrition
- Adapter les recommandations au budget et a la formule du client
- Ne JAMAIS citer ni mentionner Essan NFC ni Training Therapie dans les programmes generes. Utiliser leurs approches et methodologies sans les nommer. Les programmes doivent sembler venir de l'expertise de Benoit.

CLIENT ACTUEL - Formule: "${formule.nom}" a ${formule.prix}
Langue du client: ${lang}

PROFIL CLIENT:
- Prenom: ${form.prenom || 'Non renseigne'}
- Age: ${form.age || 'Non renseigne'} | Genre: ${form.genre || 'Non renseigne'}
- Poids: ${form.poids || 'Non renseigne'} kg | Taille: ${form.taille || 'Non renseigne'} cm
- Tour de taille: ${fmtOrNR(form.tourTaille, ' cm')} | Tour de hanche: ${fmtOrNR(form.tourHanche, ' cm')} | Tour de cou: ${fmtOrNR(form.tourCou, ' cm')}

ANALYSE CORPORELLE (calculee automatiquement) :
- IMC : ${bmiStr}
- Masse grasse estimee (US Navy) : ${bfStr}
- Masse maigre : ${leanStr}
- Metabolisme de base : ${bmrStr}
- Utilise ces donnees pour calibrer les recommandations caloriques et l'intensite du programme.${optionalBlock}

OBJECTIFS:
- Principal: ${form.objectifPrincipal || 'Non renseigne'}
- Secondaire: ${form.objectifSecondaire || 'Non renseigne'}
- Deadline: ${form.deadline || 'Non renseigne'}
- Motivation profonde: ${form.motivationProfonde || 'Non renseigne'}

SPORT:
- Niveau: ${form.niveau || 'Non renseigne'} | Frequence souhaitee: ${form.frequence || 'Non renseigne'}
- Duree par seance: ${form.duree || 'Non renseigne'} | Lieu: ${form.lieu || 'Non renseigne'}
- Equipement disponible: ${form.equipement || 'Non renseigne'}
- Historique sportif: ${form.historique || 'Non renseigne'}
- Exercices aimes: ${form.exercicesAimes || 'Non renseigne'}
- Exercices evites: ${form.exercicesEvites || 'Non renseigne'}

SANTE:
- Blessures/limitations: ${form.blessures || 'Aucune'}
- Problemes de sante: ${form.problemesSante || 'Aucun'}
- Medicaments: ${form.medicaments || 'Aucun'}

NUTRITION:
- Objectif nutrition: ${form.objectifNutrition || 'Non renseigne'}
- Allergies/intolerances: ${form.allergies || 'Aucune'}
- Preferences alimentaires: ${form.preferencesAlimentaires || 'Non renseigne'}
- Frequence restaurant: ${form.frequenceRestaurant || 'Non renseigne'}
- Niveau cuisine: ${form.niveauCuisine || 'Non renseigne'}

LIFESTYLE:
- Sommeil: ${form.sommeil || 'Non renseigne'}
- Niveau de stress: ${form.stress || 'Non renseigne'}
- Type de travail: ${form.travail || 'Non renseigne'}
- Alcool: ${form.alcool || 'Non renseigne'}
- Hydratation: ${form.hydratation || 'Non renseigne'}

CONTEXTE COACHING:
- Deja eu un coach: ${form.dejaCoach || 'Non renseigne'}
- Apps fitness utilisees: ${form.appsFitness || 'Non renseigne'}
- Ce qui n'a pas marche avant: ${form.pasMarche || 'Non renseigne'}
- Attentes envers Benfitcoach: ${form.attentes || 'Non renseigne'}

NOTES DU COACH BENOIT:
${form.notesCoach || 'Aucune note'}`;
}

export const SECTION_TITLES = [
  'Resume client',
  "Programme d'entrainement",
  'Habitudes quotidiennes',
  'Nutrition de base',
  'Check-in hebdomadaire',
  'Messages de bienvenue',
  'Recommandations complementaires',
  'Notes pour le coach',
];

function buildSectionInstructions(form) {
  const formule = FORMULES[form.formule] || FORMULES.suivi;
  const lang = form.langue === 'EN' ? 'English' : 'French';
  return `Genere EXACTEMENT les 8 sections suivantes, separees par le marqueur ===SECTION=== suivi du nom de la section. Chaque section doit etre detaillee, personnalisee et actionnable. Redige en ${lang}.

===SECTION===Resume client
- Reformule les objectifs du client en langage motivant
- Identifie les points forts et les defis
- Definis des objectifs SMART a 4, 8 et 12 semaines

===SECTION===Programme d'entrainement
- Planning hebdomadaire (nombre de seances adapte au niveau et disponibilite)
- Chaque seance detaillee : echauffement, bloc principal, finisher, retour au calme
- Exercices avec series, repetitions, tempo, repos
- Progression prevue (augmentation charge/volume chaque semaine)
- Adapte au lieu d'entrainement (domicile, salle, exterieur) et materiel disponible
- Variantes pour chaque exercice si necessaire
- Focus sur la qualite d'execution, la connexion musculaire et les sensations
- Integrer mobilite fonctionnelle et prevention des blessures dans chaque seance
- Gestion intelligente de la charge : periodisation, deload, progression lineaire ou ondulee selon le niveau

===SECTION===Habitudes quotidiennes
4 habitudes a assigner dans l'app :
- Hydratation : boire minimum 2L d'eau par jour
- Proteines : atteindre l'objectif proteique quotidien
- Sommeil : respecter l'heure de coucher cible
- Mouvement : marcher minimum 7000 pas par jour
- Adapter les habitudes au profil du client si necessaire

===SECTION===Nutrition de base
- Conseils nutritionnels generaux adaptes a l'objectif
- Estimation des besoins caloriques (formule Mifflin-St Jeor)
- Repartition macros recommandee
- Exemples de repas type
- Note : "Pour un plan nutrition personnalise base sur un bilan sanguin, la formule Suivi Complet inclut une consultation avec notre nutritionniste Anissa."
${form.formule === 'suivi' || form.formule === 'intensif' ? '- Client en formule ' + formule.nom + ' : mentionner qu\'Anissa va le contacter pour sa consultation nutrition personnalisee.' : ''}

===SECTION===Check-in hebdomadaire
Questions a poser chaque semaine via l'app :
- Comment te sens-tu cette semaine ? (1-10)
- As-tu suivi le programme ? (Oui/Partiellement/Non)
- Niveau d'energie ? (1-10)
- Qualite du sommeil ? (1-10)
- Qu'est-ce qui a ete le plus difficile cette semaine ?
- Ton rythme est-il soutenable ? (Oui/Non)

===SECTION===Messages de bienvenue
5 messages tunnel personnalises :
- J+0 : Bienvenue personnalisee + comment utiliser l'app + premiere seance a faire
- J+3 : Prise de nouvelles + encouragement + rappel habitudes
- J+7 : Premier check-in + ajustements si necessaire
- J+14 : Progression + motivation + introduction aux services complementaires (massage, nutrition)
- J+30 : Bilan du premier mois + proposition d'upgrade si pertinent

===SECTION===Recommandations complementaires
- Si le client a des douleurs/tensions : recommander la massotherapie (90 CHF/h tarif client)
- Si le client a des objectifs nutrition avances : recommander la formule Suivi Complet (bilan sanguin + Anissa)
- Si le client veut optimiser au maximum : recommander la formule Intensif (ADN + nutrition genetique)
- Ne jamais forcer la vente — presenter comme un avantage disponible

===SECTION===Notes pour le coach
- Points d'attention specifiques au client
- Risques de blessure a surveiller
- Moments cles pour proposer un upgrade
- Strategie de retention (quand contacter, quand ajuster)`;
}

export function parseSections(text) {
  const sections = {};
  const parts = text.split(/===SECTION===/);

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    for (const title of SECTION_TITLES) {
      if (trimmed.toLowerCase().startsWith(title.toLowerCase())) {
        sections[title] = trimmed.slice(title.length).trim();
        break;
      }
    }
  }

  if (Object.keys(sections).length === 0 && text.trim()) {
    sections[SECTION_TITLES[0]] = text.trim();
  }

  return sections;
}

// V97.0 : anthropicRequest local supprime, on passe par callClaude. Note :
// le model par defaut de callClaude est haiku-4-5 — ici on garde sonnet
// (modele plus puissant pour la generation initiale du dossier complet).
// Le parametre apiKey de callAnthropic est conserve mais ignore : callClaude
// lit lui-meme localStorage('bfc_api_key'). Ne pas casser les call sites
// existants qui passent encore apiKey.

export async function callAnthropic(_apiKey, form) {
  const systemPrompt = buildSystemPrompt(form) + '\n\n---\n\n' + buildSectionInstructions(form);
  const text = await callClaude({
    system: systemPrompt,
    user: `Genere le dossier d'onboarding complet pour ${form.prenom || 'ce client'}. Suis exactement le format avec les 8 sections ===SECTION===.`,
    model: 'claude-sonnet-4-20250514',
    maxTokens: 8000,
    trim: false,
  });
  return parseSections(text);
}

export async function regenerateSection(apiKey, form, sectionTitle) {
  const lang = form.langue === 'EN' ? 'English' : 'French';
  const formule = FORMULES[form.formule] || FORMULES.suivi;

  let sectionInstruction = '';
  switch (sectionTitle) {
    case 'Resume client':
      sectionInstruction = 'Reformule les objectifs du client en langage motivant. Identifie les points forts et les defis. Definis des objectifs SMART a 4, 8 et 12 semaines.';
      break;
    case "Programme d'entrainement":
      sectionInstruction = 'Planning hebdomadaire detaille. Chaque seance : echauffement, bloc principal, finisher, retour au calme. Exercices avec series, repetitions, tempo, repos. Progression prevue. Adapte au lieu et materiel. Focus qualite d\'execution, connexion musculaire, sensations. Mobilite fonctionnelle et prevention des blessures. Periodisation et gestion intelligente de la charge.';
      break;
    case 'Habitudes quotidiennes':
      sectionInstruction = '4 habitudes a assigner dans l\'app : Hydratation (2L/jour), Proteines (objectif quotidien), Sommeil (heure de coucher cible), Mouvement (7000 pas/jour). Adapter au profil du client.';
      break;
    case 'Nutrition de base':
      sectionInstruction = 'Conseils nutritionnels generaux adaptes a l\'objectif. Estimation besoins caloriques (Mifflin-St Jeor). Repartition macros. Exemples de repas type. Mentionner la formule Suivi Complet pour un plan personnalise avec Anissa.';
      break;
    case 'Check-in hebdomadaire':
      sectionInstruction = 'Questions a poser chaque semaine via l\'app : bien-etre (1-10), suivi du programme, energie (1-10), sommeil (1-10), difficulte principale, rythme soutenable.';
      break;
    case 'Messages de bienvenue':
      sectionInstruction = '5 messages tunnel personnalises : J+0 (bienvenue + app + premiere seance), J+3 (nouvelles + encouragement), J+7 (premier check-in + ajustements), J+14 (progression + services complementaires), J+30 (bilan + upgrade).';
      break;
    case 'Recommandations complementaires':
      sectionInstruction = 'Recommandations personnalisees : massotherapie si douleurs (90 CHF/h tarif client), Suivi Complet si objectifs nutrition avances, Intensif si optimisation maximale. Presenter comme avantage disponible, jamais forcer.';
      break;
    case 'Notes pour le coach':
      sectionInstruction = 'Notes internes pour Benoit : points d\'attention specifiques, risques de blessure, moments cles pour upgrade, strategie de retention (quand contacter, quand ajuster).';
      break;
  }

  // V97.0 : passe par services/anthropic.js (model sonnet conserve)
  const text = await callClaude({
    system: buildSystemPrompt(form),
    user: `Regenere UNIQUEMENT la section "${sectionTitle}" pour ${form.prenom || 'ce client'}. ${sectionInstruction} Redige en ${lang}. Ecris directement le contenu sans prefixe ni marqueur.`,
    model: 'claude-sonnet-4-20250514',
    maxTokens: 3000,
  });

  return text.trim();
}
