import { useState, useEffect } from "react";
import { invokeLLM } from "@/lib/ai.js";
import Icon from "@/components/lifeos/icons/Icon";

const C = { blue:"#4ab3f4", orange:"#ff8c42", teal:"#00c896", purple:"#8b7fff", pink:"#ff6b9d", red:"#ff4f5e", amber:"#ffb347" };
const card = { background:"#1a1a1a", border:"0.5px solid rgba(255,255,255,0.07)", borderRadius:12 };
const inp = { width:"100%", padding:"9px 14px", borderRadius:8, border:"0.5px solid rgba(255,255,255,0.1)", background:"#0d0e17", fontSize:13, color:"#f0ede8", outline:"none", boxSizing:"border-box" };

const TABS = ["Overview","SEO Tools","Email Campaigns","Search Analytics","Listings","People Capital"];

const DEFAULT_LISTINGS = [
  { name:"Google My Business", icon:"🔍", url:"https://business.google.com", color:C.teal, priority:"critical" },
  { name:"Yelp for Business",  icon:"⭐", url:"https://biz.yelp.com",         color:C.orange, priority:"high" },
  { name:"Bing for Business",  icon:"🔷", url:"https://www.bingplaces.com",   color:C.blue, priority:"high" },
  { name:"Apple Maps",         icon:"🍎", url:"https://mapsconnect.apple.com", color:"#aaaaaa", priority:"high" },
  { name:"Facebook Business",  icon:"📘", url:"https://business.facebook.com", color:"#1877f2", priority:"high" },
  { name:"YP.com",             icon:"📒", url:"https://www.yp.com/claim",     color:C.orange, priority:"medium" },
  { name:"ShowMeLocal",        icon:"📍", url:"https://www.showmelocal.com",  color:C.purple, priority:"medium" },
  { name:"Angi",               icon:"🏠", url:"https://pro.angi.com",         color:C.blue, priority:"medium" },
  { name:"HomeAdvisor",        icon:"🔧", url:"https://www.homeadvisor.com/business-center", color:C.teal, priority:"medium" },
  { name:"BBB",                icon:"🏛️", url:"https://www.bbb.org/accreditation", color:C.blue, priority:"medium" },
  { name:"Thumbtack",          icon:"📌", url:"https://www.thumbtack.com/pro", color:C.orange, priority:"medium" },
  { name:"Nextdoor",           icon:"🏘️", url:"https://business.nextdoor.com", color:"#00b05c", priority:"medium" },
  { name:"Foursquare",         icon:"📡", url:"https://business.foursquare.com", color:"#f94877", priority:"low" },
  { name:"Manta",              icon:"🌐", url:"https://www.manta.com/claim",   color:"#0072c6", priority:"low" },
  { name:"Hotfrog",            icon:"🐸", url:"https://www.hotfrog.com",       color:"#5cb85c", priority:"low" },
];

const LOCAL_SEO_ITEMS = [
  "Google My Business fully optimized with photos",
  "NAP (Name, Address, Phone) consistent across all listings",
  "50+ Google reviews with responses",
  "Atlanta-specific keywords in website meta tags",
  "Schema markup (LocalBusiness) implemented",
  "Location pages for Buckhead, Midtown, Decatur",
  "Google Posts published weekly",
];

const EMPTY_BIZ_INFO = {
  businessName:"", category:"", phone:"", address:"", city:"", state:"", zip:"", website:"",
  hours:"Mon-Fri 9am-6pm, Sat 10am-4pm", email:"", description:"", tagline:"",
};

function load(key, fallback) {
  try { return JSON.parse(localStorage.getItem("lifeos_mktg_" + key) || "null") ?? fallback; } catch { return fallback; }
}
function save(key, val) {
  try { localStorage.setItem("lifeos_mktg_" + key, JSON.stringify(val)); } catch {} }

// ── LISTINGS TAB — full replacement ──────────────────────────────────────────
function ListingsTab() {
  // Business info (source of truth for all listings)
  const [bizInfo, setBizInfo] = useState(() => load("biz_info", EMPTY_BIZ_INFO));
  const [bizSaved, setBizSaved] = useState(false);
  const [bizEditing, setBizEditing] = useState(false);

  // Listing statuses
  const [listingStatuses, setListingStatuses] = useState(() => load("listing_statuses", {}));
  const [listingEditing, setListingEditing] = useState(null);

  // Opportunity Finder
  const [oppInput, setOppInput] = useState({ company:"", website:"", industry:"", location:"" });
  const [oppResults, setOppResults] = useState(() => load("opp_results", null));
  const [oppLoading, setOppLoading] = useState(false);

  // Inconsistency Scanner
  const [scanResults, setScanResults] = useState(() => load("scan_results", null));
  const [scanLoading, setScanLoading] = useState(false);

  // Sync push state
  const [pushTarget, setPushTarget] = useState(null);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushResult, setPushResult] = useState({});

  // Active sub-tab
  const [subTab, setSubTab] = useState("dashboard");

  useEffect(() => { save("listing_statuses", listingStatuses); }, [listingStatuses]);
  useEffect(() => { if (bizInfo) save("biz_info", bizInfo); }, [bizInfo]);
  useEffect(() => { if (oppResults) save("opp_results", oppResults); }, [oppResults]);
  useEffect(() => { if (scanResults) save("scan_results", scanResults); }, [scanResults]);

  function saveBizInfo() {
    save("biz_info", bizInfo);
    setBizSaved(true);
    setBizEditing(false);
    setTimeout(() => setBizSaved(false), 2500);
  }

  function setListingStatus(name, status) {
    setListingStatuses(prev => ({ ...prev, [name]: status }));
    setListingEditing(null);
  }

  const activeCount = Object.values(listingStatuses).filter(s => s==="Claimed"||s==="Active").length;
  const hasBizInfo = bizInfo.businessName && bizInfo.phone && bizInfo.address;

  // ── Opportunity Finder ──────────────────────────────────────────────────────
  async function findOpportunities() {
    if (!oppInput.company.trim() || oppLoading) return;
    setOppLoading(true);
    setOppResults(null);
    const prompt = `You are a local SEO expert. A business called "${oppInput.company}" ${oppInput.website ? `(website: ${oppInput.website})` : ""} in ${oppInput.location || "Atlanta, GA"} is in the ${oppInput.industry || "marketing/business services"} industry.

Analyze their listing presence and identify the TOP 15 directory/citation opportunities they are MOST LIKELY missing. For each opportunity, provide:
1. Directory name
2. Domain authority score (DA, 1-100)
3. Why it matters for their industry
4. Priority: Critical / High / Medium / Low
5. Direct claim/signup URL

Focus on: industry-specific directories, local Atlanta/Georgia directories, general business directories, and any niche opportunities for their category.

Return ONLY a JSON array like this:
[
  {
    "name": "Directory Name",
    "url": "https://...",
    "da": 85,
    "priority": "Critical",
    "reason": "Why this matters",
    "icon": "🔍"
  }
]

No markdown, no explanation — raw JSON only.`;

    try {
      const raw = await invokeLLM({ prompt, systemPrompt: "You are a local SEO and citation building expert. Return only valid JSON arrays." });
      const clean = raw.replace(/```json|```/g, "").trim();
      const data = JSON.parse(clean);
      setOppResults({ items: data, company: oppInput.company, scannedAt: new Date().toLocaleString() });
    } catch (e) {
      setOppResults({ error: "Could not parse results. Try again.", items: [] });
    }
    setOppLoading(false);
  }

  // ── Inconsistency Scanner ───────────────────────────────────────────────────
  async function runInconsistencyScan() {
    if (!hasBizInfo || scanLoading) return;
    setScanLoading(true);
    setScanResults(null);
    const prompt = `You are a local SEO citation auditor. The canonical (correct) business information for "${bizInfo.businessName}" is:
- Name: ${bizInfo.businessName}
- Phone: ${bizInfo.phone}
- Address: ${bizInfo.address}, ${bizInfo.city}, ${bizInfo.state} ${bizInfo.zip}
- Website: ${bizInfo.website}
- Category: ${bizInfo.category}
- Hours: ${bizInfo.hours}
- Email: ${bizInfo.email}
- Description: ${bizInfo.description}

Based on this information, identify:
1. Fields that appear INCOMPLETE or WEAK (low-quality descriptions, missing info, etc.)
2. Common inconsistency patterns for businesses with this type of data
3. NAP consistency risks (what variations of their name/address/phone might exist across directories)
4. Specific fixes for each issue found

Return ONLY a JSON object like:
{
  "score": 78,
  "grade": "B",
  "issues": [
    {
      "severity": "Critical|High|Medium|Low",
      "field": "field name",
      "issue": "description of the problem",
      "fix": "specific action to take",
      "icon": "⚠️"
    }
  ],
  "strengths": ["what they're doing well", "..."],
  "napRisks": ["possible variation 1", "possible variation 2"]
}

No markdown, raw JSON only.`;

    try {
      const raw = await invokeLLM({ prompt, systemPrompt: "You are a citation consistency auditor. Return only valid JSON." });
      const clean = raw.replace(/```json|```/g, "").trim();
      const data = JSON.parse(clean);
      setScanResults({ ...data, scannedAt: new Date().toLocaleString() });
    } catch {
      setScanResults({ error: "Scan failed. Check your business info and try again.", issues: [] });
    }
    setScanLoading(false);
  }

  // ── Generate push guide for a listing ──────────────────────────────────────
  async function generatePushGuide(listing) {
    if (!hasBizInfo) return;
    setPushTarget(listing.name);
    setPushLoading(true);
    const prompt = `Generate a step-by-step guide to update business listing info on "${listing.name}" (${listing.url}).

The correct information to update to is:
- Business Name: ${bizInfo.businessName}
- Phone: ${bizInfo.phone}
- Address: ${bizInfo.address}, ${bizInfo.city}, ${bizInfo.state} ${bizInfo.zip}
- Website: ${bizInfo.website}
- Hours: ${bizInfo.hours}
- Category: ${bizInfo.category}
- Description: ${bizInfo.description}

Provide: 3-5 specific steps to find and update this listing, common fields to look for, and any platform-specific tips. Be concise and actionable. Max 200 words.`;

    const result = await invokeLLM({ prompt });
    setPushResult(prev => ({ ...prev, [listing.name]: result }));
    setPushLoading(false);
    setPushTarget(null);
  }

  const SUB_TABS = [
    { id:"dashboard", label:"📋 Dashboard", count: activeCount + "/" + DEFAULT_LISTINGS.length },
    { id:"bizinfo",   label:"🏢 Business Info", badge: !hasBizInfo ? "!" : null },
    { id:"finder",    label:"🔍 Opportunity Finder" },
    { id:"scanner",   label:"🩺 Inconsistency Scan" },
    { id:"sync",      label:"🔄 Sync & Push" },
  ];

  const sevColor = (sev) => sev==="Critical"?C.red:sev==="High"?C.orange:sev==="Medium"?C.amber:C.blue;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:0 }}>

      {/* Sub-tab bar */}
      <div style={{ display:"flex", gap:4, marginBottom:16, flexWrap:"wrap" }}>
        {SUB_TABS.map(t => (
          <button key={t.id} onClick={() => setSubTab(t.id)}
            style={{ padding:"6px 14px", borderRadius:20, fontSize:11, fontWeight:600, cursor:"pointer", border:"0.5px solid",
              background: subTab===t.id ? "rgba(74,179,244,0.15)" : "transparent",
              borderColor: subTab===t.id ? C.blue : "rgba(255,255,255,0.12)",
              color: subTab===t.id ? C.blue : "#6aaedd", display:"flex", alignItems:"center", gap:6 }}>
            {t.label}
            {t.count && <span style={{ fontSize:9, opacity:0.7 }}>{t.count}</span>}
            {t.badge && <span style={{ width:14, height:14, borderRadius:"50%", background:C.red, color:"#fff", fontSize:9, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800 }}>{t.badge}</span>}
          </button>
        ))}
      </div>

      {/* ── DASHBOARD ── */}
      {subTab === "dashboard" && (
        <>
          <div style={{ display:"flex", gap:10, marginBottom:14, flexWrap:"wrap" }}>
            {[
              { label:"Active", val:activeCount, color:C.teal },
              { label:"Needs Work", val:Object.values(listingStatuses).filter(s=>s==="Needs Update").length, color:C.orange },
              { label:"Unclaimed", val: DEFAULT_LISTINGS.length - Object.keys(listingStatuses).filter(k => listingStatuses[k]==="Claimed"||listingStatuses[k]==="Active").length, color:C.red },
              { label:"Total Tracked", val:DEFAULT_LISTINGS.length, color:C.blue },
            ].map(s => (
              <div key={s.label} style={{ ...card, padding:"12px 16px", flex:1, minWidth:100, textAlign:"center" }}>
                <div style={{ fontSize:22, fontWeight:800, color:s.color }}>{s.val}</div>
                <div style={{ fontSize:10, color:"#6aaedd" }}>{s.label}</div>
              </div>
            ))}
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))", gap:10 }}>
            {DEFAULT_LISTINGS.map(l => {
              const status = listingStatuses[l.name] || "Unclaimed";
              const isEditing = listingEditing === l.name;
              const statusColor = status==="Claimed"||status==="Active" ? C.teal : status==="Needs Update" ? C.orange : C.red;
              return (
                <div key={l.name} style={{ ...card, padding:14 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
                    <span style={{ fontSize:22 }}>{l.icon}</span>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12, fontWeight:600, color:"#f0ede8" }}>{l.name}</div>
                      <div style={{ display:"flex", gap:5, alignItems:"center", marginTop:2 }}>
                        <span style={{ fontSize:9, padding:"1px 6px", borderRadius:20, background:statusColor+"22", color:statusColor, fontWeight:700 }}>{status}</span>
                        <span style={{ fontSize:9, padding:"1px 6px", borderRadius:20, background:"rgba(255,255,255,0.05)", color:"#555" }}>
                          {l.priority === "critical" ? "🔴" : l.priority === "high" ? "🟠" : l.priority === "medium" ? "🟡" : "🟢"} {l.priority}
                        </span>
                      </div>
                    </div>
                  </div>
                  {isEditing ? (
                    <div>
                      <select value={status} onChange={e => setListingStatus(l.name, e.target.value)}
                        style={{ ...inp, fontSize:11, marginBottom:6 }}>
                        {["Unclaimed","Claimed","Active","Needs Update"].map(s => <option key={s}>{s}</option>)}
                      </select>
                      <button onClick={() => setListingEditing(null)} style={{ width:"100%", padding:"5px", borderRadius:6, background:"rgba(255,255,255,0.05)", border:"none", color:"#6aaedd", fontSize:11, cursor:"pointer" }}>Cancel</button>
                    </div>
                  ) : (
                    <div style={{ display:"flex", gap:6 }}>
                      <button onClick={() => setListingEditing(l.name)} style={{ flex:1, padding:"6px", borderRadius:7, background:"rgba(255,255,255,0.05)", border:"0.5px solid rgba(255,255,255,0.1)", color:"#6aaedd", fontSize:11, cursor:"pointer" }}>Status</button>
                      <a href={l.url} target="_blank" rel="noreferrer" style={{ flex:1, padding:"6px", borderRadius:7, background:`${l.color}20`, border:`0.5px solid ${l.color}44`, color:l.color, fontSize:11, cursor:"pointer", textDecoration:"none", textAlign:"center" }}>Open ↗</a>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── BUSINESS INFO HQ ── */}
      {subTab === "bizinfo" && (
        <div style={{ ...card, padding:22 }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6 }}>
            <div>
              <div style={{ fontSize:14, fontWeight:700, color:"#f0ede8" }}>Business Info HQ</div>
              <div style={{ fontSize:11, color:"#6aaedd", marginTop:2 }}>Your canonical source of truth — used by the scanner, finder & sync push.</div>
            </div>
            {bizSaved && <span style={{ fontSize:11, color:C.teal, fontWeight:600 }}>✓ Saved</span>}
          </div>

          {!bizEditing && hasBizInfo ? (
            <div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginTop:14 }}>
                {[
                  ["Business Name", bizInfo.businessName], ["Category", bizInfo.category],
                  ["Phone", bizInfo.phone], ["Website", bizInfo.website],
                  ["Address", bizInfo.address], ["City / State / Zip", `${bizInfo.city}, ${bizInfo.state} ${bizInfo.zip}`],
                  ["Hours", bizInfo.hours], ["Email", bizInfo.email],
                ].map(([label, val]) => (
                  <div key={label} style={{ padding:"10px 14px", borderRadius:8, background:"rgba(255,255,255,0.03)", border:"0.5px solid rgba(255,255,255,0.07)" }}>
                    <div style={{ fontSize:9, color:"#6aaedd", fontWeight:700, letterSpacing:".06em", marginBottom:3 }}>{label.toUpperCase()}</div>
                    <div style={{ fontSize:12, color:"#f0ede8" }}>{val || <span style={{color:"#444",fontStyle:"italic"}}>Not set</span>}</div>
                  </div>
                ))}
              </div>
              {bizInfo.description && (
                <div style={{ marginTop:10, padding:"10px 14px", borderRadius:8, background:"rgba(255,255,255,0.03)", border:"0.5px solid rgba(255,255,255,0.07)" }}>
                  <div style={{ fontSize:9, color:"#6aaedd", fontWeight:700, letterSpacing:".06em", marginBottom:3 }}>DESCRIPTION</div>
                  <div style={{ fontSize:12, color:"#c8c8d0", lineHeight:1.6 }}>{bizInfo.description}</div>
                </div>
              )}
              <button onClick={() => setBizEditing(true)}
                style={{ marginTop:14, padding:"9px 22px", borderRadius:8, background:"rgba(74,179,244,0.12)", border:`0.5px solid ${C.blue}44`, color:C.blue, fontSize:12, fontWeight:600, cursor:"pointer" }}>
                Edit Info
              </button>
            </div>
          ) : (
            <div style={{ marginTop:14 }}>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                {[
                  ["Business Name","businessName","text","CEO GPS"],
                  ["Industry / Category","category","text","Digital Marketing Agency"],
                  ["Phone","phone","tel","(404) 555-0100"],
                  ["Website","website","url","https://ceogps.com"],
                  ["Street Address","address","text","123 Peachtree St NE"],
                  ["City","city","text","Atlanta"],
                  ["State","state","text","GA"],
                  ["ZIP Code","zip","text","30303"],
                  ["Email","email","email","chris@ceogps.com"],
                  ["Business Hours","hours","text","Mon-Fri 9am-6pm"],
                ].map(([label,key,type,ph]) => (
                  <div key={key}>
                    <div style={{ fontSize:10, color:"#6aaedd", fontWeight:600, marginBottom:4 }}>{label}</div>
                    <input type={type} value={bizInfo[key]||""} placeholder={ph}
                      onChange={e => setBizInfo(b => ({...b,[key]:e.target.value}))}
                      style={inp} />
                  </div>
                ))}
              </div>
              <div style={{ marginTop:10 }}>
                <div style={{ fontSize:10, color:"#6aaedd", fontWeight:600, marginBottom:4 }}>Business Description (150-300 words recommended)</div>
                <textarea value={bizInfo.description||""} onChange={e => setBizInfo(b => ({...b,description:e.target.value}))}
                  placeholder="Describe your business, services, and what makes you different..."
                  style={{ ...inp, minHeight:80, resize:"vertical" }} />
              </div>
              <div style={{ marginTop:10 }}>
                <div style={{ fontSize:10, color:"#6aaedd", fontWeight:600, marginBottom:4 }}>Tagline</div>
                <input value={bizInfo.tagline||""} onChange={e => setBizInfo(b => ({...b,tagline:e.target.value}))}
                  placeholder="Your short brand tagline..."
                  style={inp} />
              </div>
              <div style={{ display:"flex", gap:8, marginTop:14 }}>
                {hasBizInfo && <button onClick={() => { setBizEditing(false); }} style={{ padding:"9px 18px", borderRadius:8, background:"rgba(255,255,255,0.05)", border:"0.5px solid rgba(255,255,255,0.1)", color:"#6aaedd", fontSize:12, cursor:"pointer" }}>Cancel</button>}
                <button onClick={saveBizInfo}
                  style={{ flex:1, padding:"9px", borderRadius:8, background:`linear-gradient(135deg,${C.teal},${C.blue})`, border:"none", color:"#000", fontSize:12, fontWeight:700, cursor:"pointer" }}>
                  💾 Save Business Info
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── OPPORTUNITY FINDER ── */}
      {subTab === "finder" && (
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <div style={{ ...card, padding:20 }}>
            <div style={{ fontSize:14, fontWeight:700, color:"#f0ede8", marginBottom:4 }}>🔍 Listing Opportunity Finder</div>
            <div style={{ fontSize:11, color:"#6aaedd", marginBottom:14 }}>Enter any business — find every directory they're missing out on.</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              {[
                ["Company Name","company","text","CEO GPS","Your business name"],
                ["Website","website","url","https://ceogps.com","Business website (optional)"],
                ["Industry","industry","text","Digital Marketing","Industry or niche"],
                ["Location","location","text","Atlanta, GA","City, State"],
              ].map(([label,key,type,ph,hint]) => (
                <div key={key}>
                  <div style={{ fontSize:10, color:"#6aaedd", fontWeight:600, marginBottom:4 }}>{label}</div>
                  <input type={type} value={oppInput[key]||""} placeholder={ph}
                    onChange={e => setOppInput(i => ({...i,[key]:e.target.value}))}
                    onKeyDown={e => e.key==="Enter" && findOpportunities()}
                    style={inp} />
                  {hint && <div style={{ fontSize:9, color:"#444", marginTop:2 }}>{hint}</div>}
                </div>
              ))}
            </div>
            <button onClick={findOpportunities} disabled={oppLoading || !oppInput.company.trim()}
              style={{ marginTop:14, width:"100%", padding:"10px", borderRadius:10, background:`linear-gradient(135deg,${C.blue},${C.teal})`, border:"none", color:"#000", fontSize:13, fontWeight:700, cursor:"pointer", opacity: oppLoading || !oppInput.company.trim() ? 0.6 : 1 }}>
              {oppLoading ? "🔍 Scanning directory universe..." : "Find Missed Opportunities →"}
            </button>
          </div>

          {oppResults && !oppResults.error && (
            <div style={{ ...card, padding:20 }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:700, color:"#f0ede8" }}>Opportunities for "{oppResults.company}"</div>
                  <div style={{ fontSize:10, color:"#6aaedd", marginTop:2 }}>Scanned {oppResults.scannedAt} · {oppResults.items?.length} opportunities found</div>
                </div>
                <button onClick={() => { setOppResults(null); save("opp_results", null); }}
                  style={{ padding:"4px 10px", borderRadius:6, background:"rgba(255,79,94,0.1)", border:"0.5px solid rgba(255,79,94,0.2)", color:C.red, fontSize:10, cursor:"pointer" }}>Clear</button>
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {(oppResults.items||[]).map((item, i) => (
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 12px", borderRadius:9, background:"rgba(255,255,255,0.025)", border:`0.5px solid ${sevColor(item.priority)}33` }}>
                    <span style={{ fontSize:20, flexShrink:0 }}>{item.icon || "🌐"}</span>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12, fontWeight:600, color:"#f0ede8" }}>{item.name}</div>
                      <div style={{ fontSize:10, color:"#6aaedd", marginTop:1 }}>{item.reason}</div>
                    </div>
                    <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:4, flexShrink:0 }}>
                      <span style={{ fontSize:9, padding:"2px 7px", borderRadius:20, background:sevColor(item.priority)+"22", color:sevColor(item.priority), fontWeight:700 }}>{item.priority}</span>
                      {item.da && <span style={{ fontSize:9, color:"#444" }}>DA {item.da}</span>}
                    </div>
                    <a href={item.url} target="_blank" rel="noreferrer"
                      style={{ padding:"6px 12px", borderRadius:7, background:`${C.teal}22`, border:`0.5px solid ${C.teal}44`, color:C.teal, fontSize:11, fontWeight:600, textDecoration:"none", flexShrink:0 }}>
                      Claim ↗
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
          {oppResults?.error && (
            <div style={{ ...card, padding:16, border:`0.5px solid ${C.red}44` }}>
              <div style={{ fontSize:12, color:C.red }}>{oppResults.error}</div>
            </div>
          )}
        </div>
      )}

      {/* ── INCONSISTENCY SCANNER ── */}
      {subTab === "scanner" && (
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          {!hasBizInfo && (
            <div style={{ ...card, padding:16, border:`0.5px solid ${C.orange}44`, background:"rgba(255,140,66,0.05)" }}>
              <div style={{ fontSize:12, color:C.orange, fontWeight:600 }}>⚠ Set your Business Info first</div>
              <div style={{ fontSize:11, color:"#c8c8d0", marginTop:4 }}>The scanner needs your canonical info to check against. <button onClick={() => setSubTab("bizinfo")} style={{ color:C.blue, background:"none", border:"none", cursor:"pointer", fontSize:11, fontWeight:600 }}>Set it now →</button></div>
            </div>
          )}

          <div style={{ ...card, padding:20 }}>
            <div style={{ fontSize:14, fontWeight:700, color:"#f0ede8", marginBottom:4 }}>🩺 Listing Inconsistency Scanner</div>
            <div style={{ fontSize:11, color:"#6aaedd", marginBottom:14 }}>
              Audits your business info for NAP inconsistency risks, incomplete fields, and data quality issues across directories.
            </div>
            {hasBizInfo && (
              <div style={{ padding:"10px 12px", borderRadius:8, background:"rgba(0,200,150,0.05)", border:`0.5px solid ${C.teal}33`, marginBottom:14, fontSize:11, color:"#c8c8d0" }}>
                Scanning: <span style={{ color:"#f0ede8", fontWeight:600 }}>{bizInfo.businessName}</span> · {bizInfo.address}, {bizInfo.city} · {bizInfo.phone}
              </div>
            )}
            <button onClick={runInconsistencyScan} disabled={!hasBizInfo || scanLoading}
              style={{ width:"100%", padding:"10px", borderRadius:10, background: hasBizInfo ? `linear-gradient(135deg,${C.purple},${C.blue})` : "rgba(255,255,255,0.06)", border:"none", color: hasBizInfo ? "#000" : "#444", fontSize:13, fontWeight:700, cursor: hasBizInfo ? "pointer" : "not-allowed" }}>
              {scanLoading ? "🩺 Auditing your listing data..." : "Run Inconsistency Scan →"}
            </button>
          </div>

          {scanResults && !scanResults.error && (
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              {/* Score card */}
              <div style={{ ...card, padding:20, display:"flex", gap:20, alignItems:"center" }}>
                <div style={{ textAlign:"center", flexShrink:0 }}>
                  <div style={{ fontSize:48, fontWeight:900, color: scanResults.score >= 80 ? C.teal : scanResults.score >= 60 ? C.amber : C.red, lineHeight:1 }}>
                    {scanResults.grade || "B"}
                  </div>
                  <div style={{ fontSize:11, color:"#6aaedd", marginTop:2 }}>NAP Health Score</div>
                  <div style={{ fontSize:18, fontWeight:700, color:"#c8c8d0", marginTop:4 }}>{scanResults.score}/100</div>
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12, fontWeight:600, color:"#f0ede8", marginBottom:8 }}>Issues Found: {scanResults.issues?.length || 0}</div>
                  <div style={{ height:6, borderRadius:3, background:"rgba(255,255,255,0.08)", marginBottom:12 }}>
                    <div style={{ width:`${scanResults.score}%`, height:"100%", borderRadius:3, background:`linear-gradient(90deg,${scanResults.score>=80?C.teal:scanResults.score>=60?C.amber:C.red},${C.blue})`, transition:"width .5s" }} />
                  </div>
                  {scanResults.strengths?.length > 0 && (
                    <div>
                      <div style={{ fontSize:10, color:C.teal, fontWeight:700, marginBottom:4 }}>✓ STRENGTHS</div>
                      {scanResults.strengths.map((s,i) => <div key={i} style={{ fontSize:11, color:"#c8c8d0", marginBottom:2 }}>• {s}</div>)}
                    </div>
                  )}
                </div>
              </div>

              {/* Issues */}
              {scanResults.issues?.length > 0 && (
                <div style={{ ...card, padding:20 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:"#f0ede8", marginBottom:12 }}>Issues to Fix</div>
                  <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                    {scanResults.issues.map((issue, i) => (
                      <div key={i} style={{ padding:"12px 14px", borderRadius:9, background:"rgba(255,255,255,0.025)", borderLeft:`3px solid ${sevColor(issue.severity)}` }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:5 }}>
                          <span style={{ fontSize:16 }}>{issue.icon || "⚠️"}</span>
                          <span style={{ fontSize:12, fontWeight:600, color:"#f0ede8" }}>{issue.field}</span>
                          <span style={{ fontSize:9, padding:"2px 7px", borderRadius:20, background:sevColor(issue.severity)+"22", color:sevColor(issue.severity), fontWeight:700, marginLeft:"auto" }}>{issue.severity}</span>
                        </div>
                        <div style={{ fontSize:11, color:"#c8c8d0", marginBottom:5 }}>{issue.issue}</div>
                        <div style={{ fontSize:11, color:C.teal }}><span style={{ color:"#6aaedd" }}>Fix: </span>{issue.fix}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* NAP Risk Variants */}
              {scanResults.napRisks?.length > 0 && (
                <div style={{ ...card, padding:16 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:"#f0ede8", marginBottom:8 }}>⚡ NAP Variation Risks</div>
                  <div style={{ fontSize:11, color:"#6aaedd", marginBottom:8 }}>These name/address variations may exist across directories — search each to find and correct them:</div>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                    {scanResults.napRisks.map((r, i) => (
                      <span key={i} style={{ padding:"4px 10px", borderRadius:20, background:"rgba(255,140,66,0.12)", border:"0.5px solid rgba(255,140,66,0.3)", color:C.orange, fontSize:11 }}>{r}</span>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display:"flex", gap:8 }}>
                <button onClick={() => { setScanResults(null); save("scan_results", null); }}
                  style={{ flex:1, padding:"9px", borderRadius:8, background:"rgba(255,255,255,0.05)", border:"0.5px solid rgba(255,255,255,0.1)", color:"#6aaedd", fontSize:12, cursor:"pointer" }}>Clear Results</button>
                <button onClick={runInconsistencyScan} disabled={scanLoading}
                  style={{ flex:1, padding:"9px", borderRadius:8, background:`${C.purple}22`, border:`0.5px solid ${C.purple}44`, color:C.purple, fontSize:12, fontWeight:600, cursor:"pointer" }}>
                  Re-scan
                </button>
              </div>
            </div>
          )}
          {scanResults?.error && (
            <div style={{ ...card, padding:16, border:`0.5px solid ${C.red}44` }}>
              <div style={{ fontSize:12, color:C.red }}>{scanResults.error}</div>
            </div>
          )}
        </div>
      )}

      {/* ── SYNC & PUSH ── */}
      {subTab === "sync" && (
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          {!hasBizInfo && (
            <div style={{ ...card, padding:16, border:`0.5px solid ${C.orange}44`, background:"rgba(255,140,66,0.05)" }}>
              <div style={{ fontSize:12, color:C.orange, fontWeight:600 }}>⚠ Set your Business Info first</div>
              <div style={{ fontSize:11, color:"#c8c8d0", marginTop:4 }}>
                The sync tool uses your canonical info to generate update guides.{" "}
                <button onClick={() => setSubTab("bizinfo")} style={{ color:C.blue, background:"none", border:"none", cursor:"pointer", fontSize:11, fontWeight:600 }}>Set it now →</button>
              </div>
            </div>
          )}

          <div style={{ ...card, padding:20 }}>
            <div style={{ fontSize:14, fontWeight:700, color:"#f0ede8", marginBottom:4 }}>🔄 Sync & Push to All Listings</div>
            <div style={{ fontSize:11, color:"#6aaedd", marginBottom:6 }}>
              Your canonical info gets pushed to each listing with AI-generated step-by-step update instructions.
            </div>
            {hasBizInfo && (
              <div style={{ padding:"10px 12px", borderRadius:8, background:"rgba(0,200,150,0.05)", border:`0.5px solid ${C.teal}33`, fontSize:11, color:"#c8c8d0" }}>
                📋 Using: <span style={{ color:"#f0ede8", fontWeight:600 }}>{bizInfo.businessName}</span> · {bizInfo.phone} · {bizInfo.website}
              </div>
            )}
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))", gap:10 }}>
            {DEFAULT_LISTINGS.map(l => {
              const status = listingStatuses[l.name] || "Unclaimed";
              const isExpanded = !!pushResult[l.name];
              const isLoading = pushTarget === l.name && pushLoading;
              return (
                <div key={l.name} style={{ ...card, overflow:"hidden" }}>
                  <div style={{ padding:"12px 14px", display:"flex", gap:10, alignItems:"center" }}>
                    <span style={{ fontSize:20, flexShrink:0 }}>{l.icon}</span>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12, fontWeight:600, color:"#f0ede8" }}>{l.name}</div>
                      <span style={{ fontSize:9, padding:"1px 6px", borderRadius:20, background:(status==="Claimed"||status==="Active"?C.teal:C.orange)+"22", color:(status==="Claimed"||status==="Active"?C.teal:C.orange), fontWeight:700 }}>{status}</span>
                    </div>
                    <div style={{ display:"flex", gap:5, flexShrink:0 }}>
                      <a href={l.url} target="_blank" rel="noreferrer"
                        style={{ padding:"5px 9px", borderRadius:6, background:`${l.color}18`, border:`0.5px solid ${l.color}44`, color:l.color, fontSize:10, textDecoration:"none" }}>
                        Open ↗
                      </a>
                      {hasBizInfo && (
                        <button onClick={() => generatePushGuide(l)} disabled={isLoading}
                          style={{ padding:"5px 9px", borderRadius:6, background:isLoading?"rgba(255,255,255,0.04)":"rgba(0,200,150,0.12)", border:`0.5px solid ${C.teal}44`, color:C.teal, fontSize:10, cursor:"pointer", fontWeight:600 }}>
                          {isLoading ? "⟳" : "Push →"}
                        </button>
                      )}
                    </div>
                  </div>
                  {isExpanded && (
                    <div style={{ padding:"10px 14px 12px", borderTop:"0.5px solid rgba(255,255,255,0.05)", background:"rgba(0,0,0,0.2)" }}>
                      <div style={{ fontSize:10, color:C.teal, fontWeight:700, marginBottom:6 }}>📋 UPDATE GUIDE</div>
                      <div style={{ fontSize:11, color:"#c8c8d0", lineHeight:1.7, whiteSpace:"pre-wrap" }}>{pushResult[l.name]}</div>
                      <button onClick={() => setPushResult(p => { const n = {...p}; delete n[l.name]; return n; })}
                        style={{ marginTop:8, padding:"4px 10px", borderRadius:6, background:"rgba(255,255,255,0.05)", border:"none", color:"#6aaedd", fontSize:10, cursor:"pointer" }}>
                        Dismiss
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── MAIN MARKETING PANEL ──────────────────────────────────────────────────────
export default function MarketingPanel() {
  const [tab, setTab] = useState("Overview");

  // SEO
  const [seoTarget, setSeoTarget]   = useState(() => load("seo_target", { company:"", website:"", industry:"", location:"" }));
  const [keyword, setKeyword]       = useState("");
  const [keyResult, setKeyResult]   = useState("");
  const [metaUrl, setMetaUrl]       = useState("");
  const [metaResult, setMetaResult] = useState("");
  const [seoAudit, setSeoAudit]     = useState("");
  const [localChecks, setLocalChecks] = useState(() => load("seo_checks", LOCAL_SEO_ITEMS.map(() => false)));
  const [aiLoading, setAiLoading]   = useState({});
  const [seoLoadingKey, setSeoLoadingKey] = useState(null);

  // Campaigns
  const [campaigns, setCampaigns] = useState(() => load("campaigns", []));
  const [newCampaignOpen, setNewCampaignOpen] = useState(false);
  const [campaignForm, setCampaignForm] = useState({ name:"", subject:"", body:"", status:"Draft" });
  const [activityLog, setActivityLog] = useState(() => load("activity_log", []));

  function logActivity(icon, label, color) {
    const entry = { icon, label, color, time: new Date().toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" }), date: new Date().toLocaleDateString() };
    setActivityLog(prev => { const updated = [entry, ...prev].slice(0, 50); save("activity_log", updated); return updated; });
  }

  useEffect(() => { save("seo_checks", localChecks); }, [localChecks]);
  useEffect(() => { save("seo_target", seoTarget); }, [seoTarget]);
  useEffect(() => { save("campaigns", campaigns); }, [campaigns]);

  const bizCtx = seoTarget.company
    ? `"${seoTarget.company}"${seoTarget.website ? ` (${seoTarget.website})` : ""}${seoTarget.industry ? `, a ${seoTarget.industry} business` : ""}${seoTarget.location ? ` in ${seoTarget.location}` : ""}`
    : "this business";

  async function doKeyword() {
    if (!keyword.trim() || seoLoadingKey) return;
    setSeoLoadingKey("keyword"); setKeyResult("");
    const r = await invokeLLM(`You are an SEO expert. Research keywords related to: "${keyword}" for ${bizCtx}. Provide 10 keyword suggestions with estimated monthly search volume, keyword difficulty (Low/Med/High), and search intent (Informational/Commercial/Transactional). Format as a clean numbered list.`);
    setKeyResult(r); setSeoLoadingKey(null);
    logActivity("🔍", `Keyword research: "${keyword}"`, C.blue);
  }

  async function doMeta() {
    if (!metaUrl.trim() || seoLoadingKey) return;
    setSeoLoadingKey("meta"); setMetaResult("");
    const r = await invokeLLM(`Generate an SEO-optimized meta title (max 60 chars) and meta description (max 155 chars) for ${bizCtx}. Page/topic: "${metaUrl}". Provide both clearly labeled.`);
    setMetaResult(r); setSeoLoadingKey(null);
    logActivity("📝", `Meta tags generated for: ${metaUrl}`, C.teal);
  }

  async function doAudit() {
    if (!seoTarget.company.trim() || seoLoadingKey) return;
    setSeoLoadingKey("audit"); setSeoAudit("");
    const r = await invokeLLM(`Perform a comprehensive SEO audit for ${bizCtx}. Cover:
1. Technical SEO issues (site speed, mobile, crawlability)
2. On-page SEO gaps (title tags, headers, content)
3. Local SEO opportunities${seoTarget.location ? ` specific to ${seoTarget.location}` : ""}
4. Backlink & authority gaps
5. Competitor keyword opportunities
6. Top 3 quick wins they can do this week

For each area, give a specific actionable fix. Be direct and practical.`);
    setSeoAudit(r); setSeoLoadingKey(null);
    logActivity("🔬", `SEO audit: ${seoTarget.company}`, C.purple);
  }

  async function doCompetitorAnalysis() {
    if (!seoTarget.company.trim() || seoLoadingKey) return;
    setSeoLoadingKey("competitor"); setSeoAudit("");
    const r = await invokeLLM(`Run a competitor SEO analysis for ${bizCtx}.
1. Identify 5 likely direct competitors in their space
2. For each competitor, estimate their SEO strengths and keyword focus
3. Find keyword gaps — terms competitors rank for that this business probably doesn't
4. Identify content opportunities (topics/pages they should create)
5. Give 3 specific tactics to outrank them within 90 days

Be specific and actionable.`);
    setSeoAudit(r); setSeoLoadingKey(null);
    logActivity("⚔️", `Competitor analysis: ${seoTarget.company}`, C.orange);
  }

  async function doBacklinkAudit() {
    if (!seoTarget.company.trim() || seoLoadingKey) return;
    setSeoLoadingKey("backlink"); setSeoAudit("");
    const r = await invokeLLM(`Analyze backlink opportunities for ${bizCtx}.
1. Types of backlinks they should be targeting based on their industry
2. Top 10 specific websites/directories they should get links from
3. Link building tactics that work best for their business type
4. Guest posting opportunities in their niche
5. Local citation sources for${seoTarget.location ? ` ${seoTarget.location}` : " their city"}
6. Estimated domain authority impact from each source

Give direct URLs where possible.`);
    setSeoAudit(r); setSeoLoadingKey(null);
    logActivity("🔗", `Backlink audit: ${seoTarget.company}`, C.purple);
  }

  function addCampaign() {
    if (!campaignForm.name.trim()) return;
    const c = { ...campaignForm, id: Date.now(), created: new Date().toLocaleDateString(), opens:"—", clicks:"—", sent:"—" };
    setCampaigns(prev => [c, ...prev]);
    setCampaignForm({ name:"", subject:"", body:"", status:"Draft" });
    setNewCampaignOpen(false);
    logActivity("📧", `Campaign created: "${c.name}"`, C.blue);
  }

  const listingStatuses = load("listing_statuses", {});
  const overviewStats = [
    { label:"Active Campaigns", val: campaigns.filter(c => c.status === "Active").length || "0", color:C.blue, icon:"📢" },
    { label:"Total Campaigns",  val: campaigns.length || "0",                                     color:C.purple, icon:"📋" },
    { label:"Listings Active",  val: `${Object.values(listingStatuses).filter(s => s==="Claimed" || s==="Active").length}/${DEFAULT_LISTINGS.length}`, color:C.teal, icon:"📍" },
    { label:"SEO Checklist",    val: `${localChecks.filter(Boolean).length}/${LOCAL_SEO_ITEMS.length}`, color:C.orange, icon:"✅" },
  ];

  return (
    <div style={{ height:"100%", display:"flex", flexDirection:"column", overflow:"hidden" }}>
      {/* Tab bar */}
      <div style={{ display:"flex", borderBottom:"0.5px solid rgba(255,255,255,0.07)", padding:"0 24px", flexShrink:0, background:"#0b0c14" }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding:"12px 16px", border:"none", cursor:"pointer", fontSize:11, fontWeight:600, background:"transparent", color:tab===t ? C.blue : "#6aaedd", borderBottom:tab===t ? `2px solid ${C.blue}` : "2px solid transparent" }}>{t}</button>
        ))}
      </div>

      <div style={{ flex:1, overflowY:"auto", padding:24 }}>

        {tab === "Overview" && (
          <>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:20 }}>
              {overviewStats.map(({ label, val, color, icon }) => (
                <div key={label} style={{ ...card, padding:18 }}>
                  <div style={{ fontSize:22, marginBottom:8 }}>{icon}</div>
                  <div style={{ fontSize:28, fontWeight:800, color }}>{val}</div>
                  <div style={{ fontSize:11, color:"#6aaedd" }}>{label}</div>
                </div>
              ))}
            </div>
            <div style={{ ...card, padding:20 }}>
              <div style={{ fontSize:13, fontWeight:700, color:"#f0ede8", marginBottom:12 }}>Recent Activity</div>
              {activityLog.length === 0 ? (
                <div style={{ fontSize:12, color:"#444", fontStyle:"italic", padding:"12px 0" }}>No activity yet — start using Marketing tools to see your log here.</div>
              ) : activityLog.slice(0,8).map((a, i) => (
                <div key={i} style={{ display:"flex", gap:12, alignItems:"center", padding:"10px 0", borderBottom:"0.5px solid rgba(255,255,255,0.04)" }}>
                  <span style={{ fontSize:18 }}>{a.icon}</span>
                  <div style={{ flex:1, fontSize:12, color:"#c8c8d0" }}>{a.label}</div>
                  <span style={{ fontSize:10, color:"#2a6fa8" }}>{a.time}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === "SEO Tools" && (
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>

            {/* ── Target Company Bar ── */}
            <div style={{ ...card, padding:18, background:"rgba(74,179,244,0.04)", border:`0.5px solid ${C.blue}33` }}>
              <div style={{ fontSize:12, fontWeight:700, color:C.blue, marginBottom:10 }}>🎯 Target Company — all tools below run against this</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:8 }}>
                {[
                  ["Company Name","company","text","CEO GPS"],
                  ["Website","website","url","https://ceogps.com"],
                  ["Industry","industry","text","Digital Marketing"],
                  ["Location","location","text","Atlanta, GA"],
                ].map(([label,key,type,ph]) => (
                  <div key={key}>
                    <div style={{ fontSize:9, color:"#6aaedd", fontWeight:600, marginBottom:3, letterSpacing:".06em" }}>{label.toUpperCase()}</div>
                    <input type={type} value={seoTarget[key]||""} placeholder={ph}
                      onChange={e => setSeoTarget(t => ({...t,[key]:e.target.value}))}
                      style={{ ...inp, padding:"7px 10px", fontSize:12 }} />
                  </div>
                ))}
              </div>
              {seoTarget.company && (
                <div style={{ marginTop:8, fontSize:11, color:"#6aaedd" }}>
                  Analyzing: <span style={{ color:"#f0ede8", fontWeight:600 }}>{seoTarget.company}</span>
                  {seoTarget.website && <> · <span style={{ color:C.teal }}>{seoTarget.website}</span></>}
                  {seoTarget.location && <> · {seoTarget.location}</>}
                </div>
              )}
            </div>

            {/* ── Full SEO Audit Buttons ── */}
            <div style={{ ...card, padding:18 }}>
              <div style={{ fontSize:13, fontWeight:700, color:"#f0ede8", marginBottom:4 }}>🔬 AI SEO Analysis</div>
              <div style={{ fontSize:11, color:"#6aaedd", marginBottom:12 }}>
                {seoTarget.company ? `Running against: ${seoTarget.company}` : "Set a target company above first"}
              </div>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                {[
                  { key:"audit",      label:"Full SEO Audit",         fn: doAudit,              color:C.purple, icon:"🔬" },
                  { key:"competitor", label:"Competitor Analysis",     fn: doCompetitorAnalysis, color:C.orange, icon:"⚔️" },
                  { key:"backlink",   label:"Backlink Opportunities",  fn: doBacklinkAudit,      color:C.teal,   icon:"🔗" },
                ].map(btn => (
                  <button key={btn.key} onClick={btn.fn}
                    disabled={!seoTarget.company.trim() || seoLoadingKey === btn.key}
                    style={{ padding:"9px 18px", borderRadius:8, background:`${btn.color}20`, border:`0.5px solid ${btn.color}55`, color:btn.color, fontSize:12, fontWeight:700, cursor: seoTarget.company ? "pointer" : "not-allowed", opacity: seoTarget.company ? 1 : 0.5 }}>
                    {seoLoadingKey === btn.key ? "◈ Running..." : `${btn.icon} ${btn.label}`}
                  </button>
                ))}
                {seoAudit && (
                  <button onClick={() => setSeoAudit("")}
                    style={{ padding:"9px 12px", borderRadius:8, background:"rgba(255,79,94,0.1)", border:`0.5px solid ${C.red}33`, color:C.red, fontSize:11, cursor:"pointer" }}>
                    Clear
                  </button>
                )}
              </div>
              {!seoTarget.company && (
                <div style={{ marginTop:10, fontSize:11, color:"#444", fontStyle:"italic" }}>← Enter a company name in the Target bar to unlock these tools</div>
              )}
              {seoAudit && (
                <div style={{ marginTop:14, padding:"14px 16px", borderRadius:10, background:"rgba(139,127,255,0.05)", border:"0.5px solid rgba(139,127,255,0.2)", fontSize:12, color:"#c8c8d0", lineHeight:1.8, whiteSpace:"pre-wrap" }}>
                  {seoAudit}
                </div>
              )}
            </div>

            {/* ── Keyword Research ── */}
            <div style={{ ...card, padding:18 }}>
              <div style={{ fontSize:13, fontWeight:700, color:"#f0ede8", marginBottom:10 }}>🔍 Keyword Research</div>
              <div style={{ display:"flex", gap:8 }}>
                <input value={keyword} onChange={e => setKeyword(e.target.value)}
                  onKeyDown={e => e.key==="Enter" && doKeyword()}
                  placeholder="Seed keyword or topic (e.g. 'digital marketing Atlanta')" style={inp} />
                <button onClick={doKeyword} disabled={!!seoLoadingKey || !keyword.trim()}
                  style={{ padding:"9px 18px", borderRadius:8, background:`${C.blue}20`, border:`0.5px solid ${C.blue}55`, color:C.blue, fontSize:12, cursor:"pointer", fontWeight:600, flexShrink:0, opacity: keyword.trim() ? 1 : 0.5 }}>
                  {seoLoadingKey === "keyword" ? "◈..." : "Research"}
                </button>
              </div>
              {seoTarget.company && <div style={{ fontSize:10, color:"#444", marginTop:4 }}>Context: {seoTarget.company}{seoTarget.location ? ` · ${seoTarget.location}` : ""}</div>}
              {keyResult && (
                <div style={{ marginTop:12, padding:"12px 14px", borderRadius:10, background:"rgba(74,179,244,0.06)", border:"0.5px solid rgba(74,179,244,0.2)", fontSize:12, color:"#c8c8d0", lineHeight:1.8, whiteSpace:"pre-wrap" }}>
                  {keyResult}
                  <button onClick={() => setKeyResult("")} style={{ display:"block", marginTop:8, padding:"3px 10px", borderRadius:6, background:"rgba(255,255,255,0.05)", border:"none", color:"#555", fontSize:10, cursor:"pointer" }}>Clear</button>
                </div>
              )}
            </div>

            {/* ── Meta Generator ── */}
            <div style={{ ...card, padding:18 }}>
              <div style={{ fontSize:13, fontWeight:700, color:"#f0ede8", marginBottom:10 }}>📝 Meta Title & Description</div>
              <div style={{ display:"flex", gap:8 }}>
                <input value={metaUrl} onChange={e => setMetaUrl(e.target.value)}
                  onKeyDown={e => e.key==="Enter" && doMeta()}
                  placeholder="Page URL or topic (e.g. 'homepage', 'services page', 'about us')" style={inp} />
                <button onClick={doMeta} disabled={!!seoLoadingKey || !metaUrl.trim()}
                  style={{ padding:"9px 18px", borderRadius:8, background:`${C.teal}20`, border:`0.5px solid ${C.teal}55`, color:C.teal, fontSize:12, cursor:"pointer", fontWeight:600, flexShrink:0, opacity: metaUrl.trim() ? 1 : 0.5 }}>
                  {seoLoadingKey === "meta" ? "◈..." : "Generate"}
                </button>
              </div>
              {seoTarget.company && <div style={{ fontSize:10, color:"#444", marginTop:4 }}>Context: {seoTarget.company}{seoTarget.industry ? ` · ${seoTarget.industry}` : ""}</div>}
              {metaResult && (
                <div style={{ marginTop:12, padding:"12px 14px", borderRadius:10, background:"rgba(0,200,150,0.06)", border:"0.5px solid rgba(0,200,150,0.2)", fontSize:12, color:"#c8c8d0", lineHeight:1.8, whiteSpace:"pre-wrap" }}>
                  {metaResult}
                  <button onClick={() => setMetaResult("")} style={{ display:"block", marginTop:8, padding:"3px 10px", borderRadius:6, background:"rgba(255,255,255,0.05)", border:"none", color:"#555", fontSize:10, cursor:"pointer" }}>Clear</button>
                </div>
              )}
            </div>

            {/* ── Local SEO Checklist ── */}
            <div style={{ ...card, padding:18 }}>
              <div style={{ fontSize:13, fontWeight:700, color:"#f0ede8", marginBottom:4 }}>📍 Local SEO Checklist</div>
              <div style={{ fontSize:11, color:"#6aaedd", marginBottom:10 }}>
                {localChecks.filter(Boolean).length}/{LOCAL_SEO_ITEMS.length} complete
                {seoTarget.company && <span style={{ marginLeft:8, color:"#444" }}>— tracking for {seoTarget.company}</span>}
              </div>
              <div style={{ height:4, borderRadius:2, background:"rgba(255,255,255,0.08)", marginBottom:14 }}>
                <div style={{ width:`${(localChecks.filter(Boolean).length/LOCAL_SEO_ITEMS.length)*100}%`, height:"100%", background:`linear-gradient(90deg,${C.teal},${C.blue})`, borderRadius:2, transition:"width .3s" }} />
              </div>
              {LOCAL_SEO_ITEMS.map((item, i) => (
                <label key={i} style={{ display:"flex", gap:10, alignItems:"center", padding:"8px 0", borderBottom:"0.5px solid rgba(255,255,255,0.04)", cursor:"pointer" }}>
                  <input type="checkbox" checked={localChecks[i]} onChange={e => setLocalChecks(c => c.map((v,j) => j===i ? e.target.checked : v))} />
                  <span style={{ fontSize:12, color:localChecks[i] ? C.teal : "#c8c8d0", textDecoration:localChecks[i] ? "line-through" : "none" }}>{item}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {tab === "Email Campaigns" && (
          <>
            <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" }}>
              <button onClick={() => setNewCampaignOpen(true)} style={{ padding:"9px 20px", borderRadius:20, background:`linear-gradient(135deg,${C.blue},${C.teal})`, border:"none", color:"#000", fontSize:12, fontWeight:700, cursor:"pointer" }}>+ New Campaign</button>
              <a href="https://app.brevo.com" target="_blank" rel="noreferrer" style={{ padding:"9px 16px", borderRadius:20, background:"rgba(255,255,255,0.05)", border:"0.5px solid rgba(255,255,255,0.1)", color:"#6aaedd", fontSize:12, cursor:"pointer", textDecoration:"none" }}>🔗 Open Brevo</a>
              <a href="https://mailchimp.com/login" target="_blank" rel="noreferrer" style={{ padding:"9px 16px", borderRadius:20, background:"rgba(255,255,255,0.05)", border:"0.5px solid rgba(255,255,255,0.1)", color:"#6aaedd", fontSize:12, cursor:"pointer", textDecoration:"none" }}>🔗 Open Mailchimp</a>
            </div>
            {campaigns.length === 0 ? (
              <div style={{ ...card, padding:40, textAlign:"center" }}>
                <div style={{ fontSize:32, marginBottom:12 }}>📧</div>
                <div style={{ fontSize:14, fontWeight:600, color:"#f0ede8", marginBottom:6 }}>No campaigns yet</div>
                <button onClick={() => setNewCampaignOpen(true)} style={{ padding:"9px 20px", borderRadius:20, background:`${C.blue}20`, border:`0.5px solid ${C.blue}55`, color:C.blue, fontSize:12, fontWeight:700, cursor:"pointer" }}>+ Create Campaign</button>
              </div>
            ) : (
              <div style={{ ...card, overflow:"hidden" }}>
                <table style={{ width:"100%", borderCollapse:"collapse" }}>
                  <thead>
                    <tr style={{ borderBottom:"0.5px solid rgba(255,255,255,0.07)" }}>
                      {["Campaign","Subject","Status","Created",""].map(h => (
                        <th key={h} style={{ padding:"12px 16px", textAlign:"left", fontSize:11, color:"#2a6fa8", fontWeight:600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {campaigns.map(c => (
                      <tr key={c.id} style={{ borderBottom:"0.5px solid rgba(255,255,255,0.04)" }}>
                        <td style={{ padding:"12px 16px", fontSize:13, color:"#f0ede8" }}>{c.name}</td>
                        <td style={{ padding:"12px 16px", fontSize:12, color:"#6aaedd", maxWidth:200, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{c.subject || "—"}</td>
                        <td style={{ padding:"12px 16px" }}>
                          <span style={{ fontSize:11, padding:"3px 10px", borderRadius:20, background:c.status==="Active"?`${C.teal}20`:c.status==="Sent"?`${C.blue}20`:"rgba(255,255,255,0.06)", color:c.status==="Active"?C.teal:c.status==="Sent"?C.blue:"#6aaedd" }}>{c.status}</span>
                        </td>
                        <td style={{ padding:"12px 16px", fontSize:12, color:"#6aaedd" }}>{c.created}</td>
                        <td style={{ padding:"12px 16px" }}>
                          <button onClick={() => setCampaigns(prev => prev.filter(x => x.id !== c.id))} style={{ padding:"4px 10px", borderRadius:6, background:"rgba(255,79,94,0.1)", border:"0.5px solid rgba(255,79,94,0.3)", color:C.red, fontSize:10, cursor:"pointer" }}>Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {newCampaignOpen && (
              <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.8)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center" }} onClick={e => { if(e.target===e.currentTarget) setNewCampaignOpen(false); }}>
                <div style={{ ...card, width:500, padding:24, border:`1px solid ${C.blue}40` }}>
                  <div style={{ fontSize:15, fontWeight:700, color:"#f0ede8", marginBottom:16 }}>New Email Campaign</div>
                  {[["Campaign Name","name","text"],["Subject Line","subject","text"]].map(([label,key,type]) => (
                    <div key={key} style={{ marginBottom:10 }}>
                      <div style={{ fontSize:11, color:"#6aaedd", marginBottom:4 }}>{label}</div>
                      <input type={type} value={campaignForm[key]} onChange={e => setCampaignForm(f => ({...f,[key]:e.target.value}))} style={inp} />
                    </div>
                  ))}
                  <div style={{ marginBottom:10 }}>
                    <div style={{ fontSize:11, color:"#6aaedd", marginBottom:4 }}>Status</div>
                    <select value={campaignForm.status} onChange={e => setCampaignForm(f => ({...f,status:e.target.value}))} style={inp}>
                      {["Draft","Active","Sent","Paused"].map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div style={{ marginBottom:14 }}>
                    <div style={{ fontSize:11, color:"#6aaedd", marginBottom:4 }}>Email Body</div>
                    <textarea value={campaignForm.body} onChange={e => setCampaignForm(f => ({...f,body:e.target.value}))} style={{ ...inp, minHeight:120, resize:"vertical" }} />
                  </div>
                  <div style={{ display:"flex", gap:8 }}>
                    <button onClick={() => setNewCampaignOpen(false)} style={{ flex:1, padding:"9px", borderRadius:8, background:"rgba(255,255,255,0.05)", border:"0.5px solid rgba(255,255,255,0.1)", color:"#6aaedd", fontSize:12, cursor:"pointer" }}>Cancel</button>
                    <button onClick={addCampaign} style={{ flex:1, padding:"9px", borderRadius:8, background:`linear-gradient(135deg,${C.blue},${C.teal})`, border:"none", color:"#000", fontSize:12, fontWeight:700, cursor:"pointer" }}>Save Campaign</button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {tab === "Search Analytics" && (
          <div style={{ ...card, padding:40, textAlign:"center" }}>
            <div style={{ fontSize:28, marginBottom:10 }}>📊</div>
            <div style={{ fontSize:14, fontWeight:600, color:"#f0ede8", marginBottom:8 }}>Connect Your Analytics</div>
            <div style={{ fontSize:12, color:"#6aaedd", marginBottom:16 }}>Link Google Search Console and Analytics for real data here.</div>
            <div style={{ display:"flex", gap:10, justifyContent:"center" }}>
              <a href="https://search.google.com/search-console" target="_blank" rel="noreferrer" style={{ padding:"9px 18px", borderRadius:20, background:`${C.blue}20`, border:`0.5px solid ${C.blue}55`, color:C.blue, fontSize:12, fontWeight:600, textDecoration:"none" }}>🔗 Search Console</a>
              <a href="https://analytics.google.com" target="_blank" rel="noreferrer" style={{ padding:"9px 18px", borderRadius:20, background:`${C.teal}20`, border:`0.5px solid ${C.teal}55`, color:C.teal, fontSize:12, fontWeight:600, textDecoration:"none" }}>🔗 Google Analytics</a>
            </div>
          </div>
        )}

        {tab === "Listings" && <ListingsTab />}
        {tab === "People Capital" && <PeopleCapitalVault />}
      </div>
    </div>
  );
}
// ══════════════════════════════════════════════════════════════════════════════
// PEOPLE CAPITAL VAULT
// ══════════════════════════════════════════════════════════════════════════════
function PeopleCapitalVault() {
  const [people,   setPeople]   = useState([]);
  const [filter,   setFilter]   = useState("All");
  const [sort,     setSort]     = useState("score");
  const [search,   setSearch]   = useState("");
  const [selected, setSelected] = useState(null);
  const [nudgeLoading, setNudgeLoading] = useState(false);
  const [nudgeResult,  setNudgeResult]  = useState("");
  const [nudgeType,    setNudgeType]    = useState("");
  const [editingScore, setEditingScore] = useState(null);
  const [overrides, setOverrides] = useState(() => {
    try { return JSON.parse(localStorage.getItem("lifeos_capital_overrides") || "{}"); } catch { return {}; }
  });

  // ── Load & merge all people sources ─────────────────────────────────────
  useEffect(() => {
    const contacts = (() => {
      try { return JSON.parse(localStorage.getItem("lifeos_contacts") || "[]"); } catch { return []; }
    })();
    const crm = (() => {
      try { return JSON.parse(localStorage.getItem("lifeos_crm") || "[]"); } catch { return []; }
    })();
    const family = (() => {
      try { return JSON.parse(localStorage.getItem("family_members_v2") || "[]"); } catch { return []; }
    })();

    const merged = [
      ...family.map(m => ({
        id: "fam_" + m.id, name: m.name, type: "Family", subtype: m.relation || "Family",
        email: m.email || "", phone: m.phone || "",
        lastContact: m.reminders?.length ? "Recent" : null,
        tags: m.tags || [], notes: m.notes || "",
        birthday: m.birthday || "",
        kpi: m.kpi, favorites: m.favorites,
        photo: m.photo || "",
        _raw: m,
      })),
      ...contacts.filter(c => {
        const name = ((c.firstName||"") + " " + (c.lastName||c.name||"")).trim();
        return name && name !== "Chris Green";
      }).map(c => ({
        id: "con_" + c.id, name: ((c.firstName||"") + " " + (c.lastName||c.name||"")).trim(),
        type: c.group === "Family" ? "Family" : c.group === "Work" ? "Business" : "Personal",
        subtype: c.group || "Contact",
        email: c.email || "", phone: c.phone || "",
        lastContact: c.lastContact || null,
        tags: c.tags || [], notes: c.notes || c.note || "",
        birthday: c.birthday || "", company: c.company || "",
        photo: c.photo || "", socials: c.socials || {},
        _raw: c,
      })),
      ...crm.map(c => ({
        id: "crm_" + c.id, name: c.name || "Unknown",
        type: "Business", subtype: c.tag || c.stage || "Lead",
        email: c.email || "", phone: c.phone || "",
        lastContact: c.lastContact || null,
        tags: [c.tag, c.stage].filter(Boolean), notes: c.notes || "",
        birthday: c.birthday || "", company: c.company || "",
        value: c.value || "", stage: c.stage || "",
        _raw: c,
      })),
    ];

    // ── Score each person ────────────────────────────────────────────────
    const scored = merged.map(p => {
      const override = overrides[p.id];
      if (override !== undefined) return { ...p, capitalScore: override, scoreReason: "Manual override" };

      let score = 50;
      const reasons = [];

      // Type boosts
      if (p.type === "Family")   { score += 15; reasons.push("Family connection"); }
      if (p.type === "Business") { score += 5;  reasons.push("Business contact"); }

      // Tags
      if (p.tags.includes("VIP"))      { score += 20; reasons.push("VIP tag"); }
      if (p.tags.includes("Hot"))      { score += 18; reasons.push("Hot lead"); }
      if (p.tags.includes("Warm"))     { score += 10; reasons.push("Warm lead"); }
      if (p.tags.includes("Cold"))     { score -= 15; reasons.push("Cold tag"); }
      if (p.tags.includes("Referral")) { score += 12; reasons.push("Referral source"); }

      // Last contact freshness
      const lc = p.lastContact || "";
      if (!lc || lc === "Never") { score -= 20; reasons.push("Never contacted"); }
      else if (lc.includes("Just now") || lc.includes("Today")) { score += 20; reasons.push("Contacted today"); }
      else if (lc.includes("day") && parseInt(lc) < 3) { score += 15; reasons.push("Contacted recently"); }
      else if (lc.includes("week") && parseInt(lc) < 2) { score += 8; reasons.push("Contacted this week"); }
      else if (lc.includes("month") && parseInt(lc) < 2) { score += 2; }
      else if (lc.includes("month") || lc.includes("ago")) { score -= 10; reasons.push("Overdue outreach"); }

      // KPI (family members)
      if (p.kpi) {
        const avg = ((p.kpi.connect || 5) + (p.kpi.support || 5)) / 2;
        score += Math.round((avg - 5) * 3);
        if (avg < 5) reasons.push("Low relationship KPIs");
        if (avg >= 8) reasons.push("Strong relationship");
      }

      // CRM stage
      if (p.stage === "Closed Won")     { score += 25; reasons.push("Closed deal"); }
      if (p.stage === "Negotiation")    { score += 18; reasons.push("Active negotiation"); }
      if (p.stage === "Proposal")       { score += 12; reasons.push("Proposal stage"); }
      if (p.stage === "Qualified")      { score += 8; }
      if (p.stage === "Closed Lost")    { score -= 20; reasons.push("Closed lost"); }

      // Deal value bonus
      if (p.value) {
        const num = parseFloat(String(p.value).replace(/[^0-9.]/g,""));
        if (num > 10000) { score += 15; reasons.push("High-value deal"); }
        else if (num > 1000) { score += 8; }
      }

      // Notes & birthday data = bonus
      if (p.notes)    score += 3;
      if (p.birthday) { score += 5; reasons.push("Birthday tracked"); }

      return { ...p, capitalScore: Math.max(0, Math.min(100, Math.round(score))), scoreReason: reasons.slice(0,3).join(" · ") };
    });

    setPeople(scored.sort((a,b) => b.capitalScore - a.capitalScore));
  }, [overrides]);

  // ── Helpers ──────────────────────────────────────────────────────────────
  function scoreLabel(s) {
    if (s >= 80) return { label:"🔥 Hot", color:"#ff4f5e" };
    if (s >= 65) return { label:"⚡ Active", color:"#ff8c42" };
    if (s >= 45) return { label:"🌡 Warm", color:"#4ab3f4" };
    return { label:"❄ Cold", color:"#6aaedd" };
  }

  function initials(name) {
    const parts = (name||"?").trim().split(" ").filter(Boolean);
    return parts.length === 1 ? parts[0][0] : (parts[0][0] + parts[parts.length-1][0]);
  }

  function avatarColor(name) {
    const palette = ["#4ab3f4","#00c896","#8b7fff","#ff8c42","#ff6b9d","#ffd700"];
    return palette[(name||"?").charCodeAt(0) % palette.length];
  }

  // ── AI Nurture Nudge ─────────────────────────────────────────────────────
  async function generateNudge(person, type) {
    setNudgeLoading(true); setNudgeType(type); setNudgeResult("");
    const today = new Date();
    const bdayLine = person.birthday ? `Birthday: ${person.birthday}` : "";
    const upcomingBday = (() => {
      if (!person.birthday) return "";
      try {
        const [y,m,d] = person.birthday.split("-");
        const bday = new Date(today.getFullYear(), parseInt(m)-1, parseInt(d));
        if (bday < today) bday.setFullYear(today.getFullYear()+1);
        const diff = Math.ceil((bday-today)/(1000*60*60*24));
        if (diff <= 30) return `⚠️ Birthday in ${diff} days`;
        return "";
      } catch { return ""; }
    })();

    const nudgePrompts = {
      message: `Write a warm, natural outreach message from Chris Green (plumbing business owner, Atlanta) to ${person.name} (${person.type} - ${person.subtype}). 
${person.company ? "Company: " + person.company : ""}
${bdayLine} ${upcomingBday}
Notes: ${person.notes || "none"}
Tags: ${person.tags.join(", ") || "none"}
Last contact: ${person.lastContact || "unknown"}

Make it feel personal, specific, and non-salesy. Under 50 words. Include a subtle business value mention if they're a business contact.`,

      birthday: `Write a brief, warm birthday message from Chris Green to ${person.name} (${person.type}).
${person.favorites?.food ? "Fav food: " + person.favorites.food : ""}
${person.notes ? "Notes: " + person.notes : ""}
Make it genuine and personal, under 40 words. If they're a business contact, you can gently mention a shared project or service.`,

      reconnect: `Chris Green (plumbing contractor, Atlanta) needs to reconnect with ${person.name} (${person.type} - ${person.subtype}).
Last contact: ${person.lastContact || "a long time ago"}
Notes: ${person.notes || "none"}
${person.company ? "Company: " + person.company : ""}
Write a short, warm reconnection message. Acknowledge the gap naturally. Under 60 words.`,

      referral: `Write a referral request message from Chris Green (plumbing contractor, Atlanta) to ${person.name} (${person.type}).
Their role: ${person.subtype}${person.company ? " at " + person.company : ""}
Notes: ${person.notes || "none"}
Ask for referrals naturally — not pushy. Offer to reciprocate. Mention the quality of Chris's work. Under 60 words.`,

      voicenote: `Write a voice note SCRIPT (spoken words only, conversational) from Chris Green to ${person.name}.
Context: ${person.type} contact, ${person.subtype}${person.company ? " at " + person.company : ""}
${upcomingBday}
Notes: ${person.notes || "none"}
Sound natural, warm, brief (30-45 seconds when spoken). Mention something personal, then a light business touch if appropriate.`,
    };

    const res = await invokeLLM({ prompt: nudgePrompts[type] || nudgePrompts.message });
    setNudgeResult(res);
    setNudgeLoading(false);
  }

  function saveOverride(id, score) {
    const updated = { ...overrides, [id]: Number(score) };
    setOverrides(updated);
    localStorage.setItem("lifeos_capital_overrides", JSON.stringify(updated));
    setEditingScore(null);
  }

  // ── Filter & sort ────────────────────────────────────────────────────────
  const FILTERS = ["All","Family","Business","Personal","🔥 Hot","❄ Cold","🎂 Birthday Soon","Overdue"];
  const filtered = people.filter(p => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) &&
        !(p.company||"").toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === "All") return true;
    if (filter === "Family")   return p.type === "Family";
    if (filter === "Business") return p.type === "Business";
    if (filter === "Personal") return p.type === "Personal";
    if (filter === "🔥 Hot")   return p.capitalScore >= 80;
    if (filter === "❄ Cold")   return p.capitalScore < 45;
    if (filter === "🎂 Birthday Soon") {
      if (!p.birthday) return false;
      try {
        const today = new Date();
        const [,m,d] = p.birthday.split("-");
        const bday = new Date(today.getFullYear(), parseInt(m)-1, parseInt(d));
        if (bday < today) bday.setFullYear(today.getFullYear()+1);
        return Math.ceil((bday-today)/(1000*60*60*24)) <= 30;
      } catch { return false; }
    }
    if (filter === "Overdue") {
      const lc = p.lastContact || "";
      return !lc || lc === "Never" || lc.includes("month") || lc.includes("2 weeks");
    }
    return true;
  }).sort((a,b) => {
    if (sort === "score") return b.capitalScore - a.capitalScore;
    if (sort === "name")  return a.name.localeCompare(b.name);
    if (sort === "type")  return a.type.localeCompare(b.type);
    return 0;
  });

  const stats = {
    hot:     people.filter(p=>p.capitalScore>=80).length,
    warm:    people.filter(p=>p.capitalScore>=45&&p.capitalScore<80).length,
    cold:    people.filter(p=>p.capitalScore<45).length,
    overdue: people.filter(p=>{ const lc=p.lastContact||""; return !lc||lc==="Never"||lc.includes("month"); }).length,
  };

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display:"flex", gap:20, height:"calc(100vh - 140px)", overflow:"hidden" }}>

      {/* LEFT — List */}
      <div style={{ width:360, display:"flex", flexDirection:"column", gap:10, overflow:"hidden" }}>

        {/* Stats */}
        <div style={{ display:"flex", gap:8 }}>
          {[["🔥",stats.hot,"Hot","#ff4f5e"],["⚡",stats.warm,"Warm","#ff8c42"],["❄",stats.cold,"Cold","#4ab3f4"],["⏰",stats.overdue,"Overdue","#8b7fff"]].map(([icon,val,label,color])=>(
            <div key={label} style={{ flex:1, ...card, padding:"8px 6px", textAlign:"center" }}>
              <div style={{ fontSize:16, fontWeight:700, color }}>{val}</div>
              <div style={{ fontSize:9, color:"#555", marginTop:1 }}>{icon} {label}</div>
            </div>
          ))}
        </div>

        {/* Search + sort */}
        <div style={{ display:"flex", gap:6 }}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search people..."
            style={{ ...inp, flex:1, fontSize:12, padding:"7px 10px" }} />
          <select value={sort} onChange={e=>setSort(e.target.value)}
            style={{ ...inp, width:110, fontSize:11, padding:"7px 8px" }}>
            <option value="score">By Score</option>
            <option value="name">By Name</option>
            <option value="type">By Type</option>
          </select>
        </div>

        {/* Filter chips */}
        <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
          {FILTERS.map(f => (
            <button key={f} onClick={()=>setFilter(f)}
              style={{ padding:"3px 10px", borderRadius:20, fontSize:10, fontWeight:600, cursor:"pointer", border:"none",
                background: filter===f?"rgba(74,179,244,0.2)":"rgba(255,255,255,0.05)",
                color: filter===f?C.blue:"#666" }}>
              {f}
            </button>
          ))}
        </div>

        {/* People list */}
        <div style={{ flex:1, overflowY:"auto", display:"flex", flexDirection:"column", gap:6 }}>
          {filtered.length===0 && <div style={{ color:"#444", fontSize:12, textAlign:"center", marginTop:20 }}>No contacts loaded yet — add people in Contacts, CRM, or Family Hub.</div>}
          {filtered.map(p => {
            const sl = scoreLabel(p.capitalScore);
            const isSelected = selected?.id === p.id;
            return (
              <div key={p.id} onClick={()=>{ setSelected(p); setNudgeResult(""); setNudgeType(""); }}
                style={{ ...card, padding:"10px 12px", cursor:"pointer",
                  borderColor: isSelected?"rgba(74,179,244,0.4)":"rgba(255,255,255,0.07)",
                  background: isSelected?"rgba(74,179,244,0.06)":"#13141f" }}>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  {/* Avatar */}
                  {p.photo ? (
                    <img src={p.photo} alt={p.name} style={{ width:34,height:34,borderRadius:"50%",objectFit:"cover",flexShrink:0 }} />
                  ) : (
                    <div style={{ width:34,height:34,borderRadius:"50%",background:avatarColor(p.name),display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:"#0d0e17",flexShrink:0 }}>
                      {initials(p.name).toUpperCase()}
                    </div>
                  )}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:12,fontWeight:600,color:"#f0ede8",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{p.name}</div>
                    <div style={{ fontSize:10,color:"#666",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
                      {p.subtype}{p.company ? " · "+p.company : ""}
                    </div>
                  </div>
                  {/* Score bar */}
                  <div style={{ textAlign:"right", flexShrink:0 }}>
                    <div style={{ fontSize:16,fontWeight:700,color:sl.color }}>{p.capitalScore}</div>
                    <div style={{ fontSize:8,color:sl.color,fontWeight:600 }}>{sl.label}</div>
                  </div>
                </div>
                {/* Score bar */}
                <div style={{ height:2,background:"rgba(255,255,255,0.05)",borderRadius:1,marginTop:8 }}>
                  <div style={{ height:"100%",width:`${p.capitalScore}%`,background:sl.color,borderRadius:1,transition:"width .4s" }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* RIGHT — Detail */}
      <div style={{ flex:1, overflowY:"auto" }}>
        {!selected && (
          <div style={{ ...card, padding:30, textAlign:"center", color:"#444" }}>
            <div style={{ fontSize:32, marginBottom:12 }}>🏛</div>
            <div style={{ fontSize:16, fontWeight:700, color:"#f0ede8", marginBottom:6 }}>People Capital Vault</div>
            <div style={{ fontSize:12, lineHeight:1.8, maxWidth:380, margin:"0 auto" }}>
              AI-powered relationship health scores across every connection — family, friends, clients, and prospects. Select anyone to generate personalized nurture nudges.
            </div>
            <div style={{ marginTop:20, display:"flex", gap:10, justifyContent:"center", flexWrap:"wrap" }}>
              {[["🏛","Total",people.length,"#4ab3f4"],["🔥","Hot Relationships",stats.hot,"#ff4f5e"],["⏰","Need Nurturing",stats.overdue,"#8b7fff"]].map(([icon,label,val,color])=>(
                <div key={label} style={{ padding:"12px 20px", borderRadius:10, background:`${color}10`, border:`0.5px solid ${color}33` }}>
                  <div style={{ fontSize:22,fontWeight:700,color }}>{val}</div>
                  <div style={{ fontSize:10,color:"#666",marginTop:2 }}>{icon} {label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {selected && (
          <div>
            {/* Person header */}
            <div style={{ ...card, padding:20, marginBottom:14 }}>
              <div style={{ display:"flex", alignItems:"flex-start", gap:14, marginBottom:14 }}>
                {selected.photo ? (
                  <img src={selected.photo} alt={selected.name} style={{ width:56,height:56,borderRadius:"50%",objectFit:"cover",flexShrink:0 }} />
                ) : (
                  <div style={{ width:56,height:56,borderRadius:"50%",background:avatarColor(selected.name),display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,fontWeight:700,color:"#0d0e17",flexShrink:0 }}>
                    {initials(selected.name).toUpperCase()}
                  </div>
                )}
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:18,fontWeight:700,color:"#f0ede8",marginBottom:3 }}>{selected.name}</div>
                  <div style={{ fontSize:12,color:"#888",marginBottom:6 }}>
                    {selected.subtype}{selected.company?" · "+selected.company:""}
                    {selected.type !== selected.subtype ? " · "+selected.type : ""}
                  </div>
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                    {selected.tags.map(t=>(
                      <span key={t} style={{ fontSize:9,padding:"2px 8px",borderRadius:10,background:"rgba(74,179,244,0.15)",color:C.blue,border:"0.5px solid rgba(74,179,244,0.3)" }}>{t}</span>
                    ))}
                    {selected.birthday && <span style={{ fontSize:9,padding:"2px 8px",borderRadius:10,background:"rgba(255,107,157,0.15)",color:"#ff6b9d" }}>🎂 {selected.birthday}</span>}
                  </div>
                </div>

                {/* Capital Score */}
                <div style={{ textAlign:"center", flexShrink:0 }}>
                  <div style={{ fontSize:36,fontWeight:700,color:scoreLabel(selected.capitalScore).color,lineHeight:1 }}>
                    {editingScore===selected.id ? (
                      <input type="number" min={0} max={100} defaultValue={selected.capitalScore}
                        onBlur={e=>saveOverride(selected.id, e.target.value)}
                        onKeyDown={e=>e.key==="Enter"&&saveOverride(selected.id,e.target.value)}
                        style={{ width:70,fontSize:28,fontWeight:700,background:"transparent",border:"0.5px solid rgba(255,255,255,0.2)",borderRadius:6,color:scoreLabel(selected.capitalScore).color,textAlign:"center",outline:"none" }}
                        autoFocus />
                    ) : selected.capitalScore}
                  </div>
                  <div style={{ fontSize:11,color:scoreLabel(selected.capitalScore).color,fontWeight:600 }}>{scoreLabel(selected.capitalScore).label}</div>
                  <div style={{ fontSize:9,color:"#444",marginTop:3 }}>Capital Score</div>
                  <button onClick={()=>setEditingScore(editingScore===selected.id?null:selected.id)}
                    style={{ fontSize:9,color:"#555",background:"none",border:"none",cursor:"pointer",marginTop:4 }}>
                    {editingScore===selected.id?"✓ Done":"✏ Override"}
                  </button>
                </div>
              </div>

              {/* Score reason */}
              {selected.scoreReason && (
                <div style={{ fontSize:11,color:"#555",padding:"6px 10px",borderRadius:6,background:"rgba(255,255,255,0.02)",lineHeight:1.5 }}>
                  📊 Score factors: {selected.scoreReason}
                </div>
              )}

              {/* Key info */}
              <div style={{ display:"flex", gap:10, marginTop:12, flexWrap:"wrap" }}>
                {[[selected.email,"📧"],[selected.phone,"📱"],[selected.lastContact,"🕐"]].filter(([v])=>v).map(([val,icon])=>(
                  <span key={icon} style={{ fontSize:11,color:"#888" }}>{icon} {val}</span>
                ))}
              </div>
            </div>

            {/* Nurture Nudges */}
            <div style={{ ...card, padding:20, marginBottom:14 }}>
              <div style={{ fontSize:13,fontWeight:700,color:"#f0ede8",marginBottom:6 }}>🎯 AI Nurture Nudges</div>
              <div style={{ fontSize:11,color:"#555",marginBottom:14 }}>Generate a personalized outreach for {selected.name.split(" ")[0]} — the AI uses their profile, tags, birthday, and your relationship history.</div>

              <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:14 }}>
                {[
                  { type:"message",  icon:"💬", label:"Quick Message",    color:C.teal   },
                  { type:"birthday", icon:"🎂", label:"Birthday Note",    color:C.pink   },
                  { type:"reconnect",icon:"🔄", label:"Reconnect",        color:C.blue   },
                  { type:"referral", icon:"🤝", label:"Ask for Referral", color:C.orange },
                  { type:"voicenote",icon:"🎙", label:"Voice Note Script",color:C.purple },
                ].map(({ type, icon, label, color }) => (
                  <button key={type} onClick={() => generateNudge(selected, type)} disabled={nudgeLoading}
                    style={{ padding:"8px 14px", borderRadius:8, fontSize:11, fontWeight:600, cursor:nudgeLoading?"wait":"pointer",
                      background: nudgeType===type&&nudgeLoading ? `${color}30` : `${color}15`,
                      border:`0.5px solid ${color}44`, color,
                      boxShadow: nudgeType===type&&nudgeLoading ? `0 0 10px ${color}33` : "none" }}>
                    {nudgeLoading && nudgeType===type ? "⟳ Writing..." : `${icon} ${label}`}
                  </button>
                ))}
              </div>

              {nudgeResult && (
                <div style={{ padding:16,borderRadius:10,background:"rgba(74,179,244,0.06)",border:"0.5px solid rgba(74,179,244,0.2)" }}>
                  <div style={{ fontSize:10,color:C.blue,fontWeight:700,letterSpacing:".06em",marginBottom:10 }}>
                    ◈ AI NUDGE — {nudgeType==="message"?"QUICK MESSAGE":nudgeType==="birthday"?"BIRTHDAY NOTE":nudgeType==="reconnect"?"RECONNECT":nudgeType==="referral"?"REFERRAL ASK":"VOICE NOTE SCRIPT"}
                  </div>
                  <div style={{ fontSize:13,color:"#e2e8f0",lineHeight:1.8,whiteSpace:"pre-wrap" }}>{nudgeResult}</div>
                  <div style={{ display:"flex",gap:8,marginTop:12 }}>
                    <button onClick={()=>navigator.clipboard?.writeText(nudgeResult)}
                      style={{ fontSize:11,padding:"5px 14px",borderRadius:8,cursor:"pointer",background:"rgba(74,179,244,0.1)",border:"0.5px solid rgba(74,179,244,0.3)",color:C.blue,fontWeight:600 }}>
                      📋 Copy
                    </button>
                    <button onClick={()=>generateNudge(selected,nudgeType)} disabled={nudgeLoading}
                      style={{ fontSize:11,padding:"5px 14px",borderRadius:8,cursor:"pointer",background:"rgba(255,255,255,0.05)",border:"0.5px solid rgba(255,255,255,0.1)",color:"#888" }}>
                      ↻ Regenerate
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Relationship intel */}
            {selected.notes && (
              <div style={{ ...card, padding:16, marginBottom:14 }}>
                <div style={{ fontSize:11,fontWeight:700,color:"#6aaedd",marginBottom:8 }}>NOTES</div>
                <div style={{ fontSize:12,color:"#aaa",lineHeight:1.7 }}>{selected.notes}</div>
              </div>
            )}

            {selected.kpi && (
              <div style={{ ...card, padding:16, marginBottom:14 }}>
                <div style={{ fontSize:11,fontWeight:700,color:"#6aaedd",marginBottom:12 }}>RELATIONSHIP KPIs</div>
                {[["Connection",selected.kpi.connect,C.teal],["Support",selected.kpi.support,C.purple]].map(([label,val,color])=>(
                  <div key={label} style={{ marginBottom:10 }}>
                    <div style={{ display:"flex",justifyContent:"space-between",fontSize:11,color:"#888",marginBottom:4 }}>
                      <span>{label}</span><span style={{color,fontWeight:600}}>{val}/10</span>
                    </div>
                    <div style={{ height:4,background:"rgba(255,255,255,0.05)",borderRadius:2 }}>
                      <div style={{ height:"100%",width:`${(val||0)*10}%`,background:color,borderRadius:2 }} />
                    </div>
                  </div>
                ))}
                {selected.kpi.milestone && <div style={{ fontSize:11,color:C.teal,marginTop:6 }}>🎯 {selected.kpi.milestone}</div>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
