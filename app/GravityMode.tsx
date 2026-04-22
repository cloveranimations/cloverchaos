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

const SIZE = 120;

type Vec2 = { x: number; y: number };

function convexHull(points: Vec2[]): Vec2[] {
  const n = points.length;
  if (n < 3) return points;
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const lower: Vec2[] = [];
  for (const p of sorted) {
    while (lower.length >= 2) {
      const o = lower[lower.length - 2], a = lower[lower.length - 1];
      if ((a.x - o.x) * (p.y - o.y) - (a.y - o.y) * (p.x - o.x) <= 0) lower.pop();
      else break;
    }
    lower.push(p);
  }
  const upper: Vec2[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2) {
      const o = upper[upper.length - 2], a = upper[upper.length - 1];
      if ((a.x - o.x) * (p.y - o.y) - (a.y - o.y) * (p.x - o.x) <= 0) upper.pop();
      else break;
    }
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return [...lower, ...upper];
}

function getSilhouette(img: HTMLImageElement, size: number): Vec2[] {
  const off = document.createElement('canvas');
  off.width = size;
  off.height = size;
  const octx = off.getContext('2d', { willReadFrequently: true })!;
  octx.drawImage(img, 0, 0, size, size);
  const { data } = octx.getImageData(0, 0, size, size);
  const pts: Vec2[] = [];
  const step = 3;
  for (let y = 0; y < size; y += step) {
    for (let x = 0; x < size; x += step) {
      if (data[(y * size + x) * 4 + 3] > 20) {
        pts.push({ x: x - size / 2, y: y - size / 2 });
      }
    }
  }
  const hull = convexHull(pts);
  // Center hull around its centroid so body.position ≈ image center
  const cx = hull.reduce((s, p) => s + p.x, 0) / hull.length;
  const cy = hull.reduce((s, p) => s + p.y, 0) / hull.length;
  return hull.map(p => ({ x: p.x - cx, y: p.y - cy }));
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export default function GravityMode() {
  const [unlocked, setUnlocked] = useState(false);
  const [active, setActive] = useState(false);
  const [isGravity, setIsGravity] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worldRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('gravityUnlocked') === '1') {
      setUnlocked(true);
    }
    const handler = () => setUnlocked(true);
    window.addEventListener('gravityUnlocked', handler);
    return () => window.removeEventListener('gravityUnlocked', handler);
  }, []);

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

    async function init() {
      const [M, ...imgs] = await Promise.all([
        import('matter-js'),
        ...CHARACTERS.map(loadImage),
      ]);

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

      const bodyData: Array<{ body: any; img: HTMLImageElement }> = [];
      for (let i = 0; i < imgs.length; i++) {
        const img = imgs[i];
        const vertices = getSilhouette(img, SIZE);
        const spawnX = SIZE / 2 + Math.random() * (W - SIZE);
        const spawnY = SIZE / 2 + Math.random() * (H - SIZE);

        let body: any;
        try {
          body = (M.Bodies as any).fromVertices(spawnX, spawnY, vertices, {
            restitution: 0.5,
            friction: 0.1,
            frictionAir: 0.01,
          }, true);
          M.Body.setPosition(body, { x: spawnX, y: spawnY });
        } catch {
          body = M.Bodies.rectangle(spawnX, spawnY, SIZE, SIZE, {
            restitution: 0.5,
            friction: 0.1,
            frictionAir: 0.01,
          });
        }
        bodyData.push({ body, img });
      }

      M.World.add(engine.world, [...walls, ...bodyData.map(d => d.body)]);

      const mouse = M.Mouse.create(canvas);
      const mc = M.MouseConstraint.create(engine, {
        mouse,
        constraint: { stiffness: 0.2, render: { visible: false } },
      });
      M.World.add(engine.world, mc);

      const runner = M.Runner.create();
      M.Runner.run(runner, engine);

      worldRef.current = { M, engine, runner, bodyData, listeners: [], alive: true };

      function draw() {
        if (!worldRef.current?.alive) return;
        ctx.clearRect(0, 0, W, H);
        for (const { body, img } of bodyData) {
          const { x, y } = body.position;
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(body.angle);
          ctx.drawImage(img, -SIZE / 2, -SIZE / 2, SIZE, SIZE);
          ctx.restore();
        }
        requestAnimationFrame(draw);
      }
      draw();

      const onWheel = (e: WheelEvent) => {
        if (!worldRef.current) return;
        const force = e.deltaY * 0.00004;
        worldRef.current.bodyData.forEach(({ body }: any) => {
          M.Body.applyForce(body, body.position, { x: 0, y: force });
        });
      };
      window.addEventListener('wheel', onWheel, { passive: true });
      worldRef.current.listeners = [[window, 'wheel', onWheel]];
    }

    init();
    return () => { alive = false; };
  }, [active]);

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
      <div style={{ position: 'fixed', bottom: '28px', right: '24px', zIndex: 9999, display: unlocked ? 'flex' : 'none', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
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
