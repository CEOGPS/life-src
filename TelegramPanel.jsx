import { useState, useEffect, useRef } from "react";
import Icon from "@/components/lifeos/icons/Icon";

const WORKER = "https://lifeos1.ceogps.workers.dev";
const C = { blue:"#4ab3f4", orange:"#ff8c42", teal:"#00c896", purple:"#8b7fff", pink:"#ff6bd6", red:"#ff4f5e" };
const card = { background:"#13141f", border:"0.5px solid rgba(255,255,255,0.07)", borderRadius:12 };

async function workerCall(path, opts = {}) {
  try {
    const res = await fetch(WORKER + path, {
      ...opts,
      headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    });
    return await res.json();
  } catch (e) { return { error: e.message }; }
}

export default function TelegramPanel() {
  const [botInfo, setBotInfo]       = useState(null);
  const [botError, setBotError]     = useState(null);
  const [chats, setChats]           = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages]     = useState([]);
  const [input, setInput]           = useState("");
  const [sending, setSending]       = useState(false);
  const [webhookStatus, setWebhookStatus] = useState(null);
  const [polling, setPolling]       = useState(false);
  const [aiMode, setAiMode]         = useState(true);
  const [aiLoading, setAiLoading]   = useState(false);
  const [tab, setTab]               = useState("chat"); // chat | config | broadcast
  const [broadcastMsg, setBroadcastMsg] = useState("");
  const [broadcastResult, setBroadcastResult] = useState("");
  const msgEndRef = useRef(null);
  const pollRef = useRef(null);

  // Load bot info on mount + auto-register webhook
  useEffect(() => {
    workerCall("/api/telegram/info").then(d => {
      if (d?.result?.username) {
        setBotInfo(d.result);
        setBotError(null);
        // Auto-register webhook if not already done
        const webhookRegistered = localStorage.getItem("lifeos_telegram_webhook");
        if (!webhookRegistered) {
          workerCall("/api/telegram/webhook", { method:"POST", body:JSON.stringify({}) }).then(r => {
            if (r?.result) {
              localStorage.setItem("lifeos_telegram_webhook", "1");
              setWebhookStatus("✅ Webhook auto-registered successfully.");
            }
          });
        }
      } else {
        setBotError("Bot token not responding. Check TELEGRAM_BOT_TOKEN in Cloudflare Worker secrets.");
      }
    });
    loadChats();
  }, []);

  useEffect(() => { msgEndRef.current?.scrollIntoView({ behavior:"smooth" }); }, [messages]);

  async function loadChats() {
    const data = await workerCall("/api/telegram/chats");
    if (Array.isArray(data)) setChats(data);
  }

  async function loadMessages(chatId) {
    const data = await workerCall(`/api/telegram/messages?chat_id=${chatId}`);
    if (data?.messages) setMessages(data.messages.slice().reverse());
  }

  function selectChat(chat) {
    setActiveChat(chat);
    loadMessages(chat.id);
  }

  async function registerWebhook() {
    const data = await workerCall("/api/telegram/webhook", { method:"POST", body: JSON.stringify({}) });
    if (data?.result) setWebhookStatus("✅ Webhook registered — Telegram will now push messages to your worker.");
    else setWebhookStatus("❌ Failed: " + JSON.stringify(data));
  }

  async function pollUpdates() {
    setPolling(true);
    const data = await workerCall("/api/telegram/updates");
    if (data?.result?.length > 0) {
      await loadChats();
      if (activeChat) await loadMessages(activeChat.id);
    }
    setPolling(false);
  }

  // Auto-poll every 10s if chat is open
  useEffect(() => {
    if (!activeChat) return;
    pollRef.current = setInterval(() => loadMessages(activeChat.id), 10000);
    return () => clearInterval(pollRef.current);
  }, [activeChat]);

  async function sendMessage() {
    if (!input.trim() || !activeChat || sending) return;
    const text = input.trim();
    setInput("");
    setSending(true);

    // If AI mode — refine via free Workers AI
    let msgToSend = text;
    if (aiMode) {
      setAiLoading(true);
      try {
        const res = await fetch("https://lifeos1.ceogps.workers.dev/api/ai/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: `You are Breeze — LifeOS1's Telegram comms agent for Chris Green. Be concise, friendly, professional. The user wants to send this message via Telegram: "${text}"\n\nRefine it if needed (fix typos, improve clarity) or send as-is if it's already good. Return ONLY the final message text, nothing else.`,
            max_tokens: 500,
          }),
        });
        const d = await res.json();
        msgToSend = d?.text?.trim() || text;
      } catch { msgToSend = text; }
      setAiLoading(false);
    }

    const result = await workerCall("/api/telegram/send", {
      method:"POST",
      body: JSON.stringify({ chat_id: activeChat.id, text: msgToSend })
    });

    if (result?.ok || result?.result) {
      setMessages(prev => [...prev, { from:"You (Breeze)", text: msgToSend, ts: Date.now() }]);
    } else {
      alert("Send failed: " + JSON.stringify(result?.description || result));
    }
    setSending(false);
  }

  async function broadcast() {
    if (!broadcastMsg.trim() || !chats.length) return;
    let sent = 0, failed = 0;
    for (const chat of chats) {
      const r = await workerCall("/api/telegram/send", { method:"POST", body: JSON.stringify({ chat_id: chat.id, text: broadcastMsg }) });
      if (r?.ok || r?.result) sent++; else failed++;
    }
    setBroadcastResult(`✅ Sent to ${sent} chat${sent!==1?"s":""}${failed ? ` · ❌ ${failed} failed` : ""}`);
    setBroadcastMsg("");
  }

  return (
    <div style={{ height:"100%", display:"flex", flexDirection:"column", overflow:"hidden" }}>
      {/* Header */}
      <div style={{ padding:"12px 20px", borderBottom:"0.5px solid rgba(255,255,255,0.07)", display:"flex", alignItems:"center", gap:12, flexShrink:0 }}>
        <img src="/agents/Breeze.png" alt="Breeze" style={{ width:36, height:36, borderRadius:8, objectFit:"cover", objectPosition:"top", border:`1px solid ${C.pink}55` }} />
        <div>
          <div style={{ fontSize:14, fontWeight:700, color:"#f0ede8" }}>Breeze <span style={{ color:C.pink, fontSize:11 }}>· Telegram Agent</span></div>
          {botInfo
            ? <div style={{ fontSize:11, color:C.teal }}>● @{botInfo.username} · {botInfo.first_name}</div>
            : <div style={{ fontSize:11, color:botError ? C.red : "#6aaedd" }}>{botError || "Connecting..."}</div>
          }
        </div>
        <div style={{ marginLeft:"auto", display:"flex", gap:6 }}>
          {["chat","config","broadcast"].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ padding:"5px 12px", borderRadius:6, background: tab===t ? `${C.pink}22` : "rgba(255,255,255,0.04)", border: `0.5px solid ${tab===t ? C.pink : "rgba(255,255,255,0.08)"}`, color: tab===t ? C.pink : "#6aaedd", fontSize:11, fontWeight:600, cursor:"pointer" }}>
              {t.charAt(0).toUpperCase()+t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* CHAT TAB */}
      {tab === "chat" && (
        <div style={{ flex:1, display:"grid", gridTemplateColumns:"220px 1fr", overflow:"hidden" }}>
          {/* Chat list */}
          <div style={{ borderRight:"0.5px solid rgba(255,255,255,0.07)", display:"flex", flexDirection:"column", overflow:"hidden" }}>
            <div style={{ padding:"10px 12px", borderBottom:"0.5px solid rgba(255,255,255,0.05)", display:"flex", gap:6 }}>
              <button onClick={pollUpdates} disabled={polling} style={{ flex:1, padding:"6px", borderRadius:7, background:`${C.blue}15`, border:`0.5px solid ${C.blue}40`, color:C.blue, fontSize:10, fontWeight:600, cursor:"pointer" }}>
                {polling ? "⟳ Fetching..." : "⟳ Refresh"}
              </button>
            </div>
            <div style={{ flex:1, overflowY:"auto" }}>
              {chats.length === 0 ? (
                <div style={{ padding:16, fontSize:12, color:"#444", textAlign:"center" }}>
                  <div style={{ marginBottom:8 }}>No chats yet.</div>
                  <div style={{ fontSize:11, color:"#2a6fa8" }}>Register the webhook and send a message to your bot to see chats appear here.</div>
                </div>
              ) : chats.map(chat => (
                <button key={chat.id} onClick={() => selectChat(chat)} style={{ display:"block", width:"100%", textAlign:"left", padding:"10px 12px", background: activeChat?.id === chat.id ? `${C.pink}15` : "transparent", border:"none", borderBottom:"0.5px solid rgba(255,255,255,0.04)", cursor:"pointer" }}>
                  <div style={{ fontSize:12, fontWeight:600, color: activeChat?.id === chat.id ? C.pink : "#f0ede8" }}>{chat.name || chat.id}</div>
                  <div style={{ fontSize:10, color:"#444" }}>{chat.type} · {chat.id}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Message pane */}
          <div style={{ display:"flex", flexDirection:"column", overflow:"hidden" }}>
            {!activeChat ? (
              <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:10, color:"#444" }}>
                <div style={{ fontSize:28 }}><Icon name="💬" size={14} /></div>
                <div style={{ fontSize:13, color:"#6aaedd" }}>Select a chat to start messaging</div>
              </div>
            ) : (
              <>
                <div style={{ padding:"8px 14px", borderBottom:"0.5px solid rgba(255,255,255,0.05)", fontSize:12, fontWeight:600, color:C.pink, flexShrink:0 }}>{activeChat.name} <span style={{ color:"#444", fontWeight:400 }}>({activeChat.id})</span></div>
                <div style={{ flex:1, overflowY:"auto", padding:14, display:"flex", flexDirection:"column", gap:10 }}>
                  {messages.map((msg, i) => {
                    const isMe = msg.from === "You (Breeze)";
                    return (
                      <div key={i} style={{ display:"flex", justifyContent: isMe ? "flex-end" : "flex-start" }}>
                        <div style={{ maxWidth:"75%", padding:"8px 12px", borderRadius:10, fontSize:13, lineHeight:1.5, background: isMe ? `${C.pink}22` : "rgba(255,255,255,0.05)", color:"#f0ede8", border:`0.5px solid ${isMe ? C.pink : "rgba(255,255,255,0.08)"}44`, borderBottomRightRadius: isMe ? 3 : 10, borderBottomLeftRadius: isMe ? 10 : 3 }}>
                          {!isMe && <div style={{ fontSize:9, color:C.pink, fontWeight:700, marginBottom:3 }}>{msg.from}</div>}
                          {msg.text}
                          <div style={{ fontSize:9, color:"#333", marginTop:4, textAlign:"right" }}>{new Date(msg.ts).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" })}</div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={msgEndRef} />
                </div>
                <div style={{ padding:"10px 14px", borderTop:"0.5px solid rgba(255,255,255,0.07)", flexShrink:0 }}>
                  <div style={{ display:"flex", gap:6, marginBottom:6, alignItems:"center" }}>
                    <label style={{ display:"flex", alignItems:"center", gap:5, fontSize:10, color: aiMode ? C.pink : "#444", cursor:"pointer" }}>
                      <input type="checkbox" checked={aiMode} onChange={e => setAiMode(e.target.checked)} />
                      Breeze AI assist {aiLoading && "✦"}
                    </label>
                  </div>
                  <div style={{ display:"flex", gap:8 }}>
                    <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key==="Enter" && sendMessage()}
                      placeholder="Type a message..." style={{ flex:1, padding:"9px 12px", borderRadius:8, border:`0.5px solid ${C.pink}44`, background:"rgba(255,255,255,0.04)", fontSize:13, color:"#f0ede8", outline:"none" }} />
                    <button onClick={sendMessage} disabled={sending || aiLoading} style={{ padding:"9px 16px", borderRadius:8, background:`linear-gradient(135deg,${C.pink},${C.purple})`, border:"none", color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer", opacity: sending ? 0.6 : 1 }}>
                      {sending ? "..." : "Send"}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* CONFIG TAB */}
      {tab === "config" && (
        <div style={{ flex:1, overflowY:"auto", padding:20, display:"flex", flexDirection:"column", gap:16 }}>
          <div style={{ ...card, padding:20 }}>
            <div style={{ fontSize:14, fontWeight:700, color:"#f0ede8", marginBottom:4 }}><Icon name="🔗" size={12} style={{marginRight:6,verticalAlign:"middle"}} />Webhook Registration</div>
            <div style={{ fontSize:11, color:C.pink, marginBottom:8, padding:"6px 10px", borderRadius:6, background:`${C.pink}11`, border:`0.5px solid ${C.pink}33` }}>
              Mini App: <a href="https://t.me/cagednreality_bot/breeze" target="_blank" rel="noreferrer" style={{ color:C.pink }}>t.me/cagednreality_bot/breeze</a> — this is your bot's web app entry point. Users who open it will see LifeOS1 inside Telegram.
            </div>
            <div style={{ fontSize:12, color:"#6aaedd", marginBottom:12 }}>Register your bot's webhook so Telegram pushes incoming messages to your Cloudflare Worker automatically.</div>
            <div style={{ fontSize:11, color:"#444", marginBottom:12, fontFamily:"monospace", padding:"8px 10px", borderRadius:6, background:"rgba(255,255,255,0.03)", border:"0.5px solid rgba(255,255,255,0.06)" }}>
              Webhook URL: https://lifeos1.ceogps.workers.dev/api/telegram/incoming
            </div>
            <button onClick={registerWebhook} style={{ padding:"9px 20px", borderRadius:8, background:`${C.teal}20`, border:`0.5px solid ${C.teal}55`, color:C.teal, fontSize:12, fontWeight:700, cursor:"pointer" }}>
              Register Webhook
            </button>
            {webhookStatus && <div style={{ marginTop:10, fontSize:12, color: webhookStatus.startsWith("✅") ? C.teal : C.red }}>{webhookStatus}</div>}
          </div>

          <div style={{ ...card, padding:20 }}>
            <div style={{ fontSize:14, fontWeight:700, color:"#f0ede8", marginBottom:4 }}><Icon name="🤖" size={12} style={{marginRight:6,verticalAlign:"middle"}} />Bot Info</div>
            {botInfo ? (
              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                {[["Name", botInfo.first_name], ["Username", "@" + botInfo.username], ["Bot ID", botInfo.id], ["Can Join Groups", botInfo.can_join_groups ? "Yes" : "No"]].map(([k,v]) => (
                  <div key={k} style={{ display:"flex", gap:10, fontSize:12 }}>
                    <span style={{ color:"#6aaedd", width:120, flexShrink:0 }}>{k}</span>
                    <span style={{ color:"#f0ede8" }}>{String(v)}</span>
                  </div>
                ))}
                <div style={{ marginTop:8, display:"flex", gap:8 }}>
                  <a href={`https://t.me/${botInfo.username}`} target="_blank" rel="noreferrer" style={{ padding:"7px 16px", borderRadius:8, background:`${C.blue}20`, border:`0.5px solid ${C.blue}55`, color:C.blue, fontSize:12, fontWeight:600, textDecoration:"none" }}>
                    Open Bot ↗
                  </a>
                  <a href="https://t.me/cagednreality_bot/breeze" target="_blank" rel="noreferrer" style={{ padding:"7px 16px", borderRadius:8, background:`${C.pink}20`, border:`0.5px solid ${C.pink}55`, color:C.pink, fontSize:12, fontWeight:600, textDecoration:"none" }}>
                    Open Mini App ↗
                  </a>
                </div>
              </div>
            ) : <div style={{ fontSize:12, color:C.red }}>{botError || "Loading..."}</div>}
          </div>

          <div style={{ ...card, padding:20 }}>
            <div style={{ fontSize:14, fontWeight:700, color:"#f0ede8", marginBottom:4 }}><Icon name="⚙️" size={12} style={{marginRight:6,verticalAlign:"middle"}} />Secrets Required</div>
            <div style={{ fontSize:12, color:"#6aaedd", marginBottom:10 }}>Make sure this is set as a Cloudflare Worker secret:</div>
            <div style={{ fontFamily:"monospace", fontSize:12, padding:"10px 12px", borderRadius:8, background:"rgba(0,0,0,0.3)", border:"0.5px solid rgba(255,255,255,0.08)", color:C.teal }}>
              wrangler secret put TELEGRAM_BOT_TOKEN<br />
              <span style={{ color:"#6aaedd" }}># value: your bot token from @BotFather</span>
            </div>
          </div>
        </div>
      )}

      {/* BROADCAST TAB */}
      {tab === "broadcast" && (
        <div style={{ flex:1, overflowY:"auto", padding:20, display:"flex", flexDirection:"column", gap:16 }}>
          <div style={{ ...card, padding:20 }}>
            <div style={{ fontSize:14, fontWeight:700, color:"#f0ede8", marginBottom:4 }}><Icon name="📢" size={12} style={{marginRight:6,verticalAlign:"middle"}} />Broadcast Message</div>
            <div style={{ fontSize:12, color:"#6aaedd", marginBottom:12 }}>Send a message to all {chats.length} known chat{chats.length!==1?"s":""} at once.</div>
            <textarea value={broadcastMsg} onChange={e => setBroadcastMsg(e.target.value)}
              placeholder="Type your broadcast message..."
              style={{ width:"100%", minHeight:120, padding:"10px 12px", borderRadius:8, border:`0.5px solid ${C.pink}44`, background:"rgba(255,255,255,0.04)", fontSize:13, color:"#f0ede8", outline:"none", resize:"vertical", boxSizing:"border-box", marginBottom:10 }} />
            <button onClick={broadcast} disabled={!broadcastMsg.trim() || !chats.length} style={{ padding:"9px 20px", borderRadius:8, background:`linear-gradient(135deg,${C.pink},${C.purple})`, border:"none", color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer" }}><Icon name="📢" size={12} style={{marginRight:6,verticalAlign:"middle"}} />Send to All Chats
            </button>
            {broadcastResult && <div style={{ marginTop:10, fontSize:12, color: broadcastResult.startsWith("✅") ? C.teal : C.red }}>{broadcastResult}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
