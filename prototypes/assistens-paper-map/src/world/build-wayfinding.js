/**
 * Builds what you find your way by: the landmark churches and flags (they stand whatever the distance), the corner
 * signs, and the fingerposts to places beyond the walkable area.
 */
import { TOY } from '../config.js';
import { CHURCHES, FLAGS } from '../map/landmarks.js';
import { church, flag, fingerpost } from '../pieces/landmarks.js';
import { cornerSign } from '../pieces/signs.js';

export function buildWayfinding(H, popup, plan) {
  for (const c of CHURCHES) church(H, popup, c);
  for (const f of FLAGS) popup(...flag(f.color), { x: f.at[0], z: f.at[1], scale: TOY.landmark * 0.8, yaw: 0.05, landmark: true, sway: 0.15 });

  // corner signs are built when the walker first comes near (each has its own lettering, so its own print)
  for (const s of plan.cornerSigns) {
    popup.lazy(s.x, s.z, () => popup(...cornerSign(s.names), { x: s.x, z: s.z, yaw: 0, solid: 0.15 }));
  }
  for (const p of plan.fingerposts) {
    const arms = p.arms.map((a) => ({ label: `${a.name} ${a.metres} m`, dx: a.dx }));
    popup(...fingerpost(arms), { x: p.x, z: p.z, yaw: 0, solid: 0.2 });
  }
}
