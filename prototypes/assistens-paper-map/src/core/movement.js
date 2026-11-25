/**
 * Walking: turns the player's intent (a direction, and whether to run) into movement, with acceleration, turning,
 * and sliding along whatever blocks the way (a wall at an angle slows him, it does not stop him dead).
 */
const MAX_SUBSTEP = 0.2; // units: long frames are cut into short moves so he never steps through a thin wall
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * @param walk { speed, runFactor, accel, turn } from config.js WALK
 * @param start [x, z]
 */
export function createMover(walk, start) {
  const s = { x: start[0], z: start[1], heading: 0, vx: 0, vz: 0, speed: 0, maxSpeed: walk.speed };

  /**
   * One step. intent: { x, z, run } with x, z a direction (any length; 0, 0 to stop). blocked(x, z): true where he
   * cannot stand. Returns how far he moved.
   */
  function step(dt, intent, blocked) {
    const il = Math.hypot(intent.x, intent.z);
    const wx = il ? intent.x / il : 0;
    const wz = il ? intent.z / il : 0;
    s.maxSpeed = walk.speed * (intent.run ? walk.runFactor : 1);
    // velocity: a constant-rate approach to the wanted one
    const dvx = wx * s.maxSpeed - s.vx;
    const dvz = wz * s.maxSpeed - s.vz;
    const dvl = Math.hypot(dvx, dvz);
    const maxDv = walk.accel * dt;
    if (dvl <= maxDv) { s.vx = wx * s.maxSpeed; s.vz = wz * s.maxSpeed; } else { s.vx += (dvx / dvl) * maxDv; s.vz += (dvz / dvl) * maxDv; }
    // heading: toward the input (or the remaining velocity while coasting), smoothed
    const sp = Math.hypot(s.vx, s.vz);
    if (il || sp > 0.05) {
      const want = il ? Math.atan2(wx, wz) : Math.atan2(s.vx, s.vz);
      s.heading = wrap(s.heading + wrap(want - s.heading) * (1 - Math.exp(-walk.turn * dt)));
    }
    // move in short sub-steps; when blocked, try each axis alone (slide along the obstacle)
    const x0 = s.x;
    const z0 = s.z;
    let dx = s.vx * dt;
    let dz = s.vz * dt;
    const n = Math.max(1, Math.ceil(Math.hypot(dx, dz) / MAX_SUBSTEP));
    dx /= n;
    dz /= n;
    for (let i = 0; i < n; i++) {
      if (!blocked(s.x + dx, s.z + dz)) { s.x += dx; s.z += dz; } else if (!blocked(s.x + dx, s.z)) { s.x += dx; dz = 0; } else if (!blocked(s.x, s.z + dz)) { s.z += dz; dx = 0; } else break;
    }
    const moved = Math.hypot(s.x - x0, s.z - z0);
    if (dt > 0 && moved < sp * dt * 0.98) { s.vx = (s.x - x0) / dt; s.vz = (s.z - z0) / dt; } // keep only what was allowed
    s.speed = Math.hypot(s.vx, s.vz);
    return moved;
  }

  /** Put him at (x, z), standing still. */
  function place(x, z, heading = s.heading) {
    Object.assign(s, { x, z, heading, vx: 0, vz: 0, speed: 0 });
  }

  return { state: s, step, place };
}
