# 最新更新

版本：v171.6.180

日期：2026-11-15（個人版）

## Google 登入與既有帳號綁定

- 主頁連線設定新增「使用 Google 繼續」，採同分頁返回與 PKCE；登入前保存草稿，返回後恢復原本選取的日期。
- 已登入舊帳號可按「綁定 Google 帳號」。綁定核對原 Supabase UUID，保留原帳號資料空間，Calendar 連線與每月 5,000 個單字翻譯額度依原 UUID 延續。
- 綁定回傳會在 SDK 保存及廣播登入狀態前核對 UUID。帳號不符時停止，不寫入另一個帳號的資料空間。
- 保留 Email／密碼登入、建立帳號及密碼復原作為轉換入口；新 PKCE 與既有 implicit 密碼復原連結均保留支援。
- Google 基本登入僅使用 openid／email／profile。Calendar 授權維持獨立，原 Calendar OAuth 用戶端與 Edge Function Secrets 沿用。
- 提供未啟用 Google provider、未啟用 Manual Linking、身分已綁定其他帳號、取消授權及本機保存失敗的說明。
- 沒有新增套件、資料庫 migration 或 Edge Function 變更；需要在 Google Cloud／Supabase 後台啟用登入設定。

## 驗證

- 完整單元測試：920 通過、0 失敗、0 略過。
- Chromium／WebKit 共 68 項相關瀏覽器測試通過，包含 24 項新增 Google 帳號案例，以及既有登入持續性、訪客資料轉入與 Calendar 紀錄保留。
- 驗證真實 SDK 的 PKCE 產生／交換、同 UUID 綁定、錯誤 UUID 回傳攔截、取消與錯誤回復、草稿保存失敗、缺少驗證資料、兩種密碼復原連結，以及 320px 手機觸控操作。
- 正式建置、應用程式及完整端對端測試程式型別檢查通過。未重跑完整瀏覽器測試套件。
- 瀏覽器測試攔截 Google／Supabase 回應；正式 Google 授權仍需完成後台設定後人工驗收。本次沒有修改線上設定或部署。

## 套用與啟用

此為相對個人版 v171.6.171 的累積覆蓋檔，可套用於 v171.6.172～v171.6.179，包含既有選單動畫、單字與星期導覽修正。

將未壓縮「必要覆蓋檔案」依原路徑合併至專案根目錄，按照 [Google 登入設定與舊帳號轉換](GOOGLE_SIGN_IN_SETUP.md) 完成登入專用 OAuth 用戶端、Supabase Google provider、Manual Linking 與返回網址設定，再沿用現有方式部署。

舊使用者先登入原 Email 帳號，再綁定 Google；確認轉換後仍能取得原有紀錄。轉換期間保留原登入方式。

English commit suggestion:

```text
feat: add Google sign-in and link existing accounts
```
