import { 
  LayoutDashboard, Sliders, MessageSquare, Mail, Calendar,
  Share2, Wallet, Music, Palette, Contact2, Users, Handshake, HeartPulse, GraduationCap, Gamepad2, Dumbbell, BookOpen, BarChart3,
  Contact, FolderKanban, CheckSquare, LineChart, Megaphone, Compass,
  Bot, Swords, Binary, CloudLightning, Send, Terminal, ShieldCheck
} from 'lucide-react';
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/FirebaseAuthContext";
import { getApiKey, saveApiKey } from "@/api/ceogpsclient.jsx";

function LogoSVG() {
  return (
    <img src="/Life-logo.png" alt="LifeOS1" style={{ width: 38, height: 38, objectFit: "contain", display: "block" }} />
  );
}

const menuStructure = [
  {
    category: "CORE",
    items: [
      { name: "Dashboard", icon: <LayoutDashboard className="w-4 h-4" />, id: "dashboard" },
      { name: "Settings", icon: <Sliders className="w-4 h-4" />, id: "settings" },
      { name: "Messages", icon: <MessageSquare className="w-4 h-4" />, id: "messages" },
      { name: "Email", icon: <Mail className="w-4 h-4" />, id: "email" },
      { name: "Calendar", icon: <Calendar className="w-4 h-4" />, id: "calendar" }
    ]
  },
  {
    category: "LIFE",
    items: [
      { name: "Social Hub", icon: <Share2 className="w-4 h-4" />, id: "social" },
      { name: "Finance Hub", icon: <Wallet className="w-4 h-4" />, id: "finance" },
      { name: "Music Hub", icon: <Music className="w-4 h-4" />, id: "music" },
      { name: "Media Hub", icon: <Palette className="w-4 h-4" />, id: "media" },
      { name: "Contacts", icon: <Contact2 className="w-4 h-4" />, id: "contacts" },
      { name: "Family Hub", icon: <Users className="w-4 h-4" />, id: "family" },
      { name: "Community Hub", icon: <Handshake className="w-4 h-4" />, id: "community" },
      { name: "Life Pulse", icon: <HeartPulse className="w-4 h-4" />, id: "pulse" },
      { name: "Academy Hub", icon: <GraduationCap className="w-4 h-4" />, id: "academy" },
      { name: "Entertainment", icon: <Gamepad2 className="w-4 h-4" />, id: "entertainment" },
      { name: "Health Hub", icon: <Dumbbell className="w-4 h-4" />, id: "health" },
      { name: "Journal", icon: <BookOpen className="w-4 h-4" />, id: "journal" },
      { name: "Activity Feed", icon: <BarChart3 className="w-4 h-4" />, id: "activity" }
    ]
  },
  {
    category: "BUSINESS",
    items: [
      { name: "CRM", icon: <Contact className="w-4 h-4" />, id: "crm" },
      { name: "Projects", icon: <FolderKanban className="w-4 h-4" />, id: "projects" },
      { name: "Tasks", icon: <CheckSquare className="w-4 h-4" />, id: "tasks" },
      { name: "KPI Analytics", icon: <LineChart className="w-4 h-4" />, id: "kpi" },
      { name: "Marketing", icon: <Megaphone className="w-4 h-4" />, id: "marketing" },
      { name: "CEO GPS", icon: <Compass className="w-4 h-4" />, id: "ceogps" }
    ]
  },
  {
    category: "AI & SYSTEM",
    items: [
      { name: "AI Hub", icon: <Bot className="w-4 h-4" />, id: "aihub" },
      { name: "Kranos", icon: <Swords className="w-4 h-4" />, id: "kranos" },
      { name: "Erebus AI", icon: <Binary className="w-4 h-4" />, id: "erebus" },
      { name: "CF Agents", icon: <CloudLightning className="w-4 h-4" />, id: "cloudflare" },
      { name: "Telegram", icon: <Send className="w-4 h-4" />, id: "telegram" },
      { name: "Terminal", icon: <Terminal className="w-4 h-4" />, id: "terminal" }
    ]
  }
];

export default function Sidebar({ active, setActive }) {
  const { user: fbUser } = useAuth();
  const [logoPic, setLogoPic] = useState(null);
  const logoRef = useRef(null);

  useEffect(() => {
    let isMounted = true;
    
    const loadLogo = async () => {
      try {
        const pic = await getApiKey("logo_pic");
        if (isMounted && pic) {
          setLogoPic(pic);
        }
      } catch (error) {
        console.warn("Failed to load logo:", error);
      }
    };
    
    loadLogo();
    
    return () => {
      isMounted = false;
    };
  }, []);

  async function handleLogoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result;
        setLogoPic(dataUrl);
        const safe = dataUrl.length > 51200 ? dataUrl.substring(0, 51200) : dataUrl;
        const uid = fbUser?.uid || fbUser?.id;
        await saveApiKey("logo_pic", safe, uid);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.warn("Failed to upload logo:", error);
    }
  }

  return (
    <aside
      style={{
        width: '256px',
        minWidth: '256px',
        maxWidth: '256px',
        height: '100%',
        background: 'linear-gradient(to bottom, #000000, #141414)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '16px',
        zIndex: 20,
        borderRight: '1px solid rgba(255,255,255,0.05)',
        flexShrink: 0,
        flexGrow: 0,
        overflow: 'hidden',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        fontSize: 12,
        color: '#a9a9a9',
      }}
    >
      {/* UPPER NAVIGATION TREE */}
      <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100% - 70px)', minHeight: 0 }}>
        {/* Logo - uploadable (replaces static /Life-logo.png + ShieldCheck) */}
        <div style={{ padding: '0 12px 24px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            onClick={() => logoRef.current?.click()}
            style={{ 
              width: 38, 
              height: 38, 
              borderRadius: 6, 
              overflow: 'hidden', 
              background: '#4b0f0f', 
              border: '1px solid rgba(255,0,13,0.3)', 
              cursor: 'pointer', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              flexShrink: 0,
              transition: 'all .2s',
            }}
            onMouseEnter={e => { 
              e.currentTarget.style.borderColor = 'rgba(255,0,13,0.6)';
              e.currentTarget.style.boxShadow = '0 0 20px rgba(255,0,13,0.15)';
            }}
            onMouseLeave={e => { 
              e.currentTarget.style.borderColor = 'rgba(255,0,13,0.3)';
              e.currentTarget.style.boxShadow = 'none';
            }}
            title="Click to upload custom logo"
          >
            {logoPic ? (
              <img src={logoPic} alt="LifeOS1" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            ) : (
              <ShieldCheck style={{ width: 22, height: 22, color: '#ff000d' }} />
            )}
          </div>
          <span style={{ fontSize: 18, fontWeight: 900, letterSpacing: 3, color: '#ff000d' }}>LifeOS1</span>
          <button
            onClick={() => logoRef.current?.click()}
            style={{ 
              fontSize: 8, 
              padding: '1px 4px', 
              background: 'transparent', 
              border: '0.5px solid var(--b2)', 
              color: 'var(--t3)', 
              borderRadius: 2, 
              cursor: 'pointer', 
              marginLeft: 2,
              transition: 'all .2s',
            }}
            onMouseEnter={e => { 
              e.currentTarget.style.color = 'var(--t1)';
              e.currentTarget.style.borderColor = 'var(--b1)';
            }}
            onMouseLeave={e => { 
              e.currentTarget.style.color = 'var(--t3)';
              e.currentTarget.style.borderColor = 'var(--b2)';
            }}
            title="Upload logo image"
          >
            ↑
          </button>
          <input ref={logoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoUpload} />
        </div>

        {/* SCROLLABLE SECTIONS - forced vertical */}
        <div style={{ 
          flex: 1, 
          minHeight: 0, 
          overflowY: 'auto', 
          paddingRight: 4, 
          display: 'flex', 
          flexDirection: 'column', 
          gap: 22 
        }}>
          {menuStructure.map((section, sIdx) => (
            <div key={sIdx} style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ 
                fontSize: 9, 
                fontWeight: 700, 
                letterSpacing: 1.5, 
                color: '#ff000d', 
                textTransform: 'uppercase', 
                marginBottom: 6, 
                paddingLeft: 12, 
                display: 'block',
                opacity: 0.8,
              }}>
                {section.category}
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {section.items.map((item, iIdx) => {
                  const isActive = active === item.id;
                  return (
                    <button
                      key={iIdx}
                      onClick={() => setActive(item.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        width: '100%',
                        textAlign: 'left',
                        padding: '8px 12px',
                        borderRadius: 8,
                        fontSize: 12,
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        background: isActive ? '#4b0f0f' : 'rgba(255,255,255,0.03)',
                        color: isActive ? '#ff000d' : '#a9a9a9',
                        boxShadow: isActive ? 'inset 0 1px 0 rgba(255,0,13,0.2), 0 2px 8px rgba(255,0,13,0.1)' : 'none',
                      }}
                      onMouseEnter={(e) => { 
                        if (!isActive) {
                          e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                          e.currentTarget.style.color = '#ff000d';
                        }
                      }}
                      onMouseLeave={(e) => { 
                        if (!isActive) {
                          e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                          e.currentTarget.style.color = '#a9a9a9';
                        }
                      }}
                    >
                      <span style={{ 
                        opacity: 0.75, 
                        display: 'flex', 
                        alignItems: 'center',
                        color: isActive ? '#ff000d' : 'inherit',
                        transition: 'color .15s',
                      }}>
                        {item.icon}
                      </span>
                      <span style={{ 
                        fontWeight: isActive ? 600 : 400,
                        letterSpacing: isActive ? '0.02em' : '0',
                      }}>
                        {item.name}
                      </span>
                      {isActive && (
                        <span style={{ 
                          marginLeft: 'auto',
                          width: 4,
                          height: 4,
                          borderRadius: '50%',
                          background: '#ff000d',
                          boxShadow: '0 0 8px rgba(255,0,13,0.6)',
                        }} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* FOOTER PROFILE */}
      <div style={{ 
        height: 52, 
        borderTop: '1px solid rgba(255,255,255,0.05)', 
        paddingTop: 10, 
        display: 'flex', 
        alignItems: 'center', 
        gap: 10, 
        paddingLeft: 4, 
        paddingRight: 4,
        marginTop: 'auto',
      }}>
        <div style={{ 
          width: 34, 
          height: 34, 
          borderRadius: 10, 
          background: '#4b0f0f', 
          border: '1px solid rgba(255,0,13,0.3)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          fontWeight: 700, 
          fontSize: 11, 
          color: '#ff000d', 
          letterSpacing: 1,
          flexShrink: 0,
        }}>
          CG
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <span style={{ 
            fontSize: 12, 
            fontWeight: 600, 
            color: '#f0ede8',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            Chris Green
          </span>
          <span style={{ 
            fontSize: 10, 
            color: '#7c7c7c',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            Admin · Pro
          </span>
        </div>
        <div style={{ 
          marginLeft: 'auto',
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: '#00c896',
          boxShadow: '0 0 8px rgba(0,200,150,0.4)',
          flexShrink: 0,
        }} />
      </div>
    </aside>
  );
}