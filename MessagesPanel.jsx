import React, { useState, useEffect, useRef, useCallback } from "react";

const PLATFORMS = [
  { id: "google-voice", label: "Google Voice", short: "GV",  color: "#4285f4", maxAccounts: 1 },
  { id: "messenger",    label: "Messenger",    short: "MSG", color: "#0084ff", maxAccounts: 5 },
  { id: "snapchat",     label: "Snapchat",     short: "SC",  color: "#fffc00", maxAccounts: 5, darkText: true },
  { id: "tiktok",       label: "TikTok",       short: "TT",  color: "#69c9d0", maxAccounts: 5 },
  { id: "instagram",    label: "Instagram",    short: "IG",  color: "#e1306c", maxAccounts: 5 },
  { id: "linkedin",     label: "LinkedIn",     short: "LI",  color: "#0077b5", maxAccounts: 3 },
  { id: "x",            label: "X",            short: "X",   color: "#e2e8f0", maxAccounts: 5 },
  { id: "reddit",       label: "Reddit",       short: "RD",  color: "#ff4500", maxAccounts: 5 },
  { id: "telegram",     label: "Telegram",     short: "TG",  color: "#2ca5e0", maxAccounts: 1 },
  { id: "signal",       label: "Signal",       short: "SIG", color: "#3a76f0", maxAccounts: 1, noWeb: true },
];

const PLATFORM_URLS = {
  "google-voice": "https://voice.google.com/u/0/messages",
  messenger:      "https://www.messenger.com",
  snapchat:       "https://web.snapchat.com",
  tiktok:         "https://www.tiktok.com/messages",
  instagram:      "https://www.instagram.com/direct/inbox/",
  linkedin:       "https://www.linkedin.com/messaging/",
  x:              "https://x.com/messages",
  reddit:         "https://www.reddit.com/message/inbox/",
  telegram:       "https://web.telegram.org/k/",
  signal:         "https://signal.org/download/",
};

// Platforms that support autofill
const AUTOFILL_PLATFORMS = new Set(["messenger","instagram","snapchat","tiktok","linkedin","x","reddit"]);

const LABEL_KEY = "lifeos_messages_accounts";
function loadLabels() { try { return JSON.parse(localStorage.getItem(LABEL_KEY) || "{}"); } catch { return {}; } }
function saveLabels(d) { localStorage.setItem(LABEL_KEY, JSON.stringify(d)); }

const isElectron = typeof window !== "undefined" && !!window.electronAPI?.isElectron;

export default function MessagesPanel() {
  const [activePlatform, setActivePlatform] = useState(PLATFORMS[0].id);
  const [activeAccount,  setActiveAccount]  = useState(0);
  const [labels,         setLabels]         = useState(loadLabels);
  const [viewReady,      setViewReady]      = useState(false);

  // Label editing
  const [editingLabel, setEditingLabel] = useState(null);
  const [labelInput,   setLabelInput]   = useState("");

  // Credentials modal
  const [credModal,    setCredModal]    = useState(null); // { platformId, accountIndex }
  const [credUsername, setCredUsername] = useState("");
  const [credPassword, setCredPassword] = useState("");
  const [credSaved,    setCredSaved]    = useState(false); // has saved password
  const [credShowPass, setCredShowPass] = useState(false);
  const [credSaving,   setCredSaving]   = useState(false);

  const containerRef = useRef(null);
  const roRef        = useRef(null);

  const platform     = PLATFORMS.find(p => p.id === activePlatform) || PLATFORMS[0];
  const accountCount = platform.maxAccounts;
  const canAutofill  = AUTOFILL_PLATFORMS.has(activePlatform);

  function getLabel(pid, idx) {
    return labels?.[pid]?.[idx] || "Account " + (idx + 1);
  }

  function getBounds() {
    if (!containerRef.current) return null;
    const r = containerRef.current.getBoundingClientRect();
    return { x: Math.round(r.left), y: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) };
  }

  const openView = useCallback(async (pid, idx) => {
    if (!isElectron) return;
    const b = getBounds();
    if (!b) return;
    setViewReady(false);
    await window.electronAPI.openPlatform(pid, idx, b);
    setViewReady(true);
  }, []);

  useEffect(() => {
    if (!isElectron) return;
    if (platform.noWeb) { window.electronAPI.hidePlatform(); return; }
    openView(activePlatform, activeAccount);
  }, [activePlatform, activeAccount, openView, platform.noWeb]);

  useEffect(() => () => { if (isElectron) window.electronAPI?.hidePlatform(); }, []);

  useEffect(() => {
    if (!isElectron || !containerRef.current) return;
    roRef.current = new ResizeObserver(() => {
      const b = getBounds();
      if (b) window.electronAPI?.resizePlatform(activePlatform, activeAccount, b);
    });
    roRef.current.observe(containerRef.current);
    return () => roRef.current?.disconnect();
  }, [activePlatform, activeAccount]);

  function switchPlatform(id) {
    if (id === activePlatform) return;
    setActiveAccount(0);
    setActivePlatform(id);
  }

  function nav(action) {
    window.electronAPI?.navigatePlatform(activePlatform, activeAccount, action);
  }

  function saveLabel() {
    const { platformId, accountIndex } = editingLabel;
    const next = { ...labels, [platformId]: { ...(labels[platformId] || {}), [accountIndex]: labelInput.trim() || "Account " + (accountIndex + 1) } };
    setLabels(next); saveLabels(next); setEditingLabel(null);
  }

  function logOut() {
    window.electronAPI?.clearPlatformSession(activePlatform, activeAccount);
    setViewReady(false);
    setTimeout(() => setViewReady(true), 1500);
  }

  // Open credentials modal — load existing username
  async function openCredModal(pid, idx) {
    setCredUsername(""); setCredPassword(""); setCredSaved(false); setCredShowPass(false);
    if (isElectron) {
      const res = await window.electronAPI.getCredentials(pid, idx).catch(() => null);
      if (res) { setCredUsername(res.username || ""); setCredSaved(res.hasSavedPassword || false); }
    }
    setCredModal({ platformId: pid, accountIndex: idx });
  }

  async function saveCredentials() {
    if (!credModal || !credUsername.trim()) return;
    setCredSaving(true);
    await window.electronAPI.saveCredentials(credModal.platformId, credModal.accountIndex, credUsername.trim(), credPassword).catch(() => {});
    setCredSaving(false);
    setCredModal(null);
  }

  async function deleteCredentials() {
    if (!credModal) return;
    await window.electronAPI.deleteCredentials(credModal.platformId, credModal.accountIndex).catch(() => {});
    setCredModal(null);
  }

  async function triggerAutofill() {
    const res = await window.electronAPI.triggerAutofill(activePlatform, activeAccount).catch(() => null);
    if (!res || !res.ok) alert("Autofill: " + (res?.error || "Could not fill — make sure the login page is visible."));
  }

  const S = {
    root:        { display: "flex", flexDirection: "column", height: "100%", background: "#0d0e17", color: "#e2e8f0", fontFamily: "Inter, sans-serif", overflow: "hidden" },
    pBar:        { display: "flex", alignItems: "center", gap: 4, padding: "8px 10px", background: "#11131f", borderBottom: "1px solid #1e2235", overflowX: "auto", flexShrink: 0 },
    pTab:  (p, a) => ({ display: "flex", alignItems: "center", gap: 6, padding: "5px 11px", borderRadius: 8, cursor: "pointer", background: a ? p.color + "22" : "transparent", border: "1px solid " + (a ? p.color : "transparent"), color: a ? p.color : "#8892a4", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", transition: "all 0.15s", flexShrink: 0 }),
    dot:   (c)    => ({ width: 7, height: 7, borderRadius: "50%", background: c, flexShrink: 0 }),
    aBar:        { display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", background: "#0f1120", borderBottom: "1px solid #1e2235", flexShrink: 0 },
    aTab:  (a, c) => ({ padding: "3px 11px", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 500, background: a ? c + "33" : "#1a1e2e", border: "1px solid " + (a ? c : "#2a2f45"), color: a ? c : "#8892a4", transition: "all 0.15s" }),
    navBar:      { display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", background: "#0f1120", borderBottom: "1px solid #1e2235", flexShrink: 0 },
    navBtn:      { background: "#1a1e2e", border: "1px solid #2a2f45", color: "#8892a4", borderRadius: 6, padding: "3px 10px", cursor: "pointer", fontSize: 12 },
    viewArea:    { flex: 1, position: "relative", overflow: "hidden" },
    center:      { position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, color: "#4a5568", textAlign: "center", padding: 40 },
    pill:  (c)    => ({ display: "inline-block", background: c + "22", color: c, border: "1px solid " + c + "44", borderRadius: 20, padding: "4px 14px", fontSize: 12, fontWeight: 600, textDecoration: "none" }),
    overlay:     { position: "fixed", inset: 0, background: "#00000099", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 },
    modal:       { background: "#161928", border: "1px solid #2a2f45", borderRadius: 12, padding: 24, width: 340, display: "flex", flexDirection: "column", gap: 14 },
    label:       { fontSize: 11, color: "#8892a4", marginBottom: 2 },
    inp:         { background: "#0d0e17", border: "1px solid #2a2f45", borderRadius: 8, color: "#e2e8f0", padding: "8px 12px", fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box" },
    row:         { display: "flex", gap: 8 },
    btn:   (p, c) => ({ flex: p ? 1 : "none", padding: "8px 16px", borderRadius: 8, border: "1px solid " + (p ? c : "#2a2f45"), background: p ? c + "22" : "transparent", color: p ? c : "#8892a4", cursor: "pointer", fontSize: 13, fontWeight: 600 }),
    iconBtn:     { background: "none", border: "none", cursor: "pointer", fontSize: 14, padding: "2px 6px", borderRadius: 4 },
  };

  return (
    <div style={S.root}>

      {/* Platform tab bar */}
      <div style={S.pBar}>
        {PLATFORMS.map(p => (
          <div key={p.id} style={S.pTab(p, activePlatform === p.id)} onClick={() => switchPlatform(p.id)}>
            <span style={S.dot(p.color)} />
            {p.label}
          </div>
        ))}
      </div>

      {/* Account sub-tabs */}
      {accountCount > 1 && (
        <div style={S.aBar}>
          <span style={{ fontSize: 11, color: "#4a5568", marginRight: 4 }}>Account:</span>
          {Array.from({ length: accountCount }).map((_, i) => (
            <div
              key={i}
              style={S.aTab(activeAccount === i, platform.color)}
              onClick={() => setActiveAccount(i)}
              onDoubleClick={() => { setEditingLabel({ platformId: platform.id, accountIndex: i }); setLabelInput(getLabel(platform.id, i)); }}
              title="Double-click to rename"
            >
              {getLabel(platform.id, i)}
            </div>
          ))}
          <span style={{ fontSize: 10, color: "#3a3f55", marginLeft: 2 }}>dbl-click to rename</span>
          {isElectron && canAutofill && (
            <button
              style={{ ...S.navBtn, marginLeft: 8, color: platform.color, borderColor: platform.color + "55" }}
              onClick={() => openCredModal(platform.id, activeAccount)}
              title="Save login credentials for autofill"
            >
              {"🔑"} Credentials
            </button>
          )}
          {isElectron && (
            <button
              style={{ ...S.navBtn, marginLeft: "auto", color: "#ff4f5e", borderColor: "#ff4f5e44" }}
              onClick={logOut}
              title="Log out this account slot"
            >
              Log Out
            </button>
          )}
        </div>
      )}

      {/* Single-account credential button */}
      {accountCount === 1 && isElectron && canAutofill && (
        <div style={{ ...S.aBar, justifyContent: "flex-end" }}>
          <button
            style={{ ...S.navBtn, color: platform.color, borderColor: platform.color + "55" }}
            onClick={() => openCredModal(platform.id, 0)}
            title="Save login credentials for autofill"
          >
            {"🔑"} Credentials
          </button>
        </div>
      )}

      {/* Nav bar */}
      {isElectron && !platform.noWeb && (
        <div style={S.navBar}>
          <button style={S.navBtn} onClick={() => nav("back")}>{"<"} Back</button>
          <button style={S.navBtn} onClick={() => nav("forward")}>Forward {">"}</button>
          <button style={S.navBtn} onClick={() => nav("reload")}>Reload</button>
          <button style={S.navBtn} onClick={() => nav("home")}>Home</button>
          {canAutofill && (
            <button
              style={{ ...S.navBtn, color: "#00c896", borderColor: "#00c89655" }}
              onClick={triggerAutofill}
              title="Fill login form with saved credentials"
            >
              Auto-fill
            </button>
          )}
          <span style={{ marginLeft: "auto", fontSize: 11, color: "#4a5568" }}>
            {platform.label}{accountCount > 1 ? " / " + getLabel(platform.id, activeAccount) : ""}
          </span>
        </div>
      )}

      {/* View area */}
      <div style={S.viewArea} ref={containerRef}>
        {platform.noWeb && (
          <div style={S.center}>
            <div style={{ fontSize: 40 }}>{"📱"}</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#e2e8f0" }}>Signal Desktop Required</div>
            <p style={{ fontSize: 13, maxWidth: 320, lineHeight: 1.6 }}>Signal does not have a web interface. Download Signal Desktop to message from your computer.</p>
            <a href="https://signal.org/download/" target="_blank" rel="noreferrer" style={S.pill(platform.color)}>Download Signal Desktop</a>
          </div>
        )}
        {!isElectron && !platform.noWeb && (
          <div style={S.center}>
            <div style={{ fontSize: 36 }}>{"🖥️"}</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#e2e8f0" }}>Open in Desktop App</div>
            <p style={{ fontSize: 13, maxWidth: 340, lineHeight: 1.6 }}>Embedded messaging requires the LifeOS desktop app. Open the platform directly:</p>
            <a href={PLATFORM_URLS[activePlatform]} target="_blank" rel="noreferrer" style={S.pill(platform.color)}>Open {platform.label}</a>
          </div>
        )}
        {isElectron && !platform.noWeb && !viewReady && (
          <div style={{ ...S.center, background: "#0d0e17" }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", border: "3px solid " + platform.color + "44", borderTopColor: platform.color, animation: "spin 0.8s linear infinite" }} />
            <div style={{ fontSize: 13, color: "#4a5568" }}>Loading {platform.label}...</div>
          </div>
        )}
      </div>

      {/* Rename label modal */}
      {editingLabel && (
        <div style={S.overlay} onClick={() => setEditingLabel(null)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Rename Account Slot</div>
            <input style={S.inp} value={labelInput} onChange={e => setLabelInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") saveLabel(); if (e.key === "Escape") setEditingLabel(null); }}
              autoFocus placeholder="e.g. Personal, Business, Brand..." />
            <div style={S.row}>
              <button style={S.btn(false)} onClick={() => setEditingLabel(null)}>Cancel</button>
              <button style={S.btn(true, platform.color)} onClick={saveLabel}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Credentials modal */}
      {credModal && (
        <div style={S.overlay} onClick={() => setCredModal(null)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>
              {"🔑"} Saved Credentials
              <span style={{ fontSize: 11, color: "#4a5568", fontWeight: 400, marginLeft: 8 }}>
                {PLATFORMS.find(p => p.id === credModal.platformId)?.label} / {getLabel(credModal.platformId, credModal.accountIndex)}
              </span>
            </div>
            <p style={{ fontSize: 12, color: "#4a5568", margin: 0, lineHeight: 1.5 }}>
              Credentials are encrypted and stored locally. They are auto-injected into the login form when the platform loads.
            </p>
            <div>
              <div style={S.label}>Username / Email</div>
              <input style={S.inp} value={credUsername} onChange={e => setCredUsername(e.target.value)} placeholder="your@email.com or username" autoFocus />
            </div>
            <div>
              <div style={S.label}>Password {credSaved && !credPassword && <span style={{ color: "#00c896" }}>(saved)</span>}</div>
              <div style={{ position: "relative" }}>
                <input
                  style={{ ...S.inp, paddingRight: 40 }}
                  type={credShowPass ? "text" : "password"}
                  value={credPassword}
                  onChange={e => setCredPassword(e.target.value)}
                  placeholder={credSaved ? "Leave blank to keep existing" : "Enter password"}
                />
                <button
                  style={{ ...S.iconBtn, position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: "#8892a4" }}
                  onClick={() => setCredShowPass(v => !v)}
                  type="button"
                >
                  {credShowPass ? "🙈" : "👁️"}
                </button>
              </div>
            </div>
            <div style={S.row}>
              {credSaved && (
                <button style={{ ...S.btn(false), color: "#ff4f5e", borderColor: "#ff4f5e44" }} onClick={deleteCredentials}>
                  Delete
                </button>
              )}
              <button style={S.btn(false)} onClick={() => setCredModal(null)}>Cancel</button>
              <button
                style={S.btn(true, platform.color)}
                onClick={saveCredentials}
                disabled={credSaving || !credUsername.trim()}
              >
                {credSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{"@keyframes spin { to { transform: rotate(360deg); } }"}</style>
    </div>
  );
}
