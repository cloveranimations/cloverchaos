'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Icon from './Icons';
import TechTree from './TechTree';
import {
  BALLS, CELL, GRID_H, GRID_W, KIND_BEDROCK, KIND_GOLDEN, KIND_TOKEN,
  PALETTE, TECH_BY_ID, TIERS, ballsFor, statsFor, tierOfRow,
  type BallId, type Stats,
} from './config';
import {
  genWorld, idx, newEffects, rle, spawnVolley, stepBall, tickPoison, unrle, walkToward,
  type Arc, type Ball, type DamageCtx, type FloatText, type Particle, type SaveData, type World,
} from './engine';

const SAVE_KEY = 'blindshot.save.v2';
const WORLD_W = GRID_W * CELL;
const WORLD_H = GRID_H * CELL;
const MAX_PULL = 120;

// Colour table: 8 tiers × 8 brightness buckets, precomputed once.
function shadeHex(hex: string, mul: number): string {
  const r = Math.min(255, Math.round(parseInt(hex.slice(1, 3), 16) * mul));
  const g = Math.min(255, Math.round(parseInt(hex.slice(3, 5), 16) * mul));
  const b = Math.min(255, Math.round(parseInt(hex.slice(5, 7), 16) * mul));
  return `rgb(${r},${g},${b})`;
}
const COLOR_TABLE: string[][] = TIERS.map((t) =>
  Array.from({ length: 8 }, (_, k) => shadeHex(t.color, 0.74 + k * 0.075)),
);

function haptic(pattern: number | number[]) {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
    }
  } catch {
    /* vibration unsupported — nothing to do */
  }
}

type Hud = {
  depth: number;
  tier: number;
  broken: number;
  reload: number;
  compass: { angle: number; dist: number } | null;
};

export default function BlindShot() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const [treeOpen, setTreeOpen] = useState(false);
  const [tokens, setTokens] = useState(0);
  const [unlocked, setUnlocked] = useState<Set<string>>(() => new Set(['core']));
  const [activeBall, setActiveBall] = useState<BallId>('basic');
  const [ballCard, setBallCard] = useState<BallId | null>(null);
  const [won, setWon] = useState(false);
  const [vibeOn, setVibeOn] = useState(true);
  const [banner, setBanner] = useState<string | null>(null);
  const [hud, setHud] = useState<Hud>({ depth: 6, tier: 0, broken: 0, reload: 0, compass: null });

  // ── Mutable game state; changing these never re-renders ────────────────────
  const worldRef = useRef<World | null>(null);
  const ballsRef = useRef<Ball[]>([]);
  const playerRef = useRef({ col: 50, row: 6, x: 0, y: 0 });
  const camRef = useRef({ x: 0, y: 0 });
  const aimRef = useRef({ active: false, sx: 0, sy: 0, angle: Math.PI / 2, power: 0 });
  const pointerRef = useRef({ id: -1, t0: 0, moved: 0 });
  const statsRef = useRef<Stats>(statsFor(['core']));
  const unlockedRef = useRef<Set<string>>(unlocked);
  const activeBallRef = useRef<BallId>('basic');
  const tokensRef = useRef(0);
  const vibeRef = useRef(true);
  const pausedRef = useRef(false);
  const wonRef = useRef(false);
  const reloadRef = useRef(0);
  const shakeRef = useRef(0);
  const particlesRef = useRef<Particle[]>([]);
  const arcsRef = useRef<Arc[]>([]);
  const textsRef = useRef<FloatText[]>([]);
  const rngRef = useRef<() => number>(Math.random);
  const deepestRef = useRef(6);
  const brokenRef = useRef(0);
  const maxTierRef = useRef(0);
  const lastVibRef = useRef(0);
  const hudTimerRef = useRef(0);
  const dirtyRef = useRef(true);
  /** Set once the save has been read into refs, so the loop can push it into React. */
  const syncPendingRef = useRef(false);

  // ── Mirror React state into refs the loop reads ────────────────────────────
  useEffect(() => { tokensRef.current = tokens; }, [tokens]);
  useEffect(() => { activeBallRef.current = activeBall; }, [activeBall]);
  useEffect(() => { vibeRef.current = vibeOn; }, [vibeOn]);
  useEffect(() => { wonRef.current = won; }, [won]);
  useEffect(() => { pausedRef.current = treeOpen || won || ballCard !== null; }, [treeOpen, won, ballCard]);
  useEffect(() => {
    unlockedRef.current = unlocked;
    statsRef.current = statsFor(unlocked);
  }, [unlocked]);

  const availableBalls = useMemo(() => ballsFor(unlocked), [unlocked]);

  // ── Save / load ────────────────────────────────────────────────────────────
  const save = useCallback(() => {
    const w = worldRef.current;
    if (!w || typeof window === 'undefined') return;
    const data: SaveData = {
      v: 2,
      seed: w.seed,
      tokens: tokensRef.current,
      unlocked: Array.from(unlockedRef.current),
      ball: activeBallRef.current,
      col: playerRef.current.col,
      row: playerRef.current.row,
      deepest: deepestRef.current,
      broken: brokenRef.current,
      won: wonRef.current,
      hp: rle(w.hp),
      seen: rle(w.seen),
    };
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch {
      /* storage blocked or full — the run simply won't persist */
    }
  }, []);

  const startWorld = useCallback((seed: number, data?: SaveData) => {
    const w = genWorld(seed);
    const restored = !!data && unrle(data.hp, w.hp) && unrle(data.seen, w.seen);
    if (restored && data) {
      playerRef.current.col = data.col;
      playerRef.current.row = data.row;
      deepestRef.current = data.deepest;
      brokenRef.current = data.broken;
      maxTierRef.current = tierOfRow(data.deepest);
    } else {
      playerRef.current.col = 50;
      playerRef.current.row = 6;
      deepestRef.current = 6;
      brokenRef.current = 0;
      maxTierRef.current = 0;
    }
    playerRef.current.x = (playerRef.current.col + 0.5) * CELL;
    playerRef.current.y = (playerRef.current.row + 0.5) * CELL;
    camRef.current.x = playerRef.current.x;
    camRef.current.y = playerRef.current.y;
    ballsRef.current = [];
    particlesRef.current = [];
    arcsRef.current = [];
    textsRef.current = [];
    reloadRef.current = 0;
    shakeRef.current = 0;
    worldRef.current = w;
    dirtyRef.current = true;
  }, []);

  /**
   * Read the save into refs only. React state is caught up on the loop's first
   * frame, which keeps the server-rendered markup and the hydrated markup
   * identical — localStorage simply does not exist during SSR.
   */
  const loadIntoRefs = useCallback(() => {
    let data: SaveData | undefined;
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as SaveData;
        if (parsed && parsed.v === 2 && Array.isArray(parsed.hp) && Array.isArray(parsed.seen)) {
          data = parsed;
        }
      }
    } catch {
      data = undefined;
    }
    if (data) {
      tokensRef.current = data.tokens;
      unlockedRef.current = new Set(data.unlocked?.length ? data.unlocked : ['core']);
      statsRef.current = statsFor(unlockedRef.current);
      activeBallRef.current = data.ball ?? 'basic';
      wonRef.current = !!data.won;
      pausedRef.current = wonRef.current;
      startWorld(data.seed, data);
    } else {
      startWorld((Math.random() * 0xffffffff) >>> 0);
    }
    syncPendingRef.current = true;
  }, [startWorld]);

  // Persist after every unlock, periodically, and when the tab goes away.
  useEffect(() => { save(); }, [unlocked, save]);
  useEffect(() => {
    window.addEventListener('visibilitychange', save);
    window.addEventListener('pagehide', save);
    const t = window.setInterval(save, 15000);
    return () => {
      window.removeEventListener('visibilitychange', save);
      window.removeEventListener('pagehide', save);
      window.clearInterval(t);
    };
  }, [save]);

  const newRun = useCallback(() => {
    tokensRef.current = 0;
    setTokens(0);
    setUnlocked(new Set(['core']));
    setActiveBall('basic');
    wonRef.current = false;
    setWon(false);
    setBanner(null);
    setTreeOpen(false);
    startWorld((Math.random() * 0xffffffff) >>> 0);
    try { window.localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
  }, [startWorld]);

  // The board can sit partly below the fold; bring all of it into view first so
  // the tree's unlock button is never off-screen.
  const openTree = useCallback(() => {
    setTreeOpen(true);
    wrapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  const unlock = useCallback((id: string) => {
    const node = TECH_BY_ID[id];
    if (!node || unlocked.has(id)) return;
    if (!node.requires.every((r) => unlocked.has(r))) return;
    if (tokens < node.cost) return;

    tokensRef.current = tokens - node.cost;
    setTokens(tokensRef.current);
    const next = new Set(unlocked);
    next.add(id);
    setUnlocked(next);
    if (node.unlocksBall) {
      setBallCard(node.unlocksBall);
      setActiveBall(node.unlocksBall);
    }
    if (vibeRef.current) haptic([12, 40, 12]);
    dirtyRef.current = true;
  }, [unlocked, tokens]);

  // ── Input ──────────────────────────────────────────────────────────────────
  const screenToWorld = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scale = viewScale(rect.width);
    return {
      x: camRef.current.x + (clientX - rect.left - rect.width / 2) / scale,
      y: camRef.current.y + (clientY - rect.top - rect.height / 2) / scale,
    };
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (pausedRef.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointerRef.current = { id: e.pointerId, t0: performance.now(), moved: 0 };
    aimRef.current.active = true;
    aimRef.current.sx = e.clientX;
    aimRef.current.sy = e.clientY;
    aimRef.current.power = 0;
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!aimRef.current.active || e.pointerId !== pointerRef.current.id) return;
    // Slingshot: drag away from the target, the ball flies the other way.
    const dx = aimRef.current.sx - e.clientX;
    const dy = aimRef.current.sy - e.clientY;
    const len = Math.hypot(dx, dy);
    pointerRef.current.moved = Math.max(pointerRef.current.moved, len);
    if (len > 4) {
      aimRef.current.angle = Math.atan2(dy, dx);
      aimRef.current.power = Math.min(1, len / MAX_PULL);
    }
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!aimRef.current.active || e.pointerId !== pointerRef.current.id) return;
    aimRef.current.active = false;
    const held = performance.now() - pointerRef.current.t0;
    const moved = pointerRef.current.moved;
    pointerRef.current.id = -1;

    const w = worldRef.current;
    if (!w) return;

    if (moved < 14 && held < 320) {
      // Tap: walk toward the tapped block, stopping at the first wall.
      const p = screenToWorld(e.clientX, e.clientY);
      const target = walkToward(
        w,
        playerRef.current.col, playerRef.current.row,
        Math.floor(p.x / CELL), Math.floor(p.y / CELL),
      );
      if (target) {
        playerRef.current.col = target.col;
        playerRef.current.row = target.row;
        playerRef.current.x = (target.col + 0.5) * CELL;
        playerRef.current.y = (target.row + 0.5) * CELL;
        if (target.row > deepestRef.current) deepestRef.current = target.row;
        if (vibeRef.current) haptic(6);
        dirtyRef.current = true;
      }
      return;
    }

    if (aimRef.current.power > 0.06 && reloadRef.current <= 0) {
      const s = statsRef.current;
      const p = playerRef.current;
      ballsRef.current.push(
        ...spawnVolley(p.x, p.y, aimRef.current.angle, aimRef.current.power, activeBallRef.current, s),
      );
      reloadRef.current = s.reload;
      if (vibeRef.current) haptic(18);
    }
  }, [screenToWorld]);

  // ── Main loop ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    loadIntoRefs();

    let raf = 0;
    let last = performance.now();
    let cssW = 1;
    let cssH = 1;
    let dpr = 1;

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      cssW = Math.max(1, Math.round(rect.width));
      cssH = Math.max(1, Math.round(rect.height));
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    // Reused each frame so the hot loop allocates as little as possible.
    const dmgCtx: DamageCtx = {
      stats: statsRef.current,
      rng: rngRef.current,
      fx: newEffects(),
      ballLuck: 1,
      ballReveal: 0,
    };

    const computeCompass = (w: World, s: Stats) => {
      if (s.compass <= 0 || w.goldenIdx < 0 || w.hp[w.goldenIdx] <= 0) return null;
      const gc = w.goldenIdx % GRID_W;
      const gr = (w.goldenIdx / GRID_W) | 0;
      const dc = gc - playerRef.current.col;
      const dr = gr - playerRef.current.row;
      const dist = Math.hypot(dc, dr);
      if (dist > s.compass) return null;
      return { angle: Math.atan2(dr, dc), dist: Math.round(dist) };
    };

    const update = (w: World, dt: number, now: number) => {
      const s = statsRef.current;
      const fx = newEffects();
      dmgCtx.stats = s;
      dmgCtx.rng = rngRef.current;
      dmgCtx.fx = fx;

      // Balls.
      const alive: Ball[] = [];
      for (const b of ballsRef.current) {
        dmgCtx.ballLuck = BALLS[b.type].luckMul;
        dmgCtx.ballReveal = BALLS[b.type].revealBonus;
        stepBall(w, b, dt, dmgCtx);
        const row = Math.floor(b.y / CELL);
        if (row > deepestRef.current) deepestRef.current = row;
        if (!b.dead) alive.push(b);
      }
      ballsRef.current = alive;

      dmgCtx.ballLuck = 1;
      dmgCtx.ballReveal = 0;
      tickPoison(w, dt, dmgCtx);

      if (reloadRef.current > 0) reloadRef.current = Math.max(0, reloadRef.current - dt);

      // Drain this frame's effects into the persistent buffers.
      if (fx.particles.length) particlesRef.current.push(...fx.particles);
      if (fx.arcs.length) arcsRef.current.push(...fx.arcs);
      if (fx.texts.length) textsRef.current.push(...fx.texts);
      if (fx.shake > shakeRef.current) shakeRef.current = Math.min(30, fx.shake);
      if (fx.brokenCount) { brokenRef.current += fx.brokenCount; dirtyRef.current = true; }
      if (fx.tokensGained) {
        tokensRef.current += fx.tokensGained;
        setTokens(tokensRef.current);
        dirtyRef.current = true;
      }

      // Haptics: one call per frame, rate limited so it reads as texture, not buzz.
      if (fx.haptic > 0 && vibeRef.current) {
        const gap = fx.haptic === 1 ? 55 : fx.haptic === 2 ? 40 : 0;
        if (now - lastVibRef.current >= gap) {
          lastVibRef.current = now;
          if (fx.haptic === 1) haptic(7);
          else if (fx.haptic === 2) haptic(16);
          else if (fx.haptic === 3) haptic([10, 26, 10]);
          else haptic([30, 50, 30, 50, 90]);
        }
      }

      if (fx.goldenBroken && !wonRef.current) {
        wonRef.current = true;
        setWon(true);
        save();
      }

      // Depth milestone.
      const tier = tierOfRow(deepestRef.current);
      if (tier > maxTierRef.current) {
        maxTierRef.current = tier;
        setBanner(`LEVEL ${tier + 1} — ${TIERS[tier].name.toUpperCase()}`);
        window.setTimeout(() => setBanner(null), 2600);
        if (vibeRef.current) haptic([20, 40, 20]);
      }

      // Particles / arcs / floating text.
      const ps = particlesRef.current;
      for (let i = ps.length - 1; i >= 0; i--) {
        const p = ps[i];
        p.life -= dt;
        if (p.life <= 0) { ps.splice(i, 1); continue; }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.92;
        p.vy *= 0.92;
      }
      const as = arcsRef.current;
      for (let i = as.length - 1; i >= 0; i--) {
        as[i].life -= dt;
        if (as[i].life <= 0) as.splice(i, 1);
      }
      const ts = textsRef.current;
      for (let i = ts.length - 1; i >= 0; i--) {
        ts[i].life -= dt;
        ts[i].y -= 18 * dt;
        if (ts[i].life <= 0) ts.splice(i, 1);
      }

      shakeRef.current *= Math.pow(0.0015, dt);
      if (shakeRef.current < 0.15) shakeRef.current = 0;

      // Camera follows the balls while they fly, otherwise the player.
      let tx = playerRef.current.x;
      let ty = playerRef.current.y;
      if (ballsRef.current.length) {
        let sx = 0;
        let sy = 0;
        for (const b of ballsRef.current) { sx += b.x; sy += b.y; }
        tx = sx / ballsRef.current.length;
        ty = sy / ballsRef.current.length;
      }
      const k = 1 - Math.exp(-7 * dt);
      camRef.current.x += (tx - camRef.current.x) * k;
      camRef.current.y += (ty - camRef.current.y) * k;

      // Keep the camera inside the map. Written back so taps map to the same
      // world coordinates the player is looking at.
      const scale = viewScale(cssW);
      const halfW = cssW / 2 / scale;
      const halfH = cssH / 2 / scale;
      camRef.current.x = halfW * 2 >= WORLD_W ? WORLD_W / 2 : clamp(camRef.current.x, halfW, WORLD_W - halfW);
      camRef.current.y = halfH * 2 >= WORLD_H ? WORLD_H / 2 : clamp(camRef.current.y, halfH, WORLD_H - halfH);

      // HUD, throttled.
      hudTimerRef.current += dt;
      if (hudTimerRef.current > 0.1 || dirtyRef.current) {
        hudTimerRef.current = 0;
        dirtyRef.current = false;
        setHud({
          depth: deepestRef.current,
          tier: tierOfRow(playerRef.current.row),
          broken: brokenRef.current,
          reload: reloadRef.current / Math.max(0.0001, s.reload),
          compass: computeCompass(w, s),
        });
      }
    };

    const draw = (c: CanvasRenderingContext2D, w: World, now: number) => {
      const scale = viewScale(cssW);
      const halfW = cssW / 2 / scale;
      const halfH = cssH / 2 / scale;
      const camX = camRef.current.x;
      const camY = camRef.current.y;

      const shake = shakeRef.current;
      const jx = shake > 0 ? (Math.random() - 0.5) * shake : 0;
      const jy = shake > 0 ? (Math.random() - 0.5) * shake : 0;

      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.imageSmoothingEnabled = false;
      c.fillStyle = PALETTE.bg;
      c.fillRect(0, 0, cssW, cssH);

      c.save();
      c.translate(cssW / 2, cssH / 2);
      c.scale(scale, scale);
      c.translate(-camX + jx, -camY + jy);

      const c0 = Math.max(0, Math.floor((camX - halfW) / CELL) - 1);
      const c1 = Math.min(GRID_W - 1, Math.ceil((camX + halfW) / CELL) + 1);
      const r0 = Math.max(0, Math.floor((camY - halfH) / CELL) - 1);
      const r1 = Math.min(GRID_H - 1, Math.ceil((camY + halfH) / CELL) + 1);

      const pulse = 0.55 + 0.45 * Math.sin(now / 260);

      for (let row = r0; row <= r1; row++) {
        for (let col = c0; col <= c1; col++) {
          const i = idx(col, row);
          const x = col * CELL;
          const y = row * CELL;

          if (!w.seen[i]) {
            c.fillStyle = PALETTE.unseen;
            c.fillRect(x, y, CELL, CELL);
            continue;
          }
          const hp = w.hp[i];
          if (hp <= 0) continue; // carved out — the background shows through

          const kind = w.kind[i];

          if (kind === KIND_GOLDEN) {
            c.save();
            c.shadowColor = PALETTE.golden;
            c.shadowBlur = 26 + 14 * pulse;
            c.fillStyle = PALETTE.golden;
            c.fillRect(x, y, CELL, CELL);
            c.fillStyle = '#fff9d9';
            c.fillRect(x + 3, y + 3, CELL - 6, CELL - 6);
            c.restore();
            continue;
          }

          if (kind === KIND_TOKEN) {
            c.save();
            c.shadowColor = '#ffffff';
            c.shadowBlur = 12 + 8 * pulse;
            c.fillStyle = '#ffffff';
            c.fillRect(x, y, CELL, CELL);
            c.restore();
            const td = 1 - hp / Math.max(1, w.maxHp[i]);
            if (td > 0.02) {
              c.fillStyle = `rgba(0,0,0,${td * 0.5})`;
              c.fillRect(x, y, CELL, CELL);
            }
            continue;
          }

          if (kind === KIND_BEDROCK) {
            c.fillStyle = '#12181a';
            c.fillRect(x, y, CELL, CELL);
            c.fillStyle = '#1c2427';
            c.fillRect(x + 2, y + 2, CELL - 4, CELL - 4);
            continue;
          }

          c.fillStyle = COLOR_TABLE[w.hue[i]][w.shade[i] >> 5];
          c.fillRect(x, y, CELL, CELL);

          const dmg = 1 - hp / Math.max(1, w.maxHp[i]);
          if (dmg > 0.02) {
            c.fillStyle = `rgba(0,0,0,${dmg * 0.62})`;
            c.fillRect(x, y, CELL, CELL);
            if (dmg > 0.45) {
              c.strokeStyle = 'rgba(0,0,0,0.55)';
              c.lineWidth = 1.4;
              c.beginPath();
              c.moveTo(x + 3, y + CELL - 4);
              c.lineTo(x + CELL * 0.5, y + CELL * 0.45);
              c.lineTo(x + CELL - 3, y + 4);
              c.stroke();
            }
          }
          if (w.poisonT[i] > 0) {
            c.fillStyle = `rgba(61,220,97,${0.18 + 0.16 * pulse})`;
            c.fillRect(x, y, CELL, CELL);
          }
        }
      }

      // Chain lightning.
      if (arcsRef.current.length) {
        c.save();
        c.strokeStyle = '#f7ef7a';
        c.shadowColor = '#f4e04d';
        c.shadowBlur = 10;
        c.lineWidth = 1.6;
        for (const a of arcsRef.current) {
          c.globalAlpha = Math.min(1, a.life / 0.22);
          drawBolt(c, a.x1, a.y1, a.x2, a.y2);
        }
        c.restore();
      }

      // Debris.
      for (const p of particlesRef.current) {
        c.globalAlpha = Math.max(0, p.life / p.max);
        c.fillStyle = p.color;
        c.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
      }
      c.globalAlpha = 1;

      // Balls and their dotted trails.
      for (const b of ballsRef.current) {
        const def = BALLS[b.type];
        const t = b.trail;
        c.fillStyle = def.color;
        for (let i = 0; i < t.length - 2; i += 2) {
          c.globalAlpha = (i / Math.max(2, t.length - 2)) * 0.7;
          c.fillRect(t[i] - 1.2, t[i + 1] - 1.2, 2.4, 2.4);
        }
        c.globalAlpha = 1;
        c.save();
        c.shadowColor = def.color;
        c.shadowBlur = 12;
        c.fillStyle = def.color;
        c.beginPath();
        c.arc(b.x, b.y, 3.2, 0, Math.PI * 2);
        c.fill();
        c.restore();
      }

      const p = playerRef.current;

      // Aim preview.
      if (aimRef.current.active && aimRef.current.power > 0.06) {
        const a = aimRef.current.angle;
        const loaded = reloadRef.current <= 0;
        c.fillStyle = loaded ? PALETTE.aim : 'rgba(255,255,255,0.4)';
        const dots = Math.round(6 + aimRef.current.power * 12);
        for (let i = 1; i <= dots; i++) {
          const d = 10 + i * 9;
          c.globalAlpha = loaded ? 1 - i / (dots + 3) : 0.35;
          c.fillRect(p.x + Math.cos(a) * d - 1, p.y + Math.sin(a) * d - 1, 2, 2);
        }
        c.globalAlpha = 1;
      }

      // Player cursor: a small triangle aimed where the next shot goes.
      c.save();
      c.translate(p.x, p.y);
      c.rotate(aimRef.current.angle);
      c.strokeStyle = PALETTE.player;
      c.lineWidth = 1.6;
      c.shadowColor = PALETTE.player;
      c.shadowBlur = 8;
      c.beginPath();
      c.moveTo(6, 0);
      c.lineTo(-4, -5);
      c.lineTo(-4, 5);
      c.closePath();
      c.stroke();
      c.restore();

      // Floating pickup text.
      c.font = '600 9px monospace';
      c.textAlign = 'center';
      for (const t of textsRef.current) {
        c.globalAlpha = Math.min(1, t.life);
        c.fillStyle = t.color;
        c.fillText(t.text, t.x, t.y);
      }
      c.globalAlpha = 1;
      c.restore();
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const w = worldRef.current;
      if (!w) return;

      // First frame after a load: hand the restored run over to React. Done
      // here rather than in an effect so hydration always starts from defaults.
      if (syncPendingRef.current) {
        syncPendingRef.current = false;
        setTokens(tokensRef.current);
        setUnlocked(unlockedRef.current);
        setActiveBall(activeBallRef.current);
        setWon(wonRef.current);
      }

      if (!pausedRef.current) update(w, dt, now);
      draw(ctx, w, now);
    };

    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [loadIntoRefs, save]);

  const tierName = TIERS[hud.tier].name;

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <div
        ref={wrapRef}
        style={{
          position: 'relative',
          width: '100%',
          height: 'min(72vh, 620px)',
          border: '2px solid rgba(74,222,128,0.35)',
          background: PALETTE.bg,
          overflow: 'hidden',
          touchAction: 'none',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        <canvas
          ref={canvasRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={{ display: 'block', width: '100%', height: '100%', touchAction: 'none', cursor: 'crosshair' }}
        />

        {/* Top HUD */}
        <div
          style={{
            position: 'absolute', top: 0, left: 0, right: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 10px', pointerEvents: 'none',
            fontFamily: 'var(--font-mono, monospace)', fontSize: 11, letterSpacing: 1,
            background: 'linear-gradient(rgba(0,0,0,0.75), rgba(0,0,0,0))',
          }}
        >
          <div style={{ color: PALETTE.hud }}>
            <div style={{ fontSize: 10, opacity: 0.7 }}>DEPTH</div>
            <div style={{ fontSize: 15, color: '#fff' }}>{hud.depth}m</div>
          </div>
          <div style={{ textAlign: 'center', color: PALETTE.hud }}>
            <div style={{ fontSize: 10, opacity: 0.7 }}>LEVEL {hud.tier + 1}</div>
            <div style={{ fontSize: 13, color: TIERS[hud.tier].color }}>{tierName.toUpperCase()}</div>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', pointerEvents: 'auto' }}>
            <span style={{ color: '#fff', fontSize: 14 }}>◆ {tokens}</span>
            <button onClick={() => setVibeOn((v) => !v)} title="Toggle vibration" style={btn(vibeOn ? PALETTE.hud : '#556270')}>
              {vibeOn ? 'VIB' : 'VIB✕'}
            </button>
            <button onClick={openTree} style={btn(PALETTE.branch.magenta)}>TECH</button>
          </div>
        </div>

        {/* Compass to the golden block */}
        {hud.compass && (
          <div
            style={{
              position: 'absolute', top: 58, left: '50%', transform: 'translateX(-50%)',
              display: 'flex', alignItems: 'center', gap: 6, pointerEvents: 'none',
              background: 'rgba(0,0,0,0.6)', border: `1px solid ${PALETTE.golden}`,
              padding: '3px 8px', fontFamily: 'var(--font-mono, monospace)', fontSize: 11,
              color: PALETTE.golden, letterSpacing: 1, whiteSpace: 'nowrap',
            }}
          >
            <span style={{ display: 'inline-block', transform: `rotate(${hud.compass.angle}rad)` }}>➤</span>
            {hud.compass.dist} BLOCKS
          </div>
        )}

        {banner && (
          <div
            style={{
              position: 'absolute', top: '38%', left: 0, right: 0, textAlign: 'center',
              pointerEvents: 'none', fontFamily: 'var(--font-mono, monospace)',
              fontSize: 18, letterSpacing: 4, color: '#fff',
              textShadow: '0 0 14px rgba(74,222,128,0.9)',
            }}
          >
            {banner}
          </div>
        )}

        {/* Reload bar + ball picker */}
        <div
          style={{
            position: 'absolute', left: 0, right: 0, bottom: 0,
            padding: '6px 8px 8px',
            background: 'linear-gradient(rgba(0,0,0,0), rgba(0,0,0,0.8))',
          }}
        >
          <div style={{ height: 3, background: 'rgba(255,255,255,0.12)', marginBottom: 6 }}>
            <div
              style={{
                height: '100%',
                width: `${Math.max(0, Math.min(1, 1 - hud.reload)) * 100}%`,
                background: hud.reload > 0 ? '#94a3b8' : PALETTE.hud,
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
            {availableBalls.map((b) => {
              const def = BALLS[b];
              const on = activeBall === b;
              return (
                <button
                  key={b}
                  onClick={() => setActiveBall(b)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    background: on ? `${def.color}22` : 'rgba(0,0,0,0.6)',
                    border: `2px solid ${def.color}`,
                    opacity: on ? 1 : 0.55,
                    color: def.color, fontFamily: 'var(--font-mono, monospace)',
                    fontSize: 10, letterSpacing: 1, padding: '4px 8px', cursor: 'pointer',
                    boxShadow: on ? `0 0 10px ${def.color}88` : 'none',
                  }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: def.color, display: 'inline-block' }} />
                  {def.name.replace(' ball', '').toUpperCase()}
                </button>
              );
            })}
          </div>
        </div>

        {/* New-ball reveal card */}
        {ballCard && (
          <div
            onClick={() => setBallCard(null)}
            style={{
              // Above the tech tree: ball unlocks happen inside it, and the
              // reveal has to land on top of the tree, not behind it.
              position: 'absolute', inset: 0, zIndex: 50,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(0,0,0,0.82)', cursor: 'pointer', padding: 16,
            }}
          >
            <div
              style={{
                border: `2px solid ${BALLS[ballCard].color}`,
                background: 'rgba(0,0,0,0.92)',
                boxShadow: `0 0 26px ${BALLS[ballCard].color}66`,
                padding: '14px 24px 16px', textAlign: 'center',
                fontFamily: 'var(--font-mono, monospace)', maxWidth: 320,
              }}
            >
              <div style={{ color: BALLS[ballCard].color, fontSize: 11, letterSpacing: 2 }}>NEW BALL</div>
              <div style={{ color: '#fff', fontSize: 24, margin: '6px 0 4px' }}>{BALLS[ballCard].name}</div>
              <div style={{ color: '#8a9a90', fontSize: 12, marginBottom: 10, lineHeight: 1.5 }}>
                {BALLS[ballCard].desc}
              </div>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <Icon id="ball" color={BALLS[ballCard].color} size={26} />
              </div>
              <div style={{ color: '#5f6f66', fontSize: 10, letterSpacing: 2, marginTop: 10 }}>TAP TO CONTINUE</div>
            </div>
          </div>
        )}

        {/* Victory */}
        {won && (
          <div
            style={{
              position: 'absolute', inset: 0, zIndex: 60,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(0,0,0,0.88)', textAlign: 'center',
              fontFamily: 'var(--font-mono, monospace)', padding: 20,
            }}
          >
            <div style={{ color: PALETTE.golden, fontSize: 12, letterSpacing: 4 }}>THE GOLDEN BLOCK</div>
            <div style={{ color: '#fff', fontSize: 30, letterSpacing: 2, margin: '8px 0 4px', textShadow: `0 0 22px ${PALETTE.golden}` }}>
              FOUND IT
            </div>
            <div style={{ color: '#8a9a90', fontSize: 13, marginBottom: 18 }}>
              {hud.broken.toLocaleString()} blocks broken · {hud.depth}m deep · ◆{tokens} left over
            </div>
            <button onClick={newRun} style={{ ...btn(PALETTE.golden), fontSize: 13, padding: '10px 22px' }}>
              NEW MAP
            </button>
          </div>
        )}

        {treeOpen && (
          <TechTree unlocked={unlocked} tokens={tokens} onUnlock={unlock} onClose={() => setTreeOpen(false)} />
        )}
      </div>

      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 12, marginTop: 12, flexWrap: 'wrap',
          fontFamily: 'var(--font-mono, monospace)', fontSize: 12, color: '#64748b',
        }}
      >
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
          <span><span style={{ color: PALETTE.hud }}>HOLD + DRAG</span> — pull the sling back, release to fire</span>
          <span><span style={{ color: PALETTE.hud }}>TAP</span> — move into carved space</span>
          <span><span style={{ color: '#fff' }}>◆</span> — glowing white blocks are upgrade tokens</span>
        </div>
        <button onClick={newRun} style={btn('#64748b')}>NEW MAP</button>
      </div>
    </div>
  );
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function viewScale(cssWidth: number): number {
  const cols = cssWidth < 520 ? 16 : cssWidth < 760 ? 20 : 26;
  return cssWidth / (cols * CELL);
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function drawBolt(c: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
  const segs = 6;
  const dx = (x2 - x1) / segs;
  const dy = (y2 - y1) / segs;
  const nx = -(y2 - y1);
  const ny = x2 - x1;
  const len = Math.hypot(nx, ny) || 1;
  c.beginPath();
  c.moveTo(x1, y1);
  for (let i = 1; i < segs; i++) {
    const j = (Math.random() - 0.5) * 8;
    c.lineTo(x1 + dx * i + (nx / len) * j, y1 + dy * i + (ny / len) * j);
  }
  c.lineTo(x2, y2);
  c.stroke();
}

function btn(color: string): React.CSSProperties {
  return {
    background: 'rgba(0,0,0,0.7)',
    border: `2px solid ${color}`,
    color,
    fontFamily: 'var(--font-mono, monospace)',
    fontSize: 10,
    letterSpacing: 1.5,
    padding: '4px 8px',
    cursor: 'pointer',
  };
}
