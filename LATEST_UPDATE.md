# 最新更新

版本：v171.6.0

## 第一階段全專案結構整理

- 完成勾選、合併子項目與延期來源回寫移至 `src/study/completionTree.ts`。
- 已完成項目的時間判斷、實際勾選日歸屬、重複項目排除與科目統計移至 `src/study/completedStudyTime.ts`。
- 首頁「今日完成時間」的資料組裝移至 `src/application/overview/overviewStudyTime.ts`，並與學習總結共用相同來源。
- `src/study/learningSummary.ts` 只保留期間、完成率、起床時間與固定小結等週／月規則。
- 移除未被載入的 `mathProgressHistory.ts` 與 `weeklyMath.ts`，數學進度維持 `mathProgress.ts` 為單一來源。
- `npm test` 改為自動執行所有 `tests/*.test.ts`，新增測試時不必再手動修改長清單。
- 新增 `ARCHITECTURE.md`，明確規定各層責任、單一資料來源及後續拆分順序。

本次只調整程式邊界與可測試性，不改變畫面、儲存格式、完成率、時間統計或 Cloud 行為。

更新資料夾：`gsat-study-tracker-v171.6.0-core-refactor`

## 驗證

- 364 項單元／回歸測試通過。
- TypeScript 型別檢查與 Vite 正式建置通過。
- 8 項 Playwright 瀏覽器流程測試通過。

本次不需要新增 Supabase migration，也不需要重新部署 Supabase Edge Function。

## Commit 建議

`refactor(core): extract completion flows and remove dead runtime code`
