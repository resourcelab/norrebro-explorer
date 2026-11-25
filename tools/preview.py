#!/usr/bin/env python3
"""Quick top-down picture of the world tiles, for checking an import by eye.

    python3 tools/preview.py data/world out.png [scale]

scale is pixels per metre (default 0.6). Needs Pillow (pip install pillow).
"""
import json
import os
import sys

from PIL import Image, ImageDraw

PAPER = '#efe8d8'
AREA_COLOURS = {
    'water': '#9cc3d5', 'park': '#b9d39a', 'grass': '#c6dca6', 'cemetery': '#a9c88e', 'playground': '#e8cf8a',
    'pitch': '#9fcf8f', 'garden': '#b5d29a', 'wood': '#93b77a', 'scrub': '#a7c08a', 'flowerbed': '#d9b3c0',
    'square': '#e2dccb', 'parking': '#d6d2c8', 'schoolyard': '#e6dcc4',
}
# drawing order: big hard surfaces first, small and wet things last
AREA_ORDER = ['parking', 'schoolyard', 'square', 'cemetery', 'park', 'grass', 'garden', 'wood', 'scrub', 'pitch',
              'playground', 'flowerbed', 'water']
ROAD_MIN_WIDTH = 5  # metres: wider streets get a kerb outline and a white surface


def load_world(world_dir):
    """All features from every tile, each once (features that cross tile edges are listed in several tiles)."""
    manifest = json.load(open(os.path.join(world_dir, 'manifest.json')))
    seen = set()
    features = {'areas': [], 'streets': [], 'buildings': [], 'barriers': []}
    trees = []
    for key in manifest['tiles']:
        tile = json.load(open(os.path.join(world_dir, 'tiles', key + '.json')))
        for kind, items in features.items():
            for f in tile[kind]:
                if f['id'] not in seen:
                    seen.add(f['id'])
                    items.append(f)
        trees += tile['trees']
    return manifest, features, trees


def draw(manifest, features, trees, scale):
    width, depth = manifest['size']['width'], manifest['size']['depth']
    image = Image.new('RGB', (int(width * scale), int(depth * scale)), PAPER)
    g = ImageDraw.Draw(image)

    def px(pts):
        return [(x * scale, z * scale) for x, z in pts]

    for kind in AREA_ORDER:
        for f in features['areas']:
            if f['kind'] == kind:
                g.polygon(px(f['pts']), fill=AREA_COLOURS[kind])

    streets = sorted(features['streets'], key=lambda f: f['width'])
    for f in streets:  # the kerb / outline, a little wider than the street
        road = f['width'] >= ROAD_MIN_WIDTH
        g.line(px(f['pts']), fill='#b9b2a2' if road else '#d8cfba', width=max(1, int((f['width'] + 1.5) * scale)))
    for f in streets:  # the road surface
        if f['width'] >= ROAD_MIN_WIDTH:
            g.line(px(f['pts']), fill='#ffffff', width=max(1, int(f['width'] * scale)))

    for f in features['buildings']:
        g.polygon(px(f['pts']), fill='#c98f6b', outline='#8a5a40')

    r = 2.2 * scale
    for x, z in trees:
        g.ellipse([x * scale - r, z * scale - r, x * scale + r, z * scale + r], fill='#6f9a52')
    return image


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    world_dir, out = sys.argv[1], sys.argv[2]
    scale = float(sys.argv[3]) if len(sys.argv) > 3 else 0.6
    image = draw(*load_world(world_dir), scale)
    image.save(out)
    print(out, image.size)


if __name__ == '__main__':
    main()
