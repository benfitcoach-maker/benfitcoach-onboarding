// ─────────────────────────────────────────────────────────────────
// Phase C — Bloc dashboard "Plans d'analyses à suivre"
// Date : 2026-05-10
//
// Compteur agrege par statut, visible dans AnissaDashboard juste
// au-dessus de "Mes clients". Donne a Anissa une vue 1 coup d'oeil
// du flux d'analyses en cours.
//
// V4 minimal : juste les 4 chiffres, pas de liste cliquable. Les
// transitions de statut se font dans la fiche cliente (AnalysisPlanCard).
// Si un chiffre devient utile a "drill", on ajoutera plus tard.
// ─────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function AnalysisPlansFollowupBlock() {
  const [counts, setCounts] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('analysis_plans')
        .select('status, updated_at');
      if (cancelled) return;
      if (error) {
        // pas de bloc si erreur (silencieux : ne pas polluer le dashboard)
        setLoading(false);
        return;
      }
      const c = { draft: 0, sent: 0, in_progress: 0, completed_recent: 0 };
      (data || []).forEach((p) => {
        if (p.status === 'draft') c.draft++;
        else if (p.status === 'sent') c.sent++;
        else if (p.status === 'in_progress') c.in_progress++;
        else if (p.status === 'completed' && p.updated_at && p.updated_at >= sevenDaysAgo) {
          c.completed_recent++;
        }
      });
      setCounts(c);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, []);

  if (loading || !counts) return null;
  const totalActive = counts.draft + counts.sent + counts.in_progress;
  if (totalActive === 0 && counts.completed_recent === 0) return null;

  return (
    <div style={blockStyle}>
      <div style={headerRowStyle}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>🧪 Plans d'analyses à suivre</span>
        <span style={{ fontSize: 11, color: '#888' }}>
          {totalActive} {totalActive > 1 ? 'plans actifs' : 'plan actif'}
        </span>
      </div>
      <div style={countsRowStyle}>
        <Counter value={counts.draft} label="Brouillons" color="#888" />
        <Counter value={counts.sent} label="Envoyés" color="#2d5a3d" />
        <Counter value={counts.in_progress} label="Résultats reçus" color="#856404" />
        <Counter value={counts.completed_recent} label="Terminés (7j)" color="#1a4028" />
      </div>
    </div>
  );
}

function Counter({ value, label, color }) {
  return (
    <div style={counterStyle}>
      <div style={{ fontSize: 24, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 10, color: '#666', marginTop: 4, textTransform: 'uppercase', letterSpacing: '.04em' }}>
        {label}
      </div>
    </div>
  );
}

// ─── Styles inline ────────────────────────────────────────────────
const blockStyle = {
  background: 'rgba(45,90,61,0.04)',
  border: '1px solid rgba(45,90,61,0.15)',
  borderRadius: 8,
  padding: 14,
  margin: '12px 0',
};
const headerRowStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 12,
};
const countsRowStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  gap: 10,
};
const counterStyle = {
  background: 'rgba(255,255,255,0.6)',
  border: '1px solid rgba(0,0,0,0.05)',
  borderRadius: 6,
  padding: '10px 8px',
  textAlign: 'center',
};
