# 最新更新

版本：v171.6.48

## 訂正勾選不再刷新其他項目

- 原本只有「訂正」勾選會先重畫整個項目區，再執行儲存；合併卡或同日多項資料可能在這個空檔被舊結構刷新。
- 現在勾選或取消「訂正」時，會先把目前完整紀錄寫入儲存空間。
- 儲存完成後只在目前卡片加入或移除「錯因／不熟觀念」欄位，不再重建同日其他卡片。
- 其他項目的分鐘、進度、文字、完成狀態與畫面節點都保持不變。
- 重新整理後，訂正狀態及同日其他項目內容都會完整保留。

## 驗證

- 單元測試驗證訂正操作的順序為「儲存 → 更新目前卡片」，且不會呼叫整頁重畫或改動其他子項目。
- Chromium E2E 以兩張同日卡片重現最後勾選訂正，確認另一張卡片沒有被替換、內容仍保留，重新整理後資料一致。
- 完整單元測試、TypeScript 型別檢查、Vite 正式建置與瀏覽器 E2E 測試通過。

更新資料夾：

- `gsat-study-tracker-v171.6.48-correction-save-isolation-necessary-files`
- `gsat-study-tracker-v171.6.48-correction-save-isolation-full-project`

## Commit 建議

`fix(tracker): preserve sibling items when checking correction`
