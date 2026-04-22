'use client';

import { useEffect, useRef, useState } from 'react';

const CHARACTERS = [
  'https://i.imgur.com/mCql0R7.png',
  'https://i.imgur.com/Q7o7sou.png',
  'https://i.imgur.com/9HQpjlX.png',
  'https://i.imgur.com/OHU3bIB.png',
  'https://i.imgur.com/OAQuula.png',
  'https://i.imgur.com/p6ehws7.png',
  'https://i.imgur.com/MQm0AA3.png',
  'https://i.imgur.com/UfMmcDV.png',
];

const COUNT = CHARACTERS.length;
const SIZE = 100;

export default function GravityMode() {
  const [active, setActive] = useState(false);
  const [isGravity, setIsGravity] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worldRef = useRef<any>(null);

  useEffect(() => {
    if (!active) {
      if (worldRef.current) {
        worldRef.current.alive = false;
        const { M, runner, engine, listeners } = worldRef.current;
        M.Runner.stop(runner);
        M.World.clear(engine.world, false);
        M.Engine.clear(engine);
        listeners.forEach(([el, type, fn]: any) => el.removeEventListener(type, fn));
        if (canvasRef.current) {
          const ctx = canvasRef.current.getContext('2d');
          ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
        worldRef.current = null;
      }
      return;
    }

    let alive = true;

    import('matter-js').then((M) => {
      if (!alive || !canvasRef.current) return;

      const canvas = canvasRef.current;
      const W = window.innerWidth;
      const H = window.innerHeight;
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d')!;

      const engine = M.Engine.create();
      engine.gravity.y = 1;

      const pad = 60;
      const walls = [
        M.Bodies.rectangle(W / 2, H + pad, W * 2, pad * 2, { isStatic: true }),
        M.Bodies.rectangle(W / 2, -pad,    W * 2, pad * 2, { isStatic: true }),
        M.Bodies.rectangle(-pad, H / 2,    pad * 2, H * 2, { isStatic: true }),
        M.Bodies.rectangle(W + pad, H / 2, pad * 2, H * 2, { isStatic: true }),
      ];

      // Preload images
      const imgs = CHARACTERS.map(src => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = src;
        return img;
      });

      // Spawn bodies scattered within viewport
      const bodyData: Array<{ body: any; img: HTMLImageElement }> = [];
      for (let i = 0; i < COUNT; i++) {
        const half = SIZE / 2;
        const body = M.Bodies.rectangle(
          half + Math.random() * (W - SIZE),
          half + Math.random() * (H - SIZE),
          SIZE,
          SIZE,
          { restitution: 0.55, friction: 0.1, frictionAir: 0.01 }
        );
        bodyData.push({ body, img: imgs[i] });
      }

      M.World.add(engine.world, [...walls, ...bodyData.map(d => d.body)]);

      // Mouse drag/fling
      const mouse = M.Mouse.create(canvas);
      const mc = M.MouseConstraint.create(engine, {
        mouse,
        constraint: { stiffness: 0.2, render: { visible: false } },
      });
      M.World.add(engine.world, mc);

      const runner = M.Runner.create();
      M.Runner.run(runner, engine);

      worldRef.current = { M, engine, runner, bodyData, listeners: [], alive: true };

      // Draw loop — natural sticker edges, no clipping
      function draw() {
        if (!worldRef.current?.alive) return;
        ctx.clearRect(0, 0, W, H);
        for (const { body, img } of bodyData) {
          const { x, y } = body.position;
          const half = SIZE / 2;
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(body.angle);
          if (img.complete && img.naturalWidth > 0) {
            ctx.drawImage(img, -half, -half, SIZE, SIZE);
          }
          ctx.restore();
        }
        requestAnimationFrame(draw);
      }
      draw();

      // Scroll: up = push bodies up, down = bodies fall
      const onWheel = (e: WheelEvent) => {
        if (!worldRef.current) return;
        const force = e.deltaY * 0.00004;
        worldRef.current.bodyData.forEach(({ body }: any) => {
          M.Body.applyForce(body, body.position, { x: 0, y: force });
        });
      };
      window.addEventListener('wheel', onWheel, { passive: true });
      worldRef.current.listeners = [[window, 'wheel', onWheel]];
    });

    return () => { alive = false; };
  }, [active]);

  // Toggle gravity vs space
  useEffect(() => {
    if (!worldRef.current) return;
    const { M, engine, bodyData } = worldRef.current;
    if (!isGravity) {
      engine.gravity.y = 0;
      bodyData.forEach(({ body }: any) => {
        M.Body.set(body, { frictionAir: 0 });
        M.Body.setVelocity(body, {
          x: (Math.random() - 0.5) * 5,
          y: (Math.random() - 0.5) * 5,
        });
      });
    } else {
      engine.gravity.y = 1;
      bodyData.forEach(({ body }: any) => M.Body.set(body, { frictionAir: 0.01 }));
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
    <>
      <canvas
        ref={canvasRef}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          zIndex: 8000,
          pointerEvents: active ? 'auto' : 'none',
          display: active ? 'block' : 'none',
        }}
      />
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
            background: active ? 'rgba(248,113,113,0.15)' : 'linear-gradient(135deg,#4ade80,#22c55e)',
            color: active ? '#f87171' : '#000',
            border: active ? '1px solid rgba(248,113,113,0.35)' : 'none',
            boxShadow: active ? '0 4px 16px rgba(248,113,113,0.2)' : '0 4px 20px rgba(74,222,128,0.35)',
          }}
        >
          {active ? '✕ Exit Physics' : '⚡ Gravity Mode'}
        </button>
      </div>
    </>
  );
}
