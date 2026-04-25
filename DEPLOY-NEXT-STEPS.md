# Deploy next steps

The repo has been `git init`'d on branch `main` and all files staged, but **not yet committed** — the other parallel streams may still be writing files. Finish in this order:

## 1. Verify the working tree

```
cd /Users/natesmacbookpro/Projects/rolodex
git status
```

Make sure all the files you expect (from streams 1, 2, 4) are present and staged. If new files appeared after `git init`, stage them:

```
git add -A
```

Confirm `config.json` IS staged (it's safe to commit — `oauthClientId` is origin-bound, `spreadsheetId` is OAuth-gated). Confirm `node_modules/` and `ios/App/Pods/` are NOT staged.

## 2. Commit

```
git commit -m "Initial commit: Rolodex web app + Pages deploy + iOS scaffold"
```

## 3. Create the public GitHub repo and push

```
gh repo create rolodex --public --source=. --push
```

(If you don't have `gh` installed: `brew install gh && gh auth login`. Or create the repo manually in the GitHub UI and `git remote add origin <url> && git push -u origin main`.)

## 4. Enable GitHub Pages

In the new repo on github.com:

- **Settings → Pages**
- **Source:** GitHub Actions

The `.github/workflows/pages.yml` workflow will run on the push you just made. Watch it under the **Actions** tab. When it finishes, your URL is:

```
https://<your-github-username>.github.io/rolodex/
```

## 5. Whitelist the Pages origin in Google Cloud (CRITICAL — sign-in fails without this)

1. https://console.cloud.google.com/apis/credentials
2. Open your OAuth 2.0 Web client (ID is in `config.json`).
3. **Authorized JavaScript origins** → add:
   ```
   https://<your-github-username>.github.io
   ```
   No trailing slash. No path. Just the origin.
4. Save. Wait ~1-5 min for propagation.

## 6. Verify

Open the Pages URL in a desktop browser, sign in, switch sheets — cards should render. Then open it on iPhone Safari and try **Add to Home Screen**.

## Troubleshooting

- **Sign-in fails with "origin not allowed":** the origin in Google Cloud must match the URL exactly. Use the *origin* (`https://name.github.io`), not the full URL with `/rolodex/`.
- **404 on the Pages URL:** the first deploy hasn't finished. Check the Actions tab.
- **Blank page / 404 on assets:** asset paths in the app must be relative (`./js/foo.js`, not `/js/foo.js`). Streams 1 & 2 should have handled this — if not, fix paths and push again.

You can delete this file once you've deployed.
