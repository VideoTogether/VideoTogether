# 給上游 VideoTogether 維護者的說明 — 這個 fork 做了什麼、以及怎麼合併

> **English TL;DR**: This is a fork (`LCY000/VideoTogether`, branch `feature/ui-rework`) by **CYouuu / LCY000**, built over ~7 days (2026-06-12 → 06-18) **with a lot of help from Anthropic's Claude (Claude Code)** — design, implementation, debugging and this very document. It's a fairly large UI / UX / sync rework, kept as compatible with upstream as we could. **Please take whatever is useful and ignore the rest — it's entirely your call.** This file lives on the fork side; feel free to edit or delete it when you merge.
>
> 作者：**CYouuu（GitHub: LCY000）**；fork：`LCY000/VideoTogether`，分支 `feature/ui-rework`。
> 期間：**2026-06-12 ～ 06-18（約一週）**。這段時間的設計、實作、抓 bug、重構，以及這份文件，**很大一部分是在 Anthropic 的 Claude（Claude Code）協助下完成的**。
> 心態：以下是我們累積的改動，已盡量沿用上游架構、保持相容。**要不要採用、採用哪些、怎麼改，完全尊重您的決定。** 這份檔案是 fork 端的說明，您合併時可以任意修改或直接刪除。

---

## 0. 重要：這次有「兩個 PR」要一起看

這次更新是「前端」和「設定頁」**一起做、互相搭配**的，建議**一起審、一起合**，只合一邊會對不上（面板的齒輪會連到設定頁、設定頁的新開關要靠前端讀寫）：

1. **前端（本 repo）**：`LCY000/VideoTogether` → 上游 `VideoTogether/VideoTogether`
2. **設定頁**：`LCY000/VideoTogether-setting` → 上游 `VideoTogether/VideoTogether-setting`

---

## 1. 我們做了什麼（貢獻總覽）

改動範圍不算小，但都盡量維持原本的結構與相容性。以下依區域分類（也對應我們 commit 的 scope）：

### 介面 / 體驗（panel）
- 深色玻璃主題 + 淺/深切換、整體版面以 flex 重排。
- 房內改「無外框狀態列」：home icon + 房號（主角）+ 🔗 邀請鈕一排；下方人數 + 角色色條；同步狀態獨立一排。
- 大廳「房間 / 密碼」標籤對齊、上下留白對稱；輸入框修正日文溢出。
- Logo / 縮小圖示改圓角方形（squircle）高解析；snackbar 改置中玻璃膠囊。
- 通話控制（🔊🎤）從標題列移到 footer，標題列恢復乾淨。

### 收合 / 展開機制（panel）
- 抽出純函式 `VideoTogetherResolveMinimized()` 作為收/展的單一決策來源（附單元測試 `test/extension/collapse-state.test.js`）。
- 收合狀態**跟著房間**持久化（跨頁繼承，不傳染給其他用戶端）。
- 修「預設最小化」開關失效（`MinimiseDefault` 優先於本站記憶）。
- 消除載入時「展→收」面板閃爍（改採收合優先、延後展開）。

### 同步 / 人數 / 直播（sync）— 這部分機制較多
- **直播支援**：新增 `IsLiveStream()` 偵測（`duration=∞`、`live.bilibili.com`、YouTube `.ytp-live-badge`、duration 成長啟發式，含遲滯避免卡頓閃動）。直播時觀眾**不被 seek、只同步播放/暫停**（直播 currentTime 跨裝置原點不一致，硬同步會來回震盪），但仍會跟著房主「換台 / 換 URL」。直播狀態也反映到 UI（角色列「直播各自控制」、活動列顯示「已連線」而非「影片同步成功」）。
- **房內人數穩定性**：換頁 / SPA 換網址時，用「跳轉前人數」凍結數秒，擋掉伺服器「同 URL 才算」造成的假性掉到 1 人；跨網域以 TabStorage 記憶；**無影片頁（選單/搜尋/首頁）也送成員心跳**，修正成員在無影片頁不被計入、人數掉到 1 的問題。
- **房主換新影片時提醒觀眾載入**（依 URL 變化判定 + 短判定窗）。
- **房主被接手自動降為觀眾**：被人用「同房名 + 密碼」接手（伺服器回 `Other Host Is Syncing`）時自動降級並跟隨新房主。

### 通話 / 文字訊息（voice）
- 通話可掛斷（「通話」鈕改成切換、通話中顯示「結束通話」）。
- 圖示與音量列對齊修正。
- 文字訊息語音播報的開關（與設定頁連動）。

### 在地化（i18n）
- 新增**整套繁體中文 zh-tw**（前端 + 設定頁；上游原本 zh-cn / en-us / ja-jp）。
- 語言空值 / `auto` 自動偵測瀏覽器語言；`zh-HK / zh-Hant / zh-MO` → 繁中 `zh-tw`。

### 工具列圖示 / popup（icons / popup）
- 執行時與商店圖示圓角化（squircle）。
- popup 視窗語言偵測對齊 `extension.js`（修 auto / 空值固定變英文）。

### 穩定性修復（散見各 scope）
- 退出房間後殘留 UI（小窗 / 人數 / 狀態文字 / 直播提示）。
- 建構期崩潰（InLobby 清人數時序）。
- YouTube 等強制 Trusted Types 頁面的 console 噪音（提前建立 policy）。
- 一般 YouTube 影片被誤判卡在直播狀態（NaN 載入態 / 隱藏徽章）。

> commit 歷史已整理過：type/scope 一致（`panel / fullscreen / sync / voice / i18n / icons / popup / docs / chore / build`）、每個改動的「重建產物」併進對應 commit、訊息以繁中說明「改了什麼、為什麼」。若您偏好英文或 squash 成單一提交，再請告知或自行整理。

---

## 2. 接受 PR 前，要從 fork 改回主 repo 的地方

只有少數幾處是「fork 專屬」需要指回上游。**都改在 `source/` 原始檔，改完跑 `python3 script/build_extension.py disable_network` 重建即可**——請不要手改 `release/` 或 `source/{chrome,firefox,safari}/` 的產物（那些是 build 產生的）。

| 位置 | 目前（fork） | 改成（上游） |
| --- | --- | --- |
| `source/extension/vt.js:21` `VT_SETTING_PAGE_URL` | `lcy000.github.io/VideoTogether-setting/v3.html` | 上游設定頁網址 |
| `source/extension/html/pannel.html:48` 齒輪 `href` | 同上 | 與上面一致 |
| `source/extension/extension.js:285, 348` 信任網域 | `lcy000.github.io` | 上游設定頁網域（或移除）|
| `script/build_extension.py:176` clone 設定 repo | `LCY000/VideoTogether-setting` | `VideoTogether/VideoTogether-setting` |
| `docs/{en,zh-cn}/development.md` | 內含 `LCY000` / `lcy000.github.io` 各 2 處 | 換成上游名稱 |

- **設定頁本身的改動**（繁中、版面、ⓘ 就地展開、新開關…）請走第 0 節的設定頁 PR，合進上游 `VideoTogether-setting`。
- **伺服器位址免改**：`source/extension/config/release_host` = `https://vt.panghair.com:5000/` 本就是上游伺服器；`@namespace/@icon` 用的 `2gether.video` 是上游品牌網域，皆非 fork 專屬。
- **品牌免改**：全專案已是 `VideoTogether`，無 fork 暫用名殘留。

---

## 3. 預設值 / 行為差異（請您決定要不要一起帶）

- `EnableMessageVoice`（文字訊息語音播報，**本 fork 新增的開關**）新安裝預設 **開**（前端 getter `vt.js:188` 與設定頁 `defaultVal` 皆 `true`，兩邊一致）；其餘預設多與上游相同。
- 若設定頁有把某些選項鎖定或加說明，合併時可依您的偏好調整回可切換。

---

## 4. 版本號（交給您決定）

| 位置 | 目前 | 說明 |
| --- | --- | --- |
| `source/chrome/manifest.json` | `3.1.0` | Chrome/Edge（本 fork 從 3.0.23 bump）|
| `source/safari/.../manifest.json` | `3.1.0` | 與 chrome 同號 |
| `source/firefox/manifest.json` | `1.4.0` | Firefox 自成版本線（從 1.3.65 bump，未強行對齊 3.x）|
| userscript `@version` | build 時間戳 | 自動產生，非 semver |

要不要 bump、怎麼定，請依您的 semver 慣例與各商店（Chrome Web Store / AMO）的版本連續性決定；我們只負責把功能帶上去。

是否可以直接沿用我們 bump 後的版本號發佈？Chrome/Edge 已從上游 `3.0.23` 進到 `3.1.0`、Firefox 從 `1.3.65` 到 `1.4.0`；若您覺得這個跨度合適，這版可以直接當新版本上架，當然要重新編號也完全沒問題。

---

## 5. 測試狀態與已知風險（誠實說明）

- 這些功能我都有**手動實測過**：建房/進房、換片/換頁、跨網域、全螢幕小窗、直播 vs 一般影片、通話、退房、人數顯示等情境。
- 過程中測出的 bug **大多已經修掉**；有幾個（例如換頁人數掉到 1、直播切一般影片卡結尾、無影片頁人數收不到）**根因不好找，是反覆用 Claude 一起追了很多輪才定位、修好的**。
- 我相信這次大更新**大部分 bug 都已處理**，但畢竟改動不小，**少數邊角情況可能還沒被我發現**。歡迎您測試 / 指正，也可以挑掉您覺得不適合的部分。
- 程式碼層面：產物（`release/`、各瀏覽器 `vt.*.user.js`）皆由 `source/` 重建，已通過 `node --check` 與既有單元測試。

---

## 6. 不必帶進上游的 fork 內部檔案

這些是 fork 開發過程的東西，PR 時可以排除（或您合併時刪掉）：
- `docs/UPSTREAM-PORT-CHECKLIST.md`（**本檔**）——只是 fork 端隨附給您的說明，合併時可直接刪。
- `assets/icons/`：fork 的圖示母檔/備份，非執行所需（上游若要圓角圖示，用 `source/chrome/icon/` 的 `icon-*` 與 `vt_64x64` 即可）。
- `docs/{en,zh-cn}/development.md` 與 `settings-linkage.md` 是通用開發說明，**可保留/一起貢獻**，只需把其中 fork 網址換成上游（見第 2 節）。

---

> 再次感謝您維護 VideoTogether 🙏 這份貢獻是站在您的專案基礎上做的，所有設計都儘量尊重原本的架構。若有任何需要調整或拆分的地方，我很樂意配合。
> — CYouuu（LCY000），with help from Claude
