// Helpers paiement Benoit — source de vérité partagée entre Dashboard.jsx et
// BenoitPaymentsPanel.jsx. Extraction 1:1 des fonctions pures existantes pour
// éviter toute divergence de logique.

export const BENOIT_PAYMENT_STATUSES = ['pending', 'partial', 'paid'];
export const BENOIT_PAYMENT_LABELS = {
  pending: '⏳ En attente',
  partial: '◐ Partiel',
  paid:    '✓ Payé',
};
export const BENOIT_PAYMENT_COLORS = {
  pending: { bg: '#c4305022', fg: '#c43050', border: '#c4305055' },
  partial: { bg: '#c4a05022', fg: '#c4a050', border: '#c4a05055' },
  paid:    { bg: '#2e8b5722', fg: '#2e8b57', border: '#2e8b5755' },
};

// Backward-compat V6 : 'paye'/'partiel'/'attente' → 'paid'/'partial'/'pending'
export function normalizeLegacyPaymentStatus(s) {
  if (typeof s !== 'string') return null;
  const low = s.trim().toLowerCase();
  if (BENOIT_PAYMENT_STATUSES.includes(low)) return low;
  if (low === 'paye') return 'paid';
  if (low === 'partiel') return 'partial';
  if (low === 'attente') return 'pending';
  return null;
}

export function getAmountPaid(client) {
  const raw = client?.form?.benoitAmountPaid;
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function getPackPrice(client) {
  const raw = client?.form?.benoitPackPrice;
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

// V11 : somme de benoitPayments si existe, fallback benoitAmountPaid
export function getTotalPaid(client) {
  const payments = client?.form?.benoitPayments;
  if (Array.isArray(payments) && payments.length > 0) {
    return payments.reduce((s, p) => {
      const a = Number(p?.amount);
      return s + (Number.isFinite(a) && a >= 0 ? a : 0);
    }, 0);
  }
  return getAmountPaid(client);
}

// V11 : auto-calculé à partir du prix pack + total encaissé
export function getPaymentStatus(client) {
  const price = getPackPrice(client);
  const paid = getTotalPaid(client);
  if (price != null && price > 0) {
    if (paid != null && paid >= price) return 'paid';
    if (paid != null && paid > 0 && paid < price) return 'partial';
    return 'pending';
  }
  return normalizeLegacyPaymentStatus(client?.form?.benoitPaymentStatus);
}
