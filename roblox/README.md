# BlindShot for Roblox

`BlindShot.lua` is the whole game in one file: config, engine, renderer, HUD,
tech tree and input. It is a direct transcription of the web build in
`../blindshot/`, not a reimagining.

## Install

One file, one place:

```
StarterPlayer
└── StarterPlayerScripts
    └── BlindShot        ← LocalScript, paste BlindShot.lua into it
```

No ModuleScripts, no folders, no other setup. It builds its own ScreenGui and
tears down any previous copy on respawn.

## Controls

| | |
|---|---|
| Drag back and release | Sling. Pull away from the target; the ball flies the other way. |
| Tap / click | Walk, up to 15 blocks toward the point, stopping at rock. |
| WASD or arrows | Walk, same step a tap takes. |
| Left stick | Pull back and release to fire. |
| Y | Tech tree. |

## How it draws

The web build paints one pixel per cell into an `ImageData` and lets the browser
upscale it with smoothing off. Roblox has the same primitive: `EditableImage`
plus `ResamplerMode.Pixelated`. The glow is the same buffer on a second layer
with bilinear resampling.

Only about a 30x19 cell window is ever drawn, so a frame writes ~570 pixels
twice, not the whole 100x100 map. If `EditableImage` is unavailable on the
client, the block layer falls back to a pooled grid of Frames automatically —
at that window size the fallback is genuinely playable.

Balls, particles, the player triangle, impact rings, chain arcs and floating
text are pooled Frames positioned in screen space, matching the canvas vector
passes that run on top of the pixel buffer.

## Verified against the web build

The port is checked by running both implementations and diffing the results,
not by reading them side by side:

- **mulberry32** produces the identical stream, so a seed means the same map.
- **Worldgen** matches bit for bit across four seeds — spawn point, per-block
  HP, rolled colours, revealed cells, golden block location.
- **Simulation** matches bit for bit over 400 frames for all five ball types,
  covering bouncing, splash, chaining, rot spread, token drops and reveals.
- **Lighting** matches to seven significant figures; the residue is the web's
  `Float32Array` against Lua's doubles.

Two bugs came out of that harness and are fixed here: a skipped cave void was
consuming an RNG roll it should not have, and fractional damage needs to
truncate on store the way `Int16Array` does — without it poison and splash come
out far weaker than in the browser.

## Deliberate differences

- **Saves.** A LocalScript cannot reach `DataStoreService`. The `save()` call
  sites are kept as a no-op; wire them to a RemoteEvent to persist a run.
- **Additive glow.** Roblox GUI has no additive blend, so the glow layer carries
  its strength in the alpha channel: dim light barely touches what is under it,
  bright light saturates toward the lamp's own colour, which is where additive
  ends up anyway.
- **Vibration.** `navigator.vibrate` has no Roblox equivalent on touch devices.
  The VIB toggle drives gamepad rumble and does nothing on a phone.
- **Backdrop blur** behind the tech tree, and **letter-spacing**, do not exist
  in Roblox GUI.

`UI_SCALE` near the top of the file scales the whole HUD if the pixel font reads
too small on your monitor; `1` is pixel-for-pixel with the web.
