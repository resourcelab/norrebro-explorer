/**
 * Near and far: which things are within NEARBY.radius of the walker. The core only decides; the style decides what
 * near and far look like (papercraft folds pieces up and flat; another style might fade them, or ignore it).
 * A near thing stays near until it is radius + hysteresis away, so pieces at the edge don't flicker. Things marked
 * `always` (landmarks) are always near.
 */
export function createNearby(things, { radius, hysteresis, checkEvery }) {
  const near = new Set();
  let since = Infinity;

  const isNear = (t, x, z) => t.always || Math.hypot(t.x - x, t.z - z) < radius + (near.has(t.id) ? hysteresis : 0);

  /** Recompute from (x, z): returns { came: ids now near, went: ids now far }. */
  function check(x, z) {
    const came = [];
    const went = [];
    for (const t of things) {
      const n = isNear(t, x, z);
      if (n && !near.has(t.id)) { near.add(t.id); came.push(t.id); } else if (!n && near.has(t.id)) { near.delete(t.id); went.push(t.id); }
    }
    return { came, went };
  }

  return {
    near,
    check,
    /** Call every step: checks every `checkEvery` seconds, otherwise returns null. */
    update(dt, x, z) {
      since += dt;
      if (since < checkEvery) return null;
      since = 0;
      return check(x, z);
    },
    /** Forget the timer, so the next update checks at once (after a teleport). */
    poke() { since = Infinity; },
  };
}
