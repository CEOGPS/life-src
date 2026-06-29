import { useState } from "react";
import { invokeLLM } from "@/api/ceogpsclient.jsx";
import Icon from "@/components/lifeos/icons/Icon";

const C = { blue: "#4ab3f4", orange: "#ff8c42", teal: "#00c896", purple: "#8b7fff", red: "#ff4f5e" };
const card = { background: "#13141f", border: "0.5px solid rgba(255,255,255,0.07)", borderRadius: 12 };

export default function OpportunityEngine({ contacts }) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState("");

  async function runEngine() {
    setRunning(true);
    setResult("");
    const contactList = contacts.map(c =>
      `${c.name} (${c.company}, ${c.stage}, ${c.tag}, value: ${c.value}, notes: ${c.notes})`
    ).join("\n");
    const res = await invokeLLM({
      prompt: `You are AgentZero, the AI sales engine for Chris Green's plumbing business in Atlanta. Here are his current CRM contacts:\n${contactList}\n\nRun an opportunity analysis: (1) Score each lead 1-10 on close probability, (2) identify the highest-value action for this week, (3) suggest one outreach sequence. Be specific, brief, and tactical.`
    });
    setResult(res);
    setRunning(false);
  }

  return (
    <div style={{ marginTop: 16 }}>
      <button onClick={runEngine} disabled={running}
        style={{ width: "100%", padding: 12, borderRadius: 10, background: running ? "rgba(255,140,66,0.05)" : "rgba(255,140,66,0.1)", border: "0.5px solid rgba(255,140,66,0.3)", color: C.orange, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
        {running ? "◈ Scanning leads..." : "⚡ Run Opportunity Engine — AI lead scoring + outreach ↗"}
      </button>
      {result && (
        <div style={{ ...card, marginTop: 10, padding: 16, borderColor: "rgba(255,140,66,0.2)" }}>
          <div style={{ fontSize: 10, color: C.orange, fontWeight: 700, marginBottom: 8, letterSpacing: ".05em" }}><Icon name="◈" size={12} style={{marginRight:6,verticalAlign:"middle"}} />AGENT ZERO — OPPORTUNITY REPORT</div>
          <div style={{ fontSize: 13, color: "#c8c8d0", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{result}</div>
        </div>
      )}
    </div>
  );
}