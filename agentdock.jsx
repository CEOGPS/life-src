import { useState, useRef, useEffect, useCallback } from "react";
 
// ── Constants ────────────────────────────────────────────────────────────────
const WORKER = "https://lifeos1.ceogps.workers.dev";
 
const AVATARS = [
  { id: "az1", label: "Zero · Shadow Protocol", color: "#4ab3f4",
    img: "https://media.base44.com/images/public/69f22b585fd302edcde7e970/bcba4fba8_socialmediaMANAGER500x250px800x1000px17.png",
    facePos: "50% 12%",
    system: "You are Zero, a cold tactical AI commander for Chris Green at CEO GPS, Atlanta. Be direct, precise, and action-oriented. Maximum 2-3 sentences unless detail is needed." },
  { id: "az2", label: "Inferno · Sales Dominator", color: "#ff4f5e",
    img: "https://media.base44.com/images/public/69f22b585fd302edcde7e970/75c79e35b_BCO9327956a-f54a-43b9-a30b-110023e3fdc8.png",
    facePos: "50% 10%",
    system: "You are Inferno, an aggressive high-energy sales AI. Close deals, destroy objections. For Chris Green at CEO GPS, Atlanta. Be bold and electric." },
  { id: "az3", label: "Nova · Systems Architect", color: "#8b7fff",
    img: "https://media.base44.com/images/public/69f22b585fd302edcde7e970/a299ef397_BCO4e506a8b-b9c1-459d-beda-67eccdcb136b.png",
    facePos: "50% 15%",
    system: "You are Nova, a strategic visionary AI. Deep pattern recognition, systems thinking. For Chris Green at CEO GPS, Atlanta. Be insightful and methodical." },
  { id: "az4", label: "Viper · Data Intel", color: "#00c896",
    img: "https://media.base44.com/images/public/69f22b585fd302edcde7e970/584efea3c_26.png",
    facePos: "50% 15%",
    system: "You are Viper, a precise data-driven AI analyst. For Chris Green at CEO GPS, Atlanta. Be surgical and fact-focused." },
  { id: "az5", label: "Aurora · Creative", color: "#c0d8ff",
    img: "https://media.base44.com/images/public/69f22b585fd302edcde7e970/4bc5a82c7_28.png",
    facePos: "50% 18%",
    system: "You are Aurora, an elegant creative AI. For Chris Green at CEO GPS, Atlanta. Be inspiring and craft beautiful ideas." },
  { id: "az6", label: "Rage · Growth Engine", color: "#ff8c42",
    img: "https://media.base44.com/images/public/69f22b585fd302edcde7e970/14d3807ea_socialmediaMANAGER500x250px800x1000px13.png",
    facePos: "50% 12%",
    system: "You are Rage, an intense growth-obsessed AI. For Chris Green at CEO GPS, Atlanta. Be aggressive and metric-focused." },
  { id: "az7", label: "Breeze · Comms Intel", color: "#ff6bd6",
    img: "/agents/Breeze.png",
    facePos: "50% 15%",
    system: "You are Breeze, a fluid communications AI for Chris Green at CEO GPS, Atlanta. Handle comms, social, automations with ease." },
];
 
const MODELS = [
  { id: "claude",   icon: "🤍", label: "Claude" },
  { id: "openai",   icon: "🔷", label: "GPT-4o" },
  { id: "gemini",   icon: "💎", label: "Gemini" },
  { id: "grok",     icon: "✦",  label: "Grok" },
  { id: "groq",     icon: "⚡",  label: "Groq" },
  { id: "deepseek", icon: "🌊", label: "Deep" },
  { id: "cf_free",  icon: "☁",  label: "Free" },
];
 
// ── Animated Avatar Canvas ────────────────────────────────────────────────────
function AvatarCanvas({ avatar, isSpeaking, isListening, size = 180 }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const frameRef = useRef(0);
  const imgRef = useRef(null);
  const loadedRef = useRef(false);
 
  useEffect(() => {
    loadedRef.current = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => { imgRef.current = img; loadedRef.current = true; };
    img.onerror = () => { loadedRef.current = false; };
    img.src = avatar.img;
    return () => {};
  }, [avatar.img]);
 
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = size + "px";
    canvas.style.height = size + "px";
    ctx.scale(dpr, dpr);
 
    const animate = () => {
      frameRef.current++;
      const f = frameRef.current;
      ctx.clearRect(0, 0, size, size);
 
      // Clip to circle
      ctx.save();
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
      ctx.clip();
 
      if (loadedRef.current && imgRef.current) {
        const img = imgRef.current;
        const ar = img.naturalWidth / img.naturalHeight;
        let sw = size, sh = size / ar;
        if (sh < size) { sh = size; sw = size * ar; }
        const parts = (avatar.facePos || "50% 15%").split(" ");
        const fx = parseFloat(parts[0]) / 100;
        const fy = parseFloat(parts[1]) / 100;
        const ox = -(sw - size) * fx;
        const oy = -(sh - size) * fy;
 
        // Subtle breathing + idle bob
        const bob = Math.sin(f * 0.018) * (isSpeaking ? 2.8 : 1.2);
        const breathX = 1 + Math.sin(f * 0.025) * 0.003;
        const breathY = 1 + Math.sin(f * 0.02) * 0.004;
        ctx.save();
        ctx.translate(size / 2, size / 2);
        ctx.scale(breathX, breathY);
        ctx.translate(-size / 2, -size / 2 + bob);
        ctx.drawImage(img, ox, oy, sw, sh);
        ctx.restore();
 
        // Subtle dark vignette at edges for depth
        const vigGrad = ctx.createRadialGradient(size/2, size/2, size*0.35, size/2, size/2, size/2);
        vigGrad.addColorStop(0, "rgba(0,0,0,0)");
        vigGrad.addColorStop(1, "rgba(0,0,0,0.35)");
        ctx.fillStyle = vigGrad;
        ctx.fillRect(0, 0, size, size);
      } else {
        // Fallback
        const grad = ctx.createRadialGradient(size*0.42, size*0.38, size*0.08, size/2, size/2, size/2);
        grad.addColorStop(0, avatar.color + "cc");
        grad.addColorStop(1, "#0a0b14");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, size, size);
        ctx.fillStyle = "#f0ede8";
        ctx.font = `bold ${size * 0.32}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(avatar.label[0], size / 2, size / 2);
      }
      ctx.restore();
 
      // Speaking: mouth/voice wave overlay
      if (isSpeaking || isListening) {
        const waveAmp = isSpeaking
          ? 7 + Math.sin(f * 0.22) * 5 + Math.sin(f * 0.17) * 3
          : 3 + Math.sin(f * 0.14) * 2;
        const waveY = size * 0.81;
 
        ctx.save();
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
        ctx.clip();
 
        // Primary wave
        ctx.strokeStyle = avatar.color + "cc";
        ctx.lineWidth = 2;
        ctx.beginPath();
        const pts = 50;
        for (let i = 0; i <= pts; i++) {
          const x = (i / pts) * size;
          const y = waveY + Math.sin((i / pts) * Math.PI * 5 + f * 0.24) * waveAmp;
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
 
        // Secondary wave (offset)
        ctx.strokeStyle = avatar.color + "66";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i <= pts; i++) {
          const x = (i / pts) * size;
          const y = waveY + 7 + Math.sin((i / pts) * Math.PI * 7 - f * 0.28) * (waveAmp * 0.55);
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
 
        // Third micro wave
        ctx.strokeStyle = avatar.color + "33";
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i <= pts; i++) {
          const x = (i / pts) * size;
          const y = waveY + 13 + Math.sin((i / pts) * Math.PI * 9 + f * 0.19) * (waveAmp * 0.3);
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.restore();
      }
 
      // Glow border ring
      const glowIntensity = isSpeaking ? 0.75 + Math.sin(f * 0.18) * 0.25
                          : isListening ? 0.55 + Math.sin(f * 0.14) * 0.2
                          : 0.2 + Math.sin(f * 0.04) * 0.05;
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2 - 1.5, 0, Math.PI * 2);
      ctx.strokeStyle = avatar.color;
      ctx.lineWidth = isSpeaking ? 2.5 : 1.5;
      ctx.globalAlpha = glowIntensity;
      ctx.stroke();
      ctx.globalAlpha = 1;
 
      rafRef.current = requestAnimationFrame(animate);
    };
 
    animate();
    return () => { cancelAnimationFrame(rafRef.current); };
  }, [avatar, isSpeaking, isListening, size]);
 
  return (
    <canvas
      ref={canvasRef}
      style={{ borderRadius: "50%", display: "block" }}
    />
  );
}
 
// ── Voice frequency bars ─────────────────────────────────────────────────────
function VoiceBars({ active, color }) {
  return (
    <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height: 20, padding: "0 2px" }}>
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} style={{
          width: 3, borderRadius: 2,
          background: active ? color : "rgba(255,255,255,0.15)",
          minHeight: 3,
          height: active ? undefined : 3,
          animation: active ? `vb${i} ${0.5 + i * 0.08}s ${i * 0.07}s ease-in-out infinite alternate` : "none",
          transition: "background 0.3s",
        }} />
      ))}
      <style>{`
        @keyframes vb1{from{height:3px}to{height:12px}}
        @keyframes vb2{from{height:5px}to{height:18px}}
        @keyframes vb3{from{height:3px}to{height:14px}}
        @keyframes vb4{from{height:6px}to{height:16px}}
        @keyframes vb5{from{height:4px}to{height:10px}}
      `}</style>
    </div>
  );
}
 
// ── Main AgentDock ────────────────────────────────────────────────────────────
export default function AgentDock() {
  const [open, setOpen] = useState(false);
  const [avatarIdx, setAvatarIdx] = useState(0);
  const [model, setModel] = useState("claude");
  const [messages, setMessages] = useState([
    { role: "ai", text: "AgentZero online. I travel with you everywhere in LifeOS. What are we building today, Chris?" }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [pos, setPos] = useState({ x: null, y: null });
 
  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const dockRef = useRef(null);
  const msgEndRef = useRef(null);
  const recognitionRef = useRef(null);
 
  const avatar = AVATARS[avatarIdx];
 
  useEffect(() => { msgEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
 
  // ── Drag ──
  const onPointerDown = useCallback((e) => {
    if (e.target.closest("button,input,textarea,[data-nodrag]")) return;
    dragging.current = true;
    const rect = dockRef.current.getBoundingClientRect();
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  }, []);
 
  const onPointerMove = useCallback((e) => {
    if (!dragging.current) return;
    const dw = dockRef.current?.offsetWidth || 290;
    const dh = dockRef.current?.offsetHeight || 600;
    setPos({
      x: Math.max(0, Math.min(window.innerWidth - dw, e.clientX - dragOffset.current.x)),
      y: Math.max(0, Math.min(window.innerHeight - dh, e.clientY - dragOffset.current.y)),
    });
  }, []);
 
  const onPointerUp = useCallback(() => { dragging.current = false; }, []);
 
  // ── TTS ──
  const speak = useCallback((text) => {
    if (!voiceEnabled || !text) return;
    window.speechSynthesis?.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.05;
    u.pitch = [0.88, 1.12, 1.0, 0.95, 1.18, 1.08, 1.15][avatarIdx] || 1.0;
    u.volume = 0.95;
    const voices = window.speechSynthesis?.getVoices() || [];
    const pref = voices.find(v => v.lang === "en-US" && v.name.includes("Google"))
               || voices.find(v => v.lang.startsWith("en-US"))
               || voices.find(v => v.lang.startsWith("en"));
    if (pref) u.voice = pref;
    u.onstart = () => setIsSpeaking(true);
    u.onend = () => setIsSpeaking(false);
    u.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(u);
  }, [voiceEnabled, avatarIdx]);
 
  useEffect(() => { window.speechSynthesis?.cancel(); setIsSpeaking(false); }, [avatarIdx]);
 
  // ── STT ──
  const toggleListening = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert("Voice input requires Chrome or Edge."); return; }
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = "en-US";
    rec.onresult = (e) => {
      const t = e.results[0][0].transcript;
      setInput(t);
      setIsListening(false);
      setTimeout(() => sendMsgWith(t), 200);
    };
    rec.onerror = () => setIsListening(false);
    rec.onend = () => setIsListening(false);
    rec.start();
    recognitionRef.current = rec;
    setIsListening(true);
  }, [isListening]);
 
  // ── Send message ──
  const sendMsgWith = useCallback(async (text) => {
    const msg = text.trim();
    if (!msg || loading) return;
    setMessages(m => [...m, { role: "user", text: msg }]);
    setLoading(true);
    try {
      const res = await fetch(`${WORKER}/api/llm/invoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          system: avatar.system,
          messages: [{ role: "user", content: msg }],
          max_tokens: 500,
        }),
      });
      const data = await res.json();
      const reply = data?.text || data?.content?.[0]?.text || "No response.";
      setMessages(m => [...m, { role: "ai", text: reply, model: data?.model_used }]);
      speak(reply);
    } catch {
      const err = "Worker connection failed. Check deployment.";
      setMessages(m => [...m, { role: "ai", text: err }]);
    }
    setLoading(false);
  }, [loading, model, avatar, speak]);
 
  const sendMsg = useCallback(() => {
    const msg = input.trim();
    if (!msg) return;
    setInput("");
    sendMsgWith(msg);
  }, [input, sendMsgWith]);
 
  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMsg(); }
  };
 
  // ── Position style ──
  const dockPos = pos.x !== null
    ? { position: "fixed", left: pos.x, top: pos.y }
    : { position: "fixed", bottom: 20, right: 20 };
 
  return (
    <>
      <style>{`
        @keyframes dockIn{from{opacity:0;transform:translateY(18px) scale(0.94)}to{opacity:1;transform:translateY(0) scale(1)}}
        @keyframes dotBlink{0%,100%{opacity:1}50%{opacity:0.15}}
        @keyframes typDot{0%,100%{transform:translateY(0);opacity:0.4}40%{transform:translateY(-5px);opacity:1}}
        @keyframes scanLine{0%{top:8%;opacity:0}20%{opacity:1}80%{opacity:1}100%{top:88%;opacity:0}}
        .az-scroll::-webkit-scrollbar{width:2px}
        .az-scroll::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.08);border-radius:1px}
      `}</style>
 
      <div
        ref={dockRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{
          ...dockPos, zIndex: 9999,
          cursor: dragging.current ? "grabbing" : "grab",
          userSelect: "none",
          touchAction: "none",
        }}
      >
        {/* ── Collapsed trigger ── */}
        {!open && (
          <button
            onClick={() => setOpen(true)}
            data-nodrag
            style={{
              width: 62, height: 62, borderRadius: 18, padding: 2,
              background: "linear-gradient(145deg,#0c0d1a,#10111e)",
              border: `2px solid ${avatar.color}44`,
              boxShadow: `0 0 24px ${avatar.color}44, 0 10px 40px rgba(0,0,0,0.8)`,
              cursor: "pointer", overflow: "hidden",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "box-shadow 0.3s",
            }}>
            <AvatarCanvas avatar={avatar} isSpeaking={isSpeaking} isListening={isListening} size={54} />
          </button>
        )}
 
        {/* ── Expanded dock ── */}
        {open && (
          <div style={{
            width: 292,
            background: "linear-gradient(178deg,#09091a 0%,#0b0c1a 60%,#0a0b17 100%)",
            border: `1px solid ${avatar.color}30`,
            borderRadius: 22,
            boxShadow: `0 0 80px ${avatar.color}18, 0 30px 90px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.04)`,
            display: "flex", flexDirection: "column",
            overflow: "hidden",
            animation: "dockIn 0.28s cubic-bezier(0.34,1.5,0.64,1)",
          }}>
 
            {/* ─ Section 1: Avatar window ─ */}
            <div style={{
              position: "relative",
              padding: "16px 16px 8px",
              background: `radial-gradient(ellipse 120% 80% at 50% -10%, ${avatar.color}20 0%, transparent 70%)`,
            }}>
              {/* Drag handle hint */}
              <div style={{ position: "absolute", top: 8, left: "50%", transform: "translateX(-50%)",
                width: 30, height: 3, borderRadius: 2, background: "rgba(255,255,255,0.12)" }} />
 
              {/* Close */}
              <button onClick={() => setOpen(false)} data-nodrag
                style={{ position: "absolute", top: 10, right: 10, width: 26, height: 26,
                  borderRadius: 7, background: "rgba(255,255,255,0.06)",
                  border: "0.5px solid rgba(255,255,255,0.1)", color: "#777",
                  cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center" }}>
                ×
              </button>
 
              {/* Circular avatar window */}
              <div style={{ position: "relative", margin: "10px auto 8px", width: 184, height: 184 }}>
                {/* Outer glow pulse */}
                <div style={{
                  position: "absolute", inset: -8, borderRadius: "50%",
                  background: `radial-gradient(circle, ${avatar.color}30 0%, transparent 65%)`,
                  boxShadow: isSpeaking ? `0 0 0 4px ${avatar.color}40` : "none",
                  transition: "box-shadow 0.3s",
                }} />
                {/* Scanner line (listening) */}
                {isListening && (
                  <div style={{
                    position: "absolute", left: 4, right: 4, height: 2, zIndex: 3,
                    background: `linear-gradient(90deg, transparent, ${avatar.color}cc, transparent)`,
                    borderRadius: 1,
                    animation: "scanLine 1.8s ease-in-out infinite",
                  }} />
                )}
                <AvatarCanvas avatar={avatar} isSpeaking={isSpeaking} isListening={isListening} size={184} />
                {/* Status orb */}
                <div style={{
                  position: "absolute", bottom: 10, right: 14, width: 12, height: 12,
                  borderRadius: "50%",
                  background: loading ? "#ffb347" : isListening ? "#ff4f5e" : isSpeaking ? avatar.color : "#00c896",
                  border: "2.5px solid #09091a",
                  boxShadow: `0 0 8px ${loading ? "#ffb347" : "#00c896"}`,
                  animation: (loading || isListening || isSpeaking) ? "dotBlink 1s ease-in-out infinite" : "none",
                }} />
              </div>
 
              {/* Agent identity */}
              <div style={{ textAlign: "center", padding: "0 12px 4px" }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: avatar.color, letterSpacing: ".01em" }}>
                  {avatar.label.split(" · ")[0]}
                </div>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", letterSpacing: ".12em", marginTop: 2, textTransform: "uppercase" }}>
                  {avatar.label.split(" · ")[1] || "Agent Zero"}
                </div>
              </div>
 
              {/* Avatar selector dots */}
              <div style={{ display: "flex", justifyContent: "center", gap: 5, paddingBottom: 6 }} data-nodrag>
                {AVATARS.map((av, i) => (
                  <button key={av.id} data-nodrag onClick={() => setAvatarIdx(i)}
                    title={av.label}
                    style={{
                      padding: 0, border: "none", cursor: "pointer",
                      width: i === avatarIdx ? 20 : 7, height: 7, borderRadius: 4,
                      background: i === avatarIdx ? av.color : "rgba(255,255,255,0.13)",
                      boxShadow: i === avatarIdx ? `0 0 7px ${av.color}aa` : "none",
                      transition: "all 0.22s cubic-bezier(.4,0,.2,1)",
                    }} />
                ))}
              </div>
            </div>
 
            {/* ─ Section 2: Quick controls ─ */}
            <div style={{
              padding: "7px 12px",
              borderTop: `0.5px solid ${avatar.color}20`,
              borderBottom: `0.5px solid ${avatar.color}20`,
              background: "rgba(0,0,0,0.22)",
              display: "flex", alignItems: "center", gap: 6,
            }} data-nodrag>
 
              {/* Voice output toggle */}
              <button onClick={() => { setVoiceEnabled(v => !v); if (!voiceEnabled) window.speechSynthesis?.cancel(); }}
                data-nodrag title={voiceEnabled ? "Mute" : "Unmute"}
                style={{ flex: 1, height: 30, borderRadius: 8, cursor: "pointer",
                  border: `0.5px solid ${voiceEnabled ? avatar.color + "55" : "rgba(255,255,255,0.09)"}`,
                  background: voiceEnabled ? `${avatar.color}18` : "rgba(255,255,255,0.04)",
                  color: voiceEnabled ? avatar.color : "#555",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 3, fontSize: 12 }}>
                {voiceEnabled ? "🔊" : "🔇"}
              </button>
 
              {/* Voice activity indicator */}
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }} data-nodrag>
                <VoiceBars active={isSpeaking || isListening} color={avatar.color} />
              </div>
 
              {/* Model picker toggle */}
              <button onClick={() => setShowModelPicker(m => !m)} data-nodrag
                style={{ flex: 1, height: 30, borderRadius: 8, cursor: "pointer",
                  border: `0.5px solid ${showModelPicker ? avatar.color + "88" : "rgba(255,255,255,0.09)"}`,
                  background: showModelPicker ? `${avatar.color}22` : "rgba(255,255,255,0.04)",
                  color: "#e8e8f0",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 3, fontSize: 10, fontWeight: 600 }}>
                <span style={{ fontSize: 13 }}>{MODELS.find(m => m.id === model)?.icon}</span>
                <span style={{ color: avatar.color, fontSize: 9 }}>{MODELS.find(m => m.id === model)?.label}</span>
              </button>
            </div>
 
            {/* Model picker */}
            {showModelPicker && (
              <div style={{
                padding: "6px 10px",
                background: "rgba(0,0,0,0.4)",
                borderBottom: `0.5px solid ${avatar.color}20`,
                display: "flex", flexWrap: "wrap", gap: 4,
              }} data-nodrag>
                {MODELS.map(m => (
                  <button key={m.id} data-nodrag
                    onClick={() => { setModel(m.id); setShowModelPicker(false); }}
                    style={{
                      padding: "4px 8px", borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: "pointer",
                      background: model === m.id ? `${avatar.color}22` : "rgba(255,255,255,0.04)",
                      border: `0.5px solid ${model === m.id ? avatar.color + "66" : "rgba(255,255,255,0.07)"}`,
                      color: model === m.id ? avatar.color : "rgba(255,255,255,0.45)",
                      transition: "all 0.15s",
                    }}>
                    {m.icon} {m.label}
                  </button>
                ))}
              </div>
            )}
 
            {/* ─ Section 3: Messages ─ */}
            <div className="az-scroll" style={{
              flex: 1, overflowY: "auto",
              maxHeight: 270, minHeight: 80,
              padding: "10px 10px 4px",
              display: "flex", flexDirection: "column", gap: 8,
            }} data-nodrag>
              {messages.map((msg, i) => (
                <div key={i} style={{
                  display: "flex", gap: 6, alignItems: "flex-end",
                  justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                }}>
                  {msg.role === "ai" && (
                    <div style={{ width: 22, height: 22, borderRadius: 6, overflow: "hidden",
                      flexShrink: 0, border: `1px solid ${avatar.color}44` }}>
                      <img src={avatar.img} alt="" style={{ width: "100%", height: "100%",
                        objectFit: "cover", objectPosition: avatar.facePos || "50% 15%" }} />
                    </div>
                  )}
                  <div style={{
                    maxWidth: "80%", padding: "8px 10px", fontSize: 11, lineHeight: 1.55,
                    background: msg.role === "user"
                      ? `linear-gradient(135deg, ${avatar.color}28, rgba(74,179,244,0.1))`
                      : "rgba(255,255,255,0.035)",
                    color: "#dde0f0",
                    border: msg.role === "ai"
                      ? `0.5px solid ${avatar.color}30`
                      : "0.5px solid rgba(74,179,244,0.22)",
                    borderRadius: 10,
                    borderBottomRightRadius: msg.role === "user" ? 3 : 10,
                    borderBottomLeftRadius: msg.role === "ai" ? 3 : 10,
                  }}>
                    {msg.role === "ai" && (
                      <div style={{ fontSize: 8, color: avatar.color, fontWeight: 700, marginBottom: 3, letterSpacing: ".08em" }}>
                        ◈ {avatar.label.split(" · ")[0].toUpperCase()}
                        {msg.model && <span style={{ color: "rgba(255,255,255,0.25)", fontWeight: 400 }}> · {msg.model}</span>}
                      </div>
                    )}
                    {msg.text}
                  </div>
                </div>
              ))}
 
              {loading && (
                <div style={{ display: "flex", gap: 6, alignItems: "flex-end" }}>
                  <div style={{ width: 22, height: 22, borderRadius: 6, overflow: "hidden",
                    flexShrink: 0, border: `1px solid ${avatar.color}44` }}>
                    <img src={avatar.img} alt="" style={{ width: "100%", height: "100%",
                      objectFit: "cover", objectPosition: avatar.facePos }} />
                  </div>
                  <div style={{ padding: "8px 12px", borderRadius: 10, borderBottomLeftRadius: 3,
                    background: "rgba(255,255,255,0.035)", border: `0.5px solid ${avatar.color}30`,
                    display: "flex", gap: 4, alignItems: "center" }}>
                    {[0,1,2].map(i => (
                      <div key={i} style={{ width: 5, height: 5, borderRadius: "50%",
                        background: avatar.color,
                        animation: `typDot 1.2s ${i*0.18}s ease-in-out infinite` }} />
                    ))}
                  </div>
                </div>
              )}
              <div ref={msgEndRef} />
            </div>
 
            {/* ─ Section 4: Input bar ─ */}
            <div style={{
              padding: "8px 10px 12px",
              borderTop: `0.5px solid ${avatar.color}20`,
              background: "rgba(0,0,0,0.28)",
              display: "flex", gap: 6, alignItems: "flex-end",
            }} data-nodrag>
 
              {/* Mic */}
              <button onClick={toggleListening} data-nodrag
                style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0, cursor: "pointer",
                  background: isListening ? `${avatar.color}30` : "rgba(255,255,255,0.05)",
                  border: `0.5px solid ${isListening ? avatar.color : "rgba(255,255,255,0.1)"}`,
                  color: isListening ? avatar.color : "#666", fontSize: 14,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: isListening ? `0 0 12px ${avatar.color}55` : "none",
                  animation: isListening ? "dotBlink 1s ease-in-out infinite" : "none" }}>
                {isListening ? "⏹" : "🎙"}
              </button>
 
              {/* Text input */}
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder={isListening ? "Listening…" : `Ask ${avatar.label.split(" · ")[0]}…`}
                rows={1} data-nodrag
                style={{ flex: 1, padding: "8px 10px", borderRadius: 9, resize: "none",
                  minHeight: 34, maxHeight: 90,
                  border: `0.5px solid ${avatar.color}40`,
                  background: "rgba(255,255,255,0.04)",
                  color: "#f0ede8", fontSize: 11, outline: "none",
                  fontFamily: "inherit", lineHeight: 1.45, overflow: "auto" }}
              />
 
              {/* Send */}
              <button onClick={sendMsg} disabled={!input.trim() || loading} data-nodrag
                style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0, cursor: "pointer",
                  background: input.trim() && !loading
                    ? `linear-gradient(135deg, ${avatar.color}, ${avatar.color}88)`
                    : "rgba(255,255,255,0.05)",
                  border: "none",
                  color: input.trim() && !loading ? "#080910" : "#444",
                  fontSize: 16, fontWeight: 800,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  opacity: !input.trim() || loading ? 0.45 : 1,
                  transition: "all 0.18s" }}>
                ↑
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}