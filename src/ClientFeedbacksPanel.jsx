// ─── ClientFeedbacksPanel ──────────────────────────────────────────────
// Affiche le ressenti 7 jours d'une cliente directement dans la fiche
// consultation du SaaS. Lecture seule. Auto-collapse si pas de feedbacks
// pour éviter le bruit visuel.
//
// Affichage :
//   - 4 axes avec valeur majoritaire (icône + label coloré)
//   - Notes des 7 derniers jours (date + texte)
//   - Date du dernier envoi
//
// Si aucun feedback : message neutre "Aucun ressenti pour le moment".

import { Component, useEffect, useMemo, useState } from "react";
import { fetchClientFeedbacks, summarizeFeedbacks } from "./services/fetchClientFeedbacks";
import { suggestAdjustments } from "./services/suggestAdjustments";
import {
  aiSuggestAdjustment,
  SuggestConfigError,
  SuggestHttpError,
} from "./services/aiSuggestAdjustment";
import { sendCoachMessage, CoachMessageError } from "./services/sendCoachMessage";
import { computeFeedbackTrends, compareAxisTrend } from "./services/feedbackTrends";

// Palette badges tendance (cohérente avec VALUE_META existant)
const TREND_STATUS_STYLE = {
  stable: { bg: "rgba(130,195,158,.10)", border: "rgba(130,195,158,.35)", color: "#82c39e" },
  watch:  { bg: "rgba(201,169,106,.12)", border: "rgba(201,169,106,.40)", color: "#c9a96a" },
  adjust: { bg: "rgba(232,144,144,.12)", border: "rgba(232,144,144,.40)", color: "#e89090" },
};

// Indicateur d'évolution vs plan précédent — UX pro :
//   - improved : ↗ vert doux  (stable couleur cohérente avec badge stable)
//   - same     : → gris neutre (pas de drama si statut inchangé)
//   - degraded : ↘ ambre/orange doux (signal léger sans alarme)
//   - unknown  : pas affiché du tout (évite "—" qui ferait sale)
const EVOLUTION_STYLE = {
  improved: { arrow: "↗", color: "#82c39e", short: "amélioration" },
  same:     { arrow: "→", color: "#8a8a7a", short: "inchangé"     },
  degraded: { arrow: "↘", color: "#e89090", short: "dégradation"  },
};

const AXIS_EMOJI = {
  fatigue:   "😴",
  digestion: "🌿",
  faim:      "🍽",
  energie:   "⚡",
};

// ─── Error Boundary défensif ────────────────────────────────────────────
// Évite qu'une erreur dans le bloc IA fasse écran noir dans tout le SaaS.
// Affiche un message lisible + log console pour debug.
class AiBlockErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error("[ClientFeedbacksPanel/AiBlock] crash:", error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 8,
            background: "rgba(220,80,80,.08)",
            border: "1px solid rgba(220,80,80,.25)",
            color: "#f5c6c6",
            fontSize: ".82rem",
          }}
        >
          ✗ Erreur dans le bloc IA d&apos;ajustement : {String(this.state.error?.message || this.state.error)}
          <br />
          <span style={{ fontSize: ".7rem", color: "#8a8a7a" }}>
            (Ouvre la console F12 pour le détail. Le reste du SaaS reste utilisable.)
          </span>
        </div>
      );
    }
    return this.props.children;
  }
}

const AXIS_META = {
  fatigue:   { emoji: "😴", label: "Fatigue" },
  digestion: { emoji: "🌿", label: "Digestion" },
  faim:      { emoji: "🍽", label: "Faim" },
  energie:   { emoji: "⚡", label: "Énergie" },
};

// Map valeur → { libellé, couleur } selon l'axe.
// Vert = positif/stable, ambre = neutre/léger, rouge = problème.
const VALUE_META = {
  // change axes (fatigue, digestion)
  better: { label: "↗ Mieux",    color: "#82c39e" },
  same:   { label: "→ Stable",    color: "#c9a96a" },
  worse:  { label: "↘ Pire",     color: "#e89090" },
  // intensity (faim)
  low:    { label: "Pas assez",  color: "#e89090" },
  ok:     { label: "OK",          color: "#82c39e" },
  high:   { label: "Trop",       color: "#e89090" },
  // energy (energie) — ok partagé avec faim, low partagé, good unique
  good:   { label: "Bonne",      color: "#82c39e" },
};

export default function ClientFeedbacksPanel({ client, consultation }) {
  const [state, setState] = useState({ status: "loading" });
  const [showSuggestions, setShowSuggestions] = useState(false);

  // ─── État IA d'ajustement ──────────────────────────────────────────
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [aiError, setAiError] = useState(null);
  const [copyToast, setCopyToast] = useState(false);

  // ─── État envoi message cliente ────────────────────────────────────
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [sendDraft, setSendDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);
  const [sentToast, setSentToast] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    fetchClientFeedbacks(client, 7).then((res) => {
      if (cancelled) return;
      if (!res.ok) {
        setState({ status: "error", error: res.error });
        return;
      }
      const summary = summarizeFeedbacks(res.feedbacks);
      setState({
        status: "ready",
        feedbacks: res.feedbacks,
        summary,
        found: res.found,
        currentPlanId: res.current_plan_id ?? null,
        currentPlanPublishedAt: res.current_plan_published_at ?? null,
        previousPlanId: res.previous_plan_id ?? null,
        previousPlanPublishedAt: res.previous_plan_published_at ?? null,
        previousFeedbacks: res.previous_feedbacks || [],
      });
    });
    return () => { cancelled = true; };
  }, [client?.id]);

  // Calcul des suggestions (pure fonction des données)
  const adjustments = useMemo(
    () => (state.status === "ready" && state.summary ? suggestAdjustments(state.summary) : null),
    [state],
  );

  // Tendance 7j par axe + statut global (pure fonction, pas d'IA)
  const trends = useMemo(
    () => (state.status === "ready" ? computeFeedbackTrends(state.feedbacks || []) : null),
    [state],
  );

  // Tendance du plan précédent (pour la comparaison "vs plan préc.").
  // Calculée uniquement si on a effectivement des feedbacks précédents
  // pour économiser un calcul inutile.
  const previousTrends = useMemo(() => {
    if (state.status !== "ready") return null;
    if (!state.previousFeedbacks?.length) return null;
    return computeFeedbackTrends(state.previousFeedbacks);
  }, [state]);

  // Auto-expand si au moins 1 signal "act" — Anissa voit immédiatement
  // les pistes d'action sans avoir à cliquer.
  useEffect(() => {
    if (adjustments?.tone === "act") setShowSuggestions(true);
  }, [adjustments?.tone]);

  // ─── Handlers IA ─────────────────────────────────────────────────
  const canCallAi = state.status === "ready" && !!state.summary && !!consultation;

  async function handleAiSuggest() {
    if (!canCallAi || aiLoading) return;
    setAiError(null);
    setAiResult(null);
    setAiLoading(true);
    try {
      const result = await aiSuggestAdjustment(client, consultation, state.summary, adjustments);
      setAiResult(result);
    } catch (e) {
      if (e instanceof SuggestConfigError) setAiError(`Config : ${e.message}`);
      else if (e instanceof SuggestHttpError) setAiError(`Erreur IA (${e.status}) : ${e.message}`);
      else setAiError(e?.message || String(e));
    } finally {
      setAiLoading(false);
    }
  }

  function handleAiIgnore() {
    setAiResult(null);
    setAiError(null);
  }

  function handleOpenSendModal() {
    if (!aiResult) return;
    // Pré-remplit avec la phrase coach (la mieux formulée pour la cliente)
    setSendDraft(aiResult.coach_note || aiResult.summary || "");
    setSendError(null);
    setSendModalOpen(true);
  }

  function handleCloseSendModal() {
    if (sending) return;
    setSendModalOpen(false);
    setSendError(null);
  }

  async function handleSendMessage() {
    if (sending) return;
    const email = client?.form?.email || client?.email;
    if (!email) {
      setSendError("Cliente sans email — impossible d'envoyer.");
      return;
    }
    const trimmed = sendDraft.trim();
    if (!trimmed) {
      setSendError("Message vide.");
      return;
    }
    setSendError(null);
    setSending(true);
    try {
      await sendCoachMessage({
        email,
        body: trimmed,
        source: "ai_assisted",
      });
      setSendModalOpen(false);
      setSentToast(true);
      setTimeout(() => setSentToast(false), 3500);
    } catch (e) {
      if (e instanceof CoachMessageError) setSendError(`Erreur (${e.status}) : ${e.message}`);
      else setSendError(e?.message || String(e));
    } finally {
      setSending(false);
    }
  }

  async function handleAiCopyAsNote() {
    if (!aiResult) return;
    const lines = [];
    if (aiResult.summary) lines.push(aiResult.summary, "");
    if (aiResult.suggestions?.length) {
      lines.push("Pistes d'ajustement :");
      for (const s of aiResult.suggestions) {
        lines.push(`- [${s.axis}] ${s.suggestion}`);
        if (s.reason) lines.push(`  Raison : ${s.reason}`);
        if (s.caution) lines.push(`  Vigilance : ${s.caution}`);
      }
      lines.push("");
    }
    if (aiResult.coach_note) {
      lines.push(`Note pour la cliente : ${aiResult.coach_note}`);
    }
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopyToast(true);
      setTimeout(() => setCopyToast(false), 2400);
    } catch {
      /* ignore */
    }
  }

  const baseStyle = {
    background: "rgba(255,255,255,.03)",
    border: "1px solid rgba(255,255,255,.08)",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  };

  if (state.status === "loading") {
    return (
      <div style={{ ...baseStyle, color: "#8a8a7a", fontSize: ".82rem" }}>
        Chargement du ressenti cliente…
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div style={{
        ...baseStyle,
        background: "rgba(220,80,80,.08)",
        border: "1px solid rgba(220,80,80,.25)",
        color: "#f5c6c6",
        fontSize: ".82rem",
      }}>
        Ressenti cliente : {state.error}
      </div>
    );
  }

  if (!state.feedbacks?.length) {
    // 3 sous-cas pour un empty state explicite :
    //  1. Cliente pas encore activée (pas de ligne dans `clients` côté staging)
    //  2. Cliente activée + plan en cours connu : explicite "depuis ce plan"
    //  3. Cliente activée sans plan : message générique
    let message = "💬 Aucun ressenti envoyé pour le moment côté app cliente.";
    if (state.found === false) {
      message = "💬 Cliente pas encore connectée à l'app cliente.";
    } else if (state.currentPlanPublishedAt) {
      message = `💬 Aucun feedback depuis le plan publié le ${formatDate(state.currentPlanPublishedAt)}. La cliente n'a pas encore réagi au nouveau plan.`;
    }
    return (
      <div style={{ ...baseStyle, color: "#8a8a7a", fontSize: ".82rem" }}>
        {message}
      </div>
    );
  }

  const { summary, feedbacks } = state;

  return (
    <div
      style={{
        ...baseStyle,
        padding: 18,
        background: "rgba(212,201,168,.04)",
        border: "1px solid rgba(212,201,168,.18)",
      }}
    >
      {/* ─── Bloc Tendance 7 jours (pure data, pas d'IA) ─── */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4, gap: 12 }}>
        <h3 style={{ margin: 0, color: "#d4c9a8", fontSize: ".95rem", fontWeight: 700 }}>
          💬 Ressenti — 7 derniers jours
        </h3>
        {trends && (
          <span
            title={`Statut global basé sur ${trends.dataPoints} retour${trends.dataPoints > 1 ? "s" : ""}`}
            style={{
              padding: "3px 10px",
              borderRadius: 999,
              fontSize: ".7rem",
              fontWeight: 600,
              background: TREND_STATUS_STYLE[trends.globalStatus].bg,
              border: `1px solid ${TREND_STATUS_STYLE[trends.globalStatus].border}`,
              color: TREND_STATUS_STYLE[trends.globalStatus].color,
              whiteSpace: "nowrap",
            }}
          >
            {trends.globalLabel}
          </span>
        )}
      </header>
      <p style={{
        margin: "0 0 12px 0",
        fontSize: ".74rem",
        color: "#8a8a7a",
        lineHeight: 1.45,
      }}>
        {state.currentPlanPublishedAt ? (
          <>
            <strong style={{ color: "#a89c7a", fontWeight: 600 }}>
              Depuis plan publié le {formatDate(state.currentPlanPublishedAt)}
            </strong>
            {" · "}
          </>
        ) : null}
        Lecture basée sur les retours récents de la cliente. À interpréter comme une tendance, pas un jour isolé.
        <span style={{ marginLeft: 8, color: "#7a7a6a" }}>
          · Dernier : {formatDate(summary.last_date)}
        </span>
      </p>

      {/* 4 lignes axe + badge statut + compteurs compacts */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: 6,
          marginBottom: (summary.weight_last || notes(summary).length || adjustments) ? 14 : 0,
        }}
      >
        {trends?.axisTrends.map((t) => {
          const style = TREND_STATUS_STYLE[t.status];
          const total = t.counts.total;

          // Évolution vs plan précédent (UX pro : caché si unknown)
          const prev = previousTrends?.axisTrends.find((p) => p.axis === t.axis) || null;
          const evo = compareAxisTrend(t, prev);
          const evoStyle = evo.direction !== "unknown" ? EVOLUTION_STYLE[evo.direction] : null;
          const evoTooltip = evoStyle && state.previousPlanPublishedAt
            ? `${evo.fromLabel} → ${evo.toLabel} (plan publié le ${formatDate(state.previousPlanPublishedAt)})`
            : null;

          return (
            <div
              key={t.axis}
              title={t.summary}
              style={{
                padding: "8px 10px",
                background: "rgba(0,0,0,.15)",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,.05)",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <span style={{ color: "#cfcfc4", fontSize: ".82rem", minWidth: 96 }}>
                {AXIS_EMOJI[t.axis]} {t.label}
              </span>
              <span
                style={{
                  padding: "2px 8px",
                  borderRadius: 999,
                  fontSize: ".68rem",
                  fontWeight: 600,
                  background: style.bg,
                  border: `1px solid ${style.border}`,
                  color: style.color,
                  whiteSpace: "nowrap",
                }}
              >
                {t.statusLabel}
              </span>
              <span style={{ color: "#8a8a7a", fontSize: ".72rem", flex: 1, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                {total === 0
                  ? "Pas encore de données"
                  : `${t.counts.positive}+  ·  ${t.counts.neutral}=  ·  ${t.counts.negative}−`}
              </span>

              {evoStyle && (
                <span
                  title={evoTooltip || undefined}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "2px 6px",
                    borderRadius: 6,
                    background: "rgba(255,255,255,.03)",
                    border: "1px solid rgba(255,255,255,.06)",
                    color: evoStyle.color,
                    fontSize: ".72rem",
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                    cursor: "help",
                  }}
                >
                  <span style={{ fontSize: ".88rem", lineHeight: 1 }}>{evoStyle.arrow}</span>
                  <span style={{ color: "#8a8a7a", fontWeight: 400, fontSize: ".68rem" }}>
                    vs plan préc.
                  </span>
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Poids — affiché UNIQUEMENT si la cliente en a saisi au moins un */}
      {summary.weight_last && (
        <div
          style={{
            marginBottom: notes(summary).length || adjustments ? 14 : 0,
            padding: "8px 12px",
            background: "rgba(140,180,220,.06)",
            border: "1px solid rgba(140,180,220,.18)",
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <span style={{ color: "#cfcfc4", fontSize: ".82rem" }}>
            ⚖️ Poids
          </span>
          <span style={{ fontSize: ".82rem" }}>
            <strong style={{ color: "#9bbed8", fontWeight: 600 }}>
              {summary.weight_last.weight_kg.toFixed(1)} kg
            </strong>
            <span style={{ color: "#8a8a7a", marginLeft: 8 }}>
              · {formatDate(summary.weight_last.date)}
            </span>
            {summary.weight_entries_count > 1 && (
              <span style={{ color: "#8a8a7a", marginLeft: 6, fontSize: ".72rem" }}>
                ({summary.weight_entries_count} mesures)
              </span>
            )}
          </span>
        </div>
      )}

      {/* Notes */}
      {notes(summary).length > 0 && (
        <div>
          <div style={{ fontSize: ".68rem", fontWeight: 600, color: "#8a8a7a", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 6 }}>
            Notes de la cliente
          </div>
          <ul style={{ margin: 0, padding: "0 0 0 16px", color: "#cfcfc4", fontSize: ".8rem", lineHeight: 1.5 }}>
            {notes(summary).map((n, i) => (
              <li key={i} style={{ marginBottom: 4 }}>
                « {n.note} »
                <span style={{ color: "#8a8a7a", marginLeft: 6, fontSize: ".7rem" }}>
                  — {formatDate(n.date)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ─── Suggestions d'ajustement (toggle, auto-expand si signal "act") ─── */}
      {adjustments && (adjustments.readings.length > 0 || adjustments.suggestions.length > 0) && (
        <SuggestionsBlock
          adjustments={adjustments}
          show={showSuggestions}
          onToggle={() => setShowSuggestions((v) => !v)}
        />
      )}

      {/* ─── IA d'ajustement (mode assisté — Anissa garde la main) ─── */}
      {canCallAi && (
        <AiBlockErrorBoundary>
          <AiAdjustmentBlock
            loading={aiLoading}
            result={aiResult}
            error={aiError}
            copyToast={copyToast}
            onSuggest={handleAiSuggest}
            onIgnore={handleAiIgnore}
            onCopyAsNote={handleAiCopyAsNote}
            onSendToClient={handleOpenSendModal}
          />
        </AiBlockErrorBoundary>
      )}

      {/* Toast confirmation envoi message */}
      {sentToast && (
        <div
          style={{
            marginTop: 10,
            padding: "10px 14px",
            background: "rgba(106,191,138,.12)",
            border: "1px solid rgba(106,191,138,.3)",
            borderRadius: 8,
            color: "#82c39e",
            fontSize: ".82rem",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          ✓ Message envoyé à la cliente. Visible dans son app.
        </div>
      )}

      {/* Modal d'envoi message cliente */}
      {sendModalOpen && (
        <SendMessageModal
          draft={sendDraft}
          onChange={setSendDraft}
          sending={sending}
          error={sendError}
          onCancel={handleCloseSendModal}
          onSend={handleSendMessage}
          clientName={client?.prenom || "la cliente"}
        />
      )}
    </div>
  );
}

// ─── Bloc IA d'ajustement ────────────────────────────────────────────────

/** Style de bouton mini réutilisé dans le bloc IA. */
function miniBtn(variant) {
  const base = {
    padding: "5px 10px",
    borderRadius: 5,
    fontSize: ".74rem",
    cursor: "pointer",
    fontWeight: 500,
    border: "1px solid transparent",
    whiteSpace: "nowrap",
  };
  if (variant === "purpleFilled") {
    return {
      ...base,
      background: "#7d4fcf",
      borderColor: "#7d4fcf",
      color: "#fff",
      fontWeight: 600,
    };
  }
  if (variant === "purple") {
    return {
      ...base,
      background: "rgba(120,80,200,.12)",
      borderColor: "rgba(180,140,255,.25)",
      color: "#cba8ff",
    };
  }
  // ghost
  return {
    ...base,
    background: "transparent",
    borderColor: "rgba(255,255,255,.15)",
    color: "#8a8a7a",
  };
}

function AiAdjustmentBlock({ loading, result, error, copyToast, onSuggest, onIgnore, onCopyAsNote, onSendToClient }) {
  const purple = { bg: "rgba(120,80,200,.08)", border: "rgba(180,140,255,.3)", text: "#cba8ff", textMuted: "#9d7cd8" };

  return (
    <div style={{ marginTop: 12 }}>
      {/* Bouton déclencheur (toujours visible) */}
      {!result && !error && (
        <button
          type="button"
          onClick={onSuggest}
          disabled={loading}
          style={{
            width: "100%",
            padding: "8px 12px",
            background: purple.bg,
            border: `1px solid ${purple.border}`,
            borderRadius: 8,
            color: purple.text,
            fontSize: ".8rem",
            fontWeight: 600,
            cursor: loading ? "wait" : "pointer",
            opacity: loading ? 0.6 : 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
          title="Appel IA Claude Haiku — propose des pistes, jamais de décision"
        >
          {loading ? "✨ Analyse IA en cours…" : "✨ Suggérer un ajustement (IA)"}
        </button>
      )}

      {/* Erreur */}
      {error && !loading && (
        <div
          style={{
            padding: 12,
            borderRadius: 8,
            background: "rgba(220,80,80,.08)",
            border: "1px solid rgba(220,80,80,.25)",
            color: "#f5c6c6",
            fontSize: ".82rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
          }}
        >
          <span>✗ {error}</span>
          <button
            type="button"
            onClick={onSuggest}
            style={{
              background: "transparent",
              border: "1px solid rgba(255,255,255,.15)",
              color: "#cfcfc4",
              padding: "4px 10px",
              borderRadius: 6,
              fontSize: ".74rem",
              cursor: "pointer",
            }}
          >
            ↺ Réessayer
          </button>
        </div>
      )}

      {/* Résultat IA */}
      {result && (
        <div
          style={{
            padding: 14,
            background: purple.bg,
            border: `1px solid ${purple.border}`,
            borderRadius: 10,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div style={{ color: purple.text, fontSize: ".85rem", fontWeight: 600 }}>
              ✨ Proposition IA — relire avant d&apos;utiliser
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button type="button" onClick={onSuggest} disabled={loading} style={miniBtn("purple")}>
                ↺ Regénérer
              </button>
              <button type="button" onClick={onIgnore} style={miniBtn("ghost")}>
                ✗ Ignorer
              </button>
              <button type="button" onClick={onCopyAsNote} style={miniBtn("ghost")}>
                📋 Copier
              </button>
              {onSendToClient && (
                <button type="button" onClick={onSendToClient} style={miniBtn("purpleFilled")}>
                  📤 Envoyer à la cliente
                </button>
              )}
            </div>
          </div>

          {/* Lecture IA */}
          {result.summary && (
            <div>
              <div style={{ fontSize: ".68rem", fontWeight: 600, color: purple.textMuted, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 4 }}>
                🧠 Lecture IA
              </div>
              <p style={{ margin: 0, color: "#e5dfd0", fontSize: ".82rem", lineHeight: 1.55 }}>
                {result.summary}
              </p>
            </div>
          )}

          {/* Pistes proposées */}
          {result.suggestions?.length > 0 && (
            <div>
              <div style={{ fontSize: ".68rem", fontWeight: 600, color: purple.textMuted, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 6 }}>
                💡 Pistes proposées
              </div>
              <ol style={{ margin: 0, padding: "0 0 0 18px", display: "flex", flexDirection: "column", gap: 8 }}>
                {result.suggestions.map((s, i) => (
                  <li key={i} style={{ color: "#e5dfd0", fontSize: ".82rem", lineHeight: 1.55 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                      <span style={{ fontWeight: 600 }}>{s.suggestion}</span>
                      <span
                        style={{
                          fontSize: ".64rem",
                          padding: "1px 6px",
                          borderRadius: 99,
                          background: "rgba(255,255,255,.06)",
                          color: purple.textMuted,
                          textTransform: "uppercase",
                          letterSpacing: ".05em",
                        }}
                      >
                        {s.axis}
                      </span>
                    </div>
                    {s.reason && (
                      <div style={{ fontSize: ".75rem", color: "#a8a297", marginTop: 2 }}>
                        <strong>Raison :</strong> {s.reason}
                      </div>
                    )}
                    {s.caution && (
                      <div style={{ fontSize: ".75rem", color: "#e5c878", marginTop: 2 }}>
                        ⚠ <strong>Vigilance :</strong> {s.caution}
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Coach note */}
          {result.coach_note && (
            <div>
              <div style={{ fontSize: ".68rem", fontWeight: 600, color: purple.textMuted, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 4 }}>
                💬 Phrase pour la cliente (à reprendre / adapter)
              </div>
              <p
                style={{
                  margin: 0,
                  padding: "8px 12px",
                  background: "rgba(0,0,0,.2)",
                  borderRadius: 6,
                  color: "#e5dfd0",
                  fontSize: ".82rem",
                  fontStyle: "italic",
                  lineHeight: 1.5,
                }}
              >
                « {result.coach_note} »
              </p>
            </div>
          )}

          {/* Disclaimer permanent */}
          <div
            style={{
              fontSize: ".7rem",
              color: "#8a8a7a",
              fontStyle: "italic",
              borderTop: "1px solid rgba(255,255,255,.05)",
              paddingTop: 8,
            }}
          >
            ⚠ À valider par toi avant publication. L&apos;IA propose, tu décides.
          </div>

          {/* Toast copy */}
          {copyToast && (
            <div
              style={{
                padding: "6px 10px",
                background: "rgba(106,191,138,.15)",
                border: "1px solid rgba(106,191,138,.35)",
                borderRadius: 6,
                color: "#82c39e",
                fontSize: ".74rem",
              }}
            >
              ✓ Note copiée dans le presse-papier
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Bloc Suggestions ────────────────────────────────────────────────────

function SuggestionsBlock({ adjustments, show, onToggle }) {
  const accent =
    adjustments.tone === "act"
      ? { bg: "rgba(220,140,80,.08)", border: "rgba(220,140,80,.3)", text: "#e89968" }
      : adjustments.tone === "watch"
        ? { bg: "rgba(220,180,80,.06)", border: "rgba(220,180,80,.22)", text: "#e5c878" }
        : { bg: "rgba(120,200,140,.06)", border: "rgba(120,200,140,.22)", text: "#9ed8b0" };

  return (
    <div style={{ marginTop: 14 }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: "100%",
          padding: "8px 12px",
          background: accent.bg,
          border: `1px solid ${accent.border}`,
          borderRadius: 8,
          color: accent.text,
          fontSize: ".8rem",
          fontWeight: 600,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span>
          💡 {show ? "Masquer" : "Voir"} les suggestions d&apos;ajustement
          {adjustments.tone === "act" && (
            <span style={{ marginLeft: 8, fontSize: ".68rem", padding: "2px 8px", borderRadius: 99, background: "rgba(255,255,255,.08)" }}>
              {adjustments.suggestions.length} action{adjustments.suggestions.length > 1 ? "s" : ""} suggérée{adjustments.suggestions.length > 1 ? "s" : ""}
            </span>
          )}
        </span>
        <span style={{ fontSize: ".7rem", opacity: 0.6 }}>{show ? "▾" : "▸"}</span>
      </button>

      {show && (
        <div
          style={{
            marginTop: 10,
            padding: 14,
            background: accent.bg,
            border: `1px solid ${accent.border}`,
            borderRadius: 8,
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          {/* Lecture rapide */}
          {adjustments.readings.length > 0 && (
            <div>
              <div style={{ fontSize: ".68rem", fontWeight: 600, color: "#8a8a7a", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 6 }}>
                🧠 Lecture rapide
              </div>
              <ul style={{ margin: 0, padding: "0 0 0 16px", color: "#cfcfc4", fontSize: ".8rem", lineHeight: 1.5 }}>
                {adjustments.readings.map((r, i) => (
                  <li key={i} style={{ marginBottom: 3 }}>
                    {r.text}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Suggestions */}
          {adjustments.suggestions.length > 0 && (
            <div>
              <div style={{ fontSize: ".68rem", fontWeight: 600, color: "#8a8a7a", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 6 }}>
                💡 Pistes d&apos;ajustement
              </div>
              <ul style={{ margin: 0, padding: "0 0 0 16px", color: "#cfcfc4", fontSize: ".82rem", lineHeight: 1.55 }}>
                {adjustments.suggestions.map((s, i) => (
                  <li key={i} style={{ marginBottom: 6 }}>
                    {s.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div style={{ fontSize: ".7rem", color: "#8a8a7a", fontStyle: "italic", borderTop: "1px solid rgba(255,255,255,.05)", paddingTop: 8 }}>
            Ces pistes sont des aides à la réflexion. À toi de juger ce qui s&apos;applique au plan de cette cliente.
          </div>
        </div>
      )}
    </div>
  );
}

function notes(summary) {
  return summary?.notes || [];
}

function formatDate(iso) {
  if (!iso) return "?";
  try {
    // Supporte 2 formats :
    //  - "YYYY-MM-DD" (date pure des feedbacks) -> on force minuit local pour eviter decalage TZ
    //  - "YYYY-MM-DDTHH:mm:ss.sssZ" (timestamp ISO complet de Supabase, ex. published_at) -> parse direct
    const isFullIso = typeof iso === "string" && iso.includes("T");
    const d = new Date(isFullIso ? iso : iso + "T00:00:00");
    if (Number.isNaN(d.getTime())) return "?";
    return d.toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "short" });
  } catch {
    return "?";
  }
}

// ─── Modal d'envoi de message à la cliente ───────────────────────────────
//
// Pré-rempli avec la phrase coach IA. Anissa peut éditer librement avant
// d'envoyer. Le message arrivera dans l'app cliente (carte sur la home).

function SendMessageModal({ draft, onChange, sending, error, onCancel, onSend, clientName }) {
  const charCount = draft?.length || 0;
  const tooLong = charCount > 2000;

  return (
    <div
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#1f1c18",
          border: "1px solid rgba(255,255,255,.1)",
          borderRadius: 14,
          padding: 22,
          maxWidth: 540,
          width: "100%",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <header>
          <h3 style={{ margin: 0, color: "#d4c9a8", fontSize: "1rem", fontWeight: 700 }}>
            📤 Envoyer un message à {clientName}
          </h3>
          <p style={{ margin: "4px 0 0", fontSize: ".78rem", color: "#8a8a7a" }}>
            Visible immédiatement dans son app cliente. Modifiable avant envoi.
          </p>
        </header>

        <textarea
          value={draft}
          onChange={(e) => onChange(e.target.value)}
          rows={6}
          placeholder="Votre message..."
          autoFocus
          disabled={sending}
          style={{
            width: "100%",
            padding: "12px 14px",
            background: "rgba(0,0,0,.25)",
            border: `1px solid ${tooLong ? "rgba(220,80,80,.4)" : "rgba(255,255,255,.12)"}`,
            borderRadius: 8,
            color: "#e5dfd0",
            fontSize: ".88rem",
            lineHeight: 1.55,
            fontFamily: "inherit",
            resize: "vertical",
            outline: "none",
          }}
        />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: ".74rem" }}>
          <span style={{ color: tooLong ? "#e89090" : "#8a8a7a" }}>
            {charCount} / 2000 caractères
          </span>
          {error && <span style={{ color: "#f5c6c6" }}>{error}</span>}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={sending}
            style={{
              ...miniBtn("ghost"),
              padding: "8px 14px",
              fontSize: ".82rem",
            }}
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={onSend}
            disabled={sending || tooLong || !draft?.trim()}
            style={{
              ...miniBtn("purpleFilled"),
              padding: "8px 18px",
              fontSize: ".82rem",
              opacity: sending || tooLong || !draft?.trim() ? 0.5 : 1,
              cursor: sending ? "wait" : "pointer",
            }}
          >
            {sending ? "Envoi…" : "Envoyer maintenant"}
          </button>
        </div>
      </div>
    </div>
  );
}
