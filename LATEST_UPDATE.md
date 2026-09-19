# 最新更新

版本：v171.6.14

## 手機版連線設定改用捲動後的實際位置

- 上一版已保持背景頁面的 scrollY，但面板仍會從捲動後的 sticky 位置瞬間切換到由視窗底部推算的 fixed 位置，因此使用者仍會看到連線設定本身跳動。
- 現在點擊時會先讀取縮合列當下的 `getBoundingClientRect()`，完整保留它相對於目前視窗的頂端、左側與寬度。
- 展開動畫只改變高度，面板從目前看到的位置向下展開；收回時則縮回同一位置，再交還給原本的 sticky 元素。
- 展開高度依「目前錨點到可視視窗底部」的剩餘空間計算，不再假設面板位於頁面最頂部，也不會超出手機可視範圍。
- 保留背景觸控／滾輪守衛及固定外框機制，避免背景捲動或 Cloud／Calendar 訊息更新造成額外位移。

更新資料夾：`gsat-study-tracker-v171.6.14-scroll-aware-connection-anchor`

## 驗證

- E2E 先將手機頁面捲動 520px，再記錄縮合列實際頂端；準備、展開完成、動態加長 Cloud 訊息、收回中及收回完成五個階段的頂端位移皆小於 1px。
- 385 項單元／回歸測試全部通過。
- 10 項 Chromium 真實瀏覽器 E2E 全部通過。
- TypeScript 型別檢查與 Vite 正式建置通過。

本次只調整前端動畫，不更動 Cloud、Calendar、Supabase 資料表或 Edge Function；重新建置並部署網站即可。

## Commit 建議

`fix(ui): anchor connection motion to the current scroll position`
