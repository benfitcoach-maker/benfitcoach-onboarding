import { FORMULES } from './formSteps';

const MAX_FORMULES = ['intensif', 'inperson'];

function weeksSince(iso) {
  if (!iso) return Infinity;
  return Math.floor((Date.now() - new Date(iso).getTime()) / (7 * 24 * 60 * 60 * 1000));
}

function monthsSince(iso) {
  if (!iso) return 0;
  return Math.floor((Date.now() - new Date(iso).getTime()) / (30.44 * 24 * 60 * 60 * 1000));
}

export default function ClientAlerts({ client }) {
  if (!client) return null;

  const alerts = [];

  // Program update alert (> 6 weeks since last generation)
  const lastGen = client.history?.[0]?.date;
  const weeksSinceGen = weeksSince(lastGen);
  if (lastGen && weeksSinceGen > 6) {
    alerts.push({
      type: 'warning',
      text: `Pas de mise a jour programme depuis ${weeksSinceGen} semaines`,
    });
  }

  // Upsell potential (> 3 months and not max formule)
  const monthsActive = monthsSince(client.createdAt);
  if (monthsActive > 3 && !MAX_FORMULES.includes(client.formule)) {
    const formule = FORMULES[client.formule]?.nom || client.formule;
    alerts.push({
      type: 'info',
      text: `Client actif depuis ${monthsActive} mois (${formule}) — potentiel upsell`,
    });
  }

  // Check-in missing (> 2 weeks since last update)
  const weeksSinceUpdate = weeksSince(client.updatedAt);
  if (weeksSinceUpdate > 2) {
    alerts.push({
      type: 'danger',
      text: `Check-in manquant (derniere activite il y a ${weeksSinceUpdate} semaines)`,
    });
  }

  if (alerts.length === 0) return null;

  return (
    <div className="client-alerts">
      {alerts.map((a, i) => (
        <div key={i} className={`alert alert-${a.type}`}>
          <span className="alert-icon">
            {a.type === 'danger' ? '!' : a.type === 'warning' ? '~' : 'i'}
          </span>
          {a.text}
        </div>
      ))}
    </div>
  );
}
