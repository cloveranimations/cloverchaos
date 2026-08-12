/*
 * BlindShot — pure data. No DOM, no canvas, no engine logic.
 *
 * This file is the 1:1 mirror of the Luau `Config` module: every value here
 * is a plain table or a pure function of its arguments, so porting is a
 * transcription job rather than a rewrite. Nothing in here may reference
 * `document`, `window`, a canvas, or any engine state.
 */
'use strict';


const GRID_W = 100;
const GRID_H = 100;
const CELL = 16;

const START_COL = 50;
const START_ROW = 6;
const START_CHAMBER = 3;
const BEDROCK_HP = 32000;


/**
 * Block appearance. Every solid block rolls one of these at worldgen,
 * independently of its layer — colour is scattered, difficulty is radial.
 * This is the table to edit when designing blocks; nothing else changes.
 *
 *   color   the block's colour at full light. Near-primary on purpose: the
 *           renderer multiplies it by the light reaching it, so a muted base
 *           colour turns to mud two blocks from a lamp.
 *   glow    colour of the light this block radiates, or null for dead rock.
 *   light   how far that glow carries, in blocks.
 *   weight  relative roll frequency. Lamps are deliberately rare — they are
 *           the only reason any of the cave is visible, so making them common
 *           flattens the map into one even wash with no dark left in it.
 */
const BLOCKS = [
  { color: '#c8ccd0', glow: null, light: 0, weight: 13 },
  { color: '#909aa0', glow: null, light: 0, weight: 12 },
  { color: '#e00010', glow: null, light: 0, weight: 12 },
  { color: '#d05000', glow: null, light: 0, weight: 11 },
  { color: '#a0b000', glow: null, light: 0, weight: 11 },
  { color: '#00c000', glow: null, light: 0, weight: 11 },
  { color: '#c08000', glow: null, light: 0, weight: 10 },
  { color: '#2f6fd0', glow: null, light: 0, weight: 8 },
  { color: '#7a3fb5', glow: null, light: 0, weight: 7 },
  // ── Lamps ──────────────────────────────────────────────────────────────
  { color: '#ffffff', glow: '#ffffff', light: 3.4, weight: 1.5 },
  { color: '#ff00ff', glow: '#ff00ff', light: 3.0, weight: 0.7 },
  { color: '#00e0d0', glow: '#00e0d0', light: 2.8, weight: 0.5 },
  { color: '#ffe020', glow: '#ffe020', light: 3.0, weight: 0.35 },
];

/** Specials, same shape as a block row so the renderer treats them alike. */
const BLOCK_TOKEN  = { color: '#ffffff', glow: '#ffffff', light: 1.6 };
const BLOCK_GOLDEN = { color: '#ffd23d', glow: '#ffd23d', light: 5.0 };
const BLOCK_BEDROCK = { color: '#20282c', glow: null, light: 0 };

/** Base HP for a block at given distance, before jitter. Continuous exponential scaling. */
function hpAtDist(dist) {
  return Math.max(1, Math.floor(1 + dist * 0.8 + (dist * dist) * 0.015));
}

function distFrom(col, row, fromCol, fromRow) {
  const dc = col - fromCol, dr = row - fromRow;
  return Math.sqrt(dc * dc + dr * dr);
}

const KIND_ROCK = 0, KIND_TOKEN = 1, KIND_GOLDEN = 2, KIND_BEDROCK = 3;

/** 1 in N solid blocks hides a token, before luck bonuses. */
const TOKEN_RARITY = 50;
/** The prize sits this far from spawn, in blocks — layers 6 through 8. */
const GOLDEN_DIST_MIN = 70;
const GOLDEN_DIST_MAX = 90;
const GOLDEN_HP = 40;
/** Distance in blocks at which the golden block starts bleeding light through fog. */
const GOLDEN_AURA = 11;

const PALETTE = {
  /** Open, lit-but-empty space. */
  bg: '#102018',
  /** Unlit void — what a cell with no light at all falls back to. */
  unseen: '#001008',
  player: '#e8a33d',
  golden: '#ffd23d',
  hud: '#4ade80',
  branch: {
    red: '#ef4444', orange: '#f97316', yellow: '#eab308',
    green: '#22c55e', blue: '#38bdf8', magenta: '#e935c8',
  },
};

/* ── Lighting ──────────────────────────────────────────────────────────────
 * Terraria-style flood light: every emissive cell seeds the map, then four
 * directional sweeps smear it outward, losing a fixed fraction per step. Air
 * carries light much further than rock, which is what carves the soft pools
 * around a lamp instead of a flat disc.
 */
/** Light kept per block travelled through open space. */
const LIGHT_FALL_AIR = 0.82;
/** Light kept per block travelled through solid rock. */
const LIGHT_FALL_SOLID = 0.48;
/** Floor light every explored cell gets, so mined-out rooms never go pitch black. */
const LIGHT_AMBIENT = 0.15;
/** Light below this is clamped to nothing, which keeps the sweeps cheap. */
const LIGHT_CUTOFF = 0.015;
/**
 * Rounds of the four sweeps. One round only propagates in an L — right then
 * down — so light rounding two corners needs a second pass or it leaves hard
 * diagonal seams behind pillars.
 */
const LIGHT_PASSES = 2;

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
    branch: 'green', col: 0, row: 0, cost: 0, requires: [], icon: 'core',
    apply: () => {} },

  // ── RED · Force ──────────────────────────────────────────────────────────
  { id: 'r1', name: 'Honed Tip', desc: '+3 damage on every impact.',
    branch: 'red', col: -1, row: 0, cost: 1, requires: ['core'], icon: 'sword',
    apply: (s) => { s.damage += 3; } },
  { id: 'r2', name: 'Heavy Shot', desc: '+6 damage. The ball hits like a hammer.',
    branch: 'red', col: -2, row: 0, cost: 2, requires: ['r1'], icon: 'sword',
    apply: (s) => { s.damage += 6; } },
  { id: 'r3', name: 'Crushing Blow', desc: '+10 damage.',
    branch: 'red', col: -3, row: 0, cost: 4, requires: ['r2'], icon: 'sword',
    apply: (s) => { s.damage += 10; } },
  { id: 'r4', name: 'Fracture', desc: 'All damage multiplied by 1.35.',
    branch: 'red', col: -3, row: -1, cost: 5, requires: ['r3'], icon: 'spread',
    apply: (s) => { s.damageMul *= 1.35; } },
  { id: 'r5', name: 'Overload', desc: '+18 damage, but shots fly 15% slower.',
    branch: 'red', col: -4, row: 0, cost: 7, requires: ['r3'], icon: 'sword',
    apply: (s) => { s.damage += 18; s.speed *= 0.85; } },

  // ── ORANGE · Impact ──────────────────────────────────────────────────────
  { id: 'o1', name: 'Shockwave', desc: 'Impacts spill 40% damage into neighbours.',
    branch: 'orange', col: -1, row: -1, cost: 1, requires: ['core'], icon: 'comet',
    apply: (s) => { s.splashRadius = Math.max(s.splashRadius, 1); s.splashFactor += 0.4; } },
  { id: 'o2', name: 'Blast Ring', desc: 'Splash reaches 2 blocks out.',
    branch: 'orange', col: -2, row: -2, cost: 2, requires: ['o1'], icon: 'comet',
    apply: (s) => { s.splashRadius = Math.max(s.splashRadius, 2); s.splashFactor += 0.05; } },
  { id: 'o3', name: 'Detonator', desc: 'Unlocks the Bomb ball.',
    branch: 'orange', col: -3, row: -2, cost: 4, requires: ['o2'], icon: 'ball',
    unlocksBall: 'bomb', apply: () => {} },
  { id: 'o4', name: 'Concussion', desc: 'Splash damage +25%.',
    branch: 'orange', col: -2, row: -3, cost: 5, requires: ['o2'], icon: 'spread',
    apply: (s) => { s.splashFactor += 0.25; } },
  { id: 'o5', name: 'Cataclysm', desc: 'Splash radius +1 and splash damage +30%.',
    branch: 'orange', col: -4, row: -2, cost: 7, requires: ['o3'], icon: 'comet',
    apply: (s) => { s.splashRadius += 1; s.splashFactor += 0.3; } },

  // ── YELLOW · Storm ───────────────────────────────────────────────────────
  { id: 'y1', name: 'Static', desc: 'Cooldown 18% shorter.',
    branch: 'yellow', col: 0, row: -1, cost: 1, requires: ['core'], icon: 'clock',
    apply: (s) => { s.reload *= 0.82; } },
  { id: 'y2', name: 'Arc', desc: 'Unlocks the Storm ball.',
    branch: 'yellow', col: 0, row: -2, cost: 2, requires: ['y1'], icon: 'ball',
    unlocksBall: 'lightning', apply: () => {} },
  { id: 'y3', name: 'Conductor', desc: 'Lightning hits +1 block and deals 20% more.',
    branch: 'yellow', col: 0, row: -3, cost: 4, requires: ['y2'], icon: 'bolt',
    apply: (s) => { s.chainTargets += 1; s.chainDamage += 0.2; } },
  { id: 'y4', name: 'Quickdraw', desc: 'Cooldown 28% shorter.',
    branch: 'yellow', col: -1, row: -3, cost: 5, requires: ['y3'], icon: 'clock',
    apply: (s) => { s.reload *= 0.72; } },
  { id: 'y5', name: 'Tempest', desc: 'Lightning hits +2 blocks at 50% more range.',
    branch: 'yellow', col: 0, row: -4, cost: 7, requires: ['y3'], icon: 'bolt',
    apply: (s) => { s.chainTargets += 2; s.chainRange *= 1.5; } },
  { id: 'y6', name: 'Overclock', desc: 'Cooldown 30% shorter. Roughly 2 seconds a shot.',
    branch: 'yellow', col: -1, row: -4, cost: 9, requires: ['y4'], icon: 'clock',
    apply: (s) => { s.reload *= 0.7; } },

  // ── GREEN · Toxin ────────────────────────────────────────────────────────
  { id: 'g1', name: 'Blight', desc: 'Every impact leaves a weak rot behind.',
    branch: 'green', col: 1, row: -1, cost: 1, requires: ['core'], icon: 'skull',
    apply: (s) => { s.poisonBase += 1; } },
  { id: 'g2', name: 'Poison Ball', desc: 'Unlocks the Poison ball.',
    branch: 'green', col: 2, row: -2, cost: 2, requires: ['g1'], icon: 'ball',
    unlocksBall: 'poison', apply: () => {} },
  { id: 'g3', name: 'Virulence', desc: 'Poison ticks for double damage.',
    branch: 'green', col: 3, row: -2, cost: 4, requires: ['g2'], icon: 'skull',
    apply: (s) => { s.poisonDps *= 2; } },
  { id: 'g4', name: 'Contagion', desc: 'Rot creeps 1 block onward from each block it kills, then stops.',
    branch: 'green', col: 2, row: -3, cost: 5, requires: ['g2'], icon: 'spread',
    apply: (s) => { s.poisonSpread = Math.max(s.poisonSpread, 1); } },
  { id: 'g5', name: 'Necrosis', desc: 'Poison lasts twice as long.',
    branch: 'green', col: 4, row: -2, cost: 7, requires: ['g3'], icon: 'skull',
    apply: (s) => { s.poisonTime *= 2; } },
  { id: 'g6', name: 'Pandemic', desc: 'Rot creeps 2 more blocks onward before it burns out.',
    branch: 'green', col: 3, row: -3, cost: 9, requires: ['g4'], icon: 'spread',
    apply: (s) => { s.poisonSpread += 2; } },

  // ── BLUE · Velocity ──────────────────────────────────────────────────────
  { id: 'b1', name: 'Slick', desc: 'Shots travel 20% faster.',
    branch: 'blue', col: 1, row: 0, cost: 1, requires: ['core'], icon: 'comet',
    apply: (s) => { s.speed *= 1.2; } },
  { id: 'b2', name: 'Ricochet', desc: '+8 bounces and +3s of flight.',
    branch: 'blue', col: 2, row: 0, cost: 2, requires: ['b1'], icon: 'comet',
    apply: (s) => { s.bounces += 8; s.lifetime += 3; } },
  { id: 'b3', name: 'Phase', desc: 'Unlocks the Ghost ball.',
    branch: 'blue', col: 3, row: 0, cost: 4, requires: ['b2'], icon: 'ball',
    unlocksBall: 'ghost', apply: () => {} },
  { id: 'b4', name: 'Split Shot', desc: 'Fire 2 balls per pull.',
    branch: 'blue', col: 3, row: 1, cost: 5, requires: ['b2'], icon: 'spread',
    apply: (s) => { s.projectiles += 1; } },
  { id: 'b5', name: 'Volley', desc: 'Fire 2 more balls, in a wider fan.',
    branch: 'blue', col: 4, row: 0, cost: 7, requires: ['b3'], icon: 'spread',
    apply: (s) => { s.projectiles += 2; s.spreadAngle *= 1.25; } },

  // ── MAGENTA · Fortune ────────────────────────────────────────────────────
  { id: 'm1', name: 'Prospector', desc: 'Tokens turn up 50% more often.',
    branch: 'magenta', col: 0, row: 1, cost: 1, requires: ['core'], icon: 'radar',
    apply: (s) => { s.luck += 0.5; } },
  { id: 'm2', name: 'Lure Ball', desc: 'Unlocks the Lure ball.',
    branch: 'magenta', col: 0, row: 2, cost: 2, requires: ['m1'], icon: 'ball',
    unlocksBall: 'lure', apply: () => {} },
  { id: 'm3', name: 'Deep Sight', desc: 'You see 2 blocks further into the dark.',
    branch: 'magenta', col: 0, row: 3, cost: 4, requires: ['m2'], icon: 'radar',
    apply: (s) => { s.revealRadius += 2; } },
  { id: 'm4', name: 'Golden Sense', desc: 'A compass finds the golden block within 25 blocks.',
    branch: 'magenta', col: -1, row: 2, cost: 5, requires: ['m2'], icon: 'flag',
    apply: (s) => { s.compass = Math.max(s.compass, 25); } },
  { id: 'm5', name: 'Midas Touch', desc: 'Tokens +100%, and the compass never sleeps.',
    branch: 'magenta', col: 1, row: 3, cost: 7, requires: ['m3'], icon: 'flag',
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
