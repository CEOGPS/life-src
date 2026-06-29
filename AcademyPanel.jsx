import { useState } from "react";
import { invokeLLMWithAuth } from "@/api/ceogpsclient.jsx";
import { useWorkerAuth } from "@/contexts/WorkerContext";
import Icon from "@/components/lifeos/icons/Icon";

const C = { blue: "#4ab3f4", orange: "#ff8c42", teal: "#00c896", purple: "#8b7fff", pink: "#ff6b9d" };
const card = { background: "#13141f", border: "0.5px solid rgba(255,255,255,0.07)", borderRadius: 12 };

const COURSES = [
  { emoji: "💰", title: "Business Finance Fundamentals", progress: 65, category: "Business" },
  { emoji: "📱", title: "Social Media for Contractors", progress: 30, category: "Marketing" },
  { emoji: "🎸", title: "Guitar – Fingerpicking Mastery", progress: 80, category: "Creative" },
  { emoji: "🧠", title: "AI Tools for Small Business", progress: 10, category: "Tech" },
];

const CATEGORIES = ["All", "Business", "Marketing", "Creative", "Tech", "Life Skills"];

export default function AcademyPanel() {
  const { getToken, isAuthenticated } = useWorkerAuth();
  const [courses, setCourses] = useState(COURSES);
  const [filter, setFilter] = useState("All");
  const [aiResult, setAiResult] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [topic, setTopic] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState("");

  const filtered = courses.filter(c => filter === "All" || c.category === filter);

  async function runAI() {
    const token = await getToken();
    if (!token) {
      setAiResult("Please log in to generate your learning plan.");
      return;
    }
    
    setAiLoading(true);
    setAiResult("");
    
    const result = await invokeLLMWithAuth({
      prompt: `You are an AI learning coach for Chris Green — Atlanta plumber, business owner, musician, and father. Based on his current goals (grow business, improve marketing, master guitar, use AI tools), recommend 5 specific learning resources or micro-lessons for this week. Be specific with titles, formats, and time estimates. Make it feel personal and actionable.`,
      firebaseToken: token
    });
    
    setAiResult(result);
    setAiLoading(false);
  }

  async function generateLesson() {
    if (!topic) return;
    
    const token = await getToken();
    if (!token) {
      setGenResult("Please log in to generate a lesson.");
      return;
    }
    
    setGenerating(true);
    setGenResult("");
    
    const result = await invokeLLMWithAuth({
      prompt: `Create a concise, practical micro-lesson on "${topic}" for Chris Green (plumbing business owner, Atlanta). Format: (1) Key Concept (2-3 sentences), (2) 3 Actionable Steps, (3) Quick Exercise or Practice Drill. Keep total length under 250 words. Make it immediately applicable.`,
      firebaseToken: token
    });
    
    setGenResult(result);
    setGenerating(false);
  }

  return (
    <div style={{ padding: 24, display: "grid", gridTemplateColumns: "1fr 320px", gap: 20 }}>
      {/* Left */}
      <div>
        {/* Filter */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
          {CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setFilter(cat)}
              style={{ padding: "4px 10px", borderRadius: 20, fontSize: 10, fontWeight: 600, cursor: "pointer", border: "0.5px solid", background: filter === cat ? "rgba(74,179,244,0.15)" : "transparent", borderColor: filter === cat ? C.blue : "rgba(255,255,255,0.08)", color: filter === cat ? C.blue : "#6aaedd" }}>
              {cat}
            </button>
          ))}
        </div>

        {/* Courses */}
        <div style={{ fontSize: 13, fontWeight: 600, color: "#f0ede8", marginBottom: 12 }}><Icon name="🎓" size={12} style={{marginRight:6,verticalAlign:"middle"}} />My Learning Tracks</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
          {filtered.map((c, i) => (
            <div key={i} style={{ ...card, padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                <span style={{ fontSize: 24, flexShrink: 0 }}>{c.emoji}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#f0ede8", marginBottom: 2 }}>{c.title}</div>
                  <div style={{ fontSize: 10, color: "#6aaedd" }}>{c.category} · {c.progress}% complete</div>
                </div>
                <button onClick={() => setCourses(cs => cs.map((x, j) => j === i ? { ...x, progress: Math.min(100, x.progress + 10) } : x))}
                  style={{ padding: "5px 12px", borderRadius: 20, background: C.teal + "15", border: "0.5px solid " + C.teal + "44", color: C.teal, fontSize: 10, fontWeight: 600, cursor: "pointer" }}>+10%</button>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
                <div style={{ height: "100%", borderRadius: 3, background: `linear-gradient(90deg,${C.blue},${C.teal})`, width: `${c.progress}%`, transition: "width .3s" }} />
              </div>
            </div>
          ))}
        </div>

        {/* AI Micro-Lesson Generator */}
        <div style={{ fontSize: 13, fontWeight: 600, color: "#f0ede8", marginBottom: 12 }}><Icon name="✦" size={12} style={{marginRight:6,verticalAlign:"middle"}} />AI Micro-Lesson Generator</div>
        <div style={{ ...card, padding: 16 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: genResult ? 12 : 0 }}>
            <input value={topic} onChange={e => setTopic(e.target.value)} onKeyDown={e => e.key === "Enter" && generateLesson()}
              placeholder='e.g. "Closing a sales call" or "Barre chords"'
              style={{ flex: 1, padding: "9px 12px", borderRadius: 8, border: "0.5px solid rgba(255,255,255,0.12)", background: "#0d0e17", color: "#f0ede8", fontSize: 12, outline: "none" }} />
            <button onClick={generateLesson} disabled={generating}
              style={{ padding: "9px 16px", borderRadius: 8, background: "rgba(139,127,255,0.15)", border: "0.5px solid rgba(139,127,255,0.3)", color: C.purple, fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
              {generating ? "◈ Creating..." : "Create Lesson ↗"}
            </button>
          </div>
          {genResult && (
            <div style={{ padding: "12px 14px", borderRadius: 10, background: "rgba(139,127,255,0.05)", border: "0.5px solid rgba(139,127,255,0.2)", fontSize: 13, color: "#c8c8d0", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
              {genResult}
            </div>
          )}
        </div>
      </div>

      {/* Right */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#f0ede8", marginBottom: 12 }}><Icon name="📅" size={12} style={{marginRight:6,verticalAlign:"middle"}} />This Week's Learning Plan</div>
        <button onClick={runAI} disabled={aiLoading}
          style={{ width: "100%", padding: "10px", borderRadius: 10, background: "rgba(74,179,244,0.1)", border: "0.5px solid rgba(74,179,244,0.3)", color: C.blue, fontSize: 12, fontWeight: 600, cursor: "pointer", marginBottom: 12 }}>
          {aiLoading ? "◈ Building Plan..." : "✦ Generate This Week's Plan ↗"}
        </button>
        {(aiResult || aiLoading) && (
          <div style={{ padding: "14px", borderRadius: 10, background: "rgba(74,179,244,0.05)", border: "0.5px solid rgba(74,179,244,0.2)", fontSize: 13, color: "#c8c8d0", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
            {aiLoading ? <span style={{ color: C.blue }}><Icon name="◈" size={12} style={{marginRight:6,verticalAlign:"middle"}} />AgentZero building your plan...</span> : aiResult}
          </div>
        )}

        {/* Stats */}
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#f0ede8", marginBottom: 12 }}><Icon name="📊" size={12} style={{marginRight:6,verticalAlign:"middle"}} />Learning Stats</div>
          {[{ label: "Avg. Progress", val: Math.round(courses.reduce((a, c) => a + c.progress, 0) / courses.length) + "%", color: C.teal },
            { label: "Active Tracks", val: courses.length, color: C.blue },
            { label: "This Week", val: "3.2h", color: C.orange }].map(s => (
            <div key={s.label} style={{ ...card, padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ fontSize: 12, color: "#6aaedd" }}>{s.label}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: s.color }}>{s.val}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}