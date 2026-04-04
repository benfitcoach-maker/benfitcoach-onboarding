import { useState } from 'react';
import { getClient, addProgressionEntry, deleteProgressionEntry } from './store';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';

function ProgressChart({ data }) {
  if (!data || data.length < 2) {
    return <div className="chart-empty">Ajoutez au moins 2 entrees pour voir le graphique</div>;
  }

  const chartData = data
    .map(d => ({ date: d.date, poids: parseFloat(d.poids) }))
    .filter(d => !isNaN(d.poids));

  if (chartData.length < 2) return null;

  const first = chartData[0].poids;
  const last = chartData[chartData.length - 1].poids;
  const diff = last - first;
  const color = diff <= 0 ? '#2a9d5c' : '#c4a050';

  return (
    <div className="chart-container">
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="goldGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.2} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f1c17" />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6b5f48' }} tickLine={false} axisLine={{ stroke: '#1f1c17' }} />
          <YAxis tick={{ fontSize: 10, fill: '#6b5f48' }} tickLine={false} axisLine={{ stroke: '#1f1c17' }} domain={['auto', 'auto']} unit=" kg" />
          <Tooltip
            contentStyle={{ background: '#12100c', border: '1px solid #1f1c17', borderRadius: 8, fontSize: 12, color: '#d4c9a8' }}
            labelStyle={{ color: '#6b5f48' }}
            formatter={(value) => [`${value} kg`, 'Poids']}
          />
          <Area type="monotone" dataKey="poids" stroke={color} strokeWidth={2} fill="url(#goldGradient)" dot={{ r: 4, fill: color, stroke: '#0a0908', strokeWidth: 2 }} activeDot={{ r: 6, fill: color, stroke: '#0a0908', strokeWidth: 2, filter: `drop-shadow(0 0 6px ${color})` }} />
        </AreaChart>
      </ResponsiveContainer>
      <div className="chart-summary">
        <span>Debut: <strong>{first} kg</strong></span>
        <span>Actuel: <strong>{last} kg</strong></span>
        <span style={{ color }}>{diff > 0 ? '+' : ''}{diff.toFixed(1)} kg</span>
      </div>
    </div>
  );
}

export default function ProgressionPanel({ clientId, onRefresh }) {
  const client = getClient(clientId);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [poids, setPoids] = useState('');
  const [comment, setComment] = useState('');

  if (!client) return null;

  const progression = client.progression || [];

  const handleAdd = () => {
    if (!poids) return;
    addProgressionEntry(clientId, { date, poids: parseFloat(poids), comment });
    setPoids('');
    setComment('');
    if (onRefresh) onRefresh();
  };

  const handleDelete = (entryId) => {
    deleteProgressionEntry(clientId, entryId);
    if (onRefresh) onRefresh();
  };

  return (
    <div className="progression-panel">
      <h3 className="progression-title">Evolution du poids</h3>

      <ProgressChart data={progression} />

      <div className="progression-form">
        <div className="progression-form-row">
          <div className="field">
            <label>Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div className="field">
            <label>Poids (kg)</label>
            <input type="number" step="0.1" value={poids} onChange={e => setPoids(e.target.value)} placeholder="75.0" />
          </div>
          <button className="btn btn-primary btn-sm" onClick={handleAdd} disabled={!poids}>Ajouter</button>
        </div>
        <div className="field" style={{ marginTop: '10px' }}>
          <label>Commentaire (optionnel)</label>
          <input type="text" value={comment} onChange={e => setComment(e.target.value)} placeholder="Ex: bonne semaine, stress au travail..." />
        </div>
      </div>

      {progression.length > 0 && (
        <div className="progression-entries">
          {[...progression].reverse().map((entry, i) => (
            <div key={entry.id} className="progression-entry" style={{ animationDelay: `${i * 40}ms` }}>
              <span className="progression-entry-date">{entry.date}</span>
              <span className="progression-entry-weight">{entry.poids} kg</span>
              {entry.comment && <span className="progression-entry-comment">{entry.comment}</span>}
              <button className="btn btn-xs btn-danger" onClick={() => handleDelete(entry.id)}>x</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
