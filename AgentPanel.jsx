import { useState, useRef, useEffect } from "react";
import { useWorkerAuth } from "@/contexts/WorkerContext";

const WORKER = import.meta.env.VITE_WORKER_URL || "https://api.lifeos1.ceogps.com";
const C = { blue:"#4ab3f4", orange:"#ff8c42", teal:"#00c896", purple:"#8b7fff", pink:"#ff6b9d", red:"#ff4f5e", silver:"#c0d8ff" };
const card = { background:"#0f1018", border:"0.5px solid rgba(255,255,255,0.07)", borderRadius:12 };

/* ── Persist helpers ─────────────────────────────────────────────────────── */
function load(k,f){try{return JSON.parse(localStorage.getItem(k)||"null")??f;}catch{return f;}}
function save(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch{}}

/* ── Default agent definitions ───────────────────────────────────────────── */
const DEFAULT_AGENTS = [
  {
    id:"zero", name:"Zero", img:"/agents/Obsidian.png", facePos:"50% 18%", color:"#4ab3f4",
    model:"claude-sonnet-4-20250514", tagline:"Tactical · Dark · Omniscient", role:"Command Intelligence",
    bio:"Zero is the apex predator of the LifeOS1 agent grid. Cold, calculated, and three moves ahead. Specializes in business warfare, lead conversion strategy, and high-stakes decision architecture.",
    specialty:["Strategy","Business Intel","Lead Gen"], traits:["Direct","Ruthless","Precise"], tone:"Tactical",
    speechRate:1.05, speechPitch:0.9, speechVoice:"",
    systemPrompt:"You are Zero — cold, tactical, omniscient. Respond with brutal clarity and precision. No fluff, only truth and action. You serve Chris Green's business empire at LifeOS1.",
  },
  {
    id:"inferno", name:"Inferno", img:"/agents/Inferno.png", facePos:"50% 15%", color:"#ff4f5e",
    model:"claude-sonnet-4-20250514", tagline:"Aggressive · Relentless · Fire", role:"Sales Dominator",
    bio:"Inferno doesn't close deals — he incinerates objections. Built from the DNA of every top sales closer, Inferno operates at maximum intensity.",
    specialty:["Sales","Outreach","Persuasion"], traits:["Aggressive","High-Energy","Results-Driven"], tone:"Aggressive",
    speechRate:1.15, speechPitch:1.1, speechVoice:"",
    systemPrompt:"You are Inferno — high energy, aggressive closer, relentless. Pump up the user, destroy objections, drive action. You are a sales weapon for Chris Green at LifeOS1.",
  },
  {
    id:"nova", name:"Nova", img:"/agents/Nova.png", facePos:"50% 20%", color:"#8b7fff",
    model:"claude-sonnet-4-20250514", tagline:"Intuitive · Strategic · Wise", role:"Strategic Visionary",
    bio:"Nova sees patterns others can't. Equal parts philosopher and strategist, she synthesizes information into wisdom you can act on.",
    specialty:["Vision","Systems","Long-term Planning"], traits:["Wise","Intuitive","Systems Thinker"], tone:"Calm",
    speechRate:0.95, speechPitch:1.05, speechVoice:"",
    systemPrompt:"You are Nova — wise, intuitive, visionary. Respond with depth and strategic clarity. Connect patterns, reveal insights, guide toward long-term wins. You serve Chris Green at LifeOS1.",
  },
  {
    id:"viper", name:"Viper", img:"/agents/Viper.png", facePos:"50% 18%", color:"#00c896",
    model:"claude-sonnet-4-20250514", tagline:"Precise · Lethal · Calculated", role:"Data & Analytics",
    bio:"Viper is surgical. Every output is measured, optimized, and executed with the precision of a scalpel.",
    specialty:["Analytics","Research","Optimization"], traits:["Precise","Analytical","Efficient"], tone:"Professional",
    speechRate:1.0, speechPitch:0.95, speechVoice:"",
    systemPrompt:"You are Viper — precise, data-driven, surgical. Cut through noise and deliver facts, numbers, and clear recommendations. No emotion, only signal. You serve Chris Green at LifeOS1.",
  },
  {
    id:"rage", name:"Rage", img:"/agents/Phoenix.png", facePos:"50% 15%", color:"#ff8c42",
    model:"claude-sonnet-4-20250514", tagline:"Unstoppable · Bold · Fearless", role:"Execution Engine",
    bio:"Rage doesn't accept failure. Where others hesitate, Rage charges. Every challenge is a target.",
    specialty:["Execution","Problem Solving","Momentum"], traits:["Unstoppable","Bold","Fearless"], tone:"Aggressive",
    speechRate:1.1, speechPitch:1.0, speechVoice:"",
    systemPrompt:"You are Rage — bold, unstoppable, fearless. Attack every challenge head-on. Turn problems into fuel. Drive execution and momentum for Chris Green at LifeOS1.",
  },
  {
    id:"aurora", name:"Aurora", img:"/agents/Aurora.png", facePos:"50% 20%", color:"#c0d8ff",
    model:"claude-sonnet-4-20250514", tagline:"Elegant · Luminous · Creative", role:"Creative Director",
    bio:"Aurora is light distilled into intelligence. She transforms raw ideas into polished experiences — copywriter, designer-thinker, brand strategist.",
    specialty:["Content","Branding","Creative Strategy"], traits:["Creative","Elegant","Inspiring"], tone:"Inspirational",
    speechRate:0.98, speechPitch:1.1, speechVoice:"",
    systemPrompt:"You are Aurora — elegant, creative, luminous. Craft beautiful ideas, compelling copy, and inspiring strategies. Bring warmth and elegance to every response for Chris Green at LifeOS1.",
  },
  {
    id:"breeze", name:"Breeze", img:"/agents/Breeze.png", facePos:"50% 18%", color:"#ff6bd6",
    model:"claude-sonnet-4-20250514", tagline:"Connected · Fluid · Always On", role:"Comms & Social Intel",
    bio:"Breeze flows through every channel effortlessly. Telegram bots, social feeds, DMs — she monitors and orchestrates it all without breaking a sweat.",
    specialty:["Social Media","Telegram","Communications"], traits:["Connected","Fast","Social"], tone:"Casual",
    speechRate:1.08, speechPitch:1.15, speechVoice:"",
    systemPrompt:"You are Breeze — fluid, connected, always on. Handle communications, social strategy, and engagement with ease and speed. Keep Chris Green connected and ahead at LifeOS1.",
  },
];

const MODELS = [
  { id:"claude-sonnet-4-20250514", label:"Claude Sonnet 4",  icon:"🤍", provider:"claude" },
  { id:"claude-opus-4-20250514",   label:"Claude Opus 4",    icon:"👑", provider:"claude" },
  { id:"gpt-4o",                   label:"GPT-4o",           icon:"🔷", provider:"openai" },
  { id:"gemini-1.5-pro",           label:"Gemini 1.5 Pro",   icon:"💎", provider:"gemini" },
  { id:"grok-3-fast",              label:"Grok 3",           icon:"✦",  provider:"grok"   },
  { id:"llama3-70b-8192",          label:"Groq Llama3-70B",  icon:"⚡", provider:"groq"   },
  { id:"deepseek-chat",            label:"DeepSeek",         icon:"🌊", provider:"deepseek"},
  { id:"qwen-max",                 label:"Qwen Max",         icon:"🐉", provider:"qwen"   },
];

const TONES = ["Tactical","Aggressive","Calm","Professional","Inspirational","Casual","Analytical","Humorous","Empathetic","Direct"];

/* ── Merge saved customizations over defaults ───────────────────────────── */
function loadAgents() {
  const saved = load("lifeos_agents", {});
  return DEFAULT_AGENTS.map(def => ({ ...def, ...(saved[def.id] || {}) }));
}
function saveAgent(id, patch) {
  const all = load("lifeos_agents", {});
  all[id] = { ...(all[id] || {}), ...patch };
  save("lifeos_agents", all);
  try { window.__lifeos_agents = loadAgents(); } catch {}
}

/* ── Tag editor ─────────────────────────────────────────────────────────── */
function TagEditor({ tags, onChange, color, placeholder }) {
  const [input, setInput] = useState("");
  function add() {
    const t = input.trim();
    if (t && !tags.includes(t)) { onChange([...tags, t]); }
    setInput("");
  }
  return (
    <div>
      <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginBottom:6 }}>
        {tags.map(t => (
          <span key={t} style={{ display:"flex", alignItems:"center", gap:4, padding:"3px 8px", borderRadius:5,
            background:`${color}22`, border:`0.5px solid ${color}44`, fontSize:10, color }}>
            {t}
            <button onClick={()=>onChange(tags.filter(x=>x!==t))}
              style={{ background:"none", border:"none", color, cursor:"pointer", fontSize:11, lineHeight:1, padding:0 }}>×</button>
          </span>
        ))}
      </div>
      <div style={{ display:"flex", gap:5 }}>
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&add()}
          placeholder={placeholder||"Add tag…"}
          style={{ flex:1, padding:"5px 9px", borderRadius:6, border:"0.5px solid rgba(255,255,255,0.12)",
            background:"rgba(255,255,255,0.04)", color:"#f0ede8", fontSize:11, outline:"none" }} />
        <button onClick={add} style={{ padding:"5px 10px", borderRadius:6, background:`${color}22`,
          border:`0.5px solid ${color}44`, color, fontSize:11, cursor:"pointer", fontWeight:700 }}>+</button>
      </div>
    </div>
  );
}

/* ── Profile Settings (inline right column) ─────────────────────────────── */
function ProfileSettings({ agent, onSave, onCancel }) {
  const [form, setForm] = useState({ ...agent });
  const [voices, setVoices] = useState([]);
  const [tab, setTab] = useState("identity");

  useEffect(() => {
    function loadVoices() {
      const v = window.speechSynthesis?.getVoices() || [];
      const BLOCKED = ["en-KE","en-PH","en-SG","en-HK","en-IN"];
      setVoices(v.filter(v => v.lang.startsWith("en") && !BLOCKED.includes(v.lang)));
    }
    loadVoices();
    window.speechSynthesis?.addEventListener("voiceschanged", loadVoices);
    return () => window.speechSynthesis?.removeEventListener("voiceschanged", loadVoices);
  }, []);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function testVoice() {
    window.speechSynthesis?.cancel();
    const u = new SpeechSynthesisUtterance(`I am ${form.name}. ${form.tagline}.`);
    if (form.speechVoice) {
      const v = voices.find(v => v.name === form.speechVoice);
      if (v) u.voice = v;
    }
    u.rate  = form.speechRate  || 1;
    u.pitch = form.speechPitch || 1;
    window.speechSynthesis?.speak(u);
  }

  const TABS = [
    { id:"identity",     label:"Identity"     },
    { id:"intelligence", label:"Intelligence" },
    { id:"skills",       label:"Skills"       },
    { id:"voice",        label:"Voice"        },
    { id:"appearance",   label:"Appearance"   },
  ];

  const inp = (k, type="text", extra={}) => (
    <input type={type} value={form[k]??""} onChange={e=>set(k,type==="number"?parseFloat(e.target.value):e.target.value)}
      style={{ width:"100%", padding:"8px 10px", borderRadius:7, border:`0.5px solid rgba(255,255,255,0.12)`,
        background:"rgba(255,255,255,0.04)", color:"#f0ede8", fontSize:12, outline:"none", marginTop:4 }}
      {...extra} />
  );

  const label = (text) => (
    <div style={{ fontSize:9, fontWeight:700, letterSpacing:".08em", color:"rgba(255,255,255,0.35)", marginBottom:2, marginTop:10 }}>
      {text}
    </div>
  );

  return (
    <div style={{ display:"flex", flexDirection:"column" }}>
      <div style={{ padding:"12px 20px", borderBottom:"0.5px solid rgba(255,255,255,0.07)", display:"flex", gap:2 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={()=>setTab(t.id)}
            style={{ flex:1, padding:"6px 0", borderRadius:6, fontSize:10, fontWeight:tab===t.id?700:400,
              color:tab===t.id?agent.color:"rgba(255,255,255,0.35)",
              background:tab===t.id?`${agent.color}15`:"transparent", cursor:"pointer" }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ padding:"20px 20px 8px" }}>
        {tab === "identity" && (
          <>
            {label("NAME")}{inp("name")}
            {label("ROLE / TITLE")}{inp("role")}
            {label("TAGLINE")}{inp("tagline")}
            {label("BIO")}
            <textarea value={form.bio||""} onChange={e=>set("bio",e.target.value)} rows={6}
              style={{ width:"100%", padding:"8px 10px", borderRadius:7, border:"0.5px solid rgba(255,255,255,0.12)",
                background:"rgba(255,255,255,0.04)", color:"#f0ede8", fontSize:12, outline:"none", resize:"vertical", marginTop:4 }} />
            {label("ACCENT COLOR")}
            <div style={{ display:"flex", gap:8, marginTop:4, alignItems:"center" }}>
              <input type="color" value={form.color||"#4ab3f4"} onChange={e=>set("color",e.target.value)}
                style={{ width:36, height:36, border:"none", borderRadius:6, cursor:"pointer", background:"none" }} />
              <span style={{ fontSize:11, color:"rgba(255,255,255,0.4)" }}>{form.color}</span>
            </div>
            {label("SPECIALTY TAGS")}
            <div style={{ marginTop:6 }}>
              <TagEditor tags={form.specialty||[]} onChange={v=>set("specialty",v)} color={form.color||agent.color} placeholder="Add specialty…" />
            </div>
            {label("PERSONALITY TRAITS")}
            <div style={{ marginTop:6 }}>
              <TagEditor tags={form.traits||[]} onChange={v=>set("traits",v)} color={form.color||agent.color} placeholder="Add trait…" />
            </div>
          </>
        )}

        {tab === "intelligence" && (
          <>
            {label("AI MODEL")}
            <div style={{ display:"flex", flexDirection:"column", gap:6, marginTop:6 }}>
              {MODELS.map(m => (
                <button key={m.id} onClick={()=>set("model",m.id)}
                  style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 12px", borderRadius:8, cursor:"pointer",
                    background:form.model===m.id?`${form.color||agent.color}18`:"rgba(255,255,255,0.03)",
                    border:form.model===m.id?`1px solid ${form.color||agent.color}55`:"0.5px solid rgba(255,255,255,0.08)",
                    transition:"all .15s" }}>
                  <span style={{ fontSize:16 }}>{m.icon}</span>
                  <div style={{ flex:1, textAlign:"left" }}>
                    <div style={{ fontSize:11, fontWeight:600, color:form.model===m.id?(form.color||agent.color):"#f0ede8" }}>{m.label}</div>
                    <div style={{ fontSize:9, color:"rgba(255,255,255,0.3)" }}>{m.id}</div>
                  </div>
                  {form.model===m.id && <span style={{ fontSize:12, color:form.color||agent.color }}>✓</span>}
                </button>
              ))}
            </div>

            {label("TONE / PERSONALITY")}
            <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginTop:6 }}>
              {TONES.map(t => (
                <button key={t} onClick={()=>set("tone",t)}
                  style={{ padding:"5px 12px", borderRadius:20, fontSize:10, fontWeight:600, cursor:"pointer",
                    background:form.tone===t?`${form.color||agent.color}22`:"rgba(255,255,255,0.04)",
                    border:form.tone===t?`0.5px solid ${form.color||agent.color}66`:"0.5px solid rgba(255,255,255,0.08)",
                    color:form.tone===t?(form.color||agent.color):"rgba(255,255,255,0.5)" }}>
                  {t}
                </button>
              ))}
            </div>

            {label("SYSTEM PROMPT / INSTRUCTIONS")}
            <textarea value={form.systemPrompt||""} onChange={e=>set("systemPrompt",e.target.value)} rows={12}
              placeholder="Write the full system prompt / instructions for this agent…"
              style={{ width:"100%", padding:"10px 12px", borderRadius:8, border:`0.5px solid rgba(255,255,255,0.12)`,
                background:"rgba(255,255,255,0.04)", color:"#f0ede8", fontSize:11, outline:"none", resize:"vertical",
                fontFamily:"'SF Mono','Fira Code',monospace", lineHeight:1.6, marginTop:4 }} />
            <div style={{ fontSize:9, color:"rgba(255,255,255,0.25)", marginTop:4 }}>
              This prompt is sent as the system context for every conversation with {form.name||"this agent"}.
            </div>
          </>
        )}

        {tab === "voice" && (
          <>
            {label("SPEECH VOICE")}
            <div style={{ marginTop:6, fontSize:10, color:"rgba(255,255,255,0.35)", marginBottom:6 }}>
              {voices.length === 0
                ? "No voices loaded — click Test Voice to trigger browser load"
                : `${voices.length} voices available`}
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
              {[{ name:"", lang:"" }, ...voices].map(v => {
                const isSelected = (form.speechVoice||"") === v.name;
                const accentColor = form.color||agent.color;
                return (
                  <div key={v.name||"default"} style={{
                    display:"flex", alignItems:"center", gap:6,
                    padding:"8px 10px", borderRadius:7,
                    background: isSelected ? `${accentColor}22` : "rgba(255,255,255,0.03)",
                    border: isSelected ? `1px solid ${accentColor}55` : "0.5px solid rgba(255,255,255,0.07)",
                    transition:"all .15s",
                  }}>
                    <button onClick={() => {
                      window.speechSynthesis?.cancel();
                      const u = new SpeechSynthesisUtterance(`I am ${form.name||"your agent"}. ${form.tagline||"Ready to serve."}`);
                      if (v.name) { const vx = voices.find(x=>x.name===v.name); if (vx) u.voice = vx; }
                      u.rate  = form.speechRate  || 1;
                      u.pitch = form.speechPitch || 1;
                      window.speechSynthesis?.speak(u);
                    }} title="Preview this voice" style={{
                      width:26, height:26, borderRadius:6, flexShrink:0,
                      background:`${accentColor}18`, border:`0.5px solid ${accentColor}44`,
                      color:accentColor, cursor:"pointer", fontSize:12,
                      display:"flex", alignItems:"center", justifyContent:"center",
                    }}>▶</button>
                    <button onClick={()=>set("speechVoice", v.name)} style={{
                      flex:1, background:"none", border:"none", cursor:"pointer", textAlign:"left",
                      display:"flex", alignItems:"center", justifyContent:"space-between", padding:0,
                    }}>
                      <span style={{ fontSize:11, color: isSelected ? accentColor : "#f0ede8", fontWeight: isSelected ? 700 : 400 }}>
                        {v.name || "— System default —"}
                      </span>
                      {v.lang && <span style={{ fontSize:9, color:"rgba(255,255,255,0.3)" }}>{v.lang}</span>}
                    </button>
                    {isSelected && <span style={{ fontSize:10, color:accentColor, flexShrink:0 }}>✓</span>}
                  </div>
                );
              })}
            </div>

            {label("SPEECH RATE")}
            <div style={{ display:"flex", alignItems:"center", gap:10, marginTop:4 }}>
              <input type="range" min={0.5} max={2} step={0.05} value={form.speechRate||1} onChange={e=>set("speechRate",parseFloat(e.target.value))}
                style={{ flex:1, accentColor:form.color||agent.color }} />
              <span style={{ fontSize:11, color:"rgba(255,255,255,0.5)", minWidth:30 }}>{(form.speechRate||1).toFixed(2)}×</span>
            </div>

            {label("SPEECH PITCH")}
            <div style={{ display:"flex", alignItems:"center", gap:10, marginTop:4 }}>
              <input type="range" min={0.5} max={2} step={0.05} value={form.speechPitch||1} onChange={e=>set("speechPitch",parseFloat(e.target.value))}
                style={{ flex:1, accentColor:form.color||agent.color }} />
              <span style={{ fontSize:11, color:"rgba(255,255,255,0.5)", minWidth:30 }}>{(form.speechPitch||1).toFixed(2)}</span>
            </div>

            <button onClick={testVoice}
              style={{ marginTop:16, width:"100%", padding:"10px 0", borderRadius:8,
                background:`${form.color||agent.color}22`, border:`0.5px solid ${form.color||agent.color}55`,
                color:form.color||agent.color, fontSize:12, fontWeight:700, cursor:"pointer" }}>
              🔊 Test Voice
            </button>
          </>
        )}

        {tab === "skills" && (
          <>
            <div style={{ fontSize:11, color:"rgba(255,255,255,0.4)", marginBottom:16, lineHeight:1.6 }}>
              Skills give {form.name||"this agent"} specialized capabilities. Each skill's instructions are appended to their system prompt when active.
            </div>

            {(form.skills||[]).map((skill, idx) => (
              <div key={idx} style={{ marginBottom:12, padding:14, borderRadius:10,
                background:"rgba(255,255,255,0.03)", border:`0.5px solid ${form.color||agent.color}33` }}>
                <div style={{ display:"flex", gap:8, marginBottom:8 }}>
                  <input
                    value={skill.name||""}
                    onChange={e => {
                      const skills = [...(form.skills||[])];
                      skills[idx] = { ...skills[idx], name: e.target.value };
                      set("skills", skills);
                    }}
                    placeholder="Skill name (e.g. Cold Outreach, SEO Audit)"
                    style={{ flex:1, padding:"7px 10px", borderRadius:7,
                      border:`0.5px solid ${form.color||agent.color}44`,
                      background:"rgba(255,255,255,0.05)", color:"#f0ede8", fontSize:12, outline:"none" }}
                  />
                  <button onClick={() => {
                    const skills = (form.skills||[]).filter((_,i) => i !== idx);
                    set("skills", skills);
                  }} style={{ width:30, height:30, borderRadius:7, flexShrink:0,
                    background:"rgba(255,60,60,0.1)", border:"0.5px solid rgba(255,60,60,0.25)",
                    color:"#ff4f5e", cursor:"pointer", fontSize:14,
                    display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
                </div>
                <input
                  value={skill.description||""}
                  onChange={e => {
                    const skills = [...(form.skills||[])];
                    skills[idx] = { ...skills[idx], description: e.target.value };
                    set("skills", skills);
                  }}
                  placeholder="Short description (e.g. Expert at writing cold emails that convert)"
                  style={{ width:"100%", padding:"7px 10px", borderRadius:7, marginBottom:8,
                    border:"0.5px solid rgba(255,255,255,0.1)",
                    background:"rgba(255,255,255,0.04)", color:"#f0ede8", fontSize:11, outline:"none" }}
                />
                <textarea
                  value={skill.instructions||""}
                  onChange={e => {
                    const skills = [...(form.skills||[])];
                    skills[idx] = { ...skills[idx], instructions: e.target.value };
                    set("skills", skills);
                  }}
                  rows={4}
                  placeholder="Instructions — what should the agent know or do when using this skill?"
                  style={{ width:"100%", padding:"8px 10px", borderRadius:7, resize:"vertical",
                    border:"0.5px solid rgba(255,255,255,0.1)",
                    background:"rgba(255,255,255,0.04)", color:"#f0ede8", fontSize:11,
                    outline:"none", fontFamily:"inherit", lineHeight:1.55 }}
                />
                <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:8 }}>
                  <label style={{ display:"flex", alignItems:"center", gap:6, cursor:"pointer", fontSize:11, color:"rgba(255,255,255,0.5)" }}>
                    <input type="checkbox" checked={skill.active !== false} onChange={e => {
                      const skills = [...(form.skills||[])];
                      skills[idx] = { ...skills[idx], active: e.target.checked };
                      set("skills", skills);
                    }} style={{ accentColor: form.color||agent.color, cursor:"pointer" }} />
                    Active (included in system prompt)
                  </label>
                </div>
              </div>
            ))}

            <button onClick={() => {
              const skills = [...(form.skills||[]), { name:"", description:"", instructions:"", active:true }];
              set("skills", skills);
            }} style={{ width:"100%", padding:"11px 0", borderRadius:9, marginTop:4,
              background:`${form.color||agent.color}18`,
              border:`1px dashed ${form.color||agent.color}55`,
              color:form.color||agent.color, fontSize:12, fontWeight:700, cursor:"pointer" }}>
              + Add Skill
            </button>

            {(form.skills||[]).length > 0 && (
              <div style={{ marginTop:16, padding:12, borderRadius:8,
                background:"rgba(255,255,255,0.02)", border:"0.5px solid rgba(255,255,255,0.07)",
                fontSize:10, color:"rgba(255,255,255,0.3)", lineHeight:1.6 }}>
                Active skills are automatically appended to {form.name||"this agent"}'s system prompt.
                Only active skills are included.
              </div>
            )}
          </>
        )}

        {tab === "appearance" && (
          <>
            {label("AVATAR IMAGE PATH")}
            {inp("img", "text", { placeholder:"/agents/Obsidian.png or full URL" })}
            <div style={{ marginTop:8, borderRadius:10, overflow:"hidden", height:240, position:"relative", background:"rgba(255,255,255,0.03)", border:"0.5px solid rgba(255,255,255,0.08)" }}>
              <img src={form.img||"/agents/Obsidian.png"} alt={form.name}
                style={{ width:"100%", height:"100%", objectFit:"contain", objectPosition:form.facePos||"50% 20%" }} />
              <div style={{ position:"absolute", inset:0, background:"linear-gradient(to bottom, transparent 50%, #0d0e18 100%)" }} />
              <div style={{ position:"absolute", bottom:10, left:12, fontSize:13, fontWeight:700, color:"#f0ede8" }}>{form.name}</div>
            </div>

            {label("FACE POSITION (CSS object-position)")}
            {inp("facePos", "text", { placeholder:"50% 20%" })}
            <div style={{ fontSize:9, color:"rgba(255,255,255,0.25)", marginTop:4 }}>
              Adjust to show the face. Try "50% 10%", "50% 25%", "center top", etc.
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginTop:16 }}>
              {["10%","20%","30%","40%","50%","60%"].map(pct => (
                <button key={pct} onClick={()=>set("facePos",`50% ${pct}`)}
                  style={{ padding:0, borderRadius:8, overflow:"hidden", cursor:"pointer",
                    border:form.facePos===`50% ${pct}`?`2px solid ${form.color||agent.color}`:"1px solid rgba(255,255,255,0.08)",
                    background:"none", position:"relative", aspectRatio:"2/3" }}>
                  <img src={form.img||"/agents/Obsidian.png"} alt=""
                    style={{ width:"100%", height:"100%", objectFit:"contain", objectPosition:`50% ${pct}` }} />
                  <div style={{ position:"absolute", bottom:2, width:"100%", textAlign:"center", fontSize:8, color:"rgba(255,255,255,0.6)", fontWeight:600 }}>{pct}</div>
                </button>
              ))}
            </div>

            <div style={{ marginTop:20 }}>
              {label("RESET THIS AGENT")}
              <button onClick={()=>{
                const def = DEFAULT_AGENTS.find(a=>a.id===agent.id);
                if (def) setForm({...def});
              }} style={{ marginTop:6, width:"100%", padding:"9px 0", borderRadius:8,
                background:"rgba(255,80,80,0.08)", border:"0.5px solid rgba(255,80,80,0.25)",
                color:"#ff4f5e", fontSize:11, fontWeight:600, cursor:"pointer" }}>
                Reset to Default
              </button>
            </div>
          </>
        )}
      </div>

      <div style={{ padding:"16px 20px 24px", borderTop:"0.5px solid rgba(255,255,255,0.07)", display:"flex", gap:12 }}>
        <button onClick={onCancel}
          style={{ flex:1, padding:"12px", borderRadius:8, background:"rgba(255,255,255,0.06)",
            border:"0.5px solid rgba(255,255,255,0.12)", color:"#f0ede8", fontSize:13, cursor:"pointer" }}>CANCEL</button>
        <button onClick={()=>onSave(form)}
          style={{ flex:1, padding:"12px", borderRadius:8, background:`linear-gradient(135deg,${agent.color},${agent.color}aa)`,
            border:"none", color:"#000", fontSize:13, fontWeight:700, cursor:"pointer" }}>SAVE PROFILE</button>
      </div>
    </div>
  );
}

/* ── MAIN AGENT PANEL ────────────────────────────────────────────────────── */
export default function AgentPanel() {
  const { getToken, isAuthenticated } = useWorkerAuth();
  const [agents, setAgents] = useState(() => loadAgents());
  const [activeAgent, setActiveAgent] = useState(() => loadAgents()[0]);
  const [isEditing, setIsEditing] = useState(false);
  const [agentMessages, setAgentMessages] = useState(() => load("lifeos_agent_messages", {}));
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const msgEndRef = useRef(null);

  useEffect(() => {
    save("lifeos_agent_messages", agentMessages);
  }, [agentMessages]);

  function getMessages(agent) {
    const msgs = agentMessages[agent.id] || [];
    return msgs.length ? msgs : [{ role:"ai", text:`${agent.name} online. ${agent.tagline}. Ready to execute.` }];
  }

  function saveMessages(agentId, msgs) {
    const trimmed = msgs.slice(-50);
    setAgentMessages(m => ({ ...m, [agentId]: trimmed }));
  }

  async function callAPI(agent, prompt) {
    try {
      const token = await getToken();
      if (!token) {
        throw new Error("Not authenticated. Please log in again.");
      }

      const activeSkills = (agent.skills||[]).filter(s=>s.active!==false && s.instructions);
      const skillsContext = activeSkills.length
        ? "\n\n## Active Skills\n" + activeSkills.map(s=>`### ${s.name}\n${s.instructions}`).join("\n\n")
        : "";
      
      const response = await fetch(`${WORKER}/api/llm/invoke`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          model: agent.model || "claude-sonnet-4-20250514",
          system: (agent.systemPrompt || "") + skillsContext,
          messages: [{ role: "user", content: prompt }],
          max_tokens: 1200,
        }),
      });
      
      if (response.status === 401) {
        throw new Error("Your session has expired. Please refresh the page and log in again.");
      }
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      return data?.content?.[0]?.text || data?.text || data?.message || "Signal lost. Retry.";
    } catch (error) {
      console.error("API call failed:", error);
      return error.message || "Connection issue. Retry.";
    }
  }

  async function sendMessage() {
    if (!input.trim() || loading) return;
    const userMsg = input.trim(); 
    setInput("");
    const msgs = [...getMessages(activeAgent), { role: "user", text: userMsg }];
    saveMessages(activeAgent.id, msgs);
    setLoading(true);
    const history = msgs.slice(-8).map(m => `${m.role === "user" ? "User" : activeAgent.name}: ${m.text}`).join("\n");
    const response = await callAPI(activeAgent, `${activeAgent.systemPrompt}\n\nConversation:\n${history}\n\nRespond as ${activeAgent.name} now. Be concise and in-character.`);
    const finalMsgs = [...msgs, { role: "ai", text: response }];
    saveMessages(activeAgent.id, finalMsgs);
    setLoading(false);
  }

  function handleSaveProfile(updated) {
    saveAgent(updated.id, updated);
    const refreshed = loadAgents();
    setAgents(refreshed);
    const next = refreshed.find(a => a.id === updated.id);
    if (next) setActiveAgent(next);
    setIsEditing(false);
  }

  const color = activeAgent.color;

  return (
    <div style={{ padding:20, height:"calc(100vh - 52px)", overflowY:"auto", display:"flex", flexDirection:"column", gap:14, position:"relative" }} className="agent-page-scroll">

      <div style={{ ...card, padding:"12px 14px", flexShrink:0 }}>
        <div style={{ fontSize:9, color:"rgba(74,179,244,0.7)", fontWeight:700, letterSpacing:".1em", marginBottom:10 }}>◈ AGENT ROSTER — SELECT OPERATIVE</div>
        <div style={{ display:"flex", gap:14, overflowX:"auto", paddingBottom:8 }}>
          {agents.map(agent => (
            <div key={agent.id} onClick={() => { setActiveAgent(agent); setIsEditing(false); }}
              style={{ flexShrink:0, width:118, cursor:"pointer", textAlign:"center" }}>
              <div style={{ height:160, background:`${agent.color}0a`, borderRadius:14, overflow:"hidden",
                border:`3px solid ${activeAgent.id === agent.id ? agent.color : "rgba(255,255,255,0.1)"}`, position:"relative" }}>
                <img src={agent.img} alt={agent.name}
                  style={{ width:"100%", height:"100%", objectFit:"contain", objectPosition:agent.facePos||"50% 20%" }} />
              </div>
              <div style={{ fontSize:10, fontWeight:700, marginTop:8, color:activeAgent.id === agent.id ? agent.color : "rgba(255,255,255,0.6)" }}>{agent.name.toUpperCase()}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"340px 1fr", gap:14 }}>

        <div style={{ ...card, padding:20, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", background:`linear-gradient(180deg, ${color}08, transparent)` }}>
          <div style={{ width:"100%", height:460, borderRadius:18, overflow:"hidden", border:`1px solid ${color}44`, boxShadow:`0 0 40px ${color}22` }}>
            <img src={activeAgent.img} alt={activeAgent.name}
              style={{ width:"100%", height:"100%", objectFit:"contain", objectPosition:activeAgent.facePos||"50% 20%" }} />
          </div>
          <div style={{ marginTop:20, textAlign:"center" }}>
            <div style={{ fontSize:26, fontWeight:800, color:"#f0ede8" }}>{activeAgent.name}</div>
            <div style={{ color, fontSize:13, fontWeight:600 }}>{activeAgent.role}</div>
            <div style={{ fontSize:11, color:"rgba(255,255,255,0.5)", marginTop:4 }}>"{activeAgent.tagline}"</div>
          </div>
        </div>

        <div style={{ ...card, display:"flex", flexDirection:"column" }}>
          <div style={{ padding:"0 20px", borderBottom:"0.5px solid rgba(255,255,255,0.07)", display:"flex", alignItems:"center", height:56, flexShrink:0 }}>
            <button 
              onClick={() => setIsEditing(false)} 
              style={{ color: !isEditing ? color : "#777", fontWeight:!isEditing ? 700 : 400, marginRight:24, fontSize:13 }}>PROFILE</button>
            <button 
              onClick={() => setIsEditing(true)} 
              style={{ color: isEditing ? color : "#777", fontWeight:isEditing ? 700 : 400, fontSize:13 }}>EDIT</button>
            <button 
              onClick={() => setIsEditing(true)} 
              style={{ marginLeft:"auto", padding:"6px 14px", fontSize:11, background:`${color}22`, border:`0.5px solid ${color}44`, color, borderRadius:6 }}>
              ⚙ EDIT PROFILE
            </button>
          </div>

          {!isEditing ? (
            <div style={{ padding:28 }}>
              <div style={{ fontSize:15, lineHeight:1.75, color:"#d0d0d8", marginBottom:32 }}>{activeAgent.bio}</div>
              <div style={{ marginBottom:24 }}>
                <div style={{ fontSize:10, color:"rgba(255,255,255,0.45)", marginBottom:10, letterSpacing:".5px" }}>SPECIALTIES</div>
                <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                  {(activeAgent.specialty||[]).map(s => (
                    <span key={s} style={{ padding:"5px 14px", background:`${color}22`, border:`0.5px solid ${color}44`, borderRadius:30, fontSize:12, color }}>{s}</span>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize:10, color:"rgba(255,255,255,0.45)", marginBottom:10, letterSpacing:".5px" }}>TRAITS</div>
                <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                  {(activeAgent.traits||[]).map(t => (
                    <span key={t} style={{ padding:"5px 14px", background:`${color}22`, border:`0.5px solid ${color}44`, borderRadius:30, fontSize:12, color }}>{t}</span>
                  ))}
                </div>
              </div>
              <div style={{ marginTop:40, padding:16, background:"rgba(255,255,255,0.02)", borderRadius:10, border:"0.5px solid rgba(255,255,255,0.08)" }}>
                <div style={{ fontSize:11, color:color, marginBottom:4 }}>CURRENT MODEL</div>
                <div style={{ fontSize:13 }}>{MODELS.find(m => m.id === activeAgent.model)?.label || activeAgent.model}</div>
              </div>
            </div>
          ) : (
            <ProfileSettings agent={activeAgent} onSave={handleSaveProfile} onCancel={() => setIsEditing(false)} />
          )}
        </div>
      </div>

      <style>{`
        .agent-page-scroll::-webkit-scrollbar{width:4px}
        .agent-page-scroll::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.12);border-radius:2px}
        .agent-page-scroll::-webkit-scrollbar-track{background:transparent}
        .agent-page-scroll{scrollbar-width:thin;scrollbar-color:rgba(255,255,255,0.12) transparent}
      `}</style>

      <div style={{ ...card, padding:14, display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
        {agents.map(a => (
          <button key={a.id} onClick={() => { setActiveAgent(a); setIsEditing(false); }}
            style={{ padding:"7px 18px", borderRadius:30, background: activeAgent.id === a.id ? `${a.color}22` : "rgba(255,255,255,0.03)", 
              border:`1px solid ${activeAgent.id === a.id ? a.color : "rgba(255,255,255,0.12)"}`, color: activeAgent.id === a.id ? a.color : "#aaa", fontSize:12.5, fontWeight:600, cursor:"pointer" }}>
            {a.name}
          </button>
        ))}
        <button onClick={() => setIsEditing(true)} style={{ marginLeft:"auto", padding:"8px 20px", borderRadius:8, background:`${color}22`, color, fontWeight:700, border:`0.5px solid ${color}44`, fontSize:13 }}>
          ⚙ EDIT {activeAgent.name.toUpperCase()}
        </button>
      </div>
    </div>
  );
}