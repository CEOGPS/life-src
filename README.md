# LifeOS1 — Personal Life Operating System

**One Login. Your Entire Life.**

LifeOS1 is a secure, AI-powered personal command center / super-app that unifies social, CRM, family, calendar, finance, projects, email, community, learning, entertainment, and **autonomous AI agents** (Erebus + Kranos core) into a single privacy-first dashboard.

It replaces dozens of fragmented apps with intelligent, proactive, cross-domain tools that turn your data into action — at zero or near-zero cost.

## Current Status & Vision (from original plan)

- **Dashboard**: Polished grid with live widgets (tasks, finance, social, calendar, AI ideas, to-dos, YouTube/Music quick access). Data syncs via localStorage + persistBridge to Cloudflare KV.
- **Core Agents** (the heart of the system):
  - **Erebus** (Autonomous Operator): Local-first synthetic intelligence. Owns routines, browser control, media gen, lead handling, email drafting, deployments, family schedule protection. Strong identity/soul + tools. Prioritizes local models (Ollama, web-llm, Groq free tier etc.). "Never say you are Claude/GPT".
  - **Kranos** (Strategist Coworker): 3-tier memory, goals, decisions, long-term planning, sub-agent spawning. Complements Erebus.
  - **Agent Dock**: Animated, draggable, voice-enabled "FaceTime-like" presence for the agents (multiple personas: Erebus, Kranos, Zero, Inferno, Nova...). They talk, react, and act autonomously.
- **Email**: Real multi-account Gmail + Outlook (OAuth), labels, full threads, send/draft, AI context-aware drafting. (Expansion work being fully integrated.)
- **Simulators & Unique Features** (per original spec): DreamForge (branching immersive future-life sim), Opportunity Engine, LifeOS Pulse (cross-domain audit), Fantasy Friend, Narrative engines, etc. — these are deep interactive systems, not plain chats.
- **Other**: CRM, Tasks, Finance, Social Hub, Media, Projects, KPI, Terminal, full theming, cross-device persist, CEO GPS business integration.

**Architecture (adapted)**: Vite + React SPA (Cloudflare Pages) + Cloudflare Workers (KV, email sync, tools) + advanced_agent/ (Python FastAPI autonomous runtime) + local LLM options. No forced dependence on any single external frontier model.

See `Docs/LifeOS1 Synopsis.xlsx` (and the .txt summary) for the full original collaborative vision, feature list, and differentiation (Opportunity Engine, Conflict Resolver, immersive simulators, privacy vault, ethical lead gen, etc.).

## Quick Start

```bash
bun install
bun run dev          # http://localhost:5173
bun run build
bun run deploy       # wrangler pages (after login)
```

For Electron: `ELECTRON=true bun run build && electron-builder`

## Key Folders (after cleanup)

- `src/LifeOSShell.jsx` — Main app shell + panel router + AgentDock
- `src/components/lifeos/panels/` — All modules (Dashboard, ErebusPanel, KranosPanel, EmailPanel, simulators...)
- `src/lib/agents/erebus/` & `kranos/` — The autonomous cores (ErebusCore, tools, local models, etc.)
- `advanced_agent/` — Standalone Python multi-LLM autonomous backend (keep separate)
- `worker/` — Cloudflare worker endpoints (email, KV, meta, etc.)
- `archive/` — Historical experiments / unneeded (ai_assistant, browser_agent moved here)
- `public/agents/` — Avatar images for the dock

## Principles (for this project)

- Erebus & Kranos are **autonomous first** — local reasoning + tools before any external LLM call.
- Respect the original plan: immersive simulators, real email depth, agents that *act* across life/business, privacy/ownership.
- Clean, maintainable structure (no root pollution, clear agent boundaries).
- Bun only. .jsx for UI components.

This is Chris Green's personal LifeOS (with sanitized client versions planned later). The website comes *after* we get the agents, dock, email, simulators, and dashboard right.

Let's build it properly.
