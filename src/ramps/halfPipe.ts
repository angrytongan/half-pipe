import * as THREE from "three";
import { centerFootprint } from "./util";
import { transitionAndDeckPoints } from "./transition";
import { extrudeRibs, ribZPositions, RIB_THICKNESS_MM } from "./ribs";
import { buildJoistBox, JOIST_DEPTH_MM, JOIST_THICKNESS_MM } from "./joists";
import { copingNotch } from "./coping";

/**
 * Which way a plywood sheet is laid relative to the ribs it skins: "length-ways" runs the
 * sheet's major (length) axis perpendicular to the ribs, so it must bend across its minor
 * (width) axis to follow the curve; "width-ways" runs the minor axis parallel to the ribs
 * instead, bending across the major axis. Plywood bends far more easily across the grain
 * than along it, so this determines whether a given sheet size can follow the transition
 * radius at all — not yet used by any geometry, controls-only for now.
 */
export type SkinGrainDirection = "length-ways" | "width-ways";

export interface HalfPipeParams {
  radius: number;
  transitionAngleDeg: number;
  vertHeight: number;
  deckLength: number;
  bottomTransitionLength: number;
  width: number;
  ribThicknessMm: number;
  internalRibCount: number;
  joistThicknessMm: number;
  joistDepthMm: number;
  internalCurveJoistCount: number;
  internalStudCount: number;
  copingIdMm: number;
  copingOdMm: number;
  copingHorizontalProtrusionMm: number;
  copingVerticalProtrusionMm: number;
  skinLayer1ThicknessMm: number;
  skinLayer2ThicknessMm: number;
  skinSheetLength: number;
  skinSheetWidth: number;
  skinGrainDirection: SkinGrainDirection;
}

export const HALF_PIPE_DEFAULTS: HalfPipeParams = {
  radius: 1.8,
  transitionAngleDeg: 57,
  vertHeight: 0,
  deckLength: 0.3,
  bottomTransitionLength: 2.25,
  width: 3,
  ribThicknessMm: RIB_THICKNESS_MM,
  internalRibCount: 1,
  joistThicknessMm: JOIST_THICKNESS_MM,
  joistDepthMm: JOIST_DEPTH_MM,
  internalCurveJoistCount: 8,
  internalStudCount: 3,
  copingIdMm: 50.8,
  copingOdMm: 60.3,
  copingHorizontalProtrusionMm: 3.2,
  copingVerticalProtrusionMm: 6.4,
  skinLayer1ThicknessMm: 12,
  skinLayer2ThicknessMm: 12,
  skinSheetLength: 2.4,
  skinSheetWidth: 1.2,
  skinGrainDirection: "length-ways",
};

/**
 * Two mirrored open profiles (left, right) — the curve/vert/deck portion of a rib — shared by
 * the solid wedge and each individual rib. Each sits on top of the bottom transition's own
 * framing (shifted up by the joist's major dimension, joistDepthMm — that's the height the
 * bottom transition is built to), and each ends at its own base: a rib stops at the *inside*
 * face of the bottommost curve joist (see buildHalfPipeJoists), not at that joist's centerline
 * (the curve's own tangent point) — otherwise the inner half of that joist's thickness would
 * have no rib sitting on it. It still doesn't bridge across to the other side — that gap is
 * buildBottomTransitionSlab's job, not the ribs'. The deck-side closing edge still drops to
 * true y=0 (see decisions.md: it's a rendering convenience, not a structural wall, so it's
 * unaffected by the framing above it). The deck/curve corner itself is cut back into the
 * coping notch (see coping.ts) instead of meeting at a sharp point.
 */
function halfPipeOutline(params: HalfPipeParams): THREE.Shape[] {
  const {
    radius,
    transitionAngleDeg,
    vertHeight,
    deckLength,
    bottomTransitionLength,
    ribThicknessMm,
    joistDepthMm,
    joistThicknessMm,
    copingOdMm,
    copingHorizontalProtrusionMm,
    copingVerticalProtrusionMm,
    skinLayer1ThicknessMm,
    skinLayer2ThicknessMm,
  } = params;
  const jointDepth = joistDepthMm / 1000;
  const half = bottomTransitionLength / 2;
  const joistThickness = joistThicknessMm / 1000;
  const points = transitionAndDeckPoints(radius, transitionAngleDeg, vertHeight, deckLength);
  const notch = copingNotch(
    points,
    radius,
    copingOdMm / 1000 / 2,
    copingHorizontalProtrusionMm / 1000,
    copingVerticalProtrusionMm / 1000,
    ribThicknessMm / 1000,
    (skinLayer1ThicknessMm + skinLayer2ThicknessMm) / 1000,
  );

  const mapWith = (mirrorX: (x: number) => number) => ([x, y]: [number, number]): [number, number] => [mirrorX(x), y + jointDepth];
  const left = points.map(mapWith((x) => -half - x));
  const right = points.map(mapWith((x) => half + x));

  const side = (profile: [number, number][], baseExtension: number, mirrorX: (x: number) => number): THREE.Shape => {
    const [tangentX, tangentY] = profile[0]; // bottom corner — the bottommost curve joist's centerline
    const baseX = tangentX + baseExtension; // that joist's inside face
    const outerX = profile[profile.length - 1][0]; // deck's outer edge
    const map = mapWith(mirrorX);
    const shape = new THREE.Shape();
    shape.moveTo(outerX, 0);
    shape.lineTo(...profile[profile.length - 1]); // deck's outer edge
    shape.lineTo(...map(notch.wallTop)); // deck runs to the notch wall, not all the way to the original corner
    shape.lineTo(...map(notch.wallBottom));
    shape.lineTo(...map(notch.shelfEnd));
    for (let i = notch.arcCutoffIndex; i >= 0; i--) shape.lineTo(...profile[i]);
    shape.lineTo(baseX, tangentY);
    shape.lineTo(baseX, 0);
    shape.closePath();
    return shape;
  };

  return [side(left, joistThickness / 2, (x) => -half - x), side(right, -joistThickness / 2, (x) => half + x)];
}

/**
 * Two mirrored transitions joined by a bottom transition, decks on both outer
 * edges — extruded across width. Closed outline, solid-wedge convention.
 * Centered on X/Z, base at Y=0. Geometry-only utility —
 * `buildHalfPipeRibs` below is what's actually rendered (see decisions.md).
 */
export function buildHalfPipeGeometry(params: HalfPipeParams): THREE.BufferGeometry {
  const geometry = new THREE.ExtrudeGeometry(halfPipeOutline(params), { depth: params.width, bevelEnabled: false });
  return centerFootprint(geometry);
}

/**
 * The rib/transom skeleton: one thin extrusion of the same cross-section per rib, evenly
 * spaced across width (see ribs.ts) instead of one full-width solid wedge.
 */
export function buildHalfPipeRibs(params: HalfPipeParams): THREE.BufferGeometry[] {
  const shape = halfPipeOutline(params);
  const ribThickness = params.ribThicknessMm / 1000;
  return extrudeRibs(shape, ribZPositions(params.width, params.internalRibCount, ribThickness), ribThickness);
}

/**
 * Same ribs as `buildHalfPipeRibs`, split into the two mandatory edge ribs (frame the deck
 * edges — still visible once skinned, since the skin wraps around them) and the
 * `internalRibCount`-driven seam ribs (buried inside the skin, hidden by the "Show skin"
 * toggle). `ribZPositions` always returns edge-then-internal-then-edge, so the first and last
 * entries are the edges and everything between is internal.
 */
export function buildHalfPipeRibsBySection(params: HalfPipeParams): { edgeRibs: THREE.BufferGeometry[]; internalRibs: THREE.BufferGeometry[] } {
  const shape = halfPipeOutline(params);
  const ribThickness = params.ribThicknessMm / 1000;
  const positions = ribZPositions(params.width, params.internalRibCount, ribThickness);
  return {
    edgeRibs: extrudeRibs(shape, [positions[0], positions[positions.length - 1]], ribThickness),
    internalRibs: extrudeRibs(shape, positions.slice(1, -1), ribThickness),
  };
}

/**
 * The bottom transition's own framing: a stud wall lying on the ground — not a rib, a
 * separate structural piece screwed to the curved transition sections (see research/design.md's
 * "Half-pipe as a special case of quarter-pipe": the bottom transition's framing is the one
 * piece a quarter-pipe alone doesn't have). Two plates run almost the full bottomTransitionLength
 * — inset by half the last curve joist's own thickness on each end (see buildHalfPipeJoists) so
 * they butt up against that joist's inner face instead of reaching into its midpoint — and are
 * positioned so their *outer* faces exactly meet the outside faces of the edge ribs, at
 * `±width/2` (see ribZPositions: edge ribs are inset so the whole structure fits within width,
 * with no overhang) — that's the wall's "height", lying flat instead of standing up.
 * `internalStudCount + 2` studs (two mandatory
 * end studs, same convention as internalRibCount) then span between the plates' *inside* faces,
 * evenly spaced along the (now shorter) plate length, inset so their outer faces sit flush with
 * the plate ends. Cross-section for both plates and studs reuses joistThicknessMm/joistDepthMm —
 * the same lumber dimensions as everywhere else in this model — so joistDepthMm alone still
 * determines the wall's thickness off the ground, unchanged from before this was split into
 * members.
 */
export function buildBottomTransitionFrame(params: HalfPipeParams): THREE.BufferGeometry[] {
  const { bottomTransitionLength, joistDepthMm, joistThicknessMm, width, internalStudCount } = params;
  const jointDepth = joistDepthMm / 1000;
  const thickness = joistThicknessMm / 1000;
  const outsideZ = width / 2; // the outside face of each edge rib

  const member = (spanZ: boolean, span: number, x: number, z: number): THREE.BufferGeometry => {
    const geometry = spanZ ? new THREE.BoxGeometry(thickness, jointDepth, span) : new THREE.BoxGeometry(span, jointDepth, thickness);
    geometry.translate(x, jointDepth / 2, z);
    return geometry;
  };

  // Inset by the last curve joist's own thickness so the plates butt up against it, not into it.
  const plateLength = bottomTransitionLength - thickness;
  const plates = [-1, 1].map((side) => member(false, plateLength, 0, side * (outsideZ - thickness / 2)));

  const insideZ = outsideZ - thickness; // the plates' inside faces
  const studCount = internalStudCount + 2;
  const studSpan = plateLength - thickness; // inset so the end studs' outer faces meet the (now shorter) plate ends
  const studs = Array.from({ length: studCount }, (_, i) => {
    const x = -studSpan / 2 + (studSpan * i) / (studCount - 1);
    return member(true, insideZ * 2, x, 0);
  });

  return [...plates, ...studs];
}

/**
 * Local-space anchor points (and each one's own tangent angle) for the `internalCurveJoistCount`
 * interior joists, spaced evenly by arc length between the bottom-most joist's own inside edge
 * and the topmost joist's own bottom edge — not their anchor points, which would over-count half
 * of each boundary joist's thickness at either end (see `buildHalfPipeJoists`). Converting that
 * thickness/2 tangential offset to an angle via arc length (Δt = distance / radius) is exact for
 * a circular arc. Shared with `halfPipeDimensions.ts`'s curve-joist-spacing dimension so it draws
 * from the same geometry instead of re-deriving this angle math.
 */
export function curveInteriorJoistLocalPoints(params: HalfPipeParams): { point: [number, number]; angle: number }[] {
  const {
    radius,
    transitionAngleDeg,
    vertHeight,
    deckLength,
    ribThicknessMm,
    joistThicknessMm,
    internalCurveJoistCount,
    copingOdMm,
    copingHorizontalProtrusionMm,
    copingVerticalProtrusionMm,
    skinLayer1ThicknessMm,
    skinLayer2ThicknessMm,
  } = params;
  const thickness = joistThicknessMm / 1000;
  const points = transitionAndDeckPoints(radius, transitionAngleDeg, vertHeight, deckLength);
  const notch = copingNotch(
    points,
    radius,
    copingOdMm / 1000 / 2,
    copingHorizontalProtrusionMm / 1000,
    copingVerticalProtrusionMm / 1000,
    ribThicknessMm / 1000,
    (skinLayer1ThicknessMm + skinLayer2ThicknessMm) / 1000,
  );
  const edgeAngle = thickness / 2 / radius;
  const curveStartAngle = edgeAngle;
  const curveEndAngle = notch.shelfAngle - edgeAngle;
  const curveSegments = internalCurveJoistCount + 1;
  return Array.from({ length: internalCurveJoistCount }, (_, i) => {
    const angle = curveStartAngle + ((curveEndAngle - curveStartAngle) * (i + 1)) / curveSegments;
    return { point: [radius * Math.sin(angle), radius * (1 - Math.cos(angle))] as [number, number], angle };
  });
}

/**
 * Joist/ledger skeleton: one joist per (profile landmark point) x (build-section bay).
 * Landmarks per side — bottom corner (curve tangent, where it meets the bottom transition),
 * `internalCurveJoistCount` interior points up the curve (the two ends, bottom corner and notch
 * shelf, are always present regardless of the slider — this count is strictly what's added
 * between them), spaced evenly by arc length between the bottom-most joist's own *inside edge*
 * and the topmost joist's own *bottom edge* — not their anchor points, which would over-count
 * half of each boundary joist's thickness at either end (see `curveInteriorJoistLocalPoints`
 * above) — the coping notch's own shelf point, and the end of the floor
 * section (deck's outer edge, the ramp's own outer edge — the
 * rib's outline terminates exactly there, with no inset, unlike the bottom-corner end), and a
 * ground-level joist directly beneath the deck-outer one — the rib's own 7th, closing side
 * (deck outer edge straight down to true ground, drawn purely to close the shape for extrusion,
 * see `halfPipeOutline` above) is otherwise unjoisted. Flat (angle 0) and ground-touching, same
 * `y = 0` to `jointDepth` span as the bottom-corner joist, just at the deck-outer end's X instead
 * of the curve's tangent X — and inset by the same `thickness / 2` the deck-outer joist itself
 * uses, so the two land exactly flush, one stacked on the other. A third ground-level joist sits
 * at the centerline midpoint (by X) between the bottom-corner and deck-outer-ground joists — the
 * rib's own ground-level base is a flat line the whole way between those two, so this one is
 * flat and uninset too, just centered rather than flush to an edge. A fourth deck-level joist
 * sits at the deck's *inner* edge, where `copingNotch`'s plumb wall cuts into it —
 * `notch.wallTop` is already the point where that cut meets the flat deck, so it's used
 * directly. Flat like the deck-outer joist, but inset the *opposite* way (outward, by
 * `thickness / 2`) since the deck material here starts at the wall and runs outward from it,
 * the mirror image of the deck-outer landmark's own edge — so it's this joist's notch-side face,
 * not its center, that butts flush against the wall. No
 * joist at the deck/curve corner itself (deck start) — tilted to the curve's own tangent there
 * (as steep as `transitionAngleDeg`) while anchored exactly where the flat deck begins, its top
 * face would rise above the deck surface on the deck side of its own centerline, physically
 * intersecting the deck it's supposed to sit under. The topmost curve joist is anchored at
 * `copingNotch`'s `shelfEnd`/`shelfAngle` instead (see coping.ts) — genuinely on the curve
 * (solved exactly, not approximated) at the height where the notch's own horizontal shelf cut
 * meets it. It's inset backward along its own tangent by half the joist thickness, the same
 * "flush face, not centered" convention the deck-outer inset below uses, so it's the joist's
 * *notch-side corner* — not its center — that lands exactly on shelfEnd: past that corner the
 * rib's been cut away into the notch, so a centered joist would have nothing to sit flush
 * against on that side. Sitting below/behind the corner, inside the notch, it can't rise above
 * the deck the way the old corner-anchored version did. No joist under the middle of the
 * bottom transition —
 * buildBottomTransitionFrame's own stud wall (top plate, bottom plate, two wall studs, optional
 * internal studs) covers that span instead. Section bays reuse ribZPositions's own output: its
 * doubled-seam ribs already pair up as (ribZs[0],ribZs[1]), (ribZs[2],ribZs[3]), ... one bay per
 * pair, so no separate bay-finding logic is needed — a joist only bridges a real section bay,
 * never the near-zero gap inside a doubled seam (those two ribs are already face-to-face and
 * screwed together directly).
 */
export function buildHalfPipeJoists(params: HalfPipeParams): THREE.BufferGeometry[] {
  const { curveJoists, deckJoists } = buildHalfPipeJoistsBySection(params);
  return [...curveJoists, ...deckJoists];
}

/**
 * Same joists as `buildHalfPipeJoists`, split by landmark instead of returned flat — curve
 * joists (bottom corner, `internalCurveJoistCount` interior points, notch-shelf) are the ones
 * under the curved/vert surface a skin would actually cover; deck joists (deck-outer, deck-inner
 * at the notch's plumb wall, ground-below-deck-outer, ground-midpoint) support the flat
 * deck/ground and stay put either way. Lets `main.ts` hide the former under the "Show skin"
 * toggle while leaving the latter visible.
 */
export function buildHalfPipeJoistsBySection(params: HalfPipeParams): { curveJoists: THREE.BufferGeometry[]; deckJoists: THREE.BufferGeometry[] } {
  const {
    radius,
    transitionAngleDeg,
    vertHeight,
    deckLength,
    bottomTransitionLength,
    width,
    internalRibCount,
    ribThicknessMm,
    joistThicknessMm,
    joistDepthMm,
    copingOdMm,
    copingHorizontalProtrusionMm,
    copingVerticalProtrusionMm,
    skinLayer1ThicknessMm,
    skinLayer2ThicknessMm,
  } = params;
  const half = bottomTransitionLength / 2;
  const jointDepth = joistDepthMm / 1000;
  const ribThickness = ribThicknessMm / 1000;
  const thickness = joistThicknessMm / 1000;
  const depth = joistDepthMm / 1000;

  const points = transitionAndDeckPoints(radius, transitionAngleDeg, vertHeight, deckLength);
  const deckOuter = points[points.length - 1];
  const notch = copingNotch(
    points,
    radius,
    copingOdMm / 1000 / 2,
    copingHorizontalProtrusionMm / 1000,
    copingVerticalProtrusionMm / 1000,
    ribThicknessMm / 1000,
    (skinLayer1ThicknessMm + skinLayer2ThicknessMm) / 1000,
  );

  const curveInterior = curveInteriorJoistLocalPoints(params);
  const curveInteriorPoints = curveInterior.map((p) => p.point);
  const curveInteriorAngles = curveInterior.map((p) => p.angle);

  // The shelf-point landmark is inset backward (downhill) along its own tangent by half the
  // joist's thickness, the same "flush face, not centered" convention the deck-outer inset
  // below uses — so its *notch-side* top corner, not its center, lands exactly on shelfEnd:
  // the point where the curve and the notch's own horizontal shelf cut meet. Past that corner
  // there's no rib material left for a centered joist to sit flush against — it's been cut
  // away into the notch.
  const shelfLocalPoint: [number, number] = [
    notch.shelfEnd[0] - (thickness / 2) * Math.cos(notch.shelfAngle),
    notch.shelfEnd[1] - (thickness / 2) * Math.sin(notch.shelfAngle),
  ];

  // Ground point directly beneath the deck-outer landmark — the rib outline's own 7th, closing
  // side (deck outer edge straight down to true ground) that `halfPipeOutline` draws purely to
  // close the shape for extrusion. Same local y=0 (ground) convention as the bottom corner.
  const deckGroundPoint: [number, number] = [deckOuter[0], 0];

  // Third ground joist, centered exactly halfway (by X, centerline to centerline — no edge
  // adjustment, unlike the curve-interior joists) between the bottom corner (local x=0) and the
  // deck-ground point above — the rib's whole ground-level base is a flat line between those
  // two, so no tilt is needed here either.
  const groundMidpoint: [number, number] = [deckOuter[0] / 2, 0];

  // Tangent angle at each landmark: flat at the bottom corner, rising through the curve, tilted
  // again at the notch's shelf point (all three "curve" — under the curved/vert surface), then
  // flat on the deck floor (0) — see transitionAndDeckPoints for why deckOuter's own point
  // differs from the curve's own endpoint (deck start, omitted) — and flat again at ground
  // level, both directly beneath it and at the midpoint between it and the bottom corner (all
  // three "deck" — under the flat deck/ground).
  const curveLocalPoints: [number, number][] = [[0, 0], ...curveInteriorPoints, shelfLocalPoint];
  const curveLocalAngles: number[] = [0, ...curveInteriorAngles, notch.shelfAngle];
  const curveInwardInset: number[] = [0, ...curveInteriorPoints.map(() => 0), 0];

  // The deck's inner edge, where the notch's plumb wall cuts into it — `notch.wallTop` is
  // already the point where that vertical cut meets the flat deck. Flat (angle 0) like every
  // other deck landmark, but inset *outward* (the opposite sign from deck-outer, below) by half
  // the joist's own thickness, so its face on the notch side — not its center — butts flush
  // against the wall instead of straddling it. The deck material itself starts at the wall and
  // runs outward from there (the notch cuts away everything on the curve side of it), the
  // mirror image of the deck-outer landmark's own edge convention.
  const deckInnerPoint: [number, number] = notch.wallTop;

  const deckLocalPoints: [number, number][] = [deckOuter, deckInnerPoint, deckGroundPoint, groundMidpoint];
  const deckLocalAngles: number[] = [0, 0, 0, 0];
  // The deck-outer landmark and the ground joist beneath it are both the ramp's own outer edge,
  // where the rib's outline ends flush (no inset) — so those two alone are inset inward by half
  // their own thickness, aligning their external face with the rib's edge instead of centering
  // the joist on it and sticking half its thickness out past where the rib actually ends. The
  // ground-midpoint landmark sits inside the rib's own material, so it's centered on its own
  // anchor with no inset. deckInnerPoint uses the opposite sign — see its own comment above.
  const deckInwardInset: number[] = [thickness / 2, -thickness / 2, thickness / 2, 0];

  const toWorldJoists = (localPoints: [number, number][], localAngles: number[], inwardInset: number[]): { x: number; y: number; angle: number }[] => [
    ...localPoints.map(([x, y], i) => ({ x: -half - x + inwardInset[i], y: y + jointDepth, angle: -localAngles[i] })),
    ...localPoints.map(([x, y], i) => ({ x: half + x - inwardInset[i], y: y + jointDepth, angle: localAngles[i] })),
  ];

  const ribZs = ribZPositions(width, internalRibCount, ribThickness);
  const buildJoistsAt = (worldJoists: { x: number; y: number; angle: number }[]): THREE.BufferGeometry[] => {
    const joists: THREE.BufferGeometry[] = [];
    for (let i = 0; i < ribZs.length; i += 2) {
      // ribZs are rib centerlines — the joist is built to butt against each rib's inside face,
      // not its centerline, so it spans the actual bay, not the centerline-to-centerline gap.
      const zStart = ribZs[i] + ribThickness / 2;
      const zEnd = ribZs[i + 1] - ribThickness / 2;
      for (const { x, y, angle } of worldJoists) {
        joists.push(buildJoistBox(zStart, zEnd, x, y, thickness, depth, angle));
      }
    }
    return joists;
  };

  return {
    curveJoists: buildJoistsAt(toWorldJoists(curveLocalPoints, curveLocalAngles, curveInwardInset)),
    deckJoists: buildJoistsAt(toWorldJoists(deckLocalPoints, deckLocalAngles, deckInwardInset)),
  };
}

/**
 * The deck itself — one flat board per side, the same material as the ribs (`ribThicknessMm`).
 * Runs in X from the notch's vertical wall (`notch.wallTop`, the same point the deck-inner
 * joist anchors to — see `buildHalfPipeJoistsBySection`) out to the rib's own outer edge
 * (`deckOuter`, the ramp's rear). Spans the full `width` in Z — flush with the edge ribs'
 * *outer* faces, so it sits over them (unlike a joist, which insets to their *inside* faces and
 * stops between them). Sits on top of the deck joists: its bottom face is flush with their top
 * face (the rib's own drawn deck line), extending upward by its own thickness — so its top
 * surface ends up `ribThicknessMm` above that line, since the line itself is only a stand-in for
 * the finished surface height and hasn't been repositioned yet (see features.md).
 */
export function buildHalfPipeDeck(params: HalfPipeParams): THREE.BufferGeometry[] {
  const {
    radius,
    transitionAngleDeg,
    vertHeight,
    deckLength,
    bottomTransitionLength,
    width,
    ribThicknessMm,
    joistDepthMm,
    copingOdMm,
    copingHorizontalProtrusionMm,
    copingVerticalProtrusionMm,
    skinLayer1ThicknessMm,
    skinLayer2ThicknessMm,
  } = params;
  const half = bottomTransitionLength / 2;
  const jointDepth = joistDepthMm / 1000;
  const ribThickness = ribThicknessMm / 1000;

  const points = transitionAndDeckPoints(radius, transitionAngleDeg, vertHeight, deckLength);
  const deckOuter = points[points.length - 1];
  const notch = copingNotch(
    points,
    radius,
    copingOdMm / 1000 / 2,
    copingHorizontalProtrusionMm / 1000,
    copingVerticalProtrusionMm / 1000,
    ribThicknessMm / 1000,
    (skinLayer1ThicknessMm + skinLayer2ThicknessMm) / 1000,
  );
  const [wallX] = notch.wallTop;
  const deckTopOfJoistsY = deckOuter[1] + jointDepth; // the deck joists' own top face / the rib's own drawn deck line

  const board = (mirrorX: (x: number) => number): THREE.BufferGeometry => {
    const xStart = mirrorX(wallX);
    const xEnd = mirrorX(deckOuter[0]);
    const geometry = new THREE.BoxGeometry(Math.abs(xEnd - xStart), ribThickness, width);
    geometry.translate((xStart + xEnd) / 2, deckTopOfJoistsY + ribThickness / 2, 0);
    return geometry;
  };

  return [board((x) => -half - x), board((x) => half + x)];
}

/**
 * Coping pipe centers (in the returned geometry's centered coordinate space), both sides —
 * the lip where each transition meets its deck, i.e. the curve side, not the decks'
 * outer/back edges. Positioned by the same notch math that cuts the rib (see coping.ts), not
 * just the deck/curve corner itself, since the pipe sits recessed into that notch rather than
 * resting exactly on the corner. The outline is symmetric about local x=0 by construction
 * (left/right are mirrored), so centering is a no-op here.
 */
export function halfPipeCopingCenters(params: HalfPipeParams): { x: number; y: number }[] {
  const {
    radius,
    transitionAngleDeg,
    vertHeight,
    deckLength,
    bottomTransitionLength,
    ribThicknessMm,
    joistDepthMm,
    copingOdMm,
    copingHorizontalProtrusionMm,
    copingVerticalProtrusionMm,
    skinLayer1ThicknessMm,
    skinLayer2ThicknessMm,
  } = params;
  const half = bottomTransitionLength / 2;
  const jointDepth = joistDepthMm / 1000;
  const points = transitionAndDeckPoints(radius, transitionAngleDeg, vertHeight, deckLength);
  const notch = copingNotch(
    points,
    radius,
    copingOdMm / 1000 / 2,
    copingHorizontalProtrusionMm / 1000,
    copingVerticalProtrusionMm / 1000,
    ribThicknessMm / 1000,
    (skinLayer1ThicknessMm + skinLayer2ThicknessMm) / 1000,
  );
  const [cx, cy] = notch.pipeCenter;
  const y = cy + jointDepth;
  return [
    { x: -(half + cx), y },
    { x: half + cx, y },
  ];
}

/**
 * Footprint this ramp actually needs — length (X), width (Z), height (Y) —
 * computed analytically from the same transitionAndDeckPoints used to build
 * the geometry, so it can't drift from what's actually rendered. Cheap
 * enough to call on every param change for space-constraint validation
 * without building a BufferGeometry just to measure it. Width is the raw
 * width param directly — the edge ribs are inset (see ribZPositions) so
 * the whole assembled structure fits exactly within width, with no
 * overhang past it.
 */
export function halfPipeFootprint(params: HalfPipeParams): { length: number; width: number; height: number } {
  const { radius, transitionAngleDeg, vertHeight, deckLength, bottomTransitionLength, width, joistDepthMm } = params;
  const points = transitionAndDeckPoints(radius, transitionAngleDeg, vertHeight, deckLength);
  const [deckOuterX, deckOuterY] = points[points.length - 1];
  return {
    length: bottomTransitionLength + 2 * deckOuterX,
    width,
    height: deckOuterY + joistDepthMm / 1000,
  };
}
