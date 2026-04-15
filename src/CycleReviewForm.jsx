import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

const ANISSA_LOGO = 'https://cdn.prod.website-files.com/699eb56ec2e8b94e41cfa06c/69d411dfafbbe967e3d992c4_Design_sans_titre_1_-removebg-preview.png';

const SECTIONS = [
  { id: 1, label: 'Adhérence' },
  { id: 2, label: 'Résultats' },
  { id: 3, label: 'Ressenti' },
  { id: 4, label: 'Bilan' },
];

const MAIN_ISSUE_OPTIONS = [
  { value: 'time',       label: 'Manque de temps' },
  { value: 'taste',      label: 'Aliments pas appréciés' },
  { value: 'hunger',     label: 'Faim entre les repas' },
  { value: 'cost',       label: 'Coût alimentaire' },
  { value: 'social',     label: 'Social / restaurants' },
  { value: 'motivation', label: 'Motivation' },
  { value: 'complexity', label: 'Plan trop complexe' },
  { value: 'other',      label: 'Autre' },
];

// Réutilisation exacte du pattern BtnGroup de QuestionnaireClient
function BtnGroup({ value, onChange, options, columns = 2 }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${columns}, 1fr)`,
      gap: 8,
    }}>
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          className={`q-checkbox-btn ${value === opt.value ? 'q-checkbox-active' : ''}`}
          onClick={() => onChange(opt.value)}
          style={{ textAlign: 'center', padding: '12px 8px' }}
        >
          <span className="q-check-mark">{value === opt.value ? '✓' : ''}</span>
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export default function CycleReviewForm({ token }) {
  const [section, setSection] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [clientName, setClientName] = useState('');
  const [reviewId, setReviewId] = useState(null);

  const [form, setForm] = useState({
    adherence: '',
    cheats: '',
    progress: '',
    energy: '',
    digestion: '',
    difficulty: '',
    organisation: '',
    main_issue: '',
    main_issue_text: '',
  });

  // Charger le bilan via token
  useEffect(() => {
    if (!supabase || !token) {
      setLoading(false);
      setError('Lien invalide.');
      return;
    }
    supabase
      .from('cycle_reviews')
      .select('id, status, client_id, clients(prenom)')
      .eq('token', token)
      .single()
      .then(({ data, error: err }) => {
        setLoading(false);
        if (err || !data) {
          setError('Lien introuvable ou expiré.');
          return;
        }
        if (data.status === 'submitted') {
          setSubmitted(true);
          return;
        }
        setReviewId(data.id);
        setClientName(data.clients?.prenom || '');
      });
  }, [token]);

  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async () => {
    if (!reviewId) return;
    setSubmitting(true);
    setError('');
    try {
      const { error: err } = await supabase
        .from('cycle_reviews')
        .update({
          status: 'submitted',
          submitted_at: new Date().toISOString(),
          adherence: form.adherence,
          cheats: form.cheats,
          progress: form.progress,
          energy: form.energy,
          digestion: form.digestion,
          difficulty: form.difficulty,
          organisation: form.organisation,
          main_issue: form.main_issue,
          main_issue_text: form.main_issue_text || null,
        })
        .eq('token', token)
        .eq('status', 'sent');

      if (err) throw err;
      setSubmitted(true);
    } catch (e) {
      setError('Erreur lors de l\'envoi. Réessayez.');
    } finally {
      setSubmitting(false);
    }
  };

  const progressPct = ((section - 1) / (SECTIONS.length - 1)) * 100;

  // Loading
  if (loading) {
    return (
      <div className="q-container">
        <div className="q-card" style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ color: '#8abf9a', fontSize: '.9rem' }}>Chargement...</div>
        </div>
      </div>
    );
  }

  // Error
  if (error && !reviewId) {
    return (
      <div className="q-container">
        <div className="q-card" style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ color: '#f87171', fontSize: '.9rem' }}>{error}</div>
        </div>
      </div>
    );
  }

  // Confirmation après soumission
  if (submitted) {
    return (
      <div className="q-container">
        <div className="q-card" style={{ textAlign: 'center', padding: 48 }}>
          <img src={ANISSA_LOGO} alt="Anissa" style={{ height: 48, marginBottom: 20 }} />
          <div style={{ fontSize: '2rem', marginBottom: 12 }}>✅</div>
          <h2 style={{ color: '#8abf9a', marginBottom: 8 }}>Bilan envoyé !</h2>
          <p style={{ color: '#b0c4a8', fontSize: '.88rem', lineHeight: 1.6 }}>
            Merci {clientName}. Anissa va analyser ton bilan
            et ajuster ton plan sous 48h.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="q-container">
      <div className="q-card">
        {/* Header */}
        <div className="q-header">
          <img src={ANISSA_LOGO} alt="Anissa" className="q-logo" />
          <h1 className="q-title">Bilan 4 semaines</h1>
          {clientName && (
            <p className="q-subtitle">Bonjour {clientName} 👋</p>
          )}
        </div>

        {/* Progress */}
        <div className="q-progress-bar">
          <div className="q-progress-fill" style={{ width: `${progressPct}%` }} />
        </div>
        <div className="q-progress-labels">
          {SECTIONS.map(s => (
            <span
              key={s.id}
              className={`q-progress-label ${section === s.id ? 'q-progress-label-active' : ''} ${s.id < section ? 'q-progress-label-done' : ''}`}
              onClick={() => s.id < section && setSection(s.id)}
            >
              {s.label}
            </span>
          ))}
        </div>

        {error && <div className="q-error-banner">{error}</div>}

        {/* Section 1 — Adhérence */}
        {section === 1 && (
          <div className="q-section">
            <h2 className="q-section-title">Adhérence au plan</h2>
            <div className="q-field">
              <label className="q-label">Combien de jours as-tu suivi le plan ?</label>
              <BtnGroup
                value={form.adherence}
                onChange={v => update('adherence', v)}
                options={[
                  { value: '100', label: 'Tous les jours' },
                  { value: '75',  label: 'La plupart (75%)' },
                  { value: '50',  label: 'La moitié (50%)' },
                  { value: '<50', label: 'Moins de la moitié' },
                ]}
                columns={2}
              />
            </div>
            <div className="q-field">
              <label className="q-label">Écarts alimentaires ?</label>
              <BtnGroup
                value={form.cheats}
                onChange={v => update('cheats', v)}
                options={[
                  { value: 'none',       label: 'Aucun' },
                  { value: 'occasional', label: 'Occasionnels' },
                  { value: 'frequent',   label: 'Fréquents' },
                ]}
                columns={3}
              />
            </div>
          </div>
        )}

        {/* Section 2 — Résultats */}
        {section === 2 && (
          <div className="q-section">
            <h2 className="q-section-title">Tes résultats</h2>
            <div className="q-field">
              <label className="q-label">Tu avances vers ton objectif ?</label>
              <BtnGroup
                value={form.progress}
                onChange={v => update('progress', v)}
                options={[
                  { value: 'yes',    label: 'Oui clairement' },
                  { value: 'little', label: 'Un peu' },
                  { value: 'none',   label: 'Pas encore' },
                ]}
                columns={3}
              />
            </div>
            <div className="q-field">
              <label className="q-label">Ton énergie ces 4 semaines ?</label>
              <BtnGroup
                value={form.energy}
                onChange={v => update('energy', v)}
                options={[
                  { value: 'high',   label: 'Meilleure' },
                  { value: 'normal', label: 'Stable' },
                  { value: 'low',    label: 'Moins bonne' },
                ]}
                columns={3}
              />
            </div>
            <div className="q-field">
              <label className="q-label">Ta digestion ?</label>
              <BtnGroup
                value={form.digestion}
                onChange={v => update('digestion', v)}
                options={[
                  { value: 'good',    label: 'Bonne' },
                  { value: 'average', label: 'Moyenne' },
                  { value: 'bad',     label: 'Difficile' },
                ]}
                columns={3}
              />
            </div>
          </div>
        )}

        {/* Section 3 — Ressenti */}
        {section === 3 && (
          <div className="q-section">
            <h2 className="q-section-title">Ton ressenti</h2>
            <div className="q-field">
              <label className="q-label">Le plan était...</label>
              <BtnGroup
                value={form.difficulty}
                onChange={v => update('difficulty', v)}
                options={[
                  { value: 'easy', label: 'Facile à suivre' },
                  { value: 'ok',   label: 'Correct' },
                  { value: 'hard', label: 'Trop difficile' },
                ]}
                columns={3}
              />
            </div>
            <div className="q-field">
              <label className="q-label">L'organisation des repas ?</label>
              <BtnGroup
                value={form.organisation}
                onChange={v => update('organisation', v)}
                options={[
                  { value: 'simple',  label: 'Simple' },
                  { value: 'medium',  label: 'Gérable' },
                  { value: 'complex', label: 'Compliquée' },
                ]}
                columns={3}
              />
            </div>
          </div>
        )}

        {/* Section 4 — Bilan */}
        {section === 4 && (
          <div className="q-section">
            <h2 className="q-section-title">Ce qui a été difficile</h2>
            <div className="q-field">
              <label className="q-label">Problème principal ?</label>
              <BtnGroup
                value={form.main_issue}
                onChange={v => update('main_issue', v)}
                options={MAIN_ISSUE_OPTIONS}
                columns={2}
              />
            </div>
            {form.main_issue === 'other' && (
              <div className="q-field">
                <label className="q-label">Précise (optionnel)</label>
                <input
                  className="q-input"
                  maxLength={80}
                  value={form.main_issue_text}
                  onChange={e => update('main_issue_text', e.target.value)}
                  placeholder="En quelques mots..."
                />
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <div className="q-nav">
          {section > 1 && (
            <button className="q-btn-prev" onClick={() => setSection(s => s - 1)}>
              Précédent
            </button>
          )}
          <div className="q-nav-spacer" />
          {section < SECTIONS.length ? (
            <button
              className="q-btn-next"
              onClick={() => setSection(s => s + 1)}
              disabled={!form[['adherence','progress','difficulty','main_issue'][section-1]]}
            >
              Suivant
            </button>
          ) : (
            <button
              className="q-btn-submit"
              onClick={handleSubmit}
              disabled={submitting || !form.main_issue}
            >
              {submitting ? 'Envoi...' : 'Envoyer mon bilan'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
