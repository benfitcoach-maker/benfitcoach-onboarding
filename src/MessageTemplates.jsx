import { useState } from 'react';
import { MESSAGE_TEMPLATES } from './templates';

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

const CATEGORIES = {
  all: 'Tous',
  onboarding: 'Onboarding',
  suivi: 'Suivi',
  motivation: 'Motivation',
  nutrition: 'Nutrition',
  engagement: 'Engagement',
  retention: 'Retention',
  upsell: 'Upsell',
  business: 'Business',
};

export default function MessageTemplates({ onBack }) {
  const [lang, setLang] = useState('fr');
  const [category, setCategory] = useState('all');

  const filtered = category === 'all'
    ? MESSAGE_TEMPLATES
    : MESSAGE_TEMPLATES.filter(t => t.category === category);

  return (
    <div className="templates-page">
      <div className="templates-header">
        <button className="btn btn-secondary btn-sm" onClick={onBack}>Retour</button>
        <h2>Messages types</h2>
      </div>

      {/* Lang selector - big pills */}
      <div className="lang-selector">
        <button
          className={`lang-btn ${lang === 'fr' ? 'lang-btn-active' : ''}`}
          onClick={() => setLang('fr')}
        >
          Francais
        </button>
        <button
          className={`lang-btn ${lang === 'en' ? 'lang-btn-active' : ''}`}
          onClick={() => setLang('en')}
        >
          English
        </button>
      </div>

      <div className="templates-controls">
        <div className="filter-pills">
          {Object.entries(CATEGORIES).map(([key, label]) => (
            <button key={key} className={`filter-pill ${category === key ? 'filter-pill-active' : ''}`}
              onClick={() => setCategory(key)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="templates-list">
        {filtered.map((t, i) => (
          <div key={t.id} className="result-card" style={{ animationDelay: `${i * 50}ms` }}>
            <div className="result-card-header">
              <h3>{t.title}</h3>
              <div className="result-card-actions">
                <span className="template-lang-badge">{lang === 'fr' ? 'FR' : 'EN'}</span>
                <span className="template-cat">{CATEGORIES[t.category]}</span>
                <CopyButton text={t[lang]} />
              </div>
            </div>
            <div className="result-card-body">{t[lang]}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
