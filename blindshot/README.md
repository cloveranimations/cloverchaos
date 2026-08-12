# BlindShot

A slingshot mining game. Fire into the dark, ricochet out through eight layers
of rock, spend upgrade tokens on a 33-node tech tree, and find the one golden
block buried 70–90 blocks from where you woke up.

This is a **standalone site** — it is not part of the Clover Chaos Next.js app.
There is no build step and no dependencies.

## Running it

Open `index.html` in a browser, or serve the folder:

```sh
cd blindshot
python3 -m http.server 8899
# → http://localhost:8899
```

To deploy, upload `index.html` and the four scripts to any static host.
Nothing else is required.

## Files

Load order matters, and it is also the porting boundary:

| File | Contains | Ports to Luau |
| --- | --- | --- |
| `config.js` | Pure data: blocks, balls, tech tree, tuning | yes, as-is |
| `engine.js` | Pure sim: worldgen, physics, damage, lighting | yes, as-is |
| `render.js` | Canvas drawing | no — rewrite |
| `ui.js` | DOM, input, HUD, tech tree, frame loop | no — rewrite |

`config.js` and `engine.js` never touch `document`, `window` or a canvas. That
split is deliberate: a Roblox build keeps the first two verbatim and replaces
only the last two.

## Controls

| Action | Input |
| --- | --- |
| Aim and fire | Hold and drag **back**, release — it is a slingshot |
| Walk | Tap any carved-out space within 15 blocks |
| Tech tree | `TECH` button |
| Minimap | `MAP` button |
| Device vibration | `VIB` button |

## How it plays

- **Shots are on a 5 second cooldown** at zero upgrades. A shot is a decision,
  not a twitch. Cooldown upgrades (Static → Quickdraw → Overclock) bring it
  down to roughly 2 seconds.
- **Balls always ricochet**, including off blocks they just destroyed. Each
  impact spends one bounce from the ball's budget. The Ghost ball is the sole
  exception — it tunnels, and dies fast for the privilege.
- **Layers radiate from spawn, they are not rows.** Each run drops you in a
  random corner and measures everything from there: the rock you spawn touching
  is always layer 1 / Crust, and every 12 blocks of straight-line distance steps
  one tier harder, out to layer 8 / Core. There is no such thing as a spawn you
  cannot dig out of, and the HUD reads `FROM SPAWN` in blocks rather than depth.
- **Block colour is rolled per block, not per layer.** The map reads as
  scattered colour while difficulty stays radial: a block's hardness comes from
  its layer, its appearance from a weighted roll over `BLOCKS`.
- **Blocks are lit, not shaded.** Every block's on-screen colour is its own
  colour multiplied by the light reaching it. Lamp blocks flood a per-cell RGB
  light map, sweeps smear it outward — losing ~18% per block of air and ~52%
  per block of rock — and the same map is drawn again, smoothed and additive,
  to bleed glow past hard block edges. Balls and the player are moving lamps,
  so a shot lights its own way into the dark.
  Lamps are ~3% of blocks **on purpose**: make them common and the whole map
  flattens into one even wash with no dark left in it, which is the failure
  mode this system exists to avoid.
- **The golden block is the brightest thing on the map** — it floods its
  chamber gold and carries a slow four-point sparkle, so finding it lands.
- **Hits and breaks are animated.** A struck block flashes its own colour with
  an expanding outline; a destroyed one blows outward as a fading ring over a
  bright core. Both are drawn over the block buffer rather than in it, since
  the buffer is one pixel per cell and cannot scale past a cell boundary.
- **Redesigning blocks is a one-table job.** `BLOCKS` in `config.js` holds a
  `color`, a `glow`, a `light` reach and a roll `weight` per block;
  `BLOCK_TOKEN` and `BLOCK_GOLDEN` are the same shape. Nothing else needs
  touching.
- **Fog of war.** You only see what an impact has revealed. The minimap shows
  discovered rock, carved-out space, your heading, and a very faint ring at the
  distance where the golden block can spawn.
- **The golden block bleeds light through solid rock** once you get close, so
  the last stretch is hot-and-cold rather than a blind grind. Laying eyes on it
  fires a banner and permanently hands you the compass.
- **Rot is budgeted.** Poison spread is measured in generations, not a boolean:
  Contagion gives it 1 hop past each block it kills, Pandemic adds 2 more. An
  outbreak always burns out instead of eating the map.
- Progress saves to `localStorage` under `blindshot.save.v4` (~39 KB, the block
  grid is run-length encoded).

### A note on vibration

Vibration uses `navigator.vibrate`, which is the only web API that can shake a
phone. Android browsers support it; **iOS Safari does not implement it at
all**, so on an iPhone the `VIB` button reports that instead of pretending.

## Roblox parity

`config.js` and `engine.js` are DOM-free, so they mirror 1:1 onto
`../roblox/BlindShotConfig.lua`. The tech tree, base stats, ball definitions,
block table and lighting constants are kept in sync between the two,
and the `mulberry32` RNG is bit-identical, so the same seed generates the same
map on both platforms. When you tune one, tune the other.
