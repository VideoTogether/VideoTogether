# Frontend ⇄ Settings-page linkage & development

> Language: **English** ｜ [简体中文](../zh-cn/settings-linkage.md)
>
> This doc explains how the **frontend** (userscript / extension) and the **settings page** — two separate projects — link up, are maintained separately, and how to add a settings toggle.
> For prerequisites, building, and loading the extension, see [development.md](development.md).

## 1. The two projects

| Project | Location | Upstream |
|------|------|------|
| Frontend (userscript / extension) | repo root | `VideoTogether/VideoTogether` |
| Settings page | `source/setting/` (nested independent git) | `VideoTogether/VideoTogether-setting` |

`source/setting/` is a **nested independent git checkout** (its own `.git`, gitignored by the main repo, not a submodule).
Each side commits / pushes / syncs upstream on its own. The build script `script/build_extension.py` `clone`s it in and builds it together.
(For this layout and how to edit the settings page, see the `source/setting` section of [development.md](development.md).)

## 2. The linkage (storage bridge)

The settings page and the frontend **do not call each other directly** — they communicate through the extension's shared storage:

```
Settings page (any domain, since the content script matches *://*/*)
   │  user toggles a switch
   ▼  window.postMessage({ source:"VideoTogether", type:15, data:{ key, value } })   // 15 = SetStorageValue
extension content script  →  writes to extension storage
   ▼  broadcast back to all tabs (MessageType.SyncStorageValue)
window.VideoTogetherStorage[key]   ←  the frontend reads via getVideoTogetherStorage(key, default)
```

- **Settings page reads the current value**: the page's `settingItems` array + init loop reflect `window.VideoTogetherStorage[key]` into the checkbox state.
- **Frontend reads the value**: `getVideoTogetherStorage('<Key>', <default>)` (near the top of `source/extension/vt.js`).
- **Trusted domains**: the settings-page domain must be in the trust list in `source/extension/extension.js` (`2gether.video`, `*.github.io`, …) for storage read/write to be allowed. While developing, set `isDevelopment` to `true` to trust any domain (see development.md).

## 3. How to add a settings toggle

Using a hypothetical toggle `EnableFoo` (default on). **Both sides need changes**:

### Settings-page side (`source/setting/`)
1. Add an entry to the `settingItems` array: `{ key:"EnableFoo", defaultVal:true }`.
2. Add the checkbox DOM in the switches block: `<a id="EnableFooLabel"></a>` + `<input id="EnableFoo" type="checkbox">`
   (**the input's id must equal the key; the label's id must be `<key>Label`**). Optional help tooltip: `getLanguageText('EnableFooLabelHelp')`.
3. Add `EnableFooLabel` (and optional `EnableFooLabelHelp`) to each `localization/*.json`, and register it in the language dictionary.

### Frontend side (`source/extension/vt.js`)
1. Add a getter: `function getEnableFoo(){ return getVideoTogetherStorage('EnableFoo', true); }`
2. Check it wherever you gate the behavior.

> **Default-value rule**: always make "unset = original behavior". That way, even if the settings page isn't deployed yet or the frontend hasn't read the new value, nothing changes and nothing breaks.

## 4. Settings-page URL (the gear link)

The settings-page URL the panel's gear opens lives in a single constant: `VT_SETTING_PAGE_URL` at the top of `source/extension/vt.js`
(`source/extension/html/pannel.html`'s gear `href` is kept in sync with it). To change where the settings page is deployed, edit that one spot → rebuild.
