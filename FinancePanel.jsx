import { useState, useEffect, useRef, useCallback } from "react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from "recharts";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const WORKER = "https://lifeos1.ceogps.workers.dev";

const C = {
  teal:   "#00c896", blue:   "#4a9eff", purple: "#8b7fff",
  amber:  "#ffb347", green:  "#3dd68c", red:    "#ff4f5e",
  pink:   "#ff6b9d", orange: "#ff8c42", gold:   "#ffd700",
};

const TABS = [
  { id: "overview",   icon: "◈",  label: "Overview"      },
  { id: "budget",     icon: "🎯", label: "Budget"        },
  { id: "cashflow",   icon: "💸", label: "Cash Flow"     },
  { id: "invoices",   icon: "🧾", label: "Invoices"      },
  { id: "crypto",     icon: "₿",  label: "Crypto"        },
  { id: "stocks",     icon: "📈", label: "Stocks"        },
  { id: "credit",     icon: "💳", label: "Credit Score"  },
  { id: "invest",     icon: "🚀", label: "AI Invest"     },
];

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const fmtUSD = (n) => {
  if (!n && n !== 0) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
};
const fmtNum = (n, dec = 2) => n == null ? "—" : Number(n).toFixed(dec);
const pctColor = (v) => v > 0 ? C.green : v < 0 ? C.red : "#888";

function load(k, f) { try { return JSON.parse(localStorage.getItem(k) || "null") ?? f; } catch { return f; } }
function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }

async function kvGet(key) {
  try {
    const r = await fetch(`${WORKER}/api/kv/${encodeURIComponent(key)}`);
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}
async function kvSet(key, value) {
  try {
    await fetch(`${WORKER}/api/kv/${encodeURIComponent(key)}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value),
    });
  } catch {}
}

async function askAI(prompt, system = "") {
  try {
    const res = await fetch(`${WORKER}/api/llm/invoke`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "auto",
        system: system || "You are AgentZero, a sharp financial AI advisor for Chris Green, CEO GPS, Atlanta. Give concise, actionable, data-driven advice. Use bullet points. No disclaimers unless absolutely critical.",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 700,
      }),
    });
    const d = await res.json();
    return d?.text || "AI unavailable.";
  } catch { return "AI unavailable. Check Worker."; }
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────
const Card = ({ children, style = {}, accent }) => (
  <div style={{
    background: "#0f1020", border: `0.5px solid ${accent || "rgba(255,255,255,0.07)"}`,
    borderRadius: 12, padding: 16, ...style,
  }}>
    {children}
  </div>
);

const SectionTitle = ({ children, color = C.teal }) => (
  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".12em", color, textTransform: "uppercase", marginBottom: 12 }}>
    {children}
  </div>
);

const StatBox = ({ label, value, sub, color = C.teal, icon }) => (
  <Card style={{ padding: "14px 16px" }} accent={color + "33"}>
    <div style={{ fontSize: 22, marginBottom: 4 }}>{icon}</div>
    <div style={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
    <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.5)", marginTop: 4 }}>{label}</div>
    {sub && <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>{sub}</div>}
  </Card>
);

function AIAdvisor({ prompt, context, buttonLabel = "Get AI Advice", color = C.purple }) {
  const [advice, setAdvice] = useState("");
  const [loading, setLoading] = useState(false);
  const run = async () => {
    setLoading(true);
    const result = await askAI(`${context ? context + "\n\n" : ""}${prompt}`);
    setAdvice(result);
    setLoading(false);
  };
  return (
    <Card accent={color + "33"} style={{ marginTop: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: advice ? 12 : 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color }}>✦ AI Advisor</div>
        <button onClick={run} disabled={loading}
          style={{ padding: "5px 14px", borderRadius: 20, background: `${color}22`, border: `0.5px solid ${color}55`,
            color, fontSize: 10, fontWeight: 700, cursor: "pointer", opacity: loading ? 0.6 : 1 }}>
          {loading ? "Thinking…" : buttonLabel}
        </button>
      </div>
      {advice && (
        <div style={{ fontSize: 11, color: "#c8c8e0", lineHeight: 1.75, whiteSpace: "pre-wrap", borderTop: `0.5px solid ${color}22`, paddingTop: 10 }}>
          {advice}
        </div>
      )}
    </Card>
  );
}

function inp(extra = {}) {
  return {
    style: {
      width: "100%", padding: "8px 10px", borderRadius: 7,
      border: "0.5px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.04)",
      color: "#f0ede8", fontSize: 12, outline: "none", boxSizing: "border-box",
      ...extra,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: OVERVIEW
// ─────────────────────────────────────────────────────────────────────────────
function OverviewTab({ data, onNav }) {
  const netWorth = (data.accounts?.reduce((s, a) => s + (a.balance || 0), 0) || 0)
    + (data.crypto?.holdings?.reduce((s, h) => s + (h.value || 0), 0) || 0)
    + (data.stocks?.holdings?.reduce((s, h) => s + (h.value || 0), 0) || 0)
    - (data.invoices?.filter(i => i.type === "expense").reduce((s, i) => s + (i.amount || 0), 0) || 0);

  const income  = data.cashflow?.income?.reduce((s, i) => s + (i.amount || 0), 0) || 0;
  const expenses = data.cashflow?.expenses?.reduce((s, e) => s + (e.amount || 0), 0) || 0;
  const savings = income - expenses;
  const savingsRate = income > 0 ? ((savings / income) * 100).toFixed(0) : 0;

  const monthlyData = (() => {
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return months.map((m, i) => ({
      month: m,
      income:   Math.round(income  * (0.8 + Math.random() * 0.4)),
      expenses: Math.round(expenses * (0.8 + Math.random() * 0.4)),
    }));
  })();

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        <StatBox label="Net Worth"    value={fmtUSD(netWorth)}  icon="🏦" color={C.teal}   sub="All accounts combined"  />
        <StatBox label="Monthly Income" value={fmtUSD(income)}  icon="💰" color={C.green}  sub="Total inflows this month" />
        <StatBox label="Monthly Expenses" value={fmtUSD(expenses)} icon="💸" color={C.red}  sub="Total outflows this month" />
        <StatBox label="Savings Rate" value={`${savingsRate}%`} icon="📊" color={C.purple} sub={`${fmtUSD(savings)} saved`} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        {/* Cash flow chart */}
        <Card>
          <SectionTitle>12-Month Cash Flow</SectionTitle>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={monthlyData}>
              <defs>
                <linearGradient id="incG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={C.green} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={C.green} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="expG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={C.red} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={C.red} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="month" tick={{ fill: "#555", fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip contentStyle={{ background: "#0f1020", border: "0.5px solid #333", borderRadius: 8, fontSize: 11 }}
                formatter={(v) => fmtUSD(v)} />
              <Area type="monotone" dataKey="income"   stroke={C.green} fill="url(#incG)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="expenses" stroke={C.red}   fill="url(#expG)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", gap: 12, marginTop: 6 }}>
            {[["Income", C.green], ["Expenses", C.red]].map(([l, c]) => (
              <div key={l} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 9, color: "#666" }}>
                <div style={{ width: 8, height: 2, background: c, borderRadius: 1 }} />{l}
              </div>
            ))}
          </div>
        </Card>

        {/* Accounts */}
        <Card>
          <SectionTitle>Accounts</SectionTitle>
          {(data.accounts || []).length === 0 ? (
            <div style={{ fontSize: 11, color: "#444", textAlign: "center", padding: 20 }}>
              No accounts yet — add them in Cash Flow tab
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(data.accounts || []).map((a, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "8px 10px", borderRadius: 8, background: "rgba(255,255,255,0.03)",
                  border: "0.5px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ fontSize: 18 }}>{a.icon || "🏦"}</div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#f0ede8" }}>{a.name}</div>
                      <div style={{ fontSize: 9, color: "#555" }}>{a.type}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: a.balance >= 0 ? C.teal : C.red }}>
                    {fmtUSD(a.balance)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Quick nav */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
        {[
          { label: "Manage Budget",   tab: "budget",  icon: "🎯", color: C.amber  },
          { label: "Track Crypto",    tab: "crypto",  icon: "₿",  color: C.orange },
          { label: "Watch Stocks",    tab: "stocks",  icon: "📈", color: C.blue   },
          { label: "AI Investments",  tab: "invest",  icon: "🚀", color: C.purple },
        ].map(n => (
          <button key={n.tab} onClick={() => onNav(n.tab)}
            style={{ padding: "12px 8px", borderRadius: 10, border: `0.5px solid ${n.color}33`,
              background: `${n.color}0d`, cursor: "pointer", textAlign: "center" }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>{n.icon}</div>
            <div style={{ fontSize: 10, fontWeight: 600, color: n.color }}>{n.label}</div>
          </button>
        ))}
      </div>

      <AIAdvisor
        prompt="Give me a comprehensive financial health assessment and top 5 action items for improving my financial position. Consider income vs expenses, savings rate, and investment diversification."
        buttonLabel="Full Financial Assessment"
        color={C.teal}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: BUDGET
// ─────────────────────────────────────────────────────────────────────────────
function BudgetTab({ data, setData }) {
  const defaultCategories = [
    { name: "Housing",      allocated: 2000, spent: 0, icon: "🏠", color: C.blue   },
    { name: "Food",         allocated: 800,  spent: 0, icon: "🍔", color: C.orange },
    { name: "Transport",    allocated: 500,  spent: 0, icon: "🚗", color: C.teal   },
    { name: "Business",     allocated: 3000, spent: 0, icon: "💼", color: C.purple },
    { name: "Marketing",    allocated: 1500, spent: 0, icon: "📢", color: C.pink   },
    { name: "Health",       allocated: 300,  spent: 0, icon: "💊", color: C.green  },
    { name: "Entertainment",allocated: 400,  spent: 0, icon: "🎮", color: C.amber  },
    { name: "Savings",      allocated: 2000, spent: 0, icon: "🏦", color: C.gold   },
  ];

  const [categories, setCategories] = useState(() => data.budget?.categories || defaultCategories);
  const [income, setIncome] = useState(() => data.budget?.monthlyIncome || 10000);
  const [editIncome, setEditIncome] = useState(false);
  const [incomeInput, setIncomeInput] = useState("");
  const [editIdx, setEditIdx] = useState(null);
  const [newCat, setNewCat] = useState({ name: "", allocated: "", spent: "", icon: "💰" });
  const [adding, setAdding] = useState(false);
  const [saved, setSaved] = useState(false);

  const totalAllocated = categories.reduce((s, c) => s + (Number(c.allocated) || 0), 0);
  const totalSpent     = categories.reduce((s, c) => s + (Number(c.spent)     || 0), 0);
  const remaining      = income - totalAllocated;

  async function saveBudget(cats) {
    const next = { categories: cats, monthlyIncome: income };
    setData(d => ({ ...d, budget: next }));
    await kvSet("finance_budget", next);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function updateCat(i, field, val) {
    const next = categories.map((c, ci) => ci === i ? { ...c, [field]: val } : c);
    setCategories(next);
  }

  function addCat() {
    if (!newCat.name || !newCat.allocated) return;
    const next = [...categories, { ...newCat, allocated: Number(newCat.allocated), spent: Number(newCat.spent || 0), color: C.teal }];
    setCategories(next);
    setNewCat({ name: "", allocated: "", spent: "", icon: "💰" });
    setAdding(false);
    saveBudget(next);
  }

  const pieData = categories.map(c => ({ name: c.name, value: Number(c.allocated) || 0, color: c.color }));

  const contextStr = `Monthly income: ${fmtUSD(income)}. Budget categories: ${categories.map(c => `${c.name}: allocated ${fmtUSD(c.allocated)}, spent ${fmtUSD(c.spent)}`).join("; ")}. Total allocated: ${fmtUSD(totalAllocated)}. Remaining unallocated: ${fmtUSD(remaining)}.`;

  return (
    <div style={{ padding: 20 }}>
      {/* Income header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, padding: "14px 16px",
        borderRadius: 12, background: `${C.teal}0d`, border: `0.5px solid ${C.teal}33` }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 9, color: C.teal, fontWeight: 700, letterSpacing: ".1em", marginBottom: 4 }}>MONTHLY INCOME</div>
          {editIncome ? (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input value={incomeInput} onChange={e => setIncomeInput(e.target.value)} type="number"
                placeholder={income} autoFocus
                {...inp({ width: 160, fontSize: 18, fontWeight: 800 })} />
              <button onClick={() => { setIncome(Number(incomeInput) || income); setEditIncome(false); }}
                style={{ padding: "6px 14px", borderRadius: 7, background: C.teal, border: "none", color: "#000", fontWeight: 700, cursor: "pointer", fontSize: 11 }}>Save</button>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: C.teal }}>{fmtUSD(income)}</div>
              <button onClick={() => { setIncomeInput(String(income)); setEditIncome(true); }}
                style={{ fontSize: 10, color: "#555", background: "none", border: "none", cursor: "pointer" }}>✏️ Edit</button>
            </div>
          )}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 9, color: "#555", marginBottom: 2 }}>Unallocated</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: remaining >= 0 ? C.green : C.red }}>{fmtUSD(remaining)}</div>
        </div>
        <button onClick={() => saveBudget(categories)}
          style={{ padding: "8px 18px", borderRadius: 8, background: saved ? `${C.green}22` : `${C.teal}22`,
            border: `0.5px solid ${saved ? C.green : C.teal}55`, color: saved ? C.green : C.teal, fontWeight: 700, fontSize: 11, cursor: "pointer" }}>
          {saved ? "✓ Saved" : "Save Budget"}
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 260px", gap: 16, marginBottom: 16 }}>
        {/* Category list */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <SectionTitle>Budget Categories</SectionTitle>
            <button onClick={() => setAdding(a => !a)}
              style={{ padding: "4px 12px", borderRadius: 20, background: `${C.teal}18`, border: `0.5px solid ${C.teal}44`,
                color: C.teal, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>+ Add</button>
          </div>

          {adding && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 8, marginBottom: 12,
              padding: 12, borderRadius: 10, background: "rgba(0,200,150,0.05)", border: `0.5px solid ${C.teal}33` }}>
              <input placeholder="Category name" value={newCat.name} onChange={e => setNewCat(n => ({ ...n, name: e.target.value }))} {...inp()} />
              <input placeholder="Allocated $" type="number" value={newCat.allocated} onChange={e => setNewCat(n => ({ ...n, allocated: e.target.value }))} {...inp()} />
              <input placeholder="Spent $" type="number" value={newCat.spent} onChange={e => setNewCat(n => ({ ...n, spent: e.target.value }))} {...inp()} />
              <button onClick={addCat}
                style={{ padding: "8px 12px", borderRadius: 7, background: C.teal, border: "none", color: "#000", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>+</button>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {categories.map((cat, i) => {
              const pct = cat.allocated > 0 ? Math.min(100, ((cat.spent || 0) / cat.allocated) * 100) : 0;
              const over = pct >= 100;
              return (
                <div key={i} style={{ padding: "10px 12px", borderRadius: 10, background: "rgba(255,255,255,0.025)",
                  border: `0.5px solid ${over ? C.red + "55" : "rgba(255,255,255,0.06)"}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 16 }}>{cat.icon}</span>
                    <div style={{ flex: 1, fontSize: 12, fontWeight: 600, color: "#f0ede8" }}>{cat.name}</div>
                    {editIdx === i ? (
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <input type="number" value={cat.allocated} onChange={e => updateCat(i, "allocated", Number(e.target.value))}
                          {...inp({ width: 90, padding: "4px 8px" })} />
                        <input type="number" value={cat.spent || ""} onChange={e => updateCat(i, "spent", Number(e.target.value))}
                          placeholder="Spent" {...inp({ width: 80, padding: "4px 8px" })} />
                        <button onClick={() => { setEditIdx(null); saveBudget(categories); }}
                          style={{ padding: "4px 10px", borderRadius: 6, background: C.teal, border: "none", color: "#000", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>✓</button>
                      </div>
                    ) : (
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <span style={{ fontSize: 11, color: over ? C.red : "#888" }}>{fmtUSD(cat.spent || 0)} / {fmtUSD(cat.allocated)}</span>
                        <button onClick={() => setEditIdx(i)}
                          style={{ fontSize: 10, background: "none", border: "none", color: "#555", cursor: "pointer" }}>✏️</button>
                        <button onClick={() => { const next = categories.filter((_, ci) => ci !== i); setCategories(next); saveBudget(next); }}
                          style={{ fontSize: 10, background: "none", border: "none", color: C.red + "99", cursor: "pointer" }}>✕</button>
                      </div>
                    )}
                  </div>
                  {/* Progress bar */}
                  <div style={{ height: 5, background: "rgba(255,255,255,0.07)", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, borderRadius: 3, transition: "width 0.5s",
                      background: pct >= 90 ? C.red : pct >= 70 ? C.amber : cat.color || C.teal }} />
                  </div>
                  {over && <div style={{ fontSize: 9, color: C.red, marginTop: 4 }}>⚠ Over budget by {fmtUSD((cat.spent || 0) - cat.allocated)}</div>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Pie chart */}
        <div>
          <Card>
            <SectionTitle>Allocation Breakdown</SectionTitle>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" strokeWidth={0}>
                  {pieData.map((e, i) => <Cell key={i} fill={e.color || C.teal} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "#0f1020", border: "0.5px solid #333", borderRadius: 8, fontSize: 10 }}
                  formatter={(v) => fmtUSD(v)} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {categories.slice(0, 6).map((c, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: c.color || C.teal, flexShrink: 0 }} />
                    <span style={{ color: "#aaa" }}>{c.name}</span>
                  </div>
                  <span style={{ color: "#666" }}>{income > 0 ? ((c.allocated / income) * 100).toFixed(0) : 0}%</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Budget summary */}
          <Card style={{ marginTop: 12 }}>
            <SectionTitle color={C.amber}>Budget Health</SectionTitle>
            {[
              ["Total Allocated", fmtUSD(totalAllocated), totalAllocated <= income ? C.green : C.red],
              ["Total Spent",     fmtUSD(totalSpent),     totalSpent <= totalAllocated ? C.teal : C.red],
              ["Remaining",       fmtUSD(income - totalSpent), income - totalSpent >= 0 ? C.green : C.red],
            ].map(([l, v, color]) => (
              <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0",
                borderBottom: "0.5px solid rgba(255,255,255,0.05)" }}>
                <span style={{ fontSize: 11, color: "#888" }}>{l}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color }}>{v}</span>
              </div>
            ))}
          </Card>
        </div>
      </div>

      <AIAdvisor
        prompt="Analyze my budget and give me specific advice to optimize my spending, increase savings, and align my budget with business growth goals."
        context={contextStr}
        buttonLabel="Optimize My Budget"
        color={C.amber}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: CASH FLOW (Income + Expenses)
// ─────────────────────────────────────────────────────────────────────────────
function CashFlowTab({ data, setData }) {
  const [income, setIncome]   = useState(() => data.cashflow?.income   || []);
  const [expenses, setExpenses] = useState(() => data.cashflow?.expenses || []);
  const [accounts, setAccounts] = useState(() => data.accounts || []);
  const [view, setView] = useState("income"); // income | expenses | accounts
  const [form, setForm] = useState({ name: "", amount: "", category: "", date: "", note: "", recurring: false, icon: "💰", type: "income" });
  const [adding, setAdding] = useState(false);
  const [saved, setSaved] = useState(false);

  const ACCOUNT_TYPES = [
    { name: "Sofi",     icon: "🏦", type: "Sofi"     },
    { name: "Stripe",   icon: "💳", type: "Stripe"   },
    { name: "Square",   icon: "⬛", type: "Square"   },
    { name: "Cash App", icon: "💸", type: "CashApp"  },
    { name: "Venmo",    icon: "💜", type: "Venmo"    },
    { name: "Paypal",   icon: "🅿️", type: "Paypal"   },
    { name: "OnePay",   icon: "💰", type: "OnePay"   },
    { name: "Checking", icon: "🏦", type: "Checking" },
    { name: "Savings",  icon: "🏧", type: "Savings"  },
    { name: "Business", icon: "💼", type: "Business" },
    { name: "Credit",   icon: "💳", type: "Credit"   },
  ];
  const [accForm, setAccForm] = useState({ name: "", checking: "", savings: "", type: "Checking", icon: "🏦" });
  const [addingAcc, setAddingAcc] = useState(false);

  const totalIncome   = income.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const totalExpenses = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const netCashFlow   = totalIncome - totalExpenses;
  const totalAssets   = accounts.reduce((s, a) => s + (Number(a.checking) || 0) + (Number(a.savings) || 0) + (Number(a.balance) || 0), 0);

  async function persistCashflow(inc, exp, accs) {
    const next = { income: inc, expenses: exp };
    setData(d => ({ ...d, cashflow: next, accounts: accs }));
    await kvSet("finance_cashflow", next);
    await kvSet("finance_accounts", accs);
    setSaved(true); setTimeout(() => setSaved(false), 1800);
  }

  function addEntry() {
    if (!form.name || !form.amount) return;
    const entry = { ...form, amount: Number(form.amount), id: Date.now() };
    let inc = income, exp = expenses;
    if (view === "income") { inc = [entry, ...income]; setIncome(inc); }
    else { exp = [entry, ...expenses]; setExpenses(exp); }
    setForm({ name: "", amount: "", category: "", date: "", note: "", recurring: false, icon: "💰", type: view });
    setAdding(false);
    persistCashflow(inc, exp, accounts);
  }

  function addAccount() {
    if (!accForm.name) return;
    const next = [...accounts, { 
      ...accForm, 
      checking: Number(accForm.checking) || 0, 
      savings: Number(accForm.savings) || 0, 
      id: Date.now() 
    }];
    setAccounts(next);
    setAccForm({ name: "", checking: "", savings: "", type: "Checking", icon: "🏦" });
    setAddingAcc(false);
    persistCashflow(income, expenses, next);
  }

  function deleteEntry(id, type) {
    let inc = income, exp = expenses;
    if (type === "income") { inc = income.filter(i => i.id !== id); setIncome(inc); }
    else { exp = expenses.filter(e => e.id !== id); setExpenses(exp); }
    persistCashflow(inc, exp, accounts);
  }

  const rows = view === "income" ? income : view === "expenses" ? expenses : [];
  const cfContext = `Monthly income: ${fmtUSD(totalIncome)} from ${income.length} sources. Monthly expenses: ${fmtUSD(totalExpenses)} across ${expenses.length} items. Net cash flow: ${fmtUSD(netCashFlow)}. Account balances: ${accounts.map(a => `${a.name}: ${fmtUSD(a.balance)}`).join(", ")}.`;

  return (
    <div style={{ padding: 20 }}>
      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        <StatBox label="Monthly Income"   value={fmtUSD(totalIncome)}   icon="📥" color={C.green}  />
        <StatBox label="Monthly Expenses" value={fmtUSD(totalExpenses)} icon="📤" color={C.red}    />
        <StatBox label="Net Cash Flow"    value={fmtUSD(netCashFlow)}   icon="⚡" color={netCashFlow >= 0 ? C.teal : C.red} />
        <StatBox label="Total Assets"     value={fmtUSD(totalAssets)}   icon="🏦" color={C.blue}   />
      </div>

      {/* Sub-tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
        {[["income", "📥 Income"], ["expenses", "📤 Expenses"], ["accounts", "🏦 Accounts"]].map(([v, l]) => (
          <button key={v} onClick={() => { setView(v); setAdding(false); }}
            style={{ padding: "7px 16px", borderRadius: 8, fontSize: 11, fontWeight: view === v ? 700 : 400,
              background: view === v ? `${C.teal}18` : "transparent",
              border: `0.5px solid ${view === v ? C.teal + "55" : "rgba(255,255,255,0.08)"}`,
              color: view === v ? C.teal : "#888", cursor: "pointer" }}>
            {l}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        {saved && <div style={{ fontSize: 10, color: C.green, alignSelf: "center" }}>✓ Saved</div>}
        {view !== "accounts" && (
          <button onClick={() => setAdding(a => !a)}
            style={{ padding: "7px 14px", borderRadius: 8, background: `${C.teal}18`, border: `0.5px solid ${C.teal}44`,
              color: C.teal, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
            + Add {view === "income" ? "Income" : "Expense"}
          </button>
        )}
        {view === "accounts" && (
          <button onClick={() => setAddingAcc(a => !a)}
            style={{ padding: "7px 14px", borderRadius: 8, background: `${C.blue}18`, border: `0.5px solid ${C.blue}44`,
              color: C.blue, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>+ Add Account</button>
        )}
      </div>

      {/* Add form */}
      {adding && view !== "accounts" && (
        <Card style={{ marginBottom: 14 }} accent={view === "income" ? C.green + "33" : C.red + "33"}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginBottom: 8 }}>
            <div><div style={{ fontSize: 9, color: "#555", marginBottom: 3 }}>Name</div>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Source / Item" {...inp()} /></div>
            <div><div style={{ fontSize: 9, color: "#555", marginBottom: 3 }}>Amount</div>
              <input value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} type="number" placeholder="0.00" {...inp()} /></div>
            <div><div style={{ fontSize: 9, color: "#555", marginBottom: 3 }}>Category</div>
              <input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="e.g. Client, Rent" {...inp()} /></div>
            <div><div style={{ fontSize: 9, color: "#555", marginBottom: 3 }}>Date</div>
              <input value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} type="date" {...inp()} /></div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="Note (optional)" {...inp({ flex: 1 })} style={{ flex: 1, padding: "8px 10px", borderRadius: 7, border: "0.5px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.04)", color: "#f0ede8", fontSize: 12, outline: "none" }} />
            <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "#888", cursor: "pointer" }}>
              <input type="checkbox" checked={form.recurring} onChange={e => setForm(f => ({ ...f, recurring: e.target.checked }))} />
              Recurring
            </label>
            <button onClick={addEntry}
              style={{ padding: "8px 20px", borderRadius: 8, background: view === "income" ? C.green : C.red,
                border: "none", color: "#000", fontWeight: 700, cursor: "pointer", fontSize: 11 }}>Add</button>
            <button onClick={() => setAdding(false)}
              style={{ padding: "8px 12px", borderRadius: 8, background: "transparent", border: "0.5px solid rgba(255,255,255,0.1)", color: "#888", cursor: "pointer", fontSize: 11 }}>Cancel</button>
          </div>
        </Card>
      )}

      {/* Add account form */}
      {addingAcc && (
        <Card style={{ marginBottom: 14 }} accent={C.blue + "33"}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr auto", gap: 8 }}>
            <div><div style={{ fontSize: 9, color: "#555", marginBottom: 3 }}>Account Name</div>
              <input value={accForm.name} onChange={e => setAccForm(f => ({ ...f, name: e.target.value }))} placeholder="Sofi" {...inp()} /></div>
            <div><div style={{ fontSize: 9, color: "#555", marginBottom: 3 }}>Checking</div>
              <input value={accForm.checking} onChange={e => setAccForm(f => ({ ...f, checking: e.target.value }))} type="number" placeholder="0.00" {...inp()} /></div>
            <div><div style={{ fontSize: 9, color: "#555", marginBottom: 3 }}>Savings</div>
              <input value={accForm.savings} onChange={e => setAccForm(f => ({ ...f, savings: e.target.value }))} type="number" placeholder="0.00" {...inp()} /></div>
            <div><div style={{ fontSize: 9, color: "#555", marginBottom: 3 }}>Type</div>
              <select value={accForm.type} onChange={e => {
                const t = ACCOUNT_TYPES.find(a => a.type === e.target.value);
                setAccForm(f => ({ ...f, type: e.target.value, icon: t?.icon || "🏦" }));
              }} style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "0.5px solid rgba(255,255,255,0.12)", background: "#0f1020", color: "#f0ede8", fontSize: 12, outline: "none" }}>
                {ACCOUNT_TYPES.map(t => <option key={t.type} value={t.type}>{t.name}</option>)}
              </select></div>
            <button onClick={addAccount} style={{ marginTop: 16, padding: "8px 16px", borderRadius: 8, background: C.blue, border: "none", color: "#000", fontWeight: 700, cursor: "pointer", fontSize: 11 }}>Add</button>
          </div>
        </Card>
      )}

      {/* Accounts view - matches dashboard finance module: editable list with Checking/Savings + growth graph */}
      {view === "accounts" && (
        <div>
          {/* List with Checking and Savings columns */}
          <div style={{ fontSize:9, color:"#555", marginBottom:4, display:"grid", gridTemplateColumns:"1.1fr 0.9fr 0.9fr", gap:4, alignItems:"center" }}>
            <div style={{fontWeight:700}}>Institution</div>
            <div style={{textAlign:"right"}}>Checking</div>
            <div style={{textAlign:"right"}}>Savings</div>
          </div>
          {accounts.length === 0 ? (
            <div style={{ textAlign: "center", padding: 20, fontSize: 11, color: "#444" }}>No accounts yet — use the form above to add (Sofi, Stripe, etc.)</div>
          ) : accounts.map((a, i) => (
            <div key={a.id || i} style={{ display:"grid", gridTemplateColumns:"1.1fr 0.9fr 0.9fr", gap:4, alignItems:"center", fontSize:10, padding:"2px 0", borderBottom:"0.5px solid rgba(255,255,255,0.05)" }}>
              <div style={{fontWeight:600, color:"#f0ede8"}}>{a.icon} {a.name || a.type}</div>
              <div style={{textAlign:"right", color:C.teal, fontWeight:600}}>{fmtUSD(a.checking || a.balance || 0)}</div>
              <div style={{textAlign:"right", color:C.teal, fontWeight:600}}>{fmtUSD(a.savings || 0)}</div>
              <button onClick={() => { const next = accounts.filter((_, ci) => ci !== i); setAccounts(next); persistCashflow(income, expenses, next); }}
                style={{ background: "none", border: "none", color: "#444", cursor: "pointer", fontSize: 11, gridColumn: "span 3", textAlign:"right" }}>✕</button>
            </div>
          ))}

          {/* Line graph for growth of balances per platform (monthly/quarterly total) */}
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize:9, color:"#555", marginBottom:2 }}>Balances Growth (Total across platforms)</div>
            <LineChart data={[65200, 71800, 68900, 79500, 84200, 90100, 96500, 103200]} color={C.green} height={58} />
          </div>
        </div>
      )}

      {/* Income / Expense rows */}
      {view !== "accounts" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {rows.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, fontSize: 12, color: "#444" }}>
              No {view} entries yet — click "+ Add" above
            </div>
          ) : rows.map((row, i) => (
            <div key={row.id || i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
              borderRadius: 9, background: "rgba(255,255,255,0.025)", border: "0.5px solid rgba(255,255,255,0.05)" }}>
              <div style={{ fontSize: 20 }}>{row.icon || (view === "income" ? "💰" : "💸")}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#f0ede8" }}>{row.name}</div>
                <div style={{ fontSize: 9, color: "#555" }}>{row.category}{row.date ? ` · ${row.date}` : ""}{row.recurring ? " · 🔁 Recurring" : ""}</div>
                {row.note && <div style={{ fontSize: 9, color: "#444", fontStyle: "italic" }}>{row.note}</div>}
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: view === "income" ? C.green : C.red }}>
                {view === "income" ? "+" : "-"}{fmtUSD(row.amount)}
              </div>
              <button onClick={() => deleteEntry(row.id, view)}
                style={{ background: "none", border: "none", color: "#444", cursor: "pointer", fontSize: 13 }}>✕</button>
            </div>
          ))}
        </div>
      )}

      <AIAdvisor
        prompt="Analyze my cash flow and accounts. Identify opportunities to increase income, reduce unnecessary expenses, and optimize my cash position. Give specific actionable advice."
        context={cfContext}
        buttonLabel="Analyze Cash Flow"
        color={C.green}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: INVOICES
// ─────────────────────────────────────────────────────────────────────────────
function InvoicesTab({ data, setData }) {
  const [invoices, setInvoices] = useState(() => data.invoices || []);
  const [form, setForm] = useState({ client: "", amount: "", due: "", status: "pending", description: "", type: "invoice" });
  const [adding, setAdding] = useState(false);

  const outstanding = invoices.filter(i => i.status === "pending").reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const paid        = invoices.filter(i => i.status === "paid").reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const overdue     = invoices.filter(i => i.status === "overdue").length;

  async function addInvoice() {
    if (!form.client || !form.amount) return;
    const inv = { ...form, amount: Number(form.amount), id: `INV-${Date.now()}`, created: new Date().toLocaleDateString() };
    const next = [inv, ...invoices];
    setInvoices(next);
    setData(d => ({ ...d, invoices: next }));
    await kvSet("finance_invoices", next);
    setForm({ client: "", amount: "", due: "", status: "pending", description: "", type: "invoice" });
    setAdding(false);
  }

  async function updateStatus(id, status) {
    const next = invoices.map(i => i.id === id ? { ...i, status } : i);
    setInvoices(next);
    setData(d => ({ ...d, invoices: next }));
    await kvSet("finance_invoices", next);
  }

  async function deleteInvoice(id) {
    const next = invoices.filter(i => i.id !== id);
    setInvoices(next);
    setData(d => ({ ...d, invoices: next }));
    await kvSet("finance_invoices", next);
  }

  const STATUS_COLORS = { paid: C.green, pending: C.amber, overdue: C.red, draft: "#666" };

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        <StatBox label="Outstanding" value={fmtUSD(outstanding)} icon="⏳" color={C.amber} sub={`${invoices.filter(i=>i.status==="pending").length} invoices`} />
        <StatBox label="Paid (Total)" value={fmtUSD(paid)}        icon="✅" color={C.green} sub={`${invoices.filter(i=>i.status==="paid").length} invoices`} />
        <StatBox label="Overdue"      value={overdue}             icon="🚨" color={C.red}   sub="Needs immediate attention" />
        <StatBox label="Total Invoiced" value={fmtUSD(outstanding + paid)} icon="📋" color={C.blue} />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <SectionTitle>Invoices & Payments</SectionTitle>
        <button onClick={() => setAdding(a => !a)}
          style={{ padding: "7px 16px", borderRadius: 8, background: `${C.teal}18`, border: `0.5px solid ${C.teal}44`,
            color: C.teal, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>+ New Invoice</button>
      </div>

      {adding && (
        <Card style={{ marginBottom: 14 }} accent={C.teal + "33"}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 8 }}>
            <div><div style={{ fontSize: 9, color: "#555", marginBottom: 3 }}>Client Name</div>
              <input value={form.client} onChange={e => setForm(f => ({ ...f, client: e.target.value }))} placeholder="Client / Company" {...inp()} /></div>
            <div><div style={{ fontSize: 9, color: "#555", marginBottom: 3 }}>Amount</div>
              <input value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} type="number" placeholder="0.00" {...inp()} /></div>
            <div><div style={{ fontSize: 9, color: "#555", marginBottom: 3 }}>Due Date</div>
              <input value={form.due} onChange={e => setForm(f => ({ ...f, due: e.target.value }))} type="date" {...inp()} /></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 8 }}>
            <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Description / services" {...inp()} style={{ padding: "8px 10px", borderRadius: 7, border: "0.5px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.04)", color: "#f0ede8", fontSize: 12, outline: "none" }} />
            <button onClick={addInvoice}
              style={{ padding: "8px 20px", borderRadius: 8, background: C.teal, border: "none", color: "#000", fontWeight: 700, cursor: "pointer", fontSize: 11 }}>Create</button>
            <button onClick={() => setAdding(false)}
              style={{ padding: "8px 12px", borderRadius: 8, background: "transparent", border: "0.5px solid rgba(255,255,255,0.1)", color: "#888", cursor: "pointer", fontSize: 11 }}>Cancel</button>
          </div>
        </Card>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {invoices.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40, fontSize: 12, color: "#444" }}>No invoices yet</div>
        ) : invoices.map(inv => (
          <div key={inv.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
            borderRadius: 10, background: "rgba(255,255,255,0.025)",
            border: `0.5px solid ${STATUS_COLORS[inv.status] || "#333"}33` }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 2 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#f0ede8" }}>{inv.client}</span>
                <span style={{ fontSize: 8, padding: "2px 7px", borderRadius: 10, fontWeight: 700,
                  background: STATUS_COLORS[inv.status] + "22", color: STATUS_COLORS[inv.status] || "#888" }}>
                  {inv.status?.toUpperCase()}
                </span>
                <span style={{ fontSize: 9, color: "#444" }}>{inv.id}</span>
              </div>
              <div style={{ fontSize: 10, color: "#555" }}>{inv.description}{inv.due ? ` · Due: ${inv.due}` : ""}</div>
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: STATUS_COLORS[inv.status] || C.teal }}>
              {fmtUSD(inv.amount)}
            </div>
            <div style={{ display: "flex", gap: 5 }}>
              {inv.status !== "paid" && (
                <button onClick={() => updateStatus(inv.id, "paid")}
                  style={{ padding: "4px 10px", borderRadius: 6, background: `${C.green}18`, border: `0.5px solid ${C.green}44`, color: C.green, fontSize: 9, fontWeight: 700, cursor: "pointer" }}>Mark Paid</button>
              )}
              {inv.status === "pending" && (
                <button onClick={() => updateStatus(inv.id, "overdue")}
                  style={{ padding: "4px 10px", borderRadius: 6, background: `${C.red}18`, border: `0.5px solid ${C.red}44`, color: C.red, fontSize: 9, cursor: "pointer" }}>Overdue</button>
              )}
              <button onClick={() => deleteInvoice(inv.id)}
                style={{ padding: "4px 8px", borderRadius: 6, background: "transparent", border: "0.5px solid rgba(255,255,255,0.08)", color: "#444", fontSize: 10, cursor: "pointer" }}>✕</button>
            </div>
          </div>
        ))}
      </div>

      <AIAdvisor
        prompt={`I have ${invoices.length} invoices. Outstanding: ${fmtUSD(outstanding)}. Overdue: ${overdue}. Give me strategies to improve collections, reduce overdue invoices, and streamline my billing process.`}
        buttonLabel="Invoice Strategy"
        color={C.amber}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: CRYPTO
// ─────────────────────────────────────────────────────────────────────────────
function CryptoTab({ data, setData }) {
  const [holdings, setHoldings] = useState(() => data.crypto?.holdings || []);
  const [prices, setPrices] = useState({});
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [form, setForm] = useState({ coin: "bitcoin", symbol: "BTC", amount: "", buyPrice: "", icon: "₿" });
  const [adding, setAdding] = useState(false);
  const [watchlist] = useState(["bitcoin","ethereum","solana","cardano","dogecoin","chainlink","avalanche-2","polkadot"]);

  const COINS = [
    { id: "bitcoin",      symbol: "BTC",  icon: "₿",  name: "Bitcoin"   },
    { id: "ethereum",     symbol: "ETH",  icon: "Ξ",  name: "Ethereum"  },
    { id: "solana",       symbol: "SOL",  icon: "◎",  name: "Solana"    },
    { id: "cardano",      symbol: "ADA",  icon: "₳",  name: "Cardano"   },
    { id: "dogecoin",     symbol: "DOGE", icon: "Ð",  name: "Dogecoin"  },
    { id: "chainlink",    symbol: "LINK", icon: "⬡",  name: "Chainlink" },
    { id: "avalanche-2",  symbol: "AVAX", icon: "🔺", name: "Avalanche" },
    { id: "polkadot",     symbol: "DOT",  icon: "●",  name: "Polkadot"  },
  ];

  async function fetchPrices() {
    setLoadingPrices(true);
    try {
      const ids = [...new Set([...watchlist, ...holdings.map(h => h.coin)])].join(",");
      const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true`);
      const data = await res.json();
      setPrices(data);
    } catch {}
    setLoadingPrices(false);
  }

  useEffect(() => { fetchPrices(); }, []);

  async function addHolding() {
    if (!form.amount || !form.coin) return;
    const cur = prices[form.coin]?.usd || 0;
    const holding = {
      ...form, amount: Number(form.amount), buyPrice: Number(form.buyPrice) || cur,
      currentPrice: cur, value: cur * Number(form.amount), id: Date.now(),
    };
    const next = [holding, ...holdings];
    setHoldings(next);
    setData(d => ({ ...d, crypto: { ...d.crypto, holdings: next } }));
    await kvSet("finance_crypto", { holdings: next });
    setForm({ coin: "bitcoin", symbol: "BTC", amount: "", buyPrice: "", icon: "₿" });
    setAdding(false);
  }

  async function deleteHolding(id) {
    const next = holdings.filter(h => h.id !== id);
    setHoldings(next);
    setData(d => ({ ...d, crypto: { ...d.crypto, holdings: next } }));
    await kvSet("finance_crypto", { holdings: next });
  }

  const portfolioValue = holdings.reduce((s, h) => {
    const cur = prices[h.coin]?.usd || h.currentPrice || 0;
    return s + cur * h.amount;
  }, 0);
  const portfolioCost = holdings.reduce((s, h) => s + h.buyPrice * h.amount, 0);
  const portfolioPnL  = portfolioValue - portfolioCost;
  const portfolioPct  = portfolioCost > 0 ? ((portfolioPnL / portfolioCost) * 100) : 0;

  const holdingsCtx = holdings.map(h => {
    const cur = prices[h.coin]?.usd || h.currentPrice || 0;
    const pnl = (cur - h.buyPrice) * h.amount;
    const pct = h.buyPrice > 0 ? ((cur - h.buyPrice) / h.buyPrice * 100).toFixed(1) : 0;
    return `${h.symbol}: ${h.amount} coins, bought at $${h.buyPrice}, now $${cur.toFixed(2)}, P&L: ${fmtUSD(pnl)} (${pct}%)`;
  }).join("; ");

  return (
    <div style={{ padding: 20 }}>
      {/* Portfolio stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        <StatBox label="Portfolio Value" value={fmtUSD(portfolioValue)} icon="₿" color={C.orange} />
        <StatBox label="Total Cost Basis" value={fmtUSD(portfolioCost)} icon="💵" color={C.blue} />
        <StatBox label="Total P&L" value={fmtUSD(portfolioPnL)} icon={portfolioPnL >= 0 ? "🚀" : "📉"} color={pctColor(portfolioPnL)} sub={`${portfolioPnL >= 0 ? "+" : ""}${portfolioPct.toFixed(1)}%`} />
        <StatBox label="Holdings" value={holdings.length} icon="🔐" color={C.purple} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        {/* Holdings */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <SectionTitle color={C.orange}>My Holdings</SectionTitle>
            <button onClick={() => setAdding(a => !a)}
              style={{ padding: "5px 12px", borderRadius: 20, background: `${C.orange}18`, border: `0.5px solid ${C.orange}44`,
                color: C.orange, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>+ Add</button>
          </div>

          {adding && (
            <Card style={{ marginBottom: 10 }} accent={C.orange + "33"}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 9, color: "#555", marginBottom: 3 }}>Coin</div>
                  <select value={form.coin} onChange={e => {
                    const c = COINS.find(c => c.id === e.target.value);
                    setForm(f => ({ ...f, coin: e.target.value, symbol: c?.symbol || "?", icon: c?.icon || "₿" }));
                  }} style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "0.5px solid rgba(255,255,255,0.12)", background: "#0f1020", color: "#f0ede8", fontSize: 12, outline: "none" }}>
                    {COINS.map(c => <option key={c.id} value={c.id}>{c.name} ({c.symbol})</option>)}
                  </select>
                </div>
                <div><div style={{ fontSize: 9, color: "#555", marginBottom: 3 }}>Amount</div>
                  <input value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} type="number" placeholder="0.00" {...inp()} /></div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
                <div><div style={{ fontSize: 9, color: "#555", marginBottom: 3 }}>Buy Price (USD)</div>
                  <input value={form.buyPrice} onChange={e => setForm(f => ({ ...f, buyPrice: e.target.value }))} type="number"
                    placeholder={prices[form.coin]?.usd ? `Current: $${prices[form.coin].usd.toFixed(2)}` : "0.00"} {...inp()} /></div>
                <button onClick={addHolding} style={{ marginTop: 16, padding: "8px 16px", borderRadius: 8, background: C.orange, border: "none", color: "#000", fontWeight: 700, cursor: "pointer", fontSize: 11 }}>Add</button>
              </div>
            </Card>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {holdings.length === 0 ? (
              <div style={{ textAlign: "center", padding: 30, fontSize: 11, color: "#444" }}>No holdings yet</div>
            ) : holdings.map(h => {
              const cur = prices[h.coin]?.usd || h.currentPrice || 0;
              const val = cur * h.amount;
              const pnl = (cur - h.buyPrice) * h.amount;
              const pct = h.buyPrice > 0 ? ((cur - h.buyPrice) / h.buyPrice * 100) : 0;
              return (
                <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                  borderRadius: 9, background: "rgba(255,255,255,0.025)", border: "0.5px solid rgba(255,255,255,0.05)" }}>
                  <div style={{ fontSize: 20, width: 28, textAlign: "center" }}>{h.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#f0ede8" }}>{h.symbol}</div>
                    <div style={{ fontSize: 9, color: "#555" }}>{h.amount} coins · Avg ${h.buyPrice?.toFixed(2)}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#f0ede8" }}>{fmtUSD(val)}</div>
                    <div style={{ fontSize: 10, color: pctColor(pct) }}>{pct >= 0 ? "+" : ""}{pct.toFixed(1)}% · {pnl >= 0 ? "+" : ""}{fmtUSD(pnl)}</div>
                  </div>
                  <button onClick={() => deleteHolding(h.id)}
                    style={{ background: "none", border: "none", color: "#444", cursor: "pointer", fontSize: 12 }}>✕</button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Market prices */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <SectionTitle>Market Prices</SectionTitle>
            <button onClick={fetchPrices} disabled={loadingPrices}
              style={{ fontSize: 9, color: C.teal, background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}>
              {loadingPrices ? "Loading…" : "↻ Refresh"}
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {COINS.map(c => {
              const p = prices[c.id];
              return (
                <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px",
                  borderRadius: 8, background: "rgba(255,255,255,0.025)", border: "0.5px solid rgba(255,255,255,0.04)" }}>
                  <div style={{ fontSize: 16, width: 24, textAlign: "center" }}>{c.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#f0ede8" }}>{c.name}</div>
                    <div style={{ fontSize: 9, color: "#555" }}>{c.symbol}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#f0ede8" }}>
                      {p ? `$${p.usd.toLocaleString()}` : "—"}
                    </div>
                    {p?.usd_24h_change != null && (
                      <div style={{ fontSize: 9, color: pctColor(p.usd_24h_change) }}>
                        {p.usd_24h_change >= 0 ? "+" : ""}{p.usd_24h_change.toFixed(2)}%
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <AIAdvisor
        prompt={`I have a crypto portfolio worth ${fmtUSD(portfolioValue)} with a P&L of ${fmtUSD(portfolioPnL)} (${portfolioPct.toFixed(1)}%). Holdings: ${holdingsCtx || "none yet"}. Current market prices: ${Object.entries(prices).map(([k,v]) => `${k}: $${v.usd?.toFixed(2)}`).join(", ")}. Give me specific buy/sell/hold advice, risk management tips, and identify the best opportunities right now. Include entry points, target prices, and stop-losses.`}
        buttonLabel="Get Crypto Trading Advice"
        color={C.orange}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: STOCKS
// ─────────────────────────────────────────────────────────────────────────────
function StocksTab({ data, setData }) {
  const [holdings, setHoldings] = useState(() => data.stocks?.holdings || []);
  const [quotes, setQuotes] = useState({});
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [form, setForm] = useState({ ticker: "", shares: "", buyPrice: "", name: "" });
  const [adding, setAdding] = useState(false);

  const WATCHLIST_DEFAULT = ["AAPL","MSFT","GOOGL","AMZN","TSLA","NVDA","META","SPY","QQQ"];

  async function fetchQuotes(tickers) {
    setLoadingQuotes(true);
    const all = [...new Set([...WATCHLIST_DEFAULT, ...tickers])];
    const results = {};
    // Use Yahoo Finance API via allorigins proxy (free, no key needed)
    await Promise.all(all.map(async (t) => {
      try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${t}?interval=1d&range=5d`;
        const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
        const res = await fetch(proxy);
        const outer = await res.json();
        const d = JSON.parse(outer.contents);
        const meta = d?.chart?.result?.[0]?.meta;
        if (meta) {
          results[t] = {
            price:    meta.regularMarketPrice,
            prev:     meta.chartPreviousClose || meta.previousClose,
            change:   meta.regularMarketPrice - (meta.chartPreviousClose || meta.previousClose),
            changePct: ((meta.regularMarketPrice - (meta.chartPreviousClose || meta.previousClose)) / (meta.chartPreviousClose || meta.previousClose)) * 100,
            high52:   meta.fiftyTwoWeekHigh,
            low52:    meta.fiftyTwoWeekLow,
            name:     meta.longName || t,
          };
        }
      } catch {}
    }));
    setQuotes(results);
    setLoadingQuotes(false);
  }

  useEffect(() => {
    fetchQuotes(holdings.map(h => h.ticker));
  }, []);

  async function addHolding() {
    if (!form.ticker || !form.shares) return;
    const cur = quotes[form.ticker.toUpperCase()]?.price || 0;
    const holding = {
      ...form,
      ticker: form.ticker.toUpperCase(),
      shares: Number(form.shares),
      buyPrice: Number(form.buyPrice) || cur,
      currentPrice: cur,
      value: cur * Number(form.shares),
      id: Date.now(),
    };
    const next = [holding, ...holdings];
    setHoldings(next);
    setData(d => ({ ...d, stocks: { ...d.stocks, holdings: next } }));
    await kvSet("finance_stocks", { holdings: next });
    setForm({ ticker: "", shares: "", buyPrice: "", name: "" });
    setAdding(false);
    fetchQuotes(next.map(h => h.ticker));
  }

  async function deleteHolding(id) {
    const next = holdings.filter(h => h.id !== id);
    setHoldings(next);
    setData(d => ({ ...d, stocks: { ...d.stocks, holdings: next } }));
    await kvSet("finance_stocks", { holdings: next });
  }

  const portfolioValue = holdings.reduce((s, h) => {
    const cur = quotes[h.ticker]?.price || h.currentPrice || h.buyPrice || 0;
    return s + cur * h.shares;
  }, 0);
  const portfolioCost = holdings.reduce((s, h) => s + (h.buyPrice || 0) * h.shares, 0);
  const portfolioPnL  = portfolioValue - portfolioCost;
  const portfolioPct  = portfolioCost > 0 ? ((portfolioPnL / portfolioCost) * 100) : 0;

  const holdingsCtx = holdings.map(h => {
    const q = quotes[h.ticker];
    const cur = q?.price || h.currentPrice || 0;
    const pnl = (cur - h.buyPrice) * h.shares;
    return `${h.ticker}: ${h.shares} shares, bought $${h.buyPrice}, now $${cur?.toFixed(2)}, P&L: ${fmtUSD(pnl)}`;
  }).join("; ");

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        <StatBox label="Portfolio Value" value={fmtUSD(portfolioValue)} icon="📊" color={C.blue} />
        <StatBox label="Cost Basis"      value={fmtUSD(portfolioCost)}  icon="💵" color="#888" />
        <StatBox label="Total P&L"       value={fmtUSD(portfolioPnL)}   icon={portfolioPnL >= 0 ? "📈" : "📉"} color={pctColor(portfolioPnL)} sub={`${portfolioPct >= 0 ? "+" : ""}${portfolioPct.toFixed(1)}%`} />
        <StatBox label="Positions"       value={holdings.length}        icon="🗂" color={C.purple} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        {/* Holdings */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <SectionTitle color={C.blue}>My Positions</SectionTitle>
            <button onClick={() => setAdding(a => !a)}
              style={{ padding: "5px 12px", borderRadius: 20, background: `${C.blue}18`, border: `0.5px solid ${C.blue}44`,
                color: C.blue, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>+ Add Position</button>
          </div>

          {adding && (
            <Card style={{ marginBottom: 10 }} accent={C.blue + "33"}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 8 }}>
                <div><div style={{ fontSize: 9, color: "#555", marginBottom: 3 }}>Ticker</div>
                  <input value={form.ticker} onChange={e => setForm(f => ({ ...f, ticker: e.target.value.toUpperCase() }))} placeholder="AAPL" {...inp({ textTransform: "uppercase" })} /></div>
                <div><div style={{ fontSize: 9, color: "#555", marginBottom: 3 }}>Shares</div>
                  <input value={form.shares} onChange={e => setForm(f => ({ ...f, shares: e.target.value }))} type="number" placeholder="0" {...inp()} /></div>
                <div><div style={{ fontSize: 9, color: "#555", marginBottom: 3 }}>Buy Price</div>
                  <input value={form.buyPrice} onChange={e => setForm(f => ({ ...f, buyPrice: e.target.value }))} type="number" placeholder="0.00" {...inp()} /></div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={addHolding}
                  style={{ padding: "8px 20px", borderRadius: 8, background: C.blue, border: "none", color: "#000", fontWeight: 700, cursor: "pointer", fontSize: 11 }}>Add</button>
                <button onClick={() => setAdding(false)}
                  style={{ padding: "8px 12px", borderRadius: 8, background: "transparent", border: "0.5px solid rgba(255,255,255,0.1)", color: "#888", cursor: "pointer", fontSize: 11 }}>Cancel</button>
              </div>
            </Card>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {holdings.length === 0 ? (
              <div style={{ textAlign: "center", padding: 30, fontSize: 11, color: "#444" }}>No positions yet</div>
            ) : holdings.map(h => {
              const q = quotes[h.ticker];
              const cur = q?.price || h.currentPrice || h.buyPrice || 0;
              const val = cur * h.shares;
              const pnl = (cur - h.buyPrice) * h.shares;
              const pct = h.buyPrice > 0 ? ((cur - h.buyPrice) / h.buyPrice * 100) : 0;
              return (
                <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                  borderRadius: 9, background: "rgba(255,255,255,0.025)", border: "0.5px solid rgba(255,255,255,0.05)" }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: `${C.blue}22`,
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: C.blue }}>
                    {h.ticker}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#f0ede8" }}>{h.ticker}</div>
                    <div style={{ fontSize: 9, color: "#555" }}>{h.shares} shares · Avg ${h.buyPrice?.toFixed(2)}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#f0ede8" }}>{fmtUSD(val)}</div>
                    <div style={{ fontSize: 10, color: pctColor(pct) }}>{pct >= 0 ? "+" : ""}{pct.toFixed(1)}% · {pnl >= 0 ? "+" : ""}{fmtUSD(pnl)}</div>
                    {q?.changePct != null && (
                      <div style={{ fontSize: 9, color: pctColor(q.changePct) }}>Today: {q.changePct >= 0 ? "+" : ""}{q.changePct.toFixed(2)}%</div>
                    )}
                  </div>
                  <button onClick={() => deleteHolding(h.id)}
                    style={{ background: "none", border: "none", color: "#444", cursor: "pointer", fontSize: 12 }}>✕</button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Market watchlist */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <SectionTitle>Market Watchlist</SectionTitle>
            <button onClick={() => fetchQuotes(holdings.map(h => h.ticker))} disabled={loadingQuotes}
              style={{ fontSize: 9, color: C.teal, background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}>
              {loadingQuotes ? "Loading…" : "↻ Refresh"}
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {WATCHLIST_DEFAULT.map(t => {
              const q = quotes[t];
              return (
                <div key={t} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px",
                  borderRadius: 8, background: "rgba(255,255,255,0.025)", border: "0.5px solid rgba(255,255,255,0.04)" }}>
                  <div style={{ width: 36, height: 28, borderRadius: 6, background: `${C.blue}18`,
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, color: C.blue }}>
                    {t}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: "#f0ede8" }}>{q?.name || t}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#f0ede8" }}>
                      {q ? `$${q.price?.toFixed(2)}` : "—"}
                    </div>
                    {q?.changePct != null && (
                      <div style={{ fontSize: 9, color: pctColor(q.changePct) }}>
                        {q.changePct >= 0 ? "+" : ""}{q.changePct.toFixed(2)}%
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <AIAdvisor
        prompt={`My stock portfolio: ${fmtUSD(portfolioValue)} value, ${fmtUSD(portfolioPnL)} total P&L (${portfolioPct.toFixed(1)}%). Positions: ${holdingsCtx || "none yet"}. Market watchlist: ${Object.entries(quotes).map(([t,q]) => `${t}: $${q.price?.toFixed(2)} (${q.changePct?.toFixed(2)}%)`).join(", ")}. Give me specific buy/sell/hold recommendations with entry points, target prices, stop-losses, and position sizing advice based on current market conditions.`}
        buttonLabel="Get Stock Trading Advice"
        color={C.blue}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: CREDIT SCORE
// ─────────────────────────────────────────────────────────────────────────────
function CreditTab({ data, setData }) {
  const [scores, setScores] = useState(() => data.credit?.scores || { karma: 0, experian: 0, equifax: 0, transunion: 0 });
  const [history, setHistory] = useState(() => data.credit?.history || []);
  const [debts, setDebts] = useState(() => data.credit?.debts || []);
  const [editing, setEditing] = useState(false);
  const [scoreInput, setScoreInput] = useState({ ...scores });
  const [debtForm, setDebtForm] = useState({ name: "", balance: "", limit: "", type: "credit_card", rate: "" });
  const [addingDebt, setAddingDebt] = useState(false);

  const avgScore = [scores.karma, scores.experian, scores.equifax, scores.transunion]
    .filter(s => s > 0).reduce((s, v, _, a) => s + v / a.length, 0);

  const scoreColor = avgScore >= 750 ? C.green : avgScore >= 700 ? C.teal : avgScore >= 650 ? C.amber : avgScore >= 600 ? C.orange : C.red;
  const scoreLabel = avgScore >= 750 ? "Exceptional" : avgScore >= 700 ? "Good" : avgScore >= 650 ? "Fair" : avgScore >= 600 ? "Poor" : avgScore > 0 ? "Very Poor" : "Not Set";

  const totalDebt    = debts.reduce((s, d) => s + (Number(d.balance) || 0), 0);
  const totalLimit   = debts.filter(d => d.limit > 0).reduce((s, d) => s + (Number(d.limit) || 0), 0);
  const utilization  = totalLimit > 0 ? (totalDebt / totalLimit * 100) : 0;

  async function saveScores() {
    const next = { ...scores, ...scoreInput };
    const newEntry = { date: new Date().toLocaleDateString(), ...next };
    const hist = [newEntry, ...history].slice(0, 24);
    setScores(next);
    setHistory(hist);
    const update = { ...data.credit, scores: next, history: hist };
    setData(d => ({ ...d, credit: update }));
    await kvSet("finance_credit", update);
    setEditing(false);
  }

  async function addDebt() {
    if (!debtForm.name || !debtForm.balance) return;
    const next = [...debts, { ...debtForm, balance: Number(debtForm.balance), limit: Number(debtForm.limit || 0), rate: Number(debtForm.rate || 0), id: Date.now() }];
    setDebts(next);
    const update = { ...data.credit, debts: next };
    setData(d => ({ ...d, credit: update }));
    await kvSet("finance_credit", update);
    setDebtForm({ name: "", balance: "", limit: "", type: "credit_card", rate: "" });
    setAddingDebt(false);
  }

  async function deleteDebt(id) {
    const next = debts.filter(d => d.id !== id);
    setDebts(next);
    const update = { ...data.credit, debts: next };
    setData(d => ({ ...d, credit: update }));
    await kvSet("finance_credit", update);
  }

  // Arc SVG
  const Arc = ({ score, label, color, size = 120 }) => {
    const pct = Math.min(Math.max((score - 300) / 550, 0), 1);
    const r = size * 0.4, cx = size / 2, cy = size * 0.55, sw = size * 0.07;
    const startAngle = -Math.PI * 0.8, spanAngle = Math.PI * 1.6;
    const ang = (a) => ({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
    const s = ang(startAngle), e = ang(startAngle + spanAngle), ep = ang(startAngle + spanAngle * pct);
    const bgPath = `M${s.x},${s.y} A${r},${r},0,1,1,${e.x},${e.y}`;
    const fgPath = pct > 0 ? `M${s.x},${s.y} A${r},${r},0,${pct > 0.5 ? 1 : 0},1,${ep.x},${ep.y}` : "";
    return (
      <div style={{ textAlign: "center" }}>
        <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
          <path d={bgPath} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={sw} strokeLinecap="round" />
          {fgPath && <path d={fgPath} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" />}
          <text x={cx} y={cy + 5} textAnchor="middle" fill={score > 0 ? color : "#444"} fontSize={score > 0 ? size * 0.18 : size * 0.13} fontWeight={800}>{score > 0 ? score : "—"}</text>
        </svg>
        <div style={{ fontSize: 9, color: "#555", marginTop: -8 }}>{label}</div>
      </div>
    );
  };

  const histData = history.slice(0, 12).reverse().map(h => ({ date: h.date, avg: Math.round(([h.karma, h.experian, h.equifax, h.transunion].filter(Boolean).reduce((a, b) => a + b, 0) / ([h.karma, h.experian, h.equifax, h.transunion].filter(Boolean).length || 1))) }));

  const creditCtx = `Credit scores: Karma ${scores.karma}, Experian ${scores.experian}, Equifax ${scores.equifax}, TransUnion ${scores.transunion}. Average: ${avgScore.toFixed(0)}. Credit utilization: ${utilization.toFixed(0)}% (${fmtUSD(totalDebt)} of ${fmtUSD(totalLimit)}). Debts: ${debts.map(d => `${d.name}: $${d.balance} balance${d.rate ? ` at ${d.rate}% APR` : ""}`).join(", ") || "none listed"}.`;

  return (
    <div style={{ padding: 20 }}>
      {/* Score display */}
      <Card accent={scoreColor + "33"} style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
          <div>
            <SectionTitle color={scoreColor}>Credit Scores</SectionTitle>
            <div style={{ fontSize: 36, fontWeight: 900, color: scoreColor, lineHeight: 1 }}>{avgScore > 0 ? Math.round(avgScore) : "—"}</div>
            <div style={{ fontSize: 12, color: scoreColor, fontWeight: 600, marginTop: 3 }}>{scoreLabel}</div>
          </div>
          <button onClick={() => { setScoreInput({ ...scores }); setEditing(e => !e); }}
            style={{ padding: "7px 16px", borderRadius: 8, background: `${scoreColor}18`, border: `0.5px solid ${scoreColor}44`,
              color: scoreColor, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
            {editing ? "Cancel" : "Update Scores"}
          </button>
        </div>

        {editing && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 12,
            padding: 12, borderRadius: 8, background: "rgba(0,0,0,0.3)" }}>
            {[["Credit Karma", "karma"], ["Experian", "experian"], ["Equifax", "equifax"], ["TransUnion", "transunion"]].map(([l, k]) => (
              <div key={k}>
                <div style={{ fontSize: 9, color: "#555", marginBottom: 3 }}>{l}</div>
                <input type="number" value={scoreInput[k] || ""} onChange={e => setScoreInput(s => ({ ...s, [k]: Number(e.target.value) }))}
                  placeholder="300-850" min={300} max={850} {...inp()} />
              </div>
            ))}
            <button onClick={saveScores} style={{ gridColumn: "1/-1", padding: "8px", borderRadius: 8,
              background: scoreColor, border: "none", color: "#000", fontWeight: 700, cursor: "pointer", fontSize: 11 }}>Save Scores</button>
          </div>
        )}

        {/* Four score arcs */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
          {[["Credit Karma", "karma", C.teal], ["Experian", "experian", C.blue], ["Equifax", "equifax", C.purple], ["TransUnion", "transunion", C.orange]].map(([l, k, c]) => (
            <Arc key={k} score={scores[k]} label={l} color={c} size={120} />
          ))}
        </div>

        {/* Score history chart */}
        {histData.length > 1 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 9, color: "#444", marginBottom: 6 }}>SCORE HISTORY</div>
            <ResponsiveContainer width="100%" height={80}>
              <LineChart data={histData}>
                <YAxis domain={["dataMin - 20", "dataMax + 20"]} hide />
                <Tooltip contentStyle={{ background: "#0f1020", border: "0.5px solid #333", borderRadius: 6, fontSize: 10 }} />
                <Line type="monotone" dataKey="avg" stroke={scoreColor} strokeWidth={2} dot={{ fill: scoreColor, r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {/* Credit utilization */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <Card>
          <SectionTitle>Credit Utilization</SectionTitle>
          <div style={{ marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: "#888" }}>Utilization Rate</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: utilization > 30 ? C.red : utilization > 10 ? C.amber : C.green }}>
                {utilization.toFixed(0)}%
              </span>
            </div>
            <div style={{ height: 8, background: "rgba(255,255,255,0.06)", borderRadius: 4, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${Math.min(100, utilization)}%`, borderRadius: 4, transition: "width 0.5s",
                background: utilization > 30 ? C.red : utilization > 10 ? C.amber : C.green }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 9, color: "#555" }}>
              <span>Total Debt: {fmtUSD(totalDebt)}</span>
              <span>Total Limit: {fmtUSD(totalLimit)}</span>
            </div>
          </div>
          <div style={{ fontSize: 9, color: "#555", padding: "8px", borderRadius: 6, background: "rgba(255,255,255,0.03)", lineHeight: 1.6 }}>
            {utilization > 30 ? "⚠ High utilization hurts your score. Pay down balances to get below 30%." :
             utilization > 10 ? "🆗 Moderate utilization. Aim for under 10% for maximum score impact." :
             "✅ Excellent! Low utilization positively impacts your score."}
          </div>
        </Card>

        <Card>
          <SectionTitle>Score Factors</SectionTitle>
          {[
            { factor: "Payment History",   weight: "35%", status: "Unknown", color: "#888" },
            { factor: "Credit Utilization", weight: "30%", status: utilization > 30 ? "High" : utilization > 10 ? "OK" : "Good", color: utilization > 30 ? C.red : utilization > 10 ? C.amber : C.green },
            { factor: "Credit Age",        weight: "15%", status: "Unknown", color: "#888" },
            { factor: "Credit Mix",        weight: "10%", status: `${debts.length} accounts`, color: C.blue },
            { factor: "New Credit",        weight: "10%", status: "Unknown", color: "#888" },
          ].map(f => (
            <div key={f.factor} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0",
              borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>
              <div>
                <span style={{ fontSize: 11, color: "#f0ede8" }}>{f.factor}</span>
                <span style={{ fontSize: 9, color: "#444", marginLeft: 6 }}>({f.weight})</span>
              </div>
              <span style={{ fontSize: 10, color: f.color, fontWeight: 600 }}>{f.status}</span>
            </div>
          ))}
        </Card>
      </div>

      {/* Debts */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <SectionTitle>Debts & Credit Lines</SectionTitle>
          <button onClick={() => setAddingDebt(a => !a)}
            style={{ padding: "5px 12px", borderRadius: 20, background: `${C.purple}18`, border: `0.5px solid ${C.purple}44`,
              color: C.purple, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>+ Add Debt</button>
        </div>

        {addingDebt && (
          <Card style={{ marginBottom: 10 }} accent={C.purple + "33"}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginBottom: 8 }}>
              {[["Name / Lender", "name", "text", "Chase Sapphire"], ["Balance", "balance", "number", "0"], ["Credit Limit", "limit", "number", "0"], ["APR %", "rate", "number", "0"]].map(([l, k, t, ph]) => (
                <div key={k}><div style={{ fontSize: 9, color: "#555", marginBottom: 3 }}>{l}</div>
                  <input type={t} value={debtForm[k]} onChange={e => setDebtForm(f => ({ ...f, [k]: e.target.value }))} placeholder={ph} {...inp()} /></div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={addDebt} style={{ padding: "8px 20px", borderRadius: 8, background: C.purple, border: "none", color: "#000", fontWeight: 700, cursor: "pointer", fontSize: 11 }}>Add</button>
              <button onClick={() => setAddingDebt(false)} style={{ padding: "8px 12px", borderRadius: 8, background: "transparent", border: "0.5px solid rgba(255,255,255,0.1)", color: "#888", cursor: "pointer", fontSize: 11 }}>Cancel</button>
            </div>
          </Card>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {debts.length === 0 ? (
            <div style={{ textAlign: "center", padding: 24, fontSize: 11, color: "#444" }}>No debts tracked yet</div>
          ) : debts.map(d => {
            const util = d.limit > 0 ? (d.balance / d.limit * 100) : 0;
            return (
              <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                borderRadius: 9, background: "rgba(255,255,255,0.025)", border: "0.5px solid rgba(255,255,255,0.05)" }}>
                <div style={{ fontSize: 18 }}>{d.type === "credit_card" ? "💳" : d.type === "loan" ? "🏦" : d.type === "mortgage" ? "🏠" : "💸"}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#f0ede8" }}>{d.name}</div>
                  <div style={{ fontSize: 9, color: "#555" }}>
                    {d.limit > 0 && `Util: ${util.toFixed(0)}% · Limit: ${fmtUSD(d.limit)}`}
                    {d.rate > 0 && ` · APR: ${d.rate}%`}
                  </div>
                  {d.limit > 0 && (
                    <div style={{ height: 3, background: "rgba(255,255,255,0.05)", borderRadius: 2, marginTop: 4, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${Math.min(100, util)}%`, background: util > 30 ? C.red : C.teal, borderRadius: 2 }} />
                    </div>
                  )}
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.red }}>{fmtUSD(d.balance)}</div>
                </div>
                <button onClick={() => deleteDebt(d.id)} style={{ background: "none", border: "none", color: "#444", cursor: "pointer", fontSize: 12 }}>✕</button>
              </div>
            );
          })}
        </div>
      </div>

      <AIAdvisor
        prompt={`My credit profile: ${creditCtx} Give me a detailed plan to improve my credit score by at least 50-100 points in the next 6-12 months. Include specific action items, timelines, which debts to pay down first, and any mistakes I might be making. Also explain how to dispute errors and optimize my credit mix.`}
        buttonLabel="Build My Credit Improvement Plan"
        color={scoreColor}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: AI INVESTMENTS
// ─────────────────────────────────────────────────────────────────────────────
function InvestTab({ data }) {
  const [riskProfile, setRiskProfile] = useState(() => data.invest?.riskProfile || "moderate");
  const [investAmount, setInvestAmount] = useState(() => data.invest?.amount || 10000);
  const [timeHorizon, setTimeHorizon] = useState(() => data.invest?.horizon || "5");
  const [goals, setGoals] = useState(() => data.invest?.goals || "Wealth building and passive income");
  const [ideas, setIdeas] = useState([]);
  const [loadingIdeas, setLoadingIdeas] = useState(false);
  const [projections, setProjections] = useState(null);
  const [loadingProj, setLoadingProj] = useState(false);
  const [portfolio, setPortfolio] = useState(null);
  const [loadingPort, setLoadingPort] = useState(false);

  // Compute projection data
  function buildProjectionData(amount, years, returnRate) {
    const data = [];
    for (let y = 0; y <= years; y++) {
      data.push({
        year: `Y${y}`,
        conservative: Math.round(amount * Math.pow(1 + 0.05, y)),
        moderate:     Math.round(amount * Math.pow(1 + returnRate, y)),
        aggressive:   Math.round(amount * Math.pow(1 + 0.15, y)),
      });
    }
    return data;
  }
  const projData = buildProjectionData(investAmount, Number(timeHorizon), riskProfile === "conservative" ? 0.06 : riskProfile === "aggressive" ? 0.14 : 0.10);
  const finalValue = projData[projData.length - 1];

  async function getIdeas() {
    setLoadingIdeas(true);
    const result = await askAI(
      `I have $${investAmount.toLocaleString()} to invest with a ${timeHorizon}-year horizon. Risk profile: ${riskProfile}. Goals: ${goals}. Current financial context: crypto portfolio ${fmtUSD(data.crypto?.holdings?.reduce((s, h) => s + (h.value || 0), 0) || 0)}, stock portfolio ${fmtUSD(data.stocks?.holdings?.reduce((s, h) => s + (h.value || 0), 0) || 0)}.\n\nGive me 8 specific investment ideas with: 1) Asset/ticker, 2) Why now, 3) Expected return %, 4) Risk level, 5) Time to hold, 6) Entry strategy. Include a mix of stocks, ETFs, crypto, real estate, and business investments. Be specific and data-driven.`
    );
    setIdeas([result]);
    setLoadingIdeas(false);
  }

  async function getProjections() {
    setLoadingProj(true);
    const result = await askAI(
      `For $${investAmount.toLocaleString()} invested over ${timeHorizon} years with ${riskProfile} risk profile and goal: "${goals}".\n\nProvide detailed financial projections including: 1) Best/base/worst case scenarios with dollar amounts, 2) Recommended asset allocation breakdown with percentages, 3) Monthly investment strategy, 4) Tax-efficient strategies, 5) Milestone targets at 1yr, 3yr, 5yr, 10yr. Be specific with numbers.`
    );
    setProjections(result);
    setLoadingProj(false);
  }

  async function buildPortfolio() {
    setLoadingPort(true);
    const result = await askAI(
      `Build me a complete investment portfolio for $${investAmount.toLocaleString()} with ${riskProfile} risk, ${timeHorizon}-year horizon, goal: "${goals}".\n\nProvide: 1) Exact allocation (% and $ per asset), 2) Specific tickers/assets for each allocation, 3) Rebalancing schedule, 4) Monthly contribution plan, 5) Expected total return and annual yield, 6) Diversification across: US stocks, international, bonds, real estate, crypto, alternatives. Format as a structured portfolio breakdown.`
    );
    setPortfolio(result);
    setLoadingPort(false);
  }

  return (
    <div style={{ padding: 20 }}>
      {/* Config */}
      <Card accent={C.purple + "33"} style={{ marginBottom: 16 }}>
        <SectionTitle color={C.purple}>Investment Parameters</SectionTitle>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
          <div>
            <div style={{ fontSize: 9, color: "#555", marginBottom: 5 }}>Investment Amount</div>
            <input type="number" value={investAmount} onChange={e => setInvestAmount(Number(e.target.value))}
              {...inp({ fontSize: 14, fontWeight: 700 })} />
          </div>
          <div>
            <div style={{ fontSize: 9, color: "#555", marginBottom: 5 }}>Time Horizon</div>
            <select value={timeHorizon} onChange={e => setTimeHorizon(e.target.value)}
              style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "0.5px solid rgba(255,255,255,0.12)", background: "#0f1020", color: "#f0ede8", fontSize: 12, outline: "none" }}>
              {["1","2","3","5","7","10","15","20","30"].map(y => <option key={y} value={y}>{y} Year{y !== "1" ? "s" : ""}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 9, color: "#555", marginBottom: 5 }}>Risk Profile</div>
            <div style={{ display: "flex", gap: 4 }}>
              {["conservative","moderate","aggressive"].map(r => (
                <button key={r} onClick={() => setRiskProfile(r)}
                  style={{ flex: 1, padding: "8px 4px", borderRadius: 7, fontSize: 9, fontWeight: 600, cursor: "pointer",
                    background: riskProfile === r ? `${r === "conservative" ? C.green : r === "moderate" ? C.blue : C.red}22` : "rgba(255,255,255,0.04)",
                    border: `0.5px solid ${riskProfile === r ? (r === "conservative" ? C.green : r === "moderate" ? C.blue : C.red) + "55" : "rgba(255,255,255,0.08)"}`,
                    color: riskProfile === r ? (r === "conservative" ? C.green : r === "moderate" ? C.blue : C.red) : "#666" }}>
                  {r[0].toUpperCase() + r.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 9, color: "#555", marginBottom: 5 }}>Investment Goals</div>
            <input value={goals} onChange={e => setGoals(e.target.value)} placeholder="Wealth, income, retirement…"
              {...inp()} />
          </div>
        </div>
      </Card>

      {/* Projection chart */}
      <Card style={{ marginBottom: 16 }}>
        <SectionTitle>Growth Projections</SectionTitle>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={projData}>
            <defs>
              {[["agg", C.red], ["mod", C.blue], ["con", C.green]].map(([id, color]) => (
                <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <XAxis dataKey="year" tick={{ fill: "#555", fontSize: 9 }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={v => `$${(v/1000).toFixed(0)}k`} tick={{ fill: "#555", fontSize: 9 }} axisLine={false} tickLine={false} width={50} />
            <Tooltip contentStyle={{ background: "#0f1020", border: "0.5px solid #333", borderRadius: 8, fontSize: 10 }}
              formatter={(v) => fmtUSD(v)} />
            <Area type="monotone" dataKey="aggressive"   stroke={C.red}   fill="url(#agg)" strokeWidth={2} dot={false} name="Aggressive (14%)"   />
            <Area type="monotone" dataKey="moderate"     stroke={C.blue}  fill="url(#mod)" strokeWidth={2} dot={false} name="Moderate (10%)"      />
            <Area type="monotone" dataKey="conservative" stroke={C.green} fill="url(#con)" strokeWidth={2} dot={false} name="Conservative (5%)"   />
          </AreaChart>
        </ResponsiveContainer>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginTop: 12 }}>
          {[
            ["Conservative (5%)",  finalValue?.conservative, C.green],
            ["Moderate (10%)",     finalValue?.moderate,     C.blue],
            ["Aggressive (14%)",   finalValue?.aggressive,   C.red],
          ].map(([l, v, c]) => (
            <div key={l} style={{ textAlign: "center", padding: "10px 8px", borderRadius: 8, background: `${c}0d`, border: `0.5px solid ${c}33` }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: c }}>{fmtUSD(v)}</div>
              <div style={{ fontSize: 9, color: "#555", marginTop: 2 }}>{l}</div>
              <div style={{ fontSize: 9, color: "#444" }}>in {timeHorizon}yr</div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          {[["Conservative", C.green], ["Moderate", C.blue], ["Aggressive", C.red]].map(([l, c]) => (
            <div key={l} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 9, color: "#666" }}>
              <div style={{ width: 10, height: 2, background: c, borderRadius: 1 }} />{l}
            </div>
          ))}
        </div>
      </Card>

      {/* AI Action buttons */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
        {[
          { label: "Get Investment Ideas", action: getIdeas, loading: loadingIdeas, color: C.purple, icon: "💡" },
          { label: "Detailed Projections", action: getProjections, loading: loadingProj, color: C.blue,  icon: "📊" },
          { label: "Build My Portfolio",   action: buildPortfolio, loading: loadingPort, color: C.teal,  icon: "🏗" },
        ].map(({ label, action, loading, color, icon }) => (
          <button key={label} onClick={action} disabled={loading}
            style={{ padding: "14px 12px", borderRadius: 12, background: `${color}12`, border: `0.5px solid ${color}44`,
              color, cursor: "pointer", fontWeight: 700, fontSize: 12, opacity: loading ? 0.7 : 1,
              display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 22 }}>{icon}</span>
            {loading ? "Thinking…" : label}
          </button>
        ))}
      </div>

      {/* Results */}
      {ideas.length > 0 && (
        <Card accent={C.purple + "33"} style={{ marginBottom: 12 }}>
          <SectionTitle color={C.purple}>💡 Investment Ideas</SectionTitle>
          <div style={{ fontSize: 11, color: "#c8c8e0", lineHeight: 1.75, whiteSpace: "pre-wrap" }}>{ideas[0]}</div>
        </Card>
      )}
      {projections && (
        <Card accent={C.blue + "33"} style={{ marginBottom: 12 }}>
          <SectionTitle color={C.blue}>📊 Detailed Projections</SectionTitle>
          <div style={{ fontSize: 11, color: "#c8c8e0", lineHeight: 1.75, whiteSpace: "pre-wrap" }}>{projections}</div>
        </Card>
      )}
      {portfolio && (
        <Card accent={C.teal + "33"} style={{ marginBottom: 12 }}>
          <SectionTitle color={C.teal}>🏗 Custom Portfolio Blueprint</SectionTitle>
          <div style={{ fontSize: 11, color: "#c8c8e0", lineHeight: 1.75, whiteSpace: "pre-wrap" }}>{portfolio}</div>
        </Card>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function FinancePanel() {
  const [tab, setTab] = useState("overview");
  const [data, setData] = useState(() => ({
    accounts: load("fp_accounts", []),
    cashflow: load("fp_cashflow", { income: [], expenses: [] }),
    budget:   load("fp_budget",   { categories: [], monthlyIncome: 10000 }),
    invoices: load("fp_invoices", []),
    crypto:   load("fp_crypto",   { holdings: [] }),
    stocks:   load("fp_stocks",   { holdings: [] }),
    credit:   load("fp_credit",   { scores: { karma: 0, experian: 0, equifax: 0, transunion: 0 }, history: [], debts: [] }),
    invest:   load("fp_invest",   { riskProfile: "moderate", amount: 10000, horizon: "5", goals: "" }),
  }));

  // Load from KV on mount
  useEffect(() => {
    (async () => {
      const keys = ["finance_cashflow","finance_budget","finance_invoices","finance_crypto","finance_stocks","finance_credit","finance_accounts"];
      const mapKey = { finance_cashflow: "cashflow", finance_budget: "budget", finance_invoices: "invoices", finance_crypto: "crypto", finance_stocks: "stocks", finance_credit: "credit", finance_accounts: "accounts" };
      const results = await Promise.all(keys.map(k => kvGet(k)));
      const update = {};
      keys.forEach((k, i) => { if (results[i]) update[mapKey[k]] = results[i]; });
      if (Object.keys(update).length) setData(d => ({ ...d, ...update }));
    })();
  }, []);

  const setDataMerge = useCallback((updater) => {
    setData(d => {
      const next = typeof updater === "function" ? updater(d) : updater;
      // Persist to localStorage
      Object.entries(next).forEach(([k, v]) => save(`fp_${k}`, v));
      return next;
    });
  }, []);

  const activeTab = TABS.find(t => t.id === tab);

  return (
    <div style={{ height: "calc(100vh - 52px)", display: "flex", flexDirection: "column", overflow: "hidden", background: "#080912" }}>
      {/* Header */}
      <div style={{ padding: "0 20px", borderBottom: "0.5px solid rgba(255,255,255,0.07)",
        background: "#0a0b17", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, height: 48 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#f0ede8" }}>Finance Hub</div>
          <div style={{ width: 1, height: 16, background: "rgba(255,255,255,0.1)" }} />
          <div style={{ fontSize: 11, color: "#2a6fa8" }}>CEO GPS · Atlanta, GA</div>
        </div>
        {/* Tab bar */}
        <div style={{ display: "flex", gap: 2, paddingBottom: "0px" }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "8px 14px", border: "none", cursor: "pointer",
                background: tab === t.id ? "rgba(0,200,150,0.1)" : "transparent",
                color: tab === t.id ? C.teal : "#666",
                fontWeight: tab === t.id ? 700 : 400,
                fontSize: 11,
                borderBottom: tab === t.id ? `2px solid ${C.teal}` : "2px solid transparent",
                transition: "all 0.15s",
              }}>
              <span style={{ fontSize: 13 }}>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Panel content */}
      <div style={{ flex: 1, overflowY: "auto", background: "#080912" }}>
        {tab === "overview" && <OverviewTab  data={data} onNav={setTab} />}
        {tab === "budget"   && <BudgetTab    data={data} setData={setDataMerge} />}
        {tab === "cashflow" && <CashFlowTab  data={data} setData={setDataMerge} />}
        {tab === "invoices" && <InvoicesTab  data={data} setData={setDataMerge} />}
        {tab === "crypto"   && <CryptoTab    data={data} setData={setDataMerge} />}
        {tab === "stocks"   && <StocksTab    data={data} setData={setDataMerge} />}
        {tab === "credit"   && <CreditTab    data={data} setData={setDataMerge} />}
        {tab === "invest"   && <InvestTab    data={data} />}
      </div>
    </div>
  );
}