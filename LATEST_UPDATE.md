# 最新更新

版本：v171.6.23

## 完成日期位置與名稱統一

- 一般、延期、互動題及巢狀子項目的日期欄位一律顯示為「完成日期」。
- 完成日期統一放在項目標題或類型標題下方，不再與勾選框、時間控制並排。
- 合併子項目維持既有的無重複標題設計，完成日期放在其既有內容標示下方。
- 本次只調整顯示名稱與位置；日期修改後的時間歸屬、合併來源同步及延期原日期同步邏輯維持不變。

## 驗證

- 單元／回歸測試涵蓋一般與延期項目顯示文字，以及互動題、巢狀子項目的標題與日期排列順序。
- 瀏覽器測試會確認延期項目顯示「完成日期」、日期位於標題下方，並驗證修改及取消勾選後的同步結果。
- 400 項單元／回歸測試、TypeScript 型別檢查、Vite 正式建置及 11 項 Chromium E2E 全部通過。

更新資料夾：

- `gsat-study-tracker-v171.6.23-completion-date-layout-required-files`
- `gsat-study-tracker-v171.6.23-completion-date-layout-full-project`

## Commit 建議

`fix(completion): place completion dates below item titles`
