// LifeOS1 — CEO GPS AI Client v2
// Multi-model router with auto-fallback, credit-exhaustion detection,
// persistent model preference, and free-tier default (Workers AI).

const SUPABASE_URL = "https://mhvcdstgkyplhzjptgfr.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1odmNkc3Rna3lwbGh6anB0Z2ZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3MDE3NzYsImV4cCI6MjA5NDI3Nzc3Nn0.DrwY7_a6OyNdKtA5UB62qrWkiaFe9xcAHLqXdfzf8W4";

// USER_ID is now dynamic — must be obtained from Firebase Auth
// Do not hardcode. The caller must pass the authenticated user ID.
// For backward compatibility, functions now accept an optional userId parameter.

const SYSTEM = "You are AgentZero, the AI core of LifeOS1 for Chris Green. Be direct, strategic, actionable. Chris is a marketing business owner in Atlanta, GA.";

// ── Model preference storage ──────────────────────────────────────────────────
const MODEL_PREF_KEY = "lifeos1_preferred_model";

export function getPreferredModel() {
  try { return localStorage.getItem(MODEL_PREF_KEY) || "auto"; } catch { return "auto"; }
}

export function setPreferredModel(model, userId = null) {
  const next = (model || "auto").toLowerCase();
  try { localStorage.setItem(MODEL_PREF_KEY, next); } catch {}
  
  const WORKER_URL = import.meta.env.VITE_WORKER_URL || "https://api.lifeos1.ceogps.com";
  
  // Push to Worker with authentication if userId is provided
  if (userId) {
    try {
      fetch(`${WORKER_URL}/api/llm/preference`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-User-Id": userId
        },
        body: JSON.stringify({ model: next }),
      }).catch(() => {});
    } catch {}
  } else {
    // Legacy fallback without auth (deprecated)
    try {
      fetch(`${WORKER_URL}/api/llm/preference`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: next }),
      }).catch(() => {});
    } catch {}
  }
  console.log("[LLM] Preferred model set to:", next);
}

// Pull from Worker on app load so the choice is the same everywhere.
export async function refreshPreferredModelFromServer(userId = null) {
  const WORKER_URL = import.meta.env.VITE_WORKER_URL || "https://api.lifeos1.ceogps.com";
  const headers = { "Content-Type": "application/json" };
  if (userId) {
    headers["X-User-Id"] = userId;
  }
  try {
    const r = await fetch(`${WORKER_URL}/api/llm/preference`, { headers });
    if (!r.ok) return;
    const { preferred } = await r.json();
    if (preferred) {
      try { localStorage.setItem(MODEL_PREF_KEY, preferred); } catch {}
    }
  } catch {}
}

// Model display names for UI
export const MODEL_OPTIONS = [
  { id: "auto",     label: "Auto",      icon: "✦", desc: "Smart fallback" },
  { id: "claude",   label: "Claude",    icon: "🤍", desc: "Sonnet 4" },
  { id: "gpt",      label: "GPT-4o",   icon: "🔷", desc: "OpenAI" },
  { id: "gemini",   label: "Gemini",    icon: "💎", desc: "Free tier" },
  { id: "deepseek", label: "DeepSeek",  icon: "🌊", desc: "R1 · cheap" },
  { id: "copilot",  label: "CoPilot",   icon: "🪟", desc: "Microsoft" },
  { id: "grok",     label: "Grok",      icon: "✦",  desc: "xAI" },
  { id: "groq",     label: "Groq",      icon: "⚡", desc: "Ultra-fast" },
  { id: "qwen",     label: "Qwen",      icon: "🐉", desc: "Alibaba" },
  { id: "free",     label: "Free",      icon: "☁",  desc: "Workers AI" },
];

// ── Supabase helpers with dynamic user ID ─────────────────────────────────────
let _cache = null;
let _cacheTs = 0;
const CACHE_TTL = 30000;

async function supaFetch(path, opts = {}) {
  try {
    const res = await fetch(SUPABASE_URL + path, {
      ...opts,
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON,
        "Authorization": "Bearer " + SUPABASE_ANON,
        "Prefer": "resolution=merge-duplicates",
        ...(opts.headers || {}),
      },
    });
    const text = await res.text();
    return text ? JSON.parse(text) : [];
  } catch (e) {
    console.warn("Supabase error:", e.message);
    return null;
  }
}

export async function loadAllSettings(userId, force = false) {
  if (!userId) return {};
  if (!force && _cache && Date.now() - _cacheTs < CACHE_TTL) return _cache;
  const rows = await supaFetch(`/rest/v1/user_settings?user_id=eq.${userId}&select=key_name,key_value,oauth_tokens`);
  if (!rows) return _cache || {};
  const map = {};
  rows.forEach(r => { map[r.key_name] = { value: r.key_value, oauth: r.oauth_tokens }; });
  _cache = map;
  _cacheTs = Date.now();
  return map;
}

export async function getApiKey(keyName, userId, fallback = "") {
  if (!userId) {
    // Fallback to current Firebase user
    try {
      const { auth } = await import('@/lib/firebase');
      userId = auth?.currentUser?.uid;
    } catch {}
  }
  if (!userId) return fallback;
  // Check localStorage first with user-specific key
  try {
    const local = JSON.parse(localStorage.getItem(`lifeos1_keys_v2_${userId}`) || "{}");
    if (local[keyName]) return local[keyName].trim();
  } catch {}
  const all = await loadAllSettings(userId);
  return all[keyName]?.value?.trim() || fallback;
}

export async function saveApiKey(keyName, keyValue, userId) {
  if (!userId) {
    // Fallback to current Firebase user
    try {
      const { auth } = await import('@/lib/firebase');
      userId = auth?.currentUser?.uid;
    } catch {}
  }
  if (!userId) return;
  // Write to user-specific localStorage
  try {
    const local = JSON.parse(localStorage.getItem(`lifeos1_keys_v2_${userId}`) || "{}");
    local[keyName] = keyValue;
    localStorage.setItem(`lifeos1_keys_v2_${userId}`, JSON.stringify(local));
  } catch {}
  if (_cache) _cache[keyName] = { ...(_cache[keyName] || {}), value: keyValue };
  // Sync to Supabase in background
  supaFetch("/rest/v1/user_settings", {
    method: "POST",
    body: JSON.stringify({ user_id: userId, key_name: keyName, key_value: keyValue, updated_at: new Date().toISOString() }),
  }).catch(e => console.warn("[saveApiKey] Supabase sync failed:", e.message));
}

export async function deleteApiKey(keyName, userId) {
  if (!userId) return;
  await supaFetch(
    `/rest/v1/user_settings?user_id=eq.${userId}&key_name=eq.${encodeURIComponent(keyName)}`,
    { method: "DELETE", headers: { Prefer: "" } }
  );
  if (_cache) delete _cache[keyName];
}

export async function saveOAuthTokens(provider, tokens, userId) {
  if (!userId) return;
  const keyName = "oauth_" + provider;
  await supaFetch("/rest/v1/user_settings", {
    method: "POST",
    body: JSON.stringify({ user_id: userId, key_name: keyName, oauth_tokens: tokens, updated_at: new Date().toISOString() }),
  });
  if (_cache) _cache[keyName] = { ...(_cache[keyName] || {}), oauth: tokens };
}

export async function getOAuthTokens(provider, userId) {
  if (!userId) return null;
  const all = await loadAllSettings(userId);
  return all["oauth_" + provider]?.oauth || null;
}

// PKCE helpers for OAuth2 in SPA (no client secret needed for public clients)
function base64URLEncode(str) {
  return btoa(String.fromCharCode.apply(null, new Uint8Array(str)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function generateCodeVerifier() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64URLEncode(array);
}

async function generateCodeChallenge(verifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64URLEncode(digest);
}

export async function generatePKCE() {
  const verifier = await generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);
  return { verifier, challenge, method: 'S256' };
}

export async function isOAuthConnected(provider, userId) {
  const tokens = await getOAuthTokens(provider, userId);
  return !!tokens?.connected;
}

// ── Primary router — calls Worker /api/llm/invoke with authentication ─────────
const WORKER_URL = import.meta.env.VITE_WORKER_URL || "https://api.lifeos1.ceogps.com";

let _lastModelUsed = null;
export function getLastModelUsed() { return _lastModelUsed; }

// New version with authentication — requires Firebase token
export async function invokeLLMWithAuth({ prompt, systemPrompt, model = "", firebaseToken }) {
  if (!firebaseToken) {
    console.error("[LLM] No Firebase token provided");
    return "[Authentication required. Please log in again.]";
  }
  
  const sys = systemPrompt || SYSTEM;
  const preferred = model || getPreferredModel();
  const messagesArg = Array.isArray(prompt) ? prompt : null;

  try {
    const response = await fetch(`${WORKER_URL}/api/llm/invoke`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${firebaseToken}`
      },
      body: JSON.stringify(
        messagesArg
          ? { messages: messagesArg, system: sys, model: preferred }
          : { prompt, system: sys, model: preferred }
      ),
    });
    
    if (response.status === 401) {
      return "[Session expired. Please refresh and log in again.]";
    }
    
    const data = await response.json().catch(() => ({}));
    _lastModelUsed = data.model_used || null;
    
    if (data.text) {
      if (data.fallback_count > 0) {
        console.log(`[LLM] Fallback chain — answered by ${data.model_used} after ${data.fallback_count} skip(s):`, data.providers_tried);
      }
      return data.text;
    }
    
    console.warn("[LLM] All providers failed:", data.providers_tried);
    return data.text || "[AI temporarily unavailable. Check Integrations panel.]";
  } catch (error) {
    console.error("[LLM] Worker unreachable:", error.message);
    return "[AI router unreachable — Worker may be down.]";
  }
}

// Legacy invokeLLM for backward compatibility — will log warning
// Deprecated: Use invokeLLMWithAuth instead
export async function invokeLLM({ prompt, systemPrompt, model = "" }) {
  console.warn("[LLM] DEPRECATED: invokeLLM called without authentication. Use invokeLLMWithAuth instead.");
  
  const sys = systemPrompt || SYSTEM;
  const preferred = model || getPreferredModel();
  const messagesArg = Array.isArray(prompt) ? prompt : null;

  try {
    const response = await fetch(`${WORKER_URL}/api/llm/invoke`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        messagesArg
          ? { messages: messagesArg, system: sys, model: preferred }
          : { prompt, system: sys, model: preferred }
      ),
    });
    const data = await response.json().catch(() => ({}));
    _lastModelUsed = data.model_used || null;
    if (data.text) {
      return data.text;
    }
    return data.text || "[AI temporarily unavailable. Check Integrations panel.]";
  } catch (error) {
    console.error("[LLM] Worker unreachable:", error.message);
    return "[AI router unreachable — Worker may be down.]";
  }
}

// Legacy provider-specific functions (deprecated, but kept for compatibility)
async function callClaude(prompt, sys)   { return invokeLLM({ prompt, systemPrompt: sys, model: "claude" }); }
async function callOpenAI(prompt, sys)   { return invokeLLM({ prompt, systemPrompt: sys, model: "gpt" }); }
async function callGemini(prompt, sys)   { return invokeLLM({ prompt, systemPrompt: sys, model: "gemini" }); }
async function callDeepSeek(prompt, sys) { return invokeLLM({ prompt, systemPrompt: sys, model: "deepseek" }); }
async function callGrok(prompt, sys)     { return invokeLLM({ prompt, systemPrompt: sys, model: "grok" }); }
async function callGroq(prompt, sys)     { return invokeLLM({ prompt, systemPrompt: sys, model: "groq" }); }
async function callCopilot(prompt, sys)  { return invokeLLM({ prompt, systemPrompt: sys, model: "copilot" }); }
async function callMistral(prompt, sys)  { return invokeLLM({ prompt, systemPrompt: sys, model: "free" }); }
async function callPerplexity(prompt, sys){ return invokeLLM({ prompt, systemPrompt: sys, model: "auto" }); }
async function callWorkersAI(prompt, sys){ return invokeLLM({ prompt, systemPrompt: sys, model: "free" }); }
async function autoFallback(prompt, sys) { return invokeLLM({ prompt, systemPrompt: sys, model: "auto" }); }

// ── D-ID Avatar (requires userId for API key lookup) ──────────────────────────
export async function createDIDTalk(text, avatarUrl, userId) {
  const key = await getApiKey("D-ID", userId, "");
  if (!key) {
    return { error: "D-ID API key not configured. Please add it in Integrations panel." };
  }
  const presenter = avatarUrl || "https://create-images-results.d-id.com/DefaultPresenters/Emma_f/image.jpeg";
  try {
    const res = await fetch("https://api.d-id.com/talks", {
      method: "POST",
      headers: { "Authorization": `Basic ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        script: { type: "text", input: text, provider: { type: "microsoft", voice_id: "en-US-JennyNeural" } },
        source_url: presenter,
      }),
    });
    return await res.json();
  } catch (e) { return { error: e.message }; }
}

export async function getDIDTalkResult(talkId, userId) {
  const key = await getApiKey("D-ID", userId, "");
  if (!key) {
    return { error: "D-ID API key not configured." };
  }
  try {
    const res = await fetch(`https://api.d-id.com/talks/${talkId}`, {
      headers: { "Authorization": `Basic ${key}` },
    });
    return await res.json();
  } catch (e) { return { error: e.message }; }
}

// ── Public API ────────────────────────────────────────────────────────────────
export const ceogps = {
  invokeLLMWithAuth,
  invokeLLM, // deprecated
  saveApiKey,
  getApiKey,
  deleteApiKey,
  getPreferredModel,
  setPreferredModel,
};

export default ceogps;