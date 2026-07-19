import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  buildBottomTransitionSlab,
  buildHalfPipeJoists,
  buildHalfPipeRibs,
  HALF_PIPE_DEFAULTS,
  halfPipeCopingXs,
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
  buildRibs: (params: P) => THREE.BufferGeometry[];
  // Joist/ledger boxes — optional since a ramp type without any bays to bridge would have
  // nothing to build here.
  buildJoists?: (params: P) => THREE.BufferGeometry[];
  // The bottom transition's own framing, separate from the ribs — optional since a ramp type
  // without one (e.g. quarter-pipe, once it rejoins) has nothing to build here.
  buildBottomTransitionSlab?: (params: P) => THREE.BufferGeometry;
  // X positions (in the built geometry's own centered coordinate space) of the coping
  // tubes — the curve/deck lip, not the deck's outer edge. See decisions.md.
  copingXs: (params: P) => number[];
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
    bottomTransitionSliders: [{ key: "bottomTransitionLength", label: "Bottom transition length (m)", min: 1, max: 8, step: 0.25 }],
    rampSliders: [
      { key: "radius", label: "Transition radius (m)", min: 1, max: 4, step: 0.1 },
      { key: "transitionAngleDeg", label: "Transition angle (°)", min: 45, max: 90, step: 1 },
      { key: "vertHeight", label: "Vert extension (m)", min: 0, max: 1, step: 0.05 },
      { key: "deckLength", label: "Deck length (m)", min: 0.3, max: 1.5, step: 0.1 },
      { key: "width", label: "Width (m)", min: 1, max: 4, step: 0.1 },
    ],
    buildRibs: (p: HalfPipeParams) => buildHalfPipeRibs(p),
    buildJoists: (p: HalfPipeParams) => buildHalfPipeJoists(p),
    buildBottomTransitionSlab: (p: HalfPipeParams) => buildBottomTransitionSlab(p),
    copingXs: (p: HalfPipeParams) => halfPipeCopingXs(p),
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

const bottomTransitionMesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
bottomTransitionMesh.castShadow = true;
bottomTransitionMesh.receiveShadow = true;
scene.add(bottomTransitionMesh);

const COPING_RADIUS = 0.03; // ~60mm schedule-40 steel pipe, the standard skate coping stock
const copingMaterial = new THREE.MeshStandardMaterial({ color: 0x999999, metalness: 0.6, roughness: 0.4 });
const copingGroup = new THREE.Group();
scene.add(copingGroup);

function rebuildCoping(type: RampType, deckY: number, params: unknown, width: number): void {
  for (const child of copingGroup.children) {
    if (child instanceof THREE.Mesh) child.geometry.dispose();
  }
  copingGroup.clear();

  for (const x of RAMPS[type].copingXs(params)) {
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(COPING_RADIUS, COPING_RADIUS, width, 16), copingMaterial);
    tube.rotation.x = Math.PI / 2; // cylinder's local Y (its length) onto world Z, spanning the ramp's width
    tube.position.set(x, deckY, 0);
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

  bottomTransitionMesh.geometry.dispose();
  const buildSlab = RAMPS[type].buildBottomTransitionSlab;
  bottomTransitionMesh.visible = Boolean(buildSlab);
  bottomTransitionMesh.geometry = buildSlab ? buildSlab(currentParams) : new THREE.BufferGeometry();

  const deckY = RAMPS[type].footprint(currentParams).height;
  rebuildCoping(type, deckY, currentParams, currentParams.width);
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
