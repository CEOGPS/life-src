import { useState, useEffect, useRef } from "react";
import Icon from "@/components/lifeos/icons/Icon";

const C = { blue: "#4ab3f4", orange: "#ff8c42", teal: "#00c896", purple: "#8b7fff", red: "#ff4f5e" };
const card = { background: "#13141f", border: "0.5px solid rgba(255,255,255,0.07)", borderRadius: 12 };

// ─── LIVE CRYPTO (CoinGecko free API) ─────────────────────────────────────────
const COINS = ["bitcoin","ethereum","solana","cardano","dogecoin"];
const COIN_SYMBOLS = { bitcoin:"BTC", ethereum:"ETH", solana:"SOL", cardano:"ADA", dogecoin:"DOGE" };

async function fetchCrypto() {
  try {
    const ids = COINS.join(",");
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`);
    return await res.json();
  } catch { return null; }
}

// ─── LIVE NEWS (RSS via allorigins proxy) ─────────────────────────────────────
const NEWS_FEEDS = [
  { label: "Business", url: "https://feeds.bbci.co.uk/news/business/rss.xml" },
  { label: "Tech", url: "https://feeds.bbci.co.uk/news/technology/rss.xml" },
  { label: "Atlanta", url: "https://www.ajc.com/rss/news/local/" },
];

async function fetchNews(feedUrl) {
  try {
    const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent(feedUrl)}`;
    const res = await fetch(proxy);
    const json = await res.json();
    const parser = new DOMParser();
    const xml = parser.parseFromString(json.contents, "text/xml");
    const items = [...xml.querySelectorAll("item")].slice(0, 8).map(item => ({
      title: item.querySelector("title")?.textContent || "",
      link: item.querySelector("link")?.textContent || "",
      pub: item.querySelector("pubDate")?.textContent || "",
      desc: item.querySelector("description")?.textContent?.replace(/<[^>]*>/g,"").slice(0,120) || "",
    }));
    return items;
  } catch { return []; }
}

export default function LiveMarketWidget() {
  const [crypto, setCrypto] = useState(null);
  const [news, setNews] = useState([]);
  const [newsFeed, setNewsFeed] = useState(0);
  const [cryptoLoading, setCryptoLoading] = useState(true);
  const [newsLoading, setNewsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const tickerRef = useRef(null);

  async function refreshCrypto() {
    setCryptoLoading(true);
    const data = await fetchCrypto();
    if (data) { setCrypto(data); setLastUpdate(new Date()); }
    setCryptoLoading(false);
  }

  async function refreshNews(idx) {
    setNewsLoading(true);
    const items = await fetchNews(NEWS_FEEDS[idx ?? newsFeed].url);
    setNews(items);
    setNewsLoading(false);
  }

  useEffect(() => {
    refreshCrypto();
    refreshNews(0);
    const cryptoInterval = setInterval(refreshCrypto, 60000); // every 60s
    const newsInterval = setInterval(() => refreshNews(), 300000); // every 5min
    return () => { clearInterval(cryptoInterval); clearInterval(newsInterval); };
  }, []);

  useEffect(() => { refreshNews(newsFeed); }, [newsFeed]);

  // Auto-scroll ticker
  useEffect(() => {
    if (!tickerRef.current) return;
    let pos = 0;
    const el = tickerRef.current;
    const scroll = setInterval(() => {
      pos += 0.5;
      if (pos >= el.scrollWidth / 2) pos = 0;
      el.scrollLeft = pos;
    }, 20);
    return () => clearInterval(scroll);
  }, [crypto]);

  return (
    <div style={{ marginBottom: 20 }}>
      {/* ── CRYPTO TICKER ── */}
      <div style={{ background: "rgba(74,179,244,0.04)", border: "0.5px solid rgba(74,179,244,0.15)", borderRadius: 10, padding: "8px 12px", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.blue }}><Icon name="◈" size={12} style={{marginRight:6,verticalAlign:"middle"}} />LIVE CRYPTO</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {lastUpdate && <div style={{ fontSize: 9, color: "#2a6fa8" }}>Updated {lastUpdate.toLocaleTimeString()}</div>}
            <button onClick={refreshCrypto} disabled={cryptoLoading}
              style={{ padding: "2px 8px", borderRadius: 20, background: "rgba(74,179,244,0.1)", border: "0.5px solid rgba(74,179,244,0.3)", color: C.blue, fontSize: 9, cursor: "pointer" }}>
              {cryptoLoading ? "⟳" : "↻ Refresh"}
            </button>
          </div>
        </div>

        {cryptoLoading ? (
          <div style={{ fontSize: 11, color: "#2a6fa8" }}>Fetching prices...</div>
        ) : !crypto ? (
          <div style={{ fontSize: 11, color: "#ff4f5e" }}>Unable to reach CoinGecko — check connection</div>
        ) : (
          <>
            {/* Scrolling ticker */}
            <div ref={tickerRef} style={{ overflowX: "hidden", whiteSpace: "nowrap", marginBottom: 10 }}>
              <span style={{ display: "inline-block" }}>
                {[...COINS, ...COINS].map((coin, i) => {
                  const d = crypto[coin];
                  if (!d) return null;
                  const change = d.usd_24h_change?.toFixed(2);
                  const up = parseFloat(change) >= 0;
                  return (
                    <span key={i} style={{ display: "inline-block", marginRight: 24, fontSize: 11 }}>
                      <span style={{ color: "#f0ede8", fontWeight: 700 }}>{COIN_SYMBOLS[coin]}</span>
                      <span style={{ color: "#c8c8d0", marginLeft: 4 }}>${d.usd?.toLocaleString()}</span>
                      <span style={{ color: up ? C.teal : C.red, marginLeft: 4 }}>{up ? "▲" : "▼"}{Math.abs(change)}%</span>
                    </span>
                  );
                })}
              </span>
            </div>
            {/* Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
              {COINS.map(coin => {
                const d = crypto[coin];
                if (!d) return null;
                const change = d.usd_24h_change?.toFixed(2);
                const up = parseFloat(change) >= 0;
                return (
                  <div key={coin} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "8px 10px", border: `0.5px solid ${up ? "rgba(0,200,150,0.2)" : "rgba(255,79,94,0.2)"}` }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#f0ede8" }}>{COIN_SYMBOLS[coin]}</div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: up ? C.teal : C.red }}>${d.usd?.toLocaleString()}</div>
                    <div style={{ fontSize: 9, color: up ? C.teal : C.red }}>{up ? "▲" : "▼"}{Math.abs(change)}%</div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ── LIVE NEWS ── */}
      <div style={{ ...card, padding: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.orange }}><Icon name="📰" size={12} style={{marginRight:6,verticalAlign:"middle"}} />LIVE NEWS</div>
          <div style={{ display: "flex", gap: 4 }}>
            {NEWS_FEEDS.map((f, i) => (
              <button key={f.label} onClick={() => setNewsFeed(i)}
                style={{ padding: "2px 8px", borderRadius: 20, fontSize: 9, fontWeight: 600, cursor: "pointer", border: "0.5px solid", background: newsFeed === i ? "rgba(255,140,66,0.15)" : "transparent", borderColor: newsFeed === i ? C.orange : "rgba(255,255,255,0.1)", color: newsFeed === i ? C.orange : "#6aaedd" }}>
                {f.label}
              </button>
            ))}
            <button onClick={() => refreshNews(newsFeed)} disabled={newsLoading}
              style={{ padding: "2px 8px", borderRadius: 20, background: "rgba(255,140,66,0.1)", border: "0.5px solid rgba(255,140,66,0.3)", color: C.orange, fontSize: 9, cursor: "pointer" }}>
              {newsLoading ? "⟳" : "↻"}
            </button>
          </div>
        </div>

        {newsLoading ? (
          <div style={{ fontSize: 11, color: "#2a6fa8" }}>Loading {NEWS_FEEDS[newsFeed].label} news...</div>
        ) : news.length === 0 ? (
          <div style={{ fontSize: 11, color: "#ff4f5e" }}>Could not load news — RSS may be blocked. Try another feed.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 320, overflowY: "auto" }}>
            {news.map((item, i) => (
              <a key={i} href={item.link} target="_blank" rel="noopener noreferrer"
                style={{ display: "block", padding: "10px 12px", borderRadius: 8, background: "rgba(255,255,255,0.02)", border: "0.5px solid rgba(255,255,255,0.06)", textDecoration: "none", transition: "border-color .15s" }}
                onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(255,140,66,0.3)"}
                onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#f0ede8", lineHeight: 1.4, marginBottom: 4 }}>{item.title}</div>
                {item.desc && <div style={{ fontSize: 10, color: "#6aaedd", lineHeight: 1.4 }}>{item.desc}...</div>}
                {item.pub && <div style={{ fontSize: 9, color: "#2a6fa8", marginTop: 4 }}>{new Date(item.pub).toLocaleString()}</div>}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
