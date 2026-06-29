import { useState, useRef, useEffect } from "react";
import { ImageProcessor } from "@/lib/imageProcessingService";
import Icon from "@/components/lifeos/icons/Icon";

const C = {
  blue: "#4ab3f4", teal: "#00c896", purple: "#8b7fff",
  orange: "#ff8c42", pink: "#ff6b9d", red: "#ff4f5e",
};

export default function ImageEditorUI({ sourceImage, onSave, onCancel }) {
  const [processor, setProcessor] = useState(null);
  const [tool, setTool] = useState("filters");
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(0);
  const [saturation, setSaturation] = useState(0);
  const [blur, setBlur] = useState(0);
  const [textOverlay, setTextOverlay] = useState("");
  const [textSize, setTextSize] = useState(24);
  const [textColor, setTextColor] = useState("#FFFFFF");
  const canvasRef = useRef(null);

  useEffect(() => {
    const proc = new ImageProcessor();
    proc.loadImage(sourceImage).then(() => {
      setProcessor(proc);
      drawCanvas(proc);
    });
  }, [sourceImage]);

  const drawCanvas = proc => {
    if (!canvasRef.current || !proc) return;
    const destCtx = canvasRef.current.getContext("2d");
    destCtx.drawImage(proc.canvas, 0, 0);
  };

  const handleFilter = (filterName, value) => {
    if (!processor) return;

    switch (filterName) {
      case "brightness":
        setBrightness(value);
        processor.applyBrightness(value);
        break;
      case "contrast":
        setContrast(value);
        processor.applyContrast(value);
        break;
      case "saturation":
        setSaturation(value);
        processor.applySaturation(value);
        break;
      case "blur":
        setBlur(value);
        processor.applyBlur(value);
        break;
    }

    drawCanvas(processor);
  };

  const handleEffect = effectName => {
    if (!processor) return;

    switch (effectName) {
      case "grayscale":
        processor.applyGrayscale();
        break;
      case "sepia":
        processor.applySepia();
        break;
      case "invert":
        processor.applyInvert();
        break;
    }

    drawCanvas(processor);
  };

  const handleTransform = (transform, ...args) => {
    if (!processor) return;

    switch (transform) {
      case "rotate":
        processor.rotate(args[0]);
        break;
      case "flipH":
        processor.flipH();
        break;
      case "resize":
        processor.resize(args[0], args[1]);
        break;
    }

    drawCanvas(processor);
  };

  const handleAddText = () => {
    if (!processor || !textOverlay) return;
    processor.drawText(
      textOverlay,
      processor.canvas.width / 2,
      processor.canvas.height / 2,
      textSize,
      textColor
    );
    drawCanvas(processor);
    setTextOverlay("");
  };

  const handleSave = async () => {
    if (!processor) return;
    const blob = await processor.getBlob("image/png");
    onSave(blob, `edited_image_${Date.now()}.png`);
  };

  const handleUndo = () => {
    if (!processor) return;
    processor.undo();
    drawCanvas(processor);
  };

  const handleRedo = () => {
    if (!processor) return;
    processor.redo();
    drawCanvas(processor);
  };

  return (
    <div style={{ display: "flex", height: "100%", gap: 16, padding: 16, background: "#0a0b12" }}>
      {/* Canvas */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
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
          {processor && (
            <canvas
              ref={canvasRef}
              style={{
                maxWidth: "100%",
                maxHeight: "100%",
                objectFit: "contain",
              }}
            />
          )}
        </div>

        {/* Undo/Redo */}
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <button
            onClick={handleUndo}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              background: `${C.teal}20`,
              border: `1px solid ${C.teal}50`,
              color: C.teal,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            ↶ Undo
          </button>
          <button
            onClick={handleRedo}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              background: `${C.teal}20`,
              border: `1px solid ${C.teal}50`,
              color: C.teal,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            ↷ Redo
          </button>
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={handleSave}
            style={{
              flex: 1,
              padding: "10px",
              borderRadius: 10,
              background: `linear-gradient(135deg, ${C.teal}, ${C.blue})`,
              border: "none",
              color: "#000",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            💾 Save
          </button>
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
            Cancel
          </button>
        </div>
      </div>

      {/* Tools Panel */}
      <div style={{ width: 280, display: "flex", flexDirection: "column", gap: 12, overflowY: "auto" }}>
        {/* Tool Selector */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {["filters", "effects", "transform", "text"].map(t => (
            <button
              key={t}
              onClick={() => setTool(t)}
              style={{
                padding: "6px 12px",
                borderRadius: 6,
                background: tool === t ? `${C.blue}40` : "rgba(255,255,255,0.05)",
                border: `1px solid ${tool === t ? C.blue : "rgba(255,255,255,0.1)"}`,
                color: tool === t ? C.blue : "#6aaedd",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: 11,
              }}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* Filters */}
        {tool === "filters" && (
          <div style={{ background: "#1a1b2a", padding: 12, borderRadius: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.blue, marginBottom: 12 }}>
              Filters
            </div>

            {[
              { name: "Brightness", key: "brightness", value: brightness },
              { name: "Contrast", key: "contrast", value: contrast },
              { name: "Saturation", key: "saturation", value: saturation },
              { name: "Blur", key: "blur", value: blur },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, color: "#6aaedd", display: "block", marginBottom: 4 }}>
                  {f.name}: {f.value}
                </label>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={f.value}
                  onChange={e => handleFilter(f.key, parseInt(e.target.value))}
                  style={{ width: "100%" }}
                />
              </div>
            ))}
          </div>
        )}

        {/* Effects */}
        {tool === "effects" && (
          <div style={{ background: "#1a1b2a", padding: 12, borderRadius: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.purple, marginBottom: 12 }}>
              Effects
            </div>

            {[
              { name: "Grayscale", key: "grayscale" },
              { name: "Sepia", key: "sepia" },
              { name: "Invert", key: "invert" },
            ].map(e => (
              <button
                key={e.key}
                onClick={() => handleEffect(e.key)}
                style={{
                  width: "100%",
                  padding: "8px",
                  marginBottom: 8,
                  borderRadius: 6,
                  background: `${C.purple}20`,
                  border: `1px solid ${C.purple}40`,
                  color: C.purple,
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: 11,
                }}
              >
                {e.name}
              </button>
            ))}
          </div>
        )}

        {/* Transform */}
        {tool === "transform" && (
          <div style={{ background: "#1a1b2a", padding: 12, borderRadius: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.orange, marginBottom: 12 }}>
              Transform
            </div>

            {[
              { name: "Rotate 90°", action: () => handleTransform("rotate", 90) },
              { name: "Flip H", action: () => handleTransform("flipH") },
              { name: "Rotate -90°", action: () => handleTransform("rotate", -90) },
            ].map(t => (
              <button
                key={t.name}
                onClick={t.action}
                style={{
                  width: "100%",
                  padding: "8px",
                  marginBottom: 8,
                  borderRadius: 6,
                  background: `${C.orange}20`,
                  border: `1px solid ${C.orange}40`,
                  color: C.orange,
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: 11,
                }}
              >
                {t.name}
              </button>
            ))}
          </div>
        )}

        {/* Text */}
        {tool === "text" && (
          <div style={{ background: "#1a1b2a", padding: 12, borderRadius: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.pink, marginBottom: 12 }}>
              Add Text
            </div>

            <input
              type="text"
              placeholder="Text..."
              value={textOverlay}
              onChange={e => setTextOverlay(e.target.value)}
              style={{
                width: "100%",
                padding: "6px 8px",
                marginBottom: 8,
                borderRadius: 6,
                background: "#0a0b12",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#f0ede8",
                fontSize: 11,
              }}
            />

            <label style={{ fontSize: 11, color: "#6aaedd", display: "block", marginBottom: 4 }}>
              Size: {textSize}
            </label>
            <input
              type="range"
              min="12"
              max="100"
              value={textSize}
              onChange={e => setTextSize(parseInt(e.target.value))}
              style={{ width: "100%", marginBottom: 8 }}
            />

            <label style={{ fontSize: 11, color: "#6aaedd", display: "block", marginBottom: 4 }}>
              Color
            </label>
            <input
              type="color"
              value={textColor}
              onChange={e => setTextColor(e.target.value)}
              style={{ width: "100%", height: 32, marginBottom: 8, cursor: "pointer" }}
            />

            <button
              onClick={handleAddText}
              style={{
                width: "100%",
                padding: "8px",
                borderRadius: 6,
                background: `${C.pink}20`,
                border: `1px solid ${C.pink}40`,
                color: C.pink,
                cursor: "pointer",
                fontWeight: 600,
                fontSize: 11,
              }}
            >
              Add Text
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
