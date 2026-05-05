// V94.15 : palette sémantique centralisée pour cohérence visuelle.
// À utiliser partout au lieu de valeurs en dur.

// Sémantique d'usage :
// - SUCCESS : action validée, état OK, info positive
// - INFO    : info neutre, indication
// - WARNING : attention requise, à surveiller
// - DANGER  : urgent, erreur, suppression
// - NEUTRAL : muted, secondaire

export const COLORS = {
  success: {
    text: '#8abf9a',
    bg: 'rgba(106,191,138,.12)',
    bgStrong: 'rgba(106,191,138,.22)',
    border: 'rgba(106,191,138,.32)',
    accent: '#6abf8a',
  },
  info: {
    text: '#7bb6ff',
    bg: 'rgba(96,165,250,.12)',
    bgStrong: 'rgba(96,165,250,.22)',
    border: 'rgba(96,165,250,.32)',
    accent: '#60a5fa',
  },
  warning: {
    text: '#e9b876',
    bg: 'rgba(232,160,64,.12)',
    bgStrong: 'rgba(232,160,64,.22)',
    border: 'rgba(232,160,64,.32)',
    accent: '#e8a040',
  },
  danger: {
    text: '#e09c8e',
    bg: 'rgba(212,92,76,.12)',
    bgStrong: 'rgba(212,92,76,.22)',
    border: 'rgba(212,92,76,.32)',
    accent: '#d4806c',
  },
  neutral: {
    text: 'rgba(255,255,255,.55)',
    bg: 'rgba(255,255,255,.04)',
    bgStrong: 'rgba(255,255,255,.08)',
    border: 'rgba(255,255,255,.18)',
    accent: '#8a8a7a',
  },
  brand: {
    green: '#1A2E1F',
    gold: '#C4A050',
    text: '#333330',
    textSoft: '#555550',
    textMute: '#8a8a7a',
  },
};

// Helper pour styler un badge sémantique
export function badgeStyle(level = 'neutral') {
  const c = COLORS[level] || COLORS.neutral;
  return {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    fontSize: '.72rem', fontWeight: 600,
    padding: '3px 10px', borderRadius: 999,
    background: c.bg, color: c.text,
    border: `1px solid ${c.border}`,
    whiteSpace: 'nowrap',
  };
}
