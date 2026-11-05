# Google Cloud Translation 備援設定（自用版 v171.6.147）

所有已登入 Tracker 的正式帳號皆可使用，不再需要逐一設定 UUID 白名單。訪客及 Supabase 匿名登入帳號不使用 Google 備援。API 金鑰只設於伺服器。

## 每人每月 5,000 個英文單字

- 以英文單字的次數計算，不按字母或字元長度計算：`apple` 算 1，`extraordinary` 也算 1。每次請求仍限一個單字，最多 80 個字元；組合與句子不送往此 API。
- 每個 Supabase Auth 帳號每月最多 5,000 個單字，每月 1 日台北時間 00:00 自動使用新月份額度，不需排程重置。
- 自動流程在 ECDICT 命中時不呼叫 Google、不扣額度；ECDICT 載入失敗時也不自動改向 Google。手動點「Google 翻譯」會直接查詢，即使 ECDICT 已收錄也適用。瀏覽器或伺服器快取命中不扣額度。
- 每次要送出 Google 查詢前，先在資料庫原子扣除 1；同筆扣額 RPC 的網路重試使用同一識別碼，不重複扣除。已送往 Google 的單字即使服務回覆失敗或逾時，仍計入用量，不按成功結果計算。
- 同帳號的不同裝置、頁籤、Edge Function 執行個體共用資料庫額度。清除瀏覽器資料、重新整理及切換裝置不能重置。
- 第 5,000 個單字可以送出，下一個會被拒絕並顯示已用、剩餘及下月重置日期。英文仍保存，可手動填中文或繼續使用 ECDICT。
- Google 僅補中文。詞性依既有 ECDICT／大考中心的同拼法資料帶入，不使用 Natural Language API，也不從中文猜測詞性或 Level；查不到時保留手動設定。
- 只有一種已知詞性時，Google 中文放入該詞性；有多種詞性時自動勾選已有詞性，但該筆中文暫存未分詞性，避免將同一譯文錯配為多個意思。手動修改優先。
- 詞性補充索引包含 11,331 筆 ECDICT 明示標籤，僅在 Google 確認有翻譯後按需載入（正式建置約 44 kB gzip），不增加第三方 API、金鑰或額度扣款。

## 1. Google Cloud

啟用 Cloud Translation API 與計費，建立 API key，將 API 限制為 Cloud Translation API。Google 供應商的計價與配額規則另依官方設定；網站的每月 5,000 個單字是本應用程式的帳號額度。

建議同時設定 Google Cloud 專案總配額與預算通知。每帳號每分鐘 20 次的記憶體突發限制是輔助；每月上限由資料庫執行，不依賴單一執行個體或瀏覽器。

[Google 官方設定](https://docs.cloud.google.com/translate/docs/setup) · [官方配額說明](https://docs.cloud.google.com/translate/quotas)

## 2. Supabase Secrets

在專案 `arxbirgujbrtzhoficdf` → Edge Functions → Secrets 設定：

| 名稱 | 值 |
| --- | --- |
| `GOOGLE_TRANSLATION_API_KEY` | 你的 Google Cloud Translation API key |

`GOOGLE_TRANSLATION_ALLOWED_USER_IDS` 已不再讀取。可以移除，也可以保留舊設定；它不再限制帳號，不需填入 `*` 或任何 UUID。

`SUPABASE_URL`、`SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY` 沿用 Supabase Edge Functions 內建環境變數，不需在前端新增。不要把 Google API key 或 service-role key 填入任何 `VITE_` 變數、`.env.example` 或 Git repository。

[Supabase Secrets 說明](https://supabase.com/docs/guides/functions/secrets)

## 3. Migration 與部署

將覆蓋檔案合併到原專案並推送 GitHub，使用既有部署流程。流程已先執行資料庫 migration，再部署 Edge Functions，最後部署前端。

本次新增 `supabase/migrations/20261105141732_google_translation_monthly_quota.sql`。必須成功套用這份 migration，並部署新版 `google-translation` 函式，所有登入帳號與每月額度才會生效。只更新前端無法變更伺服器限制。

額度資料在未對外暴露的 `translation_private` schema。瀏覽器角色不能讀寫或重置用量，也不能呼叫服務端扣額 RPC。Edge Function 先向 Supabase Auth 驗證使用者，再使用服務端憑證呼叫 RPC；不相信請求自行提供的帳號、月份或扣額數字。

若 migration、資料庫連線或扣額確認失敗，函式停止付費查詢並保留英文。不要把 `translation_private` 加入 Data API 的 exposed schemas。

## 4. 上線確認

登入任一正式 Tracker 帳號，輸入 ECDICT 未提供中文的英文單字並離開欄位，確認中文、已有對照的詞性及各自來源保存。Google 翻譯支援標章集中在單字複習頁上方；字卡不重複標章，匯出仍保留來源。若已達上限，會顯示「5,000 個單字」及下次重置日期。

只有單一英文單字送到 Google，不傳送整份讀書紀錄、Calendar 行程或 Calendar OAuth 憑證。額度資料表只存帳號、月份、用量與時間，不存原文或中文；另保存短期扣額識別碼防止重試重複扣額。超過 7 天的識別碼會在該帳號後續成功扣額時清理；刪除帳號時一併移除相關額度資料。

SQL 自動測試使用 PGlite 實際執行 migration、權限及扣額查詢，僅屬開發測試依賴，不打包到網站。

本次只提供本機程式與部署檔案，不會自行套用正式資料庫 migration、修改 Secrets、建立 commit 或部署，也不會自動執行真實付費 Google 翻譯。

## 5. 查詢中斷與重試

Tracker 明確輸入的單字會保存待查標記。查詢尚未完成就跳到單字頁或輸入列被畫面更新取代時，會接續該筆工作；其他未編輯歷史不批次查詢。手動填寫中文（含刻意清空）或改為組合／句子會取消工作。已存在但尚無中文的單字，可在 Tracker 點入英文欄位再離開重試；原生 change 與 focusout 不會重複提交同次輸入。

## 6. 手動 Google 翻譯（v171.6.147）

在「英文單字複習」按「編輯」，即可看到「取得翻譯」（ECDICT）旁的「Google 翻譯」。未登入按鈕停用；登入後點擊直接取得預覽，勾選結果、按「填入 Google 翻譯」才追加至原中文，不替換既有意思、Level 或其他紀錄。只開啟編輯不呼叫 Google。

查詢送出時即使用既有每月額度，是否確認填入不影響已發出的查詢計數。重複查詢命中快取不扣額；組合與句子沒有此按鈕。詞性沿用目前勾選或既有本機資料，不使用 Natural Language API。Google 與 ECDICT 的來源共同保存，PDF／DOCX 保留 Google 來源。

本版沿用 v171.6.146 的 Edge Function、Secrets 與資料庫額度，不新增 migration 或金鑰；若 v171.6.146 尚未部署，需先完成前述設定。
