// ============================================================
// LoginScreen.jsx — LifeOS1 Authentication
// One-click login for each of Chris's three accounts,
// plus Google account picker and email/password fallback
// ============================================================

import { useState } from "react";
import {
  signInWithGoogle,
  signInWithSpecificEmail,
  signInWithEmail,
  resetPassword,
} from "@/lib/firebase";

const ACCOUNTS = [
  { label: "CEO GPS",     email: "chris@ceogps.com",                   color: "#4ab3f4", icon: "🏢" },
  { label: "Business",   email: "chrisgr33ninc@gmail.com",             color: "#00c896", icon: "💼" },
  { label: "Marketing",  email: "ceogps.marketinggod@gmail.com",        color: "#ff8c42", icon: "📣" },
];

const S = {
  bg:     "#07080f",
  card:   "#0f1020",
  border: "rgba(255,255,255,0.07)",
  text:   "#f0ede8",
  muted:  "#6aaedd",
  purple: "#9b72cf",
};

export default function LoginScreen() {
  const [mode,     setMode]     = useState("accounts"); // "accounts" | "email" | "reset"
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(null); // which button is loading
  const [error,    setError]    = useState("");
  const [resetSent,setResetSent]= useState(false);

  async function loginWithAccount(account) {
    setLoading(account.email);
    setError("");
    try {
      await signInWithSpecificEmail(account.email);
      // onAuthStateChanged in AuthorityContext handles the rest
    } catch (e) {
      setError(e.message?.replace("Firebase: ", "") || "Login failed. Try again.");
    } finally {
      setLoading(null);
    }
  }

  async function loginWithPicker() {
    setLoading("picker");
    setError("");
    try {
      await signInWithGoogle();
    } catch (e) {
      setError(e.message?.replace("Firebase: ", "") || "Login failed.");
    } finally {
      setLoading(null);
    }
  }

  async function loginWithEmailPassword(e) {
    e.preventDefault();
    if (!email || !password) { setError("Enter email and password."); return; }
    setLoading("email");
    setError("");
    try {
      await signInWithEmail(email, password);
    } catch (e) {
      setError(e.message?.replace("Firebase: ", "") || "Login failed.");
    } finally {
      setLoading(null);
    }
  }

  async function sendReset(e) {
    e.preventDefault();
    if (!email) { setError("Enter your email address."); return; }
    setLoading("reset");
    setError("");
    try {
      await resetPassword(email);
      setResetSent(true);
    } catch (e) {
      setError(e.message?.replace("Firebase: ", "") || "Reset failed.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: S.bg, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      <div style={{ width: "100%", maxWidth: 420, padding: "0 20px" }}>

        {/* Logo / header */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ fontSize: 32, fontWeight: 900, color: S.purple, letterSpacing: ".06em", marginBottom: 4 }}>
            LIFE<span style={{ color: S.text }}>OS</span><span style={{ color: "#4ab3f4" }}>1</span>
          </div>
          <div style={{ fontSize: 12, color: S.muted }}>Your personal operating system</div>
        </div>

        <div style={{ background: S.card, border: `0.5px solid ${S.border}`, borderRadius: 16, padding: 28 }}>

          {/* ── One-click account buttons ─────────────────────────────────────── */}
          {mode === "accounts" && (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, color: S.muted, letterSpacing: ".1em", marginBottom: 14 }}>
                SIGN IN AS
              </div>

              {/* Three account buttons */}
              {ACCOUNTS.map(acc => (
                <button
                  key={acc.email}
                  onClick={() => loginWithAccount(acc)}
                  disabled={!!loading}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 12,
                    padding: "13px 16px", marginBottom: 10, borderRadius: 10,
                    background: `${acc.color}0f`, border: `0.5px solid ${acc.color}44`,
                    cursor: loading ? "not-allowed" : "pointer", transition: "all .15s",
                    opacity: loading && loading !== acc.email ? 0.5 : 1,
                  }}
                  onMouseEnter={e => { if (!loading) e.currentTarget.style.background = `${acc.color}1e`; }}
                  onMouseLeave={e => { e.currentTarget.style.background = `${acc.color}0f`; }}
                >
                  <span style={{ fontSize: 20 }}>{acc.icon}</span>
                  <div style={{ flex: 1, textAlign: "left" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: S.text }}>{acc.label}</div>
                    <div style={{ fontSize: 10, color: acc.color }}>{acc.email}</div>
                  </div>
                  <div style={{ fontSize: 11, color: acc.color }}>
                    {loading === acc.email ? "Opening…" : "→"}
                  </div>
                </button>
              ))}

              {/* Divider */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "18px 0" }}>
                <div style={{ flex: 1, height: "0.5px", background: S.border }} />
                <span style={{ fontSize: 10, color: S.muted }}>OR</span>
                <div style={{ flex: 1, height: "0.5px", background: S.border }} />
              </div>

              {/* Google account picker (any account) */}
              <button
                onClick={loginWithPicker}
                disabled={!!loading}
                style={{
                  width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  padding: "11px 16px", marginBottom: 10, borderRadius: 10,
                  background: "rgba(255,255,255,0.04)", border: `0.5px solid ${S.border}`,
                  cursor: loading ? "not-allowed" : "pointer", transition: "all .15s",
                  color: S.muted, fontSize: 12, fontWeight: 600,
                }}
                onMouseEnter={e => { if (!loading) e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                {loading === "picker" ? "Opening account picker…" : "Sign in with a different Google account"}
              </button>

              {/* Email/password link */}
              <button
                onClick={() => { setMode("email"); setError(""); }}
                style={{ width: "100%", padding: "9px", background: "none", border: "none", color: S.muted, fontSize: 11, cursor: "pointer", textDecoration: "underline" }}>
                Sign in with email & password
              </button>
            </>
          )}

          {/* ── Email + password ─────────────────────────────────────────────── */}
          {mode === "email" && (
            <form onSubmit={loginWithEmailPassword}>
              <div style={{ fontSize: 13, fontWeight: 700, color: S.text, marginBottom: 18 }}>Email & Password</div>

              {["Email", "Password"].map((label, i) => (
                <div key={label} style={{ marginBottom: 12 }}>
                  <label style={{ display: "block", fontSize: 10, color: S.muted, marginBottom: 5, fontWeight: 600 }}>{label.toUpperCase()}</label>
                  <input
                    type={i === 1 ? "password" : "email"}
                    value={i === 0 ? email : password}
                    onChange={e => i === 0 ? setEmail(e.target.value) : setPassword(e.target.value)}
                    placeholder={i === 0 ? "you@example.com" : "••••••••"}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `0.5px solid ${S.border}`, background: "#0d0e17", color: S.text, fontSize: 13, outline: "none", boxSizing: "border-box" }}
                  />
                </div>
              ))}

              <button type="submit" disabled={!!loading} style={{ width: "100%", padding: "11px", borderRadius: 8, background: "rgba(74,179,244,0.15)", border: "0.5px solid #4ab3f4", color: "#4ab3f4", fontSize: 13, fontWeight: 700, cursor: "pointer", marginTop: 6 }}>
                {loading === "email" ? "Signing in…" : "Sign In"}
              </button>

              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12 }}>
                <button type="button" onClick={() => { setMode("accounts"); setError(""); }}
                  style={{ background: "none", border: "none", color: S.muted, fontSize: 11, cursor: "pointer" }}>← Back</button>
                <button type="button" onClick={() => { setMode("reset"); setError(""); }}
                  style={{ background: "none", border: "none", color: S.muted, fontSize: 11, cursor: "pointer", textDecoration: "underline" }}>Forgot password?</button>
              </div>
            </form>
          )}

          {/* ── Password reset ────────────────────────────────────────────────── */}
          {mode === "reset" && (
            <form onSubmit={sendReset}>
              <div style={{ fontSize: 13, fontWeight: 700, color: S.text, marginBottom: 8 }}>Reset Password</div>
              <div style={{ fontSize: 11, color: S.muted, marginBottom: 16 }}>Enter your email and we'll send a reset link.</div>
              {resetSent ? (
                <div style={{ padding: "12px", borderRadius: 8, background: "rgba(0,200,150,0.1)", border: "0.5px solid #00c896", color: "#00c896", fontSize: 12, marginBottom: 14 }}>
                  ✓ Reset link sent to {email}. Check your inbox.
                </div>
              ) : (
                <>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com"
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `0.5px solid ${S.border}`, background: "#0d0e17", color: S.text, fontSize: 13, outline: "none", boxSizing: "border-box", marginBottom: 12 }} />
                  <button type="submit" disabled={!!loading}
                    style={{ width: "100%", padding: "11px", borderRadius: 8, background: "rgba(74,179,244,0.15)", border: "0.5px solid #4ab3f4", color: "#4ab3f4", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                    {loading === "reset" ? "Sending…" : "Send Reset Link"}
                  </button>
                </>
              )}
              <button type="button" onClick={() => { setMode("accounts"); setError(""); setResetSent(false); }}
                style={{ width: "100%", marginTop: 10, background: "none", border: "none", color: S.muted, fontSize: 11, cursor: "pointer" }}>← Back to sign in</button>
            </form>
          )}

          {/* Error message */}
          {error && (
            <div style={{ marginTop: 12, padding: "8px 12px", borderRadius: 8, background: "rgba(255,79,94,0.1)", border: "0.5px solid rgba(255,79,94,0.35)", color: "#ff4f5e", fontSize: 11 }}>
              {error}
            </div>
          )}
        </div>

        <div style={{ textAlign: "center", marginTop: 20, fontSize: 10, color: S.muted }}>
          LifeOS1 · Chris Green · Atlanta
        </div>
      </div>
    </div>
  );
}
