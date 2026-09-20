# 最新更新

版本：v171.6.24

## 修正完成勾選無法儲存

- 原因是作息時間只填小時或分鐘時，整份表單驗證會阻止背景儲存，使畫面雖已勾選，完成狀態與完成日期卻沒有寫入。
- 完成勾選及完成日期現在會獨立保存，不再被尚未填完整的作息時間草稿攔截。
- 未填完整的作息草稿不會寫入，也不會清除上一次已保存的有效起床／就寢時間。
- 完成日期統一放在「項目標題＋標題備註」下方；一般、延期及子項目仍一律顯示為「完成日期」。

## 驗證

- 瀏覽器測試會先讓作息時間處於只填一半的狀態，再勾選一般項目、修改完成日期、讀取 LocalStorage 並重新載入頁面。
- 另以固定的英文互動題子項目驗證勾選後立即寫入並可在重新載入後保留。
- 版面測試確認完成日期位於標題及標題備註下方。
- 400 項單元／回歸測試、TypeScript 型別檢查、Vite 正式建置及 13 項 Chromium E2E 全部通過。

更新資料夾：

- `gsat-study-tracker-v171.6.24-completion-save-required-files`
- `gsat-study-tracker-v171.6.24-completion-save-full-project`

## Commit 建議

`fix(completion): persist checked items independently of routine drafts`
