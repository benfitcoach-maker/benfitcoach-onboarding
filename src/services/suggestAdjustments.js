// ─── suggestAdjustments.js ──────────────────────────────────────────────
// Règles déterministes feedback → suggestions d'ajustement.
//
// PRINCIPE : aucune IA, aucune décision médicale. Juste des pistes de
// réflexion pour Anissa, basées sur les patterns classiques. Anissa garde
// 100% du contrôle — c'est elle qui décide de modifier ou pas le plan.
//
// Chaque règle produit { axis, level, message } :
//   - axis    : "digestion" | "faim" | "energie" | "fatigue"
//   - level   : "info" (continuer) | "watch" (surveiller) | "act" (agir)
//   - message : phrase courte actionnable
//
// Cette pureté permet de tester facilement et de garder le rendu UI
// trivialement réactif.

/**
 * @param {object} summary - retour de summarizeFeedbacks()
 * @returns {{ readings: array, suggestions: array, tone: string }}
 */
export function suggestAdjustments(summary) {
  if (!summary) return { readings: [], suggestions: [], tone: "neutral" };

  const readings = [];
  const suggestions = [];

  // ─── DIGESTION ────────────────────────────────────────────────────────
  if (summary.digestion === "worse") {
    readings.push({ axis: "digestion", text: "Digestion dégradée", tone: "act" });
    suggestions.push({
      axis: "digestion",
      level: "act",
      message:
        "Réduire les fibres crues, privilégier cuissons douces (vapeur, mijoté), simplifier les associations alimentaires.",
    });
  } else if (summary.digestion === "better") {
    readings.push({ axis: "digestion", text: "Digestion en amélioration", tone: "info" });
    suggestions.push({
      axis: "digestion",
      level: "info",
      message:
        "Possibilité de réintroduire progressivement le cru (1 portion/jour pour commencer).",
    });
  } else if (summary.digestion === "same") {
    readings.push({ axis: "digestion", text: "Digestion stable", tone: "watch" });
  }

  // ─── FAIM ─────────────────────────────────────────────────────────────
  if (summary.faim === "high") {
    readings.push({ axis: "faim", text: "Faim trop fréquente", tone: "act" });
    suggestions.push({
      axis: "faim",
      level: "act",
      message:
        "Augmenter les portions de protéines et bons gras aux repas, vérifier la satiété (collation protéinée si besoin).",
    });
  } else if (summary.faim === "low") {
    readings.push({ axis: "faim", text: "Faim faible", tone: "watch" });
    suggestions.push({
      axis: "faim",
      level: "watch",
      message:
        "Vérifier que la cliente ne saute pas de repas, contrôler l'apport calorique global.",
    });
  } else if (summary.faim === "ok") {
    readings.push({ axis: "faim", text: "Faim équilibrée", tone: "info" });
  }

  // ─── ÉNERGIE ──────────────────────────────────────────────────────────
  if (summary.energie === "low") {
    readings.push({ axis: "energie", text: "Énergie basse", tone: "act" });
    suggestions.push({
      axis: "energie",
      level: "act",
      message:
        "Revoir le timing des glucides (autour de l'effort), vérifier hydratation, sommeil et apports en magnésium.",
    });
  } else if (summary.energie === "good") {
    readings.push({ axis: "energie", text: "Énergie favorable", tone: "info" });
  } else if (summary.energie === "ok") {
    readings.push({ axis: "energie", text: "Énergie stable", tone: "info" });
  }

  // ─── FATIGUE ──────────────────────────────────────────────────────────
  if (summary.fatigue === "worse") {
    readings.push({ axis: "fatigue", text: "Fatigue accentuée", tone: "act" });
    suggestions.push({
      axis: "fatigue",
      level: "act",
      message:
        "Vérifier la charge globale (sommeil, stress, entraînement). Envisager un soutien ponctuel : magnésium, adaptogènes, qualité du sommeil.",
    });
  } else if (summary.fatigue === "better") {
    readings.push({ axis: "fatigue", text: "Fatigue en recul", tone: "info" });
  } else if (summary.fatigue === "same") {
    readings.push({ axis: "fatigue", text: "Fatigue stable", tone: "watch" });
  }

  // ─── Cas par défaut : aucun signal "act" → message rassurant ─────────
  if (suggestions.length === 0 && readings.length > 0) {
    suggestions.push({
      axis: null,
      level: "info",
      message:
        "Continuer la structure actuelle. Les signaux sont stables ou favorables.",
    });
  }

  // Ton global de la lecture
  const hasAct = readings.some((r) => r.tone === "act");
  const hasWatch = readings.some((r) => r.tone === "watch");
  const tone = hasAct ? "act" : hasWatch ? "watch" : readings.length ? "info" : "neutral";

  return { readings, suggestions, tone };
}
