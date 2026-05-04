// ─── RecipesTab ─────────────────────────────────────────────────────────
// V94.42 — Authoring de recettes détaillées pour le plan nutrition.
//
// Workflow Anissa :
//   1. Le plan est rédigé (nutrition_plan textuel)
//   2. Bouton "Générer toutes les recettes" → 1 appel IA Haiku 4.5
//   3. Table éditable par repas (ingrédients, préparation, temps, conseil)
//   4. Sauvegarde dans consultation.meal_recipes (JSON map mealKey → recipe)
//   5. Republication push les recipes au client app via clientAppMapper
//
// Storage : map { [mealKey]: recipe } dans la consultation.
// ─────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from "react";
import { extractMealsAndAlternativesFromPlan } from "./services/extractMealsFromPlan";
import { generateRecipesForMeals } from "./services/aiRecipeGenerator";

export default function RecipesTab({ consultation, form, onSave, onPersistGlobally }) {
  const planText = consultation?.nutrition_plan || consultation?.nutritionPlan || "";

  // V95.4 : extraction des repas principaux ET des alternatives. Anissa
  // génère une seule fois → toutes les recettes (16-20 typiquement) sont
  // enrichies d'un coup. Le client app les lit via meal_recipes lookup
  // (mealKey commun main/alt) → tap sur une alt côté cliente ouvre direct
  // la recette sans attente.
  const meals = useMemo(
    () => extractMealsAndAlternativesFromPlan(planText, "fr"),
    [planText],
  );

  // État local des recettes (key → Recipe)
  const [recipes, setRecipes] = useState(() => consultation?.meal_recipes || {});
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  // V94.55 : feedback visuel apres clic Sauvegarder
  const [savedFlash, setSavedFlash] = useState(false);

  // Re-sync avec la consultation si elle change (changement de cliente, etc.)
  useEffect(() => {
    setRecipes(consultation?.meal_recipes || {});
    setError(null);
  }, [consultation?.id]);

  if (!planText.trim()) {
    return (
      <div style={emptyStyle}>
        Aucun plan nutrition rédigé. Va sur l&apos;onglet &quot;Plan complet&quot; pour
        écrire le plan, puis reviens ici pour générer les recettes.
      </div>
    );
  }

  if (meals.length === 0) {
    return (
      <div style={emptyStyle}>
        Aucun repas détecté dans le plan. Vérifie que les sections de repas
        suivent le format standard (Petit-déjeuner, Déjeuner, Dîner...).
      </div>
    );
  }

  function updateRecipe(key, patch) {
    setRecipes((prev) => ({
      ...prev,
      [key]: { ...(prev[key] || {}), ...patch },
    }));
  }

  function persistRecipes(next) {
    if (typeof onSave === "function") {
      onSave(next);
    }
  }

  async function handleGenerateAll() {
    if (generating) return;
    setError(null);
    setGenerating(true);
    try {
      const generated = await generateRecipesForMeals(meals, {
        form: form || {},
        locale: "fr",
      });
      const merged = { ...recipes, ...generated };
      setRecipes(merged);
      persistRecipes(merged);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setGenerating(false);
    }
  }

  function handleSaveAll() {
    persistRecipes(recipes);
    // V94.55 : flash visuel pour confirmer l'action
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2500);
    // V94.57 : declenche la persistance globale automatiquement.
    if (typeof onPersistGlobally === "function") {
      onPersistGlobally();
    }
  }

  const filledCount = meals.filter((m) => recipes[m.key]?.ingredients?.length).length;

  return (
    <div style={{ padding: "4px 4px 16px" }}>
      {/* Header / actions */}
      <div style={headerStyle}>
        <div>
          <div style={titleStyle}>🍳 Recettes détaillées</div>
          <div style={subtitleStyle}>
            {filledCount}/{meals.length} repas enrichis
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            className="btn btn-anissa-primary"
            onClick={handleGenerateAll}
            disabled={generating}
            style={primaryBtnStyle}
          >
            {generating ? "Génération…" : "🪄 Générer toutes les recettes"}
          </button>
          <button
            type="button"
            className="btn btn-anissa-secondary"
            onClick={handleSaveAll}
            disabled={generating}
            style={{
              ...secondaryBtnStyle,
              ...(savedFlash
                ? {
                    background: "rgba(130,195,158,0.18)",
                    border: "1px solid rgba(130,195,158,0.4)",
                    color: "#82c39e",
                  }
                : {}),
              transition: "all 200ms ease",
            }}
            title="Sauvegarde les recettes dans la consultation"
          >
            {savedFlash ? "✓ Sauvegarde" : "💾 Sauvegarder"}
          </button>
        </div>
      </div>

      {/* V94.55 → V94.57 : flash de confirmation. Avec la fusion V94.57,
          le clic local sauvegarde aussi globalement. */}
      {savedFlash && (
        <div
          style={{
            marginTop: 8,
            padding: "8px 12px",
            background: "rgba(130,195,158,0.08)",
            border: "1px solid rgba(130,195,158,0.25)",
            color: "#82c39e",
            fontSize: ".75rem",
            borderRadius: 8,
          }}
        >
          ✓ Recettes sauvegardées.
        </div>
      )}

      {error && (
        <div style={errorStyle}>
          ⚠ {error}
        </div>
      )}

      {/* Cards de recettes — V95.4 : groupees par slot, badge 'alternative' */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
        {meals.map((m) => (
          <RecipeCard
            key={m.key}
            meal={m}
            recipe={recipes[m.key]}
            onChange={(patch) => updateRecipe(m.key, patch)}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Card recette pour 1 repas ──────────────────────────────────────────

function RecipeCard({ meal, recipe = {}, onChange }) {
  const [expanded, setExpanded] = useState(false);
  const isFilled = !!recipe.ingredients?.length;
  const ingredientsText = (recipe.ingredients || []).join("\n");
  const preparationText = (recipe.preparation || []).join("\n");

  function updateIngredients(text) {
    const arr = String(text || "").split("\n").map((l) => l.trim()).filter(Boolean);
    onChange({ ingredients: arr });
  }
  function updatePreparation(text) {
    const arr = String(text || "").split("\n").map((l) => l.trim()).filter(Boolean);
    onChange({ preparation: arr });
  }

  return (
    <div style={cardStyle}>
      {/* Header card */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        style={cardHeaderStyle}
      >
        <div style={{ flex: 1, textAlign: "left" }}>
          <div style={{ fontSize: ".7rem", color: "#8a8a7a", textTransform: "uppercase", letterSpacing: ".05em", display: "flex", alignItems: "center", gap: 6 }}>
            {meal.slot_label}
            {/* V95.4 : badge discret pour les alternatives */}
            {meal.kind === "alt" && (
              <span
                style={{
                  fontSize: ".6rem",
                  fontWeight: 600,
                  color: "#c4a050",
                  letterSpacing: ".06em",
                  background: "rgba(196,160,80,.1)",
                  border: "1px solid rgba(196,160,80,.2)",
                  padding: "1px 6px",
                  borderRadius: 999,
                }}
              >
                ALTERNATIVE
              </span>
            )}
          </div>
          <div style={{ fontSize: ".95rem", color: "#cfcfc4", fontWeight: 500, marginTop: 2 }}>
            {meal.title}
          </div>
          {meal.kind === "alt" && meal.hint && (
            <div style={{ fontSize: ".75rem", color: "#8a8a7a", marginTop: 2, fontStyle: "italic" }}>
              {meal.hint}
            </div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              padding: "2px 8px",
              fontSize: ".68rem",
              fontWeight: 600,
              color: isFilled ? "#82c39e" : "#8a8a7a",
              background: isFilled ? "rgba(130,195,158,.12)" : "rgba(255,255,255,.03)",
              border: `1px solid ${isFilled ? "rgba(130,195,158,.25)" : "rgba(255,255,255,.06)"}`,
              borderRadius: 999,
              textTransform: "uppercase",
              letterSpacing: ".05em",
            }}
          >
            {isFilled ? "Recette OK" : "Vide"}
          </span>
          <span style={{ color: "#8a8a7a", fontSize: ".85rem" }}>
            {expanded ? "▾" : "▸"}
          </span>
        </div>
      </button>

      {/* Body editable */}
      {expanded && (
        <div style={cardBodyStyle}>
          <Field label="Ingrédients (1 par ligne)">
            <textarea
              value={ingredientsText}
              onChange={(e) => updateIngredients(e.target.value)}
              placeholder="120 g de saumon&#10;1/2 avocat mûr&#10;..."
              rows={6}
              style={textareaStyle}
            />
          </Field>

          <Field label="Préparation (1 étape par ligne)">
            <textarea
              value={preparationText}
              onChange={(e) => updatePreparation(e.target.value)}
              placeholder="Faire cuire le riz...&#10;Pendant ce temps, ..."
              rows={6}
              style={textareaStyle}
            />
          </Field>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            <Field label="Prep. (min)">
              <input
                type="number"
                min={0}
                value={recipe.prep_time_min ?? ""}
                onChange={(e) => onChange({ prep_time_min: e.target.value === "" ? undefined : Number(e.target.value) })}
                style={inputStyle}
              />
            </Field>
            <Field label="Cuisson (min)">
              <input
                type="number"
                min={0}
                value={recipe.cook_time_min ?? ""}
                onChange={(e) => onChange({ cook_time_min: e.target.value === "" ? undefined : Number(e.target.value) })}
                style={inputStyle}
              />
            </Field>
            <Field label="Parts">
              <input
                type="number"
                min={1}
                value={recipe.servings ?? ""}
                onChange={(e) => onChange({ servings: e.target.value === "" ? undefined : Number(e.target.value) })}
                style={inputStyle}
              />
            </Field>
          </div>

          <Field label="Le conseil d'Anissa">
            <textarea
              value={recipe.tip || ""}
              onChange={(e) => onChange({ tip: e.target.value.slice(0, 250) })}
              placeholder="1 phrase signature : pourquoi ce repas est bénéfique."
              rows={2}
              style={textareaStyle}
            />
          </Field>
        </div>
      )}
    </div>
  );
}

// ─── Atomes UI ──────────────────────────────────────────────────────────

function Field({ label, children }) {
  return (
    <label style={{ display: "block" }}>
      <div style={{ fontSize: ".7rem", color: "#8a8a7a", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 4 }}>
        {label}
      </div>
      {children}
    </label>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────

const headerStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
};

const titleStyle = {
  fontSize: "1rem",
  color: "#cfcfc4",
  fontWeight: 600,
};

const subtitleStyle = {
  fontSize: ".75rem",
  color: "#8a8a7a",
  marginTop: 2,
};

const primaryBtnStyle = {
  padding: "7px 14px",
  borderRadius: 8,
  fontSize: ".8rem",
  fontWeight: 500,
};

const secondaryBtnStyle = {
  padding: "7px 14px",
  borderRadius: 8,
  fontSize: ".8rem",
};

const errorStyle = {
  marginTop: 12,
  padding: "10px 14px",
  background: "rgba(220,80,80,.08)",
  border: "1px solid rgba(220,80,80,.25)",
  color: "#f5c6c6",
  fontSize: ".8rem",
  borderRadius: 8,
};

const cardStyle = {
  background: "rgba(255,255,255,.025)",
  border: "1px solid rgba(255,255,255,.06)",
  borderRadius: 10,
  overflow: "hidden",
};

const cardHeaderStyle = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "12px 14px",
  background: "transparent",
  border: "none",
  cursor: "pointer",
  textAlign: "left",
};

const cardBodyStyle = {
  display: "flex",
  flexDirection: "column",
  gap: 12,
  padding: "0 14px 14px",
  borderTop: "1px solid rgba(255,255,255,.04)",
  paddingTop: 14,
};

const textareaStyle = {
  width: "100%",
  background: "rgba(255,255,255,.04)",
  border: "1px solid rgba(255,255,255,.1)",
  borderRadius: 8,
  padding: "8px 10px",
  color: "#d4c9a8",
  fontSize: ".82rem",
  fontFamily: "inherit",
  resize: "vertical",
  lineHeight: 1.5,
};

const inputStyle = {
  width: "100%",
  background: "rgba(255,255,255,.04)",
  border: "1px solid rgba(255,255,255,.1)",
  borderRadius: 8,
  padding: "6px 10px",
  color: "#d4c9a8",
  fontSize: ".82rem",
  fontFamily: "inherit",
};

const emptyStyle = {
  padding: 24,
  textAlign: "center",
  fontSize: ".82rem",
  color: "#8a8a7a",
  background: "rgba(255,255,255,.025)",
  borderRadius: 10,
  margin: 12,
};
