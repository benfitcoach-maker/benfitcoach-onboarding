// ─── ClientAppPanel ─────────────────────────────────────────────────────
// V94.41 : Hub centralise pour tout ce qui touche a l'app cliente d'une
// cliente donnee. Affiche dans un nouvel onglet 'app' de NutritionConsultation.
//
// Sous-onglets :
//   - Vue d'ensemble : statut app, mode, derniere connexion, feedbacks 7j
//   - Messages       : (V94.42) envoi messages + attachements PDF
//   - Ressources     : (V94.43) bibliotheque PDFs reutilisables
//   - Signaux        : (V94.44) upgrade interests, ouvertures attachements
//
// Source des donnees app cliente : appel admin a l'API client app
// (fetchClientsStatus, services existants). Aucun acces direct SaaS → DB cliente.
// ───────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from "react";
import { fetchClientsStatus } from "./services/fetchClientsStatus";
import { getNutritionPlanMode, planModeLabel } from "./services/nutritionPlanMode";
import {
  fetchCoachMessages,
  sendCoachMessage,
  editCoachMessage,
  deleteCoachMessage,
  CoachMessageError,
} from "./services/sendCoachMessage";
import {
  fetchCoachResources,
  createCoachResource,
  archiveCoachResource,
  CoachResourceError,
} from "./services/coachResources";
import { fetchClientSignals, ClientSignalsError } from "./services/fetchClientSignals";
// V94.48 : Lettre + Recettes regroupees ici (composantes app cliente, plus
// dans les onglets racines de l'editeur — separation mindset plan vs app).
import IntroLetterTab from "./IntroLetterTab";
import RecipesTab from "./RecipesTab";
// V94.49 : Reglages app cliente (toggles par-cliente : suivi poids, etc.)
// regroupes ici pour eliminer le doublon avec l'onglet 'App cliente'.
import ClientAppSettingsCard from "./ClientAppSettingsCard";
// V94.51 : helper pour compter les meals uniques du plan (pour badge Recettes)
import { extractMealsAndAlternativesFromPlan } from "./services/extractMealsFromPlan";
// V94.52 / V94.53 : signal SaaS-side de publication (fallback si l'API
// clients-status est en cache stale ou trouve pas l'email apres update DB
// cote staging) + backfill auto quand l'API confirme.
import { hasBeenPublishedLocally, markPublishedLocally } from "./services/publishToClientApp";
import JourneyCockpit from "./components/JourneyCockpit";
import { useConfirmDialog, ConfirmDialog } from "./components/ConfirmDialog";

const SUB_TABS = [
  { id: "overview", label: "Vue d'ensemble" },
  { id: "letter", label: "Lettre", icon: "✉️" },
  { id: "recipes", label: "Recettes", icon: "🍳" },
  { id: "messages", label: "Messages" },
  { id: "resources", label: "Ressources" },
  { id: "signals", label: "Signaux" },
];

const ONBOARDING_KEY = "bfc_app_panel_onboarded";

// V96.5 fix : l'email de la cliente est saisi dans le questionnaire (form.email)
// et n'a JAMAIS ete copie a la racine `client.email` (la table `clients` n'a
// meme pas de colonne email). Tous les composants qui utilisaient `getClientEmail(client)`
// sans fallback retournaient null → empty state "pas d'email enregistré"
// alors que l'email etait bien la dans le form. Ce helper unifie l'acces.
function getClientEmail(client) {
  return client?.form?.email || getClientEmail(client) || null;
}

export default function ClientAppPanel({
  client,
  consultation,
  form,
  hasPlan,
  onUpdateConsultation,
  onOpenPreview,
  onPersistGlobally,
}) {
  const [activeTab, setActiveTab] = useState("overview");
  // V94.57 : banner onboarding affiche au 1er passage. Dismissable definitif
  // (localStorage flag par appareil/navigateur).
  const [showOnboarding, setShowOnboarding] = useState(() => {
    try {
      return !localStorage.getItem(ONBOARDING_KEY);
    } catch {
      return false;
    }
  });
  function dismissOnboarding() {
    try { localStorage.setItem(ONBOARDING_KEY, "1"); } catch { /* */ }
    setShowOnboarding(false);
  }

  // V94.51 : badges computed pour chaque sub-tab. Etat local pas
  // d'API call (les counters fetched sont alimentes par les sub-tabs
  // eux-memes lorsqu'ils sont actives).
  const planText = consultation?.nutrition_plan || consultation?.nutritionPlan || "";
  // V95.5 : aligne avec RecipesTab qui genere aussi les recettes des
  // alternatives. Sans ca, le badge affichait par exemple "18/3" (18 recettes
  // filled vs 3 meals principaux) — incoherent et confondant.
  const totalMeals = useMemo(() => extractMealsAndAlternativesFromPlan(planText, "fr").length, [planText]);
  const recipesFilledCount = useMemo(() => {
    const r = consultation?.meal_recipes || {};
    return Object.values(r).filter((rec) => rec?.ingredients?.length || rec?.preparation?.length).length;
  }, [consultation?.meal_recipes]);
  const letterFilled = !!(consultation?.intro_letter?.body?.length);

  // Compute badge content per tab
  const badges = useMemo(() => ({
    overview: null,
    letter: letterFilled ? { kind: "ok", label: "✓" } : { kind: "todo", label: "·" },
    recipes: totalMeals === 0
      ? null
      : recipesFilledCount === totalMeals
        ? { kind: "ok", label: "✓" }
        : { kind: "count", label: `${recipesFilledCount}/${totalMeals}` },
    messages: null,
    resources: null,
    signals: null,
  }), [letterFilled, recipesFilledCount, totalMeals]);

  if (!client) {
    return (
      <div style={emptyStyle}>
        Selectionnez une cliente pour voir sa vue app.
      </div>
    );
  }

  return (
    <div style={panelStyle}>
      {/* V94.57 : banner onboarding 1ere visite */}
      {showOnboarding && (
        <div
          style={{
            marginBottom: 12,
            padding: "10px 14px",
            background: "linear-gradient(135deg, rgba(130,195,158,0.1), rgba(130,195,158,0.04))",
            border: "1px solid rgba(130,195,158,0.25)",
            borderRadius: 10,
            display: "flex",
            gap: 12,
            alignItems: "flex-start",
          }}
        >
          <span style={{ fontSize: "1.2rem", flexShrink: 0 }}>💡</span>
          <div style={{ flex: 1, fontSize: ".78rem", color: "#cfcfc4", lineHeight: 1.55 }}>
            <strong style={{ color: "#82c39e" }}>Bienvenue dans l&apos;espace App cliente.</strong>{" "}
            Suivez les etapes du <em>Parcours app cliente</em> pour personnaliser
            (Lettre, Recettes) puis publier le plan dans l&apos;app de votre cliente.
            Tout y est centralise.
          </div>
          <button
            type="button"
            onClick={dismissOnboarding}
            style={{
              background: "transparent",
              border: "1px solid rgba(130,195,158,0.3)",
              borderRadius: 6,
              padding: "4px 10px",
              fontSize: ".72rem",
              color: "#82c39e",
              cursor: "pointer",
              flexShrink: 0,
              alignSelf: "center",
            }}
          >
            Compris
          </button>
        </div>
      )}

      {/* Sub-tabs nav */}
      <div style={subTabsStyle}>
        {SUB_TABS.map((t) => {
          const isActive = activeTab === t.id;
          const badge = badges[t.id];
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              style={{
                ...subTabBtnStyle,
                ...(isActive ? subTabBtnActiveStyle : {}),
              }}
            >
              {t.icon && <span style={{ marginRight: 4 }}>{t.icon}</span>}
              {t.label}
              {badge && <SubTabBadge {...badge} />}
            </button>
          );
        })}
      </div>

      {/* Content avec transition fade-in subtile a chaque switch */}
      <div key={activeTab} style={{ ...contentStyle, animation: "ccap-fadein 200ms ease-out" }}>
        <style>{`@keyframes ccap-fadein { from { opacity: 0; transform: translateY(2px); } to { opacity: 1; transform: translateY(0); } }`}</style>
        {activeTab === "overview" && (
          <OverviewTab
            client={client}
            consultation={consultation}
            hasPlan={hasPlan}
            onOpenPreview={onOpenPreview}
            recipesFilledCount={recipesFilledCount}
            totalMeals={totalMeals}
            letterFilled={letterFilled}
            onJumpTo={setActiveTab}
          />
        )}
        {/* V94.48 : Lettre + Recettes regroupees ici (composantes app cliente).
            V94.57 : onPersistGlobally forward pour fusion des 2 saves. */}
        {activeTab === "letter" && (
          <IntroLetterTab
            consultation={consultation}
            form={form}
            onSave={(letter) => onUpdateConsultation?.({ intro_letter: letter })}
            onPersistGlobally={onPersistGlobally}
          />
        )}
        {activeTab === "recipes" && (
          <RecipesTab
            consultation={consultation}
            form={form}
            onSave={(nextRecipes) => onUpdateConsultation?.({ meal_recipes: nextRecipes })}
            onPersistGlobally={onPersistGlobally}
          />
        )}
        {activeTab === "messages" && <MessagesTab client={client} />}
        {activeTab === "resources" && <ResourcesTab />}
        {activeTab === "signals" && <SignalsTab client={client} />}
      </div>
    </div>
  );
}

// ─── Vue d'ensemble ─────────────────────────────────────────────────────

function OverviewTab({
  client,
  consultation,
  hasPlan,
  onOpenPreview,
  recipesFilledCount = 0,
  totalMeals = 0,
  letterFilled = false,
  onJumpTo,
}) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [journeyRefreshKey, setJourneyRefreshKey] = useState(0);

  function refreshStatus() {
    setJourneyRefreshKey((k) => k + 1);
  }

  useEffect(() => {
    let cancelled = false;
    const email = getClientEmail(client) || null;
    const stagingClientId = client?.stagingClientId || null;
    if (!email && !stagingClientId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchClientsStatus([{ email, stagingClientId }])
      .then((map) => {
        if (cancelled) return;
        const key = stagingClientId
          ? `id:${stagingClientId}`
          : email?.toLowerCase();
        const entry = (key && map[key]) || null;
        setStatus(entry);
        // V94.53 : backfill auto. Si l'API confirme l'existence (found=true),
        // on hydrate le localStorage. Resultat : toutes les clientes existantes
        // de Anissa sont automatiquement reconnues au prochain mount du panel,
        // sans qu'elle ait besoin de re-publier.
        if (entry?.found && client?.id) {
          markPublishedLocally(client.id);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [getClientEmail(client), client?.id, client?.stagingClientId, journeyRefreshKey]);

  const mode = getNutritionPlanMode(client);
  const modeLabel = planModeLabel(mode);
  // V94.46 → V94.53 : 4 sources de verite combinees pour determiner l'acces.
  //   1. apiFound : l'API distante confirme (canonique, mais cache 60s)
  //   2. appEnabled : flag SaaS cote profil cliente
  //   3. publishedLocally : trace SaaS de publication reussie (V94.52)
  //   4. presumedFromPlan : cliente avec plan redige et id → presomption
  //      raisonnable qu'elle a ete publiee au moins une fois (resout
  //      tous les edge cases : email mismatch staging, cache stale,
  //      backfill manuel DB sans repasser par publish, etc.)
  const apiFound = !!status?.found;
  const appEnabled = !!(client?.app_enabled ?? client?.appEnabled);
  const publishedLocally = hasBeenPublishedLocally(client?.id);
  const presumedFromPlan = !!(hasPlan && client?.id);
  const hasAppAccess = apiFound || appEnabled || publishedLocally || presumedFromPlan;
  const lastLoginAt = status?.last_login_at || null;
  const lastActivityAt = status?.last_activity_at || null;
  const feedbacks7d = status?.feedbacks_7d_count || 0;
  const newFeedbacks = status?.new_feedbacks_count || 0;

  if (loading) {
    return <SkeletonGroup rows={5} />;
  }

  // Cas reel "pas d'app" : ni l'API ni le flag SaaS ne signalent un acces.
  // V94.50 : on affiche aussi le bouton 'Apercu & Publier' meme dans cet etat
  // pour qu'Anissa puisse activer le compte cliente directement depuis ici.
  if (!hasAppAccess) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <JourneyCockpit
          email={getClientEmail(client)}
          clientId={client?.stagingClientId}
          journey={status?.journey || null}
          onUpdated={refreshStatus}
          clientPrenom={client?.prenom || client?.form?.prenom || ""}
          clientFormule={client?.formule || client?.packType || ""}
        />
        {onOpenPreview && (
          <button
            type="button"
            onClick={onOpenPreview}
            disabled={!hasPlan}
            style={publishButtonStyle(hasPlan)}
            title={hasPlan ? "Voir le rendu cliente et publier" : "Aucun plan a publier"}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: "1.2rem" }}>👁️</span>
              <div>
                <div style={{ fontSize: ".85rem", fontWeight: 600, color: hasPlan ? "#cfcfc4" : "#8a8a7a" }}>
                  Apercu &amp; Publier le programme
                </div>
                <div style={{ fontSize: ".7rem", color: "#8a8a7a", marginTop: 2 }}>
                  {hasPlan
                    ? "Activer le compte cliente en publiant son plan"
                    : "Redigez un plan d'abord pour pouvoir publier"}
                </div>
              </div>
            </div>
            <span style={{ fontSize: "1rem", color: "#82c39e" }}>→</span>
          </button>
        )}
        <EmptyState
          icon="📱"
          title="Cette cliente n'a pas encore d'acces a l'app."
          hint="Publiez son plan ci-dessus pour activer son compte."
        />
      </div>
    );
  }

  // V94.46 → V94.65 : avant on affichait "Synchronisation en cours" quand
  // l'API ne confirmait pas, mais ce warning restait a vie si la cliente
  // n'avait jamais visite l'app (cas normal). Plus de warning desormais —
  // le statut "INVITEE" + "Derniere connexion: —" est explicite et juste.
  const apiUnsynced = false;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {apiUnsynced && (
        <div style={{ fontSize: ".7rem", color: "#cfcfc4", padding: "6px 10px", background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 6 }}>
          ⏳ Synchronisation en cours… Les statistiques de connexion s&apos;afficheront dans un instant.
        </div>
      )}

      {/* Cockpit parcours cliente — EN HAUT de la vue d'ensemble */}
      <JourneyCockpit
        email={getClientEmail(client)}
        clientId={client?.stagingClientId}
        journey={status?.journey || null}
        onUpdated={refreshStatus}
        clientPrenom={client?.prenom || client?.form?.prenom || ""}
        clientFormule={client?.formule || client?.packType || ""}
      />

      {/* V94.50 : CTA principale "Apercu & Publier" — anciennement bouton
          "Aperçu JSON" du header editeur (mauvais nom, mauvaise place).
          Action critique du workflow Anissa : ouvre la modale qui montre
          le rendu visuel des sections + bouton Publier dans l'app. */}
      {onOpenPreview && (
        <button
          type="button"
          onClick={onOpenPreview}
          disabled={!hasPlan}
          style={publishButtonStyle(hasPlan)}
          title={hasPlan ? "Voir le rendu cliente et publier" : "Aucun plan a publier"}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: "1.2rem" }}>👁️</span>
            <div>
              <div style={{ fontSize: ".85rem", fontWeight: 600, color: hasPlan ? "#cfcfc4" : "#8a8a7a" }}>
                Apercu &amp; Publier le programme
              </div>
              <div style={{ fontSize: ".7rem", color: "#8a8a7a", marginTop: 2 }}>
                {hasPlan
                  ? "Voir le rendu cliente puis publier la nouvelle version"
                  : "Redigez un plan d'abord pour pouvoir publier"}
              </div>
            </div>
          </div>
          <span style={{ fontSize: "1rem", color: "#82c39e" }}>→</span>
        </button>
      )}

      {/* V94.51 → V94.56 : Workflow checklist — guide etape-par-etape.
          clientPublished aligne sur hasAppAccess (4 sources de verite,
          coherent avec le reste du panel). Sinon dependence sur l'API
          stale fait afficher 2/3 alors que le plan est bien publie. */}
      <WorkflowChecklist
        hasPlan={hasPlan}
        letterFilled={letterFilled}
        recipesFilledCount={recipesFilledCount}
        totalMeals={totalMeals}
        clientPublished={hasAppAccess}
        onJumpTo={onJumpTo}
      />

      {/* Statut connexion */}
      <Row label="Statut">
        <Pill color={lastLoginAt ? "#82c39e" : "#8a8a7a"}>
          {lastLoginAt ? "Active" : "Invitee"}
        </Pill>
      </Row>

      {/* Mode (oneshot vs followup) */}
      <Row label="Type d'accompagnement">
        <span style={{ color: "#cfcfc4", fontWeight: 500 }}>{modeLabel}</span>
        <span style={{ color: "#8a8a7a", fontSize: ".7rem", marginLeft: 8 }}>
          ({mode === "followup" ? "suivi 6 mois" : "consultation unique"})
        </span>
      </Row>

      {/* Plan publie ? */}
      <Row label="Plan publie">
        <Pill color="#82c39e">Oui</Pill>
      </Row>

      {/* Dernieres connexions */}
      <Row label="Derniere connexion">
        <span style={timeStyle}>{formatRelative(lastLoginAt)}</span>
      </Row>

      <Row label="Derniere activite">
        <span style={timeStyle}>{formatRelative(lastActivityAt)}</span>
      </Row>

      {/* Engagement feedbacks */}
      <Row label="Ressentis 7 derniers jours">
        <span style={{ color: "#cfcfc4", fontWeight: 500 }}>{feedbacks7d}</span>
        {newFeedbacks > 0 && (
          <Pill color="#e8a040" small>
            {newFeedbacks} non lu{newFeedbacks > 1 ? "s" : ""}
          </Pill>
        )}
      </Row>

      {/* Consultation source */}
      {consultation?.id && (
        <Row label="Consultation source">
          <span style={{ color: "#8a8a7a", fontSize: ".75rem" }}>
            {String(consultation.id).slice(0, 8)}…
          </span>
        </Row>
      )}

      {/* V94.49 : reglages app cliente integres ici (suivi poids visible/cache,
          etc.). Avant : sur l'onglet 'plan' au-dessus de l'editeur, ce qui
          melangeait peaufinage plan et reglages app. */}
      <div style={{ marginTop: 16 }}>
        <ClientAppSettingsCard client={client} />
      </div>
    </div>
  );
}

// ─── Messages (V94.43) ──────────────────────────────────────────────────
//
// Anissa peut :
//   - Voir l'historique des 20 derniers messages envoyes a la cliente
//   - Composer un nouveau message (texte 1-2000 chars)
//   - Optionnel : joindre une URL HTTPS (PDF/image) avec libelle (Drive
//     partage, CDN, Supabase Storage, etc.). On n'heberge pas le fichier
//     ici en V1 — Anissa heberge ailleurs et colle l'URL.
//
// Bidirectionnel : la cliente verra le message + le bouton attachment dans
// son onglet "Messages d'Anissa" sur la home + page /messages dediee.

function MessagesTab({ client }) {
  const [messages, setMessages] = useState(null); // null = loading
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  // V94.44 : ressources reutilisables (bibliotheque)
  const [library, setLibrary] = useState([]);

  // Compose state
  const [draftBody, setDraftBody] = useState("");
  const [attachUrl, setAttachUrl] = useState("");
  const [attachLabel, setAttachLabel] = useState("");
  const [attachType, setAttachType] = useState("pdf");
  const [showAttach, setShowAttach] = useState(false);
  // V94.44 : 'library' = ressource selectionnee depuis bibliotheque, 'custom' = saisie manuelle
  const [attachMode, setAttachMode] = useState("library");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (!getClientEmail(client)) {
      setMessages([]);
      return;
    }
    setMessages(null);
    setError(null);
    // V94.44 : on charge en parallele les messages + la bibliotheque
    Promise.all([
      fetchCoachMessages({ email: getClientEmail(client), limit: 20 }),
      fetchCoachResources().catch(() => []), // bibliotheque optionnelle, pas bloquant
    ])
      .then(([msgRes, lib]) => {
        if (cancelled) return;
        setMessages(msgRes.messages);
        setLibrary(Array.isArray(lib) ? lib : []);
      })
      .catch((e) => {
        if (cancelled) return;
        const msg = e instanceof CoachMessageError ? e.message : String(e?.message || e);
        setError(msg);
        setMessages([]);
      });
    return () => { cancelled = true; };
  }, [getClientEmail(client), reloadKey]);

  function reload() {
    setReloadKey((k) => k + 1);
  }

  async function handleSend(e) {
    e?.preventDefault?.();
    if (sending) return;
    if (!draftBody.trim()) return;
    setSendError(null);
    setSending(true);
    try {
      // V94.44 : determine quelles valeurs envoyer en attachment
      const finalUrl = showAttach ? attachUrl.trim() : null;
      const finalLabel = showAttach ? attachLabel.trim() : null;
      const finalType = showAttach ? attachType : null;

      await sendCoachMessage({
        email: getClientEmail(client),
        body: draftBody,
        attachment_url: finalUrl,
        attachment_label: finalLabel,
        attachment_type: finalType,
      });
      // Reset form
      setDraftBody("");
      setAttachUrl("");
      setAttachLabel("");
      setAttachType("pdf");
      setShowAttach(false);
      setAttachMode("library");
      reload();
    } catch (err) {
      const msg = err instanceof CoachMessageError ? err.message : String(err?.message || err);
      setSendError(msg);
    } finally {
      setSending(false);
    }
  }

  // V94.44 : applique une ressource de la bibliotheque dans les champs
  function selectFromLibrary(resourceId) {
    if (!resourceId) {
      setAttachUrl("");
      setAttachLabel("");
      setAttachType("pdf");
      return;
    }
    const r = library.find((x) => x.id === resourceId);
    if (!r) return;
    setAttachUrl(r.url || "");
    setAttachLabel(r.label || "");
    setAttachType(r.type || "pdf");
  }

  if (!getClientEmail(client)) {
    return (
      <EmptyState
        icon="✉️"
        title="Cette cliente n'a pas d'email enregistre."
        hint="Renseignez l'email dans la fiche cliente pour debloquer l'envoi de messages."
      />
    );
  }

  const charCount = draftBody.trim().length;
  const isAttachValid = !showAttach || (
    attachUrl.trim() && attachLabel.trim() && /^https:\/\//i.test(attachUrl.trim())
  );
  const canSend = !sending && charCount > 0 && charCount <= 2000 && isAttachValid;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Compose */}
      <form onSubmit={handleSend} style={composerStyle}>
        <div style={{ fontSize: ".75rem", color: "#8a8a7a", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 6 }}>
          Nouveau message
        </div>

        <textarea
          value={draftBody}
          onChange={(e) => setDraftBody(e.target.value.slice(0, 2000))}
          rows={4}
          placeholder="Quelques mots a votre cliente…"
          style={textareaStyle}
          disabled={sending}
        />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6, fontSize: ".7rem" }}>
          <button
            type="button"
            onClick={() => setShowAttach((v) => !v)}
            style={attachToggleStyle}
            disabled={sending}
          >
            {showAttach ? "✖ Retirer la piece jointe" : "📎 Joindre un fichier"}
          </button>
          <span style={{ color: charCount > 1900 ? "#e8a040" : "#8a8a7a" }}>
            {charCount} / 2000
          </span>
        </div>

        {showAttach && (
          <div style={attachBlockStyle}>
            {/* V94.44 : 2 modes — depuis la bibliotheque OU saisie custom */}
            <div style={{ display: "flex", gap: 4 }}>
              <button
                type="button"
                onClick={() => setAttachMode("library")}
                style={{
                  ...modeBtnStyle,
                  ...(attachMode === "library" ? modeBtnActiveStyle : {}),
                }}
                disabled={sending}
              >
                📚 Bibliotheque ({library.length})
              </button>
              <button
                type="button"
                onClick={() => setAttachMode("custom")}
                style={{
                  ...modeBtnStyle,
                  ...(attachMode === "custom" ? modeBtnActiveStyle : {}),
                }}
                disabled={sending}
              >
                ✏️ URL custom
              </button>
            </div>

            {attachMode === "library" ? (
              library.length === 0 ? (
                <p style={hintStyle}>
                  Aucune ressource enregistree. Ajoutez-en dans l&apos;onglet
                  &quot;Ressources&quot; pour les reutiliser ici.
                </p>
              ) : (
                <label style={{ display: "block" }}>
                  <div style={fieldLabelStyle}>Choisir une ressource</div>
                  <select
                    value={library.find((r) => r.url === attachUrl && r.label === attachLabel)?.id || ""}
                    onChange={(e) => selectFromLibrary(e.target.value)}
                    style={inputStyle}
                    disabled={sending}
                  >
                    <option value="">— Selectionner —</option>
                    {library.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.type === "image" ? "🖼" : "📄"} {r.label}
                      </option>
                    ))}
                  </select>
                  {attachUrl && attachLabel && (
                    <div style={{ marginTop: 6, fontSize: ".7rem", color: "#8a8a7a" }}>
                      → {attachLabel} ({attachType})
                    </div>
                  )}
                </label>
              )
            ) : (
              <>
                <label style={{ display: "block" }}>
                  <div style={fieldLabelStyle}>URL HTTPS du fichier</div>
                  <input
                    type="url"
                    value={attachUrl}
                    onChange={(e) => setAttachUrl(e.target.value)}
                    placeholder="https://drive.google.com/..."
                    style={inputStyle}
                    disabled={sending}
                  />
                </label>

                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8 }}>
                  <label style={{ display: "block" }}>
                    <div style={fieldLabelStyle}>Libelle affiche</div>
                    <input
                      type="text"
                      value={attachLabel}
                      onChange={(e) => setAttachLabel(e.target.value.slice(0, 100))}
                      placeholder="Guide anti-inflammatoire"
                      style={inputStyle}
                      disabled={sending}
                    />
                  </label>
                  <label style={{ display: "block" }}>
                    <div style={fieldLabelStyle}>Type</div>
                    <select
                      value={attachType}
                      onChange={(e) => setAttachType(e.target.value)}
                      style={inputStyle}
                      disabled={sending}
                    >
                      <option value="pdf">PDF</option>
                      <option value="image">Image</option>
                    </select>
                  </label>
                </div>

                <p style={hintStyle}>
                  💡 L&apos;URL doit etre publique (Drive partage, Dropbox, S3, Supabase Storage…).
                  La cliente verra un bouton dans le message pour ouvrir le fichier.
                </p>
              </>
            )}
          </div>
        )}

        {sendError && (
          <div style={errorStyle}>⚠ {sendError}</div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
          <button
            type="submit"
            className="btn btn-anissa-primary"
            disabled={!canSend}
            style={{ ...primaryBtnStyle, opacity: canSend ? 1 : 0.5 }}
          >
            {sending ? "Envoi…" : "Envoyer"}
          </button>
        </div>
      </form>

      {/* History */}
      <div>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ fontSize: ".75rem", color: "#8a8a7a", textTransform: "uppercase", letterSpacing: ".05em" }}>
            Historique
          </div>
          <button
            type="button"
            onClick={reload}
            style={refreshBtnStyle}
            disabled={messages === null}
          >
            ↻ Actualiser
          </button>
        </div>

        {error && (
          <div style={errorStyle}>⚠ {error}</div>
        )}

        {messages === null && <SkeletonGroup rows={3} />}

        {messages && messages.length === 0 && !error && (
          <EmptyState
            icon="💬"
            title="Aucun message envoye pour le moment."
            hint="Composez votre premier message ci-dessus pour ouvrir le canal."
          />
        )}

        {messages && messages.length > 0 && (
          <ul style={messageListStyle}>
            {messages.map((m) => (
              <MessageItem key={m.id} message={m} onChanged={reload} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function MessageItem({ message, onChanged }) {
  const sentAt = formatMessageDate(message.sent_at);
  const readAt = message.read_at ? formatMessageDate(message.read_at) : null;
  const hasAttachment = !!(message.attachment_url && message.attachment_label);

  // V96.6 : edition/suppression in-place
  const [mode, setMode] = useState("read"); // 'read' | 'edit' | 'confirmDelete'
  const [draft, setDraft] = useState(message.body);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function handleSave() {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === message.body) {
      setMode("read");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await editCoachMessage({ id: message.id, body: trimmed });
      setMode("read");
      onChanged?.();
    } catch (e) {
      setError(e instanceof CoachMessageError ? e.message : String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    setBusy(true);
    setError(null);
    try {
      await deleteCoachMessage({ id: message.id });
      onChanged?.();
    } catch (e) {
      setError(e instanceof CoachMessageError ? e.message : String(e?.message || e));
      setBusy(false);
    }
  }

  return (
    <li style={messageItemStyle}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6, gap: 8 }}>
        <span style={{ fontSize: ".7rem", color: "#8a8a7a", textTransform: "uppercase", letterSpacing: ".05em" }}>
          Envoye {sentAt}
          {message.source === "ai_assisted" && " · IA"}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              fontSize: ".68rem",
              fontWeight: 600,
              padding: "2px 8px",
              borderRadius: 999,
              color: readAt ? "#82c39e" : "#8a8a7a",
              background: readAt ? "rgba(130,195,158,.12)" : "rgba(255,255,255,.03)",
              border: `1px solid ${readAt ? "rgba(130,195,158,.25)" : "rgba(255,255,255,.06)"}`,
              textTransform: "uppercase",
              letterSpacing: ".05em",
            }}
          >
            {readAt ? `Lu ${readAt}` : "Non lu"}
          </span>
          {mode === "read" && !busy && (
            <>
              <button
                type="button"
                onClick={() => { setDraft(message.body); setMode("edit"); }}
                title="Editer"
                style={messageActionBtnStyle}
              >
                ✏️
              </button>
              <button
                type="button"
                onClick={() => setMode("confirmDelete")}
                title="Supprimer"
                style={messageActionBtnStyle}
              >
                🗑
              </button>
            </>
          )}
        </div>
      </div>

      {mode === "read" && (
        <div style={{ fontSize: ".88rem", color: "#cfcfc4", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
          {message.body}
        </div>
      )}

      {mode === "edit" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, 2000))}
            rows={Math.min(10, Math.max(3, draft.split("\n").length + 1))}
            disabled={busy}
            style={textareaStyle}
            autoFocus
          />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={() => { setMode("read"); setDraft(message.body); setError(null); }}
              disabled={busy}
              style={{ ...messageActionBtnStyle, padding: "6px 12px" }}
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={busy || !draft.trim() || draft.trim() === message.body}
              style={{
                ...messageActionBtnStyle,
                padding: "6px 14px",
                background: "#315B43",
                color: "#FAF9F6",
                borderColor: "#315B43",
                opacity: busy || !draft.trim() || draft.trim() === message.body ? 0.5 : 1,
              }}
            >
              {busy ? "Sauvegarde…" : "Sauvegarder"}
            </button>
          </div>
        </div>
      )}

      {mode === "confirmDelete" && (
        <div style={{
          padding: 10,
          background: "rgba(220, 70, 70, .08)",
          border: "1px solid rgba(220, 70, 70, .25)",
          borderRadius: 8,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}>
          <div style={{ fontSize: ".85rem", color: "#e8c5c0" }}>
            Supprimer ce message ? La cliente ne le verra plus dans son app.
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={() => { setMode("read"); setError(null); }}
              disabled={busy}
              style={{ ...messageActionBtnStyle, padding: "6px 12px" }}
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={busy}
              style={{
                ...messageActionBtnStyle,
                padding: "6px 14px",
                background: "#a24e3d",
                color: "#FAF9F6",
                borderColor: "#a24e3d",
                opacity: busy ? 0.5 : 1,
              }}
            >
              {busy ? "Suppression…" : "Supprimer"}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div style={{
          marginTop: 6,
          fontSize: ".75rem",
          color: "#e8a59c",
        }}>
          {error}
        </div>
      )}

      {hasAttachment && mode === "read" && (
        <a
          href={message.attachment_url}
          target="_blank"
          rel="noopener noreferrer"
          style={attachmentLinkStyle}
        >
          <span style={{ fontSize: "1rem" }}>{message.attachment_type === "image" ? "🖼" : "📄"}</span>
          <span style={{ flex: 1 }}>{message.attachment_label}</span>
          <span style={{ color: "#8a8a7a", fontSize: ".75rem" }}>↗</span>
        </a>
      )}
    </li>
  );
}

const messageActionBtnStyle = {
  appearance: "none",
  border: "1px solid rgba(255,255,255,.1)",
  background: "rgba(255,255,255,.04)",
  color: "#cfcfc4",
  fontSize: ".78rem",
  cursor: "pointer",
  padding: "4px 8px",
  borderRadius: 6,
  lineHeight: 1,
  transition: "background 120ms ease",
};

function formatMessageDate(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "—";
  }
}

// ─── Ressources (V94.44) ────────────────────────────────────────────────
//
// Bibliotheque de PDFs/images reutilisables. Anissa enregistre une ressource
// (label + URL HTTPS + type) une fois ici, et peut la reselectionner dans
// le composer Messages au lieu de re-coller a chaque cliente.
//
// Soft delete : archived_at au lieu de DELETE, evite de casser les messages
// historiques qui referencent l'URL.

function ResourcesTab() {
  const confirmDialog = useConfirmDialog();
  const [resources, setResources] = useState(null);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Add form
  const [showForm, setShowForm] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newType, setNewType] = useState("pdf");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);

  // Confirm archive
  const [archivingId, setArchivingId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setResources(null);
    setError(null);
    fetchCoachResources()
      .then((list) => {
        if (cancelled) return;
        setResources(list);
      })
      .catch((e) => {
        if (cancelled) return;
        const msg = e instanceof CoachResourceError ? e.message : String(e?.message || e);
        setError(msg);
        setResources([]);
      });
    return () => { cancelled = true; };
  }, [reloadKey]);

  function reload() {
    setReloadKey((k) => k + 1);
  }

  async function handleCreate(e) {
    e?.preventDefault?.();
    if (creating) return;
    setCreateError(null);
    setCreating(true);
    try {
      await createCoachResource({ label: newLabel, url: newUrl, type: newType });
      setNewLabel("");
      setNewUrl("");
      setNewType("pdf");
      setShowForm(false);
      reload();
    } catch (err) {
      const msg = err instanceof CoachResourceError ? err.message : String(err?.message || err);
      setCreateError(msg);
    } finally {
      setCreating(false);
    }
  }

  async function handleArchive(id, label) {
    if (archivingId) return;
    const ok = await confirmDialog.ask({
      title: `Archiver "${label}" ?`,
      message: "Cette ressource ne sera plus sélectionnable dans les nouveaux messages, mais reste accessible aux clientes qui l'ont déjà reçue.",
      confirmLabel: 'Archiver',
      danger: true,
    });
    if (!ok) return;
    setArchivingId(id);
    try {
      await archiveCoachResource(id);
      reload();
    } catch (err) {
      const msg = err instanceof CoachResourceError ? err.message : String(err?.message || err);
      alert(`Erreur : ${msg}`);
    } finally {
      setArchivingId(null);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header + bouton add */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={{ fontSize: "0.95rem", color: "#cfcfc4", fontWeight: 600 }}>
            📚 Bibliotheque de ressources
          </div>
          <div style={{ fontSize: ".72rem", color: "#8a8a7a", marginTop: 2 }}>
            {resources === null ? "Chargement…" : `${resources.length} ressource${resources.length > 1 ? "s" : ""} active${resources.length > 1 ? "s" : ""}`}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          style={primaryBtnStyle}
          className="btn btn-anissa-primary"
        >
          {showForm ? "✖ Annuler" : "+ Ajouter une ressource"}
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <form onSubmit={handleCreate} style={composerStyle}>
          <div style={fieldLabelStyle}>Nouvelle ressource</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
            <label style={{ display: "block" }}>
              <div style={fieldLabelStyle}>Libelle</div>
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value.slice(0, 100))}
                placeholder="Guide anti-inflammatoire"
                style={inputStyle}
                disabled={creating}
              />
            </label>
            <label style={{ display: "block" }}>
              <div style={fieldLabelStyle}>URL HTTPS</div>
              <input
                type="url"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="https://drive.google.com/..."
                style={inputStyle}
                disabled={creating}
              />
            </label>
            <label style={{ display: "block" }}>
              <div style={fieldLabelStyle}>Type</div>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                style={{ ...inputStyle, maxWidth: 200 }}
                disabled={creating}
              >
                <option value="pdf">PDF</option>
                <option value="image">Image</option>
              </select>
            </label>
          </div>

          {createError && <div style={errorStyle}>⚠ {createError}</div>}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10 }}>
            <button
              type="submit"
              className="btn btn-anissa-primary"
              disabled={creating || !newLabel.trim() || !newUrl.trim()}
              style={{ ...primaryBtnStyle, opacity: (creating || !newLabel.trim() || !newUrl.trim()) ? 0.5 : 1 }}
            >
              {creating ? "Creation…" : "Creer"}
            </button>
          </div>
        </form>
      )}

      {/* Liste */}
      {error && <div style={errorStyle}>⚠ {error}</div>}

      {resources === null && <SkeletonGroup rows={3} />}

      {resources && resources.length === 0 && !error && (
        <EmptyState
          icon="📚"
          title="Aucune ressource pour le moment."
          hint="Ajoutez vos guides PDFs reutilisables (anti-inflammatoire, sommeil, etc.) pour les selectionner facilement dans les messages."
        />
      )}

      {resources && resources.length > 0 && (
        <ul style={messageListStyle}>
          {resources.map((r) => (
            <li key={r.id} style={resourceItemStyle}>
              <span style={{ fontSize: "1.1rem", marginRight: 8 }}>
                {r.type === "image" ? "🖼" : "📄"}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: ".88rem", color: "#cfcfc4", fontWeight: 500 }}>
                  {r.label}
                </div>
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: ".7rem",
                    color: "#8a8a7a",
                    textDecoration: "none",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    display: "block",
                  }}
                  title={r.url}
                >
                  ↗ {r.url}
                </a>
              </div>
              <button
                type="button"
                onClick={() => handleArchive(r.id, r.label)}
                disabled={archivingId === r.id}
                style={archiveBtnStyle}
                title="Archiver"
              >
                {archivingId === r.id ? "…" : "🗑"}
              </button>
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog state={confirmDialog.state} onClose={confirmDialog.close} />
    </div>
  );
}

// ─── Signaux (V94.45) ───────────────────────────────────────────────────
//
// Affiche les signaux d'engagement de la cliente :
// 1. Interets pour le suivi (clics CTA "Decouvrir le suivi 6 mois")
// 2. Ouvertures de pieces jointes
//
// Permet a Anissa de detecter les opportunites de conversion et l'engagement
// reel avec ses ressources.

function SignalsTab({ client }) {
  const [signals, setSignals] = useState(null); // null = loading
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (!getClientEmail(client)) {
      setSignals({ upgrade_interests: [], attachment_opens: [] });
      return;
    }
    setSignals(null);
    setError(null);
    fetchClientSignals({ email: getClientEmail(client), limit: 50 })
      .then((res) => {
        if (cancelled) return;
        setSignals(res);
      })
      .catch((e) => {
        if (cancelled) return;
        const msg = e instanceof ClientSignalsError ? e.message : String(e?.message || e);
        setError(msg);
        setSignals({ upgrade_interests: [], attachment_opens: [] });
      });
    return () => { cancelled = true; };
  }, [getClientEmail(client), reloadKey]);

  if (!getClientEmail(client)) {
    return (
      <EmptyState
        icon="🔍"
        title="Cette cliente n'a pas d'email enregistre."
        hint="Renseignez l'email dans la fiche cliente pour collecter ses signaux d'engagement."
      />
    );
  }

  if (signals === null) {
    return <SkeletonGroup rows={4} />;
  }

  const interests = signals.upgrade_interests || [];
  const opens = signals.attachment_opens || [];
  const totalSignals = interests.length + opens.length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: "0.95rem", color: "#cfcfc4", fontWeight: 600 }}>
            🔍 Signaux d&apos;engagement
          </div>
          <div style={{ fontSize: ".72rem", color: "#8a8a7a", marginTop: 2 }}>
            {totalSignals} signal{totalSignals > 1 ? "s" : ""} au total
          </div>
        </div>
        <button
          type="button"
          onClick={() => setReloadKey((k) => k + 1)}
          style={refreshBtnStyle}
        >
          ↻ Actualiser
        </button>
      </div>

      {error && <div style={errorStyle}>⚠ {error}</div>}

      {/* Interets suivi 6 mois (uniquement si oneshot, mais on affiche quand
          meme si presents en cas de mode mixte ou backfill) */}
      <SignalSection
        title="💚 Interet pour le suivi 6 mois"
        subtitle={
          interests.length === 0
            ? "Aucun clic sur la CTA d'upsell."
            : `${interests.length} clic${interests.length > 1 ? "s" : ""} sur la CTA "Decouvrir le suivi 6 mois"`
        }
        emptyHint="Cette cliente n'a pas encore manifeste d'interet pour passer au suivi."
        items={interests.map((i) => ({
          key: i.id,
          when: i.signaled_at,
          label: "Clic sur la CTA d'upsell",
        }))}
        accent="#82c39e"
      />

      {/* Ouvertures attachments */}
      <SignalSection
        title="📎 Ouvertures de pieces jointes"
        subtitle={
          opens.length === 0
            ? "Aucune piece jointe ouverte pour le moment."
            : `${opens.length} ouverture${opens.length > 1 ? "s" : ""} (toutes pieces jointes confondues)`
        }
        emptyHint="Aucun PDF/image envoye n'a encore ete consulte."
        items={opens.map((o) => ({
          key: o.id,
          when: o.opened_at,
          label: o.attachment_label || "Piece jointe",
          icon: o.attachment_type === "image" ? "🖼" : "📄",
          preview: o.message_body_preview,
        }))}
        accent="#82c39e"
      />
    </div>
  );
}

function SignalSection({ title, subtitle, items, emptyHint, accent }) {
  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: ".82rem", color: "#cfcfc4", fontWeight: 500 }}>
          {title}
        </div>
        <div style={{ fontSize: ".7rem", color: "#8a8a7a", marginTop: 2 }}>
          {subtitle}
        </div>
      </div>

      {items.length === 0 ? (
        <div
          style={{
            padding: "14px 16px",
            background: "rgba(255,255,255,.015)",
            border: "1px solid rgba(255,255,255,.04)",
            borderRadius: 8,
            fontSize: ".75rem",
            color: "#8a8a7a",
            fontStyle: "italic",
          }}
        >
          {emptyHint}
        </div>
      ) : (
        <ul style={messageListStyle}>
          {items.map((it) => (
            <li key={it.key} style={signalItemStyle}>
              {it.icon && <span style={{ fontSize: "1rem", marginRight: 8 }}>{it.icon}</span>}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: ".82rem", color: "#cfcfc4" }}>
                  {it.label}
                </div>
                {it.preview && (
                  <div
                    style={{
                      fontSize: ".7rem",
                      color: "#8a8a7a",
                      marginTop: 2,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={it.preview}
                  >
                    « {it.preview} »
                  </div>
                )}
              </div>
              <span
                style={{
                  fontSize: ".68rem",
                  color: accent,
                  fontWeight: 500,
                  flexShrink: 0,
                  marginLeft: 8,
                }}
              >
                {formatMessageDate(it.when)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Coming soon stub ────────────────────────────────────────────────────

function ComingSoon({ section, version }) {
  return (
    <div style={comingSoonStyle}>
      <div style={{ fontSize: "1.6rem", marginBottom: 8 }}>🚧</div>
      <div style={{ fontSize: "0.9rem", color: "#cfcfc4", marginBottom: 4 }}>
        {section} — a venir
      </div>
      <div style={{ fontSize: "0.72rem", color: "#8a8a7a" }}>
        Cette section sera disponible en {version}.
      </div>
    </div>
  );
}

// ─── Atomes UI ──────────────────────────────────────────────────────────

function Row({ label, children }) {
  return (
    <div style={rowStyle}>
      <div style={rowLabelStyle}>{label}</div>
      <div style={rowValueStyle}>{children}</div>
    </div>
  );
}

function Pill({ color, small, children }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: small ? "1px 7px" : "2px 9px",
        fontSize: small ? ".68rem" : ".72rem",
        fontWeight: 600,
        color: color,
        background: hexA(color, 0.12),
        border: `1px solid ${hexA(color, 0.25)}`,
        borderRadius: 999,
        textTransform: "uppercase",
        letterSpacing: ".05em",
      }}
    >
      {children}
    </span>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────

function formatRelative(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    const diffMs = Date.now() - d.getTime();
    const minutes = Math.floor(diffMs / (1000 * 60));
    if (minutes < 1) return "a l'instant";
    if (minutes < 60) return `il y a ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `il y a ${hours} h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `il y a ${days} j`;
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
  } catch {
    return "—";
  }
}

/** Convertit #RRGGBB + alpha en rgba string. Pour les Pill backgrounds. */
function hexA(hex, alpha) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const r = parseInt(m[1].slice(0, 2), 16);
  const g = parseInt(m[1].slice(2, 4), 16);
  const b = parseInt(m[1].slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ─── Styles ─────────────────────────────────────────────────────────────

const panelStyle = {
  marginBottom: 16,
  padding: 14,
  background: "rgba(255,255,255,.025)",
  border: "1px solid rgba(255,255,255,.06)",
  borderRadius: 10,
};

const subTabsStyle = {
  display: "flex",
  gap: 4,
  marginBottom: 14,
  paddingBottom: 10,
  borderBottom: "1px solid rgba(255,255,255,.06)",
  flexWrap: "wrap",
};

const subTabBtnStyle = {
  padding: "5px 11px",
  fontSize: ".75rem",
  fontWeight: 500,
  color: "#8a8a7a",
  background: "transparent",
  border: "1px solid transparent",
  borderRadius: 6,
  cursor: "pointer",
  transition: "all 120ms ease",
};

const subTabBtnActiveStyle = {
  color: "#cfcfc4",
  background: "rgba(130, 195, 158, 0.08)",
  border: "1px solid rgba(130, 195, 158, 0.2)",
};

const contentStyle = {
  minHeight: 220,
};

const rowStyle = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "8px 0",
  borderBottom: "1px solid rgba(255,255,255,.04)",
  flexWrap: "wrap",
};

const rowLabelStyle = {
  flex: "0 0 200px",
  fontSize: ".72rem",
  color: "#8a8a7a",
  textTransform: "uppercase",
  letterSpacing: ".05em",
};

const rowValueStyle = {
  flex: 1,
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
};

const timeStyle = {
  fontSize: ".82rem",
  color: "#cfcfc4",
};

const emptyStyle = {
  padding: 16,
  fontSize: ".8rem",
  color: "#8a8a7a",
  textAlign: "center",
  background: "rgba(255,255,255,.025)",
  borderRadius: 10,
};

const emptyStateStyle = {
  padding: 24,
  textAlign: "center",
};

const loadingStyle = {
  padding: 24,
  textAlign: "center",
  fontSize: ".8rem",
  color: "#8a8a7a",
};

const comingSoonStyle = {
  padding: "32px 16px",
  textAlign: "center",
  background: "rgba(255,255,255,.015)",
  borderRadius: 8,
};

// ─── Styles MessagesTab (V94.43) ────────────────────────────────────────

const composerStyle = {
  background: "rgba(255,255,255,.025)",
  border: "1px solid rgba(255,255,255,.06)",
  borderRadius: 10,
  padding: 12,
};

const textareaStyle = {
  width: "100%",
  background: "rgba(255,255,255,.04)",
  border: "1px solid rgba(255,255,255,.1)",
  borderRadius: 8,
  padding: "8px 10px",
  color: "#d4c9a8",
  fontSize: ".85rem",
  fontFamily: "inherit",
  resize: "vertical",
  lineHeight: 1.5,
  boxSizing: "border-box",
};

const inputStyle = {
  width: "100%",
  background: "rgba(255,255,255,.04)",
  border: "1px solid rgba(255,255,255,.1)",
  borderRadius: 8,
  padding: "6px 10px",
  color: "#d4c9a8",
  fontSize: ".82rem",
  fontFamily: "inherit",
  boxSizing: "border-box",
};

const fieldLabelStyle = {
  fontSize: ".7rem",
  color: "#8a8a7a",
  textTransform: "uppercase",
  letterSpacing: ".05em",
  marginBottom: 4,
};

const attachToggleStyle = {
  background: "transparent",
  border: "1px solid rgba(255,255,255,.1)",
  borderRadius: 6,
  padding: "4px 9px",
  color: "#cfcfc4",
  fontSize: ".7rem",
  fontWeight: 500,
  cursor: "pointer",
};

const attachBlockStyle = {
  marginTop: 10,
  padding: 10,
  background: "rgba(130,195,158,.04)",
  border: "1px solid rgba(130,195,158,.15)",
  borderRadius: 8,
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const hintStyle = {
  fontSize: ".68rem",
  color: "#8a8a7a",
  lineHeight: 1.5,
  margin: 0,
};

const primaryBtnStyle = {
  padding: "7px 14px",
  borderRadius: 8,
  fontSize: ".8rem",
  fontWeight: 500,
};

const refreshBtnStyle = {
  background: "transparent",
  border: "1px solid rgba(255,255,255,.08)",
  borderRadius: 6,
  padding: "3px 9px",
  color: "#8a8a7a",
  fontSize: ".68rem",
  fontWeight: 500,
  cursor: "pointer",
};

const errorStyle = {
  marginTop: 8,
  padding: "8px 12px",
  background: "rgba(220,80,80,.08)",
  border: "1px solid rgba(220,80,80,.25)",
  color: "#f5c6c6",
  fontSize: ".78rem",
  borderRadius: 6,
};

const messageListStyle = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  listStyle: "none",
  padding: 0,
  margin: 0,
};

const messageItemStyle = {
  background: "rgba(255,255,255,.025)",
  border: "1px solid rgba(255,255,255,.06)",
  borderRadius: 8,
  padding: "10px 12px",
};

const attachmentLinkStyle = {
  marginTop: 8,
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "6px 10px",
  background: "rgba(130,195,158,.06)",
  border: "1px solid rgba(130,195,158,.18)",
  borderRadius: 6,
  color: "#cfcfc4",
  fontSize: ".8rem",
  textDecoration: "none",
  cursor: "pointer",
};

// V94.44 : modes selecteur attachment (bibliotheque vs custom URL)
const modeBtnStyle = {
  padding: "4px 10px",
  fontSize: ".7rem",
  fontWeight: 500,
  color: "#8a8a7a",
  background: "transparent",
  border: "1px solid rgba(255,255,255,.06)",
  borderRadius: 6,
  cursor: "pointer",
  transition: "all 120ms ease",
};

const modeBtnActiveStyle = {
  color: "#cfcfc4",
  background: "rgba(130, 195, 158, 0.08)",
  border: "1px solid rgba(130, 195, 158, 0.2)",
};

// V94.44 : item de la liste de ressources
const resourceItemStyle = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "10px 12px",
  background: "rgba(255,255,255,.025)",
  border: "1px solid rgba(255,255,255,.06)",
  borderRadius: 8,
};

const archiveBtnStyle = {
  background: "transparent",
  border: "1px solid rgba(220,80,80,.2)",
  borderRadius: 6,
  padding: "4px 8px",
  color: "#cfcfc4",
  fontSize: ".85rem",
  cursor: "pointer",
  flexShrink: 0,
};

// V94.51 : EmptyState helper — design coherent partout
function EmptyState({ icon = "📭", title, hint }) {
  return (
    <div
      style={{
        padding: "28px 16px",
        textAlign: "center",
        background: "rgba(255,255,255,.015)",
        border: "1px dashed rgba(255,255,255,.06)",
        borderRadius: 10,
      }}
    >
      <div style={{ fontSize: "1.6rem", marginBottom: 8, opacity: 0.7 }}>{icon}</div>
      <div style={{ fontSize: ".9rem", color: "#cfcfc4", marginBottom: hint ? 4 : 0 }}>
        {title}
      </div>
      {hint && <div style={{ fontSize: ".72rem", color: "#8a8a7a", lineHeight: 1.5, maxWidth: 360, margin: "0 auto" }}>{hint}</div>}
    </div>
  );
}

// V94.51 : Skeleton loader — placeholder anime au chargement
function Skeleton({ height = 12, width = "100%", radius = 6 }) {
  return (
    <div
      style={{
        height,
        width,
        borderRadius: radius,
        background: "linear-gradient(90deg, rgba(255,255,255,.04) 0%, rgba(255,255,255,.08) 50%, rgba(255,255,255,.04) 100%)",
        backgroundSize: "200% 100%",
        animation: "ccap-shimmer 1.4s infinite linear",
      }}
    />
  );
}

function SkeletonGroup({ rows = 4 }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "8px 0" }}>
      <style>{`@keyframes ccap-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <Skeleton height={14} width="160px" />
          <Skeleton height={20} width="80px" radius={999} />
        </div>
      ))}
    </div>
  );
}

// V94.51 : Workflow checklist — guide visuel des etapes d'authoring app cliente
function WorkflowChecklist({
  hasPlan,
  letterFilled,
  recipesFilledCount,
  totalMeals,
  clientPublished,
  onJumpTo,
}) {
  // Aucun plan = pas de checklist (rien a faire ici)
  if (!hasPlan) return null;

  const recipesDone = totalMeals === 0 ? false : recipesFilledCount === totalMeals;

  const steps = [
    {
      id: "letter",
      label: "Lettre d'intro personnalisee",
      hint: letterFilled
        ? "Lettre redigee — relisez ou regenerez"
        : "Generer la lettre d'ouverture du plan",
      done: letterFilled,
      icon: "✉️",
      action: () => onJumpTo?.("letter"),
    },
    totalMeals > 0 && {
      id: "recipes",
      label: "Recettes detaillees",
      hint: totalMeals === 0
        ? "Aucun repas detecte"
        : recipesDone
          ? `Toutes les ${totalMeals} recettes enrichies`
          : `${recipesFilledCount}/${totalMeals} recettes enrichies — completer`,
      done: recipesDone,
      icon: "🍳",
      action: () => onJumpTo?.("recipes"),
    },
    {
      id: "publish",
      label: clientPublished ? "Republier le programme" : "Publier le programme",
      hint: clientPublished
        ? "Les changements ne sont visibles qu'apres une nouvelle publication"
        : "Activer le compte cliente en publiant le plan",
      done: clientPublished && letterFilled && (totalMeals === 0 || recipesDone),
      icon: "👁️",
      action: null, // l'action principale est le bouton "Apercu & Publier" au-dessus
    },
  ].filter(Boolean);

  const completed = steps.filter((s) => s.done).length;
  const progress = Math.round((completed / steps.length) * 100);

  return (
    <div style={checklistContainerStyle}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: ".82rem", color: "#cfcfc4", fontWeight: 600 }}>
            Parcours app cliente
          </div>
          <div style={{ fontSize: ".7rem", color: "#8a8a7a", marginTop: 2 }}>
            {completed === steps.length
              ? "Toutes les etapes faites — pret a publier"
              : `${completed} / ${steps.length} etapes completees`}
          </div>
        </div>
        <div style={{ fontSize: ".75rem", color: "#82c39e", fontWeight: 600 }}>
          {progress}%
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 4, background: "rgba(255,255,255,.05)", borderRadius: 2, overflow: "hidden", marginBottom: 12 }}>
        <div
          style={{
            height: "100%",
            width: `${progress}%`,
            background: "linear-gradient(90deg, #82c39e, #5fa178)",
            borderRadius: 2,
            transition: "width 240ms ease-out",
          }}
        />
      </div>

      <ul style={{ display: "flex", flexDirection: "column", gap: 4, listStyle: "none", padding: 0, margin: 0 }}>
        {steps.map((step) => {
          const clickable = !!step.action;
          return (
            <li key={step.id}>
              <button
                type="button"
                onClick={step.action || undefined}
                disabled={!clickable}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 10px",
                  background: "transparent",
                  border: "1px solid transparent",
                  borderRadius: 6,
                  cursor: clickable ? "pointer" : "default",
                  textAlign: "left",
                  transition: "background 120ms ease",
                }}
                onMouseEnter={(e) => {
                  if (clickable) e.currentTarget.style.background = "rgba(255,255,255,.025)";
                }}
                onMouseLeave={(e) => {
                  if (clickable) e.currentTarget.style.background = "transparent";
                }}
              >
                <span
                  style={{
                    flexShrink: 0,
                    width: 20,
                    height: 20,
                    borderRadius: 999,
                    background: step.done ? "#82c39e" : "rgba(255,255,255,.06)",
                    border: step.done ? "1px solid #82c39e" : "1px solid rgba(255,255,255,.1)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: ".7rem",
                    color: step.done ? "#0e1f15" : "#8a8a7a",
                    fontWeight: 700,
                  }}
                >
                  {step.done ? "✓" : ""}
                </span>
                <span style={{ flexShrink: 0, fontSize: "1rem" }}>{step.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: ".82rem",
                      color: step.done ? "#8a8a7a" : "#cfcfc4",
                      fontWeight: 500,
                      textDecoration: step.done ? "line-through" : "none",
                    }}
                  >
                    {step.label}
                  </div>
                  <div style={{ fontSize: ".7rem", color: "#8a8a7a", marginTop: 1 }}>
                    {step.hint}
                  </div>
                </div>
                {clickable && (
                  <span style={{ color: "#8a8a7a", fontSize: ".85rem", flexShrink: 0 }}>→</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// V94.51 : badge sur sous-onglet — '✓' (ok) / 'X/Y' (count) / '·' (todo)
function SubTabBadge({ kind, label }) {
  const colors = {
    ok: { bg: "rgba(130,195,158,0.18)", border: "rgba(130,195,158,0.35)", text: "#82c39e" },
    count: { bg: "rgba(232,160,64,0.12)", border: "rgba(232,160,64,0.3)", text: "#e8a040" },
    todo: { bg: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.08)", text: "#8a8a7a" },
  };
  const c = colors[kind] || colors.todo;
  return (
    <span
      style={{
        marginLeft: 6,
        padding: "1px 6px",
        fontSize: ".62rem",
        fontWeight: 600,
        background: c.bg,
        border: `1px solid ${c.border}`,
        color: c.text,
        borderRadius: 999,
        lineHeight: 1.2,
        display: "inline-flex",
        alignItems: "center",
      }}
    >
      {label}
    </span>
  );
}

// V94.50 : style du bouton 'Apercu & Publier' (CTA principale du hub)
function publishButtonStyle(enabled) {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: "12px 16px",
    background: enabled
      ? "linear-gradient(135deg, rgba(130,195,158,0.18), rgba(130,195,158,0.08))"
      : "rgba(255,255,255,.025)",
    border: `1px solid ${enabled ? "rgba(130,195,158,0.3)" : "rgba(255,255,255,.06)"}`,
    borderRadius: 10,
    color: enabled ? "#cfcfc4" : "#8a8a7a",
    fontSize: ".85rem",
    fontWeight: 500,
    cursor: enabled ? "pointer" : "not-allowed",
    opacity: enabled ? 1 : 0.55,
    transition: "all 120ms ease",
    textAlign: "left",
    width: "100%",
  };
}

// V94.51 : container de la WorkflowChecklist (parcours app cliente)
const checklistContainerStyle = {
  padding: 12,
  background: "rgba(130,195,158,0.04)",
  border: "1px solid rgba(130,195,158,0.15)",
  borderRadius: 10,
};

// V94.45 : item de signal (interet upsell ou ouverture attachment)
const signalItemStyle = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 12px",
  background: "rgba(255,255,255,.02)",
  border: "1px solid rgba(255,255,255,.05)",
  borderRadius: 8,
};
