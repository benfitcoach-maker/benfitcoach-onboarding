import React, { useState, useEffect } from 'react';
import { NUTRITION_INITIAL_FORM } from './formSteps';
import { SmartTextarea } from './KeywordHints';
import { getActivePacks } from './services/packSystem';
import { supabase } from './supabaseClient';
import AnalysisSuggestionModal from './AnalysisSuggestionModal';

const STEP_LABELS = [
  'Validation & Mesures',
  'Sante femme',
  'Digestion',
  'Symptomes',
  'Sport',
  'Mode de vie',
  'Labo & Genetique',
  'Notes coach',
];

const CONSOMMATION_REGULIERE_OPTIONS = [
  'Produits fermentes',
  'Fibres (legumes, graines)',
  'Aucun des deux',
];

export default function AnissaClientForm({ onSave, onSaveQuick, onCancel, initialForm, initialPackType, clientId }) {
  const [form, setForm] = useState(initialForm || NUTRITION_INITIAL_FORM);
  // Phase A migration (2026-05-09) : default sur le nouveau pack d'entree.
  // Anciens packs (oneshot_180/280/750, suivi_3m/6m/adn) restent valides en BDD
  // pour les clientes en cours mais ne sont plus proposes a la creation.
  // Phase B.1.b : initialPackType permet de pre-charger le pack reel de la
  // cliente en mode edition (sinon le bouton "Suggerer analyses" reste cache).
  const [packType, setPackType] = useState(initialPackType || 'consultation_initiale_220');
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState(clientId ? 'full' : 'quick'); // quick = creation rapide, full = anamnese complete
  // V97.5.1 : Anissa decide si on active l'espace app cliente. Coche par
  // V97.9 : le toggle activateApp est retire. Anissa active l'app depuis
  // l'etape Onboarding du parcours (BLOC 1) APRES verification de la fiche.
  // Phase B.1.b — Modale suggestion analyses (visible step 8 si clientId + pack avec analyses)
  const [showSuggestModal, setShowSuggestModal] = useState(false);
  const [savePlanError, setSavePlanError] = useState(null);
  const totalSteps = 8;

  const updateField = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const toggleCheckbox = (field, value) => {
    setForm(prev => {
      const arr = prev[field] || [];
      return {
        ...prev,
        [field]: arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value],
      };
    });
  };

  const handleSubmit = () => {
    if (!form.prenom.trim()) return;
    onSave(form);
  };

  // Phase B.1.b — Sauvegarde un analysis_plan en BDD via Supabase.
  // Appele depuis la modale a la validation. La modale fournit le `plan`
  // pre-construit (selected_tests, totals, status, notes_anissa).
  const handleSavePlan = async (plan) => {
    setSavePlanError(null);
    const { error } = await supabase
      .from('analysis_plans')
      .insert(plan);
    if (error) {
      setSavePlanError(error.message);
      throw new Error(error.message);
    }
    // Sauve aussi l'anamnese en cours (form a jour) pour persister
    // les eventuelles modifications faites avant l'ouverture de la modale.
    onSave(form);
  };

  const handleQuickCreate = () => {
    if (!form.prenom.trim()) {
      alert('Le prénom est obligatoire');
      return;
    }
    if (!form.email.trim()) {
      alert('L\'email est obligatoire pour envoyer le questionnaire');
      return;
    }
    if (onSaveQuick) {
      // V97.9 : on passe juste form + packType. Plus d'option activateApp.
      onSaveQuick(form, packType);
    } else {
      onSave(form);
    }
  };

  const isFemme = form.genre === 'Femme' || form.genre === 'F';

  // Normalize questionnaire numeric scales to Anissa radio labels on first load
  useEffect(() => {
    if (!initialForm) return;
    const fixes = {};

    // energieJournee: questionnaire 1-5 → radio labels
    const energieMap = { '1': 'Fatigue en matinee', '2': "Gros coup de fatigue l'apres-midi", '3': 'Fatigue apres les repas', '4': 'Stable', '5': 'Stable' };
    if (energieMap[form.energieJournee]) fixes.energieJournee = energieMap[form.energieJournee];

    // frequenceBallonnements: questionnaire 1-5 → radio labels
    const digestionMap = { '1': 'Quotidiennement', '2': 'Frequemment', '3': 'Occasionnellement', '4': 'Occasionnellement', '5': 'Jamais' };
    if (digestionMap[form.frequenceBallonnements]) fixes.frequenceBallonnements = digestionMap[form.frequenceBallonnements];

    // genre: questionnaire M/F → Homme/Femme
    if (form.genre === 'M') fixes.genre = 'Homme';
    if (form.genre === 'F') fixes.genre = 'Femme';

    if (Object.keys(fixes).length > 0) {
      setForm(prev => ({ ...prev, ...fixes }));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── QUICK CREATE MODE ───
  if (mode === 'quick' && !clientId) {
    const canCreate = form.prenom.trim() && form.email.trim();
    return (
      <div className="nutrition-consultation">
        <div className="nutrition-header">
          <h2>Nouveau client</h2>
        </div>

        <div style={{ maxWidth: 520, margin: '0 auto' }}>
          {/* Quick create card */}
          <div style={{ background: 'rgba(26,46,31,.12)', border: '1px solid rgba(74,222,128,.25)', borderRadius: 12, padding: '24px 28px', marginBottom: 20 }}>
            <h3 style={{ fontSize: '.95rem', fontWeight: 700, color: '#4ade80', marginBottom: 4 }}>Creation rapide</h3>
            <p style={{ fontSize: '.78rem', color: '#8a8a7a', marginBottom: 16 }}>Créez la fiche cliente. Vous pourrez ensuite activer son espace app et envoyer le pré-questionnaire depuis sa fiche.</p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="field">
                <label>Prenom *</label>
                <input type="text" value={form.prenom} onChange={e => updateField('prenom', e.target.value)} placeholder="Prenom" autoFocus />
              </div>
              <div className="field">
                <label>Nom</label>
                <input type="text" value={form.nom} onChange={e => updateField('nom', e.target.value)} placeholder="Nom" />
              </div>
              <div className="field">
                <label>Email *</label>
                <input type="email" value={form.email} onChange={e => updateField('email', e.target.value)} placeholder="email@exemple.com" />
              </div>
              <div className="field">
                <label>Telephone</label>
                <input type="tel" value={form.telephone} onChange={e => updateField('telephone', e.target.value)} placeholder="+41..." />
              </div>
            </div>

            <div className="field" style={{ gridColumn: '1/-1' }}>
              <label>PACK NUTRITIONNEL</label>
              <select
                value={packType}
                onChange={e => setPackType(e.target.value)}
                style={{ width: '100%' }}
              >
                {getActivePacks().map(pack => (
                  <option key={pack.key} value={pack.key}>
                    {pack.label} — {pack.price} CHF
                  </option>
                ))}
              </select>
            </div>

            {/* V97.9 — Toggle activation app supprime.
                Anissa active l'app et envoie le pre-questionnaire depuis
                l'etape Onboarding du parcours (apres verif de la fiche). */}

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button
                className="btn btn-anissa-primary"
                onClick={handleQuickCreate}
                disabled={!canCreate}
                style={{ flex: 1, padding: '12px 20px', fontSize: '.85rem', fontWeight: 600 }}
              >
                Créer la fiche cliente
              </button>
            </div>
          </div>

          {/* Switch to full form */}
          <div style={{ textAlign: 'center' }}>
            <button
              type="button"
              onClick={() => setMode('full')}
              style={{ background: 'none', border: 'none', color: '#8a8a7a', fontSize: '.78rem', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Remplir l'anamnese complete maintenant
            </button>
          </div>

          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <button className="btn btn-anissa-secondary" onClick={onCancel}>Annuler</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="nutrition-consultation">
      <div className="nutrition-header">
        <h2>{clientId ? 'Modifier le client' : 'Anamnese nutrition'}</h2>
        <span className="nutrition-client-name">{form.prenom || ''}</span>
      </div>

      {/* Step progress */}
      <div className="nutrition-steps">
        {STEP_LABELS.map((label, i) => (
          <button
            key={i}
            className={`nutrition-step ${step === i + 1 ? 'active' : ''} ${step > i + 1 ? 'completed' : ''}`}
            onClick={() => setStep(i + 1)}
          >
            <span className="nutrition-step-num">{i + 1}</span>
            <span className="nutrition-step-label">{label}</span>
          </button>
        ))}
      </div>

      {/* V97.11.4 — Encart pré-questionnaire en lecture seule.
          Visible sur toutes les étapes pour qu'Anissa puisse référencer
          les réponses cliente pendant qu'elle complète l'anamnèse pendant
          le RDV. Pas d'auto-fill des champs : risque de mismatch valeurs +
          écrasement des observations Anissa. */}
      <PreQuestionnaireSummary form={form} />

      {/* ─── ETAPE 1 : Validation & Mesures ─── */}
      {step === 1 && (
        <div className="nutrition-form-section">
          <h3>Validation des donnees client & Mesures</h3>
          <p style={{ fontSize: '.78rem', color: '#8a8a7a', marginBottom: 20 }}>Ces données proviennent du questionnaire client — vérifie et corrige si nécessaire.</p>
          <div className="form-grid">
            <div className="field"><label>Prenom *</label><input type="text" value={form.prenom} onChange={e => updateField('prenom', e.target.value)} /></div>
            <div className="field"><label>Nom</label><input type="text" value={form.nom} onChange={e => updateField('nom', e.target.value)} /></div>
            <div className="field"><label>Date de naissance</label><input type="date" max={new Date().toISOString().slice(0, 10)} value={form.dateNaissance || ''} onChange={e => updateField('dateNaissance', e.target.value)} /></div>
            <div className="field"><label>Genre</label><select value={form.genre} onChange={e => updateField('genre', e.target.value)}><option value="">-</option><option value="Homme">Homme</option><option value="Femme">Femme</option></select></div>
            <div className="field"><label>Poids (kg)</label><input type="number" value={form.poids} onChange={e => updateField('poids', e.target.value)} /></div>
            <div className="field"><label>Taille (cm)</label><input type="number" value={form.taille} onChange={e => updateField('taille', e.target.value)} /></div>
            <div className="field"><label>Email</label><input type="email" value={form.email || ''} onChange={e => updateField('email', e.target.value)} placeholder="email@exemple.com" /></div>
            <div className="field"><label>Telephone</label><input type="tel" value={form.telephone || ''} onChange={e => updateField('telephone', e.target.value)} placeholder="+41..." /></div>
            <div className="field full-width"><label>Adresse postale</label><input type="text" value={form.adresse || ''} onChange={e => updateField('adresse', e.target.value)} placeholder="Rue, NPA, ville (utile pour envoi postal du programme)" /></div>
            <div className="field"><label>Profession</label><input type="text" value={form.profession} onChange={e => updateField('profession', e.target.value)} /></div>
            <div className="field"><label>Pret pour protocole</label><select value={form.pretProtocole || ''} onChange={e => updateField('pretProtocole', e.target.value)}><option value="">-</option><option value="Oui">Oui</option><option value="Non">Non</option><option value="Peut-etre">Peut-etre</option></select></div>
          </div>

          <div className="anamnese-subsection" style={{ marginTop: 32 }}>
            <h4>Mesures corporelles</h4>
            <div className="form-grid">
              <div className="field"><label>Tour de taille (cm)</label><input type="number" step="0.1" value={form.tourTaille || ''} onChange={e => updateField('tourTaille', e.target.value)} /></div>
              <div className="field"><label>Tour de hanche (cm)</label><input type="number" step="0.1" value={form.tourHanche || ''} onChange={e => updateField('tourHanche', e.target.value)} /></div>
              <div className="field"><label>Tour de poitrine (cm)</label><input type="number" step="0.1" value={form.tourPoitrine || ''} onChange={e => updateField('tourPoitrine', e.target.value)} /></div>
              <div className="field"><label>Tour de bras (cm)</label><input type="number" step="0.1" value={form.tourBras || ''} onChange={e => updateField('tourBras', e.target.value)} /></div>
              <div className="field"><label>Tour de cuisse (cm)</label><input type="number" step="0.1" value={form.tourCuisse || ''} onChange={e => updateField('tourCuisse', e.target.value)} /></div>
              <div className="field"><label>Masse grasse (%)</label><input type="number" step="0.1" value={form.masseGrasse || ''} onChange={e => updateField('masseGrasse', e.target.value)} /></div>
              <div className="field"><label>Masse musculaire (%)</label><input type="number" step="0.1" value={form.masseMusculaire || ''} onChange={e => updateField('masseMusculaire', e.target.value)} /></div>
            </div>
          </div>

          <div className="anamnese-subsection" style={{ marginTop: 32 }}>
            <h4>Antecedents & Allergies</h4>
            <div className="form-grid">
              <div className="field full-width"><label>Pathologies</label><SmartTextarea value={form.pathologies} onChange={e => updateField('pathologies', e.target.value)} placeholder="Thyroide, diabete, SIBO..." rows={3} /></div>
              <div className="field full-width"><label>Traitements en cours</label><SmartTextarea value={form.traitements} onChange={e => updateField('traitements', e.target.value)} placeholder="Medicaments actuels..." rows={2} /></div>
              <div className="field full-width"><label>Allergies</label><SmartTextarea value={form.allergies} onChange={e => updateField('allergies', e.target.value)} placeholder="Alimentaires, medicamenteuses..." rows={2} /></div>
              <div className="field full-width"><label>Operations marquantes</label><SmartTextarea value={form.operations} onChange={e => updateField('operations', e.target.value)} placeholder="Chirurgies, fractures..." rows={2} /></div>
              <div className="field full-width"><label>Antecedents familiaux</label><SmartTextarea value={form.antecedentsFamiliaux} onChange={e => updateField('antecedentsFamiliaux', e.target.value)} placeholder="Diabete, cardio, cancers dans la famille..." rows={2} /></div>
            </div>
          </div>
        </div>
      )}

      {/* ─── ETAPE 2 : Sante femme (conditionnel) ─── */}
      {step === 2 && (
        <div className="nutrition-form-section">
          <h3>Sante femme</h3>
          {isFemme ? (
            <div className="form-grid">
              {/* V96.18 — Etat reproductif/maternel actuel (cle pour modules grossesse/allaitement/postPartum du composer beta) */}
              <div className="field"><label>Grossesse en cours ?</label><select value={form.grossesseActuelle || ''} onChange={e => updateField('grossesseActuelle', e.target.value)}><option value="">-</option><option value="Oui">Oui</option><option value="Non">Non</option></select></div>
              {form.grossesseActuelle === 'Oui' && (
                <div className="field"><label>Trimestre</label><select value={form.grossesseTrimestre || ''} onChange={e => updateField('grossesseTrimestre', e.target.value)}><option value="">-</option><option value="T1">T1 (1-3 mois)</option><option value="T2">T2 (4-6 mois)</option><option value="T3">T3 (7-9 mois)</option></select></div>
              )}
              <div className="field"><label>Allaitement ?</label><select value={form.allaitement || ''} onChange={e => updateField('allaitement', e.target.value)}><option value="">-</option><option value="Oui">Oui</option><option value="Non">Non</option></select></div>
              {form.allaitement === 'Oui' && (
                <div className="field"><label>Allaitement depuis (mois)</label><input type="number" min="0" max="36" value={form.allaitementMois || ''} onChange={e => updateField('allaitementMois', e.target.value)} placeholder="6" /></div>
              )}
              <div className="field"><label>Post-partum (sans allaitement) ?</label><select value={form.postPartum || ''} onChange={e => updateField('postPartum', e.target.value)}><option value="">-</option><option value="Oui">Oui</option><option value="Non">Non</option></select></div>
              {form.postPartum === 'Oui' && (
                <div className="field"><label>Mois depuis l&apos;accouchement</label><input type="number" min="0" max="24" value={form.postPartumMois || ''} onChange={e => updateField('postPartumMois', e.target.value)} placeholder="4" /></div>
              )}
              <div className="field"><label>Contraception</label><input type="text" value={form.contraception} onChange={e => updateField('contraception', e.target.value)} placeholder="Pilule, sterilet..." /></div>
              <div className="field"><label>Duree / regularite du cycle</label><input type="text" value={form.cycleDuree} onChange={e => updateField('cycleDuree', e.target.value)} placeholder="28j, regulier..." /></div>
              <div className="field full-width"><label>SPM</label><SmartTextarea value={form.spm} onChange={e => updateField('spm', e.target.value)} placeholder="Irritabilite, ballonnements, fatigue..." rows={2} /></div>
              <div className="field full-width"><label>Douleurs menstruelles</label><SmartTextarea value={form.douleursMenstruelles} onChange={e => updateField('douleursMenstruelles', e.target.value)} placeholder="Intensite, flux..." rows={2} /></div>
              <div className="field"><label>Projet grossesse</label><select value={form.projetGrossesse} onChange={e => updateField('projetGrossesse', e.target.value)}><option value="">-</option><option value="Oui">Oui</option><option value="Non">Non</option><option value="Peut-etre">Peut-etre</option></select></div>
              <div className="field full-width"><label>Blessures / Douleurs actuelles</label><SmartTextarea value={form.blessures || ''} onChange={e => updateField('blessures', e.target.value)} placeholder="Tendinites, douleurs..." rows={2} /></div>
            </div>
          ) : (
            <div className="form-grid">
              <p style={{ color: '#8a8a7a', fontSize: '.85rem', gridColumn: '1/-1' }}>Section reservee aux clientes. Passez a l'etape suivante.</p>
              <div className="field full-width"><label>Blessures / Douleurs actuelles</label><SmartTextarea value={form.blessures || ''} onChange={e => updateField('blessures', e.target.value)} placeholder="Tendinites, douleurs..." rows={2} /></div>
              <div className="field full-width"><label>Douleurs actuelles</label><SmartTextarea value={form.douleursActuelles || ''} onChange={e => updateField('douleursActuelles', e.target.value)} placeholder="Maux de tete, tensions..." rows={2} /></div>
            </div>
          )}
        </div>
      )}

      {/* ─── ETAPE 3 : Digestion ─── */}
      {step === 3 && (
        <div className="nutrition-form-section">
          <h3>Digestion</h3>
          <div className="form-grid">
            <div className="field"><label>Nombre de repas / jour</label><select value={form.nbRepas || ''} onChange={e => updateField('nbRepas', e.target.value)}><option value="">-</option><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5+">5+</option></select></div>
            <div className="field"><label>Hydratation</label><input type="text" value={form.hydratation || ''} onChange={e => updateField('hydratation', e.target.value)} placeholder="Ex: 1.5L, < 1L..." /></div>
            <div className="field full-width"><label>Aliments evites / intolerances</label><SmartTextarea value={form.alimentsEvites || ''} onChange={e => updateField('alimentsEvites', e.target.value)} placeholder="Gluten, lactose, FODMAPs..." rows={2} /></div>
            <div className="field full-width"><label>Ballonnements</label>
              <div className="radio-group">{['Jamais', 'Occasionnellement', 'Frequemment', 'Quotidiennement'].map(opt => (<label key={opt} className="radio-label"><input type="radio" name="frequenceBallonnements" value={opt} checked={form.frequenceBallonnements === opt} onChange={e => updateField('frequenceBallonnements', e.target.value)} /><span>{opt}</span></label>))}</div>
            </div>
            <div className="field full-width"><label>Transit</label>
              <div className="radio-group">{['Regulier', 'Lent (constipation)', 'Irregulier', 'Accelere'].map(opt => (<label key={opt} className="radio-label"><input type="radio" name="transitType" value={opt} checked={form.transitType === opt} onChange={e => updateField('transitType', e.target.value)} /><span>{opt}</span></label>))}</div>
            </div>
            <div className="field full-width"><label>Aliments problematiques</label><SmartTextarea value={form.alimentsProblematiques} onChange={e => updateField('alimentsProblematiques', e.target.value)} placeholder="Aliments qui posent probleme..." rows={3} /></div>
            <div className="field full-width"><label>Consommation reguliere</label>
              <div className="checkbox-group">{CONSOMMATION_REGULIERE_OPTIONS.map(opt => (<button key={opt} type="button" className={`checkbox-chip ${(form.consommationReguliere || []).includes(opt) ? 'checkbox-chip-active anissa-chip-active' : ''}`} onClick={() => toggleCheckbox('consommationReguliere', opt)}>{opt}</button>))}</div>
            </div>
            <div className="field full-width"><label>Regimes suivis</label><SmartTextarea value={form.regimesSuivis || ''} onChange={e => updateField('regimesSuivis', e.target.value)} placeholder="Cetogene, paleo, jeune intermittent..." rows={2} /></div>
            <div className="field full-width"><label>Mastication / grignotages</label><SmartTextarea value={form.mastication} onChange={e => updateField('mastication', e.target.value)} placeholder="Vitesse de mastication, grignotages..." rows={2} /></div>

            {/* V97.4 V3.H Gap #1 — Pression antibiotique (consommé par moteur microbiome) */}
            <div className="field full-width">
              <label>Antibiotiques récents</label>
              <div className="radio-group">
                {[
                  { value: 'aucun', label: 'Aucun depuis &gt; 12 mois' },
                  { value: 'moins_3_mois', label: 'Dans les 3 derniers mois' },
                  { value: 'moins_12_mois', label: 'Dans les 12 derniers mois' },
                  { value: 'plus_12_mois', label: 'Plus ancien' },
                ].map(opt => (
                  <label key={opt.value} className="radio-label">
                    <input type="radio" name="antibiotiques_recents" value={opt.value}
                      checked={form.antibiotiques_recents === opt.value}
                      onChange={e => updateField('antibiotiques_recents', e.target.value)} />
                    <span dangerouslySetInnerHTML={{ __html: opt.label }} />
                  </label>
                ))}
              </div>
            </div>
            <div className="field full-width">
              <label>Fréquence cures antibiotiques (12 derniers mois)</label>
              <div className="radio-group">
                {[
                  { value: 'aucune', label: 'Aucune' },
                  { value: '1_cure', label: '1 cure' },
                  { value: '2_3_cures', label: '2–3 cures' },
                  { value: '4_plus_cures', label: '4+ cures ou cure prolongée' },
                ].map(opt => (
                  <label key={opt.value} className="radio-label">
                    <input type="radio" name="antibiotiques_frequence_12mois" value={opt.value}
                      checked={form.antibiotiques_frequence_12mois === opt.value}
                      onChange={e => updateField('antibiotiques_frequence_12mois', e.target.value)} />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="field full-width">
              <label>Antifongiques récents (12 derniers mois)</label>
              <div className="radio-group">
                {[
                  { value: 'non', label: 'Non' },
                  { value: 'oui_12_mois', label: 'Oui' },
                ].map(opt => (
                  <label key={opt.value} className="radio-label">
                    <input type="radio" name="antifongiques_recents" value={opt.value}
                      checked={form.antifongiques_recents === opt.value}
                      onChange={e => updateField('antifongiques_recents', e.target.value)} />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="field full-width">
              <label>Infections récurrentes (ORL, urinaires, mycoses…)</label>
              <div className="radio-group">
                {[
                  { value: 'aucune', label: 'Aucune' },
                  { value: 'occasionnelles', label: 'Occasionnelles' },
                  { value: 'frequentes', label: 'Fréquentes' },
                ].map(opt => (
                  <label key={opt.value} className="radio-label">
                    <input type="radio" name="infections_recurrentes" value={opt.value}
                      checked={form.infections_recurrentes === opt.value}
                      onChange={e => updateField('infections_recurrentes', e.target.value)} />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* V97.4 V3.H Gap #2 — Transit détaillé (consommé par moteur microbiome) */}
            <div className="field full-width">
              <label>Fréquence des selles</label>
              <div className="radio-group">
                {[
                  { value: 'moins_3_par_semaine', label: '< 3 fois / semaine' },
                  { value: '1_par_jour', label: '1 fois / jour' },
                  { value: '2_3_par_jour', label: '2–3 fois / jour' },
                  { value: 'plus_3_par_jour', label: '> 3 fois / jour' },
                ].map(opt => (
                  <label key={opt.value} className="radio-label">
                    <input type="radio" name="frequence_selles" value={opt.value}
                      checked={form.frequence_selles === opt.value}
                      onChange={e => updateField('frequence_selles', e.target.value)} />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="field full-width">
              <label>Type de selles (Bristol simplifié)</label>
              <div className="radio-group">
                {[
                  { value: '1_2', label: 'Type 1–2 (dures, en billes)' },
                  { value: '3_4', label: 'Type 3–4 (normales, formées)' },
                  { value: '5', label: 'Type 5 (molles)' },
                  { value: '6_7', label: 'Type 6–7 (liquides, diarrhéiques)' },
                ].map(opt => (
                  <label key={opt.value} className="radio-label">
                    <input type="radio" name="bristol_selles" value={opt.value}
                      checked={form.bristol_selles === opt.value}
                      onChange={e => updateField('bristol_selles', e.target.value)} />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="field full-width">
              <label>Douleurs digestives</label>
              <div className="radio-group">
                {[
                  { value: 'non', label: 'Non' },
                  { value: 'occasionnelles', label: 'Occasionnelles' },
                  { value: 'frequentes', label: 'Fréquentes' },
                ].map(opt => (
                  <label key={opt.value} className="radio-label">
                    <input type="radio" name="douleurs_digestives" value={opt.value}
                      checked={form.douleurs_digestives === opt.value}
                      onChange={e => updateField('douleurs_digestives', e.target.value)} />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="field full-width">
              <label>Reflux / brûlures gastriques</label>
              <div className="radio-group">
                {[
                  { value: 'non', label: 'Non' },
                  { value: 'occasionnel', label: 'Occasionnel' },
                  { value: 'frequent', label: 'Fréquent' },
                ].map(opt => (
                  <label key={opt.value} className="radio-label">
                    <input type="radio" name="reflux" value={opt.value}
                      checked={form.reflux === opt.value}
                      onChange={e => updateField('reflux', e.target.value)} />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="field full-width">
              <label>Ballonnements après les repas</label>
              <div className="radio-group">
                {[
                  { value: 'non', label: 'Non' },
                  { value: 'occasionnels', label: 'Occasionnels' },
                  { value: 'frequents', label: 'Fréquents' },
                ].map(opt => (
                  <label key={opt.value} className="radio-label">
                    <input type="radio" name="ballonnements_post_repas" value={opt.value}
                      checked={form.ballonnements_post_repas === opt.value}
                      onChange={e => updateField('ballonnements_post_repas', e.target.value)} />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── ETAPE 4 : Symptomes fonctionnels ─── */}
      {step === 4 && (
        <div className="nutrition-form-section">
          <h3>Symptomes fonctionnels</h3>
          <div className="form-grid">
            <div className="field full-width"><label>Fringales sucrees</label>
              <div className="radio-group">{['Jamais', 'Occasionnellement', 'Quotidiennement', 'Plusieurs fois par jour'].map(opt => (<label key={opt} className="radio-label"><input type="radio" name="fringalesSucre" value={opt} checked={form.fringalesSucre === opt} onChange={e => updateField('fringalesSucre', e.target.value)} /><span>{opt}</span></label>))}</div>
            </div>
            <div className="field full-width"><label>Coups de fatigue / energie instable</label>
              <div className="radio-group">{['Non', 'Oui apres les repas', 'Oui en milieu de journee', 'Oui en permanence'].map(opt => (<label key={opt} className="radio-label"><input type="radio" name="variationsGlycemie" value={opt} checked={form.variationsGlycemie === opt} onChange={e => updateField('variationsGlycemie', e.target.value)} /><span>{opt}</span></label>))}</div>
            </div>
            <div className="field full-width"><label>Apres un repas copieux, vous ressentez</label>
              <div className="checkbox-group">{['Energie stable', 'Somnolence', 'Ballonnements', 'Faim rapide'].map(opt => (<button key={opt} type="button" className={`checkbox-chip ${(form.reactionGlucides || []).includes(opt) ? 'checkbox-chip-active anissa-chip-active' : ''}`} onClick={() => toggleCheckbox('reactionGlucides', opt)}>{opt}</button>))}</div>
            </div>
            <div className="field full-width"><label>Douleurs articulaires / inflammations</label>
              <div className="radio-group">{['Non', 'Occasionnelles', 'Frequentes', 'Quotidiennes'].map(opt => (<label key={opt} className="radio-label"><input type="radio" name="douleursInflammations" value={opt} checked={form.douleursInflammations === opt} onChange={e => updateField('douleursInflammations', e.target.value)} /><span>{opt}</span></label>))}</div>
            </div>
            <div className="field full-width"><label>Troubles de peau</label>
              <div className="radio-group">{['Non', 'Oui occasionnel', 'Oui chronique'].map(opt => (<label key={opt} className="radio-label"><input type="radio" name="troublesPeau" value={opt} checked={form.troublesPeau === opt} onChange={e => updateField('troublesPeau', e.target.value)} /><span>{opt}</span></label>))}</div>
            </div>
            <div className="field full-width"><label>Infections fréquentes (rhume, grippe, gastro…)</label>
              <div className="radio-group">{['Rarement', '1-2 fois par an', 'Plusieurs fois par an'].map(opt => (<label key={opt} className="radio-label"><input type="radio" name="frequenceMaladies" value={opt} checked={form.frequenceMaladies === opt} onChange={e => updateField('frequenceMaladies', e.target.value)} /><span>{opt}</span></label>))}</div>
            </div>
          </div>

          <div className="anamnese-subsection" style={{ marginTop: 32 }}>
            <h4>Suivi medical</h4>
            <div className="form-grid">
              <div className="field full-width"><label>Medecin traitant</label><input type="text" value={form.medecinTraitant || ''} onChange={e => updateField('medecinTraitant', e.target.value)} placeholder="Dr Untel, cabinet de Nyon..." /></div>
              <div className="field full-width"><label>Dernier detartrage</label><input type="text" value={form.dernierDetartrage || ''} onChange={e => updateField('dernierDetartrage', e.target.value)} placeholder="Ex: il y a 6 mois, fevrier 2024, jamais..." /></div>
            </div>
          </div>
        </div>
      )}

      {/* ─── ETAPE 5 : Sport ─── */}
      {step === 5 && (
        <div className="nutrition-form-section">
          <h3>Sport</h3>
          <div className="form-grid">
            <div className="field"><label>Type de sport</label><input type="text" value={form.typeSport} onChange={e => updateField('typeSport', e.target.value)} placeholder="CrossFit, course, yoga..." /></div>
            <div className="field"><label>Frequence</label><input type="text" value={form.frequenceSport} onChange={e => updateField('frequenceSport', e.target.value)} placeholder="4x/sem, 1h" /></div>
            <div className="field full-width"><label>Objectif sportif</label><input type="text" value={form.objectifSport} onChange={e => updateField('objectifSport', e.target.value)} placeholder="Masse, endurance, bien-etre..." /></div>
            <div className="field full-width"><label>Recuperation</label><SmartTextarea value={form.recuperation} onChange={e => updateField('recuperation', e.target.value)} placeholder="Courbatures, fatigue post-effort..." rows={2} /></div>
            <div className="field full-width"><label>Supplements actuels</label><SmartTextarea value={form.supplements} onChange={e => updateField('supplements', e.target.value)} placeholder="Creatine, BCAA, proteines..." rows={2} /></div>
            <div className="field full-width"><label>Digestif a l'effort</label><SmartTextarea value={form.digestifEffort} onChange={e => updateField('digestifEffort', e.target.value)} placeholder="Nausees, crampes pendant l'effort..." rows={2} /></div>
          </div>
        </div>
      )}

      {/* ─── ETAPE 6 : Mode de vie ─── */}
      {step === 6 && (
        <div className="nutrition-form-section">
          <h3>Mode de vie</h3>
          <div className="form-grid">
            <div className="field full-width"><label>Energie au cours de la journee</label>
              <div className="radio-group">{['Stable', 'Fatigue en matinee', 'Fatigue apres les repas', "Gros coup de fatigue l'apres-midi"].map(opt => (<label key={opt} className="radio-label"><input type="radio" name="energieJournee" value={opt} checked={form.energieJournee === opt} onChange={e => updateField('energieJournee', e.target.value)} /><span>{opt}</span></label>))}</div>
            </div>
            <div className="field full-width"><label>Stress (1-10)</label>
              <div className="stress-slider-container"><input type="range" min="1" max="10" value={form.niveauStressActuel || 5} onChange={e => updateField('niveauStressActuel', e.target.value)} className="stress-slider" /><span className="stress-value">{form.niveauStressActuel || 5}/10</span></div>
            </div>
            <div className="field"><label>Heures de sommeil</label><input type="number" value={form.heuresSommeil} onChange={e => updateField('heuresSommeil', e.target.value)} placeholder="7" min="1" max="16" /></div>
            <div className="field"><label>Endormissement</label>
              <div className="radio-group">{['Non', 'Occasionnelles', 'Frequentes'].map(opt => (<label key={opt} className="radio-label"><input type="radio" name="difficultesEndormissement" value={opt} checked={form.difficultesEndormissement === opt} onChange={e => updateField('difficultesEndormissement', e.target.value)} /><span>{opt}</span></label>))}</div>
            </div>
            <div className="field"><label>Reveils nocturnes</label>
              <div className="radio-group">{['Non', '1 fois', 'Plusieurs fois'].map(opt => (<label key={opt} className="radio-label"><input type="radio" name="reveilsNocturnes" value={opt} checked={form.reveilsNocturnes === opt} onChange={e => updateField('reveilsNocturnes', e.target.value)} /><span>{opt}</span></label>))}</div>
            </div>
            <div className="field"><label>Etat au reveil</label>
              <div className="radio-group">{['En forme', 'Fatigue', 'Epuise'].map(opt => (<label key={opt} className="radio-label"><input type="radio" name="etatReveil" value={opt} checked={form.etatReveil === opt} onChange={e => updateField('etatReveil', e.target.value)} /><span>{opt}</span></label>))}</div>
            </div>
            <div className="field"><label>Lumiere naturelle</label>
              <div className="radio-group">{['Oui', 'Non'].map(opt => (<label key={opt} className="radio-label"><input type="radio" name="tempsExterieur" value={opt} checked={form.tempsExterieur === opt} onChange={e => updateField('tempsExterieur', e.target.value)} /><span>{opt}</span></label>))}</div>
            </div>
            <div className="field"><label>Ecrans le soir</label>
              <div className="radio-group">{['Peu', 'Moderement', 'Beaucoup'].map(opt => (<label key={opt} className="radio-label"><input type="radio" name="expositionEcransSoir" value={opt} checked={form.expositionEcransSoir === opt} onChange={e => updateField('expositionEcransSoir', e.target.value)} /><span>{opt}</span></label>))}</div>
            </div>
            <div className="field"><label>Alcool</label><input type="text" value={form.alcool || ''} onChange={e => updateField('alcool', e.target.value)} placeholder="2 verres/sem, jamais..." /></div>
            <div className="field"><label>Tabac</label><input type="text" value={form.tabac || ''} onChange={e => updateField('tabac', e.target.value)} placeholder="Non-fumeur, 5 cig/j..." /></div>
          </div>
        </div>
      )}

      {/* ─── ETAPE 7 : Labo & Genetique ─── */}
      {step === 7 && (
        <div className="nutrition-form-section">
          <h3>Labo & Genetique</h3>
          <p style={{ fontSize: '.78rem', color: '#8a8a7a', marginBottom: 12 }}>Optionnel — ne bloque pas la generation du plan.</p>
          <div className="form-grid">
            <div className="field"><label>Analyses biologiques recentes</label><div className="radio-group">{['Oui', 'Non'].map(opt => (<label key={opt} className="radio-label"><input type="radio" name="analysesBiologiques" value={opt} checked={form.analysesBiologiques === opt} onChange={e => updateField('analysesBiologiques', e.target.value)} /><span>{opt}</span></label>))}</div></div>
            <div className="field"><label>Test ADN nutrigenetique</label><div className="radio-group">{['Oui', 'Non'].map(opt => (<label key={opt} className="radio-label"><input type="radio" name="testADN" value={opt} checked={form.testADN === opt} onChange={e => updateField('testADN', e.target.value)} /><span>{opt}</span></label>))}</div></div>
            <div className="field full-width"><label>Tests genetiques connus</label><SmartTextarea value={form.testsGenetiques} onChange={e => updateField('testsGenetiques', e.target.value)} placeholder="MTHFR, APOE, DIO2..." rows={2} /></div>
            <div className="field full-width"><label>Pret(e) pour analyses avancees</label>
              <div className="radio-group">{['Oui', 'Peut-etre', 'Non'].map(opt => (<label key={opt} className="radio-label"><input type="radio" name="pretAnalysesAvancees" value={opt} checked={form.pretAnalysesAvancees === opt} onChange={e => updateField('pretAnalysesAvancees', e.target.value)} /><span>{opt}</span></label>))}</div>
            </div>
          </div>
        </div>
      )}

      {/* ─── ETAPE 8 : Notes coach ─── */}
      {step === 8 && (
        <div className="nutrition-form-section">
          <h3>Notes coach</h3>
          <div className="form-grid">
            <div className="field full-width"><label>Objectif principal (validation / correction)</label><SmartTextarea value={form.objectifPrincipalNutrition} onChange={e => updateField('objectifPrincipalNutrition', e.target.value)} placeholder="Objectif du client..." rows={3} /></div>

            {/* V97.4 V3.H Gap #3 — Objectifs priorisés (focus plan IA) */}
            <div className="field full-width">
              <label>Objectif priorité 1 (focus principal du plan)</label>
              <SmartTextarea
                value={form.objectif_primaire || ''}
                onChange={e => updateField('objectif_primaire', e.target.value)}
                placeholder="Ex: Stabiliser l'énergie sur la journée"
                rows={2}
              />
            </div>
            <div className="field full-width">
              <label>Objectif priorité 2 (en support)</label>
              <SmartTextarea
                value={form.objectif_secondaire_1 || ''}
                onChange={e => updateField('objectif_secondaire_1', e.target.value)}
                placeholder="Ex: Améliorer le sommeil"
                rows={2}
              />
            </div>
            <div className="field full-width">
              <label>Objectif priorité 3 (en support)</label>
              <SmartTextarea
                value={form.objectif_secondaire_2 || ''}
                onChange={e => updateField('objectif_secondaire_2', e.target.value)}
                placeholder="Ex: Réduire les ballonnements"
                rows={2}
              />
            </div>
            <div className="field full-width">
              <label>Niveau d'urgence</label>
              <div className="radio-group">
                {[
                  { value: 'urgent_moins_1m', label: 'Urgent (résultats < 1 mois)' },
                  { value: 'moyen_3_6m', label: 'Moyen terme (3–6 mois)' },
                  { value: 'long_terme', label: 'Long terme (transformation durable)' },
                ].map(opt => (
                  <label key={opt.value} className="radio-label">
                    <input type="radio" name="objectif_urgency" value={opt.value}
                      checked={form.objectif_urgency === opt.value}
                      onChange={e => updateField('objectif_urgency', e.target.value)} />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="field full-width"><label>Depuis combien de temps</label><SmartTextarea value={form.dureeProbleme} onChange={e => updateField('dureeProbleme', e.target.value)} placeholder="Duree du probleme..." rows={2} /></div>
            <div className="field full-width"><label>Deja essaye</label><SmartTextarea value={form.dejaEssaye} onChange={e => updateField('dejaEssaye', e.target.value)} placeholder="Regimes, supplements, consultations..." rows={2} /></div>
            <div className="field full-width private-field">
              <label><span className="private-lock">🔒</span> Notes privees <span className="private-badge">Visible uniquement par vous</span></label>
              <textarea value={form.privateNotes || ''} onChange={e => updateField('privateNotes', e.target.value)} placeholder="Notes confidentielles..." rows={4} />
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="nav-buttons">
        {step > 1 ? (
          <button className="btn btn-secondary" onClick={() => setStep(step - 1)}>Precedent</button>
        ) : (
          <button className="btn btn-secondary" onClick={onCancel}>Annuler</button>
        )}
        {step < totalSteps ? (
          <button className="btn btn-primary" onClick={() => setStep(step + 1)}>Suivant</button>
        ) : (
          <>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={!form.prenom.trim()}>
              {clientId ? 'Sauvegarder l\'anamnèse' : 'Créer le client'}
            </button>
            {/* V97.11.4 : bouton "Terminer & suggérer les analyses" retiré.
                La suggestion analyses appartient désormais à l'étape Analyses
                du parcours (cf. StepAnalyses). Cette anamnèse sert
                uniquement à la saisie clinique. */}
          </>
        )}
      </div>

      {savePlanError && (
        <div style={{ marginTop: 12, padding: 10, background: 'rgba(196,68,68,0.1)', color: '#c44', borderRadius: 6 }}>
          Erreur sauvegarde plan : {savePlanError}
        </div>
      )}

      {/* Modale suggestion analyses */}
      <AnalysisSuggestionModal
        isOpen={showSuggestModal}
        onClose={() => setShowSuggestModal(false)}
        client={{ id: clientId, form }}
        packType={packType}
        onValidate={handleSavePlan}
      />
    </div>
  );
}

// V97.11.4 — Encart résumé pré-questionnaire (lecture seule) en haut du form.
// Affiche les réponses de la cliente reçues via l'app cliente, sans auto-fill
// des champs : Anissa lit + complète ses propres observations dessous.
function PreQuestionnaireSummary({ form }) {
  const hasPreQ = !!(form.objectif_primaire || form.dureeProbleme || form.ressentiDigestion || form.energieJournee);
  if (!hasPreQ) return null;

  const urgencyLabel = form.objectif_urgency === 'urgent_moins_1m' ? 'Urgent (< 1 mois)'
    : form.objectif_urgency === 'moyen_3_6m' ? 'Moyen terme (3–6 mois)'
    : form.objectif_urgency === 'long_terme' ? 'Long terme'
    : null;

  const digestionLabel = form.ressentiDigestion === 'Confortable' ? 'Confortable'
    : form.ressentiDigestion === 'Inconfort_occasionnel' ? 'Inconfort occasionnel'
    : form.ressentiDigestion === 'Inconfort_frequent' ? 'Inconfort fréquent'
    : form.ressentiDigestion === 'Inconfort_quotidien' ? 'Inconfort quotidien'
    : form.ressentiDigestion;

  const cycleParts = [];
  if (form.grossesseActuelle && form.grossesseActuelle !== 'Non') cycleParts.push(form.grossesseActuelle);
  if (form.contraception) cycleParts.push(`Contraception : ${form.contraception}`);
  const cycleStr = cycleParts.join(' · ');

  const rows = [
    { k: 'Objectif principal', v: form.objectif_primaire },
    { k: 'Depuis combien de temps', v: form.dureeProbleme },
    { k: 'Urgence', v: urgencyLabel },
    { k: 'Digestion ressentie', v: digestionLabel },
    { k: 'Énergie au quotidien', v: form.energieJournee },
    { k: 'Pathologies', v: form.pathologies },
    { k: 'Traitements', v: form.traitements },
    { k: 'Allergies', v: form.allergies },
    { k: 'Cycle hormonal', v: cycleStr || null },
  ].filter((r) => r.v && String(r.v).trim() !== '');

  return (
    <div style={{
      marginTop: 16,
      padding: '14px 18px',
      background: 'rgba(74, 222, 128, 0.05)',
      border: '1px solid rgba(74, 222, 128, 0.18)',
      borderRadius: 10,
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 10,
        fontSize: '.82rem',
        fontWeight: 600,
        color: '#4ade80',
        textTransform: 'uppercase',
        letterSpacing: '.05em',
      }}>
        <span>📋</span>
        Réponses du pré-questionnaire
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', rowGap: 6, columnGap: 14, fontSize: '.82rem' }}>
        {rows.map((r) => (
          <React.Fragment key={r.k}>
            <div style={{ color: '#8a8a7a', textTransform: 'uppercase', fontSize: '.7rem', letterSpacing: '.04em', paddingTop: 2 }}>
              {r.k}
            </div>
            <div style={{ color: '#c8d8c8', lineHeight: 1.45 }}>{r.v}</div>
          </React.Fragment>
        ))}
      </div>
      <p style={{ marginTop: 10, fontSize: '.72rem', color: '#7a7a6a', fontStyle: 'italic' }}>
        Ces réponses proviennent du pré-questionnaire de la cliente. Ajoute tes observations cliniques dans les champs ci-dessous.
      </p>
    </div>
  );
}
