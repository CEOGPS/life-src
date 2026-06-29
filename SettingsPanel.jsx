import { useState, useEffect, useRef } from "react";
import { getProfile, saveProfile, uploadFile } from "@/utils/storage";
import Icon from "@/components/lifeos/icons/Icon";
import IntegrationsPanel from "@/components/lifeos/panels/IntegrationsPanel";
import { THEMES, getActiveTheme, applyTheme } from "@/lib/theme";

// Updated colors to match new theme
const C = {
    red: "hsl(355 100% 50%)",        // #ff000d
    darkred: "hsl(0 100% 25%)",       // #800000
    darkerred: "hsl(0 67% 18%)",      // #4b0f0f
    glow: "hsl(355 100% 60%)",        // accent-glow
    highlight: "hsl(0 0% 85%)",       // metallic-highlight
    foreground: "hsl(0 0% 94%)",      // #f0f0f0
    muted: "hsl(0 0% 70%)",           // #7c7c7c
    muteddark: "hsl(0 0% 30%)",       // #4d4d4d
    border: "hsl(0 0% 20%)",
    input: "hsl(0 0% 15%)",
    card: "hsl(0 0% 8%)",             // #141414
    background: "hsl(0 0% 0%)"        // #000000
};

const card = {
    background: "hsl(0 0% 8%)",        // #141414
    border: "0.5px solid hsl(0 100% 25%)", // #800000
    borderRadius: 12
};

const TABS = [
    { id: "profile", icon: "👤", label: "Profile" },
    { id: "notifications", icon: "🔔", label: "Notifications" },
    { id: "integrations", icon: "🔗", label: "Integrations" },
    { id: "privacy", icon: "🔒", label: "Privacy Vault" },
    { id: "ai", icon: "🧠", label: "AI Settings" },
    { id: "appearance", icon: "🎨", label: "Appearance" },
];

const fieldStyle = {
    width: "100%",
    padding: "9px 12px",
    fontSize: 13,
    borderRadius: 8,
    border: "0.5px solid hsl(0 0% 20%)",  // --border
    background: "hsl(0 0% 0%)",            // --background
    color: "hsl(0 0% 94%)",               // --foreground
    outline: "none",
    boxSizing: "border-box"
};

const addBtnStyle = {
    fontSize: 11,
    color: "hsl(355 100% 50%)",            // --primary
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: "2px 0"
};

const removeBtnStyle = {
    background: "none",
    border: "none",
    color: "hsl(355 100% 50%)",            // --primary
    cursor: "pointer",
    fontSize: 20,
    padding: "0 4px",
    flexShrink: 0
};

// Hoisted to module scope — defining this inside SettingsPanel re-created the
// component on every keystroke, remounting the inputs and dropping focus (bug 13).
function MultiRows({ values, onChange, type = "text", placeholder = "" }) {
    return (
        <>
            {values.map((v, i) => (
                <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                    <input
                        type={type}
                        value={v}
                        placeholder={placeholder}
                        onChange={e => { const n = [...values]; n[i] = e.target.value; onChange(n); }}
                        style={fieldStyle}
                    />
                    {values.length > 1 && (
                        <button onClick={() => onChange(values.filter((_, j) => j !== i))} style={removeBtnStyle}>×</button>
                    )}
                </div>
            ))}
        </>
    );
}

export default function SettingsPanel() {
    const [tab, setTab] = useState("profile");
    const [profile, setProfile] = useState({
        name: "Chris Green",
        email: "chris@ceogps.com",
        location: "Atlanta, GA",
        profession: "Business Owner / CEO GPS",
        phone: "",
        bio: "",
        avatarUrl: "",
        extraPhones: [],
        extraEmails: [],
        websites: [],
        socials: {
            instagram: "",
            twitter: "",
            linkedin: "",
            facebook: "",
            tiktok: "",
            youtube: ""
        }
    });
    const [saved, setSaved] = useState(false);
    const [saving, setSaving] = useState(false);
    const [avatarPreview, setAvatarPreview] = useState(null);
    const [theme, setTheme] = useState(getActiveTheme());
    const fileRef = useRef();

    function pickTheme(id) { setTheme(applyTheme(id)); }

    useEffect(() => {
        getProfile().then(p => {
            if (p && Object.keys(p).length) setProfile(prev => ({ ...prev, ...p }));
            if (p?.avatarUrl) setAvatarPreview(p.avatarUrl);
            const localAvatar = localStorage.getItem("lifeos_avatar");
            if (!p?.avatarUrl && localAvatar) setAvatarPreview(localAvatar);
        });
    }, []);

    async function handleSave() {
        setSaving(true);
        await saveProfile(profile);
        setSaving(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
    }

    async function handleAvatarChange(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = r => setAvatarPreview(r.target.result);
        reader.readAsDataURL(file);
        const url = await uploadFile(file, "avatar");
        setProfile(p => ({ ...p, avatarUrl: url }));
    }

    return (
        <div style={{
            padding: 24,
            display: "flex",
            gap: 20,
            height: "calc(100vh - 52px)",
            overflow: "hidden",
            background: "hsl(0 0% 0%)",        // --background
            color: "hsl(0 0% 94%)"            // --foreground
        }}>
            {/* Sidebar */}
            <div style={{ width: 170, flexShrink: 0 }}>
                {TABS.map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "9px 12px",
                            borderRadius: 8,
                            cursor: "pointer",
                            fontSize: 12,
                            width: "100%",
                            textAlign: "left",
                            border: "none",
                            marginBottom: 3,
                            transition: "all .15s",
                            background: tab === t.id ? "hsl(0 100% 25%)" : "transparent",  // --primary-dark
                            color: tab === t.id ? "hsl(0 0% 100%)" : "hsl(0 0% 70%)",      // --primary-foreground / --muted-foreground
                            fontWeight: tab === t.id ? 600 : 400,
                            borderLeft: tab === t.id ? "2px solid hsl(355 100% 50%)" : "2px solid transparent"  // --primary
                        }}>
                        <span style={{ fontSize: 14 }}>{t.icon}</span>{t.label}
                    </button>
                ))}
            </div>

            {/* Content — Integrations renders the full panel edge-to-edge; others use a padded card */}
            <div style={{
                flex: 1,
                ...card,
                padding: tab === "integrations" ? 0 : 24,
                overflowY: "auto",
                display: "flex",
                flexDirection: "column"
            }}>

                {tab === "integrations" && (
                    <div style={{ flex: 1, minHeight: 0 }}>
                        <IntegrationsPanel />
                    </div>
                )}

                {tab === "profile" && (
                    <div>
                        <div style={{
                            fontSize: 15,
                            fontWeight: 700,
                            color: "hsl(0 0% 94%)",  // --foreground
                            marginBottom: 20
                        }}>Profile</div>

                        {/* Avatar */}
                        <div style={{ display: "flex", gap: 16, marginBottom: 24, alignItems: "center" }}>
                            <div style={{ position: "relative", cursor: "pointer" }} onClick={() => fileRef.current?.click()}>
                                {avatarPreview
                                    ? <img src={avatarPreview} alt="avatar" style={{
                                        width: 72,
                                        height: 72,
                                        borderRadius: "50%",
                                        objectFit: "cover",
                                        border: "2px solid hsl(355 100% 50%)"  // --primary
                                    }} />
                                    : <div style={{
                                        width: 72,
                                        height: 72,
                                        borderRadius: "50%",
                                        background: "linear-gradient(135deg, hsl(355 100% 50%), hsl(0 100% 25%))",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontSize: 26,
                                        fontWeight: 800,
                                        color: "hsl(0 0% 100%)"  // --primary-foreground
                                    }}>
                                        {profile.name?.[0] || "C"}
                                    </div>
                                }
                                <div style={{
                                    position: "absolute",
                                    bottom: 0,
                                    right: 0,
                                    width: 22,
                                    height: 22,
                                    borderRadius: "50%",
                                    background: "hsl(355 100% 50%)",  // --primary
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: 11
                                }}>
                                    <Icon name="📷" size={14} />
                                </div>
                            </div>
                            <div>
                                <div style={{
                                    fontSize: 14,
                                    fontWeight: 600,
                                    color: "hsl(355 100% 50%)",  // --primary
                                    marginBottom: 2
                                }}>
                                    {profile.name}
                                </div>
                                <div style={{
                                    fontSize: 12,
                                    color: "hsl(0 0% 70%)",  // --muted-foreground
                                    marginBottom: 6
                                }}>
                                    {profile.profession}
                                </div>
                                <button onClick={() => fileRef.current?.click()}
                                    style={{
                                        padding: "5px 12px",
                                        borderRadius: 20,
                                        background: "hsla(355 100% 50%, 0.2)",  // --primary with opacity
                                        color: "hsl(355 100% 50%)",  // --primary
                                        fontSize: 11,
                                        fontWeight: 600,
                                        cursor: "pointer",
                                        border: "0.5px solid hsl(355 100% 50%)"  // --primary
                                    }}>
                                    Change Photo
                                </button>
                                <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatarChange} style={{ display: "none" }} />
                            </div>
                        </div>

                        {/* Basic fields */}
                        {[["Full Name", "name"], ["Location", "location"], ["Profession", "profession"]].map(([label, key]) => (
                            <div key={key} style={{ marginBottom: 14 }}>
                                <label style={{
                                    display: "block",
                                    fontSize: 11,
                                    color: "hsl(0 0% 70%)",  // --muted-foreground
                                    marginBottom: 5,
                                    fontWeight: 600
                                }}>
                                    {label}
                                </label>
                                <input value={profile[key] || ""} onChange={e => setProfile(p => ({ ...p, [key]: e.target.value }))} style={fieldStyle} />
                            </div>
                        ))}

                        {/* Phone */}
                        <div style={{ marginBottom: 14 }}>
                            <label style={{
                                display: "block",
                                fontSize: 11,
                                color: "hsl(0 0% 70%)",  // --muted-foreground
                                marginBottom: 5,
                                fontWeight: 600
                            }}>
                                Phone
                            </label>
                            <MultiRows
                                type="tel"
                                placeholder="(555) 000-0000"
                                values={[profile.phone || "", ...(profile.extraPhones || [])]}
                                onChange={vals => setProfile(p => ({ ...p, phone: vals[0] || "", extraPhones: vals.slice(1) }))} />
                            <button onClick={() => setProfile(p => ({ ...p, extraPhones: [...(p.extraPhones || []), ""] }))} style={addBtnStyle}>+ Add Phone</button>
                        </div>

                        {/* Email */}
                        <div style={{ marginBottom: 14 }}>
                            <label style={{
                                display: "block",
                                fontSize: 11,
                                color: "hsl(0 0% 70%)",  // --muted-foreground
                                marginBottom: 5,
                                fontWeight: 600
                            }}>
                                Email
                            </label>
                            <MultiRows
                                type="email"
                                placeholder="email@example.com"
                                values={[profile.email || "", ...(profile.extraEmails || [])]}
                                onChange={vals => setProfile(p => ({ ...p, email: vals[0] || "", extraEmails: vals.slice(1) }))} />
                            <button onClick={() => setProfile(p => ({ ...p, extraEmails: [...(p.extraEmails || []), ""] }))} style={addBtnStyle}>+ Add Email</button>
                        </div>

                        {/* Websites */}
                        <div style={{ marginBottom: 14 }}>
                            <label style={{
                                display: "block",
                                fontSize: 11,
                                color: "hsl(0 0% 70%)",  // --muted-foreground
                                marginBottom: 5,
                                fontWeight: 600
                            }}>
                                Websites
                            </label>
                            <MultiRows
                                type="url"
                                placeholder="https://..."
                                values={profile.websites || []}
                                onChange={vals => setProfile(p => ({ ...p, websites: vals }))} />
                            <button onClick={() => setProfile(p => ({ ...p, websites: [...(p.websites || []), ""] }))} style={addBtnStyle}>+ Add Website</button>
                        </div>

                        {/* Socials */}
                        <div style={{ marginBottom: 14 }}>
                            <label style={{
                                display: "block",
                                fontSize: 11,
                                color: "hsl(0 0% 70%)",  // --muted-foreground
                                marginBottom: 8,
                                fontWeight: 600
                            }}>
                                Socials
                            </label>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                                {[["📸 Instagram", "instagram"], ["🐦 X / Twitter", "twitter"], ["💼 LinkedIn", "linkedin"],
                                ["📘 Facebook", "facebook"], ["🎵 TikTok", "tiktok"], ["▶️ YouTube", "youtube"]].map(([lbl, key]) => (
                                    <div key={key}>
                                        <label style={{
                                            display: "block",
                                            fontSize: 10,
                                            color: "hsl(0 0% 30%)",  // --muted
                                            marginBottom: 4
                                        }}>
                                            {lbl}
                                        </label>
                                        <input value={profile.socials?.[key] || ""} placeholder="@handle or URL"
                                            onChange={e => setProfile(p => ({ ...p, socials: { ...(p.socials || {}), [key]: e.target.value } }))}
                                            style={{ ...fieldStyle, fontSize: 12 }} />
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Bio */}
                        <div style={{ marginBottom: 20 }}>
                            <label style={{
                                display: "block",
                                fontSize: 11,
                                color: "hsl(0 0% 70%)",  // --muted-foreground
                                marginBottom: 5,
                                fontWeight: 600
                            }}>
                                Bio
                            </label>
                            <textarea value={profile.bio || ""} onChange={e => setProfile(p => ({ ...p, bio: e.target.value }))} rows={3}
                                style={{ ...fieldStyle, resize: "vertical", fontFamily: "inherit" }} />
                        </div>

                        <button onClick={handleSave} disabled={saving}
                            style={{
                                padding: "10px 28px",
                                background: saved ? "hsla(355 100% 50%, 0.15)" : "hsla(355 100% 50%, 0.15)",
                                border: "0.5px solid " + (saved ? "hsl(355 100% 60%)" : "hsl(355 100% 50%)"),
                                borderRadius: 8,
                                fontSize: 13,
                                fontWeight: 700,
                                cursor: "pointer",
                                color: saved ? "hsl(355 100% 60%)" : "hsl(355 100% 50%)",
                                transition: "all .2s"
                            }}>
                            {saving ? "Saving..." : saved ? "✓ Saved!" : "Save Profile"}
                        </button>
                        {saved && <div style={{
                            marginTop: 10,
                            fontSize: 12,
                            color: "hsl(355 100% 60%)"  // --accent-glow
                        }}>
                            <Icon name="✓" size={12} style={{ marginRight: 6, verticalAlign: "middle" }} />
                            Profile saved to Cloudflare — persists across all devices.
                        </div>}
                    </div>
                )}

                {tab === "ai" && (
                    <div>
                        <div style={{
                            fontSize: 15,
                            fontWeight: 700,
                            color: "hsl(0 0% 94%)",  // --foreground
                            marginBottom: 20
                        }}>
                            AI Settings
                        </div>
                        {["Daily morning briefing", "Proactive lead alerts", "Weekly life summary", "Insight Moments",
                            "Conflict detection", "Opportunity scanning", "Family schedule analysis", "Financial shadow oracle"].map(opt => (
                                <div key={opt} style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 12,
                                    fontSize: 13,
                                    padding: "11px 0",
                                    borderBottom: "0.5px solid hsl(0 0% 20%)",  // --border
                                    color: "hsl(0 0% 94%)"  // --foreground
                                }}>
                                    <input type="checkbox" defaultChecked style={{
                                        width: 16,
                                        height: 16,
                                        accentColor: "hsl(355 100% 50%)"  // --primary
                                    }} />
                                    {opt}
                                </div>
                            ))}
                    </div>
                )}

                {tab === "notifications" && (
                    <div>
                        <div style={{
                            fontSize: 15,
                            fontWeight: 700,
                            color: "hsl(0 0% 94%)",  // --foreground
                            marginBottom: 20
                        }}>
                            Notifications
                        </div>
                        {["New messages", "Lead opportunities", "Event reminders", "Family milestones",
                            "AI insights", "Social mentions", "Invoice payments", "System alerts"].map(opt => (
                                <div key={opt} style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 12,
                                    fontSize: 13,
                                    padding: "11px 0",
                                    borderBottom: "0.5px solid hsl(0 0% 20%)",  // --border
                                    color: "hsl(0 0% 94%)"  // --foreground
                                }}>
                                    <input type="checkbox" defaultChecked style={{
                                        width: 16,
                                        height: 16,
                                        accentColor: "hsl(355 100% 50%)"  // --primary
                                    }} />
                                    {opt}
                                </div>
                            ))}
                    </div>
                )}

                {tab === "privacy" && (
                    <div>
                        <div style={{
                            fontSize: 15,
                            fontWeight: 700,
                            color: "hsl(0 0% 94%)",  // --foreground
                            marginBottom: 8
                        }}>
                            Privacy Vault
                        </div>
                        <p style={{
                            fontSize: 13,
                            color: "hsl(355 100% 60%)",  // --accent-glow
                            marginBottom: 20
                        }}>
                            Control what each module can access.
                        </p>
                        {["Family Hub", "Business CRM", "Social Hub", "Community Feed",
                            "AI Conductor", "Finance Module", "Marketing Tools"].map(mod => (
                                <div key={mod} style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 12,
                                    fontSize: 13,
                                    padding: "11px 0",
                                    borderBottom: "0.5px solid hsl(0 0% 20%)",  // --border
                                    color: "hsl(0 0% 94%)"  // --foreground
                                }}>
                                    <input type="checkbox" defaultChecked style={{
                                        width: 16,
                                        height: 16,
                                        accentColor: "hsl(355 100% 50%)"  // --primary
                                    }} />
                                    {mod} can access my profile data
                                </div>
                            ))}
                    </div>
                )}

                {tab === "appearance" && (
                    <div>
                        <div style={{
                            fontSize: 15,
                            fontWeight: 700,
                            color: "hsl(0 0% 94%)",  // --foreground
                            marginBottom: 6
                        }}>
                            Appearance
                        </div>
                        <div style={{
                            fontSize: 12,
                            color: "hsl(355 100% 60%)",  // --accent-glow
                            marginBottom: 16
                        }}>
                            Theme — applies instantly across the app and is saved for next time.
                        </div>
                        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                            {Object.entries(THEMES).map(([id, t]) => {
                                const active = theme === id;
                                return (
                                    <button key={id} onClick={() => pickTheme(id)}
                                        style={{
                                            padding: "16px 18px",
                                            borderRadius: 12,
                                            border: active ? "1.5px solid hsl(355 100% 50%)" : "0.5px solid hsl(0 0% 20%)",  // --primary / --border
                                            background: t.swatch[0],
                                            cursor: "pointer",
                                            textAlign: "center",
                                            minWidth: 120,
                                            boxShadow: active ? "0 0 16px hsla(355 100% 50%, 0.25)" : "none",  // --primary glow
                                            transition: "all .15s"
                                        }}>
                                        <div style={{ display: "flex", gap: 5, marginBottom: 8, justifyContent: "center" }}>
                                            {t.swatch.slice(1).map((c, i) => <div key={i} style={{ width: 14, height: 14, borderRadius: "50%", background: c }} />)}
                                        </div>
                                        <div style={{
                                            fontSize: 12,
                                            color: "hsl(0 0% 94%)",  // --foreground
                                            fontWeight: active ? 700 : 500
                                        }}>
                                            {t.name}
                                        </div>
                                        {active && <div style={{
                                            fontSize: 10,
                                            color: "hsl(355 100% 50%)",  // --primary
                                            marginTop: 4
                                        }}>
                                            ✓ Active
                                        </div>}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}