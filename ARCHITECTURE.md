# 專案架構與整理原則

本文件記錄個人版 Study Tracker 的程式邊界，目的是讓新功能有固定放置位置，避免再堆回 `legacy-app.ts`。

## 資料流

```text
presentation / pages / legacy UI
                ↓
application use cases
                ↓
study domain rules
                ↑
infrastructure repositories and gateways
```

- `src/study/`：可獨立測試的讀書規則，例如完成率、完成日期、完成時間、延期、合併與計時。
- `src/application/`：把多個規則組成使用案例，但不直接操作 DOM。
- `src/infrastructure/`：Local Storage、Supabase 與 Calendar 資料讀取。
- `src/data/`：教材、頁碼與固定排程資料，不放畫面控制。
- `src/ui/` 與獨立頁面入口：顯示規則與互動狀態，不重做資料判斷。
- `src/legacy-app.ts`：目前仍保留的相容層，負責舊畫面接線；不再加入新的純資料規則。

## 目前的單一資料來源

- 完成勾選、實際勾選日與延期回寫：`src/study/completionCheckedOn.ts`、`src/study/completionTree.ts`
- 已完成項目的時間歸屬與去重：`src/study/completedStudyTime.ts`
- 首頁當日時間資料組裝：`src/application/overview/overviewStudyTime.ts`
- 週／月學習總結：`src/study/learningSummary.ts`
- 互動題辨識與每日選做：`src/study/interactiveTasks.ts`；新排程、舊版／Calendar 身分、主頁與週／月完成率及待辦共用同一判斷。互動題不產生完成率單位，學習時間與完成清單仍讀取原始完成紀錄。
- 數學實際完成頁數：`src/study/mathProgress.ts`
- Local／Supabase 讀寫：`src/infrastructure/storage/`
- 主頁／待辦共用計時目標、模式切換與命令：`src/application/timer/studyTimerController.ts`
- 儲存前載入基準比對與獨立頁面安全寫入：`src/application/records/localRecordEdits.ts`
- 待辦編輯草稿：`src/ui/todoDrafts.ts`；依帳號、日期與項目保存，離開欄位後才寫入紀錄。
- 待辦清單局部更新與焦點恢復：`src/ui/keyedTodoList.ts`
- 待辦期間篩選：`src/study/overduePeriod.ts`；沿用 `learningSummary.ts` 的曆月與週一至週日邊界，只依原排程日期篩選顯示，不修改紀錄。待辦資格仍由 `overdueTasks.ts` 決定，最近處理獨立按 72 小時計算。
- 前端公開環境變數白名單：`src/config/publicEnvironment.ts`
- 字典前後端共用的純資料協定位於 `supabase/functions/_shared/dictionaryEntries.ts`，由 `src/study/dictionaryEntries.ts` 轉出給前端；不包含 secrets 或 Deno 執行期程式，後端不跨出 functions 目錄引用前端檔案。
- Google Calendar 公開 Client ID 解析：`src/config/googleCalendar.ts`
- Unit／回次與分段頁碼模板選擇：`src/data/numberedScopes.ts`；分數註記判斷共用 `src/data/studyPartAnnotation.ts`。Calendar、原卡片、待辦與教材進度不得各自套用書名例外或把分數推估為已讀頁碼。
- 單字精確比對、自動欄位所有權與手動優先：`src/study/vocabularyAutoFill.ts`；官方資料與字典中文分置 `src/data/ceecVocabulary.ts`、`src/data/ceecTranslations.ts`，來源、轉換與授權見 `VOCABULARY_SOURCES.md`。唯讀彙整不得觸發回填或改寫舊紀錄。
- 按需字典協定、確認追加與來源：`src/study/dictionaryEntries.ts`、`dictionarySelection.ts`；本機查詢重用 `localDictionaryLookup.ts`。暫存候選由 `src/ui/dictionaryPreview.ts` 管理，網路入口 `src/infrastructure/dictionary/cambridgeLookup.ts` 僅在明確操作後載入。後端 `supabase/functions/dictionary-lookup` 驗證登入再呼叫官方 API，金鑰只在伺服器，不抓公開字典頁、不保存整套詞庫、不接受任意外部網址。保存使用 `saveLocalRecordEdit` 及載入基準合併，不能用過期快照覆蓋整日紀錄。

首頁與學習總結必須共用 `completedStudyTime.ts`，不得各自建立另一套時間計算。任何 UI 合併卡都只能代表來源項目，不能成為新的持久化資料真相。

## 新程式規則

1. 新增或修改商業規則時，先建立 typed module 與直接單元測試，再由相容層呼叫。
2. 頂層函式使用明確回傳型別與具名 `function`；多條件分支使用 `if` 或 `switch`，不使用巢狀三元運算子。
3. 儲存格式、Calendar DTO、domain item 與畫面 view model 不互相混用。
4. 測試應直接匯入模組；只有尚未抽離的舊 DOM 接線才可由 regression test 驗證 `legacy-app.ts`。
5. `npm test` 會自動執行所有 `tests/*.test.ts`，新增測試不需再手動維護清單。
6. `legacy-app.ts` 不得直接讀取 `import.meta.env`；畫面只能使用 `src/config/` 輸出的已驗證設定。
7. 前端目前只允許 `VITE_GOOGLE_CLIENT_ID`。新增任何 `VITE_` 變數前必須先確認它可公開，並明確加入白名單；秘密值只放在 Supabase Edge Function secrets。
8. 計時必須以持久化來源 ID 查找，不得只搜尋可見卡片。切回手動先保存累積分鐘；再次切回計時時，手動分鐘沒有修改就保留原本精確秒數。
9. 獨立頁面不可直接用舊快照覆蓋整日資料；寫入前須讀取最新紀錄並以載入基準合併。同欄位衝突保留草稿，無法解碼的資料不得覆蓋。
10. 瀏覽器驗證涵蓋 Chromium 與 WebKit；背景更新、歷史返回及原生欄位事件的差異必須有回歸情境。

## 本次全專案盤點後的後續順序

1. 抽離 Cloud／Calendar controller，讓登入、同步與畫面訊息分開。
2. 依卡片種類拆分 renderer 與事件綁定，縮小 `legacy-app.ts` 的 DOM 責任。
3. 將仍位於 runtime 的固定自然科建議排程移至 `src/data/`。
4. 再拆分較大的 Calendar parser、教材進度與每日合併模組；每次只移動一個可驗證責任。

這些工作採漸進式進行，不以一次重寫或更換框架為目標。
