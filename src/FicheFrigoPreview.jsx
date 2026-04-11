import { useState } from 'react';
import { extractMeals, extractSupplements, exportFicheFrigoPDF } from './nutritionPdf';

// Prefer the structured JSON (generated server-side by Claude) when available.
// Falls back to the regex-based extractMeals/extractSupplements otherwise.
function fromFicheJson(json, supplementsText) {
  if (!json || typeof json !== 'object') return null;
  const repas = json.repas || {};
  const supp = json.supplements || {};

  // If the JSON has no supplements, still try to extract them from text
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

export default function FicheFrigoPreview({ consultation, client, onClose }) {
  // Source : JSON structure > regex fallback
  const ficheJson = consultation.ficheFrigoJson || consultation.fiche_frigo_json || null;
  const fromJson = fromFicheJson(ficheJson, consultation.supplements);

  const regexMeals = extractMeals(consultation.nutritionPlan);
  const regexSupp = extractSupplements(consultation.supplements || '');
  const form = client?.form || {};
  const prenom = (form.prenom || 'CLIENT').toUpperCase();

  const source = fromJson || {
    breakfast: regexMeals.breakfast,
    lunch: regexMeals.lunch,
    dinner: regexMeals.dinner,
    snack: regexMeals.snack,
    toFavor: regexMeals.toFavor,
    toLimit: regexMeals.toLimit,
    hydration: regexMeals.hydration || form.hydratation || '',
    supplements: regexSupp,
  };

  const sourceBadge = fromJson ? 'JSON structure (IA)' : 'Extraction regex';

  const [breakfast, setBreakfast] = useState((source.breakfast || []).join('\n\n') || '');
  const [lunch, setLunch] = useState((source.lunch || []).join('\n\n') || '');
  const [dinner, setDinner] = useState((source.dinner || []).join('\n\n') || '');
  const [snack, setSnack] = useState(source.snack || '');
  const [toFavor, setToFavor] = useState((source.toFavor || []).join('\n') || '');
  const [toLimit, setToLimit] = useState((source.toLimit || []).join('\n') || '');
  const [hydration, setHydration] = useState(source.hydration || '');

  // Supplements — editable per moment, comma separated
  const [suppMorningFasting, setSuppMorningFasting] = useState((source.supplements.morningFasting || []).join(', '));
  const [suppBreakfast, setSuppBreakfast] = useState((source.supplements.breakfast || []).join(', '));
  const [suppLunch, setSuppLunch] = useState((source.supplements.lunch || []).join(', '));
  const [suppDinner, setSuppDinner] = useState((source.supplements.dinner || []).join(', '));
  const [suppBedtime, setSuppBedtime] = useState((source.supplements.bedtime || []).join(', '));

  const parseSupList = (s) => s.split(',').map(x => x.trim()).filter(Boolean);

  const handleExport = async () => {
    const editedMeals = {
      breakfast: breakfast.split('\n\n').filter(b => b.trim()),
      lunch: lunch.split('\n\n').filter(b => b.trim()),
      dinner: dinner.split('\n\n').filter(b => b.trim()),
      snack,
      toFavor: toFavor.split('\n').filter(l => l.trim()),
      toLimit: toLimit.split('\n').filter(l => l.trim()),
      hydration,
      supplements: {
        morningFasting: parseSupList(suppMorningFasting),
        breakfast: parseSupList(suppBreakfast),
        lunch: parseSupList(suppLunch),
        dinner: parseSupList(suppDinner),
        bedtime: parseSupList(suppBedtime),
      },
    };
    await exportFicheFrigoPDF(consultation, client, editedMeals);
    onClose();
  };

  return (
    <div className="ffp-overlay" onClick={onClose}>
      <div className="ffp-modal" onClick={e => e.stopPropagation()}>
        <div className="ffp-header">
          <h2 className="ffp-title">FICHE FRIGO — {prenom}</h2>
          <button className="ffp-close" onClick={onClose}>&times;</button>
        </div>

        <div className="ffp-body">
          <div style={{ marginBottom: 12 }}>
            <span className={`ffp-source-badge ${fromJson ? 'ffp-source-json' : 'ffp-source-regex'}`}>
              Source : {sourceBadge}
            </span>
          </div>

          <div className="ffp-row-3">
            <div className="ffp-field">
              <label>PETIT-DEJEUNER</label>
              <textarea value={breakfast} onChange={e => setBreakfast(e.target.value)} rows={6} placeholder="Options de petit-dejeuner (separez par une ligne vide pour chaque option)" />
            </div>
            <div className="ffp-field">
              <label>DEJEUNER</label>
              <textarea value={lunch} onChange={e => setLunch(e.target.value)} rows={6} placeholder="Options de dejeuner" />
            </div>
            <div className="ffp-field">
              <label>DINER</label>
              <textarea value={dinner} onChange={e => setDinner(e.target.value)} rows={6} placeholder="Options de diner" />
            </div>
          </div>

          <div className="ffp-row-2">
            <div className="ffp-field">
              <label>A PRIVILEGIER</label>
              <textarea value={toFavor} onChange={e => setToFavor(e.target.value)} rows={5} placeholder="Un aliment par ligne" />
            </div>
            <div className="ffp-field">
              <label>A LIMITER</label>
              <textarea value={toLimit} onChange={e => setToLimit(e.target.value)} rows={5} placeholder="Un aliment par ligne" />
            </div>
          </div>

          <div className="ffp-row-2">
            <div className="ffp-field">
              <label>COLLATION</label>
              <textarea value={snack} onChange={e => setSnack(e.target.value)} rows={2} placeholder="Suggestion de collation" />
            </div>
            <div className="ffp-field">
              <label>HYDRATATION</label>
              <input type="text" value={hydration} onChange={e => setHydration(e.target.value)} placeholder="Ex: 2L/jour" />
            </div>
          </div>

          <div className="ffp-supp-section">
            <h3 className="ffp-supp-title">MES COMPLEMENTS</h3>
            <p className="ffp-supp-hint">Separez chaque complement par une virgule. Format : Nom dosage (ex: Magnesium 300mg).</p>
            <div className="ffp-supp-grid">
              <div className="ffp-field">
                <label>MATIN A JEUN</label>
                <input type="text" value={suppMorningFasting} onChange={e => setSuppMorningFasting(e.target.value)} placeholder="Ex: Fer 30mg + Vitamine C 500mg, Probiotiques 50 milliards UFC" />
              </div>
              <div className="ffp-field">
                <label>PETIT-DEJEUNER</label>
                <input type="text" value={suppBreakfast} onChange={e => setSuppBreakfast(e.target.value)} placeholder="Ex: Vitamine D3 2000 UI + K2 100mcg, Complexe B 1 gel." />
              </div>
              <div className="ffp-field">
                <label>MIDI</label>
                <input type="text" value={suppLunch} onChange={e => setSuppLunch(e.target.value)} placeholder="Ex: Omega-3 2g EPA/DHA, Chrome 200mcg, Curcuma 1000mg" />
              </div>
              <div className="ffp-field">
                <label>SOIR</label>
                <input type="text" value={suppDinner} onChange={e => setSuppDinner(e.target.value)} placeholder="Ex: Zinc 30mg, Calcium 500mg" />
              </div>
              <div className="ffp-field">
                <label>COUCHER</label>
                <input type="text" value={suppBedtime} onChange={e => setSuppBedtime(e.target.value)} placeholder="Ex: Magnesium 300mg, Ashwagandha 600mg" />
              </div>
            </div>
          </div>
        </div>

        <div className="ffp-actions">
          <button className="btn btn-anissa-primary" onClick={handleExport}>Exporter en PDF</button>
          <button className="btn btn-anissa-secondary" onClick={onClose}>Annuler</button>
        </div>
      </div>
    </div>
  );
}
