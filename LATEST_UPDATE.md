# 最新更新

版本：v171.6.4

## 簡化數學教材分類名稱

- 手動新增項目的數學教材選單改為只顯示「複習講義／分冊講義」。
- 教材進度圖的數學分段標題同步改為「複習講義／分冊講義」。
- 不再顯示「兩冊以上一本／一冊一本」括號說明。
- 實際教材歸類、頁碼、完成百分比與既有紀錄都不變。

更新資料夾：`gsat-study-tracker-v171.6.4-short-math-group-labels`

## 驗證

- 370 項單元／回歸測試通過。
- TypeScript 型別檢查與 Vite 正式建置通過。

本次不更動資料格式，不需要新增 Supabase migration，也不需要重新部署 Supabase Edge Function；網站重新建置部署即可。

## Commit 建議

`fix(progress): shorten math material group labels`
