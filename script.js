import * as THREE from 'three';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/GLTFLoader.js';

const root = document.documentElement;
const host = document.getElementById('canvasHost');
const debugToggle = document.getElementById('debugToggle');
const fallback = document.getElementById('fallback');
const hintText = document.getElementById('hintText');

const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;

if (coarsePointer) hintText.textContent = 'Коснись кота';

const MODEL_URL = 'https://storage.to3d.app/generated-3d/models/2026-09-18/task_c94ccb80-54dc-445f-81c4-cb4b28441701_model.glb';

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: true,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.02;
renderer.setClearColor(0x000000, 0);
host.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-2.2, 2.2, 2.8, -2.8, 0.01, 100);
camera.position.set(0, 0.12, 5.5);
camera.lookAt(0, 0, 0);

scene.add(new THREE.HemisphereLight(0xffffff, 0x20242d, 2.0));

const key = new THREE.DirectionalLight(0xffffff, 2.6);
key.position.set(3, 4, 5);
scene.add(key);

const fill = new THREE.DirectionalLight(0x9fb7ff, 1.15);
fill.position.set(-4, 1.5, 3);
scene.add(fill);

const rim = new THREE.DirectionalLight(0xffd7d0, 0.95);
rim.position.set(2, 3, -4);
scene.add(rim);

const modelPivot = new THREE.Group();
scene.add(modelPivot);

let model = null;
let ready = false;
let wireframe = false;
let targetX = 0;
let targetY = 0;
let lookX = 0;
let lookY = 0;
let startle = 0;
let startleSide = 0;
let touchAttentionUntil = 0;
let pointerInside = false;

function fitModel(object) {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  object.position.sub(center);

  const targetHeight = 4.55;
  const scale = targetHeight / Math.max(size.y, 0.001);
  object.scale.setScalar(scale);

  const fittedBox = new THREE.Box3().setFromObject(object);
  const fittedCenter = fittedBox.getCenter(new THREE.Vector3());
  object.position.x -= fittedCenter.x;
  object.position.y -= fittedCenter.y + 0.06;
  object.position.z -= fittedCenter.z;
}

function normalizeMaterials(object) {
  object.traverse((child) => {
    if (!child.isMesh) return;

    if (!child.geometry.attributes.normal) {
      child.geometry.computeVertexNormals();
    }

    const sourceMaterials = Array.isArray(child.material)
      ? child.material
      : [child.material];

    const materials = sourceMaterials.map((material) => {
      const copy = material.clone();
      copy.side = THREE.FrontSide;
      copy.metalness = 0;
      copy.roughness = Math.max(copy.roughness ?? 0.8, 0.72);
      copy.wireframe = false;
      copy.needsUpdate = true;
      return copy;
    });

    child.material = Array.isArray(child.material) ? materials : materials[0];
  });
}

const loader = new GLTFLoader();
loader.setCrossOrigin('anonymous');
loader.load(
  MODEL_URL,
  (gltf) => {
    model = gltf.scene;
    normalizeMaterials(model);
    fitModel(model);
    modelPivot.add(model);
    ready = true;
    fallback.hidden = true;
  },
  undefined,
  (error) => {
    console.error(error);
    fallback.hidden = false;
    fallback.textContent = 'Не удалось загрузить GLB-модель. Попробуй обновить страницу.';
  },
);

function pointerTarget(clientX, clientY) {
  const rect = renderer.domElement.getBoundingClientRect();
  const nx = (clientX - (rect.left + rect.width * 0.5)) / Math.max(rect.width * 0.42, 1);
  const ny = (clientY - (rect.top + rect.height * 0.46)) / Math.max(rect.height * 0.42, 1);
  targetX = clamp(Math.tanh(nx), -1, 1);
  targetY = clamp(Math.tanh(ny), -1, 1);
}

renderer.domElement.addEventListener('pointermove', (event) => {
  if (reducedMotion) return;
  if (coarsePointer && performance.now() > touchAttentionUntil) return;
  pointerInside = true;
  pointerTarget(event.clientX, event.clientY);
}, { passive: true });

renderer.domElement.addEventListener('pointerleave', () => {
  if (!coarsePointer) pointerInside = false;
});

renderer.domElement.addEventListener('pointerdown', (event) => {
  if (reducedMotion) return;
  pointerInside = true;
  touchAttentionUntil = performance.now() + 1800;
  pointerTarget(event.clientX, event.clientY);
  startle = 1;

  const rect = renderer.domElement.getBoundingClientRect();
  startleSide = clamp(
    (event.clientX - (rect.left + rect.width * 0.5)) / Math.max(rect.width * 0.35, 1),
    -1,
    1,
  );
}, { passive: true });

debugToggle.textContent = 'Показать сетку';
debugToggle.setAttribute('aria-label', 'Переключить отображение сетки модели');
debugToggle.addEventListener('click', () => {
  if (!model) return;
  wireframe = !wireframe;
  debugToggle.setAttribute('aria-pressed', String(wireframe));
  debugToggle.textContent = wireframe ? 'Скрыть сетку' : 'Показать сетку';

  model.traverse((child) => {
    if (!child.isMesh) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => {
      material.wireframe = wireframe;
      material.needsUpdate = true;
    });
  });
});

function animate(now) {
  const tracking = !coarsePointer
    ? pointerInside
    : now < touchAttentionUntil;

  if (!tracking && !reducedMotion) {
    targetX = Math.sin(now * 0.00035) * 0.12;
    targetY = Math.cos(now * 0.00029) * 0.055;
  }

  if (reducedMotion) {
    targetX = 0;
    targetY = 0;
  }

  lookX = lerp(lookX, targetX, 0.055);
  lookY = lerp(lookY, targetY, 0.055);
  startle = lerp(startle, 0, 0.09);

  if (ready) {
    const idleFloat = reducedMotion ? 0 : Math.sin(now * 0.00105) * 0.018;
    const idleRoll = reducedMotion ? 0 : Math.sin(now * 0.00061) * 0.008;

    modelPivot.rotation.y = lookX * 0.16 - startleSide * startle * 0.035;
    modelPivot.rotation.x = -lookY * 0.07 + startle * 0.012;
    modelPivot.rotation.z = -lookX * 0.018 + idleRoll;
    modelPivot.position.y = idleFloat + startle * 0.028;
    modelPivot.position.x = -startleSide * startle * 0.022;

    root.style.setProperty('--stage-x', `${reducedMotion ? 0 : lookX * -2.4}px`);
    root.style.setProperty('--stage-y', `${reducedMotion ? 0 : lookY * -1.7}px`);
  }

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

function resize() {
  const width = Math.max(host.clientWidth, 1);
  const height = Math.max(host.clientHeight, 1);
  const aspect = width / height;
  const viewHeight = width < 600 ? 5.8 : 5.55;
  const halfH = viewHeight * 0.5;
  const halfW = halfH * aspect;

  renderer.setSize(width, height, false);
  camera.left = -halfW;
  camera.right = halfW;
  camera.top = halfH;
  camera.bottom = -halfH;
  camera.updateProjectionMatrix();
}

new ResizeObserver(resize).observe(host);
resize();
requestAnimationFrame(animate);
