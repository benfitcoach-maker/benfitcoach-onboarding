import { useState } from 'react';
import { getClient } from './store';
import { SECTION_TITLES } from './prompt';

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(text); }
    catch { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button className={`btn-copy ${copied ? 'copied' : ''}`} onClick={handleCopy}>
      <svg className="copy-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
      </svg>
      <svg className="check-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
      {copied ? 'Copie !' : 'Copier'}
    </button>
  );
}

function formatDateTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('fr-CH', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function HistoryPanel({ clientId, onBack }) {
  const client = getClient(clientId);
  const [expandedId, setExpandedId] = useState(null);

  if (!client) {
    return (
      <div className="history-panel">
        <p>Client introuvable.</p>
        <button className="btn btn-secondary" onClick={onBack}>Retour</button>
      </div>
    );
  }

  const history = client.history || [];

  return (
    <div className="history-panel">
      <div className="history-header">
        <button className="btn btn-secondary btn-sm" onClick={onBack}>Retour a la fiche</button>
        <h2>Historique — {client.prenom || 'Client'}</h2>
        <span className="dashboard-count">{history.length} generation{history.length !== 1 ? 's' : ''}</span>
      </div>

      {history.length === 0 ? (
        <div className="dashboard-empty"><p>Aucune generation pour ce client.</p></div>
      ) : (
        <div className="history-list">
          {history.map((gen, i) => (
            <div key={gen.id} className="history-item" style={{ animationDelay: `${i * 50}ms` }}>
              <div className="history-item-header" onClick={() => setExpandedId(expandedId === gen.id ? null : gen.id)}>
                <span className="history-date">{formatDateTime(gen.date)}</span>
                <span className="history-sections">{Object.keys(gen.sections || {}).length} sections</span>
                <span className="history-toggle">{expandedId === gen.id ? 'Fermer' : 'Voir'}</span>
              </div>
              {expandedId === gen.id && gen.sections && (
                <div className="history-item-body">
                  {SECTION_TITLES.map(title => {
                    const content = gen.sections[title];
                    if (!content) return null;
                    return (
                      <div key={title} className="result-card">
                        <div className="result-card-header">
                          <h3>{title}</h3>
                          <CopyButton text={content} />
                        </div>
                        <div className="result-card-body">{content}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
