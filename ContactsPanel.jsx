import { useState, useEffect, useRef, useMemo } from "react";
import { dbFetch } from "@/lib/supabase";
import Icon from "@/components/lifeos/icons/Icon";

// ─── STORAGE ──────────────────────────────────────────────────────────────────
const LS_KEY = "lifeos_contacts";

function loadLocal() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); } catch { return []; }
}
function saveLocal(list) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(list)); } catch (e) { console.warn("saveLocal failed", e); }
}

async function dbLoadContacts() {
  try {
    const data = await dbFetch("contacts?order=created_at.desc&limit=1000");
    return data || loadLocal();
  } catch { return loadLocal(); }
}
async function dbSaveContact(contact) {
  try {
    const { id, ...fields } = contact;
    if (id && !String(id).startsWith("local_"))
      return await dbFetch(`contacts?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(fields) });
    return await dbFetch("contacts", { method: "POST", body: JSON.stringify(fields) });
  } catch { return null; }
}
async function dbDeleteContact(id) {
  try {
    if (!String(id).startsWith("local_"))
      await dbFetch(`contacts?id=eq.${id}`, { method: "DELETE", prefer: "" });
  } catch {}
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const C = {
  blue: "#4ab3f4", teal: "#00c896", purple: "#8b7fff",
  pink: "#ff6b9d", orange: "#ff8c42", red: "#ff4f5e", gold: "#ffd700",
};
const COLORS = [C.blue, C.teal, C.purple, C.pink, C.orange, C.red, C.gold, "#00bfff"];
const GROUPS = ["Personal", "Work", "Family", "Business", "VIP", "Other"];
const groupColor = {
  Personal: C.blue, Work: C.teal, Family: C.pink,
  Business: C.orange, VIP: C.gold, Other: "#a9a9a9",
};
// ENRICH key relocated to Cloudflare Worker secret (ENRICH_API_KEY).
// Frontend calls /api/enrich/contact — Worker injects auth server-side.

const inputStyle = {
  width: "100%", padding: "8px 10px", borderRadius: 7,
  border: "0.5px solid rgba(255,255,255,0.12)", background: "#000",
  color: "#fff", fontSize: 12, outline: "none", boxSizing: "border-box",
};
const labelStyle = { fontSize: 10, color: "#a9a9a9", marginBottom: 3, display: "block", fontWeight: 600 };

const BLANK = {
  name: "", firstName: "", lastName: "",
  email: "", email2: "", phone: "", phone2: "",
  extraPhones: [], extraEmails: [],
  company: "", jobTitle: "", title: "",
  group: "Personal",
  birthday: "", website: "", extraWebsites: [],
  address: "", street: "", city: "", state: "", zip: "",
  notes: "", note: "",
  tags: [],
  color: C.blue, photo: "",
  socials: { instagram: [], twitter: [], linkedin: [], facebook: [], tiktok: [], youtube: [], reddit: [], discord: [], snapchat: [], whatsapp: [], pinterest: [] },
  addresses: {
    personal: { street: "", city: "", state: "", zip: "" },
    business: { street: "", city: "", state: "", zip: "" },
    other: [],
  },
  lastContact: "",
};

const SOCIAL_PLATFORMS = [
  { lbl: "📸 Instagram", key: "instagram", emoji: "📸", color: "#e1306c" },
  { lbl: "🐦 Twitter/X", key: "twitter", emoji: "🐦", color: "#1da1f2" },
  { lbl: "💼 LinkedIn", key: "linkedin", emoji: "💼", color: "#0a66c2" },
  { lbl: "📘 Facebook", key: "facebook", emoji: "📘", color: "#1877f2" },
  { lbl: "🎵 TikTok", key: "tiktok", emoji: "🎵", color: "#69c9d0" },
  { lbl: "▶️ YouTube", key: "youtube", emoji: "▶️", color: "#ff0000" },
  { lbl: "🟠 Reddit", key: "reddit", emoji: "🟠", color: "#ff4500" },
  { lbl: "💬 Discord", key: "discord", emoji: "💬", color: "#5865f2" },
  { lbl: "👻 Snapchat", key: "snapchat", emoji: "👻", color: "#fffc00" },
  { lbl: "💚 WhatsApp", key: "whatsapp", emoji: "💚", color: "#25d366" },
  { lbl: "📌 Pinterest", key: "pinterest", emoji: "📌", color: "#e60023" },
];

function socialUrl(platform, handle) {
  if (!handle) return "#";
  const h = String(handle).replace(/^@+/, "");
  switch (platform) {
    case "instagram": return `https://instagram.com/${h}`;
    case "twitter": return `https://x.com/${h}`;
    case "linkedin": return `https://linkedin.com/in/${h}`;
    case "facebook": return `https://facebook.com/${h}`;
    case "tiktok": return `https://tiktok.com/@${h}`;
    case "youtube": return `https://youtube.com/@${h}`;
    case "reddit": return `https://reddit.com/user/${h}`;
    case "discord": return `https://discord.com/users/${h}`;
    case "snapchat": return `https://snapchat.com/add/${h}`;
    case "whatsapp": return h.replace(/\D/g,"").length >= 8 ? `https://wa.me/${h.replace(/\D/g,"")}` : `https://wa.me/?text=${encodeURIComponent(h)}`;
    case "pinterest": return `https://pinterest.com/${h}`;
    default: return `https://${platform}.com/${h}`;
  }
}

function MultiField({ label, values=[], onChange, type="text", placeholder="", color="#4ab3f4" }) {
  return (
    <div>
      {values.map((v,i) => (
        <div key={i} style={{ display:"flex", gap:6, marginBottom:6 }}>
          <input type={type} value={v} placeholder={placeholder}
            onChange={e => { const n=[...values]; n[i]=e.target.value; onChange(n); }}
            style={{ flex:1, padding:"6px 9px", borderRadius:7, border:"0.5px solid rgba(255,255,255,0.1)", background:"#0a0a0a", color:"#fff", fontSize:12, outline:"none", boxSizing:"border-box" }} />
          <button onClick={() => onChange(values.filter((_,j)=>j!==i))}
            style={{ background:"none", border:"none", color:"#ff4f5e", cursor:"pointer", fontSize:18, padding:"0 4px", lineHeight:1, flexShrink:0 }}>×</button>
        </div>
      ))}
      <button onClick={() => onChange([...values,""])}
        style={{ fontSize:10, color, background:"none", border:"none", cursor:"pointer", padding:"2px 0", display:"block" }}>+ Add {label}</button>
    </div>
  );
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function formatPhone(raw) {
  if (!raw) return "";
  const digits = String(raw).replace(/\D/g, "");
  const local = digits.length === 11 && digits[0] === "1" ? digits.slice(1) : digits;
  if (local.length !== 10) return digits.length ? digits : "";
  return `(${local.slice(0,3)}) ${local.slice(3,6)}-${local.slice(6)}`;
}

function formatPhoneForInput(raw) {
  if (!raw) return "";
  const digits = String(raw).replace(/\D/g, "").slice(0, 10);
  if (digits.length === 0) return "";
  if (digits.length <= 3) return "(" + digits;
  if (digits.length <= 6) return "(" + digits.slice(0, 3) + ") " + digits.slice(3);
  return "(" + digits.slice(0, 3) + ") " + digits.slice(3, 6) + "-" + digits.slice(6);
}

function formatBirthdayInput(raw) {
  if (!raw) return "";
  const digits = String(raw).replace(/\D/g, "").slice(0, 8);
  if (digits.length === 0) return "";
  let out = digits.slice(0, 2);
  if (digits.length > 2) out += "/" + digits.slice(2, 4);
  if (digits.length > 4) out += "/" + digits.slice(4);
  return out;
}

function normalizeBirthday(raw) {
  if (!raw) return "";
  let s = String(raw).trim();
  if (!s || s.toUpperCase() === "#ERROR!") return "";
  // Split on any non-digit separators
  const parts = s.split(/[^\d]+/).filter(Boolean);
  if (parts.length >= 3) {
    let [a, b, c] = parts;
    const na = parseInt(a, 10);
    const nc = parseInt(c, 10);
    let month, day, year;
    if (a.length === 4 || na > 12) {
      // YYYY first (or similar)
      year = a.padStart(4, "0");
      month = b.padStart(2, "0");
      day = c.padStart(2, "0");
    } else {
      month = a.padStart(2, "0");
      day = b.padStart(2, "0");
      if (c.length === 4) {
        year = c;
      } else if (c.length === 2) {
        year = (nc > 30 ? "19" : "20") + c.padStart(2, "0");
      } else {
        year = c.padStart(4, "0");
      }
    }
    const m = Math.max(1, Math.min(12, parseInt(month, 10) || 1)).toString().padStart(2, "0");
    const d = Math.max(1, Math.min(31, parseInt(day, 10) || 1)).toString().padStart(2, "0");
    const y = (year || "2000").padStart(4, "0").slice(0, 4);
    return `${m}/${d}/${y}`;
  }
  // Fallback: treat as digit string (e.g. 06152025 or pasted)
  const digits = s.replace(/\D/g, "").slice(0, 8);
  if (digits.length >= 6) {
    let mm = digits.slice(0, 2).padStart(2, "0");
    let dd = digits.slice(2, 4).padStart(2, "0");
    let yy = digits.slice(4);
    let yyyy = yy.length === 4 ? yy : (parseInt(yy, 10) > 30 ? "19" + yy : "20" + yy).slice(0, 4);
    return `${mm}/${dd}/${yyyy}`;
  }
  return s;
}

function initials(c) {
  if (c.firstName || c.lastName)
    return ((c.firstName?.[0] || "") + (c.lastName?.[0] || "")).toUpperCase() || "?";
  const parts = (c.name || "").trim().split(" ").filter(Boolean);
  if (!parts.length) return "?";
  return parts.length === 1 ? parts[0][0].toUpperCase()
    : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function displayName(c) {
  if (c.firstName || c.lastName) return `${c.firstName || ""} ${c.lastName || ""}`.trim();
  return c.name || "Unnamed";
}

function avatarBg(c) {
  if (c.color) return `linear-gradient(135deg,${c.color},#ff8c42)`;
  const pool = [C.blue, C.teal, C.purple, C.pink, C.orange];
  return pool[(displayName(c).charCodeAt(0) || 0) % pool.length];
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
  });
}

// ─── CSV IMPORT ───────────────────────────────────────────────────────────────
function parseCSVLine(line) {
  const fields = [];
  let field = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { field += '"'; i++; }
      else { inQ = !inQ; }
    } else if (ch === "," && !inQ) { fields.push(field.trim()); field = ""; }
    else { field += ch; }
  }
  fields.push(field.trim());
  return fields;
}

function normalizeHeader(h) { return h.toLowerCase().replace(/[^a-z0-9]/g, ""); }

const HEADER_MAP = {
  firstname: "firstName", givenname: "firstName", forename: "firstName",
  lastname: "lastName", surname: "lastName", familyname: "lastName",
  phone1value: "phone", phonenumber: "phone", phone: "phone", phone1: "phone",
  mobilephone: "phone", cellphone: "phone", mobile: "phone",
  phone2value: "phone2", phonenumber2: "phone2", homephone: "phone2", workphone: "phone2", phone2: "phone2",
  email1value: "email", emailaddress: "email", email: "email", email1: "email",
  email2value: "email2", emailaddress2: "email2", email2: "email2",
  address1street: "street", street: "street", streetaddress: "street",
  address1city: "city", city: "city",
  address1region: "state", state: "state", region: "state",
  address1postalcode: "zip", zip: "zip", postalcode: "zip", zipcode: "zip",
  address: "address",
  companyname: "company", company: "company", organization: "company",
  jobtitle: "jobTitle", title: "title", occupation: "jobTitle",
  notes: "notes", note: "notes", biography: "notes",
  website: "website", webpage: "website", url: "website",
  birthday: "birthday", tags: "tags",
  // Requested spreadsheet-friendly mappings
  image: "photo", photo: "photo", picture: "photo", avatar: "photo", img: "photo",
};

function mapHeader(raw) {
  const norm = normalizeHeader(raw);
  return HEADER_MAP[norm] || norm;
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/);
  if (lines.length < 2) return [];
  let headerIdx = 0;
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const low = lines[i].toLowerCase();
    if (low.includes("first") || low.includes("given") || low.includes("name")) { headerIdx = i; break; }
  }
  const headers = parseCSVLine(lines[headerIdx]).map(mapHeader);
  const rows = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseCSVLine(line);
    const row = {};
    headers.forEach((h, idx) => {
      const val = (values[idx] || "").trim();
      if (!val) return;
      if (h === "phone" && row.phone) row.phone2 = row.phone2 || val;
      else if (h === "email" && row.email) row.email2 = row.email2 || val;
      else row[h] = val;
    });
    rows.push(row);
  }
  return rows;
}

// ─── QR CODE ─────────────────────────────────────────────────────────────────
function QRCode({ text, size = 120 }) {
  if (!text) return null;
  const url = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}&bgcolor=13141f&color=4ab3f4&format=png`;
  return <img src={url} width={size} height={size} alt="QR vCard" style={{ borderRadius: 8, border: "0.5px solid rgba(74,179,244,0.2)" }} />;
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function ContactsPanel({ setActive }) {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("All");
  const [selected, setSelected] = useState(null);
  const [form, setForm]         = useState(BLANK);
  const [editing, setEditing]   = useState(false);
  const [adding, setAdding]     = useState(false);
  const [syncing, setSyncing]   = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [aiResult, setAiResult] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [showQR, setShowQR]     = useState(false);
  const importRef = useRef(null);

  // ── Load ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const local = loadLocal();
    if (local.length) setContacts(local);
    setLoading(false);
    (async () => {
      try {
        const remote = await dbLoadContacts();
        if (remote?.length && remote.length >= local.length) {
          setContacts(remote);
          saveLocal(remote);
        }
      } catch {}
    })();
  }, []);

  // ── Debounce search ───────────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // ── Filter ────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const term = debouncedSearch.toLowerCase().trim();
    return contacts.filter(c => {
      const matchQ = !term || [
        c.name, c.firstName, c.lastName, c.email, c.email2,
        c.phone, c.phone2, c.company, c.jobTitle, c.title,
        c.address, c.street, c.city, c.state, c.zip,
        c.website, c.notes, c.note, c.birthday, c.group,
        ...(c.tags || []),
        ...(c.socials ? Object.values(c.socials).flat() : []),
        ...(c.addresses ? [
          c.addresses.personal?.street, c.addresses.personal?.city, c.addresses.personal?.state, c.addresses.personal?.zip,
          c.addresses.business?.street, c.addresses.business?.city, c.addresses.business?.state, c.addresses.business?.zip,
          ...(c.addresses.other || []).flatMap(o => o ? [o.label, o.street, o.city, o.state, o.zip] : [])
        ] : []),
      ].filter(Boolean).join(" ").toLowerCase().includes(term);
      const matchG = groupFilter === "All" || c.group === groupFilter;
      return matchQ && matchG;
    }).sort((a, b) => displayName(a).localeCompare(displayName(b)));
  }, [contacts, debouncedSearch, groupFilter]);

  // ── Persist helpers ───────────────────────────────────────────────────────
  const persist = (list) => { setContacts(list); saveLocal(list); };

  // ── CRUD ─────────────────────────────────────────────────────────────────
  const openNew = () => { setForm(BLANK); setAdding(true); setEditing(false); setSelected(null); };
  const openEdit = (c) => {
    let init = { ...BLANK, ...c };
    // normalize socials -> arrays (backward compat)
    if (c.socials && typeof c.socials === "object") {
      const normS = {};
      Object.keys(c.socials).forEach(k => {
        const v = c.socials[k];
        normS[k] = Array.isArray(v) ? [...v] : (v ? [v] : []);
      });
      init.socials = normS;
    }
    // ensure all known platforms exist as arrays
    SOCIAL_PLATFORMS.forEach(({ key }) => {
      if (!Array.isArray(init.socials[key])) {
        const prev = init.socials[key];
        init.socials[key] = prev ? [prev] : [];
      }
    });
    // normalize addresses
    if (!init.addresses || typeof init.addresses !== "object") {
      init.addresses = { personal: { street: "", city: "", state: "", zip: "" }, business: { street: "", city: "", state: "", zip: "" }, other: [] };
    }
    // migrate legacy flat address fields into personal if personal empty
    const legStreet = (c.street || "").trim();
    const legCity = (c.city || "").trim();
    const legHas = !!(legStreet || c.city || c.state || c.zip || c.address);
    const per = init.addresses.personal || {};
    if (legHas && !(per.street || per.city)) {
      init.addresses.personal = {
        street: legStreet || (c.address || ""),
        city: legCity,
        state: (c.state || ""),
        zip: (c.zip || ""),
      };
    }
    // normalize birthday to MM/DD/YYYY
    init.birthday = normalizeBirthday(init.birthday);
    // pre-format phones nicely for the inputs (live mask)
    if (init.phone) init.phone = formatPhoneForInput(init.phone);
    if (Array.isArray(init.extraPhones)) {
      init.extraPhones = init.extraPhones.map(v => formatPhoneForInput(v || ""));
    }
    if (init.phone2) init.phone2 = formatPhoneForInput(init.phone2);
    setForm(init);
    setEditing(true);
    setAdding(false);
  };
  const closeForm = () => { setAdding(false); setEditing(false); setForm(BLANK); };

  const save = async () => {
    const fn = (form.firstName || "").trim();
    const ln = (form.lastName || "").trim();
    const fullName = fn || ln ? `${fn} ${ln}`.trim() : (form.name || "").trim();
    if (!fullName) return;

    setSyncing(true);
    const entry = {
      ...form,
      name: fullName,
      firstName: fn, lastName: ln,
      phone: formatPhone(form.phone),
      phone2: formatPhone(form.phone2),
      birthday: normalizeBirthday(form.birthday),
      notes: form.notes || form.note || "",
      note: form.notes || form.note || "",
      lastContact: editing ? (form.lastContact || "Now") : "Added",
      id: editing && selected?.id ? selected.id : `local_${Date.now()}`,
    };

    setContacts(prev => {
      const idx = prev.findIndex(c => c.id === entry.id);
      const next = idx >= 0 ? prev.map((c, i) => i === idx ? entry : c) : [entry, ...prev];
      saveLocal(next);
      return next;
    });
    if (editing) setSelected(entry);
    closeForm();
    setSyncing(false);
    dbSaveContact(entry).catch(() => {});
  };

  const remove = (c) => {
    if (!confirm(`Delete ${displayName(c)}?`)) return;
    setContacts(prev => {
      const next = prev.filter(x => x.id !== c.id);
      saveLocal(next);
      return next;
    });
    if (selected?.id === c.id) setSelected(null);
    dbDeleteContact(c.id).catch(() => {});
  };

  // ── Enrich (calls Worker /api/enrich/contact — key lives server-side) ─────
  async function enrichContacts(ids) {
    setEnriching(true);
    const targets = ids ? contacts.filter(p => ids.includes(p.id)) : contacts;
    try {
      const results = await Promise.all(targets.map(async (p) => {
        const res = await fetch("/api/enrich/contact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: p.email, name: displayName(p), company: p.company }),
        });
        if (!res.ok) return p;
        const d = await res.json();
        if (d.error) return p;
        return {
          ...p,
          company: d.company?.name || d.company || p.company,
          jobTitle: d.title || d.position || p.jobTitle,
          phone: d.phone || p.phone,
          email: d.email || p.email,
          socials: (() => {
            const prev = p.socials || {};
            const base = {};
            Object.keys(prev).forEach(k => {
              const v = prev[k];
              base[k] = Array.isArray(v) ? v.filter(Boolean) : (v ? [v] : []);
            });
            if (d.linkedin?.handle) {
              const arr = base.linkedin || [];
              if (!arr.includes(d.linkedin.handle)) base.linkedin = [...arr, d.linkedin.handle];
            }
            if (d.twitter?.handle) {
              const arr = base.twitter || [];
              if (!arr.includes(d.twitter.handle)) base.twitter = [...arr, d.twitter.handle];
            }
            return base;
          })(),
          lastContact: new Date().toLocaleDateString(),
        };
      }));
      const updated = contacts.map(p => results.find(e => e.id === p.id) || p);
      persist(updated);
      if (selected) setSelected(updated.find(p => p.id === selected.id) || null);
      alert(`Enriched ${results.length} contact${results.length !== 1 ? "s" : ""}`);
    } catch { alert("Enrichment failed."); }
    setEnriching(false);
  }

  // ── Export / Import ───────────────────────────────────────────────────────
  function exportContactsJSON() {
    const blob = new Blob([JSON.stringify(contacts, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "lifeos_contacts.json";
    a.click();
  }

  function exportContactsCSV() {
    // Exact column order requested for spreadsheet / Excel uploads
    const headers = [
      "image", "first name", "last name", "company name", "job title",
      "email 1", "email 2", "phone 1", "phone 2",
      "street address", "city", "state", "zip code", "website", "notes", "birthday"
    ];

    const escapeCSV = (val) => {
      const s = String(val ?? "");
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };

    const lines = [headers.join(",")];

    contacts.forEach(c => {
      // Prefer structured personal address, then legacy flat fields, then full address fallback
      const pers = c.addresses?.personal || {};
      let streetAddr = pers.street || c.street || "";
      let city = pers.city || c.city || "";
      let state = pers.state || c.state || "";
      let zip = pers.zip || c.zip || "";
      if (!streetAddr && c.address) {
        const parts = c.address.split(",").map(p => p.trim()).filter(Boolean);
        streetAddr = parts[0] || c.address;
        city = city || parts[1] || "";
        state = state || parts[2] || "";
        zip = zip || parts[3] || "";
      }
      const row = [
        c.photo || "",                           // image
        c.firstName || "",                       // first name
        c.lastName || "",                        // last name
        c.company || "",                         // company name
        c.jobTitle || c.title || "",             // job title
        c.email || "",                           // email 1
        c.email2 || "",                          // email 2
        c.phone || "",                           // phone 1
        c.phone2 || "",                          // phone 2
        streetAddr,                              // street address
        city,                                    // city
        state,                                   // state
        zip,                                     // zip code
        c.website || "",                         // website
        c.notes || c.note || "",                 // notes
        c.birthday || "",                        // birthday (MM/DD/YYYY)
      ].map(escapeCSV);

      lines.push(row.join(","));
    });

    const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "lifeos_contacts.csv";
    a.click();
  }

  // Keep old name as alias for any other references
  const exportContacts = exportContactsJSON;

  function importContacts(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result;
      const isCSV = file.name.endsWith(".csv") || file.type === "text/csv";
      let rows = [];
      try {
        rows = isCSV ? parseCSV(content) : (() => { const p = JSON.parse(content); return Array.isArray(p) ? p : [p]; })();
        const newContacts = [];
        for (const row of rows) {
          const fn = (row.firstName || "").trim();
          const ln = (row.lastName || "").trim();
          const rawName = (row.name || row.displayname || "").trim();
          const derivedFirst = fn || (rawName.includes(" ") ? rawName.split(" ")[0] : rawName);
          const derivedLast  = ln  || (rawName.includes(" ") ? rawName.split(" ").slice(1).join(" ") : "");
          const fullName = fn || ln ? `${fn} ${ln}`.trim() : rawName;
          if (!fullName) continue;
          if (contacts.some(p => p.name === fullName)) continue;
          if (newContacts.some(c => c.name === fullName)) continue;

          const street = (row.street || row.streetaddress || "").trim();
          const city   = (row.city || "").trim();
          const state  = (row.state || "").trim();
          const zip    = (row.zip || row.zipcode || row["zip code"] || "").trim();
          const fullAddress = row.address || [street, city, state, zip].filter(Boolean).join(", ");
          let tags = [];
          if (row.tags) tags = String(row.tags).split(/[,;|]/).map(t => t.trim()).filter(Boolean);
          const birthday = normalizeBirthday(row.birthday);
          const photo = (row.photo || row.image || "").trim();

          newContacts.push({
            id: `local_${Date.now()}_${Math.random()}`,
            name: fullName, firstName: derivedFirst, lastName: derivedLast,
            company: (row.company || "").trim(),
            jobTitle: (row.jobTitle || row.title || "").trim(),
            title: (row.title || "").trim(),
            group: "Personal",
            phone: formatPhone(row.phone), phone2: formatPhone(row.phone2),
            email: (row.email || "").trim(), email2: (row.email2 || "").trim(),
            address: fullAddress, street, city, state, zip,
            birthday,
            notes: (row.notes || row.note || "").trim(),
            note: (row.notes || row.note || "").trim(),
            tags, website: (row.website || "").trim(),
            socials: { instagram: [], twitter: [], linkedin: [], facebook: [], tiktok: [], youtube: [], reddit: [], discord: [], snapchat: [], whatsapp: [], pinterest: [] },
            addresses: {
              personal: { street, city, state, zip },
              business: { street: "", city: "", state: "", zip: "" },
              other: [],
            },
            color: COLORS[Math.floor(Math.random() * COLORS.length)],
            photo: photo || "", lastContact: "Imported",
          });
        }
        if (newContacts.length > 0) { persist([...contacts, ...newContacts]); alert(`Imported ${newContacts.length} contacts.`); }
        else alert("No new contacts found.");
      } catch (err) { console.error("Import failed:", err); alert("Import failed. See console."); }
    };
    reader.readAsText(file);
    if (importRef.current) importRef.current.value = "";
  }

  // ── AI check-in ───────────────────────────────────────────────────────────
  async function runAI(person) {
    setAiLoading(true); setAiResult("");
    try {
      const res = await fetch("/api/llm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: `Write a warm, personalized check-in message to ${displayName(person)} (${person.group}). Notes: ${person.notes || person.note || "none"}. Brief, genuine, max 3 sentences.` }),
      });
      const d = await res.json();
      setAiResult(d.message || d.text || "Unable to generate message.");
    } catch { setAiResult("AI service unavailable."); }
    setAiLoading(false);
  }

  // ── Hard reset ────────────────────────────────────────────────────────────
  function hardReset() {
    if (confirm("⚠️ HARD RESET: Delete ALL contacts and clear storage? Cannot be undone.")) {
      localStorage.removeItem(LS_KEY);
      setContacts([]); setSelected(null);
    }
  }
  function deleteAll() {
    if (confirm("⚠️ Delete ALL contacts? Cannot be undone.")) { persist([]); setSelected(null); }
  }

  // ── QR vCard ──────────────────────────────────────────────────────────────
  const qrData = selected ? [
    "BEGIN:VCARD", "VERSION:3.0",
    `FN:${displayName(selected)}`,
    selected.phone  ? `TEL:${selected.phone}`   : "",
    selected.email  ? `EMAIL:${selected.email}`  : "",
    (() => {
      const s = selected;
      let addr = s.address || [s.street, s.city, s.state, s.zip].filter(Boolean).join(", ");
      if (!addr && s.addresses) {
        const p = s.addresses.personal || s.addresses.business || (s.addresses.other || [])[0] || {};
        addr = [p.street, p.city, p.state, p.zip].filter(Boolean).join(", ");
      }
      return addr ? `ADR:;;${addr}` : "";
    })(),
    "END:VCARD",
  ].filter(Boolean).join("\n") : "";

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", height: "100%", background: "#0a0a0a", color: "#fff", fontFamily: "Inter,sans-serif", overflow: "hidden" }}>

      {/* ── LEFT PANE ──────────────────────────────────────────────────────── */}
      <div style={{ width: 300, minWidth: 260, borderRight: "0.5px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column" }}>

        {/* header / search */}
        <div style={{ padding: "12px 12px 8px", borderBottom: "0.5px solid rgba(255,255,255,0.08)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <Icon name="📇 CONTACTS" size={14} />
          </div>
          <div style={{ position: "relative" }}>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name, email, phone, tags…"
              style={{ ...inputStyle, paddingRight: search ? 30 : 10 }}
            />
            {search && (
              <button onClick={() => setSearch("")} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#666", fontSize: 16, cursor: "pointer" }}><Icon name="✕" size={14} /></button>
            )}
          </div>
          {debouncedSearch && (
            <div style={{ fontSize: 10, color: "#666", padding: "3px 2px" }}>{filtered.length} result{filtered.length !== 1 ? "s" : ""}</div>
          )}
          {/* group filter chips */}
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 6 }}>
            {["All", ...GROUPS].map(g => (
              <button key={g} onClick={() => setGroupFilter(g)} style={{
                padding: "2px 8px", borderRadius: 20, border: "none", fontSize: 10, cursor: "pointer", fontWeight: 600,
                background: groupFilter === g ? (groupColor[g] || C.teal) : "rgba(255,255,255,0.07)",
                color: groupFilter === g ? "#000" : "#aaa",
              }}>{g}</button>
            ))}
          </div>
        </div>

        {/* action bar */}
        <div style={{ display: "flex", gap: 4, padding: "6px 8px", borderBottom: "0.5px solid rgba(255,255,255,0.07)", flexWrap: "wrap" }}>
          {[
            { label: "+ Add",     fn: openNew,                    bg: C.blue },
            { label: "↓ CSV",     fn: exportContactsCSV,          bg: C.teal },
            { label: "JSON",      fn: exportContactsJSON,         bg: "#6b7280" },
            { label: "↑ Import",  fn: () => importRef.current?.click(), bg: C.purple },
            { label: enriching ? "⟳ Enriching…" : "✦ Enrich",
              fn: () => enrichContacts(), disabled: enriching,    bg: C.orange },
            { label: "🗑 All",    fn: deleteAll,                  bg: C.red },
            { label: "🔥 Reset",  fn: hardReset,                  bg: C.red },
          ].map(({ label, fn, bg, disabled }) => (
            <button key={label} onClick={fn} disabled={!!disabled} style={{
              flex: "1 1 auto", padding: "5px 4px", borderRadius: 6, fontSize: 10, fontWeight: 600,
              background: bg + "18", border: `0.5px solid ${bg}44`, color: bg, cursor: disabled ? "wait" : "pointer",
            }}>{label}</button>
          ))}
          <input ref={importRef} type="file" accept=".csv,.json,text/csv,application/json" onChange={importContacts} style={{ display: "none" }} />
        </div>

        {/* contact list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "6px 8px" }}>
          {loading && <div style={{ color: "#555", fontSize: 12, textAlign: "center", marginTop: 30 }}>Loading…</div>}
          {!loading && !filtered.length && (
            <div style={{ color: "#555", fontSize: 12, textAlign: "center", marginTop: 30 }}>
              {contacts.length === 0 ? "No contacts yet" : "No matches"}
            </div>
          )}
          {filtered.map(c => (
            <div key={c.id} onClick={() => { setSelected(c); setAdding(false); setEditing(false); setAiResult(""); setShowQR(false); }}
              style={{
                display: "flex", alignItems: "center", gap: 9, padding: "8px 8px", borderRadius: 9,
                cursor: "pointer", marginBottom: 2,
                background: selected?.id === c.id ? "rgba(74,179,244,0.1)" : "transparent",
                border: `0.5px solid ${selected?.id === c.id ? "rgba(74,179,244,0.25)" : "transparent"}`,
              }}>
              {c.photo ? (
                <img src={c.photo} alt={displayName(c)} style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
              ) : (
                <div style={{ width: 34, height: 34, borderRadius: "50%", background: avatarBg(c), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#000", flexShrink: 0 }}>
                  {initials(c)}
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{displayName(c)}</div>
                <div style={{ fontSize: 10, color: "#666", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.company || c.email || c.phone || "—"}</div>
              </div>
              {c.group && c.group !== "Personal" && (
                <div style={{ fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 8, background: `${groupColor[c.group] || "#555"}22`, color: groupColor[c.group] || "#aaa", flexShrink: 0 }}>
                  {c.group}
                </div>
              )}
              <button onClick={e => { e.stopPropagation(); remove(c); }} style={{ fontSize: 11, color: "#ff4f5e44", background: "none", border: "none", cursor: "pointer", padding: "2px 4px" }}
                onMouseEnter={e => e.currentTarget.style.color="#ff4f5e"}
                onMouseLeave={e => e.currentTarget.style.color="#ff4f5e44"}><Icon name="✕" size={14} /></button>
            </div>
          ))}
        </div>

        <div style={{ padding: "6px 12px", borderTop: "0.5px solid rgba(255,255,255,0.06)", fontSize: 10, color: "#444" }}>
          {contacts.length} contacts · {syncing ? "Saving…" : "Synced"}
        </div>
      </div>

      {/* ── RIGHT PANE ─────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>

        {/* ── FORM ──── */}
        {(adding || editing) && (
          <ContactForm
            form={form} setForm={setForm}
            editing={editing} syncing={syncing}
            onSave={save} onCancel={closeForm}
          />
        )}

        {/* ── DETAIL ── */}
        {selected && !adding && !editing && (
          <ContactDetail
            contact={selected}
            onEdit={() => openEdit(selected)}
            onDelete={() => remove(selected)}
            onEnrich={() => enrichContacts([selected.id])}
            enriching={enriching}
            showQR={showQR} setShowQR={setShowQR} qrData={qrData}
            aiResult={aiResult} aiLoading={aiLoading}
            onAI={() => runAI(selected)}
            onMessage={setActive ? () => {
              try { localStorage.setItem("lifeos_open_conversation", JSON.stringify({ name: (selected.firstName || selected.name || "").trim(), phone: selected.phone || "", email: selected.email || "" })); } catch {}
              setActive("messages");
            } : null}
            setActive={setActive}
          />
        )}

        {/* ── EMPTY ─── */}
        {!selected && !adding && !editing && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "60%", color: "#444" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}><Icon name="📇" size={14} /></div>
            <div style={{ fontSize: 14, marginBottom: 8 }}>Select a contact or add a new one</div>
            <button onClick={openNew} style={{ background: C.teal, border: "none", borderRadius: 9, color: "#000", fontWeight: 700, fontSize: 13, padding: "10px 24px", cursor: "pointer", marginTop: 10 }}>+ Add Contact</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── FORM COMPONENT ───────────────────────────────────────────────────────────
function ContactForm({ form, setForm, editing, syncing, onSave, onCancel }) {
  const f = k => ({ value: form[k] ?? "", onChange: e => setForm(p => ({ ...p, [k]: e.target.value })) });
  const Section = ({ title }) => (
    <div style={{ fontSize: 10, fontWeight: 700, color: "#555", marginTop: 16, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>{title}</div>
  );
  const L = ({ txt }) => <label style={labelStyle}>{txt}</label>;

  // Updaters for multi socials and addresses (nested)
  const updateSocial = (platform, idx, val) => {
    setForm(p => {
      const soc = { ...(p.socials || {}) };
      const arr = [...(soc[platform] || [])];
      arr[idx] = val;
      soc[platform] = arr;
      return { ...p, socials: soc };
    });
  };
  const addSocial = (platform) => {
    setForm(p => {
      const soc = { ...(p.socials || {}) };
      soc[platform] = [...(soc[platform] || []), ""];
      return { ...p, socials: soc };
    });
  };
  const removeSocial = (platform, idx) => {
    setForm(p => {
      const soc = { ...(p.socials || {}) };
      const arr = (soc[platform] || []).filter((_, j) => j !== idx);
      soc[platform] = arr;
      return { ...p, socials: soc };
    });
  };
  const updateAddr = (which, field, val) => {
    setForm(p => ({
      ...p,
      addresses: {
        ...(p.addresses || { personal: {}, business: {}, other: [] }),
        [which]: { ...((p.addresses && p.addresses[which]) || {}), [field]: val },
      },
    }));
  };
  const addOtherAddr = () => {
    setForm(p => ({
      ...p,
      addresses: {
        ...(p.addresses || { personal: {}, business: {}, other: [] }),
        other: [...((p.addresses && p.addresses.other) || []), { label: "", street: "", city: "", state: "", zip: "" }],
      },
    }));
  };
  const updateOtherAddr = (i, field, val) => {
    setForm(p => {
      const others = [...((p.addresses && p.addresses.other) || [])];
      others[i] = { ...(others[i] || {}), [field]: val };
      return { ...p, addresses: { ...(p.addresses || {}), other: others } };
    });
  };
  const removeOtherAddr = (i) => {
    setForm(p => {
      const others = ((p.addresses && p.addresses.other) || []).filter((_, j) => j !== i);
      return { ...p, addresses: { ...(p.addresses || {}), other: others } };
    });
  };

  return (
    <div style={{ maxWidth: 600 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{editing ? "Edit Contact" : "New Contact"}</h2>
        <button onClick={onCancel} style={{ background: "rgba(255,255,255,0.07)", border: "none", borderRadius: 7, color: "#aaa", padding: "5px 12px", cursor: "pointer", fontSize: 12 }}>Cancel</button>
      </div>

      <Section title="Basic Info" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div><L txt="FIRST NAME" /><input {...f("firstName")} placeholder="First" style={inputStyle} /></div>
        <div><L txt="LAST NAME" /><input {...f("lastName")} placeholder="Last" style={inputStyle} /></div>
        <div><L txt="COMPANY NAME" /><input {...f("company")} placeholder="Company name" style={inputStyle} /></div>
        <div><L txt="JOB TITLE" /><input {...f("jobTitle")} placeholder="Job title" style={inputStyle} /></div>
        <div>
          <L txt="GROUP" />
          <select {...f("group")} style={inputStyle}>
            {["Personal","Work","Family","Business","VIP","Other"].map(g => <option key={g}>{g}</option>)}
          </select>
        </div>
        <div><L txt="BIRTHDAY" />
          <input
            value={formatBirthdayInput(form.birthday || "")}
            onChange={e => setForm(p => ({ ...p, birthday: formatBirthdayInput(e.target.value) }))}
            placeholder="MM/DD/YYYY"
            style={inputStyle}
            maxLength={10}
          />
        </div>
      </div>

      <Section title="Contact Info" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <L txt="PHONE" />
          <MultiField label="Phone" type="tel" placeholder="(555) 000-0000"
            values={[form.phone || "", ...(form.extraPhones || [])]}
            onChange={vals => {
              const fmtd = vals.map(v => formatPhoneForInput(v || ""));
              setForm(p => ({ ...p, phone: fmtd[0] || "", extraPhones: fmtd.slice(1) }));
            }} />
        </div>
        <div>
          <L txt="EMAIL" />
          <MultiField label="Email" type="email" placeholder="email@example.com"
            values={[form.email||"",...(form.extraEmails||[])]}
            onChange={vals => setForm(p => ({ ...p, email: vals[0]||"", extraEmails: vals.slice(1) }))} />
        </div>
        <div style={{ gridColumn: "span 2" }}>
          <L txt="WEBSITE" />
          <MultiField label="Website" type="url" placeholder="https://..."
            values={[form.website||"",...(form.extraWebsites||[])]}
            onChange={vals => setForm(p => ({ ...p, website: vals[0]||"", extraWebsites: vals.slice(1) }))} />
        </div>
      </div>

      <Section title="Addresses" />
      {/* Personal Address */}
      <div style={{ marginBottom: 10 }}>
        <L txt="PERSONAL ADDRESS" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          <div style={{ gridColumn: "span 2" }}>
            <input value={form.addresses?.personal?.street || ""} onChange={e => updateAddr("personal", "street", e.target.value)} placeholder="Street" style={inputStyle} />
          </div>
          <input value={form.addresses?.personal?.city || ""} onChange={e => updateAddr("personal", "city", e.target.value)} placeholder="City" style={inputStyle} />
          <input value={form.addresses?.personal?.state || ""} onChange={e => updateAddr("personal", "state", e.target.value)} placeholder="State" style={inputStyle} />
          <input value={form.addresses?.personal?.zip || ""} onChange={e => updateAddr("personal", "zip", e.target.value)} placeholder="ZIP" style={inputStyle} />
        </div>
      </div>
      {/* Business Address */}
      <div style={{ marginBottom: 10 }}>
        <L txt="BUSINESS ADDRESS" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          <div style={{ gridColumn: "span 2" }}>
            <input value={form.addresses?.business?.street || ""} onChange={e => updateAddr("business", "street", e.target.value)} placeholder="Street" style={inputStyle} />
          </div>
          <input value={form.addresses?.business?.city || ""} onChange={e => updateAddr("business", "city", e.target.value)} placeholder="City" style={inputStyle} />
          <input value={form.addresses?.business?.state || ""} onChange={e => updateAddr("business", "state", e.target.value)} placeholder="State" style={inputStyle} />
          <input value={form.addresses?.business?.zip || ""} onChange={e => updateAddr("business", "zip", e.target.value)} placeholder="ZIP" style={inputStyle} />
        </div>
      </div>
      {/* Additional / other addresses */}
      <div style={{ marginBottom: 6 }}>
        <L txt="ADDITIONAL ADDRESSES" />
        {(form.addresses?.other || []).map((a, i) => (
          <div key={i} style={{ background: "#0a0a0a", border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: 6, marginBottom: 6 }}>
            <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
              <input
                value={a.label || ""}
                onChange={e => updateOtherAddr(i, "label", e.target.value)}
                placeholder="Label (e.g. Vacation Home)"
                style={{ ...inputStyle, flex: 1, fontSize: 11 }}
              />
              <button onClick={() => removeOtherAddr(i)} style={{ background: "none", border: "none", color: "#ff4f5e", fontSize: 16, cursor: "pointer", lineHeight: 1, padding: "0 2px" }}>×</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
              <div style={{ gridColumn: "span 2" }}>
                <input value={a.street || ""} onChange={e => updateOtherAddr(i, "street", e.target.value)} placeholder="Street" style={{ ...inputStyle, fontSize: 11, padding: "5px 7px" }} />
              </div>
              <input value={a.city || ""} onChange={e => updateOtherAddr(i, "city", e.target.value)} placeholder="City" style={{ ...inputStyle, fontSize: 11, padding: "5px 7px" }} />
              <input value={a.state || ""} onChange={e => updateOtherAddr(i, "state", e.target.value)} placeholder="State" style={{ ...inputStyle, fontSize: 11, padding: "5px 7px" }} />
              <input value={a.zip || ""} onChange={e => updateOtherAddr(i, "zip", e.target.value)} placeholder="ZIP" style={{ ...inputStyle, fontSize: 11, padding: "5px 7px" }} />
            </div>
          </div>
        ))}
        <button onClick={addOtherAddr} style={{ fontSize: 10, color: C.blue, background: "none", border: "none", cursor: "pointer", padding: "2px 0", display: "block" }}>+ Add new address</button>
      </div>

      <Section title="Social Accounts" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {SOCIAL_PLATFORMS.map(({ lbl, key }) => (
          <div key={key}>
            <L txt={lbl} />
            {(form.socials?.[key] || []).map((v, i) => (
              <div key={i} style={{ display: "flex", gap: 4, marginBottom: 3 }}>
                <input
                  value={v}
                  onChange={e => updateSocial(key, i, e.target.value)}
                  placeholder="@handle"
                  style={{ flex: 1, padding: "5px 7px", borderRadius: 6, border: "0.5px solid rgba(255,255,255,0.1)", background: "#0a0a0a", color: "#fff", fontSize: 11, outline: "none", boxSizing: "border-box" }}
                />
                <button onClick={() => removeSocial(key, i)} style={{ background: "none", border: "none", color: "#ff4f5e", cursor: "pointer", fontSize: 16, padding: "0 3px", lineHeight: 1 }}>×</button>
              </div>
            ))}
            <button onClick={() => addSocial(key)} style={{ fontSize: 9, color: C.blue, background: "none", border: "none", cursor: "pointer", padding: "1px 0", display: "block" }}>+ Add new</button>
          </div>
        ))}
      </div>

      <Section title="Tags (comma separated)" />
      <input
        value={(form.tags || []).join(", ")}
        onChange={e => setForm(p => ({ ...p, tags: e.target.value.split(",").map(t => t.trim()).filter(Boolean) }))}
        placeholder="friend, vip, local…"
        style={inputStyle}
      />

      <Section title="Notes" />
      <textarea {...f("notes")} placeholder="Notes…" rows={3}
        style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />

      <Section title="Color Tag" />
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {[C.blue,C.teal,C.purple,C.pink,C.orange,C.red,C.gold,"#00bfff"].map(col => (
          <div key={col} onClick={() => setForm(p => ({ ...p, color: col }))}
            style={{ width: 20, height: 20, borderRadius: "50%", background: col, cursor: "pointer",
              border: form.color === col ? "2px solid #fff" : "2px solid transparent" }} />
        ))}
      </div>

      <Section title="Photo" />
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        {form.photo ? (
          <img src={form.photo} alt="Preview" style={{ width: 56, height: 56, borderRadius: "50%", objectFit: "cover" }} />
        ) : (
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#111", display: "flex", alignItems: "center", justifyContent: "center", color: "#555" }}><Icon name="📷" size={14} /></div>
        )}
        <label style={{ padding: "6px 12px", borderRadius: 7, background: "rgba(74,179,244,0.1)", border: `0.5px solid ${C.blue}`, color: C.blue, fontSize: 11, cursor: "pointer" }}>
          Choose Photo
          <input type="file" accept="image/*" style={{ display: "none" }} onChange={async e => {
            const file = e.target.files?.[0];
            if (file) {
              const b64 = await new Promise((res, rej) => { const r = new FileReader(); r.readAsDataURL(file); r.onload = () => res(r.result); r.onerror = rej; });
              setForm(p => ({ ...p, photo: b64 }));
            }
          }} />
        </label>
        {form.photo && (
          <button onClick={() => setForm(p => ({ ...p, photo: "" }))}
            style={{ padding: "4px 8px", borderRadius: 7, background: "rgba(255,79,94,0.1)", border: `0.5px solid ${C.red}`, color: C.red, fontSize: 10, cursor: "pointer" }}>Remove</button>
        )}
      </div>

      <button onClick={onSave} disabled={syncing} style={{
        width: "100%", padding: "10px", borderRadius: 9, border: "none",
        background: C.teal, color: "#000", fontWeight: 700, fontSize: 13, cursor: "pointer",
      }}>{syncing ? "Saving…" : editing ? "Save Changes" : "Add Contact"}</button>
    </div>
  );
}

// ── Email history helper ──────────────────────────────────────────────────────
function ContactEmailHistory({ email, onCompose }) {
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
    try {
      const d = new Date(iso), now = new Date();
      if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      return d.toLocaleDateString([], { month: "short", day: "numeric" });
    } catch { return ""; }
  }

  return (
    <div style={{ background: "#141414", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 16, marginTop: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: 1 }}>✉ Email History</div>
        {email && (
          <button onClick={onCompose}
            style={{ padding: "4px 10px", borderRadius: 20, fontSize: 10, fontWeight: 700, cursor: "pointer", background: `${C.blue}18`, border: `0.5px solid ${C.blue}44`, color: C.blue }}>
            + Send Email
          </button>
        )}
      </div>
      {!email ? (
        <div style={{ fontSize: 11, color: "#444" }}>No email address on file.</div>
      ) : history.length === 0 ? (
        <div style={{ fontSize: 11, color: "#444" }}>No email history yet. Emails sent or received appear here.</div>
      ) : history.map((h, i) => (
        <div key={h.id || i} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "7px 0", borderBottom: i < history.length - 1 ? "0.5px solid rgba(255,255,255,0.05)" : "none" }}>
          <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4, flexShrink: 0, marginTop: 2,
            background: h.direction === "sent" ? `${C.blue}18` : `${C.teal}18`,
            color: h.direction === "sent" ? C.blue : C.teal }}>
            {h.direction === "sent" ? "↑ Sent" : "↓ Rcvd"}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.subject}</div>
            {h.snippet && <div style={{ fontSize: 10, color: "#555", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.snippet}</div>}
          </div>
          <div style={{ fontSize: 9, color: "#555", flexShrink: 0 }}>{fmt(h.date)}</div>
        </div>
      ))}
    </div>
  );
}

// ─── DETAIL COMPONENT ─────────────────────────────────────────────────────────
function ContactDetail({ contact: c, onEdit, onDelete, onEnrich, enriching, showQR, setShowQR, qrData, aiResult, aiLoading, onAI, onMessage, setActive }) {
  const name = displayName(c);

  return (
    <div style={{ maxWidth: 600 }}>
      {/* hero */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
        {c.photo ? (
          <img src={c.photo} alt={name} style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
        ) : (
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: avatarBg(c), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 800, color: "#000", flexShrink: 0 }}>
            {initials(c)}
          </div>
        )}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{name}</div>
          {(c.jobTitle || c.title || c.company) && (
            <div style={{ fontSize: 12, color: "#888", marginBottom: 6 }}>{[c.jobTitle || c.title, c.company].filter(Boolean).join(" · ")}</div>
          )}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
            {c.group && <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: `${groupColor[c.group]||"#555"}22`, color: groupColor[c.group]||"#aaa", border: `0.5px solid ${groupColor[c.group]||"#555"}55` }}>{c.group}</span>}
            {c.lastContact && <span style={{ fontSize: 10, color: "#555" }}>Last contact: {c.lastContact}</span>}
          </div>
        </div>
        {showQR && <QRCode text={qrData} size={100} />}
      </div>

      {/* action buttons */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
        {[
          { label: "✏️ Edit",    fn: onEdit,    col: C.blue },
          { label: enriching ? "⟳ Enriching…" : "✦ Enrich", fn: onEnrich, col: C.purple, disabled: enriching },
          { label: showQR ? "✕ QR" : "📱 QR Card", fn: () => setShowQR(s => !s), col: C.teal },
          { label: "🗑 Delete",  fn: onDelete,  col: C.red },
        ].map(({ label, fn, col, disabled }) => (
          <button key={label} onClick={fn} disabled={!!disabled}
            style={{ padding: "6px 14px", borderRadius: 20, background: col+"18", border: `0.5px solid ${col}44`, color: col, fontSize: 11, fontWeight: 600, cursor: disabled ? "wait" : "pointer" }}>
            {label}
          </button>
        ))}
        {c.email && <a href={`mailto:${c.email}`} style={{ textDecoration: "none" }}><button style={{ padding: "6px 14px", borderRadius: 20, background: C.blue+"18", border: `0.5px solid ${C.blue}44`, color: C.blue, fontSize: 11, fontWeight: 600, cursor: "pointer" }}><Icon name="✉️" size={12} style={{marginRight:6,verticalAlign:"middle"}} />Email</button></a>}
        {c.phone && <a href={`tel:${c.phone}`} style={{ textDecoration: "none" }}><button style={{ padding: "6px 14px", borderRadius: 20, background: C.teal+"18", border: `0.5px solid ${C.teal}44`, color: C.teal, fontSize: 11, fontWeight: 600, cursor: "pointer" }}><Icon name="📞" size={12} style={{marginRight:6,verticalAlign:"middle"}} />Call</button></a>}
        {c.phone && <a href={`sms:${c.phone}`} style={{ textDecoration: "none" }}><button style={{ padding: "6px 14px", borderRadius: 20, background: C.purple+"18", border: `0.5px solid ${C.purple}44`, color: C.purple, fontSize: 11, fontWeight: 600, cursor: "pointer" }}><Icon name="💬" size={12} style={{marginRight:6,verticalAlign:"middle"}} />Text</button></a>}
        {onMessage && <button onClick={onMessage} style={{ padding: "6px 14px", borderRadius: 20, background: "#ff8c4218", border: "0.5px solid #ff8c4244", color: "#ff8c42", fontSize: 11, fontWeight: 600, cursor: "pointer" }}><Icon name="💬" size={12} style={{marginRight:6,verticalAlign:"middle"}} />Message</button>}
      </div>

      {/* info grid */}
      <div style={{ background: "#141414", border: "0.5px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 16, marginBottom: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[
            ["📞 Phone",    c.phone   && <a href={`tel:${c.phone}`} style={{ color: C.blue, textDecoration: "none" }}>{c.phone}</a>],
            ["📞 Phone 2",  c.phone2  && <a href={`tel:${c.phone2}`} style={{ color: C.blue, textDecoration: "none" }}>{c.phone2}</a>],
            ["📧 Email",    c.email   && <a href={`mailto:${c.email}`} style={{ color: C.blue, textDecoration: "none" }}>{c.email}</a>],
            ["📧 Email 2",  c.email2  && <a href={`mailto:${c.email2}`} style={{ color: C.blue, textDecoration: "none" }}>{c.email2}</a>],
            ["🌐 Website",  c.website && <a href={c.website} target="_blank" rel="noreferrer" style={{ color: C.blue, textDecoration: "none" }}>{c.website}</a>],
            ["🎂 Birthday", c.birthday],
          ].filter(([,v]) => v).map(([label, value]) => (
            <div key={label} style={{ background: "#000", borderRadius: 8, padding: "8px 10px" }}>
              <div style={{ fontSize: 10, color: "#555", marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 12, color: "#fff" }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Addresses (multi: personal/business + additional) */}
        {(() => {
          const addrs = [];
          const ap = c.addresses?.personal || {};
          if (ap.street || ap.city || ap.state || ap.zip) {
            addrs.push({ label: "🏠 Personal", val: [ap.street, ap.city, ap.state, ap.zip].filter(Boolean).join(", ") });
          }
          const ab = c.addresses?.business || {};
          if (ab.street || ab.city || ab.state || ab.zip) {
            addrs.push({ label: "🏢 Business", val: [ab.street, ab.city, ab.state, ab.zip].filter(Boolean).join(", ") });
          }
          (c.addresses?.other || []).forEach(o => {
            if (!o) return;
            const val = [o.street, o.city, o.state, o.zip].filter(Boolean).join(", ");
            if (val || o.label) addrs.push({ label: o.label ? `📍 ${o.label}` : "📍 Address", val: val || "" });
          });
          // legacy fallback
          if (addrs.length === 0) {
            const leg = c.address || [c.street, c.city, c.state, c.zip].filter(Boolean).join(", ");
            if (leg) addrs.push({ label: "🏢 Address", val: leg });
          }
          if (!addrs.length) return null;
          return (
            <div style={{ marginTop: 10 }}>
              {addrs.map((a, i) => (
                <div key={i} style={{ background: "#000", borderRadius: 8, padding: "6px 10px", marginBottom: 4, fontSize: 11 }}>
                  <div style={{ fontSize: 9, color: "#555", marginBottom: 1 }}>{a.label}</div>
                  <div style={{ color: "#fff" }}>{a.val}</div>
                </div>
              ))}
            </div>
          );
        })()}

        {/* tags */}
        {c.tags?.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 10, color: "#555", marginBottom: 4 }}><Icon name="🏷️" size={12} style={{marginRight:6,verticalAlign:"middle"}} />TAGS</div>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {c.tags.map(t => <span key={t} style={{ padding: "2px 8px", borderRadius: 20, background: C.purple+"22", border: `0.5px solid ${C.purple}`, color: C.purple, fontSize: 10 }}>{t}</span>)}
            </div>
          </div>
        )}

        {/* socials (support arrays per platform + new platforms) */}
        {c.socials && Object.values(c.socials || {}).some(v => Array.isArray(v) ? v.some(Boolean) : Boolean(v)) && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 10, color: "#555", marginBottom: 6 }}>SOCIAL</div>
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
              {SOCIAL_PLATFORMS.flatMap(({ key, emoji, color }) => {
                let vals = c.socials[key];
                if (!vals) return [];
                if (!Array.isArray(vals)) vals = vals ? [vals] : [];
                return vals.map((handle, idx) => handle ? (
                  <a
                    key={`${key}-${idx}`}
                    href={socialUrl(key, handle)}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ padding: "3px 10px", borderRadius: 20, background: color + "22", border: `0.5px solid ${color}55`, color, fontSize: 11, fontWeight: 600, textDecoration: "none" }}
                  >
                    {emoji} {handle}
                  </a>
                ) : null).filter(Boolean);
              })}
            </div>
          </div>
        )}

        {/* notes */}
        {(c.notes || c.note) && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: "0.5px solid rgba(255,255,255,0.07)" }}>
            <div style={{ fontSize: 10, color: "#555", marginBottom: 4 }}>NOTES</div>
            <div style={{ fontSize: 13, color: "#ccc", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{c.notes || c.note}</div>
          </div>
        )}
      </div>

      {/* AI check-in */}
      <button onClick={onAI} disabled={aiLoading}
        style={{ padding: "9px 18px", borderRadius: 8, background: C.purple+"18", border: `0.5px solid ${C.purple}44`, color: C.purple, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
        {aiLoading ? "◈ Drafting…" : "✦ Draft Check-in Message"}
      </button>
      {(aiResult || aiLoading) && (
        <div style={{ marginTop: 10, padding: 14, borderRadius: 10, background: "rgba(74,179,244,0.05)", border: "0.5px solid rgba(74,179,244,0.2)", fontSize: 13, color: "#aaa", lineHeight: 1.6 }}>
          {aiLoading ? <span style={{ color: C.purple }}><Icon name="◈" size={12} style={{marginRight:6,verticalAlign:"middle"}} />Drafting…</span> : aiResult}
        </div>
      )}

      <ContactEmailHistory
        email={c.email}
        onCompose={() => {
          try { localStorage.setItem("lifeos_email_compose", JSON.stringify({ to: c.email, name: displayName(c), subject: "", body: "", ts: Date.now() })); } catch {}
          setActive?.("email");
        }}
      />
    </div>
  );
}
