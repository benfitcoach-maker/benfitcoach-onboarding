// V94.15 : agrégateur d'alertes/actions à faire pour Anissa.
// Parcourt les clients + consultations + feedbacks et retourne une liste
// d'actions prioritaires triées par urgence.
// V94.23 : ajout des alertes pack steps (Bilan S4/S8/S12 dus selon planning).

import { getClients, getNutritionConsultations } from '../store';
import { getNextPendingStep } from './packSystem';

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

  // V94.23 : alerte pack step (Bilan S4/S8/S12 selon le planning du pack client)
  // Plus precis et generique que l ancien check S4 brut, supporte tous les packs.
  try {
    const nextStep = getNextPendingStep(client);
    if (nextStep && nextStep.type === 'review') {
      const dueDate = new Date(nextStep.dueDate);
      const daysUntilDue = Math.floor((dueDate.getTime() - Date.now()) / DAY);

      if (nextStep.isLate) {
        // Etape passee non realisee
        const daysLate = -daysUntilDue;
        alerts.push({
          level: 'danger',
          icon: '\u23f0',
          label: `${prenom} : ${nextStep.label} EN RETARD (${daysLate}j)`,
          clientId: client.id,
          prenom,
          priority: 250 + daysLate,
        });
      } else if (daysUntilDue <= 0) {
        // Du aujourd hui
        alerts.push({
          level: 'warning',
          icon: '\ud83d\udcc5',
          label: `${prenom} : ${nextStep.label} dû aujourd'hui`,
          clientId: client.id,
          prenom,
          priority: 180,
        });
      } else if (daysUntilDue <= 3) {
        // Du dans <= 3 jours
        alerts.push({
          level: 'warning',
          icon: '\ud83d\udd14',
          label: `${prenom} : ${nextStep.label} dans ${daysUntilDue}j`,
          clientId: client.id,
          prenom,
          priority: 150,
        });
      } else if (daysUntilDue <= 7) {
        // Du dans la semaine
        alerts.push({
          level: 'info',
          icon: '\ud83d\udcc6',
          label: `${prenom} : ${nextStep.label} dans ${daysUntilDue}j`,
          clientId: client.id,
          prenom,
          priority: 100,
        });
      }
    }
  } catch {
    // Pack system non configure pour ce client : on ignore
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
