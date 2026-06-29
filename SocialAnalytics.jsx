import { useState } from "react";
import { calculateKPIStatus, getKPIColor } from "@/lib/kpiService";

const C = { blue: "#4ab3f4", teal: "#00c896", orange: "#ff8c42", pink: "#ff6b9d" };

export default function SocialAnalytics({ kpis, onUpdateKPI }) {
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState("");

  const followers = kpis.find(k => k.id === "followers")?.value || 0;
  const engagement = kpis.find(k => k.id === "engagement")?.value || 0;
  const reach = kpis.find(k => k.id === "reach")?.value || 0;
  const posts = kpis.find(k => k.id === "posts")?.value || 0;

  const summary = [
    { label: "Total Followers", value: followers.toLocaleString(), color: C.pink },
    { label: "Engagement Rate", value: `${engagement}%`, color: C.blue },
    { label: "Monthly Reach", value: reach.toLocaleString(), color: C.teal },
    { label: "Posts/Month", value: posts, color: C.orange },
  ];

  return (
    <div style={{ padding: 16, overflow: "auto", height: "100%" }}>
      {/* Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 24 }}>
        {summary.map((item, idx) => (
          <div
            key={idx}
            style={{
              padding: 16,
              background: "#1a1b2a",
              borderRadius: 8,
              border: `1px solid ${item.color}30`,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 11, color: "#6aaedd", marginBottom: 8 }}>{item.label}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: item.color }}>
              {item.value}
            </div>
          </div>
        ))}
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
        {kpis.map(kpi => {
          const status = calculateKPIStatus(kpi);
          const color = getKPIColor(status);
          const progress = (kpi.value / kpi.target) * 100;

          return (
            <div
              key={kpi.id}
              style={{
                padding: 16,
                background: "#1a1b2a",
                borderRadius: 8,
                border: `1px solid ${color}30`,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#f0ede8" }}>
                    {kpi.name}
                  </div>
                  <div style={{ fontSize: 10, color: "#6aaedd", marginTop: 2 }}>
                    Target: {kpi.target} {kpi.unit}
                  </div>
                </div>
                <div style={{
                  padding: "4px 8px",
                  borderRadius: 4,
                  background: `${color}20`,
                  border: `1px solid ${color}40`,
                  fontSize: 9,
                  fontWeight: 700,
                  color: color,
                  textTransform: "uppercase",
                }}>
                  {status}
                </div>
              </div>

              <div
                onClick={() => {
                  setEditingId(kpi.id);
                  setEditValue(kpi.value.toString());
                }}
                style={{
                  padding: 12,
                  background: "rgba(255,255,255,0.05)",
                  borderRadius: 6,
                  marginBottom: 12,
                  cursor: "pointer",
                  border: editingId === kpi.id ? `2px solid ${C.blue}` : "1px solid rgba(255,255,255,0.1)",
                }}
              >
                {editingId === kpi.id ? (
                  <input
                    type="number"
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    onBlur={() => {
                      onUpdateKPI(kpi.id, parseFloat(editValue) || 0);
                      setEditingId(null);
                    }}
                    onKeyDown={e => {
                      if (e.key === "Enter") {
                        onUpdateKPI(kpi.id, parseFloat(editValue) || 0);
                        setEditingId(null);
                      }
                    }}
                    autoFocus
                    style={{
                      width: "100%",
                      background: "transparent",
                      border: "none",
                      color: color,
                      fontSize: 20,
                      fontWeight: 700,
                      outline: "none",
                    }}
                  />
                ) : (
                  <div style={{ fontSize: 20, fontWeight: 700, color: color }}>
                    {kpi.value} <span style={{ fontSize: 14 }}>{kpi.unit}</span>
                  </div>
                )}
              </div>

              <div style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: "#6aaedd" }}>Progress</span>
                  <span style={{ fontSize: 10, color: color, fontWeight: 700 }}>
                    {progress.toFixed(0)}%
                  </span>
                </div>
                <div style={{
                  height: 6,
                  background: "rgba(255,255,255,0.1)",
                  borderRadius: 3,
                  overflow: "hidden",
                }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${Math.min(progress, 100)}%`,
                      background: color,
                      transition: "width 0.3s",
                    }}
                  />
                </div>
              </div>

              <div style={{
                padding: 8,
                background: `${kpi.trend > 0 ? "#00c896" : "#ff4f5e"}15`,
                borderRadius: 4,
                fontSize: 11,
                color: kpi.trend > 0 ? "#00c896" : "#ff4f5e",
                fontWeight: 600,
                textAlign: "center",
              }}>
                {kpi.trend > 0 ? "↑" : "↓"} {Math.abs(kpi.trend)}% vs last period
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
