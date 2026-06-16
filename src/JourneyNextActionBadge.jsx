// ─── JourneyNextActionBadge ─────────────────────────────────────────────
// V97.36 — 4e pastille (cockpit Anissa) : « prochaine action fiable ».
//
// Affiche le résultat du Journey Resolver V1 (services/journeyResolver) :
// une action dérivée des faits déjà chargés (form + journey_state côté SaaS
// + statusEntry côté app via clients-status). LECTURE SEULE, additif.
//
//   - Chip discrète portant le label de next_action_anissa.
//   - ⚠ accolé si des divergences SaaS↔app sont détectées (tooltip = détails).
//   - Opacité réduite quand confidence === 'low' (signal « à vérifier »).
//   - Masquée quand next_action === 'none' (cliente supprimée → rien à montrer).
//
// Ne remplace JAMAIS les badges existants (connexion / plan / engagement /
// feedbacks). Se contente de répondre « quoi faire ensuite ? » pour Anissa.

import { useEffect, useState } from "react";
import { fetchClientsStatus } from "./services/fetchClientsStatus";
import { resolveJourney, extractJourneyFacts } from "./services/journeyResolver";

// Palette par clé d'action. Tons sobres, alignés sur le reste du cockpit.
const ACTION_META = {
  await_questionnaire: { bg: "rgba(220,180,80,.12)", border: "rgba(220,180,80,.3)", color: "#e5c878" },
  schedule_rdv: { bg: "rgba(120,160,220,.15)", border: "rgba(120,160,220,.35)", color: "#9bbed8" },
  conduct_rdv: { bg: "rgba(120,160,220,.15)", border: "rgba(120,160,220,.35)", color: "#9bbed8" },
  prepare_plan: { bg: "rgba(106,191,138,.15)", border: "rgba(106,191,138,.35)", color: "#82c39e" },
  followup: { bg: "rgba(106,191,138,.18)", border: "rgba(106,191,138,.4)", color: "#82c39e" },
  unknown: { bg: "rgba(255,255,255,.04)", border: "rgba(255,255,255,.1)", color: "#8a8a7a" },
  none: { bg: "rgba(255,255,255,.04)", border: "rgba(255,255,255,.1)", color: "#8a8a7a" },
};

function divergencesTip(divergences) {
  if (!divergences || divergences.length === 0) return null;
  return (
    "Divergences SaaS ↔ app :\n" +
    divergences.map((d) => `• [${d.severity}] ${d.detail}`).join("\n")
  );
}

export default function JourneyNextActionBadge({ client, email, stagingClientId = null }) {
  const [statusEntry, setStatusEntry] = useState(undefined); // undefined = loading

  useEffect(() => {
    let cancelled = false;
    if (!email && !stagingClientId) {
      setStatusEntry(null);
      return;
    }
    fetchClientsStatus([{ email, stagingClientId }]).then((map) => {
      if (cancelled) return;
      const key = stagingClientId ? `id:${stagingClientId}` : email?.toLowerCase();
      setStatusEntry((key ? map[key] : null) || null);
    });
    return () => {
      cancelled = true;
    };
  }, [email, stagingClientId]);

  if (statusEntry === undefined) return null; // pas de placeholder (évite le flash)

  // Resolver pur : faits déjà chargés, aucune nouvelle requête.
  const facts = extractJourneyFacts({ client, statusEntry });
  const resolution = resolveJourney(facts);
  const action = resolution.next_action_anissa;

  if (action.key === "none") return null; // cliente supprimée → rien à afficher

  const meta = ACTION_META[action.key] || ACTION_META.unknown;
  const hasDivergences = resolution.divergences.length > 0;
  const lowConfidence = resolution.confidence === "low";

  const tipParts = [`Prochaine action : ${action.label}`, `Confiance : ${resolution.confidence}`];
  const divTip = divergencesTip(resolution.divergences);
  if (divTip) tipParts.push(divTip);
  const tip = tipParts.join("\n");

  return (
    <span
      title={tip}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize: ".68rem",
        fontWeight: 600,
        padding: "2px 8px",
        borderRadius: 99,
        background: meta.bg,
        border: `1px solid ${meta.border}`,
        color: meta.color,
        whiteSpace: "nowrap",
        verticalAlign: "middle",
        opacity: lowConfidence ? 0.55 : 1,
      }}
    >
      <span aria-hidden style={{ width: 6, height: 6, borderRadius: "50%", background: meta.color }} />
      {action.label}
      {hasDivergences && (
        <span aria-hidden title={divTip || undefined} style={{ marginLeft: 2 }}>
          ⚠
        </span>
      )}
    </span>
  );
}
