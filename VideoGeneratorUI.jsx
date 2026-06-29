import { useState, useRef } from "react";
import { generateVideo } from "@/lib/videoGenerationService";
import Icon from "@/components/lifeos/icons/Icon";

const C = {
  blue: "#4ab3f4", teal: "#00c896", purple: "#8b7fff",
  orange: "#ff8c42", pink: "#ff6b9d", red: "#ff4f5e", gold: "#ffd700",
};

export default function VideoGeneratorUI({ mediaLibrary, onSaveVideo }) {
  const [selectedImages, setSelectedImages] = useState([]);
  const [duration, setDuration] = useState(3);
  const [transition, setTransition] = useState("fade");
  const [textOverlay, setTextOverlay] = useState("");
  const [fps, setFps] = useState(24);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(null);
  const [result, setResult] = useState(null);
  const fileInputRef = useRef(null);

  const handleAddImagesFromPC = async e => {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      const data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      setSelectedImages(prev => [...prev, { name: file.name, data, file }]);
    }
  };

  const handleAddFromLibrary = (imageFile) => {
    if (!selectedImages.find(s => s.name === imageFile.name)) {
      setSelectedImages(prev => [...prev, { name: imageFile.name, url: imageFile.url || imageFile.data }]);
    }
  };

  const handleRemoveImage = idx => {
    setSelectedImages(prev => prev.filter((_, i) => i !== idx));
  };

  const handleGenerate = async () => {
    if (selectedImages.length === 0) return alert("Please add at least 1 image");

    setGenerating(true);
    setProgress(null);
    setResult(null);

    try {
      const videoResult = await generateVideo(selectedImages, {
        duration,
        transition,
        fps,
        textOverlay: textOverlay || null,
        title: `Generated Video ${new Date().toLocaleString()}`,
        onProgress: setProgress,
      });

      setResult(videoResult);
      onSaveVideo(videoResult.blob, `video_${Date.now()}.mp4`);
    } catch (err) {
      alert(`Error generating video: ${err.message}`);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div style={{ padding: 24, background: "#0a0b12", borderRadius: 12 }}>
      <div style={{ fontSize: 18, fontWeight: 700, color: "#f0ede8", marginBottom: 20 }}>
        🎬 Video Generator
      </div>

      {/* Image Selector */}
      <div style={{ marginBottom: 24, background: "#1a1b2a", padding: 16, borderRadius: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.blue, marginBottom: 12 }}>
          Select Images for Video
        </div>

        <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              padding: "10px 16px",
              borderRadius: 8,
              background: `${C.teal}20`,
              border: `1px solid ${C.teal}50`,
              color: C.teal,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            📤 Upload from PC
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            onChange={handleAddImagesFromPC}
            style={{ display: "none" }}
          />

          <div style={{ fontSize: 12, color: "#6aaedd", lineHeight: 2.5 }}>
            {selectedImages.length} image{selectedImages.length !== 1 ? "s" : ""} selected
          </div>
        </div>

        {/* Library Images Picker */}
        {mediaLibrary.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: "#6aaedd", marginBottom: 8 }}>
              Or select from your library:
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(60px, 1fr))", gap: 8 }}>
              {mediaLibrary.map(img => (
                <div
                  key={img.name}
                  onClick={() => handleAddFromLibrary(img)}
                  style={{
                    width: 60,
                    height: 60,
                    borderRadius: 8,
                    background: `url(${img.url || img.data}) center/cover`,
                    cursor: "pointer",
                    border: selectedImages.find(s => s.name === img.name)
                      ? `2px solid ${C.blue}`
                      : "1px solid rgba(255,255,255,0.1)",
                    transition: "all 0.15s",
                  }}
                  title={img.name}
                />
              ))}
            </div>
          </div>
        )}

        {/* Selected Images Preview */}
        {selectedImages.length > 0 && (
          <div>
            <div style={{ fontSize: 12, color: "#6aaedd", marginBottom: 8 }}>Preview:</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {selectedImages.map((img, idx) => (
                <div
                  key={idx}
                  style={{
                    position: "relative",
                    width: 80,
                    height: 80,
                    borderRadius: 8,
                    background: `url(${img.url || img.data}) center/cover`,
                    border: `1px solid ${C.blue}`,
                  }}
                >
                  <button
                    onClick={() => handleRemoveImage(idx)}
                    style={{
                      position: "absolute",
                      top: -8,
                      right: -8,
                      width: 24,
                      height: 24,
                      borderRadius: "50%",
                      background: C.red,
                      border: "none",
                      color: "#fff",
                      cursor: "pointer",
                      fontWeight: 700,
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Settings */}
      <div style={{ marginBottom: 24, background: "#1a1b2a", padding: 16, borderRadius: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.purple, marginBottom: 12 }}>
          Video Settings
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <label style={{ fontSize: 12, color: "#6aaedd", display: "block", marginBottom: 6 }}>
              Seconds per image: {duration}s
            </label>
            <input
              type="range"
              min="0.5"
              max="10"
              step="0.5"
              value={duration}
              onChange={e => setDuration(parseFloat(e.target.value))}
              style={{ width: "100%" }}
            />
          </div>

          <div>
            <label style={{ fontSize: 12, color: "#6aaedd", display: "block", marginBottom: 6 }}>
              Transition
            </label>
            <select
              value={transition}
              onChange={e => setTransition(e.target.value)}
              style={{
                width: "100%",
                padding: "6px 10px",
                borderRadius: 6,
                background: "#0a0b12",
                border: `1px solid rgba(255,255,255,0.1)`,
                color: "#f0ede8",
              }}
            >
              <option value="fade">Fade</option>
              <option value="zoom">Zoom</option>
              <option value="slide">Slide</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: 12, color: "#6aaedd", display: "block", marginBottom: 6 }}>
              FPS: {fps}
            </label>
            <input
              type="range"
              min="12"
              max="60"
              step="6"
              value={fps}
              onChange={e => setFps(parseInt(e.target.value))}
              style={{ width: "100%" }}
            />
          </div>

          <div>
            <label style={{ fontSize: 12, color: "#6aaedd", display: "block", marginBottom: 6 }}>
              Text Overlay
            </label>
            <input
              type="text"
              placeholder="Optional text..."
              value={textOverlay}
              onChange={e => setTextOverlay(e.target.value)}
              style={{
                width: "100%",
                padding: "6px 10px",
                borderRadius: 6,
                background: "#0a0b12",
                border: `1px solid rgba(255,255,255,0.1)`,
                color: "#f0ede8",
              }}
            />
          </div>
        </div>
      </div>

      {/* Progress */}
      {progress && (
        <div style={{ marginBottom: 24, background: "#1a1b2a", padding: 16, borderRadius: 12 }}>
          <div style={{ fontSize: 12, color: C.teal, marginBottom: 8 }}>
            {progress.status}
          </div>
          <div
            style={{
              height: 4,
              background: "rgba(255,255,255,0.05)",
              borderRadius: 2,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${progress.percent}%`,
                background: `linear-gradient(90deg, ${C.blue}, ${C.teal})`,
                transition: "width 0.3s",
              }}
            />
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div style={{ marginBottom: 24, background: "#1a1b2a", padding: 16, borderRadius: 12 }}>
          <div style={{ fontSize: 13, color: C.gold, marginBottom: 8 }}>
            ✅ Video generated! ({result.backend})
          </div>
          <div style={{ fontSize: 11, color: "#6aaedd" }}>
            Size: {(result.size / 1024 / 1024).toFixed(1)} MB · Quality: {result.quality}
          </div>
          <button
            onClick={() => {
              setSelectedImages([]);
              setResult(null);
            }}
            style={{
              marginTop: 12,
              padding: "8px 16px",
              borderRadius: 8,
              background: `${C.teal}20`,
              border: `1px solid ${C.teal}50`,
              color: C.teal,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Generate Another
          </button>
        </div>
      )}

      {/* Generate Button */}
      <button
        onClick={handleGenerate}
        disabled={generating || selectedImages.length === 0}
        style={{
          width: "100%",
          padding: "12px 20px",
          borderRadius: 10,
          background: generating ? "rgba(255,255,255,0.05)" : `linear-gradient(135deg, ${C.teal}, ${C.blue})`,
          border: "none",
          color: generating ? "#6aaedd" : "#000",
          fontSize: 13,
          fontWeight: 700,
          cursor: generating ? "not-allowed" : "pointer",
          opacity: generating || selectedImages.length === 0 ? 0.5 : 1,
        }}
      >
        {generating ? `⏳ Generating... ${progress?.percent || 0}%` : `🎥 Generate Video`}
      </button>
    </div>
  );
}
