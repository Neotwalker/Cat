import * as THREE from 'three';

const root = document.documentElement;
const stage = document.getElementById('stage');
const host = document.getElementById('canvasHost');
const debugToggle = document.getElementById('debugToggle');
const fallback = document.getElementById('fallback');
const hintText = document.getElementById('hintText');

const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (coarsePointer) {
  hintText.textContent = 'Коснись кота';
}

const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
const lerp = (a, b, t) => a + (b - a) * t;
const randomBetween = (min, max) => Math.random() * (max - min) + min;
const deg = THREE.MathUtils.degToRad;

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
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
host.appendChild(renderer.domElement);

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(27, 1, 0.1, 100);
camera.position.set(0, 0.35, 9.2);
camera.lookAt(0, 0.15, 0);

const hemi = new THREE.HemisphereLight(0xdde8ff, 0x161920, 2.1);
scene.add(hemi);

const key = new THREE.DirectionalLight(0xffffff, 3.3);
key.position.set(-3.8, 6.5, 7.5);
scene.add(key);

const fill = new THREE.DirectionalLight(0xb8caff, 1.15);
fill.position.set(4.8, 2.6, 4.0);
scene.add(fill);

const rim = new THREE.DirectionalLight(0xffd7d5, 0.65);
rim.position.set(2.2, 5.5, -4);
scene.add(rim);

const materials = {
  fur: new THREE.MeshStandardMaterial({
    color: 0x5d6572,
    roughness: 0.76,
    metalness: 0,
  }),
  furDark: new THREE.MeshStandardMaterial({
    color: 0x3f4652,
    roughness: 0.8,
  }),
  furLight: new THREE.MeshStandardMaterial({
    color: 0x717a87,
    roughness: 0.8,
  }),
  mouth: new THREE.MeshStandardMaterial({
    color: 0x3a3034,
    roughness: 0.72,
  }),
  white: new THREE.MeshStandardMaterial({
    color: 0xf0efeb,
    roughness: 0.82,
  }),
  pink: new THREE.MeshStandardMaterial({
    color: 0xc9868d,
    roughness: 0.68,
  }),
  eyeWhite: new THREE.MeshStandardMaterial({
    color: 0xfafaf6,
    roughness: 0.25,
  }),
  iris: new THREE.MeshStandardMaterial({
    color: 0x78a96d,
    roughness: 0.35,
    metalness: 0.02,
  }),
  pupil: new THREE.MeshBasicMaterial({ color: 0x080a09 }),
  eyelid: new THREE.MeshStandardMaterial({
    color: 0x535c68,
    roughness: 0.84,
  }),
  bone: new THREE.MeshBasicMaterial({ color: 0x70e6ff, wireframe: true }),
};

const makeSphere = (radius, material, scale = [1, 1, 1]) => {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 40, 28),
    material,
  );
  mesh.scale.set(...scale);
  return mesh;
};

const makeCone = (radius, height, material, segments = 3) => (
  new THREE.Mesh(new THREE.ConeGeometry(radius, height, segments), material)
);

function makeCapsule(radius, length, material, scale = [1, 1, 1]) {
  const mesh = new THREE.Mesh(
    new THREE.CapsuleGeometry(radius, length, 6, 14),
    material,
  );
  mesh.scale.set(...scale);
  return mesh;
}

function addMouthCurve(points) {
  const curve = new THREE.CatmullRomCurve3(
    points.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
  );
  const mesh = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 14, 0.014, 6, false),
    materials.mouth,
  );
  headBone.add(mesh);
  return mesh;
}

const rigRoot = new THREE.Bone();
rigRoot.name = 'ROOT';
scene.add(rigRoot);

const bodyBone = new THREE.Bone();
bodyBone.name = 'BODY';
bodyBone.position.set(0, -1.15, 0);
rigRoot.add(bodyBone);

const chestBone = new THREE.Bone();
chestBone.name = 'CHEST';
chestBone.position.set(0, 0.35, 0.2);
bodyBone.add(chestBone);

const neckBone = new THREE.Bone();
neckBone.name = 'NECK';
neckBone.position.set(0, 1.25, 0);
bodyBone.add(neckBone);

const headBone = new THREE.Bone();
headBone.name = 'HEAD';
headBone.position.set(0, 0.75, 0.02);
neckBone.add(headBone);

const leftEarBone = new THREE.Bone();
leftEarBone.name = 'EAR_L';
leftEarBone.position.set(-0.84, 0.72, -0.02);
headBone.add(leftEarBone);

const rightEarBone = new THREE.Bone();
rightEarBone.name = 'EAR_R';
rightEarBone.position.set(0.84, 0.72, -0.02);
headBone.add(rightEarBone);

const leftEyeBone = new THREE.Bone();
leftEyeBone.name = 'EYE_L';
leftEyeBone.position.set(-0.50, 0.08, 0.90);
headBone.add(leftEyeBone);

const rightEyeBone = new THREE.Bone();
rightEyeBone.name = 'EYE_R';
rightEyeBone.position.set(0.50, 0.08, 0.90);
headBone.add(rightEyeBone);

const tailBones = [];
const tailBaseAngles = [-0.62, -0.22, 0.08, 0.22, 0.18];
let tailParent = bodyBone;
for (let i = 0; i < 5; i += 1) {
  const bone = new THREE.Bone();
  bone.name = i === 4 ? 'TAIL_TIP' : `TAIL_0${i + 1}`;
  bone.position.set(
    i === 0 ? 0.98 : 0.54,
    i === 0 ? -0.68 : 0,
    i === 0 ? -0.34 : 0,
  );
  bone.rotation.z = tailBaseAngles[i];
  tailParent.add(bone);
  tailBones.push(bone);
  tailParent = bone;
}

// Shape pass v1: build a soft, front-facing cartoon silhouette from layered 3D volumes.
const shoulderMesh = makeSphere(0.92, materials.fur, [1.18, 0.82, 0.95]);
shoulderMesh.position.set(0, 0.58, -0.02);
bodyBone.add(shoulderMesh);

const bodyMesh = makeSphere(1, materials.fur, [1.18, 1.34, 1.00]);
bodyMesh.position.set(0, -0.08, 0);
bodyBone.add(bodyMesh);

const bellyMesh = makeSphere(0.93, materials.fur, [1.34, 0.98, 1.06]);
bellyMesh.position.set(0, -0.68, 0.02);
bodyBone.add(bellyMesh);

const chestMesh = makeSphere(0.80, materials.white, [0.78, 1.16, 0.46]);
chestMesh.position.set(0, -0.04, 0.88);
chestBone.add(chestMesh);

const chestTuftTop = makeSphere(0.34, materials.white, [1.15, 0.54, 0.58]);
chestTuftTop.position.set(0, 0.54, 1.02);
chestBone.add(chestTuftTop);

const chestTuftBottom = makeSphere(0.40, materials.white, [0.96, 0.72, 0.54]);
chestTuftBottom.position.set(0, -0.68, 0.96);
chestBone.add(chestTuftBottom);

const frontPawLeft = makeCapsule(0.22, 0.86, materials.fur, [0.95, 1, 0.86]);
frontPawLeft.position.set(-0.43, -0.86, 0.83);
bodyBone.add(frontPawLeft);

const frontPawRight = makeCapsule(0.22, 0.86, materials.fur, [0.95, 1, 0.86]);
frontPawRight.position.set(0.43, -0.86, 0.83);
bodyBone.add(frontPawRight);

const frontFootLeft = makeSphere(0.29, materials.fur, [1.02, 0.58, 1.24]);
frontFootLeft.position.set(-0.43, -1.36, 0.91);
bodyBone.add(frontFootLeft);

const frontFootRight = makeSphere(0.29, materials.fur, [1.02, 0.58, 1.24]);
frontFootRight.position.set(0.43, -1.36, 0.91);
bodyBone.add(frontFootRight);

const hindFootLeft = makeSphere(0.42, materials.fur, [1.12, 0.56, 1.34]);
hindFootLeft.position.set(-0.88, -1.25, 0.38);
bodyBone.add(hindFootLeft);

const hindFootRight = makeSphere(0.42, materials.fur, [1.12, 0.56, 1.34]);
hindFootRight.position.set(0.88, -1.25, 0.38);
bodyBone.add(hindFootRight);

// Head: cranium + side cheek volumes create a wider Disney-like silhouette without a single-sphere look.
const headMesh = makeSphere(1, materials.fur, [1.43, 1.20, 1.08]);
headMesh.position.set(0, 0.08, 0);
headBone.add(headMesh);

const skullTop = makeSphere(0.74, materials.furLight, [1.18, 0.60, 0.72]);
skullTop.position.set(0, 0.58, 0.18);
headBone.add(skullTop);

const faceSideLeft = makeSphere(0.64, materials.fur, [1.03, 0.80, 0.76]);
faceSideLeft.position.set(-0.62, -0.22, 0.36);
headBone.add(faceSideLeft);

const faceSideRight = makeSphere(0.64, materials.fur, [1.03, 0.80, 0.76]);
faceSideRight.position.set(0.62, -0.22, 0.36);
headBone.add(faceSideRight);

const forehead = makeSphere(0.66, materials.furDark, [0.64, 0.30, 0.16]);
forehead.position.set(0, 0.62, 0.93);
headBone.add(forehead);

const leftEar = makeCone(0.60, 1.44, materials.fur, 3);
leftEar.position.set(0, 0.49, 0);
leftEar.scale.set(0.96, 1, 0.58);
leftEar.rotation.z = deg(-3);
leftEarBone.add(leftEar);

const rightEar = makeCone(0.60, 1.44, materials.fur, 3);
rightEar.position.set(0, 0.49, 0);
rightEar.scale.set(0.96, 1, 0.58);
rightEar.rotation.z = deg(3);
rightEarBone.add(rightEar);

const innerLeft = makeCone(0.39, 1.02, materials.pink, 3);
innerLeft.position.set(0, 0.48, 0.20);
innerLeft.scale.set(0.72, 0.82, 0.30);
leftEarBone.add(innerLeft);

const innerRight = makeCone(0.39, 1.02, materials.pink, 3);
innerRight.position.set(0, 0.48, 0.20);
innerRight.scale.set(0.72, 0.82, 0.30);
rightEarBone.add(innerRight);

const eyeParts = [];

function buildEye(bone) {
  const white = makeSphere(0.51, materials.eyeWhite, [1.02, 1.17, 0.70]);
  bone.add(white);

  // Real eyelids: the eyeball itself never gets squashed during a blink.
  const upperLid = new THREE.Mesh(
    new THREE.SphereGeometry(0.518, 40, 18, 0, Math.PI * 2, 0, Math.PI / 2),
    materials.eyelid,
  );
  upperLid.scale.set(1.04, 0.035, 0.72);
  upperLid.renderOrder = 4;
  bone.add(upperLid);

  const lowerLid = new THREE.Mesh(
    new THREE.SphereGeometry(0.518, 40, 18, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
    materials.eyelid,
  );
  lowerLid.scale.set(1.04, 0.035, 0.72);
  lowerLid.renderOrder = 4;
  bone.add(lowerLid);

  const iris = new THREE.Mesh(
    new THREE.CircleGeometry(0.275, 48),
    materials.iris,
  );
  iris.position.z = 0.365;
  bone.add(iris);

  const pupil = new THREE.Mesh(
    new THREE.CircleGeometry(0.098, 36),
    materials.pupil,
  );
  pupil.scale.y = 1.72;
  pupil.position.z = 0.374;
  bone.add(pupil);

  const shine = new THREE.Mesh(
    new THREE.CircleGeometry(0.040, 24),
    new THREE.MeshBasicMaterial({ color: 0xffffff }),
  );
  shine.position.set(-0.085, 0.105, 0.382);
  bone.add(shine);

  eyeParts.push({ bone, white, iris, pupil, shine, upperLid, lowerLid });
}

buildEye(leftEyeBone);
buildEye(rightEyeBone);

const cheekLeft = makeSphere(0.54, materials.white, [1.05, 0.72, 0.64]);
cheekLeft.position.set(-0.31, -0.46, 0.94);
headBone.add(cheekLeft);

const cheekRight = makeSphere(0.54, materials.white, [1.05, 0.72, 0.64]);
cheekRight.position.set(0.31, -0.46, 0.94);
headBone.add(cheekRight);

const chin = makeSphere(0.47, materials.white, [0.90, 0.58, 0.58]);
chin.position.set(0, -0.68, 0.93);
headBone.add(chin);

const nose = makeSphere(0.145, materials.pink, [1.02, 0.72, 0.66]);
nose.position.set(0, -0.38, 1.33);
headBone.add(nose);

addMouthCurve([
  [-0.01, -0.47, 1.31],
  [-0.08, -0.58, 1.29],
  [-0.20, -0.61, 1.25],
]);
addMouthCurve([
  [0.01, -0.47, 1.31],
  [0.08, -0.58, 1.29],
  [0.20, -0.61, 1.25],
]);

// Small line whiskers keep the primitive prototype readable as a cat.
function addWhiskers(side) {
  const sign = side === 'left' ? -1 : 1;
  const points = [];
  [0.04, -0.08, -0.2].forEach((y, index) => {
    points.push(
      new THREE.Vector3(sign * 0.36, -0.42 + y, 1.08),
      new THREE.Vector3(sign * (1.28 + index * 0.08), -0.39 + y * 0.5, 1.03),
    );
  });
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color: 0xe8e8e4,
    transparent: true,
    opacity: 0.72,
  });
  headBone.add(new THREE.LineSegments(geometry, material));
}
addWhiskers('left');
addWhiskers('right');

tailBones.forEach((bone, index) => {
  const segment = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.24 - index * 0.018, 0.56, 6, 12),
    materials.fur,
  );
  segment.rotation.z = deg(90);
  segment.position.x = 0.30;
  segment.scale.z = 1.08;
  bone.add(segment);
});

const skeletonHelper = new THREE.SkeletonHelper(rigRoot);
skeletonHelper.material.depthTest = false;
skeletonHelper.material.transparent = true;
skeletonHelper.material.opacity = 0.9;
skeletonHelper.visible = false;
scene.add(skeletonHelper);

debugToggle.addEventListener('click', () => {
  skeletonHelper.visible = !skeletonHelper.visible;
  debugToggle.setAttribute('aria-pressed', String(skeletonHelper.visible));
  debugToggle.textContent = skeletonHelper.visible ? 'Скрыть скелет' : 'Показать скелет';
});

const state = {
  targetX: 0,
  targetY: 0,
  headX: 0,
  headY: 0,
  neckX: 0,
  neckY: 0,
  eyeX: 0,
  eyeY: 0,
  pointerInside: false,
  idleSince: performance.now(),
  idleTargetX: 0,
  idleTargetY: 0,
  nextIdleShift: performance.now() + randomBetween(900, 1800),
  earFlick: 0,
  nextEarFlick: performance.now() + randomBetween(2400, 5200),
  startle: 0,
  startleSide: 0,
  touchAttentionUntil: 0,
  blinkStart: -1000,
  blinkDuration: 180,
  nextBlink: performance.now() + randomBetween(2200, 5000),
};

function getLookTarget(clientX, clientY) {
  const rect = renderer.domElement.getBoundingClientRect();
  const centerX = rect.left + rect.width * 0.5;
  const centerY = rect.top + rect.height * 0.43;
  const dx = clientX - centerX;
  const dy = clientY - centerY;

  return {
    x: clamp(Math.tanh(dx / Math.max(rect.width * 0.31, 180)), -1, 1),
    y: clamp(Math.tanh(dy / Math.max(rect.height * 0.31, 170)), -1, 1),
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
  state.earFlick += state.startleSide >= 0 ? -0.12 : 0.12;
}

renderer.domElement.addEventListener('pointermove', onPointerMove, { passive: true });
renderer.domElement.addEventListener('pointerleave', onPointerLeave);
renderer.domElement.addEventListener('pointerdown', onPointerDown, { passive: true });
window.addEventListener('blur', onPointerLeave);

function chooseIdleLook(now) {
  if (now < state.nextIdleShift) return;
  state.idleTargetX = randomBetween(-0.34, 0.34);
  state.idleTargetY = randomBetween(-0.16, 0.14);
  state.nextIdleShift = now + randomBetween(1500, 3600);
}

function updateEarFlick(now, idle) {
  if (now >= state.nextEarFlick) {
    state.earFlick = randomBetween(-0.09, 0.09);
    state.nextEarFlick = now + randomBetween(idle ? 2200 : 4300, idle ? 5200 : 8500);
  }
  state.earFlick = lerp(state.earFlick, 0, 0.055);
}

function updateBlink(now) {
  if (now >= state.nextBlink) {
    state.blinkStart = now;
    state.blinkDuration = Math.random() < 0.17 ? 330 : 180;
    state.nextBlink = now + randomBetween(2700, 6100);
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

function animate(now) {
  const idleFor = now - state.idleSince;
  const touchTracking = coarsePointer && now < state.touchAttentionUntil;
  const idle = !touchTracking && (coarsePointer || !state.pointerInside || idleFor > 2300);

  if (idle && !reducedMotion) {
    chooseIdleLook(now);
    state.targetX = state.idleTargetX + Math.sin(now * 0.00037) * 0.055;
    state.targetY = state.idleTargetY + Math.cos(now * 0.00052) * 0.035;
  }

  if (reducedMotion) {
    state.targetX = 0;
    state.targetY = 0;
  }

  updateEarFlick(now, idle);

  // Eyes lead, head catches up, neck follows last.
  state.eyeX = lerp(state.eyeX, state.targetX, reducedMotion ? 0.03 : 0.26);
  state.eyeY = lerp(state.eyeY, state.targetY, reducedMotion ? 0.03 : 0.26);
  state.headX = lerp(state.headX, state.targetX, reducedMotion ? 0.025 : 0.075);
  state.headY = lerp(state.headY, state.targetY, reducedMotion ? 0.025 : 0.075);
  state.neckX = lerp(state.neckX, state.targetX, reducedMotion ? 0.02 : 0.042);
  state.neckY = lerp(state.neckY, state.targetY, reducedMotion ? 0.02 : 0.042);
  state.startle = lerp(state.startle, 0, 0.1);

  const x = clamp(state.headX, -1, 1);
  const y = clamp(state.headY, -1, 1);
  const ex = clamp(state.eyeX, -1, 1);
  const ey = clamp(state.eyeY, -1, 1);
  const startle = clamp(state.startle, 0, 1);

  headBone.rotation.y = x * 0.28 - state.startleSide * startle * 0.035;
  headBone.rotation.x = -y * 0.18 + startle * 0.018;
  headBone.rotation.z = -x * 0.035 - state.startleSide * startle * 0.018;

  neckBone.rotation.y = state.neckX * 0.105;
  neckBone.rotation.x = -state.neckY * 0.065;

  leftEyeBone.rotation.y = ex * 0.34;
  rightEyeBone.rotation.y = ex * 0.34;
  leftEyeBone.rotation.x = -ey * 0.24;
  rightEyeBone.rotation.x = -ey * 0.24;

  const earPulse = reducedMotion ? 0 : Math.sin(now * 0.00175) * 0.02;
  leftEarBone.rotation.z = deg(-8) - x * 0.065 + y * 0.022 + earPulse + state.earFlick + startle * 0.09;
  rightEarBone.rotation.z = deg(8) - x * 0.065 - y * 0.022 - earPulse + state.earFlick * 0.45 - startle * 0.09;

  const breath = reducedMotion ? 1 : 1 + Math.sin(now * 0.00115) * 0.012 - startle * 0.012;
  shoulderMesh.scale.set(1.18, 0.82 * breath, 0.95);
  bodyMesh.scale.set(1.18, 1.34 * breath, 1.00);
  bellyMesh.scale.set(1.34, 0.98 * breath, 1.06);
  chestMesh.scale.set(0.78, 1.16 * breath, 0.46);
  bodyBone.position.y = -1.15 + (reducedMotion ? 0 : Math.sin(now * 0.00115) * 0.025) + startle * 0.018;
  bodyBone.rotation.z = -x * 0.008 + state.startleSide * startle * 0.01;

  tailBones.forEach((bone, index) => {
    const phase = now * (0.0010 + index * 0.00004) - index * 0.54;
    const amplitude = 0.12 - index * 0.012;
    bone.rotation.z =
      tailBaseAngles[index]
      + Math.sin(phase) * amplitude
      + Math.sin(now * 0.00041 - index * 0.28) * 0.045
      + x * 0.026
      + state.startleSide * startle * (0.11 - index * 0.015);
  });

  const blink = reducedMotion ? 0 : updateBlink(now);
  eyeParts.forEach(({ bone, upperLid, lowerLid }) => {
    bone.scale.y = 1;
    const lidY = 0.035 + blink * 1.02;
    upperLid.scale.y = lidY;
    lowerLid.scale.y = lidY;
  });

  rigRoot.position.y = reducedMotion ? 0 : Math.sin(now * 0.00072) * 0.025;
  rigRoot.position.x = -state.startleSide * startle * 0.028;

  const stageX = reducedMotion ? 0 : x * -4.5;
  const stageY = reducedMotion ? 0 : y * -3;
  root.style.setProperty('--stage-x', `${stageX}px`);
  root.style.setProperty('--stage-y', `${stageY}px`);

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

function resize() {
  const width = Math.max(host.clientWidth, 1);
  const height = Math.max(host.clientHeight, 1);

  renderer.setSize(width, height, false);
  camera.aspect = width / height;

  // Keep roughly the same framing on narrow screens.
  camera.position.z = width < 600 ? 10.2 : 9.2;
  camera.position.y = width < 600 ? 0.15 : 0.35;
  camera.updateProjectionMatrix();
}

const resizeObserver = new ResizeObserver(resize);
resizeObserver.observe(host);
resize();

requestAnimationFrame(animate);
