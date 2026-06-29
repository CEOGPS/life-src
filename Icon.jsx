// Icon.jsx — universal icon renderer for LifeOS1.
//
// Three kinds of glyphs in one component:
//  1. BRAND  → real SVG from simple-icons (or inline path) via BrandIcon
//  2. UI     → lucide-react vector icon (consistent stroke, scalable)
//  3. EMOJI  → falls through as text (anything not mapped)
//
// Usage:
//   <Icon name="instagram" size={18} />        // brand
//   <Icon name="search" size={16} />           // UI
//   <Icon name="🔥" size={20} />               // emoji passthrough → mapped to "flame"
//   <Icon name="anything-unmapped" />          // monogram disc fallback
//
// The big win: panels can keep their existing emoji *literals* AND
// migrate progressively. A swap of `<span>🔍</span>` to
// `<Icon name="🔍" />` upgrades to lucide's Search icon automatically.

import {
  // Common UI
  Search, Bell, Settings, Menu, Plus, Minus, X as XClose, Check, ChevronRight,
  ChevronLeft, ChevronDown, ChevronUp, ArrowRight, ArrowLeft, ArrowUp, ArrowDown,
  ArrowUpRight, ArrowDownLeft, Trash2, Pencil, Copy, Save, Upload, Download,
  RefreshCw, ExternalLink, Eye, EyeOff, Lock, LockOpen, Star, Heart,
  // Content / media
  Image, Film, Music, Mic, Camera, Video, Play, Pause, FileText, File, Folder,
  FolderOpen, BookOpen, Book, Notebook, Newspaper, Paperclip, Tag, Bookmark,
  // Comms
  Mail, MessageCircle, MessageSquare, Phone, Send, Share2, AtSign,
  // Money / commerce
  DollarSign, CreditCard, Wallet, ShoppingCart, ShoppingBag, Banknote, Coins,
  // Time / calendar
  Calendar, CalendarDays, Clock, Sunrise, Sunset, Sun, Moon, CloudRain, Cloud,
  // People / identity
  User, Users, UserPlus, UserCheck, Contact, House, Building, Building2, Briefcase,
  // System
  Cpu, Server, Database, HardDrive, Wifi, Signal, Power, Plug, Zap, Activity,
  Layers, Grid3x3, List, LayoutDashboard, ChartBar, ChartLine, ChartPie, TrendingUp, TrendingDown,
  // Misc
  TriangleAlert, CircleAlert, Info, CircleHelp, CircleCheck, CircleX, Circle,
  Flame, Sparkles, WandSparkles, Brain, Bot, Rocket, Target, Trophy, Award,
  MapPin, Navigation, Globe, Link2, Hash, Code, Terminal, Pen, PenTool,
  Pin, Lightbulb, Compass, Wrench, Hammer, Cog, Gamepad2, Headphones,
  Gift, Sparkle, Smile, Frown, ThumbsUp, ThumbsDown, Crown, Diamond,
  Shield, ShieldCheck, Key, KeyRound, Mailbox, Inbox, Archive, Filter,
  Scissors, Megaphone, Radio, Tv, Speaker, Volume2,
} from "lucide-react";

import BrandIcon from "./BrandIcon";

// ── Brand slugs handled by BrandIcon (real branded SVG) ───────────────────
const BRAND_SLUGS = new Set([
  "instagram","facebook","linkedin","x","twitter","tiktok","youtube","reddit","meta",
  "whatsapp","telegram","signal","snapchat",
  "gmail","google","outlook","microsoftoutlook","apple",
  "anthropic","claude","openai","chatgpt","gemini","googlegemini",
  "deepseek","xai","grok","copilot","githubcopilot",
]);

// ── Emoji literal → semantic icon key (handles both the literal and the key) ──
const EMOJI_MAP = {
  // UI controls
  "🔍": "search", "🔎": "search",
  "🔔": "bell", "🔕": "bell-off",
  "⚙": "settings", "⚙️": "settings",
  "☰": "menu",
  "✕": "x", "✖": "x", "❌": "x-circle",
  "✓": "check", "✅": "check-circle",
  "→": "arrow-right", "➜": "arrow-right", "▶": "play", "❯": "chevron-right",
  "←": "arrow-left", "↩": "arrow-left",
  "↑": "arrow-up", "▲": "chevron-up",
  "↓": "arrow-down", "▼": "chevron-down",
  "↗": "arrow-up-right", "↳": "corner-down-right",
  "↻": "refresh", "🔄": "refresh",
  "●": "dot", "○": "circle", "◈": "diamond-empty",
  "★": "star-filled", "☆": "star",
  // Media
  "🎵": "music", "🎶": "music", "🎼": "music",
  "🎬": "film", "🎞": "film", "📽": "film", "🎥": "video",
  "🖼": "image", "📷": "camera", "📸": "camera",
  "📹": "video",
  "🎮": "gamepad", "🎰": "gamepad", "🎲": "gamepad",
  "🎤": "mic", "🎧": "headphones", "🔊": "volume",
  "🎨": "palette", "🎭": "theater",
  // Comms
  "💬": "chat", "📞": "phone", "📱": "smartphone",
  "📧": "mail", "✉": "mail", "✉️": "mail", "📨": "mail", "📬": "mailbox",
  "📭": "mailbox-empty", "📤": "send", "📮": "mailbox",
  "📢": "megaphone", "📣": "megaphone", "📡": "radio",
  // Files
  "📁": "folder", "📂": "folder-open", "📋": "clipboard", "📑": "bookmark",
  "📄": "file", "📃": "file", "📝": "edit", "📜": "file-text",
  "📌": "pin", "📍": "map-pin", "🏷": "tag",
  "📎": "paperclip", "🔗": "link", "🔖": "bookmark",
  "📚": "books", "📖": "book-open", "📓": "notebook", "📒": "notebook",
  "📘": "book", "📰": "newspaper",
  "🗑": "trash", "🗃": "archive", "🗄": "database", "🗂": "folders",
  // Stats / commerce
  "📊": "chart-bar", "📈": "trending-up", "📉": "trending-down", "📇": "contact",
  "💰": "money", "💵": "cash", "💴": "cash", "💶": "cash", "💷": "cash",
  "💳": "card", "💸": "send-money", "💎": "diamond", "🪙": "coin",
  "🛒": "cart", "🛍": "bag", "🏪": "store", "🏬": "store",
  "🪣": "bucket",
  // Time / weather
  "📅": "calendar", "📆": "calendar", "🗓": "calendar",
  "🌅": "sunrise", "🌄": "sunrise", "🌆": "sunset", "🌇": "sunset",
  "☀": "sun", "🌙": "moon", "🌃": "moon",
  "☁": "cloud", "⛅": "cloud", "🌊": "wave", "💧": "droplet",
  // People / places
  "👤": "user", "👥": "users",
  "👋": "wave", "🙏": "pray", "🤝": "handshake",
  "👨": "user", "👩": "user", "👧": "user", "👦": "user",
  "👇": "arrow-down",
  "🏠": "home", "🏡": "home", "🏢": "building",
  "🏘": "buildings", "🏛": "landmark", "🏰": "castle", "🏦": "bank",
  "🌐": "globe", "🌍": "globe",
  // System / tech
  "💻": "laptop", "🖥": "monitor", "🪟": "window",
  "🤖": "bot", "🧠": "brain", "🔮": "wand", "🪄": "wand",
  "⚡": "zap", "🔥": "flame", "✨": "sparkles", "✦": "sparkle", "🌟": "star-filled",
  "🚀": "rocket", "🎯": "target", "🏆": "trophy",
  "🔒": "lock", "🔐": "lock", "🔑": "key",
  "🔧": "wrench", "🛠": "tools", "🔨": "hammer",
  "🔬": "microscope", "✏": "pencil", "✍": "pen", "🖊": "pen", "🖌": "brush", "✂": "scissors",
  // States / misc
  "⚠": "alert", "⚠️": "alert", "💡": "lightbulb",
  "❤": "heart", "❤️": "heart", "🤍": "heart",
  "🔵": "circle-blue", "🟢": "circle-green", "🟠": "circle-orange",
  "🟡": "circle-yellow", "🔶": "diamond", "🔷": "diamond",
  "🎁": "gift", "🎂": "cake", "🎆": "sparkles", "🪧": "sign",
  "💼": "briefcase", "🎓": "graduation",
  "🌪": "wind", "🐦": "twitter", "🎸": "guitar", "🐧": "linux", "🐍": "code",
  "🦙": "llama", "🤗": "smile", "😊": "smile", "😔": "frown", "🤫": "shush", "👻": "ghost",
  "🧘": "meditate", "♾": "infinity",
  "⚖": "scale", "⚔": "sword", "🛡": "shield",
  "📦": "package", "🎟": "ticket",
  "🧵": "thread", "🍝": "food",
};

// ── Semantic key → lucide component ──
const UI = {
  "search": Search, "bell": Bell, "bell-off": Bell, "settings": Settings,
  "menu": Menu, "plus": Plus, "minus": Minus, "x": XClose, "x-circle": CircleX,
  "check": Check, "check-circle": CircleCheck, "circle": Circle, "dot": Circle,
  "diamond-empty": Diamond, "diamond": Diamond,
  "chevron-right": ChevronRight, "chevron-left": ChevronLeft,
  "chevron-down": ChevronDown, "chevron-up": ChevronUp,
  "arrow-right": ArrowRight, "arrow-left": ArrowLeft, "arrow-up": ArrowUp, "arrow-down": ArrowDown,
  "arrow-up-right": ArrowUpRight, "corner-down-right": ArrowDownLeft,
  "play": Play, "pause": Pause,
  "refresh": RefreshCw,
  "trash": Trash2, "edit": Pencil, "copy": Copy, "save": Save, "send": Send,
  "upload": Upload, "download": Download, "share": Share2,
  "external-link": ExternalLink, "link": Link2,
  "eye": Eye, "eye-off": EyeOff,
  "lock": Lock, "unlock": LockOpen, "key": KeyRound,
  "star": Star, "star-filled": Star, "heart": Heart,
  // Media
  "image": Image, "camera": Camera, "video": Video, "film": Film,
  "music": Music, "mic": Mic, "headphones": Headphones, "volume": Volume2,
  "palette": Pen, "theater": Smile,
  "gamepad": Gamepad2,
  // Comms
  "mail": Mail, "mailbox": Mailbox, "mailbox-empty": Inbox,
  "chat": MessageCircle, "phone": Phone, "smartphone": Phone,
  "megaphone": Megaphone, "radio": Radio,
  // Files
  "folder": Folder, "folder-open": FolderOpen, "folders": Folder,
  "file": FileText, "file-text": FileText,
  "notebook": Notebook, "book": Book, "book-open": BookOpen, "books": BookOpen,
  "newspaper": Newspaper,
  "clipboard": List, "bookmark": Bookmark, "tag": Tag, "paperclip": Paperclip,
  "pin": Pin, "map-pin": MapPin,
  "archive": Archive, "database": Database,
  // Stats / money
  "chart-bar": ChartBar, "trending-up": TrendingUp, "trending-down": TrendingDown,
  "contact": Contact,
  "money": DollarSign, "cash": Banknote, "card": CreditCard,
  "send-money": Send, "coin": Coins, "bucket": Wallet,
  "cart": ShoppingCart, "bag": ShoppingBag, "store": Building,
  // Time / weather
  "calendar": Calendar, "sunrise": Sunrise, "sunset": Sunset,
  "sun": Sun, "moon": Moon, "cloud": Cloud, "wave": Activity, "droplet": Cloud,
  // People / places
  "user": User, "users": Users, "handshake": UserCheck, "pray": Heart,
  "home": House, "building": Building, "buildings": Building2, "landmark": Building2,
  "castle": Building2, "bank": Building, "globe": Globe,
  // System / tech
  "laptop": Cpu, "monitor": Server, "window": Layers,
  "bot": Bot, "brain": Brain, "wand": WandSparkles,
  "zap": Zap, "flame": Flame, "sparkles": Sparkles, "sparkle": Sparkle,
  "rocket": Rocket, "target": Target, "trophy": Trophy,
  "wrench": Wrench, "tools": Wrench, "hammer": Hammer, "microscope": Cog,
  "pencil": Pen, "pen": PenTool, "brush": PenTool, "scissors": Scissors,
  // States / misc
  "alert": TriangleAlert, "lightbulb": Lightbulb, "info": Info,
  "circle-blue": Circle, "circle-green": Circle, "circle-orange": Circle, "circle-yellow": Circle,
  "gift": Gift, "cake": Award, "sign": Tag,
  "briefcase": Briefcase, "graduation": Award,
  "wind": Activity, "twitter": AtSign, "guitar": Music, "linux": Terminal, "code": Code,
  "llama": Bot, "smile": Smile, "frown": Frown, "shush": MessageSquare, "ghost": User,
  "meditate": User, "infinity": RefreshCw,
  "scale": ChartBar, "sword": Shield, "shield": Shield,
  "package": Archive, "ticket": Award, "thread": Activity, "food": Star,
};

export default function Icon({ name, size = 16, color, title, style, strokeWidth = 2 }) {
  if (!name) return null;
  const key = String(name);

  // 1. Brand?
  if (BRAND_SLUGS.has(key.toLowerCase())) {
    return <BrandIcon slug={key.toLowerCase()} size={size} color={color} title={title} style={style} />;
  }

  // 2. Emoji literal → semantic key
  const semantic = EMOJI_MAP[key] || key;

  // 3. Lucide UI icon?
  const Comp = UI[semantic];
  if (Comp) {
    return (
      <Comp
        size={size}
        color={color || "currentColor"}
        strokeWidth={strokeWidth}
        aria-label={title || semantic}
        style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0, ...style }}
      />
    );
  }

  // 4. Fallback — render the literal as text (preserves any unmapped emoji)
  return (
    <span aria-label={title || key} style={{ display: "inline-block", lineHeight: 1, fontSize: size, ...style }}>
      {key}
    </span>
  );
}

// Convenience helper for places already using <BrandIcon slug=... />
export { BrandIcon };
