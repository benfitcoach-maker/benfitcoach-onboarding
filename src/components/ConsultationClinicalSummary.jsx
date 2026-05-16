// ─── ConsultationClinicalSummary ────────────────────────────────────────
// V97.17.8 — Affichage compact des chips cliniques d'une consultation passee.
//
// La modal LogConsultationModal (V97.17.6) stocke des chips structurees dans
// consultations_log[].clinical. Avant V97.17.8, ces donnees dormaient en DB
// sans aucune visibilite cote Anissa apres le save.
//
// Ce composant rend un resume scan-friendly inline dans la liste des
// consultations sur la page Suivi etape 8.
//
// Format compact : 1-2 lignes max. Si pas de clinical → null (backward compat).

// Labels lisibles cote Anissa (cohesion avec la modal source)
const LABELS = {
  // Symptomes (5 dimensions x 3 valeurs)
  symptoms: {
    digestion: 'Digestion',
    energy: 'Energie',
    sleep: 'Sommeil',
    transit: 'Transit',
    stress: 'Stress',
  },
  symptomValues: {
    good:  { label: 'OK',        tone: 'ok' },
    mixed: { label: 'mitige',    tone: 'mixed' },
    bad:   { label: 'difficile', tone: 'bad' },
  },
  // Adherence (2 dimensions x 3 valeurs)
  adherence: {
    food: 'Alimentation',
    supplements: 'Supplements',
  },
  adherenceValues: {
    good:    { label: 'suivi',   tone: 'ok' },
    partial: { label: 'partiel', tone: 'mixed' },
    low:     { label: 'faible',  tone: 'bad' },
  },
  // Evolution
  evolutionValues: {
    improved: { label: 'Amelioration', tone: 'ok' },
    stable:   { label: 'Stable',       tone: 'neutral' },
    worsened: { label: 'Aggravation',  tone: 'bad' },
  },
  // Decision
  decisionValues: {
    continue:   { label: 'Poursuivre la phase',         tone: 'neutral' },
    adapt:      { label: 'Adapter le protocole',        tone: 'go' },
    transition: { label: 'Transition phase suivante',   tone: 'go' },
    newVersion: { label: 'Nouvelle version complete',   tone: 'go' },
  },
};

function toneColor(tone) {
  switch (tone) {
    case 'ok':      return { bg: 'rgba(46, 94, 62, 0.10)',    fg: '#2E5E3E' };
    case 'mixed':   return { bg: 'rgba(184, 134, 38, 0.10)',  fg: '#785a1a' };
    case 'bad':     return { bg: 'rgba(160, 64, 64, 0.08)',   fg: '#a04040' };
    case 'go':      return { bg: 'rgba(26, 46, 31, 0.08)',    fg: '#1A2E1F' };
    case 'neutral':
    default:        return { bg: 'rgba(26, 46, 31, 0.04)',    fg: '#1A2E1F' };
  }
}

export default function ConsultationClinicalSummary({ clinical }) {
  if (!clinical || typeof clinical !== 'object') return null;

  const symptomsEntries = Object.entries(clinical.symptoms || {}).filter(([, v]) => !!v);
  const adherenceEntries = Object.entries(clinical.adherence || {}).filter(([, v]) => !!v);
  const evolution = clinical.evolution;
  const decision = clinical.decision;

  const hasAny =
    symptomsEntries.length > 0 ||
    adherenceEntries.length > 0 ||
    evolution ||
    decision;
  if (!hasAny) return null;

  return (
    <div style={containerStyle}>
      {/* Symptomes */}
      {symptomsEntries.length > 0 && (
        <div style={rowStyle}>
          <span style={labelHeadStyle}>Symptomes</span>
          <div style={chipsRowStyle}>
            {symptomsEntries.map(([key, value]) => {
              const symLabel = LABELS.symptoms[key] || key;
              const v = LABELS.symptomValues[value];
              if (!v) return null;
              const col = toneColor(v.tone);
              return (
                <span
                  key={key}
                  style={{ ...chipStyle, background: col.bg, color: col.fg }}
                  title={`${symLabel} : ${v.label}`}
                >
                  {symLabel} <span style={chipValueStyle}>· {v.label}</span>
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Adherence */}
      {adherenceEntries.length > 0 && (
        <div style={rowStyle}>
          <span style={labelHeadStyle}>Adherence</span>
          <div style={chipsRowStyle}>
            {adherenceEntries.map(([key, value]) => {
              const adhLabel = LABELS.adherence[key] || key;
              const v = LABELS.adherenceValues[value];
              if (!v) return null;
              const col = toneColor(v.tone);
              return (
                <span
                  key={key}
                  style={{ ...chipStyle, background: col.bg, color: col.fg }}
                  title={`${adhLabel} : ${v.label}`}
                >
                  {adhLabel} <span style={chipValueStyle}>· {v.label}</span>
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Evolution + Decision sur la meme ligne (verdict + suite) */}
      {(evolution || decision) && (
        <div style={rowStyle}>
          <span style={labelHeadStyle}>Verdict</span>
          <div style={chipsRowStyle}>
            {evolution && LABELS.evolutionValues[evolution] && (() => {
              const v = LABELS.evolutionValues[evolution];
              const col = toneColor(v.tone);
              return (
                <span
                  style={{ ...chipStyle, background: col.bg, color: col.fg }}
                  title={`Evolution : ${v.label}`}
                >
                  {v.label}
                </span>
              );
            })()}
            {decision && LABELS.decisionValues[decision] && (() => {
              const v = LABELS.decisionValues[decision];
              const col = toneColor(v.tone);
              return (
                <span
                  style={{ ...chipStyle, background: col.bg, color: col.fg, fontWeight: 600 }}
                  title={`Decision : ${v.label}`}
                >
                  → {v.label}
                </span>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────

const containerStyle = {
  marginTop: 8,
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
};

const rowStyle = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 8,
  flexWrap: 'wrap',
};

const labelHeadStyle = {
  fontSize: 9.5,
  fontWeight: 700,
  letterSpacing: '.1em',
  textTransform: 'uppercase',
  color: 'var(--jrn-text-muted, #6b6f6b)',
  minWidth: 80,
  marginTop: 4,
};

const chipsRowStyle = {
  display: 'flex',
  gap: 4,
  flexWrap: 'wrap',
};

const chipStyle = {
  fontSize: 11,
  padding: '3px 8px',
  borderRadius: 999,
  fontFamily: 'var(--jrn-font-ui, system-ui)',
  fontWeight: 500,
  whiteSpace: 'nowrap',
};

const chipValueStyle = {
  opacity: 0.7,
  fontWeight: 400,
};
