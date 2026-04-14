import { useState, useRef, useCallback, useEffect } from 'react';
import FicheFrigoPreview from './FicheFrigoPreview';
import MedicalSummary from './MedicalSummary';
import { improveSection } from './services/aiClient';

// ─── MARKDOWN → SECTIONS PARSER ───
// Parses raw plan text into structured sections. Used on initial load
// and on authoritative rewrites (AI gen, template, version restore).
// NOT used during user editing — that's the key architectural change.

function parsePlanToSections(planText, supplementsText, recipesText) {
  const raw = [];
  if (!planText && !supplementsText && !recipesText) return raw;

  const fullText = planText || '';
  const lines = fullText.split('\n');
  let currentTitle = 'PLAN NUTRITION';
  let currentContent = [];

  const flushSection = () => {
    const content = currentContent.join('\n').trim();
    // Only create section if there is actual content (no empty cards)
    if (content) {
      raw.push({
        title: currentTitle,
        content,
      });
    }
    currentContent = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
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

  // ─── Deduplicate: merge sections with identical titles ───
  const merged = new Map();
  for (const s of raw) {
    if (merged.has(s.title)) {
      const existing = merged.get(s.title);
      existing.content += '\n\n' + s.content;
    } else {
      merged.set(s.title, { ...s });
    }
  }

  // Build final sections with IDs
  const sections = [...merged.values()].map(s => ({
    id: crypto.randomUUID(),
    title: s.title,
    content: s.content,
    originalContent: s.content,
  }));

  if (supplementsText?.trim()) {
    sections.push({
      id: crypto.randomUUID(),
      title: 'SUPPLEMENTS RECOMMANDES',
      content: supplementsText.trim(),
      originalContent: supplementsText.trim(),
    });
  }

  if (recipesText?.trim()) {
    sections.push({
      id: crypto.randomUUID(),
      title: 'RECETTES RECOMMANDEES',
      content: recipesText.trim(),
      originalContent: recipesText.trim(),
    });
  }

  return sections;
}

// ─── PREMIUM SECTION RENDER (read-only preview, renders markdown as styled HTML) ───

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
              <span>{renderInlineFormatting(trimmed.replace(/^[-–•]\s+/, ''))}</span>
            </div>
          );
        }

        // Numbered
        if (/^\d+[.)]\s/.test(trimmed)) {
          const num = trimmed.match(/^(\d+)/)[1];
          return (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 2 }}>
              <span style={{ fontWeight: 700, minWidth: 18, flexShrink: 0 }}>{num}.</span>
              <span>{renderInlineFormatting(trimmed.replace(/^\d+[.)]\s+/, ''))}</span>
            </div>
          );
        }

        // Bold line
        if (/^\*\*[^*]+\*\*/.test(trimmed)) {
          return <div key={i} style={{ fontWeight: 600, marginBottom: 2 }}>{trimmed.replace(/\*\*/g, '')}</div>;
        }

        // Note block
        if (/^\{\{note\}\}/.test(trimmed)) {
          return <div key={i} style={{ borderLeft: '3px solid #4ade80', padding: '6px 10px', margin: '4px 0', background: 'rgba(74,222,128,0.05)', borderRadius: 4, fontSize: '.8rem' }}>{trimmed.replace(/\{\{\/?(note|alert)\}\}/g, '')}</div>;
        }
        if (/^\{\{alert\}\}/.test(trimmed)) {
          return <div key={i} style={{ borderLeft: '3px solid #f87171', padding: '6px 10px', margin: '4px 0', background: 'rgba(248,113,113,0.05)', borderRadius: 4, fontSize: '.8rem', color: '#f87171' }}>{trimmed.replace(/\{\{\/?(note|alert)\}\}/g, '')}</div>;
        }

        return <div key={i} style={{ marginBottom: 2 }}>{renderInlineFormatting(trimmed)}</div>;
      })}
    </div>
  );
}

// Render inline **bold** and *italic* in preview
function renderInlineFormatting(text) {
  if (!text) return text;
  // Split on **bold** and *italic* markers
  const parts = [];
  let remaining = text;
  let key = 0;
  while (remaining.length > 0) {
    // Bold
    const boldMatch = remaining.match(/\*\*([^*]+)\*\*/);
    // Italic
    const italicMatch = remaining.match(/\*([^*]+)\*/);

    const match = boldMatch && italicMatch
      ? (boldMatch.index <= italicMatch.index ? boldMatch : italicMatch)
      : boldMatch || italicMatch;

    if (!match) {
      parts.push(remaining);
      break;
    }

    if (match.index > 0) {
      parts.push(remaining.slice(0, match.index));
    }

    const isBold = match[0].startsWith('**');
    if (isBold) {
      parts.push(<strong key={key++} style={{ color: '#f0f0e8' }}>{match[1]}</strong>);
    } else {
      parts.push(<em key={key++}>{match[1]}</em>);
    }

    remaining = remaining.slice(match.index + match[0].length);
  }
  return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : parts;
}


// ─── SECTION BLOCK (controlled textarea, single source of truth) ───

function SectionBlock({
  section,
  onContentChange,
  onDelete,
  onReset,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  justMoved,
  isActive,
  onActivate,
  onImprove,
  isImproving,
  aiProposal,
  onAcceptProposal,
  onAppendProposal,
  onRejectProposal,
}) {
  const [hovered, setHovered] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const textareaRef = useRef(null);

  // Auto-focus textarea when section becomes active
  useEffect(() => {
    if (isActive && textareaRef.current) {
      textareaRef.current.focus();
      // Place cursor at end
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
    }
  }, [isActive]);

  // Auto-resize textarea to fit content
  const autoResize = useCallback((el) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.max(80, el.scrollHeight) + 'px';
  }, []);

  // Resize on mount/activation
  useEffect(() => {
    if (isActive && textareaRef.current) {
      autoResize(textareaRef.current);
    }
  }, [isActive, autoResize]);

  const handleChange = (e) => {
    onContentChange(section.id, e.target.value);
    autoResize(e.target);
  };

  const handleContentClick = () => {
    if (!isActive) onActivate(section.id);
  };

  const classNames = [
    'ne-section',
    isActive ? 'ne-section--active' : '',
    justMoved ? 'ne-section-just-moved' : '',
  ].filter(Boolean).join(' ');

  const cardStyle = {
    borderRadius: 10,
    marginBottom: 12,
    overflow: 'hidden',
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
    fontSize: '.82rem',
    fontWeight: 700,
    color: '#f0f0e8',
    textTransform: 'uppercase',
    letterSpacing: '.4px',
  };

  return (
    <div className={classNames} style={cardStyle} onMouseEnter={() => setHovered(true)} onMouseLeave={() => { setHovered(false); setShowActions(false); }}>
      {/* Header */}
      <div style={headerStyle}>
        <div className="ne-move-buttons" style={{
          display: 'flex', flexDirection: 'column', gap: 1,
          opacity: hovered ? 1 : 0,
          transition: 'opacity .15s ease',
          flexShrink: 0,
        }}>
          <button type="button" className="ne-move-btn" onClick={() => onMoveUp(section.id)} disabled={!canMoveUp} title="Monter">&#9650;</button>
          <button type="button" className="ne-move-btn" onClick={() => onMoveDown(section.id)} disabled={!canMoveDown} title="Descendre">&#9660;</button>
        </div>
        <span style={titleStyle}>{section.title}</span>
        <div style={{ flex: 1 }} />
        {!isActive && section.content.trim() && (
          <span style={{ fontSize: '.65rem', color: 'rgba(255,255,255,.25)', padding: '2px 6px', background: 'rgba(255,255,255,.05)', borderRadius: 4, whiteSpace: 'nowrap' }}>
            {section.content.trim().split('\n').length} lignes
          </span>
        )}
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          {/* Bouton ✨ Améliorer */}
          {!aiProposal && (
            isImproving ? (
              <span style={{
                fontSize:'.7rem', color:'rgba(106,191,138,.7)',
                display:'flex', alignItems:'center', gap:4,
                opacity: 1,
              }}>
                <span style={{ animation:'neSpin .8s linear infinite', display:'inline-block' }}>{'\u2728'}</span>
                IA...
              </span>
            ) : (
              <div style={{ position:'relative' }}>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setShowActions(a => !a); }}
                  style={{
                    background:'none',
                    border:'1px solid rgba(106,191,138,.25)',
                    borderRadius:6, padding:'2px 8px',
                    color:'rgba(106,191,138,.6)', fontSize:'.7rem',
                    cursor:'pointer', transition:'all .15s',
                    opacity: hovered || isActive ? 1 : 0,
                    display:'flex', alignItems:'center', gap:4,
                  }}
                  title="Am\u00e9liorer avec l'IA"
                >
                  {'\u2728'} IA
                </button>
                {showActions && (
                  <div style={{
                    position:'absolute', top:'100%', right:0, zIndex:100,
                    background:'#1a2e1f', border:'1px solid rgba(106,191,138,.2)',
                    borderRadius:10, overflow:'hidden', minWidth:200,
                    boxShadow:'0 8px 24px rgba(0,0,0,.5)', marginTop:4,
                  }}
                  onClick={e => e.stopPropagation()}
                  >
                    {[
                      { key:'improve',     label:'\u2728 Am\u00e9liorer' },
                      { key:'simplify',    label:'\ud83d\udcdd Simplifier' },
                      { key:'actionnable', label:'\u26a1 Rendre actionnable' },
                      { key:'adapt',       label:'\ud83c\udfaf Adapter au client' },
                      { key:'rewrite',     label:'\ud83d\udcbc Reformuler pro' },
                    ].map(({ key, label }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => { setShowActions(false); onImprove(section.id, key); }}
                        style={{
                          display:'block', width:'100%', textAlign:'left',
                          padding:'9px 14px', background:'none', border:'none',
                          color:'#b0c4a8', cursor:'pointer', fontSize:'.82rem',
                          transition:'background .15s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(106,191,138,.08)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'none'}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          )}
          {/* Boutons reset/delete */}
          <div style={{
            display:'flex', gap:4,
            opacity: hovered || isActive ? 1 : 0,
            transition:'opacity .2s',
          }}>
            <button type="button" className="ne-action-btn" onClick={() => onReset(section.id)} title="Reinitialiser">&#8634;</button>
            <button type="button" className="ne-action-btn ne-delete-btn" onClick={() => onDelete(section.id)} title="Supprimer">&#10005;</button>
          </div>
        </div>
      </div>

      {/* Body: textarea when active, premium render when inactive */}
      <div style={{ padding: '12px 16px' }}>
        {isActive ? (
          <div>
            {/* Simple formatting hints */}
            <div style={{ fontSize: '.7rem', color: 'rgba(255,255,255,.3)', marginBottom: 6, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <span>**gras**</span>
              <span>*italique*</span>
              <span>- liste</span>
              <span>{'{{note}}...{{/note}}'}</span>
              <span>{'{{alert}}...{{/alert}}'}</span>
            </div>
            <textarea
              ref={textareaRef}
              value={section.content}
              onChange={handleChange}
              className="ne-editor ne-textarea-editor"
              placeholder="Commencez a ecrire le contenu de cette section..."
              style={{
                width: '100%',
                minHeight: 80,
                padding: '8px 0',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: '#d4c9a8',
                fontSize: '.83rem',
                lineHeight: 1.65,
                fontFamily: 'inherit',
                resize: 'none',
                overflow: 'hidden',
              }}
              spellCheck={false}
            />
          </div>
        ) : (
          <div onClick={handleContentClick} style={{ cursor: 'text', minHeight: 40 }}>
            {section.content.trim() ? (
              <PremiumSectionRender content={section.content} />
            ) : (
              <div style={{ color: 'rgba(255,255,255,.2)', fontStyle: 'italic', fontSize: '.8rem', padding: '8px 0' }}>
                Section vide — cliquez pour editer
              </div>
            )}
          </div>
        )}
      </div>

      {/* AI Proposal panel */}
      {aiProposal && (
        <div style={{
          borderTop:'1px solid rgba(106,191,138,.2)',
          background:'rgba(26,58,42,.3)',
          padding:'14px 16px',
          animation:'neSlideIn .2s ease',
        }}>
          <div style={{ fontSize:'.72rem', color:'rgba(106,191,138,.6)',
            marginBottom:8, fontWeight:600, textTransform:'uppercase',
            letterSpacing:'.5px' }}>
            {'\u2728'} Proposition IA
          </div>
          <div style={{
            background:'rgba(0,0,0,.2)', borderRadius:8, padding:'10px 14px',
            fontSize:'.82rem', lineHeight:1.65, color:'#d4c9a8',
            whiteSpace:'pre-wrap', maxHeight:200, overflowY:'auto',
            border:'1px solid rgba(106,191,138,.15)',
          }}>
            {aiProposal}
          </div>
          <div style={{ display:'flex', gap:8, marginTop:10 }}>
            <button
              type="button"
              onClick={() => onAcceptProposal(section.id)}
              style={{
                padding:'6px 14px', borderRadius:8, border:'none',
                background:'rgba(106,191,138,.2)',
                color:'#8abf9a', cursor:'pointer', fontSize:'.8rem',
                fontWeight:600, transition:'all .15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background='rgba(106,191,138,.35)'}
              onMouseLeave={e => e.currentTarget.style.background='rgba(106,191,138,.2)'}
            >
              {'\u2705'} Remplacer
            </button>
            <button
              type="button"
              onClick={() => onAppendProposal(section.id)}
              style={{
                padding:'6px 14px', borderRadius:8,
                border:'1px solid rgba(106,191,138,.25)',
                background:'none', color:'#b0c4a8', cursor:'pointer',
                fontSize:'.8rem', transition:'all .15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background='rgba(106,191,138,.08)'}
              onMouseLeave={e => e.currentTarget.style.background='none'}
            >
              {'\u2795'} Ajouter {'\u00e0'} la suite
            </button>
            <button
              type="button"
              onClick={() => onRejectProposal(section.id)}
              style={{
                padding:'6px 14px', borderRadius:8,
                border:'1px solid rgba(255,255,255,.06)',
                background:'none', color:'rgba(255,255,255,.35)',
                cursor:'pointer', fontSize:'.8rem', transition:'all .15s',
                marginLeft:'auto',
              }}
            >
              {'\u274c'} Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


// ─── MAIN EDITOR COMPONENT ───

export default function NutritionEditor({ planText, supplementsText, recipesText, form, client, onSave, onExportPDF, onExportCover, onExportPack, getEditedDataRef, onDraftChange, hideActions = false }) {
  // sections[] is THE single source of truth for all content.
  // Each section.content is plain text/markdown, directly edited via controlled textarea.
  const [sections, setSections] = useState(() =>
    parsePlanToSections(planText, supplementsText, recipesText)
  );
  const [saved, setSaved] = useState(false);
  const [showFrigoPreview, setShowFrigoPreview] = useState(false);
  const [showMedicalSummary, setShowMedicalSummary] = useState(false);
  const [showAddSection, setShowAddSection] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showCoverForm, setShowCoverForm] = useState(false);
  const [coverFields, setCoverFields] = useState({
    prenom: form?.prenom || client?.prenom || '',
    objectif: form?.objectifPrincipalNutrition || form?.objectifPrincipal || '',
    date: new Date().toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    sousTitre: 'Plan nutrition personnalisé',
  });
  const [justMovedId, setJustMovedId] = useState(null);
  const [activeSectionId, setActiveSectionId] = useState(null);
  const editorContainerRef = useRef(null);

  // Refs that always point to the latest values — used for unmount flush
  const sectionsRef = useRef(sections);
  const onDraftChangeRef = useRef(onDraftChange);
  useEffect(() => { sectionsRef.current = sections; }, [sections]);
  useEffect(() => { onDraftChangeRef.current = onDraftChange; }, [onDraftChange]);

  // ─── Click outside → deactivate section ───
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!activeSectionId) return;
      if (editorContainerRef.current && editorContainerRef.current.contains(e.target)) {
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

  // ─── Build edited data from sections (pure function) ───
  const buildEditedData = useCallback((sectionsList) => {
    const suppSection = sectionsList.find(s => /suppl[eé]ments?/i.test(s.title));
    const recSection = sectionsList.find(s => /recettes?/i.test(s.title));
    const planSections = sectionsList.filter(s => s !== suppSection && s !== recSection);
    return {
      plan: planSections.map(s => `## ${s.title}\n\n${s.content}`).join('\n\n'),
      supplements: suppSection?.content || '',
      recipes: recSection?.content || '',
    };
  }, []);

  const getEditedData = useCallback(() => {
    return buildEditedData(sections);
  }, [sections, buildEditedData]);

  // ─── Content change handler (called by SectionBlock on every keystroke) ───
  const draftDebounceRef = useRef(null);

  const handleContentChange = useCallback((id, newContent) => {
    setSections(prev => {
      const next = prev.map(s =>
        s.id === id ? { ...s, content: newContent } : s
      );
      // Keep ref in sync immediately so unmount flush always has latest data
      sectionsRef.current = next;
      return next;
    });

    // Debounced push to parent for preview sync
    if (onDraftChangeRef.current) {
      if (draftDebounceRef.current) clearTimeout(draftDebounceRef.current);
      draftDebounceRef.current = setTimeout(() => {
        const data = buildEditedData(sectionsRef.current);
        onDraftChangeRef.current(data.plan, data.supplements, data.recipes);
      }, 300);
    }
  }, [buildEditedData]);

  // Expose getEditedData to parent via ref callback
  useEffect(() => {
    if (getEditedDataRef) getEditedDataRef.current = getEditedData;
  }, [getEditedData, getEditedDataRef]);

  // Flush debounce on unmount — uses refs to always read latest state
  useEffect(() => {
    return () => {
      if (draftDebounceRef.current) {
        clearTimeout(draftDebounceRef.current);
      }
      // Always flush latest sections to parent on unmount
      if (onDraftChangeRef.current) {
        const data = buildEditedData(sectionsRef.current);
        onDraftChangeRef.current(data.plan, data.supplements, data.recipes);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Section operations ───
  const handleDelete = useCallback((id) => {
    setSections(prev => prev.filter(s => s.id !== id));
    setSaved(false);
  }, []);

  const handleReset = useCallback((id) => {
    setSections(prev => prev.map(s =>
      s.id === id ? { ...s, content: s.originalContent } : s
    ));
    setSaved(false);
  }, []);

  const handleResetAll = () => {
    if (!confirm('Reinitialiser tout le contenu au plan original de l\'IA ?')) return;
    setActiveSectionId(null);
    setSections(parsePlanToSections(planText, supplementsText, recipesText));
    setSaved(false);
  };

  const handleAddSection = () => {
    const title = newSectionTitle.trim();
    if (!title) return;
    const newSection = {
      id: crypto.randomUUID(),
      title: title.toUpperCase(),
      content: '',
      originalContent: '',
    };
    setSections(prev => {
      const notesIdx = prev.findIndex(s => /^notes?\b/i.test(s.title));
      const next = [...prev];
      if (notesIdx >= 0) {
        next.splice(notesIdx, 0, newSection);
      } else {
        next.push(newSection);
      }
      return next;
    });
    setNewSectionTitle('');
    setShowAddSection(false);
    setSaved(false);
  };

  const moveSection = useCallback((id, direction) => {
    setSections(prev => {
      const idx = prev.findIndex(s => s.id === id);
      if (idx === -1) return prev;
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[targetIdx]] = [next[targetIdx], next[idx]];
      return next;
    });
    setSaved(false);
    setJustMovedId(id);
    setTimeout(() => {
      setJustMovedId(prev => (prev === id ? null : prev));
    }, 1000);
  }, []);

  const handleMoveUp = useCallback((id) => moveSection(id, 'up'), [moveSection]);
  const handleMoveDown = useCallback((id) => moveSection(id, 'down'), [moveSection]);

  // ─── AI Copilot ───
  const [improvingId, setImprovingId] = useState(null);
  const [proposals, setProposals] = useState({});

  const handleImprove = useCallback(async (id, action = 'improve') => {
    const section = sectionsRef.current.find(s => s.id === id);
    if (!section) return;
    setImprovingId(id);
    try {
      const result = await improveSection(form, section.title, section.content, action);
      if (result) {
        setProposals(prev => ({ ...prev, [id]: result }));
      }
    } catch (err) {
      console.error('[IA improve]', err.message);
    } finally {
      setImprovingId(null);
    }
  }, [form]);

  const handleAcceptProposal = useCallback((id) => {
    const proposal = proposals[id];
    if (!proposal) return;
    setSections(prev => prev.map(s =>
      s.id === id ? { ...s, content: proposal } : s
    ));
    setProposals(prev => { const next = {...prev}; delete next[id]; return next; });
    setSaved(false);
  }, [proposals]);

  const handleAppendProposal = useCallback((id) => {
    const proposal = proposals[id];
    if (!proposal) return;
    setSections(prev => prev.map(s =>
      s.id === id
        ? { ...s, content: s.content.trimEnd() + '\n\n' + proposal }
        : s
    ));
    setProposals(prev => { const next = {...prev}; delete next[id]; return next; });
    setSaved(false);
  }, [proposals]);

  const handleRejectProposal = useCallback((id) => {
    setProposals(prev => { const next = {...prev}; delete next[id]; return next; });
  }, []);

  const handleSave = () => {
    const d = getEditedData();
    onSave(d.plan, d.supplements, d.recipes);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  // Profile summary
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
          onContentChange={handleContentChange}
          onDelete={handleDelete}
          onReset={handleReset}
          onMoveUp={handleMoveUp}
          onMoveDown={handleMoveDown}
          canMoveUp={idx > 0}
          canMoveDown={idx < sections.length - 1}
          justMoved={justMovedId === section.id}
          isActive={activeSectionId === section.id}
          onActivate={handleActivateSection}
          onImprove={handleImprove}
          isImproving={improvingId === section.id}
          aiProposal={proposals[section.id] || null}
          onAcceptProposal={handleAcceptProposal}
          onAppendProposal={handleAppendProposal}
          onRejectProposal={handleRejectProposal}
        />
      ))}

      {/* Add section */}
      <div className="ne-add-section">
        {!showAddSection ? (
          <button
            type="button"
            className="ne-add-section-btn"
            onClick={() => setShowAddSection(true)}
            style={{
              width: '100%', padding: '10px', background: 'none',
              border: '1px dashed rgba(106,191,138,.3)', borderRadius: 8,
              color: 'rgba(106,191,138,.7)', cursor: 'pointer', fontSize: '.82rem',
              transition: 'all .2s', display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: 8,
            }}
          >
            <span style={{ fontSize: '1rem' }}>+</span> Ajouter une section
          </button>
        ) : (
          <div style={{
            background: 'rgba(26,46,31,.6)', border: '1px solid rgba(106,191,138,.2)',
            borderRadius: 10, padding: '14px', display: 'flex',
            flexDirection: 'column', gap: 10,
            animation: 'neAddSectionIn .2s ease',
          }}>
            {/* Presets rapides */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[
                'Plan alimentaire', 'Analyse du profil', 'Suppléments',
                'Recettes', 'Conseils pratiques', 'Libre'
              ].map(preset => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setNewSectionTitle(preset);
                  }}
                  style={{
                    padding: '4px 12px', borderRadius: 20, fontSize: '.75rem',
                    background: newSectionTitle === preset
                      ? 'rgba(106,191,138,.2)' : 'rgba(255,255,255,.04)',
                    border: newSectionTitle === preset
                      ? '1px solid rgba(106,191,138,.5)' : '1px solid rgba(255,255,255,.08)',
                    color: newSectionTitle === preset ? '#8abf9a' : '#b0c4a8',
                    cursor: 'pointer', transition: 'all .15s',
                  }}
                >
                  {preset}
                </button>
              ))}
            </div>
            {/* Input titre custom */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="text"
                value={newSectionTitle}
                onChange={e => setNewSectionTitle(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddSection(); if (e.key === 'Escape') { setShowAddSection(false); setNewSectionTitle(''); } }}
                placeholder="Ou saisissez un titre personnalisé..."
                className="ne-add-section-input"
                autoFocus
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className="btn btn-sm btn-anissa-primary"
                onClick={handleAddSection}
                disabled={!newSectionTitle.trim()}
              >
                Ajouter
              </button>
              <button
                type="button"
                className="btn btn-sm btn-anissa-secondary"
                onClick={() => { setShowAddSection(false); setNewSectionTitle(''); }}
              >
                ✕
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Action buttons (hidden when parent cockpit provides them) */}
      {!hideActions && (
      <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
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
