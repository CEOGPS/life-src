import { useState } from "react";
import { invokeLLM } from "@/api/ceogpsclient.jsx";
import Icon from "@/components/lifeos/icons/Icon";

const C = { blue: "#4ab3f4", orange: "#ff8c42", teal: "#00c896", purple: "#8b7fff", red: "#ff4f5e" };
const card = { background: "#13141f", border: "0.5px solid rgba(255,255,255,0.07)", borderRadius: 12 };

const INIT_INVOICES = [];

const STATUS_COLOR = { Paid: C.teal, Unpaid: C.orange, Draft: "#6aaedd", Overdue: C.red };

export default function InvoicingPanel() {
  const [invoices, setInvoices] = useState(INIT_INVOICES);
  const [selected, setSelected] = useState(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ client: "", service: "", amount: "", due: "", status: "Draft" });
  const [aiResult, setAiResult] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAction, setAiAction] = useState("");

  const inputStyle = { width: "100%", padding: "8px 10px", borderRadius: 7, border: "0.5px solid rgba(255,255,255,0.12)", background: "#0d0e17", color: "#f0ede8", fontSize: 12, outline: "none", boxSizing: "border-box" };

  const total = invoices.filter(i => i.status === "Paid").reduce((a, i) => a + parseFloat(i.amount.replace(/\$|,/g, "") || 0), 0);
  const outstanding = invoices.filter(i => i.status === "Unpaid").reduce((a, i) => a + parseFloat(i.amount.replace(/\$|,/g, "") || 0), 0);

  function addInvoice() {
    if (!form.client) return;
    const id = "INV-" + String(invoices.length + 1).padStart(3, "0");
    setInvoices(inv => [...inv, { id, ...form, date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }) }]);
    setForm({ client: "", service: "", amount: "", due: "", status: "Draft" });
    setAdding(false);
  }

  async function runAI(inv, action) {
    setAiLoading(true);
    setAiResult("");
    setAiAction(action);
    const prompts = {
      reminder: `Write a polite but firm payment reminder message from Chris Green (plumber) to ${inv.client} for invoice ${inv.id} — ${inv.service} — ${inv.amount}, due ${inv.due}. Keep it professional and friendly.`,
      summary: `Write a brief professional invoice summary/cover note from Chris Green Plumbing for ${inv.client}. Service: ${inv.service}. Amount: ${inv.amount}. Due: ${inv.due}. Make it warm and professional.`,
    };
    const result = await invokeLLM({ prompt: prompts[action] });
    setAiResult(result);
    setAiLoading(false);
  }

  return (
    <div style={{ padding: 24 }}>
      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 20 }}>
        {[{ label: "Total Collected", val: `$${total.toLocaleString()}`, color: C.teal }, { label: "Outstanding", val: `$${outstanding.toLocaleString()}`, color: C.orange }, { label: "Total Invoices", val: invoices.length, color: C.blue }].map(s => (
          <div key={s.label} style={{ ...card, padding: 16, textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.val}</div>
            <div style={{ fontSize: 11, color: "#6aaedd", marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
        <button onClick={() => setAdding(a => !a)} style={{ padding: "7px 14px", borderRadius: 20, background: "rgba(74,179,244,0.1)", border: "0.5px solid rgba(74,179,244,0.3)", color: C.blue, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>+ New Invoice</button>
      </div>

      {adding && (
        <div style={{ ...card, padding: 20, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#f0ede8", marginBottom: 12 }}>New Invoice</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[["client","Client Name*"],["service","Service Description"],["amount","Amount (e.g. $500)"],["due","Due Date"]].map(([k, label]) => (
              <div key={k}>
                <div style={{ fontSize: 10, color: "#6aaedd", marginBottom: 3 }}>{label}</div>
                <input value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} style={inputStyle} />
              </div>
            ))}
            <div>
              <div style={{ fontSize: 10, color: "#6aaedd", marginBottom: 3 }}>Status</div>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={inputStyle}>
                {["Draft","Unpaid","Paid"].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button onClick={addInvoice} style={{ flex: 1, padding: "9px", borderRadius: 8, background: "rgba(74,179,244,0.15)", border: "0.5px solid " + C.blue, color: C.blue, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Create Invoice</button>
            <button onClick={() => setAdding(false)} style={{ flex: 1, padding: "9px", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.1)", color: "#6aaedd", fontSize: 12, cursor: "pointer" }}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {invoices.map(inv => (
          <div key={inv.id} style={{ ...card, padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: "#2a6fa8", fontWeight: 600 }}>{inv.id}</span>
                  <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 20, background: (STATUS_COLOR[inv.status] || C.blue) + "22", color: STATUS_COLOR[inv.status] || C.blue, fontWeight: 700 }}>{inv.status}</span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#f0ede8", marginBottom: 2 }}>{inv.client}</div>
                <div style={{ fontSize: 11, color: "#6aaedd" }}>{inv.service}</div>
                <div style={{ fontSize: 11, color: "#6aaedd" }}>Issued: {inv.date} · Due: {inv.due}</div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: C.teal, marginBottom: 8 }}>{inv.amount}</div>
                <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                  {inv.status === "Unpaid" && (
                    <button onClick={() => { setSelected(inv.id); runAI(inv, "reminder"); }}
                      disabled={aiLoading && selected === inv.id}
                      style={{ padding: "4px 10px", borderRadius: 20, background: "rgba(255,140,66,0.1)", border: "0.5px solid rgba(255,140,66,0.3)", color: C.orange, fontSize: 10, fontWeight: 600, cursor: "pointer" }}>
                      {aiLoading && selected === inv.id && aiAction === "reminder" ? "◈..." : "📨 Reminder"}
                    </button>
                  )}
                  <button onClick={() => { setSelected(inv.id); runAI(inv, "summary"); }}
                    disabled={aiLoading && selected === inv.id}
                    style={{ padding: "4px 10px", borderRadius: 20, background: "rgba(74,179,244,0.1)", border: "0.5px solid rgba(74,179,244,0.3)", color: C.blue, fontSize: 10, fontWeight: 600, cursor: "pointer" }}>
                    {aiLoading && selected === inv.id && aiAction === "summary" ? "◈..." : "✦ Cover Note"}
                  </button>
                  {inv.status !== "Paid" && (
                    <button onClick={() => setInvoices(is => is.map(x => x.id === inv.id ? { ...x, status: "Paid" } : x))}
                      style={{ padding: "4px 10px", borderRadius: 20, background: "rgba(0,200,150,0.1)", border: "0.5px solid rgba(0,200,150,0.3)", color: C.teal, fontSize: 10, fontWeight: 600, cursor: "pointer" }}><Icon name="✓" size={12} style={{marginRight:6,verticalAlign:"middle"}} />Mark Paid
                    </button>
                  )}
                  <button onClick={() => setInvoices(is => is.filter(x => x.id !== inv.id))}
                    style={{ padding: "4px 8px", borderRadius: 20, background: "rgba(255,79,94,0.08)", border: "0.5px solid rgba(255,79,94,0.2)", color: C.red, fontSize: 10, cursor: "pointer" }}><Icon name="🗑" size={14} /></button>
                </div>
              </div>
            </div>
            {selected === inv.id && (aiResult || aiLoading) && (
              <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 10, background: "rgba(74,179,244,0.05)", border: "0.5px solid rgba(74,179,244,0.2)", fontSize: 13, color: "#c8c8d0", lineHeight: 1.6 }}>
                {aiLoading ? <span style={{ color: C.blue }}><Icon name="◈" size={12} style={{marginRight:6,verticalAlign:"middle"}} />AgentZero drafting...</span> : aiResult}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}