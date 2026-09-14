# 最新更新

版本：v171.2.7

## 本次一次完成

1. 點擊標題列的「教材進度圖」後，改為在目前分頁直接前往教材進度頁。
2. 不再另外開啟新分頁；「排程建議prompt」仍維持原本的新分頁開啟方式。

更新資料夾：`gsat-study-tracker-v171.2.7-material-progress-same-tab`

## 驗證

- 313 項單元／回歸測試全部通過。
- 正式 TypeScript／Vite 建置通過。
- 3 項 Chromium 瀏覽器 E2E 全部通過。

本次不需要新增 Supabase migration，也不需要再次部署 Edge Function；只需部署新版 GitHub Pages 前端。

## Commit 建議

`fix(ui): open material progress in the current tab`
