import { useState, useRef, useEffect, useCallback } from "react";
import Icon from "@/components/lifeos/icons/Icon";

// ─── Shell Definitions ────────────────────────────────────────────────────────
const SHELLS = [
  {
    id: "powershell",
    label: "PowerShell",
    icon: "🔷",
    prompt: (dir) => `PS ${dir}> `,
    dir: "C:\\Users\\Chris",
    promptColor: "#4ab3f4",
    bg: "#012456",
    headerBg: "#01174a",
    accentColor: "#4ab3f4",
    banner: [
      "Windows PowerShell",
      "Copyright (C) Microsoft Corporation. All rights reserved.",
      "",
      "Install the latest PowerShell for new features and improvements! https://aka.ms/PSWindows",
      "",
    ],
    builtins: {
      "get-location": (dir) => dir,
      "gl":           (dir) => dir,
      "pwd":          (dir) => dir,
      "ls":           () => "Directory: C:\\Users\\Chris\n\nMode    LastWriteTime    Length  Name\n----    -------------    ------  ----\nd----   5/18/2026 9:00AM         Desktop\nd----   5/18/2026 9:00AM         Documents\nd----   5/18/2026 9:00AM         Downloads\nd----   5/18/2026 9:00AM         LifeOS1",
      "dir":          () => " Volume in drive C is OS\n Directory of C:\\Users\\Chris\n\n05/18/2026  09:00 AM    <DIR>  Desktop\n05/18/2026  09:00 AM    <DIR>  Documents\n05/18/2026  09:00 AM    <DIR>  Downloads\n05/18/2026  09:00 AM    <DIR>  LifeOS1",
      "cls":           () => "__CLEAR__",
      "clear":         () => "__CLEAR__",
      "whoami":        () => "DESKTOP-CEOGPS\\Chris",
      "hostname":      () => "DESKTOP-CEOGPS",
      "$psversiontable": () => "Name                           Value\n----                           -----\nPSVersion                      7.4.2\nPSEdition                      Core\nGitCommitId                    7.4.2\nOS                             Microsoft Windows 10.0.22631\nPlatform                       Win32NT",
    },
  },
  {
    id: "python",
    label: "Python",
    icon: "🐍",
    prompt: () => ">>> ",
    dir: "",
    promptColor: "#00c896",
    bg: "#0d1117",
    headerBg: "#090d12",
    accentColor: "#00c896",
    banner: [
      "Python 3.12.3 (main, Apr  9 2024, 08:09:14) [GCC 13.2.0] on linux",
      'Type "help", "copyright", "credits" or "license" for more information.',
      "",
    ],
    builtins: {
      "exit()":  () => "Use Ctrl+D (i.e. EOF) to exit. Or type exit() and press Enter.",
      "quit()":  () => "Use Ctrl+D (i.e. EOF) to exit. Or type quit() and press Enter.",
      "print('hello world')":  () => "hello world",
      'print("hello world")':  () => "hello world",
      "help":    () => "Type help() for interactive help, or help(object) for help about object.",
      "help()":  () => "Welcome to Python 3.12's help utility!\n\nIf this is your first time using Python, you should definitely check out\nthe tutorial on the internet at https://docs.python.org/3.12/tutorial/.\n\nEnter the name of any module, keyword, or topic to get help on writing\nPython programs and using Python modules.",
      "import sys; print(sys.version)": () => "3.12.3 (main, Apr  9 2024, 08:09:14)",
      "1 + 1":   () => "2",
      "2 ** 10": () => "1024",
      "list(range(5))": () => "[0, 1, 2, 3, 4]",
      'type("hello")': () => "<class 'str'>",
    },
  },
  {
    id: "ubuntu",
    label: "Ubuntu",
    icon: "🟠",
    prompt: (dir) => `chris@lifeos:${dir === "/home/chris" ? "~" : dir}$ `,
    dir: "/home/chris",
    promptColor: "#e95420",
    bg: "#300a24",
    headerBg: "#1e0518",
    accentColor: "#e95420",
    banner: [
      "Welcome to Ubuntu 24.04 LTS (GNU/Linux 5.15.0 x86_64)",
      "",
      " * Documentation:  https://help.ubuntu.com",
      " * Management:     https://landscape.canonical.com",
      " * Support:        https://ubuntu.com/pro",
      "",
    ],
    builtins: {
      "ls":          () => "Desktop  Documents  Downloads  lifeos1  snap",
      "ls -la":      () => "total 48\ndrwxr-xr-x 1 chris chris 4096 May 18 09:00 .\ndrwxr-xr-x 1 root  root  4096 May 18 09:00 ..\n-rw-r--r-- 1 chris chris  220 May 18 09:00 .bash_logout\n-rw-r--r-- 1 chris chris 3526 May 18 09:00 .bashrc\ndrwxr-xr-x 2 chris chris 4096 May 18 09:00 Desktop\ndrwxr-xr-x 2 chris chris 4096 May 18 09:00 Documents\ndrwxr-xr-x 2 chris chris 4096 May 18 09:00 Downloads\ndrwxr-xr-x 8 chris chris 4096 May 18 09:00 lifeos1",
      "pwd":         () => "/home/chris",
      "whoami":      () => "chris",
      "uname -a":    () => "Linux lifeos 5.15.0-107-generic #117-Ubuntu SMP x86_64 GNU/Linux",
      "uname":       () => "Linux",
      "clear":       () => "__CLEAR__",
      "echo $USER":  () => "chris",
      "echo $HOME":  () => "/home/chris",
      "echo $SHELL": () => "/bin/bash",
      "cat /etc/os-release": () => 'PRETTY_NAME="Ubuntu 24.04 LTS"\nNAME="Ubuntu"\nVERSION_ID="24.04"\nVERSION="24.04 LTS (Noble Numbat)"\nID=ubuntu\nID_LIKE=debian',
      "df -h":       () => "Filesystem      Size  Used Avail Use% Mounted on\ntmpfs           3.2G  2.1M  3.2G   1% /run\n/dev/sda1       469G  143G  303G  33% /\ntmpfs            16G     0   16G   0% /dev/shm",
      "free -h":     () => "               total        used        free\nMem:            31Gi       4.2Gi        24Gi\nSwap:          8.0Gi          0B       8.0Gi",
      "top":         () => "top - 09:00:01 up 12 days, 3:41,  1 user,  load average: 0.12, 0.08, 0.05\nTasks: 214 total,   1 running, 213 sleeping\n%Cpu(s):  2.3 us,  0.8 sy,  0.0 ni, 96.7 id\nMiB Mem : 32048.0 total, 24576.0 free,  4316.0 used\n\n(press q to quit)",
    },
  },
  {
    id: "wsl",
    label: "WSL",
    icon: "🐧",
    prompt: (dir) => `chris@WSL2:${dir === "/home/chris" ? "~" : dir}$ `,
    dir: "/home/chris",
    promptColor: "#8b7fff",
    bg: "#0b0c14",
    headerBg: "#080910",
    accentColor: "#8b7fff",
    banner: [
      "Welcome to the Windows Subsystem for Linux!",
      "",
      "Distro: Ubuntu-24.04 | Kernel: 5.15.167.4-microsoft-standard-WSL2",
      "",
    ],
    builtins: {
      "ls":          () => "Desktop  Documents  Downloads  lifeos1  snap",
      "pwd":         () => "/home/chris",
      "whoami":      () => "chris",
      "uname -r":    () => "5.15.167.4-microsoft-standard-WSL2",
      "uname -a":    () => "Linux CEOGPS-PC 5.15.167.4-microsoft-standard-WSL2 #1 SMP x86_64 GNU/Linux",
      "clear":       () => "__CLEAR__",
      "cat /proc/version": () => "Linux version 5.15.167.4-microsoft-standard-WSL2 (Microsoft Corporation)",
      "wsl --version":     () => "WSL version: 2.3.26.0\nKernel version: 5.15.167.4\nWSLg version: 1.0.65",
      "echo $WSLENV":      () => "WT_SESSION:WT_PROFILE_ID",
      "explorer.exe .":    () => "(Opened Windows Explorer for current directory)",
    },
  },
  {
    id: "terminal",
    label: "Terminal",
    icon: "⬛",
    prompt: (dir) => `${dir} % `,
    dir: "~",
    promptColor: "#f0ede8",
    bg: "#1e1e1e",
    headerBg: "#161616",
    accentColor: "#f0ede8",
    banner: [
      "Last login: Sun May 18 09:00:01 on ttys000",
      "",
    ],
    builtins: {
      "ls":       () => "Desktop    Documents  Downloads  Library\nMovies     Music      Pictures   Public",
      "ls -la":   () => "total 0\ndrwxr-x---+  16 chris  staff   512 May 18 09:00 .\ndrwxr-xr-x    6 root   admin   192 May 18 09:00 ..\n-rw-r--r--    1 chris  staff  3741 May 18 09:00 .bash_profile\n-rw-r--r--    1 chris  staff    85 May 18 09:00 .bashrc\ndrwx------+   3 chris  staff    96 May 18 09:00 Desktop\ndrwx------+   3 chris  staff    96 May 18 09:00 Documents",
      "pwd":      () => "/Users/chris",
      "whoami":   () => "chris",
      "uname":    () => "Darwin",
      "uname -a": () => "Darwin MacBook-Pro.local 23.5.0 Darwin Kernel Version 23.5.0 x86_64",
      "clear":    () => "__CLEAR__",
      "echo $SHELL": () => "/bin/zsh",
      "sw_vers":  () => "ProductName:\tmacOS\nProductVersion:\t14.5\nBuildVersion:\t23F79",
    },
  },
  {
    id: "cmd",
    label: "Command Prompt",
    icon: "🖥️",
    prompt: (dir) => `${dir}>`,
    dir: "C:\\Users\\Chris",
    promptColor: "#cccccc",
    bg: "#0c0c0c",
    headerBg: "#080808",
    accentColor: "#cccccc",
    banner: [
      "Microsoft Windows [Version 10.0.22631.3672]",
      "(c) Microsoft Corporation. All rights reserved.",
      "",
    ],
    builtins: {
      "dir":     () => " Volume in drive C is Windows\n Volume Serial Number is 1A2B-3C4D\n\n Directory of C:\\Users\\Chris\n\n05/18/2026  09:00 AM    <DIR>  .\n05/18/2026  09:00 AM    <DIR>  ..\n05/18/2026  09:00 AM    <DIR>  Desktop\n05/18/2026  09:00 AM    <DIR>  Documents\n05/18/2026  09:00 AM    <DIR>  Downloads\n05/18/2026  09:00 AM    <DIR>  LifeOS1\n               0 File(s)              0 bytes\n               6 Dir(s)  303,450,374,144 bytes free",
      "cd":      (dir) => dir,
      "echo %username%": () => "Chris",
      "echo %computername%": () => "DESKTOP-CEOGPS",
      "echo %os%": () => "Windows_NT",
      "ver":     () => "Microsoft Windows [Version 10.0.22631.3672]",
      "ipconfig": () => "Windows IP Configuration\n\nEthernet adapter Ethernet:\n   IPv4 Address. . . . . . . . . . . : 192.168.1.100\n   Subnet Mask . . . . . . . . . . . : 255.255.255.0\n   Default Gateway . . . . . . . . . : 192.168.1.1",
      "systeminfo": () => "Host Name:                 DESKTOP-CEOGPS\nOS Name:                   Microsoft Windows 11 Pro\nOS Version:                10.0.22631 N/A Build 22631\nSystem Manufacturer:       ASUS\nSystem Type:               x64-based PC\nTotal Physical Memory:     32,768 MB",
      "cls":     () => "__CLEAR__",
      "tasklist": () => "Image Name          PID Session Name     Mem Usage\n========================= ======== ================ ============\nSystem                  4 Services              8 K\nRegistry              100 Services         66,504 K\nsmss.exe              456 Services          1,108 K\ncsrss.exe             700 Services          5,080 K\nnpm.exe              4521 Console           48,200 K\nnode.exe             4522 Console          124,400 K",
      "set":    () => "APPDATA=C:\\Users\\Chris\\AppData\\Roaming\nCOMPUTERNAME=DESKTOP-CEOGPS\nHOMEDRIVE=C:\nHOMEPATH=\\Users\\Chris\nOS=Windows_NT\nPATH=C:\\Windows\\system32;C:\\Program Files\\nodejs\nUSERDOMAIN=DESKTOP-CEOGPS\nUSERNAME=Chris\nUSERPROFILE=C:\\Users\\Chris",
    },
  },
  {
    id: "warp",
    label: "Warp",
    icon: "⚡",
    prompt: (dir) => `${dir} ❯ `,
    dir: "~/LifeOS1",
    promptColor: "#ff8c42",
    bg: "#17191e",
    headerBg: "#111317",
    accentColor: "#ff8c42",
    banner: [
      "⚡ Warp — The intelligent terminal",
      "   AI Commands: type # to search. Blocks: run & share output.",
      "",
    ],
    builtins: {
      "ls":           () => "📁 public/    📁 src/       📁 node_modules/  📄 package.json\n📄 vite.config.js  📄 index.html  📄 wrangler.toml",
      "ls -la":       () => "total 128\ndrwxr-xr-x  12 chris staff   384 May 18 09:00 .\ndrwxr-xr-x  28 chris staff   896 May 18 09:00 ..\n-rw-r--r--   1 chris staff   263 May 18 09:00 .gitignore\n-rw-r--r--   1 chris staff   521 May 18 09:00 index.html\ndrwxr-xr-x 512 chris staff 16384 May 18 09:00 node_modules\n-rw-r--r--   1 chris staff  1248 May 18 09:00 package.json\ndrwxr-xr-x   2 chris staff    64 May 18 09:00 public\ndrwxr-xr-x   6 chris staff   192 May 18 09:00 src\n-rw-r--r--   1 chris staff   486 May 18 09:00 vite.config.js\n-rw-r--r--   1 chris staff   342 May 18 09:00 wrangler.toml",
      "npm run dev":  () => "  VITE v5.2.0  ready in 234 ms\n\n  ➜  Local:   http://localhost:5173/\n  ➜  Network: use --host to expose\n  ➜  press h + enter to show help",
      "npm run build":() => "vite v5.2.0 building for production...\n✓ 142 modules transformed.\ndist/index.html           0.46 kB │ gzip:  0.30 kB\ndist/assets/index.css    24.82 kB │ gzip:  5.23 kB\ndist/assets/index.js    384.14 kB │ gzip: 109.62 kB\n✓ built in 3.12s",
      "git status":   () => "On branch main\nYour branch is up to date with 'origin/main'.\n\nChanges not staged for commit:\n  (use 'git add <file>...' to update what will be staged)\n\n\tmodified:   src/components/lifeos/panels/TerminalPanel.jsx\n\nno changes added to commit",
      "git log --oneline -5": () => "a1b2c3d (HEAD -> main) Rebuild TerminalPanel multi-tab\ne4f5g6h Fix MediaPanel localStorage persistence\ni7j8k9l Rebuild MusicHub with 4 empty playlists\nm0n1o2p Create AIHubPanel with agents + models tabs\nq3r4s5t Fix Sidebar cleanup remove dead routes",
      "pwd":          () => "/Users/chris/LifeOS1",
      "clear":        () => "__CLEAR__",
      "whoami":       () => "chris",
    },
  },
  {
    id: "vscode",
    label: "VS Code",
    icon: "🔵",
    prompt: (dir) => `${dir} $ `,
    dir: "lifeos1",
    promptColor: "#4ab3f4",
    bg: "#1e1e1e",
    headerBg: "#181818",
    accentColor: "#4ab3f4",
    banner: [
      "Visual Studio Code — Integrated Terminal",
      "   Profile: Default (bash) | lifeos1",
      "",
    ],
    builtins: {
      "ls":          () => "index.html  node_modules/  package.json  public/  src/  vite.config.js  wrangler.toml",
      "ls src":      () => "assets/  components/  index.css  main.jsx",
      "ls src/components/lifeos/panels": () => "AIHubPanel.jsx    AgentPanel.jsx      AIModelsPanel.jsx\nDashboardPanel.jsx  EmailPanel.jsx    EntertainmentPanel.jsx\nMediaPanel.jsx      MessagesPanel.jsx   MusicHub.jsx\nSocialPanel.jsx     TerminalPanel.jsx   ...",
      "npm run dev":  () => "  VITE v5.2.0  ready in 247 ms\n\n  ➜  Local:   http://localhost:5173/\n  ➜  press h + enter to show help",
      "npm install":  () => "up to date, audited 1247 packages in 3s\n\n142 packages are looking for funding\n  run `npm fund` for details\n\nfound 0 vulnerabilities",
      "npm run build":() => "vite v5.2.0 building for production...\n✓ 142 modules transformed.\n✓ built in 3.12s",
      "git diff --stat": () => "src/components/lifeos/panels/TerminalPanel.jsx | 312 +++++++++++++++----------\n1 file changed, 219 insertions(+), 93 deletions(-)",
      "code .":      () => "(VS Code already open — you're in the integrated terminal!)",
      "pwd":         () => "/Users/chris/lifeos1",
      "clear":       () => "__CLEAR__",
      "whoami":      () => "chris",
      "node -v":     () => "v20.12.2",
      "npm -v":      () => "10.5.0",
      "npx wrangler --version": () => "⛅️ wrangler 3.57.1",
    },
  },
];

const AI_WORKER = "https://lifeos1.ceogps.workers.dev/api/ai/generate";

async function askAI(shell, command) {
  try {
    const res = await fetch(AI_WORKER, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: `You are simulating a ${shell.label} terminal. The user typed: "${command}".
Respond as the terminal would — show realistic output. Keep response under 10 lines.
No markdown formatting. Plain text only. If it's a destructive or dangerous command, show a permission denied or safety error.`,
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.response || data.result || data.text || "Command executed.";
  } catch {
    return `'${command}' is not recognized as a command. Type 'help' for available commands.`;
  }
}

// ─── Single Terminal Tab ──────────────────────────────────────────────────────
function TerminalTab({ shell, isActive }) {
  const [lines, setLines]     = useState(() => shell.banner.map(t => ({ type: "banner", text: t })));
  const [input, setInput]     = useState("");
  const [loading, setLoading] = useState(false);
  const [cmdHistory, setCmdHistory] = useState([]);
  const [histIdx, setHistIdx] = useState(-1);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);
  const dirRef    = useRef(shell.dir);

  useEffect(() => {
    if (isActive) {
      setTimeout(() => inputRef.current?.focus(), 50);
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [isActive]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  const addLines = useCallback((newLines) => {
    setLines(prev => [...prev, ...newLines]);
  }, []);

  async function runCmd(raw) {
    const trimmed = raw.trim();
    if (!trimmed) return;

    const promptText = shell.prompt(dirRef.current);
    addLines([{ type: "input", text: promptText + raw }]);

    setCmdHistory(h => [raw, ...h.filter(c => c !== raw)]);
    setHistIdx(-1);

    const lower = trimmed.toLowerCase();

    // Built-in: clear
    const builtinKeys = Object.keys(shell.builtins);
    const matchedKey = builtinKeys.find(k => lower === k.toLowerCase());

    if (matchedKey) {
      const result = shell.builtins[matchedKey](dirRef.current);
      if (result === "__CLEAR__") {
        setLines(shell.banner.map(t => ({ type: "banner", text: t })));
        return;
      }
      addLines([{ type: "output", text: result }]);
      return;
    }

    // cd command
    if (lower.startsWith("cd ")) {
      const target = raw.slice(3).trim();
      const slash = shell.id === "cmd" || shell.id === "powershell" ? "\\" : "/";
      if (target === ".." || target === "../") {
        const parts = dirRef.current.split(/[/\\]/);
        if (parts.length > 1) {
          parts.pop();
          dirRef.current = parts.join(slash) || slash;
        }
      } else if (target === "~" || target === "%USERPROFILE%") {
        dirRef.current = shell.dir;
      } else {
        dirRef.current = dirRef.current + slash + target;
      }
      addLines([{ type: "output", text: "" }]);
      return;
    }

    // help
    if (lower === "help" || lower === "man" || lower === "?") {
      const keys = Object.keys(shell.builtins).slice(0, 12).join("  ");
      addLines([{
        type: "output",
        text: `Available simulated commands:\n${keys}\n\n...and any other command is sent to the AI engine for simulation.`,
      }]);
      return;
    }

    // AI fallback
    setLoading(true);
    addLines([{ type: "ai", text: "⟳ Processing..." }]);
    const result = await askAI(shell, raw);
    setLines(prev => {
      const next = [...prev];
      next[next.length - 1] = { type: "output", text: result };
      return next;
    });
    setLoading(false);
  }

  function handleKey(e) {
    if (e.key === "Enter") {
      if (!input.trim() || loading) return;
      runCmd(input);
      setInput("");
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHistIdx(i => {
        const next = Math.min(i + 1, cmdHistory.length - 1);
        if (cmdHistory[next] !== undefined) setInput(cmdHistory[next]);
        return next;
      });
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setHistIdx(i => {
        const next = Math.max(i - 1, -1);
        setInput(next === -1 ? "" : cmdHistory[next] || "");
        return next;
      });
    } else if (e.key === "l" && e.ctrlKey) {
      e.preventDefault();
      setLines(shell.banner.map(t => ({ type: "banner", text: t })));
    }
  }

  const lineColor = {
    banner: shell.accentColor + "cc",
    input:  "#f0ede8",
    output: "#c8c8d0",
    ai:     shell.accentColor,
    error:  "#ff4f5e",
  };

  if (!isActive) return null;

  return (
    <div
      style={{ display: "flex", flexDirection: "column", height: "100%", background: shell.bg, cursor: "text" }}
      onClick={() => inputRef.current?.focus()}
    >
      {/* Output area */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 2 }}>
        {lines.map((line, i) => (
          <div
            key={i}
            style={{
              fontSize: 13,
              fontFamily: "'Cascadia Code', 'Fira Code', 'Courier New', monospace",
              color: lineColor[line.type] || "#c8c8d0",
              lineHeight: 1.55,
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
            }}
          >
            {line.type === "input" ? (
              <>
                <span style={{ color: shell.promptColor }}>{line.text.slice(0, shell.prompt(dirRef.current).length)}</span>
                <span style={{ color: "#f0ede8" }}>{line.text.slice(shell.prompt(dirRef.current).length)}</span>
              </>
            ) : line.text}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input row */}
      <div style={{
        padding: "10px 20px",
        borderTop: "0.5px solid rgba(255,255,255,0.07)",
        display: "flex",
        alignItems: "center",
        gap: 8,
        background: shell.headerBg,
      }}>
        <span style={{
          color: shell.promptColor,
          fontSize: 13,
          fontFamily: "'Cascadia Code', 'Fira Code', 'Courier New', monospace",
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}>
          {shell.prompt(dirRef.current)}
        </span>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          disabled={loading}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder={loading ? "⟳ Processing..." : ""}
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            color: "#f0ede8",
            fontSize: 13,
            fontFamily: "'Cascadia Code', 'Fira Code', 'Courier New', monospace",
            caretColor: shell.promptColor,
          }}
        />
        {loading && (
          <span style={{ color: shell.accentColor, fontSize: 11, opacity: 0.7, flexShrink: 0 }}>
            ⟳
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────
export default function TerminalPanel() {
  const [activeShell, setActiveShell] = useState("powershell");
  const [splitView, setSplitView]     = useState(false);
  const [splitShell, setSplitShell]   = useState("ubuntu");

  const active = SHELLS.find(s => s.id === activeShell) || SHELLS[0];
  const split  = SHELLS.find(s => s.id === splitShell)  || SHELLS[2];

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "calc(100vh - 52px)",
      background: "#0b0c14",
      fontFamily: "'Cascadia Code', 'Fira Code', 'Courier New', monospace",
      overflow: "hidden",
    }}>
      {/* Tab bar */}
      <div style={{
        display: "flex",
        alignItems: "center",
        background: "#13141f",
        borderBottom: "0.5px solid rgba(255,255,255,0.07)",
        overflowX: "auto",
        flexShrink: 0,
        gap: 0,
      }}>
        {/* Shell tabs */}
        <div style={{ display: "flex", flex: 1, overflowX: "auto" }}>
          {SHELLS.map(s => (
            <button
              key={s.id}
              onClick={() => setActiveShell(s.id)}
              title={s.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "9px 16px",
                border: "none",
                borderBottom: activeShell === s.id ? `2px solid ${s.accentColor}` : "2px solid transparent",
                background: activeShell === s.id ? s.headerBg : "transparent",
                color: activeShell === s.id ? s.accentColor : "#6aaedd",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: activeShell === s.id ? 600 : 400,
                whiteSpace: "nowrap",
                transition: "all .15s",
                fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
              }}
            >
              <span style={{ fontSize: 14 }}>{s.icon}</span>
              {s.label}
            </button>
          ))}
        </div>

        {/* Toolbar */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "0 12px", flexShrink: 0 }}>
          <button
            onClick={() => setSplitView(v => !v)}
            title="Split terminal"
            style={{
              padding: "5px 10px",
              borderRadius: 5,
              border: "none",
              background: splitView ? "rgba(74,179,244,0.15)" : "rgba(255,255,255,0.05)",
              color: splitView ? "#4ab3f4" : "#6aaedd",
              cursor: "pointer",
              fontSize: 11,
              fontFamily: "-apple-system, sans-serif",
            }}
          ><Icon name="⬜" size={12} style={{marginRight:6,verticalAlign:"middle"}} />Split
          </button>
          <button
            onClick={() => {
              if (window.confirm("Clear this terminal?")) {
                // signal clear — handled inside TerminalTab via key combo
                document.dispatchEvent(new KeyboardEvent("keydown", { key: "l", ctrlKey: true, bubbles: true }));
              }
            }}
            title="Clear terminal (Ctrl+L)"
            style={{
              padding: "5px 10px",
              borderRadius: 5,
              border: "none",
              background: "rgba(255,255,255,0.05)",
              color: "#6aaedd",
              cursor: "pointer",
              fontSize: 11,
              fontFamily: "-apple-system, sans-serif",
            }}
          ><Icon name="✕" size={12} style={{marginRight:6,verticalAlign:"middle"}} />Clear
          </button>
        </div>
      </div>

      {/* Split-pane shell selector (only visible when split is on) */}
      {splitView && (
        <div style={{
          display: "flex",
          background: "#0d0e18",
          borderBottom: "0.5px solid rgba(255,255,255,0.07)",
          padding: "4px 12px",
          gap: 8,
          alignItems: "center",
          flexShrink: 0,
        }}>
          <span style={{ color: "#6aaedd", fontSize: 11, fontFamily: "-apple-system, sans-serif", flexShrink: 0 }}>Split pane:</span>
          {SHELLS.filter(s => s.id !== activeShell).map(s => (
            <button
              key={s.id}
              onClick={() => setSplitShell(s.id)}
              style={{
                padding: "3px 10px",
                borderRadius: 4,
                border: "none",
                background: splitShell === s.id ? "rgba(74,179,244,0.15)" : "rgba(255,255,255,0.04)",
                color: splitShell === s.id ? split.accentColor : "#6aaedd",
                cursor: "pointer",
                fontSize: 11,
                fontFamily: "-apple-system, sans-serif",
              }}
            >
              {s.icon} {s.label}
            </button>
          ))}
        </div>
      )}

      {/* Terminal area */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Primary pane */}
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {SHELLS.map(s => (
            <TerminalTab key={s.id} shell={s} isActive={s.id === activeShell} />
          ))}
        </div>

        {/* Split pane */}
        {splitView && (
          <>
            <div style={{ width: "0.5px", background: "rgba(255,255,255,0.1)", flexShrink: 0 }} />
            <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              {SHELLS.map(s => (
                <TerminalTab key={`split-${s.id}`} shell={s} isActive={s.id === splitShell} />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Status bar */}
      <div style={{
        padding: "3px 16px",
        background: active.headerBg,
        borderTop: "0.5px solid rgba(255,255,255,0.07)",
        display: "flex",
        alignItems: "center",
        gap: 16,
        flexShrink: 0,
      }}>
        <span style={{ color: active.accentColor, fontSize: 10, fontFamily: "-apple-system, sans-serif" }}>
          {active.icon} {active.label}
        </span>
        <span style={{ color: "#6aaedd", fontSize: 10, fontFamily: "-apple-system, sans-serif" }}>
          AI: Worker Connected
        </span>
        <span style={{ color: "#6aaedd", fontSize: 10, fontFamily: "-apple-system, sans-serif", marginLeft: "auto" }}>
          ↑↓ Command History  |  Ctrl+L Clear
        </span>
      </div>
    </div>
  );
}
