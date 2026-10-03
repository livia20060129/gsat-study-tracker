# 最新更新

版本：v171.6.43

## 單字複習改為明確編輯模式

- 英文單字複習中的每一列預設為唯讀，只顯示目前詞性、中文翻譯、內容類型與整理次數。
- 詞性核取欄及中文翻譯輸入框不會常駐；必須先按該列的「編輯」才會出現並可操作。
- 編輯時按鈕改為「完成」，按下後收起欄位並恢復唯讀，降低瀏覽清單時誤改資料的可能性。
- 修改仍會回寫所有相同單字的原始 Tracker 紀錄並標記為待同步；不建立第二份獨立資料。
- 詞性顯示順序固定為 Noun、Verb、Adjective、Adverb、Preposition、Conjunction，不受單字首次出現日期影響。

## 驗證

- 443 項單元／回歸測試全部通過。
- TypeScript 型別檢查與 Vite 正式建置通過。
- Chromium E2E 驗證預設無可編輯欄位、按「編輯」後才可修改、按「完成」恢復唯讀，以及修改內容確實回寫原始紀錄。

更新資料夾：

- `gsat-study-tracker-v171.6.43-vocabulary-edit-mode-necessary-files`
- `gsat-study-tracker-v171.6.43-vocabulary-edit-mode-full-project`

## Commit 建議

`fix(vocabulary): require explicit edit mode`
