import { useState, useEffect, useRef } from "react";
import { invokeLLMWithAuth } from "@/api/ceogpsclient.jsx";
import { useWorkerAuth } from "@/contexts/WorkerContext";
import Icon from "@/components/lifeos/icons/Icon";

// CRITICAL: Never hardcode API tokens in frontend code.
// These must be stored as Cloudflare Worker secrets and proxied through your API.
// The frontend calls your worker, which then calls Cloudflare API with the secret.
const WORKER_URL = import.meta.env.VITE_WORKER_URL || "https://api.lifeos1.ceogps.com";

// Remove hardcoded secrets - these will be handled by the worker
// The worker has CF_API_TOKEN and MAKE_API_KEY as secrets

const C = { blue:"#4ab3f4", orange:"#ff8c42", teal:"#00c896", purple:"#8b7fff", pink:"#ff6b9d", red:"#ff4f5e" };
const card  = { background:"#13141f", border:"0.5px solid rgba(255,255,255,0.07)", borderRadius:12 };
const inputS = { width:"100%", padding:"9px 12px", borderRadius:8, border:"0.5px solid rgba(255,255,255,0.12)", background:"#0a0b14", color:"#f0ede8", fontSize:13, outline:"none", boxSizing:"border-box" };

// All Cloudflare API calls now route through your worker with server-side secrets
async function cfApiViaWorker(path, method = "GET", body = null) {
  try {
    const opts = {
      method: method,
      headers: { "Content-Type": "application/json" }
    };
    if (body) opts.body = JSON.stringify(body);
    
    const response = await fetch(`${WORKER_URL}/api/cloudflare${path}`, opts);
    return await response.json();
  } catch (error) {
    return { success: false, errors: [{ message: error.message }] };
  }
}

async function listWorkers() { return cfApiViaWorker("/workers"); }
async function deleteWorker(name) { return cfApiViaWorker(`/workers/${name}`, "DELETE"); }
async function listKVNamespaces() { return cfApiViaWorker("/kv/namespaces"); }
async function listR2Buckets() { return cfApiViaWorker("/r2/buckets"); }
async function getZoneAnalytics() { return cfApiViaWorker("/analytics"); }

async function deployWorkerViaApi(name, script) {
  const response = await fetch(`${WORKER_URL}/api/cloudflare/workers/deploy`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, script })
  });
  return await response.json();
}

async function interpretCommandWithAuth(input, context, firebaseToken) {
  const systemPrompt = `You are the LifeOS1 Cloudflare Command Center AI for Chris Green's plumbing business.
Interpret the natural language command and return ONLY a JSON action object. No markdown, no explanation.

Available actions:
{ "action": "deploy_worker", "name": "worker-name", "script": "...complete ES module worker code..." }
{ "action": "list_workers" }
{ "action": "delete_worker", "name": "worker-name" }
{ "action": "list_kv" }
{ "action": "list_r2" }
{ "action": "analytics" }
{ "action": "chat", "response": "...helpful answer..." }

Workers MUST use: export default { async fetch(request, env, ctx) { ... } }
Always include CORS headers. Generate complete, working code.
Return ONLY valid JSON.`;

  const result = await invokeLLMWithAuth({
    prompt: "Context: " + JSON.stringify(context) + "\n\nCommand: " + input,
    systemPrompt: systemPrompt,
    firebaseToken: firebaseToken
  });
  
  try { 
    return JSON.parse(result.replace(/```json|```/g, "").trim()); 
  } catch {
    return { action: "chat", response: result };
  }
}

// Make.com calls now route through worker
async function makeCallViaWorker(path, method = "GET", body = null) {
  try {
    const opts = {
      method: method,
      headers: { "Content-Type": "application/json" }
    };
    if (body) opts.body = JSON.stringify(body);
    
    const response = await fetch(`${WORKER_URL}/api/make${path}`, opts);
    return await response.json();
  } catch (error) {
    return { error: error.message };
  }
}

const PRESET_AGENTS = [
  { id:"lead-scout",     emoji:"🔍", name:"Lead Scout",         desc:"Monitors web signals for marketing leads in Atlanta.",      triggers:"Every 4h",        color:C.teal,   workerName:"lifeos1-lead-scout" },
  { id:"reply-bot",      emoji:"💬", name:"Review Reply Bot",   desc:"Auto-drafts replies to Google & Yelp reviews via AI.",      triggers:"On webhook",      color:C.blue,   workerName:"lifeos1-reply-bot" },
  { id:"invoice-chaser", emoji:"💸", name:"Invoice Chaser",     desc:"Sends payment reminders for overdue invoices via Telegram.", triggers:"3 days overdue",  color:C.orange, workerName:"lifeos1-invoice-chaser" },
  { id:"social-poster",  emoji:"📱", name:"Social Scheduler",   desc:"Schedules and posts content to Instagram and Facebook.",    triggers:"Manual/Schedule", color:C.purple, workerName:"lifeos1-social-poster" },
  { id:"content-ai",     emoji:"✨", name:"Content AI",         desc:"Generates marketing copy and social captions on demand.",   triggers:"On request",      color:C.pink,   workerName:"lifeos1-content-ai" },
];

export default function CloudflarePanel() {
  const { getToken, isAuthenticated } = useWorkerAuth();
  const [tab, setTab] = useState("command");
  const [agents, setAgents] = useState(PRESET_AGENTS);
  const [logs, setLogs] = useState(() => {
    try { return JSON.parse(localStorage.getItem("lifeos_cf_logs") || "[]"); } catch { return []; }
  });
  const [makeScenarios, setMakeScenarios] = useState([]);
  const [makeLoading, setMakeLoading] = useState(false);
  const [deployingId, setDeployingId] = useState(null);
  const [agentStatuses, setAgentStatuses] = useState(() => {
    try { return JSON.parse(localStorage.getItem("lifeos_agent_statuses") || "{}"); } catch { return {}; }
  });

  useEffect(() => { loadMakeScenarios(); }, []);

  async function loadMakeScenarios() {
    const token = await getToken();
    if (!token) return;
    
    setMakeLoading(true);
    const data = await makeCallViaWorker("/scenarios?teamId=0&isActive=true");
    if (data?.scenarios) setMakeScenarios(data.scenarios);
    else if (data?.response?.scenarios) setMakeScenarios(data.response.scenarios);
    setMakeLoading(false);
  }

  function addLog(agent, msg, color) {
    const entry = { agent, msg, time: new Date().toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" }), color };
    setLogs(prev => {
      const updated = [entry, ...prev].slice(0, 100);
      localStorage.setItem("lifeos_cf_logs", JSON.stringify(updated));
      return updated;
    });
  }

  async function deployAgent(agent) {
    const token = await getToken();
    if (!token) {
      addLog(agent.name, "Authentication required. Please log in.", C.red);
      return;
    }
    
    setDeployingId(agent.id);
    const script = generateAgentScript(agent);
    const result = await deployWorkerViaApi(agent.workerName, script);
    
    if (result?.success) {
      setAgentStatuses(prev => {
        const updated = { ...prev, [agent.id]: "Running" };
        localStorage.setItem("lifeos_agent_statuses", JSON.stringify(updated));
        return updated;
      });
      addLog(agent.name, `Deployed worker: ${agent.workerName}`, agent.color);
    } else {
      addLog(agent.name, `Deploy failed: ${result?.errors?.[0]?.message || "Unknown error"}`, C.red);
    }
    setDeployingId(null);
  }

  async function toggleAgent(agent) {
    const token = await getToken();
    if (!token) {
      addLog(agent.name, "Authentication required. Please log in.", C.red);
      return;
    }
    
    const current = agentStatuses[agent.id] || "Idle";
    const next = current === "Running" ? "Paused" : "Running";
    setAgentStatuses(prev => {
      const updated = { ...prev, [agent.id]: next };
      localStorage.setItem("lifeos_agent_statuses", JSON.stringify(updated));
      return updated;
    });
    addLog(agent.name, `${next === "Running" ? "▶ Resumed" : "⏸ Paused"} agent`, agent.color);
  }

  function generateAgentScript(agent) {
    return `// ${agent.name} — LifeOS1 Cloudflare Agent
export default {
  async fetch(request, env, ctx) {
    const cors = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" };
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    const url = new URL(request.url);
    if (url.pathname === "/run") {
      // Agent logic: ${agent.desc}
      const result = { agent: "${agent.name}", status: "ok", ran_at: new Date().toISOString(), message: "Agent executed successfully" };
      // Notify via Telegram
      if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
        await fetch(\`https://api.telegram.org/bot\${env.TELEGRAM_BOT_TOKEN}/sendMessage\`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: \`✅ ${agent.name} ran at \${result.ran_at}\` })
        });
      }
      return new Response(JSON.stringify(result), { headers: cors });
    }
    return new Response(JSON.stringify({ agent: "${agent.name}", status: "ready" }), { headers: cors });
  }
};`;
  }

  const tabs = [
    { id:"command", label:"⌨ Command Center" },
    { id:"workers", label:"☁ Workers" },
    { id:"infra",   label:"🗄 Infrastructure" },
    { id:"llm",     label:"🤖 LLM Playground" },
  ];

  return (
    <div style={{ padding:24, height:"calc(100vh - 52px)", display:"flex", flexDirection:"column", overflow:"hidden" }}>
      <div style={{ display:"flex", gap:4, marginBottom:20, background:"#13141f", borderRadius:10, padding:4, width:"fit-content", border:"0.5px solid rgba(255,255,255,0.07)", flexShrink:0 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ padding:"7px 16px", borderRadius:8, fontSize:12, fontWeight:600, cursor:"pointer", border:"none", background:tab===t.id?"rgba(74,179,244,0.18)":"transparent", color:tab===t.id?C.blue:"#6aaedd" }}>
            {t.label}
          </button>
        ))}
      </div>
      <div style={{ flex:1, overflow:"auto", minHeight:0 }}>
        {tab==="command" && <CommandCenter agents={agents} logs={logs} setLogs={setLogs} getToken={getToken} />}
        {tab==="workers" && <WorkersTab agents={agents} setAgents={setAgents} logs={logs} setLogs={setLogs} getToken={getToken} />}
        {tab==="infra"   && <InfraTab getToken={getToken} />}
        {tab==="llm"     && <LLMTab getToken={getToken} />}
      </div>
    </div>
  );
}

function CommandCenter({ agents, logs, setLogs, getToken }) {
  const [history, setHistory] = useState([
    { role:"assistant", content:"LifeOS1 Command Center online.\n\nI can:\n• Deploy Cloudflare Workers (just describe what you want)\n• List / delete your workers\n• Check KV namespaces, R2 buckets, zone analytics\n• Write complete worker scripts from a description\n\nTry: \"deploy a worker that returns Hello World\" or \"list my workers\" or \"create a lead capture form worker\"", time:new Date().toLocaleTimeString() }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:"smooth" }); }, [history]);

  const QUICK = ["List my workers","Show R2 buckets","Show KV namespaces","Deploy hello world worker","Zone analytics","Deploy a CORS proxy worker","Create a daily lead summary worker","Analyze my agent stack"];

  async function send(text) {
    const cmd = (text || input).trim();
    if (!cmd || loading) return;
    
    const token = await getToken();
    if (!token) {
      setHistory(h => [...h, { role:"assistant", content:"Authentication required. Please log in.", time:new Date().toLocaleTimeString() }]);
      return;
    }
    
    setInput("");
    setHistory(h => [...h, { role:"user", content:cmd, time:new Date().toLocaleTimeString() }]);
    setLoading(true);
    
    const action = await interpretCommandWithAuth(cmd, { agents:agents.map(a=>a.name) }, token);
    let reply = "";
    setExecuting(true);
    
    try {
      if (action.action === "list_workers") {
        const d = await listWorkers();
        reply = d.success && d.result?.length
          ? "✓ Your workers:\n" + d.result.map(w => "• " + w.id + " — modified " + (w.modified_on||"").slice(0,10)).join("\n")
          : "No workers found. " + JSON.stringify(d.errors||"");
      } else if (action.action === "deploy_worker" || action.action === "write_worker") {
        const name = action.name || "lifeos-worker";
        setHistory(h => [...h, { role:"assistant", content:"◈ Deploying " + name + "...", time:new Date().toLocaleTimeString() }]);
        const d = await deployWorkerViaApi(name, action.script || "export default { async fetch(req,env,ctx){return new Response('Hello!');} }");
        if (d.success !== false) {
          reply = "✓ Worker **" + name + "** deployed!\n\nScript preview:\n" + (action.script||"").slice(0,300);
          setLogs(l => [{ agent:"Command Center", msg:"Deployed: " + name, time:"Just now", color:C.teal }, ...l]);
        } else {
          reply = "Deploy attempted. API response: " + JSON.stringify(d.errors||d).slice(0,200) + "\n\n" + (action.script||"").slice(0,400);
        }
      } else if (action.action === "delete_worker") {
        const d = await deleteWorker(action.name);
        reply = d.success ? "✓ Deleted " + action.name : "Error: " + JSON.stringify(d.errors);
      } else if (action.action === "list_kv") {
        const d = await listKVNamespaces();
        reply = d.success && d.result?.length
          ? "✓ KV Namespaces:\n" + d.result.map(k => "• " + k.title + " (" + k.id + ")").join("\n")
          : "No KV namespaces. " + JSON.stringify(d.errors||"");
      } else if (action.action === "list_r2") {
        const d = await listR2Buckets();
        reply = d.success && d.result?.buckets?.length
          ? "✓ R2 Buckets:\n" + d.result.buckets.map(b => "• " + b.name).join("\n")
          : "No R2 buckets. " + JSON.stringify(d.errors||"");
      } else if (action.action === "analytics") {
        const d = await getZoneAnalytics();
        if (d.success) {
          const t = d.result?.totals;
          reply = "✓ Zone Analytics (24h):\n• Requests: " + (t?.requests?.all||0).toLocaleString() + "\n• Bandwidth: " + ((t?.bandwidth?.all||0)/1024/1024).toFixed(1) + " MB\n• Threats blocked: " + (t?.threats?.all||0) + "\n• Page views: " + (t?.pageviews?.all||0).toLocaleString();
        } else reply = "Analytics error: " + JSON.stringify(d.errors||d).slice(0,200);
      } else {
        reply = action.response || "Done.";
      }
    } catch(e) { reply = "Error: " + e.message; }
    setExecuting(false); setLoading(false);
    setHistory(h => [...h.filter(m => !m.content?.includes("◈ Deploying")), { role:"assistant", content:reply, time:new Date().toLocaleTimeString() }]);
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", gap:0 }}>
      <div style={{ ...card, padding:"8px 14px", marginBottom:12, display:"flex", alignItems:"center", gap:16, flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <div style={{ width:7, height:7, borderRadius:"50%", background:C.teal }} />
          <Icon name="CF API CONNECTED" size={10} />
        </div>
        <span style={{ fontSize:10, color:"#2a6fa8" }}>Worker URL: {import.meta.env.VITE_WORKER_URL || "https://api.lifeos1.ceogps.com"}</span>
        {executing && <Icon name="⟳ Calling API..." size={10} />}
      </div>
      <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginBottom:12, flexShrink:0 }}>
        {QUICK.map(c => (
          <button key={c} onClick={() => send(c)}
            style={{ padding:"3px 9px", borderRadius:20, background:"rgba(255,255,255,0.04)", border:"0.5px solid rgba(255,255,255,0.08)", color:"#6aaedd", fontSize:10, cursor:"pointer", whiteSpace:"nowrap" }}>
            {c}
          </button>
        ))}
      </div>
      <div style={{ flex:1, overflowY:"auto", display:"flex", flexDirection:"column", gap:10, marginBottom:12 }}>
        {history.map((msg,i) => (
          <div key={i} style={{ display:"flex", gap:10, alignItems:"flex-start", flexDirection:msg.role==="user"?"row-reverse":"row" }}>
            {msg.role==="assistant" && (
              <div style={{ width:28, height:28, borderRadius:"50%", background:"linear-gradient(135deg,"+C.blue+","+C.purple+")", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, flexShrink:0 }}><Icon name="◈" size={14} /></div>
            )}
            <div style={{ maxWidth:"80%", padding:"10px 14px", borderRadius:12, background:msg.role==="user"?"rgba(74,179,244,0.12)":"rgba(255,255,255,0.04)", border:"0.5px solid "+(msg.role==="user"?"rgba(74,179,244,0.3)":"rgba(255,255,255,0.07)") }}>
              <div style={{ fontSize:12, color:"#c8c8d0", lineHeight:1.7, whiteSpace:"pre-wrap" }}>{msg.content}</div>
              <div style={{ fontSize:9, color:"#2a6fa8", marginTop:4 }}>{msg.time}</div>
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display:"flex", gap:10, alignItems:"center" }}>
            <div style={{ width:28, height:28, borderRadius:"50%", background:"linear-gradient(135deg,"+C.blue+","+C.purple+")", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12 }}><Icon name="◈" size={14} /></div>
            <div style={{ padding:"10px 14px", borderRadius:12, background:"rgba(255,255,255,0.04)", border:"0.5px solid rgba(255,255,255,0.07)" }}>
              <span style={{ color:C.blue, fontSize:12 }}>◈ {executing?"Calling Cloudflare API...":"Interpreting command..."}</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div style={{ display:"flex", gap:8, flexShrink:0 }}>
        <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key==="Enter"&&!e.shiftKey&&(e.preventDefault(),send())}
          placeholder="Type a command... e.g. deploy a worker that sends daily plumbing lead summaries | list my workers | create a CORS proxy"
          rows={2} style={{ ...inputS, flex:1, resize:"none", lineHeight:1.5, fontSize:12 }} />
        <button onClick={() => send()} disabled={loading||!input.trim()}
          style={{ padding:"0 20px", borderRadius:10, background:"linear-gradient(135deg,"+C.blue+","+C.purple+")", border:"none", color:"white", fontSize:14, fontWeight:700, cursor:"pointer", opacity:(!input.trim()||loading)?0.5:1, flexShrink:0 }}><Icon name="↑" size={14} /></button>
      </div>
    </div>
  );
}

function WorkersTab({ agents, setAgents, logs, setLogs, getToken }) {
  const [liveWorkers, setLiveWorkers] = useState(null);
  const [fetching, setFetching] = useState(false);
  const [aiResult, setAiResult] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const statusColor = { Running:C.teal, Paused:C.orange, Idle:"#6aaedd" };

  async function fetchLive() {
    const token = await getToken();
    if (!token) return;
    
    setFetching(true);
    const d = await listWorkers();
    setLiveWorkers(d.success ? d.result : []);
    setFetching(false);
  }
  useEffect(() => { fetchLive(); }, []);

  function toggle(id) {
    const agent = agents.find(a => a.id===id);
    if (!agent) return;
    const ns = agent.status==="Running"?"Paused":"Running";
    setAgents(as => as.map(a => a.id===id?{...a,status:ns}:a));
    setLogs(l => [{ agent:agent.name, msg:"Agent "+(ns==="Running"?"activated":"paused"), time:"Just now", color:agent.color }, ...l]);
  }

  async function analyze() {
    const token = await getToken();
    if (!token) {
      setAiResult("Authentication required. Please log in.");
      return;
    }
    
    setAiLoading(true); 
    setAiResult("");
    
    const result = await invokeLLMWithAuth({
      prompt: "AgentZero — analyze this automation stack for Chris Green plumbing business Atlanta.\nAgents:\n"+agents.map(a=>a.name+" ("+a.status+"): "+a.desc).join("\n")+"\nLive CF workers: "+(liveWorkers?.map(w=>w.id).join(", ")||"unknown")+"\n\nWhich should run now? Suggest 2 new high-value workers. Be specific with code examples.",
      firebaseToken: token
    });
    
    setAiResult(result); 
    setAiLoading(false);
  }

  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 300px", gap:20 }}>
      <div>
        <div style={{ ...card, padding:16, marginBottom:16 }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
            <div style={{ fontSize:13, fontWeight:700, color:"#f0ede8" }}><Icon name="🌐" size={12} style={{marginRight:6,verticalAlign:"middle"}} />Live Workers</div>
            <button onClick={fetchLive} disabled={fetching} style={{ padding:"3px 10px", borderRadius:20, background:"rgba(74,179,244,0.1)", border:"0.5px solid rgba(74,179,244,0.3)", color:C.blue, fontSize:10, cursor:"pointer" }}>{fetching?"⟳":"↻ Refresh"}</button>
          </div>
          {fetching ? <div style={{ fontSize:11, color:"#2a6fa8" }}>Loading from API...</div>
            : !liveWorkers || liveWorkers.length===0 ? <div style={{ fontSize:11, color:"#2a6fa8" }}>No live workers found. Use Command Center to deploy.</div>
            : liveWorkers.map(w => (
              <div key={w.id} style={{ padding:"8px 12px", borderRadius:8, background:"rgba(0,200,150,0.05)", border:"0.5px solid rgba(0,200,150,0.2)", display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:5 }}>
                <div>
                  <div style={{ fontSize:12, fontWeight:600, color:"#f0ede8" }}>{w.id}</div>
                  <div style={{ fontSize:10, color:"#2a6fa8" }}>Modified: {(w.modified_on||"").slice(0,10)}</div>
                </div>
                <span style={{ fontSize:10, color:C.teal, padding:"3px 8px", borderRadius:20, border:"0.5px solid "+C.teal+"44" }}>Deployed</span>
              </div>
            ))
          }
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:16 }}>
          {[{label:"Active",val:agents.filter(a=>a.status==="Running").length,color:C.teal},{label:"Total",val:agents.length,color:C.blue},{label:"Live Workers",val:liveWorkers?.length??"...",color:C.purple}].map(s=>(
            <div key={s.label} style={{ ...card, padding:14, textAlign:"center" }}>
              <div style={{ fontSize:22, fontWeight:800, color:s.color }}>{s.val}</div>
              <div style={{ fontSize:10, color:"#6aaedd", marginTop:3 }}>{s.label}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize:12, fontWeight:700, color:"#f0ede8", marginBottom:10 }}>Automation Agents</div>
        <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:14 }}>
          {agents.map(a => (
            <div key={a.id} style={{ ...card, padding:14 }}>
              <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                <div style={{ width:38, height:38, borderRadius:10, background:a.color+"22", display:"flex", alignItems:"center", justifyContent:"center", fontSize:17, flexShrink:0 }}>{a.emoji}</div>
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:2 }}>
                    <div style={{ fontSize:12, fontWeight:600, color:"#f0ede8" }}>{a.name}</div>
                    <span style={{ fontSize:9, padding:"2px 7px", borderRadius:20, background:statusColor[a.status]+"22", color:statusColor[a.status], fontWeight:700 }}>{a.status}</span>
                  </div>
                  <div style={{ fontSize:11, color:"#6aaedd" }}>{a.desc}</div>
                </div>
                <button onClick={() => toggle(a.id)} style={{ padding:"5px 12px", borderRadius:20, background:a.status==="Running"?"rgba(255,140,66,0.1)":"rgba(0,200,150,0.1)", border:"0.5px solid "+(a.status==="Running"?C.orange:C.teal)+"44", color:a.status==="Running"?C.orange:C.teal, fontSize:11, fontWeight:600, cursor:"pointer" }}>
                  {a.status==="Running"?"⏸":"▶"}
                </button>
              </div>
            </div>
          ))}
        </div>
        <button onClick={analyze} disabled={aiLoading} style={{ width:"100%", padding:10, borderRadius:10, background:"rgba(139,127,255,0.1)", border:"0.5px solid rgba(139,127,255,0.3)", color:C.purple, fontSize:12, fontWeight:600, cursor:"pointer" }}>
          {aiLoading?"◈ Analyzing...":"✦ Analyze & Optimize Agent Stack"}
        </button>
        {(aiResult||aiLoading) && (
          <div style={{ marginTop:12, padding:14, borderRadius:10, background:"rgba(139,127,255,0.06)", border:"0.5px solid rgba(139,127,255,0.2)", fontSize:13, color:"#c8c8d0", lineHeight:1.7, whiteSpace:"pre-wrap" }}>
            {aiLoading?<span style={{ color:C.purple }}><Icon name="◈" size={12} style={{marginRight:6,verticalAlign:"middle"}} />AgentZero analyzing...</span>:aiResult}
          </div>
        )}
      </div>
      <div>
        <div style={{ fontSize:12, fontWeight:600, color:"#f0ede8", marginBottom:10 }}><Icon name="📋" size={12} style={{marginRight:6,verticalAlign:"middle"}} />Activity Log</div>
        <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
          {logs.map((log,i) => (
            <div key={i} style={{ ...card, padding:"10px 12px" }}>
              <div style={{ fontSize:10, color:log.color, fontWeight:700, marginBottom:2 }}>{log.agent}</div>
              <div style={{ fontSize:12, color:"#c8c8d0", marginBottom:2 }}>{log.msg}</div>
              <div style={{ fontSize:10, color:"#2a6fa8" }}>{log.time}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function InfraTab({ getToken }) {
  const [data, setData] = useState({ kv:null, r2:null, analytics:null });
  const [loading, setLoading] = useState({ kv:false, r2:false, analytics:false });

  async function fetch_(key, fn) {
    const token = await getToken();
    if (!token) return;
    
    setLoading(l => ({...l,[key]:true}));
    const d = await fn();
    setData(dt => ({...dt,[key]:d}));
    setLoading(l => ({...l,[key]:false}));
  }
  useEffect(() => {
    fetch_("kv", listKVNamespaces);
    fetch_("r2", listR2Buckets);
    fetch_("analytics", getZoneAnalytics);
  }, []);

  return (
    <div>
      <div style={{ ...card, padding:18, marginBottom:16, border:"0.5px solid rgba(0,200,150,0.2)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
          <div style={{ fontSize:13, fontWeight:700, color:"#f0ede8" }}><Icon name="🗃" size={12} style={{marginRight:6,verticalAlign:"middle"}} />Supabase</div>
          <div style={{ width:7, height:7, borderRadius:"50%", background:C.teal }} />
          <Icon name="Connected" size={10} />
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10 }}>
          {[{l:"URL",v:"mhvcdstgkyplhzjptgfr.supabase.co",c:C.blue},{l:"Tables",v:"crm_contacts, profiles...",c:C.teal},{l:"Region",v:"us-east-1 (AWS)",c:C.purple}].map(s=>(
            <div key={s.l} style={{ padding:"10px 12px", borderRadius:8, background:"rgba(255,255,255,0.03)" }}>
              <div style={{ fontSize:9, color:"#2a6fa8", marginBottom:3, fontWeight:600 }}>{s.l}</div>
              <div style={{ fontSize:11, color:s.c }}>{s.v}</div>
            </div>
          ))}
        </div>
      </div>
      {[
        { key:"kv", title:"📦 KV Namespaces", color:C.orange, render:(d)=> d?.success&&d.result?.length ? d.result.map(ns=><div key={ns.id} style={{padding:"7px 10px",borderRadius:7,background:"rgba(255,140,66,0.05)",marginBottom:4,display:"flex",justifyContent:"space-between"}}><span style={{fontSize:12,color:"#f0ede8"}}>{ns.title}</span><span style={{fontSize:10,color:"#2a6fa8"}}>{(ns.id||"").slice(0,16)}...</span></div>) : <div style={{fontSize:11,color:"#2a6fa8"}}>{d?.success===false?"Error: "+JSON.stringify(d.errors):"No KV namespaces yet"}</div> },
        { key:"r2", title:"🪣 R2 Buckets", color:C.purple, render:(d)=> d?.success&&d.result?.buckets?.length ? d.result.buckets.map(b=><div key={b.name} style={{padding:"7px 10px",borderRadius:7,background:"rgba(139,127,255,0.05)",marginBottom:4,display:"flex",justifyContent:"space-between"}}><span style={{fontSize:12,color:"#f0ede8"}}>{b.name}</span><span style={{fontSize:10,color:"#2a6fa8"}}>{(b.creation_date||"").slice(0,10)}</span></div>) : <div style={{fontSize:11,color:"#2a6fa8"}}>{d?.success===false?"Error: "+JSON.stringify(d.errors):"No R2 buckets yet"}</div> },
      ].map(s => (
        <div key={s.key} style={{ ...card, padding:18, marginBottom:14 }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
            <div style={{ fontSize:13, fontWeight:700, color:"#f0ede8" }}>{s.title}</div>
            <button onClick={() => fetch_(s.key, s.key==="kv"?listKVNamespaces:listR2Buckets)} disabled={loading[s.key]}
              style={{ padding:"3px 10px", borderRadius:20, background:s.color+"15", border:"0.5px solid "+s.color+"44", color:s.color, fontSize:10, cursor:"pointer" }}>
              {loading[s.key]?"⟳":"↻"}
            </button>
          </div>
          {loading[s.key] ? <div style={{fontSize:11,color:"#2a6fa8"}}>Loading...</div> : s.render(data[s.key])}
        </div>
      ))}
      <div style={{ ...card, padding:18 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
          <div style={{ fontSize:13, fontWeight:700, color:"#f0ede8" }}><Icon name="📊" size={12} style={{marginRight:6,verticalAlign:"middle"}} />Zone Analytics (24h)</div>
          <button onClick={() => fetch_("analytics",getZoneAnalytics)} disabled={loading.analytics}
            style={{ padding:"3px 10px", borderRadius:20, background:C.blue+"15", border:"0.5px solid "+C.blue+"44", color:C.blue, fontSize:10, cursor:"pointer" }}>
            {loading.analytics?"⟳":"↻"}
          </button>
        </div>
        {loading.analytics ? <div style={{fontSize:11,color:"#2a6fa8"}}>Loading...</div>
          : data.analytics?.success ? (() => { const t = data.analytics.result?.totals; return (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10 }}>
              {[{l:"Requests",v:(t?.requests?.all||0).toLocaleString(),c:C.blue},{l:"Bandwidth",v:((t?.bandwidth?.all||0)/1024/1024).toFixed(1)+" MB",c:C.teal},{l:"Threats",v:(t?.threats?.all||0).toString(),c:C.red},{l:"Page Views",v:(t?.pageviews?.all||0).toLocaleString(),c:C.purple}].map(s=>(
                <div key={s.l} style={{ ...card, padding:"12px 14px", textAlign:"center" }}>
                  <div style={{ fontSize:18, fontWeight:800, color:s.c }}>{s.v}</div>
                  <div style={{ fontSize:10, color:"#6aaedd", marginTop:3 }}>{s.l}</div>
                </div>
              ))}
            </div>
          ); })()
          : <div style={{fontSize:11,color:"#2a6fa8"}}>{data.analytics?.success===false?"Error: "+JSON.stringify(data.analytics?.errors):"No analytics data"}</div>
        }
      </div>
    </div>
  );
}

function LLMTab({ getToken }) {
  const MODELS = [
    { id:"claude_sonnet", label:"Claude Sonnet 4", note:"Live ✓ — balanced reasoning" },
    { id:"gpt-4",         label:"GPT-4",           note:"Add OpenAI key to enable" },
    { id:"gemini",        label:"Gemini Flash",    note:"Add Google key to enable" },
    { id:"groq_llama",    label:"Llama 3 (Groq)",  note:"Add Groq key to enable" },
  ];
  const [model, setModel] = useState("claude_sonnet");
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);
  
  async function send() {
    if (!prompt.trim() || loading) return;
    
    const token = await getToken();
    if (!token) {
      setResponse("Authentication required. Please log in.");
      return;
    }
    
    setLoading(true);
    setResponse("");
    
    const result = await invokeLLMWithAuth({
      prompt: prompt,
      firebaseToken: token
    });
    
    setResponse(result);
    setLoading(false);
  }
  
  return (
    <div style={{ maxWidth:720 }}>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:8, marginBottom:16 }}>
        {MODELS.map(m => (
          <button key={m.id} onClick={() => setModel(m.id)}
            style={{ padding:"10px 14px", borderRadius:10, textAlign:"left", cursor:"pointer", background:model===m.id?"rgba(74,179,244,0.15)":"#13141f", border:"0.5px solid "+(model===m.id?C.blue:"rgba(255,255,255,0.07)"), color:model===m.id?C.blue:"#c8c8d0" }}>
            <div style={{ fontSize:12, fontWeight:600 }}>{m.label}</div>
            <div style={{ fontSize:10, color:"#6aaedd", marginTop:2 }}>{m.note}</div>
          </button>
        ))}
      </div>
      <textarea value={prompt} onChange={e=>setPrompt(e.target.value)} rows={5} placeholder="Enter prompt..." onKeyDown={e=>e.ctrlKey&&e.key==="Enter"&&send()}
        style={{ ...inputS, resize:"vertical", lineHeight:1.55, marginBottom:10 }} />
      <button onClick={send} disabled={loading||!prompt.trim()}
        style={{ width:"100%", padding:11, borderRadius:10, background:loading?"rgba(74,179,244,0.05)":"rgba(74,179,244,0.15)", border:"0.5px solid "+C.blue, color:C.blue, fontSize:13, fontWeight:700, cursor:"pointer", marginBottom:12 }}>
        {loading?"◈ Generating...":"↑ Send (Ctrl+Enter)"}
      </button>
      {(response||loading) && (
        <div style={{ padding:16, borderRadius:12, background:"rgba(74,179,244,0.05)", border:"0.5px solid rgba(74,179,244,0.2)", fontSize:13, color:"#c8c8d0", lineHeight:1.7, whiteSpace:"pre-wrap" }}>
          {loading?<span style={{ color:C.blue }}><Icon name="◈" size={12} style={{marginRight:6,verticalAlign:"middle"}} />Thinking...</span>:response}
        </div>
      )}
    </div>
  );
}