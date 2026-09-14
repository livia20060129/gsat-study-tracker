# 最新更新

版本：v171.2.4

## 本次一次完成

1. 確認 Supabase 已正確收到「新關鍵」行程，問題實際位於 Tracker 前端一天只保存一筆數學排程。
2. 同一天兩筆以上數學 Calendar 行程不再互相覆蓋；原排程保留在固定數學卡，其他教材或範圍會另外保留。
3. 額外數學排程會保持可見並可分別記錄；相同教材的連續範圍仍可依既有規則合併。
4. 星期日沒有內建數學進度卡時，Calendar 數學行程會自行建立卡片，不再被略過。

更新資料夾：`gsat-study-tracker-v171.2.4-calendar-multiple-math-fix`

## 驗證

- Supabase 實際資料確認 9/14～9/20 的「新關鍵」事件已同步並分類為 `math`。
- 310 項單元／回歸測試全部通過。
- 正式 TypeScript／Vite 建置通過。
- 3 項 Chromium 瀏覽器 E2E 全部通過。

本次不需要新增 Supabase migration，也不需要再次部署 Edge Function；只需部署新版 GitHub Pages 前端。

## Commit 建議

`fix(calendar): preserve multiple math events on the same day`
