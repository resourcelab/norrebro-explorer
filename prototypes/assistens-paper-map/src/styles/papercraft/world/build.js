/**
 * Paper pieces for the game's things (core/world.js). createMakers gives, for every thing, a maker: a function that
 * builds its paper piece(s) when the presenter first needs them. Prints shared by many pieces (tree variants, grave
 * plots, benches, lamps, playground kit) are made once, up front.
 */
import * as P2 from 'papercraft/lib/paperkit-2d.js';
import { TOY, SCALE } from '../../../config.js';
import { PALETTE as C, scaleOf, WALL_HEIGHT, HEDGE_HEIGHT, GATE_POST_SCALE } from '../settings.js';
import { createTreePrints, VARIANTS_PER_KIND } from '../pieces/trees.js';
import { createPlotPrints, notableGrave } from '../pieces/graves.js';
import { wallPaint, lidPaint, hedgePaint, placeRun, gatePost } from '../pieces/walls.js';
import { chapelFold } from '../pieces/chapel.js';
import { createPropPrints, shed } from '../pieces/props.js';
import { crow, squirrel } from '../pieces/critters.js';
import { apartmentBlock } from '../pieces/buildings.js';
import { PLAYGROUND } from '../pieces/playground.js';
import { DRAWS } from '../kinds.js';
import { bikeRack } from '../pieces/street.js';
import { church, flag, fingerpost } from '../pieces/landmarks.js';
import { cornerSign } from '../pieces/signs.js';
import { shopfront, onFoldedFacade } from '../pieces/shopfront.js';
import { MORE_PLAYGROUND, SPORT, flagpole, trafficLight, busStop, crossingSign, bin, picnicTable, fencePaint } from '../pieces/kids.js';
import { printOnce } from './popup.js';

const WALL = { h: WALL_HEIGHT, t: 0.5 };
const HEDGE = { h: HEDGE_HEIGHT, t: 0.6 };
const S = Object.fromEntries(['bench', 'bikeRack', 'tap', 'lamp', 'sign', 'fingerpost', 'grave', 'notableGrave', 'playground', 'critter', 'tree', 'shed', 'chapel',
  'goal', 'hoop', 'table', 'ramp', 'flagpole', 'trafficLight', 'busStop', 'crossingSign', 'bin', 'picnic'].map((k) => [k, scaleOf(k)]));
/** Fences, hedges and walls round playgrounds and yards: true height (units) and thickness. */
const YARD = { fence: { h: TOY.heights.fence * SCALE, t: 0.08 }, hedge: { h: TOY.heights.yardHedge * SCALE, t: 0.3 }, wall: { h: TOY.heights.yardWall * SCALE, t: 0.2 } };
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
  const kit = Object.fromEntries(Object.entries({ ...PLAYGROUND, ...MORE_PLAYGROUND }).map(([kind, make]) => [kind, printOnce(H, make())]));
  const sport = Object.fromEntries(Object.entries(SPORT).map(([kind, make]) => [kind, printOnce(H, make())]));
  const shared = Object.fromEntries(Object.entries({ flagpole, trafficLight, busStop, crossingSign, bin, picnicTable }).map(([k, make]) => [k, printOnce(H, make())]));
  const stand = (p, t, scale, yaw = t.yaw ?? 0) => popup(p.pts, null, { x: t.x, z: t.z, materials: p.mat, scale, yaw });
  const rack = printOnce(H, bikeRack());
  const wallLid = lidPaint(P2.shade(C.wall, -0.08));

  const piece = {
    chapel: (t) => popup(null, null, { node: chapelFold(H), height: 6.2, x: t.x, z: t.z, yaw: t.yaw, level: true, solid: 3.2, scale: S.chapel }),
    shed: (t) => shed(H, popup, t.pts, S.shed),
    wall: (t) => (t.wall === 'hedge'
      ? placeRun(H, popup, [t.a, t.b], { h: HEDGE.h, t: HEDGE.t, wall: hedgePaint, lid: hedgePaint })
      : placeRun(H, popup, [t.a, t.b], { h: WALL.h, t: WALL.t, wall: wallPaint, lid: wallLid })),
    'gate-post': (t) => gatePost(H, popup, t.x, t.z, GATE_POST_SCALE),
    tree: (t) => {
      const v = treeVariant(t.species, t.seed % VARIANTS_PER_KIND);
      return popup(v.pts, null, { x: t.x, z: t.z, cross: true, materials: v.mat, sway: t.species === 'yew' ? 0.2 : 0.5, scale: S.tree * t.size, solid: 0.35 });
    },
    grave: (t) => {
      const v = plotPrints[t.variant % plotPrints.length];
      return popup(v.pts, null, { x: t.x, z: t.z, materials: v.mat, scale: S.grave * t.size, solid: 0.45 });
    },
    'notable-grave': (t) => popup(...notableGrave(t.index, t.tall), { x: t.x, z: t.z, scale: S.notableGrave, solid: 0.7 }),
    bench: (t) => popup(props.bench.pts, null, { x: t.x, z: t.z, materials: props.bench.mat, scale: S.bench, yaw: t.yaw ?? 0, solid: 0.5 }),
    lamp: (t) => popup(props.lamp.pts, null, { x: t.x, z: t.z, materials: props.lamp.mat, scale: S.lamp, solid: 0.2 }),
    tap: (t) => popup(...props.tap, { x: t.x, z: t.z, scale: S.tap, solid: 0.3 }),
    critter: (t) => {
      const squirrelling = t.species === 'squirrel';
      const h = popup(...(squirrelling ? squirrel() : crow()), { x: t.x, z: t.z, scale: S.critter * (squirrelling ? 1.1 : 1) });
      onCritter(h, squirrelling ? 'shy' : 'peck');
      return h;
    },
    block: (t) => apartmentBlock(H, popup, { id: t.buildingId, pts: t.pts, levels: t.levels }),
    playground: (t) => stand(kit[t.equipment] ?? kit.climber, t, S.playground),
    'sport-kit': (t) => stand(sport[t.equipment], t, S[t.equipment]),
    flagpole: (t) => stand(shared.flagpole, t, S.flagpole, 0.3),
    'traffic-light': (t) => stand(shared.trafficLight, t, S.trafficLight, 0),
    'bus-stop': (t) => stand(shared.busStop, t, S.busStop),
    bin: (t) => stand(shared.bin, t, S.bin, 0),
    'picnic-table': (t) => stand(shared.picnicTable, t, S.picnic),
    // a crossing is paint, printed on the ground (ground-neighbourhood.js); without lights it gets a blue sign at the kerb
    crossing: (t) => (t.signals ? null : stand(shared.crossingSign, {
      x: t.x + Math.cos(t.angle) * (t.length / 2 + 0.3), z: t.z + Math.sin(t.angle) * (t.length / 2 + 0.3),
    }, S.crossingSign, 0)),
    fence: (t) => { const y = YARD[t.style] ?? YARD.fence; return placeRun(H, popup, [t.a, t.b], { h: y.h, t: y.t, wall: t.style === 'hedge' ? hedgePaint : fencePaint(t.style), lid: t.style === 'hedge' ? hedgePaint : fencePaint(t.style) }); },
    'bike-rack': (t) => popup(rack.pts, null, { x: t.x, z: t.z, materials: rack.mat, scale: S.bikeRack, yaw: t.yaw ?? 0, solid: 0.6 }),
    church: (t) => church(H, popup, { id: t.landmarkId, pts: t.pts, tower: t.tower, name: t.name }),
    flag: (t) => popup(...flag(t.color), { x: t.x, z: t.z, scale: TOY.landmark * 0.8, yaw: 0.05, sway: 0.15 }),
    'corner-sign': (t) => popup(...cornerSign(t.names), { x: t.x, z: t.z, yaw: 0, scale: S.sign, solid: 0.15 }),
    shopfront: (t) => {
      const at = onFoldedFacade(t);
      return popup(...shopfront(t), { x: at.x, z: at.z, yaw: at.yaw });
    },
    fingerpost: (t) => popup(...fingerpost(t.arms.map((a) => ({ label: `${a.name} ${a.metres} m`, dx: a.dx }))), { x: t.x, z: t.z, yaw: 0, scale: S.fingerpost, solid: 0.2 }),
  };

  // a kind with no piece of its own is drawn by its category (core/kinds.js): a block if it has a footprint, a tree,
  // or a small coloured flag on a post for everything else
  const MARKER = { landmark: '#c4523a', barrier: '#d9a94a', monument: '#8c877d', prop: '#5a6470', animal: '#2f2d2e', sign: '#2e241c', place: '#d6452f', building: '#c9a283' };
  const byCategory = (t) => {
    if (t.category === 'building' && t.pts) return piece.block({ ...t, buildingId: t.id });
    if (t.category === 'tree') return piece.tree({ species: 'linden', seed: 1, size: 1, ...t });
    return popup(...flag(MARKER[t.category] ?? '#2e241c'), { x: t.x, z: t.z, scale: S.sign * 0.5, yaw: 0.05 });
  };
  for (const k of Object.keys(piece)) if (!DRAWS.has(k)) console.warn(`papercraft: piece "${k}" is missing from kinds.js`);

  return (things) => {
    const makers = new Map();
    for (const t of things) {
      const make = piece[t.kind] ?? byCategory;
      makers.set(t.id, { kind: t.kind, x: t.x, z: t.z, node: CONSTRUCTIONS.has(t.kind), eager: t.kind === 'critter', make: () => make(t) });
    }
    return makers;
  };
}
