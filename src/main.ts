import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  buildHalfPipeGeometry,
  HALF_PIPE_DEFAULTS,
  halfPipeCopingXs,
  halfPipeFootprint,
  type HalfPipeParams,
} from "./ramps/halfPipe";

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
  sliders: SliderSpec[];
  build: (params: P) => THREE.BufferGeometry;
  // X positions (in the built geometry's own centered coordinate space) of the coping
  // tubes — the curve/deck lip, not the deck's outer edge. See decisions.md.
  copingXs: (params: P) => number[];
  // Footprint this ramp actually needs, for the available-space validation below.
  footprint: (params: P) => Footprint;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const RAMPS: Record<RampType, RampSpec<any>> = {
  halfPipe: {
    defaults: HALF_PIPE_DEFAULTS,
    sliders: [
      { key: "radius", label: "Transition radius (m)", min: 1, max: 4, step: 0.1 },
      { key: "transitionAngleDeg", label: "Transition angle (°)", min: 45, max: 90, step: 1 },
      { key: "vertHeight", label: "Vert extension (m)", min: 0, max: 1, step: 0.05 },
      { key: "deckLength", label: "Deck length (m)", min: 0.3, max: 1.5, step: 0.1 },
      { key: "flatBottomLength", label: "Flat bottom (m)", min: 1, max: 8, step: 0.25 },
      { key: "width", label: "Width (m)", min: 1, max: 4, step: 0.1 },
    ],
    build: (p: HalfPipeParams) => buildHalfPipeGeometry(p),
    copingXs: (p: HalfPipeParams) => halfPipeCopingXs(p),
    footprint: (p: HalfPipeParams) => halfPipeFootprint(p),
  },
};

const AVAILABLE_SPACE_SLIDERS: SliderSpec[] = [
  { key: "length", label: "Available length (m)", min: 3, max: 15, step: 0.5 },
  { key: "width", label: "Available width (m)", min: 1, max: 6, step: 0.25 },
  { key: "height", label: "Available height (m)", min: 1, max: 4, step: 0.1 },
];

// Fits HALF_PIPE_DEFAULTS's footprint (~5.57m / 3m / 0.9m) with length/height to spare.
// Untyped as Footprint (unlike a ramp's computed footprint) since it's edited as loose
// slider state via renderSliderList, the same way currentParams is.
const availableSpace: Record<string, number> = { length: 6, width: 3, height: 2 };

const viewport = document.getElementById("viewport")!;
const typeSelect = document.getElementById("type-select") as HTMLSelectElement;
const spaceSlidersEl = document.getElementById("space-sliders")!;
const spaceStatusEl = document.getElementById("space-status")!;
const slidersEl = document.getElementById("sliders")!;
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
const rampMesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
rampMesh.castShadow = true;
scene.add(rampMesh);

const COPING_RADIUS = 0.03; // ~60mm schedule-40 steel pipe, the standard skate coping stock
const copingMaterial = new THREE.MeshStandardMaterial({ color: 0x999999, metalness: 0.6, roughness: 0.4 });
const copingGroup = new THREE.Group();
scene.add(copingGroup);

function rebuildCoping(type: RampType, geometry: THREE.BufferGeometry, params: unknown, width: number): void {
  for (const child of copingGroup.children) {
    if (child instanceof THREE.Mesh) child.geometry.dispose();
  }
  copingGroup.clear();

  const deckY = geometry.boundingBox!.max.y;
  for (const x of RAMPS[type].copingXs(params)) {
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(COPING_RADIUS, COPING_RADIUS, width, 16), copingMaterial);
    tube.rotation.x = Math.PI / 2; // cylinder's local Y (its length) onto world Z, spanning the ramp's width
    tube.position.set(x, deckY, 0);
    tube.castShadow = true;
    copingGroup.add(tube);
  }
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
  const geometry = RAMPS[type].build(currentParams);
  rampMesh.geometry.dispose();
  rampMesh.geometry = geometry;
  rebuildCoping(type, geometry, currentParams, currentParams.width);
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

function selectType(type: RampType): void {
  currentParams = { ...RAMPS[type].defaults };
  renderSliderList(slidersEl, RAMPS[type].sliders, currentParams, () => rebuildRamp(type));
  rebuildRamp(type);
}

function resetParams(): void {
  const type = typeSelect.value as RampType;
  currentParams = { ...RAMPS[type].defaults };
  renderSliderList(slidersEl, RAMPS[type].sliders, currentParams, () => rebuildRamp(type));
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
