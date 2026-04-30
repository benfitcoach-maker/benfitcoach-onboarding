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
        {activeTab === "resources" && <ComingSoon section="Ressources" version="V94.44" />}
        {activeTab === "signals" && <ComingSoon section="Signaux" version="V94.45" />}
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

  // Compose state
  const [draftBody, setDraftBody] = useState("");
  const [attachUrl, setAttachUrl] = useState("");
  const [attachLabel, setAttachLabel] = useState("");
  const [attachType, setAttachType] = useState("pdf");
  const [showAttach, setShowAttach] = useState(false);
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
    fetchCoachMessages({ email: client.email, limit: 20 })
      .then((res) => {
        if (cancelled) return;
        setMessages(res.messages);
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
      await sendCoachMessage({
        email: client?.email,
        body: draftBody,
        attachment_url: showAttach ? attachUrl : null,
        attachment_label: showAttach ? attachLabel : null,
        attachment_type: showAttach ? attachType : null,
      });
      // Reset form
      setDraftBody("");
      setAttachUrl("");
      setAttachLabel("");
      setAttachType("pdf");
      setShowAttach(false);
      reload();
    } catch (err) {
      const msg = err instanceof CoachMessageError ? err.message : String(err?.message || err);
      setSendError(msg);
    } finally {
      setSending(false);
    }
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
