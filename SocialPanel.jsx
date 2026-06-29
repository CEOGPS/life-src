import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { kvGet, kvSet, uploadToR2 } from "@/utils/storage";
import BrandIcon from "@/components/lifeos/icons/BrandIcon";
import { saveApiKey, getApiKey, generatePKCE } from "@/api/ceogpsclient.jsx";
import { useAuth } from "@/lib/FirebaseAuthContext";

/* ─── Constants ─────────────────────────────────────────────── */
// Worker base URL — holds all platform tokens + KV. Pages has no API routes.
const WORKER = "https://lifeos1.ceogps.workers.dev";

const PLATFORMS = [
  { id:"instagram", brand:"instagram", name:"Instagram", handle:"@ceogps",      color:"#e1306c", followers:0, following:0, posts:0, likes:0, comments:0, views:0, shares:0 },
  { id:"facebook",  brand:"facebook",  name:"Facebook",  handle:"CEO GPS",      color:"#1877f2", followers:0, following:0, posts:0, likes:0, comments:0, views:0, shares:0 },
  { id:"x",         brand:"x",         name:"X",         handle:"@ceogps",      color:"#1d9bf0", followers:0, following:0, posts:0, likes:0, comments:0, views:0, shares:0 },
  { id:"tiktok",    brand:"tiktok",    name:"TikTok",    handle:"@ceogps",      color:"#ff2d55", followers:0, following:0, posts:0, likes:0, comments:0, views:0, shares:0 },
  { id:"linkedin",  brand:"linkedin",  name:"LinkedIn",  handle:"Chris Green",  color:"#0a66c2", followers:0, following:0, posts:0, likes:0, comments:0, views:0, shares:0 },
  { id:"reddit",    brand:"reddit",    name:"Reddit",    handle:"u/ceogps",     color:"#ff4500", followers:0, following:0, posts:0, likes:0, comments:0, views:0, shares:0 },
  { id:"snapchat",  brand:"snapchat",  name:"Snapchat",  handle:"@ceogps",      color:"#fffc00", followers:0, following:0, posts:0, likes:0, comments:0, views:0, shares:0 },
  { id:"youtube",   brand:"youtube",   name:"YouTube",   handle:"CEO GPS",      color:"#ff0000", followers:0, following:0, posts:0, likes:0, comments:0, views:0, shares:0 },
];

const CHAR_LIMITS = { instagram:2200, facebook:63206, linkedin:3000, x:280, tiktok:2200, youtube:5000, reddit:40000, snapchat:250 };

const TEMPLATES = [
  { label:"🚀 Launch",   text:"🚀 Exciting news! We just launched [feature/product]. Here's what you need to know..." },
  { label:"💡 Pro Tip",  text:"💡 Pro tip: [Your insight here]. Save this for later! #ceogps #marketing" },
  { label:"📢 Announce", text:"📢 Big announcement! [What's happening] — drop a 🔥 if you're ready!" },
  { label:"🙏 Engage",   text:"🙏 Quick question for my community: [Question]? Let me know below 👇" },
  { label:"📈 Results",  text:"📈 Results don't lie. In the last 30 days we [achievement]. Here's how we did it..." },
];

const HASHTAG_SETS = {
  instagram: ["#ceogps","#entrepreneur","#marketing","#smallbusiness","#digitalmarketing","#growthhacking","#leadgen","#success"],
  facebook:  ["#ceogps","#marketing","#business","#smallbusiness","#entrepreneur","#sales"],
  linkedin:  ["#marketing","#leadership","#entrepreneur","#business","#sales","#growthmindset","#B2B"],
  x:         ["#marketing","#entrepreneur","#growthhacking","#smallbusiness","#AI"],
  tiktok:    ["#ceogps","#entrepreneur","#marketing","#fyp","#smallbusiness","#growthtips","#businesstips"],
  youtube:   ["#entrepreneur","#marketing","#howto","#tutorial","#business"],
  reddit:    ["marketing","entrepreneur","digital marketing","small business"],
  snapchat:  ["#ceogps","#entrepreneur","#marketing","#snaptips","#fyp","#businessgrowth"],
};

const QUICKLINKS = [
  { brand:"facebook",  label:"FB Marketplace",        url:"https://facebook.com/marketplace" },
  { brand:"facebook",  label:"FB Dating",             url:"https://facebook.com/dating" },
  { brand:"facebook",  label:"Meta Business Suite",   url:"https://business.facebook.com" },
  { brand:"facebook",  label:"FB Ads Manager",        url:"https://adsmanager.facebook.com" },
  { brand:"instagram", label:"IG Creator Studio",     url:"https://business.instagram.com" },
  { brand:"tiktok",    label:"TikTok Shop",           url:"https://shop.tiktok.com" },
  { brand:"tiktok",    label:"TikTok Creator Center", url:"https://www.tiktok.com/creator-center" },
  { brand:"linkedin",  label:"LinkedIn Campaign Mgr", url:"https://www.linkedin.com/campaignmanager" },
  { brand:"youtube",   label:"YouTube Studio",        url:"https://studio.youtube.com" },
  { brand:"youtube",   label:"YouTube Analytics",     url:"https://studio.youtube.com/channel/analytics" },
  { brand:"x",         label:"X Analytics",           url:"https://analytics.twitter.com" },
  { brand:"snapchat",  label:"Snap Creator Hub",      url:"https://forbusiness.snapchat.com/creator" },
];

const GROUP_LINKS = [
  { brand:"facebook", label:"Facebook Groups",   url:"https://facebook.com/groups" },
  { brand:"linkedin", label:"LinkedIn Groups",   url:"https://linkedin.com/groups" },
  { brand:"reddit",   label:"Reddit Communities", url:"https://reddit.com/subreddits" },
];

// KV keys (persistent via Cloudflare Worker)
const KV_IMAGES   = "social_saved_images";
const KV_POSTS    = "social_posts";
const KV_STATES   = "social_platform_states";
const KV_PROFILES = "social_profiles";
const KV_HISTORY  = "social_metrics_history";

const METRIC_ROWS = ["followers","following","likes","comments","views"];
const metricLabel = (m, pid) => m === "following" ? (pid === "facebook" ? "Friends" : "Following") : m[0].toUpperCase() + m.slice(1);

/* ─── Helpers ────────────────────────────────────────────────── */
const persistKV = (key, val) => {
  try { localStorage.setItem("lifeos_kv_" + key, JSON.stringify(val)); } catch { /* quota */ }
  kvSet(key, val);
};
const fmtN    = n => n >= 1e6 ? (n/1e6).toFixed(1)+"M" : n >= 1e3 ? (n/1e3).toFixed(1)+"K" : String(n||0);
const timeAgo = d => { const s=Math.floor((Date.now()-new Date(d))/1000); if(s<60)return s+"s"; if(s<3600)return Math.floor(s/60)+"m"; if(s<86400)return Math.floor(s/3600)+"h"; return Math.floor(s/86400)+"d"; };
const btn     = (bg,c,extra={}) => ({ padding:"6px 14px", borderRadius:8, background:bg, border:"none", color:c, fontSize:11, fontWeight:600, cursor:"pointer", transition:"opacity .15s", ...extra });
const card    = { background:"var(--bg2)", border:"0.5px solid var(--b1)", borderRadius:10 };
const inp     = { width:"100%", padding:"8px 12px", borderRadius:8, border:"0.5px solid var(--b2)", background:"var(--bg3)", color:"var(--t1)", fontSize:12, outline:"none", boxSizing:"border-box" };

const profileUrl = (pid, handle) => {
  const h = (handle||"").replace(/^[@]|^u\//,"");
  switch (pid) {
    case "instagram": return `https://www.instagram.com/${h}`;
    case "x":         return `https://twitter.com/${h}`;
    case "tiktok":    return `https://www.tiktok.com/@${h}`;
    case "facebook":  return `https://www.facebook.com/${h}`;
    case "linkedin":  return `https://www.linkedin.com/in/${h}`;
    case "reddit":    return `https://www.reddit.com/user/${h}`;
    case "snapchat":  return `https://www.snapchat.com/add/${h}`;
    case "youtube":   return `https://www.youtube.com/@${h}`;
    default:          return `https://${pid}.com/${h}`;
  }
};

/* ─── Sparkline — tiny line graph for sidebar analytics ───────── */
function Sparkline({ points, color, width=58, height=16 }) {
  if (!points || points.length < 2) {
    return <svg width={width} height={height}><line x1="0" y1={height/2} x2={width} y2={height/2} stroke="var(--b2)" strokeWidth="1" strokeDasharray="2,3" /></svg>;
  }
  const min = Math.min(...points), max = Math.max(...points);
  const span = max - min || 1;
  const pts = points.map((v,i) => `${(i/(points.length-1))*width},${height-2-((v-min)/span)*(height-4)}`).join(" ");
  return (
    <svg width={width} height={height} style={{ flexShrink:0 }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/* ─── SideBlock — collapsible right-sidebar section ───────────── */
function SideBlock({ title, icon, badge, defaultOpen=true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderBottom:"0.5px solid var(--b1)" }}>
      <button onClick={() => setOpen(v=>!v)}
        style={{ width:"100%", display:"flex", alignItems:"center", gap:6, padding:"9px 12px", background:"none", border:"none", cursor:"pointer", color:"var(--t2)" }}>
        <span style={{ fontSize:11 }}>{icon}</span>
        <span style={{ fontSize:9, fontWeight:700, letterSpacing:".1em", color:"var(--t3)", flex:1, textAlign:"left" }}>{title}</span>
        {badge != null && <span style={{ fontSize:9, background:"rgba(0,200,150,0.13)", color:"var(--teal)", padding:"1px 6px", borderRadius:10, fontWeight:700 }}>{badge}</span>}
        <span style={{ fontSize:8, color:"var(--t3)", transform:open?"rotate(90deg)":"none", transition:"transform .15s" }}>▶</span>
      </button>
      {open && <div style={{ padding:"0 12px 12px" }}>{children}</div>}
    </div>
  );
}

/* ─── FeedCard — full post: avatar, platform, date, media, metrics ── */
function FeedCard({ post, platform, avatarOverride }) {
  const pl = PLATFORMS.find(p=>p.id===platform) || {};
  const isVideo = platform === "tiktok" || platform === "youtube";
  const [expanded, setExpanded] = useState(false);
  const displayName = post.author || pl.handle || pl.name || "You";
  const initials = displayName.replace(/^@/,"").split(" ").map(n=>n[0]).join("").slice(0,2).toUpperCase();
  const avatar = post.avatar || avatarOverride;
  const caption = post.text || "";
  const isLong = caption.length > 280;

  return (
    <div style={{ ...card, overflow:"hidden" }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px 8px" }}>
        <div style={{ position:"relative", flexShrink:0 }}>
          {avatar ? (
            <img src={avatar} alt={displayName} style={{ width:38, height:38, borderRadius:"50%", objectFit:"cover", border:`2px solid ${pl.color}44` }} />
          ) : (
            <div style={{ width:38, height:38, borderRadius:"50%", background:`linear-gradient(135deg,${pl.color}cc,${pl.color}55)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:700, color:"#fff", border:`2px solid ${pl.color}44` }}>
              {initials}
            </div>
          )}
          <div style={{ position:"absolute", bottom:-2, right:-2, width:16, height:16, borderRadius:"50%", background:"var(--bg1)", display:"flex", alignItems:"center", justifyContent:"center", border:"1.5px solid var(--bg1)" }}>
            <BrandIcon slug={pl.brand} size={10} color={pl.color} title={pl.name} />
          </div>
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <span style={{ fontSize:12, fontWeight:700, color:"var(--t1)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{displayName}</span>
            {post.verified && <span style={{ fontSize:9, color:pl.color }}>✓</span>}
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:5 }}>
            <span style={{ fontSize:9, color:"var(--t3)" }}>{pl.name}</span>
            <span style={{ fontSize:9, color:"var(--b2)" }}>·</span>
            <span style={{ fontSize:9, color:"var(--t3)" }}>{post.time ? (isNaN(new Date(post.time)) ? post.time : timeAgo(post.time) + " ago · " + new Date(post.time).toLocaleDateString()) : "just now"}</span>
          </div>
        </div>
        {post.real && <span style={{ fontSize:8, padding:"2px 6px", borderRadius:10, background:"rgba(255,79,94,0.15)", color:"#ff4f5e", fontWeight:700 }}>● LIVE</span>}
        {(post.permalink || post.url) && (
          <a href={post.permalink || post.url} target="_blank" rel="noreferrer"
            style={{ fontSize:10, color:"var(--t3)", textDecoration:"none", padding:"3px 8px", borderRadius:20, border:"0.5px solid var(--b2)", background:"var(--bg3)", whiteSpace:"nowrap" }}>
            Open ↗
          </a>
        )}
      </div>

      {caption && (
        <div style={{ padding:"0 14px 10px" }}>
          <div style={{ fontSize:12, color:"var(--t1)", lineHeight:1.65 }}>
            {isLong && !expanded ? caption.slice(0,280) + "… " : caption}
            {isLong && (
              <button onClick={() => setExpanded(v=>!v)}
                style={{ background:"none", border:"none", color:pl.color, fontSize:11, cursor:"pointer", padding:0, fontWeight:600 }}>
                {expanded ? " less" : "more"}
              </button>
            )}
          </div>
        </div>
      )}

      {post.img && (
        <div style={{ position:"relative" }}>
          <img src={post.img} alt="" style={{ width:"100%", maxHeight:isVideo?320:420, objectFit:"cover", display:"block" }}
            onError={e => { e.target.style.display="none"; }} />
          {isVideo && (
            <a href={post.url || post.permalink || "#"} target="_blank" rel="noreferrer" style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", textDecoration:"none" }}>
              <div style={{ width:48, height:48, borderRadius:"50%", background:"rgba(0,0,0,0.65)", backdropFilter:"blur(4px)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, color:"#fff" }}>▶</div>
            </a>
          )}
        </div>
      )}

      <div style={{ padding:"8px 14px", display:"flex", gap:16, alignItems:"center", borderTop:post.img?"0.5px solid var(--b1)":"none", flexWrap:"wrap" }}>
        <span style={{ fontSize:11, color:"#ff6b9d" }}>❤ {fmtN(post.likes||0)}</span>
        <span style={{ fontSize:11, color:"var(--teal)" }}>💬 {fmtN(post.comments||0)}</span>
        {post.views>0 && <span style={{ fontSize:11, color:"#8b7fff" }}>👁 {fmtN(post.views)}</span>}
        {post.shares>0 && <span style={{ fontSize:11, color:"#4a9eff" }}>↗ {fmtN(post.shares)}</span>}
      </div>
    </div>
  );
}

/* ─── Composer — inline create-post card ──────────────────────── */
function Composer({ platforms, savedImages, onPost, onUploadImage }) {
  const [text, setText]         = useState("");
  const [selPl, setSelPl]       = useState([]);
  const [schedDt, setSchedDt]   = useState("");
  const [mediaUrl, setMediaUrl] = useState(null);
  const [aiLoading, setAiLoad]  = useState(false);
  const [err, setErr]           = useState("");
  const [showHT, setShowHT]     = useState(false);
  const [showMedia, setShowMedia] = useState(false);
  const [posting, setPosting]   = useState(false);
  const [results, setResults]   = useState(null);
  const fileRef = useRef(null);

  const charLimit = selPl.length === 1 ? CHAR_LIMITS[selPl[0]] : 280;
  const overLimit = selPl.some(id => text.length > CHAR_LIMITS[id]);

  const suggestedTags = useMemo(() => {
    const pls = selPl.length ? selPl : ["instagram"];
    const tags = new Set();
    pls.forEach(id => (HASHTAG_SETS[id]||[]).forEach(t => tags.add(t)));
    return [...tags].slice(0, 12);
  }, [selPl]);

  function togglePl(id) { setSelPl(p => p.includes(id) ? p.filter(x=>x!==id) : [...p,id]); }
  function addTag(tag)  { setText(t => t + (t.endsWith(" ")||!t ? "" : " ") + tag + " "); }

  async function callAI(prompt) {
    setAiLoad(true); setErr("");
    try {
      const res = await fetch(`${WORKER}/api/llm/invoke`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ prompt, max_tokens: 400 }),
      });
      const d = await res.json();
      if (d?.text && !d.error) setText(d.text.trim());
      else setErr(d?.error || "AI unavailable — check Worker API keys.");
    } catch { setErr("AI request failed — Worker unreachable."); }
    setAiLoad(false);
  }

  const improveWithAI = () => callAI(
    `Improve this social media caption${selPl.length ? " for " + selPl.map(id=>PLATFORMS.find(p=>p.id===id)?.name).join(" and ") : ""}. Make it punchy, engaging, include relevant emojis. Keep under ${charLimit} chars if possible. Return ONLY the improved caption:\n\n${text}`
  );
  const generateCaption = () => callAI(
    `Generate a high-engagement social media caption for CEO GPS (a digital marketing and business growth brand). Platforms: ${selPl.join(", ")||"general"}. Include relevant hashtags. Return only the caption.`
  );

  async function handleUpload(e) {
    for (const f of Array.from(e.target.files||[])) {
      const img = await onUploadImage(f);
      if (img) setMediaUrl(img.url);
    }
    e.target.value = "";
    setShowMedia(true);
  }

  async function submit() {
    if (!text.trim() || !selPl.length) { setErr("Add a caption and select at least one platform."); return; }
    if (overLimit) { setErr("Caption exceeds a selected platform's character limit."); return; }
    setErr(""); setResults(null); setPosting(true);
    const payload = {
      id: Date.now(), text, platforms: selPl,
      scheduled: schedDt || null, media: mediaUrl,
      status: schedDt ? "Scheduled" : "Posted",
      created: new Date().toLocaleString(),
    };
    try {
      if (schedDt) {
        await fetch(`${WORKER}/api/social/schedule`, {
          method:"POST", headers:{"Content-Type":"application/json"},
          body: JSON.stringify({ text, platforms: selPl, image_url: mediaUrl, when: new Date(schedDt).toISOString() }),
        });
      } else {
        // Worker can actually publish to FB / IG / LinkedIn; other platforms are recorded locally
        const publishable = selPl.filter(id => ["facebook","instagram","linkedin"].includes(id));
        if (publishable.length) {
          const r = await fetch(`${WORKER}/api/social/post`, {
            method:"POST", headers:{"Content-Type":"application/json"},
            body: JSON.stringify({ text, platforms: publishable, image_url: mediaUrl }),
          }).then(x=>x.json()).catch(()=>null);
          if (r?.results) {
            setResults(r.results);
            payload.results = r.results;
          }
        }
      }
    } catch { /* recorded locally below regardless */ }
    onPost(payload);
    setText(""); setSelPl([]); setSchedDt(""); setMediaUrl(null); setPosting(false);
  }

  return (
    <div style={{ ...card, padding:14, display:"flex", flexDirection:"column", gap:10 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <span style={{ fontSize:12, fontWeight:700, color:"var(--t1)" }}>✍️ Create Post</span>
        <div style={{ display:"flex", gap:6 }}>
          <button onClick={generateCaption} disabled={aiLoading}
            style={{ padding:"3px 10px", borderRadius:20, background:"rgba(0,200,150,0.1)", border:"0.5px solid rgba(0,200,150,0.3)", color:"var(--teal)", fontSize:10, cursor:"pointer" }}>
            {aiLoading ? "⏳" : "🤖 Generate"}
          </button>
          <button onClick={improveWithAI} disabled={aiLoading || !text.trim()}
            style={{ padding:"3px 10px", borderRadius:20, background:"rgba(139,127,255,0.15)", border:"0.5px solid rgba(139,127,255,0.4)", color:"#8b7fff", fontSize:10, cursor:"pointer", opacity:(!text.trim())?0.4:1 }}>
            ✨ Improve
          </button>
        </div>
      </div>

      {/* Platform selector */}
      <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
        <button onClick={() => setSelPl(selPl.length===platforms.length ? [] : platforms.map(p=>p.id))}
          style={{ padding:"4px 10px", borderRadius:20, background:selPl.length===platforms.length?"rgba(0,200,150,0.15)":"var(--bg3)", border:`1.5px solid ${selPl.length===platforms.length?"var(--teal)":"var(--b2)"}`, color:selPl.length===platforms.length?"var(--teal)":"var(--t3)", fontSize:10, cursor:"pointer", fontWeight:600 }}>
          🌐 All
        </button>
        {platforms.map(p => (
          <button key={p.id} onClick={() => togglePl(p.id)}
            style={{ display:"flex", alignItems:"center", gap:5, padding:"4px 11px", borderRadius:20, border:`1.5px solid ${selPl.includes(p.id)?p.color:"var(--b2)"}`, background:selPl.includes(p.id)?`${p.color}22`:"transparent", color:selPl.includes(p.id)?p.color:"var(--t2)", fontSize:10, cursor:"pointer", fontWeight:selPl.includes(p.id)?700:400 }}>
            <BrandIcon slug={p.brand} size={11} color={selPl.includes(p.id) ? p.color : undefined} title={p.name} /> {p.name}
          </button>
        ))}
      </div>

      <textarea value={text} onChange={e=>setText(e.target.value)} placeholder="What do you want to share? Or click Generate for AI inspiration…"
        style={{ ...inp, minHeight:84, resize:"vertical", fontFamily:"inherit", lineHeight:1.6, borderColor:overLimit?"var(--red)":"var(--b2)" }} />

      <div style={{ display:"flex", justifyContent:"space-between", flexWrap:"wrap", gap:6, alignItems:"center" }}>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          {TEMPLATES.map(t => (
            <button key={t.label} onClick={() => setText(t.text)} title={t.text}
              style={{ padding:"2px 8px", borderRadius:20, background:"var(--bg3)", border:"0.5px solid var(--b2)", color:"var(--t2)", fontSize:10, cursor:"pointer" }}>
              {t.label}
            </button>
          ))}
          <button onClick={() => setShowHT(v=>!v)}
            style={{ fontSize:10, background:"none", border:"none", color:"var(--teal)", cursor:"pointer", padding:0 }}>
            # tags {showHT?"▲":"▼"}
          </button>
        </div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          {selPl.map(id => { const pl=PLATFORMS.find(p=>p.id===id); const lim=CHAR_LIMITS[id]; return (
            <span key={id} style={{ fontSize:9, padding:"1px 7px", borderRadius:10, background:`${pl?.color||"#888"}22`, color:text.length>lim?"var(--red)":pl?.color||"var(--t3)" }}>
              {pl?.name} {text.length}/{lim}
            </span>
          ); })}
          {!selPl.length && <span style={{ fontSize:9, color:"var(--t3)" }}>{text.length}/{charLimit}</span>}
        </div>
      </div>

      {showHT && (
        <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
          {suggestedTags.map(t => (
            <button key={t} onClick={() => addTag(t)}
              style={{ padding:"2px 8px", borderRadius:20, background:"var(--bg3)", border:"0.5px solid var(--b2)", color:"var(--teal)", fontSize:10, cursor:"pointer" }}>
              {t}
            </button>
          ))}
        </div>
      )}

      {/* Media + schedule + submit row */}
      <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
        <button onClick={() => fileRef.current?.click()} style={{ ...btn("var(--bg3)","var(--t2)"), border:"0.5px solid var(--b2)" }}>🖼 Upload</button>
        <input ref={fileRef} type="file" accept="image/*,video/*" multiple onChange={handleUpload} style={{ display:"none" }} />
        {savedImages.length > 0 && (
          <button onClick={() => setShowMedia(v=>!v)} style={{ ...btn("var(--bg3)","var(--t2)"), border:"0.5px solid var(--b2)" }}>
            📁 Library ({savedImages.length}) {showMedia?"▲":"▼"}
          </button>
        )}
        <input type="datetime-local" value={schedDt} onChange={e=>setSchedDt(e.target.value)} style={{ ...inp, width:"auto", padding:"5px 10px" }} />
        <button onClick={submit} disabled={posting || !text.trim() || !selPl.length}
          style={{ ...btn("var(--teal)","#000"), marginLeft:"auto", opacity:(posting||!text.trim()||!selPl.length)?0.5:1 }}>
          {posting ? "⏳ Posting…" : schedDt ? "📅 Schedule" : "🚀 Post Now"}
        </button>
      </div>

      {mediaUrl && (
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <img src={mediaUrl} alt="" style={{ width:52, height:52, borderRadius:8, objectFit:"cover", border:"2px solid var(--teal)" }} />
          <span style={{ fontSize:10, color:"var(--teal)" }}>✓ Attached</span>
          <button onClick={() => setMediaUrl(null)} style={{ background:"none", border:"none", color:"var(--t3)", cursor:"pointer", fontSize:12 }}>✕</button>
        </div>
      )}

      {showMedia && savedImages.length > 0 && (
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          {savedImages.map((img,i) => (
            <div key={img.id||i} onClick={() => setMediaUrl(mediaUrl===img.url?null:img.url)}
              style={{ width:56, height:56, borderRadius:8, overflow:"hidden", cursor:"pointer", border:`2px solid ${mediaUrl===img.url?"var(--teal)":"transparent"}` }}>
              <img src={img.url} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
            </div>
          ))}
        </div>
      )}

      {err && <div style={{ fontSize:11, color:"var(--red)", padding:"6px 10px", borderRadius:8, background:"rgba(255,79,94,0.08)", border:"0.5px solid rgba(255,79,94,0.3)" }}>{err}</div>}
      {results && (
        <div style={{ fontSize:10, padding:"6px 10px", borderRadius:8, background:"var(--bg3)" }}>
          {Object.entries(results).map(([pf, r]) => (
            <div key={pf} style={{ color: r?.error ? "var(--red)" : "var(--teal)" }}>
              {pf}: {r?.error ? "✗ " + r.error : "✓ published" + (r?.id ? " · " + r.id : "")}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── AccountsModal — OAuth connect + manual token entry ──────── */
function AccountsModal({ platforms, connectingId, onToggleConnect, onTokenSaved, onClose }) {
  const { user: firebaseUser } = useAuth();
  const uid = firebaseUser?.uid || firebaseUser?.id;
  const [tokenForm, setTokenForm]     = useState({});
  const [tokenSaving, setTokenSaving] = useState(null);
  const [tokenMsg, setTokenMsg]       = useState({});

  async function saveToken(p) {
    const tf = tokenForm[p.id] || {};
    setTokenSaving(p.id);
    setTokenMsg(prev => ({ ...prev, [p.id]: null }));
    try {
      const body = { provider: p.id };
      if (p.id === "facebook" || p.id === "instagram") { body.access_token = tf.access_token || ""; body.page_id = tf.page_id || ""; body.ig_user_id = tf.ig_user_id || ""; }
      if (p.id === "x")       body.bearer_token = tf.bearer_token || "";
      if (p.id === "youtube") { body.channel_id = tf.channel_id || ""; body.channel_handle = tf.channel_handle || "@ceogps"; }
      const r = await fetch(`${WORKER}/api/oauth/token/save`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body) });
      const d = await r.json();
      if (d.ok) {
        // For YouTube manual save (channel + optional api key), validate live before marking connected
        if (p.id === "youtube") {
          if (tf.api_key) {
            await saveApiKey("youtube_api_key", tf.api_key, uid);
          }
          // Validate the channel works now
          try {
            const chRes = await fetch(`${WORKER}/api/youtube/channel`);
            const ch = await chRes.json().catch(() => null);
            if (ch && !ch.error) {
              setTokenMsg(prev => ({ ...prev, [p.id]: { ok:true, text: `Saved — channel validated` } }));
              onTokenSaved(p.id);
            } else {
              setTokenMsg(prev => ({ ...prev, [p.id]: { ok:false, text: "Saved but validation failed: " + (ch?.error || "bad channel") } }));
              // do not mark connected
            }
          } catch (e) {
            setTokenMsg(prev => ({ ...prev, [p.id]: { ok:false, text: "Saved but validation error" } }));
          }
          return;
        }
        setTokenMsg(prev => ({ ...prev, [p.id]: { ok:true, text: `Saved${d.name ? " · " + d.name : d.handle ? " · @" + d.handle : ""} — reloading…` } }));
        onTokenSaved(p.id);
      } else {
        setTokenMsg(prev => ({ ...prev, [p.id]: { ok:false, text: d.error || "Save failed" } }));
      }
    } catch(e) { setTokenMsg(prev => ({ ...prev, [p.id]: { ok:false, text: e.message } })); }
    setTokenSaving(null);
  }

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center" }}
      onClick={e => { if(e.target===e.currentTarget) onClose(); }}>
      <div style={{ background:"var(--bg1)", border:"0.5px solid var(--b1)", borderRadius:14, width:620, maxHeight:"90vh", overflowY:"auto" }}>
        <div style={{ display:"flex", alignItems:"center", padding:"14px 18px", borderBottom:"0.5px solid var(--b1)", position:"sticky", top:0, background:"var(--bg1)", zIndex:1 }}>
          <div style={{ fontSize:14, fontWeight:700, color:"var(--t1)", flex:1 }}>⚙️ Platform Accounts</div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"var(--t2)", fontSize:18, cursor:"pointer", lineHeight:1 }}>✕</button>
        </div>
        <div style={{ padding:18, display:"flex", flexDirection:"column", gap:12 }}>
          <div style={{ ...card, padding:"10px 14px", background:"rgba(74,179,244,0.05)", border:"0.5px solid rgba(74,179,244,0.15)", fontSize:11, color:"var(--t2)", lineHeight:1.7 }}>
            <span style={{ color:"#4ab3f4", fontWeight:700 }}>How to connect · </span>
            <strong>Meta (FB/IG)</strong>: paste a token from <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noreferrer" style={{ color:"var(--teal)" }}>Graph Explorer ↗</a> (permissions: <code style={{background:"var(--bg3)",padding:"1px 4px",borderRadius:3}}>pages_manage_posts, instagram_basic</code>). &nbsp;
            <strong>X</strong>: Bearer token from <a href="https://developer.twitter.com/en/portal/dashboard" target="_blank" rel="noreferrer" style={{ color:"var(--teal)" }}>X Dev Portal ↗</a>. &nbsp;
            <strong>YouTube</strong>: Channel ID from <a href="https://studio.youtube.com" target="_blank" rel="noreferrer" style={{ color:"var(--teal)" }}>YouTube Studio ↗</a> → Settings → Channel → Advanced.
          </div>

          {platforms.map(p => {
            const isMeta = p.id === "facebook" || p.id === "instagram";
            const isX    = p.id === "x";
            const isYT   = p.id === "youtube";
            const showTokenForm = isMeta || isX || isYT;
            const tf  = tokenForm[p.id] || {};
            const msg = tokenMsg[p.id];
            const setTf = (field, value) => setTokenForm(f => ({ ...f, [p.id]: { ...tf, [field]: value } }));

            return (
              <div key={p.id} style={{ ...card, padding:14 }}>
                <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom: showTokenForm ? 12 : 0 }}>
                  <BrandIcon slug={p.brand} size={24} color={p.color} title={p.name} />
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:12, fontWeight:600, color:"var(--t1)" }}>{p.name}</div>
                    <div style={{ fontSize:10, color:"var(--t3)" }}>{p.handle}</div>
                  </div>
                  <span style={{ fontSize:11, fontWeight:600, color: p.connected ? "var(--teal)" : connectingId===p.id ? "#ffc800" : "var(--t3)" }}>
                    {p.connected ? "● Connected" : connectingId===p.id ? "⏳…" : "○ Not Connected"}
                  </span>
                  {!isYT && !isX && (
                    <button onClick={() => connectingId !== p.id && onToggleConnect(p.id)} disabled={connectingId === p.id}
                      style={{ ...btn(p.connected ? "rgba(255,79,94,0.1)" : "rgba(0,200,150,0.12)", p.connected ? "var(--red)" : "var(--teal)"), border:`0.5px solid ${p.connected?"var(--red)":"rgba(0,200,150,0.3)"}`, fontSize:10 }}>
                      {p.connected ? "Disconnect" : "OAuth Connect"}
                    </button>
                  )}
                </div>

                {showTokenForm && (
                  <div style={{ borderTop:"0.5px solid var(--b1)", paddingTop:12, display:"flex", flexDirection:"column", gap:8 }}>
                    {isMeta && (
                      <>
                        <input placeholder="Page Access Token (from Graph Explorer)" value={tf.access_token || ""}
                          onChange={e => setTf("access_token", e.target.value)} style={{ ...inp, fontFamily:"monospace", fontSize:10 }} />
                        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                          <input placeholder="Page ID (optional)" value={tf.page_id || ""} onChange={e => setTf("page_id", e.target.value)} style={{ ...inp, fontSize:10 }} />
                          <input placeholder="Instagram User ID (optional)" value={tf.ig_user_id || ""} onChange={e => setTf("ig_user_id", e.target.value)} style={{ ...inp, fontSize:10 }} />
                        </div>
                      </>
                    )}
                    {isX && (
                      <input placeholder="Bearer Token (App-only)" value={tf.bearer_token || ""}
                        onChange={e => setTf("bearer_token", e.target.value)} style={{ ...inp, fontFamily:"monospace", fontSize:10 }} />
                    )}
                    {isYT && (
                      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                        <input placeholder="Channel ID (UCxxxxxxx)" value={tf.channel_id || ""} onChange={e => setTf("channel_id", e.target.value)} style={{ ...inp, fontSize:10 }} />
                        <input placeholder="Handle (e.g. @ceogps)" value={tf.channel_handle || ""} onChange={e => setTf("channel_handle", e.target.value)} style={{ ...inp, fontSize:10 }} />
                        <input placeholder="Data API Key (for Dashboard search)" value={tf.api_key || ""} onChange={e => setTf("api_key", e.target.value)} style={{ ...inp, fontSize:10, gridColumn: "1 / -1" }} />
                      </div>
                    )}
                    <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                      <button onClick={() => saveToken(p)} disabled={tokenSaving === p.id}
                        style={{ ...btn("var(--teal)","#000"), opacity: tokenSaving===p.id ? 0.6 : 1 }}>
                        {tokenSaving === p.id ? "⏳ Saving…" : "💾 Save Token"}
                      </button>
                      {msg && (
                        <span style={{ fontSize:11, color: msg.ok ? "var(--teal)" : "var(--red)", fontWeight:600 }}>
                          {msg.ok ? "✓ " : "✗ "}{msg.text}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─── ProfileHeader — banner, avatar, bio, edit + connect ─────── */
function ProfileHeader({ platform, profile, onSaveProfile, onConnect, connecting, onOpenAccounts }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState({});
  const avatarRef = useRef(null);
  const bannerRef = useRef(null);
  const [uploading, setUploading] = useState(null); // "avatar" | "banner" | null

  const p = platform;
  const name   = profile?.name   || p.handle;
  const bio    = profile?.bio    || "";
  const avatar = profile?.avatar || p.avatar || "";
  const banner = profile?.banner || "";

  function startEdit() { setDraft({ name, bio }); setEditing(true); }
  function save() { onSaveProfile({ ...profile, name: draft.name, bio: draft.bio }); setEditing(false); }

  async function uploadImg(e, field) {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(field);
    const r = await uploadToR2(f, "social");
    if (r.ok) onSaveProfile({ ...profile, [field]: r.url });
    setUploading(null);
    e.target.value = "";
  }

  return (
    <div style={{ ...card, overflow:"hidden" }}>
      {/* Banner */}
      <div style={{ height:110, background: banner ? `url(${banner}) center/cover` : `linear-gradient(120deg, ${p.color}33, var(--bg3) 70%)`, position:"relative" }}>
        <button onClick={() => bannerRef.current?.click()}
          style={{ position:"absolute", top:8, right:8, ...btn("rgba(0,0,0,0.55)","#fff"), fontSize:10, backdropFilter:"blur(4px)" }}>
          {uploading==="banner" ? "⏳…" : "🖼 Banner"}
        </button>
        <input ref={bannerRef} type="file" accept="image/*" onChange={e=>uploadImg(e,"banner")} style={{ display:"none" }} />
      </div>

      <div style={{ padding:"0 16px 14px", display:"flex", gap:14, alignItems:"flex-end", flexWrap:"wrap" }}>
        {/* Avatar */}
        <div style={{ position:"relative", marginTop:-32, flexShrink:0 }}>
          {avatar ? (
            <img src={avatar} alt={name} style={{ width:74, height:74, borderRadius:"50%", objectFit:"cover", border:"3px solid var(--bg2)", background:"var(--bg3)" }} />
          ) : (
            <div style={{ width:74, height:74, borderRadius:"50%", background:`linear-gradient(135deg,${p.color}cc,${p.color}44)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, fontWeight:800, color:"#fff", border:"3px solid var(--bg2)" }}>
              {name.replace(/^[@u/]/,"").slice(0,2).toUpperCase()}
            </div>
          )}
          <button onClick={() => avatarRef.current?.click()} title="Change profile picture"
            style={{ position:"absolute", bottom:0, right:0, width:22, height:22, borderRadius:"50%", background:"var(--teal)", border:"2px solid var(--bg2)", color:"#000", fontSize:10, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
            {uploading==="avatar" ? "⏳" : "✎"}
          </button>
          <input ref={avatarRef} type="file" accept="image/*" onChange={e=>uploadImg(e,"avatar")} style={{ display:"none" }} />
          <div style={{ position:"absolute", top:0, right:-4, width:20, height:20, borderRadius:"50%", background:"var(--bg1)", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <BrandIcon slug={p.brand} size={12} color={p.color} title={p.name} />
          </div>
        </div>

        {/* Name / bio */}
        <div style={{ flex:1, minWidth:200, paddingTop:8 }}>
          {editing ? (
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              <input value={draft.name} onChange={e=>setDraft(d=>({...d,name:e.target.value}))} placeholder="Display name" style={{ ...inp, fontWeight:700 }} />
              <textarea value={draft.bio} onChange={e=>setDraft(d=>({...d,bio:e.target.value}))} placeholder="Bio…" style={{ ...inp, minHeight:44, resize:"vertical", fontFamily:"inherit" }} />
            </div>
          ) : (
            <>
              <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                <span style={{ fontSize:15, fontWeight:800, color:"var(--t1)" }}>{name}</span>
                <a href={profileUrl(p.id, p.handle)} target="_blank" rel="noreferrer" style={{ fontSize:10, color:p.color, textDecoration:"none" }}>{p.handle} ↗</a>
              </div>
              <div style={{ fontSize:11, color:"var(--t2)", marginTop:3, lineHeight:1.5 }}>{bio || <span style={{ color:"var(--t3)" }}>No bio yet — click Edit to add one.</span>}</div>
              <div style={{ display:"flex", gap:14, marginTop:6, flexWrap:"wrap" }}>
                {[
                  { label:"Followers", val:fmtN(p.followers), c:"#4a9eff" },
                  { label:p.id==="facebook"?"Friends":"Following", val:fmtN(p.following), c:"#8b7fff" },
                  { label:"Posts", val:fmtN(p.posts), c:"var(--t2)" },
                  { label:"Views", val:fmtN(p.views), c:"#00c896" },
                ].map(s => (
                  <span key={s.label} style={{ fontSize:11 }}>
                    <span style={{ fontWeight:700, color:s.c }}>{s.val}</span>
                    <span style={{ color:"var(--t3)", marginLeft:4 }}>{s.label}</span>
                  </span>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Actions */}
        <div style={{ display:"flex", gap:8, paddingTop:8, flexShrink:0 }}>
          {editing ? (
            <>
              <button onClick={() => setEditing(false)} style={{ ...btn("var(--bg3)","var(--t2)") }}>Cancel</button>
              <button onClick={save} style={{ ...btn("var(--teal)","#000") }}>Save</button>
            </>
          ) : (
            <>
              <button onClick={startEdit} style={{ ...btn("var(--bg3)","var(--t2)"), border:"0.5px solid var(--b2)" }}>✎ Edit Profile</button>
              <button onClick={() => connecting !== p.id && onConnect(p.id)} disabled={connecting === p.id}
                style={{ ...btn(p.connected ? "rgba(0,200,150,0.15)" : "rgba(255,255,255,0.05)", p.connected ? "var(--teal)" : "var(--t2)"), border:`0.5px solid ${p.connected?"var(--teal)":"var(--b2)"}` }}>
                {p.connected ? "● Connected" : connecting===p.id ? "⏳…" : "Connect"}
              </button>
              <button onClick={onOpenAccounts} title="Manage accounts" style={{ ...btn("var(--bg3)","var(--t2)"), border:"0.5px solid var(--b2)", padding:"6px 10px" }}>⚙️</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Main SocialPanel ────────────────────────────────────────── */
export default function SocialPanel() {
  const [platforms, setPlatforms]   = useState(() => PLATFORMS.map(p => ({ ...p, connected:false, avatar:"" })));
  const [selPl, setSelPl]           = useState("facebook");          // profile shown in header
  const [feedFilter, setFeedFilter] = useState(PLATFORMS.map(p=>p.id));
  const [posts, setPosts]           = useState([]);
  const [savedImages, setSavedImages] = useState([]);
  const [profiles, setProfiles]     = useState({});                  // { pid: {name,bio,avatar,banner} }
  const [history, setHistory]       = useState([]);                  // [{d, m:{pid:{followers,...}}}]
  const [metaFeed, setMetaFeed]     = useState([]);
  const [igFeed, setIgFeed]         = useState([]);
  const [ytVideos, setYtVideos]     = useState([]);
  const [xTweets, setXTweets]       = useState([]);
  const [metaPages, setMetaPages]   = useState([]);
  const [metaError, setMetaError]   = useState(null);
  const [ytError, setYtError]       = useState(null);
  const [xError, setXError]         = useState(null);
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [connectingId, setConnecting] = useState(null);
  const [accountsOpen, setAccountsOpen] = useState(false);
  const [peopleTab, setPeopleTab]   = useState("friends");           // friends | followers | following
  const snapshotDone = useRef(false);

  /* ── Persist helpers ── */
  const persistStates = useCallback(updated => {
    const m = {}; updated.forEach(p => { m[p.id] = p.connected; });
    persistKV(KV_STATES, m);
  }, []);

  /* ── Mount: hydrate KV + detect live platforms ── */
  useEffect(() => {
    let cancelled = false;
    const lsGet = key => { try { const v = localStorage.getItem("lifeos_kv_" + key); return v ? JSON.parse(v) : null; } catch { return null; } };

    Promise.all([kvGet(KV_STATES), kvGet(KV_POSTS), kvGet(KV_IMAGES), kvGet(KV_PROFILES), kvGet(KV_HISTORY)])
      .then(([kvStates, kvPosts, kvImgs, kvProfiles, kvHist]) => {
        if (cancelled) return;
        // Do NOT hydrate 'connected' from persisted state on refresh -- always determine fresh from server status fetches below.
        // This fixes stale "active/connected" after hard refresh when tokens are actually invalid/expired.
        const savedPosts = Array.isArray(kvPosts) ? kvPosts : (lsGet(KV_POSTS) || []);
        const savedImgs  = Array.isArray(kvImgs)  ? kvImgs  : (lsGet(KV_IMAGES) || []);
        if (savedPosts.length) setPosts(savedPosts);
        if (savedImgs.length)  setSavedImages(savedImgs);
        if (kvProfiles && typeof kvProfiles === "object") setProfiles(kvProfiles);
        if (Array.isArray(kvHist)) setHistory(kvHist);
        // Force all to not-connected initially; the status fetches below will set true only on fresh successful validation.
        setPlatforms(prev => prev.map(p => ({ ...p, connected: false })));
      });

    // YouTube auto-detect — only mark connected if real data comes back (no error)
    fetch(`${WORKER}/api/youtube/channel`).then(r=>r.json()).catch(()=>null).then(ch => {
      if (cancelled) return;
      if (!ch || ch.error) {
        setYtError(ch?.error || "YouTube not configured");
        setPlatforms(prev => {
          const u = prev.map(p => p.id === "youtube" ? { ...p, connected: false } : p);
          persistStates(u);
          return u;
        });
        return;
      }
      setYtError(null);
      setPlatforms(prev => {
        const u = prev.map(p => p.id === "youtube" ? {
          ...p, connected:true,
          handle:    ch.title       || p.handle,
          avatar:    ch.thumbnail   || p.avatar,
          followers: ch.subscribers ?? p.followers,
          views:     ch.views       ?? p.views,
          posts:     ch.videoCount  ?? p.posts,
        } : p);
        persistStates(u);
        return u;
      });
    });
    fetch(`${WORKER}/api/youtube/videos?max=8`).then(r=>r.json()).catch(()=>null).then(data => {
      if (cancelled) return;
      if (data?.items?.length) {
        setYtVideos(data.items.map(v => ({
          id:v.id, platform:"youtube", text:v.title, img:v.thumbnail,
          time:v.publishedAt, url:v.url, likes:0, comments:0, views:0, real:true,
        })));
        // Only mark active if we actually got live video data
        setPlatforms(prev => {
          const u = prev.map(p => p.id === "youtube" ? { ...p, connected: true } : p);
          persistStates(u);
          return u;
        });
        setYtError(null);
      } else {
        setYtError("YouTube connected but no recent videos (or token inactive)");
        setPlatforms(prev => {
          const u = prev.map(p => p.id === "youtube" ? { ...p, connected: false } : p);
          persistStates(u);
          return u;
        });
      }
    });

    // X auto-detect
    fetch(`${WORKER}/api/x/user?handle=ceogps`).then(r=>r.json()).catch(()=>null).then(u => {
      if (cancelled) return;
      if (!u || u.error) {
        setXError(u?.error || "X not configured");
        setPlatforms(prev => {
          const updated = prev.map(p => p.id === "x" ? { ...p, connected: false } : p);
          persistStates(updated);
          return updated;
        });
        return;
      }
      setXError(null);
      setPlatforms(prev => {
        const updated = prev.map(p => p.id === "x" ? {
          ...p, connected:true,
          avatar:    u.avatar    || p.avatar,
          followers: u.followers ?? p.followers,
          following: u.following ?? p.following,
          posts:     u.tweets    ?? p.posts,
        } : p);
        persistStates(updated);
        return updated;
      });
    });
    fetch(`${WORKER}/api/x/timeline?handle=ceogps&max=10`).then(r=>r.json()).catch(()=>null).then(data => {
      if (cancelled) return;
      if (data?.tweets?.length) {
        setXTweets(data.tweets.map(t => ({
          id:t.id, platform:"x", text:t.text,
          likes:t.likes, comments:t.replies, views:t.impressions,
          shares:t.retweets, time:t.createdAt, permalink:t.url, real:true,
        })));
        setPlatforms(prev => {
          const updated = prev.map(p => p.id === "x" ? { ...p, connected: true } : p);
          persistStates(updated);
          return updated;
        });
        setXError(null);
      } else {
        setXError("X connected but no recent timeline (or token inactive)");
        setPlatforms(prev => {
          const updated = prev.map(p => p.id === "x" ? { ...p, connected: false } : p);
          persistStates(updated);
          return updated;
        });
      }
    });

    // Meta status + feeds + pages
    fetch(`${WORKER}/api/meta/status`).then(r=>r.json()).catch(()=>null).then(status => {
      if (cancelled) return;
      if (!status || !status.connected) {
        setMetaError(status?.error || "disconnected");
        setPlatforms(prev => {
          const u = prev.map(p => (p.id==="facebook" || p.id==="instagram") ? { ...p, connected: false } : p);
          persistStates(u);
          return u;
        });
        setLoadingFeed(false);
        return;
      }
      setMetaError(null);
      setPlatforms(prev => {
        const u = prev.map(p => {
          if (p.id==="facebook")  return { ...p, connected:true, handle: status.page?.name || p.handle, followers: status.page?.followers || p.followers };
          if (p.id==="instagram") return { ...p, connected:true, handle: status.instagram?.username ? "@"+status.instagram.username : p.handle, followers: status.instagram?.followers || p.followers, posts: status.instagram?.posts || p.posts };
          return p;
        });
        persistStates(u);
        return u;
      });
      Promise.all([
        fetch(`${WORKER}/api/meta/feed?limit=8`).then(r=>r.json()).catch(()=>null),
        fetch(`${WORKER}/api/meta/instagram/feed?limit=10`).then(r=>r.json()).catch(()=>null),
        fetch(`${WORKER}/api/meta/pages`).then(r=>r.json()).catch(()=>null),
      ]).then(([feed, igMedia, pages]) => {
        if (cancelled) return;
        const hasData = (feed?.data?.length || igMedia?.data?.length);
        if (hasData) {
          if (feed?.data)    setMetaFeed(feed.data);
          if (igMedia?.data) setIgFeed(igMedia.data);
          if (pages?.data)   setMetaPages(pages.data);
          setLoadingFeed(false);
        } else {
          setMetaError("Meta connected but no recent feed data (tokens may be inactive)");
          setPlatforms(prev => {
            const u = prev.map(p => (p.id==="facebook" || p.id==="instagram") ? { ...p, connected: false } : p);
            persistStates(u);
            return u;
          });
          setLoadingFeed(false);
        }
      });
    });
    const t = setTimeout(() => !cancelled && setLoadingFeed(false), 8000);

    return () => { cancelled = true; clearTimeout(t); };
  }, [persistStates]);

  /* ── Daily metrics snapshot → history (powers sparklines) ── */
  useEffect(() => {
    if (snapshotDone.current) return;
    if (!platforms.some(p => p.connected && p.followers > 0)) return;
    // Wait one tick cycle so all live fetches have likely landed
    const t = setTimeout(() => {
      snapshotDone.current = true;
      const today = new Date().toISOString().slice(0,10);
      setHistory(prev => {
        const m = {};
        platforms.forEach(p => {
          if (p.connected) m[p.id] = { followers:p.followers, following:p.following, likes:p.likes, comments:p.comments, views:p.views };
        });
        const u = [...prev.filter(h => h.d !== today), { d: today, m }].sort((a,b)=>a.d.localeCompare(b.d)).slice(-90);
        persistKV(KV_HISTORY, u);
        return u;
      });
    }, 5000);
    return () => clearTimeout(t);
  }, [platforms]);

  /* ── OAuth popup listener ── */
  useEffect(() => {
    function handleOAuthMessage(e) {
      if (!e.data || typeof e.data !== "object") return;
      const { type, provider } = e.data;
      if (type === "oauth_success" && provider) {
        setConnecting(null);
        // Do NOT blindly set connected:true here (prevents "says active after connect when token is actually bad").
        // Re-validate with a live data pull (same rule as mount/hard-refresh): only connected if we get real items.
        const pid = provider;
        if (pid === "youtube") {
          fetch(`${WORKER}/api/youtube/videos?max=1`).then(r=>r.json()).catch(()=>null).then(data => {
            setPlatforms(prev => {
              const u = prev.map(p => p.id === "youtube" ? { ...p, connected: !!(data?.items?.length) } : p);
              persistStates(u);
              return u;
            });
          });
        } else if (pid === "x") {
          fetch(`${WORKER}/api/x/timeline?handle=ceogps&max=1`).then(r=>r.json()).catch(()=>null).then(data => {
            setPlatforms(prev => {
              const u = prev.map(p => p.id === "x" ? { ...p, connected: !!(data?.tweets?.length) } : p);
              persistStates(u);
              return u;
            });
          });
        } else if (pid === "facebook" || pid === "instagram") {
          fetch(`${WORKER}/api/meta/feed?limit=1`).then(r=>r.json()).catch(()=>null).then(feed => {
            setPlatforms(prev => {
              const has = !!(feed?.data?.length);
              const u = prev.map(p => (p.id==="facebook" || p.id==="instagram") ? { ...p, connected: has } : p);
              persistStates(u);
              return u;
            });
          });
        } else {
          // For other providers that don't have dedicated item checks here, trust the worker status briefly but the next hard refresh or Social remount will re-verify via its effect.
          setPlatforms(prev => {
            const u = prev.map(p => p.id === pid ? { ...p, connected: true } : p);
            persistStates(u);
            return u;
          });
        }
      } else if (type === "oauth_failure" && provider) {
        setConnecting(null);
      }
    }
    window.addEventListener("message", handleOAuthMessage);
    return () => window.removeEventListener("message", handleOAuthMessage);
  }, [persistStates]);

  /* ── Connect / disconnect ── */
  function toggleConnect(id) {
    const pl = platforms.find(p => p.id === id);
    if (pl?.connected) {
      fetch(`${WORKER}/api/oauth/disconnect?provider=${id}`, { method:"DELETE" }).catch(()=>null).finally(() => {
        setPlatforms(prev => {
          const u = prev.map(p => p.id === id ? { ...p, connected:false } : p);
          persistStates(u);
          return u;
        });
      });
    } else {
      // Use PKCE popup flow (consistent with Integrations) so no manual keys needed. Display will only go "connected" after live data validation in the mount-style fetches or re-checks.
      setConnecting(id);
      (async () => {
        try {
          const { verifier, challenge, method } = await generatePKCE();
          const state = `social:${id}:${Date.now()}`;
          sessionStorage.setItem(`pkce_verifier_${state}`, verifier);
          const u = new URL(`${WORKER}/api/oauth/start`);
          u.searchParams.set("provider", id);
          u.searchParams.set("user_id", "social");
          u.searchParams.set("force", "1");
          u.searchParams.set("code_challenge", challenge);
          u.searchParams.set("code_challenge_method", method);
          u.searchParams.set("state", state);
          const popup = window.open(u.toString(), `oauth-${id}`, "width=600,height=700,resizable=yes,scrollbars=yes");
          const poll = setInterval(() => {
            if (popup && popup.closed) {
              clearInterval(poll);
              setConnecting(prev => prev === id ? null : prev);
            }
          }, 700);
        } catch (e) {
          // Fallback to simple start if PKCE fails
          const popup = window.open(`${WORKER}/api/oauth/start?provider=${id}&force=1`, `oauth-${id}`, "width=600,height=700,resizable=yes,scrollbars=yes");
          const poll = setInterval(() => {
            if (popup && popup.closed) {
              clearInterval(poll);
              setConnecting(prev => prev === id ? null : prev);
            }
          }, 700);
        }
      })();
    }
  }

  const toggleFeed = useCallback(id => {
    setFeedFilter(p => p.includes(id) ? p.filter(x=>x!==id) : [...p,id]);
  }, []);

  function handlePost(payload) {
    setPosts(prev => {
      const u = [payload, ...prev];
      persistKV(KV_POSTS, u);
      return u;
    });
  }

  function deletePost(id) {
    setPosts(prev => {
      const u = prev.filter(p => p.id !== id);
      persistKV(KV_POSTS, u);
      return u;
    });
  }

  async function uploadImage(f) {
    const r = await uploadToR2(f, "social");
    const img = { id: Date.now() + "_" + f.name, name:f.name, url:r.url, key:r.key, uploadedAt:new Date().toLocaleString(), local:r.local };
    setSavedImages(prev => {
      const u = [img, ...prev].slice(0, 50);
      persistKV(KV_IMAGES, u);
      return u;
    });
    return img;
  }

  function saveProfile(pid, data) {
    setProfiles(prev => {
      const u = { ...prev, [pid]: data };
      persistKV(KV_PROFILES, u);
      return u;
    });
  }

  /* ── Derived data ── */
  const activePlObj = platforms.find(p=>p.id===selPl) || platforms[0];

  const feedPosts = useMemo(() => {
    const all = [];
    if (feedFilter.includes("facebook"))  metaFeed.forEach(p => all.push({ id:p.id, platform:"facebook", text:p.message||"", likes:p.likes?.summary?.total_count||0, comments:p.comments?.summary?.total_count||0, views:0, time:p.created_time, real:true }));
    if (feedFilter.includes("instagram")) igFeed.forEach(p => all.push({ id:p.id, platform:"instagram", text:p.caption||"", likes:p.like_count||0, comments:p.comments_count||0, views:0, img:p.thumbnail_url||p.media_url, permalink:p.permalink, time:p.timestamp, real:true }));
    if (feedFilter.includes("youtube"))   ytVideos.forEach(v => all.push(v));
    if (feedFilter.includes("x"))         xTweets.forEach(t => all.push(t));
    // newest first; entries without a parseable date sink to the bottom
    return all.sort((a,b) => (new Date(b.time).getTime()||0) - (new Date(a.time).getTime()||0));
  }, [feedFilter, metaFeed, igFeed, ytVideos, xTweets]);

  const myImages = useMemo(() => {
    const imgs = igFeed.filter(p => p.media_url || p.thumbnail_url).map(p => ({ id:"ig_"+p.id, url:p.thumbnail_url||p.media_url, link:p.permalink, src:"instagram" }));
    return [...imgs, ...savedImages.map(i => ({ ...i, src:"upload" }))].slice(0, 18);
  }, [igFeed, savedImages]);

  const sparkSeries = useCallback((pid, metric) => history.map(h => h.m?.[pid]?.[metric]).filter(v => v != null), [history]);
  const pctChange = pts => {
    if (!pts || pts.length < 2 || !pts[0]) return null;
    return ((pts[pts.length-1] - pts[0]) / pts[0]) * 100;
  };

  const connectedPls = platforms.filter(p=>p.connected);
  const errorBanners = [
    metaError && { key:"meta", color:"#ff4f5e", title: metaError==="token_expired" ? "Meta token expired" : "Facebook / Instagram not connected", action:"Fix in Accounts" },
    ytError   && { key:"yt",   color:"#ff4444", title:"YouTube not configured", action:"Add Channel ID" },
    xError    && { key:"x",    color:"#1d9bf0", title:"X not connected", action:"Add Bearer Token" },
  ].filter(Boolean);

  return (
    <div style={{ height:"calc(100vh - 52px)", display:"flex", overflow:"hidden", fontFamily:"inherit" }}>

      {/* ── MAIN COLUMN ───────────────────────────────── */}
      <div style={{ flex:1, minWidth:0, overflowY:"auto", padding:14, display:"flex", flexDirection:"column", gap:12 }}>

        {/* Profile platform chips */}
        <div style={{ display:"flex", gap:6, flexWrap:"wrap", alignItems:"center" }}>
          {platforms.map(p => (
            <button key={p.id} onClick={() => setSelPl(p.id)}
              style={{ display:"flex", alignItems:"center", gap:5, padding:"5px 12px", borderRadius:20, border:`1.5px solid ${selPl===p.id?p.color:"var(--b2)"}`, background:selPl===p.id?`${p.color}22`:"transparent", color:selPl===p.id?p.color:"var(--t2)", fontSize:10, cursor:"pointer", fontWeight:600 }}>
              <BrandIcon slug={p.brand} size={11} color={selPl===p.id?p.color:undefined} title={p.name} />
              {p.name}
              {p.connected && <span style={{ width:5, height:5, borderRadius:"50%", background:"var(--teal)" }} />}
            </button>
          ))}
        </div>

        {/* Profile header */}
        <ProfileHeader
          platform={activePlObj}
          profile={profiles[selPl]}
          onSaveProfile={data => saveProfile(selPl, data)}
          onConnect={toggleConnect}
          connecting={connectingId}
          onOpenAccounts={() => setAccountsOpen(true)}
        />

        {/* Composer */}
        <Composer platforms={platforms} savedImages={savedImages} onPost={handlePost} onUploadImage={uploadImage} />

        {/* Connection error banners */}
        {errorBanners.map(b => (
          <div key={b.key} style={{ ...card, padding:"8px 14px", display:"flex", gap:10, alignItems:"center", border:`0.5px solid ${b.color}33`, background:`${b.color}0A` }}>
            <span style={{ fontSize:13 }}>🔑</span>
            <span style={{ fontSize:11, fontWeight:600, color:b.color, flex:1 }}>{b.title}</span>
            <button onClick={() => setAccountsOpen(true)} style={{ ...btn(`${b.color}1A`, b.color), border:`0.5px solid ${b.color}44`, fontSize:10 }}>{b.action}</button>
          </div>
        ))}

        {/* Feed filter pills */}
        <div style={{ display:"flex", gap:6, alignItems:"center" }}>
          <span style={{ fontSize:10, fontWeight:700, color:"var(--t3)", letterSpacing:".08em" }}>FEED</span>
          {platforms.map(p => (
            <button key={p.id} onClick={() => toggleFeed(p.id)} title={p.name}
              style={{ width:26, height:26, borderRadius:"50%", border:`1.5px solid ${feedFilter.includes(p.id)?p.color:"var(--b2)"}`, background:feedFilter.includes(p.id)?`${p.color}22`:"transparent", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", opacity:feedFilter.includes(p.id)?1:0.45 }}>
              <BrandIcon slug={p.brand} size={13} color={feedFilter.includes(p.id) ? p.color : undefined} title={p.name} />
            </button>
          ))}
          <span style={{ fontSize:10, color:"var(--t3)", marginLeft:"auto" }}>{feedPosts.length} live post{feedPosts.length!==1?"s":""}</span>
        </div>

        {/* Feed */}
        {loadingFeed && <div style={{ ...card, padding:20, textAlign:"center", fontSize:12, color:"var(--t2)" }}>⏳ Loading live feeds…</div>}
        {feedPosts.map((post, i) => (
          <FeedCard key={post.id||i} post={post} platform={post.platform} avatarOverride={profiles[post.platform]?.avatar || platforms.find(p=>p.id===post.platform)?.avatar} />
        ))}
        {!loadingFeed && feedPosts.length === 0 && (
          <div style={{ ...card, padding:40, textAlign:"center" }}>
            <div style={{ fontSize:36, marginBottom:10 }}>📱</div>
            <div style={{ fontSize:13, fontWeight:700, color:"var(--t1)", marginBottom:6 }}>No live posts yet</div>
            <div style={{ fontSize:11, color:"var(--t2)", marginBottom:14 }}>Connect your platforms to pull in real feeds — Facebook, Instagram, X, and YouTube load automatically once tokens are set.</div>
            <button onClick={() => setAccountsOpen(true)} style={{ ...btn("var(--teal)","#000") }}>⚙️ Set Up Accounts</button>
          </div>
        )}

        {/* Your local/scheduled posts */}
        {posts.length > 0 && (
          <>
            <div style={{ fontSize:10, fontWeight:700, color:"var(--t3)", letterSpacing:".08em", marginTop:4 }}>YOUR POSTS ({posts.length})</div>
            {posts.map(post => (
              <div key={post.id} style={{ ...card, padding:14 }}>
                <div style={{ display:"flex", gap:6, marginBottom:8, alignItems:"center", flexWrap:"wrap" }}>
                  {post.platforms.map(id => { const pl=platforms.find(p=>p.id===id); return pl?<BrandIcon key={id} slug={pl.brand} size={12} color={pl.color} title={pl.name} />:null; })}
                  <span style={{ fontSize:9, padding:"2px 8px", borderRadius:10, background:post.status==="Scheduled"?"rgba(255,179,71,0.15)":"rgba(0,200,150,0.1)", color:post.status==="Scheduled"?"var(--amber)":"var(--teal)", fontWeight:700 }}>{post.status}</span>
                  {post.scheduled && <span style={{ fontSize:9, color:"var(--t3)" }}>📅 {new Date(post.scheduled).toLocaleString()}</span>}
                  <span style={{ fontSize:9, color:"var(--t3)" }}>{post.created}</span>
                  <button onClick={() => deletePost(post.id)} style={{ marginLeft:"auto", background:"none", border:"none", color:"var(--t3)", cursor:"pointer", fontSize:12 }}>✕</button>
                </div>
                {post.media && <img src={post.media} alt="" style={{ maxWidth:200, borderRadius:8, marginBottom:8, display:"block" }} />}
                <div style={{ fontSize:12, color:"var(--t1)", lineHeight:1.5 }}>{post.text}</div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* ── RIGHT SIDEBAR ─────────────────────────────── */}
      <div style={{ width:300, flexShrink:0, borderLeft:"0.5px solid var(--b1)", background:"var(--bg2)", overflowY:"auto" }}>

        {/* Analytics */}
        <SideBlock title="ANALYTICS" icon="📊" badge={connectedPls.length ? `${connectedPls.length} live` : null}>
          {connectedPls.length === 0 && (
            <div style={{ fontSize:10, color:"var(--t3)", padding:"8px 0" }}>Connect platforms to see live analytics with growth trends.</div>
          )}
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {[...connectedPls, ...platforms.filter(p=>!p.connected)].map(p => (
              <div key={p.id} style={{ ...card, padding:"8px 10px", opacity:p.connected?1:0.5 }}>
                <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:p.connected?6:0 }}>
                  <BrandIcon slug={p.brand} size={13} color={p.color} title={p.name} />
                  <span style={{ fontSize:11, fontWeight:700, color:p.color, flex:1 }}>{p.name}</span>
                  <span style={{ fontSize:9, color:p.connected?"var(--teal)":"var(--t3)" }}>{p.connected?"● live":"offline"}</span>
                </div>
                {p.connected && METRIC_ROWS.map(m => {
                  const pts = sparkSeries(p.id, m);
                  const pct = pctChange(pts);
                  return (
                    <div key={m} style={{ display:"flex", alignItems:"center", gap:6, padding:"2px 0" }}>
                      <span style={{ fontSize:9, color:"var(--t3)", width:56, flexShrink:0 }}>{metricLabel(m, p.id)}</span>
                      <span style={{ fontSize:10, fontWeight:700, color:"var(--t1)", width:38, textAlign:"right", flexShrink:0 }}>{fmtN(p[m]||0)}</span>
                      <Sparkline points={pts.length ? pts : [p[m]||0, p[m]||0]} color={pct != null && pct < 0 ? "#ff4f5e" : p.color} />
                      <span style={{ fontSize:9, fontWeight:700, color: pct == null ? "var(--t3)" : pct < 0 ? "#ff4f5e" : "var(--teal)", width:38, textAlign:"right", flexShrink:0 }}>
                        {pct == null ? "—" : `${pct >= 0 ? "+" : ""}${Math.abs(pct) < 10 ? pct.toFixed(1) : Math.round(pct)}%`}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          {connectedPls.length > 0 && history.length < 2 && (
            <div style={{ fontSize:9, color:"var(--t3)", marginTop:8, lineHeight:1.5 }}>📈 Growth graphs build daily — a snapshot is saved each time you open this panel. Trends appear from day 2.</div>
          )}
        </SideBlock>

        {/* My Images */}
        <SideBlock title="MY IMAGES" icon="🖼" badge={myImages.length || null}>
          {myImages.length === 0 ? (
            <div style={{ fontSize:10, color:"var(--t3)", padding:"4px 0" }}>Posted images from connected platforms and uploads appear here.</div>
          ) : (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:5 }}>
              {myImages.map(img => (
                <a key={img.id} href={img.link || img.url} target="_blank" rel="noreferrer" style={{ display:"block", aspectRatio:"1", borderRadius:6, overflow:"hidden", background:"var(--bg3)" }}>
                  <img src={img.url} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} onError={e => { e.target.style.display="none"; }} />
                </a>
              ))}
            </div>
          )}
        </SideBlock>

        {/* People — Friends / Followers / Following */}
        <SideBlock title="PEOPLE" icon="👥">
          <div style={{ display:"flex", borderRadius:8, overflow:"hidden", border:"0.5px solid var(--b1)", marginBottom:8 }}>
            {[["friends","Friends"],["followers","Followers"],["following","Following"]].map(([id,label]) => (
              <button key={id} onClick={() => setPeopleTab(id)}
                style={{ flex:1, padding:"6px 4px", border:"none", background:peopleTab===id?"rgba(0,200,150,0.12)":"var(--bg3)", color:peopleTab===id?"var(--teal)":"var(--t2)", fontSize:9, fontWeight:700, cursor:"pointer" }}>
                {label}
              </button>
            ))}
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
            {platforms.map(p => {
              const count = peopleTab === "followers" ? p.followers : p.following;
              const link = peopleTab === "followers"
                ? (p.id==="instagram" ? `https://www.instagram.com/${p.handle.replace("@","")}/followers` : p.id==="x" ? `https://twitter.com/${p.handle.replace("@","")}/followers` : profileUrl(p.id, p.handle))
                : p.id==="facebook" ? "https://facebook.com/friends" : profileUrl(p.id, p.handle);
              return (
                <a key={p.id} href={link} target="_blank" rel="noreferrer"
                  style={{ display:"flex", alignItems:"center", gap:7, padding:"5px 8px", borderRadius:8, textDecoration:"none", background:"var(--bg3)", opacity:p.connected?1:0.5 }}>
                  <BrandIcon slug={p.brand} size={12} color={p.color} title={p.name} />
                  <span style={{ fontSize:10, color:"var(--t1)", flex:1 }}>{p.name}</span>
                  <span style={{ fontSize:10, fontWeight:700, color:p.color }}>{p.connected ? fmtN(count) : "—"}</span>
                  <span style={{ fontSize:9, color:"var(--t3)" }}>↗</span>
                </a>
              );
            })}
          </div>
          <div style={{ fontSize:9, color:"var(--t3)", marginTop:8, lineHeight:1.5 }}>ℹ Platforms restrict bulk friend/follower lists via API — counts are live, full lists open in the native app.</div>
        </SideBlock>

        {/* Pages */}
        <SideBlock title="YOUR PAGES" icon="📄" badge={metaPages.length || null}>
          {metaPages.length === 0 ? (
            <div style={{ fontSize:10, color:"var(--t3)", padding:"4px 0" }}>Facebook pages appear here once Meta is connected.</div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
              {metaPages.map(pg => (
                <a key={pg.id} href={`https://facebook.com/${pg.id}`} target="_blank" rel="noreferrer"
                  style={{ display:"flex", alignItems:"center", gap:7, padding:"5px 8px", borderRadius:8, textDecoration:"none", background:"var(--bg3)" }}>
                  <BrandIcon slug="facebook" size={12} color="#1877f2" title="Facebook" />
                  <span style={{ fontSize:10, color:"var(--t1)", flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{pg.name}</span>
                  {pg.fan_count != null && <span style={{ fontSize:9, color:"var(--t3)" }}>{fmtN(pg.fan_count)} fans</span>}
                </a>
              ))}
            </div>
          )}
        </SideBlock>

        {/* Groups */}
        <SideBlock title="GROUPS" icon="👪" defaultOpen={false}>
          <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
            {GROUP_LINKS.map(g => (
              <a key={g.label} href={g.url} target="_blank" rel="noreferrer"
                style={{ display:"flex", alignItems:"center", gap:7, padding:"5px 8px", borderRadius:8, textDecoration:"none", background:"var(--bg3)" }}>
                <BrandIcon slug={g.brand} size={12} title={g.label} />
                <span style={{ fontSize:10, color:"var(--t1)", flex:1 }}>{g.label}</span>
                <span style={{ fontSize:9, color:"var(--t3)" }}>↗</span>
              </a>
            ))}
          </div>
        </SideBlock>

        {/* Quicklinks */}
        <SideBlock title="QUICKLINKS" icon="🔗" defaultOpen={false}>
          <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
            {QUICKLINKS.map(q => (
              <a key={q.label} href={q.url} target="_blank" rel="noreferrer"
                style={{ display:"flex", alignItems:"center", gap:7, padding:"5px 8px", borderRadius:8, textDecoration:"none", background:"var(--bg3)" }}>
                <BrandIcon slug={q.brand} size={12} title={q.label} />
                <span style={{ fontSize:10, color:"var(--t1)", flex:1 }}>{q.label}</span>
                <span style={{ fontSize:9, color:"var(--t3)" }}>↗</span>
              </a>
            ))}
          </div>
        </SideBlock>
      </div>

      {/* Accounts modal */}
      {accountsOpen && (
        <AccountsModal
          platforms={platforms}
          connectingId={connectingId}
          onToggleConnect={toggleConnect}
          onTokenSaved={() => setTimeout(() => window.location.reload(), 900)}
          onClose={() => setAccountsOpen(false)}
        />
      )}
    </div>
  );
}
