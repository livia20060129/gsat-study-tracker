# 最新更新

版本：v171.6.36

## 手機日期欄寬度修正

- 修正 iPhone／手機瀏覽器的原生日期輸入元件受內在最小寬度影響，向右超出「日期」卡片框線的問題。
- 日期輸入現在明確允許縮小且不超過父容器；手機版單欄 Grid 改用 `minmax(0, 1fr)`，避免原生控制項反向撐大欄位。
- 保留原生日期選擇器、欄位置中方式與桌面版三欄配置，不以裁切方式隱藏溢出。
- 新增 CSS 回歸測試及 390px 手機 viewport 的實際邊界檢查。

## 驗證

- 425 項單元／回歸測試、TypeScript 型別檢查、Vite 正式建置與 17 項 Chromium E2E 全部通過。

更新資料夾：

- `gsat-study-tracker-v171.6.36-mobile-date-width-required-files`
- `gsat-study-tracker-v171.6.36-mobile-date-width-full-project`

## Commit 建議

`fix(ui): keep mobile date input inside its card`
