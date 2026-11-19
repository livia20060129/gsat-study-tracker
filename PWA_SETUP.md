# App 安裝、離線與更新（v171.6.192）

功能選單的「安裝與更新」只提供安裝、離線準備與版本更新。v171.6.191 取消「裝置備份與容量」區塊及所有手動工具；安裝不再要求登入、同步完成或手動備份。既有紀錄與裝置副本保留，登入及更新所需的紀錄保護由程式自動處理。實機步驟見 APP_RELEASE_CHECKLIST.md。

## 部署

1. 依覆蓋說明合併檔案，執行 `npm ci`、`npm run build`，沿用既有部署方式。
2. 使用原本的 HTTPS 網址。每個頁面均指向同一份 `manifest.webmanifest`；必須部署 `public/icons` 產生的圖示與整份建置結果。
3. 既有 Google 登入回傳網址維持 `index.html?google_auth=1`。沒有新增 OAuth 用戶端、Supabase 專案、SQL migration、Edge Function 或登入提供者設定。
4. 執行 `npm run check:app` 核對正式檔案；整份 `dist` 一次發布，包含新產生的 `app-worker.js`、`app-release.json` 及 `offline-pages` 資料夾。不要只上傳個別 HTML，或覆蓋不同建置版本的資產。
5. 部署後先保存舊分頁的輸入，再重新整理以載入新版。新版自動提示與更新只在啟用離線功能後生效。

## 安裝

在功能選單開啟「安裝與更新」，依瀏覽器提供的方式安裝；不需要先完成備份、同步或容量整理。安裝與「準備離線使用」是分開的操作，首次安裝不保證已下載離線檔案。

- Chrome／Edge：瀏覽器提供安裝事件時可按「安裝 App」；也可使用瀏覽器選單的安裝功能，電腦可建立桌面捷徑。
- iPhone／iPad Safari：分享 → 加入主畫面；若出現「以網頁 App 開啟」請開啟。
- Mac Safari：檔案 → 加入 Dock，依系統與瀏覽器支援情況使用。
- 已從 App 視窗開啟時隱藏安裝按鈕。提早收到的安裝事件會保留到選單載入完成，不重複建立對話框。

## 帳號與資料保護

- 安裝本身不改寫、壓縮、移轉或刪除讀書紀錄，也不會觸發雲端上傳。開啟設定不掃描歷史資料、不查詢儲存容量、不申請儲存權限。
- 不同瀏覽器／App 容器可能不共用本機資料。跨容器使用請登入同一 Google 帳號，先在原容器儲存並確認同步成功，再到新 App 登入。Calendar 授權維持獨立。
- 原有紀錄成功保存後的逐日背景副本、Google 登入前保存與核對，以及更新前保護仍由程式執行，不另設手動步驟。舊 IndexedDB 副本不刪除；備份不含登入憑證。
- 首頁「匯出與匯入」仍可整理本週紀錄、預覽及確認 JSON 匯入；它不等同全歷史的外部備份工具。原有 JSON 檔可沿用首頁的預覽匯入流程。
- 瀏覽器清除網站資料或卸載 App 仍可能移除本機資料；程式不會假設已開啟安裝設定就代表紀錄已保存或已同步。

## 第三階段：離線使用

1. 先連線，於「安裝與更新」選「準備離線使用」。首次下載約 11 MB，包含所有正式入口、程式、樣式、核心詞庫與 PDF 所需字型。
2. 等待「離線頁面已核對」。頁面檔案由相同建置產生；離線 HTML 透過 `offline-pages` 下有內容識別碼的 JSON 副本下載，解碼後逐檔核對原始 HTML 的 SHA-256，完整下載才讓離線版本生效。一般瀏覽不會自動下載整包。
3. 之後可離線開啟／重新載入首頁、待辦、總結、教材、單字及排程說明；本機紀錄仍沿用原保存、驗證、帳號隔離與衝突規則，可離線匯出 PDF／Word。
4. ECDICT 擴充詞庫採實際查詢時下載，保留最近 64 組。未下載或被淘汰的部分需連線取得，未保存的 Google 翻譯不能離線產生。辭典外部連結與裝置未安裝的語音仍可能需要網路。
5. Google 登入、Calendar、雲端同步及 Google 翻譯需要連線。網路恢復不新增背景輪詢或無限重試；同步仍依載入、手動操作與既有 Actions 觸發。

快取只有明確列出的公開靜態檔與詞庫，沒有帳號紀錄、Token、API 回應或帶 OAuth code 的 URL。Google 返回時沿用同一版靜態 HTML，授權查詢參數只留在瀏覽器網址供原登入程式處理。普通歷史參考 HTML 不屬於離線 App 入口。

離線檔不足時，只有核對同版內容成功才補回；可連線後再選「準備離線使用」。容量不足或下載失敗保留原紀錄和原本完整的 App 版本。網站儲存仍受瀏覽器容量與清除規則限制。

「準備離線使用」及「檢查更新」完成後，按鍵前會顯示勾號並轉為綠色，五秒後恢復原樣。重試成功重新計時；新版本下載中不先宣告完成，下載或核對失敗會清除成功樣式並顯示原因。按鍵大小與位置維持，輔助閱讀也能取得完成提示。

## 第三階段：安全更新

啟用離線功能後，開啟 App 會依瀏覽器的 Service Worker 更新流程檢查版本；也可在「安裝與更新」按「檢查更新」。不設背景定時輪詢。

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

整份新版部署後，執行 `npm run check:app:live -- https://myself.liviayeh.dev/`；它會以公開請求核對線上的頁面副本及程式檔，不讀取帳號資料。出現缺檔時先確認 `offline-pages` 已部署；核對不符時確認檔案來自同一次建置。完成後回到「安裝與更新」再選「準備離線使用」，原紀錄及登入資料保留。

## 第四階段：驗證與發布

發布前執行 `npm test`、`npm run test:e2e`、`npm run check:app`。`npm run test:pwa` 可單獨驗證安裝、資料保護、離線與安全更新；完整測試仍涵蓋原有登入、Calendar、計時、發音、匯出、導覽及版面。

GitHub Actions 會在正式建置後核對 release index 的逐檔大小與 SHA-256，再上傳發布成品。Windows／Android／iPhone 的實機項目、失敗時處理及回復方式見 [APP_RELEASE_CHECKLIST.md](APP_RELEASE_CHECKLIST.md)。

瀏覽器測試可驗證畫面、模擬安裝事件、資料保留與更新前副本核對及 OAuth 回跳。實際安裝到桌面／手機、系統圖示、外部 Google 授權回到 App 的行為，需在部署後以目標裝置驗收，不以模擬事件代替實機確認。

## 第五階段：Android 與 iPhone／iPad 原生測試工程

v171.6.190 增加兩平台的 Capacitor 工程，內建介面與詞庫，使用系統瀏覽器登入及檔案分享。原有網頁版／PWA 仍由 dist 發布；原生 App 另建 dist-native，由安裝檔或商店更新。

操作與實際剩餘設定見 [NATIVE_APP_SETUP.md](NATIVE_APP_SETUP.md)，正式發布尚需完成的登入、帳號刪除與簽署項目見 [native/STORE_RELEASE.md](native/STORE_RELEASE.md)。本次不代表已產生 APK／IPA、已上架或已通過審查。

## 參考

- [Component Gallery：Button](https://component.gallery/components/button/)、[Modal](https://component.gallery/components/modal/)
- [Chrome：使用網頁應用程式](https://support.google.com/chrome/answer/9658361?hl=zh-Hant)
- [MDN：PWA 安裝要求](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable)
- [MDN：儲存容量與清除規則](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)
- [Component Gallery：Alert](https://component.gallery/components/alert/)
- [Service Worker 生命週期](https://web.dev/articles/service-worker-lifecycle)
- [Cloudflare：JavaScript Detections 的 HTML 注入行為](https://developers.cloudflare.com/cloudflare-challenges/challenge-types/javascript-detections/)
