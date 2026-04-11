import { useState } from 'react';
import { jsPDF } from 'jspdf';

const LOGO_URL = 'https://cdn.prod.website-files.com/699eb56ec2e8b94e41cfa06c/69d411dfafbbe967e3d992c4_Design_sans_titre_1_-removebg-preview.png';
const GREEN = [26, 46, 31];
const DARK = [51, 51, 51];
const GREY = [136, 136, 136];
const SEP = [220, 220, 215];

function nr(v) { return v || 'Non renseigne'; }
function formatDate(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function calcIMC(poids, taille) {
  if (!poids || !taille) return null;
  const h = Number(taille) / 100;
  return (Number(poids) / (h * h)).toFixed(1);
}

function extractSupplementsTable(text) {
  if (!text) return [];
  const rows = [];
  const lines = text.split('\n');
  let currentName = '';
  for (const line of lines) {
    const trimmed = line.replace(/\*\*/g, '').replace(/#{1,3}\s*/g, '').trim();
    if (!trimmed) continue;
    // Detect supplement name (all caps or starts with uppercase word)
    if (/^[A-Z][A-Z\s\-\/]{2,}/.test(trimmed) && trimmed.length < 50) {
      currentName = trimmed;
      continue;
    }
    // Detect dosage lines
    const doseMatch = trimmed.match(/(\d+[\d.,]*\s*(?:mg|g|mcg|µg|UI|ug|ml)[^\n]*)/i);
    if (doseMatch && currentName && rows.length < 8) {
      rows.push({ name: currentName, dosage: doseMatch[1].substring(0, 40), reason: '' });
      currentName = '';
    }
  }
  return rows;
}

function buildInitialData(form, consultation) {
  const imc = calcIMC(form.poids, form.taille);
  const supplements = extractSupplementsTable(consultation.supplements || consultation.nutritionPlan);

  return {
    patient: `${nr(form.prenom)} ${form.nom || ''}`.trim() + ` — ${form.age ? form.age + ' ans' : '?'}, ${form.genre || '?'}, ${form.poids ? form.poids + ' kg' : '?'}, ${form.taille ? form.taille + ' cm' : '?'}${imc ? ', IMC ' + imc : ''}`,
    objectif: nr(form.objectifPrincipalNutrition || form.objectifSport || form.objectifPrincipal),
    antecedents: [
      form.pathologies ? `Pathologies : ${form.pathologies}` : '',
      form.traitements ? `Traitements : ${form.traitements}` : '',
      form.allergies ? `Allergies : ${form.allergies}` : '',
      form.antecedentsFamiliaux ? `Famille : ${form.antecedentsFamiliaux}` : '',
    ].filter(Boolean).join('\n') || 'Aucun antecedent renseigne',
    bilans: [
      `Bilan sanguin : ${consultation.bloodTestDone || consultation.blood_test_done ? 'Oui' : 'Non'}`,
      `Analyse ADN : ${consultation.dnaTestDone || consultation.dna_test_done ? 'Oui' : 'Non'}`,
      consultation.nutritionalObservations || consultation.nutritional_observations ? `Observations : ${(consultation.nutritionalObservations || consultation.nutritional_observations).substring(0, 200)}` : '',
    ].filter(Boolean).join('\n'),
    approche: 'Approche anti-inflammatoire et microbiote, personnalisee selon le profil',
    alimentsCles: 'Legumes verts, poisson gras, huile olive, baies, curcuma, graines',
    alimentsEviter: nr(form.alimentsEvites || form.allergies),
    supplements,
    coordination: 'Nous vous serions reconnaissants de bien vouloir nous confirmer la compatibilite de ces recommandations nutritionnelles avec le traitement en cours de votre patient(e). N\'hesitez pas a nous contacter pour toute question.',
  };
}

function loadImage(url) {
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      c.getContext('2d').drawImage(img, 0, 0);
      resolve(c.toDataURL('image/png'));
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

async function generateMedicalPDF(data) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pw = doc.internal.pageSize.getWidth();
  const m = 20;
  const cw = pw - m * 2;
  let y = 15;

  let logo = null;
  try { logo = await loadImage(LOGO_URL); } catch {}
  if (logo) doc.addImage(logo, 'PNG', m, y - 4, 12, 12);

  // Header
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...GREEN);
  doc.text('RESUME NUTRITIONNEL — COORDINATION MEDICALE', pw / 2, y + 3, { align: 'center' });
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GREY);
  doc.text(formatDate(new Date().toISOString()), pw - m, y + 3, { align: 'right' });
  y += 12;
  doc.setDrawColor(...SEP);
  doc.setLineWidth(0.3);
  doc.line(m, y, pw - m, y);
  y += 6;

  const addTitle = (title) => {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...GREEN);
    doc.text(title, m, y);
    y += 5;
  };

  const addText = (text, maxW) => {
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...DARK);
    const lines = doc.splitTextToSize(text, maxW || cw);
    for (const l of lines) { doc.text(l, m + 2, y); y += 3.5; }
    y += 2;
  };

  const addSep = () => {
    doc.setDrawColor(...SEP);
    doc.setLineWidth(0.15);
    doc.line(m, y, pw - m, y);
    y += 4;
  };

  // Section 1 — Patient
  addTitle('1. PATIENT');
  addText(data.patient);
  addText('Objectif : ' + data.objectif);
  addSep();

  // Section 2 — Antecedents
  addTitle('2. ANTECEDENTS RELEVES');
  addText(data.antecedents);
  addSep();

  // Section 3 — Bilans
  addTitle('3. BILANS EFFECTUES');
  addText(data.bilans);
  addSep();

  // Section 4 — Recommandations
  addTitle('4. RECOMMANDATIONS NUTRITIONNELLES');
  addText('Approche : ' + data.approche);
  addText('Aliments cles : ' + data.alimentsCles);
  addText('A eviter : ' + data.alimentsEviter);
  addSep();

  // Section 5 — Supplements (table)
  addTitle('5. SUPPLEMENTS RECOMMANDES');
  if (data.supplements.length > 0) {
    // Table header
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...GREY);
    doc.text('Supplement', m + 2, y);
    doc.text('Dosage', m + 65, y);
    doc.text('Raison', m + 110, y);
    y += 4;
    doc.setDrawColor(...SEP);
    doc.line(m, y - 1, pw - m, y - 1);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...DARK);
    for (const row of data.supplements) {
      doc.text((row.name || '').substring(0, 30), m + 2, y + 1);
      doc.text((row.dosage || '').substring(0, 25), m + 65, y + 1);
      doc.text((row.reason || '').substring(0, 25), m + 110, y + 1);
      y += 4;
    }
  } else {
    addText('Voir le plan nutrition detaille.');
  }
  y += 2;
  addSep();

  // Section 6 — Coordination
  addTitle('6. COORDINATION DEMANDEE');
  addText(data.coordination);
  y += 4;
  doc.setFontSize(8);
  doc.setTextColor(...GREY);
  doc.text('Medecin traitant : ____________________________', m + 2, y);
  y += 5;
  doc.text('Signature / Commentaires : ____________________________', m + 2, y);

  // Footer
  const fy = 275;
  doc.setDrawColor(...SEP);
  doc.line(m, fy, pw - m, fy);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GREY);
  doc.text('Anissa Deroubaix — Nutritionniste specialisee en biohacking et genetique', pw / 2, fy + 4, { align: 'center' });
  doc.text('AB Coaching Sarl · Rue de Rive 28, 1260 Nyon', pw / 2, fy + 8, { align: 'center' });
  doc.text('Document confidentiel — usage medical uniquement', pw / 2, fy + 12, { align: 'center' });

  return doc;
}

// ─── PREVIEW MODAL ───

export default function MedicalSummary({ form, consultation, onClose }) {
  const [data, setData] = useState(() => buildInitialData(form, consultation));
  const [exporting, setExporting] = useState(false);

  const update = (field, value) => setData(prev => ({ ...prev, [field]: value }));
  const updateSupplement = (idx, field, value) => {
    setData(prev => {
      const s = [...prev.supplements];
      s[idx] = { ...s[idx], [field]: value };
      return { ...prev, supplements: s };
    });
  };
  const addSupplement = () => {
    if (data.supplements.length >= 8) return;
    setData(prev => ({ ...prev, supplements: [...prev.supplements, { name: '', dosage: '', reason: '' }] }));
  };
  const removeSupplement = (idx) => {
    setData(prev => ({ ...prev, supplements: prev.supplements.filter((_, i) => i !== idx) }));
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const doc = await generateMedicalPDF(data);
      doc.save(`resume-medecin-${(form.prenom || 'client').toLowerCase()}-${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      alert('Erreur export PDF: ' + err.message);
    }
    setExporting(false);
  };

  return (
    <div className="ffp-overlay">
      <div className="ffp-modal" style={{ maxWidth: 700 }}>
        <div className="ffp-header">
          <span className="ffp-title">Resume medecin — Previsualisation</span>
          <button className="ffp-close" onClick={onClose}>&times;</button>
        </div>
        <div className="ffp-body">
          <div className="ffp-field">
            <label>Patient</label>
            <input value={data.patient} onChange={e => update('patient', e.target.value)} />
          </div>
          <div className="ffp-field">
            <label>Objectif</label>
            <input value={data.objectif} onChange={e => update('objectif', e.target.value)} />
          </div>
          <div className="ffp-field">
            <label>Antecedents releves</label>
            <textarea value={data.antecedents} onChange={e => update('antecedents', e.target.value)} rows={4} />
          </div>
          <div className="ffp-field">
            <label>Bilans effectues</label>
            <textarea value={data.bilans} onChange={e => update('bilans', e.target.value)} rows={3} />
          </div>
          <div className="ffp-field">
            <label>Approche nutritionnelle</label>
            <input value={data.approche} onChange={e => update('approche', e.target.value)} />
          </div>
          <div className="ffp-row-2">
            <div className="ffp-field">
              <label>Aliments cles</label>
              <textarea value={data.alimentsCles} onChange={e => update('alimentsCles', e.target.value)} rows={2} />
            </div>
            <div className="ffp-field">
              <label>A eviter</label>
              <textarea value={data.alimentsEviter} onChange={e => update('alimentsEviter', e.target.value)} rows={2} />
            </div>
          </div>

          <div className="ffp-field">
            <label>Supplements recommandes</label>
            <div className="med-supp-table">
              {data.supplements.map((s, i) => (
                <div key={i} className="med-supp-row">
                  <input placeholder="Supplement" value={s.name} onChange={e => updateSupplement(i, 'name', e.target.value)} />
                  <input placeholder="Dosage" value={s.dosage} onChange={e => updateSupplement(i, 'dosage', e.target.value)} />
                  <input placeholder="Raison" value={s.reason} onChange={e => updateSupplement(i, 'reason', e.target.value)} />
                  <button type="button" className="ne-action-btn ne-delete-btn" onClick={() => removeSupplement(i)}>&times;</button>
                </div>
              ))}
              {data.supplements.length < 8 && (
                <button type="button" className="btn btn-xs btn-anissa-secondary" onClick={addSupplement} style={{ marginTop: 6 }}>+ Ajouter</button>
              )}
            </div>
          </div>

          <div className="ffp-field">
            <label>Message de coordination</label>
            <textarea value={data.coordination} onChange={e => update('coordination', e.target.value)} rows={3} />
          </div>
        </div>
        <div className="ffp-actions">
          <button className="btn btn-anissa-primary" onClick={handleExport} disabled={exporting}>
            {exporting ? 'Export...' : 'Exporter en PDF'}
          </button>
          <button className="btn btn-anissa-secondary" onClick={onClose}>Fermer</button>
        </div>
      </div>
    </div>
  );
}
