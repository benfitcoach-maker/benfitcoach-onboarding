// ─── editorialReadiness ────────────────────────────────────────────────
// V97.44 — Lot 1 « État éditorial du programme » (cockpit publication Anissa).
//
// Fonction PURE, LECTURE SEULE. Répond d'un coup d'œil à « le programme est-il
// prêt à envoyer ? » dans ClientAppPreviewModal, SANS toucher à la logique de
// publication. Ne bloque rien : le footer fail-closed reste le seul garde-fou.
//
// Trois niveaux :
//   - blocked  : blocage TECHNIQUE réel (mapping erreur / config / email) —
//                cohérent avec blockedReasons du PublishFooter.
//   - review   : publiable techniquement mais ≥1 section éditoriale vide (doux).
//   - ready    : aucun blocage technique ET aucune section éditoriale vide.
//
// IMPORTANT : la complétude est ÉDITORIALE, jamais clinique. Le wording côté UI
// ne doit jamais laisser croire à une validation clinique (autorité = Anissa).

// Les 5 sections principales de l'app cliente, avec les règles de vacuité
// reprises À L'IDENTIQUE des cartes éditables de ClientAppPreviewModal :
//   - intro       : !intro_data?.body?.length          (IntroCardEditable)
//   - strategy    : !strategy_data?.pillars?.length     (StrategyCardEditable)
//   - week_meals  : days[0].meals vide                  (WeekMealsCardEditable)
//   - fridge      : !essentials?.length && !favorite    (FridgeCardEditable)
//   - supplements : !protocols_data?.groups?.length     (SupplementsCardEditable)
export const EDITORIAL_SECTIONS = [
  { key: "intro", label: "Lettre d'intro", okLabel: "Lettre d'intro rédigée", emptyLabel: "Lettre d'introduction manquante" },
  { key: "strategy", label: "Stratégie", okLabel: "Stratégie rédigée", emptyLabel: "Stratégie non renseignée" },
  { key: "week_meals", label: "Semaine type", okLabel: "Semaine type créée", emptyLabel: "Semaine type non créée" },
  { key: "fridge", label: "Frigo & courses", okLabel: "Frigo & courses complété", emptyLabel: "Frigo & courses non renseigné" },
  { key: "supplements", label: "Compléments", okLabel: "Compléments renseignés", emptyLabel: "Compléments non renseignés" },
];

export const READINESS_META = {
  blocked: { icon: "🔴", label: "Bloqué" },
  review: { icon: "🟠", label: "À vérifier avant publication" },
  ready: { icon: "🟢", label: "Prêt à envoyer" },
};

// Vrai si la section porte du contenu. Miroir exact des règles `empty` des
// cartes (inversées). plan absent → tout vide.
function isSectionFilled(plan, key) {
  const s = plan?.sections || {};
  switch (key) {
    case "intro":
      return !!s.intro_data?.body?.length;
    case "strategy":
      return !!s.strategy_data?.pillars?.length;
    case "week_meals":
      return (s.week_meals?.days?.[0]?.meals || []).length > 0;
    case "fridge":
      return !!s.fridge_data?.essentials?.length || !!s.fridge_data?.favorite?.length;
    case "supplements":
      return !!s.protocols_data?.groups?.length;
    default:
      return false;
  }
}

// Calcule l'état éditorial. Pur : aucune I/O.
//   plan          : objet ClientPlan mappé (null = erreur de mapping)
//   cfgOk         : checkPublishConfig().ok déjà calculé côté modale
//   hasEmail      : !!clientEmail déjà calculé côté modale
// Retourne { level, technical[], sections[], emptyCount }.
export function computeEditorialReadiness(plan, { cfgOk = true, hasEmail = true } = {}) {
  const technical = [];
  if (!plan) technical.push("Mapping en erreur");
  if (!cfgOk) technical.push("Config publication manquante");
  if (!hasEmail) technical.push("Cliente sans email");

  const sections = EDITORIAL_SECTIONS.map((sec) => ({
    key: sec.key,
    label: sec.label,
    okLabel: sec.okLabel,
    emptyLabel: sec.emptyLabel,
    filled: plan ? isSectionFilled(plan, sec.key) : false,
  }));

  const emptyCount = sections.filter((s) => !s.filled).length;

  let level;
  if (technical.length > 0) level = "blocked";
  else if (emptyCount > 0) level = "review";
  else level = "ready";

  return { level, technical, sections, emptyCount };
}
