const root = document.documentElement;
const hero = document.getElementById('hero');
const catWrap = document.getElementById('catWrap');
const catHead = document.getElementById('catHead');
const lids = [...document.querySelectorAll('[data-lid]')];

const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const state = {
  targetX: 0,
  targetY: 0,
  currentX: 0,
  currentY: 0,
  eyeX: 0,
  eyeY: 0,
  pointerInside: false,
  idleSince: performance.now(),
  lastPointerX: window.innerWidth * 0.5,
  lastPointerY: window.innerHeight * 0.5,
  lastPointerTime: performance.now(),
  pointerSpeed: 0,
  proximity: 0,
  idleTargetX: 0,
  idleTargetY: 0,
  nextIdleShift: performance.now() + randomBetween(900, 1800),
  earFlick: 0,
  nextEarFlick: performance.now() + randomBetween(2200, 5200),
  startle: 0,
  startleSide: 0,
  touchAttentionUntil: 0,
  lastBlink: performance.now(),
  nextBlinkIn: randomBetween(2400, 5200),
  blinkLocked: false,
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function getHeadMetrics(clientX, clientY) {
  const rect = catHead.getBoundingClientRect();
  const centerX = rect.left + rect.width * 0.5;
  const centerY = rect.top + rect.height * 0.48;
  const dx = clientX - centerX;
  const dy = clientY - centerY;
  const distance = Math.hypot(dx, dy);
  const radius = Math.max(rect.width * 1.45, 420);

  return {
    rect,
    dx,
    dy,
    distance,
    proximity: 1 - clamp(distance / radius, 0, 1),
  };
}

function normalizedLook(clientX, clientY) {
  const { dx, dy, proximity } = getHeadMetrics(clientX, clientY);

  // tanh keeps distant cursor positions smooth instead of pinning the head to max rotation.
  const x = Math.tanh(dx / Math.max(window.innerWidth * 0.32, 280));
  const y = Math.tanh(dy / Math.max(window.innerHeight * 0.34, 240));

  return {
    x: clamp(x, -1, 1),
    y: clamp(y, -1, 1),
    proximity,
  };
}

function setPointerTarget(clientX, clientY, now = performance.now()) {
  const next = normalizedLook(clientX, clientY);
  const dt = Math.max(now - state.lastPointerTime, 16);
  const distance = Math.hypot(
    clientX - state.lastPointerX,
    clientY - state.lastPointerY
  );

  state.pointerSpeed = clamp((distance / dt) * 16, 0, 60);
  state.targetX = next.x;
  state.targetY = next.y;
  state.proximity = next.proximity;
  state.idleSince = now;
  state.lastPointerX = clientX;
  state.lastPointerY = clientY;
  state.lastPointerTime = now;
}

function onPointerMove(event) {
  if (reducedMotion) return;

  if (coarsePointer) {
    if (performance.now() > state.touchAttentionUntil) return;
  }

  state.pointerInside = true;
  setPointerTarget(event.clientX, event.clientY, performance.now());
}

function onPointerLeave() {
  if (coarsePointer) return;
  state.pointerInside = false;
  state.proximity = 0;
  state.idleSince = performance.now();
}

function onCatPointerDown(event) {
  if (reducedMotion) return;

  const now = performance.now();
  state.pointerInside = true;
  state.touchAttentionUntil = now + 1900;
  setPointerTarget(event.clientX, event.clientY, now);

  const metrics = getHeadMetrics(event.clientX, event.clientY);
  state.startle = 1;
  state.startleSide = clamp(metrics.dx / Math.max(metrics.rect.width * 0.5, 1), -1, 1);
  state.earFlick += state.startleSide >= 0 ? -4.5 : 4.5;

  catWrap.classList.remove('is-poked');
  // Force a restart even on rapid repeated taps.
  void catWrap.offsetWidth;
  catWrap.classList.add('is-poked');

  window.setTimeout(() => catWrap.classList.remove('is-poked'), 520);
}

function chooseIdleLook(now) {
  if (now < state.nextIdleShift) return;

  state.idleTargetX = randomBetween(-0.34, 0.34);
  state.idleTargetY = randomBetween(-0.16, 0.14);
  state.nextIdleShift = now + randomBetween(1500, 3600);
}

function updateEarFlick(now, idle) {
  if (now >= state.nextEarFlick) {
    state.earFlick = randomBetween(-1, 1) * randomBetween(2.8, 5.8);
    state.nextEarFlick = now + randomBetween(idle ? 2200 : 4200, idle ? 5200 : 8500);
  }

  state.earFlick = lerp(state.earFlick, 0, 0.055);
}

function performBlink(doubleBlink = false) {
  state.blinkLocked = true;
  lids.forEach((lid) => lid.classList.add('is-blinking'));

  window.setTimeout(() => {
    lids.forEach((lid) => lid.classList.remove('is-blinking'));

    if (doubleBlink) {
      window.setTimeout(() => {
        lids.forEach((lid) => lid.classList.add('is-blinking'));
        window.setTimeout(() => {
          lids.forEach((lid) => lid.classList.remove('is-blinking'));
          state.lastBlink = performance.now();
          state.nextBlinkIn = randomBetween(2700, 6200);
          state.blinkLocked = false;
        }, 350);
      }, 120);
      return;
    }

    state.lastBlink = performance.now();
    state.nextBlinkIn = randomBetween(2600, 6000);
    state.blinkLocked = false;
  }, 350);
}

function blink(now) {
  if (state.blinkLocked || now - state.lastBlink < state.nextBlinkIn) return;
  performBlink(Math.random() < 0.17);
}

function animate(now) {
  const idleFor = now - state.idleSince;
  const touchTracking = coarsePointer && now < state.touchAttentionUntil;
  const idle = !touchTracking && (coarsePointer || !state.pointerInside || idleFor > 2300);

  if (idle && !reducedMotion) {
    chooseIdleLook(now);

    const driftX = Math.sin(now * 0.00037) * 0.055;
    const driftY = Math.cos(now * 0.00052) * 0.035;

    state.targetX = state.idleTargetX + driftX;
    state.targetY = state.idleTargetY + driftY;
    state.proximity = lerp(state.proximity, 0, 0.06);
  }

  if (reducedMotion) {
    state.targetX = 0;
    state.targetY = 0;
    state.proximity = 0;
  }

  updateEarFlick(now, idle);

  // Eyes lead the movement. The head catches up later.
  const eyeEase = reducedMotion ? 0.035 : 0.27;
  const headEase = reducedMotion ? 0.025 : 0.072;

  state.eyeX = lerp(state.eyeX, state.targetX, eyeEase);
  state.eyeY = lerp(state.eyeY, state.targetY, eyeEase);
  state.currentX = lerp(state.currentX, state.targetX, headEase);
  state.currentY = lerp(state.currentY, state.targetY, headEase);
  state.pointerSpeed = lerp(state.pointerSpeed, 0, 0.08);
  state.startle = lerp(state.startle, 0, 0.105);

  const x = clamp(state.currentX, -1, 1);
  const y = clamp(state.currentY, -1, 1);
  const ex = clamp(state.eyeX, -1, 1);
  const ey = clamp(state.eyeY, -1, 1);
  const attention = clamp(state.proximity, 0, 1);
  const startle = clamp(state.startle, 0, 1);

  const eyeX = ex * (13.5 + attention * 1.5);
  const eyeY = ey * (9.2 + attention * 0.7);

  // Head rotation stays deliberately smaller than eye movement.
  const headX = x * 9.5 - state.startleSide * startle * 2.8;
  const headY = y * 5.2 - startle * 4.4;
  const rotateY = x * 12.8 - state.startleSide * startle * 1.9;
  const rotateX = y * -8.4 - attention * 0.65 + startle * 1.3;
  const rotateZ = x * -1.75 + y * 0.35 - state.startleSide * startle * 0.8;

  const breath = reducedMotion ? 1 : 1 + Math.sin(now * 0.00115) * 0.008 - startle * 0.01;
  const bodyFloat = reducedMotion ? 0 : Math.sin(now * 0.00115) * 2.8 + startle * 1.4;
  const bodyX = x * -1.8 + state.startleSide * startle * 1.3;
  const bodyRotate = x * -0.36 + state.startleSide * startle * 0.35;

  const earPulse = reducedMotion ? 0 : Math.sin(now * 0.00175) * 0.8;
  const focusEar = attention * 1.7;
  const startleEar = startle * 6.8;
  const leftEar = -8 - x * 3.8 + y * 1.5 + earPulse + state.earFlick - focusEar + startleEar;
  const rightEar = 8 - x * 3.8 - y * 1.5 - earPulse + state.earFlick * 0.48 + focusEar - startleEar;

  const tailSway = reducedMotion
    ? 0
    : Math.sin(now * 0.00105) * 5.2
      + Math.sin(now * 0.00041) * 2.2
      + x * 2.4
      + startle * state.startleSide * 8;

  const irisScale = reducedMotion
    ? 1
    : 1 + attention * 0.026 + Math.min(state.pointerSpeed / 60, 1) * 0.026 + startle * 0.035;

  const eyeOpen = reducedMotion
    ? 1
    : clamp(1 + attention * 0.045 + startle * 0.095 - Math.max(y, 0) * 0.035, 0.94, 1.14);

  const browLift = reducedMotion ? 0 : (-y * 2.4 - attention * 1.1 - startle * 2.6);
  const browTilt = reducedMotion ? 0 : x * 2.6 + startle * state.startleSide * 2;

  const whiskerShift = clamp(y * 2.3 + state.pointerSpeed * 0.025 + startle * 1.8, -3.5, 4.5);

  // Scene parallax is deliberately tiny so it never competes with the character.
  const sceneX = reducedMotion ? 0 : x * -4.5;
  const sceneY = reducedMotion ? 0 : y * -3;
  const glowX = reducedMotion ? 0 : x * 18;
  const glowY = reducedMotion ? 0 : y * 12;

  root.style.setProperty('--eye-x', `${eyeX}px`);
  root.style.setProperty('--eye-y', `${eyeY}px`);
  root.style.setProperty('--head-x', `${headX}px`);
  root.style.setProperty('--head-y', `${headY}px`);
  root.style.setProperty('--head-ry', `${rotateY}deg`);
  root.style.setProperty('--head-rx', `${rotateX}deg`);
  root.style.setProperty('--head-rz', `${rotateZ}deg`);
  root.style.setProperty('--body-y', `${bodyFloat}px`);
  root.style.setProperty('--body-x', `${bodyX}px`);
  root.style.setProperty('--body-rz', `${bodyRotate}deg`);
  root.style.setProperty('--breath-scale', breath.toFixed(4));
  root.style.setProperty('--ear-left', `${leftEar}deg`);
  root.style.setProperty('--ear-right', `${rightEar}deg`);
  root.style.setProperty('--tail-sway', `${tailSway}deg`);
  root.style.setProperty('--pupil-scale', irisScale.toFixed(4));
  root.style.setProperty('--eye-open', eyeOpen.toFixed(4));
  root.style.setProperty('--brow-lift', `${browLift}px`);
  root.style.setProperty('--brow-tilt', `${browTilt}deg`);
  root.style.setProperty('--whisker-shift', `${whiskerShift}deg`);
  root.style.setProperty('--scene-x', `${sceneX}px`);
  root.style.setProperty('--scene-y', `${sceneY}px`);
  root.style.setProperty('--glow-x', `${glowX}px`);
  root.style.setProperty('--glow-y', `${glowY}px`);
  root.style.setProperty('--attention', attention.toFixed(4));
  root.style.setProperty('--attention-light-opacity', (0.25 + attention * 0.4).toFixed(4));
  root.style.setProperty('--attention-halo-scale', (0.92 + attention * 0.12).toFixed(4));
  root.style.setProperty('--attention-halo-opacity', (0.35 + attention * 0.45).toFixed(4));

  blink(now);
  requestAnimationFrame(animate);
}

window.addEventListener('pointermove', onPointerMove, { passive: true });
window.addEventListener('pointerleave', onPointerLeave);
window.addEventListener('blur', onPointerLeave);
catWrap.addEventListener('pointerdown', onCatPointerDown, { passive: true });

requestAnimationFrame(animate);
