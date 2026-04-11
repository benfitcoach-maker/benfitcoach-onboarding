import { useState, useEffect, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, ReferenceLine, CartesianGrid } from 'recharts';
import { getAnissaOwnClients, getSharedClients, getNutritionConsultations, getClients } from './store';
import { supabase, isCloudEnabled } from './supabaseClient';
import ABCoachingSection from './ABCoachingSection';

const MONTHLY_GOAL_KEY = 'bfc_monthly_goal_anissa';
const ANNUAL_GOAL_KEY = 'bfc_annual_goal_anissa';
const MANUAL_REVENUES_KEY = 'bfc_manual_revenues_anissa';

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

function calcAnissaMonthRevenue(ownClients, manualRevenues, year, month) {
  const mk = `${year}-${String(month + 1).padStart(2, '0')}`;
  let total = 0;

  // Own clients: use custom_rate
  for (const c of ownClients) {
    const rate = Number(c.form?.customRate) || 0;
    if (rate <= 0) continue;
    const created = new Date(c.createdAt);
    const createdMk = getMonthKey(c.createdAt);
    // Treat nutrition clients as recurring (monthly)
    if (created.getFullYear() < year || (created.getFullYear() === year && created.getMonth() <= month)) {
      total += rate;
    }
  }

  // Manual revenues
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
  if (pct >= 100) color = '#33b068';
  else if (pct >= 80) color = '#2a9d5c';
  else if (pct >= 50) color = '#e8a040';

  return (
    <div className="biz-progress-block">
      <div className="biz-progress-label">{label}</div>
      <div className="biz-progress-amount" style={{ color: '#6abf8a' }}>{formatCHF(current)} CHF</div>
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

function syncGoalToCloud(key, value) {
  if (!isCloudEnabled || !supabase) return;
  supabase.from('app_config').upsert({ key, value: String(value) }).then(() => {});
}

export default function AnissaChiffres() {
  const [monthlyGoal, setMonthlyGoal] = useState(() => Number(localStorage.getItem(MONTHLY_GOAL_KEY)) || 3000);
  const [annualGoal, setAnnualGoal] = useState(() => Number(localStorage.getItem(ANNUAL_GOAL_KEY)) || 36000);
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
    clientName: '', amount: '', type: 'oneshot', month: currentMonth, year: currentYear, note: '',
  });

  const ownClients = getAnissaOwnClients();
  const sharedClients = getSharedClients();
  const allClients = getClients();

  // Pull goals from Supabase
  useEffect(() => {
    if (!isCloudEnabled || !supabase) return;
    supabase.from('app_config').select('*').in('key', ['monthly_goal_anissa', 'yearly_goal_anissa']).then(({ data }) => {
      if (!data) return;
      for (const row of data) {
        const val = Number(row.value);
        if (!val || val <= 0) continue;
        if (row.key === 'monthly_goal_anissa') {
          setMonthlyGoal(val);
          localStorage.setItem(MONTHLY_GOAL_KEY, val);
        } else if (row.key === 'yearly_goal_anissa') {
          setAnnualGoal(val);
          localStorage.setItem(ANNUAL_GOAL_KEY, val);
        }
      }
    });
  }, []);

  // Pull manual revenues from Supabase
  useEffect(() => {
    if (!isCloudEnabled || !supabase) return;
    supabase.from('manual_revenues').select('*').eq('created_by', 'anissa').then(({ data }) => {
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

  // Revenue calculations
  const currentMonthRevenue = calcAnissaMonthRevenue(ownClients, manualRevenues, currentYear, currentMonth);

  let annualRevenue = 0;
  for (let m = 0; m <= currentMonth; m++) {
    annualRevenue += calcAnissaMonthRevenue(ownClients, manualRevenues, currentYear, m);
  }

  // Pie chart: own clients vs shared vs manual
  const ownClientsRevenue = ownClients.reduce((sum, c) => {
    const rate = Number(c.form?.customRate) || 0;
    if (rate <= 0) return sum;
    const created = new Date(c.createdAt);
    if (created.getFullYear() < currentYear || (created.getFullYear() === currentYear && created.getMonth() <= currentMonth)) {
      return sum + rate;
    }
    return sum;
  }, 0);

  const manualThisMonth = manualRevenues.filter(r =>
    (r.type === 'oneshot' && r.year === currentYear && r.month === currentMonth) ||
    (r.type === 'recurring' && (r.year < currentYear || (r.year === currentYear && r.month <= currentMonth)))
  ).reduce((s, r) => s + r.amount, 0);

  const PIE_COLORS = ['#2a9d5c', '#4a9966', '#6abf8a', '#1a3a2a'];
  const pieData = [
    ownClientsRevenue > 0 && { name: 'Clients propres', value: ownClientsRevenue, fill: PIE_COLORS[0] },
    manualThisMonth > 0 && { name: 'Revenus manuels', value: manualThisMonth, fill: PIE_COLORS[2] },
  ].filter(Boolean);

  // Line chart
  const lineData = [];
  for (let m = 0; m < 12; m++) {
    lineData.push({
      name: getMonthName(m, true),
      ca: calcAnissaMonthRevenue(ownClients, manualRevenues, chartYear, m),
      prev: calcAnissaMonthRevenue(ownClients, manualRevenues, chartYear - 1, m),
    });
  }

  const yearOptions = [];
  for (let y = 2025; y <= currentYear + 1; y++) yearOptions.push(y);

  // Nutrition consultations stats
  const allNutritionConsultations = [];
  for (const c of allClients) {
    const consults = getNutritionConsultations(c.id);
    allNutritionConsultations.push(...consults);
  }
  const consultationsThisMonth = allNutritionConsultations.filter(n => {
    const d = new Date(n.date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  }).length;

  // Clients to recontact (last consultation > 3 months ago)
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  const clientsToRecontact = ownClients.filter(c => {
    const consults = getNutritionConsultations(c.id);
    if (consults.length === 0) return true; // never consulted
    const lastDate = new Date(consults[0].date);
    return lastDate < threeMonthsAgo;
  }).length;

  const monthlyPct = monthlyGoal > 0 ? (currentMonthRevenue / monthlyGoal) * 100 : 0;

  // Save goals
  const saveGoal = (type) => {
    const val = Number(goalInput);
    if (!val || val <= 0) return;
    if (type === 'monthly') {
      setMonthlyGoal(val);
      localStorage.setItem(MONTHLY_GOAL_KEY, val);
      syncGoalToCloud('monthly_goal_anissa', val);
    } else {
      setAnnualGoal(val);
      localStorage.setItem(ANNUAL_GOAL_KEY, val);
      syncGoalToCloud('yearly_goal_anissa', val);
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
          created_by: 'anissa', created_at: r.createdAt || new Date().toISOString(),
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
      type: revenueForm.type,
      month: Number(revenueForm.month),
      year: Number(revenueForm.year),
      note: revenueForm.note,
      createdAt: new Date().toISOString(),
    };
    saveManualRevenues([...manualRevenues, newRev]);
    setRevenueForm({ clientName: '', amount: '', type: 'oneshot', month: currentMonth, year: currentYear, note: '' });
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
      <div style={{ background: '#1a2e1f', border: '1px solid rgba(106,191,138,.3)', borderRadius: 8, padding: '10px 16px' }}>
        <div style={{ color: '#d0d0c8', fontSize: 13, marginBottom: 4 }}>{label}</div>
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

  // Motivation
  let motivationMsg = '';
  if (monthlyPct >= 100) motivationMsg = 'Objectif atteint ! Tu geres Anissa.';
  else if (monthlyPct >= 75) motivationMsg = 'Presque la ! Encore un effort.';
  else if (monthlyPct >= 50) motivationMsg = "La moitie est faite. L'objectif est a portee.";
  else if (monthlyPct >= 25) motivationMsg = 'Tu es sur la bonne voie. Pousse encore.';
  else motivationMsg = 'Chaque consultation compte. Continue a developper ta clientele.';

  return (
    <div className="biz-dashboard anissa-biz" style={{ animation: 'pageIn .35s ease' }}>
      {/* SECTION A: Mes revenus */}
      <div className="biz-section biz-section-anissa" style={{ animationDelay: '0s' }}>
        <div className="biz-section-title" style={{ color: '#6abf8a' }}>Mes revenus</div>
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

      {/* SECTION B & C: Charts */}
      <div className="biz-section biz-section-anissa" style={{ animationDelay: '.05s' }}>
        <div className="biz-chart-header">
          <div className="biz-section-title" style={{ marginBottom: 0, color: '#6abf8a' }}>Evolution du chiffre d'affaires</div>
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
                <XAxis dataKey="name" stroke="#6a7a6a" tick={{ fill: '#b0c4a8', fontSize: 12 }} />
                <YAxis stroke="#6a7a6a" tick={{ fill: '#b0c4a8', fontSize: 12 }} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={monthlyGoal} stroke="rgba(255,255,255,0.3)" strokeDasharray="6 4" label={{ value: 'Objectif', fill: 'rgba(255,255,255,0.3)', fontSize: 11, position: 'right' }} />
                <Line type="monotone" dataKey="prev" stroke="rgba(150,150,150,0.35)" strokeWidth={1.5} strokeDasharray="5 3" dot={false} name={`${chartYear - 1}`} animationDuration={800} />
                <Line type="monotone" dataKey="ca" stroke="#2a9d5c" strokeWidth={2.5} dot={{ fill: '#2a9d5c', r: 4 }} name={`${chartYear}`} animationDuration={1200} />
              </LineChart>
            </ResponsiveContainer>
            <div className="biz-chart-legend">
              <span className="biz-legend-item"><span className="biz-legend-line" style={{ background: '#2a9d5c' }} />{chartYear}</span>
              <span className="biz-legend-item"><span className="biz-legend-line biz-legend-dashed" style={{ background: 'rgba(150,150,150,0.5)' }} />{chartYear - 1}</span>
              <span className="biz-legend-item"><span className="biz-legend-line biz-legend-dashed" style={{ background: 'rgba(255,255,255,0.3)' }} />Objectif</span>
            </div>
          </div>
          <div className="biz-chart-card biz-pie-card">
            <div className="biz-chart-subtitle">Repartition du CA</div>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90}
                    label={renderPieLabel} animationDuration={800} labelLine={{ stroke: '#6a7a6a' }}>
                    {pieData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Pie>
                  <Tooltip formatter={(v) => `${formatCHF(v)} CHF`} contentStyle={{ background: '#1a2e1f', border: '1px solid rgba(106,191,138,.3)', borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="biz-empty">Aucun revenu ce mois</div>
            )}
          </div>
        </div>
      </div>

      {/* SECTION D: Revenus hors app */}
      <div className="biz-section biz-section-anissa" style={{ animationDelay: '.1s' }}>
        <div className="biz-section-title" style={{ color: '#6abf8a' }}>Revenus hors app</div>
        <div className="biz-manual-section" style={{ marginTop: 0, paddingTop: 0, borderTop: 'none' }}>
          <div className="biz-manual-header">
            <span className="biz-manual-title">Revenus manuels</span>
            <button className="btn btn-sm btn-anissa-primary" onClick={() => setShowAddRevenue(!showAddRevenue)}>+ Ajouter un revenu</button>
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
                <button className="btn btn-sm btn-anissa-primary" onClick={addRevenue}>Ajouter</button>
                <button className="btn btn-sm btn-anissa-secondary" onClick={() => setShowAddRevenue(false)}>Annuler</button>
              </div>
            </div>
          )}

          {manualRevenues.length > 0 ? (
            <table className="biz-table biz-table-manual">
              <thead>
                <tr><th>Client</th><th>Montant</th><th>Type</th><th>Mois</th><th>Note</th><th></th></tr>
              </thead>
              <tbody>
                {manualRevenues.map(r => (
                  <tr key={r.id}>
                    <td>{r.clientName}</td>
                    <td>{formatCHF(r.amount)} CHF</td>
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

        <div className="biz-total-row" style={{ background: 'rgba(42,157,92,.08)', borderColor: 'rgba(106,191,138,.25)' }}>
          <span style={{ color: '#6abf8a' }}>TOTAL ANISSA</span>
          <span className="biz-total-amount" style={{ color: '#6abf8a' }}>{formatCHF(currentMonthRevenue)} CHF / mois</span>
        </div>
      </div>

      {/* SECTION E: Statistiques */}
      <div className="biz-section biz-section-anissa" style={{ animationDelay: '.15s' }}>
        <div className="biz-section-title" style={{ color: '#6abf8a' }}>Mes statistiques</div>
        <div className="biz-stats-row-4">
          <div className="biz-stat-card biz-stat-anissa">
            <div className="biz-stat-number">{ownClients.length}</div>
            <div className="biz-stat-label">Clients propres</div>
          </div>
          <div className="biz-stat-card biz-stat-anissa">
            <div className="biz-stat-number">{consultationsThisMonth}</div>
            <div className="biz-stat-label">Consultations ce mois</div>
          </div>
          <div className="biz-stat-card biz-stat-anissa">
            <div className="biz-stat-number">{allNutritionConsultations.length}</div>
            <div className="biz-stat-label">Consultations total</div>
          </div>
          <div className="biz-stat-card biz-stat-anissa">
            <div className="biz-stat-number">{clientsToRecontact}</div>
            <div className="biz-stat-label">A recontacter</div>
          </div>
        </div>
      </div>

      {/* SECTION F: Motivation */}
      <div className="biz-motivation" style={{ color: '#6abf8a' }}>{motivationMsg}</div>

      {/* AB COACHING SECTION (shared) */}
      <ABCoachingSection variant="anissa" />
    </div>
  );
}
