import { useState } from "react";
import AgentPanel from "./AgentPanel";
import AIModelsPanel from "./AIModelsPanel";
import ErebusPanel from "./ErebusPanel";

const C = {
  bg: "#0b0c14", card: "#13141f", border: "rgba(255,255,255,0.07)",
  blue: "#4ab3f4", teal: "#00c896", purple: "#8b7fff", orange: "#ff8c42",
  text: "#f0ede8", muted: "#6aaedd", erebus: "#9b72cf",
};

const TABS = [
  { id: "erebus", icon: "=",  label: "Erebus",    desc: "Autonomous intelligence core" },
  { id: "agents", icon: "AI", label: "AI Agents", desc: "7 specialized agents" },
  { id: "models", icon: "M",  label: "AI Models", desc: "Switch and configure AI models" },
];

export default function AIHubPanel() {
  const [tab, setTab] = useState("erebus");

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>

      <div style={{
        padding: "16px 24px 0",
        background: C.bg,
        borderBottom: "0.5px solid rgba(255,255,255,0.07)",
        flexShrink: 0,
      }}>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>AI Hub</div>
          <div style={{ fontSize: 11, color: C.muted }}>Your unified intelligence center</div>
        </div>

        <div style={{ display: "flex", gap: 4 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "9px 20px",
                borderRadius: "8px 8px 0 0",
                border: "none", cursor: "pointer",
                fontSize: 12, fontWeight: tab === t.id ? 700 : 400,
                background: tab === t.id ? C.card : "transparent",
                color: tab === t.id ? (t.id === "erebus" ? C.erebus : C.blue) : C.muted,
                borderBottom: tab === t.id ? ("2px solid " + (t.id === "erebus" ? C.erebus : C.teal)) : "2px solid transparent",
                transition: "all .15s",
              }}>
              <span>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflow: "hidden", background: C.bg }}>
        {tab === "erebus" && <ErebusPanel />}
        {tab === "agents" && <AgentPanel />}
        {tab === "models" && (
          <div style={{ height: "100%", overflowY: "auto" }}>
            <AIModelsPanel />
          </div>
        )}
      </div>

    </div>
  );
}
