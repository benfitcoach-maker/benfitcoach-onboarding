import { useState } from 'react';
import { getClient, addMassageSession, deleteMassageSession } from './store';

function formatDate(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function MassageSessionPanel({ clientId, onRefresh }) {
  const client = getClient(clientId);
  const sessions = client?.massageSessions || [];

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    zonesTraitees: '',
    techniques: '',
    observations: '',
    recommandations: '',
  });
  const [expandedId, setExpandedId] = useState(null);

  const handleAdd = () => {
    if (!form.zonesTraitees.trim() && !form.observations.trim()) return;
    addMassageSession(clientId, form);
    setForm({
      date: new Date().toISOString().split('T')[0],
      zonesTraitees: '',
      techniques: '',
      observations: '',
      recommandations: '',
    });
    setShowForm(false);
    onRefresh();
  };

  const handleDelete = (sessionId) => {
    if (confirm('Supprimer cette note de seance ?')) {
      deleteMassageSession(clientId, sessionId);
      onRefresh();
    }
  };

  return (
    <div className="massage-sessions">
      <div className="massage-sessions-header">
        <h3>Historique des seances</h3>
        <span className="massage-sessions-count">{sessions.length} seance{sessions.length !== 1 ? 's' : ''}</span>
        <button className="btn btn-sm btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Annuler' : '+ Nouvelle seance'}
        </button>
      </div>

      {showForm && (
        <div className="massage-session-form">
          <div className="form-grid">
            <div className="field">
              <label>Date</label>
              <input
                type="date"
                value={form.date}
                onChange={e => setForm({ ...form, date: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Zones traitees</label>
              <input
                type="text"
                value={form.zonesTraitees}
                onChange={e => setForm({ ...form, zonesTraitees: e.target.value })}
                placeholder="Ex: lombaires, epaules, cou"
              />
            </div>
            <div className="field full-width">
              <label>Techniques utilisees</label>
              <textarea
                value={form.techniques}
                onChange={e => setForm({ ...form, techniques: e.target.value })}
                rows={2}
                placeholder="Ex: deep tissue, trigger points, stretching..."
              />
            </div>
            <div className="field full-width">
              <label>Observations</label>
              <textarea
                value={form.observations}
                onChange={e => setForm({ ...form, observations: e.target.value })}
                rows={3}
                placeholder="Tensions detectees, reactions du client, progres..."
              />
            </div>
            <div className="field full-width">
              <label>Recommandations</label>
              <textarea
                value={form.recommandations}
                onChange={e => setForm({ ...form, recommandations: e.target.value })}
                rows={2}
                placeholder="Etirements, frequence recommandee, prochain RDV..."
              />
            </div>
          </div>
          <button className="btn btn-primary" onClick={handleAdd} style={{ marginTop: 14 }}>
            Enregistrer la seance
          </button>
        </div>
      )}

      {sessions.length === 0 ? (
        <div className="massage-sessions-empty">
          Aucune seance enregistree. Cliquez sur "+ Nouvelle seance" pour commencer.
        </div>
      ) : (
        <div className="massage-sessions-list">
          {sessions.map(session => (
            <div key={session.id} className="massage-session-card">
              <div
                className="massage-session-card-header"
                onClick={() => setExpandedId(expandedId === session.id ? null : session.id)}
              >
                <span className="massage-session-date">{formatDate(session.date)}</span>
                <span className="massage-session-zones">{session.zonesTraitees}</span>
                <span className="massage-session-toggle">
                  {expandedId === session.id ? 'Fermer' : 'Details'}
                </span>
              </div>
              {expandedId === session.id && (
                <div className="massage-session-card-body">
                  {session.techniques && (
                    <div className="massage-session-field">
                      <strong>Techniques :</strong> {session.techniques}
                    </div>
                  )}
                  {session.observations && (
                    <div className="massage-session-field">
                      <strong>Observations :</strong> {session.observations}
                    </div>
                  )}
                  {session.recommandations && (
                    <div className="massage-session-field">
                      <strong>Recommandations :</strong> {session.recommandations}
                    </div>
                  )}
                  <button
                    className="btn btn-xs btn-danger"
                    onClick={() => handleDelete(session.id)}
                    style={{ marginTop: 10 }}
                  >
                    Supprimer cette seance
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
