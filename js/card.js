// Render a card's DOM from the field mapping in config.
// Two-face card so you can see the whole flip:
//   .card-front — card content (name, image, fields). Faces viewer at rest.
//   .card-back  — blank card back. Becomes visible after the card rotates past 90°.
// Both faces share the same bottom-edge spindle hole decoration so whichever
// face is toward you, the holes are at the bottom where the spindle is.

function makeHoles() {
  const h = document.createElement('div');
  h.className = 'card-holes';
  h.innerHTML = `<span class="card-hole"></span><span class="card-hole"></span>`;
  return h;
}

export function buildCardEl(card, fields) {
  const el = document.createElement('article');
  el.className = 'card';
  el.dataset.id = card.id;

  const front = document.createElement('div');
  front.className = 'card-face card-front';

  front.appendChild(makeHoles());

  const image = fields.frontImage && card[fields.frontImage];
  if (image) {
    const img = document.createElement('img');
    img.className = 'card-image';
    img.loading = 'lazy';
    img.alt = '';
    img.referrerPolicy = 'no-referrer';
    img.src = image;
    img.onerror = () => { img.src = 'assets/placeholder.svg'; };
    front.appendChild(img);
  }

  if (fields.frontTitle) {
    const h = document.createElement('h2');
    h.className = 'card-title';
    h.textContent = card[fields.frontTitle] || '';
    front.appendChild(h);
  }
  if (fields.frontSubtitle) {
    const s = document.createElement('p');
    s.className = 'card-subtitle';
    s.textContent = card[fields.frontSubtitle] || '';
    front.appendChild(s);
  }
  if (fields.backBody) {
    const b = document.createElement('p');
    b.className = 'card-body';
    b.textContent = card[fields.backBody] || '';
    front.appendChild(b);
  }
  if (Array.isArray(fields.backFields) && fields.backFields.length) {
    const dl = document.createElement('dl');
    dl.className = 'card-fields';
    for (const key of fields.backFields) {
      const val = card[key];
      if (val == null || val === '') continue;
      const dt = document.createElement('dt');
      dt.textContent = key;
      const dd = document.createElement('dd');
      dd.textContent = val;
      dl.append(dt, dd);
    }
    front.appendChild(dl);
  }

  const back = document.createElement('div');
  back.className = 'card-face card-back';
  back.appendChild(makeHoles()); // holes at the back's local-top → container-bottom after 180° flip

  el.append(front, back);
  return el;
}
