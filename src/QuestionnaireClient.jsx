import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { addNotification } from './store';

const ANISSA_LOGO = 'https://cdn.prod.website-files.com/699eb56ec2e8b94e41cfa06c/69d411dfafbbe967e3d992c4_Design_sans_titre_1_-removebg-preview.png';

const SECTIONS = [
  { id: 1, label: 'Vous' },
  { id: 2, label: 'Sante' },
  { id: 3, label: 'Habitudes' },
  { id: 4, label: 'Ressenti' },
  { id: 5, label: 'Objectif' },
];

const OBJECTIF_OPTIONS = [
  'Perte de poids', 'Energie', 'Digestion', 'Hormones', 'Performance', 'Anti-age', 'Autre',
];

const SCALE_LABELS = {
  energieJournee: ['Faible', 'Excellent'],
  heuresSommeil: ['Mauvais', 'Excellent'],
  frequenceBallonnements: ['Difficile', 'Parfaite'],
  niveauStressActuel: ['Tres eleve', 'Aucun'],
};

function QuestionnaireClient({ clientId }) {
  const [section, setSection] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [clientName, setClientName] = useState('');

  const [form, setForm] = useState({
    prenom: '',
    nom: '',
    age: '',
    genre: '',
    poids: '',
    taille: '',
    email: '',
    telephone: '',
    profession: '',
    pathologies: '',
    traitements: '',
    allergies: '',
    nbRepas: '',
    frequenceSport: '',
    hydratation: '',
    alimentsEvites: '',
    energieJournee: '',
    heuresSommeil: '',
    frequenceBallonnements: '',
    niveauStressActuel: '',
    objectifPrincipalNutrition: [],
    pourquoiMaintenant: '',
    pretProtocole: '',
  });

  // Load existing client data
  useEffect(() => {
    if (!supabase || !clientId) {
      setLoading(false);
      setError('Lien invalide.');
      return;
    }
    supabase
      .from('clients')
      .select('prenom, form')
      .eq('id', clientId)
      .single()
      .then(({ data, error: err }) => {
        setLoading(false);
        if (err || !data) {
          setError('Client introuvable.');
          return;
        }
        setClientName(data.prenom || '');
        const f = data.form || {};
        setForm(prev => ({
          ...prev,
          prenom: f.prenom || data.prenom || '',
          nom: f.nom || '',
          age: f.age || '',
          genre: f.genre || '',
          poids: f.poids || '',
          taille: f.taille || '',
          email: f.email || '',
          telephone: f.telephone || '',
          profession: f.profession || '',
          pathologies: f.pathologies || '',
          traitements: f.traitements || '',
          allergies: f.allergies || '',
          nbRepas: f.nbRepas || '',
          frequenceSport: f.frequenceSport || '',
          hydratation: f.hydratation || '',
          alimentsEvites: f.alimentsEvites || '',
          energieJournee: f.energieJournee || '',
          heuresSommeil: f.heuresSommeil || '',
          frequenceBallonnements: f.frequenceBallonnements || '',
          niveauStressActuel: f.niveauStressActuel || '',
          objectifPrincipalNutrition: f.objectifPrincipalNutrition
            ? (typeof f.objectifPrincipalNutrition === 'string'
              ? f.objectifPrincipalNutrition.split(',').map(s => s.trim()).filter(Boolean)
              : f.objectifPrincipalNutrition)
            : [],
          pourquoiMaintenant: f.pourquoiMaintenant || '',
          pretProtocole: f.pretProtocole || '',
        }));
      });
  }, [clientId]);

  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const toggleObjectif = (opt) => {
    setForm(prev => {
      const arr = prev.objectifPrincipalNutrition;
      return {
        ...prev,
        objectifPrincipalNutrition: arr.includes(opt) ? arr.filter(v => v !== opt) : [...arr, opt],
      };
    });
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');

    // Map questionnaire fields to the NUTRITION_INITIAL_FORM fields
    const formUpdate = {
      prenom: form.prenom,
      nom: form.nom,
      age: form.age,
      genre: form.genre,
      poids: form.poids,
      taille: form.taille,
      email: form.email,
      telephone: form.telephone,
      profession: form.profession,
      pathologies: form.pathologies,
      traitements: form.traitements,
      allergies: form.allergies,
      nbRepas: form.nbRepas,
      frequenceSport: form.frequenceSport,
      hydratation: form.hydratation,
      alimentsEvites: form.alimentsEvites,
      energieJournee: form.energieJournee,
      niveauStressActuel: form.niveauStressActuel,
      objectifPrincipalNutrition: form.objectifPrincipalNutrition.join(', '),
      // Extra fields not in NUTRITION_INITIAL_FORM but useful
      heuresSommeil: form.heuresSommeil,
      frequenceBallonnements: form.frequenceBallonnements,
      pourquoiMaintenant: form.pourquoiMaintenant,
      pretProtocole: form.pretProtocole,
    };

    try {
      // Fetch existing form to merge
      const { data: existing } = await supabase
        .from('clients')
        .select('form')
        .eq('id', clientId)
        .single();

      const mergedForm = { ...(existing?.form || {}), ...formUpdate };

      const { error: err } = await supabase
        .from('clients')
        .update({
          form: mergedForm,
          prenom: form.prenom || existing?.form?.prenom || '',
          updated_at: new Date().toISOString(),
        })
        .eq('id', clientId);

      if (err) throw err;

      // Notify Anissa that questionnaire was completed
      const fullName = [form.prenom, form.nom].filter(Boolean).join(' ') || 'Client';
      addNotification({
        type: 'questionnaire_completed',
        clientId,
        clientName: fullName,
        message: `${fullName} a rempli son questionnaire`,
      });

      setSubmitted(true);
    } catch (e) {
      setError('Erreur lors de l\'envoi. Veuillez reessayer.');
      console.error(e);
    }
    setSubmitting(false);
  };

  // --- Render helpers ---

  const BtnGroup = ({ field, options, columns }) => (
    <div className="q-btn-group" style={columns ? { gridTemplateColumns: `repeat(${columns}, 1fr)` } : undefined}>
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          className={`q-btn-option ${form[field] === opt.value ? 'q-btn-active' : ''}`}
          onClick={() => update(field, opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );

  const NumericScale = ({ field, label }) => {
    const [low, high] = SCALE_LABELS[field] || ['1', '5'];
    return (
      <div className="q-field">
        <label className="q-label">{label}</label>
        <div className="q-scale-wrapper">
          <span className="q-scale-label-low">{low}</span>
          <div className="q-scale-row">
            {[1, 2, 3, 4, 5].map(n => (
              <button
                key={n}
                type="button"
                className={`q-scale-btn ${form[field] === String(n) ? 'q-scale-btn-active' : ''}`}
                onClick={() => update(field, String(n))}
              >
                {n}
              </button>
            ))}
          </div>
          <span className="q-scale-label-high">{high}</span>
        </div>
      </div>
    );
  };

  // --- Loading / Error / Submitted states ---

  if (loading) {
    return (
      <div className="q-page">
        <div className="q-container">
          <div className="q-loading">Chargement...</div>
        </div>
      </div>
    );
  }

  if (error && !form.prenom) {
    return (
      <div className="q-page">
        <div className="q-container">
          <div className="q-header">
            <img src={ANISSA_LOGO} alt="Anissa Nutrition" className="q-logo" />
          </div>
          <div className="q-error-box">{error}</div>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="q-page">
        <div className="q-container">
          <div className="q-header">
            <img src={ANISSA_LOGO} alt="Anissa Nutrition" className="q-logo" />
          </div>
          <div className="q-confirmation">
            <div className="q-confirm-icon">&#10003;</div>
            <h2>Merci{clientName ? `, ${clientName}` : ''} !</h2>
            <p>Anissa a reçu vos informations et vous contactera bientôt.</p>
          </div>
        </div>
      </div>
    );
  }

  // --- Progress bar ---
  const progressPct = ((section - 1) / (SECTIONS.length - 1)) * 100;

  return (
    <div className="q-page">
      <div className="q-container">
        {/* Header */}
        <div className="q-header">
          <img src={ANISSA_LOGO} alt="Anissa Nutrition" className="q-logo" />
          <h1 className="q-title">Questionnaire pre-consultation</h1>
          <p className="q-subtitle">Anissa Deroubaix</p>
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
              onClick={() => setSection(s.id)}
            >
              {s.label}
            </span>
          ))}
        </div>

        {/* Error banner */}
        {error && <div className="q-error-banner">{error}</div>}

        {/* Section 1 — Vous */}
        {section === 1 && (
          <div className="q-section" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h2 className="q-section-title" style={{ marginBottom: 0 }}>Vous</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label className="q-label">Prenom</label>
                <input className="q-input" value={form.prenom} onChange={e => update('prenom', e.target.value)} readOnly={!!clientName} />
              </div>
              <div>
                <label className="q-label">Nom</label>
                <input className="q-input" value={form.nom} onChange={e => update('nom', e.target.value)} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
              <div>
                <label className="q-label">Age</label>
                <input className="q-input" type="number" value={form.age} onChange={e => update('age', e.target.value)} />
              </div>
              <div>
                <label className="q-label">Poids (kg)</label>
                <input className="q-input" type="number" value={form.poids} onChange={e => update('poids', e.target.value)} />
              </div>
              <div>
                <label className="q-label">Taille (cm)</label>
                <input className="q-input" type="number" value={form.taille} onChange={e => update('taille', e.target.value)} />
              </div>
            </div>
            <div>
              <label className="q-label">Genre</label>
              <BtnGroup field="genre" options={[
                { value: 'M', label: 'Homme' },
                { value: 'F', label: 'Femme' },
                { value: 'Autre', label: 'Autre' },
              ]} columns={3} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label className="q-label">Email</label>
                <input className="q-input" type="email" value={form.email} onChange={e => update('email', e.target.value)} />
              </div>
              <div>
                <label className="q-label">Telephone</label>
                <input className="q-input" type="tel" value={form.telephone} onChange={e => update('telephone', e.target.value)} />
              </div>
            </div>
            <div>
              <label className="q-label">Profession</label>
              <input className="q-input" value={form.profession} onChange={e => update('profession', e.target.value)} />
            </div>
          </div>
        )}

        {/* Section 2 — Votre sante */}
        {section === 2 && (
          <div className="q-section">
            <h2 className="q-section-title">Votre sante</h2>
            <div className="q-field">
              <label className="q-label">Pathologies connues</label>
              <textarea className="q-textarea" rows={3} value={form.pathologies} onChange={e => update('pathologies', e.target.value)} placeholder="Diabete, hypertension, thyroide..." />
            </div>
            <div className="q-field">
              <label className="q-label">Medicaments / Traitements en cours</label>
              <textarea className="q-textarea" rows={3} value={form.traitements} onChange={e => update('traitements', e.target.value)} placeholder="Levothyrox, pilule..." />
            </div>
            <div className="q-field">
              <label className="q-label">Allergies alimentaires</label>
              <textarea className="q-textarea" rows={3} value={form.allergies} onChange={e => update('allergies', e.target.value)} placeholder="Gluten, lactose, fruits a coque..." />
            </div>
          </div>
        )}

        {/* Section 3 — Vos habitudes */}
        {section === 3 && (
          <div className="q-section">
            <h2 className="q-section-title">Vos habitudes</h2>
            <div className="q-field">
              <label className="q-label">Nombre de repas par jour</label>
              <BtnGroup field="nbRepas" options={[
                { value: '2', label: '2' },
                { value: '3', label: '3' },
                { value: '4+', label: '4+' },
              ]} columns={3} />
            </div>
            <div className="q-field">
              <label className="q-label">Activite physique</label>
              <BtnGroup field="frequenceSport" options={[
                { value: 'Jamais', label: 'Jamais' },
                { value: '1-2x/sem', label: '1-2x/sem' },
                { value: '3-4x/sem', label: '3-4x/sem' },
                { value: 'Quotidien', label: 'Quotidien' },
              ]} columns={2} />
            </div>
            <div className="q-field">
              <label className="q-label">Hydratation quotidienne</label>
              <BtnGroup field="hydratation" options={[
                { value: '< 1L', label: '< 1L' },
                { value: '1-2L', label: '1-2L' },
                { value: '> 2L', label: '> 2L' },
              ]} columns={3} />
            </div>
            <div className="q-field">
              <label className="q-label">Aliments evites</label>
              <textarea className="q-textarea" rows={2} value={form.alimentsEvites} onChange={e => update('alimentsEvites', e.target.value)} placeholder="Aliments que vous evitez..." />
            </div>
          </div>
        )}

        {/* Section 4 — Comment vous vous sentez */}
        {section === 4 && (
          <div className="q-section">
            <h2 className="q-section-title">Comment vous vous sentez</h2>
            <NumericScale field="energieJournee" label="Energie" />
            <NumericScale field="heuresSommeil" label="Sommeil" />
            <NumericScale field="frequenceBallonnements" label="Digestion" />
            <NumericScale field="niveauStressActuel" label="Stress" />
          </div>
        )}

        {/* Section 5 — Votre objectif */}
        {section === 5 && (
          <div className="q-section">
            <h2 className="q-section-title">Votre objectif</h2>
            <div className="q-field">
              <label className="q-label">Objectif principal (plusieurs choix possibles)</label>
              <div className="q-checkbox-group">
                {OBJECTIF_OPTIONS.map(opt => (
                  <button
                    key={opt}
                    type="button"
                    className={`q-checkbox-btn ${form.objectifPrincipalNutrition.includes(opt) ? 'q-checkbox-active' : ''}`}
                    onClick={() => toggleObjectif(opt)}
                  >
                    <span className="q-check-mark">{form.objectifPrincipalNutrition.includes(opt) ? '✓' : ''}</span>
                    {opt}
                  </button>
                ))}
              </div>
            </div>
            <div className="q-field">
              <label className="q-label">Seriez-vous pr{'\u00ea'}t(e) {'\u00e0'} prendre des compl{'\u00e9'}ments alimentaires si recommand{'\u00e9'} ?</label>
              <BtnGroup field="pretProtocole" options={[
                { value: 'Oui', label: 'Oui' },
                { value: 'Non', label: 'Non' },
                { value: 'Peut-etre', label: 'Peut-\u00eatre' },
              ]} columns={3} />
            </div>
            <div className="q-field">
              <label className="q-label">Pourquoi maintenant ? (optionnel)</label>
              <textarea className="q-textarea" rows={3} value={form.pourquoiMaintenant} onChange={e => update('pourquoiMaintenant', e.target.value)} placeholder="Qu'est-ce qui vous motive a consulter aujourd'hui ?" />
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="q-nav">
          {section > 1 && (
            <button className="q-btn-prev" onClick={() => setSection(s => s - 1)}>
              Precedent
            </button>
          )}
          <div className="q-nav-spacer" />
          {section < SECTIONS.length ? (
            <button className="q-btn-next" onClick={() => setSection(s => s + 1)}>
              Suivant
            </button>
          ) : (
            <button className="q-btn-submit" onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Envoi...' : 'Envoyer'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default QuestionnaireClient;
