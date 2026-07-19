import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  buildQuarterPipeGeometry,
  QUARTER_PIPE_DEFAULTS,
  quarterPipeCopingX,
  type QuarterPipeParams,
} from "./ramps/quarterPipe";
import { buildHalfPipeGeometry, HALF_PIPE_DEFAULTS, halfPipeCopingXs, type HalfPipeParams } from "./ramps/halfPipe";

type RampType = "quarterPipe" | "halfPipe";

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
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const RAMPS: Record<RampType, RampSpec<any>> = {
  quarterPipe: {
    defaults: QUARTER_PIPE_DEFAULTS,
    sliders: [
      { key: "radius", label: "Transition radius (m)", min: 1, max: 4, step: 0.1 },
      { key: "transitionAngleDeg", label: "Transition angle (°)", min: 45, max: 90, step: 1 },
      { key: "vertHeight", label: "Vert extension (m)", min: 0, max: 1, step: 0.05 },
      { key: "deckLength", label: "Deck length (m)", min: 0.3, max: 1.5, step: 0.1 },
      { key: "flatRunLength", label: "Flat run-in (m)", min: 0, max: 3, step: 0.1 },
      { key: "width", label: "Width (m)", min: 1, max: 4, step: 0.1 },
    ],
    build: (p: QuarterPipeParams) => buildQuarterPipeGeometry(p),
    copingXs: (p: QuarterPipeParams) => [quarterPipeCopingX(p)],
  },
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
  },
};

const viewport = document.getElementById("viewport")!;
const typeSelect = document.getElementById("type-select") as HTMLSelectElement;
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
let currentParams: any = { ...RAMPS.quarterPipe.defaults };

function rebuildRamp(type: RampType): void {
  const geometry = RAMPS[type].build(currentParams);
  rampMesh.geometry.dispose();
  rampMesh.geometry = geometry;
  rebuildCoping(type, geometry, currentParams, currentParams.width);
}

function renderSliders(type: RampType): void {
  slidersEl.innerHTML = "";
  for (const spec of RAMPS[type].sliders) {
    const row = document.createElement("div");
    row.className = "slider-row";

    const label = document.createElement("label");
    const valueSpan = document.createElement("span");
    valueSpan.textContent = String(currentParams[spec.key]);
    label.append(spec.label, valueSpan);

    const input = document.createElement("input");
    input.type = "range";
    input.min = String(spec.min);
    input.max = String(spec.max);
    input.step = String(spec.step);
    input.value = String(currentParams[spec.key]);
    input.addEventListener("input", () => {
      currentParams[spec.key] = Number(input.value);
      valueSpan.textContent = input.value;
      rebuildRamp(type);
    });

    row.append(label, input);
    slidersEl.append(row);
  }
}

function selectType(type: RampType): void {
  currentParams = { ...RAMPS[type].defaults };
  renderSliders(type);
  rebuildRamp(type);
}

function resetParams(): void {
  const type = typeSelect.value as RampType;
  currentParams = { ...RAMPS[type].defaults };
  renderSliders(type);
  rebuildRamp(type);
}

typeSelect.addEventListener("change", () => selectType(typeSelect.value as RampType));
resetBtn.addEventListener("click", resetParams);
selectType("quarterPipe");

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
