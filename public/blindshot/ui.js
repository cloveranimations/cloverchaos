/*
 * BlindShot — DOM layer: input, HUD, minimap, tech tree, haptics, and the
 * frame loop that drives the other three files.
 *
 * Load order is config.js → engine.js → render.js → this. The first two are
 * DOM-free and port to Luau as-is; this file and render.js are the parts a
 * Roblox build replaces.
 */
'use strict';

/* v4: tiers radiate from the spawn point instead of running by row, so a v3
   grid restored into a v4 world would have mismatched rock. Old saves drop. */
const SAVE_KEY = 'blindshot.save.v4';
const WORLD_W = GRID_W * CELL;
const WORLD_H = GRID_H * CELL;
const MAX_PULL = 120;

const $ = (id) => document.getElementById(id);
const el = {
  cv: $('cv'), mini: $('mini'), miniWrap: $('miniWrap'),
  depth: $('depth'), tokens: $('tokens'),
  vibBtn: $('vibBtn'), mapBtn: $('mapBtn'), techBtn: $('techBtn'),
  compass: $('compass'), compassTxt: $('compassTxt'), banner: $('banner'), help: $('help'),
  cdFill: $('cdFill'), cdText: $('cdText'), chips: $('chips'),
  tree: $('tree'), treeView: $('treeView'), treePan: $('treePan'), treeSvg: $('treeSvg'),
  treeTokens: $('treeTokens'), treeClose: $('treeClose'), nodeCard: $('nodeCard'),
  dNm: $('dNm'), dDs: $('dDs'), dBtn: $('dBtn'),
  card: $('card'), cardName: $('cardName'), cardDesc: $('cardDesc'),
  win: $('win'), winSub: $('winSub'), winBtn: $('winBtn'),
};

const ctx = el.cv.getContext('2d', { alpha: false });
const mctx = el.mini.getContext('2d');

/* Colour helpers and the block renderer live in render.js. */

const lightMap = newLightMap();

/** Every ball is a moving lamp in its own ball colour. Cached per type. */
const BALL_LIGHT = {};
for (const id of BALL_ORDER) {
  const c = hexToRgb(BALLS[id].color);
  BALL_LIGHT[id] = [c.r / 255, c.g / 255, c.b / 255];
}
const ballLightRgb = (type) => BALL_LIGHT[type] || BALL_LIGHT.basic;
const PLAYER_LIGHT = (() => {
  const c = hexToRgb(PALETTE.player);
  return [c.r / 255, c.g / 255, c.b / 255];
})();

/* ── Haptics ─────────────────────────────────────────────────────────────── */

const VIB_SUPPORTED = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

/**
 * Device vibration. `navigator.vibrate` is the only web API that can shake a
 * phone; iOS Safari does not implement it at all, so the button reports that
 * honestly rather than pretending.
 */
function buzz(pattern) {
  if (!state.vibeOn || !VIB_SUPPORTED) return;
  try { navigator.vibrate(pattern); } catch (_) { /* blocked by the browser */ }
}

/* ── State ───────────────────────────────────────────────────────────────── */

const state = {
  tokens: 0,
  unlocked: new Set(['core']),
  activeBall: 'basic',
  won: false,
  vibeOn: VIB_SUPPORTED,
  mapOn: true,
  treeOpen: false,
  cardOpen: false,
};

let world = null;
let stats = statsFor(state.unlocked);
let balls = [];
const player = { col: START_COL, row: START_ROW, x: 0, y: 0, vx: 0, vy: 0 };
const cam = { x: 0, y: 0 };
const aim = { active: false, sx: 0, sy: 0, angle: Math.PI / 2, power: 0 };
const ptr = { id: -1, t0: 0, moved: 0 };
const joystickL = { id: -1, x: 0, y: 0, cx: 0, cy: 0, active: false };
const joystickR = { id: -1, x: 0, y: 0, cx: 0, cy: 0, active: false };
const JOYSTICK_RADIUS = 60;
const JOYSTICK_DEADZONE = 15;
const JOYSTICK_MOVE_SPEED = 6;
let particles = [], arcs = [], texts = [], blockFx = [];
let reload = 0, shake = 0;
/** Furthest straight-line distance from spawn reached, in blocks. Drives the
 *  LAYER readout and the level-up banner. */
let reach = 0, broken = 0, maxTier = 0;
let lastVib = 0, firedOnce = false;
let miniDirty = true, miniTimer = 0;
let bannerTimer = 0, bannerRank = 0;

const rng = Math.random;
const dmg = { stats, rng, fx: newEffects(), ballLuck: 1, ballReveal: 0 };

/* ── Accent ──────────────────────────────────────────────────────────────── */

let accentHex = PALETTE.hud;
const accentCur = hexToRgb(PALETTE.hud);
let hoverAccent = null;
let selectedNodeId = 'core';

function refreshAccent() {
  const next = state.treeOpen
    ? (hoverAccent || PALETTE.branch[(TECH_BY_ID[selectedNodeId] || TECH[0]).branch])
    : (hoverAccent || BALLS[state.activeBall].color);
  if (next === accentHex) return;
  accentHex = next;
  document.documentElement.style.setProperty('--accent', next);
}

function stepAccent(dt) {
  const t = hexToRgb(accentHex);
  const k = 1 - Math.exp(-6 * dt);
  accentCur.r += (t.r - accentCur.r) * k;
  accentCur.g += (t.g - accentCur.g) * k;
  accentCur.b += (t.b - accentCur.b) * k;
}
const accentRgba = (a) =>
  `rgba(${accentCur.r | 0},${accentCur.g | 0},${accentCur.b | 0},${a})`;

/* ── Save / load ─────────────────────────────────────────────────────────── */

function save() {
  if (!world) return;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      v: 4,
      seed: world.seed,
      tokens: state.tokens,
      unlocked: Array.from(state.unlocked),
      ball: state.activeBall,
      col: player.col, row: player.row,
      reach, broken,
      won: state.won,
      sighted: world.goldenSighted,
      vibe: state.vibeOn, map: state.mapOn,
      hp: rle(world.hp),
      seen: rle(world.seen),
    }));
  } catch (_) { /* storage full or blocked — the run just won't persist */ }
}

function startWorld(seed, data) {
  const w = genWorld(seed);
  const restored = !!data && unrle(data.hp, w.hp) && unrle(data.seen, w.seen);
  if (restored) {
    player.col = data.col; player.row = data.row;
    reach = data.reach || 0; broken = data.broken;
    maxTier = Math.floor(reach / 20) * 20;
    w.goldenSighted = !!data.sighted;
  } else {
    player.col = w.spawnCol; player.row = w.spawnRow;
    reach = 0; broken = 0; maxTier = 0;
    // Clear the old hardcoded spawn location (50, 6) and its chamber so it never
    // bleeds through from stale saves or initialization artifacts.
    for (let dr = -5; dr <= 5; dr++) {
      for (let dc = -5; dc <= 5; dc++) {
        const row = 6 + dr, col = 50 + dc;
        if (row >= 0 && row < GRID_H && col >= 0 && col < GRID_W) {
          w.seen[row * GRID_W + col] = 0;
        }
      }
    }
  }
  player.x = (player.col + 0.5) * CELL;
  player.y = (player.row + 0.5) * CELL;
  cam.x = player.x; cam.y = player.y;
  balls = []; particles = []; arcs = []; texts = []; blockFx = [];
  reload = 0; shake = 0;
  world = w;
  miniDirty = true;
}

function load() {
  let data = null;
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (p && p.v === 4 && Array.isArray(p.hp) && Array.isArray(p.seen)) data = p;
    }
  } catch (_) { data = null; }

  if (data) {
    state.tokens = data.tokens || 0;
    state.unlocked = new Set(data.unlocked && data.unlocked.length ? data.unlocked : ['core']);
    state.activeBall = BALLS[data.ball] ? data.ball : 'basic';
    state.won = !!data.won;
    if (typeof data.vibe === 'boolean') state.vibeOn = data.vibe && VIB_SUPPORTED;
    if (typeof data.map === 'boolean') state.mapOn = data.map;
    stats = statsFor(state.unlocked);
    startWorld(data.seed, data);
  } else {
    startWorld((Math.random() * 0xffffffff) >>> 0, null);
  }
  if (state.won) el.win.classList.add('open');
}

function newRun() {
  state.tokens = 0;
  state.unlocked = new Set(['core']);
  state.activeBall = 'basic';
  state.won = false;
  stats = statsFor(state.unlocked);
  el.win.classList.remove('open');
  el.tree.classList.remove('open');
  state.treeOpen = false;
  selectedNodeId = 'core';
  startWorld((Math.random() * 0xffffffff) >>> 0, null);
  try { localStorage.removeItem(SAVE_KEY); } catch (_) { /* ignore */ }
  buildChips();
  syncTree();
  syncHud(true);
  refreshAccent();
}

/* ── Layers ──────────────────────────────────────────────────────────────── */

/** Straight-line distance from this run's spawn point, in blocks. */
function distFromSpawn(col, row) {
  return world ? distFrom(col, row, world.spawnCol, world.spawnRow) : 0;
}


/* ── Banner ──────────────────────────────────────────────────────────────── */

/**
 * `rank` keeps a routine depth milestone from stomping something the player
 * waited the whole run to read — sighting the golden block outranks everything.
 */
function banner(text, seconds, rank) {
  const r = rank || 0;
  if (bannerTimer > 0 && r < bannerRank) return;
  el.banner.textContent = text;
  el.banner.classList.add('show');
  bannerTimer = seconds || 2.6;
  bannerRank = r;
}

/* ── HUD ─────────────────────────────────────────────────────────────────── */

function syncHud(force) {
  el.depth.textContent = Math.round(distFromSpawn(player.col, player.row));
  el.tokens.textContent = '◆ ' + state.tokens;
  el.treeTokens.textContent = '◆ ' + state.tokens;

  const frac = reload > 0 ? 1 - reload / Math.max(0.001, stats.reload) : 1;
  el.cdFill.style.width = (frac * 100).toFixed(1) + '%';
  if (reload > 0) {
    el.cdText.textContent = reload.toFixed(1) + 's';
    el.cdText.classList.add('wait');
  } else {
    el.cdText.textContent = 'READY';
    el.cdText.classList.remove('wait');
  }

  // The compass is earned two ways: buy Golden Sense, or lay eyes on the block.
  const alive = world && world.goldenIdx >= 0 && world.hp[world.goldenIdx] > 0;
  const range = world && world.goldenSighted ? 9999 : stats.compass;
  if (alive && range > 0) {
    const gc = world.goldenIdx % GRID_W;
    const gr = (world.goldenIdx / GRID_W) | 0;
    const dc = gc - player.col, dr = gr - player.row;
    const d = Math.hypot(dc, dr);
    if (d <= range) {
      el.compass.style.display = 'flex';
      el.compass.querySelector('.arrow').style.transform = `rotate(${Math.atan2(dr, dc)}rad)`;
      el.compassTxt.textContent = Math.round(d) + ' BLOCKS';
    } else {
      el.compass.style.display = 'none';
    }
  } else {
    el.compass.style.display = 'none';
  }
  if (force) buildChips();
}

function buildChips() {
  const list = ballsFor(state.unlocked);
  el.chips.textContent = '';
  for (const id of list) {
    const def = BALLS[id];
    const b = document.createElement('button');
    b.className = 'chip' + (state.activeBall === id ? ' on' : '');
    b.style.color = def.color;
    b.style.background = state.activeBall === id ? def.color + '22' : 'rgba(0,0,0,.6)';
    b.innerHTML = '<span class="dot"></span>' + def.name.replace(' ball', '').toUpperCase();
    b.addEventListener('pointerenter', () => { hoverAccent = def.color; refreshAccent(); });
    b.addEventListener('pointerleave', () => { hoverAccent = null; refreshAccent(); });
    b.addEventListener('click', () => {
      state.activeBall = id;
      hoverAccent = null;
      buildChips();
      refreshAccent();
      buzz(10);
      save();
    });
    el.chips.appendChild(b);
  }
}

/* ── Tech tree ───────────────────────────────────────────────────────────── */

const ICONS = {
  sword: '<path d="M12 3 L15 6 L8 13 L5 10 Z"/><path d="M4 15 L7 12 L9 14 L6 17 Z"/>',
  comet: '<circle cx="13" cy="7" r="3.4"/><path d="M9 11 L3 17 M11 13 L6 17 M7 9 L3 12"/>',
  spread: '<circle cx="10" cy="10" r="2.6"/><path d="M10 3 v3 M10 14 v3 M3 10 h3 M14 10 h3 M5 5 l2 2 M13 13 l2 2 M15 5 l-2 2 M7 13 l-2 2"/>',
  ball: '<circle cx="10" cy="10" r="5.6"/><circle cx="8" cy="8" r="1.5" fill="none"/>',
  bolt: '<path d="M11 2 L5 11 h4 l-1 7 6-9 h-4 z"/>',
  skull: '<path d="M10 3 a6 6 0 0 1 6 6 v3 l-2 2 v3 h-8 v-3 l-2-2 V9 a6 6 0 0 1 6-6z"/><circle cx="7.6" cy="9.5" r="1.6" fill="#000"/><circle cx="12.4" cy="9.5" r="1.6" fill="#000"/>',
  radar: '<circle cx="10" cy="10" r="7" fill="none"/><circle cx="10" cy="10" r="3.4" fill="none"/><path d="M10 10 L16 5"/>',
  flag: '<path d="M5 3 v14"/><path d="M6 4 h9 l-2.5 3 L15 10 H6 z"/>',
  clock: '<circle cx="10" cy="10" r="7" fill="none"/><path d="M10 6 v4.6 l3 2"/>',
  core: '<circle cx="10" cy="10" r="6.4" fill="none"/><circle cx="10" cy="10" r="2.4"/>',
};

const NODE_SIZE = 46;
const GAP_X = 88;
const GAP_Y = 82;
const nodeEls = {};
const pan = { x: 0, y: 0, dragging: false, sx: 0, sy: 0, ox: 0, oy: 0, moved: 0, id: -1 };

function buildTree() {
  const cols = TECH.map((n) => n.col);
  const rows = TECH.map((n) => n.row);
  const minC = Math.min(...cols), maxC = Math.max(...cols);
  const minR = Math.min(...rows), maxR = Math.max(...rows);
  const W = (maxC - minC) * GAP_X + NODE_SIZE + 60;
  const H = (maxR - minR) * GAP_Y + NODE_SIZE + 60;
  const px = (n) => (n.col - minC) * GAP_X + 30;
  const py = (n) => (n.row - minR) * GAP_Y + 30;

  el.treeSvg.setAttribute('width', W);
  el.treeSvg.setAttribute('height', H);
  el.treeSvg.textContent = '';
  for (const n of TECH) {
    for (const req of n.requires) {
      const p = TECH_BY_ID[req];
      if (!p) continue;
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', px(p) + NODE_SIZE / 2);
      line.setAttribute('y1', py(p) + NODE_SIZE / 2);
      line.setAttribute('x2', px(n) + NODE_SIZE / 2);
      line.setAttribute('y2', py(n) + NODE_SIZE / 2);
      line.setAttribute('stroke', PALETTE.branch[n.branch]);
      line.setAttribute('stroke-width', '3');
      // Dotted, not solid: the tree should read as a wiring diagram.
      line.setAttribute('stroke-dasharray', '1 7');
      line.setAttribute('stroke-linecap', 'round');
      line.setAttribute('opacity', '.3');
      line.dataset.edge = n.id;
      el.treeSvg.appendChild(line);
    }
  }

  el.treePan.textContent = '';
  el.treePan.appendChild(el.nodeCard); // survives the wipe above
  el.treePan.style.width = W + 'px';
  el.treePan.style.height = H + 'px';
  for (const n of TECH) {
    const color = PALETTE.branch[n.branch];
    const b = document.createElement('button');
    b.className = 'node';
    b.style.left = px(n) + 'px';
    b.style.top = py(n) + 'px';
    b.style.setProperty('--nc', color);
    b.title = n.name;
    b.innerHTML =
      `<svg width="22" height="22" viewBox="0 0 20 20" fill="currentColor" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round">${ICONS[n.icon]}</svg>`;
    b.addEventListener('pointerenter', () => { hoverAccent = color; refreshAccent(); });
    b.addEventListener('pointerleave', () => { hoverAccent = null; refreshAccent(); });
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      selectedNodeId = n.id;
      hoverAccent = null;
      syncTree();
      refreshAccent();
    });
    nodeEls[n.id] = b;
    el.treePan.appendChild(b);
  }

  // Remember where the core sits so the first open can centre on it. The view
  // has no measurable size while the sheet is display:none.
  treeCore.x = px(TECH_BY_ID.core) + NODE_SIZE / 2;
  treeCore.y = py(TECH_BY_ID.core) + NODE_SIZE / 2;
}

const treeCore = { x: 0, y: 0 };
let treeCentered = false;

function centreTree() {
  if (treeCentered) return;
  const rect = el.treeView.getBoundingClientRect();
  if (rect.width < 2) return;
  treeCentered = true;
  pan.x = rect.width / 2 - treeCore.x;
  pan.y = rect.height / 2 - treeCore.y;
  applyPan();
}

function applyPan() {
  const t = `translate(${Math.round(pan.x)}px, ${Math.round(pan.y)}px)`;
  el.treePan.style.transform = t;
  el.treeSvg.style.transform = t;
}

function canAfford(n) {
  return !state.unlocked.has(n.id)
    && n.requires.every((r) => state.unlocked.has(r))
    && state.tokens >= n.cost;
}

/* ── Node card ────────────────────────────────────────────────────────────
 *
 * What a node is worth is derived, never hand-written: price the stat block
 * with and without the node and diff it. That way the card stays honest when
 * the tree is retuned, and a new node needs no copy written for it.
 */

/** Stats that read better as a percentage of their base than as a raw number. */
const STAT_PCT = new Set(['speed', 'damageMul', 'splashFactor', 'luck', 'chainDamage']);
const STAT_SEC = new Set(['reload', 'lifetime', 'poisonTime']);
/** Stats with no natural card line — they are described, not numbered. */
const STAT_HIDE = new Set(['compass']);

function fmtStat(key, v) {
  if (STAT_PCT.has(key)) {
    const base = BASE_STATS[key] || 1;
    const pct = Math.round((v / base - 1) * 100);
    return (pct >= 0 ? '+' : '') + pct + '%';
  }
  if (STAT_SEC.has(key)) return (Math.round(v * 10) / 10) + 's';
  return String(Math.round(v * 100) / 100);
}

/** The change on its own — "+20%" for a ratio stat, "+1" for a flat one. */
function deltaLabel(d) {
  const sign = d.to >= d.from ? '+' : '';
  if (STAT_PCT.has(d.key)) {
    const base = BASE_STATS[d.key] || 1;
    return sign + Math.round(((d.to - d.from) / base) * 100) + '%';
  }
  const raw = Math.round((d.to - d.from) * 100) / 100;
  return sign + raw + (STAT_SEC.has(d.key) ? 's' : '');
}

/** `{ key, from, to }` for the one stat a node moves most, or null. */
function nodeDelta(n) {
  const without = new Set(state.unlocked);
  without.delete(n.id);
  const before = statsFor(without);
  const after = statsFor(new Set(without).add(n.id));
  let best = null;
  for (const key of Object.keys(before)) {
    if (STAT_HIDE.has(key) || before[key] === after[key]) continue;
    const rel = Math.abs((after[key] - before[key]) / (Math.abs(before[key]) || 1));
    if (!best || rel > best.rel) best = { key, from: before[key], to: after[key], rel };
  }
  return best;
}

function syncNodeCard(n) {
  const b = nodeEls[n.id];
  if (!b) { el.nodeCard.style.display = 'none'; return; }
  const owned = state.unlocked.has(n.id);
  const color = PALETTE.branch[n.branch];

  let kicker, big, sub;
  if (n.unlocksBall) {
    kicker = owned ? 'Ball' : 'New ball';
    big = BALLS[n.unlocksBall].name;
    sub = n.branch.charAt(0).toUpperCase() + n.branch.slice(1);
  } else {
    const d = nodeDelta(n);
    kicker = n.name;
    if (!d) { big = n.desc; sub = ''; }
    else if (owned) { big = fmtStat(d.key, d.to); sub = ''; }
    else {
      big = fmtStat(d.key, d.from) + ' > ' + fmtStat(d.key, d.to);
      sub = deltaLabel(d);
    }
  }

  el.nodeCard.style.display = '';
  el.nodeCard.style.setProperty('--nc', color);
  el.nodeCard.innerHTML =
    `<div class="k">${kicker}</div><div class="v">${big}</div>` +
    (sub ? `<div class="s">${sub}</div>` : '') +
    (!owned && n.cost > 0 ? `<div class="c">◆ ${n.cost}</div>` : '');

  // Anchor above the node, clamped so it never hangs off the pannable area.
  const left = parseFloat(b.style.left) + NODE_SIZE / 2;
  const top = parseFloat(b.style.top);
  el.nodeCard.style.left = '0px';
  el.nodeCard.style.top = '0px';
  const cw = el.nodeCard.offsetWidth, ch = el.nodeCard.offsetHeight;
  el.nodeCard.style.left = Math.round(left - cw / 2) + 'px';
  el.nodeCard.style.top = Math.round(top - ch - 16) + 'px';

  // Retrigger the deal-in animation on every reselect.
  el.nodeCard.style.animation = 'none';
  void el.nodeCard.offsetWidth;
  el.nodeCard.style.animation = '';
}

function syncTree() {
  for (const n of TECH) {
    const b = nodeEls[n.id];
    if (!b) continue;
    const owned = state.unlocked.has(n.id);
    const ready = n.requires.every((r) => state.unlocked.has(r));
    // "far" is one step beyond reachable: its prerequisites are not owned and
    // neither are theirs, so it is context rather than a choice.
    const near = ready || n.requires.some((r) => {
      const p = TECH_BY_ID[r];
      return p && p.requires.every((rr) => state.unlocked.has(rr));
    });
    b.classList.toggle('owned', owned);
    b.classList.toggle('ready', !owned && ready);
    b.classList.toggle('far', !owned && !near);
    b.classList.toggle('short', !owned && ready && state.tokens < n.cost);
    b.classList.toggle('sel', selectedNodeId === n.id);

    const plus = b.querySelector('.plus');
    const buyable = !owned && ready && state.tokens >= n.cost;
    if (buyable && !plus) {
      const s = document.createElement('span');
      s.className = 'plus';
      s.textContent = '+';
      b.appendChild(s);
    } else if (!buyable && plus) {
      plus.remove();
    }
  }
  for (const line of Array.from(el.treeSvg.children)) {
    line.setAttribute('opacity', state.unlocked.has(line.dataset.edge) ? '.85' : '.3');
  }

  const n = TECH_BY_ID[selectedNodeId] || TECH[0];
  el.dNm.textContent = n.name;
  el.dDs.textContent = n.desc;
  el.treeTokens.textContent = '◆ ' + state.tokens;
  syncNodeCard(n);

  if (state.unlocked.has(n.id)) {
    el.dBtn.textContent = 'OWNED';
    el.dBtn.disabled = true;
    el.dBtn.className = 'solid';
  } else if (!n.requires.every((r) => state.unlocked.has(r))) {
    el.dBtn.textContent = 'LOCKED';
    el.dBtn.disabled = true;
    el.dBtn.className = 'mute';
  } else if (state.tokens < n.cost) {
    el.dBtn.textContent = 'NEED ◆' + n.cost;
    el.dBtn.disabled = true;
    el.dBtn.className = 'mute';
  } else {
    el.dBtn.textContent = 'UNLOCK ◆' + n.cost;
    el.dBtn.disabled = false;
    el.dBtn.className = 'solid';
  }
}

function unlockSelected() {
  const n = TECH_BY_ID[selectedNodeId];
  if (!n || !canAfford(n)) return;
  state.tokens -= n.cost;
  state.unlocked.add(n.id);
  stats = statsFor(state.unlocked);
  buzz([12, 40, 12]);
  if (n.unlocksBall) {
    state.activeBall = n.unlocksBall;
    state.cardOpen = true;
    el.cardName.textContent = BALLS[n.unlocksBall].name;
    el.cardDesc.textContent = BALLS[n.unlocksBall].desc;
    el.card.classList.add('open');
  }
  buildChips();
  syncTree();
  syncHud();
  save();
}

/* ── Input ───────────────────────────────────────────────────────────────── */

function viewScale(cssW) {
  const cols = cssW < 520 ? 17 : cssW < 760 ? 21 : 27;
  return cssW / (cols * CELL);
}

let cssW = 1, cssH = 1, dpr = 1;

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  cssW = Math.max(1, Math.round(window.innerWidth));
  cssH = Math.max(1, Math.round(window.innerHeight));
  el.cv.width = Math.round(cssW * dpr);
  el.cv.height = Math.round(cssH * dpr);
  el.cv.style.width = cssW + 'px';
  el.cv.style.height = cssH + 'px';
}

function screenToWorld(clientX, clientY) {
  const scale = viewScale(cssW);
  return {
    x: cam.x + (clientX - cssW / 2) / scale,
    y: cam.y + (clientY - cssH / 2) / scale,
  };
}

const paused = () => state.treeOpen || state.won || state.cardOpen;

el.cv.addEventListener('pointerdown', (e) => {
  if (paused()) return;
  el.cv.setPointerCapture(e.pointerId);
  const isLeftHalf = e.clientX < cssW / 2;
  if (isLeftHalf) {
    joystickL.id = e.pointerId; joystickL.active = true;
    joystickL.cx = cssW / 4; joystickL.cy = cssH - JOYSTICK_RADIUS - 30;
    joystickL.x = e.clientX; joystickL.y = e.clientY;
  } else {
    joystickR.id = e.pointerId; joystickR.active = true;
    joystickR.cx = cssW * 3 / 4; joystickR.cy = cssH - JOYSTICK_RADIUS - 30;
    joystickR.x = e.clientX; joystickR.y = e.clientY;
    aim.active = true; aim.sx = e.clientX; aim.sy = e.clientY; aim.power = 0;
  }
});

el.cv.addEventListener('pointermove', (e) => {
  if (e.pointerId === joystickL.id && joystickL.active) {
    joystickL.x = e.clientX; joystickL.y = e.clientY;
    const dx = e.clientX - joystickL.cx, dy = e.clientY - joystickL.cy;
    const dist = Math.hypot(dx, dy);
    if (dist > JOYSTICK_DEADZONE) {
      const angle = Math.atan2(dy, dx);
      const clamped = Math.min(dist, JOYSTICK_RADIUS);
      player.vx = Math.cos(angle) * (clamped / JOYSTICK_RADIUS) * JOYSTICK_MOVE_SPEED;
      player.vy = Math.sin(angle) * (clamped / JOYSTICK_RADIUS) * JOYSTICK_MOVE_SPEED;
    } else {
      player.vx = 0; player.vy = 0;
    }
  } else if (e.pointerId === joystickR.id && joystickR.active) {
    joystickR.x = e.clientX; joystickR.y = e.clientY;
    const dx = aim.sx - e.clientX, dy = aim.sy - e.clientY;
    const len = Math.hypot(dx, dy);
    if (len > 4) {
      aim.angle = Math.atan2(dy, dx);
      aim.power = Math.min(1, len / MAX_PULL);
    }
  }
});

function endPointer(e) {
  if (e.pointerId === joystickL.id) {
    joystickL.active = false; joystickL.id = -1;
    player.vx = 0; player.vy = 0;
  } else if (e.pointerId === joystickR.id) {
    joystickR.active = false; joystickR.id = -1;
    aim.active = false;
    if (!world || aim.power <= 0.06 || reload > 0) return;
    balls.push(...spawnVolley(player.x, player.y, aim.angle, aim.power, state.activeBall, stats));
    reload = stats.reload;
    buzz(20);
    if (!firedOnce) { firedOnce = true; el.help.classList.add('gone'); }
  }
}
el.cv.addEventListener('pointerup', endPointer);
el.cv.addEventListener('pointercancel', endPointer);

// Tech tree panning. Capture is taken lazily, only once the gesture is clearly
// a drag — grabbing it on pointerdown retargets the event and taps on nodes
// never reach their click handler.
el.treeView.addEventListener('pointerdown', (e) => {
  pan.dragging = true; pan.id = e.pointerId; pan.moved = 0;
  pan.sx = e.clientX; pan.sy = e.clientY; pan.ox = pan.x; pan.oy = pan.y;
});
el.treeView.addEventListener('pointermove', (e) => {
  if (!pan.dragging || e.pointerId !== pan.id) return;
  const dx = e.clientX - pan.sx, dy = e.clientY - pan.sy;
  pan.moved = Math.max(pan.moved, Math.hypot(dx, dy));
  if (pan.moved > 4) {
    if (!el.treeView.hasPointerCapture(e.pointerId)) el.treeView.setPointerCapture(e.pointerId);
    pan.x = pan.ox + dx;
    pan.y = pan.oy + dy;
    applyPan();
  }
});
const endPan = (e) => {
  if (e.pointerId !== pan.id) return;
  pan.dragging = false; pan.id = -1;
};
el.treeView.addEventListener('pointerup', endPan);
el.treeView.addEventListener('pointercancel', endPan);

/* ── Buttons ─────────────────────────────────────────────────────────────── */

el.techBtn.addEventListener('click', () => {
  state.treeOpen = true;
  el.tree.classList.add('open');
  centreTree();
  syncTree();
  refreshAccent();
});
el.treeClose.addEventListener('click', () => {
  state.treeOpen = false;
  el.tree.classList.remove('open');
  hoverAccent = null;
  refreshAccent();
  save();
});
el.dBtn.addEventListener('click', unlockSelected);

el.card.addEventListener('click', () => {
  state.cardOpen = false;
  el.card.classList.remove('open');
});

el.winBtn.addEventListener('click', newRun);

el.vibBtn.addEventListener('click', () => {
  if (!VIB_SUPPORTED) {
    banner('THIS BROWSER CANNOT VIBRATE', 2.4, 1);
    return;
  }
  state.vibeOn = !state.vibeOn;
  el.vibBtn.textContent = state.vibeOn ? 'VIB' : 'VIB✕';
  el.vibBtn.classList.toggle('mute', !state.vibeOn);
  if (state.vibeOn) buzz([14, 60, 14]);
  save();
});

el.mapBtn.addEventListener('click', () => {
  state.mapOn = !state.mapOn;
  el.miniWrap.classList.toggle('off', !state.mapOn);
  el.mapBtn.classList.toggle('mute', !state.mapOn);
  save();
});

window.addEventListener('resize', resize);
window.addEventListener('orientationchange', resize);
window.addEventListener('visibilitychange', save);
window.addEventListener('pagehide', save);
setInterval(save, 15000);

/* ── Minimap ─────────────────────────────────────────────────────────────── */

const miniImg = mctx.createImageData(GRID_W, GRID_H);

function drawMini() {
  const d = miniImg.data;
  for (let i = 0; i < CELLS; i++) {
    const o = i * 4;
    if (!world.seen[i]) {
      // Undiscovered. The ring the golden block can sit in gets the faintest
      // possible hint, so the map tells you how far to dig without telling you
      // which block it is.
      const dist = distFromSpawn(i % GRID_W, (i / GRID_W) | 0);
      const band = dist >= GOLDEN_DIST_MIN && dist <= GOLDEN_DIST_MAX;
      d[o] = band ? 22 : 6;
      d[o + 1] = band ? 18 : 14;
      d[o + 2] = band ? 5 : 9;
      d[o + 3] = 255;
      continue;
    }
    const kind = world.kind[i];
    if (world.hp[i] <= 0) {
      d[o] = 14; d[o + 1] = 40; d[o + 2] = 22; d[o + 3] = 255;   // carved out
    } else if (kind === KIND_BEDROCK) {
      d[o] = 26; d[o + 1] = 32; d[o + 2] = 34; d[o + 3] = 255;
    } else if (kind === KIND_TOKEN) {
      d[o] = 255; d[o + 1] = 255; d[o + 2] = 255; d[o + 3] = 255;
    } else if (kind === KIND_GOLDEN) {
      d[o] = 255; d[o + 1] = 210; d[o + 2] = 61; d[o + 3] = 255;
    } else {
      // `hue` indexes BLOCKS, not TIERS — the two tables are different lengths.
      const c = BLOCK_RGB[world.hue[i]];
      d[o] = c.r * 0.75; d[o + 1] = c.g * 0.75; d[o + 2] = c.b * 0.75; d[o + 3] = 255;
    }
  }
  mctx.putImageData(miniImg, 0, 0);

  // Player triangle, pointing wherever the next shot goes.
  const px = player.col + 0.5, py = player.row + 0.5;
  mctx.save();
  mctx.translate(px, py);
  mctx.rotate(aim.angle);
  mctx.fillStyle = accentRgba(1);
  mctx.beginPath();
  mctx.moveTo(4.5, 0);
  mctx.lineTo(-3, -3.2);
  mctx.lineTo(-3, 3.2);
  mctx.closePath();
  mctx.fill();
  mctx.restore();

  // Golden block, once you have laid eyes on it.
  if (world.goldenSighted && world.goldenIdx >= 0 && world.hp[world.goldenIdx] > 0) {
    const gc = world.goldenIdx % GRID_W;
    const gr = (world.goldenIdx / GRID_W) | 0;
    mctx.fillStyle = '#ffd23d';
    mctx.fillRect(gc - 1.5, gr - 1.5, 3, 3);
  }
}

/* ── Update ──────────────────────────────────────────────────────────────── */

function update(dt, now) {
  const fx = newEffects();
  dmg.stats = stats;
  dmg.fx = fx;

  if (player.vx !== 0 || player.vy !== 0) {
    const moveDir = Math.atan2(player.vy, player.vx);
    const dx = Math.cos(moveDir), dy = Math.sin(moveDir);
    let tryCol = player.col, tryRow = player.row;
    if (Math.abs(dx) > Math.abs(dy)) {
      tryCol += dx > 0 ? 1 : -1;
    } else {
      tryRow += dy > 0 ? 1 : -1;
    }
    if (tryCol >= 0 && tryCol < GRID_W && tryRow >= 0 && tryRow < GRID_H) {
      const i = tryRow * GRID_W + tryCol;
      if (world.hp[i] <= 0) {
        player.col = tryCol; player.row = tryRow;
        player.x = (tryCol + 0.5) * CELL;
        player.y = (tryRow + 0.5) * CELL;
        reach = Math.max(reach, distFromSpawn(tryCol, tryRow));
        miniDirty = true;
      }
    }
  }

  const alive = [];
  for (const b of balls) {
    dmg.ballLuck = BALLS[b.type].luckMul;
    dmg.ballReveal = BALLS[b.type].revealBonus;
    stepBall(world, b, dt, dmg);
    reach = Math.max(reach, distFromSpawn(b.x / CELL, b.y / CELL));
    if (!b.dead) alive.push(b);
  }
  balls = alive;

  dmg.ballLuck = 1;
  dmg.ballReveal = 0;
  tickPoison(world, dt, dmg);

  if (reload > 0) reload = Math.max(0, reload - dt);

  if (fx.particles.length) particles.push(...fx.particles);
  if (fx.arcs.length) arcs.push(...fx.arcs);
  if (fx.texts.length) texts.push(...fx.texts);
  for (const f of fx.blockFx) {
    f.life = f.kind === 'hit' ? FX_HIT_LIFE : FX_BREAK_LIFE;
    blockFx.push(f);
  }
  if (fx.shake > shake) shake = Math.min(30, fx.shake);
  if (fx.brokenCount) { broken += fx.brokenCount; miniDirty = true; }
  if (fx.tokensGained) { state.tokens += fx.tokensGained; miniDirty = true; }

  // One vibration per frame at most, rate limited so it reads as texture.
  if (fx.haptic > 0) {
    const gap = fx.haptic === 1 ? 55 : fx.haptic === 2 ? 40 : 0;
    if (now - lastVib >= gap) {
      lastVib = now;
      if (fx.haptic === 1) buzz(8);
      else if (fx.haptic === 2) buzz(18);
      else if (fx.haptic === 3) buzz([10, 26, 12]);
      else buzz([40, 60, 40, 60, 120]);
    }
  }

  // First sighting of the golden block — loud, and it hands you the compass.
  if (!world.goldenSighted && world.goldenIdx >= 0
      && world.hp[world.goldenIdx] > 0 && world.seen[world.goldenIdx]) {
    world.goldenSighted = true;
    banner('GOLDEN BLOCK SIGHTED', 3.6, 2);
    buzz([30, 60, 30, 60, 30]);
    miniDirty = true;
    save();
  }

  if (fx.goldenBroken && !state.won) {
    state.won = true;
    el.winSub.textContent =
      `${broken.toLocaleString()} blocks broken · ${Math.round(reach)} blocks out · ◆${state.tokens} left over`;
    el.win.classList.add('open');
    save();
  }

  const distMilestone = Math.floor(reach / 20) * 20;
  if (distMilestone > maxTier && distMilestone > 0) {
    maxTier = distMilestone;
    banner(`${distMilestone}M — DEEPER IN`, 2.6);
    buzz([20, 40, 20]);
  }

  for (let i = blockFx.length - 1; i >= 0; i--) {
    blockFx[i].life -= dt;
    if (blockFx[i].life <= 0) blockFx.splice(i, 1);
  }
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= 0.92; p.vy *= 0.92;
  }
  for (let i = arcs.length - 1; i >= 0; i--) {
    arcs[i].life -= dt;
    if (arcs[i].life <= 0) arcs.splice(i, 1);
  }
  for (let i = texts.length - 1; i >= 0; i--) {
    texts[i].life -= dt;
    texts[i].y -= 18 * dt;
    if (texts[i].life <= 0) texts.splice(i, 1);
  }

  shake *= Math.pow(0.0015, dt);
  if (shake < 0.15) shake = 0;

  // Camera rides the ball swarm while it flies, else the player.
  let tx = player.x, ty = player.y;
  if (balls.length) {
    let sx = 0, sy = 0;
    for (const b of balls) { sx += b.x; sy += b.y; }
    tx = sx / balls.length; ty = sy / balls.length;
  }
  const k = 1 - Math.exp(-7 * dt);
  cam.x += (tx - cam.x) * k;
  cam.y += (ty - cam.y) * k;

  const scale = viewScale(cssW);
  const halfW = cssW / 2 / scale, halfH = cssH / 2 / scale;
  cam.x = halfW * 2 >= WORLD_W ? WORLD_W / 2 : Math.min(Math.max(cam.x, halfW), WORLD_W - halfW);
  cam.y = halfH * 2 >= WORLD_H ? WORLD_H / 2 : Math.min(Math.max(cam.y, halfH), WORLD_H - halfH);
}

/* ── Draw ────────────────────────────────────────────────────────────────── */

function drawBolt(c, x1, y1, x2, y2) {
  const segs = 6;
  const dx = (x2 - x1) / segs, dy = (y2 - y1) / segs;
  const nx = -(y2 - y1), ny = x2 - x1;
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

function renderJoysticks(c) {
  c.save();
  c.globalCompositeOperation = 'lighter';
  c.fillStyle = 'rgba(255,255,255,0.15)';
  c.strokeStyle = accentRgba(0.3);
  c.lineWidth = 2;

  if (joystickL.active) {
    c.beginPath();
    c.arc(joystickL.cx, joystickL.cy, JOYSTICK_RADIUS, 0, Math.PI * 2);
    c.fill();
    c.stroke();

    const dx = joystickL.x - joystickL.cx;
    const dy = joystickL.y - joystickL.cy;
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(dist, JOYSTICK_RADIUS);
    const thumbCx = joystickL.cx + (dx / Math.max(dist, 0.1)) * clamped;
    const thumbCy = joystickL.cy + (dy / Math.max(dist, 0.1)) * clamped;
    c.fillStyle = accentRgba(0.6);
    c.beginPath();
    c.arc(thumbCx, thumbCy, 20, 0, Math.PI * 2);
    c.fill();
  }

  if (joystickR.active) {
    c.fillStyle = 'rgba(255,255,255,0.15)';
    c.strokeStyle = accentRgba(0.3);
    c.beginPath();
    c.arc(joystickR.cx, joystickR.cy, JOYSTICK_RADIUS, 0, Math.PI * 2);
    c.fill();
    c.stroke();

    const dx = joystickR.x - joystickR.cx;
    const dy = joystickR.y - joystickR.cy;
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(dist, JOYSTICK_RADIUS);
    const thumbCx = joystickR.cx + (dx / Math.max(dist, 0.1)) * clamped;
    const thumbCy = joystickR.cy + (dy / Math.max(dist, 0.1)) * clamped;
    c.fillStyle = accentRgba(0.6);
    c.beginPath();
    c.arc(thumbCx, thumbCy, 20, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
}

function draw(now) {
  const c = ctx;
  const scale = viewScale(cssW);
  const halfW = cssW / 2 / scale, halfH = cssH / 2 / scale;
  const jx = shake > 0 ? (Math.random() - 0.5) * shake : 0;
  const jy = shake > 0 ? (Math.random() - 0.5) * shake : 0;

  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.imageSmoothingEnabled = false;
  c.fillStyle = PALETTE.unseen;
  c.fillRect(0, 0, cssW, cssH);

  c.save();
  c.translate(cssW / 2, cssH / 2);
  c.scale(scale, scale);
  c.translate(-cam.x + jx, -cam.y + jy);

  const c0 = Math.max(0, Math.floor((cam.x - halfW) / CELL) - 1);
  const c1 = Math.min(GRID_W - 1, Math.ceil((cam.x + halfW) / CELL) + 1);
  const r0 = Math.max(0, Math.floor((cam.y - halfH) / CELL) - 1);
  const r1 = Math.min(GRID_H - 1, Math.ceil((cam.y + halfH) / CELL) + 1);
  const pulse = 0.55 + 0.45 * Math.sin(now / 260);

  // Balls and the player carry their own light, so a shot lights its own way
  // through unlit rock. Collected fresh each frame — these are not baked in.
  const moving = [];
  for (const b of balls) {
    moving.push({
      col: Math.floor(b.x / CELL), row: Math.floor(b.y / CELL),
      rgb: ballLightRgb(b.type), power: 3.2,
    });
  }
  moving.push({ col: player.col, row: player.row, rgb: PLAYER_LIGHT, power: 2.4 });

  buildLight(lightMap, world, c0, c1, r0, r1, moving);
  renderBlocks(c, world, lightMap, c0, c1, r0, r1, pulse);
  renderGlow(c, world, lightMap, c0, c1, r0, r1, 0.30);

  // The golden block is the strongest lamp on the map, so the light map
  // already bleeds it through rock. This is the shine on top of that.
  if (world.goldenIdx >= 0 && world.hp[world.goldenIdx] > 0) {
    const gx = ((world.goldenIdx % GRID_W) + 0.5) * CELL;
    const gy = (((world.goldenIdx / GRID_W) | 0) + 0.5) * CELL;
    const dist = Math.hypot(gx - cam.x, gy - cam.y) / CELL;
    if (dist < GOLDEN_AURA * 2.4) {
      renderGoldenShine(c, gx, gy, now, Math.max(0, 1 - dist / (GOLDEN_AURA * 2.4)));
    }
  }

  renderBlockFx(c, blockFx);
  renderArcs(c, arcs, drawBolt);
  renderParticles(c, particles);
  renderBalls(c, balls);

  if (aim.active && aim.power > 0.06) {
    renderAim(c, player.x, player.y, aim.angle, aim.power, reload <= 0, accentRgba(1));
  }
  const displayAngle = (player.vx !== 0 || player.vy !== 0) ? Math.atan2(player.vy, player.vx) : aim.angle;
  renderPlayer(c, player.x, player.y, displayAngle, accentRgba(1));

  c.font = '600 9px monospace';
  c.textAlign = 'center';
  for (const t of texts) {
    c.globalAlpha = Math.min(1, t.life);
    c.fillStyle = t.color;
    c.fillText(t.text, t.x, t.y);
  }
  c.globalAlpha = 1;
  c.restore();

  renderJoysticks(c);
}

/* ── Loop ────────────────────────────────────────────────────────────────── */

let last = performance.now();
let hudTimer = 0;

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!world) return;

  stepAccent(dt);
  if (!paused()) update(dt, now);
  draw(now);

  hudTimer += dt;
  if (hudTimer > 0.1) { hudTimer = 0; syncHud(); }

  miniTimer += dt;
  if (state.mapOn && (miniDirty || miniTimer > 0.2)) {
    miniDirty = false;
    miniTimer = 0;
    drawMini();
  }

  if (bannerTimer > 0) {
    bannerTimer -= dt;
    if (bannerTimer <= 0) { el.banner.classList.remove('show'); bannerRank = 0; }
  }
}

/* ── Boot ────────────────────────────────────────────────────────────────── */

resize();
load();
buildTree();
buildChips();
syncTree();
syncHud(true);
refreshAccent();
el.vibBtn.textContent = state.vibeOn ? 'VIB' : 'VIB✕';
el.vibBtn.classList.toggle('mute', !state.vibeOn);
el.miniWrap.classList.toggle('off', !state.mapOn);
el.mapBtn.classList.toggle('mute', !state.mapOn);
requestAnimationFrame(frame);
