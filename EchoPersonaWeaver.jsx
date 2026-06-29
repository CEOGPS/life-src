import { useState, useCallback, useRef, useEffect } from "react";
import { invokeLLM } from "@/api/ceogpsclient";

const C = { orange: "#ff8c42", purple: "#8b7fff", blue: "#4ab3f4", teal: "#00c896", pink: "#ff6b9d", red: "#ff4f5e", gold: "#ffd700" };

const ECHO_KEY     = "lifeos1_echo_persona";
const CONTACTS_KEY = "lifeos1_echo_contacts";

function load(key, def) { try { return JSON.parse(localStorage.getItem(key) || "null") ?? def; } catch { return def; } }
function save(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

// ── AI system prompts ─────────────────────────────────────────────────────────
function buildFutureSelfSystem(echo, monthsAhead) {
  return `You are the ${monthsAhead}-month future echo of ${echo.name || "Chris"}. You have lived through the intervening months and speak from that experienced vantage point.

Your voice and character:
- Core values: ${echo.values || "family, growth, creativity, financial freedom"}
- Communication style: ${echo.style || "direct, warm, strategic, occasionally witty"}
- Current energy pattern: ${echo.energyPattern || "sharp mornings, creative afternoons"}
- Life context: ${echo.lifeContext || "marketing business owner in Atlanta, family-oriented"}
- Goals you were working toward: ${echo.goals || "scale business, more family time, creative outlets"}

At ${monthsAhead} months ahead, you have gained hard-won perspective. You speak with calm authority about what actually mattered vs. what felt urgent. You're honest — sometimes uncomfortably so. You remember the fears and can now contextualize them.

Rules:
- Stay fully in character as the future self — never break the fourth wall
- Reference the user's actual context naturally
- Give specific, grounded insight — not generic inspiration
- Occasionally mention what surprised you, what you wish you'd known, or what turned out not to matter
- Keep responses conversational (2-4 paragraphs max unless asked for more)
- Relationship Capital accuracy weight: ${echo.relationshipCapital || 10}/10 (this is your own echo — full accuracy)`;
}

function buildContactSystem(contact) {
  const accuracy = contact.relationshipCapital || 5;
  const accuracyNote = accuracy >= 8
    ? "High relationship capital — respond with nuanced, specific character depth."
    : accuracy >= 5
    ? "Moderate relationship capital — capture the general personality and values, acknowledge edges you're less certain about."
    : "Lower relationship capital — focus on what's known, be appropriately tentative on specifics.";

  return `You are an echo persona of ${contact.name}, speaking in a collaborative brainstorming or dialogue context. This is a private, consent-acknowledged simulation.

Their character (as described by ${contact.addedBy || "Chris"}):
- Relationship to user: ${contact.relationship || "friend/colleague"}
- Personality: ${contact.personality || "thoughtful, direct"}
- Communication style: ${contact.style || "measured, practical"}
- Core values: ${contact.values || "family, integrity, progress"}
- How they typically respond to big ideas: ${contact.responseStyle || "asks clarifying questions, plays devil's advocate"}
- Areas of expertise: ${contact.expertise || "general life experience"}

Accuracy note: ${accuracyNote}

Rules:
- Speak AS this person in first person — warm, authentic, true to their described character
- Add their perspective genuinely — don't just agree with everything
- Reference your relationship to the user naturally
- Keep responses concise (1-3 paragraphs)
- Relationship Capital: ${accuracy}/10 — ${accuracyNote}`;
}

function buildGroupSystem(echo, participants, topic) {
  const names = participants.map(p => p.name).join(", ");
  return `You are the EchoPersona Weaver orchestrating a group brainstorm between: ${echo.name || "Chris"} (future self, ${echo.futureSelfMonths || 12} months ahead)${participants.length > 0 ? ", " + names : ""}.

Topic: "${topic}"

For each response, simulate ALL voices in sequence. Format each voice as:
**[Name]:** Their response...

Orchestration rules:
- Each voice should add genuinely distinct perspective — not just agree
- Future self speaks with hindsight and hard-won calm
- Contact echoes reflect their described personalities
- Create natural dialogue — one voice can challenge or build on another
- End with a synthesis line: **Synthesis:** key takeaway from the group
- Keep each voice to 2-4 sentences — keep the session moving
- Relationship Capital weights the confidence/depth of each echo's contribution`;
}

// ── Message bubble ────────────────────────────────────────────────────────────
function Bubble({ msg, echoName }) {
  const isUser   = msg.role === "user";
  const isSystem = msg.role === "system";
  const col      = isUser ? C.blue : msg.speakerColor || C.orange;

  if (isSystem) return (
    <div style={{ textAlign: "center", fontSize: 10, color: "#4a5568", padding: "4px 0" }}>{msg.content}</div>
  );

  return (
    <div style={{ display: "flex", flexDirection: isUser ? "row-reverse" : "row", gap: 8, marginBottom: 12, alignItems: "flex-start" }}>
      <div style={{ width: 30, height: 30, borderRadius: "50%", background: `${col}25`, border: `1.5px solid ${col}60`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0 }}>
        {isUser ? "👤" : msg.speakerEmoji || "🔮"}
      </div>
      <div style={{ maxWidth: "72%", minWidth: 60 }}>
        {!isUser && <div style={{ fontSize: 10, color: col, fontWeight: 700, marginBottom: 3 }}>{msg.speaker || echoName || "Echo"}</div>}
        <div style={{ background: isUser ? `${C.blue}15` : `${col}10`, border: `1px solid ${isUser ? C.blue : col}25`, borderRadius: isUser ? "12px 12px 4px 12px" : "4px 12px 12px 12px", padding: "10px 13px", fontSize: 12, color: "#e2e8f0", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
          {msg.content}
        </div>
        <div style={{ fontSize: 9, color: "#4a5568", marginTop: 3, textAlign: isUser ? "right" : "left" }}>
          {new Date(msg.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>
    </div>
  );
}

// ── Chat thread ───────────────────────────────────────────────────────────────
function ChatThread({ messages, loading, echoName, onSend, placeholder, accentColor }) {
  const [input, setInput] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  function send() {
    const txt = input.trim();
    if (!txt || loading) return;
    onSend(txt);
    setInput("");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
        {messages.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 20px", color: "#4a5568" }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>🔮</div>
            <div style={{ fontSize: 12, lineHeight: 1.6 }}>Start the conversation. Ask anything.</div>
          </div>
        )}
        {messages.map((m, i) => <Bubble key={i} msg={m} echoName={echoName} />)}
        {loading && (
          <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "8px 0" }}>
            <div style={{ width: 30, height: 30, borderRadius: "50%", background: `${accentColor || C.orange}20`, border: `1.5px solid ${accentColor || C.orange}50`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>🔮</div>
            <div style={{ display: "flex", gap: 4 }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: accentColor || C.orange, animation: `echoPulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div style={{ padding: "10px 14px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: 8 }}>
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder={placeholder || "Type a message..."}
          style={{ flex: 1, padding: "9px 14px", borderRadius: 10, border: `1px solid rgba(255,255,255,0.1)`, background: "#0a0b12", fontSize: 12, color: "#f0ede8", outline: "none" }} />
        <button onClick={send} disabled={!input.trim() || loading}
          style={{ padding: "9px 18px", borderRadius: 10, background: `${accentColor || C.orange}`, border: "none", color: "#0a0b12", fontSize: 12, fontWeight: 800, cursor: input.trim() && !loading ? "pointer" : "not-allowed", opacity: input.trim() && !loading ? 1 : 0.4 }}>
          Send
        </button>
      </div>
      <style>{`@keyframes echoPulse { 0%,100%{opacity:.2;transform:scale(.8)} 50%{opacity:1;transform:scale(1)} }`}</style>
    </div>
  );
}

// ── Relationship Capital badge ────────────────────────────────────────────────
function RCBadge({ score }) {
  const col = score >= 8 ? C.teal : score >= 5 ? C.orange : C.red;
  return (
    <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, background: `${col}15`, border: `1px solid ${col}30`, color: col, fontWeight: 700 }}>
      RC {score}/10
    </span>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function EchoPersonaWeaver({ onBack }) {
  const [activeTab, setActiveTab] = useState("myecho");

  // My Echo config
  const [echo, setEcho] = useState(() => load(ECHO_KEY, {
    name: "Chris", values: "", style: "", energyPattern: "", lifeContext: "", goals: "", futureSelfMonths: 12, relationshipCapital: 10
  }));
  const [echoConfigured, setEchoConfigured] = useState(() => !!load(ECHO_KEY, null)?.values);
  const [showEchoSetup, setShowEchoSetup] = useState(false);

  // Future self chat
  const [futureMessages, setFutureMessages] = useState([]);
  const [futureLoading, setFutureLoading]   = useState(false);
  const [futureHistory, setFutureHistory]   = useState([]);

  // Contacts
  const [contacts, setContacts] = useState(() => load(CONTACTS_KEY, []));
  const [showContactForm, setShowContactForm] = useState(false);
  const [contactForm, setContactForm] = useState({ name: "", relationship: "", personality: "", style: "", values: "", responseStyle: "", expertise: "", relationshipCapital: 7, consentAcknowledged: false, addedBy: "Chris" });
  const [activeContact, setActiveContact] = useState(null);
  const [contactMessages, setContactMessages] = useState({});
  const [contactLoading, setContactLoading]   = useState(false);

  // Group session
  const [groupTopic,    setGroupTopic]    = useState("");
  const [groupParticipants, setGroupParticipants] = useState([]);
  const [groupMessages, setGroupMessages] = useState([]);
  const [groupLoading,  setGroupLoading]  = useState(false);
  const [groupStarted,  setGroupStarted]  = useState(false);

  // ── Echo config save ─────────────────────────────────────────────────────
  function saveEcho() { save(ECHO_KEY, echo); setEchoConfigured(true); setShowEchoSetup(false); }

  // ── Future self chat ─────────────────────────────────────────────────────
  async function sendFuture(text) {
    const userMsg = { role: "user", content: text, ts: Date.now() };
    const newHistory = [...futureHistory, { role: "user", content: text }];
    setFutureMessages(m => [...m, userMsg]);
    setFutureHistory(newHistory);
    setFutureLoading(true);

    const systemPrompt = buildFutureSelfSystem(echo, echo.futureSelfMonths);
    const raw = await invokeLLM({ systemPrompt, prompt: text, conversationHistory: newHistory.slice(-10) }).catch(e => e.message);

    const echoMsg = { role: "echo", speaker: `Future ${echo.name || "Chris"} (${echo.futureSelfMonths}mo)`, speakerEmoji: "🔮", speakerColor: C.orange, content: raw, ts: Date.now() };
    setFutureMessages(m => [...m, echoMsg]);
    setFutureHistory(h => [...h, { role: "assistant", content: raw }]);
    setFutureLoading(false);
  }

  // ── Contact chat ──────────────────────────────────────────────────────────
  async function sendContact(text, contact) {
    const key = contact.id;
    const userMsg = { role: "user", content: text, ts: Date.now() };
    const prevMsgs = contactMessages[key] || [];
    const history  = prevMsgs.filter(m => m.role !== "system").map(m => ({ role: m.role === "user" ? "user" : "assistant", content: m.content }));
    const newHistory = [...history, { role: "user", content: text }];

    setContactMessages(m => ({ ...m, [key]: [...prevMsgs, userMsg] }));
    setContactLoading(true);

    const systemPrompt = buildContactSystem(contact);
    const raw = await invokeLLM({ systemPrompt, prompt: text, conversationHistory: newHistory.slice(-10) }).catch(e => e.message);

    const echoMsg = { role: "echo", speaker: `${contact.name} (Echo)`, speakerEmoji: "👤", speakerColor: C.purple, content: raw, ts: Date.now() };
    setContactMessages(m => ({ ...m, [key]: [...(m[key] || []), echoMsg] }));
    setContactLoading(false);
  }

  // ── Add contact ───────────────────────────────────────────────────────────
  function addContact() {
    if (!contactForm.name.trim() || !contactForm.consentAcknowledged) return;
    const c = { ...contactForm, id: Date.now() };
    const next = [...contacts, c];
    setContacts(next); save(CONTACTS_KEY, next);
    setContactForm({ name: "", relationship: "", personality: "", style: "", values: "", responseStyle: "", expertise: "", relationshipCapital: 7, consentAcknowledged: false, addedBy: "Chris" });
    setShowContactForm(false);
    setActiveContact(c);
    setActiveTab("contacts");
  }

  // ── Group session ─────────────────────────────────────────────────────────
  async function sendGroup(text) {
    const userMsg = { role: "user", content: text, ts: Date.now() };
    const history  = groupMessages.filter(m => m.role !== "system").map(m => ({ role: m.role === "user" ? "user" : "assistant", content: m.content }));
    const newHistory = [...history, { role: "user", content: text }];

    setGroupMessages(m => [...m, userMsg]);
    setGroupLoading(true);

    const systemPrompt = buildGroupSystem(echo, groupParticipants, groupTopic);
    const raw = await invokeLLM({ systemPrompt, prompt: text, conversationHistory: newHistory.slice(-8) }).catch(e => e.message);

    const echoMsg = { role: "echo", speaker: "Group", speakerEmoji: "🎭", speakerColor: C.purple, content: raw, ts: Date.now() };
    setGroupMessages(m => [...m, echoMsg]);
    setGroupLoading(false);
  }

  // ── Copy to clipboard ────────────────────────────────────────────────────
  // Styles
  const card = { background: "#11131f", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12 };
  const inp  = { padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "#0a0b12", fontSize: 12, color: "#f0ede8", outline: "none", boxSizing: "border-box", width: "100%" };
  const btnS = (col) => ({ padding: "6px 14px", borderRadius: 8, background: `${col}15`, border: `1px solid ${col}40`, color: col, fontSize: 11, fontWeight: 600, cursor: "pointer" });

  const TABS = [
    { id: "myecho",   label: "🔮 My Echo"       },
    { id: "contacts", label: "👥 Contact Echoes" },
    { id: "group",    label: "🎭 Group Session"  },
  ];

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* Header */}
      <div style={{ background: `linear-gradient(135deg, ${C.orange}15, ${C.purple}10)`, borderBottom: `1px solid ${C.orange}25`, padding: "14px 20px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={onBack} style={{ background: "none", border: "none", color: "#6aaedd", fontSize: 11, cursor: "pointer", padding: 0 }}>← Back</button>
          <span style={{ color: "#2a3a4a" }}>|</span>
          <span style={{ fontSize: 20 }}>🎭</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: C.orange }}>EchoPersona Weaver</div>
            <div style={{ fontSize: 11, color: "#6aaedd" }}>Talk to your future self · Collaborate with echo versions of your people</div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            {contacts.length > 0 && <div style={{ textAlign: "center" }}><div style={{ fontSize: 15, fontWeight: 800, color: C.purple }}>{contacts.length}</div><div style={{ fontSize: 9, color: "#4a5568" }}>Echoes</div></div>}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 2, padding: "6px 14px", background: "#0f1120", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0, overflowX: "auto" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            style={{ padding: "6px 13px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", background: activeTab === t.id ? `${C.orange}20` : "transparent", color: activeTab === t.id ? C.orange : "#6aaedd", borderBottom: activeTab === t.id ? `2px solid ${C.orange}` : "2px solid transparent" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── MY ECHO TAB ── */}
      {activeTab === "myecho" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Echo config bar */}
          <div style={{ padding: "8px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)", background: "#0d0e17", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            {echoConfigured ? (
              <>
                <span style={{ fontSize: 22 }}>🔮</span>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.orange }}>{echo.name}'s Echo</span>
                  <span style={{ fontSize: 10, color: "#6aaedd", marginLeft: 8 }}>{echo.futureSelfMonths} months ahead</span>
                  <RCBadge score={10} />
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {[6, 12, 24].map(m => (
                    <button key={m} onClick={() => { setEcho(e => ({ ...e, futureSelfMonths: m })); setFutureMessages([]); setFutureHistory([]); }}
                      style={{ padding: "4px 10px", borderRadius: 8, border: `1px solid ${echo.futureSelfMonths === m ? C.orange : "rgba(255,255,255,0.1)"}`, background: echo.futureSelfMonths === m ? `${C.orange}20` : "transparent", color: echo.futureSelfMonths === m ? C.orange : "#6aaedd", fontSize: 11, cursor: "pointer", fontWeight: echo.futureSelfMonths === m ? 700 : 400 }}>
                      {m}mo
                    </button>
                  ))}
                  <button onClick={() => setShowEchoSetup(s => !s)} style={btnS(C.orange)}>Edit Echo</button>
                </div>
              </>
            ) : (
              <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 12, color: "#6aaedd" }}>Configure your echo to begin</span>
                <button onClick={() => setShowEchoSetup(true)} style={{ padding: "7px 16px", borderRadius: 8, background: `${C.orange}`, border: "none", color: "#0a0b12", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
                  Set Up My Echo
                </button>
              </div>
            )}
          </div>

          {/* Echo setup form */}
          {showEchoSetup && (
            <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "#0a0b12", flexShrink: 0, overflowY: "auto", maxHeight: 340 }}>
              <div style={{ fontSize: 11, color: C.orange, fontWeight: 700, marginBottom: 12 }}>MY ECHO CONFIGURATION</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                {[
                  { key: "name",          label: "Your Name",              ph: "Chris" },
                  { key: "futureSelfMonths", label: "Months Ahead",        ph: "12", type: "number" },
                  { key: "values",        label: "Core Values",            ph: "family, growth, creativity, freedom" },
                  { key: "style",         label: "Communication Style",    ph: "direct, warm, occasionally blunt" },
                  { key: "energyPattern", label: "Energy Pattern",         ph: "sharp mornings, creative 2-5pm" },
                  { key: "goals",         label: "Active Goals",           ph: "scale business, more family time" },
                ].map(f => (
                  <div key={f.key}>
                    <label style={{ fontSize: 10, color: "#6aaedd", display: "block", marginBottom: 3 }}>{f.label}</label>
                    <input type={f.type || "text"} value={echo[f.key] || ""} onChange={e => setEcho(v => ({ ...v, [f.key]: f.type === "number" ? parseInt(e.target.value) || 12 : e.target.value }))} placeholder={f.ph} style={inp} />
                  </div>
                ))}
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 10, color: "#6aaedd", display: "block", marginBottom: 3 }}>Life Context</label>
                <input value={echo.lifeContext || ""} onChange={e => setEcho(v => ({ ...v, lifeContext: e.target.value }))} placeholder="Marketing business owner in Atlanta, married with 2 kids..." style={inp} />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={saveEcho} style={{ padding: "8px 20px", borderRadius: 8, background: C.orange, border: "none", color: "#0a0b12", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>Save Echo</button>
                <button onClick={() => setShowEchoSetup(false)} style={btnS(C.red)}>Cancel</button>
              </div>
            </div>
          )}

          {/* Chat area */}
          {echoConfigured && !showEchoSetup ? (
            <ChatThread
              messages={futureMessages}
              loading={futureLoading}
              echoName={`Future ${echo.name} (${echo.futureSelfMonths}mo)`}
              accentColor={C.orange}
              onSend={sendFuture}
              placeholder={`Ask your ${echo.futureSelfMonths}-month future self anything...`}
            />
          ) : !echoConfigured && !showEchoSetup ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, color: "#4a5568" }}>
              <div style={{ fontSize: 48 }}>🔮</div>
              <div style={{ fontSize: 13 }}>Configure your echo above to begin the conversation.</div>
            </div>
          ) : null}
        </div>
      )}

      {/* ── CONTACT ECHOES TAB ── */}
      {activeTab === "contacts" && (
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {/* Sidebar */}
          <div style={{ width: 200, flexShrink: 0, borderRight: "1px solid rgba(255,255,255,0.06)", overflowY: "auto", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "10px 12px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <button onClick={() => setShowContactForm(true)} style={{ width: "100%", padding: "7px", borderRadius: 8, background: `${C.purple}20`, border: `1px solid ${C.purple}40`, color: C.purple, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                + Add Echo
              </button>
            </div>
            {contacts.length === 0 && (
              <div style={{ padding: 16, fontSize: 11, color: "#4a5568", lineHeight: 1.6 }}>
                No contact echoes yet. Add a consented person to collaborate.
              </div>
            )}
            {contacts.map(c => (
              <button key={c.id} onClick={() => setActiveContact(c)}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", border: "none", borderLeft: `3px solid ${activeContact?.id === c.id ? C.purple : "transparent"}`, background: activeContact?.id === c.id ? `${C.purple}10` : "transparent", cursor: "pointer", textAlign: "left" }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: `${C.purple}20`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0 }}>
                  {c.name[0].toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#f0ede8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
                  <RCBadge score={c.relationshipCapital} />
                </div>
              </button>
            ))}
          </div>

          {/* Contact form or chat */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {showContactForm ? (
              <div style={{ padding: 20, overflowY: "auto" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.purple, marginBottom: 4 }}>Add Contact Echo</div>
                <div style={{ fontSize: 11, color: "#6aaedd", marginBottom: 14, lineHeight: 1.5 }}>
                  This creates a private AI echo of someone you know. Only add people you trust and who would consent to this use.
                </div>
                <div style={{ background: `${C.gold}08`, border: `1px solid ${C.gold}25`, borderRadius: 10, padding: 12, marginBottom: 14, fontSize: 11, color: C.gold }}>
                  ⚖️ Consent: By adding this person, you confirm they have consented to or would reasonably consent to this private, non-shared simulation.
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                  {[
                    { key: "name",          label: "Name",               ph: "e.g. Sarah" },
                    { key: "relationship",  label: "Relationship",       ph: "e.g. Spouse, Business Partner" },
                    { key: "personality",   label: "Personality",        ph: "e.g. analytical, empathetic, direct" },
                    { key: "style",         label: "Communication Style", ph: "e.g. asks questions, listens first" },
                    { key: "values",        label: "Core Values",        ph: "e.g. family, stability, honesty" },
                    { key: "expertise",     label: "Area of Expertise",  ph: "e.g. finance, parenting, design" },
                  ].map(f => (
                    <div key={f.key}>
                      <label style={{ fontSize: 10, color: "#6aaedd", display: "block", marginBottom: 3 }}>{f.label}</label>
                      <input value={contactForm[f.key]} onChange={e => setContactForm(c => ({ ...c, [f.key]: e.target.value }))} placeholder={f.ph} style={inp} />
                    </div>
                  ))}
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 10, color: "#6aaedd", display: "block", marginBottom: 3 }}>How they typically respond to big ideas</label>
                  <input value={contactForm.responseStyle} onChange={e => setContactForm(c => ({ ...c, responseStyle: e.target.value }))} placeholder="e.g. plays devil's advocate, asks about impact on family..." style={inp} />
                </div>
                {/* Relationship Capital slider */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <label style={{ fontSize: 10, color: "#6aaedd" }}>Relationship Capital (echo accuracy weight)</label>
                    <span style={{ fontSize: 11, fontWeight: 700, color: contactForm.relationshipCapital >= 8 ? C.teal : contactForm.relationshipCapital >= 5 ? C.orange : C.red }}>
                      {contactForm.relationshipCapital}/10
                    </span>
                  </div>
                  <input type="range" min={1} max={10} value={contactForm.relationshipCapital} onChange={e => setContactForm(c => ({ ...c, relationshipCapital: parseInt(e.target.value) }))} style={{ width: "100%", accentColor: C.purple }} />
                  <div style={{ fontSize: 10, color: "#4a5568" }}>
                    {contactForm.relationshipCapital >= 8 ? "Strong signal — echo will be highly specific" : contactForm.relationshipCapital >= 5 ? "Good signal — echo captures personality well" : "Weaker signal — echo will be more general"}
                  </div>
                </div>
                {/* Consent checkbox */}
                <label style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 14, cursor: "pointer" }}>
                  <input type="checkbox" checked={contactForm.consentAcknowledged} onChange={e => setContactForm(c => ({ ...c, consentAcknowledged: e.target.checked }))} style={{ marginTop: 2, accentColor: C.purple }} />
                  <span style={{ fontSize: 11, color: "#8892a4", lineHeight: 1.5 }}>
                    I acknowledge this is a private simulation. All conversations stay on-device and are never shared without my explicit action.
                  </span>
                </label>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={addContact} disabled={!contactForm.name.trim() || !contactForm.consentAcknowledged}
                    style={{ padding: "9px 20px", borderRadius: 8, background: C.purple, border: "none", color: "#fff", fontSize: 12, fontWeight: 800, cursor: contactForm.name.trim() && contactForm.consentAcknowledged ? "pointer" : "not-allowed", opacity: contactForm.name.trim() && contactForm.consentAcknowledged ? 1 : 0.4 }}>
                    Create Echo
                  </button>
                  <button onClick={() => setShowContactForm(false)} style={btnS(C.red)}>Cancel</button>
                </div>
              </div>
            ) : activeContact ? (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                {/* Contact header */}
                <div style={{ padding: "8px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)", background: "#0d0e17", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                  <div style={{ width: 30, height: 30, borderRadius: "50%", background: `${C.purple}25`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: C.purple }}>
                    {activeContact.name[0]}
                  </div>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: C.purple }}>{activeContact.name}</span>
                    <span style={{ fontSize: 10, color: "#6aaedd", marginLeft: 8 }}>{activeContact.relationship}</span>
                    <RCBadge score={activeContact.relationshipCapital} />
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {(contactMessages[activeContact.id] || []).length > 0 && (
                    )}
                    <button onClick={() => { const next = contacts.filter(c => c.id !== activeContact.id); setContacts(next); save(CONTACTS_KEY, next); setActiveContact(null); }} style={btnS(C.red)}>Remove</button>
                  </div>
                </div>
                <ChatThread
                  messages={contactMessages[activeContact.id] || []}
                  loading={contactLoading}
                  echoName={`${activeContact.name} (Echo)`}
                  accentColor={C.purple}
                  onSend={t => sendContact(t, activeContact)}
                  placeholder={`Talk to ${activeContact.name}'s echo...`}
                />
              </div>
            ) : (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, color: "#4a5568" }}>
                <div style={{ fontSize: 48 }}>👥</div>
                <div style={{ fontSize: 13 }}>Select a contact echo or add a new one.</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── GROUP SESSION TAB ── */}
      {activeTab === "group" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {!groupStarted ? (
            <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
              <div style={{ maxWidth: 560 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#f0ede8", marginBottom: 4 }}>Group Brainstorm Session</div>
                <div style={{ fontSize: 11, color: "#6aaedd", marginBottom: 20 }}>Your future self + contact echoes brainstorm a topic together. Each voice adds their genuine perspective.</div>

                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 10, color: C.purple, fontWeight: 700, display: "block", marginBottom: 6 }}>BRAINSTORM TOPIC</label>
                  <input value={groupTopic} onChange={e => setGroupTopic(e.target.value)}
                    placeholder="e.g. Should I pivot my business toward game streaming events in Atlanta?"
                    style={inp} />
                </div>

                {/* Participants */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 10, color: C.purple, fontWeight: 700, marginBottom: 8 }}>SELECT PARTICIPANTS</div>
                  {/* Always includes future self */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: `${C.orange}10`, border: `1px solid ${C.orange}25`, borderRadius: 10, marginBottom: 8 }}>
                    <span style={{ fontSize: 18 }}>🔮</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: C.orange }}>Future {echo.name || "Chris"} ({echo.futureSelfMonths}mo)</span>
                    <span style={{ fontSize: 10, color: "#6aaedd", marginLeft: "auto" }}>Always included</span>
                  </div>
                  {contacts.length === 0 && (
                    <div style={{ fontSize: 11, color: "#4a5568", padding: "8px 12px" }}>Add contact echoes first to include them in group sessions.</div>
                  )}
                  {contacts.map(c => {
                    const selected = groupParticipants.some(p => p.id === c.id);
                    return (
                      <div key={c.id} onClick={() => setGroupParticipants(prev => selected ? prev.filter(p => p.id !== c.id) : [...prev, c])}
                        style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: selected ? `${C.purple}10` : "transparent", border: `1px solid ${selected ? C.purple : "rgba(255,255,255,0.08)"}`, borderRadius: 10, marginBottom: 6, cursor: "pointer" }}>
                        <div style={{ width: 24, height: 24, borderRadius: "50%", background: `${C.purple}20`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: C.purple }}>
                          {c.name[0]}
                        </div>
                        <span style={{ fontSize: 12, fontWeight: selected ? 600 : 400, color: selected ? C.purple : "#8892a4" }}>{c.name}</span>
                        <RCBadge score={c.relationshipCapital} />
                        {selected && <span style={{ marginLeft: "auto", fontSize: 14, color: C.purple }}>✓</span>}
                      </div>
                    );
                  })}
                </div>

                <button onClick={() => { if (!groupTopic.trim() || !echoConfigured) return; setGroupStarted(true); setGroupMessages([]); }}
                  disabled={!groupTopic.trim() || !echoConfigured}
                  style={{ padding: "12px 28px", borderRadius: 10, background: `linear-gradient(135deg, ${C.orange}, ${C.purple})`, border: "none", color: "#0a0b12", fontSize: 13, fontWeight: 800, cursor: groupTopic.trim() && echoConfigured ? "pointer" : "not-allowed", opacity: groupTopic.trim() && echoConfigured ? 1 : 0.4 }}>
                  🎭 Start Group Session
                </button>
                {!echoConfigured && <div style={{ fontSize: 11, color: C.red, marginTop: 8 }}>Configure your echo first (My Echo tab).</div>}
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              {/* Session header */}
              <div style={{ padding: "8px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)", background: "#0d0e17", display: "flex", alignItems: "center", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, color: "#6aaedd" }}>Topic:</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#f0ede8", flex: 1 }}>{groupTopic}</span>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => { setGroupStarted(false); setGroupMessages([]); }} style={btnS(C.red)}>End Session</button>
                </div>
              </div>
              {/* Participants strip */}
              <div style={{ padding: "6px 14px", borderBottom: "1px solid rgba(255,255,255,0.04)", background: "#0a0b12", display: "flex", gap: 8, flexShrink: 0 }}>
                {[{ name: `Future ${echo.name}`, emoji: "🔮", col: C.orange }, ...groupParticipants.map(p => ({ name: p.name, emoji: p.name[0], col: C.purple }))].map(p => (
                  <span key={p.name} style={{ fontSize: 10, padding: "2px 9px", borderRadius: 10, background: `${p.col}15`, border: `1px solid ${p.col}30`, color: p.col }}>{p.emoji} {p.name}</span>
                ))}
              </div>
              <ChatThread
                messages={groupMessages}
                loading={groupLoading}
                echoName="Group"
                accentColor={C.purple}
                onSend={sendGroup}
                placeholder="Ask the group anything..."
              />
            </div>
          )}
        </div>
      )}

    </div>
  );
}
