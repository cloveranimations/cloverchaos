# BlindShot

A slingshot mining game. Fire into the dark, ricochet through eight tiers of
rock, spend upgrade tokens on a 33-node tech tree, and find the one golden
block buried somewhere in rows 86–96.

This is a **standalone site** — it is not part of the Clover Chaos Next.js app.
There is no build step and no dependencies.

## Running it

Open `index.html` in a browser, or serve the folder:

```sh
cd blindshot
python3 -m http.server 8899
# → http://localhost:8899
```

To deploy, upload the three files (`index.html`, `game.js`, `ui.js`) to any
static host. Nothing else is required.

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
- **Fog of war.** You only see what an impact has revealed. The minimap shows
  discovered rock, carved-out space, your heading, and a very faint band over
  the rows where the golden block can spawn.
- **The golden block bleeds light through solid rock** once you get close, so
  the last stretch is hot-and-cold rather than a blind grind. Laying eyes on it
  fires a banner and permanently hands you the compass.
- **Rot is budgeted.** Poison spread is measured in generations, not a boolean:
  Contagion gives it 1 hop past each block it kills, Pandemic adds 2 more. An
  outbreak always burns out instead of eating the map.
- Progress saves to `localStorage` under `blindshot.save.v3` (~39 KB, the block
  grid is run-length encoded).

### A note on vibration

Vibration uses `navigator.vibrate`, which is the only web API that can shake a
phone. Android browsers support it; **iOS Safari does not implement it at
all**, so on an iPhone the `VIB` button reports that instead of pretending.

## Roblox parity

`game.js` is split into a `CONFIG` and an `ENGINE` section, both DOM-free, so
they mirror 1:1 onto `../roblox/BlindShotConfig.lua`. The tech tree, base
stats, ball definitions and tuning constants are kept in sync between the two,
and the `mulberry32` RNG is bit-identical, so the same seed generates the same
map on both platforms. When you tune one, tune the other.
