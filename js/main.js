import { loadConfig } from './config.js?v=25';
import { initAuth, signIn, signOut, getToken, isSignedIn, restoreCachedToken } from './auth.js?v=25';
import { readSheet, appendRow, appendRows, updateRow, listSheets } from './sheets.js?v=25';
import {
  loadFromRows, getVisibleCards, getAllCards, getHeaders,
  applyFilter, findCard, upsertLocal, cardToRowArray, newId
} from './store.js?v=25';
import { buildCardEl } from './card.js?v=25';
import { createController } from './gestures.js?v=25';
import * as spindle from './mode-spindle.js?v=25';
import * as carousel from './mode-carousel.js?v=25';
import { wireToolbar, setMode, setInstanceName, setSignedIn, openModal, openImportChooser, setSheetOptions } from './ui.js?v=25';
import { applyTheme, showStatus, debounce } from './util.js?v=25';
import { fetchGoogleContacts, parseVCardFile, filterNewContacts, contactToRow } from './contacts.js?v=25';
import { resolveFields } from './field-resolver.js';

const stageEl = document.getElementById('stage');
const cardsEl = document.getElementById('cards');
const emptyEl = document.getElementById('empty-state');

let config = null;
let currentMode = 'spindle';
let cardEls = [];             // parallel to getVisibleCards()
let controller = null;
let currentFields = null;
let currentSearchFields = [];

function currentModeModule() {
  return currentMode === 'carousel' ? carousel : spindle;
}

function renderCards() {
  const visible = getVisibleCards();
  cardsEl.innerHTML = '';
  cardEls = visible.map((c) => {
    const el = buildCardEl(c, currentFields || config.fields);
    cardsEl.appendChild(el);
    return el;
  });
  emptyEl.hidden = visible.length > 0;
  if (controller) {
    controller.setCount(visible.length);
    controller.setPxPerCard(currentModeModule().pxPerCard(stageEl));
    frame();
  }
}

function frame() {
  if (!controller) return;
  currentModeModule().applyTransforms(cardEls, controller.getPosition());
}

function switchMode(mode) {
  if (mode !== 'spindle' && mode !== 'carousel') return;
  currentMode = mode;
  setMode(mode);
  if (controller) {
    controller.setAxis(mode === 'spindle' ? 'y' : 'x');
    controller.setLoop(mode === 'carousel');
    controller.setPxPerCard(currentModeModule().pxPerCard(stageEl));
    frame();
  }
}

const SIGNED_IN_KEY = 'rolodex_previously_signed_in';
const sheetKeyFor = (id) => `rolodex_sheet_${id}`;
let sheetListLoaded = false;

function updateTitle() {
  document.title = `${config.instanceName} — ${config.sheetName}`;
}

async function loadSheetList() {
  try {
    const sheets = await listSheets({ spreadsheetId: config.spreadsheetId });
    const titles = sheets.map((s) => s.title);
    // If saved/current sheet isn't in the list (renamed/deleted), fall back to first.
    if (!titles.includes(config.sheetName)) {
      config.sheetName = titles[0] || config.sheetName;
      localStorage.setItem(sheetKeyFor(config.spreadsheetId), config.sheetName);
      updateTitle();
    }
    setSheetOptions(titles, config.sheetName);
    sheetListLoaded = true;
  } catch (err) {
    console.error('listSheets failed', err);
  }
}

async function doSwitchSheet(name) {
  if (!name || name === config.sheetName) return;
  config.sheetName = name;
  localStorage.setItem(sheetKeyFor(config.spreadsheetId), name);
  updateTitle();
  document.getElementById('search').value = '';
  await doRefresh();
}

async function doSignIn() {
  try {
    if (isSignedIn()) {
      signOut();
      setSignedIn(false);
      localStorage.removeItem(SIGNED_IN_KEY);
      showStatus('Signed out');
      return;
    }
    await signIn({ silent: false });
    setSignedIn(true);
    localStorage.setItem(SIGNED_IN_KEY, '1');
    showStatus('Signed in');
    await doRefresh();
  } catch (err) {
    console.error(err);
    showStatus(err.message || 'Sign-in failed', { error: true });
  }
}

async function doRefresh() {
  if (!isSignedIn()) {
    try { await getToken(); } catch { showStatus('Sign in first', { error: true }); return; }
  }
  try {
    showStatus('Loading…');
    const rows = await readSheet({
      spreadsheetId: config.spreadsheetId,
      sheetName: config.sheetName,
      range: config.range,
    });
    loadFromRows(rows, { idField: config.idField });
    const resolved = resolveFields(getHeaders(), getAllCards(), config.sheetName, config);
    currentFields = resolved.fields;
    currentSearchFields = resolved.searchFields;
    applyFilter(document.getElementById('search').value, currentSearchFields);
    renderCards();
    showStatus(`Loaded ${getAllCards().length} cards`);
    if (!sheetListLoaded) loadSheetList();
  } catch (err) {
    console.error(err);
    showStatus(err.message || 'Failed to load', { error: true });
  }
}

async function doAdd() {
  if (!isSignedIn()) { showStatus('Sign in first', { error: true }); return; }
  const headers = getHeaders();
  if (!headers.length) { showStatus('Load the sheet first (press ⟳)', { error: true }); return; }
  const blank = Object.fromEntries(headers.map((h) => [h, '']));
  blank[config.idField] = newId();
  const values = await openModal({
    title: 'Add card',
    headers,
    values: blank,
    readOnlyFields: [config.idField],
  });
  if (!values) return;
  const card = { ...values };
  const row = headers.map((h) => card[h] ?? '');
  try {
    const { rowIndex } = await appendRow({
      spreadsheetId: config.spreadsheetId,
      sheetName: config.sheetName,
      range: config.range,
      row,
    });
    upsertLocal(card, rowIndex);
    applyFilter(document.getElementById('search').value, currentSearchFields);
    renderCards();
    showStatus('Added');
  } catch (err) {
    console.error(err);
    showStatus(err.message || 'Add failed', { error: true });
  }
}

async function doEdit(id) {
  const card = findCard(id);
  if (!card) return;
  const headers = getHeaders();
  const values = await openModal({
    title: 'Edit card',
    headers,
    values: card,
    readOnlyFields: [config.idField],
  });
  if (!values) return;
  const updated = { ...card, ...values };
  const row = headers.map((h) => updated[h] ?? '');
  try {
    await updateRow({
      spreadsheetId: config.spreadsheetId,
      sheetName: config.sheetName,
      rowIndex: card._rowIndex,
      row,
    });
    upsertLocal(updated);
    applyFilter(document.getElementById('search').value, currentSearchFields);
    renderCards();
    showStatus('Saved');
  } catch (err) {
    console.error(err);
    showStatus(err.message || 'Save failed', { error: true });
  }
}

async function doImport() {
  if (!isSignedIn()) { showStatus('Sign in first', { error: true }); return; }
  const headers = getHeaders();
  if (!headers.length) { showStatus('Load the sheet first (press ⟳)', { error: true }); return; }

  const choice = await openImportChooser();
  if (!choice) return;

  try {
    let contacts;
    if (choice.source === 'google') {
      showStatus('Fetching from Google Contacts…');
      contacts = await fetchGoogleContacts();
    } else {
      showStatus('Parsing vCard…');
      const text = await choice.file.text();
      contacts = parseVCardFile(text);
    }

    const fresh = filterNewContacts(contacts, getAllCards());
    if (!fresh.length) {
      showStatus(`${contacts.length} found, 0 new (all duplicates)`);
      return;
    }

    showStatus(`Importing ${fresh.length} new contact${fresh.length === 1 ? '' : 's'}…`);
    const rows = fresh.map((c) => contactToRow(c, headers, config.idField, newId));
    await appendRows({
      spreadsheetId: config.spreadsheetId,
      sheetName: config.sheetName,
      range: config.range,
      rows,
    });
    await doRefresh();
    showStatus(`Imported ${fresh.length} new contact${fresh.length === 1 ? '' : 's'}`);
  } catch (err) {
    console.error(err);
    showStatus(err.message || 'Import failed', { error: true });
  }
}

function onSearch(q) {
  applyFilter(q, currentSearchFields);
  renderCards();
}

async function boot() {
  console.log('[rolodex] boot start');
  // Defensive reset — force UI back to signed-out state on every load.
  const modalEl = document.getElementById('modal');
  modalEl.hidden = true;
  modalEl.style.display = 'none';
  document.getElementById('cards').innerHTML = '';
  setSignedIn(false);

  try {
    config = await loadConfig();
  } catch (err) {
    showStatus(err.message, { error: true, ms: 10000 });
    console.error(err);
    return;
  }
  console.log('[rolodex] config loaded:', config.instanceName, config.spreadsheetId);
  applyTheme(config.theme);
  // Restore last-picked sheet for this spreadsheet (if any) before first load.
  const savedSheet = localStorage.getItem(sheetKeyFor(config.spreadsheetId));
  if (savedSheet) config.sheetName = savedSheet;
  setInstanceName(config.instanceName);
  updateTitle();
  currentMode = config.defaultMode;
  setMode(currentMode);

  // Initialise auth BEFORE wiring the toolbar, so the sign-in button can't be
  // clicked while tokenClient is still null.
  try {
    await initAuth(config.oauthClientId, {
      onSessionChange: ({ signedIn }) => setSignedIn(!!signedIn),
    });
  } catch (err) {
    showStatus(err.message, { error: true });
    console.error(err);
    return;
  }

  wireToolbar({
    onMode: switchMode,
    onSearch: debounce(onSearch, 80),
    onAdd: doAdd,
    onImport: doImport,
    onRefresh: doRefresh,
    onSignIn: doSignIn,
    onSheetChange: doSwitchSheet,
  });

  controller = createController({
    stageEl,
    onUpdate: frame,
    onSelect: () => {},
    onPressCard: (id) => doEdit(id),
  });
  controller.setAxis(currentMode === 'spindle' ? 'y' : 'x');
  controller.setLoop(currentMode === 'carousel');
  controller.setCount(0);
  controller.setPxPerCard(currentModeModule().pxPerCard(stageEl));

  window.addEventListener('resize', () => {
    controller.setPxPerCard(currentModeModule().pxPerCard(stageEl));
    frame();
  });

  // If this user has signed in here before, silently refresh their token so
  // they don't have to click the button on every reload. If the silent attempt
  // fails (session expired, privacy mode blocked it, etc.), fall back to the
  // manual sign-in button.
  // First: if we have a still-valid cached token from last session, use it.
  if (restoreCachedToken()) {
    setSignedIn(true);
    await doRefresh();
    console.log('[rolodex] boot complete — restored cached token');
    return;
  }

  // Otherwise try silent sign-in via GIS. Keep the flag set even on failure
  // so the next reload tries again (transient issues shouldn't force re-auth).
  if (localStorage.getItem(SIGNED_IN_KEY)) {
    try {
      await Promise.race([
        signIn({ silent: true }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('silent sign-in timed out')), 2500)),
      ]);
      setSignedIn(true);
      await doRefresh();
      console.log('[rolodex] boot complete — silent sign-in succeeded');
      return;
    } catch (err) {
      console.log('[rolodex] silent sign-in failed, prompting:', err.message);
    }
  }

  showStatus('Click "Sign in with Google" to load your sheet', { ms: 5000 });
  console.log('[rolodex] boot complete — ready for sign-in');
}

boot();
