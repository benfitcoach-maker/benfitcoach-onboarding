// ═══════════════════════════════════════════════════════════════════════
// V81 — Modale de confirmation reutilisable (remplace les window.confirm natifs)
//
// API :
//   const { ask, state, close } = useConfirmDialog();
//   <ConfirmDialog state={state} onClose={close} />
//
//   // Puis dans un handler :
//   const ok = await ask({
//     title: 'Régénérer le plan ?',
//     message: 'Le plan actuel sera remplacé.',
//     danger: true,           // optionnel — style rouge vs vert
//     confirmLabel: 'Régénérer', // optionnel — label du bouton confirmer
//   });
//   if (!ok) return;
//
// Style coherent avec la modale soft delete V78.
// ═══════════════════════════════════════════════════════════════════════

import { useState, useCallback, useRef } from 'react';

/**
 * Hook qui expose une API impérative Promise-based pour confirmer une action.
 * @returns {{ ask: (opts) => Promise<boolean>, state: object|null, close: (ok: boolean) => void }}
 */
export function useConfirmDialog() {
  const [state, setState] = useState(null);
  const resolverRef = useRef(null);

  const ask = useCallback((opts) => {
    return new Promise((resolve) => {
      // Si une modale precedente est encore en attente, on la resout à false
      if (resolverRef.current) {
        resolverRef.current(false);
      }
      resolverRef.current = resolve;
      setState(opts || {});
    });
  }, []);

  const close = useCallback((ok) => {
    if (resolverRef.current) {
      resolverRef.current(Boolean(ok));
      resolverRef.current = null;
    }
    setState(null);
  }, []);

  return { ask, state, close };
}

/**
 * Composant a rendre une fois dans l'arbre (juste au niveau du hook).
 */
export function ConfirmDialog({ state, onClose }) {
  if (!state) return null;
  const { title, message, danger, confirmLabel } = state;
  const accent = danger ? {
    border: 'rgba(212,92,76,.3)',
    titleColor: '#d4806c',
    btnBorder: 'rgba(212,92,76,.5)',
    btnBg: 'rgba(212,92,76,.15)',
    btnBgHover: 'rgba(212,92,76,.25)',
    btnColor: '#d4806c',
  } : {
    border: 'rgba(106,191,138,.3)',
    titleColor: '#8abf9a',
    btnBorder: 'rgba(106,191,138,.5)',
    btnBg: 'rgba(106,191,138,.15)',
    btnBgHover: 'rgba(106,191,138,.25)',
    btnColor: '#8abf9a',
  };

  return (
    <div
      onClick={() => onClose(false)}
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed', inset: 0, zIndex: 1100,
        background: 'rgba(0,0,0,.65)', backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 440,
          background: '#1e241f',
          border: `1px solid ${accent.border}`,
          borderRadius: 14,
          boxShadow: '0 20px 60px rgba(0,0,0,.5)',
          overflow: 'hidden',
        }}
      >
        <header style={{ padding: '18px 22px 14px', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
          <h3 style={{ margin: 0, color: accent.titleColor, fontSize: '1rem', fontWeight: 700 }}>
            {title}
          </h3>
        </header>
        <div style={{ padding: '18px 22px', fontSize: '.85rem', color: '#d4c9a8', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
          {message}
        </div>
        <footer style={{
          padding: '14px 22px 18px',
          borderTop: '1px solid rgba(255,255,255,.06)',
          display: 'flex', justifyContent: 'flex-end', gap: 8,
        }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => onClose(false)}
            style={{ padding: '8px 16px', borderRadius: 10, fontSize: '.82rem' }}
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => onClose(true)}
            style={{
              padding: '8px 16px', borderRadius: 10, fontSize: '.82rem',
              border: `1px solid ${accent.btnBorder}`,
              background: accent.btnBg,
              color: accent.btnColor,
              cursor: 'pointer',
              fontWeight: 600,
              transition: 'background .15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = accent.btnBgHover}
            onMouseLeave={e => e.currentTarget.style.background = accent.btnBg}
          >
            {confirmLabel || 'Confirmer'}
          </button>
        </footer>
      </div>
    </div>
  );
}
