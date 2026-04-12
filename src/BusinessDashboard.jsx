import { useState, useEffect, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, ReferenceLine, CartesianGrid, Legend } from 'recharts';
import { FORMULES } from './formSteps';
import { getBenoitClients, getAnissaOwnClients, getSharedClients, getClients, getNutritionConsultations } from './store';
import { supabase, isCloudEnabled } from './supabaseClient';
import ABCoachingSection from './ABCoachingSection';

const MONTHLY_GOAL_KEY = 'bfc_monthly_goal';
const ANNUAL_GOAL_KEY = 'bfc_annual_goal';
const MANUAL_REVENUES_KEY = 'bfc_manual_revenues';

function getMonthName(m, short) {
  const names = ['Janvier','Fevrier','Mars','Avril','Mai','Juin','Juillet','Aout','Septembre','Octobre','Novembre','Decembre'];
  const shortNames = ['Jan','Fev','Mar','Avr','Mai','Jun','Jul','Aou','Sep','Oct','Nov','Dec'];
  return short ? shortNames[m] : names[m];
}

function formatCHF(n) {
  return n.toLocaleString('fr-CH', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function getClientMonthlyRevenue(client) {
  const customRate = Number(client.form?.customRate);
  if (customRate > 0) return customRate;
  const f = client.formule;
  return FORMULES[f]?.montant || 0;
}

function isRecurring(formule) {
  return ['autonome', 'suivi', 'intensif', 'custom'].includes(formule);
}

function getMonthKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function calcMonthRevenue(clients, manualRevenues, year, month) {
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
      if (createdMk === mk) {
        total += getClientMonthlyRevenue(c);
      }
    }
  }

  for (const r of manualRevenues) {
    if (r.type === 'recurring') {
      if (r.year < year || (r.year === year && r.month <= month)) {
        total += r.amount;
      }
    } else {
      if (r.year === year && r.month === month) {
        total += r.amount;
      }
    }
  }

  return total;
}

function ProgressBar({ current, goal, label }) {
  const pct = goal > 0 ? (current / goal) * 100 : 0;
  const displayPct = Math.min(pct, 100);
  const remaining = goal - current;
  let color = '#d45c4c';
  if (pct >= 100) color = '#c4a050';
  else if (pct >= 80) color = '#2a9d5c';
  else if (pct >= 50) color = '#e8a040';

  return (
    <div className="biz-progress-block">
      <div className="biz-progress-label">{label}</div>
      <div className="biz-progress-amount">{formatCHF(current)} CHF</div>
      <div className="biz-progress-bar-track">
        <div className="biz-progress-bar-fill" style={{ width: `${displayPct}%`, background: color }} />
      </div>
      <div className="biz-progress-sub" style={{ color }}>
        {remaining > 0
          ? `${formatCHF(remaining)} CHF restants pour atteindre ton objectif`
          : `Objectif depasse de ${formatCHF(Math.abs(remaining))} CHF !`}
      </div>
      <div className="biz-progress-goal">Objectif : {formatCHF(goal)} CHF</div>
    </div>
  );
}

function MotivationQuote({ pct }) {
  let msg = '';
  if (pct >= 100) msg = 'Objectif atteint ! Tu geres Benoit.';
  else if (pct >= 75) msg = 'Presque la ! Encore un effort.';
  else if (pct >= 50) msg = "La moitie est faite. L'objectif est a portee.";
  else if (pct >= 25) msg = 'Tu es sur la bonne voie. Pousse encore.';
  else msg = 'Chaque client compte. Continue a prospecter.';
  return <div className="biz-motivation">{msg}</div>;
}

// Sync a goal to Supabase app_config
function syncGoalToCloud(key, value) {
  if (!isCloudEnabled || !supabase) return;
  supabase.from('app_config').upsert({ key, value: String(value) }).then(() => {});
}

export default function BusinessDashboard() {
  const [monthlyGoal, setMonthlyGoal] = useState(() => Number(localStorage.getItem(MONTHLY_GOAL_KEY)) || 5000);
  const [annualGoal, setAnnualGoal] = useState(() => Number(localStorage.getItem(ANNUAL_GOAL_KEY)) || 60000);
  const [editingGoal, setEditingGoal] = useState(null);
  const [goalInput, setGoalInput] = useState('');
  const [manualRevenues, setManualRevenues] = useState(() => {
    try { return JSON.parse(localStorage.getItem(MANUAL_REVENUES_KEY) || '[]'); } catch { return []; }
  });
  const [showAddRevenue, setShowAddRevenue] = useState(false);
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const [chartYear, setChartYear] = useState(currentYear);
  const [revenueForm, setRevenueForm] = useState({
    clientName: '', amount: '', description: '', type: 'oneshot', month: currentMonth, year: currentYear, note: '',
  });

  const allClients = getClients();
  const benoitClients = getBenoitClients();
  const anissaClients = getAnissaOwnClients();
  const sharedClients = getSharedClients();

  // Pull goals from Supabase on mount
  useEffect(() => {
    if (!isCloudEnabled || !supabase) return;
    supabase.from('app_config').select('*').in('key', ['monthly_goal', 'yearly_goal']).then(({ data }) => {
      if (!data) return;
      for (const row of data) {
        const val = Number(row.value);
        if (!val || val <= 0) continue;
        if (row.key === 'monthly_goal') {
          setMonthlyGoal(val);
          localStorage.setItem(MONTHLY_GOAL_KEY, val);
        } else if (row.key === 'yearly_goal') {
          setAnnualGoal(val);
          localStorage.setItem(ANNUAL_GOAL_KEY, val);
        }
      }
    });
  }, []);

  // Pull manual revenues from Supabase on mount
  useEffect(() => {
    if (!isCloudEnabled || !supabase) return;
    supabase.from('manual_revenues').select('*').then(({ data }) => {
      if (data && data.length > 0) {
        const cloud = data.map(r => ({
          id: r.id, clientName: r.client_name, amount: r.amount,
          type: r.type, month: r.month, year: r.year, note: r.note || '',
          createdAt: r.created_at,
        }));
        setManualRevenues(prev => {
          const localIds = new Set(prev.map(r => r.id));
          const merged = [...prev];
          for (const r of cloud) {
            if (!localIds.has(r.id)) merged.push(r);
          }
          localStorage.setItem(MANUAL_REVENUES_KEY, JSON.stringify(merged));
          return merged;
        });
      }
    });
  }, []);

  // Current month revenue
  const currentMonthRevenue = calcMonthRevenue(allClients, manualRevenues, currentYear, currentMonth);

  // Annual revenue
  let annualRevenue = 0;
  for (let m = 0; m <= currentMonth; m++) {
    annualRevenue += calcMonthRevenue(allClients, manualRevenues, currentYear, m);
  }

  // Revenue by formule this month (for pie chart)
  const revenueByFormule = {};
  for (const c of benoitClients) {
    const f = c.formule || 'unknown';
    const created = new Date(c.createdAt);
    const mk = getMonthKey(c.createdAt);
    const currentMk = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
    let rev = 0;
    if (isRecurring(f)) {
      if (created.getFullYear() < currentYear || (created.getFullYear() === currentYear && created.getMonth() <= currentMonth)) {
        rev = getClientMonthlyRevenue(c);
      }
    } else {
      if (mk === currentMk) rev = getClientMonthlyRevenue(c);
    }
    if (rev > 0) {
      const label = (f === 'pack10' || f === 'pack20' || f === 'pack30') ? 'packs' : f;
      revenueByFormule[label] = (revenueByFormule[label] || 0) + rev;
    }
  }
  const manualThisMonth = manualRevenues.filter(r =>
    (r.type === 'oneshot' && r.year === currentYear && r.month === currentMonth) ||
    (r.type === 'recurring' && (r.year < currentYear || (r.year === currentYear && r.month <= currentMonth)))
  ).reduce((s, r) => s + r.amount, 0);
  if (manualThisMonth > 0) revenueByFormule['hors_app'] = manualThisMonth;

  const PIE_COLORS = {
    autonome: '#c4a050', suivi: '#d4b060', intensif: '#e4c070',
    packs: '#888', massage: '#666', custom: '#aaa', hors_app: '#555',
  };
  const PIE_LABELS = {
    autonome: 'Autonome', suivi: 'Suivi Complet', intensif: 'Intensif',
    packs: 'Packs presentiel', massage: 'Massage', custom: 'Personnalise', hors_app: 'Hors app',
  };

  const pieData = Object.entries(revenueByFormule).map(([key, value]) => ({
    name: PIE_LABELS[key] || key, value, fill: PIE_COLORS[key] || '#777',
  }));

  // Line chart: Jan-Dec for selected year + N-1 comparison
  const lineData = [];
  for (let m = 0; m < 12; m++) {
    lineData.push({
      name: getMonthName(m, true),
      ca: calcMonthRevenue(allClients, manualRevenues, chartYear, m),
      prev: calcMonthRevenue(allClients, manualRevenues, chartYear - 1, m),
    });
  }

  // Year selector range
  const yearOptions = [];
  for (let y = 2025; y <= currentYear + 1; y++) yearOptions.push(y);

  // Revenue table by formule
  const formuleTable = [];
  const formuleCounts = {};
  for (const c of benoitClients) {
    const f = c.formule || 'unknown';
    if (!formuleCounts[f]) formuleCounts[f] = { count: 0, revenue: 0 };
    const created = new Date(c.createdAt);
    const mk = getMonthKey(c.createdAt);
    const currentMk = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
    if (isRecurring(f)) {
      if (created.getFullYear() < currentYear || (created.getFullYear() === currentYear && created.getMonth() <= currentMonth)) {
        formuleCounts[f].count++;
        formuleCounts[f].revenue += getClientMonthlyRevenue(c);
      }
    } else {
      if (mk === currentMk) {
        formuleCounts[f].count++;
        formuleCounts[f].revenue += getClientMonthlyRevenue(c);
      }
    }
  }
  for (const [key, val] of Object.entries(formuleCounts)) {
    if (val.count > 0) {
      formuleTable.push({ formule: FORMULES[key]?.nom || key, count: val.count, revenue: val.revenue });
    }
  }

  // Anissa stats
  const allNutritionConsultations = [];
  for (const c of allClients) {
    allNutritionConsultations.push(...getNutritionConsultations(c.id));
  }
  const nutritionThisMonth = allNutritionConsultations.filter(n => {
    const d = new Date(n.date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  }).length;

  const totalGenerations = allClients.reduce((s, c) => s + (c.history?.length || 0), 0);
  const monthlyPct = monthlyGoal > 0 ? (currentMonthRevenue / monthlyGoal) * 100 : 0;

  // Save goals to localStorage + Supabase
  const saveGoal = (type) => {
    const val = Number(goalInput);
    if (!val || val <= 0) return;
    if (type === 'monthly') {
      setMonthlyGoal(val);
      localStorage.setItem(MONTHLY_GOAL_KEY, val);
      syncGoalToCloud('monthly_goal', val);
    } else {
      setAnnualGoal(val);
      localStorage.setItem(ANNUAL_GOAL_KEY, val);
      syncGoalToCloud('yearly_goal', val);
    }
    setEditingGoal(null);
    setGoalInput('');
  };

  // Manual revenues
  const saveManualRevenues = useCallback((revs) => {
    setManualRevenues(revs);
    localStorage.setItem(MANUAL_REVENUES_KEY, JSON.stringify(revs));
    if (isCloudEnabled && supabase) {
      supabase.from('manual_revenues').upsert(
        revs.map(r => ({
          id: r.id, client_name: r.clientName, amount: r.amount,
          type: r.type, month: r.month, year: r.year, note: r.note || '',
          created_by: 'benoit', created_at: r.createdAt || new Date().toISOString(),
        }))
      ).then(() => {});
    }
  }, []);

  const addRevenue = () => {
    if (!revenueForm.clientName.trim() || !revenueForm.amount) return;
    const newRev = {
      id: crypto.randomUUID(),
      clientName: revenueForm.clientName.trim(),
      amount: Number(revenueForm.amount),
      description: revenueForm.description,
      type: revenueForm.type,
      month: Number(revenueForm.month),
      year: Number(revenueForm.year),
      note: revenueForm.note,
      createdAt: new Date().toISOString(),
    };
    saveManualRevenues([...manualRevenues, newRev]);
    setRevenueForm({ clientName: '', amount: '', description: '', type: 'oneshot', month: currentMonth, year: currentYear, note: '' });
    setShowAddRevenue(false);
  };

  const deleteRevenue = (id) => {
    saveManualRevenues(manualRevenues.filter(r => r.id !== id));
    if (isCloudEnabled && supabase) {
      supabase.from('manual_revenues').delete().eq('id', id).then(() => {});
    }
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: '#1a1815', border: '1px solid rgba(196,160,80,.3)', borderRadius: 8, padding: '10px 16px' }}>
        <div style={{ color: '#d4c9a8', fontSize: 13, marginBottom: 4 }}>{label}</div>
        {payload.map((p, i) => (
          <div key={i} style={{ color: p.color, fontWeight: 700, fontSize: 15 }}>
            {p.dataKey === 'ca' ? chartYear : chartYear - 1} : {formatCHF(p.value)} CHF
          </div>
        ))}
      </div>
    );
  };

  const renderPieLabel = ({ name, percent, value }) => {
    return `${name} ${(percent * 100).toFixed(0)}% (${formatCHF(value)})`;
  };

  return (
    <div className="biz-dashboard" style={{ animation: 'pageIn .35s ease' }}>
      {/* OBJECTIVES */}
      <div className="biz-section" style={{ animationDelay: '0s' }}>
        <div className="biz-section-title">Objectifs & Progression</div>
        <div className="biz-goals-row">
          <div className="biz-goal-card">
            <div className="biz-goal-header">
              <span>CA ce mois</span>
              {editingGoal === 'monthly' ? (
                <div className="biz-goal-edit">
                  <input type="number" value={goalInput} onChange={e => setGoalInput(e.target.value)} placeholder="Montant" className="biz-goal-input" onKeyDown={e => e.key === 'Enter' && saveGoal('monthly')} />
                  <button className="btn btn-xs btn-primary" onClick={() => saveGoal('monthly')}>OK</button>
                  <button className="btn btn-xs btn-secondary" onClick={() => setEditingGoal(null)}>x</button>
                </div>
              ) : (
                <button className="biz-goal-btn" onClick={() => { setEditingGoal('monthly'); setGoalInput(String(monthlyGoal)); }}>Modifier objectif</button>
              )}
            </div>
            <ProgressBar current={currentMonthRevenue} goal={monthlyGoal} label={`${getMonthName(currentMonth)} ${currentYear}`} />
          </div>
          <div className="biz-goal-card">
            <div className="biz-goal-header">
              <span>CA annuel {currentYear}</span>
              {editingGoal === 'annual' ? (
                <div className="biz-goal-edit">
                  <input type="number" value={goalInput} onChange={e => setGoalInput(e.target.value)} placeholder="Montant" className="biz-goal-input" onKeyDown={e => e.key === 'Enter' && saveGoal('annual')} />
                  <button className="btn btn-xs btn-primary" onClick={() => saveGoal('annual')}>OK</button>
                  <button className="btn btn-xs btn-secondary" onClick={() => setEditingGoal(null)}>x</button>
                </div>
              ) : (
                <button className="biz-goal-btn" onClick={() => { setEditingGoal('annual'); setGoalInput(String(annualGoal)); }}>Modifier objectif</button>
              )}
            </div>
            <ProgressBar current={annualRevenue} goal={annualGoal} label={`Annee ${currentYear}`} />
          </div>
        </div>
      </div>

      {/* CHARTS */}
      <div className="biz-section" style={{ animationDelay: '.05s' }}>
        <div className="biz-chart-header">
          <div className="biz-section-title" style={{ marginBottom: 0 }}>Evolution du chiffre d'affaires</div>
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
                <ReferenceLine y={monthlyGoal} stroke="rgba(255,255,255,0.3)" strokeDasharray="6 4" label={{ value: 'Objectif', fill: 'rgba(255,255,255,0.3)', fontSize: 11, position: 'right' }} />
                <Line type="monotone" dataKey="prev" stroke="rgba(150,150,150,0.35)" strokeWidth={1.5} strokeDasharray="5 3" dot={false} name={`${chartYear - 1}`} animationDuration={800} />
                <Line type="monotone" dataKey="ca" stroke="#c4a050" strokeWidth={2.5} dot={{ fill: '#c4a050', r: 4 }} name={`${chartYear}`} animationDuration={1200} />
              </LineChart>
            </ResponsiveContainer>
            <div className="biz-chart-legend">
              <span className="biz-legend-item"><span className="biz-legend-line" style={{ background: '#c4a050' }} />{chartYear}</span>
              <span className="biz-legend-item"><span className="biz-legend-line biz-legend-dashed" style={{ background: 'rgba(150,150,150,0.5)' }} />{chartYear - 1}</span>
              <span className="biz-legend-item"><span className="biz-legend-line biz-legend-dashed" style={{ background: 'rgba(255,255,255,0.3)' }} />Objectif</span>
            </div>
          </div>
          <div className="biz-chart-card biz-pie-card">
            <div className="biz-chart-subtitle">Repartition par formule</div>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90}
                    label={renderPieLabel} animationDuration={800} labelLine={{ stroke: '#6b5f48' }}>
                    {pieData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Pie>
                  <Tooltip formatter={(v) => `${formatCHF(v)} CHF`} contentStyle={{ background: '#1a1815', border: '1px solid rgba(196,160,80,.3)', borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="biz-empty">Aucun revenu ce mois</div>
            )}
          </div>
        </div>
      </div>

      {/* DETAIL REVENUS BENOIT */}
      <div className="biz-section" style={{ animationDelay: '.1s' }}>
        <div className="biz-section-title">Detail revenus — Benoit</div>
        {formuleTable.length > 0 ? (
          <table className="biz-table">
            <thead>
              <tr><th>Formule</th><th>Clients</th><th>CA mensuel</th></tr>
            </thead>
            <tbody>
              {formuleTable.map((r, i) => (
                <tr key={i}><td>{r.formule}</td><td>{r.count}</td><td>{formatCHF(r.revenue)} CHF</td></tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="biz-empty">Aucun revenu app ce mois</div>
        )}

        {/* Manual revenues */}
        <div className="biz-manual-section">
          <div className="biz-manual-header">
            <span className="biz-manual-title">Revenus hors app</span>
            <button className="btn btn-sm btn-primary" onClick={() => setShowAddRevenue(!showAddRevenue)}>+ Ajouter un revenu</button>
          </div>

          {showAddRevenue && (
            <div className="biz-revenue-form">
              <div className="biz-revenue-grid">
                <div className="field">
                  <label>Nom du client</label>
                  <input type="text" value={revenueForm.clientName} onChange={e => setRevenueForm(p => ({ ...p, clientName: e.target.value }))} />
                </div>
                <div className="field">
                  <label>Montant CHF</label>
                  <input type="number" value={revenueForm.amount} onChange={e => setRevenueForm(p => ({ ...p, amount: e.target.value }))} />
                </div>
                <div className="field">
                  <label>Description</label>
                  <input type="text" value={revenueForm.description} onChange={e => setRevenueForm(p => ({ ...p, description: e.target.value }))} placeholder="Ex: Pack 20 — Sophie" />
                </div>
                <div className="field">
                  <label>Type</label>
                  <select value={revenueForm.type} onChange={e => setRevenueForm(p => ({ ...p, type: e.target.value }))}>
                    <option value="oneshot">One-shot</option>
                    <option value="recurring">Mensuel recurrent</option>
                  </select>
                </div>
                <div className="field">
                  <label>Mois</label>
                  <select value={revenueForm.month} onChange={e => setRevenueForm(p => ({ ...p, month: Number(e.target.value) }))}>
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i} value={i}>{getMonthName(i)}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Annee</label>
                  <select value={revenueForm.year} onChange={e => setRevenueForm(p => ({ ...p, year: Number(e.target.value) }))}>
                    {yearOptions.map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Note</label>
                  <input type="text" value={revenueForm.note} onChange={e => setRevenueForm(p => ({ ...p, note: e.target.value }))} placeholder="Optionnel" />
                </div>
              </div>
              <div className="biz-revenue-actions">
                <button className="btn btn-sm btn-primary" onClick={addRevenue}>Ajouter</button>
                <button className="btn btn-sm btn-secondary" onClick={() => setShowAddRevenue(false)}>Annuler</button>
              </div>
            </div>
          )}

          {manualRevenues.length > 0 ? (
            <table className="biz-table biz-table-manual">
              <thead>
                <tr><th>Client</th><th>Montant</th><th>Description</th><th>Type</th><th>Mois</th><th>Note</th><th></th></tr>
              </thead>
              <tbody>
                {manualRevenues.map(r => (
                  <tr key={r.id}>
                    <td>{r.clientName}</td>
                    <td>{formatCHF(r.amount)} CHF</td>
                    <td>{r.description || '-'}</td>
                    <td>{r.type === 'recurring' ? 'Recurrent' : 'One-shot'}</td>
                    <td>{getMonthName(r.month, true)} {r.year}</td>
                    <td>{r.note || '-'}</td>
                    <td><button className="btn btn-xs btn-danger" onClick={() => deleteRevenue(r.id)}>x</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="biz-empty" style={{ marginTop: 10 }}>Aucun revenu hors app</div>
          )}
        </div>

        <div className="biz-total-row">
          <span>TOTAL BENOIT</span>
          <span className="biz-total-amount">{formatCHF(currentMonthRevenue)} CHF / mois</span>
        </div>
      </div>

      {/* MOTIVATION BENOIT */}
      <MotivationQuote pct={monthlyPct} />

      {/* AB COACHING SECTION (shared) */}
      <ABCoachingSection variant="benoit" />
    </div>
  );
}
