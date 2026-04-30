// V94.42 — Generation IA batch de recettes detaillees pour un plan
// Output strict JSON pour matching deterministe avec les meals existants.
// Modele : Claude Haiku 4.5 (rapide, economique, niveau OK pour recettes).
//
// Usage cote SaaS :
//   const recipes = await generateRecipesForMeals(meals, { form, allergies, locale });
//   // recipes = { [mealKey]: { ingredients, preparation, prep_time_min, ... } }
//
// Le generateur respecte STRICTEMENT les ingredients du titre du repas (pas
// d'inventions). Si la cliente a des allergies/regimes, on les transmet et l'IA
// les respecte (pas de gluten, vegetarien, etc.).

import { ANISSA_IDENTITY_CORE } from "./anissaIdentity";
import { safeParseJson } from "./aiMedicalSummary";

const SYSTEM_PROMPT = `${ANISSA_IDENTITY_CORE}

CONTEXTE : Generation de recettes detaillees pour le plan nutrition d'une
cliente. Anissa peaufine ce plan avant publication dans son app cliente.

TON : pratique, rassurant, signature Anissa. Phrases courtes. Tutoiement
proscrit (Anissa vouvoie ses clientes).

----- TES OBLIGATIONS -----

Pour CHAQUE repas fourni dans la liste, generer une recette EXPLOITANT
EXCLUSIVEMENT les ingredients implicites du titre + les regles ci-dessous.

1. INGREDIENTS
   - Liste a puces simple (sans markdown, juste array de strings)
   - 5 a 10 ingredients
   - Quantites realistes pour 1 personne (sauf si "servings" sup. demande)
   - Format : "120 g de saumon", "1/2 avocat mur", "1 c.s. huile olive"
   - PAS d'ingredients exotiques ou rares non mentionnes dans le titre

2. PREPARATION
   - Liste numerotee (array de strings, 4 a 7 etapes)
   - Etapes courtes et concretes (1-2 phrases max chacune)
   - Verbes d'action en debut (Faire cuire, Emincer, Dresser, Arroser...)
   - Vouvoiement : "Faites cuire", PAS "fais cuire"

3. TEMPS
   - prep_time_min : entier (preparation hors cuisson)
   - cook_time_min : entier (cuisson, 0 si pas de cuisson)
   - servings : entier (1 par defaut sauf indication contraire)

4. CONSEIL D'ANISSA (tip)
   - 1 phrase courte (max 25 mots)
   - Lie l'aliment a un benefice nutritionnel concret
   - Style signature site Anissa : "soutien", "apport", "favorise", JAMAIS
     "soigne / guerit / traite"
   - Exemple OK : "Le saumon contient des omega-3 qui apaisent l'inflammation
     digestive. Preferez-le frais et peu cuit."

----- ANTI-AI WRITING (V94.54) -----

Le "tip" (conseil d'Anissa) doit sonner humain, pas ChatGPT.

INTERDIT dans les tips :
- "Veritable allie de", "joue un role cle", "cle de voute"
- "richesse en", "vibrant", "groundbreaking"
- Listes avec "et" final mecanique : "X, Y et Z"
- Tirets cadratins (—), preferer virgules
- "Ce n'est pas seulement X, mais aussi Y" (parallelisme negatif)
- Conclusions generiques : "Pour un bien-etre optimal", "Une excellente
  facon de prendre soin de vous"

ECRIRE plutot des tips concrets et specifiques :
- "Le saumon contient des omega-3 qui apaisent l'inflammation digestive."
  (factuel, court, specifique)
- "Preferez l'avocat bien mur pour une digestion plus facile."
- "Le riz basmati a un index glycemique modere, parfait avant un effort."

Pas de "trois ingredients pour" / "trois bienfaits". Variez le nombre.
Voix d'Anissa : pratique, posee, sans emphase commerciale.

----- ALLERGIES & REGIMES -----

Si le profil cliente mentionne des allergies (gluten, lactose, fruits a coque,
etc.) ou un regime (vegetarien, sans porc, etc.) : ADAPTER les ingredients et
substituer ce qui est incompatible. Ne JAMAIS suggerer un ingredient interdit.

----- OUTPUT -----

UNIQUEMENT du JSON valide, sans texte avant/apres, sans markdown, sans backticks.

{
  "recipes": {
    "[mealKey]": {
      "ingredients": ["string", ...],
      "preparation": ["string", ...],
      "prep_time_min": int,
      "cook_time_min": int,
      "servings": int,
      "tip": "string"
    },
    ...
  }
}

La cle de chaque recette DOIT etre EXACTEMENT le "key" du repas tel que fourni
dans le user message. Aucune autre cle ne doit etre presente.

REGLE ABSOLUE : si le titre d'un repas est trop generique ou ambigu (ex. "Repas
libre"), genere quand meme une recette par defaut adaptee au slot horaire,
mais reste sobre.
`;

function buildUserMessage({ meals, form, locale = "fr" }) {
  const lines = [];

  lines.push("=== PROFIL CLIENTE ===");
  if (form?.prenom) lines.push(`Prenom : ${form.prenom}`);
  if (form?.objectifPrincipalNutrition) lines.push(`Objectif : ${form.objectifPrincipalNutrition}`);
  lines.push("");

  lines.push("=== ALLERGIES & REGIMES ===");
  if (form?.allergies) lines.push(`Allergies declarees : ${form.allergies}`);
  if (form?.alimentsEvites) lines.push(`Aliments evites : ${form.alimentsEvites}`);
  if (form?.pathologies) lines.push(`Pathologies actives : ${form.pathologies}`);
  if (!form?.allergies && !form?.alimentsEvites && !form?.pathologies) {
    lines.push("Aucune allergie ou restriction declaree.");
  }
  lines.push("");

  lines.push("=== LOCALE ===");
  lines.push(locale === "en" ? "english" : "francais");
  lines.push("");

  lines.push("=== REPAS A ENRICHIR ===");
  for (const m of meals) {
    lines.push(`- key: ${m.key}`);
    lines.push(`  slot: ${m.slot} (${m.slot_label})`);
    lines.push(`  titre: ${m.title}`);
    if (m.hint) lines.push(`  hint: ${m.hint}`);
    lines.push("");
  }

  lines.push("=== TACHE ===");
  lines.push("Genere les recettes en JSON strict selon le format specifie.");
  lines.push(`Le JSON doit contenir EXACTEMENT ${meals.length} cles dans "recipes",`);
  lines.push("une par repas, avec EXACTEMENT le 'key' fourni ci-dessus.");

  return lines.join("\n");
}

/**
 * Genere des recettes detaillees pour une liste de repas.
 *
 * @param {Array<{ key, slot, slot_label, title, hint? }>} meals
 * @param {object} ctx - { form, locale }
 * @returns {Promise<Object<string, Recipe>>} - map mealKey → recipe
 */
export async function generateRecipesForMeals(meals, { form = {}, locale = "fr" } = {}) {
  if (!Array.isArray(meals) || meals.length === 0) {
    throw new Error("Aucun repas a enrichir.");
  }

  const apiKey = localStorage.getItem("bfc_api_key") || "";
  const headers = { "Content-Type": "application/json" };
  if (apiKey) headers["x-fallback-key"] = apiKey;

  const userMessage = buildUserMessage({ meals, form, locale });

  // V94.42 : on chunke si beaucoup de meals (>15) pour rester sous le token budget.
  // Pour la V1, on accepte jusqu'a 25 meals en 1 appel (Haiku gere 200K context).
  if (meals.length > 25) {
    throw new Error("Trop de repas pour un seul appel (max 25). Decoupez en lots.");
  }

  const response = await fetch("/api/claude", {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4000,
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

  const recipes = parsed.recipes || {};
  if (typeof recipes !== "object") {
    throw new Error("Reponse IA invalide : 'recipes' manquant ou non-objet.");
  }

  // Normaliser et filtrer les recettes valides
  const out = {};
  for (const meal of meals) {
    const r = recipes[meal.key];
    if (!r || typeof r !== "object") continue;
    out[meal.key] = {
      ingredients: Array.isArray(r.ingredients) ? r.ingredients.filter(Boolean).slice(0, 15) : [],
      preparation: Array.isArray(r.preparation) ? r.preparation.filter(Boolean).slice(0, 10) : [],
      prep_time_min: typeof r.prep_time_min === "number" ? Math.max(0, Math.round(r.prep_time_min)) : undefined,
      cook_time_min: typeof r.cook_time_min === "number" ? Math.max(0, Math.round(r.cook_time_min)) : undefined,
      servings: typeof r.servings === "number" ? Math.max(1, Math.round(r.servings)) : undefined,
      tip: typeof r.tip === "string" ? r.tip.trim().slice(0, 250) : undefined,
    };
  }

  return out;
}
