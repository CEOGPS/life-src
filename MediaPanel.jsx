import { useState, useRef, useEffect, useCallback } from "react";
import Icon from "@/components/lifeos/icons/Icon";
import VideoGeneratorUI from "./VideoGeneratorUI";
import ImageStudioUI from "./ImageStudioUI";
import WritingHubUI from "./WritingHubUI";

// ── Constants ────────────────────────────────────────────────────────────────
const C = {
  bg: "#0b0c14", card: "#13141f", card2: "#1a1b2a",
  blue: "#4ab3f4", teal: "#00c896", purple: "#8b7fff",
  orange: "#ff8c42", pink: "#ff6b9d", red: "#ff4f5e",
  text: "#f0ede8", muted: "#6aaedd", dim: "#3a4a5a",
  border: "rgba(255,255,255,0.07)",
};

const TABS = ["Images", "Videos", "Music", "Documents", "Files", "Video Generator", "Image Studio", "Writing Hub"];

const ALBUM_COLORS = [C.blue, C.teal, C.orange, C.purple, C.pink, C.red, "#00e676"];

const TAB_ICONS = {
  Images: "🖼️", Videos: "🎬", Music: "🎵", Documents: "📄", Files: "📁",
};

const FILE_ICONS = {
  pdf: "📄", docx: "📝", doc: "📝", xlsx: "📊", xls: "📊",
  txt: "📃", mp4: "🎬", mov: "🎬", avi: "🎬",
  mp3: "🎵", wav: "🎵", aac: "🎵", ogg: "🎵",
  zip: "📦", rar: "📦", png: "🖼️", jpg: "🖼️",
  jpeg: "🖼️", gif: "🎞️", webp: "🖼️", svg: "🎨",
};

const DOC_TEMPLATES = [
  { id: "gdoc",    icon: "📝", name: "Google Doc",    color: "#4285F4", url: "https://docs.google.com/document/create" },
  { id: "gsheet",  icon: "📊", name: "Google Sheet",  color: "#0F9D58", url: "https://docs.google.com/spreadsheets/create" },
  { id: "gslide",  icon: "📽️", name: "Google Slides", color: "#F4B400", url: "https://docs.google.com/presentation/create" },
  { id: "hellosign",icon: "✍️", name: "Sign Document", color: "#00c896", url: "https://app.hellosign.com" },
  { id: "docusign",icon: "🖊️", name: "DocuSign",      color: "#FFCC00", url: "https://www.docusign.com" },
];

const AI_TOOLS = [
  { id: "remove-bg", icon: "✂️", name: "Remove Background", desc: "AI background removal", color: C.teal },
  { id: "upscale",   icon: "🔍", name: "Upscale Image",     desc: "4× AI upscaling",      color: C.blue },
  { id: "enhance",   icon: "✨", name: "AI Enhance",        desc: "Smart enhancement",     color: C.purple },
  { id: "caption",   icon: "💬", name: "Auto Caption",      desc: "Generate captions",     color: C.orange },
];

// ── localStorage helpers ─────────────────────────────────────────────────────
function loadLS(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function saveLS(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { console.warn("localStorage full:", e); }
}

function fileExt(name) { return name.split(".").pop()?.toLowerCase() || ""; }
function fileIconFor(name) { return FILE_ICONS[fileExt(name)] || "📁"; }
function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// Convert File → base64 dataURL (for images only, size-gated)
function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function MediaPanel() {
  const [tab, setTab]           = useState("Images");
  const [innerTab, setInnerTab] = useState("library"); // library | ai | cloud
  const [files, setFiles]       = useState(() => loadLS("lifeos_media_files_v2", []));
  const [albums, setAlbums]     = useState(() => loadLS("lifeos_media_albums_v2", []));
  const [activeAlbum, setActiveAlbum] = useState(null);
  const [lightbox, setLightbox] = useState(null);
  const [editingFile, setEditingFile] = useState(null);
  const [editFileName, setEditFileName] = useState("");
  const [search, setSearch]     = useState("");
  const [view, setView]         = useState("albums"); // albums | files
  const [showNewAlbum, setShowNewAlbum] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState("");
  const [newAlbumColor, setNewAlbumColor] = useState(ALBUM_COLORS[0]);
  const [uploading, setUploading] = useState(false);
  const [notification, setNotification] = useState(null);
  const [editingAlbumId, setEditingAlbumId] = useState(null);
  const [editAlbumName, setEditAlbumName] = useState("");
  const inputRef = useRef(null);
  const coverInputRef = useRef(null);
  const [coverTargetAlbum, setCoverTargetAlbum] = useState(null);
  const [cloudConnected, setCloudConnected] = useState(() => loadLS("lifeos_cloud_connected", {}));
  const [cloudModal, setCloudModal] = useState(null); // { provider, name, fields }
  const [cloudFormVals, setCloudFormVals] = useState({});

  // ── Persist to localStorage whenever state changes ────────────────────────
  useEffect(() => {
    // Don't store objectURL-only files (they die on refresh) — store base64 ones
    const toStore = files.map(f => {
      const { _objectUrl, ...rest } = f;
      return rest;
    });
    saveLS("lifeos_media_files_v2", toStore);
  }, [files]);

  useEffect(() => {
    saveLS("lifeos_media_albums_v2", albums);
  }, [albums]);

  // ── Computed ──────────────────────────────────────────────────────────────
  const tabAlbums = albums.filter(a => a.type === tab);
  const tabFiles  = files.filter(f =>
    f.type === tab &&
    (activeAlbum ? f.albumId === activeAlbum : true) &&
    (search === "" || f.name.toLowerCase().includes(search.toLowerCase()))
  );

  const totalStoredMB = files.reduce((acc, f) => {
    if (f.url && f.url.startsWith("data:")) {
      return acc + (f.url.length * 0.75 / 1024 / 1024); // base64 to bytes approx
    }
    return acc + (f.sizeMB || 0);
  }, 0);

  const storageGB   = Math.min(totalStoredMB / 1024, 5);
  const storagePct  = Math.min((storageGB / 5) * 100, 100);

  function notify(msg, type = "success") {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  }

  // ── Save Generated Video ───────────────────────────────────────────────────
  const handleSaveGeneratedVideo = (blob, fileName) => {
    // Ensure "Generated Videos" album exists
    let genVideoAlbum = albums.find(a => a.name === "Generated Videos" && a.type === "Videos");
    if (!genVideoAlbum) {
      genVideoAlbum = {
        id: `album_${Date.now()}`,
        name: "Generated Videos",
        type: "Videos",
        color: C.teal,
        createdAt: new Date().toISOString(),
      };
      setAlbums(prev => [...prev, genVideoAlbum]);
    }

    // Convert blob to base64
    const reader = new FileReader();
    reader.onload = () => {
      const newFile = {
        id: `file_${Date.now()}`,
        name: fileName,
        type: "Videos",
        url: reader.result,
        albumId: genVideoAlbum.id,
        sizeMB: (blob.size / 1024 / 1024).toFixed(1),
        createdAt: new Date().toISOString(),
        tags: ["generated", "video"],
      };
      setFiles(prev => [...prev, newFile]);
      notify(`✅ Video saved to "Generated Videos" album!`, "success");
      setTab("Videos");
      setActiveAlbum(genVideoAlbum.id);
    };
    reader.readAsDataURL(blob);
  };

  // ── Save Edited/Generated Image ───────────────────────────────────────────
  const handleSaveImage = (blob, fileName, albumName) => {
    // Ensure album exists
    let album = albums.find(a => a.name === albumName && a.type === "Images");
    if (!album) {
      album = {
        id: `album_${Date.now()}`,
        name: albumName,
        type: "Images",
        color: albumName === "Edited Images" ? C.blue : C.orange,
        createdAt: new Date().toISOString(),
      };
      setAlbums(prev => [...prev, album]);
    }

    // Convert blob to base64
    const reader = new FileReader();
    reader.onload = () => {
      const newFile = {
        id: `file_${Date.now()}`,
        name: fileName,
        type: "Images",
        url: reader.result,
        albumId: album.id,
        sizeMB: (blob.size / 1024 / 1024).toFixed(1),
        createdAt: new Date().toISOString(),
        tags: [albumName === "Edited Images" ? "edited" : "generated", "image"],
      };
      setFiles(prev => [...prev, newFile]);
      notify(`✅ Image saved to "${albumName}" album!`, "success");
      setTab("Images");
      setActiveAlbum(album.id);
    };
    reader.readAsDataURL(blob);
  };

  // ── Save Document from Writing Hub ────────────────────────────────────────
  const handleSaveDocument = (doc) => {
    // Ensure "Written Documents" album exists
    let docAlbum = albums.find(a => a.name === "Written Documents" && a.type === "Documents");
    if (!docAlbum) {
      docAlbum = {
        id: `album_${Date.now()}`,
        name: "Written Documents",
        type: "Documents",
        color: C.purple,
        createdAt: new Date().toISOString(),
      };
      setAlbums(prev => [...prev, docAlbum]);
    }

    // Create document file entry
    const newFile = {
      id: `file_${Date.now()}`,
      name: doc.title || "Untitled Document",
      type: "Documents",
      content: doc.content,
      mode: doc.mode,
      tone: doc.tone,
      albumId: docAlbum.id,
      createdAt: new Date().toISOString(),
      tags: [doc.mode, doc.tone, "writing-hub"],
      metadata: { mode: doc.mode, tone: doc.tone, wordCount: doc.content?.split(/\s+/).length || 0 },
    };

    setFiles(prev => [...prev, newFile]);
    notify(`✅ Document saved to "Written Documents" album!`, "success");
    setTab("Documents");
    setActiveAlbum(docAlbum.id);
  };

  // ── Cloud connect / disconnect ─────────────────────────────────────────────
  const CLOUD_PROVIDERS = [
    {
      id: "r2", name: "Cloudflare R2", icon: "☁️", color: C.orange,
      desc: "Enterprise-grade object storage, integrated with LifeOS Workers. Best for production.",
      badge: "Recommended",
      fields: [
        { key: "accountId", label: "Account ID", placeholder: "abc123..." },
        { key: "accessKey", label: "Access Key ID", placeholder: "your-access-key" },
        { key: "secretKey", label: "Secret Access Key", placeholder: "your-secret-key", password: true },
        { key: "bucket", label: "Bucket Name", placeholder: "lifeos-media" },
      ],
    },
    {
      id: "gdrive", name: "Google Drive", icon: "🟡", color: "#4285F4",
      desc: "15 GB free. Direct upload to your Google Drive from Media Studio.",
      badge: "Popular",
      fields: [
        { key: "clientId", label: "OAuth Client ID", placeholder: "xxxxx.apps.googleusercontent.com" },
        { key: "apiKey", label: "API Key", placeholder: "AIza..." },
      ],
    },
    {
      id: "dropbox", name: "Dropbox", icon: "📦", color: "#0061FF",
      desc: "Sync your media files with Dropbox for easy sharing.",
      badge: null,
      fields: [
        { key: "appKey", label: "App Key", placeholder: "your-dropbox-app-key" },
        { key: "accessToken", label: "Access Token", placeholder: "sl.xxxx...", password: true },
      ],
    },
    {
      id: "s3", name: "Amazon S3", icon: "🪣", color: C.orange,
      desc: "Unlimited storage. Bring your own S3 bucket.",
      badge: null,
      fields: [
        { key: "region", label: "Region", placeholder: "us-east-1" },
        { key: "bucket", label: "Bucket Name", placeholder: "my-lifeos-bucket" },
        { key: "accessKey", label: "Access Key ID", placeholder: "AKIAxxxxxx" },
        { key: "secretKey", label: "Secret Access Key", placeholder: "secret...", password: true },
      ],
    },
  ];

  function openCloudModal(provider) {
    const existing = cloudConnected[provider.id] || {};
    setCloudFormVals(existing);
    setCloudModal(provider);
  }

  function saveCloudConnection() {
    if (!cloudModal) return;
    const updated = { ...cloudConnected, [cloudModal.id]: { ...cloudFormVals, connectedAt: new Date().toISOString() } };
    setCloudConnected(updated);
    saveLS("lifeos_cloud_connected", updated);
    setCloudModal(null);
    setCloudFormVals({});
    notify(`${cloudModal.name} connected ✓`);
  }

  function disconnectCloud(providerId) {
    const updated = { ...cloudConnected };
    delete updated[providerId];
    setCloudConnected(updated);
    saveLS("lifeos_cloud_connected", updated);
    notify("Disconnected");
  }

  // ── Upload Handler ────────────────────────────────────────────────────────
  async function handleUpload(e) {
    const uploaded = Array.from(e.target.files || []);
    if (!uploaded.length) return;
    setUploading(true);

    const mapped = await Promise.all(uploaded.map(async (f) => {
      let ftype = "Files";
      if (f.type.startsWith("image"))       ftype = "Images";
      else if (f.type.startsWith("video"))  ftype = "Videos";
      else if (f.type.startsWith("audio"))  ftype = "Music";
      else if (/\.(pdf|doc|docx|txt|xlsx|xls)$/i.test(f.name)) ftype = "Documents";

      const id  = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const now = new Date();
      const dateStr = now.toLocaleDateString("en-US", { month: "short", day: "numeric" });

      let url    = null;
      let stored = false;

      if (ftype === "Images" && f.size <= 3 * 1024 * 1024) {
        // Store images < 3 MB as base64 — truly persistent
        url    = await toBase64(f);
        stored = true;
      } else if (ftype === "Images") {
        // Large image — objectURL for session only
        url = URL.createObjectURL(f);
      } else if (ftype === "Videos" || ftype === "Music") {
        url = URL.createObjectURL(f);
      }

      return {
        id,
        name:    f.name,
        url,
        type:    ftype,
        sizeMB:  f.size / 1024 / 1024,
        sizeStr: formatSize(f.size),
        date:    dateStr,
        albumId: activeAlbum || null,
        stored,  // true = base64 persists; false = session objectURL only
        mimeType: f.type,
      };
    }));

    setFiles(prev => [...prev, ...mapped]);
    const persistent = mapped.filter(f => f.stored).length;
    const session    = mapped.length - persistent;

    if (persistent > 0 && session === 0) notify(`${persistent} file${persistent > 1 ? "s" : ""} uploaded and saved ✓`);
    else if (persistent > 0 && session > 0) notify(`${persistent} saved permanently, ${session} session-only (large files) ⚠️`, "warning");
    else notify(`${session} file${session > 1 ? "s" : ""} uploaded (session only — re-upload to persist) ⚠️`, "warning");

    if (mapped[0]) { setTab(mapped[0].type); setView("files"); }
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  // ── Album Cover Upload ────────────────────────────────────────────────────
  async function handleCoverUpload(e) {
    const f = e.target.files?.[0];
    if (!f || !coverTargetAlbum) return;
    const url = await toBase64(f);
    setAlbums(prev => prev.map(a => a.id === coverTargetAlbum ? { ...a, cover: url } : a));
    setCoverTargetAlbum(null);
    if (coverInputRef.current) coverInputRef.current.value = "";
  }

  function triggerCoverUpload(albumId) {
    setCoverTargetAlbum(albumId);
    setTimeout(() => coverInputRef.current?.click(), 50);
  }

  // ── Album CRUD ────────────────────────────────────────────────────────────
  function createAlbum() {
    if (!newAlbumName.trim()) return;
    const a = {
      id:    `alb_${Date.now()}`,
      name:  newAlbumName.trim(),
      type:  tab,
      color: newAlbumColor,
      cover: null,
    };
    setAlbums(prev => [...prev, a]);
    setNewAlbumName("");
    setShowNewAlbum(false);
    notify("Album created ✓");
  }

  function deleteAlbum(id) {
    setAlbums(prev => prev.filter(a => a.id !== id));
    setFiles(prev => prev.map(f => f.albumId === id ? { ...f, albumId: null } : f));
    if (activeAlbum === id) setActiveAlbum(null);
    notify("Album deleted");
  }

  function saveAlbumName(id) {
    setAlbums(prev => prev.map(a => a.id === id ? { ...a, name: editAlbumName } : a));
    setEditingAlbumId(null);
  }

  // ── File CRUD ─────────────────────────────────────────────────────────────
  function deleteFile(id) {
    setFiles(prev => {
      const f = prev.find(x => x.id === id);
      if (f?._objectUrl) URL.revokeObjectURL(f._objectUrl);
      return prev.filter(x => x.id !== id);
    });
    notify("File deleted");
  }

  function saveFileName() {
    if (!editingFile || !editFileName.trim()) return;
    setFiles(prev => prev.map(f => f.id === editingFile.id ? { ...f, name: editFileName } : f));
    setEditingFile(null);
    notify("Renamed ✓");
  }

  function assignToAlbum(fileId, albumId) {
    setFiles(prev => prev.map(f => f.id === fileId ? { ...f, albumId } : f));
    notify("Moved to album ✓");
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden", background: C.bg }}>

      {/* Hidden inputs — positioned off-screen (not display:none) for cross-browser programmatic click compatibility */}
      <input ref={inputRef} id="lifeos-media-upload" type="file" multiple
        accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.xlsx,.xls,.zip"
        style={{ position: "fixed", left: -9999, top: -9999, width: 1, height: 1, opacity: 0 }}
        onChange={handleUpload} />
      <input ref={coverInputRef} id="lifeos-cover-upload" type="file" accept="image/*"
        style={{ position: "fixed", left: -9999, top: -9999, width: 1, height: 1, opacity: 0 }}
        onChange={handleCoverUpload} />

      {/* Notification toast */}
      {notification && (
        <div style={{
          position: "fixed", top: 20, right: 24, zIndex: 9999,
          padding: "10px 18px", borderRadius: 10,
          background: notification.type === "warning" ? `${C.orange}22` : `${C.teal}22`,
          border: `0.5px solid ${notification.type === "warning" ? C.orange : C.teal}`,
          color: notification.type === "warning" ? C.orange : C.teal,
          fontSize: 12, fontWeight: 600, boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
        }}>
          {notification.msg}
        </div>
      )}

      {/* ── Header ── */}
      <div style={{ padding: "16px 24px 0", flexShrink: 0, borderBottom: `0.5px solid ${C.border}` }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>Media Studio</div>
            <div style={{ fontSize: 10, color: C.muted }}>Upload · Organize · Edit · Store</div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {/* Search */}
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search files..."
              style={{
                padding: "6px 14px", borderRadius: 20, width: 160, fontSize: 11,
                background: C.card2, border: `0.5px solid ${C.border}`,
                color: C.text, outline: "none",
              }} />
            {/* Albums / Files toggle */}
            <button onClick={() => setView(v => v === "albums" ? "files" : "albums")}
              style={{
                padding: "6px 12px", borderRadius: 8, fontSize: 11, cursor: "pointer",
                background: "rgba(255,255,255,0.05)", border: `0.5px solid ${C.border}`, color: C.muted,
              }}>
              {view === "albums" ? "📁 Files" : "🗂 Albums"}
            </button>
            {/* Upload — label triggers the off-screen file input reliably in all environments */}
            <label htmlFor={uploading ? undefined : "lifeos-media-upload"}
              onClick={e => uploading && e.preventDefault()}
              style={{
                padding: "7px 18px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                background: uploading ? "#333" : `linear-gradient(135deg,${C.teal},${C.blue})`,
                border: "none", color: uploading ? "#888" : "#000",
                cursor: uploading ? "not-allowed" : "pointer",
                transition: "all .15s", display: "inline-block", userSelect: "none",
                opacity: uploading ? 0.6 : 1,
              }}>
              {uploading ? "Uploading..." : "+ Upload"}
            </label>
          </div>
        </div>

        {/* Storage bar */}
        <StorageBar usedGB={storageGB} totalGB={5} color={storagePct > 85 ? C.orange : C.teal} />

        {/* Inner nav tabs */}
        <div style={{ display: "flex", gap: 3, marginTop: 10 }}>
          {[
            { id: "library", label: "📂 Library" },
            { id: "ai",      label: "🪄 AI Tools" },
            { id: "cloud",   label: "☁️ Cloud Storage" },
          ].map(t => (
            <button key={t.id} onClick={() => setInnerTab(t.id)}
              style={{
                padding: "7px 16px", borderRadius: "8px 8px 0 0", border: "none", cursor: "pointer",
                fontSize: 11, fontWeight: innerTab === t.id ? 700 : 400,
                background: innerTab === t.id ? C.card : "transparent",
                color: innerTab === t.id ? C.teal : C.muted,
                borderBottom: innerTab === t.id ? `2px solid ${C.teal}` : "2px solid transparent",
              }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab Content ── */}
      <div style={{ flex: 1, overflow: "hidden", background: C.card }}>

        {/* LIBRARY tab */}
        {innerTab === "library" && (
          <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {/* File type tabs */}
            <div style={{
              display: "flex", gap: 2, padding: "8px 24px 0",
              borderBottom: `0.5px solid ${C.border}`, flexShrink: 0, background: C.bg,
            }}>
              {TABS.map(t => {
                const count = files.filter(f => f.type === t).length;
                return (
                  <button key={t} onClick={() => { setTab(t); setActiveAlbum(null); }}
                    style={{
                      padding: "6px 14px", borderRadius: "7px 7px 0 0", border: "none", cursor: "pointer",
                      fontSize: 11, fontWeight: 600,
                      background: tab === t ? C.card : "transparent",
                      color: tab === t ? C.teal : C.dim,
                      borderBottom: tab === t ? `2px solid ${C.teal}` : "2px solid transparent",
                    }}>
                    {t} {count > 0 && (
                      <span style={{
                        marginLeft: 4, padding: "1px 5px", borderRadius: 8,
                        background: tab === t ? `${C.teal}22` : "rgba(255,255,255,0.06)",
                        color: tab === t ? C.teal : C.dim, fontSize: 9,
                      }}>{count}</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Content area */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px" }}>
              {/* Documents tab quick actions */}
              {tab === "Documents" && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: C.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: ".08em" }}>Create New</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
                    {DOC_TEMPLATES.map(d => (
                      <a key={d.id} href={d.url} target="_blank" rel="noopener noreferrer"
                        style={{
                          display: "flex", alignItems: "center", gap: 7, padding: "8px 14px",
                          borderRadius: 8, background: C.card2, border: `0.5px solid ${d.color}40`,
                          textDecoration: "none", transition: "all .15s",
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = d.color + "18")}
                        onMouseLeave={e => (e.currentTarget.style.background = C.card2)}>
                        <span style={{ fontSize: 15 }}>{d.icon}</span>
                        <span style={{ fontSize: 11, color: d.color, fontWeight: 600 }}>{d.name} ↗</span>
                      </a>
                    ))}
                  </div>
                  <div style={{ height: 1, background: C.border, marginBottom: 16 }} />
                </div>
              )}

              {/* Albums view */}
              {view === "albums" && (
                <AlbumsView
                  tab={tab} albums={tabAlbums} files={files}
                  activeAlbum={activeAlbum} setActiveAlbum={setActiveAlbum}
                  tabFiles={tabFiles}
                  showNewAlbum={showNewAlbum} setShowNewAlbum={setShowNewAlbum}
                  newAlbumName={newAlbumName} setNewAlbumName={setNewAlbumName}
                  newAlbumColor={newAlbumColor} setNewAlbumColor={setNewAlbumColor}
                  createAlbum={createAlbum} deleteAlbum={deleteAlbum}
                  editingAlbumId={editingAlbumId} setEditingAlbumId={setEditingAlbumId}
                  editAlbumName={editAlbumName} setEditAlbumName={setEditAlbumName}
                  saveAlbumName={saveAlbumName}
                  triggerCoverUpload={triggerCoverUpload}
                  onOpen={setLightbox} onDelete={deleteFile}
                  onEdit={f => { setEditingFile(f); setEditFileName(f.name); }}
                  albums_all={albums}
                  assignToAlbum={assignToAlbum}
                />
              )}

              {/* Files flat view */}
              {view === "files" && (
                <>
                  {tabFiles.length === 0 ? (
                    <EmptyState tab={tab} onUpload={() => inputRef.current?.click()} />
                  ) : (
                    <FileGrid
                      files={tabFiles} tab={tab}
                      onOpen={setLightbox} onDelete={deleteFile}
                      onEdit={f => { setEditingFile(f); setEditFileName(f.name); }}
                      albums={albums} assignToAlbum={assignToAlbum}
                    />
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* AI TOOLS tab */}
        {innerTab === "ai" && (
          <div style={{ padding: 24, overflowY: "auto", height: "100%" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 4 }}>AI Image & Video Tools</div>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 20 }}>
              Select a file from your library then apply AI enhancements
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 12, marginBottom: 24 }}>
              {AI_TOOLS.map(tool => (
                <div key={tool.id}
                  style={{
                    background: C.card2, border: `0.5px solid ${tool.color}30`,
                    borderRadius: 12, padding: 18, cursor: "pointer", transition: "all .15s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.border = `0.5px solid ${tool.color}70`; e.currentTarget.style.background = tool.color + "12"; }}
                  onMouseLeave={e => { e.currentTarget.style.border = `0.5px solid ${tool.color}30`; e.currentTarget.style.background = C.card2; }}>
                  <div style={{ fontSize: 28, marginBottom: 10 }}>{tool.icon}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: tool.color, marginBottom: 4 }}>{tool.name}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>{tool.desc}</div>
                </div>
              ))}
            </div>

            {/* Canva-style editor link */}
            <div style={{
              background: C.card2, border: `0.5px solid ${C.purple}40`, borderRadius: 14, padding: 20,
              display: "flex", alignItems: "center", gap: 18,
            }}>
              <div style={{ fontSize: 40 }}><Icon name="🎨" size={14} /></div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 4 }}>Full Design Suite</div>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 12 }}>
                  Open Canva for full image editing, templates, and design tools — create social posts, presentations, and more.
                </div>
                <a href="https://www.canva.com" target="_blank" rel="noopener noreferrer"
                  style={{
                    display: "inline-block", padding: "8px 20px", borderRadius: 20,
                    background: `linear-gradient(135deg,${C.purple},${C.pink})`,
                    color: "#fff", fontSize: 12, fontWeight: 700, textDecoration: "none",
                  }}>
                  Open Canva ↗
                </a>
              </div>
            </div>
          </div>
        )}

        {/* CLOUD STORAGE tab */}
        {innerTab === "cloud" && (
          <div style={{ padding: 24, overflowY: "auto", height: "100%" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 4 }}>Cloud Storage</div>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 20 }}>
              Connect cloud storage for unlimited, secure file persistence
            </div>

            {/* Local storage status */}
            <div style={{
              background: `${C.orange}12`, border: `0.5px solid ${C.orange}50`,
              borderRadius: 12, padding: 16, marginBottom: 20,
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.orange, marginBottom: 6 }}><Icon name="⚠️" size={12} style={{marginRight:6,verticalAlign:"middle"}} />Local Storage Active</div>
              <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.6 }}>
                Images under 3 MB are saved locally and persist across sessions.
                Large files (videos, audio, large images) are session-only and will be lost on refresh.
                Connect a cloud provider below for full persistence on all file types.
              </div>
            </div>

            {/* Cloud providers */}
            {CLOUD_PROVIDERS.map(p => {
              const connected = !!cloudConnected[p.id];
              return (
                <div key={p.id} style={{
                  background: C.card2,
                  border: `0.5px solid ${connected ? p.color + "60" : C.border}`,
                  borderRadius: 12, padding: 16, marginBottom: 10,
                  display: "flex", alignItems: "center", gap: 14,
                  transition: "border-color .2s",
                }}>
                  <div style={{ fontSize: 28, flexShrink: 0 }}>{p.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{p.name}</span>
                      {p.badge && (
                        <span style={{
                          fontSize: 9, fontWeight: 700, color: p.color,
                          background: p.color + "20", border: `0.5px solid ${p.color}50`,
                          padding: "2px 7px", borderRadius: 8,
                        }}>{p.badge}</span>
                      )}
                      {connected && (
                        <span style={{
                          fontSize: 9, fontWeight: 700, color: C.teal,
                          background: C.teal + "20", border: `0.5px solid ${C.teal}50`,
                          padding: "2px 7px", borderRadius: 8,
                        }}><Icon name="✓" size={12} style={{marginRight:6,verticalAlign:"middle"}} />Connected</span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: C.muted }}>{p.desc}</div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => openCloudModal(p)} style={{
                      padding: "7px 16px", borderRadius: 8, fontSize: 11, fontWeight: 600,
                      background: connected ? `${C.teal}18` : `${p.color}18`,
                      border: `0.5px solid ${connected ? C.teal + "50" : p.color + "50"}`,
                      color: connected ? C.teal : p.color, cursor: "pointer", whiteSpace: "nowrap",
                    }}>
                      {connected ? "⚙ Edit" : "Connect"}
                    </button>
                    {connected && (
                      <button onClick={() => disconnectCloud(p.id)} style={{
                        padding: "7px 10px", borderRadius: 8, fontSize: 11,
                        background: `${C.red}12`, border: `0.5px solid ${C.red}40`,
                        color: C.red, cursor: "pointer",
                      }}><Icon name="✕" size={14} /></button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Lightbox ── */}
      {lightbox && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.95)", zIndex: 9999,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12,
        }} onClick={() => setLightbox(null)}>
          {lightbox.type === "Images" && (
            <img src={lightbox.url} alt={lightbox.name}
              style={{ maxWidth: "90vw", maxHeight: "80vh", objectFit: "contain", borderRadius: 10, border: `1px solid ${C.teal}40` }} />
          )}
          {lightbox.type === "Videos" && lightbox.url && (
            <video src={lightbox.url} controls autoPlay
              style={{ maxWidth: "90vw", maxHeight: "80vh", borderRadius: 10 }}
              onClick={e => e.stopPropagation()} />
          )}
          {lightbox.type === "Music" && lightbox.url && (
            <div onClick={e => e.stopPropagation()}
              style={{ background: C.card, border: `0.5px solid ${C.border}`, borderRadius: 16, padding: 28, textAlign: "center", minWidth: 320 }}>
              <div style={{ fontSize: 52, marginBottom: 12 }}><Icon name="🎵" size={14} /></div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 14 }}>{lightbox.name}</div>
              <audio controls src={lightbox.url} style={{ width: "100%" }} />
            </div>
          )}
          <div style={{ fontSize: 12, color: C.text, fontWeight: 600 }}>{lightbox.name}</div>
          <div style={{ fontSize: 10, color: C.dim }}>Click anywhere to close</div>
        </div>
      )}

      {/* ── Cloud Connect Modal ── */}
      {cloudModal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.82)", zIndex: 9999,
          display: "flex", alignItems: "center", justifyContent: "center",
        }} onClick={() => { setCloudModal(null); setCloudFormVals({}); }}>
          <div style={{
            background: C.card, border: `0.5px solid ${cloudModal.color}40`,
            borderRadius: 16, padding: 28, width: 400, maxWidth: "90vw",
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
              <span style={{ fontSize: 26 }}>{cloudModal.icon}</span>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>Connect {cloudModal.name}</div>
                <div style={{ fontSize: 10, color: C.muted }}>{cloudModal.desc}</div>
              </div>
            </div>

            {cloudModal.fields.map(field => (
              <div key={field.key} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, color: C.muted, marginBottom: 5, fontWeight: 600 }}>{field.label}</div>
                <input
                  type={field.password ? "password" : "text"}
                  value={cloudFormVals[field.key] || ""}
                  onChange={e => setCloudFormVals(v => ({ ...v, [field.key]: e.target.value }))}
                  placeholder={field.placeholder}
                  style={{
                    width: "100%", padding: "8px 12px", borderRadius: 8, fontSize: 12,
                    background: "#080808", border: `0.5px solid rgba(255,255,255,0.15)`,
                    color: C.text, outline: "none", boxSizing: "border-box",
                  }}
                />
              </div>
            ))}

            <div style={{
              fontSize: 10, color: C.muted, lineHeight: 1.6, marginBottom: 18,
              padding: "10px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 8,
            }}><Icon name="🔐" size={12} style={{marginRight:6,verticalAlign:"middle"}} />Credentials are stored only in your browser's localStorage. They are never sent to any server except the one you configure.
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={saveCloudConnection} style={{
                flex: 1, padding: "9px 0", borderRadius: 8, fontSize: 12, fontWeight: 700,
                background: `${cloudModal.color}22`, border: `0.5px solid ${cloudModal.color}`,
                color: cloudModal.color, cursor: "pointer",
              }}>Save Connection</button>
              <button onClick={() => { setCloudModal(null); setCloudFormVals({}); }} style={{
                padding: "9px 16px", borderRadius: 8, fontSize: 12,
                background: "rgba(255,255,255,0.05)", border: "none", color: C.muted, cursor: "pointer",
              }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── File Edit Modal ── */}
      {editingFile && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 9999,
          display: "flex", alignItems: "center", justifyContent: "center",
        }} onClick={() => setEditingFile(null)}>
          <div style={{
            background: C.card, border: `0.5px solid ${C.border}`,
            borderRadius: 14, padding: 24, width: 360,
          }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 16 }}>Edit File</div>
            <div style={{ fontSize: 10, color: C.muted, marginBottom: 6 }}>File Name</div>
            <input value={editFileName} onChange={e => setEditFileName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && saveFileName()} autoFocus
              style={{
                width: "100%", padding: "8px 12px", borderRadius: 8, fontSize: 12,
                background: "#000", border: `0.5px solid rgba(255,255,255,0.15)`,
                color: C.text, outline: "none", boxSizing: "border-box", marginBottom: 12,
              }} />

            {/* Persistence indicator */}
            <div style={{
              fontSize: 10, color: editingFile.stored ? C.teal : C.orange,
              marginBottom: 16, padding: "6px 10px", borderRadius: 7,
              background: editingFile.stored ? `${C.teal}12` : `${C.orange}12`,
            }}>
              {editingFile.stored ? "✓ Saved locally — persists across sessions" : "⚠️ Session-only — will be lost on refresh"}
            </div>

            {editingFile.type === "Images" && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, color: C.muted, marginBottom: 8 }}>Image Actions</div>
                <div style={{ display: "flex", gap: 6 }}>
                  {["↓ Download"].map(action => (
                    <button key={action} onClick={() => {
                      const a = document.createElement("a");
                      a.href = editingFile.url; a.download = editFileName; a.click();
                    }} style={{
                      padding: "5px 10px", borderRadius: 6, background: "rgba(255,255,255,0.05)",
                      border: `0.5px solid ${C.border}`, color: C.muted, fontSize: 10, cursor: "pointer",
                    }}>
                      {action}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={saveFileName}
                style={{
                  flex: 1, padding: "8px 0", borderRadius: 8, fontSize: 12, fontWeight: 600,
                  background: `${C.teal}22`, border: `0.5px solid ${C.teal}`, color: C.teal, cursor: "pointer",
                }}>Save</button>
              <button onClick={() => setEditingFile(null)}
                style={{
                  padding: "8px 16px", borderRadius: 8, fontSize: 12,
                  background: "rgba(255,255,255,0.05)", border: "none", color: C.muted, cursor: "pointer",
                }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Storage Bar ──────────────────────────────────────────────────────────────
function StorageBar({ usedGB, totalGB, color }) {
  const pct = Math.min((usedGB / totalGB) * 100, 100);
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10, marginBottom: 8,
      padding: "7px 14px", borderRadius: 8,
      background: C.card2, border: `0.5px solid ${C.border}`,
    }}>
      <Icon name="Local Storage" size={10} />
      <div style={{ flex: 1, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.07)" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: `linear-gradient(90deg,${color},${C.blue})`, borderRadius: 2, transition: "width .3s" }} />
      </div>
      <span style={{ fontSize: 10, color: C.text, fontWeight: 600, flexShrink: 0 }}>
        {usedGB < 0.01 ? "0 GB" : `${usedGB.toFixed(2)} GB`} / {totalGB} GB
      </span>
    </div>
  );
}

// ── Empty State ──────────────────────────────────────────────────────────────
function EmptyState({ tab, onUpload, inputId = "lifeos-media-upload" }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      height: 260, border: "1.5px dashed rgba(255,255,255,0.08)", borderRadius: 16, gap: 12,
    }}>
      <div style={{ fontSize: 48 }}>{TAB_ICONS[tab] || "📁"}</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>No {tab.toLowerCase()} yet</div>
      <div style={{ fontSize: 11, color: C.muted }}>Upload your first {tab.toLowerCase().slice(0, -1)} to get started</div>
      <label htmlFor={inputId} style={{
        padding: "8px 22px", borderRadius: 20, fontSize: 12, fontWeight: 700,
        background: `linear-gradient(135deg,${C.teal},${C.blue})`,
        border: "none", color: "#000", cursor: "pointer", marginTop: 4,
        display: "inline-block", userSelect: "none",
      }}>
        + Upload {tab.slice(0, -1)}
      </label>
    </div>
  );
}

// ── Albums View ──────────────────────────────────────────────────────────────
function AlbumsView({
  tab, albums, files, activeAlbum, setActiveAlbum, tabFiles,
  showNewAlbum, setShowNewAlbum, newAlbumName, setNewAlbumName,
  newAlbumColor, setNewAlbumColor, createAlbum, deleteAlbum,
  editingAlbumId, setEditingAlbumId, editAlbumName, setEditAlbumName,
  saveAlbumName, triggerCoverUpload,
  onOpen, onDelete, onEdit, albums_all, assignToAlbum,
}) {
  if (activeAlbum) {
    const alb = albums.find(a => a.id === activeAlbum);
    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <button onClick={() => setActiveAlbum(null)}
            style={{ fontSize: 11, color: C.teal, background: "none", border: "none", cursor: "pointer" }}><Icon name="←" size={12} style={{marginRight:6,verticalAlign:"middle"}} />Albums
          </button>
          <span style={{ color: C.dim }}>/</span>
          <span style={{ fontSize: 12, color: C.text, fontWeight: 600 }}>{alb?.name}</span>
        </div>
        {tabFiles.length === 0 ? (
          <EmptyState tab={tab} onUpload={() => {}} />
        ) : (
          <FileGrid files={tabFiles} tab={tab} onOpen={onOpen} onDelete={onDelete} onEdit={onEdit}
            albums={albums_all} assignToAlbum={assignToAlbum} />
        )}
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 12, marginBottom: 16 }}>
        {albums.map(a => {
          const count = files.filter(f => f.albumId === a.id).length;
          const isEditing = editingAlbumId === a.id;
          return (
            <div key={a.id}
              style={{
                background: C.card2, border: `0.5px solid ${a.color}30`,
                borderRadius: 12, overflow: "hidden", cursor: "pointer", position: "relative",
              }}
              onClick={() => !isEditing && setActiveAlbum(a.id)}>
              {/* Cover */}
              <div style={{ height: 100, background: a.cover ? "none" : a.color + "18", position: "relative", overflow: "hidden" }}>
                {a.cover && <img src={a.cover} alt={a.name} style={{ width: "100%", height: "100%", objectFit: "cover", opacity: .8 }} />}
                {!a.cover && (
                  <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ fontSize: 36 }}>{TAB_ICONS[a.type] || "📁"}</div>
                  </div>
                )}
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom,transparent 40%,rgba(0,0,0,0.7))" }} />
                {/* Actions */}
                <div style={{ position: "absolute", top: 7, right: 7, display: "flex", gap: 4 }}
                  onClick={e => e.stopPropagation()}>
                  <button title="Change cover" onClick={() => triggerCoverUpload(a.id)}
                    style={{ width: 24, height: 24, borderRadius: 6, background: "rgba(0,0,0,0.7)", border: "none", color: "#ccc", fontSize: 11, cursor: "pointer" }}><Icon name="📷" size={14} /></button>
                  <button title="Rename" onClick={() => { setEditingAlbumId(a.id); setEditAlbumName(a.name); }}
                    style={{ width: 24, height: 24, borderRadius: 6, background: "rgba(0,0,0,0.7)", border: "none", color: "#ccc", fontSize: 11, cursor: "pointer" }}><Icon name="✏" size={14} /></button>
                  <button title="Delete" onClick={() => deleteAlbum(a.id)}
                    style={{ width: 24, height: 24, borderRadius: 6, background: "rgba(0,0,0,0.7)", border: "none", color: C.red, fontSize: 11, cursor: "pointer" }}><Icon name="✕" size={14} /></button>
                </div>
              </div>
              <div style={{ padding: "8px 12px" }} onClick={e => e.stopPropagation()}>
                {isEditing ? (
                  <input value={editAlbumName} onChange={e => setEditAlbumName(e.target.value)} autoFocus
                    onKeyDown={e => { if (e.key === "Enter") saveAlbumName(a.id); if (e.key === "Escape") setEditingAlbumId(null); }}
                    onBlur={() => saveAlbumName(a.id)}
                    style={{
                      width: "100%", background: "transparent", border: `0.5px solid ${a.color}`,
                      borderRadius: 5, color: C.text, fontSize: 12, fontWeight: 600, padding: "2px 6px", outline: "none",
                    }} />
                ) : (
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{a.name}</div>
                )}
                <div style={{ fontSize: 10, color: a.color, marginTop: 2 }}>{count} file{count !== 1 ? "s" : ""}</div>
              </div>
            </div>
          );
        })}

        {/* New album button */}
        {!showNewAlbum ? (
          <button onClick={() => setShowNewAlbum(true)}
            style={{
              height: 160, display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", gap: 8, cursor: "pointer",
              border: "1.5px dashed rgba(0,200,150,0.25)", borderRadius: 12,
              background: "transparent",
            }}>
            <div style={{ fontSize: 26, color: C.teal }}>+</div>
            <div style={{ fontSize: 11, color: C.teal }}>New Album</div>
          </button>
        ) : (
          <div style={{ background: C.card2, border: `0.5px solid ${C.border}`, borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
            <input value={newAlbumName} onChange={e => setNewAlbumName(e.target.value)} autoFocus
              placeholder="Album name..." onKeyDown={e => e.key === "Enter" && createAlbum()}
              style={{
                padding: "6px 10px", borderRadius: 7, background: "#000",
                border: `0.5px solid rgba(255,255,255,0.15)`, color: C.text, fontSize: 12, outline: "none",
              }} />
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {ALBUM_COLORS.map(col => (
                <div key={col} onClick={() => setNewAlbumColor(col)}
                  style={{
                    width: 20, height: 20, borderRadius: "50%", background: col, cursor: "pointer",
                    border: newAlbumColor === col ? "2.5px solid #fff" : "2px solid transparent",
                    boxShadow: newAlbumColor === col ? `0 0 8px ${col}` : "none",
                  }} />
              ))}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={createAlbum}
                style={{
                  flex: 1, padding: "5px 0", borderRadius: 7, fontSize: 11, fontWeight: 600,
                  background: `${C.teal}22`, border: `0.5px solid ${C.teal}`, color: C.teal, cursor: "pointer",
                }}>Create</button>
              <button onClick={() => { setShowNewAlbum(false); setNewAlbumName(""); }}
                style={{
                  padding: "5px 10px", borderRadius: 7, fontSize: 11,
                  background: "rgba(255,255,255,0.05)", border: "none", color: C.muted, cursor: "pointer",
                }}>Cancel</button>
            </div>
          </div>
        )}
      </div>

      {/* Unsorted files */}
      {files.filter(f => f.type === tab && !f.albumId).length > 0 && (
        <div>
          <div style={{ fontSize: 10, color: C.dim, marginBottom: 8, textTransform: "uppercase", letterSpacing: ".08em" }}>Unsorted</div>
          <FileGrid
            files={files.filter(f => f.type === tab && !f.albumId)}
            tab={tab} onOpen={onOpen} onDelete={onDelete} onEdit={onEdit}
            albums={albums_all} assignToAlbum={assignToAlbum}
          />
        </div>
      )}

      {albums.length === 0 && files.filter(f => f.type === tab).length === 0 && (
        <EmptyState tab={tab} onUpload={() => {}} />
      )}
    </div>
  );
}

// ── File Grid ────────────────────────────────────────────────────────────────
function FileGrid({ files, tab, onOpen, onDelete, onEdit, albums, assignToAlbum }) {
  const [assignMenu, setAssignMenu] = useState(null); // fileId

  if (files.length === 0) return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      height: 180, border: "1.5px dashed rgba(255,255,255,0.07)", borderRadius: 14, gap: 8,
    }}>
      <div style={{ fontSize: 28 }}>{TAB_ICONS[tab] || "📁"}</div>
      <div style={{ fontSize: 12, color: C.dim }}>No {tab.toLowerCase()} here yet</div>
    </div>
  );

  // Images grid
  if (tab === "Images") return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(155px,1fr))", gap: 10 }}>
      {files.map(f => (
        <ImageCard key={f.id} file={f} onOpen={onOpen} onDelete={onDelete} onEdit={onEdit}
          albums={albums} assignToAlbum={assignToAlbum}
          assignMenu={assignMenu} setAssignMenu={setAssignMenu} />
      ))}
    </div>
  );

  // Videos grid
  if (tab === "Videos") return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(210px,1fr))", gap: 10 }}>
      {files.map(f => (
        <div key={f.id} style={{ background: C.card2, border: `0.5px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
          <div style={{ height: 115, background: "#000", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", position: "relative" }}
            onClick={() => f.url && onOpen(f)}>
            {f.url && <video src={f.url} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted />}
            {!f.url && <Icon name="🎬" size={32} />}
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.3)" }}>
              <div style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(0,200,150,0.8)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ width: 0, height: 0, borderLeft: "13px solid white", borderTop: "8px solid transparent", borderBottom: "8px solid transparent", marginLeft: 3 }} />
              </div>
            </div>
          </div>
          <FileRow file={f} onDelete={onDelete} onEdit={onEdit} />
        </div>
      ))}
    </div>
  );

  // Music list
  if (tab === "Music") return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {files.map(f => (
        <div key={f.id} style={{
          background: C.card2, border: `0.5px solid ${C.border}`,
          borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12,
        }}>
          <Icon name="🎵" size={22} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{f.name}</div>
            <div style={{ fontSize: 10, color: C.dim }}>{f.sizeStr} · {f.date}</div>
            {f.url && <audio controls src={f.url} style={{ width: "100%", height: 26, marginTop: 6 }} />}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => onEdit(f)} style={{ padding: "4px 8px", borderRadius: 6, background: "rgba(255,255,255,0.05)", border: "none", color: C.muted, fontSize: 10, cursor: "pointer" }}><Icon name="✏" size={14} /></button>
            <button onClick={() => onDelete(f.id)} style={{ padding: "4px 8px", borderRadius: 6, background: `rgba(255,79,94,0.1)`, border: "none", color: C.red, fontSize: 10, cursor: "pointer" }}><Icon name="✕" size={14} /></button>
          </div>
        </div>
      ))}
    </div>
  );

  // Documents + Files list
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {files.map(f => (
        <div key={f.id} style={{
          background: C.card2, border: `0.5px solid ${C.border}`,
          borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", gap: 12,
        }}>
          <span style={{ fontSize: 20, flexShrink: 0 }}>{fileIconFor(f.name)}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</div>
            <div style={{ fontSize: 10, color: C.dim }}>{f.sizeStr} · {f.date}</div>
          </div>
          {f.url && f.url !== "#" && (
            <a href={f.url} download={f.name}
              style={{ padding: "5px 10px", borderRadius: 7, background: `rgba(74,179,244,0.1)`, border: `0.5px solid rgba(74,179,244,0.3)`, color: C.blue, fontSize: 10, textDecoration: "none" }}><Icon name="↓" size={14} /></a>
          )}
          <button onClick={() => onEdit(f)} style={{ padding: "5px 10px", borderRadius: 7, background: "rgba(255,255,255,0.05)", border: "none", color: C.muted, fontSize: 10, cursor: "pointer" }}><Icon name="✏" size={14} /></button>
          <button onClick={() => onDelete(f.id)} style={{ padding: "5px 10px", borderRadius: 7, background: `rgba(255,79,94,0.1)`, border: "none", color: C.red, fontSize: 10, cursor: "pointer" }}><Icon name="✕" size={14} /></button>
        </div>
      ))}
    </div>
  );

  // Video Generator
  if (tab === "Video Generator") {
    const imageFiles = files.filter(f => f.type === "Images");
    return (
      <VideoGeneratorUI
        mediaLibrary={imageFiles}
        onSaveVideo={handleSaveGeneratedVideo}
      />
    );
  }

  // Image Studio
  if (tab === "Image Studio") {
    const imageFiles = files.filter(f => f.type === "Images");
    return (
      <ImageStudioUI
        mediaLibrary={imageFiles}
        onSaveImage={handleSaveImage}
        onClose={() => setTab("Images")}
      />
    );
  }

  // Writing Hub
  if (tab === "Writing Hub") {
    return (
      <WritingHubUI
        onSaveDocument={handleSaveDocument}
        onClose={() => setTab("Documents")}
      />
    );
  }
}

// ── Image Card ────────────────────────────────────────────────────────�