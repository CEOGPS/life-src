import { useState, useEffect, useRef } from "react";
import Icon from "@/components/lifeos/icons/Icon";

const WORKER = import.meta.env.VITE_WORKER_URL || "https://api.lifeos1.ceogps.com";
const SITE_URL = "https://ceogps.com";
const ADMIN_URL = "https://ww2.managemydirectory.com/admin";

const C = { teal:"#00c896", blue:"#4a9eff", purple:"#8b7fff", amber:"#ffb347", green:"#3dd68c", red:"#ff4f5e", pink:"#ff6b9d" };
const card = { background:"var(--bg2)", border:"0.5px solid var(--b1)", borderRadius:10 };
const inp  = { width:"100%", padding:"8px 12px", borderRadius:8, border:"0.5px solid var(--b2)", background:"var(--bg3)", color:"var(--t1)", fontSize:12, outline:"none", boxSizing:"border-box" };

// ── BD API helper — all calls route through the CF Worker proxy ───────────
// Worker injects BD_API_KEY from secrets → ceogps.com/api/v2/*
// The frontend never touches the API key directly.
// To enable: wrangler secret put BD_API_KEY
async function bdCall(method, path, body = null) {
  try {
    const opts = { method, headers: { "Content-Type": "application/json" } };
    if (body) opts.body = JSON.stringify(body);
    const r = await fetch(`${WORKER}/api/bd${path}`, opts);
    return await r.json();
  } catch (e) { return { status:"error", message: e.message }; }
}

const TABS = ["overview","members","leads","posts","reviews","site"];

export default function CEOGPSPanel() {
  const [tab, setTab]               = useState("overview");
  const [loading, setLoading]       = useState(false);
  const [connected, setConnected]   = useState(null);
  const [members, setMembers]       = useState([]);
  const [leads, setLeads]           = useState([]);
  const [posts, setPosts]           = useState([]);
  const [reviews, setReviews]       = useState([]);
  const [search, setSearch]         = useState("");
  const [selected, setSelected]     = useState(null);
  const [editForm, setEditForm]     = useState(null);
  const [saving, setSaving]         = useState(false);
  const [toast, setToast]           = useState(null);
  const [newMember, setNewMember]   = useState(false);
  const [newForm, setNewForm]       = useState({ email:"", password:"", first_name:"", last_name:"", subscription_id:"" });
  const [stats, setStats]           = useState(null);
  const toastTimer = useRef(null);

  function showToast(msg, color = C.teal) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, color });
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }

  // Test connection on mount
  useEffect(() => {
    bdCall("GET", "/").then(r => {
      setConnected(r?.status === "success");
      if (r?.status === "success") loadOverview();
    });
  }, []);

  async function loadOverview() {
    setLoading(true);
    const [mem, lds, pst, rev] = await Promise.all([
      bdCall("GET", "/user/search?limit=5"),
      bdCall("GET", "/lead/search?limit=5"),
      bdCall("GET", "/post/search?limit=5"),
      bdCall("GET", "/review/search?limit=5"),
    ]);
    const memCount = mem?.message?.total_results || 0;
    const ldCount  = lds?.message?.total_results || 0;
    const pstCount = pst?.message?.total_results || 0;
    const revCount = rev?.message?.total_results || 0;
    setStats({ members:memCount, leads:ldCount, posts:pstCount, reviews:revCount });
    setLoading(false);
  }

  async function loadTab(t) {
    setTab(t); setLoading(true); setSelected(null);
    if (t === "members") {
      const r = await bdCall("GET", `/user/search?limit=20${search ? "&keyword="+encodeURIComponent(search) : ""}`);
      setMembers(r?.message?.data || []);
    } else if (t === "leads") {
      const r = await bdCall("GET", `/lead/search?limit=20${search ? "&keyword="+encodeURIComponent(search) : ""}`);
      setLeads(r?.message?.data || []);
    } else if (t === "posts") {
      const r = await bdCall("GET", `/post/search?limit=20${search ? "&keyword="+encodeURIComponent(search) : ""}`);
      setPosts(r?.message?.data || []);
    } else if (t === "reviews") {
      const r = await bdCall("GET", `/review/search?limit=20`);
      setReviews(r?.message?.data || []);
    }
    setLoading(false);
  }

  async function saveMember() {
    if (!editForm) return;
    setSaving(true);
    const r = await bdCall("PUT", `/user/update`, editForm);
    if (r?.status === "success") {
      showToast("Member updated ✓", C.teal);
      setSelected(editForm); setEditForm(null);
      loadTab("members");
    } else { showToast("Update failed: " + (r?.message || "unknown error"), C.red); }
    setSaving(false);
  }

  async function deleteMember(userId) {
    if (!confirm("Delete this member permanently?")) return;
    const r = await bdCall("DELETE", `/user/delete?user_id=${userId}`);
    if (r?.status === "success") {
      showToast("Member deleted", C.amber);
      setSelected(null); loadTab("members");
    } else { showToast("Delete failed: " + r?.message, C.red); }
  }

  async function createMember() {
    if (!newForm.email || !newForm.password || !newForm.subscription_id) {
      showToast("Email, password, and membership plan ID required", C.amber); return;
    }
    setSaving(true);
    const r = await bdCall("POST", "/user/create", newForm);
    if (r?.status === "success") {
      showToast("Member created ✓", C.teal);
      setNewMember(false); setNewForm({ email:"", password:"", first_name:"", last_name:"", subscription_id:"" });
      loadTab("members");
    } else { showToast("Create failed: " + r?.message, C.red); }
    setSaving(false);
  }

  async function updatePost(postData) {
    setSaving(true);
    const r = await bdCall("PUT", "/post/update", postData);
    if (r?.status === "success") { showToast("Post updated ✓", C.teal); loadTab("posts"); }
    else { showToast("Update failed: " + r?.message, C.red); }
    setSaving(false);
  }

  async function deletePost(postId) {
    if (!confirm("Delete this post?")) return;
    const r = await bdCall("DELETE", `/post/delete?post_id=${postId}`);
    if (r?.status === "success") { showToast("Post deleted", C.amber); loadTab("posts"); }
    else { showToast("Delete failed: " + r?.message, C.red); }
  }

  const TAB_ICONS = { overview:"🏠", members:"👥", leads:"🎯", posts:"📝", reviews:"⭐", site:"🌐" };

  return (
    <div style={{ height:"calc(100vh - 52px)", display:"flex", flexDirection:"column", overflow:"hidden" }}>

      {/* Toast */}
      {toast && (
        <div style={{ position:"fixed", top:70, right:24, zIndex:9999, padding:"10px 18px", borderRadius:10, background:"var(--bg3)", border:`0.5px solid ${toast.color}`, color:toast.color, fontSize:13, fontWeight:600, boxShadow:"0 4px 24px rgba(0,0,0,0.5)" }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ padding:"10px 20px", borderBottom:"0.5px solid var(--b1)", display:"flex", alignItems:"center", gap:12, background:"var(--bg2)", flexShrink:0 }}>
        <div style={{ width:32, height:32, borderRadius:8, background:"var(--teal)22", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}><Icon name="🌐" size={14} /></div>
        <div>
          <div style={{ fontSize:14, fontWeight:700, color:"var(--t1)" }}>CEO GPS</div>
          <div style={{ fontSize:10, color:connected === true ? C.teal : connected === false ? C.red : "var(--t3)" }}>
            {connected === null ? "Connecting..." : connected ? "● Connected — ceogps.com" : "● Connection failed — check API key"}
          </div>
        </div>
        <div style={{ marginLeft:"auto", display:"flex", gap:8 }}>
          <a href={SITE_URL} target="_blank" rel="noreferrer" style={{ padding:"5px 12px", borderRadius:6, background:"var(--teal)22", border:"0.5px solid var(--teal)44", color:"var(--teal)", fontSize:11, textDecoration:"none", fontWeight:600 }}>View Site ↗</a>
          <a href={ADMIN_URL} target="_blank" rel="noreferrer" style={{ padding:"5px 12px", borderRadius:6, background:"var(--blue)22", border:"0.5px solid var(--blue)44", color:"var(--blue)", fontSize:11, textDecoration:"none", fontWeight:600 }}>BD Admin ↗</a>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", borderBottom:"0.5px solid var(--b1)", padding:"0 20px", background:"var(--bg2)", flexShrink:0 }}>
        {TABS.map(t => (
          <button key={t} onClick={() => t === "overview" ? loadOverview() || setTab(t) : loadTab(t)}
            style={{ padding:"10px 14px", border:"none", background:"none", cursor:"pointer", fontSize:11, fontWeight:tab===t?700:400, color:tab===t?"var(--teal)":"var(--t2)", borderBottom:tab===t?"2px solid var(--teal)":"2px solid transparent" }}>
            {TAB_ICONS[t]} {t.charAt(0).toUpperCase()+t.slice(1)}
          </button>
        ))}
        <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:8 }}>
          <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key==="Enter"&&loadTab(tab)}
            placeholder="Search..." style={{ padding:"5px 10px", borderRadius:20, border:"0.5px solid var(--b2)", background:"var(--bg3)", color:"var(--t1)", fontSize:11, outline:"none", width:160 }} />
        </div>
      </div>

      <div style={{ flex:1, overflowY:"auto", padding:20 }}>

        {/* OVERVIEW */}
        {tab === "overview" && (
          <>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:20 }}>
              {stats ? [
                { label:"Members",  val:stats.members, color:C.blue,   icon:"👥", t:"members" },
                { label:"Leads",    val:stats.leads,   color:C.teal,   icon:"🎯", t:"leads" },
                { label:"Posts",    val:stats.posts,   color:C.purple, icon:"📝", t:"posts" },
                { label:"Reviews",  val:stats.reviews, color:C.amber,  icon:"⭐", t:"reviews" },
              ].map(s => (
                <button key={s.label} onClick={() => loadTab(s.t)} style={{ ...card, padding:18, textAlign:"left", cursor:"pointer", border:`0.5px solid ${s.color}33` }}>
                  <div style={{ fontSize:22, marginBottom:6 }}>{s.icon}</div>
                  <div style={{ fontSize:28, fontWeight:800, color:s.color, lineHeight:1 }}>{s.val}</div>
                  <div style={{ fontSize:11, color:"var(--t2)", marginTop:4 }}>{s.label}</div>
                </button>
              )) : (
                <div style={{ gridColumn:"1/-1", fontSize:12, color:"var(--t2)" }}>{loading ? "Loading site data..." : "Click a tab to load data"}</div>
              )}
            </div>

            {/* Quick admin links */}
            <div style={{ ...card, padding:20, marginBottom:16 }}>
              <div style={{ fontSize:12, fontWeight:700, color:"var(--t1)", marginBottom:14 }}>Quick Admin Actions</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10 }}>
                {[
                  { icon:"👤", label:"Add Member",       url:`${ADMIN_URL}/members/add` },
                  { icon:"📝", label:"Add Post",          url:`${ADMIN_URL}/posts/add` },
                  { icon:"📧", label:"Send Newsletter",   url:`${ADMIN_URL}/newsletter` },
                  { icon:"💬", label:"Form Inquiries",    url:`${ADMIN_URL}/forms/inquiries` },
                  { icon:"💳", label:"Membership Plans",  url:`${ADMIN_URL}/plans` },
                  { icon:"⚙️", label:"General Settings",  url:`${ADMIN_URL}/settings/general` },
                  { icon:"🔧", label:"reCAPTCHA Setup",   url:`${ADMIN_URL}/settings/general#integrations` },
                  { icon:"📊", label:"Analytics",         url:`${ADMIN_URL}/analytics` },
                  { icon:"🎨", label:"Widget Manager",    url:`${ADMIN_URL}/widgets` },
                ].map(l => (
                  <a key={l.label} href={l.url} target="_blank" rel="noreferrer" style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px", borderRadius:8, background:"var(--bg3)", border:"0.5px solid var(--b2)", textDecoration:"none", transition:"all .15s" }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor="var(--teal)55"; e.currentTarget.style.background="rgba(0,200,150,0.06)"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor="var(--b2)"; e.currentTarget.style.background="var(--bg3)"; }}>
                    <span style={{ fontSize:18 }}>{l.icon}</span>
                    <span style={{ fontSize:12, color:"var(--t1)", fontWeight:500 }}>{l.label}</span>
                    <Icon name="↗" size={10} />
                  </a>
                ))}
              </div>
            </div>

            {/* Site preview */}
            <div style={{ ...card, overflow:"hidden", height:300 }}>
              <div style={{ padding:"8px 12px", borderBottom:"0.5px solid var(--b1)", fontSize:10, color:"var(--t2)", display:"flex", alignItems:"center", gap:8 }}>
                <div style={{ width:8, height:8, borderRadius:"50%", background:C.teal }} />
                ceogps.com — Live Preview
              </div>
              <iframe src={SITE_URL} style={{ width:"100%", height:260, border:"none" }} title="CEO GPS" />
            </div>
          </>
        )}

        {/* MEMBERS */}
        {tab === "members" && (
          <>
            <div style={{ display:"flex", gap:10, marginBottom:14, alignItems:"center" }}>
              <div style={{ fontSize:13, fontWeight:700, color:"var(--t1)" }}>Members</div>
              <button onClick={() => setNewMember(true)} style={{ padding:"6px 16px", borderRadius:8, background:"var(--teal)", border:"none", color:"#000", fontWeight:700, fontSize:11, cursor:"pointer" }}>+ Add Member</button>
              <span style={{ fontSize:11, color:"var(--t2)", marginLeft:"auto" }}>{members.length} shown</span>
            </div>
            {loading ? <div style={{ fontSize:12, color:"var(--t2)" }}>Loading members...</div> : (
              <div style={{ ...card, overflow:"hidden" }}>
                {members.length === 0 ? (
                  <div style={{ padding:30, textAlign:"center", fontSize:12, color:"var(--t3)" }}>No members found — try a different search</div>
                ) : (
                  <table style={{ width:"100%", borderCollapse:"collapse" }}>
                    <thead>
                      <tr style={{ borderBottom:"0.5px solid var(--b1)" }}>
                        {["Name","Email","Plan","Status","Joined",""].map(h => (
                          <th key={h} style={{ padding:"10px 14px", textAlign:"left", fontSize:9, color:"var(--t3)", fontWeight:700, textTransform:"uppercase" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {members.map(m => (
                        <tr key={m.user_id||m.id} style={{ borderBottom:"0.5px solid var(--b1)", cursor:"pointer" }}
                          onClick={() => { setSelected(m); setEditForm({ ...m }); }}
                          onMouseEnter={e => e.currentTarget.style.background="var(--bg3)"}
                          onMouseLeave={e => e.currentTarget.style.background=""}>
                          <td style={{ padding:"11px 14px", fontSize:12, fontWeight:500, color:"var(--t1)" }}>{m.first_name} {m.last_name}</td>
                          <td style={{ padding:"11px 14px", fontSize:11, color:"var(--t2)" }}>{m.email}</td>
                          <td style={{ padding:"11px 14px", fontSize:10, color:C.blue }}>{m.subscription_name||m.plan||"—"}</td>
                          <td style={{ padding:"11px 14px" }}>
                            <span style={{ fontSize:9, padding:"2px 8px", borderRadius:20, background:m.status==="1"||m.active==="1"?"rgba(0,200,150,0.15)":"rgba(255,255,255,0.06)", color:m.status==="1"||m.active==="1"?C.teal:"var(--t3)", fontWeight:600 }}>
                              {m.status==="1"||m.active==="1" ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td style={{ padding:"11px 14px", fontSize:10, color:"var(--t3)" }}>{m.date_created?.split(" ")[0]||"—"}</td>
                          <td style={{ padding:"11px 14px" }}>
                            <div style={{ display:"flex", gap:6 }}>
                              <a href={`${ADMIN_URL}/members/edit/${m.user_id||m.id}`} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()}
                                style={{ fontSize:10, color:C.blue, textDecoration:"none", padding:"3px 8px", borderRadius:4, background:`${C.blue}22`, border:`0.5px solid ${C.blue}44` }}>Edit ↗</a>
                              <button onClick={e=>{e.stopPropagation();deleteMember(m.user_id||m.id);}}
                                style={{ fontSize:10, color:C.red, background:`${C.red}15`, border:`0.5px solid ${C.red}33`, borderRadius:4, padding:"3px 8px", cursor:"pointer" }}>Delete</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* Edit member panel */}
            {selected && editForm && (
              <div style={{ ...card, padding:20, marginTop:14, border:`0.5px solid ${C.blue}44` }}>
                <div style={{ fontSize:13, fontWeight:700, color:"var(--t1)", marginBottom:14 }}>
                  Edit: {selected.first_name} {selected.last_name}
                  <button onClick={() => { setSelected(null); setEditForm(null); }} style={{ marginLeft:10, fontSize:11, color:"var(--t3)", background:"none", border:"none", cursor:"pointer" }}><Icon name="✕" size={12} style={{marginRight:6,verticalAlign:"middle"}} />Close</button>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:12 }}>
                  {[["First Name","first_name"],["Last Name","last_name"],["Email","email"],["Phone","phone"],["City","city"],["State","state"]].map(([label,key]) => (
                    <div key={key}>
                      <div style={{ fontSize:10, color:"var(--t2)", marginBottom:4 }}>{label}</div>
                      <input value={editForm[key]||""} onChange={e => setEditForm(f => ({...f,[key]:e.target.value}))} style={inp} />
                    </div>
                  ))}
                </div>
                <div style={{ display:"flex", gap:8 }}>
                  <button onClick={saveMember} disabled={saving} style={{ padding:"9px 24px", borderRadius:8, background:"var(--teal)", border:"none", color:"#000", fontWeight:700, cursor:"pointer", opacity:saving?0.6:1 }}>
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                  <a href={`${ADMIN_URL}/members/edit/${selected.user_id||selected.id}`} target="_blank" rel="noreferrer"
                    style={{ padding:"9px 16px", borderRadius:8, background:`${C.blue}22`, border:`0.5px solid ${C.blue}44`, color:C.blue, fontSize:12, fontWeight:600, textDecoration:"none" }}>
                    Open in BD Admin ↗
                  </a>
                </div>
              </div>
            )}
          </>
        )}

        {/* LEADS */}
        {tab === "leads" && (
          <>
            <div style={{ fontSize:13, fontWeight:700, color:"var(--t1)", marginBottom:14 }}>Leads — {leads.length} shown</div>
            {loading ? <div style={{ fontSize:12, color:"var(--t2)" }}>Loading leads...</div> : (
              leads.length === 0 ? <div style={{ ...card, padding:30, textAlign:"center", fontSize:12, color:"var(--t3)" }}>No leads found</div> : (
                <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  {leads.map(l => (
                    <div key={l.lead_id||l.id} style={{ ...card, padding:16 }}>
                      <div style={{ display:"flex", gap:12, alignItems:"flex-start" }}>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:13, fontWeight:600, color:"var(--t1)", marginBottom:4 }}>{l.title||l.name||"Untitled Lead"}</div>
                          <div style={{ fontSize:11, color:"var(--t2)", marginBottom:6 }}>{l.description||l.details||""}</div>
                          <div style={{ display:"flex", gap:12, fontSize:10, color:"var(--t3)" }}>
                            {l.location && <span>📍 {l.location}</span>}
                            {l.date_created && <span>📅 {l.date_created.split(" ")[0]}</span>}
                            {l.budget && <span>💰 {l.budget}</span>}
                          </div>
                        </div>
                        <a href={`${ADMIN_URL}/leads/view/${l.lead_id||l.id}`} target="_blank" rel="noreferrer"
                          style={{ padding:"5px 12px", borderRadius:6, background:`${C.teal}22`, border:`0.5px solid ${C.teal}44`, color:C.teal, fontSize:10, fontWeight:600, textDecoration:"none", flexShrink:0 }}>
                          View ↗
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </>
        )}

        {/* POSTS */}
        {tab === "posts" && (
          <>
            <div style={{ display:"flex", gap:10, marginBottom:14, alignItems:"center" }}>
              <div style={{ fontSize:13, fontWeight:700, color:"var(--t1)" }}>Posts — {posts.length} shown</div>
              <a href={`${ADMIN_URL}/posts/add`} target="_blank" rel="noreferrer"
                style={{ padding:"6px 14px", borderRadius:8, background:"var(--teal)", border:"none", color:"#000", fontWeight:700, fontSize:11, textDecoration:"none" }}>+ New Post ↗</a>
            </div>
            {loading ? <div style={{ fontSize:12, color:"var(--t2)" }}>Loading posts...</div> : (
              posts.length === 0 ? <div style={{ ...card, padding:30, textAlign:"center", fontSize:12, color:"var(--t3)" }}>No posts found</div> : (
                <div style={{ ...card, overflow:"hidden" }}>
                  <table style={{ width:"100%", borderCollapse:"collapse" }}>
                    <thead>
                      <tr style={{ borderBottom:"0.5px solid var(--b1)" }}>
                        {["Title","Author","Type","Status","Date",""].map(h => (
                          <th key={h} style={{ padding:"10px 14px", textAlign:"left", fontSize:9, color:"var(--t3)", fontWeight:700, textTransform:"uppercase" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {posts.map(p => (
                        <tr key={p.post_id||p.id} style={{ borderBottom:"0.5px solid var(--b1)" }}
                          onMouseEnter={e => e.currentTarget.style.background="var(--bg3)"}
                          onMouseLeave={e => e.currentTarget.style.background=""}>
                          <td style={{ padding:"10px 14px", fontSize:12, fontWeight:500, color:"var(--t1)", maxWidth:260, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.title||p.group_title||"—"}</td>
                          <td style={{ padding:"10px 14px", fontSize:11, color:"var(--t2)" }}>{p.author||p.username||"—"}</td>
                          <td style={{ padding:"10px 14px", fontSize:10, color:C.purple }}>{p.data_type||p.type||"post"}</td>
                          <td style={{ padding:"10px 14px" }}>
                            <span style={{ fontSize:9, padding:"2px 7px", borderRadius:20, background:p.group_status==="1"||p.status==="1"?"rgba(0,200,150,0.15)":"rgba(255,255,255,0.06)", color:p.group_status==="1"||p.status==="1"?C.teal:"var(--t3)", fontWeight:600 }}>
                              {p.group_status==="1"||p.status==="1" ? "Published" : "Draft"}
                            </span>
                          </td>
                          <td style={{ padding:"10px 14px", fontSize:10, color:"var(--t3)" }}>{(p.date_updated||p.date_created||"").split(" ")[0]}</td>
                          <td style={{ padding:"10px 14px" }}>
                            <div style={{ display:"flex", gap:5 }}>
                              <a href={`${ADMIN_URL}/posts/edit/${p.post_id||p.id}`} target="_blank" rel="noreferrer"
                                style={{ fontSize:10, color:C.blue, textDecoration:"none", padding:"3px 8px", borderRadius:4, background:`${C.blue}22`, border:`0.5px solid ${C.blue}44` }}>Edit ↗</a>
                              <button onClick={() => deletePost(p.post_id||p.id)}
                                style={{ fontSize:10, color:C.red, background:`${C.red}15`, border:`0.5px solid ${C.red}33`, borderRadius:4, padding:"3px 8px", cursor:"pointer" }}>Del</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </>
        )}

        {/* REVIEWS */}
        {tab === "reviews" && (
          <>
            <div style={{ fontSize:13, fontWeight:700, color:"var(--t1)", marginBottom:14 }}>Reviews</div>
            {loading ? <div style={{ fontSize:12, color:"var(--t2)" }}>Loading reviews...</div> : (
              reviews.length === 0 ? <div style={{ ...card, padding:30, textAlign:"center", fontSize:12, color:"var(--t3)" }}>No reviews found</div> : (
                <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  {reviews.map(r => (
                    <div key={r.review_id||r.id} style={{ ...card, padding:16 }}>
                      <div style={{ display:"flex", gap:12, alignItems:"flex-start" }}>
                        <div style={{ flex:1 }}>
                          <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:6 }}>
                            <span style={{ fontSize:12, fontWeight:600, color:"var(--t1)" }}>{r.reviewer_name||r.name||"Anonymous"}</span>
                            <span style={{ fontSize:14 }}>{"★".repeat(parseInt(r.rating)||0)}{"☆".repeat(5-(parseInt(r.rating)||0))}</span>
                            <span style={{ fontSize:9, color:"var(--t3)" }}>{r.date_created?.split(" ")[0]}</span>
                          </div>
                          <div style={{ fontSize:12, color:"var(--t2)", lineHeight:1.5 }}>{r.review||r.content||"—"}</div>
                        </div>
                        <a href={`${ADMIN_URL}/reviews/view/${r.review_id||r.id}`} target="_blank" rel="noreferrer"
                          style={{ padding:"5px 10px", borderRadius:6, background:`${C.amber}22`, border:`0.5px solid ${C.amber}44`, color:C.amber, fontSize:10, textDecoration:"none", flexShrink:0 }}>View ↗</a>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </>
        )}

        {/* SITE */}
        {tab === "site" && (
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <div style={{ ...card, padding:20 }}>
                <div style={{ fontSize:13, fontWeight:700, color:"var(--t1)", marginBottom:14 }}><Icon name="🔧" size={12} style={{marginRight:6,verticalAlign:"middle"}} />Fix Forms (reCAPTCHA)</div>
                <div style={{ fontSize:12, color:"var(--t2)", lineHeight:1.6, marginBottom:12 }}>
                  If your forms are broken, it's almost always a reCAPTCHA issue. Your keys are already in the system below — just paste them into BD admin.
                </div>
                <div style={{ background:"var(--bg3)", border:"0.5px solid var(--b1)", borderRadius:8, padding:12, fontFamily:"monospace", fontSize:10, color:"var(--teal)", marginBottom:12 }}>
                  Site Key: 6LfEY-wsAAAAAK06qTliunhzksOdr65LGDZirpCZ<br/>
                  Secret Key: 6LfEY-wsAAAAAOg8fjeZeIpW5AknufbRFNvFLdsJ
                </div>
                <a href={`${ADMIN_URL}/settings/general`} target="_blank" rel="noreferrer"
                  style={{ display:"inline-block", padding:"8px 16px", borderRadius:8, background:"var(--teal)22", border:"0.5px solid var(--teal)55", color:"var(--teal)", fontSize:12, fontWeight:600, textDecoration:"none" }}><Icon name="→" size={12} style={{marginRight:6,verticalAlign:"middle"}} />BD Admin: Settings → Integrations ↗
                </a>
              </div>
              <div style={{ ...card, padding:20 }}>
                <div style={{ fontSize:13, fontWeight:700, color:"var(--t1)", marginBottom:14 }}><Icon name="📊" size={12} style={{marginRight:6,verticalAlign:"middle"}} />Analytics</div>
                <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  {[
                    { label:"Google Analytics 4",    url:"https://analytics.google.com",                           color:C.amber },
                    { label:"Google Search Console", url:"https://search.google.com/search-console",               color:C.blue },
                    { label:"BD Analytics",          url:`${ADMIN_URL}/analytics`,                                  color:C.teal },
                    { label:"Form Inquiries",        url:`${ADMIN_URL}/forms/inquiries`,                            color:C.purple },
                  ].map(l => (
                    <a key={l.label} href={l.url} target="_blank" rel="noreferrer" style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 12px", borderRadius:8, background:"var(--bg3)", border:`0.5px solid ${l.color}33`, textDecoration:"none" }}>
                      <span style={{ fontSize:12, color:l.color, fontWeight:600, flex:1 }}>{l.label}</span>
                      <Icon name="↗" size={11} />
                    </a>
                  ))}
                </div>
              </div>
            </div>
            {/* Site iframe */}
            <div style={{ ...card, overflow:"hidden" }}>
              <div style={{ padding:"8px 14px", borderBottom:"0.5px solid var(--b1)", display:"flex", alignItems:"center", gap:8 }}>
                <div style={{ width:8, height:8, borderRadius:"50%", background:C.teal }} />
                <Icon name="ceogps.com — Live" size={10} />
                <a href={SITE_URL} target="_blank" rel="noreferrer" style={{ fontSize:10, color:C.teal, textDecoration:"none" }}>Open full site ↗</a>
              </div>
              <iframe src={SITE_URL} style={{ width:"100%", height:500, border:"none" }} title="CEO GPS Live" />
            </div>
          </div>
        )}
      </div>

      {/* Add Member Modal */}
      {newMember && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.8)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center" }}
          onClick={e => { if(e.target===e.currentTarget) setNewMember(false); }}>
          <div style={{ ...card, width:460, padding:24, border:"1px solid var(--b2)" }}>
            <div style={{ fontSize:15, fontWeight:700, color:"var(--t1)", marginBottom:16 }}>Add New Member</div>
            {[["First Name","first_name","text"],["Last Name","last_name","text"],["Email","email","email"],["Password","password","password"],["Membership Plan ID","subscription_id","text"]].map(([label,key,type]) => (
              <div key={key} style={{ marginBottom:10 }}>
                <div style={{ fontSize:10, color:"var(--t2)", marginBottom:4 }}>{label}{key==="subscription_id"?" (find in BD Admin → Plans)":""}</div>
                <input type={type} value={newForm[key]||""} onChange={e => setNewForm(f => ({...f,[key]:e.target.value}))} style={inp} />
              </div>
            ))}
            <div style={{ display:"flex", gap:8, marginTop:14 }}>
              <button onClick={() => setNewMember(false)} style={{ flex:1, padding:"9px", borderRadius:8, background:"var(--bg3)", border:"0.5px solid var(--b2)", color:"var(--t2)", cursor:"pointer" }}>Cancel</button>
              <button onClick={createMember} disabled={saving} style={{ flex:1, padding:"9px", borderRadius:8, background:"var(--teal)", border:"none", color:"#000", fontWeight:700, cursor:"pointer", opacity:saving?0.6:1 }}>
                {saving ? "Creating..." : "Create Member"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}