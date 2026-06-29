import { useState, useCallback, useEffect } from "react";
import { invokeLLM } from "@/api/ceogpsclient";
import { getErebusCore } from "@/lib/agents/erebus/ErebusCore";

// Load real LifeOS data for grounded simulations (closed-loop ecosystem)
function loadLifeOSContext() {
  try {
    const goals = JSON.parse(localStorage.getItem("lifeos_dash_projects") || "[]").filter(g => !g.done).map(g => g.text);
    // Use prefixed key so it participates in persistBridge cross-device sync
    const tasks = JSON.parse(localStorage.getItem("lifeos_tasks_queue") || "[]").filter(t => !t.done).slice(0,5).map(t => t.title);
    const calendar = JSON.parse(localStorage.getItem("lifeos_calendar") || "[]").slice(0,5).map(e => `${e.date} ${e.name}`);
    const crm = JSON.parse(localStorage.getItem("lifeos_crm") || "[]").slice(0,5).map(c => `${c.name || c.fullName} (${c.company || ''})`);
    const contacts = JSON.parse(localStorage.getItem("lifeos_contacts") || "[]").slice(0,3).map(c => c.name);
    return { goals, tasks, calendar, crm, contacts };
  } catch { return { goals: [], tasks: [], calendar: [], crm: [], contacts: [] }; }
}

const C = { purple: "#8b7fff", blue: "#4ab3f4", teal: "#00c896", orange: "#ff8c42", pink: "#ff6b9d", red: "#ff4f5e", gold: "#ffd700" };

const DREAM_SYSTEM_PROMPT = `You are the DreamForge Simulator — an AI that turns life visions into data-grounded 6–12 month reality simulations.

Given the user's dream and context, return ONLY valid JSON (no markdown, no prose outside JSON) in this exact structure:

{
  "vision": "2-3 sentence poetic but grounded vision statement",
  "tagline": "4-6 word essence of the dream",
  "moodKeywords": ["keyword1","keyword2","keyword3","keyword4","keyword5"],
  "phases": [
    {"months":"1-2","title":"Phase title","emoji":"emoji","tasks":["task1","task2","task3"],"milestone":"key win","risk":"main risk"},
    {"months":"3-4","title":"Phase title","emoji":"emoji","tasks":["task1","task2","task3"],"milestone":"key win","risk":"main risk"},
    {"months":"5-6","title":"Phase title","emoji":"emoji","tasks":["task1","task2","task3"],"milestone":"key win","risk":"main risk"},
    {"months":"7-12","title":"Phase title","emoji":"emoji","tasks":["task1","task2","task3"],"milestone":"key win","risk":"main risk"}
  ],
  "revenue": {
    "month3": 1500,
    "month6": 4500,
    "month9": 9000,
    "month12": 18000,
    "currency": "USD",
    "assumptions": ["assumption1","assumption2","assumption3"]
  },
  "conflicts": [
    {"title":"Conflict title","detail":"1-sentence detail","severity":"high|medium|low","resolution":"quick fix suggestion"},
    {"title":"Conflict title","detail":"1-sentence detail","severity":"high|medium|low","resolution":"quick fix suggestion"}
  ],
  "scenarios": [
    {"name":"Conservative","description":"What happens if you do the minimum — outcome description","monthlyRevenue12":0,"color":"#4ab3f4"},
    {"name":"On-Plan","description":"What happens if you follow the playbook — outcome description","monthlyRevenue12":0,"color":"#00c896"},
    {"name":"Breakout","description":"What happens if you go all-in — outcome description","monthlyRevenue12":0,"color":"#ffd700"}
  ],
  "actions": [
    {"type":"outreach","title":"Action title","body":"Full draft text ready to send or submit"},
    {"type":"grant","title":"Grant or resource title","body":"Full draft application paragraph"}
  ],
  "energyTip": "One specific tip about protecting energy during this build",
  "familyTie": "One specific way to involve or protect family during this journey"
}

Be specific, data-grounded, and actionable. Revenue numbers should be realistic for the described business. Conflicts should reference specifics the user mentioned.`;

function parseSimulation(raw) {
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
  } catch {
    return null;
  }
}

// ── Revenue chart (pure SVG) ──────────────────────────────────────────────────
function RevenueChart({ data, multiplier }) {
  const months = [
    { label: "M3",  value: data.month3  * multiplier },
    { label: "M6",  value: data.month6  * multiplier },
    { label: "M9",  value: data.month9  * multiplier },
    { label: "M12", value: data.month12 * multiplier },
  ];
  const max = Math.max(...months.map(m => m.value), 1);
  const W = 320, H = 140, PAD = 32, BAR_W = 44;
  const spacing = (W - PAD * 2) / months.length;

  return (
    <svg width={W} height={H + 28} style={{ overflow: "visible" }}>
      {/* Grid lines */}
      {[0.25, 0.5, 0.75, 1].map(pct => (
        <line key={pct} x1={PAD} x2={W - PAD} y1={PAD + H * (1 - pct)} y2={PAD + H * (1 - pct)}
          stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
      ))}
      {/* Bars */}
      {months.map((m, i) => {
        const x = PAD + i * spacing + spacing / 2 - BAR_W / 2;
        const barH = (m.value / max) * (H - PAD);
        const y = PAD + H - barH;
        const grad = `barGrad${i}`;
        return (
          <g key={m.label}>
            <defs>
              <linearGradient id={grad} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={C.purple} stopOpacity={0.9} />
                <stop offset="100%" stopColor={C.blue} stopOpacity={0.5} />
              </linearGradient>
            </defs>
            <rect x={x} y={y} width={BAR_W} height={barH} rx={6} fill={`url(#${grad})`} />
            <text x={x + BAR_W / 2} y={y - 6} textAnchor="middle" fill={C.purple} fontSize={11} fontWeight={700}>
              ${m.value >= 1000 ? (m.value / 1000).toFixed(1) + "k" : m.value}
            </text>
            <text x={x + BAR_W / 2} y={PAD + H + 18} textAnchor="middle" fill="#6aaedd" fontSize={11}>
              {m.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Conflict badge ────────────────────────────────────────────────────────────
function ConflictBadge({ conflict }) {
  const [open, setOpen] = useState(false);
  const colors = { high: C.red, medium: C.orange, low: C.gold };
  const col = colors[conflict.severity] || C.orange;
  return (
    <div style={{ background: `${col}10`, border: `1px solid ${col}30`, borderRadius: 10, padding: "10px 14px", cursor: "pointer" }}
      onClick={() => setOpen(o => !o)}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 16 }}>{conflict.severity === "high" ? "⚠️" : conflict.severity === "medium" ? "🔶" : "ℹ️"}</span>
        <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: col }}>{conflict.title}</span>
        <span style={{ fontSize: 10, color: "#6aaedd" }}>{open ? "▲" : "▼"}</span>
      </div>
      {open && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${col}20` }}>
          <div style={{ fontSize: 11, color: "#c8c8d0", marginBottom: 6 }}>{conflict.detail}</div>
          <div style={{ fontSize: 11, color: C.teal }}>✓ Fix: {conflict.resolution}</div>
        </div>
      )}
    </div>
  );
}

// ── Action draft card ─────────────────────────────────────────────────────────
function ActionCard({ action }) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const isGrant = action.type === "grant";
  const col = isGrant ? C.gold : C.teal;

  function copy() {
    navigator.clipboard.writeText(action.body).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  return (
    <div style={{ background: `${col}08`, border: `1px solid ${col}25`, borderRadius: 10, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", cursor: "pointer" }}
        onClick={() => setExpanded(o => !o)}>
        <span style={{ fontSize: 15 }}>{isGrant ? "🏛️" : "✉️"}</span>
        <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: col }}>{action.title}</span>
        <span style={{ fontSize: 10, color: "#4a5568", background: `${col}15`, padding: "2px 8px", borderRadius: 10 }}>
          {isGrant ? "Grant" : "Outreach"}
        </span>
        <span style={{ fontSize: 10, color: "#6aaedd" }}>{expanded ? "▲" : "▼"}</span>
      </div>
      {expanded && (
        <div style={{ padding: "0 14px 14px" }}>
          <div style={{ background: "#0a0b12", borderRadius: 8, padding: "12px 14px", fontSize: 12, color: "#c8c8d0", lineHeight: 1.7, whiteSpace: "pre-wrap", marginBottom: 8 }}>
            {action.body}
          </div>
          <button onClick={copy}
            style={{ padding: "6px 16px", borderRadius: 8, background: copied ? `${C.teal}20` : `${col}15`, border: `1px solid ${col}40`, color: copied ? C.teal : col, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
            {copied ? "✓ Copied!" : "Copy Draft"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function DreamForgeSimulator({ onBack }) {
  const [phase, setPhase] = useState("input"); // input | loading | result
  const [dream, setDream] = useState("");
  const [context, setContext] = useState({ energy: "", family: "", finances: "", skills: "" });
  const [sim, setSim]   = useState(null);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("timeline");
  const [multiplier, setMultiplier] = useState(1);
  const [activeScenario, setActiveScenario] = useState(1);
  const [activeAction, setActiveAction] = useState(null);

  // Closed-loop: pull real LifeOS data (goals, tasks, calendar, CRM, contacts) for grounded sims
  const [lifeOSData] = useState(() => loadLifeOSContext());

  // Pre-fill context from real data on mount for ecosystem effect
  useEffect(() => {
    if (lifeOSData.goals.length || lifeOSData.tasks.length) {
      setContext(prev => ({
        ...prev,
        family: prev.family || (lifeOSData.contacts.length ? `Family/friends: ${lifeOSData.contacts.join(", ")}` : prev.family),
        skills: prev.skills || (lifeOSData.goals.length ? `Current goals: ${lifeOSData.goals.slice(0,3).join("; ")}` : prev.skills),
      }));
    }
  }, [lifeOSData]);

  const run = useCallback(async () => {
    if (!dream.trim()) return;
    setPhase("loading");
    setError("");
    try {
      const contextStr = [
        context.energy   && `Energy/schedule context: ${context.energy}`,
        context.family   && `Family situation: ${context.family}`,
        context.finances && `Current finances: ${context.finances}`,
        context.skills   && `Skills/experience: ${context.skills}`,
      ].filter(Boolean).join("\n");

      // Closed-loop ecosystem: include real LifeOS data for personalized, data-grounded simulation
      const realDataStr = [
        lifeOSData.goals.length && `Active goals: ${lifeOSData.goals.slice(0,4).join("; ")}`,
        lifeOSData.tasks.length && `Open tasks: ${lifeOSData.tasks.slice(0,4).join("; ")}`,
        lifeOSData.calendar.length && `Upcoming calendar: ${lifeOSData.calendar.slice(0,3).join("; ")}`,
        lifeOSData.crm.length && `Recent CRM/contacts: ${lifeOSData.crm.slice(0,3).join("; ")}`,
      ].filter(Boolean).join("\n");

      const prompt = `Dream/Goal: ${dream}${contextStr ? "\n\n" + contextStr : ""}${realDataStr ? "\n\nREAL LIFEOS DATA (use to ground the simulation in actual life): " + realDataStr : ""}`;
      const raw = await invokeLLM({ systemPrompt: DREAM_SYSTEM_PROMPT, prompt });
      const result = parseSimulation(raw);
      if (!result) { setError("Simulation parse failed. Try rephrasing your dream."); setPhase("input"); return; }
      setSim(result);
      setPhase("result");
      setActiveTab("timeline");
      setMultiplier(1);
      setActiveScenario(1);
    } catch (e) {
      setError(e.message || "Simulation failed. Check your AI key in Integrations.");
      setPhase("input");
    }
  }, [dream, context]);

  // ── INPUT PHASE ──────────────────────────────────────────────────────────────
  if (phase === "input") return (
    <div style={{ height: "100%", overflowY: "auto", padding: 28 }}>
      <button onClick={onBack} style={{ background: "none", border: "none", color: "#6aaedd", fontSize: 12, cursor: "pointer", marginBottom: 20 }}>
        ← Back to Simulators
      </button>

      {/* Hero */}
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div style={{ fontSize: 52, marginBottom: 10 }}>🌙</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: C.purple, marginBottom: 6 }}>DreamForge Simulator</div>
        <div style={{ fontSize: 13, color: "#6aaedd", maxWidth: 480, margin: "0 auto", lineHeight: 1.6 }}>
          Simulates 6-12 month branching realities with visual mood boards, playbooks, revenue projections. (Ecosystem: data from your LifeOS fuels personalized outcomes that improve business, community, and personal life.)
        </div>
      </div>

      {/* Main input */}
      <div style={{ maxWidth: 600, margin: "0 auto" }}>
        <div style={{ background: "#11131f", border: `1px solid ${C.purple}30`, borderRadius: 14, padding: 20, marginBottom: 16 }}>
          <label style={{ fontSize: 11, color: C.purple, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", display: "block", marginBottom: 8 }}>
            🌙 Your Dream or Vision
          </label>
          <textarea
            value={dream}
            onChange={e => setDream(e.target.value)}
            placeholder={`e.g. "Help me design my dream Atlanta micro-bakery that lets me spend more time with my family and generate $10k/month by next year."`}
            style={{ width: "100%", minHeight: 100, padding: "12px 14px", borderRadius: 10, border: `1px solid ${C.purple}30`, background: "#0a0b12", fontSize: 13, color: "#f0ede8", outline: "none", resize: "vertical", boxSizing: "border-box", lineHeight: 1.6 }}
          />
        </div>

        {/* Context fields */}
        <div style={{ background: "#0f1120", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: "#6aaedd", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 14 }}>
            Context (optional — makes simulation more accurate)
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[
              { key: "energy", label: "⚡ Energy & Schedule", ph: "e.g. mornings free, low energy by 3pm" },
              { key: "family", label: "👨‍👩‍👧 Family Situation",  ph: "e.g. 2 kids, soccer season in spring" },
              { key: "finances", label: "💰 Current Finances",  ph: "e.g. $8k savings, $3k/mo expenses" },
              { key: "skills", label: "🎯 Skills & Experience", ph: "e.g. 5 yrs baking, Instagram marketing" },
            ].map(f => (
              <div key={f.key}>
                <label style={{ fontSize: 10, color: "#6aaedd", display: "block", marginBottom: 5, fontWeight: 600 }}>{f.label}</label>
                <input
                  value={context[f.key]}
                  onChange={e => setContext(c => ({ ...c, [f.key]: e.target.value }))}
                  placeholder={f.ph}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "#0a0b12", fontSize: 12, color: "#f0ede8", outline: "none", boxSizing: "border-box" }}
                />
              </div>
            ))}
          </div>
        </div>

        {error && <div style={{ color: C.red, fontSize: 12, marginBottom: 12, padding: "8px 14px", background: `${C.red}10`, borderRadius: 8 }}>{error}</div>}

        <button onClick={run} disabled={!dream.trim()}
          style={{ width: "100%", padding: "14px", borderRadius: 12, background: `linear-gradient(135deg, ${C.purple}, ${C.blue})`, border: "none", color: "#fff", fontSize: 14, fontWeight: 800, cursor: dream.trim() ? "pointer" : "not-allowed", opacity: dream.trim() ? 1 : 0.4, letterSpacing: ".03em" }}>
          🔮 Forge My Reality Simulation
        </button>
      </div>
    </div>
  );

  // ── LOADING PHASE ────────────────────────────────────────────────────────────
  if (phase === "loading") return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20 }}>
      <div style={{ fontSize: 52, animation: "spin 3s linear infinite" }}>🔮</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: C.purple }}>Forging your reality...</div>
      <div style={{ fontSize: 12, color: "#6aaedd", maxWidth: 320, textAlign: "center", lineHeight: 1.6 }}>
        Simulating 6–12 month branching timelines, projecting revenue, scanning for conflicts...
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        {["Timeline", "Revenue", "Conflicts", "Actions"].map((step, i) => (
          <div key={step} style={{ padding: "4px 12px", borderRadius: 20, background: `${C.purple}15`, border: `1px solid ${C.purple}30`, fontSize: 10, color: C.purple, animation: `pulse 1.5s ease-in-out ${i * 0.3}s infinite` }}>
            {step}
          </div>
        ))}
      </div>
      <style>{`
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:1} }
      `}</style>
    </div>
  );

  // ── RESULT PHASE ─────────────────────────────────────────────────────────────
  const TABS = ["timeline", "revenue", "conflicts", "scenarios", "actions"];
  const TAB_LABELS = { timeline: "📅 Timeline", revenue: "💰 Revenue", conflicts: "⚠️ Conflicts", scenarios: "🔀 Scenarios", actions: "✉️ Actions" };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* Header */}
      <div style={{ background: `linear-gradient(135deg, ${C.purple}18, ${C.blue}10)`, borderBottom: "1px solid rgba(139,127,255,0.2)", padding: "16px 20px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 22 }}>🌙</span>
              <span style={{ fontSize: 16, fontWeight: 800, color: C.purple }}>DreamForge</span>
              <span style={{ fontSize: 11, padding: "2px 10px", borderRadius: 20, background: `${C.teal}20`, border: `1px solid ${C.teal}40`, color: C.teal, fontWeight: 600 }}>
                Simulation Complete
              </span>
            </div>
            {sim.tagline && <div style={{ fontSize: 18, fontWeight: 700, color: "#f0ede8", marginBottom: 4 }}>"{sim.tagline}"</div>}
            {sim.vision && <div style={{ fontSize: 12, color: "#8892a4", lineHeight: 1.6, maxWidth: 600 }}>{sim.vision}</div>}
            {sim.moodKeywords && (
              <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                {sim.moodKeywords.map(kw => (
                  <span key={kw} style={{ fontSize: 10, padding: "2px 10px", borderRadius: 20, background: `${C.purple}15`, border: `1px solid ${C.purple}25`, color: C.purple }}>
                    {kw}
                  </span>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => { setPhase("input"); setSim(null); }}
            style={{ padding: "6px 14px", borderRadius: 8, background: "transparent", border: `1px solid ${C.purple}40`, color: C.purple, fontSize: 11, cursor: "pointer", flexShrink: 0 }}>
            New Dream
          </button>
        </div>

        {/* Ecosystem Effect - Closed-loop actions: apply sim outputs back to LifeOS (tasks, leads, events, Erebus routine) */}
        {sim && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            <button onClick={() => {
              // Create tasks from phases — use lifeos_ prefix for persistBridge
              const existing = JSON.parse(localStorage.getItem("lifeos_tasks_queue") || "[]");
              const newTasks = (sim.phases || []).flatMap((ph, i) => (ph.tasks || []).map((t, j) => ({ id: Date.now() + i*100 + j, title: `[DreamForge] ${ph.title}: ${t}`, done: false, source: "dreamforge" })));
              localStorage.setItem("lifeos_tasks_queue", JSON.stringify([...existing, ...newTasks]));
              alert("✅ Playbook tasks added to TaskOrchestration panel! (ecosystem loop — will sync to other devices)");
            }} style={{ padding: "4px 10px", fontSize: 10, borderRadius: 6, background: `${C.teal}15`, border: `1px solid ${C.teal}30`, color: C.teal, cursor: "pointer" }}>
              📋 Create Tasks from Playbook
            </button>
            <button onClick={() => {
              const existing = JSON.parse(localStorage.getItem("lifeos_crm") || "[]");
              const newLeads = (sim.conflicts || []).slice(0,2).map((c, i) => ({ id: "df" + Date.now() + i, name: c.title, status: "opportunity", notes: c.detail + " | Resolution: " + c.resolution, source: "dreamforge" }));
              localStorage.setItem("lifeos_crm", JSON.stringify([...existing, ...newLeads]));
              alert("🎯 Opportunity leads from conflicts added to CRM!");
            }} style={{ padding: "4px 10px", fontSize: 10, borderRadius: 6, background: `${C.gold}15`, border: `1px solid ${C.gold}30`, color: C.gold, cursor: "pointer" }}>
              🎯 Log Opportunities in CRM
            </button>
            <button onClick={() => {
              const existing = JSON.parse(localStorage.getItem("lifeos_calendar") || "[]");
              const newEvents = (sim.phases || []).slice(0,2).map((ph, i) => ({ id: Date.now() + i, name: `[Dream] ${ph.title}`, date: new Date(Date.now() + (i+1)*30*864e5).toISOString().split("T")[0], icon: "🌙", tag: "Business" }));
              localStorage.setItem("lifeos_calendar", JSON.stringify([...existing, ...newEvents]));
              alert("📅 Milestones scheduled in Calendar!");
            }} style={{ padding: "4px 10px", fontSize: 10, borderRadius: 6, background: `${C.blue}15`, border: `1px solid ${C.blue}30`, color: C.blue, cursor: "pointer" }}>
              📅 Schedule Milestones
            </button>
            <button onClick={() => {
              const erebus = getErebusCore();
              erebus.reason(`Run DreamForge routine for: ${dream}. Apply playbook and monitor.`);
              alert("🤖 Sent to Erebus as autonomous routine (local-first)!");
            }} style={{ padding: "4px 10px", fontSize: 10, borderRadius: 6, background: `${C.purple}15`, border: `1px solid ${C.purple}30`, color: C.purple, cursor: "pointer" }}>
              🤖 Run as Erebus Autonomous Routine
            </button>
          </div>
        )}
      </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 2, padding: "8px 16px", background: "#0f1120", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0, overflowX: "auto" }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            style={{ padding: "6px 14px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap",
              background: activeTab === t ? `${C.purple}20` : "transparent",
              color: activeTab === t ? C.purple : "#6aaedd",
              borderBottom: activeTab === t ? `2px solid ${C.purple}` : "2px solid transparent" }}>
            {TAB_LABELS[t]}
            {t === "conflicts" && sim.conflicts?.length > 0 && (
              <span style={{ marginLeft: 5, background: C.red, color: "#fff", borderRadius: 10, padding: "1px 5px", fontSize: 9 }}>
                {sim.conflicts.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>

        {/* ── TIMELINE ── */}
        {activeTab === "timeline" && (
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#f0ede8", marginBottom: 16 }}>6–12 Month Playbook</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {(sim.phases || []).map((ph, i) => {
                const colors = [C.purple, C.blue, C.teal, C.orange];
                const col = colors[i % colors.length];
                return (
                  <div key={i} style={{ display: "flex", gap: 0 }}>
                    {/* Timeline spine */}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 40, flexShrink: 0 }}>
                      <div style={{ width: 28, height: 28, borderRadius: "50%", background: `${col}25`, border: `2px solid ${col}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0, zIndex: 1 }}>
                        {ph.emoji || "📍"}
                      </div>
                      {i < (sim.phases.length - 1) && <div style={{ width: 2, flex: 1, background: `${col}30`, minHeight: 24 }} />}
                    </div>
                    {/* Content */}
                    <div style={{ flex: 1, paddingBottom: 20, paddingLeft: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <span style={{ fontSize: 10, color: col, fontWeight: 700, background: `${col}15`, padding: "2px 8px", borderRadius: 10 }}>
                          Months {ph.months}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#f0ede8" }}>{ph.title}</span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }}>
                        {(ph.tasks || []).map((task, j) => (
                          <div key={j} style={{ display: "flex", alignItems: "flex-start", gap: 6, fontSize: 12, color: "#c8c8d0" }}>
                            <span style={{ color: col, flexShrink: 0 }}>▸</span>
                            {task}
                          </div>
                        ))}
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {ph.milestone && (
                          <div style={{ fontSize: 11, padding: "4px 10px", borderRadius: 8, background: `${C.teal}10`, border: `1px solid ${C.teal}25`, color: C.teal }}>
                            🏆 {ph.milestone}
                          </div>
                        )}
                        {ph.risk && (
                          <div style={{ fontSize: 11, padding: "4px 10px", borderRadius: 8, background: `${C.orange}10`, border: `1px solid ${C.orange}25`, color: C.orange }}>
                            ⚡ Risk: {ph.risk}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Bonus tips */}
            {(sim.energyTip || sim.familyTie) && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 8 }}>
                {sim.energyTip && (
                  <div style={{ background: `${C.blue}08`, border: `1px solid ${C.blue}20`, borderRadius: 10, padding: "12px 14px" }}>
                    <div style={{ fontSize: 10, color: C.blue, fontWeight: 700, marginBottom: 4 }}>⚡ ENERGY TIP</div>
                    <div style={{ fontSize: 12, color: "#c8c8d0", lineHeight: 1.5 }}>{sim.energyTip}</div>
                  </div>
                )}
                {sim.familyTie && (
                  <div style={{ background: `${C.pink}08`, border: `1px solid ${C.pink}20`, borderRadius: 10, padding: "12px 14px" }}>
                    <div style={{ fontSize: 10, color: C.pink, fontWeight: 700, marginBottom: 4 }}>👨‍👩‍👧 FAMILY TIE-IN</div>
                    <div style={{ fontSize: 12, color: "#c8c8d0", lineHeight: 1.5 }}>{sim.familyTie}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── REVENUE ── */}
        {activeTab === "revenue" && sim.revenue && (
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#f0ede8", marginBottom: 4 }}>Revenue Projection</div>
            <div style={{ fontSize: 11, color: "#6aaedd", marginBottom: 20 }}>Adjust the slider to model different effort levels</div>

            {/* Chart */}
            <div style={{ background: "#0f1120", borderRadius: 12, padding: "20px 16px", marginBottom: 16, display: "inline-block" }}>
              <RevenueChart data={sim.revenue} multiplier={multiplier} />
            </div>

            {/* Slider */}
            <div style={{ background: "#11131f", border: `1px solid ${C.purple}20`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: "#c8c8d0" }}>📊 Effort Multiplier</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.purple }}>{multiplier.toFixed(1)}x</span>
              </div>
              <input type="range" min={0.5} max={3} step={0.1} value={multiplier}
                onChange={e => setMultiplier(parseFloat(e.target.value))}
                style={{ width: "100%", accentColor: C.purple }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#4a5568", marginTop: 4 }}>
                <span>0.5x (minimal effort)</span>
                <span>3x (full-send)</span>
              </div>
            </div>

            {/* 12-month headline */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 16 }}>
              {[
                { label: "Month 3",  val: sim.revenue.month3  },
                { label: "Month 6",  val: sim.revenue.month6  },
                { label: "Month 9",  val: sim.revenue.month9  },
                { label: "Month 12", val: sim.revenue.month12 },
              ].map(({ label, val }) => (
                <div key={label} style={{ background: `${C.purple}10`, border: `1px solid ${C.purple}20`, borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: "#6aaedd", marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: C.purple }}>
                    ${Math.round(val * multiplier).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>

            {/* Assumptions */}
            {sim.revenue.assumptions?.length > 0 && (
              <div style={{ background: "#0f1120", borderRadius: 10, padding: "12px 14px" }}>
                <div style={{ fontSize: 10, color: "#4a5568", fontWeight: 700, marginBottom: 8 }}>PROJECTION ASSUMPTIONS</div>
                {sim.revenue.assumptions.map((a, i) => (
                  <div key={i} style={{ fontSize: 11, color: "#8892a4", display: "flex", gap: 6, marginBottom: 4 }}>
                    <span style={{ color: C.blue }}>•</span>{a}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── CONFLICTS ── */}
        {activeTab === "conflicts" && (
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#f0ede8", marginBottom: 4 }}>Reality Checks & Conflict Warnings</div>
            <div style={{ fontSize: 11, color: "#6aaedd", marginBottom: 16 }}>Issues detected between your dream and your current life</div>
            {(!sim.conflicts || sim.conflicts.length === 0) ? (
              <div style={{ textAlign: "center", padding: 40, color: C.teal }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>✅</div>
                <div style={{ fontSize: 13 }}>No major conflicts detected. Clear path ahead.</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {sim.conflicts.map((c, i) => <ConflictBadge key={i} conflict={c} />)}
              </div>
            )}
          </div>
        )}

        {/* ── SCENARIOS ── */}
        {activeTab === "scenarios" && (
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#f0ede8", marginBottom: 4 }}>Branching Realities</div>
            <div style={{ fontSize: 11, color: "#6aaedd", marginBottom: 16 }}>Three possible versions of your 12-month outcome</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {(sim.scenarios || []).map((s, i) => (
                <button key={i} onClick={() => setActiveScenario(i)}
                  style={{ flex: 1, padding: "10px 8px", borderRadius: 10, border: `2px solid ${activeScenario === i ? (s.color || C.blue) : "rgba(255,255,255,0.08)"}`, background: activeScenario === i ? `${s.color || C.blue}15` : "transparent", color: activeScenario === i ? (s.color || C.blue) : "#6aaedd", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
                  {s.name}
                </button>
              ))}
            </div>
            {sim.scenarios?.[activeScenario] && (
              <div style={{ background: `${sim.scenarios[activeScenario].color || C.blue}08`, border: `1px solid ${sim.scenarios[activeScenario].color || C.blue}25`, borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: sim.scenarios[activeScenario].color || C.blue, marginBottom: 10 }}>
                  {sim.scenarios[activeScenario].name} Path
                </div>
                <div style={{ fontSize: 13, color: "#c8c8d0", lineHeight: 1.7, marginBottom: 16 }}>
                  {sim.scenarios[activeScenario].description}
                </div>
                {sim.scenarios[activeScenario].monthlyRevenue12 > 0 && (
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: `${sim.scenarios[activeScenario].color || C.blue}15`, border: `1px solid ${sim.scenarios[activeScenario].color || C.blue}30`, borderRadius: 10, padding: "8px 16px" }}>
                    <span style={{ fontSize: 11, color: "#6aaedd" }}>Month 12 revenue:</span>
                    <span style={{ fontSize: 16, fontWeight: 800, color: sim.scenarios[activeScenario].color || C.blue }}>
                      ${sim.scenarios[activeScenario].monthlyRevenue12.toLocaleString()}/mo
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── ACTIONS ── */}
        {activeTab === "actions" && (
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#f0ede8", marginBottom: 4 }}>Ready-to-Send Action Drafts</div>
            <div style={{ fontSize: 11, color: "#6aaedd", marginBottom: 16 }}>AI-drafted outreach and grant applications — click to expand and copy</div>
            {(!sim.actions || sim.actions.length === 0) ? (
              <div style={{ textAlign: "center", padding: 40, color: "#4a5568" }}>No action drafts generated.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {sim.actions.map((a, i) => <ActionCard key={i} action={a} />)}
              </div>
            )}
          </div>
        )}

      </div>

      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
    </div>
  );
}
