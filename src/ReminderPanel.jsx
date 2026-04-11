/* eslint-disable react-refresh/only-export-components */
import { useState } from 'react';
import {
  getNutritionConsultations,
  getClientReminderFrequency,
  setClientReminderFrequency,
  DEFAULT_REMINDER_MONTHS,
} from './store';

const UPCOMING_WINDOW_DAYS = 14;
const FREQ_OPTIONS = [1, 2, 3, 6];

function formatDate(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function monthsSince(iso) {
  if (!iso) return 0;
  return (new Date() - new Date(iso)) / (1000 * 60 * 60 * 24 * 30.44);
}

// Build the full reminder view for a list of clients. Returns {overdue, upcoming}
// where each item includes the configured frequency (default 3 months).
function buildReminders(clients) {
  const overdue = [];
  const upcoming = [];
  for (const c of clients) {
    const consultations = getNutritionConsultations(c.id);
    if (consultations.length === 0) continue;
    const lastDate = consultations[0].date;
    const freqMonths = getClientReminderFrequency(c.id);
    const dueDate = new Date(lastDate);
    dueDate.setMonth(dueDate.getMonth() + freqMonths);

    const daysUntilDue = Math.ceil((dueDate - new Date()) / (1000 * 60 * 60 * 24));
    const months = monthsSince(lastDate);

    const base = {
      id: c.id,
      prenom: c.prenom || c.form?.prenom || 'Sans nom',
      lastDate,
      freqMonths,
      dueDate: dueDate.toISOString(),
      daysUntilDue,
      monthsSinceLast: Math.floor(months),
    };

    if (daysUntilDue <= 0) {
      // En retard
      overdue.push({
        ...base,
        status: daysUntilDue <= -30 ? 'urgent' : 'overdue',
      });
    } else if (daysUntilDue <= UPCOMING_WINDOW_DAYS) {
      // A venir dans les 14 jours
      upcoming.push({ ...base, status: 'upcoming' });
    }
  }
  overdue.sort((a, b) => a.daysUntilDue - b.daysUntilDue); // plus en retard en premier
  upcoming.sort((a, b) => a.daysUntilDue - b.daysUntilDue);
  return { overdue, upcoming };
}

// Back-compat helper used in App header badge
export function getReminderCount(clients) {
  const { overdue } = buildReminders(clients);
  return overdue.length;
}

export default function ReminderPanel({ clients, onClose, onConsultation, onOpenClient }) {
  const [tab, setTab] = useState('overdue');
  const [version, setVersion] = useState(0); // forces rebuild after freq change
  const { overdue, upcoming } = buildReminders(clients);

  const handleFrequencyChange = (clientId, months) => {
    setClientReminderFrequency(clientId, months);
    setVersion(v => v + 1);
  };

  // Sorted client list for the frequency tab
  const clientsWithConsultations = clients
    .filter(c => getNutritionConsultations(c.id).length > 0)
    .map(c => ({
      id: c.id,
      prenom: c.prenom || c.form?.prenom || 'Sans nom',
      freq: getClientReminderFrequency(c.id),
    }))
    .sort((a, b) => a.prenom.localeCompare(b.prenom));

  const tabs = [
    { id: 'overdue', label: 'En retard', count: overdue.length },
    { id: 'upcoming', label: 'A venir (14j)', count: upcoming.length },
    { id: 'frequencies', label: '⚙️ Frequences', count: null },
  ];

  const renderReminderItem = (r) => (
    <div key={r.id} className="reminder-item">
      <div className="reminder-item-top">
        <span className="reminder-item-name">{r.prenom}</span>
        <span className={`reminder-item-badge reminder-badge-${r.status}`}>
          {r.status === 'urgent' && 'Urgent'}
          {r.status === 'overdue' && 'En retard'}
          {r.status === 'upcoming' && `Dans ${r.daysUntilDue}j`}
        </span>
      </div>
      <div className="reminder-item-date">
        Derniere consultation : {formatDate(r.lastDate)}
      </div>
      <div className="reminder-item-ago">
        {r.daysUntilDue <= 0
          ? `En retard de ${Math.abs(r.daysUntilDue)} jour${Math.abs(r.daysUntilDue) > 1 ? 's' : ''}`
          : `Prevue dans ${r.daysUntilDue} jour${r.daysUntilDue > 1 ? 's' : ''}`}
        {' · '}Frequence : {r.freqMonths} mois
      </div>
      <div className="reminder-item-actions">
        <button className="btn btn-xs btn-anissa-secondary" onClick={() => { onOpenClient(r.id); onClose(); }}>
          Voir la fiche
        </button>
        <button className="btn btn-xs btn-anissa-primary" onClick={() => { onConsultation(r.id); onClose(); }}>
          + Consultation
        </button>
      </div>
    </div>
  );

  return (
    <>
      <div className="reminder-overlay" onClick={onClose} />
      <div className="reminder-panel">
        <div className="reminder-panel-header">
          <h3>Rappels consultations</h3>
          <button className="reminder-panel-close" onClick={onClose}>&times;</button>
        </div>

        <div className="reminder-tabs">
          {tabs.map(t => (
            <button
              key={t.id}
              className={`reminder-tab ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
              {t.count != null && <span className="reminder-tab-count">{t.count}</span>}
            </button>
          ))}
        </div>

        <div className="reminder-list" key={version}>
          {tab === 'overdue' && (
            overdue.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#8a9a8a', fontSize: '.85rem' }}>
                Aucun client en retard.
              </div>
            ) : (
              overdue.map(renderReminderItem)
            )
          )}

          {tab === 'upcoming' && (
            upcoming.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#8a9a8a', fontSize: '.85rem' }}>
                Aucune consultation a venir dans les {UPCOMING_WINDOW_DAYS} prochains jours.
              </div>
            ) : (
              upcoming.map(renderReminderItem)
            )
          )}

          {tab === 'frequencies' && (
            clientsWithConsultations.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#8a9a8a', fontSize: '.85rem' }}>
                Aucun client avec consultation.
              </div>
            ) : (
              <>
                <div className="reminder-freq-hint">
                  Defaut : {DEFAULT_REMINDER_MONTHS} mois. Personnalise la frequence par client.
                </div>
                {clientsWithConsultations.map(c => (
                  <div key={c.id} className="reminder-freq-row">
                    <span className="reminder-freq-name">{c.prenom}</span>
                    <div className="reminder-freq-buttons">
                      {FREQ_OPTIONS.map(m => (
                        <button
                          key={m}
                          className={`reminder-freq-btn ${c.freq === m ? 'active' : ''}`}
                          onClick={() => handleFrequencyChange(c.id, m)}
                        >
                          {m}m
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </>
            )
          )}
        </div>
      </div>
    </>
  );
}
