import { useState, useRef, useCallback, useEffect, memo } from 'react';
import FicheFrigoPreview from './FicheFrigoPreview';
import MedicalSummary from './MedicalSummary';

// ─── MARKDOWN → SECTIONS PARSER ───

function markdownToHtml(md) {
  if (!md) return '';
  return md
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/_([^_]+)_/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h2>$1</h2>')
    .replace(/^[-–•*] (.+)$/gm, '<div class="ne-bullet">— $1</div>')
    .replace(/\n/g, '<br/>');
}

function parsePlanToSections(planText, supplementsText, recipesText) {
  const sections = [];

  if (!planText && !supplementsText && !recipesText) return sections;

  const fullText = planText || '';
  const lines = fullText.split('\n');
  let currentTitle = 'PLAN NUTRITION';
  let currentContent = [];

  const flushSection = () => {
    const content = currentContent.join('\n').trim();
    if (content || currentTitle) {
      sections.push({
        id: crypto.randomUUID(),
        title: currentTitle,
        content,
        html: markdownToHtml(content),
        originalContent: content,
      });
    }
    currentContent = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();

    // Detect section headers
    const headerMatch = trimmed.match(/^#{1,3}\s+(.+)/);
    const isNumberedSection = /^\d+\.\s+[A-Z]/.test(trimmed) && trimmed.length < 80;
    const isWeek = /^(?:#{1,3}\s+)?semaine\s+\d/i.test(trimmed);
    const isAllCapsHeader = trimmed === trimmed.toUpperCase() && trimmed.length > 5 && trimmed.length < 60 && /[A-Z]{3,}/.test(trimmed) && !/^\d/.test(trimmed);

    if (headerMatch || isNumberedSection || isWeek || isAllCapsHeader) {
      flushSection();
      let title = headerMatch ? headerMatch[1] : trimmed;
      title = title.replace(/^\d+\.\s*/, '').replace(/\*\*/g, '').trim();
      currentTitle = title.toUpperCase();
    } else {
      currentContent.push(line);
    }
  }
  flushSection();

  // Add supplements as separate section
  if (supplementsText?.trim()) {
    sections.push({
      id: crypto.randomUUID(),
      title: 'SUPPLEMENTS RECOMMANDES',
      content: supplementsText.trim(),
      html: markdownToHtml(supplementsText.trim()),
      originalContent: supplementsText.trim(),
    });
  }

  // Add recipes as separate section
  if (recipesText?.trim()) {
    sections.push({
      id: crypto.randomUUID(),
      title: 'RECETTES RECOMMANDEES',
      content: recipesText.trim(),
      html: markdownToHtml(recipesText.trim()),
      originalContent: recipesText.trim(),
    });
  }

  return sections;
}

function htmlToPlaintext(html) {
  const div = document.createElement('div');
  div.innerHTML = html;
  // Convert <br> to newlines
  div.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
  // Convert block elements to newlines
  div.querySelectorAll('div, p, h2, h3').forEach(el => {
    el.prepend(document.createTextNode('\n'));
  });
  // Convert bullets back
  div.querySelectorAll('.ne-bullet').forEach(el => {
    const text = el.textContent.replace(/^— /, '- ');
    el.replaceWith(document.createTextNode('\n' + text));
  });
  // Convert colored text (font or span with color) to markers BEFORE stripping other tags
  div.querySelectorAll('font[color], span[style*="color"]').forEach(el => {
    const color = el.getAttribute('color') || el.style.color;
    if (color) {
      const hex = colorToHex(color);
      // Don't wrap default text colors
      if (hex && hex !== '#312d2d' && hex !== '#f0f0e8') {
        el.replaceWith(document.createTextNode(`{{color:${hex}}}${el.textContent}{{/color}}`));
        return;
      }
    }
    el.replaceWith(document.createTextNode(el.textContent));
  });
  // Convert font size tags to markers
  div.querySelectorAll('font[size]').forEach(el => {
    const size = el.getAttribute('size');
    const pxMap = { '1': '9', '2': '11', '3': '14', '4': '16', '5': '18', '6': '22', '7': '26' };
    const px = pxMap[size] || '14';
    if (px !== '14') {
      el.replaceWith(document.createTextNode(`{{size:${px}}}${el.textContent}{{/size}}`));
    } else {
      el.replaceWith(document.createTextNode(el.textContent));
    }
  });
  // Convert note/alert blocks to markers BEFORE stripping other tags
  div.querySelectorAll('[data-block-type]').forEach(el => {
    const type = el.getAttribute('data-block-type');
    const strongEl = el.querySelector('strong');
    const prefix = strongEl ? strongEl.textContent : '';
    // Get remaining text after the strong
    const clone = el.cloneNode(true);
    const s = clone.querySelector('strong');
    if (s) s.remove();
    const body = clone.textContent.trim();
    el.replaceWith(document.createTextNode(`\n{{${type}}}${prefix} ${body}{{/${type}}}\n`));
  });
  // Also detect note/alert blocks by style (for blocks inserted without data attribute)
  div.querySelectorAll('div[style*="border-left"]').forEach(el => {
    const style = el.getAttribute('style') || '';
    const strongEl = el.querySelector('strong');
    let type = 'note';
    if (style.includes('#f87171') || style.includes('rgb(248, 113, 113)')) type = 'alert';
    const prefix = strongEl ? strongEl.textContent : '';
    const clone = el.cloneNode(true);
    const s = clone.querySelector('strong');
    if (s) s.remove();
    const body = clone.textContent.trim();
    el.replaceWith(document.createTextNode(`\n{{${type}}}${prefix} ${body}{{/${type}}}\n`));
  });
  // Convert highlighted text to markers
  div.querySelectorAll('span[style*="background"], mark').forEach(el => {
    const style = el.getAttribute('style') || '';
    let hColor = 'yellow';
    if (style.includes('74, 222, 128') || style.includes('rgba(74')) hColor = 'green';
    else if (style.includes('248, 113, 113') || style.includes('rgba(248')) hColor = 'red';
    else if (style.includes('96, 165, 250') || style.includes('rgba(96')) hColor = 'blue';
    el.replaceWith(document.createTextNode(`{{hl:${hColor}}}${el.textContent}{{/hl}}`));
  });
  // Convert colored text (font or span with color) to markers
  div.querySelectorAll('font[color], span[style*="color"]').forEach(el => {
    // Skip if already processed (inside a block)
    if (el.closest('[data-block-type]')) return;
    const color = el.getAttribute('color') || el.style.color;
    if (color) {
      const hex = colorToHex(color);
      if (hex && hex !== '#312d2d' && hex !== '#f0f0e8') {
        el.replaceWith(document.createTextNode(`{{color:${hex}}}${el.textContent}{{/color}}`));
        return;
      }
    }
    el.replaceWith(document.createTextNode(el.textContent));
  });
  // Convert strong back to **
  div.querySelectorAll('strong, b').forEach(el => {
    el.replaceWith(document.createTextNode(`**${el.textContent}**`));
  });
  // Convert em back to *
  div.querySelectorAll('em, i').forEach(el => {
    el.replaceWith(document.createTextNode(`*${el.textContent}*`));
  });
  return div.textContent.replace(/\n{3,}/g, '\n\n').trim();
}

function colorToHex(color) {
  if (!color) return null;
  // Already hex
  if (color.startsWith('#')) return color.toLowerCase();
  // rgb(r, g, b)
  const rgbMatch = color.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1]).toString(16).padStart(2, '0');
    const g = parseInt(rgbMatch[2]).toString(16).padStart(2, '0');
    const b = parseInt(rgbMatch[3]).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
  }
  return color;
}


// ─── PALETTES ───

const COLOR_PALETTE = [
  { hex: '#f0f0e8', label: 'Blanc' },
  { hex: '#1a2e1f', label: 'Vert fonce' },
  { hex: '#4ade80', label: 'Vert clair' },
  { hex: '#f87171', label: 'Rouge' },
  { hex: '#fbbf24', label: 'Orange' },
  { hex: '#60a5fa', label: 'Bleu' },
  { hex: '#a78bfa', label: 'Violet' },
  { hex: '#888888', label: 'Gris' },
];

const HIGHLIGHT_PALETTE = [
  { css: 'rgba(251,191,36,0.3)', label: 'Jaune' },
  { css: 'rgba(74,222,128,0.2)', label: 'Vert' },
  { css: 'rgba(248,113,113,0.2)', label: 'Rouge' },
  { css: 'rgba(96,165,250,0.2)', label: 'Bleu' },
];

// ─── SWATCH POPUP (reused for color & highlight) ───

function SwatchPopup({ items, onSelect, onClose, styleKey }) {
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose]);

  return (
    <div className="ne-color-popup" ref={ref}>
      {items.map(c => (
        <button
          key={c[styleKey]}
          type="button"
          className="ne-color-swatch"
          style={{ background: c[styleKey] }}
          title={c.label}
          onClick={() => onSelect(c[styleKey])}
        />
      ))}
    </div>
  );
}

// ─── NOTE / ALERT HTML BLOCKS ───

const NOTE_HTML = '<div data-block-type="note" style="border-left:3px solid #4ade80;padding:8px 12px;margin:8px 0;background:rgba(74,222,128,0.05);border-radius:4px;" contenteditable="true"><strong style="color:#4ade80;">Note d\'Anissa :</strong> <span>Ecrivez votre note ici...</span></div>';
const ALERT_HTML = '<div data-block-type="alert" style="border-left:3px solid #f87171;padding:8px 12px;margin:8px 0;background:rgba(248,113,113,0.05);border-radius:4px;" contenteditable="true"><strong style="color:#f87171;">Important :</strong> <span>Ecrivez votre alerte ici...</span></div>';

// ─── FONT SIZE OPTIONS ───

const SIZE_OPTIONS = [
  { label: 'Petit', px: 9, cmd: '1' },
  { label: 'Normal', px: 14, cmd: '3' },
  { label: 'Grand', px: 18, cmd: '5' },
  { label: 'Tres grand', px: 22, cmd: '6' },
];

// ─── SYMBOLS ───

const SYMBOLS = [
  { char: '\u2713', label: 'Valide' },
  { char: '\u2717', label: 'A eviter' },
  { char: '\u26A0', label: 'Attention' },
  { char: '\u2605', label: 'Important' },
  { char: '\u2192', label: 'Fleche' },
  { char: '\u2022', label: 'Point' },
  { char: '\u2665', label: 'Sante' },
  { char: '\u2295', label: 'Ajouter' },
];

// ─── GENERIC DROPDOWN POPUP ───

function DropdownPopup({ children, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose]);
  return <div className="ne-color-popup" ref={ref}>{children}</div>;
}

// ─── TOOLBAR COMPONENT ───

function Toolbar({ editorRef }) {
  const [openPopup, setOpenPopup] = useState(null); // 'color' | 'hl' | 'size' | 'symbol' | null
  const [lastColor, setLastColor] = useState('#4ade80');
  const [lastHL, setLastHL] = useState('rgba(251,191,36,0.3)');
  const savedSelRef = useRef(null);

  const exec = (cmd, val) => {
    document.execCommand(cmd, false, val || null);
    editorRef.current?.focus();
  };

  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) savedSelRef.current = sel.getRangeAt(0).cloneRange();
  };

  const restoreSelection = () => {
    if (!savedSelRef.current) return;
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(savedSelRef.current);
    savedSelRef.current = null;
  };

  const togglePopup = (name) => { saveSelection(); setOpenPopup(p => p === name ? null : name); };
  const closePopup = () => setOpenPopup(null);

  const applyColor = (hex) => {
    restoreSelection();
    document.execCommand('foreColor', false, hex);
    setLastColor(hex);
    closePopup();
    editorRef.current?.focus();
  };

  const applyHighlight = (css) => {
    restoreSelection();
    document.execCommand('hiliteColor', false, css);
    setLastHL(css);
    closePopup();
    editorRef.current?.focus();
  };

  const applySize = (cmd) => {
    restoreSelection();
    document.execCommand('fontSize', false, cmd);
    closePopup();
    editorRef.current?.focus();
  };

  const insertSymbol = (char) => {
    restoreSelection();
    document.execCommand('insertText', false, char);
    closePopup();
    editorRef.current?.focus();
  };

  const insertBlock = (html) => {
    editorRef.current?.focus();
    document.execCommand('insertHTML', false, '<br/>' + html + '<br/>');
  };

  return (
    <div className="ne-toolbar">
      <button type="button" className="ne-tool-btn" onClick={() => exec('bold')} title="Gras"><strong>B</strong></button>
      <button type="button" className="ne-tool-btn" onClick={() => exec('italic')} title="Italique"><em>I</em></button>
      <button type="button" className="ne-tool-btn" onClick={() => exec('insertUnorderedList')} title="Liste">&#8226;</button>
      <button type="button" className="ne-tool-btn" onClick={() => exec('formatBlock', 'h3')} title="Sous-titre">H3</button>

      {/* Color picker */}
      <div className="ne-color-btn-wrapper">
        <button type="button" className="ne-tool-btn ne-color-btn" onClick={() => togglePopup('color')} title="Couleur du texte">
          <span className="ne-color-letter">A</span>
          <span className="ne-color-bar" style={{ background: lastColor }} />
        </button>
        {openPopup === 'color' && (
          <DropdownPopup onClose={closePopup}>
            {COLOR_PALETTE.map(c => (
              <button key={c.hex} type="button" className="ne-color-swatch" style={{ background: c.hex }} title={c.label} onClick={() => applyColor(c.hex)} />
            ))}
          </DropdownPopup>
        )}
      </div>

      {/* Highlight picker */}
      <div className="ne-color-btn-wrapper">
        <button type="button" className="ne-tool-btn ne-color-btn" onClick={() => togglePopup('hl')} title="Surlignage">
          <span className="ne-color-letter">H</span>
          <span className="ne-color-bar" style={{ background: lastHL }} />
        </button>
        {openPopup === 'hl' && (
          <DropdownPopup onClose={closePopup}>
            {HIGHLIGHT_PALETTE.map(c => (
              <button key={c.css} type="button" className="ne-color-swatch" style={{ background: c.css }} title={c.label} onClick={() => applyHighlight(c.css)} />
            ))}
          </DropdownPopup>
        )}
      </div>

      {/* Note block */}
      <button type="button" className="ne-tool-btn ne-tool-note" onClick={() => insertBlock(NOTE_HTML)} title="Note d'Anissa">Note</button>

      {/* Alert block */}
      <button type="button" className="ne-tool-btn ne-tool-alert" onClick={() => insertBlock(ALERT_HTML)} title="Alerte / Important">!</button>

      {/* Font size */}
      <div className="ne-color-btn-wrapper">
        <button type="button" className="ne-tool-btn" onClick={() => togglePopup('size')} title="Taille du texte">T&#8597;</button>
        {openPopup === 'size' && (
          <DropdownPopup onClose={closePopup}>
            <div className="ne-size-list">
              {SIZE_OPTIONS.map(s => (
                <button key={s.cmd} type="button" className="ne-size-option" style={{ fontSize: `${s.px}px` }} onClick={() => applySize(s.cmd)}>
                  {s.label}
                </button>
              ))}
            </div>
          </DropdownPopup>
        )}
      </div>

      {/* Symbols */}
      <div className="ne-color-btn-wrapper">
        <button type="button" className="ne-tool-btn" onClick={() => togglePopup('symbol')} title="Icones / Symboles">&#9734;</button>
        {openPopup === 'symbol' && (
          <DropdownPopup onClose={closePopup}>
            {SYMBOLS.map(s => (
              <button key={s.char} type="button" className="ne-color-swatch ne-symbol-swatch" title={s.label} onClick={() => insertSymbol(s.char)}>
                {s.char}
              </button>
            ))}
          </DropdownPopup>
        )}
      </div>

      <button type="button" className="ne-tool-btn" onClick={() => exec('undo')} title="Annuler">&#8617;</button>
    </div>
  );
}


// ─── SECTION BLOCK COMPONENT ───
// Content is NOT controlled by React state during editing.
// We use refs to track edits and only sync to parent on blur.

function SectionBlock({
  section,
  onContentRead,
  onDelete,
  onReset,
  resetCounter,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  justMoved,
}) {
  const editorRef = useRef(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Set initial HTML only on mount or when resetCounter changes (reset action)
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = section.html;
    }
  }, [resetCounter]);

  // Read current content from the DOM (not from state)
  const readContent = useCallback(() => {
    if (!editorRef.current) return { text: section.content, html: section.html };
    const html = editorRef.current.innerHTML;
    const text = htmlToPlaintext(html);
    return { text, html };
  }, [section.content, section.html]);

  // Expose the read function to the parent
  useEffect(() => {
    onContentRead(section.id, readContent);
  }, [section.id, readContent, onContentRead]);

  // Sync dirty flag on blur so save button knows there are changes
  const handleBlur = useCallback(() => {
    // No-op: parent reads content on demand via readContent ref
  }, []);

  const classNames = [
    'ne-section',
    justMoved ? 'ne-section-just-moved' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={classNames}>
      <div className="ne-section-header">
        <span
          className="ne-drag-handle"
          title="Utilisez les fleches pour reorganiser"
          aria-hidden="true"
        >
          &#8942;&#8942;
        </span>
        <div className="ne-move-buttons">
          <button
            type="button"
            className="ne-move-btn"
            onClick={() => onMoveUp(section.id)}
            disabled={!canMoveUp}
            title="Deplacer vers le haut"
            aria-label="Deplacer la section vers le haut"
          >
            &#9650;
          </button>
          <button
            type="button"
            className="ne-move-btn"
            onClick={() => onMoveDown(section.id)}
            disabled={!canMoveDown}
            title="Deplacer vers le bas"
            aria-label="Deplacer la section vers le bas"
          >
            &#9660;
          </button>
        </div>
        <button type="button" className="ne-collapse-btn" onClick={() => setIsCollapsed(!isCollapsed)}>
          {isCollapsed ? '+' : '–'}
        </button>
        <span className="ne-section-title">{section.title}</span>
        <div className="ne-section-actions">
          <button type="button" className="ne-action-btn" onClick={() => onReset(section.id)} title="Reinitialiser">&#8634;</button>
          <button type="button" className="ne-action-btn ne-delete-btn" onClick={() => onDelete(section.id)} title="Supprimer">&#10005;</button>
        </div>
      </div>
      {!isCollapsed && (
        <>
          <Toolbar editorRef={editorRef} />
          <div
            ref={editorRef}
            className="ne-editor"
            contentEditable
            onBlur={handleBlur}
            dangerouslySetInnerHTML={{ __html: section.html }}
            suppressContentEditableWarning
          />
        </>
      )}
    </div>
  );
}


// ─── MAIN EDITOR COMPONENT ───

export default function NutritionEditor({ planText, supplementsText, recipesText, form, client, onSave, onExportPDF, onExportCover }) {
  const [sections, setSections] = useState(() =>
    parsePlanToSections(planText, supplementsText, recipesText)
  );
  const [saved, setSaved] = useState(false);
  const [showFrigoPreview, setShowFrigoPreview] = useState(false);
  const [showMedicalSummary, setShowMedicalSummary] = useState(false);
  const [resetCounter, setResetCounter] = useState(0);
  const [showAddSection, setShowAddSection] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [showCoverForm, setShowCoverForm] = useState(false);
  const [coverFields, setCoverFields] = useState({
    prenom: form?.prenom || client?.prenom || '',
    objectif: form?.objectifPrincipalNutrition || form?.objectifPrincipal || '',
    date: new Date().toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    sousTitre: 'Plan nutrition personnalis\u00e9',
  });
  const [justMovedId, setJustMovedId] = useState(null);

  // Store content-reading functions from each SectionBlock
  const contentReadersRef = useRef({});

  // Re-parse when AI generates new content
  useEffect(() => {
    const newSections = parsePlanToSections(planText, supplementsText, recipesText);
    if (newSections.length > 0) {
      setSections(newSections);
      setResetCounter(c => c + 1);
    }
  }, [planText, supplementsText, recipesText]);

  // Register a content reader for a section
  const handleContentRead = useCallback((id, readFn) => {
    contentReadersRef.current[id] = readFn;
  }, []);

  // Read current content from all sections via their refs
  const readAllSections = useCallback(() => {
    return sections.map(s => {
      const reader = contentReadersRef.current[s.id];
      if (reader) {
        const { text, html } = reader();
        return { ...s, content: text, html };
      }
      return s;
    });
  }, [sections]);

  const handleDelete = useCallback((id) => {
    setSections(prev => prev.filter(s => s.id !== id));
    delete contentReadersRef.current[id];
    setSaved(false);
  }, []);

  const handleReset = useCallback((id) => {
    setSections(prev => prev.map(s =>
      s.id === id ? { ...s, content: s.originalContent, html: markdownToHtml(s.originalContent) } : s
    ));
    setResetCounter(c => c + 1);
    setSaved(false);
  }, []);

  const handleResetAll = () => {
    if (!confirm('Reinitialiser tout le contenu au plan original de l\'IA ?')) return;
    setSections(parsePlanToSections(planText, supplementsText, recipesText));
    setResetCounter(c => c + 1);
    setSaved(false);
  };

  const handleAddSection = () => {
    const title = newSectionTitle.trim();
    if (!title) return;
    // Snapshot current edited state so we don't lose user edits when re-rendering
    const currentEdited = readAllSections();
    const newSection = {
      id: crypto.randomUUID(),
      title: title.toUpperCase(),
      content: '',
      html: '',
      originalContent: '',
    };
    // Insert before the "Notes" section if present, otherwise at the end
    const notesIdx = currentEdited.findIndex(s => /^notes?\b/i.test(s.title));
    const next = [...currentEdited];
    if (notesIdx >= 0) {
      next.splice(notesIdx, 0, newSection);
    } else {
      next.push(newSection);
    }
    setSections(next);
    setNewSectionTitle('');
    setShowAddSection(false);
    setSaved(false);
  };

  // ─── Reorder sections via up/down buttons ───
  const moveSection = useCallback((id, direction) => {
    // Snapshot current edited content from the DOM so nothing gets lost
    const current = readAllSections();
    const idx = current.findIndex(s => s.id === id);
    if (idx === -1) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= current.length) return;
    const next = [...current];
    [next[idx], next[targetIdx]] = [next[targetIdx], next[idx]];
    setSections(next);
    setSaved(false);
    // Flash animation on the moved section
    setJustMovedId(id);
    setTimeout(() => {
      setJustMovedId(prev => (prev === id ? null : prev));
    }, 1000);
  }, [readAllSections]);

  const handleMoveUp = useCallback((id) => moveSection(id, 'up'), [moveSection]);
  const handleMoveDown = useCallback((id) => moveSection(id, 'down'), [moveSection]);

  const getEditedData = useCallback(() => {
    const current = readAllSections();
    const suppSection = current.find(s => /suppl[eé]ments?/i.test(s.title));
    const recSection = current.find(s => /recettes?/i.test(s.title));
    const planSections = current.filter(s => s !== suppSection && s !== recSection);
    return {
      plan: planSections.map(s => `## ${s.title}\n\n${s.content}`).join('\n\n'),
      supplements: suppSection?.content || '',
      recipes: recSection?.content || '',
    };
  }, [readAllSections]);

  const handleSave = () => {
    const d = getEditedData();
    onSave(d.plan, d.supplements, d.recipes);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  // Profile summary (read-only)
  const profileLines = [
    form?.age ? `Age : ${form.age} ans` : '',
    form?.genre || '',
    form?.poids ? `${form.poids} kg` : '',
    form?.taille ? `${form.taille} cm` : '',
    form?.objectifPrincipalNutrition ? `Objectif : ${form.objectifPrincipalNutrition}` : '',
    form?.allergies ? `Allergies : ${form.allergies}` : '',
  ].filter(Boolean);

  if (sections.length === 0) return null;

  return (
    <div className="ne-container">
      {/* Read-only profile summary */}
      <div className="ne-profile">
        <span className="ne-section-title">PROFIL CLIENT</span>
        <div className="ne-profile-content">
          {profileLines.map((l, i) => <span key={i} className="ne-profile-tag">{l}</span>)}
        </div>
      </div>

      {/* Editable sections */}
      {sections.map((section, idx) => (
        <SectionBlock
          key={section.id}
          section={section}
          onContentRead={handleContentRead}
          onDelete={handleDelete}
          onReset={handleReset}
          resetCounter={resetCounter}
          onMoveUp={handleMoveUp}
          onMoveDown={handleMoveDown}
          canMoveUp={idx > 0}
          canMoveDown={idx < sections.length - 1}
          justMoved={justMovedId === section.id}
        />
      ))}

      {/* Add section */}
      <div className="ne-add-section">
        {!showAddSection ? (
          <button type="button" className="btn btn-anissa-secondary ne-add-section-btn" onClick={() => setShowAddSection(true)}>
            + Ajouter une section
          </button>
        ) : (
          <div className="ne-add-section-form">
            <input
              type="text"
              value={newSectionTitle}
              onChange={e => setNewSectionTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAddSection(); }}
              placeholder="Titre de la section (ex: Rituel du matin)"
              className="ne-add-section-input"
              autoFocus
            />
            <button type="button" className="btn btn-sm btn-anissa-primary" onClick={handleAddSection} disabled={!newSectionTitle.trim()}>
              Ajouter
            </button>
            <button type="button" className="btn btn-sm btn-anissa-secondary" onClick={() => { setShowAddSection(false); setNewSectionTitle(''); }}>
              Annuler
            </button>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="ne-bottom-actions">
        <button type="button" className="btn btn-anissa-primary ne-save-btn" onClick={handleSave}>
          {saved ? 'Sauvegarde !' : 'Sauvegarder le plan'}
        </button>
        <button type="button" className="btn btn-anissa-secondary" onClick={() => {
          const d = getEditedData();
          onExportPDF(d.plan, d.supplements, d.recipes);
        }}>
          Exporter PDF
        </button>
        <button type="button" className="btn btn-anissa-secondary" onClick={() => setShowFrigoPreview(true)}>
          Fiche Frigo
        </button>
        {onExportCover && (
          <button type="button" className="btn btn-anissa-secondary" onClick={() => setShowCoverForm(true)}>
            Cover PDF
          </button>
        )}
        <button type="button" className="btn btn-anissa-secondary" onClick={() => setShowMedicalSummary(true)}>
          Resume medecin
        </button>
        <button type="button" className="btn btn-anissa-secondary ne-reset-all" onClick={handleResetAll}>
          Reinitialiser tout
        </button>
      </div>

      {showFrigoPreview && (
        <FicheFrigoPreview
          consultation={{
            nutritionPlan: getEditedData().plan,
            supplements: getEditedData().supplements,
            date: new Date().toISOString(),
          }}
          client={client}
          onClose={() => setShowFrigoPreview(false)}
        />
      )}

      {showMedicalSummary && (
        <MedicalSummary
          form={form}
          consultation={{ ...getEditedData(), bloodTestDone: true, dnaTestDone: true }}
          onClose={() => setShowMedicalSummary(false)}
        />
      )}

      {/* Cover PDF form modal */}
      {showCoverForm && (
        <div className="modal-overlay" onClick={() => setShowCoverForm(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 440, padding: 24 }}>
            <h3 style={{ marginBottom: 16, color: '#d4c9a8' }}>Cover PDF — personnaliser</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: '.8rem', color: '#8a8a7a', display: 'block', marginBottom: 4 }}>Prenom client</label>
                <input type="text" value={coverFields.prenom} onChange={e => setCoverFields(p => ({ ...p, prenom: e.target.value }))} style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ fontSize: '.8rem', color: '#8a8a7a', display: 'block', marginBottom: 4 }}>Objectif principal</label>
                <input type="text" value={coverFields.objectif} onChange={e => setCoverFields(p => ({ ...p, objectif: e.target.value }))} style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ fontSize: '.8rem', color: '#8a8a7a', display: 'block', marginBottom: 4 }}>Date</label>
                <input type="text" value={coverFields.date} onChange={e => setCoverFields(p => ({ ...p, date: e.target.value }))} style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ fontSize: '.8rem', color: '#8a8a7a', display: 'block', marginBottom: 4 }}>Sous-titre</label>
                <input type="text" value={coverFields.sousTitre} onChange={e => setCoverFields(p => ({ ...p, sousTitre: e.target.value }))} style={{ width: '100%' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button className="btn btn-sm btn-anissa-primary" onClick={() => { onExportCover(coverFields); setShowCoverForm(false); }}>Exporter Cover</button>
              <button className="btn btn-sm btn-secondary" onClick={() => setShowCoverForm(false)}>Annuler</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
