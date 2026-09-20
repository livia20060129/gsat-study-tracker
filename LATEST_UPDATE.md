# 最新更新

版本：v171.6.26

## 防止前端環境變數洩漏秘密值

- `VITE_GOOGLE_CLIENT_ID` 是瀏覽器需要使用的公開 OAuth 識別碼，仍由 `src/config/googleCalendar.ts` 集中驗證。
- 建置程序現在採公開環境變數白名單；只有 `VITE_GOOGLE_CLIENT_ID` 可以使用 `VITE_` 前綴。任何其他有值的 `VITE_` 變數都會使正式建置直接失敗，並列出被拒絕的變數名稱。
- Client Secret、access／refresh token、密碼、private key、Supabase service-role key 與資料庫連線資訊只能放在 Supabase Edge Function secrets，不會進入前端建置。
- `.env.example` 固定保留無效的範例 Client ID。自動測試會驗證它沒有被換成真實值；本機設定必須複製到受 `.gitignore` 排除的 `.env.local` 後再填寫。
- GitHub Actions 僅從 repository **Variable** 讀取 `VITE_GOOGLE_CLIENT_ID`，不再以同名 secret 作為備援，避免公開識別碼與秘密設定混淆。
- `legacy-app.ts` 不得直接讀取 `import.meta.env`；Calendar 畫面只能使用獨立設定模組輸出的驗證結果，並有架構測試持續約束。

## 驗證

- 以 `VITE_GOOGLE_CLIENT_SECRET` 注入測試值執行建置，確認建置會中止並指出瀏覽器暴露風險。
- 正常無秘密值環境可完成 TypeScript 型別檢查與 Vite 正式建置。
- 405 項單元／回歸測試及 14 項 Chromium E2E 全部通過。

更新資料夾：

- `gsat-study-tracker-v171.6.26-public-env-security-required-files`
- `gsat-study-tracker-v171.6.26-public-env-security-full-project`

## Commit 建議

`security(config): block browser-exposed secrets`
