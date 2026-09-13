# 最新更新

版本：v171.1.21

## 本次修正

### 1. 損壞資料不再被當成空白

- 本機 JSON 損壞、結構錯誤或版本過新時，保留原始資料並建立獨立復原備份。
- 該日期在修復前禁止儲存與雲端同步，避免空白畫面覆蓋原有紀錄。
- 頁面會顯示常駐警告，可下載原始備份；登入後可明確選擇「使用雲端版本修復」。
- Supabase 回傳無法解碼的紀錄時會停止該次讀取並指出日期，不再靜默忽略。

### 2. 舊英文訂正列安全升級

- 舊版以列序產生的單字 ID 升級為 v2 穩定識別碼。
- 新識別碼不會因刪除或重新排列其他列而改變，降低重複單字與資料串列的風險。
- 保留輸入中半成品更新同一列的相容處理。

### 3. 舊瀏覽器也有跨分頁同步鎖

- 支援 Web Locks 的瀏覽器繼續使用原生鎖。
- 不支援 Web Locks 時，改用 localStorage 的跨分頁排隊鎖，不再只保護單一頁面。
- 分頁異常關閉後，過期鎖會自動清除，避免永久卡住同步。

### 4. JSON 匯入改為深層驗證

- 驗證子卡片、單字列、計時資料、自然整合頁碼、布林值與重複 ID。
- 阻擋過深、過大、未知版本及含危險物件鍵的資料。
- 任一筆不合格時仍維持整批拒絕，不會修改本機或雲端紀錄。

## 更新檔案

- `src/application/progressImport.ts`
- `src/infrastructure/storage/localStudyRecordRepository.ts`
- `src/infrastructure/storage/supabaseStudyRecordRepository.ts`
- `src/storage/crossTabLock.ts`
- `src/storage/recordSync.ts`
- `src/study/englishReview.ts`
- `src/legacy-app.ts`
- `src/types.ts`
- `src/styles.css`
- `index.html`
- `tests/crossTabLock.test.ts`
- `tests/progressImport.test.ts`
- `tests/recordMerge.test.ts`
- `tests/studyRecordRepositories.test.ts`
- `package.json`
- `package-lock.json`
- `LATEST_UPDATE.md`

更新資料夾：`gsat-study-tracker-v171.1.21-data-recovery-safety-update`

## 驗證

- TypeScript 檢查通過。
- 290 項自動測試全部通過。
- 正式 Vite 建置通過。

## Commit 建議

`fix(storage): add data recovery and cross-tab safety fallbacks`
