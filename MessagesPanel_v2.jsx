import { useState, useEffect, useRef } from "react";
import { useMessaging } from "@/_core/hooks/usemessaging";
import { useAuth } from "@/lib/FirebaseAuthContext";

const C = { blue: "#4ab3f4", orange: "#ff8c42", teal: "#00c896", purple: "#8b7fff", pink: "#ff6b9d", red: "#ff4f5e" };

const PLATFORMS = [
  { id: "sms", icon: "📱", label: "SMS", color: "#00c896" },
  { id: "messenger", icon: "f", label: "Messenger", color: "#0084ff" },
  { id: "instagram", icon: "📷", label: "Instagram", color: "#e1306c" },
  { id: "tiktok", icon: "🎬", label: "TikTok", color: "#69c9d0" },
  { id: "telegram", icon: "✈", label: "Telegram", color: "#2ca5e0" },
  { id: "signal", icon: "🔐", label: "Signal", color: "#3a76f0" },
  { id: "whatsapp", icon: "💬", label: "WhatsApp", color: "#25d366" },
  { id: "snapchat", icon: "👻", label: "Snapchat", color: "#fffc00" },
  { id: "google-voice", icon: "📞", label: "Google Voice", color: "#4285f4" },
];

export default function MessagesPanel() {
  const { user } = useAuth();
  const { conversations, messages, loading, sendMessage, fetchConversationMessages, syncPlatform } = useMessaging(user?.uid);

  const [activeConvId, setActiveConvId] = useState(null);
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [filterPlatform, setFilterPlatform] = useState("all");
  const [inCall, setInCall] = useState(null);
  const [aiDrafting, setAiDrafting] = useState(false);
  const [sendPlatform, setSendPlatform] = useState("auto");
  const [isSending, setIsSending] = useState(false);
  const [syncingPlatform, setSyncingPlatform] = useState(null);

  const fileAttachRef = useRef(null);

  // Set first conversation on load
  useEffect(() => {
    if (conversations.length > 0 && !activeConvId) {
      setActiveConvId(conversations[0].id);
      fetchConversationMessages(conversations[0].id);
    }
  }, [conversations, activeConvId, fetchConversationMessages]);

  // Fetch messages when conversation changes
  useEffect(() => {
    if (activeConvId) {
      fetchConversationMessages(activeConvId);
    }
  }, [activeConvId, fetchConversationMessages]);

  const active = conversations.find(c => c.id === activeConvId);
  const primaryPlatform = active?.platforms?.[0] || "messenger";
  const activeMessages = messages[activeConvId] || [];

  async function send() {
    if (!input.trim() || !active || isSending) return;

    try {
      setIsSending(true);
      const platform = sendPlatform === "auto" ? primaryPlatform : sendPlatform;
      await sendMessage(activeConvId, platform, input);
      setInput("");
    } catch (err) {
      console.error("Error sending message:", err);
      alert("Failed to send message: " + err.message);
    } finally {
      setIsSending(false);
    }
  }

  async function draftAIReply() {
    if (!active || aiDrafting) return;
    setAiDrafting(true);

    try {
      const history = activeMessages
        .slice(-4)
        .map(m => `${m.sender_type === "me" ? "You" : active.contact_name}: ${m.content}`)
        .join("\n");

      const platformLabel = PLATFORMS.find(p => p.id === primaryPlatform)?.label || "text";

      const response = await fetch("/api/ai/draft-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          history,
          contact_name: active.contact_name,
          platform: platformLabel,
        }),
      });

      const result = await response.json();
      if (result.reply) {
        setInput(result.reply);
      }
    } catch (err) {
      console.error("Error drafting reply:", err);
    } finally {
      setAiDrafting(false);
    }
  }

  async function handleSyncPlatform(platform) {
    setSyncingPlatform(platform);
    try {
      await syncPlatform(platform);
    } catch (err) {
      alert(`Failed to sync ${platform}: ${err.message}`);
    } finally {
      setSyncingPlatform(null);
    }
  }

  const filtered = conversations.filter(c => {
    const matchesSearch = c.contact_name.toLowerCase().includes(search.toLowerCase());
    const matchesPlatform = filterPlatform === "all" || c.platforms?.includes(filterPlatform);
    return matchesSearch && matchesPlatform;
  });

  if (!user) {
    return <div style={{ padding: 20, color: "#6aaedd" }}>Please log in to use messages</div>;
  }

  if (loading && !conversations.length) {
    return <div style={{ padding: 20, color: "#6aaedd" }}>Loading conversations...</div>;
  }

  return (
    <div style={{ display: "flex", height: "100vh", background: "#0d0e17", color: "#f0ede8", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      {/* LEFT SIDEBAR: CONVERSATIONS */}
      <div style={{ width: "320px", display: "flex", flexDirection: "column", borderRight: "0.5px solid rgba(255,255,255,0.07)", background: "#0d0e17" }}>
        {/* Header */}
        <div style={{ padding: "16px", borderBottom: "0.5px solid rgba(255,255,255,0.07)" }}>
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>Messages</div>

          {/* Search */}
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search conversations..."
            style={{
              width: "100%",
              padding: "8px 12px",
              borderRadius: 20,
              border: "0.5px solid rgba(255,255,255,0.12)",
              background: "#13141f",
              color: "#f0ede8",
              fontSize: 12,
              outline: "none",
              boxSizing: "border-box",
            }}
          />

          {/* Platform filter */}
          <div style={{ display: "flex", gap: 6, marginTop: 12, overflowX: "auto", paddingBottom: 6 }}>
            <button
              onClick={() => setFilterPlatform("all")}
              style={{
                padding: "6px 12px",
                borderRadius: 16,
                border: "0.5px solid " + (filterPlatform === "all" ? C.blue : "rgba(255,255,255,0.1)"),
                background: filterPlatform === "all" ? "rgba(74,179,244,0.15)" : "transparent",
                color: filterPlatform === "all" ? C.blue : "#6aaedd",
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}>
              All
            </button>
            {PLATFORMS.map(p => (
              <button
                key={p.id}
                onClick={() => setFilterPlatform(p.id)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 16,
                  border: "0.5px solid " + (filterPlatform === p.id ? p.color : "rgba(255,255,255,0.1)"),
                  background: filterPlatform === p.id ? `rgba(${p.color.match(/\w\w/g).map(x => parseInt(x, 16)).join(',')},0.15)` : "transparent",
                  color: filterPlatform === p.id ? p.color : "#6aaedd",
                  fontSize: 11,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}>
                {p.icon}
              </button>
            ))}
          </div>
        </div>

        {/* Conversations list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "6px 8px" }}>
          {filtered.length === 0 ? (
            <div style={{ padding: 16, fontSize: 12, color: "#2a6fa8", textAlign: "center" }}>
              No conversations
            </div>
          ) : (
            filtered.map(conv => (
              <div
                key={conv.id}
                onClick={() => setActiveConvId(conv.id)}
                style={{
                  display: "flex",
                  gap: 10,
                  padding: "10px 8px",
                  borderRadius: 10,
                  cursor: "pointer",
                  marginBottom: 2,
                  background: activeConvId === conv.id ? "rgba(74,179,244,0.1)" : "transparent",
                }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg,#4ab3f4,#ff8c42)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#0d0e17", flexShrink: 0 }}>
                  {conv.contact_initials || "?"}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#f0ede8" }}>{conv.contact_name}</div>
                  <div style={{ fontSize: 10, color: "#6aaedd", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {(messages[conv.id]?.[messages[conv.id].length - 1]?.content || "No messages")}
                  </div>
                </div>
                {conv.unread_count > 0 && (
                  <div style={{ width: 16, height: 16, borderRadius: "50%", background: C.blue, color: "#0d0e17", fontSize: 9, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {conv.unread_count}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Sync buttons */}
        <div style={{ padding: "12px", borderTop: "0.5px solid rgba(255,255,255,0.07)", fontSize: 10 }}>
          <div style={{ marginBottom: 8, color: "#2a6fa8" }}>Sync platforms:</div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {["telegram", "messenger", "instagram", "google-voice"].map(p => (
              <button
                key={p}
                onClick={() => handleSyncPlatform(p)}
                disabled={syncingPlatform === p}
                style={{
                  padding: "4px 8px",
                  borderRadius: 6,
                  border: "0.5px solid rgba(139,127,255,0.3)",
                  background: "rgba(139,127,255,0.05)",
                  color: C.purple,
                  fontSize: 10,
                  cursor: "pointer",
                  opacity: syncingPlatform === p ? 0.5 : 1,
                }}>
                {syncingPlatform === p ? "..." : PLATFORMS.find(x => x.id === p)?.icon}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT SIDE: CHAT */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#0d0e17" }}>
        {active ? (
          <>
            {/* Chat header */}
            <div style={{ padding: "12px 16px", borderBottom: "0.5px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
              <div style={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(135deg,#4ab3f4,#ff8c42)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#0d0e17" }}>
                {active.contact_initials || "?"}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#f0ede8" }}>
                  {active.contact_name}
                  {active.is_group && <span style={{ fontSize: 10, color: "#2a6fa8", marginLeft: 6 }}>👥 Group</span>}
                </div>
                <div style={{ fontSize: 10, color: "#6aaedd" }}>
                  {active.platforms?.map(p => PLATFORMS.find(x => x.id === p)?.label).join(", ")}
                </div>
              </div>
              <button onClick={() => setInCall(inCall === "voice" ? null : "voice")}
                style={{ padding: "7px 14px", borderRadius: 20, background: inCall === "voice" ? "rgba(0,200,150,0.2)" : "rgba(74,179,244,0.1)", border: "0.5px solid " + (inCall === "voice" ? C.teal : "rgba(74,179,244,0.3)"), color: inCall === "voice" ? C.teal : C.blue, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                📞
              </button>
              <button onClick={() => setInCall(inCall === "video" ? null : "video")}
                style={{ padding: "7px 14px", borderRadius: 20, background: inCall === "video" ? "rgba(139,127,255,0.2)" : "rgba(139,127,255,0.1)", border: "0.5px solid " + (inCall === "video" ? C.purple : "rgba(139,127,255,0.3)"), color: C.purple, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                🎥
              </button>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, padding: "12px 16px" }}>
              {activeMessages.length === 0 ? (
                <div style={{ color: "#2a6fa8", textAlign: "center", marginTop: 20 }}>No messages yet</div>
              ) : (
                activeMessages.map((m, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: m.sender_type === "me" ? "flex-end" : "flex-start", alignItems: "flex-end", gap: 6 }}>
                    <div style={{ maxWidth: "70%", padding: "9px 14px", borderRadius: 18, fontSize: 13, background: m.sender_type === "me" ? "rgba(74,179,244,0.2)" : "#13141f", color: "#f0ede8", border: m.sender_type !== "me" ? "0.5px solid rgba(255,255,255,0.07)" : "none", wordWrap: "break-word" }}>
                      {m.content}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Input */}
            <div style={{ padding: "10px 16px", borderTop: "0.5px solid rgba(255,255,255,0.07)", flexShrink: 0 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input ref={fileAttachRef} type="file" multiple style={{ display: "none" }} />
                <button onClick={() => fileAttachRef.current?.click()} style={{ padding: "10px 12px", borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "0.5px solid rgba(255,255,255,0.1)", color: "#6aaedd", fontSize: 14, cursor: "pointer" }}>
                  📎
                </button>
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && send()}
                  placeholder={`Message via ${PLATFORMS.find(p => p.id === primaryPlatform)?.label}...`}
                  style={{
                    flex: 1,
                    padding: "10px 14px",
                    borderRadius: 10,
                    border: "0.5px solid rgba(255,255,255,0.12)",
                    background: "#13141f",
                    color: "#f0ede8",
                    fontSize: 13,
                    outline: "none",
                  }}
                />
                <button onClick={draftAIReply} disabled={aiDrafting} style={{ padding: "10px 12px", borderRadius: 10, background: "rgba(139,127,255,0.12)", border: "0.5px solid rgba(139,127,255,0.3)", color: C.purple, fontSize: 11, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", opacity: aiDrafting ? 0.5 : 1 }}>
                  {aiDrafting ? "◈..." : "✦ AI"}
                </button>
                <button onClick={send} disabled={isSending} style={{ padding: "10px 18px", borderRadius: 10, background: "rgba(74,179,244,0.15)", border: "0.5px solid " + C.blue, color: C.blue, fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: isSending ? 0.5 : 1 }}>
                  {isSending ? "..." : "Send"}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1, color: "#2a6fa8" }}>
            Select a conversation to start messaging
          </div>
        )}
      </div>
    
    </div>
  );
}
