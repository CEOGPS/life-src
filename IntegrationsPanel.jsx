import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getPreferredModel, setPreferredModel, MODEL_OPTIONS, generatePKCE } from "../../../api/ceogpsclient.jsx";
import { useAuth } from "@/lib/FirebaseAuthContext";

const C = {
  blue: "#4ab3f4",
  orange: "#ff8c42",
  teal: "#00c896",
  purple: "#8b7fff",
  pink: "#ff6b9d",
  red: "#ff4f5e"
};

const card = {
  background: "#13141f",
  border: "0.5px solid rgba(255,255,255,0.07)",
  borderRadius: 12
};

const WORKER_URL = import.meta.env.VITE_WORKER_URL || "https://oauth.ceogps.com";
const SLOT_COLORS = ["#4ab3f4", "#00c896", "#ff8c42", "#8b7fff", "#ff6b9d", "#f7b731", "#1da1f2", "#ef5350", "#26c6da", "#39d353"];

// ── Storage ───────────────────────────────────────────────────────────────────
// lifeos1_accounts_v3: { [integrationName]: { [email]: { username, password, apiKey, status, label, color, icon } } }
const AK = "lifeos1_accounts_v3";

function loadAccounts() {
  try {
    return JSON.parse(localStorage.getItem(AK) || "{}");
  } catch {
    return {};
  }
}

function saveAccounts(a) {
  try {
    localStorage.setItem(AK, JSON.stringify(a));
  } catch {}
}

// ── Account helpers ───────────────────────────────────────────────────────────
function getAccountEntries(accounts, name) {
  const main = Object.entries(accounts[name] || {})
    .filter(([k]) => k !== "_extras")
    .map(([email, slot]) => ({ email, slot }));

  // Migrate legacy _extras into view (without modifying storage)
  const extras = (accounts[name] || {})._extras || [];
  extras.forEach(({ email, key }) => {
    if (!main.find(e => e.email === email)) {
      main.push({
        email,
        slot: {
          username: email,
          password: "",
          apiKey: key || "",
          status: key ? "on" : "off",
          label: email.split("@")[0],
          icon: "📧",
          color: "#6aaedd"
        }
      });
    }
  });
  return main;
}

function nextColor(accountsForItem) {
  const used = new Set(Object.values(accountsForItem || {}).map(s => s && s.color).filter(Boolean));
  return SLOT_COLORS.find(c => !used.has(c)) || SLOT_COLORS[0];
}

// ── Worker helpers ────────────────────────────────────────────────────────────
const VALIDATOR_PROVIDER = {
  "Claude API": "claude",
  "OpenAI GPT": "openai",
  "Gemini": "gemini",
  "Grok (xAI)": "grok",
  "Groq": "groq",
  "DeepSeek": "deepseek",
  "Perplexity": "perplexity",
  "CoPilot": "copilot",
  "Qwen (Ali.)": "qwen",
  "Mistral": "mistral",
  "Cohere": "cohere",
  "Together AI": "together",
  "Fireworks AI": "fireworks",
  "Replicate": "replicate",
  "Runway": "runway",
  "ElevenLabs": "elevenlabs",
  "Hugging Face": "huggingface",
  "OpenRouter": "openrouter",
  "Anyscale": "anyscale",
  "Lepton AI": "lepton",
  "NovitaAI": "novita",
  "AI21 Labs": "ai21",
  "Brevo": "brevo",
  "SendGrid": "sendgrid",
  "Mailchimp": "mailchimp",
  "Nylas": "nylas",
  "Stripe": "stripe",
  "Cloudflare": "cloudflare"
};

async function storeKeyOnWorker(name, email, key, firebaseUserOrToken) {
  const provider = VALIDATOR_PROVIDER[name] || name.toLowerCase().replace(/\W+/g, "_");
  const perAccount = provider + "_" + email.split("@")[0].replace(/\W+/g, "_");
  
  let idToken = "";
  if (typeof firebaseUserOrToken === "string") {
    idToken = firebaseUserOrToken;
  } else if (firebaseUserOrToken) {
    try { idToken = await firebaseUserOrToken.getIdToken(); } catch {}
  }

  const store = async (svc) => { 
    try { 
      await fetch(`${WORKER_URL}/api/keys/store`, { 
        method: "POST", 
        headers: { 
          "Content-Type": "application/json",
          ...(idToken && { "Authorization": `Bearer ${idToken}` })
        }, 
        body: JSON.stringify({ service: svc, key }), 
      }); 
    } catch {} 
  }; 
  
  await store(provider); 
  await store(perAccount); 
  
  try { 
    const local = JSON.parse(localStorage?.getItem?.("lifeos1_keys_v2") || "{}"); 
    local[name] = key; 
    localStorage?.setItem?.("lifeos1_keys_v2", JSON.stringify(local)); 
  } catch {} 
} 

async function validateKeyOnWorker(name, key, firebaseUserOrToken) { 
  const provider = VALIDATOR_PROVIDER[name]; 
  if (!provider) return { valid: true }; 
  
  let idToken = "";
  if (typeof firebaseUserOrToken === "string") {
    idToken = firebaseUserOrToken;
  } else if (firebaseUserOrToken) {
    try { idToken = await firebaseUserOrToken.getIdToken(); } catch {}
  }

  try { 
    const r = await fetch(`${WORKER_URL}/api/validate-key`, { 
      method: "POST", 
      headers: { 
        "Content-Type": "application/json",
        ...(idToken && { "Authorization": `Bearer ${idToken}` })
      }, 
      body: JSON.stringify({ provider, key }), 
    }); 
    if (!r.ok) return { valid: false, detail: `Worker ${r.status}` }; 
    return await r.json(); 
  } catch (e) { 
    return { valid: false, detail: e.message }; 
  } 
} 

// ── OAuth ─────────────────────────────────────────────────────────────────────
const OAUTH_PROVIDER = { 
  "Gmail": { provider: "google", scope: "gmail" }, 
  "Google Cal.": { provider: "google", scope: "calendar" }, 
  "YouTube": { provider: "google", scope: "youtube" }, 
  "Outlook": { provider: "microsoft", scope: "mail" }, 
  "GitHub": { provider: "github" }, 
  "Slack": { provider: "slack" }, 
  "LinkedIn": { provider: "linkedin" }, 
  "Facebook": { provider: "facebook" }, 
  "Instagram": { provider: "instagram" }, 
  "TikTok": { provider: "tiktok" }, 
  "X (Twitter)": { provider: "twitter" }, 
  "Zoom": { provider: "zoom" }, 
  "ClickUp": { provider: "clickup" }, 
  "Airtable": { provider: "airtable" }, 
  "Calendly": { provider: "calendly" }, 
  "Yahoo Mail": { provider: "yahoo" }, 
  "AOL Mail": { provider: "aol" } 
}; 

const PROVIDER_MAP = { 
  "Gmail": "google", "Google Cal.": "google", "YouTube": "google",
  "Outlook": "microsoft", "GitHub": "github", "Slack": "slack",
  "LinkedIn": "linkedin", "Facebook": "facebook", "Instagram": "instagram",
  "TikTok": "tiktok", "X (Twitter)": "twitter", "Zoom": "zoom",
  "ClickUp": "clickup", "Airtable": "airtable", "Calendly": "calendly" 
};

function useOAuthStatus(firebaseUser) { 
  const queryClient = useQueryClient(); 
  
  const { data = { accounts: [], kv: {} } } = useQuery({ 
    queryKey: ["oauth-status"], 
    queryFn: async () => { 
      let idToken = "";
      if (firebaseUser) {
        try { idToken = await firebaseUser.getIdToken(); } catch {}
      }

      const headers = idToken ? { "Authorization": `Bearer ${idToken}` } : {};

      const [sRes, kRes] = await Promise.all([ 
        fetch(`${WORKER_URL}/api/oauth/status`, { headers }).catch(() => null), 
        fetch(`${WORKER_URL}/api/oauth/status/all`, { headers }).catch(() => null) 
      ]); 
      const accounts = sRes && sRes.ok ? ((await sRes.json().catch(() => ({}))).connected || []) : []; 
      const kv = kRes && kRes.ok ? (await kRes.json().catch(() => ({}))) : {}; 
      return { accounts, kv }; 
    }, 
    refetchInterval: 30000, 
    refetchOnWindowFocus: false, 
    retry: 1,
    staleTime: 15000 
  }); 

  const connectedAccounts = data.accounts || []; 
  const [verified, setVerified] = useState({}); 

  // Verify live status for connected accounts by attempting a real data pull.
  // This prevents "says connected/active but not actually working" (stale tokens, expired, no data).
  // Only mark as truly connected if test data fetch succeeds.
  // For all OAuth, we require explicit testOk === true (no optimism on hard refresh).
  useEffect(() => {
    if (!connectedAccounts.length) return;
    const toVerify = connectedAccounts.filter(a => a.platform);
    toVerify.forEach(async (acc) => {
      const prov = acc.platform;
      let testOk = false;
      try {
        let headers = {};
        if (firebaseUser) {
          try {
            const idToken = await firebaseUser.getIdToken();
            if (idToken) headers = { "Authorization": `Bearer ${idToken}` };
          } catch {}
        }
        const SOCIAL_PROVS = ['facebook', 'instagram', 'linkedin', 'x', 'twitter', 'google', 'youtube'];
        if (SOCIAL_PROVS.includes(prov)) {
          // Use per-user verify endpoint that exercises the *user's specific OAuth token* server-side.
          // This is the key to saying "Inactive" if the actual OAuth for this user is not live/valid.
          const vRes = await fetch(`${WORKER_URL}/api/oauth/verify?provider=${prov}`, { headers }).catch(() => null);
          if (vRes && vRes.ok) {
            const vd = await vRes.json().catch(() => ({}));
            testOk = !!vd.ok;
          }
        } else {
          let testUrl = '';
          if (prov === 'google' || prov === 'youtube') {
            testUrl = `${WORKER_URL}/api/youtube/videos?max=1`;
          } else if (prov === 'x' || prov === 'twitter') {
            testUrl = `${WORKER_URL}/api/x/timeline?max=1`;
          } else if (prov === 'facebook' || prov === 'instagram') {
            testUrl = `${WORKER_URL}/api/meta/feed?limit=1`;
          } else if (prov === 'linkedin') {
            testUrl = `${WORKER_URL}/api/linkedin/status`;
          } else {
            testOk = false;
          }
          if (testUrl) {
            const r = await fetch(testUrl, { headers }).catch(() => null);
            if (r && r.ok) {
              const d = await r.json().catch(() => ({}));
              testOk = !!(d.items?.length || d.tweets?.length || d.data?.length || d.connected);
            }
          }
        }
      } catch (e) {
        testOk = false;
      }
      setVerified(prev => {
        const next = { ...prev, [prov]: testOk };
        // Normalize common aliases so isConnected lookups by google/youtube or x/twitter succeed
        if (prov === 'google' || prov === 'youtube') {
          next.google = testOk;
          next.youtube = testOk;
        }
        if (prov === 'x' || prov === 'twitter') {
          next.x = testOk;
          next.twitter = testOk;
        }
        return next;
      });
    });
  }, [connectedAccounts, firebaseUser]);

  const isConnected = (name) => { 
    const provider = PROVIDER_MAP[name]; 
    if (!provider) return false; 
    const serverConnected = connectedAccounts.some(a => a.platform === provider) || !!(data.kv && data.kv[provider] && data.kv[provider].connected);
    if (!serverConnected) return false;
    // For *all* OAuth providers we now require an explicit successful live verification (testOk === true)
    // before claiming "connected". This ensures hard refresh starts as Inactive and only becomes
    // Active when the data test actually succeeds. No optimistic "while checking".
    const v = verified[provider] ?? verified[provider === 'google' ? 'youtube' : provider === 'youtube' ? 'google' : provider]
                 ?? verified[provider === 'x' ? 'twitter' : provider === 'twitter' ? 'x' : provider];
    return !!v; // must be explicitly true from a passing data test
  }; 
  const refreshStatus = () => {
    setVerified({});
    queryClient.invalidateQueries({ queryKey: ["oauth-status"] });
  }; 

  return { isConnected, connectedAccounts, refreshStatus }; 
} 

async function startOAuthFlow(name, firebaseUser) { 
  const cfg = OAUTH_PROVIDER[name]; 
  if (!cfg) return; 
  const uid = firebaseUser?.id || firebaseUser?.uid || "unknown"; 
  const width = 600, height = 700; 
  const left = window.screenX + (window.outerWidth - width) / 2; 
  const top = window.screenY + (window.outerHeight - height) / 2; 

  // Use PKCE for secure OAuth2 in public client (SPA) - no client secret or manual API keys needed
  const { verifier, challenge, method } = await generatePKCE();
  const state = `${uid}:${Date.now()}`;
  sessionStorage.setItem(`pkce_verifier_${state}`, verifier);
  sessionStorage.setItem(`pkce_state`, state);

  const u = new URL(`${WORKER_URL}/api/oauth/start`); 
  u.searchParams.set("provider", cfg.provider); 
  if (cfg.scope) u.searchParams.set("scope", cfg.scope); 
  u.searchParams.set("user_id", uid); 
  u.searchParams.set("force", "1"); 
  u.searchParams.set("code_challenge", challenge);
  u.searchParams.set("code_challenge_method", method);
  u.searchParams.set("state", state);
  window.open(u.toString(), `oauth-${cfg.provider}`, `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`); 
} 

async function disconnectOAuth(provider, accountEmail, refreshStatus, firebaseUser) { 
  if (!firebaseUser) return; 
  const uid = firebaseUser.id || firebaseUser.uid || "unknown";
  
  let idToken = "";
  try { idToken = await firebaseUser.getIdToken(); } catch {}

  const u = new URL(`${WORKER_URL}/api/oauth/disconnect`); 
  u.searchParams.set("provider", provider); 
  u.searchParams.set("user_id", uid); 
  u.searchParams.set("account_email", accountEmail || ""); 
  
  await fetch(u.toString(), { 
    method: "POST",
    headers: idToken ? { "Authorization": `Bearer ${idToken}` } : {}
  }); 
  if (refreshStatus) refreshStatus(); 
} 

const API_KEY_SERVICES = new Set([ 
  "Claude API", "OpenAI GPT", "Grok (xAI)", "Gemini", "DeepSeek", "Groq", "Perplexity", 
  "Qwen (Ali.)", "Mistral", "Cohere", "Together AI", "Fireworks AI", "Replicate", 
  "Hugging Face", "OpenRouter", "Anyscale", "Lepton AI", "NovitaAI", "AI21 Labs", "CoPilot", 
  "Runway", "ElevenLabs", "Nylas", "Brevo", "SendGrid", "Twilio SMS", "WhatsApp", "Mailchimp", 
  "Brilliant Dir.", "AWS", "Supabase", "ClickUp API", "Stripe", "Cloudflare" 
]); 

const EMAIL_PROVIDERS = new Set([ 
  "Gmail", "Outlook", "Brevo", "SendGrid", "Mailchimp", "Twilio SMS", "WhatsApp" 
]); 

const FREE_INTEGRATIONS = new Set(["Workers AI"]);

const INTEGRATIONS = { 
  "AI Models": [ 
    { icon: "🤍", name: "Claude API", sub: "Sonnet 4 · Opus 4 · Haiku", color: C.teal }, 
    { icon: "🔷", name: "OpenAI GPT", sub: "GPT-4o · o1 · o3", color: C.blue }, 
    { icon: "✦", name: "Grok (xAI)", sub: "Grok-3 · web search", color: "#1DA1F2" }, 
    { icon: "💎", name: "Gemini", sub: "2.0 Flash · 1.5 Pro", color: C.orange }, 
    { icon: "⚡", name: "Groq", sub: "Llama-3.3-70B · ultra-fast", color: C.purple }, 
    { icon: "🌊", name: "DeepSeek", sub: "R1 · V3 · reasoning", color: "#4fc3f7" }, 
    { icon: "🔍", name: "Perplexity", sub: "Sonar · web-grounded AI", color: "#6aaedd" }, 
    { icon: "🌬", name: "Mistral", sub: "Mistral-Small · Mixtral", color: "#f7b731" }, 
    { icon: "🎯", name: "Cohere", sub: "Command R+ · RAG specialist", color: "#39d353" }, 
    { icon: "🔗", name: "Together AI", sub: "80+ open models", color: "#7c4dff" }, 
    { icon: "🔥", name: "Fireworks AI", sub: "Fast inference", color: "#ff5722" }, 
    { icon: "🔄", name: "Replicate", sub: "SDXL · LLaMA · thousands", color: "#1565c0" }, 
    { icon: "🎬", name: "Runway", sub: "Gen-3 · video generation", color: "#00c2ff" }, 
    { icon: "🔊", name: "ElevenLabs", sub: "TTS · voice cloning · audio", color: "#f5a623" }, 
    { icon: "🤗", name: "Hugging Face", sub: "Inference API · any model", color: "#ffca28" }, 
    { icon: "🛣", name: "OpenRouter", sub: "200+ models · single key", color: "#00897b" }, 
    { icon: "🌐", name: "Anyscale", sub: "Llama · Mistral · fast", color: "#5c6bc0" }, 
    { icon: "⚛", name: "Lepton AI", sub: "Open source · fast", color: "#26c6da" }, 
    { icon: "✨", name: "NovitaAI", sub: "80+ models · image + text", color: "#ab47bc" }, 
    { icon: "📝", name: "AI21 Labs", sub: "Jamba · Jurassic", color: "#ef5350" }, 
    { icon: "🪟", name: "CoPilot", sub: "GitHub Copilot · GPT-4o", color: "#0078d4" }, 
    { icon: "☁", name: "Workers AI", sub: "Llama 3.3-70B · FREE always", color: "#ff6633" }, 
  ], 
  "Social Media": [ 
    { icon: "📘", name: "Facebook", sub: "Pages & ads", color: "#1877f2" }, 
    { icon: "📸", name: "Instagram", sub: "Creator accounts", color: "#e1306c" }, 
    { icon: "💼", name: "LinkedIn", sub: "Company + Personal", color: "#0a66c2" }, 
    { icon: "🎵", name: "TikTok", sub: "Multi-account", color: "#69c9d0" }, 
    { icon: "🐦", name: "X (Twitter)", sub: "Multi-account", color: "#1da1f2" }, 
    { icon: "▶", name: "YouTube", sub: "Channel management", color: "#ff0000" }, 
  ], 
  "Email & Comms": [ 
    { icon: "📬", name: "Gmail", sub: "Google OAuth", color: "#ea4335" }, 
    { icon: "📮", name: "Outlook", sub: "Microsoft OAuth", color: "#0078d4" }, 
    { icon: "💜", name: "Yahoo Mail", sub: "Yahoo OAuth", color: "#6001d2" }, 
    { icon: "🔴", name: "AOL Mail", sub: "AOL OAuth", color: "#ff0b00" }, 
    { icon: "🔐", name: "Proton Mail", sub: "IMAP via Bridge", color: "#6d4aff" }, 
    { icon: "🟠", name: "Hostinger", sub: "IMAP / app password", color: "#ff6a00" }, 
    { icon: "🍎", name: "Nylas", sub: "iCloud · IMAP · any inbox", color: "#6c47ff" }, 
    { icon: "📧", name: "Brevo", sub: "Transactional email", color: C.orange }, 
    { icon: "📨", name: "SendGrid", sub: "Bulk email", color: C.blue }, 
    { icon: "📅", name: "Mailchimp", sub: "Email campaigns", color: C.orange }, 
    { icon: "💬", name: "Slack", sub: "Team workspace", color: "#4a154b" }, 
    { icon: "📞", name: "Zoom", sub: "Video meetings", color: C.blue }, 
    { icon: "📱", name: "Twilio SMS", sub: "SMS automation", color: C.red }, 
    { icon: "💬", name: "WhatsApp", sub: "Business API", color: "#25d366" }, 
  ], 
  "Business Tools": [ 
    { icon: "📋", name: "ClickUp", sub: "Project management", color: "#7b68ee" }, 
    { icon: "🗓", name: "Google Cal.", sub: "Calendar sync", color: "#4285f4" }, 
    { icon: "📅", name: "Calendly", sub: "Scheduling", color: C.blue }, 
    { icon: "💳", name: "Stripe", sub: "Payments · live data", color: "#635bff" }, 
    { icon: "📊", name: "Airtable", sub: "Database & CRM", color: "#f82b60" }, 
    { icon: "💰", name: "QuickBooks", sub: "Accounting", color: "#2ca01c" }, 
    { icon: "🔄", name: "Make.com", sub: "Automation flows", color: C.purple }, 
    { icon: "📁", name: "Brilliant Dir.", sub: "Member directory", color: C.orange }, 
    { icon: "📂", name: "GitHub", sub: "Code repos", color: "#f0ede8" }, 
  ], 
  "Infrastructure": [ 
    { icon: "☁", name: "Cloudflare", sub: "Workers · Pages · Analytics", color: "#ff6633" }, 
    { icon: "🗄", name: "Supabase", sub: "DB · Auth · Realtime", color: "#3ecf8e" }, 
    { icon: "🟠", name: "AWS", sub: "S3 · Lambda", color: C.orange }, 
    { icon: "🟢", name: "Google Cloud", sub: "gcloud CLI", color: C.teal }, 
  ], 
}; 

// ── Model Switcher ──────────────────────────────────────────────────────────── 
function ModelSwitcherBar() { 
  const [preferred, setPreferred] = useState(() => getPreferredModel()); 
  
  function pick(id) { 
    setPreferred(id); 
    setPreferredModel(id); 
  } 
  
  return ( 
    <div style={{ marginBottom: 16, padding: 14, borderRadius: 10, background: "rgba(0,200,150,0.05)", border: "0.5px solid rgba(0,200,150,0.2)" }}> 
      <div style={{ fontSize: 10, fontWeight: 700, color: "#00c896", letterSpacing: ".08em", marginBottom: 10 }}> 
        ✦ ACTIVE AI MODEL — auto-switches when credits run out 
      </div> 
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}> 
        {MODEL_OPTIONS.map(opt => { 
          const active = preferred === opt.id; 
          return ( 
            <button key={opt.id} onClick={() => pick(opt.id)} style={{ padding: "5px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: "pointer", background: active ? "rgba(0,200,150,0.2)" : "rgba(255,255,255,0.04)", border: active ? "0.5px solid rgba(0,200,150,0.5)" : "0.5px solid rgba(255,255,255,0.1)", color: active ? "#00c896" : "#6aaedd", transition: "all .15s" }}>
              {opt.icon} {opt.label}
            </button> 
          ); 
        })} 
      </div> 
    </div> 
  ); 
} 

// ── Add Account Form ──────────────────────────────────────────────────────────
function AddAccountForm({ itemName, existingAccounts, onAdd, onCancel }) {
  const [identifier, setIdentifier] = useState("");
  const [label, setLabel] = useState("");
  const isOAuth = !!OAUTH_PROVIDER[itemName];
  
  function handleAdd() {
    const id = identifier.trim();
    if (!id) return;
    const lbl = label.trim() || id.split("@")[0] || id;
    const color = nextColor(existingAccounts);
    onAdd({ email: id, label: lbl, color, icon: "👤" });
  }
  
  const inp = { width: "100%", padding: "7px 10px", borderRadius: 6, border: "0.5px solid rgba(255,255,255,0.12)", background: "#0d0e17", color: "#f0ede8", fontSize: 11, outline: "none", boxSizing: "border-box" };
  
  return (
    <div style={{ padding: "10px 14px 12px", borderTop: "0.5px solid rgba(255,255,255,0.06)", background: "rgba(0,0,0,0.22)" }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: "#6aaedd", letterSpacing: ".1em", marginBottom: 8 }}>ADD ACCOUNT</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        <input value={identifier} onChange={e => setIdentifier(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAdd()} placeholder={isOAuth ? "email@example.com (used as OAuth hint)" : "email, username, or any identifier"} style={inp} autoFocus />
        <input value={label} onChange={e => setLabel(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAdd()} placeholder="Label — e.g. Work, Personal, Business (optional)" style={inp} />
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={handleAdd} style={{ flex: 1, padding: "7px", borderRadius: 6, background: "rgba(0,200,150,0.15)", border: "0.5px solid #00c896", color: "#00c896", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>+ Add Account</button>
          <button onClick={onCancel} style={{ padding: "7px 12px", borderRadius: 6, background: "transparent", border: "0.5px solid rgba(255,255,255,0.1)", color: "#6aaedd", fontSize: 11, cursor: "pointer" }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Credential Form ───────────────────────────────────────────────────────────
function RowWithDelete({ children, onDelete }) {
  const [confirm, setConfirm] = useState(false);
  
  return (
    <div style={{ display: "flex", alignItems: "stretch", position: "relative", borderBottom: "0.5px solid rgba(255,255,255,0.03)" }}>
      {children}
      {confirm ? (
        <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "0 8px", flexShrink: 0, background: "rgba(255,79,94,0.08)" }}>
          <button onClick={() => { onDelete(); setConfirm(false); }} style={{ padding: "3px 8px", borderRadius: 5, background: "rgba(255,79,94,0.25)", border: "0.5px solid rgba(255,79,94,0.6)", color: "#ff4f5e", fontSize: 9, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>✕ Delete</button>
          <button onClick={() => setConfirm(false)} style={{ padding: "3px 6px", borderRadius: 5, background: "transparent", border: "0.5px solid rgba(255,255,255,0.1)", color: "#555", fontSize: 9, cursor: "pointer" }}>Cancel</button>
        </div>
      ) : (
        <button onClick={e => { e.stopPropagation(); setConfirm(true); }} title="Delete entry" style={{ padding: "0 10px", background: "transparent", border: "none", borderLeft: "0.5px solid rgba(255,255,255,0.04)", color: "#333", fontSize: 12, cursor: "pointer", flexShrink: 0 }}>🗑</button>
      )}
    </div>
  );
}

function CredentialForm({ name, email, label, icon, color, slot, onSave, onRemove, onDelete, onClose, isOAuth, globalIsConnected, itemName, firebaseIdToken }) {
  const [username, setUsername] = useState(slot.username || "");
  const [password, setPassword] = useState(slot.password || "");
  const [apiKey, setApiKey] = useState(slot.apiKey || "");
  const [editLabel, setEditLabel] = useState(slot.label || label || "");
  const [editEmail, setEditEmail] = useState(email || "");
  const [saving, setSaving] = useState(false);
  const [validMsg, setValidMsg] = useState(null);
  const [showPass, setShowPass] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const { user } = useAuth(); // Gather target firebase profiles
  const isNylas = name === "Nylas";
  const isStripe = name === "Stripe";
  const isCF = name === "Cloudflare";
  const isApiOnly = API_KEY_SERVICES.has(name) && !isNylas;
  
  async function handleSave() {
    setSaving(true);
    setValidMsg(null);
    if (apiKey && VALIDATOR_PROVIDER[name] && !isStripe && !isCF) {
      const r = await validateKeyOnWorker(name, apiKey, firebaseIdToken);
      if (!r.valid) {
        setValidMsg({ ok: false, msg: r.detail || "Key validation failed" });
        setSaving(false);
        return;
      }
      setValidMsg({ ok: true, msg: "Key validated ✓" });
    }
    await onSave({ username, password, apiKey, label: editLabel, email: editEmail });
    setSaving(false);
  }

  const inp = { width: "100%", padding: "8px 10px", borderRadius: 7, border: "0.5px solid rgba(255,255,255,0.12)", background: "#0d0e17", color: "#f0ede8", fontSize: 12, outline: "none", boxSizing: "border-box", fontFamily: "monospace" };
  const lbl = { display: "block", fontSize: 9, fontWeight: 700, color: "#6aaedd", letterSpacing: ".09em", marginBottom: 5 };

  return (
    <div style={{ padding: "12px 14px 14px", borderTop: "0.5px solid rgba(255,255,255,0.06)", background: "rgba(0,0,0,0.18)" }}>
      {/* Account badge */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 13 }}>{icon || "👤"}</span>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: color || "#6aaedd" }}>{label || email}</div>
          <div style={{ fontSize: 9, color: "#555" }}>{email}</div>
        </div>
        {(() => {
          const oauthActive = !isOAuth || (globalIsConnected && itemName && globalIsConnected(itemName));
          return (
            <>
              {slot.status === "on" && oauthActive && (
                <span style={{ marginLeft: "auto", fontSize: 9, color: C.teal, fontWeight: 700, background: "rgba(0,200,150,0.1)", padding: "2px 8px", borderRadius: 10 }}>● Connected</span>
              )}
              {isOAuth && globalIsConnected && itemName && !globalIsConnected(itemName) && slot.status === "on" && (
                <span style={{ marginLeft: "auto", fontSize: 9, color: "#888", fontWeight: 700, background: "rgba(255,255,255,0.06)", padding: "2px 8px", borderRadius: 10 }}>● Inactive</span>
              )}
            </>
          );
        })()}
      </div>

      {/* Hints */}
      {isNylas && (
        <div style={{ fontSize: 10, color: "#6aaedd", background: "rgba(108,71,255,0.08)", border: "0.5px solid rgba(108,71,255,0.25)", borderRadius: 7, padding: "8px 10px", marginBottom: 10, lineHeight: 1.5 }}>
          1. Sign up at <b style={{ color: "#a78bfa" }}>nylas.com</b><br />
          2. Create an app → copy the <b style={{ color: "#a78bfa" }}>API Key</b><br />
          3. Connect your iCloud/Gmail → copy the <b style={{ color: "#a78bfa" }}>Grant ID</b>
        </div>
      )}
      {isStripe && (
        <div style={{ fontSize: 10, color: "#6aaedd", background: "rgba(99,91,255,0.08)", border: "0.5px solid rgba(99,91,255,0.25)", borderRadius: 7, padding: "8px 10px", marginBottom: 10, lineHeight: 1.5 }}>
          Enter your <b style={{ color: "#a78bfa" }}>Secret Key</b> (sk_live_... or sk_test_...) to pull live balance & charges.
        </div>
      )}
      {isCF && (
        <div style={{ fontSize: 10, color: "#6aaedd", background: "rgba(255,102,51,0.08)", border: "0.5px solid rgba(255,102,51,0.25)", borderRadius: 7, padding: "8px 10px", marginBottom: 10, lineHeight: 1.5 }}>
          Enter a Cloudflare <b style={{ color: "#ff8c42" }}>API Token</b> with Zone Analytics Read permission to pull data.
        </div>
      )}

      {/* Label editor */}
      <div style={{ marginBottom: 10 }}>
        <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "#6aaedd", letterSpacing: ".09em", marginBottom: 5 }}>ACCOUNT LABEL</label>
        <input value={editLabel} onChange={e => setEditLabel(e.target.value)} placeholder="My label..." style={{ width: "100%", padding: "7px 10px", borderRadius: 7, border: "0.5px solid rgba(255,255,255,0.12)", background: "#0d0e17", color: "#f0ede8", fontSize: 12, outline: "none", boxSizing: "border-box" }} />
      </div>
      <div style={{ marginBottom: 10 }}>
        <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "#6aaedd", letterSpacing: ".09em", marginBottom: 5 }}>ACCOUNT EMAIL / ID</label>
        <input value={editEmail} onChange={e => setEditEmail(e.target.value)} placeholder="email@example.com" style={{ width: "100%", padding: "7px 10px", borderRadius: 7, border: "0.5px solid rgba(255,255,255,0.12)", background: "#0d0e17", color: "#f0ede8", fontSize: 12, outline: "none", boxSizing: "border-box" }} />
      </div>

      {/* Fields */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {isNylas ? (
          <>
            <div>
              <label style={lbl}>NYLAS API KEY</label>
              <input value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="nyk_v0_..." style={inp} autoComplete="off" spellCheck={false} />
            </div>
            <div>
              <label style={lbl}>GRANT ID (from connected inbox)</label>
              <input value={username} onChange={e => setUsername(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSave()} placeholder="grant_... or UUID" style={inp} autoComplete="off" spellCheck={false} />
            </div>
          </>
        ) : isApiOnly ? (
          <div>
            <label style={lbl}>{isStripe ? "STRIPE SECRET KEY" : isCF ? "CLOUDFLARE API TOKEN" : "API KEY / TOKEN"}</label>
            <input value={apiKey} onChange={e => setApiKey(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSave()} placeholder={isStripe ? "sk_live_..." : isCF ? "CF token..." : `${name} API key...`} style={inp} autoComplete="off" spellCheck={false} />
          </div>
        ) : (
          <>
            {isOAuth && (
              <div>
                <label style={lbl}>USERNAME / EMAIL (prefill OAuth hint)</label>
                <input value={username} onChange={e => setUsername(e.target.value)} placeholder={email} style={inp} autoComplete="off" />
              </div>
            )}
            {!isOAuth && (
              <>
                <div>
                  <label style={lbl}>USERNAME / EMAIL</label>
                  <input value={username} onChange={e => setUsername(e.target.value)} placeholder={email} style={inp} autoComplete="off" />
                </div>
                <div>
                  <label style={lbl}>PASSWORD</label>
                  <div style={{ position: "relative" }}>
                    <input value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" type={showPass ? "text" : "password"} style={{ ...inp, paddingRight: 32 }} autoComplete="new-password" />
                    <button onClick={() => setShowPass(v => !v)} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 11 }}>
                      {showPass ? "🙈" : "👁"}
                    </button>
                  </div>
                </div>
              </>
            )}
            <div>
              <label style={lbl}>API KEY / TOKEN (optional)</label>
              <input value={apiKey} onChange={e => setApiKey(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSave()} placeholder={`${name} API key or token...`} style={inp} autoComplete="off" spellCheck={false} />
            </div>
          </>
        )}
      </div>

      {validMsg && (
        <div style={{ marginTop: 8, fontSize: 10, color: validMsg.ok ? C.teal : C.red, fontWeight: 600 }}>{validMsg.msg}</div>
      )}

      <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
        {isOAuth && slot.status !== "on" && (
          <button onClick={() => startOAuthFlow(name, user)} style={{ flex: 1, padding: "8px", borderRadius: 7, background: "rgba(74,179,244,0.12)", border: "0.5px solid rgba(74,179,244,0.35)", color: C.blue, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
            🔗 Connect
          </button>
        )}
        {isOAuth && slot.status === "on" && (
          <button onClick={() => disconnectOAuth(OAUTH_PROVIDER[name]?.provider, email, onRemove)} style={{ padding: "8px 10px", borderRadius: 7, background: "rgba(255,79,94,0.08)", border: "0.5px solid rgba(255,79,94,0.4)", color: C.red, fontSize: 11, cursor: "pointer" }}>
            Disconnect
          </button>
        )}
        <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: "8px", borderRadius: 7, background: "rgba(0,200,150,0.15)", border: `0.5px solid ${C.teal}`, color: C.teal, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
          {saving ? "Saving..." : "✓ Save & Connect"}
        </button>
        {slot.status === "on" && (
          <button onClick={onRemove} title="Disconnect" style={{ padding: "8px 10px", borderRadius: 7, background: "rgba(255,79,94,0.08)", border: "0.5px solid rgba(255,79,94,0.3)", color: C.red, fontSize: 11, cursor: "pointer" }}>✕</button>
        )}
        {confirmDel ? (
          <>
            <button onClick={() => { onDelete(); setConfirmDel(false); }} style={{ padding: "8px 10px", borderRadius: 7, background: "rgba(255,79,94,0.2)", border: "0.5px solid rgba(255,79,94,0.6)", color: C.red, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Confirm Delete</button>
            <button onClick={() => setConfirmDel(false)} style={{ padding: "8px 8px", borderRadius: 7, background: "transparent", border: "0.5px solid rgba(255,255,255,0.1)", color: "#666", fontSize: 11, cursor: "pointer" }}>Cancel</button>
          </>
        ) : (
          <button onClick={() => setConfirmDel(true)} title="Delete account" style={{ padding: "8px 10px", borderRadius: 7, background: "rgba(255,79,94,0.05)", border: "0.5px solid rgba(255,79,94,0.2)", color: "#ff4f5e88", fontSize: 11, cursor: "pointer" }}>🗑</button>
        )}
        <button onClick={onClose} style={{ padding: "8px 10px", borderRadius: 7, background: "transparent", border: "0.5px solid rgba(255,255,255,0.1)", color: "#6aaedd", fontSize: 11, cursor: "pointer" }}>↑</button>
      </div>
    </div>
  );
}

// ── Stripe Data Widget ────────────────────────────────────────────────────────
function StripeDataWidget({ accounts }) {
  const [data, setData] = useState(null);
  const [loading, setLoad] = useState(false);
  const [err, setErr] = useState(null);
  const connected = getAccountEntries(accounts, "Stripe").find(({ slot }) => slot.status === "on" && slot.apiKey);

  if (!connected) return null;

  function fetchData() {
    setLoad(true);
    setErr(null);
    fetch(`${WORKER_URL}/api/stripe/summary`)
      .then(r => r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`))
      .then(d => {
        setData(d);
        setLoad(false);
      })
      .catch(e => {
        setErr(String(e));
        setLoad(false);
      });
  }

  return (
    <div style={{ padding: "10px 14px 12px", borderTop: "0.5px solid rgba(255,255,255,0.05)" }}>
      {!data && !loading && (
        <button onClick={fetchData} style={{ width: "100%", padding: "7px", borderRadius: 7, background: "rgba(99,91,255,0.1)", border: "0.5px solid rgba(99,91,255,0.3)", color: "#635bff", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>📊 Pull Stripe Data</button>
      )}
      {loading && <div style={{ fontSize: 10, color: "#555", textAlign: "center", padding: 6 }}>Loading Stripe data...</div>}
      {err && (
        <div style={{ fontSize: 10, color: C.red }}>{err} — <button onClick={fetchData} style={{ background: "none", border: "none", color: "#635bff", cursor: "pointer", fontSize: 10 }}>retry</button></div>
      )}
      {data && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: "#555", letterSpacing: ".1em" }}>STRIPE SUMMARY</span>
            <button onClick={() => { setData(null); fetchData(); }} style={{ fontSize: 9, color: "#635bff", background: "none", border: "none", cursor: "pointer" }}>↻ Refresh</button>
          </div>
          {data.balance && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 10, color: "#555", marginBottom: 2 }}>Available Balance</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#635bff" }}>${((data.balance.available?.[0]?.amount || 0) / 100).toFixed(2)} <span style={{ fontSize: 11, color: "#555" }}>{(data.balance.available?.[0]?.currency || "usd").toUpperCase()}</span></div>
              {data.balance.pending?.[0]?.amount > 0 && (
                <div style={{ fontSize: 10, color: "#555" }}>Pending: ${((data.balance.pending[0].amount) / 100).toFixed(2)}</div>
              )}
            </div>
          )}
          {data.charges && data.charges.length > 0 && (
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, color: "#555", letterSpacing: ".1em", marginBottom: 5 }}>RECENT CHARGES</div>
              {data.charges.slice(0, 5).map(ch => (
                <div key={ch.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", borderBottom: "0.5px solid rgba(255,255,255,0.04)", fontSize: 10 }}>
                  <span style={{ color: "#888", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "65%" }}>{ch.description || ch.customer_email || ch.id}</span>
                  <span style={{ color: ch.status === "succeeded" ? C.teal : C.red, fontWeight: 700, flexShrink: 0 }}>${(ch.amount / 100).toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Cloudflare Data Widget ────────────────────────────────────────────────────
function CloudflareDataWidget({ accounts }) {
  const [data, setData] = useState(null);
  const [loading, setLoad] = useState(false);
  const [err, setErr] = useState(null);
  const connected = getAccountEntries(accounts, "Cloudflare").find(({ slot }) => slot.status === "on" && slot.apiKey);

  if (!connected) return null;

  function fetchData() {
    setLoad(true);
    setErr(null);
    fetch(`${WORKER_URL}/api/cloudflare/summary`)
      .then(r => r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`))
      .then(d => {
        setData(d);
        setLoad(false);
      })
      .catch(e => {
        setErr(String(e));
        setLoad(false);
      });
  }

  return (
    <div style={{ padding: "10px 14px 12px", borderTop: "0.5px solid rgba(255,255,255,0.05)" }}>
      {!data && !loading && (
        <button onClick={fetchData} style={{ width: "100%", padding: "7px", borderRadius: 7, background: "rgba(255,102,51,0.1)", border: "0.5px solid rgba(255,102,51,0.3)", color: "#ff6633", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>📊 Pull Cloudflare Analytics</button>
      )}
      {loading && <div style={{ fontSize: 10, color: "#555", textAlign: "center", padding: 6 }}>Loading Cloudflare data...</div>}
      {err && (
        <div style={{ fontSize: 10, color: C.red }}>{err} — <button onClick={fetchData} style={{ background: "none", border: "none", color: "#ff6633", cursor: "pointer", fontSize: 10 }}>retry</button></div>
      )}
      {data && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: "#555", letterSpacing: ".1em" }}>CLOUDFLARE ZONES</span>
            <button onClick={() => { setData(null); fetchData(); }} style={{ fontSize: 9, color: "#ff6633", background: "none", border: "none", cursor: "pointer" }}>↻ Refresh</button>
          </div>
          {(data.zones || []).map(z => (
            <div key={z.id} style={{ marginBottom: 8, padding: "8px 10px", borderRadius: 7, background: "rgba(255,102,51,0.06)", border: "0.5px solid rgba(255,102,51,0.15)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#ff6633" }}>{z.name}</span>
                <span style={{ fontSize: 9, color: z.status === "active" ? C.teal : "#555", fontWeight: 700 }}>{z.status}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, fontSize: 10 }}>
                <span style={{ color: "#555" }}>Requests: <span style={{ color: "#f0ede8", fontWeight: 600 }}>{(z.requests || 0).toLocaleString()}</span></span>
                <span style={{ color: "#555" }}>Threats: <span style={{ color: (z.threats || 0) > 0 ? C.red : "#888", fontWeight: 600 }}>{(z.threats || 0).toLocaleString()}</span></span>
                <span style={{ color: "#555" }}>Bandwidth: <span style={{ color: "#f0ede8", fontWeight: 600 }}>{z.bandwidth || "—"}</span></span>
                <span style={{ color: "#555" }}>Uniques: <span style={{ color: "#f0ede8", fontWeight: 600 }}>{(z.uniques || 0).toLocaleString()}</span></span>
              </div>
            </div>
          ))}
          {(!data.zones || data.zones.length === 0) && (
            <div style={{ fontSize: 10, color: "#555" }}>No zones found. Check your API token permissions.</div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Integration Card ──────────────────────────────────────────────────────────
function IntegrationCard({ item, accounts, onAccountsChange, showToast, isFree, firebaseIdToken, isConnected: globalIsConnected }) {
  const [expanded, setExpanded] = useState(null);
  const [addingAcct, setAdding] = useState(false);
  const isOAuth = !!OAUTH_PROVIDER[item.name];
  const isApiKey = API_KEY_SERVICES.has(item.name);
  const accountEntries = getAccountEntries(accounts, item.name);
  // For OAuth items (socials etc.), the true "connected" comes from the oauth status + live verification, not the local accounts "on".
  // If globalIsConnected provided and it's an OAuth item, use that to determine active/inactive. Force Inactive otherwise.
  const oauthConnected = isOAuth && globalIsConnected ? !!globalIsConnected(item.name) : false;
  const anyOn = isOAuth ? oauthConnected : accountEntries.some(({ slot }) => slot.status === "on");
  
  function addAccount({ email, label, color, icon }) {
    const updated = { ...accounts };
    if (!updated[item.name]) updated[item.name] = {};
    if (!updated[item.name][email]) {
      updated[item.name][email] = { username: "", password: "", apiKey: "", status: "off", label, color, icon };
    }
    onAccountsChange(updated);
    setAdding(false);
    setExpanded(email);
  }
  
  function saveSlot(email, data) {
    const updated = { ...accounts };
    if (!updated[item.name]) updated[item.name] = {};
    updated[item.name] = { ...updated[item.name] };
    const current = updated[item.name][email] || { username: "", password: "", apiKey: "", status: "off", label: email, color: "#6aaedd", icon: "👤" };
    const hasCredential = !!(data.apiKey || data.username || data.password);
    const newEmail = data.email && data.email.trim() ? data.email.trim() : email;
    if (newEmail !== email) {
      delete updated[item.name][email];
    }
    updated[item.name][newEmail] = { ...current, ...data, email: undefined, status: hasCredential ? "on" : current.status };
    onAccountsChange(updated);
    if (data.apiKey) {
      try {
        const local = JSON.parse(localStorage.getItem("lifeos1_keys_v2") || "{}");
        local[item.name] = data.apiKey;
        localStorage.setItem("lifeos1_keys_v2", JSON.stringify(local));
      } catch {}
    }
    const displayLabel = updated[item.name][newEmail].label || newEmail;
    showToast(`✓ ${item.name} — ${displayLabel} saved`, C.teal);
    setExpanded(null);
    if (data.apiKey) {
      storeKeyOnWorker(item.name, newEmail, data.apiKey, firebaseIdToken).catch(() => {});
    }
    if (item.name === "Nylas" && data.username) {
      fetch(`${WORKER_URL}/api/nylas/store-grant`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${firebaseIdToken}`
        },
        body: JSON.stringify({ email: newEmail, grant_id: data.username }),
      }).catch(() => {
        fetch(`${WORKER_URL}/api/keys/store`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${firebaseIdToken}`
          },
          body: JSON.stringify({ service: "nylas_grant_id", key: data.username }),
        }).catch(() => {});
      });
    }
  }
  
  function removeSlot(email) {
    const updated = { ...accounts };
    if (updated[item.name]?.[email]) {
      updated[item.name][email] = { ...updated[item.name][email], username: "", password: "", apiKey: "", status: "off" };
    }
    onAccountsChange(updated);
    showToast(`${item.name} disconnected`, C.red);
    setExpanded(null);
  }
  
  function deleteSlot(email) {
    const updated = { ...accounts };
    if (updated[item.name]) delete updated[item.name][email];
    onAccountsChange(updated);
    showToast(`${item.name} — account removed`, "#888");
    setExpanded(null);
  }
  
  // For OAuth socials/integrations, if not connected via the verified oauth status, force "Inactive" label and styling.
  const effectiveAnyOn = anyOn;
  const effectiveStatusText = isOAuth && globalIsConnected && !globalIsConnected(item.name) ? "● Inactive" : (isFree ? "● Always On" : anyOn ? "● Active" : accountEntries.length === 0 ? (isOAuth ? "OAuth →" : isApiKey ? "Add Key" : "Connect") : "Manage");
  const statusBg = effectiveAnyOn && !(isOAuth && globalIsConnected && !globalIsConnected(item.name)) ? "rgba(0,200,150,0.1)" : "rgba(74,179,244,0.06)";
  const statusBrd = effectiveAnyOn && !(isOAuth && globalIsConnected && !globalIsConnected(item.name)) ? "rgba(0,200,150,0.3)" : "rgba(74,179,244,0.15)";
  const statusColor = effectiveAnyOn && !(isOAuth && globalIsConnected && !globalIsConnected(item.name)) ? C.teal : "#6aaedd";
  const oauthActive = isOAuth ? (globalIsConnected ? !!globalIsConnected(item.name) : false) : false;
  
  return (
    <div style={{ ...card, overflow: "hidden", transition: "box-shadow .2s", boxShadow: effectiveAnyOn && !(isOAuth && globalIsConnected && !globalIsConnected(item.name)) ? `0 0 0 1px ${item.color}44` : "none" }}>
      {/* Header */}
      <div style={{ padding: "11px 14px", display: "flex", gap: 10, alignItems: "center" }}>
        <div style={{ width: 34, height: 34, borderRadius: 8, background: item.color + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, flexShrink: 0 }}>{item.icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#f0ede8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {item.name} {isFree && <span style={{ marginLeft: 6, fontSize: 9, color: "#ff8c42", fontWeight: 700, background: "rgba(255,140,66,0.12)", padding: "1px 5px", borderRadius: 8 }}>FREE</span>}
          </div>
          <div style={{ fontSize: 10, color: "#6aaedd" }}>{item.sub}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: effectiveAnyOn && !(isOAuth && globalIsConnected && !globalIsConnected(item.name)) ? "#00c896" : isFree ? "#ff8c42" : "#444" }} />
          <button onClick={() => { if (isFree) { showToast("☁ Workers AI is always free — no setup needed!", C.teal); return; } setAdding(false); if (accountEntries.length === 0) { setAdding(true); return; } setExpanded(e => e ? null : accountEntries[0].email); }} style={{ padding: "3px 9px", borderRadius: 20, fontSize: 9, fontWeight: 700, cursor: "pointer", border: `0.5px solid ${statusBrd}`, background: statusBg, color: statusColor }}>
            {effectiveStatusText}
          </button>
        </div>
      </div>
      
      {/* Dynamic account rows */}
      {!isFree && (isApiKey || isOAuth) && accountEntries.length > 0 && (
        <div style={{ borderTop: "0.5px solid rgba(255,255,255,0.05)" }}>
          {accountEntries.map(({ email, slot }) => {
            const isExp = expanded === email;
            const on = slot.status === "on";
            const acctLbl = slot.label || email.split("@")[0] || email;
            const acctClr = slot.color || "#6aaedd";
            const acctIcon = slot.icon || "👤";
            return (
              <RowWithDelete key={email} onDelete={() => deleteSlot(email)}>
                <div style={{ padding: "7px 14px", display: "flex", alignItems: "center", gap: 8, cursor: "pointer", background: isExp ? "rgba(255,255,255,0.03)" : "transparent", borderBottom: isExp ? "none" : "0.5px solid rgba(255,255,255,0.03)", flex: 1, minWidth: 0 }} onClick={() => setExpanded(e => (e === email ? null : email))}>
                  <span style={{ fontSize: 12 }}>{acctIcon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: on ? acctClr : "#888" }}>{acctLbl}</div>
                    <div style={{ fontSize: 9, color: "#444", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{email}</div>
                  </div>
                  {isOAuth ? (
                    oauthActive ? <span style={{ fontSize: 9, color: C.teal, fontWeight: 700, flexShrink: 0 }}>● OAuth</span> : null
                  ) : (
                    on && <span style={{ fontSize: 9, color: C.teal, fontWeight: 700, flexShrink: 0 }}>● on</span>
                  )}
                  {!isOAuth && on && slot.apiKey && <span style={{ fontSize: 9, color: "#444", flexShrink: 0 }}>••••{slot.apiKey.slice(-4)}</span>}
                  <span style={{ fontSize: 9, color: isExp ? acctClr : "#444", fontWeight: 700, flexShrink: 0 }}>{isExp ? "▲" : "▼"}</span>
                </div>
                {isExp && (
                  <CredentialForm name={item.name} email={email} label={acctLbl} icon={acctIcon} color={acctClr} slot={slot} isOAuth={isOAuth} globalIsConnected={globalIsConnected} itemName={item.name} onSave={data => saveSlot(email, data)} onRemove={() => removeSlot(email)} onDelete={() => deleteSlot(email)} onClose={() => setExpanded(null)} firebaseIdToken={firebaseIdToken} />
                )}
              </RowWithDelete>
            );
          })}
        </div>
      )}
      
      {/* Add Account button */}
      {!isFree && (isApiKey || isOAuth) && !addingAcct && (
        <div style={{ padding: "6px 14px 8px", borderTop: accountEntries.length > 0 ? "0.5px solid rgba(255,255,255,0.04)" : "none" }}>
          <button onClick={() => { setAdding(true); setExpanded(null); }} style={{ width: "100%", padding: "6px", borderRadius: 7, background: "rgba(74,179,244,0.04)", border: "0.5px dashed rgba(74,179,244,0.2)", color: "#4a7a9b", fontSize: 10, fontWeight: 600, cursor: "pointer" }}>
            + Add Account
          </button>
        </div>
      )}
      
      {/* Add Account form */}
      {addingAcct && (
        <AddAccountForm itemName={item.name} existingAccounts={accounts[item.name] || {}} onAdd={addAccount} onCancel={() => setAdding(false)} />
      )}
      
      {/* Data widgets (Stripe / Cloudflare) */}
      {item.name === "Stripe" && <StripeDataWidget accounts={accounts} />}
      {item.name === "Cloudflare" && <CloudflareDataWidget accounts={accounts} />}
    </div>
  );
}

// ── Main Panel ────────────────────────────────────────────────────────────────
export default function IntegrationsPanel() {
  const [accounts, setAccounts] = useState(() => loadAccounts());
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const { firebaseUser, getAuthToken } = useAuth();
  const [firebaseIdToken, setFirebaseIdToken] = useState(null);
  const { isConnected, connectedAccounts, refreshStatus } = useOAuthStatus(firebaseUser);
  useEffect(() => {
    if (!firebaseUser) { setFirebaseIdToken(null); return; }
    getAuthToken().then(t => setFirebaseIdToken(t)).catch(() => {});
  }, [firebaseUser]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    saveAccounts(accounts);
  }, [accounts]);

  // Auto-clean local account "on" status for any OAuth item whose verified isConnected is false.
  useEffect(() => {
    if (!connectedAccounts) return;
    setAccounts(prev => {
      const u = { ...prev };
      let changed = false;
      Object.keys(OAUTH_PROVIDER).forEach(nm => {
        if (u[nm] && !isConnected(nm)) {
          Object.keys(u[nm]).forEach(k => {
            if (k !== "_extras" && u[nm][k] && u[nm][k].status === "on") {
              u[nm][k] = { ...u[nm][k], status: "off" };
              changed = true;
            }
          });
        }
      });
      return changed ? u : prev;
    });
  }, [connectedAccounts]);

  // Force clean social OAuth local markers on mount
  useEffect(() => {
    const socialNames = ["Facebook", "Instagram", "LinkedIn", "TikTok", "X (Twitter)", "YouTube", "Gmail", "Google Cal."];
    setAccounts(prev => {
      const u = { ...prev };
      let changed = false;
      socialNames.forEach(nm => {
        if (u[nm]) {
          Object.keys(u[nm]).forEach(k => {
            if (k !== "_extras" && u[nm][k] && u[nm][k].status === "on") {
              u[nm][k] = { ...u[nm][k], status: "off" };
              changed = true;
            }
          });
        }
      });
      return changed ? u : prev;
    });
  }, []);

  // Restore keys from Worker KV on mount if localStorage is empty
  useEffect(() => {
    const existing = loadAccounts();
    const hasAny = Object.keys(existing).some(k => 
      Object.keys(existing[k] || {}).filter(e => e !== "_extras").length > 0
    );
    if (hasAny) return;

    fetch(`${WORKER_URL}/api/keys/get-all`)
      .then(r => r.ok ? r.json() : null)
      .then(all => {
        if (!all || !Object.keys(all).length) return;
        const PROVIDER_TO_NAME = {
          claude: "Claude API", openai: "OpenAI GPT", gemini: "Gemini",
          grok: "Grok (xAI)", groq: "Groq", deepseek: "DeepSeek",
          perplexity: "Perplexity", mistral: "Mistral", cohere: "Cohere",
          together: "Together AI", fireworks: "Fireworks AI", openrouter: "OpenRouter",
          huggingface: "Hugging Face", elevenlabs: "ElevenLabs", runway: "Runway",
          replicate: "Replicate", anyscale: "Anyscale", lepton: "Lepton AI",
          novita: "NovitaAI", ai21: "AI21 Labs", brevo: "Brevo",
          sendgrid: "SendGrid", mailchimp: "Mailchimp", nylas: "Nylas",
          stripe: "Stripe", cloudflare: "Cloudflare", did: "D-ID",
        };
        const restored = {};
        for (const [svc, key] of Object.entries(all)) {
          if (!key) continue;
          const displayName = PROVIDER_TO_NAME[svc] || svc;
          const email = `${svc}@lifeos`;
          restored[displayName] = {
            [email]: { username: email, password: "", apiKey: key, status: "on", label: svc, icon: "🔑", color: "#4ab3f4" }
          };
        }
        if (Object.keys(restored).length) {
          setAccounts(prev => ({ ...restored, ...prev }));
        }
      })
      .catch(() => {});
  }, []);

  // OAuth popup success handler
  useEffect(() => {
    function onMsg(e) {
      if (e.data?.type !== "oauth_success") return;
      const provider = (e.data.provider || "").toLowerCase();
      const identity = e.data.identity || {};
      const email = identity.email || `${provider}_account`;
      const name = identity.name || email.split("@")[0] || provider;
      
      const providerMap = {
        google: ["Gmail", "Google Cal.", "YouTube"],
        microsoft: ["Outlook"],
        facebook: ["Facebook", "Instagram"],
        instagram: ["Instagram"],
        linkedin: ["LinkedIn"],
        twitter: ["X (Twitter)"],
        tiktok: ["TikTok"],
        slack: ["Slack"],
        github: ["GitHub"],
        zoom: ["Zoom"],
        clickup: ["ClickUp"],
        airtable: ["Airtable"],
        calendly: ["Calendly"],
      };
      
      const names = providerMap[provider] || [];
      if (!names.length) return;

      setAccounts(prev => {
        const updated = { ...prev };
        names.forEach(intName => {
          if (!updated[intName]) updated[intName] = {};
          const existing = updated[intName][email] || {};
          updated[intName][email] = {
            ...existing,
            label: existing.label || name,
            icon: existing.icon || "👤",
            color: existing.color || nextColor(updated[intName]),
            status: "on",
            username: email,
            password: existing.password || "",
            apiKey: existing.apiKey || ""
          };
        });
        return updated;
      });
      showToast(`${names[0]} connected${email ? " — " + email : ""}`, C.teal);
      refreshStatus();
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [refreshStatus]);

  function showToast(msg, color = C.teal) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, color });
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }

  function handleAccountsChange(newAccounts) {
    setAccounts(newAccounts);
    saveAccounts(newAccounts);
  }

  const allItems = Object.values(INTEGRATIONS).flat();
  const connectedServices = allItems.filter(item => {
    if (OAUTH_PROVIDER[item.name]) return isConnected(item.name);
    return getAccountEntries(accounts, item.name).some(({ slot }) => slot.status === "on");
  }).length;
  
  const totalActiveSlots = allItems.reduce((sum, item) => 
    sum + getAccountEntries(accounts, item.name).filter(({ slot }) => slot.status === "on").length, 0
  );

  return (
    <div style={{ padding: 24, position: "relative", maxWidth: 1200 }}>
      {toast && (
        <div style={{ position: "fixed", top: 70, right: 24, zIndex: 9999, padding: "10px 18px", borderRadius: 10, background: "#13141f", border: `0.5px solid ${toast.color}`, color: toast.color, fontSize: 13, fontWeight: 600, boxShadow: "0 4px 24px rgba(0,0,0,0.5)" }}>
          {toast.msg}
        </div>
      )}

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 24 }}>
        {[
          ["Services On", connectedServices, C.teal],
          ["Available", allItems.length - connectedServices, "#6aaedd"],
          ["Active Keys", totalActiveSlots, C.purple],
        ].map(([label, val, color]) => (
          <div key={label} style={{ ...card, padding: 16, textAlign: "center" }}>
            <div style={{ fontSize: 28, fontWeight: 800, color }}>{val}</div>
            <div style={{ fontSize: 11, color: "#6aaedd" }}>{label}</div>
          </div>
        ))}
      </div>

      {/* OAuth re-verify helper */}
      <div style={{ marginBottom: 16, fontSize: 11, color: "#6aaedd" }}>
        OAuth status is driven by live server records + data test pulls.
        <button 
          onClick={() => { 
            refreshStatus(); 
            setAccounts(prev => {
              const u = { ...prev };
              let changed = false;
              Object.keys(OAUTH_PROVIDER).forEach(nm => {
                if (u[nm] && !isConnected(nm)) {
                  Object.keys(u[nm]).forEach(k => {
                    if (k !== "_extras" && u[nm][k]?.status === "on") {
                      u[nm][k] = { ...u[nm][k], status: "off" };
                      changed = true;
                    }
                  });
                }
              });
              return changed ? u : prev;
            });
          }} 
          style={{ marginLeft: 12, padding: "2px 8px", fontSize: 10, borderRadius: 6, background: "rgba(74,179,244,0.1)", border: "0.5px solid #4ab3f4", color: "#4ab3f4", cursor: "pointer" }}
        >
          ⟳ Re-verify OAuth
        </button>
        <button 
          onClick={() => {
            const socialNames = ["Facebook", "Instagram", "LinkedIn", "TikTok", "X (Twitter)", "YouTube", "Gmail", "Google Cal."];
            setAccounts(prev => {
              const u = { ...prev };
              socialNames.forEach(nm => {
                if (u[nm]) {
                  Object.keys(u[nm]).forEach(k => {
                    if (k !== "_extras" && u[nm][k]) u[nm][k] = { ...u[nm][k], status: "off" };
                  });
                }
              });
              return u;
            });
          }}
          style={{ marginLeft: 8, padding: "2px 8px", fontSize: 10, borderRadius: 6, background: "rgba(255,79,94,0.1)", border: "0.5px solid #ff4f5e", color: "#ff4f5e", cursor: "pointer" }}
        >
          Clear local social markers
        </button>
      </div>

      {/* Sections */}
      {Object.entries(INTEGRATIONS).map(([cat, items]) => (
        <div key={cat} style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#2a6fa8", letterSpacing: ".12em", textTransform: "uppercase", marginBottom: 12, display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1, height: "0.5px", background: "rgba(255,255,255,0.06)" }} />
            {cat}
            <div style={{ flex: 1, height: "0.5px", background: "rgba(255,255,255,0.06)" }} />
          </div>
          {cat === "AI Models" && <ModelSwitcherBar />}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 10 }}>
            {items.map(item => (
              <IntegrationCard 
                key={item.name} 
                item={item} 
                accounts={accounts} 
                onAccountsChange={handleAccountsChange} 
                showToast={showToast} 
                isFree={FREE_INTEGRATIONS.has(item.name)} 
                firebaseIdToken={firebaseIdToken}
                isConnected={isConnected}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
