import { useState, useEffect, useRef } from "react";
import { invokeLLM } from "@/api/ceogpsclient.jsx";
import { kvGet, kvSet } from "@/utils/storage";
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

const SOURCE_CONFIG = {
  stripe:   { icon: "💳", label: "Stripe",  color: "#635bff" },
  github:   { icon: "📂", label: "GitHub",  color: "#ffffff" },
  gmail:    { icon: "📬", label: "Gmail",   color: "#ea4335" },
  calendar: { icon: "🗓", label: "Calendar",color: "#4285f4" },
  slack:    { icon: "💬", label: "Slack",   color: "#4a154b" },
  crm:      { icon: "👥", label: "CRM",     color: C.orange  },
  system:   { icon: "⚡", label: "System",  color: C.teal    },
  agent:    { icon: "🤖", label: "Agent",   color: C.purple  },
};

const KV_EVENTS = "activity_events";
const KV_DISMISSED = "activity_dismissed";
const WORKER = "https://lifeos1.ceogps.workers.dev";

const FILTERS = ["all", "stripe", "github", "gmail", "crm", "agent", "system", "calendar", "slack"];

export default function ActivityFeedPanel() {
  const [events, setEvents] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState("all");
  const [connected, setConnected] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState("");
  const feedRef = useRef(null);
  // Dismissed ids persist separately so a live source can't resurrect them.
  const dismissedRef = useRef(new Set());

  // Load persisted events + dismissed set, then merge real signals (best-effort).
  useEffect(() => {
    let cancelled = false;
    Promise.all([kvGet(KV_EVENTS), kvGet(KV_DISMISSED)]).then(async ([saved, dismissed]) => {
      if (cancelled) return;
      dismissedRef.current = new Set(Array.isArray(dismissed) ? dismissed : []);
      const base = (Array.isArray(saved) ? saved : []).filter(e => !dismissedRef.current.has(e.id));
      // Real source: scheduled social posts from the Worker queue.
      let live = [];
      try {
        const queue = await fetch(`${WORKER}/api/social/queue`).then(r => r.json()).catch(() => null);
        if (Array.isArray(queue)) {
          live = queue.map(j => ({
            id: "social_" + j.id,
            source: "system", type: "social",
            title: "Scheduled social post",
            body: `${(j.platforms || []).join(", ")} · ${(j.text || "").slice(0, 60)}`,
            time: j.when ? new Date(j.when).toLocaleString() : "scheduled",
            read: false,
          }));
        }
      } catch { /* offline — show persisted only */ }
      const seen = new Set(base.map(e => e.id));
      const merged = [...base, ...live.filter(e => !seen.has(e.id) && !dismissedRef.current.has(e.id))];
      setEvents(merged);
      setConnected(true);
      setLoaded(true);
    });
    return () => { cancelled = true; };
  }, []);

  // Persist whenever the list changes (after initial load).
  useEffect(() => { if (loaded) kvSet(KV_EVENTS, events); }, [events, loaded]);

  function markAllRead() {
    setEvents(e => e.map(ev => ({ ...ev, read: true })));
  }

  function dismissEvent(id) {
    dismissedRef.current.add(id);
    kvSet(KV_DISMISSED, [...dismissedRef.current]);
    setEvents(e => e.filter(ev => ev.id !== id));
  }

  function markRead(id) {
    setEvents(e => e.map(ev => ev.id === id ? { ...ev, read: true } : ev));
  }

  async function runAISummary() {
    setAiLoading(true);
    setAiResult("");
    const recent = events.slice(0, 10).map(e => `[${e.source}] ${e.title}: ${e.body}`).join("\n");
    const result = await invokeLLM({
      prompt: `You are AgentZero analyzing the real-time activity feed for Chris Green (plumbing business owner, Atlanta).
Recent events:
${recent}

Give a 3-sentence executive summary: what's happening across his business right now, what needs immediate attention, and one action he should take in the next 10 minutes. Be direct and specific.`
    });
    setAiResult(result);
    setAiLoading(false);
  }

  const filtered = filter === "all" ? events : events.filter(e => e.source === filter);
  const unreadCount = events.filter(e => !e.read).length;

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16, height: "calc(100vh - 52px)", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#ffffff", display: "flex", alignItems: "center", gap: 10 }}>
            Real-Time Activity Feed
            {unreadCount > 0 && (
              <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: "rgba(74,179,244,0.15)", border: "0.5px solid rgba(74,179,244,0.3)", color: C.blue, fontWeight: 700 }}>
                {unreadCount} new
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: "#a9a9a9", marginTop: 2, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: connected ? C.teal : C.orange, display: "inline-block", flexShrink: 0 }} />
            {connected ? "Synced · changes saved to your account" : "Loading…"}
          </div>
        </div>
        <button onClick={markAllRead}
          style={{ padding: "7px 14px", borderRadius: 20, background: "rgba(74,179,244,0.08)", border: "0.5px solid rgba(74,179,244,0.2)", color: C.blue, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
          Mark all read
        </button>
        <button onClick={runAISummary} disabled={aiLoading}
          style={{ padding: "7px 14px", borderRadius: 20, background: "rgba(139,127,255,0.12)", border: "0.5px solid rgba(139,127,255,0.3)", color: C.purple, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
          {aiLoading ? "◈..." : "✦ AI Summary"}
        </button>
      </div>

      {/* AI Summary */}
      {(aiResult || aiLoading) && (
        <div style={{ ...card, padding: 14, flexShrink: 0, background: "rgba(139,127,255,0.06)", border: "0.5px solid rgba(139,127,255,0.2)" }}>
          <div style={{ fontSize: 10, color: C.purple, fontWeight: 700, marginBottom: 6, letterSpacing: ".05em" }}><Icon name="◈" size={12} style={{marginRight:6,verticalAlign:"middle"}} />AGENT ZERO — ACTIVITY ANALYSIS</div>
          <div style={{ fontSize: 13, color: "#a9a9a9", lineHeight: 1.6 }}>
            {aiLoading ? <span style={{ color: C.purple }}><Icon name="◈" size={12} style={{marginRight:6,verticalAlign:"middle"}} />Analyzing your feed...</span> : aiResult}
          </div>
        </div>
      )}

      {/* Source filter pills */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", flexShrink: 0 }}>
        {FILTERS.map(f => {
          const cfg = SOURCE_CONFIG[f];
          const isActive = filter === f;
          return (
            <button key={f} onClick={() => setFilter(f)}
              style={{
                padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: "pointer",
                border: "0.5px solid",
                background: isActive ? (cfg ? cfg.color + "22" : "rgba(74,179,244,0.15)") : "transparent",
                borderColor: isActive ? (cfg ? cfg.color : C.blue) : "rgba(255,255,255,0.1)", boxShadow: isActive ? `0 0 10px ${cfg ? cfg.color : C.blue}66` : "none",
                color: isActive ? (cfg ? cfg.color : C.blue) : "#a9a9a9",
              }}>
              {cfg ? `${cfg.icon} ${cfg.label}` : "All"}
            </button>
          );
        })}
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, flexShrink: 0 }}>
        {[
          { label: "Payments", val: events.filter(e => e.source === "stripe").length, color: "#635bff", icon: "💳" },
          { label: "Commits",  val: events.filter(e => e.source === "github").length, color: "#ffffff", icon: "📂" },
          { label: "Emails",   val: events.filter(e => e.source === "gmail").length,  color: "#ea4335", icon: "📬" },
          { label: "Leads",    val: events.filter(e => e.source === "crm").length,    color: C.orange,  icon: "👥" },
        ].map(s => (
          <div key={s.label} style={{ ...card, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 18 }}>{s.icon}</span>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: s.color, textShadow: `0 0 12px ${s.color}99` }}>{s.val}</div>
              <div style={{ fontSize: 10, color: "#a9a9a9" }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Feed */}
      <div ref={feedRef} style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
        {filtered.length === 0 && (
          <div style={{ textAlign: "center", color: "#555555", padding: 40, fontSize: 13 }}>No events for this filter.</div>
        )}
        {filtered.map(ev => {
          const cfg = SOURCE_CONFIG[ev.source] || SOURCE_CONFIG.system;
          return (
            <div key={ev.id} onClick={() => markRead(ev.id)}
              style={{
                ...card,
                padding: "12px 14px",
                display: "flex",
                gap: 12,
                alignItems: "flex-start",
                cursor: "pointer",
                opacity: ev.read ? 0.75 : 1,
                borderLeft: ev.read ? "0.5px solid rgba(255,255,255,0.1)" : `2px solid ${cfg.color}`,
                transition: "all .15s",
              }}>
              {/* Icon */}
              <div style={{ width: 34, height: 34, borderRadius: 8, background: cfg.color + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
                {cfg.icon}
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                  <span style={{ fontSize: 12, fontWeight: ev.read ? 500 : 700, color: "#ffffff" }}>{ev.title}</span>
                  {!ev.read && <span style={{ width: 6, height: 6, borderRadius: "50%", background: cfg.color, flexShrink: 0 }} />}
                  <span style={{ fontSize: 9, padding: "1px 7px", borderRadius: 20, background: cfg.color + "18", color: cfg.color, fontWeight: 600, marginLeft: "auto", flexShrink: 0 }}>{cfg.label}</span>
                </div>
                <div style={{ fontSize: 11, color: "#a9a9a9", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.body}</div>
              </div>

              {/* Time + dismiss */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
                <span style={{ fontSize: 10, color: "#555555", whiteSpace: "nowrap" }}>{ev.time}</span>
                <button onClick={e => { e.stopPropagation(); dismissEvent(ev.id); }}
                  style={{ fontSize: 10, color: "#ff4f5e33", background: "none", border: "none", cursor: "pointer", padding: 0, lineHeight: 1 }}
                  onMouseEnter={e => e.target.style.color = "#ff4f5e"}
                  onMouseLeave={e => e.target.style.color = "#ff4f5e33"}><Icon name="✕" size={14} /></button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}