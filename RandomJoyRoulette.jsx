import { useState, useCallback, useEffect, useRef } from "react";
import { invokeLLM } from "@/api/ceogpsclient";

const C = { teal: "#00c896", gold: "#ffd700", orange: "#ff8c42", pink: "#ff6b9d", purple: "#8b7fff", blue: "#4ab3f4", red: "#ff4f5e" };

const JOY_LOG_KEY = "lifeos1_joy_log";
function load(key, def) { try { return JSON.parse(localStorage.getItem(key) || "null") ?? def; } catch { return def; } }
function save(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

// ── Mood / energy options ─────────────────────────────────────────────────────
const MOODS = [
  { id: "silly",    label: "🤪 Silly",     desc: "Ready for absurdity"   },
  { id: "chill",    label: "😌 Chill",     desc: "Low-key is fine"       },
  { id: "social",   label: "🤝 Social",    desc: "Want to connect"       },
  { id: "solo",     label: "🧘 Solo",      desc: "Just me time"          },
  { id: "restless", label: "⚡ Restless",  desc: "Need to move"          },
  { id: "creative", label: "🎨 Creative",  desc: "Something weird/artsy" },
];

const ENERGY = [
  { id: "low",    label: "🔋 Low",    desc: "Couch is calling"      },
  { id: "medium", label: "⚡ Medium", desc: "Up for something light" },
  { id: "high",   label: "🚀 High",   desc: "Let's get weird"       },
];

const CATEGORIES = [
  { id: "all",      label: "✨ All",       color: C.gold    },
  { id: "outdoor",  label: "🌳 Outdoor",  color: C.teal    },
  { id: "social",   label: "💬 Social",   color: C.pink    },
  { id: "creative", label: "🎨 Creative", color: C.purple  },
  { id: "silly",    label: "🤪 Silly",    color: C.orange  },
  { id: "digital",  label: "📱 Digital",  color: C.blue    },
  { id: "food",     label: "🍕 Food",     color: C.red     },
];

// ── Roulette wheel colors (segments) ─────────────────────────────────────────
const WHEEL_COLS = [C.teal, C.gold, C.orange, C.pink, C.purple, C.blue, C.red, C.teal];

// ── AI prompt ─────────────────────────────────────────────────────────────────
const JOY_SYSTEM = `You are the Random Joy Roulette for LifeOS1. You generate context-aware, instant micro-adventures for pure fun — no self-improvement framing, no productivity angle. Just genuine silly joy.

Given the user's mood, energy, and context, return ONLY valid JSON:
{
  "idea": {
    "title": "Punchy title (5-8 words, action-oriented)",
    "category": "one of: outdoor | social | creative | silly | digital | food",
    "instruction": "The full ridiculous adventure instruction — specific, actionable, funny, and vivid. 2-4 sentences. Reference Atlanta places when relevant. Make it feel personally crafted.",
    "timeRequired": "e.g. 10 minutes | 30 minutes | Right now",
    "difficultyLevel": "Easy | Medium | Bold",
    "funFactor": 9,
    "joyType": "one of: Laugh | Surprise | Connection | Discovery | Nostalgia | Absurdity | Warmth",
    "bestWith": "Solo | A friend | Group | Anyone",
    "emoji": "single perfect emoji for this idea",
    "followUp": "Optional ridiculous escalation if they want to take it further"
  }
}

Rules:
- Keep ideas harmless, safe, and genuinely fun
- Atlanta-specific when relevant (Piedmont Park, Ponce City Market, BeltLine, Little Five Points, etc.)
- Range from tiny (text a weird compliment) to wild (organize a spontaneous dance circle)
- Never add self-improvement or productivity framing — pure joy only
- Match energy level: low energy = couch-friendly; high energy = active/bold`;

function parseJSON(raw) {
  try { const m = raw.match(/\{[\s\S]*\}/); return m ? JSON.parse(m[0]) : null; } catch { return null; }
}

// ── Spinning wheel SVG ────────────────────────────────────────────────────────
function SpinWheel({ spinning, progress }) {
  const size = 180;
  const cx = size / 2, cy = size / 2, r = size * 0.44;
  const segments = 8;

  return (
    <svg width={size} height={size} style={{ transform: spinning ? `rotate(${progress * 1440}deg)` : "rotate(0deg)", transition: spinning ? "none" : "transform 0.3s ease" }}>
      {Array.from({ length: segments }, (_, i) => {
        const startAngle = (i / segments) * Math.PI * 2 - Math.PI / 2;
        const endAngle   = ((i + 1) / segments) * Math.PI * 2 - Math.PI / 2;
        const x1 = cx + Math.cos(startAngle) * r;
        const y1 = cy + Math.sin(startAngle) * r;
        const x2 = cx + Math.cos(endAngle)   * r;
        const y2 = cy + Math.sin(endAngle)   * r;
        const midAngle = (startAngle + endAngle) / 2;
        const tx = cx + Math.cos(midAngle) * r * 0.65;
        const ty = cy + Math.sin(midAngle) * r * 0.65;
        const EMOJIS = ["🎲","🌀","⭐","🎯","🔮","💥","🎪","🎨"];
        return (
          <g key={i}>
            <path d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} Z`}
              fill={WHEEL_COLS[i % WHEEL_COLS.length]}
              stroke="#0a0b12" strokeWidth={2} opacity={0.85} />
            <text x={tx} y={ty} textAnchor="middle" dominantBaseline="middle" fontSize={16}>{EMOJIS[i]}</text>
          </g>
        );
      })}
      {/* Center hub */}
      <circle cx={cx} cy={cy} r={18} fill="#0a0b12" stroke={C.teal} strokeWidth={3} />
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize={14}>✨</text>
    </svg>
  );
}

// ── Joy idea card ─────────────────────────────────────────────────────────────
function IdeaCard({ idea, onFavorite, isFavorite, onCopy, copied, compact = false }) {
  const catColors = { outdoor: C.teal, social: C.pink, creative: C.purple, silly: C.orange, digital: C.blue, food: C.red };
  const col = catColors[idea.category] || C.teal;
  const [showFollow, setShowFollow] = useState(false);

  return (
    <div style={{ background: `${col}08`, border: `1px solid ${col}30`, borderRadius: 14, overflow: "hidden" }}>
      {/* Card header */}
      <div style={{ padding: compact ? "12px 14px 8px" : "16px 18px 10px", borderBottom: `1px solid ${col}15` }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{ fontSize: compact ? 28 : 38, lineHeight: 1, flexShrink: 0 }}>{idea.emoji}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
              <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 10, background: `${col}20`, color: col, fontWeight: 700, textTransform: "uppercase" }}>{idea.category}</span>
              <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 10, background: "rgba(255,255,255,0.06)", color: "#6aaedd" }}>{idea.joyType}</span>
              <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 10, background: "rgba(255,255,255,0.06)", color: "#6aaedd" }}>⏱ {idea.timeRequired}</span>
            </div>
            <div style={{ fontSize: compact ? 14 : 16, fontWeight: 800, color: "#f0ede8", lineHeight: 1.2 }}>{idea.title}</div>
          </div>
          <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
            <button onClick={onFavorite} title={isFavorite ? "Unfavorite" : "Favorite"}
              style={{ background: "none", border: "none", fontSize: 16, cursor: "pointer", opacity: isFavorite ? 1 : 0.4 }}>⭐</button>
            <button onClick={onCopy} title="Copy idea"
              style={{ background: "none", border: "none", fontSize: 14, cursor: "pointer", color: copied ? C.teal : "#6aaedd" }}>
              {copied ? "✓" : "📋"}
            </button>
          </div>
        </div>
      </div>

      {/* Instruction */}
      <div style={{ padding: compact ? "10px 14px" : "14px 18px" }}>
        <div style={{ fontSize: 13, color: "#e2e8f0", lineHeight: 1.8, marginBottom: 10 }}>{idea.instruction}</div>

        {/* Meta row */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: idea.followUp ? 10 : 0 }}>
          {[
            { icon: "🎯", val: idea.difficultyLevel },
            { icon: "😄", val: `Fun: ${idea.funFactor}/10` },
            { icon: "👥", val: idea.bestWith },
          ].map(m => (
            <span key={m.val} style={{ fontSize: 10, padding: "3px 10px", borderRadius: 10, background: "rgba(255,255,255,0.05)", color: "#8892a4" }}>
              {m.icon} {m.val}
            </span>
          ))}
        </div>

        {/* Follow-up escalation */}
        {idea.followUp && (
          <div>
            <button onClick={() => setShowFollow(f => !f)}
              style={{ fontSize: 11, color: col, background: "none", border: "none", cursor: "pointer", fontWeight: 600, padding: 0 }}>
              {showFollow ? "▲ Hide" : "▼ Want to go further?"}
            </button>
            {showFollow && (
              <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: 10, background: `${col}10`, border: `1px solid ${col}20`, fontSize: 12, color: "#c8c8d0", lineHeight: 1.6 }}>
                🔥 {idea.followUp}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function RandomJoyRoulette({ onBack }) {
  const [activeTab, setActiveTab] = useState("spin");

  // Spin state
  const [mood,     setMood]     = useState(null);
  const [energy,   setEnergy]   = useState(null);
  const [spinning, setSpinning] = useState(false);
  const [spinProgress, setSpinProgress] = useState(0);
  const [currentIdea, setCurrentIdea] = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [copied,   setCopied]   = useState(false);

  // Joy Log
  const [log,       setLog]       = useState(() => load(JOY_LOG_KEY, []));
  const [favorites, setFavorites] = useState(() => new Set(load("lifeos1_joy_favs", [])));
  const [logFilter, setLogFilter] = useState("all");

  // Spin animation
  const spinInterval = useRef(null);

  useEffect(() => {
    if (spinning) {
      let p = 0;
      spinInterval.current = setInterval(() => {
        p += 0.015;
        setSpinProgress(p % 1);
        if (p >= 1) { clearInterval(spinInterval.current); setSpinning(false); }
      }, 16);
    }
    return () => clearInterval(spinInterval.current);
  }, [spinning]);

  // ── Spin! ────────────────────────────────────────────────────────────────
  const spin = useCallback(async () => {
    if (loading) return;
    setSpinning(true);
    setLoading(true);
    setCurrentIdea(null);
    setError("");
    setCopied(false);

    try {
      const prompt = [
        mood   && `Current mood: ${MOODS.find(m => m.id === mood)?.label} — ${MOODS.find(m => m.id === mood)?.desc}`,
        energy && `Energy level: ${ENERGY.find(e => e.id === energy)?.label} — ${ENERGY.find(e => e.id === energy)?.desc}`,
        `Location: Atlanta, GA`,
        `User: Marketing business owner, dad, gamer, loves the city`,
        log.length > 0 && `Recent ideas to avoid repeating: ${log.slice(0, 5).map(e => e.title).join(", ")}`,
      ].filter(Boolean).join("\n");

      const raw = await invokeLLM({ systemPrompt: JOY_SYSTEM, prompt });
      const parsed = parseJSON(raw);
      if (!parsed?.idea) { setError("Spin again — the roulette got confused."); setLoading(false); setSpinning(false); return; }

      const idea = { ...parsed.idea, id: Date.now(), spunAt: new Date().toISOString() };
      setCurrentIdea(idea);

      // Add to log
      const newLog = [idea, ...log].slice(0, 100);
      setLog(newLog); save(JOY_LOG_KEY, newLog);
    } catch (e) {
      setError("Spin failed. Check your AI key in Integrations.");
    }
    setLoading(false);
  }, [mood, energy, log, loading]);

  function toggleFavorite(id) {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      save("lifeos1_joy_favs", [...next]);
      return next;
    });
  }

  function copyIdea(idea) {
    navigator.clipboard.writeText(`${idea.emoji} ${idea.title}\n\n${idea.instruction}`).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 1800);
    });
  }

  function deleteLogEntry(id) {
    const next = log.filter(e => e.id !== id);
    setLog(next); save(JOY_LOG_KEY, next);
    const newFavs = new Set(favorites);
    newFavs.delete(id);
    setFavorites(newFavs);
    save("lifeos1_joy_favs", [...newFavs]);
  }

  const filteredLog = logFilter === "favorites"
    ? log.filter(e => favorites.has(e.id))
    : logFilter === "all" ? log
    : log.filter(e => e.category === logFilter);

  const TABS = [
    { id: "spin", label: "🎰 Spin" },
    { id: "log",  label: "📖 Joy Log", badge: log.length || null },
  ];

  const catColors = { outdoor: C.teal, social: C.pink, creative: C.purple, silly: C.orange, digital: C.blue, food: C.red };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* Header */}
      <div style={{ background: `linear-gradient(135deg, ${C.teal}15, ${C.gold}10)`, borderBottom: `1px solid ${C.teal}25`, padding: "14px 20px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={onBack} style={{ background: "none", border: "none", color: "#6aaedd", fontSize: 11, cursor: "pointer", padding: 0 }}>← Back</button>
          <span style={{ color: "#2a3a4a" }}>|</span>
          <span style={{ fontSize: 20 }}>🎰</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: C.teal }}>Random Joy Roulette</div>
            <div style={{ fontSize: 11, color: "#6aaedd" }}>Instant micro-adventures for pure, ridiculous joy</div>
          </div>
          {log.length > 0 && (
            <div style={{ display: "flex", gap: 14 }}>
              <div style={{ textAlign: "center" }}><div style={{ fontSize: 15, fontWeight: 800, color: C.teal }}>{log.length}</div><div style={{ fontSize: 9, color: "#4a5568" }}>Spins</div></div>
              <div style={{ textAlign: "center" }}><div style={{ fontSize: 15, fontWeight: 800, color: C.gold }}>{favorites.size}</div><div style={{ fontSize: 9, color: "#4a5568" }}>Favorites</div></div>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 2, padding: "6px 14px", background: "#0f1120", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            style={{ padding: "6px 13px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", background: activeTab === t.id ? `${C.teal}20` : "transparent", color: activeTab === t.id ? C.teal : "#6aaedd", borderBottom: activeTab === t.id ? `2px solid ${C.teal}` : "2px solid transparent" }}>
            {t.label}
            {t.badge && <span style={{ marginLeft: 4, background: C.teal, color: "#0a0b12", borderRadius: 10, padding: "1px 5px", fontSize: 9, fontWeight: 800 }}>{t.badge}</span>}
          </button>
        ))}
      </div>

      {/* ── SPIN TAB ── */}
      {activeTab === "spin" && (
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
          <div style={{ maxWidth: 600, margin: "0 auto" }}>

            {/* Wheel + spin button */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, marginBottom: 28 }}>
              {/* Pointer */}
              <div style={{ position: "relative", display: "inline-block" }}>
                <div style={{ position: "absolute", top: -16, left: "50%", transform: "translateX(-50%)", width: 0, height: 0, borderLeft: "12px solid transparent", borderRight: "12px solid transparent", borderTop: `24px solid ${C.gold}`, zIndex: 10 }} />
                <div style={{ transform: `rotate(${spinning ? spinProgress * 1440 : 0}deg)`, transition: spinning ? "none" : "transform 0.5s cubic-bezier(0.17,0.67,0.12,0.99)" }}>
                  <SpinWheel spinning={spinning} progress={spinProgress} />
                </div>
              </div>

              <button onClick={spin} disabled={loading || spinning}
                style={{ padding: "14px 40px", borderRadius: 50, background: loading || spinning ? "#1a1e2e" : `linear-gradient(135deg, ${C.teal}, ${C.gold})`, border: `2px solid ${loading || spinning ? C.teal + "30" : C.gold}`, color: loading || spinning ? C.teal : "#0a0b12", fontSize: 16, fontWeight: 900, cursor: loading || spinning ? "not-allowed" : "pointer", letterSpacing: ".04em", minWidth: 180, transition: "all 0.2s" }}>
                {spinning ? "✨ Spinning..." : loading ? "🔮 Generating..." : "🎰 SPIN"}
              </button>
            </div>

            {/* Mood + energy selectors */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
              <div style={{ background: "#11131f", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: 14 }}>
                <div style={{ fontSize: 10, color: "#4a5568", fontWeight: 700, marginBottom: 10 }}>CURRENT MOOD</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {MOODS.map(m => (
                    <button key={m.id} onClick={() => setMood(mood === m.id ? null : m.id)}
                      style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 8, border: `1px solid ${mood === m.id ? C.teal : "rgba(255,255,255,0.06)"}`, background: mood === m.id ? `${C.teal}15` : "transparent", cursor: "pointer", textAlign: "left" }}>
                      <span style={{ fontSize: 14 }}>{m.label.split(" ")[0]}</span>
                      <div>
                        <div style={{ fontSize: 11, color: mood === m.id ? C.teal : "#c8c8d0", fontWeight: mood === m.id ? 700 : 400 }}>{m.label.split(" ").slice(1).join(" ")}</div>
                        <div style={{ fontSize: 9, color: "#4a5568" }}>{m.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ background: "#11131f", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: 14 }}>
                <div style={{ fontSize: 10, color: "#4a5568", fontWeight: 700, marginBottom: 10 }}>ENERGY LEVEL</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 14 }}>
                  {ENERGY.map(e => (
                    <button key={e.id} onClick={() => setEnergy(energy === e.id ? null : e.id)}
                      style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 8, border: `1px solid ${energy === e.id ? C.gold : "rgba(255,255,255,0.06)"}`, background: energy === e.id ? `${C.gold}12` : "transparent", cursor: "pointer", textAlign: "left" }}>
                      <span style={{ fontSize: 18 }}>{e.label.split(" ")[0]}</span>
                      <div>
                        <div style={{ fontSize: 11, color: energy === e.id ? C.gold : "#c8c8d0", fontWeight: energy === e.id ? 700 : 400 }}>{e.label.split(" ").slice(1).join(" ")}</div>
                        <div style={{ fontSize: 9, color: "#4a5568" }}>{e.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
                {/* Quick tips */}
                <div style={{ padding: "8px 10px", borderRadius: 8, background: `${C.teal}08`, border: `1px solid ${C.teal}15` }}>
                  <div style={{ fontSize: 9, color: C.teal, fontWeight: 700, marginBottom: 3 }}>💡 TIP</div>
                  <div style={{ fontSize: 10, color: "#6aaedd", lineHeight: 1.5 }}>Set mood & energy for ideas tailored to how you actually feel right now.</div>
                </div>
              </div>
            </div>

            {/* Error */}
            {error && <div style={{ color: C.red, fontSize: 12, padding: "8px 12px", background: `${C.red}10`, borderRadius: 8, marginBottom: 14 }}>{error}</div>}

            {/* Current idea */}
            {currentIdea && (
              <div>
                <div style={{ fontSize: 10, color: "#4a5568", fontWeight: 700, marginBottom: 10, textAlign: "center", letterSpacing: ".08em" }}>YOUR JOY ADVENTURE</div>
                <IdeaCard
                  idea={currentIdea}
                  onFavorite={() => toggleFavorite(currentIdea.id)}
                  isFavorite={favorites.has(currentIdea.id)}
                  onCopy={() => copyIdea(currentIdea)}
                  copied={copied}
                />
                <button onClick={spin} disabled={loading || spinning}
                  style={{ width: "100%", marginTop: 12, padding: "10px", borderRadius: 10, background: "transparent", border: `1px solid ${C.teal}40`, color: C.teal, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                  🎰 Spin Again
                </button>
              </div>
            )}

            {/* Empty state */}
            {!currentIdea && !loading && !spinning && (
              <div style={{ textAlign: "center", padding: "20px 0", color: "#4a5568" }}>
                <div style={{ fontSize: 13, color: "#6aaedd" }}>Set your mood & energy (optional), then spin for your next micro-adventure.</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── JOY LOG TAB ── */}
      {activeTab === "log" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Filter bar */}
          <div style={{ padding: "8px 16px", borderBottom: "1px solid rgba(255,255,255,0.05)", background: "#0d0e17", display: "flex", gap: 6, flexWrap: "wrap", flexShrink: 0 }}>
            <button onClick={() => setLogFilter("favorites")}
              style={{ padding: "4px 12px", borderRadius: 20, border: `1px solid ${logFilter === "favorites" ? C.gold : "rgba(255,255,255,0.1)"}`, background: logFilter === "favorites" ? `${C.gold}15` : "transparent", color: logFilter === "favorites" ? C.gold : "#8892a4", fontSize: 10, cursor: "pointer", fontWeight: logFilter === "favorites" ? 700 : 400 }}>
              ⭐ Favorites ({favorites.size})
            </button>
            {CATEGORIES.map(cat => (
              <button key={cat.id} onClick={() => setLogFilter(cat.id)}
                style={{ padding: "4px 12px", borderRadius: 20, border: `1px solid ${logFilter === cat.id ? cat.color : "rgba(255,255,255,0.1)"}`, background: logFilter === cat.id ? `${cat.color}15` : "transparent", color: logFilter === cat.id ? cat.color : "#8892a4", fontSize: 10, cursor: "pointer", fontWeight: logFilter === cat.id ? 700 : 400 }}>
                {cat.label}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
            {log.length === 0 ? (
              <div style={{ textAlign: "center", padding: 60, color: "#4a5568" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>📖</div>
                <div style={{ fontSize: 13 }}>No spins yet. Spin the roulette to start your Joy Log.</div>
              </div>
            ) : filteredLog.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: "#4a5568" }}>
                <div>No entries in this filter.</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {filteredLog.map(idea => {
                  const col = catColors[idea.category] || C.teal;
                  return (
                    <div key={idea.id} style={{ background: `${col}06`, border: `1px solid ${col}20`, borderRadius: 12, overflow: "hidden" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px" }}>
                        <span style={{ fontSize: 22 }}>{idea.emoji}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "#f0ede8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{idea.title}</div>
                          <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
                            <span style={{ fontSize: 9, color: col }}>{idea.category}</span>
                            <span style={{ fontSize: 9, color: "#4a5568" }}>·</span>
                            <span style={{ fontSize: 9, color: "#4a5568" }}>{new Date(idea.spunAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button onClick={() => toggleFavorite(idea.id)} style={{ background: "none", border: "none", fontSize: 14, cursor: "pointer", opacity: favorites.has(idea.id) ? 1 : 0.3 }}>⭐</button>
                          <button onClick={() => { setCurrentIdea(idea); setActiveTab("spin"); }} style={{ padding: "3px 10px", borderRadius: 8, background: `${col}15`, border: `1px solid ${col}30`, color: col, fontSize: 10, cursor: "pointer", fontWeight: 600 }}>Replay</button>
                          <button onClick={() => deleteLogEntry(idea.id)} style={{ background: "none", border: "none", color: "#4a5568", fontSize: 14, cursor: "pointer" }}>×</button>
                        </div>
                      </div>
                      <div style={{ padding: "0 14px 10px", fontSize: 11, color: "#8892a4", lineHeight: 1.5 }}>
                        {idea.instruction?.slice(0, 120)}{idea.instruction?.length > 120 ? "..." : ""}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
