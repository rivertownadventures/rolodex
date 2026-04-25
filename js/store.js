// In-memory model of the sheet.
// - headers: array of column names from row 1
// - cards: array of card objects { id, _rowIndex, [headerName]: value }
// - filtered: cards visible given current search (null = no filter)
//
// rowIndex is 1-based (sheet row), so cards[0] typically sits on sheet row 2.

const state = {
  headers: [],
  cards: [],
  filtered: null,
  idField: 'id',
};

export function loadFromRows(rows, { idField = 'id' } = {}) {
  state.idField = idField;
  state.headers = (rows[0] || []).map((h) => String(h || '').trim());
  const idIdx = state.headers.indexOf(idField);
  state.cards = rows.slice(1).map((row, i) => {
    const card = { _rowIndex: i + 2 }; // sheet rows are 1-based; row 1 is headers
    state.headers.forEach((h, col) => { card[h] = row[col] ?? ''; });
    if (idIdx === -1 || !card[idField]) {
      card[idField] = card[idField] || cryptoRandom();
    }
    return card;
  });
  state.filtered = null;
  return state.cards;
}

function cryptoRandom() {
  if (window.crypto?.randomUUID) return crypto.randomUUID();
  return 'c_' + Math.random().toString(36).slice(2, 10);
}

export const newId = cryptoRandom;

export function getHeaders() { return state.headers.slice(); }
export function getAllCards() { return state.cards.slice(); }
export function getVisibleCards() { return (state.filtered || state.cards).slice(); }

export function findCard(id) {
  return state.cards.find((c) => c[state.idField] === id) || null;
}

export function upsertLocal(card, rowIndex) {
  const id = card[state.idField];
  const existing = state.cards.findIndex((c) => c[state.idField] === id);
  if (existing >= 0) {
    state.cards[existing] = { ...state.cards[existing], ...card };
  } else {
    const newCard = { _rowIndex: rowIndex ?? (state.cards.length + 2), ...card };
    state.cards.push(newCard);
  }
  applyFilter(state._lastQuery || '');
}

export function cardToRowArray(card) {
  return state.headers.map((h) => (card[h] ?? '').toString());
}

export function applyFilter(query, searchFields = []) {
  state._lastQuery = query;
  const q = query.trim().toLowerCase();
  if (!q) { state.filtered = null; return state.cards.slice(); }
  const fields = searchFields.length ? searchFields : state.headers;
  state.filtered = state.cards.filter((c) =>
    fields.some((f) => String(c[f] ?? '').toLowerCase().includes(q))
  );
  return state.filtered.slice();
}
