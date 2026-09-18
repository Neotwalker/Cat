import * as THREE from 'three';
import atlasPart1 from './assets/cat2d/v1/micro-01.js';
import atlasPart2 from './assets/cat2d/v1/micro-02.js';
import atlasPart3 from './assets/cat2d/v1/micro-03.js';

const root = document.documentElement;
const stage = document.getElementById('stage');
const host = document.getElementById('canvasHost');
const debugToggle = document.getElementById('debugToggle');
const fallback = document.getElementById('fallback');
const hintText = document.getElementById('hintText');

const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
const randomBetween = (min, max) => Math.random() * (max - min) + min;

if (coarsePointer) hintText.textContent = 'Коснись кота';

let renderer;

try {
  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
} catch (error) {
  fallback.hidden = false;
  debugToggle.hidden = true;
  throw error;
}

renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(0x000000, 0);
host.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-3, 3, 3.4, -3.4, 0.1, 100);
camera.position.set(0, 0, 10);

const atlasBase64 = atlasPart1 + atlasPart2 + atlasPart3;
const atlasUrl = `data:image/webp;base64,${atlasBase64}`;
const ATLAS_W = 210;
const ATLAS_H = 241;

const atlasRects = {
  headOpen: [0, 0, 105, 93],
  headClosed: [105, 0, 104, 86],
  body: [0, 93, 108, 148],
  tail: [114, 93, 72, 82],
};

const state = {
  targetX: 0,
  targetY: 0,
  headX: 0,
  headY: 0,
  pointerInside: false,
  idleSince: performance.now(),
  idleTargetX: 0,
  idleTargetY: 0,
  nextIdleShift: performance.now() + randomBetween(1200, 2400),
  touchAttentionUntil: 0,
  startle: 0,
  startleSide: 0,
  blinkStart: -1000,
  blinkDuration: 170,
  nextBlink: performance.now() + randomBetween(2500, 5200),
  debugFan: false,
};

const rigRoot = new THREE.Group();
rigRoot.name = 'ROOT_2D';
scene.add(rigRoot);

const bodyRig = new THREE.Group();
bodyRig.name = 'BODY_2D';
rigRoot.add(bodyRig);

const tailRig = new THREE.Group();
tailRig.name = 'TAIL_2D';
bodyRig.add(tailRig);

const headRig = new THREE.Group();
headRig.name = 'HEAD_2D';
rigRoot.add(headRig);

let bodyMesh;
let tailMesh;
let headOpenMesh;
let headClosedMesh;
let ready = false;

function makeCropTexture(base, rect) {
  const [x, y, w, h] = rect;
  const texture = base.clone();
  texture.needsUpdate = true;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.repeat.set(w / ATLAS_W, h / ATLAS_H);
  texture.offset.set(x / ATLAS_W, 1 - (y + h) / ATLAS_H);
  return texture;
}

function makeLayerGeometry(width, height, curve = 0) {
  const geometry = new THREE.PlaneGeometry(width, height, 18, 12);

  if (curve !== 0) {
    const pos = geometry.attributes.position;
    const halfW = width * 0.5;
    const halfH = height * 0.5;

    for (let i = 0; i < pos.count; i += 1) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const nx = x / halfW;
      const ny = y / halfH;
      const bulge = (1 - nx * nx) * (0.82 + 0.18 * (1 - ny * ny));
      pos.setZ(i, curve * bulge);
    }

    pos.needsUpdate = true;
    geometry.computeVertexNormals();
  }

  return geometry;
}

function makeLayer(base, rect, width, height, renderOrder, curve = 0) {
  const material = new THREE.MeshBasicMaterial({
    map: makeCropTexture(base, rect),
    transparent: true,
    opacity: 1,
    depthWrite: false,
    depthTest: true,
    alphaTest: 0.015,
    toneMapped: false,
  });

  const mesh = new THREE.Mesh(
    makeLayerGeometry(width, height, curve),
    material,
  );

  mesh.renderOrder = renderOrder;
  return mesh;
}

function buildLayeredCat(baseTexture) {
  baseTexture.colorSpace = THREE.SRGBColorSpace;
  baseTexture.magFilter = THREE.LinearFilter;
  baseTexture.minFilter = THREE.LinearFilter;

  // Tail is deliberately behind the torso, matching the front reference.
  tailMesh = makeLayer(baseTexture, atlasRects.tail, 2.34, 2.50, 1, 0.05);
  tailMesh.position.set(-0.24, 0.03, 0);
  tailRig.position.set(-1.28, -1.28, -0.15);
  tailRig.rotation.z = 0.015;
  tailRig.add(tailMesh);

  // The v1 body asset already contains chest, forelegs, hindquarters and paws.
  bodyMesh = makeLayer(baseTexture, atlasRects.body, 3.48, 4.72, 2, 0.075);
  bodyMesh.position.set(0, -0.10, 0);
  bodyRig.position.set(0, -1.06, 0);
  bodyRig.add(bodyMesh);

  const headWidth = 3.52;
  const headOpenHeight = 3.12;
  const headClosedHeight = headOpenHeight;

  headOpenMesh = makeLayer(
    baseTexture,
    atlasRects.headOpen,
    headWidth,
    headOpenHeight,
    4,
    0.16,
  );
  headClosedMesh = makeLayer(
    baseTexture,
    atlasRects.headClosed,
    headWidth,
    headClosedHeight,
    5,
    0.16,
  );
  headClosedMesh.position.y = 0;
  headClosedMesh.visible = false;

  headRig.position.set(0, 1.40, 0.12);
  headRig.add(headOpenMesh, headClosedMesh);

  ready = true;
}

new THREE.TextureLoader().load(
  atlasUrl,
  buildLayeredCat,
  undefined,
  () => {
    fallback.hidden = false;
    fallback.textContent = 'Не удалось загрузить 2.5D-слои кота.';
  },
);

function getLookTarget(clientX, clientY) {
  const rect = renderer.domElement.getBoundingClientRect();
  const centerX = rect.left + rect.width * 0.5;
  const centerY = rect.top + rect.height * 0.43;

  return {
    x: clamp(
      Math.tanh((clientX - centerX) / Math.max(rect.width * 0.32, 160)),
      -1,
      1,
    ),
    y: clamp(
      Math.tanh((clientY - centerY) / Math.max(rect.height * 0.32, 160)),
      -1,
      1,
    ),
  };
}

function setPointerTarget(clientX, clientY, now = performance.now()) {
  const target = getLookTarget(clientX, clientY);
  state.targetX = target.x;
  state.targetY = target.y;
  state.idleSince = now;
}

function onPointerMove(event) {
  if (reducedMotion) return;
  if (coarsePointer && performance.now() > state.touchAttentionUntil) return;

  state.pointerInside = true;
  setPointerTarget(event.clientX, event.clientY);
}

function onPointerLeave() {
  if (coarsePointer) return;
  state.pointerInside = false;
  state.idleSince = performance.now();
}

function onPointerDown(event) {
  if (reducedMotion) return;

  const now = performance.now();
  state.pointerInside = true;
  state.touchAttentionUntil = now + 1900;
  setPointerTarget(event.clientX, event.clientY, now);

  const rect = renderer.domElement.getBoundingClientRect();
  state.startleSide = clamp(
    (event.clientX - (rect.left + rect.width * 0.5)) / Math.max(rect.width * 0.32, 1),
    -1,
    1,
  );
  state.startle = 1;
}

renderer.domElement.addEventListener('pointermove', onPointerMove, { passive: true });
renderer.domElement.addEventListener('pointerleave', onPointerLeave);
renderer.domElement.addEventListener('pointerdown', onPointerDown, { passive: true });
window.addEventListener('blur', onPointerLeave);

function chooseIdleLook(now) {
  if (now < state.nextIdleShift) return;

  state.idleTargetX = randomBetween(-0.24, 0.24);
  state.idleTargetY = randomBetween(-0.12, 0.10);
  state.nextIdleShift = now + randomBetween(1800, 4200);
}

function updateBlink(now) {
  if (now >= state.nextBlink) {
    state.blinkStart = now;
    state.blinkDuration = Math.random() < 0.16 ? 300 : 165;
    state.nextBlink = now + randomBetween(2800, 6200);
  }

  const elapsed = now - state.blinkStart;
  if (elapsed < 0 || elapsed > state.blinkDuration) return 0;

  if (state.blinkDuration > 250) {
    const half = state.blinkDuration / 2;
    const local = elapsed < half ? elapsed : elapsed - half;
    return Math.sin(Math.PI * clamp(local / (half * 0.78), 0, 1));
  }

  return Math.sin(Math.PI * clamp(elapsed / state.blinkDuration, 0, 1));
}

debugToggle.textContent = 'Разложить слои';
debugToggle.setAttribute('aria-label', 'Показать устройство 2.5D-слоёв');
debugToggle.addEventListener('click', () => {
  state.debugFan = !state.debugFan;
  debugToggle.setAttribute('aria-pressed', String(state.debugFan));
  debugToggle.textContent = state.debugFan ? 'Собрать кота' : 'Разложить слои';
});

function animate(now) {
  const touchTracking = coarsePointer && now < state.touchAttentionUntil;
  const idle = !touchTracking && (
    coarsePointer
    || !state.pointerInside
    || now - state.idleSince > 2300
  );

  if (idle && !reducedMotion) {
    chooseIdleLook(now);
    state.targetX = state.idleTargetX + Math.sin(now * 0.00034) * 0.035;
    state.targetY = state.idleTargetY + Math.cos(now * 0.00047) * 0.022;
  }

  if (reducedMotion) {
    state.targetX = 0;
    state.targetY = 0;
  }

  state.headX = lerp(state.headX, state.targetX, reducedMotion ? 0.025 : 0.075);
  state.headY = lerp(state.headY, state.targetY, reducedMotion ? 0.025 : 0.075);
  state.startle = lerp(state.startle, 0, 0.095);

  if (ready) {
    const x = clamp(state.headX, -1, 1);
    const y = clamp(state.headY, -1, 1);
    const startle = clamp(state.startle, 0, 1);

    const floatY = reducedMotion ? 0 : Math.sin(now * 0.00072) * 0.018;
    const breath = reducedMotion ? 1 : 1 + Math.sin(now * 0.00112) * 0.006;

    const fan = state.debugFan ? 1 : 0;

    rigRoot.position.y = floatY;
    rigRoot.position.x = -state.startleSide * startle * 0.018;

    bodyRig.position.x = lerp(bodyRig.position.x, fan ? -0.78 : 0, 0.12);
    bodyRig.position.y = -1.06 + Math.sin(now * 0.00112) * (reducedMotion ? 0 : 0.012);
    bodyRig.rotation.y = x * 0.018;
    bodyRig.rotation.z = -x * 0.006 + state.startleSide * startle * 0.008;
    bodyRig.scale.set(1, breath, 1);

    headRig.position.x = lerp(
      headRig.position.x,
      (fan ? 0.78 : 0) + x * 0.072 - state.startleSide * startle * 0.04,
      0.16,
    );
    headRig.position.y = lerp(
      headRig.position.y,
      1.40 - y * 0.060 + startle * 0.025,
      0.16,
    );
    headRig.rotation.y = x * 0.115 - state.startleSide * startle * 0.018;
    headRig.rotation.x = -y * 0.060 + startle * 0.010;
    headRig.rotation.z = -x * 0.025 - state.startleSide * startle * 0.020;
    headRig.scale.setScalar(1 + startle * 0.008);

    tailRig.position.x = lerp(tailRig.position.x, fan ? -2.05 : -1.28, 0.12);
    tailRig.rotation.z =
      0.015
      + (reducedMotion ? 0 : Math.sin(now * 0.00082) * 0.032)
      + x * 0.014
      + state.startleSide * startle * 0.045;

    const blink = reducedMotion ? 0 : updateBlink(now);
    const eyesClosed = blink > 0.58;
    headOpenMesh.visible = !eyesClosed;
    headClosedMesh.visible = eyesClosed;

    const stageX = reducedMotion ? 0 : x * -3.0;
    const stageY = reducedMotion ? 0 : y * -2.0;
    root.style.setProperty('--stage-x', `${stageX}px`);
    root.style.setProperty('--stage-y', `${stageY}px`);
  }

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

function resize() {
  const width = Math.max(host.clientWidth, 1);
  const height = Math.max(host.clientHeight, 1);
  const aspect = width / height;
  const viewHeight = width < 600 ? 7.35 : 6.85;
  const halfH = viewHeight / 2;
  const halfW = halfH * aspect;

  renderer.setSize(width, height, false);
  camera.left = -halfW;
  camera.right = halfW;
  camera.top = halfH;
  camera.bottom = -halfH;
  camera.updateProjectionMatrix();
}

const resizeObserver = new ResizeObserver(resize);
resizeObserver.observe(host);
resize();
requestAnimationFrame(animate);
