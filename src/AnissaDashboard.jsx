import { useState } from 'react';
import { FORMULES, CATEGORIES } from './formSteps';
import { getNutritionConsultations, deleteClient } from './store';

function SendQuestionnaireButton({ clientId, clientEmail, clientPrenom }) {
  const handleSend = (e) => {
    e.stopPropagation();
    const url = `${window.location.origin}/questionnaire/${clientId}`;
    const prenom = clientPrenom || '';
    const subject = 'Votre questionnaire pre-consultation — Anissa Deroubaix';
    const body =
      `Bonjour ${prenom},\n\n` +
      `Je vous remercie de votre confiance.\n\n` +
      `Avant notre consultation, je vous invite a remplir ce court questionnaire (5 minutes).\n` +
      `Cela me permettra de mieux preparer notre rendez-vous et de personnaliser votre accompagnement.\n\n` +
      `Remplir mon questionnaire :\n${url}\n\n` +
      `Ce questionnaire est strictement confidentiel.`;
    const gmailUrl = `https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(clientEmail || '')}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(gmailUrl, '_blank');
  };
  return (
    <button onClick={handleSend} style={{
      backgroundColor: '#1A2E1F',
      color: 'white',
      border: 'none',
      padding: '8px 16px',
      borderRadius: '20px',
      cursor: 'pointer',
      fontSize: '13px',
      fontWeight: '500',
      width: '100%',
      marginTop: '8px',
    }}>
      Envoyer questionnaire
    </button>
  );
}

function formatDate(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function getInitial(name) {
  return (name || '?').charAt(0).toUpperCase();
}

function getFollowUpStatus(clientId) {
  const consultations = getNutritionConsultations(clientId);
  if (consultations.length === 0) return null;
  const lastDate = new Date(consultations[0].date);
  const now = new Date();
  const diffMs = now - lastDate;
  const diffMonths = diffMs / (1000 * 60 * 60 * 24 * 30.44);
  if (diffMonths >= 6) return 'urgent';
  if (diffMonths >= 3) return 'recommended';
  return null;
}

function ClientCard({ client, i, onConsultation, onViewHistory, onOpen, isOwn, onRefresh }) {
  const formule = FORMULES[client.formule] || {};
  const consultations = getNutritionConsultations(client.id);
  const lastConsultation = consultations[0];
  const isNutrition = client.categorie === 'nutrition';
  const followUp = getFollowUpStatus(client.id);

  const handleDelete = (e) => {
    e.stopPropagation();
    if (confirm('Supprimer ce client ?')) {
      deleteClient(client.id);
      onRefresh();
    }
  };

  return (
    <div
      className="client-card anissa-client-card"
      style={{ animationDelay: `${i * 50}ms` }}
      onClick={isOwn && onOpen ? () => onOpen(client.id) : undefined}
    >
      {followUp && (
        <span className={`followup-badge followup-${followUp}`}>
          {followUp === 'urgent' ? 'Suivi urgent' : 'Suivi recommande'}
        </span>
      )}
      <div className="client-card-top">
        <div className={`client-avatar ${isNutrition ? 'nutrition-avatar' : 'anissa-avatar'}`}>{getInitial(client.prenom)}</div>
        <div className="client-card-info">
          <div className="client-card-name">{client.prenom || 'Sans nom'}</div>
          <div className="client-card-formula anissa-formula">
            {isNutrition ? 'Client nutrition' : `${formule.nom || '-'} - ${formule.prix || ''}`}
          </div>
        </div>
      </div>

      <div className="anissa-client-details">
        <div className="anissa-detail">
          <span className="anissa-detail-label">Objectif</span>
          <span className="anissa-detail-value">
            {isNutrition
              ? (client.form?.objectif || (client.form?.symptomesObjectifs || []).join(', ') || '-')
              : (client.form?.objectifPrincipal || '-')}
          </span>
        </div>
        <div className="anissa-detail">
          <span className="anissa-detail-label">Allergies</span>
          <span className="anissa-detail-value">{client.form?.allergies || client.form?.alimentsEvites || 'Aucune'}</span>
        </div>
        {lastConsultation && (
          <div className="anissa-detail">
            <span className="anissa-detail-label">Derniere consultation</span>
            <span className="anissa-detail-value">{formatDate(lastConsultation.date)}</span>
          </div>
        )}
      </div>

      <div className="client-card-bottom anissa-card-bottom">
        <div className="anissa-card-actions">
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <button
              className="btn btn-sm btn-anissa-primary"
              onClick={(e) => { e.stopPropagation(); onConsultation(client.id); }}
            >
              + Consultation
            </button>
            {consultations.length > 0 && (
              <button
                className="btn btn-sm btn-anissa-secondary"
                onClick={(e) => { e.stopPropagation(); onViewHistory(client.id); }}
              >
                {consultations.length} consultation{consultations.length > 1 ? 's' : ''}
              </button>
            )}
            {isOwn && (
              <button className="btn btn-xs btn-danger" onClick={handleDelete} style={{ marginLeft: 'auto' }}>x</button>
            )}
          </div>
          <SendQuestionnaireButton clientId={client.id} clientEmail={client.form?.email} clientPrenom={client.prenom || client.form?.prenom} />
        </div>
      </div>
    </div>
  );
}

export default function AnissaDashboard({ sharedClients, ownClients, onConsultation, onViewHistory, onNewClient, onOpenClient, onRefresh }) {
  const [search, setSearch] = useState('');

  const allClients = [...sharedClients, ...ownClients];

  // Clients needing follow-up (last consultation > 3 months)
  const clientsToRecontact = allClients.filter(c => {
    const status = getFollowUpStatus(c.id);
    return status === 'recommended' || status === 'urgent';
  });

  let filteredShared = sharedClients;
  let filteredOwn = ownClients;
  if (search.trim()) {
    const q = search.toLowerCase().trim();
    filteredShared = sharedClients.filter(c => (c.prenom || '').toLowerCase().includes(q));
    filteredOwn = ownClients.filter(c => (c.prenom || '').toLowerCase().includes(q));
  }

  const totalFiltered = filteredShared.length + filteredOwn.length;

  // Stats
  const now = new Date();
  const consultationsThisMonth = allClients.reduce((sum, c) => {
    return sum + getNutritionConsultations(c.id).filter(n => {
      const d = new Date(n.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
  }, 0);

  return (
    <div className="dashboard anissa-dashboard">
      {/* Stats */}
      <div className="stats-row stats-row-4">
        <div className="stat-card anissa-stat">
          <span className="stat-number">{ownClients.length}</span>
          <span className="stat-label">Mes clients</span>
        </div>
        <div className="stat-card anissa-stat">
          <span className="stat-number">{sharedClients.length}</span>
          <span className="stat-label">Clients partages</span>
        </div>
        <div className="stat-card anissa-stat">
          <span className="stat-number">{consultationsThisMonth}</span>
          <span className="stat-label">Consultations ce mois</span>
        </div>
        <div className="stat-card anissa-stat">
          <span className="stat-number">{clientsToRecontact.length}</span>
          <span className="stat-label">A recontacter</span>
        </div>
      </div>

      <div className="dashboard-header">
        <h2>Mes clients</h2>
        <span className="dashboard-count">
          {totalFiltered} client{totalFiltered !== 1 ? 's' : ''}
        </span>
        <button className="btn btn-sm btn-anissa-primary" style={{ marginLeft: 'auto' }} onClick={onNewClient}>
          + Nouveau client
        </button>
      </div>

      <div className="search-bar">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher par prenom..."
          className="search-input"
        />
      </div>

      {/* Clients to re-contact alert */}
      {clientsToRecontact.length > 0 && !search.trim() && (
        <div className="recontact-section">
          <h3 className="anissa-section-title recontact-title">
            Clients a recontacter
            <span className="anissa-section-count recontact-count">{clientsToRecontact.length}</span>
          </h3>
          <div className="recontact-list">
            {clientsToRecontact.map(c => {
              const status = getFollowUpStatus(c.id);
              const consultations = getNutritionConsultations(c.id);
              const lastDate = consultations[0]?.date;
              return (
                <div key={c.id} className={`recontact-item recontact-${status}`}>
                  <span className="recontact-name">{c.prenom || 'Sans nom'}</span>
                  <span className="recontact-date">Derniere consultation : {formatDate(lastDate)}</span>
                  <span className={`recontact-badge recontact-badge-${status}`}>
                    {status === 'urgent' ? 'Suivi urgent' : 'Suivi recommande'}
                  </span>
                  <button className="btn btn-xs btn-anissa-primary" onClick={() => onConsultation(c.id)}>
                    + Consultation
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {allClients.length === 0 ? (
        <div className="dashboard-empty">
          <div className="empty-title">Aucun client</div>
          <p>Creez votre premier client ou attendez que Benoit ajoute un client en Suivi Complet / Intensif.</p>
          <button className="btn btn-anissa-primary" onClick={onNewClient} style={{ marginTop: 16, padding: '12px 28px' }}>
            + Nouveau client
          </button>
        </div>
      ) : (
        <>
          {/* Shared clients section */}
          {filteredShared.length > 0 && (
            <div className="anissa-section">
              <h3 className="anissa-section-title">
                Clients partages avec Benoit
                <span className="anissa-section-count">{filteredShared.length}</span>
              </h3>
              <div className="client-grid">
                {filteredShared.map((client, i) => (
                  <ClientCard key={client.id} client={client} i={i} onConsultation={onConsultation} onViewHistory={onViewHistory} isOwn={false} onRefresh={onRefresh} />
                ))}
              </div>
            </div>
          )}

          {/* Own clients section */}
          {filteredOwn.length > 0 && (
            <div className="anissa-section">
              <h3 className="anissa-section-title">
                Mes clients
                <span className="anissa-section-count">{filteredOwn.length}</span>
              </h3>
              <div className="client-grid">
                {filteredOwn.map((client, i) => (
                  <ClientCard key={client.id} client={client} i={i} onConsultation={onConsultation} onViewHistory={onViewHistory} onOpen={onOpenClient} isOwn={true} onRefresh={onRefresh} />
                ))}
              </div>
            </div>
          )}

          {filteredShared.length === 0 && filteredOwn.length === 0 && (
            <div className="dashboard-empty">
              <p>Aucun client ne correspond a la recherche.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
