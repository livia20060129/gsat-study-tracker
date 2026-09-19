# 最新更新

版本：v171.6.19

## 今日資訊版面

- 日期與今日狀態的「標籤＋輸入控制」整組在各自欄位內上下置中，保留原本靠左排列。
- 作息時間不再常駐顯示「起床／就寢」摘要，小時與分鐘輸入框也不顯示提示字。
- 凌晨 00:00～05:59 的就寢仍會顯示必要的「此時間視為隔日凌晨」提示，跨日資料與睡眠計算規則不變。

## 名稱調整

- 首頁入口、頁面標題與瀏覽器分頁名稱由「學習總結」統一改為「週／月總結」。
- `summary.html` 網址、週／月統計資料、動畫及個人狀態功能完全不變。

## 驗證

- 自動測試確認作息輸入框沒有可見提示字、常駐摘要已移除，以及日期與今日狀態欄確實上下置中。
- 398 項單元／回歸測試、TypeScript 型別檢查、Vite 正式建置及 11 項 Chromium E2E 全部通過。

更新資料夾：

- `gsat-study-tracker-v171.6.19-routine-layout-required-files`
- `gsat-study-tracker-v171.6.19-routine-layout-full-project`

## Commit 建議

`fix(ui): refine routine layout and rename summary page`
