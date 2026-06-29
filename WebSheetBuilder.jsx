import { useState } from "react";
import { createWebSheet, generateGoogleSheetsURL } from "@/lib/kpiService";

const C = {
  blue: "#4ab3f4", teal: "#00c896", purple: "#8b7fff",
  orange: "#ff8c42", pink: "#ff6b9d", red: "#ff4f5e",
};

export default function WebSheetBuilder({ module, existingSheets, onCreateSheet }) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [sheetName, setSheetName] = useState("");
  const [googleSheetsId, setGoogleSheetsId] = useState("");
  const [excelUrl, setExcelUrl] = useState("");
  const [autoSync, setAutoSync] = useState(false);
  const [syncInterval, setSyncInterval] = useState(3600);

  const handleCreate = () => {
    if (!sheetName.trim()) {
      alert("Please enter a sheet name");
      return;
    }

    const newSheet = createWebSheet(sheetName, module, {
      googleSheetsId: googleSheetsId || null,
      excelUrl: excelUrl || null,
      autoSync,
      syncInterval: syncInterval * 1000, // Convert to milliseconds
    });

    onCreateSheet(newSheet);

    // Reset form
    setSheetName("");
    setGoogleSheetsId("");
    setExcelUrl("");
    setAutoSync(false);
    setSyncInterval(3600);
    setShowCreateForm(false);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#f0ede8", marginBottom: 4 }}>
            📑 Web Sheets
          </div>
          <div style={{ fontSize: 11, color: "#6aaedd" }}>
            Create spreadsheets synced with Google Sheets & Excel
          </div>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          style={{
            padding: "8px 16px",
            borderRadius: 6,
            background: `${C.blue}20`,
            border: `1px solid ${C.blue}40`,
            color: C.blue,
            cursor: "pointer",
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          {showCreateForm ? "✕ Cancel" : "+ Create Sheet"}
        </button>
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <div style={{
          padding: 16,
          background: "#1a1b2a",
          borderRadius: 8,
          border: `1px solid ${C.blue}40`,
          marginBottom: 16,
        }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#f0ede8", display: "block", marginBottom: 6 }}>
              Sheet Name
            </label>
            <input
              type="text"
              value={sheetName}
              onChange={e => setSheetName(e.target.value)}
              placeholder="e.g., Monthly Revenue Tracking"
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: 6,
                background: "#0a0b12",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#f0ede8",
                fontSize: 11,
                outline: "none",
              }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            {/* Google Sheets */}
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#f0ede8", display: "block", marginBottom: 6 }}>
                Google Sheets ID (optional)
              </label>
              <input
                type="text"
                value={googleSheetsId}
                onChange={e => setGoogleSheetsId(e.target.value)}
                placeholder="Paste your sheet ID"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: 6,
                  background: "#0a0b12",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "#f0ede8",
                  fontSize: 11,
                  outline: "none",
                }}
              />
              <div style={{ fontSize: 9, color: "#6aaedd", marginTop: 4 }}>
                Found in docs.google.com/spreadsheets/d/<strong>ID</strong>/edit
              </div>
            </div>

            {/* Excel */}
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#f0ede8", display: "block", marginBottom: 6 }}>
                Excel Cloud URL (optional)
              </label>
              <input
                type="text"
                value={excelUrl}
                onChange={e => setExcelUrl(e.target.value)}
                placeholder="OneDrive/SharePoint URL"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: 6,
                  background: "#0a0b12",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "#f0ede8",
                  fontSize: 11,
                  outline: "none",
                }}
              />
            </div>
          </div>

          {/* Auto Sync */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={autoSync}
                onChange={e => setAutoSync(e.target.checked)}
                style={{ cursor: "pointer" }}
              />
              <span style={{ fontSize: 11, color: "#f0ede8", fontWeight: 700 }}>
                Auto-sync with cloud
              </span>
            </label>
            {autoSync && (
              <div style={{ marginTop: 8 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#f0ede8", display: "block", marginBottom: 6 }}>
                  Sync Interval (seconds)
                </label>
                <input
                  type="number"
                  min="60"
                  max="86400"
                  value={syncInterval}
                  onChange={e => setSyncInterval(parseInt(e.target.value))}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 6,
                    background: "#0a0b12",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "#f0ede8",
                    fontSize: 11,
                    outline: "none",
                  }}
                />
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={handleCreate}
              style={{
                flex: 1,
                padding: "10px",
                borderRadius: 6,
                background: `linear-gradient(135deg, ${C.teal}, ${C.blue})`,
                border: "none",
                color: "#000",
                cursor: "pointer",
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              ✅ Create Sheet
            </button>
            <button
              onClick={() => setShowCreateForm(false)}
              style={{
                flex: 1,
                padding: "10px",
                borderRadius: 6,
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#6aaedd",
                cursor: "pointer",
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Existing Sheets */}
      {existingSheets.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
          {existingSheets.map(sheet => (
            <div
              key={sheet.id}
              style={{
                padding: 16,
                background: "#1a1b2a",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, color: "#f0ede8", marginBottom: 8 }}>
                📄 {sheet.name}
              </div>

              <div style={{ fontSize: 10, color: "#6aaedd", marginBottom: 12, lineHeight: 1.6 }}>
                {sheet.googleSheetsId && (
                  <div>
                    <strong>Google Sheets:</strong>{" "}
                    <a
                      href={generateGoogleSheetsURL(sheet.googleSheetsId)}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: C.blue, textDecoration: "underline" }}
                    >
                      Open
                    </a>
                  </div>
                )}
                {sheet.excelUrl && (
                  <div>
                    <strong>Excel:</strong>{" "}
                    <a
                      href={sheet.excelUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: C.blue, textDecoration: "underline" }}
                    >
                      Open
                    </a>
                  </div>
                )}
                {sheet.autoSync && (
                  <div>
                    <strong>Auto-sync:</strong> Every {Math.round(sheet.syncInterval / 1000)}s
                  </div>
                )}
              </div>

              <div style={{
                padding: 8,
                background: "rgba(255,255,255,0.05)",
                borderRadius: 4,
                fontSize: 9,
                color: "#6aaedd",
              }}>
                Created: {new Date(sheet.createdAt).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{
          padding: 24,
          background: "rgba(255,255,255,0.02)",
          borderRadius: 8,
          border: "1px dashed rgba(255,255,255,0.1)",
          textAlign: "center",
        }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>📑</div>
          <div style={{ fontSize: 12, color: "#6aaedd", marginBottom: 4 }}>
            No web sheets yet
          </div>
          <div style={{ fontSize: 10, color: "#6aaedd" }}>
            Create your first sheet to integrate Google Sheets or Excel with your KPIs
          </div>
        </div>
      )}

      {/* Integration Guide */}
      <div style={{
        marginTop: 24,
        padding: 16,
        background: "rgba(74,179,244,0.1)",
        borderRadius: 8,
        border: `1px solid ${C.blue}40`,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.blue, marginBottom: 8 }}>
          💡 How to Integrate
        </div>
        <div style={{ fontSize: 10, color: "#6aaedd", lineHeight: 1.8 }}>
          <div>1. <strong>Google Sheets:</strong> Go to File → Share → Get link → Copy ID from URL</div>
          <div>2. <strong>Excel:</strong> Upload to OneDrive/SharePoint and paste the shareable link</div>
          <div>3. Enable <strong>Auto-sync</strong> to keep your KPIs updated automatically</div>
          <div>4. Data syncs with other LifeOS1 panels (Social, Health, CEO GPS)</div>
        </div>
      </div>
    </div>
  );
}
