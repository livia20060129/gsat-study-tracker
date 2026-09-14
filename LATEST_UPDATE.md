# 最新更新

版本：v171.2.8

## 本次一次完成

1. 今日／本週數學頁數只依實際填入並保存的頁碼統計。
2. 單純勾選 Google Calendar 的建議頁數項目，不會把整段建議範圍算成已完成頁數。
3. 即使尚未勾選完成，只要已實際填入頁碼，該範圍仍會列入頁數統計。
4. 教材進度圖的數學長條套用相同規則，並依實際頁數計算填色百分比。

更新資料夾：`gsat-study-tracker-v171.2.8-recorded-math-pages`

## 驗證

- 315 項單元／回歸測試全部通過。
- 正式 TypeScript／Vite 建置通過。
- 3 項 Chromium 瀏覽器 E2E 全部通過。

本次不需要新增 Supabase migration，也不需要再次部署 Edge Function；只需部署新版 GitHub Pages 前端。

## Commit 建議

`fix(progress): count recorded math pages instead of checked suggestions`
