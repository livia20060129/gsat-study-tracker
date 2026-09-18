# 最新更新

版本：v171.6.5

## 修正返回主頁後今天紀錄被舊排程取代

- 已重現：未修改任何欄位，從 Tracker 前往學習總結再返回後，今天的項目會從 9 項變成 8 項；Calendar 的數學卡消失，自然頁碼也會退回 fallback。
- Cloud／Calendar 啟動期間改為直接顯示今天實際儲存的完整紀錄，不先套用內建排程。
- Calendar API 任務快取成功載入後，才重新比對排程並刷新畫面。
- Calendar 讀取逾時或失敗時保留原紀錄，不再用 fallback 覆寫。
- 不改變資料格式、Supabase 資料表或 Calendar Edge Function。

更新資料夾：`gsat-study-tracker-v171.6.5-calendar-reload-preserves-records`

## 驗證

- 372 項單元／回歸測試通過。
- 8 項 Chromium 瀏覽器流程測試通過。
- TypeScript 型別檢查與 Vite 正式建置通過。

本次不更動資料格式，不需要新增 Supabase migration，也不需要重新部署 Supabase Edge Function；網站重新建置部署即可。

## Commit 建議

`fix(calendar): preserve saved records during reload bootstrap`
