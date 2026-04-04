import { FORMULES } from './formSteps';

export function buildSystemPrompt(form) {
  const formule = FORMULES[form.formule] || FORMULES.suivi;
  const lang = form.langue === 'EN' ? 'English' : 'French';

  return `Tu es l'assistant IA de Benoit, coach sportif premium chez Benfitcoach (Suisse). Tu generes le dossier d'onboarding complet pour un nouveau client.

CONTEXTE BENFITCOACH:
- Formules: Autonome (150 CHF/mois - programme seul), Suivi Complet (350 CHF/mois - programme + suivi hebdo + ajustements), Intensif (600 CHF/mois - tout + sessions live + support quotidien)
- Client actuel: formule "${formule.nom}" a ${formule.prix}
- Langue du client: ${lang}

METHODOLOGIE (inspire de Tim Saye & Ash / PT Distinction):
- Onboarding = premiere impression = retention. Personnaliser chaque element.
- Approche behavior-first: identifier les habitudes cles avant de parler de programme.
- Construire la confiance par la precision et l'empathie des le premier message.
- Utiliser les motivations profondes du client pour ancrer chaque recommandation.
- Progressive overload adapte au niveau et historique.
- Nutrition: jamais de regime restrictif, toujours sustainable. Calculer les besoins via Harris-Benedict.

CALCUL HARRIS-BENEDICT (inclure dans l'analyse):
- Homme: BMR = 88.362 + (13.397 x poids kg) + (4.799 x taille cm) - (5.677 x age)
- Femme: BMR = 447.593 + (9.247 x poids kg) + (3.098 x taille cm) - (4.330 x age)
- Multiplicateurs: Sedentaire x1.2, Leger x1.375, Modere x1.55, Actif x1.725, Tres actif x1.9
- Ajuster selon l'objectif: deficit de 300-500 kcal pour perte de poids, surplus de 200-400 pour prise de masse.

PROFIL CLIENT:
- Prenom: ${form.prenom || 'Non renseigne'}
- Age: ${form.age || 'Non renseigne'} | Genre: ${form.genre || 'Non renseigne'}
- Poids: ${form.poids || 'Non renseigne'} kg | Taille: ${form.taille || 'Non renseigne'} cm

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
  'Analyse du profil',
  'Message de bienvenue',
  'Prompt AI Program Builder',
  'Prompt AI Meal Planner',
  'Habitudes personnalisees',
  'Notes de coaching',
  'Message J+3',
  "Strategie d'upsell",
];

function buildSectionInstructions(form) {
  const formule = FORMULES[form.formule] || FORMULES.suivi;
  const lang = form.langue === 'EN' ? 'English' : 'French';
  return `Genere EXACTEMENT les 8 sections suivantes, separees par le marqueur ===SECTION=== suivi du nom de la section. Chaque section doit etre detaillee, personnalisee et actionnable. Redige en ${lang}.

===SECTION===Analyse du profil
Analyse complete du client: calcul BMR Harris-Benedict, analyse de la composition, identification des points d'attention, resume des forces et faiblesses, niveau de priorite des objectifs.

===SECTION===Message de bienvenue
Message chaleureux et personnel de Benoit au client. Mentionner son prenom, sa formule, ses objectifs. Ton premium mais accessible. Donner envie de commencer. Inclure les prochaines etapes concretes.

===SECTION===Prompt AI Program Builder
Prompt complet et detaille a copier-coller dans un AI program builder (comme PT Distinction AI ou similar). Doit inclure toutes les specs: niveau, frequence, duree, lieu, equipement, limitations, objectifs, preferences. Format structure pret a l'emploi.

===SECTION===Prompt AI Meal Planner
Prompt complet pour generer un plan nutritionnel personnalise. Inclure: calories cibles calculees, macros, allergies, preferences, nombre de repas, niveau cuisine, budget, objectif. Pret a copier-coller.

===SECTION===Habitudes personnalisees
5-7 micro-habitudes personnalisees basees sur le profil. Format: habitude + pourquoi + comment l'implementer + trigger. Approche behavioral design (tiny habits). Prioriser par impact.

===SECTION===Notes de coaching
Notes internes pour Benoit: points d'attention, risques de decrochage, leviers de motivation, strategie de communication adaptee, frequence de check-in recommandee, red flags a surveiller.

===SECTION===Message J+3
Message de follow-up a envoyer 3 jours apres le debut. Verifier comment ca se passe, anticiper les difficultes, renforcer la motivation, poser des questions specifiques basees sur le profil.

===SECTION===Strategie d'upsell
${form.formule === 'intensif' ? 'Client deja en formule Intensif. Proposer des add-ons: nutrition coaching approfondi, bilan mensuel video, acces a des masterclass.' : `Strategie naturelle pour faire evoluer le client de "${formule.nom}" vers la formule superieure. Identifier le bon moment, les arguments personnalises bases sur ses objectifs, et le pitch naturel sans pression.`}`;
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

async function anthropicRequest(apiKey, systemPrompt, userMessage, maxTokens = 8000) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Erreur API: ${response.status}`);
  }

  const data = await response.json();
  return data.content?.[0]?.text || '';
}

export async function callAnthropic(apiKey, form) {
  const systemPrompt = buildSystemPrompt(form) + '\n\n---\n\n' + buildSectionInstructions(form);
  const text = await anthropicRequest(
    apiKey,
    systemPrompt,
    `Genere le dossier d'onboarding complet pour ${form.prenom || 'ce client'}. Suis exactement le format avec les 8 sections ===SECTION===.`
  );
  return parseSections(text);
}

export async function regenerateSection(apiKey, form, sectionTitle) {
  const lang = form.langue === 'EN' ? 'English' : 'French';
  const formule = FORMULES[form.formule] || FORMULES.suivi;

  let sectionInstruction = '';
  switch (sectionTitle) {
    case 'Analyse du profil':
      sectionInstruction = 'Analyse complete du client: calcul BMR Harris-Benedict, analyse de la composition, identification des points d\'attention, resume des forces et faiblesses, niveau de priorite des objectifs.';
      break;
    case 'Message de bienvenue':
      sectionInstruction = 'Message chaleureux et personnel de Benoit au client. Mentionner son prenom, sa formule, ses objectifs. Ton premium mais accessible. Donner envie de commencer. Inclure les prochaines etapes concretes.';
      break;
    case 'Prompt AI Program Builder':
      sectionInstruction = 'Prompt complet et detaille a copier-coller dans un AI program builder (comme PT Distinction AI ou similar). Doit inclure toutes les specs: niveau, frequence, duree, lieu, equipement, limitations, objectifs, preferences. Format structure pret a l\'emploi.';
      break;
    case 'Prompt AI Meal Planner':
      sectionInstruction = 'Prompt complet pour generer un plan nutritionnel personnalise. Inclure: calories cibles calculees, macros, allergies, preferences, nombre de repas, niveau cuisine, budget, objectif. Pret a copier-coller.';
      break;
    case 'Habitudes personnalisees':
      sectionInstruction = '5-7 micro-habitudes personnalisees basees sur le profil. Format: habitude + pourquoi + comment l\'implementer + trigger. Approche behavioral design (tiny habits). Prioriser par impact.';
      break;
    case 'Notes de coaching':
      sectionInstruction = 'Notes internes pour Benoit: points d\'attention, risques de decrochage, leviers de motivation, strategie de communication adaptee, frequence de check-in recommandee, red flags a surveiller.';
      break;
    case 'Message J+3':
      sectionInstruction = 'Message de follow-up a envoyer 3 jours apres le debut. Verifier comment ca se passe, anticiper les difficultes, renforcer la motivation, poser des questions specifiques basees sur le profil.';
      break;
    case "Strategie d'upsell":
      sectionInstruction = form.formule === 'intensif'
        ? 'Client deja en formule Intensif. Proposer des add-ons: nutrition coaching approfondi, bilan mensuel video, acces a des masterclass.'
        : `Strategie naturelle pour faire evoluer le client de "${formule.nom}" vers la formule superieure. Identifier le bon moment, les arguments personnalises bases sur ses objectifs, et le pitch naturel sans pression.`;
      break;
  }

  const text = await anthropicRequest(
    apiKey,
    buildSystemPrompt(form),
    `Regenere UNIQUEMENT la section "${sectionTitle}" pour ${form.prenom || 'ce client'}. ${sectionInstruction} Redige en ${lang}. Ecris directement le contenu sans prefixe ni marqueur.`,
    3000
  );

  return text.trim();
}
