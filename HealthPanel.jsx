import { useState, useEffect } from "react";
import { invokeLLM, saveApiKey, getApiKey } from "@/api/ceogpsclient.jsx";

const C = { blue:"#4ab3f4", teal:"#00c896", purple:"#8b7fff", orange:"#ff8c42", red:"#ff4f5e", pink:"#ff6b9d", green:"#4caf50" };
const card = { background:"#13141f", border:"0.5px solid rgba(255,255,255,0.07)", borderRadius:12 };
const inp = { width:"100%", padding:"9px 12px", borderRadius:8, border:"0.5px solid rgba(255,255,255,0.12)", background:"#0d0e17", color:"#f0ede8", fontSize:13, outline:"none", boxSizing:"border-box" };
const btn = (bg, color="#fff") => ({ padding:"8px 18px", borderRadius:8, background:bg, border:"none", color, fontSize:12, fontWeight:600, cursor:"pointer" });

const STORAGE_KEY = "lifeos_health_v1";

const DEFAULT_DATA = {
  // Physical
  weight: "", height: "", age: "", restingHR: "", bloodPressure: "", sleepHours: "",
  // Mental
  moodToday: 7, stressLevel: 4, anxietyLevel: 3, energyLevel: 7, mentalNotes: "",
  // Fitness
  workoutsPerWeek: "", lastWorkout: "", favoriteExercise: "", activeMinutesGoal: "30",
  currentActiveMins: "",
  // Goals
  goals: [
    { id:1, text:"Lose 10 lbs", category:"weight", progress:30, target:"", done:false },
    { id:2, text:"Run 5K without stopping", category:"cardio", progress:0, target:"", done:false },
  ],
  // Log
  log: [],
  // Water / Nutrition
  waterGlasses: 0, waterGoal: 8, calories: "", calorieGoal: "2000",
};

const MOOD_LABELS = { 1:"😞 Terrible", 2:"😔 Bad", 3:"😕 Low", 4:"😐 Meh", 5:"🙂 Okay", 6:"😊 Good", 7:"😄 Great", 8:"🤩 Amazing", 9:"🚀 Excellent", 10:"⚡ On Fire" };
const STRESS_LABELS = { 1:"Zen", 2:"Calm", 3:"Mild", 4:"Moderate", 5:"Elevated", 6:"High", 7:"Very High", 8:"Overwhelmed", 9:"Critical", 10:"Max Stress" };

const TABS = [
  { id:"overview",  icon:"📊", label:"Overview" },
  { id:"mental",    icon:"🧠", label:"Mental" },
  { id:"physical",  icon:"💪", label:"Physical" },
  { id:"fitness",   icon:"🏃", label:"Fitness" },
  { id:"goals",     icon:"🎯", label:"Goals" },
  { id:"ai",        icon:"🤖", label:"AI Coach" },
];

export default function HealthPanel() {
  const [tab, setTab] = useState("overview");
  const [data, setData] = useState(DEFAULT_DATA);
  const [saved, setSaved] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState("");
  const [aiType, setAiType] = useState("");
  const [newGoal, setNewGoal] = useState("");
  const [newGoalCat, setNewGoalCat] = useState("fitness");
  const [logEntry, setLogEntry] = useState("");

  useEffect(() => {
    getApiKey(STORAGE_KEY).then(saved => {
      if (saved) { try { setData(d => ({...d, ...JSON.parse(saved)})); } catch {} }
    });
  }, []);

  async function save(patch) {
    const next = { ...data, ...patch };
    setData(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    await saveApiKey(STORAGE_KEY, JSON.stringify(next));
  }

  function set(field, val) { setData(d => ({...d, [field]: val})); }

  async function runAI(type) {
    setAiType(type); setAiLoading(true); setAiResult("");
    const prompts = {
      tips: `Based on this health profile, give 5 specific, actionable daily tips:
Weight: ${data.weight}lbs, Sleep: ${data.sleepHours}hrs, Mood: ${data.moodToday}/10, Stress: ${data.stressLevel}/10, Energy: ${data.energyLevel}/10
Workouts/week: ${data.workoutsPerWeek}, Water: ${data.waterGlasses}/${data.waterGoal} glasses
Goals: ${data.goals.map(g=>g.text).join(", ")}
Be specific, practical, and motivating. Format as numbered list.`,
      mental: `Give 5 mental wellness strategies for someone with:
Mood: ${data.moodToday}/10, Stress: ${data.stressLevel}/10, Anxiety: ${data.anxietyLevel}/10, Energy: ${data.energyLevel}/10
Notes: ${data.mentalNotes}
Include mindfulness, breathwork, and mindset shifts. Keep it actionable.`,
      workout: `Design a weekly workout plan for someone who:
Works out ${data.workoutsPerWeek}x/week, Likes: ${data.favoriteExercise}
Goal: ${data.goals.filter(g=>!g.done).map(g=>g.text).join(", ")}
Active mins goal: ${data.activeActiveMinsGoal}/day
Include days, exercises, sets/reps, and rest days.`,
      nutrition: `Give a nutrition strategy for:
Calorie goal: ${data.calorieGoal}/day, Current intake: ${data.calories}
Weight goal implied by: ${data.goals.map(g=>g.text).join(", ")}
Include meal timing, macro breakdown, and 3 easy meal ideas.`,
    };
    const res = await invokeLLM({ prompt: prompts[type] || prompts.tips });
    setAiResult(res);
    setAiLoading(false);
  }

  function addGoal() {
    if (!newGoal.trim()) return;
    const goal = { id: Date.now(), text: newGoal.trim(), category: newGoalCat, progress: 0, done: false };
    save({ goals: [...data.goals, goal] });
    setNewGoal("");
  }

  function updateGoalProgress(id, progress) {
    save({ goals: data.goals.map(g => g.id === id ? {...g, progress: Number(progress)} : g) });
  }

  function toggleGoal(id) {
    save({ goals: data.goals.map(g => g.id === id ? {...g, done: !g.done} : g) });
  }

  function deleteGoal(id) {
    save({ goals: data.goals.filter(g => g.id !== id) });
  }

  function addLog() {
    if (!logEntry.trim()) return;
    const entry = { id: Date.now(), text: logEntry, date: new Date().toLocaleDateString(), time: new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}) };
    save({ log: [entry, ...(data.log||[])].slice(0,50) });
    setLogEntry("");
  }

  const SectionLabel = ({ text }) => (
    <div style={{ fontSize:10, color:"#555", fontWeight:700, letterSpacing:".08em", marginBottom:10, marginTop:4 }}>{text}</div>
  );

  const Slider = ({ label, field, max=10, color=C.teal, getLabel }) => (
    <div style={{ marginBottom:16 }}>
      <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"#aaa", marginBottom:6 }}>
        <span>{label}</span>
        <span style={{ color, fontWeight:600 }}>{getLabel ? getLabel(data[field]) : `${data[field]}/${max}`}</span>
      </div>
      <input type="range" min={1} max={max} value={data[field]}
        onChange={e => set(field, Number(e.target.value))}
        style={{ width:"100%", accentColor:color }} />
    </div>
  );

  const Field = ({ label, field, type="text", placeholder="" }) => (
    <div style={{ marginBottom:14 }}>
      <label style={{ display:"block", fontSize:11, color:"#6aaedd", marginBottom:5, fontWeight:600 }}>{label}</label>
      <input type={type} value={data[field]||""} placeholder={placeholder}
        onChange={e => set(field, e.target.value)} style={inp} />
    </div>
  );

  // ── OVERVIEW ──────────────────────────────────────────────────────────────
  const renderOverview = () => (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))", gap:12, marginBottom:20 }}>
        {[
          { label:"Mood", value: MOOD_LABELS[data.moodToday]?.split(" ")[0] || "😄", sub:`${data.moodToday}/10`, color:C.teal },
          { label:"Stress", value:`${data.stressLevel}/10`, sub:STRESS_LABELS[data.stressLevel], color: data.stressLevel > 6 ? C.red : data.stressLevel > 4 ? C.orange : C.teal },
          { label:"Energy", value:`${data.energyLevel}/10`, sub:"Energy level", color:C.blue },
          { label:"Sleep", value:`${data.sleepHours||"—"}h`, sub:"Last night", color:C.purple },
          { label:"Water", value:`${data.waterGlasses}/${data.waterGoal}`, sub:"Glasses today", color:C.blue },
          { label:"Weight", value:data.weight ? `${data.weight} lbs` : "—", sub:"Current", color:C.orange },
        ].map(({ label, value, sub, color }) => (
          <div key={label} style={{ ...card, padding:14, textAlign:"center" }}>
            <div style={{ fontSize:22, fontWeight:700, color, marginBottom:4 }}>{value}</div>
            <div style={{ fontSize:11, color:"#f0ede8", fontWeight:600 }}>{label}</div>
            <div style={{ fontSize:10, color:"#555", marginTop:2 }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Water tracker */}
      <div style={{ ...card, padding:16, marginBottom:16 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
          <div style={{ fontSize:13, fontWeight:600, color:"#f0ede8" }}>💧 Water Today</div>
          <div style={{ fontSize:12, color:C.blue }}>{data.waterGlasses} / {data.waterGoal} glasses</div>
        </div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:10 }}>
          {Array.from({length: Number(data.waterGoal)||8}).map((_,i) => (
            <div key={i} onClick={() => save({ waterGlasses: i < data.waterGlasses ? i : i+1 })}
              style={{ width:32, height:32, borderRadius:8, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16,
                background: i < data.waterGlasses ? "rgba(74,179,244,0.25)" : "rgba(255,255,255,0.05)",
                border: `0.5px solid ${i < data.waterGlasses ? C.blue : "rgba(255,255,255,0.1)"}` }}>
              💧
            </div>
          ))}
        </div>
        <div style={{ height:4, background:"rgba(255,255,255,0.06)", borderRadius:2 }}>
          <div style={{ height:"100%", width:`${Math.min(100,(data.waterGlasses/data.waterGoal)*100)}%`, background:C.blue, borderRadius:2, transition:"width .3s" }} />
        </div>
      </div>

      {/* Active goals summary */}
      {data.goals.filter(g=>!g.done).length > 0 && (
        <div style={{ ...card, padding:16 }}>
          <div style={{ fontSize:13, fontWeight:600, color:"#f0ede8", marginBottom:12 }}>🎯 Active Goals</div>
          {data.goals.filter(g=>!g.done).slice(0,3).map(g => (
            <div key={g.id} style={{ marginBottom:12 }}>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"#aaa", marginBottom:4 }}>
                <span>{g.text}</span><span style={{ color:C.teal }}>{g.progress}%</span>
              </div>
              <div style={{ height:4, background:"rgba(255,255,255,0.06)", borderRadius:2 }}>
                <div style={{ height:"100%", width:`${g.progress}%`, background:`linear-gradient(90deg,${C.teal},${C.blue})`, borderRadius:2 }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // ── MENTAL ────────────────────────────────────────────────────────────────
  const renderMental = () => (
    <div>
      <div style={{ ...card, padding:20, marginBottom:16 }}>
        <SectionLabel text="TODAY'S CHECK-IN" />
        <Slider label="Mood" field="moodToday" color={C.teal} getLabel={v => MOOD_LABELS[v]} />
        <Slider label="Stress Level" field="stressLevel" color={data.stressLevel>6?C.red:data.stressLevel>4?C.orange:C.teal} getLabel={v => `${v}/10 — ${STRESS_LABELS[v]}`} />
        <Slider label="Anxiety Level" field="anxietyLevel" color={data.anxietyLevel>6?C.red:C.purple} getLabel={v => `${v}/10`} />
        <Slider label="Energy Level" field="energyLevel" color={C.blue} getLabel={v => `${v}/10`} />
        <div style={{ marginBottom:14 }}>
          <label style={{ display:"block", fontSize:11, color:"#6aaedd", marginBottom:5, fontWeight:600 }}>Mental Notes</label>
          <textarea value={data.mentalNotes||""} onChange={e => set("mentalNotes", e.target.value)}
            placeholder="What's on your mind today? Any wins, worries, or reflections..."
            rows={3} style={{ ...inp, resize:"vertical", fontFamily:"inherit" }} />
        </div>
        <button onClick={() => save({})} style={btn("rgba(0,200,150,0.2)", C.teal)}>
          {saved ? "✓ Saved" : "Save Check-In"}
        </button>
      </div>

      {/* Quick log */}
      <div style={{ ...card, padding:16 }}>
        <SectionLabel text="QUICK LOG" />
        <div style={{ display:"flex", gap:8, marginBottom:10 }}>
          <input value={logEntry} onChange={e => setLogEntry(e.target.value)}
            onKeyDown={e => e.key==="Enter" && addLog()}
            placeholder="Log a mental health moment..." style={{ ...inp, flex:1 }} />
          <button onClick={addLog} style={btn("rgba(74,179,244,0.2)", C.blue)}>Add</button>
        </div>
        {(data.log||[]).slice(0,5).map(entry => (
          <div key={entry.id} style={{ padding:"8px 10px", borderRadius:7, background:"rgba(255,255,255,0.03)", marginBottom:6 }}>
            <div style={{ fontSize:12, color:"#f0ede8" }}>{entry.text}</div>
            <div style={{ fontSize:10, color:"#555", marginTop:2 }}>{entry.date} {entry.time}</div>
          </div>
        ))}
      </div>
    </div>
  );

  // ── PHYSICAL ──────────────────────────────────────────────────────────────
  const renderPhysical = () => (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
      <div style={{ ...card, padding:20 }}>
        <SectionLabel text="VITALS" />
        <Field label="Weight (lbs)" field="weight" type="number" placeholder="175" />
          <Field label="Height" field="height" placeholder="5ft 10in" />
        <Field label="Age" field="age" type="number" placeholder="38" />
        <Field label="Resting Heart Rate (bpm)" field="restingHR" type="number" placeholder="65" />
        <Field label="Blood Pressure" field="bloodPressure" placeholder="120/80" />
        <Field label="Sleep Hours (last night)" field="sleepHours" type="number" placeholder="7.5" />
        <button onClick={() => save({})} style={{ ...btn("rgba(0,200,150,0.2)", C.teal), marginTop:4 }}>
          {saved ? "✓ Saved" : "Save Vitals"}
        </button>
      </div>

      <div>
        <div style={{ ...card, padding:20, marginBottom:16 }}>
          <SectionLabel text="NUTRITION" />
          <Field label="Daily Calorie Goal" field="calorieGoal" type="number" placeholder="2000" />
          <Field label="Today's Calories" field="calories" type="number" placeholder="1800" />
          {data.calories && data.calorieGoal && (
            <div style={{ marginTop:8 }}>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"#aaa", marginBottom:4 }}>
                <span>Calories</span>
                <span style={{ color: Number(data.calories) > Number(data.calorieGoal) ? C.red : C.teal }}>
                  {data.calories} / {data.calorieGoal}
                </span>
              </div>
              <div style={{ height:6, background:"rgba(255,255,255,0.06)", borderRadius:3 }}>
                <div style={{ height:"100%", width:`${Math.min(100,(Number(data.calories)/Number(data.calorieGoal))*100)}%`,
                  background: Number(data.calories) > Number(data.calorieGoal) ? C.red : C.teal, borderRadius:3 }} />
              </div>
            </div>
          )}
        </div>

        <div style={{ ...card, padding:20 }}>
          <SectionLabel text="WATER GOAL" />
          <Field label="Daily Water Goal (glasses)" field="waterGoal" type="number" placeholder="8" />
          <button onClick={() => save({})} style={btn("rgba(74,179,244,0.2)", C.blue)}>
            {saved ? "✓ Saved" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );

  // ── FITNESS ───────────────────────────────────────────────────────────────
  const renderFitness = () => (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
      <div style={{ ...card, padding:20 }}>
        <SectionLabel text="WORKOUT HABITS" />
        <Field label="Workouts Per Week" field="workoutsPerWeek" type="number" placeholder="4" />
        <Field label="Last Workout" field="lastWorkout" type="date" />
        <Field label="Favorite Exercise" field="favoriteExercise" placeholder="Running, lifting, yoga..." />
        <Field label="Daily Active Minutes Goal" field="activeMinutesGoal" type="number" placeholder="30" />
        <Field label="Active Minutes Today" field="currentActiveMins" type="number" placeholder="0" />
        {data.currentActiveMins && data.activeMinutesGoal && (
          <div style={{ marginTop:4 }}>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"#aaa", marginBottom:4 }}>
              <span>Active Minutes</span>
              <span style={{ color:C.teal }}>{data.currentActiveMins} / {data.activeMinutesGoal} min</span>
            </div>
            <div style={{ height:6, background:"rgba(255,255,255,0.06)", borderRadius:3 }}>
              <div style={{ height:"100%", width:`${Math.min(100,(Number(data.currentActiveMins)/Number(data.activeMinutesGoal))*100)}%`,
                background:C.teal, borderRadius:3 }} />
            </div>
          </div>
        )}
        <button onClick={() => save({})} style={{ ...btn("rgba(0,200,150,0.2)", C.teal), marginTop:14 }}>
          {saved ? "✓ Saved" : "Save Fitness Data"}
        </button>
      </div>

      <div style={{ ...card, padding:20 }}>
        <SectionLabel text="QUICK WORKOUT LOG" />
        <div style={{ display:"flex", gap:8, marginBottom:10 }}>
          <input value={logEntry} onChange={e => setLogEntry(e.target.value)}
            onKeyDown={e => e.key==="Enter" && addLog()}
            placeholder="e.g. 30 min run, 5K in 28min..." style={{ ...inp, flex:1 }} />
          <button onClick={addLog} style={btn("rgba(0,200,150,0.2)", C.teal)}>+</button>
        </div>
        {(data.log||[]).slice(0,8).map(entry => (
          <div key={entry.id} style={{ padding:"7px 10px", borderRadius:7, background:"rgba(255,255,255,0.03)", marginBottom:6 }}>
            <div style={{ fontSize:12, color:"#f0ede8" }}>{entry.text}</div>
            <div style={{ fontSize:10, color:"#555", marginTop:2 }}>{entry.date}</div>
          </div>
        ))}
      </div>
    </div>
  );

  // ── GOALS ─────────────────────────────────────────────────────────────────
  const renderGoals = () => (
    <div>
      <div style={{ ...card, padding:16, marginBottom:16 }}>
        <SectionLabel text="ADD NEW GOAL" />
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          <input value={newGoal} onChange={e => setNewGoal(e.target.value)}
            onKeyDown={e => e.key==="Enter" && addGoal()}
            placeholder="e.g. Run a 5K, Meditate daily, Lose 10 lbs..."
            style={{ ...inp, flex:"1 1 200px" }} />
          <select value={newGoalCat} onChange={e => setNewGoalCat(e.target.value)}
            style={{ ...inp, flex:"0 0 130px" }}>
            {["fitness","weight","mental","nutrition","sleep","cardio","strength","flexibility","other"].map(c => (
              <option key={c} value={c}>{c.charAt(0).toUpperCase()+c.slice(1)}</option>
            ))}
          </select>
          <button onClick={addGoal} style={btn("linear-gradient(135deg,#4ab3f4,#8b7fff)")}>+ Add Goal</button>
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:12 }}>
        {data.goals.map(g => (
          <div key={g.id} style={{ ...card, padding:16, opacity: g.done ? 0.5 : 1 }}>
            <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:10 }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:600, color: g.done ? "#555" : "#f0ede8",
                  textDecoration: g.done ? "line-through" : "none", marginBottom:4 }}>{g.text}</div>
                <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10,
                  background:"rgba(74,179,244,0.15)", color:C.blue }}>{g.category}</span>
              </div>
              <div style={{ display:"flex", gap:4, marginLeft:8 }}>
                <button onClick={() => toggleGoal(g.id)} title={g.done?"Mark incomplete":"Mark done"}
                  style={{ background:"none", border:`0.5px solid ${g.done?C.teal:"rgba(255,255,255,0.1)"}`, borderRadius:6, color:g.done?C.teal:"#555", cursor:"pointer", fontSize:14, padding:"2px 6px" }}>
                  {g.done?"✓":"○"}
                </button>
                <button onClick={() => deleteGoal(g.id)}
                  style={{ background:"none", border:"none", color:"#ff4f5e44", cursor:"pointer", fontSize:16, padding:"2px 4px" }}
                  onMouseEnter={e=>e.currentTarget.style.color="#ff4f5e"}
                  onMouseLeave={e=>e.currentTarget.style.color="#ff4f5e44"}>×</button>
              </div>
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"#aaa", marginBottom:6 }}>
              <span>Progress</span><span style={{ color:C.teal, fontWeight:600 }}>{g.progress}%</span>
            </div>
            <input type="range" min={0} max={100} value={g.progress}
              onChange={e => updateGoalProgress(g.id, e.target.value)}
              style={{ width:"100%", accentColor:C.teal, marginBottom:6 }} />
            <div style={{ height:4, background:"rgba(255,255,255,0.05)", borderRadius:2 }}>
              <div style={{ height:"100%", width:`${g.progress}%`, background:`linear-gradient(90deg,${C.teal},${C.blue})`, borderRadius:2, transition:"width .3s" }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // ── AI COACH ─────────────────────────────────────────────────────────────
  const renderAI = () => (
    <div>
      <div style={{ ...card, padding:20, marginBottom:16 }}>
        <div style={{ fontSize:14, fontWeight:700, color:"#f0ede8", marginBottom:6 }}>🤖 AI Health Coach</div>
        <div style={{ fontSize:12, color:"#666", marginBottom:20 }}>
          Powered by your health data — get personalized tips, workout plans, and mental wellness strategies.
        </div>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
          {[
            { type:"tips",      icon:"💡", label:"Daily Health Tips",     color:C.teal   },
            { type:"mental",    icon:"🧠", label:"Mental Wellness Plan",  color:C.purple },
            { type:"workout",   icon:"🏋️", label:"Workout Plan",          color:C.blue   },
            { type:"nutrition", icon:"🥗", label:"Nutrition Strategy",    color:C.orange },
          ].map(({ type, icon, label, color }) => (
            <button key={type} onClick={() => runAI(type)} disabled={aiLoading}
              style={{ padding:"10px 18px", borderRadius:10, fontSize:12, fontWeight:600, cursor:aiLoading?"wait":"pointer",
                background:`${color}18`, border:`0.5px solid ${color}55`, color,
                boxShadow: aiLoading && aiType===type ? `0 0 12px ${color}44` : "none" }}>
              {aiLoading && aiType===type ? "⟳ Thinking..." : `${icon} ${label}`}
            </button>
          ))}
        </div>
      </div>

      {aiResult && (
        <div style={{ ...card, padding:20 }}>
          <div style={{ fontSize:11, fontWeight:700, color:C.blue, letterSpacing:".05em", marginBottom:12 }}>
            ◈ AI HEALTH COACH — {aiType==="tips"?"DAILY TIPS":aiType==="mental"?"MENTAL WELLNESS":aiType==="workout"?"WORKOUT PLAN":"NUTRITION STRATEGY"}
          </div>
          <div style={{ fontSize:13, color:"#e2e8f0", lineHeight:1.8, whiteSpace:"pre-wrap" }}>{aiResult}</div>
        </div>
      )}
    </div>
  );

  return (
    <div style={{ padding:24, height:"100%", overflowY:"auto", background:"#0d0e17", color:"#f0ede8", fontFamily:"Inter,sans-serif" }}>
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
        <div>
          <div style={{ fontSize:20, fontWeight:700 }}>🏃 Health & Fitness Hub</div>
          <div style={{ fontSize:12, color:"#555", marginTop:2 }}>Mind, body, and performance — tracked and coached by AI</div>
        </div>
        <button onClick={() => save({})} style={btn("rgba(0,200,150,0.15)", C.teal)}>
          {saved ? "✓ Saved!" : "Save All"}
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", gap:6, marginBottom:24, flexWrap:"wrap" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ padding:"7px 16px", borderRadius:20, fontSize:12, fontWeight:600, cursor:"pointer",
              background: tab===t.id ? "rgba(74,179,244,0.15)" : "rgba(255,255,255,0.04)",
              border: `0.5px solid ${tab===t.id ? C.blue : "rgba(255,255,255,0.08)"}`,
              color: tab===t.id ? C.blue : "#666" }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab==="overview"  && renderOverview()}
      {tab==="mental"    && renderMental()}
      {tab==="physical"  && renderPhysical()}
      {tab==="fitness"   && renderFitness()}
      {tab==="goals"     && renderGoals()}
      {tab==="ai"        && renderAI()}
    </div>
  );
}
