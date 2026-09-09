# 最新更新

版本：v171.0.91

## 本次更新

- 計時顯示仍使用「分：秒」。
- 按下「完成並填入」後，將經過秒數換算成分鐘並四捨五入至小數點後一位。
- 15 秒記為 `0.3` 分、1 分 29 秒記為 `1.5` 分、1 分 33 秒記為 `1.6` 分。
- 尚未開始計時不會寫入紀錄；已開始但極短的紀錄依正常四捨五入顯示 `0.0` 分。
- 一般卡片、英文雜誌子項目與合併子卡片都使用相同的小數紀錄規則。
- 計時結果仍會覆蓋舊的手動時間，並可在重新整理及本機／雲端紀錄格式中保留。
- 今日完成時間加總會四捨五入至一位小數，避免顯示浮點尾數。

## 更新檔案

- `src/study/studyTimer.ts`
- `src/legacy-app.ts`
- `tests/studyTimer.test.ts`
- `tests/dailyWorkGroup.test.ts`
- `tests/studyRecordRoundTrip.test.ts`
- `tests/legacyCardRegression.test.ts`
- `package.json`
- `package-lock.json`
- `README.md`
- `LATEST_UPDATE.md`

更新資料夾：`gsat-study-tracker-v171.0.91-decimal-timer-update`

## 驗證

- 236／236 項測試通過。
- TypeScript 檢查通過。
- 正式 Vite 建置通過。

## Commit 建議

`feat(timer): record elapsed minutes to one decimal place`
