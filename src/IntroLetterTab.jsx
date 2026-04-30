// ─── IntroLetterTab ────────────────────────────────────────────────────
// V94.47 — Authoring de la lettre d'intro personnalisee.
//
// Workflow :
//   1. Bouton "🪄 Generer la lettre" → appel Claude Haiku 4.5
//   2. La lettre apparait dans des champs editables (paragraphes + pull_quote
//      + tailored_points)
//   3. Anissa relit, edite si besoin
//   4. Bouton "💾 Sauvegarder" → consultation.intro_letter
//   5. A la republication, clientAppMapper utilise intro_letter en priorite
//      pour construire intro_data.body (cote app cliente)
// ────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { generateIntroLetter } from "./services/aiIntroLetter";

export default function IntroLetterTab({ consultation, form, onSave }) {
  const initial = consultation?.intro_letter || {};
  const [body, setBody] = useState(Array.isArray(initial.body) ? initial.body : []);
  const [pullQuote, setPullQuote] = useState(initial.pull_quote || "");
  const [points, setPoints] = useState(
    Array.isArray(initial.tailored_points) ? initial.tailored_points : []
  );
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);

  const filled = body.length > 0;

  function updateBodyParagraph(idx, value) {
    setBody((prev) => prev.map((p, i) => (i === idx ? value : p)));
  }
  function addBodyParagraph() {
    setBody((prev) => [...prev, ""]);
  }
  function removeBodyParagraph(idx) {
    setBody((prev) => prev.filter((_, i) => i !== idx));
  }

  function updatePoint(idx, patch) {
    setPoints((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  }
  function addPoint() {
    setPoints((prev) => [...prev, { title: "", detail: "" }]);
  }
  function removePoint(idx) {
    setPoints((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleGenerate() {
    if (generating) return;
    setError(null);
    setGenerating(true);
    try {
      const letter = await generateIntroLetter({ form: form || {}, consultation: consultation || {} });
      setBody(letter.body || []);
      setPullQuote(letter.pull_quote || "");
      setPoints(letter.tailored_points || []);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setGenerating(false);
    }
  }

  function handleSave() {
    if (typeof onSave !== "function") return;
    const cleanBody = body.map((p) => String(p || "").trim()).filter(Boolean);
    const cleanPoints = points
      .map((p) => ({
        title: String(p?.title || "").trim(),
        detail: String(p?.detail || "").trim(),
      }))
      .filter((p) => p.title && p.detail);
    const cleanQuote = pullQuote.trim() || undefined;

    onSave({
      body: cleanBody,
      pull_quote: cleanQuote,
      tailored_points: cleanPoints,
    });
  }

  return (
    <div style={{ padding: "4px 4px 16px" }}>
      {/* Header / actions */}
      <div style={headerStyle}>
        <div>
          <div style={titleStyle}>✉️ Lettre d&apos;intro</div>
          <div style={subtitleStyle}>
            {filled
              ? `${body.length} paragraphe${body.length > 1 ? "s" : ""}`
              : "Pas encore generee"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            className="btn btn-anissa-primary"
            onClick={handleGenerate}
            disabled={generating}
            style={primaryBtnStyle}
          >
            {generating
              ? "Generation…"
              : filled
                ? "🪄 Regenerer"
                : "🪄 Generer la lettre"}
          </button>
          <button
            type="button"
            className="btn btn-anissa-secondary"
            onClick={handleSave}
            disabled={generating || !filled}
            style={secondaryBtnStyle}
          >
            💾 Sauvegarder
          </button>
        </div>
      </div>

      {error && <div style={errorStyle}>⚠ {error}</div>}

      {!filled && !generating && !error && (
        <div style={emptyStyle}>
          Cliquez &quot;Generer la lettre&quot; pour creer une lettre d&apos;intro
          personnalisee. L&apos;IA s&apos;appuie sur le profil de la cliente
          (objectif, antecedents, observations) et le ton signature
          d&apos;Anissa.
        </div>
      )}

      {filled && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 16 }}>
          {/* Body paragraphes */}
          <section>
            <div style={sectionLabelStyle}>Corps de la lettre</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {body.map((p, i) => (
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <span
                    style={{
                      fontSize: ".7rem",
                      color: "#8a8a7a",
                      marginTop: 8,
                      width: 18,
                      flexShrink: 0,
                      textAlign: "right",
                    }}
                  >
                    {i + 1}.
                  </span>
                  <textarea
                    value={p}
                    onChange={(e) => updateBodyParagraph(i, e.target.value)}
                    rows={3}
                    style={textareaStyle}
                  />
                  <button
                    type="button"
                    onClick={() => removeBodyParagraph(i)}
                    title="Supprimer ce paragraphe"
                    style={removeBtnStyle}
                  >
                    ✕
                  </button>
                </div>
              ))}
              {body.length < 5 && (
                <button
                  type="button"
                  onClick={addBodyParagraph}
                  style={addBtnStyle}
                >
                  + Ajouter un paragraphe
                </button>
              )}
            </div>
          </section>

          {/* Pull quote */}
          <section>
            <div style={sectionLabelStyle}>
              Phrase signature <span style={{ color: "#8a8a7a", fontWeight: 400 }}>(optionnel, max ~12 mots)</span>
            </div>
            <textarea
              value={pullQuote}
              onChange={(e) => setPullQuote(e.target.value.slice(0, 200))}
              rows={2}
              placeholder="Votre corps a besoin de constance, pas de perfection."
              style={textareaStyle}
            />
          </section>

          {/* Tailored points */}
          <section>
            <div style={sectionLabelStyle}>
              Ce que votre plan prend en compte <span style={{ color: "#8a8a7a", fontWeight: 400 }}>(2-4 axes)</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {points.map((p, i) => (
                <div
                  key={i}
                  style={{
                    background: "rgba(255,255,255,.025)",
                    border: "1px solid rgba(255,255,255,.06)",
                    borderRadius: 8,
                    padding: 10,
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                  }}
                >
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      type="text"
                      value={p.title}
                      onChange={(e) => updatePoint(i, { title: e.target.value.slice(0, 50) })}
                      placeholder="TITRE EN MAJUSCULES"
                      style={{ ...inputStyle, fontWeight: 500, textTransform: "uppercase" }}
                    />
                    <button
                      type="button"
                      onClick={() => removePoint(i)}
                      title="Supprimer cet axe"
                      style={removeBtnStyle}
                    >
                      ✕
                    </button>
                  </div>
                  <textarea
                    value={p.detail}
                    onChange={(e) => updatePoint(i, { detail: e.target.value.slice(0, 200) })}
                    placeholder="1 phrase qui explique pourquoi cet axe est dans le plan"
                    rows={2}
                    style={textareaStyle}
                  />
                </div>
              ))}
              {points.length < 4 && (
                <button type="button" onClick={addPoint} style={addBtnStyle}>
                  + Ajouter un axe
                </button>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
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
const emptyStyle = {
  marginTop: 16,
  padding: 24,
  textAlign: "center",
  fontSize: ".82rem",
  color: "#8a8a7a",
  background: "rgba(255,255,255,.025)",
  borderRadius: 10,
};
const sectionLabelStyle = {
  fontSize: ".72rem",
  color: "#8a8a7a",
  textTransform: "uppercase",
  letterSpacing: ".08em",
  fontWeight: 600,
  marginBottom: 8,
};
const textareaStyle = {
  flex: 1,
  width: "100%",
  background: "rgba(255,255,255,.04)",
  border: "1px solid rgba(255,255,255,.1)",
  borderRadius: 8,
  padding: "8px 10px",
  color: "#d4c9a8",
  fontSize: ".85rem",
  fontFamily: "inherit",
  resize: "vertical",
  lineHeight: 1.5,
  boxSizing: "border-box",
};
const inputStyle = {
  flex: 1,
  width: "100%",
  background: "rgba(255,255,255,.04)",
  border: "1px solid rgba(255,255,255,.1)",
  borderRadius: 8,
  padding: "6px 10px",
  color: "#d4c9a8",
  fontSize: ".82rem",
  fontFamily: "inherit",
  boxSizing: "border-box",
};
const removeBtnStyle = {
  background: "transparent",
  border: "1px solid rgba(220,80,80,.2)",
  borderRadius: 6,
  padding: "2px 8px",
  color: "#cfcfc4",
  fontSize: ".75rem",
  cursor: "pointer",
  flexShrink: 0,
};
const addBtnStyle = {
  background: "rgba(130,195,158,.06)",
  border: "1px dashed rgba(130,195,158,.3)",
  borderRadius: 8,
  padding: "8px 12px",
  color: "#82c39e",
  fontSize: ".78rem",
  fontWeight: 500,
  cursor: "pointer",
};
