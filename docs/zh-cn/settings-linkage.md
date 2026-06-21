# 前端 ⇄ 设置页 联动与开发

> 语言：**简体中文** ｜ [English](../en/settings-linkage.md)
>
> 本文说明「前端（userscript／扩展）」与「设置页」这两个独立项目**怎么联动、怎么分开维护、怎么新增一个设置开关**。
> 环境准备、编译、加载扩展等请见 [development.md](development.md)。

## 1. 两个项目

| 项目 | 位置 | 上游（原版） |
|------|------|------|
| 前端（userscript／扩展） | repo 根目录 | `VideoTogether/VideoTogether` |
| 设置页 | `source/setting/`（嵌套的独立 git） | `VideoTogether/VideoTogether-setting` |

`source/setting/` 是一个**嵌套的独立 git checkout**（有自己的 `.git`，被主仓库 `.gitignore` 忽略、非 submodule）。
两边各自 commit / push / 同步上游，互不干扰。构建脚本 `script/build_extension.py` 会把它 `clone` 进来一起构建。
（这个安排与如何修改设置页，详见 [development.md](development.md) 的 `source/setting` 段。）

## 2. 联动机制（storage bridge）

设置页与前端**不直接互相调用**，而是通过扩展共用的 storage 沟通：

```
设置页（任何域名皆可，因为 content script match *://*/*）
   │  用户切换开关
   ▼  window.postMessage({ source:"VideoTogether", type:15, data:{ key, value } })   // 15 = SetStorageValue
扩展 content script  →  写入扩展 storage
   ▼  广播回所有标签页（MessageType.SyncStorageValue）
window.VideoTogetherStorage[key]   ←  前端用 getVideoTogetherStorage(key, default) 读取
```

- **设置页读当前值**：设置页的 `settingItems` 数组 + 初始化循环，会把 `window.VideoTogetherStorage[key]` 反映到 checkbox 勾选状态。
- **前端读值**：`getVideoTogetherStorage('<Key>', <默认值>)`（`source/extension/vt.js` 开头附近）。
- **信任域名**：设置页域名要在 `source/extension/extension.js` 的信任列表里（`2gether.video`、`*.github.io` 等），读写 storage 才被允许。开发时把 `isDevelopment` 设 `true` 可让任意域名都受信任（见 development.md）。

## 3. 怎么新增一个「设置开关」

以一个假想开关 `EnableFoo`（默认开）为例。**两边都要改**：

### 设置页端（`source/setting/`）
1. 在 `settingItems` 数组加一条：`{ key:"EnableFoo", defaultVal:true }`。
2. 在开关区块加 checkbox DOM：`<a id="EnableFooLabel"></a>` + `<input id="EnableFoo" type="checkbox">`
   （**input 的 id 必须等于 key；label 的 id 必须是 `<key>Label`**）。可选 help tooltip：`getLanguageText('EnableFooLabelHelp')`。
3. 各语言 `localization/*.json` 加 `EnableFooLabel`（与可选的 `EnableFooLabelHelp`），并在语言字典注册。

### 前端端（`source/extension/vt.js`）
1. 加 getter：`function getEnableFoo(){ return getVideoTogetherStorage('EnableFoo', true); }`
2. 在要控制的地方判断它。

> **默认值守则**：务必让「未设置 = 维持原本行为」。这样即使设置页还没部署、或前端还没读到新值，行为都不会改变、不会坏。

## 4. 设置页网址（齿轮链接）

前端面板齿轮打开的设置页网址，集中在一个常量：`source/extension/vt.js` 最上方的 `VT_SETTING_PAGE_URL`
（`source/extension/html/pannel.html` 的齿轮 `href` 与它保持一致）。要换设置页部署位置，改这一处 → 重新编译即可。
