# 最新更新

版本：v171.6.192（個人版）

## 離線與更新成功回饋

- 「準備離線使用」與「檢查更新」成功後，按鍵前顯示勾號、底色轉綠色，五秒後恢復原樣。
- 再次操作先清除舊回饋，成功後重新計算五秒，兩個按鍵各自處理。按鍵不因勾號出現而變寬或位移。
- 已是最新版時顯示「檢查完成，目前已是最新版本」；有新版時維持既有「新版已下載」及「儲存並更新」操作。
- 有新版本時等離線檔下載與核對完成，才顯示成功；失敗不顯示綠色，重試時清除先前錯誤提示。
- 保留安裝與更新介面、資料保護及導覽動畫；未恢復裝置備份與容量工具。

## 套用

以 v171.6.191 為基礎，合併交付資料中的必要覆蓋檔案，沒有要刪除的檔案。執行 npm ci、npm test、npm run build、npm run check:app，沿用原方式發布整份 dist。

沒有新套件、SQL、Edge Function 或 Google／Supabase 設定。原生 App 需另執行 npm run native:sync、npm run native:check 並重新打包；原生 App 的離線程式由安裝檔或商店更新，維持原有說明。

本次未部署、未執行線上建置、未產生 APK／IPA。

English commit suggestion:

~~~text
feat: show five-second success feedback for offline and update actions
~~~
