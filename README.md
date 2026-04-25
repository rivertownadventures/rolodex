# Rolodex

Digital Rolodex prototype. Flick-animated cards backed by a Google Sheet. One codebase, one `config.json` per instance — clone the folder, swap the config, get a new rolodex.

## First-time setup (once per Google account)

1. Go to https://console.cloud.google.com → **Create Project** → name it `rolodex-prototype`.
2. **APIs & Services → Library** → search for **Google Sheets API** → **Enable**.
3. **APIs & Services → OAuth consent screen**:
   - User Type: **External**
   - App name: `Rolodex`
   - Support email + developer contact: your own Gmail
   - Scopes: add `https://www.googleapis.com/auth/spreadsheets`
   - Test users: add your own Gmail (required while the app is in "Testing")
4. **APIs & Services → Credentials → + Create Credentials → OAuth client ID**:
   - Application type: **Web application**
   - Name: `rolodex-local`
   - Authorized JavaScript origins: `http://localhost:5173` (exact, no trailing slash)
   - Authorized redirect URIs: leave blank
   - Copy the **Client ID** — you'll paste it into `config.json`.

The same OAuth client ID works for every rolodex clone — it's tied to the origin, not to a sheet.

## Per-instance setup

1. Create a Google Sheet. Row 1 is headers; column A must be `id`. Example:

   | id | name | company | photoUrl | notes | email | phone | lastContact |
   |----|------|---------|----------|-------|-------|-------|-------------|

2. Copy `config.example.json` to `config.json` and fill in:
   - `oauthClientId` — from the step above
   - `spreadsheetId` — from the sheet's URL
   - `sheetName` — the tab name
   - `fields` — map columns to card faces
   - `theme`, `defaultMode`, etc.

3. Run the dev server:
   ```
   ./serve.sh
   ```
4. Open http://localhost:5173 in Chrome or Safari. **Do not** double-click `index.html` — `file://` won't load `config.json`.

## Cloning for a new use case

```
cp -R ~/Projects/rolodex ~/Projects/rolodex-contacts
cd ~/Projects/rolodex-contacts
# edit config.json
./serve.sh
```

Run only one clone at a time (they all use port 5173). Or add extra ports to the OAuth client's Authorized JavaScript origins.

## Deploying to GitHub Pages

The repo is already wired with a Pages workflow at [.github/workflows/pages.yml](.github/workflows/pages.yml) that publishes the repo root to GitHub Pages on every push to `main`.

### One-time setup

1. Create a **public** GitHub repo and push this directory to it. Easiest path with the GitHub CLI:
   ```
   gh repo create rolodex --public --source=. --push
   ```
2. In the new repo on github.com: **Settings → Pages** → set **Source** to **GitHub Actions**.
3. The workflow runs automatically; once it succeeds your URL will be:
   ```
   https://<username>.github.io/<repo-name>/
   ```
   (e.g. `https://yourname.github.io/rolodex/`).

### Critical: whitelist the Pages origin in Google Cloud

Sign-in will fail until you add the Pages origin to your OAuth client's allowed origins:

1. Open [Google Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials).
2. Click your OAuth 2.0 Web client (the one whose ID is in `config.json`).
3. Under **Authorized JavaScript origins**, add:
   ```
   https://<username>.github.io
   ```
   No trailing slash, no path — just the origin (scheme + host). Keep `http://localhost:5173` for local dev.
4. Save. Changes can take a few minutes to propagate.

### Notes

- Pages serves the app from a subpath (`/<repo-name>/`), so all asset paths in the app must be relative — `./js/foo.js` rather than `/js/foo.js`.
- `config.json` is committed on purpose: `oauthClientId` is origin-bound (only works from your whitelisted origins) and `spreadsheetId` is still gated by Google OAuth at request time. Neither is a secret.

## Controls

- **Flick up/down** (spindle mode) or **left/right** (carousel mode) — browse cards.
- **Trackpad wheel** works too.
- **Toolbar** — toggle mode, search, add new card, refresh.
- **Click a card** — edit it.
