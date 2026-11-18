# 最新更新

版本：v171.6.187（個人版）

## 第三階段：離線與更新管理

- 在「安裝與資料」選「準備離線使用」，下載並核對約 11 MB 的必要頁面、程式、樣式、核心詞庫及 PDF 字型；一般瀏覽不會先下載整包。
- 完成後可離線開啟主要頁面、保存本機紀錄及匯出 PDF／Word。ECDICT 僅快取實際下載的最近 64 組擴充詞庫。
- 每次建置產生獨立的 release index 與穩定網址的 worker；逐檔驗證 SHA-256，下載不完整不啟用新版。
- 新版準備好才提示，不自動打斷輸入。先保存草稿、完成裝置備份，再確認帳號／輸入未變動與其他視窗已關閉，才更新並重新載入。
- 未完成的單字／教材編輯、欄位錯誤、備份失敗、帳號切換與其他分頁開啟都會阻止更新。備份交易已中止時也能顯示清楚原因。
- 手機三區切換保留獨立的更新提示。清理只處理此 App 自己的舊程式快取，不清除紀錄、登入或裝置備份。

## 第四階段：自動驗證與發布檢查

- 新增真正 Service Worker／CacheStorage 的離線、失敗恢復及更新測試，涵蓋桌面、Android／iPhone 觸控尺寸、子目錄網址及離線匯出。
- `npm run check:app` 核對發布檔大小、雜湊、入口頁與版本一致；既有 Actions 在上傳成品前執行。
- 部署與操作見 PWA_SETUP.md，實際裝置安裝、鎖屏、外部 Google 返回及發布驗收見 APP_RELEASE_CHECKLIST.md。

沒有新增套件、OAuth、Supabase migration 或 Edge Function。Google 登入、Google 翻譯、Calendar 及雲端同步仍需網路，並維持載入、手動操作與 Actions 的同步規則，不新增無限重試。

檔案與自動驗證已備妥；尚未部署或完成實機驗收。桌面／手機瀏覽器模擬不等同真正的系統安裝。

English commit suggestion:

~~~text
feat: add offline app support and safe release updates
~~~
