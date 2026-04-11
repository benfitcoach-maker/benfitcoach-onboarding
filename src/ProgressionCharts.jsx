import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts';

const EVOLUTION_SCALE = {
  'Nettement ameliore': 4,
  'Legerement ameliore': 3,
  'Identique': 2,
  'Degrade': 1,
  'Beaucoup mieux': 4,
  'Mieux': 3,
  'Pareil': 2,
  'Moins bien': 1,
};

const ADHERENCE_SCALE = {
  'Oui totalement': 4,
  'En grande partie': 3,
  'Partiellement': 2,
  'Pas vraiment': 1,
};

function formatDate(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip-date">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
}

export default function ProgressionCharts({ consultations }) {
  const followups = consultations
    .filter(c => c.isFollowup && c.followupData)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  if (followups.length === 0) {
    return (
      <div className="progression-charts-empty">
        <p>Aucune consultation de suivi pour afficher la progression.</p>
        <p style={{ fontSize: '.75rem', color: '#6b5f48', marginTop: 8 }}>
          Les graphiques apparaitront apres la premiere consultation de suivi.
        </p>
      </div>
    );
  }

  // Weight data
  const weightData = followups
    .filter(c => c.followupData.poids_actuel)
    .map(c => ({ date: formatDate(c.date), Poids: Number(c.followupData.poids_actuel) }));

  // Tour de taille data
  const tailleData = followups
    .filter(c => c.followupData.tour_taille)
    .map(c => ({ date: formatDate(c.date), 'Tour taille': Number(c.followupData.tour_taille) }));

  // Masse grasse data
  const masseData = followups
    .filter(c => c.followupData.masse_grasse)
    .map(c => ({ date: formatDate(c.date), 'Masse grasse': Number(c.followupData.masse_grasse) }));

  // Evolution data
  const evolutionData = followups.map(c => {
    const fd = c.followupData;
    const energie = EVOLUTION_SCALE[fd.energie] || 0;
    const sommeil = EVOLUTION_SCALE[fd.sommeil] || 0;
    const stress = EVOLUTION_SCALE[fd.stress] || 0;
    const digestion = EVOLUTION_SCALE[fd.digestion] || 0;
    const adherence = ADHERENCE_SCALE[fd.adherence_plan] || 0;
    // Score global = moyenne des dimensions renseignees, normalisee 0-100
    const dims = [energie, sommeil, stress, digestion, adherence].filter(v => v > 0);
    const avg = dims.length > 0 ? dims.reduce((a, b) => a + b, 0) / dims.length : 0;
    const scoreGlobal = Math.round((avg / 4) * 100);
    const scoreOnScale = dims.length > 0 ? Number(avg.toFixed(2)) : 0;
    return {
      date: formatDate(c.date),
      Energie: energie,
      Sommeil: sommeil,
      Stress: stress,
      Digestion: digestion,
      Score: scoreOnScale, // meme echelle 1-4 pour superposition
      scoreGlobalPct: scoreGlobal,
    };
  });

  // Score global actuel (%) = dernier followup
  const latestFollowup = followups[followups.length - 1];
  const latestEvolution = evolutionData[evolutionData.length - 1];
  const scoreGlobalPct = latestEvolution?.scoreGlobalPct || 0;

  // Radar bien-etre : etat actuel (dernier followup) sur toutes les dimensions
  const radarData = latestFollowup
    ? [
        { metric: 'Energie', value: EVOLUTION_SCALE[latestFollowup.followupData.energie] || 0 },
        { metric: 'Sommeil', value: EVOLUTION_SCALE[latestFollowup.followupData.sommeil] || 0 },
        { metric: 'Stress', value: EVOLUTION_SCALE[latestFollowup.followupData.stress] || 0 },
        { metric: 'Digestion', value: EVOLUTION_SCALE[latestFollowup.followupData.digestion] || 0 },
        { metric: 'Adherence', value: ADHERENCE_SCALE[latestFollowup.followupData.adherence_plan] || 0 },
      ]
    : [];
  const hasRadar = radarData.some(r => r.value > 0);

  // Mensurations combinees (taille, hanche, bras, cuisse)
  const mensurationsData = followups
    .map(c => {
      const fd = c.followupData;
      const row = { date: formatDate(c.date) };
      if (fd.tour_taille) row['Tour taille'] = Number(fd.tour_taille);
      if (fd.tour_hanche) row['Tour hanche'] = Number(fd.tour_hanche);
      if (fd.tour_bras) row['Tour bras'] = Number(fd.tour_bras);
      if (fd.tour_cuisse) row['Tour cuisse'] = Number(fd.tour_cuisse);
      return row;
    })
    .filter(r => Object.keys(r).length > 1);

  // Adherence data
  const adherenceData = followups
    .filter(c => c.followupData.adherence_plan)
    .map(c => ({ date: formatDate(c.date), Adherence: ADHERENCE_SCALE[c.followupData.adherence_plan] || 0 }));

  const yTickFormatter = (val) => {
    const labels = { 1: 'Degrade', 2: 'Identique', 3: 'Leger+', 4: 'Net+' };
    return labels[val] || '';
  };

  const adherenceTickFormatter = (val) => {
    const labels = { 1: 'Pas vraiment', 2: 'Partiel', 3: 'Grande partie', 4: 'Total' };
    return labels[val] || '';
  };

  return (
    <div className="progression-charts">
      <h4 className="progression-charts-title">Courbe de progression</h4>

      {weightData.length > 0 && (
        <div className="chart-container">
          <h5 className="chart-subtitle">Evolution du poids (kg)</h5>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={weightData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a3a2a" />
              <XAxis dataKey="date" stroke="#6b5f48" fontSize={11} />
              <YAxis stroke="#6b5f48" fontSize={11} domain={['dataMin - 2', 'dataMax + 2']} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="Poids" stroke="#4ade80" strokeWidth={2} dot={{ r: 4, fill: '#4ade80' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {tailleData.length > 0 && (
        <div className="chart-container">
          <h5 className="chart-subtitle">Evolution du tour de taille (cm)</h5>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={tailleData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a3a2a" />
              <XAxis dataKey="date" stroke="#6b5f48" fontSize={11} />
              <YAxis stroke="#6b5f48" fontSize={11} domain={['dataMin - 2', 'dataMax + 2']} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="Tour taille" stroke="#60a5fa" strokeWidth={2} dot={{ r: 4, fill: '#60a5fa' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {masseData.length > 0 && (
        <div className="chart-container">
          <h5 className="chart-subtitle">Evolution de la masse grasse (%)</h5>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={masseData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a3a2a" />
              <XAxis dataKey="date" stroke="#6b5f48" fontSize={11} />
              <YAxis stroke="#6b5f48" fontSize={11} domain={['dataMin - 2', 'dataMax + 2']} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="Masse grasse" stroke="#fbbf24" strokeWidth={2} dot={{ r: 4, fill: '#fbbf24' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {mensurationsData.length > 0 && (
        <div className="chart-container">
          <h5 className="chart-subtitle">Mensurations (cm) — taille, hanche, bras, cuisse</h5>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={mensurationsData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a3a2a" />
              <XAxis dataKey="date" stroke="#6b5f48" fontSize={11} />
              <YAxis stroke="#6b5f48" fontSize={11} domain={['dataMin - 2', 'dataMax + 2']} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#f0f0e8' }} />
              <Line type="monotone" dataKey="Tour taille" stroke="#60a5fa" strokeWidth={2} dot={{ r: 3 }} connectNulls />
              <Line type="monotone" dataKey="Tour hanche" stroke="#c084fc" strokeWidth={2} dot={{ r: 3 }} connectNulls />
              <Line type="monotone" dataKey="Tour bras" stroke="#fbbf24" strokeWidth={2} dot={{ r: 3 }} connectNulls />
              <Line type="monotone" dataKey="Tour cuisse" stroke="#4ade80" strokeWidth={2} dot={{ r: 3 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {hasRadar && (
        <div className="chart-container">
          <h5 className="chart-subtitle">
            Bien-etre — etat actuel
            {scoreGlobalPct > 0 && (
              <span className="score-global-badge"> Score global : {scoreGlobalPct}%</span>
            )}
          </h5>
          <ResponsiveContainer width="100%" height={280}>
            <RadarChart data={radarData} outerRadius="75%">
              <PolarGrid stroke="#2a3a2a" />
              <PolarAngleAxis dataKey="metric" stroke="#6b5f48" fontSize={11} />
              <PolarRadiusAxis angle={90} domain={[0, 4]} tick={false} axisLine={false} />
              <Radar
                name="Etat actuel"
                dataKey="value"
                stroke="#4ade80"
                fill="#4ade80"
                fillOpacity={0.35}
              />
              <Tooltip content={<CustomTooltip />} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      )}

      {evolutionData.length > 0 && (
        <div className="chart-container">
          <h5 className="chart-subtitle">
            Evolution energie, sommeil, stress, digestion
            {scoreGlobalPct > 0 && (
              <span className="score-global-badge"> Score global actuel : {scoreGlobalPct}%</span>
            )}
          </h5>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={evolutionData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a3a2a" />
              <XAxis dataKey="date" stroke="#6b5f48" fontSize={11} />
              <YAxis stroke="#6b5f48" fontSize={11} domain={[0, 5]} ticks={[1, 2, 3, 4]} tickFormatter={yTickFormatter} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#f0f0e8' }} />
              <Line type="monotone" dataKey="Energie" stroke="#4ade80" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="Sommeil" stroke="#60a5fa" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="Stress" stroke="#fbbf24" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="Digestion" stroke="#c084fc" strokeWidth={2} dot={{ r: 3 }} />
              <Line
                type="monotone"
                dataKey="Score"
                name="Score global"
                stroke="#f87171"
                strokeWidth={3}
                strokeDasharray="5 3"
                dot={{ r: 4, fill: '#f87171' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {adherenceData.length > 0 && (
        <div className="chart-container">
          <h5 className="chart-subtitle">Adherence au plan nutrition</h5>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={adherenceData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a3a2a" />
              <XAxis dataKey="date" stroke="#6b5f48" fontSize={11} />
              <YAxis stroke="#6b5f48" fontSize={11} domain={[0, 5]} ticks={[1, 2, 3, 4]} tickFormatter={adherenceTickFormatter} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="Adherence" stroke="#2a9d5c" strokeWidth={2} dot={{ r: 4, fill: '#2a9d5c' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
