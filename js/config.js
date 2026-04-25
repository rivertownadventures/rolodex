const REQUIRED = ['oauthClientId', 'spreadsheetId', 'sheetName', 'fields'];

export async function loadConfig() {
  const res = await fetch('./config.json', { cache: 'no-store' });
  if (!res.ok) throw new Error(`Couldn't load config.json (HTTP ${res.status})`);
  const cfg = await res.json();

  for (const k of REQUIRED) {
    if (!cfg[k]) throw new Error(`config.json missing required field: ${k}`);
  }
  if (cfg.oauthClientId.startsWith('PASTE_')) {
    throw new Error('config.json: oauthClientId is still the placeholder — paste your Google OAuth client ID.');
  }
  if (cfg.spreadsheetId.startsWith('PASTE_')) {
    throw new Error('config.json: spreadsheetId is still the placeholder — paste the ID from your sheet URL.');
  }

  return {
    instanceName: cfg.instanceName || 'Rolodex',
    oauthClientId: cfg.oauthClientId,
    spreadsheetId: cfg.spreadsheetId,
    sheetName: cfg.sheetName,
    range: cfg.range || 'A1:Z',
    idField: cfg.idField || 'id',
    fields: cfg.fields || {},
    theme: cfg.theme || {},
    defaultMode: cfg.defaultMode === 'carousel' ? 'carousel' : 'spindle',
    searchFields: Array.isArray(cfg.searchFields) ? cfg.searchFields : [],
  };
}
