"use client";

import * as React from "react";
import { useElementData } from "@/state/hooks";
import type { Props } from "./schema";

export function Component(props: Props) {
  const value = useElementData<unknown>(props.bindKey, props.value);
  return (
    (() => {
  const [tick, setTick] = React.useState(0);
  const [blink, setBlink] = React.useState(true);

  React.useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 50);
    const b = setInterval(() => setBlink(v => !v), 530);
    return () => { clearInterval(t); clearInterval(b); };
  }, []);

  const items: string[] = props.items ?? [];
  const fullText = items.join('   ·   ') + '   ·   ';
  // Scroll by pixel offset derived from tick
  const charPx = 9.2;
  const totalW = fullText.length * charPx;
  const offset = (tick * 1.4) % totalW;

  const color = props.color ?? '#a855f7';
  const glow = props.glowColor ?? '#7c3aed';

  return (
    <div style={{
      position: 'relative',
      overflow: 'hidden',
      background: '#0a0014',
      border: `1px solid ${glow}`,
      borderRadius: 6,
      padding: '4px 10px',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      boxShadow: `0 0 12px ${glow}88, inset 0 0 20px #00000088`,
      minWidth: 0,
      maxWidth: 340,
    }}>
      {/* Blinking indicator */}
      <span style={{
        flexShrink: 0,
        width: 7, height: 7,
        borderRadius: '50%',
        background: blink ? color : 'transparent',
        border: `1.5px solid ${color}`,
        boxShadow: blink ? `0 0 8px ${color}` : 'none',
        transition: 'background 0.1s, box-shadow 0.1s',
        display: 'inline-block',
      }} />
      {/* Scrolling marquee text */}
      <div style={{ overflow: 'hidden', flex: 1, position: 'relative', height: 22 }}>
        <div style={{
          position: 'absolute',
          top: 2,
          left: 0,
          whiteSpace: 'nowrap',
          transform: `translateX(-${offset}px)`,
          fontFamily: '"Courier New", monospace',
          fontSize: 12,
          fontWeight: 'bold',
          letterSpacing: '0.08em',
          color,
          textShadow: `0 0 8px ${color}, 0 0 16px ${glow}`,
        }}>
          {/* Repeat text twice so it loops seamlessly */}
          {fullText}{fullText}
        </div>
      </div>
      {/* Scanline overlay */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.18) 2px, rgba(0,0,0,0.18) 4px)',
        borderRadius: 6,
      }} />
    </div>
  );
})()
  );
}
