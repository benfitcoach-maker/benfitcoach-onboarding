// ─────────────────────────────────────────────────────────────────
// PremiumSwitch — Phase AU
// Date : 2026-05-11
//
// Switch iOS-like premium (rail + thumb glissant) pour remplacer les
// <input type="checkbox"> natives qui faisaient 'switch HTML brut'
// dans le parcours cliente.
//
// Usage :
//   <PremiumSwitch checked={value} onChange={setValue} />
//   <PremiumSwitch checked={value} onChange={setValue} size="sm" />
//   <PremiumSwitch checked={value} onChange={setValue} accent="#a78bfa" />
//
// Props :
//   - checked  (bool)
//   - onChange (fn(newValue: bool))
//   - disabled (bool)
//   - size     ('sm' | 'md')  défaut 'md'
//   - accent   (couleur custom du rail en état ON, défaut accent vert)
// ─────────────────────────────────────────────────────────────────

export default function PremiumSwitch({
  checked,
  onChange,
  disabled = false,
  size = 'md',
  accent = 'var(--jrn-accent)',
}) {
  const dims = size === 'sm'
    ? { w: 30, h: 18, thumb: 14, offset: 2, on: 14 }
    : { w: 38, h: 22, thumb: 18, offset: 2, on: 18 };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!disabled) onChange(!checked);
      }}
      disabled={disabled}
      style={{
        position: 'relative',
        width: dims.w,
        height: dims.h,
        borderRadius: 999,
        border: 'none',
        padding: 0,
        background: checked ? accent : 'rgba(40, 32, 20, 0.18)',
        boxShadow: checked
          ? 'inset 0 1px 2px rgba(15, 25, 18, 0.22)'
          : 'inset 0 1px 2px rgba(40, 32, 20, 0.12)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background 180ms cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 180ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        flexShrink: 0,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span style={{
        position: 'absolute',
        top: dims.offset,
        left: checked ? dims.on : dims.offset,
        width: dims.thumb,
        height: dims.thumb,
        borderRadius: '50%',
        background: '#fff',
        boxShadow: '0 1px 2px rgba(0,0,0,0.22), 0 2px 6px rgba(0,0,0,0.10)',
        transition: 'left 220ms cubic-bezier(0.2, 0.8, 0.2, 1)',
      }} />
    </button>
  );
}
