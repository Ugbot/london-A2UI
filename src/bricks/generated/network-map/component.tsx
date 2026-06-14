"use client";

import * as React from "react";
import { useElementData } from "@/state/hooks";
import type { Props } from "./schema";

export function Component(props: Props) {
  const value = useElementData<unknown>(props.bindKey, props.value);
  return (
    (() => {
  const [selected, setSelected] = React.useState<string | null>(null);
  const [pinged, setPinged] = React.useState<string | null>(null);

  const nodeColors: Record<string, string> = {
    hub:    '#a855f7',
    proxy:  '#22d3ee',
    target: '#f97316',
    secure: '#ef4444',
    pwned:  '#34d399',
  };

  const handleClick = (id: string) => {
    setSelected(id);
    setPinged(id);
    setTimeout(() => setPinged(null), 600);
  };

  const nodes = props.nodes ?? [];
  const links = props.links ?? [];
  const nodeMap = Object.fromEntries(nodes.map((n: any) => [n.id, n]));
  const sel = nodes.find((n: any) => n.id === selected);

  return (
    <div style={{ background: '#06000f', border: '1px solid #4c1d95', borderRadius: 8, padding: 12, boxShadow: '0 0 32px #4c1d9555' }}>
      <div style={{ color: '#a855f7', fontFamily: 'monospace', fontSize: 11, letterSpacing: 2, marginBottom: 8, borderBottom: '1px solid #3b1a6e', paddingBottom: 6 }}>◈ GLOBAL NETWORK MAP — UPLINK SYSTEMS</div>
      <svg viewBox="0 0 100 100" width="100%" style={{ display: 'block' }}>
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="0.8" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        {links.map((l: any, i: number) => {
          const s = nodeMap[l.source], t = nodeMap[l.target];
          if (!s || !t) return null;
          return (
            <line key={i}
              x1={s.x} y1={s.y} x2={t.x} y2={t.y}
              stroke="#7c3aed" strokeWidth={0.4} strokeDasharray="2,1.5"
              opacity={0.6}
            />
          );
        })}
        {nodes.map((n: any) => {
          const color = nodeColors[n.type] ?? '#a855f7';
          const isSelected = selected === n.id;
          const isPinged = pinged === n.id;
          const lines = n.label.split('\n');
          return (
            <g key={n.id} onClick={() => handleClick(n.id)} style={{ cursor: 'pointer' }}>
              <circle cx={n.x} cy={n.y} r={isPinged ? 5 : isSelected ? 4 : 3}
                fill={color} opacity={isPinged ? 1 : isSelected ? 0.95 : 0.7}
                filter="url(#glow)"
                style={{ transition: 'r 0.2s, opacity 0.2s' }}
              />
              <circle cx={n.x} cy={n.y} r={isSelected ? 6 : 4}
                fill="none" stroke={color} strokeWidth={0.5} opacity={isSelected ? 0.8 : 0.3}
                strokeDasharray={isSelected ? '2,1' : 'none'}
              />
              {lines.map((line: string, li: number) => (
                <text key={li} x={n.x} y={n.y + 6 + li * 3.5}
                  textAnchor="middle" fill={color}
                  fontSize={2.8} fontFamily="monospace" opacity={0.9}
                >{line}</text>
              ))}
            </g>
          );
        })}
      </svg>
      <div style={{ marginTop: 8, fontFamily: 'monospace', fontSize: 11, color: '#c084fc', minHeight: 36, borderTop: '1px solid #3b1a6e', paddingTop: 6 }}>
        {sel ? (
          <span>▶ <strong style={{ color: nodeColors[sel.type] }}>{sel.label.replace('\n', ' ')}</strong> — type: <span style={{ color: nodeColors[sel.type] }}>{sel.type.toUpperCase()}</span> &nbsp;|&nbsp; IP: {sel.id}.uplink.net &nbsp;|&nbsp; Click to route connection via terminal</span>
        ) : (
          <span style={{ opacity: 0.5 }}>Click a node to inspect…</span>
        )}
      </div>
    </div>
  );
})()
  );
}
