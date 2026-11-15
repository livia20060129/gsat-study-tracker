# 最新更新

版本：v171.6.181

日期：2026-11-15（個人版）

## 只保留 Google 登入

- 在既有主要帳號完成 Google 登入、原紀錄與 Calendar 連線驗收後，移除網站的 Email／密碼登入、建立帳號、忘記密碼、重寄驗證信與密碼更新表單及操作程式。
- 登入區只保留 Google 按鈕，未登入仍可使用訪客本機紀錄。
- 舊 Email implicit／PKCE 登入與密碼復原回呼不會交換憑證或切換資料空間，會清除返回網址中的憑證並提示改用 Google。
- 保留 Google 登入、同 UUID 綁定保護、既有登入狀態、登出、跨頁恢復與訪客資料轉入。
- 原帳號、Email 身分、UUID、讀書紀錄、Calendar 連線及翻譯額度持續保留，沒有刪除或搬移使用者與紀錄。
- Supabase Email provider 需要另行關閉；前端覆蓋檔不會自動改變後台開關。本次交付時後台開關仍開啟，等待最後操作確認。

## 驗證

- 完整單元測試：922 通過，0 失敗、0 略過。
- Chromium／WebKit 相關瀏覽器測試：76 通過，包含 Google 登入與綁定、跨頁登入持續性、舊連結攔截、訪客資料轉入、Calendar 紀錄保留，以及手機連線設定定位與收合動畫。
- 正式建置、應用程式及完整端對端測試程式型別檢查通過；已檢視 320px 手機 Google 登入畫面。
- 後台確認原 3 個帳號、165 天雲端紀錄仍存在；停用帳號原有的 4 天紀錄保留。沒有執行任何帳號、身分或紀錄刪除。
- 瀏覽器測試使用真實 SDK 與 PKCE，攔截外部授權回應；新版前端尚未部署，未重跑完整瀏覽器套件。

## 套用

將未壓縮「必要覆蓋檔案」依原路徑合併至個人版專案根目錄，沿用現有部署方式。此為相對 v171.6.171 的累積覆蓋檔，可套用於 v171.6.172～v171.6.180。

沒有新增套件、SQL migration 或 Edge Function；後台 Email 登入停用方式詳見 [Google 登入設定](GOOGLE_SIGN_IN_SETUP.md)。

English commit suggestion:

~~~text
feat: retire email password login and keep Google sign-in
~~~
