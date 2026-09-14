# 最新更新

版本：v171.2.12

## 本次一次完成

1. 所有文字、數值、頁碼、分鐘與長文字欄位，輸入期間只更新目前畫面內的資料。
2. 離開輸入欄位後，才將完整內容寫入本機並排入雲端同步。
3. 核取方塊、選單、完成、延期、新增與刪除等離散操作仍會立即儲存。
4. 關閉或隱藏頁面時仍保留安全儲存，避免尚未失焦的內容遺失。

更新資料夾：`gsat-study-tracker-v171.2.12-save-inputs-on-blur`

## 驗證

- 317 項單元／回歸測試全部通過。
- 正式 TypeScript／Vite 建置通過。
- 4 項 Chromium 瀏覽器 E2E 全部通過，其中包含實際驗證「輸入時不寫入、離開欄位後才寫入」。

本次不需要新增 Supabase migration，也不需要再次部署 Edge Function；只需部署新版 GitHub Pages 前端。

## Commit 建議

`fix(storage): save typed fields after leaving input`
