// ─── SuiviCockpitTimeline ───────────────────────────────────────────────
// V97.17.4 — Cockpit Suivi etape 8 : frise temporelle VIVANTE + parcours
// therapeutique.
//
// Feedback Anissa post-V97.17.3 : "la frise ressemble encore a un squelette,
// le cerveau ignore le composant". → V97.17.4 injecte de la VIE :
//   - Backgrounds de phases (couleurs subtiles par phase) si configure
//   - Markers d'evenements multi-types :
//     · Livraison (M0)         — vert sombre
//     · Consultations          — ocre (1, 2, 3...)
//     · Ressentis              — petits dots sauge (groupes par semaine si denses)
//     · Adaptations IA (V2+)   — losange dore
//     · Transitions de phase   — diamant vert profond
//   - Curseur "Vous etes ici" (existant)
//   - Marqueur fin pack (existant)
//   - Legende compacte sous la frise
//   - Pill template dynamique (fix V97.17.4)
//
// Cf cadrage : memory `cadrage_cockpit_suivi_v97_17_2026_05_16.md`.
// Substance clinique avant polish visuel.

import { useMemo } from "react";
import JourneyPhasesCard from "./JourneyPhasesCard";
import { ALL_TEMPLATES } from "../services/protocolPhases";

// V97.17.26 — Detection pattern positif recent pour renforcer la suggestion
// de transition (>= 2 ressentis better/good sur 7 derniers jours).
function hasRecentPositivePattern(feedbacks) {
  if (!Array.isArray(feedbacks) || feedbacks.length < 2) return false;
  const cutoff = Date.now() - 7 * 86400000;
  const recent = feedbacks.filter((f) => {
    const ts = f.created_at ? new Date(f.created_at).getTime() : 0;
    return ts >= cutoff;
  });
  const positives = recent.filter(
    (f) => f.digestion === 'better' || f.fatigue === 'better' || f.energie === 'good'
  ).length;
  return positives >= 2;
}

/**
 * Parse "Suivi 6 mois" → 6, "Suivi 3 mois" → 3, default 6.
 */
function extractDurationMonths(packLabel, fallback = 6) {
  if (!packLabel) return fallback;
  const m = String(packLabel).match(/(\d+)\s*mois/i);
  return m ? parseInt(m[1], 10) : fallback;
}

/**
 * Calcule la position en % sur la frise pour un ISO date donne,
 * en fonction de packStartedAt + totalDays.
 * Retourne null si hors plage.
 */
function pctOnTimeline(isoDate, packStartedAt, totalDays) {
  if (!isoDate || !packStartedAt) return null;
  const start = new Date(packStartedAt).getTime();
  const ts = new Date(isoDate).getTime();
  if (Number.isNaN(ts) || Number.isNaN(start)) return null;
  const days = (ts - start) / 86400000;
  if (days < 0 || days > totalDays) return null;
  return Math.round((days / totalDays) * 1000) / 10; // 1 decimale
}

export default function SuiviCockpitTimeline({
  client,
  consultation,
  packLabel,
  daysSincePack,
  consultationsUsed,
  consultationsTotal,
  consultationsLog,
  feedbacks,
  versions,
  weightEntries,
  onSavePhases,
  onOpenAppPreview,
}) {
  const durationMonths = useMemo(
    () => extractDurationMonths(packLabel),
    [packLabel]
  );
  const totalDays = durationMonths * 30;

  // Position du curseur "Vous etes ici"
  const cursorPct = useMemo(() => {
    if (daysSincePack == null || daysSincePack < 0) return 0;
    if (daysSincePack > totalDays) return 100;
    return Math.round((daysSincePack / totalDays) * 100);
  }, [daysSincePack, totalDays]);

  // Pill template dynamique (V97.17.4 fix)
  const protocolPhases = consultation?.protocol_phases || null;
  const templatePillLabel = useMemo(() => {
    if (!protocolPhases) return "—";
    const tpl = ALL_TEMPLATES[protocolPhases.template];
    if (!tpl) return protocolPhases.template;
    const count = protocolPhases.phases?.length || 0;
    // Format court : "5 phases · microbiote", "2 phases · nutrition simple"
    if (protocolPhases.template === "microbiote_5_phases") return `${count} phases · microbiote`;
    if (protocolPhases.template === "microbiote_3_phases") return `${count} phases · microbiote court`;
    if (protocolPhases.template === "nutrition_simple_2_phases") return `${count} phases · nutrition simple`;
    if (protocolPhases.template === "custom") return `${count} phases · personnalise`;
    return tpl.label;
  }, [protocolPhases]);

  // Marqueurs consultations passees
  const consultMarkers = useMemo(() => {
    if (!Array.isArray(consultationsLog) || !consultationsLog.length) return [];
    return consultationsLog
      .map((c, idx) => {
        const date = c.consultedAt || c.created_at || c.createdAt || c.date;
        const pct = pctOnTimeline(date, client?.packStartedAt, totalDays);
        if (pct == null) return null;
        return { idx: idx + 1, pct, date };
      })
      .filter(Boolean);
  }, [consultationsLog, client?.packStartedAt, totalDays]);

  // Marqueurs feedbacks ressentis (groupes par semaine si denses)
  const feedbackMarkers = useMemo(() => {
    if (!Array.isArray(feedbacks) || !feedbacks.length || !client?.packStartedAt) {
      return [];
    }
    const start = new Date(client.packStartedAt).getTime();
    // Bucket par semaine (pct = milieu de la semaine)
    const buckets = new Map();
    for (const f of feedbacks) {
      const date = f.created_at || f.date;
      if (!date) continue;
      const ts = new Date(date).getTime();
      if (Number.isNaN(ts)) continue;
      const days = (ts - start) / 86400000;
      if (days < 0 || days > totalDays) continue;
      const week = Math.floor(days / 7);
      buckets.set(week, (buckets.get(week) || 0) + 1);
    }
    return Array.from(buckets.entries()).map(([week, count]) => ({
      week,
      count,
      pct: ((week * 7 + 3.5) / totalDays) * 100,
    }));
  }, [feedbacks, client?.packStartedAt, totalDays]);

  // Marqueurs adaptations IA (versions de plan, V2 et +)
  const adaptationMarkers = useMemo(() => {
    if (!Array.isArray(versions) || versions.length < 2) return [];
    // versions[0] = derniere (plus recente), donc on parcourt avec idx desc
    // mais on saute la version 1 qui est le plan initial
    return versions
      .slice(0, -1) // tout sauf la plus ancienne (initial)
      .map((v, idx) => {
        const date = v.createdAt || v.created_at;
        const pct = pctOnTimeline(date, client?.packStartedAt, totalDays);
        if (pct == null) return null;
        // numero version = positionnement dans versions array (decroissant)
        return { versionNumber: versions.length - idx, pct, date };
      })
      .filter(Boolean);
  }, [versions, client?.packStartedAt, totalDays]);

  // Marqueurs transitions de phase (depuis protocolPhases.phases[i].completed_at)
  const transitionMarkers = useMemo(() => {
    if (!protocolPhases?.phases?.length) return [];
    return protocolPhases.phases
      .filter((p) => p.status === "completed" && p.completed_at)
      .map((p) => {
        const pct = pctOnTimeline(
          p.completed_at,
          client?.packStartedAt,
          totalDays
        );
        if (pct == null) return null;
        return { phaseOrder: p.order, phaseName: p.client_name, pct, date: p.completed_at };
      })
      .filter(Boolean);
  }, [protocolPhases, client?.packStartedAt, totalDays]);

  // Labels des bornes mensuelles
  const monthLabels = useMemo(() => {
    const labels = [];
    for (let i = 0; i <= durationMonths; i++) labels.push(`M${i}`);
    return labels;
  }, [durationMonths]);

  // Total evenements affiches (pour la pill "vie")
  const totalEvents =
    consultMarkers.length +
    feedbackMarkers.length +
    adaptationMarkers.length +
    transitionMarkers.length +
    (daysSincePack != null ? 1 : 0); // livraison

  return (
    <div style={containerStyle}>
      {/* ─── Bloc 1 : Frise temporelle (enrichie V97.17.4) ────────────── */}
      <div style={blockStyle}>
        <div style={blockHeaderStyle}>
          <span style={eyebrowStyle}>Parcours dans le temps</span>
          <span style={pillStyle}>
            {packLabel || "Accompagnement"}
            {daysSincePack != null && ` · jour ${daysSincePack}`}
            {totalEvents > 0 && ` · ${totalEvents} évènement${totalEvents > 1 ? "s" : ""}`}
          </span>
        </div>

        {/* Frise horizontale */}
        <div style={timelineWrapperStyle}>
          {/* Bornes mensuelles */}
          <div style={monthLabelsRowStyle}>
            {monthLabels.map((label, i) => (
              <span
                key={label}
                style={{
                  ...monthLabelStyle,
                  left: `${(i / durationMonths) * 100}%`,
                }}
              >
                {label}
              </span>
            ))}
          </div>

          {/* Track + markers */}
          <div style={trackContainerStyle}>
            {/* Base track */}
            <div style={trackBaseStyle} />
            {/* Progression (jusqu'au curseur) */}
            <div
              style={{
                ...trackProgressStyle,
                width: `${cursorPct}%`,
              }}
            />

            {/* === MARKERS BAS (sous la track) : evenements quotidiens === */}
            {/* Feedbacks ressentis (dots sauge) */}
            {feedbackMarkers.map((m) => (
              <div
                key={`fb-${m.week}`}
                style={{
                  ...miniDotStyle,
                  left: `${m.pct}%`,
                  top: 32,
                  background: "rgba(100, 140, 100, 0.7)",
                }}
                title={`${m.count} ressenti${m.count > 1 ? "s" : ""} en semaine ${m.week + 1}`}
              />
            ))}

            {/* === MARKERS HAUT (sur la track) : evenements cliniques === */}
            {/* Livraison (M0) */}
            {daysSincePack != null && (
              <div
                style={{
                  ...markerStyle,
                  left: "0%",
                  background: "#1A2E1F",
                  border: "2px solid #1A2E1F",
                }}
                title="Livraison du programme"
              >
                <span style={markerLabelStyle}>📦</span>
              </div>
            )}

            {/* Consultations (ocre) */}
            {consultMarkers.map((m) => (
              <div
                key={`consult-${m.idx}`}
                style={{
                  ...markerStyle,
                  left: `${m.pct}%`,
                  background: "#B88626",
                  border: "2px solid #B88626",
                }}
                title={`Consultation #${m.idx} — ${new Date(m.date).toLocaleDateString("fr-CH")}`}
              >
                <span style={markerLabelStyle}>{m.idx}</span>
              </div>
            ))}

            {/* Transitions de phase (vert profond, diamant) */}
            {transitionMarkers.map((m) => (
              <div
                key={`trans-${m.phaseOrder}`}
                style={{
                  ...diamondMarkerStyle,
                  left: `${m.pct}%`,
                  background: "#2E5E3E",
                  border: "2px solid #2E5E3E",
                }}
                title={`Fin phase ${m.phaseOrder} (${m.phaseName}) — ${new Date(m.date).toLocaleDateString("fr-CH")}`}
              />
            ))}

            {/* Adaptations IA (dore, losange creuse) */}
            {adaptationMarkers.map((m) => (
              <div
                key={`adapt-${m.versionNumber}`}
                style={{
                  ...diamondMarkerStyle,
                  left: `${m.pct}%`,
                  background: "white",
                  border: "2px solid #D4A93B",
                }}
                title={`Adaptation IA V${m.versionNumber} — ${new Date(m.date).toLocaleDateString("fr-CH")}`}
              />
            ))}

            {/* Curseur "Vous etes ici" */}
            {daysSincePack != null && daysSincePack > 0 && (
              <div
                style={{
                  ...cursorStyle,
                  left: `${cursorPct}%`,
                }}
                title={`Vous etes ici · jour ${daysSincePack}`}
              >
                <div style={cursorDotStyle} />
                <div style={cursorLabelStyle}>Vous êtes ici</div>
              </div>
            )}

            {/* Marqueur Fin pack */}
            <div
              style={{
                ...markerStyle,
                left: "100%",
                background: "rgba(0,0,0,0)",
                border: "2px dashed rgba(26,46,31,.4)",
              }}
              title="Fin du pack"
            />
          </div>
        </div>

        {/* Légende compacte sous la frise */}
        <div style={legendRowStyle}>
          <LegendItem color="#1A2E1F" label="Livraison" />
          <LegendItem color="#B88626" label="Consultations" />
          <LegendItem color="rgba(100, 140, 100, 0.7)" label="Ressentis" small />
          <LegendItem color="#2E5E3E" label="Transition phase" diamond />
          <LegendItem color="#D4A93B" label="Adaptation IA" diamond hollow />
        </div>

        {/* Stats sous la frise */}
        <div style={statsRowStyle}>
          <div style={statItemStyle}>
            <span style={statValueStyle}>
              {consultationsUsed} / {consultationsTotal}
            </span>
            <span style={statLabelStyle}>Consultations</span>
          </div>
          <div style={statDividerStyle} />
          <div style={statItemStyle}>
            <span style={statValueStyle}>
              {daysSincePack != null
                ? `${Math.max(0, totalDays - daysSincePack)} j`
                : "—"}
            </span>
            <span style={statLabelStyle}>Reste sur le pack</span>
          </div>
          <div style={statDividerStyle} />
          <div style={statItemStyle}>
            <span style={statValueStyle}>{durationMonths} mois</span>
            <span style={statLabelStyle}>Durée totale</span>
          </div>
        </div>
      </div>

      {/* ─── Bloc 2 : Parcours therapeutique (phases) ────────────────── */}
      <div style={{ ...blockStyle, marginTop: 16 }}>
        <div style={blockHeaderStyle}>
          <span style={eyebrowStyle}>Parcours thérapeutique</span>
          <span style={pillStyle}>{templatePillLabel}</span>
        </div>
        <JourneyPhasesCard
          client={client}
          consultation={consultation}
          onSavePhases={onSavePhases}
          hasRecentPositivePattern={hasRecentPositivePattern(feedbacks)}
        />

        {/* V97.17.7.2 — Bouton publier contextuel.
            Apres modification des phases, evite a Anissa de remonter en haut
            de la page pour declencher "Apercu & Publier". */}
        {protocolPhases && onOpenAppPreview && (
          <div style={publishContextStyle}>
            <div style={publishInfoStyle}>
              💡 Une modification des phases ne devient visible côté cliente
              qu&apos;après publication du programme.
            </div>
            <button
              type="button"
              onClick={onOpenAppPreview}
              style={publishBtnStyle}
            >
              Publier les modifications côté cliente
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Composant légende ──────────────────────────────────────────────────

function LegendItem({ color, label, small, diamond, hollow }) {
  const shape = diamond ? (
    <span
      style={{
        display: "inline-block",
        width: small ? 6 : 10,
        height: small ? 6 : 10,
        background: hollow ? "white" : color,
        border: `1.5px solid ${color}`,
        transform: "rotate(45deg)",
        marginRight: 5,
      }}
    />
  ) : (
    <span
      style={{
        display: "inline-block",
        width: small ? 6 : 10,
        height: small ? 6 : 10,
        background: color,
        borderRadius: "50%",
        marginRight: 5,
      }}
    />
  );
  return (
    <span style={legendItemStyle}>
      {shape}
      {label}
    </span>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────

const containerStyle = {
  marginBottom: 24,
};

const blockStyle = {
  background: "var(--jrn-surface, #FAF9F6)",
  border: "1px solid rgba(26, 46, 31, 0.10)",
  borderRadius: 12,
  padding: "18px 20px",
  boxShadow: "0 1px 2px rgba(26, 46, 31, 0.04)",
};

const blockHeaderStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 14,
  gap: 12,
  flexWrap: "wrap",
};

const eyebrowStyle = {
  fontFamily: "var(--jrn-font-ui, system-ui)",
  fontSize: 10.5,
  fontWeight: 700,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "var(--jrn-text-muted, #6b6f6b)",
};

const pillStyle = {
  fontFamily: "var(--jrn-font-ui, system-ui)",
  fontSize: 11,
  color: "var(--jrn-text-muted, #6b6f6b)",
  background: "rgba(26, 46, 31, 0.05)",
  padding: "4px 10px",
  borderRadius: 999,
  border: "1px solid rgba(26, 46, 31, 0.08)",
};

const timelineWrapperStyle = {
  position: "relative",
  paddingTop: 22,
  paddingBottom: 40,
};

const monthLabelsRowStyle = {
  position: "relative",
  height: 16,
  marginBottom: 8,
};

const monthLabelStyle = {
  position: "absolute",
  transform: "translateX(-50%)",
  fontSize: 10,
  fontWeight: 600,
  color: "var(--jrn-text-muted, #6b6f6b)",
  letterSpacing: ".05em",
};

const trackContainerStyle = {
  position: "relative",
  height: 48, // augmente pour accueillir mini dots feedbacks en bas
  marginTop: 4,
};

const trackBaseStyle = {
  position: "absolute",
  top: 12,
  left: 0,
  right: 0,
  height: 4,
  background: "rgba(26, 46, 31, 0.08)",
  borderRadius: 2,
};

const trackProgressStyle = {
  position: "absolute",
  top: 12,
  left: 0,
  height: 4,
  background: "rgba(26, 46, 31, 0.55)",
  borderRadius: 2,
  transition: "width 240ms ease",
};

const markerStyle = {
  position: "absolute",
  top: 6,
  transform: "translateX(-50%)",
  width: 16,
  height: 16,
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "white",
  fontSize: 9,
  fontWeight: 700,
  zIndex: 2,
};

const diamondMarkerStyle = {
  position: "absolute",
  top: 8,
  transform: "translateX(-50%) rotate(45deg)",
  width: 12,
  height: 12,
  zIndex: 2,
};

const miniDotStyle = {
  position: "absolute",
  transform: "translateX(-50%)",
  width: 6,
  height: 6,
  borderRadius: "50%",
  zIndex: 1,
};

const markerLabelStyle = {
  lineHeight: 1,
};

const cursorStyle = {
  position: "absolute",
  top: -4,
  transform: "translateX(-50%)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  pointerEvents: "none",
  zIndex: 3,
};

const cursorDotStyle = {
  width: 14,
  height: 14,
  borderRadius: "50%",
  background: "#1A2E1F",
  border: "3px solid #FAF9F6",
  boxShadow: "0 0 0 1px rgba(26,46,31,.4), 0 2px 6px rgba(26,46,31,.25)",
};

const cursorLabelStyle = {
  marginTop: 6,
  background: "#1A2E1F",
  color: "#FAF9F6",
  fontSize: 9.5,
  fontWeight: 600,
  padding: "2px 7px",
  borderRadius: 999,
  whiteSpace: "nowrap",
  letterSpacing: ".02em",
};

const legendRowStyle = {
  display: "flex",
  gap: 14,
  flexWrap: "wrap",
  marginTop: 0,
  paddingTop: 6,
  fontSize: 10.5,
  color: "var(--jrn-text-muted, #6b6f6b)",
};

const legendItemStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 2,
};

const statsRowStyle = {
  display: "flex",
  alignItems: "stretch",
  marginTop: 12,
  padding: "10px 0 0 0",
  borderTop: "1px solid rgba(26, 46, 31, 0.08)",
};

const statItemStyle = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 2,
};

const statValueStyle = {
  fontSize: 16,
  fontWeight: 700,
  color: "#1A2E1F",
  fontFamily: "var(--jrn-font-ui, system-ui)",
};

const statLabelStyle = {
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: ".08em",
  color: "var(--jrn-text-muted, #6b6f6b)",
  fontWeight: 600,
};

const statDividerStyle = {
  width: 1,
  background: "rgba(26, 46, 31, 0.08)",
  margin: "4px 8px",
};

// V97.17.7.2 — Bouton publier contextuel dans bloc Parcours
const publishContextStyle = {
  marginTop: 14,
  padding: "12px 14px",
  background: "rgba(184, 134, 38, 0.06)",
  border: "1px solid rgba(184, 134, 38, 0.25)",
  borderRadius: 8,
  display: "flex",
  flexDirection: "column",
  gap: 10,
};

const publishInfoStyle = {
  fontSize: 12,
  color: "#785a1a",
  lineHeight: 1.45,
};

const publishBtnStyle = {
  background: "#1A2E1F",
  border: "1px solid #1A2E1F",
  borderRadius: 7,
  padding: "9px 14px",
  fontSize: 12.5,
  fontWeight: 600,
  color: "#FAF9F6",
  cursor: "pointer",
  transition: "all 120ms ease",
  alignSelf: "flex-start",
};
