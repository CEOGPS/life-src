import { useState, useCallback, useEffect, useRef } from "react";
import { invokeLLM } from "@/api/ceogpsclient";
import { supabase } from "@/lib/supabaseClient";

const C = { pink: "#ff6b9d", purple: "#8b7fff", orange: "#ff8c42", teal: "#00c896", blue: "#4ab3f4", red: "#ff4f5e", gold: "#ffd700" };

// Pull consented contacts from EchoPersona Weaver
function loadContacts() {
  try { return JSON.parse(localStorage.getItem("lifeos1_echo_contacts") || "[]"); } catch { return []; }
}
// Pull recent joy log for mood context
function loadJoyMood() {
  try { const log = JSON.parse(localStorage.getItem("lifeos1_joy_log") || "[]"); return log[0]?.category || null; } catch { return null; }
}

const MOODS = [
  { id: "silly",      emoji: "🤪", label: "Silly",      color: C.orange  },
  { id: "heartfelt",  emoji: "❤️", label: "Heartfelt",  color: C.pink    },
  { id: "chaotic",    emoji: "🎉", label: "Chaotic",    color: C.purple  },
  { id: "roast",      emoji: "😂", label: "Roast Mode", color: C.red     },
];

const STYLES = [
  { id: "silly",           label: "🤪 Silly Pop",       desc: "Bouncy and ridiculous"      },
  { id: "heartfelt",       label: "❤️ Heartfelt Ballad", desc: "Warm and genuine"           },
  { id: "chaotic",         label: "🎉 Chaos Anthem",    desc: "Full unhinged energy"        },
  { id: "roast",           label: "😂 Friendly Roast",  desc: "Playful teasing, all love"   },
  { id: "romantic_comedy", label: "🎬 Rom-Com Duet",    desc: "Like a movie moment"         },
];

const SETTINGS = [
  "🏠 Living room",  "🚗 Car ride",  "🌳 Atlanta park",
  "🎉 Party",        "🍕 Dinner",    "📱 Video call",
  "🛋️ Couch night",  "🏀 Postgame",  "🛒 Grocery run",
];

// ── AI prompt ─────────────────────────────────────────────────────────────────
const DUET_SYSTEM = `You are the Karaoke Duet Generator — a wildly playful AI comedian specializing in original song parodies for maximum fun and laughter. You write for pure joy. Zero productivity, zero optimization. Just delight.

Given the singers and context, return ONLY valid JSON:
{
  "songTitle": "Funny, original song title",
  "originalSongVibe": "Sound-alike description (e.g. 'Think 80s power ballad meets Shrek soundtrack')",
  "style": "silly",
  "lyrics": {
    "intro": { "singer": "Both", "lines": ["Line 1", "Line 2"] },
    "verse1": { "singer": "Singer 1", "lines": ["Line 1", "Line 2", "Line 3", "Line 4"] },
    "verse2": { "singer": "Singer 2", "lines": ["Line 1", "Line 2", "Line 3", "Line 4"] },
    "chorus": { "singer": "Both", "lines": ["Line 1", "Line 2", "Line 3", "Line 4"] },
    "bridge": { "singer": "Both", "lines": ["Line 1 (alternating)", "Line 2 (alternating)", "Line 3 (both together)"] },
    "outro": { "singer": "Both", "lines": ["Final line 1", "Final line 2 — the big finish"] }
  },
  "performancePrompts": {
    "singer1Stage": "Ridiculous stage direction for Singer 1 (full character)",
    "singer2Stage": "Ridiculous stage direction for Singer 2",
    "chorusDance": "The specific ridiculous move they both do on the chorus",
    "bridgeGimmick": "The bit they pull during the bridge",
    "finaleInstruction": "How they end the song dramatically"
  },
  "backingTrack": "Free/public-domain song name and tempo to search on YouTube or hum — e.g. 'Karaoke version of Sweet Caroline, 105 BPM'",
  "highlightPrompt": "A funny 1-sentence description of the most ridiculous moment from this song for a meme/highlight reel",
  "insideJokeLines": ["The funniest lines that reference their actual friendship/relationship"],
  "rating": "G",
  "totalRuntime": "~2 minutes"
}

Rules:
- Original lyrics ONLY — no reproduction of copyrighted lyrics
- Keep everything wholesome and kind (G-rated)
- Reference Atlanta, the setting, and personality details naturally
- Make it genuinely funny and personally tailored
- Roast style = playful teasing only, always loving`;

function parseJSON(raw) {
  try { const m = raw.match(/\{[\s\S]*\}/); return m ? JSON.parse(m[0]) : null; } catch { return null; }
}

// ── Streaming word reveal ─────────────────────────────────────────────────────
function useReveal(text, active) {
  const [revealed, setRevealed] = useState(0);
  useEffect(() => {
    if (!active || !text) { setRevealed(0); return; }
    const words = text.split(" ").length;
    let i = 0;
    const interval = setInterval(() => {
      i += 3;
      setRevealed(i);
      if (i >= words) clearInterval(interval);
    }, 40);
    return () => clearInterval(interval);
  }, [text, active]);
  if (!active) return text;
  return text.split(" ").slice(0, revealed).join(" ");
}

// ── Sing-along line highlighter ───────────────────────────────────────────────
function SingAlongSection({ section, sectionKey, singer1Name, singer2Name, activeSection, activeLine, userIsSinger1 }) {
  const isActive = activeSection === sectionKey;
  const singerLabel = section.singer === "Singer 1" ? singer1Name
    : section.singer === "Singer 2" ? singer2Name : "Both";
  const singerColor = section.singer === "Singer 1" ? C.pink
    : section.singer === "Singer 2" ? C.purple : C.teal;
  const isMyPart = (section.singer === "Singer 1" && userIsSinger1) || (section.singer === "Singer 2" && !userIsSinger1) || section.singer === "Both";

  return (
    <div style={{ marginBottom: 20, padding: "14px 16px", borderRadius: 12, background: isActive ? `${singerColor}12` : "rgba(255,255,255,0.02)", border: `1px solid ${isActive ? singerColor : "rgba(255,255,255,0.06)"}`, transition: "all 0.3s" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 10, padding: "2px 10px", borderRadius: 10, background: `${singerColor}20`, color: singerColor, fontWeight: 700, textTransform: "uppercase" }}>
          {sectionKey.replace(/\d/g, " ").trim()}
        </span>
        <span style={{ fontSize: 11, color: singerColor, fontWeight: 600 }}>{singerLabel}</span>
        {isMyPart && isActive && <span style={{ fontSize: 10, color: C.gold, fontWeight: 700, marginLeft: "auto" }}>← YOUR TURN</span>}
      </div>
      {(section.lines || []).map((line, i) => (
        <div key={i} style={{ fontSize: isActive && activeLine === i ? 16 : 14, fontWeight: isActive && activeLine === i ? 800 : 400, color: isActive && activeLine === i ? "#fff" : "#8892a4", marginBottom: 6, lineHeight: 1.5, transition: "all 0.2s", paddingLeft: isActive && activeLine === i ? 8 : 0, borderLeft: isActive && activeLine === i ? `3px solid ${singerColor}` : "3px solid transparent" }}>
          {line}
        </div>
      ))}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function KaraokeDuetGenerator({ onBack }) {
  const [activeTab, setActiveTab] = useState("setup");

  // Setup state
  const [contacts]     = useState(loadContacts);
  const [selectedPartners, setSelectedPartners] = useState([]);
  const [manualPartner, setManualPartner] = useState("");
  const [mood,    setMood]    = useState(null);
  const [style,   setStyle]   = useState("silly");
  const [setting, setSetting] = useState("");
  const [extra,   setExtra]   = useState("");

  // Generation
  const [generating, setGenerating] = useState(false);
  const [duet,       setDuet]       = useState(null);
  const [error,      setError]      = useState("");
  const [revealActive, setRevealActive] = useState(false);

  // Sing-along
  const [singAlong,    setSingAlong]    = useState(false);
  const [activeSection, setActiveSection] = useState(null);
  const [activeLine,    setActiveLine]    = useState(0);
  const [userIsSinger1, setUserIsSinger1] = useState(true);
  const timerRef = useRef(null);

  // Recent duets
  const [recentDuets, setRecentDuets] = useState([]);
  const [loadingRecent, setLoadingRecent] = useState(false);

  // Saving
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);

  // Reveal effect when duet loads
  useEffect(() => {
    if (duet) { setRevealActive(true); setTimeout(() => setRevealActive(false), 4000); }
  }, [duet]);

  // Load recent duets from Supabase
  const loadRecent = useCallback(async () => {
    setLoadingRecent(true);
    try {
      const { data } = await supabase.from("karaoke_duets").select("*").order("generated_at", { ascending: false }).limit(10);
      setRecentDuets(data || []);
    } catch {}
    setLoadingRecent(false);
  }, []);

  useEffect(() => { if (activeTab === "recent") loadRecent(); }, [activeTab, loadRecent]);

  // ── Generate duet ─────────────────────────────────────────────────────────
  const generate = useCallback(async () => {
    const partners = [...selectedPartners.map(c => c.name), ...(manualPartner.trim() ? [manualPartner.trim()] : [])];
    if (!partners.length) return;
    setGenerating(true); setDuet(null); setError(""); setSaved(false);

    const joyMood = loadJoyMood();
    const prompt = [
      `Singer 1 (you): Chris — marketing business owner, Atlanta dad, gamer, loves fun`,
      `Singer 2+: ${partners.join(", ")}`,
      selectedPartners.length > 0 && `Personality notes: ${selectedPartners.map(c => `${c.name}: ${c.personality || "fun person"}`).join("; ")}`,
      mood && `Mood: ${MOODS.find(m => m.id === mood)?.label}`,
      joyMood && `Recent joy vibe: ${joyMood}`,
      `Style: ${STYLES.find(s => s.id === style)?.label}`,
      setting && `Setting: ${setting}`,
      extra && `Special notes/inside jokes: ${extra}`,
      `Location: Atlanta, GA`,
    ].filter(Boolean).join("\n");

    const raw = await invokeLLM({ systemPrompt: DUET_SYSTEM, prompt }).catch(e => e.message);
    const parsed = parseJSON(raw);
    if (!parsed) { setError("Generation failed — try again!"); setGenerating(false); return; }
    setDuet(parsed);
    setGenerating(false);
    setActiveTab("lyrics");
  }, [selectedPartners, manualPartner, mood, style, setting, extra]);

  // ── Save to Supabase ──────────────────────────────────────────────────────
  const saveDuet = useCallback(async () => {
    if (!duet || saving) return;
    setSaving(true);
    try {
      const partners = [...selectedPartners.map(c => c.name), ...(manualPartner.trim() ? [manualPartner.trim()] : [])];
      await supabase.from("karaoke_duets").insert({
        user_id: "chris-green",
        session_name: duet.songTitle,
        participants: partners,
        lyrics: duet.lyrics,
        style: duet.style || style,
        mood_at_creation: mood,
        setting,
        backing_track: duet.backingTrack,
        highlight_prompt: duet.highlightPrompt,
        expires_at: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
        saved: true,
      });
      setSaved(true);
    } catch (e) { console.error(e); }
    setSaving(false);
  }, [duet, saving, selectedPartners, manualPartner, style, mood, setting]);

  // ── Sing-along mode ───────────────────────────────────────────────────────
  function startSingAlong() {
    if (!duet) return;
    setSingAlong(true);
    const sections = Object.keys(duet.lyrics);
    let si = 0, li = 0;
    setActiveSection(sections[0]);
    setActiveLine(0);

    timerRef.current = setInterval(() => {
      const sec = duet.lyrics[sections[si]];
      li++;
      if (li >= (sec?.lines?.length || 1)) {
        li = 0; si++;
        if (si >= sections.length) { clearInterval(timerRef.current); setSingAlong(false); setActiveSection(null); return; }
      }
      setActiveSection(sections[si]);
      setActiveLine(li);
    }, 3500);
  }

  function stopSingAlong() {
    clearInterval(timerRef.current);
    setSingAlong(false);
    setActiveSection(null);
    setActiveLine(0);
  }

  useEffect(() => () => clearInterval(timerRef.current), []);

  // ── Styles ────────────────────────────────────────────────────────────────
  const card = { background: "#11131f", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12 };
  const inp  = { padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "#0a0b12", fontSize: 12, color: "#f0ede8", outline: "none", boxSizing: "border-box", width: "100%" };
  const btnS = (col) => ({ padding: "6px 14px", borderRadius: 8, background: `${col}15`, border: `1px solid ${col}40`, color: col, fontSize: 11, fontWeight: 600, cursor: "pointer" });

  const partners = [...selectedPartners.map(c => c.name), ...(manualPartner.trim() ? [manualPartner.trim()] : [])];
  const singer2Name = partners[0] || "Partner";

  const TABS = [
    { id: "setup",  label: "🎤 Setup"    },
    { id: "lyrics", label: "🎵 Lyrics",  badge: duet ? "●" : null },
    { id: "recent", label: "📼 Recent"   },
  ];

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* Header */}
      <div style={{ background: `linear-gradient(135deg, ${C.pink}20, ${C.purple}12)`, borderBottom: `1px solid ${C.pink}30`, padding: "14px 20px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={onBack} style={{ background: "none", border: "none", color: "#6aaedd", fontSize: 11, cursor: "pointer", padding: 0 }}>← Back</button>
          <span style={{ color: "#2a3a4a" }}>|</span>
          <span style={{ fontSize: 22 }}>🎤</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: C.pink }}>Karaoke Duet Generator</div>
            <div style={{ fontSize: 11, color: "#6aaedd" }}>Custom AI-written duets with your people — pure joy, zero productivity</div>
          </div>
          {duet && (
            <div style={{ display: "flex", gap: 8 }}>
              {!saved ? (
                <button onClick={saveDuet} disabled={saving} style={{ ...btnS(C.gold), opacity: saving ? 0.5 : 1 }}>
                  {saving ? "Saving..." : "💾 Save Duet"}
                </button>
              ) : (
                <span style={{ fontSize: 11, color: C.teal, fontWeight: 700 }}>✓ Saved (48hr)</span>
              )}
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
            {t.badge && <span style={{ marginLeft: 4, color: C.pink, fontSize: 10 }}>{t.badge}</span>}
          </button>
        ))}
      </div>

      {/* ── SETUP TAB ── */}
      {activeTab === "setup" && (
        <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
          <div style={{ maxWidth: 600, margin: "0 auto" }}>

            {/* Partner selection */}
            <div style={{ ...card, padding: 18, marginBottom: 14, border: `1px solid ${C.pink}25` }}>
              <div style={{ fontSize: 10, color: C.pink, fontWeight: 700, marginBottom: 12 }}>🎤 WHO'S SINGING WITH YOU?</div>

              {contacts.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 10, color: "#4a5568", marginBottom: 8 }}>From your consented crew:</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {contacts.map(c => {
                      const sel = selectedPartners.some(p => p.id === c.id);
                      return (
                        <button key={c.id} onClick={() => setSelectedPartners(prev => sel ? prev.filter(p => p.id !== c.id) : [...prev, c])}
                          style={{ padding: "5px 14px", borderRadius: 20, border: `1px solid ${sel ? C.pink : "rgba(255,255,255,0.1)"}`, background: sel ? `${C.pink}20` : "transparent", color: sel ? C.pink : "#8892a4", fontSize: 11, cursor: "pointer", fontWeight: sel ? 700 : 400 }}>
                          {sel ? "✓ " : ""}{c.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <div style={{ fontSize: 10, color: "#4a5568", marginBottom: 6 }}>Or type a name:</div>
                <input value={manualPartner} onChange={e => setManualPartner(e.target.value)}
                  placeholder="e.g. Sarah, Marcus, The whole family..."
                  style={inp} />
              </div>

              {partners.length > 0 && (
                <div style={{ marginTop: 10, fontSize: 11, color: C.teal }}>
                  ✓ Singing with: <strong>{partners.join(" & ")}</strong>
                </div>
              )}
            </div>

            {/* Mood */}
            <div style={{ ...card, padding: 16, marginBottom: 14 }}>
              <div style={{ fontSize: 10, color: "#4a5568", fontWeight: 700, marginBottom: 10 }}>CURRENT VIBE</div>
              <div style={{ display: "flex", gap: 8 }}>
                {MOODS.map(m => (
                  <button key={m.id} onClick={() => setMood(mood === m.id ? null : m.id)}
                    style={{ flex: 1, padding: "10px 6px", borderRadius: 12, border: `1px solid ${mood === m.id ? m.color : "rgba(255,255,255,0.08)"}`, background: mood === m.id ? `${m.color}20` : "transparent", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <span style={{ fontSize: 24 }}>{m.emoji}</span>
                    <span style={{ fontSize: 10, color: mood === m.id ? m.color : "#8892a4", fontWeight: mood === m.id ? 700 : 400 }}>{m.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Style + Setting */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div style={{ ...card, padding: 14 }}>
                <div style={{ fontSize: 10, color: "#4a5568", fontWeight: 700, marginBottom: 8 }}>SONG STYLE</div>
                {STYLES.map(s => (
                  <button key={s.id} onClick={() => setStyle(s.id)}
                    style={{ display: "block", width: "100%", padding: "7px 10px", borderRadius: 8, border: `1px solid ${style === s.id ? C.purple : "rgba(255,255,255,0.06)"}`, background: style === s.id ? `${C.purple}15` : "transparent", color: style === s.id ? C.purple : "#8892a4", fontSize: 11, cursor: "pointer", textAlign: "left", fontWeight: style === s.id ? 700 : 400, marginBottom: 4 }}>
                    {s.label}
                    <div style={{ fontSize: 9, color: "#4a5568" }}>{s.desc}</div>
                  </button>
                ))}
              </div>
              <div style={{ ...card, padding: 14 }}>
                <div style={{ fontSize: 10, color: "#4a5568", fontWeight: 700, marginBottom: 8 }}>SETTING</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 10 }}>
                  {SETTINGS.map(s => (
                    <button key={s} onClick={() => setSetting(setting === s ? "" : s)}
                      style={{ padding: "5px 8px", borderRadius: 8, border: `1px solid ${setting === s ? C.orange : "rgba(255,255,255,0.06)"}`, background: setting === s ? `${C.orange}15` : "transparent", color: setting === s ? C.orange : "#8892a4", fontSize: 10, cursor: "pointer", textAlign: "left", fontWeight: setting === s ? 700 : 400 }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Extra / inside jokes */}
            <div style={{ ...card, padding: 14, marginBottom: 20 }}>
              <div style={{ fontSize: 10, color: "#4a5568", fontWeight: 700, marginBottom: 6 }}>INSIDE JOKES OR SPECIAL NOTES (optional but amazing)</div>
              <input value={extra} onChange={e => setExtra(e.target.value)}
                placeholder="e.g. Marcus always loses at Mario Kart, Sarah's obsessed with cats, that time we got lost in Decatur..."
                style={inp} />
            </div>

            {error && <div style={{ color: C.red, fontSize: 12, padding: "8px 12px", background: `${C.red}10`, borderRadius: 8, marginBottom: 12 }}>{error}</div>}

            <button onClick={generate} disabled={generating || partners.length === 0}
              style={{ width: "100%", padding: 16, borderRadius: 14, background: partners.length > 0 ? `linear-gradient(135deg, ${C.pink}, ${C.purple})` : "#1a1e2e", border: partners.length > 0 ? "none" : `1px solid rgba(255,255,255,0.1)`, color: partners.length > 0 ? "#fff" : "#4a5568", fontSize: 15, fontWeight: 900, cursor: partners.length > 0 && !generating ? "pointer" : "not-allowed", letterSpacing: ".03em" }}>
              {generating ? "🎤 Writing your duet..." : "🎤 Generate Duet"}
            </button>

            {partners.length === 0 && (
              <div style={{ textAlign: "center", fontSize: 11, color: "#4a5568", marginTop: 8 }}>Add at least one singing partner above</div>
            )}
          </div>
        </div>
      )}

      {/* ── LYRICS TAB ── */}
      {activeTab === "lyrics" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {!duet ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 14, color: "#4a5568" }}>
              <div style={{ fontSize: 52 }}>🎵</div>
              <div style={{ fontSize: 13 }}>Generate a duet first in the Setup tab.</div>
              <button onClick={() => setActiveTab("setup")} style={btnS(C.pink)}>Go to Setup</button>
            </div>
          ) : (
            <>
              {/* Duet header bar */}
              <div style={{ padding: "10px 18px", background: "#0d0e17", borderBottom: "1px solid rgba(255,255,255,0.05)", flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: "#f0ede8" }}>🎵 {duet.songTitle}</div>
                    <div style={{ fontSize: 11, color: "#6aaedd" }}>{duet.originalSongVibe} · {duet.totalRuntime}</div>
                  </div>
                  {/* Singer toggle */}
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => setUserIsSinger1(true)}
                      style={{ padding: "5px 12px", borderRadius: 8, border: `1px solid ${userIsSinger1 ? C.pink : "rgba(255,255,255,0.1)"}`, background: userIsSinger1 ? `${C.pink}20` : "transparent", color: userIsSinger1 ? C.pink : "#8892a4", fontSize: 10, cursor: "pointer", fontWeight: 700 }}>
                      You = Singer 1
                    </button>
                    <button onClick={() => setUserIsSinger1(false)}
                      style={{ padding: "5px 12px", borderRadius: 8, border: `1px solid ${!userIsSinger1 ? C.purple : "rgba(255,255,255,0.1)"}`, background: !userIsSinger1 ? `${C.purple}20` : "transparent", color: !userIsSinger1 ? C.purple : "#8892a4", fontSize: 10, cursor: "pointer", fontWeight: 700 }}>
                      You = Singer 2
                    </button>
                  </div>
                  {!singAlong ? (
                    <button onClick={startSingAlong}
                      style={{ padding: "8px 18px", borderRadius: 10, background: `linear-gradient(135deg, ${C.pink}, ${C.purple})`, border: "none", color: "#fff", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
                      ▶ Sing-Along Mode
                    </button>
                  ) : (
                    <button onClick={stopSingAlong} style={btnS(C.red)}>■ Stop</button>
                  )}
                </div>

                {/* Color legend */}
                <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                  <span style={{ fontSize: 10, color: C.pink }}>■ Singer 1 (Chris)</span>
                  <span style={{ fontSize: 10, color: C.purple }}>■ Singer 2 ({singer2Name})</span>
                  <span style={{ fontSize: 10, color: C.teal }}>■ Both</span>
                </div>
              </div>

              <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
                <div style={{ maxWidth: 680 }}>

                  {/* Lyrics */}
                  {Object.entries(duet.lyrics).map(([key, section]) => (
                    <SingAlongSection
                      key={key}
                      section={section}
                      sectionKey={key}
                      singer1Name="Chris"
                      singer2Name={singer2Name}
                      activeSection={activeSection}
                      activeLine={activeLine}
                      userIsSinger1={userIsSinger1}
                    />
                  ))}

                  {/* Performance prompts */}
                  {duet.performancePrompts && (
                    <div style={{ ...card, padding: 18, marginBottom: 16, border: `1px solid ${C.gold}25` }}>
                      <div style={{ fontSize: 11, color: C.gold, fontWeight: 700, marginBottom: 12 }}>🎭 PERFORMANCE STAGE DIRECTIONS</div>
                      {Object.entries(duet.performancePrompts).map(([key, val]) => {
                        const labels = { singer1Stage: "Singer 1 Character", singer2Stage: "Singer 2 Character", chorusDance: "Chorus Move 💃", bridgeGimmick: "Bridge Bit 🎪", finaleInstruction: "Grand Finale 🎆" };
                        return (
                          <div key={key} style={{ marginBottom: 10 }}>
                            <span style={{ fontSize: 10, color: C.gold, fontWeight: 700 }}>{labels[key] || key}: </span>
                            <span style={{ fontSize: 12, color: "#c8c8d0" }}>{val}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Backing track */}
                  {duet.backingTrack && (
                    <div style={{ ...card, padding: 14, marginBottom: 16, border: `1px solid ${C.blue}20` }}>
                      <div style={{ fontSize: 10, color: C.blue, fontWeight: 700, marginBottom: 4 }}>🎵 BACKING TRACK</div>
                      <div style={{ fontSize: 12, color: "#c8c8d0" }}>{duet.backingTrack}</div>
                      <div style={{ fontSize: 10, color: "#4a5568", marginTop: 4 }}>Search YouTube Karaoke for this or hum the melody described.</div>
                    </div>
                  )}

                  {/* Highlight reel prompt */}
                  {duet.highlightPrompt && (
                    <div style={{ ...card, padding: 14, marginBottom: 16, border: `1px solid ${C.pink}20`, background: `${C.pink}06` }}>
                      <div style={{ fontSize: 10, color: C.pink, fontWeight: 700, marginBottom: 4 }}>🎬 HIGHLIGHT REEL MOMENT</div>
                      <div style={{ fontSize: 12, color: "#f0ede8", lineHeight: 1.6 }}>{duet.highlightPrompt}</div>
                    </div>
                  )}

                  {/* Funniest lines */}
                  {duet.insideJokeLines?.length > 0 && (
                    <div style={{ ...card, padding: 14, marginBottom: 16 }}>
                      <div style={{ fontSize: 10, color: C.orange, fontWeight: 700, marginBottom: 8 }}>💥 THE LINES THAT'LL MAKE YOU LOSE IT</div>
                      {duet.insideJokeLines.map((line, i) => (
                        <div key={i} style={{ fontSize: 13, color: "#f0ede8", fontStyle: "italic", marginBottom: 6 }}>"{line}"</div>
                      ))}
                    </div>
                  )}

                  {/* New duet button */}
                  <button onClick={() => { setDuet(null); setSaved(false); setActiveTab("setup"); }}
                    style={{ width: "100%", padding: 12, borderRadius: 12, background: "transparent", border: `1px solid ${C.pink}40`, color: C.pink, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                    🎤 Generate Another Duet
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── RECENT TAB ── */}
      {activeTab === "recent" && (
        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#f0ede8" }}>Recent Duets</div>
              <div style={{ fontSize: 11, color: "#6aaedd" }}>Auto-expire after 48 hours unless saved</div>
            </div>
            <button onClick={loadRecent} style={btnS(C.pink)}>Refresh</button>
          </div>

          {loadingRecent ? (
            <div style={{ textAlign: "center", padding: 40, color: "#4a5568" }}>Loading...</div>
          ) : recentDuets.length === 0 ? (
            <div style={{ textAlign: "center", padding: 60, color: "#4a5568" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📼</div>
              <div style={{ fontSize: 13 }}>No saved duets yet. Generate one and hit Save!</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {recentDuets.map(d => {
                const expires = new Date(d.expires_at);
                const hoursLeft = Math.max(0, Math.floor((expires - Date.now()) / 3600000));
                const styleColors = { silly: C.orange, heartfelt: C.pink, chaotic: C.purple, roast: C.red, romantic_comedy: C.pink };
                const col = styleColors[d.style] || C.pink;
                return (
                  <div key={d.id} style={{ background: `${col}06`, border: `1px solid ${col}25`, borderRadius: 12, padding: 16 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: "#f0ede8", marginBottom: 4 }}>🎵 {d.session_name}</div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                          {(d.participants || []).map(p => (
                            <span key={p} style={{ fontSize: 10, padding: "1px 8px", borderRadius: 10, background: `${col}20`, color: col }}>{p}</span>
                          ))}
                          <span style={{ fontSize: 10, color: "#4a5568" }}>{new Date(d.generated_at).toLocaleDateString()}</span>
                        </div>
                        {d.backing_track && <div style={{ fontSize: 11, color: "#6aaedd" }}>🎵 {d.backing_track}</div>}
                        {d.highlight_prompt && (
                          <div style={{ fontSize: 11, color: "#8892a4", marginTop: 4, fontStyle: "italic" }}>"{d.highlight_prompt}"</div>
                        )}
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontSize: 10, color: hoursLeft < 6 ? C.red : "#4a5568" }}>
                          {hoursLeft > 0 ? `Expires in ${hoursLeft}h` : "Expired"}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Sing-along overlay indicator */}
      {singAlong && (
        <div style={{ position: "absolute", top: 70, right: 16, padding: "6px 14px", borderRadius: 20, background: `${C.pink}90`, border: `1px solid ${C.pink}`, color: "#fff", fontSize: 11, fontWeight: 700, backdropFilter: "blur(8px)", zIndex: 100 }}>
          ▶ Sing-Along Active
        </div>
      )}
    </div>
  );
}
