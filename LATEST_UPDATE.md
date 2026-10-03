# 最新更新

版本：v171.6.45

## 排序索引重新分配

- 「字母排序」不再顯示 A～Z 按鈕，也不再用 A、B、C 等標題切割清單；畫面直接呈現完整的 A～Z 排序結果。
- 「詞性」模式新增詞性索引：全部、Noun、Verb、Adjective、Adverb、Preposition、Conjunction、未標註。
- 點選詞性索引後只顯示該詞性群組；群組內仍以英文字母排序。
- 沒有資料的詞性索引會停用，避免切換到無內容畫面。
- 組合與句子維持各自的純字母排序清單，不顯示額外索引。
- 組合與句子不顯示詞性摘要，進入編輯模式時也不建立詞性核取欄，只保留中文翻譯欄位。

## 驗證

- 443 項單元／回歸測試全部通過。
- TypeScript 型別檢查與 Vite 正式建置通過。
- Chromium E2E 驗證字母模式沒有索引、詞性模式具有可切換索引，以及單字／組合／句子分流、編輯與資料回寫維持正常。

更新資料夾：

- `gsat-study-tracker-v171.6.45-vocabulary-pos-index-necessary-files`
- `gsat-study-tracker-v171.6.45-vocabulary-pos-index-full-project`

## Commit 建議

`refactor(vocabulary): move index navigation to POS view`
