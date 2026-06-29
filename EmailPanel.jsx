// EmailPanel.jsx — Full email platform
// Unified inbox · Folders · Campaigns · Analytics · Warm-up · Domain protection
import { useState, useEffect, useCallback } from "react";

// ── Constants ─────────────────────────────────────────────────────────────────
// Auth/email/OAuth routes live on the auth worker
const AUTH_WORKER = "https://maildevil.ceogps.com";
// LLM + email campaign API routes live on the api worker
const API_WORKER = import.meta.env?.VITE_WORKER_URL ?? "https://api.lifeos1.ceogps.com";

const SENDER_DOMAIN = "ceogps.com";
const SENDER_NAME = "Chris Green · CEO GPS";
const DEFAULT_SENDER = "chris@ceogps.com";

// ── Utilities ─────────────────────────────────────────────────────────────────
function sanitize(html = "") {
    if (!html) return "";
    return html
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, "")
        .replace(/javascript\s*:/gi, "about:")
        .replace(/data\s*:/gi, "about:");
}

function kvGet(k) { try { return Promise.resolve(JSON.parse(localStorage.getItem("email_" + k))); } catch { return Promise.resolve(null); } }
function kvSet(k, v) { try { localStorage.setItem("email_" + k, JSON.stringify(v)); } catch { } return Promise.resolve({ ok: true }); }
function lsGet(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } }

function parseAddress(raw = "") {
    const m = raw.match(/^"?([^"<]*?)"?\s*<([^>]+)>$/);
    if (m) return { name: m[1].trim(), email: m[2].trim() };
    return { name: "", email: raw.trim() };
}
function initialsFor(raw = "") {
    const { name, email } = parseAddress(raw);
    const src = name || email;
    return src.split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "?";
}
function formatTime(iso) {
    if (!iso) return "";
    try {
        const d = new Date(iso), now = new Date();
        if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
        if (now - d < 7 * 86400_000) return d.toLocaleDateString([], { weekday: "short" });
        return d.toLocaleDateString([], { month: "short", day: "numeric" });
    } catch { return ""; }
}

async function llm(prompt, max = 600) {
    try {
        const r = await fetch(`${API_WORKER}/api/llm/invoke`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messages: [{ role: "user", content: prompt }], model: "auto", max_tokens: max }),
        });
        if (!r.ok) return "(AI unavailable)";
        const d = await r.json();
        return d.text || d.content || d.result || "(no response)";
    } catch { return "(AI unavailable)"; }
}

// ── Email history (shared with CRM + Contacts) ───────────────────────────────
function emailHistoryLog({ direction = "sent", from, to, cc, subject, date, snippet, threadId, messageId }) {
    try {
        const hist = JSON.parse(localStorage.getItem("lifeos_email_history") || "[]");
        const id = messageId || `${Date.now()}_${Math.random().toString(36).slice(2)}`;
        if (messageId && hist.some(h => h.id === id)) return;
        hist.unshift({ id, direction, from: from || "", to: to || "", cc: cc || "", subject: subject || "(no subject)", date: date || new Date().toISOString(), snippet: (snippet || "").slice(0, 200), threadId: threadId || "" });
        localStorage.setItem("lifeos_email_history", JSON.stringify(hist.slice(0, 2000)));
    } catch { }
}

function emailComposeConsume() {
    try {
        const raw = localStorage.getItem("lifeos_email_compose");
        if (!raw) return null;
        const data = JSON.parse(raw);
        localStorage.removeItem("lifeos_email_compose");
        if (Date.now() - (data.ts || 0) > 15000) return null;
        return data;
    } catch { return null; }
}

function contactSearch(q) {
    if (!q?.trim()) return [];
    const norm = q.toLowerCase();
    try {
        const crm = JSON.parse(localStorage.getItem("lifeos_crm") || "[]");
        const cts = JSON.parse(localStorage.getItem("lifeos_contacts") || "[]");
        const all = [
            ...crm.map(c => ({ name: c.name || "", email: c.email || "", label: c.company || "CRM", src: "crm" })),
            ...cts.map(c => ({ name: c.name || `${c.firstName || ""} ${c.lastName || ""}`.trim(), email: c.email || "", label: c.company || "Contact", src: "contacts" })),
        ];
        return all.filter(c => c.email && (c.name.toLowerCase().includes(norm) || c.email.toLowerCase().includes(norm))).slice(0, 8);
    } catch { return []; }
}

// ── Theme ─────────────────────────────────────────────────────────────────────
const C = {
    bg: "hsl(0 0% 0%)",              // --background
    card: "hsl(0 0% 8%)",            // --card
    border: "hsl(0 0% 20%)",         // --border
    primary: "hsl(355 100% 50%)",    // --primary (#ff000d)
    primaryDark: "hsl(0 100% 25%)",  // --primary-dark (#800000)
    primaryDarker: "hsl(0 67% 18%)", // --primary-darker (#4b0f0f)
    glow: "hsl(355 100% 60%)",       // --accent-glow
    highlight: "hsl(0 0% 85%)",      // --metallic-highlight
    text: "hsl(0 0% 94%)",           // --foreground (#f0f0f0)
    textLight: "#a9a9a9",            // Lighter gray for better visibility
    t2: "#a9a9a9",                   // --muted-foreground (lighter)
    t3: "hsl(0 0% 40%)",             // --muted (lighter)
    teal: "hsl(355 100% 60%)",
    green: "hsl(355 100% 60%)",
    orange: "hsl(355 100% 60%)",
    purple: "hsl(355 100% 60%)",
    blue: "hsl(355 100% 50%)",
    red: "hsl(355 100% 50%)",
};
const S = {
    card: { background: C.card, border: `0.5px solid ${C.border}`, borderRadius: 12 },
    input: { width: "100%", padding: "8px 12px", borderRadius: 8, border: `0.5px solid ${C.border}`, background: C.bg, color: C.text, fontSize: 13, outline: "none", boxSizing: "border-box" },
    btn: (color) => ({ padding: "9px 16px", borderRadius: 9, border: `0.5px solid ${color}`, background: `${color}18`, color, fontSize: 12, fontWeight: 600, cursor: "pointer" }),
};

const PROVIDER_ICON = {
    gmail: { label: "Gmail", color: "hsl(355 100% 50%)", icon: "G" },
    google: { label: "Gmail", color: "hsl(355 100% 50%)", icon: "G" },
    microsoft: { label: "Outlook", color: "hsl(355 100% 50%)", icon: "O" },
    outlook: { label: "Outlook", color: "hsl(355 100% 50%)", icon: "O" },
    nylas: { label: "iCloud", color: "hsl(355 100% 50%)", icon: "🍎" },
    brevo: { label: "Brevo", color: "hsl(355 100% 50%)", icon: "B" },
    sendgrid: { label: "SG", color: "hsl(355 100% 50%)", icon: "S" },
};

const EMAIL_PROVIDERS_LIST = [
    { id: "google", label: "Gmail", color: "hsl(355 100% 50%)", mode: "oauth" },
    { id: "microsoft", label: "Outlook", color: "hsl(355 100% 50%)", mode: "oauth" },
    { id: "yahoo", label: "Yahoo", color: "hsl(355 100% 50%)", mode: "oauth" },
    { id: "proton", label: "Proton", color: "hsl(355 100% 50%)", mode: "imap" },
    { id: "hostinger", label: "Hostinger", color: "hsl(355 100% 50%)", mode: "imap" },
];

const PANEL_TABS = [
    { id: "inbox", label: "Inbox", icon: "✉" },
    { id: "campaigns", label: "Campaigns", icon: "📢" },
    { id: "analytics", label: "Analytics", icon: "📊" },
    { id: "tools", label: "Tools", icon: "🔧" },
];

// ── MessageCard ───────────────────────────────────────────────────────────────
function MessageCard({ m, index, total }) {
    const [expanded, setExpanded] = useState(index === total - 1);
    const bodyText = (m.text || m.html?.replace(/<[^>]+>/g, " ") || m.snippet || "").trim();

    return (
        <div style={{
            ...S.card,
            marginBottom: 10,
            overflow: "hidden",
            background: "rgba(29, 29, 30, 0.55)",
            backdropFilter: "blur(18px) saturate(170%)",
            WebkitBackdropFilter: "blur(12px) saturate(180%)",
            border: "0.5px solid rgba(255, 255, 255, 0.08)",
            borderLeft: "0.5px solid rgba(255, 255, 255, 0.1)",
            borderTop: "0.5px solid rgba(255, 255, 255, 0.1)",
            borderRadius: "14px",
            boxShadow: "0 4px 16px rgba(0,0,0,0.5)"
        }}>
            <div onClick={() => setExpanded(e => !e)} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "12px 16px",
                cursor: "pointer", userSelect: "none",
                background: expanded ? "transparent" : "rgba(255,255,255,0.02)",
                borderBottom: expanded ? `0.5px solid ${C.border}` : "none",
            }}>
                <div style={{
                    width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
                    background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12, fontWeight: 700, color: "hsl(0 0% 100%)",
                    boxShadow: `0 0 12px rgba(255, 0, 13, 0.3)`
                }}>
                    {initialsFor(m.from)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.from}</div>
                    <div style={{ fontSize: 10, color: C.t2 }}>to {m.to} · {formatTime(m.date)}</div>
                    {!expanded && <div style={{ fontSize: 11, color: C.t2, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{bodyText.slice(0, 200)}</div>}
                </div>
                <div style={{ fontSize: 10, color: C.t2, flexShrink: 0 }}>{expanded ? "▲" : "▼"}</div>
            </div>
            {expanded && (
                <div style={{ padding: "14px 16px" }}>
                    {m.html
                        ? <div style={{ fontSize: 13, color: C.text, lineHeight: 1.6, wordBreak: "break-word" }} dangerouslySetInnerHTML={{ __html: sanitize(m.html) }} />
                        : <div style={{ fontSize: 13, color: C.text, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{m.text || m.snippet || ""}</div>
                    }
                    {m.attachments?.length > 0 && (
                        <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {m.attachments.map(a => (
                                <span key={a.id} style={{ fontSize: 10, padding: "4px 8px", borderRadius: 6, background: `hsla(355 100% 50%, 0.08)`, color: C.primary, border: `0.5px solid ${C.primaryDark}` }}>📎 {a.filename}</span>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ── AddAccountModal ───────────────────────────────────────────────────────────
function AddAccountModal({ onClose, onAdded }) {
    const [provider, setProvider] = useState("google");
    const [label, setLabel] = useState("");
    const [email, setEmail] = useState("");
    const [appPass, setAppPass] = useState("");
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState("");
    const cfg = EMAIL_PROVIDERS_LIST.find(p => p.id === provider);

    function connectOAuth() {
        const slug = (label.trim() || "default").toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "").slice(0, 30) || "default";
        const u = new URL(`${AUTH_WORKER}/api/oauth/start`);
        u.searchParams.set("provider", provider);
        u.searchParams.set("account", slug);
        u.searchParams.set("force", "1");
        u.searchParams.set("_", Date.now().toString(36));
        setBusy(true);
        const popup = window.open(u.toString(), "_blank", "width=520,height=620,resizable=yes");
        const poll = setInterval(() => {
            if (!popup || popup.closed) { clearInterval(poll); setBusy(false); setTimeout(onAdded, 800); }
        }, 600);
    }

    async function connectIMAP() {
        if (!email.trim() || !appPass.trim()) { setErr("Email and app password are required."); return; }
        setErr(""); setBusy(true);
        const IMAP = {
            proton: { host: "127.0.0.1", port: 1143, smtp_host: "127.0.0.1", smtp_port: 1025 },
            hostinger: { host: "imap.hostinger.com", port: 993, smtp_host: "smtp.hostinger.com", smtp_port: 465 },
        };
        const slug = (label.trim() || "default").toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "").slice(0, 30) || "default";
        try {
            const r = await fetch(`${AUTH_WORKER}/api/imap/store`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ provider, account_label: slug, email: email.trim(), app_password: appPass.trim(), ...(IMAP[provider] || {}) }),
            });
            const d = await r.json();
            if (!d.ok) throw new Error(d.error || "Store failed");
            setBusy(false); setTimeout(onAdded, 400);
        } catch (e) { setErr(e.message); setBusy(false); }
    }

    return (
        <div style={{
            position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(0,0,0,0.85)"
        }}
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div style={{
                width: 360,
                background: C.card,
                border: `0.5px solid ${C.primaryDark}`,
                borderRadius: 16,
                padding: 24,
                boxShadow: `0 8px 32px rgba(0,0,0,0.6)`,
                backdropFilter: "blur(18px) saturate(170%)",
                WebkitBackdropFilter: "blur(12px) saturate(180%)",
                borderLeft: "0.5px solid rgba(255,255,255,0.1)",
                borderTop: "0.5px solid rgba(255,255,255,0.1)",
            }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 4 }}>Add Email Account</div>
                <div style={{ fontSize: 11, color: C.t2, marginBottom: 18 }}>Connect your inbox to LifeOS1</div>

                <div style={{ fontSize: 10, fontWeight: 700, color: C.t2, letterSpacing: ".05em", marginBottom: 8 }}>PROVIDER</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                    {EMAIL_PROVIDERS_LIST.map(p => (
                        <button key={p.id} onClick={() => { setProvider(p.id); setErr(""); }}
                            style={{
                                flex: "1 1 calc(33% - 8px)", padding: "9px 6px", borderRadius: 10, cursor: "pointer",
                                background: provider === p.id ? `${p.color}22` : "rgba(255,255,255,0.04)",
                                border: `0.5px solid ${provider === p.id ? p.color : C.border}`,
                                color: provider === p.id ? C.text : C.t2, fontSize: 11, fontWeight: provider === p.id ? 700 : 400
                            }}>
                            {p.label}
                        </button>
                    ))}
                </div>

                {cfg?.mode === "imap" && (
                    <>
                        <div style={{
                            fontSize: 10, color: C.glow, marginBottom: 10, padding: "6px 10px",
                            background: `hsla(355 100% 50%, 0.08)`, borderRadius: 6, border: `0.5px solid ${C.primaryDark}`
                        }}>
                            {provider === "proton" ? "Requires Proton Mail Bridge running locally." : "Uses IMAP with an app password from your Hostinger panel."}
                        </div>
                        <input value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" style={{ ...S.input, marginBottom: 8 }} />
                        <input type="password" value={appPass} onChange={e => setAppPass(e.target.value)} placeholder="App password" style={{ ...S.input, marginBottom: 8 }} />
                    </>
                )}

                <div style={{ fontSize: 10, fontWeight: 700, color: C.t2, letterSpacing: ".05em", marginBottom: 6, marginTop: 4 }}>LABEL <span style={{ fontWeight: 400, color: C.t2 }}>(optional)</span></div>
                <input value={label} onChange={e => setLabel(e.target.value)} placeholder='e.g. "personal", "work", "ceo"' style={{ ...S.input, marginBottom: 6 }} />
                <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
                    {["personal", "work", "ceo", "support"].map(s => (
                        <button key={s} onClick={() => setLabel(s)}
                            style={{
                                padding: "3px 10px", borderRadius: 20, fontSize: 10, cursor: "pointer",
                                background: label === s ? `hsla(355 100% 50%, 0.15)` : "rgba(255,255,255,0.05)",
                                border: `0.5px solid ${label === s ? C.primary : "rgba(255,255,255,0.08)"}`,
                                color: label === s ? C.primary : C.t2
                            }}>
                            {s}
                        </button>
                    ))}
                </div>

                {err && <div style={{ fontSize: 11, color: C.primary, marginBottom: 10 }}>{err}</div>}

                <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={onClose} style={{ flex: 1, padding: "10px", borderRadius: 10, background: "transparent", border: `0.5px solid ${C.border}`, color: C.t2, fontSize: 12, cursor: "pointer" }}>Cancel</button>
                    <button onClick={cfg?.mode === "imap" ? connectIMAP : connectOAuth} disabled={busy}
                        style={{ flex: 2, padding: "10px", borderRadius: 10, background: `${cfg?.color || C.primary}22`, border: `0.5px solid ${cfg?.color || C.primary}`, color: cfg?.color || C.primary, fontSize: 12, fontWeight: 700, cursor: busy ? "wait" : "pointer" }}>
                        {busy ? (cfg?.mode === "imap" ? "Saving…" : "Connecting…") : (cfg?.mode === "imap" ? "Save" : "Connect & Authorize")}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── InboxTab ──────────────────────────────────────────────────────────────────
function InboxTab({ accounts, loadAccounts }) {
    const [activeKey, setActiveKey] = useState("");
    const [folders, setFolders] = useState(() => lsGet("lifeos_email_folders") || ["Inbox", "Starred", "Sent", "Drafts", "Spam", "Archive"]);
    const [activeFolder, setActiveFolder] = useState("Inbox");
    const [newFolder, setNewFolder] = useState("");
    const [threads, setThreads] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [openThread, setOpenThread] = useState(null);
    const [openLoading, setOpenLoading] = useState(false);
    const [search, setSearch] = useState("");
    const [composing, setComposing] = useState(false);
    const [composeMode, setComposeMode] = useState("new");
    const [compose, setCompose] = useState({ to: "", cc: "", subject: "", body: "" });
    const [sending, setSending] = useState(false);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiAction, setAiAction] = useState("");
    const [showAddModal, setShowAddModal] = useState(false);
    const [toSuggestions, setToSuggestions] = useState([]);
    const [showToDropdown, setShowToDropdown] = useState(false);

    // Check for compose requests from CRM / Contacts panels
    useEffect(() => {
        const req = emailComposeConsume();
        if (req?.to) {
            setCompose({ to: req.to, cc: "", subject: req.subject || "", body: req.body || "" });
            setComposeMode("new");
            setComposing(true);
        }
    }, []);

    // Resolve active account
    useEffect(() => {
        kvGet("last_account").then(saved => {
            const readable = accounts.filter(a => a.can_read);
            const key = (saved && accounts.find(a => `${a.provider}:${a.account_label}` === saved))
                ? saved
                : (readable[0] ? `${readable[0].provider}:${readable[0].account_label}` : "all");
            setActiveKey(key);
        });
    }, [accounts]);

    useEffect(() => { if (activeKey) kvSet("last_account", activeKey); }, [activeKey]);

    const active = accounts.find(a => `${a.provider}:${a.account_label}` === activeKey);

    // Load threads
    const refresh = useCallback(async () => {
        setLoading(true); setError(null);
        try {
            if (activeKey === "all") {
                // Unified inbox — fetch from all readable accounts in parallel
                const readable = accounts.filter(a => a.can_read);
                const results = await Promise.all(readable.map(async (acct) => {
                    try {
                        const u = new URL(`${AUTH_WORKER}/api/email/threads`);
                        u.searchParams.set("provider", acct.provider);
                        u.searchParams.set("account", acct.account_label);
                        u.searchParams.set("label", "INBOX");
                        u.searchParams.set("limit", "20");
                        const r = await fetch(u);
                        const d = await r.json();
                        return (d.threads || []).map(t => ({ ...t, _account: `${acct.provider}:${acct.account_label}`, _email: acct.email }));
                    } catch { return []; }
                }));
                const merged = results.flat().sort((a, b) => new Date(b.date) - new Date(a.date));
                setThreads(merged);
            } else if (active?.provider === "nylas") {
                const u = new URL(`${AUTH_WORKER}/api/nylas/threads`);
                u.searchParams.set("limit", "40");
                u.searchParams.set("grant_id", active.grant_id || active.id || "");
                if (search.trim()) u.searchParams.set("q", search.trim());
                const r = await fetch(u);
                const d = await r.json();
                setThreads(d.threads || []);
            } else if (active?.can_read) {
                const labelMap = { Inbox: "INBOX", Starred: "STARRED", Sent: "SENT", Drafts: "DRAFT", Spam: "SPAM", Archive: "ARCHIVE" };
                const u = new URL(`${AUTH_WORKER}/api/email/threads`);
                u.searchParams.set("provider", active.provider);
                u.searchParams.set("account", active.account_label);
                u.searchParams.set("label", labelMap[activeFolder] || "INBOX");
                u.searchParams.set("limit", "30");
                if (search.trim()) u.searchParams.set("q", search.trim());
                const r = await fetch(u);
                const d = await r.json();
                if (!r.ok || d.error) { setError(d.detail || d.error || `HTTP ${r.status}`); setThreads([]); }
                else setThreads(d.threads || []);
            }
        } catch (e) { setError(e.message); }
        finally { setLoading(false); }
    }, [activeKey, activeFolder, search, accounts]);

    useEffect(() => { refresh(); }, [refresh]);

    // Open thread
    async function openThreadById(t) {
        setOpenLoading(true);
        const acctKey = t._account || activeKey;
        const acct = accounts.find(a => `${a.provider}:${a.account_label}` === acctKey) || active;
        try {
            let r, d;
            if (acct?.provider === "nylas") {
                const gid = acct.grant_id || acct.id || "";
                r = await fetch(`${AUTH_WORKER}/api/nylas/thread/${encodeURIComponent(t.id)}?grant_id=${encodeURIComponent(gid)}`);
                d = await r.json();
            } else {
                const u = new URL(`${AUTH_WORKER}/api/email/thread/${encodeURIComponent(t.id)}`);
                u.searchParams.set("provider", acct?.provider || "gmail");
                u.searchParams.set("account", acct?.account_label || "default");
                r = await fetch(u);
                d = await r.json();
            }
            if (r.ok && !d.error) {
                const threadData = { ...d, subject: t.subject };
                setOpenThread(threadData);
                // Log received messages to email history for CRM/Contacts tracking
                (threadData.messages || []).forEach(m => {
                    if (m.from && !m.from.toLowerCase().includes(DEFAULT_SENDER.split("@")[1])) {
                        emailHistoryLog({ direction: "received", from: m.from, to: m.to || "", subject: t.subject, date: m.date, snippet: (m.text || m.html || "").replace(/<[^>]+>/g, " ").slice(0, 200), threadId: t.id, messageId: m.id });
                    }
                });
            } else {
                setOpenThread({ error: d.detail || d.error || `HTTP ${r.status}` });
            }
        } catch (e) { setOpenThread({ error: e.message }); }
        finally { setOpenLoading(false); }
    }

    // Send
    async function send() {
        if (!compose.to.trim() || !active) return;
        setSending(true);
        try {
            const isNylas = active.provider === "nylas";
            const endpoint = isNylas ? `${AUTH_WORKER}/api/nylas/send` : `${AUTH_WORKER}/api/email/send`;
            const payload = isNylas
                ? { to: compose.to, cc: compose.cc, subject: compose.subject, body: compose.body, grant_id: active.grant_id || active.id }
                : { provider: active.provider, account: active.account_label, to: compose.to, cc: compose.cc, subject: compose.subject, body_text: compose.body };
            const r = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
            const d = await r.json();
            if (r.ok && d.ok) {
                emailHistoryLog({ direction: "sent", from: active.email || DEFAULT_SENDER, to: compose.to, cc: compose.cc, subject: compose.subject, snippet: compose.body.slice(0, 200) });
                setComposing(false); setCompose({ to: "", cc: "", subject: "", body: "" }); refresh();
            } else alert(`Send failed: ${d.detail || d.error || "unknown"}`);
        } catch (e) { alert("Send failed: " + e.message); }
        finally { setSending(false); }
    }

    // AI
    function quickReply() {
        const last = openThread?.messages?.[openThread.messages.length - 1];
        if (!last) return;
        setCompose({ to: parseAddress(last.from).email, cc: "", subject: `Re: ${openThread.subject}`, body: "" });
        setComposeMode("reply"); setComposing(true);
    }
    async function aiDraftReply() {
        const last = openThread?.messages?.[openThread.messages.length - 1];
        if (!last) return;
        setAiLoading(true); setAiAction("reply");
        const text = (last.text || last.html || "").replace(/<[^>]+>/g, " ").slice(0, 4000);
        const body = await llm(`Draft a professional, warm reply. Subject: "${openThread.subject}". From: ${last.from}. Body: "${text}". Reply body only.`);
        setCompose({ to: parseAddress(last.from).email, cc: "", subject: `Re: ${openThread.subject}`, body });
        setComposeMode("reply"); setComposing(true); setAiLoading(false); setAiAction("");
    }
    async function aiSummarize() {
        if (!openThread?.messages?.length) return;
        setAiLoading(true); setAiAction("sum");
        const conv = openThread.messages.map(m => `${parseAddress(m.from).email}: ${(m.text || m.html || "").replace(/<[^>]+>/g, " ").slice(0, 800)}`).join("\n\n");
        const result = await llm(`Summarize this thread in 2-3 sentences. Suggest 2 next actions.\n\n${conv}`);
        setOpenThread(prev => prev ? { ...prev, aiSummary: result } : prev);
        setAiLoading(false); setAiAction("");
    }
    async function aiComposeNew() {
        setAiLoading(true); setAiAction("compose");
        const body = await llm(`Write a professional business introduction email from Chris Green at CEO GPS. Under 100 words, warm and direct. Body only.`);
        setCompose({ to: "", cc: "", subject: "Introduction — CEO GPS", body });
        setComposeMode("new"); setComposing(true); setAiLoading(false); setAiAction("");
    }

    function addFolder() {
        if (!newFolder.trim()) return;
        const next = [...folders, newFolder.trim()];
        setFolders(next); lsSet("lifeos_email_folders", next); setNewFolder("");
    }

    const filtered = threads.filter(t =>
        !search.trim() || (t.subject + " " + t.from + " " + (t.snippet || "")).toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div style={{ display: "flex", height: "100%", overflow: "hidden", background: C.bg }}>

            {/* ── LEFT: Folder + account sidebar ─────────────────────────────────── */}
            <div style={{
                width: 200,
                borderRight: `0.5px solid ${C.border}`,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                flexShrink: 0,
                background: C.bg,
            }}>

                {/* Account selector */}
                <div style={{ padding: "10px 10px 8px", borderBottom: `0.5px solid ${C.border}` }}>
                    <select value={activeKey} onChange={e => { setActiveKey(e.target.value); setOpenThread(null); setActiveFolder("Inbox"); }}
                        style={{
                            width: "100%",
                            background: C.card,
                            border: `0.5px solid ${C.border}`,
                            borderRadius: 7,
                            padding: "6px 8px",
                            color: C.text,
                            fontSize: 11,
                            cursor: "pointer",
                            outline: "none"
                        }}>
                        <option value="all">★ All Inboxes</option>
                        {accounts.map(a => {
                            const key = `${a.provider}:${a.account_label}`;
                            const pi = PROVIDER_ICON[a.provider] || { label: a.provider };
                            return <option key={key} value={key}>{pi.label} — {a.email || a.account_label}</option>;
                        })}
                    </select>
                    <button onClick={() => setShowAddModal(true)}
                        style={{
                            width: "100%",
                            marginTop: 6,
                            padding: "5px",
                            borderRadius: 6,
                            background: "transparent",
                            border: `0.5px solid ${C.primary}44`,
                            color: C.primary,
                            fontSize: 10,
                            fontWeight: 700,
                            cursor: "pointer",
                            transition: "all 0.18s ease"
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = `rgba(255, 0, 13, 0.06)`; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
                        + Add Account
                    </button>
                </div>

                {/* Folders */}
                <div style={{ flex: 1, overflowY: "auto", padding: "8px 6px" }}>
                    {folders.map(f => (
                        <button key={f} onClick={() => { setActiveFolder(f); setOpenThread(null); }}
                            style={{
                                width: "100%", textAlign: "left", padding: "6px 10px", borderRadius: 6, cursor: "pointer",
                                background: activeFolder === f ? `hsla(355 100% 50%, 0.12)` : "transparent",
                                border: "none",
                                color: activeFolder === f ? C.primary : C.t2,
                                fontSize: 11,
                                marginBottom: 1,
                                transition: "all 0.18s ease",
                                borderLeft: activeFolder === f ? `2px solid ${C.primary}` : "2px solid transparent",
                            }}>
                            {f}
                        </button>
                    ))}
                    {/* Add folder */}
                    <div style={{ marginTop: 8, display: "flex", gap: 4 }}>
                        <input value={newFolder} onChange={e => setNewFolder(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && addFolder()}
                            placeholder="New folder…"
                            style={{ ...S.input, fontSize: 10, padding: "4px 8px", flex: 1 }} />
                        <button onClick={addFolder}
                            style={{
                                background: C.primary,
                                border: "none",
                                borderRadius: 5,
                                padding: "4px 8px",
                                color: "hsl(0 0% 100%)",
                                fontSize: 11,
                                cursor: "pointer",
                                boxShadow: `0 0 12px rgba(255, 0, 13, 0.3)`
                            }}>+</button>
                    </div>
                </div>
            </div>

            {/* ── CENTER: Thread list ──────────────────────────────────────────────── */}
            <div style={{
                width: 280,
                borderRight: `0.5px solid ${C.border}`,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                flexShrink: 0,
                background: C.bg,
            }}>
                <div style={{ padding: "10px 10px 8px", borderBottom: `0.5px solid ${C.border}`, display: "flex", gap: 6, flexDirection: "column" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: C.t2 }}>{activeFolder}</span>
                        <button onClick={refresh} style={{
                            fontSize: 13,
                            color: C.primary,
                            background: `hsla(355 100% 50%, 0.08)`,
                            border: `0.5px solid ${C.primaryDark}`,
                            borderRadius: 5,
                            padding: "2px 8px",
                            cursor: "pointer",
                            transition: "all 0.18s ease"
                        }}
                            onMouseEnter={e => { e.currentTarget.style.background = `rgba(255, 0, 13, 0.15)`; }}
                            onMouseLeave={e => { e.currentTarget.style.background = `hsla(355 100% 50%, 0.08)`; }}>↻</button>
                    </div>
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…" style={{ ...S.input, fontSize: 11 }} />
                    <button onClick={() => { setComposeMode("new"); setCompose({ to: "", cc: "", subject: "", body: "" }); setComposing(true); setOpenThread(null); }}
                        style={{
                            ...S.btn(C.primary),
                            padding: "7px",
                            fontSize: 11,
                            fontWeight: 700,
                            transition: "all 0.18s ease"
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = `rgba(255, 0, 13, 0.15)`; }}
                        onMouseLeave={e => { e.currentTarget.style.background = `${C.primary}18`; }}>
                        + New Message
                    </button>
                </div>

                <div style={{ flex: 1, overflowY: "auto" }}>
                    {accounts.length === 0 ? (
                        <div style={{ padding: 20, textAlign: "center" }}>
                            <div style={{ fontSize: 24, marginBottom: 8 }}>✉️</div>
                            <div style={{ fontSize: 12, color: C.glow, fontWeight: 700, marginBottom: 8 }}>No accounts connected</div>
                            {[
                                { p: "google", label: "Connect Gmail", color: C.primary },
                                { p: "microsoft", label: "Connect Outlook", color: C.primary },
                            ].map(btn => (
                                <button key={btn.p} onClick={() => {
                                    const u = new URL(`${AUTH_WORKER}/api/oauth/start`);
                                    u.searchParams.set("provider", btn.p); u.searchParams.set("account", "default"); u.searchParams.set("force", "1"); u.searchParams.set("_", Date.now().toString(36));
                                    const popup = window.open(u.toString(), "_blank", "width=520,height=620");
                                    const poll = setInterval(() => { if (!popup || popup.closed) { clearInterval(poll); setTimeout(loadAccounts, 800); } }, 600);
                                }}
                                    style={{
                                        ...S.btn(btn.color),
                                        display: "block",
                                        width: "100%",
                                        marginBottom: 6,
                                        transition: "all 0.18s ease"
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.background = `rgba(255, 0, 13, 0.15)`; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = `${btn.color}18`; }}>
                                    {btn.label}
                                </button>
                            ))}
                        </div>
                    ) : loading ? (
                        <div style={{ padding: 20, fontSize: 12, color: C.t2, textAlign: "center" }}>Loading…</div>
                    ) : error ? (
                        <div style={{ padding: 12, fontSize: 11, color: C.primary }}>
                            <div style={{ fontWeight: 700, marginBottom: 4 }}>Couldn't load mail</div>
                            <div style={{ color: C.t2, fontSize: 10 }}>{error}</div>
                            <button onClick={refresh} style={{ ...S.btn(C.primary), marginTop: 8, fontSize: 10 }}>Retry</button>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div style={{ padding: 24, fontSize: 12, color: C.t2, textAlign: "center" }}>No messages.</div>
                    ) : filtered.map(t => (
                        <div key={t.id} onClick={() => openThreadById(t)}
                            style={{
                                padding: "10px 12px",
                                borderBottom: `0.5px solid rgba(255,255,255,0.04)`,
                                cursor: "pointer",
                                background: openThread?.id === t.id ? `hsla(355 100% 50%, 0.08)` : "transparent",
                                transition: "all 0.18s ease",
                                borderLeft: openThread?.id === t.id ? `2px solid ${C.primary}` : "2px solid transparent"
                            }}
                            onMouseEnter={e => { if (openThread?.id !== t.id) e.currentTarget.style.background = `rgba(255, 0, 13, 0.04)`; }}
                            onMouseLeave={e => { if (openThread?.id !== t.id) e.currentTarget.style.background = "transparent"; }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                                <div style={{ fontSize: 12, fontWeight: t.unread ? 700 : 500, color: t.unread ? C.text : C.t2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                                    {t._email ? <span style={{ fontSize: 9, color: C.glow, marginRight: 4 }}>●</span> : null}
                                    {parseAddress(t.from).name || parseAddress(t.from).email}
                                </div>
                                <div style={{ fontSize: 9, color: C.t2, flexShrink: 0, marginLeft: 6 }}>{formatTime(t.date)}</div>
                            </div>
                            <div style={{ fontSize: 11, fontWeight: t.unread ? 600 : 400, color: t.unread ? C.text : C.t2, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {t.subject}
                                {t.message_count > 1 && <span style={{ fontSize: 9, color: C.primary, marginLeft: 5 }}>{t.message_count}</span>}
                            </div>
                            <div style={{ fontSize: 10, color: C.t2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.snippet}</div>
                            {t.unread && <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.primary, marginTop: 3, boxShadow: `0 0 8px ${C.primary}` }} />}
                        </div>
                    ))}
                </div>
            </div>

            {/* ── RIGHT: Thread view / Compose ────────────────────────────────────── */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: C.bg }}>
                {composing ? (
                    <div style={{ flex: 1, padding: 24, display: "flex", flexDirection: "column", gap: 10, overflow: "auto" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>
                                {composeMode === "reply" ? `↩ Reply: ${compose.subject}` : "New Message"}
                            </div>
                            <button onClick={() => setComposing(false)} style={{ fontSize: 12, color: C.t2, background: "none", border: "none", cursor: "pointer" }}>Cancel</button>
                        </div>
                        {active && (
                            <div style={{ fontSize: 10, color: C.t2, display: "flex", alignItems: "center", gap: 6 }}>
                                <div style={{
                                    width: 16, height: 16, borderRadius: "50%", background: PROVIDER_ICON[active.provider]?.color || C.primary,
                                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 700, color: "hsl(0 0% 100%)",
                                    boxShadow: `0 0 8px rgba(255, 0, 13, 0.3)`
                                }}>
                                    {PROVIDER_ICON[active.provider]?.icon || "?"}
                                </div>
                                Sending from <span style={{ color: C.text, fontWeight: 600 }}>{active.email || active.account_label}</span>
                            </div>
                        )}
                        <div style={{ position: "relative" }}>
                            <input
                                value={compose.to}
                                onChange={e => {
                                    setCompose(c => ({ ...c, to: e.target.value }));
                                    const hits = contactSearch(e.target.value);
                                    setToSuggestions(hits);
                                    setShowToDropdown(hits.length > 0);
                                }}
                                onFocus={() => { if (toSuggestions.length) setShowToDropdown(true); }}
                                onBlur={() => setTimeout(() => setShowToDropdown(false), 150)}
                                placeholder="To (type name or email to search contacts)"
                                style={S.input}
                            />
                            {showToDropdown && (
                                <div style={{
                                    position: "absolute", top: "100%", left: 0, right: 0, zIndex: 99,
                                    background: C.card, border: `0.5px solid ${C.primary}44`, borderRadius: 8, marginTop: 2, overflow: "hidden",
                                    backdropFilter: "blur(18px) saturate(170%)",
                                    WebkitBackdropFilter: "blur(12px) saturate(180%)",
                                    boxShadow: `0 4px 16px rgba(0,0,0,0.5)`
                                }}>
                                    {toSuggestions.map((s, i) => (
                                        <div key={i} onMouseDown={() => {
                                            setCompose(c => ({ ...c, to: s.email }));
                                            setShowToDropdown(false); setToSuggestions([]);
                                        }}
                                            style={{
                                                display: "flex", justifyContent: "space-between", padding: "8px 12px", cursor: "pointer",
                                                background: "transparent", borderBottom: `0.5px solid ${C.border}`
                                            }}
                                            onMouseEnter={e => e.currentTarget.style.background = `hsla(355 100% 50%, 0.08)`}
                                            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                                            <div>
                                                <div style={{ fontSize: 12, color: C.text, fontWeight: 600 }}>{s.name}</div>
                                                <div style={{ fontSize: 10, color: C.t2 }}>{s.email}</div>
                                            </div>
                                            <div style={{
                                                fontSize: 9, color: s.src === "crm" ? C.glow : C.primary, alignSelf: "center",
                                                padding: "2px 6px", borderRadius: 4, background: s.src === "crm" ? `hsla(355 100% 50%, 0.1)` : `hsla(355 100% 50%, 0.1)`
                                            }}>
                                                {s.src === "crm" ? "CRM" : "Contact"} {s.label ? `· ${s.label}` : ""}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <input value={compose.cc} onChange={e => setCompose(c => ({ ...c, cc: e.target.value }))} placeholder="Cc" style={S.input} />
                        <input value={compose.subject} onChange={e => setCompose(c => ({ ...c, subject: e.target.value }))} placeholder="Subject" style={S.input} />
                        <textarea value={compose.body} onChange={e => setCompose(c => ({ ...c, body: e.target.value }))}
                            placeholder="Write your message…"
                            style={{ ...S.input, flex: 1, minHeight: 200, resize: "none", lineHeight: 1.6 }} />
                        <button onClick={send} disabled={sending || !compose.to.trim()}
                            style={{
                                ...S.btn(C.primary),
                                opacity: !compose.to.trim() ? 0.5 : 1,
                                transition: "all 0.18s ease"
                            }}
                            onMouseEnter={e => { if (compose.to.trim()) { e.currentTarget.style.background = `rgba(255, 0, 13, 0.15)`; } }}
                            onMouseLeave={e => { if (compose.to.trim()) { e.currentTarget.style.background = `${C.primary}18`; } }}>
                            {sending ? "Sending…" : "Send"}
                        </button>
                    </div>

                ) : openThread ? (
                    <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
                        {openLoading ? (
                            <div style={{ color: C.t2, fontSize: 12 }}>Loading thread…</div>
                        ) : openThread.error ? (
                            <div style={{ color: C.primary, fontSize: 12 }}>Error: {openThread.error}</div>
                        ) : (
                            <>
                                <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 16 }}>{openThread.subject}</div>
                                {openThread.messages?.map((m, i) => (
                                    <MessageCard key={m.id || i} m={m} index={i} total={openThread.messages.length} />
                                ))}
                                {openThread.aiSummary && (
                                    <div style={{
                                        ...S.card,
                                        padding: 14,
                                        marginBottom: 12,
                                        borderColor: C.primaryDark,
                                        background: "rgba(29, 29, 30, 0.55)",
                                        backdropFilter: "blur(18px) saturate(170%)",
                                        WebkitBackdropFilter: "blur(12px) saturate(180%)",
                                        border: "0.5px solid rgba(255, 255, 255, 0.08)",
                                        borderLeft: "0.5px solid rgba(255, 255, 255, 0.1)",
                                        borderTop: "0.5px solid rgba(255, 255, 255, 0.1)",
                                        borderRadius: "14px",
                                        boxShadow: "0 4px 16px rgba(0,0,0,0.5)"
                                    }}>
                                        <div style={{ fontSize: 10, color: C.primary, fontWeight: 700, marginBottom: 6, letterSpacing: ".05em" }}>◈ AI SUMMARY</div>
                                        <div style={{ fontSize: 13, color: C.text, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{openThread.aiSummary}</div>
                                    </div>
                                )}
                                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                                    <button onClick={quickReply} style={{
                                        ...S.btn(C.glow),
                                        flex: 1,
                                        transition: "all 0.18s ease"
                                    }}
                                        onMouseEnter={e => { e.currentTarget.style.background = `rgba(255, 0, 13, 0.15)`; }}
                                        onMouseLeave={e => { e.currentTarget.style.background = `${C.glow}18`; }}>↩ Reply</button>
                                    <button onClick={aiDraftReply} disabled={aiLoading} style={{
                                        ...S.btn(C.primary),
                                        flex: 1,
                                        transition: "all 0.18s ease"
                                    }}
                                        onMouseEnter={e => { if (!aiLoading) { e.currentTarget.style.background = `rgba(255, 0, 13, 0.15)`; } }}
                                        onMouseLeave={e => { if (!aiLoading) { e.currentTarget.style.background = `${C.primary}18`; } }}>
                                        {aiLoading && aiAction === "reply" ? "Drafting…" : "✦ AI Reply"}
                                    </button>
                                    <button onClick={aiSummarize} disabled={aiLoading} style={{
                                        ...S.btn(C.primary),
                                        flex: 1,
                                        transition: "all 0.18s ease"
                                    }}
                                        onMouseEnter={e => { if (!aiLoading) { e.currentTarget.style.background = `rgba(255, 0, 13, 0.15)`; } }}
                                        onMouseLeave={e => { if (!aiLoading) { e.currentTarget.style.background = `${C.primary}18`; } }}>
                                        {aiLoading && aiAction === "sum" ? "Analyzing…" : "Summarize"}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>

                ) : (
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
                        <div style={{ fontSize: 14, color: C.t2 }}>Select a message or compose</div>
                        <button onClick={() => { setComposeMode("new"); setCompose({ to: "", cc: "", subject: "", body: "" }); setComposing(true); }}
                            style={{
                                ...S.btn(C.primary),
                                transition: "all 0.18s ease"
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = `rgba(255, 0, 13, 0.15)`; }}
                            onMouseLeave={e => { e.currentTarget.style.background = `${C.primary}18`; }}>+ Compose</button>
                        <button onClick={aiComposeNew} disabled={aiLoading} style={{
                            ...S.btn(C.primary),
                            transition: "all 0.18s ease"
                        }}
                            onMouseEnter={e => { if (!aiLoading) { e.currentTarget.style.background = `rgba(255, 0, 13, 0.15)`; } }}
                            onMouseLeave={e => { if (!aiLoading) { e.currentTarget.style.background = `${C.primary}18`; } }}>
                            {aiLoading && aiAction === "compose" ? "Writing…" : "✦ AI Compose"}
                        </button>
                    </div>
                )}
            </div>

            {showAddModal && (
                <AddAccountModal onClose={() => setShowAddModal(false)} onAdded={async () => { setShowAddModal(false); await loadAccounts(); }} />
            )}
        </div>
    );
}

// ── CampaignsTab ──────────────────────────────────────────────────────────────
function CampaignsTab() {
    const LS_KEY = "lifeos_email_campaigns";
    const [campaigns, setCampaigns] = useState(() => lsGet(LS_KEY) || []);
    const [view, setView] = useState("list"); // list | create
    const [form, setForm] = useState({
        name: "", subject: "", senderName: SENDER_NAME, senderEmail: DEFAULT_SENDER,
        recipients: "", body: "", service: "brevo", schedule: "now",
    });
    const [aiLoading, setAiLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [status, setStatus] = useState("");

    function saveCampaigns(c) { setCampaigns(c); lsSet(LS_KEY, c); }

    async function aiWriteCampaign() {
        setAiLoading(true);
        const body = await llm(`Write a professional B2B email campaign body for CEO GPS marketing company in Atlanta. Goal: attract new clients to our community marketing platform. Under 150 words. Be specific, direct, value-focused. Include a clear CTA. Body only.`, 400);
        setForm(f => ({ ...f, body, subject: f.subject || "Grow Your Business with CEO GPS" }));
        setAiLoading(false);
    }

    async function sendCampaign() {
        if (!form.subject.trim() || !form.body.trim() || !form.recipients.trim()) {
            setStatus("error:Fill in subject, body, and recipients.");
            return;
        }
        setSending(true); setStatus("sending");
        const recipientList = form.recipients.split(/[\n,;]+/).map(e => e.trim()).filter(Boolean);

        try {
            // Try Worker's Brevo/SendGrid proxy
            const endpoint = `${API_WORKER}/api/email/campaign`;
            const r = await fetch(endpoint, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    service: form.service,
                    name: form.name || form.subject,
                    subject: form.subject,
                    sender_name: form.senderName,
                    sender_email: form.senderEmail,
                    recipients: recipientList,
                    html_content: `<p style="font-family:sans-serif;line-height:1.7">${form.body.replace(/\n/g, "<br>")}</p>`,
                    text_content: form.body,
                }),
            });
            const d = await r.json();
            if (r.ok && (d.ok || d.id || d.messageId)) {
                const newCampaign = {
                    id: Date.now(), name: form.name || form.subject, subject: form.subject,
                    recipients: recipientList.length, service: form.service,
                    sentAt: new Date().toISOString(), status: "sent",
                };
                saveCampaigns([newCampaign, ...campaigns]);
                setForm({ name: "", subject: "", senderName: SENDER_NAME, senderEmail: DEFAULT_SENDER, recipients: "", body: "", service: "brevo", schedule: "now" });
                setView("list"); setStatus("success");
            } else {
                setStatus(`error:${d.error || d.detail || "Send failed"}`);
            }
        } catch (e) { setStatus(`error:${e.message}`); }
        finally { setSending(false); }
    }

    return (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: C.bg }}>
            {/* Header */}
            <div style={{
                padding: "14px 20px",
                borderBottom: `0.5px solid ${C.border}`,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexShrink: 0,
                background: C.card,
            }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>
                    {view === "create" ? "Create Campaign" : "Email Campaigns"}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                    {view === "list"
                        ? <button onClick={() => setView("create")} style={{
                            ...S.btn(C.primary),
                            transition: "all 0.18s ease"
                        }}
                            onMouseEnter={e => { e.currentTarget.style.background = `rgba(255, 0, 13, 0.15)`; }}
                            onMouseLeave={e => { e.currentTarget.style.background = `${C.primary}18`; }}>+ New Campaign</button>
                        : <button onClick={() => setView("list")} style={{ ...S.btn(C.t2) }}>← Back</button>
                    }
                </div>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>

                {view === "list" ? (
                    <>
                        {/* Domain protection notice */}
                        <div style={{
                            padding: "12px 16px",
                            borderRadius: 10,
                            background: `hsla(355 100% 50%, 0.07)`,
                            border: `0.5px solid ${C.primaryDark}`,
                            marginBottom: 16,
                            display: "flex",
                            gap: 10,
                            alignItems: "flex-start",
                            boxShadow: `0 0 12px rgba(255, 0, 13, 0.05)`
                        }}>
                            <span style={{ fontSize: 16 }}>🛡️</span>
                            <div>
                                <div style={{ fontSize: 12, fontWeight: 700, color: C.glow, marginBottom: 3 }}>Domain Protection Active</div>
                                <div style={{ fontSize: 11, color: C.t2, lineHeight: 1.5 }}>
                                    All campaigns send via Brevo/SendGrid — keeping bulk mail off <strong style={{ color: C.text }}>ceogps.com</strong>'s primary sending reputation.
                                    Use a subdomain like <code style={{ color: C.primary }}>mail.ceogps.com</code> for high-volume sends.
                                </div>
                            </div>
                        </div>

                        {campaigns.length === 0 ? (
                            <div style={{ textAlign: "center", padding: 40, color: C.t2 }}>
                                <div style={{ fontSize: 32, marginBottom: 12 }}>📢</div>
                                <div style={{ fontSize: 13, color: C.t2 }}>No campaigns yet.</div>
                                <button onClick={() => setView("create")} style={{
                                    ...S.btn(C.primary),
                                    marginTop: 12,
                                    transition: "all 0.18s ease"
                                }}
                                    onMouseEnter={e => { e.currentTarget.style.background = `rgba(255, 0, 13, 0.15)`; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = `${C.primary}18`; }}>Create First Campaign</button>
                            </div>
                        ) : campaigns.map(c => (
                            <div key={c.id} style={{
                                ...S.card,
                                padding: "14px 16px",
                                marginBottom: 10,
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                background: "rgba(29, 29, 30, 0.55)",
                                backdropFilter: "blur(18px) saturate(170%)",
                                WebkitBackdropFilter: "blur(12px) saturate(180%)",
                                border: "0.5px solid rgba(255, 255, 255, 0.08)",
                                borderLeft: "0.5px solid rgba(255, 255, 255, 0.1)",
                                borderTop: "0.5px solid rgba(255, 255, 255, 0.1)",
                                borderRadius: "14px",
                                boxShadow: "0 4px 16px rgba(0,0,0,0.5)"
                            }}>
                                <div>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 3 }}>{c.name}</div>
                                    <div style={{ fontSize: 11, color: C.t2 }}>{c.recipients} recipients · {c.service} · {formatTime(c.sentAt)}</div>
                                </div>
                                <div style={{
                                    fontSize: 10, fontWeight: 700, color: c.status === "sent" ? C.glow : C.glow,
                                    background: c.status === "sent" ? `hsla(355 100% 50%, 0.1)` : `hsla(355 100% 50%, 0.1)`,
                                    padding: "3px 8px",
                                    borderRadius: 5,
                                    textTransform: "uppercase",
                                    border: `0.5px solid ${C.primaryDark}`
                                }}>
                                    {c.status}
                                </div>
                            </div>
                        ))}
                    </>
                ) : (
                    <div style={{ maxWidth: 640 }}>
                        {/* Service selector */}
                        <div style={{ marginBottom: 14 }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: C.t2, letterSpacing: ".05em", marginBottom: 6 }}>SENDING SERVICE</div>
                            <div style={{ display: "flex", gap: 8 }}>
                                {[{ id: "brevo", label: "Brevo", color: C.primary }, { id: "sendgrid", label: "SendGrid", color: C.primary }].map(s => (
                                    <button key={s.id} onClick={() => setForm(f => ({ ...f, service: s.id }))}
                                        style={{
                                            flex: 1, padding: "9px", borderRadius: 9, cursor: "pointer",
                                            background: form.service === s.id ? `${s.color}22` : "rgba(255,255,255,0.04)",
                                            border: `0.5px solid ${form.service === s.id ? s.color : C.border}`,
                                            color: form.service === s.id ? s.color : C.t2, fontSize: 12, fontWeight: form.service === s.id ? 700 : 400
                                        }}>
                                        {s.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {[
                            { key: "name", label: "Campaign Name", ph: "Summer Outreach 2026" },
                            { key: "subject", label: "Subject Line", ph: "Grow Your Business with CEO GPS" },
                            { key: "senderName", label: "Sender Name", ph: SENDER_NAME },
                            { key: "senderEmail", label: "Sender Email", ph: DEFAULT_SENDER },
                        ].map(f => (
                            <div key={f.key} style={{ marginBottom: 12 }}>
                                <div style={{ fontSize: 10, fontWeight: 700, color: C.t2, letterSpacing: ".05em", marginBottom: 5 }}>{f.label.toUpperCase()}</div>
                                <input value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                                    placeholder={f.ph} style={S.input} />
                            </div>
                        ))}

                        <div style={{ marginBottom: 12 }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: C.t2, letterSpacing: ".05em", marginBottom: 5 }}>RECIPIENTS</div>
                            <div style={{ fontSize: 10, color: C.t2, marginBottom: 5 }}>One email per line, or comma/semicolon separated</div>
                            <textarea value={form.recipients} onChange={e => setForm(p => ({ ...p, recipients: e.target.value }))}
                                placeholder={"john@example.com\njane@example.com"}
                                style={{ ...S.input, minHeight: 80, resize: "vertical", lineHeight: 1.5 }} />
                            {form.recipients.trim() && (
                                <div style={{ fontSize: 10, color: C.glow, marginTop: 4 }}>
                                    {form.recipients.split(/[\n,;]+/).map(e => e.trim()).filter(Boolean).length} recipients
                                </div>
                            )}
                        </div>

                        <div style={{ marginBottom: 16 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                                <div style={{ fontSize: 10, fontWeight: 700, color: C.t2, letterSpacing: ".05em" }}>EMAIL BODY</div>
                                <button onClick={aiWriteCampaign} disabled={aiLoading}
                                    style={{
                                        ...S.btn(C.primary),
                                        fontSize: 10,
                                        padding: "4px 10px",
                                        transition: "all 0.18s ease"
                                    }}
                                    onMouseEnter={e => { if (!aiLoading) { e.currentTarget.style.background = `rgba(255, 0, 13, 0.15)`; } }}
                                    onMouseLeave={e => { if (!aiLoading) { e.currentTarget.style.background = `${C.primary}18`; } }}>
                                    {aiLoading ? "Writing…" : "✦ AI Write"}
                                </button>
                            </div>
                            <textarea value={form.body} onChange={e => setForm(p => ({ ...p, body: e.target.value }))}
                                placeholder="Write your email body here…"
                                style={{ ...S.input, minHeight: 200, resize: "vertical", lineHeight: 1.6 }} />
                        </div>

                        {status.startsWith("error:") && (
                            <div style={{ fontSize: 11, color: C.primary, marginBottom: 10 }}>{status.replace("error:", "")}</div>
                        )}
                        {status === "success" && (
                            <div style={{ fontSize: 11, color: C.glow, marginBottom: 10 }}>Campaign sent successfully.</div>
                        )}

                        <button onClick={sendCampaign} disabled={sending}
                            style={{
                                ...S.btn(C.primary),
                                width: "100%",
                                padding: "11px",
                                fontSize: 13,
                                fontWeight: 700,
                                transition: "all 0.18s ease"
                            }}
                            onMouseEnter={e => { if (!sending) { e.currentTarget.style.background = `rgba(255, 0, 13, 0.15)`; } }}
                            onMouseLeave={e => { if (!sending) { e.currentTarget.style.background = `${C.primary}18`; } }}>
                            {sending ? "Sending…" : "Send Campaign"}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

// ── AnalyticsTab ──────────────────────────────────────────────────────────────
function AnalyticsTab() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const campaigns = lsGet("lifeos_email_campaigns") || [];

    const totalSent = campaigns.reduce((s, c) => s + (c.recipients || 0), 0);
    const totalCampaigns = campaigns.length;

    async function fetchBrevoStats() {
        setLoading(true); setError(null);
        try {
            const r = await fetch(`${API_WORKER}/api/email/brevo/stats`);
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            const d = await r.json();
            setStats(d);
        } catch (e) { setError(e.message); }
        finally { setLoading(false); }
    }

    useEffect(() => { fetchBrevoStats(); }, []);

    const metrics = stats ? [
        { label: "Delivered", value: stats.delivered ?? "—", color: C.glow },
        { label: "Open Rate", value: stats.open_rate ? `${Math.round(stats.open_rate * 100)}%` : "—", color: C.primary },
        { label: "Click Rate", value: stats.click_rate ? `${Math.round(stats.click_rate * 100)}%` : "—", color: C.primary },
        { label: "Bounces", value: stats.bounced ?? "—", color: C.primary },
        { label: "Unsubscribes", value: stats.unsubscribed ?? "—", color: C.primary },
        { label: "Spam Reports", value: stats.spam ?? "—", color: C.primary },
    ] : [];

    return (
        <div style={{ flex: 1, overflowY: "auto", padding: 20, background: C.bg }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 16 }}>Email Analytics</div>

            {/* Local totals */}
            <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
                {[
                    { label: "Total Campaigns", value: totalCampaigns, color: C.primary },
                    { label: "Total Sent", value: totalSent, color: C.glow },
                ].map((m, i) => (
                    <div key={i} style={{
                        ...S.card,
                        padding: "14px 18px",
                        minWidth: 130,
                        background: "rgba(29, 29, 30, 0.55)",
                        backdropFilter: "blur(18px) saturate(170%)",
                        WebkitBackdropFilter: "blur(12px) saturate(180%)",
                        border: "0.5px solid rgba(255, 255, 255, 0.08)",
                        borderLeft: "0.5px solid rgba(255, 255, 255, 0.1)",
                        borderTop: "0.5px solid rgba(255, 255, 255, 0.1)",
                        borderRadius: "14px",
                        boxShadow: "0 4px 16px rgba(0,0,0,0.5)"
                    }}>
                        <div style={{ fontSize: 9, color: C.t2, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 4 }}>{m.label}</div>
                        <div style={{ fontSize: 22, fontWeight: 700, color: m.color }}>{m.value}</div>
                    </div>
                ))}
            </div>

            {/* Brevo live stats */}
            <div style={{ fontSize: 12, fontWeight: 700, color: C.t2, marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
                Brevo Campaign Stats
                <button onClick={fetchBrevoStats} style={{
                    fontSize: 11,
                    color: C.primary,
                    background: `hsla(355 100% 50%, 0.08)`,
                    border: `0.5px solid ${C.primaryDark}`,
                    borderRadius: 5,
                    padding: "2px 8px",
                    cursor: "pointer",
                    transition: "all 0.18s ease"
                }}
                    onMouseEnter={e => { e.currentTarget.style.background = `rgba(255, 0, 13, 0.15)`; }}
                    onMouseLeave={e => { e.currentTarget.style.background = `hsla(355 100% 50%, 0.08)`; }}>↻</button>
            </div>

            {loading && <div style={{ fontSize: 12, color: C.t2 }}>Loading Brevo stats…</div>}
            {error && (
                <div style={{
                    padding: "12px 16px",
                    borderRadius: 10,
                    background: `hsla(355 100% 50%, 0.07)`,
                    border: `0.5px solid ${C.primaryDark}`,
                    fontSize: 11,
                    color: C.t2,
                    marginBottom: 16,
                }}>
                    Brevo stats unavailable — check that the Worker has the <code style={{ color: C.primary }}>/api/email/brevo/stats</code> route.
                    <div style={{ fontSize: 10, color: C.t2, marginTop: 4 }}>{error}</div>
                </div>
            )}

            {stats && (
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
                    {metrics.map((m, i) => (
                        <div key={i} style={{
                            ...S.card,
                            padding: "14px 18px",
                            minWidth: 130,
                            background: "rgba(29, 29, 30, 0.55)",
                            backdropFilter: "blur(18px) saturate(170%)",
                            WebkitBackdropFilter: "blur(12px) saturate(180%)",
                            border: "0.5px solid rgba(255, 255, 255, 0.08)",
                            borderLeft: "0.5px solid rgba(255, 255, 255, 0.1)",
                            borderTop: "0.5px solid rgba(255, 255, 255, 0.1)",
                            borderRadius: "14px",
                            boxShadow: "0 4px 16px rgba(0,0,0,0.5)"
                        }}>
                            <div style={{ fontSize: 9, color: C.t2, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 4 }}>{m.label}</div>
                            <div style={{ fontSize: 22, fontWeight: 700, color: m.color }}>{m.value}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* Campaign history */}
            {campaigns.length > 0 && (
                <>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.t2, marginBottom: 10 }}>Campaign History</div>
                    <div>
                        {campaigns.map(c => (
                            <div key={c.id} style={{
                                ...S.card,
                                padding: "12px 16px",
                                marginBottom: 8,
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                background: "rgba(29, 29, 30, 0.55)",
                                backdropFilter: "blur(18px) saturate(170%)",
                                WebkitBackdropFilter: "blur(12px) saturate(180%)",
                                border: "0.5px solid rgba(255, 255, 255, 0.08)",
                                borderLeft: "0.5px solid rgba(255, 255, 255, 0.1)",
                                borderTop: "0.5px solid rgba(255, 255, 255, 0.1)",
                                borderRadius: "14px",
                                boxShadow: "0 4px 16px rgba(0,0,0,0.5)"
                            }}>
                                <div>
                                    <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{c.name}</div>
                                    <div style={{ fontSize: 10, color: C.t2, marginTop: 2 }}>{c.recipients} recipients · {c.service} · {formatTime(c.sentAt)}</div>
                                </div>
                                <div style={{ textAlign: "right" }}>
                                    <div style={{ fontSize: 10, fontWeight: 700, color: C.glow }}>SENT</div>
                                    {c.openRate && <div style={{ fontSize: 10, color: C.primary }}>{c.openRate}% opens</div>}
                                    {c.clickRate && <div style={{ fontSize: 10, color: C.primary }}>{c.clickRate}% clicks</div>}
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

// ── ToolsTab ──────────────────────────────────────────────────────────────────
function ToolsTab() {
    // ── Email verifier ────────────────────────────────────────────────────────
    const [verifyInput, setVerifyInput] = useState("");
    const [verifyResult, setVerifyResult] = useState(null);
    const [verifying, setVerifying] = useState(false);

    async function verifyEmail() {
        const emails = verifyInput.split(/[\n,;]+/).map(e => e.trim()).filter(Boolean);
        if (!emails.length) return;
        setVerifying(true); setVerifyResult(null);
        const results = [];
        for (const email of emails.slice(0, 20)) {
            // Basic format check
            const formatOK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
            // Try Worker verification endpoint
            let status = formatOK ? "format_ok" : "invalid_format";
            let risk = formatOK ? "unknown" : "high";
            try {
                const r = await fetch(`${API_WORKER}/api/email/verify`, {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email }),
                });
                if (r.ok) {
                    const d = await r.json();
                    status = d.status || status;
                    risk = d.risk || risk;
                }
            } catch { /* use format check only */ }
            results.push({ email, status, risk });
        }
        setVerifyResult(results);
        setVerifying(false);
    }

    // ── Warm-up tracker ───────────────────────────────────────────────────────
    const WU_KEY = "lifeos_email_warmup";
    const [warmup, setWarmup] = useState(() => lsGet(WU_KEY) || {
        active: false, day: 0, dailyLimit: 5, totalSent: 0,
        schedule: [5, 10, 20, 30, 50, 75, 100, 150, 200, 300],
        log: [],
    });

    function saveWarmup(w) { setWarmup(w); lsSet(WU_KEY, w); }

    function logWarmupSend(count = 1) {
        const w = { ...warmup };
        w.totalSent += count;
        w.log = [{ date: new Date().toISOString().slice(0, 10), count }, ...w.log].slice(0, 30);
        if (w.totalSent >= w.schedule.slice(0, w.day + 1).reduce((a, b) => a + b, 0)) {
            w.day = Math.min(w.day + 1, w.schedule.length - 1);
            w.dailyLimit = w.schedule[w.day] || w.schedule[w.schedule.length - 1];
        }
        saveWarmup(w);
    }

    // ── Domain health ─────────────────────────────────────────────────────────
    const RECORDS = [
        { type: "SPF", description: "Add to DNS: TXT record on ceogps.com", value: `v=spf1 include:sendgrid.net include:spf.brevo.com ~all` },
        { type: "DKIM", description: "Set up in Brevo/SendGrid dashboard → Senders → Authenticate", value: "Brevo & SendGrid provide DKIM key after sender authentication" },
        { type: "DMARC", description: "Add to DNS: TXT record on _dmarc.ceogps.com", value: `v=DMARC1; p=quarantine; rua=mailto:dmarc@ceogps.com; pct=100` },
        { type: "Subdomain", description: "Recommended: use mail.ceogps.com for bulk sends to protect main domain reputation", value: "Add CNAME mail.ceogps.com → brevo.com or sendgrid.net" },
    ];

    const riskColor = (r) => r === "low" || r === "valid" || r === "format_ok" ? C.glow : r === "unknown" ? C.primary : C.primary;

    return (
        <div style={{ flex: 1, overflowY: "auto", padding: 20, background: C.bg }}>

            {/* Email Verifier */}
            <div style={{
                ...S.card,
                padding: "16px 20px",
                marginBottom: 20,
                background: "rgba(29, 29, 30, 0.55)",
                backdropFilter: "blur(18px) saturate(170%)",
                WebkitBackdropFilter: "blur(12px) saturate(180%)",
                border: "0.5px solid rgba(255, 255, 255, 0.08)",
                borderLeft: "0.5px solid rgba(255, 255, 255, 0.1)",
                borderTop: "0.5px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "14px",
                boxShadow: "0 4px 16px rgba(0,0,0,0.5)"
            }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 4 }}>Email Verification</div>
                <div style={{ fontSize: 11, color: C.t2, marginBottom: 12 }}>Validate addresses before sending — protects deliverability. Up to 20 at once.</div>
                <textarea value={verifyInput} onChange={e => setVerifyInput(e.target.value)}
                    placeholder={"email1@example.com\nemail2@domain.com"}
                    style={{ ...S.input, minHeight: 80, resize: "vertical", lineHeight: 1.5, marginBottom: 8 }} />
                <button onClick={verifyEmail} disabled={verifying || !verifyInput.trim()}
                    style={{
                        ...S.btn(C.glow),
                        width: "100%",
                        fontWeight: 700,
                        transition: "all 0.18s ease"
                    }}
                    onMouseEnter={e => { if (!verifying && verifyInput.trim()) { e.currentTarget.style.background = `rgba(255, 0, 13, 0.15)`; } }}
                    onMouseLeave={e => { if (!verifying && verifyInput.trim()) { e.currentTarget.style.background = `${C.glow}18`; } }}>
                    {verifying ? "Verifying…" : "Verify Emails"}
                </button>
                {verifyResult && (
                    <div style={{ marginTop: 12 }}>
                        {verifyResult.map((r, i) => (
                            <div key={i} style={{
                                display: "flex", justifyContent: "space-between", alignItems: "center",
                                padding: "7px 10px",
                                background: "rgba(255,255,255,0.03)",
                                borderRadius: 6,
                                marginBottom: 4,
                                borderLeft: `2px solid ${riskColor(r.status)}`
                            }}>
                                <span style={{ fontSize: 12, color: C.t2, fontFamily: "monospace" }}>{r.email}</span>
                                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                    <span style={{ fontSize: 10, color: riskColor(r.status), fontWeight: 600, textTransform: "uppercase" }}>{r.status.replace(/_/g, " ")}</span>
                                    <span style={{ fontSize: 9, color: C.t2, background: `${riskColor(r.risk)}18`, padding: "2px 6px", borderRadius: 4 }}>risk: {r.risk}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Email Warm-up */}
            <div style={{
                ...S.card,
                padding: "16px 20px",
                marginBottom: 20,
                background: "rgba(29, 29, 30, 0.55)",
                backdropFilter: "blur(18px) saturate(170%)",
                WebkitBackdropFilter: "blur(12px) saturate(180%)",
                border: "0.5px solid rgba(255, 255, 255, 0.08)",
                borderLeft: "0.5px solid rgba(255, 255, 255, 0.1)",
                borderTop: "0.5px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "14px",
                boxShadow: "0 4px 16px rgba(0,0,0,0.5)"
            }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Email Warm-up</div>
                    <div onClick={() => saveWarmup({ ...warmup, active: !warmup.active })}
                        style={{
                            width: 40, height: 22, borderRadius: 11, cursor: "pointer",
                            background: warmup.active ? C.glow : "rgba(255,255,255,0.1)", transition: "background .2s",
                            display: "flex", alignItems: "center", padding: "0 3px", justifyContent: warmup.active ? "flex-end" : "flex-start",
                            boxShadow: warmup.active ? `0 0 12px rgba(255, 0, 13, 0.3)` : "none"
                        }}>
                        <div style={{ width: 16, height: 16, borderRadius: "50%", background: "hsl(0 0% 100%)" }} />
                    </div>
                </div>
                <div style={{ fontSize: 11, color: C.t2, marginBottom: 14, lineHeight: 1.5 }}>
                    Gradually increase sending volume to build domain reputation and avoid spam filters.
                    Protects <strong style={{ color: C.text }}>ceogps.com</strong> deliverability.
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
                    {[
                        { label: "Status", value: warmup.active ? "ACTIVE" : "PAUSED", color: warmup.active ? C.glow : C.t2 },
                        { label: "Day", value: warmup.day + 1, color: C.primary },
                        { label: "Daily Limit", value: warmup.dailyLimit, color: C.primary },
                        { label: "Total Sent", value: warmup.totalSent, color: C.primary },
                    ].map((m, i) => (
                        <div key={i} style={{
                            ...S.card,
                            padding: "10px 14px",
                            minWidth: 100,
                            background: "rgba(29, 29, 30, 0.55)",
                            backdropFilter: "blur(18px) saturate(170%)",
                            WebkitBackdropFilter: "blur(12px) saturate(180%)",
                            border: "0.5px solid rgba(255, 255, 255, 0.08)",
                            borderLeft: "0.5px solid rgba(255, 255, 255, 0.1)",
                            borderTop: "0.5px solid rgba(255, 255, 255, 0.1)",
                            borderRadius: "14px",
                            boxShadow: "0 4px 16px rgba(0,0,0,0.5)"
                        }}>
                            <div style={{ fontSize: 9, color: C.t2, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 3 }}>{m.label}</div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: m.color }}>{m.value}</div>
                        </div>
                    ))}
                </div>

                {/* Schedule visualization */}
                <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 10, color: C.t2, marginBottom: 6 }}>WARM-UP SCHEDULE (emails/day)</div>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {warmup.schedule.map((limit, day) => (
                            <div key={day} style={{
                                padding: "4px 8px", borderRadius: 5, fontSize: 10,
                                background: day === warmup.day ? `hsla(355 100% 50%, 0.2)` : "rgba(255,255,255,0.05)",
                                border: `0.5px solid ${day === warmup.day ? C.glow : "rgba(255,255,255,0.08)"}`,
                                color: day === warmup.day ? C.glow : day < warmup.day ? C.t2 : C.t2,
                                boxShadow: day === warmup.day ? `0 0 8px rgba(255, 0, 13, 0.15)` : "none"
                            }}>
                                D{day + 1}: {limit}
                            </div>
                        ))}
                    </div>
                </div>

                <button onClick={() => logWarmupSend(1)} disabled={!warmup.active}
                    style={{
                        ...S.btn(warmup.active ? C.glow : C.t2),
                        opacity: warmup.active ? 1 : 0.5,
                        transition: "all 0.18s ease"
                    }}
                    onMouseEnter={e => { if (warmup.active) { e.currentTarget.style.background = `rgba(255, 0, 13, 0.15)`; } }}
                    onMouseLeave={e => { if (warmup.active) { e.currentTarget.style.background = `${C.glow}18`; } }}>
                    + Log a Warm-up Send
                </button>

                {warmup.log.length > 0 && (
                    <div style={{ marginTop: 12 }}>
                        <div style={{ fontSize: 10, color: C.t2, marginBottom: 6 }}>RECENT SENDS</div>
                        {warmup.log.slice(0, 5).map((l, i) => (
                            <div key={i} style={{
                                fontSize: 11,
                                color: C.t2,
                                marginBottom: 3,
                                padding: "4px 8px",
                                background: "rgba(255,255,255,0.02)",
                                borderRadius: 4,
                                borderLeft: `2px solid ${C.primaryDark}`
                            }}>{l.date} — {l.count} emails</div>
                        ))}
                    </div>
                )}
            </div>

            {/* Domain Protection */}
            <div style={{
                ...S.card,
                padding: "16px 20px",
                background: "rgba(29, 29, 30, 0.55)",
                backdropFilter: "blur(18px) saturate(170%)",
                WebkitBackdropFilter: "blur(12px) saturate(180%)",
                border: "0.5px solid rgba(255, 255, 255, 0.08)",
                borderLeft: "0.5px solid rgba(255, 255, 255, 0.1)",
                borderTop: "0.5px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "14px",
                boxShadow: "0 4px 16px rgba(0,0,0,0.5)"
            }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 4 }}>Domain Protection — {SENDER_DOMAIN}</div>
                <div style={{ fontSize: 11, color: C.t2, marginBottom: 14, lineHeight: 1.5 }}>
                    DNS records required to authenticate email and protect deliverability.
                </div>
                {RECORDS.map((r, i) => (
                    <div key={i} style={{
                        marginBottom: 12, padding: "12px 14px",
                        background: "rgba(255,255,255,0.03)",
                        borderRadius: 8,
                        border: `0.5px solid ${C.primaryDark}`
                    }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                            <span style={{
                                fontSize: 10, fontWeight: 700, color: C.primary,
                                background: `hsla(355 100% 50%, 0.12)`,
                                padding: "2px 7px", borderRadius: 4,
                                border: `0.5px solid ${C.primaryDark}`
                            }}>{r.type}</span>
                            <span style={{ fontSize: 11, color: C.t2 }}>{r.description}</span>
                        </div>
                        <code style={{
                            fontSize: 10, color: C.glow, display: "block", wordBreak: "break-all",
                            lineHeight: 1.5, background: `hsla(355 100% 50%, 0.05)`,
                            padding: "6px 10px", borderRadius: 5,
                            border: `0.5px solid ${C.primaryDark}`
                        }}>
                            {r.value}
                        </code>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── Main EmailPanel ───────────────────────────────────────────────────────────
export default function EmailPanel() {
    const [tab, setTab] = useState("inbox");
    const [accounts, setAccounts] = useState([]);

    const loadAccounts = useCallback(async () => {
        const [gmailRes, nylasRes] = await Promise.all([
            fetch(`${AUTH_WORKER}/api/email/accounts`).catch(() => null),
            fetch(`${AUTH_WORKER}/api/nylas/accounts`).catch(() => null),
        ]);
        const gmailAccts = gmailRes?.ok ? ((await gmailRes.json().catch(() => ({}))).accounts || []) : [];
        const nylasRaw = nylasRes?.ok ? (await nylasRes.json().catch(() => [])) : [];
        const nylasAccts = (Array.isArray(nylasRaw) ? nylasRaw : []).map(a => ({ ...a, provider: "nylas", can_read: true, can_send: true }));
        const all = [...gmailAccts, ...nylasAccts];
        setAccounts(all);
        return all;
    }, []);

    useEffect(() => { loadAccounts(); }, [loadAccounts]);

    return (
        <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 52px)", overflow: "hidden", background: C.bg }}>

            {/* Tab bar */}
            <div style={{
                display: "flex",
                borderBottom: `0.5px solid ${C.border}`,
                flexShrink: 0,
                background: C.card,
            }}>
                {PANEL_TABS.map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)}
                        style={{
                            flex: 1, padding: "10px 0", border: "none", cursor: "pointer", fontSize: 11, fontWeight: tab === t.id ? 700 : 400,
                            background: tab === t.id ? `hsla(355 100% 50%, 0.1)` : "transparent",
                            color: tab === t.id ? C.primary : C.t2,
                            borderBottom: tab === t.id ? `2px solid ${C.primary}` : "2px solid transparent",
                            transition: "all .15s"
                        }}>
                        {t.icon} {t.label}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
                {tab === "inbox" && <InboxTab accounts={accounts} loadAccounts={loadAccounts} />}
                {tab === "campaigns" && <CampaignsTab />}
                {tab === "analytics" && <AnalyticsTab />}
                {tab === "tools" && <ToolsTab />}
            </div>
        </div>
    );
}