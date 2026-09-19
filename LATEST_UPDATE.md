# 最新更新

版本：v171.6.10

## 連線設定動畫修正

- 原本桌面展開、桌面收合與手機底部視窗分別使用不同的 transition／keyframe，內容本身又套用另一組秒數，造成外框與內容不同步。
- 原本展開高度只在開始時量測一次；若 Cloud／Calendar 狀態在動畫中更新，內容高度改變就會突然跳動。
- 現在桌面與手機共用單一 `opening／closing` 狀態控制器，展開與收合使用對稱且一致的動畫節奏。
- 收合時會等外框動畫完成後才關閉內容，避免文字先消失、外框再縮回的斷裂感。
- 展開期間會監看內容尺寸，登入狀態或提示文字造成高度改變時，會平順更新動畫終點。
- 保留系統「減少動態效果」設定；啟用時會立即展開／收合，不強制播放動畫。

更新資料夾：`gsat-study-tracker-v171.6.10-smooth-connection-settings`

## 驗證

- 385 項單元／回歸測試全部通過。
- 10 項 Chromium 真實瀏覽器 E2E 全部通過，包含桌面高度過渡與手機底部視窗開合。
- TypeScript 型別檢查與 Vite 正式建置通過。

本次只調整前端動畫，不更動 Cloud、Calendar、Supabase 資料表或 Edge Function；重新建置並部署網站即可。

## Commit 建議

`fix(ui): smooth connection settings transitions`
