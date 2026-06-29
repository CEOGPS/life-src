import { useState, useEffect, useRef } from "react";
import { invokeLLM, getApiKey } from "@/api/ceogpsclient.jsx";
import { kvSet } from "@/utils/storage";
import { dbFetch } from "@/lib/supabase";
import Icon from "@/components/lifeos/icons/Icon";

async function loadCRMContacts() {
  try {
    const data = await dbFetch("crm_contacts?order=created_at.desc&limit=500");
    return data || loadLocalCRM();
  } catch { return loadLocalCRM(); }
}

async function saveCRMContact(contact) {
  try {
    const { id, ...fields } = contact;
    if (id && !String(id).startsWith("local_")) {
      return await dbFetch(`crm_contacts?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(fields), prefer: "return=representation" });
    } else {
      return await dbFetch("crm_contacts", { method: "POST", body: JSON.stringify(fields), prefer: "return=representation" });
    }
  } catch { return null; }
}

async function deleteCRMContact(id) {
  try {
    if (!String(id).startsWith("local_")) {
      await dbFetch(`crm_contacts?id=eq.${id}`, { method: "DELETE", prefer: "" });
    }
  } catch {}
}

function loadLocalCRM() {
  try { return JSON.parse(localStorage.getItem("lifeos_crm") || "[]"); } catch { return []; }
}
async function saveLocalCRM(list) {
  localStorage.setItem("lifeos_crm", JSON.stringify(list));
  await kvSet("crm_contacts", list);
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const C = {
  blue: "#4ab3f4", orange: "#ff8c42", teal: "#00c896", purple: "#8b7fff", pink: "#ff6b9d", red: "#ff4f5e",
  glow: {
    blue:   "0 0 14px rgba(74,179,244,0.55),  0 0 30px rgba(74,179,244,0.2)",
    orange: "0 0 14px rgba(255,140,66,0.55),  0 0 30px rgba(255,140,66,0.2)",
    teal:   "0 0 14px rgba(0,200,150,0.55),   0 0 30px rgba(0,200,150,0.2)",
    purple: "0 0 14px rgba(139,127,255,0.55), 0 0 30px rgba(139,127,255,0.2)",
    pink:   "0 0 14px rgba(255,107,157,0.55), 0 0 30px rgba(255,107,157,0.2)",
  }
};
const card = { background: "#141414", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 12 };
const STAGES = ["Lead", "Qualified", "Proposal", "Negotiation", "Closed Won", "Closed Lost"];
const TAGS = ["Hot", "Warm", "New", "Follow-up", "VIP", "Cold"];
const tagColor = { Hot: C.red, Warm: C.orange, New: C.teal, "Follow-up": C.blue, VIP: C.purple, Cold: "#a9a9a9" };
const stageColor = { Lead: "#a9a9a9", Qualified: C.blue, Proposal: C.orange, Negotiation: C.purple, "Closed Won": C.teal, "Closed Lost": C.red };
const inputStyle = { width: "100%", padding: "7px 10px", borderRadius: 7, border: "0.5px solid rgba(255,255,255,0.12)", background: "#000000", color: "#ffffff", fontSize: 12, outline: "none", boxSizing: "border-box" };


// ── Phone formatter: any input → (###) ###-#### ──────────────────────────
function formatPhone(raw) {
  if (!raw) return "";
  // Strip everything except digits
  const digits = String(raw).replace(/\D/g, "");
  // Strip leading country code (1 + 10 digits = 11, or +1 prefix)
  const local = digits.length === 11 && digits[0] === "1" ? digits.slice(1) : digits;
  if (local.length !== 10) return digits.length ? raw.replace(/\D/g,"") : ""; // return raw digits if not 10
  return `(${local.slice(0,3)}) ${local.slice(3,6)}-${local.slice(6)}`;
}

const BLANK = { name: "", company: "", title: "", email: "", phone: "", extraPhones: [], extraEmails: [], value: "", stage: "Lead", tag: "New", source: "", address: "", notes: "", birthday: "" };

function CRMMultiField({ label, values=[], onChange, type="text", placeholder="" }) {
  return (
    <div>
      {values.map((v,i) => (
        <div key={i} style={{ display:"flex", gap:6, marginBottom:4 }}>
          <input type={type} value={v} placeholder={placeholder}
            onChange={e => { const n=[...values]; n[i]=e.target.value; onChange(n); }}
            style={{ flex:1, background:"#0a0b12", border:"0.5px solid rgba(255,255,255,0.1)", borderRadius:6, color:"#e2e8f0", fontSize:12, padding:"6px 9px", outline:"none", boxSizing:"border-box" }} />
          <button onClick={() => onChange(values.filter((_,j)=>j!==i))}
            style={{ background:"none", border:"none", color:"#ff4f5e", cursor:"pointer", fontSize:18, padding:"0 4px", lineHeight:1, flexShrink:0 }}>×</button>
        </div>
      ))}
      <button onClick={() => onChange([...values,""])}
        style={{ fontSize:10, color:"#4ab3f4", background:"none", border:"none", cursor:"pointer", padding:"2px 0" }}>+ Add {label}</button>
    </div>
  );
}

// ── EmailHistoryCard — shown in CRM contact detail ────────────────────────────
function EmailHistoryCard({ email, onCompose }) {
  const [history, setHistory] = useState([]);
  useEffect(() => {
    if (!email) return;
    try {
      const all  = JSON.parse(localStorage.getItem("lifeos_email_history") || "[]");
      const norm = email.toLowerCase().trim();
      setHistory(
        all
          .filter(h => h.from?.toLowerCase().includes(norm) || h.to?.toLowerCase().includes(norm) || h.cc?.toLowerCase().includes(norm))
          .sort((a, b) => new Date(b.date) - new Date(a.date))
          .slice(0, 20)
      );
    } catch { setHistory([]); }
  }, [email]);

  function fmt(iso) {
    if (!iso) return "";
    try {
      const d = new Date(iso), now = new Date();
      if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      return d.toLocaleDateString([], { month: "short", day: "numeric" });
    } catch { return ""; }
  }

  return (
    <div style={{ ...card, padding: 14, marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#a9a9a9" }}>✉ Email History</div>
        {email && (
          <button onClick={onCompose}
            style={{ padding: "4px 10px", borderRadius: 20, fontSize: 10, fontWeight: 700, cursor: "pointer", background: "rgba(74,179,244,0.1)", border: "0.5px solid rgba(74,179,244,0.3)", color: C.blue }}>
            + Send Email
          </button>
        )}
      </div>
      {!email ? (
        <div style={{ fontSize: 11, color: "#555555" }}>No email address on file.</div>
      ) : history.length === 0 ? (
        <div style={{ fontSize: 11, color: "#555555" }}>No email history yet.</div>
      ) : (
        <div>
          {history.map((h, i) => (
            <div key={h.id || i} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "7px 0", borderBottom: i < history.length - 1 ? "0.5px solid rgba(255,255,255,0.05)" : "none" }}>
              <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4, flexShrink: 0, marginTop: 2,
                background: h.direction === "sent" ? "rgba(74,179,244,0.12)" : "rgba(0,200,150,0.12)",
                color: h.direction === "sent" ? C.blue : C.teal }}>
                {h.direction === "sent" ? "↑ Sent" : "↓ Rcvd"}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.subject}</div>
                {h.snippet && <div style={{ fontSize: 10, color: "#555555", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.snippet}</div>}
              </div>
              <div style={{ fontSize: 9, color: "#555555", flexShrink: 0 }}>{fmt(h.date)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CRMPanel({ setActive } = {}) {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selected, setSelected] = useState(null);
  const [adding, setAdding] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [newForm, setNewForm] = useState(BLANK);
  const [search, setSearch] = useState("");
  const [filterStage, setFilterStage] = useState("All");
  const [filterTag, setFilterTag] = useState("All");
  const [aiResult, setAiResult] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAction, setAiAction] = useState("");
  const [enriching, setEnriching] = useState(false);
  const importRef = useRef(null);
  const [profileName, setProfileName] = useState("");
  const [businessName, setBusinessName] = useState("");

  // Load from KV first, fallback to Supabase
  useEffect(() => {
    // Load from localStorage first (reliable), then try to sync from Supabase in background
    const local = loadLocalCRM();
    if (local.length > 0) { setContacts(local); setLoading(false); }
    loadCRMContacts().then(data => {
      if (data?.length > 0) {
        setContacts(data);
        localStorage.setItem("lifeos_crm", JSON.stringify(data));
      }
      setLoading(false);
    }).catch(() => setLoading(false));

    // Load saved profile and business info for AI prompts (per user request, instead of hardcoded plumbing)
    getApiKey("profile_name").then(v => { if (v) setProfileName(v); });
    getApiKey("business_name").then(v => { if (v) setBusinessName(v || "the business"); });
  }, []);

  // Persist on change — but not on initial empty load
  useEffect(() => {
    if (!loading && contacts.length > 0) saveLocalCRM(contacts);
  }, [contacts]);

  async function addContact() {
    if (!newForm.name) return;
    setSyncing(true);
    const local = { ...newForm, id: "local_" + Date.now(), lastContact: "Just now", socials: {} };
    setContacts(c => [local, ...c]);
    setNewForm(BLANK);
    setAdding(false);
    const saved = await saveCRMContact(local);
    if (saved?.[0]?.id) {
      setContacts(c => c.map(x => x.id === local.id ? saved[0] : x));
    }
    setSyncing(false);
  }

  async function saveEdit() {
    setSyncing(true);
    setContacts(c => c.map(x => x.id === editForm.id ? editForm : x));
    if (selected?.id === editForm.id) setSelected(editForm);
    setEditForm(null);
    await saveCRMContact(editForm);
    setSyncing(false);
  }

  async function deleteContact(id) {
    setContacts(c => c.filter(x => x.id !== id));
    if (selected?.id === id) setSelected(null);
    await deleteCRMContact(id);
  }

  async function deleteAll() {
    if (!confirm(`Delete all ${contacts.length} CRM contacts?`)) return;
    for (const c of contacts) await deleteCRMContact(c.id);
    setContacts([]);
    setSelected(null);
    saveLocalCRM([]);
  }

  function exportContacts() {
    const headers = ["name","company","jobTitle","email","phone","value","stage","tag","source","address","note","birthday"];
    const rows = contacts.map(c => headers.map(h => `"${(c[h]||"").replace(/"/g,'""')}"`).join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "crm_contacts.csv"; a.click();
  }

  function importContacts(e) {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const text = ev.target.result;
      const isCSV = file.name.endsWith(".csv") || file.type === "text/csv";

      function parseCSVLine(line) {
        const fields = []; let field = ""; let inQ = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"') { if (inQ && line[i+1] === '"') { field += '"'; i++; } else { inQ = !inQ; } }
          else if (ch === "," && !inQ) { fields.push(field.trim()); field = ""; }
          else { field += ch; }
        }
        fields.push(field.trim()); return fields;
      }

      function norm(h) { return h.toLowerCase().replace(/[^a-z0-9]/g, ""); }
      const HMAP = {
        firstname:"firstName",givenname:"firstName",
        lastname:"lastName",surname:"lastName",
        phone1value:"phone",phonenumber:"phone",phone:"phone",mobile:"phone",cell:"phone",
        phone2value:"phone2",homephone:"phone2",workphone:"phone2",
        email1value:"email",emailaddress:"email",email:"email",
        email2value:"email2",emailaddress2:"email2",
        address1street:"street",street:"street",streetaddress:"street",
        address1city:"city",city:"city",
        address1region:"state",state:"state",
        address1postalcode:"zip",zip:"zip",postalcode:"zip",
        company:"company",organization:"company",companyname:"company",
        jobtitle:"jobTitle",title:"jobTitle",position:"jobTitle",
        name:"name",fullname:"name",displayname:"name",
        notes:"note",note:"note",birthday:"birthday",website:"website",
        stage:"stage",dealstage:"stage",value:"value",dealvalue:"value",
        tag:"tag",label:"tag",leadsource:"source",source:"source",
      };
      function mapH(h) { return HMAP[norm(h)] || norm(h); }
      function fmtPhone(raw) {
        if (!raw) return "";
        const d = String(raw).replace(/[^0-9]/g, "");
        const loc = d.length === 11 && d[0] === "1" ? d.slice(1) : d;
        if (loc.length !== 10) return d || "";
        return "(" + loc.slice(0,3) + ") " + loc.slice(3,6) + "-" + loc.slice(6);
      }

      try {
        let rows = [];
        if (isCSV) {
          const lines = text.split("\n").map(function(l){return l.replace(/\r/,"");}).filter(function(l){return l.trim();});
          if (lines.length < 2) { alert("No data rows found."); return; }
          let hi = 0;
          while (hi < lines.length && parseCSVLine(lines[hi]).filter(Boolean).length < 2) hi++;
          const hdrs = parseCSVLine(lines[hi]).map(mapH);
          for (let i = hi + 1; i < lines.length; i++) {
            const vals = parseCSVLine(lines[i]);
            if (vals.every(function(v){return !v.trim();})) continue;
            const obj = {};
            hdrs.forEach(function(h,idx){ if (vals[idx] && vals[idx].trim()) obj[h] = vals[idx].trim(); });
            rows.push(obj);
          }
        } else {
          const parsed = JSON.parse(text);
          rows = Array.isArray(parsed) ? parsed : [parsed];
        }

        const current = JSON.parse(localStorage.getItem("lifeos_crm") || "[]");
        const names = new Set(current.map(function(c){return (c.name||"").toLowerCase();}));
        const newRows = [];

        for (let ri = 0; ri < rows.length; ri++) {
          const row = rows[ri];
          const fn = (row.firstName || "").trim();
          const ln = (row.lastName  || "").trim();
          const nr = (row.name || row.displayname || "").trim();
          const df = fn || (nr.indexOf(" ") > -1 ? nr.split(" ")[0] : nr);
          const dl = ln || (nr.indexOf(" ") > -1 ? nr.split(" ").slice(1).join(" ") : "");
          const full = fn || ln ? (fn + " " + ln).trim() : nr;
          if (!full) continue;
          if (names.has(full.toLowerCase())) continue;
          names.add(full.toLowerCase());
          const st = (row.street||"").trim(); const ct = (row.city||"").trim();
          const sta = (row.state||"").trim(); const zp = (row.zip||"").trim();
          newRows.push(Object.assign({}, BLANK, {
            id: "local_" + Date.now() + Math.random(),
            name: full,
            company:  (row.company||"").trim(),
            title:    (row.jobTitle||row.title||"").trim(),
            email:    (row.email||"").trim(),
            phone:    fmtPhone(row.phone),
            address:  row.address || [st,ct,sta,zp].filter(Boolean).join(", "),
            note:     (row.note||"").trim(),
            stage:    STAGES.indexOf(row.stage) > -1 ? row.stage : "Lead",
            tag:      TAGS.indexOf(row.tag) > -1 ? row.tag : "New",
            source:   (row.source||"Imported").trim(),
            value:    (row.value||"").trim(),
            lastContact: "Imported",
            socials: {},
          }));
        }

        if (!newRows.length) { alert("No new contacts found (all may be duplicates)."); return; }
        setSyncing(true);
        const merged = newRows.concat(current);
        setContacts(merged);
        saveLocalCRM(merged);
        for (let i = 0; i < newRows.length; i++) await saveCRMContact(newRows[i]);
        setSyncing(false);
        alert("Imported " + newRows.length + " contact" + (newRows.length !== 1 ? "s" : "") + " into CRM.");
      } catch (err) {
        console.error("CRM import error:", err);
        alert("Import failed: " + err.message);
      }
    };
    reader.readAsText(file);
    if (importRef.current) importRef.current.value = "";
  }

  async function enrichContact(contact) {
    setEnriching(true);
    const prof = profileName || "the user";
    const biz = businessName || "the business";
    const prompt = `You are an AI researcher. Enrich this CRM contact for ${prof} at ${biz}:
Name: ${contact.name}, Company: ${contact.company}, Title: ${contact.title}, Source: ${contact.source}, Notes: ${contact.notes}
Return a JSON object with these fields: { "enriched_notes": "...", "estimated_value": "...", "recommended_tag": "Hot|Warm|New|VIP|Cold|Follow-up", "recommended_stage": "Lead|Qualified|Proposal|Negotiation|Closed Won|Closed Lost", "next_action": "..." }
Return ONLY the JSON, no markdown.`;
    const result = await invokeLLM({ prompt });
    try {
      const clean = result.replace(/```json|```/g, "").trim();
      const data = JSON.parse(clean);
      const updated = { ...contact, notes: data.enriched_notes || contact.notes, tag: data.recommended_tag || contact.tag, stage: data.recommended_stage || contact.stage };
      setContacts(c => c.map(x => x.id === contact.id ? updated : x));
      if (selected?.id === contact.id) setSelected(updated);
      await saveCRMContact(updated);
    } catch { alert("Enrichment result: " + result); }
    setEnriching(false);
  }

  async function runCRMAI(contact, action) {
    setAiLoading(true); setAiResult(""); setAiAction(action);
    const prof = profileName || "the business owner";
    const biz = businessName || "the business";
    const prompts = {
      email: `Draft a short, professional outreach email from ${prof} at ${biz} to ${contact.name} at ${contact.company}. Context: ${contact.source}. Notes: ${contact.notes}. Stage: ${contact.stage}. Goal: advance the deal. Warm, specific, under 100 words.`,
      sms: `Draft a short SMS from ${prof} at ${biz} to ${contact.name}. Context: ${contact.source}. Friendly, brief (under 30 words), conversational.`,
      call: `Create a call script for ${prof} at ${biz} calling ${contact.name} at ${contact.company}. Stage: ${contact.stage}. Value: ${contact.value}. Notes: ${contact.notes}. Include opening, 3 key questions, and a close. Keep it natural.`,
      insight: `Analyze this sales lead. Contact: ${contact.name}, ${contact.title} at ${contact.company}. Source: ${contact.source}. Value: ${contact.value}. Stage: ${contact.stage}. Tag: ${contact.tag}. Notes: ${contact.notes}. Give 3 specific, actionable strategies to close this deal. Be direct.`,
    };
    const result = await invokeLLM({ prompt: prompts[action] });
    setAiResult(result); setAiLoading(false);
  }

  const filtered = contacts.filter(c => {
    const q = search.toLowerCase();
    const match = [c.name, c.company, c.email, c.source, c.tag].join(" ").toLowerCase().includes(q);
    const ms = filterStage === "All" || c.stage === filterStage;
    const mt = filterTag === "All" || c.tag === filterTag;
    return match && ms && mt;
  });

  // Clean any remaining mock plumbing data (user requested all mock gone)
  useEffect(() => {
    if (contacts.length > 0) {
      const hasPlumb = contacts.some(c => /plumb|plumber/i.test(`${c.company||''} ${c.name||''} ${c.notes||''}`));
      if (hasPlumb) {
        const cleaned = contacts.filter(c => !/plumb|plumber/i.test(`${c.company||''} ${c.name||''} ${c.notes||''}`));
        if (cleaned.length < contacts.length) {
          setContacts(cleaned);
          saveLocalCRM(cleaned);
          for (const c of contacts) {
            if (/plumb|plumber/i.test(`${c.company||''} ${c.name||''} ${c.notes||''}`)) deleteCRMContact(c.id);
          }
        }
      }
    }
  }, [contacts.length]); // run after load to purge persistent mock data

  const totalValue = contacts.reduce((sum, c) => {
    const v = parseFloat((c.value || "0").replace(/[$,k]/gi, m => m === "k" ? "000" : ""));
    return sum + (isNaN(v) ? 0 : v);
  }, 0);

  return (
    <div style={{ display: "flex", height: "calc(100vh - 52px)", overflow: "hidden" }}>
      {/* ─── LEFT PANEL ─── */}
      <div style={{ width: 300, borderRight: "0.5px solid rgba(255,255,255,0.1)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, padding: "10px 10px 6px" }}>
          {[
            { label: "Leads", val: contacts.length, color: C.orange },
            { label: "Hot", val: contacts.filter(c => c.tag === "Hot").length, color: C.red },
            { label: "Pipeline", val: `$${(totalValue/1000).toFixed(1)}k`, color: C.teal }
          ].map(s => (
            <div key={s.label} style={{ ...card, padding: "8px 10px", textAlign: "center" }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: s.color }}>{loading ? "..." : s.val}</div>
              <div style={{ fontSize: 9, color: "#a9a9a9" }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div style={{ padding: "6px 8px", display: "flex", gap: 4, flexWrap: "wrap" }}>
          <button onClick={() => { setAdding(true); setSelected(null); }} style={{ flex: 1, padding: "6px 4px", borderRadius: 7, background: "rgba(74,179,244,0.1)", border: "0.5px solid rgba(74,179,244,0.3)", color: C.blue, fontSize: 10, fontWeight: 600, cursor: "pointer" }}>+ Add</button>
          <button onClick={exportContacts} style={{ flex: 1, padding: "6px 4px", borderRadius: 7, background: "rgba(0,200,150,0.08)", border: "0.5px solid rgba(0,200,150,0.2)", color: C.teal, fontSize: 10, fontWeight: 600, cursor: "pointer" }}><Icon name="↓" size={12} style={{marginRight:6,verticalAlign:"middle"}} />Export</button>
          <button onClick={() => importRef.current?.click()} style={{ flex: 1, padding: "6px 4px", borderRadius: 7, background: "rgba(139,127,255,0.08)", border: "0.5px solid rgba(139,127,255,0.2)", color: C.purple, fontSize: 10, fontWeight: 600, cursor: "pointer" }}><Icon name="↑" size={12} style={{marginRight:6,verticalAlign:"middle"}} />Import</button>
          <button onClick={deleteAll} style={{ flex: 1, padding: "6px 4px", borderRadius: 7, background: "rgba(255,79,94,0.08)", border: "0.5px solid rgba(255,79,94,0.2)", color: C.red, fontSize: 10, fontWeight: 600, cursor: "pointer" }}><Icon name="🗑" size={12} style={{marginRight:6,verticalAlign:"middle"}} />All</button>
          <input ref={importRef} type="file" accept=".csv,.json" onChange={importContacts} style={{ display: "none" }} />
        </div>

        {/* DB status */}
        <div style={{ padding: "2px 10px 4px", fontSize: 9, color: syncing ? C.orange : "#555555" }}>
          {syncing ? "⟳ Syncing to Supabase..." : "● Supabase connected"}
        </div>

        {/* Search */}
        <div style={{ padding: "0 8px 6px" }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search CRM..."
            style={{ ...inputStyle, marginBottom: 5 }} />
          <div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginBottom: 3 }}>
            {["All", ...STAGES.slice(0,4)].map(s => (
              <button key={s} onClick={() => setFilterStage(s)}
                style={{ padding: "2px 6px", borderRadius: 20, fontSize: 9, fontWeight: 600, cursor: "pointer", border: "0.5px solid", background: filterStage === s ? "rgba(74,179,244,0.15)" : "transparent", borderColor: filterStage === s ? C.blue : "rgba(255,255,255,0.08)", color: filterStage === s ? C.blue : "#a9a9a9" }}>
                {s}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
            {["All", ...TAGS].map(t => (
              <button key={t} onClick={() => setFilterTag(t)}
                style={{ padding: "2px 6px", borderRadius: 20, fontSize: 9, fontWeight: 600, cursor: "pointer", border: "0.5px solid", background: filterTag === t ? "rgba(255,140,66,0.15)" : "transparent", borderColor: filterTag === t ? C.orange : "rgba(255,255,255,0.08)", color: filterTag === t ? C.orange : "#a9a9a9" }}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: "auto", padding: "0 6px 8px" }}>
          {loading ? (
            <div style={{ textAlign: "center", color: "#555555", padding: 20, fontSize: 12 }}>Loading from Supabase...</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: "center", color: "#555555", padding: 20, fontSize: 12 }}>No contacts yet. Click + Add.</div>
          ) : filtered.map(c => (
            <div key={c.id} onClick={() => { setSelected(c); setAdding(false); setEditForm(null); }}
              style={{ padding: "9px 8px", borderRadius: 10, cursor: "pointer", marginBottom: 3, background: selected?.id === c.id ? "rgba(74,179,244,0.1)" : "transparent", border: "0.5px solid", borderColor: selected?.id === c.id ? "rgba(74,179,244,0.2)" : "transparent", display: "flex", alignItems: "center", gap: 9 }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: `linear-gradient(135deg,${tagColor[c.tag] || C.blue},#ff8c42)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#000000", flexShrink: 0 }}>
                {(c.name||"?").split(" ").map(n => n[0]).join("").slice(0,2).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#ffffff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
                <div style={{ fontSize: 10, color: "#a9a9a9", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.company}{c.value ? ` · ${c.value}` : ""}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
                <span style={{ fontSize: 8, padding: "2px 5px", borderRadius: 20, background: (tagColor[c.tag]||C.blue)+"22", color: tagColor[c.tag]||C.blue, fontWeight: 700 }}>{c.tag}</span>
                <button onClick={e => { e.stopPropagation(); deleteContact(c.id); }}
                  style={{ fontSize: 9, color: "#ff4f5e33", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                  onMouseEnter={e => e.target.style.color = "#ff4f5e"}
                  onMouseLeave={e => e.target.style.color = "#ff4f5e33"}><Icon name="✕" size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── RIGHT PANEL ─── */}
      <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>

        {/* ADD FORM */}
        {adding && (
          <div style={{ ...card, padding: 20, marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#ffffff", marginBottom: 14 }}>New CRM Contact</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[["name","Name*"],["company","Company"],["jobTitle","Job Title"],["value","Deal Value"],["source","Source / How They Found You"],["address","Address"],["birthday","Birthday"]].map(([k,label]) => (
                <div key={k}>
                  <div style={{ fontSize: 10, color: "#a9a9a9", marginBottom: 3 }}>{label}</div>
                  <input value={newForm[k]||""} onChange={e => setNewForm(f => ({...f,[k]:e.target.value}))} style={inputStyle} />
                </div>
              ))}
              <div>
                <div style={{ fontSize: 10, color: "#a9a9a9", marginBottom: 3 }}>Phone</div>
                <CRMMultiField label="Phone" type="tel" placeholder="(555) 000-0000"
                  values={[newForm.phone||"",...(newForm.extraPhones||[])]}
                  onChange={vals => setNewForm(f => ({...f, phone: vals[0]||"", extraPhones: vals.slice(1)}))} />
              </div>
              <div>
                <div style={{ fontSize: 10, color: "#a9a9a9", marginBottom: 3 }}>Email</div>
                <CRMMultiField label="Email" type="email" placeholder="email@example.com"
                  values={[newForm.email||"",...(newForm.extraEmails||[])]}
                  onChange={vals => setNewForm(f => ({...f, email: vals[0]||"", extraEmails: vals.slice(1)}))} />
              </div>
              <div>
                <div style={{ fontSize: 10, color: "#a9a9a9", marginBottom: 3 }}>Stage</div>
                <select value={newForm.stage} onChange={e => setNewForm(f => ({...f,stage:e.target.value}))} style={{...inputStyle}}>
                  {STAGES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 10, color: "#a9a9a9", marginBottom: 3 }}>Tag</div>
                <select value={newForm.tag} onChange={e => setNewForm(f => ({...f,tag:e.target.value}))} style={{...inputStyle}}>
                  {TAGS.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: "span 2" }}>
                <div style={{ fontSize: 10, color: "#a9a9a9", marginBottom: 3 }}>Notes</div>
                <textarea value={newForm.notes} onChange={e => setNewForm(f => ({...f,notes:e.target.value}))} rows={3} style={{...inputStyle, resize: "vertical"}} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button onClick={addContact} style={{ flex:1, padding:"9px", borderRadius:8, background:"rgba(74,179,244,0.15)", border:"0.5px solid "+C.blue, color:C.blue, fontSize:13, fontWeight:700, cursor:"pointer" }}>Save Contact</button>
              <button onClick={() => setAdding(false)} style={{ flex:1, padding:"9px", borderRadius:8, background:"rgba(255,255,255,0.06)", border:"0.5px solid rgba(255,255,255,0.1)", color:"#a9a9a9", fontSize:12, cursor:"pointer" }}>Cancel</button>
            </div>
          </div>
        )}

        {/* EDIT FORM */}
        {editForm && (
          <div style={{ ...card, padding: 20, marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#ffffff", marginBottom: 14 }}>Edit — {editForm.name}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[["name","Name"],["company","Company"],["jobTitle","Job Title"],["value","Deal Value"],["source","Source"],["address","Address"],["birthday","Birthday"],["lastContact","Last Contact"]].map(([k,label]) => (
                <div key={k}>
                  <div style={{ fontSize: 10, color: "#a9a9a9", marginBottom: 3 }}>{label}</div>
                  <input value={editForm[k]||""} onChange={e => setEditForm(f => ({...f,[k]:e.target.value}))} style={inputStyle} />
                </div>
              ))}
              <div>
                <div style={{ fontSize: 10, color: "#a9a9a9", marginBottom: 3 }}>Phone</div>
                <CRMMultiField label="Phone" type="tel" placeholder="(555) 000-0000"
                  values={[editForm.phone||"",...(editForm.extraPhones||[])]}
                  onChange={vals => setEditForm(f => ({...f, phone: vals[0]||"", extraPhones: vals.slice(1)}))} />
              </div>
              <div>
                <div style={{ fontSize: 10, color: "#a9a9a9", marginBottom: 3 }}>Email</div>
                <CRMMultiField label="Email" type="email" placeholder="email@example.com"
                  values={[editForm.email||"",...(editForm.extraEmails||[])]}
                  onChange={vals => setEditForm(f => ({...f, email: vals[0]||"", extraEmails: vals.slice(1)}))} />
              </div>
              <div>
                <div style={{ fontSize: 10, color: "#a9a9a9", marginBottom: 3 }}>Stage</div>
                <select value={editForm.stage} onChange={e => setEditForm(f => ({...f,stage:e.target.value}))} style={{...inputStyle}}>
                  {STAGES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 10, color: "#a9a9a9", marginBottom: 3 }}>Tag</div>
                <select value={editForm.tag} onChange={e => setEditForm(f => ({...f,tag:e.target.value}))} style={{...inputStyle}}>
                  {TAGS.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: "span 2" }}>
                <div style={{ fontSize: 10, color: "#a9a9a9", marginBottom: 3 }}>Notes</div>
                <textarea value={editForm.notes||""} onChange={e => setEditForm(f => ({...f,notes:e.target.value}))} rows={3} style={{...inputStyle, resize:"vertical"}} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button onClick={saveEdit} style={{ flex:1, padding:"9px", borderRadius:8, background:"rgba(0,200,150,0.15)", border:"0.5px solid "+C.teal, color:C.teal, fontSize:13, fontWeight:700, cursor:"pointer" }}><Icon name="✓" size={12} style={{marginRight:6,verticalAlign:"middle"}} />Save Changes</button>
              <button onClick={() => setEditForm(null)} style={{ flex:1, padding:"9px", borderRadius:8, background:"rgba(255,255,255,0.06)", border:"0.5px solid rgba(255,255,255,0.1)", color:"#a9a9a9", fontSize:12, cursor:"pointer" }}>Cancel</button>
            </div>
          </div>
        )}

        {/* CONTACT DETAIL */}
        {selected && !editForm && !adding && (
          <div>
            <div style={{ ...card, padding: 20, marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
                <div style={{ width: 56, height: 56, borderRadius: "50%", background: `linear-gradient(135deg,${tagColor[selected.tag]||C.blue},#ff8c42)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 700, color: "#000000", flexShrink: 0 }}>
                  {(selected.name||"?").split(" ").map(n=>n[0]).join("").slice(0,2).toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#ffffff" }}>{selected.name}</div>
                  <div style={{ fontSize: 12, color: "#a9a9a9" }}>{[selected.title, selected.company].filter(Boolean).join(" · ")}</div>
                  <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 9, padding: "3px 8px", borderRadius: 20, background: (tagColor[selected.tag]||C.blue)+"22", color: tagColor[selected.tag]||C.blue, fontWeight: 700 }}>{selected.tag}</span>
                    <span style={{ fontSize: 9, padding: "3px 8px", borderRadius: 20, background: (stageColor[selected.stage]||C.blue)+"22", color: stageColor[selected.stage]||C.blue, fontWeight: 700 }}>{selected.stage}</span>
                    {selected.value && <span style={{ fontSize: 9, padding: "3px 8px", borderRadius: 20, background: "rgba(0,200,150,0.15)", color: C.teal, fontWeight: 700 }}>{selected.value}</span>}
                  </div>
                </div>
              </div>

              {/* Action buttons — matches ContactsPanel style */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
                <button onClick={() => setEditForm({...selected})} style={{ padding:"5px 12px", borderRadius:20, background:"rgba(74,179,244,0.1)", border:"0.5px solid rgba(74,179,244,0.3)", color:C.blue, fontSize:11, fontWeight:600, cursor:"pointer" }}><Icon name="✏️" size={12} style={{marginRight:6,verticalAlign:"middle"}} />Edit</button>
                <button onClick={() => enrichContact(selected)} disabled={enriching} style={{ padding:"5px 12px", borderRadius:20, background:"rgba(139,127,255,0.1)", border:"0.5px solid rgba(139,127,255,0.4)", color:C.purple, fontSize:11, fontWeight:600, cursor:enriching?"wait":"pointer" }}>
                  {enriching ? "◈ Enriching..." : "✦ AI Enrich"}
                </button>
                <button onClick={exportContacts} style={{ padding:"5px 12px", borderRadius:20, background:"rgba(0,200,150,0.1)", border:"0.5px solid rgba(0,200,150,0.3)", color:C.teal, fontSize:11, fontWeight:600, cursor:"pointer" }}><Icon name="↓" size={12} style={{marginRight:6,verticalAlign:"middle"}} />Export CSV</button>
                <button onClick={() => deleteContact(selected.id)} style={{ padding:"5px 12px", borderRadius:20, background:"rgba(255,79,94,0.1)", border:"0.5px solid rgba(255,79,94,0.3)", color:C.red, fontSize:11, fontWeight:600, cursor:"pointer" }}><Icon name="🗑" size={12} style={{marginRight:6,verticalAlign:"middle"}} />Delete</button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[["📧 Email", selected.email],["📞 Phone", selected.phone],["📍 Address", selected.address],["🎂 Birthday", selected.birthday],["📅 Last Contact", selected.lastContact],["💡 Source", selected.source]].map(([k,v]) => (
                  <div key={k}>
                    <div style={{ fontSize: 10, color: "#555555", marginBottom: 2 }}>{k}</div>
                    <div style={{ fontSize: 12, color: v ? "#ffffff" : "#555555" }}>{v || "—"}</div>
                  </div>
                ))}
              </div>
            </div>

            {selected.notes && (
              <div style={{ ...card, padding: 14, marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#a9a9a9", marginBottom: 8 }}>Notes</div>
                <div style={{ fontSize: 13, color: "#a9a9a9", lineHeight: 1.6 }}>{selected.notes}</div>
              </div>
            )}

            {/* Pipeline Stage */}
            <div style={{ ...card, padding: 14, marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#a9a9a9", marginBottom: 10 }}>Pipeline Stage</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {STAGES.map(s => (
                  <button key={s} onClick={async () => {
                    const updated = {...selected, stage: s};
                    setContacts(c => c.map(x => x.id === selected.id ? updated : x));
                    setSelected(updated);
                    await saveCRMContact(updated);
                  }}
                    style={{ padding:"5px 12px", borderRadius:20, fontSize:11, fontWeight:600, cursor:"pointer", border:"0.5px solid",
                      background: selected.stage===s ? (stageColor[s]||C.blue)+"22" : "transparent",
                      borderColor: selected.stage===s ? stageColor[s]||C.blue : "rgba(255,255,255,0.08)",
                      color: selected.stage===s ? stageColor[s]||C.blue : "#666666" }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Email History */}
            <EmailHistoryCard email={selected.email} onCompose={() => {
              try { localStorage.setItem("lifeos_email_compose", JSON.stringify({ to: selected.email, subject: "", body: "", ts: Date.now() })); } catch {}
              setActive?.("email");
            }} />

            {/* AI Agent Zero */}
            <div style={{ ...card, padding: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#a9a9a9", marginBottom: 10 }}>◈ AGENT ZERO</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                {[
                  { action:"email", label:"✉ Draft Email",  color:C.blue,   bg:"rgba(74,179,244,0.1)",   border:"rgba(74,179,244,0.3)" },
                  { action:"sms",   label:"💬 SMS Draft",   color:C.purple, bg:"rgba(139,127,255,0.1)",  border:"rgba(139,127,255,0.3)" },
                  { action:"call",  label:"📞 Call Script", color:C.teal,   bg:"rgba(0,200,150,0.1)",    border:"rgba(0,200,150,0.3)" },
                  { action:"ai",    label:"🤖 AI Insight",  color:C.orange, bg:"rgba(255,140,66,0.1)",   border:"rgba(255,140,66,0.3)" },
                ].map(({ action, label, color, bg, border }) => (
                  <button key={action} onClick={() => runAI(selected, action)} disabled={aiLoading}
                    style={{ padding:"5px 12px", borderRadius:20, fontSize:11, fontWeight:600, cursor:aiLoading?"wait":"pointer", background:bg, border:"0.5px solid "+border, color }}>
                    {aiLoading && aiAction===action ? "Thinking..." : label}
                  </button>
                ))}
              </div>
              {aiResult && (
                <div style={{ padding:12, borderRadius:8, background:"rgba(74,179,244,0.06)", border:"0.5px solid rgba(74,179,244,0.15)", fontSize:12, color:"#e2e8f0", lineHeight:1.7, whiteSpace:"pre-wrap" }}>
                  <div style={{ fontSize:10, color:C.blue, fontWeight:700, marginBottom:6, letterSpacing:".05em" }}>
                    ◈ AGENT ZERO — {aiAction==="email"?"EMAIL DRAFT":aiAction==="sms"?"SMS DRAFT":aiAction==="call"?"CALL SCRIPT":"AI INSIGHT"}
                  </div>
                  {aiResult}
                </div>
              )}
            </div>
          </div>
        )}

        {!selected && !adding && (
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100%", color:"#333", fontSize:13 }}>
            Select a contact or click + Add
          </div>
        )}
      </div>
    </div>
  );
}
