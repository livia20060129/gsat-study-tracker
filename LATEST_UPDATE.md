# 最新更新

版本：v171.5.5

## 完成率排版

- 「原訂今日項目完成率」與「今日總項目完成率」分成上下兩列。
- 每列的標題、數值、進度條與項目數保持靠左閱讀。
- 兩列形成的整組內容會在右側欄位中水平及垂直置中。

## 動畫

- 從今日完成時間切換到數學頁數時，右側兩列完成率會隨欄位縮短平滑移動。
- 切回今日完成時間時，完成率也會隨欄位放大平滑回到新的中央位置。
- 修正學習總結切換週／月後整頁消失；淡出完成會先清除舊透明狀態，再播放新內容的淡入與高度動畫。

更新資料夾：`gsat-study-tracker-v171.5.5-stacked-completion-metrics`

## 驗證

- 333 項單元／回歸測試通過。
- TypeScript 型別檢查、Vite 正式建置與 Playwright 瀏覽器測試通過。

本次不需要新增 Supabase migration，也不需要重新部署 Edge Function；只需部署新版 GitHub Pages 前端。

## Commit 建議

`fix(home): stack and left-align completion metrics`
