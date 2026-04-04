import { STEPS, PRESENTIEL_STEPS, FORMULE_OPTIONS } from './formSteps';

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

function Step1Online({ form, updateField }) {
  return (
    <div className="form-grid">
      <Field label="Prenom" field="prenom" form={form} updateField={updateField} />
      <Field label="Langue" field="langue" form={form} updateField={updateField} type="select" options={[
        { value: 'FR', label: 'Francais' },
        { value: 'EN', label: 'English' },
      ]} />
      <Field label="Formule" field="formule" form={form} updateField={updateField} type="select" options={FORMULE_OPTIONS} />
      <Field label="Age" field="age" form={form} updateField={updateField} type="number" />
      <Field label="Genre" field="genre" form={form} updateField={updateField} type="select" options={[
        { value: '', label: 'Selectionner...' },
        { value: 'Homme', label: 'Homme' },
        { value: 'Femme', label: 'Femme' },
        { value: 'Autre', label: 'Autre' },
      ]} />
      <Field label="Poids (kg)" field="poids" form={form} updateField={updateField} type="number" />
      <Field label="Taille (cm)" field="taille" form={form} updateField={updateField} type="number" />
    </div>
  );
}

function Step1Presentiel({ form, updateField }) {
  return (
    <div className="form-grid">
      <Field label="Prenom" field="prenom" form={form} updateField={updateField} />
      <Field label="Langue" field="langue" form={form} updateField={updateField} type="select" options={[
        { value: 'FR', label: 'Francais' },
        { value: 'EN', label: 'English' },
      ]} />
      <Field label="Pack" field="pack" form={form} updateField={updateField} type="select" options={[
        { value: 'pack10', label: 'Pack 10 seances - 750 CHF' },
        { value: 'pack20', label: 'Pack 20 seances - 1400 CHF' },
        { value: 'pack30', label: 'Pack 30 seances - 1950 CHF' },
      ]} />
      <Field label="Age" field="age" form={form} updateField={updateField} type="number" />
      <Field label="Genre" field="genre" form={form} updateField={updateField} type="select" options={[
        { value: '', label: 'Selectionner...' },
        { value: 'Homme', label: 'Homme' },
        { value: 'Femme', label: 'Femme' },
        { value: 'Autre', label: 'Autre' },
      ]} />
      <Field label="Poids (kg)" field="poids" form={form} updateField={updateField} type="number" />
      <Field label="Taille (cm)" field="taille" form={form} updateField={updateField} type="number" />
    </div>
  );
}

function Step2({ form, updateField }) {
  return (
    <div className="form-grid">
      <Field label="Objectif principal" field="objectifPrincipal" form={form} updateField={updateField} fullWidth type="textarea" />
      <Field label="Objectif secondaire" field="objectifSecondaire" form={form} updateField={updateField} fullWidth type="textarea" />
      <Field label="Deadline / Echeance" field="deadline" form={form} updateField={updateField} />
      <div className="field" />
      <Field label="Motivation profonde (le vrai pourquoi)" field="motivationProfonde" form={form} updateField={updateField} fullWidth type="textarea" rows={4} />
    </div>
  );
}

function Step3({ form, updateField }) {
  return (
    <div className="form-grid">
      <Field label="Niveau sportif" field="niveau" form={form} updateField={updateField} type="select" options={[
        { value: '', label: 'Selectionner...' },
        { value: 'Debutant', label: 'Debutant' },
        { value: 'Intermediaire', label: 'Intermediaire' },
        { value: 'Avance', label: 'Avance' },
        { value: 'Athlete', label: 'Athlete' },
      ]} />
      <Field label="Frequence souhaitee (seances/sem)" field="frequence" form={form} updateField={updateField} />
      <Field label="Duree par seance" field="duree" form={form} updateField={updateField} type="select" options={[
        { value: '', label: 'Selectionner...' },
        { value: '30 min', label: '30 min' },
        { value: '45 min', label: '45 min' },
        { value: '60 min', label: '60 min' },
        { value: '75 min', label: '75 min' },
        { value: '90 min', label: '90 min' },
      ]} />
      <Field label="Lieu d'entrainement" field="lieu" form={form} updateField={updateField} type="select" options={[
        { value: '', label: 'Selectionner...' },
        { value: 'Salle de sport', label: 'Salle de sport' },
        { value: 'Domicile', label: 'Domicile' },
        { value: 'Exterieur', label: 'Exterieur' },
        { value: 'Mixte', label: 'Mixte' },
      ]} />
      <Field label="Equipement disponible" field="equipement" form={form} updateField={updateField} fullWidth type="textarea" />
      <Field label="Historique sportif" field="historique" form={form} updateField={updateField} fullWidth type="textarea" />
      <Field label="Exercices aimes" field="exercicesAimes" form={form} updateField={updateField} fullWidth type="textarea" />
      <Field label="Exercices evites / detestes" field="exercicesEvites" form={form} updateField={updateField} fullWidth type="textarea" />
    </div>
  );
}

function Step4({ form, updateField }) {
  return (
    <div className="form-grid">
      <Field label="Blessures / Limitations physiques" field="blessures" form={form} updateField={updateField} fullWidth type="textarea" rows={4} />
      <Field label="Problemes de sante" field="problemesSante" form={form} updateField={updateField} fullWidth type="textarea" rows={4} />
      <Field label="Medicaments / Supplements" field="medicaments" form={form} updateField={updateField} fullWidth type="textarea" />
    </div>
  );
}

function Step5({ form, updateField }) {
  return (
    <div className="form-grid">
      <Field label="Objectif nutritionnel" field="objectifNutrition" form={form} updateField={updateField} type="select" options={[
        { value: '', label: 'Selectionner...' },
        { value: 'Perte de poids', label: 'Perte de poids' },
        { value: 'Prise de masse', label: 'Prise de masse' },
        { value: 'Recomposition', label: 'Recomposition corporelle' },
        { value: 'Maintien', label: 'Maintien' },
        { value: 'Performance', label: 'Performance sportive' },
        { value: 'Sante generale', label: 'Sante generale' },
      ]} />
      <Field label="Niveau en cuisine" field="niveauCuisine" form={form} updateField={updateField} type="select" options={[
        { value: '', label: 'Selectionner...' },
        { value: 'Debutant', label: 'Debutant' },
        { value: 'Basique', label: 'Basique' },
        { value: 'Intermediaire', label: 'Intermediaire' },
        { value: 'Bon cuisinier', label: 'Bon cuisinier' },
      ]} />
      <Field label="Allergies / Intolerances" field="allergies" form={form} updateField={updateField} fullWidth />
      <Field label="Preferences alimentaires (vegan, halal, etc.)" field="preferencesAlimentaires" form={form} updateField={updateField} fullWidth />
      <Field label="Frequence restaurant / takeaway" field="frequenceRestaurant" form={form} updateField={updateField} type="select" options={[
        { value: '', label: 'Selectionner...' },
        { value: 'Rarement', label: 'Rarement' },
        { value: '1-2x/semaine', label: '1-2x par semaine' },
        { value: '3-4x/semaine', label: '3-4x par semaine' },
        { value: 'Quasi quotidien', label: 'Quasi quotidien' },
      ]} />
    </div>
  );
}

function Step6({ form, updateField }) {
  return (
    <div className="form-grid">
      <Field label="Sommeil (heures/nuit, qualite)" field="sommeil" form={form} updateField={updateField} />
      <Field label="Niveau de stress (1-10)" field="stress" form={form} updateField={updateField} type="select" options={[
        { value: '', label: 'Selectionner...' },
        ...Array.from({ length: 10 }, (_, i) => ({ value: String(i + 1), label: `${i + 1}/10` })),
      ]} />
      <Field label="Type de travail" field="travail" form={form} updateField={updateField} type="select" options={[
        { value: '', label: 'Selectionner...' },
        { value: 'Sedentaire (bureau)', label: 'Sedentaire (bureau)' },
        { value: 'Mixte', label: 'Mixte' },
        { value: 'Actif / debout', label: 'Actif / debout' },
        { value: 'Physique / manuel', label: 'Physique / manuel' },
      ]} />
      <Field label="Consommation d'alcool" field="alcool" form={form} updateField={updateField} type="select" options={[
        { value: '', label: 'Selectionner...' },
        { value: 'Jamais', label: 'Jamais' },
        { value: 'Occasionnel', label: 'Occasionnel (1-2x/mois)' },
        { value: 'Regulier', label: 'Regulier (1-2x/sem)' },
        { value: 'Frequent', label: 'Frequent (3x+/sem)' },
      ]} />
      <Field label="Hydratation quotidienne" field="hydratation" form={form} updateField={updateField} type="select" options={[
        { value: '', label: 'Selectionner...' },
        { value: 'Moins de 1L', label: 'Moins de 1L' },
        { value: '1-1.5L', label: '1 - 1.5L' },
        { value: '1.5-2L', label: '1.5 - 2L' },
        { value: '2-3L', label: '2 - 3L' },
        { value: 'Plus de 3L', label: 'Plus de 3L' },
      ]} />
    </div>
  );
}

function Step7Online({ form, updateField }) {
  return (
    <div className="form-grid">
      <Field label="Deja eu un coach sportif ?" field="dejaCoach" form={form} updateField={updateField} type="select" options={[
        { value: '', label: 'Selectionner...' },
        { value: 'Non, jamais', label: 'Non, jamais' },
        { value: 'Oui, en salle', label: 'Oui, en salle' },
        { value: 'Oui, en ligne', label: 'Oui, en ligne' },
        { value: 'Oui, les deux', label: 'Oui, les deux' },
      ]} />
      <Field label="Apps fitness utilisees" field="appsFitness" form={form} updateField={updateField} />
      <Field label="Ce qui n'a pas marche avant" field="pasMarche" form={form} updateField={updateField} fullWidth type="textarea" rows={4} />
      <Field label="Attentes envers Benfitcoach" field="attentes" form={form} updateField={updateField} fullWidth type="textarea" rows={4} />
    </div>
  );
}

function Step8({ form, updateField }) {
  return (
    <div className="form-grid">
      <Field
        label="Notes personnelles du coach Benoit"
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

// Online: 8 steps (unchanged)
const ONLINE_STEP_COMPONENTS = {
  1: Step1Online, 2: Step2, 3: Step3, 4: Step4,
  5: Step5, 6: Step6, 7: Step7Online, 8: Step8,
};

// Presentiel: 7 steps (no "Contexte coaching" step with app/scanner questions)
const PRESENTIEL_STEP_COMPONENTS = {
  1: Step1Presentiel, 2: Step2, 3: Step3, 4: Step4,
  5: Step5, 6: Step6, 7: Step8,
};

export default function StepForm({ step, form, updateField, categorie = 'online' }) {
  const isPresentiel = categorie === 'presentiel';
  const stepComponents = isPresentiel ? PRESENTIEL_STEP_COMPONENTS : ONLINE_STEP_COMPONENTS;
  const steps = isPresentiel ? PRESENTIEL_STEPS : STEPS;
  const StepComponent = stepComponents[step];
  const stepInfo = steps.find(s => s.id === step);

  return (
    <div className="form-section" key={step}>
      <h2>{stepInfo.title}</h2>
      <StepComponent form={form} updateField={updateField} />
    </div>
  );
}
