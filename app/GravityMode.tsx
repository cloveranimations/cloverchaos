'use client';

import { useEffect, useRef, useState } from 'react';

const CHARACTERS = [
  'https://i.imgur.com/m6CXyWD.png',
  'https://i.imgur.com/5bXuwk1.png',
  'https://i.imgur.com/H5gr7Xe.png',
  'https://i.imgur.com/0ELhwgN.png',
  'https://i.imgur.com/NUGITUU.png',
  'https://i.imgur.com/yVxWcFU.png',
];

export default function GravityMode() {
  const [active, setActive] = useState(false);
  const [isGravity, setIsGravity] = useState(true);
  const worldRef = useRef<any>(null);

  useEffect(() => {
    if (!active) {
      if (worldRef.current) {
        const { M, runner, render, engine } = worldRef.current;
        M.Runner.stop(runner);
        M.Render.stop(render);
        render.canvas.remove();
        M.World.clear(engine.world, false);
        M.Engine.clear(engine);
        worldRef.current = null;
      }
      return;
    }

    let alive = true;

    import('matter-js').then((M) => {
      if (!alive) return;

      const W = window.innerWidth;
      const H = window.innerHeight;

      const engine = M.Engine.create();
      engine.gravity.y = 1;

      const render = M.Render.create({
        element: document.body,
        engine,
        options: { width: W, height: H, background: 'transparent', wireframes: false },
      });

      Object.assign(render.canvas.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        zIndex: '8000',
        pointerEvents: 'auto',
      });

      const pad = 60;
      const walls = [
        M.Bodies.rectangle(W / 2, H + pad, W * 2, pad * 2, { isStatic: true, render: { fillStyle: 'transparent', strokeStyle: 'transparent', lineWidth: 0 } }),
        M.Bodies.rectangle(W / 2, -pad, W * 2, pad * 2, { isStatic: true, render: { fillStyle: 'transparent', strokeStyle: 'transparent', lineWidth: 0 } }),
        M.Bodies.rectangle(-pad, H / 2, pad * 2, H * 2, { isStatic: true, render: { fillStyle: 'transparent', strokeStyle: 'transparent', lineWidth: 0 } }),
        M.Bodies.rectangle(W + pad, H / 2, pad * 2, H * 2, { isStatic: true, render: { fillStyle: 'transparent', strokeStyle: 'transparent', lineWidth: 0 } }),
      ];

      const bodies: any[] = [];
      for (let i = 0; i < 12; i++) {
        const src = CHARACTERS[i % CHARACTERS.length];
        const r = 48 + Math.random() * 16;
        const body = M.Bodies.circle(
          100 + Math.random() * (W - 200),
          -r - Math.random() * 600,
          r,
          {
            restitution: 0.65,
            friction: 0.05,
            frictionAir: 0.01,
            render: {
              sprite: { texture: src, xScale: (r * 2) / 220, yScale: (r * 2) / 220 },
            },
          }
        );
        bodies.push(body);
      }

      M.World.add(engine.world, [...walls, ...bodies]);

      const mouse = M.Mouse.create(render.canvas);
      const mc = M.MouseConstraint.create(engine, {
        mouse,
        constraint: { stiffness: 0.2, render: { visible: false } },
      });
      M.World.add(engine.world, mc);
      render.mouse = mouse;

      M.Render.run(render);
      const runner = M.Runner.create();
      M.Runner.run(runner, engine);

      worldRef.current = { M, engine, render, runner, bodies };
    });

    return () => { alive = false; };
  }, [active]);

  useEffect(() => {
    if (!worldRef.current) return;
    const { M, engine, bodies } = worldRef.current;
    if (!isGravity) {
      engine.gravity.y = 0;
      bodies.forEach((b: any) => {
        M.Body.set(b, { frictionAir: 0 });
        M.Body.setVelocity(b, {
          x: (Math.random() - 0.5) * 6,
          y: (Math.random() - 0.5) * 6,
        });
      });
    } else {
      engine.gravity.y = 1;
      bodies.forEach((b: any) => {
        M.Body.set(b, { frictionAir: 0.01 });
      });
    }
  }, [isGravity]);

  const base: React.CSSProperties = {
    fontFamily: 'var(--font-display)',
    fontWeight: '700',
    fontSize: '12px',
    padding: '9px 16px',
    borderRadius: '8px',
    cursor: 'pointer',
    letterSpacing: '0.5px',
    transition: 'all 0.2s ease',
    border: 'none',
    whiteSpace: 'nowrap',
    backdropFilter: 'blur(8px)',
  };

  return (
    <div style={{ position: 'fixed', bottom: '28px', right: '24px', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
      {active && (
        <button
          onClick={() => setIsGravity(g => !g)}
          style={{
            ...base,
            background: 'rgba(167,139,250,0.15)',
            color: '#a78bfa',
            border: '1px solid rgba(167,139,250,0.35)',
            boxShadow: '0 4px 16px rgba(167,139,250,0.2)',
          }}
        >
          {isGravity ? '🌌 Switch to Space' : '🌍 Switch to Gravity'}
        </button>
      )}
      <button
        onClick={() => { setActive(a => !a); setIsGravity(true); }}
        style={{
          ...base,
          background: active
            ? 'rgba(248,113,113,0.15)'
            : 'linear-gradient(135deg,#4ade80,#22c55e)',
          color: active ? '#f87171' : '#000',
          border: active ? '1px solid rgba(248,113,113,0.35)' : 'none',
          boxShadow: active ? '0 4px 16px rgba(248,113,113,0.2)' : '0 4px 20px rgba(74,222,128,0.35)',
        }}
      >
        {active ? '✕ Exit Physics' : '⚡ Gravity Mode'}
      </button>
    </div>
  );
}
