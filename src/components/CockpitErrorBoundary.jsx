// ─── CockpitErrorBoundary ──────────────────────────────────────────────
// V97.17.5.2 — Error boundary defensif autour du cockpit Suivi etape 8.
//
// Apres un crash signale par Anissa (page entierement noire suite a un
// clic sur "Accepter" un parcours custom), on isole les composants
// cockpit dans une boundary qui :
//   - capture l'erreur
//   - affiche une carte d'erreur localisee
//   - garde le reste de la page Suivi fonctionnel
//   - permet a Anissa de continuer son travail meme si le cockpit phases
//     est casse
//
// React Error Boundary necessite un composant CLASSE (les hooks ne
// supportent pas componentDidCatch / getDerivedStateFromError).

import { Component } from "react";

export default class CockpitErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Logging discret en console pour debug par Benoit. Aucun envoi reseau.
    // eslint-disable-next-line no-console
    console.error("[CockpitErrorBoundary] Crash capture :", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      const errMsg =
        this.state.error?.message ||
        String(this.state.error) ||
        "Erreur inconnue dans le cockpit.";
      return (
        <div
          style={{
            background: "rgba(184, 134, 38, 0.08)",
            border: "1px solid rgba(184, 134, 38, 0.4)",
            borderRadius: 12,
            padding: "18px 20px",
            marginBottom: 24,
            color: "#785a1a",
          }}
        >
          <div
            style={{
              fontSize: 11,
              letterSpacing: ".12em",
              fontWeight: 700,
              textTransform: "uppercase",
              marginBottom: 6,
            }}
          >
            ⚠ Cockpit indisponible
          </div>
          <p style={{ margin: "0 0 10px 0", fontSize: 13, lineHeight: 1.5 }}>
            Un composant du cockpit Suivi a rencontre une erreur. Le reste de
            la page reste utilisable. Tu peux essayer de recharger juste le
            cockpit, ou rafraichir toute la page (CTRL+SHIFT+R).
          </p>
          <pre
            style={{
              fontSize: 11,
              background: "rgba(0,0,0,0.05)",
              padding: "8px 10px",
              borderRadius: 6,
              overflow: "auto",
              maxHeight: 100,
              margin: "0 0 10px 0",
              fontFamily: "monospace",
              color: "#5a4014",
            }}
          >
            {errMsg}
          </pre>
          <button
            type="button"
            onClick={this.handleRetry}
            style={{
              background: "#785a1a",
              border: "1px solid #785a1a",
              borderRadius: 7,
              padding: "8px 14px",
              fontSize: 12.5,
              fontWeight: 600,
              color: "#FAF9F6",
              cursor: "pointer",
            }}
          >
            Recharger le cockpit
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
