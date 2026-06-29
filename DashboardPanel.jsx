import { useState, useEffect, useRef } from "react";
import BrandIcon from "@/components/lifeos/icons/BrandIcon";
import { kvGet, kvSet } from "@/utils/storage";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/FirebaseAuthContext";
import { getApiKey, saveApiKey } from "@/api/ceogpsclient.jsx";
import { Button, Input, Empty, HEX, fmt, Donut, LineChart, Gauge } from "@/lib/ui";
import {
  Calendar,
  CheckSquare,
  Contact,
  FolderKanban,
  LineChart as LucideLineChart,
  Wallet,
  BarChart3 as LucideBarChart3,
  Share2,
  Music,
  Bot,
  Send,
  BookOpen,
} from 'lucide-react';

/**
 * @interface GridCardProps
 * @property {string} [title]
 * @property {import("react").ReactNode} [icon]
 * @property {import("react").ReactNode} [actions]
 * @property {import("react").ReactNode} [children]
 * @property {import("react").CSSProperties} [style]
 * @property {string} [gridColumn]
 */

/**
 * @interface WeatherState
 * @property {number} temp
 * @property {number} humidity
 * @property {string} icon
 */

/**
 * @interface WeekEvent
 * @property {number} id
 * @property {string} title
 * @property {string} time
 */

/**
 * @interface TaskItem
 * @property {number} id
 * @property {string} title
 * @property {boolean} done
 */

/**
 * @interface LinkItem
 * @property {string} label
 * @property {string} url
 * @property {string} brand
 */

/**
 * @interface LeadItem
 * @property {string} [name]
 * @property {string} [fullName]
 * @property {string} [email]
 * @property {string} [company]
 * @property {string} [status]
 * @property {string} [stage]
 */

/**
 * @interface ProductData
 * @property {string} name
 * @property {number} moRev
 * @property {number} ytdRev
 * @property {number} moSales
 * @property {number} ytdSales
 */

/**
 * @interface FinanceInstitution
 * @property {string} name
 * @property {number} checking
 * @property {number} savings
 */

/**
 * @interface BudgetItem
 * @property {number} id
 * @property {string} desc
 * @property {number} amount
 * @property {boolean} paid
 */

/**
 * @interface YouTubeResult
 * @property {string} id
 * @property {string} title
 * @property {string} thumb
 * @property {string} channel
 */

/**
 * @interface SupabaseRow
 * @property {string} key
 * @property {string} ts
 */

/**
 * @interface SupabaseTodo
 * @property {number} id
 * @property {string} title
 * @property {boolean} done
 * @property {string} [created_at]
 */

/**
 * @interface SocialStats
 * @property {number} [followers]
 * @property {number} [posts]
 * @property {number} [tweets]
 * @property {number} [subscribers]
 * @property {number} [views]
 */

/**
 * @interface SocialData
 * @property {{ instagram?: SocialStats }} [meta]
 * @property {SocialStats} [x]
 * @property {SocialStats} [yt]
 * @property {any} [li]
 */

/**
 * @interface PlaylistItem
 * @property {string} id
 * @property {string} name
 * @property {string} [color]
 * @property {string} [cover]
 * @property {Array<any>} [tracks]
 */

/**
 * @interface DashboardPanelProps
 * @property {(id: string) => void} [setActive]
 */

/**
 * @typedef {Record<string, string|number>} InputMap
 */

// ── Utility Functions ──
/**
 * @template T
 * @param {string} key
 * @param {T} fallback
 * @returns {T}
 */
function load(key, fallback) {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : fallback;
  } catch {
    return fallback;
  }
}

/**
 * @param {string} key
 * @param {unknown} value
 */
function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

/**
 * @param {number|string} n
 * @returns {string}
 */
function money(n) {
  const v = Number(n) || 0;
  return "$" + v.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

const WORKER = "https://lifeos1.ceogps.workers.dev";
const WEEK_KEY = "lifeos_dash_week_events";
/** @param {Date} d @returns {string} */
const dayKey = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;

const DEFAULT_ACCOUNTS = [
  { key: "stripe", label: "Stripe Banking", color: HEX.purple, balance: 0, prev: 0 },
];

/* ── GridCard - fixed with proper styles, no Tailwind classes ── */
/** @param {GridCardProps} props */
const GridCard = ({ title, icon, actions, children, style: styleProp, gridColumn }) => {
  const cardRef = useRef(null);
  const [localCoords, setLocalCoords] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const timeoutRef = useRef(null);

  /** @param {import("react").MouseEvent<HTMLDivElement>} e */
  const handleMouseMove = (e) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setLocalCoords({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
    setIsMoving(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setIsMoving(false);
    }, 1000);
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setIsMoving(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const showEffects = isHovered && isMoving;

  // Full vibrant effects per spec: strong red grid/glow on cursor hover, fade on stop
  const glowIntensity = showEffects ? 1 : 0;
  const spotlightIntensity = showEffects ? 0.9 : 0;
  const gridIntensity = showEffects ? 0.6 : 0;

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        gridColumn: gridColumn || "span 4",
        position: 'relative',
        borderRadius: '16px',
        cursor: 'pointer',
        transition: 'transform 0.3s ease-out, box-shadow 0.3s ease-out',
        transform: isHovered ? 'translateY(-6px) scale(1.015)' : 'none',
        boxShadow: isHovered ? '0 12px 40px rgba(0,0,0,0.5)' : 'none',
        padding: '1.5px', // bevel like p-[1.5px]
        border: '1px solid rgba(255,255,255,0.1)',
        ...styleProp,
      }}
    >
      {/* BEVEL / BORDER GLOW - full per spec */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          borderRadius: '16px',
          opacity: glowIntensity,
          background: `radial-gradient(180px circle at ${localCoords.x}px ${localCoords.y}px, rgba(220, 38, 38, 0.8), transparent 70%)`,
          transition: 'opacity 0.6s ease-out',
        }}
      />

      {/* INNER BACKDROP GLASSMORPHISM - full glass with glare/tints */}
      <div 
        className="liquid-glass"
        style={{ 
          position: 'relative',
          width: '100%',
          height: '100%',
          background: showEffects ? 'rgba(255, 0, 13, 0.15)' : 'rgba(29,29,30,0.55)',
          borderRadius: '15px',
          backdropFilter: 'blur(16px) saturate(200%)',
          WebkitBackdropFilter: 'blur(16px) saturate(200%)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          padding: '24px',
          overflow: 'hidden',
          transition: 'background 0.6s ease-out',
          minHeight: '260px',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* DEEP CRIMSON SPOTLIGHT - full */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            borderRadius: '15px',
            opacity: spotlightIntensity,
            background: `radial-gradient(350px circle at ${localCoords.x}px ${localCoords.y}px, rgba(153, 27, 27, 0.45), transparent 80%)`,
            transition: 'opacity 0.6s ease-out',
          }}
        />

        {/* TRANSPARENT RED DOT GRID - full 18px red dots, cursor boost, fades on stop */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            borderRadius: '15px',
            opacity: gridIntensity,
            background: `radial-gradient(180px circle at ${localCoords.x}px ${localCoords.y}px, rgba(255,0,13,0.5), transparent 55%), radial-gradient(circle, rgba(255, 0, 13, 0.5) 1px, transparent 0)`,
            backgroundSize: `auto, 18px 18px`,
            backgroundPosition: `0 0, ${localCoords.x % 18}px ${localCoords.y % 18}px`,
            transition: 'opacity 1s ease-out',
          }}
        />

        <div style={{ 
          position: 'relative', 
          zIndex: 10, 
          display: 'flex', 
          flexDirection: 'column', 
          height: '100%',
          flex: 1,
        }}>
          {(title || icon || actions) && (
            <div style={{ 
              display: "flex", 
              alignItems: "center", 
              gap: 8, 
              paddingBottom: 10, 
              borderBottom: "1px solid rgba(255,255,255,0.06)", 
              marginBottom: 12,
              flexShrink: 0,
            }}>
              {icon && <span style={{ fontSize: 14, lineHeight: 1, color: '#ff000d' }}>{icon}</span>}
              {title && (
                <span style={{ 
                  flex: 1, 
                  fontSize: 10, 
                  fontWeight: 800, 
                  letterSpacing: ".14em", 
                  textTransform: "uppercase", 
                  color: '#ff000d',
                  textShadow: isHovered ? '0 0 20px rgba(255,0,13,0.3)' : 'none',
                  transition: 'all 0.3s ease',
                }}>
                  {title}
                </span>
              )}
              {actions && <div style={{ display: "flex", gap: 6, alignItems: "center" }}>{actions}</div>}
            </div>
          )}
          <div style={{ 
            flex: 1, 
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
          }}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── Clock with weather ── */
function ClockWidget() {
  const [t, setT] = useState(new Date());
  const [weather, setWeather] = useState(/** @type {WeatherState} */ ({ temp: 82, humidity: 20, icon: "☀️" }));
  
  useEffect(() => {
    const id = setInterval(() => setT(new Date()), 1000);
    
    fetch('https://api.open-meteo.com/v1/forecast?latitude=33.75&longitude=-84.39&current_weather=true&hourly=relativehumidity_2m&forecast_days=1')
      .then(r => r.json())
      .then(d => {
        if (d.current_weather) {
          const temp = Math.round(d.current_weather.temperature);
          const hum = d.hourly ? d.hourly.relativehumidity_2m[0] : 20;
          const code = d.current_weather.weathercode;
          const icon = code < 3 ? "☀️" : code < 50 ? "🌤️" : code < 70 ? "☁️" : "🌧️";
          setWeather({ temp, humidity: hum, icon });
        }
      })
      .catch(() => {});
    
    return () => clearInterval(id);
  }, []);

  const days = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const hh = t.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  const [time, ap] = hh.split(" ");
  const date = t.getDate();
  const th = date % 10 === 1 && date !== 11 ? "ST" : date % 10 === 2 && date !== 12 ? "ND" : date % 10 === 3 && date !== 13 ? "RD" : "TH";

  return (
    <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", height: "100%", textAlign: "center", padding: "4px 0" }}>
      <div style={{ fontSize: 46, fontWeight: 800, letterSpacing: "-0.02em", color: "var(--t1)", lineHeight: 1 }}>
        {time}<span style={{ fontSize: 18, color: "var(--crimson)", marginLeft: 6, fontWeight: 700 }}>{ap}</span>
      </div>
      <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: ".12em", color: "var(--t2)", marginTop: 8 }}>{days[t.getDay()]}</div>
      <div style={{ fontSize: 13, color: "var(--t3)", marginTop: 2 }}>
        <span style={{ color: "var(--crimson)", fontWeight: 800 }}>{months[t.getMonth()]}</span> {date}<sup style={{ fontSize: 9 }}>{th}</sup>
      </div>
      <div style={{ fontSize: 13, color: "var(--t3)", marginTop: 2 }}>
        {weather.temp}° {weather.icon} {weather.humidity}%
      </div>
    </div>
  );
}

/* ── Editable weekly calendar ── */
function WeeklyCalendar() {
  const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - today.getDay());
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
  const [events, setEvents] = useState(/** @type {Record<string, WeekEvent[]>} */ (load(WEEK_KEY, {})));
  const [adding, setAdding] = useState(/** @type {string|null} */ (null));
  const [draft, setDraft] = useState(/** @type {{ title: string, time: string }} */ ({ title: "", time: "" }));

  function persist(next) {
    setEvents(next);
    save(WEEK_KEY, next);
  }

  function addEvent(k) {
    if (!draft.title.trim()) {
      setAdding(null);
      return;
    }
    const ev = { id: Date.now(), title: draft.title.trim(), time: draft.time };
    persist({ 
      ...events, 
      [k]: [...(events[k] || []), ev].sort((a, b) => (a.time || "").localeCompare(b.time || "")) 
    });
    setDraft({ title: "", time: "" });
    setAdding(null);
  }

  function removeEvent(k, id) {
    persist({ 
      ...events, 
      [k]: (events[k] || []).filter(e => e.id !== id) 
    });
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 5 }}>
      {week.map((d, i) => {
        const k = dayKey(d);
        const isToday = k === dayKey(today);
        const dayEvents = events[k] || [];
        return (
          <div key={k} style={{ 
            minHeight: 92, 
            borderRadius: 8, 
            padding: 5, 
            display: "flex", 
            flexDirection: "column", 
            gap: 3,
            background: isToday ? "rgba(200,16,46,0.1)" : "rgba(255,255,255,0.02)",
            border: `0.5px solid ${isToday ? "var(--crimson)" : "var(--b2)"}` 
          }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 8, color: "var(--t3)" }}>{DAYS[i]}</div>
              <div style={{ 
                fontSize: 12, 
                fontWeight: isToday ? 800 : 600, 
                color: isToday ? "var(--crimson)" : "var(--t2)" 
              }}>{d.getDate()}</div>
            </div>
            {dayEvents.map(ev => (
              <div key={ev.id} 
                onClick={() => removeEvent(k, ev.id)} 
                title="Click to remove"
                style={{ 
                  fontSize: 8, 
                  padding: "2px 4px", 
                  borderRadius: 4, 
                  background: "rgba(200,16,46,0.16)", 
                  color: "#ffb3bf", 
                  cursor: "pointer", 
                  lineHeight: 1.25, 
                  overflow: "hidden" 
                }}>
                {ev.time && <span style={{ opacity: .7 }}>{ev.time} </span>}{ev.title}
              </div>
            ))}
            {adding === k ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <input 
                  autoFocus 
                  value={draft.title} 
                  onChange={e => setDraft(s => ({ ...s, title: e.target.value }))}
                  onKeyDown={e => { 
                    if (e.key === "Enter") addEvent(k); 
                    if (e.key === "Escape") setAdding(null); 
                  }}
                  placeholder="Event" 
                  style={{ 
                    fontSize: 8, 
                    padding: "2px 4px", 
                    borderRadius: 4, 
                    border: "0.5px solid var(--crimson)", 
                    background: "var(--bg3)", 
                    color: "var(--t1)", 
                    outline: "none", 
                    width: "100%", 
                    boxSizing: "border-box" 
                  }} 
                />
                <input 
                  value={draft.time} 
                  onChange={e => setDraft(s => ({ ...s, time: e.target.value }))} 
                  type="time"
                  onKeyDown={e => { if (e.key === "Enter") addEvent(k); }}
                  style={{ 
                    fontSize: 8, 
                    padding: "1px 3px", 
                    borderRadius: 4, 
                    border: "0.5px solid var(--b1)", 
                    background: "var(--bg3)", 
                    color: "var(--t1)", 
                    outline: "none", 
                    width: "100%", 
                    boxSizing: "border-box" 
                  }} 
                />
              </div>
            ) : (
              <button 
                onClick={() => { setAdding(k); setDraft({ title: "", time: "" }); }}
                style={{ 
                  marginTop: "auto", 
                  fontSize: 11, 
                  color: "var(--t3)", 
                  background: "none", 
                  border: "none", 
                  cursor: "pointer", 
                  lineHeight: 1 
                }}>+</button>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── YouTube player ── */
function YouTubePlayer() {
  const [storedKey, setStoredKey] = useState(/** @type {string} */ (""));
  const [input, setInput] = useState(/** @type {string} */ (""));
  const [results, setResults] = useState(/** @type {YouTubeResult[]} */ ([]));
  const [videoId, setVideoId] = useState(/** @type {string|null} */ (null));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getApiKey("youtube_api_key").then(k => {
      if (cancelled) return;
      const key = (k || load("lifeos_youtube_api_key", "") || (typeof import.meta !== "undefined" && import.meta.env?.VITE_YOUTUBE_API_KEY) || "").trim();
      setStoredKey(key);
      if (key) {
        search("productivity CEO", key);
      } else {
        fetch(`${WORKER}/api/youtube/videos?max=8`)
          .then(r => r.json())
          .catch(() => null)
          .then(d => {
            if (cancelled || !d?.items?.length) return;
            const items = d.items.map(v => ({ 
              id: v.id, 
              title: v.title, 
              thumb: v.thumbnail, 
              channel: "" 
            }));
            setResults(items);
            setVideoId(items[0].id);
          });
      }
    });
    return () => { cancelled = true; };
  }, []);

  async function search(q, overrideKey) {
    const useKey = overrideKey || storedKey;
    if (!useKey || !q.trim()) return;
    setLoading(true);
    try {
      const r = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(q)}&type=video&maxResults=6&key=${useKey}`);
      const d = await r.json();
      const items = (d.items || []).map(v => ({ 
        id: v.id.videoId, 
        title: v.snippet.title, 
        thumb: v.snippet.thumbnails?.medium?.url, 
        channel: v.snippet.channelTitle 
      }));
      setResults(items);
      if (items.length) setVideoId(items[0].id);
    } catch (e) {
      console.error("YouTube search error:", e);
    }
    setLoading(false);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, height: "100%" }}>
      {storedKey && (
        <div style={{ display: "flex", gap: 6 }}>
          <Input 
            value={input} 
            onChange={e => setInput(e.target.value)} 
            onKeyDown={e => { if (e.key === "Enter" && input.trim()) search(input.trim()); }} 
            placeholder="Search YouTube…" 
            style={{ fontSize: 11, padding: "6px 10px" }} 
          />
          <Button onClick={() => input.trim() && search(input.trim())} style={{ padding: "6px 12px" }}>GO</Button>
        </div>
      )}
      {videoId ? (
        <iframe 
          src={`https://www.youtube.com/embed/${videoId}`} 
          width="100%" 
          height={200} 
          frameBorder={0}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture" 
          allowFullScreen
          style={{ borderRadius: 8, background: "#000" }} 
          title="YouTube" 
        />
      ) : (
        <Empty icon="▶️" text={loading ? "Loading…" : "No video"} sub={storedKey ? "Search above" : "Connect YouTube in Social → Accounts"} />
      )}
      {results.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, overflowY: "auto", maxHeight: 120 }}>
          {results.map(v => (
            <button 
              key={v.id} 
              onClick={() => setVideoId(v.id)}
              style={{ 
                display: "flex", 
                gap: 8, 
                alignItems: "center", 
                textAlign: "left", 
                cursor: "pointer", 
                borderRadius: 7, 
                padding: "4px 6px",
                background: videoId === v.id ? "rgba(200,16,46,0.12)" : "transparent",
                border: `0.5px solid ${videoId === v.id ? "var(--crimson)" : "transparent"}` 
              }}>
              <img src={v.thumb} alt="" style={{ width: 46, height: 30, objectFit: "cover", borderRadius: 4, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ 
                  fontSize: 10, 
                  color: "var(--t1)", 
                  fontWeight: 600, 
                  overflow: "hidden", 
                  textOverflow: "ellipsis", 
                  whiteSpace: "nowrap" 
                }}>{v.title}</div>
                {v.channel && <div style={{ fontSize: 9, color: "var(--t3)" }}>{v.channel}</div>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** @param {DashboardPanelProps} props */
export default function DashboardPanel({ setActive }) {
  const [notes, setNotes] = useState(() => load("lifeos_dash_notes", ""));
  const [previousNotes, setPreviousNotes] = useState(/** @type {string[]} */ (load("lifeos_dash_previous_notes", [])));
  const [products, setProducts] = useState(() => load("lifeos_dash_products", [
    { name: "Online Course", moRev: 12450, ytdRev: 87200, moSales: 42, ytdSales: 298 },
    { name: "1:1 Coaching", moRev: 9800, ytdRev: 65100, moSales: 11, ytdSales: 72 },
    { name: "Ebook Bundle", moRev: 3150, ytdRev: 21850, moSales: 185, ytdSales: 1240 },
  ]));
  const [editProducts, setEditProducts] = useState(false);
  const [productInputs, setProductInputs] = useState(/** @type {InputMap} */ ({}));
  
  // Budget tracker states
  const [budgetDesc, setBudgetDesc] = useState("");
  const [budgetAmount, setBudgetAmount] = useState("");
  const [budgetItems, setBudgetItems] = useState(/** @type {BudgetItem[]} */ (load("lifeos_dash_budget", [])));

  const [financeInstitutions, setFinanceInstitutions] = useState(/** @type {FinanceInstitution[]} */ (load("lifeos_dash_finance_institutions", [
    { name: "Sofi", checking: 8500, savings: 42000 },
    { name: "Stripe", checking: 2450, savings: 0 },
    { name: "Square", checking: 1120, savings: 0 },
    { name: "CashApp", checking: 680, savings: 320 },
    { name: "Venmo", checking: 290, savings: 0 },
    { name: "Paypal", checking: 1540, savings: 0 },
    { name: "OnePay", checking: 750, savings: 9800 },
  ])));
  const [editFinance, setEditFinance] = useState(false);
  const [financeInputs, setFinanceInputs] = useState(/** @type {InputMap} */ ({}));
  const [editCredit, setEditCredit] = useState(false);
  const [credInput, setCredInput] = useState(/** @type {InputMap} */ ({}));

  const [tasks, setTasks] = useState(/** @type {TaskItem[]} */ ([]));
  const [links, setLinks] = useState(/** @type {LinkItem[]} */ (load("lifeos_dash_links", [])));
  const [newLinkLabel, setNewLinkLabel] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [newTaskInput, setNewTaskInput] = useState("");
  const [leads, setLeads] = useState(/** @type {LeadItem[]} */ ([]));

  const [social, setSocial] = useState(/** @type {SocialData|null} */ (null));
  const [activity, setActivity] = useState(/** @type {Array<any>} */ ([]));
  const [aiTips, setAiTips] = useState(/** @type {string[]} */ ([]));
  const [aiLoading, setAiLoading] = useState(false);
  const [playlists] = useState(/** @type {PlaylistItem[]} */ (load("lifeos_music_playlists", [])));
  const [supabaseData, setSupabaseData] = useState(/** @type {SupabaseRow[]} */ ([]));
  const [sbStatus, setSbStatus] = useState(/** @type {"checking"|"connected"|"empty"|"no-op"} */ ("checking"));
  const [supabaseTodos, setSupabaseTodos] = useState(/** @type {SupabaseTodo[]} */ ([]));
  const [newSupabaseTodo, setNewSupabaseTodo] = useState("");
  const [bannerPic, setBannerPic] = useState(/** @type {string|null} */ (null));
  const bannerRef = useRef(/** @type {HTMLInputElement|null} */ (null));
  const [newTask, setNewTask] = useState("");

  // daily refresh life hacks
  const getDailyHacks = () => {
    const d = new Date().toDateString();
    const seed = d.split('').reduce((a,c)=>a + c.charCodeAt(0), 0);
    const base = [
      "Drink water first thing in the morning.",
      "Use the 80/20 rule for productivity.",
      "Batch similar tasks together.",
      "Walk 10k steps for mental clarity.",
      "Single task to beat procrastination.",
      "Review goals every Sunday.",
      "Limit decisions to preserve willpower.",
      "Gratitude list before bed."
    ];
    // simple shuffle with seed
    const shuffled = [...base].sort(() => (seed % 7 - 3) * 0.1);
    return shuffled.slice(0, 3);
  };
  const [lifeHacks, setLifeHacks] = useState(() => {
    const saved = load("lifeos_dash_hacks", null);
    const today = new Date().toDateString();
    if (saved && saved.date === today) return saved.hacks;
    const hacks = getDailyHacks();
    save("lifeos_dash_hacks", {date: today, hacks});
    return hacks;
  });

  const { user: fbUser } = useAuth();

  const go = id => setActive && setActive(id);

  // ── Budget Handlers ──
  function addBudget(desc, amount) {
    if (!desc.trim() || !amount) return;
    const next = [...budgetItems, { 
      id: Date.now(), 
      desc: desc.trim(), 
      amount: Number(amount) || 0, 
      paid: false 
    }];
    setBudgetItems(next);
    save("lifeos_dash_budget", next);
  }

  function toggleBudgetPaid(id) {
    const next = budgetItems.map(item => 
      item.id === id ? { ...item, paid: !item.paid } : item
    );
    setBudgetItems(next);
    save("lifeos_dash_budget", next);
  }

  function deleteBudget(id) {
    const next = budgetItems.filter(item => item.id !== id);
    setBudgetItems(next);
    save("lifeos_dash_budget", next);
  }

  // ── Life Hacks Handlers ──
  function addHack(text) {
    if (!text.trim()) return;
    const next = [...lifeHacks, text.trim()];
    setLifeHacks(next);
    save("lifeos_dash_hacks", next);
  }

  // ── Load data on mount ──
  useEffect(() => {
    kvGet("tasks_queue").then(d => {
      const list = Array.isArray(d) ? d.filter(t => !t.done).slice(0, 5) : [];
      setTasks(list);
    });
    
    kvGet("crm_contacts").then(list => {
      const all = Array.isArray(list) ? list : load("lifeos_crm", []);
      const isLead = c => /lead|new|prospect|qualif/i.test(`${c.status || ""} ${c.stage || ""}`);
      const leadList = all.filter(isLead);
      setLeads((leadList.length ? leadList : all).slice(0, 5));
    });

    Promise.all([
      fetch(`${WORKER}/api/meta/status`).then(r => r.json()).catch(() => null),
      fetch(`${WORKER}/api/x/user?handle=ceogps`).then(r => r.json()).catch(() => null),
      fetch(`${WORKER}/api/youtube/channel`).then(r => r.json()).catch(() => null),
      fetch(`${WORKER}/api/linkedin/status`).then(r => r.json()).catch(() => null),
    ]).then(([meta, x, yt, li]) => setSocial({ meta, x, yt, li }));

    kvGet("activity_events").then(d => setActivity(Array.isArray(d) ? d.slice(0, 5) : []));

    // Supabase
    (async () => {
      let rows = [];
      const email = fbUser?.email || 'demo@lifeos1.com';
      try {
        const { data: ud, error: udErr } = await supabase
          .from('user_data')
          .select('data_key, updated_at')
          .eq('user_email', email)
          .order('updated_at', { ascending: false })
          .limit(5);
        if (!udErr && Array.isArray(ud) && ud.length) {
          rows = ud.map(r => ({ key: r.data_key, ts: r.updated_at }));
        }
        try {
          const { data: td } = await supabase.from('todos').select('id,title,done,created_at').limit(4);
          if (Array.isArray(td) && td.length) {
            rows = rows.concat(td.map(t => ({ key: `todo:${t.title || t.id}`, ts: t.created_at })));
          }
        } catch {}
        setSupabaseData(rows.slice(0, 6));
        setSbStatus(rows.length ? 'connected' : 'empty');
        const { data: td } = await supabase.from('todos').select('*').eq('user_email', email).order('created_at', { ascending: false });
        setSupabaseTodos(td || []);
      } catch (e) {
        setSbStatus('no-op');
      }
    })();

    // robust load with local fallback for persistence across page changes
    const loadBanner = async () => {
      try {
        const v = await getApiKey("banner_pic");
        if (v) {
          setBannerPic(v);
          localStorage.setItem("lifeos_banner_pic", v);
        } else {
          const local = localStorage.getItem("lifeos_banner_pic");
          if (local) setBannerPic(local);
        }
      } catch {
        const local = localStorage.getItem("lifeos_banner_pic");
        if (local) setBannerPic(local);
      }
    };
    loadBanner();
  }, [fbUser]);

  // ── AI Tips ──
  useEffect(() => {
    if (!social || aiTips.length) return;
    setAiLoading(true);
    const ctx = [
      social?.x?.followers ? `X: ${social.x.followers} followers` : null,
      social?.meta?.instagram?.followers ? `Instagram: ${social.meta.instagram.followers}` : null,
      social?.yt?.subscribers ? `YouTube: ${social.yt.subscribers} subs` : null,
    ].filter(Boolean).join(", ") || "entrepreneur growing their business";
    
    fetch(`${WORKER}/api/llm/invoke`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        prompt: `Business context: ${ctx}. Give exactly 4 short, specific money-making/growth ideas for a CEO. Respond ONLY with a JSON array of 4 strings.`, 
        max_tokens: 400 
      }),
    })
    .then(r => r.json())
    .then(d => {
      const raw = d?.text || d?.content?.[0]?.text || "";
      try {
        const m = raw.match(/\[[\s\S]*?\]/);
        if (m) {
          const arr = JSON.parse(m[0]);
          if (Array.isArray(arr) && arr.length) setAiTips(arr);
        }
      } catch {}
    })
    .catch(() => {})
    .finally(() => setAiLoading(false));
  }, [social, aiTips.length]);

  // ── Product Handlers ──
  function saveProducts() {
    if (editProducts) {
      const next = products.map((p, idx) => ({
        name: productInputs[`${idx}-name`] ?? p.name,
        moRev: Number(productInputs[`${idx}-moRev`] ?? p.moRev) || 0,
        ytdRev: Number(productInputs[`${idx}-ytdRev`] ?? p.ytdRev) || 0,
        moSales: Number(productInputs[`${idx}-moSales`] ?? p.moSales) || 0,
        ytdSales: Number(productInputs[`${idx}-ytdSales`] ?? p.ytdSales) || 0,
      }));
      setProducts(next);
      save("lifeos_dash_products", next);
      setProductInputs({});
    } else {
      const seed = {};
      products.forEach((p, idx) => {
        seed[`${idx}-name`] = p.name;
        seed[`${idx}-moRev`] = p.moRev;
        seed[`${idx}-ytdRev`] = p.ytdRev;
        seed[`${idx}-moSales`] = p.moSales;
        seed[`${idx}-ytdSales`] = p.ytdSales;
      });
      setProductInputs(seed);
    }
    setEditProducts(e => !e);
  }

  // ── Finance Handlers ──
  function saveFinanceInstitutions() {
    if (editFinance) {
      const next = financeInstitutions.map((inst, idx) => ({
        name: financeInputs[`${idx}-name`] ?? inst.name,
        checking: Number(financeInputs[`${idx}-checking`] ?? inst.checking) || 0,
        savings: Number(financeInputs[`${idx}-savings`] ?? inst.savings) || 0,
      }));
      setFinanceInstitutions(next);
      save("lifeos_dash_finance_institutions", next);
      setFinanceInputs({});
    } else {
      const seed = {};
      financeInstitutions.forEach((inst, idx) => {
        seed[`${idx}-name`] = inst.name;
        seed[`${idx}-checking`] = inst.checking;
        seed[`${idx}-savings`] = inst.savings;
      });
      setFinanceInputs(seed);
    }
    setEditFinance(e => !e);
  }

  // ── Task Handlers ──
  async function addTask() {
    if (!newTaskInput.trim()) return;
    const current = await kvGet("tasks_queue") || [];
    const newT = { id: Date.now(), title: newTaskInput.trim(), done: false };
    const updated = [...current, newT];
    await kvSet("tasks_queue", updated);
    setTasks(updated.filter(t => !t.done).slice(0, 5));
    setNewTaskInput("");
  }

  async function deleteTask(id) {
    const current = await kvGet("tasks_queue") || [];
    const updated = current.filter(t => t.id !== id);
    await kvSet("tasks_queue", updated);
    setTasks(updated.filter(t => !t.done).slice(0, 5));
  }

  // ── Link Handlers ──
  function addLink() {
    if (!newLinkLabel.trim() || !newLinkUrl.trim()) return;
    const u = [...links, { label: newLinkLabel.trim(), url: newLinkUrl.trim(), brand: "link" }];
    setLinks(u);
    save("lifeos_dash_links", u);
    setNewLinkLabel("");
    setNewLinkUrl("");
  }

  function deleteLink(idx) {
    const u = links.filter((_, i) => i !== idx);
    setLinks(u);
    save("lifeos_dash_links", u);
  }

  // ── Note Handlers ──
  function saveNote() {
    if (!notes.trim()) return;
    setPreviousNotes(prev => {
      const next = [notes.trim(), ...prev];
      save("lifeos_dash_previous_notes", next);
      return next;
    });
    setNotes("");
    save("lifeos_dash_notes", "");
  }

  function discardNote() {
    setNotes("");
    save("lifeos_dash_notes", "");
  }

  function removePrevious(idx) {
    setPreviousNotes(prev => {
      const next = prev.filter((_, i) => i !== idx);
      save("lifeos_dash_previous_notes", next);
      return next;
    });
  }

  // ── Supabase Todo Handlers ──
  async function addSupabaseTodo() {
    if (!newSupabaseTodo.trim()) return;
    const email = fbUser?.email || 'demo@lifeos1.com';
    const { data, error } = await supabase.from('todos').insert({
      user_email: email,
      title: newSupabaseTodo.trim(),
      done: false,
      created_at: new Date().toISOString()
    }).select().single();
    if (!error && data) {
      setSupabaseTodos([data, ...supabaseTodos]);
    }
    setNewSupabaseTodo("");
  }

  async function toggleSupabaseTodo(id) {
    const todo = supabaseTodos.find(t => t.id === id);
    if (!todo) return;
    const { error } = await supabase.from('todos').update({ done: !todo.done }).eq('id', id);
    if (!error) {
      setSupabaseTodos(supabaseTodos.map(t => t.id === id ? { ...t, done: !t.done } : t));
    }
  }

  async function deleteSupabaseTodo(id) {
    const { error } = await supabase.from('todos').delete().eq('id', id);
    if (!error) {
      setSupabaseTodos(supabaseTodos.filter(t => t.id !== id));
    }
  }

  // ── Banner Handler ──
  async function handleBannerUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result;
      setBannerPic(dataUrl);
      const safe = dataUrl.length > 51200 ? dataUrl.substring(0, 51200) : dataUrl;
      const uid = fbUser?.uid || fbUser?.id;
      localStorage.setItem("lifeos_banner_pic", dataUrl);
      await saveApiKey("banner_pic", safe, uid);
      await saveApiKey("profile_pic", safe, uid);
      window.dispatchEvent(new CustomEvent('profilePicUpdated', { detail: dataUrl }));
    };
    reader.readAsDataURL(file);
  }

  const grid = { 
    display: "grid", 
    gridTemplateColumns: "repeat(12, 1fr)", 
    gap: 16, 
    alignItems: "stretch", 
    gridAutoRows: "minmax(260px, auto)",
    maxWidth: 1392, 
    margin: "0 auto", 
    paddingBottom: 24 
  };

  return (
    <div style={{ minHeight: '100%', background: 'transparent', padding: '20px 28px' }}>
      {/* Banner */}
      {bannerPic && (
        <img 
          src={bannerPic} 
          alt="Banner" 
          style={{ 
            width: "calc(100% + 56px)", 
            marginLeft: "-28px", 
            height: "110px", 
            objectFit: "cover", 
            borderRadius: 0, 
            marginBottom: "10px" 
          }} 
        />
      )}
      <button 
        onClick={() => bannerRef.current?.click()} 
        style={{ 
          fontSize: 9, 
          padding: "2px 6px", 
          background: "transparent", 
          border: "0.5px solid var(--b2)", 
          color: "var(--t3)", 
          borderRadius: 3, 
          cursor: "pointer", 
          marginBottom: 12 
        }}>
        Upload Banner
      </button>
      <input ref={bannerRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleBannerUpload} />

      <div style={grid}>
        {/* ── TOP STRIP: TASKS / LINKS / LEADS ── */}
        <GridCard title="TASKS" icon={<CheckSquare size={14} />} gridColumn="span 4">
          <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: "var(--t2)" }}>
            {tasks.map(t => (
              <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "2px 0" }}>
                <span>{t.title}</span>
                <button 
                  onClick={() => deleteTask(t.id)} 
                  style={{ background: "none", border: "none", color: "var(--t3)", cursor: "pointer", fontSize: 10, padding: "0 4px" }}
                >×</button>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
            <Input 
              value={newTaskInput} 
              onChange={e => setNewTaskInput(e.target.value)} 
              onKeyDown={e => e.key === "Enter" && addTask()} 
              placeholder="Add task" 
              style={{ fontSize: 9, padding: "4px 6px" }} 
            />
            <Button onClick={addTask} style={{ padding: "4px 8px", fontSize: 9 }}>+</Button>
          </div>
        </GridCard>

        <GridCard title="LINKS" icon={<FolderKanban size={14} />} gridColumn="span 4">
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {links.map((l, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--t2)" }}>
                <a 
                  href={l.url} 
                  target="_blank" 
                  rel="noreferrer" 
                  style={{ flex: 1, color: "var(--t1)", textDecoration: "none", padding: "2px 0" }} 
                  onClick={e => e.stopPropagation()}
                >{l.label}</a>
                <button 
                  onClick={() => deleteLink(i)} 
                  style={{ background: "none", border: "none", color: "var(--t3)", cursor: "pointer", fontSize: 10, padding: "0 4px" }}
                >×</button>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
            <Input 
              value={newLinkLabel} 
              onChange={e => setNewLinkLabel(e.target.value)} 
              placeholder="Label" 
              style={{ fontSize: 9, padding: "4px 6px", flex: 1 }} 
            />
            <Input 
              value={newLinkUrl} 
              onChange={e => setNewLinkUrl(e.target.value)} 
              placeholder="URL" 
              style={{ fontSize: 9, padding: "4px 6px", flex: 1 }} 
            />
            <Button onClick={addLink} style={{ padding: "4px 8px", fontSize: 9 }}>+</Button>
          </div>
        </GridCard>

        <GridCard title="LEADS" icon={<Contact size={14} />} gridColumn="span 4">
          <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: "var(--t2)" }}>
            {leads.length ? leads.slice(0, 4).map((l, i) => (
              <div key={i} style={{ padding: "2px 0" }}>{l.name || l.fullName || l.email || "Lead"}{l.company ? ` @ ${l.company}` : ""}</div>
            )) : <div style={{ padding: "2px 0" }}>No leads yet (from Leads Panel after profile/business info)</div>}
          </div>
        </GridCard>

        {/* ── ROW 2: Clock / This Week / Notes ── */}
        <GridCard title="Time & Weather" icon={<Calendar size={14} />} gridColumn="span 3">
          <ClockWidget />
        </GridCard>

        <GridCard 
          title="This Week" 
          icon={<Calendar size={14} />} 
          gridColumn="span 5"
          actions={
            <>
              <Button variant="ghost" style={{ padding: "2px 8px", fontSize: 9 }} onClick={() => go("calendar")}>Calendar</Button>
              <Button variant="ghost" style={{ padding: "2px 8px", fontSize: 9 }} onClick={() => go("crm")}>CRM</Button>
            </>
          }>
          <WeeklyCalendar />
        </GridCard>

        <GridCard title="NOTES" icon={<BookOpen size={14} />} gridColumn="span 4">
          <div style={{ display: "flex", height: "100%", gap: 8, padding: 4 }}>
            {/* Left: input box */}
            <div style={{ flex: 3, display: "flex", flexDirection: "column" }}>
              <textarea
                value={notes}
                onChange={e => { 
                  const v = e.target.value; 
                  setNotes(v); 
                  save("lifeos_dash_notes", v); 
                }}
                placeholder="Type or generate notes here…"
                style={{
                  flex: 1,
                  background: "rgba(255,255,255,0.05)",
                  border: "0.5px solid rgba(255,255,255,0.08)",
                  borderRadius: 6,
                  padding: 12,
                  color: "var(--t1)",
                  fontSize: 12,
                  resize: "none",
                  fontFamily: "inherit",
                  lineHeight: 1.4,
                  minHeight: 110
                }}
              />
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                <Button variant="ghost" style={{ padding: "2px 8px", fontSize: 9 }} onClick={saveNote}>Save</Button>
              </div>
            </div>

            {/* Right: saved notes list */}
            <div style={{ 
              flex: 1, 
              minWidth: 70, 
              display: "flex", 
              flexDirection: "column", 
              gap: 2, 
              fontSize: 9, 
              color: "var(--t2)", 
              overflowY: "auto",
              maxHeight: 120
            }}>
              <div style={{ fontSize: 9, fontWeight: 600, marginBottom: 2, color: "var(--t1)" }}>Saved notes</div>
              {previousNotes.length === 0 ? (
                <div style={{ color: "var(--t3)" }}>No saved notes yet</div>
              ) : (
                previousNotes.map((note, idx) => (
                  <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 4, padding: "1px 0" }}>
                    <span style={{ flex: 1, wordBreak: "break-word" }}>{note}</span>
                    <button 
                      onClick={() => removePrevious(idx)} 
                      style={{ background: "none", border: "none", color: "var(--t3)", cursor: "pointer", fontSize: 10, lineHeight: 1, flexShrink: 0, padding: "0 2px" }} 
                      title="Delete"
                    >×</button>
                  </div>
                ))
              )}
            </div>
          </div>
        </GridCard>

        {/* ── ROW 3: Product Revenue / Financial Balances / Credit ── */}
        <GridCard 
          title="Product Revenue" 
          icon={<LucideLineChart size={14} />} 
          gridColumn="span 4"
          actions={
            <Button variant={editProducts ? "primary" : "ghost"} style={{ padding: "2px 10px", fontSize: 9 }} onClick={saveProducts}>
              {editProducts ? "SAVE" : "EDIT"}
            </Button>
          }>
          <div style={{ fontSize: 8, color: "var(--t3)", marginBottom: 4 }}>
            Sources: KPI Revenue & Revenue breakdown
          </div>

          <div style={{ 
            fontSize: 9, 
            color: "var(--t3)", 
            marginBottom: 3, 
            display: "grid", 
            gridTemplateColumns: "1.05fr 0.85fr 0.85fr 0.65fr 0.65fr", 
            gap: 2, 
            alignItems: "center" 
          }}>
            <div style={{ fontWeight: 700 }}>Product</div>
            <div style={{ textAlign: "right" }}>Mo Rev</div>
            <div style={{ textAlign: "right" }}>YTD Rev</div>
            <div style={{ textAlign: "right" }}>Mo #</div>
            <div style={{ textAlign: "right" }}>YTD #</div>
          </div>
          {products.map((p, i) => (
            <div key={i} style={{ 
              display: "grid", 
              gridTemplateColumns: "1.05fr 0.85fr 0.85fr 0.65fr 0.65fr", 
              gap: 2, 
              alignItems: "center", 
              fontSize: 9.5, 
              padding: "2px 0", 
              borderBottom: "0.5px solid rgba(255,255,255,0.05)" 
            }}>
              <div style={{ fontWeight: 600, color: "var(--t1)" }}>
                {editProducts ? (
                  <input 
                    value={productInputs[`${i}-name`] ?? p.name} 
                    onChange={e => setProductInputs(pi => ({ ...pi, [`${i}-name`]: e.target.value }))} 
                    style={{ 
                      background: "rgba(255,255,255,0.05)", 
                      border: "0.5px solid rgba(255,255,255,0.08)", 
                      borderRadius: 3, 
                      padding: "1px 4px", 
                      color: "var(--t1)", 
                      fontSize: 9, 
                      width: "100%" 
                    }} 
                  />
                ) : p.name}
              </div>
              {["moRev", "ytdRev", "moSales", "ytdSales"].map(field => {
                const val = editProducts ? (productInputs[`${i}-${field}`] ?? p[field]) : p[field];
                const isRev = field.includes("Rev");
                return (
                  <div key={field} style={{ textAlign: "right", color: isRev ? HEX.green : "var(--t1)", fontWeight: isRev ? 600 : 400 }}>
                    {editProducts ? (
                      <input 
                        type="number" 
                        value={val} 
                        onChange={e => setProductInputs(pi => ({ ...pi, [`${i}-${field}`]: e.target.value }))} 
                        style={{ 
                          background: "rgba(255,255,255,0.05)", 
                          border: "0.5px solid rgba(255,255,255,0.08)", 
                          borderRadius: 3, 
                          padding: "1px 4px", 
                          color: "var(--t1)", 
                          fontSize: 9, 
                          width: "100%", 
                          textAlign: "right" 
                        }} 
                      />
                    ) : (isRev ? money(val) : val)}
                  </div>
                );
              })}
            </div>
          ))}

          {editProducts && (
            <button 
              onClick={() => {
                const newProd = { name: "New Product", moRev: 0, ytdRev: 0, moSales: 0, ytdSales: 0 };
                const next = [...products, newProd];
                const newIdx = next.length - 1;
                setProducts(next);
                setProductInputs(pi => ({
                  ...pi,
                  [`${newIdx}-name`]: "New Product",
                  [`${newIdx}-moRev`]: 0,
                  [`${newIdx}-ytdRev`]: 0,
                  [`${newIdx}-moSales`]: 0,
                  [`${newIdx}-ytdSales`]: 0
                }));
              }} 
              style={{ 
                fontSize: 8, 
                color: "var(--t3)", 
                background: "none", 
                border: "0.5px solid rgba(255,255,255,0.08)", 
                borderRadius: 3, 
                padding: "1px 6px", 
                marginTop: 3, 
                cursor: "pointer" 
              }}>+ Add Product</button>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 6, flex: 1 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 8, color: "var(--t3)", marginBottom: 2 }}>Sales by Product (YTD)</div>
              <Donut 
                data={products.map((p, i) => ({ 
                  name: p.name, 
                  v: p.ytdRev, 
                  fill: [HEX.purple, HEX.teal, HEX.green, HEX.orange, HEX.pink][i] 
                }))} 
                height={78} 
              />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 8, color: "var(--t3)", marginBottom: 2 }}>Monthly Revenue</div>
              <LineChart data={[18200, 21500, 19800, 26400, 30100, 34500, 39200, 45100]} color={HEX.green} height={64} />
            </div>
          </div>
        </GridCard>

        <GridCard 
          title="Financial Balances" 
          icon={<Wallet size={14} />} 
          gridColumn="span 4"
          actions={
            <Button variant={editFinance ? "primary" : "ghost"} style={{ padding: "2px 10px", fontSize: 9 }} onClick={saveFinanceInstitutions}>
              {editFinance ? "SAVE" : "EDIT"}
            </Button>
          }>
          <div style={{ 
            fontSize: 9, 
            color: "var(--t3)", 
            marginBottom: 4, 
            display: "grid", 
            gridTemplateColumns: "1.1fr 0.9fr 0.9fr", 
            gap: 4, 
            alignItems: "center" 
          }}>
            <div style={{ fontWeight: 700 }}>Institution</div>
            <div style={{ textAlign: "right" }}>Checking</div>
            <div style={{ textAlign: "right" }}>Savings</div>
          </div>
          {financeInstitutions.map((inst, i) => (
            <div key={i} style={{ 
              display: "grid", 
              gridTemplateColumns: "1.1fr 0.9fr 0.9fr", 
              gap: 4, 
              alignItems: "center", 
              fontSize: 10, 
              padding: "2px 0", 
              borderBottom: "0.5px solid rgba(255,255,255,0.05)" 
            }}>
              <div style={{ fontWeight: 600, color: "var(--t1)" }}>
                {editFinance ? (
                  <input 
                    value={financeInputs[`${i}-name`] ?? inst.name} 
                    onChange={e => setFinanceInputs(fi => ({ ...fi, [`${i}-name`]: e.target.value }))} 
                    style={{ 
                      background: "rgba(255,255,255,0.05)", 
                      border: "0.5px solid rgba(255,255,255,0.08)", 
                      borderRadius: 3, 
                      padding: "1px 4px", 
                      color: "var(--t1)", 
                      fontSize: 9, 
                      width: "100%" 
                    }} 
                  />
                ) : inst.name}
              </div>
              <div style={{ textAlign: "right", color: '#86efac', fontWeight: 600 }}>
                {editFinance ? (
                  <input 
                    type="number" 
                    value={financeInputs[`${i}-checking`] ?? inst.checking} 
                    onChange={e => setFinanceInputs(fi => ({ ...fi, [`${i}-checking`]: e.target.value }))} 
                    style={{ 
                      background: "rgba(255,255,255,0.05)", 
                      border: "0.5px solid rgba(255,255,255,0.08)", 
                      borderRadius: 3, 
                      padding: "1px 4px", 
                      color: "var(--t1)", 
                      fontSize: 9, 
                      width: "100%", 
                      textAlign: "right" 
                    }} 
                  />
                ) : money(inst.checking)}
              </div>
              <div style={{ textAlign: "right", color: '#86efac', fontWeight: 600 }}>
                {editFinance ? (
                  <input 
                    type="number" 
                    value={financeInputs[`${i}-savings`] ?? inst.savings} 
                    onChange={e => setFinanceInputs(fi => ({ ...fi, [`${i}-savings`]: e.target.value }))} 
                    style={{ 
                      background: "rgba(255,255,255,0.05)", 
                      border: "0.5px solid rgba(255,255,255,0.08)", 
                      borderRadius: 3, 
                      padding: "1px 4px", 
                      color: "var(--t1)", 
                      fontSize: 9, 
                      width: "100%", 
                      textAlign: "right" 
                    }} 
                  />
                ) : money(inst.savings)}
              </div>
            </div>
          ))}

          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 8, color: "var(--t3)", marginBottom: 2 }}>Balances Growth (Total across platforms)</div>
            <LineChart data={[65200, 71800, 68900, 79500, 84200, 90100, 96500, 103200]} color={HEX.green} height={58} />
          </div>

          {editFinance && (
            <button 
              onClick={() => {
                const newInst = { name: "New Bank", checking: 0, savings: 0 };
                const next = [...financeInstitutions, newInst];
                const newIdx = next.length - 1;
                setFinanceInstitutions(next);
                setFinanceInputs(fi => ({ 
                  ...fi, 
                  [`${newIdx}-name`]: "New Bank", 
                  [`${newIdx}-checking`]: 0, 
                  [`${newIdx}-savings`]: 0 
                }));
              }} 
              style={{ 
                fontSize: 8, 
                color: "var(--t3)", 
                background: "none", 
                border: "0.5px solid rgba(255,255,255,0.08)", 
                borderRadius: 3, 
                padding: "1px 6px", 
                marginTop: 4, 
                cursor: "pointer" 
              }}>+ Add Institution</button>
          )}
        </GridCard>

        <GridCard 
          title="Credit Score" 
          icon={<LucideBarChart3 size={14} />} 
          gridColumn="span 4"
          actions={
            <Button variant={editCredit ? "primary" : "ghost"} style={{ padding: "2px 10px", fontSize: 9 }} onClick={() => setEditCredit(!editCredit)}>
              {editCredit ? "SAVE" : "EDIT"}
            </Button>
          }>
          {/* Credit meter: score centered, labels, autopopulate sim from Karma/Experian */}
          {(() => {
            const karma = credInput.karma ?? 742;
            const exper = credInput.exper ?? 698;
            const avg = Math.round((karma + exper) / 2);
            const getLabel = (s) => s >= 800 ? "Excellent" : s >= 740 ? "Very Good" : s >= 670 ? "Good" : s >= 580 ? "Fair" : s >= 500 ? "Poor" : "Bad";
            const label = getLabel(avg);
            const pct = Math.max(0, Math.min(100, ((avg - 300) / 550) * 100));
            return (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, paddingTop: 8 }}>
                <div style={{ position: 'relative', width: 160, height: 80 }}>
                  {/* meter bg */}
                  <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: 12, background: 'linear-gradient(to right, #ff4f5e, #f59e0b, #22c55e)', borderRadius: 6 }} />
                  {/* needle/score in middle */}
                  <div style={{ position: 'absolute', left: `${pct}%`, bottom: 20, transform: 'translateX(-50%)', textAlign: 'center' }}>
                    <div style={{ fontSize: 28, fontWeight: 900, color: '#ff000d', lineHeight: 1 }}>{avg}</div>
                    <div style={{ fontSize: 10, color: 'var(--t1)' }}>{label}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 12, fontSize: 9, color: 'var(--t3)' }}>
                  <div>Karma: {karma}{editCredit && <input type="number" value={karma} onChange={e=>setCredInput({...credInput, karma: +e.target.value})} style={{width:50, fontSize:9}} />}</div>
                  <div>Experian: {exper}{editCredit && <input type="number" value={exper} onChange={e=>setCredInput({...credInput, exper: +e.target.value})} style={{width:50, fontSize:9}} />}</div>
                </div>
                {editCredit && <div style={{fontSize:8, color:'var(--t3)'}}>Edit to simulate auto from Credit Karma / Experian</div>}
              </div>
            );
          })()}
        </GridCard>

        {/* ── ROW 4: Social Hub / YouTube / Music Hub ── */}
        <GridCard 
          title="Social Hub" 
          icon={<Share2 size={14} />} 
          gridColumn="span 3" 
          actions={<Button variant="ghost" style={{ padding: "2px 8px", fontSize: 9 }} onClick={() => go("social")}>OPEN</Button>}>
          {!social ? <Empty icon="⏳" text="Loading…" /> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                { name: "Instagram", val: social.meta?.instagram?.followers, sub: `${social.meta?.instagram?.posts || 0} posts` },
                { name: "X", val: social.x?.followers, sub: `${social.x?.tweets || 0} posts` },
                { name: "YouTube", val: social.yt?.subscribers, sub: `${social.yt?.views || 0} views` },
              ].filter(p => p.val).map(p => (
                <div key={p.name} style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  gap: 9, 
                  padding: "6px 8px", 
                  borderRadius: 8, 
                  background: "rgba(255,255,255,0.025)", 
                  border: "0.5px solid rgba(255,255,255,0.05)" 
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: "var(--t2)" }}>{p.name}</div>
                    <div style={{ fontSize: 8, color: "var(--t3)" }}>{p.sub}</div>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 800, color: HEX.pink }}>{p.val}</span>
                </div>
              ))}
            </div>
          )}
        </GridCard>

        <GridCard title="YouTube" icon={<Send size={14} />} gridColumn="span 6">
          <YouTubePlayer />
        </GridCard>

        <GridCard 
          title="Music Hub" 
          icon={<Music size={14} />} 
          gridColumn="span 3" 
          actions={null}>
          {(!playlists || playlists.length === 0) ? <Empty icon="🎵" text="No playlists" sub="Create them in Music Hub" /> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {playlists.slice(0, 6).map(pl => (
                <div 
                  key={pl.id} 
                  style={{ 
                    display: "flex", 
                    alignItems: "center", 
                    gap: 9, 
                    padding: "6px 8px", 
                    borderRadius: 8, 
                    textAlign: "left", 
                    background: "rgba(255,255,255,0.025)", 
                    border: "0.5px solid rgba(255,255,255,0.05)" 
                  }}>
                  <div style={{ 
                    width: 26, 
                    height: 26, 
                    borderRadius: 6, 
                    flexShrink: 0, 
                    overflow: "hidden", 
                    background: pl.color || "var(--crimson)", 
                    display: "flex", 
                    alignItems: "center", 
                    justifyContent: "center", 
                    fontSize: 12 
                  }}>
                    {pl.cover ? <img src={pl.cover} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "🎵"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ 
                      fontSize: 10, 
                      fontWeight: 600, 
                      color: "var(--t1)", 
                      overflow: "hidden", 
                      textOverflow: "ellipsis", 
                      whiteSpace: "nowrap" 
                    }}>{pl.name}</div>
                    <div style={{ fontSize: 9, color: "var(--t3)" }}>{(pl.tracks || []).length} tracks</div>
                  </div>
                  <span style={{ fontSize: 12, color: "var(--t3)" }}>▶</span>
                </div>
              ))}
            </div>
          )}
        </GridCard>

        {/* ── ROW 5: Budget Tracker / AI Tips / Life Hacks ── */}
        <GridCard title="Budget Tracker" icon={<Wallet size={14} />} gridColumn="span 4">
          <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: "var(--t2)" }}>
            <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
              <Input 
                placeholder="Desc" 
                value={budgetDesc} 
                onChange={e => setBudgetDesc(e.target.value)} 
                style={{ fontSize: 9, padding: "4px 6px", flex: 2 }} 
              />
              <Input 
                placeholder="$" 
                type="number" 
                value={budgetAmount} 
                onChange={e => setBudgetAmount(e.target.value)} 
                style={{ fontSize: 9, padding: "4px 6px", flex: 1 }} 
              />
              <Button 
                style={{ padding: "4px 8px", fontSize: 9 }} 
                onClick={() => {
                  addBudget(budgetDesc, budgetAmount);
                  setBudgetDesc("");
                  setBudgetAmount("");
                }}
              >+</Button>
            </div>

            {budgetItems.map(item => (
              <div key={item.id} style={{ 
                display: "flex", 
                alignItems: "center", 
                gap: 4, 
                borderBottom: "0.5px solid rgba(255,255,255,0.05)", 
                padding: "2px 0" 
              }}>
                <input 
                  type="checkbox" 
                  checked={item.paid} 
                  onChange={() => toggleBudgetPaid(item.id)} 
                />
                <span style={{ 
                  flex: 1, 
                  textDecoration: item.paid ? "line-through" : "none", 
                  color: item.paid ? "var(--t3)" : "var(--t1)" 
                }}>
                  {item.desc} ${item.amount}
                </span>
                <button 
                  onClick={() => deleteBudget(item.id)} 
                  style={{ background: "none", border: "none", color: "var(--t3)", cursor: "pointer", fontSize: 10, padding: "0 4px" }}
                >×</button>
              </div>
            ))}

            <div style={{ fontSize: 9, color: "var(--t3)", marginTop: 4 }}>
              Owed: ${budgetItems.reduce((s, i) => s + (i.paid ? 0 : i.amount), 0).toFixed(0)} | Paid: ${budgetItems.reduce((s, i) => s + (i.paid ? i.amount : 0), 0).toFixed(0)}
            </div>
          </div>
        </GridCard>

        <GridCard title="AI Money Making Tips" icon={<Bot size={14} />} gridColumn="span 4">
          <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 10, color: "var(--t2)" }}>
            {(aiTips.length ? aiTips : ["Network consistently.", "Solve painful problems.", "Automate to scale."]).slice(0, 3).map((tip, i) => (
              <div key={i} style={{ padding: "4px 6px", background: "rgba(255,255,255,0.02)", borderRadius: 3 }}>
                {tip}
              </div>
            ))}
          </div>
        </GridCard>

        <GridCard title="Life Hacks" icon={<BookOpen size={14} />} gridColumn="span 4">
          <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 10, color: "var(--t2)" }}>
            {lifeHacks.map((h, i) => (
              <div key={i} style={{ padding: "2px 4px" }}>
                {h}
              </div>
            ))}
            <Input 
              placeholder="Add hack" 
              style={{ fontSize: 9, padding: "4px 6px", marginTop: 4 }} 
              onKeyDown={(e) => {
                if (e.key === "Enter" && e.target.value.trim()) {
                  addHack(e.target.value);
                  e.target.value = "";
                }
              }} 
            />
          </div>
        </GridCard>
      </div>
    </div>
  );
}