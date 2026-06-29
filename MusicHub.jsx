import { useState, useRef, useEffect, useCallback } from "react";
import Icon from "@/components/lifeos/icons/Icon";

// ─── THEME ─────────────────────────────────────────────────────────────────
const C = {
  bg:     "#080910",
  panel:  "#0d0e17",
  card:   "#13141f",
  border: "rgba(255,255,255,0.07)",
  blue:   "#4ab3f4",
  purple: "#8b7fff",
  pink:   "#ff6b9d",
  teal:   "#00c896",
  orange: "#ff8c42",
  red:    "#ff4f5e",
  text:   "#f0ede8",
  muted:  "#6aaedd",
  dim:    "#3a4a5a",
};

const card = { background: C.card, border: `0.5px solid ${C.border}`, borderRadius: 12 };

// ─── PERSISTENCE ────────────────────────────────────────────────────────────
function loadLS(key, def) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def; } catch { return def; }
}
function saveLS(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

const DEFAULT_PLAYLISTS = [
  { id: "pl1", name: "Playlist 1", cover: null, color: C.blue,   tracks: [] },
  { id: "pl2", name: "Playlist 2", cover: null, color: C.purple, tracks: [] },
  { id: "pl3", name: "Playlist 3", cover: null, color: C.teal,   tracks: [] },
  { id: "pl4", name: "Playlist 4", cover: null, color: C.orange, tracks: [] },
];

// ─── AI MUSIC HELPER ────────────────────────────────────────────────────────
const MUSIC_SYS = "You are a music AI assistant for Chris Green's LifeOS1 Music Hub. Chris plays guitar and loves reggae, blues, soul, and synthwave. Be specific, helpful, and creative.";

async function callAI(prompt) {
  try {
    const res = await fetch("https://lifeos1.ceogps.workers.dev/api/ai/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, system: MUSIC_SYS, max_tokens: 800 }),
    });
    const data = await res.json();
    return data?.text || "[No response]";
  } catch (e) {
    return `[Error: ${e.message}]`;
  }
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function MusicHub() {
  const [playlists, setPlaylists]   = useState(() => loadLS("lifeos_music_playlists", DEFAULT_PLAYLISTS));
  const [tracks, setTracks]         = useState(() => loadLS("lifeos_music_tracks", []));
  const [activePl, setActivePl]     = useState(null);  // playlist id being viewed
  const [nowPlaying, setNowPlaying] = useState(null);   // track id
  const [isPlaying, setIsPlaying]   = useState(false);
  const [progress, setProgress]     = useState(0);
  const [volume, setVolume]         = useState(0.8);
  const [tab, setTab]               = useState("library"); // "library" | "ai" | "discover"
  const [editPl, setEditPl]         = useState(null);   // playlist id being renamed
  const [editName, setEditName]     = useState("");
  const [aiPrompt, setAiPrompt]     = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [aiLoading, setAiLoading]   = useState(false);
  const [search, setSearch]         = useState("");

  const audioRef  = useRef(null);
  const fileRef   = useRef(null);
  const coverRef  = useRef(null);
  const coverPlId = useRef(null);

  // Persist playlists and tracks
  useEffect(() => { saveLS("lifeos_music_playlists", playlists); }, [playlists]);
  useEffect(() => { saveLS("lifeos_music_tracks", tracks); }, [tracks]);

  // Audio progress
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const tick = () => setProgress(audio.currentTime / (audio.duration || 1));
    audio.addEventListener("timeupdate", tick);
    audio.addEventListener("ended", nextTrack);
    return () => { audio.removeEventListener("timeupdate", tick); audio.removeEventListener("ended", nextTrack); };
  });

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.volume = volume;
  }, [volume]);

  // Sync playback
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !nowPlaying) return;
    const track = tracks.find(t => t.id === nowPlaying);
    if (!track) return;
    audio.src = track.url;
    if (isPlaying) audio.play().catch(() => {});
  }, [nowPlaying]);

  const currentTrack = tracks.find(t => t.id === nowPlaying);

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio || !nowPlaying) return;
    if (isPlaying) { audio.pause(); setIsPlaying(false); }
    else { audio.play().catch(() => {}); setIsPlaying(true); }
  }

  function playTrack(id) {
    if (nowPlaying === id) { togglePlay(); return; }
    setNowPlaying(id);
    setIsPlaying(true);
    if (audioRef.current) {
      const t = tracks.find(t => t.id === id);
      if (t) { audioRef.current.src = t.url; audioRef.current.play().catch(() => {}); }
    }
  }

  function nextTrack() {
    const pl = playlists.find(p => p.tracks.includes(nowPlaying));
    const list = pl ? pl.tracks : tracks.map(t => t.id);
    const idx = list.indexOf(nowPlaying);
    const next = list[(idx + 1) % list.length];
    if (next) playTrack(next);
  }

  function prevTrack() {
    const pl = playlists.find(p => p.tracks.includes(nowPlaying));
    const list = pl ? pl.tracks : tracks.map(t => t.id);
    const idx = list.indexOf(nowPlaying);
    const prev = list[(idx - 1 + list.length) % list.length];
    if (prev) playTrack(prev);
  }

  function handleSeek(e) {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    audio.currentTime = ratio * audio.duration;
  }

  // Upload audio files
  function handleUpload(e) {
    Array.from(e.target.files || []).forEach(f => {
      const reader = new FileReader();
      reader.onload = () => {
        const url = reader.result; // data: URL for persistence across reloads
        const id = `track_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        const name = f.name.replace(/\.[^.]+$/, "");
        const newTrack = { id, name, artist: "Unknown", url, size: `${(f.size / 1024 / 1024).toFixed(1)} MB`, added: new Date().toLocaleDateString() };
        setTracks(prev => [...prev, newTrack]);
        if (activePl) {
          setPlaylists(prev => prev.map(p => p.id === activePl ? { ...p, tracks: [...p.tracks, id] } : p));
        }
      };
      reader.readAsDataURL(f);
    });
    e.target.value = "";
  }

  // Cover art upload
  function handleCoverUpload(e) {
    const f = e.target.files?.[0];
    if (!f || !coverPlId.current) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result;
      setPlaylists(prev => prev.map(p => p.id === coverPlId.current ? { ...p, cover: url } : p));
    };
    reader.readAsDataURL(f);
    e.target.value = "";
  }

  function addTrackToPlaylist(plId, trackId) {
    setPlaylists(prev => prev.map(p => {
      if (p.id !== plId) return p;
      if (p.tracks.includes(trackId)) return p;
      return { ...p, tracks: [...p.tracks, trackId] };
    }));
  }

  function removeTrackFromPlaylist(plId, trackId) {
    setPlaylists(prev => prev.map(p =>
      p.id === plId ? { ...p, tracks: p.tracks.filter(t => t !== trackId) } : p
    ));
  }

  function deleteTrack(id) {
    setTracks(prev => prev.filter(t => t.id !== id));
    setPlaylists(prev => prev.map(p => ({ ...p, tracks: p.tracks.filter(t => t !== id) })));
    if (nowPlaying === id) { setNowPlaying(null); setIsPlaying(false); }
  }

  function renamePlaylist(id, name) {
    setPlaylists(prev => prev.map(p => p.id === id ? { ...p, name } : p));
  }

  async function askAI() {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    setAiResponse("");
    const res = await callAI(aiPrompt);
    setAiResponse(res);
    setAiLoading(false);
  }

  const activePlData = playlists.find(p => p.id === activePl);
  const filteredTracks = tracks.filter(t =>
    search === "" || t.name.toLowerCase().includes(search.toLowerCase()) || (t.artist || "").toLowerCase().includes(search.toLowerCase())
  );
  const plTracks = activePlData ? activePlData.tracks.map(id => tracks.find(t => t.id === id)).filter(Boolean) : [];

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: C.bg, overflow: "hidden" }}>
      <audio ref={audioRef} />
      <input ref={fileRef} type="file" accept="audio/*" multiple style={{ display: "none" }} onChange={handleUpload} />
      <input ref={coverRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleCoverUpload} />

      {/* Header */}
      <div style={{ padding: "16px 24px 0", flexShrink: 0, borderBottom: `0.5px solid ${C.border}` }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}><Icon name="🎵" size={12} style={{marginRight:6,verticalAlign:"middle"}} />Music Hub</div>
            <div style={{ fontSize: 11, color: C.muted }}>Your music, your playlists, your vibe</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tracks..."
              style={{ padding: "6px 12px", borderRadius: 20, border: `0.5px solid ${C.border}`, background: C.card, fontSize: 11, color: C.text, outline: "none", width: 160 }} />
            <button onClick={() => { setActivePl(null); fileRef.current?.click(); }}
              style={{ padding: "7px 16px", borderRadius: 20, background: `linear-gradient(135deg,${C.teal},${C.blue})`, border: "none", color: "#000", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
              + Add Music
            </button>
          </div>
        </div>
        <div style={{ display: "flex", gap: 3 }}>
          {[["library","📚","Library"],["ai","🤖","AI Assistant"],["discover","🔍","Discover"]].map(([id, icon, label]) => (
            <button key={id} onClick={() => setTab(id)}
              style={{ padding: "8px 18px", borderRadius: "8px 8px 0 0", border: "none", cursor: "pointer", fontSize: 11, fontWeight: tab === id ? 700 : 400,
                background: tab === id ? C.card : "transparent", color: tab === id ? C.blue : C.muted,
                borderBottom: tab === id ? `2px solid ${C.teal}` : "2px solid transparent", transition: "all .15s" }}>
              {icon} {label}
            </button>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* Tab: Library */}
        {tab === "library" && (
          <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
            {/* Playlists sidebar */}
            <div style={{ width: 220, borderRight: `0.5px solid ${C.border}`, overflowY: "auto", padding: 16, flexShrink: 0 }}>
              <div style={{ fontSize: 10, color: C.dim, letterSpacing: ".08em", fontWeight: 600, marginBottom: 10 }}>PLAYLISTS</div>
              {playlists.map(pl => (
                <div key={pl.id}
                  onClick={() => setActivePl(activePl === pl.id ? null : pl.id)}
                  style={{ ...card, marginBottom: 8, cursor: "pointer", overflow: "hidden",
                    border: activePl === pl.id ? `0.5px solid ${pl.color}60` : `0.5px solid ${C.border}`,
                    boxShadow: activePl === pl.id ? `0 0 12px ${pl.color}20` : "none" }}>
                  {/* Cover art */}
                  <div style={{ height: 80, background: pl.cover ? "none" : pl.color + "22", position: "relative", overflow: "hidden" }}>
                    {pl.cover
                      ? <img src={pl.cover} alt={pl.name} style={{ width: "100%", height: "100%", objectFit: "cover", opacity: .8 }} />
                      : <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}><Icon name="🎵" size={14} /></div>
                    }
                    {/* Cover upload button */}
                    <button
                      onClick={e => { e.stopPropagation(); coverPlId.current = pl.id; coverRef.current?.click(); }}
                      style={{ position: "absolute", bottom: 4, right: 4, padding: "2px 6px", borderRadius: 5, background: "rgba(0,0,0,0.7)", border: "none", color: "#ccc", fontSize: 9, cursor: "pointer", opacity: 0.7 }}><Icon name="📷" size={14} /></button>
                  </div>
                  <div style={{ padding: "8px 10px" }}>
                    {editPl === pl.id ? (
                      <input
                        value={editName}
                        onClick={e => e.stopPropagation()}
                        onChange={e => setEditName(e.target.value)}
                        onBlur={() => { renamePlaylist(pl.id, editName); setEditPl(null); }}
                        onKeyDown={e => { if (e.key === "Enter") { renamePlaylist(pl.id, editName); setEditPl(null); } }}
                        autoFocus
                        style={{ width: "100%", background: "none", border: `0.5px solid ${pl.color}`, borderRadius: 5, color: C.text, fontSize: 11, padding: "2px 6px", outline: "none", boxSizing: "border-box" }}
                      />
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ flex: 1, fontSize: 11, fontWeight: 600, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pl.name}</div>
                        <button onClick={e => { e.stopPropagation(); setEditPl(pl.id); setEditName(pl.name); }}
                          style={{ background: "none", border: "none", color: C.muted, fontSize: 10, cursor: "pointer", padding: 2 }}><Icon name="✏" size={14} /></button>
                      </div>
                    )}
                    <div style={{ fontSize: 9, color: pl.color, marginTop: 2 }}>{pl.tracks.length} tracks</div>
                  </div>
                </div>
              ))}
              <div style={{ marginTop: 8, fontSize: 10, color: C.dim }}>
                Click a playlist to open it
              </div>
            </div>

            {/* Track list */}
            <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
              {activePl ? (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                    <button onClick={() => setActivePl(null)}
                      style={{ background: "none", border: "none", color: C.teal, fontSize: 11, cursor: "pointer" }}><Icon name="←" size={12} style={{marginRight:6,verticalAlign:"middle"}} />Back</button>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{activePlData?.name}</div>
                    <button onClick={() => { fileRef.current?.click(); }}
                      style={{ marginLeft: "auto", padding: "5px 12px", borderRadius: 8, background: C.teal + "22", border: `0.5px solid ${C.teal}`, color: C.teal, fontSize: 11, cursor: "pointer" }}>
                      + Add Song
                    </button>
                  </div>
                  {plTracks.length === 0 ? (
                    <EmptyDrop onAdd={() => fileRef.current?.click()} label="Drop music here or click + Add Song" />
                  ) : (
                    <TrackList tracks={plTracks} nowPlaying={nowPlaying} isPlaying={isPlaying} onPlay={playTrack}
                      onDelete={id => removeTrackFromPlaylist(activePl, id)} deleteLabel="Remove" />
                  )}
                </>
              ) : (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>All Tracks</div>
                    <div style={{ fontSize: 10, color: C.muted }}>{filteredTracks.length} songs</div>
                  </div>
                  {filteredTracks.length === 0 ? (
                    <EmptyDrop onAdd={() => fileRef.current?.click()} label="No music yet — click + Add Music to upload songs" />
                  ) : (
                    <TrackList tracks={filteredTracks} nowPlaying={nowPlaying} isPlaying={isPlaying} onPlay={playTrack}
                      onDelete={deleteTrack} playlists={playlists} onAddToPlaylist={addTrackToPlaylist} />
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Tab: AI Assistant */}
        {tab === "ai" && (
          <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
            <div style={{ maxWidth: 700, margin: "0 auto" }}>
              <div style={{ ...card, padding: 20, marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 6 }}><Icon name="🤖" size={12} style={{marginRight:6,verticalAlign:"middle"}} />Music AI Assistant</div>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 16 }}>Ask for song recommendations, guitar tips, playlist ideas, chord progressions, anything music-related.</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input value={aiPrompt} onChange={e => setAiPrompt(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && !e.shiftKey && askAI()}
                    placeholder="E.g. Suggest reggae songs similar to Bob Marley..."
                    style={{ flex: 1, padding: "10px 14px", borderRadius: 10, border: `0.5px solid ${C.border}`, background: "#0a0b14", color: C.text, fontSize: 12, outline: "none" }} />
                  <button onClick={askAI} disabled={aiLoading}
                    style={{ padding: "10px 20px", borderRadius: 10, background: aiLoading ? C.dim : C.teal, border: "none", color: "#000", fontSize: 12, fontWeight: 700, cursor: aiLoading ? "not-allowed" : "pointer" }}>
                    {aiLoading ? "..." : "Ask"}
                  </button>
                </div>
              </div>
              {aiResponse && (
                <div style={{ ...card, padding: 20 }}>
                  <div style={{ fontSize: 11, color: C.teal, marginBottom: 8, fontWeight: 600 }}>AI Response</div>
                  <div style={{ fontSize: 12, color: C.text, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{aiResponse}</div>
                </div>
              )}
              <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 8 }}>
                {["Recommend reggae songs","Guitar chord progression in G","Best blues songs for practice","Create a study playlist","Synthwave artists like Kavinsky"].map(s => (
                  <button key={s} onClick={() => setAiPrompt(s)}
                    style={{ padding: "5px 12px", borderRadius: 20, background: C.card, border: `0.5px solid ${C.border}`, color: C.muted, fontSize: 10, cursor: "pointer", transition: "all .15s" }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab: Discover */}
        {tab === "discover" && (
          <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
            <div style={{ maxWidth: 700, margin: "0 auto" }}>
              <div style={{ ...card, padding: 20, textAlign: "center" }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}><Icon name="🎵" size={14} /></div>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 8 }}>Discover Music</div>
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 20 }}>Connect Spotify or SoundCloud to discover and stream music directly.</div>
                <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                  {[
                    { name: "Spotify", color: "#1DB954", icon: "🟢", url: "https://open.spotify.com" },
                    { name: "SoundCloud", color: "#ff5500", icon: "🔶", url: "https://soundcloud.com" },
                    { name: "YouTube Music", color: "#ff0000", icon: "▶️", url: "https://music.youtube.com" },
                  ].map(s => (
                    <a key={s.name} href={s.url} target="_blank" rel="noopener noreferrer"
                      style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 10,
                        background: s.color + "15", border: `0.5px solid ${s.color}40`, textDecoration: "none",
                        color: s.color, fontSize: 12, fontWeight: 600 }}>
                      {s.icon} {s.name} ↗
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Now Playing Bar */}
      {currentTrack && (
        <div style={{ flexShrink: 0, background: C.card, borderTop: `0.5px solid ${C.border}`, padding: "10px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {/* Track info */}
            <div style={{ minWidth: 200, maxWidth: 260 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{currentTrack.name}</div>
              <div style={{ fontSize: 10, color: C.muted }}>{currentTrack.artist || "Unknown"}</div>
            </div>

            {/* Controls */}
            <div style={{ display: "flex", alignItems: "center", gap: 16, flex: 1, justifyContent: "center" }}>
              <button onClick={prevTrack} style={{ background: "none", border: "none", color: C.muted, fontSize: 18, cursor: "pointer" }}><Icon name="⏮" size={14} /></button>
              <button onClick={togglePlay}
                style={{ width: 40, height: 40, borderRadius: "50%", background: `linear-gradient(135deg,${C.teal},${C.blue})`, border: "none", color: "#000", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {isPlaying ? "⏸" : "▶"}
              </button>
              <button onClick={nextTrack} style={{ background: "none", border: "none", color: C.muted, fontSize: 18, cursor: "pointer" }}><Icon name="⏭" size={14} /></button>
            </div>

            {/* Progress */}
            <div style={{ flex: 2, maxWidth: 400 }}>
              <div onClick={handleSeek} style={{ height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 2, cursor: "pointer", position: "relative" }}>
                <div style={{ width: `${progress * 100}%`, height: "100%", background: `linear-gradient(90deg,${C.teal},${C.blue})`, borderRadius: 2, transition: "width .1s linear" }} />
              </div>
            </div>

            {/* Volume */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 120 }}>
              <Icon name="🔊" size={14} />
              <input type="range" min={0} max={1} step={0.01} value={volume} onChange={e => setVolume(Number(e.target.value))}
                style={{ width: 80, accentColor: C.teal }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── TRACK LIST ──────────────────────────────────────────────────────────────
function TrackList({ tracks, nowPlaying, isPlaying, onPlay, onDelete, deleteLabel = "Delete", playlists, onAddToPlaylist }) {
  const [menuTrack, setMenuTrack] = useState(null);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {tracks.map(t => (
        <div key={t.id}
          style={{ background: nowPlaying === t.id ? "rgba(0,200,150,0.08)" : C.card,
            border: nowPlaying === t.id ? `0.5px solid ${C.teal}40` : `0.5px solid ${C.border}`,
            borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", gap: 12,
            transition: "all .15s", position: "relative" }}>
          <button onClick={() => onPlay(t.id)}
            style={{ width: 32, height: 32, borderRadius: "50%", background: nowPlaying === t.id ? C.teal : "rgba(255,255,255,0.08)",
              border: "none", color: nowPlaying === t.id ? "#000" : C.muted, fontSize: 14, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {nowPlaying === t.id && isPlaying ? "⏸" : "▶"}
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: nowPlaying === t.id ? C.teal : C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</div>
            <div style={{ fontSize: 10, color: C.muted }}>{t.artist || "Unknown"} {t.size ? `· ${t.size}` : ""} {t.added ? `· ${t.added}` : ""}</div>
          </div>
          {playlists && (
            <div style={{ position: "relative" }}>
              <button onClick={() => setMenuTrack(menuTrack === t.id ? null : t.id)}
                style={{ padding: "4px 8px", borderRadius: 6, background: "rgba(255,255,255,0.05)", border: `0.5px solid ${C.border}`, color: C.muted, fontSize: 10, cursor: "pointer" }}>
                + Playlist
              </button>
              {menuTrack === t.id && (
                <div style={{ position: "absolute", right: 0, bottom: 36, background: "#1a1b28", border: `0.5px solid ${C.border}`, borderRadius: 10, padding: 8, zIndex: 99, minWidth: 160 }}>
                  {playlists.map(pl => (
                    <button key={pl.id} onClick={() => { onAddToPlaylist(pl.id, t.id); setMenuTrack(null); }}
                      style={{ display: "block", width: "100%", textAlign: "left", padding: "6px 10px", background: "none", border: "none", color: pl.color, fontSize: 11, cursor: "pointer", borderRadius: 6 }}>
                      {pl.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <button onClick={() => onDelete(t.id)}
            style={{ padding: "4px 8px", borderRadius: 6, background: "rgba(255,79,94,0.1)", border: "none", color: C.red, fontSize: 10, cursor: "pointer" }}>
            {deleteLabel}
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── EMPTY DROP ZONE ─────────────────────────────────────────────────────────
function EmptyDrop({ onAdd, label }) {
  return (
    <div onClick={onAdd}
      style={{ border: `1.5px dashed rgba(0,200,150,0.2)`, borderRadius: 14, padding: 48, textAlign: "center", cursor: "pointer",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 10, transition: "all .2s" }}
      onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(0,200,150,0.5)"}
      onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(0,200,150,0.2)"}>
      <div style={{ fontSize: 36 }}><Icon name="🎵" size={14} /></div>
      <div style={{ fontSize: 13, color: C.muted }}>{label}</div>
    </div>
  );
}
