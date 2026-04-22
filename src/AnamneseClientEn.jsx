// V86.4 — Anamnese complete EN (clone maitrise de QuestionnaireClient.jsx)
//
// Pour les clientes Benfitcoach anglophones uniquement (formule suivi/intensif/
// pack20/pack30 + langue EN). Remplit DIRECTEMENT les 8 steps complets de
// l'anamnese (au lieu du pre-questionnaire FR 5 sections).
//
// Structure identique a QuestionnaireClient.jsx :
//  - memes classes CSS q-* (aucun duplicata style)
//  - meme pattern load / merge / submit Supabase
//  - meme notification Anissa
//  - CLES FR CANONIQUES conservees en DB -> compat parser/prompts/PDF
//  - valeurs en anglais (texte libre)
//  - marqueur anamneseLocale: 'EN' ajoute au submit pour tracabilite

import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

const ANISSA_LOGO = 'https://cdn.prod.website-files.com/699eb56ec2e8b94e41cfa06c/69d411dfafbbe967e3d992c4_Design_sans_titre_1_-removebg-preview.png';

const SECTIONS = [
  { id: 1, label: 'You' },
  { id: 2, label: 'Medical' },
  { id: 3, label: "Women's health" },
  { id: 4, label: 'Digestion' },
  { id: 5, label: 'Symptoms' },
  { id: 6, label: 'Sport' },
  { id: 7, label: 'Lifestyle' },
  { id: 8, label: 'Labs' },
  { id: 9, label: 'Goals' },
];

const OBJECTIF_OPTIONS_EN = [
  'Weight loss', 'Energy', 'Digestion', 'Hormones', 'Performance', 'Anti-aging', 'Other',
];

const SCALE_LABELS = {
  energieJournee: ['Low', 'Excellent'],
  heuresSommeil: ['Poor', 'Excellent'],
  frequenceBallonnements: ['Difficult', 'Perfect'],
  niveauStressActuel: ['Very high', 'None'],
};

function AnamneseClientEn({ clientId }) {
  const [section, setSection] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [clientName, setClientName] = useState('');

  // Cles FR canoniques = compat 100% avec le parser / store / prompts existants.
  const [form, setForm] = useState({
    // Step 1 — You
    prenom: '',
    nom: '',
    age: '',
    genre: '',
    profession: '',
    poids: '',
    taille: '',
    tourTaille: '',
    tourHanche: '',
    email: '',
    telephone: '',
    // Step 2 — Medical
    antecedentsFamiliaux: '',
    pathologies: '',
    traitements: '',
    operations: '',
    allergies: '',
    // Step 3 — Women's health
    contraception: '',
    cycleDuree: '',
    spm: '',
    douleursMenstruelles: '',
    projetGrossesse: '',
    // Step 4 — Digestion
    frequenceBallonnements: '',
    transitType: '',
    alimentsProblematiques: '',
    mastication: '',
    // Step 5 — Symptoms (fonctionnels)
    fringalesSucre: '',
    variationsGlycemie: '',
    reactionGlucides: [],
    douleursInflammations: '',
    troublesPeau: '',
    frequenceMaladies: '',
    // Step 6 — Sport
    typeSport: '',
    frequenceSport: '',
    objectifSport: '',
    recuperation: '',
    supplements: '',
    // Step 6 — Lifestyle
    heuresSommeil: '',
    difficultesEndormissement: '',
    reveilsNocturnes: '',
    etatReveil: '',
    tempsExterieur: '',
    expositionEcransSoir: '',
    alcool: '',
    tabac: '',
    niveauStressActuel: '',
    energieJournee: '',
    // Step 7 — Labs & genetics
    analysesBiologiques: '',
    testADN: '',
    testsGenetiques: '',
    pretAnalysesAvancees: '',
    // Step 8 — Goals
    objectifPrincipalNutrition: [],
    dureeProbleme: '',
    dejaEssaye: '',
    pretProtocole: '',
    pourquoiMaintenant: '',
    emotional_shock: '',
    emotional_shock_details: '',
    alimentsEvites: '',
    hydratation: '',
    nbRepas: '',
  });

  // Load existing client data (meme pattern que QuestionnaireClient.jsx)
  useEffect(() => {
    if (!supabase || !clientId) {
      setLoading(false);
      setError('Invalid link.');
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
          setError('Client not found.');
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
          profession: f.profession || '',
          poids: f.poids || '',
          taille: f.taille || '',
          tourTaille: f.tourTaille || '',
          tourHanche: f.tourHanche || '',
          email: f.email || '',
          telephone: f.telephone || '',
          antecedentsFamiliaux: f.antecedentsFamiliaux || '',
          pathologies: f.pathologies || '',
          traitements: f.traitements || '',
          operations: f.operations || '',
          allergies: f.allergies || '',
          contraception: f.contraception || '',
          cycleDuree: f.cycleDuree || '',
          spm: f.spm || '',
          douleursMenstruelles: f.douleursMenstruelles || '',
          projetGrossesse: f.projetGrossesse || '',
          frequenceBallonnements: f.frequenceBallonnements || '',
          transitType: f.transitType || '',
          alimentsProblematiques: f.alimentsProblematiques || '',
          mastication: f.mastication || '',
          fringalesSucre: f.fringalesSucre || '',
          variationsGlycemie: f.variationsGlycemie || '',
          reactionGlucides: Array.isArray(f.reactionGlucides) ? f.reactionGlucides : (f.reactionGlucides ? String(f.reactionGlucides).split(',').map(s => s.trim()).filter(Boolean) : []),
          douleursInflammations: f.douleursInflammations || '',
          troublesPeau: f.troublesPeau || '',
          frequenceMaladies: f.frequenceMaladies || '',
          typeSport: f.typeSport || '',
          frequenceSport: f.frequenceSport || '',
          objectifSport: f.objectifSport || '',
          recuperation: f.recuperation || '',
          supplements: f.supplements || '',
          heuresSommeil: f.heuresSommeil || '',
          difficultesEndormissement: f.difficultesEndormissement || '',
          reveilsNocturnes: f.reveilsNocturnes || '',
          etatReveil: f.etatReveil || '',
          tempsExterieur: f.tempsExterieur || '',
          expositionEcransSoir: f.expositionEcransSoir || '',
          alcool: f.alcool || '',
          tabac: f.tabac || '',
          niveauStressActuel: f.niveauStressActuel || '',
          energieJournee: f.energieJournee || '',
          analysesBiologiques: f.analysesBiologiques || '',
          testADN: f.testADN || '',
          testsGenetiques: f.testsGenetiques || '',
          pretAnalysesAvancees: f.pretAnalysesAvancees || '',
          objectifPrincipalNutrition: f.objectifPrincipalNutrition
            ? (typeof f.objectifPrincipalNutrition === 'string'
              ? f.objectifPrincipalNutrition.split(',').map(s => s.trim()).filter(Boolean)
              : f.objectifPrincipalNutrition)
            : [],
          dureeProbleme: f.dureeProbleme || '',
          dejaEssaye: f.dejaEssaye || '',
          pretProtocole: f.pretProtocole || '',
          pourquoiMaintenant: f.pourquoiMaintenant || '',
          emotional_shock: f.emotional_shock || '',
          emotional_shock_details: f.emotional_shock_details || '',
          alimentsEvites: f.alimentsEvites || '',
          hydratation: f.hydratation || '',
          nbRepas: f.nbRepas || '',
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

    // Build form update: clés FR canoniques, valeurs EN libres
    const formUpdate = {
      prenom: form.prenom,
      nom: form.nom,
      age: form.age,
      genre: form.genre,
      profession: form.profession,
      poids: form.poids,
      taille: form.taille,
      tourTaille: form.tourTaille,
      tourHanche: form.tourHanche,
      email: form.email,
      telephone: form.telephone,
      antecedentsFamiliaux: form.antecedentsFamiliaux,
      pathologies: form.pathologies,
      traitements: form.traitements,
      operations: form.operations,
      allergies: form.allergies,
      contraception: form.contraception,
      cycleDuree: form.cycleDuree,
      spm: form.spm,
      douleursMenstruelles: form.douleursMenstruelles,
      projetGrossesse: form.projetGrossesse,
      frequenceBallonnements: form.frequenceBallonnements,
      transitType: form.transitType,
      alimentsProblematiques: form.alimentsProblematiques,
      mastication: form.mastication,
      fringalesSucre: form.fringalesSucre,
      variationsGlycemie: form.variationsGlycemie,
      reactionGlucides: form.reactionGlucides.join(', '),
      douleursInflammations: form.douleursInflammations,
      troublesPeau: form.troublesPeau,
      frequenceMaladies: form.frequenceMaladies,
      typeSport: form.typeSport,
      frequenceSport: form.frequenceSport,
      objectifSport: form.objectifSport,
      recuperation: form.recuperation,
      supplements: form.supplements,
      heuresSommeil: form.heuresSommeil,
      difficultesEndormissement: form.difficultesEndormissement,
      reveilsNocturnes: form.reveilsNocturnes,
      etatReveil: form.etatReveil,
      tempsExterieur: form.tempsExterieur,
      expositionEcransSoir: form.expositionEcransSoir,
      alcool: form.alcool,
      tabac: form.tabac,
      niveauStressActuel: form.niveauStressActuel,
      energieJournee: form.energieJournee,
      analysesBiologiques: form.analysesBiologiques,
      testADN: form.testADN,
      testsGenetiques: form.testsGenetiques,
      pretAnalysesAvancees: form.pretAnalysesAvancees,
      objectifPrincipalNutrition: form.objectifPrincipalNutrition.join(', '),
      dureeProbleme: form.dureeProbleme,
      dejaEssaye: form.dejaEssaye,
      pretProtocole: form.pretProtocole,
      pourquoiMaintenant: form.pourquoiMaintenant,
      emotional_shock: form.emotional_shock,
      emotional_shock_details: form.emotional_shock_details,
      alimentsEvites: form.alimentsEvites,
      hydratation: form.hydratation,
      nbRepas: form.nbRepas,
      // Tracabilite (V86.4)
      anamneseLocale: 'EN',
      // Marqueur remplissage client (meme flag que le pre-questionnaire FR)
      benoitQuestionnaireFilledAt: new Date().toISOString(),
      benoitQuestionnaireFilledBy: 'client',
    };

    try {
      // Fetch existing form to merge (gaps-fill, n'ecrase pas les entrees Anissa)
      const { data: existing } = await supabase
        .from('clients')
        .select('form')
        .eq('id', clientId)
        .single();

      const existingForm = existing?.form || {};
      const mergedForm = { ...existingForm, ...formUpdate };

      const { error: err } = await supabase
        .from('clients')
        .update({
          form: mergedForm,
          prenom: form.prenom || existing?.form?.prenom || '',
          updated_at: new Date().toISOString(),
        })
        .eq('id', clientId);

      if (err) throw err;

      // Notification Anissa (meme pattern que le FR)
      const fullName = [form.prenom, form.nom].filter(Boolean).join(' ') || 'Client';
      const { error: notifError } = await supabase
        .from('notifications')
        .insert({
          type: 'questionnaire_completed',
          category: 'questionnaire',
          client_id: clientId,
          client_name: fullName,
          message: `${fullName} completed the English health assessment`,
          read: false,
        });

      if (notifError) {
        console.error('Notification Supabase error:', notifError);
      }

      setSubmitted(true);
    } catch (e) {
      setError('Submission failed. Please try again.');
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
          <div className="q-loading">Loading...</div>
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
            <h2>Thank you{clientName ? `, ${clientName}` : ''}!</h2>
            <p>Anissa has received your information and will contact you soon.</p>
          </div>
        </div>
      </div>
    );
  }

  const progressPct = ((section - 1) / (SECTIONS.length - 1)) * 100;
  const isFemale = form.genre === 'F';

  return (
    <div className="q-page">
      <div className="q-container">
        {/* Header */}
        <div className="q-header">
          <img src={ANISSA_LOGO} alt="Anissa Nutrition" className="q-logo" />
          <h1 className="q-title">Health assessment</h1>
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

        {/* Section 1 — You */}
        {section === 1 && (
          <div className="q-section" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h2 className="q-section-title" style={{ marginBottom: 0 }}>About you</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label className="q-label">First name</label>
                <input className="q-input" value={form.prenom} onChange={e => update('prenom', e.target.value)} readOnly={!!clientName} />
              </div>
              <div>
                <label className="q-label">Last name</label>
                <input className="q-input" value={form.nom} onChange={e => update('nom', e.target.value)} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
              <div>
                <label className="q-label">Age</label>
                <input className="q-input" type="number" value={form.age} onChange={e => update('age', e.target.value)} />
              </div>
              <div>
                <label className="q-label">Weight (kg)</label>
                <input className="q-input" type="number" value={form.poids} onChange={e => update('poids', e.target.value)} />
              </div>
              <div>
                <label className="q-label">Height (cm)</label>
                <input className="q-input" type="number" value={form.taille} onChange={e => update('taille', e.target.value)} />
              </div>
            </div>
            <div>
              <label className="q-label">Gender</label>
              <BtnGroup field="genre" options={[
                { value: 'M', label: 'Male' },
                { value: 'F', label: 'Female' },
                { value: 'Autre', label: 'Other' },
              ]} columns={3} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label className="q-label">Waist (cm)</label>
                <input className="q-input" type="number" value={form.tourTaille} onChange={e => update('tourTaille', e.target.value)} />
              </div>
              <div>
                <label className="q-label">Hips (cm)</label>
                <input className="q-input" type="number" value={form.tourHanche} onChange={e => update('tourHanche', e.target.value)} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label className="q-label">Email</label>
                <input className="q-input" type="email" value={form.email} onChange={e => update('email', e.target.value)} />
              </div>
              <div>
                <label className="q-label">Phone</label>
                <input className="q-input" type="tel" value={form.telephone} onChange={e => update('telephone', e.target.value)} />
              </div>
            </div>
            <div>
              <label className="q-label">Profession</label>
              <input className="q-input" value={form.profession} onChange={e => update('profession', e.target.value)} />
            </div>
          </div>
        )}

        {/* Section 2 — Medical */}
        {section === 2 && (
          <div className="q-section">
            <h2 className="q-section-title">Medical history</h2>
            <div className="q-field">
              <label className="q-label">Family medical history</label>
              <textarea className="q-textarea" rows={3} value={form.antecedentsFamiliaux} onChange={e => update('antecedentsFamiliaux', e.target.value)} placeholder="Diabetes, heart disease, cancers in direct family..." />
            </div>
            <div className="q-field">
              <label className="q-label">Known pathologies</label>
              <textarea className="q-textarea" rows={3} value={form.pathologies} onChange={e => update('pathologies', e.target.value)} placeholder="Diabetes, hypertension, thyroid..." />
            </div>
            <div className="q-field">
              <label className="q-label">Current medications / treatments</label>
              <textarea className="q-textarea" rows={3} value={form.traitements} onChange={e => update('traitements', e.target.value)} placeholder="Levothyroxine, contraceptive pill..." />
            </div>
            <div className="q-field">
              <label className="q-label">Past surgeries / operations</label>
              <textarea className="q-textarea" rows={2} value={form.operations} onChange={e => update('operations', e.target.value)} placeholder="Appendectomy, C-section, dental work..." />
            </div>
            <div className="q-field">
              <label className="q-label">Food allergies / intolerances</label>
              <textarea className="q-textarea" rows={2} value={form.allergies} onChange={e => update('allergies', e.target.value)} placeholder="Gluten, lactose, nuts..." />
            </div>
          </div>
        )}

        {/* Section 3 — Women's health (visible always, but guidance note if male/other) */}
        {section === 3 && (
          <div className="q-section">
            <h2 className="q-section-title">Women's health</h2>
            {!isFemale && (
              <p style={{ color: 'rgba(255,255,255,.55)', fontSize: '.88rem', marginBottom: 18 }}>
                Skip this section if it does not apply to you.
              </p>
            )}
            <div className="q-field">
              <label className="q-label">Contraception</label>
              <textarea className="q-textarea" rows={2} value={form.contraception} onChange={e => update('contraception', e.target.value)} placeholder="Type, duration, any side effects..." />
            </div>
            <div className="q-field">
              <label className="q-label">Cycle regularity</label>
              <textarea className="q-textarea" rows={2} value={form.cycleDuree} onChange={e => update('cycleDuree', e.target.value)} placeholder="Regular (28 days), irregular, absent..." />
            </div>
            <div className="q-field">
              <label className="q-label">PMS symptoms</label>
              <textarea className="q-textarea" rows={2} value={form.spm} onChange={e => update('spm', e.target.value)} placeholder="Mood, bloating, cravings, breast tenderness..." />
            </div>
            <div className="q-field">
              <label className="q-label">Menstrual pain</label>
              <textarea className="q-textarea" rows={2} value={form.douleursMenstruelles} onChange={e => update('douleursMenstruelles', e.target.value)} placeholder="Intensity, where, painkillers needed..." />
            </div>
            <div className="q-field">
              <label className="q-label">Pregnancy plans (next 12 months)</label>
              <BtnGroup field="projetGrossesse" options={[
                { value: 'Oui', label: 'Yes' },
                { value: 'Non', label: 'No' },
                { value: 'Peut-etre', label: 'Maybe' },
              ]} columns={3} />
            </div>
          </div>
        )}

        {/* Section 4 — Digestion */}
        {section === 4 && (
          <div className="q-section">
            <h2 className="q-section-title">Digestion</h2>
            <NumericScale field="frequenceBallonnements" label="Overall digestion quality" />
            <div className="q-field">
              <label className="q-label">Transit type</label>
              <BtnGroup field="transitType" options={[
                { value: 'Normal', label: 'Normal' },
                { value: 'Constipation', label: 'Constipation' },
                { value: 'Diarrhee', label: 'Loose' },
                { value: 'Alternance', label: 'Alternating' },
              ]} columns={2} />
            </div>
            <div className="q-field">
              <label className="q-label">Problematic foods</label>
              <textarea className="q-textarea" rows={2} value={form.alimentsProblematiques} onChange={e => update('alimentsProblematiques', e.target.value)} placeholder="Foods that trigger bloating, pain, fatigue..." />
            </div>
            <div className="q-field">
              <label className="q-label">Chewing habits</label>
              <BtnGroup field="mastication" options={[
                { value: 'Rapide', label: 'Fast' },
                { value: 'Moyen', label: 'Moderate' },
                { value: 'Lent', label: 'Slow / mindful' },
              ]} columns={3} />
            </div>
            <div className="q-field">
              <label className="q-label">Number of meals per day</label>
              <BtnGroup field="nbRepas" options={[
                { value: '2', label: '2' },
                { value: '3', label: '3' },
                { value: '4+', label: '4+' },
              ]} columns={3} />
            </div>
            <div className="q-field">
              <label className="q-label">Daily hydration</label>
              <BtnGroup field="hydratation" options={[
                { value: '< 1L', label: '< 1L' },
                { value: '1-2L', label: '1-2L' },
                { value: '> 2L', label: '> 2L' },
              ]} columns={3} />
            </div>
            <div className="q-field">
              <label className="q-label">Foods you avoid</label>
              <textarea className="q-textarea" rows={2} value={form.alimentsEvites} onChange={e => update('alimentsEvites', e.target.value)} placeholder="Foods you prefer to avoid (taste, belief, intolerance)..." />
            </div>
          </div>
        )}

        {/* Section 5 — Symptoms */}
        {section === 5 && (
          <div className="q-section">
            <h2 className="q-section-title">Functional symptoms</h2>
            <div className="q-field">
              <label className="q-label">Sugar cravings</label>
              <BtnGroup field="fringalesSucre" options={[
                { value: 'Jamais', label: 'Never' },
                { value: 'Occasionnellement', label: 'Occasionally' },
                { value: 'Quotidiennement', label: 'Daily' },
                { value: 'Plusieurs fois par jour', label: 'Several times a day' },
              ]} columns={2} />
            </div>
            <div className="q-field">
              <label className="q-label">Energy dips / unstable energy</label>
              <BtnGroup field="variationsGlycemie" options={[
                { value: 'Non', label: 'No' },
                { value: 'Oui apres les repas', label: 'Yes after meals' },
                { value: 'Oui en milieu de journee', label: 'Yes mid-day' },
                { value: 'Oui en permanence', label: 'Yes constantly' },
              ]} columns={2} />
            </div>
            <div className="q-field">
              <label className="q-label">After a heavy meal, you feel (multiple choices possible)</label>
              <div className="q-checkbox-group">
                {[
                  { value: 'Energie stable', label: 'Stable energy' },
                  { value: 'Somnolence', label: 'Drowsiness' },
                  { value: 'Ballonnements', label: 'Bloating' },
                  { value: 'Faim rapide', label: 'Hungry again quickly' },
                ].map(opt => {
                  const active = form.reactionGlucides.includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      className={`q-checkbox-btn ${active ? 'q-checkbox-active' : ''}`}
                      onClick={() => setForm(prev => {
                        const arr = prev.reactionGlucides;
                        return {
                          ...prev,
                          reactionGlucides: arr.includes(opt.value) ? arr.filter(v => v !== opt.value) : [...arr, opt.value],
                        };
                      })}
                    >
                      <span className="q-check-mark">{active ? '\u2713' : ''}</span>
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="q-field">
              <label className="q-label">Joint pain / inflammation</label>
              <BtnGroup field="douleursInflammations" options={[
                { value: 'Non', label: 'No' },
                { value: 'Occasionnelles', label: 'Occasional' },
                { value: 'Frequentes', label: 'Frequent' },
                { value: 'Quotidiennes', label: 'Daily' },
              ]} columns={2} />
            </div>
            <div className="q-field">
              <label className="q-label">Skin issues</label>
              <BtnGroup field="troublesPeau" options={[
                { value: 'Non', label: 'No' },
                { value: 'Oui occasionnel', label: 'Occasional' },
                { value: 'Oui chronique', label: 'Chronic' },
              ]} columns={3} />
            </div>
            <div className="q-field">
              <label className="q-label">Frequent illnesses (colds, infections)</label>
              <BtnGroup field="frequenceMaladies" options={[
                { value: 'Rarement', label: 'Rarely' },
                { value: '1-2 fois par an', label: '1-2 times a year' },
                { value: 'Plusieurs fois par an', label: 'Several times a year' },
              ]} columns={3} />
            </div>
          </div>
        )}

        {/* Section 6 — Sport */}
        {section === 6 && (
          <div className="q-section">
            <h2 className="q-section-title">Sport and activity</h2>
            <div className="q-field">
              <label className="q-label">Type of sport / activity</label>
              <textarea className="q-textarea" rows={2} value={form.typeSport} onChange={e => update('typeSport', e.target.value)} placeholder="Running, strength training, yoga, swimming..." />
            </div>
            <div className="q-field">
              <label className="q-label">Frequency</label>
              <BtnGroup field="frequenceSport" options={[
                { value: 'Jamais', label: 'Never' },
                { value: '1-2x/sem', label: '1-2 / week' },
                { value: '3-4x/sem', label: '3-4 / week' },
                { value: 'Quotidien', label: 'Daily' },
              ]} columns={2} />
            </div>
            <div className="q-field">
              <label className="q-label">Sport objective</label>
              <textarea className="q-textarea" rows={2} value={form.objectifSport} onChange={e => update('objectifSport', e.target.value)} placeholder="Performance, body composition, wellbeing, event..." />
            </div>
            <div className="q-field">
              <label className="q-label">Recovery quality</label>
              <BtnGroup field="recuperation" options={[
                { value: 'Mauvaise', label: 'Poor' },
                { value: 'Moyenne', label: 'Moderate' },
                { value: 'Bonne', label: 'Good' },
                { value: 'Excellente', label: 'Excellent' },
              ]} columns={2} />
            </div>
            <div className="q-field">
              <label className="q-label">Current supplements</label>
              <textarea className="q-textarea" rows={2} value={form.supplements} onChange={e => update('supplements', e.target.value)} placeholder="Vitamin D, magnesium, protein, omega 3..." />
            </div>
          </div>
        )}

        {/* Section 7 — Lifestyle */}
        {section === 7 && (
          <div className="q-section">
            <h2 className="q-section-title">Lifestyle and sleep</h2>
            <NumericScale field="energieJournee" label="Daily energy level" />
            <NumericScale field="heuresSommeil" label="Sleep quality" />
            <NumericScale field="niveauStressActuel" label="Current stress level" />
            <div className="q-field">
              <label className="q-label">Trouble falling asleep</label>
              <BtnGroup field="difficultesEndormissement" options={[
                { value: 'Oui', label: 'Yes' },
                { value: 'Non', label: 'No' },
                { value: 'Parfois', label: 'Sometimes' },
              ]} columns={3} />
            </div>
            <div className="q-field">
              <label className="q-label">Night awakenings</label>
              <BtnGroup field="reveilsNocturnes" options={[
                { value: 'Jamais', label: 'Never' },
                { value: 'Parfois', label: 'Sometimes' },
                { value: 'Souvent', label: 'Often' },
              ]} columns={3} />
            </div>
            <div className="q-field">
              <label className="q-label">How you feel at wake-up</label>
              <BtnGroup field="etatReveil" options={[
                { value: 'Fatigue', label: 'Tired' },
                { value: 'Normal', label: 'OK' },
                { value: 'Frais', label: 'Fresh' },
              ]} columns={3} />
            </div>
            <div className="q-field">
              <label className="q-label">Time spent outdoors daily</label>
              <BtnGroup field="tempsExterieur" options={[
                { value: '< 30min', label: '< 30 min' },
                { value: '30-60min', label: '30-60 min' },
                { value: '> 1h', label: '> 1 h' },
              ]} columns={3} />
            </div>
            <div className="q-field">
              <label className="q-label">Screen exposure in the evening</label>
              <BtnGroup field="expositionEcransSoir" options={[
                { value: 'Faible', label: 'Low' },
                { value: 'Moderee', label: 'Moderate' },
                { value: 'Elevee', label: 'High' },
              ]} columns={3} />
            </div>
            <div className="q-field">
              <label className="q-label">Alcohol consumption</label>
              <BtnGroup field="alcool" options={[
                { value: 'Jamais', label: 'Never' },
                { value: 'Occasionnel', label: 'Occasional' },
                { value: 'Regulier', label: 'Regular' },
              ]} columns={3} />
            </div>
            <div className="q-field">
              <label className="q-label">Tobacco</label>
              <BtnGroup field="tabac" options={[
                { value: 'Non', label: 'No' },
                { value: 'Occasionnel', label: 'Occasional' },
                { value: 'Regulier', label: 'Regular' },
              ]} columns={3} />
            </div>
          </div>
        )}

        {/* Section 8 — Labs */}
        {section === 8 && (
          <div className="q-section">
            <h2 className="q-section-title">Labs and genetic tests</h2>
            <div className="q-field">
              <label className="q-label">Recent blood work / biomarkers</label>
              <textarea className="q-textarea" rows={3} value={form.analysesBiologiques} onChange={e => update('analysesBiologiques', e.target.value)} placeholder="Recent labs (TSH, ferritin, vitamin D, glucose, lipids)... you can also share the PDF by email." />
            </div>
            <div className="q-field">
              <label className="q-label">DNA / genetic test done</label>
              <BtnGroup field="testADN" options={[
                { value: 'Oui', label: 'Yes' },
                { value: 'Non', label: 'No' },
                { value: 'Prevu', label: 'Planned' },
              ]} columns={3} />
            </div>
            <div className="q-field">
              <label className="q-label">Genetic tests details</label>
              <textarea className="q-textarea" rows={2} value={form.testsGenetiques} onChange={e => update('testsGenetiques', e.target.value)} placeholder="MTHFR, APOE, Lifelabs, 23andMe, Nutrigenomix..." />
            </div>
            <div className="q-field">
              <label className="q-label">Open to advanced lab tests if recommended?</label>
              <BtnGroup field="pretAnalysesAvancees" options={[
                { value: 'Oui', label: 'Yes' },
                { value: 'Non', label: 'No' },
                { value: 'Selon cout', label: 'Depends on cost' },
              ]} columns={3} />
            </div>
          </div>
        )}

        {/* Section 9 — Goals */}
        {section === 9 && (
          <div className="q-section">
            <h2 className="q-section-title">Goals and motivation</h2>
            <div className="q-field">
              <label className="q-label">Main goal (multiple choices possible)</label>
              <div className="q-checkbox-group">
                {OBJECTIF_OPTIONS_EN.map(opt => (
                  <button
                    key={opt}
                    type="button"
                    className={`q-checkbox-btn ${form.objectifPrincipalNutrition.includes(opt) ? 'q-checkbox-active' : ''}`}
                    onClick={() => toggleObjectif(opt)}
                  >
                    <span className="q-check-mark">{form.objectifPrincipalNutrition.includes(opt) ? '\u2713' : ''}</span>
                    {opt}
                  </button>
                ))}
              </div>
            </div>
            <div className="q-field">
              <label className="q-label">How long have you had this problem?</label>
              <textarea className="q-textarea" rows={2} value={form.dureeProbleme} onChange={e => update('dureeProbleme', e.target.value)} placeholder="A few months, 2 years, since childhood..." />
            </div>
            <div className="q-field">
              <label className="q-label">What have you tried so far?</label>
              <textarea className="q-textarea" rows={2} value={form.dejaEssaye} onChange={e => update('dejaEssaye', e.target.value)} placeholder="Diets, supplements, coaches, therapies..." />
            </div>
            <div className="q-field">
              <label className="q-label">Willing to take supplements if recommended?</label>
              <BtnGroup field="pretProtocole" options={[
                { value: 'Oui', label: 'Yes' },
                { value: 'Non', label: 'No' },
                { value: 'Peut-etre', label: 'Maybe' },
              ]} columns={3} />
            </div>
            <div className="q-field">
              <label className="q-label">Any major emotional shock in recent years?</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                {[
                  { value: 'Oui', label: 'Yes' },
                  { value: 'Non', label: 'No' },
                  { value: 'Prefere ne pas repondre', label: 'Prefer not to say' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`q-btn-option ${form.emotional_shock === opt.value ? 'q-btn-active' : ''}`}
                    onClick={() => update('emotional_shock', opt.value)}
                    style={{ textAlign: 'center', padding: '12px 8px' }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            {form.emotional_shock === 'Oui' && (
              <div className="q-field">
                <label className="q-label">Can you share a bit more? (optional)</label>
                <textarea
                  className="q-textarea"
                  rows={2}
                  value={form.emotional_shock_details}
                  onChange={e => update('emotional_shock_details', e.target.value)}
                  placeholder="Bereavement, separation, accident, burnout..."
                  maxLength={200}
                />
              </div>
            )}
            <div className="q-field">
              <label className="q-label">Why now? (optional)</label>
              <textarea className="q-textarea" rows={3} value={form.pourquoiMaintenant} onChange={e => update('pourquoiMaintenant', e.target.value)} placeholder="What made you decide to seek support today?" />
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="q-nav">
          {section > 1 && (
            <button className="q-btn-prev" onClick={() => setSection(s => s - 1)}>
              Previous
            </button>
          )}
          <div className="q-nav-spacer" />
          {section < SECTIONS.length ? (
            <button className="q-btn-next" onClick={() => setSection(s => s + 1)}>
              Next
            </button>
          ) : (
            <button className="q-btn-submit" onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default AnamneseClientEn;
