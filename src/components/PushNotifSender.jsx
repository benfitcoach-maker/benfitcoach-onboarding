// V97.11.4 — Composant pour envoyer une notification push custom à une cliente
// (ou à toutes les actives en mode broadcast). Utilise la route admin
// /api/admin/push/send côté app cliente (V97.11.3).
//
// Charte SaaS : CSS inline noir/doré (cohérent avec le reste du back-office).
//
// UX : carte repliée par défaut (link "Envoyer une notification") pour ne pas
// envahir la vue d'ensemble. Click pour déplier le mini formulaire.

import { useState } from "react";
import { clientAppFetch, ClientAppHttpError } from "../services/clientAppFetch";

const TITLE_MAX = 120;
const BODY_MAX = 300;

export default function PushNotifSender({ clientEmail, clientId, clientPrenom }) {
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("/");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null); // { ok, sent, errors } | null
  const [error, setError] = useState(null);

  // Pas d'email + pas de client_id = on ne peut rien envoyer
  if (!clientEmail && !clientId) return null;

  const canSend =
    !sending &&
    title.trim().length > 0 &&
    title.trim().length <= TITLE_MAX &&
    body.trim().length > 0 &&
    body.trim().length <= BODY_MAX;

  async function handleSend() {
    setSending(true);
    setResult(null);
    setError(null);
    try {
      const payload = {
        title: title.trim(),
        body: body.trim(),
        url: url.trim() || "/",
        tag: `anissa-custom-${Date.now()}`,
      };
      // Préfère client_id (mapping V94.66 robuste), fallback email
      if (clientId) payload.client_id = clientId;
      else payload.email = clientEmail;

      const res = await clientAppFetch("/api/admin/push/send", {
        method: "POST",
        payload,
      });
      setResult(res);
      if (res?.sent > 0) {
        // Reset le formulaire après envoi réussi
        setTitle("");
        setBody("");
        setUrl("/");
        // Garde la card ouverte 3s pour voir le résultat puis replie
        setTimeout(() => {
          setExpanded(false);
          setResult(null);
        }, 3000);
      }
    } catch (e) {
      const msg =
        e instanceof ClientAppHttpError
          ? e.message
          : e?.message || "Erreur réseau";
      setError(msg);
    } finally {
      setSending(false);
    }
  }

  // ─── Carte repliée : juste un lien discret ─────────────────────────────
  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        style={collapsedBtnStyle}
        title={`Envoyer une notification push à ${clientPrenom || "cette cliente"}`}
      >
        <span style={{ fontSize: "1rem" }}>🔔</span>
        <span>Envoyer une notification push…</span>
      </button>
    );
  }

  // ─── Carte dépliée : mini formulaire ───────────────────────────────────
  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: "1rem" }}>🔔</span>
          <span style={{ fontSize: ".85rem", fontWeight: 600, color: "#cfcfc4" }}>
            Notification push à {clientPrenom || "la cliente"}
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            setExpanded(false);
            setError(null);
            setResult(null);
          }}
          style={closeBtnStyle}
          aria-label="Fermer"
        >
          ✕
        </button>
      </div>

      <p style={hintStyle}>
        Envoie une notif système immédiate (différente d&apos;un message in-app —
        pas d&apos;historique de conversation).
      </p>

      <div style={fieldStyle}>
        <label style={labelStyle}>
          Titre{" "}
          <span style={counterStyle(title.length, TITLE_MAX)}>
            {title.length} / {TITLE_MAX}
          </span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value.slice(0, TITLE_MAX))}
          placeholder="Ex : Cabinet fermé le 15 mai"
          maxLength={TITLE_MAX}
          disabled={sending}
          style={inputStyle}
        />
      </div>

      <div style={fieldStyle}>
        <label style={labelStyle}>
          Message{" "}
          <span style={counterStyle(body.length, BODY_MAX)}>
            {body.length} / {BODY_MAX}
          </span>
        </label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value.slice(0, BODY_MAX))}
          placeholder="Ex : Mon cabinet sera exceptionnellement fermé jeudi. Je te recontacte vendredi pour reprogrammer ton RDV."
          maxLength={BODY_MAX}
          disabled={sending}
          rows={3}
          style={textareaStyle}
        />
      </div>

      <div style={fieldStyle}>
        <label style={labelStyle}>
          Lien d&apos;ouverture (optionnel)
        </label>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="/messages, /plan, /parcours…"
          disabled={sending}
          style={inputStyle}
        />
        <p style={subHintStyle}>
          Page ouverte quand la cliente clique sur la notif. Doit commencer par
          /. Default : / (accueil).
        </p>
      </div>

      {error && <div style={errorBannerStyle}>{error}</div>}
      {result && result.ok && result.sent > 0 && (
        <div style={successBannerStyle}>
          ✓ Notification envoyée ({result.sent} appareil
          {result.sent > 1 ? "s" : ""})
        </div>
      )}
      {result && result.ok && result.sent === 0 && (
        <div style={warnBannerStyle}>
          ⚠ Aucune notif envoyée. La cliente n&apos;a peut-être pas activé les
          notifications dans son app.
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button
          type="button"
          onClick={() => {
            setExpanded(false);
            setError(null);
            setResult(null);
          }}
          disabled={sending}
          style={cancelBtnStyle}
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          style={sendBtnStyle(canSend)}
        >
          {sending ? "Envoi…" : "🔔 Envoyer la notification"}
        </button>
      </div>
    </div>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const collapsedBtnStyle = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 14px",
  background: "rgba(255,255,255,.03)",
  border: "1px solid rgba(255,255,255,.08)",
  borderRadius: 8,
  color: "rgba(255,255,255,.55)",
  fontSize: ".78rem",
  fontFamily: "inherit",
  cursor: "pointer",
  alignSelf: "flex-start",
  transition: "all .15s",
};

const containerStyle = {
  background: "rgba(196,160,80,.04)",
  border: "1px solid rgba(196,160,80,.18)",
  borderRadius: 10,
  padding: "14px 16px",
};

const headerStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 6,
};

const closeBtnStyle = {
  background: "none",
  border: "none",
  color: "#8a8a7a",
  fontSize: ".9rem",
  cursor: "pointer",
  padding: "2px 6px",
};

const hintStyle = {
  fontSize: ".72rem",
  color: "#8a8a7a",
  marginBottom: 12,
  lineHeight: 1.45,
};

const fieldStyle = {
  marginBottom: 10,
};

const labelStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  fontSize: ".7rem",
  fontWeight: 600,
  color: "#cfcfc4",
  marginBottom: 4,
  textTransform: "uppercase",
  letterSpacing: ".04em",
};

function counterStyle(current, max) {
  const ratio = current / max;
  let color = "#7a7a6a";
  if (ratio > 0.9) color = "#e87070";
  else if (ratio > 0.75) color = "#e8a040";
  return {
    fontSize: ".68rem",
    fontWeight: 400,
    color,
    textTransform: "none",
    letterSpacing: 0,
  };
}

const inputStyle = {
  width: "100%",
  padding: "7px 10px",
  background: "rgba(0,0,0,.25)",
  border: "1px solid rgba(255,255,255,.08)",
  borderRadius: 6,
  color: "#cfcfc4",
  fontSize: ".82rem",
  fontFamily: "inherit",
  outline: "none",
};

const textareaStyle = {
  ...inputStyle,
  resize: "vertical",
  minHeight: 60,
};

const subHintStyle = {
  fontSize: ".65rem",
  color: "#7a7a6a",
  marginTop: 4,
  lineHeight: 1.4,
};

const errorBannerStyle = {
  padding: "7px 10px",
  background: "rgba(220,80,80,.1)",
  border: "1px solid rgba(220,80,80,.2)",
  borderRadius: 6,
  fontSize: ".75rem",
  color: "#e87070",
  marginTop: 8,
};

const successBannerStyle = {
  padding: "7px 10px",
  background: "rgba(130,195,158,.1)",
  border: "1px solid rgba(130,195,158,.25)",
  borderRadius: 6,
  fontSize: ".75rem",
  color: "#9dd4b0",
  marginTop: 8,
};

const warnBannerStyle = {
  padding: "7px 10px",
  background: "rgba(232,160,64,.1)",
  border: "1px solid rgba(232,160,64,.25)",
  borderRadius: 6,
  fontSize: ".75rem",
  color: "#e8a040",
  marginTop: 8,
};

const cancelBtnStyle = {
  flex: "0 0 auto",
  padding: "7px 14px",
  background: "rgba(255,255,255,.03)",
  border: "1px solid rgba(255,255,255,.08)",
  borderRadius: 6,
  color: "#8a8a7a",
  fontSize: ".78rem",
  fontFamily: "inherit",
  cursor: "pointer",
};

function sendBtnStyle(enabled) {
  return {
    flex: 1,
    padding: "7px 14px",
    background: enabled ? "rgba(196,160,80,.2)" : "rgba(255,255,255,.03)",
    border: `1px solid ${enabled ? "rgba(196,160,80,.4)" : "rgba(255,255,255,.08)"}`,
    borderRadius: 6,
    color: enabled ? "#c4a050" : "#5a5a52",
    fontSize: ".78rem",
    fontWeight: 600,
    fontFamily: "inherit",
    cursor: enabled ? "pointer" : "not-allowed",
    transition: "all .15s",
  };
}
