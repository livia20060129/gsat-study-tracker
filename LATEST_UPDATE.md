# 最新更新

版本：v171.6.47

## 編輯英文內容

- 英文單字複習的每一列按下「編輯」後，新增「英文內容」欄位。
- 單字、組合及句子都能直接修改原始英文文字，空白內容不允許儲存。
- 文字變更會回寫相同項目的全部原始 Tracker 紀錄並標記待同步。
- 儲存後會以新文字重新排序，Oxford 查詢連結也會同步更新。
- 重新整理頁面後仍會保留修改結果；若新文字與既有項目相同，彙整頁會自然合併重複內容。

## 驗證

- 單元測試覆蓋英文文字的多筆來源同步改名。
- Chromium E2E 驗證英文欄位僅在編輯模式出現、改名後重新整理仍保留，並可再改回原文字。
- 完整單元測試、TypeScript 型別檢查、Vite 正式建置與瀏覽器 E2E 測試通過。

更新資料夾：

- `gsat-study-tracker-v171.6.47-vocabulary-text-editor-necessary-files`
- `gsat-study-tracker-v171.6.47-vocabulary-text-editor-full-project`

## Commit 建議

`feat(vocabulary): allow editing English entry text`
