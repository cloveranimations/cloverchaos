/*
 * BlindShot — simulation. No DOM, no canvas.
 *
 * The 1:1 mirror of the Luau `Engine` module: world generation, ball
 * physics, block damage and the light propagation all live here as plain
 * math over typed arrays. Reads its data from config.js.
 */
'use strict';


const CELLS = GRID_W * GRID_H;
const idx = (col, row) => row * GRID_W + col;
const inBounds = (col, row) => col >= 0 && col < GRID_W && row >= 0 && row < GRID_H;
const isSolid = (w, col, row) => (inBounds(col, row) ? w.hp[idx(col, row)] > 0 : true);
const isBedrock = (w, col, row) => (inBounds(col, row) ? w.kind[idx(col, row)] === KIND_BEDROCK : true);

function genWorld(seed) {
  const rng = makeRng(seed);
  const w = {
    hp: new Int16Array(CELLS),
    maxHp: new Int16Array(CELLS),
    kind: new Uint8Array(CELLS),
    hue: new Uint8Array(CELLS),
    shade: new Uint8Array(CELLS),
    seen: new Uint8Array(CELLS),
    poisonT: new Float32Array(CELLS),
    poisonD: new Float32Array(CELLS),
    poisonB: new Int8Array(CELLS),
    poisoned: new Set(),
    goldenIdx: -1,
    goldenSighted: false,
    seed,
  };

  // Spawn is picked before a single block is rolled, because it is the origin
  // every tier is measured from. One of the four corners, inset far enough that
  // the starting chamber never eats into the bedrock border.
  const spawnCol = rng() < 0.5 ? 6 + Math.floor(rng() * 13) : GRID_W - 19 + Math.floor(rng() * 13);
  const spawnRow = rng() < 0.5 ? 6 + Math.floor(rng() * 13) : GRID_H - 19 + Math.floor(rng() * 13);
  w.spawnCol = spawnCol;
  w.spawnRow = spawnRow;

  for (let row = 0; row < GRID_H; row++) {
    for (let col = 0; col < GRID_W; col++) {
      const i = idx(col, row);
      const tier = tierOfDist(distFrom(col, row, spawnCol, spawnRow));
      w.shade[i] = Math.floor(rng() * 256);

      // Speckle neighbouring tier colours in so the rings read as real strata
      // instead of clean contour lines.
      let hue = tier;
      const roll = rng();
      if (roll < 0.09 && tier > 0) hue = tier - 1;
      else if (roll < 0.17 && tier < TIERS.length - 1) hue = tier + 1;
      w.hue[i] = hue;

      if (col === 0 || col === GRID_W - 1 || row === 0 || row === GRID_H - 1) {
        w.kind[i] = KIND_BEDROCK;
        w.hp[i] = BEDROCK_HP;
        w.maxHp[i] = BEDROCK_HP;
        continue;
      }

      const hp = Math.max(1, Math.round(TIERS[tier].hp * (0.75 + rng() * 0.55)));
      w.hp[i] = hp;
      w.maxHp[i] = hp;
      w.kind[i] = rng() * TOKEN_RARITY < 1 ? KIND_TOKEN : KIND_ROCK;
    }
  }

  // Natural voids, so the map is not a uniform slab and balls have room to fly.
  // Kept out of layer 1 so the opening dig is solid rock you actually break.
  for (let v = 0; v < 26; v++) {
    const vc = 4 + Math.floor(rng() * (GRID_W - 8));
    const vr = 4 + Math.floor(rng() * (GRID_H - 8));
    if (distFrom(vc, vr, spawnCol, spawnRow) < LAYER_RADIUS) continue;
    carve(w, vc, vr, 1.5 + rng() * 2.5);
  }

  // The prize, GOLDEN_DIST_MIN..MAX blocks out. Collected as a candidate list
  // rather than dart-thrown, so it can never silently miss and fall back to
  // somewhere close.
  const ring = [];
  for (let row = 1; row < GRID_H - 1; row++) {
    for (let col = 1; col < GRID_W - 1; col++) {
      const dist = distFrom(col, row, spawnCol, spawnRow);
      if (dist < GOLDEN_DIST_MIN || dist > GOLDEN_DIST_MAX) continue;
      const i = idx(col, row);
      if (w.hp[i] > 0 && w.kind[i] !== KIND_BEDROCK) ring.push(i);
    }
  }
  let gi;
  if (ring.length) {
    gi = ring[Math.floor(rng() * ring.length)];
  } else {
    // Only reachable if the ring is entirely bedrock/void — take the farthest
    // solid block on the map instead, which is still the outermost layer there is.
    gi = idx(GRID_W >> 1, GRID_H >> 1);
    let far = -1;
    for (let i = 0; i < CELLS; i++) {
      if (w.hp[i] <= 0 || w.kind[i] === KIND_BEDROCK) continue;
      const dist = distFrom(i % GRID_W, (i / GRID_W) | 0, spawnCol, spawnRow);
      if (dist > far) { far = dist; gi = i; }
    }
  }
  w.kind[gi] = KIND_GOLDEN;
  w.hp[gi] = GOLDEN_HP;
  w.maxHp[gi] = GOLDEN_HP;
  w.goldenIdx = gi;

  carve(w, spawnCol, spawnRow, START_CHAMBER);
  reveal(w, spawnCol, spawnRow, START_CHAMBER + 2.5);
  return w;
}

function carve(w, cc, cr, rad) {
  const r = Math.ceil(rad);
  for (let row = cr - r; row <= cr + r; row++) {
    for (let col = cc - r; col <= cc + r; col++) {
      if (!inBounds(col, row)) continue;
      const i = idx(col, row);
      if (w.kind[i] === KIND_BEDROCK || w.kind[i] === KIND_GOLDEN) continue;
      const dc = col - cc, dr = row - cr;
      if (dc * dc + dr * dr <= rad * rad) { w.hp[i] = 0; w.kind[i] = KIND_ROCK; }
    }
  }
}

function reveal(w, cc, cr, rad) {
  const r = Math.ceil(rad);
  const r2 = rad * rad;
  for (let row = cr - r; row <= cr + r; row++) {
    if (row < 0 || row >= GRID_H) continue;
    for (let col = cc - r; col <= cc + r; col++) {
      if (col < 0 || col >= GRID_W) continue;
      const dc = col - cc, dr = row - cr;
      if (dc * dc + dr * dr <= r2) w.seen[idx(col, row)] = 1;
    }
  }
}

/* ── Lighting ─────────────────────────────────────────────────────────────
 *
 * A per-cell RGB light map, rebuilt from scratch each frame over the visible
 * window only. Emissive blocks seed it, then four directional sweeps (L→R,
 * R→L, T→B, B→T) smear each cell into its neighbour at a fixed loss per step.
 * Two axes done in both directions is enough to look omnidirectional, and it
 * is O(cells) with no queue — which is why it stays cheap enough to redo every
 * frame and ports to Luau without a data-structure library.
 *
 * Everything here is plain arithmetic over flat arrays. No DOM, no canvas.
 */

function newLightMap() {
  return {
    r: new Float32Array(CELLS),
    g: new Float32Array(CELLS),
    b: new Float32Array(CELLS),
    /** Window the last build covered, so the renderer can trust the bounds. */
    c0: 0, c1: -1, r0: 0, r1: -1,
  };
}

/** Pre-split the tier glow colours once, since the sweep runs per frame. */
const GLOW_RGB = TIERS.map((t) => (t.glow ? hexToRgbTriple(t.glow) : null));
const GLOW_TOKEN = hexToRgbTriple(BLOCK_TOKEN.glow);
const GLOW_GOLDEN = hexToRgbTriple(BLOCK_GOLDEN.glow);

function hexToRgbTriple(hex) {
  return [
    parseInt(hex.slice(1, 3), 16) / 255,
    parseInt(hex.slice(3, 5), 16) / 255,
    parseInt(hex.slice(5, 7), 16) / 255,
  ];
}

/**
 * Seeded light per unit of `power`. Above 1.0 a source reads as blown out, and
 * because falloff eats ~20% per block, sources need to start over 1.0 for the
 * blocks touching them to still show their true colour.
 */
const LIGHT_SEED = 0.5;

/** Adds a point light. `power` is roughly "blocks of reach". */
function addPointLight(lm, w, col, row, rgb, power) {
  if (col < lm.c0 || col > lm.c1 || row < lm.r0 || row > lm.r1) return;
  const i = idx(col, row);
  const s = power * LIGHT_SEED;
  if (rgb[0] * s > lm.r[i]) lm.r[i] = rgb[0] * s;
  if (rgb[1] * s > lm.g[i]) lm.g[i] = rgb[1] * s;
  if (rgb[2] * s > lm.b[i]) lm.b[i] = rgb[2] * s;
}

/**
 * Rebuilds the light map across the given cell window. `extra` is a list of
 * transient lights — balls, impact flashes, the player — as
 * `{ col, row, rgb, power }`.
 */
function buildLight(lm, w, c0, c1, r0, r1, extra) {
  // Pad the window so lights just off-screen still bleed in at the edges.
  const PAD = 10;
  c0 = Math.max(0, c0 - PAD); c1 = Math.min(GRID_W - 1, c1 + PAD);
  r0 = Math.max(0, r0 - PAD); r1 = Math.min(GRID_H - 1, r1 + PAD);
  lm.c0 = c0; lm.c1 = c1; lm.r0 = r0; lm.r1 = r1;

  for (let row = r0; row <= r1; row++) {
    const base = row * GRID_W;
    for (let col = c0; col <= c1; col++) {
      const i = base + col;
      let lr = 0, lg = 0, lb = 0;

      if (w.seen[i]) {
        if (w.hp[i] <= 0) {
          // Mined-out air keeps a dim floor so cleared rooms stay readable.
          lr = lg = lb = LIGHT_AMBIENT;
        } else {
          const kind = w.kind[i];
          let glow = null, power = 0;
          if (kind === KIND_TOKEN) { glow = GLOW_TOKEN; power = BLOCK_TOKEN.light; }
          else if (kind === KIND_GOLDEN) { glow = GLOW_GOLDEN; power = BLOCK_GOLDEN.light; }
          else if (kind !== KIND_BEDROCK) {
            const t = w.hue[i];
            glow = GLOW_RGB[t]; power = TIERS[t].light;
          }
          if (glow && power > 0) {
            const s = power * LIGHT_SEED;
            lr = glow[0] * s; lg = glow[1] * s; lb = glow[2] * s;
          }
        }
      }
      lm.r[i] = lr; lm.g[i] = lg; lm.b[i] = lb;
    }
  }

  if (extra) {
    for (const e of extra) addPointLight(lm, w, e.col, e.row, e.rgb, e.power);
  }

  // Four sweeps. `fall` depends on the cell being entered: rock swallows light.
  const R = lm.r, G = lm.g, B = lm.b;
  const spread = (i, from) => {
    const fall = w.hp[i] > 0 ? LIGHT_FALL_SOLID : LIGHT_FALL_AIR;
    const nr = R[from] * fall, ng = G[from] * fall, nb = B[from] * fall;
    if (nr > R[i]) R[i] = nr < LIGHT_CUTOFF ? R[i] : nr;
    if (ng > G[i]) G[i] = ng < LIGHT_CUTOFF ? G[i] : ng;
    if (nb > B[i]) B[i] = nb < LIGHT_CUTOFF ? B[i] : nb;
  };

  for (let row = r0; row <= r1; row++) {
    const base = row * GRID_W;
    for (let col = c0 + 1; col <= c1; col++) spread(base + col, base + col - 1);
    for (let col = c1 - 1; col >= c0; col--) spread(base + col, base + col + 1);
  }
  for (let col = c0; col <= c1; col++) {
    for (let row = r0 + 1; row <= r1; row++) spread(row * GRID_W + col, (row - 1) * GRID_W + col);
    for (let row = r1 - 1; row >= r0; row--) spread(row * GRID_W + col, (row + 1) * GRID_W + col);
  }

  // Fog wins over light. The sweeps happily smear illumination into cells the
  // player has never uncovered; without this, every lamp would quietly outline
  // the unexplored map around it.
  for (let row = r0; row <= r1; row++) {
    const base = row * GRID_W;
    for (let col = c0; col <= c1; col++) {
      const i = base + col;
      if (!w.seen[i]) { R[i] = 0; G[i] = 0; B[i] = 0; }
    }
  }
}

function newEffects() {
  return {
    particles: [], arcs: [], texts: [], shake: 0, haptic: 0,
    tokensGained: 0, brokenCount: 0, goldenHit: false, goldenBroken: false,
  };
}

const TIER_COLORS = TIERS.map((t) => t.color);

/** Damage one block. `soft` hits (splash, chain, rot) do not fire haptics. */
function damageBlock(w, col, row, amount, ctx, soft) {
  if (!inBounds(col, row)) return false;
  const i = idx(col, row);
  if (w.hp[i] <= 0 || w.kind[i] === KIND_BEDROCK) return false;

  const golden = w.kind[i] === KIND_GOLDEN;
  const next = w.hp[i] - amount;
  const cx = (col + 0.5) * CELL;
  const cy = (row + 0.5) * CELL;

  if (next > 0) {
    w.hp[i] = next;
    if (golden) {
      ctx.fx.goldenHit = true;
      ctx.fx.haptic = Math.max(ctx.fx.haptic, 3);
      spray(ctx.fx, cx, cy, PALETTE.golden, 6, ctx.rng);
    } else if (!soft) {
      ctx.fx.haptic = Math.max(ctx.fx.haptic, 1);
      spray(ctx.fx, cx, cy, TIER_COLORS[w.hue[i]], 2, ctx.rng);
    }
    return false;
  }

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
    spray(ctx.fx, cx, cy, PALETTE.golden, 60, ctx.rng);
    return true;
  }

  if (kind === KIND_TOKEN) {
    // Outer rock takes far longer to break, so a token found out there is worth
    // more — otherwise income dries up exactly where upgrades matter most.
    const tier = tierOfDist(distFrom(col, row, w.spawnCol, w.spawnRow));
    const gained = Math.max(1, Math.round(ctx.stats.luck * ctx.ballLuck * (1 + tier * 0.35)));
    ctx.fx.tokensGained += gained;
    ctx.fx.haptic = Math.max(ctx.fx.haptic, 3);
    ctx.fx.texts.push({ x: cx, y: cy, life: 1.1, text: '+' + gained, color: '#ffffff' });
    spray(ctx.fx, cx, cy, '#ffffff', 16, ctx.rng);
  } else {
    ctx.fx.haptic = Math.max(ctx.fx.haptic, 2);
    spray(ctx.fx, cx, cy, TIER_COLORS[w.hue[i]], 6, ctx.rng);
    const bonus = (ctx.stats.luck - 1) * ctx.ballLuck * 0.006;
    if (bonus > 0 && ctx.rng() < bonus) {
      ctx.fx.tokensGained += 1;
      ctx.fx.texts.push({ x: cx, y: cy, life: 1.1, text: '+1', color: '#ffffff' });
    }
  }
  ctx.fx.shake = Math.max(ctx.fx.shake, 2.5);
  return true;
}

function spray(fx, x, y, color, n, rng) {
  if (fx.particles.length > 320) return;
  for (let k = 0; k < n; k++) {
    const a = rng() * Math.PI * 2;
    const sp = 20 + rng() * 110;
    const life = 0.25 + rng() * 0.45;
    fx.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life, max: life, color });
  }
}

function clearPoison(w, i) {
  if (w.poisonT[i] > 0) {
    w.poisonT[i] = 0;
    w.poisonD[i] = 0;
    w.poisonB[i] = 0;
    w.poisoned.delete(i);
  }
}

/**
 * Infect one block. `budget` is how many further generations the rot may jump
 * once this block dies — that, and nothing else, is what stops an outbreak
 * from eating the whole map.
 */
function addPoison(w, col, row, dps, time, budget) {
  if (!inBounds(col, row)) return;
  const i = idx(col, row);
  if (w.hp[i] <= 0 || w.kind[i] === KIND_BEDROCK) return;
  w.poisonD[i] = Math.max(w.poisonD[i], dps);
  w.poisonT[i] = Math.max(w.poisonT[i], time);
  w.poisonB[i] = Math.max(w.poisonB[i], Math.min(127, budget));
  w.poisoned.add(i);
}

function applyImpact(w, col, row, ballId, ctx) {
  const ball = BALLS[ballId];
  const s = ctx.stats;
  const direct = s.damage * s.damageMul * ball.damageMul;

  const broke = damageBlock(w, col, row, direct, ctx, false);

  const radius = s.splashRadius + ball.splashBonus;
  if (radius > 0) {
    const factor = s.splashFactor + (ball.splashBonus > 0 ? 0.35 : 0);
    if (factor > 0) {
      const r = Math.ceil(radius);
      for (let dr = -r; dr <= r; dr++) {
        for (let dc = -r; dc <= r; dc++) {
          if (dc === 0 && dr === 0) continue;
          const dist = Math.hypot(dc, dr);
          if (dist > radius) continue;
          damageBlock(w, col + dc, row + dr, direct * factor * (1 - dist / (radius + 1)), ctx, true);
        }
      }
      ctx.fx.shake = Math.max(ctx.fx.shake, 3 + radius * 1.5);
    }
  }

  if (ball.chains) chain(w, col, row, ctx, direct);

  const poisonDps = (ball.poisons ? s.poisonDps : 0) + s.poisonBase;
  if (poisonDps > 0) {
    addPoison(w, col, row, poisonDps, s.poisonTime, s.poisonSpread);
    if (ball.poisons) {
      addPoison(w, col + 1, row, poisonDps * 0.6, s.poisonTime, s.poisonSpread);
      addPoison(w, col - 1, row, poisonDps * 0.6, s.poisonTime, s.poisonSpread);
      addPoison(w, col, row + 1, poisonDps * 0.6, s.poisonTime, s.poisonSpread);
      addPoison(w, col, row - 1, poisonDps * 0.6, s.poisonTime, s.poisonSpread);
    }
  }
  return broke;
}

function chain(w, col, row, ctx, direct) {
  const s = ctx.stats;
  const range = Math.ceil(s.chainRange);
  const targets = [];
  for (let dr = -range; dr <= range; dr++) {
    for (let dc = -range; dc <= range; dc++) {
      if (dc === 0 && dr === 0) continue;
      const c = col + dc, r = row + dr;
      if (!inBounds(c, r) || Math.hypot(dc, dr) > s.chainRange) continue;
      const i = idx(c, r);
      if (w.hp[i] > 0 && w.kind[i] !== KIND_BEDROCK) targets.push(i);
    }
  }
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

/** Rot ticks. Spread is budgeted per block, so an outbreak always burns out. */
function tickPoison(w, dt, ctx) {
  if (w.poisoned.size === 0) return;
  const toSpread = [];
  for (const i of Array.from(w.poisoned)) {
    if (w.hp[i] <= 0) { clearPoison(w, i); continue; }
    const col = i % GRID_W;
    const row = (i / GRID_W) | 0;
    const budget = w.poisonB[i];
    damageBlock(w, col, row, w.poisonD[i] * dt, ctx, true);
    w.poisonT[i] -= dt;
    if (w.hp[i] <= 0 && budget > 0) toSpread.push([col, row, budget - 1]);
    if (w.poisonT[i] <= 0) clearPoison(w, i);
  }
  for (const [col, row, budget] of toSpread) {
    const dps = ctx.stats.poisonDps * 0.7;
    const t = ctx.stats.poisonTime;
    addPoison(w, col + 1, row, dps, t, budget);
    addPoison(w, col - 1, row, dps, t, budget);
    addPoison(w, col, row + 1, dps, t, budget);
    addPoison(w, col, row - 1, dps, t, budget);
  }
}

function spawnVolley(px, py, angle, power, type, s) {
  const def = BALLS[type];
  const speed = s.speed * def.speedMul * (0.45 + power * 0.55);
  const out = [];
  const n = Math.max(1, Math.round(s.projectiles));
  for (let k = 0; k < n; k++) {
    const offset = n === 1 ? 0 : (k / (n - 1) - 0.5) * s.spreadAngle * (n - 1);
    const a = angle + offset;
    out.push({
      x: px, y: py,
      vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
      bounces: Math.round(s.bounces) + def.bounceBonus,
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

/**
 * Advance one ball.
 *
 * The rule that makes the game a game: a ball *always* ricochets off anything
 * it hits, including a block it just destroyed. Only the Ghost ball tunnels.
 * Letting balls punch straight through their kills turns every shot into a
 * boring straight corridor.
 */
function stepBall(w, b, dt, ctx) {
  const def = BALLS[b.type];
  const speed = Math.hypot(b.vx, b.vy);
  if (speed < 1) { b.dead = true; return; }

  const steps = Math.max(1, Math.ceil((speed * dt) / MAX_STEP));
  const h = dt / steps;

  for (let step = 0; step < steps && !b.dead; step++) {
    // Horizontal sweep.
    const nx = b.x + b.vx * h;
    if (isSolid(w, Math.floor(nx / CELL), Math.floor(b.y / CELL))) {
      const col = Math.floor(nx / CELL), row = Math.floor(b.y / CELL);
      applyImpact(w, col, row, b.type, ctx);
      if (def.pierce && !isBedrock(w, col, row)) {
        b.x = nx;
        b.vx *= 0.82; b.vy *= 0.82;
      } else {
        b.vx = -b.vx;
        jitter(b, ctx);
        b.bounces--;
      }
    } else {
      b.x = nx;
    }
    if (b.bounces < 0) { b.dead = true; break; }

    // Vertical sweep.
    const ny = b.y + b.vy * h;
    if (isSolid(w, Math.floor(b.x / CELL), Math.floor(ny / CELL))) {
      const col = Math.floor(b.x / CELL), row = Math.floor(ny / CELL);
      applyImpact(w, col, row, b.type, ctx);
      if (def.pierce && !isBedrock(w, col, row)) {
        b.y = ny;
        b.vx *= 0.82; b.vy *= 0.82;
      } else {
        b.vy = -b.vy;
        jitter(b, ctx);
        b.bounces--;
      }
    } else {
      b.y = ny;
    }
    if (b.bounces < 0) { b.dead = true; break; }
  }

  b.life -= dt;
  if (b.life <= 0) b.dead = true;

  reveal(w, Math.floor(b.x / CELL), Math.floor(b.y / CELL), ctx.stats.revealRadius + def.revealBonus);
  b.trail.push(b.x, b.y);
  if (b.trail.length > TRAIL_POINTS * 2) b.trail.splice(0, b.trail.length - TRAIL_POINTS * 2);
}

/** A touch of angular noise per bounce, so a ball never locks into a 2-wall loop. */
function jitter(b, ctx) {
  const a = Math.atan2(b.vy, b.vx) + (ctx.rng() - 0.5) * 0.14;
  const sp = Math.hypot(b.vx, b.vy) * 0.985;
  b.vx = Math.cos(a) * sp;
  b.vy = Math.sin(a) * sp;
}

const PLAYER_REACH = 15;

function walkToward(w, fromCol, fromRow, toCol, toRow) {
  const dc = toCol - fromCol, dr = toRow - fromRow;
  const dist = Math.hypot(dc, dr);
  if (dist < 0.5) return null;
  const capped = Math.min(dist, PLAYER_REACH);
  const stepC = dc / dist, stepR = dr / dist;
  let lastCol = fromCol, lastRow = fromRow;
  const samples = Math.ceil(capped * 4);
  for (let k = 1; k <= samples; k++) {
    const t = (k / samples) * capped;
    const c = Math.round(fromCol + stepC * t);
    const r = Math.round(fromRow + stepR * t);
    if (!inBounds(c, r) || w.hp[idx(c, r)] > 0) break;
    lastCol = c; lastRow = r;
  }
  if (lastCol === fromCol && lastRow === fromRow) return null;
  return { col: lastCol, row: lastRow };
}

function rle(arr) {
  const out = [];
  let run = 1;
  for (let i = 1; i <= arr.length; i++) {
    if (i < arr.length && arr[i] === arr[i - 1] && run < 65535) run++;
    else { out.push(run, arr[i - 1]); run = 1; }
  }
  return out;
}

function unrle(data, into) {
  let p = 0;
  for (let i = 0; i + 1 < data.length; i += 2) {
    const count = data[i], value = data[i + 1];
    for (let k = 0; k < count; k++) {
      if (p >= into.length) return false;
      into[p++] = value;
    }
  }
  return p === into.length;
}
