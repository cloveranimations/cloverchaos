/*
 * BlindShot — presentation layer: canvas render, minimap, tech tree, haptics.
 * Everything simulation-shaped lives in game.js.
 */
'use strict';

const SAVE_KEY = 'blindshot.save.v3';
const WORLD_W = GRID_W * CELL;
const WORLD_H = GRID_H * CELL;
const MAX_PULL = 120;

const $ = (id) => document.getElementById(id);
const el = {
  cv: $('cv'), mini: $('mini'), miniWrap: $('miniWrap'),
  depth: $('depth'), lvl: $('lvl'), tier: $('tier'), tokens: $('tokens'),
  vibBtn: $('vibBtn'), mapBtn: $('mapBtn'), techBtn: $('techBtn'),
  compass: $('compass'), compassTxt: $('compassTxt'), banner: $('banner'), help: $('help'),
  cdFill: $('cdFill'), cdText: $('cdText'), chips: $('chips'),
  tree: $('tree'), treeView: $('treeView'), treePan: $('treePan'), treeSvg: $('treeSvg'),
  treeTokens: $('treeTokens'), treeClose: $('treeClose'),
  dNm: $('dNm'), dDs: $('dDs'), dBtn: $('dBtn'),
  card: $('card'), cardName: $('cardName'), cardDesc: $('cardDesc'),
  win: $('win'), winSub: $('winSub'), winBtn: $('winBtn'),
};

const ctx = el.cv.getContext('2d', { alpha: false });
const mctx = el.mini.getContext('2d');

/* ── Colour helpers ──────────────────────────────────────────────────────── */

function hexToRgb(hex) {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}
function shadeHex(hex, mul) {
  const c = hexToRgb(hex);
  return `rgb(${Math.min(255, Math.round(c.r * mul))},${Math.min(255, Math.round(c.g * mul))},${Math.min(255, Math.round(c.b * mul))})`;
}
const COLOR_TABLE = TIERS.map((t) => Array.from({ length: 8 }, (_, k) => shadeHex(t.color, 0.74 + k * 0.075)));
const TIER_RGB = TIERS.map((t) => hexToRgb(t.color));

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
const player = { col: START_COL, row: START_ROW, x: 0, y: 0 };
const cam = { x: 0, y: 0 };
const aim = { active: false, sx: 0, sy: 0, angle: Math.PI / 2, power: 0 };
const ptr = { id: -1, t0: 0, moved: 0 };
let particles = [], arcs = [], texts = [];
let reload = 0, shake = 0;
let deepest = START_ROW, broken = 0, maxTier = 0;
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
      v: 3,
      seed: world.seed,
      tokens: state.tokens,
      unlocked: Array.from(state.unlocked),
      ball: state.activeBall,
      col: player.col, row: player.row,
      deepest, broken,
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
    deepest = data.deepest; broken = data.broken;
    maxTier = tierOfRow(data.deepest);
    w.goldenSighted = !!data.sighted;
  } else {
    player.col = w.spawnCol; player.row = w.spawnRow;
    deepest = w.spawnRow; broken = 0; maxTier = 0;
  }
  player.x = (player.col + 0.5) * CELL;
  player.y = (player.row + 0.5) * CELL;
  cam.x = player.x; cam.y = player.y;
  balls = []; particles = []; arcs = []; texts = [];
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
      if (p && p.v === 3 && Array.isArray(p.hp) && Array.isArray(p.seen)) data = p;
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

/* ── Layer system (distance-based visibility) ───────────────────────────── */

/**
 * Calculate visibility based on distance from spawn.
 * Layer 0 (0-15): fully visible
 * Layer 1 (15-30): dimmed
 * Layer 2 (30-45): darker
 * Layer 3+ (45+): very dark / black
 */
function getLayerVisibility(col, row) {
  if (!world) return 1;
  const spawnCol = world.spawnCol || 50;
  const spawnRow = world.spawnRow || 6;
  const dist = Math.hypot(col - spawnCol, row - spawnRow);

  if (dist < 15) return 1;      // Layer 0: fully visible
  if (dist < 30) return 0.6;    // Layer 1: dim
  if (dist < 45) return 0.35;   // Layer 2: darker
  return 0.08;                  // Layer 3+: almost black but slightly visible
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
  el.depth.textContent = deepest;
  const t = tierOfRow(player.row);
  el.lvl.textContent = t + 1;
  el.tier.textContent = TIERS[t].name.toUpperCase();
  el.tier.style.color = TIERS[t].color;
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
      line.setAttribute('stroke-width', '2');
      line.setAttribute('opacity', '.3');
      line.dataset.edge = n.id;
      el.treeSvg.appendChild(line);
    }
  }

  el.treePan.textContent = '';
  el.treePan.style.width = W + 'px';
  el.treePan.style.height = H + 'px';
  for (const n of TECH) {
    const color = PALETTE.branch[n.branch];
    const b = document.createElement('button');
    b.className = 'node ' + n.shape;
    b.style.left = px(n) + 'px';
    b.style.top = py(n) + 'px';
    b.style.color = color;
    b.style.borderColor = color;
    b.style.border = '2px solid ' + color;
    b.title = n.name;
    b.innerHTML =
      `<svg width="22" height="22" viewBox="0 0 20 20" fill="currentColor" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round">${ICONS[n.icon]}</svg>` +
      (n.cost > 0 ? `<span class="cost">${n.cost}</span>` : '');
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

function syncTree() {
  for (const n of TECH) {
    const b = nodeEls[n.id];
    if (!b) continue;
    const owned = state.unlocked.has(n.id);
    const ready = n.requires.every((r) => state.unlocked.has(r));
    b.classList.toggle('owned', owned);
    b.classList.toggle('locked', !owned && !ready);
    b.classList.toggle('short', !owned && ready && state.tokens < n.cost);
    b.classList.toggle('sel', selectedNodeId === n.id);
    b.style.boxShadow = owned ? `0 0 16px -2px ${PALETTE.branch[n.branch]}` : 'none';
    const tick = b.querySelector('.tick');
    if (owned && !tick) {
      const s = document.createElement('span');
      s.className = 'tick';
      s.textContent = '✔';
      b.appendChild(s);
    } else if (!owned && tick) {
      tick.remove();
    }
  }
  for (const line of Array.from(el.treeSvg.children)) {
    line.setAttribute('opacity', state.unlocked.has(line.dataset.edge) ? '.85' : '.3');
  }

  const n = TECH_BY_ID[selectedNodeId] || TECH[0];
  el.dNm.textContent = n.name;
  el.dDs.textContent = n.desc;
  el.treeTokens.textContent = '◆ ' + state.tokens;

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
  ptr.id = e.pointerId; ptr.t0 = performance.now(); ptr.moved = 0;
  aim.active = true; aim.sx = e.clientX; aim.sy = e.clientY; aim.power = 0;
});

el.cv.addEventListener('pointermove', (e) => {
  if (!aim.active || e.pointerId !== ptr.id) return;
  // Slingshot: drag away from the target, the ball flies the other way.
  const dx = aim.sx - e.clientX;
  const dy = aim.sy - e.clientY;
  const len = Math.hypot(dx, dy);
  ptr.moved = Math.max(ptr.moved, len);
  if (len > 4) {
    aim.angle = Math.atan2(dy, dx);
    aim.power = Math.min(1, len / MAX_PULL);
  }
});

function endPointer(e) {
  if (!aim.active || e.pointerId !== ptr.id) return;
  aim.active = false;
  const held = performance.now() - ptr.t0;
  const moved = ptr.moved;
  ptr.id = -1;
  if (!world) return;

  if (moved < 14 && held < 320) {
    const p = screenToWorld(e.clientX, e.clientY);
    const target = walkToward(world, player.col, player.row, Math.floor(p.x / CELL), Math.floor(p.y / CELL));
    if (target) {
      player.col = target.col; player.row = target.row;
      player.x = (target.col + 0.5) * CELL;
      player.y = (target.row + 0.5) * CELL;
      if (target.row > deepest) deepest = target.row;
      buzz(6);
      miniDirty = true;
    }
    return;
  }

  if (aim.power > 0.06 && reload <= 0) {
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
  const goldRow0 = GOLDEN_ROW_MIN, goldRow1 = GOLDEN_ROW_MAX;
  for (let i = 0; i < CELLS; i++) {
    const o = i * 4;
    const row = (i / GRID_W) | 0;
    if (!world.seen[i]) {
      // Undiscovered. The golden band gets the faintest possible hint so the
      // map tells you where to dig without telling you which block it is.
      const band = row >= goldRow0 && row <= goldRow1;
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
      const c = TIER_RGB[world.hue[i]];
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

  const alive = [];
  for (const b of balls) {
    dmg.ballLuck = BALLS[b.type].luckMul;
    dmg.ballReveal = BALLS[b.type].revealBonus;
    stepBall(world, b, dt, dmg);
    const row = Math.floor(b.y / CELL);
    if (row > deepest) deepest = row;
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
      `${broken.toLocaleString()} blocks broken · ${deepest}m deep · ◆${state.tokens} left over`;
    el.win.classList.add('open');
    save();
  }

  const tier = tierOfRow(deepest);
  if (tier > maxTier) {
    maxTier = tier;
    banner(`LEVEL ${tier + 1} — ${TIERS[tier].name.toUpperCase()}`, 2.6);
    buzz([20, 40, 20]);
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

function draw(now) {
  const c = ctx;
  const scale = viewScale(cssW);
  const halfW = cssW / 2 / scale, halfH = cssH / 2 / scale;
  const jx = shake > 0 ? (Math.random() - 0.5) * shake : 0;
  const jy = shake > 0 ? (Math.random() - 0.5) * shake : 0;

  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.imageSmoothingEnabled = false;
  c.fillStyle = PALETTE.bg;
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

  for (let row = r0; row <= r1; row++) {
    for (let col = c0; col <= c1; col++) {
      const i = idx(col, row);
      const x = col * CELL, y = row * CELL;

      if (!world.seen[i]) {
        c.fillStyle = PALETTE.unseen;
        c.fillRect(x, y, CELL, CELL);
        continue;
      }
      const hp = world.hp[i];
      if (hp <= 0) continue; // carved out — background shows through
      const kind = world.kind[i];

      const layerVis = getLayerVisibility(col, row);

      if (kind === KIND_GOLDEN) {
        c.save();
        c.shadowColor = PALETTE.golden;
        c.shadowBlur = 30 + 16 * pulse;
        c.fillStyle = PALETTE.golden;
        c.globalAlpha = layerVis;
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
        c.globalAlpha = layerVis;
        c.fillRect(x, y, CELL, CELL);
        c.restore();
        const td = 1 - hp / Math.max(1, world.maxHp[i]);
        if (td > 0.02) {
          c.fillStyle = `rgba(0,0,0,${td * 0.5})`;
          c.globalAlpha = layerVis;
          c.fillRect(x, y, CELL, CELL);
        }
        continue;
      }

      if (kind === KIND_BEDROCK) {
        c.fillStyle = '#12181a';
        c.globalAlpha = layerVis;
        c.fillRect(x, y, CELL, CELL);
        c.fillStyle = '#1c2427';
        c.fillRect(x + 2, y + 2, CELL - 4, CELL - 4);
        c.globalAlpha = 1;
        continue;
      }

      c.fillStyle = COLOR_TABLE[world.hue[i]][world.shade[i] >> 5];
      c.globalAlpha = layerVis;
      c.fillRect(x, y, CELL, CELL);
      c.globalAlpha = 1;

      const d = 1 - hp / Math.max(1, world.maxHp[i]);
      if (d > 0.02) {
        c.fillStyle = `rgba(0,0,0,${d * 0.62})`;
        c.globalAlpha = layerVis;
        c.fillRect(x, y, CELL, CELL);
        c.globalAlpha = 1;
        if (d > 0.45) {
          c.strokeStyle = 'rgba(0,0,0,.55)';
          c.lineWidth = 1.4;
          c.globalAlpha = layerVis;
          c.beginPath();
          c.moveTo(x + 3, y + CELL - 4);
          c.lineTo(x + CELL * 0.5, y + CELL * 0.45);
          c.lineTo(x + CELL - 3, y + 4);
          c.stroke();
          c.globalAlpha = 1;
        }
      }
      if (world.poisonT[i] > 0) {
        c.fillStyle = `rgba(61,220,97,${0.18 + 0.16 * pulse})`;
        c.globalAlpha = layerVis;
        c.fillRect(x, y, CELL, CELL);
        c.globalAlpha = 1;
      }
    }
  }

  // The golden block bleeds light through solid rock once you are close. This
  // is the "hot / cold" signal — without it the last twenty rows are a
  // featureless grind and the prize is pure luck.
  if (world.goldenIdx >= 0 && world.hp[world.goldenIdx] > 0) {
    const gx = ((world.goldenIdx % GRID_W) + 0.5) * CELL;
    const gy = (((world.goldenIdx / GRID_W) | 0) + 0.5) * CELL;
    const dist = Math.hypot(gx - cam.x, gy - cam.y) / CELL;
    if (dist < GOLDEN_AURA * 2.4) {
      const strength = Math.max(0, 1 - dist / (GOLDEN_AURA * 2.4));
      const rad = GOLDEN_AURA * CELL;
      const g = c.createRadialGradient(gx, gy, 0, gx, gy, rad);
      g.addColorStop(0, `rgba(255,210,61,${0.5 * strength * (0.7 + 0.3 * pulse)})`);
      g.addColorStop(1, 'rgba(255,210,61,0)');
      c.save();
      c.globalCompositeOperation = 'lighter';
      c.fillStyle = g;
      c.fillRect(gx - rad, gy - rad, rad * 2, rad * 2);
      c.restore();
    }
  }

  if (arcs.length) {
    c.save();
    c.strokeStyle = '#f7ef7a';
    c.shadowColor = '#f4e04d';
    c.shadowBlur = 10;
    c.lineWidth = 1.6;
    for (const a of arcs) {
      c.globalAlpha = Math.min(1, a.life / 0.22);
      drawBolt(c, a.x1, a.y1, a.x2, a.y2);
    }
    c.restore();
  }

  for (const p of particles) {
    c.globalAlpha = Math.max(0, p.life / p.max);
    c.fillStyle = p.color;
    c.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
  }
  c.globalAlpha = 1;

  for (const b of balls) {
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

  // Aim preview.
  if (aim.active && aim.power > 0.06) {
    const loaded = reload <= 0;
    c.fillStyle = loaded ? accentRgba(1) : 'rgba(255,255,255,.35)';
    const dots = Math.round(6 + aim.power * 12);
    for (let i = 1; i <= dots; i++) {
      const d = 10 + i * 9;
      c.globalAlpha = loaded ? 1 - i / (dots + 3) : 0.3;
      c.fillRect(player.x + Math.cos(aim.angle) * d - 1, player.y + Math.sin(aim.angle) * d - 1, 2, 2);
    }
    c.globalAlpha = 1;
  }

  // Player: a triangle pointing wherever the next shot goes.
  c.save();
  c.translate(player.x, player.y);
  c.rotate(aim.angle);
  c.strokeStyle = accentRgba(1);
  c.lineWidth = 1.7;
  c.shadowColor = accentRgba(0.9);
  c.shadowBlur = 9;
  c.beginPath();
  c.moveTo(6.5, 0);
  c.lineTo(-4.5, -5.2);
  c.lineTo(-4.5, 5.2);
  c.closePath();
  c.stroke();
  c.restore();

  c.font = '600 9px monospace';
  c.textAlign = 'center';
  for (const t of texts) {
    c.globalAlpha = Math.min(1, t.life);
    c.fillStyle = t.color;
    c.fillText(t.text, t.x, t.y);
  }
  c.globalAlpha = 1;
  c.restore();
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
