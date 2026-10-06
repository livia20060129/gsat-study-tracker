# 最新更新

版本：v171.6.50

## 狀態日完成率改為可切換

- 「本週小結／本月小結」新增「外出／身體不適日列入期間總完成率」切換。
- 預設維持「不列入」，避免既有統計結果在更新後自行改變。
- 切換為「列入」後，本期總完成率、與上期完成率比較及固定小結會使用相同規則重新計算。
- 日期圓環仍顯示該日完成率；切換只影響期間統計，不影響每日進度、學習時間或科目分配。
- 選擇保存在目前瀏覽器，重新整理、切換週／月或移動期間後仍會保留。

## 驗證

- 單元測試確認預設排除時維持原統計，切換列入後會納入外出與身體不適日的完成項目。
- Chromium E2E 驗證開關可操作、總完成率由 100% 重算為 92%，並在重新整理後維持「列入」。
- TypeScript 型別檢查、Vite 正式建置與總結頁瀏覽器測試通過。

更新資料夾：

- `gsat-study-tracker-v171.6.50-status-day-completion-toggle-necessary-files`
- `gsat-study-tracker-v171.6.50-status-day-completion-toggle-full-project`

## Commit 建議

`feat(summary): make status-day completion inclusion configurable`
