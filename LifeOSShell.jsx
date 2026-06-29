import React, { useState, useEffect, useRef } from "react";
import Sidebar from "@/components/lifeos/layout/Sidebar";
import Topbar from "@/components/lifeos/layout/Topbar";
import DashboardPanel from "@/components/lifeos/panels/DashboardPanel";
import AIHubPanel from "@/components/lifeos/panels/AIHubPanel";
import SocialPanel from "@/components/lifeos/panels/SocialPanel";
import IntegrationsPanel from "@/components/lifeos/panels/IntegrationsPanel";
import SettingsPanel from "@/components/lifeos/panels/SettingsPanel";
import MessagesPanel from "@/components/lifeos/panels/MessagesPanel_v2";
import CRMPanel from "@/components/lifeos/panels/CRMPanel";
import JournalPanel from "@/components/lifeos/panels/JournalPanel";
import AgentDock from "@/components/lifeos/layout/AgentDock";
import EmailPanel from "@/components/lifeos/panels/EmailPanel";
import FamilyPanel from "@/components/lifeos/panels/FamilyPanel";
import ContactsPanel from "@/components/lifeos/panels/ContactsPanel";
import MarketingPanel from "@/components/lifeos/panels/MarketingPanel";
import AcademyPanel from "@/components/lifeos/panels/AcademyPanel";
import CommunityPanel from "@/components/lifeos/panels/CommunityPanel";
import MediaPanel from "@/components/lifeos/panels/MediaPanel";
import EntertainmentPanel from "@/components/lifeos/panels/EntertainmentPanel";
import CloudflarePanel from "@/components/lifeos/panels/CloudflarePanel";
import ActivityFeedPanel from "@/components/lifeos/panels/ActivityFeedPanel";
import TaskOrchestrationPanel from "@/components/lifeos/panels/TaskOrchestrationPanel";
import TerminalPanel from "@/components/lifeos/panels/TerminalPanel";
import MusicHub from "@/components/lifeos/panels/MusicHub";
import TelegramPanel from "@/components/lifeos/panels/TelegramPanel";
import OAuthConsent from "@/components/lifeos/auth/OAuthConsent";
import ProjectsPanel from "@/components/lifeos/panels/ProjectsPanel";
import CEOGPSPanel from "@/components/lifeos/panels/CEOGPSPanel";
import {
  CalendarPanel, PulsePanel, PlaceholderPanel
} from "@/components/lifeos/panels/OtherPanels";
import FinancePanel from "@/components/lifeos/panels/FinancePanel";
import ErebusPanel from "@/components/lifeos/panels/ErebusPanel";
import KranosPanel from "@/components/lifeos/panels/KranosPanel";
import HealthPanel from "@/components/lifeos/panels/HealthPanel";
import KPIPanelUI from "@/components/lifeos/panels/KPIPanelUI";
import { initTheme } from "@/lib/theme";

initTheme(); // apply saved theme before first paint

class AgentDockSafe extends React.Component {
  constructor(props) { super(props); this.state = { crashed: false, error: null }; }
  componentDidCatch(e) { this.setState({ crashed: true, error: e }); }
  render() {
    if (this.state.crashed) {
      return (
        <div style={{ position:"fixed", bottom:16, right:16, background:"#12131f", border:"1px solid #ff4f5e", borderRadius:8, padding:"10px 14px", color:"#ff4f5e", fontSize:11, fontFamily:"monospace", maxWidth:400, zIndex:9999 }}>
          AgentDock crashed: {String(this.state.error)}
        </div>
      );
    }
    return React.createElement(AgentDock);
  }
}

export default function Home() {
  // Support clean /oauth/consent path for OAuth authorization consent screen (SPA fallback via _redirects)
  if (typeof window !== "undefined" && window.location.pathname === "/oauth/consent") {
    return <OAuthConsent />;
  }

  const [active, setActive] = useState(() => {
    const hash = window.location.hash.replace("#", "").trim();
    if (hash) return hash;
    return localStorage.getItem("lifeos_active_panel") || "dashboard";
  });

  // Interactive dotted grid background (black + red hover dots)
  // Restored and heavily tuned because it was dropped in a previous UI refactor
  // (likely during the move to the current panel/theme/glass system for consistency and theming).
  const canvasRef = useRef(null);
  const mouseRef = useRef({ x: -9999, y: -9999 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    let rafId = null;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let lastMove = Date.now();

    const resize = () => {
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = "100vw";
      canvas.style.height = "100vh";
    };

    const updateMouse = (e) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
      lastMove = Date.now();
    };

    window.addEventListener("resize", resize);
    // Attach to document AND window for the most reliable global tracking
    // (some child elements or React portals can interfere with single listeners)
    document.addEventListener("mousemove", updateMouse, { passive: true });
    window.addEventListener("mousemove", updateMouse, { passive: true });
    resize();

    const DOT_SPACING = 18;   // denser grid for nicer "texture" look
    const BASE_ALPHA = 0.07;  // more visible base dots on black so the grid shows under glass modules
    const HOVER_R = 100;      // generous hover range so it feels responsive

    const draw = () => {
      // Force solid black every frame so the background is always pure black
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const { x: mx, y: my } = mouseRef.current;
      const timeSinceMove = Date.now() - lastMove;
      // After cursor stops moving, the red highlighted grid fades away slowly (~1.2s)
      const moveFade = timeSinceMove > 350 ? Math.max(0, 1 - (timeSinceMove - 350) / 1200) : 1;

      for (let x = DOT_SPACING / 2; x < window.innerWidth; x += DOT_SPACING) {
        for (let y = DOT_SPACING / 2; y < window.innerHeight; y += DOT_SPACING) {
          const dx = x - mx;
          const dy = y - my;
          const dist = Math.hypot(dx, dy);

          let alpha = BASE_ALPHA;
          let r = 1.1;
          let fill = "rgba(140,140,150,";  // faint gray base on black

          if (dist < HOVER_R) {
            const t = Math.pow(1 - dist / HOVER_R, 1.2) * moveFade;
            // Strong lighting up: red dot with large glow so it clearly "lights up" and fades with cursor
            alpha = 0.9 * moveFade;
            r = 1.5 + t * 2.2;
            fill = "rgba(255,0,0,"; // red

            // Large glow for visible lighting effect
            ctx.beginPath();
            ctx.arc(x * dpr, y * dpr, r * dpr * 2.8, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255,0,0,${t * 0.2})`;
            ctx.fill();
          }

          ctx.beginPath();
          ctx.arc(x * dpr, y * dpr, r * dpr, 0, Math.PI * 2);
          ctx.fillStyle = fill + alpha + ")";
          ctx.fill();
        }
      }

      rafId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
      document.removeEventListener("mousemove", updateMouse);
      window.removeEventListener("mousemove", updateMouse);
    };
  }, []);

  useEffect(() => {
    window.location.hash = active;
    localStorage.setItem("lifeos_active_panel", active);
  }, [active]);

  const renderPanel = () => {
    switch (active) {
      case "dashboard":    return <DashboardPanel setActive={setActive} />;
      case "aihub":        return <AIHubPanel />;
      case "pulse":        return <PulsePanel />;
      case "calendar":     return <CalendarPanel />;
      case "messages":     return <MessagesPanel />;
      case "social":       return <SocialPanel />;
      case "crm":          return <CRMPanel />;
      case "finance":      return <FinancePanel />;
      case "integrations": return <IntegrationsPanel />;
      case "settings":     return <SettingsPanel />;
      case "journal":      return <JournalPanel />;
      case "family":       return <FamilyPanel />;
      case "contacts":     return <ContactsPanel setActive={setActive} />;
      case "email":        return <EmailPanel />;
      case "marketing":    return <MarketingPanel />;
      case "academy":      return <AcademyPanel />;
      case "community":    return <CommunityPanel />;
      case "media":        return <MediaPanel />;
      case "entertainment":return <EntertainmentPanel />;
      case "activity":     return <ActivityFeedPanel />;
      case "tasks":        return <TaskOrchestrationPanel />;
      case "cloudflare":   return <CloudflarePanel />;
      case "telegram":     return <TelegramPanel />;
      case "projects":     return <ProjectsPanel />;
      case "ceogps":       return <CEOGPSPanel />;
      case "terminal":     return <TerminalPanel />;
      case "music":        return <MusicHub />;
      case "erebus":       return <ErebusPanel />;
      case "kranos":       return <KranosPanel />;
      case "health":       return <HealthPanel />;
      case "kpi":          return <KPIPanelUI />;
      default:             return <DashboardPanel setActive={setActive} />;
    }
  };

  const noScroll = ["messages","crm","journal","email","contacts","telegram","projects","ceogps","aihub","terminal","tasks","media","erebus","kranos","kpi"].includes(active);

  return (
    <div style={{
      display: "flex",
      flexDirection: "row",
      height: "100vh",
      overflow: "hidden",
      background: "#000000",
      color: "#f0ede8",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      fontSize: 13,
      position: "relative",
      zIndex: 0,
    }}
      onMouseMove={(e) => {
        mouseRef.current = { x: e.clientX, y: e.clientY };
      }}
    >
      {/* Interactive black dotted grid background with red hover (restored + updated) */}
      <canvas
        ref={canvasRef}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          zIndex: -1,
          pointerEvents: "none",
        }}
      />

      <Sidebar active={active} setActive={setActive} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0, position: "relative", zIndex: 1 }}>
        <Topbar active={active} setActive={setActive} harmonyScore={92} />
        <div style={{
          flex: 1,
          overflowY: noScroll ? "hidden" : "auto",
          background: "transparent",
          position: "relative",
          zIndex: 10,
          color: "#f0ede8",
          padding: "0 10px",
        }}>
          {renderPanel()}
        </div>
      </div>
      <AgentDock active={active} setActive={setActive} />
    </div>
  );
}
