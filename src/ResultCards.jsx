import { useState } from 'react';
import { regenerateSection } from './prompt';

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

function RegenerateButton({ title, apiKey, form, onUpdate }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRegen = async () => {
    if (!apiKey?.trim()) { setError('Cle API manquante'); return; }
    setLoading(true); setError('');
    try {
      const content = await regenerateSection(apiKey.trim(), form, title);
      onUpdate(title, content);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <>
      <button className="btn-regen" onClick={handleRegen} disabled={loading} title="Regenerer cette section">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
        </svg>
        {loading ? '...' : 'Regen.'}
      </button>
      {error && <span className="regen-error">{error}</span>}
    </>
  );
}

export default function ResultCards({ sections, titles, apiKey, form, onSectionUpdate }) {
  return (
    <div className="results">
      <h2>Dossier d'onboarding</h2>
      {titles.map((title, i) => {
        const content = sections[title];
        if (!content) return null;
        return (
          <div key={title} className="result-card" style={{ animationDelay: `${i * 60}ms` }}>
            <div className="result-card-header">
              <h3>{title}</h3>
              <div className="result-card-actions">
                <RegenerateButton title={title} apiKey={apiKey} form={form} onUpdate={onSectionUpdate} />
                <CopyButton text={content} />
              </div>
            </div>
            <div className="result-card-body">{content}</div>
          </div>
        );
      })}
    </div>
  );
}
