const EVOLUTION_OPTIONS = ['Nettement ameliore', 'Legerement ameliore', 'Identique', 'Degrade'];
const GLOBAL_OPTIONS = ['Beaucoup mieux', 'Mieux', 'Pareil', 'Moins bien'];
const ADHERENCE_OPTIONS = ['Oui totalement', 'En grande partie', 'Partiellement', 'Pas vraiment'];
const SUPPLEMENTS_OPTIONS = ['Oui tous', 'Certains', 'Non'];
const OUI_NON = ['Oui', 'Non'];

function RadioGroup({ label, options, value, onChange }) {
  return (
    <div className="followup-field">
      <label className="followup-label">{label}</label>
      <div className="followup-radios">
        {options.map(opt => (
          <label key={opt} className={`radio-label ${value === opt ? 'checked' : ''}`}>
            <input type="radio" name={label} checked={value === opt} onChange={() => onChange(opt)} />
            <span>{opt}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function getEvolutionColor(value) {
  if (!value) return '';
  if (value === 'Nettement ameliore' || value === 'Legerement ameliore' || value === 'Beaucoup mieux' || value === 'Mieux') return 'improved';
  if (value === 'Identique' || value === 'Pareil') return 'same';
  return 'degraded';
}

function getEvolutionArrow(value) {
  const color = getEvolutionColor(value);
  if (color === 'improved') return '↑';
  if (color === 'same') return '→';
  if (color === 'degraded') return '↓';
  return '';
}

function getMeasureEvolution(prev, current, unit, lowerIsBetter = true) {
  if (!prev || !current) return { text: '-', color: '', arrow: '' };
  const diff = Number(current) - Number(prev);
  if (isNaN(diff)) return { text: '-', color: '', arrow: '' };
  const sign = diff > 0 ? '+' : '';
  const improved = lowerIsBetter ? diff < 0 : diff > 0;
  return {
    text: `${sign}${diff.toFixed(1)} ${unit}`,
    color: diff === 0 ? 'same' : improved ? 'improved' : 'degraded',
    arrow: diff === 0 ? '→' : improved ? '↑' : '↓',
  };
}

function extractPreviousData(prevConsultation, clientForm) {
  const form = clientForm || {};
  const prevFollowup = prevConsultation?.followupData || {};

  return {
    poids: prevFollowup.poids_actuel || form.poids || null,
    tourTaille: prevFollowup.tour_taille || form.tourTaille || null,
    tourHanche: prevFollowup.tour_hanche || form.tourHanche || null,
    tourBras: prevFollowup.tour_bras || form.tourBras || null,
    tourCuisse: prevFollowup.tour_cuisse || form.tourCuisse || null,
    masseGrasse: prevFollowup.masse_grasse || form.masseGrasse || null,
    energie: prevFollowup.energie
      || form.energieJournee
      || (Array.isArray(form.reactionGlucides) ? form.reactionGlucides.join(', ') : form.reactionGlucides)
      || 'Non renseigne',
    sommeil: prevFollowup.sommeil
      || (form.difficultesEndormissement
        ? `Endormissement: ${form.difficultesEndormissement}, Reveils: ${form.reveilsNocturnes || '-'}`
        : form.etatReveil || 'Non renseigne'),
    stress: prevFollowup.stress
      || (form.niveauStressActuel ? `${form.niveauStressActuel}/10` : 'Non renseigne'),
    digestion: prevFollowup.digestion
      || form.frequenceBallonnements
      || form.transitType
      || 'Non renseigne',
    douleurs: prevFollowup.douleurs
      || form.douleursInflammations
      || form.douleursActuelles
      || 'Non renseigne',
  };
}

export default function FollowUpStep({ followupData, onChange, previousConsultation, clientForm }) {
  const prevData = extractPreviousData(previousConsultation, clientForm);

  const update = (field, value) => {
    onChange({ ...followupData, [field]: value });
  };

  // Build comparison rows
  const measureRows = [
    { critere: 'Poids', prev: prevData.poids, curr: followupData.poids_actuel, unit: 'kg', format: v => v ? `${v} kg` : '-' },
    { critere: 'Tour de taille', prev: prevData.tourTaille, curr: followupData.tour_taille, unit: 'cm', format: v => v ? `${v} cm` : '-' },
    { critere: 'Tour de hanche', prev: prevData.tourHanche, curr: followupData.tour_hanche, unit: 'cm', format: v => v ? `${v} cm` : '-' },
    { critere: 'Tour de bras', prev: prevData.tourBras, curr: followupData.tour_bras, unit: 'cm', format: v => v ? `${v} cm` : '-' },
    { critere: 'Tour de cuisse', prev: prevData.tourCuisse, curr: followupData.tour_cuisse, unit: 'cm', format: v => v ? `${v} cm` : '-' },
    { critere: 'Masse grasse', prev: prevData.masseGrasse, curr: followupData.masse_grasse, unit: '%', format: v => v ? `${v} %` : '-' },
  ].filter(r => r.prev || r.curr).map(r => {
    const evol = getMeasureEvolution(r.prev, r.curr, r.unit);
    return { critere: r.critere, previous: r.format(r.prev), current: r.format(r.curr), ...evol };
  });

  const qualitativeRows = [
    { critere: 'Energie', previous: prevData.energie, value: followupData.energie },
    { critere: 'Sommeil', previous: prevData.sommeil, value: followupData.sommeil },
    { critere: 'Stress', previous: prevData.stress, value: followupData.stress },
    { critere: 'Digestion', previous: prevData.digestion, value: followupData.digestion },
    { critere: 'Douleurs', previous: prevData.douleurs, value: followupData.douleurs },
  ].map(r => ({
    critere: r.critere,
    previous: r.previous,
    current: r.value || '-',
    text: r.value || '-',
    color: getEvolutionColor(r.value),
    arrow: getEvolutionArrow(r.value),
  }));

  const comparisonRows = [...measureRows, ...qualitativeRows];

  return (
    <div className="nutrition-form-section followup-step">
      <h3>Suivi & Progression</h3>

      {/* Section A */}
      <div className="followup-section">
        <h4 className="followup-section-title">Evolution depuis la derniere consultation</h4>
        <RadioGroup label="Comment vous sentez-vous globalement ?" options={GLOBAL_OPTIONS} value={followupData.etat_global} onChange={v => update('etat_global', v)} />
        <RadioGroup label="Niveau d'energie ?" options={EVOLUTION_OPTIONS} value={followupData.energie} onChange={v => update('energie', v)} />
        <RadioGroup label="Qualite du sommeil ?" options={EVOLUTION_OPTIONS} value={followupData.sommeil} onChange={v => update('sommeil', v)} />
        <RadioGroup label="Digestion ?" options={EVOLUTION_OPTIONS} value={followupData.digestion} onChange={v => update('digestion', v)} />
        <RadioGroup label="Stress ?" options={EVOLUTION_OPTIONS} value={followupData.stress} onChange={v => update('stress', v)} />
        <RadioGroup label="Douleurs ?" options={EVOLUTION_OPTIONS} value={followupData.douleurs} onChange={v => update('douleurs', v)} />
      </div>

      {/* Section B */}
      <div className="followup-section">
        <h4 className="followup-section-title">Adherence au plan precedent</h4>
        <RadioGroup label="Avez-vous suivi le plan nutrition ?" options={ADHERENCE_OPTIONS} value={followupData.adherence_plan} onChange={v => update('adherence_plan', v)} />
        <div className="followup-field">
          <label className="followup-label">Quels changements avez-vous adoptes avec succes ?</label>
          <textarea value={followupData.changements_succes || ''} onChange={e => update('changements_succes', e.target.value)} placeholder="Decrivez les changements positifs adoptes..." rows={3} />
        </div>
        <div className="followup-field">
          <label className="followup-label">Qu'est-ce qui a ete difficile a suivre ?</label>
          <textarea value={followupData.difficultes || ''} onChange={e => update('difficultes', e.target.value)} placeholder="Decrivez les difficultes rencontrees..." rows={3} />
        </div>
        <RadioGroup label="Avez-vous pris les supplements recommandes ?" options={SUPPLEMENTS_OPTIONS} value={followupData.supplements_pris} onChange={v => update('supplements_pris', v)} />
        {(followupData.supplements_pris === 'Certains' || followupData.supplements_pris === 'Non') && (
          <div className="followup-field">
            <label className="followup-label">Si non, pourquoi ?</label>
            <textarea value={followupData.supplements_raison || ''} onChange={e => update('supplements_raison', e.target.value)} placeholder="Raison de non prise des supplements..." rows={2} />
          </div>
        )}
      </div>

      {/* Section C */}
      <div className="followup-section">
        <h4 className="followup-section-title">Nouvelles mesures</h4>
        <div className="followup-measures-grid">
          <div className="followup-field">
            <label className="followup-label">Poids actuel (kg)</label>
            <input type="number" step="0.1" value={followupData.poids_actuel || ''} onChange={e => update('poids_actuel', e.target.value)} placeholder="Ex: 75.5" />
          </div>
          <div className="followup-field">
            <label className="followup-label">Tour de taille actuel (cm)</label>
            <input type="number" step="0.1" value={followupData.tour_taille || ''} onChange={e => update('tour_taille', e.target.value)} placeholder="Ex: 82" />
          </div>
          <div className="followup-field">
            <label className="followup-label">Tour de hanche actuel (cm)</label>
            <input type="number" step="0.1" value={followupData.tour_hanche || ''} onChange={e => update('tour_hanche', e.target.value)} placeholder="Ex: 95" />
          </div>
          <div className="followup-field">
            <label className="followup-label">Tour de bras actuel (cm)</label>
            <input type="number" step="0.1" value={followupData.tour_bras || ''} onChange={e => update('tour_bras', e.target.value)} placeholder="Ex: 32" />
          </div>
          <div className="followup-field">
            <label className="followup-label">Tour de cuisse actuel (cm)</label>
            <input type="number" step="0.1" value={followupData.tour_cuisse || ''} onChange={e => update('tour_cuisse', e.target.value)} placeholder="Ex: 55" />
          </div>
          <div className="followup-field">
            <label className="followup-label">Masse grasse actuelle (%)</label>
            <input type="number" step="0.1" value={followupData.masse_grasse || ''} onChange={e => update('masse_grasse', e.target.value)} placeholder="Ex: 22" />
          </div>
        </div>
        <RadioGroup label="Nouveaux resultats de bilan sanguin ?" options={OUI_NON} value={followupData.nouveau_bilan} onChange={v => update('nouveau_bilan', v)} />
        <RadioGroup label="Nouveaux tests ADN ou analyses ?" options={OUI_NON} value={followupData.nouveau_adn} onChange={v => update('nouveau_adn', v)} />
      </div>

      {/* Section D */}
      <div className="followup-section">
        <h4 className="followup-section-title">Notes de suivi Anissa</h4>
        <div className="followup-field">
          <label className="followup-label">Observations sur la progression</label>
          <textarea value={followupData.observations_progression || ''} onChange={e => update('observations_progression', e.target.value)} placeholder="Ce que vous observez sur la progression du client..." rows={4} />
        </div>
        <div className="followup-field">
          <label className="followup-label">Points a ameliorer</label>
          <textarea value={followupData.points_ameliorer || ''} onChange={e => update('points_ameliorer', e.target.value)} placeholder="Points d'attention, ajustements necessaires..." rows={3} />
        </div>
        <div className="followup-field">
          <label className="followup-label">Objectifs pour les prochains mois</label>
          <textarea value={followupData.objectifs_prochains || ''} onChange={e => update('objectifs_prochains', e.target.value)} placeholder="Objectifs a atteindre pour la prochaine consultation..." rows={3} />
        </div>
      </div>

      {/* Comparison Table */}
      <div className="followup-section">
        <h4 className="followup-section-title">Tableau comparatif</h4>
        <div className="comparison-table-wrapper">
          <table className="comparison-table">
            <thead>
              <tr>
                <th>Critere</th>
                <th>Derniere consultation</th>
                <th>Aujourd'hui</th>
                <th>Evolution</th>
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map(row => (
                <tr key={row.critere}>
                  <td className="comparison-critere">{row.critere}</td>
                  <td className="comparison-prev">{row.previous}</td>
                  <td className="comparison-current">{row.current}</td>
                  <td className={`comparison-evolution evolution-${row.color}`}>
                    {row.arrow && <span className="evolution-arrow">{row.arrow}</span>}
                    {row.text}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Export helper for building comparison data for AI prompt
export function buildFollowupSummary(followupData, previousConsultation, clientForm) {
  const prevData = extractPreviousData(previousConsultation, clientForm);
  const lines = [
    `--- SUIVI & PROGRESSION ---`,
    `Etat global : ${followupData.etat_global || 'Non renseigne'}`,
    `Energie : ${followupData.energie || 'Non renseigne'} (precedent: ${prevData.energie})`,
    `Sommeil : ${followupData.sommeil || 'Non renseigne'} (precedent: ${prevData.sommeil})`,
    `Digestion : ${followupData.digestion || 'Non renseigne'} (precedent: ${prevData.digestion})`,
    `Stress : ${followupData.stress || 'Non renseigne'} (precedent: ${prevData.stress})`,
    `Douleurs : ${followupData.douleurs || 'Non renseigne'} (precedent: ${prevData.douleurs})`,
    ``,
    `--- ADHERENCE AU PLAN PRECEDENT ---`,
    `Suivi du plan : ${followupData.adherence_plan || 'Non renseigne'}`,
    `Changements adoptes : ${followupData.changements_succes || 'Non renseigne'}`,
    `Difficultes : ${followupData.difficultes || 'Non renseigne'}`,
    `Supplements pris : ${followupData.supplements_pris || 'Non renseigne'}`,
    followupData.supplements_raison ? `Raison non prise supplements : ${followupData.supplements_raison}` : '',
    ``,
    `--- MESURES OBJECTIVES ---`,
    `Poids actuel : ${followupData.poids_actuel ? followupData.poids_actuel + ' kg' : 'Non renseigne'} (precedent: ${prevData.poids ? prevData.poids + ' kg' : '-'})`,
    followupData.tour_taille ? `Tour de taille : ${followupData.tour_taille} cm (precedent: ${prevData.tourTaille || '-'} cm)` : '',
    followupData.tour_hanche ? `Tour de hanche : ${followupData.tour_hanche} cm (precedent: ${prevData.tourHanche || '-'} cm)` : '',
    followupData.tour_bras ? `Tour de bras : ${followupData.tour_bras} cm (precedent: ${prevData.tourBras || '-'} cm)` : '',
    followupData.tour_cuisse ? `Tour de cuisse : ${followupData.tour_cuisse} cm (precedent: ${prevData.tourCuisse || '-'} cm)` : '',
    followupData.masse_grasse ? `Masse grasse : ${followupData.masse_grasse} % (precedent: ${prevData.masseGrasse || '-'} %)` : '',
    `Nouveau bilan sanguin : ${followupData.nouveau_bilan || 'Non'}`,
    `Nouveau test ADN : ${followupData.nouveau_adn || 'Non'}`,
    ``,
    `--- OBSERVATIONS DE SUIVI ANISSA ---`,
    `Observations progression : ${followupData.observations_progression || 'Non renseigne'}`,
    `Points a ameliorer : ${followupData.points_ameliorer || 'Non renseigne'}`,
    `Objectifs prochains : ${followupData.objectifs_prochains || 'Non renseigne'}`,
  ];
  return lines.filter(l => l !== '').join('\n');
}

// Export for PDF use
export { extractPreviousData, getMeasureEvolution, getEvolutionColor, getEvolutionArrow };
