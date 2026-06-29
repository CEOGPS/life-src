import { useState, useRef, useEffect } from "react";
import { invokeLLM } from "@/api/ceogpsclient.jsx";
import { kvGet, kvSet } from "@/utils/storage";
import Icon from "@/components/lifeos/icons/Icon";

const KV_QUEUE = "tasks_queue";
const KV_BACKLOG = "tasks_backlog";

const C = { blue: "#4ab3f4", orange: "#ff8c42", teal: "#00c896", purple: "#8b7fff", pink: "#ff6b9d", red: "#ff4f5e" };
const card = { background: "#13141f", border: "0.5px solid rgba(255,255,255,0.07)", borderRadius: 12 };

const SOURCE_ICON = { stripe: "💳", github: "📂", gmail: "📬", crm: "👥", agent: "🤖", system: "⚡", calendar: "🗓", slack: "💬" };
const SOURCE_COLOR = { stripe: "#635bff", github: "#f0ede8", gmail: "#ea4335", crm: C.orange, agent: C.purple, system: C.teal, calendar: "#4285f4", slack: "#4a154b" };

const PRIORITY_COLOR = { high: C.red, medium: C.orange, low: C.teal };
const PRIORITY_BG    = { high: "rgba(255,79,94,0.12)", medium: "rgba(255,140,66,0.12)", low: "rgba(0,200,150,0.12)" };

const MODULE_COLOR = { CRM: C.orange, Email: "#ea4335", Terminal: "#f0ede8", Calendar: "#4285f4", Agent: C.purple, Finance: C.teal };

let idSeq = Date.now();

export default function TaskOrchestrationPanel() {
  const [queueTasks, setQueueTasks] = useState([]);
  const [backlog, setBacklog]       = useState([]);
  const [loaded, setLoaded]         = useState(false);
  const [newTitle, setNewTitle]     = useState("");
  const [newModule, setNewModule]   = useState("CRM");
  const [newPriority, setNewPriority] = useState("medium");
  const [aiLoading, setAiLoading]   = useState(false);
  const [aiResult, setAiResult]     = useState("");

  // Load persisted tasks once. No mock seeding — an empty board stays empty.
  useEffect(() => {
    Promise.all([kvGet(KV_QUEUE), kvGet(KV_BACKLOG)]).then(([q, b]) => {
      if (Array.isArray(q)) setQueueTasks(q);
      if (Array.isArray(b)) setBacklog(b);
      setLoaded(true);
    });
  }, []);

  // Persist on change (only after the initial load, so we never overwrite with []).
  useEffect(() => { if (loaded) kvSet(KV_QUEUE, queueTasks); }, [queueTasks, loaded]);
  useEffect(() => { if (loaded) kvSet(KV_BACKLOG, backlog); }, [backlog, loaded]);

  // Drag state
  const dragItem   = useRef(null); // { list: "queue"|"backlog", index }
  const dragTarget = useRef(null);

  // ── Drag handlers ──────────────────────────────────────────────────────────
  function onDragStart(list, index) { dragItem.current = { list, index }; }
  function onDragEnter(list, index) { dragTarget.current = { list, index }; }

  function onDrop() {
    const src = dragItem.current;
    const tgt = dragTarget.current;
    if (!src || !tgt) return;
    if (src.list === tgt.list && src.index === tgt.index) return;

    const srcList = src.list === "queue" ? [...queueTasks] : [...backlog];
    const tgtList = tgt.list === "queue" ? [...queueTasks] : [...backlog];

    const [moved] = srcList.splice(src.index, 1);

    if (src.list === tgt.list) {
      srcList.splice(tgt.index, 0, moved);
      src.list === "queue" ? setQueueTasks(srcList) : setBacklog(srcList);
    } else {
      tgtList.splice(tgt.index, 0, moved);
      if (src.list === "queue") { setQueueTasks(srcList); setBacklog(tgtList); }
      else                      { setBacklog(srcList);    setQueueTasks(tgtList); }
    }

    dragItem.current = null;
    dragTarget.current = null;
  }

  function addToQueue(list, setList, index) {
    // Move from backlog → queue or vice versa
    const item = list[index];
    const rest = list.filter((_, i) => i !== index);
    if (list === backlog) { setBacklog(rest); setQueueTasks(q => [item, ...q]); }
    else                  { setQueueTasks(rest); setBacklog(b => [item, ...b]); }
  }

  function toggleDone(id) {
    setQueueTasks(q => q.map(t => t.id === id ? { ...t, done: !t.done } : t));
  }

  function deleteTask(list, setList, id) {
    setList(list.filter(t => t.id !== id));
  }

  function addManual() {
    if (!newTitle.trim()) return;
    const t = { id: idSeq++, title: newTitle, module: newModule, priority: newPriority, done: false, source: null };
    setQueueTasks(q => [t, ...q]);
    setNewTitle("");
  }

  async function runAISchedule() {
    setAiLoading(true);
    setAiResult("");
    const taskList = queueTasks.filter(t => !t.done).slice(0, 10).map((t, i) => `${i + 1}. [${t.priority}] ${t.title} (${t.module})`).join("\n");
    const result = await invokeLLM({
      prompt: `You are AgentZero scheduling the day for Chris Green (plumbing business owner, Atlanta).
Priority queue tasks:
${taskList}

Suggest the optimal execution order for today, grouping by context (calls, desk work, follow-ups). Estimate time per task. Flag any that should be delegated. Keep it under 150 words, formatted clearly.`
    });
    setAiResult(result);
    setAiLoading(false);
  }

  const doneCt  = queueTasks.filter(t => t.done).length;
  const highCt  = queueTasks.filter(t => t.priority === "high" && !t.done).length;

  const inputStyle = { padding: "8px 10px", borderRadius: 8, border: "0.5px solid rgba(255,255,255,0.12)", background: "#0d0e17", color: "#f0ede8", fontSize: 12, outline: "none" };

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16, height: "calc(100vh - 52px)", overflow: "hidden" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexShrink: 0 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#f0ede8" }}>Task Orchestration</div>
          <div style={{ fontSize: 12, color: "#6aaedd", marginTop: 2 }}>Auto-tasks from integrations · drag to reorder · AI daily schedule</div>
        </div>
        <button onClick={runAISchedule} disabled={aiLoading}
          style={{ padding: "8px 16px", borderRadius: 20, background: "rgba(139,127,255,0.12)", border: "0.5px solid rgba(139,127,255,0.3)", color: C.purple, fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
          {aiLoading ? "◈ Scheduling..." : "✦ AI Schedule Day"}
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, flexShrink: 0 }}>
        {[
          { label: "In Queue",   val: queueTasks.length,  color: C.blue    },
          { label: "Urgent",     val: highCt,              color: C.red     },
          { label: "Completed",  val: doneCt,              color: C.teal    },
          { label: "Backlog",    val: backlog.length,      color: "#6aaedd" },
        ].map(s => (
          <div key={s.label} style={{ ...card, padding: "12px 14px", textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.val}</div>
            <div style={{ fontSize: 10, color: "#6aaedd" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* AI result */}
      {(aiResult || aiLoading) && (
        <div style={{ ...card, padding: 14, flexShrink: 0, background: "rgba(139,127,255,0.06)", border: "0.5px solid rgba(139,127,255,0.2)" }}>
          <div style={{ fontSize: 10, color: C.purple, fontWeight: 700, marginBottom: 6, letterSpacing: ".05em" }}><Icon name="◈" size={12} style={{marginRight:6,verticalAlign:"middle"}} />AGENT ZERO — DAILY SCHEDULE</div>
          <div style={{ fontSize: 13, color: "#c8c8d0", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
            {aiLoading ? <span style={{ color: C.purple }}><Icon name="◈" size={12} style={{marginRight:6,verticalAlign:"middle"}} />Building your optimal schedule...</span> : aiResult}
          </div>
        </div>
      )}

      {/* Add task bar */}
      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        <input value={newTitle} onChange={e => setNewTitle(e.target.value)} onKeyDown={e => e.key === "Enter" && addManual()}
          placeholder="Add task manually..."
          style={{ ...inputStyle, flex: 1 }} />
        <select value={newModule} onChange={e => setNewModule(e.target.value)} style={{ ...inputStyle, width: 100 }}>
          {["CRM","Email","Finance","Calendar","Agent","Terminal"].map(m => <option key={m}>{m}</option>)}
        </select>
        <select value={newPriority} onChange={e => setNewPriority(e.target.value)} style={{ ...inputStyle, width: 90 }}>
          {["high","medium","low"].map(p => <option key={p}>{p}</option>)}
        </select>
        <button onClick={addManual}
          style={{ padding: "8px 16px", borderRadius: 8, background: "rgba(74,179,244,0.12)", border: "0.5px solid rgba(74,179,244,0.3)", color: C.blue, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
          + Add
        </button>
      </div>

      {/* Two-column layout */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 340px", gap: 16, overflow: "hidden" }}>

        {/* Priority Queue */}
        <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.blue, letterSpacing: ".07em", textTransform: "uppercase", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: C.blue, display: "inline-block" }} />
            Priority Queue — drag to reorder
          </div>
          <div
            style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}
            onDragOver={e => e.preventDefault()}
            onDrop={onDrop}
          >
            {queueTasks.length === 0 && (
              <div style={{ textAlign: "center", color: "#2a6fa8", padding: 40, fontSize: 13 }}>Drop tasks here or add manually above.</div>
            )}
            {queueTasks.map((task, index) => (
              <TaskCard
                key={task.id}
                task={task}
                index={index}
                list="queue"
                onDragStart={onDragStart}
                onDragEnter={onDragEnter}
                onDrop={onDrop}
                onToggleDone={() => toggleDone(task.id)}
                onDelete={() => deleteTask(queueTasks, setQueueTasks, task.id)}
                onMove={() => addToQueue(queueTasks, setQueueTasks, index)}
                moveLabel="→ Backlog"
              />
            ))}
          </div>
        </div>

        {/* Backlog */}
        <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#6aaedd", letterSpacing: ".07em", textTransform: "uppercase", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#6aaedd", display: "inline-block" }} />
            Backlog
          </div>
          <div
            style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}
            onDragOver={e => e.preventDefault()}
            onDrop={onDrop}
          >
            {backlog.length === 0 && (
              <div style={{ textAlign: "center", color: "#2a6fa8", padding: 40, fontSize: 13 }}>Drag tasks here to defer them.</div>
            )}
            {backlog.map((task, index) => (
              <TaskCard
                key={task.id}
                task={task}
                index={index}
                list="backlog"
                onDragStart={onDragStart}
                onDragEnter={onDragEnter}
                onDrop={onDrop}
                onToggleDone={() => {}}
                onDelete={() => deleteTask(backlog, setBacklog, task.id)}
                onMove={() => addToQueue(backlog, setBacklog, index)}
                moveLabel="↑ Queue"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function TaskCard({ task, index, list, onDragStart, onDragEnter, onDrop, onToggleDone, onDelete, onMove, moveLabel }) {
  const [dragging, setDragging] = useState(false);
  const src = task.source;
  const srcColor = src ? (SOURCE_COLOR[src.source] || C.blue) : C.blue;
  const srcIcon  = src ? (SOURCE_ICON[src.source]  || "⚡")   : "✏";

  return (
    <div
      draggable
      onDragStart={() => { setDragging(true);  onDragStart(list, index); }}
      onDragEnd={() => setDragging(false)}
      onDragEnter={() => onDragEnter(list, index)}
      onDragOver={e => e.preventDefault()}
      onDrop={onDrop}
      style={{
        ...card,
        padding: "11px 13px",
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
        cursor: "grab",
        opacity: dragging ? 0.4 : task.done ? 0.55 : 1,
        borderLeft: `2px solid ${PRIORITY_COLOR[task.priority]}`,
        transition: "all .15s",
        userSelect: "none",
      }}>

      {/* Drag handle */}
      <div style={{ color: "#2a6fa8", fontSize: 14, paddingTop: 1, flexShrink: 0, cursor: "grab" }}>⠿</div>

      {/* Done checkbox */}
      <button onClick={onToggleDone}
        style={{ width: 16, height: 16, borderRadius: 4, border: `1.5px solid ${task.done ? C.teal : "rgba(255,255,255,0.2)"}`, background: task.done ? C.teal : "transparent", flexShrink: 0, cursor: "pointer", marginTop: 2, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {task.done && <Icon name="✓" size={10} />}
      </button>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: task.done ? "#2a6fa8" : "#f0ede8", textDecoration: task.done ? "line-through" : "none", marginBottom: 4, lineHeight: 1.4 }}>
          {task.title}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          {/* Priority badge */}
          <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 20, background: PRIORITY_BG[task.priority], color: PRIORITY_COLOR[task.priority], fontWeight: 700 }}>
            {task.priority.toUpperCase()}
          </span>
          {/* Module badge */}
          <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 20, background: (MODULE_COLOR[task.module] || C.blue) + "18", color: MODULE_COLOR[task.module] || C.blue, fontWeight: 600 }}>
            {task.module}
          </span>
          {/* Source badge */}
          {src && (
            <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 20, background: srcColor + "15", color: srcColor, fontWeight: 600 }}>
              {srcIcon} auto
            </span>
          )}
        </div>
        {/* Source event preview */}
        {src && (
          <div style={{ fontSize: 10, color: "#2a6fa8", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            ↳ {src.title}: {src.body}
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
        <button onClick={onMove}
          style={{ fontSize: 9, padding: "3px 7px", borderRadius: 6, background: "rgba(74,179,244,0.1)", border: "0.5px solid rgba(74,179,244,0.2)", color: C.blue, cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap" }}>
          {moveLabel}
        </button>
        <button onClick={onDelete}
          style={{ fontSize: 9, padding: "3px 7px", borderRadius: 6, background: "rgba(255,79,94,0.08)", border: "0.5px solid rgba(255,79,94,0.15)", color: C.red, cursor: "pointer" }}><Icon name="✕" size={14} /></button>
      </div>
    </div>
  );
}