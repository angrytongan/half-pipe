import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  buildBottomTransitionFrame,
  buildHalfPipeJoists,
  buildHalfPipeRibs,
  HALF_PIPE_DEFAULTS,
  halfPipeCopingCenters,
  halfPipeFootprint,
  type HalfPipeParams,
} from "./ramps/halfPipe";
import { buildHalfPipeDimensions, type HalfPipeDimension } from "./dimensions/halfPipeDimensions";

// Quarter-pipe is temporarily out of the UI while the half-pipe gets the space-constraint
// treatment (stage 1) and structural rendering (stage 2) — src/ramps/quarterPipe.ts is
// untouched and ready to rejoin once it shares the same model (stage 3).
type RampType = "halfPipe";

interface Footprint {
  length: number;
  width: number;
  height: number;
}

interface SliderSpec {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
}

interface RampSpec<P> {
  defaults: P;
  ribSliders: SliderSpec[];
  joistSliders: SliderSpec[];
  bottomTransitionSliders: SliderSpec[];
  rampSliders: SliderSpec[];
  copingSliders: SliderSpec[];
  buildRibs: (params: P) => THREE.BufferGeometry[];
  // Joist/ledger boxes — optional since a ramp type without any bays to bridge would have
  // nothing to build here.
  buildJoists?: (params: P) => THREE.BufferGeometry[];
  // The bottom transition's own framing (a stud wall lying on the ground) — optional since a
  // ramp type without one (e.g. quarter-pipe, once it rejoins) has nothing to build here.
  buildBottomTransitionFrame?: (params: P) => THREE.BufferGeometry[];
  // Centers (in the built geometry's own centered coordinate space) of the coping tubes —
  // the curve/deck lip, not the deck's outer edge. See decisions.md.
  copingCenters: (params: P) => { x: number; y: number }[];
  // Footprint this ramp actually needs, for the available-space validation below.
  footprint: (params: P) => Footprint;
  // CAD-style dimension lines (height, length, bottom transition length, rib spacing) —
  // optional since not every ramp type needs to define these yet.
  buildDimensions?: (params: P) => HalfPipeDimension[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const RAMPS: Record<RampType, RampSpec<any>> = {
  halfPipe: {
    defaults: HALF_PIPE_DEFAULTS,
    ribSliders: [
      { key: "ribThicknessMm", label: "Rib thickness (mm)", min: 10, max: 40, step: 1 },
      { key: "internalRibCount", label: "Internal ribs", min: 0, max: 10, step: 1 },
    ],
    joistSliders: [
      { key: "joistThicknessMm", label: "Joist thickness (mm)", min: 20, max: 70, step: 1 },
      { key: "joistDepthMm", label: "Joist depth (mm)", min: 45, max: 190, step: 1 },
    ],
    bottomTransitionSliders: [
      { key: "bottomTransitionLength", label: "Bottom transition length (m)", min: 1, max: 8, step: 0.25 },
      { key: "internalStudCount", label: "Internal studs", min: 0, max: 20, step: 1 },
    ],
    copingSliders: [
      { key: "copingOdMm", label: "Pipe outside diameter (mm)", min: 30, max: 100, step: 0.1 },
      { key: "copingIdMm", label: "Pipe inside diameter (mm)", min: 20, max: 90, step: 0.1 },
      { key: "copingHorizontalProtrusionMm", label: "Horizontal protrusion (mm)", min: 0, max: 15, step: 0.1 },
      { key: "copingVerticalProtrusionMm", label: "Vertical protrusion (mm)", min: 0, max: 15, step: 0.1 },
    ],
    rampSliders: [
      { key: "radius", label: "Transition radius (m)", min: 1, max: 4, step: 0.1 },
      { key: "transitionAngleDeg", label: "Transition angle (°)", min: 45, max: 90, step: 1 },
      { key: "vertHeight", label: "Vert extension (m)", min: 0, max: 1, step: 0.05 },
      { key: "deckLength", label: "Deck length (m)", min: 0.3, max: 1.5, step: 0.1 },
      { key: "width", label: "Width (m)", min: 1, max: 4, step: 0.1 },
    ],
    buildRibs: (p: HalfPipeParams) => buildHalfPipeRibs(p),
    buildJoists: (p: HalfPipeParams) => buildHalfPipeJoists(p),
    buildBottomTransitionFrame: (p: HalfPipeParams) => buildBottomTransitionFrame(p),
    copingCenters: (p: HalfPipeParams) => halfPipeCopingCenters(p),
    footprint: (p: HalfPipeParams) => halfPipeFootprint(p),
    buildDimensions: (p: HalfPipeParams) => buildHalfPipeDimensions(p),
  },
};

const AVAILABLE_SPACE_SLIDERS: SliderSpec[] = [
  { key: "length", label: "Available length (m)", min: 3, max: 15, step: 0.5 },
  { key: "width", label: "Available width (m)", min: 1, max: 6, step: 0.25 },
  { key: "height", label: "Available height (m)", min: 1, max: 4, step: 0.1 },
];

// Fits HALF_PIPE_DEFAULTS's footprint (~5.57m / 3m / 0.99m) with length/height to spare.
// Untyped as Footprint (unlike a ramp's computed footprint) since it's edited as loose
// slider state via renderSliderList, the same way currentParams is.
const availableSpace: Record<string, number> = { length: 6, width: 3, height: 2 };

const viewport = document.getElementById("viewport")!;
const typeSelect = document.getElementById("type-select") as HTMLSelectElement;
const spaceSlidersEl = document.getElementById("space-sliders")!;
const spaceStatusEl = document.getElementById("space-status")!;
const ribSlidersEl = document.getElementById("rib-sliders")!;
const joistSlidersEl = document.getElementById("joist-sliders")!;
const bottomTransitionSlidersEl = document.getElementById("bottom-transition-sliders")!;
const copingSlidersEl = document.getElementById("coping-sliders")!;
const rampSlidersEl = document.getElementById("ramp-sliders")!;
const resetBtn = document.getElementById("reset-btn")!;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xdfe9f0);

const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
camera.position.set(6, 4, 7);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.shadowMap.enabled = true;
viewport.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.6, 0);
controls.zoomToCursor = true;
// SketchUp's mapping: middle-drag orbits, shift+middle-drag pans, scroll zooms. Left also
// orbits (shift+left pans the same way) since most trackpads have no easy middle-click — right
// free for future tools (e.g. selection) instead of doubling as camera navigation. Rotate
// itself is handled by our own pointer listeners below, not OrbitControls (see comment there
// for why) — enableRotate stays false so OrbitControls leaves plain left/middle drags alone,
// but shift+drag still pans, since MOUSE.PAN's modifier check doesn't look at enableRotate.
controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.ROTATE, RIGHT: null };
controls.enableRotate = false;

const ambient = new THREE.AmbientLight(0xffffff, 0.6);
const sun = new THREE.DirectionalLight(0xffffff, 1.4);
sun.position.set(-6, 8, 4);
sun.castShadow = true;
scene.add(ambient, sun);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(30, 30),
  new THREE.MeshStandardMaterial({ color: 0x6b8f5a, flatShading: true }),
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const material = new THREE.MeshStandardMaterial({
  color: 0x4f7fc9,
  flatShading: true,
  side: THREE.DoubleSide, // ponytail: sidesteps verifying triangle winding on the hand-built ramp outlines
});
const rampGroup = new THREE.Group();
scene.add(rampGroup);

const joistMaterial = new THREE.MeshStandardMaterial({ color: 0xc9a876, flatShading: true }); // wood-toned, distinct from the ribs
const joistGroup = new THREE.Group();
scene.add(joistGroup);

const bottomTransitionGroup = new THREE.Group(); // same lumber as the joists, so reuses joistMaterial
scene.add(bottomTransitionGroup);

const copingMaterial = new THREE.MeshStandardMaterial({ color: 0x999999, metalness: 0.6, roughness: 0.4 });
const copingGroup = new THREE.Group();
scene.add(copingGroup);

// SketchUp-style orbit: pivot around whatever's under the cursor when a rotate drag starts,
// not a fixed target. This is NOT built on spherical-coords-relative-to-pivot + lookAt(pivot)
// (an earlier version was, and still snapped): lookAt forces the camera to face the pivot
// *exactly*, for any rotation angle including ~0 — so the first pointermove of a *new* drag,
// whose pivot is generally different from wherever the camera was previously facing, causes an
// instant reorientation jump no matter how small the actual mouse movement is (confirmed
// numerically: a 1px drag produced a jump of ~10% of screen height). Instead, each drag step
// is a true rigid rotation — camera.position AND camera.quaternion are rotated by the *same*
// small quaternion around the fixed pivot — which is the identity at zero rotation and stays
// continuous as the pivot changes between drags, since it never forces a fresh "face this
// exact point" reorientation. controls.target is then re-derived from the camera's resulting
// facing direction (not set to the pivot) so OrbitControls' own update() — which unconditionally
// calls camera.lookAt(target) every frame — finds target already exactly where the camera is
// looking and doesn't undo any of this on the next render. Pan (shift+drag) and zoom (scroll)
// stay on OrbitControls, unaffected — only plain-drag rotation is replaced (see
// controls.enableRotate above).
const raycaster = new THREE.Raycaster();
const pointerNDC = new THREE.Vector2();
const orbitTargets = [ground, rampGroup, joistGroup, bottomTransitionGroup, copingGroup];
const WORLD_UP = new THREE.Vector3(0, 1, 0);
let orbitPointerId: number | null = null;
let orbitPivot: THREE.Vector3 | null = null;
let lastPointerX = 0;
let lastPointerY = 0;

/** Rotates the camera's position and orientation together, by the same angle around axis, through pivot. */
function rotateCameraAroundPivot(pivot: THREE.Vector3, axis: THREE.Vector3, angle: number): void {
  if (angle === 0) return;
  const rotation = new THREE.Quaternion().setFromAxisAngle(axis, angle);
  const offset = camera.position.clone().sub(pivot).applyQuaternion(rotation);
  camera.position.copy(pivot).add(offset);
  camera.quaternion.premultiply(rotation);
}

renderer.domElement.addEventListener("pointerdown", (event) => {
  if ((event.button !== 0 && event.button !== 1) || event.shiftKey) return;
  event.preventDefault();

  const rect = renderer.domElement.getBoundingClientRect();
  pointerNDC.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointerNDC.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointerNDC, camera);
  const hit = raycaster.intersectObjects(orbitTargets, true)[0];

  orbitPivot = hit ? hit.point.clone() : controls.target.clone(); // no hit: keep the current pivot
  orbitPointerId = event.pointerId;
  lastPointerX = event.clientX;
  lastPointerY = event.clientY;
  renderer.domElement.setPointerCapture(event.pointerId);
});

renderer.domElement.addEventListener("pointermove", (event) => {
  if (orbitPointerId !== event.pointerId || !orbitPivot) return;

  const deltaX = event.clientX - lastPointerX;
  const deltaY = event.clientY - lastPointerY;
  lastPointerX = event.clientX;
  lastPointerY = event.clientY;
  if (deltaX === 0 && deltaY === 0) return;

  // Same formula as OrbitControls' own _handleMouseMoveRotate/_rotateLeft/_rotateUp — height
  // for both axes is intentional there too, so rotation speed doesn't distort with aspect ratio.
  const height = renderer.domElement.clientHeight;
  const azimuthAngle = -(2 * Math.PI * deltaX * controls.rotateSpeed) / height;
  const elevationAngle = -(2 * Math.PI * deltaY * controls.rotateSpeed) / height;

  const targetDistance = camera.position.distanceTo(controls.target);

  rotateCameraAroundPivot(orbitPivot, WORLD_UP, azimuthAngle); // never introduces roll
  const rightAxis = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion).normalize();
  rotateCameraAroundPivot(orbitPivot, rightAxis, elevationAngle); // pitch around the (now-updated) local right axis

  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  controls.target.copy(camera.position).addScaledVector(forward, targetDistance);
});

function endOrbit(event: PointerEvent): void {
  if (orbitPointerId !== event.pointerId) return;
  orbitPointerId = null;
  orbitPivot = null;
}
renderer.domElement.addEventListener("pointerup", endOrbit);
renderer.domElement.addEventListener("pointercancel", endOrbit);

/** A hollow tube (outer=odMm, inner=idMm), its length running along local Z, centered on all three axes. */
function buildCopingTubeGeometry(idMm: number, odMm: number, spanWidth: number): THREE.BufferGeometry {
  const outerRadius = odMm / 1000 / 2;
  const innerRadius = idMm / 1000 / 2;
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outerRadius, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, innerRadius, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: spanWidth, bevelEnabled: false, curveSegments: 32 });
  geometry.translate(0, 0, -spanWidth / 2);
  return geometry;
}

function rebuildCoping(type: RampType, params: HalfPipeParams, width: number): void {
  for (const child of copingGroup.children) {
    if (child instanceof THREE.Mesh) child.geometry.dispose();
  }
  copingGroup.clear();

  const geometry = buildCopingTubeGeometry(params.copingIdMm, params.copingOdMm, width);
  for (const { x, y } of RAMPS[type].copingCenters(params)) {
    const tube = new THREE.Mesh(geometry, copingMaterial);
    tube.position.set(x, y, 0);
    tube.castShadow = true;
    copingGroup.add(tube);
  }
}

const dimensionsGroup = new THREE.Group();
dimensionsGroup.position.y = 0.01; // lifted off the ground plane to avoid z-fighting with it
scene.add(dimensionsGroup);

const LABEL_FONT_PX = 48;
const LABEL_WORLD_HEIGHT = 0.25; // meters

/** A camera-facing text billboard drawn on a canvas texture — always in-scene, redrawn every frame with the rest of the WebGL canvas, so there's no separate DOM overlay that can get out of sync. */
function createLabelSprite(text: string): THREE.Sprite {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  ctx.font = `${LABEL_FONT_PX}px sans-serif`;
  const paddingX = 16;
  canvas.width = ctx.measureText(text).width + paddingX * 2;
  canvas.height = LABEL_FONT_PX * 1.4;

  ctx.font = `${LABEL_FONT_PX}px sans-serif`; // reset after resize, which clears context state
  ctx.fillStyle = "#ffffffcc";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#222222";
  ctx.textBaseline = "middle";
  ctx.fillText(text, paddingX, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false }));
  sprite.scale.set((LABEL_WORLD_HEIGHT * canvas.width) / canvas.height, LABEL_WORLD_HEIGHT, 1);
  return sprite;
}

// Explicit disposer over exactly what the last rebuild created.
let disposeDimensions: (() => void) | null = null;

function rebuildDimensions(type: RampType, params: unknown): void {
  disposeDimensions?.();
  disposeDimensions = null;

  const build = RAMPS[type].buildDimensions;
  if (!build) return;

  const groups: THREE.Group[] = [];
  const sprites: THREE.Sprite[] = [];
  for (const dim of build(params)) {
    dimensionsGroup.add(dim.group);
    groups.push(dim.group);

    const sprite = createLabelSprite(dim.text);
    sprite.position.copy(dim.labelPosition);
    dimensionsGroup.add(sprite);
    sprites.push(sprite);
  }

  disposeDimensions = () => {
    for (const group of groups) {
      // Only the plain Line geometries we build ourselves — not ArrowHelper's internal
      // line/cone, which Three.js shares as static geometry across every ArrowHelper
      // instance, so disposing it here would break arrows everywhere.
      for (const child of group.children) {
        if (child instanceof THREE.Line) child.geometry.dispose();
      }
      dimensionsGroup.remove(group);
    }
    for (const sprite of sprites) {
      sprite.material.map?.dispose();
      sprite.material.dispose();
      dimensionsGroup.remove(sprite);
    }
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let currentParams: any = { ...RAMPS.halfPipe.defaults };

const SPACE_AXES: { key: keyof Footprint; label: string }[] = [
  { key: "length", label: "Length" },
  { key: "width", label: "Width" },
  { key: "height", label: "Height" },
];

// Rounded to the same cm precision shown in the badge before comparing, so a required/
// available pair that displays identically (e.g. both "1.30m") never reads as "exceeded" —
// matters here since real values can differ by a few sub-cm mm without display showing it.
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function renderSpaceStatus(type: RampType): void {
  const required = RAMPS[type].footprint(currentParams);
  spaceStatusEl.innerHTML = SPACE_AXES.map(({ key, label }) => {
    const req = round2(required[key]);
    const avail = round2(availableSpace[key]);
    const fits = req <= avail;
    const detail = fits ? `${req.toFixed(2)}m / ${avail.toFixed(2)}m` : `${req.toFixed(2)}m / ${avail.toFixed(2)}m — over by ${(req - avail).toFixed(2)}m`;
    return `<div class="space-status ${fits ? "safe" : "unsafe"}">${label}: ${detail}</div>`;
  }).join("");
}

function rebuildRamp(type: RampType): void {
  for (const child of rampGroup.children) {
    if (child instanceof THREE.Mesh) child.geometry.dispose();
  }
  rampGroup.clear();
  for (const geometry of RAMPS[type].buildRibs(currentParams)) {
    const rib = new THREE.Mesh(geometry, material);
    rib.castShadow = true;
    rampGroup.add(rib);
  }

  for (const child of joistGroup.children) {
    if (child instanceof THREE.Mesh) child.geometry.dispose();
  }
  joistGroup.clear();
  for (const geometry of RAMPS[type].buildJoists?.(currentParams) ?? []) {
    const joist = new THREE.Mesh(geometry, joistMaterial);
    joist.castShadow = true;
    joistGroup.add(joist);
  }

  for (const child of bottomTransitionGroup.children) {
    if (child instanceof THREE.Mesh) child.geometry.dispose();
  }
  bottomTransitionGroup.clear();
  for (const geometry of RAMPS[type].buildBottomTransitionFrame?.(currentParams) ?? []) {
    const member = new THREE.Mesh(geometry, joistMaterial);
    member.castShadow = true;
    bottomTransitionGroup.add(member);
  }

  rebuildCoping(type, currentParams, currentParams.width);
  rebuildDimensions(type, currentParams);
  renderSpaceStatus(type);
}

/** Builds slider rows into container from specs, reading/writing into state, calling onChange after each edit — shared by the per-type ramp param sliders and the available-space sliders. */
function renderSliderList(container: HTMLElement, specs: SliderSpec[], state: Record<string, number>, onChange: () => void): void {
  container.innerHTML = "";
  for (const spec of specs) {
    const row = document.createElement("div");
    row.className = "slider-row";

    const label = document.createElement("label");
    const valueSpan = document.createElement("span");
    valueSpan.textContent = String(state[spec.key]);
    label.append(spec.label, valueSpan);

    const input = document.createElement("input");
    input.type = "range";
    input.min = String(spec.min);
    input.max = String(spec.max);
    input.step = String(spec.step);
    input.value = String(state[spec.key]);
    input.addEventListener("input", () => {
      state[spec.key] = Number(input.value);
      valueSpan.textContent = input.value;
      onChange();
    });

    row.append(label, input);
    container.append(row);
  }
}

function renderAllSliderGroups(type: RampType): void {
  renderSliderList(ribSlidersEl, RAMPS[type].ribSliders, currentParams, () => rebuildRamp(type));
  renderSliderList(joistSlidersEl, RAMPS[type].joistSliders, currentParams, () => rebuildRamp(type));
  renderSliderList(bottomTransitionSlidersEl, RAMPS[type].bottomTransitionSliders, currentParams, () => rebuildRamp(type));
  renderSliderList(copingSlidersEl, RAMPS[type].copingSliders, currentParams, () => rebuildRamp(type));
  renderSliderList(rampSlidersEl, RAMPS[type].rampSliders, currentParams, () => rebuildRamp(type));
}

function selectType(type: RampType): void {
  currentParams = { ...RAMPS[type].defaults };
  renderAllSliderGroups(type);
  rebuildRamp(type);
}

function resetParams(): void {
  const type = typeSelect.value as RampType;
  currentParams = { ...RAMPS[type].defaults };
  renderAllSliderGroups(type);
  rebuildRamp(type);
}

typeSelect.addEventListener("change", () => selectType(typeSelect.value as RampType));
resetBtn.addEventListener("click", resetParams);
renderSliderList(spaceSlidersEl, AVAILABLE_SPACE_SLIDERS, availableSpace, () => renderSpaceStatus(typeSelect.value as RampType));
selectType("halfPipe");

function resize(): void {
  const { clientWidth, clientHeight } = viewport;
  camera.aspect = clientWidth / clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(clientWidth, clientHeight);
}
window.addEventListener("resize", resize);
resize();

function animate(): void {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();
