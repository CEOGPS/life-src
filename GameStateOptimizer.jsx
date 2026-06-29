import { useState, useCallback } from "react";
import { invokeLLM } from "@/api/ceogpsclient";

const C = { orange: "#ff8c42", purple: "#8b7fff", blue: "#4ab3f4", teal: "#00c896", pink: "#ff6b9d", red: "#ff4f5e", gold: "#ffd700" };

const STORAGE_KEY = "lifeos1_game_sessions";

function loadSessions() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
}
function saveSessions(s) { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); }

const GENRES = ["Strategy", "RPG", "FPS", "Puzzle", "Simulation", "Sports", "Adventure", "Fighting", "Horror", "Indie"];
const MOODS  = ["🔥 Energized", "😴 Tired", "😤 Stressed", "😊 Happy", "🤔 Focused", "😔 Low", "⚡ Hyped"];
const GOALS  = ["Scale business", "Be more creative", "Reduce stress", "Build discipline", "Improve focus", "Connect with family", "Network & grow", "Learn new skills"];

// ── Helpers ─────────────────────────────────────────────────────────────────
function relativeTime(iso) {
  const d = Date.now() - new Date(iso).getTime();
  const h = Math.floor(d / 3600000);
  const days = Math.floor(d / 86400000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

function avgMoodShift(sessions) {
  const valid = sessions.filter(s => s.moodBefore && s.moodAfter);
  if (!valid.length) return null;
  const moodScore = m => MOODS.indexOf(m);
  const avg = valid.reduce((acc, s) => acc + (moodScore(s.moodAfter) - moodScore(s.moodBefore)), 0) / valid.length;
  return avg;
}

// ── AI prompt builders ──────────────────────────────────────────────────────
const GAMESTATE_SYSTEM = `You are the GameState Optimizer for LifeOS1. You treat gaming as a deliberate recovery and creativity tool — not escapism.

Given the user's life situation and gaming history, return ONLY valid JSON:
{
  "lifeMode": "one of: BuildMode | RecoveryMode | CreativeMode | GrindMode | NetworkMode",
  "lifeModeReason": "1-sentence why",
  "energyScore": 72,
  "goldenWindow": { "time": "e.g. 9–10:30pm", "why": "reason based on context", "durationMin": 90 },
  "gameStateAnalysis": "2-3 sentence life-as-game analysis — what quadrant they're in, strongest moves, biggest vulnerability",
  "strongestMoves": ["move1", "move2", "move3"],
  "criticalWeakness": "one honest vulnerability",
  "gamingAdvice": "one specific tip on how to use gaming sessions this week to fuel their real-life goals"
}`;

const ADVISOR_SYSTEM = `You are a Game Advisor for a busy entrepreneur in Atlanta. Suggest games that align with life goals and current energy.

Return ONLY valid JSON:
{
  "picks": [
    { "title": "Game Title", "genre": "Genre", "platform": "PC/PS5/Xbox/Mobile/Switch", "why": "specific reason tied to their goal", "timeCommitment": "e.g. 20-min sessions", "lifeAlignment": "how it directly feeds their goal" },
    { "title": "Game Title", "genre": "Genre", "platform": "...", "why": "...", "timeCommitment": "...", "lifeAlignment": "..." },
    { "title": "Game Title", "genre": "Genre", "platform": "...", "why": "...", "timeCommitment": "...", "lifeAlignment": "..." }
  ],
  "avoidFor": "one game genre to avoid given their current state and why"
}`;

const INSIGHT_SYSTEM = `You are the Insight Forge for LifeOS1 — you turn gaming sessions into shareable content, team-building stories, and creative fuel.

Given a gaming session description, return ONLY valid JSON:
{
  "headline": "punchy 1-line caption for social media",
  "story": "2-3 sentence narrative turning the gaming moment into a relatable life/business lesson",
  "tweetDraft": "tweet-length post (under 280 chars) that makes this relatable to entrepreneurs",
  "linkedinHook": "LinkedIn post opening line (1-2 sentences, pattern-interrupting)",
  "teamStory": "how this gaming moment could be told as a team-building or leadership anecdote",
  "insight": "the real-life lesson or creative spark this session revealed"
}`;

const MEETUP_SYSTEM = `You are a community connector for an Atlanta entrepreneur who games. Suggest 5 realistic ways gaming can become a networking and client-acquisition tool in Atlanta.

Return ONLY valid JSON:
{
  "opportunities": [
    { "type": "Meetup | Event | Online | Strategy", "title": "...", "description": "...", "actionStep": "specific first step to take this week", "potentialROI": "e.g. 2-3 warm leads" },
    { "type": "...", "title": "...", "description": "...", "actionStep": "...", "potentialROI": "..." },
    { "type": "...", "title": "...", "description": "...", "actionStep": "...", "potentialROI": "..." },
    { "type": "...", "title": "...", "description": "...", "actionStep": "...", "potentialROI": "..." },
    { "type": "...", "title": "...", "description": "...", "actionStep": "...", "potentialROI": "..." }
  ],
  "atLantaAngle": "one specific Atlanta-local gaming community angle or venue to leverage"
}`;

function parseJSON(raw) {
  try { const m = raw.match(/\{[\s\S]*\}/); return m ? JSON.parse(m[0]) : null; } catch { return null; }
}

// ── Sub-components ──────────────────────────────────────────────────────────
function LifeModeChip({ mode }) {
  const map = {
    BuildMode:    { color: C.teal,   icon: "🏗️" },
    RecoveryMode: { color: C.blue,   icon: "💤" },
    CreativeMode: { color: C.purple, icon: "🎨" },
    GrindMode:    { color: C.orange, icon: "⚡" },
    NetworkMode:  { color: C.gold,   icon: "🤝" },
  };
  const { color, icon } = map[mode] || { color: C.orange, icon: "🎮" };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 12px", borderRadius: 20, background: `${color}20`, border: `1px solid ${color}50`, color, fontSize: 11, fontWeight: 700 }}>
      {icon} {mode}
    </span>
  );
}

function EnergyBar({ score }) {
  const col = score >= 70 ? C.teal : score >= 40 ? C.orange : C.red;
  return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 10, color: "#6aaedd" }}>Energy Score</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: col }}>{score}/100</span>
      </div>
      <div style={{ height: 6, background: "rgba(255,255,255,0.07)", borderRadius: 3 }}>
        <div style={{ height: "100%", width: `${score}%`, background: `linear-gradient(90deg, ${col}80, ${col})`, borderRadius: 3, transition: "width 0.6s ease" }} />
      </div>
    </div>
  );
}

// ── Main ────────────────────────────────────────────────────────────────────
export default function GameStateOptimizer({ onBack }) {
  const [activeTab, setActiveTab] = useState("gamestate");

  // GameState tab
  const [gsContext, setGsContext]   = useState({ situation: "", energy: "", goals: "", gaming: "" });
  const [gsResult,  setGsResult]    = useState(null);
  const [gsLoading, setGsLoading]   = useState(false);

  // Session Log tab
  const [sessions,    setSessions]    = useState(loadSessions);
  const [logForm,     setLogForm]     = useState({ game: "", genre: "", durationMin: 60, moodBefore: "", moodAfter: "", notes: "", date: new Date().toISOString().slice(0, 10) });
  const [showLogForm, setShowLogForm] = useState(false);

  // Advisor tab
  const [advGoals,   setAdvGoals]   = useState([]);
  const [advEnergy,  setAdvEnergy]  = useState("");
  const [advResult,  setAdvResult]  = useState(null);
  const [advLoading, setAdvLoading] = useState(false);

  // Insight Forge tab
  const [insightSession, setInsightSession] = useState("");
  const [insightResult,  setInsightResult]  = useState(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [copiedField, setCopiedField] = useState(null);

  // Meetups tab
  const [meetupResult,  setMeetupResult]  = useState(null);
  const [meetupLoading, setMeetupLoading] = useState(false);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const runGameState = useCallback(async () => {
    setGsLoading(true); setGsResult(null);
    const p = `Situation: ${gsContext.situation}\nEnergy: ${gsContext.energy}\nGoals: ${gsContext.goals}\nGaming habits: ${gsContext.gaming}`;
    const raw = await invokeLLM({ systemPrompt: GAMESTATE_SYSTEM, prompt: p });
    setGsResult(parseJSON(raw));
    setGsLoading(false);
  }, [gsContext]);

  const addSession = useCallback(() => {
    if (!logForm.game.trim()) return;
    const next = [{ ...logForm, id: Date.now() }, ...sessions];
    setSessions(next); saveSessions(next);
    setLogForm({ game: "", genre: "", durationMin: 60, moodBefore: "", moodAfter: "", notes: "", date: new Date().toISOString().slice(0, 10) });
    setShowLogForm(false);
  }, [logForm, sessions]);

  const deleteSession = useCallback((id) => {
    const next = sessions.filter(s => s.id !== id);
    setSessions(next); saveSessions(next);
  }, [sessions]);

  const runAdvisor = useCallback(async () => {
    setAdvLoading(true); setAdvResult(null);
    const p = `Life goals: ${advGoals.join(", ")}\nCurrent energy: ${advEnergy}\nRecent sessions: ${sessions.slice(0, 3).map(s => s.game).join(", ") || "none logged"}`;
    const raw = await invokeLLM({ systemPrompt: ADVISOR_SYSTEM, prompt: p });
    setAdvResult(parseJSON(raw));
    setAdvLoading(false);
  }, [advGoals, advEnergy, sessions]);

  const runInsight = useCallback(async () => {
    setInsightLoading(true); setInsightResult(null);
    const raw = await invokeLLM({ systemPrompt: INSIGHT_SYSTEM, prompt: insightSession });
    setInsightResult(parseJSON(raw));
    setInsightLoading(false);
  }, [insightSession]);

  const runMeetups = useCallback(async () => {
    setMeetupLoading(true); setMeetupResult(null);
    const p = `I'm a marketing business owner in Atlanta. Recent games: ${sessions.slice(0, 3).map(s => s.game).join(", ") || "various"}. My goals: ${advGoals.join(", ") || "scale business, network"}.`;
    const raw = await invokeLLM({ systemPrompt: MEETUP_SYSTEM, prompt: p });
    setMeetupResult(parseJSON(raw));
    setMeetupLoading(false);
  }, [sessions, advGoals]);

  function copy(text, field) {
    navigator.clipboard.writeText(text).then(() => { setCopiedField(field); setTimeout(() => setCopiedField(null), 1800); });
  }

  // ── Shared styles ─────────────────────────────────────────────────────────
  const inp = { padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "#0a0b12", fontSize: 12, color: "#f0ede8", outline: "none", boxSizing: "border-box", width: "100%" };
  const card = { background: "#11131f", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: 16 };
  const btnPrimary = (col) => ({ padding: "10px 20px", borderRadius: 10, background: `linear-gradient(135deg, ${col}, ${col}90)`, border: "none", color: "#0a0b12", fontSize: 12, fontWeight: 800, cursor: "pointer" });
  const btnSecondary = (col) => ({ padding: "6px 14px", borderRadius: 8, background: `${col}15`, border: `1px solid ${col}40`, color: col, fontSize: 11, fontWeight: 600, cursor: "pointer" });

  const TABS = [
    { id: "gamestate", label: "🎮 GameState" },
    { id: "log",       label: "📝 Sessions" },
    { id: "advisor",   label: "🕹️ Game Advisor" },
    { id: "insight",   label: "✂️ Insight Forge" },
    { id: "meetups",   label: "👥 Meetups" },
  ];

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* Header */}
      <div style={{ background: `linear-gradient(135deg, ${C.orange}18, ${C.purple}10)`, borderBottom: `1px solid ${C.orange}25`, padding: "14px 20px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={onBack} style={{ background: "none", border: "none", color: "#6aaedd", fontSize: 11, cursor: "pointer", padding: 0 }}>← Back</button>
          <span style={{ color: "#2a3a4a" }}>|</span>
          <span style={{ fontSize: 20 }}>🎮</span>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: C.orange }}>GameState Optimizer</div>
            <div style={{ fontSize: 11, color: "#6aaedd" }}>Gaming as recovery, creativity, and networking fuel</div>
          </div>
          {sessions.length > 0 && (
            <div style={{ marginLeft: "auto", display: "flex", gap: 12 }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: C.orange }}>{sessions.length}</div>
                <div style={{ fontSize: 9, color: "#4a5568" }}>Sessions</div>
              </div>
              {sessions.length >= 2 && avgMoodShift(sessions) !== null && (
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: avgMoodShift(sessions) < 0 ? C.teal : C.red }}>
                    {avgMoodShift(sessions) < 0 ? "+" : "−"}{Math.abs(avgMoodShift(sessions)).toFixed(1)}
                  </div>
                  <div style={{ fontSize: 9, color: "#4a5568" }}>Mood Lift</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 2, padding: "6px 14px", background: "#0f1120", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0, overflowX: "auto" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            style={{ padding: "6px 13px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap",
              background: activeTab === t.id ? `${C.orange}20` : "transparent",
              color: activeTab === t.id ? C.orange : "#6aaedd",
              borderBottom: activeTab === t.id ? `2px solid ${C.orange}` : "2px solid transparent" }}>
            {t.label}
            {t.id === "log" && sessions.length > 0 && (
              <span style={{ marginLeft: 4, background: C.orange, color: "#0a0b12", borderRadius: 10, padding: "1px 5px", fontSize: 9, fontWeight: 800 }}>
                {sessions.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>

        {/* ── GAMESTATE TAB ── */}
        {activeTab === "gamestate" && (
          <div style={{ maxWidth: 620 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#f0ede8", marginBottom: 4 }}>Analyze Your Life GameState</div>
            <div style={{ fontSize: 11, color: "#6aaedd", marginBottom: 16 }}>Describe your current situation — get a strategic assessment and your optimal gaming window</div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
              {[
                { key: "situation", label: "🌍 Current Life Situation", ph: "e.g. Scaling my agency, two big proposals pending, behind on content..." },
                { key: "energy",    label: "⚡ Energy & Schedule",      ph: "e.g. Tired by 7pm, mornings sharp, family dinner 6-7pm daily..." },
                { key: "goals",     label: "🎯 Goals This Month",       ph: "e.g. Close 3 clients, launch email campaign, more family time..." },
                { key: "gaming",    label: "🎮 Your Gaming Habits",     ph: "e.g. Play COD 1hr after kids sleep, mostly weekends, love strategy games..." },
              ].map(f => (
                <div key={f.key} style={card}>
                  <label style={{ fontSize: 10, color: C.orange, fontWeight: 700, display: "block", marginBottom: 6 }}>{f.label}</label>
                  <textarea value={gsContext[f.key]} onChange={e => setGsContext(c => ({ ...c, [f.key]: e.target.value }))}
                    placeholder={f.ph}
                    style={{ ...inp, minHeight: 52, resize: "vertical" }} />
                </div>
              ))}
            </div>

            <button onClick={runGameState} disabled={gsLoading || !gsContext.situation.trim()}
              style={{ ...btnPrimary(C.orange), width: "100%", padding: 12, opacity: gsContext.situation.trim() ? 1 : 0.4 }}>
              {gsLoading ? "⚡ Analyzing GameState..." : "🎮 Analyze My GameState"}
            </button>

            {gsResult && (
              <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 12 }}>
                {/* Life mode + energy */}
                <div style={{ ...card, display: "flex", alignItems: "center", gap: 16 }}>
                  <LifeModeChip mode={gsResult.lifeMode} />
                  <div style={{ flex: 1 }}>
                    <EnergyBar score={gsResult.energyScore || 60} />
                  </div>
                </div>
                {gsResult.lifeModeReason && (
                  <div style={{ fontSize: 12, color: "#8892a4", padding: "0 4px" }}>{gsResult.lifeModeReason}</div>
                )}

                {/* Analysis */}
                {gsResult.gameStateAnalysis && (
                  <div style={{ ...card, borderLeft: `3px solid ${C.orange}` }}>
                    <div style={{ fontSize: 10, color: C.orange, fontWeight: 700, marginBottom: 6 }}>GAMESTATE ANALYSIS</div>
                    <div style={{ fontSize: 12, color: "#c8c8d0", lineHeight: 1.7 }}>{gsResult.gameStateAnalysis}</div>
                  </div>
                )}

                {/* Golden window */}
                {gsResult.goldenWindow && (
                  <div style={{ ...card, background: `${C.gold}08`, border: `1px solid ${C.gold}30` }}>
                    <div style={{ fontSize: 10, color: C.gold, fontWeight: 700, marginBottom: 8 }}>⭐ GOLDEN GAMING WINDOW</div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 20, fontWeight: 800, color: C.gold }}>{gsResult.goldenWindow.time}</span>
                      <span style={{ fontSize: 11, color: "#6aaedd" }}>{gsResult.goldenWindow.durationMin} min session</span>
                    </div>
                    <div style={{ fontSize: 12, color: "#c8c8d0" }}>{gsResult.goldenWindow.why}</div>
                  </div>
                )}

                {/* Strongest moves */}
                {gsResult.strongestMoves?.length > 0 && (
                  <div style={card}>
                    <div style={{ fontSize: 10, color: C.teal, fontWeight: 700, marginBottom: 8 }}>💪 STRONGEST MOVES RIGHT NOW</div>
                    {gsResult.strongestMoves.map((m, i) => (
                      <div key={i} style={{ display: "flex", gap: 8, fontSize: 12, color: "#c8c8d0", marginBottom: 6 }}>
                        <span style={{ color: C.teal, flexShrink: 0, fontWeight: 700 }}>{i + 1}.</span>{m}
                      </div>
                    ))}
                  </div>
                )}

                {/* Critical weakness + gaming advice */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {gsResult.criticalWeakness && (
                    <div style={{ ...card, border: `1px solid ${C.red}25` }}>
                      <div style={{ fontSize: 10, color: C.red, fontWeight: 700, marginBottom: 6 }}>⚠️ CRITICAL WEAKNESS</div>
                      <div style={{ fontSize: 12, color: "#c8c8d0", lineHeight: 1.5 }}>{gsResult.criticalWeakness}</div>
                    </div>
                  )}
                  {gsResult.gamingAdvice && (
                    <div style={{ ...card, border: `1px solid ${C.purple}25` }}>
                      <div style={{ fontSize: 10, color: C.purple, fontWeight: 700, marginBottom: 6 }}>🎮 GAMING PRESCRIPTION</div>
                      <div style={{ fontSize: 12, color: "#c8c8d0", lineHeight: 1.5 }}>{gsResult.gamingAdvice}</div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── SESSION LOG TAB ── */}
        {activeTab === "log" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#f0ede8" }}>Session Log</div>
                <div style={{ fontSize: 11, color: "#6aaedd" }}>Track gaming sessions to unlock pattern insights</div>
              </div>
              <button onClick={() => setShowLogForm(f => !f)} style={btnSecondary(C.orange)}>
                {showLogForm ? "Cancel" : "+ Log Session"}
              </button>
            </div>

            {/* Log form */}
            {showLogForm && (
              <div style={{ ...card, marginBottom: 16, border: `1px solid ${C.orange}30` }}>
                <div style={{ fontSize: 11, color: C.orange, fontWeight: 700, marginBottom: 12 }}>NEW SESSION</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                  <div>
                    <label style={{ fontSize: 10, color: "#6aaedd", display: "block", marginBottom: 4 }}>Game</label>
                    <input value={logForm.game} onChange={e => setLogForm(f => ({ ...f, game: e.target.value }))} placeholder="e.g. Elden Ring" style={inp} />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: "#6aaedd", display: "block", marginBottom: 4 }}>Genre</label>
                    <select value={logForm.genre} onChange={e => setLogForm(f => ({ ...f, genre: e.target.value }))}
                      style={{ ...inp, appearance: "none" }}>
                      <option value="">Select genre</option>
                      {GENRES.map(g => <option key={g}>{g}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: "#6aaedd", display: "block", marginBottom: 4 }}>Duration (min)</label>
                    <input type="number" value={logForm.durationMin} onChange={e => setLogForm(f => ({ ...f, durationMin: parseInt(e.target.value) || 0 }))} style={inp} />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: "#6aaedd", display: "block", marginBottom: 4 }}>Date</label>
                    <input type="date" value={logForm.date} onChange={e => setLogForm(f => ({ ...f, date: e.target.value }))} style={inp} />
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                  {["moodBefore", "moodAfter"].map(key => (
                    <div key={key}>
                      <label style={{ fontSize: 10, color: "#6aaedd", display: "block", marginBottom: 4 }}>
                        {key === "moodBefore" ? "Mood Before" : "Mood After"}
                      </label>
                      <select value={logForm[key]} onChange={e => setLogForm(f => ({ ...f, [key]: e.target.value }))}
                        style={{ ...inp, appearance: "none" }}>
                        <option value="">Select mood</option>
                        {MOODS.map(m => <option key={m}>{m}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 10, color: "#6aaedd", display: "block", marginBottom: 4 }}>Session Notes (optional)</label>
                  <input value={logForm.notes} onChange={e => setLogForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Highlight, funny moment, breakthrough, idea sparked..." style={inp} />
                </div>
                <button onClick={addSession} disabled={!logForm.game.trim()}
                  style={{ ...btnPrimary(C.orange), opacity: logForm.game.trim() ? 1 : 0.4 }}>
                  Save Session
                </button>
              </div>
            )}

            {sessions.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: "#4a5568" }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>🎮</div>
                <div style={{ fontSize: 13 }}>No sessions logged yet. Start tracking to unlock insights.</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {sessions.map(s => (
                  <div key={s.id} style={{ ...card, display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: `${C.orange}15`, border: `1px solid ${C.orange}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
                      🎮
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#f0ede8" }}>{s.game}</div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 3 }}>
                        {s.genre && <span style={{ fontSize: 10, color: "#6aaedd" }}>{s.genre}</span>}
                        <span style={{ fontSize: 10, color: "#4a5568" }}>{s.durationMin}min</span>
                        {s.moodBefore && s.moodAfter && (
                          <span style={{ fontSize: 10, color: C.teal }}>{s.moodBefore.split(" ")[0]} → {s.moodAfter.split(" ")[0]}</span>
                        )}
                        <span style={{ fontSize: 10, color: "#4a5568" }}>{relativeTime(s.id)}</span>
                      </div>
                      {s.notes && <div style={{ fontSize: 11, color: "#8892a4", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.notes}</div>}
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => { setInsightSession(`Game: ${s.game} (${s.genre}, ${s.durationMin}min). ${s.notes || "Good session."} Mood: ${s.moodBefore} → ${s.moodAfter}`); setActiveTab("insight"); }}
                        style={btnSecondary(C.purple)} title="Generate insight">
                        ✂️
                      </button>
                      <button onClick={() => deleteSession(s.id)}
                        style={btnSecondary(C.red)} title="Delete">
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── GAME ADVISOR TAB ── */}
        {activeTab === "advisor" && (
          <div style={{ maxWidth: 620 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#f0ede8", marginBottom: 4 }}>Game Advisor</div>
            <div style={{ fontSize: 11, color: "#6aaedd", marginBottom: 16 }}>Games recommended based on your life goals and current energy</div>

            <div style={card}>
              <div style={{ fontSize: 10, color: "#6aaedd", fontWeight: 700, marginBottom: 10 }}>YOUR CURRENT GOALS</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                {GOALS.map(g => {
                  const active = advGoals.includes(g);
                  return (
                    <button key={g} onClick={() => setAdvGoals(prev => active ? prev.filter(x => x !== g) : [...prev, g])}
                      style={{ padding: "5px 12px", borderRadius: 20, border: `1px solid ${active ? C.orange : "rgba(255,255,255,0.1)"}`, background: active ? `${C.orange}20` : "transparent", color: active ? C.orange : "#8892a4", fontSize: 11, cursor: "pointer", fontWeight: active ? 700 : 400 }}>
                      {g}
                    </button>
                  );
                })}
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 10, color: "#6aaedd", display: "block", marginBottom: 6 }}>CURRENT ENERGY LEVEL</label>
                <div style={{ display: "flex", gap: 6 }}>
                  {["Low 😴", "Medium 😊", "High 🔥"].map(e => (
                    <button key={e} onClick={() => setAdvEnergy(e)}
                      style={{ flex: 1, padding: "7px", borderRadius: 8, border: `1px solid ${advEnergy === e ? C.orange : "rgba(255,255,255,0.08)"}`, background: advEnergy === e ? `${C.orange}15` : "transparent", color: advEnergy === e ? C.orange : "#8892a4", fontSize: 11, cursor: "pointer", fontWeight: advEnergy === e ? 700 : 400 }}>
                      {e}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={runAdvisor} disabled={advLoading || advGoals.length === 0}
                style={{ ...btnPrimary(C.orange), width: "100%", opacity: advGoals.length > 0 ? 1 : 0.4 }}>
                {advLoading ? "Finding your games..." : "🕹️ Get Game Recommendations"}
              </button>
            </div>

            {advResult && (
              <div style={{ marginTop: 16 }}>
                {advResult.picks?.map((p, i) => (
                  <div key={i} style={{ ...card, marginBottom: 10, borderLeft: `3px solid ${[C.orange, C.purple, C.teal][i % 3]}` }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
                      <div>
                        <span style={{ fontSize: 14, fontWeight: 800, color: "#f0ede8" }}>{p.title}</span>
                        <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                          <span style={{ fontSize: 10, padding: "1px 8px", borderRadius: 10, background: `${C.blue}15`, color: C.blue }}>{p.genre}</span>
                          <span style={{ fontSize: 10, padding: "1px 8px", borderRadius: 10, background: "rgba(255,255,255,0.05)", color: "#8892a4" }}>{p.platform}</span>
                          <span style={{ fontSize: 10, padding: "1px 8px", borderRadius: 10, background: "rgba(255,255,255,0.05)", color: "#8892a4" }}>⏱ {p.timeCommitment}</span>
                        </div>
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: "#c8c8d0", marginBottom: 6 }}>{p.why}</div>
                    <div style={{ fontSize: 11, padding: "6px 10px", borderRadius: 8, background: `${C.teal}10`, border: `1px solid ${C.teal}20`, color: C.teal }}>
                      🎯 Life alignment: {p.lifeAlignment}
                    </div>
                  </div>
                ))}
                {advResult.avoidFor && (
                  <div style={{ ...card, border: `1px solid ${C.red}25` }}>
                    <div style={{ fontSize: 10, color: C.red, fontWeight: 700, marginBottom: 4 }}>⚠️ AVOID RIGHT NOW</div>
                    <div style={{ fontSize: 12, color: "#c8c8d0" }}>{advResult.avoidFor}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── INSIGHT FORGE TAB ── */}
        {activeTab === "insight" && (
          <div style={{ maxWidth: 620 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#f0ede8", marginBottom: 4 }}>Insight Forge</div>
            <div style={{ fontSize: 11, color: "#6aaedd", marginBottom: 16 }}>Turn a gaming session into shareable content, team stories, or creative fuel</div>

            <div style={{ ...card, marginBottom: 14 }}>
              <label style={{ fontSize: 10, color: C.purple, fontWeight: 700, display: "block", marginBottom: 6 }}>DESCRIBE THE SESSION OR MOMENT</label>
              <textarea value={insightSession} onChange={e => setInsightSession(e.target.value)}
                placeholder="e.g. Played Elden Ring for 90 min after dinner. Finally beat Margit after 8 tries — felt like breaking through a business wall. My son watched the last fight with me."
                style={{ ...inp, minHeight: 90, resize: "vertical" }} />
              <button onClick={runInsight} disabled={insightLoading || !insightSession.trim()}
                style={{ ...btnPrimary(C.purple), marginTop: 10, width: "100%", opacity: insightSession.trim() ? 1 : 0.4 }}>
                {insightLoading ? "Forging insights..." : "✂️ Forge Content & Insights"}
              </button>
            </div>

            {insightResult && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {/* Insight */}
                {insightResult.insight && (
                  <div style={{ ...card, border: `1px solid ${C.gold}30` }}>
                    <div style={{ fontSize: 10, color: C.gold, fontWeight: 700, marginBottom: 4 }}>💡 REAL-LIFE INSIGHT</div>
                    <div style={{ fontSize: 13, color: "#f0ede8", lineHeight: 1.6 }}>{insightResult.insight}</div>
                  </div>
                )}
                {/* Content drafts */}
                {[
                  { key: "headline",     label: "📣 Social Headline",  col: C.orange },
                  { key: "tweetDraft",   label: "🐦 Tweet Draft",      col: C.blue   },
                  { key: "linkedinHook", label: "💼 LinkedIn Hook",    col: C.teal   },
                  { key: "story",        label: "📖 Story",            col: C.purple },
                  { key: "teamStory",    label: "🏆 Team Story",       col: C.pink   },
                ].map(({ key, label, col }) => insightResult[key] ? (
                  <div key={key} style={{ ...card, border: `1px solid ${col}20` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <span style={{ fontSize: 10, color: col, fontWeight: 700 }}>{label}</span>
                      <button onClick={() => copy(insightResult[key], key)}
                        style={{ ...btnSecondary(col), padding: "3px 10px" }}>
                        {copiedField === key ? "✓ Copied" : "Copy"}
                      </button>
                    </div>
                    <div style={{ fontSize: 12, color: "#c8c8d0", lineHeight: 1.6 }}>{insightResult[key]}</div>
                  </div>
                ) : null)}
              </div>
            )}
          </div>
        )}

        {/* ── MEETUPS TAB ── */}
        {activeTab === "meetups" && (
          <div style={{ maxWidth: 620 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#f0ede8", marginBottom: 4 }}>Atlanta Gaming Meetups & Opportunities</div>
            <div style={{ fontSize: 11, color: "#6aaedd", marginBottom: 16 }}>Turn your gaming passion into networking and client acquisition in Atlanta</div>

            {!meetupResult ? (
              <div style={{ textAlign: "center", padding: 40 }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🏙️</div>
                <div style={{ fontSize: 13, color: "#c8c8d0", marginBottom: 20, lineHeight: 1.6 }}>
                  Get 5 AI-generated strategies to convert your gaming hobby into real Atlanta networking and business opportunities.
                </div>
                <button onClick={runMeetups} disabled={meetupLoading}
                  style={{ ...btnPrimary(C.orange), minWidth: 220 }}>
                  {meetupLoading ? "Finding opportunities..." : "🏙️ Find Atlanta Opportunities"}
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {meetupResult.atLantaAngle && (
                  <div style={{ ...card, background: `${C.gold}08`, border: `1px solid ${C.gold}30` }}>
                    <div style={{ fontSize: 10, color: C.gold, fontWeight: 700, marginBottom: 4 }}>🏙️ ATLANTA ANGLE</div>
                    <div style={{ fontSize: 12, color: "#c8c8d0", lineHeight: 1.6 }}>{meetupResult.atLantaAngle}</div>
                  </div>
                )}
                {meetupResult.opportunities?.map((o, i) => {
                  const typeColors = { Meetup: C.orange, Event: C.purple, Online: C.blue, Strategy: C.teal };
                  const col = typeColors[o.type] || C.orange;
                  return (
                    <div key={i} style={{ ...card, borderLeft: `3px solid ${col}` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, background: `${col}20`, color: col, fontWeight: 700 }}>{o.type}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#f0ede8" }}>{o.title}</span>
                      </div>
                      <div style={{ fontSize: 12, color: "#c8c8d0", marginBottom: 8, lineHeight: 1.5 }}>{o.description}</div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <div style={{ fontSize: 11, padding: "5px 10px", borderRadius: 8, background: `${C.teal}10`, border: `1px solid ${C.teal}20`, color: C.teal, flex: 1 }}>
                          ▸ {o.actionStep}
                        </div>
                        {o.potentialROI && (
                          <div style={{ fontSize: 11, padding: "5px 10px", borderRadius: 8, background: `${C.gold}10`, border: `1px solid ${C.gold}20`, color: C.gold, flexShrink: 0 }}>
                            ROI: {o.potentialROI}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                <button onClick={() => { setMeetupResult(null); }} style={{ ...btnSecondary(C.orange), alignSelf: "flex-start", marginTop: 4 }}>
                  Refresh Opportunities
                </button>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
