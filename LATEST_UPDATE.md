# 最新更新

版本：v171.6.72

日期：2026-10-18（自用版）

## Unit 進度使用 Unit 模板

- Unlock 3 改用起始／結束 Unit（1～8）及 Unit 對應主題，不再把「Unit 1 Animals（1/2）」套成兩個空白的鎖定頁碼，也不顯示錯誤的頁碼對照訊息。
- Calendar 明確提供 Unit 時，採用 Unit 範圍；版次 3、日期與「1/2」分次資訊不會被誤讀成其他 Unit。不同 Unit 各自建立穩定卡片，不會因舊頁碼重疊而合併。
- 舊 Calendar 項目可從已存說明還原 Unit。舊的實際頁碼仍保存，沒有 Unit 的頁碼紀錄也能依教材地圖顯示相應 Unit，不清除其勾選、分鐘或完成日期。
- Unit 使用 unitStart／unitEnd 與獨立的手動覆蓋標記；修改後重載仍保留，Calendar 定義刷新不覆蓋手動 Unit。只填起始 Unit 時，結束 Unit 預設相同，並限制範圍上限與先後順序。
- 待辦事項同樣顯示可編輯的起始／結束 Unit，雙向同步到原卡，不再把 Unit 寫進 start／end 頁碼欄。
- 完成清單顯示 Unit 範圍與主題，並以 Unit 區分同一事件的不同項目。教材進度保留舊實際頁碼覆蓋率，亦支援 Unit 與「1/2、2/2」分次進度；不把推算頁碼寫回原資料。
- Essential Grammar in Use 保留既有 Unit 模板（1～115），其他頁碼、回次、主題模板維持原有格式。
- 不更動資料庫結構、登入或 Cloud／Calendar 設定；本次不需要 Supabase migration 或重新部署 Edge Functions。

## 驗證

- 497 項單元測試全部通過。新增 Unit 解析、實際 Calendar 定義產生、穩定識別、舊資料相容、獨立保存／範圍驗證、不同 Unit 去重及分次教材進度驗證。
- 應用程式型別檢查、正式建置及本次瀏覽器測試檔的型別檢查通過；建置僅有既存的大型區塊大小提醒。
- 新增 375px 手機版 Unlock 舊 Calendar 卡片驗證，確認 Unit 顯示、對應主題、重新整理後保留，以及原勾選、完成日期和分鐘不變。
- 新增待辦空白 Unit 範圍、單一 Unit 預設結束值、待辦與原卡雙向修改及完成流程，驗證舊實際頁碼不會被 Unit 覆寫。
- 完整 Chromium／WebKit 瀏覽器測試 96 項全部通過。
- 依 verification 流程驗證「Calendar Unit → 卡片模板 → Unit 獨立欄位 → 待辦 → 原卡／重新整理」；既有勾選保存、計時、完成清單、睡眠與手機動畫回歸亦通過。
- 以上為本機驗證結果；套用後仍需由 GitHub Actions 重新執行 Linux CI。

## 覆蓋方式

- 已套用 v171.6.71：使用同版更新資料夾內的「必要覆蓋檔案」，依原路徑覆蓋至專案根目錄，務必包含新增的 data/unitBooks.ts 與 study/unitBookProgress.ts。
- 尚未套用前版或需要完整來源：使用「完整專案覆蓋版」，保留既有 .env.local 等本機設定。
- 兩種資料夾擇一使用，皆不包含依賴套件、建置產物或本機秘密設定。

## Commit 建議

`fix(tracker): use unit templates for unit-based book progress`
