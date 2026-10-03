# 最新更新

版本：v171.6.41

## 新增英文單字複習頁面

- 首頁新增「英文單字複習」入口，直接讀取 Tracker 目前帳號／訪客範圍的既有每日紀錄，不建立第二份單字資料。
- 彙整所有自行新增的單字與片語，空白內容不顯示；大小寫及首尾空白不同的相同內容會合併，並保留整理次數、最近紀錄日期與全部詞性標註。
- 清單依 A～Z 排序，支援字母與文字／詞性搜尋；非英文字首內容集中在 `#`。
- 每個單字的文字本身就是 Oxford Learner's Dictionaries 查詢連結，於新分頁開啟，不再增加「Oxford 查看」按鈕。
- 含中文備註或符號的內容會擷取最合適的英文單字／片語作為 Oxford 查詢值；完全沒有英文的內容仍保留，但不建立無效連結。
- 新頁面已加入手機版單欄配置與寬度防溢出處理。

## 驗證

- 新增彙整、巢狀項目、重複合併、排序、Oxford 查詢值及無英文內容測試。
- 新增瀏覽器測試，驗證首頁入口、單字文字連結、A～Z 排序、篩選、詞性合併與手機版寬度。
- 完整單元／回歸測試、TypeScript 型別檢查、Vite 正式建置與 Chromium E2E 均已執行。

更新資料夾：

- `gsat-study-tracker-v171.6.41-vocabulary-review-required-files`
- `gsat-study-tracker-v171.6.41-vocabulary-review-full-project`

## Commit 建議

`feat(vocabulary): add alphabetical English review page`
