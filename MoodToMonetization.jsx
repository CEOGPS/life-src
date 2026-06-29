import { useState, useCallback } from "react";
import { invokeLLM } from "@/api/ceogpsclient";

const C = { pink: "#ff6b9d", orange: "#ff8c42", purple: "#8b7fff", blue: "#4ab3f4", teal: "#00c896", red: "#ff4f5e", gold: "#ffd700" };

const STORAGE_KEY = "lifeos1_creative_log";
function loadLog()    { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; } }
function saveLog(d)   { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); }

const CREATIVE_TYPES = ["🎸 Music", "✍️ Writing", "🎨 Art/Design", "🎮 Gaming", "📸 Photography", "🎬 Video", "🧵 Craft", "💻 Coding", "🍳 Cooking", "🏋️ Fitness", "📚 Research", "🎤 Speaking"];
const MOODS = [
  { label: "🔥 Fired Up",   value: "fired_up",   score: 9 },
  { label: "💡 Inspired",   value: "inspired",   score: 8 },
  { label: "😊 Content",    value: "content",    score: 7 },
  { label: "🤔 Curious",    value: "curious",    score: 7 },
  { label: "😴 Low Energy", value: "low_energy", score: 4 },
  { label: "😤 Frustrated", value: "frustrated", score: 5 },
  { label: "🧘 Calm",       value: "calm",       score: 6 },
  { label: "⚡ Anxious",    value: "anxious",    score: 5 },
];
const NETWORKS = ["Atlanta Local", "Instagram Followers", "LinkedIn Connections", "Email List", "Past Clients", "Community Groups", "Facebook Groups", "Online Community"];

function relTime(ts) {
  const d = Date.now() - ts;
  const h = Math.floor(d / 3600000), days = Math.floor(d / 86400000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

// ── AI prompts ───────────────────────────────────────────────────────────────
const BRIDGE_SYSTEM = `You are the Mood-to-Monetization Bridge for LifeOS1. You surface warm, realistic monetization paths that connect creative output to existing networks.

Given the user's creative activity, mood, and network context, return ONLY valid JSON:
{
  "opportunities": [
    {
      "title": "Specific opportunity name",
      "type": "Workshop | Service | Product | Content | Event | Collaboration",
      "tagline": "One punchy sentence",
      "revenueProjected": 1200,
      "revenueBasis": "How that number was calculated (e.g. 12 tickets × $100)",
      "calendarConflict": false,
      "calendarNote": "Why it fits or what to watch",
      "happinessBoost": 15,
      "effortLevel": "Low | Medium | High",
      "networkFit": "Which part of their network is the warmest audience and why",
      "timeToLaunch": "e.g. 2 weeks",
      "locationSuggestion": "e.g. Atlanta Westside venue or online",
      "promoPost": "Ready-to-post Instagram/Facebook caption (include hashtags)",
      "emailSubject": "Email subject line for list",
      "emailBody": "Full email body to send to warm contacts (150-200 words)",
      "leadNurture": ["Follow-up step 1 (day 3)", "Follow-up step 2 (day 7)", "Follow-up step 3 (day 14)"]
    },
    { "title":"...","type":"...","tagline":"...","revenueProjected":0,"revenueBasis":"...","calendarConflict":false,"calendarNote":"...","happinessBoost":0,"effortLevel":"...","networkFit":"...","timeToLaunch":"...","locationSuggestion":"...","promoPost":"...","emailSubject":"...","emailBody":"...","leadNurture":[] },
    { "title":"...","type":"...","tagline":"...","revenueProjected":0,"revenueBasis":"...","calendarConflict":false,"calendarNote":"...","happinessBoost":0,"effortLevel":"...","networkFit":"...","timeToLaunch":"...","locationSuggestion":"...","promoPost":"...","emailSubject":"...","emailBody":"...","leadNurture":[] }
  ],
  "moodInsight": "One sentence on how their current mood is a monetization asset right now",
  "quickWin": "The single fastest thing they could do in the next 24 hours to start converting this creative energy"
}`;

const PULSE_SYSTEM = `You are a creative energy analyst. Given a week of creative activity logs, return ONLY valid JSON:
{
  "dominantCreativeType": "the most logged type",
  "energyPattern": "1-sentence description of when/how they create",
  "untappedStrength": "one creative strength they haven't monetized yet",
  "peakMoodForMoney": "which mood from their logs is most correlated with monetizable output",
  "weeklyInsight": "2-sentence insight about this week's creative pattern and what it signals for income"
}`;

function parseJSON(raw) {
  try { const m = raw.match(/\{[\s\S]*\}/); return m ? JSON.parse(m[0]) : null; } catch { return null; }
}

// ── Sub-components ───────────────────────────────────────────────────────────
function MoodChip({ mood, selected, onClick }) {
  return (
    <button onClick={onClick}
      style={{ padding: "6px 14px", borderRadius: 20, border: `1px solid ${selected ? C.pink : "rgba(255,255,255,0.1)"}`, background: selected ? `${C.pink}20` : "transparent", color: selected ? C.pink : "#8892a4", fontSize: 12, cursor: "pointer", fontWeight: selected ? 700 : 400, transition: "all 0.15s" }}>
      {mood.label}
    </button>
  );
}

function HappinessBoost({ pct }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: C.teal, fontWeight: 700 }}>
      <span style={{ fontSize: 14 }}>😊</span>+{pct}% happiness
    </span>
  );
}

function RevenueTag({ amount }) {
  const col = amount >= 1000 ? C.gold : amount >= 500 ? C.teal : C.blue;
  return (
    <span style={{ fontSize: 13, fontWeight: 800, color: col }}>${amount.toLocaleString()}</span>
  );
}

function OpportunityCard({ opp, defaultOpen }) {
  const [tab, setTab] = useState("overview");
  const [copied, setCopied] = useState(null);

  const typeColors = { Workshop: C.orange, Service: C.teal, Product: C.blue, Content: C.purple, Event: C.pink, Collaboration: C.gold };
  const col = typeColors[opp.type] || C.pink;
  const effortColors = { Low: C.teal, Medium: C.orange, High: C.red };

  function copy(text, key) {
    navigator.clipboard.writeText(text).then(() => { setCopied(key); setTimeout(() => setCopied(null), 1800); });
  }

  const TABS = ["overview", "promo", "email", "nurture"];
  const TAB_LABELS = { overview: "📊 Overview", promo: "📣 Promo", email: "✉️ Email", nurture: "🔄 Nurture" };

  return (
    <div style={{ background: "#11131f", border: `1px solid ${col}30`, borderRadius: 14, overflow: "hidden" }}>
      {/* Card header */}
      <div style={{ padding: "14px 16px", borderBottom: `1px solid ${col}15` }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
              <span style={{ fontSize: 10, padding: "2px 9px", borderRadius: 10, background: `${col}20`, color: col, fontWeight: 700 }}>{opp.type}</span>
              <span style={{ fontSize: 10, padding: "2px 9px", borderRadius: 10, background: `${effortColors[opp.effortLevel]}15`, color: effortColors[opp.effortLevel] }}>
                {opp.effortLevel} effort
              </span>
              {opp.calendarConflict === false && (
                <span style={{ fontSize: 10, color: C.teal }}>✓ No calendar conflict</span>
              )}
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#f0ede8", marginBottom: 2 }}>{opp.title}</div>
            <div style={{ fontSize: 11, color: "#8892a4" }}>{opp.tagline}</div>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <RevenueTag amount={opp.revenueProjected} />
            <div style={{ fontSize: 9, color: "#4a5568", marginTop: 2 }}>projected</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {opp.happinessBoost > 0 && <HappinessBoost pct={opp.happinessBoost} />}
          {opp.timeToLaunch && <span style={{ fontSize: 11, color: "#6aaedd" }}>⏱ Launch in {opp.timeToLaunch}</span>}
          {opp.locationSuggestion && <span style={{ fontSize: 11, color: "#6aaedd" }}>📍 {opp.locationSuggestion}</span>}
        </div>
      </div>

      {/* Sub-tabs */}
      <div style={{ display: "flex", borderBottom: `1px solid rgba(255,255,255,0.06)`, padding: "0 6px" }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding: "6px 12px", border: "none", background: "transparent", cursor: "pointer", fontSize: 10, fontWeight: 600, color: tab === t ? col : "#4a5568", borderBottom: tab === t ? `2px solid ${col}` : "2px solid transparent" }}>
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ padding: "14px 16px" }}>
        {tab === "overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {opp.revenueBasis && (
              <div style={{ fontSize: 12, color: "#8892a4", padding: "6px 10px", background: `${C.gold}08`, borderRadius: 8, border: `1px solid ${C.gold}15` }}>
                💰 {opp.revenueBasis}
              </div>
            )}
            {opp.networkFit && (
              <div style={{ fontSize: 12, color: "#c8c8d0", lineHeight: 1.6, padding: "6px 10px", background: "rgba(255,255,255,0.03)", borderRadius: 8 }}>
                👥 {opp.networkFit}
              </div>
            )}
            {opp.calendarNote && (
              <div style={{ fontSize: 11, color: opp.calendarConflict ? C.red : C.teal }}>
                {opp.calendarConflict ? "⚠️" : "✓"} {opp.calendarNote}
              </div>
            )}
          </div>
        )}

        {tab === "promo" && opp.promoPost && (
          <div>
            <div style={{ fontSize: 10, color: C.pink, fontWeight: 700, marginBottom: 8 }}>📣 SOCIAL POST — READY TO COPY</div>
            <div style={{ background: "#0a0b12", borderRadius: 10, padding: "12px 14px", fontSize: 12, color: "#c8c8d0", lineHeight: 1.7, whiteSpace: "pre-wrap", marginBottom: 10 }}>
              {opp.promoPost}
            </div>
            <button onClick={() => copy(opp.promoPost, "promo")}
              style={{ padding: "6px 16px", borderRadius: 8, background: copied === "promo" ? `${C.teal}20` : `${C.pink}15`, border: `1px solid ${copied === "promo" ? C.teal : C.pink}40`, color: copied === "promo" ? C.teal : C.pink, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
              {copied === "promo" ? "✓ Copied!" : "Copy Post"}
            </button>
          </div>
        )}

        {tab === "email" && (
          <div>
            {opp.emailSubject && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 10, color: "#6aaedd", fontWeight: 700, marginBottom: 4 }}>SUBJECT LINE</div>
                <div style={{ background: "#0a0b12", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#f0ede8", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>{opp.emailSubject}</span>
                  <button onClick={() => copy(opp.emailSubject, "subj")}
                    style={{ background: "none", border: "none", color: copied === "subj" ? C.teal : "#6aaedd", fontSize: 11, cursor: "pointer" }}>
                    {copied === "subj" ? "✓" : "Copy"}
                  </button>
                </div>
              </div>
            )}
            {opp.emailBody && (
              <div>
                <div style={{ fontSize: 10, color: "#6aaedd", fontWeight: 700, marginBottom: 4 }}>EMAIL BODY</div>
                <div style={{ background: "#0a0b12", borderRadius: 8, padding: "12px 14px", fontSize: 12, color: "#c8c8d0", lineHeight: 1.8, whiteSpace: "pre-wrap", marginBottom: 8 }}>
                  {opp.emailBody}
                </div>
                <button onClick={() => copy(opp.emailBody, "body")}
                  style={{ padding: "6px 16px", borderRadius: 8, background: copied === "body" ? `${C.teal}20` : `${C.blue}15`, border: `1px solid ${copied === "body" ? C.teal : C.blue}40`, color: copied === "body" ? C.teal : C.blue, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
                  {copied === "body" ? "✓ Copied!" : "Copy Email"}
                </button>
              </div>
            )}
          </div>
        )}

        {tab === "nurture" && opp.leadNurture?.length > 0 && (
          <div>
            <div style={{ fontSize: 10, color: "#6aaedd", fontWeight: 700, marginBottom: 10 }}>LEAD NURTURE SEQUENCE</div>
            {opp.leadNurture.map((step, i) => (
              <div key={i} style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                <div style={{ width: 24, height: 24, borderRadius: "50%", background: `${C.pink}20`, border: `1px solid ${C.pink}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: C.pink, fontWeight: 800, flexShrink: 0 }}>
                  {i + 1}
                </div>
                <div style={{ flex: 1, fontSize: 12, color: "#c8c8d0", lineHeight: 1.6, paddingTop: 3 }}>{step}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function MoodToMonetization({ onBack }) {
  const [activeTab, setActiveTab] = useState("bridge");

  // Bridge tab
  const [mood,        setMood]        = useState(null);
  const [creativeIn,  setCreativeIn]  = useState({ types: [], description: "", timeSpent: "", network: [] });
  const [context,     setContext]     = useState({ schedule: "", financial: "", goals: "" });
  const [result,      setResult]      = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState("");

  // Activity log tab
  const [log,         setLog]         = useState(loadLog);
  const [logForm,     setLogForm]     = useState({ type: "", mood: "", notes: "", date: new Date().toISOString().slice(0, 10) });
  const [showForm,    setShowForm]    = useState(false);

  // Pulse tab
  const [pulse,       setPulse]       = useState(null);
  const [pulseLoad,   setPulseLoad]   = useState(false);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const runBridge = useCallback(async () => {
    if (!mood || creativeIn.types.length === 0) return;
    setLoading(true); setResult(null); setError("");
    try {
      const prompt = [
        `Current mood: ${mood.label}`,
        `Creative activities: ${creativeIn.types.join(", ")}`,
        creativeIn.description && `What I've been doing: ${creativeIn.description}`,
        creativeIn.timeSpent   && `Time invested this week: ${creativeIn.timeSpent}`,
        creativeIn.network.length && `My warm network: ${creativeIn.network.join(", ")}`,
        context.schedule  && `Schedule context: ${context.schedule}`,
        context.financial && `Financial context: ${context.financial}`,
        context.goals     && `Goals this month: ${context.goals}`,
        `Location: Atlanta, GA. I'm a marketing business owner.`,
      ].filter(Boolean).join("\n");
      const raw = await invokeLLM({ systemPrompt: BRIDGE_SYSTEM, prompt });
      const parsed = parseJSON(raw);
      if (!parsed) { setError("Couldn't parse opportunities. Try again."); setLoading(false); return; }
      setResult(parsed);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }, [mood, creativeIn, context]);

  const addLog = useCallback(() => {
    if (!logForm.type) return;
    const next = [{ ...logForm, id: Date.now() }, ...log];
    setLog(next); saveLog(next);
    setLogForm({ type: "", mood: "", notes: "", date: new Date().toISOString().slice(0, 10) });
    setShowForm(false);
  }, [logForm, log]);

  const runPulse = useCallback(async () => {
    if (log.length < 2) return;
    setPulseLoad(true); setPulse(null);
    const summary = log.slice(0, 14).map(e => `${e.date}: ${e.type}${e.mood ? " (" + e.mood + ")" : ""}${e.notes ? " — " + e.notes : ""}`).join("\n");
    const raw = await invokeLLM({ systemPrompt: PULSE_SYSTEM, prompt: `Creative log (last 14 entries):\n${summary}` });
    setPulse(parseJSON(raw));
    setPulseLoad(false);
  }, [log]);

  const toggleType = (t) => setCreativeIn(c => ({ ...c, types: c.types.includes(t) ? c.types.filter(x => x !== t) : [...c.types, t] }));
  const toggleNet  = (n) => setCreativeIn(c => ({ ...c, network: c.network.includes(n) ? c.network.filter(x => x !== n) : [...c.network, n] }));

  // ── Shared styles ─────────────────────────────────────────────────────────
  const inp = { padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "#0a0b12", fontSize: 12, color: "#f0ede8", outline: "none", boxSizing: "border-box", width: "100%" };
  const sCard = { background: "#11131f", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: 16 };
  const btnP = { padding: "10px 20px", borderRadius: 10, background: `linear-gradient(135deg, ${C.pink}, ${C.orange})`, border: "none", color: "#0a0b12", fontSize: 12, fontWeight: 800, cursor: "pointer" };
  const btnS = (col) => ({ padding: "6px 14px", borderRadius: 8, background: `${col}15`, border: `1px solid ${col}40`, color: col, fontSize: 11, fontWeight: 600, cursor: "pointer" });

  const TABS = [
    { id: "bridge",  label: "🌉 Bridge"        },
    { id: "log",     label: "📓 Activity Log"  },
    { id: "pulse",   label: "📈 Creative Pulse" },
  ];

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* Header */}
      <div style={{ background: `linear-gradient(135deg, ${C.pink}18, ${C.orange}10)`, borderBottom: `1px solid ${C.pink}25`, padding: "14px 20px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={onBack} style={{ background: "none", border: "none", color: "#6aaedd", fontSize: 11, cursor: "pointer", padding: 0 }}>← Back</button>
          <span style={{ color: "#2a3a4a" }}>|</span>
          <span style={{ fontSize: 20 }}>😊</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: C.pink }}>Mood-to-Monetization Bridge</div>
            <div style={{ fontSize: 11, color: "#6aaedd" }}>Convert creative energy into warm revenue opportunities</div>
          </div>
          {log.length > 0 && (
            <div style={{ display: "flex", gap: 14 }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: C.pink }}>{log.length}</div>
                <div style={{ fontSize: 9, color: "#4a5568" }}>Activities</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: C.gold }}>{new Set(log.map(e => e.type)).size}</div>
                <div style={{ fontSize: 9, color: "#4a5568" }}>Types</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 2, padding: "6px 14px", background: "#0f1120", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            style={{ padding: "6px 13px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", background: activeTab === t.id ? `${C.pink}20` : "transparent", color: activeTab === t.id ? C.pink : "#6aaedd", borderBottom: activeTab === t.id ? `2px solid ${C.pink}` : "2px solid transparent" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>

        {/* ── BRIDGE TAB ── */}
        {activeTab === "bridge" && (
          <div style={{ maxWidth: 680 }}>
            {!result ? (
              <>
                {/* Step 1: Mood */}
                <div style={{ ...sCard, marginBottom: 14 }}>
                  <div style={{ fontSize: 10, color: C.pink, fontWeight: 700, letterSpacing: ".08em", marginBottom: 10 }}>STEP 1 — YOUR CURRENT MOOD</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {MOODS.map(m => <MoodChip key={m.value} mood={m} selected={mood?.value === m.value} onClick={() => setMood(m)} />)}
                  </div>
                </div>

                {/* Step 2: Creative activity */}
                <div style={{ ...sCard, marginBottom: 14 }}>
                  <div style={{ fontSize: 10, color: C.pink, fontWeight: 700, letterSpacing: ".08em", marginBottom: 10 }}>STEP 2 — WHAT YOU'VE BEEN CREATING</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                    {CREATIVE_TYPES.map(t => {
                      const active = creativeIn.types.includes(t);
                      return (
                        <button key={t} onClick={() => toggleType(t)}
                          style={{ padding: "5px 12px", borderRadius: 20, border: `1px solid ${active ? C.orange : "rgba(255,255,255,0.1)"}`, background: active ? `${C.orange}20` : "transparent", color: active ? C.orange : "#8892a4", fontSize: 11, cursor: "pointer", fontWeight: active ? 700 : 400 }}>
                          {t}
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                      <label style={{ fontSize: 10, color: "#6aaedd", display: "block", marginBottom: 4 }}>Describe what you've been making</label>
                      <input value={creativeIn.description} onChange={e => setCreativeIn(c => ({ ...c, description: e.target.value }))}
                        placeholder="e.g. Weekend guitar sessions, writing song hooks..." style={inp} />
                    </div>
                    <div>
                      <label style={{ fontSize: 10, color: "#6aaedd", display: "block", marginBottom: 4 }}>Time invested this week</label>
                      <input value={creativeIn.timeSpent} onChange={e => setCreativeIn(c => ({ ...c, timeSpent: e.target.value }))}
                        placeholder="e.g. ~5 hours total" style={inp} />
                    </div>
                  </div>
                </div>

                {/* Step 3: Network */}
                <div style={{ ...sCard, marginBottom: 14 }}>
                  <div style={{ fontSize: 10, color: C.pink, fontWeight: 700, letterSpacing: ".08em", marginBottom: 10 }}>STEP 3 — YOUR WARM NETWORK</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {NETWORKS.map(n => {
                      const active = creativeIn.network.includes(n);
                      return (
                        <button key={n} onClick={() => toggleNet(n)}
                          style={{ padding: "5px 12px", borderRadius: 20, border: `1px solid ${active ? C.purple : "rgba(255,255,255,0.1)"}`, background: active ? `${C.purple}20` : "transparent", color: active ? C.purple : "#8892a4", fontSize: 11, cursor: "pointer", fontWeight: active ? 700 : 400 }}>
                          {n}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Step 4: Context (optional) */}
                <div style={{ ...sCard, marginBottom: 16 }}>
                  <div style={{ fontSize: 10, color: C.pink, fontWeight: 700, letterSpacing: ".08em", marginBottom: 10 }}>STEP 4 — CONTEXT (optional)</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                    {[
                      { key: "schedule",  label: "📅 Schedule",  ph: "e.g. Weekends free, weekday evenings" },
                      { key: "financial", label: "💰 Finances",   ph: "e.g. Looking for $2k side income" },
                      { key: "goals",     label: "🎯 Goals",      ph: "e.g. Launch a workshop by next month" },
                    ].map(f => (
                      <div key={f.key}>
                        <label style={{ fontSize: 10, color: "#6aaedd", display: "block", marginBottom: 4 }}>{f.label}</label>
                        <input value={context[f.key]} onChange={e => setContext(c => ({ ...c, [f.key]: e.target.value }))} placeholder={f.ph} style={inp} />
                      </div>
                    ))}
                  </div>
                </div>

                {error && <div style={{ color: C.red, fontSize: 12, padding: "8px 12px", background: `${C.red}10`, borderRadius: 8, marginBottom: 12 }}>{error}</div>}

                <button onClick={runBridge} disabled={loading || !mood || creativeIn.types.length === 0}
                  style={{ ...btnP, width: "100%", padding: 13, fontSize: 13, opacity: mood && creativeIn.types.length > 0 ? 1 : 0.4 }}>
                  {loading ? "🌉 Building your bridge..." : "🌉 Find My Monetization Opportunities"}
                </button>
              </>
            ) : (
              /* Results */
              <div>
                {/* Quick read bar */}
                <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
                  {result.moodInsight && (
                    <div style={{ flex: 1, ...sCard, border: `1px solid ${C.pink}30`, minWidth: 240 }}>
                      <div style={{ fontSize: 10, color: C.pink, fontWeight: 700, marginBottom: 4 }}>💡 MOOD INSIGHT</div>
                      <div style={{ fontSize: 12, color: "#c8c8d0", lineHeight: 1.5 }}>{result.moodInsight}</div>
                    </div>
                  )}
                  {result.quickWin && (
                    <div style={{ flex: 1, ...sCard, border: `1px solid ${C.gold}30`, minWidth: 240 }}>
                      <div style={{ fontSize: 10, color: C.gold, fontWeight: 700, marginBottom: 4 }}>⚡ QUICK WIN (24 hrs)</div>
                      <div style={{ fontSize: 12, color: "#c8c8d0", lineHeight: 1.5 }}>{result.quickWin}</div>
                    </div>
                  )}
                </div>

                {/* Revenue summary row */}
                {result.opportunities?.length > 0 && (
                  <div style={{ display: "flex", gap: 8, marginBottom: 16, padding: "12px 16px", background: `${C.pink}08`, border: `1px solid ${C.pink}20`, borderRadius: 12, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11, color: "#6aaedd" }}>Total projected revenue:</span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: C.gold }}>
                      ${result.opportunities.reduce((s, o) => s + (o.revenueProjected || 0), 0).toLocaleString()}
                    </span>
                    <span style={{ fontSize: 11, color: "#4a5568" }}>across {result.opportunities.length} opportunities</span>
                    <button onClick={() => setResult(null)} style={{ ...btnS(C.pink), marginLeft: "auto", padding: "4px 12px" }}>New Bridge</button>
                  </div>
                )}

                {/* Opportunity cards */}
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {(result.opportunities || []).map((opp, i) => (
                    <OpportunityCard key={i} opp={opp} defaultOpen={i === 0} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── ACTIVITY LOG TAB ── */}
        {activeTab === "log" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#f0ede8" }}>Creative Activity Log</div>
                <div style={{ fontSize: 11, color: "#6aaedd" }}>Track your creative sessions to unlock pattern insights</div>
              </div>
              <button onClick={() => setShowForm(f => !f)} style={btnS(C.pink)}>
                {showForm ? "Cancel" : "+ Log Activity"}
              </button>
            </div>

            {showForm && (
              <div style={{ ...sCard, marginBottom: 16, border: `1px solid ${C.pink}30` }}>
                <div style={{ fontSize: 10, color: C.pink, fontWeight: 700, marginBottom: 12 }}>NEW ACTIVITY</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                  <div>
                    <label style={{ fontSize: 10, color: "#6aaedd", display: "block", marginBottom: 4 }}>Activity Type</label>
                    <select value={logForm.type} onChange={e => setLogForm(f => ({ ...f, type: e.target.value }))}
                      style={{ ...inp, appearance: "none" }}>
                      <option value="">Select type</option>
                      {CREATIVE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: "#6aaedd", display: "block", marginBottom: 4 }}>Mood</label>
                    <select value={logForm.mood} onChange={e => setLogForm(f => ({ ...f, mood: e.target.value }))}
                      style={{ ...inp, appearance: "none" }}>
                      <option value="">Select mood</option>
                      {MOODS.map(m => <option key={m.value} value={m.label}>{m.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: "#6aaedd", display: "block", marginBottom: 4 }}>Date</label>
                    <input type="date" value={logForm.date} onChange={e => setLogForm(f => ({ ...f, date: e.target.value }))} style={inp} />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: "#6aaedd", display: "block", marginBottom: 4 }}>Notes</label>
                    <input value={logForm.notes} onChange={e => setLogForm(f => ({ ...f, notes: e.target.value }))} placeholder="What did you make/do?" style={inp} />
                  </div>
                </div>
                <button onClick={addLog} disabled={!logForm.type}
                  style={{ ...btnP, opacity: logForm.type ? 1 : 0.4 }}>Save Activity</button>
              </div>
            )}

            {log.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: "#4a5568" }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>📓</div>
                <div>Log your first creative activity to start tracking patterns.</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {log.map(entry => {
                  const moodObj = MOODS.find(m => m.label === entry.mood);
                  return (
                    <div key={entry.id} style={{ ...sCard, display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 38, height: 38, borderRadius: 10, background: `${C.pink}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
                        {entry.type?.split(" ")[0] || "🎨"}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#f0ede8" }}>{entry.type}</div>
                        <div style={{ display: "flex", gap: 8, marginTop: 3, flexWrap: "wrap" }}>
                          {entry.mood && <span style={{ fontSize: 10, color: C.pink }}>{entry.mood}</span>}
                          <span style={{ fontSize: 10, color: "#4a5568" }}>{entry.date}</span>
                        </div>
                        {entry.notes && <div style={{ fontSize: 11, color: "#8892a4", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.notes}</div>}
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          onClick={() => { setCreativeIn(c => ({ ...c, types: [entry.type], description: entry.notes || "" })); setMood(moodObj || null); setActiveTab("bridge"); }}
                          style={btnS(C.pink)} title="Use in Bridge">
                          🌉
                        </button>
                        <button onClick={() => { const next = log.filter(e => e.id !== entry.id); setLog(next); saveLog(next); }}
                          style={btnS(C.red)} title="Delete">×</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── CREATIVE PULSE TAB ── */}
        {activeTab === "pulse" && (
          <div style={{ maxWidth: 580 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#f0ede8", marginBottom: 4 }}>Creative Pulse</div>
            <div style={{ fontSize: 11, color: "#6aaedd", marginBottom: 20 }}>AI analysis of your logged creative patterns and untapped income signals</div>

            {log.length < 2 ? (
              <div style={{ textAlign: "center", padding: 40, color: "#4a5568" }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>📈</div>
                <div style={{ lineHeight: 1.6 }}>Log at least 2 creative activities to unlock pulse analysis.</div>
              </div>
            ) : !pulse ? (
              <div style={{ textAlign: "center", padding: 40 }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>📈</div>
                <div style={{ fontSize: 13, color: "#c8c8d0", marginBottom: 20 }}>
                  Analyze your {log.length} logged activities to surface patterns and hidden monetization signals.
                </div>
                <button onClick={runPulse} disabled={pulseLoad}
                  style={{ ...btnP, minWidth: 220 }}>
                  {pulseLoad ? "Analyzing patterns..." : "📈 Run Pulse Analysis"}
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {[
                    { label: "🎯 DOMINANT TYPE",         value: pulse.dominantCreativeType, col: C.orange },
                    { label: "⭐ PEAK MOOD FOR MONEY",   value: pulse.peakMoodForMoney,     col: C.gold   },
                  ].map(({ label, value, col }) => (
                    <div key={label} style={{ ...sCard, border: `1px solid ${col}25` }}>
                      <div style={{ fontSize: 10, color: col, fontWeight: 700, marginBottom: 6 }}>{label}</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#f0ede8" }}>{value}</div>
                    </div>
                  ))}
                </div>
                {[
                  { label: "⚡ ENERGY PATTERN",      value: pulse.energyPattern,       col: C.blue   },
                  { label: "💎 UNTAPPED STRENGTH",   value: pulse.untappedStrength,     col: C.teal   },
                  { label: "📊 WEEKLY INSIGHT",      value: pulse.weeklyInsight,        col: C.purple },
                ].map(({ label, value, col }) => value ? (
                  <div key={label} style={{ ...sCard, borderLeft: `3px solid ${col}` }}>
                    <div style={{ fontSize: 10, color: col, fontWeight: 700, marginBottom: 6 }}>{label}</div>
                    <div style={{ fontSize: 12, color: "#c8c8d0", lineHeight: 1.7 }}>{value}</div>
                  </div>
                ) : null)}
                <button onClick={() => setPulse(null)} style={{ ...btnS(C.pink), alignSelf: "flex-start" }}>
                  Re-analyze
                </button>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
