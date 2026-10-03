# 最新更新

版本：v171.6.44

## 單字、組合與句子分開顯示

- 英文單字複習頁新增第一層「單字／組合／句子」滑塊，三種內容各自顯示，不再混在同一份清單。
- 預設進入「單字」；切換分類時會重設字母篩選，避免沿用前一分類的隱藏條件。
- 「字母排序／詞性」只在單字分類顯示；組合與句子各自維持 A～Z 排列。
- 同一文字若曾以不同內容類型記錄，會分別出現在對應分類，不會遺失既有資料。
- 每列仍維持預設唯讀，按「編輯」後才可修改詞性與中文翻譯，按「完成」後恢復唯讀。

## 驗證

- 443 項單元／回歸測試全部通過。
- TypeScript 型別檢查與 Vite 正式建置通過。
- Chromium E2E 驗證單字、組合、句子三份清單確實分離，且既有編輯、排序、搜尋與資料回寫流程維持正常。

更新資料夾：

- `gsat-study-tracker-v171.6.44-vocabulary-kind-tabs-necessary-files`
- `gsat-study-tracker-v171.6.44-vocabulary-kind-tabs-full-project`

## Commit 建議

`fix(vocabulary): separate words phrases and sentences`
