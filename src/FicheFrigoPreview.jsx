import { useState } from 'react';
import { extractMeals, extractSupplements, extractFridgeDataFromSections, exportFicheFrigoPDF } from './nutritionPdf';

// Parse structured JSON from Claude (legacy path for saved fiche_frigo_json)
function fromFicheJson(json, supplementsText) {
  if (!json || typeof json !== 'object') return null;
  const repas = json.repas || {};
  const supp = json.supplements || {};

  const textSupp = extractSupplements(supplementsText || '');
  const pick = (arr, fallback) =>
    Array.isArray(arr) && arr.length > 0 ? arr : fallback;

  return {
    breakfast: Array.isArray(repas.petit_dejeuner) ? repas.petit_dejeuner : [],
    lunch: Array.isArray(repas.dejeuner) ? repas.dejeuner : [],
    dinner: Array.isArray(repas.diner) ? repas.diner : [],
    snack: typeof repas.collation === 'string' ? repas.collation : '',
    toFavor: Array.isArray(json.a_privilegier) ? json.a_privilegier : [],
    toLimit: Array.isArray(json.a_limiter) ? json.a_limiter : [],
    hydration: typeof json.hydratation === 'string' ? json.hydratation : '',
    supplements: {
      morningFasting: pick(supp.matin_a_jeun, textSupp.morningFasting),
      breakfast: pick(supp.petit_dejeuner, textSupp.breakfast),
      lunch: pick(supp.midi, textSupp.lunch),
      dinner: pick(supp.soir, textSupp.dinner),
      bedtime: pick(supp.coucher, textSupp.bedtime),
    },
  };
}

// ─── CLEAN ITEM: strip parentheses, explanations, leading dashes/bullets ───
function cleanItem(text) {
  return text
    .replace(/\(.*?\)/g, '')           // remove parenthetical explanations
    .replace(/^[-–•*]\s*/, '')         // remove leading bullets
    .replace(/\s{2,}/g, ' ')          // collapse multiple spaces
    .trim();
}

// ─── FRIDGE CARD (read-only visual) ───

function MealSection({ title, items }) {
  const cleaned = (items || []).slice(0, 2).map(cleanItem).filter(Boolean);
  if (cleaned.length === 0) return null;
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: '.72rem', fontWeight: 700, color: 'rgba(106,191,138,.7)', letterSpacing: '.08em', marginBottom: 8 }}>{title}</div>
      {cleaned.map((item, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: '.88rem', fontWeight: 500, color: '#f0f0e8', lineHeight: 1.6, paddingLeft: 4, marginBottom: 2 }}>
          <span style={{ color: 'rgba(106,191,138,.6)', fontSize: '.75rem', flexShrink: 0 }}>&#9654;</span>
          <span>{item}</span>
        </div>
      ))}
    </div>
  );
}

function TagList({ title, items, icon, tagBg, tagColor }) {
  const cleaned = (items || []).map(cleanItem).filter(Boolean);
  if (cleaned.length === 0) return null;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: '.7rem', fontWeight: 700, color: tagColor, letterSpacing: '.06em', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ fontSize: '.8rem' }}>{icon}</span> {title}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        {cleaned.map((item, i) => (
          <span key={i} style={{ display: 'inline-block', background: tagBg, color: tagColor, fontSize: '.76rem', fontWeight: 500, padding: '3px 10px', borderRadius: 20, lineHeight: 1.4 }}>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function RuleBlock({ rules }) {
  if (!rules || rules.length === 0) return null;
  return (
    <div style={{ background: 'rgba(106,191,138,.06)', border: '1px solid rgba(106,191,138,.15)', borderRadius: 10, padding: '10px 14px', marginBottom: 18 }}>
      <div style={{ fontSize: '.68rem', fontWeight: 700, color: 'rgba(106,191,138,.6)', letterSpacing: '.08em', marginBottom: 6 }}>REGLE SIMPLE</div>
      {rules.map((r, i) => (
        <div key={i} style={{ fontSize: '.82rem', color: '#d4c9a8', lineHeight: 1.5 }}>{r}</div>
      ))}
    </div>
  );
}

function FridgeCard({ data, prenom, rules, clientMode = false }) {
  // Build snack items array from string or array
  const snackItems = Array.isArray(data.snacks)
    ? data.snacks
    : (data.snack || '').split(/\n|,|;/).map(s => s.trim()).filter(Boolean);

  return (
    <div style={{ padding: clientMode ? '24px 20px' : '20px 18px' }}>
      <div style={{ fontSize: '.7rem', fontWeight: 600, color: 'rgba(106,191,138,.5)', letterSpacing: '.1em', marginBottom: 16 }}>
        FICHE FRIGO — {prenom}
      </div>

      <RuleBlock rules={rules} />

      <MealSection title="PETIT-DEJEUNER" items={data.breakfast} />
      <MealSection title="DEJEUNER" items={data.lunch} />
      <MealSection title="DINER" items={data.dinner} />
      <MealSection title="COLLATION" items={snackItems} />

      <div style={{ borderTop: '1px solid rgba(255,255,255,.08)', paddingTop: 16, marginTop: 10 }}>
        <TagList title="A PRIVILEGIER" items={data.toFavor} icon={"\u2714"} tagBg="rgba(106,191,138,.1)" tagColor="#8abf9a" />
        <TagList title="A LIMITER" items={data.toLimit} icon={"\u26A0"} tagBg="rgba(232,160,64,.1)" tagColor="#e8a040" />
        <TagList title="A EVITER" items={data.forbidden} icon={"\u2716"} tagBg="rgba(212,92,76,.1)" tagColor="#d4806c" />
      </div>
    </div>
  );
}

// ─── EDIT MODE ───

function EditField({ label, value, onChange, rows = 3, placeholder }) {
  return (
    <div className="ffp-field">
      <label>{label}</label>
      <textarea value={value} onChange={e => onChange(e.target.value)} rows={rows} placeholder={placeholder} />
    </div>
  );
}

function EditInput({ label, value, onChange, placeholder }) {
  return (
    <div className="ffp-field">
      <label>{label}</label>
      <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

// ─── MAIN COMPONENT ───

export default function FicheFrigoPreview({ consultation, sections, client, onClose }) {
  // Priority: structured sections > JSON > regex fallback
  const fromSections = extractFridgeDataFromSections(sections || []);
  const ficheJson = consultation.ficheFrigoJson || consultation.fiche_frigo_json || null;
  const fromJson = fromFicheJson(ficheJson, consultation.supplements);
  const regexMeals = extractMeals(consultation.nutritionPlan);
  const regexSupp = extractSupplements(consultation.supplements || '');
  const form = client?.form || {};
  const prenom = (form.prenom || 'CLIENT').toUpperCase();

  // Per-field merge: sections > JSON > regex
  const pickArr = (...sources) => {
    for (const s of sources) {
      if (Array.isArray(s) && s.length > 0) return s;
    }
    return [];
  };
  const pickStr = (...sources) => {
    for (const s of sources) {
      if (typeof s === 'string' && s.trim()) return s;
    }
    return '';
  };

  const s = fromSections || {};
  const j = fromJson || {};
  const jSupp = j.supplements || {};
  const source = {
    breakfast: pickArr(s.breakfast, j.breakfast, regexMeals.breakfast),
    lunch: pickArr(s.lunch, j.lunch, regexMeals.lunch),
    dinner: pickArr(s.dinner, j.dinner, regexMeals.dinner),
    snack: pickStr(s.snack, j.snack, regexMeals.snack),
    toFavor: pickArr(s.toFavor, j.toFavor, regexMeals.toFavor),
    toLimit: pickArr(s.toLimit, j.toLimit, regexMeals.toLimit),
    hydration: pickStr(s.hydration, j.hydration, regexMeals.hydration, form.hydratation),
    supplements: {
      morningFasting: pickArr(jSupp.morningFasting, regexSupp.morningFasting),
      breakfast: pickArr(jSupp.breakfast, regexSupp.breakfast),
      lunch: pickArr(jSupp.lunch, regexSupp.lunch),
      dinner: pickArr(jSupp.dinner, regexSupp.dinner),
      bedtime: pickArr(jSupp.bedtime, regexSupp.bedtime),
    },
  };

  // Build forbidden list from form allergies + alimentsEvites
  const extractFormList = (field) =>
    (form[field] || '').split(/[,;/]+/).map(s => s.trim()).filter(s => s.length > 1);
  const forbidden = [...new Set([...extractFormList('allergies'), ...extractFormList('alimentsEvites')])];

  // Extract simple rules from plan (RECOMMANDATIONS COACH section, first 3 actionable lines)
  const buildRules = () => {
    const coachSection = (sections || []).find(sec => /recommandations?\s*coach/i.test(sec.title));
    if (!coachSection) return [];
    const lines = (coachSection.content || '').split('\n')
      .map(l => l.replace(/^[-–•*]\s*/, '').replace(/^\*\*.*?\*\*\s*:?\s*/, '').trim())
      .filter(l =>
        l.length > 10 && l.length < 120 &&
        !/^(r[eè]gles?|erreurs?|focus|actions?)\s*[:—]/i.test(l) &&
        !/^(r[eè]gles?\s+(directes?|simples?|coach)|erreurs?\s+[aà]\s+[eé]viter)/i.test(l)
      );
    return lines.slice(0, 3);
  };
  const rules = buildRules();

  const [mode, setMode] = useState('card'); // 'card' | 'edit' | 'client'

  // Editable state
  const [breakfast, setBreakfast] = useState((source.breakfast || []).join('\n\n') || '');
  const [lunch, setLunch] = useState((source.lunch || []).join('\n\n') || '');
  const [dinner, setDinner] = useState((source.dinner || []).join('\n\n') || '');
  const [snack, setSnack] = useState(source.snack || '');
  const [toFavor, setToFavor] = useState((source.toFavor || []).join('\n') || '');
  const [toLimit, setToLimit] = useState((source.toLimit || []).join('\n') || '');
  const [forbiddenText, setForbiddenText] = useState(forbidden.join('\n') || '');
  const [hydration, setHydration] = useState(source.hydration || '');

  // Supplements
  const [suppMorningFasting, setSuppMorningFasting] = useState((source.supplements.morningFasting || []).join(', '));
  const [suppBreakfast, setSuppBreakfast] = useState((source.supplements.breakfast || []).join(', '));
  const [suppLunch, setSuppLunch] = useState((source.supplements.lunch || []).join(', '));
  const [suppDinner, setSuppDinner] = useState((source.supplements.dinner || []).join(', '));
  const [suppBedtime, setSuppBedtime] = useState((source.supplements.bedtime || []).join(', '));

  const parseSupList = (s) => s.split(',').map(x => x.trim()).filter(Boolean);

  const getEditedData = () => ({
    breakfast: breakfast.split('\n\n').filter(b => b.trim()),
    lunch: lunch.split('\n\n').filter(b => b.trim()),
    dinner: dinner.split('\n\n').filter(b => b.trim()),
    snack,
    toFavor: toFavor.split('\n').filter(l => l.trim()),
    toLimit: toLimit.split('\n').filter(l => l.trim()),
    forbidden: forbiddenText.split('\n').filter(l => l.trim()),
    hydration,
    supplements: {
      morningFasting: parseSupList(suppMorningFasting),
      breakfast: parseSupList(suppBreakfast),
      lunch: parseSupList(suppLunch),
      dinner: parseSupList(suppDinner),
      bedtime: parseSupList(suppBedtime),
    },
  });

  // V92.8 : retour au PDF jsPDF pour la Fiche Frigo (design exact à plastifier).
  // Le Word natif a du sens pour le plan principal (peaufinage Anissa) mais
  // pas pour la Fiche Frigo qui est imprimée puis plastifiée telle quelle.
  const handleExport = async () => {
    const editedMeals = getEditedData();
    await exportFicheFrigoPDF(consultation, client, editedMeals);
    onClose();
  };

  const cardData = getEditedData();

  return (
    <div className="ffp-overlay" onClick={onClose}>
      <div className="ffp-modal" onClick={e => e.stopPropagation()}>
        {mode !== 'client' && (
          <div className="ffp-header">
            <h2 className="ffp-title">FICHE FRIGO — {prenom}</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {['card', 'edit', 'client'].map(m => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  style={{
                    background: mode === m ? 'rgba(106,191,138,.15)' : 'none',
                    border: `1px solid ${mode === m ? 'rgba(106,191,138,.3)' : 'rgba(255,255,255,.1)'}`,
                    borderRadius: 8, padding: '4px 10px', fontSize: '.72rem',
                    color: mode === m ? '#8abf9a' : '#6a7a6a', cursor: 'pointer',
                  }}
                >
                  {{ card: 'Apercu', edit: 'Edition', client: 'Vue client' }[m]}
                </button>
              ))}
              <button className="ffp-close" onClick={onClose}>&times;</button>
            </div>
          </div>
        )}

        {mode === 'client' ? (
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setMode('card')}
              style={{
                position: 'absolute', top: 12, right: 14, background: 'none', border: 'none',
                color: 'rgba(255,255,255,.25)', cursor: 'pointer', fontSize: '1.1rem', zIndex: 1,
              }}
            >&times;</button>
            <FridgeCard data={cardData} prenom={prenom} rules={rules} clientMode />
          </div>
        ) : mode === 'card' ? (
          <div className="ffp-body" style={{ padding: 0 }}>
            <FridgeCard data={cardData} prenom={prenom} rules={rules} />
          </div>
        ) : (
          <div className="ffp-body">
            <div className="ffp-row-3">
              <EditField label="PETIT-DEJEUNER" value={breakfast} onChange={setBreakfast} rows={4} placeholder="Options (ligne vide = nouvelle option)" />
              <EditField label="DEJEUNER" value={lunch} onChange={setLunch} rows={4} placeholder="Options" />
              <EditField label="DINER" value={dinner} onChange={setDinner} rows={4} placeholder="Options" />
            </div>

            <div className="ffp-row-2">
              <EditField label="COLLATION" value={snack} onChange={setSnack} rows={2} placeholder="Suggestion de collation" />
              <EditInput label="HYDRATATION" value={hydration} onChange={setHydration} placeholder="Ex: 2L/jour" />
            </div>

            <div className="ffp-row-3">
              <EditField label="AUTORISES" value={toFavor} onChange={setToFavor} rows={4} placeholder="Un aliment par ligne" />
              <EditField label="LIMITER" value={toLimit} onChange={setToLimit} rows={4} placeholder="Un aliment par ligne" />
              <EditField label="INTERDIT" value={forbiddenText} onChange={setForbiddenText} rows={4} placeholder="Un aliment par ligne" />
            </div>

            <div className="ffp-supp-section">
              <h3 className="ffp-supp-title">MES COMPLEMENTS</h3>
              <div className="ffp-supp-grid">
                <EditInput label="MATIN A JEUN" value={suppMorningFasting} onChange={setSuppMorningFasting} placeholder="Fer 30mg, Probiotiques..." />
                <EditInput label="PETIT-DEJEUNER" value={suppBreakfast} onChange={setSuppBreakfast} placeholder="Vitamine D3, Complexe B..." />
                <EditInput label="MIDI" value={suppLunch} onChange={setSuppLunch} placeholder="Omega-3, Chrome..." />
                <EditInput label="SOIR" value={suppDinner} onChange={setSuppDinner} placeholder="Zinc, Calcium..." />
                <EditInput label="COUCHER" value={suppBedtime} onChange={setSuppBedtime} placeholder="Magnesium, Ashwagandha..." />
              </div>
            </div>
          </div>
        )}

        {mode !== 'client' && (
          <div className="ffp-actions">
            <button className="btn btn-anissa-primary" onClick={handleExport}>Exporter en PDF</button>
            <button className="btn btn-anissa-secondary" onClick={onClose}>Fermer</button>
          </div>
        )}
      </div>
    </div>
  );
}
