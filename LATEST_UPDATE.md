# 最新更新

版本：v171.6.189（個人版）

## 同步帳號直接安裝

- 已登入、目前帳號的實際紀錄均已由雲端確認，且沒有未保存的輸入時，開啟「安裝與資料」會自動備份並讀回核對，完成後可直接按「安裝 App」。
- 不再要求這些帳號手動點「備份並整理」。該工具保留給訪客、待同步資料與需要整理容量的情況。
- 自動準備只讀取既有登入與同步確認，不另啟登入、更新驗證或雲端上傳，不壓縮或改寫主紀錄。
- 帳號、紀錄、草稿或同步狀態變更後重新核對；備份失敗、登入過期或資料未保存時不誤稱完成。不循環輪詢。
- 保留原生安裝需要使用者點擊的規則，以及 Safari 分享／加入主畫面的操作方式。

## 生物教材頁碼地圖

新增《精通 高中生物總複習（上）整理篇》，末頁 p.279。依目錄照片的印刷起頁建立 19 段，含四大主題與兩段主題起頁；p.1–3 沒有章節資料，不猜測歸屬。已接入教材庫、生物講義版本、Tracker 章節提示、四主題進度及目前排程 Prompt，與其他版本分開計算。

完整對照見 BIOLOGY_MASTERY_PAGE_MAP.md。本次未修改 Calendar 行程。

## 套用

沿用既有建置與部署方式。請發布整份 dist，包含離線 worker、release index 與 offline-pages；保留 v171.6.188 的 CDN 相容修正。安裝流程見 PWA_SETUP.md，部署後實機驗收見 APP_RELEASE_CHECKLIST.md。

無新增套件、OAuth、SQL migration 或 Edge Function。此交付尚未推送或部署。

English commit suggestion:

~~~text
feat: automate synced-account install backups and add biology page map
~~~
