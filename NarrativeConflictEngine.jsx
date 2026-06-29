import { useState, useCallback, useRef, useEffect } from "react";
import { invokeLLM } from "@/api/ceogpsclient";

const C = { red: "#ff4f5e", orange: "#ff8c42", purple: "#8b7fff", blue: "#4ab3f4", teal: "#00c896", pink: "#ff6b9d", gold: "#ffd700" };

const STORIES_KEY  = "lifeos1_nce_stories";
const AUDIT_KEY    = "lifeos1_life_audit_notes";
const GAME_KEY     = "lifeos1_game_sessions";

function load(key, def) { try { return JSON.parse(localStorage.getItem(key) || "null") ?? def; } catch { return def; } }
function save(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

// ── Pull cross-panel context ─────────────────────────────────────────────────
function pullGameContext() {
  const sessions = load(GAME_KEY, []);
  if (!sessions.length) return "";
  const recent = sessions.slice(0, 3).map(s => `${s.game} (${s.durationMin}min, mood: ${s.moodAfter || "unknown"})`).join(", ");
  return `Recent gaming: ${recent}`;
}

function pushAuditInsight(insight) {
  const existing = load(AUDIT_KEY, []);
  const entry = { id: Date.now(), source: "Narrative Conflict Engine", insight, ts: new Date().toISOString() };
  save(AUDIT_KEY, [entry, ...existing].slice(0, 50));
}

// ── Stat definitions ─────────────────────────────────────────────────────────
const STATS = [
  { key: "stamina",    label: "Stamina",       icon: "💪", color: C.red    },
  { key: "wisdom",     label: "Wisdom",        icon: "🧠", color: C.purple },
  { key: "gold",       label: "Gold",          icon: "💰", color: C.gold   },
  { key: "familyRep",  label: "Family Rep",    icon: "👨‍👩‍👧", color: C.pink   },
  { key: "bizPower",   label: "Biz Power",     icon: "⚡", color: C.orange  },
  { key: "gamerSoul",  label: "Gamer Soul",    icon: "🎮", color: C.teal   },
];

const DEFAULT_STATS = { stamina: 70, wisdom: 60, gold: 55, familyRep: 75, bizPower: 65, gamerSoul: 80 };

// ── AI prompts ────────────────────────────────────────────────────────────────
const STORY_SYSTEM = `You are the Narrative Conflict Engine for LifeOS1. You transform real-life events into an interactive life RPG with wit, heart, and strategic depth.

Given the user's real events and context, create an opening RPG scene and first branching choice. Return ONLY valid JSON:
{
  "storyTitle": "Punchy title (5-8 words)",
  "genre": "one of: Family Quest | Business Odyssey | Creative Saga | Gamer's Dilemma | Life Juggle | Atlanta Chronicles",
  "openingScene": "3-4 paragraph vivid RPG-style narrative of their week. Write in second person (You...). Include humor, specific real details, and dramatic flair. Treat their real life as epic fantasy/RPG material.",
  "characterIntro": "2-sentence description of the hero (them) with their class and starting stats context",
  "stats": { "stamina": 70, "wisdom": 60, "gold": 55, "familyRep": 75, "bizPower": 65, "gamerSoul": 80 },
  "conflict": "The central narrative conflict in 1 punchy sentence",
  "choice": {
    "prompt": "The choice the hero faces right now (dramatic question format)",
    "options": [
      { "id": "A", "label": "Option A label (5-8 words)", "description": "What this path means", "statImpacts": { "stamina": -5, "bizPower": 15 }, "riskLevel": "low|medium|high", "humor": "optional funny aside about this choice" },
      { "id": "B", "label": "Option B label (5-8 words)", "description": "What this path means", "statImpacts": { "familyRep": 20, "stamina": -10 }, "riskLevel": "low|medium|high", "humor": "optional funny aside" },
      { "id": "C", "label": "Option C label (5-8 words)", "description": "What this path means", "statImpacts": { "gamerSoul": 15, "gold": -5 }, "riskLevel": "low|medium|high", "humor": "optional funny aside" }
    ]
  }
}`;

const CHOICE_SYSTEM = `You are the Narrative Conflict Engine continuing an interactive life RPG. The user made a choice — continue the story.

Return ONLY valid JSON:
{
  "scene": "3-4 paragraph continuation of the RPG narrative. Vivid, humorous, grounded in real life. Reference their choice and its immediate consequences. Second person (You...).",
  "statChanges": { "stamina": 0, "wisdom": 5, "gold": -10, "familyRep": 0, "bizPower": 0, "gamerSoul": 0 },
  "insightUnlocked": "A real-life insight or lesson this narrative moment reveals (1-2 sentences, earnest not jokey)",
  "isEnding": false,
  "endingType": null,
  "choice": {
    "prompt": "Next dramatic question",
    "options": [
      { "id": "A", "label": "...", "description": "...", "statImpacts": {}, "riskLevel": "medium", "humor": "..." },
      { "id": "B", "label": "...", "description": "...", "statImpacts": {}, "riskLevel": "medium", "humor": "..." },
      { "id": "C", "label": "...", "description": "...", "statImpacts": {}, "riskLevel": "medium", "humor": "..." }
    ]
  }
}

If this is a natural story ending (after 4+ choices), set "isEnding": true, "endingType": one of: "Victory | Bittersweet | Plot Twist | To Be Continued", and omit "choice". Instead add:
"epilogue": "A satisfying 2-paragraph story close with real-life takeaways woven in."`;

const OUTPUT_SYSTEM = `You are a creative content producer. Transform a life RPG story into polished real-world content.

Given the story beats and choices, return ONLY valid JSON:
{
  "shortStory": "A polished 400-500 word short story version — narrative prose, no RPG mechanics, suitable for a personal blog or Medium post",
  "socialPost": "An Instagram/Facebook caption (150-200 chars + hashtags) that teases the story theme without oversharing",
  "linkedinVersion": "A LinkedIn post (200-250 words) framing the story as a business/leadership lesson",
  "videoScript": "A 60-second voiceover script for a Reel/TikTok — punchy, relatable, hooks in first 3 seconds",
  "gamePitch": "A 2-paragraph pitch for how this story could become a mobile game level or mod concept"
}`;

function parseJSON(raw) {
  try { const m = raw.match(/\{[\s\S]*\}/); return m ? JSON.parse(m[0]) : null; } catch { return null; }
}

// ── Stat bar ──────────────────────────────────────────────────────────────────
function StatBar({ stat, value, delta }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{ fontSize: 10, color: "#8892a4" }}>{stat.icon} {stat.label}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {delta !== 0 && (
            <span style={{ fontSize: 9, fontWeight: 700, color: delta > 0 ? C.teal : C.red }}>
              {delta > 0 ? "▲" : "▼"}{Math.abs(delta)}
            </span>
          )}
          <span style={{ fontSize: 11, fontWeight: 700, color: stat.color }}>{clamped}</span>
        </div>
      </div>
      <div style={{ height: 5, background: "rgba(255,255,255,0.06)", borderRadius: 3 }}>
        <div style={{ height: "100%", width: `${clamped}%`, background: `linear-gradient(90deg, ${stat.color}60, ${stat.color})`, borderRadius: 3, transition: "width 0.5s ease" }} />
      </div>
    </div>
  );
}

// ── Choice card ───────────────────────────────────────────────────────────────
function ChoiceCard({ option, onSelect, disabled }) {
  const riskColor = { low: C.teal, medium: C.orange, high: C.red }[option.riskLevel] || C.orange;
  const impacts = Object.entries(option.statImpacts || {}).filter(([, v]) => v !== 0);

  return (
    <button onClick={() => onSelect(option)} disabled={disabled}
      style={{ width: "100%", padding: "14px 16px", borderRadius: 12, border: `1px solid ${riskColor}30`, background: `${riskColor}06`, cursor: disabled ? "not-allowed" : "pointer", textAlign: "left", transition: "all 0.15s", opacity: disabled ? 0.5 : 1 }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.borderColor = riskColor; e.currentTarget.style.background = `${riskColor}12`; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = `${riskColor}30`; e.currentTarget.style.background = `${riskColor}06`; }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 6 }}>
        <span style={{ fontSize: 16, fontWeight: 800, color: riskColor, flexShrink: 0, width: 22 }}>{option.id}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#f0ede8", marginBottom: 3 }}>{option.label}</div>
          <div style={{ fontSize: 11, color: "#8892a4", lineHeight: 1.5 }}>{option.description}</div>
          {option.humor && <div style={{ fontSize: 11, color: C.gold, marginTop: 4, fontStyle: "italic" }}>💬 "{option.humor}"</div>}
        </div>
        <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 10, background: `${riskColor}20`, color: riskColor, fontWeight: 700, flexShrink: 0 }}>{option.riskLevel}</span>
      </div>
      {impacts.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", paddingLeft: 30 }}>
          {impacts.map(([key, val]) => {
            const s = STATS.find(s => s.key === key);
            if (!s) return null;
            return (
              <span key={key} style={{ fontSize: 10, padding: "1px 7px", borderRadius: 10, background: `${val > 0 ? C.teal : C.red}15`, color: val > 0 ? C.teal : C.red, fontWeight: 600 }}>
                {s.icon} {val > 0 ? "+" : ""}{val}
              </span>
            );
          })}
        </div>
      )}
    </button>
  );
}

// ── Story event log entry ─────────────────────────────────────────────────────
function EventEntry({ entry, index }) {
  const [expanded, setExpanded] = useState(index === 0);
  return (
    <div style={{ borderLeft: `2px solid ${C.red}30`, paddingLeft: 14, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, cursor: "pointer" }} onClick={() => setExpanded(e => !e)}>
        <div style={{ width: 20, height: 20, borderRadius: "50%", background: `${C.red}20`, border: `1px solid ${C.red}50`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: C.red, fontWeight: 800, flexShrink: 0 }}>
          {index + 1}
        </div>
        {entry.chosenOption && (
          <span style={{ fontSize: 11, padding: "2px 10px", borderRadius: 10, background: `${C.orange}15`, border: `1px solid ${C.orange}30`, color: C.orange, fontWeight: 700 }}>
            Chose: {entry.chosenOption}
          </span>
        )}
        <span style={{ fontSize: 10, color: "#4a5568", marginLeft: "auto" }}>{expanded ? "▲" : "▼"}</span>
      </div>
      {expanded && entry.scene && (
        <div style={{ fontSize: 12, color: "#c8c8d0", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{entry.scene}</div>
      )}
      {expanded && entry.insightUnlocked && (
        <div style={{ marginTop: 8, padding: "7px 12px", borderRadius: 8, background: `${C.gold}08`, border: `1px solid ${C.gold}20`, fontSize: 11, color: C.gold }}>
          💡 Insight: {entry.insightUnlocked}
        </div>
      )}
    </div>
  );
}

// ── Genre badge ───────────────────────────────────────────────────────────────
function GenreBadge({ genre }) {
  const map = {
    "Family Quest":      C.pink,
    "Business Odyssey":  C.orange,
    "Creative Saga":     C.purple,
    "Gamer's Dilemma":   C.teal,
    "Life Juggle":       C.blue,
    "Atlanta Chronicles": C.gold,
  };
  const col = map[genre] || C.red;
  return <span style={{ fontSize: 10, padding: "2px 10px", borderRadius: 10, background: `${col}20`, color: col, fontWeight: 700, border: `1px solid ${col}30` }}>{genre}</span>;
}

// ── PRESETS ───────────────────────────────────────────────────────────────────
const PRESETS = [
  { label: "Big client vs. recital night",  events: "Huge plumbing lead called right when my kid's school recital starts tonight. Boss-level week at work, running on 4 hrs sleep.", context: "Atlanta dad, busy entrepreneur, try to be present for family" },
  { label: "Launch week chaos",             events: "Product launch Monday, team conflict Tuesday, unexpected expense Thursday, gaming tournament Saturday.", context: "Marketing business owner, first big launch of the year" },
  { label: "The pivot moment",              events: "Top client wants to end contract. New opportunity in a different industry appeared. Savings low but energy high.", context: "Trying to decide whether to pivot business direction" },
  { label: "Family weekend override",       events: "Promised family vacation but three urgent client emails arrived Friday night. Kids excited for beach, phone won't stop buzzing.", context: "Work-life balance struggle, trying to honor commitments" },
];

// ── Main ──────────────────────────────────────────────────────────────────────
export default function NarrativeConflictEngine({ onBack }) {
  const [activeTab, setActiveTab]       = useState("new");

  // New story inputs
  const [events,   setEvents]   = useState("");
  const [context,  setContext]  = useState({ background: "", tone: "balanced", invited: "" });
  const [building, setBuilding] = useState(false);
  const [buildError, setBuildError] = useState("");

  // Active story state
  const [story,       setStory]       = useState(null);     // opening data
  const [stats,       setStats]       = useState(DEFAULT_STATS);
  const [statDeltas,  setStatDeltas]  = useState({});
  const [eventLog,    setEventLog]    = useState([]);        // scenes + choices played
  const [choosing,    setChoosing]    = useState(false);
  const [currentScene, setCurrentScene] = useState(null);    // latest scene text + choice
  const [isEnded,     setIsEnded]     = useState(false);
  const [ending,      setEnding]      = useState(null);

  // Archive
  const [savedStories, setSavedStories] = useState(() => load(STORIES_KEY, []));

  // Output forge
  const [outputLoading, setOutputLoading] = useState(false);
  const [outputResult,  setOutputResult]  = useState(null);
  const [copiedField,   setCopiedField]   = useState(null);

  const logEndRef = useRef(null);
  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [eventLog, currentScene]);

  // ── Build opening story ──────────────────────────────────────────────────
  const buildStory = useCallback(async () => {
    if (!events.trim()) return;
    setBuilding(true); setBuildError("");
    try {
      const gameCtx = pullGameContext();
      const prompt = [
        `Real life events this week: ${events}`,
        context.background && `Character background: ${context.background}`,
        gameCtx,
        `Tone: ${context.tone}`,
        context.invited && `Invited contacts for branching: ${context.invited}`,
        `Location: Atlanta, GA. This hero is a marketing business owner.`,
      ].filter(Boolean).join("\n");

      const raw = await invokeLLM({ systemPrompt: STORY_SYSTEM, prompt });
      const parsed = parseJSON(raw);
      if (!parsed) { setBuildError("Story generation failed — try rephrasing your events."); setBuilding(false); return; }

      setStory(parsed);
      setStats(parsed.stats || DEFAULT_STATS);
      setStatDeltas({});
      setEventLog([]);
      setCurrentScene({ scene: parsed.openingScene, choice: parsed.choice, insightUnlocked: null });
      setIsEnded(false);
      setEnding(null);
      setOutputResult(null);
      setActiveTab("play");
    } catch (e) { setBuildError(e.message); }
    setBuilding(false);
  }, [events, context]);

  // ── Make a choice ────────────────────────────────────────────────────────
  const makeChoice = useCallback(async (option) => {
    if (!story || choosing) return;
    setChoosing(true);

    // Apply immediate stat impacts
    const newStats = { ...stats };
    Object.entries(option.statImpacts || {}).forEach(([k, v]) => { newStats[k] = Math.max(0, Math.min(100, (newStats[k] || 50) + v)); });
    setStats(newStats);
    setStatDeltas(option.statImpacts || {});

    // Add current scene to log
    const logEntry = { scene: currentScene.scene, chosenOption: `${option.id}: ${option.label}`, insightUnlocked: currentScene.insightUnlocked };
    setEventLog(prev => [...prev, logEntry]);

    // Build history summary for AI
    const histSummary = [...eventLog, logEntry].map((e, i) => `Beat ${i + 1}: ${e.chosenOption || "opening"}`).join(" → ");
    const choiceCount = eventLog.length + 1;

    const prompt = [
      `Story: "${story.storyTitle}"`,
      `Choice made: ${option.id} — ${option.label}: ${option.description}`,
      `Story beats so far: ${histSummary}`,
      `Current stats: ${Object.entries(newStats).map(([k, v]) => `${k}:${v}`).join(", ")}`,
      `Choice number: ${choiceCount} (consider ending if 5+)`,
    ].join("\n");

    const raw = await invokeLLM({ systemPrompt: CHOICE_SYSTEM, prompt });
    const parsed = parseJSON(raw);

    if (!parsed) { setChoosing(false); return; }

    // Apply additional stat changes
    const finalStats = { ...newStats };
    Object.entries(parsed.statChanges || {}).forEach(([k, v]) => { finalStats[k] = Math.max(0, Math.min(100, (finalStats[k] || 50) + v)); });
    setStats(finalStats);

    // Push insight to Life Audit
    if (parsed.insightUnlocked) pushAuditInsight(parsed.insightUnlocked);

    if (parsed.isEnding) {
      setIsEnded(true);
      setEnding({ type: parsed.endingType, epilogue: parsed.epilogue });
      setEventLog(prev => [...prev, { scene: parsed.scene, chosenOption: null, insightUnlocked: parsed.insightUnlocked }]);
      setCurrentScene(null);
    } else {
      setCurrentScene({ scene: parsed.scene, choice: parsed.choice, insightUnlocked: parsed.insightUnlocked });
    }

    setChoosing(false);
  }, [story, stats, currentScene, eventLog, choosing]);

  // ── Save story ────────────────────────────────────────────────────────────
  function saveStory() {
    if (!story) return;
    const entry = { id: Date.now(), title: story.storyTitle, genre: story.genre, choiceCount: eventLog.length, endingType: ending?.type || "In Progress", savedAt: new Date().toISOString(), storyData: { story, eventLog, stats, ending } };
    const next = [entry, ...savedStories].slice(0, 15);
    setSavedStories(next); save(STORIES_KEY, next);
  }

  // ── Generate output ───────────────────────────────────────────────────────
  const generateOutput = useCallback(async () => {
    if (!story || eventLog.length < 2) return;
    setOutputLoading(true); setOutputResult(null);
    const storyBeats = eventLog.map((e, i) => `Beat ${i + 1}: ${e.chosenOption || "Opening"}\n${(e.scene || "").slice(0, 200)}...`).join("\n\n");
    const prompt = `Story: "${story.storyTitle}" (${story.genre})\n\nConflict: ${story.conflict}\n\nStory beats:\n${storyBeats}\n\nEnding: ${ending?.type || "In Progress"}\n${ending?.epilogue || ""}`;
    const raw = await invokeLLM({ systemPrompt: OUTPUT_SYSTEM, prompt });
    setOutputResult(parseJSON(raw));
    setOutputLoading(false);
  }, [story, eventLog, ending]);

  function copy(text, key) { navigator.clipboard.writeText(text).then(() => { setCopiedField(key); setTimeout(() => setCopiedField(null), 1800); }); }

  // ── Styles ────────────────────────────────────────────────────────────────
  const card = { background: "#11131f", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12 };
  const inp  = { padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "#0a0b12", fontSize: 12, color: "#f0ede8", outline: "none", boxSizing: "border-box", width: "100%" };
  const btnS = (col) => ({ padding: "6px 14px", borderRadius: 8, background: `${col}15`, border: `1px solid ${col}40`, color: col, fontSize: 11, fontWeight: 600, cursor: "pointer" });

  const TABS = [
    { id: "new",     label: "📖 New Story"  },
    { id: "play",    label: "⚔️ Play",      badge: story && !isEnded ? "▶" : null },
    { id: "archive", label: "📚 Archive",   badge: savedStories.length || null },
    { id: "output",  label: "✂️ Output"    },
  ];

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* Header */}
      <div style={{ background: `linear-gradient(135deg, ${C.red}15, ${C.orange}10)`, borderBottom: `1px solid ${C.red}25`, padding: "14px 20px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={onBack} style={{ background: "none", border: "none", color: "#6aaedd", fontSize: 11, cursor: "pointer", padding: 0 }}>← Back</button>
          <span style={{ color: "#2a3a4a" }}>|</span>
          <span style={{ fontSize: 20 }}>⚔️</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: C.red }}>Narrative Conflict Engine</div>
            <div style={{ fontSize: 11, color: "#6aaedd" }}>Your week becomes an interactive life RPG with branching choices and real stakes</div>
          </div>
          {story && (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <GenreBadge genre={story.genre} />
              {(isEnded || eventLog.length > 1) && <button onClick={saveStory} style={btnS(C.gold)}>Save Story</button>}
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 2, padding: "6px 14px", background: "#0f1120", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            style={{ padding: "6px 13px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", background: activeTab === t.id ? `${C.red}20` : "transparent", color: activeTab === t.id ? C.red : "#6aaedd", borderBottom: activeTab === t.id ? `2px solid ${C.red}` : "2px solid transparent" }}>
            {t.label}
            {t.badge && <span style={{ marginLeft: 4, background: C.red, color: "#fff", borderRadius: 10, padding: "1px 6px", fontSize: 9, fontWeight: 800 }}>{t.badge}</span>}
          </button>
        ))}
      </div>

      {/* ── NEW STORY TAB ── */}
      {activeTab === "new" && (
        <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
          <div style={{ maxWidth: 600 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#f0ede8", marginBottom: 4 }}>Start a New Life RPG Story</div>
            <div style={{ fontSize: 11, color: "#6aaedd", marginBottom: 20 }}>Feed in your real events — the AI turns them into an interactive RPG with stats, branching choices, and narrative output you can share.</div>

            {/* Presets */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, color: "#4a5568", fontWeight: 700, marginBottom: 8 }}>QUICK SCENARIOS</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                {PRESETS.map(p => (
                  <button key={p.label} onClick={() => { setEvents(p.events); setContext(c => ({ ...c, background: p.context })); }}
                    style={{ padding: "8px 12px", borderRadius: 10, border: `1px solid ${events === p.events ? C.red : "rgba(255,255,255,0.08)"}`, background: events === p.events ? `${C.red}12` : "transparent", color: events === p.events ? C.red : "#8892a4", cursor: "pointer", textAlign: "left", fontSize: 11 }}>
                    ⚔️ {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Events input */}
            <div style={{ ...card, padding: 16, marginBottom: 12, border: `1px solid ${C.red}20` }}>
              <label style={{ fontSize: 10, color: C.red, fontWeight: 700, display: "block", marginBottom: 6 }}>⚔️ THIS WEEK'S REAL EVENTS</label>
              <textarea value={events} onChange={e => setEvents(e.target.value)}
                placeholder="e.g. Big client lead came in Monday. Kid's recital Thursday. Gaming tournament Saturday. Budget review overdue. Argument with partner about work-life balance Wednesday..."
                style={{ ...inp, minHeight: 90, resize: "vertical", lineHeight: 1.6 }} />
            </div>

            {/* Context */}
            <div style={{ ...card, padding: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 10, color: "#6aaedd", fontWeight: 700, marginBottom: 10 }}>STORY OPTIONS</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <div>
                  <label style={{ fontSize: 10, color: "#6aaedd", display: "block", marginBottom: 4 }}>Your Character Background</label>
                  <input value={context.background} onChange={e => setContext(c => ({ ...c, background: e.target.value }))} placeholder="e.g. Atlanta dad, 10yr marketing vet, former gamer" style={inp} />
                </div>
                <div>
                  <label style={{ fontSize: 10, color: "#6aaedd", display: "block", marginBottom: 4 }}>Invited Characters (optional)</label>
                  <input value={context.invited} onChange={e => setContext(c => ({ ...c, invited: e.target.value }))} placeholder="e.g. Sarah (spouse), Marcus (business partner)" style={inp} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 10, color: "#6aaedd", display: "block", marginBottom: 6 }}>Story Tone</label>
                <div style={{ display: "flex", gap: 6 }}>
                  {["humorous", "balanced", "dramatic", "epic"].map(t => (
                    <button key={t} onClick={() => setContext(c => ({ ...c, tone: t }))}
                      style={{ flex: 1, padding: "6px", borderRadius: 8, border: `1px solid ${context.tone === t ? C.orange : "rgba(255,255,255,0.08)"}`, background: context.tone === t ? `${C.orange}15` : "transparent", color: context.tone === t ? C.orange : "#8892a4", fontSize: 11, cursor: "pointer", fontWeight: context.tone === t ? 700 : 400, textTransform: "capitalize" }}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {buildError && <div style={{ color: C.red, fontSize: 12, padding: "8px 12px", background: `${C.red}10`, borderRadius: 8, marginBottom: 12 }}>{buildError}</div>}

            <button onClick={buildStory} disabled={building || !events.trim()}
              style={{ width: "100%", padding: 13, borderRadius: 12, background: `linear-gradient(135deg, ${C.red}, ${C.orange})`, border: "none", color: "#fff", fontSize: 13, fontWeight: 800, cursor: events.trim() && !building ? "pointer" : "not-allowed", opacity: events.trim() ? 1 : 0.4 }}>
              {building ? "⚔️ Forging your story..." : "⚔️ Begin the Story"}
            </button>
          </div>
        </div>
      )}

      {/* ── PLAY TAB ── */}
      {activeTab === "play" && (
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

          {/* Left: Story + Choices */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

            {!story ? (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, color: "#4a5568" }}>
                <div style={{ fontSize: 48 }}>⚔️</div>
                <div style={{ fontSize: 13 }}>No active story. Create one in the New Story tab.</div>
                <button onClick={() => setActiveTab("new")} style={{ padding: "8px 20px", borderRadius: 10, background: `${C.red}20`, border: `1px solid ${C.red}40`, color: C.red, fontSize: 12, cursor: "pointer", fontWeight: 700 }}>Start a Story</button>
              </div>
            ) : (
              <>
                {/* Story header */}
                <div style={{ padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.05)", background: "#0d0e17", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: C.red }}>{story.storyTitle}</span>
                  <GenreBadge genre={story.genre} />
                  <span style={{ fontSize: 10, color: "#4a5568", marginLeft: "auto" }}>Beat {eventLog.length + (isEnded ? 0 : 1)}</span>
                </div>

                {/* Scrollable content */}
                <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>

                  {/* Opening character intro (first time) */}
                  {eventLog.length === 0 && story.characterIntro && (
                    <div style={{ ...card, padding: 14, marginBottom: 16, border: `1px solid ${C.gold}20` }}>
                      <div style={{ fontSize: 10, color: C.gold, fontWeight: 700, marginBottom: 4 }}>🗡️ HERO PROFILE</div>
                      <div style={{ fontSize: 12, color: "#c8c8d0", lineHeight: 1.6, fontStyle: "italic" }}>{story.characterIntro}</div>
                    </div>
                  )}

                  {/* Conflict */}
                  {eventLog.length === 0 && story.conflict && (
                    <div style={{ fontSize: 11, padding: "6px 12px", borderRadius: 8, background: `${C.red}10`, border: `1px solid ${C.red}20`, color: C.red, marginBottom: 14 }}>
                      ⚔️ Central Conflict: {story.conflict}
                    </div>
                  )}

                  {/* Event log (previous beats) */}
                  {eventLog.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 10, color: "#4a5568", fontWeight: 700, marginBottom: 8 }}>STORY SO FAR</div>
                      {eventLog.map((e, i) => <EventEntry key={i} entry={e} index={i} />)}
                    </div>
                  )}

                  {/* Current scene */}
                  {currentScene && (
                    <div>
                      <div style={{ fontSize: 12, color: "#e2e8f0", lineHeight: 1.9, marginBottom: 20, whiteSpace: "pre-wrap" }}>
                        {currentScene.scene}
                      </div>
                      {currentScene.insightUnlocked && (
                        <div style={{ padding: "8px 12px", borderRadius: 8, background: `${C.gold}08`, border: `1px solid ${C.gold}20`, fontSize: 11, color: C.gold, marginBottom: 16 }}>
                          💡 {currentScene.insightUnlocked}
                        </div>
                      )}
                      {currentScene.choice && (
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#f0ede8", marginBottom: 12 }}>{currentScene.choice.prompt}</div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {(currentScene.choice.options || []).map(opt => (
                              <ChoiceCard key={opt.id} option={opt} onSelect={makeChoice} disabled={choosing} />
                            ))}
                          </div>
                          {choosing && (
                            <div style={{ textAlign: "center", padding: 16, color: C.orange, fontSize: 12 }}>
                              ⚔️ Writing the next chapter...
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Ending */}
                  {isEnded && ending && (
                    <div>
                      <div style={{ ...card, padding: 20, border: `1px solid ${C.gold}30`, marginBottom: 16 }}>
                        <div style={{ fontSize: 10, color: C.gold, fontWeight: 700, marginBottom: 8 }}>
                          {ending.type === "Victory" ? "🏆" : ending.type === "Bittersweet" ? "🌙" : ending.type === "Plot Twist" ? "🌀" : "📖"} {ending.type?.toUpperCase()} ENDING
                        </div>
                        <div style={{ fontSize: 12, color: "#c8c8d0", lineHeight: 1.9, whiteSpace: "pre-wrap" }}>{ending.epilogue}</div>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => { setActiveTab("output"); generateOutput(); }} style={{ ...btnS(C.purple), flex: 1, textAlign: "center" }}>✂️ Generate Output Content</button>
                        <button onClick={() => setActiveTab("new")} style={btnS(C.red)}>New Story</button>
                      </div>
                    </div>
                  )}

                  <div ref={logEndRef} />
                </div>
              </>
            )}
          </div>

          {/* Right: Stats panel */}
          {story && (
            <div style={{ width: 200, flexShrink: 0, borderLeft: "1px solid rgba(255,255,255,0.06)", padding: "14px 14px", overflowY: "auto", background: "#0d0e17" }}>
              <div style={{ fontSize: 10, color: "#4a5568", fontWeight: 700, marginBottom: 12, letterSpacing: ".08em" }}>CHARACTER STATS</div>
              {STATS.map(s => (
                <StatBar key={s.key} stat={s} value={stats[s.key] || 50} delta={statDeltas[s.key] || 0} />
              ))}

              {/* Mini-audit link */}
              <div style={{ marginTop: 16, padding: "8px 10px", borderRadius: 8, background: `${C.teal}08`, border: `1px solid ${C.teal}15` }}>
                <div style={{ fontSize: 9, color: C.teal, fontWeight: 700, marginBottom: 3 }}>LIFE AUDIT FEED</div>
                <div style={{ fontSize: 10, color: "#6aaedd", lineHeight: 1.5 }}>Insights from this story are automatically sent to your Life Audit panel.</div>
              </div>

              {/* GameState link */}
              {pullGameContext() && (
                <div style={{ marginTop: 8, padding: "8px 10px", borderRadius: 8, background: `${C.orange}08`, border: `1px solid ${C.orange}15` }}>
                  <div style={{ fontSize: 9, color: C.orange, fontWeight: 700, marginBottom: 3 }}>🎮 GAMESTATE DATA</div>
                  <div style={{ fontSize: 10, color: "#6aaedd", lineHeight: 1.5 }}>Gaming sessions loaded into story context.</div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── ARCHIVE TAB ── */}
      {activeTab === "archive" && (
        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#f0ede8", marginBottom: 4 }}>Story Archive</div>
          <div style={{ fontSize: 11, color: "#6aaedd", marginBottom: 16 }}>Your completed and in-progress life RPG stories</div>
          {savedStories.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: "#4a5568" }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>📚</div>
              <div>No saved stories yet. Complete a story and save it.</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {savedStories.map(s => {
                const endColor = { Victory: C.gold, Bittersweet: C.blue, "Plot Twist": C.purple, "To Be Continued": C.orange, "In Progress": C.teal }[s.endingType] || C.red;
                return (
                  <div key={s.id} style={{ ...card, padding: 16, display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#f0ede8" }}>{s.title}</span>
                        <GenreBadge genre={s.genre} />
                      </div>
                      <div style={{ display: "flex", gap: 10, fontSize: 10, color: "#4a5568" }}>
                        <span>{s.choiceCount} choices</span>
                        <span style={{ color: endColor, fontWeight: 700 }}>{s.endingType}</span>
                        <span>{new Date(s.savedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => {
                        const { story: st, eventLog: el, stats: ss, ending: en } = s.storyData;
                        setStory(st); setEventLog(el); setStats(ss); setEnding(en);
                        setIsEnded(!!en); setCurrentScene(null); setStatDeltas({});
                        setActiveTab("play");
                      }} style={btnS(C.red)}>Resume</button>
                      <button onClick={() => { const next = savedStories.filter(x => x.id !== s.id); setSavedStories(next); save(STORIES_KEY, next); }} style={btnS(C.red)}>×</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── OUTPUT FORGE TAB ── */}
      {activeTab === "output" && (
        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#f0ede8", marginBottom: 4 }}>Output Forge</div>
          <div style={{ fontSize: 11, color: "#6aaedd", marginBottom: 16 }}>Transform your life RPG story into shareable real-world content</div>

          {!story || eventLog.length < 2 ? (
            <div style={{ textAlign: "center", padding: 40, color: "#4a5568" }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>✂️</div>
              <div style={{ lineHeight: 1.6 }}>Play through at least 2 story beats to unlock output generation.</div>
            </div>
          ) : !outputResult ? (
            <div style={{ textAlign: "center", padding: 40 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>✂️</div>
              <div style={{ fontSize: 13, color: "#c8c8d0", marginBottom: 20, maxWidth: 360, margin: "0 auto 20px", lineHeight: 1.6 }}>
                Turn "{story?.storyTitle}" into a blog post, social caption, LinkedIn story, video script, or game pitch.
              </div>
              <button onClick={generateOutput} disabled={outputLoading}
                style={{ padding: "12px 28px", borderRadius: 10, background: `linear-gradient(135deg, ${C.red}, ${C.purple})`, border: "none", color: "#fff", fontSize: 13, fontWeight: 800, cursor: outputLoading ? "not-allowed" : "pointer" }}>
                {outputLoading ? "Generating outputs..." : "✂️ Generate All Outputs"}
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {[
                { key: "shortStory",      label: "📖 Short Story",       col: C.orange  },
                { key: "socialPost",      label: "📣 Social Post",        col: C.pink    },
                { key: "linkedinVersion", label: "💼 LinkedIn Post",      col: C.blue    },
                { key: "videoScript",     label: "🎬 60-sec Video Script", col: C.teal   },
                { key: "gamePitch",       label: "🎮 Game Mod Pitch",      col: C.purple  },
              ].map(({ key, label, col }) => outputResult[key] ? (
                <div key={key} style={{ ...card, padding: 0, border: `1px solid ${col}20`, overflow: "hidden" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderBottom: `1px solid ${col}15` }}>
                    <span style={{ fontSize: 11, color: col, fontWeight: 700 }}>{label}</span>
                    <button onClick={() => copy(outputResult[key], key)}
                      style={{ ...btnS(col), padding: "4px 12px" }}>
                      {copiedField === key ? "✓ Copied" : "Copy"}
                    </button>
                  </div>
                  <div style={{ padding: "12px 14px", fontSize: 12, color: "#c8c8d0", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>
                    {outputResult[key]}
                  </div>
                </div>
              ) : null)}
              <button onClick={() => setOutputResult(null)} style={{ ...btnS(C.red), alignSelf: "flex-start" }}>Regenerate</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
