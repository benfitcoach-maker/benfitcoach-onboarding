import { useState, useEffect, useMemo } from 'react';
import { FORMULES, CATEGORIES, PRESENTIEL_PACKS } from './formSteps';
import { deleteClient, updateClientStatus, getNutritionConsultations, syncBenoitNotifications, getNotifications, saveClient } from './store';
import {
  BENOIT_PAYMENT_STATUSES as BENOIT_PAYMENT_STATUSES_SHARED,
  BENOIT_PAYMENT_LABELS as BENOIT_PAYMENT_LABELS_SHARED,
  BENOIT_PAYMENT_COLORS as BENOIT_PAYMENT_COLORS_SHARED,
  normalizeLegacyPaymentStatus as normalizeLegacyPaymentStatusShared,
  getAmountPaid as getAmountPaidShared,
  getPackPrice as getPackPriceShared,
  getTotalPaid as getTotalPaidShared,
  getPaymentStatus as getPaymentStatusShared,
} from './services/benoitPayments';
import { listSharedEvents, buildAgendaAlerts } from './services/sharedEvents';

const LOGO_URL = 'https://cdn.prod.website-files.com/699eb56ec2e8b94e41cfa06c/69a6ccf52a4f1eb605779f33_logo%20benfitocah.png';

const STATUS_LABELS = {
  nouveau: { label: 'Nouveau', className: 'badge-new' },
  actif: { label: 'Actif', className: 'badge-active' },
  relance: { label: 'A relancer', className: 'badge-relaunch' },
};

const CATEGORY_FILTERS = [
  { value: 'all', label: 'Tous' },
  { value: 'online', label: '🌐 Online' },
  { value: 'presentiel', label: '📍 Presentiel' },
  { value: 'massage', label: '🤲 Massage' },
];

const FORMULE_FILTERS = [
  { value: 'all', label: 'Toutes' },
  { value: 'autonome', label: 'Autonome' },
  { value: 'suivi', label: 'Suivi Complet' },
  { value: 'intensif', label: 'Intensif' },
  { value: 'pack10', label: 'Pack 10' },
  { value: 'pack20', label: 'Pack 20' },
  { value: 'pack30', label: 'Pack 30' },
  { value: 'massage', label: 'Massage' },
  { value: 'custom', label: 'Personnalise' },
];

const STATUS_FILTERS = [
  { value: 'all', label: 'Tous' },
  { value: 'nouveau', label: 'Nouveau' },
  { value: 'actif', label: 'Actif' },
  { value: 'relance', label: 'A relancer' },
];

const LANG_FILTERS = [
  { value: 'all', label: 'Toutes' },
  { value: 'FR', label: 'FR' },
  { value: 'EN', label: 'EN' },
];

// Filtres Benoit V2 — s'appuient sur alertsByClient + champs client existants
const BENOIT_FILTERS = [
  { value: 'all',           label: 'Tous' },
  { value: 'relance',       label: '⚠ A relancer' },
  { value: 'inactive',      label: '💤 Inactifs' },
  { value: 'pack_almost',   label: '⏳ Pack presque fini' },
  { value: 'pack_done',     label: '✓ Pack fini' },
  { value: 'shared',        label: '🥗 Partagés Anissa' },
  { value: 'no_dossier',    label: '📋 Sans dossier' },
  { value: 'with_sessions', label: '➕ Avec séances' },
  { value: 'no_sessions',   label: '➖ Sans séances' },
  { value: 'pay_pending',   label: '💰 À encaisser' },
  { value: 'pay_partial',   label: '◐ Partiels' },
  { value: 'pay_paid',      label: '✓ Payés' },
];

const BENOIT_SORTS = [
  { value: 'recent',        label: 'Plus récents' },
  { value: 'alpha',         label: 'Alphabétique' },
  { value: 'priority',      label: 'Priorité relance' },
  { value: 'pack_advanced', label: 'Plus avancés' },
  { value: 'pack_least',    label: 'Moins avancés' },
];

const BENOIT_SESSION_PACKS = [10, 20, 30, 50];

function formatDate(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ─── Helpers Benoit V2 (séances + priorité) ───
function getSessionsDone(client) {
  const v = Number(client?.form?.benoitSessionsDone);
  return Number.isFinite(v) && v > 0 ? v : 0;
}
function getSessionsTotal(client) {
  const v = Number(client?.form?.benoitSessionsTotal);
  return Number.isFinite(v) && v > 0 ? v : 0; // 0 = non défini
}
function isSharedWithAnissaClient(c) {
  const f = c.formule || '';
  return (f === 'suivi' || f === 'intensif') && (c.createdBy || 'benoit') !== 'anissa';
}
// Rang pour tri "priorité relance" : plus petit = plus prioritaire
function priorityRank(client, types) {
  if (types.has('benoit_pack_completed')) return 1;
  if (types.has('benoit_pack_almost_done')) return 2;
  if (types.has('benoit_client_inactive')) return 3;
  if ((client.status || 'nouveau') === 'relance') return 4;
  return 5;
}
// Dernière séance datée : priorité benoitLastSessionAt > dernière de benoitSessionDates
function getLastSessionISO(client) {
  const last = client?.form?.benoitLastSessionAt;
  if (last) return last;
  const arr = client?.form?.benoitSessionDates;
  if (Array.isArray(arr) && arr.length > 0) return arr[arr.length - 1];
  return null;
}
// ─── Transmission Anissa V7 ── helpers purs
const BENOIT_TRANSFER_STATUSES = ['pending', 'sent', 'booked', 'done'];
const BENOIT_TRANSFER_LABELS = {
  pending: '⏳ À transmettre',
  sent: '✉ Transmis',
  booked: '📅 RDV pris',
  done: '✓ Suivi fait',
};
const BENOIT_TRANSFER_CYCLE = ['sent', 'booked', 'done']; // cycle après transmission initiale
// Construit un résumé texte lisible pour Anissa, uniquement à partir des champs existants.
// Aucune donnée inventée : les lignes absentes sont omises.
function buildAnissaTransferSummary(client, transferNote) {
  if (!client) return '';
  const lines = ['Client de Benoit'];
  const push = (label, value) => {
    if (value == null) return;
    const v = typeof value === 'string' ? value.trim() : String(value);
    if (!v) return;
    lines.push(`- ${label} : ${v}`);
  };
  const f = client.form || {};
  push('Prénom', client.prenom || f.prenom);
  if (client.categorie && CATEGORIES[client.categorie]?.nom) push('Catégorie', CATEGORIES[client.categorie].nom);
  if (client.formule && FORMULES[client.formule]?.nom) push('Formule', FORMULES[client.formule].nom);
  else if (client.formule) push('Formule', client.formule);
  // Objectifs (différents champs selon le type de client)
  const objectif = f.objectifPrincipal || f.objectif || f.objectifPrincipalNutrition || f.objectifSport || f.objectifNutrition;
  push('Objectif principal', objectif);
  if (f.objectifSecondaire) push('Objectif secondaire', f.objectifSecondaire);
  // Physique
  if (f.age) push('Âge', `${f.age} ans`);
  if (f.poids) push('Poids', `${f.poids} kg`);
  if (f.taille) push('Taille', `${f.taille} cm`);
  // Douleurs / limitations
  const douleurs = [f.douleursActuelles, f.douleursMenstruelles, f.douleursInflammations]
    .filter(x => x && String(x).trim())
    .join(' / ');
  if (douleurs) push('Douleurs', douleurs);
  if (f.blessures) push('Blessures', f.blessures);
  if (f.antecedentsFamiliaux) push('Antécédents familiaux', f.antecedentsFamiliaux);
  // Sport / activité (formSteps : online=frequenceSport, presentiel/massage=niveau+frequence)
  if (f.niveau) push('Niveau sportif', f.niveau);
  const freqSport = f.frequenceSport || f.frequence;
  if (freqSport) push('Fréquence sport', freqSport);
  // Pack Benoit (label + compteur séances + prix)
  const packLabel = f.benoitPackLabel;
  const sessionsDone = Number(f.benoitSessionsDone);
  const sessionsTotal = Number(f.benoitSessionsTotal);
  const packPrice = Number(f.benoitPackPrice);
  const hasDone = Number.isFinite(sessionsDone) && sessionsDone > 0;
  const hasTotal = Number.isFinite(sessionsTotal) && sessionsTotal > 0;
  const hasPrice = Number.isFinite(packPrice) && packPrice >= 0;
  if (packLabel || hasDone || hasTotal || hasPrice) {
    const parts = [];
    if (packLabel) parts.push(packLabel);
    if (hasDone || hasTotal) parts.push(hasTotal ? `${hasDone ? sessionsDone : 0}/${sessionsTotal} séances` : `${sessionsDone} séances`);
    if (hasPrice) parts.push(`${packPrice} CHF`);
    push('Pack Benoit', parts.join(' · '));
  }
  // Dernière séance
  const lastIso = f.benoitLastSessionAt
    || (Array.isArray(f.benoitSessionDates) && f.benoitSessionDates.length > 0
      ? f.benoitSessionDates[f.benoitSessionDates.length - 1]
      : null);
  if (lastIso) {
    try {
      const dd = new Date(lastIso);
      if (!isNaN(dd.getTime())) push('Dernière séance Benoit', dd.toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit', year: 'numeric' }));
    } catch {}
  }
  // Dernière note séance
  if (Array.isArray(f.benoitSessionNotes) && f.benoitSessionNotes.length > 0) {
    const last = f.benoitSessionNotes[f.benoitSessionNotes.length - 1];
    if (last?.note) push('Dernière note coaching', String(last.note).slice(0, 200));
  }
  // Statut / dossier
  push('Statut', client.status || 'nouveau');
  if (client.latestSections) lines.push('- Dossier BenfitCoach disponible');
  // Note libre transmission
  const noteClean = (transferNote || '').trim();
  if (noteClean) push('Note de transmission Benoit', noteClean);
  return lines.join('\n');
}
// ─── Paiement V10/V11 ── helpers importés depuis services/benoitPayments (source unique)
const BENOIT_PAYMENT_STATUSES = BENOIT_PAYMENT_STATUSES_SHARED;
const BENOIT_PAYMENT_LABELS = BENOIT_PAYMENT_LABELS_SHARED;
const BENOIT_PAYMENT_COLORS = BENOIT_PAYMENT_COLORS_SHARED;
const normalizeLegacyPaymentStatus = normalizeLegacyPaymentStatusShared;
const getAmountPaid = getAmountPaidShared;
const getPackPrice = getPackPriceShared;
const getTotalPaid = getTotalPaidShared;
const getPaymentStatus = getPaymentStatusShared;
// Ligne d'entête séances : "<Label> · X/Y · PPP CHF" avec fallbacks
function buildPackHeader(client) {
  const done = Number(client?.form?.benoitSessionsDone);
  const doneN = Number.isFinite(done) && done > 0 ? done : 0;
  const totalRaw = Number(client?.form?.benoitSessionsTotal);
  const total = Number.isFinite(totalRaw) && totalRaw > 0 ? totalRaw : 0;
  const label = client?.form?.benoitPackLabel;
  const rawPrice = client?.form?.benoitPackPrice;
  let price = null;
  if (rawPrice != null && rawPrice !== '') {
    const p = Number(rawPrice);
    if (Number.isFinite(p) && p >= 0) price = p;
  }

  const parts = [];
  // 1. Label (ou "Séances" si rien)
  if (label && String(label).trim()) parts.push(String(label).trim());
  else if (total > 0) parts.push(`Pack ${total}`);
  else parts.push('Séances');
  // 2. Compteur
  parts.push(total > 0 ? `${doneN}/${total}` : `${doneN}`);
  // 3. Tarif
  if (price != null) parts.push(`${price} CHF`);

  return parts.join(' · ');
}
// Dernière note séance (null si aucune)
function getLastSessionNote(client) {
  const notes = client?.form?.benoitSessionNotes;
  if (!Array.isArray(notes) || notes.length === 0) return null;
  return notes[notes.length - 1] || null;
}
// Tronque une note pour l'affichage carte
function truncateNote(text, max = 60) {
  if (!text) return '';
  const t = String(text).trim();
  return t.length > max ? t.slice(0, max - 1) + '…' : t;
}
// Formatage relatif court FR
function formatRelativeDay(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  const startOf = (x) => { const y = new Date(x); y.setHours(0,0,0,0); return y; };
  const diffDays = Math.round((startOf(now) - startOf(d)) / (24 * 60 * 60 * 1000));
  if (diffDays <= 0) return "aujourd'hui";
  if (diffDays === 1) return 'hier';
  return `il y a ${diffDays}j`;
}
// ─── Massothérapie V9 ── helpers purs
const MASSAGE_STATUSES = ['amelioration', 'stable', 'empire'];
const MASSAGE_STATUS_LABELS = {
  amelioration: '✓ Amélioration',
  stable: '● Stable',
  empire: '⚠ Aggravation',
};
const MASSAGE_STATUS_COLORS = {
  amelioration: { bg: '#2e8b5722', fg: '#2e8b57', border: '#2e8b5755' },
  stable:       { bg: 'rgba(212,201,168,.15)', fg: 'rgba(212,201,168,.9)', border: 'rgba(212,201,168,.4)' },
  empire:       { bg: '#c4305022', fg: '#c43050', border: '#c4305055' },
};
const MASSAGE_RELANCE_DAYS = 21;
function getMassageStatus(client) {
  const s = client?.form?.massageStatus;
  if (typeof s !== 'string') return null;
  const low = s.trim().toLowerCase();
  return MASSAGE_STATUSES.includes(low) ? low : null;
}
function buildMassageSummary(client) {
  const f = client?.form || {};
  const parts = [];
  if (f.massageMainIssue && String(f.massageMainIssue).trim()) parts.push(String(f.massageMainIssue).trim());
  if (f.massageMainGoal && String(f.massageMainGoal).trim()) parts.push(String(f.massageMainGoal).trim());
  const status = getMassageStatus(client);
  if (status) parts.push(status);
  return parts.join(' · ');
}
function getLastMassageISO(client) {
  const sessions = client?.massageSessions;
  if (!Array.isArray(sessions) || sessions.length === 0) return null;
  // Prendre la plus récente par date
  const dates = sessions.map(s => s?.date).filter(Boolean);
  if (dates.length === 0) return null;
  return dates.reduce((best, d) => {
    const bd = best ? new Date(best).getTime() : 0;
    const cd = new Date(d).getTime();
    return cd > bd ? d : best;
  }, null);
}
function isMassageRelance(client) {
  const iso = getLastMassageISO(client);
  if (!iso) return false;
  const last = new Date(iso);
  if (isNaN(last.getTime())) return false;
  const diffMs = Date.now() - last.getTime();
  return diffMs / (24 * 60 * 60 * 1000) > MASSAGE_RELANCE_DAYS;
}
// V29 : parser "1x/semaine", "2x/mois", "3x/semaine" → jours attendus entre séances
// Retourne le délai max toléré (1.5 × délai normal) ou null si parsing échoue
function parseMassageFrequencyDays(freq) {
  if (!freq || typeof freq !== 'string') return null;
  const s = freq.toLowerCase().trim();
  const m = s.match(/(\d+)\s*x?\s*\/\s*(jour|semaine|sem|mois|m)/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  const unit = m[2];
  let periodDays;
  if (unit === 'jour') periodDays = 1;
  else if (unit === 'semaine' || unit === 'sem') periodDays = 7;
  else if (unit === 'mois' || unit === 'm') periodDays = 30;
  else return null;
  const expectedInterval = periodDays / n;
  return Math.round(expectedInterval * 1.5); // tolérance 50%
}
// Délai dépassé selon la fréquence cible
function isMassageRhythmLate(client) {
  const iso = getLastMassageISO(client);
  if (!iso) return false;
  const tolDays = parseMassageFrequencyDays(client?.form?.massageFrequency);
  if (!tolDays) return false;
  const last = new Date(iso);
  if (isNaN(last.getTime())) return false;
  const diffDays = (Date.now() - last.getTime()) / (24 * 60 * 60 * 1000);
  return diffDays > tolDays;
}
// ─── Cloche alertes V21 ── regroupement par section + label d'action par type
const ALERT_SECTION = {
  pack_done: 'urgent',
  pack_almost_done_counter: 'urgent',
  questionnaire_pending: 'todo',
  transfer_pending: 'todo',
  payment_pending: 'todo',
  payment_partial: 'todo',
  inactive: 'follow',
  masso_rhythm_late: 'follow',
  // V37 : rappels agenda (section dédiée, après les urgences métier)
  agenda_rdv_soon: 'agenda',
  agenda_tomorrow_first: 'agenda',
  agenda_busy_day: 'agenda',
};
const ALERT_ACTION_LABEL = {
  pack_done: 'Ouvrir',
  pack_almost_done_counter: 'Ouvrir',
  questionnaire_pending: 'Questionnaire',
  transfer_pending: 'Transmettre',
  payment_pending: 'Paiement',
  payment_partial: 'Paiement',
  inactive: 'Ouvrir',
  masso_rhythm_late: 'Relancer',
  agenda_rdv_soon: 'Agenda',
  agenda_tomorrow_first: 'Agenda',
  agenda_busy_day: 'Agenda',
};
const ALERT_SECTIONS_ORDER = [
  { key: 'urgent', title: '🔴 Urgent',    color: '#c43050' },
  { key: 'todo',   title: '🟡 À traiter', color: '#c4a050' },
  { key: 'follow', title: '⚪ À suivre',  color: 'rgba(212,201,168,0.65)' },
  { key: 'agenda', title: '📅 Agenda',    color: '#6ab6f0' },
];
// Retire l'emoji+prenom déjà au début de message pour n'afficher que la partie "action"
function formatAlertBody(msg, prenom) {
  if (!msg) return '';
  // Les messages ont la forme "emoji prénom — xxx" → on enlève "emoji prénom —"
  const prefix = `— ${prenom}`.replace('— ', '').trim();
  const idx = msg.indexOf('— ');
  if (idx >= 0) return msg.slice(idx + 2).trim();
  return msg;
}

// ─── Cloche alertes Benoit V18 ── compile toutes les alertes par client
// depuis les données existantes. Aucune table, aucune persistance — calcul live.
function buildBenoitAlertsForClient(client, alertsByClient) {
  if (!client || !client.id) return [];
  const out = [];
  const f = client.form || {};
  const prenom = client.prenom || f.prenom || 'Client';
  const types = alertsByClient.get(client.id) || new Set();

  // Priorité 1 : pack fini
  if (types.has('benoit_pack_completed')) {
    out.push({
      priority: 1,
      type: 'pack_done',
      clientId: client.id,
      clientName: prenom,
      message: `✓ ${prenom} — Pack fini`,
    });
  }
  // Priorité 2 : pack bientôt fini (règle explicite remaining <= 2)
  const total = Number(f.benoitSessionsTotal);
  const done = Number(f.benoitSessionsDone);
  if (Number.isFinite(total) && total > 0 && Number.isFinite(done) && done < total) {
    const remaining = total - done;
    if (remaining <= 2) {
      out.push({
        priority: 2,
        type: 'pack_almost_done_counter',
        clientId: client.id,
        clientName: prenom,
        message: `⚠️ ${prenom} — Pack presque fini (${remaining} séance${remaining > 1 ? 's' : ''} restante${remaining > 1 ? 's' : ''})`,
      });
    }
  }
  // Priorité 3 : client inactif
  if (types.has('benoit_client_inactive')) {
    out.push({
      priority: 3,
      type: 'inactive',
      clientId: client.id,
      clientName: prenom,
      message: `💤 ${prenom} — Client inactif`,
    });
  }
  // Priorité 3 bis : rythme masso en retard (fréquence renseignée + dernière séance trop ancienne)
  if (client.categorie === 'massage' && isMassageRhythmLate(client)) {
    const freq = f.massageFrequency;
    out.push({
      priority: 3,
      type: 'masso_rhythm_late',
      clientId: client.id,
      clientName: prenom,
      message: `🕒 ${prenom} — Masso ${freq ? `(${freq}) ` : ''}en retard`,
    });
  }
  // Priorité 4 : paiement pending
  // Priorité 5 : paiement partiel
  const payStatus = getPaymentStatus(client);
  if (payStatus === 'pending') {
    out.push({
      priority: 4,
      type: 'payment_pending',
      clientId: client.id,
      clientName: prenom,
      message: `💰 ${prenom} — Paiement en attente`,
    });
  } else if (payStatus === 'partial') {
    out.push({
      priority: 5,
      type: 'payment_partial',
      clientId: client.id,
      clientName: prenom,
      message: `💰 ${prenom} — Paiement partiel`,
    });
  }
  // Priorité 6 : à transmettre à Anissa (questionnaire fait mais pas transmis)
  if (f.benoitQuestionnaireFilledAt && !f.sharedWithAnissa) {
    out.push({
      priority: 6,
      type: 'transfer_pending',
      clientId: client.id,
      clientName: prenom,
      message: `🥗 ${prenom} — À transmettre à Anissa`,
    });
  }
  // Priorité 7 : questionnaire à faire
  if (!f.benoitQuestionnaireFilledAt) {
    out.push({
      priority: 7,
      type: 'questionnaire_pending',
      clientId: client.id,
      clientName: prenom,
      message: `📝 ${prenom} — Questionnaire à faire`,
    });
  }
  return out;
}

// V37/V39 : buildAgendaAlerts désormais importé depuis services/sharedEvents (source unique)

// ─── Prochaine action client V14 (simplifiée) ── helper pur
// Deux cas seulement : questionnaire à faire → transmission à Anissa.
// Au-delà, pas d'action auto (les quick-actions existantes restent dispo).
function getNextClientAction(client) {
  if (!client) return null;
  const f = client.form || {};
  if (!f.benoitQuestionnaireFilledAt) {
    return { type: 'questionnaire', label: 'Questionnaire' };
  }
  if (!f.sharedWithAnissa) {
    return { type: 'transfer', label: 'Transmettre à Anissa' };
  }
  return null;
}
// ─── Checklist parcours client V8 ──
// Helper pur qui renvoie la liste ordonnée des étapes avec leur état.
// Aucune étape n'est inventée : si la donnée source n'existe pas de façon fiable
// dans le modèle actuel, l'étape est soit omise, soit calculée sur un signal robuste.
function buildClientChecklist(client) {
  if (!client) return [];
  const f = client.form || {};
  const sessionsTotal = Number(f.benoitSessionsTotal);
  const sessionsDone = Number(f.benoitSessionsDone);
  return [
    { key: 'dossier',       label: 'Dossier créé',         done: !!client.latestSections },
    // V13 : vraie règle basée sur benoitQuestionnaireFilledAt (rempli en direct avec Benoit
    // OU rempli par le client via le formulaire public). Le "meta" expose qui a rempli
    // pour enrichir le tooltip.
    { key: 'questionnaire', label: 'Questionnaire fait',   done: !!f.benoitQuestionnaireFilledAt, meta: f.benoitQuestionnaireFilledBy || null },
    { key: 'pack',          label: 'Pack défini',          done: (Number.isFinite(sessionsTotal) && sessionsTotal > 0) || !!f.benoitPackLabel },
    { key: 'sessions',      label: 'Séances démarrées',    done: Number.isFinite(sessionsDone) && sessionsDone > 0 },
    { key: 'transfert',     label: 'Transmission Anissa',  done: f.sharedWithAnissa === true },
    { key: 'rdv_anissa',    label: 'RDV Anissa pris',      done: f.anissaTransferStatus === 'booked' || f.anissaTransferStatus === 'done' },
    { key: 'suivi_anissa',  label: 'Suivi Anissa fait',    done: f.anissaTransferStatus === 'done' },
  ];
}
// Ratio done/total pour tri, -1 si total inconnu (relégué en fin)
function packRatio(client) {
  const done = getSessionsDone(client);
  const total = getSessionsTotal(client);
  if (total <= 0) return -1;
  return done / total;
}

function getInitial(name) {
  return (name || '?').charAt(0).toUpperCase();
}

function getCategoryBadge(categorie) {
  const cat = CATEGORIES[categorie] || CATEGORIES.online;
  return (
    <span
      className="category-badge"
      style={{ color: cat.color, background: cat.bgColor, borderColor: cat.color + '33' }}
    >
      {cat.icon} {cat.nom}
    </span>
  );
}

function getFormulaDisplay(client) {
  const cat = client.categorie || 'online';
  if (cat === 'massage') {
    return 'Massotherapie';
  }
  if (cat === 'presentiel') {
    const pack = PRESENTIEL_PACKS[client.form?.pack];
    return pack ? pack.nom : 'Coaching Presentiel';
  }
  const formule = FORMULES[client.formule] || FORMULES.suivi;
  return `${formule.nom} - ${formule.prix}`;
}

export default function Dashboard({ clients, onOpen, onNew, onHistory, onRefresh, onNutrition, onOpenCalendar }) {
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterFormule, setFilterFormule] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterLang, setFilterLang] = useState('all');
  const [filterBenoit, setFilterBenoit] = useState('all');
  const [sortBenoit, setSortBenoit] = useState('recent');
  const [benoitNotifs, setBenoitNotifs] = useState([]);
  const [actionFeedback, setActionFeedback] = useState(''); // mini-toast local
  const [alertsBellOpen, setAlertsBellOpen] = useState(false);
  const [filtersDrawerOpen, setFiltersDrawerOpen] = useState(false);

  // V20 : détection mobile pour ajuster le nombre de pills critiques
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(max-width: 430px)').matches
      : false
  );
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(max-width: 430px)');
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener ? mq.addEventListener('change', handler) : mq.addListener(handler);
    return () => {
      mq.removeEventListener ? mq.removeEventListener('change', handler) : mq.removeListener(handler);
    };
  }, []);

  // Sync des notifications Benoit à chaque changement de la liste clients
  useEffect(() => {
    try {
      syncBenoitNotifications(clients);
      const all = getNotifications();
      setBenoitNotifs(all.filter(n =>
        n.type === 'benoit_pack_almost_done' ||
        n.type === 'benoit_pack_completed' ||
        n.type === 'benoit_client_inactive'
      ));
    } catch (e) {
      console.warn('[Dashboard] syncBenoitNotifications failed:', e?.message);
    }
  }, [clients]);

  // Index : clientId -> set de types d'alertes actives, pour affichage par carte
  const alertsByClient = useMemo(() => {
    const map = new Map();
    for (const n of benoitNotifs) {
      if (!n.clientId) continue;
      if (!map.has(n.clientId)) map.set(n.clientId, new Set());
      map.get(n.clientId).add(n.type);
    }
    return map;
  }, [benoitNotifs]);

  const unreadBenoitCount = benoitNotifs.filter(n => !n.read).length;

  // V19 : compteur de filtres actifs pour bouton mobile
  const activeFiltersCount = useMemo(() => {
    let n = 0;
    if (filterCategory !== 'all') n++;
    if (filterFormule !== 'all') n++;
    if (filterStatus !== 'all') n++;
    if (filterLang !== 'all') n++;
    if (filterBenoit !== 'all') n++;
    return n;
  }, [filterCategory, filterFormule, filterStatus, filterLang, filterBenoit]);

  const resetAllFilters = () => {
    setFilterCategory('all');
    setFilterFormule('all');
    setFilterStatus('all');
    setFilterLang('all');
    setFilterBenoit('all');
  };

  // V37 : charge les événements agenda des 2 prochains jours pour alimenter les rappels cloche
  const [agendaEvents, setAgendaEvents] = useState([]);
  useEffect(() => {
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
    // Rafraîchit toutes les 5 min (RDV dans 1h évolue)
    const iv = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(iv);
  }, []);

  // V18 + V37 : alertes agrégées (clients Benoit + agenda) pour la cloche
  const bellAlerts = useMemo(() => {
    const acc = [];
    for (const c of (clients || [])) {
      if ((c?.createdBy || 'benoit') === 'anissa') continue;
      acc.push(...buildBenoitAlertsForClient(c, alertsByClient));
    }
    acc.push(...buildAgendaAlerts(agendaEvents));
    acc.sort((a, b) => a.priority - b.priority);
    return acc;
  }, [clients, alertsByClient, agendaEvents]);

  // V21 + V37 : regroupement par section (urgent / todo / follow / agenda)
  const bellAlertsGrouped = useMemo(() => {
    const grouped = { urgent: [], todo: [], follow: [], agenda: [] };
    for (const a of bellAlerts) {
      const section = ALERT_SECTION[a.type] || 'follow';
      grouped[section].push(a);
    }
    return grouped;
  }, [bellAlerts]);

  // V21 : fermeture de la cloche au clic extérieur (desktop popover)
  useEffect(() => {
    if (!alertsBellOpen) return;
    const handler = (e) => {
      const popover = document.querySelector('.benoit-alerts-popover');
      const drawer = document.querySelector('.filters-drawer-overlay');
      const bellBtns = document.querySelectorAll('.benoit-alerts-bell, .mobile-icon-btn');
      // Si le clic est à l'intérieur du popover/drawer/bouton cloche → ne pas fermer
      if (popover && popover.contains(e.target)) return;
      if (drawer && drawer.contains(e.target)) return;
      for (const b of bellBtns) { if (b.contains(e.target)) return; }
      setAlertsBellOpen(false);
    };
    // Délai pour éviter que le clic d'ouverture ferme immédiatement
    const t = setTimeout(() => document.addEventListener('mousedown', handler), 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', handler);
    };
  }, [alertsBellOpen]);

  // V21 : rendu groupé réutilisable pour popover desktop et drawer mobile
  const renderGroupedAlerts = (compact = false) => {
    if (bellAlerts.length === 0) {
      return (
        <div style={{ padding: compact ? 16 : 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: compact ? '.85em' : '0.9em' }}>
          Aucune alerte.
        </div>
      );
    }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 8 : 14 }}>
        {ALERT_SECTIONS_ORDER.map(sec => {
          const items = bellAlertsGrouped[sec.key];
          if (!items || items.length === 0) return null;
          return (
            <section key={sec.key}>
              <div style={{
                fontSize: compact ? '.7em' : '.78em',
                fontWeight: 700,
                color: sec.color,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                padding: compact ? '4px 6px 4px' : '4px 4px 6px',
                marginBottom: 4,
              }}>
                {sec.title} ({items.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 2 : 4 }}>
                {items.map((a, idx) => {
                  const body = formatAlertBody(a.message, a.clientName);
                  const actionLabel = ALERT_ACTION_LABEL[a.type] || 'Ouvrir';
                  return (
                    <button
                      key={`${a.clientId}-${a.type}-${idx}`}
                      type="button"
                      onClick={() => {
                        setAlertsBellOpen(false);
                        // V37 : alertes agenda → ouvrir le calendrier, sinon ouvrir la fiche client
                        if (a.type && a.type.startsWith('agenda_')) {
                          if (typeof onOpenCalendar === 'function') onOpenCalendar();
                        } else if (a.clientId) {
                          onOpen(a.clientId);
                        }
                      }}
                      style={{
                        textAlign: 'left',
                        padding: compact ? '8px 10px' : '12px 12px',
                        background: compact ? 'transparent' : 'rgba(196,160,80,0.05)',
                        border: compact ? 'none' : '1px solid rgba(196,160,80,0.15)',
                        borderRadius: 8,
                        color: 'var(--text)',
                        cursor: 'pointer',
                        minHeight: compact ? 34 : 48,
                        display: 'flex', alignItems: 'center', gap: 10,
                      }}
                      onMouseEnter={e => { if (compact) e.currentTarget.style.background = 'rgba(196,160,80,0.08)'; }}
                      onMouseLeave={e => { if (compact) e.currentTarget.style.background = 'transparent'; }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: compact ? '.85em' : '.92em', lineHeight: 1.3 }}>
                          {a.clientName}
                        </div>
                        <div style={{ fontSize: compact ? '.75em' : '.82em', color: 'var(--text-muted)', lineHeight: 1.3, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {body}
                        </div>
                      </div>
                      <span style={{
                        fontSize: compact ? '.7em' : '.75em',
                        fontWeight: 600,
                        color: sec.color,
                        padding: '4px 8px',
                        borderRadius: 6,
                        background: 'rgba(196,160,80,0.08)',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                      }}>
                        {actionLabel} →
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    );
  };
  const totalBenoitCount = benoitNotifs.length;

  const handleDelete = (e, id) => {
    e.stopPropagation();
    if (confirm('Supprimer ce client ?')) {
      deleteClient(id);
      onRefresh();
    }
  };

  const cycleStatus = (e, client) => {
    e.stopPropagation();
    const order = ['nouveau', 'actif', 'relance'];
    const idx = order.indexOf(client.status || 'nouveau');
    updateClientStatus(client.id, order[(idx + 1) % order.length]);
    onRefresh();
  };

  // ─── Quick actions (V1 conservatrice : clipboard + handlers existants) ───
  const flashFeedback = (msg) => {
    setActionFeedback(msg);
    setTimeout(() => setActionFeedback(''), 2200);
  };

  const copyToClipboard = async (text, okMsg, failMsg) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback < clipboard API
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      flashFeedback(okMsg);
    } catch {
      flashFeedback(failMsg || 'Impossible de copier');
    }
  };

  const handleQuickOpenDossier = (e, client) => {
    e.stopPropagation();
    onOpen(client.id);
  };

  const handleQuickQuestionnaire = (e, client) => {
    e.stopPropagation();
    const url = `${window.location.origin}/questionnaire/${client.id}`;
    copyToClipboard(url, 'Lien questionnaire copié');
  };

  // V13 : marquer le questionnaire rempli en direct avec Benoit
  const handleMarkQuestionnaireFilled = (e, client) => {
    e.stopPropagation();
    const prenom = client.prenom || client.form?.prenom || 'client';
    if (typeof window !== 'undefined' && window.confirm) {
      const already = client.form?.benoitQuestionnaireFilledAt;
      const msg = already
        ? `Ce client a déjà un questionnaire marqué comme fait (${already.slice(0,10)}). Écraser avec la date du jour (rempli avec Benoit) ?`
        : `Marquer le questionnaire de ${prenom} comme rempli en direct avec Benoit ?`;
      if (!window.confirm(msg)) return;
    }
    const mergedForm = {
      ...(client.form || {}),
      benoitQuestionnaireFilledAt: new Date().toISOString(),
      benoitQuestionnaireFilledBy: 'benoit_live',
    };
    saveClient({ id: client.id, form: mergedForm });
    onRefresh();
    flashFeedback(`Questionnaire ${prenom} marqué comme fait`);
  };

  const handleQuickRelance = (e, client) => {
    e.stopPropagation();
    const prenom = client.prenom || client.form?.prenom || '';
    const msg = `Bonjour ${prenom}, je reviens vers vous pour le suivi de votre programme. Dites-moi quand vous êtes disponible pour la suite.`;
    copyToClipboard(msg, `Relance ${prenom} copiée`);
  };

  const handleQuickNutrition = (e, client) => {
    e.stopPropagation();
    if (typeof onNutrition === 'function') {
      onNutrition(client.id);
    }
  };

  const isSharedWithAnissa = (c) => {
    const f = c.formule || '';
    return (f === 'suivi' || f === 'intensif') && (c.createdBy || 'benoit') !== 'anissa';
  };

  // ─── Séances Benoit V2 : compteurs dans client.form ───
  const persistSessions = (client, nextDone, nextTotal, extraFormFields = {}) => {
    // Clamp
    let total = Number.isFinite(nextTotal) && nextTotal > 0 ? nextTotal : 0;
    let done = Number.isFinite(nextDone) && nextDone > 0 ? nextDone : 0;
    if (total > 0 && done > total) done = total;
    if (done < 0) done = 0;
    // Merge form sans écraser le reste (extraFormFields en dernier = surcharge ciblée)
    const mergedForm = {
      ...(client.form || {}),
      benoitSessionsDone: done,
      benoitSessionsTotal: total || null,
      ...extraFormFields,
    };
    saveClient({ id: client.id, form: mergedForm });
    onRefresh();
    return { done, total };
  };

  const handleSessionIncrement = (e, client) => {
    e.stopPropagation();
    const done = getSessionsDone(client);
    const total = getSessionsTotal(client);
    if (total > 0 && done >= total) {
      flashFeedback(`Maximum atteint (${total})`);
      return;
    }
    // Ajoute la date du jour à l'historique + met à jour lastSessionAt
    const now = new Date().toISOString();
    const currDates = Array.isArray(client.form?.benoitSessionDates) ? client.form.benoitSessionDates : [];
    persistSessions(client, done + 1, total, {
      benoitSessionDates: [...currDates, now],
      benoitLastSessionAt: now,
    });
  };

  const handleSessionDecrement = (e, client) => {
    e.stopPropagation();
    const done = getSessionsDone(client);
    if (done <= 0) return;
    const total = getSessionsTotal(client);
    // Retire la dernière date (pop conservateur). benoitLastSessionAt reflète la nouvelle dernière, ou null.
    const currDates = Array.isArray(client.form?.benoitSessionDates) ? client.form.benoitSessionDates : [];
    const nextDates = currDates.length > 0 ? currDates.slice(0, -1) : [];
    const nextLast = nextDates.length > 0 ? nextDates[nextDates.length - 1] : null;
    persistSessions(client, done - 1, total, {
      benoitSessionDates: nextDates,
      benoitLastSessionAt: nextLast,
    });
  };

  // V24 : handlers commerciaux retirés (déplacés dans BenoitPaymentsPanel) —
  //   handleDefinePack, handleAddSessions, handleNewPack, handleCustomPack, handlePayment
  //   Toute la gestion pack + paiements passe maintenant par l'onglet Paiements.

  // ─── Transmission Anissa V7 ── note libre + résumé auto + save 6 fields
  const handleTransferToAnissa = (e, client) => {
    e.stopPropagation();
    if (typeof window === 'undefined' || !window.prompt) return;
    const prenom = client.prenom || client.form?.prenom || 'client';
    const rawNote = window.prompt(
      `Transmettre ${prenom} à Anissa. Note libre (optionnel) :`,
      client.form?.anissaTransferNotes || ''
    );
    if (rawNote == null) return; // cancel → 0 écriture
    const note = String(rawNote).trim() || null;
    const summary = buildAnissaTransferSummary(client, note);
    const mergedForm = {
      ...(client.form || {}),
      sharedWithAnissa: true,
      referredBy: 'benoit',
      anissaTransferStatus: 'sent',
      anissaTransferAt: new Date().toISOString(),
      anissaTransferNotes: note,
      anissaTransferSummary: summary,
    };
    saveClient({ id: client.id, form: mergedForm });
    onRefresh();
    flashFeedback(`${prenom} transmis(e) à Anissa`);
  };

  // Cycle status après transmission : sent → booked → done → sent
  const handleCycleTransferStatus = (e, client) => {
    e.stopPropagation();
    const current = client.form?.anissaTransferStatus;
    const idx = BENOIT_TRANSFER_CYCLE.indexOf(current);
    const next = BENOIT_TRANSFER_CYCLE[(idx + 1) % BENOIT_TRANSFER_CYCLE.length];
    const mergedForm = { ...(client.form || {}), anissaTransferStatus: next };
    saveClient({ id: client.id, form: mergedForm });
    onRefresh();
    flashFeedback(`Statut : ${BENOIT_TRANSFER_LABELS[next] || next}`);
  };

  // ─── Massothérapie V9 ── handlers
  const handleCycleMassageStatus = (e, client) => {
    e.stopPropagation();
    const current = getMassageStatus(client);
    const idx = MASSAGE_STATUSES.indexOf(current);
    const next = MASSAGE_STATUSES[(idx + 1) % MASSAGE_STATUSES.length];
    const mergedForm = { ...(client.form || {}), massageStatus: next };
    saveClient({ id: client.id, form: mergedForm });
    onRefresh();
    flashFeedback(`Statut masso : ${MASSAGE_STATUS_LABELS[next]}`);
  };

  const handleEditMassageInfo = (e, client) => {
    e.stopPropagation();
    if (typeof window === 'undefined' || !window.prompt) return;
    const f = client.form || {};
    const rawIssue = window.prompt('Zone / problème principal (ex: lombaires, cervicales) :', f.massageMainIssue || '');
    if (rawIssue == null) return;
    const rawGoal = window.prompt('Objectif masso (ex: douleur chronique, récupération) :', f.massageMainGoal || '');
    if (rawGoal == null) return;
    const rawFreq = window.prompt('Fréquence (ex: 1x/semaine, 1x/mois) :', f.massageFrequency || '');
    if (rawFreq == null) return;
    const mergedForm = {
      ...(client.form || {}),
      massageMainIssue: String(rawIssue).trim() || null,
      massageMainGoal: String(rawGoal).trim() || null,
      massageFrequency: String(rawFreq).trim() || null,
    };
    saveClient({ id: client.id, form: mergedForm });
    onRefresh();
    flashFeedback('Infos masso mises à jour');
  };

  // ─── Note rapide séance V4 ── mini-prompt, datée du jour, aucun effet sur done/total
  const handleAddSessionNote = (e, client) => {
    e.stopPropagation();
    const prenom = client.prenom || client.form?.prenom || 'client';
    const raw = (typeof window !== 'undefined' && window.prompt)
      ? window.prompt(`Note de séance pour ${prenom} :`, '')
      : '';
    if (raw == null) return;
    const note = String(raw).trim();
    if (!note) return;
    const entry = { date: new Date().toISOString(), note };
    const prevNotes = Array.isArray(client.form?.benoitSessionNotes) ? client.form.benoitSessionNotes : [];
    const mergedForm = {
      ...(client.form || {}),
      benoitSessionNotes: [...prevNotes, entry],
    };
    saveClient({ id: client.id, form: mergedForm });
    onRefresh();
    flashFeedback(`Note ajoutée pour ${prenom}`);
  };

  let filtered = clients;
  if (search.trim()) {
    const q = search.toLowerCase().trim();
    filtered = filtered.filter(c => (c.prenom || '').toLowerCase().includes(q));
  }
  if (filterCategory !== 'all') filtered = filtered.filter(c => (c.categorie || 'online') === filterCategory);
  if (filterFormule !== 'all') filtered = filtered.filter(c => c.formule === filterFormule);
  if (filterStatus !== 'all') filtered = filtered.filter(c => (c.status || 'nouveau') === filterStatus);
  if (filterLang !== 'all') filtered = filtered.filter(c => (c.langue || 'FR') === filterLang);

  // ─── Filtre Benoit V2 ───
  if (filterBenoit !== 'all') {
    filtered = filtered.filter(c => {
      const types = alertsByClient.get(c.id) || new Set();
      const done = getSessionsDone(c);
      const total = getSessionsTotal(c);
      switch (filterBenoit) {
        case 'relance':
          return (c.status || 'nouveau') === 'relance'
            || types.has('benoit_client_inactive')
            || types.has('benoit_pack_almost_done');
        case 'inactive':
          return types.has('benoit_client_inactive');
        case 'pack_almost':
          return types.has('benoit_pack_almost_done')
            || (total > 0 && (total - done) <= 2 && done < total);
        case 'pack_done':
          return types.has('benoit_pack_completed')
            || (total > 0 && done >= total);
        case 'shared':
          return isSharedWithAnissaClient(c);
        case 'no_dossier':
          return !c.latestSections;
        case 'with_sessions':
          return done > 0;
        case 'no_sessions':
          return done === 0;
        case 'pay_pending':
          return getPaymentStatus(c) === 'pending';
        case 'pay_partial':
          return getPaymentStatus(c) === 'partial';
        case 'pay_paid':
          return getPaymentStatus(c) === 'paid';
        default:
          return true;
      }
    });
  }

  // ─── Tri Benoit V2 ───
  // Nouvelle copie pour ne pas muter clients
  filtered = [...filtered];
  switch (sortBenoit) {
    case 'alpha':
      filtered.sort((a, b) => (a.prenom || '').localeCompare(b.prenom || '', 'fr', { sensitivity: 'base' }));
      break;
    case 'priority': {
      filtered.sort((a, b) => {
        const ra = priorityRank(a, alertsByClient.get(a.id) || new Set());
        const rb = priorityRank(b, alertsByClient.get(b.id) || new Set());
        if (ra !== rb) return ra - rb;
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      });
      break;
    }
    case 'pack_advanced': {
      filtered.sort((a, b) => {
        const ra = packRatio(a);
        const rb = packRatio(b);
        if (ra === rb) return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        // -1 (inconnu) toujours en fin
        if (ra < 0) return 1;
        if (rb < 0) return -1;
        return rb - ra;
      });
      break;
    }
    case 'pack_least': {
      filtered.sort((a, b) => {
        const ra = packRatio(a);
        const rb = packRatio(b);
        if (ra === rb) return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        if (ra < 0) return 1;
        if (rb < 0) return -1;
        return ra - rb;
      });
      break;
    }
    case 'recent':
    default:
      // clients est déjà trié par createdAt desc via getClients() ; on ne touche pas
      break;
  }

  // Stats
  const totalClients = clients.length;

  // V26 : total impayés = somme des restes dus (price - paid) pour clients avec pending/partial
  const totalUnpaid = useMemo(() => {
    let sum = 0;
    for (const c of clients) {
      if ((c?.createdBy || 'benoit') === 'anissa') continue;
      const price = getPackPrice(c);
      const paid = getTotalPaid(c);
      if (price != null && price > 0 && paid != null && paid < price) {
        sum += (price - paid);
      }
    }
    return Math.round(sum);
  }, [clients]);
  const onlineCount = clients.filter(c => (c.categorie || 'online') === 'online').length;
  const presentielCount = clients.filter(c => c.categorie === 'presentiel').length;
  const massageCount = clients.filter(c => c.categorie === 'massage').length;
  const withNutrition = clients.filter(c => getNutritionConsultations(c.id).length > 0).length;
  const totalGenerations = clients.reduce((sum, c) => sum + (c.history?.length || 0), 0);
  const now = new Date();
  const thisMonthClients = clients.filter(c => {
    const d = new Date(c.createdAt);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  return (
    <div className="dashboard">
      {/* V20 : CSS mobile-first app-like — injecté localement */}
      <style>{`
        .mobile-header {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-bottom: 16px;
        }
        .mobile-header-row {
          display: flex;
          gap: 10px;
          align-items: center;
        }
        .mobile-search {
          flex: 1;
          padding: 12px 14px;
          border-radius: 12px;
          border: 1px solid rgba(196,160,80,0.25);
          background: rgba(196,160,80,0.06);
          color: var(--text);
          font-size: 1em;
          min-height: 48px;
        }
        .mobile-icon-btn {
          position: relative;
          min-width: 48px;
          min-height: 48px;
          padding: 8px 12px;
          border-radius: 12px;
          background: rgba(196,160,80,0.06);
          border: 1px solid rgba(196,160,80,0.25);
          color: var(--text);
          cursor: pointer;
          font-size: 1.15em;
        }
        .mobile-icon-btn .mobile-badge {
          position: absolute;
          top: -5px; right: -5px;
          min-width: 20px; height: 20px; padding: 0 6px;
          border-radius: 10px;
          background: #c43050; color: #fff;
          font-size: 0.72em; font-weight: 700;
          display: inline-flex; align-items: center; justify-content: center;
          box-shadow: 0 2px 6px rgba(196,48,80,0.4);
        }
        .mobile-sort {
          padding: 10px 12px;
          border-radius: 12px;
          border: 1px solid rgba(196,160,80,0.25);
          background: rgba(196,160,80,0.06);
          color: var(--text);
          font-size: 0.95em;
          min-height: 48px;
          flex: 1;
        }
        .mobile-filter-btn {
          min-height: 48px;
          padding: 10px 16px;
          border-radius: 12px;
          background: rgba(196,160,80,0.1);
          border: 1px solid rgba(196,160,80,0.35);
          color: #c4a050;
          font-size: 0.95em;
          font-weight: 600;
          cursor: pointer;
        }
        .filters-drawer-overlay {
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.6);
          z-index: 500;
          display: flex; align-items: flex-end; justify-content: center;
        }
        .filters-drawer {
          width: 100%;
          max-width: 600px;
          max-height: 88vh;
          overflow-y: auto;
          background: #1e1b16;
          border-top-left-radius: 20px;
          border-top-right-radius: 20px;
          padding: 20px 18px 18px;
          box-shadow: 0 -10px 40px rgba(0,0,0,0.55);
          animation: slide-up 0.22s ease-out;
        }
        @keyframes slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .filters-drawer::before {
          content: '';
          display: block;
          width: 44px; height: 4px;
          background: rgba(196,160,80,0.3);
          border-radius: 4px;
          margin: 0 auto 14px;
        }
        .filters-drawer-header {
          display: flex; justify-content: space-between; align-items: center;
          margin-bottom: 14px; padding-bottom: 12px;
          border-bottom: 1px solid rgba(196,160,80,0.2);
        }
        .filters-drawer-footer {
          display: flex; gap: 10px; margin-top: 18px;
          padding-top: 14px; border-top: 1px solid rgba(196,160,80,0.2);
          position: sticky; bottom: -18px; background: #1e1b16; padding-bottom: 10px;
        }
        .filters-drawer .filter-group { margin-bottom: 16px; }
        .filters-drawer .filter-pills { flex-wrap: wrap; gap: 8px; }
        .filters-drawer .filter-pill { min-height: 40px; padding: 8px 14px !important; }

        /* Mobile-first card polish (≤ 430px) */
        @media (max-width: 430px) {
          .dashboard { padding: 12px 10px !important; }
          .stats-row { display: none !important; }
          .dashboard-header { gap: 8px; }
          .dashboard-header h2 { font-size: 1.15em !important; }
          .benoit-alerts-bell, .benoit-alerts-badge { display: none !important; }
          .client-grid { grid-template-columns: 1fr !important; gap: 14px !important; }
          .client-card { padding: 16px !important; border-radius: 14px !important; }
          .client-card-name { font-size: 1.15em !important; }
          .client-card-formula { font-size: 0.92em !important; margin-top: 4px !important; }
          .client-card-next-action { min-height: 48px; font-size: 0.92em !important; padding: 10px 14px !important; }
          .client-card-minimal-actions {
            gap: 10px !important;
            justify-content: space-around !important;
            margin-top: 12px !important;
            padding-top: 10px !important;
          }
          .client-card-minimal-actions button {
            min-height: 48px !important;
            flex: 1;
            padding: 10px !important;
            font-size: 1.05em !important;
          }
          .client-card-quick-actions button { min-height: 44px !important; padding: 10px 14px !important; font-size: 0.85em !important; }
          .client-card-critical-pills { gap: 8px !important; }
          .client-card-critical-pills > * { padding: 4px 10px !important; font-size: 0.78em !important; }
          .client-card-details summary { padding: 10px 0 !important; font-size: 0.82em !important; }
        }
      `}</style>
      {/* Stats */}
      <div className="stats-row stats-row-4">
        <div className="stat-card benoit-stat">
          <span className="stat-number">{totalClients}</span>
          <span className="stat-label">Total clients</span>
        </div>
        <div className="stat-card benoit-stat">
          <span className="stat-number">{onlineCount}</span>
          <span className="stat-label">Coaching Online</span>
        </div>
        <div className="stat-card benoit-stat">
          <span className="stat-number">{presentielCount}</span>
          <span className="stat-label">Coaching Presentiel</span>
        </div>
        <div className="stat-card benoit-stat">
          <span className="stat-number">{massageCount}</span>
          <span className="stat-label">Massotherapie</span>
        </div>
      </div>
      <div className="stats-row stats-row-3">
        <div className="stat-card benoit-stat">
          <span className="stat-number">{withNutrition}</span>
          <span className="stat-label">Consultations Anissa</span>
        </div>
        <div className="stat-card benoit-stat">
          <span className="stat-number">{totalGenerations}</span>
          <span className="stat-label">Generations IA</span>
        </div>
        <div className="stat-card benoit-stat">
          <span className="stat-number">{thisMonthClients}</span>
          <span className="stat-label">Ce mois-ci</span>
        </div>
      </div>
      {/* V26 : stat impayés (agrège tous les clients avec price > paid) */}
      {totalUnpaid > 0 && (
        <div className="stats-row stats-row-1" style={{ marginTop: 12 }}>
          <div className="stat-card benoit-stat" style={{
            background: 'rgba(196,48,80,0.08)',
            border: '1px solid rgba(196,48,80,0.3)',
          }}>
            <span className="stat-number" style={{ color: '#c43050' }}>{totalUnpaid} CHF</span>
            <span className="stat-label">À encaisser</span>
          </div>
        </div>
      )}

      <div className="dashboard-header" style={{ position: 'relative' }}>
        <h2>Mes clients</h2>
        <span className="dashboard-count">
          {filtered.length}{filtered.length !== clients.length ? ` / ${clients.length}` : ''} client{filtered.length !== 1 ? 's' : ''}
        </span>
        {totalBenoitCount > 0 && (
          <span
            className="benoit-alerts-badge"
            title={`${totalBenoitCount} alerte${totalBenoitCount > 1 ? 's' : ''} Benoit (${unreadBenoitCount} non lue${unreadBenoitCount !== 1 ? 's' : ''})`}
            style={{
              marginLeft: 12,
              padding: '4px 10px',
              borderRadius: 12,
              background: unreadBenoitCount > 0 ? '#c4305022' : '#c4a05022',
              color: unreadBenoitCount > 0 ? '#c43050' : '#c4a050',
              border: `1px solid ${unreadBenoitCount > 0 ? '#c4305055' : '#c4a05055'}`,
              fontSize: '0.85em',
              fontWeight: 600,
            }}
          >
            ⚠ {totalBenoitCount} alerte{totalBenoitCount > 1 ? 's' : ''}
            {unreadBenoitCount > 0 && totalBenoitCount !== unreadBenoitCount ? ` (${unreadBenoitCount} nouv.)` : ''}
          </span>
        )}
        {/* V18 : Cloche alertes Benoit (calcul live multi-sources) — masquée car redondante avec la cloche du header mobile (toujours présente) */}
        <button
          type="button"
          className="benoit-alerts-bell"
          onClick={() => setAlertsBellOpen(v => !v)}
          title={bellAlerts.length === 0 ? 'Aucune alerte Benoit' : `${bellAlerts.length} alerte${bellAlerts.length > 1 ? 's' : ''} Benoit`}
          style={{
            display: 'none',
            marginLeft: 'auto', position: 'relative',
            background: 'transparent', border: '1px solid rgba(196,160,80,0.3)',
            borderRadius: 20, padding: '4px 12px',
            cursor: 'pointer', fontSize: '1em',
          }}
        >
          🔔
          {bellAlerts.length > 0 && (
            <span style={{
              position: 'absolute', top: -4, right: -4,
              minWidth: 18, height: 18, padding: '0 5px',
              borderRadius: 9, background: '#c43050', color: '#fff',
              fontSize: '0.7em', fontWeight: 700,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}>{bellAlerts.length}</span>
          )}
        </button>
        {false && alertsBellOpen && (
          <div
            className="benoit-alerts-popover"
            onClick={e => e.stopPropagation()}
            style={{
              position: 'absolute', top: 'calc(100% + 8px)', right: 0,
              width: 340, maxHeight: 420, overflowY: 'auto',
              background: '#1e1b16',
              border: '1px solid rgba(196,160,80,0.35)',
              borderRadius: 10,
              boxShadow: '0 10px 30px rgba(0,0,0,0.45)',
              zIndex: 100,
              padding: 8,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px 8px', borderBottom: '1px solid rgba(196,160,80,0.2)', marginBottom: 6 }}>
              <strong style={{ fontSize: '.85em', color: '#c4a050' }}>🔔 Alertes Benoit ({bellAlerts.length})</strong>
              <button type="button" onClick={() => setAlertsBellOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1em' }}>✕</button>
            </div>
            {renderGroupedAlerts(true)}
          </div>
        )}
      </div>

      {/* V19 : header compact mobile-first (recherche + cloche + filtres + tri) */}
      <div className="mobile-header">
        <div className="mobile-header-row">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="🔍 Rechercher..."
            className="mobile-search"
          />
          <button
            type="button"
            className="mobile-icon-btn"
            onClick={() => setAlertsBellOpen(v => !v)}
            title={bellAlerts.length === 0 ? 'Aucune alerte' : `${bellAlerts.length} alerte${bellAlerts.length > 1 ? 's' : ''}`}
          >
            🔔
            {bellAlerts.length > 0 && <span className="mobile-badge">{bellAlerts.length}</span>}
          </button>
        </div>
        <div className="mobile-header-row">
          <button
            type="button"
            className="mobile-filter-btn"
            onClick={() => setFiltersDrawerOpen(true)}
          >
            ⚙️ Filtres{activeFiltersCount > 0 ? ` (${activeFiltersCount})` : ''}
          </button>
          <select
            className="mobile-sort"
            value={sortBenoit}
            onChange={e => setSortBenoit(e.target.value)}
            aria-label="Trier"
          >
            {BENOIT_SORTS.map(s => (
              <option key={s.value} value={s.value}>⏷ {s.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* V19 : popover alertes ancrée sous le header mobile (partage state avec la cloche header) */}
      {alertsBellOpen && (
        <div
          className="filters-drawer-overlay"
          onClick={() => setAlertsBellOpen(false)}
          style={{ background: 'rgba(0,0,0,0.45)' }}
        >
          <div
            className="filters-drawer"
            onClick={e => e.stopPropagation()}
            style={{ maxHeight: '70vh' }}
          >
            <div className="filters-drawer-header">
              <strong style={{ fontSize: '0.95em', color: '#c4a050' }}>🔔 Alertes Benoit ({bellAlerts.length})</strong>
              <button type="button" onClick={() => setAlertsBellOpen(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.1em' }}>✕</button>
            </div>
            {renderGroupedAlerts(false)}
          </div>
        </div>
      )}

      {/* V19 : Drawer filtres (remplace .filters-section du flow principal) */}
      {filtersDrawerOpen && (
        <div
          className="filters-drawer-overlay"
          onClick={() => setFiltersDrawerOpen(false)}
        >
          <div
            className="filters-drawer"
            onClick={e => e.stopPropagation()}
          >
            <div className="filters-drawer-header">
              <strong style={{ fontSize: '1em', color: '#c4a050' }}>⚙️ Filtres{activeFiltersCount > 0 ? ` (${activeFiltersCount})` : ''}</strong>
              <button type="button" onClick={() => setFiltersDrawerOpen(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2em' }}>✕</button>
            </div>

            <div className="filter-group">
              <span className="filter-label">Categorie</span>
              <div className="filter-pills">
                {CATEGORY_FILTERS.map(f => (
                  <button key={f.value} className={`filter-pill ${filterCategory === f.value ? 'filter-pill-active' : ''}`}
                    onClick={() => setFilterCategory(filterCategory === f.value ? 'all' : f.value)}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            {filterCategory !== 'massage' && (
              <div className="filter-group">
                <span className="filter-label">Formule</span>
                <div className="filter-pills">
                  {FORMULE_FILTERS.map(f => (
                    <button key={f.value} className={`filter-pill ${filterFormule === f.value ? 'filter-pill-active' : ''}`}
                      onClick={() => setFilterFormule(filterFormule === f.value ? 'all' : f.value)}>
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="filter-group">
              <span className="filter-label">Statut</span>
              <div className="filter-pills">
                {STATUS_FILTERS.map(f => (
                  <button key={f.value} className={`filter-pill ${filterStatus === f.value ? 'filter-pill-active' : ''}`}
                    onClick={() => setFilterStatus(filterStatus === f.value ? 'all' : f.value)}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="filter-group">
              <span className="filter-label">Langue</span>
              <div className="filter-pills">
                {LANG_FILTERS.map(f => (
                  <button key={f.value} className={`filter-pill ${filterLang === f.value ? 'filter-pill-active' : ''}`}
                    onClick={() => setFilterLang(filterLang === f.value ? 'all' : f.value)}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="filter-group">
              <span className="filter-label">Benoit</span>
              <div className="filter-pills">
                {BENOIT_FILTERS.map(f => (
                  <button
                    key={f.value}
                    className={`filter-pill ${filterBenoit === f.value ? 'filter-pill-active' : ''}`}
                    onClick={() => setFilterBenoit(filterBenoit === f.value ? 'all' : f.value)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="filters-drawer-footer">
              <button
                type="button"
                onClick={() => { resetAllFilters(); }}
                style={{
                  flex: 1, padding: '12px', borderRadius: 10,
                  background: 'transparent', border: '1px solid rgba(196,160,80,0.3)',
                  color: '#c4a050', fontWeight: 600, cursor: 'pointer', minHeight: 44,
                }}
              >Reset</button>
              <button
                type="button"
                onClick={() => setFiltersDrawerOpen(false)}
                style={{
                  flex: 2, padding: '12px', borderRadius: 10,
                  background: '#c4a050', border: '1px solid #c4a050',
                  color: '#1e1b16', fontWeight: 700, cursor: 'pointer', minHeight: 44,
                }}
              >Appliquer</button>
            </div>
          </div>
        </div>
      )}

      {actionFeedback && (
        <div
          role="status"
          style={{
            position: 'fixed',
            bottom: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '8px 16px',
            borderRadius: 8,
            background: '#2e8b57',
            color: '#fff',
            fontWeight: 600,
            fontSize: '0.85em',
            zIndex: 9999,
            boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
          }}
        >
          ✓ {actionFeedback}
        </div>
      )}

      {clients.length === 0 ? (
        <div className="dashboard-empty">
          <img src={LOGO_URL} alt="" className="empty-logo" />
          <div className="empty-title">Aucun client encore</div>
          <p>Commencez votre premier onboarding premium</p>
          <button className="btn btn-primary" onClick={() => onNew()}>Creer mon premier client</button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="dashboard-empty">
          <p>Aucun client ne correspond aux filtres.</p>
        </div>
      ) : (
        <div className="client-grid">
          {filtered.map((client, i) => {
            const status = STATUS_LABELS[client.status] || STATUS_LABELS.nouveau;
            const historyCount = client.history?.length || 0;
            const progressCount = client.progression?.length || 0;
            const sessionCount = client.massageSessions?.length || 0;

            return (
              <div
                key={client.id}
                className="client-card"
                onClick={() => onOpen(client.id)}
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className="client-card-top">
                  <div className="client-avatar">{getInitial(client.prenom)}</div>
                  <div className="client-card-info">
                    <div className="client-card-name">
                      {client.prenom || 'Sans nom'}
                      <span className="client-card-lang">{client.langue || 'FR'}</span>
                    </div>
                    {(() => {
                      // Ligne pack compacte : Pack label · done/total si compteur, sinon formule classique
                      const done = getSessionsDone(client);
                      const total = getSessionsTotal(client);
                      const hasCounter = total > 0 || done > 0;
                      const primary = hasCounter ? buildPackHeader(client) : getFormulaDisplay(client);
                      return <div className="client-card-formula">{primary}</div>;
                    })()}
                    {(() => {
                      // Une seule ligne complémentaire : dernière séance (coaching) ou dernière masso
                      const lastSession = client.categorie === 'massage'
                        ? formatRelativeDay(getLastMassageISO(client))
                        : formatRelativeDay(getLastSessionISO(client));
                      if (!lastSession) return null;
                      const label = client.categorie === 'massage' ? 'Dernière masso' : 'Dernière séance';
                      return (
                        <div style={{ fontSize: '0.75em', color: 'rgba(212,201,168,0.6)', marginTop: 2 }}>
                          {label} : {lastSession}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {(() => {
                  const next = getNextClientAction(client);
                  if (!next) return null;
                  const dispatch = (e) => {
                    if (next.type === 'questionnaire') return handleQuickQuestionnaire(e, client);
                    if (next.type === 'transfer')      return handleTransferToAnissa(e, client);
                  };
                  return (
                    <button
                      type="button"
                      className="client-card-next-action"
                      onClick={dispatch}
                      title={`Prochaine action recommandée · ${next.label}`}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        width: '100%', marginTop: 8,
                        padding: '6px 10px',
                        background: 'rgba(196,160,80,0.1)',
                        color: '#c4a050',
                        border: '1px solid rgba(196,160,80,0.35)',
                        borderRadius: 8,
                        fontSize: '0.8em', fontWeight: 600,
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <span>👉 Action : {next.label}</span>
                      <span style={{ opacity: 0.6, fontSize: '0.9em' }}>→</span>
                    </button>
                  );
                })()}

                {/* Rangée critiques (max 3 pills priorisées) */}
                {(() => {
                  const types = alertsByClient.get(client.id) || new Set();
                  const critical = [];
                  // Priorité 1 : alertes urgentes
                  if (types.has('benoit_pack_completed')) {
                    critical.push(
                      <span key="done" title="Pack terminé"
                        style={{ padding: '2px 8px', borderRadius: 10, background: '#2e8b5722', color: '#2e8b57', border: '1px solid #2e8b5755', fontSize: '0.75em', fontWeight: 600 }}>
                        ✓ Pack fini
                      </span>
                    );
                  } else if (types.has('benoit_pack_almost_done')) {
                    critical.push(
                      <span key="almost" title="Pack presque terminé"
                        style={{ padding: '2px 8px', borderRadius: 10, background: '#c4a05022', color: '#c4a050', border: '1px solid #c4a05055', fontSize: '0.75em', fontWeight: 600 }}>
                        ⏳ Pack presque fini
                      </span>
                    );
                  }
                  if (types.has('benoit_client_inactive')) {
                    critical.push(
                      <span key="inactive" title="Aucune activité récente"
                        style={{ padding: '2px 8px', borderRadius: 10, background: '#c4305022', color: '#c43050', border: '1px solid #c4305055', fontSize: '0.75em', fontWeight: 600 }}>
                        💤 Inactif
                      </span>
                    );
                  }
                  if (client.categorie === 'massage' && isMassageRelance(client)) {
                    critical.push(
                      <span key="masso-relance" title={`Plus de ${MASSAGE_RELANCE_DAYS} jours sans séance massage`}
                        style={{ padding: '2px 8px', borderRadius: 10, background: '#c4305022', color: '#c43050', border: '1px solid #c4305055', fontSize: '0.75em', fontWeight: 600 }}>
                        ⚠ Masso à relancer
                      </span>
                    );
                  }
                  // Priorité 2 : transmission Anissa
                  if (client.form?.sharedWithAnissa) {
                    const st = client.form?.anissaTransferStatus;
                    const lbl = BENOIT_TRANSFER_LABELS[st] || '🥗 Anissa';
                    critical.push(
                      <button
                        key="transfer"
                        type="button"
                        onClick={e => handleCycleTransferStatus(e, client)}
                        title={`Cliquer pour cycler : sent → booked → done. Transmis le ${client.form?.anissaTransferAt ? new Date(client.form.anissaTransferAt).toLocaleDateString('fr-CH') : '—'}`}
                        style={{ padding: '2px 8px', borderRadius: 10, background: '#6abf8a22', color: '#6abf8a', border: '1px solid #6abf8a55', fontSize: '0.75em', fontWeight: 600, cursor: 'pointer' }}
                      >
                        🥗 {lbl}
                      </button>
                    );
                  }
                  // Priorité 3 : paiement non-final
                  const payStatus = getPaymentStatus(client);
                  if (payStatus === 'pending' || payStatus === 'partial') {
                    const c = BENOIT_PAYMENT_COLORS[payStatus];
                    const paid = getTotalPaid(client);
                    const price = getPackPrice(client);
                    const tooltip = price != null ? `${paid != null ? paid : 0} / ${price} CHF` : 'Statut paiement';
                    critical.push(
                      <span key="pay" title={tooltip}
                        style={{ padding: '2px 8px', borderRadius: 10, background: c.bg, color: c.fg, border: `1px solid ${c.border}`, fontSize: '0.75em', fontWeight: 600 }}>
                        💰 {BENOIT_PAYMENT_LABELS[payStatus]}
                      </span>
                    );
                  }
                  const visible = critical.slice(0, isMobile ? 2 : 3);
                  return (
                    <div
                      className="client-card-critical-pills"
                      style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}
                      onClick={e => e.stopPropagation()}
                    >
                      {getCategoryBadge(client.categorie)}
                      {visible}
                    </div>
                  );
                })()}

                {/* Rangée actions minimales toujours visibles : −1, +1, 💰, 🥗 */}
                <div
                  className="client-card-minimal-actions"
                  onClick={e => e.stopPropagation()}
                  style={{
                    display: 'flex', gap: 6, marginTop: 8,
                    paddingTop: 6, borderTop: '1px dashed rgba(196,160,80,0.15)',
                  }}
                >
                  {(() => {
                    const done = getSessionsDone(client);
                    const total = getSessionsTotal(client);
                    return (
                      <>
                        <button
                          type="button"
                          className="btn btn-xs btn-secondary"
                          onClick={e => handleSessionDecrement(e, client)}
                          disabled={done <= 0}
                          title="Retirer une séance"
                          style={{ fontSize: '0.85em', padding: '3px 10px', minWidth: 34 }}
                        >−1</button>
                        <button
                          type="button"
                          className="btn btn-xs btn-secondary"
                          onClick={e => handleSessionIncrement(e, client)}
                          disabled={total > 0 && done >= total}
                          title={total > 0 && done >= total ? 'Pack terminé' : 'Ajouter une séance'}
                          style={{ fontSize: '0.85em', padding: '3px 10px', minWidth: 34 }}
                        >+1</button>
                      </>
                    );
                  })()}
                  <button
                    type="button"
                    className="btn btn-xs btn-secondary"
                    onClick={e => handleTransferToAnissa(e, client)}
                    title={client.form?.sharedWithAnissa ? 'Renvoyer à Anissa (mettre à jour)' : 'Transmettre à Anissa'}
                    style={{ fontSize: '0.95em', padding: '3px 10px', minWidth: 34 }}
                  >🥗</button>
                </div>

                {/* Zone détails repliable — infos secondaires, pills non critiques, actions complètes */}
                <details
                  className="client-card-details"
                  onClick={e => e.stopPropagation()}
                  style={{ marginTop: 8 }}
                >
                  <summary
                    style={{
                      cursor: 'pointer',
                      fontSize: '0.75em',
                      color: 'rgba(212,201,168,0.7)',
                      userSelect: 'none',
                      padding: '4px 0',
                      listStyle: 'none',
                    }}
                  >
                    ▸ Détails (pack, checklist, paiements, actions)
                  </summary>

                  {/* Autres pills : questionnaire, masso statut, checklist */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                    {client.form?.benoitQuestionnaireFilledAt && (() => {
                      const by = client.form?.benoitQuestionnaireFilledBy;
                      const label = by === 'client' ? '📝 Par client'
                        : by === 'benoit_live' ? '📝 Par Benoit'
                        : '📝 Rempli';
                      const when = client.form.benoitQuestionnaireFilledAt.slice(0,10);
                      return (
                        <span
                          key="q-filled"
                          title={`Questionnaire rempli le ${when}${by ? ` (${by === 'client' ? 'par client' : 'avec Benoit'})` : ''}`}
                          style={{ padding: '2px 8px', borderRadius: 10, background: 'rgba(74,144,217,.12)', color: '#6ab6f0', border: '1px solid rgba(74,144,217,.35)', fontSize: '0.72em', fontWeight: 600 }}
                        >{label}</span>
                      );
                    })()}
                    {client.categorie === 'massage' && (() => {
                      const status = getMassageStatus(client);
                      if (!status) return null;
                      const c = MASSAGE_STATUS_COLORS[status];
                      return (
                        <button
                          key="masso-status"
                          type="button"
                          onClick={e => handleCycleMassageStatus(e, client)}
                          title="Cliquer pour cycler : amélioration → stable → aggravation"
                          style={{ padding: '2px 8px', borderRadius: 10, background: c.bg, color: c.fg, border: `1px solid ${c.border}`, fontSize: '0.75em', fontWeight: 600, cursor: 'pointer' }}
                        >💆 {MASSAGE_STATUS_LABELS[status]}</button>
                      );
                    })()}
                    {(() => {
                      const checklist = buildClientChecklist(client);
                      if (checklist.length === 0) return null;
                      const doneCount = checklist.filter(s => s.done).length;
                      const total = checklist.length;
                      const tooltip = checklist.map(s => {
                        const base = `${s.done ? '✓' : '○'} ${s.label}`;
                        if (s.key === 'questionnaire' && s.done && s.meta) {
                          const who = s.meta === 'client' ? 'par client'
                            : s.meta === 'benoit_live' ? 'avec Benoit' : null;
                          return who ? `${base} (${who})` : base;
                        }
                        return base;
                      }).join('\n');
                      const allDone = doneCount === total;
                      return (
                        <span
                          key="checklist"
                          className="client-card-checklist"
                          title={tooltip}
                          style={{ padding: '2px 8px', borderRadius: 10, background: allDone ? '#2e8b5722' : '#c4a05022', color: allDone ? '#2e8b57' : '#c4a050', border: `1px solid ${allDone ? '#2e8b5755' : '#c4a05055'}`, fontSize: '0.75em', fontWeight: 600, cursor: 'help' }}
                        >{allDone ? '✅' : '📋'} {doneCount}/{total}</span>
                      );
                    })()}
                  </div>

                  {/* Bloc masso détaillé — "Dernière masso" déjà en surface dans le header, évité ici pour éviter le doublon */}
                  {client.categorie === 'massage' && (() => {
                    const summary = buildMassageSummary(client);
                    const freq = client.form?.massageFrequency;
                    if (!summary && !freq) return null;
                    return (
                      <div
                        className="client-card-massage"
                        style={{
                          marginTop: 8, paddingTop: 6,
                          borderTop: '1px dashed rgba(74,144,217,0.25)',
                          fontSize: '0.78em', color: '#9ab4d0', lineHeight: 1.5,
                        }}
                      >
                        {summary && <div>💆 {summary}</div>}
                        {freq && <div style={{ color: 'rgba(154,180,208,0.65)', fontSize: '0.95em' }}>Fréquence : {freq}</div>}
                      </div>
                    );
                  })()}

                  {/* Note séance + résumé paiement (boutons commerciaux déplacés vers onglet Paiements) */}
                  {(() => {
                    return (
                      <div
                        className="client-card-sessions"
                        style={{
                          display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4,
                          marginTop: 8, paddingTop: 6,
                          borderTop: '1px dashed rgba(196,160,80,0.2)',
                          fontSize: '0.75em',
                        }}
                      >
                        <button type="button" className="btn btn-xs btn-secondary"
                          onClick={e => handleAddSessionNote(e, client)}
                          title="Ajouter une note rapide"
                          style={{ fontSize: '0.7em', padding: '2px 6px' }}>📝 Note séance</button>
                        <span
                          style={{ flexBasis: '100%', fontSize: '0.9em', color: 'rgba(212,201,168,0.6)', fontStyle: 'italic', marginTop: 4 }}
                        >
                          ℹ Pack &amp; paiements → onglet <strong>Paiements</strong>
                        </span>
                        {(() => {
                          const paid = getTotalPaid(client);
                          const price = getPackPrice(client);
                          const status = getPaymentStatus(client);
                          const note = client.form?.benoitPaymentNote;
                          const payments = Array.isArray(client.form?.benoitPayments) ? client.form.benoitPayments : [];
                          if (paid == null && price == null && status == null && !note && payments.length === 0) return null;
                          const money = paid != null && price != null ? `${paid} / ${price} CHF`
                            : price != null ? `${price} CHF`
                            : paid != null ? `${paid} CHF encaissés`
                            : null;
                          const parts = [];
                          if (money) parts.push(money);
                          // Évite le doublon : le statut pending/partial est déjà visible en pill critique en surface.
                          // On ne l'affiche ici que pour 'paid' (pas de pill surface dans ce cas).
                          if (status === 'paid') parts.push(BENOIT_PAYMENT_LABELS[status]);
                          if (payments.length > 0) parts.push(`${payments.length} paiement${payments.length > 1 ? 's' : ''}`);
                          const c = status ? BENOIT_PAYMENT_COLORS[status] : null;
                          return (
                            <span
                              className="client-card-payment"
                              title={note ? `Note : ${note}` : undefined}
                              style={{ flexBasis: '100%', color: c ? c.fg : 'rgba(212,201,168,0.75)', fontWeight: 500, fontSize: '0.9em', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                            >
                              💰 {parts.join(' · ')}
                              {note && <span style={{ opacity: 0.7 }}> · {truncateNote(note, 40)}</span>}
                            </span>
                          );
                        })()}
                        {(() => {
                          const lastNote = getLastSessionNote(client);
                          if (!lastNote?.note) return null;
                          return (
                            <span
                              className="client-card-last-note"
                              title={lastNote.note}
                              style={{ flexBasis: '100%', color: 'rgba(212,201,168,0.7)', fontWeight: 400, fontSize: '0.9em', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                            >Note : {truncateNote(lastNote.note)}</span>
                          );
                        })()}
                      </div>
                    );
                  })()}

                  {/* Quick actions secondaires (Dossier, Copier lien, Q. fait, Relancer, Consultations, Évolution, Anamnèse) */}
                  <div
                    className="client-card-quick-actions"
                    style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8, paddingTop: 6, borderTop: '1px dashed rgba(196,160,80,0.2)' }}
                  >
                    <button type="button" className="btn btn-xs btn-secondary"
                      onClick={e => handleQuickOpenDossier(e, client)}
                      title={client.latestSections ? 'Ouvrir le dossier' : 'Créer le dossier'}
                      style={{ fontSize: '0.72em', padding: '3px 8px' }}>
                      📋 {client.latestSections ? 'Dossier' : 'Créer dossier'}
                    </button>
                    <button type="button" className="btn btn-xs btn-secondary"
                      onClick={e => handleQuickQuestionnaire(e, client)}
                      title="Copier le lien public du questionnaire"
                      style={{ fontSize: '0.72em', padding: '3px 8px' }}>📝 Copier lien</button>
                    <button type="button" className="btn btn-xs btn-secondary"
                      onClick={e => handleMarkQuestionnaireFilled(e, client)}
                      title={client.form?.benoitQuestionnaireFilledAt
                        ? `Déjà marqué fait (${client.form.benoitQuestionnaireFilledBy === 'client' ? 'par client' : 'avec Benoit'})`
                        : 'Marquer le questionnaire comme rempli en direct avec Benoit'}
                      style={{ fontSize: '0.72em', padding: '3px 8px' }}>✅ Q. fait</button>
                    <button type="button" className="btn btn-xs btn-secondary"
                      onClick={e => handleQuickRelance(e, client)}
                      title="Copier un message de relance (presse-papiers)"
                      style={{ fontSize: '0.72em', padding: '3px 8px' }}>✉️ Relancer</button>
                    {isSharedWithAnissa(client) && typeof onNutrition === 'function' && (
                      <button type="button" className="btn btn-xs btn-secondary"
                        onClick={e => handleQuickNutrition(e, client)}
                        title="Voir les consultations nutrition d'Anissa"
                        style={{ fontSize: '0.72em', padding: '3px 8px' }}>🥗 Consultations</button>
                    )}
                    {client.categorie === 'massage' && (
                      <>
                        <button type="button" className="btn btn-xs btn-secondary"
                          onClick={e => handleCycleMassageStatus(e, client)}
                          title="Évolution masso · cycler"
                          style={{ fontSize: '0.72em', padding: '3px 8px' }}>💆 Évolution</button>
                        <button type="button" className="btn btn-xs btn-secondary"
                          onClick={e => handleEditMassageInfo(e, client)}
                          title="Anamnèse masso : zone / objectif / fréquence"
                          style={{ fontSize: '0.72em', padding: '3px 8px' }}>💆 Anamnèse</button>
                      </>
                    )}
                  </div>
                </details>

                <div className="client-card-bottom">
                  <span className="client-card-date">{formatDate(client.createdAt)}</span>
                  <div className="client-card-actions">
                    <button className={`badge ${status.className}`} onClick={e => cycleStatus(e, client)} title="Changer le statut">
                      {status.label}
                    </button>
                    {historyCount > 0 && (
                      <button className="btn btn-xs btn-secondary" onClick={e => { e.stopPropagation(); onHistory(client.id); }}>
                        {historyCount} gen.
                      </button>
                    )}
                    {sessionCount > 0 && (
                      <span className="btn btn-xs btn-secondary" style={{ cursor: 'default' }}>
                        {sessionCount} seance{sessionCount > 1 ? 's' : ''}
                      </span>
                    )}
                    <button className="btn btn-xs btn-danger" onClick={e => handleDelete(e, client.id)}>x</button>
                  </div>
                </div>

                {progressCount > 0 && (
                  <div className="client-card-progress">
                    <div className="client-card-progress-fill" style={{ width: `${Math.min(100, progressCount * 15)}%` }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
