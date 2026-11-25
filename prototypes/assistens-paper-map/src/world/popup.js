/**
 * A thin wrapper round the harness's H.popup used by every build step.
 *
 * Why: H.popup turns each card to face the camera *where it is when the world is built* (at the walker's start). The
 * walking camera keeps one heading as it follows him, so a card far from the start would be seen edge-on once you
 * walk over to it. Here every card faces the walking camera's heading instead (yaw ≈ 0), with a little random turn so
 * rows don't look stamped; crosses (trees) are turned ±24° so both of their faces show.
 *
 * Constructions (`node`) and anything given an explicit `yaw` are left as they are.
 */
const PRINT_RES = 0.8; // print resolution multiplier: a little under 1 keeps the build fast with no visible change

export function createPopup(H) {
  let seed = 7;
  const turn = () => (seed = (seed * 16807) % 2147483647) / 2147483647; // own stream: placement randomness stays as planned

  const facing = (o) => {
    if (o.yaw !== undefined || o.node) return o.yaw ?? null;
    if (o.cross) return (turn() < 0.5 ? -1 : 1) * (0.42 + (turn() - 0.5) * 0.28);
    return (turn() - 0.5) * 0.49;
  };

  /** popup(pts, paint, options): see harness.js `popup` for the options. Returns the piece's hinge. */
  return (pts, paint, o = {}) => H.popup(pts, paint, { res: PRINT_RES, ...o, yaw: facing(o) });
}

/** Print a [pts, paint] piece once and return { pts, mat } so many cards can share the printed material. */
export function printOnce(H, [pts, paint]) {
  return { pts, mat: H.printed(pts, paint) };
}
