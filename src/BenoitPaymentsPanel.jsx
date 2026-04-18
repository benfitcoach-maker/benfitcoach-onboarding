import { useMemo, useState } from 'react';
import { getClient, saveClient } from './store';
import {
  BENOIT_PAYMENT_LABELS,
  BENOIT_PAYMENT_COLORS,
  getPackPrice,
  getTotalPaid,
  getPaymentStatus,
} from './services/benoitPayments';

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch { return '—'; }
}

/**
 * Panneau détail paiements Benoit — V3.
 * Lecture seule sauf suppression d'un paiement individuel (V3 optionnelle).
 *
 * Props :
 *  - clientId : id du client à afficher
 *  - onRefresh : callback à appeler après modification
 */
export default function BenoitPaymentsPanel({ clientId, onRefresh }) {
  const client = clientId ? getClient(clientId) : null;
  // V22 : mini form inline
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [formError, setFormError] = useState('');
  // V23 : édition inline d'un paiement existant
  const [editingAt, setEditingAt] = useState(null); // clé = payment.at
  const [editAmount, setEditAmount] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editDate, setEditDate] = useState(''); // format YYYY-MM-DD
  const [editError, setEditError] = useState('');

  const summary = useMemo(() => {
    if (!client) return null;
    const price = getPackPrice(client);
    const paid = getTotalPaid(client);
    const status = getPaymentStatus(client);
    const remaining = (price != null && paid != null) ? Math.max(0, price - paid) : null;
    return { price, paid, status, remaining };
  }, [client]);

  const payments = useMemo(() => {
    const arr = Array.isArray(client?.form?.benoitPayments) ? [...client.form.benoitPayments] : [];
    // Tri le plus récent d'abord
    arr.sort((a, b) => new Date(b?.at || 0) - new Date(a?.at || 0));
    return arr;
  }, [client]);

  if (!client) {
    return (
      <div className="benoit-payments-panel" style={{ padding: 20, color: 'var(--text-muted)' }}>
        Sélectionnez un client pour voir ses paiements.
      </div>
    );
  }

  // V17 : Nouveau pack (déplacé depuis la card Benoit)
  const handleNewPack = () => {
    if (typeof window === 'undefined' || !window.prompt) return;
    const prenom = client.prenom || client.form?.prenom || 'client';
    const rawN = window.prompt(`Nouveau pack pour ${prenom} — total séances (ex: 10, 20, 30, 50 ou autre) :`, '');
    if (rawN == null) return;
    const nStr = String(rawN).trim();
    if (nStr === '') return;
    const nTot = Number(nStr.replace(',', '.'));
    if (!Number.isFinite(nTot) || nTot <= 0 || !Number.isInteger(nTot)) {
      alert('Total invalide (entier > 0) — abandon');
      return;
    }
    const rawLabel = window.prompt('Label du pack (défaut "Pack N") :', `Pack ${nTot}`);
    if (rawLabel == null) return;
    const label = String(rawLabel).trim() || `Pack ${nTot}`;
    const rawPrice = window.prompt('Prix du nouveau pack en CHF (optionnel) :', '');
    if (rawPrice == null) return;
    const priceStr = String(rawPrice).trim();
    let newPrice = null;
    if (priceStr !== '') {
      const p = Number(priceStr.replace(',', '.'));
      if (!Number.isFinite(p) || p < 0) { alert('Prix invalide — abandon'); return; }
      newPrice = p;
    }
    const rawPay = window.prompt('Paiement encaissé maintenant (CHF, optionnel) :', '');
    if (rawPay == null) return;
    const payStr = String(rawPay).trim();
    let initialPay = null;
    if (payStr !== '') {
      const v = Number(payStr.replace(',', '.'));
      if (!Number.isFinite(v) || v <= 0) { alert('Paiement invalide — abandon'); return; }
      initialPay = v;
    }
    const fresh = getClient(clientId);
    const existing = Array.isArray(fresh?.form?.benoitPayments) ? [...fresh.form.benoitPayments] : [];
    if (initialPay != null) {
      existing.push({
        at: new Date().toISOString(),
        amount: initialPay,
        note: `Paiement initial — ${label}`,
      });
    }
    // V25 : archiver l'ancien pack dans l'historique avant de le remplacer
    const prevTotal = Number(fresh?.form?.benoitSessionsTotal);
    const prevDone = Number(fresh?.form?.benoitSessionsDone);
    const prevLabel = fresh?.form?.benoitPackLabel;
    const prevPrice = getPackPrice(fresh);
    const packHistory = Array.isArray(fresh?.form?.benoitPackHistory) ? [...fresh.form.benoitPackHistory] : [];
    const hadPrevPack = (Number.isFinite(prevTotal) && prevTotal > 0) || !!prevLabel;
    if (hadPrevPack) {
      packHistory.push({
        label: prevLabel || 'Pack',
        total: Number.isFinite(prevTotal) && prevTotal > 0 ? prevTotal : null,
        done: Number.isFinite(prevDone) && prevDone > 0 ? prevDone : 0,
        price: prevPrice,
        startedAt: fresh?.form?.benoitPackStartedAt || fresh?.createdAt || null,
        endedAt: new Date().toISOString(),
      });
    }
    const pseudo = {
      ...fresh,
      form: {
        ...(fresh.form || {}),
        benoitPayments: existing,
        benoitPackPrice: newPrice != null ? newPrice : fresh.form?.benoitPackPrice,
      },
    };
    const nextAmountPaid = getTotalPaid(pseudo);
    const nextStatus = getPaymentStatus(pseudo);
    const mergedForm = {
      ...(fresh.form || {}),
      benoitPackLabel: label,
      benoitSessionsDone: 0,
      benoitSessionsTotal: nTot,
      benoitPackStartedAt: new Date().toISOString(),
      benoitPackHistory: packHistory,
      benoitPayments: existing,
      benoitAmountPaid: nextAmountPaid,
      benoitPaymentStatus: nextStatus,
    };
    if (newPrice != null) mergedForm.benoitPackPrice = newPrice;
    if (initialPay != null) mergedForm.benoitPaymentNote = `Paiement initial — ${label}`;
    saveClient({ id: fresh.id, form: mergedForm });
    if (typeof onRefresh === 'function') onRefresh();
  };

  // V17 : Ajouter séances au pack courant (prolongation) — déplacé depuis la card
  const handleAddSessions = () => {
    if (typeof window === 'undefined' || !window.prompt) return;
    const prenom = client.prenom || client.form?.prenom || 'client';
    const rawN = window.prompt(`Nombre de séances à ajouter pour ${prenom} :`, '');
    if (rawN == null) return;
    const nStr = String(rawN).trim();
    if (nStr === '') return;
    const nSess = Number(nStr.replace(',', '.'));
    if (!Number.isFinite(nSess) || nSess <= 0 || !Number.isInteger(nSess)) {
      alert('Nombre invalide (entier > 0) — abandon');
      return;
    }
    const rawAmt = window.prompt('Montant à ajouter au pack (CHF, optionnel) :', '');
    if (rawAmt == null) return;
    const amtStr = String(rawAmt).trim();
    let extraAmount = null;
    if (amtStr !== '') {
      const a = Number(amtStr.replace(',', '.'));
      if (!Number.isFinite(a) || a < 0) { alert('Montant invalide — abandon'); return; }
      extraAmount = a;
    }
    const fresh = getClient(clientId);
    const currentTotal = Number(fresh?.form?.benoitSessionsTotal) > 0 ? Number(fresh.form.benoitSessionsTotal) : 0;
    const currentDone = Number(fresh?.form?.benoitSessionsDone) > 0 ? Number(fresh.form.benoitSessionsDone) : 0;
    const currentPrice = getPackPrice(fresh);
    const newTotal = currentTotal + nSess;
    const mergedForm = {
      ...(fresh.form || {}),
      benoitSessionsTotal: newTotal,
      benoitSessionsDone: currentDone,
    };
    if (extraAmount != null) {
      mergedForm.benoitPackPrice = (currentPrice != null ? currentPrice : 0) + extraAmount;
    }
    saveClient({ id: fresh.id, form: mergedForm });
    if (typeof onRefresh === 'function') onRefresh();
  };

  // V22 : ajout d'un paiement via mini formulaire inline
  const handleAddPayment = () => {
    setFormError('');
    const amtStr = String(paymentAmount).trim();
    if (amtStr === '') { setFormError('Montant requis'); return; }
    const amount = Number(amtStr.replace(',', '.'));
    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError('Montant invalide (> 0)');
      return;
    }
    const note = String(paymentNote || '').trim() || null;
    const fresh = getClient(clientId);
    if (!fresh) return;
    // Seed lazy : si legacy V1 (benoitAmountPaid > 0) sans historique → créer une entrée historique
    const existing = Array.isArray(fresh?.form?.benoitPayments) ? [...fresh.form.benoitPayments] : [];
    if (existing.length === 0) {
      const legacyPaid = Number(fresh?.form?.benoitAmountPaid);
      if (Number.isFinite(legacyPaid) && legacyPaid > 0) {
        existing.push({
          at: fresh.updatedAt || fresh.createdAt || new Date().toISOString(),
          amount: legacyPaid,
          note: 'Encaissement historique (V1)',
        });
      }
    }
    // Append nouveau paiement
    existing.push({
      at: new Date().toISOString(),
      amount,
      note,
    });
    // Recalcul total + status via pseudo-client
    const pseudo = {
      ...fresh,
      form: { ...(fresh.form || {}), benoitPayments: existing },
    };
    const nextTotal = getTotalPaid(pseudo);
    const nextStatus = getPaymentStatus(pseudo);
    const mergedForm = {
      ...(fresh.form || {}),
      benoitPayments: existing,
      benoitAmountPaid: nextTotal != null ? nextTotal : null,
      benoitPaymentNote: note,
      benoitPaymentStatus: nextStatus,
    };
    saveClient({ id: fresh.id, form: mergedForm });
    // Reset form
    setPaymentAmount('');
    setPaymentNote('');
    if (typeof onRefresh === 'function') onRefresh();
  };

  // V23 : démarrer l'édition d'un paiement existant
  const handleStartEdit = (payment) => {
    setEditingAt(payment.at);
    setEditAmount(String(payment.amount ?? ''));
    setEditNote(payment.note || '');
    // Date au format YYYY-MM-DD pour input type="date"
    try {
      const iso = new Date(payment.at).toISOString().slice(0, 10);
      setEditDate(iso);
    } catch { setEditDate(''); }
    setEditError('');
  };

  const handleCancelEdit = () => {
    setEditingAt(null);
    setEditAmount('');
    setEditNote('');
    setEditDate('');
    setEditError('');
  };

  const handleSaveEdit = () => {
    setEditError('');
    const amtStr = String(editAmount).trim();
    if (amtStr === '') { setEditError('Montant requis'); return; }
    const amount = Number(amtStr.replace(',', '.'));
    if (!Number.isFinite(amount) || amount <= 0) {
      setEditError('Montant invalide (> 0)');
      return;
    }
    const note = String(editNote || '').trim() || null;
    // Date : si modifiée et valide, recompose l'ISO en préservant l'heure originale si possible
    let nextAt = editingAt;
    if (editDate) {
      try {
        const parsed = new Date(`${editDate}T00:00:00`);
        if (!isNaN(parsed.getTime())) {
          // Préserver l'heure originale si le jour ne change pas, sinon mettre midi par défaut
          const origDay = new Date(editingAt).toISOString().slice(0, 10);
          if (origDay !== editDate) {
            nextAt = parsed.toISOString();
          }
        }
      } catch { /* garde editingAt */ }
    }

    const fresh = getClient(clientId);
    if (!fresh) return;
    const source = Array.isArray(fresh?.form?.benoitPayments) ? fresh.form.benoitPayments : [];
    const nextPayments = source.map(p => {
      if (p?.at !== editingAt) return p;
      return { ...p, at: nextAt, amount, note };
    });
    // Recalcul via pseudo-client
    const pseudo = {
      ...fresh,
      form: { ...(fresh.form || {}), benoitPayments: nextPayments },
    };
    const nextTotal = getTotalPaid(pseudo);
    const nextStatus = getPaymentStatus(pseudo);
    // Note cache : dernière par date (plus récente)
    const sortedDesc = [...nextPayments].sort((a, b) => new Date(b?.at || 0) - new Date(a?.at || 0));
    const nextNoteCache = sortedDesc[0]?.note || null;

    const mergedForm = {
      ...(fresh.form || {}),
      benoitPayments: nextPayments,
      benoitAmountPaid: nextTotal != null ? nextTotal : null,
      benoitPaymentNote: nextNoteCache,
      benoitPaymentStatus: nextStatus,
    };
    saveClient({ id: fresh.id, form: mergedForm });
    handleCancelEdit();
    if (typeof onRefresh === 'function') onRefresh();
  };

  const handleDelete = (paymentAt) => {
    if (!window.confirm('Supprimer ce paiement ? Cette action est définitive.')) return;
    const fresh = getClient(clientId);
    const source = Array.isArray(fresh?.form?.benoitPayments) ? fresh.form.benoitPayments : [];
    const nextPayments = source.filter(p => p?.at !== paymentAt);
    // Somme directe (on ne veut PAS le fallback legacy quand on supprime explicitement)
    const nextTotal = nextPayments.reduce((s, p) => {
      const a = Number(p?.amount);
      return s + (Number.isFinite(a) && a >= 0 ? a : 0);
    }, 0);
    // Pour le statut : on propage le nouveau cache aligné dans le pseudo
    const pseudo = {
      ...fresh,
      form: { ...(fresh.form || {}), benoitPayments: nextPayments, benoitAmountPaid: nextTotal },
    };
    const nextStatus = getPaymentStatus(pseudo);
    // Note cache = dernière note restante (la plus récente par date), ou null
    const nextLast = nextPayments.length > 0
      ? [...nextPayments].sort((a, b) => new Date(b?.at || 0) - new Date(a?.at || 0))[0]
      : null;
    const nextNoteCache = nextLast?.note || null;
    const mergedForm = {
      ...(fresh.form || {}),
      benoitPayments: nextPayments,
      benoitAmountPaid: nextTotal,
      benoitPaymentNote: nextNoteCache,
      benoitPaymentStatus: nextStatus,
    };
    saveClient({ id: fresh.id, form: mergedForm });
    if (typeof onRefresh === 'function') onRefresh();
  };

  const { price, paid, status, remaining } = summary;
  const statusLabel = status ? BENOIT_PAYMENT_LABELS[status] : '—';
  const statusColor = status ? BENOIT_PAYMENT_COLORS[status] : null;

  return (
    <div className="benoit-payments-panel" style={{ padding: '16px 20px' }}>
      {/* V28 : warning si cache benoitAmountPaid diverge de la somme des paiements */}
      {(() => {
        const rawCache = Number(client?.form?.benoitAmountPaid);
        const cache = Number.isFinite(rawCache) ? rawCache : null;
        const arr = Array.isArray(client?.form?.benoitPayments) ? client.form.benoitPayments : [];
        if (arr.length === 0) return null;
        const sum = arr.reduce((s, p) => {
          const a = Number(p?.amount);
          return s + (Number.isFinite(a) && a >= 0 ? a : 0);
        }, 0);
        if (cache == null || Math.abs(cache - sum) < 0.01) return null;
        const handleFix = () => {
          const fresh = getClient(clientId);
          if (!fresh) return;
          const pseudo = { ...fresh, form: { ...(fresh.form || {}) } };
          const nextStatus = getPaymentStatus({ ...pseudo, form: { ...pseudo.form, benoitAmountPaid: sum } });
          saveClient({
            id: fresh.id,
            form: { ...(fresh.form || {}), benoitAmountPaid: sum, benoitPaymentStatus: nextStatus },
          });
          if (typeof onRefresh === 'function') onRefresh();
        };
        return (
          <div style={{
            marginBottom: 12, padding: 10, borderRadius: 8,
            background: 'rgba(196,160,80,0.1)',
            border: '1px solid rgba(196,160,80,0.35)',
            fontSize: '.8em',
            display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
          }}>
            <span style={{ color: '#c4a050', flex: 1 }}>
              ⚠ Incohérence détectée : cache = <strong>{cache} CHF</strong> mais somme réelle = <strong>{sum} CHF</strong>.
            </span>
            <button
              type="button"
              onClick={handleFix}
              style={{
                padding: '6px 12px', borderRadius: 6,
                background: '#c4a050', border: 'none', color: '#1e1b16',
                fontWeight: 700, cursor: 'pointer', fontSize: '.9em',
              }}
            >Corriger</button>
          </div>
        );
      })()}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text)' }}>💰 Paiements</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={handleNewPack}
            title="Démarrer un nouveau pack (remet done à 0, remplace label/prix, paiement initial optionnel)"
            style={{ fontSize: '.8rem', padding: '6px 12px' }}
          >
            🆕 Nouveau pack
          </button>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={handleAddSessions}
            title="Ajouter N séances au pack courant (done inchangé, prix optionnel à ajouter)"
            style={{ fontSize: '.8rem', padding: '6px 12px' }}
          >
            ➕ Ajouter séances
          </button>
        </div>
      </div>

      {/* Résumé */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
        gap: 10, marginBottom: 16,
      }}>
        <SummaryCard label="Prix pack" value={price != null ? `${price} CHF` : '—'} />
        <SummaryCard
          label="Total encaissé"
          value={paid != null ? `${paid} CHF` : '—'}
          sub={payments.length > 0 ? `${payments.length} paiement${payments.length > 1 ? 's' : ''}` : null}
        />
        <SummaryCard label="Reste" value={remaining != null ? `${remaining} CHF` : '—'} highlight={remaining === 0 ? 'ok' : (remaining != null && remaining > 0 ? 'warn' : null)} />
        <SummaryCard
          label="Statut"
          value={statusLabel}
          color={statusColor}
        />
      </div>

      {/* V22 : mini formulaire inline pour ajouter un paiement */}
      <div style={{
        marginTop: 16,
        padding: 14,
        border: '1px solid rgba(196,160,80,0.2)',
        borderRadius: 10,
        background: 'rgba(196,160,80,0.04)',
      }}>
        <div style={{ fontSize: '.85rem', color: '#c4a050', fontWeight: 600, marginBottom: 10 }}>
          ➕ Ajouter un paiement
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            type="number"
            inputMode="decimal"
            value={paymentAmount}
            onChange={e => { setPaymentAmount(e.target.value); if (formError) setFormError(''); }}
            placeholder="Montant (CHF)"
            style={{
              width: '100%', minHeight: 44,
              padding: '10px 12px',
              borderRadius: 8,
              border: '1px solid rgba(196,160,80,0.3)',
              background: 'rgba(0,0,0,0.25)',
              color: 'var(--text)',
              fontSize: '.95rem',
            }}
          />
          <input
            type="text"
            value={paymentNote}
            onChange={e => setPaymentNote(e.target.value)}
            placeholder="Note (optionnel)"
            style={{
              width: '100%', minHeight: 44,
              padding: '10px 12px',
              borderRadius: 8,
              border: '1px solid rgba(196,160,80,0.3)',
              background: 'rgba(0,0,0,0.25)',
              color: 'var(--text)',
              fontSize: '.95rem',
            }}
            onKeyDown={e => { if (e.key === 'Enter') handleAddPayment(); }}
          />
          {formError && (
            <div style={{ color: '#c43050', fontSize: '.8em', padding: '0 4px' }}>
              {formError}
            </div>
          )}
          <button
            type="button"
            onClick={handleAddPayment}
            style={{
              width: '100%', minHeight: 44,
              padding: '10px 16px',
              borderRadius: 8,
              background: '#c4a050',
              border: '1px solid #c4a050',
              color: '#1e1b16',
              fontWeight: 700,
              fontSize: '.95rem',
              cursor: 'pointer',
            }}
          >
            Ajouter
          </button>
        </div>
      </div>

      {/* Historique */}
      <div style={{ marginTop: 8 }}>
        <div style={{ fontSize: '.85rem', color: 'var(--text-muted)', marginBottom: 8 }}>
          {payments.length === 0
            ? 'Aucun paiement enregistré.'
            : `Historique (${payments.length} ${payments.length > 1 ? 'paiements' : 'paiement'})`}
        </div>
        {payments.length > 0 && (
          <div style={{
            display: 'flex', flexDirection: 'column', gap: 6,
            border: '1px solid rgba(196,160,80,0.15)', borderRadius: 8,
            padding: 8, background: 'rgba(196,160,80,0.04)',
          }}>
            {payments.map(p => {
              const isEditing = editingAt === p.at;
              if (isEditing) {
                // V23 : mini formulaire d'édition inline (remplace la ligne)
                return (
                  <div
                    key={p.at || Math.random()}
                    style={{
                      display: 'flex', flexDirection: 'column', gap: 8,
                      padding: 10, borderRadius: 8,
                      background: 'rgba(196,160,80,0.08)',
                      border: '1px solid rgba(196,160,80,0.35)',
                    }}
                  >
                    <div style={{ fontSize: '.75em', color: '#c4a050', fontWeight: 600 }}>
                      ✏️ Modifier le paiement
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <input
                        type="date"
                        value={editDate}
                        onChange={e => setEditDate(e.target.value)}
                        style={{
                          minHeight: 40, padding: '8px 10px', borderRadius: 6,
                          border: '1px solid rgba(196,160,80,0.3)',
                          background: 'rgba(0,0,0,0.25)', color: 'var(--text)',
                          fontSize: '.85em', minWidth: 130,
                        }}
                      />
                      <input
                        type="number"
                        inputMode="decimal"
                        value={editAmount}
                        onChange={e => { setEditAmount(e.target.value); if (editError) setEditError(''); }}
                        placeholder="Montant (CHF)"
                        style={{
                          flex: 1, minWidth: 110, minHeight: 40,
                          padding: '8px 10px', borderRadius: 6,
                          border: '1px solid rgba(196,160,80,0.3)',
                          background: 'rgba(0,0,0,0.25)', color: 'var(--text)',
                          fontSize: '.9em',
                        }}
                      />
                    </div>
                    <input
                      type="text"
                      value={editNote}
                      onChange={e => setEditNote(e.target.value)}
                      placeholder="Note (optionnel)"
                      onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(); if (e.key === 'Escape') handleCancelEdit(); }}
                      style={{
                        minHeight: 40, padding: '8px 10px', borderRadius: 6,
                        border: '1px solid rgba(196,160,80,0.3)',
                        background: 'rgba(0,0,0,0.25)', color: 'var(--text)',
                        fontSize: '.9em',
                      }}
                    />
                    {editError && (
                      <div style={{ color: '#c43050', fontSize: '.78em' }}>{editError}</div>
                    )}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        style={{
                          flex: 1, minHeight: 40, padding: '8px', borderRadius: 6,
                          background: 'transparent', border: '1px solid rgba(212,201,168,0.3)',
                          color: 'var(--text-muted)', fontSize: '.85em', cursor: 'pointer',
                        }}
                      >Annuler</button>
                      <button
                        type="button"
                        onClick={handleSaveEdit}
                        style={{
                          flex: 2, minHeight: 40, padding: '8px', borderRadius: 6,
                          background: '#c4a050', border: '1px solid #c4a050',
                          color: '#1e1b16', fontWeight: 700, fontSize: '.85em', cursor: 'pointer',
                        }}
                      >✓ Enregistrer</button>
                    </div>
                  </div>
                );
              }
              return (
                <div
                  key={p.at || Math.random()}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '6px 8px', borderRadius: 6,
                    background: 'rgba(0,0,0,0.15)',
                  }}
                >
                  <span style={{ minWidth: 90, color: 'var(--text-muted)', fontSize: '.85em' }}>
                    {formatDate(p.at)}
                  </span>
                  <span style={{ minWidth: 80, color: '#c4a050', fontWeight: 600 }}>
                    {Number(p.amount) || 0} CHF
                  </span>
                  <span style={{
                    flex: 1, fontSize: '.85em', color: 'rgba(212,201,168,0.75)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }} title={p.note || ''}>
                    {p.note || ''}
                  </span>
                  <button
                    type="button"
                    className="btn btn-xs btn-secondary"
                    onClick={() => handleStartEdit(p)}
                    title="Modifier ce paiement"
                    style={{ fontSize: '.7em', padding: '2px 6px' }}
                    disabled={editingAt !== null}
                  >
                    ✏️
                  </button>
                  <button
                    type="button"
                    className="btn btn-xs btn-danger"
                    onClick={() => handleDelete(p.at)}
                    title="Supprimer ce paiement (définitif)"
                    style={{ fontSize: '.7em', padding: '2px 6px' }}
                    disabled={editingAt !== null}
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* V27 : Timeline paiements mensuels (mini barchart inline SVG) */}
      {payments.length > 0 && (() => {
        // Regrouper par YYYY-MM
        const byMonth = new Map();
        for (const p of payments) {
          const d = new Date(p?.at || 0);
          if (isNaN(d.getTime())) continue;
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          const a = Number(p?.amount);
          if (!Number.isFinite(a) || a < 0) continue;
          byMonth.set(key, (byMonth.get(key) || 0) + a);
        }
        if (byMonth.size === 0) return null;
        // Derniers 6 mois (incluant mois vides)
        const now = new Date();
        const months = [];
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          months.push({
            key,
            label: d.toLocaleDateString('fr-CH', { month: 'short' }),
            amount: byMonth.get(key) || 0,
          });
        }
        const maxAmount = Math.max(...months.map(m => m.amount), 1);
        return (
          <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: '.85em', color: 'var(--text-muted)', marginBottom: 8 }}>
              Encaissements 6 derniers mois
            </div>
            <div style={{
              display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
              gap: 6, height: 90, padding: 10, borderRadius: 8,
              border: '1px solid rgba(196,160,80,0.15)',
              background: 'rgba(196,160,80,0.04)',
            }}>
              {months.map(m => {
                const pct = maxAmount > 0 ? (m.amount / maxAmount) * 100 : 0;
                return (
                  <div key={m.key} style={{
                    flex: 1, display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'flex-end', gap: 4,
                    height: '100%',
                  }} title={`${m.label} : ${m.amount} CHF`}>
                    <span style={{ fontSize: '.65em', color: '#c4a050', fontWeight: 600 }}>
                      {m.amount > 0 ? `${m.amount}` : ''}
                    </span>
                    <div style={{
                      width: '80%',
                      height: `${Math.max(pct, m.amount > 0 ? 8 : 2)}%`,
                      background: m.amount > 0 ? '#c4a050' : 'rgba(212,201,168,0.15)',
                      borderRadius: '4px 4px 0 0',
                      transition: 'height 0.3s',
                    }} />
                    <span style={{ fontSize: '.7em', color: 'var(--text-muted)' }}>
                      {m.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* V25 : Historique des packs */}
      {(() => {
        const history = Array.isArray(client?.form?.benoitPackHistory) ? client.form.benoitPackHistory : [];
        if (history.length === 0) return null;
        const sorted = [...history].sort((a, b) => new Date(b?.endedAt || 0) - new Date(a?.endedAt || 0));
        return (
          <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: '.85em', color: 'var(--text-muted)', marginBottom: 8 }}>
              Historique des packs ({history.length})
            </div>
            <div style={{
              display: 'flex', flexDirection: 'column', gap: 6,
              border: '1px solid rgba(154,180,208,0.15)', borderRadius: 8,
              padding: 8, background: 'rgba(154,180,208,0.04)',
            }}>
              {sorted.map((h, idx) => {
                const range = `${h.startedAt ? formatDate(h.startedAt) : '—'} → ${h.endedAt ? formatDate(h.endedAt) : '—'}`;
                const count = (h.total && h.total > 0) ? `${h.done || 0}/${h.total} séances` : `${h.done || 0} séances`;
                const price = (h.price != null && h.price > 0) ? ` · ${h.price} CHF` : '';
                return (
                  <div key={idx} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '6px 8px', borderRadius: 6,
                    background: 'rgba(0,0,0,0.15)',
                  }}>
                    <span style={{ minWidth: 90, color: 'var(--text-muted)', fontSize: '.8em' }}>
                      {range}
                    </span>
                    <span style={{ color: '#9ab4d0', fontWeight: 600, fontSize: '.9em' }}>
                      {h.label || 'Pack'}
                    </span>
                    <span style={{ flex: 1, color: 'var(--text-muted)', fontSize: '.8em', textAlign: 'right' }}>
                      {count}{price}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function SummaryCard({ label, value, color, highlight, sub }) {
  let border = '1px solid rgba(196,160,80,0.15)';
  let bg = 'rgba(196,160,80,0.05)';
  let fg = 'var(--text)';
  if (color) { bg = color.bg; fg = color.fg; border = `1px solid ${color.border}`; }
  if (highlight === 'ok') { fg = '#2e8b57'; }
  if (highlight === 'warn') { fg = '#c4a050'; }
  return (
    <div style={{ padding: 10, borderRadius: 8, background: bg, border }}>
      <div style={{ fontSize: '.75em', color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: '.95rem', fontWeight: 600, color: fg }}>{value}</div>
      {sub && <div style={{ fontSize: '.7em', color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}
