# 最新更新

版本：v171.1.17

## 本次修正

- 滑鼠指向、鍵盤聚焦或手機點擊圓環科目時，中央下方改為顯示該科目的實際分鐘數。
- 保留選取科目時淡化其他科目的互動。
- 尚未填入任何時間時改用獨立 SVG 軌道，不再以整塊圓形背景模擬圓環。
- 空白狀態軌道寬度縮小為 20px，已填入時間的彩色圓環維持原本粗細。

## 更新檔案

- `src/legacy-app.ts`
- `src/styles.css`
- `tests/subjectTime.test.ts`
- `package.json`
- `package-lock.json`
- `LATEST_UPDATE.md`

更新資料夾：`gsat-study-tracker-v171.1.17-subject-minutes-empty-ring-update`

## 驗證

- 科目分鐘數提示與空白圓環結構已有自動測試保護。
- TypeScript 檢查通過。
- 全部自動測試通過。
- 正式 Vite 建置通過。

## Commit 建議

`fix(analytics): show subject minutes and slim empty ring`
