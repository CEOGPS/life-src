import { useState, useCallback, useMemo } from "react";
import { invokeLLM } from "@/api/ceogpsclient";

const C = { purple: "#8b7fff", blue: "#4ab3f4", teal: "#00c896", orange: "#ff8c42", pink: "#ff6b9d", red: "#ff4f5e", gold: "#ffd700" };

const BUDGET_KEY  = "lifeos1_shadow_budget";
const ORACLE_KEY  = "lifeos1_oracle_insights";

function load(key, def) { try { return JSON.parse(localStorage.getItem(key) || "null") ?? def; } catch { return def; } }
function save(key, val) { localStorage.setItem(key, JSON.stringify(val)); }
const fmt = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n || 0);

// ── Default budget ────────────────────────────────────────────────────────────
const DEFAULT_BUDGET = {
  income: 8000,
  expenses: [
    { id: 1, label: "Rent/Mortgage",  amount: 1800, category: "Housing",     fixed: true  },
    { id: 2, label: "Groceries",      amount: 600,  category: "Food",        fixed: false },
    { id: 3, label: "Dining Out",     amount: 400,  category: "Food",        fixed: false },
    { id: 4, label: "Subscriptions",  amount: 200,  category: "Tech",        fixed: false },
    { id: 5, label: "Entertainment",  amount: 300,  category: "Lifestyle",   fixed: false },
    { id: 6, label: "Savings",        amount: 500,  category: "Savings",     fixed: false },
    { id: 7, label: "Business Tools", amount: 350,  category: "Business",    fixed: false },
    { id: 8, label: "Family/Kids",    amount: 400,  category: "Family",      fixed: false },
  ],
};

const SHADOW_COLORS = [C.purple, C.teal, C.orange];
const SHADOW_NAMES  = ["Shadow A", "Shadow B", "Shadow C"];

// ── AI prompts ────────────────────────────────────────────────────────────────
const ORACLE_SYSTEM = `You are the Shadow Budget Oracle for LifeOS1. You analyze financial patterns and surface non-obvious long-term ripple effects of everyday decisions.

Given the user's budget and context, return ONLY valid JSON:
{
  "insights": [
    {
      "category": "one of: Ripple | Shadow | Pattern | Warning | Opportunity",
      "title": "Short punchy title",
      "decision": "The specific everyday decision being flagged",
      "ripple": "What happens over 1-3 years if this continues",
      "shadowValue": "The invisible cost or gain expressed compellingly (e.g. 24 family dinners / $2,880/yr)",
      "happinessCorrelation": 15,
      "actionable": "One specific change to make this week",
      "urgency": "low|medium|high"
    }
  ],
  "shadowSummary": "2-sentence meta-insight about the biggest invisible pattern in this budget",
  "freedomNumber": 3200,
  "freedomNumberNote": "What the freedom number means for this person"
}`;

const SCENARIO_SYSTEM = `You are the Shadow Budget Oracle. Generate 3 shadow budget scenarios — parallel financial realities based on small changes.

Return ONLY valid JSON:
{
  "scenarios": [
    {
      "name": "Shadow A name (3-4 words)",
      "description": "1-sentence premise of this shadow reality",
      "change": "The single key spending change",
      "monthlyDelta": -200,
      "yearlyDelta": -2400,
      "month3": 1200,
      "month6": 2800,
      "month9": 4500,
      "month12": 6500,
      "happinessDelta": 8,
      "familyDinnersDelta": 12,
      "insightLine": "The non-obvious payoff of this scenario (specific, vivid)"
    },
    { "name":"...","description":"...","change":"...","monthlyDelta":0,"yearlyDelta":0,"month3":0,"month6":0,"month9":0,"month12":0,"happinessDelta":0,"familyDinnersDelta":0,"insightLine":"..." },
    { "name":"...","description":"...","change":"...","monthlyDelta":0,"yearlyDelta":0,"month3":0,"month6":0,"month9":0,"month12":0,"happinessDelta":0,"familyDinnersDelta":0,"insightLine":"..." }
  ]
}`;

const RIPPLE_SYSTEM = `You are the Shadow Budget Oracle analyzing a specific purchasing decision.

Return ONLY valid JSON:
{
  "decision": "restated decision",
  "immediateImpact": "What happens to this month's budget",
  "month3": -500,
  "month6": -1200,
  "month12": -2400,
  "year3": -7500,
  "shadowCost": "What $X over 3 years could instead have become (specific alternative use)",
  "happinessROI": "honest 1-sentence happiness return on this decision",
  "familyEquivalent": "equivalent in family experiences (e.g. '18 weekend day-trips')",
  "verdict": "Worth It | Skip It | Delay It | Negotiate It",
  "verdictReason": "1-sentence honest rationale",
  "alternativeChallenge": "A creative alternative that achieves 80% of the benefit at 30% of the cost"
}`;

function parseJSON(raw) {
  try { const m = raw.match(/\{[\s\S]*\}/); return m ? JSON.parse(m[0]) : null; } catch { return null; }
}

// ── Ripple SVG chart ──────────────────────────────────────────────────────────
function RippleChart({ current, scenarios, width = 340, height = 160 }) {
  const months = ["M3", "M6", "M9", "M12"];
  const currentSavings = [
    current.income - current.expenses.reduce((s, e) => s + e.amount, 0),
  ];
  const baseMonthly = current.income - current.expenses.reduce((s, e) => s + e.amount, 0);
  const basePoints = [baseMonthly * 3, baseMonthly * 6, baseMonthly * 9, baseMonthly * 12];

  const allVals = [
    ...basePoints,
    ...scenarios.flatMap(s => [s.month3, s.month6, s.month9, s.month12]),
  ].filter(v => typeof v === "number");

  const minV = Math.min(...allVals, 0);
  const maxV = Math.max(...allVals, 1000);
  const range = maxV - minV || 1;

  const PAD = { t: 16, r: 16, b: 28, l: 52 };
  const W = width - PAD.l - PAD.r;
  const H = height - PAD.t - PAD.b;
  const xStep = W / 3;

  function toY(v) { return PAD.t + H - ((v - minV) / range) * H; }
  function toX(i) { return PAD.l + i * xStep; }

  function pointsForLine(arr) {
    return arr.map((v, i) => `${toX(i)},${toY(v)}`).join(" ");
  }

  const basePts = pointsForLine(basePoints);

  return (
    <svg width={width} height={height} style={{ overflow: "visible" }}>
      {/* Grid */}
      {[0, 0.25, 0.5, 0.75, 1].map(pct => {
        const y = PAD.t + H * (1 - pct);
        const val = minV + pct * range;
        return (
          <g key={pct}>
            <line x1={PAD.l} x2={PAD.l + W} y1={y} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
            <text x={PAD.l - 4} y={y + 4} textAnchor="end" fill="#4a5568" fontSize={9}>
              {val >= 1000 ? `$${(val / 1000).toFixed(0)}k` : `$${Math.round(val)}`}
            </text>
          </g>
        );
      })}
      {/* X labels */}
      {months.map((m, i) => (
        <text key={m} x={toX(i)} y={height - 4} textAnchor="middle" fill="#6aaedd" fontSize={10}>{m}</text>
      ))}
      {/* Zero line */}
      {minV < 0 && (
        <line x1={PAD.l} x2={PAD.l + W} y1={toY(0)} y2={toY(0)} stroke="rgba(255,255,255,0.15)" strokeWidth={1} strokeDasharray="4 2" />
      )}
      {/* Current path */}
      <polyline points={basePts} fill="none" stroke={C.blue} strokeWidth={2} />
      {basePoints.map((v, i) => <circle key={i} cx={toX(i)} cy={toY(v)} r={3} fill={C.blue} />)}
      {/* Shadow paths */}
      {scenarios.map((s, si) => {
        const pts = pointsForLine([s.month3, s.month6, s.month9, s.month12]);
        const col = SHADOW_COLORS[si % SHADOW_COLORS.length];
        return (
          <g key={si}>
            <polyline points={pts} fill="none" stroke={col} strokeWidth={2} strokeDasharray="5 3" />
            {[s.month3, s.month6, s.month9, s.month12].map((v, i) => (
              <circle key={i} cx={toX(i)} cy={toY(v)} r={3} fill={col} />
            ))}
          </g>
        );
      })}
    </svg>
  );
}

// ── Urgency badge ─────────────────────────────────────────────────────────────
function UrgencyBadge({ urgency }) {
  const map = { high: C.red, medium: C.orange, low: C.teal };
  return <span style={{ fontSize: 9, padding: "1px 7px", borderRadius: 10, background: `${map[urgency]}20`, color: map[urgency], fontWeight: 700, border: `1px solid ${map[urgency]}30` }}>{urgency}</span>;
}

// ── Verdict chip ──────────────────────────────────────────────────────────────
function VerdictChip({ verdict }) {
  const map = { "Worth It": C.teal, "Skip It": C.red, "Delay It": C.orange, "Negotiate It": C.purple };
  const col = map[verdict] || C.purple;
  return <span style={{ fontSize: 11, padding: "3px 12px", borderRadius: 20, background: `${col}20`, color: col, fontWeight: 700, border: `1px solid ${col}40` }}>{verdict}</span>;
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function ShadowBudgetOracle({ onBack }) {
  const [activeTab, setActiveTab] = useState("shadow");

  // Budget state
  const [budget, setBudget] = useState(() => load(BUDGET_KEY, DEFAULT_BUDGET));
  const [editingBudget, setEditingBudget] = useState(false);
  const [newExpense, setNewExpense] = useState({ label: "", amount: "", category: "Lifestyle" });

  // Shadow scenarios
  const [scenarios, setScenarios]   = useState([]);
  const [scenLoading, setScenLoading] = useState(false);

  // Oracle insights
  const [oracle,       setOracle]       = useState(() => load(ORACLE_KEY, null));
  const [oracleLoad,   setOracleLoad]   = useState(false);

  // Decision scanner
  const [decision,     setDecision]     = useState("");
  const [decisionAmt,  setDecisionAmt]  = useState("");
  const [ripple,       setRipple]       = useState(null);
  const [rippleLoad,   setRippleLoad]   = useState(false);

  // Computed
  const totalExpenses = useMemo(() => budget.expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0), [budget]);
  const monthlySurplus = useMemo(() => (Number(budget.income) || 0) - totalExpenses, [budget.income, totalExpenses]);

  function saveBudget(b) { setBudget(b); save(BUDGET_KEY, b); }

  function updateExpense(id, field, val) {
    saveBudget({ ...budget, expenses: budget.expenses.map(e => e.id === id ? { ...e, [field]: field === "amount" ? Number(val) || 0 : val } : e) });
  }
  function removeExpense(id) { saveBudget({ ...budget, expenses: budget.expenses.filter(e => e.id !== id) }); }
  function addExpense() {
    if (!newExpense.label.trim() || !newExpense.amount) return;
    const next = { ...budget, expenses: [...budget.expenses, { ...newExpense, id: Date.now(), amount: Number(newExpense.amount), fixed: false }] };
    saveBudget(next);
    setNewExpense({ label: "", amount: "", category: "Lifestyle" });
  }

  // ── Generate scenarios ───────────────────────────────────────────────────
  const genScenarios = useCallback(async () => {
    setScenLoading(true); setScenarios([]);
    const prompt = [
      `Monthly income: ${fmt(budget.income)}`,
      `Monthly surplus: ${fmt(monthlySurplus)}`,
      `Expenses: ${budget.expenses.map(e => `${e.label}: ${fmt(e.amount)}`).join(", ")}`,
      `Location: Atlanta, GA. Marketing business owner, family-oriented.`,
    ].join("\n");
    const raw = await invokeLLM({ systemPrompt: SCENARIO_SYSTEM, prompt });
    const parsed = parseJSON(raw);
    if (parsed?.scenarios) setScenarios(parsed.scenarios);
    setScenLoading(false);
  }, [budget, monthlySurplus]);

  // ── Run oracle ───────────────────────────────────────────────────────────
  const runOracle = useCallback(async () => {
    setOracleLoad(true); setOracle(null);
    const prompt = [
      `Monthly income: ${fmt(budget.income)}, surplus: ${fmt(monthlySurplus)}`,
      `Expenses: ${budget.expenses.map(e => `${e.label}: ${fmt(e.amount)} (${e.category})`).join(", ")}`,
      `Atlanta marketing business owner, family man, gamer.`,
    ].join("\n");
    const raw = await invokeLLM({ systemPrompt: ORACLE_SYSTEM, prompt });
    const parsed = parseJSON(raw);
    if (parsed) { setOracle(parsed); save(ORACLE_KEY, parsed); }
    setOracleLoad(false);
  }, [budget, monthlySurplus]);

  // ── Scan decision ────────────────────────────────────────────────────────
  const scanDecision = useCallback(async () => {
    if (!decision.trim()) return;
    setRippleLoad(true); setRipple(null);
    const prompt = [
      `Decision: ${decision}${decisionAmt ? ` — cost: $${decisionAmt}` : ""}`,
      `Current monthly surplus: ${fmt(monthlySurplus)}`,
      `Monthly income: ${fmt(budget.income)}`,
      `Atlanta family-focused marketing entrepreneur.`,
    ].join("\n");
    const raw = await invokeLLM({ systemPrompt: RIPPLE_SYSTEM, prompt });
    setRipple(parseJSON(raw));
    setRippleLoad(false);
  }, [decision, decisionAmt, budget, monthlySurplus]);

  // Styles
  const card = { background: "#11131f", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12 };
  const inp  = { padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "#0a0b12", fontSize: 12, color: "#f0ede8", outline: "none", boxSizing: "border-box", width: "100%" };
  const btnS = (col) => ({ padding: "6px 14px", borderRadius: 8, background: `${col}15`, border: `1px solid ${col}40`, color: col, fontSize: 11, fontWeight: 600, cursor: "pointer" });
  const btnP = (col) => ({ padding: "10px 20px", borderRadius: 10, background: `linear-gradient(135deg, ${col}, ${col}90)`, border: "none", color: "#0a0b12", fontSize: 12, fontWeight: 800, cursor: "pointer" });

  const TABS = [
    { id: "shadow",   label: "🌑 Shadow View"     },
    { id: "ripple",   label: "📊 Ripple Chart"    },
    { id: "decision", label: "⚡ Decision Scanner" },
    { id: "oracle",   label: "🔮 Oracle Feed"      },
  ];

  const CATEGORIES = ["Housing", "Food", "Tech", "Lifestyle", "Business", "Family", "Savings", "Transport", "Health", "Other"];

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* Header */}
      <div style={{ background: `linear-gradient(135deg, ${C.purple}15, ${C.blue}10)`, borderBottom: `1px solid ${C.purple}25`, padding: "14px 20px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={onBack} style={{ background: "none", border: "none", color: "#6aaedd", fontSize: 11, cursor: "pointer", padding: 0 }}>← Back</button>
          <span style={{ color: "#2a3a4a" }}>|</span>
          <span style={{ fontSize: 20 }}>🔮</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: C.purple }}>Shadow Budget Oracle</div>
            <div style={{ fontSize: 11, color: "#6aaedd" }}>Parallel financial realities · Ripple effects of everyday decisions</div>
          </div>
          {/* Summary chips */}
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: monthlySurplus >= 0 ? C.teal : C.red }}>{fmt(monthlySurplus)}</div>
              <div style={{ fontSize: 9, color: "#4a5568" }}>Monthly Surplus</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: C.gold }}>{fmt(monthlySurplus * 12)}</div>
              <div style={{ fontSize: 9, color: "#4a5568" }}>Yearly Potential</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 2, padding: "6px 14px", background: "#0f1120", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            style={{ padding: "6px 13px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", background: activeTab === t.id ? `${C.purple}20` : "transparent", color: activeTab === t.id ? C.purple : "#6aaedd", borderBottom: activeTab === t.id ? `2px solid ${C.purple}` : "2px solid transparent" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── SHADOW VIEW TAB ── */}
      {activeTab === "shadow" && (
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

          {/* Budget editor sidebar */}
          <div style={{ width: 260, flexShrink: 0, borderRight: "1px solid rgba(255,255,255,0.06)", overflowY: "auto", padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: C.purple, fontWeight: 700 }}>CURRENT BUDGET</div>
              <button onClick={() => setEditingBudget(e => !e)} style={btnS(C.purple)}>{editingBudget ? "Done" : "Edit"}</button>
            </div>

            {/* Income */}
            <div style={{ marginBottom: 12, padding: "10px 12px", background: `${C.teal}08`, border: `1px solid ${C.teal}20`, borderRadius: 10 }}>
              <div style={{ fontSize: 10, color: C.teal, fontWeight: 700, marginBottom: 4 }}>MONTHLY INCOME</div>
              {editingBudget ? (
                <input type="number" value={budget.income} onChange={e => saveBudget({ ...budget, income: Number(e.target.value) || 0 })}
                  style={{ ...inp, fontSize: 16, fontWeight: 800, color: C.teal, background: "transparent", border: "none", padding: "0", width: "100%" }} />
              ) : (
                <div style={{ fontSize: 18, fontWeight: 800, color: C.teal }}>{fmt(budget.income)}</div>
              )}
            </div>

            {/* Expenses */}
            <div style={{ fontSize: 10, color: "#4a5568", fontWeight: 700, marginBottom: 8 }}>EXPENSES</div>
            {budget.expenses.map(e => (
              <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, padding: "6px 8px", borderRadius: 8, background: "rgba(255,255,255,0.02)" }}>
                {editingBudget ? (
                  <>
                    <input value={e.label} onChange={ev => updateExpense(e.id, "label", ev.target.value)}
                      style={{ ...inp, flex: 1, fontSize: 11, padding: "4px 8px" }} />
                    <input type="number" value={e.amount} onChange={ev => updateExpense(e.id, "amount", ev.target.value)}
                      style={{ ...inp, width: 70, fontSize: 11, padding: "4px 8px" }} />
                    <button onClick={() => removeExpense(e.id)} style={{ background: "none", border: "none", color: C.red, cursor: "pointer", fontSize: 14, flexShrink: 0 }}>×</button>
                  </>
                ) : (
                  <>
                    <span style={{ flex: 1, fontSize: 11, color: "#c8c8d0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.label}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "#f0ede8", flexShrink: 0 }}>{fmt(e.amount)}</span>
                  </>
                )}
              </div>
            ))}

            {/* Add expense */}
            {editingBudget && (
              <div style={{ marginTop: 8, padding: "10px", background: `${C.purple}08`, borderRadius: 10, border: `1px solid ${C.purple}20` }}>
                <div style={{ fontSize: 10, color: C.purple, fontWeight: 700, marginBottom: 6 }}>ADD EXPENSE</div>
                <input value={newExpense.label} onChange={e => setNewExpense(n => ({ ...n, label: e.target.value }))} placeholder="Label" style={{ ...inp, marginBottom: 6, fontSize: 11 }} />
                <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                  <input type="number" value={newExpense.amount} onChange={e => setNewExpense(n => ({ ...n, amount: e.target.value }))} placeholder="Amount" style={{ ...inp, flex: 1, fontSize: 11 }} />
                  <select value={newExpense.category} onChange={e => setNewExpense(n => ({ ...n, category: e.target.value }))}
                    style={{ ...inp, flex: 1, fontSize: 11, appearance: "none" }}>
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <button onClick={addExpense} style={{ ...btnS(C.purple), width: "100%" }}>Add</button>
              </div>
            )}

            {/* Surplus */}
            <div style={{ marginTop: 12, padding: "10px 12px", background: `${monthlySurplus >= 0 ? C.teal : C.red}08`, border: `1px solid ${monthlySurplus >= 0 ? C.teal : C.red}20`, borderRadius: 10 }}>
              <div style={{ fontSize: 10, color: monthlySurplus >= 0 ? C.teal : C.red, fontWeight: 700, marginBottom: 2 }}>MONTHLY SURPLUS</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: monthlySurplus >= 0 ? C.teal : C.red }}>{fmt(monthlySurplus)}</div>
              <div style={{ fontSize: 10, color: "#6aaedd", marginTop: 2 }}>= {fmt(monthlySurplus * 12)}/yr</div>
            </div>
          </div>

          {/* Shadow scenarios main area */}
          <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#f0ede8" }}>Shadow Budget Scenarios</div>
                <div style={{ fontSize: 11, color: "#6aaedd" }}>3 parallel financial realities from small changes to your current budget</div>
              </div>
              <button onClick={genScenarios} disabled={scenLoading} style={btnP(C.purple)}>
                {scenLoading ? "Simulating..." : "🌑 Generate Shadows"}
              </button>
            </div>

            {scenarios.length === 0 && !scenLoading && (
              <div style={{ textAlign: "center", padding: 60, color: "#4a5568" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🌑</div>
                <div style={{ fontSize: 13, lineHeight: 1.6, maxWidth: 360, margin: "0 auto" }}>
                  Generate shadow scenarios to see 3 alternate financial realities based on small changes to your current budget.
                </div>
              </div>
            )}

            {scenLoading && (
              <div style={{ textAlign: "center", padding: 40, color: C.purple }}>
                <div style={{ fontSize: 36, marginBottom: 8, animation: "shadowPulse 1.5s ease-in-out infinite" }}>🔮</div>
                <div>Simulating parallel financial realities...</div>
                <style>{`@keyframes shadowPulse { 0%,100%{opacity:.4} 50%{opacity:1} }`}</style>
              </div>
            )}

            {scenarios.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {/* Current baseline card */}
                <div style={{ background: `${C.blue}08`, border: `1px solid ${C.blue}25`, borderRadius: 12, padding: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <span style={{ fontSize: 10, padding: "2px 10px", borderRadius: 10, background: `${C.blue}20`, color: C.blue, fontWeight: 700 }}>CURRENT REALITY</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#f0ede8" }}>Status Quo Path</span>
                  </div>
                  <div style={{ display: "flex", gap: 20 }}>
                    <div><div style={{ fontSize: 9, color: "#4a5568" }}>Monthly surplus</div><div style={{ fontSize: 16, fontWeight: 800, color: C.blue }}>{fmt(monthlySurplus)}</div></div>
                    <div><div style={{ fontSize: 9, color: "#4a5568" }}>12-month savings</div><div style={{ fontSize: 16, fontWeight: 800, color: C.blue }}>{fmt(monthlySurplus * 12)}</div></div>
                  </div>
                </div>

                {/* Shadow scenario cards */}
                {scenarios.map((s, i) => {
                  const col = SHADOW_COLORS[i % SHADOW_COLORS.length];
                  return (
                    <div key={i} style={{ background: `${col}06`, border: `1px solid ${col}25`, borderRadius: 12, padding: 16 }}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                            <span style={{ fontSize: 10, padding: "2px 10px", borderRadius: 10, background: `${col}20`, color: col, fontWeight: 700 }}>
                              {SHADOW_NAMES[i]}
                            </span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: "#f0ede8" }}>{s.name}</span>
                          </div>
                          <div style={{ fontSize: 11, color: "#8892a4", marginBottom: 6 }}>{s.description}</div>
                          <div style={{ fontSize: 11, padding: "5px 10px", borderRadius: 8, background: `${col}10`, border: `1px solid ${col}20`, color: col, display: "inline-block" }}>
                            🔄 Change: {s.change}
                          </div>
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <div style={{ fontSize: 9, color: "#4a5568", marginBottom: 2 }}>Monthly delta</div>
                          <div style={{ fontSize: 16, fontWeight: 800, color: s.monthlyDelta >= 0 ? C.teal : C.red }}>
                            {s.monthlyDelta >= 0 ? "+" : ""}{fmt(s.monthlyDelta)}
                          </div>
                          <div style={{ fontSize: 10, color: "#6aaedd" }}>{fmt(s.yearlyDelta)}/yr</div>
                        </div>
                      </div>

                      {/* 12-month savings progression */}
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 10 }}>
                        {[["M3", s.month3], ["M6", s.month6], ["M9", s.month9], ["M12", s.month12]].map(([label, val]) => (
                          <div key={label} style={{ textAlign: "center", padding: "6px 4px", background: `${col}10`, borderRadius: 8 }}>
                            <div style={{ fontSize: 9, color: "#4a5568" }}>{label}</div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: col }}>{fmt(val)}</div>
                          </div>
                        ))}
                      </div>

                      {/* Bonus metrics */}
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
                        {s.happinessDelta !== 0 && (
                          <span style={{ fontSize: 11, color: s.happinessDelta > 0 ? C.teal : C.red, fontWeight: 600 }}>
                            😊 {s.happinessDelta > 0 ? "+" : ""}{s.happinessDelta}% happiness
                          </span>
                        )}
                        {s.familyDinnersDelta !== 0 && (
                          <span style={{ fontSize: 11, color: C.pink, fontWeight: 600 }}>
                            🍽️ +{s.familyDinnersDelta} family dinners/yr
                          </span>
                        )}
                      </div>

                      {s.insightLine && (
                        <div style={{ fontSize: 11, color: "#c8c8d0", padding: "6px 10px", background: "rgba(255,255,255,0.03)", borderRadius: 8, fontStyle: "italic" }}>
                          💡 {s.insightLine}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── RIPPLE CHART TAB ── */}
      {activeTab === "ripple" && (
        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#f0ede8", marginBottom: 4 }}>12-Month Ripple Projection</div>
          <div style={{ fontSize: 11, color: "#6aaedd", marginBottom: 16 }}>Cumulative savings across your current budget and shadow scenarios</div>

          {scenarios.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: "#4a5568" }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>📊</div>
              <div>Generate shadow scenarios first to see the ripple chart.</div>
              <button onClick={() => setActiveTab("shadow")} style={{ ...btnS(C.purple), marginTop: 12 }}>Go to Shadow View</button>
            </div>
          ) : (
            <>
              {/* Legend */}
              <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 20, height: 2, background: C.blue }} />
                  <span style={{ fontSize: 11, color: C.blue }}>Current</span>
                </div>
                {scenarios.map((s, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 20, height: 2, background: SHADOW_COLORS[i], opacity: 0.8, borderTop: `2px dashed ${SHADOW_COLORS[i]}` }} />
                    <span style={{ fontSize: 11, color: SHADOW_COLORS[i] }}>{s.name}</span>
                  </div>
                ))}
              </div>

              {/* Chart */}
              <div style={{ background: "#0f1120", borderRadius: 14, padding: "20px 16px", marginBottom: 20, overflowX: "auto" }}>
                <RippleChart current={budget} scenarios={scenarios} width={Math.max(340, 560)} height={200} />
              </div>

              {/* M12 comparison table */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
                <div style={{ ...card, padding: 14, border: `1px solid ${C.blue}25` }}>
                  <div style={{ fontSize: 10, color: C.blue, fontWeight: 700, marginBottom: 4 }}>Current Path (M12)</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: C.blue }}>{fmt(monthlySurplus * 12)}</div>
                </div>
                {scenarios.map((s, i) => (
                  <div key={i} style={{ ...card, padding: 14, border: `1px solid ${SHADOW_COLORS[i]}25` }}>
                    <div style={{ fontSize: 10, color: SHADOW_COLORS[i], fontWeight: 700, marginBottom: 4 }}>{s.name} (M12)</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: SHADOW_COLORS[i] }}>{fmt(s.month12)}</div>
                    <div style={{ fontSize: 10, color: s.month12 > monthlySurplus * 12 ? C.teal : C.red, marginTop: 2, fontWeight: 600 }}>
                      {s.month12 > monthlySurplus * 12 ? "▲" : "▼"} {fmt(Math.abs(s.month12 - monthlySurplus * 12))} vs current
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── DECISION SCANNER TAB ── */}
      {activeTab === "decision" && (
        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#f0ede8", marginBottom: 4 }}>Decision Scanner</div>
          <div style={{ fontSize: 11, color: "#6aaedd", marginBottom: 20 }}>Enter any spending decision — see its 3-year ripple, family equivalent, and verdict</div>

          <div style={{ maxWidth: 600 }}>
            <div style={{ ...card, padding: 16, marginBottom: 14, border: `1px solid ${C.orange}25` }}>
              <label style={{ fontSize: 10, color: C.orange, fontWeight: 700, display: "block", marginBottom: 6 }}>⚡ THE DECISION</label>
              <input value={decision} onChange={e => setDecision(e.target.value)}
                placeholder="e.g. Buy a new $800 gaming setup, upgrade MacBook for $2,400, subscribe to another SaaS at $150/mo..."
                style={{ ...inp, marginBottom: 10 }} />
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 10, color: "#6aaedd", display: "block", marginBottom: 4 }}>Cost (if not mentioned above)</label>
                  <input type="number" value={decisionAmt} onChange={e => setDecisionAmt(e.target.value)}
                    placeholder="$" style={{ ...inp }} />
                </div>
                <button onClick={scanDecision} disabled={rippleLoad || !decision.trim()}
                  style={{ ...btnP(C.orange), alignSelf: "flex-end", whiteSpace: "nowrap", opacity: decision.trim() ? 1 : 0.4 }}>
                  {rippleLoad ? "Scanning..." : "⚡ Scan Ripple"}
                </button>
              </div>
            </div>

            {/* Quick scan presets */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
              {["New gaming setup $800", "MacBook upgrade $2,400", "SaaS subscription $150/mo", "Family vacation $3,500", "Business coach $500/mo"].map(p => (
                <button key={p} onClick={() => setDecision(p)}
                  style={{ padding: "4px 12px", borderRadius: 20, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#8892a4", fontSize: 10, cursor: "pointer" }}>
                  {p}
                </button>
              ))}
            </div>

            {ripple && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {/* Verdict */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", background: "#11131f", borderRadius: 12 }}>
                  <VerdictChip verdict={ripple.verdict} />
                  <span style={{ fontSize: 12, color: "#c8c8d0" }}>{ripple.verdictReason}</span>
                </div>

                {/* Ripple timeline */}
                <div style={{ ...card, padding: 16 }}>
                  <div style={{ fontSize: 10, color: C.orange, fontWeight: 700, marginBottom: 10 }}>CUMULATIVE COST RIPPLE</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                    {[["3 Months", ripple.month3], ["6 Months", ripple.month6], ["12 Months", ripple.month12], ["3 Years", ripple.year3]].map(([label, val]) => (
                      <div key={label} style={{ textAlign: "center", padding: "8px", background: `${C.red}08`, borderRadius: 8 }}>
                        <div style={{ fontSize: 9, color: "#4a5568" }}>{label}</div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: val < 0 ? C.red : C.teal }}>{fmt(val)}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Shadow cost + family equivalent */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {ripple.shadowCost && (
                    <div style={{ ...card, padding: 14, border: `1px solid ${C.purple}20` }}>
                      <div style={{ fontSize: 10, color: C.purple, fontWeight: 700, marginBottom: 4 }}>🌑 SHADOW COST</div>
                      <div style={{ fontSize: 12, color: "#c8c8d0", lineHeight: 1.5 }}>{ripple.shadowCost}</div>
                    </div>
                  )}
                  {ripple.familyEquivalent && (
                    <div style={{ ...card, padding: 14, border: `1px solid ${C.pink}20` }}>
                      <div style={{ fontSize: 10, color: C.pink, fontWeight: 700, marginBottom: 4 }}>👨‍👩‍👧 FAMILY EQUIVALENT</div>
                      <div style={{ fontSize: 12, color: "#c8c8d0", lineHeight: 1.5 }}>{ripple.familyEquivalent}</div>
                    </div>
                  )}
                </div>

                {ripple.happinessROI && (
                  <div style={{ ...card, padding: 12, border: `1px solid ${C.gold}20` }}>
                    <div style={{ fontSize: 10, color: C.gold, fontWeight: 700, marginBottom: 4 }}>😊 HAPPINESS ROI</div>
                    <div style={{ fontSize: 12, color: "#c8c8d0" }}>{ripple.happinessROI}</div>
                  </div>
                )}

                {ripple.alternativeChallenge && (
                  <div style={{ ...card, padding: 12, border: `1px solid ${C.teal}20` }}>
                    <div style={{ fontSize: 10, color: C.teal, fontWeight: 700, marginBottom: 4 }}>💡 ALTERNATIVE CHALLENGE</div>
                    <div style={{ fontSize: 12, color: "#c8c8d0" }}>{ripple.alternativeChallenge}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ORACLE FEED TAB ── */}
      {activeTab === "oracle" && (
        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#f0ede8" }}>Oracle Insight Feed</div>
            <button onClick={runOracle} disabled={oracleLoad} style={btnP(C.purple)}>
              {oracleLoad ? "Reading shadows..." : "🔮 Run Oracle"}
            </button>
          </div>
          <div style={{ fontSize: 11, color: "#6aaedd", marginBottom: 20 }}>Proactive ripple flags — tiny decisions with outsized long-term consequences</div>

          {!oracle && !oracleLoad && (
            <div style={{ textAlign: "center", padding: 60, color: "#4a5568" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🔮</div>
              <div style={{ fontSize: 13, maxWidth: 360, margin: "0 auto", lineHeight: 1.6 }}>
                The Oracle scans your budget for invisible patterns and flags everyday decisions with outsized long-term ripple effects.
              </div>
            </div>
          )}

          {oracleLoad && (
            <div style={{ textAlign: "center", padding: 40, color: C.purple }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>🔮</div>
              <div>The Oracle is reading your shadow patterns...</div>
            </div>
          )}

          {oracle && (
            <div style={{ maxWidth: 640 }}>
              {/* Freedom number */}
              {oracle.freedomNumber && (
                <div style={{ background: `${C.gold}08`, border: `1px solid ${C.gold}30`, borderRadius: 14, padding: 16, marginBottom: 20 }}>
                  <div style={{ fontSize: 10, color: C.gold, fontWeight: 700, marginBottom: 4 }}>🔮 YOUR FREEDOM NUMBER</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: C.gold, marginBottom: 4 }}>{fmt(oracle.freedomNumber)}</div>
                  <div style={{ fontSize: 12, color: "#c8c8d0" }}>{oracle.freedomNumberNote}</div>
                </div>
              )}

              {/* Shadow summary */}
              {oracle.shadowSummary && (
                <div style={{ ...card, padding: 14, marginBottom: 16, borderLeft: `3px solid ${C.purple}` }}>
                  <div style={{ fontSize: 10, color: C.purple, fontWeight: 700, marginBottom: 4 }}>🌑 SHADOW PATTERN SUMMARY</div>
                  <div style={{ fontSize: 12, color: "#c8c8d0", lineHeight: 1.7 }}>{oracle.shadowSummary}</div>
                </div>
              )}

              {/* Insight flags */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {(oracle.insights || []).map((ins, i) => {
                  const catColors = { Ripple: C.purple, Shadow: C.blue, Pattern: C.orange, Warning: C.red, Opportunity: C.teal };
                  const col = catColors[ins.category] || C.purple;
                  return (
                    <div key={i} style={{ background: `${col}06`, border: `1px solid ${col}20`, borderRadius: 12, padding: 16 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 10, padding: "2px 9px", borderRadius: 10, background: `${col}20`, color: col, fontWeight: 700 }}>{ins.category}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#f0ede8" }}>{ins.title}</span>
                        <UrgencyBadge urgency={ins.urgency} />
                      </div>

                      {ins.decision && (
                        <div style={{ fontSize: 11, color: "#8892a4", marginBottom: 6 }}>
                          Decision: <span style={{ color: "#c8c8d0" }}>{ins.decision}</span>
                        </div>
                      )}

                      {ins.ripple && (
                        <div style={{ fontSize: 12, color: "#c8c8d0", lineHeight: 1.6, marginBottom: 8 }}>{ins.ripple}</div>
                      )}

                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                        {ins.shadowValue && (
                          <div style={{ fontSize: 11, padding: "4px 10px", borderRadius: 8, background: `${col}12`, border: `1px solid ${col}20`, color: col }}>
                            🌑 {ins.shadowValue}
                          </div>
                        )}
                        {ins.happinessCorrelation !== 0 && (
                          <div style={{ fontSize: 11, padding: "4px 10px", borderRadius: 8, background: `${C.pink}10`, border: `1px solid ${C.pink}20`, color: C.pink }}>
                            😊 {ins.happinessCorrelation > 0 ? "+" : ""}{ins.happinessCorrelation}% happiness
                          </div>
                        )}
                      </div>

                      {ins.actionable && (
                        <div style={{ fontSize: 11, padding: "6px 10px", borderRadius: 8, background: `${C.teal}08`, border: `1px solid ${C.teal}20`, color: C.teal }}>
                          ▸ This week: {ins.actionable}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
