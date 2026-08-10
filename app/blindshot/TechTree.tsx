'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Icon from './Icons';
import { PALETTE, TECH, TECH_BY_ID, type TechNode } from './config';

const SPACING = 86;
const NODE = 46;

type Props = {
  unlocked: Set<string>;
  tokens: number;
  onUnlock: (id: string) => void;
  onClose: () => void;
};

function nodeState(n: TechNode, unlocked: Set<string>, tokens: number) {
  if (unlocked.has(n.id)) return 'owned' as const;
  const ready = n.requires.every((r) => unlocked.has(r));
  if (!ready) return 'locked' as const;
  return tokens >= n.cost ? 'available' : ('short' as const);
}

export default function TechTree({ unlocked, tokens, onUnlock, onClose }: Props) {
  const [selected, setSelected] = useState<string>('core');
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ id: number; x: number; y: number; ox: number; oy: number } | null>(null);
  /** True while the last gesture was a pan, so it does not also select a node. */
  const movedRef = useRef(false);
  const viewRef = useRef<HTMLDivElement>(null);

  const bounds = useMemo(() => {
    let minC = 0, maxC = 0, minR = 0, maxR = 0;
    for (const n of TECH) {
      minC = Math.min(minC, n.col); maxC = Math.max(maxC, n.col);
      minR = Math.min(minR, n.row); maxR = Math.max(maxR, n.row);
    }
    return { minC, maxC, minR, maxR };
  }, []);

  const width = (bounds.maxC - bounds.minC) * SPACING + NODE * 3;
  const height = (bounds.maxR - bounds.minR) * SPACING + NODE * 3;

  const posOf = useCallback(
    (n: TechNode) => ({
      x: (n.col - bounds.minC) * SPACING + NODE * 1.5,
      y: (n.row - bounds.minR) * SPACING + NODE * 1.5,
    }),
    [bounds],
  );

  // Start centred on whatever the player can currently act on.
  useEffect(() => {
    const el = viewRef.current;
    if (!el) return;
    const core = TECH_BY_ID['core'];
    const p = posOf(core);
    setPan({ x: el.clientWidth / 2 - p.x, y: el.clientHeight / 2 - p.y });
  }, [posOf]);

  const onPointerDown = (e: React.PointerEvent) => {
    dragRef.current = { id: e.pointerId, x: e.clientX, y: e.clientY, ox: pan.x, oy: pan.y };
    movedRef.current = false;
    // Deliberately no pointer capture here: capturing on press would retarget
    // the resulting click away from the node buttons, making them untappable.
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!movedRef.current && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
      movedRef.current = true;
      const el = e.currentTarget as HTMLElement;
      if (el.hasPointerCapture?.(e.pointerId) === false) el.setPointerCapture(e.pointerId);
    }
    if (movedRef.current) setPan({ x: d.ox + dx, y: d.oy + dy });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (d && d.id === e.pointerId) dragRef.current = null;
  };

  const sel = TECH_BY_ID[selected];
  const selState = sel ? nodeState(sel, unlocked, tokens) : 'locked';
  const selColor = sel ? PALETTE.branch[sel.branch] : PALETTE.hud;

  return (
    <div
      style={{
        position: 'absolute', inset: 0, zIndex: 40,
        background: '#000',
        display: 'flex', flexDirection: 'column',
        fontFamily: 'var(--font-mono, monospace)',
        userSelect: 'none', WebkitUserSelect: 'none',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.12)', flexShrink: 0,
        }}
      >
        <span style={{ color: PALETTE.hud, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase' }}>
          Tech Tree
        </span>
        <span style={{ color: '#fff', fontSize: 14, letterSpacing: 1 }}>◆ {tokens}</span>
        <button
          onClick={onClose}
          style={{
            background: 'transparent', border: `2px solid ${PALETTE.hud}`, color: PALETTE.hud,
            fontFamily: 'inherit', fontSize: 11, padding: '4px 12px', cursor: 'pointer', letterSpacing: 2,
          }}
        >
          CLOSE
        </button>
      </div>

      {/* Graph */}
      <div
        ref={viewRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{
          position: 'relative', flex: 1, overflow: 'hidden',
          touchAction: 'none', cursor: 'grab',
        }}
      >
        <div
          style={{
            position: 'absolute', left: 0, top: 0, width, height,
            transform: `translate(${pan.x}px, ${pan.y}px)`,
          }}
        >
          <svg width={width} height={height} style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}>
            {TECH.map((n) =>
              n.requires.map((rid) => {
                const parent = TECH_BY_ID[rid];
                if (!parent) return null;
                const a = posOf(parent);
                const b = posOf(n);
                const lit = unlocked.has(n.id);
                const half = unlocked.has(rid);
                return (
                  <line
                    key={`${rid}->${n.id}`}
                    x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                    stroke={PALETTE.branch[n.branch]}
                    strokeWidth={2}
                    strokeDasharray="2 6"
                    strokeLinecap="round"
                    opacity={lit ? 0.9 : half ? 0.42 : 0.16}
                  />
                );
              }),
            )}
          </svg>

          {TECH.map((n) => {
            const p = posOf(n);
            const st = nodeState(n, unlocked, tokens);
            const color = PALETTE.branch[n.branch];
            const isSel = selected === n.id;
            const owned = st === 'owned';
            const dim = st === 'locked';
            return (
              <button
                key={n.id}
                onClick={() => { if (!movedRef.current) setSelected(n.id); }}
                title={n.name}
                style={{
                  position: 'absolute',
                  left: p.x - NODE / 2,
                  top: p.y - NODE / 2,
                  width: NODE,
                  height: NODE,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: owned ? `${color}26` : 'rgba(0,0,0,0.75)',
                  border: `2px solid ${color}`,
                  borderRadius: n.shape === 'circle' ? '50%' : 6,
                  opacity: dim ? 0.3 : st === 'short' ? 0.72 : 1,
                  boxShadow: isSel
                    ? `0 0 0 3px ${color}, 0 0 18px ${color}`
                    : owned ? `0 0 12px ${color}66` : 'none',
                  cursor: 'pointer', padding: 0,
                  transition: 'box-shadow 0.12s ease, opacity 0.12s ease',
                }}
              >
                <Icon id={n.icon} color={color} size={n.shape === 'circle' ? 24 : 22} />
                {!owned && n.cost > 0 && (
                  <span
                    style={{
                      position: 'absolute', bottom: -9, right: -6,
                      background: '#000', border: `1px solid ${color}`,
                      color: '#fff', fontSize: 9, lineHeight: '12px',
                      padding: '0 4px', borderRadius: 3, letterSpacing: 0.5,
                    }}
                  >
                    ◆{n.cost}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div
          style={{
            position: 'absolute', left: 10, bottom: 8, fontSize: 10,
            color: 'rgba(255,255,255,0.35)', letterSpacing: 1, pointerEvents: 'none',
          }}
        >
          DRAG TO PAN
        </div>
      </div>

      {/* Detail panel */}
      {sel && (
        <div
          style={{
            flexShrink: 0, borderTop: `2px solid ${selColor}`,
            background: 'rgba(0,0,0,0.9)', padding: '12px 14px 16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div
              style={{
                width: 34, height: 34, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: `2px solid ${selColor}`,
                borderRadius: sel.shape === 'circle' ? '50%' : 5,
                background: `${selColor}1f`,
              }}
            >
              <Icon id={sel.icon} color={selColor} size={18} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: '#fff', fontSize: 15, letterSpacing: 0.5 }}>{sel.name}</div>
              <div style={{ color: selColor, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase' }}>
                {sel.branch}
              </div>
            </div>
          </div>
          <p style={{ color: '#9fb0a5', fontSize: 12, lineHeight: 1.5, margin: '0 0 10px' }}>{sel.desc}</p>

          {selState === 'owned' ? (
            <div style={{ color: selColor, fontSize: 12, letterSpacing: 2 }}>OWNED</div>
          ) : (
            <button
              disabled={selState !== 'available'}
              onClick={() => onUnlock(sel.id)}
              style={{
                width: '100%',
                background: selState === 'available' ? selColor : 'transparent',
                border: `2px solid ${selColor}`,
                color: selState === 'available' ? '#04160c' : selColor,
                opacity: selState === 'available' ? 1 : 0.5,
                fontFamily: 'inherit', fontSize: 13, letterSpacing: 2,
                padding: '10px 0', cursor: selState === 'available' ? 'pointer' : 'not-allowed',
              }}
            >
              {selState === 'locked'
                ? 'REQUIRES PREVIOUS NODE'
                : selState === 'short'
                  ? `NEED ◆${sel.cost}`
                  : `UNLOCK  ◆${sel.cost}`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
