// ─── ClientEngagementBadge ────────────────────────────────────────────
// Badge "X/7" affiché à côté du ClientStatusBadge dans la liste clientes.
// Mesure l'engagement de la cliente sur les 7 derniers jours = nb de
// ressentis envoyés via l'app cliente.
//
// Utile pour qu'Anissa repère d'un coup d'œil :
//   - Qui décroche (0/7) → besoin d'une relance
//   - Qui est régulière (5+/7) → pas besoin d'attention immédiate
//
// Stratégie d'affichage :
//   - Pas affiché si status === "absent" ou "invited" (pas pertinent —
//     la cliente n'a pas encore d'app activée OU jamais loginée)
//   - Couleur graduée selon le compte : gris < ambre < vert
//   - Tooltip natif explique la métrique
//
// Réutilise fetchClientsStatus (cache 60s commun avec ClientStatusBadge,
// donc pas de double appel HTTP).

import { useEffect, useState } from "react";
import { fetchClientsStatus } from "./services/fetchClientsStatus";

function colorFor(count) {
  // Palette cohérente avec les autres badges du SaaS (vert/ambre/gris)
  if (count >= 5) return { bg: "rgba(106,191,138,.18)", border: "rgba(106,191,138,.4)",  color: "#82c39e", tip: "Régulière" };
  if (count >= 3) return { bg: "rgba(160,200,140,.14)", border: "rgba(160,200,140,.32)", color: "#a8c994", tip: "Engagement correct" };
  if (count >= 1) return { bg: "rgba(220,180,80,.12)",  border: "rgba(220,180,80,.30)",  color: "#e5c878", tip: "Engagement faible" };
  return            { bg: "rgba(255,255,255,.04)",      border: "rgba(255,255,255,.10)", color: "#8a8a7a", tip: "Aucun ressenti envoyé sur 7j" };
}

export default function ClientEngagementBadge({ email }) {
  const [entry, setEntry] = useState(null); // { status, feedbacks_7d_count, ... } | null

  useEffect(() => {
    let cancelled = false;
    if (!email) return;
    fetchClientsStatus([email]).then((map) => {
      if (cancelled) return;
      setEntry(map[email.toLowerCase()] || null);
    });
    return () => { cancelled = true; };
  }, [email]);

  if (!entry) return null;
  // Pas pertinent pour les clientes pas encore actives
  if (entry.status === "absent" || entry.status === "invited") return null;

  const count = entry.feedbacks_7d_count ?? 0;
  const meta = colorFor(count);

  return (
    <span
      title={`${meta.tip} — ${count} ressenti${count > 1 ? "s" : ""} sur 7 jours`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        fontSize: ".68rem",
        fontWeight: 600,
        padding: "2px 8px",
        borderRadius: 99,
        background: meta.bg,
        border: `1px solid ${meta.border}`,
        color: meta.color,
        whiteSpace: "nowrap",
        verticalAlign: "middle",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {count}/7
    </span>
  );
}
