# 最新更新

版本：v171.5.6

## 學習總結互動

- 日期懸浮提示改為淡入並微幅上移，手機點擊時使用相同動畫。
- 科目明細每欄最多四項，固定先向下排列，填滿後才移到右欄。
- 進入單科目時，圓環會依原始大圓與目標小圓的實際位置，平滑縮小並移到左側。
- 手機版維持「小圓環在左、項目明細在右」，不再改成上下排列。

## 手機頁首與色調

- 「學習總結」標題改為與「教材進度圖」相同的 28px。
- 「回到 Tracker」移至標題下方並撐滿欄寬，位置與教材進度圖頁面一致。
- 週／月全域滑塊改為學習時數藍 `#528bd0`，與日期圓心及趨勢圖一致。
- 週／月全域滑塊與期間切換功能完整保留。

更新資料夾：`gsat-study-tracker-v171.5.6-summary-mobile-layout`

## 驗證

- 333 項單元／回歸測試通過。
- TypeScript 型別檢查、Vite 正式建置與 Playwright 桌機／手機瀏覽器測試通過。

本次不需要新增 Supabase migration，也不需要重新部署 Edge Function；只需部署新版 GitHub Pages 前端。

## Commit 建議

`feat(summary): refine mobile drilldown motion and header`
