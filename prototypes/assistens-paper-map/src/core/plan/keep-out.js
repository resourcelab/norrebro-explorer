/**
 * A list of round "keep clear" zones [x, z, radius]. Placement code adds the things that must not be crowded (the
 * chapel, the walker's start, sheds, notable graves, trees) and asks `clear(x, z, r)` before putting anything down.
 */
export function createKeepOut() {
  const zones = [];
  return {
    zones,
    add(x, z, r) {
      zones.push([x, z, r]);
    },
    /** True when a piece of radius r at (x, z) overlaps no zone. */
    clear(x, z, r) {
      return zones.every(([kx, kz, kr]) => Math.hypot(x - kx, z - kz) > kr + r);
    },
  };
}
