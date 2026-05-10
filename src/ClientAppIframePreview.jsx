// ─────────────────────────────────────────────────────────────────
// Phase U — Aperçu iframe app cliente avec cadre iPhone
// Date : 2026-05-10
//
// Anissa visualise l'app cliente RÉELLE (data réelles de la cliente)
// dans un cadre iPhone, sans devoir se connecter en tant que cliente.
//
// Flux :
//   1. Demande un token éphémère au SaaS via /api/preview-token
//   2. Construit l'URL : ${APP_URL}/preview/{clientId}?token=...&path=...
//   3. Iframe pointing dans cadre iPhone CSS
//   4. Toolbar : navigation rapide entre /, /parcours, /plan, /messages
//
// Sécurité :
//   - Token signé HMAC + secret partagé, expire en 1h
//   - Cookie session preview côté app cliente isolé de la session normale
//   - Les routes API client sont en lecture seule en mode preview (TODO)
// ─────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabaseClient';
import { getNutritionConsultations } from './store';
import { publishConsultationToClientApp } from './services/publishToClientApp';

const NAV_ITEMS = [
  { path: '/', label: 'Accueil' },
  { path: '/parcours', label: 'Parcours' },
  { path: '/plan', label: 'Plan' },
  { path: '/messages', label: 'Messages' },
  { path: '/parametres', label: 'Réglages' },
];

export default function ClientAppIframePreview({ client, prenom, onClose }) {
  const clientId = client?.id;
  const [token, setToken] = useState(null);
  const [appUrl, setAppUrl] = useState(null);
  const [error, setError] = useState(null);
  const [currentPath, setCurrentPath] = useState('/');
  const [iframeKey, setIframeKey] = useState(0);
  const [loading, setLoading] = useState(true);
  // Publish state
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState(null);
  const [publishError, setPublishError] = useState(null);

  const fetchToken = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/preview-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, ttl: 3600 }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setToken(data.token);
      // Extraire l'URL de base (sans le path /preview/...) pour pouvoir
      // construire d'autres URLs avec différents path
      const urlObj = new URL(data.url);
      setAppUrl(`${urlObj.origin}/preview/${clientId}?token=${encodeURIComponent(data.token)}`);
    } catch (e) {
      setError(e?.message || 'Erreur génération token');
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => { fetchToken(); }, [fetchToken]);

  const navigateTo = (path) => {
    setCurrentPath(path);
    setIframeKey((k) => k + 1);
  };

  const refresh = () => setIframeKey((k) => k + 1);

  const iframeSrc = appUrl ? `${appUrl}&path=${encodeURIComponent(currentPath)}` : null;

  // ─── Publier le plan sur l'app cliente ────────────────────────
  const handlePublish = async () => {
    if (!clientId) return;
    if (!window.confirm('Publier ce programme sur l\'app cliente ?\n\nLa cliente verra le plan mis à jour à sa prochaine connexion.')) return;
    setPublishing(true);
    setPublishError(null);
    setPublishResult(null);
    try {
      // Recup la derniere consultation : local store + fallback Supabase
      let consult = (getNutritionConsultations(clientId) || [])[0] || null;
      if (!consult) {
        const { data } = await supabase
          .from('nutrition_consultations')
          .select('*')
          .eq('client_id', clientId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (data) {
          consult = {
            clientId,
            nutritionPlan: data.nutrition_plan || data.plan_text || '',
            ficheFrigoJson: data.fiche_frigo_json || null,
            aiDirectives: data.ai_directives || '',
            createdAt: data.created_at,
          };
        }
      }
      const planText = consult?.nutritionPlan || consult?.nutrition_plan;
      if (!consult || !planText || !planText.trim()) {
        throw new Error('Aucun plan nutritionnel à publier. Générez d\'abord un plan à l\'étape 6.');
      }
      // Adapt camelCase store local → snake_case attendu par publishConsultationToClientApp
      const consultationForPublish = {
        ...consult,
        nutrition_plan: planText,
        fiche_frigo_json: consult.ficheFrigoJson || consult.fiche_frigo_json || null,
        ai_directives: consult.aiDirectives || consult.ai_directives || '',
      };
      const result = await publishConsultationToClientApp(client, consultationForPublish);
      setPublishResult(result);
      // Refresh l'iframe pour que la cliente voie immediatement le nouveau plan
      setTimeout(() => refresh(), 800);
    } catch (e) {
      setPublishError(e?.message || 'Erreur publication');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="cap-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cap-shell">
        {/* ─── Header ──────────────────────────────────────────── */}
        <header className="cap-header">
          <div>
            <p className="cap-eyebrow">Aperçu app cliente</p>
            <h2 className="cap-title">{prenom || 'Cliente'}</h2>
          </div>
          <div className="cap-header-actions">
            <button onClick={refresh} className="cap-btn cap-btn--ghost" title="Recharger l'iframe">↻ Recharger</button>
            <button onClick={onClose} className="cap-btn cap-btn--ghost">Fermer</button>
          </div>
        </header>

        {/* ─── Toolbar nav ─────────────────────────────────────── */}
        <div className="cap-toolbar">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.path}
              onClick={() => navigateTo(item.path)}
              className={`cap-tab ${currentPath === item.path ? 'cap-tab--active' : ''}`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* ─── Cadre iPhone + iframe ───────────────────────────── */}
        <div className="cap-stage">
          {loading && (
            <div className="cap-status">Génération du token preview…</div>
          )}
          {error && (
            <div className="cap-status cap-status--error">
              ⚠ {error}
              <button onClick={fetchToken} className="cap-btn cap-btn--ghost" style={{ marginTop: 12 }}>
                Réessayer
              </button>
            </div>
          )}
          {!loading && !error && iframeSrc && (
            <div className="cap-phone">
              <div className="cap-phone__notch" />
              <iframe
                key={iframeKey}
                src={iframeSrc}
                title="Aperçu app cliente"
                className="cap-phone__iframe"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              />
              <div className="cap-phone__home" />
            </div>
          )}
        </div>

        {/* ─── Footer : Publier ──────────────────────────────── */}
        <div className="cap-publish">
          <div style={{ flex: 1, fontSize: 11, color: '#9a9a9a' }}>
            Token preview valable 1h · session isolée · lecture seule
          </div>
          <button
            onClick={handlePublish}
            disabled={publishing}
            className="cap-btn cap-btn--primary"
            title="Publie le plan actuel sur l'app cliente (visible par la cliente)"
          >
            {publishing ? 'Publication…' : '🚀 Publier sur l\'app'}
          </button>
        </div>

        {publishResult && (
          <div className="cap-toast cap-toast--ok">
            ✓ Plan publié — la cliente le verra à sa prochaine connexion.
          </div>
        )}
        {publishError && (
          <div className="cap-toast cap-toast--err">
            ⚠ {publishError}
          </div>
        )}
      </div>

      <style>{`
        .cap-overlay {
          position: fixed; inset: 0;
          background: rgba(15,15,15,0.7);
          backdrop-filter: blur(8px);
          display: flex; align-items: center; justify-content: center;
          z-index: 100; padding: 24px;
        }
        .cap-shell {
          background: var(--jrn-surface, #fff);
          border-radius: 14px;
          width: 100%;
          max-width: 720px;
          max-height: 95vh;
          display: flex; flex-direction: column;
          overflow: hidden;
          box-shadow: 0 24px 80px rgba(0,0,0,0.4);
          font-family: var(--jrn-font-body, system-ui, sans-serif);
        }
        .cap-header {
          padding: 18px 24px;
          border-bottom: 1px solid rgba(0,0,0,0.06);
          display: flex; justify-content: space-between; align-items: center; gap: 16px;
        }
        .cap-eyebrow {
          font-size: 10px; color: #9a9a9a; text-transform: uppercase;
          letter-spacing: .12em; margin: 0; font-weight: 500;
        }
        .cap-title {
          font-family: 'Playfair Display', Georgia, serif;
          font-style: italic; font-size: 22px; font-weight: 600;
          margin: 4px 0 0; color: #1a4028;
        }
        .cap-header-actions { display: flex; gap: 8px; }
        .cap-btn {
          font-size: 13px; padding: 7px 12px;
          border-radius: 6px; cursor: pointer; font-family: inherit;
          border: 1px solid rgba(0,0,0,0.15); background: transparent; color: #444;
        }
        .cap-btn:hover { background: #fafaf7; }
        .cap-btn--ghost { background: transparent; }
        .cap-toolbar {
          display: flex; gap: 4px; padding: 8px 16px;
          border-bottom: 1px solid rgba(0,0,0,0.06);
          background: #fafaf7;
          overflow-x: auto;
        }
        .cap-tab {
          background: transparent; border: 1px solid transparent;
          padding: 6px 12px; border-radius: 6px;
          font-size: 12px; font-weight: 500; color: #6b6b6b;
          cursor: pointer; white-space: nowrap; font-family: inherit;
        }
        .cap-tab:hover { color: #1a1a1a; background: #fff; }
        .cap-tab--active {
          background: #1A2E1F; color: #fff;
        }
        .cap-stage {
          flex: 1;
          display: flex; align-items: center; justify-content: center;
          padding: 24px;
          background: linear-gradient(180deg, #f3f1eb 0%, #e8e4d8 100%);
          min-height: 720px;
          overflow: auto;
        }
        .cap-status {
          font-size: 14px; color: #5c5c5c; text-align: center;
          padding: 32px;
        }
        .cap-status--error { color: #b53a3a; }
        .cap-phone {
          position: relative;
          width: 380px; height: 800px;
          background: #1a1a1a;
          border-radius: 50px;
          padding: 14px;
          box-shadow: 0 30px 60px rgba(0,0,0,0.35), inset 0 0 0 2px rgba(255,255,255,0.06);
          flex-shrink: 0;
        }
        .cap-phone__notch {
          position: absolute;
          top: 14px; left: 50%; transform: translateX(-50%);
          width: 110px; height: 28px;
          background: #1a1a1a; border-radius: 0 0 18px 18px;
          z-index: 2;
        }
        .cap-phone__iframe {
          width: 100%; height: 100%;
          border: none;
          border-radius: 36px;
          background: #fff;
          display: block;
        }
        .cap-phone__home {
          position: absolute;
          bottom: 8px; left: 50%; transform: translateX(-50%);
          width: 130px; height: 4px;
          background: rgba(255,255,255,0.4);
          border-radius: 2px;
        }
        .cap-publish {
          padding: 12px 20px;
          border-top: 1px solid rgba(0,0,0,0.06);
          background: #fafaf7;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }
        .cap-btn--primary {
          background: #1A2E1F;
          color: #fff;
          border-color: transparent;
          font-weight: 600;
          padding: 9px 16px;
        }
        .cap-btn--primary:hover { background: #0F1F12; }
        .cap-btn--primary:disabled { opacity: 0.5; cursor: not-allowed; }
        .cap-toast {
          padding: 12px 20px;
          font-size: 13px;
          border-top: 1px solid;
        }
        .cap-toast--ok {
          background: rgba(45,90,61,0.08);
          color: #1a4028;
          border-top-color: rgba(45,90,61,0.2);
        }
        .cap-toast--err {
          background: rgba(181,58,58,0.06);
          color: #b53a3a;
          border-top-color: rgba(181,58,58,0.2);
        }
      `}</style>
    </div>
  );
}
