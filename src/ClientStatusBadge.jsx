// ─── ClientStatusBadge ─────────────────────────────────────────────────
// Badge "Invitée / Connectée / Active / Hors app" affiché à côté du nom
// de chaque cliente dans la liste du dashboard Anissa.
//
// Auto-fetch via fetchClientsStatus (cache 60s côté service → multiples
// rendus simultanés ne re-fetchent pas l'email déjà connu).
//
// V97.35 : DEUX pastilles distinctes, jamais fusionnées.
//   Pastille 1 = CONNEXION/engagement (Invitée / Connectée / Active / Hors
//     app). Dérivée de `status`. Ne dit RIEN sur la publication du plan.
//   Pastille 2 = VÉRITÉ PLAN (Visible dans l'app / Programmé pour le … /
//     Non visible / Compte non activé / Statut inconnu). Dérivée des champs
//     plan_visible / visible_now / reason_if_not_visible renvoyés par
//     clients-status (source unique lib/plan-visibility côté app cliente).
//   La pastille 2 est masquée quand status === "absent" (pas de compte app
//     → la question "plan visible ?" n'a pas de sens à afficher).
//
// Aucun graph, aucun scoring, aucune action.

import { useEffect, useState } from "react";
import { fetchClientsStatus } from "./services/fetchClientsStatus";

const META = {
  active: {
    label: "Active",
    bg: "rgba(106,191,138,.18)",
    border: "rgba(106,191,138,.4)",
    color: "#82c39e",
    tip: "Activité dans les 7 derniers jours",
  },
  connected: {
    label: "Connectée",
    bg: "rgba(120,160,220,.15)",
    border: "rgba(120,160,220,.35)",
    color: "#9bbed8",
    tip: "S'est connectée mais aucune activité récente — à relancer",
  },
  invited: {
    label: "Invitée",
    bg: "rgba(220,180,80,.12)",
    border: "rgba(220,180,80,.3)",
    color: "#e5c878",
    tip: "Plan publié mais cliente jamais connectée",
  },
  absent: {
    label: "Hors app",
    bg: "rgba(255,255,255,.04)",
    border: "rgba(255,255,255,.1)",
    color: "#8a8a7a",
    tip: "L'espace app de cette cliente n'est pas activé",
  },
};

// V97.35 : palette de la pastille 2 (vérité plan). Indépendante de META.
const PLAN_META = {
  visible: {
    label: "Visible dans l'app",
    bg: "rgba(106,191,138,.18)",
    border: "rgba(106,191,138,.4)",
    color: "#82c39e",
    tip: "Le plan est publié et la cliente le voit dans son app",
  },
  scheduled: {
    label: "Programmé",
    bg: "rgba(120,160,220,.15)",
    border: "rgba(120,160,220,.35)",
    color: "#9bbed8",
    tip: "Plan publié, deviendra visible à sa date d'effet",
  },
  hidden: {
    label: "Non visible",
    bg: "rgba(255,255,255,.04)",
    border: "rgba(255,255,255,.1)",
    color: "#8a8a7a",
    tip: "Aucun plan publié visible pour cette cliente",
  },
  account_off: {
    label: "Compte non activé",
    bg: "rgba(220,140,120,.12)",
    border: "rgba(220,140,120,.3)",
    color: "#d9a08f",
    tip: "L'espace app de la cliente est désactivé ou supprimé",
  },
  unknown: {
    label: "Statut inconnu",
    bg: "rgba(255,255,255,.04)",
    border: "rgba(255,255,255,.1)",
    color: "#8a8a7a",
    tip: "Impossible de déterminer la visibilité du plan pour l'instant",
  },
};

// Mappe l'entrée enrichie (clients-status) vers une clé PLAN_META + une date
// optionnelle à afficher (pour "Programmé pour le …"). Fail-closed : tout ce
// qui n'est pas explicitement "visible/programmé" reste prudent.
function planPastilleFor(entry) {
  if (!entry || typeof entry !== "object") return { key: "unknown" };
  const reason = entry.reason_if_not_visible;
  if (entry.visible_now === true) return { key: "visible" };
  if (entry.plan_visible === true && reason === "scheduled_future") {
    return { key: "scheduled", date: entry.effective_at || null };
  }
  if (reason === "account_disabled" || reason === "account_deleted") {
    return { key: "account_off" };
  }
  if (reason === "no_plan" || reason === "draft_only") return { key: "hidden" };
  // reason null sans visible_now (réponse partielle / backend ancien) → on ne
  // ment pas : statut inconnu plutôt qu'une fausse certitude.
  return { key: "unknown" };
}

function fmtDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("fr-CH", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function Pill({ meta, label, tip }) {
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
      }}
    >
      <span
        aria-hidden
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: meta.color,
        }}
      />
      {label}
    </span>
  );
}

export default function ClientStatusBadge({ email, stagingClientId = null }) {
  const [entry, setEntry] = useState(undefined); // undefined = loading

  useEffect(() => {
    let cancelled = false;
    if (!email && !stagingClientId) {
      setEntry(null);
      return;
    }
    fetchClientsStatus([{ email, stagingClientId }]).then((map) => {
      if (cancelled) return;
      const key = stagingClientId
        ? `id:${stagingClientId}`
        : email?.toLowerCase();
      setEntry((key ? map[key] : null) || null);
    });
    return () => { cancelled = true; };
  }, [email, stagingClientId]);

  if (entry === undefined) return null; // pas de placeholder visuel pour éviter le flash

  const status = entry?.status || "absent";
  const meta = META[status] || META.absent;

  // Pastille 2 : masquée quand pas de compte app (status absent).
  let planPill = null;
  if (status !== "absent") {
    const { key, date } = planPastilleFor(entry);
    const pmeta = PLAN_META[key] || PLAN_META.unknown;
    let label = pmeta.label;
    let tip = pmeta.tip;
    if (key === "scheduled") {
      const d = fmtDate(date);
      if (d) {
        label = `Programmé pour le ${d}`;
        tip = `Plan publié, visible pour la cliente à partir du ${d}`;
      }
    }
    planPill = <Pill meta={pmeta} label={label} tip={tip} />;
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span
        title={meta.tip}
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
        }}
      >
        <span
          aria-hidden
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: meta.color,
            opacity: status === "absent" ? 0.4 : 1,
          }}
        />
        {meta.label}
      </span>
      {planPill}
    </span>
  );
}
