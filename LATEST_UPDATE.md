# 最新更新

版本：v171.5.28

## 學習總結統計與自然科分配

- 外出與身體不適日仍在週曆／月曆顯示當日學習時間和完成進度。
- 這兩種狀態的當日完成率不納入週／月總完成率、上期比較與固定小結。
- 當日實際學習時間仍照常納入科目分配與學習趨勢。
- 日期提示會清楚標示「不列入週／月完成率」。
- 科目分配外層把物理、化學、生物與地科合併顯示為「自然」。
- 點入「自然」後，再以不同顏色與文字標註分別顯示物理、化學、生物與地科的比例及時間。
- 無法辨識細科目的舊自然紀錄保留為「自然整合」，不會遺失已記錄時間。

更新資料夾：`gsat-study-tracker-v171.5.28-summary-status-natural-grouping`

## 驗證

- 352 項單元／回歸測試通過。
- TypeScript 型別檢查與 Vite 正式建置通過。
- 8 項 Playwright 瀏覽器流程測試通過。

本次不需要新增 Supabase migration，也不需要重新部署 Supabase Edge Function。

## Commit 建議

`feat(summary): group natural sciences and exclude special-status completion`
