# 最新更新

版本：v171.0.90

## 本次修正

- 修正今日狀態為「外出」時，已完成數學講義被排除於頁數進度之外的問題。
- 外出仍會取消並隱藏固定排程，不改變原有外出日行為。
- 自訂、Google Calendar、延期或合併子卡片只要實際完成，仍會依原規則去除重疊頁碼後，列入今日與本週數學頁數。
- 未完成的數學卡片不會提前計入。

## 更新檔案

- `src/study/mathProgress.ts`
- `tests/mathProgress.test.ts`
- `package.json`
- `package-lock.json`
- `README.md`
- `LATEST_UPDATE.md`

更新資料夾：`gsat-study-tracker-v171.0.90-away-math-progress-update`

## 驗證

- 234／234 項測試通過。
- TypeScript 檢查通過。
- 正式 Vite 建置通過。

## Commit 建議

`fix(math-progress): count completed pages on away days`
