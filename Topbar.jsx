import { useState, useRef, useEffect } from "react";
import { saveApiKey, getApiKey } from "@/api/ceogpsclient.jsx";
import { useAuth } from "@/lib/FirebaseAuthContext";
import { signInWithSpecificEmail, firebaseSignOut } from "@/lib/firebase";

const PANEL_TITLES = {
  dashboard:"Dashboard", agent:"AgentZero", aimodels:"AI Models", pulse:"Life Pulse",
  calendar:"Calendar", messages:"Messages", family:"Family Hub", journal:"Journal",
  people:"People", crm:"CRM & Leads", finance:"Finance", email:"Email & CRM",
  events:"Events", invoicing:"Invoicing", marketing:"Marketing", social:"Social Hub",
  academy:"Academy", community:"Community", media:"Media Studio",
  entertainment:"Entertainment Hub", integrations:"Integrations Hub",
  cloudflare:"Cloudflare Agents", terminal:"Terminal", settings:"Settings",
  aihub:"AI Hub", tasks:"Tasks", projects:"Projects", ceogps:"CEO GPS",
  contacts:"Contacts", telegram:"Telegram", music:"Music Hub", activity:"Activity",
};

// Chris's three accounts — all available for one-click switching
const MY_ACCOUNTS = [
  { label: "CEO GPS",   email: "chris@ceogps.com",                color: "#4ab3f4", icon: "🏢" },
  { label: "Business",  email: "chrisgr33ninc@gmail.com",          color: "#00c896", icon: "💼" },
  { label: "Marketing", email: "ceogps.marketinggod@gmail.com",    color: "#ff8c42", icon: "📣" },
];

const S = {
  menu: {
    position:"absolute", top:44, right:0, zIndex:9000, minWidth:230,
    overflow:"hidden",
    background: "rgba(10, 10, 12, 0.55)",
    backdropFilter: "blur(12px) saturate(180%)",
    WebkitBackdropFilter: "blur(12px) saturate(180%)",
    border: "1px solid rgba(255, 255, 255, 0.15)",
    boxShadow: "0 8px 32px 0 rgba(31, 38, 135, 0.37), inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -1px 0 rgba(0,0,0,0.4)",
  },
  menuItem: {
    display:"flex", alignItems:"center", gap:10, padding:"11px 16px",
    cursor:"pointer", fontSize:12, color:"var(--t1)",
    borderBottom:"0.5px solid rgba(255,255,255,0.06)",
    transition: "background .1s",
  },
};

export default function Topbar({ active, setActive, harmonyScore }) {
  const { user, logout } = useAuth();
  const [menuOpen,     setMenuOpen]     = useState(false);
  const [profilePic,   setProfilePic]   = useState(null);
  const [profileName,  setProfileName]  = useState("Chris Green");
  const [editingName,  setEditingName]  = useState(false);
  const [nameInput,    setNameInput]    = useState("");
  const [switching,    setSwitching]    = useState(null);
  const fileRef = useRef(null);
  const menuRef = useRef(null);

  // Load saved profile
  useEffect(() => {
    getApiKey("profile_name").then(v => { if (v) setProfileName(v); });
    getApiKey("profile_pic").then(v => { if (v) setProfilePic(v); });
  }, []);

  // Listen for profile pic updates from other components (e.g. dashboard banner upload)
  useEffect(() => {
    const handler = (e) => {
      if (e.detail) setProfilePic(e.detail);
    };
    window.addEventListener('profilePicUpdated', handler);
    return () => window.removeEventListener('profilePicUpdated', handler);
  }, []);

  // Load avatar from Firebase user if no saved pic
  useEffect(() => {
    if (user?.avatar && !profilePic) setProfilePic(user.avatar);
    if (user?.name && profileName === "Chris Green") setProfileName(user.name);
  }, [user]);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const h = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [menuOpen]);

  async function handlePicUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result;
      setProfilePic(dataUrl);
      const safe = dataUrl.length > 51200 ? dataUrl.substring(0, 51200) : dataUrl;
      const uid = user?.uid || user?.id;
      await saveApiKey("profile_pic", safe, uid);
    };
    reader.readAsDataURL(file);
  }

  async function saveName() {
    if (!nameInput.trim()) return;
    setProfileName(nameInput.trim());
    const uid = user?.uid || user?.id;
    await saveApiKey("profile_name", nameInput.trim(), uid);
    setEditingName(false);
  }

  async function switchToAccount(account) {
    setSwitching(account.email);
    try {
      await signInWithSpecificEmail(account.email);
      setMenuOpen(false);
    } catch (e) {
      console.error("Switch failed:", e);
    } finally {
      setSwitching(null);
    }
  }

  async function handleLogout() {
    setMenuOpen(false);
    await firebaseSignOut();
    if (logout) logout();
  }

  const activeEmail = user?.email || "chris@ceogps.com";
  const initials = (profileName || "").trim().split(/\s+/).map(w => w[0]||'').join('').slice(0,2).toUpperCase();

  return (
    <>
      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.2; }
        }
      `}</style>
      <div style={{
        padding:"0 20px", height:52,
        display:"flex", alignItems:"center", justifyContent:"flex-end",
        flexShrink:0,
        borderBottom: "none",
        background: "linear-gradient(to right, #000000, #141414)",
      }}>

        {/* Right - no logo section */}
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          {/* Thin notifications module with blinking alert - dashboard card style */}
          <div style={{ 
            display:"flex", alignItems:"center", gap:3, padding:"1px 5px", fontSize:9, 
            color:"var(--t3)", background:"rgba(255,255,255,0.05)", borderRadius:3
          }}>
            <span>🔔</span>
            <span>4</span>
            <div style={{ width:3, height:3, background:"var(--crimson)", borderRadius:"50%", animation: "blink 1s infinite" }} />
          </div>

          {/* AI Hub - match dashboard button / panel accent (crimson for command theme) */}
          <button onClick={() => setActive("aihub")} style={{
            padding:"6px 14px", borderRadius:20, background:"color-mix(in srgb, var(--crimson) 12%, transparent)",
            cursor:"pointer",
            fontSize:11, fontWeight:600, color:"var(--crimson)",
            transition: "all .15s",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "color-mix(in srgb, var(--crimson) 20%, transparent)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "color-mix(in srgb, var(--crimson) 12%, transparent)"; }}
          >🤖 AI Hub</button>

          {/* Avatar with dropdown */}
          <div ref={menuRef} style={{ position:"relative" }}>
            <div onClick={() => setMenuOpen(o => !o)} style={{
              width:34, height:34, borderRadius:"50%", overflow:"hidden",
              background:"linear-gradient(135deg,#4ab3f4,#ff8c42)",
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:12, fontWeight:700, color:"#0d0e17", cursor:"pointer",
              border: "none",
              boxShadow: "none",
              transition:"all .2s", flexShrink:0,
            }}>
              {profilePic
                ? <img src={profilePic} alt="Profile" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                : initials}
            </div>

            {menuOpen && (
              <div style={S.menu}>
                {/* Profile header - dashboard card style */}
                <div style={{ padding:"14px 16px", borderBottom:"0.5px solid var(--b2)",
                  display:"flex", alignItems:"center", gap:12, background:"rgba(255,255,255,0.03)" }}>
                  <div style={{ width:42, height:42, borderRadius:"50%", overflow:"hidden", flexShrink:0,
                    background:"linear-gradient(135deg,#4ab3f4,#ff8c42)",
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:14, fontWeight:700, color:"var(--bg2)" }}>
                    {profilePic
                      ? <img src={profilePic} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                      : initials}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    {editingName ? (
                      <div style={{ display:"flex", gap:4 }}>
                        <input value={nameInput} onChange={e => setNameInput(e.target.value)}
                          onKeyDown={e => e.key === "Enter" && saveName()}
                          autoFocus
                          style={{ flex:1, background:"rgba(255,255,255,0.08)", border:"0.5px solid rgba(74,179,244,0.4)",
                            borderRadius:5, padding:"3px 6px", color:"#f0ede8", fontSize:12, outline:"none" }} />
                        <button onClick={saveName} style={{ padding:"2px 8px", borderRadius:5,
                          background:"#4ab3f4", border:"none", color:"#000", fontSize:11, cursor:"pointer" }}>✓</button>
                      </div>
                    ) : (
                      <div style={{ fontSize:13, fontWeight:600, color:"#f0ede8", cursor:"pointer" }}
                        onClick={() => { setNameInput(profileName); setEditingName(true); }}>
                        {profileName} <span style={{ fontSize:10 }}>✏️</span>
                      </div>
                    )}
                    <div style={{ fontSize:10, color:"#4ab3f4", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      {activeEmail}
                    </div>
                  </div>
                </div>

                {/* Account switcher — one button per email */}
                <div style={{ padding:"8px 16px 4px" }}>
                  <div style={{ fontSize:8, fontWeight:700, color:"#444", letterSpacing:".1em", marginBottom:6 }}>SWITCH ACCOUNT</div>
                  {MY_ACCOUNTS.map(acc => {
                    const isActive = activeEmail === acc.email;
                    return (
                      <button key={acc.email} onClick={() => !isActive && switchToAccount(acc)} style={{
                        width:"100%", display:"flex", alignItems:"center", gap:8,
                        padding:"7px 10px", marginBottom:4, borderRadius:8,
                        background: isActive ? "color-mix(in srgb, var(--crimson) 12%, transparent)" : "rgba(255,255,255,0.03)",
                        border:`0.5px solid ${isActive ? "var(--crimson)" : "rgba(255,255,255,0.1)"}`,
                        cursor: isActive ? "default" : "pointer",
                        transition:"all .15s", textAlign:"left",
                      }}>
                        <span style={{ fontSize:14 }}>{acc.icon}</span>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:11, fontWeight:600, color: isActive ? acc.color : "#c8c8d0" }}>{acc.label}</div>
                          <div style={{ fontSize:9, color:"#555", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{acc.email}</div>
                        </div>
                        {isActive
                          ? <span style={{ fontSize:9, color:acc.color, fontWeight:700 }}>●</span>
                          : <span style={{ fontSize:10, color:"#444" }}>{switching === acc.email ? "…" : "→"}</span>}
                      </button>
                    );
                  })}
                </div>

                <div style={{ height:"0.5px", background:"rgba(255,255,255,0.06)", margin:"4px 0" }} />

                {/* Upload photo */}
                <div style={S.menuItem} onClick={() => { fileRef.current?.click(); setMenuOpen(false); }}>
                  <span>📷</span><span>Change Profile Photo</span>
                </div>
                <input ref={fileRef} type="file" accept="image/*" style={{ display:"none" }} onChange={handlePicUpload} />

                {/* Nav items */}
                {[
                  ["⚙️", "Settings",       "settings"],
                  ["📊", "Dashboard",       "dashboard"],
                ].map(([icon, label, panel]) => (
                  <div key={panel} style={S.menuItem} onClick={() => { setActive(panel); setMenuOpen(false); }}>
                    <span>{icon}</span><span>{label}</span>
                  </div>
                ))}

                <div style={{ ...S.menuItem, color:"#ff4f5e", borderBottom:"none" }} onClick={handleLogout}>
                  <span>🔓</span><span>Sign Out</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
