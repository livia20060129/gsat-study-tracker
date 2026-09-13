# 最新更新

版本：v171.1.20

## 本次修正

- 同步改為以「上次成功同步版本／本機目前版本／雲端目前版本」三方比對，不再把有內容的舊值一律合併回來。
- 使用者刪除項目、子項目或單字列後，只要另一端未修改該資料，刪除結果會正確同步，不會再被雲端復活。
- 使用者把時間、文字或備註清空後，空白會視為有效修改，不會被舊值補回。
- 兩端修改不同欄位時會自動合併；兩端同時修改同一欄位，或一端刪除、另一端修改時，會停止上傳並列出衝突位置。
- 「完整保留本機版本」會精確使用本機資料覆蓋，不再把雲端舊項目混回來；「完整採用雲端版本」也會精確替換本機資料。
- 每次人工處理衝突前都會建立可復原備份；若雲端在處理後沒有再被修改，可按「復原上次衝突處理」回到處理前狀態。
- 同步共同版本只保存在瀏覽器本機，不會寫入 Supabase 的紀錄內容。

## 更新檔案

- `src/storage/recordSync.ts`
- `src/infrastructure/storage/supabaseStudyRecordRepository.ts`
- `src/legacy-app.ts`
- `src/types.ts`
- `src/styles.css`
- `index.html`
- `tests/recordMerge.test.ts`
- `package.json`
- `package-lock.json`
- `LATEST_UPDATE.md`

更新資料夾：`gsat-study-tracker-v171.1.20-three-way-sync-conflict-update`

## 驗證

- TypeScript 檢查通過。
- 283 項自動測試全部通過。
- 正式 Vite 建置通過。

## Commit 建議

`fix(sync): preserve deletions and add three-way conflict resolution`
