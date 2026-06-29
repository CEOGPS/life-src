import { useState, useEffect } from "react";
import Icon from "@/components/lifeos/icons/Icon";

const C = { teal:"#00c896", blue:"#4a9eff", purple:"#8b7fff", amber:"#ffb347", green:"#3dd68c", red:"#ff4f5e", pink:"#ff6b9d" };
const card = { background:"var(--bg2)", border:"0.5px solid var(--b1)", borderRadius:10 };
const inp = { width:"100%", padding:"8px 12px", borderRadius:8, border:"0.5px solid var(--b2)", background:"var(--bg3)", color:"var(--t1)", fontSize:12, outline:"none", boxSizing:"border-box" };

const STATUSES = ["Discovery","In Progress","Review","Complete","On Hold"];
const STATUS_COLORS = { Discovery:C.amber, "In Progress":C.blue, Review:C.purple, Complete:C.green, "On Hold":"#6aaedd" };

function load(k,f){try{return JSON.parse(localStorage.getItem(k)||"null")??f;}catch{return f;}}
function save(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch{}}

const BLANK_PROJECT = { name:"", client:"", email:"", phone:"", status:"Discovery", budget:"", deadline:"", description:"", tasks:[], notes:"", tags:[] };

export default function ProjectsPanel() {
  const [projects, setProjects] = useState(() => load("lifeos_projects", []));
  const [active, setActive] = useState(null);
  const [view, setView] = useState("board"); // board | list | detail
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(BLANK_PROJECT);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [taskInput, setTaskInput] = useState("");

  useEffect(() => { save("lifeos_projects", projects); }, [projects]);

  const filtered = projects.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.client.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "All" || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  function saveProject() {
    if (!form.name.trim()) return;
    if (form.id) {
      setProjects(prev => prev.map(p => p.id === form.id ? { ...form } : p));
    } else {
      const newP = { ...form, id: Date.now(), created: new Date().toLocaleDateString(), tasks: [], notes: form.notes || "" };
      setProjects(prev => [newP, ...prev]);
    }
    setAdding(false);
    setForm(BLANK_PROJECT);
  }

  function deleteProject(id) {
    setProjects(prev => prev.filter(p => p.id !== id));
    if (active?.id === id) { setActive(null); setView("board"); }
  }

  function updateStatus(id, status) {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, status } : p));
    if (active?.id === id) setActive(prev => ({ ...prev, status }));
  }

  function addTask() {
    if (!taskInput.trim() || !active) return;
    const task = { id: Date.now(), text: taskInput.trim(), done: false };
    const updated = projects.map(p => p.id === active.id ? { ...p, tasks: [...(p.tasks||[]), task] } : p);
    setProjects(updated);
    setActive(prev => ({ ...prev, tasks: [...(prev.tasks||[]), task] }));
    setTaskInput("");
  }

  function toggleTask(projectId, taskId) {
    const updated = projects.map(p => p.id === projectId
      ? { ...p, tasks: p.tasks.map(t => t.id === taskId ? { ...t, done: !t.done } : t) }
      : p);
    setProjects(updated);
    if (active?.id === projectId) setActive(updated.find(p => p.id === projectId));
  }

  function saveNotes(notes) {
    const updated = projects.map(p => p.id === active.id ? { ...p, notes } : p);
    setProjects(updated);
    setActive(prev => ({ ...prev, notes }));
  }

  const byStatus = STATUSES.reduce((acc, s) => { acc[s] = filtered.filter(p => p.status === s); return acc; }, {});

  return (
    <div style={{ height:"calc(100vh - 52px)", display:"flex", flexDirection:"column", overflow:"hidden" }}>

      {/* Header */}
      <div style={{ padding:"10px 20px", borderBottom:"0.5px solid var(--b1)", display:"flex", gap:10, alignItems:"center", background:"var(--bg2)", flexShrink:0 }}>
        <div style={{ fontSize:16, fontWeight:700, color:"var(--t1)" }}>Projects</div>
        <div style={{ fontSize:11, color:"var(--t2)" }}>{projects.length} total</div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search projects or clients..."
          style={{ padding:"6px 12px", borderRadius:20, border:"0.5px solid var(--b2)", background:"var(--bg3)", color:"var(--t1)", fontSize:11, outline:"none", width:220 }} />
        <div style={{ display:"flex", gap:4 }}>
          {["All", ...STATUSES].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} style={{ padding:"4px 10px", borderRadius:20, border:`0.5px solid ${statusFilter===s?(STATUS_COLORS[s]||"var(--teal)"):"var(--b2)"}`, background:statusFilter===s?`${STATUS_COLORS[s]||C.teal}22`:"transparent", color:statusFilter===s?STATUS_COLORS[s]||"var(--teal)":"var(--t2)", fontSize:10, cursor:"pointer", fontWeight:statusFilter===s?700:400 }}>{s}</button>
          ))}
        </div>
        <div style={{ display:"flex", gap:4, marginLeft:"auto" }}>
          {["board","list"].map(v => (
            <button key={v} onClick={() => setView(v)} style={{ padding:"5px 10px", borderRadius:6, background:view===v?"rgba(0,200,150,0.15)":"var(--bg3)", border:`0.5px solid ${view===v?"var(--teal)":"var(--b2)"}`, color:view===v?"var(--teal)":"var(--t2)", fontSize:10, cursor:"pointer" }}>
              {v==="board"?"⊞ Board":"☰ List"}
            </button>
          ))}
          <button onClick={() => { setForm(BLANK_PROJECT); setAdding(true); }} style={{ padding:"6px 16px", borderRadius:8, background:"var(--teal)", border:"none", color:"#000", fontSize:11, fontWeight:700, cursor:"pointer" }}>+ New Project</button>
        </div>
      </div>

      <div style={{ flex:1, overflow:"hidden", display:"flex" }}>

        {/* Board View */}
        {view === "board" && (
          <div style={{ flex:1, overflowX:"auto", padding:"16px", display:"flex", gap:12, alignItems:"flex-start" }}>
            {STATUSES.map(status => {
              const col = byStatus[status] || [];
              return (
                <div key={status} style={{ width:240, flexShrink:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
                    <div style={{ width:8, height:8, borderRadius:"50%", background:STATUS_COLORS[status] }} />
                    <span style={{ fontSize:11, fontWeight:700, color:"var(--t1)" }}>{status}</span>
                    <span style={{ fontSize:10, color:"var(--t3)" }}>{col.length}</span>
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                    {col.map(p => (
                      <div key={p.id} onClick={() => { setActive(p); setView("detail"); }}
                        style={{ ...card, padding:14, cursor:"pointer", transition:"all .15s" }}
                        onMouseEnter={e => e.currentTarget.style.borderColor=STATUS_COLORS[p.status]+"55"}
                        onMouseLeave={e => e.currentTarget.style.borderColor="var(--b1)"}>
                        <div style={{ fontSize:12, fontWeight:600, color:"var(--t1)", marginBottom:4 }}>{p.name}</div>
                        <div style={{ fontSize:10, color:"var(--t2)", marginBottom:8 }}>{p.client}</div>
                        {p.budget && <div style={{ fontSize:10, color:C.green, marginBottom:4 }}>💰 {p.budget}</div>}
                        {p.deadline && <div style={{ fontSize:10, color:C.amber }}>📅 {p.deadline}</div>}
                        {p.tasks?.length > 0 && (
                          <div style={{ marginTop:8, height:3, borderRadius:2, background:"var(--bg4)" }}>
                            <div style={{ width:`${(p.tasks.filter(t=>t.done).length/p.tasks.length)*100}%`, height:"100%", background:STATUS_COLORS[p.status], borderRadius:2 }} />
                          </div>
                        )}
                        <div style={{ marginTop:8, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                          <span style={{ fontSize:9, color:"var(--t3)" }}>{p.tasks?.filter(t=>t.done).length||0}/{p.tasks?.length||0} tasks</span>
                          <button onClick={e=>{e.stopPropagation();deleteProject(p.id);}} style={{ fontSize:10, color:"var(--red)", background:"none", border:"none", cursor:"pointer" }}><Icon name="✕" size={14} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* List View */}
        {view === "list" && (
          <div style={{ flex:1, overflowY:"auto", padding:"16px" }}>
            {filtered.length === 0 ? (
              <div style={{ ...card, padding:40, textAlign:"center" }}>
                <div style={{ fontSize:32, marginBottom:10 }}><Icon name="📋" size={14} /></div>
                <div style={{ fontSize:14, fontWeight:600, color:"var(--t1)", marginBottom:6 }}>No projects yet</div>
                <div style={{ fontSize:12, color:"var(--t2)", marginBottom:16 }}>Create your first client project to track work, tasks, and notes.</div>
                <button onClick={() => { setForm(BLANK_PROJECT); setAdding(true); }} style={{ padding:"9px 20px", borderRadius:8, background:"var(--teal)", border:"none", color:"#000", fontWeight:700, cursor:"pointer" }}>+ New Project</button>
              </div>
            ) : (
              <div style={{ ...card, overflow:"hidden" }}>
                <table style={{ width:"100%", borderCollapse:"collapse" }}>
                  <thead>
                    <tr style={{ borderBottom:"0.5px solid var(--b1)" }}>
                      {["Project","Client","Status","Budget","Deadline","Progress",""].map(h => (
                        <th key={h} style={{ padding:"10px 14px", textAlign:"left", fontSize:9, color:"var(--t3)", fontWeight:700, textTransform:"uppercase" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(p => (
                      <tr key={p.id} style={{ borderBottom:"0.5px solid var(--b1)", cursor:"pointer" }}
                        onClick={() => { setActive(p); setView("detail"); }}
                        onMouseEnter={e => e.currentTarget.style.background="var(--bg3)"}
                        onMouseLeave={e => e.currentTarget.style.background=""}>
                        <td style={{ padding:"12px 14px", fontSize:12, fontWeight:600, color:"var(--t1)" }}>{p.name}</td>
                        <td style={{ padding:"12px 14px", fontSize:12, color:"var(--t2)" }}>{p.client}</td>
                        <td style={{ padding:"12px 14px" }}>
                          <span style={{ fontSize:10, padding:"3px 9px", borderRadius:20, background:STATUS_COLORS[p.status]+"22", color:STATUS_COLORS[p.status], fontWeight:600 }}>{p.status}</span>
                        </td>
                        <td style={{ padding:"12px 14px", fontSize:12, color:C.green }}>{p.budget||"—"}</td>
                        <td style={{ padding:"12px 14px", fontSize:12, color:"var(--t2)" }}>{p.deadline||"—"}</td>
                        <td style={{ padding:"12px 14px" }}>
                          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                            <div style={{ width:60, height:4, borderRadius:2, background:"var(--bg4)" }}>
                              <div style={{ width:`${p.tasks?.length ? (p.tasks.filter(t=>t.done).length/p.tasks.length)*100 : 0}%`, height:"100%", background:STATUS_COLORS[p.status], borderRadius:2 }} />
                            </div>
                            <span style={{ fontSize:10, color:"var(--t3)" }}>{p.tasks?.filter(t=>t.done).length||0}/{p.tasks?.length||0}</span>
                          </div>
                        </td>
                        <td style={{ padding:"12px 14px" }}>
                          <button onClick={e=>{e.stopPropagation();deleteProject(p.id);}} style={{ fontSize:11, color:"var(--red)", background:"none", border:"none", cursor:"pointer" }}><Icon name="✕" size={14} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Detail View */}
        {view === "detail" && active && (
          <div style={{ flex:1, overflowY:"auto", padding:"20px", display:"grid", gridTemplateColumns:"1fr 320px", gap:16, alignItems:"start" }}>
            {/* Left */}
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                <button onClick={() => setView("board")} style={{ padding:"5px 12px", borderRadius:6, background:"var(--bg3)", border:"0.5px solid var(--b2)", color:"var(--t2)", fontSize:11, cursor:"pointer" }}><Icon name="←" size={12} style={{marginRight:6,verticalAlign:"middle"}} />Back</button>
                <div style={{ fontSize:20, fontWeight:700, color:"var(--t1)" }}>{active.name}</div>
                <select value={active.status} onChange={e => updateStatus(active.id, e.target.value)}
                  style={{ padding:"4px 10px", borderRadius:20, border:`0.5px solid ${STATUS_COLORS[active.status]}`, background:`${STATUS_COLORS[active.status]}22`, color:STATUS_COLORS[active.status], fontSize:11, cursor:"pointer", outline:"none" }}>
                  {STATUSES.map(s => <option key={s}>{s}</option>)}
                </select>
                <button onClick={() => { setForm({ ...active }); setAdding(true); }} style={{ marginLeft:"auto", padding:"5px 12px", borderRadius:6, background:"var(--bg3)", border:"0.5px solid var(--b2)", color:"var(--t2)", fontSize:11, cursor:"pointer" }}>Edit</button>
              </div>

              {/* Tasks */}
              <div style={{ ...card, padding:16 }}>
                <div style={{ fontSize:12, fontWeight:700, color:"var(--t1)", marginBottom:12 }}>Tasks</div>
                <div style={{ display:"flex", gap:8, marginBottom:12 }}>
                  <input value={taskInput} onChange={e=>setTaskInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addTask()}
                    placeholder="Add a task..." style={{ ...inp, flex:1 }} />
                  <button onClick={addTask} style={{ padding:"8px 16px", borderRadius:8, background:"var(--teal)", border:"none", color:"#000", fontWeight:700, cursor:"pointer" }}>+</button>
                </div>
                {(active.tasks||[]).length === 0
                  ? <div style={{ fontSize:11, color:"var(--t3)", fontStyle:"italic" }}>No tasks yet</div>
                  : (active.tasks||[]).map(task => (
                    <div key={task.id} style={{ display:"flex", gap:8, alignItems:"center", padding:"8px 0", borderBottom:"0.5px solid var(--b1)" }}>
                      <input type="checkbox" checked={task.done} onChange={() => toggleTask(active.id, task.id)} style={{ accentColor:"var(--teal)", flexShrink:0 }} />
                      <span style={{ flex:1, fontSize:12, color:task.done?"var(--t3)":"var(--t1)", textDecoration:task.done?"line-through":"none" }}>{task.text}</span>
                    </div>
                  ))
                }
              </div>

              {/* Notes */}
              <div style={{ ...card, padding:16 }}>
                <div style={{ fontSize:12, fontWeight:700, color:"var(--t1)", marginBottom:10 }}>Notes</div>
                <textarea value={active.notes||""} onChange={e => saveNotes(e.target.value)}
                  placeholder="Project notes, requirements, links..."
                  style={{ ...inp, minHeight:120, resize:"vertical", lineHeight:1.6 }} />
              </div>
            </div>

            {/* Right */}
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              <div style={{ ...card, padding:16 }}>
                <div style={{ fontSize:11, fontWeight:700, color:"var(--t1)", marginBottom:12 }}>Client Info</div>
                {[["Client", active.client], ["Email", active.email], ["Phone", active.phone], ["Budget", active.budget], ["Deadline", active.deadline]].map(([k,v]) => v ? (
                  <div key={k} style={{ display:"flex", gap:8, marginBottom:8 }}>
                    <span style={{ fontSize:10, color:"var(--t2)", width:60, flexShrink:0 }}>{k}</span>
                    <span style={{ fontSize:11, color:"var(--t1)" }}>{v}</span>
                  </div>
                ) : null)}
                {active.description && (
                  <div style={{ marginTop:8, fontSize:11, color:"var(--t2)", lineHeight:1.5 }}>{active.description}</div>
                )}
              </div>
              <div style={{ ...card, padding:16 }}>
                <div style={{ fontSize:11, fontWeight:700, color:"var(--t1)", marginBottom:10 }}>Progress</div>
                <div style={{ fontSize:28, fontWeight:800, color:STATUS_COLORS[active.status], marginBottom:6 }}>
                  {active.tasks?.length ? Math.round((active.tasks.filter(t=>t.done).length/active.tasks.length)*100) : 0}%
                </div>
                <div style={{ height:6, borderRadius:3, background:"var(--bg4)", marginBottom:8 }}>
                  <div style={{ width:`${active.tasks?.length?(active.tasks.filter(t=>t.done).length/active.tasks.length)*100:0}%`, height:"100%", background:STATUS_COLORS[active.status], borderRadius:3, transition:"width .3s" }} />
                </div>
                <div style={{ fontSize:10, color:"var(--t3)" }}>{active.tasks?.filter(t=>t.done).length||0} of {active.tasks?.length||0} tasks done</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {adding && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.8)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center" }}
          onClick={e => { if(e.target===e.currentTarget) setAdding(false); }}>
          <div style={{ ...card, width:520, padding:24, border:"1px solid var(--b2)", maxHeight:"90vh", overflowY:"auto" }}>
            <div style={{ fontSize:15, fontWeight:700, color:"var(--t1)", marginBottom:16 }}>{form.id ? "Edit Project" : "New Project"}</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
              {[["Project Name","name","text","e.g. CEO GPS Redesign"],["Client Name","client","text","Client company or person"],["Email","email","email","client@email.com"],["Phone","phone","tel","(404) 555-0000"],["Budget","budget","text","$5,000"],["Deadline","deadline","date",""]].map(([label,key,type,ph]) => (
                <div key={key}>
                  <div style={{ fontSize:10, color:"var(--t2)", marginBottom:4 }}>{label}</div>
                  <input type={type} value={form[key]||""} onChange={e => setForm(f=>({...f,[key]:e.target.value}))} placeholder={ph} style={inp} />
                </div>
              ))}
            </div>
            <div style={{ marginBottom:10 }}>
              <div style={{ fontSize:10, color:"var(--t2)", marginBottom:4 }}>Status</div>
              <select value={form.status} onChange={e => setForm(f=>({...f,status:e.target.value}))} style={inp}>
                {STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:10, color:"var(--t2)", marginBottom:4 }}>Description</div>
              <textarea value={form.description||""} onChange={e => setForm(f=>({...f,description:e.target.value}))} placeholder="Project overview, goals, scope..." style={{ ...inp, minHeight:80, resize:"vertical" }} />
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={() => setAdding(false)} style={{ flex:1, padding:"9px", borderRadius:8, background:"var(--bg3)", border:"0.5px solid var(--b2)", color:"var(--t2)", cursor:"pointer" }}>Cancel</button>
              <button onClick={saveProject} style={{ flex:1, padding:"9px", borderRadius:8, background:"var(--teal)", border:"none", color:"#000", fontWeight:700, cursor:"pointer" }}>{form.id ? "Save Changes" : "Create Project"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
