/*
 * BlindShot — canvas rendering.
 *
 * The only file that knows what a pixel is. Everything it draws is derived
 * from the light map that engine.js builds, so the rule is simple: a block's
 * on-screen colour is its own colour multiplied by the light reaching it, and
 * unlit rock is genuinely invisible rather than merely dark.
 *
 * When this ports to Roblox, this file is the one that gets thrown away and
 * rewritten against the engine's draw API — config.js and engine.js carry over
 * unchanged.
 */
'use strict';

/* ── Colour helpers ──────────────────────────────────────────────────────── */

function hexToRgb(hex) {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

/** Flat per-block base colours. Light does all the shading. */
const TIER_RGB = TIERS.map((t) => hexToRgb(t.color));
const RGB_TOKEN = hexToRgb(BLOCK_TOKEN.color);
const RGB_GOLDEN = hexToRgb(BLOCK_GOLDEN.color);
const RGB_BEDROCK = hexToRgb(BLOCK_BEDROCK.color);
const RGB_BG = hexToRgb(PALETTE.bg);
const RGB_VOID = hexToRgb(PALETTE.unseen);

/* ── Light overlay ───────────────────────────────────────────────────────────
 * The light map is drawn a second time as a smoothed, additive layer. That is
 * what makes light spill past a block's hard edge into open air — the blocks
 * stay crisply pixelated, the glow around them does not.
 */
function makeBuffer() {
  const cv = document.createElement('canvas');
  const cx = cv.getContext('2d', { willReadFrequently: false });
  let img = null;
  return {
    cv, cx,
    /** Resizes on demand and hands back the ImageData to write into. */
    fit(w, h) {
      if (cv.width !== w || cv.height !== h) {
        cv.width = w; cv.height = h;
        img = cx.createImageData(w, h);
      }
      return img;
    },
    flush() { cx.putImageData(img, 0, 0); },
  };
}

/**
 * Both passes render one pixel per cell and let drawImage do the scaling.
 * Painting 1500-odd cells with fillStyle/fillRect costs a string allocation
 * each and halves the frame rate; a pixel buffer is one blit.
 */
const blockBuf = makeBuffer();
const lightBuf = makeBuffer();

/* ── World ───────────────────────────────────────────────────────────────── */

/**
 * Draws the block grid. Expects `c` to already be in world space.
 * `lm` is the light map, already built for this window.
 */
function renderBlocks(c, w, lm, c0, c1, r0, r1, pulse) {
  const bw = c1 - c0 + 1, bh = r1 - r0 + 1;
  if (bw <= 0 || bh <= 0) return;
  const d = blockBuf.fit(bw, bh).data;

  for (let row = r0; row <= r1; row++) {
    const base = row * GRID_W;
    let o = (row - r0) * bw * 4;
    for (let col = c0; col <= c1; col++, o += 4) {
      const i = base + col;
      d[o + 3] = 255;

      if (!w.seen[i]) {
        d[o] = RGB_VOID.r; d[o + 1] = RGB_VOID.g; d[o + 2] = RGB_VOID.b;
        continue;
      }

      // Light is unbounded on purpose — a lamp cell can read as blown-out
      // white — so clamp only at the point of use.
      const lr = lm.r[i] > 1 ? 1 : lm.r[i];
      const lg = lm.g[i] > 1 ? 1 : lm.g[i];
      const lb = lm.b[i] > 1 ? 1 : lm.b[i];

      const hp = w.hp[i];
      if (hp <= 0) {
        // Carved-out air: the room tint, lit. Deliberately much dimmer than
        // rock at the same light level — a mined-out pocket should read as a
        // hole you can see into, not as a lit surface.
        const AIR = 0.45;
        d[o] = RGB_VOID.r + (RGB_BG.r - RGB_VOID.r) * lr * AIR;
        d[o + 1] = RGB_VOID.g + (RGB_BG.g - RGB_VOID.g) * lg * AIR;
        d[o + 2] = RGB_VOID.b + (RGB_BG.b - RGB_VOID.b) * lb * AIR;
        continue;
      }

      const kind = w.kind[i];
      let col0;
      if (kind === KIND_TOKEN) col0 = RGB_TOKEN;
      else if (kind === KIND_GOLDEN) col0 = RGB_GOLDEN;
      else if (kind === KIND_BEDROCK) col0 = RGB_BEDROCK;
      else col0 = TIER_RGB[w.hue[i]];

      // Per-block jitter so a wall of one tier is not a flat slab, then damage
      // reads as the block going dark and dead rather than as a black overlay.
      let k = (0.88 + (w.shade[i] / 255) * 0.24) * (1 - (1 - hp / (w.maxHp[i] || 1)) * 0.55);
      let r = col0.r * lr * k;
      let g = col0.g * lg * k;
      let b = col0.b * lb * k;

      if (w.poisonT[i] > 0) {
        const p = 0.3 + 0.2 * pulse;
        r += (61 - r) * p; g += (220 - g) * p; b += (97 - b) * p;
      }

      d[o] = r > 255 ? 255 : r;
      d[o + 1] = g > 255 ? 255 : g;
      d[o + 2] = b > 255 ? 255 : b;
    }
  }

  blockBuf.flush();
  c.save();
  c.imageSmoothingEnabled = false;
  c.drawImage(blockBuf.cv, 0, 0, bw, bh, c0 * CELL, r0 * CELL, bw * CELL, bh * CELL);
  c.restore();
}

/**
 * Additive, smoothed pass of the same light map. One pixel per cell, scaled up
 * with interpolation on — this is the halo bleeding into the dark.
 */
function renderGlow(c, w, lm, c0, c1, r0, r1, strength) {
  const bw = c1 - c0 + 1, h = r1 - r0 + 1;
  if (bw <= 0 || h <= 0) return;
  const d = lightBuf.fit(bw, h).data;

  for (let row = r0; row <= r1; row++) {
    const src = row * GRID_W;
    let o = (row - r0) * bw * 4;
    for (let col = c0; col <= c1; col++, o += 4) {
      const i = src + col;
      // Air blooms less than rock, so open rooms stay dark instead of hazing
      // over into a flat grey wash.
      const k = w.hp[i] > 0 ? 1 : 0.45;
      const lr = lm.r[i] * k, lg = lm.g[i] * k, lb = lm.b[i] * k;
      d[o] = lr > 1 ? 255 : lr * 255;
      d[o + 1] = lg > 1 ? 255 : lg * 255;
      d[o + 2] = lb > 1 ? 255 : lb * 255;
      d[o + 3] = 255;
    }
  }
  lightBuf.flush();

  c.save();
  c.globalCompositeOperation = 'lighter';
  c.globalAlpha = strength;
  c.imageSmoothingEnabled = true;
  // Bilinear, deliberately. 'high' asks for a multi-tap resample of a 16x
  // upscale and costs more than everything else in the frame put together —
  // it more than halves the frame rate — while looking identical on a glow
  // this soft.
  c.imageSmoothingQuality = 'low';
  c.drawImage(lightBuf.cv, 0, 0, bw, h, c0 * CELL, r0 * CELL, bw * CELL, h * CELL);
  c.restore();
}

/* ── Actors ──────────────────────────────────────────────────────────────── */

function renderBalls(c, balls) {
  for (const b of balls) {
    const def = BALLS[b.type];
    const t = b.trail;
    // Trail: a short comet streak that thins toward the tail.
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.fillStyle = def.color;
    for (let i = 0; i < t.length - 2; i += 2) {
      const k = i / Math.max(2, t.length - 2);
      c.globalAlpha = k * 0.55;
      const s = 1.2 + k * 2.2;
      c.fillRect(t[i] - s / 2, t[i + 1] - s / 2, s, s);
    }
    c.globalAlpha = 1;
    c.beginPath();
    c.arc(b.x, b.y, 3.4, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }
}

function renderParticles(c, particles) {
  c.save();
  c.globalCompositeOperation = 'lighter';
  for (const p of particles) {
    c.globalAlpha = Math.max(0, p.life / p.max);
    c.fillStyle = p.color;
    c.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
  }
  c.restore();
}

function renderArcs(c, arcs, drawBolt) {
  if (!arcs.length) return;
  c.save();
  c.globalCompositeOperation = 'lighter';
  c.strokeStyle = '#f7ef7a';
  c.lineWidth = 1.6;
  for (const a of arcs) {
    c.globalAlpha = Math.min(1, a.life / 0.22);
    drawBolt(c, a.x1, a.y1, a.x2, a.y2);
  }
  c.restore();
}

/** The dotted throw line. White, evenly spaced, fading out with range. */
function renderAim(c, px, py, angle, power, loaded, accent) {
  const dots = Math.round(6 + power * 12);
  c.save();
  c.fillStyle = loaded ? accent : 'rgba(255,255,255,.35)';
  for (let i = 1; i <= dots; i++) {
    const d = 10 + i * 9;
    c.globalAlpha = loaded ? 1 - i / (dots + 3) : 0.3;
    c.fillRect(px + Math.cos(angle) * d - 1.5, py + Math.sin(angle) * d - 1.5, 3, 3);
  }
  c.restore();
}

/** The player: a small hollow triangle aimed wherever the next shot goes. */
function renderPlayer(c, px, py, angle, accent) {
  c.save();
  c.translate(px, py);
  c.rotate(angle);
  c.strokeStyle = accent;
  c.lineWidth = 1.7;
  c.lineJoin = 'miter';
  c.beginPath();
  c.moveTo(6.5, 0);
  c.lineTo(-4.5, -5.2);
  c.lineTo(-4.5, 5.2);
  c.closePath();
  c.stroke();
  c.restore();
}
