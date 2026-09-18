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
- 數學實際完成頁數：`src/study/mathProgress.ts`
- Local／Supabase 讀寫：`src/infrastructure/storage/`

首頁與學習總結必須共用 `completedStudyTime.ts`，不得各自建立另一套時間計算。任何 UI 合併卡都只能代表來源項目，不能成為新的持久化資料真相。

## 新程式規則

1. 新增或修改商業規則時，先建立 typed module 與直接單元測試，再由相容層呼叫。
2. 頂層函式使用明確回傳型別與具名 `function`；多條件分支使用 `if` 或 `switch`，不使用巢狀三元運算子。
3. 儲存格式、Calendar DTO、domain item 與畫面 view model 不互相混用。
4. 測試應直接匯入模組；只有尚未抽離的舊 DOM 接線才可由 regression test 驗證 `legacy-app.ts`。
5. `npm test` 會自動執行所有 `tests/*.test.ts`，新增測試不需再手動維護清單。

## 本次全專案盤點後的後續順序

1. 抽離 Cloud／Calendar controller，讓登入、同步與畫面訊息分開。
2. 依卡片種類拆分 renderer 與事件綁定，縮小 `legacy-app.ts` 的 DOM 責任。
3. 將仍位於 runtime 的固定自然科建議排程移至 `src/data/`。
4. 再拆分較大的 Calendar parser、教材進度與每日合併模組；每次只移動一個可驗證責任。

這些工作採漸進式進行，不以一次重寫或更換框架為目標。
