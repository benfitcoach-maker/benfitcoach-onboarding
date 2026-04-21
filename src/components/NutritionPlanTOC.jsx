// ═══════════════════════════════════════════════════════════════════════
// V82 — Mini-TOC flottant pour naviguer dans un plan nutrition
//
// Strategie :
//   - collecte les sections rendues par NutritionEditor via DOM (querySelectorAll
//     sur .ne-section[data-section-type]) + MutationObserver sur .ne-container
//     pour reagir aux ajouts/suppressions/reorderings.
//   - suit la section active via IntersectionObserver (zone "milieu haut" du viewport)
//   - clic sur un item → scrollIntoView smooth, center
//
// Placement : fixed a droite du viewport, masque en dessous de 1200px
// (coherent avec la memory "editor desktop only" de ce projet).
// ═══════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState, useMemo } from 'react';

/**
 * @param {{ refreshKey: any, containerSelector?: string }} props
 *   - refreshKey : incrementez pour forcer un rescan (ex: editorSeed apres regeneration)
 *   - containerSelector : selector racine pour le scan (defaut : '.ne-container')
 */
export default function NutritionPlanTOC({ refreshKey, containerSelector = '.ne-container' }) {
  const [items, setItems] = useState([]); // [{ id, type, title, el }]
  const [activeType, setActiveType] = useState(null);
  const [viewportOk, setViewportOk] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1200 : true
  );

  // ── Collect sections from DOM (+ observe mutations for add/remove/reorder) ──
  useEffect(() => {
    const scan = () => {
      const container = document.querySelector(containerSelector);
      if (!container) {
        setItems([]);
        return;
      }
      const els = container.querySelectorAll('.ne-section[data-section-type]');
      const list = [...els].map(el => ({
        id: el.dataset.sectionId || '',
        type: el.dataset.sectionType || 'default',
        title: el.dataset.sectionTitle || '(sans titre)',
        el,
      }));
      setItems(list);
    };

    // Scan initial apres commit React (2 RAF pour la surete)
    let raf1 = requestAnimationFrame(() => {
      let raf2 = requestAnimationFrame(scan);
      raf1 = raf2;
    });

    // Observer les mutations sur le container (reorder, add, remove de sections)
    const container = document.querySelector(containerSelector);
    let mo = null;
    if (container) {
      mo = new MutationObserver(() => {
        // Debounce simple avec RAF pour ne pas thrasher
        requestAnimationFrame(scan);
      });
      mo.observe(container, { childList: true, subtree: false });
    }

    return () => {
      if (raf1) cancelAnimationFrame(raf1);
      if (mo) mo.disconnect();
    };
  }, [refreshKey, containerSelector]);

  // ── Track active section via IntersectionObserver ──
  useEffect(() => {
    if (items.length === 0) return;
    // rootMargin : la section est "active" quand elle traverse la zone haute du viewport
    // (pas uniquement quand elle touche le top exact)
    const io = new IntersectionObserver(
      (entries) => {
        // Trouver la premiere section qui intersecte (celle le plus haut dans la liste)
        const visibles = entries
          .filter(e => e.isIntersecting)
          .map(e => e.target);
        if (visibles.length > 0) {
          // Prendre celle dont le top est le plus proche du haut du viewport
          const sorted = visibles.sort((a, b) => {
            return a.getBoundingClientRect().top - b.getBoundingClientRect().top;
          });
          setActiveType(sorted[0].dataset.sectionType);
        }
      },
      { rootMargin: '-20% 0px -60% 0px', threshold: 0 }
    );
    items.forEach(({ el }) => io.observe(el));
    return () => io.disconnect();
  }, [items]);

  // ── Responsive : hide on narrow screens ──
  useEffect(() => {
    const onResize = () => setViewportOk(window.innerWidth >= 1200);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const handleClick = (el) => {
    if (!el) return;
    try {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch {
      el.scrollIntoView();
    }
  };

  // Deduplicate par type au cas ou (garde le dernier seen) — V69 SEMAINE 1 peut coexister avec STRUCTURE ALIMENTAIRE
  const uniqueItems = useMemo(() => {
    const seen = new Set();
    return items.filter(it => {
      const key = it.id || (it.type + '|' + it.title);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [items]);

  if (!viewportOk) return null;
  if (uniqueItems.length === 0) return null;

  return (
    <nav
      aria-label="Table des matières du plan"
      style={{
        position: 'fixed',
        top: 140,
        right: 20,
        zIndex: 10,
        width: 210,
        maxHeight: 'calc(100vh - 180px)',
        overflowY: 'auto',
        background: 'rgba(12,18,15,.92)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(106,191,138,.15)',
        borderRadius: 12,
        padding: '10px 6px',
        boxShadow: '0 8px 24px rgba(0,0,0,.35)',
        fontSize: '.72rem',
      }}
    >
      <div style={{
        fontSize: '.62rem', fontWeight: 700,
        color: '#8abf9a', letterSpacing: '.18em',
        textTransform: 'uppercase',
        padding: '2px 10px 8px',
      }}>
        Sections
      </div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {uniqueItems.map((it, idx) => {
          const isActive = it.type === activeType;
          return (
            <li key={it.id || idx}>
              <button
                type="button"
                onClick={() => handleClick(it.el)}
                title={it.title}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '6px 10px',
                  paddingLeft: isActive ? 8 : 10,
                  borderLeft: isActive ? '2px solid #c4a050' : '2px solid transparent',
                  background: isActive ? 'rgba(196,160,80,.08)' : 'transparent',
                  color: isActive ? '#e0cda0' : 'rgba(212,201,168,.75)',
                  border: 'none',
                  borderLeftWidth: 2,
                  borderLeftStyle: 'solid',
                  borderLeftColor: isActive ? '#c4a050' : 'transparent',
                  fontSize: '.72rem',
                  fontWeight: isActive ? 600 : 400,
                  cursor: 'pointer',
                  transition: 'all .15s',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontFamily: 'inherit',
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,.03)'; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
              >
                {it.title}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
