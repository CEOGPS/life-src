import { useState, useCallback, useEffect } from "react";
import { invokeLLM } from "@/api/ceogpsclient";

const C = { dark: "#0a0b12", card: "#1a1e2e", white: "#f0ede8", black: "#111318", gold: "#ffd700", red: "#ff4f5e", teal: "#00c896", purple: "#8b7fff", blue: "#4ab3f4", orange: "#ff8c42" };

// ── Static starter deck ──────────────────────────────────────────────────────
const STARTER_BLACK = [
  "The real reason I-285 is always backed up: ___.",
  "HR's email subject line of the year: ___.",
  "My therapist finally told me the truth: ___.",
  "The one thing nobody mentions at the Atlanta Chamber of Commerce: ___.",
  "Millennials can't afford houses because of ___.",
  "During the quarterly review, the CEO accidentally revealed ___.",
  "The startup pitch: 'We're basically Uber, but for ___.'",
  "What they don't tell you in the wedding vows: ___.",
  "My LinkedIn headline: 'Passionate about ___ and making it everyone's problem.'",
  "The real five stages of grief: denial, anger, bargaining, ___, and ordering Waffle House at 2am.",
  "At my funeral, please play ___ and tell everyone I died doing what I loved: ___.",
  "The app nobody asked for but Silicon Valley funded anyway: ___ for ___.",
  "What Grandma actually meant at Thanksgiving: ___.",
  "The reason the company went under: surprisingly, it was ___.",
  "I told my kids I was working from home. I was actually ___.",
  "The plot twist nobody saw coming: the villain was ___ all along.",
  "Atlanta summers feel like ___ wearing ___ in a ___ with no AC.",
  "My side hustle: professionally ___.",
  "The one text I should never have sent: ___.",
  "The secret ingredient in every successful Atlanta business: ___.",
  "New diet plan: replace breakfast with ___, lunch with regret, dinner with ___.",
  "The last thing you want to hear your boss say over Zoom: ___.",
  "My love language is ___, but my bank statement says ___.",
  "Scientists have finally confirmed that ___ is, in fact, a personality disorder.",
  "The thing that finally killed small talk: ___.",
];

const STARTER_WHITE = [
  "Aggressively mediocre LinkedIn content",
  "Crying in a Chick-fil-A parking lot",
  "A passive-aggressive Slack message",
  "Declaring bankruptcy at Dave & Buster's",
  "A subscription you forgot to cancel three years ago",
  "Your uncle's conspiracy podcast",
  "Weaponized eye contact",
  "A motivational poster about synergy",
  "Sending 'per my last email' and meaning war",
  "The audacity of middle management",
  "Existing in Atlanta traffic for 45 minutes to go 2 miles",
  "Telling someone you're an entrepreneur",
  "A participation trophy from 1997",
  "Crying but making it a brand",
  "Starting a podcast about productivity",
  "Bringing up your zodiac sign as a personality",
  "Accidentally replying-all",
  "A LinkedIn connection request from someone you actively avoid",
  "Asking if the meeting could've been an email",
  "The hollow eyes of someone on their fourth Zoom call",
  "Putting 'visionary' in your email signature",
  "A food truck that only sells one thing and runs out in 20 minutes",
  "Unsubscribing from a mailing list and still getting emails",
  "Your ex's new personality",
  "Calling a 10-minute task 'a deep dive'",
  "Describing yourself as 'passionate' without elaborating",
  "A group chat that never should have existed",
  "The phrase 'circle back'",
  "Starting over at 40 with a dream and no plan",
  "Posting gym selfies as a coping mechanism",
  "Telling someone their energy is 'a lot'",
  "A business loan spent on vibes",
  "The look your dog gives you during a work call",
  "An MLM pitch disguised as a coffee chat",
  "Unsolicited financial advice from someone in debt",
  "Moving back in with your parents to 'save up'",
  "A Twitter thread nobody asked for",
  "Calling yourself a 'creative' while refusing all structure",
  "A three-hour meeting that could've been a text",
  "The sunk cost of a gym membership",
  "A notification from an app you downloaded once in 2019",
  "Manifesting instead of applying",
  "Putting Wakanda Forever in your bio",
  "An NFT your cousin sold you",
  "Emotional support purchases from Amazon at 11pm",
  "The audacity to charge that much for a salad",
  "A 'no drama' person causing all the drama",
  "Explaining your personality using Myers-Briggs",
  "An exit interview where you finally say everything",
  "The fifth 'final reminder' email",
];

const DECK_THEMES = [
  { id: "corporate",   label: "💼 Corporate Hell",  desc: "Meetings, HR, and the slow death of the soul" },
  { id: "atlanta",     label: "🍑 Atlanta Life",    desc: "Traffic, heat, Chick-fil-A, and gentrification" },
  { id: "millennial",  label: "😭 Millennial Pain", desc: "Debt, avocado toast, and existential dread"    },
  { id: "social",      label: "📱 Social Media",    desc: "Influencers, LinkedIn, and clout chasing"       },
  { id: "family",      label: "🦃 Family Drama",    desc: "Thanksgiving, group chats, and passive aggression" },
  { id: "startup",     label: "🚀 Startup Chaos",   desc: "Disruption, pivot culture, and burning cash"    },
];

const DIFFICULTY = [
  { id: "mild",  label: "😈 Edgy",    desc: "Dark but office-safe" },
  { id: "dark",  label: "🖤 Dark",    desc: "Legitimately uncomfortable" },
  { id: "abyss", label: "🕳️ The Abyss", desc: "No going back" },
];

// ── AI prompts ────────────────────────────────────────────────────────────────
function buildBlackCardSystem(theme, difficulty) {
  const diffMap = {
    mild:  "edgy but workplace-safe — uncomfortable but not crossing any lines",
    dark:  "genuinely dark, bleak, or cringe — no explicit content but emotionally devastating humor",
    abyss: "deeply cynical, existentially horrifying, or so accurate it hurts — still no explicit content",
  };
  return `You are an AI card generator for a dark humor party game inspired by Cards Against Humanity. Generate ONLY the cards, no explanation.

Tone: ${diffMap[difficulty] || diffMap.dark}
Theme focus: ${theme}
Location context: Atlanta, GA

Generate 1 BLACK CARD (the prompt with a ___ blank). Rules:
- 8-20 words
- Must be a fill-in-the-blank or pick-two scenario
- Dark, bleak, cringe, or absurdist humor
- No explicit sexual content, slurs, or content targeting real private individuals
- Reference real life (corporate culture, family, social media, Atlanta, relationships, money) in uncomfortable ways
- Make the blank feel wide open for horrifying answers

Return ONLY the card text. No quotes, no explanation. Example format: "The real reason nobody at this company gets promoted: ___.";`;
}

function buildWhiteCardSystem(blackCard, count, difficulty) {
  return `You are generating answer cards for a dark humor card game. Fill the blank in this black card with ${count} funny, dark, cringe, or absurdist answers.

Black card: "${blackCard}"

Rules:
- Each answer: 3-12 words, punchy, standalone
- Dark, bleak, uncomfortable, or painfully relatable humor
- No explicit sexual content or slurs
- Think: LinkedIn culture, existential dread, corporate dysfunction, family dysfunction, social media cringe, Atlanta life, millennial/Gen-Z pain, startup BS
- Answers should range from painfully accurate to completely absurd

Return ONLY a JSON array of ${count} strings. Example: ["answer one", "answer two"]`;
}

function buildJudgeSystem() {
  return `You are the AI Card Czar for a dark humor party game. Score the submitted answer card for this round.

Return ONLY valid JSON: { "score": 8, "verdict": "one of: Devastating | Painfully Accurate | Chaotic Neutral | Too Real | Unhinged | Peak Cringe | Actually Funny | Deeply Wrong | Chef's Kiss", "reaction": "1-sentence funny reaction from the Czar (in character as a disappointed judge)" }`;
}

function parseJSON(raw) {
  try { const m = raw.match(/[\[{][\s\S]*[\]}]/); return m ? JSON.parse(m[0]) : null; } catch { return null; }
}

// ── Card components ───────────────────────────────────────────────────────────
function BlackCard({ text, loading }) {
  return (
    <div style={{ background: C.black, border: "2px solid rgba(255,255,255,0.15)", borderRadius: 16, padding: "24px 22px", minHeight: 140, display: "flex", flexDirection: "column", justifyContent: "space-between", boxShadow: "0 8px 32px rgba(0,0,0,0.6)" }}>
      {loading ? (
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          {[0,1,2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: C.white, animation: `cardPulse 1.2s ${i*0.2}s ease-in-out infinite` }} />)}
        </div>
      ) : (
        <div style={{ fontSize: 17, fontWeight: 700, color: C.white, lineHeight: 1.6 }}>{text}</div>
      )}
      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 12, textAlign: "right" }}>VOID CARDS™</div>
    </div>
  );
}

function WhiteCard({ text, selected, onClick, revealed, score, verdict, reaction, disabled }) {
  return (
    <div onClick={!disabled ? onClick : undefined}
      style={{ background: selected ? C.white : "rgba(255,255,255,0.94)", border: `2px solid ${selected ? C.gold : "transparent"}`, borderRadius: 12, padding: "12px 14px", cursor: disabled ? "default" : "pointer", transition: "all 0.15s", transform: selected ? "scale(1.02)" : "scale(1)", boxShadow: selected ? `0 4px 20px ${C.gold}40` : "0 2px 8px rgba(0,0,0,0.3)", minHeight: 70 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: C.black, lineHeight: 1.5 }}>{text}</div>
      {revealed && score !== undefined && (
        <div style={{ marginTop: 8, padding: "4px 8px", borderRadius: 6, background: C.black, display: "inline-block" }}>
          <span style={{ fontSize: 10, color: C.gold, fontWeight: 700 }}>{score}/10 · {verdict}</span>
        </div>
      )}
      {revealed && reaction && (
        <div style={{ marginTop: 4, fontSize: 10, color: "#555", fontStyle: "italic" }}>{reaction}</div>
      )}
    </div>
  );
}

// ── Score board ───────────────────────────────────────────────────────────────
function Scoreboard({ players, czarIndex }) {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {sorted.map((p, i) => (
        <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 10px", borderRadius: 8, background: i === 0 ? `${C.gold}15` : "rgba(255,255,255,0.03)" }}>
          <span style={{ fontSize: 12 }}>{i === 0 ? "👑" : i === 1 ? "🥈" : i === 2 ? "🥉" : "  "}</span>
          <span style={{ flex: 1, fontSize: 12, color: "#f0ede8", fontWeight: i === 0 ? 700 : 400 }}>{p.name}</span>
          {czarIndex === players.indexOf(p) && <span style={{ fontSize: 9, color: C.purple, fontWeight: 700 }}>CZAR</span>}
          <span style={{ fontSize: 13, fontWeight: 700, color: C.gold }}>{p.score} ⚫</span>
        </div>
      ))}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function DarkCardGame({ onBack }) {
  const [screen, setScreen] = useState("setup"); // setup | game | results

  // Setup
  const [players,    setPlayers]    = useState([{ id: 1, name: "Chris", score: 0 }, { id: 2, name: "Player 2", score: 0 }]);
  const [newName,    setNewName]    = useState("");
  const [theme,      setTheme]      = useState("corporate");
  const [difficulty, setDifficulty] = useState("dark");
  const [winScore,   setWinScore]   = useState(7);

  // Game state
  const [round,        setRound]        = useState(1);
  const [czarIndex,    setCzarIndex]    = useState(0);
  const [blackCard,    setBlackCard]    = useState("");
  const [whiteCards,   setWhiteCards]   = useState([]); // [{text, playerId}]
  const [selectedCard, setSelectedCard] = useState(null); // index into whiteCards
  const [phase,        setPhase]        = useState("play"); // play | reveal | winner
  const [judgingIdx,   setJudgingIdx]   = useState(null);
  const [judgements,   setJudgements]   = useState({}); // cardIndex -> {score, verdict, reaction}
  const [winner,       setWinner]       = useState(null);
  const [genLoading,   setGenLoading]   = useState(false);
  const [customInput,  setCustomInput]  = useState("");
  const [showDeckBuilder, setShowDeckBuilder] = useState(false);
  const [customBlack,  setCustomBlack]  = useState([]);
  const [customWhite,  setCustomWhite]  = useState([]);

  // Round history
  const [history, setHistory] = useState([]);

  // ── Helpers ──────────────────────────────────────────────────────────────
  const nonCzarPlayers = players.filter((_, i) => i !== czarIndex);
  const czar = players[czarIndex];

  function addPlayer() {
    if (!newName.trim() || players.length >= 8) return;
    setPlayers(p => [...p, { id: Date.now(), name: newName.trim(), score: 0 }]);
    setNewName("");
  }
  function removePlayer(id) { if (players.length > 2) setPlayers(p => p.filter(x => x.id !== id)); }

  // ── Deal a round ──────────────────────────────────────────────────────────
  const dealRound = useCallback(async (currentBlack) => {
    setGenLoading(true);
    setPhase("play");
    setSelectedCard(null);
    setJudgements({});
    setWinner(null);

    // Pick black card
    let black = currentBlack;
    if (!black) {
      const allBlack = [...STARTER_BLACK, ...customBlack];
      black = allBlack[Math.floor(Math.random() * allBlack.length)];
    }
    setBlackCard(black);

    // Pick white cards — 4 per non-czar player (min 8 total shown)
    const allWhite = [...STARTER_WHITE, ...customWhite];
    const shuffled = [...allWhite].sort(() => Math.random() - 0.5);
    const count = Math.max(8, nonCzarPlayers.length * 2);
    const hand = shuffled.slice(0, count).map((text, i) => ({
      text, playerId: nonCzarPlayers[i % nonCzarPlayers.length]?.id || players[0].id
    }));
    setWhiteCards(hand);
    setGenLoading(false);
  }, [nonCzarPlayers, customBlack, customWhite, players]);

  // ── AI generate new cards ─────────────────────────────────────────────────
  const aiGenerateRound = useCallback(async () => {
    setGenLoading(true);
    setPhase("play");
    setSelectedCard(null);
    setJudgements({});
    setWinner(null);

    // Generate black card
    const blackRaw = await invokeLLM({ systemPrompt: buildBlackCardSystem(theme, difficulty), prompt: "Generate 1 dark humor black card now." }).catch(() => "");
    const newBlack = blackRaw.trim().replace(/^["']|["']$/g, "") || STARTER_BLACK[Math.floor(Math.random() * STARTER_BLACK.length)];
    setBlackCard(newBlack);

    // Generate white cards
    const whiteRaw = await invokeLLM({ systemPrompt: buildWhiteCardSystem(newBlack, 10, difficulty), prompt: "Generate 10 answer cards now." }).catch(() => "[]");
    const parsed = parseJSON(whiteRaw);
    const whites = Array.isArray(parsed) ? parsed : STARTER_WHITE.sort(() => Math.random() - 0.5).slice(0, 10);
    setWhiteCards(whites.map((text, i) => ({ text: String(text), playerId: nonCzarPlayers[i % Math.max(nonCzarPlayers.length, 1)]?.id || players[0].id })));
    setGenLoading(false);
  }, [theme, difficulty, nonCzarPlayers, players]);

  // ── Start game ────────────────────────────────────────────────────────────
  function startGame() {
    setRound(1);
    setCzarIndex(0);
    setPlayers(p => p.map(x => ({ ...x, score: 0 })));
    setHistory([]);
    setScreen("game");
    dealRound(null);
  }

  // ── Submit card (Czar picks winner) ──────────────────────────────────────
  async function submitPick() {
    if (selectedCard === null) return;
    setPhase("reveal");

    // AI judge the winning card
    setJudgingIdx(selectedCard);
    const card = whiteCards[selectedCard];
    const judgeRaw = await invokeLLM({
      systemPrompt: buildJudgeSystem(),
      prompt: `Black card: "${blackCard}"\nSubmitted answer: "${card.text}"\nJudge this answer.`
    }).catch(() => "{}");
    const judgement = parseJSON(judgeRaw) || { score: 7, verdict: "Actually Funny", reaction: "I've seen worse. Which is saying something." };
    setJudgements({ [selectedCard]: judgement });

    // Award point to player who submitted that card
    const winnerId = card.playerId;
    const winnerPlayer = players.find(p => p.id === winnerId);
    setWinner(winnerPlayer);
    setPlayers(prev => prev.map(p => p.id === winnerId ? { ...p, score: p.score + 1 } : p));

    // Add to history
    setHistory(h => [...h, { round, black: blackCard, white: card.text, winner: winnerPlayer?.name, verdict: judgement.verdict }]);

    setPhase("winner");
  }

  // ── Next round ────────────────────────────────────────────────────────────
  function nextRound() {
    const gameWinner = players.find(p => p.score >= winScore);
    if (gameWinner) { setScreen("results"); return; }
    const nextCzar = (czarIndex + 1) % players.length;
    setCzarIndex(nextCzar);
    setRound(r => r + 1);
    dealRound(null);
  }

  useEffect(() => { if (screen === "game" && blackCard === "") dealRound(null); }, [screen]);

  // Styles
  const inp = { padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "#0a0b12", fontSize: 12, color: "#f0ede8", outline: "none", boxSizing: "border-box" };
  const btnS = (col) => ({ padding: "7px 16px", borderRadius: 8, background: `${col}15`, border: `1px solid ${col}40`, color: col, fontSize: 11, fontWeight: 600, cursor: "pointer" });

  // ── SETUP SCREEN ──────────────────────────────────────────────────────────
  if (screen === "setup") return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ background: `linear-gradient(135deg, #0a0b12, #1a1020)`, borderBottom: "1px solid rgba(255,255,255,0.1)", padding: "14px 20px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={onBack} style={{ background: "none", border: "none", color: "#6aaedd", fontSize: 11, cursor: "pointer", padding: 0 }}>← Back</button>
          <span style={{ color: "#2a3a4a" }}>|</span>
          <span style={{ fontSize: 20 }}>⚫</span>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: C.white }}>VOID CARDS</div>
            <div style={{ fontSize: 11, color: "#6aaedd" }}>A dark humor party game for deeply flawed people</div>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
        <div style={{ maxWidth: 580, margin: "0 auto" }}>

          {/* Players */}
          <div style={{ background: "#11131f", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 18, marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontWeight: 700, marginBottom: 12 }}>PLAYERS (2–8)</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
              {players.map((p, i) => (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: `${[C.gold, C.purple, C.teal, C.orange, C.blue, C.red][i % 6]}20`, border: `1px solid ${[C.gold, C.purple, C.teal, C.orange, C.blue, C.red][i % 6]}50`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: [C.gold, C.purple, C.teal, C.orange, C.blue, C.red][i % 6], fontWeight: 700 }}>{i + 1}</div>
                  <input value={p.name} onChange={e => setPlayers(prev => prev.map(x => x.id === p.id ? { ...x, name: e.target.value } : x))}
                    style={{ ...inp, flex: 1 }} />
                  {players.length > 2 && <button onClick={() => removePlayer(p.id)} style={{ background: "none", border: "none", color: C.red, cursor: "pointer", fontSize: 16 }}>×</button>}
                </div>
              ))}
            </div>
            {players.length < 8 && (
              <div style={{ display: "flex", gap: 8 }}>
                <input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === "Enter" && addPlayer()}
                  placeholder="Add player name..." style={{ ...inp, flex: 1 }} />
                <button onClick={addPlayer} style={{ padding: "8px 16px", borderRadius: 8, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)", color: C.white, fontSize: 12, cursor: "pointer" }}>Add</button>
              </div>
            )}
          </div>

          {/* Theme */}
          <div style={{ background: "#11131f", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 18, marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontWeight: 700, marginBottom: 10 }}>DECK THEME (AI mode)</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {DECK_THEMES.map(t => (
                <button key={t.id} onClick={() => setTheme(t.id)}
                  style={{ padding: "10px 12px", borderRadius: 10, border: `1px solid ${theme === t.id ? C.white : "rgba(255,255,255,0.08)"}`, background: theme === t.id ? "rgba(255,255,255,0.1)" : "transparent", color: theme === t.id ? C.white : "#6aaedd", cursor: "pointer", textAlign: "left" }}>
                  <div style={{ fontSize: 12, fontWeight: theme === t.id ? 700 : 400 }}>{t.label}</div>
                  <div style={{ fontSize: 9, color: "#4a5568", marginTop: 2 }}>{t.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Difficulty + Win score */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
            <div style={{ background: "#11131f", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 16 }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontWeight: 700, marginBottom: 10 }}>DARKNESS LEVEL</div>
              {DIFFICULTY.map(d => (
                <button key={d.id} onClick={() => setDifficulty(d.id)}
                  style={{ display: "block", width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${difficulty === d.id ? C.red : "rgba(255,255,255,0.06)"}`, background: difficulty === d.id ? `${C.red}15` : "transparent", color: difficulty === d.id ? C.red : "#8892a4", fontSize: 12, cursor: "pointer", textAlign: "left", fontWeight: difficulty === d.id ? 700 : 400, marginBottom: 5 }}>
                  {d.label}
                  <div style={{ fontSize: 9, color: "#4a5568" }}>{d.desc}</div>
                </button>
              ))}
            </div>
            <div style={{ background: "#11131f", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 16 }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontWeight: 700, marginBottom: 10 }}>WIN CONDITION</div>
              <div style={{ fontSize: 12, color: "#6aaedd", marginBottom: 8 }}>First to</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {[5, 7, 10, 15].map(n => (
                  <button key={n} onClick={() => setWinScore(n)}
                    style={{ padding: "8px 14px", borderRadius: 8, border: `1px solid ${winScore === n ? C.gold : "rgba(255,255,255,0.08)"}`, background: winScore === n ? `${C.gold}15` : "transparent", color: winScore === n ? C.gold : "#8892a4", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                    {n} ⚫
                  </button>
                ))}
              </div>
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontWeight: 700, marginBottom: 8 }}>CUSTOM CARDS</div>
                <button onClick={() => setShowDeckBuilder(b => !b)} style={btnS(C.purple)}>
                  {showDeckBuilder ? "Close Deck Builder" : "✏️ Deck Builder"}
                </button>
              </div>
            </div>
          </div>

          {/* Deck builder */}
          {showDeckBuilder && (
            <div style={{ background: "#11131f", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 18, marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontWeight: 700, marginBottom: 12 }}>CUSTOM DECK BUILDER</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 10, color: "#4a5568", marginBottom: 6 }}>⚫ BLACK CARDS (prompts with ___)</div>
                  <textarea value={customInput} onChange={e => setCustomInput(e.target.value)}
                    placeholder="One card per line. Use ___ for the blank.&#10;e.g. The real reason my marriage works: ___."
                    style={{ ...inp, width: "100%", minHeight: 80, resize: "vertical", lineHeight: 1.5 }} />
                  <button onClick={() => { if (customInput.trim()) { setCustomBlack(b => [...b, ...customInput.split("\n").map(s => s.trim()).filter(Boolean)]); setCustomInput(""); } }}
                    style={{ ...btnS(C.white), marginTop: 6 }}>Add Black Cards ({customBlack.length})</button>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: "#4a5568", marginBottom: 6 }}>⬜ WHITE CARDS (answers)</div>
                  <textarea value={customInput} onChange={e => setCustomInput(e.target.value)}
                    placeholder="One answer per line.&#10;e.g. Weaponized passive aggression"
                    style={{ ...inp, width: "100%", minHeight: 80, resize: "vertical", lineHeight: 1.5 }} />
                  <button onClick={() => { if (customInput.trim()) { setCustomWhite(w => [...w, ...customInput.split("\n").map(s => s.trim()).filter(Boolean)]); setCustomInput(""); } }}
                    style={{ ...btnS(C.white), marginTop: 6 }}>Add White Cards ({customWhite.length})</button>
                </div>
              </div>
            </div>
          )}

          <button onClick={startGame}
            style={{ width: "100%", padding: 16, borderRadius: 14, background: C.black, border: "2px solid rgba(255,255,255,0.2)", color: C.white, fontSize: 16, fontWeight: 900, cursor: "pointer", letterSpacing: ".04em" }}>
            ⚫ DEAL THE VOID
          </button>
        </div>
      </div>

      <style>{`@keyframes cardPulse { 0%,100%{opacity:.2;transform:scale(.8)} 50%{opacity:1;transform:scale(1)} }`}</style>
    </div>
  );

  // ── RESULTS SCREEN ────────────────────────────────────────────────────────
  if (screen === "results") {
    const champion = [...players].sort((a, b) => b.score - a.score)[0];
    return (
      <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 40, background: "#0a0b12" }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>👑</div>
        <div style={{ fontSize: 28, fontWeight: 900, color: C.gold, marginBottom: 4 }}>{champion.name} WINS</div>
        <div style={{ fontSize: 14, color: "#6aaedd", marginBottom: 24 }}>with {champion.score} black cards of pure darkness</div>
        <div style={{ background: "#11131f", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 20, width: "100%", maxWidth: 360, marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontWeight: 700, marginBottom: 10 }}>FINAL SCORES</div>
          <Scoreboard players={players} czarIndex={-1} />
        </div>
        {history.length > 0 && (
          <div style={{ background: "#11131f", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 16, width: "100%", maxWidth: 360, marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontWeight: 700, marginBottom: 8 }}>HALL OF SHAME</div>
            {history.slice(-5).map((h, i) => (
              <div key={i} style={{ marginBottom: 8, fontSize: 11, color: "#8892a4" }}>
                <span style={{ color: C.white }}>"{h.white}"</span> → <span style={{ color: C.gold }}>{h.winner}</span>
                {h.verdict && <span style={{ color: C.red, marginLeft: 4 }}>({h.verdict})</span>}
              </div>
            ))}
          </div>
        )}
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => { setScreen("setup"); setHistory([]); }}
            style={{ padding: "12px 24px", borderRadius: 12, background: C.black, border: "2px solid rgba(255,255,255,0.2)", color: C.white, fontSize: 13, fontWeight: 800, cursor: "pointer" }}>
            New Game
          </button>
          <button onClick={onBack} style={{ ...btnS("#6aaedd"), padding: "12px 20px", borderRadius: 12 }}>← Back</button>
        </div>
      </div>
    );
  }

  // ── GAME SCREEN ───────────────────────────────────────────────────────────
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden", background: "#0a0b12" }}>

      {/* Game header */}
      <div style={{ padding: "8px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "#0d0e17", display: "flex", alignItems: "center", gap: 10, flexShrink: 0, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: C.white }}>VOID CARDS</span>
        <span style={{ fontSize: 11, color: "#4a5568" }}>Round {round}</span>
        <span style={{ fontSize: 11, color: C.purple, fontWeight: 700 }}>⚖️ Czar: {czar?.name}</span>
        <div style={{ flex: 1 }} />
        <button onClick={aiGenerateRound} disabled={genLoading}
          style={{ ...btnS(C.purple), opacity: genLoading ? 0.5 : 1 }}>
          {genLoading ? "⚫ Generating..." : "🤖 AI Round"}
        </button>
        <button onClick={nextRound} style={btnS("#4a5568")}>Skip →</button>
        <button onClick={() => setScreen("setup")} style={btnS(C.red)}>End</button>
      </div>

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* Main game area */}
        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>

          {/* Black card */}
          <div style={{ maxWidth: 360, marginBottom: 20 }}>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontWeight: 700, marginBottom: 8 }}>THIS ROUND'S PROMPT</div>
            <BlackCard text={blackCard} loading={genLoading} />
          </div>

          {/* Phase instruction */}
          <div style={{ marginBottom: 14, padding: "8px 14px", borderRadius: 10, background: phase === "winner" ? `${C.gold}10` : "rgba(255,255,255,0.04)", border: `1px solid ${phase === "winner" ? C.gold : "rgba(255,255,255,0.06)"}` }}>
            <div style={{ fontSize: 12, color: phase === "winner" ? C.gold : "#6aaedd", fontWeight: 600 }}>
              {phase === "play" && `${czar?.name} (Czar): Pick the funniest answer. Everyone else: choose your submission.`}
              {phase === "reveal" && "Judging in progress..."}
              {phase === "winner" && winner && `🏆 ${czar?.name} chose "${whiteCards[selectedCard]?.text}" — ${winner.name} scores a black card!`}
            </div>
          </div>

          {/* White cards grid */}
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontWeight: 700, marginBottom: 10 }}>
            {phase === "play" ? "SELECT THE WINNING ANSWER:" : "ROUND RESULTS:"}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10, marginBottom: 20 }}>
            {whiteCards.map((card, i) => {
              const j = judgements[i];
              const player = players.find(p => p.id === card.playerId);
              return (
                <div key={i}>
                  {phase !== "play" && player && (
                    <div style={{ fontSize: 9, color: "#4a5568", marginBottom: 4, textAlign: "center" }}>{player.name}</div>
                  )}
                  <WhiteCard
                    text={card.text}
                    selected={selectedCard === i}
                    onClick={() => phase === "play" && setSelectedCard(i)}
                    disabled={phase !== "play"}
                    revealed={phase === "winner" && selectedCard === i}
                    score={j?.score}
                    verdict={j?.verdict}
                    reaction={j?.reaction}
                  />
                </div>
              );
            })}
          </div>

          {/* Action buttons */}
          {phase === "play" && (
            <button onClick={submitPick} disabled={selectedCard === null}
              style={{ padding: "12px 28px", borderRadius: 12, background: selectedCard !== null ? C.gold : "#1a1e2e", border: selectedCard !== null ? "none" : "1px solid rgba(255,255,255,0.08)", color: selectedCard !== null ? C.black : "#4a5568", fontSize: 13, fontWeight: 800, cursor: selectedCard !== null ? "pointer" : "not-allowed" }}>
              ⚖️ Pick This Card as Winner
            </button>
          )}

          {phase === "winner" && (
            <button onClick={nextRound}
              style={{ padding: "12px 28px", borderRadius: 12, background: C.black, border: "2px solid rgba(255,255,255,0.2)", color: C.white, fontSize: 13, fontWeight: 800, cursor: "pointer" }}>
              Next Round →
            </button>
          )}
        </div>

        {/* Sidebar: scoreboard */}
        <div style={{ width: 180, flexShrink: 0, borderLeft: "1px solid rgba(255,255,255,0.06)", padding: 14, overflowY: "auto", background: "#0d0e17" }}>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontWeight: 700, marginBottom: 10 }}>SCOREBOARD</div>
          <Scoreboard players={players} czarIndex={czarIndex} />

          <div style={{ marginTop: 16, padding: "8px 10px", background: `${C.gold}08`, border: `1px solid ${C.gold}15`, borderRadius: 8 }}>
            <div style={{ fontSize: 9, color: C.gold, fontWeight: 700, marginBottom: 2 }}>WIN CONDITION</div>
            <div style={{ fontSize: 11, color: "#6aaedd" }}>{winScore} ⚫ to win</div>
          </div>

          {/* Recent picks */}
          {history.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontWeight: 700, marginBottom: 8 }}>LAST PICKS</div>
              {history.slice(-3).reverse().map((h, i) => (
                <div key={i} style={{ marginBottom: 8, fontSize: 10, color: "#4a5568", lineHeight: 1.4 }}>
                  <div style={{ color: "#8892a4", fontStyle: "italic" }}>"{h.white.slice(0, 40)}{h.white.length > 40 ? "..." : ""}"</div>
                  <div style={{ color: C.gold }}>→ {h.winner}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
