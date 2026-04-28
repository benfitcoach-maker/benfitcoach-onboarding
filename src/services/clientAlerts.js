// V94.15 : agrégateur d'alertes/actions à faire pour Anissa.
// Parcourt les clients + consultations + feedbacks et retourne une liste
// d'actions prioritaires triées par urgence.

import { getClients, getNutritionConsultations } from '../store';

const DAY = 1000 * 60 * 60 * 24;

function daysSince(iso) {
  if (!iso) return Infinity;
  return Math.floor((Date.now() - new Date(iso).getTime()) / DAY);
}

/**
 * Calcule les alertes pour un client donne. Retourne un array d'objets :
 * { level: 'danger' | 'warning' | 'info' | 'success',
 *   icon: emoji court,
 *   label: phrase courte,
 *   clientId,
 *   prenom,
 *   priority: number (plus grand = plus urgent) }
 */
export function computeClientAlerts(client) {
  const alerts = [];
  const consultations = getNutritionConsultations(client.id);
  const last = consultations[0];
  const prenom = client.prenom || client.form?.prenom || 'Sans nom';

  if (consultations.length === 0) {
    // Pas de consultation : si client cree il y a > 7j sans suite → relance
    const createdDays = daysSince(client.createdAt);
    if (createdDays > 7 && createdDays < Infinity) {
      alerts.push({
        level: 'warning',
        icon: '\ud83d\udcdd',
        label: `${prenom} : aucune consultation depuis création (${createdDays}j)`,
        clientId: client.id,
        prenom,
        priority: 50 + Math.min(createdDays, 60),
      });
    }
    return alerts;
  }

  const since = daysSince(last.date);

  // Pas de news depuis longtemps
  if (since > 90) {
    alerts.push({
      level: 'danger',
      icon: '\u26a0\ufe0f',
      label: `${prenom} : pas de news depuis ${Math.floor(since/30)} mois — relance ?`,
      clientId: client.id,
      prenom,
      priority: 200 + since,
    });
  } else if (since > 60) {
    alerts.push({
      level: 'warning',
      icon: '\ud83d\udd14',
      label: `${prenom} : 2 mois depuis dernière conso, suivi recommandé`,
      clientId: client.id,
      prenom,
      priority: 100 + since,
    });
  }

  // Bilan S4 (4 semaines = 28 jours) post dernière conso non-suivi
  const isInitial = !last.isFollowup;
  if (isInitial && since >= 25 && since <= 35) {
    alerts.push({
      level: 'info',
      icon: '\ud83d\udcca',
      label: `${prenom} : bilan S4 à envoyer (${since}j depuis plan initial)`,
      clientId: client.id,
      prenom,
      priority: 80,
    });
  }

  return alerts;
}

/**
 * Aggrege les alertes de tous les clients, triees par priorite descendante.
 * @param {number} limit - nombre max d'alertes a retourner (top N)
 */
export function getAllClientAlerts(limit = 8) {
  const clients = getClients();
  const all = [];
  for (const c of clients) {
    const alerts = computeClientAlerts(c);
    all.push(...alerts);
  }
  all.sort((a, b) => b.priority - a.priority);
  return all.slice(0, limit);
}
