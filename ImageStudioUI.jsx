import { useState } from "react";
import ImageEditorUI from "./ImageEditorUI";
import ImageGeneratorUI from "./ImageGeneratorUI";

const C = {
  blue: "#4ab3f4", teal: "#00c896", purple: "#8b7fff",
  orange: "#ff8c42", pink: "#ff6b9d", red: "#ff4f5e",
};

export default function ImageStudioUI({ mediaLibrary, onSaveImage, onClose }) {
  const [mode, setMode] = useState("home"); // home | editor | generator
  const [editingImage, setEditingImage] = useState(null);

  const handleStartEdit = imageUrl => {
    setEditingImage(imageUrl);
    setMode("editor");
  };

  const handleEditorSave = (blob, fileName) => {
    onSaveImage(blob, fileName, "Edited Images");
    setMode("home");
    setEditingImage(null);
  };

  const handleGeneratorSave = (blob, fileName) => {
    onSaveImage(blob, fileName, "Generated Images");
    setMode("home");
  };

  if (mode === "editor" && editingImage) {
    return (
      <ImageEditorUI
        sourceImage={editingImage}
        onSave={handleEditorSave}
        onCancel={() => {
          setMode("home");
          setEditingImage(null);
        }}
      />
    );
  }

  if (mode === "generator") {
    return (
      <ImageGeneratorUI
        onSave={handleGeneratorSave}
        onCancel={() => setMode("home")}
      />
    );
  }

  return (
    <div style={{ padding: 24, background: "#0a0b12", borderRadius: 12 }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: "#f0ede8", marginBottom: 20 }}>
        🎨 Image Studio
      </div>

      {/* Mode Selector */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        <button
          onClick={() => setMode("editor")}
          style={{
            padding: 24,
            borderRadius: 12,
            background: "linear-gradient(135deg, rgba(74,179,244,0.1), rgba(74,179,244,0.05))",
            border: `2px solid ${C.blue}40`,
            cursor: "pointer",
            transition: "all 0.2s",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 12 }}>✏️</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.blue, marginBottom: 6 }}>
            Image Editor
          </div>
          <div style={{ fontSize: 12, color: "#6aaedd" }}>
            Filters, effects, transformations
          </div>
        </button>

        <button
          onClick={() => setMode("generator")}
          style={{
            padding: 24,
            borderRadius: 12,
            background: "linear-gradient(135deg, rgba(255,107,157,0.1), rgba(255,107,157,0.05))",
            border: `2px solid ${C.pink}40`,
            cursor: "pointer",
            transition: "all 0.2s",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 12 }}>🎨</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.pink, marginBottom: 6 }}>
            Image Generator
          </div>
          <div style={{ fontSize: 12, color: "#6aaedd" }}>
            5 artistic modes + prompts
          </div>
        </button>
      </div>

      {/* Library Preview */}
      {mediaLibrary.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#f0ede8", marginBottom: 12 }}>
            📸 Your Images
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))",
              gap: 8,
            }}
          >
            {mediaLibrary.map((img, idx) => (
              <div
                key={idx}
                onClick={() => handleStartEdit(img.url || img.data)}
                style={{
                  width: 100,
                  height: 100,
                  borderRadius: 8,
                  background: `url(${img.url || img.data}) center/cover`,
                  cursor: "pointer",
                  border: `1px solid ${C.blue}40`,
                  transition: "all 0.2s",
                  position: "relative",
                }}
                title={`Click to edit: ${img.name}`}
              >
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "rgba(0,0,0,0.5)",
                    opacity: 0,
                    transition: "opacity 0.2s",
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.opacity = "1";
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.opacity = "0";
                  }}
                >
                  <span style={{ color: "#fff", fontSize: 20 }}>✏️</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Features */}
      <div style={{ marginTop: 32, padding: 16, background: "#1a1b2a", borderRadius: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#f0ede8", marginBottom: 12 }}>
          ✨ Features
        </div>
        <div style={{ fontSize: 11, color: "#6aaedd", lineHeight: 1.8 }}>
          <div>• <strong>Editor:</strong> Brightness, contrast, saturation, blur, grayscale, sepia, invert, rotate, flip, text overlay</div>
          <div>• <strong>Generator:</strong> 5 modes (Realism, Cartoon, Watercolor, Abstract, 3D) with custom prompts</div>
          <div>• <strong>Auto-save:</strong> Images save to "Edited Images" or "Generated Images" albums</div>
          <div>• <strong>History:</strong> Undo/redo in editor</div>
        </div>
      </div>
    </div>
  );
}
