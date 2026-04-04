import { useState, useCallback, useRef } from 'react';
import './App.css';
import {
  STEPS, PRESENTIEL_STEPS, MASSAGE_STEPS,
  INITIAL_FORM, PRESENTIEL_INITIAL_FORM, MASSAGE_INITIAL_FORM,
  FORMULES, CATEGORIES, PRESENTIEL_PACKS,
} from './formSteps';
import StepForm from './StepForm';
import MassageForm from './MassageForm';
import MassageSessionPanel from './MassageSessionPanel';
import ResultCards from './ResultCards';
import Dashboard from './Dashboard';
import HistoryPanel from './HistoryPanel';
import MessageTemplates from './MessageTemplates';
import ClientAlerts from './ClientAlerts';
import ProgressionPanel from './ProgressionPanel';
import { callAnthropic, SECTION_TITLES } from './prompt';
import { getClients, getClient, saveClient, addGeneration, exportAllData, importAllData } from './store';

const LOGO_URL = 'https://cdn.prod.website-files.com/699eb56ec2e8b94e41cfa06c/69a6ccf52a4f1eb605779f33_logo%20benfitocah.png';

function getStepsForCategory(cat) {
  if (cat === 'massage') return MASSAGE_STEPS;
  if (cat === 'presentiel') return PRESENTIEL_STEPS;
  return STEPS;
}

function getInitialFormForCategory(cat) {
  if (cat === 'massage') return MASSAGE_INITIAL_FORM;
  if (cat === 'presentiel') return PRESENTIEL_INITIAL_FORM;
  return INITIAL_FORM;
}

function getStepIcons(cat) {
  const steps = getStepsForCategory(cat);
  return steps.map((_, i) => String(i + 1).padStart(2, '0'));
}

function App() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('bfc_api_key') || '');
  const [page, setPage] = useState('dashboard');
  const [clientId, setClientId] = useState(null);
  const [categorie, setCategorie] = useState('online');
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(INITIAL_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState(null);
  const [clients, setClients] = useState(getClients);
  const [editTab, setEditTab] = useState('form');
  const [, setTick] = useState(0);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [convertMode, setConvertMode] = useState(null); // null | 'online' | 'presentiel'
  const fileInputRef = useRef(null);

  const refreshClients = useCallback(() => setClients(getClients()), []);
  const forceUpdate = useCallback(() => setTick(t => t + 1), []);

  const updateField = useCallback((field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleApiKeyChange = (e) => {
    const key = e.target.value;
    setApiKey(key);
    localStorage.setItem('bfc_api_key', key);
  };

  const openClient = useCallback((id) => {
    const client = getClient(id);
    if (!client) return;
    setClientId(client.id);
    setCategorie(client.categorie || 'online');
    setForm(client.form || getInitialFormForCategory(client.categorie || 'online'));
    setResults(client.latestSections || null);
    setStep(1);
    setError('');
    setEditTab('form');
    setConvertMode(null);
    setPage('edit');
    setMobileMenu(false);
  }, []);

  const newClient = useCallback((cat) => {
    const targetCat = cat || 'online';
    setClientId(null);
    setCategorie(targetCat);
    setForm(getInitialFormForCategory(targetCat));
    setResults(null);
    setStep(1);
    setError('');
    setEditTab('form');
    setConvertMode(null);
    setPage(cat ? 'edit' : 'newCategory');
    setMobileMenu(false);
  }, []);

  const handleSave = useCallback(() => {
    const client = saveClient({
      id: clientId,
      categorie,
      form,
      prenom: form.prenom,
      formule: categorie === 'massage' ? 'massage' : (categorie === 'presentiel' ? 'presentiel' : form.formule),
      langue: form.langue || 'FR',
      latestSections: results,
    });
    setClientId(client.id);
    refreshClients();
    return client;
  }, [clientId, categorie, form, results, refreshClients]);

  const handleGenerate = async () => {
    if (!apiKey.trim()) {
      setError('Entrez votre cle API Anthropic.');
      return;
    }
    const client = handleSave();
    setLoading(true);
    setError('');
    try {
      const sections = await callAnthropic(apiKey.trim(), form);
      setResults(sections);
      addGeneration(client.id, sections);
      refreshClients();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSectionUpdate = useCallback((sectionTitle, content) => {
    setResults(prev => {
      const updated = { ...prev, [sectionTitle]: content };
      if (clientId) {
        const allClients = getClients();
        const client = allClients.find(c => c.id === clientId);
        if (client) {
          client.latestSections = updated;
          client.updatedAt = new Date().toISOString();
          localStorage.setItem('bfc_clients', JSON.stringify(allClients));
        }
      }
      return updated;
    });
  }, [clientId]);

  const openHistory = useCallback((id) => {
    setClientId(id);
    setPage('history');
    setMobileMenu(false);
  }, []);

  const goToDashboard = useCallback(() => {
    refreshClients();
    setPage('dashboard');
    setConvertMode(null);
    setMobileMenu(false);
  }, [refreshClients]);

  const handleExport = () => {
    const data = exportAllData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `benfitcoach-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const count = importAllData(ev.target.result);
        const savedKey = localStorage.getItem('bfc_api_key');
        if (savedKey) setApiKey(savedKey);
        refreshClients();
        alert(`Import reussi : ${count} client(s) restaure(s).`);
      } catch (err) {
        alert(`Erreur d'import : ${err.message}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Convert massage client to coaching
  const handleStartConvert = (targetCat) => {
    const sourceForm = form;
    const targetForm = getInitialFormForCategory(targetCat);

    // Pre-fill known fields from massage anamnese
    const convertedForm = {
      ...targetForm,
      prenom: sourceForm.prenom || '',
      age: sourceForm.age || '',
      genre: sourceForm.genre || '',
      // Map massage health data to coaching health fields
      blessures: [
        sourceForm.zonesDouloureuses?.length ? `Zones douloureuses: ${sourceForm.zonesDouloureuses.join(', ')}` : '',
        sourceForm.typeDouleur ? `Type: ${sourceForm.typeDouleur}` : '',
        sourceForm.intensiteDouleur ? `Intensite: ${sourceForm.intensiteDouleur}/10` : '',
      ].filter(Boolean).join('\n'),
      problemesSante: [
        sourceForm.contreIndications?.length ? `Contre-indications: ${sourceForm.contreIndications.join(', ')}` : '',
        sourceForm.traitementsEnCours ? `Traitements: ${sourceForm.traitementsEnCours}` : '',
        sourceForm.operationsRecentes ? `Operations: ${sourceForm.operationsRecentes}` : '',
      ].filter(Boolean).join('\n'),
      medicaments: sourceForm.medicaments || '',
    };

    setConvertMode(targetCat);
    setCategorie(targetCat);
    setForm(convertedForm);
    setClientId(null); // New client
    setResults(null);
    setStep(1);
    setEditTab('form');
  };

  const currentClient = clientId ? getClient(clientId) : null;
  const currentSteps = getStepsForCategory(categorie);
  const stepIcons = getStepIcons(categorie);
  const totalSteps = currentSteps.length;
  const progressPct = ((step - 1) / (totalSteps - 1)) * 100;
  const isMassage = categorie === 'massage';

  const navButtons = (
    <>
      <button className={`btn-nav ${page === 'dashboard' ? 'btn-nav-active' : ''}`} onClick={goToDashboard}>Dashboard</button>
      <button className={`btn-nav ${page === 'newCategory' ? 'btn-nav-active' : ''}`} onClick={() => newClient()}>+ Nouveau client</button>
      <button className={`btn-nav ${page === 'templates' ? 'btn-nav-active' : ''}`} onClick={() => { setPage('templates'); setMobileMenu(false); }}>Messages</button>
    </>
  );

  return (
    <div className="app">
      {/* Header */}
      <div className="header">
        <img src={LOGO_URL} alt="Benfitcoach" onClick={goToDashboard} />
        <div className="header-text" onClick={goToDashboard}>
          <h1>Benfitcoach</h1>
          <div className="subtitle">Client Onboarding System</div>
        </div>
        <div className="header-nav">{navButtons}</div>
        <div className="header-io">
          <button className="btn-nav" onClick={handleExport} title="Exporter">Export</button>
          <button className="btn-nav" onClick={() => fileInputRef.current?.click()} title="Importer">Import</button>
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} />
        </div>
        <button className="hamburger" onClick={() => setMobileMenu(!mobileMenu)}>
          <span /><span /><span />
        </button>
      </div>

      {/* Mobile menu */}
      <div className={`mobile-menu ${mobileMenu ? 'open' : ''}`}>
        {navButtons}
        <button className="btn-nav" onClick={() => { handleExport(); setMobileMenu(false); }}>Export</button>
        <button className="btn-nav" onClick={() => { fileInputRef.current?.click(); setMobileMenu(false); }}>Import</button>
      </div>

      {/* API Key */}
      <div className="api-key-bar">
        <label>API Key</label>
        <input type="password" value={apiKey} onChange={handleApiKeyChange} placeholder="sk-ant-..." />
      </div>

      {/* Dashboard */}
      {page === 'dashboard' && (
        <Dashboard clients={clients} onOpen={openClient} onNew={newClient} onHistory={openHistory} onRefresh={refreshClients} />
      )}

      {/* Category Selection for new client */}
      {page === 'newCategory' && (
        <div className="category-selector">
          <h2>Nouveau client</h2>
          <p className="category-subtitle">Choisissez le type de service</p>
          <div className="category-cards">
            {Object.entries(CATEGORIES).map(([key, cat]) => (
              <button
                key={key}
                className="category-card"
                onClick={() => newClient(key)}
                style={{ borderColor: cat.color + '44' }}
              >
                <span className="category-card-icon">{cat.icon}</span>
                <span className="category-card-name" style={{ color: cat.color }}>{cat.nom}</span>
                <span className="category-card-desc">
                  {key === 'online' && 'Coaching a distance avec programme et suivi via app'}
                  {key === 'presentiel' && 'Seances en personne avec pack (10/20/30)'}
                  {key === 'massage' && 'Anamnese et suivi massotherapie'}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* History */}
      {page === 'history' && (
        <HistoryPanel clientId={clientId} onBack={() => openClient(clientId)} />
      )}

      {/* Templates */}
      {page === 'templates' && (
        <MessageTemplates onBack={goToDashboard} />
      )}

      {/* Edit / Form */}
      {page === 'edit' && (
        <>
          {convertMode && (
            <div className="convert-banner">
              Conversion depuis Massotherapie vers {CATEGORIES[convertMode].nom}. Les informations connues ont ete pre-remplies.
              <button className="btn btn-xs btn-secondary" onClick={() => { setConvertMode(null); openClient(currentClient?.id); }} style={{ marginLeft: 12 }}>
                Annuler
              </button>
            </div>
          )}

          {clientId && (
            <>
              {!isMassage && <ClientAlerts client={currentClient} />}
              <div className="client-bar">
                <span className="client-bar-name">{form.prenom || 'Client sans nom'}</span>
                <span className="category-badge-bar" style={{
                  color: CATEGORIES[categorie]?.color,
                  background: CATEGORIES[categorie]?.bgColor,
                  borderColor: (CATEGORIES[categorie]?.color || '') + '33',
                }}>
                  {CATEGORIES[categorie]?.icon} {CATEGORIES[categorie]?.nom}
                </span>
                {!isMassage && (
                  <span className="client-bar-formula">
                    {categorie === 'presentiel'
                      ? (PRESENTIEL_PACKS[form.pack]?.nom || 'Pack')
                      : FORMULES[form.formule]?.nom}
                  </span>
                )}
                <button className="btn btn-sm btn-secondary" onClick={handleSave}>Sauvegarder</button>
                {!isMassage && (
                  <button className="btn btn-sm btn-secondary" onClick={() => openHistory(clientId)}>Historique</button>
                )}
              </div>
              <div className="edit-tabs">
                <button className={`edit-tab ${editTab === 'form' ? 'edit-tab-active' : ''}`} onClick={() => setEditTab('form')}>
                  {isMassage ? 'Anamnese' : 'Fiche client'}
                </button>
                {isMassage ? (
                  <button className={`edit-tab ${editTab === 'sessions' ? 'edit-tab-active' : ''}`} onClick={() => setEditTab('sessions')}>
                    Seances
                  </button>
                ) : (
                  <button className={`edit-tab ${editTab === 'progression' ? 'edit-tab-active' : ''}`} onClick={() => setEditTab('progression')}>
                    Progression
                  </button>
                )}
              </div>

              {/* Convert button for massage clients */}
              {isMassage && editTab === 'form' && !convertMode && (
                <div className="convert-section">
                  <span className="convert-label">Convertir en client coaching :</span>
                  <button className="btn btn-sm btn-convert btn-convert-online" onClick={() => handleStartConvert('online')}>
                    🌐 Coaching Online
                  </button>
                  <button className="btn btn-sm btn-convert btn-convert-presentiel" onClick={() => handleStartConvert('presentiel')}>
                    📍 Coaching Presentiel
                  </button>
                </div>
              )}
            </>
          )}

          {/* Massage session tab */}
          {editTab === 'sessions' && clientId && isMassage ? (
            <MassageSessionPanel clientId={clientId} onRefresh={forceUpdate} />
          ) : editTab === 'progression' && clientId && !isMassage ? (
            <ProgressionPanel clientId={clientId} onRefresh={forceUpdate} />
          ) : (
            <>
              {/* Language selector (not for massage) */}
              {!isMassage && (
                <div className="lang-selector">
                  <button
                    className={`lang-btn ${form.langue === 'FR' ? 'lang-btn-active' : ''}`}
                    onClick={() => updateField('langue', 'FR')}
                  >
                    Francais
                  </button>
                  <button
                    className={`lang-btn ${form.langue === 'EN' ? 'lang-btn-active' : ''}`}
                    onClick={() => updateField('langue', 'EN')}
                  >
                    English
                  </button>
                </div>
              )}

              {/* Progress bar steps */}
              <div className="steps-progress">
                <div className="steps-track">
                  <div className="steps-line">
                    <div className="steps-line-fill" style={{ width: `${progressPct}%` }} />
                  </div>
                  {currentSteps.map(s => (
                    <div
                      key={s.id}
                      className={`step-node ${s.id === step ? 'active' : ''} ${s.id < step ? 'completed' : ''}`}
                      onClick={() => setStep(s.id)}
                    >
                      <div className="step-circle">{stepIcons[s.id - 1]}</div>
                      <span className="step-label">{s.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Form */}
              {isMassage ? (
                <MassageForm step={step} form={form} updateField={updateField} />
              ) : (
                <StepForm step={step} form={form} updateField={updateField} categorie={categorie} />
              )}

              <div className="nav-buttons">
                <button className="btn btn-secondary" onClick={() => setStep(Math.max(1, step - 1))} disabled={step === 1}>
                  Precedent
                </button>
                {step < totalSteps && (
                  <button className="btn btn-primary" onClick={() => setStep(step + 1)}>Suivant</button>
                )}
              </div>

              {/* Generate button (not for massage) */}
              {!isMassage && (
                <button
                  className={`btn btn-generate ${loading ? 'loading-pulse' : ''}`}
                  onClick={handleGenerate}
                  disabled={loading}
                >
                  {loading ? 'Generation en cours...' : results ? 'Regenerer le dossier complet' : "Generer le dossier d'onboarding"}
                </button>
              )}

              {/* Save button for massage (replaces generate) */}
              {isMassage && (
                <button
                  className="btn btn-generate"
                  onClick={handleSave}
                  style={{ background: 'linear-gradient(135deg, #4a90d9, #3570b0)' }}
                >
                  Sauvegarder l'anamnese
                </button>
              )}

              {error && <div className="error-msg">{error}</div>}

              {loading && (
                <div className="loading">
                  <div className="loading-spinner" />
                  <p>Claude analyse le profil et genere le dossier...</p>
                </div>
              )}

              {results && !isMassage && (
                <ResultCards sections={results} titles={SECTION_TITLES} apiKey={apiKey} form={form} onSectionUpdate={handleSectionUpdate} />
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

export default App;
