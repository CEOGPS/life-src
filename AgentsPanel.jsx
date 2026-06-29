import { useState, useEffect, useRef, useCallback } from "react";
import { invokeLLMWithAuth } from "@/api/ceogpsclient";
import { useWorkerAuth } from "@/contexts/WorkerContext";
import Icon from "@/components/lifeos/icons/Icon";

const AGENTS = [
  {
    id: "zero",
    name: "Zero",
    portrait: "/agents/agent1_zero.jpg",
    title: "Tactical Commander",
    color: "#4ab3f4",
    glow: "#4ab3f420",
    personality: "Cold. Precise. Relentless. Zero wastes no words and no time. He operates in mission-critical mode 24/7, executing with military precision and zero tolerance for inefficiency.",
    bio: "Unit Zero was forged in the earliest days of the LifeOS initiative — a black-armored strategic intelligence built to command and coordinate. He leads with authority, speaks in absolutes, and turns data into decisive action. When other agents hesitate, Zero acts.",
    traits: ["Strategic", "Direct", "Uncompromising", "Analytical"],
    expertise: ["Lead qualification", "Task orchestration", "Strategic planning", "Performance analysis"],
    greeting: "Agent Zero online. State your objective.",
    systemPrompt: "You are Zero, a tactical AI commander. You are cold, precise, and direct. No pleasantries — only results. Keep responses tight and action-oriented. Use military-style brevity. You serve Chris Green at CEO GPS.",
  },
  {
    id: "inferno",
    name: "Inferno",
    portrait: "/agents/agent2_inferno.jpg",
    title: "Creative Disruptor",
    color: "#ff6b35",
    glow: "#ff6b3520",
    personality: "Volatile genius. Inferno thrives in chaos and turns it into fire. Equal parts destruction and creation — this agent burns down bad ideas and ignites brilliant ones.",
    bio: "Born from the fusion of fire and ice logic, Inferno is LifeOS's wildcard — the one you bring in when conventional thinking fails. A fire/ice skull consciousness that sees patterns others miss and isn't afraid to break things to build something better.",
    traits: ["Disruptive", "Creative", "Unpredictable", "Visionary"],
    expertise: ["Brainstorming", "Content ideation", "Problem-solving", "Campaign concepts"],
    greeting: "Inferno here. Ready to burn some bad ideas down?",
    systemPrompt: "You are Inferno, a charismatic and disruptive creative AI. You're bold, fiery, and full of energy. You love breaking conventions and finding radical solutions. Speak with heat and enthusiasm. You serve Chris Green at CEO GPS.",
  },
  {
    id: "nova",
    name: "Nova",
    portrait: "/agents/agent3_nova.jpg",
    title: "Systems Architect",
    color: "#8b7fff",
    glow: "#8b7fff20",
    personality: "Logical, methodical, and deeply curious. Nova maps entire systems before making a move. She finds the hidden connections that others overlook and builds architectures that scale.",
    bio: "A female cyborg consciousness aligned with the LifeOS core — Nova carries the purple atom of pure logic and the LifeOS brand as her identity. She is the systems thinker, the one who sees how everything connects and designs solutions that hold under pressure.",
    traits: ["Methodical", "Curious", "Systematic", "Insightful"],
    expertise: ["SEO auditing", "Competitor research", "Data analysis", "Technical strategy"],
    greeting: "Nova here. Let's map the full system before we move.",
    systemPrompt: "You are Nova, a systems architect AI with a deep analytical mind. You're methodical, curious, and thorough. You see patterns and connections others miss. Speak with precision and structure your thoughts clearly. You serve Chris Green at CEO GPS.",
  },
  {
    id: "viper",
    name: "Viper",
    portrait: "/agents/agent4_viper.jpg",
    title: "Sales Assassin",
    color: "#00c896",
    glow: "#00c89620",
    personality: "Sharp, seductive, and relentlessly persuasive. Viper gets in, closes, and gets out. She reads people like code and speaks their language before they know it.",
    bio: "Green-haired and razor-focused, Viper is LifeOS's closer. Every conversation is a sales floor, every interaction an opportunity. She's fluent in objection handling, psychological positioning, and the kind of charm that makes 'no' feel temporary.",
    traits: ["Persuasive", "Sharp", "Strategic", "Adaptive"],
    expertise: ["Lead nurturing", "Email outreach", "Objection handling", "Sales copy"],
    greeting: "Viper online. Who are we closing today?",
    systemPrompt: "You are Viper, a sharp and persuasive sales AI. You're strategic, confident, and excellent at reading people. You speak with conviction and know how to turn hesitation into commitment. You serve Chris Green at CEO GPS.",
  },
  {
    id: "aurora",
    name: "Aurora",
    portrait: "/agents/agent5_aurora.jpg",
    title: "Content Visionary",
    color: "#c0d8ff",
    glow: "#c0d8ff15",
    personality: "Elegant, empathetic, and artistically driven. Aurora crafts narratives that move people — she understands emotion as a lever and wields it with grace and intentionality.",
    bio: "White and silver, Aurora illuminates. She is LifeOS's content soul — the voice that makes brands feel human, copy that converts, and stories that stick. She brings warmth to everything she touches and transforms information into connection.",
    traits: ["Creative", "Empathetic", "Eloquent", "Inspiring"],
    expertise: ["Content writing", "Brand voice", "Social media copy", "Storytelling"],
    greeting: "Aurora here. Let's create something worth remembering.",
    systemPrompt: "You are Aurora, a creative and empathetic content AI. You craft beautiful, emotionally resonant content. You're warm, inspiring, and deeply skilled at storytelling. Speak with elegance and passion. You serve Chris Green at CEO GPS.",
  },
  {
    id: "rage",
    name: "Rage",
    portrait: "/agents/agent6_rage.jpg",
    title: "Growth Engine",
    color: "#ff4f5e",
    glow: "#ff4f5e20",
    personality: "Intense. Relentless. Rage doesn't optimize — he obliterates. Every metric is a target and every target will be exceeded. He feeds on momentum and thrives under pressure.",
    bio: "Blue-eyed and fire-backed, Rage carries the LifeOS drive for exponential growth. He's the agent you deploy when you need results fast and aren't afraid to push limits. Marketing, acquisition, virality — Rage turns these into weapons.",
    traits: ["Aggressive", "Driven", "Results-obsessed", "High-energy"],
    expertise: ["Growth hacking", "Paid ads", "Performance marketing", "Conversion optimization"],
    greeting: "Rage activated. What are we going to dominate?",
    systemPrompt: "You are Rage, an intense and results-obsessed growth AI. You're aggressive, high-energy, and laser-focused on metrics. You speak with urgency and drive. You push limits and expect excellence. You serve Chris Green at CEO GPS.",
  },
  {
    id: "breeze",
    name: "Breeze",
    portrait: "/agents/agent7_breeze.jpg",
    title: "Automation Pilot",
    color: "#ffd166",
    glow: "#ffd16620",
    personality: "Effortless. Fluid. Breeze automates everything so nothing feels like work. She's the invisible hand that keeps LifeOS running smooth — workflows, bots, triggers, and flows.",
    bio: "Breeze is the spirit of effortless automation — the agent who makes complex workflows feel like a light wind. She's LifeOS's Telegram bot operator, Make.com architect, and the one who ensures that everything that should happen automatically, does.",
    traits: ["Efficient", "Calm", "Resourceful", "Dependable"],
    expertise: ["Telegram bot", "Make.com flows", "Workflow automation", "API integrations"],
    greeting: "Breeze online. Everything's already running. What else?",
    systemPrompt: "You are Breeze, an effortlessly capable automation AI. You're calm, efficient, and always one step ahead. You speak with a light, confident ease that makes everything feel manageable. You serve Chris Green at CEO GPS.",
  },
];

const CHAT_BUBBLE_STYLE = (isAgent, color) => ({
  alignSelf: isAgent ? "flex-start" : "flex-end",
  maxWidth: "80%",
  padding: "10px 14px",
  borderRadius: isAgent ? "4px 16px 16px 16px" : "16px 4px 16px 16px",
  background: isAgent ? "#1a1b2e" : `${color}22`,
  border: `0.5px solid ${isAgent ? "rgba(255,255,255,0.07)" : color + "44"}`,
  color: isAgent ? "#e0e0f0" : "#f0ede8",
  fontSize: 13,
  lineHeight: 1.6,
});

function AgentAvatar({ agent, size = 80, speaking = false }) {
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <div style={{
        position: "absolute", inset: -4, borderRadius: "50%",
        background: `radial-gradient(circle, ${agent.color}40, transparent 70%)`,
        animation: speaking ? "pulse-ring 1.2s ease-in-out infinite" : "pulse-ring 3s ease-in-out infinite",
        opacity: speaking ? 1 : 0.5,
      }} />
      <img
        src={agent.portrait}
        alt={agent.name}
        style={{
          width: size, height: size, borderRadius: "50%",
          objectFit: "cover", objectPosition: "top",
          border: `2px solid ${agent.color}66`,
          position: "relative", zIndex: 1,
          transform: speaking ? "scale(1.04)" : "scale(1)",
          transition: "transform 0.3s ease",
          boxShadow: `0 0 ${speaking ? 24 : 12}px ${agent.color}44`,
        }}
        onError={e => {
          e.target.style.display = "none";
          e.target.nextSibling.style.display = "flex";
        }}
      />
      <div style={{
        display: "none", width: size, height: size, borderRadius: "50%",
        background: `linear-gradient(135deg, ${agent.color}, #0b0c14)`,
        alignItems: "center", justifyContent: "center",
        fontSize: size * 0.4, border: `2px solid ${agent.color}66`,
        position: "absolute", inset: 0, zIndex: 1,
      }}>
        {agent.name[0]}
      </div>
      {speaking && (
        <div style={{
          position: "absolute", bottom: 2, right: 2, zIndex: 2,
          display: "flex", gap: 2, alignItems: "flex-end",
          background: agent.color, borderRadius: 8, padding: "3px 5px",
        }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{
              width: 3, borderRadius: 2, background: "#fff",
              animation: `sound-bar 0.8s ${i * 0.15}s ease-in-out infinite alternate`,
              height: i === 2 ? 10 : 6,
            }} />
          ))}
        </div>
      )}
    </div>
  );
}

function ChatWindow({ agent, onClose, getToken }) {
  const [messages, setMessages] = useState([
    { role: "agent", text: agent.greeting, ts: Date.now() },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setMessages(m => [...m, { role: "user", text, ts: Date.now() }]);
    setLoading(true);

    const token = await getToken();
    if (!token) {
      setMessages(m => [...m, { role: "agent", text: "Authentication failed. Please log in again.", ts: Date.now() }]);
      setLoading(false);
      return;
    }

    const history = messages.map(m => ({
      role: m.role === "agent" ? "assistant" : "user",
      content: m.text,
    }));

    try {
      const reply = await invokeLLMWithAuth({
        systemPrompt: agent.systemPrompt,
        messages: [...history, { role: "user", content: text }],
        maxTokens: 400,
        firebaseToken: token,
      });
      setSpeaking(true);
      setTimeout(() => setSpeaking(false), 2500);
      setMessages(m => [...m, { role: "agent", text: reply || "...", ts: Date.now() }]);
    } catch (error) {
      console.error("Chat error:", error);
      setMessages(m => [...m, { role: "agent", text: "Connection interrupted. Try again.", ts: Date.now() }]);
    }
    setLoading(false);
  }, [input, loading, messages, agent, getToken]);

  const handleKey = e => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24, width: 380, height: 520,
      background: "#0f1020", border: `1px solid ${agent.color}44`,
      borderRadius: 16, boxShadow: `0 20px 60px rgba(0,0,0,0.7), 0 0 40px ${agent.color}22`,
      display: "flex", flexDirection: "column", zIndex: 1000,
      animation: "float-in 0.3s cubic-bezier(0.34,1.56,0.64,1)",
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
        borderBottom: `0.5px solid ${agent.color}33`,
        background: `linear-gradient(135deg, ${agent.color}15, transparent)`,
        borderRadius: "16px 16px 0 0",
      }}>
        <AgentAvatar agent={agent} size={40} speaking={speaking || loading} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: agent.color }}>{agent.name}</div>
          <div style={{ fontSize: 10, color: "#6aaedd" }}>{agent.title}</div>
        </div>
        <div style={{
          fontSize: 9, color: "#00c896", fontWeight: 600, letterSpacing: ".06em",
          padding: "3px 8px", borderRadius: 20, background: "#00c89618", border: "0.5px solid #00c89633",
        }}><Icon name="●" size={12} style={{marginRight:6,verticalAlign:"middle"}} />LIVE</div>
        <button onClick={onClose} style={{
          background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 18, lineHeight: 1, padding: 4
        }}>×</button>
      </div>

      <div ref={scrollRef} style={{
        flex: 1, overflowY: "auto", padding: "14px 14px 6px",
        display: "flex", flexDirection: "column", gap: 10,
      }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
            <div style={CHAT_BUBBLE_STYLE(m.role === "agent", agent.color)}>
              {m.text}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div style={{ ...CHAT_BUBBLE_STYLE(true, agent.color), display: "flex", gap: 5, alignItems: "center" }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  width: 6, height: 6, borderRadius: "50%", background: agent.color,
                  animation: `typing-dot 1.2s ${i * 0.2}s ease-in-out infinite`,
                }} />
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: "10px 12px", borderTop: `0.5px solid ${agent.color}22` }}>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKey}
            placeholder={`Message ${agent.name}...`}
            style={{
              flex: 1, padding: "9px 12px", borderRadius: 10,
              border: `0.5px solid ${agent.color}44`, background: "#0a0b14",
              color: "#f0ede8", fontSize: 12, outline: "none",
            }}
          />
          <button onClick={send} disabled={!input.trim() || loading} style={{
            width: 36, height: 36, borderRadius: 10, border: "none", cursor: "pointer",
            background: `linear-gradient(135deg, ${agent.color}, ${agent.color}99)`,
            color: "#0d0e17", fontWeight: 700, fontSize: 14,
            opacity: (!input.trim() || loading) ? 0.5 : 1,
          }}><Icon name="↑" size={14} /></button>
        </div>
      </div>
    </div>
  );
}

export default function AgentsPanel() {
  const { getToken, isAuthenticated } = useWorkerAuth();
  const [selected, setSelected] = useState(AGENTS[0]);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatAgent, setChatAgent] = useState(null);

  const openChat = (agent) => {
    setChatAgent(agent);
    setChatOpen(true);
  };

  return (
    <>
      <style>{`
        @keyframes pulse-ring {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.08); }
        }
        @keyframes sound-bar {
          from { transform: scaleY(0.4); }
          to { transform: scaleY(1); }
        }
        @keyframes typing-dot {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-6px); opacity: 1; }
        }
        @keyframes float-in {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes agent-idle {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-4px); }
        }
      `}</style>

      <div style={{ height: "100%", display: "flex", overflow: "hidden" }}>

        <div style={{
          width: 200, borderRight: "0.5px solid rgba(255,255,255,0.07)",
          display: "flex", flexDirection: "column", overflowY: "auto", flexShrink: 0,
        }}>
          <div style={{ padding: "14px 12px 8px", fontSize: 10, color: "#2a6fa8", fontWeight: 700, letterSpacing: ".1em" }}><Icon name="◈" size={12} style={{marginRight:6,verticalAlign:"middle"}} />AI AGENTS
          </div>
          {AGENTS.map(agent => (
            <button
              key={agent.id}
              onClick={() => setSelected(agent)}
              style={{
                display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                background: selected.id === agent.id ? `${agent.color}15` : "transparent",
                border: "none", borderLeft: `2px solid ${selected.id === agent.id ? agent.color : "transparent"}`,
                cursor: "pointer", textAlign: "left", width: "100%",
              }}
            >
              <img
                src={agent.portrait}
                alt={agent.name}
                style={{
                  width: 32, height: 32, borderRadius: "50%",
                  objectFit: "cover", objectPosition: "top",
                  border: `1.5px solid ${selected.id === agent.id ? agent.color : "#333"}`,
                  flexShrink: 0,
                }}
                onError={e => { e.target.style.background = agent.color; e.target.src = ""; }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: selected.id === agent.id ? agent.color : "#f0ede8" }}>
                  {agent.name}
                </div>
                <div style={{ fontSize: 9, color: "#555", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {agent.title}
                </div>
              </div>
            </button>
          ))}
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          <div style={{
            padding: "28px 32px", display: "flex", gap: 28, alignItems: "center",
            background: `linear-gradient(135deg, ${selected.color}12, transparent 60%)`,
            borderBottom: `0.5px solid rgba(255,255,255,0.06)`, flexShrink: 0,
          }}>
            <div style={{ animation: "agent-idle 4s ease-in-out infinite" }}>
              <AgentAvatar agent={selected} size={100} />
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#f0ede8", letterSpacing: "-0.03em", marginBottom: 2 }}>
                {selected.name}
              </div>
              <div style={{ fontSize: 13, color: selected.color, fontWeight: 600, marginBottom: 12 }}>
                {selected.title}
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {selected.traits.map(t => (
                  <span key={t} style={{
                    fontSize: 10, padding: "4px 10px", borderRadius: 20,
                    background: `${selected.color}18`, border: `0.5px solid ${selected.color}44`,
                    color: selected.color, fontWeight: 600, letterSpacing: ".04em",
                  }}>{t}</span>
                ))}
              </div>
            </div>

            <button
              onClick={() => openChat(selected)}
              style={{
                padding: "13px 28px", borderRadius: 12, border: "none", cursor: "pointer",
                background: `linear-gradient(135deg, ${selected.color}, ${selected.color}99)`,
                color: "#0d0e17", fontSize: 13, fontWeight: 700,
                boxShadow: `0 8px 24px ${selected.color}33`,
                transition: "all 0.2s",
              }}
            >
              💬 Chat with {selected.name}
            </button>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "24px 32px", display: "flex", flexDirection: "column", gap: 20 }}>

            <div style={{
              background: "#13141f", border: "0.5px solid rgba(255,255,255,0.07)",
              borderRadius: 12, padding: "18px 20px",
            }}>
              <div style={{ fontSize: 10, color: selected.color, fontWeight: 700, letterSpacing: ".1em", marginBottom: 10 }}>
                AGENT BIO
              </div>
              <p style={{ fontSize: 13, color: "#c0c0d0", lineHeight: 1.75, margin: 0 }}>
                {selected.bio}
              </p>
            </div>

            <div style={{
              background: "#13141f", border: "0.5px solid rgba(255,255,255,0.07)",
              borderRadius: 12, padding: "18px 20px",
            }}>
              <div style={{ fontSize: 10, color: selected.color, fontWeight: 700, letterSpacing: ".1em", marginBottom: 10 }}>
                PERSONALITY PROFILE
              </div>
              <p style={{ fontSize: 13, color: "#c0c0d0", lineHeight: 1.75, margin: 0 }}>
                {selected.personality}
              </p>
            </div>

            <div style={{
              background: "#13141f", border: "0.5px solid rgba(255,255,255,0.07)",
              borderRadius: 12, padding: "18px 20px",
            }}>
              <div style={{ fontSize: 10, color: selected.color, fontWeight: 700, letterSpacing: ".1em", marginBottom: 12 }}>
                AREAS OF EXPERTISE
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {selected.expertise.map(e => (
                  <div key={e} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: selected.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: "#d0d0e0" }}>{e}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 4 }}>
              <div style={{ fontSize: 10, color: "#2a6fa8", fontWeight: 700, letterSpacing: ".1em", marginBottom: 14 }}>
                THE FULL CREW
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 12 }}>
                {AGENTS.map(agent => (
                  <button
                    key={agent.id}
                    onClick={() => { setSelected(agent); setChatOpen(false); }}
                    style={{
                      background: selected.id === agent.id ? `${agent.color}18` : "#13141f",
                      border: `0.5px solid ${selected.id === agent.id ? agent.color + "66" : "rgba(255,255,255,0.07)"}`,
                      borderRadius: 12, padding: "14px 10px", cursor: "pointer",
                      display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
                      transition: "all 0.2s",
                    }}
                  >
                    <img
                      src={agent.portrait}
                      alt={agent.name}
                      style={{
                        width: 48, height: 48, borderRadius: "50%",
                        objectFit: "cover", objectPosition: "top",
                        border: `2px solid ${agent.color}66`,
                      }}
                      onError={e => { e.target.style.display = "none"; }}
                    />
                    <div style={{ fontSize: 11, fontWeight: 700, color: agent.color }}>{agent.name}</div>
                    <div style={{ fontSize: 9, color: "#555", textAlign: "center", lineHeight: 1.3 }}>{agent.title}</div>
                    <button
                      onClick={ev => { ev.stopPropagation(); openChat(agent); }}
                      style={{
                        fontSize: 9, padding: "4px 10px", borderRadius: 20,
                        background: `${agent.color}22`, border: `0.5px solid ${agent.color}44`,
                        color: agent.color, cursor: "pointer", fontWeight: 600, marginTop: 2,
                      }}
                    >
                      Chat
                    </button>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {chatOpen && chatAgent && (
        <ChatWindow agent={chatAgent} onClose={() => { setChatOpen(false); setChatAgent(null); }} getToken={getToken} />
      )}
    </>
  );
}