// LifeOS1 Helper Agents — Cloudflare Worker
// Each agent is a self-contained async function that can be triggered via:
//   POST /api/agents/run { agent: "agentId", payload: {...} }
//   GET  /api/agents/status
//   GET  /api/agents/logs

const ANTHROPIC_MODEL = "claude-sonnet-4-20250514";

// ── Core AI call ──────────────────────────────────────────────────────────────
async function callClaude(env, prompt, system = "") {
  const key = env.ANTHROPIC_API_KEY || "";
  if (!key) return "No ANTHROPIC_API_KEY set in Worker secrets.";
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 1024,
      system: system || "You are a LifeOS1 helper agent for Chris Green, CEO GPS, Atlanta GA.",
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const d = await res.json();
  return d?.content?.[0]?.text || "No response";
}

// ── Telegram helper ───────────────────────────────────────────────────────────
async function sendTelegram(env, text, chatId = null) {
  const token = env.TELEGRAM_BOT_TOKEN || ""; // set via: wrangler secret put TELEGRAM_BOT_TOKEN
  const chat = chatId || env.TELEGRAM_OWNER_CHAT_ID || "";
  if (!chat) return { ok: false, error: "No chat_id — set TELEGRAM_OWNER_CHAT_ID in secrets" };
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chat, text, parse_mode: "Markdown" }),
  });
  return await res.json();
}

// ── Log helper ────────────────────────────────────────────────────────────────
async function logRun(env, agentId, result, status = "ok") {
  const key = `agent_log_${agentId}`;
  const existing = await env.LIFEOS_KV.get(key, "json") || [];
  existing.unshift({ ts: Date.now(), status, result: String(result).slice(0, 500) });
  await env.LIFEOS_KV.put(key, JSON.stringify(existing.slice(0, 50)));
}

// ════════════════════════════════════════════════════════════════════════════
// AGENT DEFINITIONS
// ════════════════════════════════════════════════════════════════════════════

const AGENTS = {

  // ── Agent 1: Content Writer ──────────────────────────────────────────────
  // Generates social posts, email copy, blog drafts on demand
  "content-writer": {
    name: "Content Writer",
    desc: "Generates marketing copy, social posts, email drafts",
    async run(env, payload) {
      const { type = "social", topic = "", platform = "Instagram", tone = "professional" } = payload;
      const prompts = {
        social: `Write a ${tone} ${platform} post about: "${topic}". For CEO GPS, a digital marketing company in Atlanta run by Chris Green. Include relevant hashtags. Max 280 chars for X, longer for others. Return ONLY the post text.`,
        email: `Write a ${tone} email about: "${topic}". For CEO GPS Atlanta. Include subject line. Professional but approachable.`,
        blog: `Write a 300-word blog post intro about: "${topic}". For CEO GPS's blog. SEO-optimized for Atlanta marketing.`,
      };
      const result = await callClaude(env, prompts[type] || prompts.social,
        "You are Aurora, CEO GPS's creative content agent. Write compelling, authentic marketing content.");
      await sendTelegram(env, `✨ *Content Writer*\n\n${result}`);
      return result;
    }
  },

  // ── Agent 2: Lead Qualifier ──────────────────────────────────────────────
  // Takes a lead's info and scores/qualifies them
  "lead-qualifier": {
    name: "Lead Qualifier",
    desc: "Scores and qualifies incoming leads, suggests next action",
    async run(env, payload) {
      const { name, company, source, notes, budget } = payload;
      const result = await callClaude(env,
        `Qualify this lead for CEO GPS (digital marketing agency, Atlanta):
Name: ${name || "Unknown"}
Company: ${company || "Unknown"}
Source: ${source || "Unknown"}
Notes: ${notes || "None"}
Budget: ${budget || "Unknown"}

Return JSON: { "score": 1-10, "tier": "Hot/Warm/Cold", "next_action": "...", "pitch_angle": "...", "estimated_value": "$..." }
Return ONLY valid JSON.`,
        "You are Zero, CEO GPS's lead intelligence agent. Score leads with brutal precision.");
      try {
        const data = JSON.parse(result.replace(/```json|```/g, "").trim());
        const msg = `🎯 *Lead Qualifier*\n\n*${name}* (${company})\nScore: ${data.score}/10 — ${data.tier}\nNext: ${data.next_action}\nEstimated: ${data.estimated_value}`;
        await sendTelegram(env, msg);
        return data;
      } catch { return { raw: result }; }
    }
  },

  // ── Agent 3: Daily Briefing ───────────────────────────────────────────────
  // Sends Chris a morning summary to Telegram
  "daily-briefing": {
    name: "Daily Briefing",
    desc: "Sends morning summary: tasks, leads, priorities via Telegram",
    async run(env, payload) {
      // Pull data from KV
      const crm = await env.LIFEOS_KV.get("crm_contacts", "json") || [];
      const hotLeads = crm.filter(c => c.tag === "Hot" || c.stage === "Proposal" || c.stage === "Negotiation").slice(0, 5);
      const tasks = await env.LIFEOS_KV.get("lifeos_tasks", "json") || [];
      const pendingTasks = tasks.filter(t => !t.done).slice(0, 5);

      const briefing = await callClaude(env,
        `Generate a sharp morning briefing for Chris Green, CEO GPS, Atlanta.
Hot leads: ${JSON.stringify(hotLeads.map(l => ({ name: l.name, stage: l.stage, value: l.value })))}
Pending tasks: ${JSON.stringify(pendingTasks.map(t => t.title || t.text || t.name))}
Date: ${new Date().toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric" })}

Write a motivating, actionable briefing. Max 300 words. No fluff.`,
        "You are AgentZero. Deliver crisp intelligence briefings.");

      const msg = `🌅 *LifeOS1 Daily Briefing*\n_${new Date().toLocaleDateString()}_\n\n${briefing}`;
      await sendTelegram(env, msg);
      return briefing;
    }
  },

  // ── Agent 4: SEO Auditor ─────────────────────────────────────────────────
  // Audits a URL or topic for SEO gaps
  "seo-auditor": {
    name: "SEO Auditor",
    desc: "Audits pages/topics for SEO and gives actionable fixes",
    async run(env, payload) {
      const { url = "", keywords = [] } = payload;
      const result = await callClaude(env,
        `Perform an SEO audit for CEO GPS (ceogps.com), a digital marketing business in Atlanta.
${url ? `Focus URL: ${url}` : ""}
${keywords.length ? `Target keywords: ${keywords.join(", ")}` : ""}

Give top 5 actionable fixes with priority (High/Med/Low) and estimated impact. Format clearly.`,
        "You are Viper, CEO GPS's SEO intelligence agent. Be precise and data-driven.");
      await sendTelegram(env, `🔍 *SEO Audit*\n\n${result}`);
      return result;
    }
  },

  // ── Agent 5: Review Responder ────────────────────────────────────────────
  // Drafts professional responses to Google/Yelp reviews
  "review-responder": {
    name: "Review Responder",
    desc: "Drafts professional responses to Google/Yelp reviews",
    async run(env, payload) {
      const { review, rating = 5, platform = "Google", reviewer = "a customer" } = payload;
      const result = await callClaude(env,
        `Write a professional, warm response to this ${rating}-star ${platform} review from ${reviewer}:

"${review}"

For CEO GPS, Atlanta digital marketing. Sound human, grateful, address any concerns. Under 150 words.`,
        "You are Aurora. Write authentic, professional review responses that build trust.");
      await sendTelegram(env, `💬 *Review Response Draft*\n\n${result}`);
      return result;
    }
  },

  // ── Agent 6: Competitor Monitor ──────────────────────────────────────────
  // Analyzes competitor positioning and suggests counter-moves
  "competitor-intel": {
    name: "Competitor Intel",
    desc: "Analyzes competitor positioning and suggests counter-moves",
    async run(env, payload) {
      const { competitor = "", market = "Atlanta digital marketing" } = payload;
      const result = await callClaude(env,
        `Analyze the competitive landscape for CEO GPS in ${market}.
${competitor ? `Focus on competitor: ${competitor}` : "General market analysis"}

Provide: positioning gaps CEO GPS can own, 3 immediate counter-moves, 1 blue-ocean opportunity.`,
        "You are Nova. Strategic competitive intelligence. See the full chessboard.");
      await sendTelegram(env, `📊 *Competitor Intel*\n\n${result}`);
      return result;
    }
  },

  // ── Agent 7: Make.com Trigger ────────────────────────────────────────────
  // Triggers Make.com scenarios via webhook
  "make-trigger": {
    name: "Make.com Trigger",
    desc: "Triggers Make.com automation scenarios",
    async run(env, payload) {
      const { webhook_url, data = {} } = payload;
      if (!webhook_url) return { error: "webhook_url required" };
      const res = await fetch(webhook_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "lifeos1", timestamp: Date.now(), ...data }),
      });
      const result = { status: res.status, ok: res.ok };
      await sendTelegram(env, `🔄 *Make.com Triggered*\nStatus: ${res.status} ${res.ok ? "✅" : "❌"}`);
      return result;
    }
  },

};

// ════════════════════════════════════════════════════════════════════════════
// ROUTER — export for use in main worker
// ════════════════════════════════════════════════════════════════════════════

export async function handleAgents(path, req, env) {
  const CORS = { "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Methods":"GET,POST,OPTIONS", "Access-Control-Allow-Headers":"Content-Type" };
  const json = (d, s=200) => new Response(JSON.stringify(d), { status:s, headers:{...CORS,"Content-Type":"application/json"} });

  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  // GET /api/agents — list all agents
  if (path === "/api/agents" && req.method === "GET") {
    return json(Object.entries(AGENTS).map(([id, a]) => ({ id, name: a.name, desc: a.desc })));
  }

  // POST /api/agents/run — run an agent
  if (path === "/api/agents/run" && req.method === "POST") {
    const { agent: agentId, payload = {} } = await req.json();
    const agent = AGENTS[agentId];
    if (!agent) return json({ error: `Unknown agent: ${agentId}` }, 404);
    try {
      const result = await agent.run(env, payload);
      await logRun(env, agentId, JSON.stringify(result), "ok");
      return json({ ok: true, agent: agentId, result });
    } catch(e) {
      await logRun(env, agentId, e.message, "error");
      return json({ ok: false, error: e.message }, 500);
    }
  }

  // GET /api/agents/logs/:agentId
  if (path.startsWith("/api/agents/logs/") && req.method === "GET") {
    const agentId = path.replace("/api/agents/logs/", "");
    const logs = await env.LIFEOS_KV.get(`agent_log_${agentId}`, "json") || [];
    return json(logs);
  }

  // GET /api/agents/status — all agents + last run
  if (path === "/api/agents/status" && req.method === "GET") {
    const status = {};
    for (const id of Object.keys(AGENTS)) {
      const logs = await env.LIFEOS_KV.get(`agent_log_${id}`, "json") || [];
      status[id] = { name: AGENTS[id].name, lastRun: logs[0] || null, totalRuns: logs.length };
    }
    return json(status);
  }

  return null; // not handled
}
