"use client";

import * as React from "react";
import { useElementData } from "@/state/hooks";
import type { Props } from "./schema";

export function Component(props: Props) {
  const value = useElementData<unknown>(props.bindKey, props.value);
  return (
    (() => {
  const [log, setLog] = React.useState<string[]>(props.initialLog ?? []);
  const [input, setInput] = React.useState('');
  const [history, setHistory] = React.useState<string[]>([]);
  const [histIdx, setHistIdx] = React.useState(-1);
  const bottomRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [log]);

  const COMMANDS: Record<string, (args: string[]) => string[]> = {
    help: () => [
      '  Available commands:',
      '  connect <ip>        — establish connection to target server',
      '  ls                  — list files on current server',
      '  crack <service>     — attempt to crack a service (ssh/ftp/http)',
      '  hack <target>       — initiate full breach sequence',
      '  trace               — check active trace level',
      '  bounty              — view available bounty contracts',
      '  clear               — clear terminal',
      '  whoami              — display agent identity',
    ],
    whoami: () => [
      `  Agent: ${props.username ?? 'GH0ST_R1DER'}`,
      '  Reputation: ELITE',
      '  Credit Balance: ¢ 48,320',
      '  Active Proxy Nodes: 4',
    ],
    ls: () => [
      '  /sys       /logs       /data       /encrypted',
      '  passwd.enc  shadow.db   mission_01.brief   contracts.dat',
    ],
    trace: () => [
      '  ⚠  Active trace detected from: 192.168.4.77',
      '  Trace progress: ████░░░░░░ 38%',
      '  Estimated time to source lock: 00:02:14',
      '  Recommend: reroute proxy NOW.',
    ],
    bounty: () => [
      '  ┌─ AVAILABLE CONTRACTS ──────────────────────────┐',
      '  │ [A] Steal data from ARC Corp server    ¢12,000 │',
      '  │ [B] Delete criminal record #8842-X     ¢ 8,500 │',
      '  │ [C] Plant virus on NeuraTech mainframe ¢25,000 │',
      '  │ [D] Intercept encrypted comms — AEON   ¢18,750 │',
      '  └────────────────────────────────────────────────┘',
    ],
    clear: () => [],
  };

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      const idx = Math.min(histIdx + 1, history.length - 1);
      setHistIdx(idx);
      setInput(history[idx] ?? '');
      return;
    }
    if (e.key === 'ArrowDown') {
      const idx = Math.max(histIdx - 1, -1);
      setHistIdx(idx);
      setInput(idx === -1 ? '' : history[idx] ?? '');
      return;
    }
    if (e.key !== 'Enter') return;
    const cmd = input.trim();
    if (!cmd) return;
    const [verb, ...args] = cmd.toLowerCase().split(' ');
    const newLines: string[] = [`${props.prompt ?? 'root@uplink:~$'} ${cmd}`];
    if (verb === 'connect') {
      const ip = args[0] ?? '0.0.0.0';
      newLines.push(
        `  Routing through proxy chain…`,
        `  [OK] Hop 1: TOR exit node`,
        `  [OK] Hop 2: Anonymous relay (Amsterdam)`,
        `  [OK] Connected to ${ip}`,
        `  Remote OS: UplinkOS 2.1 — 3 open ports detected (22/ssh, 80/http, 21/ftp)`,
      );
    } else if (verb === 'crack') {
      const svc = args[0] ?? 'ssh';
      newLines.push(
        `  Launching ${svc.toUpperCase()} cracker…`,
        '  [▓▓▓▓▓▓▓▓░░] 80% — dictionary attack in progress',
        '  ✓ Password found: p@ssw0rd123',
        `  ✓ ${svc.toUpperCase()} breach successful. Access granted.`,
      );
    } else if (verb === 'hack') {
      const tgt = args[0] ?? 'target';
      newLines.push(
        `  Initiating full breach of ${tgt}…`,
        '  [1/4] Scanning open ports… done',
        '  [2/4] Exploiting CVE-2024-9182… done',
        '  [3/4] Escalating privileges… done',
        '  [4/4] Installing backdoor… done',
        `  ✓ ${tgt} fully compromised. Root shell acquired.`,
        '  ⚠  Trace level increased to 62%.',
      );
    } else if (COMMANDS[verb]) {
      if (verb === 'clear') {
        setLog([]);
        setInput('');
        setHistory(h => [cmd, ...h]);
        setHistIdx(-1);
        return;
      }
      newLines.push(...COMMANDS[verb](args));
    } else {
      newLines.push(`  bash: ${verb}: command not found`);
    }
    newLines.push('');
    setLog(l => [...l, ...newLines]);
    setHistory(h => [cmd, ...h]);
    setHistIdx(-1);
    setInput('');
  };

  return (
    <div style={{
      background: '#0a0014',
      border: '1px solid #7c3aed',
      borderRadius: 8,
      padding: 16,
      fontFamily: '"Courier New", monospace',
      fontSize: 13,
      color: '#c084fc',
      minHeight: 340,
      display: 'flex',
      flexDirection: 'column',
      boxShadow: '0 0 24px #7c3aed55',
    }}>
      <div style={{ color: '#a855f7', fontWeight: 'bold', marginBottom: 8, letterSpacing: 2, fontSize: 11, borderBottom: '1px solid #3b1a6e', paddingBottom: 6 }}>
        ◈ {props.title ?? 'UPLINK OS v4.2.1'}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', maxHeight: 280, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
        {log.map((line, i) => (
          <div key={i} style={{ color: line.startsWith('  ✓') ? '#34d399' : line.startsWith('  ⚠') ? '#fbbf24' : line.startsWith('  bash:') ? '#f87171' : '#c084fc' }}>{line}</div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', marginTop: 8, borderTop: '1px solid #3b1a6e', paddingTop: 8 }}>
        <span style={{ color: '#7c3aed', marginRight: 8, flexShrink: 0 }}>{props.prompt ?? 'root@uplink:~$'}</span>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          style={{
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: '#e9d5ff',
            fontFamily: 'inherit',
            fontSize: 'inherit',
            flex: 1,
            caretColor: '#a855f7',
          }}
          autoFocus
          placeholder="type a command…"
          spellCheck={false}
          autoComplete="off"
        />
      </div>
    </div>
  );
})()
  );
}
