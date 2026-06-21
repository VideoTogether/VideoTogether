# 品牌圖示存檔 / Brand icon archive

這裡是**所有圖示的備份／母檔**，方便日後重新製作，不會被打包進擴充功能。
This is a **backup / master archive** of all icon images, for regenerating later. It is **not** shipped with the extension.

| 檔案 | 說明 | 線上使用位置（live） |
| --- | --- | --- |
| `vt.png` | 水彩**母檔**（192px，未圓角）。圓角圖示都從它重切。 | 母檔，無人直接引用 |
| `icon-16/32/48/128/192.png` | 圓角（24%）多尺寸圖示 | **`source/chrome/icon/`**（chrome manifest 圖示、popup 標頭） |
| `vt_64x64.png` / `vt_gray_64x64.png` | 圓角的執行時工具列圖（彩色＝啟用／灰＝未啟用） | **`source/chrome/icon/`**（`background.js` 用 `action.setIcon` 切換） |
| `favicon-16x16/32x32/96x96.png` | 網站 favicon | 擴充功能未使用；`@icon` 標頭指向遠端 `videotogether.github.io/icon/favicon-32x32.png` |

> 線上（live）的圖示請以 `source/chrome/icon/` 為準；本資料夾只是存檔。
> The live icons live in `source/chrome/icon/`; this folder is just the archive.
