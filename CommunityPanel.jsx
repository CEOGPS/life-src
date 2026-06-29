import { useState, useEffect } from "react";
import { invokeLLM, saveApiKey, getApiKey } from "@/api/ceogpsclient.jsx";

// ── Design tokens ──────────────────────────────────────────────────────────
const C = { blue:"#4ab3f4", teal:"#00c896", purple:"#8b7fff", orange:"#ff8c42", red:"#ff4f5e", pink:"#ff6b9d", gold:"#ffd700" };
const card  = { background:"#13141f", border:"0.5px solid rgba(255,255,255,0.07)", borderRadius:12 };
const inp   = { width:"100%", padding:"9px 12px", borderRadius:8, border:"0.5px solid rgba(255,255,255,0.12)", background:"#0d0e17", color:"#f0ede8", fontSize:12, outline:"none", boxSizing:"border-box" };
const Btn   = ({ children, onClick, color=C.blue, disabled, style={} }) => (
  <button onClick={onClick} disabled={!!disabled}
    style={{ padding:"7px 16px", borderRadius:8, background:`${color}18`, border:`0.5px solid ${color}55`,
      color, fontSize:12, fontWeight:600, cursor:disabled?"wait":"pointer", ...style }}>
    {children}
  </button>
);

const STORAGE_KEY = "lifeos_community_echo_v1";

// ── Seed data ──────────────────────────────────────────────────────────────
const SEED_PROFILE = {
  name:"Chris Green", business:"Plumbing & Contracting", location:"Atlanta, GA",
  goals:"Grow plumbing business, find subcontractors, get referrals, connect with homeowner groups and contractors",
  platforms: ["Facebook Groups","Nextdoor","Reddit r/Atlanta"],
};

const SEED_GROUPS = [
  { id:1, name:"Decatur Trades Network",       platform:"Facebook",  members:84,  role:"Active Member",    color:C.orange, active:true },
  { id:2, name:"Buckhead Homeowners Group",     platform:"Facebook",  members:233, role:"Contributor",      color:C.teal,   active:true },
  { id:3, name:"ATL Contractors & Builders",   platform:"Facebook",  members:312, role:"Member",           color:C.blue,   active:true },
  { id:4, name:"Atlanta Nextdoor — Decatur",   platform:"Nextdoor",  members:1420,role:"Resident",         color:C.purple, active:true },
  { id:5, name:"r/Atlanta Home Improvement",   platform:"Reddit",    members:8900,role:"Lurker",           color:C.red,    active:false },
];

const SEED_FEED = [
  { id:1, author:"James Okafor",  group:"ATL Contractors & Builders", platform:"Facebook", text:"Does anyone have a good supplier for PEX pipe in bulk? Looking for 500ft+ at a decent wholesale price. Tired of paying retail.", time:"14m ago", bridgeScore:92, analyzed:true },
  { id:2, author:"Carmen Miles",  group:"Buckhead Homeowners Group",  platform:"Facebook", text:"Our house is a mess — had a water heater burst last night, flooded the basement. URGENTLY need a licensed plumber who can come today or tomorrow. Will pay emergency rates.", time:"1h ago",  bridgeScore:98, analyzed:true },
  { id:3, author:"Derek Suggs",   group:"Decatur Trades Network",     platform:"Facebook", text:"I run a roofing crew and we're slammed. Looking to partner with other trades — plumbers, HVAC, electricians. Got 3 big remodels coming in Q2.", time:"3h ago",  bridgeScore:87, analyzed:true },
  { id:4, author:"Lisa Trenton",  group:"Atlanta Nextdoor — Decatur", platform:"Nextdoor", text:"Anyone have a trusted plumber rec? Our water pressure has been dropping for weeks. Two neighbors have the same issue — might be a main line problem.", time:"4h ago",  bridgeScore:85, analyzed:true },
  { id:5, author:"Coach Rivera",  group:"Buckhead Homeowners Group",  platform:"Facebook", text:"Community cleanup Saturday 9am — volunteers needed. Bring gloves! Great way to meet neighbors.", time:"6h ago",  bridgeScore:12, analyzed:true },
  { id:6, author:"Marcus Webb",   group:"ATL Contractors & Builders", platform:"Facebook", text:"Just launched a property management company. Need reliable sub-trades on retainer — plumbing, electrical, HVAC. Consistent monthly work, 15 properties.", time:"8h ago",  bridgeScore:95, analyzed:true },
  { id:7, author:"Priya Nair",    group:"r/Atlanta Home Improvement", platform:"Reddit",   text:"DIY-ing my bathroom renovation, got stuck on the p-trap under the tub. Any licensed plumbers willing to do a quick consult call for $?", time:"12h ago", bridgeScore:60, analyzed:true },
  { id:8, author:"Tom Breckett",  group:"Decatur Trades Network",     platform:"Facebook", text:"Who's doing commercial bids right now? Just got approved as a vendor for 3 apartment complexes in Decatur. Need plumbing, electrical partners.", time:"1d ago",  bridgeScore:91, analyzed:true },
];

const SEED_OPPORTUNITIES = [
  { id:1, feedId:2, title:"Emergency Plumbing — Buckhead Homeowner", type:"Direct Lead", urgency:"🔥 Hot", author:"Carmen Miles", group:"Buckhead Homeowners Group",
    summary:"Homeowner with burst water heater, flooded basement. Urgently needs a licensed plumber today/tomorrow, willing to pay emergency rates.",
    whyMatch:"Direct match — emergency plumbing job, high-intent buyer, willing to pay premium. Your core service.",
    action:"Reach out now with availability and emergency rate card.", status:"new", savedAt: Date.now()-3600000 },
  { id:2, feedId:6, title:"Property Manager Needs Plumbing Sub on Retainer", type:"Partnership", urgency:"⚡ High", author:"Marcus Webb", group:"ATL Contractors & Builders",
    summary:"New property management company with 15 properties needs reliable plumbing on retainer for consistent monthly work.",
    whyMatch:"Recurring revenue opportunity. 15 properties = predictable monthly income. Exactly the kind of B2B relationship that scales your business.",
    action:"Message Marcus with your retainer rates and portfolio. Lead with reliability and response time.", status:"new", savedAt: Date.now()-28800000 },
  { id:3, feedId:3, title:"Roofing Crew Looking for Trade Partners — Q2 Remodels", type:"Partnership", urgency:"⚡ High", author:"Derek Suggs", group:"Decatur Trades Network",
    summary:"Roofing business owner has 3 large remodels in Q2 and needs plumbing, HVAC, electrical partners.",
    whyMatch:"Warm trade partnership. Roofing and plumbing frequently co-occur on remodels. Could be 3 jobs from one relationship.",
    action:"Connect with Derek on the post, offer a quick call to discuss trade-swap referrals.", status:"contacted", savedAt: Date.now()-86400000 },
  { id:4, feedId:8, title:"Commercial Vendor Approval — 3 Apartment Complexes", type:"Commercial Lead", urgency:"🎯 Strategic", author:"Tom Breckett", group:"Decatur Trades Network",
    summary:"Contractor approved as vendor for 3 Decatur apartment complexes, needs plumbing partner for ongoing work.",
    whyMatch:"Commercial contracts = large volume, steady work. Apartment complexes have constant plumbing needs.",
    action:"Apply to be his plumbing partner. Emphasize commercial experience and licensing.", status:"new", savedAt: Date.now()-86400000 },
  { id:5, feedId:4, title:"Neighborhood Water Pressure Issue — Multiple Homes", type:"Referral Cluster", urgency:"🎯 Strategic", author:"Lisa Trenton", group:"Atlanta Nextdoor — Decatur",
    summary:"Multiple neighbors reporting low water pressure — possibly a shared main line issue. High chance of multiple jobs.",
    whyMatch:"One post, potentially 3+ jobs. Main line issues often require work at each home. First to respond wins the block.",
    action:"Reply on Nextdoor with a diagnostic offer. One visit could turn into 3-5 jobs.", status:"new", savedAt: Date.now()-14400000 },
];

const SEED_CONNECTIONS = [
  { id:1, name:"Derek Suggs",  role:"Roofing Contractor", group:"Decatur Trades Network", platform:"Facebook", status:"In Progress", note:"Sent a message about Q2 remodels. Waiting on reply.", date:"2 days ago", value:"Partnership" },
  { id:2, name:"Tom Breckett", role:"Commercial Contractor", group:"Decatur Trades Network", platform:"Facebook", status:"New",         note:"Need to reach out about apartment complex vendor slot.", date:"1 day ago",  value:"Commercial" },
];

const STATUS_COLORS = { new:C.teal, contacted:C.blue, converted:C.gold, passed:"#555", "In Progress":C.orange, New:C.teal, Won:C.gold, Lost:"#555" };
const TYPE_COLORS   = { "Direct Lead":C.teal, "Partnership":C.blue, "Commercial Lead":C.gold, "Referral Cluster":C.purple };
const TABS = [
  { id:"opportunities", icon:"🎯", label:"Opportunities" },
  { id:"feed",          icon:"📡", label:"Live Feed" },
  { id:"connections",   icon:"🤝", label:"Connections" },
  { id:"groups",        icon:"👥", label:"Groups" },
  { id:"profile",       icon:"⚙",  label:"My Profile" },
  { id:"sentinel",      icon:"🛰",  label:"Sentinel" },
  { id:"matchmaker",    icon:"🧬",  label:"Matchmaker" },
];

export default function CommunityPanel() {
  const [tab, setTab]           = useState("opportunities");
  const [profile, setProfile]   = useState(SEED_PROFILE);
  const [groups, setGroups]     = useState(SEED_GROUPS);
  const [feed, setFeed]         = useState(SEED_FEED);
  const [opportunities, setOpportunities] = useState(SEED_OPPORTUNITIES);
  const [connections, setConnections]     = useState(SEED_CONNECTIONS);

  // Feed input
  const [pasteText, setPasteText]     = useState("");
  const [pasteAuthor, setPasteAuthor] = useState("");
  const [pasteGroup, setPasteGroup]   = useState("");

  // AI
  const [aiLoading, setAiLoading] = useState(false);
  const [scanResult, setScanResult] = useState("");
  const [scanningId, setScanningId] = useState(null);

  // Connections form
  const [newConn, setNewConn] = useState({ name:"", role:"", group:"", platform:"Facebook", note:"", value:"Referral" });
  const [addingConn, setAddingConn] = useState(false);

  // Groups form
  const [newGroup, setNewGroup] = useState({ name:"", platform:"Facebook", role:"Member" });
  const [addingGroup, setAddingGroup] = useState(false);
  // Matchmaker state
  const [matchProfile, setMatchProfile] = useState(() => {
    try { return JSON.parse(localStorage.getItem("lifeos_match_profile") || "{}"); } catch { return {}; }
  });
  const [matchCategory, setMatchCategory] = useState("Partners");
  const [matches, setMatches]             = useState([]);
  const [matchLoading, setMatchLoading]   = useState(false);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [introLoading, setIntroLoading]   = useState(false);
  const [introText, setIntroText]         = useState("");
  const [feedCategory, setFeedCategory]   = useState("All");
  const [savedMatches, setSavedMatches]   = useState(() => {
    try { return JSON.parse(localStorage.getItem("lifeos_saved_matches") || "[]"); } catch { return []; }
  });
  // Sentinel state
  const [sentinelItems, setSentinelItems] = useState([]);
  const [sentinelLoading, setSentinelLoading] = useState(false);
  const [captureUrl, setCaptureUrl]     = useState("");
  const [captureTitle, setCaptureTitle] = useState("");
  const [captureText, setCaptureText]   = useState("");
  const [scanningItem, setScanningItem] = useState(null);
  const [showBookmarklet, setShowBookmarklet] = useState(false);


  // Fetch sentinel items from Worker
  async function fetchSentinel() {
    setSentinelLoading(true);
    try {
      const res = await fetch("https://lifeos1.ceogps.workers.dev/api/sentinel/items");
      const d   = await res.json();
      if (d.ok) setSentinelItems(d.items || []);
    } catch {}
    setSentinelLoading(false);
  }

  useEffect(() => { fetchSentinel(); }, []);

  async function captureManual() {
    if (!captureUrl.trim() && !captureText.trim()) return;
    const body = { url: captureUrl, title: captureTitle, snippet: captureText, selectedText: captureText, source:"manual" };
    try {
      await fetch("https://lifeos1.ceogps.workers.dev/api/sentinel/capture", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(body) });
      setCaptureUrl(""); setCaptureTitle(""); setCaptureText("");
      setTimeout(fetchSentinel, 800);
    } catch {}
  }

  async function dismissSentinel(id) {
    await fetch("https://lifeos1.ceogps.workers.dev/api/sentinel/item/" + id, { method:"DELETE" });
    setSentinelItems(s => s.filter(x => x.id !== id));
  }

  async function aiClassifySentinel(item) {
    setScanningItem(item.id);
    const prompt = "You are LifeOS Sentinel. Classify this captured web item and suggest the best LifeOS action.\n\nUSER PROFILE:\nBusiness: " + profile.business + "\nGoals: " + profile.goals + "\n\nCAPTURED ITEM:\nURL: " + item.url + "\nTitle: " + item.title + "\nContent: " + (item.selectedText || item.snippet || "").slice(0, 400) + "\n\nRespond in EXACT JSON (no markdown):\n{\n  \"action\": \"<Import as Lead | Add to CRM | Add to Tasks | Schedule Event | Add to Gift List | Create Learning Module | Add to Journal | Flag for Family | Dismiss>\",\n  \"reason\": \"<one sentence why>\",\n  \"draft\": \"<optional: pre-filled note or title for the action, max 20 words>\",\n  \"urgency\": \"<High | Medium | Low>\"\n}";
    try {
      const { invokeLLM } = await import("@/api/ceogpsclient.jsx");
      const raw  = await invokeLLM({ prompt });
      const json = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || "{}");
      await fetch("https://lifeos1.ceogps.workers.dev/api/sentinel/update", {
        method:"PATCH", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ id: item.id, aiAction: json, status:"classified" })
      });
      setSentinelItems(s => s.map(x => x.id===item.id ? {...x, aiAction:json, status:"classified"} : x));
    } catch {}
    setScanningItem(null);
  }

  useEffect(() => {
    getApiKey(STORAGE_KEY).then(saved => {
      if (!saved) return;
      try {
        const d = JSON.parse(saved);
        if (d.profile)       setProfile(d.profile);
        if (d.groups)        setGroups(d.groups);
        if (d.feed)          setFeed(d.feed);
        if (d.opportunities) setOpportunities(d.opportunities);
        if (d.connections)   setConnections(d.connections);
      } catch {}
    });
  }, []);

  async function persist(patch) {
    const state = { profile, groups, feed, opportunities, connections, ...patch };
    await saveApiKey(STORAGE_KEY, JSON.stringify(state));
  }

  // ── AI: scan single post ─────────────────────────────────────────────────
  async function scanPost(item) {
    setScanningId(item.id); setAiLoading(true);
    const prompt = `You are Community Echo — an AI that finds "bridge opportunities" between local community posts and a user's business/personal goals.

USER PROFILE:
Name: ${profile.name}
Business: ${profile.business}
Location: ${profile.location}
Goals: ${profile.goals}

COMMUNITY POST:
Author: ${item.author}
Group: ${item.group} (${item.platform})
Post: "${item.text}"

Analyze this post and respond in this EXACT JSON format (no markdown, pure JSON):
{
  "bridgeScore": <0-100 integer, how relevant this is to the user's goals>,
  "type": "<Direct Lead | Partnership | Referral Cluster | Commercial Lead | Community | Irrelevant>",
  "urgency": "<🔥 Hot | ⚡ High | 🎯 Strategic | 💡 Soft | — None>",
  "title": "<short opportunity title, max 8 words>",
  "summary": "<1-2 sentence summary of the opportunity>",
  "whyMatch": "<why this matches the user's specific goals>",
  "action": "<specific first action to take>"
}`;
    try {
      const raw = await invokeLLM({ prompt });
      const json = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || "{}");
      if (json.bridgeScore > 40) {
        const opp = {
          id: Date.now(), feedId: item.id, title: json.title || item.text.slice(0,50),
          type: json.type || "Direct Lead", urgency: json.urgency || "💡 Soft",
          author: item.author, group: item.group,
          summary: json.summary || "", whyMatch: json.whyMatch || "", action: json.action || "",
          status: "new", savedAt: Date.now(),
        };
        const updatedOpps  = [opp, ...opportunities];
        const updatedFeed  = feed.map(f => f.id===item.id ? {...f, bridgeScore:json.bridgeScore, analyzed:true} : f);
        setOpportunities(updatedOpps);
        setFeed(updatedFeed);
        await persist({ opportunities: updatedOpps, feed: updatedFeed });
        setScanResult(`✓ Bridge opportunity found: "${json.title}" (Score: ${json.bridgeScore})`);
      } else {
        setFeed(f => f.map(x => x.id===item.id ? {...x, bridgeScore:json.bridgeScore||0, analyzed:true} : x));
        setScanResult(`Score: ${json.bridgeScore||0} — Low relevance, no opportunity added.`);
      }
    } catch { setScanResult("AI scan failed — try again."); }
    setScanningId(null); setAiLoading(false);
    setTimeout(() => setScanResult(""), 5000);
  }

  // ── AI: scan ALL unanalyzed ───────────────────────────────────────────────
  async function scanAllFeed() {
    setAiLoading(true);
    const unanalyzed = feed.filter(f => !f.analyzed);
    if (!unanalyzed.length) { setScanResult("All posts already analyzed."); setAiLoading(false); return; }
    for (const item of unanalyzed) { await scanPost(item); }
    setAiLoading(false);
  }

  // ── Add feed post ────────────────────────────────────────────────────────
  function addFeedPost() {
    if (!pasteText.trim()) return;
    const post = { id: Date.now(), author: pasteAuthor||"Unknown", group: pasteGroup||"Local Feed",
      platform:"Manual", text: pasteText, time:"Just now", bridgeScore:null, analyzed:false };
    const updated = [post, ...feed];
    setFeed(updated);
    persist({ feed: updated });
    setPasteText(""); setPasteAuthor(""); setPasteGroup("");
  }

  // ── Update opportunity status ────────────────────────────────────────────
  function setOppStatus(id, status) {
    const updated = opportunities.map(o => o.id===id ? {...o, status} : o);
    setOpportunities(updated); persist({ opportunities: updated });
  }

  // ── Add connection ───────────────────────────────────────────────────────
  function addConnection() {
    if (!newConn.name.trim()) return;
    const conn = { ...newConn, id: Date.now(), status:"New", date:"Just now" };
    const updated = [conn, ...connections];
    setConnections(updated); persist({ connections: updated });
    setNewConn({ name:"", role:"", group:"", platform:"Facebook", note:"", value:"Referral" });
    setAddingConn(false);
  }

  // ── Add group ────────────────────────────────────────────────────────────
  function addGroup() {
    if (!newGroup.name.trim()) return;
    const g = { ...newGroup, id: Date.now(), members:0, active:true, color:C.blue };
    const updated = [...groups, g];
    setGroups(updated); persist({ groups: updated });
    setNewGroup({ name:"", platform:"Facebook", role:"Member" });
    setAddingGroup(false);
  }

  const SLabel = ({t}) => <div style={{fontSize:9,color:"#555",fontWeight:700,letterSpacing:".1em",marginBottom:10,marginTop:4}}>{t}</div>;

  // ═══════════════════════════════════════════════════════════════════════
  // OPPORTUNITIES TAB
  // ═══════════════════════════════════════════════════════════════════════
  const renderOpportunities = () => {
    const active   = opportunities.filter(o => o.status==="new" || o.status==="contacted");
    const archived = opportunities.filter(o => o.status==="converted" || o.status==="passed");
    return (
      <div>
        {/* Stats row */}
        <div style={{ display:"flex", gap:10, marginBottom:20, flexWrap:"wrap" }}>
          {[
            { label:"New",       val: opportunities.filter(o=>o.status==="new").length,       color:C.teal },
            { label:"Contacted", val: opportunities.filter(o=>o.status==="contacted").length,  color:C.blue },
            { label:"Converted", val: opportunities.filter(o=>o.status==="converted").length,  color:C.gold },
            { label:"Total",     val: opportunities.length,                                    color:"#888" },
          ].map(s => (
            <div key={s.label} style={{ ...card, padding:"10px 18px", textAlign:"center", minWidth:80 }}>
              <div style={{ fontSize:22, fontWeight:700, color:s.color }}>{s.val}</div>
              <div style={{ fontSize:10, color:"#666", marginTop:2 }}>{s.label}</div>
            </div>
          ))}
          <div style={{ marginLeft:"auto", display:"flex", alignItems:"center" }}>
            <Btn onClick={scanAllFeed} disabled={aiLoading} color={C.purple}>
              {aiLoading ? "⟳ Scanning..." : "✦ Scan All Feed"}
            </Btn>
          </div>
        </div>

        {scanResult && (
          <div style={{ ...card, padding:"10px 16px", marginBottom:16, borderColor:`${C.teal}44`, color:C.teal, fontSize:12 }}>
            {scanResult}
          </div>
        )}

        <SLabel t="ACTIVE OPPORTUNITIES" />
        {active.length === 0 && <div style={{ color:"#444", fontSize:13, marginBottom:20 }}>No active opportunities — add feed posts and scan.</div>}
        <div style={{ display:"flex", flexDirection:"column", gap:12, marginBottom:28 }}>
          {active.map(o => <OpportunityCard key={o.id} o={o} onStatus={setOppStatus} onConn={() => { setNewConn(c=>({...c, name:o.author, group:o.group})); setAddingConn(true); setTab("connections"); }} />)}
        </div>

        {archived.length > 0 && <>
          <SLabel t="ARCHIVED" />
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {archived.map(o => <OpportunityCard key={o.id} o={o} onStatus={setOppStatus} compact />)}
          </div>
        </>}
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════════════════
  // FEED TAB
  // ═══════════════════════════════════════════════════════════════════════
  const renderFeed = () => (
    <div>
      {/* Paste a post */}
      <div style={{ ...card, padding:16, marginBottom:20 }}>
        <SLabel t="ADD A POST FROM YOUR GROUPS" />
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:8 }}>
          <input value={pasteAuthor} onChange={e=>setPasteAuthor(e.target.value)} placeholder="Author name" style={inp} />
          <input value={pasteGroup}  onChange={e=>setPasteGroup(e.target.value)}  placeholder="Group or platform" style={inp} />
        </div>
        <textarea value={pasteText} onChange={e=>setPasteText(e.target.value)} rows={3}
          placeholder="Paste the post content here..." style={{ ...inp, resize:"vertical", fontFamily:"inherit" }} />
        <div style={{ display:"flex", gap:8, marginTop:10 }}>
          <Btn onClick={addFeedPost} color={C.blue}>+ Add Post</Btn>
          <span style={{ fontSize:11, color:"#444", alignSelf:"center" }}>Then click ✦ Scan to find bridge opportunities</span>
        </div>
      </div>

      {/* Category filter */}
      <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:14 }}>
        {["All","Connections","Collaborations","Events","Discoveries","Opportunities"].map(cat => (
          <button key={cat} onClick={() => setFeedCategory(cat)}
            style={{ padding:"4px 12px", borderRadius:20, fontSize:11, fontWeight:600, cursor:"pointer", border:"none",
              background: feedCategory===cat?"rgba(74,179,244,0.2)":"rgba(255,255,255,0.05)",
              color: feedCategory===cat?C.blue:"#666" }}>
            {cat}
          </button>
        ))}
      </div>

      {/* Feed items */}
      <SLabel t={`FEED — ${feedCategory==="All"?feed.length:feed.filter(i=>!i.category||i.category===feedCategory||feedCategory==="All").length} POSTS`} />
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {feed.filter(item => feedCategory==="All" || !item.category || item.category===feedCategory).map(item => (
          <div key={item.id} style={{ ...card, padding:14,
            borderColor: item.bridgeScore >= 80 ? `${C.teal}55` : item.bridgeScore >= 50 ? `${C.blue}33` : "rgba(255,255,255,0.07)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:12 }}>
              <div style={{ flex:1 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6, flexWrap:"wrap" }}>
                  <span style={{ fontSize:12, fontWeight:700, color:"#f0ede8" }}>{item.author}</span>
                  <span style={{ fontSize:10, color:"#555" }}>·</span>
                  <span style={{ fontSize:10, color:"#666" }}>{item.group}</span>
                  <span style={{ fontSize:9, padding:"2px 7px", borderRadius:10,
                    background:"rgba(255,255,255,0.06)", color:"#888", border:"0.5px solid rgba(255,255,255,0.08)" }}>
                    {item.platform}
                  </span>
                  <span style={{ fontSize:10, color:"#444", marginLeft:"auto" }}>{item.time}</span>
                </div>
                <div style={{ fontSize:13, color:"#ccc", lineHeight:1.6 }}>{item.text}</div>
              </div>
              <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:6, flexShrink:0 }}>
                {item.analyzed ? (
                  <div style={{ textAlign:"center" }}>
                    <div style={{ fontSize:18, fontWeight:700,
                      color: item.bridgeScore>=80?C.teal:item.bridgeScore>=50?C.blue:"#555" }}>
                      {item.bridgeScore}
                    </div>
                    <div style={{ fontSize:9, color:"#555" }}>BRIDGE</div>
                  </div>
                ) : (
                  <Btn onClick={() => scanPost(item)} disabled={aiLoading||scanningId===item.id} color={C.purple} style={{fontSize:11}}>
                    {scanningId===item.id ? "⟳" : "✦ Scan"}
                  </Btn>
                )}
                {item.bridgeScore >= 60 && item.analyzed && (
                  <div style={{ fontSize:9, padding:"2px 7px", borderRadius:10,
                    background:`${C.teal}18`, color:C.teal, border:`0.5px solid ${C.teal}44`, whiteSpace:"nowrap" }}>
                    Opportunity
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════
  // CONNECTIONS TAB
  // ═══════════════════════════════════════════════════════════════════════
  const renderConnections = () => (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <SLabel t={`${connections.length} CONNECTIONS TRACKED`} />
        <Btn onClick={()=>setAddingConn(v=>!v)} color={C.teal}>+ Add Connection</Btn>
      </div>

      {addingConn && (
        <div style={{ ...card, padding:16, marginBottom:20, borderColor:`${C.teal}44` }}>
          <SLabel t="NEW CONNECTION" />
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:8 }}>
            <input value={newConn.name}     onChange={e=>setNewConn(c=>({...c,name:e.target.value}))}     placeholder="Name *" style={inp} />
            <input value={newConn.role}     onChange={e=>setNewConn(c=>({...c,role:e.target.value}))}     placeholder="Role / Business" style={inp} />
            <input value={newConn.group}    onChange={e=>setNewConn(c=>({...c,group:e.target.value}))}    placeholder="Group / Where you met" style={inp} />
            <select value={newConn.platform} onChange={e=>setNewConn(c=>({...c,platform:e.target.value}))} style={inp}>
              {["Facebook","Nextdoor","Reddit","LinkedIn","In Person","Other"].map(p=><option key={p}>{p}</option>)}
            </select>
            <select value={newConn.value}   onChange={e=>setNewConn(c=>({...c,value:e.target.value}))}   style={inp}>
              {["Referral","Partnership","Commercial","Client","Sub-contractor","Vendor","Other"].map(v=><option key={v}>{v}</option>)}
            </select>
          </div>
          <textarea value={newConn.note} onChange={e=>setNewConn(c=>({...c,note:e.target.value}))} rows={2}
            placeholder="Notes on this connection..." style={{ ...inp, resize:"vertical", fontFamily:"inherit", marginBottom:8 }} />
          <div style={{ display:"flex", gap:8 }}>
            <Btn onClick={addConnection} color={C.teal}>Save</Btn>
            <Btn onClick={()=>setAddingConn(false)} color="#666">Cancel</Btn>
          </div>
        </div>
      )}

      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {connections.map(conn => (
          <div key={conn.id} style={{ ...card, padding:14 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
              <div style={{ flex:1 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4, flexWrap:"wrap" }}>
                  <div style={{ fontSize:14, fontWeight:700, color:"#f0ede8" }}>{conn.name}</div>
                  {conn.role && <div style={{ fontSize:11, color:"#888" }}>{conn.role}</div>}
                  <div style={{ fontSize:9, padding:"2px 8px", borderRadius:10,
                    background:`${STATUS_COLORS[conn.status]||C.blue}18`,
                    color:STATUS_COLORS[conn.status]||C.blue,
                    border:`0.5px solid ${STATUS_COLORS[conn.status]||C.blue}44` }}>
                    {conn.status}
                  </div>
                </div>
                <div style={{ display:"flex", gap:8, marginBottom:6, flexWrap:"wrap" }}>
                  {conn.group    && <span style={{ fontSize:10, color:"#555" }}>📍 {conn.group}</span>}
                  {conn.platform && <span style={{ fontSize:10, color:"#555" }}>· {conn.platform}</span>}
                  {conn.value    && <span style={{ fontSize:10, color:C.gold }}>· {conn.value}</span>}
                  <span style={{ fontSize:10, color:"#444", marginLeft:"auto" }}>{conn.date}</span>
                </div>
                {conn.note && <div style={{ fontSize:12, color:"#888", lineHeight:1.5 }}>{conn.note}</div>}
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:4, marginLeft:12 }}>
                {["New","In Progress","Won","Lost"].map(s => (
                  <button key={s} onClick={() => {
                    const updated = connections.map(c=>c.id===conn.id?{...c,status:s}:c);
                    setConnections(updated); persist({connections:updated});
                  }} style={{ fontSize:9, padding:"2px 8px", borderRadius:6, cursor:"pointer",
                    background: conn.status===s?`${STATUS_COLORS[s]||"#555"}22`:"transparent",
                    border:`0.5px solid ${conn.status===s?STATUS_COLORS[s]||"#555":"rgba(255,255,255,0.08)"}`,
                    color: conn.status===s?STATUS_COLORS[s]||"#555":"#444" }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════
  // GROUPS TAB
  // ═══════════════════════════════════════════════════════════════════════
  const renderGroups = () => (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <SLabel t={`${groups.filter(g=>g.active).length} ACTIVE GROUPS MONITORED`} />
        <Btn onClick={()=>setAddingGroup(v=>!v)} color={C.blue}>+ Add Group</Btn>
      </div>

      {addingGroup && (
        <div style={{ ...card, padding:16, marginBottom:20, borderColor:`${C.blue}44` }}>
          <SLabel t="ADD GROUP / COMMUNITY" />
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:8 }}>
            <input value={newGroup.name} onChange={e=>setNewGroup(g=>({...g,name:e.target.value}))} placeholder="Group name *" style={inp} />
            <select value={newGroup.platform} onChange={e=>setNewGroup(g=>({...g,platform:e.target.value}))} style={inp}>
              {["Facebook","Nextdoor","Reddit","LinkedIn","WhatsApp","Discord","Telegram","Other"].map(p=><option key={p}>{p}</option>)}
            </select>
            <input value={newGroup.role} onChange={e=>setNewGroup(g=>({...g,role:e.target.value}))} placeholder="Your role (Member, Admin...)" style={inp} />
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <Btn onClick={addGroup} color={C.blue}>Add Group</Btn>
            <Btn onClick={()=>setAddingGroup(false)} color="#666">Cancel</Btn>
          </div>
        </div>
      )}

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))", gap:12 }}>
        {groups.map(g => (
          <div key={g.id} style={{ ...card, padding:16, borderColor:g.active?`${g.color}33`:"rgba(255,255,255,0.04)", opacity:g.active?1:0.5 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:700, color:"#f0ede8", marginBottom:3 }}>{g.name}</div>
                <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                  <span style={{ fontSize:10, padding:"1px 7px", borderRadius:10,
                    background:`${g.color}18`, color:g.color, border:`0.5px solid ${g.color}44` }}>{g.platform}</span>
                  {g.members > 0 && <span style={{ fontSize:10, color:"#555" }}>{g.members.toLocaleString()} members</span>}
                  <span style={{ fontSize:10, color:"#666" }}>{g.role}</span>
                </div>
              </div>
              <button onClick={() => {
                const updated = groups.map(x=>x.id===g.id?{...x,active:!x.active}:x);
                setGroups(updated); persist({groups:updated});
              }} style={{ fontSize:10, padding:"3px 10px", borderRadius:6, cursor:"pointer", border:"none",
                background:g.active?"rgba(0,200,150,0.15)":"rgba(255,255,255,0.05)",
                color:g.active?C.teal:"#555" }}>
                {g.active?"Active":"Paused"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════
  // PROFILE TAB
  // ═══════════════════════════════════════════════════════════════════════

  // ═══════════════════════════════════════════════════════════════════════
  // SENTINEL TAB
  // ═══════════════════════════════════════════════════════════════════════
  const WORKER_URL = "https://lifeos1.ceogps.workers.dev";
  const bookmarkletCode = `javascript:(function(){var d=document,s=d.getSelection().toString()||"",t=d.title,u=d.location.href,sn=(d.querySelector('meta[name="description"]')||{}).content||"";fetch("${WORKER_URL}/api/sentinel/capture",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({url:u,title:t,snippet:sn,selectedText:s,source:"bookmarklet"})}).then(()=>{var el=d.createElement("div");el.style.cssText="position:fixed;top:16px;right:16px;background:#00c896;color:#000;padding:10px 18px;border-radius:8px;font-weight:700;font-size:13px;z-index:99999;font-family:sans-serif";el.textContent="✓ Sent to LifeOS Sentinel!";d.body.appendChild(el);setTimeout(()=>el.remove(),2500)}).catch(()=>alert("Sentinel error"))})();`;

  const ACTION_COLORS = {
    "Import as Lead":"#00c896","Add to CRM":"#4ab3f4","Add to Tasks":"#8b7fff",
    "Schedule Event":"#ff8c42","Add to Gift List":"#ff6b9d","Create Learning Module":"#ffd700",
    "Add to Journal":"#4ab3f4","Flag for Family":"#ff6b9d","Dismiss":"#555",
  };
  const ACTION_ICONS = {
    "Import as Lead":"🎯","Add to CRM":"📊","Add to Tasks":"✅",
    "Schedule Event":"📅","Add to Gift List":"🎁","Create Learning Module":"🎓",
    "Add to Journal":"📓","Flag for Family":"👨‍👩‍👧","Dismiss":"✕",
  };

  const renderSentinel = () => {
    const newItems = sentinelItems.filter(i => i.status==="new" || i.status==="classified");
    const actioned = sentinelItems.filter(i => i.status==="actioned");
    return (
      <div>
        {/* Stats + refresh */}
        <div style={{ display:"flex", gap:10, marginBottom:20, flexWrap:"wrap", alignItems:"center" }}>
          {[
            { label:"Inbox",    val:newItems.length,   color:C.teal },
            { label:"Actioned", val:actioned.length,   color:C.blue },
            { label:"Total",    val:sentinelItems.length, color:"#888" },
          ].map(s => (
            <div key={s.label} style={{ ...card, padding:"10px 18px", textAlign:"center", minWidth:70 }}>
              <div style={{ fontSize:22, fontWeight:700, color:s.color }}>{s.val}</div>
              <div style={{ fontSize:10, color:"#666", marginTop:2 }}>{s.label}</div>
            </div>
          ))}
          <div style={{ display:"flex", gap:8, marginLeft:"auto" }}>
            <Btn onClick={fetchSentinel} disabled={sentinelLoading} color={C.blue}>{sentinelLoading?"⟳ Loading...":"↻ Refresh"}</Btn>
            <Btn onClick={() => setShowBookmarklet(v=>!v)} color={C.purple}>🛰 Setup</Btn>
          </div>
        </div>

        {/* Setup panel */}
        {showBookmarklet && (
          <div style={{ ...card, padding:20, marginBottom:20, borderColor:`${C.purple}44` }}>
            <div style={{ fontSize:14, fontWeight:700, color:"#f0ede8", marginBottom:12 }}>🛰 Smart Browser Sentinel Setup</div>
            <div style={{ fontSize:12, color:"#888", lineHeight:1.7, marginBottom:16 }}>
              The Sentinel turns any webpage into a LifeOS action in one click. Drag the bookmarklet below to your browser bookmarks bar, then click it on any page to instantly capture it to your inbox.
            </div>

            {/* Bookmarklet drag target */}
            <div style={{ background:"rgba(139,127,255,0.08)", border:`1px dashed ${C.purple}`, borderRadius:10, padding:16, marginBottom:16, textAlign:"center" }}>
              <div style={{ fontSize:11, color:"#888", marginBottom:10 }}>Step 1 — Drag this button to your bookmarks bar:</div>
              <a href={bookmarkletCode}
                style={{ display:"inline-block", padding:"10px 22px", borderRadius:8, background:"linear-gradient(135deg,#8b7fff,#4ab3f4)",
                  color:"#fff", fontSize:13, fontWeight:700, textDecoration:"none", cursor:"grab" }}
                onClick={e => e.preventDefault()}>
                🛰 LifeOS Sentinel
              </a>
              <div style={{ fontSize:10, color:"#555", marginTop:8 }}>← Drag this link to your bookmarks bar. Don't click — drag!</div>
            </div>

            <div style={{ fontSize:11, color:"#888", lineHeight:1.8, marginBottom:12 }}>
              <strong style={{ color:"#ccc" }}>Step 2 — Use it anywhere:</strong><br/>
              On Facebook Marketplace, Craigslist, any website — highlight text (optional), then click the bookmarklet. It instantly sends the page to your Sentinel inbox with AI action suggestions.
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
              {[
                { icon:"📋", label:"Craigslist listing", action:"Import as CRM Lead" },
                { icon:"🛍", label:"FB Marketplace item", action:"Add to Gift List or Task" },
                { icon:"🎓", label:"Article / Tutorial", action:"Create Learning Module" },
                { icon:"🏠", label:"Property listing", action:"Flag for Family or Lead" },
                { icon:"👤", label:"Someone's profile", action:"Import as Contact" },
                { icon:"📅", label:"Event page", action:"Schedule Event" },
              ].map(ex => (
                <div key={ex.label} style={{ padding:"10px 12px", borderRadius:8, background:"rgba(255,255,255,0.03)", border:"0.5px solid rgba(255,255,255,0.07)" }}>
                  <div style={{ fontSize:18, marginBottom:4 }}>{ex.icon}</div>
                  <div style={{ fontSize:11, color:"#f0ede8", fontWeight:600, marginBottom:2 }}>{ex.label}</div>
                  <div style={{ fontSize:10, color:C.teal }}>{ex.action}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Manual capture */}
        <div style={{ ...card, padding:16, marginBottom:20 }}>
          <SLabel t="CAPTURE MANUALLY" />
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:8 }}>
            <input value={captureUrl}   onChange={e=>setCaptureUrl(e.target.value)}   placeholder="URL (optional)" style={inp} />
            <input value={captureTitle} onChange={e=>setCaptureTitle(e.target.value)} placeholder="Title / Name" style={inp} />
          </div>
          <textarea value={captureText} onChange={e=>setCaptureText(e.target.value)}
            rows={2} placeholder="Paste content, description, or selected text from any page..."
            style={{ ...inp, resize:"vertical", fontFamily:"inherit", marginBottom:8 }} />
          <Btn onClick={captureManual} color={C.teal}>+ Capture to Inbox</Btn>
        </div>

        {/* Inbox */}
        <SLabel t={`INBOX — ${newItems.length} ITEMS`} />
        {newItems.length === 0 && !sentinelLoading && (
          <div style={{ color:"#444", fontSize:13, marginBottom:20, lineHeight:1.8 }}>
            Inbox empty — use the bookmarklet on any page to capture it here, or add manually above.
          </div>
        )}
        <div style={{ display:"flex", flexDirection:"column", gap:12, marginBottom:28 }}>
          {newItems.map(item => (
            <SentinelCard key={item.id} item={item}
              onScan={() => aiClassifySentinel(item)}
              scanning={scanningItem===item.id}
              onDismiss={() => dismissSentinel(item.id)}
              onAction={(action) => {
                setSentinelItems(s => s.map(x => x.id===item.id ? {...x, status:"actioned", actionedAs:action} : x));
                fetch(WORKER_URL + "/api/sentinel/update", { method:"PATCH", headers:{"Content-Type":"application/json"}, body: JSON.stringify({id:item.id, status:"actioned", actionedAs:action}) });
              }}
              actionColors={ACTION_COLORS} actionIcons={ACTION_ICONS} />
          ))}
        </div>

        {actioned.length > 0 && (
          <>
            <SLabel t="ACTIONED" />
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {actioned.slice(0,10).map(item => (
                <div key={item.id} style={{ ...card, padding:"10px 14px", opacity:0.5, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:12, color:"#888", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.title || item.url}</div>
                    {item.actionedAs && <div style={{ fontSize:10, color:ACTION_COLORS[item.actionedAs]||C.teal }}>✓ {item.actionedAs}</div>}
                  </div>
                  <button onClick={() => dismissSentinel(item.id)} style={{ background:"none", border:"none", color:"#333", cursor:"pointer", fontSize:14, marginLeft:8 }}>×</button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );
  };


  // ═══════════════════════════════════════════════════════════════════════
  // AI MATCHMAKER
  // ═══════════════════════════════════════════════════════════════════════
  const MATCH_CATEGORIES = [
    { id:"Customers",  icon:"🎯", color:"#00c896", desc:"People who need your product or service" },
    { id:"Partners",   icon:"🤝", color:"#4ab3f4", desc:"Businesses that complement yours" },
    { id:"Hires",      icon:"💼", color:"#8b7fff", desc:"Talent, contractors, or team members" },
    { id:"Mentors",    icon:"🎓", color:"#ffd700", desc:"Experienced people who can guide you" },
    { id:"Collaborators", icon:"⚡", color:"#ff8c42", desc:"Creative or project-based co-creators" },
  ];

  const FEED_CATEGORIES = ["All","Connections","Collaborations","Events","Discoveries","Opportunities"];

  async function generateMatches() {
    if (!matchProfile.skills && !matchProfile.seeking) return;
    setMatchLoading(true); setMatches([]);
    const prompt = `You are a hyper-local AI Matchmaker for LifeOS. Generate 5 realistic, specific local match profiles for this user.

USER PROFILE:
Name: ${profile.name}
Business: ${profile.business}
Location: ${profile.location}
Skills: ${matchProfile.skills || "contracting, plumbing, business development"}
Values: ${matchProfile.values || "quality, reliability, community"}
Looking for: ${matchCategory}
Seeking specifically: ${matchProfile.seeking || ""}
Goals: ${profile.goals}

Generate 5 hyper-realistic local ${matchCategory.toLowerCase()} matches. Respond in EXACT JSON array (no markdown):
[
  {
    "name": "<realistic full name>",
    "role": "<job title or role>",
    "company": "<local business name>",
    "location": "<specific Atlanta neighborhood>",
    "compatibility": <60-98 integer>,
    "skills": ["<skill1>","<skill2>","<skill3>"],
    "values": ["<value1>","<value2>"],
    "whyMatch": "<2-sentence specific reason why this person matches>",
    "commonGround": "<one shared interest, location, or experience>",
    "platform": "<where you'd find them: Facebook Group | Nextdoor | LinkedIn | Chamber of Commerce | Reddit | Local Event>",
    "urgency": "<Hot | Warm | Strategic>"
  }
]`;
    try {
      const raw = await invokeLLM({ prompt });
      const arr = JSON.parse(raw.match(/\[\s*\{[\s\S]*\}\s*\]/)?.[0] || "[]");
      setMatches(arr.map((m,i) => ({ ...m, id: Date.now()+"_"+i })));
    } catch(e) { console.error(e); }
    setMatchLoading(false);
  }

  async function generateIntro(match) {
    setIntroLoading(true); setIntroText("");
    const prompt = `Write a warm, specific connection request / intro message from ${profile.name} (${profile.business}, ${profile.location}) to ${match.name} (${match.role} at ${match.company}, ${match.location}).

Common ground: ${match.commonGround}
Why connecting: ${match.whyMatch}
Category: Looking for a ${matchCategory.toLowerCase()}

Write a short (50-70 word) connection message that feels personal and genuine. Mention the common ground. Don't be salesy. Platform: ${match.platform}.`;
    const res = await invokeLLM({ prompt });
    setIntroText(res);
    setIntroLoading(false);
  }

  function saveMatch(match) {
    const updated = [{ ...match, savedAt: new Date().toISOString(), category: matchCategory }, ...savedMatches.filter(m => m.id !== match.id)];
    setSavedMatches(updated);
    localStorage.setItem("lifeos_saved_matches", JSON.stringify(updated));
  }

  function saveMatchProfile(patch) {
    const next = { ...matchProfile, ...patch };
    setMatchProfile(next);
    localStorage.setItem("lifeos_match_profile", JSON.stringify(next));
  }

  const renderMatchmaker = () => {
    const COMPAT_COLOR = (s) => s>=85?"#00c896":s>=70?"#4ab3f4":s>=55?"#ff8c42":"#8b7fff";
    return (
      <div style={{ display:"flex", gap:20, minHeight:0 }}>

        {/* LEFT — Config + results */}
        <div style={{ flex:1, display:"flex", flexDirection:"column", gap:14 }}>

          {/* Match Profile */}
          <div style={{ ...card, padding:16 }}>
            <div style={{ fontSize:12, fontWeight:700, color:"#f0ede8", marginBottom:12 }}>🧬 Your Match Profile</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:8 }}>
              <div>
                <label style={{ display:"block", fontSize:10, color:"#6aaedd", marginBottom:4, fontWeight:600 }}>YOUR SKILLS</label>
                <input value={matchProfile.skills||""} onChange={e=>saveMatchProfile({skills:e.target.value})}
                  placeholder="plumbing, project mgmt, sales..." style={{...inp, fontSize:12}} />
              </div>
              <div>
                <label style={{ display:"block", fontSize:10, color:"#6aaedd", marginBottom:4, fontWeight:600 }}>YOUR VALUES</label>
                <input value={matchProfile.values||""} onChange={e=>saveMatchProfile({values:e.target.value})}
                  placeholder="reliability, community, growth..." style={{...inp, fontSize:12}} />
              </div>
              <div style={{ gridColumn:"span 2" }}>
                <label style={{ display:"block", fontSize:10, color:"#6aaedd", marginBottom:4, fontWeight:600 }}>WHAT YOU'RE SEEKING</label>
                <input value={matchProfile.seeking||""} onChange={e=>saveMatchProfile({seeking:e.target.value})}
                  placeholder="e.g. a property manager with 10+ units, a marketing agency to trade referrals with..."
                  style={{...inp, fontSize:12}} />
              </div>
            </div>
          </div>

          {/* Category selector */}
          <div>
            <div style={{ fontSize:9, color:"#555", fontWeight:700, letterSpacing:".1em", marginBottom:8 }}>LOOKING FOR</div>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              {MATCH_CATEGORIES.map(cat => (
                <button key={cat.id} onClick={() => setMatchCategory(cat.id)}
                  style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 14px", borderRadius:20,
                    fontSize:12, fontWeight:600, cursor:"pointer",
                    background: matchCategory===cat.id ? `${cat.color}22` : "rgba(255,255,255,0.04)",
                    border:`0.5px solid ${matchCategory===cat.id ? cat.color : "rgba(255,255,255,0.1)"}`,
                    color: matchCategory===cat.id ? cat.color : "#666" }}>
                  {cat.icon} {cat.id}
                  {matchCategory===cat.id && <span style={{fontSize:9,color:"#555"}}>— {cat.desc}</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Generate button */}
          <button onClick={generateMatches} disabled={matchLoading}
            style={{ padding:"11px 24px", borderRadius:10, fontSize:13, fontWeight:700, cursor:matchLoading?"wait":"pointer",
              background:"linear-gradient(135deg,rgba(74,179,244,0.2),rgba(139,127,255,0.2))",
              border:"0.5px solid rgba(74,179,244,0.4)", color:"#f0ede8",
              boxShadow: matchLoading?"0 0 20px rgba(74,179,244,0.2)":"none" }}>
            {matchLoading ? "⟳ AI is finding your matches in Atlanta..." : "🧬 Find My Matches"}
          </button>

          {/* Match cards */}
          {matches.length > 0 && (
            <div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                <div style={{ fontSize:9, color:"#555", fontWeight:700, letterSpacing:".1em" }}>{matches.length} MATCHES FOUND — {matchCategory.toUpperCase()}</div>
                <button onClick={generateMatches} style={{ fontSize:10, color:"#555", background:"none", border:"none", cursor:"pointer" }}>↻ Regenerate</button>
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                {matches.map(m => {
                  const cc = COMPAT_COLOR(m.compatibility);
                  const isSelected = selectedMatch?.id===m.id;
                  const isSaved = savedMatches.some(s=>s.id===m.id);
                  return (
                    <div key={m.id} onClick={() => { setSelectedMatch(m); setIntroText(""); }}
                      style={{ ...card, padding:14, cursor:"pointer",
                        borderColor: isSelected?`${cc}55`:"rgba(255,255,255,0.07)",
                        background: isSelected?"rgba(255,255,255,0.03)":"#13141f",
                        borderLeft:`3px solid ${cc}` }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:10 }}>
                        <div style={{ flex:1 }}>
                          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                            <div style={{ fontSize:13, fontWeight:700, color:"#f0ede8" }}>{m.name}</div>
                            <div style={{ fontSize:9, padding:"2px 8px", borderRadius:10,
                              background:`${cc}18`, color:cc, border:`0.5px solid ${cc}44` }}>
                              {m.urgency}
                            </div>
                          </div>
                          <div style={{ fontSize:11, color:"#888", marginBottom:6 }}>
                            {m.role}{m.company?" · "+m.company:""} · {m.location}
                          </div>
                          <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:6 }}>
                            {(m.skills||[]).map(s=>(
                              <span key={s} style={{ fontSize:9, padding:"2px 7px", borderRadius:10,
                                background:"rgba(74,179,244,0.1)", color:C.blue, border:"0.5px solid rgba(74,179,244,0.2)" }}>{s}</span>
                            ))}
                            {(m.values||[]).map(v=>(
                              <span key={v} style={{ fontSize:9, padding:"2px 7px", borderRadius:10,
                                background:"rgba(139,127,255,0.1)", color:C.purple }}>{v}</span>
                            ))}
                          </div>
                          <div style={{ fontSize:11, color:"#777", lineHeight:1.5 }}>{m.whyMatch}</div>
                          {m.platform && <div style={{ fontSize:10, color:"#555", marginTop:4 }}>📍 Find them on: {m.platform}</div>}
                        </div>
                        {/* Compat score */}
                        <div style={{ textAlign:"center", flexShrink:0 }}>
                          <div style={{ width:52, height:52, borderRadius:"50%",
                            background:`conic-gradient(${cc} ${m.compatibility}%, rgba(255,255,255,0.05) 0%)`,
                            display:"flex", alignItems:"center", justifyContent:"center" }}>
                            <div style={{ width:40, height:40, borderRadius:"50%", background:"#13141f",
                              display:"flex", alignItems:"center", justifyContent:"center",
                              fontSize:14, fontWeight:700, color:cc }}>
                              {m.compatibility}
                            </div>
                          </div>
                          <div style={{ fontSize:9, color:"#555", marginTop:3 }}>Match %</div>
                          <button onClick={e=>{e.stopPropagation();saveMatch(m)}}
                            style={{ fontSize:10, background:"none", border:"none", cursor:"pointer",
                              color:isSaved?C.teal:"#444", marginTop:3 }}>
                            {isSaved?"✓ Saved":"Save"}
                          </button>
                        </div>
                      </div>
                      {/* Common ground */}
                      {m.commonGround && (
                        <div style={{ marginTop:8, padding:"6px 10px", borderRadius:6,
                          background:"rgba(0,200,150,0.06)", border:"0.5px solid rgba(0,200,150,0.15)",
                          fontSize:11, color:"#00c896" }}>
                          🤝 Common ground: {m.commonGround}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Saved matches */}
          {savedMatches.length > 0 && matches.length === 0 && (
            <div>
              <div style={{ fontSize:9, color:"#555", fontWeight:700, letterSpacing:".1em", marginBottom:10 }}>SAVED MATCHES ({savedMatches.length})</div>
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {savedMatches.slice(0,5).map(m => (
                  <div key={m.id} onClick={()=>{setSelectedMatch(m);setIntroText("");}}
                    style={{ ...card, padding:"10px 14px", cursor:"pointer",
                      borderLeft:`3px solid ${COMPAT_COLOR(m.compatibility)}` }}>
                    <div style={{ display:"flex", justifyContent:"space-between" }}>
                      <div>
                        <div style={{ fontSize:12, fontWeight:600, color:"#f0ede8" }}>{m.name}</div>
                        <div style={{ fontSize:10, color:"#666" }}>{m.role} · {m.category}</div>
                      </div>
                      <div style={{ fontSize:16, fontWeight:700, color:COMPAT_COLOR(m.compatibility) }}>{m.compatibility}%</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT — Intro generator */}
        <div style={{ width:320, flexShrink:0 }}>
          {!selectedMatch && (
            <div style={{ ...card, padding:24, textAlign:"center", color:"#444" }}>
              <div style={{ fontSize:28, marginBottom:10 }}>🧬</div>
              <div style={{ fontSize:13, fontWeight:600, color:"#888", marginBottom:8 }}>AI Matchmaker</div>
              <div style={{ fontSize:11, lineHeight:1.7 }}>
                Set your skills and values, choose what you're looking for, then click Find My Matches. Select any result to generate a personalized intro.
              </div>
            </div>
          )}

          {selectedMatch && (
            <div style={{ ...card, padding:20 }}>
              <div style={{ fontSize:13, fontWeight:700, color:"#f0ede8", marginBottom:4 }}>{selectedMatch.name}</div>
              <div style={{ fontSize:11, color:"#888", marginBottom:16 }}>{selectedMatch.role}{selectedMatch.company?" · "+selectedMatch.company:""}</div>

              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:9, color:"#555", fontWeight:700, letterSpacing:".08em", marginBottom:8 }}>MATCH BREAKDOWN</div>
                {[
                  ["Compatibility", selectedMatch.compatibility+"%", COMPAT_COLOR(selectedMatch.compatibility)],
                  ["Urgency",       selectedMatch.urgency,           selectedMatch.urgency==="Hot"?"#ff4f5e":selectedMatch.urgency==="Warm"?"#ff8c42":"#4ab3f4"],
                  ["Find on",       selectedMatch.platform,          "#888"],
                  ["Location",      selectedMatch.location,          "#888"],
                ].map(([label,val,color])=>(
                  <div key={label} style={{ display:"flex", justifyContent:"space-between", marginBottom:6, fontSize:11 }}>
                    <span style={{ color:"#555" }}>{label}</span>
                    <span style={{ color, fontWeight:600 }}>{val}</span>
                  </div>
                ))}
              </div>

              <div style={{ fontSize:9, color:"#555", fontWeight:700, letterSpacing:".08em", marginBottom:10 }}>GENERATE INTRO MESSAGE</div>
              <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:14 }}>
                {[
                  { type:"connect",   label:"🤝 Connection Request" },
                  { type:"collab",    label:"⚡ Collaboration Pitch" },
                  { type:"referral",  label:"🎯 Referral Exchange" },
                  { type:"event",     label:"📅 Invite to Event/Meet" },
                ].map(({ type, label }) => (
                  <button key={type}
                    onClick={async () => {
                      setIntroLoading(true); setIntroText("");
                      const typePrompts = {
                        connect: `Write a warm, 50-word connection request from ${profile.name} (${profile.business}) to ${selectedMatch.name} (${selectedMatch.role} at ${selectedMatch.company}, ${selectedMatch.location}). Common ground: ${selectedMatch.commonGround}. Why: ${selectedMatch.whyMatch}. Platform: ${selectedMatch.platform}. Feel natural, not salesy.`,
                        collab:  `Write a 60-word collaboration pitch from ${profile.name} (${profile.business}) to ${selectedMatch.name} (${selectedMatch.role}). Propose a specific mutual win. Common ground: ${selectedMatch.commonGround}. Values: ${(selectedMatch.values||[]).join(", ")}.`,
                        referral:`Write a 55-word referral exchange proposal from ${profile.name} to ${selectedMatch.name} (${selectedMatch.role} at ${selectedMatch.company}). Suggest trading referrals. Be specific about what each side offers. ${selectedMatch.commonGround}.`,
                        event:   `Write a 50-word invite from ${profile.name} to ${selectedMatch.name} to meet up locally (coffee, networking event, job site visit). Reference their location: ${selectedMatch.location} and common ground: ${selectedMatch.commonGround}.`,
                      };
                      const res = await invokeLLM({ prompt: typePrompts[type] });
                      setIntroText(res);
                      setIntroLoading(false);
                    }}
                    disabled={introLoading}
                    style={{ padding:"8px 12px", borderRadius:8, fontSize:11, fontWeight:600, cursor:introLoading?"wait":"pointer",
                      background:"rgba(255,255,255,0.04)", border:"0.5px solid rgba(255,255,255,0.1)", color:"#888",
                      textAlign:"left" }}>
                    {label}
                  </button>
                ))}
              </div>

              {introLoading && (
                <div style={{ color:"#555", fontSize:12, textAlign:"center", padding:16 }}>⟳ Writing intro...</div>
              )}

              {introText && (
                <div style={{ padding:14, borderRadius:10, background:"rgba(74,179,244,0.07)", border:"0.5px solid rgba(74,179,244,0.2)" }}>
                  <div style={{ fontSize:13, color:"#e2e8f0", lineHeight:1.8, whiteSpace:"pre-wrap", marginBottom:10 }}>{introText}</div>
                  <div style={{ display:"flex", gap:6 }}>
                    <button onClick={()=>navigator.clipboard?.writeText(introText)}
                      style={{ fontSize:11, padding:"5px 12px", borderRadius:7, cursor:"pointer",
                        background:"rgba(74,179,244,0.1)", border:"0.5px solid rgba(74,179,244,0.3)", color:C.blue, fontWeight:600 }}>
                      📋 Copy
                    </button>
                    <button onClick={()=>saveMatch(selectedMatch)}
                      style={{ fontSize:11, padding:"5px 12px", borderRadius:7, cursor:"pointer",
                        background:"rgba(0,200,150,0.1)", border:"0.5px solid rgba(0,200,150,0.3)", color:C.teal, fontWeight:600 }}>
                      ✓ Save Match
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderProfile = () => (
    <div style={{ maxWidth:560 }}>
      <div style={{ ...card, padding:20 }}>
        <SLabel t="YOUR COMMUNITY ECHO PROFILE" />
        <div style={{ fontSize:12, color:"#555", marginBottom:20, lineHeight:1.6 }}>
          This profile powers the AI bridge detection. The more specific your goals, the better the opportunities.
        </div>
        {[["Your Name","name"],["Business / What You Do","business"],["Location (City, State)","location"]].map(([label,key])=>(
          <div key={key} style={{ marginBottom:14 }}>
            <label style={{ display:"block", fontSize:11, color:"#6aaedd", marginBottom:5, fontWeight:600 }}>{label}</label>
            <input value={profile[key]||""} onChange={e=>setProfile(p=>({...p,[key]:e.target.value}))} style={inp} />
          </div>
        ))}
        <div style={{ marginBottom:14 }}>
          <label style={{ display:"block", fontSize:11, color:"#6aaedd", marginBottom:5, fontWeight:600 }}>
            Goals & What You're Looking For
          </label>
          <textarea value={profile.goals||""} onChange={e=>setProfile(p=>({...p,goals:e.target.value}))}
            rows={4} placeholder="e.g. Grow plumbing business, find sub-contractors, get referrals from homeowner groups, connect with property managers..."
            style={{ ...inp, resize:"vertical", fontFamily:"inherit" }} />
          <div style={{ fontSize:10, color:"#444", marginTop:4 }}>Be specific — the AI uses this to detect relevant bridge opportunities.</div>
        </div>
        <Btn onClick={()=>persist({profile})} color={C.teal}>Save Profile</Btn>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════
  return (
    <div style={{ padding:24, height:"100%", overflowY:"auto", background:"#0d0e17", color:"#f0ede8", fontFamily:"Inter,sans-serif" }}>
      {/* Header */}
      <div style={{ marginBottom:24 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:6 }}>
          <div style={{ fontSize:22, fontWeight:700 }}>Community Echo</div>
          <div style={{ fontSize:10, padding:"3px 10px", borderRadius:20,
            background:"rgba(139,127,255,0.15)", color:C.purple, border:`0.5px solid ${C.purple}44`, fontWeight:600 }}>
            ◈ AI-POWERED
          </div>
        </div>
        <div style={{ fontSize:12, color:"#555", maxWidth:600, lineHeight:1.6 }}>
          AI scans your hyper-local community feed and surfaces bridge opportunities — connecting local activity directly to your business and personal goals.
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", gap:6, marginBottom:24, borderBottom:"0.5px solid rgba(255,255,255,0.06)", paddingBottom:12 }}>
        {TABS.map(t => {
          const badge = t.id==="opportunities" ? opportunities.filter(o=>o.status==="new").length : null;
          return (
            <button key={t.id} onClick={()=>setTab(t.id)}
              style={{ position:"relative", padding:"7px 16px", borderRadius:20, fontSize:12, fontWeight:600, cursor:"pointer",
                background: tab===t.id?"rgba(74,179,244,0.15)":"rgba(255,255,255,0.04)",
                border:`0.5px solid ${tab===t.id?C.blue:"rgba(255,255,255,0.08)"}`,
                color: tab===t.id?C.blue:"#666" }}>
              {t.icon} {t.label}
              {badge > 0 && (
                <span style={{ position:"absolute", top:-4, right:-4, background:C.teal, color:"#000",
                  borderRadius:"50%", width:16, height:16, fontSize:9, fontWeight:700,
                  display:"flex", alignItems:"center", justifyContent:"center" }}>{badge}</span>
              )}
            </button>
          );
        })}
      </div>

      {tab==="opportunities" && renderOpportunities()}
      {tab==="feed"          && renderFeed()}
      {tab==="connections"   && renderConnections()}
      {tab==="groups"        && renderGroups()}
      {tab==="profile"       && renderProfile()}
      {tab==="sentinel"      && renderSentinel()}
      {tab==="matchmaker"    && renderMatchmaker()}
    </div>
  );
}

// ── Opportunity Card ────────────────────────────────────────────────────────
function OpportunityCard({ o, onStatus, onConn, compact=false }) {
  const [expanded, setExpanded] = useState(!compact);
  const typeColor = TYPE_COLORS[o.type] || C.blue;

  return (
    <div style={{ background:"#13141f", border:`0.5px solid ${typeColor}33`, borderRadius:12,
      padding:compact?12:16, borderLeft:`3px solid ${typeColor}` }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:12 }}>
        <div style={{ flex:1, cursor:"pointer" }} onClick={()=>setExpanded(v=>!v)}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4, flexWrap:"wrap" }}>
            <span style={{ fontSize:13, fontWeight:700, color:"#f0ede8" }}>{o.title}</span>
            <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10,
              background:`${typeColor}18`, color:typeColor, border:`0.5px solid ${typeColor}44`, flexShrink:0 }}>{o.type}</span>
            <span style={{ fontSize:12, flexShrink:0 }}>{o.urgency}</span>
          </div>
          <div style={{ fontSize:11, color:"#555" }}>{o.author} · {o.group}</div>
        </div>
        <div style={{ display:"flex", gap:6, flexShrink:0 }}>
          {["new","contacted","converted","passed"].map(s => (
            <button key={s} onClick={()=>onStatus(o.id,s)}
              style={{ fontSize:9, padding:"3px 8px", borderRadius:6, cursor:"pointer", textTransform:"capitalize",
                background: o.status===s?`${STATUS_COLORS[s]||"#555"}22`:"transparent",
                border:`0.5px solid ${o.status===s?STATUS_COLORS[s]||"#555":"rgba(255,255,255,0.08)"}`,
                color:o.status===s?STATUS_COLORS[s]||"#555":"#444" }}>{s}</button>
          ))}
        </div>
      </div>

      {expanded && (
        <div style={{ marginTop:12, paddingTop:12, borderTop:"0.5px solid rgba(255,255,255,0.06)" }}>
          {o.summary && (
            <div style={{ fontSize:12, color:"#ccc", lineHeight:1.6, marginBottom:10 }}>{o.summary}</div>
          )}
          {o.whyMatch && (
            <div style={{ padding:"8px 12px", borderRadius:8, background:`${typeColor}0d`,
              border:`0.5px solid ${typeColor}22`, fontSize:12, color:typeColor, marginBottom:10 }}>
              <span style={{ fontWeight:700 }}>Why this matches: </span>{o.whyMatch}
            </div>
          )}
          {o.action && (
            <div style={{ padding:"8px 12px", borderRadius:8, background:"rgba(0,200,150,0.06)",
              border:"0.5px solid rgba(0,200,150,0.2)", fontSize:12, color:"#00c896", marginBottom:12 }}>
              <span style={{ fontWeight:700 }}>Action: </span>{o.action}
            </div>
          )}
          {onConn && (
            <button onClick={onConn}
              style={{ fontSize:11, padding:"5px 14px", borderRadius:8, cursor:"pointer",
                background:"rgba(74,179,244,0.1)", border:"0.5px solid rgba(74,179,244,0.3)",
                color:"#4ab3f4", fontWeight:600 }}>
              + Track as Connection
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Sentinel Card ────────────────────────────────────────────────────────────
function SentinelCard({ item, onScan, scanning, onDismiss, onAction, actionColors, actionIcons }) {
  const [expanded, setExpanded] = useState(false);
  const ai = item.aiAction;
  const topAction = ai?.action;
  const topColor  = actionColors[topAction] || "#4ab3f4";

  const ALL_ACTIONS = [
    "Import as Lead","Add to CRM","Add to Tasks","Schedule Event",
    "Add to Gift List","Create Learning Module","Add to Journal","Flag for Family",
  ];

  const domain = (() => {
    try { return new URL(item.url).hostname.replace("www.",""); } catch { return item.url; }
  })();

  return (
    <div style={{ background:"#13141f", border:`0.5px solid ${topColor ? topColor+"44" : "rgba(255,255,255,0.07)"}`,
      borderRadius:12, padding:14, borderLeft:`3px solid ${topColor||"#333"}` }}>

      {/* Header row */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:12, marginBottom:8 }}>
        <div style={{ flex:1, cursor:"pointer" }} onClick={() => setExpanded(v=>!v)}>
          <div style={{ fontSize:13, fontWeight:700, color:"#f0ede8", marginBottom:3, lineHeight:1.4 }}>
            {item.title || domain || "Captured Item"}
          </div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
            {domain && <span style={{ fontSize:10, color:"#555" }}>🌐 {domain}</span>}
            <span style={{ fontSize:10, color:"#444" }}>{new Date(item.capturedAt).toLocaleString()}</span>
            {item.status==="classified" && ai && (
              <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10,
                background:`${topColor}18`, color:topColor, border:`0.5px solid ${topColor}44`, fontWeight:600 }}>
                {actionIcons[topAction]} {topAction}
              </span>
            )}
            {ai?.urgency && ai.urgency !== "Low" && (
              <span style={{ fontSize:10, color: ai.urgency==="High"?"#ff4f5e":"#ff8c42" }}>{ai.urgency}</span>
            )}
          </div>
        </div>
        <div style={{ display:"flex", gap:6, flexShrink:0 }}>
          {item.status !== "classified" && (
            <button onClick={onScan} disabled={scanning}
              style={{ fontSize:11, padding:"5px 12px", borderRadius:8, cursor:scanning?"wait":"pointer",
                background:"rgba(139,127,255,0.12)", border:"0.5px solid rgba(139,127,255,0.35)",
                color:"#8b7fff", fontWeight:600 }}>
              {scanning ? "⟳ AI..." : "✦ Classify"}
            </button>
          )}
          <button onClick={onDismiss}
            style={{ background:"none", border:"none", color:"#ff4f5e44", cursor:"pointer", fontSize:18, padding:"0 4px" }}
            onMouseEnter={e=>e.currentTarget.style.color="#ff4f5e"}
            onMouseLeave={e=>e.currentTarget.style.color="#ff4f5e44"}>×</button>
        </div>
      </div>

      {/* Snippet */}
      {(item.selectedText || item.snippet) && (
        <div style={{ fontSize:12, color:"#777", lineHeight:1.6, marginBottom:8,
          overflow:"hidden", maxHeight: expanded ? "none" : "2.8em",
          WebkitLineClamp:2, display:"-webkit-box", WebkitBoxOrient:"vertical" }}>
          {item.selectedText || item.snippet}
        </div>
      )}

      {/* AI result */}
      {ai && (expanded || topAction) && (
        <div style={{ marginTop:10, paddingTop:10, borderTop:"0.5px solid rgba(255,255,255,0.05)" }}>
          {ai.reason && (
            <div style={{ padding:"7px 12px", borderRadius:8, background:`${topColor}0d`,
              border:`0.5px solid ${topColor}22`, fontSize:12, color:topColor, marginBottom:10 }}>
              {ai.reason}
            </div>
          )}
          {ai.draft && (
            <div style={{ fontSize:11, color:"#666", fontStyle:"italic", marginBottom:10 }}>
              Draft: "{ai.draft}"
            </div>
          )}

          {/* Quick action buttons */}
          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            {topAction && (
              <button onClick={() => onAction(topAction)}
                style={{ padding:"7px 16px", borderRadius:8, fontSize:12, fontWeight:700, cursor:"pointer",
                  background:`${topColor}22`, border:`0.5px solid ${topColor}88`, color:topColor }}>
                {actionIcons[topAction]} {topAction}
              </button>
            )}
            <button onClick={() => setExpanded(v=>!v)}
              style={{ padding:"7px 12px", borderRadius:8, fontSize:11, cursor:"pointer",
                background:"rgba(255,255,255,0.04)", border:"0.5px solid rgba(255,255,255,0.1)", color:"#666" }}>
              {expanded ? "Less ▲" : "More ▼"}
            </button>
          </div>

          {/* All actions (expanded) */}
          {expanded && (
            <div style={{ marginTop:12 }}>
              <div style={{ fontSize:9, color:"#444", marginBottom:8, fontWeight:700, letterSpacing:".08em" }}>ALL ACTIONS</div>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                {ALL_ACTIONS.filter(a => a !== topAction).map(a => (
                  <button key={a} onClick={() => onAction(a)}
                    style={{ padding:"5px 12px", borderRadius:8, fontSize:11, cursor:"pointer",
                      background:`${actionColors[a]||"#555"}10`,
                      border:`0.5px solid ${actionColors[a]||"#555"}33`,
                      color:actionColors[a]||"#888" }}>
                    {actionIcons[a]} {a}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* If not classified yet — show all actions */}
      {!ai && expanded && (
        <div style={{ marginTop:10, paddingTop:10, borderTop:"0.5px solid rgba(255,255,255,0.05)" }}>
          <div style={{ fontSize:9, color:"#444", marginBottom:8, fontWeight:700, letterSpacing:".08em" }}>ROUTE TO LIFEOS</div>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            {ALL_ACTIONS.map(a => (
              <button key={a} onClick={() => onAction(a)}
                style={{ padding:"5px 12px", borderRadius:8, fontSize:11, cursor:"pointer",
                  background:`${actionColors[a]||"#555"}10`,
                  border:`0.5px solid ${actionColors[a]||"#555"}33`,
                  color:actionColors[a]||"#888" }}>
                {actionIcons[a]} {a}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
