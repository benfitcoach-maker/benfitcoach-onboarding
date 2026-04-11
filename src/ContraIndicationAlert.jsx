/* eslint-disable react-refresh/only-export-components */
// Modal d'alerte contre-indications. Analyse le profil client pour reperer
// des situations a risque avant de generer un plan nutrition / supplements.
// - severite 'danger'  : bloquant — recommander avis medical
// - severite 'warning' : informatif — adaptation du plan requise

const RULES = [
  {
    id: 'anticoagulants',
    severity: 'danger',
    label: 'Anticoagulants',
    description:
      "Proscrire Curcuma haute dose, Omega-3 >2g, GLA, Resveratrol, Ginkgo. Tout supplement a effet hemorragique doit etre valide par le medecin traitant.",
    keywords: [
      'anticoagulant', 'anticoagulants', 'warfarine', 'sintrom', 'coumadine',
      'xarelto', 'eliquis', 'pradaxa', 'fluindione', 'previscan', 'heparine',
      'acenocoumarol', 'rivaroxaban', 'apixaban', 'dabigatran',
    ],
    fields: ['traitements', 'medicaments', 'pathologies'],
  },
  {
    id: 'thyroid',
    severity: 'danger',
    label: 'Trouble thyroidien / Hashimoto',
    description:
      "Proscrire Ashwagandha (Hashimoto, hyperthyroidie). Prudence avec iode/selenium. Levothyroxine : espacer de 4h toute prise de calcium, fer, cafe, soja.",
    keywords: [
      'thyroide', 'thyroidien', 'thyroidite', 'hashimoto', 'basedow',
      'hypothyroidie', 'hyperthyroidie', 'levothyrox', 'levothyroxine',
      'euthyrox', 'eutirox', 'synthroid', 'tiroide',
    ],
    fields: ['pathologies', 'traitements', 'medicaments', 'antecedentsFamiliaux'],
  },
  {
    id: 'pregnancy',
    severity: 'danger',
    label: 'Grossesse ou projet de grossesse',
    description:
      "Proscrire Ashwagandha, Rhodiola haute dose, vitamine A retinol >3000UI, huiles essentielles. Adapter folates (methylfolate), iode, omega-3 DHA. Avis gyneco requis.",
    keywords: [
      'enceinte', 'grossesse', 'gestation', 'trimestre', 'accouchement',
      'allaitement', 'allaitante', 'post-partum', 'postpartum',
    ],
    fields: ['pathologies', 'projetGrossesse', 'cycleDuree', 'contraception', 'observations'],
    extraCheck: (form) => {
      const pg = (form.projetGrossesse || '').toString().toLowerCase();
      return pg.includes('oui') || pg.includes('en cours') || pg.includes('actuel');
    },
  },
  {
    id: 'autoimmune',
    severity: 'danger',
    label: 'Maladie auto-immune',
    description:
      "Proscrire les immunostimulants (Echinacea, AHCC, Beta-glucanes haute dose). Prudence avec adaptogenes. Coordination avec le medecin traitant obligatoire.",
    keywords: [
      'auto-immune', 'auto immune', 'autoimmune', 'lupus', 'sclerose',
      'polyarthrite', 'crohn', 'rectocolite', 'psoriasis', 'vitiligo',
      'sjogren', 'gougerot', 'myasthenie', 'spondylarthrite', 'rch',
    ],
    fields: ['pathologies', 'antecedentsFamiliaux', 'problemesSante'],
  },
  {
    id: 'kidney',
    severity: 'danger',
    label: 'Insuffisance renale',
    description:
      "Limiter les proteines (<0.8g/kg), potassium, phosphore, magnesium. Proscrire creatine, fortes doses de vitamine C. Necessite un suivi nephrologique.",
    keywords: [
      'insuffisance renale', 'renale', 'rein', 'reins', 'neph', 'dialyse',
      'creatinine elevee', 'ckd', 'irc', 'irenale',
    ],
    fields: ['pathologies', 'problemesSante', 'antecedentsFamiliaux'],
  },
  {
    id: 'diabetes',
    severity: 'warning',
    label: 'Diabete',
    description:
      "Adapter les glucides (IG bas, fibres), surveiller la glycemie. Chrome, berberine, cannelle : verifier les interactions avec antidiabetiques (risque d'hypoglycemie).",
    keywords: [
      'diabete', 'diabetique', 'insulino', 'insuline', 'metformine',
      'glucophage', 'glycemie', 'dt1', 'dt2', 'type 1', 'type 2',
      'januvia', 'diamicron', 'ozempic', 'trulicity',
    ],
    fields: ['pathologies', 'traitements', 'medicaments', 'problemesSante', 'antecedentsFamiliaux'],
  },
  {
    id: 'antidepressants',
    severity: 'warning',
    label: 'Antidepresseurs',
    description:
      "Proscrire Millepertuis (interaction majeure). Prudence avec 5-HTP, SAMe, L-tryptophane, Rhodiola (syndrome serotoninergique). Eviter la L-Theanine haute dose.",
    keywords: [
      'antidepresseur', 'antidepresseurs', 'antidep', 'prozac', 'fluoxetine',
      'sertraline', 'zoloft', 'paroxetine', 'deroxat', 'citalopram', 'seropram',
      'escitalopram', 'seroplex', 'venlafaxine', 'effexor', 'duloxetine',
      'cymbalta', 'mirtazapine', 'remeron', 'amitriptyline', 'laroxyl',
      'ssri', 'snri', 'imao', 'tricyclique',
    ],
    fields: ['traitements', 'medicaments', 'pathologies'],
  },
];

export function detectContraIndications(form) {
  if (!form) return [];
  const hits = [];

  for (const rule of RULES) {
    const haystack = rule.fields
      .map((f) => (form[f] || '').toString().toLowerCase())
      .join(' | ');

    const matched = rule.keywords.find((kw) => haystack.includes(kw));
    const extra = typeof rule.extraCheck === 'function' ? rule.extraCheck(form) : false;

    if (matched || extra) {
      hits.push({
        id: rule.id,
        severity: rule.severity,
        label: rule.label,
        description: rule.description,
        match: matched || (extra ? 'contexte detecte' : ''),
      });
    }
  }

  return hits;
}

export default function ContraIndicationAlert({ alerts, onConfirm, onCancel }) {
  if (!alerts || alerts.length === 0) return null;

  const hasDanger = alerts.some((a) => a.severity === 'danger');
  const dangers = alerts.filter((a) => a.severity === 'danger');
  const warnings = alerts.filter((a) => a.severity === 'warning');

  return (
    <div className="ci-backdrop" role="dialog" aria-modal="true">
      <div className={`ci-modal ${hasDanger ? 'ci-danger' : 'ci-warning'}`}>
        <div className="ci-header">
          <span className="ci-icon">{hasDanger ? '⚠️' : 'ℹ️'}</span>
          <h3>
            {hasDanger
              ? 'Contre-indications detectees'
              : 'Points de vigilance detectes'}
          </h3>
        </div>

        <p className="ci-intro">
          L'analyse du profil client a identifie {alerts.length} point{alerts.length > 1 ? 's' : ''} a
          prendre en compte avant de generer le plan. Verifie-les avec le client et adapte les recommandations
          en consequence.
        </p>

        {dangers.length > 0 && (
          <div className="ci-group">
            <div className="ci-group-title ci-group-danger">Danger — avis medical recommande</div>
            <ul className="ci-list">
              {dangers.map((a) => (
                <li key={a.id}>
                  <strong>{a.label}</strong>
                  {a.match ? <em className="ci-match"> (detecte : {a.match})</em> : null}
                  <div className="ci-desc">{a.description}</div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {warnings.length > 0 && (
          <div className="ci-group">
            <div className="ci-group-title ci-group-warning">Attention — adaptation requise</div>
            <ul className="ci-list">
              {warnings.map((a) => (
                <li key={a.id}>
                  <strong>{a.label}</strong>
                  {a.match ? <em className="ci-match"> (detecte : {a.match})</em> : null}
                  <div className="ci-desc">{a.description}</div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="ci-actions">
          <button className="btn btn-secondary" onClick={onCancel}>
            Annuler
          </button>
          <button
            className={`btn ${hasDanger ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
          >
            J'ai pris connaissance — Generer quand meme
          </button>
        </div>
      </div>
    </div>
  );
}
