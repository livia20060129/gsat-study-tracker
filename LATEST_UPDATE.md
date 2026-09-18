# 最新更新

版本：v171.6.1

## 修正 Cloud 登入卡在同步中

- 已從線上版瀏覽器錯誤紀錄確認主因：登入切換帳號資料時呼叫了未匯入的 `deferredCompletionDate`，畫面載入中斷，導致同步結束狀態永遠沒有執行。現已補回正確匯入。
- 已確認個人版 Supabase Auth 服務正常，前端使用的專案網址與 publishable key 也屬於同一個專案。
- Cloud 登入驗證最長等待 15 秒；若網路或 Auth 沒有回應，會結束等待並顯示原因，不再無限停留。
- 雲端紀錄首次讀取最長等待 20 秒；逾時會中止該次查詢，本機快取仍完整保留。
- Cloud 與 Google Calendar 的啟動流程已分開。Calendar 狀態讀取失敗或超過 15 秒，只影響 Calendar，不再阻塞 Cloud 登入。
- 登入期間顯示「登入中」，並暫停重複送出登入／註冊／重設請求。
- 帳號本機快取即使遇到其他程式錯誤，也會解除「同步中」並直接顯示錯誤，不再永久卡住。
- 新增獨立的外部操作逾時模組、延期期目重載測試及瀏覽器未捕捉錯誤檢查。

更新資料夾：`gsat-study-tracker-v171.6.1-cloud-login-timeout`

## 驗證

- Supabase Auth 健康檢查回傳 HTTP 200。
- 367 項單元／回歸測試通過。
- TypeScript 型別檢查與 Vite 正式建置通過。
- 8 項 Playwright 瀏覽器流程測試通過。

本次不更動資料格式，不需要新增 Supabase migration，也不需要重新部署 Supabase Edge Function；網站重新建置部署即可。

## Commit 建議

`fix(cloud): prevent login bootstrap from hanging indefinitely`
