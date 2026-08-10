/*
 * BlindShot — standalone build.
 *
 * Self-contained: no bundler, no framework, no network. The CONFIG and ENGINE
 * sections are deliberately DOM-free so they mirror 1:1 onto the Roblox Luau
 * port in ../roblox/BlindShotConfig.lua — keep the two in sync when tuning.
 */
'use strict';

/* ══ CONFIG ═══════════════════════════════════════════════════════════════ */

const GRID_W = 100;
const GRID_H = 100;
const CELL = 16;

const START_COL = 50;
const START_ROW = 6;
const START_CHAMBER = 3;
const BEDROCK_HP = 32000;

const TIERS = [
  { name: 'Crust', hp: 3,   color: '#9aa4a8' },
  { name: 'Moss',  hp: 6,   color: '#4ea85c' },
  { name: 'Clay',  hp: 11,  color: '#b5a72f' },
  { name: 'Rust',  hp: 19,  color: '#c2703a' },
  { name: 'Ember', hp: 32,  color: '#c1402f' },
  { name: 'Slate', hp: 52,  color: '#6c6f7a' },
  { name: 'Void',  hp: 84,  color: '#7a3fb5' },
  { name: 'Core',  hp: 130, color: '#c22fa8' },
];
const ROWS_PER_TIER = GRID_H / TIERS.length;

function tierOfRow(row) {
  const t = Math.floor(row / ROWS_PER_TIER);
  return t < 0 ? 0 : t >= TIERS.length ? TIERS.length - 1 : t;
}

const KIND_ROCK = 0, KIND_TOKEN = 1, KIND_GOLDEN = 2, KIND_BEDROCK = 3;

/** 1 in N solid blocks hides a token, before luck bonuses. */
const TOKEN_RARITY = 18;
const GOLDEN_ROW_MIN = 86;
const GOLDEN_ROW_MAX = 96;
const GOLDEN_HP = 40;
/** Distance in blocks at which the golden block starts bleeding light through fog. */
const GOLDEN_AURA = 11;

const PALETTE = {
  bg: '#04160c',
  unseen: '#000000',
  player: '#e8a33d',
  golden: '#ffd23d',
  hud: '#4ade80',
  branch: {
    red: '#ef4444', orange: '#f97316', yellow: '#eab308',
    green: '#22c55e', blue: '#38bdf8', magenta: '#e935c8',
  },
};

const BALLS = {
  basic: {
    id: 'basic', name: 'Iron ball', branch: 'orange', color: '#f2a65a',
    desc: 'No tricks. Ricochets hard and hits reliably.',
    damageMul: 1, splashBonus: 0, pierce: false, chains: false, poisons: false,
    revealBonus: 0, luckMul: 1, speedMul: 1, bounceBonus: 2,
  },
  bomb: {
    id: 'bomb', name: 'Bomb ball', branch: 'orange', color: '#fb7a1e',
    desc: 'Detonates on every bounce. Huge splash, slower flight.',
    damageMul: 0.85, splashBonus: 2, pierce: false, chains: false, poisons: false,
    revealBonus: 0, luckMul: 1, speedMul: 0.85, bounceBonus: 0,
  },
  lightning: {
    id: 'lightning', name: 'Storm ball', branch: 'yellow', color: '#f4e04d',
    desc: 'Arcs to nearby blocks on every hit. Fast, and it bounces forever.',
    damageMul: 0.8, splashBonus: 0, pierce: false, chains: true, poisons: false,
    revealBonus: 1, luckMul: 1, speedMul: 1.25, bounceBonus: 5,
  },
  poison: {
    id: 'poison', name: 'Poison ball', branch: 'green', color: '#3ddc61',
    desc: 'Rots blocks over time. Weak up front, brutal if you wait.',
    damageMul: 0.6, splashBonus: 1, pierce: false, chains: false, poisons: true,
    revealBonus: 0, luckMul: 1, speedMul: 1, bounceBonus: 2,
  },
  ghost: {
    id: 'ghost', name: 'Ghost ball', branch: 'blue', color: '#5ad1f5',
    desc: 'The only ball that tunnels instead of bouncing. Dies fast.',
    damageMul: 0.7, splashBonus: 0, pierce: true, chains: false, poisons: false,
    revealBonus: 1, luckMul: 1, speedMul: 1.15, bounceBonus: 0,
  },
  lure: {
    id: 'lure', name: 'Lure ball', branch: 'magenta', color: '#f45ce0',
    desc: 'Lights up the dark and shakes tokens loose.',
    damageMul: 0.75, splashBonus: 0, pierce: false, chains: false, poisons: false,
    revealBonus: 4, luckMul: 2.5, speedMul: 0.95, bounceBonus: 3,
  },
};
const BALL_ORDER = ['basic', 'bomb', 'lightning', 'poison', 'ghost', 'lure'];

/**
 * Base stats, i.e. the tree with nothing bought.
 *
 * `reload` is 5s on purpose: a shot is a decision, not a twitch. Everything
 * else — the fat bounce budget, ricochet-on-break — exists so that one shot
 * is worth the wait.
 */
const BASE_STATS = {
  damage: 9,
  damageMul: 1,
  splashRadius: 0,
  splashFactor: 0,
  projectiles: 1,
  spreadAngle: 0.16,
  bounces: 16,
  speed: 380,
  lifetime: 10,
  reload: 5,
  chainTargets: 2,
  chainRange: 5,
  chainDamage: 0.5,
  poisonBase: 0,
  poisonDps: 2,
  poisonTime: 3,
  /** Generations of onward infection. 0 = rot never leaves the block it killed. */
  poisonSpread: 0,
  revealRadius: 2.6,
  luck: 1,
  compass: 0,
};

const TECH = [
  { id: 'core', name: 'Slingshot', desc: 'Pull back, let go, listen for the crack.',
    branch: 'green', col: 0, row: 0, cost: 0, requires: [], icon: 'core', shape: 'circle',
    apply: () => {} },

  // ── RED · Force ──────────────────────────────────────────────────────────
  { id: 'r1', name: 'Honed Tip', desc: '+3 damage on every impact.',
    branch: 'red', col: -1, row: 0, cost: 1, requires: ['core'], icon: 'sword', shape: 'square',
    apply: (s) => { s.damage += 3; } },
  { id: 'r2', name: 'Heavy Shot', desc: '+6 damage. The ball hits like a hammer.',
    branch: 'red', col: -2, row: 0, cost: 2, requires: ['r1'], icon: 'sword', shape: 'square',
    apply: (s) => { s.damage += 6; } },
  { id: 'r3', name: 'Crushing Blow', desc: '+10 damage.',
    branch: 'red', col: -3, row: 0, cost: 4, requires: ['r2'], icon: 'sword', shape: 'square',
    apply: (s) => { s.damage += 10; } },
  { id: 'r4', name: 'Fracture', desc: 'All damage multiplied by 1.35.',
    branch: 'red', col: -3, row: -1, cost: 5, requires: ['r3'], icon: 'spread', shape: 'square',
    apply: (s) => { s.damageMul *= 1.35; } },
  { id: 'r5', name: 'Overload', desc: '+18 damage, but shots fly 15% slower.',
    branch: 'red', col: -4, row: 0, cost: 7, requires: ['r3'], icon: 'sword', shape: 'square',
    apply: (s) => { s.damage += 18; s.speed *= 0.85; } },

  // ── ORANGE · Impact ──────────────────────────────────────────────────────
  { id: 'o1', name: 'Shockwave', desc: 'Impacts spill 40% damage into neighbours.',
    branch: 'orange', col: -1, row: -1, cost: 1, requires: ['core'], icon: 'comet', shape: 'square',
    apply: (s) => { s.splashRadius = Math.max(s.splashRadius, 1); s.splashFactor += 0.4; } },
  { id: 'o2', name: 'Blast Ring', desc: 'Splash reaches 2 blocks out.',
    branch: 'orange', col: -2, row: -2, cost: 2, requires: ['o1'], icon: 'comet', shape: 'square',
    apply: (s) => { s.splashRadius = Math.max(s.splashRadius, 2); s.splashFactor += 0.05; } },
  { id: 'o3', name: 'Detonator', desc: 'Unlocks the Bomb ball.',
    branch: 'orange', col: -3, row: -2, cost: 4, requires: ['o2'], icon: 'ball', shape: 'circle',
    unlocksBall: 'bomb', apply: () => {} },
  { id: 'o4', name: 'Concussion', desc: 'Splash damage +25%.',
    branch: 'orange', col: -2, row: -3, cost: 5, requires: ['o2'], icon: 'spread', shape: 'square',
    apply: (s) => { s.splashFactor += 0.25; } },
  { id: 'o5', name: 'Cataclysm', desc: 'Splash radius +1 and splash damage +30%.',
    branch: 'orange', col: -4, row: -2, cost: 7, requires: ['o3'], icon: 'comet', shape: 'square',
    apply: (s) => { s.splashRadius += 1; s.splashFactor += 0.3; } },

  // ── YELLOW · Storm ───────────────────────────────────────────────────────
  { id: 'y1', name: 'Static', desc: 'Cooldown 18% shorter.',
    branch: 'yellow', col: 0, row: -1, cost: 1, requires: ['core'], icon: 'clock', shape: 'square',
    apply: (s) => { s.reload *= 0.82; } },
  { id: 'y2', name: 'Arc', desc: 'Unlocks the Storm ball.',
    branch: 'yellow', col: 0, row: -2, cost: 2, requires: ['y1'], icon: 'ball', shape: 'circle',
    unlocksBall: 'lightning', apply: () => {} },
  { id: 'y3', name: 'Conductor', desc: 'Lightning hits +1 block and deals 20% more.',
    branch: 'yellow', col: 0, row: -3, cost: 4, requires: ['y2'], icon: 'bolt', shape: 'square',
    apply: (s) => { s.chainTargets += 1; s.chainDamage += 0.2; } },
  { id: 'y4', name: 'Quickdraw', desc: 'Cooldown 28% shorter.',
    branch: 'yellow', col: -1, row: -3, cost: 5, requires: ['y3'], icon: 'clock', shape: 'square',
    apply: (s) => { s.reload *= 0.72; } },
  { id: 'y5', name: 'Tempest', desc: 'Lightning hits +2 blocks at 50% more range.',
    branch: 'yellow', col: 0, row: -4, cost: 7, requires: ['y3'], icon: 'bolt', shape: 'square',
    apply: (s) => { s.chainTargets += 2; s.chainRange *= 1.5; } },
  { id: 'y6', name: 'Overclock', desc: 'Cooldown 30% shorter. Roughly 2 seconds a shot.',
    branch: 'yellow', col: -1, row: -4, cost: 9, requires: ['y4'], icon: 'clock', shape: 'square',
    apply: (s) => { s.reload *= 0.7; } },

  // ── GREEN · Toxin ────────────────────────────────────────────────────────
  { id: 'g1', name: 'Blight', desc: 'Every impact leaves a weak rot behind.',
    branch: 'green', col: 1, row: -1, cost: 1, requires: ['core'], icon: 'skull', shape: 'square',
    apply: (s) => { s.poisonBase += 1; } },
  { id: 'g2', name: 'Poison Ball', desc: 'Unlocks the Poison ball.',
    branch: 'green', col: 2, row: -2, cost: 2, requires: ['g1'], icon: 'ball', shape: 'circle',
    unlocksBall: 'poison', apply: () => {} },
  { id: 'g3', name: 'Virulence', desc: 'Poison ticks for double damage.',
    branch: 'green', col: 3, row: -2, cost: 4, requires: ['g2'], icon: 'skull', shape: 'square',
    apply: (s) => { s.poisonDps *= 2; } },
  { id: 'g4', name: 'Contagion', desc: 'Rot creeps 1 block onward from each block it kills, then stops.',
    branch: 'green', col: 2, row: -3, cost: 5, requires: ['g2'], icon: 'spread', shape: 'square',
    apply: (s) => { s.poisonSpread = Math.max(s.poisonSpread, 1); } },
  { id: 'g5', name: 'Necrosis', desc: 'Poison lasts twice as long.',
    branch: 'green', col: 4, row: -2, cost: 7, requires: ['g3'], icon: 'skull', shape: 'square',
    apply: (s) => { s.poisonTime *= 2; } },
  { id: 'g6', name: 'Pandemic', desc: 'Rot creeps 2 more blocks onward before it burns out.',
    branch: 'green', col: 3, row: -3, cost: 9, requires: ['g4'], icon: 'spread', shape: 'square',
    apply: (s) => { s.poisonSpread += 2; } },

  // ── BLUE · Velocity ──────────────────────────────────────────────────────
  { id: 'b1', name: 'Slick', desc: 'Shots travel 20% faster.',
    branch: 'blue', col: 1, row: 0, cost: 1, requires: ['core'], icon: 'comet', shape: 'square',
    apply: (s) => { s.speed *= 1.2; } },
  { id: 'b2', name: 'Ricochet', desc: '+8 bounces and +3s of flight.',
    branch: 'blue', col: 2, row: 0, cost: 2, requires: ['b1'], icon: 'comet', shape: 'square',
    apply: (s) => { s.bounces += 8; s.lifetime += 3; } },
  { id: 'b3', name: 'Phase', desc: 'Unlocks the Ghost ball.',
    branch: 'blue', col: 3, row: 0, cost: 4, requires: ['b2'], icon: 'ball', shape: 'circle',
    unlocksBall: 'ghost', apply: () => {} },
  { id: 'b4', name: 'Split Shot', desc: 'Fire 2 balls per pull.',
    branch: 'blue', col: 3, row: 1, cost: 5, requires: ['b2'], icon: 'spread', shape: 'square',
    apply: (s) => { s.projectiles += 1; } },
  { id: 'b5', name: 'Volley', desc: 'Fire 2 more balls, in a wider fan.',
    branch: 'blue', col: 4, row: 0, cost: 7, requires: ['b3'], icon: 'spread', shape: 'square',
    apply: (s) => { s.projectiles += 2; s.spreadAngle *= 1.25; } },

  // ── MAGENTA · Fortune ────────────────────────────────────────────────────
  { id: 'm1', name: 'Prospector', desc: 'Tokens turn up 50% more often.',
    branch: 'magenta', col: 0, row: 1, cost: 1, requires: ['core'], icon: 'radar', shape: 'square',
    apply: (s) => { s.luck += 0.5; } },
  { id: 'm2', name: 'Lure Ball', desc: 'Unlocks the Lure ball.',
    branch: 'magenta', col: 0, row: 2, cost: 2, requires: ['m1'], icon: 'ball', shape: 'circle',
    unlocksBall: 'lure', apply: () => {} },
  { id: 'm3', name: 'Deep Sight', desc: 'You see 2 blocks further into the dark.',
    branch: 'magenta', col: 0, row: 3, cost: 4, requires: ['m2'], icon: 'radar', shape: 'square',
    apply: (s) => { s.revealRadius += 2; } },
  { id: 'm4', name: 'Golden Sense', desc: 'A compass finds the golden block within 25 blocks.',
    branch: 'magenta', col: -1, row: 2, cost: 5, requires: ['m2'], icon: 'flag', shape: 'circle',
    apply: (s) => { s.compass = Math.max(s.compass, 25); } },
  { id: 'm5', name: 'Midas Touch', desc: 'Tokens +100%, and the compass never sleeps.',
    branch: 'magenta', col: 1, row: 3, cost: 7, requires: ['m3'], icon: 'flag', shape: 'circle',
    apply: (s) => { s.luck += 1; s.compass = 9999; } },
];

const TECH_BY_ID = {};
for (const n of TECH) TECH_BY_ID[n.id] = n;

function statsFor(unlocked) {
  const s = Object.assign({}, BASE_STATS);
  for (const id of unlocked) if (TECH_BY_ID[id]) TECH_BY_ID[id].apply(s);
  return s;
}

function ballsFor(unlocked) {
  const have = new Set(['basic']);
  for (const id of unlocked) {
    const b = TECH_BY_ID[id] && TECH_BY_ID[id].unlocksBall;
    if (b) have.add(b);
  }
  return BALL_ORDER.filter((b) => have.has(b));
}

/** mulberry32 — bit-identical to the Luau mirror. */
function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ══ ENGINE ═══════════════════════════════════════════════════════════════ */

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

  for (let row = 0; row < GRID_H; row++) {
    const tier = tierOfRow(row);
    const base = TIERS[tier].hp;
    for (let col = 0; col < GRID_W; col++) {
      const i = idx(col, row);
      w.shade[i] = Math.floor(rng() * 256);

      // Speckle neighbouring tier colours in so the seams read as real strata.
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

      const hp = Math.max(1, Math.round(base * (0.75 + rng() * 0.55)));
      w.hp[i] = hp;
      w.maxHp[i] = hp;
      w.kind[i] = rng() * TOKEN_RARITY < 1 ? KIND_TOKEN : KIND_ROCK;
    }
  }

  // Natural voids, so the map is not a uniform slab and balls have room to fly.
  for (let v = 0; v < 26; v++) {
    carve(w, 4 + Math.floor(rng() * (GRID_W - 8)), 12 + Math.floor(rng() * (GRID_H - 20)), 1.5 + rng() * 2.5);
  }

  // Random spawn location (corner-ish, early tiers only)
  const spawnCol = rng() < 0.5 ? 8 + Math.floor(rng() * 12) : GRID_W - 20 + Math.floor(rng() * 12);
  const spawnRow = 3 + Math.floor(rng() * 8);
  w.spawnCol = spawnCol;
  w.spawnRow = spawnRow;

  // The prize: 70-90 blocks away from spawn, never in a void, never on the border.
  let gi = -1;
  for (let attempt = 0; attempt < 1000 && gi < 0; attempt++) {
    const gc = 6 + Math.floor(rng() * (GRID_W - 12));
    const gr = 6 + Math.floor(rng() * (GRID_H - 12));
    const dist = Math.hypot(gc - spawnCol, gr - spawnRow);
    if (dist >= 70 && dist <= 90) {
      const i = idx(gc, gr);
      if (w.hp[i] > 0 && w.kind[i] !== KIND_BEDROCK) gi = i;
    }
  }
  // Fallback: place at farthest valid location if no spot in range found
  if (gi < 0) {
    let maxDist = 0, bestI = idx(50, 50);
    for (let attempt = 0; attempt < 200; attempt++) {
      const gc = 6 + Math.floor(rng() * (GRID_W - 12));
      const gr = 6 + Math.floor(rng() * (GRID_H - 12));
      const i = idx(gc, gr);
      if (w.hp[i] > 0 && w.kind[i] !== KIND_BEDROCK) {
        const dist = Math.hypot(gc - spawnCol, gr - spawnRow);
        if (dist > maxDist) { maxDist = dist; bestI = i; }
      }
    }
    gi = bestI;
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
    // Deep rock takes far longer to break, so a token found down there is worth
    // more — otherwise income dries up exactly where upgrades matter most.
    const gained = Math.max(1, Math.round(ctx.stats.luck * ctx.ballLuck * (1 + tierOfRow(row) * 0.35)));
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
