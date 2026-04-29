import { useState } from 'react';
import { jsPDF } from 'jspdf';
import { generateMedicalSummary } from './services/aiMedicalSummary';
import { CharCounter } from './App';

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

// V94.10 : extrait les supplements avec 5 champs structures
// (matche le format genere par parseSupplementEntriesStructured du Word).
// Pour chaque supplement, on essaie de capturer Moment/Dose/Pourquoi/Duree/Attention.
function extractSupplementsTable(text) {
  if (!text) return [];
  const rows = [];
  const lines = text.split('\n');
  let current = null;

  const isHeader = (l) => {
    if (!l || l.length > 50) return false;
    if (l.includes(':') && l.indexOf(':') < l.length - 3) return false;
    const upperChars = (l.match(/[A-Z0-9 +\-/()]/g) || []).length;
    return l.length >= 4 && upperChars >= l.length * 0.7;
  };

  const parseField = (l) => {
    const m = l.replace(/^[—\-•*·]\s*/, '').match(/^([A-Za-zéè][^:]{0,30}?)\s*:\s*(.+)$/);
    if (!m) return null;
    const lab = m[1].toLowerCase().trim();
    const val = m[2].trim();
    if (/dose|dosage/.test(lab)) return { key: 'dose', val };
    if (/moment|quand|horaire|timing|when/.test(lab)) return { key: 'moment', val };
    if (/justif|raison|pourquoi|why|reason|sources?/.test(lab)) return { key: 'pourquoi', val };
    if (/interact|attention|eviter|caution|warning|avoid/.test(lab)) return { key: 'attention', val };
    if (/duree|pendant|cure|duration|length/.test(lab)) return { key: 'duree', val };
    return null;
  };

  for (const rawLine of lines) {
    const t = rawLine.replace(/\*\*/g, '').replace(/#{1,3}\s*/g, '').trim();
    if (!t) continue;
    if (isHeader(t)) {
      if (current) rows.push(current);
      current = { name: t, moment: '', dose: '', pourquoi: '', duree: '', attention: '' };
      continue;
    }
    if (current) {
      const f = parseField(t);
      if (f) current[f.key] = current[f.key] ? current[f.key] + ' ' + f.val : f.val;
    }
  }
  if (current) rows.push(current);
  return rows.slice(0, 8);
}

function buildInitialData(form, consultation) {
  const imc = calcIMC(form.poids, form.taille);
  const supplements = extractSupplementsTable(consultation.supplements || consultation.nutritionPlan);

  return {
    // V94.17 : analyses biologiques proposees au medecin — vide par defaut, l IA remplit
    analysesProposees: [],
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
    // V94.10 : plus de breathing room au-dessus du titre + sous le titre
    y += 1;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...GREEN);
    doc.text(title, m, y);
    y += 6;
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

  // V94.17 : Section 4 — Examens biologiques proposes (a valider/prescrire par le medecin)
  const analyses = data.analysesProposees || [];
  if (analyses.length > 0) {
    addTitle('4. EXAMENS BIOLOGIQUES PROPOSES');
    // Sous-titre explicatif gris
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(...GREY);
    doc.text('A valider et prescrire par le medecin pour affiner l accompagnement nutritionnel.', m + 2, y);
    y += 4.5;
    doc.setFont('helvetica', 'normal');

    // Liste avec puce + nom examen + justification en italique
    const colNameW = 60;
    const colJustifX = m + 2 + colNameW + 4;
    const colJustifW = pw - m - colJustifX - 2;
    const lh = 3.2;

    for (const a of analyses) {
      const nameLines = doc.splitTextToSize(a.analyse || '', colNameW);
      const justifLines = doc.splitTextToSize(a.justification || '', colJustifW);
      const maxLines = Math.max(nameLines.length, justifLines.length);

      // Puce or
      doc.setFontSize(8);
      doc.setTextColor(196, 160, 80);
      doc.text('\u2022', m + 2, y + 1);

      // Nom examen (vert sapin, bold)
      doc.setFontSize(8.2);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...GREEN);
      for (let i = 0; i < nameLines.length; i++) {
        doc.text(nameLines[i], m + 6, y + 1 + i * lh);
      }

      // Justification (gris fonce, italic)
      doc.setFontSize(7.8);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(...DARK);
      for (let i = 0; i < justifLines.length; i++) {
        doc.text(justifLines[i], colJustifX, y + 1 + i * lh);
      }

      y += maxLines * lh + 1.8;
    }
    doc.setFont('helvetica', 'normal');
    y += 2;
    addSep();
  }

  // Section 5 — Recommandations
  addTitle('5. RECOMMANDATIONS NUTRITIONNELLES');
  addText('Approche : ' + data.approche);
  addText('Aliments cles : ' + data.alimentsCles);
  addText('A eviter : ' + data.alimentsEviter);
  addSep();

  // Section 6 — Supplements (cards style miroir du Word V94.4)
  // V94.10 : chaque supplement = card avec liseré doré gauche + fond beige
  // + nom MAJ vert + fields (Moment/Dose/Pourquoi/Durée/Attention) labels or.
  addTitle('6. SUPPLEMENTS RECOMMANDES');
  y += 2; // breathing room avant les cards

  if (data.supplements.length > 0) {
    const PAGE_H = doc.internal.pageSize.getHeight();
    const FOOTER_RESERVE = 28; // mm reserves pour le footer + signature
    const CARD_PAD_TOP = 3;
    const CARD_PAD_BOT = 3;
    const CARD_PAD_LEFT = 7; // espace pour le liseré doré
    const CARD_PAD_RIGHT = 4;
    const CARD_GAP = 3; // espace entre cards
    const LABEL_W = 22; // largeur reservee pour les labels MOMENT/DOSE/...
    const LH = 3.5; // line height

    const drawCard = (supp) => {
      // Mesurer la hauteur totale de la card
      const fields = [
        { label: 'MOMENT', value: supp.moment },
        { label: 'DOSE', value: supp.dose },
        { label: 'POURQUOI', value: supp.pourquoi },
        { label: 'DURÉE', value: supp.duree },
        { label: 'ATTENTION', value: supp.attention },
      ].filter(f => f.value && f.value.trim());

      const nameW = pw - m * 2 - CARD_PAD_LEFT - CARD_PAD_RIGHT;
      const valueW = nameW - LABEL_W;

      doc.setFontSize(9);
      const nameLines = doc.splitTextToSize((supp.name || '').toUpperCase(), nameW);
      doc.setFontSize(7.8);
      const fieldsHeights = fields.map(f => doc.splitTextToSize(f.value, valueW).length * LH);

      let cardH = CARD_PAD_TOP + nameLines.length * 4 + 1.5; // titre + petite separation
      cardH += fieldsHeights.reduce((a, b) => a + b, 0);
      cardH += fields.length * 1; // petit interligne entre fields
      cardH += CARD_PAD_BOT;

      // Page break si necessaire
      if (y + cardH > PAGE_H - FOOTER_RESERVE) {
        doc.addPage();
        y = 15;
      }

      // Background card (beige)
      doc.setFillColor(245, 240, 224); // F5F0E0
      doc.rect(m, y, pw - m * 2, cardH, 'F');

      // Liseré doré gauche
      doc.setFillColor(196, 160, 80); // gold
      doc.rect(m, y, 1.2, cardH, 'F');

      // Nom du supplement (vert sapin, bold)
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...GREEN);
      let yy = y + CARD_PAD_TOP + 3;
      for (const ln of nameLines) {
        doc.text(ln, m + CARD_PAD_LEFT, yy);
        yy += 4;
      }
      yy += 1.5;

      // Fields
      doc.setFontSize(7.8);
      for (let i = 0; i < fields.length; i++) {
        const f = fields[i];
        const valueLines = doc.splitTextToSize(f.value, valueW);

        // Label (gold, bold)
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(196, 160, 80); // gold
        doc.text(f.label, m + CARD_PAD_LEFT, yy);

        // Value (dark, normal)
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...DARK);
        for (let j = 0; j < valueLines.length; j++) {
          doc.text(valueLines[j], m + CARD_PAD_LEFT + LABEL_W, yy + j * LH);
        }
        yy += valueLines.length * LH + 1;
      }

      y += cardH + CARD_GAP;
    };

    for (const supp of data.supplements) {
      if (!supp || !supp.name) continue;
      drawCard(supp);
    }
  } else {
    addText('Voir le plan nutrition detaille.');
  }
  y += 3;
  addSep();

  // Section 6 — Coordination
  addTitle('7. COORDINATION DEMANDEE');
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
  doc.text('Anissa Deroubaix — Nutritionniste specialisee en longevite et genetique', pw / 2, fy + 4, { align: 'center' });
  doc.text('AB Coaching Sarl · Rue de Rive 28, 1260 Nyon', pw / 2, fy + 8, { align: 'center' });
  doc.text('Document confidentiel — usage medical uniquement', pw / 2, fy + 12, { align: 'center' });

  return doc;
}

// ─── PREVIEW MODAL ───

export default function MedicalSummary({ form, consultation, onClose }) {
  const [data, setData] = useState(() => buildInitialData(form, consultation));
  const [exporting, setExporting] = useState(false);
  // V94.5 : generation IA pour pre-remplir antecedents, approche, suppl. raisons, etc.
  const [generating, setGenerating] = useState(false);
  const [aiError, setAiError] = useState('');

  const update = (field, value) => setData(prev => ({ ...prev, [field]: value }));

  // V94.5 : appel IA Claude Haiku qui remplit tous les champs (raisons suppl. inclus)
  const handleAIGenerate = async () => {
    setGenerating(true);
    setAiError('');
    try {
      const aiData = await generateMedicalSummary(form, consultation);
      // Merge : on garde patient/objectif (deja deduits du form) + on remplace le reste
      setData(prev => ({
        ...prev,
        antecedents: aiData.antecedents || prev.antecedents,
        bilans: aiData.bilans || prev.bilans,
        // V94.17 : analyses biologiques proposees au medecin
        analysesProposees: aiData.analysesProposees?.length ? aiData.analysesProposees : prev.analysesProposees,
        approche: aiData.approche || prev.approche,
        alimentsCles: aiData.alimentsCles || prev.alimentsCles,
        alimentsEviter: aiData.alimentsEviter || prev.alimentsEviter,
        supplements: aiData.supplements?.length ? aiData.supplements : prev.supplements,
        coordination: aiData.coordination || prev.coordination,
      }));
    } catch (err) {
      console.error('[MedicalSummary AI]', err);
      setAiError(err?.message || 'Erreur generation IA');
    } finally {
      setGenerating(false);
    }
  };
  const updateSupplement = (idx, field, value) => {
    setData(prev => {
      const s = [...prev.supplements];
      s[idx] = { ...s[idx], [field]: value };
      return { ...prev, supplements: s };
    });
  };
  const addSupplement = () => {
    if (data.supplements.length >= 8) return;
    setData(prev => ({
      ...prev,
      supplements: [...prev.supplements, { name: '', moment: '', dose: '', pourquoi: '', duree: '', attention: '' }],
    }));
  };
  const removeSupplement = (idx) => {
    setData(prev => ({ ...prev, supplements: prev.supplements.filter((_, i) => i !== idx) }));
  };

  // V94.17 : helpers analyses biologiques proposees
  const updateAnalyse = (idx, field, value) => {
    setData(prev => {
      const a = [...(prev.analysesProposees || [])];
      a[idx] = { ...a[idx], [field]: value };
      return { ...prev, analysesProposees: a };
    });
  };
  const addAnalyse = () => {
    setData(prev => {
      const list = prev.analysesProposees || [];
      if (list.length >= 8) return prev;
      return { ...prev, analysesProposees: [...list, { analyse: '', justification: '' }] };
    });
  };
  const removeAnalyse = (idx) => {
    setData(prev => ({
      ...prev,
      analysesProposees: (prev.analysesProposees || []).filter((_, i) => i !== idx),
    }));
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
          {/* V94.5 : bouton de generation IA en haut de la modal */}
          <div style={{ marginBottom: 14, padding: '10px 12px', background: 'rgba(106,191,138,.06)', border: '1px solid rgba(106,191,138,.18)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ fontSize: '.78rem', color: '#8abf9a', lineHeight: 1.4 }}>
              {generating
                ? 'Generation IA en cours... (raisons suppl., approche, antecedents)'
                : 'Pre-remplis tous les champs avec une analyse IA du profil + plan + bilans.'}
            </div>
            <button
              type="button"
              className="btn btn-anissa-primary"
              onClick={handleAIGenerate}
              disabled={generating || exporting}
              style={{ padding: '6px 14px', fontSize: '.78rem', whiteSpace: 'nowrap' }}
            >
              {generating ? 'Generation...' : '✨ Generer avec IA'}
            </button>
          </div>
          {aiError && (
            <div style={{ marginBottom: 12, padding: '8px 10px', background: 'rgba(212,92,76,.1)', border: '1px solid rgba(212,92,76,.3)', borderRadius: 8, fontSize: '.75rem', color: '#d4806c' }}>
              {aiError}
            </div>
          )}

          {/* V94.16 : skeleton loader pendant generation IA — meilleur UX qu un spinner */}
          {generating && (
            <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <style>{`
                @keyframes bfcShimmer {
                  0% { background-position: -200px 0; }
                  100% { background-position: calc(200px + 100%) 0; }
                }
                .bfc-skeleton {
                  background: linear-gradient(90deg, rgba(255,255,255,.04) 0%, rgba(255,255,255,.10) 50%, rgba(255,255,255,.04) 100%);
                  background-size: 200px 100%;
                  background-repeat: no-repeat;
                  animation: bfcShimmer 1.4s ease-in-out infinite;
                  border-radius: 6px;
                }
              `}</style>
              {/* Patient skeleton */}
              <div className="bfc-skeleton" style={{ height: 14, width: '40%' }} />
              <div className="bfc-skeleton" style={{ height: 32 }} />
              {/* Antecedents skeleton (4 lignes) */}
              <div className="bfc-skeleton" style={{ height: 14, width: '30%', marginTop: 6 }} />
              <div className="bfc-skeleton" style={{ height: 12 }} />
              <div className="bfc-skeleton" style={{ height: 12, width: '92%' }} />
              <div className="bfc-skeleton" style={{ height: 12, width: '88%' }} />
              <div className="bfc-skeleton" style={{ height: 12, width: '70%' }} />
              {/* Approche skeleton */}
              <div className="bfc-skeleton" style={{ height: 14, width: '32%', marginTop: 6 }} />
              <div className="bfc-skeleton" style={{ height: 12 }} />
              <div className="bfc-skeleton" style={{ height: 12, width: '85%' }} />
              {/* Supplements skeletons (3 cards) */}
              <div className="bfc-skeleton" style={{ height: 14, width: '38%', marginTop: 6 }} />
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  border: '1px solid rgba(196,160,80,.18)',
                  borderLeft: '3px solid rgba(196,160,80,.4)',
                  borderRadius: 8, padding: '10px 12px',
                  display: 'flex', flexDirection: 'column', gap: 6,
                }}>
                  <div className="bfc-skeleton" style={{ height: 14, width: '45%' }} />
                  <div className="bfc-skeleton" style={{ height: 11, width: '70%' }} />
                  <div className="bfc-skeleton" style={{ height: 11, width: '90%' }} />
                  <div className="bfc-skeleton" style={{ height: 11, width: '60%' }} />
                </div>
              ))}
            </div>
          )}

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
            <CharCounter value={data.antecedents} soft={300} max={600} />
          </div>
          <div className="ffp-field">
            <label>Bilans effectues</label>
            <textarea value={data.bilans} onChange={e => update('bilans', e.target.value)} rows={3} />
            <CharCounter value={data.bilans} soft={250} max={500} />
          </div>

          {/* V94.17 : Examens biologiques proposes au medecin (anchois pour le bilan complementaire) */}
          <div className="ffp-field">
            <label>
              Examens biologiques proposés au médecin
              <span style={{ fontWeight: 400, fontSize: '.7rem', color: 'rgba(255,255,255,.4)', marginLeft: 8 }}>
                (à valider et prescrire par le médecin)
              </span>
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(data.analysesProposees || []).map((a, i) => (
                <div
                  key={i}
                  style={{
                    border: '1px solid rgba(96,165,250,.25)',
                    borderLeft: '3px solid rgba(96,165,250,.7)',
                    borderRadius: 8,
                    padding: '10px 12px',
                    background: 'rgba(96,165,250,.04)',
                  }}
                >
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                    <input
                      placeholder="Nom de l'examen (ex: Vitamine D 25-OH)"
                      value={a.analyse || ''}
                      onChange={e => updateAnalyse(i, 'analyse', e.target.value)}
                      style={{ flex: 1, fontWeight: 600, fontSize: '.82rem' }}
                    />
                    <button
                      type="button"
                      className="ne-action-btn ne-delete-btn"
                      onClick={() => removeAnalyse(i)}
                      title="Retirer cet examen"
                    >&times;</button>
                  </div>
                  <input
                    placeholder="Justification (lien factuel au profil patient)"
                    value={a.justification || ''}
                    onChange={e => updateAnalyse(i, 'justification', e.target.value)}
                    style={{ fontSize: '.78rem' }}
                  />
                </div>
              ))}
              {(data.analysesProposees || []).length < 8 && (
                <button
                  type="button"
                  className="btn btn-xs btn-anissa-secondary"
                  onClick={addAnalyse}
                  style={{ alignSelf: 'flex-start' }}
                >+ Ajouter un examen</button>
              )}
              {(data.analysesProposees || []).length === 0 && (
                <span style={{ fontSize: '.72rem', color: 'rgba(255,255,255,.35)', fontStyle: 'italic' }}>
                  Aucun examen proposé. Clique sur ✨ Generer avec IA pour suggérer des examens pertinents selon le profil.
                </span>
              )}
            </div>
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

          {/* V94.10 : cards eclatees avec 5 champs (Moment / Dose / Pourquoi / Duree / Attention) */}
          <div className="ffp-field">
            <label>Supplements recommandes</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {data.supplements.map((s, i) => (
                <div
                  key={i}
                  style={{
                    border: '1px solid rgba(196,160,80,.25)',
                    borderLeft: '3px solid rgba(196,160,80,.7)',
                    borderRadius: 8,
                    padding: '10px 12px',
                    background: 'rgba(245,240,224,.04)',
                  }}
                >
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                    <input
                      placeholder="NOM SUPPLEMENT"
                      value={s.name}
                      onChange={e => updateSupplement(i, 'name', e.target.value)}
                      style={{ flex: 1, fontWeight: 700, textTransform: 'uppercase', fontSize: '.85rem' }}
                    />
                    <button
                      type="button"
                      className="ne-action-btn ne-delete-btn"
                      onClick={() => removeSupplement(i)}
                      title="Supprimer"
                    >&times;</button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr', gap: '4px 8px', alignItems: 'center', fontSize: '.78rem' }}>
                    <span style={{ color: '#c4a050', fontWeight: 600, fontSize: '.7rem' }}>MOMENT</span>
                    <input value={s.moment || ''} onChange={e => updateSupplement(i, 'moment', e.target.value)} placeholder="Le matin avec le repas..." style={{ fontSize: '.78rem' }} />
                    <span style={{ color: '#c4a050', fontWeight: 600, fontSize: '.7rem' }}>DOSE</span>
                    <input value={s.dose || ''} onChange={e => updateSupplement(i, 'dose', e.target.value)} placeholder="2000 UI (Burgerstein)" style={{ fontSize: '.78rem' }} />
                    <span style={{ color: '#c4a050', fontWeight: 600, fontSize: '.7rem' }}>POURQUOI</span>
                    <input value={s.pourquoi || ''} onChange={e => updateSupplement(i, 'pourquoi', e.target.value)} placeholder="Lien factuel au profil" style={{ fontSize: '.78rem' }} />
                    <span style={{ color: '#c4a050', fontWeight: 600, fontSize: '.7rem' }}>DURÉE</span>
                    <input value={s.duree || ''} onChange={e => updateSupplement(i, 'duree', e.target.value)} placeholder="3 mois puis pause" style={{ fontSize: '.78rem' }} />
                    <span style={{ color: '#c4a050', fontWeight: 600, fontSize: '.7rem' }}>ATTENTION</span>
                    <input value={s.attention || ''} onChange={e => updateSupplement(i, 'attention', e.target.value)} placeholder="Interaction / surveillance" style={{ fontSize: '.78rem' }} />
                  </div>
                </div>
              ))}
              {data.supplements.length < 8 && (
                <button type="button" className="btn btn-xs btn-anissa-secondary" onClick={addSupplement} style={{ marginTop: 4, alignSelf: 'flex-start' }}>+ Ajouter un supplement</button>
              )}
            </div>
          </div>

          <div className="ffp-field">
            <label>Message de coordination</label>
            <textarea value={data.coordination} onChange={e => update('coordination', e.target.value)} rows={3} />
            <CharCounter value={data.coordination} soft={400} max={700} />
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
