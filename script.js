const root = document.documentElement;
const hero = document.getElementById('hero');
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
  idleSince: performance.now(),
  pointerInside: false,
  lastBlink: performance.now(),
  nextBlinkIn: randomBetween(2600, 5200),
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

function setPointerTarget(clientX, clientY) {
  const rect = hero.getBoundingClientRect();
  const x = ((clientX - rect.left) / rect.width) * 2 - 1;
  const y = ((clientY - rect.top) / rect.height) * 2 - 1;

  state.targetX = clamp(x, -1, 1);
  state.targetY = clamp(y, -1, 1);
  state.idleSince = performance.now();
}

function onPointerMove(event) {
  if (coarsePointer || reducedMotion) return;
  state.pointerInside = true;
  setPointerTarget(event.clientX, event.clientY);
}

function onPointerLeave() {
  state.pointerInside = false;
  state.targetX = 0;
  state.targetY = 0;
}

function blink(now) {
  if (state.blinkLocked) return;

  if (now - state.lastBlink < state.nextBlinkIn) return;

  state.blinkLocked = true;
  lids.forEach((lid) => lid.classList.add('is-blinking'));

  window.setTimeout(() => {
    lids.forEach((lid) => lid.classList.remove('is-blinking'));
    state.lastBlink = performance.now();
    state.nextBlinkIn = randomBetween(2800, 6100);
    state.blinkLocked = false;
  }, 360);
}

function animate(now) {
  const idleFor = now - state.idleSince;
  const shouldIdle = coarsePointer || !state.pointerInside || idleFor > 2400;

  if (shouldIdle && !reducedMotion) {
    const idleX = Math.sin(now * 0.00072) * 0.28 + Math.sin(now * 0.00019) * 0.08;
    const idleY = Math.cos(now * 0.00091) * 0.13;

    state.targetX = idleX;
    state.targetY = idleY;
  }

  if (reducedMotion) {
    state.targetX = 0;
    state.targetY = 0;
  }

  // Eyes react faster than the head. This delay is what makes the character feel alive.
  state.eyeX = lerp(state.eyeX, state.targetX, reducedMotion ? 0.03 : 0.22);
  state.eyeY = lerp(state.eyeY, state.targetY, reducedMotion ? 0.03 : 0.22);

  state.currentX = lerp(state.currentX, state.targetX, reducedMotion ? 0.025 : 0.075);
  state.currentY = lerp(state.currentY, state.targetY, reducedMotion ? 0.025 : 0.075);

  const x = state.currentX;
  const y = state.currentY;

  const eyeX = clamp(state.eyeX * 13, -13, 13);
  const eyeY = clamp(state.eyeY * 9, -9, 9);

  const headX = x * 10;
  const headY = y * 5;
  const rotateY = x * 12;
  const rotateX = y * -8;

  const bodyFloat = reducedMotion ? 0 : Math.sin(now * 0.00135) * 3.4;

  // Ears do not mirror the head perfectly; a small offset makes them feel independent.
  const earPulse = reducedMotion ? 0 : Math.sin(now * 0.0019) * 1.1;
  const leftEar = -8 - x * 4 + y * 1.8 + earPulse;
  const rightEar = 8 - x * 4 - y * 1.8 - earPulse;

  root.style.setProperty('--eye-x', `${eyeX}px`);
  root.style.setProperty('--eye-y', `${eyeY}px`);
  root.style.setProperty('--head-x', `${headX}px`);
  root.style.setProperty('--head-y', `${headY}px`);
  root.style.setProperty('--head-ry', `${rotateY}deg`);
  root.style.setProperty('--head-rx', `${rotateX}deg`);
  root.style.setProperty('--body-y', `${bodyFloat}px`);
  root.style.setProperty('--ear-left', `${leftEar}deg`);
  root.style.setProperty('--ear-right', `${rightEar}deg`);

  blink(now);
  requestAnimationFrame(animate);
}

window.addEventListener('pointermove', onPointerMove, { passive: true });
window.addEventListener('pointerleave', onPointerLeave);
window.addEventListener('blur', onPointerLeave);

requestAnimationFrame(animate);
