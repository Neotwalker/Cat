const root = document.documentElement;
const hero = document.getElementById('hero');
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
  idleTargetX: 0,
  idleTargetY: 0,
  nextIdleShift: performance.now() + randomBetween(900, 1800),
  earFlick: 0,
  nextEarFlick: performance.now() + randomBetween(2200, 5200),
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

function normalizedLook(clientX, clientY) {
  const rect = catHead.getBoundingClientRect();
  const centerX = rect.left + rect.width * 0.5;
  const centerY = rect.top + rect.height * 0.48;

  const dx = clientX - centerX;
  const dy = clientY - centerY;

  // tanh keeps distant cursor positions smooth instead of pinning the head to max rotation.
  const x = Math.tanh(dx / Math.max(window.innerWidth * 0.32, 280));
  const y = Math.tanh(dy / Math.max(window.innerHeight * 0.34, 240));

  return {
    x: clamp(x, -1, 1),
    y: clamp(y, -1, 1),
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
  state.idleSince = now;
  state.lastPointerX = clientX;
  state.lastPointerY = clientY;
  state.lastPointerTime = now;
}

function onPointerMove(event) {
  if (coarsePointer || reducedMotion) return;
  state.pointerInside = true;
  setPointerTarget(event.clientX, event.clientY, performance.now());
}

function onPointerLeave() {
  state.pointerInside = false;
  state.idleSince = performance.now();
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
  const idle = coarsePointer || !state.pointerInside || idleFor > 2300;

  if (idle && !reducedMotion) {
    chooseIdleLook(now);

    const driftX = Math.sin(now * 0.00037) * 0.055;
    const driftY = Math.cos(now * 0.00052) * 0.035;

    state.targetX = state.idleTargetX + driftX;
    state.targetY = state.idleTargetY + driftY;
  }

  if (reducedMotion) {
    state.targetX = 0;
    state.targetY = 0;
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

  const x = clamp(state.currentX, -1, 1);
  const y = clamp(state.currentY, -1, 1);
  const ex = clamp(state.eyeX, -1, 1);
  const ey = clamp(state.eyeY, -1, 1);

  const eyeX = ex * 13.5;
  const eyeY = ey * 9.2;

  // Head rotation stays deliberately smaller than eye movement.
  const headX = x * 9.5;
  const headY = y * 5.2;
  const rotateY = x * 12.8;
  const rotateX = y * -8.4;
  const rotateZ = x * -1.75 + y * 0.35;

  const breath = reducedMotion ? 1 : 1 + Math.sin(now * 0.00115) * 0.008;
  const bodyFloat = reducedMotion ? 0 : Math.sin(now * 0.00115) * 2.8;
  const bodyX = x * -1.8;
  const bodyRotate = x * -0.36;

  const earPulse = reducedMotion ? 0 : Math.sin(now * 0.00175) * 0.8;
  const leftEar = -8 - x * 3.8 + y * 1.5 + earPulse + state.earFlick;
  const rightEar = 8 - x * 3.8 - y * 1.5 - earPulse + state.earFlick * 0.48;

  const tailSway = reducedMotion
    ? 0
    : Math.sin(now * 0.00105) * 5.2 + Math.sin(now * 0.00041) * 2.2 + x * 2.4;

  const pupilScale = reducedMotion
    ? 1
    : 1 + Math.min(state.pointerSpeed / 60, 1) * 0.035;

  const whiskerShift = clamp(y * 2.3 + state.pointerSpeed * 0.025, -3, 3);

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
  root.style.setProperty('--pupil-scale', pupilScale.toFixed(4));
  root.style.setProperty('--whisker-shift', `${whiskerShift}deg`);

  blink(now);
  requestAnimationFrame(animate);
}

window.addEventListener('pointermove', onPointerMove, { passive: true });
window.addEventListener('pointerleave', onPointerLeave);
window.addEventListener('blur', onPointerLeave);

requestAnimationFrame(animate);
