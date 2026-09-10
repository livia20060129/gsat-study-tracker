# 最新更新

版本：v171.0.95

## 本次修正

- 使用者切換日期時，先儲存目前日期的完整進度，再載入所選日期。
- 儲存失敗時取消日期切換，日期選擇器恢復原日期並顯示明確提示。
- 本機儲存成功後即可切換；登入時的雲端儲存沿用背景同步，不受網路速度影響。
- 加入成功與失敗流程的回歸測試，避免日後再次略過儲存結果。
- 登入期間每 10 分鐘自動保存目前日期，並立即處理待上傳的雲端資料。
- 定期上傳不會呼叫暫停或完成計時；運行中的計時器會保持原開始時間繼續累計。

## 更新檔案

- `src/legacy-app.ts`
- `tests/legacyCardRegression.test.ts`
- `package.json`
- `package-lock.json`
- `README.md`
- `LATEST_UPDATE.md`

更新資料夾：`gsat-study-tracker-v171.0.95-save-before-date-switch-update`

## 驗證

- 243／243 項測試通過。
- TypeScript 檢查通過。
- 正式 Vite 建置通過。

## Commit 建議

`feat(sync): save before date switch and upload every ten minutes`
