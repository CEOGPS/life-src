// BrandIcon — renders a branded SVG glyph by slug.
//
// Sources:
//   - simple-icons v15 npm package (tree-shaken) for icons it ships
//   - Inline SVG paths for brands simple-icons does NOT ship:
//       linkedin, microsoftoutlook (outlook), deepseek, xai (grok)
//
// Usage: <BrandIcon slug="instagram" size={18} color="#e1306c" />

import {
  siInstagram, siFacebook, siX, siTiktok, siYoutube,
  siReddit, siMeta, siWhatsapp, siTelegram, siSignal, siSnapchat,
  siGmail, siGoogle, siApple,
  siAnthropic, siOpenai, siGooglegemini, siGithubcopilot,
  siStripe, siCashapp,
} from "simple-icons";

// ── Inline brands (paths transcribed from official 24x24 brand glyphs) ──
const INLINE = {
  linkedin: {
    title: "LinkedIn",
    hex: "0A66C2",
    path: "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.063 2.063 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z",
  },
  microsoftoutlook: {
    title: "Microsoft Outlook",
    hex: "0078D4",
    path: "M7.88 12.04q0 .45-.11.87-.1.41-.33.74-.22.33-.56.52-.34.2-.78.2-.45 0-.79-.2-.34-.2-.57-.53-.23-.34-.34-.75-.12-.42-.12-.84 0-.43.12-.85.11-.41.34-.75.22-.34.56-.54.34-.21.79-.21.44 0 .78.21.34.2.56.54.23.34.34.75.11.42.11.85zM24 12v9.38q0 .46-.33.8-.33.32-.8.32H7.13q-.46 0-.8-.33-.32-.33-.32-.8V18H1q-.41 0-.7-.3-.3-.29-.3-.7V7q0-.41.3-.7Q.58 6 1 6h6.5V2.55q0-.44.3-.75.3-.3.75-.3h13.4q.44 0 .75.3.3.3.3.75V10.85l1.24.72h.01q.1.07.18.18.07.12.07.25zm-6-8.25v3h3v-3zm0 4.5v3h3v-3zm0 4.5v1.83l3.05-1.83zm-5.25-9v3h3.75v-3zm0 4.5v3h3.75v-3zm0 4.5v2.03l2.41 1.45 1.34-.8v-2.68zM9 3.75V6h2l.13.01.12.04v-2.3zM5.98 15.98q.9 0 1.6-.3.7-.32 1.19-.86.48-.55.73-1.3.25-.74.25-1.61 0-.83-.25-1.55-.24-.71-.71-1.24t-1.15-.83q-.68-.3-1.55-.3-.92 0-1.64.3-.71.3-1.2.85-.5.54-.75 1.3-.25.74-.25 1.63 0 .85.26 1.56.26.72.74 1.23.48.52 1.17.81.69.3 1.56.3zM7.5 21h12.39L12 16.38V17q0 .41-.3.7-.29.3-.7.3H7.5zm15-.13v-7.24l-5.9 3.54Z",
  },
  deepseek: {
    title: "DeepSeek",
    hex: "4D6BFE",
    // Approx mark — DeepSeek not yet in simple-icons. Stylized "D" mark.
    path: "M23.748 4.482c-.254-.124-.364.113-.512.234-.051.039-.094.09-.137.136-.372.397-.806.657-1.373.626-.829-.046-1.537.214-2.163.848-.133-.782-.575-1.248-1.247-1.548-.352-.156-.708-.311-.955-.65-.172-.241-.219-.51-.305-.774-.055-.16-.11-.323-.293-.35-.2-.031-.278.135-.356.275-.314.572-.434 1.202-.422 1.84.027 1.434.633 2.576 1.838 3.389.137.093.172.187.129.323-.082.28-.18.552-.266.833-.055.179-.137.217-.329.14-.66-.276-1.232-.677-1.738-1.174-.857-.825-1.632-1.736-2.6-2.494-.232-.176-.469-.346-.711-.512-1.018-.97.137-1.768.402-1.865.281-.105.094-.451-.808-.448-.902.004-1.727.301-2.776.7-.156.057-.317.099-.481.137a8 8 0 0 0-1.62-.182c-2.74 0-4.951 1.336-6.451 3.529-.227.305-.391.633-.527.984-.13.337-.122.668-.039.998a8.7 8.7 0 0 0 1.46 3.286c.211.305.34.629.566.929.226.302.515.557.78.829.34.348.793.566 1.288.69.469.118.949.198 1.428.246.477.046.951.069 1.42.064 1.012-.01 1.971-.226 2.886-.586.122-.046.243-.097.379-.151.06-.024.121-.041.187-.024.293.082.578.214.882.27.343.063.69.107 1.037.122.342.014.685-.014 1.022-.072.353-.06.703-.156 1.04-.27.336-.117.66-.265.965-.443.31-.181.6-.394.86-.633.265-.243.5-.518.7-.815.198-.295.358-.62.476-.958.119-.343.193-.7.213-1.06.02-.36-.002-.722-.063-1.078.158-.137.323-.275.473-.43.144-.149.275-.31.395-.481.117-.171.219-.353.305-.546.087-.193.156-.39.213-.594.057-.205.094-.41.121-.62.027-.21.043-.42.043-.633z",
  },
  xai: {
    title: "xAI",
    hex: "000000",
    // Approx mark — xAI not yet in simple-icons. Stylized "𝕏" / Grok mark.
    path: "M9.27 5.55h2.46l2.46 3.6 2.46-3.6h2.46l-3.69 5.4 3.93 5.4h-2.46l-2.7-3.78-2.7 3.78H9.03l3.93-5.4-3.69-5.4zm-6.27 0h2.4l8.4 12.9h-2.4l-8.4-12.9zm15.48 0h2.52l-3.9 5.94 3.9 6.96h-2.52l-2.64-4.74-1.32 1.92v2.82h-2.16V5.55h2.16v5.34l3.96-5.34z",
  },
};

const SLUGS = {
  // Social — from simple-icons
  instagram: siInstagram, facebook: siFacebook,
  x: siX, twitter: siX, tiktok: siTiktok, youtube: siYoutube,
  reddit: siReddit, meta: siMeta,
  // Messaging — from simple-icons
  whatsapp: siWhatsapp, telegram: siTelegram,
  signal: siSignal, snapchat: siSnapchat,
  // Email / accounts — from simple-icons
  gmail: siGmail, google: siGoogle, apple: siApple,
  // Finance — from simple-icons
  stripe: siStripe, cashapp: siCashapp,
  // AI providers — from simple-icons
  anthropic: siAnthropic, claude: siAnthropic,
  openai: siOpenai, chatgpt: siOpenai,
  gemini: siGooglegemini, googlegemini: siGooglegemini,
  copilot: siGithubcopilot, githubcopilot: siGithubcopilot,
  // Inline (not in simple-icons v15.22)
  linkedin: INLINE.linkedin,
  outlook: INLINE.microsoftoutlook,
  microsoftoutlook: INLINE.microsoftoutlook,
  deepseek: INLINE.deepseek,
  xai: INLINE.xai,
  grok: INLINE.xai,
};

export default function BrandIcon({ slug, size = 16, color, title, style }) {
  const icon = SLUGS[slug];
  if (!icon) {
    // Graceful fallback: colored monogram disc for unmapped slugs
    const letter = newFunction();
    return (
      <span
        aria-label={title || slug}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: size,
          height: size,
          borderRadius: "50%",
          background: color || "#888",
          color: "#fff",
          fontSize: Math.max(8, Math.round(size * 0.55)),
          fontWeight: 700,
          lineHeight: 1,
          flexShrink: 0,
          ...style,
        }}
      >
        {letter}
      </span>
    );
  }
  // Default to "glowing green" when no explicit color is passed.
  // Brand-authentic colors still work if the panel passes color="#xxxxxx".
  const NEON = "#00ff9d";
  const fill = color || NEON;
  const glow = color ? "none" : `drop-shadow(0 0 4px ${NEON}88) drop-shadow(0 0 1px ${NEON})`;
  return (
    <svg
      role="img"
      aria-label={title || icon.title}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0, filter: glow, ...style }}
    >
      <title>{title || icon.title}</title>
      <path d={icon.path} fill={fill} />
    </svg>
  );

  function newFunction() {
    return (title || slug || "?").trim().charAt(0).toUpperCase();
  }
}
