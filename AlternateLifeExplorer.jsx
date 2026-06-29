import { useState, useCallback } from "react";
import { invokeLLMWithAuth } from "@/api/ceogpsclient";
import { useWorkerAuth } from "@/contexts/WorkerContext";

const C = { blue: "#4ab3f4", purple: "#8b7fff", teal: "#00c896", orange: "#ff8c42", pink: "#ff6b9d", red: "#ff4f5e", gold: "#ffd700" };

// ── AI prompt ────────────────────────────────────────────────────────────────
const SYSTEM = `You are the Alternate Life Explorer for LifeOS1. You run grounded, multi-domain alternate life simulations based on the user's real context.

Given a "what if" scenario and context, return ONLY valid JSON (no markdown):
{
  "scenarioTitle": "Short punchy name for the alternate path",
  "scenarioEmoji": "single emoji",
  "verdict": "one of: Likely Worth It | Risky But Possible | Not Worth It | Needs More Data",
  "verdictReason": "1-sentence honest summary",
  "currentLife": {
    "label": "Current Path",
    "monthlyRevenue": 8000,
    "happinessScore": 65,
    "freedomScore": 50,
    "familyScore": 70,
    "stressScore": 60,
    "summary": "2-sentence honest picture of where they are now"
  },
  "alternateLife": {
    "label": "Alternate Path name",
    "monthlyRevenue": 5000,
    "happinessScore": 80,
    "freedomScore": 85,
    "familyScore": 75,
    "stressScore": 45,
    "summary": "2-sentence vivid picture of the alternate path at 12 months"
  },
  "timeline": [
    { "period": "Month 1-2", "phase": "Transition", "emoji": "🚀", "currentEvents": ["what happens in current path"], "alternateEvents": ["what happens in alternate path"], "pivotMoment": "the key decision or milestone in this window" },
    { "period": "Month 3-4", "phase": "Adjustment", "emoji": "⚡", "currentEvents": ["..."], "alternateEvents": ["..."], "pivotMoment": "..." },
    { "period": "Month 5-8", "phase": "Stabilization", "emoji": "🏗️", "currentEvents": ["..."], "alternateEvents": ["..."], "pivotMoment": "..." },
    { "period": "Month 9-12", "phase": "New Normal", "emoji": "🌅", "currentEvents": ["..."], "alternateEvents": ["..."], "pivotMoment": "..." }
  ],
  "riskFlags": [
    { "domain": "Finances", "severity": "high", "flag": "specific risk description", "mitigation": "concrete mitigation step" },
    { "domain": "Family", "severity": "medium", "flag": "...", "mitigation": "..." },
    { "domain": "Health/Energy", "severity": "low", "flag": "...", "mitigation": "..." }
  ],
  "testDrive": {
    "title": "30-Day Micro-Experiment",
    "hypothesis": "If I do X for 30 days, I will learn Y",
    "protectedFamilyTime": "specific commitment to protect family time during the experiment",
    "weeks": [
      { "week": 1, "focus": "focus area", "actions": ["action1", "action2"], "metric": "how to measure success" },
      { "week": 2, "focus": "focus area", "actions": ["action1", "action2"], "metric": "how to measure success" },
      { "week": 3, "focus": "focus area", "actions": ["action1", "action2"], "metric": "how to measure success" },
      { "week": 4, "focus": "focus area", "actions": ["action1", "action2"], "metric": "how to measure success, go/no-go decision" }
    ],
    "goSignal": "what result would tell you to go all-in",
    "noGoSignal": "what result would tell you to stay the course"
  },
  "atlantaAngle": "specific Atlanta market opportunity or signal relevant to this alternate path",
  "familyImpact": "honest 2-sentence assessment of how this affects family life",
  "hiddenAdvantage": "one non-obvious advantage of the alternate path most people would miss"
}`;

function parseJSON(raw) {
  try { const m = raw.match(/\{[\s\S]*\}/); return m ? JSON.parse(m[0]) : null; } catch { return null; }
}

// ── Radar chart (SVG pentagon) ───────────────────────────────────────────────
function RadarChart({ current, alternate, size = 160 }) {
  const cx = size / 2, cy = size / 2, r = size * 0.38;
  const labels  = ["Revenue", "Happiness", "Freedom", "Family", "Low Stress"];
  const cVals   = [current.monthlyRevenue / 200, current.happinessScore, current.freedomScore, current.familyScore, 100 - current.stressScore];
  const aVals   = [alternate.monthlyRevenue / 200, alternate.happinessScore, alternate.freedomScore, alternate.familyScore, 100 - alternate.stressScore];
  const n = labels.length;

  function point(val, i, scale = 1) {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    const pct   = Math.min(val, 100) / 100;
    return { x: cx + Math.cos(angle) * r * pct * scale, y: cy + Math.sin(angle) * r * pct * scale };
  }
  function labelPoint(i) {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    return { x: cx + Math.cos(angle) * (r + 20), y: cy + Math.sin(angle) * (r + 20) };
  }
  function polygon(vals, scale = 1) {
    return vals.map((v, i) => { const p = point(v, i, scale); return `${p.x},${p.y}`; }).join(" ");
  }
  // Grid rings
  const rings = [0.25, 0.5, 0.75, 1].map(s =>
    Array.from({ length: n }, (_, i) => { const angle = (Math.PI * 2 * i) / n - Math.PI / 2; return `${cx + Math.cos(angle) * r * s},${cy + Math.sin(angle) * r * s}`; }).join(" ")
  );

  return (
    <svg width={size + 40} height={size + 40} style={{ overflow: "visible" }} viewBox={`-20 -20 ${size + 40} ${size + 40}`}>
      {rings.map((pts, i) => <polygon key={i} points={pts} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={1} />)}
      {Array.from({ length: n }, (_, i) => {
        const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
        return <line key={i} x1={cx} y1={cy} x2={cx + Math.cos(angle) * r} y2={cy + Math.sin(angle) * r} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />;
      })}
      <polygon points={polygon(cVals)} fill={`${C.blue}25`} stroke={C.blue} strokeWidth={2} />
      <polygon points={polygon(aVals)} fill={`${C.teal}20`} stroke={C.teal} strokeWidth={2} strokeDasharray="4 2" />
      {labels.map((label, i) => {
        const lp = labelPoint(i);
        return <text key={label} x={lp.x} y={lp.y} textAnchor="middle" dominantBaseline="middle" fill="#6aaedd" fontSize={9}>{label}</text>;
      })}
    </svg>
  );
}

// ── Score comparison row ─────────────────────────────────────────────────────
function ScoreRow({ label, current, alternate, invert = false }) {
  const better = invert ? alternate < current : alternate > current;
  const diff   = alternate - current;
  const col    = better ? C.teal : diff === 0 ? "#6aaedd" : C.red;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
      <span style={{ fontSize: 11, color: "#8892a4", width: 90, flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, position: "relative" }}>
        <div style={{ position: "absolute", height: "100%", width: `${Math.min(current, 100)}%`, background: `${C.blue}70`, borderRadius: 3 }} />
        <div style={{ position: "absolute", height: "100%", width: `${Math.min(alternate, 100)}%`, background: `${C.teal}50`, borderRadius: 3, border: `1px dashed ${C.teal}80` }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color: col, width: 44, textAlign: "right", flexShrink: 0 }}>
        {diff > 0 ? "+" : ""}{diff}
      </span>
    </div>
  );
}

// ── Verdict chip ─────────────────────────────────────────────────────────────
function VerdictChip({ verdict }) {
  const map = {
    "Likely Worth It":    { col: C.teal,   icon: "✅" },
    "Risky But Possible": { col: C.orange,  icon: "⚡" },
    "Not Worth It":       { col: C.red,     icon: "❌" },
    "Needs More Data":    { col: C.gold,    icon: "🔍" },
  };
  const { col, icon } = map[verdict] || { col: C.blue, icon: "🔮" };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 14px", borderRadius: 20, background: `${col}20`, border: `1px solid ${col}50`, color: col, fontSize: 12, fontWeight: 700 }}>
      {icon} {verdict}
    </span>
  );
}

// ── Risk flag card ───────────────────────────────────────────────────────────
function RiskCard({ risk }) {
  const [open, setOpen] = useState(false);
  const sevColor = { high: C.red, medium: C.orange, low: C.gold }[risk.severity] || C.orange;
  const sevIcon  = { high: "🔴", medium: "🟡", low: "🟢" }[risk.severity] || "🟡";
  return (
    <div onClick={() => setOpen(o => !o)} style={{ background: `${sevColor}08`, border: `1px solid ${sevColor}25`, borderRadius: 10, padding: "10px 14px", cursor: "pointer" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span>{sevIcon}</span>
        <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: sevColor }}>{risk.domain}: {risk.flag}</span>
        <span style={{ fontSize: 10, color: "#4a5568" }}>{open ? "▲" : "▼"}</span>
      </div>
      {open && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${sevColor}20` }}>
          <div style={{ fontSize: 11, color: C.teal }}>✓ Mitigation: {risk.mitigation}</div>
        </div>
      )}
    </div>
  );
}

// ── PRESET SCENARIOS ────────────────────────────────────────────────────────
const PRESETS = [
  { icon: "🎮", label: "Full-time streaming + events",  text: "What if I quit my day job and went full-time into game streaming and local gaming events in Atlanta?" },
  { icon: "🏠", label: "Remote work + relocate",        text: "What if I switched to fully remote work and moved to a lower cost-of-living area outside Atlanta?" },
  { icon: "🍳", label: "Start a food business",          text: "What if I launched a weekend pop-up food business using my cooking skills while keeping my current job?" },
  { icon: "📚", label: "Go back to school",              text: "What if I went back to school part-time for an MBA while running my current business?" },
  { icon: "🤝", label: "Sell business, consult instead", text: "What if I sold my current business and pivoted to consulting in my industry?" },
  { icon: "✈️", label: "Semi-retire at 45",              text: "What if I aggressively cut expenses and built passive income to semi-retire in 5 years?" },
];

// ── Main component ───────────────────────────────────────────────────────────
export default function AlternateLifeExplorer({ onBack }) {
  const { getToken, isAuthenticated } = useWorkerAuth();
  const [phase, setPhase]       = useState("input");   // input | loading | result
  const [whatIf, setWhatIf]     = useState("");
  const [context, setContext]   = useState({ finances: "", family: "", energy: "", skills: "", location: "Atlanta, GA" });
  const [sim, setSim]           = useState(null);
  const [error, setError]       = useState("");
  const [activeTab, setActiveTab] = useState("compare");
  const [savedSims, setSavedSims] = useState(() => {
    try { return JSON.parse(localStorage.getItem("lifeos1_alt_sims") || "[]"); } catch { return []; }
  });

  const run = useCallback(async () => {
    if (!whatIf.trim()) return;
    
    const token = await getToken();
    if (!token) {
      setError("Please log in to run life simulations.");
      return;
    }
    
    setPhase("loading");
    setError("");
    
    try {
      const prompt = [
        `What-if scenario: ${whatIf}`,
        context.finances && `Current finances: ${context.finances}`,
        context.family   && `Family situation: ${context.family}`,
        context.energy   && `Energy/schedule: ${context.energy}`,
        context.skills   && `Skills/background: ${context.skills}`,
        `Location: Atlanta, GA. I'm a marketing business owner.`,
      ].filter(Boolean).join("\n");

      const raw = await invokeLLMWithAuth({
        systemPrompt: SYSTEM,
        prompt: prompt,
        firebaseToken: token
      });
      
      const parsed = parseJSON(raw);
      if (!parsed) {
        setError("Simulation failed to parse. Try rephrasing.");
        setPhase("input");
        return;
      }
      setSim(parsed);
      setPhase("result");
      setActiveTab("compare");
    } catch (error) {
      console.error("Simulation error:", error);
      setError(error.message || "Simulation failed.");
      setPhase("input");
    }
  }, [whatIf, context, getToken]);

  function saveSim() {
    if (!sim) return;
    const entry = { id: Date.now(), whatIf, title: sim.scenarioTitle, verdict: sim.verdict, ts: new Date().toISOString() };
    const next = [entry, ...savedSims].slice(0, 10);
    setSavedSims(next);
    localStorage.setItem("lifeos1_alt_sims", JSON.stringify(next));
  }

  // Shared styles
  const card = { background: "#11131f", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: 16 };
  const inp  = { padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "#0a0b12", fontSize: 12, color: "#f0ede8", outline: "none", boxSizing: "border-box", width: "100%" };

  // ── INPUT ────────────────────────────────────────────────────────────────
  if (phase === "input") return (
    <div style={{ height: "100%", overflowY: "auto", padding: 28 }}>
      <button onClick={onBack} style={{ background: "none", border: "none", color: "#6aaedd", fontSize: 12, cursor: "pointer", marginBottom: 20 }}>← Back</button>

      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div style={{ fontSize: 52, marginBottom: 10 }}>🌍</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: C.blue, marginBottom: 6 }}>Alternate Life Explorer</div>
        <div style={{ fontSize: 13, color: "#6aaedd", maxWidth: 500, margin: "0 auto", lineHeight: 1.6 }}>
          Ask any "what if" life question. Get a multi-month simulation grounded in your real finances, family, energy, and Atlanta market signals — plus a 30-day test drive plan.
        </div>
      </div>

      <div style={{ maxWidth: 620, margin: "0 auto" }}>
        {/* Presets */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, color: "#4a5568", fontWeight: 700, marginBottom: 8, letterSpacing: ".08em" }}>QUICK SCENARIOS</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {PRESETS.map(p => (
              <button key={p.label} onClick={() => setWhatIf(p.text)}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 10, border: `1px solid ${whatIf === p.text ? C.blue : "rgba(255,255,255,0.08)"}`, background: whatIf === p.text ? `${C.blue}15` : "transparent", color: whatIf === p.text ? C.blue : "#8892a4", cursor: "pointer", textAlign: "left", fontSize: 11 }}>
                <span style={{ fontSize: 16, flexShrink: 0 }}>{p.icon}</span>
                <span>{p.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Main what-if input */}
        <div style={{ ...card, border: `1px solid ${C.blue}30`, marginBottom: 12 }}>
          <label style={{ fontSize: 10, color: C.blue, fontWeight: 700, display: "block", marginBottom: 8 }}>🌍 YOUR "WHAT IF" QUESTION</label>
          <textarea value={whatIf} onChange={e => setWhatIf(e.target.value)}
            placeholder={`e.g. "What if I quit plumbing and went full-time into game streaming + local events in Atlanta?"`}
            style={{ ...inp, minHeight: 88, resize: "vertical", lineHeight: 1.6 }} />
        </div>

        {/* Context fields */}
        <div style={{ ...card, marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: "#6aaedd", fontWeight: 700, marginBottom: 12, letterSpacing: ".08em" }}>CONTEXT — makes simulation more accurate</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[
              { key: "finances", label: "💰 Finances",       ph: "e.g. $6k/mo income, $3k expenses, $20k savings" },
              { key: "family",   label: "👨‍👩‍👧 Family",        ph: "e.g. Married, 2 kids, partner works part-time" },
              { key: "energy",   label: "⚡ Energy/Schedule", ph: "e.g. Mornings sharp, low by 6pm, weekends free" },
              { key: "skills",   label: "🎯 Skills",          ph: "e.g. 10yrs marketing, decent content creator" },
            ].map(f => (
              <div key={f.key}>
                <label style={{ fontSize: 10, color: "#6aaedd", display: "block", marginBottom: 4 }}>{f.label}</label>
                <input value={context[f.key]} onChange={e => setContext(c => ({ ...c, [f.key]: e.target.value }))} placeholder={f.ph} style={inp} />
              </div>
            ))}
          </div>
        </div>

        {/* Saved sims */}
        {savedSims.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, color: "#4a5568", fontWeight: 700, marginBottom: 8, letterSpacing: ".08em" }}>SAVED SIMULATIONS</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {savedSims.map(s => (
                <button key={s.id} onClick={() => setWhatIf(s.whatIf)}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.07)", background: "transparent", color: "#c8c8d0", cursor: "pointer", textAlign: "left" }}>
                  <span style={{ fontSize: 14 }}>🌍</span>
                  <span style={{ flex: 1, fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title || s.whatIf}</span>
                  <span style={{ fontSize: 10, color: "#4a5568", flexShrink: 0 }}>{s.verdict}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {error && <div style={{ color: C.red, fontSize: 12, padding: "8px 12px", background: `${C.red}10`, borderRadius: 8, marginBottom: 12 }}>{error}</div>}

        <button onClick={run} disabled={!whatIf.trim()}
          style={{ width: "100%", padding: 14, borderRadius: 12, background: `linear-gradient(135deg, ${C.blue}, ${C.purple})`, border: "none", color: "#fff", fontSize: 14, fontWeight: 800, cursor: whatIf.trim() ? "pointer" : "not-allowed", opacity: whatIf.trim() ? 1 : 0.4 }}>
          🌍 Run Life Simulation
        </button>
      </div>
    </div>
  );

  // ── LOADING ──────────────────────────────────────────────────────────────
  if (phase === "loading") return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20 }}>
      <div style={{ fontSize: 56, animation: "altSpin 4s linear infinite" }}>🌍</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: C.blue }}>Simulating alternate timeline...</div>
      <div style={{ fontSize: 12, color: "#6aaedd", maxWidth: 340, textAlign: "center", lineHeight: 1.6 }}>
        Running multi-domain simulation across finances, family, energy, and Atlanta market data...
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center", maxWidth: 360 }}>
        {["Finances", "Family", "Energy", "Market", "Timeline", "Risk Flags", "Test Drive"].map((s, i) => (
          <div key={s} style={{ padding: "4px 12px", borderRadius: 20, background: `${C.blue}12`, border: `1px solid ${C.blue}25`, fontSize: 10, color: C.blue, animation: `altPulse 1.8s ease-in-out ${i * 0.25}s infinite` }}>{s}</div>
        ))}
      </div>
      <style>{`
        @keyframes altSpin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes altPulse { 0%,100%{opacity:.3} 50%{opacity:1} }
      `}</style>
    </div>
  );

  // ── RESULT ───────────────────────────────────────────────────────────────
  const TABS = [
    { id: "compare",   label: "⚖️ Compare"    },
    { id: "timeline",  label: "📅 Timeline"   },
    { id: "risks",     label: "⚠️ Risks"      },
    { id: "testdrive", label: "🚗 Test Drive"  },
    { id: "insights",  label: "💡 Insights"   },
  ];

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* Header */}
      <div style={{ background: `linear-gradient(135deg, ${C.blue}15, ${C.purple}10)`, borderBottom: `1px solid ${C.blue}25`, padding: "14px 20px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
              <button onClick={() => setPhase("input")} style={{ background: "none", border: "none", color: "#6aaedd", fontSize: 11, cursor: "pointer", padding: 0 }}>← Back</button>
              <span style={{ color: "#2a3a4a" }}>|</span>
              <span style={{ fontSize: 18 }}>{sim.scenarioEmoji || "🌍"}</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: C.blue }}>{sim.scenarioTitle}</span>
              <VerdictChip verdict={sim.verdict} />
            </div>
            {sim.verdictReason && <div style={{ fontSize: 12, color: "#8892a4", lineHeight: 1.5, maxWidth: 580 }}>{sim.verdictReason}</div>}
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <button onClick={saveSim} style={{ padding: "6px 12px", borderRadius: 8, background: `${C.gold}15`, border: `1px solid ${C.gold}30`, color: C.gold, fontSize: 11, cursor: "pointer" }}>
              Save
            </button>
            <button onClick={() => { setSim(null); setPhase("input"); }}
              style={{ padding: "6px 12px", borderRadius: 8, background: "transparent", border: `1px solid ${C.blue}30`, color: C.blue, fontSize: 11, cursor: "pointer" }}>
              New Sim
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 2, padding: "6px 14px", background: "#0f1120", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0, overflowX: "auto" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            style={{ padding: "6px 13px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", background: activeTab === t.id ? `${C.blue}20` : "transparent", color: activeTab === t.id ? C.blue : "#6aaedd", borderBottom: activeTab === t.id ? `2px solid ${C.blue}` : "2px solid transparent" }}>
            {t.label}
            {t.id === "risks" && sim.riskFlags?.length > 0 && (
              <span style={{ marginLeft: 4, background: C.red, color: "#fff", borderRadius: 10, padding: "1px 5px", fontSize: 9 }}>{sim.riskFlags.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>

        {/* ── COMPARE ── */}
        {activeTab === "compare" && (
          <div>
            {/* Side-by-side summary */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
              {[
                { data: sim.currentLife,   col: C.blue,   label: "Current Path"   },
                { data: sim.alternateLife, col: C.teal,   label: "Alternate Path"  },
              ].map(({ data, col, label }) => data && (
                <div key={label} style={{ background: `${col}08`, border: `1px solid ${col}25`, borderRadius: 12, padding: 16 }}>
                  <div style={{ fontSize: 10, color: col, fontWeight: 700, marginBottom: 6 }}>{label.toUpperCase()}</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "#f0ede8", marginBottom: 4 }}>{data.label}</div>
                  <div style={{ fontSize: 12, color: "#8892a4", lineHeight: 1.5, marginBottom: 10 }}>{data.summary}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: col }}>${(data.monthlyRevenue || 0).toLocaleString()}<span style={{ fontSize: 11, fontWeight: 400, color: "#6aaedd" }}>/mo</span></div>
                </div>
              ))}
            </div>

            {/* Radar + score bars */}
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-start" }}>
              {sim.currentLife && sim.alternateLife && (
                <div style={{ background: "#0f1120", borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{ fontSize: 10, color: "#4a5568", marginBottom: 8 }}>
                    <span style={{ color: C.blue }}>─</span> Current &nbsp; <span style={{ color: C.teal }}>╌</span> Alternate
                  </div>
                  <RadarChart current={sim.currentLife} alternate={sim.alternateLife} />
                </div>
              )}
              {sim.currentLife && sim.alternateLife && (
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#f0ede8", marginBottom: 12 }}>Score Shifts</div>
                  <ScoreRow label="Happiness"   current={sim.currentLife.happinessScore} alternate={sim.alternateLife.happinessScore} />
                  <ScoreRow label="Freedom"     current={sim.currentLife.freedomScore}   alternate={sim.alternateLife.freedomScore}   />
                  <ScoreRow label="Family Time" current={sim.currentLife.familyScore}    alternate={sim.alternateLife.familyScore}    />
                  <ScoreRow label="Stress"      current={sim.currentLife.stressScore}    alternate={sim.alternateLife.stressScore}    invert />
                  <div style={{ marginTop: 8, fontSize: 10, color: "#4a5568" }}>
                    <span style={{ color: C.blue }}>█</span> Current &nbsp; <span style={{ color: C.teal }}>▒</span> Alternate
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TIMELINE ── */}
        {activeTab === "timeline" && (
          <div style={{ maxWidth: 680 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#f0ede8", marginBottom: 4 }}>Side-by-Side Timeline</div>
            <div style={{ fontSize: 11, color: "#6aaedd", marginBottom: 16 }}>How both paths unfold month by month</div>

            {/* Column headers */}
            <div style={{ display: "grid", gridTemplateColumns: "100px 1fr 1fr", gap: 10, marginBottom: 8 }}>
              <div />
              <div style={{ fontSize: 10, color: C.blue, fontWeight: 700, textAlign: "center" }}>CURRENT PATH</div>
              <div style={{ fontSize: 10, color: C.teal, fontWeight: 700, textAlign: "center" }}>ALTERNATE PATH</div>
            </div>

            {(sim.timeline || []).map((row, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "100px 1fr 1fr", gap: 10, marginBottom: 12 }}>
                {/* Period label */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: `${C.purple}20`, border: `1px solid ${C.purple}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>{row.emoji}</div>
                  <div style={{ fontSize: 9, color: C.purple, fontWeight: 700, textAlign: "center" }}>{row.period}</div>
                  <div style={{ fontSize: 8, color: "#4a5568", textAlign: "center" }}>{row.phase}</div>
                </div>
                {/* Current */}
                <div style={{ background: `${C.blue}08`, border: `1px solid ${C.blue}15`, borderRadius: 10, padding: "10px 12px" }}>
                  {(row.currentEvents || []).map((e, j) => (
                    <div key={j} style={{ fontSize: 11, color: "#c8c8d0", display: "flex", gap: 5, marginBottom: 4 }}>
                      <span style={{ color: C.blue, flexShrink: 0 }}>▸</span>{e}
                    </div>
                  ))}
                </div>
                {/* Alternate */}
                <div style={{ background: `${C.teal}08`, border: `1px solid ${C.teal}15`, borderRadius: 10, padding: "10px 12px" }}>
                  {(row.alternateEvents || []).map((e, j) => (
                    <div key={j} style={{ fontSize: 11, color: "#c8c8d0", display: "flex", gap: 5, marginBottom: 4 }}>
                      <span style={{ color: C.teal, flexShrink: 0 }}>▸</span>{e}
                    </div>
                  ))}
                </div>
                {/* Pivot moment - spans full width */}
                {row.pivotMoment && (
                  <div style={{ gridColumn: "1 / -1", fontSize: 11, padding: "6px 12px", borderRadius: 8, background: `${C.gold}08`, border: `1px solid ${C.gold}20`, color: C.gold }}>
                    ⚡ Pivot: {row.pivotMoment}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── RISKS ── */}
        {activeTab === "risks" && (
          <div style={{ maxWidth: 560 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#f0ede8", marginBottom: 4 }}>Risk Flags</div>
            <div style={{ fontSize: 11, color: "#6aaedd", marginBottom: 16 }}>Tap each flag to reveal the mitigation strategy</div>
            {(!sim.riskFlags || sim.riskFlags.length === 0) ? (
              <div style={{ textAlign: "center", padding: 40, color: C.teal }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>✅</div>
                <div>No major risks flagged for this alternate path.</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {sim.riskFlags.map((r, i) => <RiskCard key={i} risk={r} />)}
              </div>
            )}
          </div>
        )}

        {/* ── TEST DRIVE ── */}
        {activeTab === "testdrive" && sim.testDrive && (
          <div style={{ maxWidth: 600 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#f0ede8", marginBottom: 2 }}>30-Day Test Drive</div>
            <div style={{ fontSize: 11, color: "#6aaedd", marginBottom: 16 }}>A micro-experiment to validate the alternate path before committing</div>

            {/* Hypothesis */}
            <div style={{ background: `${C.blue}08`, border: `1px solid ${C.blue}25`, borderRadius: 12, padding: 16, marginBottom: 14 }}>
              <div style={{ fontSize: 10, color: C.blue, fontWeight: 700, marginBottom: 6 }}>HYPOTHESIS</div>
              <div style={{ fontSize: 13, color: "#f0ede8", lineHeight: 1.6, fontStyle: "italic" }}>"{sim.testDrive.hypothesis}"</div>
            </div>

            {/* Protected family time */}
            {sim.testDrive.protectedFamilyTime && (
              <div style={{ background: `${C.pink}08`, border: `1px solid ${C.pink}25`, borderRadius: 12, padding: 14, marginBottom: 14 }}>
                <div style={{ fontSize: 10, color: C.pink, fontWeight: 700, marginBottom: 4 }}>👨‍👩‍👧 PROTECTED FAMILY TIME</div>
                <div style={{ fontSize: 12, color: "#c8c8d0" }}>{sim.testDrive.protectedFamilyTime}</div>
              </div>
            )}

            {/* Week-by-week */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#f0ede8", marginBottom: 10 }}>Week-by-Week Plan</div>
              {(sim.testDrive.weeks || []).map((w, i) => {
                const wCol = [C.blue, C.teal, C.orange, C.purple][i % 4];
                return (
                  <div key={i} style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 36, flexShrink: 0 }}>
                      <div style={{ width: 28, height: 28, borderRadius: "50%", background: `${wCol}20`, border: `2px solid ${wCol}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: wCol }}>{w.week}</div>
                      {i < 3 && <div style={{ width: 2, flex: 1, background: `${wCol}25`, minHeight: 16 }} />}
                    </div>
                    <div style={{ flex: 1, paddingBottom: 4 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: wCol, marginBottom: 4 }}>{w.focus}</div>
                      {(w.actions || []).map((a, j) => (
                        <div key={j} style={{ fontSize: 11, color: "#c8c8d0", display: "flex", gap: 5, marginBottom: 3 }}>
                          <span style={{ color: wCol }}>▸</span>{a}
                        </div>
                      ))}
                      {w.metric && (
                        <div style={{ marginTop: 6, fontSize: 10, padding: "3px 10px", borderRadius: 8, background: `${wCol}10`, border: `1px solid ${wCol}20`, color: wCol, display: "inline-block" }}>
                          📊 {w.metric}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Go / No-go signals */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {sim.testDrive.goSignal && (
                <div style={{ background: `${C.teal}08`, border: `1px solid ${C.teal}25`, borderRadius: 10, padding: 14 }}>
                  <div style={{ fontSize: 10, color: C.teal, fontWeight: 700, marginBottom: 4 }}>✅ GO SIGNAL</div>
                  <div style={{ fontSize: 12, color: "#c8c8d0", lineHeight: 1.5 }}>{sim.testDrive.goSignal}</div>
                </div>
              )}
              {sim.testDrive.noGoSignal && (
                <div style={{ background: `${C.red}08`, border: `1px solid ${C.red}25`, borderRadius: 10, padding: 14 }}>
                  <div style={{ fontSize: 10, color: C.red, fontWeight: 700, marginBottom: 4 }}>🛑 NO-GO SIGNAL</div>
                  <div style={{ fontSize: 12, color: "#c8c8d0", lineHeight: 1.5 }}>{sim.testDrive.noGoSignal}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── INSIGHTS ── */}
        {activeTab === "insights" && (
          <div style={{ maxWidth: 560 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#f0ede8", marginBottom: 16 }}>Deep Insights</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {sim.atlantaAngle && (
                <div style={{ background: `${C.gold}08`, border: `1px solid ${C.gold}25`, borderRadius: 12, padding: 16 }}>
                  <div style={{ fontSize: 10, color: C.gold, fontWeight: 700, marginBottom: 6 }}>🏙️ ATLANTA MARKET ANGLE</div>
                  <div style={{ fontSize: 13, color: "#c8c8d0", lineHeight: 1.7 }}>{sim.atlantaAngle}</div>
                </div>
              )}
              {sim.familyImpact && (
                <div style={{ background: `${C.pink}08`, border: `1px solid ${C.pink}25`, borderRadius: 12, padding: 16 }}>
                  <div style={{ fontSize: 10, color: C.pink, fontWeight: 700, marginBottom: 6 }}>👨‍👩‍👧 FAMILY IMPACT</div>
                  <div style={{ fontSize: 13, color: "#c8c8d0", lineHeight: 1.7 }}>{sim.familyImpact}</div>
                </div>
              )}
              {sim.hiddenAdvantage && (
                <div style={{ background: `${C.purple}08`, border: `1px solid ${C.purple}25`, borderRadius: 12, padding: 16 }}>
                  <div style={{ fontSize: 10, color: C.purple, fontWeight: 700, marginBottom: 6 }}>💎 HIDDEN ADVANTAGE</div>
                  <div style={{ fontSize: 13, color: "#c8c8d0", lineHeight: 1.7 }}>{sim.hiddenAdvantage}</div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}