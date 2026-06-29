import { useState } from "react";

const C = { blue: "#4ab3f4", orange: "#ff8c42", teal: "#00c896", purple: "#8b7fff", pink: "#ff6b9d", red: "#ff4f5e" };
const card = { background: "#13141f", border: "0.5px solid rgba(255,255,255,0.07)", borderRadius: 12 };

const MODELS = [
  { id: "claude", icon: "🤍", name: "Claude (Anthropic)", sub: "Sonnet 4 · Best for reasoning, writing, analysis", status: "active", badge: "Default", color: C.teal },
  { id: "grok", icon: "✦", name: "Grok (xAI)", sub: "Grok-4 · Real-time web, code, analysis", status: "connected", color: C.blue },
  { id: "deepseek", icon: "🔵", name: "DeepSeek", sub: "R1 · Deep reasoning, math, code", status: "api_needed", color: C.orange },
  { id: "meta", icon: "🌐", name: "Meta AI (Llama)", sub: "Llama 4 · Open, fast, multilingual", status: "via_groq", badge: "Via Groq", color: C.purple },
  { id: "groq", icon: "⚡", name: "Groq", sub: "Llama 3.3 70B · Ultra-fast inference LPU", status: "connected", color: C.blue },
  { id: "ollama", icon: "🦙", name: "Ollama (Local)", sub: "Run models locally · private · offline", status: "local", color: "#6aaedd" },
  { id: "gemini", icon: "💎", name: "Google Gemini", sub: "Gemini 2.5 · Multimodal · Google Cloud", status: "api_needed", color: C.orange },
  { id: "perplexity", icon: "🔍", name: "Perplexity", sub: "Real-time search-grounded answers", status: "not_connected", color: "#6aaedd" },
  { id: "gpt4", icon: "🔷", name: "OpenAI GPT-4o", sub: "GPT-4o · Multimodal · Code · Vision", status: "api_needed", color: C.orange },
  { id: "mistral", icon: "🌪", name: "Mistral AI", sub: "Mistral Large · Efficient · European", status: "not_connected", color: "#6aaedd" },
  { id: "cohere", icon: "🌊", name: "Cohere", sub: "Command R+ · Enterprise RAG", status: "not_connected", color: "#6aaedd" },
  { id: "anthropic2", icon: "🔮", name: "Claude Opus", sub: "Opus 4 · Most capable · Complex tasks", status: "api_needed", color: C.purple },
  { id: "together", icon: "🤝", name: "Together AI", sub: "70+ open models · Fast · Affordable", status: "not_connected", color: "#6aaedd" },
  { id: "fireworks", icon: "🎆", name: "Fireworks AI", sub: "FireFunction · Fast function calling", status: "not_connected", color: "#6aaedd" },
  { id: "replicate", icon: "♾", name: "Replicate", sub: "Image, audio, video AI models", status: "not_connected", color: "#6aaedd" },
  { id: "huggingface", icon: "🤗", name: "Hugging Face", sub: "Open-source model hub · Inference API", status: "not_connected", color: "#6aaedd" },
  { id: "openrouter", icon: "🔄", name: "OpenRouter", sub: "Route to any model · Unified API", status: "not_connected", color: "#6aaedd" },
  { id: "azure", icon: "☁", name: "Azure OpenAI", sub: "Enterprise GPT-4 · Private deployment", status: "not_connected", color: "#6aaedd" },
];

const STATUS_MAP = {
  active: { label: "● Active", color: C.teal },
  connected: { label: "● Connected", color: C.blue },
  api_needed: { label: "⚠ API Key Needed", color: C.orange },
  via_groq: { label: "● Via Groq", color: C.purple },
  local: { label: "⚠ Start: ollama run llama3.3", color: "#6aaedd" },
  not_connected: { label: "○ Not Connected", color: "#44444e" },
};

export default function AIModelsPanel() {
  const [keys, setKeys] = useState({});
  const [expandedId, setExpandedId] = useState(null);
  const [saved, setSaved] = useState({});

  function saveKey(id) {
    setSaved(s => ({ ...s, [id]: true }));
    setTimeout(() => setSaved(s => ({ ...s, [id]: false })), 2000);
  }

  return (
    <div style={{ padding: 24 }}>
      <p style={{ fontSize: 13, color: "#6aaedd", marginBottom: 20 }}>All your AI models in one place — switch, configure, and route intelligently.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        {MODELS.map(m => {
          const st = STATUS_MAP[m.status];
          const isExpanded = expandedId === m.id;
          return (
            <div key={m.id} style={{ ...card, overflow: "hidden" }}>
              <div style={{ padding: 16, display: "flex", gap: 12, alignItems: "flex-start", cursor: "pointer" }}
                onClick={() => setExpandedId(isExpanded ? null : m.id)}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: m.color + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{m.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#f0ede8" }}>{m.name}</span>
                    {m.badge && <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 20, background: m.color + "22", color: m.color, fontWeight: 600 }}>{m.badge}</span>}
                  </div>
                  <div style={{ fontSize: 11, color: "#6aaedd", lineHeight: 1.4 }}>{m.sub}</div>
                  <div style={{ fontSize: 10, color: st.color, marginTop: 5, fontWeight: 600 }}>{st.label}</div>
                </div>
              </div>
              {isExpanded && (
                <div style={{ padding: "0 16px 16px", borderTop: "0.5px solid rgba(255,255,255,0.05)" }}>
                  <div style={{ paddingTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                    {m.status === "api_needed" || m.status === "not_connected" ? (
                      <>
                        <input
                          placeholder={`${m.name} API Key`}
                          value={keys[m.id] || ""}
                          onChange={e => setKeys(k => ({ ...k, [m.id]: e.target.value }))}
                          type="password"
                          style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "0.5px solid rgba(255,255,255,0.12)", background: "#0d0e17", color: "#f0ede8", fontSize: 12, outline: "none" }}
                        />
                        <button onClick={() => saveKey(m.id)}
                          style={{ width: "100%", padding: "8px", borderRadius: 8, background: saved[m.id] ? "rgba(0,200,150,0.2)" : "rgba(74,179,244,0.15)", border: "0.5px solid " + (saved[m.id] ? C.teal : C.blue), color: saved[m.id] ? C.teal : C.blue, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                          {saved[m.id] ? "✓ Saved!" : "Connect →"}
                        </button>
                      </>
                    ) : (
                      <div style={{ display: "flex", gap: 8 }}>
                        <button style={{ flex: 1, padding: "8px", borderRadius: 8, background: "rgba(74,179,244,0.1)", border: "0.5px solid rgba(74,179,244,0.3)", color: C.blue, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Configure</button>
                        <button style={{ flex: 1, padding: "8px", borderRadius: 8, background: "rgba(255,79,94,0.1)", border: "0.5px solid rgba(255,79,94,0.3)", color: C.red, fontSize: 11, cursor: "pointer" }}>Disconnect</button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}