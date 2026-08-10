/**
 * BlindShot — portable game data.
 *
 * Everything in this file is plain data + pure functions with no DOM/React
 * dependency, so it can be mirrored 1:1 into Roblox Luau. The Lua mirror lives
 * in `roblox/BlindShotConfig.lua` — keep the two in sync when tuning.
 */

// ─── World ────────────────────────────────────────────────────────────────────

export const GRID_W = 100;
export const GRID_H = 100;
/** World units per block. Blocks are square. */
export const CELL = 16;

/** Where the player starts, in block coordinates. */
export const START_COL = 50;
export const START_ROW = 6;
/** Radius (in blocks) of the pre-carved starting chamber. */
export const START_CHAMBER = 3;

/** Solid, indestructible frame so balls can never leave the map. */
export const BEDROCK_HP = 32000;

// ─── Depth tiers ("levels") ───────────────────────────────────────────────────

export type Tier = {
  name: string;
  /** Base durability of a block in this tier. Each block rolls ±30%. */
  hp: number;
  color: string;
};

/** 8 tiers spread evenly down the map — 12.5 rows each. */
export const TIERS: Tier[] = [
  { name: 'Crust', hp: 3, color: '#9aa4a8' },
  { name: 'Moss', hp: 6, color: '#4ea85c' },
  { name: 'Clay', hp: 11, color: '#b5a72f' },
  { name: 'Rust', hp: 19, color: '#c2703a' },
  { name: 'Ember', hp: 32, color: '#c1402f' },
  { name: 'Slate', hp: 52, color: '#6c6f7a' },
  { name: 'Void', hp: 84, color: '#7a3fb5' },
  { name: 'Core', hp: 130, color: '#c22fa8' },
];

export const ROWS_PER_TIER = GRID_H / TIERS.length;

export function tierOfRow(row: number): number {
  const t = Math.floor(row / ROWS_PER_TIER);
  return t < 0 ? 0 : t >= TIERS.length ? TIERS.length - 1 : t;
}

// ─── Block kinds ──────────────────────────────────────────────────────────────

export const KIND_ROCK = 0;
export const KIND_TOKEN = 1;
export const KIND_GOLDEN = 2;
export const KIND_BEDROCK = 3;

/**
 * 1 in N solid blocks hides an upgrade token, before luck bonuses. Tuned so the
 * first token shows up within the opening few shots — a rarer drop leaves the
 * early game with no feedback at all.
 */
export const TOKEN_RARITY = 85;
/** The golden block only ever spawns in this row band. */
export const GOLDEN_ROW_MIN = 86;
export const GOLDEN_ROW_MAX = 96;
export const GOLDEN_HP = 40;

// ─── Palette ──────────────────────────────────────────────────────────────────

export const PALETTE = {
  bg: '#04160c',
  unseen: '#000000',
  player: '#e8a33d',
  aim: '#ffffff',
  token: '#ffffff',
  golden: '#ffd23d',
  hud: '#4ade80',
  branch: {
    red: '#ef4444',
    orange: '#f97316',
    yellow: '#eab308',
    green: '#22c55e',
    blue: '#38bdf8',
    magenta: '#e935c8',
  },
} as const;

export type BranchId = keyof typeof PALETTE.branch;

// ─── Balls ────────────────────────────────────────────────────────────────────

export type BallId = 'basic' | 'bomb' | 'lightning' | 'poison' | 'ghost' | 'lure';

export type BallDef = {
  id: BallId;
  name: string;
  branch: BranchId;
  color: string;
  desc: string;
  /** Multiplies the player's damage stat. */
  damageMul: number;
  /** Extra splash radius in blocks, on top of the Impact branch. */
  splashBonus: number;
  /** Passes through blocks it fails to break instead of bouncing. */
  pierce: boolean;
  /** Chains lightning on every impact. */
  chains: boolean;
  /** Applies poison on every impact. */
  poisons: boolean;
  /** Reveals a radius of the map around every impact. */
  revealBonus: number;
  /** Multiplies the chance a broken block yields a token. */
  luckMul: number;
  speedMul: number;
};

export const BALLS: Record<BallId, BallDef> = {
  basic: {
    id: 'basic', name: 'Iron ball', branch: 'orange', color: '#f2a65a',
    desc: 'No tricks. Bounces hard and hits reliably.',
    damageMul: 1, splashBonus: 0, pierce: false, chains: false, poisons: false,
    revealBonus: 0, luckMul: 1, speedMul: 1,
  },
  bomb: {
    id: 'bomb', name: 'Bomb ball', branch: 'orange', color: '#fb7a1e',
    desc: 'Detonates on impact. Huge splash, slower flight.',
    damageMul: 0.85, splashBonus: 2, pierce: false, chains: false, poisons: false,
    revealBonus: 0, luckMul: 1, speedMul: 0.85,
  },
  lightning: {
    id: 'lightning', name: 'Storm ball', branch: 'yellow', color: '#f4e04d',
    desc: 'Arcs to nearby blocks on every hit. Fast and fragile.',
    damageMul: 0.8, splashBonus: 0, pierce: false, chains: true, poisons: false,
    revealBonus: 1, luckMul: 1, speedMul: 1.25,
  },
  poison: {
    id: 'poison', name: 'Poison ball', branch: 'green', color: '#3ddc61',
    desc: 'Rots blocks over time. Weak up front, brutal if you wait.',
    damageMul: 0.6, splashBonus: 1, pierce: false, chains: false, poisons: true,
    revealBonus: 0, luckMul: 1, speedMul: 1,
  },
  ghost: {
    id: 'ghost', name: 'Ghost ball', branch: 'blue', color: '#5ad1f5',
    desc: 'Tunnels straight through rock, bleeding speed as it goes.',
    damageMul: 0.7, splashBonus: 0, pierce: true, chains: false, poisons: false,
    revealBonus: 1, luckMul: 1, speedMul: 1.15,
  },
  lure: {
    id: 'lure', name: 'Lure ball', branch: 'magenta', color: '#f45ce0',
    desc: 'Lights up the dark and shakes tokens loose.',
    damageMul: 0.75, splashBonus: 0, pierce: false, chains: false, poisons: false,
    revealBonus: 4, luckMul: 2.5, speedMul: 0.95,
  },
};

/** Order shown in the ball picker. */
export const BALL_ORDER: BallId[] = ['basic', 'bomb', 'lightning', 'poison', 'ghost', 'lure'];

// ─── Player stats ─────────────────────────────────────────────────────────────

export type Stats = {
  damage: number;
  damageMul: number;
  splashRadius: number;
  splashFactor: number;
  projectiles: number;
  spreadAngle: number;
  bounces: number;
  speed: number;
  lifetime: number;
  reload: number;
  chainTargets: number;
  chainRange: number;
  chainDamage: number;
  poisonBase: number;
  poisonDps: number;
  poisonTime: number;
  poisonSpreads: boolean;
  revealRadius: number;
  luck: number;
  compass: number;
};

export const BASE_STATS: Stats = {
  damage: 4,
  damageMul: 1,
  splashRadius: 0,
  splashFactor: 0,
  projectiles: 1,
  spreadAngle: 0.16,
  // Generous bounce budget: a shot fired from inside an already-carved cave
  // still has to cross open space before it reaches fresh rock.
  bounces: 7,
  speed: 380,
  lifetime: 7,
  reload: 0.55,
  chainTargets: 2,
  chainRange: 5,
  chainDamage: 0.5,
  poisonBase: 0,
  poisonDps: 2,
  poisonTime: 3,
  poisonSpreads: false,
  revealRadius: 2.6,
  luck: 1,
  compass: 0,
};

// ─── Tech tree ────────────────────────────────────────────────────────────────

export type IconId =
  | 'sword' | 'comet' | 'spread' | 'ball' | 'bolt'
  | 'skull' | 'radar' | 'flag' | 'clock' | 'core';

export type TechNode = {
  id: string;
  name: string;
  desc: string;
  branch: BranchId;
  /** Grid position in the tree graph. Core sits at (0, 0). */
  col: number;
  row: number;
  cost: number;
  requires: string[];
  icon: IconId;
  /** Circle nodes unlock a ball or ability; square nodes are passive stats. */
  shape: 'circle' | 'square';
  unlocksBall?: BallId;
  apply: (s: Stats) => void;
};

export const TECH: TechNode[] = [
  {
    id: 'core', name: 'Slingshot', desc: 'Pull back, let go, listen for the crack.',
    branch: 'green', col: 0, row: 0, cost: 0, requires: [], icon: 'core', shape: 'circle',
    apply: () => {},
  },

  // ── RED · Force ────────────────────────────────────────────────────────────
  {
    id: 'r1', name: 'Honed Tip', desc: '+2 damage on every impact.',
    branch: 'red', col: -1, row: 0, cost: 1, requires: ['core'], icon: 'sword', shape: 'square',
    apply: (s) => { s.damage += 2; },
  },
  {
    id: 'r2', name: 'Heavy Shot', desc: '+4 damage. The ball hits like a hammer.',
    branch: 'red', col: -2, row: 0, cost: 2, requires: ['r1'], icon: 'sword', shape: 'square',
    apply: (s) => { s.damage += 4; },
  },
  {
    id: 'r3', name: 'Crushing Blow', desc: '+7 damage.',
    branch: 'red', col: -3, row: 0, cost: 4, requires: ['r2'], icon: 'sword', shape: 'square',
    apply: (s) => { s.damage += 7; },
  },
  {
    id: 'r4', name: 'Fracture', desc: 'All damage multiplied by 1.35.',
    branch: 'red', col: -3, row: -1, cost: 5, requires: ['r3'], icon: 'spread', shape: 'square',
    apply: (s) => { s.damageMul *= 1.35; },
  },
  {
    id: 'r5', name: 'Overload', desc: '+14 damage, but shots fly 15% slower.',
    branch: 'red', col: -4, row: 0, cost: 7, requires: ['r3'], icon: 'sword', shape: 'square',
    apply: (s) => { s.damage += 14; s.speed *= 0.85; },
  },

  // ── ORANGE · Impact ────────────────────────────────────────────────────────
  {
    id: 'o1', name: 'Shockwave', desc: 'Impacts spill 40% damage into neighbours.',
    branch: 'orange', col: -1, row: -1, cost: 1, requires: ['core'], icon: 'comet', shape: 'square',
    apply: (s) => { s.splashRadius = Math.max(s.splashRadius, 1); s.splashFactor += 0.4; },
  },
  {
    id: 'o2', name: 'Blast Ring', desc: 'Splash reaches 2 blocks out.',
    branch: 'orange', col: -2, row: -2, cost: 2, requires: ['o1'], icon: 'comet', shape: 'square',
    apply: (s) => { s.splashRadius = Math.max(s.splashRadius, 2); s.splashFactor += 0.05; },
  },
  {
    id: 'o3', name: 'Detonator', desc: 'Unlocks the Bomb ball.',
    branch: 'orange', col: -3, row: -2, cost: 4, requires: ['o2'], icon: 'ball', shape: 'circle',
    unlocksBall: 'bomb', apply: () => {},
  },
  {
    id: 'o4', name: 'Concussion', desc: 'Splash damage +25%.',
    branch: 'orange', col: -2, row: -3, cost: 5, requires: ['o2'], icon: 'spread', shape: 'square',
    apply: (s) => { s.splashFactor += 0.25; },
  },
  {
    id: 'o5', name: 'Cataclysm', desc: 'Splash radius +1 and splash damage +30%.',
    branch: 'orange', col: -4, row: -2, cost: 7, requires: ['o3'], icon: 'comet', shape: 'square',
    apply: (s) => { s.splashRadius += 1; s.splashFactor += 0.3; },
  },

  // ── YELLOW · Storm ─────────────────────────────────────────────────────────
  {
    id: 'y1', name: 'Static', desc: 'Reload 20% faster.',
    branch: 'yellow', col: 0, row: -1, cost: 1, requires: ['core'], icon: 'clock', shape: 'square',
    apply: (s) => { s.reload *= 0.8; },
  },
  {
    id: 'y2', name: 'Arc', desc: 'Unlocks the Storm ball.',
    branch: 'yellow', col: 0, row: -2, cost: 2, requires: ['y1'], icon: 'ball', shape: 'circle',
    unlocksBall: 'lightning', apply: () => {},
  },
  {
    id: 'y3', name: 'Conductor', desc: 'Lightning hits +1 block and deals 40% more.',
    branch: 'yellow', col: 0, row: -3, cost: 4, requires: ['y2'], icon: 'bolt', shape: 'square',
    apply: (s) => { s.chainTargets += 1; s.chainDamage += 0.2; },
  },
  {
    id: 'y4', name: 'Quickdraw', desc: 'Reload 30% faster.',
    branch: 'yellow', col: -1, row: -3, cost: 5, requires: ['y3'], icon: 'clock', shape: 'square',
    apply: (s) => { s.reload *= 0.7; },
  },
  {
    id: 'y5', name: 'Tempest', desc: 'Lightning hits +2 blocks at 50% more range.',
    branch: 'yellow', col: 0, row: -4, cost: 7, requires: ['y3'], icon: 'bolt', shape: 'square',
    apply: (s) => { s.chainTargets += 2; s.chainRange *= 1.5; },
  },

  // ── GREEN · Toxin ──────────────────────────────────────────────────────────
  {
    id: 'g1', name: 'Blight', desc: 'Every impact leaves a weak rot behind.',
    branch: 'green', col: 1, row: -1, cost: 1, requires: ['core'], icon: 'skull', shape: 'square',
    apply: (s) => { s.poisonBase += 1; },
  },
  {
    id: 'g2', name: 'Poison Ball', desc: 'Unlocks the Poison ball.',
    branch: 'green', col: 2, row: -2, cost: 2, requires: ['g1'], icon: 'ball', shape: 'circle',
    unlocksBall: 'poison', apply: () => {},
  },
  {
    id: 'g3', name: 'Virulence', desc: 'Poison ticks for double damage.',
    branch: 'green', col: 3, row: -2, cost: 4, requires: ['g2'], icon: 'skull', shape: 'square',
    apply: (s) => { s.poisonDps *= 2; },
  },
  {
    id: 'g4', name: 'Contagion', desc: 'Poison creeps into neighbouring blocks.',
    branch: 'green', col: 2, row: -3, cost: 5, requires: ['g2'], icon: 'spread', shape: 'square',
    apply: (s) => { s.poisonSpreads = true; },
  },
  {
    id: 'g5', name: 'Necrosis', desc: 'Poison lasts twice as long.',
    branch: 'green', col: 4, row: -2, cost: 7, requires: ['g3'], icon: 'skull', shape: 'square',
    apply: (s) => { s.poisonTime *= 2; },
  },

  // ── BLUE · Velocity ────────────────────────────────────────────────────────
  {
    id: 'b1', name: 'Slick', desc: 'Shots travel 20% faster.',
    branch: 'blue', col: 1, row: 0, cost: 1, requires: ['core'], icon: 'comet', shape: 'square',
    apply: (s) => { s.speed *= 1.2; },
  },
  {
    id: 'b2', name: 'Ricochet', desc: '+5 bounces and +1s of flight.',
    branch: 'blue', col: 2, row: 0, cost: 2, requires: ['b1'], icon: 'comet', shape: 'square',
    apply: (s) => { s.bounces += 5; s.lifetime += 1; },
  },
  {
    id: 'b3', name: 'Phase', desc: 'Unlocks the Ghost ball.',
    branch: 'blue', col: 3, row: 0, cost: 4, requires: ['b2'], icon: 'ball', shape: 'circle',
    unlocksBall: 'ghost', apply: () => {},
  },
  {
    id: 'b4', name: 'Split Shot', desc: 'Fire 2 balls per pull.',
    branch: 'blue', col: 3, row: 1, cost: 5, requires: ['b2'], icon: 'spread', shape: 'square',
    apply: (s) => { s.projectiles += 1; },
  },
  {
    id: 'b5', name: 'Volley', desc: 'Fire 2 more balls, in a wider fan.',
    branch: 'blue', col: 4, row: 0, cost: 7, requires: ['b3'], icon: 'spread', shape: 'square',
    apply: (s) => { s.projectiles += 2; s.spreadAngle *= 1.25; },
  },

  // ── MAGENTA · Fortune ──────────────────────────────────────────────────────
  {
    id: 'm1', name: 'Prospector', desc: 'Tokens turn up 50% more often.',
    branch: 'magenta', col: 0, row: 1, cost: 1, requires: ['core'], icon: 'radar', shape: 'square',
    apply: (s) => { s.luck += 0.5; },
  },
  {
    id: 'm2', name: 'Lure Ball', desc: 'Unlocks the Lure ball.',
    branch: 'magenta', col: 0, row: 2, cost: 2, requires: ['m1'], icon: 'ball', shape: 'circle',
    unlocksBall: 'lure', apply: () => {},
  },
  {
    id: 'm3', name: 'Deep Sight', desc: 'You see 2 blocks further into the dark.',
    branch: 'magenta', col: 0, row: 3, cost: 4, requires: ['m2'], icon: 'radar', shape: 'square',
    apply: (s) => { s.revealRadius += 2; },
  },
  {
    id: 'm4', name: 'Golden Sense', desc: 'A compass finds the golden block within 25 blocks.',
    branch: 'magenta', col: -1, row: 2, cost: 5, requires: ['m2'], icon: 'flag', shape: 'circle',
    apply: (s) => { s.compass = Math.max(s.compass, 25); },
  },
  {
    id: 'm5', name: 'Midas Touch', desc: 'Tokens +100%, and the compass never sleeps.',
    branch: 'magenta', col: 1, row: 3, cost: 7, requires: ['m3'], icon: 'flag', shape: 'circle',
    apply: (s) => { s.luck += 1; s.compass = 9999; },
  },
];

export const TECH_BY_ID: Record<string, TechNode> = Object.fromEntries(
  TECH.map((n) => [n.id, n]),
);

/** Rebuild the full stat block from a set of unlocked node ids. */
export function statsFor(unlocked: Iterable<string>): Stats {
  const s: Stats = { ...BASE_STATS };
  for (const id of unlocked) TECH_BY_ID[id]?.apply(s);
  return s;
}

/** Which ball types a set of unlocked nodes gives access to. */
export function ballsFor(unlocked: Iterable<string>): BallId[] {
  const out: BallId[] = ['basic'];
  for (const id of unlocked) {
    const b = TECH_BY_ID[id]?.unlocksBall;
    if (b && !out.includes(b)) out.push(b);
  }
  return BALL_ORDER.filter((b) => out.includes(b));
}

// ─── Seeded RNG (mulberry32) ──────────────────────────────────────────────────

export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
