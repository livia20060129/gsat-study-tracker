# 最新更新

版本：v171.6.37

## iOS 日期欄寬度修正

- 確認根因是 iOS 26 WebKit 的原生日期控制項已知問題：`width: 100%` 搭配 padding 時，水平 padding 會被錯誤加到容器寬度之外。
- 主日期欄改為 `width: auto` 並由 flex stretch 計算完整外框寬度，不再走 Safari 有問題的百分比寬度路徑。
- 保留原生日期選擇器、原有水平留白、欄位置中方式與桌面版三欄配置，不以裁切或縮減 padding 掩蓋問題。
- 手機版單欄 Grid 仍使用 `minmax(0, 1fr)`，並由 CSS 回歸測試與 390px viewport 邊界檢查共同保護。

## 驗證

- 425 項單元／回歸測試、TypeScript 型別檢查、Vite 正式建置與 17 項 Chromium E2E 全部通過。

更新資料夾：

- `gsat-study-tracker-v171.6.37-ios-date-width-required-files`
- `gsat-study-tracker-v171.6.37-ios-date-width-full-project`

## Commit 建議

`fix(ui): avoid iOS date input width overflow`
