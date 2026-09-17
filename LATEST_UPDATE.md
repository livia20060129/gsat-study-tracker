# 最新更新

版本：v171.5.30

## 完成時間依實際勾選日歸屬

- 每次手動勾選都會比較項目原日期與實際勾選日。
- 原日期與勾選日不同時，不論項目來自過去或未來，分鐘數都計入實際勾選日。
- 原日期當天勾選時仍計入原日期，不新增多餘日期標記。
- 延期卡、合併卡及可計時子項目沿用相同歸屬規則。
- 首頁「今日完成時間」與學習總結的週／月時間統計共用實際勾選日，跨週／跨月來源也不會漏算。

更新資料夾：`gsat-study-tracker-v171.5.30-completion-time-attribution`

## 驗證

- 356 項單元／回歸測試通過。
- TypeScript 型別檢查與 Vite 正式建置通過。
- 8 項 Playwright 瀏覽器流程測試通過。

本次不需要新增 Supabase migration，也不需要重新部署 Supabase Edge Function。

## Commit 建議

`fix(time): attribute completed minutes to the actual check date`
