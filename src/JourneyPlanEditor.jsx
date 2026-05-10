// ─────────────────────────────────────────────────────────────────
// Phase J — Editeur de plan minimal pour Etape 6 du parcours
// Date : 2026-05-10
//
// UI propre alignee sur le design system journey.css. Remplace l'embed
// de NutritionConsultation dans l'etape 6.
//
// Scope V1 :
//   - Lit le dernier plan sauvegarde (table nutrition_consultations)
//   - Bouton "Generer avec l'IA" → modal simple → callClaude → adoption
//   - Textarea editable du markdown
//   - Sauvegarde Supabase (insert nouvelle consultation)
//
// HORS scope V1 (acces via Profil ou plus tard) :
//   - Generation supplements separee
//   - Fiche frigo
//   - App cliente sync
//   - Composer beta
//   - Multi-versions / history
//
// Si Anissa a besoin de ces features, elle peut ouvrir l'editeur expert
// classique via le bouton "Mode expert" en bas.
// ─────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabaseClient';
import { saveNutritionConsultation, getNutritionConsultations } from './store';
import { callClaude } from './services/anthropic';
import { buildSystemPromptFr } from './services/prompts/nutrition/fr';
import { COACH_IDENTITY } from './services/coachIdentity';

export default function JourneyPlanEditor({ client, onPlanSaved }) {
  const [planText, setPlanText] = useState('');
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showGenModal, setShowGenModal] = useState(false);
  const [genNote, setGenNote] = useState('');
  const [genResult, setGenResult] = useState(null);
  const [error, setError] = useState(null);

  const loadLatest = useCallback(async () => {
    if (!client?.id) {
      setLoadingInitial(false);
      return;
    }
    setLoadingInitial(true);
    // 1) Local store first (rapide)
    const local = getNutritionConsultations(client.id);
    if (local && local.length > 0) {
      setPlanText(local[0].nutritionPlan || '');
      setLoadingInitial(false);
      return;
    }
    // 2) Sinon Supabase
    const { data } = await supabase
      .from('nutrition_consultations')
      .select('nutrition_plan, plan_text')
      .eq('client_id', client.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setPlanText(data?.nutrition_plan || data?.plan_text || '');
    setLoadingInitial(false);
  }, [client?.id]);

  useEffect(() => { loadLatest(); }, [loadLatest]);

  // ─── Sauvegarde ──────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const consultation = {
        clientId: client.id,
        nutritionPlan: planText,
        createdAt: new Date().toISOString(),
        status: 'a_valider',
        consultantName: COACH_IDENTITY?.name || 'Anissa',
      };
      await saveNutritionConsultation(consultation);
      onPlanSaved?.();
    } catch (e) {
      setError(e?.message || 'Erreur sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  // ─── Generation IA ──────────────────────────────────────────
  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    setGenResult(null);
    try {
      const form = client.form || {};
      const planMode = form.consultationType === 'oneshot' ? 'oneshot' : 'followup';
      const system = buildSystemPromptFr(form, {
        isFollowup: false,
        clientFormule: client.formule || 'nutrition',
        followupWeek: 0,
        planMode,
      });
      const user = buildMinimalUserMessage(client, form, genNote);
      const result = await callClaude({
        system,
        user,
        model: 'claude-sonnet-4-20250514',
        maxTokens: 16000,
      });
      setGenResult(typeof result === 'string' ? result : result?.text || JSON.stringify(result));
    } catch (e) {
      setError(e?.message || 'Erreur génération IA');
    } finally {
      setGenerating(false);
    }
  };

  const adoptGenResult = () => {
    if (!genResult) return;
    setPlanText(genResult);
    setGenResult(null);
    setShowGenModal(false);
    setGenNote('');
  };

  if (loadingInitial) {
    return <div style={{ color: 'var(--jrn-text-muted)' }}>Chargement du plan…</div>;
  }

  const hasPlan = planText.trim().length > 0;

  return (
    <div>
      <div className="jrn-actions" style={{ marginTop: 0, marginBottom: 'var(--jrn-5)' }}>
        <button onClick={() => setShowGenModal(true)} className="jrn-btn jrn-btn--primary">
          {hasPlan ? 'Régénérer avec l\'IA' : 'Générer avec l\'IA'}
        </button>
        {hasPlan && (
          <button onClick={handleSave} disabled={saving} className="jrn-btn jrn-btn--soft">
            {saving ? 'Sauvegarde…' : 'Sauvegarder'}
          </button>
        )}
      </div>

      {!hasPlan && (
        <div className="jrn-surface jrn-surface--quiet" style={{ textAlign: 'center', padding: 'var(--jrn-10)' }}>
          <p style={{ margin: 0, color: 'var(--jrn-text-muted)' }}>
            Aucun plan pour le moment.<br />
            Cliquez sur <strong>Générer avec l'IA</strong> pour créer un premier brouillon.
          </p>
        </div>
      )}

      {hasPlan && (
        <textarea
          value={planText}
          onChange={(e) => setPlanText(e.target.value)}
          rows={28}
          className="jrn-textarea"
          style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 13, lineHeight: 1.65 }}
          placeholder="Le plan généré apparaîtra ici en markdown. Vous pouvez l'éditer librement."
        />
      )}

      {error && <div className="jrn-error">⚠ {error}</div>}

      {/* ─── Modal de génération ─────────────────────────────────── */}
      {showGenModal && (
        <GenerationModal
          generating={generating}
          result={genResult}
          note={genNote}
          onNoteChange={setGenNote}
          onCancel={() => {
            setShowGenModal(false);
            setGenResult(null);
            setGenNote('');
            setError(null);
          }}
          onGenerate={handleGenerate}
          onAdopt={adoptGenResult}
          error={error}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Modal de génération
// ═══════════════════════════════════════════════════════════════════

function GenerationModal({ generating, result, note, onNoteChange, onCancel, onGenerate, onAdopt, error }) {
  return (
    <div style={modalOverlayStyle} onClick={(e) => {
      if (e.target === e.currentTarget && !generating) onCancel();
    }}>
      <div style={modalCardStyle}>
        <header style={{ marginBottom: 'var(--jrn-5)' }}>
          <p className="jrn-step-eyebrow">Génération IA</p>
          <h3 style={{ fontFamily: 'var(--jrn-font-display)', fontStyle: 'italic', fontSize: 'var(--jrn-text-2xl)', margin: '4px 0 0', fontWeight: 500, color: 'var(--jrn-text)' }}>
            Nouveau plan nutritionnel
          </h3>
        </header>

        {!result && (
          <>
            <label className="jrn-label" htmlFor="gen-note">Note pour l'IA (optionnel)</label>
            <textarea
              id="gen-note"
              value={note}
              onChange={(e) => onNoteChange(e.target.value)}
              rows={4}
              className="jrn-textarea"
              placeholder="Précisions sur le contexte, contraintes spécifiques, axes prioritaires…"
              disabled={generating}
            />
            <p style={{ marginTop: 'var(--jrn-3)', fontSize: 'var(--jrn-text-xs)', color: 'var(--jrn-text-muted)', lineHeight: 1.6 }}>
              L'IA utilisera l'anamnèse, les objectifs et la synthèse résultats pour générer un plan complet (4 semaines, menus, listes de courses).
            </p>

            <div className="jrn-actions" style={{ marginTop: 'var(--jrn-6)' }}>
              <button onClick={onGenerate} disabled={generating} className="jrn-btn jrn-btn--primary">
                {generating ? 'Génération en cours…' : 'Lancer la génération'}
              </button>
              <button onClick={onCancel} disabled={generating} className="jrn-btn jrn-btn--ghost">
                Annuler
              </button>
            </div>
            {generating && (
              <p style={{ marginTop: 'var(--jrn-3)', fontSize: 'var(--jrn-text-xs)', color: 'var(--jrn-text-muted)' }}>
                Cela peut prendre 30 à 90 secondes selon la complexité du profil.
              </p>
            )}
          </>
        )}

        {result && (
          <>
            <p className="jrn-label">Aperçu du plan généré</p>
            <div style={previewBoxStyle}>{result.slice(0, 1200)}{result.length > 1200 ? '…' : ''}</div>
            <p style={{ marginTop: 'var(--jrn-3)', fontSize: 'var(--jrn-text-xs)', color: 'var(--jrn-text-muted)' }}>
              {result.length} caractères. Adopter remplace le plan actuel par ce nouveau brouillon.
            </p>
            <div className="jrn-actions" style={{ marginTop: 'var(--jrn-5)' }}>
              <button onClick={onAdopt} className="jrn-btn jrn-btn--primary">
                Adopter ce plan
              </button>
              <button onClick={onGenerate} className="jrn-btn jrn-btn--soft">
                Régénérer
              </button>
              <button onClick={onCancel} className="jrn-btn jrn-btn--ghost">
                Annuler
              </button>
            </div>
          </>
        )}

        {error && <div className="jrn-error">⚠ {error}</div>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// User message minimaliste pour la génération
// ═══════════════════════════════════════════════════════════════════

function buildMinimalUserMessage(client, form, extraNote) {
  const journey = client.journey_state || {};
  const lines = [];
  lines.push(`Profil cliente : ${form.prenom || 'Cliente'}, ${form.sexe || 'genre non renseigné'}`);
  if (form.dateNaissance) lines.push(`Date de naissance : ${form.dateNaissance}`);
  if (form.poids) lines.push(`Poids : ${form.poids}`);
  if (form.taille) lines.push(`Taille : ${form.taille}`);
  if (form.objectifs) lines.push(`\nObjectifs : ${form.objectifs}`);
  if (form.symptomes) lines.push(`Symptomes : ${form.symptomes}`);
  if (form.pathologies) lines.push(`Pathologies : ${form.pathologies}`);
  if (form.allergies) lines.push(`Allergies/intolérances : ${form.allergies}`);
  if (form.activite) lines.push(`Activité : ${form.activite}`);
  if (form.sommeil) lines.push(`Sommeil : ${form.sommeil}`);
  if (form.stress) lines.push(`Stress : ${form.stress}`);
  if (form.digestion) lines.push(`Digestion : ${form.digestion}`);
  if (journey.results_synthesis) {
    lines.push(`\n--- Synthèse résultats analyses ---\n${journey.results_synthesis}`);
  }
  if (extraNote && extraNote.trim()) {
    lines.push(`\n--- Note additionnelle Anissa ---\n${extraNote.trim()}`);
  }
  lines.push(`\nGénère le plan nutritionnel personnalisé complet (sections 1 à 7) avec menus variés, listes de courses par semaine, et alternatives naturelles.`);
  return lines.join('\n');
}

// ═══════════════════════════════════════════════════════════════════
// Styles modal
// ═══════════════════════════════════════════════════════════════════

const modalOverlayStyle = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(15, 15, 15, 0.5)',
  backdropFilter: 'blur(4px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 100,
  padding: 24,
};
const modalCardStyle = {
  background: 'var(--jrn-surface)',
  borderRadius: 'var(--jrn-radius-lg)',
  padding: 'var(--jrn-8)',
  maxWidth: 640,
  width: '100%',
  maxHeight: '85vh',
  overflowY: 'auto',
  boxShadow: 'var(--jrn-shadow-lg)',
  fontFamily: 'var(--jrn-font-body)',
};
const previewBoxStyle = {
  marginTop: 'var(--jrn-2)',
  padding: 'var(--jrn-4)',
  background: 'var(--jrn-surface-alt)',
  border: '1px solid var(--jrn-border)',
  borderRadius: 'var(--jrn-radius)',
  maxHeight: 280,
  overflowY: 'auto',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: 12,
  lineHeight: 1.6,
  color: 'var(--jrn-text-soft)',
  whiteSpace: 'pre-wrap',
};
