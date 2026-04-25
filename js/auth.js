const SCOPE = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/contacts.readonly',
].join(' ');
const TOKEN_KEY = 'rolodex_access_token';
const TOKEN_EXPIRY_KEY = 'rolodex_token_expires';

let tokenClient = null;
let accessToken = null;
let expiresAt = 0;
let onChange = () => {};
let pendingResolve = null;
let pendingReject = null;

function persistToken() {
  try {
    if (accessToken) {
      localStorage.setItem(TOKEN_KEY, accessToken);
      localStorage.setItem(TOKEN_EXPIRY_KEY, String(expiresAt));
    } else {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(TOKEN_EXPIRY_KEY);
    }
  } catch {}
}

// Rehydrate from localStorage if a valid cached token is still in its lifetime.
// Returns true if a session was restored.
export function restoreCachedToken() {
  try {
    const t = localStorage.getItem(TOKEN_KEY);
    const e = parseInt(localStorage.getItem(TOKEN_EXPIRY_KEY) || '0', 10);
    if (t && e > Date.now() + 60_000) {
      accessToken = t;
      expiresAt = e;
      return true;
    }
  } catch {}
  return false;
}

function gisReady() {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      if (window.google?.accounts?.oauth2) return resolve();
      if (Date.now() - start > 8000) return reject(new Error('Google Identity Services failed to load.'));
      setTimeout(tick, 60);
    };
    tick();
  });
}

export async function initAuth(clientId, { onSessionChange } = {}) {
  await gisReady();
  if (onSessionChange) onChange = onSessionChange;

  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: SCOPE,
    callback: (resp) => {
      if (resp.error) {
        accessToken = null;
        expiresAt = 0;
        const err = new Error(resp.error_description || resp.error);
        if (pendingReject) { pendingReject(err); pendingReject = null; pendingResolve = null; }
        onChange({ signedIn: false, error: err });
        return;
      }
      accessToken = resp.access_token;
      expiresAt = Date.now() + (resp.expires_in - 60) * 1000;
      persistToken();
      onChange({ signedIn: true });
      if (pendingResolve) { pendingResolve(accessToken); pendingResolve = null; pendingReject = null; }
    },
  });
}

function requestToken(prompt) {
  return new Promise((resolve, reject) => {
    pendingResolve = resolve;
    pendingReject = reject;
    tokenClient.requestAccessToken({ prompt });
  });
}

// Call from a user-gesture handler. `prompt: 'consent'` on first sign-in
// so the consent screen appears; silent refreshes use prompt: ''.
export async function signIn({ silent = false } = {}) {
  if (!tokenClient) throw new Error('Auth not initialised.');
  return requestToken(silent ? '' : 'consent');
}

export function signOut() {
  if (accessToken && window.google?.accounts?.oauth2?.revoke) {
    try { google.accounts.oauth2.revoke(accessToken, () => {}); } catch {}
  }
  accessToken = null;
  expiresAt = 0;
  persistToken();
  onChange({ signedIn: false });
}

export function isSignedIn() {
  return !!accessToken && Date.now() < expiresAt;
}

// Returns a valid token, silently refreshing if within 60s of expiry.
// Throws if we have nothing and no session is available.
export async function getToken() {
  if (isSignedIn()) return accessToken;
  if (!tokenClient) throw new Error('Auth not initialised.');
  return requestToken('');
}
