# 最新更新

版本：v171.2.6

## 本次一次完成

1. 合併大卡中的子卡片不再顯示 `p.x–y` 頁碼標題，直接呈現可操作欄位。
2. 子卡片的完成勾選、時間、頁碼輸入、延期及其他欄位皆維持不變。
3. Google Calendar 指定的數學講義版本改為固定顯示，不能在 Tracker 內誤改。
4. 手動新增的數學卡片仍保留講義版本選單。

更新資料夾：`gsat-study-tracker-v171.2.6-child-page-title-math-version-lock`

## 驗證

- 312 項單元／回歸測試全部通過。
- 正式 TypeScript／Vite 建置通過。
- 3 項 Chromium 瀏覽器 E2E 全部通過。

本次不需要新增 Supabase migration，也不需要再次部署 Edge Function；只需部署新版 GitHub Pages 前端。

## Commit 建議

`fix(math): hide child page headings and lock calendar material`
