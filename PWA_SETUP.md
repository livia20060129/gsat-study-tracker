# App 安裝、離線與更新（v171.6.188）

本版延續第一、二階段的安裝與裝置資料保護，加入第三階段離線頁面、安全更新，以及第四階段的自動驗證與發布檢查。入口在功能選單最下方「安裝與資料」。實際桌面、Android、iPhone 安裝與鎖屏測試，須在部署後依 APP_RELEASE_CHECKLIST.md 驗收。

## 部署

1. 依覆蓋說明合併檔案，執行 `npm ci`、`npm run build`，沿用既有部署方式。
2. 使用原本的 HTTPS 網址。每個頁面均指向同一份 `manifest.webmanifest`；必須部署 `public/icons` 產生的圖示與整份建置結果。
3. 既有 Google 登入回傳網址維持 `index.html?google_auth=1`。沒有新增 OAuth 用戶端、Supabase 專案、SQL migration、Edge Function 或登入提供者設定。
4. 執行 `npm run check:app` 核對正式檔案；整份 `dist` 一次發布，包含新產生的 `app-worker.js`、`app-release.json` 及 `offline-pages` 資料夾。不要只上傳個別 HTML，或覆蓋不同建置版本的資產。
5. 部署後先保存舊分頁的輸入，再重新整理以載入新版。新版自動提示與更新只在啟用離線功能後生效。

## 安裝

先在功能選單開啟「安裝與資料」，選「備份並整理」。完成核對後，支援安裝提示的瀏覽器會提供「安裝 App」。按鈕需要使用者親自點選；網站不會自動在裝置建立圖示。

- Windows／電腦 Chrome、Edge：可使用頁面按鈕或瀏覽器安裝選單。安裝後可建立桌面捷徑或釘選工作列。
- Android Chrome：使用頁面安裝按鈕或瀏覽器選單，依裝置提示加入主畫面。
- iPhone／iPad：使用 Safari 的分享選單 → 加入主畫面；有「以網頁 App 開啟」時請開啟。iOS 不模擬 Chrome 的安裝對話框。
- Mac Safari：使用檔案 → 加入 Dock；支援情況取決於系統／瀏覽器版本。

已從 App 視窗開啟時，安裝按鈕會隱藏，備份工具仍保留。若安裝事件早於共用選單載入，會先保留事件，待選單準備完成後使用。

## 帳號與資料

- Google 登入沿用原帳號與原雲端紀錄，Calendar 授權維持獨立。
- 登入驗證原已使用 IndexedDB 持久保存；本版增加讀書紀錄的獨立裝置備份庫。紀錄備份不包含 OAuth token、登入驗證資料或其他帳號的紀錄。
- 安裝視窗只讀取目前資料空間的備份。帳號變更後，舊視窗的資料操作會停止，需關閉後重新開啟。
- 不同瀏覽器／安裝容器可能不共用網站資料。登入同一 Google 帳號可讀取原雲端資料；訪客請在原瀏覽器下載備份，在新 App 的訪客模式匯入，再視需要登入，沿用既有訪客轉存流程。

## 備份與容量整理

主紀錄維持原有 localStorage 格式及同步合併流程，新增 IndexedDB 的第二份資料，保留舊分頁的讀寫相容性；本版沒有全面替換主儲存引擎。

- 每次原有紀錄成功寫入後，背景保存該日期的裝置副本，不重新掃描整段歷史，也不觸發雲端上傳。副本失敗不會把已成功的本機保存改稱雲端失敗；可在安裝視窗手動核對。
- 「備份並整理」先將已儲存原文寫入裝置備份並讀回核對，再無損壓縮這次已備份、且沒有再次變動的日期。整理後再嘗試保存目前草稿並完成第二次備份；欄位錯誤仍需修正。
- 「保留裝置資料」呼叫瀏覽器提供的持續儲存申請，是否授予由瀏覽器決定。它不會解除 localStorage 容量上限，也不代替外部備份。
- IndexedDB 不可用時，原紀錄保留；仍可直接下載已儲存的紀錄備份。未保存的輸入不會被誤稱已備份。
- 瀏覽器清除整個網站資料或裝置損壞仍可能同時移除兩份本機資料，建議保留下載檔與雲端紀錄。

## 還原與資料搬移

1. 使用「下載備份」取得 JSON，包含逐筆原文、SHA-256 核對碼，以及可供首頁「匯入進度」預覽的 `records`。
2. 在相同帳號／訪客資料空間中選「匯入備份」。核對內容後，展開缺少日期清單，再按「確認還原缺少紀錄」。
3. 還原前會先保存來源備份，只補原本不存在的日期，保留現有內容。不能解碼的原文仍保留在備份，不當成空白紀錄寫入。
4. 若需處理已有日期，將下載檔內容貼到首頁「匯入進度」，使用原有預覽、合併及確認流程。
5. 寫入失敗會告知成功與未完成的天數，可整理空間後重試；來源備份仍保留。

從檔案匯入時，未完成日期也會保留在裝置備份的還原預覽中；主要儲存區恢復後可直接重試，不需要重新挑選檔案。帳號切換會清除視窗中上一個資料空間的摘要及日期。

Google 登入跳轉前，先保存目前輸入並等待裝置備份完成。備份失敗、帳號改變或其他分頁啟動較新的登入時，不繼續舊跳轉，也不清除新分頁的登入資料。

## 第三階段：離線使用

1. 先連線，於「安裝與資料」選「準備離線使用」。首次下載約 11 MB，包含所有正式入口、程式、樣式、核心詞庫與 PDF 所需字型。
2. 等待「離線頁面已核對」。頁面檔案由相同建置產生；離線 HTML 透過 `offline-pages` 下有內容識別碼的 JSON 副本下載，解碼後逐檔核對原始 HTML 的 SHA-256，完整下載才讓離線版本生效。一般瀏覽不會自動下載整包。
3. 之後可離線開啟／重新載入首頁、待辦、總結、教材、單字及排程說明；本機紀錄仍沿用原保存、驗證、帳號隔離與衝突規則，可離線匯出 PDF／Word。
4. ECDICT 擴充詞庫採實際查詢時下載，保留最近 64 組。未下載或被淘汰的部分需連線取得，未保存的 Google 翻譯不能離線產生。辭典外部連結與裝置未安裝的語音仍可能需要網路。
5. Google 登入、Calendar、雲端同步及 Google 翻譯需要連線。網路恢復不新增背景輪詢或無限重試；同步仍依載入、手動操作與既有 Actions 觸發。

快取只有明確列出的公開靜態檔與詞庫，沒有帳號紀錄、Token、API 回應或帶 OAuth code 的 URL。Google 返回時沿用同一版靜態 HTML，授權查詢參數只留在瀏覽器網址供原登入程式處理。普通歷史參考 HTML 不屬於離線 App 入口。

離線檔不足時，只有核對同版內容成功才補回；可連線後再選「準備離線使用」。容量不足或下載失敗保留原紀錄和原本完整的 App 版本。網站儲存仍受瀏覽器容量與清除規則限制。

## 第三階段：安全更新

啟用離線功能後，開啟 App 會依瀏覽器的 Service Worker 更新流程檢查版本；也可在「安裝與資料」按「檢查更新」。不設背景定時輪詢。

新版完整下載後顯示「查看更新」，不搶走焦點或自動重新整理。選「儲存並更新」時：

1. 保存目前輸入，沿用各頁驗證與衝突保護；教材與單字編輯要先完成或取消。
2. 將目前帳號已保存紀錄寫入裝置備份並讀回核對。
3. 再次確認帳號、輸入與紀錄沒有變動。
4. 確認此網站／App 只剩一個視窗；其他分頁仍開啟時請先保存並關閉，再重試。
5. 明確同意後才啟用新版並重新載入，保留原網址、日期、本機紀錄與計時資料。

下載中斷、內容不符、保存或備份失敗時不更新，繼續使用原完整版本。只整理此 App 自己的舊版本快取，保留上一版檔案及已下載詞庫；不清除 localStorage、IndexedDB、登入資料或其他網站快取。

## 離線準備錯誤與 CDN

v171.6.187 直接下載 HTML 核對；正式網站的 Cloudflare JavaScript Detections 會附加每次請求不同的驗證腳本，因而觸發版本核對失敗。v171.6.188 改用建置時的 JSON 頁面副本，保留原始 HTML、CSP／X-Frame-Options 安全標頭及完整雜湊核對；不移除下載內容中的驗證腳本來勉強通過，也不更改 Cloudflare 防護設定。

錯誤會顯示對應檔案與原因：下載中斷、HTTP 狀態、離線副本格式、版本核對失敗、快取容量不足或儲存權限。小型診斷只保存檔名、錯誤種類、HTTP 狀態及版本，不含紀錄、Token 或回應原文；成功準備後清除。即使安裝 worker 已停止，視窗仍可讀到確切原因。

整份新版部署後，執行 `npm run check:app:live -- https://myself.liviayeh.dev/`；它會以公開請求核對線上的頁面副本及程式檔，不讀取帳號資料。出現缺檔時先確認 `offline-pages` 已部署；核對不符時確認檔案來自同一次建置。完成後回到「安裝與資料」再選「準備離線使用」，原紀錄及登入資料保留。

## 第四階段：驗證與發布

發布前執行 `npm test`、`npm run test:e2e`、`npm run check:app`。`npm run test:pwa` 可單獨驗證安裝、資料保護、離線與安全更新；完整測試仍涵蓋原有登入、Calendar、計時、發音、匯出、導覽及版面。

GitHub Actions 會在正式建置後核對 release index 的逐檔大小與 SHA-256，再上傳發布成品。Windows／Android／iPhone 的實機項目、失敗時處理及回復方式見 [APP_RELEASE_CHECKLIST.md](APP_RELEASE_CHECKLIST.md)。

瀏覽器測試可驗證畫面、模擬安裝事件、資料庫寫入／還原及 OAuth 回跳。實際安裝到桌面／手機、系統圖示、外部 Google 授權回到 App 的行為，需在部署後以目標裝置驗收，不以模擬事件代替實機確認。

## 參考

- [Component Gallery：Button](https://component.gallery/components/button/)、[Modal](https://component.gallery/components/modal/)
- [Chrome：使用網頁應用程式](https://support.google.com/chrome/answer/9658361?hl=zh-Hant)
- [MDN：PWA 安裝要求](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable)
- [MDN：儲存容量與清除規則](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)
- [Component Gallery：Alert](https://component.gallery/components/alert/)
- [Service Worker 生命週期](https://web.dev/articles/service-worker-lifecycle)
- [Cloudflare：JavaScript Detections 的 HTML 注入行為](https://developers.cloudflare.com/cloudflare-challenges/challenge-types/javascript-detections/)
