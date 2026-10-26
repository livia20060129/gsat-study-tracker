# 按需字典查詢後端

前端提供「取得翻譯 → 選擇意思 → 確認填入」。本機 ECDICT 預覽不需要部署或金鑰；此函式只處理使用者主動要求的 Cambridge Dictionary 查詢。

不含金鑰或執行期相依套件的查詢協定位於 `supabase/functions/_shared/dictionaryEntries.ts`，前端的同名模組只轉出該協定；後端所有執行期相依檔案均在 functions 目錄內，避免部署時漏帶前端來源檔案。

## 正式啟用前

1. 向劍橋取得允許網站顯示、保存使用者選取釋義及匯出的 API 授權與金鑰。資料授權頁：https://dictionary.cambridge.org/license.html 。
2. 向劍橋確認可用的英繁中字典代碼。官方 `getDictionaries` 回傳 `dictionaryCode`；此專案不臆測或寫死代碼。官方協定：https://dev.eim-ciip-cambridge.org/api/specification 。
3. 在 Supabase 專案的 Edge Functions → Secrets 設定 `CAMBRIDGE_DICTIONARY_API_KEY` 與 `CAMBRIDGE_DICTIONARY_CODE`。兩者只在後端讀取；不要加 `VITE_` 前綴，不要填入 `.env.example`、前端程式、GitHub 公開變數或聊天訊息。
4. 將 dictionary-lookup 與前端一起部署。既有 `.github/workflows/deploy.yml` 已加入部署與 GET 405 存活檢查，不會將金鑰寫入 workflow。本次未實際部署或修改遠端 secrets。
5. 回到 Tracker 登入 Cloud，開啟單字複習 → 編輯 → 劍橋（線上）→ 取得翻譯。以已知單字確認正式 API 的繁中內容可用後，再啟用其他使用者。

缺少授權或金鑰時，本機字典與手動輸入仍可用。劍橋公開頁面此次正常請求及 robots.txt 都回傳 403，沒有採用爬蟲、替換來源標示或繞過限制。無正式金鑰時，只能驗證接口、合成 API 回應及錯誤處理，不能宣稱正式詞條已完成實測。

## 行為與限制

- 前端每次操作只提交一個英文單字／短語；GET/OPTIONS 不查字典。查詢無自動重試、不下載全詞庫、不持久快取候選。
- 只呼叫固定的 `https://dictionary.cambridge.org/api/v1/dictionaries/{dictCode}/search/first`，用 `accessKey` header 傳後端金鑰、`format=html` 取得詞條。使用者不能指定 URL。官方回傳的詞頭須與查詢精確相符，否則提示未找到。
- 解析成純文字詞性與中文候選，排除例句／其他片語；未知詞性放「未分詞性」，不猜作 Noun 或學測 Level。HTML 不會傳給瀏覽器執行。正式 API 格式若與測試樣本不符會安全失敗，需依授權資料格式更新解析器。
- `verify_jwt=false` 讓請求進入 handler；handler 仍必須以使用者 Bearer JWT 向 Supabase Auth 驗證。拒絕未登入、匿名及無效帳號，不使用 service-role key，不讀寫資料庫，也不將使用者 token 傳給劍橋。
- 預設允許正式個人網域、原 GitHub Pages／Workers 網域及本機 localhost/127.0.0.1。更換網域時更新 `_shared/dictionaryLookup.ts` 的允許清單；CORS 不是登入驗證的替代品。
- 每個函式執行個體、每位使用者 6 次／分鐘的暫存限流；這不是跨執行個體的全域配額，正式付費用途仍須配合供應商帳號配額。後端總等待上限 8 秒，前端 12 秒，請求 2 KB、上游回應 1 MB、最多 40 個短釋義。錯誤回應不暴露原始 HTML、金鑰或 token。
- 使用者選取確認後，釋義及來源由前端存回既有紀錄；內容保存及 PDF 匯出的權利仍受取得的授權約束。沒有新資料表、migration 或擴大 Google OAuth 範圍。

## 驗證

`npm test` 涵蓋協定、解析、確認追加、JSON 往返、來源、登入、CORS、限流、逾時及錯誤遮蔽。

`npm run typecheck:edge` 使用現有 CI 的 Deno 2.9.5 檢查全部函式；本函式沒有第三方執行期套件，故其 deno.json 關閉 lock，既有 Calendar 函式繼續沿用 frozen lock。

`e2e/dictionaryLookup.spec.ts` 用隔離本機紀錄及合成 API 回應驗證 Chromium／WebKit，不呼叫付費劍橋 API、不使用真實帳號資料。
