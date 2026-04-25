import { getToken } from './auth.js?v=25';

const API = 'https://sheets.googleapis.com/v4/spreadsheets';

async function authedFetch(url, init = {}) {
  const token = await getToken();
  const headers = { ...(init.headers || {}), Authorization: `Bearer ${token}` };
  if (init.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
  const res = await fetch(url, { ...init, headers });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Sheets API ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

// List every tab in the spreadsheet. Returns [{ title, sheetId }].
export async function listSheets({ spreadsheetId }) {
  const url = `${API}/${spreadsheetId}?fields=sheets.properties(title,sheetId,index)`;
  const data = await authedFetch(url);
  return (data.sheets || [])
    .map((s) => s.properties)
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .map(({ title, sheetId }) => ({ title, sheetId }));
}

export async function readSheet({ spreadsheetId, sheetName, range }) {
  const a1 = encodeURIComponent(`${sheetName}!${range || 'A1:Z'}`);
  const data = await authedFetch(`${API}/${spreadsheetId}/values/${a1}?majorDimension=ROWS`);
  return data.values || [];
}

export async function appendRow({ spreadsheetId, sheetName, range, row }) {
  const a1 = encodeURIComponent(`${sheetName}!${range || 'A1:Z'}`);
  const url = `${API}/${spreadsheetId}/values/${a1}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
  const body = JSON.stringify({ values: [row] });
  const resp = await authedFetch(url, { method: 'POST', body });
  const m = /![A-Z]+(\d+):/.exec(resp.updates?.updatedRange || '');
  return { rowIndex: m ? parseInt(m[1], 10) : null };
}

// Append multiple rows in a single Sheets API call.
export async function appendRows({ spreadsheetId, sheetName, range, rows }) {
  if (!rows || !rows.length) return { appended: 0 };
  const a1 = encodeURIComponent(`${sheetName}!${range || 'A1:Z'}`);
  const url = `${API}/${spreadsheetId}/values/${a1}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
  const body = JSON.stringify({ values: rows });
  const resp = await authedFetch(url, { method: 'POST', body });
  return { appended: resp.updates?.updatedRows || rows.length };
}

export async function updateRow({ spreadsheetId, sheetName, rowIndex, row }) {
  const lastCol = colLetter(row.length);
  const a1 = encodeURIComponent(`${sheetName}!A${rowIndex}:${lastCol}${rowIndex}`);
  const url = `${API}/${spreadsheetId}/values/${a1}?valueInputOption=USER_ENTERED`;
  const body = JSON.stringify({ values: [row] });
  await authedFetch(url, { method: 'PUT', body });
}

function colLetter(n) {
  // 1 -> A, 26 -> Z, 27 -> AA
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s || 'A';
}
