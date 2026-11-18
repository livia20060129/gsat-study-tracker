# 最新更新

版本：v171.6.188（個人版）

## 離線準備與 CDN 相容修正

正式網站實際核對 63 個檔案，52 個程式／靜態檔符合原核對碼；11 個 HTML 各被 Cloudflare JavaScript Detections 附加 1,114 bytes 的腳本，造成原版離線下載拒絕安裝。這個失敗被合併成「下載不完整或容量不足」，無法辨認真正原因。

- 離線 HTML 改由建置產生、以內容識別碼命名的 JSON 副本下載，避免 CDN 對 HTML 的動態附加內容；解碼後仍核對原始 HTML 的完整 SHA-256。
- 保留 CSP、X-Frame-Options 等原安全標頭，以及 Cloudflare 防護設定；原紀錄、登入、Calendar 與同步規則保持相容。
- 新版／不完整副本仍無法通過核對。錯誤會明確顯示檔名，以及 HTTP、下載中斷、格式、版本核對、容量或權限原因。
- 安裝 worker 結束前保存小型公開診斷，並通知目前頁面；成功後清除。診斷不包含讀書紀錄、憑證或回應原文。
- 新增正式站核對指令 `npm run check:app:live -- https://myself.liviayeh.dev/`，補上只測本機無法發現的 CDN 差異。

覆蓋後建置並部署整份 dist，包含新產生的 offline-pages 資料夾。部署後再次選「功能選單 → 安裝與資料 → 準備離線使用」。操作與發布驗收見 PWA_SETUP.md、APP_RELEASE_CHECKLIST.md。

無新增套件、OAuth、SQL migration 或 Edge Function。此交付尚未推送或部署。

Cloudflare 行為參考：https://developers.cloudflare.com/cloudflare-challenges/challenge-types/javascript-detections/

English commit suggestion:

~~~text
fix: prepare offline pages without CDN HTML mutations
~~~
