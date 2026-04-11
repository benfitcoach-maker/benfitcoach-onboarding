import { useState, useEffect, useMemo } from 'react';
import {
  BUILTIN_TEMPLATES,
  EMPTY_TEMPLATE,
  getAllTemplates,
  resolveTemplate,
  saveCustomTemplate,
  deleteCustomTemplate,
  getCustomTemplates,
  hasAnyInterviewNotes,
} from './interviewTemplates';

// ─── Style tokens (inline to keep this self-contained) ───
const COLORS = {
  bg: '#0a0908',
  border: '#c4a050',
  gold: '#c4a050',
  white: '#f0f0e8',
  grey: '#666',
  noteBg: '#1a1a18',
};

const styles = {
  overlay: {
    position: 'fixed', top: 0, right: 0, bottom: 0,
    width: 'min(400px, 100vw)',
    background: COLORS.bg,
    borderLeft: `2px solid ${COLORS.border}`,
    boxShadow: '-8px 0 30px rgba(0,0,0,.6)',
    zIndex: 2000,
    display: 'flex', flexDirection: 'column',
    fontFamily: 'inherit',
  },
  backdrop: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,.45)',
    zIndex: 1999,
  },
  header: {
    padding: '16px 18px 12px',
    borderBottom: `1px solid ${COLORS.border}44`,
    position: 'relative',
  },
  headerTitle: {
    color: COLORS.gold,
    fontSize: '13px', fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '.8px',
    margin: 0,
  },
  closeBtn: {
    position: 'absolute', top: 12, right: 12,
    background: 'transparent', border: 'none',
    color: COLORS.white, fontSize: '22px', cursor: 'pointer',
    width: 32, height: 32, lineHeight: 1,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: 4,
  },
  selectorLabel: {
    display: 'block',
    color: COLORS.gold, fontSize: '11px', textTransform: 'uppercase',
    letterSpacing: '.5px', marginTop: 8, marginBottom: 6,
  },
  select: {
    width: '100%',
    background: COLORS.noteBg,
    border: `1px solid ${COLORS.border}55`,
    color: COLORS.white,
    padding: '8px 10px', borderRadius: 6, fontSize: 13,
    cursor: 'pointer',
  },
  body: {
    flex: 1, overflowY: 'auto', padding: '12px 14px 40px',
  },
  stepBlock: {
    border: `1px solid ${COLORS.border}33`,
    borderRadius: 8, marginBottom: 10,
    background: 'rgba(196,160,80,.04)',
  },
  stepHeader: {
    padding: '10px 12px',
    cursor: 'pointer',
    color: COLORS.gold,
    fontSize: 12, fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '.5px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    userSelect: 'none',
  },
  chevron: { fontSize: 11, color: COLORS.gold },
  stepBody: {
    padding: '0 12px 12px',
  },
  question: {
    color: COLORS.white,
    fontSize: 14,
    fontStyle: 'italic',
    padding: '6px 8px',
    margin: '4px 0',
    borderRadius: 4,
    cursor: 'pointer',
    background: 'rgba(255,255,255,.02)',
    transition: 'background .15s',
  },
  questionAsked: {
    color: COLORS.grey,
    textDecoration: 'line-through',
  },
  noteArea: {
    width: '100%',
    marginTop: 8,
    background: COLORS.noteBg,
    color: COLORS.white,
    border: `1px solid ${COLORS.border}33`,
    borderRadius: 6,
    padding: '8px 10px',
    fontSize: 13,
    fontFamily: 'inherit',
    resize: 'vertical',
    minHeight: 52,
    boxSizing: 'border-box',
  },
  editorBlock: {
    border: `1px dashed ${COLORS.border}66`,
    borderRadius: 8, padding: 12, marginBottom: 10,
    background: 'rgba(196,160,80,.03)',
  },
  editorInput: {
    width: '100%',
    background: COLORS.noteBg,
    border: `1px solid ${COLORS.border}44`,
    color: COLORS.white,
    padding: '6px 10px', borderRadius: 6, fontSize: 13,
    marginBottom: 6,
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  },
  editorQuestion: {
    display: 'flex', gap: 6, marginBottom: 4,
  },
  iconBtn: {
    background: 'transparent',
    border: `1px solid ${COLORS.border}44`,
    color: COLORS.gold,
    width: 28, height: 28, borderRadius: 4,
    cursor: 'pointer', fontSize: 14,
    flexShrink: 0,
  },
  btn: {
    background: 'transparent',
    border: `1px solid ${COLORS.border}`,
    color: COLORS.gold,
    padding: '6px 12px', borderRadius: 6,
    fontSize: 12, cursor: 'pointer',
    textTransform: 'uppercase', letterSpacing: '.5px',
    fontWeight: 600,
  },
  btnPrimary: {
    background: COLORS.gold,
    color: '#0a0908',
    border: `1px solid ${COLORS.gold}`,
    padding: '8px 14px', borderRadius: 6,
    fontSize: 12, cursor: 'pointer',
    textTransform: 'uppercase', letterSpacing: '.5px',
    fontWeight: 700,
  },
  footer: {
    padding: '10px 14px',
    borderTop: `1px solid ${COLORS.border}33`,
    display: 'flex', gap: 8, flexWrap: 'wrap',
  },
  sectionLabel: {
    color: COLORS.gold,
    fontSize: 11, textTransform: 'uppercase', letterSpacing: '.5px',
    marginTop: 10, marginBottom: 6,
    fontWeight: 700,
  },
};

// ─── Default per-template state ───
function emptyByTemplate() {
  return { steps: {} };
}

function getTemplateState(notes, templateId) {
  return notes?.byTemplate?.[templateId] || emptyByTemplate();
}

function withTemplateState(notes, templateId, next) {
  return {
    ...(notes || {}),
    selectedTemplate: templateId,
    byTemplate: {
      ...(notes?.byTemplate || {}),
      [templateId]: next,
    },
  };
}

export default function InterviewPanel({ open, clientId, interviewNotes, onChange, onClose, onFinish }) {
  const [customTick, setCustomTick] = useState(0); // refresh dropdown after save
  const allTemplates = useMemo(() => getAllTemplates(), [customTick]);

  const initialSelectedId = interviewNotes?.selectedTemplate || BUILTIN_TEMPLATES[0].id;
  const [selectedId, setSelectedId] = useState(initialSelectedId);
  const [expandedSteps, setExpandedSteps] = useState(() => new Set());

  // Reset expanded set + sync selected template whenever the client changes.
  useEffect(() => {
    setSelectedId(interviewNotes?.selectedTemplate || BUILTIN_TEMPLATES[0].id);
    setExpandedSteps(new Set());
  }, [clientId, interviewNotes?.selectedTemplate]);

  // ─── Custom editor state (only used for EMPTY_TEMPLATE) ───
  const [draftSteps, setDraftSteps] = useState([]);
  const [draftName, setDraftName] = useState('');

  const isEditor = selectedId === EMPTY_TEMPLATE.id;
  const template = resolveTemplate(selectedId) || EMPTY_TEMPLATE;

  if (!open) return null;

  const templateState = getTemplateState(interviewNotes, selectedId);

  // ─── Handlers ───
  const handleSelectTemplate = (id) => {
    setSelectedId(id);
    setExpandedSteps(new Set());
    // Persist the selection on the client so it's remembered next time.
    onChange(withTemplateState(interviewNotes, id, getTemplateState(interviewNotes, id)));
  };

  const toggleExpanded = (stepId) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) next.delete(stepId);
      else next.add(stepId);
      return next;
    });
  };

  const toggleAsked = (stepId, questionIdx) => {
    const current = templateState.steps?.[stepId] || { notes: '', asked: [] };
    const asked = [...(current.asked || [])];
    asked[questionIdx] = !asked[questionIdx];
    const nextStepState = { ...current, asked };
    const nextState = {
      ...templateState,
      steps: { ...(templateState.steps || {}), [stepId]: nextStepState },
    };
    onChange(withTemplateState(interviewNotes, selectedId, nextState));
  };

  const updateNotes = (stepId, value) => {
    const current = templateState.steps?.[stepId] || { notes: '', asked: [] };
    const nextStepState = { ...current, notes: value };
    const nextState = {
      ...templateState,
      steps: { ...(templateState.steps || {}), [stepId]: nextStepState },
    };
    onChange(withTemplateState(interviewNotes, selectedId, nextState));
  };

  // ─── Custom editor handlers ───
  const addDraftStep = () => {
    setDraftSteps((prev) => [
      ...prev,
      { id: `s-${Date.now()}-${prev.length}`, title: `ÉTAPE ${prev.length + 1}`, questions: [''] },
    ]);
  };
  const updateDraftStepTitle = (i, title) => {
    setDraftSteps((prev) => prev.map((s, idx) => (idx === i ? { ...s, title } : s)));
  };
  const addDraftQuestion = (i) => {
    setDraftSteps((prev) => prev.map((s, idx) => (idx === i ? { ...s, questions: [...s.questions, ''] } : s)));
  };
  const updateDraftQuestion = (i, qi, value) => {
    setDraftSteps((prev) => prev.map((s, idx) => {
      if (idx !== i) return s;
      const questions = s.questions.map((q, qIdx) => (qIdx === qi ? value : q));
      return { ...s, questions };
    }));
  };
  const removeDraftQuestion = (i, qi) => {
    setDraftSteps((prev) => prev.map((s, idx) => {
      if (idx !== i) return s;
      return { ...s, questions: s.questions.filter((_, qIdx) => qIdx !== qi) };
    }));
  };
  const removeDraftStep = (i) => {
    setDraftSteps((prev) => prev.filter((_, idx) => idx !== i));
  };
  const saveDraftAsTemplate = () => {
    const name = draftName.trim();
    if (!name || draftSteps.length === 0) return;
    const cleaned = draftSteps
      .map((s) => ({ ...s, questions: s.questions.map((q) => q.trim()).filter(Boolean) }))
      .filter((s) => s.title.trim() && s.questions.length > 0);
    if (cleaned.length === 0) return;
    const saved = saveCustomTemplate({ name, steps: cleaned });
    setCustomTick((n) => n + 1);
    setDraftSteps([]);
    setDraftName('');
    // Select the newly saved template to show it immediately.
    setSelectedId(saved.id);
    onChange(withTemplateState(interviewNotes, saved.id, getTemplateState(interviewNotes, saved.id)));
  };

  const handleDeleteCustom = () => {
    if (!template?.custom) return;
    if (!window.confirm(`Supprimer le template "${template.name}" ?`)) return;
    deleteCustomTemplate(template.id);
    setCustomTick((n) => n + 1);
    setSelectedId(BUILTIN_TEMPLATES[0].id);
  };

  // ─── Render ───
  return (
    <>
      <div style={styles.backdrop} onClick={onClose} />
      <aside style={styles.overlay} role="dialog" aria-label="Guide d'entretien">
        <div style={styles.header}>
          <h2 style={styles.headerTitle}>Guide d'entretien</h2>
          <button type="button" style={styles.closeBtn} onClick={onClose} aria-label="Fermer">×</button>
          <label style={styles.selectorLabel} htmlFor="interview-template-select">Choisir un guide</label>
          <select
            id="interview-template-select"
            style={styles.select}
            value={selectedId}
            onChange={(e) => handleSelectTemplate(e.target.value)}
          >
            {allTemplates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.custom ? `★ ${t.name}` : t.name}
              </option>
            ))}
          </select>
          {template?.custom && (
            <button
              type="button"
              style={{ ...styles.btn, marginTop: 8, fontSize: 10 }}
              onClick={handleDeleteCustom}
            >
              Supprimer ce template
            </button>
          )}
        </div>

        <div style={styles.body}>
          {isEditor ? (
            <CustomEditor
              draftSteps={draftSteps}
              draftName={draftName}
              setDraftName={setDraftName}
              addDraftStep={addDraftStep}
              updateDraftStepTitle={updateDraftStepTitle}
              addDraftQuestion={addDraftQuestion}
              updateDraftQuestion={updateDraftQuestion}
              removeDraftQuestion={removeDraftQuestion}
              removeDraftStep={removeDraftStep}
              saveDraftAsTemplate={saveDraftAsTemplate}
            />
          ) : (
            template.steps.map((step) => {
              const isExpanded = expandedSteps.has(step.id);
              const stepState = templateState.steps?.[step.id] || { notes: '', asked: [] };
              return (
                <div key={step.id} style={styles.stepBlock}>
                  <div style={styles.stepHeader} onClick={() => toggleExpanded(step.id)}>
                    <span>{step.title}</span>
                    <span style={styles.chevron}>{isExpanded ? '▾' : '▸'}</span>
                  </div>
                  {isExpanded && (
                    <div style={styles.stepBody}>
                      {step.questions.map((q, qi) => {
                        const asked = stepState.asked?.[qi];
                        return (
                          <div
                            key={qi}
                            style={{ ...styles.question, ...(asked ? styles.questionAsked : null) }}
                            onClick={() => toggleAsked(step.id, qi)}
                          >
                            {q}
                          </div>
                        );
                      })}
                      <textarea
                        style={styles.noteArea}
                        placeholder="Notes..."
                        value={stepState.notes || ''}
                        onChange={(e) => updateNotes(step.id, e.target.value)}
                      />
                    </div>
                  )}
                </div>
              );
            })
          )}
          {!isEditor && template.steps.length === 0 && (
            <div style={{ color: COLORS.grey, fontSize: 13, fontStyle: 'italic' }}>
              Ce template est vide.
            </div>
          )}
        </div>

        <div style={styles.footer}>
          <button
            type="button"
            style={{ ...styles.btnPrimary, flex: 1 }}
            onClick={() => {
              const canInject = hasAnyInterviewNotes(interviewNotes, selectedId) && !isEditor;
              if (!canInject) {
                onClose();
                return;
              }
              const ok = window.confirm(
                "Voulez-vous pré-remplir la fiche client avec les notes de l'entretien ?"
              );
              if (ok) {
                onFinish && onFinish(selectedId);
              } else {
                onClose();
              }
            }}
          >
            Terminer l'entretien
          </button>
        </div>
      </aside>
    </>
  );
}

function CustomEditor({
  draftSteps, draftName, setDraftName,
  addDraftStep, updateDraftStepTitle, addDraftQuestion,
  updateDraftQuestion, removeDraftQuestion, removeDraftStep,
  saveDraftAsTemplate,
}) {
  return (
    <div>
      <div style={styles.sectionLabel}>Nom du template</div>
      <input
        type="text"
        style={styles.editorInput}
        placeholder="Ex : Prospection crossfit"
        value={draftName}
        onChange={(e) => setDraftName(e.target.value)}
      />

      <div style={styles.sectionLabel}>Étapes</div>
      {draftSteps.map((step, i) => (
        <div key={step.id} style={styles.editorBlock}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
            <input
              type="text"
              style={{ ...styles.editorInput, marginBottom: 0 }}
              placeholder="Titre de l'étape"
              value={step.title}
              onChange={(e) => updateDraftStepTitle(i, e.target.value)}
            />
            <button type="button" style={styles.iconBtn} onClick={() => removeDraftStep(i)} title="Supprimer l'étape">×</button>
          </div>
          {step.questions.map((q, qi) => (
            <div key={qi} style={styles.editorQuestion}>
              <input
                type="text"
                style={{ ...styles.editorInput, marginBottom: 0 }}
                placeholder={`Question ${qi + 1}`}
                value={q}
                onChange={(e) => updateDraftQuestion(i, qi, e.target.value)}
              />
              <button type="button" style={styles.iconBtn} onClick={() => removeDraftQuestion(i, qi)} title="Supprimer la question">−</button>
            </div>
          ))}
          <button type="button" style={{ ...styles.btn, fontSize: 10, marginTop: 4 }} onClick={() => addDraftQuestion(i)}>
            + Question
          </button>
        </div>
      ))}

      <button type="button" style={{ ...styles.btn, marginTop: 8, marginBottom: 12 }} onClick={addDraftStep}>
        + Ajouter une étape
      </button>

      <div>
        <button
          type="button"
          style={styles.btnPrimary}
          onClick={saveDraftAsTemplate}
          disabled={!draftName.trim() || draftSteps.length === 0}
        >
          Sauvegarder le template
        </button>
      </div>
    </div>
  );
}
