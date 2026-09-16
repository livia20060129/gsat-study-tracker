# 最新更新

版本：v171.5.26

## 個人版教材清理

- 移除最近新增的六本教材：化學「領航」、物理「優勢／逆轉勝」、英文「學測週計畫／混合題30篇實戰演練」與數學A「新大滿貫」。
- 同步移除手動新增選單、Calendar 專用識別、頁碼地圖、教材進度與排程建議 Prompt 支援。
- 不主動刪除 localStorage 或 Supabase 內既有學習紀錄。

更新資料夾：`gsat-study-tracker-v171.5.26-remove-recent-materials`

## 驗證

- 351 項單元／回歸測試通過。
- 8 項瀏覽器流程測試通過。
- TypeScript 型別檢查與 Vite 正式建置通過。

本次不需要新增 Supabase migration；若正式環境使用 Supabase Calendar Edge Function，需重新部署函式才會同步移除舊識別規則。

## Commit 建議

`chore(personal): remove recently added materials`
