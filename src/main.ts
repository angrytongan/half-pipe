import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  buildBottomTransitionFrame,
  buildHalfPipeJoistsBySection,
  buildHalfPipeRibsBySection,
  HALF_PIPE_DEFAULTS,
  halfPipeCopingCenters,
  halfPipeFootprint,
  type HalfPipeParams,
  type SkinGrainDirection,
} from "./ramps/halfPipe";
import { buildHalfPipeDimensions, type HalfPipeDimension } from "./dimensions/halfPipeDimensions";
import { HistoryStack } from "./history";

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

interface RampSpec {
  defaults: HalfPipeParams;
  ribSliders: SliderSpec[];
  joistSliders: SliderSpec[];
  bottomTransitionSliders: SliderSpec[];
  rampSliders: SliderSpec[];
  copingSliders: SliderSpec[];
  skinSliders: SliderSpec[];
  // Edge ribs (frame the deck edges, stay visible once skinned) vs internal seam ribs (buried
  // inside the skin, hidden by "Show skin") — see buildHalfPipeRibsBySection.
  buildRibsBySection: (params: HalfPipeParams) => { edgeRibs: THREE.BufferGeometry[]; internalRibs: THREE.BufferGeometry[] };
  // Curve joists (under the curved/vert surface, hidden by "Show skin") vs deck joists (under
  // the flat deck/ground, always visible) — see buildHalfPipeJoistsBySection.
  buildJoistsBySection: (params: HalfPipeParams) => { curveJoists: THREE.BufferGeometry[]; deckJoists: THREE.BufferGeometry[] };
  // The bottom transition's own framing — a stud wall lying on the ground.
  buildBottomTransitionFrame: (params: HalfPipeParams) => THREE.BufferGeometry[];
  // Centers (in the built geometry's own centered coordinate space) of the coping tubes —
  // the curve/deck lip, not the deck's outer edge. See decisions.md.
  copingCenters: (params: HalfPipeParams) => { x: number; y: number }[];
  // Footprint this ramp actually needs, for the available-space validation below.
  footprint: (params: HalfPipeParams) => Footprint;
  // CAD-style dimension lines (height, length, bottom transition length, rib spacing).
  buildDimensions: (params: HalfPipeParams) => HalfPipeDimension[];
}

const RAMP: RampSpec = {
  defaults: HALF_PIPE_DEFAULTS,
  ribSliders: [
    { key: "ribThicknessMm", label: "Rib thickness (mm)", min: 10, max: 40, step: 1 },
    { key: "internalRibCount", label: "Internal ribs", min: 0, max: 10, step: 1 },
  ],
  joistSliders: [
    { key: "joistThicknessMm", label: "Joist thickness (mm)", min: 20, max: 70, step: 1 },
    { key: "joistDepthMm", label: "Joist depth (mm)", min: 45, max: 190, step: 1 },
    { key: "internalCurveJoistCount", label: "Internal curve joists", min: 0, max: 30, step: 1 },
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
  skinSliders: [
    { key: "skinLayer1ThicknessMm", label: "Layer 1 thickness (mm)", min: 3, max: 25, step: 1 },
    { key: "skinLayer2ThicknessMm", label: "Layer 2 thickness (mm)", min: 3, max: 25, step: 1 },
    { key: "skinSheetLength", label: "Sheet length (m)", min: 1, max: 3.6, step: 0.01 },
    { key: "skinSheetWidth", label: "Sheet width (m)", min: 0.6, max: 1.5, step: 0.01 },
  ],
  rampSliders: [
    { key: "radius", label: "Transition radius (m)", min: 1, max: 4, step: 0.1 },
    { key: "transitionAngleDeg", label: "Transition angle (°)", min: 45, max: 90, step: 1 },
    { key: "vertHeight", label: "Vert extension (m)", min: 0, max: 1, step: 0.05 },
    { key: "deckLength", label: "Deck length (m)", min: 0.3, max: 1.5, step: 0.1 },
    { key: "width", label: "Width (m)", min: 1, max: 4, step: 0.1 },
  ],
  buildRibsBySection: buildHalfPipeRibsBySection,
  buildJoistsBySection: buildHalfPipeJoistsBySection,
  buildBottomTransitionFrame: buildBottomTransitionFrame,
  copingCenters: halfPipeCopingCenters,
  footprint: halfPipeFootprint,
  buildDimensions: buildHalfPipeDimensions,
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
const spaceSlidersEl = document.getElementById("space-sliders")!;
const spaceStatusEl = document.getElementById("space-status")!;
const ribSlidersEl = document.getElementById("rib-sliders")!;
const joistSlidersEl = document.getElementById("joist-sliders")!;
const bottomTransitionSlidersEl = document.getElementById("bottom-transition-sliders")!;
const copingSlidersEl = document.getElementById("coping-sliders")!;
const skinSlidersEl = document.getElementById("skin-sliders")!;
const skinGrainDirectionEl = document.getElementById("skin-grain-direction") as HTMLSelectElement;
const rampSlidersEl = document.getElementById("ramp-sliders")!;
const resetBtn = document.getElementById("reset-btn")!;
const resetViewBtn = document.getElementById("reset-view-btn")!;
const undoBtn = document.getElementById("undo-btn") as HTMLButtonElement;
const redoBtn = document.getElementById("redo-btn") as HTMLButtonElement;
const dimensionsToggle = document.getElementById("dimensions-toggle") as HTMLInputElement;
const scaleToggle = document.getElementById("scale-toggle") as HTMLInputElement;
const skinToggle = document.getElementById("skin-toggle") as HTMLInputElement;
const themeToggle = document.getElementById("theme-toggle")!;
const aboutBtn = document.getElementById("about-btn")!;
const aboutCloseBtn = document.getElementById("about-close-btn")!;
const aboutModal = document.getElementById("about-modal") as HTMLDialogElement;

// Single source of truth for the default view — page load and "Reset view" both use these,
// so they can't drift apart the way they did before (page load had one hardcoded position,
// reset had another).
const DEFAULT_CAMERA_POSITION = new THREE.Vector3(-2.8, 1.9, -3.3); // puts the scale figures (positioned at +X/+Z, beyond the ramp) into view
const DEFAULT_CAMERA_TARGET = new THREE.Vector3(0, 0.6, 0);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xdfe9f0);

const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
camera.position.copy(DEFAULT_CAMERA_POSITION);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.shadowMap.enabled = true;
viewport.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(DEFAULT_CAMERA_TARGET);
controls.zoomToCursor = true; // built-in OrbitControls option — scroll-zoom centers on the pointer

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
// Split so "Show skin" can hide the internal seam ribs (buried inside the skin) while leaving
// the edge ribs (still visible, wrapped by the skin) visible either way.
const edgeRibGroup = new THREE.Group();
scene.add(edgeRibGroup);
const internalRibGroup = new THREE.Group();
scene.add(internalRibGroup);

const joistMaterial = new THREE.MeshStandardMaterial({ color: 0xc9a876, flatShading: true }); // wood-toned, distinct from the ribs
// Split so "Show skin" can hide the curve joists (under the surface a skin would cover) while
// leaving the deck joists (flat deck/ground support) visible either way.
const curveJoistGroup = new THREE.Group();
scene.add(curveJoistGroup);
const deckJoistGroup = new THREE.Group();
scene.add(deckJoistGroup);

const bottomTransitionGroup = new THREE.Group(); // same lumber as the joists, so reuses joistMaterial
scene.add(bottomTransitionGroup);

const copingMaterial = new THREE.MeshStandardMaterial({ color: 0x999999, metalness: 0.6, roughness: 0.4 });
const copingGroup = new THREE.Group();
scene.add(copingGroup);

// Future home for skin geometry (not built yet) — "Show skin" already toggles its visibility.
const skinGroup = new THREE.Group();
skinGroup.visible = false;
scene.add(skinGroup);

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

function rebuildCoping(params: HalfPipeParams, width: number): void {
  for (const child of copingGroup.children) {
    if (child instanceof THREE.Mesh) child.geometry.dispose();
  }
  copingGroup.clear();

  const geometry = buildCopingTubeGeometry(params.copingIdMm, params.copingOdMm, width);
  for (const { x, y } of RAMP.copingCenters(params)) {
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

/** A camera-facing human silhouette, for gauging the ramp's height by eye — same billboard technique as createLabelSprite, but a filled head+body shape on a transparent canvas instead of text on an opaque one. */
function createFigureSprite(heightMeters: number): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#3a3a3acc";

  const headRadius = canvas.width * 0.22;
  const headCenterY = headRadius + 4;
  ctx.beginPath();
  ctx.arc(canvas.width / 2, headCenterY, headRadius, 0, Math.PI * 2);
  ctx.fill();

  const shoulderY = headCenterY + headRadius * 0.9;
  const bodyTopWidth = canvas.width * 0.55;
  const bodyBottomWidth = canvas.width * 0.4;
  ctx.beginPath();
  ctx.moveTo(canvas.width / 2 - bodyTopWidth / 2, shoulderY);
  ctx.lineTo(canvas.width / 2 + bodyTopWidth / 2, shoulderY);
  ctx.lineTo(canvas.width / 2 + bodyBottomWidth / 2, canvas.height);
  ctx.lineTo(canvas.width / 2 - bodyBottomWidth / 2, canvas.height);
  ctx.closePath();
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
  sprite.scale.set(heightMeters * (canvas.width / canvas.height), heightMeters, 1); // sprite is center-anchored, so position.y = heightMeters / 2 puts its feet at ground level
  return sprite;
}

const ADULT_FIGURE_HEIGHT_M = 1.7;
const CHILD_FIGURE_HEIGHT_M = 1.1;
const adultFigure = createFigureSprite(ADULT_FIGURE_HEIGHT_M);
const childFigure = createFigureSprite(CHILD_FIGURE_HEIGHT_M);
scene.add(adultFigure, childFigure);

/** Stands the scale figures just outside the ramp's tallest point (the deck/vert-wall edge), so their height reads directly against it. */
function repositionFigures(params: HalfPipeParams): void {
  const footprint = RAMP.footprint(params);
  const x = footprint.length / 2 - 0.3;
  const z = params.width / 2 + 0.5;
  adultFigure.position.set(x, ADULT_FIGURE_HEIGHT_M / 2, z);
  childFigure.position.set(x, CHILD_FIGURE_HEIGHT_M / 2, z + 0.4);
}

// Explicit disposer over exactly what the last rebuild created.
let disposeDimensions: (() => void) | null = null;

function rebuildDimensions(params: HalfPipeParams): void {
  disposeDimensions?.();
  disposeDimensions = null;

  const groups: THREE.Group[] = [];
  const sprites: THREE.Sprite[] = [];
  for (const dim of RAMP.buildDimensions(params)) {
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

let currentParams: HalfPipeParams = { ...RAMP.defaults };

interface AppSnapshot {
  params: HalfPipeParams;
  space: Record<string, number>;
}

const history = new HistoryStack<AppSnapshot>();
// Set on the first `input` event of a drag (or keyboard step), recorded into `history` on
// the matching `change` event, so a whole drag is one undo step rather than one per tick.
let pendingSnapshot: AppSnapshot | null = null;

function snapshot(): AppSnapshot {
  return { params: { ...currentParams }, space: { ...availableSpace } };
}

function updateHistoryButtons(): void {
  undoBtn.disabled = !history.canUndo();
  redoBtn.disabled = !history.canRedo();
}

function applySnapshot(s: AppSnapshot): void {
  currentParams = { ...s.params };
  Object.assign(availableSpace, s.space);
  renderAllSliderGroups();
  rebuildRamp();
  updateHistoryButtons();
}

function undo(): void {
  const previous = history.undo(snapshot());
  if (previous) applySnapshot(previous);
}

function redo(): void {
  const next = history.redo(snapshot());
  if (next) applySnapshot(next);
}

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

function renderSpaceStatus(): void {
  ground.geometry.dispose();
  ground.geometry = new THREE.PlaneGeometry(availableSpace.length, availableSpace.width);

  const required = RAMP.footprint(currentParams);
  spaceStatusEl.innerHTML = SPACE_AXES.map(({ key, label }) => {
    const req = round2(required[key]);
    const avail = round2(availableSpace[key]);
    const fits = req <= avail;
    const detail = fits ? `${req.toFixed(2)}m / ${avail.toFixed(2)}m` : `${req.toFixed(2)}m / ${avail.toFixed(2)}m — over by ${(req - avail).toFixed(2)}m`;
    return `<div class="space-status ${fits ? "safe" : "unsafe"}">${label}: ${detail}</div>`;
  }).join("");
}

function rebuildRamp(): void {
  for (const child of edgeRibGroup.children) {
    if (child instanceof THREE.Mesh) child.geometry.dispose();
  }
  edgeRibGroup.clear();
  for (const child of internalRibGroup.children) {
    if (child instanceof THREE.Mesh) child.geometry.dispose();
  }
  internalRibGroup.clear();
  const { edgeRibs, internalRibs } = RAMP.buildRibsBySection(currentParams);
  for (const geometry of edgeRibs) {
    const rib = new THREE.Mesh(geometry, material);
    rib.castShadow = true;
    edgeRibGroup.add(rib);
  }
  for (const geometry of internalRibs) {
    const rib = new THREE.Mesh(geometry, material);
    rib.castShadow = true;
    internalRibGroup.add(rib);
  }

  for (const child of curveJoistGroup.children) {
    if (child instanceof THREE.Mesh) child.geometry.dispose();
  }
  curveJoistGroup.clear();
  for (const child of deckJoistGroup.children) {
    if (child instanceof THREE.Mesh) child.geometry.dispose();
  }
  deckJoistGroup.clear();
  const { curveJoists, deckJoists } = RAMP.buildJoistsBySection(currentParams);
  for (const geometry of curveJoists) {
    const joist = new THREE.Mesh(geometry, joistMaterial);
    joist.castShadow = true;
    curveJoistGroup.add(joist);
  }
  for (const geometry of deckJoists) {
    const joist = new THREE.Mesh(geometry, joistMaterial);
    joist.castShadow = true;
    deckJoistGroup.add(joist);
  }

  for (const child of bottomTransitionGroup.children) {
    if (child instanceof THREE.Mesh) child.geometry.dispose();
  }
  bottomTransitionGroup.clear();
  for (const geometry of RAMP.buildBottomTransitionFrame(currentParams)) {
    const member = new THREE.Mesh(geometry, joistMaterial);
    member.castShadow = true;
    bottomTransitionGroup.add(member);
  }

  rebuildCoping(currentParams, currentParams.width);
  rebuildDimensions(currentParams);
  repositionFigures(currentParams);
  renderSpaceStatus();
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
    input.dataset.key = spec.key;
    input.addEventListener("input", () => {
      pendingSnapshot ??= snapshot();
      state[spec.key] = Number(input.value);
      valueSpan.textContent = input.value;
      onChange();
    });
    input.addEventListener("change", () => {
      if (pendingSnapshot === null) return;
      history.record(pendingSnapshot);
      pendingSnapshot = null;
      updateHistoryButtons();
    });

    row.append(label, input);
    container.append(row);
  }
}

/** Keeps a range input's bound in sync with another's value — e.g. coping ID can never exceed OD — by writing the native min/max attribute (so the browser itself won't let the knob cross it) and, if that clamps the target's value, replaying the target's own input event so its label/state/rebuild wiring stays in sync. The before/after check stops the two listeners from ping-ponging. */
function bindDiameterBound(source: HTMLInputElement, target: HTMLInputElement, boundAttr: "min" | "max"): void {
  source.addEventListener("input", () => {
    const before = target.value;
    target[boundAttr] = source.value;
    if (target.value !== before) target.dispatchEvent(new Event("input"));
  });
}

function renderAllSliderGroups(): void {
  // Every HalfPipeParams field is a number except skinGrainDirection (a string enum, synced
  // separately below) — the slider list only reads/writes by key name, so this cast is a pure
  // type-level widening, not a runtime lie (mutations below still land on the same
  // currentParams object).
  const state = currentParams as unknown as Record<string, number>;
  renderSliderList(ribSlidersEl, RAMP.ribSliders, state, rebuildRamp);
  renderSliderList(joistSlidersEl, RAMP.joistSliders, state, rebuildRamp);
  renderSliderList(bottomTransitionSlidersEl, RAMP.bottomTransitionSliders, state, rebuildRamp);
  renderSliderList(copingSlidersEl, RAMP.copingSliders, state, rebuildRamp);
  renderSliderList(skinSlidersEl, RAMP.skinSliders, state, rebuildRamp);
  renderSliderList(rampSlidersEl, RAMP.rampSliders, state, rebuildRamp);
  renderSliderList(spaceSlidersEl, AVAILABLE_SPACE_SLIDERS, availableSpace, renderSpaceStatus);
  skinGrainDirectionEl.value = currentParams.skinGrainDirection;

  const odInput = copingSlidersEl.querySelector<HTMLInputElement>('[data-key="copingOdMm"]')!;
  const idInput = copingSlidersEl.querySelector<HTMLInputElement>('[data-key="copingIdMm"]')!;
  bindDiameterBound(odInput, idInput, "max");
  bindDiameterBound(idInput, odInput, "min");
}

function applyDefaults(): void {
  currentParams = { ...RAMP.defaults };
  renderAllSliderGroups();
  rebuildRamp();
}

function resetParams(): void {
  history.record(snapshot());
  applyDefaults();
  updateHistoryButtons();
}

function resetView(): void {
  camera.position.copy(DEFAULT_CAMERA_POSITION);
  controls.target.copy(DEFAULT_CAMERA_TARGET);
  controls.update();
}

/** The inline head script (index.html) already picked the initial theme (stored preference, falling back to system) before this module ran, so this only reflects it in the toggle's glyph and handles switching. */
function renderThemeToggle(): void {
  const isDark = document.documentElement.dataset.theme === "dark";
  themeToggle.textContent = isDark ? "☀️" : "🌙";
}

themeToggle.addEventListener("click", () => {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  localStorage.setItem("theme", next);
  renderThemeToggle();
});
renderThemeToggle();

aboutBtn.addEventListener("click", () => aboutModal.showModal());
aboutCloseBtn.addEventListener("click", () => aboutModal.close());
aboutModal.addEventListener("click", (e) => {
  if (e.target === aboutModal) aboutModal.close(); // click landed on the backdrop, not the dialog content
});

resetBtn.addEventListener("click", resetParams);
resetViewBtn.addEventListener("click", resetView);
undoBtn.addEventListener("click", undo);
redoBtn.addEventListener("click", redo);
dimensionsToggle.addEventListener("input", () => {
  dimensionsGroup.visible = dimensionsToggle.checked;
});
scaleToggle.addEventListener("input", () => {
  adultFigure.visible = scaleToggle.checked;
  childFigure.visible = scaleToggle.checked;
});
skinToggle.addEventListener("input", () => {
  const showSkin = skinToggle.checked;
  bottomTransitionGroup.visible = !showSkin;
  curveJoistGroup.visible = !showSkin;
  internalRibGroup.visible = !showSkin;
  skinGroup.visible = showSkin;
});
skinGrainDirectionEl.addEventListener("change", () => {
  history.record(snapshot());
  currentParams.skinGrainDirection = skinGrainDirectionEl.value as SkinGrainDirection;
  rebuildRamp();
  updateHistoryButtons();
});

// Tooltip is position: fixed to escape #panel's overflow clipping, so its screen position has to be computed in JS rather than via CSS anchoring to an ancestor.
const scaleTooltipTrigger = document.querySelector<HTMLElement>(".tooltip-trigger")!;
const scaleTooltipBubble = document.querySelector<HTMLElement>(".tooltip-bubble")!;
function positionScaleTooltip(): void {
  const rect = scaleTooltipTrigger.getBoundingClientRect();
  scaleTooltipBubble.style.left = `${rect.left + rect.width / 2}px`;
  scaleTooltipBubble.style.top = `${rect.top}px`;
}
scaleTooltipTrigger.addEventListener("mouseenter", positionScaleTooltip);
scaleTooltipTrigger.addEventListener("focus", positionScaleTooltip);
applyDefaults();
updateHistoryButtons();

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
