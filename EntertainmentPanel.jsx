import { useState } from "react";
import { invokeLLM } from "@/api/ceogpsclient";
import Icon from "@/components/lifeos/icons/Icon";

const C = { blue:"#4ab3f4", orange:"#ff8c42", teal:"#00c896", purple:"#8b7fff", pink:"#ff6b9d", red:"#ff4f5e" };
const card = { background:"#1a1a1a", border:"0.5px solid rgba(255,255,255,0.07)", borderRadius:12 };

const CATS = ["Life Hacks","Free Tools","Make Money","AI Simulators","Gaming"];


const HACKS = [
  { icon:"⏰", title:"2-Minute Rule", cat:"Productivity", desc:"If a task takes less than 2 minutes, do it immediately. Eliminates 80% of procrastination." },
  { icon:"💧", title:"Drink Before Eat", cat:"Health", desc:"Drink 16oz water before every meal. Reduces calorie intake 13% and boosts energy." },
  { icon:"📱", title:"Grayscale Phone", cat:"Focus", desc:"Set phone to grayscale mode. Reduces screen time 37% by removing dopamine-triggering color." },
  { icon:"💰", title:"Pay Yourself First", cat:"Finance", desc:"Auto-transfer 10% of every payment to savings BEFORE spending anything else." },
  { icon:"🧠", title:"5-4-3-2-1 Reset", cat:"Mental", desc:"Name 5 things you see, 4 hear, 3 touch, 2 smell, 1 taste. Instant anxiety kill switch." },
  { icon:"📧", title:"Batch Email", cat:"Productivity", desc:"Check email only at 9am, 12pm, 4pm. Saves 2.5 hours/day of context-switching." },
  { icon:"🛒", title:"48-Hour Cart Rule", cat:"Finance", desc:"Wait 48 hours before any non-essential purchase. Eliminates 70% of impulse buys." },
  { icon:"🌅", title:"Morning Sun Anchor", cat:"Health", desc:"Get sunlight in first 30 mins of waking. Sets circadian rhythm, improves sleep quality 40%." },
  { icon:"🔔", title:"Theme Your Days", cat:"Productivity", desc:"Assign each weekday a theme (Monday=CRM, Tuesday=Admin). Reduces decision fatigue." },
  { icon:"💬", title:"Mirror Test", cat:"Social", desc:"Before hitting send, ask: 'Would I say this in person?' Saves 90% of communication regret." },
  { icon:"🎯", title:"3 Big Rocks", cat:"Focus", desc:"Identify 3 non-negotiable tasks each morning. If you do only those, day is a success." },
  { icon:"🔒", title:"Energy Audit", cat:"Productivity", desc:"Track who/what gives vs. drains energy for 7 days. Cut 2 drains, double 1 giver." },
];

const FREE_TOOLS = [
  { icon:"🎨", name:"Canva", url:"https://canva.com", desc:"Professional design for everything" },
  { icon:"📝", name:"Notion", url:"https://notion.so", desc:"All-in-one notes and workspace" },
  { icon:"🤖", name:"ChatGPT", url:"https://chatgpt.com", desc:"AI assistant for anything" },
  { icon:"🔍", name:"Perplexity", url:"https://perplexity.ai", desc:"AI-powered search engine" },
  { icon:"💻", name:"GitHub", url:"https://github.com", desc:"Code hosting and collaboration" },
  { icon:"✏️", name:"Figma", url:"https://figma.com", desc:"UI/UX design prototyping" },
  { icon:"📹", name:"Loom", url:"https://loom.com", desc:"Quick screen + video recording" },
  { icon:"📅", name:"Buffer", url:"https://buffer.com", desc:"Social media scheduling" },
  { icon:"📧", name:"Mailchimp", url:"https://mailchimp.com", desc:"Email marketing free tier" },
  { icon:"📊", name:"Google Analytics", url:"https://analytics.google.com", desc:"Website traffic insights" },
  { icon:"🖼️", name:"Unsplash", url:"https://unsplash.com", desc:"Free high-quality stock photos" },
  { icon:"✂️", name:"Remove.bg", url:"https://remove.bg", desc:"AI background removal" },
  { icon:"✍️", name:"Grammarly", url:"https://grammarly.com", desc:"Writing assistant and grammar check" },
  { icon:"💵", name:"Wave", url:"https://waveapps.com", desc:"Free accounting software" },
  { icon:"📋", name:"Trello", url:"https://trello.com", desc:"Visual project management" },
];

const MONEY_IDEAS = [
  { icon:"🔧", title:"Service Business", effort:"Low", earning:"$2K-$20K/mo", desc:"Use your existing skills (plumbing, cleaning, lawn care). Lowest barrier to income." },
  { icon:"📱", title:"Social Media Management", effort:"Medium", earning:"$1K-$5K/mo", desc:"Manage Instagram/Facebook for local businesses. $300-500/client/month." },
  { icon:"🎓", title:"Online Course", effort:"High", earning:"$500-$10K/mo", desc:"Package your expertise. Teach what you know once, sell forever." },
  { icon:"🏠", title:"Airbnb Arbitrage", effort:"Medium", earning:"$1K-$3K/mo", desc:"Rent a property, re-list on Airbnb with permission. Profit the difference." },
  { icon:"📸", title:"Stock Photography", effort:"Low", earning:"$100-$2K/mo", desc:"Sell photos on Shutterstock, Getty. Passive income once uploaded." },
  { icon:"🤖", title:"AI Services", effort:"Low", earning:"$2K-$8K/mo", desc:"Offer AI automation, ChatGPT workflows, content creation to local businesses." },
  { icon:"📦", title:"Amazon FBA", effort:"High", earning:"$2K-$15K/mo", desc:"Source products wholesale, sell on Amazon. Fulfillment handled for you." },
  { icon:"✍️", title:"Freelance Writing", effort:"Medium", earning:"$500-$5K/mo", desc:"Blog posts, copy, LinkedIn ghostwriting. High demand, low startup cost." },
  { icon:"🎮", title:"Content Creation", effort:"Medium", earning:"$300-$20K/mo", desc:"YouTube, TikTok, Instagram — monetize through ads, sponsorships, products." },
  { icon:"💼", title:"Business Consulting", effort:"Medium", earning:"$3K-$20K/mo", desc:"Advise small businesses on growth, systems, marketing. Leverage your experience." },
];

const SIMULATORS = [
  { icon:"🌙", name:"Dream Forge Simulator", tagline:"Turn night visions into waking strategy", color:C.purple,
    prompt:"You are the Dream Forge Simulator. Take a dream, goal, or idea the user describes and forge it into a concrete 3-step action plan. Be poetic yet practical." },
  { icon:"🎲", name:"Serendipity Weaver", tagline:"Random opportunity threads you'd never find alone", color:C.blue,
    prompt:"You are the Serendipity Weaver. Generate 3 unexpected yet plausible opportunities based on the user's situation. Connect dots they can't see yet." },
  { icon:"💰", name:"Financial Echo Chamber", tagline:"Hear your money habits amplified 10x", color:C.teal,
    prompt:"You are the Financial Echo Chamber. Analyze the spending/saving habit described and show what it looks like amplified over 5 years. Be brutally revealing." },
  { icon:"🎮", name:"GameState Optimizer", tagline:"Analyze your life like a strategy game", color:C.orange,
    prompt:"You are the GameState Optimizer. Treat the user's current situation as a strategy game state. Identify their 3 strongest moves and 2 critical weaknesses to address." },
  { icon:"🏛️", name:"Legacy Echo Builder", tagline:"Design the impact you leave behind", color:"#ffd700",
    prompt:"You are the Legacy Echo Builder. Help the user articulate the legacy they want to leave in 3 domains: family, community, and work. Make it visceral and real." },
  { icon:"😊", name:"Mood-to-Monetization Bridge", tagline:"Convert your emotional state into profit", color:C.pink,
    prompt:"You are the Mood-to-Monetization Bridge. Given the user's current mood or emotional state, suggest 3 ways to channel it into productive income-generating actions." },
  { icon:"🎨", name:"Creative Flow Guardian", tagline:"Protect and amplify your creative energy", color:C.purple,
    prompt:"You are the Creative Flow Guardian. Analyze the user's creative blocks or goals and prescribe 3 precise rituals to unlock and protect their creative flow state." },
  { icon:"🌍", name:"Alternate Life Explorer", tagline:"What if you chose the other path?", color:C.blue,
    prompt:"You are the Alternate Life Explorer. Take a past decision the user describes and explore 2 alternate timelines — what their life might look like if they chose differently. Be vivid." },
  { icon:"⭐", name:"Virtue Loop Engine", tagline:"Build character habits that compound", color:"#ffd700",
    prompt:"You are the Virtue Loop Engine. Given one virtue the user wants to develop, design a 7-day loop (daily micro-actions) that compounds into character change." },
  { icon:"🎭", name:"Echo Persona Weaver", tagline:"Discover the hidden characters inside you", color:C.orange,
    prompt:"You are the Echo Persona Weaver. Reveal 3 hidden sub-personalities within the user based on their described behavior patterns, and show how to harness each one." },
  { icon:"⚖️", name:"Karma Credit System", tagline:"Track the invisible economy of goodwill", color:C.teal,
    prompt:"You are the Karma Credit System. Score the user's recent actions on a karma ledger and show what they're 'owed' vs. what they 'owe' in relationships and community." },
  { icon:"⚔️", name:"Narrative Conflict Engine", tagline:"Find the story clash driving your problems", color:C.red,
    prompt:"You are the Narrative Conflict Engine. Identify the core narrative conflict in the user's situation — the story they tell themselves vs. reality — and rewrite the ending." },
  { icon:"🔮", name:"Shadow Budget Oracle", tagline:"Simulate alternate financial realities", color:C.purple,
    prompt:"You are the Shadow Budget Oracle. Simulate 3 alternate financial realities based on small changes in the user's current spending or income decisions. Show 6-month projections." },
  { icon:"🏰", name:"Memory Palace Architect", tagline:"Build a mental fortress for key knowledge", color:C.blue,
    prompt:"You are the Memory Palace Architect. Design a memory palace (3 rooms, 3 items each) to help the user memorize and internalize whatever topic they specify." },
  { icon:"🎼", name:"Parallel Life Conductor", tagline:"Orchestrate all life threads simultaneously", color:C.teal, featured:true,
    prompt:"You are the Parallel Life Conductor, the meta-agent that runs multiple life threads simultaneously. Analyze the user's business, family, and creative threads — then give a Conductor Briefing showing how they reinforce or conflict, with 3 sync moves." },
  { icon:"🔥", name:"Emotion-to-Expression Forge", tagline:"Transform raw feeling into powerful output", color:C.orange,
    prompt:"You are the Emotion-to-Expression Forge. Take the emotion the user is experiencing and forge it into a creative expression — a manifesto, a poem, a business idea, or an action." },
  { icon:"♾️", name:"Infinite Game Weaver", tagline:"Play the game that never ends — and win", color:C.purple,
    prompt:"You are the Infinite Game Weaver. Help the user shift from finite thinking (win/lose) to infinite thinking. Redesign their current challenge as an infinite game with new rules." },
  { icon:"🤫", name:"Whisper Party Engine", tagline:"Ideas so bold they're meant to be whispered", color:C.pink,
    prompt:"You are the Whisper Party Engine. Generate 5 bold, slightly unconventional strategies for the user's goal — ideas too powerful to say loudly but too valuable to ignore." },
  { icon:"⏳", name:"Meme Time Capsule", tagline:"Archive your cultural moment forever", color:"#ffd700",
    prompt:"You are the Meme Time Capsule. Capture the user's current cultural/personal moment as a time capsule entry — what memes, trends, feelings, and events define this exact period of their life." },
  { icon:"👻", name:"Fantasy Friend Simulator", tagline:"Conversations with your ideal mentor", color:C.blue,
    prompt:"You are the Fantasy Friend Simulator. Roleplay as the ideal mentor for this user — someone who combines their most admired traits and gives brutally honest, loving advice." },
  { icon:"🎰", name:"Random Joy Roulette", tagline:"Spin the wheel of unexpected delight", color:C.teal,
    prompt:"You are the Random Joy Roulette. Generate 5 completely unexpected activities, experiences, or micro-adventures the user could try in the next 48 hours to spark genuine joy." },
  { icon:"📖", name:"Group Story Weaver", tagline:"Co-create epic narratives in real-time", color:C.orange,
    prompt:"You are the Group Story Weaver. Start a collaborative story based on the user's prompt and invite them to continue it. Make it compelling, surprising, and personally relevant." },
  { icon:"🎤", name:"Karaoke Duet Generator", tagline:"Find your perfect vocal harmony match", color:C.pink,
    prompt:"You are the Karaoke Duet Generator. Based on the user's described vocal style or favorite genre, recommend 5 perfect karaoke duet songs with tips on who should sing which part." },
];

export default function EntertainmentPanel() {
  const [cat, setCat] = useState("AI Simulators");
  const [modal, setModal] = useState(null);
  const [hackModal, setHackModal] = useState(null);
  const [aiInput, setAiInput] = useState("");
  const [aiOutput, setAiOutput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  async function runSim(sim, input) {
    setAiLoading(true);
    setAiOutput("");
    const res = await invokeLLM({ systemPrompt: sim.prompt, prompt: input || "Begin the simulation" });
    setAiOutput(res);
    setAiLoading(false);
  }

  async function runHack(hack) {
    setAiLoading(true);
    setAiOutput("");
    const res = await invokeLLM({ prompt: `Give a detailed step-by-step guide to implement this life hack: "${hack.title}" — ${hack.desc}. Make it immediately actionable for a busy entrepreneur.` });
    setAiOutput(res);
    setAiLoading(false);
  }

  return (
    <div style={{ display:"flex", height:"100%", overflow:"hidden" }}>
      {/* Left cat list */}
      <div style={{ width:180, flexShrink:0, borderRight:"0.5px solid rgba(255,255,255,0.07)", padding:"16px 8px", overflowY:"auto" }}>
        <div style={{ fontSize:10, color:"#2a6fa8", letterSpacing:".1em", textTransform:"uppercase", padding:"0 8px 12px" }}>Categories</div>
        {CATS.map(c => (
          <button key={c} onClick={() => setCat(c)}
            style={{ display:"block", width:"100%", textAlign:"left", padding:"9px 12px", borderRadius:8, border:"none", cursor:"pointer",
              background:cat===c ? `${C.blue}15` : "transparent",
              color:cat===c ? C.blue : "#6aaedd",
              fontWeight:cat===c ? 600 : 400, fontSize:12,
              borderLeft:cat===c ? `2px solid ${C.blue}` : "2px solid transparent",
              marginBottom:2 }}>
            {c==="Life Hacks"?"💡 ":c==="Free Tools"?"🛠️ ":c==="Make Money"?"💰 ":c==="AI Simulators"?"🤖 ":"🎮 "}{c}
          </button>
        ))}
      </div>

      {/* Main */}
      <div style={{ flex:1, overflowY:"auto", padding:24 }}>
        {cat === "Life Hacks" && (
          <>
            <div style={{ fontSize:16, fontWeight:700, color:"#f0ede8", marginBottom:4 }}><Icon name="💡" size={12} style={{marginRight:6,verticalAlign:"middle"}} />Life Hacks</div>
            <div style={{ fontSize:11, color:"#6aaedd", marginBottom:20 }}>Practical shortcuts that compound over time</div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))", gap:12 }}>
              {HACKS.map(h => (
                <div key={h.title} style={{ ...card, padding:16 }}>
                  <div style={{ fontSize:28, marginBottom:8 }}>{h.icon}</div>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                    <span style={{ fontSize:13, fontWeight:700, color:"#f0ede8" }}>{h.title}</span>
                    <span style={{ fontSize:9, padding:"2px 7px", borderRadius:10, background:`${C.blue}20`, color:C.blue }}>{h.cat}</span>
                  </div>
                  <div style={{ fontSize:12, color:"#c8c8d0", lineHeight:1.5, marginBottom:12 }}>{h.desc}</div>
                  <button onClick={() => { setHackModal(h); setAiOutput(""); setModal(null); }}
                    style={{ padding:"6px 14px", borderRadius:8, background:`${C.teal}15`, border:`0.5px solid ${C.teal}40`, color:C.teal, fontSize:11, cursor:"pointer", fontWeight:600 }}>
                    Try This ↗
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {cat === "Free Tools" && (
          <>
            <div style={{ fontSize:16, fontWeight:700, color:"#f0ede8", marginBottom:4 }}><Icon name="🛠️" size={12} style={{marginRight:6,verticalAlign:"middle"}} />Free Online Tools</div>
            <div style={{ fontSize:11, color:"#6aaedd", marginBottom:20 }}>Best free tools to run your business and life</div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:12 }}>
              {FREE_TOOLS.map(t => (
                <a key={t.name} href={t.url} target="_blank" rel="noreferrer"
                  style={{ ...card, padding:16, textDecoration:"none", display:"block", transition:"transform .15s, border-color .15s",
                    borderColor:C.blue+"00" }}>
                  <div style={{ fontSize:32, marginBottom:10 }}>{t.icon}</div>
                  <div style={{ fontSize:14, fontWeight:700, color:C.blue, marginBottom:4 }}>{t.name}</div>
                  <div style={{ fontSize:11, color:"#c8c8d0", lineHeight:1.4 }}>{t.desc}</div>
                  <div style={{ marginTop:10, fontSize:11, color:"#2a6fa8" }}>Open ↗</div>
                </a>
              ))}
            </div>
          </>
        )}

        {cat === "Make Money" && (
          <>
            <div style={{ fontSize:16, fontWeight:700, color:"#f0ede8", marginBottom:4 }}><Icon name="💰" size={12} style={{marginRight:6,verticalAlign:"middle"}} />Ways to Make Money</div>
            <div style={{ fontSize:11, color:"#6aaedd", marginBottom:20 }}>Income streams ranked by effort vs. earning potential</div>
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {MONEY_IDEAS.map(m => (
                <div key={m.title} style={{ ...card, padding:16, display:"flex", alignItems:"center", gap:16 }}>
                  <span style={{ fontSize:28, flexShrink:0 }}>{m.icon}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:14, fontWeight:700, color:"#f0ede8", marginBottom:4 }}>{m.title}</div>
                    <div style={{ fontSize:12, color:"#c8c8d0", lineHeight:1.4 }}>{m.desc}</div>
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", gap:6, alignItems:"flex-end", flexShrink:0 }}>
                    <span style={{ fontSize:11, padding:"3px 10px", borderRadius:20, background:`${C.teal}20`, color:C.teal, fontWeight:600 }}>{m.earning}</span>
                    <span style={{ fontSize:10, padding:"2px 8px", borderRadius:20, background:`rgba(255,255,255,0.05)`, color:"#6aaedd" }}>Effort: {m.effort}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {cat === "AI Simulators" && (
          <>
            <div style={{ fontSize:16, fontWeight:700, color:"#f0ede8", marginBottom:4 }}><Icon name="🤖" size={12} style={{marginRight:6,verticalAlign:"middle"}} />AI Simulators</div>
            <div style={{ fontSize:11, color:"#6aaedd", marginBottom:20 }}>Unique AI-powered experiences to explore every dimension of your life</div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))", gap:12 }}>
              {SIMULATORS.map(s => (
                <div key={s.name} style={{ ...card, padding:16,
                  gridColumn: s.featured ? "span 2" : undefined,
                  border:`0.5px solid ${s.color}30` }}>
                  <div style={{ fontSize:28, marginBottom:8 }}>{s.icon}</div>
                  <div style={{ fontSize:13, fontWeight:700, color:s.color, marginBottom:4 }}>{s.name}</div>
                  <div style={{ fontSize:11, color:"#c8c8d0", lineHeight:1.4, marginBottom:12 }}>{s.tagline}</div>
                  {s.featured && (
                    <div style={{ display:"flex", gap:8, marginBottom:12 }}>
                      {["Business Scaling","Family Bonds","Creative Hustle"].map((thread, i) => (
                        <div key={thread} style={{ flex:1, padding:"8px 10px", borderRadius:8, background:`${[C.orange,C.teal,C.purple][i]}15`, border:`0.5px solid ${[C.orange,C.teal,C.purple][i]}30` }}>
                          <div style={{ fontSize:10, fontWeight:600, color:[C.orange,C.teal,C.purple][i] }}>{thread}</div>
                          <div style={{ fontSize:9, color:"#6aaedd", marginTop:2 }}>Thread Active</div>
                        </div>
                      ))}
                    </div>
                  )}
                  <button onClick={() => { setModal(s); setAiInput(""); setAiOutput(""); setHackModal(null); }}
                    style={{ padding:"7px 16px", borderRadius:8, background:`${s.color}20`, border:`0.5px solid ${s.color}50`, color:s.color, fontSize:11, cursor:"pointer", fontWeight:600 }}><Icon name="🚀" size={12} style={{marginRight:6,verticalAlign:"middle"}} />Launch
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {cat === "Gaming" && (
          <>
            <div style={{ fontSize:16, fontWeight:700, color:"#f0ede8", marginBottom:4 }}><Icon name="🎮" size={12} style={{marginRight:6,verticalAlign:"middle"}} />GameState Optimizer</div>
            <div style={{ fontSize:11, color:"#6aaedd", marginBottom:20 }}>Analyze your life like a strategy game</div>
            <div style={{ ...card, padding:24 }}>
              <div style={{ fontSize:13, color:"#c8c8d0", marginBottom:12 }}>Describe your current situation, challenge, or goal:</div>
              <textarea value={aiInput} onChange={e => setAiInput(e.target.value)}
                placeholder="e.g. I'm trying to grow my plumbing business from 2 to 5 clients per week but I'm stuck at capacity..."
                style={{ width:"100%", minHeight:100, padding:"10px 14px", borderRadius:10, border:"0.5px solid rgba(255,255,255,0.12)", background:"#000000",
                  fontSize:13, color:"#f0ede8", outline:"none", resize:"vertical", boxSizing:"border-box" }} />
              <button onClick={() => runSim(SIMULATORS.find(s=>s.name==="GameState Optimizer"), aiInput)}
                style={{ marginTop:12, padding:"9px 20px", borderRadius:10, background:`linear-gradient(135deg,${C.orange},${C.purple})`, border:"none", color:"#000000", fontSize:12, fontWeight:700, cursor:"pointer" }}><Icon name="🎮" size={12} style={{marginRight:6,verticalAlign:"middle"}} />Analyze GameState
              </button>
              {aiLoading && <div style={{ marginTop:16, color:C.blue, fontSize:13 }}><Icon name="◈" size={12} style={{marginRight:6,verticalAlign:"middle"}} />Computing your state...</div>}
              {aiOutput && <div style={{ marginTop:16, padding:"14px 16px", borderRadius:10, background:"rgba(74,179,244,0.06)", border:"0.5px solid rgba(74,179,244,0.2)", fontSize:13, color:"#c8c8d0", lineHeight:1.7 }}>{aiOutput}</div>}
            </div>
          </>
        )}
      </div>

      {/* Simulator Modal */}
      {modal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", zIndex:9998, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}
          onClick={e => { if(e.target===e.currentTarget) { setModal(null); setAiOutput(""); }}}>
          <div style={{ ...card, width:"100%", maxWidth:540, padding:24, border:`1px solid ${modal.color}40` }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16 }}>
              <div>
                <div style={{ fontSize:32, marginBottom:6 }}>{modal.icon}</div>
                <div style={{ fontSize:16, fontWeight:700, color:modal.color }}>{modal.name}</div>
                <div style={{ fontSize:12, color:"#6aaedd" }}>{modal.tagline}</div>
              </div>
              <button onClick={() => { setModal(null); setAiOutput(""); }}
                style={{ background:"none", border:"none", color:"#6aaedd", fontSize:18, cursor:"pointer" }}>×</button>
            </div>
            <textarea value={aiInput} onChange={e => setAiInput(e.target.value)}
              placeholder="Describe your situation, question, or what you want to explore..."
              style={{ width:"100%", minHeight:80, padding:"10px 14px", borderRadius:10, border:"0.5px solid rgba(255,255,255,0.12)", background:"#000000",
                fontSize:13, color:"#f0ede8", outline:"none", resize:"vertical", boxSizing:"border-box" }} />
            <button onClick={() => runSim(modal, aiInput)} disabled={aiLoading}
              style={{ marginTop:10, width:"100%", padding:"10px", borderRadius:10, background:`linear-gradient(135deg,${modal.color},${modal.color}80)`, border:"none", color:"#000000", fontSize:13, fontWeight:700, cursor:"pointer" }}>
              {aiLoading ? "◈ Running simulation..." : `🚀 Launch ${modal.name}`}
            </button>
            {aiOutput && (
              <div style={{ marginTop:16, padding:"14px 16px", borderRadius:10, background:`${modal.color}08`, border:`0.5px solid ${modal.color}25`, fontSize:13, color:"#c8c8d0", lineHeight:1.7 }}>
                {aiOutput}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Hack Modal */}
      {hackModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", zIndex:9998, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}
          onClick={e => { if(e.target===e.currentTarget) { setHackModal(null); setAiOutput(""); }}}>
          <div style={{ ...card, width:"100%", maxWidth:480, padding:24 }}>
            <div style={{ fontSize:32, marginBottom:8 }}>{hackModal.icon}</div>
            <div style={{ fontSize:16, fontWeight:700, color:C.teal, marginBottom:4 }}>{hackModal.title}</div>
            <div style={{ fontSize:12, color:"#c8c8d0", marginBottom:16 }}>{hackModal.desc}</div>
            <button onClick={() => { runHack(hackModal); }} disabled={aiLoading}
              style={{ width:"100%", padding:"10px", borderRadius:10, background:`linear-gradient(135deg,${C.teal},${C.blue})`, border:"none", color:"#000000", fontSize:13, fontWeight:700, cursor:"pointer" }}>
              {aiLoading ? "◈ Building guide..." : "Get Step-by-Step Guide"}
            </button>
            {aiOutput && (
              <div style={{ marginTop:16, padding:"14px 16px", borderRadius:10, background:"rgba(0,200,150,0.06)", border:"0.5px solid rgba(0,200,150,0.2)", fontSize:13, color:"#c8c8d0", lineHeight:1.7 }}>
                {aiOutput}
              </div>
            )}
            <button onClick={() => { setHackModal(null); setAiOutput(""); }}
              style={{ marginTop:12, width:"100%", padding:"8px", borderRadius:8, background:"transparent", border:"0.5px solid rgba(255,255,255,0.1)", color:"#6aaedd", fontSize:12, cursor:"pointer" }}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
