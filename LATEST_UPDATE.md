# 最新更新

版本：v171.6.191（個人版）

## 精簡安裝設定

- 移除「裝置備份與容量」整區：備份並整理、下載／匯入備份、保留裝置資料、容量摘要及缺少日期還原。
- 功能選單入口改為「安裝與更新」，只保留 App 安裝、離線準備與更新；原生 App 保留帳號刪除申請入口。
- 安裝不再要求登入、同步完成或備份核對。開啟設定不掃描歷史紀錄、不檢查容量、不改寫紀錄或觸發同步。
- 移除舊安裝備份門檻及專用監聽程式；既有讀書紀錄、裝置副本，以及保存、登入與更新流程的自動資料保護保留。
- 保留對話框開關動畫、iPhone 加入主畫面說明、提早收到的安裝提示、安裝取消及失敗重試。

## 套用

依交付資料的覆蓋說明合併檔案並刪除列出的三個舊安裝輔助檔。執行 npm ci、npm test、npm run build、npm run check:app，再沿用原方式發布整份 dist。沒有新套件、SQL、Edge Function 或 Google／Supabase 設定。

原生 App 需另執行 npm run native:sync、npm run native:check，再依 NATIVE_APP_SETUP.md 打包。這次未部署、未執行線上建置、未產生 APK／IPA。

English commit suggestion:

~~~text
refactor: simplify app settings and remove backup capacity controls
~~~
