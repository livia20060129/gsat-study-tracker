# 最新更新

版本：v171.5.29

## 學習總結圖例與自然科分項

- 將「深綠完整圓環＝100% 完成」修正為「亮綠完整圓環＝100% 完成」。
- 新增狀態色圖例：紅色圓心＝身體不適、橘色圓心＝疲倦、黃色圓心＝外出。
- 科目分配外層仍將物理、化學、生物與地科合併成「自然」。
- 點入「自然」後保留四科各自的教材／項目分項，並以四科色系區分；同一細科的多個項目使用同色系深淺。
- 無法辨識細科目的舊自然紀錄保留為「自然整合」，不會遺失已記錄時間。

更新資料夾：`gsat-study-tracker-v171.5.29-summary-legend-natural-items`

## 驗證

- 352 項單元／回歸測試通過。
- TypeScript 型別檢查與 Vite 正式建置通過。
- 8 項 Playwright 瀏覽器流程測試通過。

本次不需要新增 Supabase migration，也不需要重新部署 Supabase Edge Function。

## Commit 建議

`feat(summary): clarify calendar legend and preserve science item details`
