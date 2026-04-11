import { useState } from 'react';
import { STEPS, PRESENTIEL_STEPS, getFormuleOptions, FORMULES } from './formSteps';
import { computeMetrics, round1, round0 } from './bodyMetrics';
import { getT } from './translations';

// Field key → translation key for the optional measurements.
const OPTIONAL_MEASUREMENTS = [
  { field: 'tourPoitrine', labelKey: 'field.tourPoitrine' },
  { field: 'tourBrasDroit', labelKey: 'field.tourBrasDroit' },
  { field: 'tourBrasGauche', labelKey: 'field.tourBrasGauche' },
  { field: 'tourCuisseDroite', labelKey: 'field.tourCuisseDroite' },
  { field: 'tourCuisseGauche', labelKey: 'field.tourCuisseGauche' },
  { field: 'tourMollet', labelKey: 'field.tourMollet' },
];

function OptionalMeasurements({ form, updateField, t }) {
  // Auto-open if any optional measurement is already set (editing an existing client).
  const initialOpen = OPTIONAL_MEASUREMENTS.some((m) => form[m.field] !== '' && form[m.field] != null);
  const [open, setOpen] = useState(initialOpen);

  const wrapperStyle = { gridColumn: '1 / -1', marginTop: '8px' };
  const buttonStyle = {
    display: 'inline-flex', alignItems: 'center', gap: '8px',
    padding: '8px 16px', background: '#000', border: '1px solid #c4a050',
    borderRadius: '8px', color: '#c4a050', fontSize: '13px', fontWeight: 600,
    textTransform: 'uppercase', letterSpacing: '.5px', cursor: 'pointer',
  };
  const panelStyle = {
    marginTop: '12px', padding: '16px 18px',
    border: '1px solid #c4a050', borderRadius: '10px', background: '#000',
  };
  const gridStyle = {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px',
  };

  return (
    <div style={wrapperStyle}>
      <button type="button" style={buttonStyle} onClick={() => setOpen((o) => !o)}>
        {t('optional.title')} {open ? '−' : '+'}
      </button>
      {open && (
        <div style={panelStyle}>
          <div style={gridStyle}>
            {OPTIONAL_MEASUREMENTS.map((m) => (
              <Field
                key={m.field}
                label={t(m.labelKey)}
                field={m.field}
                form={form}
                updateField={updateField}
                type="number"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, field, form, updateField, type = 'text', options, fullWidth, rows }) {
  const id = `field-${field}`;

  if (type === 'select') {
    return (
      <div className={`field ${fullWidth ? 'full-width' : ''}`}>
        <label htmlFor={id}>{label}</label>
        <select id={id} value={form[field]} onChange={e => updateField(field, e.target.value)}>
          {options.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
    );
  }

  if (type === 'textarea') {
    return (
      <div className={`field ${fullWidth ? 'full-width' : ''}`}>
        <label htmlFor={id}>{label}</label>
        <textarea
          id={id}
          value={form[field]}
          onChange={e => updateField(field, e.target.value)}
          rows={rows || 3}
        />
      </div>
    );
  }

  return (
    <div className={`field ${fullWidth ? 'full-width' : ''}`}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type={type}
        value={form[field]}
        onChange={e => updateField(field, e.target.value)}
      />
    </div>
  );
}

function MetricsPanel({ form, originalForm, t }) {
  // Baseline = form values as they were when the client was opened (persisted via App.jsx).
  const baselineForm = originalForm || form;
  const current = computeMetrics(form);
  const baseline = computeMetrics(baselineForm);

  const genre = form.genre;
  const needsHipForFemale = genre === 'Femme';
  const missingMsgParts = [];
  if (!current.hasWaist) missingMsgParts.push(t('metrics.label.waist').toLowerCase());
  if (!current.hasNeck) missingMsgParts.push(t('metrics.label.neck').toLowerCase());
  if (needsHipForFemale && !current.hasHip) missingMsgParts.push(t('metrics.label.hip').toLowerCase());

  const canComputeBF = current.bodyFat != null;
  const canComputeBMI = current.bmi != null;

  const baselineHadMeasurements =
    baselineForm.tourTaille || baselineForm.tourCou || baselineForm.poids ||
    baselineForm.tourPoitrine || baselineForm.tourBrasDroit || baselineForm.tourBrasGauche ||
    baselineForm.tourCuisseDroite || baselineForm.tourCuisseGauche || baselineForm.tourMollet;

  const buildComparisonRows = () => {
    if (!baselineHadMeasurements) return [];
    const rows = [];
    const add = (label, prev, now, unit, betterWhen) => {
      if (prev == null && now == null) return;
      if (prev == null || now == null) {
        rows.push({ label, prev, now, unit, delta: null, arrow: '', color: 'inherit' });
        return;
      }
      const delta = now - prev;
      if (Math.abs(delta) < 0.05) return;
      let color = '#999';
      if (betterWhen === 'down') color = delta < 0 ? '#2a9d5c' : '#d84a4a';
      if (betterWhen === 'up') color = delta > 0 ? '#2a9d5c' : '#d84a4a';
      const arrow = delta > 0 ? '▲' : '▼';
      rows.push({ label, prev, now, unit, delta, arrow, color });
    };

    add(t('metrics.label.weight'), toNum(baselineForm.poids), toNum(form.poids), 'kg', 'down');
    add(t('metrics.label.waist'), toNum(baselineForm.tourTaille), toNum(form.tourTaille), 'cm', 'down');
    add(t('metrics.label.hip'), toNum(baselineForm.tourHanche), toNum(form.tourHanche), 'cm', 'down');
    add(t('metrics.label.neck'), toNum(baselineForm.tourCou), toNum(form.tourCou), 'cm', 'down');
    add(t('metrics.label.chest'), toNum(baselineForm.tourPoitrine), toNum(form.tourPoitrine), 'cm', null);
    add(t('metrics.label.rightArm'), toNum(baselineForm.tourBrasDroit), toNum(form.tourBrasDroit), 'cm', null);
    add(t('metrics.label.leftArm'), toNum(baselineForm.tourBrasGauche), toNum(form.tourBrasGauche), 'cm', null);
    add(t('metrics.label.rightThigh'), toNum(baselineForm.tourCuisseDroite), toNum(form.tourCuisseDroite), 'cm', null);
    add(t('metrics.label.leftThigh'), toNum(baselineForm.tourCuisseGauche), toNum(form.tourCuisseGauche), 'cm', null);
    add(t('metrics.label.calf'), toNum(baselineForm.tourMollet), toNum(form.tourMollet), 'cm', null);
    add(t('metrics.label.bmiShort'), baseline.bmi, current.bmi, '', 'down');
    add(t('metrics.label.bfShort'), baseline.bodyFat, current.bodyFat, '%', 'down');
    add(t('metrics.label.leanShort'), baseline.leanMass, current.leanMass, 'kg', 'up');
    add(t('metrics.label.bmrShort'), baseline.bmr, current.bmr, 'kcal', 'up');
    return rows;
  };

  const comparisonRows = buildComparisonRows();

  const panelStyle = {
    gridColumn: '1 / -1', marginTop: '8px', padding: '16px 18px',
    border: '1px solid #c4a050', borderRadius: '10px', background: 'rgba(196,160,80,.08)',
  };
  const titleStyle = { margin: '0 0 12px', color: '#c4a050', fontSize: '14px', letterSpacing: '.5px', textTransform: 'uppercase' };
  const rowStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' };
  const cellStyle = { padding: '10px 12px', background: 'rgba(0,0,0,.25)', borderRadius: '8px', border: '1px solid rgba(196,160,80,.25)' };
  const labelStyle = { fontSize: '11px', color: '#b9a574', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: '4px' };
  const valueStyle = { fontSize: '18px', fontWeight: 600, color: '#f4e6c8' };
  const tagStyle = (color) => ({ display: 'inline-block', marginTop: '4px', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 600, background: `${color}22`, color });

  return (
    <div style={panelStyle}>
      <div style={titleStyle}>{t('metrics.title')}</div>

      {(!canComputeBMI && !canComputeBF) && missingMsgParts.length > 0 && (
        <div style={{ color: '#b9a574', fontSize: '13px', fontStyle: 'italic' }}>
          {t('metrics.hint')}
        </div>
      )}

      <div style={rowStyle}>
        <div style={cellStyle}>
          <div style={labelStyle}>{t('metrics.bmi')}</div>
          <div style={valueStyle}>{canComputeBMI ? round1(current.bmi) : '—'}</div>
          {current.bmiInfo && <span style={tagStyle(current.bmiInfo.color)}>{t(current.bmiInfo.labelKey)}</span>}
        </div>

        <div style={cellStyle}>
          <div style={labelStyle}>{t('metrics.bodyFat')}</div>
          <div style={valueStyle}>{canComputeBF ? `${round1(current.bodyFat)} %` : '—'}</div>
          {current.bodyFatInfo && <span style={tagStyle(current.bodyFatInfo.color)}>{t(current.bodyFatInfo.labelKey)}</span>}
          {!canComputeBF && !genre && (
            <div style={{ fontSize: '11px', color: '#b9a574', marginTop: '4px' }}>{t('metrics.genderRequired')}</div>
          )}
          {!canComputeBF && missingMsgParts.length > 0 && genre && (
            <div style={{ fontSize: '11px', color: '#b9a574', marginTop: '4px' }}>
              {t('metrics.missing')} : {missingMsgParts.join(', ')}
            </div>
          )}
        </div>

        <div style={cellStyle}>
          <div style={labelStyle}>{t('metrics.leanMass')}</div>
          <div style={valueStyle}>{current.leanMass != null ? `${round1(current.leanMass)} kg` : '—'}</div>
        </div>

        <div style={cellStyle}>
          <div style={labelStyle}>{t('metrics.bmr')}</div>
          <div style={valueStyle}>{current.bmr != null ? `${round0(current.bmr)} kcal` : '—'}</div>
          <div style={{ fontSize: '10px', color: '#b9a574', marginTop: '2px' }}>{t('metrics.bmrFormula')}</div>
        </div>
      </div>

      {comparisonRows.length > 0 && (
        <div style={{ marginTop: '16px' }}>
          <div style={titleStyle}>{t('metrics.evolution')}</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ color: '#b9a574', textAlign: 'left' }}>
                  <th style={{ padding: '6px 8px', borderBottom: '1px solid rgba(196,160,80,.25)' }}>{t('metrics.col.measurement')}</th>
                  <th style={{ padding: '6px 8px', borderBottom: '1px solid rgba(196,160,80,.25)' }}>{t('metrics.col.previous')}</th>
                  <th style={{ padding: '6px 8px', borderBottom: '1px solid rgba(196,160,80,.25)' }}>{t('metrics.col.today')}</th>
                  <th style={{ padding: '6px 8px', borderBottom: '1px solid rgba(196,160,80,.25)' }}>{t('metrics.col.change')}</th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((r) => (
                  <tr key={r.label}>
                    <td style={{ padding: '6px 8px', color: '#f4e6c8' }}>{r.label}</td>
                    <td style={{ padding: '6px 8px', color: '#d0c49a' }}>{r.prev != null ? `${round1(r.prev)} ${r.unit}` : '—'}</td>
                    <td style={{ padding: '6px 8px', color: '#f4e6c8' }}>{r.now != null ? `${round1(r.now)} ${r.unit}` : '—'}</td>
                    <td style={{ padding: '6px 8px', color: r.color, fontWeight: 600 }}>
                      {r.delta != null ? `${r.arrow} ${round1(Math.abs(r.delta))} ${r.unit}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function toNum(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

// ─── Helper : build select options with { value, label } pairs where
// value stays stable (usually the French canonical token) and label is translated. ───
function opt(value, label) {
  return { value, label };
}

function Step1Online({ form, updateField, originalForm, t }) {
  return (
    <div className="form-grid">
      <Field label={t('field.prenom')} field="prenom" form={form} updateField={updateField} />
      <Field label={t('field.langue')} field="langue" form={form} updateField={updateField} type="select" options={[
        opt('FR', t('lang.fr')),
        opt('EN', t('lang.en')),
      ]} />
      <Field label={t('field.formule')} field="formule" form={form} updateField={(f, v) => {
        updateField(f, v);
        const defaultRate = FORMULES[v]?.montant;
        if (v !== 'custom' && defaultRate) updateField('customRate', String(defaultRate));
        else if (v === 'custom') updateField('customRate', '');
      }} type="select" options={getFormuleOptions(form.langue)} />
      <Field label={t('field.customRate')} field="customRate" form={form} updateField={updateField} type="number" />
      <Field label={t('field.age')} field="age" form={form} updateField={updateField} type="number" />
      <Field label={t('field.genre')} field="genre" form={form} updateField={updateField} type="select" options={[
        opt('', t('select.placeholder')),
        opt('Homme', t('genre.homme')),
        opt('Femme', t('genre.femme')),
        opt('Autre', t('genre.autre')),
      ]} />
      <Field label={t('field.poids')} field="poids" form={form} updateField={updateField} type="number" />
      <Field label={t('field.taille')} field="taille" form={form} updateField={updateField} type="number" />
      <Field label={t('field.tourTaille')} field="tourTaille" form={form} updateField={updateField} type="number" />
      <Field label={t('field.tourHanche')} field="tourHanche" form={form} updateField={updateField} type="number" />
      <Field label={t('field.tourCou')} field="tourCou" form={form} updateField={updateField} type="number" />
      <MetricsPanel form={form} originalForm={originalForm} t={t} />
      <OptionalMeasurements form={form} updateField={updateField} t={t} />
    </div>
  );
}

function Step1Presentiel({ form, updateField, originalForm, t }) {
  return (
    <div className="form-grid">
      <Field label={t('field.prenom')} field="prenom" form={form} updateField={updateField} />
      <Field label={t('field.langue')} field="langue" form={form} updateField={updateField} type="select" options={[
        opt('FR', t('lang.fr')),
        opt('EN', t('lang.en')),
      ]} />
      <Field label={t('field.pack')} field="pack" form={form} updateField={updateField} type="select" options={[
        opt('pack10', t('pack.pack10')),
        opt('pack20', t('pack.pack20')),
        opt('pack30', t('pack.pack30')),
      ]} />
      <Field label={t('field.age')} field="age" form={form} updateField={updateField} type="number" />
      <Field label={t('field.genre')} field="genre" form={form} updateField={updateField} type="select" options={[
        opt('', t('select.placeholder')),
        opt('Homme', t('genre.homme')),
        opt('Femme', t('genre.femme')),
        opt('Autre', t('genre.autre')),
      ]} />
      <Field label={t('field.poids')} field="poids" form={form} updateField={updateField} type="number" />
      <Field label={t('field.taille')} field="taille" form={form} updateField={updateField} type="number" />
      <Field label={t('field.tourTaille')} field="tourTaille" form={form} updateField={updateField} type="number" />
      <Field label={t('field.tourHanche')} field="tourHanche" form={form} updateField={updateField} type="number" />
      <Field label={t('field.tourCou')} field="tourCou" form={form} updateField={updateField} type="number" />
      <MetricsPanel form={form} originalForm={originalForm} t={t} />
      <OptionalMeasurements form={form} updateField={updateField} t={t} />
    </div>
  );
}

function Step2({ form, updateField, t }) {
  return (
    <div className="form-grid">
      <Field label={t('field.objectifPrincipal')} field="objectifPrincipal" form={form} updateField={updateField} fullWidth type="textarea" />
      <Field label={t('field.objectifSecondaire')} field="objectifSecondaire" form={form} updateField={updateField} fullWidth type="textarea" />
      <Field label={t('field.deadline')} field="deadline" form={form} updateField={updateField} />
      <div className="field" />
      <Field label={t('field.motivationProfonde')} field="motivationProfonde" form={form} updateField={updateField} fullWidth type="textarea" rows={4} />
    </div>
  );
}

function Step3({ form, updateField, t }) {
  return (
    <div className="form-grid">
      <Field label={t('field.niveau')} field="niveau" form={form} updateField={updateField} type="select" options={[
        opt('', t('select.placeholder')),
        opt('Debutant', t('niveau.debutant')),
        opt('Intermediaire', t('niveau.intermediaire')),
        opt('Avance', t('niveau.avance')),
        opt('Athlete', t('niveau.athlete')),
      ]} />
      <Field label={t('field.frequence')} field="frequence" form={form} updateField={updateField} />
      <Field label={t('field.duree')} field="duree" form={form} updateField={updateField} type="select" options={[
        opt('', t('select.placeholder')),
        opt('30 min', '30 min'),
        opt('45 min', '45 min'),
        opt('60 min', '60 min'),
        opt('75 min', '75 min'),
        opt('90 min', '90 min'),
      ]} />
      <Field label={t('field.lieu')} field="lieu" form={form} updateField={updateField} type="select" options={[
        opt('', t('select.placeholder')),
        opt('Salle de sport', t('lieu.salle')),
        opt('Domicile', t('lieu.domicile')),
        opt('Exterieur', t('lieu.exterieur')),
        opt('Mixte', t('lieu.mixte')),
      ]} />
      <Field label={t('field.equipement')} field="equipement" form={form} updateField={updateField} fullWidth type="textarea" />
      <Field label={t('field.historique')} field="historique" form={form} updateField={updateField} fullWidth type="textarea" />
      <Field label={t('field.exercicesAimes')} field="exercicesAimes" form={form} updateField={updateField} fullWidth type="textarea" />
      <Field label={t('field.exercicesEvites')} field="exercicesEvites" form={form} updateField={updateField} fullWidth type="textarea" />
    </div>
  );
}

function Step4({ form, updateField, t }) {
  return (
    <div className="form-grid">
      <Field label={t('field.blessures')} field="blessures" form={form} updateField={updateField} fullWidth type="textarea" rows={4} />
      <Field label={t('field.problemesSante')} field="problemesSante" form={form} updateField={updateField} fullWidth type="textarea" rows={4} />
      <Field label={t('field.medicaments')} field="medicaments" form={form} updateField={updateField} fullWidth type="textarea" />
    </div>
  );
}

function Step5({ form, updateField, t }) {
  return (
    <div className="form-grid">
      <Field label={t('field.objectifNutrition')} field="objectifNutrition" form={form} updateField={updateField} type="select" options={[
        opt('', t('select.placeholder')),
        opt('Perte de poids', t('nutri.perte')),
        opt('Prise de masse', t('nutri.prise')),
        opt('Recomposition', t('nutri.recomp')),
        opt('Maintien', t('nutri.maintien')),
        opt('Performance', t('nutri.perf')),
        opt('Sante generale', t('nutri.sante')),
      ]} />
      <Field label={t('field.niveauCuisine')} field="niveauCuisine" form={form} updateField={updateField} type="select" options={[
        opt('', t('select.placeholder')),
        opt('Debutant', t('cuisine.debutant')),
        opt('Basique', t('cuisine.basique')),
        opt('Intermediaire', t('cuisine.intermediaire')),
        opt('Bon cuisinier', t('cuisine.bon')),
      ]} />
      <Field label={t('field.allergies')} field="allergies" form={form} updateField={updateField} fullWidth />
      <Field label={t('field.preferencesAlimentaires')} field="preferencesAlimentaires" form={form} updateField={updateField} fullWidth />
      <Field label={t('field.frequenceRestaurant')} field="frequenceRestaurant" form={form} updateField={updateField} type="select" options={[
        opt('', t('select.placeholder')),
        opt('Rarement', t('resto.rarement')),
        opt('1-2x/semaine', t('resto.1-2')),
        opt('3-4x/semaine', t('resto.3-4')),
        opt('Quasi quotidien', t('resto.quotidien')),
      ]} />
    </div>
  );
}

function Step6({ form, updateField, t }) {
  return (
    <div className="form-grid">
      <Field label={t('field.sommeil')} field="sommeil" form={form} updateField={updateField} />
      <Field label={t('field.stress')} field="stress" form={form} updateField={updateField} type="select" options={[
        opt('', t('select.placeholder')),
        ...Array.from({ length: 10 }, (_, i) => opt(String(i + 1), `${i + 1}/10`)),
      ]} />
      <Field label={t('field.travail')} field="travail" form={form} updateField={updateField} type="select" options={[
        opt('', t('select.placeholder')),
        opt('Sedentaire (bureau)', t('travail.sedentaire')),
        opt('Mixte', t('travail.mixte')),
        opt('Actif / debout', t('travail.actif')),
        opt('Physique / manuel', t('travail.physique')),
      ]} />
      <Field label={t('field.alcool')} field="alcool" form={form} updateField={updateField} type="select" options={[
        opt('', t('select.placeholder')),
        opt('Jamais', t('alcool.jamais')),
        opt('Occasionnel', t('alcool.occasionnel')),
        opt('Regulier', t('alcool.regulier')),
        opt('Frequent', t('alcool.frequent')),
      ]} />
      <Field label={t('field.hydratation')} field="hydratation" form={form} updateField={updateField} type="select" options={[
        opt('', t('select.placeholder')),
        opt('Moins de 1L', t('hydra.lt1')),
        opt('1-1.5L', t('hydra.1-1.5')),
        opt('1.5-2L', t('hydra.1.5-2')),
        opt('2-3L', t('hydra.2-3')),
        opt('Plus de 3L', t('hydra.gt3')),
      ]} />
    </div>
  );
}

function Step7Online({ form, updateField, t }) {
  return (
    <div className="form-grid">
      <Field label={t('field.dejaCoach')} field="dejaCoach" form={form} updateField={updateField} type="select" options={[
        opt('', t('select.placeholder')),
        opt('Non, jamais', t('coach.non')),
        opt('Oui, en salle', t('coach.salle')),
        opt('Oui, en ligne', t('coach.online')),
        opt('Oui, les deux', t('coach.deux')),
      ]} />
      <Field label={t('field.appsFitness')} field="appsFitness" form={form} updateField={updateField} />
      <Field label={t('field.pasMarche')} field="pasMarche" form={form} updateField={updateField} fullWidth type="textarea" rows={4} />
      <Field label={t('field.attentes')} field="attentes" form={form} updateField={updateField} fullWidth type="textarea" rows={4} />
    </div>
  );
}

function Step8({ form, updateField, t }) {
  return (
    <div className="form-grid">
      <Field
        label={t('field.notesCoach')}
        field="notesCoach"
        form={form}
        updateField={updateField}
        fullWidth
        type="textarea"
        rows={10}
      />
    </div>
  );
}

// Online: 8 steps
const ONLINE_STEP_COMPONENTS = {
  1: Step1Online, 2: Step2, 3: Step3, 4: Step4,
  5: Step5, 6: Step6, 7: Step7Online, 8: Step8,
};

// Presentiel: 7 steps (no "Coaching context" step)
const PRESENTIEL_STEP_COMPONENTS = {
  1: Step1Presentiel, 2: Step2, 3: Step3, 4: Step4,
  5: Step5, 6: Step6, 7: Step8,
};

// Per-category title-key map — maps (categorie, step id) → translation key
const TITLE_KEYS = {
  online: {
    1: 'title.identite', 2: 'title.objectifs', 3: 'title.sport', 4: 'title.sante',
    5: 'title.nutrition', 6: 'title.lifestyle', 7: 'title.contexte', 8: 'title.mesNotes',
  },
  presentiel: {
    1: 'title.identite', 2: 'title.objectifs', 3: 'title.sport', 4: 'title.sante',
    5: 'title.nutrition', 6: 'title.lifestyle', 7: 'title.mesNotes',
  },
};

export default function StepForm({ step, form, updateField, categorie = 'online', originalForm }) {
  const isPresentiel = categorie === 'presentiel';
  const stepComponents = isPresentiel ? PRESENTIEL_STEP_COMPONENTS : ONLINE_STEP_COMPONENTS;
  const steps = isPresentiel ? PRESENTIEL_STEPS : STEPS;
  const StepComponent = stepComponents[step];
  const stepInfo = steps.find(s => s.id === step);
  const t = getT(form.langue);
  const titleKey = TITLE_KEYS[isPresentiel ? 'presentiel' : 'online'][step];
  const title = titleKey ? t(titleKey) : stepInfo.title;

  return (
    <div className="form-section" key={step}>
      <h2>{title}</h2>
      <StepComponent form={form} updateField={updateField} originalForm={originalForm} t={t} />
    </div>
  );
}
