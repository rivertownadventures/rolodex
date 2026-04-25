// Carousel mode: Rolodex book-flip with a central vertical spindle and a
// visible deck of upcoming cards stacked behind the right slot.
//
// Mechanics:
//   - A vertical spindle runs down the stage at x = 0.
//   - LEFT slot card (delta=0) is hinged at its RIGHT edge on the spindle,
//     showing its front. Flipping sweeps its left edge BACK (into -Z),
//     rotating to land on the right side of the spindle (back showing).
//   - RIGHT slot card (delta=-1) is hinged at its LEFT edge on the spindle
//     (via pre-rotation of +180°), showing its back. Flipping sweeps its
//     right edge FORWARD (into +Z), rotating to land at the left slot
//     (front showing).
//   - Cards at delta < -1 are the DECK — stacked behind the right slot,
//     all showing their back (pre-rotated +180°), each one pushed a bit
//     further back in Z. As the user flips, the whole deck advances
//     forward one step.
//
// All cards share the same static layout (translateX(-160), right edge
// touching the spindle) and the same transform-origin (100% 50% 0 = right
// edge of card = spindle). The SAME rotation formula produces the book-
// flip behaviour naturally because pre-rotating a card by ±180° places it
// on the opposite side of the spindle.

const STATIC_X = -160;      // card center X — right edge at the spindle (x=0)
const FLIP_DEG = 180;
const DECK_DEPTH = 6;       // how many cards to show in the deck behind the right slot
const DECK_Z_STEP = 6;      // pixels further back per card deeper in the deck

export function applyTransforms(cardEls, position) {
  const N = cardEls.length;
  for (let i = 0; i < N; i++) {
    const el = cardEls[i];
    // Wrap delta into the visible window [-N+1, 1) so the deck loops forever:
    // after card i flips out the left, it reappears at the back of the deck.
    let delta = position - i;
    if (N > 0) {
      delta = ((delta - 1) % N + N) % N - (N - 1);
    }

    let angle = 0;
    let zOffset = 0;
    let hide = false;

    if (delta >= 1) {
      // Already flipped past the left slot — hidden (shouldn't happen with wrap).
      hide = true;
    } else if (delta >= -1) {
      // Visible active pair: focus (delta=0) or next (delta=-1), including the
      // continuous transition between them (delta in [-1, 1)).
      angle = -FLIP_DEG * delta;
      zOffset = 0;
    } else {
      // delta < -1 → queued deeper in the deck.
      const depth = -delta - 1;           // 0 at top-of-deck (just behind the RIGHT card)
      if (depth > DECK_DEPTH) {
        hide = true;
      } else {
        angle = FLIP_DEG;                 // always back-facing while queued
        zOffset = -depth * DECK_Z_STEP;   // further back as depth increases
      }
    }

    if (hide) {
      if (el.style.visibility !== 'hidden') {
        el.style.visibility = 'hidden';
        el.classList.remove('focused');
      }
      continue;
    }

    el.style.visibility = '';
    el.style.top = '50%';
    el.style.marginTop = '-100px';
    el.style.transformOrigin = '100% 50% 0';
    el.style.transform = `translate3d(${STATIC_X}px, 0, ${zOffset.toFixed(2)}px) rotateY(${angle.toFixed(2)}deg)`;
    el.style.opacity = '1';
    // Higher z-index for the active pair and the top of the deck; deeper cards fall behind.
    el.style.zIndex = String(1000 - Math.round(Math.abs(delta) * 10));
    el.classList.toggle('focused', Math.abs(delta) < 0.5);
  }
}

export function pxPerCard(stageEl) {
  return Math.max(160, Math.round(stageEl.clientWidth * 0.25));
}
