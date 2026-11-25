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
