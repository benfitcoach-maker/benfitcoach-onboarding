import { useState } from 'react';
import { NUTRITION_INITIAL_FORM } from './formSteps';
import { SmartTextarea } from './KeywordHints';

const STEP_LABELS = [
  'Identite',
  'Antecedents',
  'Alimentation',
  'Sante',
  'Sport',
  'Metabolisme',
  'Digestion',
  'Inflammation',
  'Stress',
  'Mode de vie',
  'Genetique',
  'Objectifs',
  'Notes',
];

const CONSOMMATION_REGULIERE_OPTIONS = [
  'Produits fermentes',
  'Fibres (legumes, graines)',
  'Aucun des deux',
];

export default function AnissaClientForm({ onSave, onCancel, initialForm, clientId }) {
  const [form, setForm] = useState(initialForm || NUTRITION_INITIAL_FORM);
  const [step, setStep] = useState(1);
  const totalSteps = 13;

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

  const isFemme = form.genre === 'Femme';

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

      {/* ─── ETAPE 1 : Identite ─── */}
      {step === 1 && (
        <div className="nutrition-form-section">
          <h3>Identite</h3>
          <div className="form-grid">
            <div className="field">
              <label>Prenom *</label>
              <input type="text" value={form.prenom} onChange={e => updateField('prenom', e.target.value)} placeholder="Prenom" />
            </div>
            <div className="field">
              <label>Nom</label>
              <input type="text" value={form.nom} onChange={e => updateField('nom', e.target.value)} placeholder="Nom" />
            </div>
            <div className="field">
              <label>Email</label>
              <input type="email" value={form.email || ''} onChange={e => updateField('email', e.target.value)} placeholder="email@exemple.com" />
            </div>
            <div className="field">
              <label>Telephone</label>
              <input type="tel" value={form.telephone} onChange={e => updateField('telephone', e.target.value)} placeholder="+41 xx xxx xx xx" />
            </div>
            <div className="field">
              <label>Age</label>
              <input type="number" value={form.age} onChange={e => updateField('age', e.target.value)} placeholder="Ex: 35" />
            </div>
            <div className="field">
              <label>Genre</label>
              <select value={form.genre} onChange={e => updateField('genre', e.target.value)}>
                <option value="">Selectionner</option>
                <option value="Homme">Homme</option>
                <option value="Femme">Femme</option>
              </select>
            </div>
            <div className="field">
              <label>Poids (kg)</label>
              <input type="number" value={form.poids} onChange={e => updateField('poids', e.target.value)} placeholder="Ex: 72" />
            </div>
            <div className="field">
              <label>Taille (cm)</label>
              <input type="number" value={form.taille} onChange={e => updateField('taille', e.target.value)} placeholder="Ex: 175" />
            </div>
          </div>
          <div className="anamnese-subsection">
            <h4>Mesures corporelles (optionnel)</h4>
            <div className="form-grid">
              <div className="field">
                <label>Tour de taille (cm)</label>
                <input type="number" step="0.1" value={form.tourTaille || ''} onChange={e => updateField('tourTaille', e.target.value)} placeholder="Ex: 82" />
              </div>
              <div className="field">
                <label>Tour de hanche (cm)</label>
                <input type="number" step="0.1" value={form.tourHanche || ''} onChange={e => updateField('tourHanche', e.target.value)} placeholder="Ex: 95" />
              </div>
              <div className="field">
                <label>Tour de poitrine (cm)</label>
                <input type="number" step="0.1" value={form.tourPoitrine || ''} onChange={e => updateField('tourPoitrine', e.target.value)} placeholder="Ex: 90" />
              </div>
              <div className="field">
                <label>Tour de bras (cm)</label>
                <input type="number" step="0.1" value={form.tourBras || ''} onChange={e => updateField('tourBras', e.target.value)} placeholder="Ex: 32" />
              </div>
              <div className="field">
                <label>Tour de cuisse (cm)</label>
                <input type="number" step="0.1" value={form.tourCuisse || ''} onChange={e => updateField('tourCuisse', e.target.value)} placeholder="Ex: 55" />
              </div>
              <div className="field">
                <label>Masse grasse (%) — si connu</label>
                <input type="number" step="0.1" value={form.masseGrasse || ''} onChange={e => updateField('masseGrasse', e.target.value)} placeholder="Ex: 22" />
              </div>
              <div className="field">
                <label>Masse musculaire (%) — si connu</label>
                <input type="number" step="0.1" value={form.masseMusculaire || ''} onChange={e => updateField('masseMusculaire', e.target.value)} placeholder="Ex: 35" />
              </div>
            </div>
          </div>
          <div className="form-grid">
            <div className="field">
              <label>Profession</label>
              <input type="text" value={form.profession} onChange={e => updateField('profession', e.target.value)} placeholder="Ex: Comptable, enseignant..." />
            </div>
          </div>
        </div>
      )}

      {/* ─── ETAPE 2 : Antecedents medicaux ─── */}
      {step === 2 && (
        <div className="nutrition-form-section">
          <h3>Antecedents medicaux</h3>
          <div className="form-grid">
            <div className="field full-width">
              <label>Pathologies actuelles ou passees</label>
              <SmartTextarea value={form.pathologies} onChange={e => updateField('pathologies', e.target.value)} placeholder="Thyroide, diabete, hypertension, SIBO, Hashimoto..." rows={4} />
            </div>
            <div className="field full-width">
              <label>Operations ou accidents marquants</label>
              <SmartTextarea value={form.operations} onChange={e => updateField('operations', e.target.value)} placeholder="Chirurgies, fractures, traumatismes..." rows={3} />
            </div>
            <div className="field full-width">
              <label>Traitements en cours / anciens medicaments</label>
              <SmartTextarea value={form.traitements} onChange={e => updateField('traitements', e.target.value)} placeholder="Medicaments actuels, anciens traitements significatifs..." rows={3} />
            </div>
            <div className="field full-width">
              <label>Antecedents familiaux — maladies chroniques, auto-immunes</label>
              <SmartTextarea value={form.antecedentsFamiliaux} onChange={e => updateField('antecedentsFamiliaux', e.target.value)} placeholder="Diabete, maladies cardio-vasculaires, cancers dans la famille..." rows={3} />
            </div>
            <div className="field full-width">
              <label>Allergies connues</label>
              <SmartTextarea value={form.allergies} onChange={e => updateField('allergies', e.target.value)} placeholder="Alimentaires, medicamenteuses, environnementales..." rows={3} />
            </div>
          </div>
        </div>
      )}

      {/* ─── ETAPE 3 : Alimentation ─── */}
      {step === 3 && (
        <div className="nutrition-form-section">
          <h3>Alimentation</h3>
          <div className="form-grid">
            <div className="field">
              <label>Nombre de repas par jour</label>
              <select value={form.nbRepas} onChange={e => updateField('nbRepas', e.target.value)}>
                <option value="">Selectionner</option>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
                <option value="5+">5+</option>
              </select>
            </div>
            <div className="field">
              <label>Hydratation — eau par jour</label>
              <input type="text" value={form.hydratation} onChange={e => updateField('hydratation', e.target.value)} placeholder="Ex: 1.5L, 8 verres..." />
            </div>
            <div className="field full-width">
              <label>Aliments evites / interdits / intolerances</label>
              <SmartTextarea value={form.alimentsEvites} onChange={e => updateField('alimentsEvites', e.target.value)} placeholder="Gluten, lactose, histamine, FODMAPs, vegetarien, vegan..." rows={3} />
            </div>
            <div className="field full-width">
              <label>Regimes suivis actuellement ou par le passe</label>
              <SmartTextarea value={form.regimesSuivis || ''} onChange={e => updateField('regimesSuivis', e.target.value)} placeholder="Cetogene, paleo, vegetarien, jeune intermittent..." rows={3} />
            </div>
            <div className="field full-width">
              <label>Mastication, grignotages, compulsions sucrees ?</label>
              <SmartTextarea value={form.mastication} onChange={e => updateField('mastication', e.target.value)} placeholder="Vitesse de mastication, grignotages entre repas..." rows={3} />
            </div>
          </div>
        </div>
      )}

      {/* ─── ETAPE 4 : Sante ─── */}
      {step === 4 && (
        <div className="nutrition-form-section">
          <h3>Sante</h3>
          <div className="form-grid">
            <div className="field full-width">
              <label>Blessures passees / actuelles</label>
              <SmartTextarea value={form.blessures} onChange={e => updateField('blessures', e.target.value)} placeholder="Tendinites, fractures, douleurs chroniques..." rows={3} />
            </div>
            <div className="field full-width">
              <label>Douleurs actuelles</label>
              <SmartTextarea value={form.douleursActuelles || ''} onChange={e => updateField('douleursActuelles', e.target.value)} placeholder="Maux de tete, douleurs dorsales, tensions..." rows={3} />
            </div>
          </div>

          {/* Cycle hormonal - femmes uniquement */}
          {isFemme && (
            <div className="anamnese-subsection">
              <h4>Cycle hormonal</h4>
              <div className="form-grid">
                <div className="field">
                  <label>Contraception — type, duree</label>
                  <input type="text" value={form.contraception} onChange={e => updateField('contraception', e.target.value)} placeholder="Pilule depuis 5 ans, sterilet..." />
                </div>
                <div className="field">
                  <label>Duree et regularite du cycle</label>
                  <input type="text" value={form.cycleDuree} onChange={e => updateField('cycleDuree', e.target.value)} placeholder="28 jours, regulier / irregulier" />
                </div>
                <div className="field full-width">
                  <label>Symptomes premenstruels SPM</label>
                  <SmartTextarea value={form.spm} onChange={e => updateField('spm', e.target.value)} placeholder="Irritabilite, ballonnements, douleurs, fatigue..." rows={3} />
                </div>
                <div className="field full-width">
                  <label>Douleurs, regles abondantes, spotting ?</label>
                  <SmartTextarea value={form.douleursMenstruelles} onChange={e => updateField('douleursMenstruelles', e.target.value)} placeholder="Intensite des douleurs, flux abondant, spotting..." rows={3} />
                </div>
                <div className="field">
                  <label>Projet de grossesse en cours ?</label>
                  <select value={form.projetGrossesse} onChange={e => updateField('projetGrossesse', e.target.value)}>
                    <option value="">Selectionner</option>
                    <option value="Oui">Oui</option>
                    <option value="Non">Non</option>
                    <option value="Peut-etre">Peut-etre</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── ETAPE 5 : Sport & Performance ─── */}
      {step === 5 && (
        <div className="nutrition-form-section">
          <h3>Sport & Performance</h3>
          <div className="form-grid">
            <div className="field">
              <label>Type de sport pratique</label>
              <input type="text" value={form.typeSport} onChange={e => updateField('typeSport', e.target.value)} placeholder="CrossFit, course, musculation, yoga..." />
            </div>
            <div className="field">
              <label>Frequence et duree des entrainements</label>
              <input type="text" value={form.frequenceSport} onChange={e => updateField('frequenceSport', e.target.value)} placeholder="Ex: 4x/semaine, 1h par seance" />
            </div>
            <div className="field full-width">
              <label>Objectif sportif</label>
              <input type="text" value={form.objectifSport} onChange={e => updateField('objectifSport', e.target.value)} placeholder="Prise de masse, endurance, competition, bien-etre..." />
            </div>
            <div className="field full-width">
              <label>Qualite de la recuperation</label>
              <SmartTextarea value={form.recuperation} onChange={e => updateField('recuperation', e.target.value)} placeholder="Courbatures, fatigue post-effort, qualite du sommeil apres sport..." rows={3} />
            </div>
            <div className="field full-width">
              <label>Supplements ou stimulants utilises ?</label>
              <SmartTextarea value={form.supplements} onChange={e => updateField('supplements', e.target.value)} placeholder="Creatine, proteines, BCAA, cafeine, pre-workout..." rows={3} />
            </div>
            <div className="field full-width">
              <label>Problemes digestifs pendant l'effort ?</label>
              <SmartTextarea value={form.digestifEffort} onChange={e => updateField('digestifEffort', e.target.value)} placeholder="Nausees, crampes, reflux pendant ou apres l'effort..." rows={3} />
            </div>
          </div>
        </div>
      )}

      {/* ─── ETAPE 6 : Metabolisme & Energie ─── */}
      {step === 6 && (
        <div className="nutrition-form-section">
          <h3>Metabolisme & Energie</h3>
          <div className="form-grid">
            <div className="field full-width">
              <label>Comment evolue votre energie au cours de la journee ?</label>
              <div className="radio-group">
                {['Stable', 'Fatigue en matinee', 'Fatigue apres les repas', "Gros coup de fatigue l'apres-midi"].map(opt => (
                  <label key={opt} className="radio-label">
                    <input type="radio" name="energieJournee" value={opt} checked={form.energieJournee === opt} onChange={e => updateField('energieJournee', e.target.value)} />
                    <span>{opt}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="field full-width">
              <label>Ressentez-vous des fringales ou envies de sucre ?</label>
              <div className="radio-group">
                {['Jamais', 'Occasionnellement', 'Quotidiennement', 'Plusieurs fois par jour'].map(opt => (
                  <label key={opt} className="radio-label">
                    <input type="radio" name="fringalesSucre" value={opt} checked={form.fringalesSucre === opt} onChange={e => updateField('fringalesSucre', e.target.value)} />
                    <span>{opt}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="field full-width">
              <label>Avez-vous des variations de glycemie connues ou suspectees ?</label>
              <div className="radio-group">
                {['Non', 'Oui (hypoglycemies)', 'Oui (hyperglycemies)', 'Diabete diagnostique'].map(opt => (
                  <label key={opt} className="radio-label">
                    <input type="radio" name="variationsGlycemie" value={opt} checked={form.variationsGlycemie === opt} onChange={e => updateField('variationsGlycemie', e.target.value)} />
                    <span>{opt}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="field full-width">
              <label>Comment reagissez-vous apres un repas riche en glucides ?</label>
              <div className="radio-group">
                {['Energie stable', 'Somnolence', 'Ballonnements', 'Faim rapide'].map(opt => (
                  <label key={opt} className="radio-label">
                    <input type="radio" name="reactionGlucides" value={opt} checked={form.reactionGlucides === opt} onChange={e => updateField('reactionGlucides', e.target.value)} />
                    <span>{opt}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── ETAPE 7 : Digestion & Microbiote ─── */}
      {step === 7 && (
        <div className="nutrition-form-section">
          <h3>Digestion & Microbiote</h3>
          <div className="form-grid">
            <div className="field full-width">
              <label>A quelle frequence avez-vous des ballonnements ?</label>
              <div className="radio-group">
                {['Jamais', 'Occasionnellement', 'Frequemment', 'Quotidiennement'].map(opt => (
                  <label key={opt} className="radio-label">
                    <input type="radio" name="frequenceBallonnements" value={opt} checked={form.frequenceBallonnements === opt} onChange={e => updateField('frequenceBallonnements', e.target.value)} />
                    <span>{opt}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="field full-width">
              <label>Votre transit est plutot :</label>
              <div className="radio-group">
                {['Regulier', 'Lent (constipation)', 'Irregulier', 'Accelere'].map(opt => (
                  <label key={opt} className="radio-label">
                    <input type="radio" name="transitType" value={opt} checked={form.transitType === opt} onChange={e => updateField('transitType', e.target.value)} />
                    <span>{opt}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="field full-width">
              <label>Tolerance digestive : aliments problematiques identifies ?</label>
              <SmartTextarea value={form.alimentsProblematiques} onChange={e => updateField('alimentsProblematiques', e.target.value)} placeholder="Listez les aliments qui vous posent probleme..." rows={4} />
            </div>
            <div className="field full-width">
              <label>Consommez-vous regulierement :</label>
              <div className="checkbox-group">
                {CONSOMMATION_REGULIERE_OPTIONS.map(opt => (
                  <button
                    key={opt}
                    type="button"
                    className={`checkbox-chip ${(form.consommationReguliere || []).includes(opt) ? 'checkbox-chip-active anissa-chip-active' : ''}`}
                    onClick={() => toggleCheckbox('consommationReguliere', opt)}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── ETAPE 8 : Inflammation & Immunite ─── */}
      {step === 8 && (
        <div className="nutrition-form-section">
          <h3>Inflammation & Immunite</h3>
          <div className="form-grid">
            <div className="field full-width">
              <label>Souffrez-vous de douleurs articulaires ou inflammations ?</label>
              <div className="radio-group">
                {['Non', 'Occasionnelles', 'Frequentes', 'Quotidiennes'].map(opt => (
                  <label key={opt} className="radio-label">
                    <input type="radio" name="douleursInflammations" value={opt} checked={form.douleursInflammations === opt} onChange={e => updateField('douleursInflammations', e.target.value)} />
                    <span>{opt}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="field full-width">
              <label>Tombez-vous souvent malade ?</label>
              <div className="radio-group">
                {['Rarement', '1-2 fois par an', 'Plusieurs fois par an'].map(opt => (
                  <label key={opt} className="radio-label">
                    <input type="radio" name="frequenceMaladies" value={opt} checked={form.frequenceMaladies === opt} onChange={e => updateField('frequenceMaladies', e.target.value)} />
                    <span>{opt}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="field full-width">
              <label>Avez-vous des troubles de peau (acne, eczema, rosacee) ?</label>
              <div className="radio-group">
                {['Non', 'Oui occasionnel', 'Oui chronique'].map(opt => (
                  <label key={opt} className="radio-label">
                    <input type="radio" name="troublesPeau" value={opt} checked={form.troublesPeau === opt} onChange={e => updateField('troublesPeau', e.target.value)} />
                    <span>{opt}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── ETAPE 9 : Stress & Systeme nerveux ─── */}
      {step === 9 && (
        <div className="nutrition-form-section">
          <h3>Stress & Systeme nerveux</h3>
          <div className="form-grid">
            <div className="field full-width">
              <label>Quel est votre niveau de stress actuel ?</label>
              <div className="stress-slider-container">
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={form.niveauStressActuel || 5}
                  onChange={e => updateField('niveauStressActuel', e.target.value)}
                  className="stress-slider"
                />
                <span className="stress-value">{form.niveauStressActuel || 5}/10</span>
              </div>
            </div>
            <div className="field full-width">
              <label>Avez-vous des difficultes a vous endormir ?</label>
              <div className="radio-group">
                {['Non', 'Occasionnelles', 'Frequentes'].map(opt => (
                  <label key={opt} className="radio-label">
                    <input type="radio" name="difficultesEndormissement" value={opt} checked={form.difficultesEndormissement === opt} onChange={e => updateField('difficultesEndormissement', e.target.value)} />
                    <span>{opt}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="field full-width">
              <label>Vous reveillez-vous la nuit ?</label>
              <div className="radio-group">
                {['Non', '1 fois', 'Plusieurs fois'].map(opt => (
                  <label key={opt} className="radio-label">
                    <input type="radio" name="reveilsNocturnes" value={opt} checked={form.reveilsNocturnes === opt} onChange={e => updateField('reveilsNocturnes', e.target.value)} />
                    <span>{opt}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="field full-width">
              <label>Comment vous sentez-vous au reveil ?</label>
              <div className="radio-group">
                {['En forme', 'Fatigue', 'Epuise'].map(opt => (
                  <label key={opt} className="radio-label">
                    <input type="radio" name="etatReveil" value={opt} checked={form.etatReveil === opt} onChange={e => updateField('etatReveil', e.target.value)} />
                    <span>{opt}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── ETAPE 10 : Mode de vie & Biohacking ─── */}
      {step === 10 && (
        <div className="nutrition-form-section">
          <h3>Mode de vie & Biohacking</h3>
          <div className="form-grid">
            <div className="field full-width">
              <label>Passez-vous du temps a l'exterieur chaque jour (lumiere naturelle) ?</label>
              <div className="radio-group">
                {['Oui', 'Non'].map(opt => (
                  <label key={opt} className="radio-label">
                    <input type="radio" name="tempsExterieur" value={opt} checked={form.tempsExterieur === opt} onChange={e => updateField('tempsExterieur', e.target.value)} />
                    <span>{opt}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="field">
              <label>Heures de sommeil en moyenne</label>
              <input type="number" value={form.heuresSommeil} onChange={e => updateField('heuresSommeil', e.target.value)} placeholder="Ex: 7" min="1" max="16" />
            </div>
            <div className="field full-width">
              <label>Exposition aux ecrans le soir ?</label>
              <div className="radio-group">
                {['Peu', 'Moderement', 'Beaucoup'].map(opt => (
                  <label key={opt} className="radio-label">
                    <input type="radio" name="expositionEcransSoir" value={opt} checked={form.expositionEcransSoir === opt} onChange={e => updateField('expositionEcransSoir', e.target.value)} />
                    <span>{opt}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="field">
              <label>Profession sedentaire ou active ?</label>
              <select value={form.professionType} onChange={e => updateField('professionType', e.target.value)}>
                <option value="">Selectionner</option>
                <option value="Sedentaire">Sedentaire</option>
                <option value="Active">Active</option>
                <option value="Mixte">Mixte</option>
              </select>
            </div>
            <div className="field">
              <label>Consommation d'alcool</label>
              <input type="text" value={form.alcool || ''} onChange={e => updateField('alcool', e.target.value)} placeholder="Ex: 2 verres/semaine, jamais..." />
            </div>
            <div className="field">
              <label>Tabac</label>
              <input type="text" value={form.tabac || ''} onChange={e => updateField('tabac', e.target.value)} placeholder="Ex: non-fumeur, 5 cig/jour..." />
            </div>
          </div>
        </div>
      )}

      {/* ─── ETAPE 11 : Genetique & Donnees ─── */}
      {step === 11 && (
        <div className="nutrition-form-section">
          <h3>Genetique & Donnees</h3>
          <div className="form-grid">
            <div className="field full-width">
              <label>Disposez-vous d'analyses biologiques recentes ?</label>
              <div className="radio-group">
                {['Oui', 'Non'].map(opt => (
                  <label key={opt} className="radio-label">
                    <input type="radio" name="analysesBiologiques" value={opt} checked={form.analysesBiologiques === opt} onChange={e => updateField('analysesBiologiques', e.target.value)} />
                    <span>{opt}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="field full-width">
              <label>Avez-vous deja realise un test ADN (nutrigenetique) ?</label>
              <div className="radio-group">
                {['Oui', 'Non'].map(opt => (
                  <label key={opt} className="radio-label">
                    <input type="radio" name="testADN" value={opt} checked={form.testADN === opt} onChange={e => updateField('testADN', e.target.value)} />
                    <span>{opt}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="field full-width">
              <label>Tests genetiques connus — MTHFR, APOE, DIO2...</label>
              <SmartTextarea value={form.testsGenetiques} onChange={e => updateField('testsGenetiques', e.target.value)} placeholder="Resultats de tests genetiques, polymorphismes identifies..." rows={3} />
            </div>
            <div className="field full-width">
              <label>Etes-vous pret(e) a aller plus loin avec des analyses avancees ?</label>
              <div className="radio-group">
                {['Oui', 'Peut-etre', 'Non'].map(opt => (
                  <label key={opt} className="radio-label">
                    <input type="radio" name="pretAnalysesAvancees" value={opt} checked={form.pretAnalysesAvancees === opt} onChange={e => updateField('pretAnalysesAvancees', e.target.value)} />
                    <span>{opt}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── ETAPE 12 : Objectifs & Engagement ─── */}
      {step === 12 && (
        <div className="nutrition-form-section">
          <h3>Objectifs & Engagement</h3>
          <div className="form-grid">
            <div className="field full-width">
              <label>Quel est votre objectif principal aujourd'hui ?</label>
              <SmartTextarea value={form.objectifPrincipalNutrition} onChange={e => updateField('objectifPrincipalNutrition', e.target.value)} placeholder="Decrivez votre objectif principal..." rows={4} />
            </div>
            <div className="field full-width">
              <label>Depuis combien de temps ce probleme est present ?</label>
              <SmartTextarea value={form.dureeProbleme} onChange={e => updateField('dureeProbleme', e.target.value)} placeholder="Depuis quand ressentez-vous ces symptomes ou ce besoin..." rows={3} />
            </div>
            <div className="field full-width">
              <label>Qu'avez-vous deja essaye ?</label>
              <SmartTextarea value={form.dejaEssaye} onChange={e => updateField('dejaEssaye', e.target.value)} placeholder="Regimes, supplements, consultations precedentes..." rows={3} />
            </div>
            <div className="field full-width">
              <label>Etes-vous pret(e) a suivre un protocole personnalise ?</label>
              <div className="radio-group">
                {['Oui', 'Non', 'Je ne sais pas'].map(opt => (
                  <label key={opt} className="radio-label">
                    <input type="radio" name="pretProtocole" value={opt} checked={form.pretProtocole === opt} onChange={e => updateField('pretProtocole', e.target.value)} />
                    <span>{opt}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── ETAPE 13 : Notes de la nutritionniste ─── */}
      {step === 13 && (
        <div className="nutrition-form-section">
          <h3>Notes de la nutritionniste</h3>
          <div className="form-grid">
            <div className="field full-width">
              <label>Observations generales</label>
              <SmartTextarea value={form.observationsGenerales} onChange={e => updateField('observationsGenerales', e.target.value)} placeholder="Impression generale, points saillants de l'anamnese, axes prioritaires..." rows={6} />
            </div>
            <div className="field full-width">
              <label>Plan d'action immediat</label>
              <SmartTextarea value={form.planAction} onChange={e => updateField('planAction', e.target.value)} placeholder="Premieres recommandations, changements alimentaires urgents, supplements a debuter..." rows={5} />
            </div>
            <div className="field full-width">
              <label>Examens a prevoir</label>
              <SmartTextarea value={form.examensPrevoir} onChange={e => updateField('examensPrevoir', e.target.value)} placeholder="Bilan sanguin, analyse ADN, test microbiote, bilan hormonal..." rows={4} />
            </div>
            <div className="field full-width private-field">
              <label>
                <span className="private-lock">🔒</span> Notes privees
                <span className="private-badge">Visible uniquement par vous</span>
              </label>
              <textarea value={form.privateNotes || ''} onChange={e => updateField('privateNotes', e.target.value)} placeholder="Notes confidentielles — visibles uniquement par Anissa..." rows={4} />
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
          <button className="btn btn-primary" onClick={handleSubmit} disabled={!form.prenom.trim()}>
            {clientId ? 'Sauvegarder' : 'Creer le client'}
          </button>
        )}
      </div>
    </div>
  );
}
