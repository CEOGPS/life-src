import { useState, useRef, useEffect } from "react";
import { invokeLLM, saveApiKey, getApiKey } from "@/api/ceogpsclient.jsx";
import Icon from "@/components/lifeos/icons/Icon";

const C = { blue:"#4ab3f4", orange:"#ff8c42", teal:"#00c896", purple:"#8b7fff", pink:"#ff6b9d", red:"#ff4f5e" };
const card = { background:"#13141f", border:"0.5px solid rgba(255,255,255,0.07)", borderRadius:12 };

const STORAGE_KEY = "family_members_v2";
const BLANK_SOCIALS = { instagram:"", twitter:"", linkedin:"", facebook:"", tiktok:"", youtube:"" };

const DEFAULT_MEMBERS = [
  { id:1, name:"Chris Green", relation:"You", birthday:"1985-03-15", phone:"", email:"chris@ceogps.com",
    extraPhones:[], extraEmails:[], socials:{ ...BLANK_SOCIALS }, websites:[],
    photo:"", notes:"Head of household. Plumbing business owner.", favorites:{ food:"Steak", color:"Blue", hobby:"Music", movie:"" },
    reminders:[], tags:["Head of House"], kpi:{ connect:8, support:9, milestone:"Business growing" } },
];

function newMember() {
  return { id: Date.now(), name:"", relation:"", birthday:"", phone:"", email:"",
    extraPhones:[], extraEmails:[], socials:{ ...BLANK_SOCIALS }, websites:[],
    photo:"", notes:"", favorites:{ food:"", color:"", hobby:"", movie:"" },
    reminders:[], tags:[], kpi:{ connect:5, support:5, milestone:"" } };
}

// Helper: renders a multi-value field list with "+ Add" button
function MultiField({ label, values=[], onChange, type="text", placeholder="" }) {
  const addBtn = { fontSize:10, color:"#4ab3f4", background:"none", border:"none", cursor:"pointer", padding:"4px 0", display:"block" };
  const remBtn = { background:"none", border:"none", color:"#ff4f5e", cursor:"pointer", fontSize:18, padding:"0 4px", lineHeight:1, flexShrink:0 };
  return (
    <div style={{ marginBottom:4 }}>
      {values.map((v,i) => (
        <div key={i} style={{ display:"flex", gap:6, marginBottom:6 }}>
          <input type={type} value={v} placeholder={placeholder}
            onChange={e => { const n=[...values]; n[i]=e.target.value; onChange(n); }}
            style={{ width:"100%", padding:"8px 10px", borderRadius:7, border:"0.5px solid rgba(255,255,255,0.12)", background:"#0d0e17", color:"#f0ede8", fontSize:12, outline:"none", boxSizing:"border-box", flex:1 }} />
          <button onClick={() => onChange(values.filter((_,j)=>j!==i))} style={remBtn}>×</button>
        </div>
      ))}
      <button onClick={() => onChange([...values,""])} style={addBtn}>+ Add {label}</button>
    </div>
  );
}

const inp = { width:"100%", padding:"8px 10px", borderRadius:7, border:"0.5px solid rgba(255,255,255,0.12)",
  background:"#0d0e17", color:"#f0ede8", fontSize:12, outline:"none", boxSizing:"border-box" };
const btn = (bg, color="#fff") => ({ padding:"7px 16px", borderRadius:8, background:bg,
  border:"none", color, fontSize:12, fontWeight:600, cursor:"pointer" });

export default function FamilyPanel() {
  const [members, setMembers] = useState(DEFAULT_MEMBERS);
  const [selected, setSelected] = useState(null); // member id
  const [view, setView] = useState("list"); // list | profile | add | edit
  const [form, setForm] = useState(null);
  const [aiResult, setAiResult] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [reminderInput, setReminderInput] = useState("");
  const [tagInput, setTagInput] = useState("");
  const photoRef = useRef(null);

  // Persist to Supabase
  useEffect(() => {
    getApiKey(STORAGE_KEY).then(saved => {
      if (saved) {
        try { setMembers(JSON.parse(saved)); } catch {}
      }
    });
  }, []);

  async function persist(updated) {
    setMembers(updated);
    await saveApiKey(STORAGE_KEY, JSON.stringify(updated));
  }

  function openProfile(id) { setSelected(id); setView("profile"); }
  function openEdit(id) {
    const m = members.find(x => x.id === id);
    setForm(JSON.parse(JSON.stringify(m)));
    setView("edit");
  }
  function openAdd() { setForm(newMember()); setView("add"); setSelected(null); }

  async function saveForm() {
    if (!form.name.trim()) return;
    let updated;
    if (view === "add") {
      updated = [...members, { ...form, id: Date.now() }];
    } else {
      updated = members.map(m => m.id === form.id ? form : m);
    }
    await persist(updated);
    setView(view === "add" ? "list" : "profile");
    if (view === "edit") setSelected(form.id);
  }

  async function deleteMember(id) {
    if (!window.confirm("Remove this family member?")) return;
    const updated = members.filter(m => m.id !== id);
    await persist(updated);
    setView("list");
    setSelected(null);
  }

  function handlePhotoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setForm(f => ({ ...f, photo: reader.result }));
    reader.readAsDataURL(file);
  }

  function addReminder() {
    if (!reminderInput.trim()) return;
    setForm(f => ({ ...f, reminders: [...(f.reminders||[]), { text: reminderInput, date: "", done: false }] }));
    setReminderInput("");
  }

  function addTag() {
    if (!tagInput.trim()) return;
    setForm(f => ({ ...f, tags: [...(f.tags||[]), tagInput.trim()] }));
    setTagInput("");
  }

  async function runAI(member) {
    setAiLoading(true); setAiResult("");
    const prompt = `Analyze this family member profile and give Chris Green 3 specific, actionable ways to strengthen this relationship this week:
Name: ${member.name}, Relation: ${member.relation}
Favorites: Food-${member.favorites?.food}, Hobby-${member.favorites?.hobby}, Color-${member.favorites?.color}
Notes: ${member.notes}
Connection KPI: ${member.kpi?.connect}/10, Support KPI: ${member.kpi?.support}/10
Current milestone: ${member.kpi?.milestone}
Give practical, specific suggestions. Be concise.`;
    const res = await invokeLLM({ prompt });
    setAiResult(res);
    setAiLoading(false);
  }

  const selectedMember = members.find(m => m.id === selected);

  // ── LIST VIEW ──
  if (view === "list") return (
    <div style={{ padding:20, height:"100%", overflowY:"auto" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
        <div>
          <div style={{ fontSize:18, fontWeight:700, color:"#f0ede8" }}>👨‍👩‍👧‍👦 Family Hub</div>
          <div style={{ fontSize:11, color:"#666", marginTop:2 }}>Know your family deeply — profiles, KPIs, reminders & more</div>
        </div>
        <button onClick={openAdd} style={btn("linear-gradient(135deg,#4ab3f4,#8b7fff)")}>+ Add Member</button>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:14 }}>
        {members.map(m => (
          <div key={m.id} onClick={() => openProfile(m.id)}
            style={{ ...card, padding:16, cursor:"pointer", transition:"all .2s",
              borderColor:"rgba(255,255,255,0.1)" }}
            onMouseEnter={e => e.currentTarget.style.borderColor = "#4ab3f4"}
            onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"}>
            {/* Avatar */}
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:10 }}>
              <div style={{ width:64, height:64, borderRadius:"50%", overflow:"hidden",
                background:"linear-gradient(135deg,#4ab3f4,#ff8c42)",
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:22, fontWeight:700, color:"#0d0e17", flexShrink:0 }}>
                {m.photo
                  ? <img src={m.photo} alt={m.name} style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                  : m.name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase()}
              </div>
              <div style={{ textAlign:"center" }}>
                <div style={{ fontSize:13, fontWeight:600, color:"#f0ede8" }}>{m.name}</div>
                <div style={{ fontSize:11, color:"#666" }}>{m.relation}</div>
              </div>
              {/* KPI mini bars */}
              <div style={{ width:"100%", display:"flex", flexDirection:"column", gap:4 }}>
                {[["Connect", m.kpi?.connect, C.teal], ["Support", m.kpi?.support, C.purple]].map(([label, val, color]) => (
                  <div key={label}>
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:9, color:"#666", marginBottom:2 }}>
                      <span>{label}</span><span>{val}/10</span>
                    </div>
                    <div style={{ height:3, background:"rgba(255,255,255,0.08)", borderRadius:2 }}>
                      <div style={{ height:"100%", width:`${(val||0)*10}%`, background:color, borderRadius:2 }} />
                    </div>
                  </div>
                ))}
              </div>
              {m.tags?.length > 0 && (
                <div style={{ display:"flex", flexWrap:"wrap", gap:4, justifyContent:"center" }}>
                  {m.tags.slice(0,3).map(t => (
                    <span key={t} style={{ fontSize:9, padding:"2px 6px", borderRadius:10,
                      background:"rgba(139,127,255,0.15)", color:C.purple }}>{t}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Add card */}
        <div onClick={openAdd} style={{ ...card, padding:16, cursor:"pointer", display:"flex",
          flexDirection:"column", alignItems:"center", justifyContent:"center", gap:8, minHeight:180,
          border:"0.5px dashed rgba(74,179,244,0.3)" }}
          onMouseEnter={e => e.currentTarget.style.borderColor = "#4ab3f4"}
          onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(74,179,244,0.3)"}>
          <div style={{ fontSize:28, color:"rgba(74,179,244,0.5)" }}>+</div>
          <div style={{ fontSize:11, color:"#555" }}>Add Family Member</div>
        </div>
      </div>
    </div>
  );

  // ── PROFILE VIEW ──
  if (view === "profile" && selectedMember) {
    const m = selectedMember;
    return (
      <div style={{ padding:20, height:"100%", overflowY:"auto" }}>
        <div style={{ display:"flex", gap:10, alignItems:"center", marginBottom:20 }}>
          <button onClick={() => setView("list")} style={btn("rgba(255,255,255,0.08)", "#f0ede8")}><Icon name="←" size={12} style={{marginRight:6,verticalAlign:"middle"}} />Back</button>
          <button onClick={() => openEdit(m.id)} style={btn("rgba(74,179,244,0.15)", C.blue)}><Icon name="✏️" size={12} style={{marginRight:6,verticalAlign:"middle"}} />Edit</button>
          <button onClick={() => deleteMember(m.id)} style={btn("rgba(255,79,94,0.15)", C.red)}><Icon name="🗑" size={12} style={{marginRight:6,verticalAlign:"middle"}} />Remove</button>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"280px 1fr", gap:18, alignItems:"start" }}>
          {/* Left — avatar + basics */}
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div style={{ ...card, padding:20, display:"flex", flexDirection:"column", alignItems:"center", gap:12 }}>
              <div style={{ width:100, height:100, borderRadius:"50%", overflow:"hidden",
                background:"linear-gradient(135deg,#4ab3f4,#ff8c42)",
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:32, fontWeight:700, color:"#0d0e17" }}>
                {m.photo
                  ? <img src={m.photo} alt={m.name} style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                  : m.name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase()}
              </div>
              <div style={{ textAlign:"center" }}>
                <div style={{ fontSize:18, fontWeight:700, color:"#f0ede8" }}>{m.name}</div>
                <div style={{ fontSize:12, color:"#666" }}>{m.relation}</div>
                {m.birthday && <div style={{ fontSize:11, color:"#555", marginTop:4 }}>🎂 {m.birthday}</div>}
              </div>
              {[m.phone,...(m.extraPhones||[])].filter(Boolean).map((p,i) => (
                <div key={i} style={{ fontSize:12, color:"#aaa" }}>📱 {p}</div>
              ))}
              {[m.email,...(m.extraEmails||[])].filter(Boolean).map((e,i) => (
                <div key={i} style={{ fontSize:12, color:"#aaa" }}>✉️ {e}</div>
              ))}
              {(m.websites||[]).filter(Boolean).map((w,i) => (
                <a key={i} href={w} target="_blank" rel="noreferrer" style={{ fontSize:12, color:C.blue, textDecoration:"none" }}>🌐 {w}</a>
              ))}
              {Object.entries(m.socials||{}).filter(([,v])=>v).map(([k,v]) => (
                <div key={k} style={{ fontSize:11, color:"#888" }}>{k}: {v}</div>
              ))}
            </div>

            {/* Tags */}
            {m.tags?.length > 0 && (
              <div style={{ ...card, padding:14 }}>
                <div style={{ fontSize:11, color:"#666", marginBottom:8 }}>TAGS</div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                  {m.tags.map(t => (
                    <span key={t} style={{ fontSize:11, padding:"3px 8px", borderRadius:12,
                      background:"rgba(139,127,255,0.15)", color:C.purple }}>{t}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Favorites */}
            <div style={{ ...card, padding:14 }}>
              <div style={{ fontSize:11, color:"#666", marginBottom:10 }}>FAVORITES ⭐</div>
              {Object.entries(m.favorites||{}).filter(([,v])=>v).map(([k,v]) => (
                <div key={k} style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                  <span style={{ fontSize:11, color:"#666", textTransform:"capitalize" }}>{k}</span>
                  <span style={{ fontSize:11, color:"#f0ede8" }}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right */}
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            {/* KPIs */}
            <div style={{ ...card, padding:16 }}>
              <div style={{ fontSize:12, fontWeight:600, color:"#f0ede8", marginBottom:12 }}><Icon name="📊" size={12} style={{marginRight:6,verticalAlign:"middle"}} />Relationship KPIs</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:12 }}>
                {[["Connection", m.kpi?.connect, C.teal], ["Support", m.kpi?.support, C.purple]].map(([label, val, color]) => (
                  <div key={label} style={{ textAlign:"center" }}>
                    <div style={{ fontSize:28, fontWeight:700, color }}>{val}<Icon name="/10" size={14} /></div>
                    <div style={{ fontSize:11, color:"#666" }}>{label}</div>
                    <div style={{ height:4, background:"rgba(255,255,255,0.08)", borderRadius:2, marginTop:6 }}>
                      <div style={{ height:"100%", width:`${(val||0)*10}%`, background:color, borderRadius:2, transition:"width .4s" }} />
                    </div>
                  </div>
                ))}
              </div>
              {m.kpi?.milestone && (
                <div style={{ padding:"8px 12px", borderRadius:8, background:"rgba(0,200,150,0.08)",
                  border:"0.5px solid rgba(0,200,150,0.2)", fontSize:12, color:C.teal }}>
                  🎯 {m.kpi.milestone}
                </div>
              )}
            </div>

            {/* Notes */}
            {m.notes && (
              <div style={{ ...card, padding:14 }}>
                <div style={{ fontSize:11, color:"#666", marginBottom:8 }}>NOTES</div>
                <div style={{ fontSize:12, color:"#aaa", lineHeight:1.6 }}>{m.notes}</div>
              </div>
            )}

            {/* Reminders */}
            {m.reminders?.length > 0 && (
              <div style={{ ...card, padding:14 }}>
                <div style={{ fontSize:11, color:"#666", marginBottom:8 }}>REMINDERS</div>
                {m.reminders.map((r,i) => (
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                    <span style={{ fontSize:12 }}>{r.done ? "✅" : "🔔"}</span>
                    <span style={{ fontSize:12, color: r.done ? "#555" : "#f0ede8", textDecoration: r.done ? "line-through" : "none" }}>{r.text}</span>
                  </div>
                ))}
              </div>
            )}

            {/* AI Insight */}
            <div style={{ ...card, padding:14 }}>
              <div style={{ fontSize:11, color:"#666", marginBottom:10 }}>AI RELATIONSHIP COACH</div>
              <button onClick={() => runAI(m)} disabled={aiLoading}
                style={btn("linear-gradient(135deg,#8b7fff,#4ab3f4)")}>
                {aiLoading ? "Analyzing..." : "🤖 Get Relationship Tips"}
              </button>
              {aiResult && (
                <div style={{ marginTop:12, padding:12, borderRadius:8,
                  background:"rgba(139,127,255,0.08)", border:"0.5px solid rgba(139,127,255,0.2)",
                  fontSize:12, color:"#f0ede8", lineHeight:1.7, whiteSpace:"pre-wrap" }}>
                  {aiResult}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── ADD / EDIT FORM ──
  if ((view === "add" || view === "edit") && form) {
    const title = view === "add" ? "Add Family Member" : `Edit — ${form.name}`;
    const F = (field, label, type="text", placeholder="") => (
      <div style={{ marginBottom:12 }}>
        <label style={{ fontSize:11, color:"#666", display:"block", marginBottom:4 }}>{label}</label>
        <input type={type} value={form[field]||""} placeholder={placeholder}
          onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
          style={inp} />
      </div>
    );

    return (
      <div style={{ padding:20, height:"100%", overflowY:"auto" }}>
        <div style={{ display:"flex", gap:10, alignItems:"center", marginBottom:20 }}>
          <button onClick={() => { setView(view==="add"?"list":"profile"); if (view==="edit") setSelected(form.id); }}
            style={btn("rgba(255,255,255,0.08)", "#f0ede8")}><Icon name="←" size={12} style={{marginRight:6,verticalAlign:"middle"}} />Cancel</button>
          <div style={{ fontSize:16, fontWeight:700, color:"#f0ede8" }}>{title}</div>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:18 }}>
          {/* Col 1 */}
          <div>
            {/* Photo upload */}
            <div style={{ marginBottom:16 }}>
              <label style={{ fontSize:11, color:"#666", display:"block", marginBottom:6 }}>PHOTO</label>
              <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                <div style={{ width:60, height:60, borderRadius:"50%", overflow:"hidden",
                  background:"linear-gradient(135deg,#4ab3f4,#ff8c42)",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:18, fontWeight:700, color:"#0d0e17" }}>
                  {form.photo
                    ? <img src={form.photo} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                    : (form.name?.[0]||"?")}
                </div>
                <button onClick={() => photoRef.current?.click()}
                  style={btn("rgba(74,179,244,0.15)", C.blue)}><Icon name="📷" size={12} style={{marginRight:6,verticalAlign:"middle"}} />Upload</button>
                <input ref={photoRef} type="file" accept="image/*" style={{ display:"none" }} onChange={handlePhotoUpload} />
              </div>
            </div>
            {F("name","FULL NAME *","text","e.g. Sarah Green")}
            {F("relation","RELATION","text","e.g. Daughter")}
            {F("birthday","BIRTHDAY","date")}

            <div style={{ marginBottom:12 }}>
              <label style={{ fontSize:11, color:"#666", display:"block", marginBottom:4 }}>PHONE</label>
              <MultiField label="Phone" type="tel" placeholder="(555) 000-0000"
                values={[form.phone||"",...(form.extraPhones||[])]}
                onChange={vals => setForm(f => ({ ...f, phone: vals[0]||"", extraPhones: vals.slice(1) }))} />
            </div>

            <div style={{ marginBottom:12 }}>
              <label style={{ fontSize:11, color:"#666", display:"block", marginBottom:4 }}>EMAIL</label>
              <MultiField label="Email" type="email" placeholder="email@example.com"
                values={[form.email||"",...(form.extraEmails||[])]}
                onChange={vals => setForm(f => ({ ...f, email: vals[0]||"", extraEmails: vals.slice(1) }))} />
            </div>

            <div style={{ marginBottom:12 }}>
              <label style={{ fontSize:11, color:"#666", display:"block", marginBottom:4 }}>WEBSITES</label>
              <MultiField label="Website" type="url" placeholder="https://..."
                values={form.websites||[]}
                onChange={vals => setForm(f => ({ ...f, websites: vals }))} />
            </div>
          </div>

          {/* Col 2 */}
          <div>
            {/* Favorites */}
            <div style={{ marginBottom:12 }}>
              <label style={{ fontSize:11, color:"#666", display:"block", marginBottom:8 }}>FAVORITES ⭐</label>
              {["food","color","hobby","movie"].map(fav => (
                <div key={fav} style={{ marginBottom:8 }}>
                  <label style={{ fontSize:10, color:"#555", display:"block", marginBottom:3, textTransform:"capitalize" }}>{fav}</label>
                  <input value={form.favorites?.[fav]||""} placeholder={`Favorite ${fav}`}
                    onChange={e => setForm(f => ({ ...f, favorites: { ...f.favorites, [fav]: e.target.value } }))}
                    style={inp} />
                </div>
              ))}
            </div>

            <div style={{ marginBottom:12 }}>
              <label style={{ fontSize:11, color:"#666", display:"block", marginBottom:8 }}>SOCIALS</label>
              {[["📸 Instagram","instagram"],["🐦 X / Twitter","twitter"],["💼 LinkedIn","linkedin"],["📘 Facebook","facebook"],["🎵 TikTok","tiktok"],["▶️ YouTube","youtube"]].map(([lbl,key]) => (
                <div key={key} style={{ marginBottom:8 }}>
                  <label style={{ fontSize:10, color:"#555", display:"block", marginBottom:3 }}>{lbl}</label>
                  <input value={form.socials?.[key]||""} placeholder="@handle or URL"
                    onChange={e => setForm(f => ({ ...f, socials: { ...(f.socials||{}), [key]: e.target.value } }))}
                    style={inp} />
                </div>
              ))}
            </div>

            {/* KPIs */}
            <div style={{ marginBottom:12 }}>
              <label style={{ fontSize:11, color:"#666", display:"block", marginBottom:8 }}>RELATIONSHIP KPIs</label>
              {[["connect","Connection Score"],["support","Support Score"]].map(([k,label]) => (
                <div key={k} style={{ marginBottom:10 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"#aaa", marginBottom:4 }}>
                    <span>{label}</span><span>{form.kpi?.[k]||5}/10</span>
                  </div>
                  <input type="range" min="0" max="10" value={form.kpi?.[k]||5}
                    onChange={e => setForm(f => ({ ...f, kpi: { ...f.kpi, [k]: Number(e.target.value) } }))}
                    style={{ width:"100%", accentColor:"#00c896" }} />
                </div>
              ))}
              <input placeholder="Current milestone / goal..."
                value={form.kpi?.milestone||""}
                onChange={e => setForm(f => ({ ...f, kpi: { ...f.kpi, milestone: e.target.value } }))}
                style={inp} />
            </div>
          </div>
        </div>

        {/* Notes */}
        <div style={{ marginBottom:12 }}>
          <label style={{ fontSize:11, color:"#666", display:"block", marginBottom:4 }}>NOTES</label>
          <textarea value={form.notes||""} placeholder="Anything important to know or remember..."
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            style={{ ...inp, height:70, resize:"vertical" }} />
        </div>

        {/* Tags */}
        <div style={{ marginBottom:12 }}>
          <label style={{ fontSize:11, color:"#666", display:"block", marginBottom:6 }}>TAGS</label>
          <div style={{ display:"flex", gap:8, marginBottom:8 }}>
            <input value={tagInput} onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => e.key==="Enter" && addTag()} placeholder="Add tag..." style={{ ...inp, width:160 }} />
            <button onClick={addTag} style={btn("rgba(139,127,255,0.2)", "#8b7fff")}>Add</button>
          </div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
            {(form.tags||[]).map((t,i) => (
              <span key={i} style={{ fontSize:11, padding:"3px 8px", borderRadius:12,
                background:"rgba(139,127,255,0.15)", color:"#8b7fff", cursor:"pointer" }}
                onClick={() => setForm(f => ({ ...f, tags: f.tags.filter((_,j)=>j!==i) }))}>
                {t} ×
              </span>
            ))}
          </div>
        </div>

        {/* Reminders */}
        <div style={{ marginBottom:20 }}>
          <label style={{ fontSize:11, color:"#666", display:"block", marginBottom:6 }}>REMINDERS</label>
          <div style={{ display:"flex", gap:8, marginBottom:8 }}>
            <input value={reminderInput} onChange={e => setReminderInput(e.target.value)}
              onKeyDown={e => e.key==="Enter" && addReminder()} placeholder="Add reminder..." style={{ ...inp, flex:1 }} />
            <button onClick={addReminder} style={btn("rgba(74,179,244,0.2)", "#4ab3f4")}>Add</button>
          </div>
          {(form.reminders||[]).map((r,i) => (
            <div key={i} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
              <span style={{ fontSize:11 }}>🔔</span>
              <span style={{ fontSize:12, color:"#f0ede8", flex:1 }}>{r.text}</span>
              <button onClick={() => setForm(f => ({ ...f, reminders: f.reminders.filter((_,j)=>j!==i) }))}
                style={{ background:"none", border:"none", color:"#ff4f5e", cursor:"pointer", fontSize:14 }}>×</button>
            </div>
          ))}
        </div>

        <button onClick={saveForm} style={{ ...btn("linear-gradient(135deg,#4ab3f4,#8b7fff)"), padding:"10px 28px", fontSize:13 }}>
          {view === "add" ? "Add to Family" : "Save Changes"} ✓
        </button>
      </div>
    );
  }

  return null;
}
