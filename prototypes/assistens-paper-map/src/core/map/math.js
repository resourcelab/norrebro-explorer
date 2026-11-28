/**
 * Plain 2D geometry on [x, z] points (world units). No dependencies, no state: everything else in map/ builds on these.
 *
 * Conventions used across the project:
 *   - a point is [x, z]; x runs east, z runs SOUTH (so z grows down the screen, like image rows and three.js ground)
 *   - a polygon is an array of points, not closed (the last point does not repeat the first)
 *   - a polyline is an array of points walked in order
 */

/** Even-odd test: is (x, z) inside the polygon? */
export function inPolygon(x, z, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i];
    const [xj, zj] = poly[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

/** Distance from (x, z) to the segment a-b. */
export function segmentDistance(x, z, [ax, az], [bx, bz]) {
  const dx = bx - ax;
  const dz = bz - az;
  const lenSq = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / lenSq));
  return Math.hypot(ax + t * dx - x, az + t * dz - z);
}

/** Distance from (x, z) to the nearest segment of a polyline. */
export function polylineDistance(x, z, pts) {
  let d = Infinity;
  for (let i = 0; i < pts.length - 1; i++) d = Math.min(d, segmentDistance(x, z, pts[i], pts[i + 1]));
  return d;
}

/** The nearest point on a polyline to (x, z): { x, z, d }. */
export function nearestOnPolyline(pts, x, z) {
  let best = { x: pts[0][0], z: pts[0][1], d: Infinity };
  for (let i = 0; i < pts.length - 1; i++) {
    const [[ax, az], [bx, bz]] = [pts[i], pts[i + 1]];
    const [dx, dz] = [bx - ax, bz - az];
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
    const [px, pz] = [ax + t * dx, az + t * dz];
    const d = Math.hypot(px - x, pz - z);
    if (d < best.d) best = { x: px, z: pz, d };
  }
  return best;
}

/** Where segments a-b and c-d cross, or null when they don't. */
export function segmentIntersection(a, b, c, d) {
  const r = [b[0] - a[0], b[1] - a[1]];
  const s = [d[0] - c[0], d[1] - c[1]];
  const den = r[0] * s[1] - r[1] * s[0];
  if (Math.abs(den) < 1e-9) return null; // parallel
  const t = ((c[0] - a[0]) * s[1] - (c[1] - a[1]) * s[0]) / den;
  const u = ((c[0] - a[0]) * r[1] - (c[1] - a[1]) * r[0]) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? [a[0] + t * r[0], a[1] + t * r[1]] : null;
}

/**
 * Signed area (shoelace). In this x-east / z-south frame a NEGATIVE area means the points run so the shape lies
 * behind (north of) its first edge, which is the winding papercraft's prismFold expects.
 */
export function signedArea(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [px, pz] = pts[i];
    const [qx, qz] = pts[(i + 1) % pts.length];
    a += px * qz - qx * pz;
  }
  return a / 2;
}

/** Average of the points (good enough as a centre for the small, roughly convex shapes used here). */
export function centroid(pts) {
  return [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
}

/** Axis-aligned bounds of a set of points: { x0, z0, x1, z1 }. */
export function boundsOf(pts) {
  const xs = pts.map((p) => p[0]);
  const zs = pts.map((p) => p[1]);
  return { x0: Math.min(...xs), z0: Math.min(...zs), x1: Math.max(...xs), z1: Math.max(...zs) };
}

/** Length of the longest edge of a closed polygon. */
export function longestEdge(pts) {
  let best = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    best = Math.max(best, Math.hypot(q[0] - p[0], q[1] - p[1]));
  }
  return best;
}

/** Convex hull (Andrew's monotone chain). Returned counter-clockwise in maths terms (positive signed area here). */
export function convexHull(pts) {
  const sorted = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  const upper = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  for (const p of [...sorted].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

/**
 * Walk a polyline at distance s from its start: { x, z, dx, dz } with (dx, dz) the direction of travel there.
 * `lengths` is the precomputed segment lengths (see polylineLengths) so a moving piece does not re-measure every frame.
 */
export function pointAlong(pts, lengths, s) {
  for (let i = 0; i < lengths.length; i++) {
    const L = lengths[i];
    if (s <= L || i === lengths.length - 1) {
      const t = L > 0 ? Math.min(1, Math.max(0, s / L)) : 0;
      const [ax, az] = pts[i];
      const [bx, bz] = pts[i + 1];
      return { x: ax + (bx - ax) * t, z: az + (bz - az) * t, dx: bx - ax, dz: bz - az };
    }
    s -= L;
  }
  const [x, z] = pts[pts.length - 1];
  return { x, z, dx: 0, dz: 0 };
}

/** Segment lengths of a polyline. */
export const polylineLengths = (pts) => pts.slice(1).map((q, i) => Math.hypot(q[0] - pts[i][0], q[1] - pts[i][1]));

/**
 * Offset a point sideways from a segment: the point at fraction t along a-b, moved `off` units to the left of the
 * direction a→b (negative moves right). Used to scatter grit and to put lamps beside a path.
 */
export function besideSegment([ax, az], [bx, bz], t, off) {
  const L = Math.hypot(bx - ax, bz - az) || 1;
  return [ax + (bx - ax) * t - ((bz - az) / L) * off, az + (bz - az) * t + ((bx - ax) / L) * off];
}

/** Split a polyline into straight runs of at most maxLen, leaving out the openings (gap(x, z) true). */
export function splitRuns(pts, { maxLen = 5, gap = () => false } = {}) {
  const runs = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i];
    const [bx, bz] = pts[i + 1];
    const L = Math.hypot(bx - ax, bz - az);
    let start = null;
    for (let s = 0; s <= L + 1e-6; s += 0.25) {
      const t = Math.min(1, s / L);
      const x = ax + (bx - ax) * t;
      const z = az + (bz - az) * t;
      const open = !gap(x, z);
      if (open && !start) start = [x, z];
      const atEnd = s + 0.25 > L;
      if (start && (!open || atEnd || Math.hypot(x - start[0], z - start[1]) >= maxLen)) {
        if (Math.hypot(x - start[0], z - start[1]) > 0.6) runs.push([start, [x, z]]);
        start = open && !atEnd ? [x, z] : null;
      }
    }
  }
  return runs;
}
