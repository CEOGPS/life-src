import { useState } from "react";
import { invokeLLM } from "@/api/ceogpsclient.jsx";
import Icon from "@/components/lifeos/icons/Icon";

const C = {
  blue: "#4ab3f4", orange: "#ff8c42", teal: "#00c896", purple: "#8b7fff", pink: "#ff6b9d", red: "#ff4f5e",
  glow: {
    blue:   "0 0 14px rgba(74,179,244,0.55),  0 0 30px rgba(74,179,244,0.2)",
    orange: "0 0 14px rgba(255,140,66,0.55),  0 0 30px rgba(255,140,66,0.2)",
    teal:   "0 0 14px rgba(0,200,150,0.55),   0 0 30px rgba(0,200,150,0.2)",
    purple: "0 0 14px rgba(139,127,255,0.55), 0 0 30px rgba(139,127,255,0.2)",
    pink:   "0 0 14px rgba(255,107,157,0.55), 0 0 30px rgba(255,107,157,0.2)",
  }
};
const card = { background: "#141414", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 12 };
const btn = (col) => ({ padding: "9px 16px", borderRadius: 8, background: "rgba(74,179,244,0.1)", border: "0.5px solid rgba(74,179,244,0.3)", color: col || C.blue, fontSize: 12, fontWeight: 600, cursor: "pointer" });

function AIOutput({ result, loading }) {
  if (!loading && !result) return null;
  return (
    <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 10, background: "rgba(74,179,244,0.06)", border: "0.5px solid rgba(74,179,244,0.2)", fontSize: 13, color: "#a9a9a9", lineHeight: 1.6 }}>
      {loading ? <span style={{ color: C.blue }}><Icon name="◈" size={12} style={{marginRight:6,verticalAlign:"middle"}} />AgentZero thinking...</span> : result}
    </div>
  );
}

// ─── CALENDAR ───────────────────────────────────────────────────────────────
export function CalendarPanel() {
  const [events, setEvents] = useState(() => {
    try { 
      const stored = localStorage.getItem("lifeos_calendar");
      return stored ? JSON.parse(stored) : [
        { id:1, icon:"🔧", name:"Buckhead Plumbing Job", date:new Date().toISOString().split("T")[0], time:"10:00", tag:"Business", color:"#4a9eff" },
        { id:2, icon:"⚽", name:"Jamal Soccer",           date:new Date().toISOString().split("T")[0], time:"16:00", tag:"Family",   color:"#00c896" },
        { id:3, icon:"🍝", name:"Family Dinner",          date:new Date().toISOString().split("T")[0], time:"18:30", tag:"Family",   color:"#00c896" },
      ];
    } catch { 
      return []; 
    }
  });
  const [view, setView] = useState("month"); // month | week | list
  const [currentDate, setCurrentDate] = useState(new Date());
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name:"", date:"", time:"", tag:"Personal", icon:"📌" });
  const [selectedDay, setSelectedDay] = useState(null);

  function saveEvents(list) { 
    try { 
      localStorage.setItem("lifeos_calendar", JSON.stringify(list)); 
    } catch (e) {
      console.warn("Failed to save calendar events:", e);
    } 
  }

  function addEvent() {
    if (!form.name || !form.date) return;
    const tagColors = { Business:"#4a9eff", Family:"#00c896", Personal:"#8b7fff", Community:"#ffb347" };
    const ev = { id:Date.now(), ...form, color:tagColors[form.tag] || "#8b7fff" };
    const updated = [...events, ev];
    setEvents(updated); 
    saveEvents(updated); 
    setAdding(false);
    setForm({ name:"", date:"", time:"", tag:"Personal", icon:"📌" });
  }

  function deleteEvent(id) {
    const updated = events.filter(e => e.id !== id);
    setEvents(updated); 
    saveEvents(updated);
  }

  // Calendar grid helpers
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = currentDate.toLocaleString("default", { month:"long" });
  const today = new Date().toISOString().split("T")[0];

  const days = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  function getDateStr(day) {
    return `${year}-${String(month + 1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
  }

  function getEventsForDay(day) {
    const d = getDateStr(day);
    return events.filter(e => e.date === d);
  }

  const inp = { 
    width: "100%", 
    padding: "7px 10px", 
    borderRadius: 7, 
    border: "0.5px solid var(--b2)", 
    background: "var(--bg3)", 
    color: "var(--t1)", 
    fontSize: 12, 
    outline: "none", 
    boxSizing: "border-box" 
  };

  return (
    <div style={{ padding: 20, height: "calc(100vh - 52px)", overflow: "auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <button 
          onClick={() => setCurrentDate(new Date(year, month - 1, 1))} 
          style={{ padding: "5px 10px", borderRadius: 6, background: "var(--bg3)", border: "0.5px solid var(--b2)", color: "var(--t1)", cursor: "pointer" }}
        >‹</button>
        <div style={{ fontSize: 18, fontWeight: 700, color: "var(--t1)", flex: 1 }}>
          {monthName} {year}
        </div>
        <button 
          onClick={() => setCurrentDate(new Date(year, month + 1, 1))} 
          style={{ padding: "5px 10px", borderRadius: 6, background: "var(--bg3)", border: "0.5px solid var(--b2)", color: "var(--t1)", cursor: "pointer" }}
        >›</button>
        <button 
          onClick={() => setCurrentDate(new Date())} 
          style={{ padding: "5px 12px", borderRadius: 6, background: "var(--teal)22", border: "0.5px solid var(--teal)55", color: "var(--teal)", fontSize: 11, cursor: "pointer" }}
        >Today</button>
        <a 
          href="https://calendly.com" 
          target="_blank" 
          rel="noreferrer" 
          style={{ padding: "5px 12px", borderRadius: 6, background: "var(--blue)22", border: "0.5px solid var(--blue)44", color: "var(--blue)", fontSize: 11, textDecoration: "none" }}
        >
          <Icon name="📅" size={12} style={{marginRight:6,verticalAlign:"middle"}} />Calendly ↗
        </a>
        <button 
          onClick={() => setAdding(true)} 
          style={{ padding: "6px 16px", borderRadius: 8, background: "var(--teal)", border: "none", color: "#000", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
        >+ Add Event</button>
      </div>

      {/* Calendar grid */}
      <div style={{ ...card, overflow: "hidden", marginBottom: 16 }}>
        {/* Day headers */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", background: "var(--bg3)", borderBottom: "0.5px solid var(--b1)" }}>
          {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => (
            <div key={d} style={{ padding: "8px", textAlign: "center", fontSize: 10, fontWeight: 700, color: "var(--t3)", letterSpacing: ".05em" }}>{d}</div>
          ))}
        </div>
        {/* Days */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)" }}>
          {days.map((day, i) => {
            if (!day) return <div key={"empty-" + i} style={{ minHeight: 80, borderRight: "0.5px solid var(--b1)", borderBottom: "0.5px solid var(--b1)" }} />;
            const dateStr = getDateStr(day);
            const dayEvents = getEventsForDay(day);
            const isToday = dateStr === today;
            const isSelected = selectedDay === day;
            return (
              <div 
                key={day} 
                onClick={() => setSelectedDay(day === selectedDay ? null : day)}
                style={{ 
                  minHeight: 80, 
                  padding: "6px", 
                  borderRight: "0.5px solid var(--b1)", 
                  borderBottom: "0.5px solid var(--b1)", 
                  cursor: "pointer", 
                  background: isSelected ? "rgba(0,200,150,0.05)" : "transparent",
                  transition: "background .15s" 
                }}>
                <div style={{ 
                  width: 22, 
                  height: 22, 
                  borderRadius: "50%", 
                  background: isToday ? "var(--teal)" : "transparent", 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "center", 
                  marginBottom: 4 
                }}>
                  <span style={{ 
                    fontSize: 11, 
                    fontWeight: isToday ? 700 : 400, 
                    color: isToday ? "#000" : "var(--t1)" 
                  }}>{day}</span>
                </div>
                {dayEvents.slice(0, 3).map(ev => (
                  <div 
                    key={ev.id} 
                    style={{ 
                      fontSize: 9, 
                      padding: "1px 5px", 
                      borderRadius: 3, 
                      background: ev.color + "22", 
                      color: ev.color, 
                      marginBottom: 2, 
                      overflow: "hidden", 
                      textOverflow: "ellipsis", 
                      whiteSpace: "nowrap" 
                    }}
                  >
                    {ev.icon} {ev.name}
                  </div>
                ))}
                {dayEvents.length > 3 && <div style={{ fontSize: 9, color: "var(--t3)" }}>+{dayEvents.length - 3}</div>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected day events */}
      {selectedDay && (
        <div style={{ ...card, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--t1)", marginBottom: 10 }}>
            {monthName} {selectedDay}, {year}
          </div>
          {getEventsForDay(selectedDay).length === 0 ? (
            <div style={{ fontSize: 11, color: "var(--t3)" }}>No events — click + Add Event to create one.</div>
          ) : getEventsForDay(selectedDay).map(ev => (
            <div key={ev.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "0.5px solid var(--b1)" }}>
              <span style={{ fontSize: 18 }}>{ev.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: "var(--t1)" }}>{ev.name}</div>
                <div style={{ fontSize: 10, color: "var(--t2)" }}>{ev.time || "All day"} · {ev.tag}</div>
              </div>
              <button onClick={() => deleteEvent(ev.id)} style={{ fontSize: 11, color: "var(--red)", background: "none", border: "none", cursor: "pointer" }}>
                <Icon name="✕" size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upcoming list */}
      <div style={{ ...card, padding: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--t1)", marginBottom: 10 }}>Upcoming</div>
        {events.filter(e => e.date >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 8).map(ev => (
          <div key={ev.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "0.5px solid var(--b1)" }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: ev.color + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
              {ev.icon}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: "var(--t1)" }}>{ev.name}</div>
              <div style={{ fontSize: 10, color: "var(--t2)" }}>{ev.date} {ev.time && `· ${ev.time}`}</div>
            </div>
            <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 20, background: ev.color + "22", color: ev.color, fontWeight: 600 }}>
              {ev.tag}
            </span>
            <button onClick={() => deleteEvent(ev.id)} style={{ fontSize: 11, color: "var(--red)", background: "none", border: "none", cursor: "pointer" }}>
              <Icon name="✕" size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* Add event modal */}
      {adding && (
        <div 
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={e => { if (e.target === e.currentTarget) setAdding(false); }}
        >
          <div style={{ ...card, width: 420, maxWidth: "90%", padding: 24, border: "1px solid var(--b2)" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--t1)", marginBottom: 16 }}>Add Event</div>
            {[
              ["Event Name", "name", "text", "What's happening?"],
              ["Date", "date", "date", ""],
              ["Time", "time", "time", ""]
            ].map(([label, key, type, ph]) => (
              <div key={key} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 10, color: "var(--t2)", marginBottom: 4 }}>{label}</div>
                <input 
                  type={type} 
                  value={form[key]} 
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} 
                  placeholder={ph} 
                  style={inp} 
                />
              </div>
            ))}
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, color: "var(--t2)", marginBottom: 4 }}>Category</div>
              <select 
                value={form.tag} 
                onChange={e => setForm(f => ({ ...f, tag: e.target.value }))} 
                style={inp}
              >
                {["Business", "Family", "Personal", "Community"].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button 
                onClick={() => setAdding(false)} 
                style={{ flex: 1, padding: "9px", borderRadius: 8, background: "var(--bg3)", border: "0.5px solid var(--b2)", color: "var(--t2)", cursor: "pointer" }}
              >Cancel</button>
              <button 
                onClick={addEvent} 
                style={{ flex: 1, padding: "9px", borderRadius: 8, background: "var(--teal)", border: "none", color: "#000", fontWeight: 700, cursor: "pointer" }}
              >Add Event</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── PULSE ─────────────────────────────────────────────────────────────────────
export function PulsePanel() {
  const [aiResult, setAiResult] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [actionResults, setActionResults] = useState({});
  const [actionLoading, setActionLoading] = useState({});

  const insights = [
    { 
      icon: "✦", 
      text: "9pm calls → 2 family dinners lost/week. Reschedule to 2pm, recover 8 dinners/month + 12% morning energy.", 
      action: "Write Script", 
      color: C.blue, 
      prompt: "Write a short professional script Chris Green can use to set boundaries on late-night calls and reschedule them to 2pm. Make it confident and friendly." 
    },
    { 
      icon: "💰", 
      text: "Takeout ($180/mo) = 18% fewer family dinners + 9% client retention dip. 4-week home feast saves $2k/year.", 
      action: "Build Plan", 
      color: C.orange, 
      prompt: "Create a practical 4-week home cooking challenge plan for a busy business owner and family. Include meal ideas and time-saving tips. Keep it fun and achievable." 
    },
    { 
      icon: "🎸", 
      text: "Guitar + community engagement = Music & Plumbing Night workshop. Projected $1,200 revenue, zero calendar conflict.", 
      action: "Plan It", 
      color: C.purple, 
      prompt: "Create a 1-page plan for a 'Music & Plumbing Night' community workshop event. Include timeline, pricing, marketing angle, and venue suggestions for Atlanta." 
    },
    { 
      icon: "📈", 
      text: "Your 9pm calls have 23% lower close rate than 2pm calls. Data from last 30 days of CRM activity.", 
      action: "View Report", 
      color: C.teal, 
      prompt: "Generate a brief AI analysis report on why afternoon calls (2pm) outperform evening calls (9pm) for a plumbing business owner. Include psychology, energy, and buyer behavior." 
    },
  ];

  async function runPulse() {
    setAiLoading(true);
    setAiResult("");
    try {
      const result = await invokeLLM({
        prompt: `You are AgentZero running a weekly life pulse check for Chris Green: business owner, plumber, father, community leader in Atlanta. Harmony score: 92. Active threads: Business (3 leads, revenue up), Family (soccer, dinner), Creative (guitar), Joy. Summarize this week's performance, surface 3 key patterns, and give 2 actionable priorities for next week. Be data-driven and personal.`
      });
      setAiResult(result);
    } catch (error) {
      console.error("Pulse check failed:", error);
      setAiResult("⚠️ Pulse check failed. Please try again later.");
    }
    setAiLoading(false);
  }

  async function runAction(ins) {
    setActionLoading(l => ({ ...l, [ins.action]: true }));
    setActionResults(r => ({ ...r, [ins.action]: "" }));
    try {
      const result = await invokeLLM({ prompt: ins.prompt });
      setActionResults(r => ({ ...r, [ins.action]: result }));
    } catch (error) {
      console.error(`Action "${ins.action}" failed:`, error);
      setActionResults(r => ({ ...r, [ins.action]: "⚠️ Failed to generate. Please try again." }));
    }
    setActionLoading(l => ({ ...l, [ins.action]: false }));
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 24 }}>
        {[
          { label: "Harmony Score", val: "92", color: C.teal }, 
          { label: "Energy Level", val: "87%", color: C.blue }, 
          { label: "Business Pulse", val: "↑14%", color: C.orange }, 
          { label: "Family Time", val: "18h/wk", color: C.purple }
        ].map(s => (
          <div key={s.label} style={{ ...card, padding: 16, textAlign: "center" }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: s.color, textShadow: `0 0 14px ${s.color}99` }}>{s.val}</div>
            <div style={{ fontSize: 11, color: "#a9a9a9", marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#ffffff", marginBottom: 14 }}>AI Correlations & Weekly Insights</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {insights.map((ins, i) => (
          <div key={i} style={{ ...card, padding: 16, display: "flex", gap: 14, alignItems: "flex-start", flexDirection: "column" }}>
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start", width: "100%" }}>
              <div style={{ 
                width: 36, 
                height: 36, 
                borderRadius: 10, 
                background: ins.color + "22", 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center", 
                fontSize: 16, 
                color: ins.color, 
                flexShrink: 0 
              }}>
                {ins.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: "#a9a9a9", lineHeight: 1.55, marginBottom: 10 }}>{ins.text}</div>
                <button 
                  onClick={() => runAction(ins)} 
                  disabled={actionLoading[ins.action]}
                  style={{ 
                    padding: "5px 14px", 
                    borderRadius: 20, 
                    background: ins.color + "22", 
                    border: "0.5px solid " + ins.color + "44", 
                    color: ins.color, 
                    fontSize: 11, 
                    fontWeight: 600, 
                    cursor: actionLoading[ins.action] ? "wait" : "pointer",
                    opacity: actionLoading[ins.action] ? 0.6 : 1
                  }}
                >
                  {actionLoading[ins.action] ? "◈ Working..." : ins.action + " ↗"}
                </button>
              </div>
            </div>
            {(actionResults[ins.action] || actionLoading[ins.action]) && (
              <div style={{ 
                width: "100%", 
                padding: "12px 14px", 
                borderRadius: 10, 
                background: "rgba(74,179,244,0.05)", 
                border: "0.5px solid rgba(74,179,244,0.15)", 
                fontSize: 13, 
                color: "#a9a9a9", 
                lineHeight: 1.6 
              }}>
                {actionLoading[ins.action] ? 
                  <span style={{ color: ins.color }}><Icon name="◈" size={12} style={{marginRight:6,verticalAlign:"middle"}} />Generating...</span> : 
                  actionResults[ins.action]
                }
              </div>
            )}
          </div>
        ))}
      </div>
      <button 
        onClick={runPulse} 
        disabled={aiLoading}
        style={{ 
          width: "100%", 
          padding: 12, 
          borderRadius: 10, 
          background: "rgba(74,179,244,0.08)", 
          border: "0.5px solid rgba(74,179,244,0.2)", 
          color: C.blue, 
          fontSize: 12, 
          fontWeight: 600, 
          cursor: aiLoading ? "wait" : "pointer",
          opacity: aiLoading ? 0.6 : 1,
          marginTop: 16 
        }}
      >
        {aiLoading ? "◈ Running Pulse..." : "↻ Run Weekly Pulse ↗"}
      </button>
      <AIOutput result={aiResult} loading={aiLoading} />
    </div>
  );
}

// ─── GENERIC PLACEHOLDER ─────────────────────────────────────────────────────
export function PlaceholderPanel({ title, icon }) {
  return (
    <div style={{ 
      padding: 24, 
      display: "flex", 
      flexDirection: "column", 
      alignItems: "center", 
      justifyContent: "center", 
      minHeight: 400, 
      color: "#555555" 
    }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>{icon}</div>
      <div style={{ fontSize: 18, fontWeight: 600, color: "#a9a9a9", marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 13, color: "#a9a9a9" }}>Coming soon — this module is under construction by AgentZero.</div>
    </div>
  );
}