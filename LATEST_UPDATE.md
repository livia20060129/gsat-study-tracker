# 最新更新

版本：v171.1.14

## 本次修正

- 「儲存紀錄」上傳前會以日期為單位取得跨分頁鎖，避免多個分頁同時寫入同一天。
- 鎖定後先合併排隊時的分頁內容與目前本機內容，再讀取 Supabase 最新版本交叉比對。
- 雙方不同的卡片、合併卡子項目與已填欄位會一併保留；空白值不會取代另一端已有的紀錄。
- 上傳一律使用剛讀取到的最新 revision；若仍遇到其他裝置同時寫入，會重新讀取、合併並重試一次。
- 兩次仍無法完成才保留同步衝突提示，不會強制覆蓋雲端。

## 更新檔案

- `src/storage/recordSync.ts`
- `src/legacy-app.ts`
- `tests/recordMerge.test.ts`
- `package.json`
- `package-lock.json`
- `LATEST_UPDATE.md`

完整資料夾：`gsat-study-tracker-v171.1.14-complete`

## 驗證

- TypeScript 檢查通過。
- 全部自動測試通過。
- 正式 Vite 建置通過。

## Commit 建議

`fix(sync): merge cross-tab study records before cloud upload`
