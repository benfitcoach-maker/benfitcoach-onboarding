import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, ReferenceLine, CartesianGrid } from 'recharts';
import { FORMULES } from './formSteps';
import { getClients, getBenoitClients, getAnissaOwnClients, getSharedClients, getNutritionConsultations } from './store';
import { supabase, isCloudEnabled } from './supabaseClient';

const COMBINED_MONTHLY_KEY = 'bfc_monthly_goal_combined';
const COMBINED_ANNUAL_KEY = 'bfc_annual_goal_combined';

function getMonthName(m, short) {
  const names = ['Janvier','Fevrier','Mars','Avril','Mai','Juin','Juillet','Aout','Septembre','Octobre','Novembre','Decembre'];
  const shortNames = ['Jan','Fev','Mar','Avr','Mai','Jun','Jul','Aou','Sep','Oct','Nov','Dec'];
  return short ? shortNames[m] : names[m];
}

function formatCHF(n) {
  return n.toLocaleString('fr-CH', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function getMonthKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function isRecurring(formule) {
  return ['autonome', 'suivi', 'intensif', 'custom'].includes(formule);
}

function getClientMonthlyRevenue(client) {
  const customRate = Number(client.form?.customRate);
  if (customRate > 0) return customRate;
  return FORMULES[client.formule]?.montant || 0;
}

function calcBenoitMonthRevenue(clients, manualRevenues, year, month) {
  const mk = `${year}-${String(month + 1).padStart(2, '0')}`;
  let total = 0;
  for (const c of clients) {
    if ((c.createdBy || 'benoit') === 'anissa') continue;
    const created = new Date(c.createdAt);
    const createdMk = getMonthKey(c.createdAt);
    if (isRecurring(c.formule)) {
      if (created.getFullYear() < year || (created.getFullYear() === year && created.getMonth() <= month)) {
        total += getClientMonthlyRevenue(c);
      }
    } else {
      if (createdMk === mk) total += getClientMonthlyRevenue(c);
    }
  }
  for (const r of manualRevenues) {
    if (r.type === 'recurring') {
      if (r.year < year || (r.year === year && r.month <= month)) total += r.amount;
    } else {
      if (r.year === year && r.month === month) total += r.amount;
    }
  }
  return total;
}

function calcAnissaMonthRevenue(ownClients, manualRevenues, year, month) {
  let total = 0;
  for (const c of ownClients) {
    const rate = Number(c.form?.customRate) || 0;
    if (rate <= 0) continue;
    const created = new Date(c.createdAt);
    if (created.getFullYear() < year || (created.getFullYear() === year && created.getMonth() <= month)) {
      total += rate;
    }
  }
  for (const r of manualRevenues) {
    if (r.type === 'recurring') {
      if (r.year < year || (r.year === year && r.month <= month)) total += r.amount;
    } else {
      if (r.year === year && r.month === month) total += r.amount;
    }
  }
  return total;
}

function syncGoalToCloud(key, value) {
  if (!isCloudEnabled || !supabase) return;
  supabase.from('app_config').upsert({ key, value: String(value) }).then(() => {});
}

export default function ABCoachingSection({ variant }) {
  const isAnissaView = variant === 'anissa';

  const [combinedMonthlyGoal, setCombinedMonthlyGoal] = useState(() => Number(localStorage.getItem(COMBINED_MONTHLY_KEY)) || 8000);
  const [combinedAnnualGoal, setCombinedAnnualGoal] = useState(() => Number(localStorage.getItem(COMBINED_ANNUAL_KEY)) || 96000);
  const [editingGoal, setEditingGoal] = useState(null);
  const [goalInput, setGoalInput] = useState('');

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const [chartYear, setChartYear] = useState(currentYear);

  const allClients = getClients();
  const benoitClients = getBenoitClients();
  const anissaClients = getAnissaOwnClients();
  const sharedClients = getSharedClients();

  // Load manual revenues for both
  const [benoitManual, setBenoitManual] = useState(() => {
    try { return JSON.parse(localStorage.getItem('bfc_manual_revenues') || '[]'); } catch { return []; }
  });
  const [anissaManual, setAnissaManual] = useState(() => {
    try { return JSON.parse(localStorage.getItem('bfc_manual_revenues_anissa') || '[]'); } catch { return []; }
  });

  // Pull combined goals from Supabase
  useEffect(() => {
    if (!isCloudEnabled || !supabase) return;
    supabase.from('app_config').select('*').in('key', ['monthly_goal_combined', 'yearly_goal_combined']).then(({ data }) => {
      if (!data) return;
      for (const row of data) {
        const val = Number(row.value);
        if (!val || val <= 0) continue;
        if (row.key === 'monthly_goal_combined') {
          setCombinedMonthlyGoal(val);
          localStorage.setItem(COMBINED_MONTHLY_KEY, val);
        } else if (row.key === 'yearly_goal_combined') {
          setCombinedAnnualGoal(val);
          localStorage.setItem(COMBINED_ANNUAL_KEY, val);
        }
      }
    });
  }, []);

  // Revenue calculations
  const benoitMonthRev = calcBenoitMonthRevenue(allClients, benoitManual, currentYear, currentMonth);
  const anissaMonthRev = calcAnissaMonthRevenue(anissaClients, anissaManual, currentYear, currentMonth);
  const combinedMonthRev = benoitMonthRev + anissaMonthRev;

  let benoitAnnualRev = 0;
  let anissaAnnualRev = 0;
  for (let m = 0; m <= currentMonth; m++) {
    benoitAnnualRev += calcBenoitMonthRevenue(allClients, benoitManual, currentYear, m);
    anissaAnnualRev += calcAnissaMonthRevenue(anissaClients, anissaManual, currentYear, m);
  }
  const combinedAnnualRev = benoitAnnualRev + anissaAnnualRev;

  // Combined chart data: 3 lines
  const lineData = [];
  for (let m = 0; m < 12; m++) {
    const b = calcBenoitMonthRevenue(allClients, benoitManual, chartYear, m);
    const a = calcAnissaMonthRevenue(anissaClients, anissaManual, chartYear, m);
    lineData.push({
      name: getMonthName(m, true),
      benoit: b,
      anissa: a,
      total: b + a,
    });
  }

  const yearOptions = [];
  for (let y = 2025; y <= currentYear + 1; y++) yearOptions.push(y);

  // Pie chart: Benoit vs Anissa
  const pieData = [
    benoitMonthRev > 0 && { name: 'Benoit', value: benoitMonthRev, fill: '#c4a050' },
    anissaMonthRev > 0 && { name: 'Anissa', value: anissaMonthRev, fill: '#2a9d5c' },
  ].filter(Boolean);

  // Stats
  const allNutritionConsultations = [];
  for (const c of allClients) {
    allNutritionConsultations.push(...getNutritionConsultations(c.id));
  }
  const nutritionThisMonth = allNutritionConsultations.filter(n => {
    const d = new Date(n.date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  }).length;
  const totalGenerations = allClients.reduce((s, c) => s + (c.history?.length || 0), 0);
  const allManualCount = benoitManual.length + anissaManual.length;

  const combinedPct = combinedMonthlyGoal > 0 ? (combinedMonthRev / combinedMonthlyGoal) * 100 : 0;
  const combinedMonthlyRemaining = combinedMonthlyGoal - combinedMonthRev;

  // Progress bar colors
  let monthColor = '#d45c4c';
  if (combinedPct >= 100) monthColor = isAnissaView ? '#33b068' : '#c4a050';
  else if (combinedPct >= 80) monthColor = '#2a9d5c';
  else if (combinedPct >= 50) monthColor = '#e8a040';

  const annualPct = combinedAnnualGoal > 0 ? (combinedAnnualRev / combinedAnnualGoal) * 100 : 0;
  const annualRemaining = combinedAnnualGoal - combinedAnnualRev;
  let annualColor = '#d45c4c';
  if (annualPct >= 100) annualColor = isAnissaView ? '#33b068' : '#c4a050';
  else if (annualPct >= 80) annualColor = '#2a9d5c';
  else if (annualPct >= 50) annualColor = '#e8a040';

  // Save goals
  const saveGoal = (type) => {
    const val = Number(goalInput);
    if (!val || val <= 0) return;
    if (type === 'monthly') {
      setCombinedMonthlyGoal(val);
      localStorage.setItem(COMBINED_MONTHLY_KEY, val);
      syncGoalToCloud('monthly_goal_combined', val);
    } else {
      setCombinedAnnualGoal(val);
      localStorage.setItem(COMBINED_ANNUAL_KEY, val);
      syncGoalToCloud('yearly_goal_combined', val);
    }
    setEditingGoal(null);
    setGoalInput('');
  };

  // Tooltip
  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const bg = isAnissaView ? '#1a2e1f' : '#1a1815';
    const borderColor = isAnissaView ? 'rgba(106,191,138,.3)' : 'rgba(196,160,80,.3)';
    return (
      <div style={{ background: bg, border: `1px solid ${borderColor}`, borderRadius: 8, padding: '10px 16px' }}>
        <div style={{ color: '#d4c9a8', fontSize: 13, marginBottom: 4 }}>{label} {chartYear}</div>
        {payload.map((p, i) => (
          <div key={i} style={{ color: p.color, fontWeight: 600, fontSize: 13 }}>
            {p.dataKey === 'benoit' ? 'Benoit' : p.dataKey === 'anissa' ? 'Anissa' : 'Total'} : {formatCHF(p.value)} CHF
          </div>
        ))}
      </div>
    );
  };

  const renderPieLabel = ({ name, percent, value }) => {
    return `${name} ${(percent * 100).toFixed(0)}% (${formatCHF(value)})`;
  };

  // Motivation
  let motivationMsg = '';
  if (combinedPct >= 100) motivationMsg = 'Objectif AB Coaching atteint ! Bravo l\'equipe.';
  else if (combinedPct >= 75) motivationMsg = 'Presque a l\'objectif ! Derniere ligne droite.';
  else if (combinedPct >= 50) motivationMsg = 'Plus de la moitie ! AB Coaching grandit.';
  else if (combinedPct >= 25) motivationMsg = 'L\'equipe avance bien. Continuez comme ca.';
  else motivationMsg = 'AB Coaching est en construction. Chaque client compte.';

  const sectionBg = isAnissaView ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.03)';
  const titleColor = '#999';

  return (
    <>
      {/* CA combined */}
      <div className="biz-section biz-section-ab" style={{ background: sectionBg, animationDelay: '.25s' }}>
        <div className="biz-section-title" style={{ color: titleColor }}>AB Coaching Sarl — Chiffres consolides</div>
        <div className="biz-goals-row">
          <div className="biz-goal-card">
            <div className="biz-goal-header">
              <span>CA combine ce mois</span>
              {editingGoal === 'monthly' ? (
                <div className="biz-goal-edit">
                  <input type="number" value={goalInput} onChange={e => setGoalInput(e.target.value)} placeholder="Montant" className="biz-goal-input" onKeyDown={e => e.key === 'Enter' && saveGoal('monthly')} />
                  <button className="btn btn-xs btn-primary" onClick={() => saveGoal('monthly')}>OK</button>
                  <button className="btn btn-xs btn-secondary" onClick={() => setEditingGoal(null)}>x</button>
                </div>
              ) : (
                <button className="biz-goal-btn" onClick={() => { setEditingGoal('monthly'); setGoalInput(String(combinedMonthlyGoal)); }}>Modifier objectif</button>
              )}
            </div>
            <div className="biz-progress-block" style={{ textAlign: 'center' }}>
              <div className="biz-progress-label">{getMonthName(currentMonth)} {currentYear}</div>
              <div className="biz-progress-amount" style={{ color: titleColor }}>{formatCHF(combinedMonthRev)} CHF</div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 16, fontSize: 12, marginBottom: 8 }}>
                <span style={{ color: '#c4a050' }}>Benoit : {formatCHF(benoitMonthRev)} CHF</span>
                <span style={{ color: '#2a9d5c' }}>Anissa : {formatCHF(anissaMonthRev)} CHF</span>
              </div>
              <div className="biz-progress-bar-track">
                <div className="biz-progress-bar-fill" style={{ width: `${Math.min(combinedPct, 100)}%`, background: monthColor }} />
              </div>
              <div className="biz-progress-sub" style={{ color: monthColor }}>
                {combinedMonthlyRemaining > 0
                  ? `${formatCHF(combinedMonthlyRemaining)} CHF restants`
                  : `Objectif depasse de ${formatCHF(Math.abs(combinedMonthlyRemaining))} CHF !`}
              </div>
              <div className="biz-progress-goal">Objectif : {formatCHF(combinedMonthlyGoal)} CHF</div>
            </div>
          </div>
          <div className="biz-goal-card">
            <div className="biz-goal-header">
              <span>CA annuel combine {currentYear}</span>
              {editingGoal === 'annual' ? (
                <div className="biz-goal-edit">
                  <input type="number" value={goalInput} onChange={e => setGoalInput(e.target.value)} placeholder="Montant" className="biz-goal-input" onKeyDown={e => e.key === 'Enter' && saveGoal('annual')} />
                  <button className="btn btn-xs btn-primary" onClick={() => saveGoal('annual')}>OK</button>
                  <button className="btn btn-xs btn-secondary" onClick={() => setEditingGoal(null)}>x</button>
                </div>
              ) : (
                <button className="biz-goal-btn" onClick={() => { setEditingGoal('annual'); setGoalInput(String(combinedAnnualGoal)); }}>Modifier objectif</button>
              )}
            </div>
            <div className="biz-progress-block" style={{ textAlign: 'center' }}>
              <div className="biz-progress-label">Annee {currentYear}</div>
              <div className="biz-progress-amount" style={{ color: titleColor }}>{formatCHF(combinedAnnualRev)} CHF</div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 16, fontSize: 12, marginBottom: 8 }}>
                <span style={{ color: '#c4a050' }}>Benoit : {formatCHF(benoitAnnualRev)} CHF</span>
                <span style={{ color: '#2a9d5c' }}>Anissa : {formatCHF(anissaAnnualRev)} CHF</span>
              </div>
              <div className="biz-progress-bar-track">
                <div className="biz-progress-bar-fill" style={{ width: `${Math.min(annualPct, 100)}%`, background: annualColor }} />
              </div>
              <div className="biz-progress-sub" style={{ color: annualColor }}>
                {annualRemaining > 0
                  ? `${formatCHF(annualRemaining)} CHF restants`
                  : `Objectif depasse de ${formatCHF(Math.abs(annualRemaining))} CHF !`}
              </div>
              <div className="biz-progress-goal">Objectif : {formatCHF(combinedAnnualGoal)} CHF</div>
            </div>
          </div>
        </div>
      </div>

      {/* Combined chart */}
      <div className="biz-section biz-section-ab" style={{ background: sectionBg, animationDelay: '.3s' }}>
        <div className="biz-chart-header">
          <div className="biz-section-title" style={{ marginBottom: 0, color: titleColor }}>Evolution CA — Benoit + Anissa</div>
          <div className="biz-year-selector">
            {yearOptions.map(y => (
              <button key={y} className={`biz-year-btn ${chartYear === y ? 'biz-year-btn-active' : ''}`} onClick={() => setChartYear(y)}>
                {y}
              </button>
            ))}
          </div>
        </div>
        <div className="biz-charts-row">
          <div className="biz-chart-card">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={lineData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="name" stroke="#6b5f48" tick={{ fill: '#6b5f48', fontSize: 12 }} />
                <YAxis stroke="#6b5f48" tick={{ fill: '#6b5f48', fontSize: 12 }} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={combinedMonthlyGoal} stroke="rgba(255,255,255,0.25)" strokeDasharray="6 4" label={{ value: 'Objectif', fill: 'rgba(255,255,255,0.25)', fontSize: 11, position: 'right' }} />
                <Line type="monotone" dataKey="benoit" stroke="#c4a050" strokeWidth={2} dot={{ fill: '#c4a050', r: 3 }} name="Benoit" animationDuration={1000} />
                <Line type="monotone" dataKey="anissa" stroke="#2a9d5c" strokeWidth={2} dot={{ fill: '#2a9d5c', r: 3 }} name="Anissa" animationDuration={1000} />
                <Line type="monotone" dataKey="total" stroke="rgba(255,255,255,0.8)" strokeWidth={2.5} dot={{ fill: '#fff', r: 3 }} name="Total" animationDuration={1200} />
              </LineChart>
            </ResponsiveContainer>
            <div className="biz-chart-legend">
              <span className="biz-legend-item"><span className="biz-legend-line" style={{ background: '#c4a050' }} />Benoit</span>
              <span className="biz-legend-item"><span className="biz-legend-line" style={{ background: '#2a9d5c' }} />Anissa</span>
              <span className="biz-legend-item"><span className="biz-legend-line" style={{ background: 'rgba(255,255,255,0.8)' }} />Total</span>
              <span className="biz-legend-item"><span className="biz-legend-line biz-legend-dashed" style={{ background: 'rgba(255,255,255,0.25)' }} />Objectif</span>
            </div>
          </div>
          <div className="biz-chart-card biz-pie-card">
            <div className="biz-chart-subtitle">Repartition Benoit / Anissa</div>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90}
                    label={renderPieLabel} animationDuration={800} labelLine={{ stroke: '#6b5f48' }}>
                    {pieData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Pie>
                  <Tooltip formatter={(v) => `${formatCHF(v)} CHF`} contentStyle={{ background: isAnissaView ? '#1a2e1f' : '#1a1815', border: `1px solid ${isAnissaView ? 'rgba(106,191,138,.3)' : 'rgba(196,160,80,.3)'}`, borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="biz-empty">Aucun revenu ce mois</div>
            )}
          </div>
        </div>
      </div>

      {/* Stats globales */}
      <div className="biz-section biz-section-ab" style={{ background: sectionBg, animationDelay: '.35s' }}>
        <div className="biz-section-title" style={{ color: titleColor }}>Statistiques globales AB Coaching</div>
        <div className="biz-stats-row-5">
          <div className="biz-stat-card">
            <div className="biz-stat-number">{allClients.length}</div>
            <div className="biz-stat-label">Total clients actifs</div>
          </div>
          <div className="biz-stat-card">
            <div className="biz-stat-number">{allNutritionConsultations.length}</div>
            <div className="biz-stat-label">Consultations nutrition</div>
          </div>
          <div className="biz-stat-card">
            <div className="biz-stat-number">{totalGenerations}</div>
            <div className="biz-stat-label">Generations IA</div>
          </div>
          <div className="biz-stat-card">
            <div className="biz-stat-number">{sharedClients.length}</div>
            <div className="biz-stat-label">Clients partages</div>
          </div>
          <div className="biz-stat-card">
            <div className="biz-stat-number">{allManualCount}</div>
            <div className="biz-stat-label">Revenus manuels</div>
          </div>
        </div>
      </div>

      {/* Motivation combinee */}
      <div className="biz-motivation" style={{ color: titleColor }}>{motivationMsg}</div>
    </>
  );
}
