/**
 * BlindShot — simulation. No DOM, no React: the render layer reads this and
 * draws it. Mirrors cleanly onto a Roblox server script.
 */

import {
  BALLS, BEDROCK_HP, CELL, GOLDEN_HP, GOLDEN_ROW_MAX, GOLDEN_ROW_MIN,
  GRID_H, GRID_W, KIND_BEDROCK, KIND_GOLDEN, KIND_ROCK, KIND_TOKEN,
  START_CHAMBER, START_COL, START_ROW, TIERS, TOKEN_RARITY,
  makeRng, tierOfRow,
  type BallId, type Stats,
} from './config';

export const CELLS = GRID_W * GRID_H;

export function idx(col: number, row: number): number {
  return row * GRID_W + col;
}

export type World = {
  hp: Int16Array;
  maxHp: Int16Array;
  kind: Uint8Array;
  /** Tier index used for the block's colour — speckled, not always its own tier. */
  hue: Uint8Array;
  /** Per-block brightness jitter, 0..255. */
  shade: Uint8Array;
  seen: Uint8Array;
  poisonT: Float32Array;
  poisonD: Float32Array;
  poisoned: Set<number>;
  goldenIdx: number;
  seed: number;
};

export function inBounds(col: number, row: number): boolean {
  return col >= 0 && col < GRID_W && row >= 0 && row < GRID_H;
}

export function isSolid(w: World, col: number, row: number): boolean {
  if (!inBounds(col, row)) return true;
  return w.hp[idx(col, row)] > 0;
}

// ─── World generation ─────────────────────────────────────────────────────────

export function genWorld(seed: number): World {
  const rng = makeRng(seed);
  const w: World = {
    hp: new Int16Array(CELLS),
    maxHp: new Int16Array(CELLS),
    kind: new Uint8Array(CELLS),
    hue: new Uint8Array(CELLS),
    shade: new Uint8Array(CELLS),
    seen: new Uint8Array(CELLS),
    poisonT: new Float32Array(CELLS),
    poisonD: new Float32Array(CELLS),
    poisoned: new Set<number>(),
    goldenIdx: -1,
    seed,
  };

  for (let row = 0; row < GRID_H; row++) {
    const tier = tierOfRow(row);
    const base = TIERS[tier].hp;
    for (let col = 0; col < GRID_W; col++) {
      const i = idx(col, row);
      w.shade[i] = Math.floor(rng() * 256);

      // Speckle in neighbouring tier colours so seams look like real strata.
      let hue = tier;
      const roll = rng();
      if (roll < 0.09 && tier > 0) hue = tier - 1;
      else if (roll < 0.17 && tier < TIERS.length - 1) hue = tier + 1;
      w.hue[i] = hue;

      const edge = col === 0 || col === GRID_W - 1 || row === 0 || row === GRID_H - 1;
      if (edge) {
        w.kind[i] = KIND_BEDROCK;
        w.hp[i] = BEDROCK_HP;
        w.maxHp[i] = BEDROCK_HP;
        continue;
      }

      const hp = Math.max(1, Math.round(base * (0.75 + rng() * 0.55)));
      w.hp[i] = hp;
      w.maxHp[i] = hp;
      w.kind[i] = rng() * TOKEN_RARITY < 1 ? KIND_TOKEN : KIND_ROCK;
    }
  }

  // A handful of natural voids so the map is not a uniform slab.
  const voids = 26;
  for (let v = 0; v < voids; v++) {
    const cc = 4 + Math.floor(rng() * (GRID_W - 8));
    const cr = 12 + Math.floor(rng() * (GRID_H - 20));
    const rad = 1.5 + rng() * 2.5;
    carve(w, cc, cr, rad);
  }

  // The prize. Always deep, never inside a void, never on the border.
  let gi = -1;
  for (let attempt = 0; attempt < 400 && gi < 0; attempt++) {
    const gc = 6 + Math.floor(rng() * (GRID_W - 12));
    const gr = GOLDEN_ROW_MIN + Math.floor(rng() * (GOLDEN_ROW_MAX - GOLDEN_ROW_MIN + 1));
    const i = idx(gc, gr);
    if (w.hp[i] > 0 && w.kind[i] !== KIND_BEDROCK) gi = i;
  }
  if (gi < 0) gi = idx(GRID_W >> 1, GOLDEN_ROW_MAX);
  w.kind[gi] = KIND_GOLDEN;
  w.hp[gi] = GOLDEN_HP;
  w.maxHp[gi] = GOLDEN_HP;
  w.goldenIdx = gi;

  // Starting chamber, always clear.
  carve(w, START_COL, START_ROW, START_CHAMBER);
  reveal(w, START_COL, START_ROW, START_CHAMBER + 2.5);

  return w;
}

function carve(w: World, cc: number, cr: number, rad: number) {
  const r = Math.ceil(rad);
  for (let row = cr - r; row <= cr + r; row++) {
    for (let col = cc - r; col <= cc + r; col++) {
      if (!inBounds(col, row)) continue;
      const i = idx(col, row);
      if (w.kind[i] === KIND_BEDROCK || w.kind[i] === KIND_GOLDEN) continue;
      const dc = col - cc;
      const dr = row - cr;
      if (dc * dc + dr * dr <= rad * rad) {
        w.hp[i] = 0;
        w.kind[i] = KIND_ROCK;
      }
    }
  }
}

/** Mark everything within `rad` blocks of (cc, cr) as no longer hidden. */
export function reveal(w: World, cc: number, cr: number, rad: number) {
  const r = Math.ceil(rad);
  const r2 = rad * rad;
  for (let row = cr - r; row <= cr + r; row++) {
    if (row < 0 || row >= GRID_H) continue;
    for (let col = cc - r; col <= cc + r; col++) {
      if (col < 0 || col >= GRID_W) continue;
      const dc = col - cc;
      const dr = row - cr;
      if (dc * dc + dr * dr <= r2) w.seen[idx(col, row)] = 1;
    }
  }
}

// ─── Effects the renderer / UI consumes ───────────────────────────────────────

export type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string };
export type Arc = { x1: number; y1: number; x2: number; y2: number; life: number };
export type FloatText = { x: number; y: number; life: number; text: string; color: string };

export type Effects = {
  particles: Particle[];
  arcs: Arc[];
  texts: FloatText[];
  shake: number;
  /** Vibration budget for this frame: 0 none, 1 soft tap, 2 break, 3 token, 4 golden. */
  haptic: number;
  tokensGained: number;
  brokenCount: number;
  goldenHit: boolean;
  goldenBroken: boolean;
};

export function newEffects(): Effects {
  return {
    particles: [], arcs: [], texts: [], shake: 0, haptic: 0,
    tokensGained: 0, brokenCount: 0, goldenHit: false, goldenBroken: false,
  };
}

// ─── Damage ───────────────────────────────────────────────────────────────────

export type DamageCtx = {
  stats: Stats;
  rng: () => number;
  fx: Effects;
  ballLuck: number;
  ballReveal: number;
};

const TIER_COLORS = TIERS.map((t) => t.color);

/**
 * Apply `amount` damage to one block. Returns true if the block broke.
 * `soft` hits (splash, poison, chain) do not themselves trigger haptics.
 */
export function damageBlock(
  w: World, col: number, row: number, amount: number, ctx: DamageCtx, soft: boolean,
): boolean {
  if (!inBounds(col, row)) return false;
  const i = idx(col, row);
  if (w.hp[i] <= 0) return false;
  if (w.kind[i] === KIND_BEDROCK) return false;

  const golden = w.kind[i] === KIND_GOLDEN;
  const next = w.hp[i] - amount;

  const cx = (col + 0.5) * CELL;
  const cy = (row + 0.5) * CELL;

  if (next > 0) {
    w.hp[i] = next;
    if (golden) {
      ctx.fx.goldenHit = true;
      ctx.fx.haptic = Math.max(ctx.fx.haptic, 3);
      spray(ctx.fx, cx, cy, '#ffd23d', 5, ctx.rng);
    } else if (!soft) {
      // A hit that does not break still thumps.
      ctx.fx.haptic = Math.max(ctx.fx.haptic, 1);
      spray(ctx.fx, cx, cy, TIER_COLORS[w.hue[i]], 2, ctx.rng);
    }
    return false;
  }

  // Broken.
  w.hp[i] = 0;
  const kind = w.kind[i];
  w.kind[i] = KIND_ROCK;
  clearPoison(w, i);
  ctx.fx.brokenCount++;
  reveal(w, col, row, ctx.stats.revealRadius + ctx.ballReveal);

  if (kind === KIND_GOLDEN) {
    ctx.fx.goldenBroken = true;
    ctx.fx.haptic = 4;
    ctx.fx.shake = Math.max(ctx.fx.shake, 26);
    spray(ctx.fx, cx, cy, '#ffd23d', 60, ctx.rng);
    return true;
  }

  if (kind === KIND_TOKEN) {
    // Deep rock takes far longer to break, so a token found down there is worth
    // more — otherwise income dries up exactly where upgrades matter most.
    const depthBonus = 1 + tierOfRow(row) * 0.35;
    const gained = Math.max(1, Math.round(ctx.stats.luck * ctx.ballLuck * depthBonus));
    ctx.fx.tokensGained += gained;
    ctx.fx.haptic = Math.max(ctx.fx.haptic, 3);
    ctx.fx.texts.push({ x: cx, y: cy, life: 1.1, text: `+${gained}`, color: '#ffffff' });
    spray(ctx.fx, cx, cy, '#ffffff', 16, ctx.rng);
  } else {
    ctx.fx.haptic = Math.max(ctx.fx.haptic, 2);
    spray(ctx.fx, cx, cy, TIER_COLORS[w.hue[i]], 6, ctx.rng);
    // Luck also shakes the odd token out of plain rock.
    const bonus = (ctx.stats.luck - 1) * ctx.ballLuck * 0.006;
    if (bonus > 0 && ctx.rng() < bonus) {
      ctx.fx.tokensGained += 1;
      ctx.fx.texts.push({ x: cx, y: cy, life: 1.1, text: '+1', color: '#ffffff' });
    }
  }
  ctx.fx.shake = Math.max(ctx.fx.shake, 2.5);
  return true;
}

function spray(fx: Effects, x: number, y: number, color: string, n: number, rng: () => number) {
  if (fx.particles.length > 320) return;
  for (let k = 0; k < n; k++) {
    const a = rng() * Math.PI * 2;
    const sp = 20 + rng() * 110;
    const life = 0.25 + rng() * 0.45;
    fx.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life, max: life, color });
  }
}

function clearPoison(w: World, i: number) {
  if (w.poisonT[i] > 0) {
    w.poisonT[i] = 0;
    w.poisonD[i] = 0;
    w.poisoned.delete(i);
  }
}

function addPoison(w: World, col: number, row: number, dps: number, time: number) {
  if (!inBounds(col, row)) return;
  const i = idx(col, row);
  if (w.hp[i] <= 0 || w.kind[i] === KIND_BEDROCK) return;
  w.poisonD[i] = Math.max(w.poisonD[i], dps);
  w.poisonT[i] = Math.max(w.poisonT[i], time);
  w.poisoned.add(i);
}

// ─── A full impact: direct damage + splash + chain + poison ───────────────────

export function applyImpact(
  w: World, col: number, row: number, ballId: BallId, ctx: DamageCtx,
): boolean {
  const ball = BALLS[ballId];
  const s = ctx.stats;
  const direct = s.damage * s.damageMul * ball.damageMul;

  const broke = damageBlock(w, col, row, direct, ctx, false);

  // Splash.
  const radius = s.splashRadius + ball.splashBonus;
  if (radius > 0 && s.splashFactor + ball.splashBonus * 0.2 > 0) {
    const factor = s.splashFactor + (ball.splashBonus > 0 ? 0.35 : 0);
    const r = Math.ceil(radius);
    for (let dr = -r; dr <= r; dr++) {
      for (let dc = -r; dc <= r; dc++) {
        if (dc === 0 && dr === 0) continue;
        const dist = Math.hypot(dc, dr);
        if (dist > radius) continue;
        const falloff = 1 - dist / (radius + 1);
        damageBlock(w, col + dc, row + dr, direct * factor * falloff, ctx, true);
      }
    }
    ctx.fx.shake = Math.max(ctx.fx.shake, 3 + radius * 1.5);
  }

  // Chain lightning.
  if (ball.chains) {
    chain(w, col, row, ctx, direct);
  }

  // Poison.
  const poisonDps = (ball.poisons ? s.poisonDps : 0) + s.poisonBase;
  if (poisonDps > 0) {
    addPoison(w, col, row, poisonDps, s.poisonTime);
    if (ball.poisons) {
      addPoison(w, col + 1, row, poisonDps * 0.6, s.poisonTime);
      addPoison(w, col - 1, row, poisonDps * 0.6, s.poisonTime);
      addPoison(w, col, row + 1, poisonDps * 0.6, s.poisonTime);
      addPoison(w, col, row - 1, poisonDps * 0.6, s.poisonTime);
    }
  }

  return broke;
}

function chain(w: World, col: number, row: number, ctx: DamageCtx, direct: number) {
  const s = ctx.stats;
  const range = Math.ceil(s.chainRange);
  const targets: number[] = [];
  for (let dr = -range; dr <= range; dr++) {
    for (let dc = -range; dc <= range; dc++) {
      if (dc === 0 && dr === 0) continue;
      const c = col + dc;
      const r = row + dr;
      if (!inBounds(c, r)) continue;
      if (Math.hypot(dc, dr) > s.chainRange) continue;
      const i = idx(c, r);
      if (w.hp[i] > 0 && w.kind[i] !== KIND_BEDROCK) targets.push(i);
    }
  }
  // Shuffle-lite: pick random distinct targets.
  let fromX = (col + 0.5) * CELL;
  let fromY = (row + 0.5) * CELL;
  const n = Math.min(s.chainTargets, targets.length);
  for (let k = 0; k < n; k++) {
    const pick = targets.splice(Math.floor(ctx.rng() * targets.length), 1)[0];
    const tc = pick % GRID_W;
    const tr = (pick / GRID_W) | 0;
    const tx = (tc + 0.5) * CELL;
    const ty = (tr + 0.5) * CELL;
    ctx.fx.arcs.push({ x1: fromX, y1: fromY, x2: tx, y2: ty, life: 0.22 });
    damageBlock(w, tc, tr, direct * s.chainDamage, ctx, true);
    fromX = tx;
    fromY = ty;
  }
}

/** Poison ticks. Called once per frame with the real delta. */
export function tickPoison(w: World, dt: number, ctx: DamageCtx) {
  if (w.poisoned.size === 0) return;
  const spreading = ctx.stats.poisonSpreads;
  const toSpread: number[] = [];
  for (const i of Array.from(w.poisoned)) {
    if (w.hp[i] <= 0) { clearPoison(w, i); continue; }
    const col = i % GRID_W;
    const row = (i / GRID_W) | 0;
    const before = w.hp[i];
    damageBlock(w, col, row, w.poisonD[i] * dt, ctx, true);
    w.poisonT[i] -= dt;
    if (w.hp[i] <= 0 && before > 0 && spreading) toSpread.push(i);
    if (w.poisonT[i] <= 0) clearPoison(w, i);
  }
  for (const i of toSpread) {
    const col = i % GRID_W;
    const row = (i / GRID_W) | 0;
    const dps = ctx.stats.poisonDps * 0.7;
    addPoison(w, col + 1, row, dps, ctx.stats.poisonTime);
    addPoison(w, col - 1, row, dps, ctx.stats.poisonTime);
    addPoison(w, col, row + 1, dps, ctx.stats.poisonTime);
    addPoison(w, col, row - 1, dps, ctx.stats.poisonTime);
  }
}

// ─── Balls ────────────────────────────────────────────────────────────────────

export type Ball = {
  x: number; y: number;
  vx: number; vy: number;
  bounces: number;
  life: number;
  type: BallId;
  /** Recent positions for the dotted trail, newest last: [x, y, x, y, …]. */
  trail: number[];
  dead: boolean;
};

export function spawnVolley(
  px: number, py: number, angle: number, power: number, type: BallId, s: Stats,
): Ball[] {
  const def = BALLS[type];
  const speed = s.speed * def.speedMul * (0.45 + power * 0.55);
  const out: Ball[] = [];
  const n = Math.max(1, Math.round(s.projectiles));
  for (let k = 0; k < n; k++) {
    const offset = n === 1 ? 0 : (k / (n - 1) - 0.5) * s.spreadAngle * (n - 1);
    const a = angle + offset;
    out.push({
      x: px, y: py,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      bounces: Math.round(s.bounces),
      life: s.lifetime,
      type,
      trail: [px, py],
      dead: false,
    });
  }
  return out;
}

const MAX_STEP = CELL * 0.4;
const TRAIL_POINTS = 14;

export function stepBall(w: World, b: Ball, dt: number, ctx: DamageCtx) {
  const def = BALLS[b.type];
  const speed = Math.hypot(b.vx, b.vy);
  if (speed < 1) { b.dead = true; return; }

  const dist = speed * dt;
  const steps = Math.max(1, Math.ceil(dist / MAX_STEP));
  const h = dt / steps;

  for (let step = 0; step < steps && !b.dead; step++) {
    // Horizontal.
    const nx = b.x + b.vx * h;
    let col = Math.floor(nx / CELL);
    let row = Math.floor(b.y / CELL);
    if (isSolid(w, col, row)) {
      const broke = applyImpact(w, col, row, b.type, ctx);
      if (broke) {
        b.x = nx;
      } else if (def.pierce && !isBedrock(w, col, row)) {
        b.x = nx;
        b.vx *= 0.82;
        b.vy *= 0.82;
      } else {
        b.vx = -b.vx;
        b.bounces--;
      }
    } else {
      b.x = nx;
    }
    if (b.bounces < 0) { b.dead = true; break; }

    // Vertical.
    const ny = b.y + b.vy * h;
    col = Math.floor(b.x / CELL);
    row = Math.floor(ny / CELL);
    if (isSolid(w, col, row)) {
      const broke = applyImpact(w, col, row, b.type, ctx);
      if (broke) {
        b.y = ny;
      } else if (def.pierce && !isBedrock(w, col, row)) {
        b.y = ny;
        b.vx *= 0.82;
        b.vy *= 0.82;
      } else {
        b.vy = -b.vy;
        b.bounces--;
      }
    } else {
      b.y = ny;
    }
    if (b.bounces < 0) { b.dead = true; break; }
  }

  b.life -= dt;
  if (b.life <= 0) b.dead = true;

  const bc = Math.floor(b.x / CELL);
  const br = Math.floor(b.y / CELL);
  reveal(w, bc, br, ctx.stats.revealRadius + def.revealBonus);

  b.trail.push(b.x, b.y);
  if (b.trail.length > TRAIL_POINTS * 2) b.trail.splice(0, b.trail.length - TRAIL_POINTS * 2);
}

function isBedrock(w: World, col: number, row: number): boolean {
  if (!inBounds(col, row)) return true;
  return w.kind[idx(col, row)] === KIND_BEDROCK;
}

// ─── Player movement ──────────────────────────────────────────────────────────

export const PLAYER_REACH = 15;

/**
 * Walk from the player toward a tapped block, stopping just before the first
 * wall. Returns the block the player ends up in, or null if it cannot move.
 */
export function walkToward(
  w: World, fromCol: number, fromRow: number, toCol: number, toRow: number,
): { col: number; row: number } | null {
  const dc = toCol - fromCol;
  const dr = toRow - fromRow;
  const dist = Math.hypot(dc, dr);
  if (dist < 0.5) return null;

  const capped = Math.min(dist, PLAYER_REACH);
  const stepC = dc / dist;
  const stepR = dr / dist;

  let lastCol = fromCol;
  let lastRow = fromRow;
  const samples = Math.ceil(capped * 4);
  for (let k = 1; k <= samples; k++) {
    const t = (k / samples) * capped;
    const c = Math.round(fromCol + stepC * t);
    const r = Math.round(fromRow + stepR * t);
    if (!inBounds(c, r) || w.hp[idx(c, r)] > 0) break;
    lastCol = c;
    lastRow = r;
  }
  if (lastCol === fromCol && lastRow === fromRow) return null;
  return { col: lastCol, row: lastRow };
}

// ─── Save / load ──────────────────────────────────────────────────────────────

export type SaveData = {
  v: number;
  seed: number;
  tokens: number;
  unlocked: string[];
  ball: BallId;
  col: number;
  row: number;
  deepest: number;
  broken: number;
  won: boolean;
  /** Run-length encoded hp grid: [count, value, count, value, …]. */
  hp: number[];
  /** Run-length encoded seen grid. */
  seen: number[];
};

export function rle(arr: ArrayLike<number>): number[] {
  const out: number[] = [];
  let run = 1;
  for (let i = 1; i <= arr.length; i++) {
    if (i < arr.length && arr[i] === arr[i - 1] && run < 65535) {
      run++;
    } else {
      out.push(run, arr[i - 1]);
      run = 1;
    }
  }
  return out;
}

export function unrle(data: number[], into: Int16Array | Uint8Array): boolean {
  let p = 0;
  for (let i = 0; i + 1 < data.length; i += 2) {
    const count = data[i];
    const value = data[i + 1];
    for (let k = 0; k < count; k++) {
      if (p >= into.length) return false;
      into[p++] = value;
    }
  }
  return p === into.length;
}
