// Rotary Rolodex: each card stands UP from a horizontal spindle at its BOTTOM
// edge (where the two spindle-holes are). The focused card stands vertical at
// the front of the spindle. When you advance, the focused card tips FORWARD —
// top falls toward the viewer, then swings around and down to hang UPSIDE
// DOWN below the spindle, where it rests (visible, dangling). Cards waiting
// to be focused stack directly behind the focus.
//
// Position semantics per card i, given float `position`:
//   delta = position - i
//     delta <= 0         → card is the current focus (delta=0) or waiting
//                          behind it (more negative = further back in the stack)
//     0 < delta < 1      → mid-flip: rotating 0° → -180°
//     delta >= 1         → card has completed its flip; remains hanging at -180°

const STACK_DEPTH = 8;        // how many cards deep to render behind focus
const HANG_DEPTH = 8;         // how many already-flipped cards to leave hanging below
const Z_STEP = 2;             // pixels behind focus per card in the standing stack
const HANG_Z_STEP = 3;        // pixels between hanging cards so they don't z-fight
const FLIP_DEG = 180;

export function applyTransforms(cardEls, position) {
  for (let i = 0; i < cardEls.length; i++) {
    const el = cardEls[i];
    const delta = position - i;

    let angle = 0;
    let zOffset = 0;
    let hide = false;

    if (delta >= 1) {
      // Already flipped past — hanging upside-down under the spindle.
      const past = delta - 1;
      if (past > HANG_DEPTH) {
        hide = true;
      } else {
        angle = -FLIP_DEG;
        // Most recently flipped hangs in front of older ones.
        zOffset = -past * HANG_Z_STEP;
      }
    } else if (delta > 0) {
      // Mid-flip: rotate 0° → -180° — top falls forward, swings around and down.
      angle = -FLIP_DEG * delta;
      zOffset = 0;
    } else {
      // Focus (delta=0) or waiting behind (delta<0).
      const behind = -delta;
      if (behind > STACK_DEPTH) {
        hide = true;
      } else {
        zOffset = -behind * Z_STEP;
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
    el.style.transformOrigin = '50% 100% 0';
    el.style.top = '70%';
    el.style.marginTop = '-200px';
    el.style.transform = `translateZ(${zOffset.toFixed(2)}px) rotateX(${angle.toFixed(2)}deg)`;
    el.style.opacity = '1';
    // Z-index stacking: closest-to-focus (by |delta|) rendered on top.
    el.style.zIndex = String(1000 - Math.floor(Math.abs(delta)) * 10);
    el.classList.toggle('focused', Math.abs(delta) < 0.5);
  }
}

export function pxPerCard(stageEl) {
  return Math.max(160, Math.round(stageEl.clientHeight * 0.35));
}
