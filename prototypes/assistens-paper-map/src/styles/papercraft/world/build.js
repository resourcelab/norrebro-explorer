/**
 * Paper pieces for the game's things (core/world.js). createMakers gives, for every thing, a maker: a function that
 * builds its paper piece(s) when the presenter first needs them. Prints shared by many pieces (tree variants, grave
 * plots, benches, lamps, playground kit) are made once, up front.
 */
import * as P2 from 'papercraft/lib/paperkit-2d.js';
import { TOY } from '../../../config.js';
import { PALETTE as C } from '../settings.js';
import { createTreePrints, VARIANTS_PER_KIND } from '../pieces/trees.js';
import { createPlotPrints, notableGrave } from '../pieces/graves.js';
import { wallPaint, lidPaint, hedgePaint, placeRun, gatePost } from '../pieces/walls.js';
import { chapelFold } from '../pieces/chapel.js';
import { createPropPrints, shed } from '../pieces/props.js';
import { crow, squirrel } from '../pieces/critters.js';
import { apartmentBlock } from '../pieces/buildings.js';
import { PLAYGROUND } from '../pieces/playground.js';
import { bikeRack } from '../pieces/street.js';
import { church, flag, fingerpost } from '../pieces/landmarks.js';
import { cornerSign } from '../pieces/signs.js';
import { printOnce } from './popup.js';

const WALL = { h: TOY.wallHeight, t: 0.5 };
const HEDGE = { h: TOY.hedgeHeight, t: 0.6 };
const GATE_POST_SCALE = TOY.wallHeight / 1.5; // the posts stand a little above the wall
/** Kinds that are constructions (folds): hidden at once when far, not folded flat. */
const CONSTRUCTIONS = new Set(['chapel', 'shed', 'wall', 'gate-post', 'block', 'church']);

/**
 * @param onCritter (hinge, behaviour) for each crow or squirrel built (paper-life animates them)
 * @returns makersFor(things) -> Map id -> { x, z, node, eager, make }: call it for the things at the start, and again
 *          for the things of every tile that loads later
 */
export function createMakers(H, popup, { onCritter }) {
  const treeVariant = createTreePrints(H);
  const props = createPropPrints(H);
  const plotPrints = createPlotPrints(H);
  const kit = Object.fromEntries(Object.entries(PLAYGROUND).map(([kind, make]) => [kind, printOnce(H, make())]));
  const rack = printOnce(H, bikeRack());
  const wallLid = lidPaint(P2.shade(C.wall, -0.08));

  const piece = {
    chapel: (t) => popup(null, null, { node: chapelFold(H), height: 6.2, x: t.x, z: t.z, yaw: t.yaw, level: true, solid: 3.2, scale: TOY.chapel }),
    shed: (t) => shed(H, popup, t.pts, TOY.shed),
    wall: (t) => (t.wall === 'hedge'
      ? placeRun(H, popup, [t.a, t.b], { h: HEDGE.h, t: HEDGE.t, wall: hedgePaint, lid: hedgePaint })
      : placeRun(H, popup, [t.a, t.b], { h: WALL.h, t: WALL.t, wall: wallPaint, lid: wallLid })),
    'gate-post': (t) => gatePost(H, popup, t.x, t.z, GATE_POST_SCALE),
    tree: (t) => {
      const v = treeVariant(t.species, t.seed % VARIANTS_PER_KIND);
      return popup(v.pts, null, { x: t.x, z: t.z, cross: true, materials: v.mat, sway: t.species === 'yew' ? 0.2 : 0.5, scale: t.size, solid: 0.35 });
    },
    grave: (t) => {
      const v = plotPrints[t.variant % plotPrints.length];
      return popup(v.pts, null, { x: t.x, z: t.z, materials: v.mat, scale: t.size, solid: 0.45 });
    },
    'notable-grave': (t) => popup(...notableGrave(t.index, t.tall), { x: t.x, z: t.z, scale: TOY.notable, solid: 0.7 }),
    bench: (t) => popup(props.bench.pts, null, { x: t.x, z: t.z, materials: props.bench.mat, scale: TOY.prop, solid: 0.5 }),
    lamp: (t) => popup(props.lamp.pts, null, { x: t.x, z: t.z, materials: props.lamp.mat, scale: TOY.prop, solid: 0.2 }),
    tap: (t) => popup(...props.tap, { x: t.x, z: t.z, scale: TOY.prop, solid: 0.3 }),
    critter: (t) => {
      const squirrelling = t.species === 'squirrel';
      const h = popup(...(squirrelling ? squirrel() : crow()), { x: t.x, z: t.z, scale: TOY.critter * (squirrelling ? 1.1 : 1) });
      onCritter(h, squirrelling ? 'shy' : 'peck');
      return h;
    },
    block: (t) => apartmentBlock(H, popup, { id: t.buildingId, pts: t.pts, levels: t.levels }),
    playground: (t) => popup(kit[t.equipment].pts, null, { x: t.x, z: t.z, materials: kit[t.equipment].mat, scale: TOY.playground, solid: 1.0 }),
    'bike-rack': (t) => popup(rack.pts, null, { x: t.x, z: t.z, materials: rack.mat, scale: TOY.prop, solid: 0.6 }),
    church: (t) => church(H, popup, { id: t.landmarkId, pts: t.pts, tower: t.tower, name: t.name }),
    flag: (t) => popup(...flag(t.color), { x: t.x, z: t.z, scale: TOY.landmark * 0.8, yaw: 0.05, sway: 0.15 }),
    'corner-sign': (t) => popup(...cornerSign(t.names), { x: t.x, z: t.z, yaw: 0, solid: 0.15 }),
    fingerpost: (t) => popup(...fingerpost(t.arms.map((a) => ({ label: `${a.name} ${a.metres} m`, dx: a.dx }))), { x: t.x, z: t.z, yaw: 0, solid: 0.2 }),
  };

  return (things) => {
    const makers = new Map();
    for (const t of things) {
      const make = piece[t.kind];
      if (!make) { console.warn(`papercraft: no piece for kind "${t.kind}"`); continue; }
      makers.set(t.id, { x: t.x, z: t.z, node: CONSTRUCTIONS.has(t.kind), eager: t.kind === 'critter', make: () => make(t) });
    }
    return makers;
  };
}
