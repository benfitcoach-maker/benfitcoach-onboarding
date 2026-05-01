// V96.3 — Widget "Photos recentes" du dashboard Anissa.
// Affiche un carrousel horizontal des 10 dernieres photos uploadees par
// les clientes. Click sur une photo → modal preview + boutons reaction
// emoji (heart / thumbs_up / fire / flower).

import { useEffect, useState, useCallback } from "react";
import { fetchRecentPhotos, setPhotoReaction } from "./services/fetchRecentPhotos";

const REACTION_EMOJI = {
  heart: "❤️",
  thumbs_up: "👍",
  fire: "🔥",
  flower: "🌸",
};

const REACTION_OPTIONS = ["heart", "thumbs_up", "fire", "flower"];

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const diffH = (now.getTime() - d.getTime()) / (1000 * 60 * 60);
  if (diffH < 1) return `il y a ${Math.max(1, Math.round(diffH * 60))} min`;
  if (diffH < 24) return `il y a ${Math.round(diffH)}h`;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export default function RecentPhotosWidget() {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activePhoto, setActivePhoto] = useState(null);

  const reload = useCallback(async () => {
    setLoading(true);
    const list = await fetchRecentPhotos(10);
    setPhotos(list);
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  async function handleReact(photoId, reaction) {
    // Update optimiste : affiche la reaction immediate, puis call API
    setPhotos((prev) =>
      prev.map((p) =>
        p.id === photoId
          ? { ...p, reaction, reacted_at: new Date().toISOString() }
          : p,
      ),
    );
    if (activePhoto?.id === photoId) {
      setActivePhoto((prev) =>
        prev ? { ...prev, reaction, reacted_at: new Date().toISOString() } : null,
      );
    }
    await setPhotoReaction(photoId, reaction);
  }

  if (!loading && photos.length === 0) return null;

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <div>
          <div style={titleStyle}>📸 Photos recentes des clientes</div>
          <div style={subtitleStyle}>
            {loading
              ? "Chargement…"
              : `${photos.length} photo${photos.length > 1 ? "s" : ""} — tap pour reagir`}
          </div>
        </div>
        <button
          type="button"
          onClick={reload}
          disabled={loading}
          style={refreshBtnStyle}
          title="Recharger"
        >
          ↻
        </button>
      </div>

      <div style={carouselStyle}>
        {photos.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setActivePhoto(p)}
            style={thumbBtnStyle}
            title={`${p.client_first_name || p.client_email || "Cliente"} · ${formatDate(p.created_at)}`}
          >
            <img src={p.url} alt="" style={thumbImgStyle} />
            <div style={thumbLabelStyle}>
              <div style={thumbNameStyle}>
                {p.client_first_name || (p.client_email ? p.client_email.split("@")[0] : "Cliente")}
              </div>
              <div style={thumbDateStyle}>{formatDate(p.created_at)}</div>
            </div>
            {p.reaction && (
              <div style={reactionBadgeStyle}>{REACTION_EMOJI[p.reaction]}</div>
            )}
          </button>
        ))}
      </div>

      {activePhoto && (
        <PhotoPreview
          photo={activePhoto}
          onClose={() => setActivePhoto(null)}
          onReact={(reaction) => handleReact(activePhoto.id, reaction)}
        />
      )}
    </div>
  );
}

function PhotoPreview({ photo, onClose, onReact }) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div role="dialog" aria-modal="true" onClick={onClose} style={modalBackdropStyle}>
      <div onClick={(e) => e.stopPropagation()} style={modalCardStyle}>
        <div style={modalHeaderStyle}>
          <div>
            <div style={modalNameStyle}>
              {photo.client_first_name || photo.client_email || "Cliente"}
            </div>
            <div style={modalSubStyle}>
              {formatDate(photo.created_at)} · slot {photo.meal_id}
            </div>
          </div>
          <button type="button" onClick={onClose} style={modalCloseStyle} aria-label="Fermer">
            ✕
          </button>
        </div>

        <img src={photo.url} alt="" style={modalImgStyle} />

        <div style={modalReactionsStyle}>
          {REACTION_OPTIONS.map((r) => {
            const active = photo.reaction === r;
            return (
              <button
                key={r}
                type="button"
                onClick={() => onReact(active ? null : r)}
                style={{
                  ...reactionBtnStyle,
                  ...(active ? reactionBtnActiveStyle : {}),
                }}
                title={active ? "Retirer la reaction" : "Reagir"}
              >
                <span style={{ fontSize: "1.4rem" }}>{REACTION_EMOJI[r]}</span>
              </button>
            );
          })}
        </div>
        <div style={modalHintStyle}>
          {photo.reaction
            ? "La cliente verra votre reaction dans son app."
            : "Tap un emoji pour reagir. La cliente verra votre reaction."}
        </div>
      </div>
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────

const containerStyle = {
  background: "rgba(255,255,255,.025)",
  border: "1px solid rgba(255,255,255,.06)",
  borderRadius: 12,
  padding: 16,
  marginBottom: 16,
};

const headerStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 12,
};

const titleStyle = { fontSize: ".95rem", color: "#cfcfc4", fontWeight: 600 };
const subtitleStyle = { fontSize: ".72rem", color: "#8a8a7a", marginTop: 2 };

const refreshBtnStyle = {
  background: "transparent",
  border: "1px solid rgba(255,255,255,.1)",
  color: "#8a8a7a",
  padding: "4px 10px",
  borderRadius: 6,
  fontSize: ".9rem",
  cursor: "pointer",
};

const carouselStyle = {
  display: "flex",
  gap: 12,
  overflowX: "auto",
  paddingBottom: 4,
  scrollbarWidth: "thin",
};

const thumbBtnStyle = {
  position: "relative",
  flex: "0 0 130px",
  background: "transparent",
  border: "none",
  padding: 0,
  cursor: "pointer",
  borderRadius: 10,
  overflow: "hidden",
  textAlign: "left",
};

const thumbImgStyle = {
  width: "100%",
  height: 130,
  objectFit: "cover",
  display: "block",
  borderRadius: 10,
  background: "rgba(255,255,255,.04)",
};

const thumbLabelStyle = {
  padding: "6px 8px 0",
};

const thumbNameStyle = {
  fontSize: ".78rem",
  color: "#cfcfc4",
  fontWeight: 500,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const thumbDateStyle = {
  fontSize: ".68rem",
  color: "#8a8a7a",
  marginTop: 1,
};

const reactionBadgeStyle = {
  position: "absolute",
  top: 6,
  right: 6,
  background: "rgba(0,0,0,.55)",
  borderRadius: 999,
  padding: "2px 8px",
  fontSize: "1rem",
  lineHeight: 1,
};

const modalBackdropStyle = {
  position: "fixed",
  inset: 0,
  zIndex: 9999,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(0,0,0,.75)",
  padding: 16,
};

const modalCardStyle = {
  width: "100%",
  maxWidth: 480,
  maxHeight: "90vh",
  display: "flex",
  flexDirection: "column",
  gap: 12,
  background: "#1a1f1c",
  border: "1px solid rgba(255,255,255,.08)",
  borderRadius: 16,
  padding: 16,
  overflowY: "auto",
};

const modalHeaderStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
};

const modalNameStyle = { fontSize: "1rem", color: "#cfcfc4", fontWeight: 600 };
const modalSubStyle = { fontSize: ".72rem", color: "#8a8a7a", marginTop: 2 };

const modalCloseStyle = {
  background: "transparent",
  border: "1px solid rgba(255,255,255,.1)",
  color: "#cfcfc4",
  width: 32,
  height: 32,
  borderRadius: 999,
  cursor: "pointer",
  fontSize: ".9rem",
};

const modalImgStyle = {
  width: "100%",
  maxHeight: "50vh",
  objectFit: "contain",
  borderRadius: 12,
  background: "rgba(0,0,0,.4)",
};

const modalReactionsStyle = {
  display: "flex",
  gap: 8,
  justifyContent: "center",
  paddingTop: 4,
};

const reactionBtnStyle = {
  background: "rgba(255,255,255,.05)",
  border: "1px solid rgba(255,255,255,.1)",
  borderRadius: 999,
  padding: "8px 14px",
  cursor: "pointer",
  transition: "all 200ms",
};

const reactionBtnActiveStyle = {
  background: "rgba(232,160,64,.18)",
  border: "1px solid rgba(232,160,64,.4)",
  transform: "scale(1.1)",
};

const modalHintStyle = {
  fontSize: ".72rem",
  color: "#8a8a7a",
  textAlign: "center",
  fontStyle: "italic",
  paddingTop: 4,
};
