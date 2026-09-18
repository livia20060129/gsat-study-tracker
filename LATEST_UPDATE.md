# 最新更新

版本：v171.6.2

## 新增 Unlock 3 英文教材與教材選單分類

- 英文教材加入 `Unlock 3 (Listening, Speaking, Critical Thinking)`，末頁固定為 p.223。
- 依書本目錄建立完整連續對照：前置內容、Unit 1–8、Glossary、Video and audio scripts、Acknowledgements。
- p.224 的 `Unlock Advisory Panel` 不列入教材進度。
- 手動新增項目可直接選取本書並填入起訖頁；畫面會自動顯示對應 Unit／內容。
- Google Calendar 可從書名辨識本書並鎖定行程提供的頁碼範圍。
- 教材進度圖依已完成項目的實際頁碼計算填色，不使用 Calendar 建議頁碼直接填滿。
- 英文教材選單分為「學測／補充」，Unlock 3 放在「補充」。
- 自然教材依科目標示；數學教材分為「複習講義（兩冊以上一本）／分冊講義（一冊一本）」。

更新資料夾：`gsat-study-tracker-v171.6.2-unlock-3-material`

## 驗證

- 369 項單元／回歸測試通過。
- TypeScript 型別檢查與 Vite 正式建置通過。

本次不更動資料格式，不需要新增 Supabase migration，也不需要重新部署 Supabase Edge Function；網站重新建置部署即可。

## Commit 建議

`feat(materials): add Unlock 3 page map and group manual selectors`
