# 最新更新

版本：v171.6.42

## 英文整理類型與單字複習編輯

- Tracker 的英文單字整理列保留 Noun、Verb 等詞性核取欄，並將原本的 `Fixed combination`、`Beautiful sentences` 改成獨立的「單字／組合／句子」動畫滑塊。
- 英文單字複習頁面不再顯示個別來源日期，只保留重複整理次數。
- 新增「字母排序／詞性」切換；詞性模式仍在每一組內依 A～Z 排列，相同單字可同時出現在多個已勾選詞性中。
- 每個單字旁新增可複選的詞性欄位與中文翻譯欄位。離開欄位後，修改會回寫相同單字的全部原始 Tracker 紀錄並標記為待同步，避免複習頁與每日紀錄形成兩份資料。
- 單字、組合與句子仍以文字本身連到 Oxford Learner's Dictionaries，不新增額外外部連結按鈕。

## 驗證

- 443 項單元／回歸測試全部通過。
- TypeScript 型別檢查與 Vite 正式建置通過。
- 19 項 Chromium E2E 全部通過，包含詞性／翻譯回寫、重複單字同步更新、詞性模式排序、手機寬度及既有 Tracker 流程。

更新資料夾：

- `gsat-study-tracker-v171.6.42-vocabulary-editing-necessary-files`
- `gsat-study-tracker-v171.6.42-vocabulary-editing-full-project`

## Commit 建議

`feat(vocabulary): add editable meanings and POS grouping`
