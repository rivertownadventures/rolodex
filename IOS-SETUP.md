# iOS / Xcode Setup

This project is wrapped as a native iOS app using [Capacitor](https://capacitorjs.com/). The iOS WebView loads the hosted PWA from GitHub Pages — see "How it works" below for the rationale.

## Prerequisites

- **macOS** with **Xcode** (full app, not just CLI tools). Install from the Mac App Store.
- **Xcode Command Line Tools**: `xcode-select --install`
- **Point xcode-select at full Xcode** (one-time, required for iOS builds):
  ```bash
  sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
  ```
- **Node 18+** (current setup verified on Node 25).
- **CocoaPods**: *not required* with Capacitor 8 + Swift Package Manager. Skip unless a future Capacitor plugin demands it. If needed: `brew install cocoapods`.

## How it works

`capacitor.config.json` sets `server.url` to `https://gopaddle.github.io/rolodex/`. That makes the iOS WebView load the live hosted PWA on launch.

**Why?** Google Identity Services' popup-based sign-in does not work inside the `capacitor://` custom URL scheme. Pointing the WebView at the public HTTPS origin is the simplest path to a working sign-in. Tradeoff: the app requires network connectivity at launch.

If `gopaddle.github.io` is *not* the correct GitHub Pages host (for example if the user's GitHub username is different from `gopaddle`), update `server.url` in `capacitor.config.json` and re-run `npm run cap:sync`.

## Build / run workflow

After any change to web code (`index.html`, `js/`, `styles/`, etc.):

```bash
npm run cap:sync     # cap sync ios — copies web assets + updates native plugins
npm run cap:open     # cap open ios — opens the project in Xcode
```

In Xcode:

1. Select the **App** target.
2. **Signing & Capabilities** → choose a Team. *Personal Team* (your free Apple ID) is fine for the simulator and your own device. TestFlight / App Store distribution requires a paid Apple Developer account.
3. Bundle Identifier: `com.rivertown.rolodex` (already set).
4. Pick a destination — e.g. **iPhone 15 Simulator** — and hit **Run** (Cmd+R).

## Known scaffold quirk

`webDir` is `.` (the repo root), which makes `cap sync` fail with "Cannot copy a directory to a subdirectory of itself." The `ios/App/App/public/` directory is intentionally empty — at runtime the WebView fetches assets from `server.url`, so the empty `public/` dir is harmless.

If you ever remove `server.url` (see "Going offline-first" below), you'll also need to either:
- move web assets into a subdirectory (e.g. `web/`) and set `"webDir": "web"`, or
- use a build step (Vite/esbuild) that emits to `dist/` and set `"webDir": "dist"`.

## Going offline-first (later)

To ship an app that runs without network at launch:

1. Remove the `server` block from `capacitor.config.json`.
2. Restructure web assets into a non-root `webDir` (see above).
3. Replace Google Identity Services popup auth with native Google Sign-In, e.g. [`@capacitor-community/google-signin`](https://github.com/capacitor-community/google-signin) or `@capacitor/google-auth`. The native plugin uses the iOS-native auth flow and works in the `capacitor://` scheme.
4. Re-run `npm run cap:sync`.

## TestFlight / App Store

1. Enroll in the **Apple Developer Program** ($99/yr).
2. In Xcode: **Product → Archive**.
3. **Distribute App → App Store Connect → Upload**.
4. Configure the build for TestFlight or App Store review in https://appstoreconnect.apple.com/.

## Troubleshooting

- **`xcode-select -p` returns `/Library/Developer/CommandLineTools`** — you need full Xcode selected. Run `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`.
- **`cap sync` errors about copying a directory into itself** — known, harmless given `server.url`. The `public/` dir already exists empty.
- **Sign-in popup is blank or broken in the app** — confirm `server.url` is set and reachable; the popup auth requires the HTTPS origin.
- **CocoaPods errors** — Capacitor 8 uses SPM by default. If you hit a Podfile-related error from a third-party plugin, install CocoaPods: `brew install cocoapods`.
