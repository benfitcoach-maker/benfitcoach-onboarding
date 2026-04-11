import { useState } from 'react';
import { FORMULES, CATEGORIES, PRESENTIEL_PACKS } from './formSteps';
import { deleteClient, updateClientStatus, getNutritionConsultations } from './store';

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

function formatDate(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit', year: 'numeric' });
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

export default function Dashboard({ clients, onOpen, onNew, onHistory, onRefresh }) {
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterFormule, setFilterFormule] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterLang, setFilterLang] = useState('all');

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

  let filtered = clients;
  if (search.trim()) {
    const q = search.toLowerCase().trim();
    filtered = filtered.filter(c => (c.prenom || '').toLowerCase().includes(q));
  }
  if (filterCategory !== 'all') filtered = filtered.filter(c => (c.categorie || 'online') === filterCategory);
  if (filterFormule !== 'all') filtered = filtered.filter(c => c.formule === filterFormule);
  if (filterStatus !== 'all') filtered = filtered.filter(c => (c.status || 'nouveau') === filterStatus);
  if (filterLang !== 'all') filtered = filtered.filter(c => (c.langue || 'FR') === filterLang);

  // Stats
  const totalClients = clients.length;
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

      <div className="dashboard-header">
        <h2>Mes clients</h2>
        <span className="dashboard-count">
          {filtered.length}{filtered.length !== clients.length ? ` / ${clients.length}` : ''} client{filtered.length !== 1 ? 's' : ''}
        </span>
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

      <div className="filters-section">
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
        <div className="filter-row-bottom">
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
        </div>
      </div>

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
                    <div className="client-card-formula">{getFormulaDisplay(client)}</div>
                  </div>
                </div>

                <div className="client-card-category-row">
                  {getCategoryBadge(client.categorie)}
                </div>

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
