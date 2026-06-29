import { useState } from "react";
import { generateImage } from "@/lib/imageProcessingService";
import Icon from "@/components/lifeos/icons/Icon";

const C = {
  blue: "#4ab3f4", teal: "#00c896", purple: "#8b7fff",
  orange: "#ff8c42", pink: "#ff6b9d", red: "#ff4f5e",
};

const MODES = [
  { id: "realism", name: "Realism", icon: "🏞️", desc: "Realistic landscapes and scenes", color: C.blue },
  { id: "cartoon", name: "Cartoon", icon: "🎨", desc: "Bright cartoon illustrations", color: C.orange },
  { id: "watercolor", name: "Watercolor", icon: "🎭", desc: "Soft watercolor paintings", color: C.pink },
  { id: "abstract", name: "Abstract", icon: "✨", desc: "Dynamic abstract art", color: C.purple },
  { id: "3d", name: "3D", icon: "🎲", desc: "3D rendered style", color: C.teal },
];

export default function ImageGeneratorUI({ onSave, onCancel }) {
  const [mode, setMode] = useState("realism");
  const [prompt, setPrompt] = useState("");
  const [width, setWidth] = useState(800);
  const [height, setHeight] = useState(600);
  const [generating, setGenerating] = useState(false);
  const [preview, setPreview] = useState(null);

  const handleGenerate = async () => {
    setGenerating(true);

    // Simulate generation time
    await new Promise(r => setTimeout(r, 500));

    const canvas = generateImage(width, height, mode, prompt);
    const previewUrl = canvas.toDataURL("image/png");
    setPreview(previewUrl);

    setGenerating(false);
  };

  const handleSaveGenerated = async () => {
    if (!preview) return;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    const img = new Image();

    img.onload = () => {
      ctx.drawImage(img, 0, 0);
      canvas.toBlob(blob => {
        onSave(blob, `generated_${mode}_${Date.now()}.png`);
      });
    };

    img.src = preview;
  };

  return (
    <div style={{ display: "flex", height: "100%", gap: 16, padding: 16, background: "#0a0b12" }}>
      {/* Preview */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {preview ? (
          <div
            style={{
              flex: 1,
              background: "#000",
              borderRadius: 12,
              overflow: "auto",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 12,
            }}
          >
            <img
              src={preview}
              style={{
                maxWidth: "100%",
                maxHeight: "100%",
                objectFit: "contain",
              }}
            />
          </div>
        ) : (
          <div
            style={{
              flex: 1,
              background: "#1a1b2a",
              borderRadius: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 12,
              flexDirection: "column",
              gap: 12,
              color: "#6aaedd",
            }}
          >
            <div style={{ fontSize: 48 }}>🎨</div>
            <div style={{ fontSize: 12, textAlign: "center" }}>
              Configure settings and generate
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={handleGenerate}
            disabled={generating}
            style={{
              flex: 1,
              padding: "10px",
              borderRadius: 10,
              background: generating
                ? "rgba(255,255,255,0.05)"
                : `linear-gradient(135deg, ${C.teal}, ${C.blue})`,
              border: "none",
              color: generating ? "#6aaedd" : "#000",
              fontSize: 12,
              fontWeight: 700,
              cursor: generating ? "not-allowed" : "pointer",
            }}
          >
            {generating ? "⏳ Generating..." : "✨ Generate"}
          </button>
          {preview && (
            <button
              onClick={handleSaveGenerated}
              style={{
                flex: 1,
                padding: "10px",
                borderRadius: 10,
                background: `linear-gradient(135deg, ${C.pink}, ${C.orange})`,
                border: "none",
                color: "#000",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              💾 Save
            </button>
          )}
          <button
            onClick={onCancel}
            style={{
              flex: 1,
              padding: "10px",
              borderRadius: 10,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#6aaedd",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Done
          </button>
        </div>
      </div>

      {/* Controls */}
      <div style={{ width: 280, display: "flex", flexDirection: "column", gap: 12, overflowY: "auto" }}>
        {/* Mode Selector */}
        <div style={{ background: "#1a1b2a", padding: 12, borderRadius: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#f0ede8", marginBottom: 12 }}>
            Choose Style
          </div>

          {MODES.map(m => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              style={{
                width: "100%",
                padding: 12,
                marginBottom: 8,
                borderRadius: 8,
                background:
                  mode === m.id
                    ? `${m.color}20`
                    : "rgba(255,255,255,0.03)",
                border:
                  mode === m.id
                    ? `1px solid ${m.color}50`
                    : "1px solid rgba(255,255,255,0.1)",
                color: mode === m.id ? m.color : "#6aaedd",
                cursor: "pointer",
                textAlign: "left",
                transition: "all 0.2s",
              }}
            >
              <div style={{ fontSize: 20, marginBottom: 4 }}>{m.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 12 }}>{m.name}</div>
              <div style={{ fontSize: 10, opacity: 0.7 }}>{m.desc}</div>
            </button>
          ))}
        </div>

        {/* Prompt */}
        <div style={{ background: "#1a1b2a", padding: 12, borderRadius: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#f0ede8", marginBottom: 8 }}>
            Prompt (Optional)
          </div>
          <textarea
            placeholder="Describe what to generate... (e.g. 'sunset over mountains')"
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            style={{
              width: "100%",
              height: 60,
              padding: 8,
              borderRadius: 6,
              background: "#0a0b12",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#f0ede8",
              fontSize: 11,
              fontFamily: "monospace",
              resize: "none",
            }}
          />
        </div>

        {/* Size */}
        <div style={{ background: "#1a1b2a", padding: 12, borderRadius: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#f0ede8", marginBottom: 8 }}>
            Size
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: "#6aaedd", display: "block", marginBottom: 4 }}>
              Width: {width}px
            </label>
            <input
              type="range"
              min="400"
              max="1600"
              step="100"
              value={width}
              onChange={e => setWidth(parseInt(e.target.value))}
              style={{ width: "100%" }}
            />
          </div>

          <div>
            <label style={{ fontSize: 11, color: "#6aaedd", display: "block", marginBottom: 4 }}>
              Height: {height}px
            </label>
            <input
              type="range"
              min="300"
              max="1200"
              step="100"
              value={height}
              onChange={e => setHeight(parseInt(e.target.value))}
              style={{ width: "100%" }}
            />
          </div>

          {/* Aspect Ratio Presets */}
          <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {[
              { label: "Square", w: 600, h: 600 },
              { label: "16:9", w: 800, h: 450 },
              { label: "4:3", w: 800, h: 600 },
              { label: "9:16", w: 450, h: 800 },
            ].map(preset => (
              <button
                key={preset.label}
                onClick={() => {
                  setWidth(preset.w);
                  setHeight(preset.h);
                }}
                style={{
                  padding: "6px",
                  borderRadius: 6,
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "#6aaedd",
                  cursor: "pointer",
                  fontSize: 10,
                  fontWeight: 600,
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Info */}
        <div style={{ background: "rgba(74,179,244,0.1)", padding: 12, borderRadius: 8, borderLeft: `3px solid ${C.blue}` }}>
          <div style={{ fontSize: 10, color: "#6aaedd", lineHeight: 1.6 }}>
            Each mode generates unique art with different styles. Try different prompts and sizes for varied results.
          </div>
        </div>
      </div>
    </div>
  );
}
