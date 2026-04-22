import { useState, useCallback, useRef, useEffect } from 'react';
import './App.css';
import {
  STEPS, PRESENTIEL_STEPS, MASSAGE_STEPS,
  INITIAL_FORM, PRESENTIEL_INITIAL_FORM, MASSAGE_INITIAL_FORM,
  FORMULES, CATEGORIES, PRESENTIEL_PACKS, NUTRITION_INITIAL_FORM,
} from './formSteps';

function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

function ensureCustomRate(form, categorie) {
  if (form.customRate) return form;
  const key = form.formule || (categorie === 'massage' ? 'massage' : null);
  const montant = key && FORMULES[key]?.montant;
  if (montant) return { ...form, customRate: String(montant) };
  return form;
}
import StepForm from './StepForm';
import BenoitPaymentsPanel from './BenoitPaymentsPanel';
import MassageForm from './MassageForm';
import MassageSessionPanel from './MassageSessionPanel';
import ResultCards from './ResultCards';
import Dashboard from './Dashboard';
import SharedCalendar from './SharedCalendar';
import AnissaDashboard from './AnissaDashboard';
import AnissaClientForm from './AnissaClientForm';
import NutritionConsultation from './NutritionConsultation';
import NutritionHistory from './NutritionHistory';
import HistoryPanel from './HistoryPanel';
import MessageTemplates from './MessageTemplates';
import ClientAlerts from './ClientAlerts';
import ProgressionPanel from './ProgressionPanel';
import BusinessDashboard from './BusinessDashboard';
import AnissaChiffres from './AnissaChiffres';
import SupplementsLibrary from './SupplementsLibrary';
import LoginScreen from './LoginScreen';
import { callAnthropic, SECTION_TITLES } from './prompt';
import { getClients, getClient, saveClient, addGeneration, exportAllData, importAllData, pullFromCloud, retrySyncQueue, getSharedClients, getAnissaOwnClients, getBenoitClients, saveNutritionConsultation, getNutritionConsultations, updateInterviewNotes, updateClientSection, getNotifications, getUnreadNotificationCount, markNotificationRead, markAllNotificationsRead, syncReminderNotifications, purgeExpiredDrafts, getCycleReviews, saveApiKeyToCloud, loadApiKeyFromCloud, syncPackNotifications, syncCompletedStepsFromReviews } from './store';
import { PACK_DEFINITIONS, updateStepStatus, canSendPackReview } from './services/packSystem';
import { buildReturnDiagnostic } from './services/returnDiagnostic';
import { adaptPlanForReturn } from './services/aiPlanOptimizer';
import { listSharedEvents, buildAgendaAlerts } from './services/sharedEvents';
import { supabase, isCloudEnabled } from './supabaseClient';
import ReminderPanel, { getReminderCount } from './ReminderPanel';
import { getT } from './translations';
import InterviewPanel from './InterviewPanel';
import { applyInterviewNotesToForm } from './interviewTemplates';
import QuestionnaireClient from './QuestionnaireClient';
import AnamneseClientEn from './AnamneseClientEn';
import CycleReviewForm from './CycleReviewForm';
import Decouverte from './Decouverte';

// Per-category short-label key map for the step navigator in the form header.
const STEP_LABEL_KEYS = {
  online: {
    1: 'steplabel.identite', 2: 'steplabel.objectifs', 3: 'steplabel.sport', 4: 'steplabel.sante',
    5: 'steplabel.nutrition', 6: 'steplabel.lifestyle', 7: 'steplabel.contexte', 8: 'steplabel.mesNotes',
  },
  presentiel: {
    1: 'steplabel.identite', 2: 'steplabel.objectifs', 3: 'steplabel.sport', 4: 'steplabel.sante',
    5: 'steplabel.nutrition', 6: 'steplabel.lifestyle', 7: 'steplabel.mesNotes',
  },
};

const LOGO_URL = 'https://cdn.prod.website-files.com/699eb56ec2e8b94e41cfa06c/69a6ccf52a4f1eb605779f33_logo%20benfitocah.png';
const ANISSA_LOGO = 'https://cdn.prod.website-files.com/699eb56ec2e8b94e41cfa06c/69d411dfafbbe967e3d992c4_Design_sans_titre_1_-removebg-preview.png';

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

// Toast component
function Toast({ message, visible }) {
  if (!visible) return null;
  return (
    <div className="toast-notification">
      {message}
    </div>
  );
}

// Version badge — discret en bas a droite, utile pour verifier le cache
// Pour bumper : changer uniquement APP_VERSION ci-dessous avant chaque deploy.
const APP_VERSION = 'V88.3';
const BUILD_AT = new Date().toISOString().slice(0, 16).replace('T', ' ');
function VersionBadge() {
  return (
    <div
      title={`Build ${BUILD_AT} UTC`}
      style={{
        position: 'fixed',
        bottom: 6,
        right: 8,
        zIndex: 9999,
        fontSize: 10,
        fontFamily: 'ui-monospace, monospace',
        color: 'rgba(196,160,80,.35)',
        background: 'rgba(0,0,0,.25)',
        padding: '2px 6px',
        borderRadius: 4,
        letterSpacing: '.5px',
        pointerEvents: 'auto',
        userSelect: 'none',
      }}
    >
      {APP_VERSION}
    </div>
  );
}

// Public questionnaire route — no auth required
function getQuestionnaireClientId() {
  const match = window.location.pathname.match(/^\/questionnaire\/([a-f0-9-]+)$/i);
  return match ? match[1] : null;
}

// V86.2 : Public anamnese EN route — no auth required
// Utilisee pour les clientes Benfitcoach EN (suivi/intensif + langue EN)
// qui recoivent l'anamnese complete directement, sans pre-questionnaire FR.
function getAnamneseEnClientId() {
  const match = window.location.pathname.match(/^\/anamnese\/([a-f0-9-]+)$/i);
  return match ? match[1] : null;
}

// Public cycle review route — no auth required
function getCycleReviewToken() {
  const match = window.location.pathname.match(/^\/review\/([a-f0-9-]+)$/i);
  return match ? match[1] : null;
}

function App() {
  // Public routes — no auth required
  const cycleReviewToken = getCycleReviewToken();
  if (cycleReviewToken) {
    return <CycleReviewForm token={cycleReviewToken} />;
  }
  const questionnaireClientId = getQuestionnaireClientId();
  if (questionnaireClientId) {
    return <QuestionnaireClient clientId={questionnaireClientId} />;
  }
  // V86.4 : route publique /anamnese/:id -> AnamneseClientEn (8 steps EN)
  const anamneseEnClientId = getAnamneseEnClientId();
  if (anamneseEnClientId) {
    return <AnamneseClientEn clientId={anamneseEnClientId} />;
  }
  if (window.location.pathname === '/decouverte') {
    return <Decouverte />;
  }

  // Auth state
  const [authenticated, setAuthenticated] = useState(() => {
    if (!isCloudEnabled) return true;
    return sessionStorage.getItem('bfc_auth') === 'true';
  });
  const [currentUser, setCurrentUser] = useState(() => {
    return sessionStorage.getItem('bfc_user') || 'Benoit';
  });
  const [cloudSynced, setCloudSynced] = useState(false);
  const [syncStatus, setSyncStatus] = useState('');

  const [apiKey, setApiKey] = useState(() => localStorage.getItem('bfc_api_key') || '');
  const [page, setPage] = useState('dashboard');
  const [clientId, setClientId] = useState(null);
  const [categorie, setCategorie] = useState('online');
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(INITIAL_FORM);
  const [originalForm, setOriginalForm] = useState(INITIAL_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState(null);
  const [clients, setClients] = useState(getClients);
  const [editTab, setEditTab] = useState('form');
  const [, setTick] = useState(0);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [convertMode, setConvertMode] = useState(null);
  const [editingConsultation, setEditingConsultation] = useState(null);
  const [toast, setToast] = useState({ message: '', visible: false });
  const [showReminders, setShowReminders] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notifCount, setNotifCount] = useState(0);
  // V39 : événements agenda partagés (pour alimenter les rappels cloche côté Anissa)
  const [agendaEvents, setAgendaEvents] = useState([]);

  // Load notifications from Supabase + sync local reminders
  const loadNotifications = async () => {
    // Sync local reminder notifications
    if (currentUser === 'Anissa') {
      const anissaClients = [...getSharedClients(), ...getAnissaOwnClients()];
      syncReminderNotifications(anissaClients);
      syncCompletedStepsFromReviews().then(() => {
        syncPackNotifications(anissaClients);
      });
    }

    // Fetch from Supabase
    if (isCloudEnabled) {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(30);
      if (!error && data) {
        // Merge Supabase notifications with local reminders
        const localReminders = getNotifications().filter(n => n.type === 'consultation_reminder');
        const merged = [...data.map(n => ({
          id: n.id,
          type: n.type,
          clientId: n.client_id,
          clientName: n.client_name,
          message: n.message,
          date: n.created_at,
          read: n.read,
        })), ...localReminders].sort((a, b) => new Date(b.date) - new Date(a.date));
        const newCount = merged.filter(n => !n.read).length;
        setNotifCount(prev => prev === newCount ? prev : newCount);
        setNotifications(merged);
        return;
      }
    }

    // Fallback: local only
    const local = getNotifications();
    setNotifications(local);
    setNotifCount(local.filter(n => !n.read).length);
  };

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 10000);
    return () => clearInterval(interval);
  }, [currentUser]);

  // V39 : charge les événements agenda des 2 prochains jours pour alimenter les rappels Anissa
  useEffect(() => {
    if (currentUser !== 'Anissa') return; // côté Benoit, Dashboard gère déjà
    const load = async () => {
      const from = new Date();
      const to = new Date(); to.setDate(to.getDate() + 2);
      try {
        const { data } = await listSharedEvents(from.toISOString(), to.toISOString());
        setAgendaEvents(data || []);
      } catch {
        setAgendaEvents([]);
      }
    };
    load();
    const iv = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(iv);
  }, [currentUser]);
  const [interviewOpen, setInterviewOpen] = useState(false);
  const [interviewNotes, setInterviewNotes] = useState(null);
  const interviewSaveTimer = useRef(null);
  const fileInputRef = useRef(null);

  const isAnissa = currentUser === 'Anissa';
  const isBenoit = currentUser === 'Benoit';

  const refreshClients = useCallback(() => setClients(getClients()), []);
  const forceUpdate = useCallback(() => setTick(t => t + 1), []);

  const showToast = useCallback((message) => {
    setToast({ message, visible: true });
    setTimeout(() => setToast({ message: '', visible: false }), 3000);
  }, []);

  // Purge expired drafts on boot (covers !isCloudEnabled case)
  useEffect(() => {
    if (authenticated) purgeExpiredDrafts();
  }, [authenticated]);

  // Load API key from cloud on login if localStorage is empty
  useEffect(() => {
    if (!authenticated || !isCloudEnabled) return;
    if (apiKey) return;
    loadApiKeyFromCloud().then(key => {
      if (key) {
        setApiKey(key);
        localStorage.setItem('bfc_api_key', key);
      }
    });
  }, [authenticated]);

  // Cloud sync on login
  useEffect(() => {
    if (!authenticated || !isCloudEnabled) return;
    purgeExpiredDrafts();
    // Toujours rejouer la queue au démarrage, indépendamment de cloudSynced
    retrySyncQueue();
    if (cloudSynced) return;
    setSyncStatus('syncing');
    pullFromCloud().then(result => {
      setCloudSynced(true);
      if (result.synced) {
        setSyncStatus('synced');
        refreshClients();
      } else {
        setSyncStatus('offline');
      }
      setTimeout(() => setSyncStatus(''), 4000);
    });
  }, [authenticated, cloudSynced, refreshClients]);

  // Retry sync queue when coming back online
  useEffect(() => {
    if (!isCloudEnabled) return;
    const handleOnline = () => {
      retrySyncQueue();
      setSyncStatus('synced');
      setTimeout(() => setSyncStatus(''), 3000);
    };
    const handleOffline = () => setSyncStatus('offline');
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleLogin = useCallback((username) => {
    setCurrentUser(username);
    setAuthenticated(true);
    refreshClients();
  }, [refreshClients]);

  // Show login screen if cloud is enabled and not authenticated
  if (!authenticated) {
    return (
      <>
        <LoginScreen onLogin={handleLogin} />
        <VersionBadge />
      </>
    );
  }

  const updateField = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleApiKeyChange = (e) => {
    const key = e.target.value;
    setApiKey(key);
    localStorage.setItem('bfc_api_key', key);
    if (key.trim()) saveApiKeyToCloud(key.trim());
  };

  const openClient = (id) => {
    const client = getClient(id);
    if (!client) return;
    setClientId(client.id);
    setCategorie(client.categorie || 'online');
    const cat = client.categorie || 'online';
    const loaded = ensureCustomRate(client.form || getInitialFormForCategory(cat), cat);
    setForm(loaded);
    setOriginalForm(loaded);
    setResults(client.latestSections || null);
    setInterviewNotes(client.interviewNotes || null);
    setInterviewOpen(false);
    setStep(1);
    setError('');
    setEditTab('form');
    setConvertMode(null);
    setPage('edit');
    setMobileMenu(false);
  };

  const newClient = (cat) => {
    const targetCat = cat || 'online';
    setClientId(null);
    setCategorie(targetCat);
    const fresh = ensureCustomRate(getInitialFormForCategory(targetCat), targetCat);
    setForm(fresh);
    setOriginalForm(fresh);
    setResults(null);
    setInterviewNotes(null);
    setInterviewOpen(false);
    setStep(1);
    setError('');
    setEditTab('form');
    setConvertMode(null);
    setPage(cat ? 'edit' : 'newCategory');
    setMobileMenu(false);
  };

  const handleSave = () => {
    // V16 : pack custom — normaliser le label "Sur mesure" au save
    const normalizedForm = (categorie === 'presentiel' && form?.pack === 'custom')
      ? { ...form, benoitPackLabel: (form.benoitPackLabel || '').trim() || 'Sur mesure' }
      : form;
    const client = saveClient({
      id: clientId,
      categorie,
      form: normalizedForm,
      prenom: form.prenom,
      formule: categorie === 'massage' ? 'massage' : (categorie === 'presentiel' ? 'presentiel' : form.formule),
      langue: form.langue || 'FR',
      latestSections: results,
    });
    setClientId(client.id);
    refreshClients();
    showToast('Client sauvegarde avec succes');
    setTimeout(() => goToDashboard(), 2000);
    return client;
  };

  const handleSaveNoRedirect = () => {
    // V16 : pack custom — normaliser le label "Sur mesure" au save
    const normalizedForm = (categorie === 'presentiel' && form?.pack === 'custom')
      ? { ...form, benoitPackLabel: (form.benoitPackLabel || '').trim() || 'Sur mesure' }
      : form;
    const client = saveClient({
      id: clientId,
      categorie,
      form: normalizedForm,
      prenom: form.prenom,
      formule: categorie === 'massage' ? 'massage' : (categorie === 'presentiel' ? 'presentiel' : form.formule),
      langue: form.langue || 'FR',
      latestSections: results,
    });
    setClientId(client.id);
    refreshClients();
    return client;
  };

  const handleGenerate = async () => {
    if (!apiKey.trim()) {
      setError('Entrez votre cle API Anthropic.');
      return;
    }
    const client = handleSaveNoRedirect();
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

  const handleSectionUpdate = (sectionTitle, content) => {
    setResults(prev => {
      const updated = { ...prev, [sectionTitle]: content };
      if (clientId) {
        updateClientSection(clientId, sectionTitle, content);
      }
      return updated;
    });
  };

  const openHistory = (id) => {
    setClientId(id);
    setPage('history');
    setMobileMenu(false);
  };

  const goToDashboard = () => {
    refreshClients();
    setPage('dashboard');
    setConvertMode(null);
    setMobileMenu(false);
  };

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

  const handleStartConvert = (targetCat) => {
    const sourceForm = form;
    const targetForm = getInitialFormForCategory(targetCat);
    const convertedForm = {
      ...targetForm,
      prenom: sourceForm.prenom || '',
      age: sourceForm.age || '',
      genre: sourceForm.genre || '',
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
    setClientId(null);
    setResults(null);
    setStep(1);
    setEditTab('form');
  };

  const handleLogout = () => {
    sessionStorage.removeItem('bfc_auth');
    sessionStorage.removeItem('bfc_user');
    setAuthenticated(false);
    setCloudSynced(false);
  };

  // Anissa: nutrition consultation handlers
  const handleStartConsultation = (id) => {
    setClientId(id);
    setEditingConsultation(null);
    setPage('nutritionConsultation');
    setMobileMenu(false);
  };

  const handleSaveConsultation = (consultation) => {
    saveNutritionConsultation(consultation);
    // Règle : confirmer packStartedAt à la première consultation sauvegardée
    // d'un pack suivi (flag packStartedAtConfirmed garantit idempotence)
    const savedClientId = consultation.clientId;
    if (savedClientId) {
      const freshClient = getClient(savedClientId);
      if (
        freshClient?.packType?.startsWith('suivi') &&
        freshClient.packStartedAtConfirmed !== true
      ) {
        saveClient({
          ...freshClient,
          packStartedAt: new Date().toISOString(),
          packStartedAtConfirmed: true,
        });
      }
    }
    showToast('Consultation sauvegardee avec succes');
    // V85.3 : plus de redirection auto vers dashboard — l'utilisateur reste sur la page
    // pour continuer ses modifications. Il ferme manuellement via le bouton Fermer.
  };

  const handleViewNutritionHistory = (id) => {
    setClientId(id);
    setPage('nutritionHistory');
    setMobileMenu(false);
  };

  const handleEditConsultation = (consultation) => {
    setEditingConsultation(consultation);
    setClientId(consultation.clientId);
    setPage('nutritionConsultation');
    setMobileMenu(false);
  };

  const currentClient = clientId ? getClient(clientId) : null;
  const currentSteps = getStepsForCategory(categorie);
  const stepIcons = getStepIcons(categorie);
  const totalSteps = currentSteps.length;
  const progressPct = ((step - 1) / (totalSteps - 1)) * 100;
  const isMassage = categorie === 'massage';

  // Get shared clients for Anissa or nutrition notes for Benoit
  const sharedClients = getSharedClients();
  const anissaOwnClients = getAnissaOwnClients();

  // Anissa: create new client
  const handleAnissaNewClient = () => {
    setPage('anissaNewClient');
    setMobileMenu(false);
  };

  const handleAnissaSaveClient = (formData) => {
    const client = saveClient({
      categorie: 'nutrition',
      form: formData,
      prenom: formData.prenom,
      formule: 'nutrition',
      langue: 'FR',
      createdBy: 'anissa',
      packType: formData.packType || 'oneshot_180',
      packStartedAt: new Date().toISOString(),
      packStartedAtConfirmed: false,
      packSchedule: [],
    });
    refreshClients();
    showToast('Client cree avec succes');
    setTimeout(() => goToDashboard(), 2000);
  };

  // Anissa: open own client for editing
  const handleAnissaOpenClient = (id) => {
    const client = getClient(id);
    if (!client) return;
    setClientId(client.id);
    setForm(client.form || {});
    setPage('anissaEditClient');
    setMobileMenu(false);
  };

  const handleAdaptPlan = (client, adaptedPlan) => {
    const consultations = getNutritionConsultations(client.id);
    const lastConsultation = consultations[0] || null;
    const weekLabel = `Adaptation bilan 4 semaines`;
    const prefilledConsultation = lastConsultation
      ? {
          ...lastConsultation,
          id: undefined,
          nutritionPlan: adaptedPlan,
          createdAt: new Date().toISOString(),
          status: 'a_valider',
          label: weekLabel,
          consultantName: 'Anissa',
        }
      : {
          clientId: client.id,
          nutritionPlan: adaptedPlan,
          createdAt: new Date().toISOString(),
          status: 'a_valider',
          label: weekLabel,
          consultantName: 'Anissa',
        };
    setClientId(client.id);
    setEditingConsultation(prefilledConsultation);
    setPage('nutritionConsultation');
    setMobileMenu(false);
    showToast('Plan adapté — vérifiez et sauvegardez');
  };

  const handleReturnPlan = async (client) => {
    showToast('Génération du plan de reprise...');
    try {
      const cycleReviews = await getCycleReviews(client.id);
      const diagnostic = buildReturnDiagnostic(client, cycleReviews);
      const consultations = getNutritionConsultations(client.id);
      const lastPlan = consultations[0]?.nutritionPlan || '';
      const adaptedPlan = await adaptPlanForReturn(
        client.form || {},
        lastPlan,
        diagnostic
      );
      if (!adaptedPlan) {
        showToast('Erreur lors de la génération — réessayez');
        return;
      }
      const labelMap = {
        simplify:    'Reprise — Simplification',
        recalibrate: 'Reprise — Recalibrage',
        stabilize:   'Reprise — Stabilisation',
        metabolic:   'Reprise — Ajustement métabolique',
        standard:    'Plan de reprise',
      };
      const prefilledConsultation = {
        clientId: client.id,
        nutritionPlan: adaptedPlan,
        createdAt: new Date().toISOString(),
        status: 'a_valider',
        label: labelMap[diagnostic.returnProfile] || 'Plan de reprise',
        consultantName: 'Anissa',
      };
      setClientId(client.id);
      setEditingConsultation(prefilledConsultation);
      setPage('nutritionConsultation');
      setMobileMenu(false);
      showToast('Plan de reprise généré — vérifiez et sauvegardez');
    } catch (err) {
      showToast('Erreur lors de la génération — réessayez');
      console.error('[RETURN PLAN]', err);
    }
  };

  const handleSendPackReview = async (client, step) => {
    // Protection : vérification finale avant envoi
    if (!canSendPackReview(step)) return;
    // Protection : vérifier que l'étape n'est pas déjà 'sent' ou 'done'
    const currentSchedule = client.packSchedule || [];
    const existingStep = currentSchedule.find(s => s.stepNumber === step.stepNumber);
    if (existingStep?.status === 'sent' || existingStep?.status === 'done') {
      showToast('Ce questionnaire a déjà été envoyé');
      return;
    }

    try {
      const token = generateId();
      const reviewId = generateId();
      let ownerId = null;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        ownerId = user?.id || null;
      } catch {}
      const review = {
        id: reviewId,
        token,
        client_id: client.id,
        consultation_id: null,
        owner_id: ownerId,
        status: 'sent',
        step_number: step.stepNumber,
        template_type: step.template || 'adherence',
        created_at: new Date().toISOString(),
      };
      if (isCloudEnabled) {
        const { error } = await supabase.from('cycle_reviews').insert(review);
        if (error) throw error;
      }
      // Relire le client courant pour éviter un overwrite stale
      const freshClient = getClient(client.id);
      const updatedSchedule = updateStepStatus(
        freshClient || client,
        step.stepNumber,
        {
          status: 'sent',
          reviewId,
          notifiedAt: new Date().toISOString(),
        }
      );
      saveClient({
        ...(freshClient || client),
        packSchedule: updatedSchedule,
      });
      refreshClients();
      const link = `${window.location.origin}/review/${token}`;
      try { await navigator.clipboard.writeText(link); } catch {}
      showToast(`Lien copié — ${step.label}`);
    } catch (err) {
      showToast('Erreur lors de la création du questionnaire — réessayez');
    }
  };

  // ─── ANISSA'S INTERFACE ───
  if (isAnissa) {
    const allAnissaClients = [...sharedClients, ...anissaOwnClients];
    const reminderCount = getReminderCount(allAnissaClients);

    const anissaNavButtons = (
      <>
        <button className={`btn-nav ${page === 'dashboard' ? 'btn-nav-active' : ''}`} onClick={goToDashboard}>Dashboard</button>
        <button className={`btn-nav ${page === 'anissaNewClient' ? 'btn-nav-active' : ''}`} onClick={handleAnissaNewClient}>+ Nouveau client</button>
        <button className={`btn-nav ${page === 'sharedCalendar' ? 'btn-nav-active' : ''}`} onClick={() => { setPage('sharedCalendar'); setMobileMenu(false); }}>📅 Agenda</button>
        <button className={`btn-nav ${page === 'anissaChiffres' ? 'btn-nav-active' : ''}`} onClick={() => { setPage('anissaChiffres'); setMobileMenu(false); }}>Chiffres</button>
        <button className={`btn-nav ${page === 'anissaSupplements' ? 'btn-nav-active' : ''}`} onClick={() => { setPage('anissaSupplements'); setMobileMenu(false); }}>Complements</button>
      </>
    );

    return (
      <div className={`app anissa-theme${page === 'nutritionConsultation' ? ' app-wide' : ''}`}>
        <Toast message={toast.message} visible={toast.visible} />
        <VersionBadge />

        {/* Header */}
        <div className="header anissa-header">
          <img src={ANISSA_LOGO} alt="Anissa Nutrition" onClick={goToDashboard} className="anissa-header-logo" />
          <div className="header-text" onClick={goToDashboard}>
            <h1>Espace Nutrition</h1>
            <div className="subtitle">AB Coaching Sarl</div>
          </div>
          <div className="header-nav">{anissaNavButtons}</div>
          <div className="header-io">
            {/* Unified notifications bell */}
            <div className="reminder-bell-wrapper" style={{ position: 'relative' }}>
              <button className="reminder-bell" onClick={() => setShowNotifications(prev => !prev)} title="Notifications">
                &#128276;
                {(() => {
                  const agendaCount = buildAgendaAlerts(agendaEvents).length;
                  const total = (notifCount || 0) + agendaCount;
                  return total > 0 ? <span className="reminder-badge" style={{ background: '#f87171' }}>{total}</span> : null;
                })()}
              </button>
              {showNotifications && (() => {
                const notifs = notifications.slice(0, 20);
                const TAG_STYLES = {
                  questionnaire_completed: { label: 'Questionnaire', color: '#4ade80' },
                  consultation_reminder: { label: 'Rappel', color: '#fbbf24' },
                };
                return (
                  <div style={{ position: 'absolute', top: '100%', right: 0, width: 360, background: '#1e1e1e', border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,.4)', zIndex: 1000, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
                      <span style={{ fontSize: '.82rem', fontWeight: 700, color: '#f0f0e8' }}>Notifications</span>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {notifCount > 0 && (
                          <button onClick={async () => { markAllNotificationsRead(); if (isCloudEnabled) await supabase.from('notifications').update({ read: true }).eq('read', false); loadNotifications(); }} style={{ background: 'none', border: 'none', color: '#4ade80', fontSize: '.72rem', cursor: 'pointer' }}>Tout marquer lu</button>
                        )}
                        <button onClick={() => { setShowNotifications(false); setShowReminders(true); }} style={{ background: 'none', border: 'none', color: '#8a8a7a', fontSize: '.72rem', cursor: 'pointer' }}>Gerer rappels</button>
                      </div>
                    </div>
                    <div style={{ maxHeight: 380, overflowY: 'auto' }}>
                      {/* V39 : rappels agenda (injectés en haut, tag bleu, clic → ouvre l'agenda partagé) */}
                      {(() => {
                        const agenda = buildAgendaAlerts(agendaEvents);
                        if (agenda.length === 0) return null;
                        return agenda.map((a, idx) => (
                          <div
                            key={`agenda-${a.type}-${idx}`}
                            onClick={() => { setShowNotifications(false); setPage('sharedCalendar'); setMobileMenu(false); }}
                            style={{
                              padding: '10px 14px',
                              borderBottom: '1px solid rgba(255,255,255,.05)',
                              cursor: 'pointer',
                              background: 'rgba(106,182,240,.06)',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{
                                fontSize: '.65rem', fontWeight: 600, color: '#6ab6f0',
                                background: 'rgba(106,182,240,.18)', padding: '1px 6px',
                                borderRadius: 4, flexShrink: 0,
                              }}>Agenda</span>
                              <span style={{ fontSize: '.8rem', color: '#f0f0e8', fontWeight: 600 }}>{a.message}</span>
                            </div>
                          </div>
                        ));
                      })()}
                      {notifs.length === 0 && buildAgendaAlerts(agendaEvents).length === 0 ? (
                        <div style={{ padding: 20, textAlign: 'center', color: '#8a8a7a', fontSize: '.8rem' }}>Aucune notification</div>
                      ) : notifs.map(n => {
                        const tag = TAG_STYLES[n.type] || { label: 'Info', color: '#8a8a7a' };
                        return (
                          <div
                            key={n.id}
                            onClick={async () => {
                              markNotificationRead(n.id);
                              if (isCloudEnabled && n.type !== 'consultation_reminder') {
                                await supabase.from('notifications').update({ read: true }).eq('id', n.id);
                              }
                              loadNotifications();
                              setShowNotifications(false);
                              if (n.type === 'consultation_reminder' && n.clientId) {
                                handleStartConsultation(n.clientId);
                              } else if (n.clientId) {
                                const cl = getClient(n.clientId);
                                if (cl?.createdBy === 'anissa') handleAnissaOpenClient(n.clientId);
                                else handleStartConsultation(n.clientId);
                              }
                            }}
                            style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,.05)', cursor: 'pointer', background: n.read ? 'transparent' : 'rgba(74,222,128,.06)' }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: '.65rem', fontWeight: 600, color: tag.color, background: tag.color + '18', padding: '1px 6px', borderRadius: 4, flexShrink: 0 }}>{tag.label}</span>
                              <span style={{ fontSize: '.8rem', color: n.read ? '#8a8a7a' : '#f0f0e8', fontWeight: n.read ? 400 : 600 }}>{n.message}</span>
                            </div>
                            <div style={{ fontSize: '.68rem', color: '#6b5f48', marginTop: 3, paddingLeft: 2 }}>{new Date(n.date).toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
            <span className="user-badge anissa-user-badge">Connecte : Anissa</span>
            {isCloudEnabled && syncStatus && (
              <span className={`sync-badge sync-${syncStatus}`}>
                {syncStatus === 'syncing' && 'Sync...'}
                {syncStatus === 'synced' && 'Synced'}
                {syncStatus === 'offline' && 'Offline'}
              </span>
            )}
            <button className="btn-nav" onClick={handleLogout}>Deconnexion</button>
          </div>
          <button className="hamburger" onClick={() => setMobileMenu(!mobileMenu)}>
            <span /><span /><span />
          </button>
        </div>

        {/* Reminder panel */}
        {showReminders && (
          <ReminderPanel
            clients={allAnissaClients}
            onClose={() => setShowReminders(false)}
            onConsultation={handleStartConsultation}
            onOpenClient={(id) => {
              const client = getClient(id);
              if (client?.createdBy === 'anissa') handleAnissaOpenClient(id);
              else handleViewNutritionHistory(id);
            }}
          />
        )}

        {/* Mobile menu */}
        <div className={`mobile-menu ${mobileMenu ? 'open' : ''}`}>
          {anissaNavButtons}
          <span className="user-badge anissa-user-badge" style={{ padding: '10px 16px' }}>Connecte : Anissa</span>
          <button className="btn-nav" onClick={() => { handleLogout(); setMobileMenu(false); }}>Deconnexion</button>
        </div>

        {/* API Key — dev uniquement, en prod la cle est cote serveur (ANTHROPIC_API_KEY) */}
        {import.meta.env.DEV && (
          <div className="api-key-bar anissa-api-key-bar">
            <label>API Key</label>
            <input type="password" value={apiKey} onChange={handleApiKeyChange} placeholder="sk-ant-..." />
          </div>
        )}

        {/* Dashboard */}
        {page === 'dashboard' && (
          <AnissaDashboard
            sharedClients={sharedClients}
            ownClients={anissaOwnClients}
            onConsultation={handleStartConsultation}
            onViewHistory={handleViewNutritionHistory}
            onNewClient={handleAnissaNewClient}
            onOpenClient={handleAnissaOpenClient}
            onRefresh={refreshClients}
            onAdaptPlan={handleAdaptPlan}
            onReturnPlan={handleReturnPlan}
            onSendPackReview={handleSendPackReview}
          />
        )}

        {/* New client form */}
        {page === 'anissaNewClient' && (
          <AnissaClientForm
            onSave={handleAnissaSaveClient}
            onSaveQuick={(formData, packType) => {
              const client = saveClient({
                categorie: 'nutrition',
                form: formData,
                prenom: formData.prenom,
                formule: 'nutrition',
                langue: 'FR',
                createdBy: 'anissa',
                status: 'questionnaire_envoye',
                packType: packType || 'oneshot_180',
                packStartedAt: new Date().toISOString(),
                packStartedAtConfirmed: false,
                packSchedule: [],
              });
              refreshClients();
              // Open Gmail with questionnaire link
              const url = `${window.location.origin}/questionnaire/${client.id}`;
              const prenom = formData.prenom || '';
              const subject = 'Votre questionnaire pre-consultation — Anissa Deroubaix';
              const body =
                `Bonjour ${prenom},\n\n` +
                `Avant notre consultation, merci de remplir ce court questionnaire (5 minutes) :\n\n` +
                `➜ ${url}\n\n` +
                `Ce questionnaire est strictement confidentiel.`;
              const gmailUrl = `https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(formData.email || '')}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
              window.open(gmailUrl, '_blank');
              showToast('Client cree — questionnaire pret a envoyer');
              setTimeout(() => goToDashboard(), 1500);
            }}
            onCancel={goToDashboard}
          />
        )}

        {/* Edit own client OR shared Benoit client (anamnese update)
            V86.5 : on preserve les metadonnees existantes (categorie/formule/langue/
            createdBy/packType/...) pour eviter d'ecraser une cliente partagee Benoit
            (pack20/pack30/suivi/intensif + langue EN) quand Anissa modifie l'anamnese. */}
        {page === 'anissaEditClient' && clientId && (
          <AnissaClientForm
            initialForm={getClient(clientId)?.form}
            clientId={clientId}
            onSave={(formData) => {
              const existing = getClient(clientId) || {};
              saveClient({
                // Spread existing first so metadata is preserved
                ...existing,
                // Then override only the fields Anissa can edit
                id: clientId,
                form: formData,
                prenom: formData.prenom || existing.prenom,
                // Ensure categorie stays set (fallback for legacy Anissa clients)
                categorie: existing.categorie || 'nutrition',
                // Keep existing formule/langue/createdBy/packType/packStartedAt/packSchedule
                // untouched (fallback to nutrition/FR/anissa only if totally absent).
                formule: existing.formule || 'nutrition',
                langue: existing.langue || 'FR',
                createdBy: existing.createdBy || 'anissa',
              });
              refreshClients();
              showToast('Client sauvegarde avec succes');
              setTimeout(() => goToDashboard(), 2000);
            }}
            onCancel={goToDashboard}
          />
        )}

        {/* Nutrition Consultation */}
        {page === 'nutritionConsultation' && (
          <NutritionConsultation
            clientId={clientId}
            apiKey={apiKey}
            onSave={handleSaveConsultation}
            onCancel={goToDashboard}
            initialConsultation={editingConsultation}
          />
        )}

        {/* Nutrition History */}
        {page === 'nutritionHistory' && (
          <NutritionHistory
            clientId={clientId}
            onBack={goToDashboard}
            isAnissa={true}
            onEditConsultation={handleEditConsultation}
          />
        )}

        {/* Chiffres Anissa */}
        {page === 'anissaChiffres' && (
          <AnissaChiffres />
        )}

        {/* V31 : Agenda partagé (côté Anissa) */}
        {page === 'sharedCalendar' && (
          <SharedCalendar
            currentUser="anissa"
            onBack={goToDashboard}
            onOpenClient={handleAnissaOpenClient}
          />
        )}

        {/* Bibliotheque Complements */}
        {page === 'anissaSupplements' && (
          <SupplementsLibrary />
        )}
      </div>
    );
  }

  // ─── BENOIT'S INTERFACE (unchanged behavior) ───

  const navButtons = (
    <>
      <button className={`btn-nav ${page === 'dashboard' ? 'btn-nav-active' : ''}`} onClick={goToDashboard}>Dashboard</button>
      <button className={`btn-nav ${page === 'newCategory' ? 'btn-nav-active' : ''}`} onClick={() => newClient()}>+ Nouveau client</button>
      <button className={`btn-nav ${page === 'sharedCalendar' ? 'btn-nav-active' : ''}`} onClick={() => { setPage('sharedCalendar'); setMobileMenu(false); }}>📅 Agenda</button>
      <button className={`btn-nav ${page === 'templates' ? 'btn-nav-active' : ''}`} onClick={() => { setPage('templates'); setMobileMenu(false); }}>Messages</button>
      <button className={`btn-nav ${page === 'business' ? 'btn-nav-active' : ''}`} onClick={() => { setPage('business'); setMobileMenu(false); }}>Chiffres</button>
    </>
  );

  // Check if current client is shared (has nutrition notes)
  const isSharedClient = currentClient && (currentClient.formule === 'suivi' || currentClient.formule === 'intensif');
  const clientNutritionNotes = isSharedClient && clientId ? getNutritionConsultations(clientId) : [];

  return (
    <div className="app">
      <Toast message={toast.message} visible={toast.visible} />

      {/* Header */}
      <div className="header">
        <img src={LOGO_URL} alt="Benfitcoach" onClick={goToDashboard} />
        <div className="header-text" onClick={goToDashboard}>
          <h1>Benfitcoach</h1>
          <div className="subtitle">AB Coaching Sarl — Onboarding System</div>
        </div>
        <div className="header-nav">{navButtons}</div>
        <div className="header-io">
          <span className="user-badge benoit-user-badge">Connecte : Benoit</span>
          {isCloudEnabled && syncStatus && (
            <span className={`sync-badge sync-${syncStatus}`}>
              {syncStatus === 'syncing' && 'Sync...'}
              {syncStatus === 'synced' && 'Synced'}
              {syncStatus === 'offline' && 'Offline'}
            </span>
          )}
          <button className="btn-nav" onClick={handleExport} title="Exporter">Export</button>
          <button className="btn-nav" onClick={() => fileInputRef.current?.click()} title="Importer">Import</button>
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} />
          {isCloudEnabled && (
            <button className="btn-nav" onClick={handleLogout} title="Deconnexion">Deconnexion</button>
          )}
        </div>
        <button className="hamburger" onClick={() => setMobileMenu(!mobileMenu)}>
          <span /><span /><span />
        </button>
      </div>

      {/* Mobile menu */}
      <div className={`mobile-menu ${mobileMenu ? 'open' : ''}`}>
        {navButtons}
        <span className="user-badge benoit-user-badge" style={{ padding: '10px 16px' }}>Connecte : Benoit</span>
        <button className="btn-nav" onClick={() => { handleExport(); setMobileMenu(false); }}>Export</button>
        <button className="btn-nav" onClick={() => { fileInputRef.current?.click(); setMobileMenu(false); }}>Import</button>
        {isCloudEnabled && (
          <button className="btn-nav" onClick={() => { handleLogout(); setMobileMenu(false); }}>Deconnexion</button>
        )}
      </div>

      {/* API Key — dev uniquement, en prod la cle est cote serveur (ANTHROPIC_API_KEY) */}
      {import.meta.env.DEV && (
        <div className="api-key-bar">
          <label>API Key</label>
          <input type="password" value={apiKey} onChange={handleApiKeyChange} placeholder="sk-ant-..." />
        </div>
      )}

      {/* Dashboard */}
      {page === 'dashboard' && (
        <Dashboard clients={getBenoitClients()} onOpen={openClient} onNew={newClient} onHistory={openHistory} onRefresh={refreshClients} onNutrition={handleViewNutritionHistory} onOpenCalendar={() => { setPage('sharedCalendar'); setMobileMenu(false); }} />
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

      {/* Business Dashboard */}
      {page === 'business' && (
        <BusinessDashboard />
      )}

      {/* V31 : Agenda partagé (côté Benoit) */}
      {page === 'sharedCalendar' && (
        <SharedCalendar
          currentUser="benoit"
          onBack={goToDashboard}
          onOpenClient={openClient}
        />
      )}

      {/* Nutrition History (Benoit viewing Anissa's notes) */}
      {page === 'nutritionHistory' && (
        <NutritionHistory
          clientId={clientId}
          onBack={() => openClient(clientId)}
          isAnissa={false}
        />
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

          <>
            {!isMassage && currentClient && <ClientAlerts client={currentClient} />}
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
              <button className="btn btn-sm btn-secondary" onClick={handleSave}>{!isMassage && form.langue === 'EN' ? 'Save' : 'Sauvegarder'}</button>
              {!isMassage && (
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={() => setInterviewOpen(true)}
                  style={{ borderColor: '#c4a050', color: '#c4a050' }}
                >
                  {form.langue === 'EN' ? 'Interview guide' : "Guide d'entretien"}
                </button>
              )}
              {!isMassage && clientId && (
                <button className="btn btn-sm btn-secondary" onClick={() => openHistory(clientId)}>Historique</button>
              )}
              {isSharedClient && clientNutritionNotes.length > 0 && (
                <button className="btn btn-sm btn-secondary" onClick={() => handleViewNutritionHistory(clientId)} style={{ borderColor: 'rgba(42,157,92,.4)', color: '#2a9d5c' }}>
                  Notes Anissa ({clientNutritionNotes.length})
                </button>
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
                <button className={`edit-tab ${editTab === 'payments' ? 'edit-tab-active' : ''}`} onClick={() => setEditTab('payments')}>
                  Paiements
                </button>
              </div>

              {/* Nutrition notes from Anissa (read-only section for Benoit) */}
              {isSharedClient && editTab === 'form' && clientNutritionNotes.length > 0 && (
                <div className="nutrition-notes-readonly">
                  <h3>Notes nutrition - Anissa</h3>
                  <div className="nutrition-notes-latest">
                    <span className="nutrition-notes-date">
                      Derniere consultation : {new Date(clientNutritionNotes[0].date).toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </span>
                    {clientNutritionNotes[0].notesForCoach && (
                      <div className="nutrition-notes-content">
                        <strong>Recommandations pour le coach :</strong>
                        <p>{clientNutritionNotes[0].notesForCoach}</p>
                      </div>
                    )}
                    {clientNutritionNotes[0].nutritionalObservations && (
                      <div className="nutrition-notes-content">
                        <strong>Observations nutritionnelles :</strong>
                        <p>{clientNutritionNotes[0].nutritionalObservations}</p>
                      </div>
                    )}
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={() => handleViewNutritionHistory(clientId)}
                      style={{ marginTop: 10, borderColor: 'rgba(42,157,92,.4)', color: '#2a9d5c' }}
                    >
                      Voir toutes les consultations ({clientNutritionNotes.length})
                    </button>
                  </div>
                </div>
              )}

              {isMassage && editTab === 'form' && !convertMode && (
                <div className="convert-section">
                  <span className="convert-label">Convertir en client coaching :</span>
                  <button className="btn btn-sm btn-convert btn-convert-online" onClick={() => handleStartConvert('online')}>
                    Coaching Online
                  </button>
                  <button className="btn btn-sm btn-convert btn-convert-presentiel" onClick={() => handleStartConvert('presentiel')}>
                    Coaching Presentiel
                  </button>
                </div>
              )}
          </>

          {editTab === 'sessions' && clientId && isMassage ? (
            <MassageSessionPanel clientId={clientId} onRefresh={forceUpdate} />
          ) : editTab === 'progression' && clientId && !isMassage ? (
            <ProgressionPanel clientId={clientId} onRefresh={forceUpdate} />
          ) : editTab === 'payments' && clientId ? (
            <BenoitPaymentsPanel clientId={clientId} onRefresh={forceUpdate} />
          ) : (
            <>
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

              <div className="steps-progress">
                <div className="steps-track">
                  <div className="steps-line">
                    <div className="steps-line-fill" style={{ width: `${progressPct}%` }} />
                  </div>
                  {currentSteps.map(s => {
                    const tLang = getT(form.langue);
                    const catKey = categorie === 'presentiel' ? 'presentiel' : 'online';
                    const labelKey = STEP_LABEL_KEYS[catKey]?.[s.id];
                    const labelText = !isMassage && labelKey ? tLang(labelKey) : s.label;
                    return (
                      <div
                        key={s.id}
                        className={`step-node ${s.id === step ? 'active' : ''} ${s.id < step ? 'completed' : ''}`}
                        onClick={() => setStep(s.id)}
                      >
                        <div className="step-circle">{stepIcons[s.id - 1]}</div>
                        <span className="step-label">{labelText}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {isMassage ? (
                <MassageForm step={step} form={form} updateField={updateField} />
              ) : (
                <StepForm step={step} form={form} updateField={updateField} categorie={categorie} originalForm={originalForm} />
              )}

              <div className="nav-buttons">
                <button className="btn btn-secondary" onClick={() => setStep(Math.max(1, step - 1))} disabled={step === 1}>
                  {!isMassage && form.langue === 'EN' ? 'Previous' : 'Precedent'}
                </button>
                {step < totalSteps && (
                  <button className="btn btn-primary" onClick={() => setStep(step + 1)}>
                    {!isMassage && form.langue === 'EN' ? 'Next' : 'Suivant'}
                  </button>
                )}
              </div>

              {!isMassage && (
                <button
                  className={`btn btn-generate ${loading ? 'loading-pulse' : ''}`}
                  onClick={handleGenerate}
                  disabled={loading}
                >
                  {form.langue === 'EN'
                    ? (loading ? 'Generating...' : results ? 'Regenerate full file' : 'Generate onboarding file')
                    : (loading ? 'Generation en cours...' : results ? 'Regenerer le dossier complet' : "Generer le dossier d'onboarding")}
                </button>
              )}

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

              {!isMassage && (
                <InterviewPanel
                  open={interviewOpen}
                  clientId={clientId}
                  interviewNotes={interviewNotes}
                  onChange={(next) => {
                    setInterviewNotes(next);
                    if (!clientId) return;
                    // Debounce persistence so typing in a notes textarea doesn't
                    // hammer Supabase on every keystroke.
                    if (interviewSaveTimer.current) clearTimeout(interviewSaveTimer.current);
                    interviewSaveTimer.current = setTimeout(() => {
                      updateInterviewNotes(clientId, next);
                    }, 600);
                  }}
                  onClose={() => {
                    // Flush any pending save before closing.
                    if (interviewSaveTimer.current) {
                      clearTimeout(interviewSaveTimer.current);
                      interviewSaveTimer.current = null;
                      if (clientId && interviewNotes) updateInterviewNotes(clientId, interviewNotes);
                    }
                    setInterviewOpen(false);
                  }}
                  onFinish={(templateId) => {
                    // 1. Flush pending debounced save so the cloud copy of
                    //    interviewNotes reflects the latest text.
                    if (interviewSaveTimer.current) {
                      clearTimeout(interviewSaveTimer.current);
                      interviewSaveTimer.current = null;
                      if (clientId && interviewNotes) updateInterviewNotes(clientId, interviewNotes);
                    }
                    // 2. Apply mapping to the current form (non-destructive append).
                    setForm((prev) => applyInterviewNotesToForm(prev, interviewNotes, templateId));
                    // 3. Close the panel.
                    setInterviewOpen(false);
                  }}
                />
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

export default App;
