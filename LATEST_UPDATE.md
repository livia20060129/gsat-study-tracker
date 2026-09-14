# 最新更新

版本：v171.2.5

## 本次一次完成

1. 同一天兩筆以上數學 Calendar 行程不再互相覆蓋；原排程與「新關鍵」等額外教材／範圍都會保留。
2. 星期日沒有內建數學進度卡時，Calendar 數學行程會自行建立卡片。
3. 合併大卡中的子卡片不再重複顯示標題，畫面直接從教材、冊別、頁碼與單元欄位開始。
4. 子卡片的完成勾選、時間、延期及其他輸入功能皆維持不變。

更新資料夾：`gsat-study-tracker-v171.2.5-calendar-math-child-layout`

## 驗證

- Supabase 實際資料確認 9/14～9/20 的「新關鍵」事件已同步並分類為 `math`。
- 311 項單元／回歸測試全部通過。
- 正式 TypeScript／Vite 建置通過。
- 3 項 Chromium 瀏覽器 E2E 全部通過。

本次不需要新增 Supabase migration，也不需要再次部署 Edge Function；只需部署新版 GitHub Pages 前端。

## Commit 建議

`fix(calendar): keep multiple math items without repeated child titles`
