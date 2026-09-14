# 最新更新

版本：v171.2.10

## 本次一次完成

1. 「英文訂正與搭配詞整理」的單字／搭配詞欄位，輸入期間只更新目前畫面內的資料。
2. 離開文字欄位後才將完整內容寫入本機並排入雲端同步，避免每輸入一個字就反覆儲存。
3. 詞性勾選、新增與刪除等離散操作仍會立即儲存。
4. 關閉或隱藏頁面時仍保留既有的安全儲存機制，避免尚未失焦的內容遺失。

更新資料夾：`gsat-study-tracker-v171.2.10-english-review-save-on-blur`

## 驗證

- 316 項單元／回歸測試全部通過。
- 正式 TypeScript／Vite 建置通過。
- 3 項 Chromium 瀏覽器 E2E 全部通過。

本次不需要新增 Supabase migration，也不需要再次部署 Edge Function；只需部署新版 GitHub Pages 前端。

## Commit 建議

`fix(storage): save English review text after leaving field`
