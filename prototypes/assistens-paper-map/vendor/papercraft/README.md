# vendor/papercraft

Plumbing from the papercraft agent skill, copied in so the project builds without the skill installed.

- Source: https://github.com/xikhar/papercraft (`skills/papercraft/assets/`), commit `62aca0e`, skill v0.5.0
- License: MIT (see `LICENSE`)

| File | From |
|---|---|
| `harness.js` | `templates/popup-3d/harness.js` (renderer, light, lens, hinges, walking, camera) |
| `lib/*.js` | `lib/` (paper kit 2D/3D, motion, life, sound) |
| `examples/countryside.js` | `examples/countryside.js` (tree / pine / wood prints reused for the trees and benches) |

Local change: `lib/paperkit-3d.js`, depth-of-field shader — skips NaN pixels so a degenerate sliver can't bloom into a
white disc in the blur (two lines, marked with a comment).

Local change: `harness.js`, marked `local change` (norrebro-explorer, 2026-11-25):
- `createHarness({ walkSpeed, runFactor })`: walking speed in units per second (default as before, 1.9 × hero height),
  and Shift runs `runFactor` times faster.
- `view.pitchMin` / `view.pitchMax`: the drag-to-look pitch range can change at runtime (the map view looks steeper).
- `H.post`: the lens (`PaperPost`) is reachable once started, so the map view can retune haze and blur.

Local change (2026-11-25): `createHarness({ drive: true })` lets the game drive the hero. The harness then reads no
keys and does no collision: each step the game calls `H.drive({ x, z, heading, maxSpeed })` (from an `H.beforeStep`
hook, which runs before the harness's own step) and the harness animates the stride, lean and turn and frames him with
its camera window and sight assist as before. `__papercraft.place(x, z)` asks `H.placeHook(x, z)` (the game) whether
he may stand there.
