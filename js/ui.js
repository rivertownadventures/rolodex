// Toolbar, modal (add/edit), mode toggle wiring.
// The animation modules hold the `position` scalar — ui.js only fires events.

export function wireToolbar({ onMode, onSearch, onAdd, onImport, onRefresh, onSignIn, onSheetChange }) {
  const mSpindle = document.getElementById('mode-spindle');
  const mCarousel = document.getElementById('mode-carousel');
  mSpindle.addEventListener('click', () => onMode('spindle'));
  mCarousel.addEventListener('click', () => onMode('carousel'));

  document.getElementById('search').addEventListener('input', (e) => onSearch(e.target.value));
  document.getElementById('btn-add').addEventListener('click', () => onAdd());
  document.getElementById('btn-import').addEventListener('click', () => onImport());
  document.getElementById('btn-refresh').addEventListener('click', () => onRefresh());
  document.getElementById('btn-signin').addEventListener('click', () => onSignIn());
  document.getElementById('sheet-picker').addEventListener('change', (e) => onSheetChange(e.target.value));
}

// Populate the sheet picker. Hidden until there's more than one tab to pick from.
export function setSheetOptions(titles, currentTitle) {
  const sel = document.getElementById('sheet-picker');
  sel.innerHTML = '';
  for (const t of titles) {
    const opt = document.createElement('option');
    opt.value = t;
    opt.textContent = t;
    if (t === currentTitle) opt.selected = true;
    sel.appendChild(opt);
  }
  sel.hidden = titles.length < 2;
}

// Shows a small chooser. Returns { source: 'google' } or { source: 'vcard', file }
// or null if cancelled.
export function openImportChooser() {
  return new Promise((resolve) => {
    const modal = document.getElementById('modal');
    const form = document.getElementById('modal-form');
    const fieldsEl = document.getElementById('modal-fields');
    document.getElementById('modal-title').textContent = 'Import contacts';

    fieldsEl.innerHTML = `
      <p class="import-intro">Pick a source. New contacts will be appended to your sheet; duplicates (by name) are skipped.</p>
      <div class="import-choices">
        <button type="button" class="primary-btn" data-source="google">From Google Contacts</button>
        <button type="button" class="primary-btn" data-source="vcard">From vCard file (.vcf)…</button>
      </div>
    `;

    // Hide the default Save button for this mode.
    const save = document.getElementById('modal-save');
    save.style.display = 'none';

    modal.hidden = false;
    modal.style.display = 'flex';

    const close = (result) => {
      modal.hidden = true;
      modal.style.display = 'none';
      save.style.display = '';
      form.onsubmit = null;
      modal.querySelectorAll('[data-close]').forEach((el) => (el.onclick = null));
      resolve(result);
    };

    modal.querySelectorAll('[data-close]').forEach((el) => {
      el.onclick = () => close(null);
    });

    fieldsEl.querySelector('[data-source="google"]').onclick = () => close({ source: 'google' });
    fieldsEl.querySelector('[data-source="vcard"]').onclick = () => {
      const input = document.getElementById('vcard-file');
      input.value = '';
      input.onchange = () => {
        const file = input.files?.[0];
        if (file) close({ source: 'vcard', file });
      };
      input.click();
    };

    form.onsubmit = (e) => e.preventDefault();
  });
}

export function setMode(mode) {
  const stage = document.getElementById('stage');
  stage.classList.toggle('mode-spindle', mode === 'spindle');
  stage.classList.toggle('mode-carousel', mode === 'carousel');
  document.getElementById('mode-spindle').setAttribute('aria-pressed', mode === 'spindle' ? 'true' : 'false');
  document.getElementById('mode-carousel').setAttribute('aria-pressed', mode === 'carousel' ? 'true' : 'false');
}

export function setInstanceName(name) {
  document.getElementById('instance-name').textContent = name;
  document.title = name;
}

export function setSignedIn(signedIn) {
  const btn = document.getElementById('btn-signin');
  btn.textContent = signedIn ? 'Sign out' : 'Sign in with Google';
  btn.dataset.state = signedIn ? 'signed-in' : 'signed-out';
}

export function openModal({ title, headers, values = {}, readOnlyFields = [] }) {
  return new Promise((resolve) => {
    const modal = document.getElementById('modal');
    const form = document.getElementById('modal-form');
    const fieldsEl = document.getElementById('modal-fields');
    document.getElementById('modal-title').textContent = title;

    fieldsEl.innerHTML = '';
    for (const h of headers) {
      const id = `f-${h}`;
      const label = document.createElement('label');
      label.setAttribute('for', id);
      label.textContent = h;
      const isLong = String(values[h] || '').length > 60 || /notes?|body|description/i.test(h);
      const input = document.createElement(isLong ? 'textarea' : 'input');
      input.id = id;
      input.name = h;
      input.value = values[h] ?? '';
      if (readOnlyFields.includes(h)) input.readOnly = true;
      if (!isLong) input.type = 'text';
      label.appendChild(input);
      fieldsEl.appendChild(label);
    }

    modal.hidden = false;
    modal.style.display = 'flex';

    const close = (result) => {
      modal.hidden = true;
      modal.style.display = 'none';
      form.onsubmit = null;
      modal.querySelectorAll('[data-close]').forEach((el) => (el.onclick = null));
      resolve(result);
    };

    modal.querySelectorAll('[data-close]').forEach((el) => {
      el.onclick = () => close(null);
    });

    form.onsubmit = (e) => {
      e.preventDefault();
      const data = {};
      for (const h of headers) {
        const inp = form.querySelector(`[name="${CSS.escape(h)}"]`);
        data[h] = inp ? inp.value : '';
      }
      close(data);
    };
  });
}
