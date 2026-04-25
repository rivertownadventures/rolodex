// Shared momentum/snap engine. Owns the `position` scalar (in "card units"),
// calls onUpdate(position) every frame it changes, and fires onSelect(index)
// when settled. Swap the axis ('x' or 'y') when switching modes.

import { clamp, easeInOutCubic } from './util.js?v=25';

export function createController({ stageEl, onUpdate, onSelect, onPressCard }) {
  let axis = 'y';            // 'y' for spindle, 'x' for carousel
  let count = 0;
  let pxPerCard = 120;
  let position = 0;
  let loop = false;          // when true, position is unbounded (modes handle wrapping)

  let dragging = false;
  let pointerId = null;
  let pointerDownTarget = null;  // captured on pointerdown; survives pointer capture
  let dragStartClient = 0;
  let dragStartPos = 0;
  let didDrag = false;
  let samples = [];           // [{t, pos}]
  let velocity = 0;           // cards/ms
  let rafId = null;
  let snapping = null;        // { from, to, startT, dur }

  const FRICTION = 0.96;
  const MIN_V = 0.0005;       // cards/ms
  const SNAP_MS = 520;
  const DRAG_THRESHOLD_PX = 6;

  function clampPos(p) {
    if (loop) return p;
    return clamp(p, 0, Math.max(0, count - 1));
  }

  function setAxis(a) { axis = a === 'x' ? 'x' : 'y'; }
  function setCount(n) { count = Math.max(0, n | 0); position = clampPos(position); onUpdate(position); }
  function setPxPerCard(v) { pxPerCard = Math.max(40, v); }
  function setPosition(p) { position = clampPos(p); cancelAll(); onUpdate(position); }
  function setLoop(v) { loop = !!v; }
  function getPosition() { return position; }

  function cancelAll() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    snapping = null;
    velocity = 0;
  }

  function client(e) { return axis === 'y' ? e.clientY : e.clientX; }

  function onPointerDown(e) {
    if (e.button !== undefined && e.button !== 0) return;
    dragging = true;
    didDrag = false;
    pointerId = e.pointerId;
    pointerDownTarget = e.target;  // remember what was clicked BEFORE capture steals the target
    dragStartClient = client(e);
    dragStartPos = position;
    samples = [{ t: performance.now(), pos: position }];
    cancelAll();
    try { stageEl.setPointerCapture(pointerId); } catch {}
  }

  function onPointerMove(e) {
    if (!dragging || e.pointerId !== pointerId) return;
    const delta = client(e) - dragStartClient;
    if (!didDrag && Math.abs(delta) > DRAG_THRESHOLD_PX) didDrag = true;
    // Drag toward the direction that advances: down in spindle (cards fall
    // forward), left in carousel.
    const dir = axis === 'y' ? 1 : -1;
    position = clampPos(dragStartPos + (dir * delta / pxPerCard));
    samples.push({ t: performance.now(), pos: position });
    if (samples.length > 8) samples.shift();
    onUpdate(position);
  }

  function onPointerUp(e) {
    if (!dragging || e.pointerId !== pointerId) return;
    dragging = false;
    try { stageEl.releasePointerCapture(pointerId); } catch {}
    pointerId = null;

    if (!didDrag) {
      // Treat as a tap on the topmost card. Use the original pointerdown target
      // (pointer capture reassigns e.target to the stage element).
      const card = pointerDownTarget?.closest?.('.card');
      pointerDownTarget = null;
      if (card && onPressCard) onPressCard(card.dataset.id);
      settle();
      return;
    }
    // velocity from last ~120ms of samples
    const now = performance.now();
    const recent = samples.filter((s) => now - s.t < 120);
    if (recent.length >= 2) {
      const first = recent[0];
      const last = recent[recent.length - 1];
      const dt = Math.max(1, last.t - first.t);
      velocity = (last.pos - first.pos) / dt; // cards/ms
    } else {
      velocity = 0;
    }
    startMomentum();
  }

  function startMomentum() {
    cancelAllRaf();
    let lastT = performance.now();
    const step = (t) => {
      const dt = t - lastT;
      lastT = t;
      position = clampPos(position + velocity * dt);
      velocity *= Math.pow(FRICTION, dt / 16);
      onUpdate(position);
      const atBoundary = !loop && (position <= 0 || position >= count - 1);
      if (Math.abs(velocity) < MIN_V || atBoundary) {
        settle();
        return;
      }
      rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);
  }

  function cancelAllRaf() { if (rafId) cancelAnimationFrame(rafId); rafId = null; }

  function settle() {
    cancelAllRaf();
    const target = loop ? Math.round(position) : clamp(Math.round(position), 0, Math.max(0, count - 1));
    const from = position;
    if (Math.abs(target - from) < 0.001) {
      position = target;
      onUpdate(position);
      if (onSelect) onSelect(target);
      return;
    }
    const startT = performance.now();
    const step = (t) => {
      const k = clamp((t - startT) / SNAP_MS, 0, 1);
      const e = easeInOutCubic(k);
      position = from + (target - from) * e;
      onUpdate(position);
      if (k < 1) {
        rafId = requestAnimationFrame(step);
      } else {
        position = target;
        onUpdate(position);
        rafId = null;
        if (onSelect) onSelect(target);
      }
    };
    rafId = requestAnimationFrame(step);
  }

  function onWheel(e) {
    if (!count) return;
    e.preventDefault();
    // Trackpad delta is already in pixels. Scale to card units.
    const delta = axis === 'y' ? e.deltaY : e.deltaX;
    cancelAllRaf();
    position = clampPos(position + delta / pxPerCard);
    onUpdate(position);
    clearTimeout(onWheel._t);
    onWheel._t = setTimeout(settle, 120);
  }

  function onKey(e) {
    if (!count) return;
    // Don't hijack keys when the user is typing in an input/textarea.
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (['ArrowUp', 'ArrowLeft', 'PageUp'].includes(e.key)) {
      e.preventDefault();
      cancelAll();
      position = clampPos(Math.round(position) - 1);
      settle();
    } else if (['ArrowDown', 'ArrowRight', 'PageDown', ' '].includes(e.key)) {
      e.preventDefault();
      cancelAll();
      position = clampPos(Math.round(position) + 1);
      settle();
    } else if (e.key === 'Home') {
      cancelAll(); position = 0; settle();
    } else if (e.key === 'End') {
      cancelAll(); position = loop ? Math.round(position) + count : count - 1; settle();
    }
  }

  stageEl.addEventListener('pointerdown', onPointerDown);
  stageEl.addEventListener('pointermove', onPointerMove);
  stageEl.addEventListener('pointerup', onPointerUp);
  stageEl.addEventListener('pointercancel', onPointerUp);
  stageEl.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('keydown', onKey);

  return { setAxis, setCount, setPxPerCard, setPosition, setLoop, getPosition };
}
