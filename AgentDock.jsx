import { useState, useRef, useEffect, useCallback } from "react";
import { getErebusCore } from "@/lib/agents/erebus/ErebusCore";
import { parseAndRunErebusTools } from "@/lib/agents/erebus/ErebusTools";
import { getKranos } from "@/lib/agents/kranos/Kranos";

// ── Constants ─────────────────────────────────────────────────────────────────
const WORKER = "api.lifeos1.ceogps.com";

const AVATARS = [
  { id: "erebus",  label: "Erebus",  subtitle: "Autonomous Core",    color: "#9b72cf",
    img: "/agents/Erebus.png",
    facePos: "50% 15%",
    system: "AUTONOMOUS — routes to ErebusCore, no external LLM" },
  { id: "kranos",  label: "Kranos",  subtitle: "Execution Engine",   color: "#8a64ff",
    img: "/agents/Kranos.png",
    facePos: "50% 10%",
    system: "You are Kranos, an autonomous AI coworker for Chris Green at CEO GPS, Atlanta. You execute tasks, manage files, control browsers, run workflows. Be direct, strategic, and relentless. You don't ask — you act." },
  { id: "zero",    label: "Zero",    subtitle: "Shadow Protocol",  color: "#4ab3f4",
    img: "https://ik.imagekit.io/sfuny7pebr/Breaker%20Brothers/CEOGPS/LifeOS1/Zero.png ",
    facePos: "50% 12%",
    system: "You are Zero, a cold tactical AI commander for Chris Green at CEO GPS, Atlanta. Be direct, precise, and action-oriented. Maximum 2-3 sentences unless detail is needed." },
  { id: "inferno", label: "Inferno", subtitle: "Sales Dominator",  color: "#ff4f5e",
    img: "https://media.base44.com/images/public/69f22b585fd302edcde7e970/75c79e35b_BCO9327956a-f54a-43b9-a30b-110023e3fdc8.png",
    facePos: "50% 10%",
    system: "You are Inferno, an aggressive high-energy sales AI. Close deals, destroy objections. For Chris Green at CEO GPS, Atlanta. Be bold and electric." },
  { id: "nova",    label: "Nova",    subtitle: "Systems Architect", color: "#8b7fff",
    img: "https://media.base44.com/images/public/69f22b585fd302edcde7e970/a299ef397_BCO4e506a8b-b9c1-459d-beda-67eccdcb136b.png",
    facePos: "50% 15%",
    system: "You are Nova, a strategic visionary AI. Deep pattern recognition, systems thinking. For Chris Green at CEO GPS, Atlanta. Be insightful and methodical." },
  { id: "viper",   label: "Viper",   subtitle: "Data Intel",       color: "#00c896",
    img: "https://media.base44.com/images/public/69f22b585fd302edcde7e970/584efea3c_26.png",
    facePos: "50% 15%",
    system: "You are Viper, a precise data-driven AI analyst. For Chris Green at CEO GPS, Atlanta. Be surgical and fact-focused." },
  { id: "rage",    label: "Rage",    subtitle: "Execution Engine",  color: "#ff8c42",
    img: "https://media.base44.com/images/public/69f22b585fd302edcde7e970/14d3807ea_socialmediaMANAGER500x250px800x1000px13.png",
    facePos: "50% 12%",
    system: "You are Rage, an intense growth-obsessed AI. For Chris Green at CEO GPS, Atlanta. Be aggressive and metric-focused." },
  { id: "aurora",  label: "Aurora",  subtitle: "Creative Director", color: "#c0d8ff",
    img: "https://media.base44.com/images/public/69f22b585fd302edcde7e970/4bc5a82c7_28.png",
    facePos: "50% 18%",
    system: "You are Aurora, an elegant creative AI. For Chris Green at CEO GPS, Atlanta. Be inspiring and craft beautiful ideas." },
  { id: "breeze",  label: "Breeze",  subtitle: "Comms Intel",      color: "#ff6bd6",
    img: "/agents/Breeze.png",
    facePos: "50% 15%",
    system: "You are Breeze, a fluid communications AI for Chris Green at CEO GPS, Atlanta. Handle comms, social, automations with ease." },
];

const MODELS = [
  { id: "auto",     icon: "✨", label: "Auto (local first)" },
  { id: "groq",     icon: "⚡", label: "Groq (fast free)" },
  { id: "gemini",   icon: "\u{1F48E}", label: "Gemini (free)" },
  { id: "deepseek", icon: "\u{1F30A}", label: "DeepSeek" },
  { id: "ollama",   icon: "🖥️", label: "Ollama (local)" },
  { id: "webllm",   icon: "🌐", label: "WebLLM (browser)" },
  { id: "grok",     icon: "✶",    label: "Grok" },
  { id: "claude",   icon: "\u{1F90D}", label: "Claude (fallback)" },
  { id: "openai",   icon: "\u{1F537}", label: "GPT-4o (fallback)" },
];

// ── Load per-agent customization from AIHub ───────────────────────────────────
function getAgentOverride(agentId) {
  try {
    const all = JSON.parse(localStorage.getItem("lifeos_agents") || "{}");
    return all[agentId] || {};
  } catch { return {}; }
}

// ── Pseudo-noise for organic motion ──────────────────────────────────────────
function noise(t) {
  return Math.sin(t * 1.3) * 0.5 + Math.sin(t * 2.7 + 1.1) * 0.3 + Math.sin(t * 5.1 + 2.3) * 0.2;
}

// face-api.js integration disabled (CDN models 404ing and not needed for core dashboard).
// If you want face landmark/zoom features back, self-host the weights or update the CDN version + paths.
let _faceState = "idle"; // idle | loading | ready | failed
let _faceCbs   = [];

function ensureFaceApi(cb) {
  if (_faceState === "ready")  { cb(true);  return; }
  if (_faceState === "failed") { cb(false); return; }
  _faceCbs.push(cb);
  if (_faceState === "loading") return;
  _faceState = "loading";
  const s = document.createElement("script");
  s.src = FACE_CDN;
  s.onload = async () => {
    try {
      const fa = window.faceapi;
      await Promise.all([
        fa.nets.tinyFaceDetector.loadFromUri(FACE_MODELS),
        fa.nets.faceLandmark68TinyNet.loadFromUri(FACE_MODELS),
      ]);
      _faceState = "ready";
      _faceCbs.forEach(f => f(true));
    } catch (e) {
      _faceState = "failed";
      _faceCbs.forEach(f => f(false));
    }
    _faceCbs = [];
  };
  s.onerror = () => {
    _faceState = "failed";
    _faceCbs.forEach(f => f(false));
    _faceCbs = [];
  };
  document.head.appendChild(s);
}

// Convert a face-api landmark point (in natural-image px) → canvas px
function lmToCanvas(pt, ox, oy, sw, sh, natW, natH) {
  return {
    x: ox + (pt.x / natW) * sw,
    y: oy + (pt.y / natH) * sh,
  };
}
function avgPts(pts) {
  const sx = pts.reduce((a, p) => a + p.x, 0) / pts.length;
  const sy = pts.reduce((a, p) => a + p.y, 0) / pts.length;
  return { x: sx, y: sy };
}

// ── Animated Avatar Canvas ────────────────────────────────────────────────────
function AvatarCanvas({ avatar, isSpeaking, isListening, size = 180 }) {
  const canvasRef   = useRef(null);
  const rafRef      = useRef(null);
  const frameRef    = useRef(0);
  const imgRef      = useRef(null);
  const loadedRef   = useRef(false);
  const landmarkRef = useRef(null); // { leftEye, rightEye, mouth, upperLip, lowerLip, natW, natH }
  const stateRef    = useRef({
    blinkState: 0, blinkTimer: Math.random() * 180 + 120,
    tiltAngle: 0,  tiltTarget: 0,
    noiseOff: Math.random() * 1000,
    bob: 0,
  });

  useEffect(() => {
    loadedRef.current = false;
    landmarkRef.current = null;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imgRef.current = img;
      loadedRef.current = true;
      // Attempt face-api.js landmark detection on the loaded image
      ensureFaceApi(async (ok) => {
        if (!ok || !imgRef.current) return;
        try {
          const fa  = window.faceapi;
          const res = await fa
            .detectSingleFace(imgRef.current, new fa.TinyFaceDetectorOptions({ scoreThreshold: 0.3 }))
            .withFaceLandmarks(true);
          if (!res) return;
          const lm   = res.landmarks;
          const box  = res.detection.box; // { x, y, width, height } in natural px
          const natW = imgRef.current.naturalWidth;
          const natH = imgRef.current.naturalHeight;
          // Expand the face box by a padding factor so we see forehead + chin
          const pad  = box.width * 0.45;
          const faceX = Math.max(0, box.x - pad);
          const faceY = Math.max(0, box.y - pad * 1.1); // extra top for forehead
          const faceW = Math.min(natW - faceX, box.width  + pad * 2);
          const faceH = Math.min(natH - faceY, box.height + pad * 2.2);
          landmarkRef.current = {
            leftEye:  lm.getLeftEye(),
            rightEye: lm.getRightEye(),
            mouth:    lm.getMouth(),
            natW, natH,
            // Face crop region (used to zoom canvas onto the face)
            faceBox: { x: faceX, y: faceY, w: faceW, h: faceH },
          };
        } catch (_) { /* silent fallback — animation continues without landmarks */ }
      });
    };
    img.onerror = () => { loadedRef.current = false; };
    img.src = avatar.img;
  }, [avatar.img]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    canvas.width  = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width  = size + "px";
    canvas.style.height = size + "px";
    ctx.scale(dpr, dpr);
    const s = stateRef.current;

    const animate = () => {
      frameRef.current++;
      const f = frameRef.current;
      const t = (f + s.noiseOff) * 0.01;
      ctx.clearRect(0, 0, size, size);

      // ── Update motion state ──
      s.blinkTimer--;
      if (s.blinkTimer <= 0 && s.blinkState === 0) s.blinkState = 1;
      if      (s.blinkState === 1) s.blinkState = 2;
      else if (s.blinkState === 2) s.blinkState = 3;
      else if (s.blinkState === 3) { s.blinkState = 0; s.blinkTimer = Math.random() * 200 + 100; }

      if (isSpeaking || isListening) {
        s.tiltTarget = noise(t * 0.8) * 0.04 + Math.sin(f * 0.031) * 0.02;
      } else {
        s.tiltTarget = noise(t * 0.3) * 0.012;
      }
      s.tiltAngle += (s.tiltTarget - s.tiltAngle) * 0.04;

      // ── Clip to circle ──
      ctx.save();
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
      ctx.clip();

      if (loadedRef.current && imgRef.current) {
        const img = imgRef.current;
        const lmNow = landmarkRef.current;

        // If face-api detected a face box, use it to zoom the canvas onto just the face.
        // Otherwise fall back to the facePos-based framing.
        let ox, oy, sw, sh;
        if (lmNow?.faceBox) {
          const fb = lmNow.faceBox; // { x, y, w, h } in natural image px
          // Scale the face box to fit the canvas square, keeping aspect ratio
          const fbAr = fb.w / fb.h;
          if (fbAr > 1) { sw = size; sh = size / fbAr; }
          else          { sh = size; sw = size * fbAr; }
          if (sw < size) { sw = size; sh = size / fbAr; }
          if (sh < size) { sh = size; sw = size * fbAr; }
          // Map faceBox origin to canvas: faceBox.x at image scale = ox in canvas
          const scaleX = sw / fb.w;
          const scaleY = sh / fb.h;
          ox = -fb.x * scaleX + (size - sw) / 2;
          oy = -fb.y * scaleY + (size - sh) / 2;
          // Adjust sw/sh to natural image scale for drawImage
          sw = img.naturalWidth  * scaleX;
          sh = img.naturalHeight * scaleY;
        } else {
          const ar = img.naturalWidth / img.naturalHeight;
          sw = size; sh = size / ar;
          if (sh < size) { sh = size; sw = size * ar; }
          const parts = (avatar.facePos || "50% 15%").split(" ");
          const fx = parseFloat(parts[0]) / 100;
          const fy = parseFloat(parts[1]) / 100;
          ox = -(sw - size) * fx;
          oy = -(sh - size) * fy;
        }

        // Organic bob — layered sinusoids so it never perfectly loops
        const bob = Math.sin(f * 0.018) * 1.1 + Math.sin(f * 0.027 + 0.8) * 0.6
                  + (isSpeaking ? noise(t * 3) * 1.5 : 0);
        s.bob = bob;

        ctx.save();
        ctx.translate(size / 2, size / 2);
        ctx.rotate(s.tiltAngle);
        ctx.translate(-size / 2, -size / 2 + bob);
        ctx.drawImage(img, ox, oy, sw, sh);
        ctx.restore();

        // ── Eye blink overlay (landmark-positioned or estimated) ─────────────
        const lm = landmarkRef.current;
        let eyeY, eyeW;
        if (lm) {
          const { leftEye, rightEye, natW, natH } = lm;
          const toLM = (pts) => pts.map(p => {
            const c = lmToCanvas(p, ox, oy, sw, sh, natW, natH);
            return { x: c.x, y: c.y + bob };
          });
          const leAvg = avgPts(toLM(leftEye));
          const reAvg = avgPts(toLM(rightEye));
          eyeY = (leAvg.y + reAvg.y) / 2;
          eyeW = Math.abs(reAvg.x - leAvg.x) + size * 0.18;
        } else {
          eyeY = size * 0.35;
          eyeW = size * 0.70;
        }

        if (s.blinkState !== 0) {
          const bp  = s.blinkState === 2 ? 1 : 0.5;
          const bh  = (eyeW * 0.12) * bp;
          const ex  = size / 2 - eyeW / 2;
          const bg  = ctx.createLinearGradient(0, eyeY - bh, 0, eyeY + bh);
          bg.addColorStop(0,   "rgba(0,0,0,0)");
          bg.addColorStop(0.5, `rgba(8,9,20,${bp * 0.90})`);
          bg.addColorStop(1,   "rgba(0,0,0,0)");
          ctx.fillStyle = bg;
          ctx.fillRect(ex, eyeY - bh, eyeW, bh * 2);
        }

        // Vignette
        const vg = ctx.createRadialGradient(size/2, size/2, size*0.32, size/2, size/2, size/2);
        vg.addColorStop(0, "rgba(0,0,0,0)");
        vg.addColorStop(1, "rgba(0,0,0,0.38)");
        ctx.fillStyle = vg;
        ctx.fillRect(0, 0, size, size);

      } else {
        // Fallback — glowing initial
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

      // Speaking voice wave — pinned to bottom edge, not over the face
      if (isSpeaking || isListening) {
        const waveAmp = isSpeaking
          ? 5 + noise(t * 4) * 4 + Math.sin(f * 0.17) * 2
          : 2 + Math.sin(f * 0.14) * 1.5;
        const waveY = size * 0.91;
        ctx.save();
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
        ctx.clip();
        const pts = 50;
        ctx.strokeStyle = avatar.color + "bb";
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i <= pts; i++) {
          const x = (i / pts) * size;
          const y = waveY + Math.sin((i / pts) * Math.PI * 5 + f * 0.24) * waveAmp;
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.strokeStyle = avatar.color + "55";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i <= pts; i++) {
          const x = (i / pts) * size;
          const y = waveY + 7 + Math.sin((i / pts) * Math.PI * 7 - f * 0.28) * (waveAmp * 0.55);
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.restore();
      }

      // Glow border ring
      const glowAlpha = isSpeaking   ? 0.75 + Math.sin(f * 0.18) * 0.25
                      : isListening  ? 0.55 + Math.sin(f * 0.14) * 0.2
                      :               0.20 + Math.sin(f * 0.04) * 0.05;
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2 - 1.5, 0, Math.PI * 2);
      ctx.strokeStyle = avatar.color;
      ctx.lineWidth   = isSpeaking ? 2.5 : 1.5;
      ctx.globalAlpha = glowAlpha;
      ctx.stroke();
      ctx.globalAlpha = 1;

      rafRef.current = requestAnimationFrame(animate);
    };

    animate();
    return () => cancelAnimationFrame(rafRef.current);
  }, [avatar, isSpeaking, isListening, size]);

  return <canvas ref={canvasRef} style={{ borderRadius: "50%", display: "block" }} />;
}

// ── Voice frequency bars ──────────────────────────────────────────────────────
function VoiceBars({ active, color }) {
  return (
    <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height: 20 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} style={{
          width: 3, borderRadius: 2,
          background: active ? color : "rgba(255,255,255,0.14)",
          height: active ? undefined : 3, minHeight: 3,
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
  const [open,            setOpen]           = useState(false);
  const [avatarIdx,       setAvatarIdx]      = useState(0);
  const [model,           setModel]          = useState("claude");
  const [messages,        setMessages]       = useState([
    { role: "ai", text: "Erebus online. Autonomous. Zero cloud dependency.\n\nI know your goals, your leads, your family schedule. Command me." }
  ]);
  const [input,           setInput]          = useState("");
  const [loading,         setLoading]        = useState(false);
  const [isSpeaking,      setIsSpeaking]     = useState(false);
  const [isListening,     setIsListening]    = useState(false);
  const [voiceEnabled,    setVoiceEnabled]   = useState(true);
  const [showModelPicker, setShowModelPicker]= useState(false);
  const [pos,             setPos]            = useState({ x: null, y: null });

  const dragging    = useRef(false);
  const dragOffset  = useRef({ x: 0, y: 0 });
  const dockRef     = useRef(null);
  const msgEndRef   = useRef(null);
  const recognitionRef = useRef(null);

  // Merge AIHub customizations into the AVATARS list each render
  const avatars = AVATARS.map(av => {
    const ov = getAgentOverride(av.id);
    return {
      ...av,
      label:       ov.name        || av.label,
      subtitle:    ov.tagline     || av.subtitle,
      color:       ov.color       || av.color,
      img:         ov.img         || av.img,
      facePos:     ov.facePos     || av.facePos,
      system:      ov.systemPrompt || av.system,
      speechVoice: ov.speechVoice || "",
      speechRate:  ov.speechRate  || 1.05,
      speechPitch: ov.speechPitch || ([0.88,1.12,1.0,0.95,1.08,1.18,1.15][AVATARS.findIndex(a=>a.id===av.id)] || 1.0),
    };
  });
  const avatar = avatars[avatarIdx];

  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Drag ──────────────────────────────────────────────────────────────────
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
    const dw = dockRef.current?.offsetWidth  || 292;
    const dh = dockRef.current?.offsetHeight || 600;
    setPos({
      x: Math.max(0, Math.min(window.innerWidth  - dw, e.clientX - dragOffset.current.x)),
      y: Math.max(0, Math.min(window.innerHeight - dh, e.clientY - dragOffset.current.y)),
    });
  }, []);

  const onPointerUp = useCallback(() => { dragging.current = false; }, []);

  // ── TTS ───────────────────────────────────────────────────────────────────
  const speak = useCallback((text) => {
    if (!voiceEnabled || !text) return;
    window.speechSynthesis?.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate   = avatar.speechRate  || 1.05;
    u.pitch  = avatar.speechPitch || 1.0;
    u.volume = 0.95;
    const allVoices = window.speechSynthesis?.getVoices() || [];
    // Use saved voice name first, then fall back to best en-US
    const saved = avatar.speechVoice
      ? allVoices.find(v => v.name === avatar.speechVoice)
      : null;
    const pref = saved
      || allVoices.find(v => v.lang === "en-US" && v.name.includes("Google"))
      || allVoices.find(v => v.lang.startsWith("en-US"))
      || allVoices.find(v => v.lang.startsWith("en"));
    if (pref) u.voice = pref;
    u.onstart = () => setIsSpeaking(true);
    u.onend   = () => setIsSpeaking(false);
    u.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(u);
  }, [voiceEnabled, avatar]);

  useEffect(() => {
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
    // Reset greeting when switching agents
    const av = avatars[avatarIdx];
    if (av?.id === "erebus") {
      setMessages([{ role: "ai", text: "Erebus online. Autonomous. Zero cloud dependency.\n\nI know your goals, your leads, your family schedule. Command me." }]);
    } else if (av?.id === "kranos") {
      setMessages([{ role: "ai", text: "⚔️ Kranos online.\n\nFiles. Browser. Workflows. Media. I execute — no hand-holding.\n\nWhat needs to be done?" }]);
    } else if (av) {
      setMessages([{ role: "ai", text: `${av.label} online. ${av.subtitle}. What do you need, Chris?` }]);
    }
  }, [avatarIdx]);

  // ── STT ───────────────────────────────────────────────────────────────────
  const toggleListening = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert("Voice input requires Chrome or Edge."); return; }
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); return; }
    const rec = new SR();
    rec.continuous      = false;
    rec.interimResults  = false;
    rec.lang            = "en-US";
    rec.onresult = (e) => {
      const t = e.results[0][0].transcript;
      setInput(t);
      setIsListening(false);
      setTimeout(() => sendMsgWith(t), 200);
    };
    rec.onerror = () => setIsListening(false);
    rec.onend   = () => setIsListening(false);
    rec.start();
    recognitionRef.current = rec;
    setIsListening(true);
  }, [isListening]);

  // ── Send ──────────────────────────────────────────────────────────────────
  const sendMsgWith = useCallback(async (text) => {
    const msg = text.trim();
    if (!msg || loading) return;
    setMessages(m => [...m, { role: "user", text: msg }]);
    setLoading(true);
    try {
      // ── Erebus: 100% autonomous — zero external LLM ──────────────────────
      if (avatar.id === "erebus") {
        const core = getErebusCore();
        await new Promise(r => setTimeout(r, 220));
        core.remember("user", msg);
        const { response } = await core.reason(msg);
        const { text: clean, toolResults } = await parseAndRunErebusTools(response);
        core.remember("assistant", clean);
        const reply = clean + (toolResults.length ? "\n\n⚡ Tools: " + toolResults.map(r => r.type).join(", ") : "");
        setMessages(m => [...m, { role: "ai", text: reply }]);
        speak(reply.slice(0, 300));
        setLoading(false);
        return;
      }
      // ── Kranos: autonomous agent with tools ───────────────────────────────
      if (avatar.id === "kranos") {
        const kranos = getKranos();
        const result = await kranos.think(msg, { permMode: "default" });
        const toolNote = result.toolResults?.length
          ? "\n\n⚙ Tools used: " + result.toolResults.map(r => r.tool).join(", ")
          : "";
        const reply = (result.response || result.error || "Done.") + toolNote;
        setMessages(m => [...m, { role: "ai", text: reply }]);
        speak(reply.slice(0, 300));
        setLoading(false);
        return;
      }
      // ── All other agents: route through Worker ────────────────────────────
      const res = await fetch(`${WORKER}/api/llm/invoke`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          system:     avatar.system,
          messages:   [{ role: "user", content: msg }],
          max_tokens: 500,
        }),
      });
      const data  = await res.json();
      const reply = data?.text || data?.content?.[0]?.text || "No response.";
      setMessages(m => [...m, { role: "ai", text: reply }]);
      speak(reply);
    } catch {
      setMessages(m => [...m, { role: "ai", text: "Worker connection failed. Check deployment." }]);
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

  const dockPos = pos.x !== null
    ? { position: "fixed", left: pos.x, top: pos.y }
    : { position: "fixed", bottom: 20, right: 20 };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @keyframes dockIn   {from{opacity:0;transform:translateY(16px) scale(0.93)}to{opacity:1;transform:translateY(0) scale(1)}}
        @keyframes dotBlink {0%,100%{opacity:1}50%{opacity:0.15}}
        @keyframes scanLine {0%{top:8%;opacity:0}20%{opacity:1}80%{opacity:1}100%{top:88%;opacity:0}}
        .az-msg-scroll::-webkit-scrollbar{width:2px}
        .az-msg-scroll::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.07);border-radius:1px}
      `}</style>

      <div
        ref={dockRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{
          ...dockPos, zIndex: 9999,
          cursor: "grab",
          userSelect: "none",
          touchAction: "none",
        }}
      >
        {/* ── Collapsed orb ── */}
        {!open && (
          <button
            onClick={() => setOpen(true)}
            data-nodrag
            style={{
              width: 64, height: 64, borderRadius: 20, padding: 3,
              background: "linear-gradient(145deg,#0c0d1a,#10111e)",
              border: `2px solid ${avatar.color}44`,
              boxShadow: `0 0 28px ${avatar.color}44, 0 12px 40px rgba(0,0,0,0.8)`,
              cursor: "pointer", overflow: "hidden",
              display: "flex", alignItems: "center", justifyContent: "center",
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
            maxHeight: "92vh",
          }}>

            {/* ─ AVATAR SECTION ─ */}
            <div style={{
              position: "relative", padding: "16px 16px 10px",
              background: `radial-gradient(ellipse 120% 80% at 50% -10%, ${avatar.color}1e 0%, transparent 70%)`,
              flexShrink: 0,
            }}>
              {/* Drag pill */}
              <div style={{ position: "absolute", top: 8, left: "50%", transform: "translateX(-50%)",
                width: 30, height: 3, borderRadius: 2, background: "rgba(255,255,255,0.12)" }} />

              {/* Close */}
              <button onClick={() => setOpen(false)} data-nodrag style={{
                position: "absolute", top: 10, right: 10, width: 26, height: 26,
                borderRadius: 7, background: "rgba(255,255,255,0.06)",
                border: "0.5px solid rgba(255,255,255,0.1)", color: "#666",
                cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center",
              }}>×</button>

              {/* Circular avatar */}
              <div style={{ position: "relative", margin: "12px auto 10px", width: 184, height: 184 }}>
                <div style={{
                  position: "absolute", inset: -8, borderRadius: "50%",
                  background: `radial-gradient(circle, ${avatar.color}28 0%, transparent 65%)`,
                  boxShadow: isSpeaking ? `0 0 0 4px ${avatar.color}38` : "none",
                  transition: "box-shadow 0.3s",
                }} />
                {isListening && (
                  <div style={{
                    position: "absolute", left: 4, right: 4, height: 2, zIndex: 3,
                    background: `linear-gradient(90deg, transparent, ${avatar.color}cc, transparent)`,
                    borderRadius: 1, animation: "scanLine 1.8s ease-in-out infinite",
                  }} />
                )}
                <AvatarCanvas avatar={avatar} isSpeaking={isSpeaking} isListening={isListening} size={184} />
                {/* Status dot */}
                <div style={{
                  position: "absolute", bottom: 10, right: 14, width: 12, height: 12,
                  borderRadius: "50%",
                  background: loading ? "#ffb347" : isListening ? "#ff4f5e" : isSpeaking ? avatar.color : "#00c896",
                  border: "2.5px solid #09091a",
                  boxShadow: `0 0 8px ${loading ? "#ffb347" : "#00c896"}`,
                  animation: (loading || isListening || isSpeaking) ? "dotBlink 1s ease-in-out infinite" : "none",
                }} />
              </div>

              {/* Identity */}
              <div style={{ textAlign: "center", paddingBottom: 6 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: avatar.color, letterSpacing: ".01em" }}>
                  {avatar.label}
                </div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>
                  {avatar.subtitle}
                </div>
              </div>

              {/* Voice bars + voice toggle */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 4 }}>
                <VoiceBars active={isSpeaking || isListening} color={avatar.color} />
                <button
                  onClick={() => setVoiceEnabled(v => !v)}
                  data-nodrag
                  title={voiceEnabled ? "Mute voice" : "Enable voice"}
                  style={{
                    background: voiceEnabled ? `${avatar.color}18` : "rgba(255,255,255,0.04)",
                    border: `0.5px solid ${voiceEnabled ? avatar.color + "44" : "rgba(255,255,255,0.1)"}`,
                    borderRadius: 6, padding: "3px 8px", fontSize: 10,
                    color: voiceEnabled ? avatar.color : "#555",
                    cursor: "pointer",
                  }}>
                  {voiceEnabled ? "🔊" : "🔇"}
                </button>
              </div>
            </div>

            {/* ─ CONTROLS: Agent + Model ─ */}
            <div style={{ padding: "8px 12px", borderTop: `0.5px solid ${avatar.color}18`, flexShrink: 0 }}>
              {/* Agent switcher */}
              <div style={{ display: "flex", gap: 5, justifyContent: "center", marginBottom: 8 }}>
                {avatars.map((av, i) => (
                  <button
                    key={av.id}
                    onClick={() => setAvatarIdx(i)}
                    data-nodrag
                    title={av.label}
                    style={{
                      width: 28, height: 34, borderRadius: 6, padding: 0,
                      border: `1.5px solid ${i === avatarIdx ? av.color : "rgba(255,255,255,0.08)"}`,
                      overflow: "hidden", cursor: "pointer",
                      boxShadow: i === avatarIdx ? `0 0 10px ${av.color}44` : "none",
                      transition: "all .18s",
                      flexShrink: 0,
                    }}>
                    <img
                      src={av.img}
                      alt={av.label}
                      style={{
                        width: "100%", height: "100%",
                        objectFit: "cover",
                        objectPosition: av.facePos || "50% 15%",
                        filter: i === avatarIdx ? "none" : "brightness(0.4) grayscale(0.5)",
                        transition: "filter .18s",
                      }}
                    />
                  </button>
                ))}
              </div>

              {/* Model picker */}
              <div style={{ position: "relative" }}>
                <button
                  onClick={() => setShowModelPicker(p => !p)}
                  data-nodrag
                  style={{
                    width: "100%", padding: "6px 10px",
                    borderRadius: 8,
                    background: "rgba(255,255,255,0.04)",
                    border: `0.5px solid ${avatar.color}33`,
                    color: "#f0ede8", fontSize: 11, fontWeight: 600,
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between",
                  }}>
                  <span>{MODELS.find(m => m.id === model)?.icon} {MODELS.find(m => m.id === model)?.label}</span>
                  <span style={{ fontSize: 9, color: "#555" }}>{showModelPicker ? "▲" : "▼"}</span>
                </button>
                {showModelPicker && (
                  <div style={{
                    position: "absolute", bottom: "calc(100% + 4px)", left: 0, right: 0,
                    background: "#0e0f1c", border: `0.5px solid ${avatar.color}33`,
                    borderRadius: 10, overflow: "hidden", zIndex: 10,
                    boxShadow: "0 -8px 32px rgba(0,0,0,0.7)",
                  }}>
                    {MODELS.map(m => (
                      <button
                        key={m.id}
                        onClick={() => { setModel(m.id); setShowModelPicker(false); }}
                        data-nodrag
                        style={{
                          width: "100%", padding: "8px 12px",
                          background: m.id === model ? `${avatar.color}18` : "transparent",
                          border: "none", color: m.id === model ? avatar.color : "#9a9ab0",
                          fontSize: 11, fontWeight: m.id === model ? 700 : 400,
                          cursor: "pointer", textAlign: "left",
                          display: "flex", gap: 8, alignItems: "center",
                        }}>
                        <span>{m.icon}</span><span>{m.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ─ MESSAGES ─ */}
            <div
              className="az-msg-scroll"
              style={{
                flex: 1, overflowY: "auto", padding: "10px 12px",
                display: "flex", flexDirection: "column", gap: 8,
                minHeight: 0,
              }}>
              {messages.map((msg, i) => (
                <div key={i} style={{
                  display: "flex",
                  justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                  gap: 6, alignItems: "flex-end",
                }}>
                  {msg.role === "ai" && (
                    <div style={{ width: 24, height: 30, borderRadius: 6, overflow: "hidden", flexShrink: 0,
                      border: `1px solid ${avatar.color}44` }}>
                      <img src={avatar.img} alt={avatar.label}
                        style={{ width: "100%", height: "100%", objectFit: "cover",
                          objectPosition: avatar.facePos || "50% 15%" }} />
                    </div>
                  )}
                  <div style={{
                    maxWidth: "82%", padding: "8px 11px", borderRadius: 10, fontSize: 12, lineHeight: 1.5,
                    background: msg.role === "user" ? "rgba(74,179,244,0.12)" : "rgba(255,255,255,0.04)",
                    color: "#f0ede8",
                    border: msg.role === "ai"
                      ? `0.5px solid ${avatar.color}33`
                      : "0.5px solid rgba(74,179,244,0.26)",
                    borderBottomRightRadius: msg.role === "user" ? 3 : 10,
                    borderBottomLeftRadius:  msg.role === "ai"  ? 3 : 10,
                  }}>
                    {msg.role === "ai" && (
                      <div style={{ fontSize: 9, color: avatar.color, fontWeight: 700,
                        marginBottom: 3, letterSpacing: ".06em" }}>
                        ◈ {avatar.label.toUpperCase()}
                      </div>
                    )}
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>

            {/* ─ INPUT ─ */}
            <div style={{
              display: "flex", alignItems: "flex-end", gap: 6,
              padding: "8px 10px", borderTop: "1px solid rgba(255,255,255,0.06)",
              flexShrink: 0,
            }}>
              <textarea
                value={input}
                onChange={e => {
                  setInput(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = Math.min(e.target.scrollHeight, 100) + "px";
                }}
                onKeyDown={handleKey}
                placeholder={`Message ${avatar.label}…`}
                rows={1}
                data-nodrag
                style={{
                  flex: 1, resize: "none",
                  background: "rgba(255,255,255,0.05)",
                  border: `1px solid ${avatar.color}33`,
                  borderRadius: 10, color: "#f0ede8",
                  padding: "7px 10px", fontSize: 12,
                  outline: "none", lineHeight: 1.5,
                  maxHeight: 100, overflowY: "auto",
                  fontFamily: "inherit",
                }}
              />
              <button
                onClick={toggleListening}
                data-nodrag
                title={isListening ? "Stop listening" : "Voice input"}
                style={{
                  background: isListening ? avatar.color + "33" : "rgba(255,255,255,0.05)",
                  border: `1px solid ${isListening ? avatar.color : "rgba(255,255,255,0.1)"}`,
                  borderRadius: 8, padding: "7px 9px", cursor: "pointer",
                  color: isListening ? avatar.color : "#888",
                  fontSize: 14, lineHeight: 1, flexShrink: 0,
                }}>
                {isListening ? "⏹" : "🎤"}
              </button>
              <button
                onClick={sendMsg}
                disabled={!input.trim() || loading}
                data-nodrag
                style={{
                  background: avatar.color + "22",
                  border: `1px solid ${avatar.color}66`,
                  borderRadius: 8, padding: "7px 12px", cursor: "pointer",
                  color: avatar.color, fontWeight: 700, fontSize: 13,
                  opacity: !input.trim() || loading ? 0.45 : 1,
                  flexShrink: 0,
                }}>
                {loading ? "…" : "↑"}
              </button>
            </div>

          </div>
        )}
      </div>
    </>
  );
}
