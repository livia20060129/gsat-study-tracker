# 最新更新

版本：v171.6.15

## 新關鍵教材進度改用大主題

- 教材進度圖的生物《新關鍵》由 26 個小主題進度格合併為 6 個大主題。
- 化學《新關鍵》依 8 個單元、歷屆闖關練功坊與科學探究練功坊，合併為 10 個大主題。
- 每個大主題的填色比例仍只依該範圍內「已勾選完成且有實際紀錄」的頁數計算，不會把 Calendar 建議頁碼當成完成進度。
- 數學《新關鍵》原先已按大單元呈現，1～2 冊與 3A～4A 各維持 7 個進度格。

更新資料夾：`gsat-study-tracker-v171.6.15-new-key-large-topic-progress`

## 驗證

- 386 項單元／回歸測試全部通過。
- 教材進度專項測試 20 項全部通過。
- TypeScript 型別檢查與 Vite 正式建置通過。

本次只調整教材進度的分組呈現，不更動紀錄資料、Cloud、Calendar、Supabase 資料表或 Edge Function；重新建置並部署網站即可。

## Commit 建議

`feat(progress): group New Key materials by large topics`
