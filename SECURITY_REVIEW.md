# v171.6.154 檢查紀錄

範圍：目前個人版（以 v171.6.153 為基準），2026-11-08。依圖片可辨識的安全、效能與維護項目核對程式碼，並只讀查詢個人版 Supabase 的擴充套件、權限與 advisors。沒有讀取讀書紀錄或權杖值；沒有修改正式資料或部署。圖片只有 136×1280，細小文字不作無法確認的逐字推斷。

| 項目 | 檢查與處理 |
| --- | --- |
| A1 Google 長效權杖 | 確認原本為明文欄位。新 migration 用現有 Supabase Vault（已確認正式專案安裝 0.3.1）保存，原欄位清空並加上禁止再寫明文的 constraint；只讓 service_role 經私有受限函式讀寫，解除連線／刪除帳號時清理 Vault。瀏覽器仍拿不到權杖。 |
| A2 錯誤與日誌 | 原 Calendar 回應、sync_error、callback 與日誌會帶入原始 provider／SQL 訊息。改為固定安全訊息及狀態碼；舊 sync_error 也經白名單處理。OAuth 成功轉址及失敗頁均 no-store、no-referrer。 |
| A3 網站標頭 | 個人版線上 HEAD 檢查未見 CSP、XFO、nosniff、Referrer-Policy、HSTS。建置會產生 Cloudflare 靜態資產 `_headers`，預覽伺服器也使用相同標頭；所有 HTML 加入 script CSP，連不支援自訂標頭的靜態主機也可限制腳本。移除 Prompt 內嵌腳本及 onclick。frame-ancestors、XFO、HSTS 仍必須由 HTTP 主機送出，不以 meta 假裝取代。 |
| A4 瀏覽器登入儲存 | 保留既有持續登入與 IndexedDB／localStorage 設計，沒有做無效的前端自帶金鑰加密。新增 CSP、自管固定版本程式與 DOM 安全檢查以降低 XSS 風險；同來源執行中的程式仍能讀取瀏覽器儲存，這項架構限制未宣稱消除。 |
| A5 API 輸入及逾時 | Calendar JSON 實際串流限制 8 KiB、讀取 5 秒，錯誤 JSON 回 400、過大 413、逾時 408。Google token／Supabase 連線有逾時，整輪同步有 deadline；超過 25,000 個事件或分頁異常會中止，不將部分資料當成刪除依據。 |
| A6 重複同步 | 加入每使用者的資料庫租約、擁有者識別與 30 秒冷卻，跨不同函式執行個體有效；release 不會釋放其他執行者的租約。cron 已在同步中的帳號回 skipped；手動重複請求回 429。維持每批最多四個帳號。短交易的 advisory lock 只保護租約狀態，網路請求不佔著資料庫交易。 |
| A7 user_id／RPC 權限 | 現行 Calendar 身分本來就由 Auth getUser 驗證，沒有信任 body.user_id；補上匿名 session 拒絕與正確 401。正式 advisors 找到的舊 sync_calendar_tasks 確實有驗證 token hash，並非無條件匿名寫入，但現行 hourly workflow 已不用它，因此新 migration 將舊入口收斂為 service_role。舊外部腳本若仍使用此 RPC，須改用目前 Edge Function 工作流。 |
| OAuth state | 原本已簽 HMAC、有 TTL 與 nonce，但未保存／消耗 nonce。改為伺服器登記與原子消耗，一次使用、綁定 user/client、拒絕重播及格式／時限錯誤；HMAC 驗證使用 Web Crypto。 |
| Client ID | 原本已有格式與長度限制；加入選用 GOOGLE_CLIENT_ID 伺服器比對。未強迫增加設定，既有 VITE 公開 ID 與伺服器 client secret 配對仍沿用。 |
| 翻譯額度／防濫用 | 維持正式登入、伺服器每月 5,000 個英文單字、臺北月初重置與資料庫原子扣額／收據。ECDICT 不扣額。沒有新增 Natural Language API 或任意改額度。CAPTCHA、Auth rate limits 屬於部署服務設定，沒有加入未設定的第三方驗證流程。 |
| Actions／依賴 | SDK 與 Deno lock 原本已固定；所有使用中的 GitHub Actions 現在固定完整 SHA，已從官方 Git refs 核對。保留最少權限、PR 不部署、production 不任意取消 migration，以及固定 CLI 2.116.0；沒有直接跳升會改變 remote 預設值的 CLI v3。 |
| RLS／索引／已做對的項目 | 正式四個 policy 只允許本人讀寫，UPDATE 有 USING/WITH CHECK；Calendar 僅讀、token 表無客戶端 grant。新增翻譯收據 (user_id,month) 外鍵索引。沒有為了消除 INFO 而替 server-only 表加客戶端 policy，也沒有直接刪除只被標示為 unused 的索引。既有樂觀版本鎖、keyset 分頁、來源 HTML 跳脫與 Calendar 完整快照保護保留。 |

## 還需要在服務端處理的設定

- 正式 advisors 仍回報「Leaked Password Protection Disabled」。這是 Supabase Auth 設定，不在本地 migration／前端中生效；部署管理者需依[官方說明](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)在控制台開啟。沒有替你變更方案或帳戶設定。
- Cloudflare Workers 靜態資產或 Pages 要確實發布建置產生的 `_headers`。GitHub Pages 不提供這個標頭檔的功能；若仍由 GitHub Pages 供應，HTML script CSP 會生效，其餘回應標頭需在前方 Cloudflare 規則設定。未部署前，線上缺少的標頭與舊資料庫權限不會憑本地程式修改自動改變。

## 圖示與文字

依最新對照表使用 Lucide 固定來源 SVG，自管少量所需圖示、不載入整套套件或外部 CDN。日期與導覽保留文字；發音、中文切換、星號、編輯與逐筆刪除使用圖示並保留無障礙名稱；新增與匯出保留文字／格式，儲存紀錄依最新表格保留文字，連線設定只顯示圖示。星號不在 pointer down 與 click 之間重建，側滑不重掃已處理的原 main／rail 節點。授權在 public/LUCIDE_LICENSE.txt。

雲端狀態依最新指定使用 cloud-upload、cloud-exclamation-point、cloud-check；未登入時為灰色，登入後依同步狀態顯色，並保留狀態文字。手機主標題置於頂端中央、取消右上角日期，日期仍由日期紀錄分區編輯。今日狀態保留滑塊，放大圓環並移除主頁欄位的多餘外框。

## 驗證範圍

- 879 項單元測試與 3 項 OAuth Edge 測試通過，涵蓋輸入上限／逾時、安全錯誤、簽章／nonce 重播、匿名身分拒絕、SQL 角色權限與 token 清理。
- 580 項完整 Chromium／WebKit E2E 通過；手機／Cloud 最後調整另完成 48 項導覽與同步回歸、6 項最終圖示與 CSP 檢查。正常 HTTP CSP 與只有 HTML META CSP 的主機情境皆驗證阻止內嵌腳本，外部 Prompt 複製仍可用。
- 四個 Edge Functions、應用程式與修改測試的型別檢查、正式建置通過。手機與桌面截圖已檢查；實體 Android 裝置仍需部署後確認。

資料庫測試使用 PGlite 實際檢查角色權限、migration、token 生命週期、nonce 與租約；Vault 使用契約測試替身，不把替身宣稱為加密驗證。正式環境的 Vault 擴充套件版本已只讀確認，加密實作由官方 Vault 提供。沒有對正式資料執行 migration 或建立測試權杖。

## 參考

- [Supabase Vault](https://supabase.com/docs/guides/database/vault)
- [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Cloudflare 靜態資產標頭](https://developers.cloudflare.com/workers/static-assets/headers/)
- [CSP](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy)
- [GitHub Actions 安全](https://docs.github.com/en/actions/reference/security/secure-use)
- [正式 advisors：舊匿名 Definer 入口](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable)
- [Lucide 固定來源](https://github.com/lucide-icons/lucide/tree/53fab88ff9d1b48f4704b5b5b560d6b4d560bf4c)
