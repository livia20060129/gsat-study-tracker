# 最新更新

版本：v171.6.13

## 手機版非頂部開啟連線設定的跳動修正

- 找到非頂部才發生的原因：開啟面板時曾對整個 `body` 套用 `overflow: hidden`，部分手機瀏覽器會因此換掉頁面捲動容器，重新計算目前捲動位置並造成整頁跳動。
- 開啟連線設定時不再改變頁面的 overflow，因此目前的頁面座標、sticky 位置與視覺 viewport 都不會重算。
- 背景停止捲動改由非被動的觸控／滾輪守衛處理；手勢位於連線設定內時仍可正常捲動，抵達頂端或底端時也不會把手勢傳到背景頁面。
- 延續上一版的固定面板高度與版面預留，避免開啟後的 Cloud／Calendar 訊息更新造成第二次移動。

更新資料夾：`gsat-study-tracker-v171.6.13-preserve-mobile-scroll-position`

## 驗證

- E2E 先將手機頁面捲動至非零位置，再驗證開啟、動態加長 Cloud 訊息及關閉三個階段；頁面捲動座標全程不變，面板頂端位移維持 0px。
- 385 項單元／回歸測試全部通過。
- 10 項 Chromium 真實瀏覽器 E2E 全部通過。
- TypeScript 型別檢查與 Vite 正式建置通過。

本次只調整前端動畫，不更動 Cloud、Calendar、Supabase 資料表或 Edge Function；重新建置並部署網站即可。

## Commit 建議

`fix(ui): preserve mobile scroll position for connection sheet`
