import { useState, useEffect } from 'react';
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
  // defaut (vision "ligne conductrice"), mais decochable pour les clientes
  // qui ne veulent pas de l'app (generations agees, refus tech, etc.).
  const [activateApp, setActivateApp] = useState(true);
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
      onSaveQuick(form, packType, { activateApp });
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
            <p style={{ fontSize: '.78rem', color: '#8a8a7a', marginBottom: 16 }}>Creez la cliente, activez son espace dans l&apos;app, et envoyez-lui le questionnaire par email.</p>

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

            {/* V97.5.1 — Toggle activation app cliente. Coche par defaut.
                Anissa peut decocher pour les clientes qui ne veulent pas de
                l'app (generations agees, refus tech, etc.). L'app pourra
                toujours etre activee plus tard via le cockpit du parcours. */}
            <div
              style={{
                marginTop: 16,
                padding: '12px 14px',
                background: activateApp ? 'rgba(74,222,128,.06)' : 'rgba(255,255,255,.02)',
                border: `1px solid ${activateApp ? 'rgba(74,222,128,.2)' : 'rgba(255,255,255,.08)'}`,
                borderRadius: 10,
                transition: 'all .15s',
              }}
            >
              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  cursor: 'pointer',
                  fontSize: '.82rem',
                  color: activateApp ? '#c8d8c8' : '#8a8a7a',
                }}
              >
                <input
                  type="checkbox"
                  checked={activateApp}
                  onChange={e => setActivateApp(e.target.checked)}
                  style={{ marginTop: 3, width: 16, height: 16, cursor: 'pointer', accentColor: '#4ade80' }}
                />
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 2 }}>
                    Activer l&apos;espace app cliente
                  </div>
                  <div style={{ fontSize: '.74rem', color: '#7a7a6a', lineHeight: 1.45 }}>
                    {activateApp
                      ? 'La cliente recevra un magic link pour acceder a sa timeline (parcours en 7 etapes).'
                      : 'Aucun acces app envoye. Tu pourras l\'activer plus tard depuis l\'onglet App cliente.'}
                  </div>
                </div>
              </label>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button
                className="btn btn-anissa-primary"
                onClick={handleQuickCreate}
                disabled={!canCreate}
                style={{ flex: 1, padding: '12px 20px', fontSize: '.85rem', fontWeight: 600 }}
              >
                {activateApp
                  ? 'Creer la cliente et activer l\u2019app'
                  : 'Creer la cliente et envoyer le questionnaire'}
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
            <div className="field full-width"><label>Maladies frequentes</label>
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
              {clientId ? 'Sauvegarder' : 'Creer le client'}
            </button>
            {/* Phase B.1.b — Bouton suggestion analyses, visible uniquement
                en mode edition (clientId existe) et pour packs incluant des
                analyses (pas Consultation Initiale). */}
            {clientId && packType !== 'consultation_initiale_220' && (
              <button
                className="btn btn-primary"
                onClick={() => setShowSuggestModal(true)}
                disabled={!form.prenom.trim()}
                style={{ marginLeft: 8, background: '#2d5a3d' }}
                title="L'IA propose des analyses adaptees a l'anamnese, Anissa valide."
              >
                💡 Terminer &amp; suggerer les analyses
              </button>
            )}
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
