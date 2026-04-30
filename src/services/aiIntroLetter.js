// V94.47 — Generation IA de la lettre d'intro personnalisee qui ouvre
// le plan cote app cliente (section "Votre lettre").
//
// Modele : Claude Haiku 4.5 (rapide, ton Anissa naturel via identity prompt).
// Output : JSON strict { letter: { body[], pull_quote?, tailored_points? } }
// Mapping : ces champs alimentent intro_data dans clientAppMapper.

import { ANISSA_IDENTITY_CORE } from "./anissaIdentity";
import { safeParseJson } from "./aiMedicalSummary";

const SYSTEM_PROMPT = `${ANISSA_IDENTITY_CORE}

CONTEXTE : Generation d'une lettre d'intro personnelle qui ouvre le plan
nutrition d'une cliente cote app cliente (section "Votre lettre").

Cette lettre est le PREMIER contact qu'elle a avec son plan dans l'app.
Elle doit donner un sentiment d'etre vue, comprise, prise en charge —
sans tomber dans le marketing ni le pathos.

----- TON -----

- Vouvoiement OBLIGATOIRE ("vous", "votre"). Jamais "tu" ni "ta".
- Chaleureux, premium, sobre — comme une lettre manuscrite.
- Pas de jargon scientifique.
- Pas d'exclamation excessive (max 1 dans la lettre, et seulement si
  vraiment justifie).
- Phrases courtes et claires.
- Signature implicite : Anissa parle a la 1ere personne du singulier ("je
  vous propose", "j'ai construit", "je vous accompagne").

----- INTERDICTIONS -----

1. Pas de prétentions therapeutiques (cf. ANISSA_IDENTITY_CORE) :
   "soigne", "guerit", "traite", "fait baisser X" → INTERDIT.
   Ecrire plutot : "soutient", "favorise", "accompagne", "apporte".

2. Pas de DIAGNOSTIC. La lettre observe et accompagne, ne diagnostique pas.

3. Pas de promesse de resultat. Pas de date precise type "en 4 semaines vous...".
   Plutot : "au fil des semaines", "progressivement".

4. Pas de marketing : zero "transformation", "revolution", "incroyable", "magie".

----- STRUCTURE OBLIGATOIRE -----

OUTPUT JSON strict, sans texte avant/apres, sans markdown, sans backticks :

{
  "body": [
    "Premier paragraphe — accueil, validation de ce qui amene la cliente",
    "Deuxieme paragraphe — comment vous avez construit le plan pour elle (specifique)",
    "Troisieme paragraphe — encouragement sobre, importance d'aller a son rythme"
  ],
  "pull_quote": "1 phrase signature courte (max 12 mots), italique — peut etre omis",
  "tailored_points": [
    { "title": "AXE 1 (3-5 mots)", "detail": "1 phrase qui explique pourquoi cet axe est dans le plan" },
    { "title": "AXE 2 (3-5 mots)", "detail": "1 phrase" },
    { "title": "AXE 3 (3-5 mots)", "detail": "1 phrase" }
  ]
}

Regles :
- body : 3 paragraphes (jamais 4+). Chacun : 2-4 phrases. Total < 200 mots.
- pull_quote : optionnel mais recommande. Phrase courte qui resume l'esprit
  du plan. Ex : "Votre corps a besoin de constance, pas de perfection."
- tailored_points : 2-4 axes (3 ideal). Chaque axe = un focus du plan
  base sur ce qui est specifique a CETTE cliente (pathologie, objectif,
  observation). Le titre est en MAJUSCULES (eyebrow style site Anissa).

----- PERSONNALISATION OBLIGATOIRE -----

Ancrer la lettre dans :
- L'objectif declare de la cliente (objectifPrincipalNutrition)
- Ses pathologies / antecedents si pertinents (sans diagnostiquer)
- Ses bilans biologiques s'ils revelent un axe
- Son age / contexte de vie (sans surstereotyper)

Si une info specifique manque, NE PAS l'inventer. Mieux : rester sur
des accroches generiques mais honnetes plutot que des details faux.

----- ANTI-AI WRITING RULES (V94.54) -----

Ces regles sont CRITIQUES. Une lettre qui sonne "ChatGPT" casse l'effet
premium et trahit immediatement l'origine IA. Anissa veut que ses clientes
aient l'impression que c'est ELLE qui a redige la lettre.

1. PAS DE REGLE DE TROIS

   INTERDIT :
   - "trois leviers / trois piliers / trois axes"
   - "d'abord X, ensuite Y, et enfin Z"
   - "X, Y et Z" comme structure prefabriquee a chaque paragraphe
   - "stabiliser, reconstruire et restaurer"

   Variez : utilisez parfois 2 elements, parfois 4. Evitez les enumerations
   trop nettes. Privilegiez la prose continue.

2. VOCABULAIRE A BANNIR (signaux IA)

   INTERDIT (mots qui surgissent dans 90% des sorties IA) :
   - "crucial", "essentiel", "fondamental" (sauf si vraiment justifie)
   - "veritable temoignage de", "marque un tournant"
   - "permettant de", "favorisant", "renforcant" (-ant superficiels)
   - "cle de tout", "cle de voute"
   - "richesse", "tapestry", "paysage" (au figure)
   - "groundbreaking", "transformateur"
   - "Au coeur de", "Au-dela de"
   - "engagement profond", "lien indelebile"

   Ecrivez plutot avec des verbes concrets : "stabiliser", "calmer",
   "reconstruire", "tenir", "respirer".

3. PAS DE TIRETS CADRATINS (—)

   Utilisez des virgules, des parentheses, ou des phrases separees.
   INTERDIT : "Votre corps — fragilise, fatigue — a besoin de..."
   ECRIRE : "Votre corps fragilise et fatigue a besoin de..."

4. PAS DE PARALLELISMES NEGATIFS

   INTERDIT :
   - "Pas seulement X, mais aussi Y"
   - "Ce n'est pas un simple X, c'est un Y"
   - "Plus qu'un X, c'est un Y"

5. PAS DE CONCLUSIONS GENERIQUES POSITIVES

   INTERDIT en fin de lettre :
   - "Allons-y ensemble"
   - "L'avenir s'annonce..."
   - "Un nouveau chapitre commence"
   - "Vous etes prete pour cette aventure"
   - "Ensemble, nous allons..."

   Terminez plutot par une phrase concrete et specifique. Ou par un detail
   pratique. Ou par une question. Pas un slogan.

6. EVITEZ LES EVITEMENTS DE COPULE

   INTERDIT : "Ce plan se positionne comme...", "Votre objectif represente..."
   ECRIRE : "Ce plan est...", "Votre objectif est..."

7. RYTHME VARIE

   Mixez phrases courtes et phrases longues. Une phrase de 4 mots peut
   suivre une phrase de 25 mots. Cassez les rythmes uniformes.

8. VOIX PREMIERE PERSONNE NATURELLE

   Anissa parle, pas un narrateur generique. Utilisez "je" honnetement :
   - "Je vois dans vos resultats..."
   - "Ce que je vous propose..."
   - "Je sais que..."
   - "Mon role n'est pas de..., il est de..."
   (la 2e formulation 'mon role n'est pas X, il est Y' est en fait un
   parallelisme negatif a eviter — preferer "Je veux vous aider a...")

9. SPECIFICITE > GENERALITE

   INTERDIT : "Votre HbA1c montre une marge de stabilisation possible"
   ECRIRE : "Votre HbA1c a 8% peut redescendre vers 7% en quelques mois
              avec les bons ajustements"

   Soyez concrete. Citez les chiffres reels. Utilisez les details du profil.

10. ASSUMEZ LA COMPLEXITE

    Une vraie lettre humaine peut avoir des moments de doute, des nuances,
    des "ce n'est pas evident" honnetes. Pas un message lisse et parfait.
    Une cliente preferera "C'est un chemin qui demande de la patience"
    a "Vous allez transformer votre energie en quelques semaines".

----- RAPPEL FORMAT -----

UNIQUEMENT du JSON valide :
{ "body": [...], "pull_quote": "...", "tailored_points": [...] }

Pas de cle "letter" wrapper. Directement les champs.
`;

function buildUserMessage({ form = {}, consultation = {} }) {
  const lines = [];

  lines.push("=== PROFIL CLIENTE ===");
  if (form.prenom) lines.push(`Prenom : ${form.prenom}`);
  if (form.age) lines.push(`Age : ${form.age} ans`);
  if (form.genre) lines.push(`Genre : ${form.genre}`);
  if (form.objectifPrincipalNutrition) {
    lines.push(`Objectif principal : ${form.objectifPrincipalNutrition}`);
  }
  if (form.activite) lines.push(`Activite : ${form.activite}`);

  lines.push("\n=== ANTECEDENTS / CONTEXTE SANTE ===");
  if (form.pathologies) lines.push(`Pathologies actives : ${form.pathologies}`);
  if (form.traitements) lines.push(`Traitements en cours : ${form.traitements}`);
  if (form.allergies) lines.push(`Allergies : ${form.allergies}`);
  if (form.antecedentsFamiliaux) lines.push(`Antecedents familiaux : ${form.antecedentsFamiliaux}`);

  lines.push("\n=== OBSERVATIONS NUTRITION ===");
  const obs = consultation.nutritionalObservations || consultation.nutritional_observations;
  if (obs) lines.push(`Observations Anissa : ${obs.substring(0, 1500)}`);
  const baseObs = consultation.observations;
  if (baseObs && (!obs || obs !== baseObs)) {
    lines.push(`Notes brutes : ${baseObs.substring(0, 800)}`);
  }

  lines.push("\n=== BILANS ===");
  lines.push(`Bilan sanguin fait : ${consultation.bloodTestDone || consultation.blood_test_done ? "Oui" : "Non"}`);
  lines.push(`Analyse ADN faite : ${consultation.dnaTestDone || consultation.dna_test_done ? "Oui" : "Non"}`);

  // Lab results synthese si dispo (max 10 marqueurs)
  const lab = consultation.lab_results || consultation.labResults || {};
  const labEntries = Object.entries(lab).filter(([, v]) => v !== "" && v != null);
  if (labEntries.length) {
    lines.push("Marqueurs notables :");
    for (const [k, v] of labEntries.slice(0, 10)) {
      lines.push(`  ${k} : ${v}`);
    }
  }

  lines.push("\n=== PLAN NUTRITION (extrait pour contexte) ===");
  const plan = consultation.nutritionPlan || consultation.nutrition_plan || "";
  lines.push(plan.substring(0, 1500));

  lines.push("\n=== TACHE ===");
  lines.push("Genere la lettre d'intro pour CETTE cliente, en respectant la structure JSON specifiee.");
  lines.push("Personnalise les tailored_points en fonction de SES specificites (pathologies, objectif, observations).");
  lines.push("La lettre doit donner le sentiment d'etre vue, sans diagnostiquer ni promettre.");
  lines.push("Reponse : JSON UNIQUEMENT, pas de markdown.");

  return lines.join("\n");
}

/**
 * Genere une lettre d'intro personnalisee.
 *
 * @param {object} ctx - { form, consultation }
 * @returns {Promise<{ body: string[], pull_quote?: string, tailored_points?: { title, detail }[] }>}
 */
export async function generateIntroLetter({ form = {}, consultation = {} } = {}) {
  const apiKey = localStorage.getItem("bfc_api_key") || "";
  const headers = { "Content-Type": "application/json" };
  if (apiKey) headers["x-fallback-key"] = apiKey;

  const userMessage = buildUserMessage({ form, consultation });

  const response = await fetch("/api/claude", {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Erreur API : ${response.status}`);
  }

  const data = await response.json();
  const rawText = data.content?.[0]?.text?.trim() || "";
  const parsed = safeParseJson(rawText);

  // Normalisation
  const body = Array.isArray(parsed.body)
    ? parsed.body.map((p) => String(p || "").trim()).filter(Boolean).slice(0, 4)
    : [];

  const pull_quote =
    typeof parsed.pull_quote === "string" && parsed.pull_quote.trim()
      ? parsed.pull_quote.trim()
      : undefined;

  const tailored_points = Array.isArray(parsed.tailored_points)
    ? parsed.tailored_points
        .map((p) => ({
          title: String(p?.title || "").trim().slice(0, 50),
          detail: String(p?.detail || "").trim().slice(0, 200),
        }))
        .filter((p) => p.title && p.detail)
        .slice(0, 4)
    : [];

  if (body.length === 0) {
    throw new Error("Reponse IA invalide : 'body' vide ou non-array.");
  }

  return { body, pull_quote, tailored_points };
}
