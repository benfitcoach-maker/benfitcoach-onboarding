import {
  MASSAGE_STEPS,
  ZONES_DOULOUREUSES_OPTIONS,
  CONTRE_INDICATIONS_OPTIONS,
  OBJECTIF_MASSAGE_OPTIONS,
} from './formSteps';

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

function CheckboxGroup({ label, options, selected, onChange, fullWidth }) {
  const toggleItem = (item) => {
    if (selected.includes(item)) {
      onChange(selected.filter(i => i !== item));
    } else {
      onChange([...selected, item]);
    }
  };

  return (
    <div className={`field ${fullWidth ? 'full-width' : ''}`}>
      <label>{label}</label>
      <div className="checkbox-group">
        {options.map(opt => (
          <button
            key={opt}
            type="button"
            className={`checkbox-chip ${selected.includes(opt) ? 'checkbox-chip-active' : ''}`}
            onClick={() => toggleItem(opt)}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

function MassageStep1({ form, updateField }) {
  return (
    <div className="form-grid">
      <Field label="Prenom" field="prenom" form={form} updateField={updateField} />
      <Field label="Nom" field="nom" form={form} updateField={updateField} />
      <Field label="Age" field="age" form={form} updateField={updateField} type="number" />
      <Field label="Genre" field="genre" form={form} updateField={updateField} type="select" options={[
        { value: '', label: 'Selectionner...' },
        { value: 'Homme', label: 'Homme' },
        { value: 'Femme', label: 'Femme' },
        { value: 'Autre', label: 'Autre' },
      ]} />
      <Field label="Telephone" field="telephone" form={form} updateField={updateField} type="tel" />
      <Field label="Email" field="email" form={form} updateField={updateField} type="email" />
      <Field label="Tarif reel (CHF)" field="customRate" form={form} updateField={updateField} type="number" />
    </div>
  );
}

function MassageStep2({ form, updateField }) {
  return (
    <div className="form-grid">
      <Field
        label="Motif de consultation"
        field="motifConsultation"
        form={form}
        updateField={updateField}
        fullWidth
        type="textarea"
        rows={4}
      />
      <CheckboxGroup
        label="Zones douloureuses"
        options={ZONES_DOULOUREUSES_OPTIONS}
        selected={form.zonesDouloureuses || []}
        onChange={val => updateField('zonesDouloureuses', val)}
        fullWidth
      />
      <Field label="Type de douleur" field="typeDouleur" form={form} updateField={updateField} type="select" options={[
        { value: '', label: 'Selectionner...' },
        { value: 'Musculaire', label: 'Musculaire' },
        { value: 'Articulaire', label: 'Articulaire' },
        { value: 'Nerveuse', label: 'Nerveuse' },
        { value: 'Autre', label: 'Autre' },
      ]} />
      <Field label="Intensite (1-10)" field="intensiteDouleur" form={form} updateField={updateField} type="select" options={[
        { value: '', label: 'Selectionner...' },
        ...Array.from({ length: 10 }, (_, i) => ({ value: String(i + 1), label: `${i + 1}/10` })),
      ]} />
      <Field
        label="Depuis combien de temps"
        field="dureeDouleur"
        form={form}
        updateField={updateField}
        fullWidth
      />
    </div>
  );
}

function MassageStep3({ form, updateField }) {
  return (
    <div className="form-grid">
      <Field
        label="Traitements en cours (physio, chiro, medecin, osteo...)"
        field="traitementsEnCours"
        form={form}
        updateField={updateField}
        fullWidth
        type="textarea"
      />
      <Field
        label="Medicaments"
        field="medicaments"
        form={form}
        updateField={updateField}
        fullWidth
        type="textarea"
      />
      <Field
        label="Operations recentes"
        field="operationsRecentes"
        form={form}
        updateField={updateField}
        fullWidth
        type="textarea"
      />
      <CheckboxGroup
        label="Contre-indications"
        options={CONTRE_INDICATIONS_OPTIONS}
        selected={form.contreIndications || []}
        onChange={val => updateField('contreIndications', val)}
        fullWidth
      />
      <Field
        label="Allergies (huiles, cremes, latex)"
        field="allergiesMassage"
        form={form}
        updateField={updateField}
        fullWidth
      />
    </div>
  );
}

function MassageStep4({ form, updateField }) {
  return (
    <div className="form-grid">
      <Field label="Pression preferee" field="pressionPreferee" form={form} updateField={updateField} type="select" options={[
        { value: '', label: 'Selectionner...' },
        { value: 'Legere', label: 'Legere' },
        { value: 'Moyenne', label: 'Moyenne' },
        { value: 'Ferme', label: 'Ferme' },
        { value: 'Tres ferme', label: 'Tres ferme' },
      ]} />
      <Field label="Deja eu des massages therapeutiques" field="dejaMassage" form={form} updateField={updateField} type="select" options={[
        { value: '', label: 'Selectionner...' },
        { value: 'Oui', label: 'Oui' },
        { value: 'Non', label: 'Non' },
      ]} />
      <Field
        label="Zones a eviter"
        field="zonesAEviter"
        form={form}
        updateField={updateField}
        fullWidth
        type="textarea"
      />
      <Field label="Frequence souhaitee" field="frequenceSouhaitee" form={form} updateField={updateField} type="select" options={[
        { value: '', label: 'Selectionner...' },
        { value: '1x/semaine', label: '1x par semaine' },
        { value: '2x/mois', label: '2x par mois' },
        { value: '1x/mois', label: '1x par mois' },
        { value: 'Ponctuel', label: 'Ponctuel' },
      ]} />
      <CheckboxGroup
        label="Objectif du massage"
        options={OBJECTIF_MASSAGE_OPTIONS}
        selected={form.objectifMassage || []}
        onChange={val => updateField('objectifMassage', val)}
        fullWidth
      />
    </div>
  );
}

function MassageStep5({ form, updateField }) {
  return (
    <div className="form-grid">
      <Field
        label="Notes du therapeute (observations, techniques, zones traitees, recommandations, prochain RDV)"
        field="notesCoach"
        form={form}
        updateField={updateField}
        fullWidth
        type="textarea"
        rows={12}
      />
    </div>
  );
}

const MASSAGE_STEP_COMPONENTS = {
  1: MassageStep1,
  2: MassageStep2,
  3: MassageStep3,
  4: MassageStep4,
  5: MassageStep5,
};

export default function MassageForm({ step, form, updateField }) {
  const StepComponent = MASSAGE_STEP_COMPONENTS[step];
  const stepInfo = MASSAGE_STEPS.find(s => s.id === step);

  return (
    <div className="form-section" key={step}>
      <h2>{stepInfo.title}</h2>
      <StepComponent form={form} updateField={updateField} />
    </div>
  );
}
