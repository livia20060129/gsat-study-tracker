# Google Cloud Translation 備援設定（自用版）

本功能已完成程式串接；需啟用 Google Cloud Translation API、設定伺服器憑證及部署函式後才能使用真實翻譯。這份文件不包含金鑰。

## 使用方式

輸入完整英文單字並離開欄位後，先查 ECDICT。確認沒有中文結果，而且目前是已登入且獲准的帳號時，才透過 Supabase 的 `google-translation` 函式使用 Cloud Translation Basic v2，將單一英文單字翻成繁體中文 `zh-TW`。

- Tracker 與單字複習頁改英文共用這個流程。
- ECDICT 命中時不呼叫 Google；ECDICT 分片下載失敗時也不改向 Google 收費查詢。
- 訪客、組合與句子繼續使用原本流程，不發出備援請求。
- Google 僅提供中文，自動存為「未分詞性」。不推測詞性或 Level，不覆蓋手動中文與手動詞性。
- 沿用現有帳號、本機保存、Cloud、匯出／匯入與 JSON 欄位。Google 來源會保留，頁面使用官方標章，有翻譯的 PDF／DOCX 附出處。

## 1. Google Cloud

1. 選擇自己的 Google Cloud 專案，啟用計費與 Cloud Translation API。
2. 建立供伺服器使用的 API key，將 API 限制為 **Cloud Translation API**。不要使用 Google OAuth Client ID 代替 API key。
3. 在 Google Cloud 設定適合自己的 API 配額與預算通知。本機快取及單一函式執行個體的每帳號每分鐘 20 次限制，只是減少重複與突發請求，不是跨所有執行個體的帳務上限。

[Google 官方設定說明](https://docs.cloud.google.com/translate/docs/setup) · [Basic v2 請求格式](https://docs.cloud.google.com/translate/docs/reference/rest/v2/translate)

## 2. Supabase 伺服器 Secrets

在專案 `arxbirgujbrtzhoficdf` 的 Edge Functions → Secrets 加入：

| 名稱 | 值 |
| --- | --- |
| `GOOGLE_TRANSLATION_API_KEY` | 上一步建立的 Google API key |
| `GOOGLE_TRANSLATION_ALLOWED_USER_IDS` | 允許使用翻譯的 Supabase Auth 使用者 UUID；多個帳號用半形逗號分開 |

UUID 可由 Supabase Authentication → Users 取得。此設定使用經 Supabase Auth 驗證後的使用者 ID，不相信請求中自行提供的帳號資料。未設定白名單或金鑰時會拒絕翻譯。

`SUPABASE_URL`、`SUPABASE_ANON_KEY` 使用 Edge Functions 既有環境變數；不需把 Google 金鑰填進前端或任何 `VITE_` 變數。不要將真實金鑰放入 `.env.example`、GitHub 原始碼或本文件。

[Supabase 官方 Secrets 說明](https://supabase.com/docs/guides/functions/secrets)

## 3. 覆蓋與部署

將必要覆蓋檔案合併到原專案，推送自己的 GitHub repository，使用既有部署流程。工作流程已加入 `google-translation` 的部署與入口檢查；仍沿用已固定的 Supabase CLI v2.116.0。Google 金鑰在 Supabase Secrets 設定，無須在前端建置提供。

函式使用獨立的伺服器憑證，不會增加 Google Calendar 的 OAuth 同意範圍，也不需資料庫 migration。

本次程式驗證以受控測試代替真實付費翻譯，沒有自動啟用計費、建立金鑰、設定線上 Secrets 或部署線上網站。

## 4. 上線確認

登入白名單帳號，輸入一個確實不在 ECDICT 的英文單字並離開欄位。若成功，中文保存於未分詞性，來源為 Google Translate；在單字複習頁可修改並重新整理確認。若顯示「尚未設定」，檢查 Secrets 與函式部署；若顯示暫時無法使用，檢查登入是否有效、白名單、Google API 啟用與配額。英文與原紀錄仍保留。

只有該英文單字送到 Google，不傳送整份讀書紀錄、備註、Calendar 行程或 Calendar OAuth 憑證。Google 查詢結果在瀏覽器及函式記憶體保留有限筆數；已填入的中文及來源沿用使用者紀錄保存，手動刪除紀錄時一併移除。

[Google 來源標示規範](https://docs.cloud.google.com/translate/attribution)
