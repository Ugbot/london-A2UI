"use client";
import React from "react";
import type { Props } from "./schema";

const MISSIONS = [
  { id: "arc",   label: "[A] ARC Corp",      reward: 12000, steps: ["Connect via Proxy", "Crack SSH", "Escalate Privileges", "Exfiltrate Data", "Purge Logs"] },
  { id: "rec",   label: "[B] Delete Record", reward: 8500,  steps: ["Route via Pwned Server", "SQL Inject", "Find Record", "Delete & Audit Wipe", "Exit Clean"] },
  { id: "neura", label: "[C] NeuraTech",     reward: 25000, steps: ["Route via Singapore", "Bounce via Pwned", "Break ICE x3", "Upload Virus", "Execute & Flee"] },
  { id: "aeon",  label: "[D] AEON Comms",    reward: 18750, steps: ["Hack AEON Server", "Grab Decrypt Key", "Launch Sniffer", "Intercept Stream", "Export to Client"] },
];

function traceBar(pct: number) {
  const f = Math.min(10, Math.round(pct / 10));
  return "  [" + "█".repeat(f) + "░".repeat(10 - f) + `] ${pct.toFixed(1)}%`;
}

export function Component(props: Props) {
  const [trace,    setTrace]   = React.useState(props.startTrace   ?? 38);
  const [credits,  setCredits] = React.useState(props.startCredits ?? 48320);
  const [hops,     setHops]    = React.useState(props.startProxyHops ?? 4);
  const [busted,   setBusted]  = React.useState(false);
  const [log,      setLog]     = React.useState<string[]>([
    "════════════════════════════════════════════",
    "  UPLINK OS v4.2.1 — Internic Global Network",
    "════════════════════════════════════════════",
    `  Agent: ${props.agentName ?? "GH0ST_R1DER"} | Clearance: BLACK`,
    "  Proxy: [TOR] → [NL-RELAY] → [US-EXIT] → [UPLINK]",
    "  ⚠ Trace at 38% — reroute recommended.",
    "",
    "  Type 'help' for commands, or use the buttons below.",
    "",
  ]);
  const [input,    setInput]     = React.useState("");
  const [history,  setHistory]   = React.useState<string[]>([]);
  const [histIdx,  setHistIdx]   = React.useState(-1);
  const [mProg,    setMProg]     = React.useState<Record<string, number>>({ arc: 0, rec: 0, neura: 0, aeon: 0 });
  const [mDone,    setMDone]     = React.useState<Record<string, boolean>>({ arc: false, rec: false, neura: false, aeon: false });
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const traceRef  = React.useRef(trace);
  traceRef.current = trace;
  const credRef   = React.useRef(credits);
  credRef.current = credits;
  const hopsRef   = React.useRef(hops);
  hopsRef.current = hops;
  const mProgRef  = React.useRef(mProg);
  mProgRef.current = mProg;
  const mDoneRef  = React.useRef(mDone);
  mDoneRef.current = mDone;

  // Live trace tick
  React.useEffect(() => {
    if (busted) return;
    const id = setInterval(() => {
      setTrace(t => {
        const next = parseFloat((t + 0.08).toFixed(2));
        if (next >= 100) { setBusted(true); return 100; }
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [busted]);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [log]);

  const push = (lines: string[]) => setLog(l => [...l, ...lines, ""]);

  // Command map — reads latest state via refs
  function runCmd(verb: string, args: string[]) {
    if (verb === "help") {
      push([
        "  ┌─ COMMANDS ──────────────────────────────────────────┐",
        "  │  help          show this list                       │",
        "  │  connect <ip>  route to target server               │",
        "  │  crack <svc>   crack ssh / ftp / http               │",
        "  │  hack <tgt>    full 4-stage breach                  │",
        "  │  ls            list files on current server         │",
        "  │  trace         show live trace status               │",
        "  │  reroute       reset proxy chain (−15% trace)       │",
        "  │  bounty        list available contracts             │",
        "  │  mission <id>  advance mission (arc/rec/neura/aeon) │",
        "  │  credits       show balance                         │",
        "  │  whoami        agent identity                       │",
        "  │  clear         clear terminal                       │",
        "  └──────────────────────────────────────────────────────┘",
      ]);
    } else if (verb === "whoami") {
      push([
        `  Agent    : ${props.agentName ?? "GH0ST_R1DER"}`,
        "  Rank     : ELITE (#47)",
        `  Credits  : ¢ ${credRef.current.toLocaleString()}`,
        `  Proxy    : ${hopsRef.current} active hops`,
        `  Trace    : ${traceRef.current.toFixed(1)}%`,
        "  Clearance: BLACK",
        `  Missions : ${Object.values(mDoneRef.current).filter(Boolean).length}/${MISSIONS.length} complete`,
      ]);
    } else if (verb === "credits") {
      push([`  ¢ ${credRef.current.toLocaleString()}`]);
    } else if (verb === "ls") {
      push([
        "  /sys   /logs   /data   /encrypted   /tools",
        "  passwd.enc   shadow.db   mission_brief.dat",
        "  virus_payload.exe   proxy.cfg   contracts.dat",
      ]);
    } else if (verb === "trace") {
      const t = traceRef.current;
      const eta_s = Math.max(0, Math.round((100 - t) / 0.08));
      const eta_m = Math.floor(eta_s / 60);
      const eta_r = eta_s % 60;
      push([
        `  ⚠ Active trace — source: 192.168.4.77`,
        traceBar(t),
        `  ETA lock: ${eta_m}m ${eta_r}s`,
        t > 75 ? "  ⚠⚠ CRITICAL — REROUTE NOW" : t > 50 ? "  ⚠ HIGH — consider rerouting" : "  ✓ Manageable — stay alert",
      ]);
    } else if (verb === "reroute") {
      const cut = 15 + Math.floor(Math.random() * 10);
      setTrace(t => Math.max(5, t - cut));
      setHops(h => Math.min(8, h + 1));
      push([
        "  Rerouting proxy chain…",
        "  [OK] New exit node: Frankfurt-7",
        "  [OK] TOR bridge relay added",
        `  ✓ Trace −${cut}%. Proxy hops now ${hopsRef.current + 1}.`,
      ]);
    } else if (verb === "bounty") {
      const lines = ["  ┌─ CONTRACT BOARD ────────────────────────────────────┐"];
      MISSIONS.forEach(m => {
        const done = mDoneRef.current[m.id];
        const prog = mProgRef.current[m.id];
        const st   = done ? "✓ DONE" : prog > 0 ? `${prog}/${m.steps.length}` : "OPEN";
        lines.push(`  │  ${m.label.padEnd(22)} ¢${String(m.reward).padStart(6)}  ${st.padEnd(8)}│`);
      });
      lines.push("  └──────────────────────────────────────────────────────┘");
      push(lines);
    } else if (verb === "connect") {
      const ip  = args[0] ?? "0.0.0.0";
      const lat = 150 + Math.floor(Math.random() * 400);
      setTrace(t => Math.min(100, t + 2));
      push([
        `  Routing via ${hopsRef.current}-hop proxy chain…`,
        "  [OK] TOR exit verified",
        `  [OK] Relay authenticated — latency ${lat}ms`,
        `  [OK] Connected to ${ip}`,
        "  Remote OS: UplinkOS 2.1 — ports open: 22/ssh 80/http 21/ftp",
        "  ⚠ Trace +2%",
      ]);
    } else if (verb === "crack") {
      const svc = (args[0] ?? "ssh").toUpperCase();
      const ok  = Math.random() > 0.2;
      if (ok) {
        setTrace(t => Math.min(100, t + 5));
        push([
          `  Launching ${svc} cracker v4.1…`,
          "  [████████░░] 80% — dictionary attack in progress",
          "  [██████████] 100% — password found: p@ss_1337!",
          `  ✓ ${svc} breached. Shell access granted.`,
          "  ⚠ Trace +5%",
        ]);
      } else {
        setTrace(t => Math.min(100, t + 12));
        push([
          `  Launching ${svc} cracker…`,
          "  [██████░░░░] 60% — honeypot triggered!",
          "  ✗ Crack failed — ICE countermeasure activated.",
          "  ⚠⚠ Trace +12%",
        ]);
      }
    } else if (verb === "hack") {
      const tgt  = args[0] ?? "target";
      const dmg  = 8 + Math.floor(Math.random() * 10);
      setTrace(t => Math.min(100, t + dmg));
      setCredits(c => c + 500);
      push([
        `  Initiating full breach: ${tgt}`,
        "  [1/4] Port scan………………… ✓",
        "  [2/4] CVE-2024-9182……… ✓ exploited",
        "  [3/4] Privilege escalation ✓ root",
        "  [4/4] Backdoor planted…… ✓",
        `  ✓ ${tgt} fully compromised. +¢500 bounty.`,
        `  ⚠ Trace +${dmg}%`,
      ]);
    } else if (verb === "mission") {
      const id = args[0] ?? "";
      const m  = MISSIONS.find(x => x.id === id);
      if (!m) { push([`  Unknown id. Use: ${MISSIONS.map(x => x.id).join(", ")}`]); return; }
      if (mDoneRef.current[m.id]) { push([`  ✓ ${m.label} already complete.`]); return; }
      const cur = mProgRef.current[m.id];
      if (cur >= m.steps.length) {
        setMDone(d => ({ ...d, [m.id]: true }));
        setCredits(c => { push([`  ✓✓ MISSION COMPLETE: ${m.label}`, `  ¢ ${m.reward.toLocaleString()} deposited. New balance: ¢ ${(c + m.reward).toLocaleString()}`]); return c + m.reward; });
      } else {
        const step = m.steps[cur];
        const dmg  = 3 + Math.floor(Math.random() * 6);
        setMProg(p => ({ ...p, [m.id]: cur + 1 }));
        setTrace(t => Math.min(100, t + dmg));
        const isLast = cur === m.steps.length - 1;
        push([
          `  [${cur + 1}/${m.steps.length}] Executing: ${step}`,
          isLast
            ? `  ✓ Final step done! Run 'mission ${id}' again to collect ¢${m.reward.toLocaleString()}.`
            : `  ✓ Done. Next: ${m.steps[cur + 1]}`,
          `  ⚠ Trace +${dmg}%`,
        ]);
      }
    } else if (verb === "clear") {
      setLog([]);
    } else {
      push([`  bash: ${verb}: command not found. Type 'help'.`]);
    }
  }

  function submitCmd(raw: string) {
    if (!raw.trim()) return;
    const [verb, ...args] = raw.trim().toLowerCase().split(/\s+/);
    setLog(l => [...l, `root@uplink:~$ ${raw.trim()}`]);
    runCmd(verb, args);
    setHistory(h => [raw.trim(), ...h]);
    setHistIdx(-1);
    setInput("");
  }

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowUp") {
      const i = Math.min(histIdx + 1, history.length - 1);
      setHistIdx(i); setInput(history[i] ?? "");
    } else if (e.key === "ArrowDown") {
      const i = Math.max(histIdx - 1, -1);
      setHistIdx(i); setInput(i === -1 ? "" : history[i] ?? "");
    } else if (e.key === "Enter") {
      submitCmd(input);
    }
  }

  const traceColor = busted ? "#ef4444" : trace > 75 ? "#f97316" : trace > 50 ? "#fbbf24" : "#34d399";

  return (
    <div style={{ fontFamily: '"Courier New", monospace', display: "flex", flexDirection: "column", gap: 10 }}>

      {/* HUD strip */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", background: "#06000f", border: "1px solid #4c1d95", borderRadius: 6, padding: "6px 12px", boxShadow: "0 0 16px #4c1d9544" }}>
        <span style={{ color: "#a855f7", fontWeight: "bold", fontSize: 11, letterSpacing: 2 }}>◈ UPLINK OS</span>
        <span style={{ color: "#374151" }}>|</span>
        <span style={{ color: "#34d399", fontSize: 11 }}>● ONLINE</span>
        <span style={{ color: "#374151" }}>|</span>
        <span style={{ color: traceColor, fontSize: 11, fontWeight: "bold" }}>⚠ TRACE: {trace.toFixed(1)}%</span>
        <span style={{ color: "#374151" }}>|</span>
        <span style={{ color: "#22d3ee", fontSize: 11 }}>PROXY: {hops} HOPS</span>
        <span style={{ color: "#374151" }}>|</span>
        <span style={{ color: "#c084fc", fontSize: 11 }}>¢ {credits.toLocaleString()}</span>
        <span style={{ color: "#374151" }}>|</span>
        <span style={{ color: "#a855f7", fontSize: 11 }}>MISSIONS: {Object.values(mDone).filter(Boolean).length}/{MISSIONS.length}</span>
        <div style={{ flex: 1, minWidth: 60, height: 4, background: "#1a0030", borderRadius: 2, overflow: "hidden" }}>
          <div style={{ width: `${Math.min(100, trace)}%`, height: "100%", background: traceColor, transition: "width 1s linear", boxShadow: `0 0 6px ${traceColor}` }} />
        </div>
      </div>

      {/* BUSTED state */}
      {busted && (
        <div style={{ background: "#1a0000", border: "2px solid #ef4444", borderRadius: 8, padding: 16, textAlign: "center", boxShadow: "0 0 40px #ef444466" }}>
          <div style={{ color: "#ef4444", fontSize: 18, fontWeight: "bold", letterSpacing: 4 }}>⚠ SOURCE LOCKED ⚠</div>
          <div style={{ color: "#fca5a5", fontSize: 12, marginTop: 6 }}>Your identity has been traced. Connection terminated by authorities.</div>
          <button onClick={() => { setTrace(12); setBusted(false); setHops(4); setCredits(c => Math.max(0, c - 5000)); setLog(["  [!] Firewall breach detected — emergency reboot.", "  [!] ¢5,000 seized as penalty.", "  System restored. New proxy chain established.", ""]); }}
            style={{ marginTop: 10, background: "#7c3aed", color: "#fff", border: "none", borderRadius: 4, padding: "6px 18px", cursor: "pointer", fontFamily: "inherit", fontSize: 12 }}>
            ◈ REBOOT SYSTEM (−¢5,000)
          </button>
        </div>
      )}

      {/* Mission bars */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
        {MISSIONS.map(m => {
          const prog = mProg[m.id];
          const done = mDone[m.id];
          const pct  = done ? 100 : (prog / m.steps.length) * 100;
          return (
            <div key={m.id} style={{ background: "#06000f", border: `1px solid ${done ? "#064e3b" : "#3b1a6e"}`, borderRadius: 4, padding: "5px 8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                <span style={{ color: done ? "#34d399" : "#c084fc", fontSize: 10 }}>{m.label}</span>
                <span style={{ color: done ? "#34d399" : "#6b7280", fontSize: 10 }}>{done ? "✓ DONE" : `${prog}/${m.steps.length}`}</span>
              </div>
              <div style={{ height: 3, background: "#1a0030", borderRadius: 2, overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", background: done ? "#34d399" : "#a855f7", transition: "width 0.4s", boxShadow: done ? "0 0 5px #34d399" : "0 0 4px #a855f7" }} />
              </div>
              {!done && prog < m.steps.length && (
                <div style={{ color: "#4b5563", fontSize: 9, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>↳ {m.steps[prog]}</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Terminal */}
      <div style={{ background: "#06000f", border: "1px solid #7c3aed", borderRadius: 8, padding: "10px 12px", boxShadow: "0 0 24px #7c3aed33", display: "flex", flexDirection: "column" }}>
        <div style={{ color: "#6b21a8", fontSize: 10, letterSpacing: 2, marginBottom: 5, borderBottom: "1px solid #2d1060", paddingBottom: 4 }}>
          ◈ TERMINAL — root@uplink:~$
        </div>
        <div style={{ maxHeight: 260, overflowY: "auto", whiteSpace: "pre-wrap", wordBreak: "break-all", fontSize: 12, lineHeight: 1.55 }}>
          {log.map((line, i) => {
            const col =
              line.startsWith("  ✓") ? "#34d399" :
              line.startsWith("  ✗") ? "#ef4444" :
              line.startsWith("  ⚠⚠") ? "#ef4444" :
              line.startsWith("  ⚠") ? "#fbbf24" :
              line.startsWith("root@") ? "#a855f7" :
              line.startsWith("  [") ? "#c084fc" :
              line.startsWith("  │") || line.startsWith("  ┌") || line.startsWith("  └") ? "#4b5563" :
              line.startsWith("═") ? "#3b1a6e" :
              "#9ca3af";
            return <div key={i} style={{ color: col }}>{line || "\u00a0"}</div>;
          })}
          <div ref={bottomRef} />
        </div>
        <div style={{ display: "flex", alignItems: "center", marginTop: 6, borderTop: "1px solid #2d1060", paddingTop: 5, gap: 6 }}>
          <span style={{ color: "#7c3aed", flexShrink: 0, fontSize: 12 }}>root@uplink:~$</span>
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKey} disabled={busted}
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#e9d5ff", fontFamily: "inherit", fontSize: 12, caretColor: "#a855f7" }}
            placeholder={busted ? "CONNECTION TERMINATED" : "type a command…"} autoComplete="off" spellCheck={false} autoFocus />
        </div>
      </div>

      {/* Quick-action buttons */}
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
        {(["reroute", "trace", "bounty", "ls", "whoami"] as const).map(cmd => (
          <button key={cmd} onClick={() => submitCmd(cmd)}
            style={{ background: "transparent", border: "1px solid #7c3aed", color: "#c084fc", fontFamily: "inherit", fontSize: 11, padding: "4px 12px", borderRadius: 4, cursor: "pointer", letterSpacing: 1, textTransform: "uppercase" }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "#2d1060"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}>
            {cmd}
          </button>
        ))}
        {MISSIONS.map(m => (
          <button key={m.id} onClick={() => submitCmd(`mission ${m.id}`)} disabled={mDone[m.id]}
            style={{ background: mDone[m.id] ? "#022c22" : "transparent", border: `1px solid ${mDone[m.id] ? "#34d399" : "#4c1d95"}`, color: mDone[m.id] ? "#34d399" : "#a855f7", fontFamily: "inherit", fontSize: 10, padding: "4px 10px", borderRadius: 4, cursor: mDone[m.id] ? "default" : "pointer", letterSpacing: 0.5 }}>
            {mDone[m.id] ? `✓ ${m.id.toUpperCase()}` : `▶ ${m.id.toUpperCase()}`}
          </button>
        ))}
      </div>
    </div>
  );
}