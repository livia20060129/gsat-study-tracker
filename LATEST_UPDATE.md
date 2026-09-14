# 最新更新

版本：v171.2.13

## 本次一次完成

1. 勾選 Google Calendar 數學項目後，今日／本週完成頁數會立即更新。
2. 增加的頁數只取使用者實際填入並儲存的起始頁與結束頁，不採用 Calendar 建議範圍。
3. 尚未填入實際頁碼或尚未勾選完成，皆不計入頁數。
4. 相容舊版以布林標記保存的實際頁碼紀錄，避免誤算成第 1 頁。

更新資料夾：`gsat-study-tracker-v171.2.13-calendar-actual-page-count`

## 驗證

- 320 項單元／回歸測試全部通過。
- 正式 TypeScript／Vite 建置通過。
- 4 項 Chromium 瀏覽器 E2E 全部通過。

本次不需要新增 Supabase migration，也不需要再次部署 Edge Function；只需部署新版 GitHub Pages 前端。

## Commit 建議

`fix(progress): count actual pages when Calendar item is completed`
