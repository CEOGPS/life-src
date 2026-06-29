import { useState } from "react";
import WritingEditorUI from "./WritingEditorUI";
import { MODES, TONES, INITIAL_TEMPLATES, generateContentFromTemplate, generateGoogleDocsHTML, exportToMarkdown, exportToPlainText } from "@/lib/writingTemplatesService";

const C = {
  blue: "#4ab3f4", teal: "#00c896", purple: "#8b7fff",
  orange: "#ff8c42", pink: "#ff6b9d", red: "#ff4f5e",
};

export default function WritingHubUI({ onSaveDocument, onClose }) {
  const [mode, setMode] = useState("blog");
  const [tone, setTone] = useState("informative");
  const [view, setView] = useState("home"); // home | editor | templates
  const [currentDoc, setCurrentDoc] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [contextPrompt, setContextPrompt] = useState("");
  const [generatingAI, setGeneratingAI] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const selectedMode = MODES.find(m => m.id === mode);
  const selectedTone = TONES.find(t => t.id === tone);

  const handleNewDocument = () => {
    const template = INITIAL_TEMPLATES[mode];
    setCurrentDoc({
      id: Date.now(),
      title: template.title,
      content: template.content,
      mode,
      tone,
      createdAt: new Date(),
    });
    setView("editor");
  };

  const handleGenerateWithAI = async () => {
    setGeneratingAI(true);
    try {
      const generatedContent = await generateContentFromTemplate(mode, tone, contextPrompt);
      if (generatedContent) {
        const template = INITIAL_TEMPLATES[mode];
        setCurrentDoc({
          id: Date.now(),
          title: `${template.title} (AI Generated)`,
          content: generatedContent,
          mode,
          tone,
          createdAt: new Date(),
        });
        setView("editor");
      }
    } catch (error) {
      console.error("AI generation failed:", error);
    }
    setGeneratingAI(false);
  };

  const handleSaveDocument = (title, content) => {
    const doc = {
      id: Date.now(),
      title,
      content,
      mode,
      tone,
      createdAt: new Date(),
    };

    setDocuments([doc, ...documents]);
    onSaveDocument(doc);
    setCurrentDoc(null);
    setView("home");
  };

  const handleEditDocument = (doc) => {
    setMode(doc.mode);
    setTone(doc.tone);
    setCurrentDoc(doc);
    setView("editor");
  };

  const handleExportDocument = (format) => {
    if (!currentDoc) return;

    let content = "";
    let filename = currentDoc.title.replace(/\s+/g, "_");
    let mimeType = "text/plain";

    switch (format) {
      case "html":
        content = generateGoogleDocsHTML(currentDoc.title, currentDoc.content, "Unknown");
        mimeType = "text/html";
        filename += ".html";
        break;
      case "markdown":
        content = exportToMarkdown(currentDoc.title, currentDoc.content);
        filename += ".md";
        break;
      case "text":
        content = exportToPlainText(currentDoc.title, currentDoc.content);
        filename += ".txt";
        break;
      default:
        return;
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Editor View
  if (view === "editor" && currentDoc) {
    return (
      <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
        <WritingEditorUI
          title={currentDoc.title}
          initialContent={currentDoc.content}
          mode={mode}
          tone={tone}
          onSave={handleSaveDocument}
          onCancel={() => {
            setCurrentDoc(null);
            setView("home");
          }}
        />
        {/* Export Menu */}
        {showExportMenu && (
          <div style={{
            position: "absolute",
            right: 16,
            top: 80,
            background: "#1a1b2a",
            borderRadius: 8,
            border: `1px solid ${C.blue}40`,
            overflow: "hidden",
            zIndex: 1000,
          }}>
            {[
              { label: "📄 HTML", value: "html" },
              { label: "📝 Markdown", value: "markdown" },
              { label: "📋 Plain Text", value: "text" },
            ].map(exp => (
              <button
                key={exp.value}
                onClick={() => {
                  handleExportDocument(exp.value);
                  setShowExportMenu(false);
                }}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "10px 16px",
                  background: "transparent",
                  border: "none",
                  color: "#6aaedd",
                  cursor: "pointer",
                  textAlign: "left",
                  fontSize: 12,
                  fontWeight: 600,
                  borderBottom: "1px solid rgba(255,255,255,0.1)",
                }}
              >
                {exp.label}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Home View
  return (
    <div style={{ display: "flex", height: "100%", gap: 16, padding: 16, background: "#0a0b12", overflow: "auto" }}>
      {/* Left Panel - Mode & Tone Selection */}
      <div style={{ width: 280, display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Mode Selector */}
        <div style={{ background: "#1a1b2a", padding: 12, borderRadius: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#f0ede8", marginBottom: 12 }}>
            📝 Writing Mode
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {MODES.map(m => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                style={{
                  padding: 10,
                  borderRadius: 6,
                  background: mode === m.id ? `${m.id === "blog" ? C.blue : m.id === "resume" ? "#ff6b6b" : m.id === "contract" ? C.purple : m.id === "legal" ? C.orange : m.id === "social" ? C.pink : C.teal}20` : "rgba(255,255,255,0.03)",
                  border: mode === m.id ? `1px solid ${m.id === "blog" ? C.blue : m.id === "resume" ? "#ff6b6b" : m.id === "contract" ? C.purple : m.id === "legal" ? C.orange : m.id === "social" ? C.pink : C.teal}50` : "1px solid rgba(255,255,255,0.1)",
                  color: mode === m.id ? (m.id === "blog" ? C.blue : m.id === "resume" ? "#ff6b6b" : m.id === "contract" ? C.purple : m.id === "legal" ? C.orange : m.id === "social" ? C.pink : C.teal) : "#6aaedd",
                  cursor: "pointer",
                  textAlign: "left",
                  fontSize: 11,
                  fontWeight: 600,
                  transition: "all 0.2s",
                }}
              >
                <div style={{ fontSize: 14, marginBottom: 2 }}>{m.icon}</div>
                <div>{m.name}</div>
                <div style={{ fontSize: 9, opacity: 0.7, marginTop: 2 }}>{m.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Tone Selector */}
        <div style={{ background: "#1a1b2a", padding: 12, borderRadius: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#f0ede8", marginBottom: 12 }}>
            🎯 Writing Tone
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {TONES.map(t => (
              <button
                key={t.id}
                onClick={() => setTone(t.id)}
                style={{
                  padding: 10,
                  borderRadius: 6,
                  background: tone === t.id ? `${C.orange}20` : "rgba(255,255,255,0.03)",
                  border: tone === t.id ? `1px solid ${C.orange}50` : "1px solid rgba(255,255,255,0.1)",
                  color: tone === t.id ? C.orange : "#6aaedd",
                  cursor: "pointer",
                  textAlign: "left",
                  fontSize: 11,
                  fontWeight: 600,
                  transition: "all 0.2s",
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: 2 }}>{t.name}</div>
                <div style={{ fontSize: 9, opacity: 0.7 }}>{t.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Recent Documents */}
        {documents.length > 0 && (
          <div style={{ background: "#1a1b2a", padding: 12, borderRadius: 8, flex: 1, overflowY: "auto" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#f0ede8", marginBottom: 12 }}>
              📚 Recent
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {documents.slice(0, 5).map(doc => (
                <button
                  key={doc.id}
                  onClick={() => handleEditDocument(doc)}
                  style={{
                    padding: 8,
                    borderRadius: 4,
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "#6aaedd",
                    cursor: "pointer",
                    textAlign: "left",
                    fontSize: 10,
                    fontWeight: 500,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={doc.title}
                >
                  {doc.title}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Right Panel - Main Content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Header */}
        <div style={{ background: "#1a1b2a", padding: 16, borderRadius: 8 }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#f0ede8", marginBottom: 8 }}>
            ✍️ Writing Hub
          </div>
          <div style={{ fontSize: 12, color: "#6aaedd", marginBottom: 12 }}>
            {selectedMode?.icon} <strong>{selectedMode?.name}</strong> • {selectedTone?.icon} <strong>{selectedTone?.name}</strong>
          </div>
          <div style={{ fontSize: 11, color: "#6aaedd", lineHeight: 1.6 }}>
            Create, edit, and export professional documents in multiple formats. Use AI to generate content or start from templates.
          </div>
        </div>

        {/* AI Generation Section */}
        <div style={{ background: "linear-gradient(135deg, rgba(74,179,244,0.1), rgba(0,200,150,0.1))", padding: 16, borderRadius: 8, border: `1px solid ${C.blue}30` }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#f0ede8", marginBottom: 12 }}>
            🤖 AI-Powered Generation
          </div>

          <textarea
            placeholder={`Add context for AI generation (optional)...\nExample: "Write a blog post about web development best practices"`}
            value={contextPrompt}
            onChange={e => setContextPrompt(e.target.value)}
            style={{
              width: "100%",
              height: 80,
              padding: 12,
              borderRadius: 6,
              background: "#0a0b12",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#f0ede8",
              fontSize: 11,
              fontFamily: "monospace",
              resize: "none",
              marginBottom: 12,
            }}
          />

          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={handleGenerateWithAI}
              disabled={generatingAI}
              style={{
                flex: 1,
                padding: "10px",
                borderRadius: 6,
                background: generatingAI ? "rgba(255,255,255,0.05)" : `linear-gradient(135deg, ${C.teal}, ${C.blue})`,
                border: "none",
                color: generatingAI ? "#6aaedd" : "#000",
                fontSize: 12,
                fontWeight: 700,
                cursor: generatingAI ? "not-allowed" : "pointer",
              }}
            >
              {generatingAI ? "⏳ Generating..." : "✨ Generate with AI"}
            </button>

            <button
              onClick={handleNewDocument}
              style={{
                flex: 1,
                padding: "10px",
                borderRadius: 6,
                background: `${C.orange}20`,
                border: `1px solid ${C.orange}40`,
                color: C.orange,
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              📝 Blank Document
            </button>
          </div>
        </div>

        {/* Features */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {[
            { icon: "📄", title: "Rich Formatting", desc: "Bold, italic, headings, lists, tables" },
            { icon: "🖼️", title: "Media Support", desc: "Add images, videos, and embedded content" },
            { icon: "🎨", title: "6 Writing Modes", desc: "Blog, Resume, Contract, Legal, Social, Marketing" },
            { icon: "🎯", title: "6 Tones", desc: "Persuasive, Informative, Professional, Casual, Funny, Summary" },
            { icon: "💾", title: "Multi-Format Export", desc: "HTML, Markdown, Plain Text, PDF coming soon" },
            { icon: "📚", title: "Document History", desc: "Access all your previously written documents" },
          ].map((feature, idx) => (
            <div
              key={idx}
              style={{
                padding: 12,
                background: "#1a1b2a",
                borderRadius: 6,
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <div style={{ fontSize: 16, marginBottom: 6 }}>{feature.icon}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#f0ede8", marginBottom: 4 }}>
                {feature.title}
              </div>
              <div style={{ fontSize: 10, color: "#6aaedd" }}>
                {feature.desc}
              </div>
            </div>
          ))}
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            padding: "10px",
            borderRadius: 6,
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "#6aaedd",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Back to MediaPanel
        </button>
      </div>
    </div>
  );
}
