# 开发文档

> 语言：**简体中文** ｜ [English](../en/development.md)

本文介绍如何在本地修改、编译并加载这个扩展来调试。命令同时给出 **macOS / Linux** 和 **Windows** 两种写法，按你的系统选用即可。

---

## 0. 环境准备

- **Python 3**（编译脚本用）
  - macOS / Linux：`python3 --version`
  - Windows：`python --version`
- **Git**（编译脚本默认会拉取几个外部仓库，见第 2 步）
- **Chrome 或 Edge**（也支持 Firefox / Safari，见第 3 步）

---

## 1. 项目结构（你会改到的地方）

| 路径 | 作用 |
| --- | --- |
| `source/extension/vt.js` | **核心代码**：面板、同步逻辑、直播判断等，绝大多数功能都在这里 |
| `source/extension/html/pannel.html` | 主面板的 HTML + CSS（房间卡片、聊天、按钮…） |
| `source/extension/html/fullscreen.html` | 全屏时叠在视频上的迷你聊天条 |
| `source/extension/localization/*.json` | 多语言文案，代码里用 `{$键名$}` 引用 |
| `source/extension/extension.js` | 加载器：负责把 `vt.js` 注入网页；`isDevelopment` 开关在这里 |
| `source/extension/background.js` | 背景脚本（如运行时切换工具栏图标） |
| `source/chrome/`、`source/firefox/`、`source/safari/.../Resources/` | **编译产物**：各浏览器实际加载的目录 |
| `release/` | 编译产物：用户脚本（Tampermonkey）与网站内嵌版 |
| `script/build_extension.py` | 编译脚本 |

> ⚠️ 只改 `source/extension/` 下的**源文件**。`release/` 和 `source/chrome/vt.*.user.js` 等都是**编译产物**，编译时会被覆盖，直接改会白改。

---

## 2. 编译

在仓库根目录运行：

```bash
# macOS / Linux
python3 script/build_extension.py disable_network

# Windows
python script\build_extension.py disable_network
```

**编译做了什么**：把 `source/` 里的源文件做两类字符串替换——
- `{$键名$}` → 对应语言的文案（逐语言各输出一份）；
- `{{{ ... }}}` → 把引用的文件内容内联进来；

然后输出到 `release/`，再把各浏览器需要的产物复制进 `source/chrome`、`source/firefox`、`source/safari`。

### `source/setting` 与编译时会拉取的其他仓库

`source/local`、`source/website`、`source/setting` 这三个目录**不属于本仓库**——它们各自是独立的 Git 仓库（**嵌套的 git checkout**，各有自己的 `.git`），编译脚本会 `clone` 进来。本仓库的 `.gitignore` 已忽略这三个目录（**不是 submodule**，主仓库也不跟踪它们的内容），好处是**能和扩展联动开发，又各自保留独立的 Git 历史**。

| 目录 | 来源仓库 | 内容 | 扩展开发会用到？ |
| --- | --- | --- | --- |
| `source/setting` | `LCY000/VideoTogether-setting`（fork 自上游 `VideoTogether/VideoTogether-setting`） | **设置页** | 改设置页时会 |
| `source/local` | `VideoTogether/localvideo` | 本地视频播放页（一起看本地文件） | 一般用不到 |
| `source/website` | `VideoTogether/website_next` | 官网内嵌版 | 用不到 |

**`source/setting`（开发时最常碰到的外部仓库）**
- 上游 VideoTogether **主仓库里并没有 `source/setting`**。设置页是独立项目：上游在 `VideoTogether/VideoTogether-setting`，我们的 fork 在 `LCY000/VideoTogether-setting`。
- 我们把它 `clone` 到 `source/setting`，是为了「**设置页 + 扩展**」一起改、互相联动，开发更方便。
- 它是**嵌套的独立 git**：要改设置页本身，进 `source/setting`、在**它自己的仓库**里 commit / push（不是主仓库；主仓库已 `.gitignore` 掉它）。
- 编译时脚本会顺便把它构建出来（如 `source/setting/v3.buildme.html` → 设置页产物）。
- 📄 设置页与前端**怎么联动、怎么新增一个设置开关**：见 [settings-linkage.md](settings-linkage.md)。

> `source/local` 是「一起看本地视频文件」的播放页（用 StreamSaver / hls.js）；`source/website` 是官网内嵌版。**做扩展面板 / 同步开发都用不到这两个**，编译时加 `disable_network` 跳过即可（见下）。

### `disable_network` 是什么

它只控制**一件事**：编译前要不要先去 `git clone` / `git pull` 上面那三个外部仓库。

| 用法 | 行为 | 什么时候用 |
| --- | --- | --- |
| **加 `disable_network`**（👈 我们平常一直用这个） | 跳过联网，直接用磁盘上已有的内容编译 | 做扩展本体 / 面板 / 多语言时。更快、可离线、不会更新或动到那三个仓库 |
| **不加** | 先把那三个仓库拉到最新，再编译 | 想要设置页 / 官网 / 本地视频页的**最新源码**，或首次 clone 后初始化时 |

> **首次拉取主仓库后**：那三个目录还不存在，所以**第一次编译要「不加 `disable_network`」**，让脚本把它们 clone 下来；之后日常开发再加 `disable_network` 即可。（若那三个目录不存在又加了 `disable_network`，脚本在清理 `release/` 临时文件那一步可能会报错。）

---

## 3. 加载本地扩展

### Chrome / Edge
1. 打开 [`chrome://extensions/`](chrome://extensions/)（Edge 为 `edge://extensions/`）。
2. 右上角打开「**开发者模式**」。
3. 点「**加载已解压的扩展程序**」，选择 `source/chrome` 目录。

### Firefox
- 打开 `about:debugging#/runtime/this-firefox` → 「**临时载入附加组件**」→ 选 `source/firefox/manifest.json`。

### Safari
- 需要 Xcode，打开 `source/safari/` 里的 Xcode 工程构建；参考 Apple 文档「Converting a web extension for Safari」。

---

## 4. 开发循环

```
改源文件  →  重新编译（第 2 步）  →  在扩展页点「重新加载 ↻」 + 刷新网页
```

1. 改 `source/extension/vt.js`（核心）／`html/*.html`（界面）／`localization/*.json`（文案）。
2. 重新编译。
3. 到 `chrome://extensions/` 点该扩展卡片上的「重新加载 ↻」，再刷新正在测试的网页。

**小贴士**
- 编译后可用 `node --check release/vt.user.js` 快速检查有没有语法错误。
- 改了**工具栏图标**：Chrome 对图标缓存很强，常需要把扩展「移除后重新加载」才会更新。
- 改文案要四种语言（`zh-cn` / `zh-tw` / `en-us` / `ja-jp`）一起加，键名保持一致。

---

## 5. 开发模式开关（可选）

`source/extension/extension.js` 顶部：

```js
let isDevelopment = false;   // 改成 true
```

**它现在的实际作用**：把**任意网页都当作「受信任页面」**，让设置 / 存储相关的读写 API 在任何域名都能用（默认只信任 `2gether.video`、`*.github.io` 等）。开发**设置页**、或想在任意网站测存储时才需要它。

> 注意：扩展本体其实是**直接加载你本地编译出来的 `vt.*.user.js`**（见 `extension.js` 里 `runtime.getURL('vt.<lang>.user.js')`），所以**不开这个开关，重新编译 + 重载后你的改动一样会生效**。旧版文档里「默认热更新、开 isDevelopment 关闭热更新」的说法对当前扩展流程已不准确（远程注入的代码路径 `InsertInlineJs` 当前并未被调用）。
>
> 发布前记得把它改回 `false`。

---

## 6. 版本号（发布 / bump 时）

版本号分散在**三个浏览器 manifest**（各平台分开维护）；userscript 用 build 时间戳：

| 位置 | 目前 | 说明 |
| --- | --- | --- |
| `source/chrome/manifest.json` | `3.1.0` | Chrome / Edge（mv3） |
| `source/safari/VideoTogether/Shared (Extension)/Resources/manifest.json` | `3.1.0` | Safari，与 chrome 同号 |
| `source/firefox/manifest.json` | `1.4.0` | Firefox **自成一条版本线**（沿用上游 AMO 历史，与 chrome 的 3.x 不同源） |
| userscript `@version`（`extension.js` 标头）| `{{timestamp}}` | build 时自动填时间戳，非 semver，**不用手动改** |

- **要 bump 版本**：直接改上面 manifest 的 `version` 字段即可。manifest 是**静态文件、不经过 build**，改完**不用重新编译**。
- 习惯上 **chrome / safari 同步一个号**；**firefox 维持它自己的 1.x 线**（别强行对齐成 3.x，会打乱它和 Firefox 商店的版本连续性）。

## 7. 本地调试后端服务

TODO。客户端默认连官方服务器 `https://2gether.video`（见 `vt.js` 里的 `video_together_host`）；自建后端的本地调试流程待补充。
