#!/usr/bin/env python3
"""Cut the area round Assistens Kirkegård out of the Nørrebro world tiles into src/data/surroundings.js.

The world tiles (made by the repo's tools/import-osm.mjs) use metres from the north-west corner of the imported area.
The prototype uses metres from the cemetery centroid. This script converts between the two, keeps only what touches
REGION, simplifies outlines (Douglas-Peucker) so the file stays small, and writes one JS module.

    python3 tools/extract-surroundings.py <world-dir> [out=src/data/surroundings.js]

Example, from the prototype folder:
    python3 tools/extract-surroundings.py ../../data/world
"""
import argparse
import json
import math
import os

# The prototype's origin: the cemetery centroid (lon, lat). Must match the comment in src/data/assistens-osm.js.
ORIGIN_LON, ORIGIN_LAT = 12.550529305405401, 55.690776421621614
# The area kept, in prototype metres: x0, y0, x1, y1 (x east, y south). About 860 x 870 m round the cemetery.
REGION = (-480, -440, 380, 430)
# Simplification tolerances (metres): buildings, areas, street centre lines.
EPS_BUILDING, EPS_AREA, EPS_STREET = 1.2, 1.0, 0.8


def douglas_peucker(pts, eps):
    """Simplify an open polyline: drop points closer than eps to the line through their neighbours."""
    if len(pts) < 3:
        return pts
    (ax, az), (bx, bz) = pts[0], pts[-1]
    length = math.hypot(bx - ax, bz - az)
    dmax, idx = 0, 0
    for i in range(1, len(pts) - 1):
        x, z = pts[i]
        if length < 1e-6:
            d = math.hypot(x - ax, z - az)
        else:
            d = abs((bz - az) * x - (bx - ax) * z + bx * az - bz * ax) / length
        if d > dmax:
            dmax, idx = d, i
    if dmax > eps:
        return douglas_peucker(pts[: idx + 1], eps)[:-1] + douglas_peucker(pts[idx:], eps)
    return [pts[0], pts[-1]]


def simplify_ring(pts, eps):
    """Simplify a closed ring: split it at the point furthest from the first, simplify both halves, rejoin."""
    ring = pts[:-1] if pts[0] == pts[-1] else pts
    if len(ring) < 4:
        return ring
    far = max(range(len(ring)), key=lambda i: math.hypot(ring[i][0] - ring[0][0], ring[i][1] - ring[0][1]))
    a = douglas_peucker(ring[: far + 1], eps)
    b = douglas_peucker(ring[far:] + [ring[0]], eps)
    return a[:-1] + b[:-1]


def touches_region(pts):
    x0, y0, x1, y1 = REGION
    return any(x0 <= x <= x1 and y0 <= y <= y1 for x, y in pts)


def rounded(pts):
    return [[round(x), round(y)] for x, y in pts]


def extract(world_dir):
    manifest = json.load(open(os.path.join(world_dir, 'manifest.json')))
    # same equirectangular projection as import-osm.mjs: metres per degree at the area's middle latitude
    west, south, _east, north = manifest['bboxLonLat']
    kx = 111320 * math.cos(math.radians((south + north) / 2))
    kz = 110574
    dx, dz = (ORIGIN_LON - west) * kx, (north - ORIGIN_LAT) * kz

    def to_prototype(p):
        return [round(p[0] - dx, 1), round(p[1] - dz, 1)]

    seen = set()  # features cross tile edges, so the same id appears in several tiles
    out = {'region': REGION, 'buildings': [], 'streets': [], 'areas': [], 'trees': [], 'props': [], 'pois': []}
    trees = {}

    for key in manifest['tiles']:
        tile = json.load(open(os.path.join(world_dir, 'tiles', key + '.json')))
        for b in tile['buildings']:
            if b['id'] in seen:
                continue
            seen.add(b['id'])
            pts = [to_prototype(p) for p in b['pts']]
            if not touches_region(pts):
                continue
            ring = simplify_ring(pts, EPS_BUILDING)
            if len(ring) >= 3:
                out['buildings'].append({'id': b['id'], 'pts': rounded(ring), 'levels': b.get('levels'), 'kind': b.get('kind'), 'name': b.get('name')})
        for s in tile['streets']:
            if s['id'] in seen:
                continue
            seen.add(s['id'])
            pts = [to_prototype(p) for p in s['pts']]
            if touches_region(pts):
                out['streets'].append({'name': s.get('name'), 'kind': s['kind'], 'width': s['width'], 'pts': rounded(douglas_peucker(pts, EPS_STREET))})
        for a in tile['areas']:
            if a['id'] in seen:
                continue
            seen.add(a['id'])
            pts = [to_prototype(p) for p in a['pts']]
            if touches_region(pts) and a['kind'] != 'cemetery':  # the cemetery itself comes from assistens-osm.js
                out['areas'].append({'kind': a['kind'], 'name': a.get('name'), 'pts': rounded(simplify_ring(pts, EPS_AREA))})
        for p in tile['trees']:
            q = to_prototype(p)
            if touches_region([q]):
                trees[(round(q[0]), round(q[1]))] = True  # first-seen order, duplicates dropped
        for p in tile['props']:
            q = to_prototype(p[:2])
            if touches_region([q]):
                out['props'].append([round(q[0]), round(q[1]), p[2]])
        for p in tile['pois']:
            q = to_prototype([p['x'], p['z']])
            if touches_region([q]) and p.get('name'):
                out['pois'].append([round(q[0]), round(q[1]), p['name'], p['category']])

    out['trees'] = [list(t) for t in trees]
    return out


def write_module(data, path):
    with open(path, 'w') as f:
        f.write('// The streets, blocks, parks and playgrounds round Assistens Kirkegård, cut from the Nørrebro world tiles\n')
        f.write('// (Map data © OpenStreetMap contributors, ODbL). Generated by tools/extract-surroundings.py; do not edit by hand.\n')
        f.write('// Metres from the cemetery centroid: x east, y south.\n')
        f.write('export const SURROUNDINGS = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n')


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('world_dir', help='the world tiles folder (data/world in the repo root)')
    ap.add_argument('out', nargs='?', default='src/data/surroundings.js')
    args = ap.parse_args()
    data = extract(args.world_dir)
    write_module(data, args.out)
    counts = {k: len(v) for k, v in data.items() if isinstance(v, list)}
    print(f'wrote {args.out}: {counts}, {os.path.getsize(args.out) // 1024} KB')


if __name__ == '__main__':
    main()
