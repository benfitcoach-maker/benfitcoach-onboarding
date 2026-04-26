// ─── ClientAppSettingsCard ─────────────────────────────────────────────
// Réglages app cliente, paramétrables par cliente. Affiché dans la fiche
// consultation côté SaaS Anissa.
//
// Aujourd'hui : 2 toggles pour le suivi du poids.
//
// Règles produit :
//   - Si cliente pas en staging → on cache tout (Anissa doit publier d'abord)
//   - Si tracking off → visible_to_client forcé à false côté serveur (cohérence)

import { useEffect, useState } from "react";
import {
  fetchClientAppConfig,
  updateClientAppConfig,
  ClientConfigError,
} from "./services/clientAppConfig";

export default function ClientAppSettingsCard({ client }) {
  const [state, setState] = useState({ status: "loading" });
  const [savingKey, setSavingKey] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    fetchClientAppConfig(client)
      .then((res) => {
        if (cancelled) return;
        setState({
          status: "ready",
          found: res.found,
          config: res.config,
        });
      })
      .catch((e) => {
        if (cancelled) return;
        const msg = e instanceof ClientConfigError ? e.message : String(e?.message || e);
        setState({ status: "error", error: msg });
      });
    return () => { cancelled = true; };
  }, [client?.id]);

  async function handleToggle(key, value) {
    if (savingKey) return;
    setSavingKey(key);
    try {
      const newConfig = await updateClientAppConfig(client, { [key]: value });
      setState((prev) => ({ ...prev, config: newConfig, found: true }));
    } catch (e) {
      // Affiche dans le card : on remet le state à ce qu'il était + message
      const msg = e instanceof ClientConfigError ? e.message : String(e?.message || e);
      // eslint-disable-next-line no-console
      console.error("[ClientAppSettings] update failed:", msg);
      alert(`Erreur : ${msg}`);
    } finally {
      setSavingKey(null);
    }
  }

  if (state.status === "loading") {
    return null; // discret pendant le chargement, pas de bruit visuel
  }
  if (state.status === "error") {
    return (
      <div style={{ ...cardStyle, color: "#f5c6c6", background: "rgba(220,80,80,.06)", border: "1px solid rgba(220,80,80,.2)" }}>
        ⚙️ Réglages app : {state.error}
      </div>
    );
  }
  if (!state.found) {
    // Cliente pas encore en staging → on n'affiche pas les réglages.
    return null;
  }

  const { weight_tracking_enabled, weight_visible_to_client } = state.config;

  return (
    <div style={cardStyle}>
      <div style={{ marginBottom: 10, fontSize: ".75rem", fontWeight: 600, color: "#8a8a7a", textTransform: "uppercase", letterSpacing: ".08em" }}>
        ⚙️ Réglages app cliente
      </div>

      <ToggleRow
        label="Suivi du poids"
        hint="Activer la collecte du poids pour cette cliente"
        checked={weight_tracking_enabled}
        loading={savingKey === "weight_tracking_enabled"}
        onChange={(v) => handleToggle("weight_tracking_enabled", v)}
      />

      <ToggleRow
        label="Visible dans son app"
        hint="Champ poids affiché dans 'Comment je me sens' (sinon coach uniquement)"
        checked={weight_visible_to_client}
        disabled={!weight_tracking_enabled}
        loading={savingKey === "weight_visible_to_client"}
        onChange={(v) => handleToggle("weight_visible_to_client", v)}
        nested
      />
    </div>
  );
}

const cardStyle = {
  marginBottom: 16,
  padding: 14,
  background: "rgba(255,255,255,.025)",
  border: "1px solid rgba(255,255,255,.06)",
  borderRadius: 10,
};

function ToggleRow({ label, hint, checked, disabled, loading, onChange, nested }) {
  const dim = disabled || loading;
  return (
    <label
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "8px 4px",
        cursor: dim && !loading ? "not-allowed" : "pointer",
        opacity: dim ? 0.5 : 1,
        marginLeft: nested ? 16 : 0,
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={dim}
        onChange={(e) => onChange(e.target.checked)}
        style={{
          marginTop: 3,
          width: 14,
          height: 14,
          accentColor: "#82c39e",
          cursor: dim && !loading ? "not-allowed" : "pointer",
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: ".82rem", color: "#cfcfc4", fontWeight: 500 }}>
          {label} {loading && <span style={{ fontSize: ".7rem", color: "#8a8a7a", marginLeft: 6 }}>…</span>}
        </div>
        <div style={{ fontSize: ".7rem", color: "#8a8a7a", marginTop: 1, lineHeight: 1.4 }}>
          {hint}
        </div>
      </div>
    </label>
  );
}
