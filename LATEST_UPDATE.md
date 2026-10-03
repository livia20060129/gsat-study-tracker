# 最新更新

版本：v171.6.46

## 編輯內容分類

- 英文單字複習的每一列按下「編輯」後，新增「內容類型」選擇，可在單字、組合、句子之間切換。
- 分類變更會回寫相同文字的全部原始 Tracker 紀錄，避免重新整理後同一內容再次出現在不同分類。
- 改成單字時顯示詞性編輯；改成組合或句子時隱藏詞性，只保留中文翻譯。
- 儲存分類後會自動切換到對應頁籤，該列維持編輯狀態，可繼續補上詞性或翻譯。
- 重新整理頁面後仍會讀取已儲存的分類，並保留既有 LocalStorage、匯出／匯入及 Cloud round-trip 格式。

## 驗證

- 單元測試覆蓋單字、組合、句子三種分類的雙向轉換，以及相同文字的多筆來源同步更新。
- TypeScript 型別檢查與 Vite 正式建置通過。
- Chromium E2E 驗證編輯器分類切換、重新整理保留、詞性欄條件顯示與手機寬度。

更新資料夾：

- `gsat-study-tracker-v171.6.46-vocabulary-kind-editor-necessary-files`
- `gsat-study-tracker-v171.6.46-vocabulary-kind-editor-full-project`

## Commit 建議

`feat(vocabulary): allow editing word content type`
