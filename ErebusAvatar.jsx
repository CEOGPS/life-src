// ErebusAvatar.jsx — Floating Erebus avatar overlay
// Draggable widget that lives on top of everything; shows talking-head video or static avatar

import { useState, useRef, useEffect, useCallback } from "react";

const C = {
  e:"#9b72cf", eHi:"#c4a2f5", eDim:"rgba(155,114,207,0.12)",
  bg:"#07080f", card:"#0f1020", text:"#f0ede8", t2:"#a0a0b8", t3:"#50505a",
  teal:"#00c896", orange:"#ff8c42", red:"#ff4f5e",
};

const STATE_GLOW = {
  idle:    "rgba(155,114,207,0.3)",
  thinking:"rgba(255,140,66,0.5)",
  speaking:"rgba(0,200,150,0.5)",
};

export default function ErebusAvatar({ avatarVideoUrl, state = "idle", onMicClick, onClose }) {
  const [pos,       setPos]      = useState({ x: window.innerWidth - 110, y: window.innerHeight - 140 });
  const [dragging,  setDragging] = useState(false);
  const [expanded,  setExpanded] = useState(false);
  const [offset,    setOffset]   = useState({ x: 0, y: 0 });
  const videoRef = useRef(null);
  const containerRef = useRef(null);

  // Auto-play avatar video when URL changes
  useEffect(() => {
    if (avatarVideoUrl && videoRef.current) {
      videoRef.current.load();
      videoRef.current.play().catch(() => {});
    }
  }, [avatarVideoUrl]);

  const onMouseDown = useCallback((e) => {
    if (e.target.tagName === "BUTTON" || e.target.tagName === "VIDEO") return;
    e.preventDefault();
    setDragging(true);
    setOffset({ x: e.clientX - pos.x, y: e.clientY - pos.y });
  }, [pos]);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e) => {
      setPos({
        x: Math.max(0, Math.min(window.innerWidth  - 84, e.clientX - offset.x)),
        y: Math.max(0, Math.min(window.innerHeight - 84, e.clientY - offset.y)),
      });
    };
    const onUp = () => setDragging(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [dragging, offset]);

  const size = expanded ? 240 : 76;
  const glow = STATE_GLOW[state] || STATE_GLOW.idle;

  return (
    <div
      ref={containerRef}
      onMouseDown={onMouseDown}
      style={{
        position: "fixed",
        left: pos.x,
        top:  pos.y,
        width: size,
        height: expanded ? "auto" : size,
        zIndex: 9999,
        cursor: dragging ? "grabbing" : "grab",
        userSelect: "none",
        transition: dragging ? "none" : "width .25s, height .25s",
      }}
    >
      {/* Main avatar circle */}
      <div style={{
        width: size,
        height: size,
        borderRadius: expanded ? 16 : "50%",
        overflow: "hidden",
        border: `2px solid ${C.e}`,
        boxShadow: `0 0 24px ${glow}, 0 0 48px ${glow}44, inset 0 0 12px rgba(0,0,0,0.6)`,
        background: C.bg,
        position: "relative",
        transition: "border-radius .25s, box-shadow .4s",
      }}>
        {/* Avatar video or static image */}
        {avatarVideoUrl ? (
          <video
            ref={videoRef}
            src={avatarVideoUrl}
            loop
            playsInline
            style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 10%" }}
          />
        ) : (
          <img
            src="/agents/Erebus.png"
            alt="Erebus"
            style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 10%" }}
            onError={e => {
              e.target.style.display = "none";
              e.target.parentNode.innerHTML =
                '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:28px;color:#c4a2f5;font-weight:700">E</div>';
            }}
          />
        )}

        {/* State ring pulse */}
        {state !== "idle" && (
          <div style={{
            position: "absolute", inset: -2, borderRadius: "inherit",
            border: `2px solid ${state === "thinking" ? C.orange : C.teal}`,
            animation: "avatarRing 1.2s ease-in-out infinite",
            pointerEvents: "none",
          }} />
        )}
      </div>

      {/* Mic / expand controls below avatar */}
      <div style={{ display:"flex", justifyContent:"center", gap:6, marginTop:5 }}>
        {onMicClick && (
          <button
            onClick={onMicClick}
            title="Voice input"
            style={{
              width: 26, height: 26, borderRadius: "50%",
              background: state === "thinking" ? C.orange : C.eDim,
              border: `1px solid ${C.e}66`,
              color: C.eHi, fontSize: 13, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "background .2s",
            }}>
            🎤
          </button>
        )}
        <button
          onClick={() => setExpanded(e => !e)}
          title={expanded ? "Collapse" : "Expand"}
          style={{
            width: 26, height: 26, borderRadius: "50%",
            background: C.eDim, border: `1px solid ${C.e}44`,
            color: C.t2, fontSize: 11, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
          {expanded ? "▲" : "▼"}
        </button>
        {onClose && (
          <button
            onClick={onClose}
            title="Hide avatar"
            style={{
              width: 26, height: 26, borderRadius: "50%",
              background: "transparent", border: `1px solid rgba(255,79,94,0.3)`,
              color: C.red, fontSize: 12, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
            ×
          </button>
        )}
      </div>

      <style>{`
        @keyframes avatarRing {
          0%, 100% { opacity: 0.8; transform: scale(1); }
          50%       { opacity: 0.3; transform: scale(1.06); }
        }
      `}</style>
    </div>
  );
}
