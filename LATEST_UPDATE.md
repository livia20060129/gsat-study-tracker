# 最新更新

版本：v171.1.19

## 本次修正

- 修正「英文訂正與搭配詞整理」在輸入期間同步時，將同一列的半成品文字重複保存成多筆的問題。
- 每個新單字／搭配詞列建立永久識別碼；舊紀錄會依項目與列序取得一致的相容識別碼。
- 本機、待上傳與雲端紀錄交叉比對時，改以識別碼更新同一列，不再以會變動的文字內容辨認列。
- 同步期間優先採用目前本機最新內容，避免較早排入佇列的輸入片段短暫覆蓋新文字。
- 不自動刪除既有重複列，避免誤刪使用者原本確實分開記錄的單字。

## 更新檔案

- `src/legacy-app.ts`
- `src/study/englishReview.ts`
- `src/storage/recordSync.ts`
- `src/types.ts`
- `tests/recordMerge.test.ts`
- `package.json`
- `package-lock.json`
- `LATEST_UPDATE.md`

更新資料夾：`gsat-study-tracker-v171.1.19-english-review-stable-save-update`

## 驗證

- 已重現並驗證 `app → apple` 的輸入過程只會留下 `apple`。
- 已驗證多個不同單字列仍會分別保留。
- TypeScript 檢查通過。
- 全部自動測試通過。
- 正式 Vite 建置通過。

## Commit 建議

`fix(sync): prevent duplicate English review drafts`
