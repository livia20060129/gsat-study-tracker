# 最新更新

版本：v171.6.12

## 手機版連線設定完全展開後的位置修正

- 找到第二段移動原因：底部面板雖已完成動畫，但高度仍是自動值；Cloud／Calendar 訊息或登入狀態稍後更新時，底部錨定的面板會因高度改變而再次移動頂端位置。
- 手機面板現在會在開啟時計算並固定外框高度，動畫完成後不再移除這個高度。
- 後續狀態或提示文字增加時，改由面板既有的內部捲動承接，不影響外框位置與背景版面。
- 關閉時會正確清除固定高度；螢幕旋轉或視窗尺寸改變時才依新可用高度重新計算。

更新資料夾：`gsat-study-tracker-v171.6.12-stable-mobile-connection-sheet`

## 驗證

- 新增手機面板完全展開後動態加長 Cloud 訊息的 E2E 測試，面板頂端位移維持 0px。
- 385 項單元／回歸測試全部通過。
- 10 項 Chromium 真實瀏覽器 E2E 全部通過。
- TypeScript 型別檢查與 Vite 正式建置通過。

本次只調整前端動畫，不更動 Cloud、Calendar、Supabase 資料表或 Edge Function；重新建置並部署網站即可。

## Commit 建議

`fix(ui): stabilize mobile connection sheet after opening`
