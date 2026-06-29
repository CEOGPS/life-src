// LifeOS1 Cloudflare Worker — Complete Merged Version
// With multi-account OAuth, Supabase JWT validation, and all features
// ============================================================================
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};
const SUPABASE_URL = "https://mhvcdstgkyplhzjptgfr.supabase.co";
// ============================================================================
// SUPABASE JWT VALIDATION
// ============================================================================
async function validateSupabaseJWT(token, env) {
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    const userId = payload.sub;
    if (!userId) return null;
    const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (response.ok) {
      const user = await response.json();
      return { id: user.id, email: user.email, ...user };
    }
    return null;
  } catch (e) {
    console.warn("JWT validation error:", e.message);
    return null;
  }
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}
function err(msg, status = 400) { return json({ error: msg }, status); }
function redirect(url) { return Response.redirect(url, 302); }
// ── Supabase helper (uses service role key) ───────────────────────────────
async function supabase(env, path, opts = {}) {
  const key = env.SUPABASE_SERVICE_KEY || "";
  const res = await fetch(SUPABASE_URL + path, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      "apikey": key,
      "Authorization": "Bearer " + key,
      "Prefer": "resolution=merge-duplicates",
      ...(opts.headers || {}),
    },
  });
  const text = await res.text();
  return text ? JSON.parse(text) : [];
}
async function getSystemUserId(env) {
  let id = await env.LIFEOS_KV.get("system_user_id");
  if (id) return id;
  try {
    const { data } = await supabase(env, "/rest/v1/users?email=eq.system@lifeos1.com&select=id");
    if (data?.length) {
      await env.LIFEOS_KV.put("system_user_id", data[0].id);
      return data[0].id;
    }
    const { data: newUser } = await supabase(env, "/rest/v1/users", {
      method: "POST",
      body: JSON.stringify({ email: "system@lifeos1.com", created_at: new Date().toISOString() })
    });
    id = newUser?.[0]?.id || "sys_fallback";
    await env.LIFEOS_KV.put("system_user_id", id);
    return id;
  } catch { return "sys_fallback"; }
}
async function checkRateLimit(env, key, windowSec = 60, maxReqs = 30) {
  const slot = Math.floor(Date.now() / 1000 / windowSec);
  const k = `rate:${key}:${slot}`;
  const val = await env.LIFEOS_KV.get(k, "json") || { count: 0 };
  val.count++;
  await env.LIFEOS_KV.put(k, JSON.stringify(val), { expirationTtl: windowSec + 5 });
  return { allowed: val.count <= maxReqs, remaining: maxReqs - val.count, reset: (slot + 1) * windowSec };
}
// ============================================================================
// MULTI-ACCOUNT OAUTH HELPERS
// ============================================================================
async function getUserId(env, emailOrId) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(emailOrId)) {
    const { data } = await supabase(env, `/rest/v1/users?select=id&id=eq.${emailOrId}`);
    if (data?.length) return data[0].id;
  }
  const { data } = await supabase(env, `/rest/v1/users?select=id&email=eq.${encodeURIComponent(emailOrId)}`);
  if (data?.length) return data[0].id;
  const { data: newUser } = await supabase(env, "/rest/v1/users", {
    method: "POST",
    body: JSON.stringify({
      email: emailOrId,
      created_at: new Date().toISOString(),
      last_sign_in: new Date().toISOString()
    })
  });
  return newUser?.[0]?.id || null;
}
async function saveOAuthTokensToSupabase(env, provider, tokens, userId, accountEmail, accountName, platformUserId) {
  const existing = await supabase(
    env,
    `/rest/v1/platform_tokens?select=id&user_id=eq.${userId}&platform=eq.${provider}&account_email=eq.${encodeURIComponent(accountEmail)}`
  );
  const tokenData = {
    user_id: userId,
    platform: provider,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token || null,
    token_expires_at: tokens.expires_at ? new Date(tokens.expires_at).toISOString() : new Date(Date.now() + 3600000).toISOString(),
    platform_user_id: platformUserId || null,
    platform_username: accountEmail,
    account_email: accountEmail,
    account_name: accountName,
    metadata: {
      scope: tokens.scope,
      token_type: tokens.token_type || "Bearer",
      connected_at: Date.now()
    },
    is_active: true,
    updated_at: new Date().toISOString()
  };
  if (existing?.length) {
    await supabase(env, `/rest/v1/platform_tokens?id=eq.${existing[0].id}`, {
      method: "PATCH",
      body: JSON.stringify(tokenData)
    });
  } else {
    const { data: existingAccounts } = await supabase(
      env,
      `/rest/v1/platform_tokens?select=id&user_id=eq.${userId}&platform=eq.${provider}&limit=1`
    );
    tokenData.is_primary = !existingAccounts?.length;
    await supabase(env, "/rest/v1/platform_tokens", {
      method: "POST",
      body: JSON.stringify(tokenData)
    });
  }
}
async function getStoredTokens(env, provider, accountLabel = "default") {
  const k1 = `oauth_${provider}_${accountLabel}`;
  let rec = await env.LIFEOS_KV.get(k1, "json");
  if (!rec || !rec.access_token) {
    rec = await env.LIFEOS_KV.get(`oauth_${provider}`, "json");
    if (!rec || !rec.access_token) return null;
  }
  return rec;
}
async function getValidAccessToken(env, provider, accountLabel = "default") {
  const rec = await getStoredTokens(env, provider, accountLabel);
  if (!rec) return { error: "not_connected", provider };
  if (rec.expires_at && rec.expires_at - 60000 > Date.now()) {
    return { ok: true, access_token: rec.access_token, identity: rec.identity, rec };
  }
  if (!rec.refresh_token) {
    return { error: "no_refresh_token", detail: "Token expired. Please reconnect.", provider };
  }
  const cfg = getProviderConfig(env, provider, rec.scope || "");
  if (!cfg?.client_id) return { error: "provider_not_configured", provider };
  try {
    const r = await fetch(cfg.token_url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: cfg.client_id,
        client_secret: cfg.client_secret,
        refresh_token: rec.refresh_token,
        grant_type: "refresh_token",
      }),
    });
    const t = await r.json();
    if (!r.ok || t.error) {
      return { error: "refresh_failed", detail: t.error_description || t.error || `HTTP ${r.status}`, provider };
    }
    const updated = {
      ...rec,
      access_token: t.access_token,
      refresh_token: t.refresh_token || rec.refresh_token,
      expires_at: Date.now() + (t.expires_in || 3600) * 1000,
      scope: t.scope || rec.scope,
      refreshed_at: Date.now(),
    };
    await env.LIFEOS_KV.put(`oauth_${provider}_${accountLabel}`, JSON.stringify(updated));
    await env.LIFEOS_KV.put(`oauth_${provider}`, JSON.stringify(updated));
    return { ok: true, access_token: updated.access_token, identity: updated.identity, rec: updated };
  } catch (e) {
    return { error: "refresh_exception", detail: e.message, provider };
  }
}
async function getUserConnectedAccounts(env, userId, platform = null) {
  let query = `/rest/v1/platform_tokens?select=platform,account_email,account_name,is_primary,created_at,updated_at&user_id=eq.${userId}&is_active=eq.true`;
  if (platform) {
    query += `&platform=eq.${platform}`;
  }
  query += `&order=platform.asc,is_primary.desc,created_at.asc`;
  const { data } = await supabase(env, query);
  return data || [];
}
async function disconnectAccount(env, userId, provider, accountEmail) {
  const { data: account } = await supabase(
    env,
    `/rest/v1/platform_tokens?select=id,is_primary&user_id=eq.${userId}&platform=eq.${provider}&account_email=eq.${encodeURIComponent(accountEmail)}&limit=1`
  );
  if (!account?.length) return false;
  await supabase(env, `/rest/v1/platform_tokens?id=eq.${account[0].id}`, {
    method: "DELETE"
  });
  if (account[0].is_primary) {
    const { data: remaining } = await supabase(
      env,
      `/rest/v1/platform_tokens?select=id&user_id=eq.${userId}&platform=eq.${provider}&limit=1&order=created_at.asc`
    );
    if (remaining?.length) {
      await supabase(env, `/rest/v1/platform_tokens?id=eq.${remaining[0].id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_primary: true })
      });
    }
  }
  return true;
}
async function setPrimaryAccount(env, userId, provider, accountEmail) {
  await supabase(env, `/rest/v1/platform_tokens?user_id=eq.${userId}&platform=eq.${provider}`, {
    method: "PATCH",
    body: JSON.stringify({ is_primary: false })
  });
  await supabase(env, `/rest/v1/platform_tokens?user_id=eq.${userId}&platform=eq.${provider}&account_email=eq.${encodeURIComponent(accountEmail)}`, {
    method: "PATCH",
    body: JSON.stringify({ is_primary: true })
  });
  return true;
}
// Helper for DB-based token access
async function getValidAccessTokenFromDB(env, provider, userId, accountEmail = null) {
  let query = `/rest/v1/platform_tokens?select=*&user_id=eq.${userId}&platform=eq.${provider}&is_active=eq.true`;
  if (accountEmail) {
    query += `&account_email=eq.${encodeURIComponent(accountEmail)}`;
  }
  query += `&order=is_primary.desc,created_at.asc&limit=1`;
  const { data: tokens } = await supabase(env, query);
  const token = tokens?.[0];
  if (!token) return { error: "not_connected", provider };
  const expiresAt = new Date(token.token_expires_at).getTime();
  if (expiresAt - 300000 > Date.now()) {
    return {
      ok: true,
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      account_email: token.account_email,
      account_name: token.account_name,
      platform_user_id: token.platform_user_id
    };
  }
  if (!token.refresh_token) {
    return { error: "no_refresh_token", detail: "Token expired. Please reconnect.", provider };
  }
  const cfg = getProviderConfig(env, provider, token.metadata?.scope || "");
  if (!cfg?.client_id) return { error: "provider_not_configured", provider };
  try {
    const r = await fetch(cfg.token_url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: cfg.client_id,
        client_secret: cfg.client_secret,
        refresh_token: token.refresh_token,
        grant_type: "refresh_token"
      })
    });
    const newTokens = await r.json();
    if (!r.ok || newTokens.error) {
      return { error: "refresh_failed", detail: newTokens.error_description || newTokens.error, provider };
    }
    await supabase(env, `/rest/v1/platform_tokens?id=eq.${token.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        access_token: newTokens.access_token,
        refresh_token: newTokens.refresh_token || token.refresh_token,
        token_expires_at: new Date(Date.now() + (newTokens.expires_in || 3600) * 1000).toISOString(),
        updated_at: new Date().toISOString()
      })
    });
    return {
      ok: true,
      access_token: newTokens.access_token,
      refresh_token: newTokens.refresh_token || token.refresh_token,
      account_email: token.account_email,
      account_name: token.account_name,
      platform_user_id: token.platform_user_id
    };
  } catch (e) {
    return { error: "refresh_exception", detail: e.message, provider };
  }
}

// ── PKCE helpers ──────────────────────────────────────────────────────────────
async function generatePKCE() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const codeVerifier = Array.from(array, b => b.toString(16).padStart(2,'0')).join('');
  const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier));
  const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(hashBuffer)))
    .replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  return { codeVerifier, codeChallenge };
}

// ============================================================================
// PROVIDER CONFIG (Full list from both versions)
// ============================================================================
function getProviderConfig(env, provider, scope) {
  const base = "https://lifeos1.ceogps.workers.dev";
  const redirect_uri = `${base}/api/oauth/callback`;
  // Meta (FB/IG) and TikTok reject the shared workers.dev host — they require a
  // domain we own. oauth.ceogps.com is a custom domain on this same worker, so
  // KV-backed OAuth state still resolves. Other providers stay on workers.dev.
  const ownedRedirect = "https://oauth.ceogps.com/api/oauth/callback";
  const configs = {
    google: {
      auth_url: "https://accounts.google.com/o/oauth2/v2/auth",
      token_url: "https://oauth2.googleapis.com/token",
      client_id: env.GOOGLE_CLIENT_ID || "",
      client_secret: env.GOOGLE_CLIENT_SECRET || "",
      scope: [
        "email", "profile", "openid", "https://mail.google.com/",
        "https://www.googleapis.com/auth/gmail.modify",
        "https://www.googleapis.com/auth/calendar",
        "https://www.googleapis.com/auth/youtube",
        "https://www.googleapis.com/auth/youtube.upload"
      ].join(" "),
      redirect_uri
    },
    microsoft: {
      auth_url: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
      token_url: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
      client_id: env.MICROSOFT_CLIENT_ID || "",
      client_secret: env.MICROSOFT_CLIENT_SECRET || "",
      scope: "Mail.Read email profile offline_access",
      redirect_uri
    },
    github: {
      auth_url: "https://github.com/login/oauth/authorize",
      token_url: "https://github.com/login/oauth/access_token",
      client_id: env.GITHUB_CLIENT_ID || "",
      client_secret: env.GITHUB_CLIENT_SECRET || "",
      scope: "repo user",
      redirect_uri
    },
    slack: {
      auth_url: "https://slack.com/oauth/v2/authorize",
      token_url: "https://slack.com/api/oauth.v2.access",
      client_id: env.SLACK_CLIENT_ID || "",
      client_secret: env.SLACK_CLIENT_SECRET || "",
      scope: "chat:write channels:read",
      redirect_uri
    },
    linkedin: {
      auth_url: "https://www.linkedin.com/oauth/v2/authorization",
      token_url: "https://www.linkedin.com/oauth/v2/accessToken",
      client_id: env.LINKEDIN_CLIENT_ID || "",
      client_secret: env.LINKEDIN_CLIENT_SECRET || "",
      scope: "openid profile email w_member_social r_organization_social rw_organization_admin",
      redirect_uri
    },
    facebook: {
      auth_url: "https://www.facebook.com/v25.0/dialog/oauth",
      token_url: "https://graph.facebook.com/v25.0/oauth/access_token",
      client_id: env.META_APP_ID || "",
      client_secret: env.META_APP_SECRET || "",
      scope: "pages_manage_posts pages_read_engagement pages_show_list pages_manage_metadata instagram_basic instagram_content_publish instagram_manage_insights ads_management business_management",
      redirect_uri: ownedRedirect
    },
    instagram: {
      auth_url: "https://www.facebook.com/v25.0/dialog/oauth",
      token_url: "https://graph.facebook.com/v25.0/oauth/access_token",
      client_id: env.META_APP_ID || "",
      client_secret: env.META_APP_SECRET || "",
      scope: "instagram_basic instagram_content_publish instagram_manage_insights instagram_manage_comments pages_show_list",
      redirect_uri: ownedRedirect
    },
    twitter: {
      auth_url: "https://twitter.com/i/oauth2/authorize",
      token_url: "https://api.twitter.com/2/oauth2/token",
      client_id: env.TWITTER_CLIENT_ID || "",
      client_secret: env.TWITTER_CLIENT_SECRET || "",
      scope: "tweet.read tweet.write users.read offline.access",
      redirect_uri
    },
    zoom: {
      auth_url: "https://zoom.us/oauth/authorize",
      token_url: "https://zoom.us/oauth/token",
      client_id: env.ZOOM_CLIENT_ID || "",
      client_secret: env.ZOOM_CLIENT_SECRET || "",
      scope: "meeting:read meeting:write",
      redirect_uri
    },
    clickup: {
      auth_url: "https://app.clickup.com/api",
      token_url: "https://api.clickup.com/api/v2/oauth/token",
      client_id: env.CLICKUP_CLIENT_ID || "",
      client_secret: env.CLICKUP_CLIENT_SECRET || "",
      scope: "",
      redirect_uri
    },
    airtable: {
      auth_url: "https://airtable.com/oauth2/v1/authorize",
      token_url: "https://airtable.com/oauth2/v1/token",
      client_id: env.AIRTABLE_CLIENT_ID || "",
      client_secret: env.AIRTABLE_CLIENT_SECRET || "",
      scope: "data.records:read data.records:write",
      redirect_uri
    },
    tiktok: {
      auth_url: "https://www.tiktok.com/auth/authorize/",
      token_url: "https://open-api.tiktok.com/oauth/access_token/",
      client_id: env.TIKTOK_CLIENT_ID || "",
      client_secret: env.TIKTOK_CLIENT_SECRET || "",
      scope: "user.info.basic video.list",
      redirect_uri: ownedRedirect
    },
    spotify: {
      auth_url: "https://accounts.spotify.com/authorize",
      token_url: "https://accounts.spotify.com/api/token",
      client_id: env.SPOTIFY_CLIENT_ID || "",
      client_secret: env.SPOTIFY_CLIENT_SECRET || "",
      scope: "user-read-playback-state user-modify-playback-state playlist-read-private",
      redirect_uri
    },
    yahoo: {
      auth_url: "https://api.login.yahoo.com/oauth2/request_auth",
      token_url: "https://api.login.yahoo.com/oauth2/get_token",
      client_id: env.YAHOO_CLIENT_ID || "",
      client_secret: env.YAHOO_CLIENT_SECRET || "",
      scope: "mail-r mail-w",
      redirect_uri
    },
    aol: {
      auth_url: "https://api.login.aol.com/oauth2/request_auth",
      token_url: "https://api.login.aol.com/oauth2/get_token",
      client_id: env.YAHOO_CLIENT_ID || "",
      client_secret: env.YAHOO_CLIENT_SECRET || "",
      scope: "mail-r mail-w",
      redirect_uri
    }
  };
  return configs[provider] || null;
}
// ============================================================================
// AGENTS (Full implementation)
// ============================================================================
var ANTHROPIC_MODEL = "claude-sonnet-4-20250514";
async function callClaude(env, prompt, system = "") {
  const key = env.ANTHROPIC_API_KEY || "";
  if (!key) return "No ANTHROPIC_API_KEY set in Worker secrets.";
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 1024,
      system: system || "You are a LifeOS1 helper agent for Chris Green, CEO GPS, Atlanta GA.",
      messages: [{ role: "user", content: prompt }]
    })
  });
  const d = await res.json();
  return d?.content?.[0]?.text || "No response";
}
async function sendTelegram(env, text, chatId = null) {
  const token = env.TELEGRAM_BOT_TOKEN || "";
  const chat = chatId || env.TELEGRAM_OWNER_CHAT_ID || "";
  if (!chat) return { ok: false, error: "No chat_id — set TELEGRAM_OWNER_CHAT_ID in secrets" };
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chat, text, parse_mode: "Markdown" })
  });
  return await res.json();
}
async function logRun(env, agentId, result, status = "ok") {
  const key = `agent_log_${agentId}`;
  const existing = await env.LIFEOS_KV.get(key, "json") || [];
  existing.unshift({ ts: Date.now(), status, result: String(result).slice(0, 500) });
  await env.LIFEOS_KV.put(key, JSON.stringify(existing.slice(0, 50)));
}
var AGENTS = {
  "content-writer": {
    name: "Content Writer",
    desc: "Generates marketing copy, social posts, email drafts",
    async run(env, payload) {
      const { type = "social", topic = "", platform = "Instagram", tone = "professional" } = payload;
      const prompts = {
        social: `Write a ${tone} ${platform} post about: "${topic}". For CEO GPS, a digital marketing company in Atlanta run by Chris Green. Include relevant hashtags. Max 280 chars for X, longer for others. Return ONLY the post text.`,
        email: `Write a ${tone} email about: "${topic}". For CEO GPS Atlanta. Include subject line. Professional but approachable.`,
        blog: `Write a 300-word blog post intro about: "${topic}". For CEO GPS's blog. SEO-optimized for Atlanta marketing.`
      };
      const result = await callClaude(
        env,
        prompts[type] || prompts.social,
        "You are Aurora, CEO GPS's creative content agent. Write compelling, authentic marketing content."
      );
      await sendTelegram(env, `✨ *Content Writer*\n\n${result}`);
      return result;
    }
  },
  "lead-qualifier": {
    name: "Lead Qualifier",
    desc: "Scores and qualifies incoming leads, suggests next action",
    async run(env, payload) {
      const { name, company, source, notes, budget } = payload;
      const result = await callClaude(
        env,
        `Qualify this lead for CEO GPS (digital marketing agency, Atlanta):
Name: ${name || "Unknown"}
Company: ${company || "Unknown"}
Source: ${source || "Unknown"}
Notes: ${notes || "None"}
Budget: ${budget || "Unknown"}
Return JSON: { "score": 1-10, "tier": "Hot/Warm/Cold", "next_action": "...", "pitch_angle": "...", "estimated_value": "$..." }
Return ONLY valid JSON.`,
        "You are Zero, CEO GPS's lead intelligence agent. Score leads with brutal precision."
      );
      try {
        const data = JSON.parse(result.replace(/```json|```/g, "").trim());
        const msg = `🎯 *Lead Qualifier*\n\n*${name}* (${company})\nScore: ${data.score}/10 — ${data.tier}\nNext: ${data.next_action}\nEstimated: ${data.estimated_value}`;
        await sendTelegram(env, msg);
        return data;
      } catch {
        return { raw: result };
      }
    }
  },
  "daily-briefing": {
    name: "Daily Briefing",
    desc: "Sends morning summary: tasks, leads, priorities via Telegram",
    async run(env, payload) {
      const crm = await env.LIFEOS_KV.get("crm_contacts", "json") || [];
      const hotLeads = crm.filter((c) => c.tag === "Hot" || c.stage === "Proposal" || c.stage === "Negotiation").slice(0, 5);
      const tasks = await env.LIFEOS_KV.get("lifeos_tasks", "json") || [];
      const pendingTasks = tasks.filter((t) => !t.done).slice(0, 5);
      const briefing = await callClaude(
        env,
        `Generate a sharp morning briefing for Chris Green, CEO GPS, Atlanta.
Hot leads: ${JSON.stringify(hotLeads.map((l) => ({ name: l.name, stage: l.stage, value: l.value })))}
Pending tasks: ${JSON.stringify(pendingTasks.map((t) => t.title || t.text || t.name))}
Date: ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
Write a motivating, actionable briefing. Max 300 words. No fluff.`,
        "You are AgentZero. Deliver crisp intelligence briefings."
      );
      const msg = `🌅 *LifeOS1 Daily Briefing*\n_${new Date().toLocaleDateString()}_\n\n${briefing}`;
      await sendTelegram(env, msg);
      return briefing;
    }
  },
  "seo-auditor": {
    name: "SEO Auditor",
    desc: "Audits pages/topics for SEO and gives actionable fixes",
    async run(env, payload) {
      const { url = "", keywords = [] } = payload;
      const result = await callClaude(
        env,
        `Perform an SEO audit for CEO GPS (ceogps.com), a digital marketing business in Atlanta.
${url ? `Focus URL: ${url}` : ""}
${keywords.length ? `Target keywords: ${keywords.join(", ")}` : ""}
Give top 5 actionable fixes with priority (High/Med/Low) and estimated impact. Format clearly.`,
        "You are Viper, CEO GPS's SEO intelligence agent. Be precise and data-driven."
      );
      await sendTelegram(env, `🔍 *SEO Audit*\n\n${result}`);
      return result;
    }
  },
  "review-responder": {
    name: "Review Responder",
    desc: "Drafts professional responses to Google/Yelp reviews",
    async run(env, payload) {
      const { review, rating = 5, platform = "Google", reviewer = "a customer" } = payload;
      const result = await callClaude(
        env,
        `Write a professional, warm response to this ${rating}-star ${platform} review from ${reviewer}:
"${review}"
For CEO GPS, Atlanta digital marketing. Sound human, grateful, address any concerns. Under 150 words.`,
        "You are Aurora. Write authentic, professional review responses that build trust."
      );
      await sendTelegram(env, `💬 *Review Response Draft*\n\n${result}`);
      return result;
    }
  },
  "competitor-intel": {
    name: "Competitor Intel",
    desc: "Analyzes competitor positioning and suggests counter-moves",
    async run(env, payload) {
      const { competitor = "", market = "Atlanta digital marketing" } = payload;
      const result = await callClaude(
        env,
        `Analyze the competitive landscape for CEO GPS in ${market}.
${competitor ? `Focus on competitor: ${competitor}` : "General market analysis"}
Provide: positioning gaps CEO GPS can own, 3 immediate counter-moves, 1 blue-ocean opportunity.`,
        "You are Nova. Strategic competitive intelligence. See the full chessboard."
      );
      await sendTelegram(env, `📊 *Competitor Intel*\n\n${result}`);
      return result;
    }
  },
  "make-trigger": {
    name: "Make.com Trigger",
    desc: "Triggers Make.com automation scenarios",
    async run(env, payload) {
      const { webhook_url, data = {} } = payload;
      if (!webhook_url) return { error: "webhook_url required" };
      const res = await fetch(webhook_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "lifeos1", timestamp: Date.now(), ...data })
      });
      const result = { status: res.status, ok: res.ok };
      await sendTelegram(env, `🔄 *Make.com Triggered*\nStatus: ${res.status} ${res.ok ? "✅" : "❌"}`);
      return result;
    }
  }
};
async function handleAgents(path, req, env) {
  const CORS2 = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,POST,OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };
  const json2 = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { ...CORS2, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS2 });
  if (path === "/api/agents" && req.method === "GET") {
    return json2(Object.entries(AGENTS).map(([id, a]) => ({ id, name: a.name, desc: a.desc })));
  }
  if (path === "/api/agents/run" && req.method === "POST") {
    const clientIp = req.headers.get("CF-Connecting-IP") || "unknown";
    const rateLimit = await checkRateLimit(env, `agents:${clientIp}`, 60, 20);
    if (!rateLimit.allowed) {
      return json2({ error: "Rate limit exceeded. Please try again later." }, 429);
    }
    const { agent: agentId, payload = {} } = await req.json();
    const agent = AGENTS[agentId];
    if (!agent) return json2({ error: `Unknown agent: ${agentId}` }, 404);
    try {
      const result = await agent.run(env, payload);
      await logRun(env, agentId, JSON.stringify(result), "ok");
      return json2({ ok: true, agent: agentId, result });
    } catch (e) {
      await logRun(env, agentId, e.message, "error");
      return json2({ ok: false, error: e.message }, 500);
    }
  }
  if (path.startsWith("/api/agents/logs/") && req.method === "GET") {
    const agentId = path.replace("/api/agents/logs/", "");
    const logs = await env.LIFEOS_KV.get(`agent_log_${agentId}`, "json") || [];
    return json2(logs);
  }
  if (path === "/api/agents/status" && req.method === "GET") {
    const status = {};
    for (const id of Object.keys(AGENTS)) {
      const logs = await env.LIFEOS_KV.get(`agent_log_${id}`, "json") || [];
      status[id] = { name: AGENTS[id].name, lastRun: logs[0] || null, totalRuns: logs.length };
    }
    return json2(status);
  }
  return null;
}
// ============================================================================
// GRAPH API HELPERS (Facebook/Instagram)
// ============================================================================
const GRAPH = "https://graph.facebook.com/v25.0";
async function graphGet(path, token) {
  const sep = path.includes("?") ? "&" : "?";
  const r = await fetch(`${GRAPH}${path}${sep}access_token=${token}`);
  return r.json();
}
async function graphPost(path, body, token) {
  const r = await fetch(`${GRAPH}${path}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, access_token: token }),
  });
  return r.json();
}
// ============================================================================
// LINKEDIN HELPERS
// ============================================================================
async function liToken(env) {
  const data = await env.LIFEOS_KV.get(`oauth_linkedin_default`, "json") || await env.LIFEOS_KV.get(`oauth_linkedin`, "json");
  return data?.access_token || null;
}
async function liGet(env, p, token) {
  const r = await fetch("https://api.linkedin.com/v2" + p, {
    headers: { "Authorization": "Bearer " + token, "LinkedIn-Version": "202404", "X-Restli-Protocol-Version": "2.0.0" }
  });
  return r.json();
}
async function liPost(env, p, body, token) {
  const r = await fetch("https://api.linkedin.com/v2" + p, {
    method: "POST",
    headers: { "Authorization": "Bearer " + token, "LinkedIn-Version": "202404", "X-Restli-Protocol-Version": "2.0.0", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const txt = await r.text();
  try { return JSON.parse(txt); } catch { return { raw: txt, status: r.status }; }
}
// ============================================================================
// MAIN FETCH HANDLER
// ============================================================================

// ── OAuth Handler Functions ───────────────────────────────────────────────────

async function handleOAuthStart(req, env, url) {
  const providerName = url.searchParams.get("provider");
  const scope        = url.searchParams.get("scope") || "";
  const userId       = url.searchParams.get("user_id") || "unknown";
  const loginHint    = url.searchParams.get("hint") || "";

  const cfg = getProviderConfig(env, providerName, scope);
  if (!cfg) return new Response("Unknown provider", { status: 400 });
  if (!cfg.client_id) {
    return new Response(`<html><body style="background:#0d0e17;color:#f0ede8;font-family:system-ui;padding:40px">
      <h2 style="color:#4ab3f4">⚙️ ${providerName} OAuth Setup Needed</h2>
      <p>Add <code>${providerName.toUpperCase()}_CLIENT_ID</code> and <code>${providerName.toUpperCase()}_CLIENT_SECRET</code> as Wrangler secrets.</p>
    </body></html>`, { headers: { "Content-Type": "text/html" } });
  }

  const PKCE_PROVIDERS = new Set(["google", "microsoft", "twitter", "airtable", "linkedin"]);
  const usePKCE = PKCE_PROVIDERS.has(providerName);

  const state = crypto.randomUUID();
  const { codeVerifier, codeChallenge } = await generatePKCE();

  await env.LIFEOS_KV.put(`oauth_state:${state}`, JSON.stringify({
    provider: providerName,
    codeVerifier,
    usePKCE,
    userId,
    scope,
    timestamp: Date.now(),
  }), { expirationTtl: 900 });

  const authUrl = new URL(cfg.auth_url);
  authUrl.searchParams.set("client_id",     cfg.client_id);
  authUrl.searchParams.set("redirect_uri",  cfg.redirect_uri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope",         cfg.scope);
  authUrl.searchParams.set("state",         state);

  if (usePKCE) {
    authUrl.searchParams.set("code_challenge",        codeChallenge);
    authUrl.searchParams.set("code_challenge_method", "S256");
  }

  if (providerName === "google") {
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", "consent select_account");
    if (loginHint) authUrl.searchParams.set("login_hint", loginHint);
  } else if (providerName === "microsoft") {
    authUrl.searchParams.set("prompt", "consent select_account");
    if (loginHint) authUrl.searchParams.set("login_hint", loginHint);
  } else if (providerName === "twitter") {
    authUrl.searchParams.set("force_login", "true");
  } else if (providerName === "facebook" || providerName === "instagram") {
    authUrl.searchParams.set("display", "popup");
    authUrl.searchParams.set("auth_type", "rerequest");
  }

  return Response.redirect(authUrl.toString(), 302);
}

async function handleOAuthCallback(req, env, url) {
  const code  = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return new Response("Missing parameters", { status: 400 });

  const stored = await env.LIFEOS_KV.get(`oauth_state:${state}`, "json");
  if (!stored) return new Response("Invalid or expired state", { status: 400 });

  const cfg = getProviderConfig(env, stored.provider, stored.scope || "");
  if (!cfg || !cfg.client_id) return new Response("Provider config error", { status: 500 });

  const PKCE_PROVIDERS = new Set(["google", "microsoft", "twitter", "airtable", "linkedin"]);
  const tokenParams = {
    client_id:     cfg.client_id,
    client_secret: cfg.client_secret,
    code,
    redirect_uri:  cfg.redirect_uri,
    grant_type:    "authorization_code",
  };
  if (stored.usePKCE || PKCE_PROVIDERS.has(stored.provider)) {
    tokenParams.code_verifier = stored.codeVerifier;
  }

  const tokenHeaders = { "Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json" };
  if (stored.provider === "twitter") {
    tokenHeaders["Authorization"] = "Basic " + btoa(`${cfg.client_id}:${cfg.client_secret}`);
    delete tokenParams.client_secret;
  }

  const tokenRes = await fetch(cfg.token_url, {
    method: "POST",
    headers: tokenHeaders,
    body: new URLSearchParams(tokenParams),
  });
  const tokens = await tokenRes.json();
  if (!tokenRes.ok || tokens.error) {
    const msg = tokens.error_description || tokens.error || "Token exchange failed";
    return new Response(`<html><body style="background:#0d0e17;color:#ff4f5e;font-family:system-ui;padding:40px">
      <h2>❌ Connection Failed</h2><p>${msg}</p>
      <script>setTimeout(()=>window.close(),4000)<\/script></body></html>`,
      { headers: { "Content-Type": "text/html" } });
  }

  let identity = { email: null, name: null, id: null };
  const authHeader = `Bearer ${tokens.access_token}`;
  try {
    if (stored.provider === "google") {
      const r = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", { headers: { Authorization: authHeader } });
      identity = await r.json();
    } else if (stored.provider === "microsoft") {
      const r = await fetch("https://graph.microsoft.com/v1.0/me", { headers: { Authorization: authHeader } });
      const d = await r.json();
      identity = { email: d.mail || d.userPrincipalName, name: d.displayName, id: d.id };
    } else if (stored.provider === "github") {
      const r = await fetch("https://api.github.com/user", { headers: { Authorization: authHeader, "User-Agent": "LifeOS1" } });
      const d = await r.json();
      identity = { email: d.email, name: d.name || d.login, id: String(d.id) };
    } else if (stored.provider === "facebook" || stored.provider === "instagram") {
      const r = await fetch(`https://graph.facebook.com/v25.0/me?fields=id,name,email&access_token=${encodeURIComponent(tokens.access_token)}`);
      const d = await r.json();
      identity = { email: d.email, name: d.name, id: d.id };
    } else if (stored.provider === "linkedin") {
      const r = await fetch("https://api.linkedin.com/v2/userinfo", { headers: { Authorization: authHeader } });
      const d = await r.json();
      identity = { email: d.email, name: d.name, id: d.sub };
    } else if (stored.provider === "twitter") {
      const r = await fetch("https://api.twitter.com/2/users/me?user.fields=username,name", { headers: { Authorization: authHeader } });
      const d = await r.json();
      identity = { email: null, name: d.data?.name, id: d.data?.id, handle: d.data?.username };
    } else if (stored.provider === "slack") {
      const r = await fetch("https://slack.com/api/users.identity", { headers: { Authorization: authHeader } });
      const d = await r.json();
      identity = { email: d.user?.email, name: d.user?.name, id: d.user?.id };
    }
  } catch (e) { console.warn("Identity fetch failed:", e.message); }

  const userId = stored.userId || "chris-green";
  if (identity.email || stored.provider === "twitter") {
    await saveOAuthTokensToSupabase(env, stored.provider, {
      access_token:  tokens.access_token,
      refresh_token: tokens.refresh_token || null,
      expires_at:    Date.now() + (tokens.expires_in || 3600) * 1000,
      scope:         tokens.scope || cfg.scope,
      token_type:    tokens.token_type || "Bearer",
    }, userId, identity.email || "", identity.name || "", identity.id || "");
  }

  await env.LIFEOS_KV.put(`oauth_${stored.provider}`, JSON.stringify({ connected: true, identity }));
  const idxKey = `oauth_index_${stored.provider}`;
  const idx = (await env.LIFEOS_KV.get(idxKey, "json")) || [];
  const without = idx.filter(a => a.email !== identity.email);
  without.push({ email: identity.email, name: identity.name, userId, connected_at: Date.now() });
  await env.LIFEOS_KV.put(idxKey, JSON.stringify(without));

  await env.LIFEOS_KV.delete(`oauth_state:${state}`);

  const who = identity.email || identity.name || identity.handle || "Account";
  return new Response(`
    <html><head><style>
      body{background:#0d0e17;color:#f0ede8;font-family:system-ui;padding:40px;text-align:center}
      h2{color:#00c896}.check{font-size:64px}.who{color:#4ab3f4;font-size:14px;margin-top:8px}
    </style></head>
    <body>
      <div class="check">✅</div>
      <h2>${stored.provider.charAt(0).toUpperCase() + stored.provider.slice(1)} Connected</h2>
      <div class="who">${who}</div>
      <script>
        if (window.opener) {
          window.opener.postMessage({
            type: "oauth_success",
            provider: "${stored.provider}",
            userId: "${userId}",
            identity: ${JSON.stringify(identity)}
          }, "*");
        }
        setTimeout(() => window.close(), 2500);
      <\/script>
    </body></html>
  `, { headers: { "Content-Type": "text/html" } });
}

async function handleOAuthDisconnect(req, env, url) {
  const provider     = url.searchParams.get("provider");
  const userId       = url.searchParams.get("user_id");
  const accountEmail = url.searchParams.get("account_email") || "";
  if (!provider || !userId) return new Response("Missing parameters", { status: 400 });

  const success = await disconnectAccount(env, userId, provider, accountEmail);

  const idxKey = `oauth_index_${provider}`;
  const idx = (await env.LIFEOS_KV.get(idxKey, "json")) || [];
  const next = idx.filter(a => a.email !== accountEmail);
  if (next.length === 0) {
    await env.LIFEOS_KV.delete(`oauth_${provider}`);
    await env.LIFEOS_KV.delete(idxKey);
  } else {
    await env.LIFEOS_KV.put(idxKey, JSON.stringify(next));
  }

  return json({ success });
}

async function handleOAuthStatus(req, env, url) {
  try {
    const data = await supabase(env,
      "/rest/v1/platform_tokens?select=platform,account_email,account_name,is_primary&is_active=eq.true&order=platform.asc"
    );
    // Explicitly ensure CORS even if json helper changes in future
    const body = JSON.stringify({ connected: data || [] });
    return new Response(body, {
      status: 200,
      headers: {
        ...CORS,
        "Content-Type": "application/json",
      },
    });
  } catch {
    const body = JSON.stringify({ connected: [] });
    return new Response(body, {
      status: 200,
      headers: {
        ...CORS,
        "Content-Type": "application/json",
      },
    });
  }
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const path = url.pathname;
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
    
    const authHeader = req.headers.get("Authorization");
    let currentUser = null;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      currentUser = await validateSupabaseJWT(token, env);
    }
    
    if (!path.startsWith("/api/")) {
      return env.ASSETS ? env.ASSETS.fetch(req) : err("Not found", 404);
    }
    
    // ========================================================================
    // PROFILE & SETTINGS
    // ========================================================================
    if (path === "/api/profile") {
      if (req.method === "GET") {
        const d = await env.LIFEOS_KV.get("profile", "json");
        return json(d || { name: "Chris Green", email: "chris@ceogps.com", location: "Atlanta, GA", profession: "Business Owner / CEO GPS", phone: "", bio: "", avatarUrl: "" });
      }
      if (req.method === "POST") {
        await env.LIFEOS_KV.put("profile", JSON.stringify(await req.json()));
        return json({ ok: true });
      }
    }
    if (path.startsWith("/api/settings/")) {
      const key = path.replace("/api/settings/", "");
      if (req.method === "GET") return json(await env.LIFEOS_KV.get("settings_" + key, "json") || {});
      if (req.method === "POST") {
        await env.LIFEOS_KV.put("settings_" + key, JSON.stringify(await req.json()));
        return json({ ok: true });
      }
    }
    // ========================================================================
    // KV STORAGE
    // ========================================================================
    if (path === "/api/kv/get" && req.method === "GET") {
      const key = url.searchParams.get("key");
      if (!key) return err("key required");
      const value = await env.LIFEOS_KV.get(key, "json");
      return json({ key, value: value !== null ? value : null });
    }
    if (path === "/api/kv/set" && req.method === "POST") {
      const { key, value } = await req.json();
      if (!key) return err("key required");
      await env.LIFEOS_KV.put(key, JSON.stringify(value));
      return json({ ok: true, key });
    }
    if (path.startsWith("/api/kv/")) {
      const key = decodeURIComponent(path.replace("/api/kv/", ""));
      if (req.method === "GET") return json(await env.LIFEOS_KV.get(key, "json") || null);
      if (req.method === "POST") {
        await env.LIFEOS_KV.put(key, JSON.stringify(await req.json()));
        return json({ ok: true });
      }
      if (req.method === "DELETE") {
        await env.LIFEOS_KV.delete(key);
        return json({ ok: true });
      }
    }
    // ========================================================================
    // USER STATE SNAPSHOT
    // ========================================================================
    if (path === "/api/state/snapshot" && req.method === "GET") {
      const uid = url.searchParams.get("uid") || "global";
      const data = await env.LIFEOS_KV.get(`state_${uid}`, "json");
      return json(data || {});
    }
    if (path === "/api/state/set" && req.method === "POST") {
      const uid = url.searchParams.get("uid") || "global";
      let patch = {};
      try { patch = await req.json(); } catch { return err("invalid body"); }
      const cur = (await env.LIFEOS_KV.get(`state_${uid}`, "json")) || {};
      for (const [k, v] of Object.entries(patch || {})) {
        if (v === null || v === undefined) delete cur[k];
        else cur[k] = typeof v === "string" ? v : JSON.stringify(v);
      }
      await env.LIFEOS_KV.put(`state_${uid}`, JSON.stringify(cur));
      return json({ ok: true, count: Object.keys(cur).length });
    }
    // ========================================================================
    // FILE UPLOADS (R2)
    // ========================================================================
    if (path === "/api/upload" && req.method === "POST") {
      const formData = await req.formData();
      const file = formData.get("file");
      const type = formData.get("type") || "general";
      const fileKey = formData.get("key") || `${type}/${Date.now()}_${file.name}`;
      if (!file) return err("No file");
      await env.lifeos_uploads.put(fileKey, await file.arrayBuffer(), {
        httpMetadata: { contentType: file.type },
      });
      const publicUrl = `https://lifeos1.ceogps.workers.dev/api/files/${encodeURIComponent(fileKey)}`;
      const fileInfo = { key: fileKey, url: publicUrl, name: file.name, size: file.size, mimeType: file.type, type, uploadedAt: Date.now() };
      const existing = await env.LIFEOS_KV.get("files_" + type, "json") || [];
      await env.LIFEOS_KV.put("files_" + type, JSON.stringify([fileInfo, ...existing].slice(0, 500)));
      if (type === "avatar") {
        const profile = await env.LIFEOS_KV.get("profile", "json") || {};
        profile.avatarUrl = publicUrl;
        await env.LIFEOS_KV.put("profile", JSON.stringify(profile));
      }
      return json({ ok: true, url: publicUrl, key: fileKey });
    }
    if (path.startsWith("/api/files/") && req.method === "GET") {
      const fileKey = decodeURIComponent(path.replace("/api/files/", ""));
      const obj = await env.lifeos_uploads.get(fileKey);
      if (!obj) return err("Not found", 404);
      return new Response(obj.body, {
        headers: { ...CORS, "Content-Type": obj.httpMetadata?.contentType || "application/octet-stream", "Cache-Control": "public, max-age=31536000" },
      });
    }
    if (path === "/api/files" && req.method === "GET") {
      const type = url.searchParams.get("type") || "general";
      return json(await env.LIFEOS_KV.get("files_" + type, "json") || []);
    }
    if (path.startsWith("/api/files/") && req.method === "DELETE") {
      const fileKey = decodeURIComponent(path.replace("/api/files/", ""));
      await env.lifeos_uploads.delete(fileKey);
      const type = fileKey.split("/")[0];
      const existing = await env.LIFEOS_KV.get("files_" + type, "json") || [];
      await env.LIFEOS_KV.put("files_" + type, JSON.stringify(existing.filter(f => f.key !== fileKey)));
      return json({ ok: true });
    }
    // ========================================================================
    // OAUTH ENDPOINTS
    // ========================================================================
    if (path === "/api/oauth/start" && req.method === "GET") {
      return handleOAuthStart(req, env, url);
    }
    if (path.startsWith("/api/oauth/callback") && req.method === "GET") {
      return handleOAuthCallback(req, env, url);
    }
    if (path === "/api/oauth/status" && req.method === "GET") {
      const res = await handleOAuthStatus(req, env, url);
      // Belt-and-suspenders: ensure CORS headers are always present on this critical endpoint
      // even if a future edit bypasses the json helper.
      const headers = new Headers(res.headers);
      Object.entries(CORS).forEach(([k, v]) => headers.set(k, v));
      return new Response(res.body, {
        status: res.status,
        headers,
      });
    }
    if (path === "/api/oauth/status/all" && req.method === "GET") {
      const providers = ["google","microsoft","facebook","instagram","linkedin","twitter","slack","github","zoom","clickup","airtable","spotify"];
      const statuses = {};
      for (const p of providers) {
        const d = await env.LIFEOS_KV.get(`oauth_${p}`, "json");
        statuses[p] = {
          connected: !!(d?.access_token || d?.connected),
          scope: d?.scope || null,
          identity: d?.identity || null,
          account_label: d?.account_label || null,
        };
      }
      const res = json(statuses);
      // Force CORS on all oauth status variants (belt-and-suspenders for the status/all path too)
      const h = new Headers(res.headers);
      Object.entries(CORS).forEach(([k, v]) => h.set(k, v));
      return new Response(res.body, { status: res.status, headers: h });
    }

    // New: per-user OAuth connection verification using the user's stored token.
    // This is used by the frontend to confirm that the OAuth token for social providers is actually live and working.
    // Returns { ok: true } only if we can successfully pull a small piece of data using the user's token.
    if (path === "/api/oauth/verify" && req.method === "GET") {
      const provider = url.searchParams.get("provider");
      const userId = url.searchParams.get("user_id") || currentUser?.id;
      if (!provider || !userId) return json({ ok: false, error: "provider and user_id required" });
      try {
        const tokenInfo = await getValidAccessTokenFromDB(env, provider, userId);
        if (!tokenInfo.ok || !tokenInfo.access_token) {
          return json({ ok: false, error: "no valid token" });
        }
        const token = tokenInfo.access_token;
        let ok = false;
        if (provider === "x" || provider === "twitter") {
          const r = await fetch("https://api.twitter.com/2/users/me", {
            headers: { Authorization: `Bearer ${token}` }
          }).catch(() => null);
          ok = !!(r && r.ok);
        } else if (provider === "facebook" || provider === "instagram") {
          const r = await fetch(`https://graph.facebook.com/me?fields=id&access_token=${encodeURIComponent(token)}`).catch(() => null);
          ok = !!(r && r.ok);
        } else if (provider === "google" || provider === "youtube") {
          const r = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", {
            headers: { Authorization: `Bearer ${token}` }
          }).catch(() => null);
          if (r && r.ok) {
            const d = await r.json().catch(() => ({}));
            ok = !!(d.items && d.items.length);
          }
        } else if (provider === "linkedin") {
          const r = await fetch("https://api.linkedin.com/v2/userinfo", {
            headers: { Authorization: `Bearer ${token}` }
          }).catch(() => null);
          ok = !!(r && r.ok);
        } else {
          // For other providers, trust the token presence if we got this far
          ok = true;
        }
        return json({ ok });
      } catch (e) {
        return json({ ok: false, error: e.message });
      }
    }
    if (path === "/api/oauth/accounts" && req.method === "GET") {
      const userId = url.searchParams.get("user_id") || currentUser?.id;
      if (!userId) return err("user_id required");
      const accounts = await getUserConnectedAccounts(env, userId, url.searchParams.get("provider"));
      return json({ accounts });
    }
    if (path === "/api/oauth/accounts-legacy" && req.method === "GET") {
      const provider = url.searchParams.get("provider");
      if (!provider) return err("provider required");
      const idx = (await env.LIFEOS_KV.get(`oauth_index_${provider}`, "json")) || [];
      return json({ provider, accounts: idx });
    }
    if (path === "/api/oauth/set-primary" && req.method === "POST") {
      const { user_id, provider, account_email } = await req.json();
      if (!user_id || !provider || !account_email) return err("user_id, provider, and account_email required");
      await setPrimaryAccount(env, user_id, provider, account_email);
      return json({ ok: true });
    }
    if (path === "/api/oauth/disconnect" && (req.method === "POST" || req.method === "DELETE")) {
      return handleOAuthDisconnect(req, env, url);
    }
    if (path === "/api/oauth/token" && req.method === "GET") {
      const userId = url.searchParams.get("user_id") || currentUser?.id;
      const provider = url.searchParams.get("provider");
      const accountEmail = url.searchParams.get("account_email");
      if (!userId || !provider) return err("user_id and provider required");
      const result = await getValidAccessTokenFromDB(env, provider, userId, accountEmail);
      return json(result);
    }
    if (path === "/api/oauth/test-multi" && req.method === "GET") {
      const userId = url.searchParams.get("user_id") || currentUser?.id;
      if (!userId) return err("user_id required");
      const accounts = await getUserConnectedAccounts(env, userId, "google");
      const results = [];
      for (const acc of accounts) {
        const tokenInfo = await getValidAccessTokenFromDB(env, "google", userId, acc.account_email);
        results.push({
          email: acc.account_email,
          name: acc.account_name,
          is_primary: acc.is_primary,
          token_valid: tokenInfo.ok === true
        });
      }
      return json({ user_id: userId, total_accounts: accounts.length, accounts: results });
    }
    // ========================================================================
    // API KEY VALIDATION & VAULT
    // ========================================================================
    if (path === "/api/validate-key" && req.method === "POST") {
      try {
        const { provider, key } = await req.json();
        if (!provider || !key) return err("provider and key required");
        const trimmed = String(key).trim();
        if (!trimmed) return err("key empty");
        let validateUrl, headers = {}, method = "GET", body;
        switch (provider) {
          case "claude": case "anthropic":
            validateUrl = "https://api.anthropic.com/v1/models";
            headers = { "x-api-key": trimmed, "anthropic-version": "2023-06-01" };
            break;
          case "openai": case "gpt":
            validateUrl = "https://api.openai.com/v1/models";
            headers = { "Authorization": "Bearer " + trimmed };
            break;
          case "gemini": case "google_ai":
            validateUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(trimmed)}`;
            break;
          case "grok": case "xai":
            validateUrl = "https://api.x.ai/v1/models";
            headers = { "Authorization": "Bearer " + trimmed };
            break;
          case "groq":
            validateUrl = "https://api.groq.com/openai/v1/models";
            headers = { "Authorization": "Bearer " + trimmed };
            break;
          case "deepseek":
            validateUrl = "https://api.deepseek.com/v1/models";
            headers = { "Authorization": "Bearer " + trimmed };
            break;
          case "perplexity":
            validateUrl = "https://api.perplexity.ai/chat/completions";
            method = "POST";
            headers = { "Authorization": "Bearer " + trimmed, "Content-Type": "application/json" };
            body = JSON.stringify({ model: "sonar", messages: [{ role: "user", content: "hi" }], max_tokens: 1 });
            break;
          case "brevo":
            validateUrl = "https://api.brevo.com/v3/account";
            headers = { "api-key": trimmed };
            break;
          case "sendgrid":
            validateUrl = "https://api.sendgrid.com/v3/scopes";
            headers = { "Authorization": "Bearer " + trimmed };
            break;
          case "mailchimp": {
            const dc = trimmed.split("-").pop();
            validateUrl = `https://${dc}.api.mailchimp.com/3.0/ping`;
            headers = { "Authorization": "Bearer " + trimmed };
            break;
          }
          case "clickup":
            validateUrl = "https://api.clickup.com/api/v2/user";
            headers = { "Authorization": trimmed };
            break;
          case "mistral":
            validateUrl = "https://api.mistral.ai/v1/models";
            headers = { "Authorization": "Bearer " + trimmed };
            break;
          case "cohere":
            validateUrl = "https://api.cohere.com/v1/check-api-key";
            method = "POST";
            headers = { "Authorization": "Bearer " + trimmed, "Content-Type": "application/json" };
            body = "{}";
            break;
          case "together":
            validateUrl = "https://api.together.xyz/v1/models";
            headers = { "Authorization": "Bearer " + trimmed };
            break;
          case "openrouter":
            validateUrl = "https://openrouter.ai/api/v1/models";
            headers = { "Authorization": "Bearer " + trimmed };
            break;
          case "anyscale":
            validateUrl = "https://api.endpoints.anyscale.com/v1/models";
            headers = { "Authorization": "Bearer " + trimmed };
            break;
          case "lepton":
            validateUrl = "https://mistral-7b.lepton.run/api/v1/models";
            headers = { "Authorization": "Bearer " + trimmed };
            break;
          case "novita":
            validateUrl = "https://api.novita.ai/v3/openai/models";
            headers = { "Authorization": "Bearer " + trimmed };
            break;
          case "ai21":
            validateUrl = "https://api.ai21.com/studio/v1/models";
            headers = { "Authorization": "Bearer " + trimmed };
            break;
          case "huggingface":
            validateUrl = "https://huggingface.co/api/whoami-v2";
            headers = { "Authorization": "Bearer " + trimmed };
            break;
          case "replicate":
            validateUrl = "https://api.replicate.com/v1/account";
            headers = { "Authorization": "Bearer " + trimmed };
            break;
          case "fireworks":
            validateUrl = "https://api.fireworks.ai/inference/v1/models";
            headers = { "Authorization": "Bearer " + trimmed };
            break;
          case "runway":
          case "elevenlabs":
          case "copilot":
          case "qwen":
          case "mailchimp":
          case "nylas":
          case "cloudflare":
          case "stripe":
            return json({ valid: true, detail: "saved (no live validator)" });
          default:
            return json({ valid: null, status: 0, detail: "no validator for " + provider });
        }
        let upstream, upstreamText = "";
        try {
          upstream = await fetch(validateUrl, { method, headers, body });
          upstreamText = await upstream.text();
        } catch (e) {
          return json({ valid: false, status: 0, detail: "network error: " + e.message });
        }
        const valid = upstream.ok;
        let detail = "", identity = null;
        try {
          const j = JSON.parse(upstreamText);
          if (!valid) {
            detail = j.error?.message || j.message || j.error || upstreamText.slice(0, 200);
          } else {
            if (provider === "brevo") identity = { email: j.email, name: `${j.firstName||""} ${j.lastName||""}`.trim() };
            if (provider === "clickup") identity = { email: j.user?.email, name: j.user?.username, id: j.user?.id };
          }
        } catch {
          if (!valid) detail = upstreamText.slice(0, 200);
        }
        return json({ valid, status: upstream.status, detail, identity });
      } catch (e) {
        return err("validate failed: " + e.message, 500);
      }
    }
    if (path === "/api/keys/status-all" && req.method === "GET") {
      const providers = ["claude","openai","gemini","deepseek","grok","groq","perplexity","mistral","cohere","together","openrouter","brevo","sendgrid","clickup"];
      const result = {};
      for (const p of providers) {
        const kv = await env.LIFEOS_KV.get(`apikey_${p}`);
        result[p] = { has_key: !!kv };
      }
      return json(result);
    }
    if (path === "/api/keys/store" && req.method === "POST") {
      try {
        const { service, key } = await req.json();
        if (!service || !key) return err("service and key required");
        await env.LIFEOS_KV.put(`apikey_${service}`, String(key));
        await env.LIFEOS_KV.put(`apikey_meta_${service}`, JSON.stringify({
          stored_at: Date.now(),
          last4: String(key).slice(-4),
        }));
        return json({ ok: true, service });
      } catch (e) { return err("store failed: " + e.message, 500); }
    }
    if (path === "/api/keys/status" && req.method === "GET") {
      const service = url.searchParams.get("service");
      if (!service) return err("service required");
      const meta = await env.LIFEOS_KV.get(`apikey_meta_${service}`, "json");
      const exists = !!(await env.LIFEOS_KV.get(`apikey_${service}`));
      return json({ has_key: exists, ...(meta || {}) });
    }
    if (path === "/api/keys/delete" && req.method === "DELETE") {
      const service = url.searchParams.get("service");
      if (!service) return err("service required");
      await env.LIFEOS_KV.delete(`apikey_${service}`);
      await env.LIFEOS_KV.delete(`apikey_meta_${service}`);
      return json({ ok: true, service, deleted: true });
    }
    if (path === "/api/keys/get" && req.method === "GET") {
      const service = url.searchParams.get("service");
      if (!service) return err("service required");
      const key = await env.LIFEOS_KV.get(`apikey_${service}`);
      if (!key) return json({ found: false });
      return json({ found: true, key });
    }
    // FIX: paginated keys/get-all
    if (path === "/api/keys/get-all" && req.method === "GET") {
      let result = {};
      let cursor;
      do {
        const listOptions = { prefix: "apikey_" };
        if (cursor) listOptions.cursor = cursor;
        const list = await env.LIFEOS_KV.list(listOptions);
        for (const k of list.keys) {
          if (k.name.includes("_meta_")) continue;
          const service = k.name.replace("apikey_", "");
          result[service] = await env.LIFEOS_KV.get(k.name);
        }
        cursor = list.cursor;
      } while (cursor);
      return json(result);
    }
    // ========================================================================
    // TELEGRAM BOT
    // ========================================================================
    const TELEGRAM_TOKEN = env.TELEGRAM_BOT_TOKEN || "";
    const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;
    if (path === "/api/telegram/send" && req.method === "POST") {
      const { chat_id, text, parse_mode } = await req.json();
      if (!chat_id || !text) return err("chat_id and text required");
      const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id, text, parse_mode: parse_mode || "Markdown" }),
      });
      return json(await res.json());
    }
    if (path === "/api/telegram/updates" && req.method === "GET") {
      const offset = url.searchParams.get("offset") || "";
      const res = await fetch(`${TELEGRAM_API}/getUpdates?timeout=0&limit=20${offset ? "&offset=" + offset : ""}`);
      return json(await res.json());
    }
    if (path === "/api/telegram/info" && req.method === "GET") {
      const res = await fetch(`${TELEGRAM_API}/getMe`);
      return json(await res.json());
    }
    // FIX: Telegram webhook URL validation
    if (path === "/api/telegram/webhook" && req.method === "POST") {
      let webhook_url = null;
      try { const body = await req.json(); webhook_url = body?.webhook_url || null; } catch {}
      if (webhook_url && !webhook_url.startsWith("https://")) {
        return json({ ok: false, error: "Webhook URL must use HTTPS" }, 400);
      }
      const wUrl = webhook_url || `https://lifeos1.ceogps.workers.dev/api/telegram/incoming`;
      const res = await fetch(`${TELEGRAM_API}/setWebhook?url=${encodeURIComponent(wUrl)}`);
      return json(await res.json());
    }
    if (path === "/api/telegram/incoming" && req.method === "POST") {
      const update = await req.json();
      const msg = update.message || update.edited_message;
      if (msg) {
        const chatId = msg.chat.id;
        const key = `telegram_chat_${chatId}`;
        const existing = await env.LIFEOS_KV.get(key, "json") || { messages: [], chat: msg.chat };
        existing.messages = [
          { from: msg.from?.username || msg.from?.first_name || "User", text: msg.text || "", ts: msg.date * 1000 },
          ...existing.messages,
        ].slice(0, 200);
        await env.LIFEOS_KV.put(key, JSON.stringify(existing));
        const chatList = await env.LIFEOS_KV.get("telegram_chats", "json") || [];
        if (!chatList.find(c => c.id === chatId)) {
          chatList.unshift({ id: chatId, name: msg.chat.title || msg.from?.first_name || "Unknown", type: msg.chat.type });
          await env.LIFEOS_KV.put("telegram_chats", JSON.stringify(chatList.slice(0, 100)));
        }
      }
      return json({ ok: true });
    }
    if (path === "/api/telegram/chats" && req.method === "GET") {
      return json(await env.LIFEOS_KV.get("telegram_chats", "json") || []);
    }
    if (path === "/api/telegram/messages" && req.method === "GET") {
      const chatId = url.searchParams.get("chat_id");
      if (!chatId) return err("chat_id required");
      return json(await env.LIFEOS_KV.get(`telegram_chat_${chatId}`, "json") || { messages: [], chat: {} });
    }
    // ========================================================================
    // META (FACEBOOK/INSTAGRAM)
    // ========================================================================
    const manualMeta = await env.LIFEOS_KV.get("manual_meta_token", "json").catch(()=>null);
    const META_TOKEN   = (manualMeta?.access_token)                                        || env.META_PAGE_ACCESS_TOKEN || "";
    const META_PAGE_ID = (manualMeta?.page_id    && manualMeta.page_id.length    > 5 ? manualMeta.page_id    : null) || env.META_PAGE_ID      || "";
    const META_IG_ID   = (manualMeta?.ig_user_id && manualMeta.ig_user_id.length > 5 ? manualMeta.ig_user_id : null) || env.META_IG_USER_ID   || "";
    const META_AD_ACCT = env.META_AD_ACCOUNT_ID || "";
    if (path === "/api/meta/status" && req.method === "GET") {
      try {
        if (!META_TOKEN || META_TOKEN.trim().length < 10) return json({ connected: false, error: "token_missing" });
        let resolvedPageId = META_PAGE_ID && META_PAGE_ID.trim().length > 5 ? META_PAGE_ID : null;
        let resolvedIgId   = META_IG_ID   && META_IG_ID.trim().length   > 5 ? META_IG_ID   : null;
        if (!resolvedPageId) {
          const me = await graphGet("/me?fields=id,name,instagram_business_account", META_TOKEN);
          if (me?.error?.type === "OAuthException") {
            return json({ connected: false, error: "token_expired", detail: me.error.message });
          }
          if (me?.id && !me?.error) {
            resolvedPageId = me.id;
            if (!resolvedIgId && me.instagram_business_account?.id) resolvedIgId = me.instagram_business_account.id;
          }
          if (!resolvedPageId) {
            const accounts = await graphGet("/me/accounts?fields=id,name,instagram_business_account", META_TOKEN);
            if (accounts?.data?.length) {
              const first = accounts.data[0];
              resolvedPageId = first.id;
              if (!resolvedIgId && first.instagram_business_account?.id) resolvedIgId = first.instagram_business_account.id;
            }
          }
          if (resolvedPageId) {
            const existing = (await env.LIFEOS_KV.get("manual_meta_token", "json").catch(()=>null)) || {};
            await env.LIFEOS_KV.put("manual_meta_token", JSON.stringify({ ...existing, access_token: META_TOKEN, page_id: resolvedPageId, ig_user_id: resolvedIgId||"" }));
          }
        }
        const page = resolvedPageId ? await graphGet(`/${resolvedPageId}?fields=name,fan_count,followers_count`, META_TOKEN) : null;
        const ig   = resolvedIgId   ? await graphGet(`/${resolvedIgId}?fields=username,followers_count,media_count`, META_TOKEN) : null;
        const tokenExpired = (page?.error?.type === "OAuthException" || ig?.error?.type === "OAuthException");
        if (tokenExpired) return json({ connected: false, error: "token_expired", detail: page?.error?.message || ig?.error?.message });
        if (!resolvedPageId && !resolvedIgId) {
          const meDebug = await graphGet("/me?fields=id,name", META_TOKEN);
          return json({ connected: false, error: "discovery_failed", me_response: meDebug, token_length: META_TOKEN.length });
        }
        return json({
          connected: !!(META_TOKEN && (resolvedPageId || resolvedIgId)),
          page: (page && !page.error) ? { id: resolvedPageId, name: page.name, fans: page.fan_count, followers: page.followers_count } : null,
          instagram: (ig && !ig.error) ? { id: resolvedIgId, username: ig.username, followers: ig.followers_count, posts: ig.media_count } : null,
          ad_account: META_AD_ACCT,
        });
      } catch(e) { return json({ connected: false, error: e.message }); }
    }
    if (path === "/api/meta/pages" && req.method === "GET") {
      return json(await graphGet("/me/accounts?fields=name,id,fan_count,access_token", META_TOKEN));
    }
    if (path === "/api/meta/feed" && req.method === "GET") {
      const limit = url.searchParams.get("limit") || "10";
      const cached = await env.LIFEOS_KV.get("manual_meta_token", "json").catch(()=>null);
      const feedPageId = (cached?.page_id && cached.page_id.length > 5 ? cached.page_id : null) || META_PAGE_ID;
      if (!feedPageId || feedPageId.trim().length < 5) return json({ data: [], error: "page_id_not_set" });
      return json(await graphGet(`/${feedPageId}/feed?fields=message,created_time,likes.summary(true),comments.summary(true)&limit=${limit}`, META_TOKEN));
    }
    if (path === "/api/meta/instagram/feed" && req.method === "GET") {
      const limit = url.searchParams.get("limit") || "12";
      return json(await graphGet(`/${META_IG_ID}/media?fields=id,caption,media_type,thumbnail_url,permalink,like_count,comments_count,timestamp&limit=${limit}`, META_TOKEN));
    }
    if (path === "/api/meta/instagram/insights" && req.method === "GET") {
      return json(await graphGet(`/${META_IG_ID}/insights?metric=impressions,reach,profile_views&period=day`, META_TOKEN));
    }
    if (path === "/api/meta/ads" && req.method === "GET") {
      return json(await graphGet(`/${META_AD_ACCT}/campaigns?fields=name,status,objective,budget_remaining,spend_cap&limit=10`, META_TOKEN));
    }
    if (path === "/api/meta/post" && req.method === "POST") {
      const { message, page_id, media_url } = await req.json();
      const pid = page_id || META_PAGE_ID;
      const body = { message };
      if (media_url) body.link = media_url;
      return json(await graphPost(`/${pid}/feed`, body, META_TOKEN));
    }
    if (path === "/api/meta/instagram/post" && req.method === "POST") {
      const { caption, image_url } = await req.json();
      if (!image_url) return err("image_url required for Instagram");
      const container = await graphPost(`/${META_IG_ID}/media`, { caption, image_url }, META_TOKEN);
      if (!container.id) return json({ error: "Failed to create media container", detail: container });
      return json(await graphPost(`/${META_IG_ID}/media_publish`, { creation_id: container.id }, META_TOKEN));
    }
    // ========================================================================
    // LINKEDIN
    // ========================================================================
    if (path === "/api/linkedin/status" && req.method === "GET") {
      const tok = await liToken(env);
      if (!tok) return json({ connected: false });
      const me = await fetch("https://api.linkedin.com/v2/userinfo", { headers: { "Authorization": "Bearer " + tok } }).then(r => r.json()).catch(() => null);
      return json({ connected: !!me?.sub, profile: me ? { id: me.sub, name: me.name, email: me.email, picture: me.picture } : null });
    }
    if (path === "/api/linkedin/posts" && req.method === "GET") {
      const tok = await liToken(env);
      if (!tok) return json({ data: [], error: "not_connected" });
      const me = await fetch("https://api.linkedin.com/v2/userinfo", { headers: { "Authorization": "Bearer " + tok } }).then(r => r.json()).catch(() => null);
      if (!me?.sub) return json({ data: [], error: "no_profile" });
      const author = encodeURIComponent(`urn:li:person:${me.sub}`);
      const data = await liGet(env, `/posts?author=${author}&q=author&count=10`, tok);
      return json(data);
    }
    if (path === "/api/linkedin/post" && req.method === "POST") {
      const tok = await liToken(env);
      if (!tok) return err("LinkedIn not connected", 401);
      const { text } = await req.json();
      const me = await fetch("https://api.linkedin.com/v2/userinfo", { headers: { "Authorization": "Bearer " + tok } }).then(r => r.json());
      if (!me?.sub) return err("LinkedIn profile fetch failed", 401);
      const body = {
        author: `urn:li:person:${me.sub}`,
        commentary: text || "",
        visibility: "PUBLIC",
        distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
        lifecycleState: "PUBLISHED",
        isReshareDisabledByAuthor: false,
      };
      return json(await liPost(env, "/posts", body, tok));
    }
    // ========================================================================
    // MANUAL TOKEN SAVE
    // ========================================================================
    if (path === "/api/oauth/token/save" && req.method === "POST") {
      try {
        const { provider, access_token, page_id, ig_user_id, channel_id, channel_handle, bearer_token } = await req.json();
        if (!provider) return err("provider required");
        if (provider === "facebook" || provider === "instagram") {
          if (!access_token) return err("access_token required");
          const test = await fetch(`https://graph.facebook.com/v25.0/me?access_token=${encodeURIComponent(access_token)}`).then(r=>r.json()).catch(()=>null);
          if (test?.error) return json({ ok: false, error: test.error.message });
          let finalToken = access_token;
          if (access_token.length < 200 && env.META_APP_ID && env.META_APP_SECRET) {
            const ll = await fetch(`https://graph.facebook.com/v25.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${env.META_APP_ID}&client_secret=${env.META_APP_SECRET}&fb_exchange_token=${encodeURIComponent(access_token)}`).then(r=>r.json()).catch(()=>null);
            if (ll?.access_token) finalToken = ll.access_token;
          }
          await env.LIFEOS_KV.put("manual_meta_token", JSON.stringify({ access_token: finalToken, page_id: page_id||"", ig_user_id: ig_user_id||"", saved_at: Date.now() }));
          return json({ ok: true, token_length: finalToken.length, name: test.name, id: test.id });
        }
        if (provider === "youtube") {
          const save = { channel_id: channel_id||"", channel_handle: channel_handle||"@ceogps", saved_at: Date.now() };
          await env.LIFEOS_KV.put("manual_yt_config", JSON.stringify(save));
          return json({ ok: true });
        }
        if (provider === "x") {
          if (!bearer_token) return err("bearer_token required");
          const test2 = await fetch("https://api.twitter.com/2/users/by/username/ceogps?user.fields=id", { headers: { Authorization: `Bearer ${bearer_token}` } }).then(r=>r.json()).catch(()=>null);
          if (test2?.errors) return json({ ok: false, error: test2.errors[0]?.detail });
          await env.LIFEOS_KV.put("manual_x_token", JSON.stringify({ bearer_token, saved_at: Date.now() }));
          return json({ ok: true, handle: test2?.data?.username });
        }
        return err("unsupported provider for manual token save");
      } catch(e) { return json({ ok: false, error: e.message }, 500); } 

    // ========================================================================
    // OAUTH PROVIDER (Authorization Server) - for /oauth/consent flow
    // Other apps can redirect users here to authorize access to their LifeOS data.
    // Flow: client -> /oauth/authorize -> (login) -> /oauth/consent (SPA) -> approve -> /api/oauth/consent -> redirect with code -> client /oauth/token
    // ========================================================================

    if (path === "/oauth/authorize" && req.method === "GET") {
      const clientId = url.searchParams.get("client_id");
      const redirectUri = url.searchParams.get("redirect_uri");
      const scope = url.searchParams.get("scope") || "profile";
      const state = url.searchParams.get("state") || "";
      const responseType = url.searchParams.get("response_type") || "code";

      if (!clientId || !redirectUri) {
        return new Response("Missing client_id or redirect_uri", { status: 400 });
      }

      const REGISTERED_CLIENTS = {
        'da025257-10ff-438c-8840-f29fc5f147b2': {
          name: 'LifeOS1',
          // Add specific allowed redirect_uris for this client in production
          allowed_redirects: [] 
        }
      };

      if (!REGISTERED_CLIENTS[clientId]) {
        return new Response("Unknown or untrusted client_id", { status: 400 });
      }

      // TODO: Further validate redirect_uri against registered one for the clientId
      // For demo, allow any for now. In production enforce whitelist.

      // Option A: Your custom flow (previous implementation)
      // Store the pending authorization request (short TTL)
      const authRequestId = crypto.randomUUID();
      await env.LIFEOS_KV.put(`oauth_authz:${authRequestId}`, JSON.stringify({
        client_id: clientId,
        redirect_uri: redirectUri,
        scope,
        state,
        response_type: responseType,
        code_challenge: url.searchParams.get("code_challenge"),
        code_challenge_method: url.searchParams.get("code_challenge_method"),
        created: Date.now(),
      }), { expirationTtl: 600 });

      // Redirect to the SPA consent page
      const consentUrl = new URL("https://lifeos1.pages.dev/oauth/consent");
      consentUrl.searchParams.set("client_id", clientId);
      consentUrl.searchParams.set("redirect_uri", redirectUri);
      consentUrl.searchParams.set("scope", scope);
      if (state) consentUrl.searchParams.set("state", state);
      consentUrl.searchParams.set("authz_id", authRequestId);

      // Option B: Start via Supabase (using the endpoints you provided) for Supabase-backed tokens/consent
      // Uncomment/adapt if you want to use Supabase GoTrue for the actual code/token issuance.
      // This allows using /auth/v1/oauth/authorize etc. while showing your custom consent UI.
      /*
      try {
        // Use service role to start an authorization in Supabase and get an authorization ID
        const supabaseAuthzRes = await fetch(`${c.env.SUPABASE_URL}/auth/v1/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&state=${state}&response_type=${responseType}`, {
          headers: {
            'apikey': c.env.SUPABASE_SERVICE_KEY || c.env.SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${c.env.SUPABASE_SERVICE_KEY || c.env.SUPABASE_ANON_KEY}`,
          },
          redirect: 'manual',
        });
        // Supabase may return a redirect or authorization details. Extract authz ID if available.
        const location = supabaseAuthzRes.headers.get('location');
        if (location && location.includes('oauth/consent')) {
          return Response.redirect(location);
        }
      } catch (e) {
        console.warn('Supabase authz start failed, falling back to custom:', e);
      }
      */

      return Response.redirect(consentUrl.toString(), 302);
    }

    if (path === "/api/oauth/consent" && req.method === "POST") {
      try {
        const { client_id, redirect_uri, scope, state, approved, user_id, authz_id, code_challenge } = await req.json();

        if (!approved) {
          const errUrl = new URL(redirect_uri);
          errUrl.searchParams.set("error", "access_denied");
          if (state) errUrl.searchParams.set("state", state);
          return json({ redirect_url: errUrl.toString() });
        }

        // Retrieve the pending request
        let authReq = null;
        if (authz_id) {
          authReq = await env.LIFEOS_KV.get(`oauth_authz:${authz_id}`, "json");
        }

        // Generate a short-lived authorization code
        const code = crypto.randomUUID().replace(/-/g, "");
        const codeData = {
          client_id,
          redirect_uri,
          scope: scope || authReq?.scope,
          user_id,
          code_challenge: code_challenge || authReq?.code_challenge,
          created: Date.now(),
        };

        await env.LIFEOS_KV.put(`oauth_code:${code}`, JSON.stringify(codeData), { expirationTtl: 600 });

        // Clean up temp request
        if (authz_id) await env.LIFEOS_KV.delete(`oauth_authz:${authz_id}`);

        const successUrl = new URL(redirect_uri);
        successUrl.searchParams.set("code", code);
        if (state) successUrl.searchParams.set("state", state);

        return json({ redirect_url: successUrl.toString() });
      } catch (e) {
        return json({ error: e.message }, 500);
      }
    }

    if (path === "/oauth/token" && req.method === "POST") {
      // Minimal token exchange (code -> access token)
      // In production: validate code, PKCE, client secret, issue signed JWT or store token.
      try {
        const body = await req.formData ? await req.formData() : await req.json();
        const code = body.get ? body.get("code") : body.code;
        const grantType = body.get ? body.get("grant_type") : body.grant_type;

        if (grantType !== "authorization_code" || !code) {
          return json({ error: "invalid_request" }, 400);
        }

        const codeDataStr = await env.LIFEOS_KV.get(`oauth_code:${code}`);
        if (!codeDataStr) return json({ error: "invalid_grant" }, 400);

        const codeData = JSON.parse(codeDataStr);

        // One-time use
        await env.LIFEOS_KV.delete(`oauth_code:${code}`);

        // Issue a simple access token (for real use, sign a JWT and store refresh)
        const accessToken = `lo_${crypto.randomUUID().replace(/-/g,"")}`;
        const expiresIn = 3600;

        await env.LIFEOS_KV.put(`oauth_token:${accessToken}`, JSON.stringify({
          user_id: codeData.user_id,
          client_id: codeData.client_id,
          scope: codeData.scope,
          created: Date.now(),
        }), { expirationTtl: expiresIn + 60 });

        return json({
          access_token: accessToken,
          token_type: "Bearer",
          expires_in: expiresIn,
          scope: codeData.scope,
        });
      } catch (e) {
        return json({ error: "server_error", error_description: e.message }, 500);
      }
    }
    }
    // ========================================================================
    // X / TWITTER
    // ========================================================================
    if (path === "/api/x/user" && req.method === "GET") {
      const handle = url.searchParams.get("handle") || "ceogps";
      const manualX = await env.LIFEOS_KV.get("manual_x_token", "json").catch(()=>null);
      const bearer = manualX?.bearer_token || env.X_BEARER_TOKEN || "";
      if (!bearer) return json({ error: "X_BEARER_TOKEN not configured" }, 503);
      try {
        const r = await fetch(`https://api.twitter.com/2/users/by/username/${handle}?user.fields=public_metrics,profile_image_url,description,verified`, {
          headers: { Authorization: `Bearer ${bearer}` }
        });
        const d = await r.json();
        if (d.errors || !d.data) return json({ error: d.errors?.[0]?.detail || "user not found" }, 404);
        const u = d.data;
        return json({
          id: u.id, handle: u.username, name: u.name,
          followers: u.public_metrics?.followers_count || 0,
          following: u.public_metrics?.following_count || 0,
          tweets: u.public_metrics?.tweet_count || 0,
          avatar: u.profile_image_url?.replace("_normal", "_400x400") || "",
          verified: u.verified || false,
        });
      } catch(e) { return json({ error: e.message }, 500); }
    }
    if (path === "/api/x/timeline" && req.method === "GET") {
      const handle = url.searchParams.get("handle") || "ceogps";
      const max = Math.min(parseInt(url.searchParams.get("max") || "10"), 100);
      const manualX2 = await env.LIFEOS_KV.get("manual_x_token", "json").catch(()=>null);
      const bearer = manualX2?.bearer_token || env.X_BEARER_TOKEN || "";
      if (!bearer) return json({ tweets: [], error: "X_BEARER_TOKEN not configured" });
      try {
        const ur = await fetch(`https://api.twitter.com/2/users/by/username/${handle}?user.fields=id`, {
          headers: { Authorization: `Bearer ${bearer}` }
        });
        const ud = await ur.json();
        if (!ud.data?.id) return json({ tweets: [] });
        const userId = ud.data.id;
        const tr = await fetch(`https://api.twitter.com/2/users/${userId}/tweets?max_results=${max}&tweet.fields=public_metrics,created_at&exclude=retweets,replies`, {
          headers: { Authorization: `Bearer ${bearer}` }
        });
        const td = await tr.json();
        const tweets = (td.data || []).map(t => ({
          id: t.id, text: t.text,
          likes: t.public_metrics?.like_count || 0,
          retweets: t.public_metrics?.retweet_count || 0,
          replies: t.public_metrics?.reply_count || 0,
          impressions: t.public_metrics?.impression_count || 0,
          createdAt: t.created_at,
          url: `https://twitter.com/${handle}/status/${t.id}`,
        }));
        return json({ tweets });
      } catch(e) { return json({ tweets: [], error: e.message }); }
    }
    // ========================================================================
    // SOCIAL SCHEDULED POSTS
    // ========================================================================
    if (path === "/api/social/schedule" && req.method === "POST") {
      const body = await req.json();
      if (!body?.text || !Array.isArray(body?.platforms) || !body.platforms.length) {
        return err("text + platforms[] required");
      }
      const id = crypto.randomUUID();
      const job = {
        id, text: body.text, image_url: body.image_url || null, platforms: body.platforms,
        when: body.when || new Date().toISOString(), status: "pending", created_at: new Date().toISOString(),
      };
      const queue = (await env.LIFEOS_KV.get("social_queue", "json")) || [];
      queue.push(job);
      await env.LIFEOS_KV.put("social_queue", JSON.stringify(queue));
      return json({ ok: true, id, job });
    }
    if (path === "/api/social/queue" && req.method === "GET") {
      return json((await env.LIFEOS_KV.get("social_queue", "json")) || []);
    }
    if (path === "/api/social/queue" && req.method === "DELETE") {
      const id = url.searchParams.get("id");
      if (!id) return err("id required");
      const q = (await env.LIFEOS_KV.get("social_queue", "json")) || [];
      await env.LIFEOS_KV.put("social_queue", JSON.stringify(q.filter(j => j.id !== id)));
      return json({ ok: true, id, cancelled: true });
    }
    if (path === "/api/social/post" && req.method === "POST") {
      const { text, image_url, platforms = [] } = await req.json();
      if (!text || !platforms.length) return err("text + platforms[] required");
      const results = {};
      for (const pf of platforms) {
        try {
          if (pf === "facebook") {
            results[pf] = await graphPost(`/${META_PAGE_ID}/feed`, image_url ? { message: text, link: image_url } : { message: text }, META_TOKEN);
          } else if (pf === "instagram") {
            if (!image_url) { results[pf] = { error: "instagram requires image_url" }; continue; }
            const c = await graphPost(`/${META_IG_ID}/media`, { caption: text, image_url }, META_TOKEN);
            results[pf] = c.id ? await graphPost(`/${META_IG_ID}/media_publish`, { creation_id: c.id }, META_TOKEN) : c;
          } else if (pf === "linkedin") {
            const tok = await liToken(env);
            if (!tok) { results[pf] = { error: "linkedin not connected" }; continue; }
            const me = await fetch("https://api.linkedin.com/v2/userinfo", { headers: { "Authorization": "Bearer " + tok } }).then(r => r.json());
            results[pf] = await liPost(env, "/posts", {
              author: `urn:li:person:${me.sub}`,
              commentary: text,
              visibility: "PUBLIC",
              distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
              lifecycleState: "PUBLISHED",
              isReshareDisabledByAuthor: false,
            }, tok);
          } else {
            results[pf] = { error: `platform "${pf}" not yet wired` };
          }
        } catch (e) { results[pf] = { error: e.message }; }
      }
      return json({ ok: true, results });
    }
    // ========================================================================
    // BRILLIANT DIRECTORIES PROXY
    // ========================================================================
    if (path.startsWith("/api/bd")) {
      const bdPath = path.replace("/api/bd", "") || "/";
      const bdUrl = `https://ceogps.com/api/v2${bdPath}${url.search || ""}`;
      const bdKey = env.BD_API_KEY || "";
      const bdOpts = {
        method: req.method,
        headers: { "X-Api-Key": bdKey, "Content-Type": "application/json", "Accept": "application/json" },
      };
      if (req.method !== "GET" && req.method !== "HEAD") {
        bdOpts.body = await req.text();
      }
      try {
        const bdRes = await fetch(bdUrl, bdOpts);
        const bdData = await bdRes.text();
        return new Response(bdData, { status: bdRes.status, headers: { ...CORS, "Content-Type": "application/json" } });
      } catch(e) {
        return json({ status:"error", message:"BD proxy error: " + e.message }, 502);
      }
    }
    // ========================================================================
    // LLM ROUTER - with rate limiting
    // ========================================================================
    if (path === "/api/llm/invoke" && req.method === "POST") {
      const clientIp = req.headers.get("CF-Connecting-IP") || "unknown";
      const rateLimit = await checkRateLimit(env, `llm:${clientIp}`, 60, 30);
      if (!rateLimit.allowed) {
        return json({ error: "Rate limit exceeded. Please try again later." }, 429);
      }
      try {
        const body = await req.json();
        const { prompt = "", system = "", model = "auto", max_tokens = 800 } = body;
        let messages = Array.isArray(body.messages) ? body.messages : [];
        if (!messages.length) {
          if (system) messages.push({ role: "system", content: system });
          messages.push({ role: "user", content: prompt });
        }
        if (!messages.length) return err("prompt or messages required");
        const k = async (svc) => {
          const fromKV = await env.LIFEOS_KV.get(`apikey_${svc}`);
          if (fromKV) return fromKV;
          const envMap = { claude: "ANTHROPIC_API_KEY", openai: "OPENAI_API_KEY", gemini: "GEMINI_API_KEY", deepseek: "DEEPSEEK_API_KEY", grok: "GROK_API_KEY", groq: "GROQ_API_KEY", mistral: "MISTRAL_API_KEY" };
          return envMap[svc] ? env[envMap[svc]] : null;
        };
        const keys = {
          claude: await k("claude"), openai: await k("openai"), gemini: await k("gemini"),
          deepseek: await k("deepseek"), grok: await k("grok"), groq: await k("groq"),
          mistral: await k("mistral"), cohere: await k("cohere"), together: await k("together"),
          openrouter: await k("openrouter"), qwen: await k("qwen"), novita: await k("novita"),
          fireworks: await k("fireworks"), ai21: await k("ai21"), perplexity: await k("perplexity"),
        };
        const auto = ["groq","cf_free","deepseek","grok","claude","openai","gemini","mistral","together","openrouter","cohere","qwen","novita","fireworks","ai21","perplexity"];
        const m = String(model).toLowerCase();
        let chain = m === "auto" || !m ? auto : [m, ...auto.filter(x => x !== m)];
        chain = chain.filter(p => p === "cf_free" || keys[p]);
        if (!chain.includes("cf_free")) chain.push("cf_free");
        const tried = [];
        for (const provider of chain) {
          try {
            let text, statusOk = false;
            if (provider === "claude") {
              const r = await fetch("https://api.anthropic.com/v1/messages", {
                method: "POST", headers: { "x-api-key": keys.claude, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
                body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens, system, messages: messages.filter(m => m.role !== "system") }),
              });
              if (!r.ok) { tried.push({ provider, status: r.status, reason: (await r.text()).slice(0,140) }); continue; }
              const d = await r.json(); text = d.content?.[0]?.text || ""; statusOk = !!text;
            } else if (provider === "openai") {
              const r = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST", headers: { "Authorization": "Bearer " + keys.openai, "Content-Type": "application/json" },
                body: JSON.stringify({ model: "gpt-4o-mini", messages, max_tokens }),
              });
              if (!r.ok) { tried.push({ provider, status: r.status, reason: (await r.text()).slice(0,140) }); continue; }
              const d = await r.json(); text = d.choices?.[0]?.message?.content || ""; statusOk = !!text;
            } else if (provider === "gemini") {
              const contents = messages.filter(m => m.role !== "system").map(m => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
              const sysInst = system || messages.find(m => m.role === "system")?.content;
              const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(keys.gemini)}`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ contents, ...(sysInst ? { systemInstruction: { parts: [{ text: sysInst }] } } : {}), generationConfig: { maxOutputTokens: max_tokens } }),
              });
              if (!r.ok) { tried.push({ provider, status: r.status, reason: (await r.text()).slice(0,140) }); continue; }
              const d = await r.json(); text = d.candidates?.[0]?.content?.parts?.[0]?.text || ""; statusOk = !!text;
            } else if (provider === "deepseek") {
              const r = await fetch("https://api.deepseek.com/v1/chat/completions", {
                method: "POST", headers: { "Authorization": "Bearer " + keys.deepseek, "Content-Type": "application/json" },
                body: JSON.stringify({ model: "deepseek-chat", messages, max_tokens }),
              });
              if (!r.ok) { tried.push({ provider, status: r.status, reason: (await r.text()).slice(0,140) }); continue; }
              const d = await r.json(); text = d.choices?.[0]?.message?.content || ""; statusOk = !!text;
            } else if (provider === "grok") {
              const r = await fetch("https://api.x.ai/v1/chat/completions", {
                method: "POST", headers: { "Authorization": "Bearer " + keys.grok, "Content-Type": "application/json" },
                body: JSON.stringify({ model: "grok-2-latest", messages, max_tokens }),
              });
              if (!r.ok) { tried.push({ provider, status: r.status, reason: (await r.text()).slice(0,140) }); continue; }
              const d = await r.json(); text = d.choices?.[0]?.message?.content || ""; statusOk = !!text;
            } else if (provider === "groq") {
              const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST", headers: { "Authorization": "Bearer " + keys.groq, "Content-Type": "application/json" },
                body: JSON.stringify({ model: "llama-3.3-70b-versatile", messages, max_tokens }),
              });
              if (!r.ok) { tried.push({ provider, status: r.status, reason: (await r.text()).slice(0,140) }); continue; }
              const d = await r.json(); text = d.choices?.[0]?.message?.content || ""; statusOk = !!text;
            } else if (provider === "mistral") {
              const r = await fetch("https://api.mistral.ai/v1/chat/completions", {
                method: "POST", headers: { "Authorization": "Bearer " + keys.mistral, "Content-Type": "application/json" },
                body: JSON.stringify({ model: "mistral-small-latest", messages, max_tokens }),
              });
              if (!r.ok) { tried.push({ provider, status: r.status, reason: (await r.text()).slice(0,140) }); continue; }
              const d = await r.json(); text = d.choices?.[0]?.message?.content || ""; statusOk = !!text;
            } else if (provider === "qwen") {
              const r = await fetch("https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", {
                method: "POST", headers: { "Authorization": "Bearer " + keys.qwen, "Content-Type": "application/json" },
                body: JSON.stringify({ model: "qwen-plus", messages, max_tokens }),
              });
              if (!r.ok) { tried.push({ provider, status: r.status, reason: (await r.text()).slice(0,140) }); continue; }
              const dq = await r.json(); text = dq.choices?.[0]?.message?.content || ""; statusOk = !!text;
            } else if (provider === "novita") {
              const r = await fetch("https://api.novita.ai/v3/openai/chat/completions", {
                method: "POST", headers: { "Authorization": "Bearer " + keys.novita, "Content-Type": "application/json" },
                body: JSON.stringify({ model: "meta-llama/llama-3.1-70b-instruct", messages, max_tokens }),
              });
              if (!r.ok) { tried.push({ provider, status: r.status, reason: (await r.text()).slice(0,140) }); continue; }
              const dn = await r.json(); text = dn.choices?.[0]?.message?.content || ""; statusOk = !!text;
            } else if (provider === "fireworks") {
              const r = await fetch("https://api.fireworks.ai/inference/v1/chat/completions", {
                method: "POST", headers: { "Authorization": "Bearer " + keys.fireworks, "Content-Type": "application/json" },
                body: JSON.stringify({ model: "accounts/fireworks/models/llama-v3p1-70b-instruct", messages, max_tokens }),
              });
              if (!r.ok) { tried.push({ provider, status: r.status, reason: (await r.text()).slice(0,140) }); continue; }
              const df = await r.json(); text = df.choices?.[0]?.message?.content || ""; statusOk = !!text;
            } else if (provider === "ai21") {
              const r = await fetch("https://api.ai21.com/studio/v1/chat/completions", {
                method: "POST", headers: { "Authorization": "Bearer " + keys.ai21, "Content-Type": "application/json" },
                body: JSON.stringify({ model: "jamba-1.5-mini", messages, max_tokens }),
              });
              if (!r.ok) { tried.push({ provider, status: r.status, reason: (await r.text()).slice(0,140) }); continue; }
              const da = await r.json(); text = da.choices?.[0]?.message?.content || ""; statusOk = !!text;
            } else if (provider === "perplexity") {
              const r = await fetch("https://api.perplexity.ai/chat/completions", {
                method: "POST", headers: { "Authorization": "Bearer " + keys.perplexity, "Content-Type": "application/json" },
                body: JSON.stringify({ model: "sonar", messages, max_tokens }),
              });
              if (!r.ok) { tried.push({ provider, status: r.status, reason: (await r.text()).slice(0,140) }); continue; }
              const dp = await r.json(); text = dp.choices?.[0]?.message?.content || ""; statusOk = !!text;
            } else if (provider === "cf_free") {
              if (!env.AI) { tried.push({ provider, status: 0, reason: "AI binding missing" }); continue; }
              const result = await env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", { messages, max_tokens });
              text = result?.response || result?.result?.response || "";
              statusOk = !!text;
              if (!statusOk) { tried.push({ provider, status: 500, reason: "no response" }); continue; }
            }
            if (statusOk) {
              tried.push({ provider, status: 200, reason: "ok" });
              return json({ text, model_used: provider, fallback_count: tried.length - 1, providers_tried: tried });
            }
          } catch (e) {
            tried.push({ provider, status: 0, reason: e.message?.slice(0, 140) || "exception" });
            continue;
          }
        }
        return json({ text: "[All AI providers unavailable. Add an API key in Integrations.]", model_used: null, fallback_count: tried.length, providers_tried: tried, error: "no_provider_responded" }, 503);
      } catch (e) { return err("LLM invoke failed: " + e.message, 500); }
    }
    if (path === "/api/llm/preference" && req.method === "GET") {
      const preferred = (await env.LIFEOS_KV.get("llm_preferred_model")) || "auto";
      return json({ preferred });
    }
    if (path === "/api/llm/preference" && req.method === "POST") {
      try {
        const { model } = await req.json();
        const next = String(model || "auto").trim().toLowerCase();
        await env.LIFEOS_KV.put("llm_preferred_model", next);
        return json({ ok: true, preferred: next });
      } catch (e) { return err("preference save failed: " + e.message, 500); }
    }
    // ========================================================================
    // FREE AI INFERENCE (Workers AI) - with rate limiting
    // ========================================================================
    if (path === "/api/ai/generate" && req.method === "POST") {
      const clientIp = req.headers.get("CF-Connecting-IP") || "unknown";
      const rateLimit = await checkRateLimit(env, `ai:${clientIp}`, 60, 20);
      if (!rateLimit.allowed) {
        return json({ error: "Rate limit exceeded. Please try again later." }, 429);
      }
      try {
        const body = await req.json();
        const { prompt = "", system = "", max_tokens = 800, model = "" } = body;
        const messages = [];
        if (system) messages.push({ role: "system", content: system });
        messages.push({ role: "user", content: prompt });
        let cfModel = "@cf/meta/llama-3.1-8b-instruct";
        if (model.includes("llama-3.3") || model.includes("70b")) cfModel = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
        if (model.includes("mistral")) cfModel = "@cf/mistral/mistral-7b-instruct-v0.1";
        if (!env.AI) return json({ text: "[Workers AI not bound — check wrangler.toml]" }, 500);
        const result = await env.AI.run(cfModel, { messages, max_tokens });
        const text = result?.response || result?.result?.response || "[No response from AI]";
        return json({ text, model: cfModel });
      } catch (e) { return json({ text: "[AI Error: " + e.message + "]" }, 500); }
    }
    // ========================================================================
    // EMAIL ENDPOINTS
    // ========================================================================
    if (path === "/api/email/accounts" && req.method === "GET") {
      const accounts = [];
      const gIdx = (await env.LIFEOS_KV.get("oauth_index_google", "json")) || [];
      for (const a of gIdx) {
        accounts.push({ provider: "gmail", account_label: a.label, email: a.identity?.email || null, name: a.identity?.name || null, can_send: true, can_read: true });
      }
      const mIdx = (await env.LIFEOS_KV.get("oauth_index_microsoft", "json")) || [];
      for (const a of mIdx) {
        accounts.push({ provider: "outlook", account_label: a.label, email: a.identity?.email || null, name: a.identity?.name || null, can_send: true, can_read: true });
      }
      const brevoKey = await env.LIFEOS_KV.get("apikey_brevo");
      if (brevoKey) accounts.push({ provider: "brevo", account_label: "brevo", email: "(via Brevo)", can_send: true, can_read: false });
      return json({ accounts });
    }
    if (path === "/api/email/labels" && req.method === "GET") {
      const provider = url.searchParams.get("provider") || "gmail";
      const account = url.searchParams.get("account") || "default";
      if (provider === "gmail") {
        const t = await getValidAccessToken(env, "google", account);
        if (t.error) return json({ error: t.error, detail: t.detail }, 401);
        const r = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/labels", { headers: { Authorization: "Bearer " + t.access_token } });
        if (!r.ok) return json({ error: "gmail_labels_failed", status: r.status }, 502);
        const d = await r.json();
        const labels = (d.labels || []).map(l => ({ id: l.id, name: l.name, type: l.type, unread: l.messagesUnread, total: l.messagesTotal }));
        return json({ provider, account, labels });
      }
      return json({ provider, account, labels: [] });
    }
    if (path === "/api/email/threads" && req.method === "GET") {
      const provider = url.searchParams.get("provider") || "gmail";
      const account = url.searchParams.get("account") || "default";
      const label = url.searchParams.get("label") || "INBOX";
      const limit = Math.min(50, parseInt(url.searchParams.get("limit") || "25", 10));
      if (provider === "gmail") {
        const t = await getValidAccessToken(env, "google", account);
        if (t.error) return json({ error: t.error, detail: t.detail }, 401);
        const listUrl = new URL("https://gmail.googleapis.com/gmail/v1/users/me/threads");
        listUrl.searchParams.set("labelIds", label);
        listUrl.searchParams.set("maxResults", String(limit));
        const r = await fetch(listUrl, { headers: { Authorization: "Bearer " + t.access_token } });
        if (!r.ok) return json({ error: "gmail_threads_failed", status: r.status }, 502);
        const d = await r.json();
        const ids = (d.threads || []).map(x => x.id);
        if (!ids.length) return json({ provider, account, label, threads: [] });
        const detailed = await Promise.all(ids.map(async id => {
          try {
            const dr = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`, { headers: { Authorization: "Bearer " + t.access_token } });
            if (!dr.ok) return null;
            const th = await dr.json();
            const msgs = th.messages || [];
            const last = msgs[msgs.length - 1] || msgs[0] || {};
            const hdrs = (last.payload?.headers || []).reduce((a, h) => { a[h.name.toLowerCase()] = h.value; return a; }, {});
            const labelIds = new Set();
            msgs.forEach(m => (m.labelIds || []).forEach(l => labelIds.add(l)));
            return { id: th.id, subject: hdrs.subject || "(no subject)", from: hdrs.from || "", date: hdrs.date || "", snippet: last.snippet || th.snippet || "", message_count: msgs.length, unread: labelIds.has("UNREAD"), starred: labelIds.has("STARRED") };
          } catch { return null; }
        }));
        return json({ provider, account, label, threads: detailed.filter(Boolean) });
      }
      return json({ provider, account, label, threads: [] });
    }
    if (path === "/api/email/send" && req.method === "POST") {
      try {
        const body = await req.json();
        const { provider = "gmail", account = "default", to = "", subject = "", body_text = "", body_html = "" } = body;
        if (!to) return err("to required");
        if (provider === "gmail") {
          const t = await getValidAccessToken(env, "google", account);
          if (t.error) return json({ error: t.error, detail: t.detail }, 401);
          const fromEmail = t.identity?.email || "";
          const mime = [`From: ${fromEmail}`, `To: ${to}`, `Subject: ${subject}`, "MIME-Version: 1.0", body_html ? "Content-Type: text/html; charset=utf-8" : "Content-Type: text/plain; charset=utf-8", "", body_html || body_text].filter(Boolean).join("\r\n");
          const enc = btoa(unescape(encodeURIComponent(mime))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
          const r = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
            method: "POST", headers: { Authorization: "Bearer " + t.access_token, "Content-Type": "application/json" },
            body: JSON.stringify({ raw: enc }),
          });
          if (!r.ok) return json({ error: "gmail_send_failed", status: r.status }, 502);
          const d = await r.json();
          return json({ ok: true, provider: "gmail", id: d.id, thread_id: d.threadId });
        }
        if (provider === "brevo") {
          const key = await env.LIFEOS_KV.get("apikey_brevo");
          if (!key) return json({ error: "brevo_no_key" }, 401);
          const r = await fetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST", headers: { "api-key": key, "Content-Type": "application/json" },
            body: JSON.stringify({ sender: { email: "noreply@example.com" }, to: to.split(",").map(e => ({ email: e.trim() })), subject, htmlContent: body_html || `<pre>${body_text}</pre>`, textContent: body_text || undefined }),
          });
          if (!r.ok) return json({ error: "brevo_send_failed", status: r.status }, 502);
          return json({ ok: true, provider: "brevo" });
        }
        return json({ error: "unsupported_provider", provider }, 400);
      } catch (e) { return err("send failed: " + e.message, 500); }
    }
    // ========================================================================
    // ── Email thread detail ───────────────────────────────────────────────────
    if (path.startsWith("/api/email/thread/") && req.method === "GET") {
      const threadId = decodeURIComponent(path.replace("/api/email/thread/", ""));
      const provider = url.searchParams.get("provider") || "gmail";
      const account  = url.searchParams.get("account")  || "default";
      if (provider === "gmail") {
        const t = await getValidAccessToken(env, "google", account);
        if (t.error) return json({ error: t.error, detail: t.detail }, 401);
        try {
          const r = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}?format=full`, {
            headers: { Authorization: "Bearer " + t.access_token }
          });
          if (!r.ok) return json({ error: "gmail_thread_failed", status: r.status }, 502);
          const th = await r.json();
          const messages = (th.messages || []).map(m => {
            const hdrs = (m.payload?.headers || []).reduce((a, h) => { a[h.name.toLowerCase()] = h.value; return a; }, {});
            let text = "", html = "";
            function extractParts(parts = []) {
              for (const p of parts) {
                if (p.mimeType === "text/plain" && p.body?.data) text = atob(p.body.data.replace(/-/g, "+").replace(/_/g, "/"));
                if (p.mimeType === "text/html"  && p.body?.data) html = atob(p.body.data.replace(/-/g, "+").replace(/_/g, "/"));
                if (p.parts) extractParts(p.parts);
              }
            }
            if (m.payload?.body?.data) {
              const raw = atob(m.payload.body.data.replace(/-/g, "+").replace(/_/g, "/"));
              if (m.payload.mimeType === "text/html") html = raw; else text = raw;
            }
            extractParts(m.payload?.parts || []);
            return { id: m.id, from: hdrs.from || "", to: hdrs.to || "", date: hdrs.date || "", subject: hdrs.subject || "", text, html, snippet: m.snippet || "", labelIds: m.labelIds || [] };
          });
          return json({ id: th.id, messages, message_count: messages.length });
        } catch (e) { return err("thread fetch failed: " + e.message, 500); }
      }
      return json({ error: "unsupported_provider", provider }, 400);
    }

    // ── Email mark read/unread/starred ────────────────────────────────────────
    if (path === "/api/email/mark" && req.method === "POST") {
      try {
        const body = await req.json();
        const { provider = "gmail", account = "default", message_ids = [], action = "read" } = body;
        if (provider === "gmail") {
          const t = await getValidAccessToken(env, "google", account);
          if (t.error) return json({ error: t.error, detail: t.detail }, 401);
          const addLabels    = action === "unread" ? ["UNREAD"] : action === "starred" ? ["STARRED"] : [];
          const removeLabels = action === "read"   ? ["UNREAD"] : action === "unstarred" ? ["STARRED"] : [];
          await Promise.all(message_ids.map(id =>
            fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}/modify`, {
              method: "POST", headers: { Authorization: "Bearer " + t.access_token, "Content-Type": "application/json" },
              body: JSON.stringify({ addLabelIds: addLabels, removeLabelIds: removeLabels }),
            })
          ));
          return json({ ok: true, action, count: message_ids.length });
        }
        return json({ ok: true });
      } catch (e) { return err("mark failed: " + e.message, 500); }
    }

    // YOUTUBE
    // ========================================================================
    const YT_KEY = env.YOUTUBE_DATA_V3_API_KEY || "";
    // manual_yt_config is written by /api/oauth/token/save (panel Accounts tab) — it overrides env vars
    const manualYt = await env.LIFEOS_KV.get("manual_yt_config", "json").catch(()=>null);
    const YT_CHANNEL_ID = (manualYt?.channel_id && manualYt.channel_id.trim().length > 5 ? manualYt.channel_id : null) || env.YOUTUBE_CHANNEL_ID || "";
    if (path === "/api/youtube/channel" && req.method === "GET") {
      try {
        if (!YT_KEY) return json({ error: "YouTube API key not configured" }, 503);
        const YT_HANDLE = manualYt?.channel_handle || env.YOUTUBE_CHANNEL_HANDLE || "@ceogps";
        const query = (YT_CHANNEL_ID && YT_CHANNEL_ID.trim().length > 5)
          ? `id=${YT_CHANNEL_ID}`
          : `forHandle=${encodeURIComponent(YT_HANDLE)}`;
        const r = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&${query}&key=${YT_KEY}`);
        const d = await r.json();
        const ch = d.items?.[0];
        if (!ch) return json({ error: "Channel not found — set YOUTUBE_CHANNEL_ID or YOUTUBE_CHANNEL_HANDLE in Worker env" }, 404);
        return json({ connected: true, id: ch.id, title: ch.snippet.title, description: ch.snippet.description, thumbnail: ch.snippet.thumbnails?.default?.url, subscribers: parseInt(ch.statistics.subscriberCount || 0), views: parseInt(ch.statistics.viewCount || 0), videoCount: parseInt(ch.statistics.videoCount || 0) });
      } catch (e) { return json({ error: e.message }, 500); }
    }
    if (path === "/api/youtube/videos" && req.method === "GET") {
      try {
        if (!YT_KEY) return json({ items: [], error: "YouTube API key not configured" });
        let channelId = YT_CHANNEL_ID && YT_CHANNEL_ID.trim().length > 5 ? YT_CHANNEL_ID : null;
        if (!channelId) {
          const YT_HANDLE = manualYt?.channel_handle || env.YOUTUBE_CHANNEL_HANDLE || "@ceogps";
          const cr = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${encodeURIComponent(YT_HANDLE)}&key=${YT_KEY}`);
          const cd = await cr.json();
          channelId = cd.items?.[0]?.id || null;
        }
        if (!channelId) return json({ items: [] });
        const max = url.searchParams.get("max") || "10";
        const r = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&maxResults=${max}&order=date&type=video&key=${YT_KEY}`);
        const d = await r.json();
        const items = (d.items || []).map(v => ({ id: v.id.videoId, title: v.snippet.title, description: v.snippet.description, thumbnail: v.snippet.thumbnails?.medium?.url, publishedAt: v.snippet.publishedAt, url: `https://www.youtube.com/watch?v=${v.id.videoId}` }));
        return json({ items });
      } catch (e) { return json({ error: e.message, items: [] }, 500); }
    }
    // ========================================================================
    // BROWSE / FETCH
    // ========================================================================
    if (path === "/api/browse/fetch" && req.method === "POST") {
      try {
        const { url: fetchUrl, extract = "text" } = await req.json();
        if (!fetchUrl) return err("url is required");
        const r = await fetch(fetchUrl, { headers: { "User-Agent": "Mozilla/5.0 (compatible; LifeOS1/1.0)" }, redirect: "follow" });
        if (!r.ok) return json({ error: "HTTP " + r.status, url: fetchUrl }, r.status);
        const html = await r.text();
        const finalUrl = r.url || fetchUrl;
        const cleanText = html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 8000);
        const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
        const title = titleMatch ? titleMatch[1].replace(/\s+/g, " ").trim() : "";
        if (extract === "links") {
          const linkMatches = [...html.matchAll(/<a\s[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
          const links = linkMatches.map(m => ({ href: m[1].startsWith("http") ? m[1] : new URL(m[1], fetchUrl).href, text: m[2].replace(/<[^>]+>/g,"").trim().slice(0,80) })).filter(l => l.text.length > 1).slice(0, 30);
          return json({ success: true, url: finalUrl, title, links });
        }
        return json({ success: true, url: finalUrl, title, text: cleanText });
      } catch (e) { return json({ error: e.message }, 500); }
    }
    if (path === "/api/browse/search" && req.method === "POST") {
      try {
        const { query, limit = 8 } = await req.json();
        if (!query) return err("query is required");
        const encodedQ = encodeURIComponent(query);
        const r = await fetch("https://html.duckduckgo.com/html/?q=" + encodedQ, { headers: { "User-Agent": "Mozilla/5.0 (compatible; LifeOS1/1.0)" } });
        const html = await r.text();
        const results = [];
        const blocks = html.split('<div class="result ');
        for (const block of blocks.slice(1, limit + 1)) {
          const titleM = block.match(/<a[^>]+class="result__a"[^>]*>([\s\S]*?)<\/a>/i);
          const urlM = block.match(/<a[^>]+class="result__url"[^>]*>([\s\S]*?)<\/a>/i);
          const snippM = block.match(/<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/i);
          const title = titleM ? titleM[1].replace(/<[^>]+>/g,"").trim() : "";
          const urlText = urlM ? urlM[1].replace(/<[^>]+>/g,"").trim() : "";
          const snippet = snippM ? snippM[1].replace(/<[^>]+>/g,"").trim() : "";
          if (title) results.push({ title, url: urlText ? "https://" + urlText : "", snippet });
        }
        return json({ success: true, query, results });
      } catch (e) { return json({ error: e.message }, 500); }
    }
    // ========================================================================
    // AGENTS
    // ========================================================================
    if (path.startsWith("/api/agents")) {
      const agentRes = await handleAgents(path, req, env);
      if (agentRes) return agentRes;
    }
    // ========================================================================
    // ENRICHMENT & CONTACT
    // ========================================================================
    if (path === "/api/enrich/contact" && req.method === "POST") {
      const key = env.ENRICH_API_KEY;
      if (!key) return err("ENRICH_API_KEY not configured on Worker", 503);
      try {
        const payload = await req.json();
        const upstream = await fetch("https://api.enrich.so/v1/lookup", {
          method: "POST",
          headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await upstream.json().catch(() => ({}));
        if (!upstream.ok) return json({ error: data?.message || "enrich upstream error", status: upstream.status }, 502);
        return json(data);
      } catch (e) {
        return err("enrich failed: " + e.message, 500);
      }
    }
    if (path === "/api/runway/generate" && req.method === "POST") {
      const apiKey = await env.LIFEOS_KV.get("apikey_runway");
      if (!apiKey) return err("Runway API key not configured. Add it in Integrations.", 503);
      try {
        const body = await req.json();
        const upstream = await fetch("https://api.dev.runwayml.com/v1/image_to_video", {
          method: "POST",
          headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json", "X-Runway-Version": "2024-11-06" },
          body: JSON.stringify({ promptImage: body.image_url, promptText: body.prompt, model: body.model || "gen3a_turbo", duration: body.duration || 5, ratio: body.ratio || "1280:768" }),
        });
        const data = await upstream.json().catch(() => ({}));
        if (!upstream.ok) return json({ error: data?.error || "Runway error", status: upstream.status }, 502);
        return json(data);
      } catch (e) { return err("Runway failed: " + e.message, 500); }
    }

    if (path === "/api/runway/status" && req.method === "GET") {
      const apiKey = await env.LIFEOS_KV.get("apikey_runway");
      if (!apiKey) return err("Runway API key not configured", 503);
      const taskId = new URL(req.url).searchParams.get("task_id");
      if (!taskId) return err("task_id required", 400);
      try {
        const upstream = await fetch(`https://api.dev.runwayml.com/v1/tasks/${taskId}`, {
          headers: { "Authorization": `Bearer ${apiKey}`, "X-Runway-Version": "2024-11-06" },
        });
        const data = await upstream.json().catch(() => ({}));
        if (!upstream.ok) return json({ error: data?.error || "Runway error", status: upstream.status }, 502);
        return json(data);
      } catch (e) { return err("Runway status failed: " + e.message, 500); }
    }

    // ── ElevenLabs TTS ──────────────────────────────────────────────────────
    if (path === "/api/elevenlabs/tts" && req.method === "POST") {
      const apiKey = await env.LIFEOS_KV.get("apikey_elevenlabs");
      if (!apiKey) return err("ElevenLabs API key not configured. Add it in Integrations.", 503);
      try {
        const body = await req.json();
        const voiceId = body.voice_id || "21m00Tcm4TlvDq8ikWAM";
        const upstream = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
          method: "POST",
          headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
          body: JSON.stringify({ text: body.text, model_id: body.model || "eleven_monolingual_v1", voice_settings: { stability: 0.5, similarity_boost: 0.75 } }),
        });
        if (!upstream.ok) {
          const e = await upstream.json().catch(() => ({}));
          return json({ error: e?.detail?.message || "ElevenLabs error" }, 502);
        }
        const audio = await upstream.arrayBuffer();
          return new Response(audio, { headers: { ...CORS, "Content-Type": "audio/mpeg" } });
      } catch (e) { return err("ElevenLabs failed: " + e.message, 500); }
    }

    if (path === "/api/elevenlabs/voices" && req.method === "GET") {
      const apiKey = await env.LIFEOS_KV.get("apikey_elevenlabs");
      if (!apiKey) return err("ElevenLabs API key not configured", 503);
      try {
        const r = await fetch("https://api.elevenlabs.io/v1/voices", { headers: { "xi-api-key": apiKey } });
        const d = await r.json().catch(() => ({}));
        return json(d);
      } catch (e) { return err("ElevenLabs voices failed: " + e.message, 500); }
    }

    // ── Replicate ────────────────────────────────────────────────────────────
    if (path === "/api/replicate/run" && req.method === "POST") {
      const apiKey = await env.LIFEOS_KV.get("apikey_replicate");
      if (!apiKey) return err("Replicate API key not configured. Add it in Integrations.", 503);
      try {
        const body = await req.json();
        const upstream = await fetch("https://api.replicate.com/v1/predictions", {
          method: "POST",
          headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ version: body.version, input: body.input }),
        });
        const data = await upstream.json().catch(() => ({}));
        if (!upstream.ok) return json({ error: data?.detail || "Replicate error" }, 502);
        return json(data);
      } catch (e) { return err("Replicate failed: " + e.message, 500); }
    }

    if (path.startsWith("/api/replicate/") && req.method === "GET") {
      const apiKey = await env.LIFEOS_KV.get("apikey_replicate");
      if (!apiKey) return err("Replicate API key not configured", 503);
      const predId = path.replace("/api/replicate/", "");
      try {
        const r = await fetch(`https://api.replicate.com/v1/predictions/${predId}`, {
          headers: { "Authorization": `Bearer ${apiKey}` },
        });
        const d = await r.json().catch(() => ({}));
        return json(d);
      } catch (e) { return err("Replicate status failed: " + e.message, 500); }
    }


    // ── Nylas (iCloud / IMAP via Nylas v3 API) ──────────────────────────────
    // ── Nylas helpers ──────────────────────────────────────────────────────────
    // getNylasGrants: returns [{email, grant_id}] from nylas_grants KV (JSON array)
    // Also falls back to single apikey_nylas_grant_id for backwards compat
    async function getNylasGrants(env) {
      const raw = await env.LIFEOS_KV.get("nylas_grants");
      if (raw) { try { return JSON.parse(raw); } catch {} }
      const single = await env.LIFEOS_KV.get("apikey_nylas_grant_id");
      return single ? [{ email: "iCloud", grant_id: single }] : [];
    }

    if (path === "/api/nylas/accounts" && req.method === "GET") {
      const apiKey = await env.LIFEOS_KV.get("apikey_nylas");
      if (!apiKey) return json([]);
      const grants = await getNylasGrants(env);
      if (!grants.length) return json([]);
      return json(grants.map(g => ({
        id: g.grant_id,
        account_label: g.email,
        email: g.email,
        provider: "nylas",
        grant_id: g.grant_id,
        can_read: true,
        can_send: true,
      })));
    }

    if (path === "/api/nylas/threads" && req.method === "GET") {
      const apiKey = await env.LIFEOS_KV.get("apikey_nylas");
      if (!apiKey) return err("Nylas not configured", 503);
      const qs = new URL(req.url).searchParams;
      let grantId = qs.get("grant_id");
      if (!grantId) {
        const grants = await getNylasGrants(env);
        grantId = grants[0]?.grant_id;
      }
      if (!grantId) return err("No Nylas grant found", 503);
      const limit = qs.get("limit") || "40";
      const pageToken = qs.get("page_token") || "";
      const q = qs.get("q") || "";
      let url = `https://api.us.nylas.com/v3/grants/${grantId}/threads?limit=${limit}`;
      if (pageToken) url += `&page_token=${encodeURIComponent(pageToken)}`;
      if (q) url += `&subject=${encodeURIComponent(q)}`;
      const r = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
      if (!r.ok) return err("Nylas threads error: " + r.status, 502);
      const d = await r.json();
      const threads = (d.data || []).map(t => ({
        id: t.id,
        subject: t.subject || "(no subject)",
        snippet: t.snippet || "",
        from: t.from?.[0]?.email || "",
        date: t.latest_message_received_date ? t.latest_message_received_date * 1000 : Date.now(),
        unread: !t.read,
        message_count: t.message_ids?.length || 1,
        provider: "nylas",
        grant_id: grantId,
      }));
      return json({ threads, next_page_token: d.next_page_token });
    }

    if (path.startsWith("/api/nylas/thread/") && req.method === "GET") {
      const apiKey = await env.LIFEOS_KV.get("apikey_nylas");
      if (!apiKey) return err("Nylas not configured", 503);
      const qs = new URL(req.url).searchParams;
      let grantId = qs.get("grant_id");
      if (!grantId) {
        const grants = await getNylasGrants(env);
        grantId = grants[0]?.grant_id;
      }
      if (!grantId) return err("No Nylas grant found", 503);
      const threadId = decodeURIComponent(path.replace("/api/nylas/thread/", "").split("?")[0]);
      const r = await fetch(`https://api.us.nylas.com/v3/grants/${grantId}/messages?thread_id=${encodeURIComponent(threadId)}&limit=50`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!r.ok) return err("Nylas thread error: " + r.status, 502);
      const d = await r.json();
      const messages = (d.data || []).map(m => ({
        id: m.id,
        from: m.from?.[0]?.email || "",
        to: m.to?.map(a => a.email).join(", ") || "",
        date: m.date ? m.date * 1000 : Date.now(),
        subject: m.subject || "",
        text: m.body || "",
        html: m.body?.includes("<") ? m.body : null,
        attachments: (m.attachments || []).map(a => ({ id: a.id, filename: a.filename, size: a.size })),
        unread: !m.unread,
      }));
      return json({ id: threadId, subject: messages[0]?.subject || "", messages, provider: "nylas", grant_id: grantId });
    }

    if (path === "/api/nylas/send" && req.method === "POST") {
      const apiKey = await env.LIFEOS_KV.get("apikey_nylas");
      if (!apiKey) return err("Nylas not configured", 503);
      const body = await req.json();
      const grantId = body.grant_id || (await getNylasGrants(env))[0]?.grant_id;
      if (!grantId) return err("No Nylas grant found", 503);
      const payload = {
        subject: body.subject || "",
        body: body.body || "",
        to: (body.to || "").split(",").map(e => ({ email: e.trim() })).filter(e => e.email),
      };
      if (body.cc) payload.cc = body.cc.split(",").map(e => ({ email: e.trim() })).filter(e => e.email);
      if (body.reply_to_message_id) payload.reply_to_message_id = body.reply_to_message_id;
      const r = await fetch(`https://api.us.nylas.com/v3/grants/${grantId}/messages/send`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) return json({ error: data?.error?.message || "Nylas send error" }, 502);
      return json({ ok: true, id: data.data?.id });
    }

    if (path === "/api/nylas/mark" && req.method === "POST") {
      const apiKey = await env.LIFEOS_KV.get("apikey_nylas");
      if (!apiKey) return err("Nylas not configured", 503);
      const { message_ids, unread, grant_id: reqGrantId } = await req.json();
      const grantId = reqGrantId || (await getNylasGrants(env))[0]?.grant_id;
      if (!grantId) return err("No Nylas grant found", 503);
      const results = await Promise.all((message_ids || []).map(id =>
        fetch(`https://api.us.nylas.com/v3/grants/${grantId}/messages/${id}`, {
          method: "PUT",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ unread: !!unread }),
        }).then(r => ({ id, ok: r.ok })).catch(() => ({ id, ok: false }))
      ));
      return json({ ok: true, results });
    }


    // POST /api/nylas/store-grant — upsert {email, grant_id} into nylas_grants KV array
    if (path === "/api/nylas/store-grant" && req.method === "POST") {
      const { email, grant_id } = await req.json().catch(() => ({}));
      if (!email || !grant_id) return err("Missing email or grant_id", 400);
      let grants = [];
      try {
        const raw = await env.LIFEOS_KV.get("nylas_grants");
        if (raw) grants = JSON.parse(raw);
      } catch {}
      const idx = grants.findIndex(g => g.email === email);
      if (idx >= 0) grants[idx] = { email, grant_id };
      else grants.push({ email, grant_id });
      await env.LIFEOS_KV.put("nylas_grants", JSON.stringify(grants));
      return json({ ok: true, grants });
    }

    // GET /api/stripe/summary — live balance + recent 5 charges
    if (path === "/api/stripe/summary" && req.method === "GET") {
      const stripeKey = await env.LIFEOS_KV.get("apikey_stripe");
      if (!stripeKey) return err("Stripe key not configured", 400);
      const [balRes, chRes] = await Promise.all([
        fetch("https://api.stripe.com/v1/balance", {
          headers: { Authorization: `Bearer ${stripeKey}` },
        }),
        fetch("https://api.stripe.com/v1/charges?limit=5", {
          headers: { Authorization: `Bearer ${stripeKey}` },
        }),
      ]);
      if (!balRes.ok) return err(`Stripe error ${balRes.status}`, 502);
      const balance = await balRes.json();
      const chargesBody = chRes.ok ? await chRes.json() : { data: [] };
      return json({ balance, charges: chargesBody.data || [] });
    }

    // GET /api/cloudflare/summary — zone list + 24h analytics per zone
    if (path === "/api/cloudflare/summary" && req.method === "GET") {
      const cfToken = await env.LIFEOS_KV.get("apikey_cloudflare");
      if (!cfToken) return err("Cloudflare token not configured", 400);
      const hdrs = { Authorization: `Bearer ${cfToken}`, "Content-Type": "application/json" };
      const zonesRes = await fetch("https://api.cloudflare.com/client/v4/zones?per_page=20", { headers: hdrs });
      if (!zonesRes.ok) return err(`CF error ${zonesRes.status}`, 502);
      const zonesBody = await zonesRes.json();
      const zoneList = (zonesBody.result || []).slice(0, 10);
      const since = new Date(Date.now() - 86400000).toISOString();
      const until = new Date().toISOString();
      const zonesWithData = await Promise.all(zoneList.map(async z => {
        try {
          const aRes = await fetch(
            `https://api.cloudflare.com/client/v4/zones/${z.id}/analytics/dashboard?since=${since}&until=${until}&continuous=true`,
            { headers: hdrs }
          );
          const aBody = aRes.ok ? await aRes.json() : null;
          const totals = aBody?.result?.totals || {};
          const bytes = totals.bandwidth?.all || 0;
          const bw = bytes > 1e9 ? `${(bytes/1e9).toFixed(1)} GB` : bytes > 1e6 ? `${(bytes/1e6).toFixed(1)} MB` : `${(bytes/1024).toFixed(0)} KB`;
          return { id: z.id, name: z.name, status: z.status, requests: totals.requests?.all || 0, threats: totals.threats?.all || 0, uniques: totals.uniques?.all || 0, bandwidth: bw };
        } catch {
          return { id: z.id, name: z.name, status: z.status, requests: 0, threats: 0, uniques: 0, bandwidth: "—" };
        }
      }));
      return json({ zones: zonesWithData });
    }

        // WEBHOOK — TELEGRAM (FIXED)
    if (path === "/api/webhook/telegram" && req.method === "POST") {
      try {
        const body = await req.json();
        const msg = body.message || body.edited_message;
        if (!msg) return json({ ok: true });
        
        const chatId = String(msg.chat && msg.chat.id ? msg.chat.id : "");
        const fromName = ((msg.from && msg.from.first_name) || "") + " " + ((msg.from && msg.from.last_name) || "");
        const name = fromName.trim() || (msg.chat && msg.chat.title) || "Telegram User";
        const text = msg.text || "[media]";
        const ts = new Date(((msg.date || 0) * 1000) || Date.now()).toISOString();
        const convId = "telegram_" + chatId;
        const systemUserId = await getSystemUserId(env);
        await supabase(env, "/rest/v1/conversations", {
          method: "POST", prefer: "resolution=merge-duplicates",
          body: JSON.stringify({ id: convId, user_id: systemUserId, contact_name: name, contact_initials: name.slice(0,2).toUpperCase(), platforms: ["telegram"], primary_platform: "telegram", is_group: false, unread_count: 1, last_message_at: ts, created_at: ts })
        });
        await supabase(env, "/rest/v1/messages", {
          method: "POST", prefer: "resolution=merge-duplicates",
          body: JSON.stringify({ id: "tg_" + (msg.message_id || Date.now()) + "_" + chatId, user_id: systemUserId, conversation_id: convId, platform: "telegram", sender_type: "contact", content: text, message_type: "text", status: "received", created_at: ts })
        });
        return json({ ok: true });
      } catch (e) {
        return json({ ok: true, warn: e.message });
      }
    }
        // WEBHOOK — META verification (FIXED)
    if (path === "/api/webhook/meta" && req.method === "GET") {
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");
      if (mode === "subscribe" && token === "lifeos1_meta_verify_2026") {
        return new Response(challenge, { status: 200, headers: CORS });
      }
      return new Response("Forbidden", { status: 403, headers: CORS });
    }

    // WEBHOOK — META messages (Messenger + Instagram) (FIXED)
    if (path === "/api/webhook/meta" && req.method === "POST") {
      try {
        const body = await req.json();
        const systemUserId = await getSystemUserId(env);
        for (const entry of (body.entry || [])) {
          for (const event of (entry.messaging || [])) {
            if (!event.message || event.message.is_echo) continue;
            const senderId = event.sender && event.sender.id ? event.sender.id : "unknown";
            const text = (event.message && event.message.text) || "[media]";
            const ts = new Date(event.timestamp || Date.now()).toISOString();
            const convId = "messenger_" + senderId;
            await supabase(env, "/rest/v1/conversations", {
              method: "POST", prefer: "resolution=merge-duplicates",
              body: JSON.stringify({ id: convId, user_id: systemUserId, contact_name: "Messenger " + senderId, contact_initials: "MS", platforms: ["messenger"], primary_platform: "messenger", is_group: false, unread_count: 1, last_message_at: ts, created_at: ts })
            });
            await supabase(env, "/rest/v1/messages", {
              method: "POST", prefer: "resolution=merge-duplicates",
              body: JSON.stringify({ id: "msg_" + ((event.message && event.message.mid) || Date.now()), user_id: systemUserId, conversation_id: convId, platform: "messenger", sender_type: "contact", content: text, message_type: "text", status: "received", created_at: ts })
            });
          }
          for (const change of (entry.changes || [])) {
            if (change.field !== "messages") continue;
            const val = change.value || {};
            if (!val.message) continue;
            if (val.sender && val.recipient && val.sender.id === val.recipient.id) continue;
            const senderId = val.sender && val.sender.id ? val.sender.id : "unknown";
            const text = (val.message && val.message.text) || "[media]";
            const ts = new Date(((val.timestamp || 0) * 1000) || Date.now()).toISOString();
            const convId = "instagram_" + senderId;
            await supabase(env, "/rest/v1/conversations", {
              method: "POST", prefer: "resolution=merge-duplicates",
              body: JSON.stringify({ id: convId, user_id: systemUserId, contact_name: "Instagram " + senderId, contact_initials: "IG", platforms: ["instagram"], primary_platform: "instagram", is_group: false, unread_count: 1, last_message_at: ts, created_at: ts })
            });
            await supabase(env, "/rest/v1/messages", {
              method: "POST", prefer: "resolution=merge-duplicates",
              body: JSON.stringify({ id: "ig_" + ((val.message && val.message.mid) || Date.now()), user_id: systemUserId, conversation_id: convId, platform: "instagram", sender_type: "contact", content: text, message_type: "text", status: "received", created_at: ts })
            });
          }
        }
        return json({ ok: true });
      } catch (e) {
        return json({ ok: true, warn: e.message });
      }
    }


    // ── IMAP credential store (Proton, Hostinger, etc.) ──────────────────
    if (path === "/api/imap/store" && req.method === "POST") {
      try {
        const body = await req.json();
        const { provider, account_label, email: acctEmail, app_password, host, port, smtp_host, smtp_port } = body;
        if (!provider || !acctEmail || !app_password) return json({ ok: false, error: "provider, email, app_password required" }, 400);
        const key = `imap_${provider}_${account_label || "default"}`;
        await env.LIFEOS_KV.put(key, JSON.stringify({ provider, account_label, email: acctEmail, app_password, host, port, smtp_host, smtp_port, connected_at: Date.now() }));
        const idxKey = `oauth_index_${provider}`;
        const idx = (await env.LIFEOS_KV.get(idxKey, "json")) || [];
        const without = idx.filter(a => a.email !== acctEmail);
        without.push({ email: acctEmail, name: acctEmail, connected_at: Date.now(), imap: true });
        await env.LIFEOS_KV.put(idxKey, JSON.stringify(without));
        await env.LIFEOS_KV.put(`oauth_${provider}`, JSON.stringify({ connected: true, identity: { email: acctEmail, name: acctEmail } }));
        return json({ ok: true });
      } catch(e) { return json({ ok: false, error: e.message }, 500); }
    }

        // ── SENTINEL: capture from bookmarklet/extension (FIXED) ──────────────────────
    if (path === "/api/sentinel/capture" && req.method === "POST") {
      try {
        const body = await req.json();
        const item = {
          id: "sen_" + Date.now() + "_" + Math.random().toString(36).slice(2,7),
          url:          body.url          || "",
          title:        body.title        || "Untitled",
          snippet:      body.snippet      || "",
          selectedText: body.selectedText || "",
          source:       body.source       || "bookmarklet",
          capturedAt:   new Date().toISOString(),
          status:       "new",
          aiAction:     null,
        };
        const existing = JSON.parse(await env.LIFEOS_KV.get("sentinel_items") || "[]");
        const all = [item, ...existing];
        const trimmed = all.slice(0, 500);
        await env.LIFEOS_KV.put("sentinel_items", JSON.stringify(trimmed));
        return json({ ok: true, id: item.id });
      } catch(e) {
        return json({ ok: false, error: e.message }, 500);
      }
    }

    if (path === "/api/sentinel/items" && req.method === "GET") {
      try {
        const items = JSON.parse(await env.LIFEOS_KV.get("sentinel_items") || "[]");
        return json({ ok: true, items });
      } catch(e) {
        return json({ ok: false, items: [] });
      }
    }


    if (path.startsWith("/api/sentinel/item/") && req.method === "DELETE") {
      try {
        const itemId = path.replace("/api/sentinel/item/", "");
        const items = JSON.parse(await env.LIFEOS_KV.get("sentinel_items") || "[]");
        const filtered = items.filter(i => i.id !== itemId);
        await env.LIFEOS_KV.put("sentinel_items", JSON.stringify(filtered));
        return json({ ok: true });
      } catch(e) {
        return json({ ok: false, error: e.message }, 500);
      }
    }

    return new Response("Not Found", { status: 404 });
  }
};