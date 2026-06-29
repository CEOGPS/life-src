import { useState, useEffect } from "react";
import {
  KPI_MODULES,
  DEFAULT_KPIS,
  calculateKPIStatus,
  getKPIColor,
  generateKPIRecommendations,
  generateExcelExport,
  downloadExcelCSV,
  syncKPIToPanel,
  trackKPIHistory,
} from "@/lib/kpiService";
import FinancialAnalytics from "./KPIModules/FinancialAnalytics";
import SocialAnalytics from "./KPIModules/SocialAnalytics";
import WebsiteAnalytics from "./KPIModules/WebsiteAnalytics";
import HealthAnalytics from "./KPIModules/HealthAnalytics";
import WebSheetBuilder from "./KPIModules/WebSheetBuilder";

const C = {
  blue: "#4ab3f4", teal: "#00c896", purple: "#8b7fff",
  orange: "#ff8c42", pink: "#ff6b9d", red: "#ff4f5e",
};

export default function KPIPanelUI() {
  const [module, setModule] = useState("financial");
  const [view, setView] = useState("dashboard"); // dashboard | websheets | history
  const [kpis, setKpis] = useState(() => {
    try {
      const stored = localStorage.getItem("lifeos_kpis");
      return stored ? JSON.parse(stored) : DEFAULT_KPIS;
    } catch {
      return DEFAULT_KPIS;
    }
  });
  const [webSheets, setWebSheets] = useState(() => {
    try {
      const stored = localStorage.getItem("lifeos_websheets");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [recommendations, setRecommendations] = useState([]);
  const [selectedKPI, setSelectedKPI] = useState(null);
  const [editingKPI, setEditingKPI] = useState(null);

  // Persist KPIs
  useEffect(() => {
    try {
      localStorage.setItem("lifeos_kpis", JSON.stringify(kpis));
    } catch (e) {
      console.warn("Failed to save KPIs:", e);
    }
  }, [kpis]);

  // Persist web sheets
  useEffect(() => {
    try {
      localStorage.setItem("lifeos_websheets", JSON.stringify(webSheets));
    } catch (e) {
      console.warn("Failed to save web sheets:", e);
    }
  }, [webSheets]);

  // Generate recommendations
  useEffect(() => {
    const currentKPIs = kpis[module] || [];
    setRecommendations(generateKPIRecommendations(currentKPIs));
  }, [kpis, module]);

  const handleUpdateKPI = (kpiId, newValue) => {
    setKpis(prev => ({
      ...prev,
      [module]: prev[module].map(kpi => {
        if (kpi.id === kpiId) {
          const oldValue = kpi.value || 0;
          const trend = newValue !== 0 ? Math.round(((newValue - oldValue) / oldValue) * 100) : 0;

          // Track history
          trackKPIHistory(kpiId, newValue);

          return {
            ...kpi,
            value: newValue,
            trend: isNaN(trend) ? 0 : trend,
            lastUpdated: new Date().toISOString(),
          };
        }
        return kpi;
      }),
    }));
    setEditingKPI(null);
  };

  const handleSyncKPI = (kpiId, targetPanel) => {
    const kpiData = kpis[module].find(k => k.id === kpiId);
    if (kpiData && syncKPIToPanel(kpiData, targetPanel)) {
      alert(`✅ KPI synced to ${targetPanel}`);
    }
  };

  const handleExportModule = () => {
    const csv = generateExcelExport(kpis[module], module);
    downloadExcelCSV(csv, `kpi_${module}`);
  };

  const handleAddWebSheet = (sheet) => {
    setWebSheets(prev => [...prev, sheet]);
  };

  const currentModule = KPI_MODULES.find(m => m.id === module);
  const currentKPIs = kpis[module] || [];
  const moduleWebSheets = webSheets.filter(ws => ws.module === module);

  // Render module-specific analytics
  const moduleRenderers = {
    financial: () => <FinancialAnalytics kpis={currentKPIs} onUpdateKPI={handleUpdateKPI} />,
    social: () => <SocialAnalytics kpis={currentKPIs} onUpdateKPI={handleUpdateKPI} />,
    website: () => <WebsiteAnalytics kpis={currentKPIs} onUpdateKPI={handleUpdateKPI} />,
    health: () => <HealthAnalytics kpis={currentKPIs} onUpdateKPI={handleUpdateKPI} />,
  };

  return (
    <div style={{ display: "flex", height: "100%", background: "#0a0b12", overflow: "hidden" }}>
      {/* Sidebar */}
      <div style={{ width: 280, background: "#1a1b2a", borderRight: "1px solid rgba(255,255,255,0.1)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ padding: 16, borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#f0ede8", marginBottom: 4 }}>
            📊 KPI Analytics
          </div>
          <div style={{ fontSize: 10, color: "#6aaedd" }}>
            Track & optimize metrics
          </div>
        </div>

        {/* View Tabs */}
        <div style={{ display: "flex", padding: 8, borderBottom: "1px solid rgba(255,255,255,0.1)", gap: 4 }}>
          {[
            { id: "dashboard", icon: "📈", label: "Dashboard" },
            { id: "websheets", icon: "📑", label: "Web Sheets" },
            { id: "history", icon: "📉", label: "History" },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setView(t.id)}
              title={t.label}
              style={{
                flex: 1,
                padding: "6px",
                borderRadius: 4,
                background: view === t.id ? `${C.blue}30` : "rgba(255,255,255,0.05)",
                border: `1px solid ${view === t.id ? C.blue : "rgba(255,255,255,0.1)"}`,
                color: view === t.id ? C.blue : "#6aaedd",
                cursor: "pointer",
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              {t.icon}
            </button>
          ))}
        </div>

        {/* Module Selector */}
        <div style={{ flex: 1, overflowY: "auto", padding: 8 }}>
          {KPI_MODULES.map(m => (
            <button
              key={m.id}
              onClick={() => {
                setModule(m.id);
                setSelectedKPI(null);
              }}
              style={{
                width: "100%",
                padding: 12,
                marginBottom: 6,
                borderRadius: 6,
                background: module === m.id ? `${m.color}20` : "rgba(255,255,255,0.03)",
                border: `1px solid ${module === m.id ? m.color : "rgba(255,255,255,0.1)"}`,
                color: module === m.id ? m.color : "#6aaedd",
                cursor: "pointer",
                textAlign: "left",
                fontSize: 11,
                fontWeight: 600,
                transition: "all 0.2s",
              }}
            >
              <div style={{ fontSize: 16, marginBottom: 4 }}>{m.icon}</div>
              <div>{m.name}</div>
              <div style={{ fontSize: 9, opacity: 0.7, marginTop: 2 }}>{m.desc}</div>
            </button>
          ))}
        </div>

        {/* Actions */}
        <div style={{ padding: 12, borderTop: "1px solid rgba(255,255,255,0.1)", display: "flex", flexDirection: "column", gap: 6 }}>
          <button
            onClick={handleExportModule}
            style={{
              width: "100%",
              padding: "8px",
              borderRadius: 6,
              background: `${C.orange}20`,
              border: `1px solid ${C.orange}40`,
              color: C.orange,
              cursor: "pointer",
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            📥 Export Excel
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Header */}
        <div style={{
          padding: 16,
          background: "linear-gradient(135deg, rgba(74,179,244,0.1), rgba(0,200,150,0.1))",
          borderBottom: "1px solid rgba(255,255,255,0.1)",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#f0ede8" }}>
                {currentModule?.icon} {currentModule?.name}
              </div>
              <div style={{ fontSize: 11, color: "#6aaedd", marginTop: 4 }}>
                {currentKPIs.length} KPIs tracked · Last updated: {new Date().toLocaleDateString()}
              </div>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div style={{ flex: 1, overflow: "auto" }}>
          {view === "dashboard" && moduleRenderers[module]?.()}

          {view === "websheets" && (
            <div style={{ padding: 16 }}>
              <WebSheetBuilder
                module={module}
                existingSheets={moduleWebSheets}
                onCreateSheet={handleAddWebSheet}
              />
            </div>
          )}

          {view === "history" && (
            <div style={{ padding: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#f0ede8", marginBottom: 16 }}>
                📊 Historical Trends
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 12 }}>
                {currentKPIs.map(kpi => (
                  <div
                    key={kpi.id}
                    style={{
                      padding: 12,
                      background: "#1a1b2a",
                      borderRadius: 8,
                      border: "1px solid rgba(255,255,255,0.1)",
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#f0ede8", marginBottom: 8 }}>
                      {kpi.name}
                    </div>
                    <div style={{ fontSize: 11, color: "#6aaedd" }}>
                      <div>Current: <strong>{kpi.value} {kpi.unit}</strong></div>
                      <div>Target: {kpi.target} {kpi.unit}</div>
                      <div>Trend: <span style={{ color: kpi.trend > 0 ? "#00c896" : "#ff4f5e" }}>
                        {kpi.trend > 0 ? "↑" : "↓"} {Math.abs(kpi.trend)}%
                      </span></div>
                    </div>
                    <div style={{
                      marginTop: 8,
                      height: 4,
                      background: "rgba(255,255,255,0.1)",
                      borderRadius: 2,
                      overflow: "hidden",
                    }}>
                      <div
                        style={{
                          height: "100%",
                          width: `${Math.min((kpi.value / kpi.target) * 100, 100)}%`,
                          background: getKPIColor(calculateKPIStatus(kpi)),
                          transition: "width 0.3s",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Recommendations Footer */}
        {recommendations.length > 0 && (
          <div style={{
            padding: 12,
            background: "rgba(255,140,66,0.1)",
            borderTop: "1px solid rgba(255,140,66,0.3)",
            maxHeight: 150,
            overflow: "auto",
            flexShrink: 0,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.orange, marginBottom: 8 }}>
              ⚠️ Recommendations ({recommendations.length})
            </div>
            {recommendations.map((rec, idx) => (
              <div key={idx} style={{ fontSize: 10, color: "#6aaedd", marginBottom: 4 }}>
                • {rec.message}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
