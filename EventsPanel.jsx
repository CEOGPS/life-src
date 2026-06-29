import { useState } from "react";
import { invokeLLM } from "@/api/ceogpsclient.jsx";
import Icon from "@/components/lifeos/icons/Icon";

const C = { blue: "#4ab3f4", orange: "#ff8c42", teal: "#00c896", purple: "#8b7fff", pink: "#ff6b9d", red: "#ff4f5e" };
const card = { background: "#13141f", border: "0.5px solid rgba(255,255,255,0.07)", borderRadius: 12 };

const INIT_EVENTS = [];

const TYPES = ["All", "Business", "Community", "Personal", "Family"];
const STATUSES = { Confirmed: C.teal, Planning: C.orange, Idea: C.purple };

export default function EventsPanel() {
  const [events, setEvents] = useState(INIT_EVENTS);
  const [selected, setSelected] = useState(null);
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState("All");
  const [form, setForm] = useState({ name: "", date: "", location: "", type: "Business", status: "Idea", emoji: "🎟️" });
  const [aiResult, setAiResult] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAction, setAiAction] = useState("");

  const inputStyle = { width: "100%", padding: "8px 10px", borderRadius: 7, border: "0.5px solid rgba(255,255,255,0.12)", background: "#0d0e17", color: "#f0ede8", fontSize: 12, outline: "none", boxSizing: "border-box" };

  const filtered = events.filter(e => filter === "All" || e.type === filter);

  function addEvent() {
    if (!form.name) return;
    setEvents(ev => [...ev, { id: Date.now(), ...form, attendees: 0, revenue: "$0" }]);
    setForm({ name: "", date: "", location: "", type: "Business", status: "Idea", emoji: "🎟️" });
    setAdding(false);
  }

  async function runAI(event, action) {
    setAiLoading(true);
    setAiResult("");
    setAiAction(action);
    const prompts = {
      promote: `Write a compelling social media promo post for this event: "${event.name}" on ${event.date} at ${event.location}. Type: ${event.type}. Make it energetic and shareable. Include 3 relevant hashtags.`,
      plan: `Create a brief event planning checklist for: "${event.name}" on ${event.date} at ${event.location}. Include: venue prep, marketing, day-of tasks, and follow-up. Keep it concise and actionable.`,
      email: `Write a professional event invitation email for "${event.name}" on ${event.date} at ${event.location}. From Chris Green. Keep it engaging, concise, and include a clear call to action.`,
    };
    const result = await invokeLLM({ prompt: prompts[action] });
    setAiResult(result);
    setAiLoading(false);
  }

  return (
    <div style={{ padding: 24 }}>
      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 20 }}>
        {[{ label: "Upcoming Events", val: events.length, color: C.blue }, { label: "Total Attendees", val: events.reduce((a, e) => a + e.attendees, 0), color: C.orange }, { label: "Est. Revenue", val: "$1,120", color: C.teal }].map(s => (
          <div key={s.label} style={{ ...card, padding: 16, textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.val}</div>
            <div style={{ fontSize: 11, color: "#6aaedd", marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter + Add */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 6 }}>
          {TYPES.map(t => (
            <button key={t} onClick={() => setFilter(t)}
              style={{ padding: "4px 10px", borderRadius: 20, fontSize: 10, fontWeight: 600, cursor: "pointer", border: "0.5px solid", background: filter === t ? "rgba(74,179,244,0.15)" : "transparent", borderColor: filter === t ? C.blue : "rgba(255,255,255,0.08)", color: filter === t ? C.blue : "#6aaedd" }}>
              {t}
            </button>
          ))}
        </div>
        <button onClick={() => setAdding(a => !a)} style={{ padding: "7px 14px", borderRadius: 20, background: "rgba(74,179,244,0.1)", border: "0.5px solid rgba(74,179,244,0.3)", color: C.blue, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>+ New Event</button>
      </div>

      {adding && (
        <div style={{ ...card, padding: 20, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#f0ede8", marginBottom: 12 }}>New Event</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[["name","Event Name*"],["date","Date"],["location","Location"],["emoji","Emoji"]].map(([k, label]) => (
              <div key={k}>
                <div style={{ fontSize: 10, color: "#6aaedd", marginBottom: 3 }}>{label}</div>
                <input value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} style={inputStyle} />
              </div>
            ))}
            <div>
              <div style={{ fontSize: 10, color: "#6aaedd", marginBottom: 3 }}>Type</div>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} style={inputStyle}>
                {TYPES.slice(1).map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 10, color: "#6aaedd", marginBottom: 3 }}>Status</div>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={inputStyle}>
                {["Idea","Planning","Confirmed"].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button onClick={addEvent} style={{ flex: 1, padding: "9px", borderRadius: 8, background: "rgba(74,179,244,0.15)", border: "0.5px solid " + C.blue, color: C.blue, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Save Event</button>
            <button onClick={() => setAdding(false)} style={{ flex: 1, padding: "9px", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.1)", color: "#6aaedd", fontSize: 12, cursor: "pointer" }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Event list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.map(ev => (
          <div key={ev.id} style={{ ...card, padding: 16 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
              <span style={{ fontSize: 28, flexShrink: 0 }}>{ev.emoji}</span>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#f0ede8" }}>{ev.name}</div>
                  <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 20, background: (STATUSES[ev.status] || C.blue) + "22", color: STATUSES[ev.status] || C.blue, fontWeight: 700 }}>{ev.status}</span>
                </div>
                <div style={{ fontSize: 11, color: "#6aaedd", marginBottom: 8 }}>📅 {ev.date} · 📍 {ev.location} · 👤 {ev.attendees} attendees · {ev.revenue}</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {[["promote","📣 Promote"],["plan","📋 Plan"],["email","✉ Invite Email"]].map(([action, label]) => (
                    <button key={action} onClick={() => { setSelected(ev.id); runAI(ev, action); }}
                      disabled={aiLoading && selected === ev.id}
                      style={{ padding: "5px 12px", borderRadius: 20, background: "rgba(74,179,244,0.1)", border: "0.5px solid rgba(74,179,244,0.25)", color: C.blue, fontSize: 10, fontWeight: 600, cursor: "pointer" }}>
                      {aiLoading && selected === ev.id && aiAction === action ? "◈..." : label}
                    </button>
                  ))}
                  <button onClick={() => setEvents(evs => evs.filter(x => x.id !== ev.id))}
                    style={{ padding: "5px 12px", borderRadius: 20, background: "rgba(255,79,94,0.08)", border: "0.5px solid rgba(255,79,94,0.2)", color: C.red, fontSize: 10, cursor: "pointer" }}><Icon name="🗑" size={14} /></button>
                </div>
              </div>
            </div>
            {selected === ev.id && (aiResult || aiLoading) && (
              <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 10, background: "rgba(74,179,244,0.05)", border: "0.5px solid rgba(74,179,244,0.2)", fontSize: 13, color: "#c8c8d0", lineHeight: 1.6 }}>
                {aiLoading ? <span style={{ color: C.blue }}><Icon name="◈" size={12} style={{marginRight:6,verticalAlign:"middle"}} />AgentZero working...</span> : aiResult}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}