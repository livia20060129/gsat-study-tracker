# 最新更新

版本：v171.6.49

## 週／月總結補上總完成率

- 「本週小結／本月小結」原本只顯示完成率相較上期的增減，沒有顯示目前期間本身的完成率。
- 現在於「與上期比較」區塊右上方補上醒目的「總完成率」。
- 總完成率直接使用該週／月既有的結算完成率，不另建第二套算法。
- 切換週／月、上一期／下一期或資料更新時，總完成率會與全頁同步更新。
- 外出與身體不適日仍顯示當日進度，但依既有規則不列入週／月總完成率。

## 驗證

- 單元測試確認總結頁存在唯一的總完成率欄位，且直接取用目前期間的 `settlementPercent`。
- Chromium E2E 以完整完成的本週資料驗證總完成率顯示為 100%。
- 完整單元測試、TypeScript 型別檢查、Vite 正式建置與瀏覽器 E2E 測試通過。

更新資料夾：

- `gsat-study-tracker-v171.6.49-summary-total-completion-necessary-files`
- `gsat-study-tracker-v171.6.49-summary-total-completion-full-project`

## Commit 建議

`feat(summary): show the current period total completion rate`
