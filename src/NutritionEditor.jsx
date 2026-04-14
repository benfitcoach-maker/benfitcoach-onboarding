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

// ─── MINI TOOLBAR (simplified for preview-first editor) ───

function MiniToolbar({ editorRef }) {
  const exec = (cmd, val) => {
    document.execCommand(cmd, false, val || null);
    editorRef.current?.focus();
  };

  return (
    <div className="ne-toolbar" style={{ padding: '4px 8px', gap: 4 }}>
      <button type="button" className="ne-tool-btn" onClick={() => exec('bold')} title="Gras"><strong>B</strong></button>
      <button type="button" className="ne-tool-btn ne-tool-note" onClick={() => {
        editorRef.current?.focus();
        document.execCommand('insertHTML', false, '<br/>' + NOTE_HTML + '<br/>');
      }} title="Note d'Anissa">Note</button>
      <button type="button" className="ne-tool-btn ne-tool-alert" onClick={() => {
        editorRef.current?.focus();
        document.execCommand('insertHTML', false, '<br/>' + ALERT_HTML + '<br/>');
      }} title="Alerte">!</button>
      <button type="button" className="ne-tool-btn" onClick={() => exec('undo')} title="Annuler">&#8617;</button>
    </div>
  );
}


// ─── PREMIUM SECTION RENDER (read-only, like PDF body) ───

function PremiumSectionRender({ content }) {
  const lines = (content || '').split('\n');
  return (
    <div style={{ fontSize: '.83rem', lineHeight: 1.65, color: '#d4c9a8' }}>
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} style={{ height: 6 }} />;

        // Sub-header
        if (/^#{1,4}\s+/.test(trimmed) || /^\*\*[^*]+\*\*\s*$/.test(trimmed)) {
          const title = trimmed.replace(/^#+\s+/, '').replace(/\*\*/g, '');
          return <div key={i} style={{ fontWeight: 700, color: '#f0f0e8', marginTop: 8, marginBottom: 4 }}>{title}</div>;
        }

        // Bullet
        if (/^[-–•]\s/.test(trimmed)) {
          return (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 2 }}>
              <span style={{ color: '#4ade80', fontWeight: 700, flexShrink: 0 }}>-</span>
              <span>{trimmed.replace(/^[-–•]\s+/, '')}</span>
            </div>
          );
        }

        // Numbered
        if (/^\d+[.)]\s/.test(trimmed)) {
          const num = trimmed.match(/^(\d+)/)[1];
          return (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 2 }}>
              <span style={{ fontWeight: 700, minWidth: 18, flexShrink: 0 }}>{num}.</span>
              <span>{trimmed.replace(/^\d+[.)]\s+/, '')}</span>
            </div>
          );
        }

        // Bold inline
        if (/^\*\*[^*]+\*\*/.test(trimmed)) {
          return <div key={i} style={{ fontWeight: 600, marginBottom: 2 }}>{trimmed.replace(/\*\*/g, '')}</div>;
        }

        // Note/alert blocks
        if (/^\{\{note\}\}/.test(trimmed)) {
          return <div key={i} style={{ borderLeft: '3px solid #4ade80', padding: '6px 10px', margin: '4px 0', background: 'rgba(74,222,128,0.05)', borderRadius: 4, fontSize: '.8rem' }}>{trimmed.replace(/\{\{\/?(note|alert)\}\}/g, '')}</div>;
        }
        if (/^\{\{alert\}\}/.test(trimmed)) {
          return <div key={i} style={{ borderLeft: '3px solid #f87171', padding: '6px 10px', margin: '4px 0', background: 'rgba(248,113,113,0.05)', borderRadius: 4, fontSize: '.8rem', color: '#f87171' }}>{trimmed.replace(/\{\{\/?(note|alert)\}\}/g, '')}</div>;
        }

        return <div key={i} style={{ marginBottom: 2 }}>{trimmed}</div>;
      })}
    </div>
  );
}


// ─── SECTION BLOCK COMPONENT (preview-first) ───

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
  isActive,
  onActivate,
}) {
  const editorRef = useRef(null);
  const sectionRef = useRef(null);
  const [localContent, setLocalContent] = useState(section.content);

  // Sync local content when reset
  useEffect(() => {
    setLocalContent(section.content);
  }, [resetCounter]);

  // Read current content
  const readContent = useCallback(() => {
    if (isActive && editorRef.current) {
      const html = editorRef.current.innerHTML;
      const text = htmlToPlaintext(html);
      return { text, html };
    }
    return { text: localContent, html: markdownToHtml(localContent) };
  }, [isActive, localContent]);

  // Expose read function to parent
  useEffect(() => {
    onContentRead(section.id, readContent);
  }, [section.id, readContent, onContentRead]);

  // Auto-save when leaving active state
  useEffect(() => {
    if (!isActive && editorRef.current) {
      const text = htmlToPlaintext(editorRef.current.innerHTML);
      setLocalContent(text);
    }
  }, [isActive]);

  // Focus editor when becoming active
  useEffect(() => {
    if (isActive && editorRef.current) {
      editorRef.current.focus();
    }
  }, [isActive]);

  // Click on preview → activate this section
  const handleContentClick = () => {
    if (!isActive) onActivate(section.id);
  };

  const classNames = [
    'ne-section',
    justMoved ? 'ne-section-just-moved' : '',
  ].filter(Boolean).join(' ');

  // Premium card style
  const cardStyle = {
    background: 'rgba(255,255,255,.03)',
    border: isActive ? '1.5px solid rgba(74,222,128,.4)' : '1px solid rgba(255,255,255,.06)',
    borderRadius: 10,
    marginBottom: 12,
    overflow: 'hidden',
    transition: 'border-color .2s',
  };

  const headerStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 14px',
    background: isActive ? 'rgba(26,46,31,.25)' : 'rgba(26,46,31,.15)',
    borderBottom: '1px solid rgba(255,255,255,.06)',
    transition: 'background .2s',
  };

  const titleStyle = {
    flex: 1,
    fontSize: '.82rem',
    fontWeight: 700,
    color: '#f0f0e8',
    textTransform: 'uppercase',
    letterSpacing: '.4px',
  };

  return (
    <div className={classNames} style={cardStyle} ref={sectionRef}>
      {/* Header: locked title + action buttons */}
      <div style={headerStyle}>
        <div className="ne-move-buttons" style={{ display: 'flex', gap: 2 }}>
          <button type="button" className="ne-move-btn" onClick={() => onMoveUp(section.id)} disabled={!canMoveUp} title="Monter">&#9650;</button>
          <button type="button" className="ne-move-btn" onClick={() => onMoveDown(section.id)} disabled={!canMoveDown} title="Descendre">&#9660;</button>
        </div>
        <span style={titleStyle}>{section.title}</span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button type="button" className="ne-action-btn" onClick={() => onReset(section.id)} title="Reinitialiser">&#8634;</button>
          <button type="button" className="ne-action-btn ne-delete-btn" onClick={() => onDelete(section.id)} title="Supprimer">&#10005;</button>
        </div>
      </div>

      {/* Body: click-to-edit */}
      <div style={{ padding: '12px 16px' }}>
        {isActive ? (
          <>
            <MiniToolbar editorRef={editorRef} />
            <div
              ref={editorRef}
              className="ne-editor"
              contentEditable
              dangerouslySetInnerHTML={{ __html: markdownToHtml(localContent) }}
              suppressContentEditableWarning
              style={{ minHeight: 80, padding: '8px 0' }}
            />
          </>
        ) : (
          <div onClick={handleContentClick} style={{ cursor: 'text', minHeight: 40 }}>
            <PremiumSectionRender content={localContent} />
          </div>
        )}
      </div>
    </div>
  );
}


// ─── MAIN EDITOR COMPONENT ───

export default function NutritionEditor({ planText, supplementsText, recipesText, form, client, onSave, onExportPDF, onExportCover, onExportPack, getEditedDataRef, hideActions = false }) {
  const [sections, setSections] = useState(() =>
    parsePlanToSections(planText, supplementsText, recipesText)
  );
  const [saved, setSaved] = useState(false);
  const [showFrigoPreview, setShowFrigoPreview] = useState(false);
  const [showMedicalSummary, setShowMedicalSummary] = useState(false);
  const [resetCounter, setResetCounter] = useState(0);
  const [showAddSection, setShowAddSection] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showCoverForm, setShowCoverForm] = useState(false);
  const [coverFields, setCoverFields] = useState({
    prenom: form?.prenom || client?.prenom || '',
    objectif: form?.objectifPrincipalNutrition || form?.objectifPrincipal || '',
    date: new Date().toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    sousTitre: 'Plan nutrition personnalis\u00e9',
  });
  const [justMovedId, setJustMovedId] = useState(null);
  const [activeSectionId, setActiveSectionId] = useState(null);
  const editorContainerRef = useRef(null);

  // Store content-reading functions from each SectionBlock
  const contentReadersRef = useRef({});

  // Deactivate section when clicking outside any section
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!activeSectionId) return;
      // Don't deactivate if clicking inside the editor container (toolbar buttons, etc.)
      if (editorContainerRef.current && editorContainerRef.current.contains(e.target)) {
        // But do deactivate if the click is on a non-section area (buttons bar, profile, etc.)
        const sectionEl = e.target.closest('.ne-section');
        if (!sectionEl) setActiveSectionId(null);
      } else {
        setActiveSectionId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeSectionId]);

  const handleActivateSection = useCallback((id) => {
    setActiveSectionId(id);
  }, []);

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
    setActiveSectionId(null);
    setSections(prev => prev.map(s =>
      s.id === id ? { ...s, content: s.originalContent, html: markdownToHtml(s.originalContent) } : s
    ));
    setResetCounter(c => c + 1);
    setSaved(false);
  }, []);

  const handleResetAll = () => {
    if (!confirm('Reinitialiser tout le contenu au plan original de l\'IA ?')) return;
    setActiveSectionId(null);
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

  // Expose getEditedData to parent via ref callback
  useEffect(() => {
    if (getEditedDataRef) getEditedDataRef.current = getEditedData;
  }, [getEditedData, getEditedDataRef]);

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
    <div className="ne-container" ref={editorContainerRef}>
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
          isActive={activeSectionId === section.id}
          onActivate={handleActivateSection}
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

      {/* Action buttons — restructured (hidden when parent cockpit provides them) */}
      {!hideActions && (
      <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Action principale */}
        <div style={{ borderRadius: 14, border: '1px solid rgba(42,157,92,.35)', background: 'rgba(26,58,42,.25)', padding: '16px 18px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="ne-actions-responsive" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: '.95rem', fontWeight: 600, color: '#f0f0e8' }}>Export client</div>
                <div style={{ fontSize: '.8rem', color: 'rgba(106,191,138,.7)', marginTop: 2 }}>Telecharger le plan nutrition au format PDF pret a envoyer.</div>
              </div>
              <button type="button" className="btn btn-anissa-primary" style={{ padding: '10px 22px', borderRadius: 12, fontSize: '.88rem', whiteSpace: 'nowrap' }} onClick={() => {
                const d = getEditedData();
                onExportPDF(d.plan, d.supplements, d.recipes);
              }}>
                Telecharger le plan PDF
              </button>
            </div>
          </div>
        </div>

        {/* Actions secondaires */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
          <button type="button" className="btn btn-anissa-secondary" style={{ borderRadius: 12, padding: '10px 16px', fontSize: '.84rem' }} onClick={() => {
            const d = getEditedData();
            onExportPDF(d.plan, d.supplements, d.recipes);
          }}>
            Voir le PDF
          </button>
          <button type="button" className="btn btn-anissa-secondary" style={{ borderRadius: 12, padding: '10px 16px', fontSize: '.84rem' }} onClick={() => setShowFrigoPreview(true)}>
            Fiche frigo
          </button>
          <button type="button" className="btn btn-anissa-secondary" style={{ borderRadius: 12, padding: '10px 16px', fontSize: '.84rem', borderColor: 'rgba(106,191,138,.25)', color: '#8abf9a' }} onClick={handleSave}>
            {saved ? 'Sauvegarde !' : 'Sauvegarder le plan'}
          </button>
        </div>

        {/* Outils avances */}
        <div style={{ borderRadius: 14, border: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.03)' }}>
          <button type="button" onClick={() => setShowAdvanced(v => !v)} style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
            <div>
              <div style={{ fontSize: '.85rem', fontWeight: 600, color: '#f0f0e8' }}>Outils avances</div>
              <div style={{ fontSize: '.72rem', color: 'rgba(255,255,255,.4)', marginTop: 2 }}>Cover, resume medecin, dossier complet, reinitialisation</div>
            </div>
            <span style={{ fontSize: '.9rem', color: 'rgba(255,255,255,.45)', fontWeight: 600 }}>{showAdvanced ? '−' : '+'}</span>
          </button>
          {showAdvanced && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, borderTop: '1px solid rgba(255,255,255,.08)', padding: 14 }}>
              {onExportCover && (
                <button type="button" className="btn btn-anissa-secondary" style={{ borderRadius: 12, padding: '10px 14px', fontSize: '.82rem' }} onClick={() => setShowCoverForm(true)}>
                  Personnaliser la cover
                </button>
              )}
              <button type="button" className="btn btn-anissa-secondary" style={{ borderRadius: 12, padding: '10px 14px', fontSize: '.82rem' }} onClick={() => setShowMedicalSummary(true)}>
                Resume medecin
              </button>
              {onExportPack && (
                <button type="button" className="btn btn-anissa-secondary" style={{ borderRadius: 12, padding: '10px 14px', fontSize: '.82rem' }} onClick={() => {
                  const d = getEditedData();
                  onExportPack(d.plan, d.supplements, d.recipes);
                }}>
                  Telecharger dossier client complet
                </button>
              )}
              <button type="button" style={{ borderRadius: 12, padding: '10px 14px', fontSize: '.82rem', background: 'rgba(212,92,76,.08)', border: '1px solid rgba(212,92,76,.25)', color: '#d4806c', cursor: 'pointer', transition: 'background .15s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(212,92,76,.15)'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(212,92,76,.08)'} onClick={handleResetAll}>
                Reinitialiser
              </button>
            </div>
          )}
        </div>
      </div>
      )}

      {showFrigoPreview && (() => {
        const edited = getEditedData();
        return (
          <FicheFrigoPreview
            consultation={{
              nutritionPlan: edited.plan,
              supplements: edited.supplements,
              date: new Date().toISOString(),
            }}
            sections={parsePlanToSections(edited.plan, edited.supplements, edited.recipes)}
            client={client}
            onClose={() => setShowFrigoPreview(false)}
          />
        );
      })()}

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
