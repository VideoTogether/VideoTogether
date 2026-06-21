# Development Guide

> Language: **English** ｜ [简体中文](../zh-cn/development.md)

How to edit, build, and load this extension locally for debugging. Commands are given for both **macOS / Linux** and **Windows** — use whichever matches your system.

---

## 0. Prerequisites

- **Python 3** (used by the build script)
  - macOS / Linux: `python3 --version`
  - Windows: `python --version`
- **Git** (the build script clones a few helper repos by default — see Step 2)
- **Chrome or Edge** (Firefox / Safari are also supported — see Step 3)

---

## 1. Project layout (the files you'll touch)

| Path | Purpose |
| --- | --- |
| `source/extension/vt.js` | **Core code**: the panel, sync logic, live-stream detection, etc. Most features live here. |
| `source/extension/html/pannel.html` | Main panel HTML + CSS (room card, chat, buttons…). |
| `source/extension/html/fullscreen.html` | The mini chat bar overlaid on the video in fullscreen. |
| `source/extension/localization/*.json` | Localized strings, referenced in code as `{$key$}`. |
| `source/extension/extension.js` | Loader: injects `vt.js` into the page. The `isDevelopment` flag lives here. |
| `source/extension/background.js` | Background script (e.g. swapping the toolbar icon at runtime). |
| `source/chrome/`, `source/firefox/`, `source/safari/.../Resources/` | **Build output**: the directories each browser actually loads. |
| `release/` | Build output: the userscript (Tampermonkey) and website-embed builds. |
| `script/build_extension.py` | The build script. |

> ⚠️ Only edit the **source** files under `source/extension/`. `release/` and `source/chrome/vt.*.user.js` etc. are **build outputs** — they get overwritten on every build, so editing them directly is pointless.

---

## 2. Build

From the repo root:

```bash
# macOS / Linux
python3 script/build_extension.py disable_network

# Windows
python script\build_extension.py disable_network
```

**What the build does**: it performs two kinds of string substitution on the files under `source/` —
- `{$key$}` → the localized string (one output per language);
- `{{{ ... }}}` → inlines the referenced file's contents;

then writes the results to `release/` and copies each browser's bundle into `source/chrome`, `source/firefox`, and `source/safari`.

### `source/setting` and the other repos the build pulls

`source/local`, `source/website`, and `source/setting` are **not part of this repo** — each is its own independent Git repository (a **nested git checkout** with its own `.git`) that the build script `clone`s in. This repo's `.gitignore` excludes all three (they're **not** submodules, and the main repo doesn't track their contents). This lets you develop those pieces alongside the extension while keeping each one's Git history separate.

| Directory | Source repo | Contents | Needed for extension dev? |
| --- | --- | --- | --- |
| `source/setting` | `LCY000/VideoTogether-setting` (forked from upstream `VideoTogether/VideoTogether-setting`) | **Settings page** | Only when editing the settings page |
| `source/local` | `VideoTogether/localvideo` | Local video player ("watch local files together") | Usually not |
| `source/website` | `VideoTogether/website_next` | Website-embed build | No |

**`source/setting`** (the external repo you'll actually touch)
- Upstream VideoTogether's **main repo has no `source/setting`**. The settings page is a separate project: upstream is `VideoTogether/VideoTogether-setting`, and our fork is `LCY000/VideoTogether-setting`.
- We `clone` it into `source/setting` so you can edit the **settings page and the extension together** — more convenient.
- It's a nested independent git checkout: to change the settings page itself, commit / push inside `source/setting` (its **own** repo), not the main repo.
- The build compiles it too (e.g. `source/setting/v3.buildme.html` → the settings-page output).
- 📄 How the settings page and frontend **link up, and how to add a settings toggle**: see [settings-linkage.md](settings-linkage.md).

> `source/local` is the "watch local video files together" player (StreamSaver / hls.js); `source/website` is the website-embed build. **Neither is needed for extension / panel / sync work** — just pass `disable_network` to skip them (see below).

### What `disable_network` does

It controls exactly **one thing**: whether the build first `git clone`s / `git pull`s those three external repos before building.

| Usage | Behavior | When to use |
| --- | --- | --- |
| **With `disable_network`** (👈 what we've been using throughout) | Skip the network step; build straight from what's already on disk | Extension / panel / localization work. Faster, offline, and won't update or touch those three repos |
| **Without it** | Pull the three repos to latest first, then build | When you want the **latest** settings-page / website / local-video source, or on first-time setup |

> **On a fresh clone of the main repo**: those three directories don't exist yet, so the **first build must run *without* `disable_network`** to clone them; after that, use `disable_network` for day-to-day work. (If the directories are missing *and* you pass `disable_network`, the script can error out at the `release/` cleanup step.)

---

## 3. Load the local extension

### Chrome / Edge
1. Open [`chrome://extensions/`](chrome://extensions/) (Edge: `edge://extensions/`).
2. Turn on **Developer mode** (top-right).
3. Click **Load unpacked** and select the `source/chrome` directory.

### Firefox
- Open `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** → pick `source/firefox/manifest.json`.

### Safari
- Requires Xcode: open the Xcode project under `source/safari/` and build it. See Apple's "Converting a web extension for Safari".

---

## 4. Dev loop

```
edit source  →  rebuild (Step 2)  →  click "Reload ↻" on the extension + refresh the web page
```

1. Edit `source/extension/vt.js` (core) / `html/*.html` (UI) / `localization/*.json` (strings).
2. Rebuild.
3. On `chrome://extensions/`, click **Reload ↻** on the extension card, then refresh the page you're testing.

**Tips**
- After a build, run `node --check release/vt.user.js` to catch syntax errors quickly.
- Changed the **toolbar icon**? Chrome caches it aggressively — you often have to **remove and re-add** the extension to see it update.
- When adding strings, add all four languages (`zh-cn` / `zh-tw` / `en-us` / `ja-jp`) with matching keys.

---

## 5. Development flag (optional)

Top of `source/extension/extension.js`:

```js
let isDevelopment = false;   // set to true
```

**What it actually does today**: it marks **every page as a "trusted page"**, so the settings/storage read-write APIs work on any domain (by default only `2gether.video`, `*.github.io`, etc. are trusted). You need it when developing the **settings page** or testing storage on arbitrary sites.

> Note: the extension already loads your **locally built** `vt.*.user.js` directly (see `runtime.getURL('vt.<lang>.user.js')` in `extension.js`), so your edits take effect after a rebuild + reload **without** this flag. The old doc's "disables hot update / uses local code" description is outdated for the current extension flow (the remote-injection path `InsertInlineJs` is currently never called).
>
> Remember to set it back to `false` before shipping.

---

## 6. Version number (releasing / bumping)

The version lives in the **three browser manifests** (maintained per platform); the userscript uses a build timestamp:

| Location | Current | Notes |
| --- | --- | --- |
| `source/chrome/manifest.json` | `3.1.0` | Chrome / Edge (mv3) |
| `source/safari/VideoTogether/Shared (Extension)/Resources/manifest.json` | `3.1.0` | Safari, same number as Chrome |
| `source/firefox/manifest.json` | `1.4.0` | Firefox has its **own version track** (upstream AMO history, separate from Chrome's 3.x) |
| userscript `@version` (`extension.js` header) | `{{timestamp}}` | auto-filled build timestamp, not semver — **no manual edit** |

- **To bump**: just edit the manifest `version` field(s) above. Manifests are **static files, not processed by the build**, so **no rebuild needed**.
- By convention **chrome / safari share one number**; **firefox keeps its own 1.x line** (don't force it to 3.x — that breaks its version continuity with the Firefox add-on store).

## 7. Local backend debugging

TODO. The client talks to the official server `https://2gether.video` by default (see `video_together_host` in `vt.js`); a local self-hosted backend workflow is not documented yet.
