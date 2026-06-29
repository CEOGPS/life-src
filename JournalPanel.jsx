import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";
import Icon from "@/components/lifeos/icons/Icon";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const C = { blue: "#4ab3f4", purple: "#8b7fff", teal: "#00c896", red: "#ff4f5e" };

export default function JournalPanel() {
  const [notebooks, setNotebooks] = useState([]);
  const [pages, setPages] = useState([]);
  const [selectedNotebook, setSelectedNotebook] = useState(null);
  const [selectedPage, setSelectedPage] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const uid = "chris-green";
    const { data: nb } = await supabase.from('notebooks').select('*').eq('user_id', uid);
    if (nb) { setNotebooks(nb); setSelectedNotebook(nb[0]?.id); }
    
    if (nb?.[0]) {
      const { data: p } = await supabase.from('journal_pages').select('*').eq('notebook_id', nb[0].id).order('date', { ascending: false });
      if (p) setPages(p);
    }
  }

  async function createPage() {
    const newPage = {
      id: Date.now().toString(),
      notebook_id: selectedNotebook,
      user_id: "chris-green",
      title: "Untitled Entry",
      content: "",
      mood: "✦",
      date: new Date().toISOString().split("T")[0]
    };
    const { data } = await supabase.from('journal_pages').insert(newPage).select();
    if (data) { setPages([data[0], ...pages]); setSelectedPage(data[0].id); setTitle(data[0].title); setContent(""); }
  }

  // OneNote Sync Simulation
  async function syncToOneNote() {
    setSyncing(true);
    console.log("[Journal] Syncing to Microsoft Graph API...");
    // TODO: Implement Graph API call here:
    // POST https://graph.microsoft.com/v1.0/me/onenote/pages
    // Body: { "title": title, "content": `<html><body>${content}</body></html>` }
    setTimeout(() => setSyncing(false), 1500);
  }

  return (
    <div style={{ display: "flex", height: "calc(100vh - 52px)" }}>
      {/* Sidebar: Notebooks & Pages */}
      <div style={{ width: 240, borderRight: "0.5px solid rgba(255,255,255,0.07)", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: 12, borderBottom: "0.5px solid rgba(255,255,255,0.07)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#6aaedd" }}>NOTEBOOKS</div>
          {notebooks.map(nb => (
            <div key={nb.id} onClick={() => setSelectedNotebook(nb.id)}
              style={{ padding: "6px 8px", margin: "2px 0", borderRadius: 6, cursor: "pointer", background: selectedNotebook === nb.id ? "rgba(74,179,244,0.1)" : "transparent", fontSize: 12, color: "#f0ede8" }}>
              {nb.title}
            </div>
          ))}
        </div>
        
        <div style={{ flex: 1, overflowY: "auto", padding: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#6aaedd", marginBottom: 8, display:"flex", justifyContent:"space-between" }}>
            PAGES
            <button onClick={createPage} style={{ fontSize: 10, background: "transparent", border: "none", color: C.blue, cursor: "pointer" }}>+</button>
          </div>
          {pages.map(p => (
            <div key={p.id} onClick={() => { setSelectedPage(p.id); setTitle(p.title); setContent(p.content); }}
              style={{ padding: "8px", borderRadius: 6, cursor: "pointer", marginBottom: 4, background: selectedPage === p.id ? "rgba(139,127,255,0.1)" : "transparent" }}>
              <div style={{ fontSize: 12, color: "#f0ede8" }}>{p.title}</div>
              <div style={{ fontSize: 9, color: "#6aaedd" }}>{p.date} · {p.mood}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Editor Area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: 20, background: "#13141f" }}>
        {selectedPage ? (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <input value={title} onChange={e => setTitle(e.target.value)}
                style={{ background: "transparent", border: "none", color: "#f0ede8", fontSize: 20, fontWeight: 800, width: "100%", outline: "none" }} />
              <button onClick={syncToOneNote} style={{ padding: "6px 12px", borderRadius: 6, background: syncing ? "rgba(0,200,150,0.1)" : "rgba(0,120,212,0.1)", border: "1px solid #0078D4", color: "#0078D4", fontSize: 11, cursor: "pointer" }}>
                {syncing ? "Syncing..." : "Export to OneNote"}
              </button>
            </div>
            <textarea value={content} onChange={e => setContent(e.target.value)}
              style={{ flex: 1, background: "transparent", border: "none", color: "#c8c8d0", fontSize: 14, lineHeight: 1.7, resize: "none", outline: "none", fontFamily: "monospace" }}
              placeholder="Start writing..." />
          </>
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#6aaedd" }}>Select or create a page</div>
        )}
      </div>
    </div>
  );
}