// ─── ObservabilityPanel.jsx ─────────────────────────────────────────────
// V97.21 (OBS-2) — Dashboard stats des generations de plans IA.
//
// Cf service : services/planObservability.js
// Cf table : plan_generation_observability (V97.20)
//
// Modal avec :
//   - Filtre periode (7j / 30j / 90j)
//   - 4 KPI cards : volume, avg violations, avg slop, taux accept Haiku
//   - Bar chart simple "generations par semaine"
//   - Tables : top guardrails actifs, profils sous-couverts, top categories slop
//
// Lecture seule. Pour drill-down (voir une gen specifique) : Supabase Studio.

import { useState, useEffect } from 'react';
import { listObservability, aggregateObservability } from '../services/planObservability';
import { CATEGORY_LABELS as SLOP_CATEGORY_LABELS } from '../services/prompts/nutrition/_antiSlop.fr';

export default function ObservabilityPanel({ onClose }) {
  const [daysBack, setDaysBack] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const [rows, setRows] = useState([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const res = await listObservability({ daysBack, limit: 500 });
      if (!alive) return;
      if (res.ok) {
        setRows(res.data);
        setStats(aggregateObservability(res.data));
        setError(null);
      } else {
        setError(res.error || 'erreur chargement');
      }
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [daysBack]);

  return (
    <div style={overlayStyle} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={modalStyle}>
        <div style={headerStyle}>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Stats IA — Générations de plans</h2>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6b6f6b' }}>
              Mesure de la couverture clinique, des patterns AI détectés, et de l&apos;usage de la reformulation Haiku.
            </p>
          </div>
          <button onClick={onClose} style={closeBtnStyle} title="Fermer">×</button>
        </div>

        {/* Filtres */}
        <div style={{
          display: 'flex', gap: 6, padding: '12px 22px',
          borderBottom: '1px solid rgba(0,0,0,.08)',
        }}>
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDaysBack(d)}
              style={{
                background: daysBack === d ? '#2E5E3E' : 'white',
                color: daysBack === d ? 'white' : '#2a2d2a',
                border: `1px solid ${daysBack === d ? '#2E5E3E' : 'rgba(0,0,0,.15)'}`,
                padding: '5px 14px', borderRadius: 6,
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}
            >
              {d}j
            </button>
          ))}
        </div>

        <div style={bodyStyle}>
          {loading && <div style={{ padding: 30, textAlign: 'center', color: '#6b6f6b' }}>Chargement…</div>}
          {error && (
            <div style={{
              padding: 12, background: 'rgba(184,64,64,.08)',
              border: '1px solid rgba(184,64,64,.3)', borderRadius: 8,
              color: '#a04040', fontSize: 13,
            }}>
              Erreur : {error}
            </div>
          )}
          {!loading && !error && stats && (
            <>
              {stats.total === 0 ? (
                <div style={{ padding: 30, textAlign: 'center', color: '#6b6f6b' }}>
                  Aucune génération sur les {daysBack} derniers jours.
                  <div style={{ fontSize: 11, marginTop: 6, fontStyle: 'italic' }}>
                    Les stats apparaîtront ici dès la prochaine génération de plan.
                  </div>
                </div>
              ) : (
                <>
                  {/* KPI cards */}
                  <div style={{
                    display: 'grid', gap: 10,
                    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                    marginBottom: 18,
                  }}>
                    <KpiCard
                      label="Générations"
                      value={stats.total}
                      hint={`composer beta : ${Math.round(stats.composerBetaRatio * 100)}%`}
                    />
                    <KpiCard
                      label="Violations / plan"
                      value={stats.avgViolations.toFixed(1)}
                      hint="phrases interdites détectées en moyenne"
                      tone={stats.avgViolations > 1 ? 'warn' : 'ok'}
                    />
                    <KpiCard
                      label="Patterns slop / plan"
                      value={stats.avgSlopFlags.toFixed(1)}
                      hint="AI-flavored patterns en moyenne"
                      tone={stats.avgSlopFlags > 5 ? 'warn' : 'ok'}
                    />
                    <KpiCard
                      label="Taux accept Haiku"
                      value={stats.haikuAcceptRate !== null
                        ? `${Math.round(stats.haikuAcceptRate * 100)}%`
                        : '—'}
                      hint={`${stats.haikuAccepted}/${stats.haikuRequested} reformulations`}
                    />
                  </div>

                  {/* Bar chart par semaine */}
                  <Section title="Générations par semaine">
                    <BarChart data={stats.generationsByWeek} />
                  </Section>

                  {/* Top guardrails appliqués */}
                  <Section title="Garde-fous activés (top profils)">
                    <SimpleTable
                      rows={stats.topGuardrails}
                      cols={[
                        { label: 'Profil', key: 'profile_key', code: true },
                        { label: 'Générations', key: 'count' },
                      ]}
                      emptyMsg="Aucun guardrail activé sur la période."
                    />
                  </Section>

                  {/* Profils sous-couverts */}
                  <Section title="Profils sous-couverts (micros/évictions manquantes)">
                    <SimpleTable
                      rows={stats.topMissingProfiles}
                      cols={[
                        { label: 'Profil', key: 'profile_key', code: true },
                        { label: 'Plans concernés', key: 'gens' },
                        { label: 'Items manquants / plan', key: 'avgMissing', format: (v) => v.toFixed(1) },
                      ]}
                      emptyMsg="Tous les guardrails couvrent leurs micros/évictions ✓"
                    />
                  </Section>

                  {/* Top categories anti-slop */}
                  <Section title="Patterns AI les plus fréquents">
                    <SimpleTable
                      rows={stats.topSlopCategories}
                      cols={[
                        { label: 'Catégorie', key: 'category', format: (v) => SLOP_CATEGORY_LABELS[v] || v },
                        { label: 'Occurrences', key: 'count' },
                      ]}
                      emptyMsg="Aucun pattern slop détecté (ou audit jamais lancé)."
                    />
                  </Section>

                  {/* Recent generations */}
                  <Section title={`Dernières générations (${Math.min(rows.length, 10)})`}>
                    <RecentTable rows={rows.slice(0, 10)} />
                  </Section>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sous-composants ────────────────────────────────────────────────────

function KpiCard({ label, value, hint, tone }) {
  const fg = tone === 'warn' ? '#785a1a' : tone === 'bad' ? '#a04040' : '#2a2d2a';
  return (
    <div style={{
      background: 'white',
      border: '1px solid rgba(0,0,0,.08)',
      borderRadius: 10,
      padding: 14,
    }}>
      <div style={{ fontSize: 11, color: '#6b6f6b', textTransform: 'uppercase', letterSpacing: '.06em' }}>
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: fg, lineHeight: 1.1, margin: '6px 0 4px' }}>
        {value}
      </div>
      {hint && <div style={{ fontSize: 11, color: '#9a9d9a' }}>{hint}</div>}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <h3 style={{
        margin: '0 0 8px', fontSize: 13, fontWeight: 600, color: '#2a2d2a',
      }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function BarChart({ data }) {
  if (!data || data.length === 0) {
    return <div style={emptyStyle}>Aucune donnée.</div>;
  }
  const maxCount = Math.max(...data.map((d) => d.count), 1);
  return (
    <div style={{
      background: 'white', border: '1px solid rgba(0,0,0,.08)',
      borderRadius: 8, padding: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 100 }}>
        {data.map((d) => {
          const heightPct = (d.count / maxCount) * 100;
          return (
            <div key={d.weekStart} style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'flex-end', gap: 4,
            }}>
              <div style={{
                fontSize: 10, color: '#6b6f6b', fontWeight: 600,
              }}>{d.count}</div>
              <div
                title={`Semaine du ${d.weekStart} : ${d.count} générations`}
                style={{
                  width: '100%', maxWidth: 40,
                  height: `${heightPct}%`, minHeight: 4,
                  background: '#2E5E3E', borderRadius: '3px 3px 0 0',
                }}
              />
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 4, marginTop: 6, fontSize: 9, color: '#9a9d9a' }}>
        {data.map((d) => (
          <div key={d.weekStart} style={{ flex: 1, textAlign: 'center' }}>
            {d.weekStart.slice(5)}
          </div>
        ))}
      </div>
    </div>
  );
}

function SimpleTable({ rows, cols, emptyMsg }) {
  if (!rows || rows.length === 0) {
    return <div style={emptyStyle}>{emptyMsg}</div>;
  }
  return (
    <div style={{
      background: 'white', border: '1px solid rgba(0,0,0,.08)',
      borderRadius: 8, overflow: 'hidden',
    }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c.key} style={{
                textAlign: 'left', padding: '8px 12px',
                fontSize: 11, fontWeight: 600, color: '#6b6f6b',
                textTransform: 'uppercase', letterSpacing: '.05em',
                background: 'rgba(0,0,0,.03)',
                borderBottom: '1px solid rgba(0,0,0,.05)',
              }}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{
              borderBottom: i < rows.length - 1 ? '1px solid rgba(0,0,0,.04)' : 'none',
            }}>
              {cols.map((c) => {
                const v = r[c.key];
                const formatted = c.format ? c.format(v) : v;
                return (
                  <td key={c.key} style={{ padding: '6px 12px', verticalAlign: 'top' }}>
                    {c.code ? <code style={{ fontSize: 11 }}>{formatted}</code> : formatted}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RecentTable({ rows }) {
  if (!rows || rows.length === 0) {
    return <div style={emptyStyle}>Aucune génération.</div>;
  }
  return (
    <div style={{
      background: 'white', border: '1px solid rgba(0,0,0,.08)',
      borderRadius: 8, overflow: 'hidden',
    }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
        <thead>
          <tr>
            <th style={thStyle}>Date</th>
            <th style={thStyle}>Profil</th>
            <th style={thStyle}>GR</th>
            <th style={thStyle}>Viol</th>
            <th style={thStyle}>Slop</th>
            <th style={thStyle}>Haiku</th>
            <th style={thStyle}>Beta</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const date = r.generated_at ? new Date(r.generated_at) : null;
            const fmtDate = date
              ? date.toLocaleString('fr-CH', {
                  month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
                })
              : '—';
            return (
              <tr key={r.id} style={{ borderBottom: '1px solid rgba(0,0,0,.04)' }}>
                <td style={tdStyle}>{fmtDate}</td>
                <td style={tdStyle}>
                  {(r.detected_profile_tags || []).slice(0, 2).map((t) => (
                    <code key={t} style={{ fontSize: 10, marginRight: 3 }}>{t}</code>
                  ))}
                  {(r.detected_profile_tags || []).length > 2 && (
                    <span style={{ fontSize: 10, color: '#9a9d9a' }}>
                      +{r.detected_profile_tags.length - 2}
                    </span>
                  )}
                </td>
                <td style={tdStyle}>{(r.guardrails_applied || []).length}</td>
                <td style={{
                  ...tdStyle,
                  color: r.violations_count > 0 ? '#a04040' : '#2a2d2a',
                  fontWeight: r.violations_count > 0 ? 600 : 400,
                }}>{r.violations_count}</td>
                <td style={tdStyle}>{r.slop_flags_count}</td>
                <td style={tdStyle}>
                  {r.slop_rewrites_accepted_count}/{r.slop_rewrites_requested_count}
                </td>
                <td style={tdStyle}>{r.composer_beta ? '✓' : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── styles ──────────────────────────────────────────────────────────────

const overlayStyle = {
  position: 'fixed', inset: 0,
  background: 'rgba(0,0,0,.5)',
  zIndex: 9999,
  display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
  padding: '40px 20px',
  overflowY: 'auto',
};

const modalStyle = {
  background: '#fbf9f4', borderRadius: 14,
  maxWidth: 980, width: '100%',
  boxShadow: '0 20px 60px rgba(0,0,0,.25)',
  display: 'flex', flexDirection: 'column',
  maxHeight: 'calc(100vh - 80px)',
};

const headerStyle = {
  padding: '18px 22px',
  borderBottom: '1px solid rgba(0,0,0,.08)',
  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
  gap: 12,
};

const closeBtnStyle = {
  background: 'transparent', border: 'none', cursor: 'pointer',
  fontSize: 24, lineHeight: 1, color: '#6b6f6b', padding: 0,
};

const bodyStyle = {
  padding: 18, overflowY: 'auto', flex: 1,
};

const emptyStyle = {
  padding: 16, fontSize: 12, color: '#9a9d9a', fontStyle: 'italic', textAlign: 'center',
  background: 'white', border: '1px dashed rgba(0,0,0,.1)', borderRadius: 8,
};

const thStyle = {
  textAlign: 'left', padding: '7px 10px', fontSize: 10,
  fontWeight: 600, color: '#6b6f6b',
  textTransform: 'uppercase', letterSpacing: '.05em',
  background: 'rgba(0,0,0,.03)',
  borderBottom: '1px solid rgba(0,0,0,.05)',
};

const tdStyle = {
  padding: '6px 10px',
};
