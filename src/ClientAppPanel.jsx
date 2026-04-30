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

import { useEffect, useState } from "react";
import { fetchClientsStatus } from "./services/fetchClientsStatus";
import { getNutritionPlanMode, planModeLabel } from "./services/nutritionPlanMode";
import { fetchCoachMessages, sendCoachMessage, CoachMessageError } from "./services/sendCoachMessage";
import {
  fetchCoachResources,
  createCoachResource,
  archiveCoachResource,
  CoachResourceError,
} from "./services/coachResources";
import { fetchClientSignals, ClientSignalsError } from "./services/fetchClientSignals";

const SUB_TABS = [
  { id: "overview", label: "Vue d'ensemble" },
  { id: "messages", label: "Messages" },
  { id: "resources", label: "Ressources" },
  { id: "signals", label: "Signaux" },
];

export default function ClientAppPanel({ client, consultation }) {
  const [activeTab, setActiveTab] = useState("overview");

  if (!client) {
    return (
      <div style={emptyStyle}>
        Selectionnez une cliente pour voir sa vue app.
      </div>
    );
  }

  return (
    <div style={panelStyle}>
      {/* Sub-tabs nav */}
      <div style={subTabsStyle}>
        {SUB_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            style={{
              ...subTabBtnStyle,
              ...(activeTab === t.id ? subTabBtnActiveStyle : {}),
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={contentStyle}>
        {activeTab === "overview" && (
          <OverviewTab client={client} consultation={consultation} />
        )}
        {activeTab === "messages" && <MessagesTab client={client} />}
        {activeTab === "resources" && <ResourcesTab />}
        {activeTab === "signals" && <SignalsTab client={client} />}
      </div>
    </div>
  );
}

// ─── Vue d'ensemble ─────────────────────────────────────────────────────

function OverviewTab({ client, consultation }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!client?.email) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchClientsStatus([client.email])
      .then((map) => {
        if (cancelled) return;
        setStatus(map[client.email.toLowerCase()] || null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [client?.email]);

  const mode = getNutritionPlanMode(client);
  const modeLabel = planModeLabel(mode);
  const found = !!status?.found;
  const lastLoginAt = status?.last_login_at || null;
  const lastActivityAt = status?.last_activity_at || null;
  const feedbacks7d = status?.feedbacks_7d_count || 0;
  const newFeedbacks = status?.new_feedbacks_count || 0;

  if (loading) {
    return <div style={loadingStyle}>Chargement…</div>;
  }

  if (!found) {
    return (
      <div style={emptyStateStyle}>
        <div style={{ fontSize: "1rem", marginBottom: 6, color: "#cfcfc4" }}>
          Cette cliente n&apos;a pas encore d&apos;acces a l&apos;app.
        </div>
        <div style={{ fontSize: ".8rem", color: "#8a8a7a" }}>
          Publiez son plan dans l&apos;app cliente pour activer son compte.
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
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
    if (!client?.email) {
      setMessages([]);
      return;
    }
    setMessages(null);
    setError(null);
    // V94.44 : on charge en parallele les messages + la bibliotheque
    Promise.all([
      fetchCoachMessages({ email: client.email, limit: 20 }),
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
  }, [client?.email, reloadKey]);

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
        email: client?.email,
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

  if (!client?.email) {
    return (
      <div style={emptyStateStyle}>
        Cette cliente n&apos;a pas d&apos;email enregistre.
      </div>
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

        {messages === null && (
          <div style={loadingStyle}>Chargement…</div>
        )}

        {messages && messages.length === 0 && !error && (
          <div style={emptyStateStyle}>
            Aucun message envoye pour le moment.
          </div>
        )}

        {messages && messages.length > 0 && (
          <ul style={messageListStyle}>
            {messages.map((m) => (
              <MessageItem key={m.id} message={m} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function MessageItem({ message }) {
  const sentAt = formatMessageDate(message.sent_at);
  const readAt = message.read_at ? formatMessageDate(message.read_at) : null;
  const hasAttachment = !!(message.attachment_url && message.attachment_label);

  return (
    <li style={messageItemStyle}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: ".7rem", color: "#8a8a7a", textTransform: "uppercase", letterSpacing: ".05em" }}>
          Envoye {sentAt}
          {message.source === "ai_assisted" && " · IA"}
        </span>
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
      </div>
      <div style={{ fontSize: ".88rem", color: "#cfcfc4", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
        {message.body}
      </div>
      {hasAttachment && (
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
    if (!confirm(`Archiver "${label}" ?\n\nCette ressource ne sera plus selectionnable dans les nouveaux messages, mais reste accessible aux clientes qui l'ont deja recue.`)) return;
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

      {resources === null && <div style={loadingStyle}>Chargement…</div>}

      {resources && resources.length === 0 && !error && (
        <div style={emptyStateStyle}>
          <div style={{ fontSize: "1.4rem", marginBottom: 8 }}>📚</div>
          <div style={{ fontSize: ".9rem", color: "#cfcfc4" }}>Aucune ressource pour le moment.</div>
          <div style={{ fontSize: ".72rem", color: "#8a8a7a", marginTop: 4 }}>
            Ajoutez vos guides PDFs reutilisables (anti-inflammatoire, sommeil, etc.)
            pour les selectionner facilement dans les messages.
          </div>
        </div>
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
    if (!client?.email) {
      setSignals({ upgrade_interests: [], attachment_opens: [] });
      return;
    }
    setSignals(null);
    setError(null);
    fetchClientSignals({ email: client.email, limit: 50 })
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
  }, [client?.email, reloadKey]);

  if (!client?.email) {
    return (
      <div style={emptyStateStyle}>
        Cette cliente n&apos;a pas d&apos;email enregistre.
      </div>
    );
  }

  if (signals === null) {
    return <div style={loadingStyle}>Chargement…</div>;
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
