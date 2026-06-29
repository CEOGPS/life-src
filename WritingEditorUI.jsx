import { useState, useRef, useEffect } from "react";

const C = {
  blue: "#4ab3f4", teal: "#00c896", purple: "#8b7fff",
  orange: "#ff8c42", pink: "#ff6b9d", red: "#ff4f5e",
};

const TOOLBAR_BUTTONS = [
  { name: "bold", cmd: "bold", label: "B", title: "Bold" },
  { name: "italic", cmd: "italic", label: "I", title: "Italic" },
  { name: "underline", cmd: "underline", label: "U", title: "Underline" },
  { name: "strikethrough", cmd: "strikethrough", label: "S", title: "Strikethrough" },
  { name: "separator", label: "|" },
  { name: "h1", cmd: "heading", label: "H1", title: "Heading 1", arg: "h1" },
  { name: "h2", cmd: "heading", label: "H2", title: "Heading 2", arg: "h2" },
  { name: "h3", cmd: "heading", label: "H3", title: "Heading 3", arg: "h3" },
  { name: "separator", label: "|" },
  { name: "align-left", cmd: "justifyLeft", label: "⬅", title: "Align Left" },
  { name: "align-center", cmd: "justifyCenter", label: "↔", title: "Align Center" },
  { name: "align-right", cmd: "justifyRight", label: "➡", title: "Align Right" },
  { name: "align-justify", cmd: "justifyFull", label: "⟷", title: "Justify" },
  { name: "separator", label: "|" },
  { name: "ul", cmd: "insertUnorderedList", label: "•", title: "Bullet List" },
  { name: "ol", cmd: "insertOrderedList", label: "1.", title: "Numbered List" },
  { name: "separator", label: "|" },
  { name: "undo", cmd: "undo", label: "↶", title: "Undo" },
  { name: "redo", cmd: "redo", label: "↷", title: "Redo" },
];

export default function WritingEditorUI({
  title,
  initialContent = "",
  onSave,
  onCancel,
  mode = "blog",
  tone = "informative",
}) {
  const editorRef = useRef(null);
  const titleRef = useRef(null);
  const [content, setContent] = useState(initialContent);
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [showTableInsert, setShowTableInsert] = useState(false);
  const [tableRows, setTableRows] = useState(2);
  const [tableCols, setTableCols] = useState(3);

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = initialContent;
      updateCounts();
    }
  }, [initialContent]);

  const updateCounts = () => {
    if (editorRef.current) {
      const text = editorRef.current.innerText || "";
      const words = text.trim().split(/\s+/).filter(w => w.length > 0).length;
      const chars = text.length;
      setWordCount(words);
      setCharCount(chars);
    }
  };

  const handleInput = () => {
    if (editorRef.current) {
      setContent(editorRef.current.innerHTML);
      updateCounts();
    }
  };

  const formatDoc = (cmd, arg = null) => {
    if (editorRef.current) {
      editorRef.current.focus();
      if (arg) {
        document.execCommand(cmd, false, arg);
      } else {
        document.execCommand(cmd, false, null);
      }
    }
  };

  const insertTable = () => {
    const rows = parseInt(tableRows);
    const cols = parseInt(tableCols);
    let table = '<table style="width:100%; border-collapse: collapse; margin: 12px 0;"><tbody>';

    for (let i = 0; i < rows; i++) {
      table += '<tr>';
      for (let j = 0; j < cols; j++) {
        const cellType = i === 0 ? 'th' : 'td';
        table += `<${cellType} style="border: 1px solid #ddd; padding: 8px; text-align: left;"></${cellType}>`;
      }
      table += '</tr>';
    }

    table += '</tbody></table>';
    document.execCommand('insertHTML', false, table);
    setShowTableInsert(false);
    editorRef.current?.focus();
  };

  const insertImage = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const img = `<img src="${event.target.result}" style="max-width: 100%; height: auto; margin: 12px 0; border-radius: 8px;" />`;
          document.execCommand('insertHTML', false, img);
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  const insertLink = () => {
    const url = prompt('Enter URL:');
    if (url) {
      const text = window.getSelection().toString() || 'link';
      document.execCommand('createLink', false, url);
    }
  };

  const insertVideo = async () => {
    const url = prompt('Enter video URL (YouTube, Vimeo, etc.):');
    if (url) {
      let embedCode = '';
      if (url.includes('youtube.com') || url.includes('youtu.be')) {
        const videoId = url.includes('youtu.be')
          ? url.split('/').pop()
          : new URL(url).searchParams.get('v');
        embedCode = `<iframe width="100%" height="400" src="https://www.youtube.com/embed/${videoId}" style="border-radius: 8px; margin: 12px 0;" frameborder="0" allowfullscreen></iframe>`;
      } else if (url.includes('vimeo.com')) {
        const videoId = url.split('/').pop();
        embedCode = `<iframe width="100%" height="400" src="https://player.vimeo.com/video/${videoId}" style="border-radius: 8px; margin: 12px 0;" frameborder="0" allowfullscreen></iframe>`;
      } else {
        embedCode = `<video width="100%" height="400" style="border-radius: 8px; margin: 12px 0;" controls><source src="${url}" type="video/mp4"></video>`;
      }
      document.execCommand('insertHTML', false, embedCode);
    }
  };

  const handleSave = () => {
    const titleText = titleRef.current?.value || "Untitled Document";
    const content = editorRef.current?.innerHTML || "";
    onSave(titleText, content);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 12, padding: 16, background: "#0a0b12" }}>
      {/* Title Input */}
      <input
        ref={titleRef}
        type="text"
        placeholder="Document Title..."
        defaultValue={title}
        style={{
          padding: "12px 16px",
          borderRadius: 8,
          background: "#1a1b2a",
          border: `1px solid rgba(255,255,255,0.1)`,
          color: "#f0ede8",
          fontSize: 18,
          fontWeight: 700,
          outline: "none",
        }}
      />

      {/* Metadata */}
      <div style={{ display: "flex", gap: 16, fontSize: 11, color: "#6aaedd" }}>
        <div>📝 {wordCount} words</div>
        <div>🔤 {charCount} chars</div>
        <div style={{ marginLeft: "auto" }}>
          {mode && tone && <span>Mode: <strong>{mode}</strong> | Tone: <strong>{tone}</strong></span>}
        </div>
      </div>

      {/* Toolbar */}
      <div style={{
        display: "flex",
        gap: 4,
        flexWrap: "wrap",
        padding: 12,
        background: "#1a1b2a",
        borderRadius: 8,
        alignItems: "center",
      }}>
        {TOOLBAR_BUTTONS.map((btn, idx) => {
          if (btn.name === "separator") {
            return (
              <div
                key={idx}
                style={{
                  width: 1,
                  height: 24,
                  background: "rgba(255,255,255,0.1)",
                  margin: "0 4px",
                }}
              />
            );
          }

          return (
            <button
              key={btn.name}
              onClick={() => {
                if (btn.cmd === "heading") {
                  formatDoc("heading", btn.arg);
                } else {
                  formatDoc(btn.cmd);
                }
              }}
              title={btn.title}
              style={{
                padding: "6px 10px",
                borderRadius: 4,
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#6aaedd",
                cursor: "pointer",
                fontSize: 11,
                fontWeight: 600,
                transition: "all 0.2s",
              }}
              onMouseOver={e => {
                e.currentTarget.style.background = `${C.blue}30`;
                e.currentTarget.style.color = C.blue;
              }}
              onMouseOut={e => {
                e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                e.currentTarget.style.color = "#6aaedd";
              }}
            >
              {btn.label}
            </button>
          );
        })}

        {/* Additional Buttons */}
        <div style={{ marginLeft: 8, display: "flex", gap: 4 }}>
          <button
            onClick={insertImage}
            title="Insert Image"
            style={{
              padding: "6px 10px",
              borderRadius: 4,
              background: `${C.orange}20`,
              border: `1px solid ${C.orange}40`,
              color: C.orange,
              cursor: "pointer",
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            🖼️
          </button>

          <button
            onClick={() => setShowTableInsert(!showTableInsert)}
            title="Insert Table"
            style={{
              padding: "6px 10px",
              borderRadius: 4,
              background: `${C.pink}20`,
              border: `1px solid ${C.pink}40`,
              color: C.pink,
              cursor: "pointer",
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            📊
          </button>

          <button
            onClick={insertVideo}
            title="Insert Video"
            style={{
              padding: "6px 10px",
              borderRadius: 4,
              background: `${C.teal}20`,
              border: `1px solid ${C.teal}40`,
              color: C.teal,
              cursor: "pointer",
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            🎬
          </button>

          <button
            onClick={insertLink}
            title="Insert Link"
            style={{
              padding: "6px 10px",
              borderRadius: 4,
              background: `${C.purple}20`,
              border: `1px solid ${C.purple}40`,
              color: C.purple,
              cursor: "pointer",
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            🔗
          </button>
        </div>
      </div>

      {/* Table Insert Modal */}
      {showTableInsert && (
        <div style={{
          padding: 12,
          background: "#1a1b2a",
          borderRadius: 8,
          display: "flex",
          gap: 12,
          alignItems: "center",
        }}>
          <label style={{ fontSize: 11, color: "#6aaedd" }}>Rows:</label>
          <input
            type="number"
            min="1"
            max="20"
            value={tableRows}
            onChange={e => setTableRows(e.target.value)}
            style={{
              width: 50,
              padding: "4px 6px",
              borderRadius: 4,
              background: "#0a0b12",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#f0ede8",
              fontSize: 11,
            }}
          />

          <label style={{ fontSize: 11, color: "#6aaedd" }}>Columns:</label>
          <input
            type="number"
            min="1"
            max="10"
            value={tableCols}
            onChange={e => setTableCols(e.target.value)}
            style={{
              width: 50,
              padding: "4px 6px",
              borderRadius: 4,
              background: "#0a0b12",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#f0ede8",
              fontSize: 11,
            }}
          />

          <button
            onClick={insertTable}
            style={{
              padding: "4px 12px",
              borderRadius: 4,
              background: `${C.pink}40`,
              border: `1px solid ${C.pink}`,
              color: "#000",
              cursor: "pointer",
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            Insert
          </button>
        </div>
      )}

      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        style={{
          flex: 1,
          padding: 16,
          background: "#1a1b2a",
          borderRadius: 8,
          border: `1px solid ${C.blue}40`,
          color: "#f0ede8",
          fontSize: 14,
          lineHeight: 1.8,
          overflow: "auto",
          outline: "none",
          whiteSpace: "pre-wrap",
          wordWrap: "break-word",
        }}
        suppressContentEditableWarning
      />

      {/* Actions */}
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
          💾 Save Document
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
  );
}
