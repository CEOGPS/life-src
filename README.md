# LifeOS1 — Icon Migration: 30 panels, brands + lucide

## What's in this drop

```
src/components/lifeos/icons/Icon.jsx       (NEW — universal renderer)
src/components/lifeos/icons/BrandIcon.jsx  (already in place; included for safety)
src/components/lifeos/panels/*.jsx         (all 30 panels, ~233 emoji swaps)
```

## What changed

1. New universal `<Icon name="..." />` component that handles:
   - Real brand SVGs (instagram, facebook, linkedin, x, tiktok, youtube,
     reddit, meta, whatsapp, telegram, signal, snapchat, gmail, google,
     outlook, apple, anthropic, claude, openai, chatgpt, gemini,
     deepseek, xai, grok, copilot) — via simple-icons + inline SVG for
     brands simple-icons doesn't ship.
   - Lucide UI icons (search, bell, settings, etc.) — 150+ glyphs.
   - Emoji passthrough — anything not mapped renders as text fallback
     so nothing crashes if I missed a slug.

2. Mechanically swapped 233 emoji spots across 30 panels:
   - First pass (29 swaps): `<span style={{fontSize:N}}>EMOJI</span>` → `<Icon name="EMOJI" size={N} />`
   - Second pass (204 swaps): `>EMOJI<` → `><Icon name="EMOJI" size={14} /><`
   - Every modified panel had `import Icon from "@/components/lifeos/icons/Icon"` injected at the top.

## Drop in + build

```powershell
cd C:\Users\caged\LifeOS1
Remove-Item -Recurse -Force dist, node_modules\.vite -ErrorAction SilentlyContinue
npm run build
```

Deploy normally.

## What you'll see

- Social platform tabs: real Instagram/Facebook/LinkedIn/X/TikTok/YouTube/Reddit SVG logos.
- Messages platform filters: real branded icons for IG/WhatsApp/Telegram/Signal/Snapchat. SMS/Messenger/Google Voice render as colored monogram disc (not in simple-icons).
- Integrations/AI Models panels: real Claude/OpenAI/Gemini/DeepSeek/Grok/Copilot logos.
- All other panels: lucide vector icons for search, bell, calendar, etc. instead of emoji.

## What's NOT changed

- Emojis inside data props (e.g., `name: "🔥 Hot"`) — kept as labels.
- Emojis inside text strings (e.g., `"You earned 🏆"`) — kept as content.
- Mood pickers, agent personalities, content-emoji where the emoji IS the meaning.

This is intentional — those are content, not UI chrome.

## Verify after build

The build should print transformed module count + dist summary.
If it succeeds, deploy. Brand icons render immediately, no migration step.

## If something breaks

The Icon component falls back to text rendering for any unmapped name,
so the worst case is "looks like before" (emoji still there) — not a crash.
Tell me which icon looks wrong and I'll map it.
