# 最新更新

版本：v171.3.0

## 學習總結

- 新增獨立「學習總結」頁面，從 Tracker 標題列直接進入。
- 右上角僅保留一組週／月滑塊，作為曆、科目分配、趨勢、平均起床、比較與小結的共同期間控制。
- 週模式提供上一週／下一週，月模式提供上一月／下一月。
- 曆區塊為頁面最大區塊；週曆右側不附加圖例展示。
- 科目分配圓環中央顯示本期總分鐘，不另設總時數卡片。
- 沿用現有 Study Tracker 儲存紀錄、完成率規則、完成時間與日期處理，不建立第二套資料來源。

更新資料夾：`gsat-study-tracker-v171.3.0-learning-summary`

## 驗證

- 325 項單元／回歸測試全部通過。
- 正式 TypeScript／Vite 建置通過，`summary.html` 已包含在部署產物。
- 5 項 Chromium 瀏覽器 E2E 全部通過，包含週／月全頁同步切換。
- 已檢查桌面週模式、桌面月模式及手機版面。

本次不需要新增 Supabase migration，也不需要重新部署 Edge Function；只需部署新版 GitHub Pages 前端。

## Commit 建議

`feat(summary): add unified weekly and monthly learning overview`
