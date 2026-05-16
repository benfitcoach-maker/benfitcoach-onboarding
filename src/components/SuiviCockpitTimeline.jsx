// ─── SuiviCockpitTimeline ───────────────────────────────────────────────
// V97.17.1 — Cockpit Suivi etape 8 : frise temporelle + parcours therapeutique.
//
// Place EN HAUT de la page Suivi (juste sous le hero), avant "Action prioritaire".
// But : Anissa voit en un coup d'oeil OU on en est dans le temps + dans
// quelle phase therapeutique la cliente se trouve.
//
// 2 blocs lisibles :
//   1. PARCOURS DANS LE TEMPS : frise horizontale mois 0 → N, curseur
//      "Vous etes ici", marqueurs livraison + consultations passees + fin.
//   2. PARCOURS THERAPEUTIQUE : embedded JourneyPhasesCard (timeline phases).
//
// Cf spec : memory `spec_v2_parcours_home_permanente_2026_05_16.md`
// Cf directive : memory `saas_cockpit_clinique_directive.md`
//   (pas de cérémonial, juste de la densité opérationnelle).

import { useMemo } from "react";
import JourneyPhasesCard from "./JourneyPhasesCard";

/**
 * Parse "Suivi 6 mois" → 6, "Suivi 3 mois" → 3, default 6.
 */
function extractDurationMonths(packLabel, fallback = 6) {
  if (!packLabel) return fallback;
  const m = String(packLabel).match(/(\d+)\s*mois/i);
  return m ? parseInt(m[1], 10) : fallback;
}

export default function SuiviCockpitTimeline({
  client,
  consultation,
  packLabel,
  daysSincePack,
  consultationsUsed,
  consultationsTotal,
  consultationsLog,
  onSavePhases,
}) {
  const durationMonths = useMemo(
    () => extractDurationMonths(packLabel),
    [packLabel]
  );

  // Position du curseur "Vous etes ici" : daysSincePack / (durationMonths * 30)
  const totalDays = durationMonths * 30;
  const cursorPct = useMemo(() => {
    if (daysSincePack == null || daysSincePack < 0) return 0;
    if (daysSincePack > totalDays) return 100;
    return Math.round((daysSincePack / totalDays) * 100);
  }, [daysSincePack, totalDays]);

  // Marqueurs des consultations passees, positionnees sur la frise
  const consultMarkers = useMemo(() => {
    if (!Array.isArray(consultationsLog) || !consultationsLog.length) return [];
    if (!client?.packStartedAt) return [];
    const packStart = new Date(client.packStartedAt).getTime();
    return consultationsLog
      .map((c, idx) => {
        const date = c.consultedAt || c.created_at || c.createdAt;
        if (!date) return null;
        const ts = new Date(date).getTime();
        if (Number.isNaN(ts)) return null;
        const daysFromStart = Math.floor((ts - packStart) / 86400000);
        if (daysFromStart < 0 || daysFromStart > totalDays) return null;
        const pct = Math.round((daysFromStart / totalDays) * 100);
        return { idx: idx + 1, pct, date };
      })
      .filter(Boolean);
  }, [consultationsLog, client?.packStartedAt, totalDays]);

  // Labels des bornes mensuelles (M0 → M6 si pack 6 mois, sinon adapte)
  const monthLabels = useMemo(() => {
    const labels = [];
    for (let i = 0; i <= durationMonths; i++) labels.push(`M${i}`);
    return labels;
  }, [durationMonths]);

  return (
    <div style={containerStyle}>
      {/* ─── Bloc 1 : Frise temporelle ───────────────────────────────── */}
      <div style={blockStyle}>
        <div style={blockHeaderStyle}>
          <span style={eyebrowStyle}>Parcours dans le temps</span>
          <span style={pillStyle}>
            {packLabel || "Accompagnement"}
            {daysSincePack != null && ` · jour ${daysSincePack}`}
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

          {/* Track */}
          <div style={trackContainerStyle}>
            <div style={trackBaseStyle} />
            <div
              style={{
                ...trackProgressStyle,
                width: `${cursorPct}%`,
              }}
            />

            {/* Marqueur Livraison (M0) */}
            {daysSincePack != null && (
              <div
                style={{
                  ...markerStyle,
                  left: "0%",
                  background: "rgba(26,46,31,.85)",
                  border: "2px solid rgba(26,46,31,1)",
                }}
                title="Livraison du programme"
              >
                <span style={markerLabelStyle}>✓</span>
              </div>
            )}

            {/* Marqueurs consultations passees */}
            {consultMarkers.map((m) => (
              <div
                key={`consult-${m.idx}`}
                style={{
                  ...markerStyle,
                  left: `${m.pct}%`,
                  background: "rgba(184,134,38,.85)",
                  border: "2px solid rgba(184,134,38,1)",
                }}
                title={`Consultation #${m.idx} — ${new Date(m.date).toLocaleDateString("fr-CH")}`}
              >
                <span style={markerLabelStyle}>{m.idx}</span>
              </div>
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
              {daysSincePack != null ? `${Math.max(0, totalDays - daysSincePack)} j` : "—"}
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
          <span style={pillStyle}>5 phases · microbiote</span>
        </div>
        <JourneyPhasesCard
          client={client}
          consultation={consultation}
          onSavePhases={onSavePhases}
        />
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────
// Reprend la charte journey.css : ivoire (var(--jrn-surface)),
// vert sombre #1A2E1F, accents ocre (warn) et sage (go).

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
  paddingBottom: 38,
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
  height: 28,
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
