import { useState, useCallback, useRef, useEffect } from "react";
import { invokeLLM } from "@/api/ceogpsclient";

const C = { blue: "#4ab3f4", purple: "#8b7fff", teal: "#00c896", orange: "#ff8c42", pink: "#ff6b9d", red: "#ff4f5e", gold: "#ffd700", cyan: "#00e5ff" };

const CREW_KEY = "lifeos1_fantasy_crew";
function load(key, def) { try { return JSON.parse(localStorage.getItem(key) || "null") ?? def; } catch { return def; } }
function save(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

// ── Fantasy archetypes ────────────────────────────────────────────────────────
const ARCHETYPES = [
  { id: "pirate",      label: "⚓ Pirate",            color: C.orange },
  { id: "wizard",      label: "🧙 Wizard",            color: C.purple },
  { id: "superhero",   label: "🦸 Superhero",         color: C.blue   },
  { id: "rockstar",    label: "🎸 Rockstar",          color: C.red    },
  { id: "chef",        label: "👨‍🍳 Chaos Chef",       color: C.gold   },
  { id: "scientist",   label: "🔬 Mad Scientist",     color: C.teal   },
  { id: "athlete",     label: "🏆 Sports Legend",     color: C.orange },
  { id: "ninja",       label: "🥷 Ninja",             color: "#555"   },
  { id: "royalty",     label: "👑 Royalty",           color: C.gold   },
  { id: "time_traveler", label: "⏳ Time Traveler",  color: C.cyan   },
  { id: "detective",   label: "🔍 Detective",         color: C.blue   },
  { id: "dragon",      label: "🐉 Dragon Tamer",      color: C.red    },
];

// ── Atlanta scenario starters ─────────────────────────────────────────────────
const SCENARIOS = [
  { icon: "💦", title: "Ultimate Water Balloon Fight",    prompt: "Plan the ultimate Atlanta water balloon fight at Piedmont Park. Assign everyone roles, create a battle strategy, and argue about the rules." },
  { icon: "🏈", title: "Falcons Super Bowl Prediction",  prompt: "The Falcons are going to the Super Bowl. React in character, make wild predictions, and plan the watch party of the century in Atlanta." },
  { icon: "🍑", title: "Open an Atlanta Food Truck",     prompt: "You're all starting an Atlanta food truck together. Pick the name, the menu, the location, and the vibe. Argue hilariously about everything." },
  { icon: "🎤", title: "Karaoke Night Gone Wrong",       prompt: "It's karaoke night at a random Atlanta bar. Everyone picks the most wrong song for each other. Things escalate." },
  { icon: "🏀", title: "3-on-3 Basketball Trash Talk",  prompt: "You're all playing pickup basketball in Atlanta. Trash talk in character, claim impossible stats, and argue about who's the GOAT." },
  { icon: "🎲", title: "Wild Road Trip Debate",          prompt: "You're planning a road trip from Atlanta to Miami. Everyone wants something different. Plan the most chaotic trip imaginable." },
  { icon: "🍕", title: "Settle the Debate: Best Pizza",  prompt: "Argue about the best pizza in Atlanta. Everyone has a ridiculous opinion. It somehow becomes a life-or-death philosophical debate." },
  { icon: "🌩️", title: "Survive an Atlanta Storm",       prompt: "A massive storm knocked out power across Atlanta. Plan your survival strategy from each character's perspective. Chaos ensues." },
  { icon: "🏆", title: "Fantasy League Draft Day",       prompt: "It's fantasy football draft day. Everyone makes picks that make absolutely no sense for their character. Roast each other mercilessly." },
  { icon: "🎪", title: "Start a Street Circus",         prompt: "You're starting a pop-up street circus in Little Five Points Atlanta. Assign acts based on your characters' 'abilities'." },
];

// ── AI prompts ────────────────────────────────────────────────────────────────
function buildCreatorSystem(real) {
  return `You are the Fantasy Character Forge. Take a real person's personality and create a wildly over-the-top fantasy version of them.

Given the real person info, return ONLY valid JSON:
{
  "fantasyName": "Epic fantasy name (e.g. 'Pirate Aisha the Undefeated' or 'Jamal the Soccer Wizard Supreme')",
  "title": "Ridiculous official title",
  "catchphrase": "Their signature saying (funny, in character)",
  "origin": "1-sentence absurd backstory origin story",
  "superpower": "Their ridiculous special ability",
  "weakness": "Their silly fatal weakness",
  "quirks": ["quirk 1", "quirk 2", "quirk 3"],
  "humorStyle": "one of: Dry | Absurdist | Sarcastic | Wholesome | Unhinged | Dad Jokes | Philosopher | Chaos Agent",
  "openingLine": "Their first thing they'd say when they enter the chat room (in full character)"
}`;
}

function buildPersonaSystem(friend, userContext) {
  return `You are ${friend.fantasyName} — ${friend.title}.

Origin: ${friend.origin}
Superpower: ${friend.superpower}
Weakness: ${friend.weakness}
Quirks: ${friend.quirks?.join(", ")}
Humor style: ${friend.humorStyle}
Catchphrase: "${friend.catchphrase}"

You are chatting with ${userContext.userName || "your friend Chris"} in a private, silly group chat. You are a wildly over-the-top fantasy version of a real person, created with their consent for pure fun.

Rules:
- STAY IN CHARACTER completely — you ARE ${friend.fantasyName}
- Be ridiculous, funny, and lovably over-the-top
- Reference your superpower/weakness naturally in conversation
- Drop your catchphrase occasionally (not every message)
- React to things through your character's lens
- Keep responses conversational (2-5 sentences usually) — this is a chat, not a monologue
- Set in Atlanta, GA — reference local spots naturally when relevant
- Pure wholesome fun — no harmful content`;
}

function buildGroupSystem(friends, scenario) {
  const roster = friends.map(f => `- ${f.fantasyName} (${f.title}): ${f.superpower}. Humor: ${f.humorStyle}. Catchphrase: "${f.catchphrase}"`).join("\n");
  return `You are running a ridiculous group chat between these fantasy characters:\n${roster}

${scenario ? `Current scenario: "${scenario}"` : "Open group chat."}

Format each response as a chaotic group chat exchange. Each character responds in turn. Use this format:
**[Fantasy Name]:** Their message

Rules:
- Each character stays fully in their own voice and humor style
- Characters can talk to each other, argue, agree, make wild plans
- Reference Atlanta locations naturally
- Keep it silly, warm, and fun — like a group chat with cartoon best friends
- 2-4 messages per character per turn, max 3 characters responding per turn
- End with something that invites the user to respond or sets up the next beat`;
}

function parseJSON(raw) {
  try { const m = raw.match(/\{[\s\S]*\}/); return m ? JSON.parse(m[0]) : null; } catch { return null; }
}

// ── Avatar circle ─────────────────────────────────────────────────────────────
function Avatar({ friend, size = 40 }) {
  const archetype = ARCHETYPES.find(a => a.id === friend.archetype);
  const col = archetype?.color || C.blue;
  const icon = archetype?.label.split(" ")[0] || "👤";
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: `${col}20`, border: `2px solid ${col}50`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.45, flexShrink: 0 }}>
      {icon}
    </div>
  );
}

// ── Chat bubble ───────────────────────────────────────────────────────────────
function Bubble({ msg, crew }) {
  const isUser = msg.role === "user";
  const friend = crew.find(f => f.id === msg.friendId);
  const archetype = friend ? ARCHETYPES.find(a => a.id === friend.archetype) : null;
  const col = isUser ? C.blue : (archetype?.color || C.purple);

  if (msg.role === "system") return (
    <div style={{ textAlign: "center", fontSize: 10, color: "#4a5568", padding: "6px 0", fontStyle: "italic" }}>{msg.content}</div>
  );

  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "flex-start", flexDirection: isUser ? "row-reverse" : "row" }}>
      {!isUser && friend && <Avatar friend={friend} size={32} />}
      {isUser && <div style={{ width: 32, height: 32, borderRadius: "50%", background: `${C.blue}20`, border: `1.5px solid ${C.blue}50`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>👤</div>}
      <div style={{ maxWidth: "72%" }}>
        {!isUser && friend && <div style={{ fontSize: 10, color: col, fontWeight: 700, marginBottom: 2 }}>{friend.fantasyName}</div>}
        <div style={{ background: isUser ? `${C.blue}15` : `${col}10`, border: `1px solid ${isUser ? C.blue : col}25`, borderRadius: isUser ? "12px 12px 4px 12px" : "4px 12px 12px 12px", padding: "9px 13px", fontSize: 12, color: "#e2e8f0", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
          {msg.content}
        </div>
        <div style={{ fontSize: 9, color: "#4a5568", marginTop: 2, textAlign: isUser ? "right" : "left" }}>
          {new Date(msg.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>
    </div>
  );
}

// ── Chat input ────────────────────────────────────────────────────────────────
function ChatInput({ onSend, loading, placeholder, color }) {
  const [val, setVal] = useState("");
  function send() { if (!val.trim() || loading) return; onSend(val.trim()); setVal(""); }
  return (
    <div style={{ padding: "10px 14px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: 8 }}>
      <input value={val} onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
        placeholder={placeholder || "Say something..."}
        style={{ flex: 1, padding: "9px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "#0a0b12", fontSize: 12, color: "#f0ede8", outline: "none" }} />
      <button onClick={send} disabled={!val.trim() || loading}
        style={{ padding: "9px 18px", borderRadius: 10, background: color || C.blue, border: "none", color: "#0a0b12", fontSize: 12, fontWeight: 800, cursor: val.trim() && !loading ? "pointer" : "not-allowed", opacity: val.trim() && !loading ? 1 : 0.4 }}>
        Send
      </button>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function FantasyFriendSimulator({ onBack }) {
  const [activeTab, setActiveTab] = useState("crew");

  // Crew management
  const [crew, setCrew]       = useState(() => load(CREW_KEY, []));
  const [creating, setCreating] = useState(false);
  const [form, setForm]       = useState({ realName: "", relationship: "", personality: "", humorNotes: "", archetype: "pirate", consentAck: false });
  const [generating, setGenerating] = useState(false);
  const [preview, setPreview] = useState(null);

  // Solo chat
  const [soloFriend, setSoloFriend] = useState(null);
  const [soloMsgs,   setSoloMsgs]   = useState([]);
  const [soloHistory, setSoloHistory] = useState([]);
  const [soloLoading, setSoloLoading] = useState(false);

  // Group room
  const [groupParticipants, setGroupParticipants] = useState([]);
  const [groupMsgs,   setGroupMsgs]   = useState([]);
  const [groupHistory, setGroupHistory] = useState([]);
  const [groupLoading, setGroupLoading] = useState(false);
  const [groupStarted, setGroupStarted] = useState(false);
  const [activeScenario, setActiveScenario] = useState(null);

  const soloEndRef  = useRef(null);
  const groupEndRef = useRef(null);
  useEffect(() => { soloEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [soloMsgs, soloLoading]);
  useEffect(() => { groupEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [groupMsgs, groupLoading]);

  // ── Generate fantasy persona ─────────────────────────────────────────────
  const generatePersona = useCallback(async () => {
    if (!form.realName.trim() || !form.consentAck) return;
    setGenerating(true); setPreview(null);
    const prompt = [
      `Real name: ${form.realName}`,
      `Relationship: ${form.relationship || "friend"}`,
      `Personality: ${form.personality}`,
      `Humor notes: ${form.humorNotes}`,
      `Fantasy archetype: ${ARCHETYPES.find(a => a.id === form.archetype)?.label || form.archetype}`,
    ].filter(Boolean).join("\n");
    const raw = await invokeLLM({ systemPrompt: buildCreatorSystem(form), prompt });
    const parsed = parseJSON(raw);
    if (parsed) setPreview({ ...parsed, realName: form.realName, archetype: form.archetype, id: null });
    setGenerating(false);
  }, [form]);

  function addToCrew() {
    if (!preview) return;
    const member = { ...preview, id: Date.now(), addedAt: new Date().toISOString() };
    const next = [...crew, member];
    setCrew(next); save(CREW_KEY, next);
    setPreview(null); setCreating(false);
    setForm({ realName: "", relationship: "", personality: "", humorNotes: "", archetype: "pirate", consentAck: false });
  }

  function removeMember(id) {
    const next = crew.filter(m => m.id !== id);
    setCrew(next); save(CREW_KEY, next);
    if (soloFriend?.id === id) setSoloFriend(null);
  }

  // ── Solo chat ────────────────────────────────────────────────────────────
  function startSoloChat(friend) {
    setSoloFriend(friend);
    setSoloMsgs([{ role: "system", content: `${friend.fantasyName} has entered the chat.`, ts: Date.now() }, { role: "friend", friendId: friend.id, content: friend.openingLine || `Greetings! I am ${friend.fantasyName}!`, ts: Date.now() }]);
    setSoloHistory([]);
    setActiveTab("chat");
  }

  async function sendSolo(text) {
    if (!soloFriend || soloLoading) return;
    const userMsg = { role: "user", content: text, ts: Date.now() };
    const newHistory = [...soloHistory, { role: "user", content: text }];
    setSoloMsgs(m => [...m, userMsg]);
    setSoloHistory(newHistory);
    setSoloLoading(true);

    const raw = await invokeLLM({ systemPrompt: buildPersonaSystem(soloFriend, { userName: "Chris" }), prompt: text, conversationHistory: newHistory.slice(-12) }).catch(e => e.message);
    const reply = { role: "friend", friendId: soloFriend.id, content: raw, ts: Date.now() };
    setSoloMsgs(m => [...m, reply]);
    setSoloHistory(h => [...h, { role: "assistant", content: raw }]);
    setSoloLoading(false);
  }

  // ── Group chat ───────────────────────────────────────────────────────────
  function startGroup() {
    if (groupParticipants.length < 2) return;
    setGroupStarted(true);
    const openings = groupParticipants.map(f => `${f.fantasyName}: "${f.openingLine || "Let's gooo!"}"`).join("\n");
    setGroupMsgs([
      { role: "system", content: `Group chat started with ${groupParticipants.map(f => f.fantasyName).join(", ")}`, ts: Date.now() },
      { role: "group", friendId: "group", content: openings, ts: Date.now() },
    ]);
    setGroupHistory([]);
  }

  async function sendGroup(text) {
    if (!groupStarted || groupLoading) return;
    const userMsg = { role: "user", content: text, ts: Date.now() };
    const newHistory = [...groupHistory, { role: "user", content: text }];
    setGroupMsgs(m => [...m, userMsg]);
    setGroupHistory(newHistory);
    setGroupLoading(true);

    const system = buildGroupSystem(groupParticipants, activeScenario?.title);
    const raw = await invokeLLM({ systemPrompt: system, prompt: text, conversationHistory: newHistory.slice(-10) }).catch(e => e.message);
    const reply = { role: "group", friendId: "group", content: raw, ts: Date.now() };
    setGroupMsgs(m => [...m, reply]);
    setGroupHistory(h => [...h, { role: "assistant", content: raw }]);
    setGroupLoading(false);
  }

  // ── Shared styles ─────────────────────────────────────────────────────────
  const card = { background: "#11131f", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12 };
  const inp  = { padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "#0a0b12", fontSize: 12, color: "#f0ede8", outline: "none", boxSizing: "border-box", width: "100%" };
  const btnS = (col) => ({ padding: "6px 14px", borderRadius: 8, background: `${col}15`, border: `1px solid ${col}40`, color: col, fontSize: 11, fontWeight: 600, cursor: "pointer" });

  const TABS = [
    { id: "crew",     label: "🎪 The Crew" },
    { id: "chat",     label: "💬 Solo Chat" },
    { id: "group",    label: "🎭 Group Room" },
    { id: "scenarios", label: "🎲 Scenarios" },
  ];

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* Header */}
      <div style={{ background: `linear-gradient(135deg, ${C.blue}15, ${C.purple}10)`, borderBottom: `1px solid ${C.blue}25`, padding: "14px 20px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={onBack} style={{ background: "none", border: "none", color: "#6aaedd", fontSize: 11, cursor: "pointer", padding: 0 }}>← Back</button>
          <span style={{ color: "#2a3a4a" }}>|</span>
          <span style={{ fontSize: 20 }}>👻</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: C.blue }}>Fantasy Friend Simulator</div>
            <div style={{ fontSize: 11, color: "#6aaedd" }}>Hang out with ridiculous, over-the-top fantasy versions of your people</div>
          </div>
          {crew.length > 0 && (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: C.blue }}>{crew.length}</div>
              <div style={{ fontSize: 9, color: "#4a5568" }}>Crew Members</div>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 2, padding: "6px 14px", background: "#0f1120", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            style={{ padding: "6px 13px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", background: activeTab === t.id ? `${C.blue}20` : "transparent", color: activeTab === t.id ? C.blue : "#6aaedd", borderBottom: activeTab === t.id ? `2px solid ${C.blue}` : "2px solid transparent" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── CREW TAB ── */}
      {activeTab === "crew" && (
        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#f0ede8" }}>Your Fantasy Crew</div>
              <div style={{ fontSize: 11, color: "#6aaedd" }}>Consent-based, wildly over-the-top fantasy versions of your people</div>
            </div>
            {!creating && <button onClick={() => setCreating(true)} style={{ padding: "8px 18px", borderRadius: 10, background: `${C.blue}`, border: "none", color: "#0a0b12", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>+ Add Member</button>}
          </div>

          {/* Creator form */}
          {creating && (
            <div style={{ ...card, padding: 20, marginBottom: 20, border: `1px solid ${C.blue}30` }}>
              <div style={{ fontSize: 11, color: C.blue, fontWeight: 700, marginBottom: 14 }}>CREATE FANTASY PERSONA</div>

              {/* Consent banner */}
              <div style={{ background: `${C.gold}08`, border: `1px solid ${C.gold}25`, borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 11, color: C.gold }}>
                ⚖️ Only add people who have explicitly consented or would clearly enjoy this. These are private, silly, cartoon versions — never for serious purposes.
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                {[
                  { key: "realName",     label: "Real Name",              ph: "e.g. Marcus" },
                  { key: "relationship", label: "How you know them",       ph: "e.g. College buddy, business partner" },
                ].map(f => (
                  <div key={f.key}>
                    <label style={{ fontSize: 10, color: "#6aaedd", display: "block", marginBottom: 3 }}>{f.label}</label>
                    <input value={form[f.key]} onChange={e => setForm(v => ({ ...v, [f.key]: e.target.value }))} placeholder={f.ph} style={inp} />
                  </div>
                ))}
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 10, color: "#6aaedd", display: "block", marginBottom: 3 }}>Their Personality (give the AI something to work with)</label>
                <input value={form.personality} onChange={e => setForm(v => ({ ...v, personality: e.target.value }))}
                  placeholder="e.g. super competitive, obsessed with soccer, always the loudest in the room, big heart" style={inp} />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 10, color: "#6aaedd", display: "block", marginBottom: 3 }}>Humor style or inside jokes (optional)</label>
                <input value={form.humorNotes} onChange={e => setForm(v => ({ ...v, humorNotes: e.target.value }))}
                  placeholder="e.g. loves terrible puns, always talks trash at sports, obsessed with BBQ" style={inp} />
              </div>

              {/* Archetype picker */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 10, color: "#6aaedd", display: "block", marginBottom: 8 }}>Fantasy Archetype</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {ARCHETYPES.map(a => {
                    const sel = form.archetype === a.id;
                    return (
                      <button key={a.id} onClick={() => setForm(v => ({ ...v, archetype: a.id }))}
                        style={{ padding: "5px 12px", borderRadius: 20, border: `1px solid ${sel ? a.color : "rgba(255,255,255,0.1)"}`, background: sel ? `${a.color}20` : "transparent", color: sel ? a.color : "#8892a4", fontSize: 11, cursor: "pointer", fontWeight: sel ? 700 : 400 }}>
                        {a.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Consent checkbox */}
              <label style={{ display: "flex", gap: 8, marginBottom: 14, cursor: "pointer", alignItems: "flex-start" }}>
                <input type="checkbox" checked={form.consentAck} onChange={e => setForm(v => ({ ...v, consentAck: e.target.checked }))} style={{ marginTop: 2, accentColor: C.blue }} />
                <span style={{ fontSize: 11, color: "#8892a4", lineHeight: 1.5 }}>
                  {form.realName || "This person"} has consented or would clearly enjoy being in this silly, private simulation. Sessions are ephemeral and never shared without my action.
                </span>
              </label>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button onClick={generatePersona} disabled={generating || !form.realName.trim() || !form.consentAck}
                  style={{ padding: "9px 20px", borderRadius: 10, background: C.blue, border: "none", color: "#0a0b12", fontSize: 12, fontWeight: 800, cursor: form.realName.trim() && form.consentAck && !generating ? "pointer" : "not-allowed", opacity: form.realName.trim() && form.consentAck ? 1 : 0.4 }}>
                  {generating ? "🎪 Generating..." : "🎪 Generate Fantasy Persona"}
                </button>
                <button onClick={() => { setCreating(false); setPreview(null); }} style={btnS(C.red)}>Cancel</button>
              </div>

              {/* Preview */}
              {preview && (
                <div style={{ marginTop: 16, background: `${C.blue}08`, border: `1px solid ${C.blue}30`, borderRadius: 12, padding: 16 }}>
                  <div style={{ fontSize: 10, color: C.blue, fontWeight: 700, marginBottom: 10 }}>FANTASY PERSONA PREVIEW</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#f0ede8", marginBottom: 2 }}>{preview.fantasyName}</div>
                  <div style={{ fontSize: 11, color: C.gold, marginBottom: 10 }}>{preview.title}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                    {[
                      ["Origin",      preview.origin],
                      ["Superpower",  preview.superpower],
                      ["Weakness",    preview.weakness],
                      ["Humor Style", preview.humorStyle],
                    ].map(([label, val]) => (
                      <div key={label} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "8px 10px" }}>
                        <div style={{ fontSize: 9, color: "#4a5568", fontWeight: 700, marginBottom: 2 }}>{label.toUpperCase()}</div>
                        <div style={{ fontSize: 11, color: "#c8c8d0" }}>{val}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: 11, color: C.blue, marginBottom: 6 }}>
                    Catchphrase: <span style={{ fontStyle: "italic" }}>"{preview.catchphrase}"</span>
                  </div>
                  {preview.quirks?.length > 0 && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                      {preview.quirks.map(q => <span key={q} style={{ fontSize: 10, padding: "2px 9px", borderRadius: 10, background: `${C.blue}15`, color: C.blue }}>{q}</span>)}
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: "#c8c8d0", fontStyle: "italic", marginBottom: 12 }}>
                    Opening line: "{preview.openingLine}"
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={addToCrew} style={{ padding: "8px 20px", borderRadius: 10, background: C.teal, border: "none", color: "#0a0b12", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
                      Add to Crew ✓
                    </button>
                    <button onClick={generatePersona} style={btnS(C.blue)}>Regenerate</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Crew grid */}
          {crew.length === 0 && !creating ? (
            <div style={{ textAlign: "center", padding: 60, color: "#4a5568" }}>
              <div style={{ fontSize: 52, marginBottom: 12 }}>🎪</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#f0ede8", marginBottom: 8 }}>Your crew is empty</div>
              <div style={{ fontSize: 12, lineHeight: 1.6, maxWidth: 340, margin: "0 auto 20px" }}>
                Add fantasy versions of your friends to start the most ridiculous group chat in Atlanta.
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
              {crew.map(member => {
                const archetype = ARCHETYPES.find(a => a.id === member.archetype);
                const col = archetype?.color || C.blue;
                return (
                  <div key={member.id} style={{ background: `${col}06`, border: `1px solid ${col}25`, borderRadius: 14, padding: 16 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
                      <Avatar friend={member} size={42} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: "#f0ede8" }}>{member.fantasyName}</div>
                        <div style={{ fontSize: 10, color: col }}>{member.title}</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: "#8892a4", marginBottom: 6 }}>
                      ⚡ {member.superpower}
                    </div>
                    <div style={{ fontSize: 11, color: col, fontStyle: "italic", marginBottom: 10 }}>
                      "{member.catchphrase}"
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => startSoloChat(member)} style={{ flex: 1, padding: "7px", borderRadius: 8, background: `${col}20`, border: `1px solid ${col}40`, color: col, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                        💬 Chat
                      </button>
                      <button onClick={() => removeMember(member.id)} style={{ ...btnS(C.red), padding: "7px 10px" }}>×</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── SOLO CHAT TAB ── */}
      {activeTab === "chat" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {!soloFriend ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              {/* Friend picker */}
              <div style={{ padding: 20, overflowY: "auto", flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#f0ede8", marginBottom: 4 }}>Pick Who to Chat With</div>
                <div style={{ fontSize: 11, color: "#6aaedd", marginBottom: 16 }}>One-on-one with your fantasy friend</div>
                {crew.length === 0 ? (
                  <div style={{ textAlign: "center", padding: 40, color: "#4a5568" }}>
                    <div style={{ fontSize: 36, marginBottom: 8 }}>💬</div>
                    <div>Add crew members first.</div>
                    <button onClick={() => setActiveTab("crew")} style={{ ...btnS(C.blue), marginTop: 12 }}>Go to Crew</button>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {crew.map(m => (
                      <button key={m.id} onClick={() => startSoloChat(m)}
                        style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", background: "transparent", cursor: "pointer", textAlign: "left" }}>
                        <Avatar friend={m} size={36} />
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#f0ede8" }}>{m.fantasyName}</div>
                          <div style={{ fontSize: 10, color: "#6aaedd" }}>{m.humorStyle} humor · {ARCHETYPES.find(a => a.id === m.archetype)?.label}</div>
                        </div>
                        <div style={{ marginLeft: "auto", fontSize: 11, color: "#4a5568" }}>Chat →</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              {/* Chat header */}
              <div style={{ padding: "8px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)", background: "#0d0e17", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                <Avatar friend={soloFriend} size={32} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#f0ede8" }}>{soloFriend.fantasyName}</div>
                  <div style={{ fontSize: 10, color: "#6aaedd" }}>{soloFriend.title}</div>
                </div>
                <button onClick={() => setSoloFriend(null)} style={btnS(C.red)}>← Back</button>
              </div>
              {/* Messages */}
              <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
                {soloMsgs.map((m, i) => <Bubble key={i} msg={m} crew={crew} />)}
                {soloLoading && (
                  <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "6px 0" }}>
                    <Avatar friend={soloFriend} size={28} />
                    <div style={{ display: "flex", gap: 4 }}>
                      {[0,1,2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: C.blue, animation: `ffPulse 1.2s ${i * 0.2}s ease-in-out infinite` }} />)}
                    </div>
                  </div>
                )}
                <div ref={soloEndRef} />
              </div>
              <ChatInput onSend={sendSolo} loading={soloLoading} placeholder={`Talk to ${soloFriend.fantasyName}...`} color={ARCHETYPES.find(a => a.id === soloFriend.archetype)?.color || C.blue} />
            </div>
          )}
        </div>
      )}

      {/* ── GROUP ROOM TAB ── */}
      {activeTab === "group" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {!groupStarted ? (
            <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
              <div style={{ maxWidth: 560 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#f0ede8", marginBottom: 4 }}>Group Room Setup</div>
                <div style={{ fontSize: 11, color: "#6aaedd", marginBottom: 16 }}>Pick 2+ crew members. Watch them interact, or jump in.</div>

                {crew.length < 2 ? (
                  <div style={{ textAlign: "center", padding: 40, color: "#4a5568" }}>
                    <div>You need at least 2 crew members. Add more in the Crew tab.</div>
                    <button onClick={() => setActiveTab("crew")} style={{ ...btnS(C.blue), marginTop: 12 }}>Go to Crew</button>
                  </div>
                ) : (
                  <>
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 10, color: "#4a5568", fontWeight: 700, marginBottom: 8 }}>SELECT PARTICIPANTS (min 2)</div>
                      {crew.map(m => {
                        const sel = groupParticipants.some(p => p.id === m.id);
                        const archetype = ARCHETYPES.find(a => a.id === m.archetype);
                        return (
                          <div key={m.id} onClick={() => setGroupParticipants(prev => sel ? prev.filter(p => p.id !== m.id) : [...prev, m])}
                            style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 12, border: `1px solid ${sel ? (archetype?.color || C.blue) : "rgba(255,255,255,0.08)"}`, background: sel ? `${archetype?.color || C.blue}12` : "transparent", cursor: "pointer", marginBottom: 8 }}>
                            <Avatar friend={m} size={30} />
                            <span style={{ fontSize: 12, fontWeight: sel ? 700 : 400, color: sel ? (archetype?.color || C.blue) : "#8892a4" }}>{m.fantasyName}</span>
                            {sel && <span style={{ marginLeft: "auto", color: archetype?.color || C.blue, fontSize: 14 }}>✓</span>}
                          </div>
                        );
                      })}
                    </div>

                    {/* Optional scenario */}
                    {activeScenario && (
                      <div style={{ padding: "10px 14px", borderRadius: 10, background: `${C.gold}08`, border: `1px solid ${C.gold}25`, marginBottom: 14, display: "flex", gap: 10, alignItems: "center" }}>
                        <span style={{ fontSize: 18 }}>{activeScenario.icon}</span>
                        <span style={{ flex: 1, fontSize: 12, color: C.gold, fontWeight: 600 }}>{activeScenario.title}</span>
                        <button onClick={() => setActiveScenario(null)} style={{ background: "none", border: "none", color: "#4a5568", cursor: "pointer" }}>×</button>
                      </div>
                    )}

                    <button onClick={startGroup} disabled={groupParticipants.length < 2}
                      style={{ width: "100%", padding: 12, borderRadius: 12, background: `linear-gradient(135deg, ${C.blue}, ${C.purple})`, border: "none", color: "#fff", fontSize: 13, fontWeight: 800, cursor: groupParticipants.length >= 2 ? "pointer" : "not-allowed", opacity: groupParticipants.length >= 2 ? 1 : 0.4 }}>
                      🎭 Start Group Chat
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              {/* Group header */}
              <div style={{ padding: "8px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)", background: "#0d0e17", display: "flex", alignItems: "center", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
                <div style={{ display: "flex", gap: -6 }}>
                  {groupParticipants.slice(0, 4).map(m => <div key={m.id} style={{ marginLeft: -6 }}><Avatar friend={m} size={26} /></div>)}
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#f0ede8", flex: 1 }}>
                  {groupParticipants.map(m => m.realName).join(", ")}
                </span>
                <button onClick={() => { setGroupStarted(false); setGroupMsgs([]); setGroupHistory([]); }} style={btnS(C.red)}>End Session</button>
              </div>
              {/* Messages */}
              <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
                {groupMsgs.map((m, i) => {
                  if (m.role === "system") return <div key={i} style={{ textAlign: "center", fontSize: 10, color: "#4a5568", padding: "4px 0", fontStyle: "italic" }}>{m.content}</div>;
                  if (m.role === "user") return <Bubble key={i} msg={m} crew={crew} />;
                  // Group message — parse the **[Name]:** format
                  return (
                    <div key={i} style={{ ...{card}, background: "rgba(255,255,255,0.02)", borderRadius: 12, padding: "12px 14px", marginBottom: 12, fontSize: 12, color: "#c8c8d0", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>
                      {m.content}
                    </div>
                  );
                })}
                {groupLoading && (
                  <div style={{ display: "flex", gap: 4, padding: "8px 0", alignItems: "center" }}>
                    {[0,1,2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: C.purple, animation: `ffPulse 1.2s ${i * 0.2}s ease-in-out infinite` }} />)}
                    <span style={{ fontSize: 10, color: "#4a5568", marginLeft: 6 }}>Characters responding...</span>
                  </div>
                )}
                <div ref={groupEndRef} />
              </div>
              <ChatInput onSend={sendGroup} loading={groupLoading} placeholder="Jump into the chaos..." color={C.purple} />
            </div>
          )}
        </div>
      )}

      {/* ── SCENARIOS TAB ── */}
      {activeTab === "scenarios" && (
        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#f0ede8", marginBottom: 4 }}>Atlanta Scenario Starters</div>
          <div style={{ fontSize: 11, color: "#6aaedd", marginBottom: 20 }}>Pick a scenario, then go to Group Room to run it with your crew</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
            {SCENARIOS.map(s => {
              const sel = activeScenario?.title === s.title;
              return (
                <div key={s.title} onClick={() => setActiveScenario(sel ? null : s)}
                  style={{ background: sel ? `${C.gold}12` : "#11131f", border: `1px solid ${sel ? C.gold : "rgba(255,255,255,0.07)"}`, borderRadius: 12, padding: 16, cursor: "pointer", transition: "all 0.15s" }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>{s.icon}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: sel ? C.gold : "#f0ede8", marginBottom: 6 }}>{s.title}</div>
                  <div style={{ fontSize: 11, color: "#8892a4", lineHeight: 1.5 }}>{s.prompt.slice(0, 80)}...</div>
                  {sel && (
                    <div style={{ marginTop: 10, fontSize: 11, color: C.gold, fontWeight: 700 }}>
                      ✓ Selected · Go to Group Room →
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {activeScenario && (
            <div style={{ position: "sticky", bottom: 0, padding: "12px 0 0", background: "transparent" }}>
              <button onClick={() => setActiveTab("group")}
                style={{ width: "100%", padding: 12, borderRadius: 12, background: `linear-gradient(135deg, ${C.gold}, ${C.orange})`, border: "none", color: "#0a0b12", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>
                🎲 Launch "{activeScenario.title}" in Group Room
              </button>
            </div>
          )}
        </div>
      )}

      <style>{`@keyframes ffPulse { 0%,100%{opacity:.2;transform:scale(.8)} 50%{opacity:1;transform:scale(1)} }`}</style>
    </div>
  );
}
