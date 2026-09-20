# 最新更新

版本：v171.6.25

## 修正跨頁籤將完成勾選還原

- 問題不是單純跳頁太快，而是另一個已開啟頁籤仍保留舊的整日資料；它在切換日期、進入背景或離頁時會把舊的「未勾選」整份寫回。
- 每個日期現在保留當時的載入基準。儲存前會比對「載入基準、本頁實際修改、最新本機紀錄」，再做欄位級三方合併。
- 另一頁籤已完成的勾選與完成日期會被保留；舊頁籤沒有修改過的欄位不會再覆蓋新資料。
- 若兩個頁籤真的同時修改同一欄位為不同值，會保留可辨識欄位的衝突，不再靜默採用其中一邊。

## 驗證

- 新增兩頁籤回歸測試：兩邊先停在 8/16，其中一頁完成項目並將完成日期設為 8/19，再讓仍持有舊資料的另一頁跳轉；回到 8/16 後，完成勾選與 8/19 完成日期皆維持。
- 401 項單元／回歸測試、TypeScript 型別檢查、Vite 正式建置及 14 項 Chromium E2E 全部通過。

更新資料夾：

- `gsat-study-tracker-v171.6.25-stale-tab-completion-required-files`
- `gsat-study-tracker-v171.6.25-stale-tab-completion-full-project`

## Commit 建議

`fix(storage): merge stale-tab drafts before saving completion`
