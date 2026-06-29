import React, { useState, useEffect, useRef, useCallback } from "react";
import { getKranos } from "@/lib/agents/kranos/Kranos";

const K = {
  bg: "#0d0e17", panel: "#13141f", border: "rgba(255,255,255,0.07)",
  purple: "#8a64ff", gold: "#f0a832", red: "#ff4f5e", teal: "#00c896",
  blue: "#4ab3f4", orange: "#ff8c42",
  text: "#f0ede8", sub: "#6aaedd", dim: "#666", card: "#13141f",
};

const PERM_COLORS = { safe: K.teal, confirm: K.gold, restricted: K.red };

const MODELS = [
  { id:"auto",     label:"Auto (best available)" },
  { id:"claude",   label:"Claude Sonnet"         },
  { id:"openai",   label:"GPT-4o"                },
  { id:"grok",     label:"Grok (xAI)"            },
  { id:"groq",     label:"Groq (fast)"           },
  { id:"deepseek", label:"DeepSeek R1"           },
  { id:"gemini",   label:"Gemini 2.0"            },
  
  { id:"cf_free",  label:"Cloudflare Free"       },
];

const DEFAULT_IDENTITY = {
  name: "Kranos",
  role: "Autonomous AI Coworker — execution, files, browser, media",
  personality: "Strategic, direct, autonomous. Gets things done without hand-holding.",
  instructions: [
    "Always use tools when available rather than just talking about it",
    "Ask for permission before writing or deleting files",
    "When taking over a browser, narrate each step clearly",
    "Store important decisions and outcomes to memory automatically",
  ],
};

function loadIdentity() {
  try { return JSON.parse(localStorage.getItem("kranos_identity") || "null") || DEFAULT_IDENTITY; } catch { return DEFAULT_IDENTITY; }
}
function saveIdentity(id) { try { localStorage.setItem("kranos_identity", JSON.stringify(id)); } catch {} }
function loadModel() { try { return localStorage.getItem("kranos_model") || "auto"; } catch { return "auto"; } }
function saveModel(m) { try { localStorage.setItem("kranos_model", m); } catch {} }

export default function KranosPanel() {
  const [messages, setMessages]   = useState([]);
  const [input, setInput]         = useState("");
  const [thinking, setThinking]   = useState(false);
  const [permMode, setPermMode]   = useState("default");
  const [rightTab, setRightTab]   = useState("tools");
  const [settingsTab, setSettingsTab] = useState("identity");
  const [steps, setSteps]         = useState([]);
  const [report, setReport]       = useState(null);
  const [identity, setIdentity]   = useState(loadIdentity);
  const [model, setModel]         = useState(loadModel);
  const [newInstr, setNewInstr]   = useState("");
  const [saved, setSaved]         = useState(false);
  const agentRef  = useRef(null);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  useEffect(() => {
    agentRef.current = getKranos();
    setReport(agentRef.current.getIntelligenceReport());
    const id = loadIdentity();
    setMessages([{
      role: "assistant",
      content: `⚔️ ${id.name} online.\n\nCapabilities: read/write files on your PC, take over browser sessions, search the web, generate images/video/audio, manage goals and decisions.\n\nWhat do you need executed?`,
      ts: Date.now()
    }]);
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const saveSettings = () => {
    saveIdentity(identity);
    saveModel(model);
    if (agentRef.current) {
      agentRef.current.identity = identity.name;
      agentRef.current.config = { ...agentRef.current.config, model };
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const factoryReset = () => {
    if (!window.confirm("Factory reset Kranos? All memory, goals, and decisions will be cleared.")) return;
    ["kranos_identity","kranos_model","kranos_decisions","kranos_goals","kranos_patterns",
     "kranos_preferences","kranos_feedback","agent_memory"].forEach(k => localStorage.removeItem(k));
    setIdentity(DEFAULT_IDENTITY);
    setModel("auto");
    agentRef.current = getKranos();
    setReport(agentRef.current.getIntelligenceReport());
    setMessages([{ role:"assistant", content:"⚔️ Kranos has been reset. Fresh start.", ts: Date.now() }]);
  };

  const send = useCallback(async (text) => {
    const msg = (text || input).trim();
    if (!msg || thinking) return;
    setInput("");
    setMessages(m => [...m, { role:"user", content:msg, ts:Date.now() }]);
    setThinking(true);
    setSteps([]);
    try {
      const agent = agentRef.current;
      const id = loadIdentity();
      const result = await agent.think(msg, { permMode, identity: id, model: loadModel() });
      if (result.toolResults?.length) {
        setSteps(result.toolResults.map(tr => ({
          tool: tr.tool,
          result: JSON.stringify(tr.result).slice(0, 300),
          ts: Date.now()
        })));
        setRightTab("logs");
      }
      setMessages(m => [...m, {
        role: "assistant",
        content: result.response || result.error || "Done.",
        model: result.model,
        provider: result.provider,
        toolCount: result.toolResults?.length || 0,
        ts: Date.now()
      }]);
      setReport(agent.getIntelligenceReport());
    } catch (e) {
      setMessages(m => [...m, { role:"assistant", content:"Error: " + e.message, ts:Date.now() }]);
    }
    setThinking(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [input, thinking, permMode]);

  const handleKey = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } };

  const agent = agentRef.current;
  const tools = agent ? Array.from(agent.tools.values()) : [];
  const PERMS = ["default", "ask", "restricted"];
  const permColor = permMode === "default" ? K.teal : permMode === "ask" ? K.gold : K.red;

  const inputStyle = {
    width:"100%", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.1)",
    borderRadius:7, padding:"8px 10px", color:K.text, fontSize:12, outline:"none",
    fontFamily:"inherit", boxSizing:"border-box",
  };
  const taStyle = { ...inputStyle, resize:"vertical" };

  return (
    <div style={{ display:"flex", height:"100vh", background:K.bg, color:K.text, fontFamily:"system-ui", overflow:"hidden" }}>

      {/* ── LEFT: Chat ── */}
      <div style={{ flex:"0 0 60%", display:"flex", flexDirection:"column", borderRight:`0.5px solid ${K.border}` }}>
        {/* Header */}
        <div style={{ padding:"14px 20px", borderBottom:`0.5px solid ${K.border}`, display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <span style={{ fontSize:22 }}>⚔️</span>
            <div>
              <div style={{ fontWeight:800, fontSize:15, color:K.purple }}>KRANOS AGENT</div>
              <div style={{ fontSize:10, color:K.sub, letterSpacing:".08em" }}>AUTONOMOUS · FILES · BROWSER · MEDIA</div>
            </div>
          </div>
          <div style={{ display:"flex", gap:4 }}>
            {PERMS.map(p => (
              <button key={p} onClick={() => setPermMode(p)} style={{
                padding:"4px 10px", borderRadius:20, fontSize:10, fontWeight:700, cursor:"pointer", textTransform:"uppercase",
                background: permMode===p ? `${permColor}22` : "rgba(255,255,255,0.04)",
                border:`0.5px solid ${permMode===p ? permColor : K.border}`,
                color: permMode===p ? permColor : K.dim,
              }}>{p}</button>
            ))}
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex:1, overflowY:"auto", padding:"16px 20px", display:"flex", flexDirection:"column", gap:12 }}>
          {messages.map((m, i) => (
            <div key={i} style={{ display:"flex", justifyContent:m.role==="user"?"flex-end":"flex-start" }}>
              <div style={{
                maxWidth:"82%", padding:"10px 14px", borderRadius:12, fontSize:13, lineHeight:1.6,
                background: m.role==="user" ? `${K.purple}22` : "rgba(255,255,255,0.04)",
                border:`0.5px solid ${m.role==="user" ? K.purple+"44" : K.border}`,
                color:K.text, whiteSpace:"pre-wrap",
              }}>
                {m.content}
                {m.toolCount > 0 && (
                  <div style={{ marginTop:6, fontSize:10, color:K.gold }}>⚙ {m.toolCount} tool{m.toolCount>1?"s":""} used · {m.provider||""}</div>
                )}
              </div>
            </div>
          ))}
          {thinking && (
            <div style={{ display:"flex", gap:10, alignItems:"center" }}>
              <div style={{ width:8, height:8, borderRadius:"50%", background:K.purple, animation:"kpulse 1s infinite" }} />
              <span style={{ fontSize:12, color:K.sub }}>Kranos is working…</span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Quick prompts */}
        {messages.length <= 1 && (
          <div style={{ padding:"0 20px 10px", display:"flex", flexWrap:"wrap", gap:6, flexShrink:0 }}>
            {[
              "Read a file from my computer",
              "Take over my browser — go to LinkedIn",
              "Search the web for CEO GPS competitors",
              "Write a report file to my desktop",
              "Generate an image of a futuristic HQ",
              "Show my active goals",
            ].map(p => (
              <button key={p} onClick={() => send(p)} style={{
                padding:"5px 12px", borderRadius:20, fontSize:11, cursor:"pointer",
                background:"rgba(138,100,255,0.1)", border:`0.5px solid ${K.purple}44`, color:K.sub,
              }}>{p}</button>
            ))}
          </div>
        )}

        {/* Input */}
        <div style={{ padding:"12px 20px", borderTop:`0.5px solid ${K.border}`, display:"flex", gap:10, flexShrink:0 }}>
          <textarea ref={inputRef} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={handleKey}
            placeholder="Tell Kranos what to do… (Enter to send)" rows={2}
            style={{ flex:1, background:"rgba(255,255,255,0.04)", border:`0.5px solid ${K.border}`,
              borderRadius:10, padding:"10px 14px", color:K.text, fontSize:13, resize:"none", outline:"none", fontFamily:"inherit" }} />
          <button onClick={() => send()} disabled={thinking||!input.trim()} style={{
            padding:"10px 18px", borderRadius:10, fontWeight:700, fontSize:13, cursor:"pointer",
            background: thinking ? "rgba(255,255,255,0.04)" : `${K.purple}33`,
            border:`0.5px solid ${thinking?K.border:K.purple}`, color: thinking?K.dim:K.purple,
          }}>{thinking?"…":"▶"}</button>
        </div>
      </div>

      {/* ── RIGHT: Console ── */}
      <div style={{ flex:"0 0 40%", display:"flex", flexDirection:"column" }}>
        {/* Tab bar */}
        <div style={{ display:"flex", borderBottom:`0.5px solid ${K.border}`, flexShrink:0 }}>
          {["tools","settings","memory","logs"].map(tab => (
            <button key={tab} onClick={() => setRightTab(tab)} style={{
              flex:1, padding:"12px 6px", background:"transparent", border:"none",
              borderBottom: rightTab===tab ? `2px solid ${K.purple}` : "2px solid transparent",
              color: rightTab===tab ? K.purple : K.dim, fontWeight:700, fontSize:10,
              textTransform:"uppercase", letterSpacing:".08em", cursor:"pointer",
            }}>{tab}</button>
          ))}
        </div>

        <div style={{ flex:1, overflowY:"auto", padding:16 }}>

          {/* ── TOOLS TAB ── */}
          {rightTab==="tools" && (
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {tools.map(t => (
                <div key={t.name} style={{ padding:"10px 12px", borderRadius:8, background:"rgba(255,255,255,0.03)", border:`0.5px solid ${K.border}` }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <span style={{ fontSize:12, fontWeight:700, color:K.text }}>{t.name}</span>
                    <span style={{ fontSize:9, fontWeight:700, padding:"2px 7px", borderRadius:20,
                      color:PERM_COLORS[t.permission]||K.sub,
                      background:`${PERM_COLORS[t.permission]||K.sub}18`,
                      border:`0.5px solid ${PERM_COLORS[t.permission]||K.sub}44`,
                    }}>{t.permission}</span>
                  </div>
                  <div style={{ fontSize:11, color:K.sub, marginTop:3 }}>{t.description}</div>
                </div>
              ))}
            </div>
          )}

          {/* ── SETTINGS TAB ── */}
          {rightTab==="settings" && (
            <div>
              {/* Settings sub-nav */}
              <div style={{ display:"flex", gap:3, marginBottom:14, flexWrap:"wrap" }}>
                {["identity","instructions","model","monitor"].map(s => (
                  <button key={s} onClick={() => setSettingsTab(s)} style={{
                    padding:"4px 10px", borderRadius:6, border:"none", cursor:"pointer",
                    fontSize:10, fontWeight:settingsTab===s?700:400, textTransform:"uppercase", letterSpacing:".05em",
                    background: settingsTab===s ? `${K.purple}22` : "transparent",
                    color: settingsTab===s ? K.purple : K.dim,
                  }}>{s}</button>
                ))}
              </div>

              {/* Identity */}
              {settingsTab==="identity" && (
                <div>
                  <div style={{ fontSize:11, color:K.sub, marginBottom:12 }}>Kranos's core persona and role. Becomes the system prompt.</div>
                  {[
                    { key:"name",        label:"Name",        rows:1 },
                    { key:"role",        label:"Role",        rows:2 },
                    { key:"personality", label:"Personality", rows:3 },
                  ].map(f => (
                    <div key={f.key} style={{ marginBottom:12 }}>
                      <div style={{ fontSize:10, color:K.dim, marginBottom:4, textTransform:"uppercase", letterSpacing:".06em" }}>{f.label}</div>
                      {f.rows > 1
                        ? <textarea value={identity[f.key]||""} onChange={e=>setIdentity(id=>({...id,[f.key]:e.target.value}))} rows={f.rows} style={taStyle} />
                        : <input value={identity[f.key]||""} onChange={e=>setIdentity(id=>({...id,[f.key]:e.target.value}))} style={inputStyle} />
                      }
                    </div>
                  ))}
                </div>
              )}

              {/* Instructions */}
              {settingsTab==="instructions" && (
                <div>
                  <div style={{ fontSize:11, color:K.sub, marginBottom:12 }}>Rules Kranos follows in every session.</div>
                  {(identity.instructions||[]).map((inst, i) => (
                    <div key={i} style={{ display:"flex", gap:8, marginBottom:8, alignItems:"flex-start" }}>
                      <div style={{ fontSize:11, color:K.dim, marginTop:8, minWidth:16 }}>{i+1}.</div>
                      <input value={inst} onChange={e => setIdentity(id => {
                        const n = [...(id.instructions||[])]; n[i]=e.target.value; return {...id,instructions:n};
                      })} style={{ ...inputStyle, flex:1 }} />
                      <button onClick={() => setIdentity(id => ({...id, instructions:(id.instructions||[]).filter((_,j)=>j!==i)}))}
                        style={{ background:"none", border:"none", color:K.red, cursor:"pointer", fontSize:16, marginTop:4 }}>×</button>
                    </div>
                  ))}
                  <div style={{ display:"flex", gap:8, marginTop:8 }}>
                    <input value={newInstr} onChange={e=>setNewInstr(e.target.value)}
                      onKeyDown={e=>{if(e.key==="Enter"&&newInstr.trim()){setIdentity(id=>({...id,instructions:[...(id.instructions||[]),newInstr.trim()]}));setNewInstr("");}}}
                      placeholder="Add instruction…" style={{ ...inputStyle, flex:1, border:`1px solid ${K.purple}44` }} />
                    <button onClick={()=>{if(newInstr.trim()){setIdentity(id=>({...id,instructions:[...(id.instructions||[]),newInstr.trim()]}));setNewInstr("");}}}
                      style={{ background:K.purple, border:"none", borderRadius:7, padding:"7px 14px", color:"#fff", fontWeight:700, fontSize:13, cursor:"pointer" }}>+</button>
                  </div>
                </div>
              )}

              {/* Model */}
              {settingsTab==="model" && (
                <div>
                  <div style={{ fontSize:11, color:K.sub, marginBottom:12 }}>LLM that powers Kranos. Keys set in Integrations.</div>
                  {MODELS.map(m => (
                    <div key={m.id} onClick={()=>setModel(m.id)} style={{
                      display:"flex", alignItems:"center", gap:10, marginBottom:8, padding:"10px 12px",
                      background: model===m.id ? `${K.purple}22` : K.card,
                      borderRadius:8, cursor:"pointer",
                      border:`1px solid ${model===m.id ? K.purple+"55" : "rgba(255,255,255,0.06)"}`,
                    }}>
                      <div style={{ width:14, height:14, borderRadius:"50%",
                        border:`2px solid ${model===m.id?K.purple:"rgba(255,255,255,0.2)"}`,
                        background:model===m.id?K.purple:"transparent", flexShrink:0 }} />
                      <span style={{ fontSize:12, color:model===m.id?K.text:K.sub }}>{m.label}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Monitor */}
              {settingsTab==="monitor" && report && (
                <div>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:16 }}>
                    {[
                      { label:"Memory",    value:`${report.memorySize} msgs`,    color:K.blue   },
                      { label:"Goals",     value:report.activeGoals,             color:K.teal   },
                      { label:"Decisions", value:report.decisions,               color:K.purple },
                      { label:"Patterns",  value:report.patterns,                color:K.gold   },
                      { label:"Feedback",  value:report.feedback,                color:K.orange },
                      { label:"Model",     value:model,                          color:K.purple },
                    ].map((s,i) => (
                      <div key={i} style={{ background:"rgba(255,255,255,0.03)", borderRadius:8, padding:"8px 12px", minWidth:100, border:`0.5px solid ${K.border}` }}>
                        <div style={{ fontSize:9, color:K.dim, textTransform:"uppercase", letterSpacing:".06em" }}>{s.label}</div>
                        <div style={{ fontSize:14, fontWeight:700, color:s.color, marginTop:2 }}>{s.value}</div>
                      </div>
                    ))}
                  </div>
                  <button onClick={factoryReset} style={{
                    width:"100%", padding:"9px", borderRadius:8, background:"rgba(255,79,94,0.1)",
                    border:`0.5px solid ${K.red}44`, color:K.red, fontWeight:700, fontSize:12, cursor:"pointer",
                  }}>⚠ Factory Reset</button>
                </div>
              )}

              {/* Save */}
              {settingsTab !== "monitor" && (
                <button onClick={saveSettings} style={{
                  marginTop:16, width:"100%", padding:"10px", borderRadius:8, fontWeight:700, fontSize:13, cursor:"pointer",
                  background:`${K.purple}22`, border:`0.5px solid ${K.purple}`,
                  color: saved ? K.teal : K.purple,
                }}>{saved ? "✓ Saved" : "Save Settings"}</button>
              )}
            </div>
          )}

          {/* ── MEMORY TAB ── */}
          {rightTab==="memory" && report && (
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              <div style={{ fontSize:11, fontWeight:700, color:K.purple, letterSpacing:".08em", marginBottom:4 }}>INTELLIGENCE REPORT</div>
              {Object.entries(report).map(([k,v]) => (
                <div key={k} style={{ display:"flex", justifyContent:"space-between", padding:"8px 12px", borderRadius:8, background:"rgba(255,255,255,0.03)", border:`0.5px solid ${K.border}` }}>
                  <span style={{ fontSize:12, color:K.sub, textTransform:"capitalize" }}>{k.replace(/([A-Z])/g," $1")}</span>
                  <span style={{ fontSize:13, fontWeight:700, color:K.gold }}>{v}</span>
                </div>
              ))}
            </div>
          )}

          {/* ── LOGS TAB ── */}
          {rightTab==="logs" && (
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {steps.length===0
                ? <div style={{ fontSize:12, color:K.dim, textAlign:"center", marginTop:40 }}>No tool calls yet</div>
                : steps.map((s,i) => (
                  <div key={i} style={{ padding:"10px 12px", borderRadius:8, background:"rgba(255,255,255,0.03)", border:`0.5px solid ${K.border}` }}>
                    <div style={{ fontSize:11, fontWeight:700, color:K.gold }}>⚙ {s.tool}</div>
                    <div style={{ fontSize:11, color:K.sub, marginTop:3, fontFamily:"monospace", wordBreak:"break-all" }}>{s.result}</div>
                  </div>
                ))
              }
            </div>
          )}
        </div>

        {/* Footer stats */}
        {report && (
          <div style={{ padding:"10px 16px", borderTop:`0.5px solid ${K.border}`, display:"flex", gap:16, flexWrap:"wrap", flexShrink:0 }}>
            {[["🧠",report.memorySize,"mem"],["🎯",report.activeGoals,"goals"],["⚡",report.decisions,"dec"],["📊",report.patterns,"pat"]].map(([icon,val,label]) => (
              <div key={label} style={{ display:"flex", alignItems:"center", gap:5 }}>
                <span style={{ fontSize:12 }}>{icon}</span>
                <span style={{ fontSize:13, fontWeight:700, color:K.gold }}>{val}</span>
                <span style={{ fontSize:10, color:K.dim }}>{label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`@keyframes kpulse{0%,100%{opacity:1}50%{opacity:.3}}`}</style>
    </div>
  );
}
